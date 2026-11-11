-- ROS-03C Finding 4: bind withdrawal to the author's reviewed report version.
-- Forward-only. Apply only after review and separately authorized validation.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $preflight$
BEGIN
    IF to_regprocedure('private.save_my_repair_state_checked_internal(uuid,text,text,bigint)') IS NULL
       OR to_regprocedure('private.share_my_repair_state_internal(uuid,bigint)') IS NULL
       OR to_regprocedure('public.withdraw_my_repair_state(uuid)') IS NULL
       OR to_regprocedure('private.withdraw_my_repair_state_internal(uuid)') IS NULL
       OR to_regprocedure('private.suspend_shared_repair_states()') IS NULL THEN
        RAISE EXCEPTION 'Expected ROS-03C checked-save and Finding 3 helpers are missing';
    END IF;
END;
$preflight$;

CREATE FUNCTION private.withdraw_my_repair_state_checked_internal(
    p_event_id uuid, p_expected_report_version bigint
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_user uuid := auth.uid();
    v_couple uuid;
    v_creator uuid;
    v_visibility text;
    v_new_version bigint;
BEGIN
    IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    -- Preserve the event -> membership -> report lock order and Finding 3's
    -- author-owned suspended-report exception; the hidden parent stays hidden.
    SELECT couple_id, creator_id, visibility
    INTO v_couple, v_creator, v_visibility
    FROM public.relationship_events
    WHERE id = p_event_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Moment unavailable'; END IF;
    PERFORM 1 FROM public.couple_members
    WHERE couple_id = v_couple AND user_id = v_user FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Moment unavailable'; END IF;

    IF v_visibility = 'mine' AND v_creator <> v_user
       AND NOT EXISTS (
           SELECT 1 FROM public.event_repair_states
           WHERE event_id = p_event_id AND user_id = v_user
       ) THEN
        RAISE EXCEPTION 'Moment unavailable';
    END IF;

    -- Input errors must not distinguish hidden moments from missing moments.
    IF p_expected_report_version IS NULL OR p_expected_report_version < 1 THEN
        RAISE EXCEPTION 'Please reload your repair update before withdrawing';
    END IF;

    -- Even an already-private report consumes its reviewed version: an explicit
    -- withdrawal invalidates pending shares of THAT version, never a newer one.
    -- Do not alter content, reported_at, created_at or legacy provenance.
    UPDATE public.event_repair_states
    SET sharing_status = 'private',
        shared_at = NULL,
        updated_at = now(),
        report_version = report_version + 1
    WHERE event_id = p_event_id
      AND user_id = v_user
      AND report_version = p_expected_report_version
    RETURNING report_version INTO v_new_version;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Repair update changed; reload before withdrawing';
    END IF;
    RETURN v_new_version;
END;
$$;

CREATE FUNCTION public.withdraw_my_repair_state_checked(
    p_event_id uuid, p_expected_report_version bigint
)
RETURNS bigint
LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$
    SELECT private.withdraw_my_repair_state_checked_internal(
        p_event_id, p_expected_report_version
    );
$$;

REVOKE ALL ON FUNCTION private.withdraw_my_repair_state_checked_internal(uuid,bigint)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.withdraw_my_repair_state_checked(uuid,bigint)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.withdraw_my_repair_state_checked_internal(uuid,bigint)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_my_repair_state_checked(uuid,bigint)
TO authenticated;

-- Retain historical definitions, but close BOTH unchecked client entry points.
REVOKE ALL ON FUNCTION public.withdraw_my_repair_state(uuid)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.withdraw_my_repair_state_internal(uuid)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.suspend_shared_repair_states()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    IF OLD.visibility = 'ours' AND NEW.visibility = 'mine' THEN
        -- Invalidate pending shares even for reports that were already private.
        UPDATE public.event_repair_states
        SET sharing_status = 'private',
            shared_at = NULL,
            updated_at = now(),
            report_version = report_version + 1
        WHERE event_id = NEW.id;
    END IF;
    -- Returning to Ours never shares a report or restores an old share token.
    RETURN NEW;
END;
$$;

-- Existing trigger wiring, owners/ACLs, RLS and direct table grants stay intact.
NOTIFY pgrst, 'reload schema';
COMMIT;
