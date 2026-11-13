-- Migration: create_relationship_event_attention_states
-- Description: Creates private per-user attention tracking for gentle resurfacing of older open shared friction moments.
-- Security: Strict RLS (users can only read/write their own attention state), transactional SECURITY DEFINER RPCs.

BEGIN;

-- 1. Create table public.relationship_event_attention_states
CREATE TABLE public.relationship_event_attention_states (
    event_id uuid NOT NULL REFERENCES public.relationship_events(id) ON DELETE CASCADE,
    couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_presented_at timestamptz NULL,
    snoozed_until timestamptz NULL,
    presentation_count integer NOT NULL DEFAULT 0,
    last_opened_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (event_id, user_id),
    CONSTRAINT relationship_event_attention_states_count_check CHECK (presentation_count >= 0)
);

-- 2. Automatic updated_at trigger (reuses private.set_updated_at())
CREATE TRIGGER on_relationship_event_attention_state_updated
BEFORE UPDATE ON public.relationship_event_attention_states
FOR EACH ROW
EXECUTE FUNCTION private.set_updated_at();

-- 3. Indexes for fast per-user lookups
CREATE INDEX relationship_event_attention_states_user_couple_idx
ON public.relationship_event_attention_states USING btree (user_id, couple_id);

CREATE INDEX relationship_event_attention_states_event_idx
ON public.relationship_event_attention_states USING btree (event_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.relationship_event_attention_states ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Users may only read their own attention states for events in their couple
CREATE POLICY "Users can read own attention states"
ON public.relationship_event_attention_states
FOR SELECT TO authenticated
USING (
    user_id = (SELECT auth.uid())
    AND couple_id IN (SELECT private.user_couple_ids())
);

-- INSERT policy: Users can insert their own attention state for events in their couple
CREATE POLICY "Users can insert own attention states"
ON public.relationship_event_attention_states
FOR INSERT TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND couple_id IN (SELECT private.user_couple_ids())
);

-- UPDATE policy: Users can update only their own attention state
CREATE POLICY "Users can update own attention states"
ON public.relationship_event_attention_states
FOR UPDATE TO authenticated
USING (
    user_id = (SELECT auth.uid())
    AND couple_id IN (SELECT private.user_couple_ids())
)
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND couple_id IN (SELECT private.user_couple_ids())
);

-- 5. Revoke direct public permissions and grant least-privilege permissions
REVOKE ALL ON TABLE public.relationship_event_attention_states FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.relationship_event_attention_states TO authenticated;
GRANT ALL ON TABLE public.relationship_event_attention_states TO service_role;

-- 6. RPC: Mark an older event as presented to the current user
CREATE OR REPLACE FUNCTION public.mark_relationship_event_attention_presented(
    p_event_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_couple_id uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Validate target event belongs to user's couple space and is a shared friction event
    SELECT e.couple_id INTO v_couple_id
    FROM public.relationship_events e
    WHERE e.id = p_event_id
      AND e.event_type = 'friction'
      AND e.visibility = 'ours';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event unavailable';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.couple_members cm
        WHERE cm.couple_id = v_couple_id AND cm.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Relationship membership required';
    END IF;

    INSERT INTO public.relationship_event_attention_states (
        event_id,
        couple_id,
        user_id,
        last_presented_at,
        presentation_count,
        created_at,
        updated_at
    ) VALUES (
        p_event_id,
        v_couple_id,
        v_user_id,
        now(),
        1,
        now(),
        now()
    )
    ON CONFLICT (event_id, user_id) DO UPDATE SET
        last_presented_at = now(),
        presentation_count = public.relationship_event_attention_states.presentation_count + 1,
        updated_at = now();
END;
$$;

-- 7. RPC: Snooze attention for an event ('day' = 24h, 'week' = 7 days)
CREATE OR REPLACE FUNCTION public.snooze_relationship_event_attention(
    p_event_id uuid,
    p_duration text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_couple_id uuid;
    v_snoozed_until timestamptz;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_duration = 'day' THEN
        v_snoozed_until := now() + interval '24 hours';
    ELSIF p_duration = 'week' THEN
        v_snoozed_until := now() + interval '7 days';
    ELSE
        RAISE EXCEPTION 'Invalid snooze duration: %', p_duration;
    END IF;

    SELECT e.couple_id INTO v_couple_id
    FROM public.relationship_events e
    WHERE e.id = p_event_id
      AND e.event_type = 'friction'
      AND e.visibility = 'ours';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event unavailable';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.couple_members cm
        WHERE cm.couple_id = v_couple_id AND cm.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Relationship membership required';
    END IF;

    INSERT INTO public.relationship_event_attention_states (
        event_id,
        couple_id,
        user_id,
        snoozed_until,
        created_at,
        updated_at
    ) VALUES (
        p_event_id,
        v_couple_id,
        v_user_id,
        v_snoozed_until,
        now(),
        now()
    )
    ON CONFLICT (event_id, user_id) DO UPDATE SET
        snoozed_until = v_snoozed_until,
        updated_at = now();
END;
$$;

-- 8. RPC: Record that the user opened/visited the resurfaced moment
CREATE OR REPLACE FUNCTION public.mark_relationship_event_attention_opened(
    p_event_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_couple_id uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT e.couple_id INTO v_couple_id
    FROM public.relationship_events e
    WHERE e.id = p_event_id
      AND e.event_type = 'friction'
      AND e.visibility = 'ours';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event unavailable';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.couple_members cm
        WHERE cm.couple_id = v_couple_id AND cm.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Relationship membership required';
    END IF;

    INSERT INTO public.relationship_event_attention_states (
        event_id,
        couple_id,
        user_id,
        last_opened_at,
        created_at,
        updated_at
    ) VALUES (
        p_event_id,
        v_couple_id,
        v_user_id,
        now(),
        now(),
        now()
    )
    ON CONFLICT (event_id, user_id) DO UPDATE SET
        last_opened_at = now(),
        updated_at = now();
END;
$$;

-- 9. Permissions on RPC functions
REVOKE ALL ON FUNCTION public.mark_relationship_event_attention_presented(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_relationship_event_attention_presented(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.snooze_relationship_event_attention(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.snooze_relationship_event_attention(uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.mark_relationship_event_attention_opened(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_relationship_event_attention_opened(uuid) TO authenticated, service_role;

-- 10. Realtime setup
ALTER TABLE public.relationship_event_attention_states REPLICA IDENTITY FULL;
ALTER TABLE public.couple_important_dates REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'relationship_event_attention_states'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.relationship_event_attention_states;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'couple_important_dates'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.couple_important_dates;
    END IF;
END;
$$;

COMMIT;
