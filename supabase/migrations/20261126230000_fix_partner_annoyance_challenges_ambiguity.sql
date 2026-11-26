-- Migration: fix ambiguous couple_id in get_active_partner_annoyance_challenges
-- Description: Explicitly qualify couple_members.couple_id to avoid PL/pgSQL variable ambiguity

BEGIN;

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

    -- Verify caller is a member of this couple by explicitly qualifying table columns
    IF NOT EXISTS (
        SELECT 1 FROM public.couple_members cm
        WHERE cm.couple_id = p_couple_id
          AND cm.user_id = v_user_id
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
