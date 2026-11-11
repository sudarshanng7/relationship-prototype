-- Purple Garden database change
-- Feature: Shared Friction Repair Workflow (Phase 1)
-- Purpose: Additive current-state repair response and outcome persistence with atomic RPCs, strict couple RLS, and Realtime publication
-- Data classification: Couple-scoped intentionally shared repair responses & creator-authored outcomes
-- Security boundary: RLS couple membership checks via private.user_couple_ids(), strict author_id checks, and SECURITY DEFINER RPC validation
-- Introduced: 2026-11-11

BEGIN;

-- ============================================================================
-- 1. CURRENT-STATE REPAIR RESPONSE TABLE
-- ============================================================================

CREATE TABLE public.relationship_event_repair_responses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL
        REFERENCES public.relationship_events(id)
        ON DELETE CASCADE,
    couple_id uuid NOT NULL
        REFERENCES public.couples(id)
        ON DELETE CASCADE,
    user_id uuid NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,
    phase text NOT NULL
        CONSTRAINT relationship_event_repair_responses_phase_check
        CHECK (phase IN ('arrival', 'settlement')),
    response_code text NOT NULL,
    suggested_step_code text NULL,
    shared_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Enforces current-state-only per user per phase (enables upsert revisions)
    CONSTRAINT relationship_event_repair_responses_event_user_phase_key
        UNIQUE (event_id, user_id, phase),

    -- Strict phase-to-code alignment
    CONSTRAINT relationship_event_repair_responses_code_check
        CHECK (
            (phase = 'arrival' AND response_code IN ('heard', 'need_time', 'suggest_next_step')) OR
            (phase = 'settlement' AND response_code IN ('ready', 'reconnecting', 'need_time'))
        ),

    -- Strict suggested step code rules
    CONSTRAINT relationship_event_repair_responses_suggested_step_check
        CHECK (
            (phase = 'arrival' AND response_code = 'suggest_next_step' AND suggested_step_code IN (
                'quiet_chat',
                'warm_hug',
                'walk_outside',
                'quiet_time_together',
                'tea_together'
            )) OR
            (NOT (phase = 'arrival' AND response_code = 'suggest_next_step') AND suggested_step_code IS NULL)
        )
);

COMMENT ON TABLE public.relationship_event_repair_responses IS
    'Purple Garden Shared Friction Repair Workflow: Stores the latest intentionally shared repair state for each authenticated partner per repair phase (current-state-only semantics).';

COMMENT ON COLUMN public.relationship_event_repair_responses.id IS 'Primary key identifier for the repair response record.';
COMMENT ON COLUMN public.relationship_event_repair_responses.event_id IS 'Target shared friction moment in relationship_events.';
COMMENT ON COLUMN public.relationship_event_repair_responses.couple_id IS 'Active couple space owning this event, verified against private.user_couple_ids().';
COMMENT ON COLUMN public.relationship_event_repair_responses.user_id IS 'Responding partner identity derived strictly from auth.uid().';
COMMENT ON COLUMN public.relationship_event_repair_responses.phase IS 'Repair phase: arrival (recipient initial acknowledgment) or settlement (closing check-in).';
COMMENT ON COLUMN public.relationship_event_repair_responses.response_code IS 'Stable programmatic response code (arrival: heard, need_time, suggest_next_step; settlement: ready, reconnecting, need_time).';
COMMENT ON COLUMN public.relationship_event_repair_responses.suggested_step_code IS 'Optional low-pressure next step code (quiet_chat, warm_hug, walk_outside, quiet_time_together, tea_together). Required if and only if phase=arrival and response_code=suggest_next_step.';
COMMENT ON COLUMN public.relationship_event_repair_responses.shared_at IS 'Timestamp when this response phase was first shared with the partner.';
COMMENT ON COLUMN public.relationship_event_repair_responses.updated_at IS 'Timestamp when this response was last revised, maintained by trigger.';

-- ============================================================================
-- 2. REPAIR OUTCOME TABLE
-- ============================================================================

