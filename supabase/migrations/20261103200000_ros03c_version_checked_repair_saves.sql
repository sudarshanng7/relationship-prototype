
-- ROS-03C Finding 2
-- Version-checked personal repair saves.
-- Forward-only migration.
-- Review and test in disposable Supabase before deployment.

BEGIN;

SET LOCAL lock_timeout = '5s';

CREATE FUNCTION private.save_my_repair_state_checked_internal(
    p_event_id uuid,
    p_repair_status text,
    p_what_helped text,
    p_expected_report_version bigint
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user uuid := auth.uid();
    v_event public.relationship_events%ROWTYPE;
    v_method text;
    v_new_version bigint;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Lock the event during access checks and saving.
    SELECT *
    INTO v_event
    FROM public.relationship_events
    WHERE id = p_event_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Moment unavailable';
    END IF;

    -- Check authorization before event-specific errors.
    PERFORM 1
    FROM public.couple_members
    WHERE couple_id = v_event.couple_id
      AND user_id = v_user
    FOR KEY SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Moment unavailable';
    END IF;

    IF v_event.visibility = 'mine'
       AND v_event.creator_id <> v_user THEN
        RAISE EXCEPTION 'Moment unavailable';
    END IF;

    IF v_event.event_type <> 'friction' THEN
        RAISE EXCEPTION
            'Repair state is only available for friction moments';
    END IF;

    IF p_repair_status IS NULL
       OR p_repair_status NOT IN (
           'open', 'partially_repaired', 'reconnected'
       ) THEN
        RAISE EXCEPTION 'Invalid repair status';
    END IF;

    v_method := NULLIF(btrim(p_what_helped), '');

    IF v_method IS NOT NULL
       AND v_method NOT IN (
           'talking', 'space', 'apology', 'affection',
           'humour', 'practical_action', 'time', 'other'
       ) THEN
        RAISE EXCEPTION 'Invalid repair method';
    END IF;

    IF p_repair_status = 'open' THEN
        v_method := NULL;
    END IF;

    IF p_expected_report_version IS NULL THEN

        -- First save: must not replace an existing report.
        INSERT INTO public.event_repair_states (
            event_id,
            user_id,
            repair_status,
            what_helped,
            sharing_status,
            shared_at,
            reported_at,
            status_origin
        )
        VALUES (
            p_event_id,
            v_user,
            p_repair_status,
            v_method,
            'private',
            NULL,
            now(),
            'explicit'
        )
        ON CONFLICT (event_id, user_id) DO NOTHING
        RETURNING report_version INTO v_new_version;

    ELSE

        IF p_expected_report_version < 1 THEN
            RAISE EXCEPTION 'Invalid report version';
        END IF;

        -- Update only the version reviewed by this caller.
        UPDATE public.event_repair_states
        SET
            repair_status = p_repair_status,
            what_helped = v_method,
            sharing_status = 'private',
            shared_at = NULL,
            reported_at = now(),
            status_origin = 'explicit',
            report_version = report_version + 1,
            updated_at = now()
        WHERE event_id = p_event_id
          AND user_id = v_user
          AND report_version = p_expected_report_version
        RETURNING report_version INTO v_new_version;

    END IF;

    IF v_new_version IS NULL THEN
        RAISE EXCEPTION
            'Repair update changed; reload before saving';
    END IF;

    RETURN v_new_version;
END;
$$;

-- New public RPC.
CREATE FUNCTION public.save_my_repair_state_checked(
    p_event_id uuid,
    p_repair_status text,
    p_what_helped text,
    p_expected_report_version bigint
)
RETURNS bigint
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT private.save_my_repair_state_checked_internal(
        p_event_id,
        p_repair_status,
        p_what_helped,
        p_expected_report_version
    );
$$;

-- Explicit permissions for new RPCs.
REVOKE ALL ON FUNCTION
    private.save_my_repair_state_checked_internal(
        uuid, text, text, bigint
    )
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION
    public.save_my_repair_state_checked(
        uuid, text, text, bigint
    )
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
    private.save_my_repair_state_checked_internal(
        uuid, text, text, bigint
    )
TO authenticated;

GRANT EXECUTE ON FUNCTION
    public.save_my_repair_state_checked(
        uuid, text, text, bigint
    )
TO authenticated;

-- Retire old unprotected save entry points.
-- Preserve definitions for migration-history compatibility.
REVOKE ALL ON FUNCTION
    public.save_my_repair_state(uuid, text, text)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION
    private.save_my_repair_state_internal(uuid, text, text)
FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
