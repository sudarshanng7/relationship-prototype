
-- ROS-03A: Save an event and its private reflection atomically.

CREATE OR REPLACE FUNCTION public.create_relationship_moment(
    p_couple_id uuid,
    p_event_type text,
    p_category text,
    p_intensity smallint,
    p_visibility text,
    p_private_note text DEFAULT NULL,
    p_shared_topic text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_event_id uuid;
    v_private_note text;
    v_shared_topic text;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_visibility NOT IN ('mine', 'ours')
       OR p_visibility IS NULL THEN
        RAISE EXCEPTION 'Invalid visibility';
    END IF;

    IF p_event_type NOT IN ('positive', 'friction')
       OR p_event_type IS NULL THEN
        RAISE EXCEPTION 'Invalid event type';
    END IF;

    IF p_category IS NULL OR trim(p_category) = '' THEN
        RAISE EXCEPTION 'Category is required';
    END IF;

    IF p_event_type = 'friction'
       AND (p_intensity IS NULL OR p_intensity NOT BETWEEN 1 AND 5)
    THEN
        RAISE EXCEPTION 'Friction intensity must be between 1 and 5';
    END IF;

    v_private_note := NULLIF(trim(p_private_note), '');
    v_shared_topic := NULLIF(trim(p_shared_topic), '');

    IF p_visibility = 'mine' AND v_shared_topic IS NOT NULL THEN
        RAISE EXCEPTION 'Private moments cannot contain shared topics';
    END IF;

    -- The existing INSERT RLS policy verifies couple membership.
    INSERT INTO public.relationship_events (
        couple_id,
        creator_id,
        event_type,
        category,
        intensity,
        visibility,
        status,
        shared_topic
    )
    VALUES (
        p_couple_id,
        v_user_id,
        p_event_type,
        trim(p_category),
        CASE
            WHEN p_event_type = 'friction' THEN p_intensity
            ELSE NULL
        END,
        p_visibility,
        CASE
            WHEN p_event_type = 'friction' THEN 'open'
            ELSE NULL
        END,
        v_shared_topic
    )
    RETURNING id INTO v_event_id;

    -- The reflection INSERT is also checked by its own RLS policy.
    IF v_private_note IS NOT NULL THEN
        INSERT INTO public.event_private_reflections (
            event_id,
            author_id,
            note
        )
        VALUES (
            v_event_id,
            v_user_id,
            v_private_note
        );
    END IF;

    RETURN v_event_id;
END;
$$;

-- PostgreSQL functions otherwise receive default PUBLIC EXECUTE.
REVOKE ALL ON FUNCTION public.create_relationship_moment(
    uuid, text, text, smallint, text, text, text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.create_relationship_moment(
    uuid, text, text, smallint, text, text, text
) FROM anon;

GRANT EXECUTE ON FUNCTION public.create_relationship_moment(
    uuid, text, text, smallint, text, text, text
) TO authenticated;