CREATE TABLE public.relationship_event_repair_outcomes (
    event_id uuid PRIMARY KEY
        REFERENCES public.relationship_events(id)
        ON DELETE CASCADE,
    couple_id uuid NOT NULL
        REFERENCES public.couples(id)
        ON DELETE CASCADE,
    completed_by uuid NOT NULL
        REFERENCES auth.users(id),
    takeaway_tag text NULL
        CONSTRAINT relationship_event_repair_outcomes_takeaway_tag_check
        CHECK (
            takeaway_tag IS NULL OR takeaway_tag IN (
                'feeling_heard',
                'giving_space',
                'small_gesture',
                'talking_it_through',
                'time_together'
            )
        ),
    takeaway_note text NULL
        CONSTRAINT relationship_event_repair_outcomes_takeaway_note_check
        CHECK (
            takeaway_note IS NULL OR (
                btrim(takeaway_note) = takeaway_note AND
                char_length(takeaway_note) BETWEEN 1 AND 500
            )
        ),
    completed_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.relationship_event_repair_outcomes IS
    'Purple Garden Shared Friction Repair Workflow: Stores the explicit final completion of a shared friction moment and its optional creator-authored takeaway.';

COMMENT ON COLUMN public.relationship_event_repair_outcomes.event_id IS 'Primary key referencing the completed relationship_events row.';
COMMENT ON COLUMN public.relationship_event_repair_outcomes.couple_id IS 'Active couple space owning this event, verified against private.user_couple_ids().';
COMMENT ON COLUMN public.relationship_event_repair_outcomes.completed_by IS 'Creator identity who confirmed reconnection, derived strictly from auth.uid().';
COMMENT ON COLUMN public.relationship_event_repair_outcomes.takeaway_tag IS 'Optional category tag for what helped this moment soften (feeling_heard, giving_space, small_gesture, talking_it_through, time_together).';
COMMENT ON COLUMN public.relationship_event_repair_outcomes.takeaway_note IS 'Optional trimmed gentle takeaway note between 1 and 500 characters.';
COMMENT ON COLUMN public.relationship_event_repair_outcomes.completed_at IS 'Timestamp when reconnection was formally completed.';
COMMENT ON COLUMN public.relationship_event_repair_outcomes.updated_at IS 'Timestamp when outcome was last updated, maintained by trigger.';

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

CREATE INDEX relationship_event_repair_responses_couple_id_idx
    ON public.relationship_event_repair_responses(couple_id);

CREATE INDEX relationship_event_repair_responses_user_id_idx
    ON public.relationship_event_repair_responses(user_id);

CREATE INDEX relationship_event_repair_responses_event_phase_idx
    ON public.relationship_event_repair_responses(event_id, phase);

CREATE INDEX relationship_event_repair_outcomes_couple_id_idx
    ON public.relationship_event_repair_outcomes(couple_id);

CREATE INDEX relationship_event_repair_outcomes_completed_by_idx
    ON public.relationship_event_repair_outcomes(completed_by);

-- ============================================================================
-- 4. UPDATED_AT TRIGGERS (Reusing private.set_updated_at())
-- ============================================================================

CREATE TRIGGER set_relationship_event_repair_responses_updated_at
    BEFORE UPDATE ON public.relationship_event_repair_responses
    FOR EACH ROW
    EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER set_relationship_event_repair_outcomes_updated_at
    BEFORE UPDATE ON public.relationship_event_repair_outcomes
    FOR EACH ROW
    EXECUTE FUNCTION private.set_updated_at();

-- ============================================================================
-- 5. RLS AND LEAST PRIVILEGE
-- ============================================================================

ALTER TABLE public.relationship_event_repair_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_event_repair_outcomes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.relationship_event_repair_responses FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.relationship_event_repair_outcomes FROM PUBLIC, anon, authenticated;

-- Direct client DML is prohibited; authenticated clients may only SELECT rows in their couple
GRANT SELECT ON TABLE public.relationship_event_repair_responses TO authenticated;
GRANT SELECT ON TABLE public.relationship_event_repair_outcomes TO authenticated;

-- Service role retains full administrative access
GRANT ALL ON TABLE public.relationship_event_repair_responses TO service_role;
GRANT ALL ON TABLE public.relationship_event_repair_outcomes TO service_role;

CREATE POLICY "Couple members can read repair responses"
ON public.relationship_event_repair_responses
FOR SELECT TO authenticated
USING (couple_id IN (SELECT private.user_couple_ids()));

CREATE POLICY "Couple members can read repair outcomes"
ON public.relationship_event_repair_outcomes
FOR SELECT TO authenticated
USING (couple_id IN (SELECT private.user_couple_ids()));

COMMENT ON POLICY "Couple members can read repair responses" ON public.relationship_event_repair_responses IS
    'Allows authenticated partners to read shared repair responses within their couple space.';

COMMENT ON POLICY "Couple members can read repair outcomes" ON public.relationship_event_repair_outcomes IS
    'Allows authenticated partners to read final repair outcomes and shared takeaways within their couple space.';

-- ============================================================================
-- 6. RPC: submit_repair_response
-- ============================================================================

-- NOTE: SECURITY DEFINER is required because a non-creator recipient must transition
-- relationship_events.status from 'open' to 'partially_repaired', whereas existing
-- relationship_events RLS policies only allow creator updates. Direct client INSERT/UPDATE
-- on relationship_event_repair_responses is also revoked to enforce transactional validation.
CREATE OR REPLACE FUNCTION public.submit_repair_response(
    p_event_id uuid,
    p_phase text,
    p_response_code text,
    p_suggested_step_code text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_couple_id uuid;
    v_creator_id uuid;
    v_event_status text;
    v_response_id uuid;
BEGIN
    -- A. Authentication
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- B. Lock and validate event
    SELECT e.couple_id, e.creator_id, e.status
    INTO v_couple_id, v_creator_id, v_event_status
    FROM public.relationship_events e
    WHERE e.id = p_event_id
      AND e.event_type = 'friction'
      AND e.visibility = 'ours'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event unavailable';
    END IF;

    -- Caller must be an active member of the event couple
    IF NOT EXISTS (
        SELECT 1 FROM public.couple_members cm
        WHERE cm.couple_id = v_couple_id AND cm.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Relationship membership required';
    END IF;

    IF v_event_status = 'reconnected' THEN
        RAISE EXCEPTION 'Event is already reconnected';
    END IF;

    -- C. Role and status validation
    IF p_phase = 'arrival' THEN
        IF v_user_id = v_creator_id THEN
            RAISE EXCEPTION 'Only the recipient may submit an arrival response';
        END IF;

        IF v_event_status NOT IN ('open', 'partially_repaired') THEN
            RAISE EXCEPTION 'Event status does not permit arrival responses: %', COALESCE(v_event_status, 'null');
        END IF;
    ELSIF p_phase = 'settlement' THEN
        -- Settlement requires that the event is already in care
        IF v_event_status <> 'partially_repaired' THEN
            RAISE EXCEPTION 'Event must be in care (partially_repaired) before settlement responses can be submitted, current status: %', COALESCE(v_event_status, 'null');
        END IF;

        -- Require that a valid arrival response already exists from a current non-creator couple member
        IF NOT EXISTS (
            SELECT 1 FROM public.relationship_event_repair_responses r
            JOIN public.couple_members cm
              ON cm.user_id = r.user_id
             AND cm.couple_id = v_couple_id
            WHERE r.event_id = p_event_id
              AND r.phase = 'arrival'
              AND r.user_id <> v_creator_id
        ) THEN
            RAISE EXCEPTION 'Recipient arrival response required before settlement';
        END IF;
    ELSE
        RAISE EXCEPTION 'Invalid repair phase: %', p_phase;
    END IF;

    -- D. Input validation
    IF p_phase = 'arrival' THEN
        IF p_response_code NOT IN ('heard', 'need_time', 'suggest_next_step') THEN
            RAISE EXCEPTION 'Invalid arrival response code: %', p_response_code;
        END IF;

        IF p_response_code = 'suggest_next_step' THEN
            IF p_suggested_step_code IS NULL OR p_suggested_step_code NOT IN (
                'quiet_chat',
                'warm_hug',
                'walk_outside',
                'quiet_time_together',
                'tea_together'
            ) THEN
                RAISE EXCEPTION 'Invalid or missing suggested step code: %', p_suggested_step_code;
            END IF;
        ELSE
            IF p_suggested_step_code IS NOT NULL THEN
                RAISE EXCEPTION 'Suggested step code must be null when response code is not suggest_next_step';
            END IF;
        END IF;
    ELSIF p_phase = 'settlement' THEN
        IF p_response_code NOT IN ('ready', 'reconnecting', 'need_time') THEN
            RAISE EXCEPTION 'Invalid settlement response code: %', p_response_code;
        END IF;

        IF p_suggested_step_code IS NOT NULL THEN
            RAISE EXCEPTION 'Suggested step code must be null for settlement phase';
        END IF;
    END IF;

    -- E. Upsert current-state response
    INSERT INTO public.relationship_event_repair_responses (
        event_id,
        couple_id,
        user_id,
        phase,
        response_code,
        suggested_step_code,
        shared_at,
        updated_at
    )
    VALUES (
        p_event_id,
        v_couple_id,
        v_user_id,
        p_phase,
        p_response_code,
        p_suggested_step_code,
        now(),
        now()
    )
    ON CONFLICT (event_id, user_id, phase)
    DO UPDATE SET
        response_code = EXCLUDED.response_code,
        suggested_step_code = EXCLUDED.suggested_step_code,
        updated_at = now()
    RETURNING id INTO v_response_id;

    -- F. Event status transition
    -- Transition from open to partially_repaired upon recipient arrival response
    IF p_phase = 'arrival' AND v_event_status = 'open' THEN
        UPDATE public.relationship_events
        SET status = 'partially_repaired'
        WHERE id = p_event_id;
    END IF;

    RETURN v_response_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_repair_response(uuid, text, text, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_repair_response(uuid, text, text, text)
TO authenticated, service_role;

COMMENT ON FUNCTION public.submit_repair_response(uuid, text, text, text) IS
    'Purple Garden Shared Friction Repair Workflow: Atomically validates and upserts an authenticated partner repair response, transitioning relationship_events from open to partially_repaired when recipient arrives.';

-- ============================================================================
-- 7. RPC: complete_repair_reconnection
-- ============================================================================

-- NOTE: SECURITY DEFINER is required to atomically verify both partners readiness,
-- insert the repair outcome record, and transition relationship_events.status to reconnected.
CREATE OR REPLACE FUNCTION public.complete_repair_reconnection(
    p_event_id uuid,
    p_takeaway_tag text DEFAULT NULL,
    p_takeaway_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_couple_id uuid;
    v_creator_id uuid;
    v_event_status text;
    v_member_count integer;
    v_ready_count integer;
    v_trimmed_note text;
BEGIN
    -- 1. Authentication
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- 2. Lock and load relationship_events row
    SELECT e.couple_id, e.creator_id, e.status
    INTO v_couple_id, v_creator_id, v_event_status
    FROM public.relationship_events e
    WHERE e.id = p_event_id
      AND e.event_type = 'friction'
      AND e.visibility = 'ours'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event unavailable';
    END IF;

    -- 3. Authorization (Creator and Couple Membership)
    IF v_user_id <> v_creator_id THEN
        RAISE EXCEPTION 'Only the event creator may complete reconnection';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.couple_members cm
        WHERE cm.couple_id = v_couple_id AND cm.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Relationship membership required';
    END IF;

    -- 4. Idempotency Check (Only performed AFTER authenticating and authorizing caller)
    IF v_event_status = 'reconnected' THEN
        IF EXISTS (
            SELECT 1 FROM public.relationship_event_repair_outcomes o
            WHERE o.event_id = p_event_id
              AND o.couple_id = v_couple_id
        ) THEN
            RETURN p_event_id;
        ELSE
            RAISE EXCEPTION 'Event is already reconnected without a valid repair outcome';
        END IF;
    END IF;

    -- 5. Require correct pre-completion event status (must be in care / partially_repaired)
    IF v_event_status <> 'partially_repaired' THEN
        RAISE EXCEPTION 'Event must be in care (partially_repaired) before completion, current status: %', COALESCE(v_event_status, 'null');
    END IF;

    -- 6. Validate readiness against current couple membership
    -- The couple must currently contain exactly two distinct members
    SELECT count(*) INTO v_member_count
    FROM public.couple_members cm
    WHERE cm.couple_id = v_couple_id;

    IF v_member_count <> 2 THEN
        RAISE EXCEPTION 'Reconnection requires an active two-partner space';
    END IF;

    -- The event creator must be one of those two active members
    IF NOT EXISTS (
        SELECT 1 FROM public.couple_members cm
        WHERE cm.couple_id = v_couple_id AND cm.user_id = v_creator_id
    ) THEN
        RAISE EXCEPTION 'Event creator is no longer an active member of this couple';
    END IF;

    -- Both current distinct couple members must have exactly one settlement response with response_code = 'ready'
    SELECT count(*) INTO v_ready_count
    FROM public.couple_members cm
    JOIN public.relationship_event_repair_responses r
      ON r.user_id = cm.user_id
     AND r.couple_id = v_couple_id
     AND r.event_id = p_event_id
     AND r.phase = 'settlement'
     AND r.response_code = 'ready'
    WHERE cm.couple_id = v_couple_id;

    IF v_ready_count <> 2 THEN
        RAISE EXCEPTION 'Both partners must be ready before completing reconnection';
    END IF;

    -- 7. Takeaway validation
    v_trimmed_note := NULLIF(btrim(p_takeaway_note), '');

    IF p_takeaway_note IS NOT NULL AND v_trimmed_note IS NULL THEN
        RAISE EXCEPTION 'Takeaway note cannot be whitespace only';
    END IF;

    IF p_takeaway_tag IS NOT NULL THEN
        IF p_takeaway_tag NOT IN (
            'feeling_heard',
            'giving_space',
            'small_gesture',
            'talking_it_through',
            'time_together'
        ) THEN
            RAISE EXCEPTION 'Invalid takeaway tag: %', p_takeaway_tag;
        END IF;
    END IF;

    IF v_trimmed_note IS NOT NULL THEN
        IF char_length(v_trimmed_note) > 500 THEN
            RAISE EXCEPTION 'Takeaway note exceeds maximum length of 500 characters';
        END IF;
    END IF;

    -- 8. Atomic outcome insert and event reconnection (repair_method preserved unchanged)
    INSERT INTO public.relationship_event_repair_outcomes (
        event_id,
        couple_id,
        completed_by,
        takeaway_tag,
        takeaway_note,
        completed_at,
        updated_at
    )
    VALUES (
        p_event_id,
        v_couple_id,
        v_user_id,
        p_takeaway_tag,
        v_trimmed_note,
        now(),
        now()
    );

    UPDATE public.relationship_events
    SET
        status = 'reconnected',
        reconnected_at = now()
    WHERE id = p_event_id;

    RETURN p_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_repair_reconnection(uuid, text, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.complete_repair_reconnection(uuid, text, text)
TO authenticated, service_role;

COMMENT ON FUNCTION public.complete_repair_reconnection(uuid, text, text) IS
    'Purple Garden Shared Friction Repair Workflow: Validates mutual partner readiness, inserts repair outcome record, and transitions relationship_events to reconnected.';

-- ============================================================================
-- 8. PRIVATE REFLECTION POLICY CORRECTION
-- ============================================================================

-- This policy allows non-creator couple members to record their own private reflections on shared friction events.
CREATE POLICY "Couple members can add private reflections to shared friction events"
ON public.event_private_reflections
FOR INSERT TO authenticated
WITH CHECK (
    author_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.relationship_events e
        WHERE e.id = event_id
          AND e.visibility = 'ours'
          AND e.event_type = 'friction'
          AND e.couple_id IN (SELECT private.user_couple_ids())
    )
);

COMMENT ON POLICY "Couple members can add private reflections to shared friction events" ON public.event_private_reflections IS
    'Allows non-creator partners to record private reflections on shared friction moments in their couple space, preserving strict author-only SELECT isolation.';

-- ============================================================================
-- 9. REALTIME PUBLICATION
-- ============================================================================

ALTER TABLE public.relationship_event_repair_responses REPLICA IDENTITY FULL;
ALTER TABLE public.relationship_event_repair_outcomes REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'relationship_events'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.relationship_events;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'relationship_event_repair_responses'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.relationship_event_repair_responses;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'relationship_event_repair_outcomes'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.relationship_event_repair_outcomes;
    END IF;
END;
$$;

COMMIT;
