-- ROS-03C / 01 — ADDITIVE INDIVIDUAL REPAIR STATES (LOCAL MIGRATION CANDIDATE)
-- Expected predecessor: 20261020180334_restrict_private_reflection_mutations
-- Scope: local Supabase first. DO NOT apply to linked/hosted databases.
-- Review and confirm the local schema and migration history before applying.
-- This stage does NOT provide complete private-by-default behavior: legacy
-- relationship_events.status/repair_method/reconnected_at remain readable.
-- Application migration and cutover must follow in a separate stage.

BEGIN;

-- Fail early if ROS-03C has already been partially installed.
DO $ros03c_preflight$
BEGIN
    IF to_regclass('public.relationship_events') IS NULL
       OR to_regclass('public.couple_members') IS NULL
       OR to_regclass('public.event_perspectives') IS NULL
       OR to_regclass('public.event_private_reflections') IS NULL
    THEN
        RAISE EXCEPTION 'Expected ROS-03B tables are missing';
    END IF;
    IF to_regclass('public.event_repair_states') IS NOT NULL
       OR to_regclass('private.ros03c_legacy_repair_snapshot') IS NOT NULL
    THEN
        RAISE EXCEPTION 'ROS-03C additive schema already exists or is partial';
    END IF;
END;
$ros03c_preflight$;


