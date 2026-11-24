-- Migration: 20261124222000_extend_challenge_rewards_and_outcomes.sql
-- Purpose: Support playful Task + Outcome + Reward journey:
--   - fallback_reward: "What happens if not this time"
--   - challenge_outcome: 'completed' | 'not_this_time' (independent from acceptance status = 'resolved')
--   - resolve_challenge_outcome RPC: safely closes challenge as completed or not_this_time

BEGIN;

-- 1. Add fallback_reward and challenge_outcome columns to annoyance_reframes
ALTER TABLE public.annoyance_reframes
  ADD COLUMN IF NOT EXISTS fallback_reward text,
  ADD COLUMN IF NOT EXISTS challenge_outcome text CHECK (challenge_outcome IS NULL OR challenge_outcome IN ('completed', 'not_this_time')),
  ADD COLUMN IF NOT EXISTS outcome_recorded_at timestamptz,
  ADD COLUMN IF NOT EXISTS outcome_recorded_by uuid REFERENCES auth.users(id);

-- Update save_annoyance_reframe RPC to support fallback_reward
CREATE OR REPLACE FUNCTION public.save_annoyance_reframe(
    p_couple_id uuid,
    p_topic_key text,
    p_custom_topic_label text,
    p_is_playful boolean,
    p_reframe_tone text,
    p_reframe_text text,
    p_include_reframe_with_partner boolean,
    p_status text,
    p_shared_with_partner boolean,
    p_challenge_idea text,
    p_challenge_participant text,
    p_challenge_timeframe text,
    p_challenge_reward text,
    p_private_note text,
    p_id uuid DEFAULT NULL,
    p_event_id uuid DEFAULT NULL,
    p_clear_reframe_text boolean DEFAULT false,
    p_clear_private_note boolean DEFAULT false,
    p_fallback_reward text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
    v_user_id uuid;
    v_reframe_id uuid;
    v_private_note text;
    v_custom_topic text;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    v_private_note := NULLIF(trim(p_private_note), '');
    v_custom_topic := NULLIF(trim(p_custom_topic_label), '');

    IF p_id IS NOT NULL THEN
        -- Verify author owns reframe
        IF NOT EXISTS (
            SELECT 1 FROM public.annoyance_reframes
            WHERE id = p_id AND author_id = v_user_id
        ) THEN
            RAISE EXCEPTION 'Reframe not found or not owned by user';
        END IF;

        UPDATE public.annoyance_reframes
        SET
            topic_key = COALESCE(NULLIF(trim(p_topic_key), ''), topic_key),
            custom_topic_label = CASE
                WHEN p_custom_topic_label IS NOT NULL THEN NULLIF(trim(p_custom_topic_label), '')
                ELSE custom_topic_label
            END,
            is_playful = COALESCE(p_is_playful, is_playful),
            reframe_tone = CASE
                WHEN p_reframe_tone IS NOT NULL THEN NULLIF(trim(p_reframe_tone), '')
                ELSE reframe_tone
            END,
            reframe_text = CASE
                WHEN p_clear_reframe_text THEN NULL
                WHEN p_reframe_text IS NOT NULL THEN NULLIF(trim(p_reframe_text), '')
                ELSE reframe_text
            END,
            include_reframe_with_partner = COALESCE(p_include_reframe_with_partner, include_reframe_with_partner),
            status = COALESCE(p_status, status),
            shared_with_partner = COALESCE(p_shared_with_partner, shared_with_partner),
            challenge_idea = CASE
                WHEN p_challenge_idea IS NOT NULL THEN NULLIF(trim(p_challenge_idea), '')
                ELSE challenge_idea
            END,
            challenge_participant = COALESCE(p_challenge_participant, challenge_participant),
            challenge_timeframe = COALESCE(p_challenge_timeframe, challenge_timeframe),
            challenge_reward = COALESCE(p_challenge_reward, challenge_reward),
            fallback_reward = COALESCE(p_fallback_reward, fallback_reward),
            event_id = COALESCE(p_event_id, event_id),
            updated_at = now()
        WHERE id = p_id AND author_id = v_user_id
        RETURNING id INTO v_reframe_id;
    ELSE
        INSERT INTO public.annoyance_reframes (
            couple_id,
            author_id,
            event_id,
            topic_key,
            custom_topic_label,
            is_playful,
            reframe_tone,
            reframe_text,
            include_reframe_with_partner,
            status,
            shared_with_partner,
            challenge_idea,
            challenge_participant,
            challenge_timeframe,
            challenge_reward,
            fallback_reward
        )
        VALUES (
            p_couple_id,
            v_user_id,
            p_event_id,
            p_topic_key,
            v_custom_topic,
            p_is_playful,
            p_reframe_tone,
            p_reframe_text,
            p_include_reframe_with_partner,
            p_status,
            p_shared_with_partner,
            p_challenge_idea,
            p_challenge_participant,
            p_challenge_timeframe,
            p_challenge_reward,
            p_fallback_reward
        )
        RETURNING id INTO v_reframe_id;
    END IF;

    -- Manage private irritation note with preservation
    IF p_clear_private_note THEN
        DELETE FROM public.annoyance_private_notes
        WHERE reframe_id = v_reframe_id AND author_id = v_user_id;
    ELSIF v_private_note IS NOT NULL THEN
        INSERT INTO public.annoyance_private_notes (
            reframe_id,
            author_id,
            private_note,
            updated_at
        )
        VALUES (
            v_reframe_id,
            v_user_id,
            v_private_note,
            now()
        )
        ON CONFLICT (reframe_id, author_id)
        DO UPDATE SET
            private_note = EXCLUDED.private_note,
            updated_at = now();
    END IF;

    RETURN v_reframe_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_annoyance_reframe(uuid, text, text, boolean, text, text, boolean, text, boolean, text, text, text, text, text, uuid, uuid, boolean, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_annoyance_reframe(uuid, text, text, boolean, text, text, boolean, text, boolean, text, text, text, text, text, uuid, uuid, boolean, boolean, text) TO service_role;

-- 2. Secure Outcome Resolution RPC ('completed' or 'not_this_time')
CREATE OR REPLACE FUNCTION public.resolve_challenge_outcome(
    p_reframe_id uuid,
    p_outcome text,
    p_reaction text DEFAULT NULL,
    p_memory_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_reframe record;
    v_trimmed_note text;
    v_clean_reaction text;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_outcome NOT IN ('completed', 'not_this_time') THEN
        RAISE EXCEPTION 'Invalid outcome. Must be completed or not_this_time';
    END IF;

    SELECT * INTO v_reframe
    FROM public.annoyance_reframes
    WHERE id = p_reframe_id;

    IF v_reframe.id IS NULL THEN
        RAISE EXCEPTION 'Challenge invitation not found';
    END IF;

    -- Verify membership in couple
    IF NOT EXISTS (
        SELECT 1 FROM public.couple_members
        WHERE couple_id = v_reframe.couple_id
          AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Forbidden: not a member of this couple';
    END IF;

    -- Must be in accepted ('resolved') state
    IF v_reframe.status <> 'resolved' THEN
        RAISE EXCEPTION 'Challenge must be accepted (status = resolved) before resolving an outcome';
    END IF;

    -- Validate reaction if provided
    IF p_reaction IS NOT NULL THEN
        v_clean_reaction := pg_catalog.btrim(p_reaction);
        IF v_clean_reaction NOT IN (
            'That felt good',
            'We should do this again',
            'It surprised me',
            'A small thing, but meaningful'
        ) THEN
            RAISE EXCEPTION 'Invalid reaction value';
        END IF;
    ELSE
        v_clean_reaction := NULL;
    END IF;

    -- Validate and trim memory note if provided
    IF p_memory_note IS NOT NULL THEN
        v_trimmed_note := pg_catalog.btrim(p_memory_note);
        IF pg_catalog.length(v_trimmed_note) = 0 THEN
            v_trimmed_note := NULL;
        ELSIF pg_catalog.length(v_trimmed_note) > 280 THEN
            RAISE EXCEPTION 'Memory note must not exceed 280 characters';
        END IF;
    ELSE
        v_trimmed_note := NULL;
    END IF;

    IF p_outcome = 'completed' THEN
        -- Mark completion idempotently
        UPDATE public.annoyance_reframes
        SET challenge_outcome = 'completed',
            completed_at = COALESCE(completed_at, pg_catalog.now()),
            completed_by = COALESCE(completed_by, v_user_id),
            outcome_recorded_at = COALESCE(outcome_recorded_at, pg_catalog.now()),
            outcome_recorded_by = COALESCE(outcome_recorded_by, v_user_id),
            updated_at = pg_catalog.now()
        WHERE id = p_reframe_id;

        -- Upsert caller memory reflection if provided
        IF v_clean_reaction IS NOT NULL OR v_trimmed_note IS NOT NULL THEN
            INSERT INTO public.challenge_memories (
                reframe_id, couple_id, user_id, reaction, memory_note, created_at, updated_at
            )
            VALUES (
                p_reframe_id, v_reframe.couple_id, v_user_id, v_clean_reaction, v_trimmed_note, pg_catalog.now(), pg_catalog.now()
            )
            ON CONFLICT (reframe_id, user_id)
            DO UPDATE SET
                reaction = EXCLUDED.reaction,
                memory_note = EXCLUDED.memory_note,
                updated_at = pg_catalog.now();
        END IF;
    ELSIF p_outcome = 'not_this_time' THEN
        -- Mark as not_this_time without setting completed_at (so garden does not bloom, but is not damaged)
        UPDATE public.annoyance_reframes
        SET challenge_outcome = 'not_this_time',
            outcome_recorded_at = COALESCE(outcome_recorded_at, pg_catalog.now()),
            outcome_recorded_by = COALESCE(outcome_recorded_by, v_user_id),
            updated_at = pg_catalog.now()
        WHERE id = p_reframe_id;
    END IF;

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'reframe_id', p_reframe_id,
        'outcome', p_outcome,
        'completed_at', (SELECT completed_at FROM public.annoyance_reframes WHERE id = p_reframe_id)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_challenge_outcome(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_challenge_outcome(uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_challenge_outcome(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_challenge_outcome(uuid, text, text, text) TO service_role;

-- Drop and recreate get_active_partner_annoyance_challenges to allow expanding return columns
DROP FUNCTION IF EXISTS public.get_active_partner_annoyance_challenges(uuid);
CREATE OR REPLACE FUNCTION public.get_active_partner_annoyance_challenges(
    p_couple_id uuid
)
RETURNS TABLE (
    id uuid,
    couple_id uuid,
    author_id uuid,
    event_id uuid,
    topic_key text,
    custom_topic_label text,
    is_playful boolean,
    reframe_tone text,
    reframe_text text,
    include_reframe_with_partner boolean,
    status text,
    shared_with_partner boolean,
    challenge_idea text,
    challenge_participant text,
    challenge_timeframe text,
    challenge_reward text,
    fallback_reward text,
    challenge_outcome text,
    completed_at timestamptz,
    completed_by uuid,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Verify caller is a member of this couple
    IF NOT EXISTS (
        SELECT 1 FROM public.couple_members
        WHERE couple_id = p_couple_id
          AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Forbidden: caller is not a member of this couple';
    END IF;

    RETURN QUERY
    SELECT
        ar.id,
        ar.couple_id,
        ar.author_id,
        ar.event_id,
        ar.topic_key,
        ar.custom_topic_label,
        ar.is_playful,
        ar.reframe_tone,
        CASE
            WHEN ar.include_reframe_with_partner = true THEN ar.reframe_text
            ELSE NULL
        END AS reframe_text,
        ar.include_reframe_with_partner,
        ar.status,
        ar.shared_with_partner,
        ar.challenge_idea,
        ar.challenge_participant,
        ar.challenge_timeframe,
        ar.challenge_reward,
        ar.fallback_reward,
        ar.challenge_outcome,
        ar.completed_at,
        ar.completed_by,
        ar.created_at,
        ar.updated_at
    FROM public.annoyance_reframes ar
    WHERE ar.couple_id = p_couple_id
      AND ar.author_id <> v_user_id
      AND ar.shared_with_partner = true
      AND ar.status IN ('active', 'resolved')
    ORDER BY ar.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_active_partner_annoyance_challenges(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_active_partner_annoyance_challenges(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_active_partner_annoyance_challenges(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_partner_annoyance_challenges(uuid) TO service_role;

COMMIT;
