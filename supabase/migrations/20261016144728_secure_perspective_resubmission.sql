
BEGIN;

-- ROS-03B: Deliberate perspective submission and resubmission.
-- No direct client INSERT or UPDATE is permitted.

REVOKE INSERT, UPDATE
ON TABLE public.event_perspectives
FROM authenticated;

-- Restrict withdrawal to current couple members.
DROP POLICY IF EXISTS "Withdraw own perspective"
ON public.event_perspectives;

CREATE POLICY "Withdraw own perspective"
ON public.event_perspectives
FOR DELETE TO authenticated
USING (
    author_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.relationship_events e
        JOIN public.couple_members cm
          ON cm.couple_id = e.couple_id
        WHERE e.id = event_id
          AND cm.user_id = (SELECT auth.uid())
    )
);

CREATE FUNCTION public.submit_event_perspective(
    p_event_id uuid,
    p_perspective_text text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_event_couple_id uuid;
    v_visibility text;
    v_text text;
    v_perspective_id uuid;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    v_text := NULLIF(btrim(p_perspective_text), '');

    IF v_text IS NULL THEN
        RAISE EXCEPTION 'Perspective text is required';
    END IF;

    -- Lock the parent event to serialize submission
    -- against Mine/Ours visibility transitions.
    SELECT e.couple_id, e.visibility
    INTO v_event_couple_id, v_visibility
    FROM public.relationship_events e
    WHERE e.id = p_event_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event unavailable';
    END IF;

    IF v_visibility <> 'ours' THEN
        RAISE EXCEPTION 'Event is not shared';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.couple_members cm
        WHERE cm.couple_id = v_event_couple_id
          AND cm.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Relationship membership required';
    END IF;

    -- Insert or explicitly replace the CURRENT USER's
    -- perspective with newly supplied text.
    -- This never copies an old suspended perspective.
    INSERT INTO public.event_perspectives (
        event_id,
        author_id,
        perspective_text,
        sharing_status
    )
    VALUES (
        p_event_id,
        v_user_id,
        v_text,
        'submitted'
    )
    ON CONFLICT (event_id, author_id)
    DO UPDATE SET
        perspective_text = EXCLUDED.perspective_text,
        sharing_status = 'submitted',
        updated_at = now()
    RETURNING id INTO v_perspective_id;

    RETURN v_perspective_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_event_perspective(
    uuid, text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.submit_event_perspective(
    uuid, text
) FROM anon;

GRANT EXECUTE ON FUNCTION public.submit_event_perspective(
    uuid, text
) TO authenticated;

COMMIT;
