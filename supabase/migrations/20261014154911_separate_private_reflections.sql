
BEGIN;

-- 1. Shared text must be deliberately supplied.
ALTER TABLE public.relationship_events
ADD COLUMN shared_topic text;

-- 2. Personal reflections are stored separately.
CREATE TABLE public.event_private_reflections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL
        REFERENCES public.relationship_events(id)
        ON DELETE CASCADE,
    author_id uuid NOT NULL
        REFERENCES auth.users(id),
    note text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT event_private_reflections_author_event_unique
        UNIQUE (event_id, author_id)
);

CREATE INDEX event_private_reflections_author_idx
ON public.event_private_reflections(author_id);

-- 3. Preserve legacy notes as creator-owned private reflections.
INSERT INTO public.event_private_reflections (
    event_id,
    author_id,
    note,
    created_at,
    updated_at
)
SELECT
    id,
    creator_id,
    note,
    created_at,
    created_at
FROM public.relationship_events
WHERE note IS NOT NULL;

-- 4. Activate Row Level Security.
ALTER TABLE public.event_private_reflections
ENABLE ROW LEVEL SECURITY;

-- A user may read only their own reflection.
CREATE POLICY "Authors can read private reflections"
ON public.event_private_reflections
FOR SELECT TO authenticated
USING (author_id = (SELECT auth.uid()));

-- A user may create a private reflection only for an
-- event that they created.
CREATE POLICY "Creators can add private reflections"
ON public.event_private_reflections
FOR INSERT TO authenticated
WITH CHECK (
    author_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.relationship_events e
        WHERE e.id = event_id
          AND e.creator_id = (SELECT auth.uid())
    )
);

-- A user may edit only their own reflection, and
-- may not reassign it to another person's event.
CREATE POLICY "Authors can update private reflections"
ON public.event_private_reflections
FOR UPDATE TO authenticated
USING (author_id = (SELECT auth.uid()))
WITH CHECK (
    author_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.relationship_events e
        WHERE e.id = event_id
          AND e.creator_id = (SELECT auth.uid())
    )
);

CREATE POLICY "Authors can delete private reflections"
ON public.event_private_reflections
FOR DELETE TO authenticated
USING (author_id = (SELECT auth.uid()));

-- Grant table access; RLS still restricts each row.
REVOKE ALL ON public.event_private_reflections
FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.event_private_reflections TO authenticated;

-- 5. Ensure that legacy data was copied before removal.
DO $$
DECLARE
    source_count bigint;
    copied_count bigint;
BEGIN
    SELECT count(*) INTO source_count
    FROM public.relationship_events
    WHERE note IS NOT NULL;

    SELECT count(*) INTO copied_count
    FROM public.event_private_reflections;

    IF source_count <> copied_count THEN
        RAISE EXCEPTION
            'Legacy note migration mismatch: % source, % copied',
            source_count, copied_count;
    END IF;
END;
$$;

-- 6. Remove the old column from the shared event table.
-- No existing note is copied into shared_topic.
ALTER TABLE public.relationship_events
DROP COLUMN note;

COMMIT;
