
BEGIN;

-- ROS-03: Mine/Ours visibility transition safeguard.

-- Existing event-detail controls still update repair fields.
-- Remove unrestricted client updates first.
REVOKE UPDATE
ON TABLE public.relationship_events
FROM authenticated;

-- Preserve the current creator-owned repair controls.
-- RLS continues to restrict updates to the event creator.
GRANT UPDATE (
    status,
    repair_method,
    reconnected_at
)
ON TABLE public.relationship_events
TO authenticated;

-- Sharing is controlled through a dedicated function.
-- SECURITY DEFINER is necessary because ordinary clients
-- no longer have permission to update visibility/shared_topic.
-- The function must explicitly enforce ownership.

CREATE OR REPLACE FUNCTION public.set_moment_visibility(
    p_event_id uuid,
    p_visibility text,
    p_shared_topic text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_creator_id uuid;
    v_couple_id uuid;
    v_topic text;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_visibility IS NULL
       OR p_visibility NOT IN ('mine', 'ours') THEN
        RAISE EXCEPTION 'Invalid visibility';
    END IF;

    -- Lock the event and verify creator ownership.
    SELECT e.creator_id, e.couple_id
    INTO v_creator_id, v_couple_id
    FROM public.relationship_events e
    WHERE e.id = p_event_id
    FOR UPDATE;

    IF NOT FOUND OR v_creator_id <> v_user_id THEN
        RAISE EXCEPTION 'Event unavailable';
    END IF;

    -- Verify the user still belongs to the same couple.
    IF NOT EXISTS (
        SELECT 1
        FROM public.couple_members cm
        WHERE cm.couple_id = v_couple_id
          AND cm.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Relationship membership required';
    END IF;

    IF p_visibility = 'mine' THEN

        -- Withdrawing access also clears the previously
        -- shared topic. Private reflections are untouched.
        UPDATE public.relationship_events
        SET
            visibility = 'mine',
            shared_topic = NULL
        WHERE id = p_event_id;

    ELSE

        -- Sharing always requires freshly supplied text.
        -- No previously shared topic is automatically reused.
        v_topic := NULLIF(btrim(p_shared_topic), '');

        IF v_topic IS NULL THEN
            RAISE EXCEPTION
                'Please provide a topic to share';
        END IF;

        UPDATE public.relationship_events
        SET
            visibility = 'ours',
            shared_topic = v_topic
        WHERE id = p_event_id;

    END IF;

    RETURN p_event_id;
END;
$$;

-- Definer functions must not be publicly executable.
REVOKE ALL ON FUNCTION public.set_moment_visibility(
    uuid, text, text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.set_moment_visibility(
    uuid, text, text
) FROM anon;

GRANT EXECUTE ON FUNCTION public.set_moment_visibility(
    uuid, text, text
) TO authenticated;

COMMIT;
