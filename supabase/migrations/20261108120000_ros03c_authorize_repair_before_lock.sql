-- PR #7 Finding 9: reject inaccessible parents before acquiring their row locks.
-- Forward-only. Preserve signatures, ACLs, ownership and all repair mutations.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = pg_catalog, public;

DO $preflight$
DECLARE v_fn record; v_signature text;
BEGIN
    -- Exact predecessor bodies intentionally fail closed on unreviewed drift.
    -- CREATE OR REPLACE must replace existing reviewed objects, never create a
    -- missing helper with default execution privileges.
    FOR v_fn IN SELECT * FROM (VALUES
        ('private.save_my_repair_state_checked_internal(uuid,text,text,bigint)', true, 'bigint', 'ed20b3e31ab05fbd5b12545e81b9b23b586a14788a28a996ecd84f0e2b211c68'),
        ('private.share_my_repair_state_internal(uuid,bigint)', true, 'boolean', 'bb0d6a5ab26ffc4e45704bce975f6047ad3ffc6f34cc9b65cb46cb7ac6643dda'),
        ('private.withdraw_my_repair_state_checked_internal(uuid,bigint)', true, 'bigint', 'cfe3c2cde24b2e6dbd0b908979db7a05c0a006b71e85ae45d03aacf1d42b176f'),
        ('public.save_my_repair_state_checked(uuid,text,text,bigint)', false, 'bigint', '1eea3e4b0ce20ab280e5f36f3c306bbcc48685516d700da9548cffd78da897a9'),
        ('public.share_my_repair_state(uuid,bigint)', false, 'boolean', '2f9d5111602368535c1328032ef7e6e055fe20184490478c225be8c68d287ee4'),
        ('public.withdraw_my_repair_state_checked(uuid,bigint)', false, 'bigint', 'c148ba1bd431d2600cd21f757863153b74b768be9f888188186e65825b4b7ccc')
    ) AS f(signature, expected_definer, return_type, body_hash) LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_proc p
            WHERE p.oid = to_regprocedure(v_fn.signature)
              AND pg_get_userbyid(p.proowner) = 'postgres'
              AND p.prosecdef = v_fn.expected_definer
              AND p.proconfig = ARRAY['search_path=""']::text[]
              AND p.prorettype = to_regtype(v_fn.return_type) AND NOT p.proretset
              AND p.provolatile = 'v'
              AND NOT p.proisstrict AND NOT p.proleakproof AND p.proparallel = 'u' AND p.prokind = 'f'
              AND encode(sha256(convert_to(p.prosrc, 'UTF8')), 'hex') = v_fn.body_hash
              AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
              AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
              AND NOT EXISTS (
                  SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                  WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
              )
        ) THEN RAISE EXCEPTION 'Unexpected repair prerequisite definition/owner/configuration/ACL: %', v_fn.signature;
        END IF;
    END LOOP;

    FOREACH v_signature IN ARRAY ARRAY[
        'public.save_my_repair_state(uuid,text,text)',
        'private.save_my_repair_state_internal(uuid,text,text)',
        'public.withdraw_my_repair_state(uuid)',
        'private.withdraw_my_repair_state_internal(uuid)'
    ] LOOP
        IF to_regprocedure(v_signature) IS NULL
           OR has_function_privilege('authenticated', v_signature, 'EXECUTE')
           OR has_function_privilege('anon', v_signature, 'EXECUTE')
           OR EXISTS (
               SELECT 1 FROM pg_catalog.pg_proc p,
                   LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
               WHERE p.oid = to_regprocedure(v_signature)
                 AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'
           ) THEN RAISE EXCEPTION 'Retired repair entry point missing or executable: %', v_signature;
        END IF;
    END LOOP;

    -- Reject extra overloads on the affected/retired entry point names.
    IF EXISTS (
        SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE (n.nspname, p.proname) IN (
            ('public','save_my_repair_state_checked'), ('private','save_my_repair_state_checked_internal'),
            ('public','share_my_repair_state'), ('private','share_my_repair_state_internal'),
            ('public','withdraw_my_repair_state_checked'), ('private','withdraw_my_repair_state_checked_internal'),
            ('public','save_my_repair_state'), ('private','save_my_repair_state_internal'),
            ('public','withdraw_my_repair_state'), ('private','withdraw_my_repair_state_internal')
        ) GROUP BY n.nspname, p.proname HAVING count(*) <> 1
    ) THEN RAISE EXCEPTION 'Unexpected repair function overloads'; END IF;

    IF current_user <> 'postgres'
       OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles
                  WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls))
       OR (SELECT count(*) FROM pg_catalog.pg_class
           WHERE oid IN ('public.relationship_events'::regclass, 'public.event_repair_states'::regclass,
                         'public.couple_members'::regclass)
             AND relrowsecurity) <> 3
       OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_roles r ON r.oid=c.relowner
                  WHERE c.oid IN ('public.relationship_events'::regclass,'public.event_repair_states'::regclass,
                                  'public.couple_members'::regclass)
                    AND r.rolname IN ('anon','authenticated'))
       OR EXISTS (SELECT 1 FROM pg_catalog.pg_policy
                  WHERE polrelid='public.couple_members'::regclass AND polcmd <> 'r')
       OR has_table_privilege('authenticated', 'public.event_repair_states', 'INSERT,UPDATE,DELETE,TRUNCATE')
       OR has_any_column_privilege('authenticated', 'public.event_repair_states', 'INSERT,UPDATE')
       OR has_any_column_privilege('anon', 'public.event_repair_states', 'SELECT,INSERT,UPDATE')
       OR has_table_privilege('anon', 'public.event_repair_states', 'DELETE,TRUNCATE')
       OR has_table_privilege('authenticated', 'public.relationship_events', 'DELETE,TRUNCATE')
       OR to_regprocedure('public.delete_relationship_event(uuid)') IS NULL
       OR to_regprocedure('private.delete_relationship_event_internal(uuid)') IS NULL THEN
        RAISE EXCEPTION 'Unexpected repair RLS/grants or missing Finding 8 deletion fence';
    END IF;
    IF (SELECT count(*) FROM pg_catalog.pg_policy
        WHERE polrelid = 'public.event_repair_states'::regclass) <> 1
       OR NOT EXISTS (
           SELECT 1 FROM pg_catalog.pg_policy p
           WHERE p.polrelid = 'public.event_repair_states'::regclass
             AND p.polname = 'Read authorized individual repair states'
             AND p.polcmd = 'r' AND p.polpermissive AND p.polwithcheck IS NULL
             AND p.polroles = ARRAY[(SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'authenticated')]::oid[]
             AND encode(sha256(convert_to(pg_get_expr(p.polqual,p.polrelid),'UTF8')),'hex') =
                 'afbcc01a21dd252ca3c9b24d8ebce2fe1a8152f87186ea1c5b8de2775e490cda'
       ) THEN RAISE EXCEPTION 'Unexpected independent repair read policy'; END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint c
        WHERE c.conrelid = 'public.couple_members'::regclass AND c.contype = 'p'
          AND c.conkey = ARRAY[
              (SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid = c.conrelid AND attname = 'couple_id'),
              (SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid = c.conrelid AND attname = 'user_id')
          ]::smallint[]
    ) OR NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint c
        WHERE c.conrelid = 'public.couple_members'::regclass AND c.contype = 'u'
          AND c.conkey = ARRAY[
              (SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid = c.conrelid AND attname = 'user_id')
          ]::smallint[]
    ) OR NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint c
        WHERE c.conrelid = 'public.event_repair_states'::regclass AND c.contype = 'p'
          AND c.conkey = ARRAY[
              (SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid = c.conrelid AND attname = 'event_id'),
              (SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid = c.conrelid AND attname = 'user_id')
          ]::smallint[]
    ) THEN RAISE EXCEPTION 'Unexpected membership or repair identity keys'; END IF;