-- One CURRENT report per participating user and friction moment.
-- A missing row means no explicit report (or no import), not 'open'.
CREATE TABLE public.event_repair_states (
    event_id uuid NOT NULL REFERENCES public.relationship_events(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    repair_status text NOT NULL
        CHECK (repair_status IN ('open', 'partially_repaired', 'reconnected')),
    what_helped text NULL
        CHECK (what_helped IS NULL OR what_helped IN (
            'talking', 'space', 'apology', 'affection',
            'humour', 'practical_action', 'time', 'other'
        )),
    sharing_status text NOT NULL DEFAULT 'private'
        CHECK (sharing_status IN ('private', 'shared')),
    shared_at timestamptz NULL,
    -- This is the timestamp of a known explicit user report where known.
    -- Legacy non-reconnected reports have unknown original report time.
    reported_at timestamptz NULL,
    -- Once edited, status_origin becomes 'explicit'. This is NOT an audit log.
    status_origin text NOT NULL DEFAULT 'explicit'
        CHECK (status_origin IN (
            'explicit', 'legacy_creator_report', 'legacy_default_unconfirmed'
        )),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    -- Optimistic concurrency token: share only the report version just reviewed.
    report_version bigint NOT NULL DEFAULT 1 CHECK (report_version >= 1),
    PRIMARY KEY (event_id, user_id),
    CONSTRAINT share_requires_explicit_report
      CHECK (sharing_status <> 'shared' OR status_origin = 'explicit'),
    CONSTRAINT shared_at_consistent
      CHECK ((sharing_status = 'shared') = (shared_at IS NOT NULL))
);

CREATE INDEX event_repair_states_by_user
ON public.event_repair_states (user_id, event_id);

ALTER TABLE public.event_repair_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_repair_states FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.event_repair_states TO authenticated;
-- No direct INSERT/UPDATE/DELETE for authenticated. All writes use guarded RPCs.

-- Reuse the ROS-03B principle: an author can still see their OWN previously
-- submitted record if the other person moved its event from Ours to Mine,
-- provided the author remains a member. The event itself remains unavailable.
-- The extra repair-row condition prevents this helper becoming a general
-- existence oracle for otherwise hidden Mine events.
CREATE FUNCTION private.can_read_own_event_repair(p_event_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.event_repair_states rs
        JOIN public.relationship_events e ON e.id = rs.event_id
        JOIN public.couple_members cm ON cm.couple_id = e.couple_id
        WHERE rs.event_id = p_event_id
          AND rs.user_id = (SELECT auth.uid())
          AND cm.user_id = (SELECT auth.uid())
    );
$$;
REVOKE ALL ON FUNCTION private.can_read_own_event_repair(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_read_own_event_repair(uuid)
TO authenticated;

CREATE POLICY "Read authorized individual repair states"
ON public.event_repair_states FOR SELECT TO authenticated
USING (
    (
        user_id = (SELECT auth.uid())
        AND private.can_read_own_event_repair(event_id)
    )
    OR
    (
        sharing_status = 'shared'
        AND status_origin = 'explicit'
        AND EXISTS (
            SELECT 1
            FROM public.relationship_events e
            JOIN public.couple_members cm ON cm.couple_id = e.couple_id
            WHERE e.id = event_id
              AND e.visibility = 'ours'
              AND cm.user_id = (SELECT auth.uid())
        )
    )
);

-- Private schema is intentionally NOT exposed by PostgREST.
-- Public RPC wrappers are SECURITY INVOKER and delegate to explicitly checked
-- private helpers. Direct callers never receive table mutation grants.

CREATE FUNCTION private.save_my_repair_state_internal(
    p_event_id uuid,
    p_repair_status text,
    p_what_helped text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_user uuid := auth.uid();
    v_event public.relationship_events%ROWTYPE;
    v_method text := NULLIF(btrim(p_what_helped), '');
BEGIN
    IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    IF p_repair_status IS NULL OR p_repair_status NOT IN
       ('open','partially_repaired','reconnected') THEN
        RAISE EXCEPTION 'Invalid repair status';
    END IF;
    IF v_method IS NOT NULL AND v_method NOT IN (
        'talking','space','apology','affection',
        'humour','practical_action','time','other'
    ) THEN
        RAISE EXCEPTION 'Invalid repair method';
    END IF;
    IF p_repair_status = 'open' THEN v_method := NULL; END IF;

    -- Lock event against concurrent Mine/Ours transitions.
    SELECT * INTO v_event
    FROM public.relationship_events
    WHERE id = p_event_id
    FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Moment unavailable'; END IF;
    IF v_event.event_type <> 'friction' THEN
        RAISE EXCEPTION 'Repair state is only available for friction moments';
    END IF;

    -- Lock active membership against concurrent DELETE/revocation.
    PERFORM 1 FROM public.couple_members
    WHERE couple_id = v_event.couple_id AND user_id = v_user
    FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Moment unavailable'; END IF;
    IF v_event.visibility = 'mine' AND v_event.creator_id <> v_user THEN
        RAISE EXCEPTION 'Moment unavailable';
    END IF;

    -- Saving ALWAYS returns state to private (explicit re-share required).
    INSERT INTO public.event_repair_states AS existing
        (event_id, user_id, repair_status, what_helped,
         sharing_status, shared_at, reported_at, status_origin)
    VALUES (p_event_id, v_user, p_repair_status, v_method,
            'private', NULL, now(), 'explicit')
    ON CONFLICT (event_id, user_id) DO UPDATE SET
        repair_status = EXCLUDED.repair_status,
        what_helped = EXCLUDED.what_helped,
        sharing_status = 'private',
        shared_at = NULL,
        reported_at = now(),
        status_origin = 'explicit',
        report_version = existing.report_version + 1,
        updated_at = now();

    RETURN p_event_id;
END;
$$;
REVOKE ALL ON FUNCTION private.save_my_repair_state_internal(uuid,text,text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.save_my_repair_state_internal(uuid,text,text)
TO authenticated;

CREATE FUNCTION public.save_my_repair_state(
    p_event_id uuid, p_repair_status text, p_what_helped text DEFAULT NULL
) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$
    SELECT private.save_my_repair_state_internal(
        p_event_id, p_repair_status, p_what_helped
    );
$$;
REVOKE ALL ON FUNCTION public.save_my_repair_state(uuid,text,text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_my_repair_state(uuid,text,text)
TO authenticated;

CREATE FUNCTION private.share_my_repair_state_internal(
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
    IF p_expected_report_version IS NULL OR p_expected_report_version < 1 THEN
        RAISE EXCEPTION 'Please reload your repair update before sharing';
    END IF;
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
REVOKE ALL ON FUNCTION private.share_my_repair_state_internal(uuid,bigint)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.share_my_repair_state_internal(uuid,bigint)
TO authenticated;

CREATE FUNCTION public.share_my_repair_state(
    p_event_id uuid, p_expected_report_version bigint
) RETURNS boolean
LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$
    SELECT private.share_my_repair_state_internal(
        p_event_id, p_expected_report_version
    );
$$;
REVOKE ALL ON FUNCTION public.share_my_repair_state(uuid,bigint)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.share_my_repair_state(uuid,bigint)
TO authenticated;

CREATE FUNCTION private.withdraw_my_repair_state_internal(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_user uuid := auth.uid();
    v_couple uuid;
    v_rows integer;
BEGIN
    IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    -- Withdrawal is allowed even if the other partner moved Ours -> Mine.
    -- Only the caller's OWN row is touched and membership is still required.
    SELECT couple_id INTO v_couple
    FROM public.relationship_events
    WHERE id = p_event_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Moment unavailable'; END IF;
    PERFORM 1 FROM public.couple_members
    WHERE couple_id = v_couple AND user_id = v_user FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Moment unavailable'; END IF;

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
REVOKE ALL ON FUNCTION private.withdraw_my_repair_state_internal(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.withdraw_my_repair_state_internal(uuid)
TO authenticated;

CREATE FUNCTION public.withdraw_my_repair_state(p_event_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT private.withdraw_my_repair_state_internal(p_event_id); $$;
REVOKE ALL ON FUNCTION public.withdraw_my_repair_state(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_my_repair_state(uuid)
TO authenticated;

-- Existing set_moment_visibility() changes the parent event. This trigger
-- atomically withdraws shared repair updates when it moves to Mine.
CREATE FUNCTION private.suspend_shared_repair_states()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    IF OLD.visibility = 'ours' AND NEW.visibility = 'mine' THEN
        UPDATE public.event_repair_states
        SET sharing_status = 'private',
            shared_at = NULL,
            updated_at = now(),
            report_version = report_version + 1
        WHERE event_id = NEW.id AND sharing_status = 'shared';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.suspend_shared_repair_states()
FROM PUBLIC, anon;
CREATE TRIGGER suspend_repair_shares_when_event_mine
AFTER UPDATE OF visibility ON public.relationship_events
FOR EACH ROW EXECUTE FUNCTION private.suspend_shared_repair_states();

-- Snapshot legacy source values at the additive stage. Without this, a
-- subsequent old-client change to relationship_events.status could be silently
-- lost at cutover. This table is PRIVATE and temporary until cutover.
CREATE TABLE private.ros03c_legacy_repair_snapshot (
    event_id uuid PRIMARY KEY REFERENCES public.relationship_events(id) ON DELETE CASCADE,
    repair_status text,
    what_helped text,
    reconnected_at timestamptz
);
REVOKE ALL ON private.ros03c_legacy_repair_snapshot FROM PUBLIC, anon, authenticated;
INSERT INTO private.ros03c_legacy_repair_snapshot (
    event_id, repair_status, what_helped, reconnected_at
)
SELECT id, status, repair_method, reconnected_at
FROM public.relationship_events
WHERE event_type = 'friction' AND status IS NOT NULL;

-- Legacy backfill: no auto-sharing; preserve known status and method.
-- Every legacy Open is flagged as unconfirmed, because creation of a
-- friction event automatically populated relationship_events.status='open'.
-- No false 'user reported unresolved' claim is made in the new UI.
INSERT INTO public.event_repair_states (
    event_id, user_id, repair_status, what_helped, sharing_status,
    reported_at, status_origin
)
SELECT
    e.id, e.creator_id, e.status, e.repair_method, 'private',
    CASE WHEN e.status = 'reconnected' THEN e.reconnected_at ELSE NULL END,
    CASE WHEN e.status = 'open'
        THEN 'legacy_default_unconfirmed'
        ELSE 'legacy_creator_report'
    END
FROM public.relationship_events e
WHERE e.event_type = 'friction' AND e.status IS NOT NULL;

-- Cutover stage must handle all event-row legacy fields separately.
-- DO NOT permit old-client legacy repair writes during the planned cutover.
-- Draft 02 checks the snapshot and aborts if pre-existing rows changed.
COMMIT;
