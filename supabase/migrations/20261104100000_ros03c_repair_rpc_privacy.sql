-- ROS-03C Finding 3: close the hidden-moment withdrawal existence oracle.
-- Forward-only; requires the checked-save migration. Review before deployment.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- Fail closed on a missing prerequisite rather than create new helpers with
-- default privileges. CREATE OR REPLACE preserves existing owners and ACLs.
DO $preflight$
BEGIN
    IF to_regprocedure('private.save_my_repair_state_checked_internal(uuid,text,text,bigint)') IS NULL
       OR to_regprocedure('private.share_my_repair_state_internal(uuid,bigint)') IS NULL
       OR to_regprocedure('private.withdraw_my_repair_state_internal(uuid)') IS NULL THEN
        RAISE EXCEPTION 'Expected ROS-03C checked-save and repair helpers are missing';
    END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION private.share_my_repair_state_internal(
    p_event_id uuid, p_expected_report_version bigint
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_user uuid := auth.uid();
    v_couple uuid;
    v_type text;
    v_visibility text;
BEGIN
    IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    SELECT couple_id, event_type, visibility
    INTO v_couple, v_type, v_visibility
    FROM public.relationship_events
    WHERE id = p_event_id
    FOR SHARE;
    IF NOT FOUND OR v_type <> 'friction' OR v_visibility <> 'ours' THEN
        RAISE EXCEPTION 'Moment unavailable for sharing';
    END IF;
    PERFORM 1 FROM public.couple_members
    WHERE couple_id = v_couple AND user_id = v_user
    FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Moment unavailable for sharing'; END IF;

    -- Validate caller input only after the moment is authorized for sharing.
    IF p_expected_report_version IS NULL OR p_expected_report_version < 1 THEN
        RAISE EXCEPTION 'Please reload your repair update before sharing';
    END IF;

    -- Imported legacy states require a deliberate save/confirmation first.
    UPDATE public.event_repair_states
    SET sharing_status = 'shared',
        shared_at = now(),
        updated_at = now(),
        report_version = report_version + 1
    WHERE event_id = p_event_id
      AND user_id = v_user
      AND status_origin = 'explicit'
      AND sharing_status = 'private'
      AND report_version = p_expected_report_version;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Repair update changed, was already shared, or needs confirmation; please reload';
    END IF;
    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION private.withdraw_my_repair_state_internal(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_user uuid := auth.uid();
    v_couple uuid;
    v_creator uuid;
    v_visibility text;
    v_rows integer;
BEGIN
    IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    -- Withdrawal is allowed even if the other partner moved Ours -> Mine.
    -- Only the caller's OWN row is touched and membership is still required.
    SELECT couple_id, creator_id, visibility
    INTO v_couple, v_creator, v_visibility
    FROM public.relationship_events
    WHERE id = p_event_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Moment unavailable'; END IF;
    PERFORM 1 FROM public.couple_members
    WHERE couple_id = v_couple AND user_id = v_user FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Moment unavailable'; END IF;

    -- A hidden Mine moment must not be distinguishable from a missing one.
    -- Preserve withdrawal of an author's own suspended report, which remains
    -- readable under the existing current-member own-report RLS exception.
    IF v_visibility = 'mine' AND v_creator <> v_user
       AND NOT EXISTS (
           SELECT 1
           FROM public.event_repair_states
           WHERE event_id = p_event_id AND user_id = v_user
       ) THEN
        RAISE EXCEPTION 'Moment unavailable';
    END IF;

    UPDATE public.event_repair_states
    SET sharing_status = 'private',
        shared_at = NULL,
        updated_at = now(),
        report_version = report_version + 1
    WHERE event_id = p_event_id
      AND user_id = v_user
      AND sharing_status = 'shared';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows > 0;
END;
$$;

-- No wrapper, table grant, RLS, trigger, or checked-save changes.
NOTIFY pgrst, 'reload schema';
COMMIT;