END;
$preflight$;

-- Membership EXISTS and own-report EXISTS below are nonlocking snapshot filters.
-- The locked current parent and the subsequent membership KEY SHARE recheck
-- remain authoritative. Mutation/version blocks are unchanged from predecessors.
CREATE OR REPLACE FUNCTION private.save_my_repair_state_checked_internal(
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
    SELECT e.*
    INTO v_event
    FROM public.relationship_events e
    WHERE e.id = p_event_id
      AND (e.visibility = 'ours' OR e.creator_id = v_user)
      AND EXISTS (
          SELECT 1 FROM public.couple_members cm
          WHERE cm.couple_id = e.couple_id AND cm.user_id = v_user
      )
    FOR SHARE OF e;

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
    SELECT e.couple_id, e.event_type, e.visibility
    INTO v_couple, v_type, v_visibility
    FROM public.relationship_events e
    WHERE e.id = p_event_id
      AND e.visibility = 'ours' AND e.event_type = 'friction'
      AND EXISTS (
          SELECT 1 FROM public.couple_members cm
          WHERE cm.couple_id = e.couple_id AND cm.user_id = v_user
      )
    FOR SHARE OF e;
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

CREATE OR REPLACE FUNCTION private.withdraw_my_repair_state_checked_internal(
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
    SELECT e.couple_id, e.creator_id, e.visibility
    INTO v_couple, v_creator, v_visibility
    FROM public.relationship_events e
    WHERE e.id = p_event_id
      AND EXISTS (
          SELECT 1 FROM public.couple_members cm
          WHERE cm.couple_id = e.couple_id AND cm.user_id = v_user
      )
      AND (
          e.visibility = 'ours' OR e.creator_id = v_user
          OR EXISTS (
              SELECT 1 FROM public.event_repair_states rs
              WHERE rs.event_id = e.id AND rs.user_id = v_user
          )
      )
    FOR SHARE OF e;
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

-- CREATE OR REPLACE preserves owners/ACLs. No grants, public wrappers, legacy
-- routines, tables, policies, triggers, deletion behavior or existing rows change.
NOTIFY pgrst, 'reload schema';
COMMIT;
