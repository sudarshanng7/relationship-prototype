
BEGIN;

-- ROS-03B: Independent partner perspectives.
-- Private drafts and perspective history are deferred.

CREATE TABLE public.event_perspectives (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    event_id uuid NOT NULL
        REFERENCES public.relationship_events(id)
        ON DELETE CASCADE,

    author_id uuid NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    perspective_text text NOT NULL,

    sharing_status text NOT NULL DEFAULT 'submitted'
        CHECK (sharing_status IN ('submitted', 'suspended')),

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT perspective_text_nonempty
        CHECK (length(btrim(perspective_text)) > 0),

    CONSTRAINT one_perspective_per_author_per_event
        UNIQUE (event_id, author_id)
);

CREATE INDEX event_perspectives_event_idx
ON public.event_perspectives(event_id);

ALTER TABLE public.event_perspectives
ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to query only permitted rows.
GRANT SELECT, INSERT, DELETE
ON public.event_perspectives TO authenticated;

-- Do not permit changing ownership or event association.
GRANT UPDATE (
    perspective_text,
    sharing_status,
    updated_at
)
ON public.event_perspectives TO authenticated;

-- Read:
-- Authors can read their own contributions while still
-- belonging to the couple, including suspended ones.
-- Partners can read only submitted contributions
-- on Ours events within their current couple.

CREATE POLICY "Read permitted perspectives"
ON public.event_perspectives
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.relationship_events e
        JOIN public.couple_members cm
          ON cm.couple_id = e.couple_id
        WHERE e.id = event_id
          AND cm.user_id = (SELECT auth.uid())
          AND (
              author_id = (SELECT auth.uid())
              OR (
                  e.visibility = 'ours'
                  AND sharing_status = 'submitted'
              )
          )
    )
);

-- Create:
-- Only current couple members can submit perspectives
-- to an event that is currently Ours.
-- The author must be the authenticated user.

CREATE POLICY "Submit own perspective"
ON public.event_perspectives
FOR INSERT TO authenticated
WITH CHECK (
    author_id = (SELECT auth.uid())
    AND sharing_status = 'submitted'
    AND EXISTS (
        SELECT 1
        FROM public.relationship_events e
        JOIN public.couple_members cm
          ON cm.couple_id = e.couple_id
        WHERE e.id = event_id
          AND e.visibility = 'ours'
          AND cm.user_id = (SELECT auth.uid())
    )
);

-- Updates:
-- Authors may edit or explicitly resubmit their own
-- perspective only while the event is Ours.

CREATE POLICY "Update own perspective"
ON public.event_perspectives
FOR UPDATE TO authenticated
USING (
    author_id = (SELECT auth.uid())
)
WITH CHECK (
    author_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.relationship_events e
        JOIN public.couple_members cm
          ON cm.couple_id = e.couple_id
        WHERE e.id = event_id
          AND e.visibility = 'ours'
          AND cm.user_id = (SELECT auth.uid())
    )
);

-- Withdrawal: author can delete their own contribution.
CREATE POLICY "Withdraw own perspective"
ON public.event_perspectives
FOR DELETE TO authenticated
USING (
    author_id = (SELECT auth.uid())
);

-- When an event becomes Mine, suspend all perspectives
-- automatically. Their text is retained, but no longer
-- readable by the other partner under the SELECT policy.

CREATE FUNCTION public.suspend_event_perspectives()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.visibility = 'mine'
       AND OLD.visibility IS DISTINCT FROM NEW.visibility
    THEN
        UPDATE public.event_perspectives
        SET sharing_status = 'suspended',
            updated_at = now()
        WHERE event_id = NEW.id
          AND sharing_status = 'submitted';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.suspend_event_perspectives()
FROM PUBLIC;

CREATE TRIGGER suspend_perspectives_when_mine
AFTER UPDATE OF visibility
ON public.relationship_events
FOR EACH ROW
EXECUTE FUNCTION public.suspend_event_perspectives();

COMMIT;
