-- Migration: create_weekly_reflections
-- Description: Creates private per-user weekly reflection storage ("Your week, gently")
-- Security: Strict per-user RLS (users can only insert, select, update, delete their own reflections),
-- authenticated user enforcement, couple membership validation, identity immutability,
-- valid week period constraints, and answer validation.

BEGIN;

CREATE TABLE public.weekly_reflections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    couple_id uuid REFERENCES public.couples(id) ON DELETE SET NULL,
    week_start timestamptz NOT NULL,
    week_end timestamptz NOT NULL,
    stayed_with text NOT NULL,
    carry_forward text NOT NULL,
    private_note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT weekly_reflections_user_week_unique UNIQUE (user_id, week_start),
    CONSTRAINT weekly_reflections_period_check CHECK (week_end > week_start),
    CONSTRAINT weekly_reflections_stayed_with_check CHECK (
        stayed_with IN (
            'A moment of closeness',
            'Something we worked through',
            'Something still on my mind',
            'An ordinary moment I appreciated',
            'Nothing in particular',
            'closeness',
            'worked_through',
            'on_my_mind',
            'appreciated',
            'nothing'
        )
    ),
    CONSTRAINT weekly_reflections_carry_forward_check CHECK (
        carry_forward IN (
            'More time together',
            'A gentler conversation',
            'More space and patience',
            'Something playful',
            'Keep things as they are',
            'I’m not sure yet',
            'time_together',
            'gentler_conversation',
            'space_and_patience',
            'playful',
            'as_they_are',
            'not_sure'
        )
    ),
    CONSTRAINT weekly_reflections_private_note_check CHECK (
        private_note IS NULL OR (
            char_length(private_note) <= 1000 AND
            private_note = btrim(private_note) AND
            char_length(private_note) > 0
        )
    )
);

-- 2. Indexes for fast per-user lookups
CREATE INDEX weekly_reflections_user_week_idx
ON public.weekly_reflections USING btree (user_id, week_start DESC);

CREATE INDEX weekly_reflections_couple_user_idx
ON public.weekly_reflections USING btree (couple_id, user_id)
WHERE couple_id IS NOT NULL;

-- 3. Validation function for user_id, couple_id, and immutability
CREATE OR REPLACE FUNCTION public.weekly_reflections_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Require user_id to match auth.uid() if authenticated
    IF auth.role() = 'authenticated' AND NEW.user_id <> auth.uid() THEN
        RAISE EXCEPTION 'user_id must match authenticated user';
    END IF;

    -- If couple_id is provided, verify user is a member of that couple
    IF NEW.couple_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.couple_members cm
            WHERE cm.couple_id = NEW.couple_id
              AND cm.user_id = NEW.user_id
        ) THEN
            RAISE EXCEPTION 'User does not belong to the specified couple';
        END IF;
    END IF;

    -- Immutability guards on UPDATE
    IF TG_OP = 'UPDATE' THEN
        IF NEW.id <> OLD.id THEN
            RAISE EXCEPTION 'id is immutable';
        END IF;
        IF NEW.user_id <> OLD.user_id THEN
            RAISE EXCEPTION 'user_id is immutable';
        END IF;
        IF NEW.week_start <> OLD.week_start THEN
            RAISE EXCEPTION 'week_start is immutable';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_weekly_reflection_validate
BEFORE INSERT OR UPDATE ON public.weekly_reflections
FOR EACH ROW
EXECUTE FUNCTION public.weekly_reflections_validate();

-- 4. Automatic updated_at trigger
CREATE TRIGGER on_weekly_reflection_updated
BEFORE UPDATE ON public.weekly_reflections
FOR EACH ROW
EXECUTE FUNCTION private.set_updated_at();

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.weekly_reflections ENABLE ROW LEVEL SECURITY;

-- Owner-only SELECT policy
CREATE POLICY "Users can read own weekly reflections"
ON public.weekly_reflections
FOR SELECT TO authenticated
USING (
    user_id = (SELECT auth.uid())
);

-- Owner-only INSERT policy
CREATE POLICY "Users can insert own weekly reflections"
ON public.weekly_reflections
FOR INSERT TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
);

-- Owner-only UPDATE policy
CREATE POLICY "Users can update own weekly reflections"
ON public.weekly_reflections
FOR UPDATE TO authenticated
USING (
    user_id = (SELECT auth.uid())
)
WITH CHECK (
    user_id = (SELECT auth.uid())
);

-- Owner-only DELETE policy
CREATE POLICY "Users can delete own weekly reflections"
ON public.weekly_reflections
FOR DELETE TO authenticated
USING (
    user_id = (SELECT auth.uid())
);

-- 6. Permissions and Grants
REVOKE ALL ON TABLE public.weekly_reflections FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.weekly_reflections TO authenticated;
GRANT ALL ON TABLE public.weekly_reflections TO service_role;

COMMIT;
