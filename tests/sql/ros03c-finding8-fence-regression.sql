-- PREPARED ONLY: NOT EXECUTED. Requires separate approval and a positively
-- verified NEW EMPTY disposable PostgreSQL target; never use a development DB.
-- Apply all migrations through 20261106160000 separately before this suite.
-- psql -X -v finding8_fence_disposable_authorized=1 -v expected_system_identifier=...
--      --host <verified loopback host> --port <verified port> -f this-file
-- Flags/loopback/emptiness are safeguards, not proof of runtime/storage isolation.
-- SQL models return=minimal shapes; it does NOT verify live HTTP/PostgREST.
-- Final-schema RPC suite. The policy-only Finding 8 suite is historical.
-- Real concurrent commit orders are prepared in ros03c-finding8-fence-concurrency.py.
\set ON_ERROR_STOP on
\if :{?finding8_fence_disposable_authorized}
\else
\echo 'Separate fresh-disposable-target authorization is required.'
\quit 3
\endif
\if :finding8_fence_disposable_authorized
\else
\quit 3
\endif
\if :{?expected_system_identifier}
\else
\echo 'A separately verified PostgreSQL system identifier is required.'
\quit 3
\endif
SELECT system_identifier::text = :'expected_system_identifier' AS target_matches
FROM pg_control_system() \gset
\if :target_matches
\else
\echo 'Unexpected PostgreSQL target.'
\quit 3
\endif

BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL row_security = on;
DO $preflight$
DECLARE v_table text; v_nonempty boolean;
BEGIN
    IF current_user <> 'postgres' OR NOT EXISTS (
        SELECT 1 FROM supabase_migrations.schema_migrations
        WHERE version = '20261106160000'
    ) THEN
        RAISE EXCEPTION 'Expected postgres and separately applied Finding 8 deletion fence migration';
    END IF;
    FOREACH v_table IN ARRAY ARRAY[
        'auth.users', 'public.profiles', 'public.couples', 'public.couple_members',
        'public.couple_invites', 'public.relationship_events',
        'public.event_private_reflections', 'public.event_perspectives',
        'public.event_repair_states', 'private.ros03c_legacy_repair_snapshot'
    ] LOOP
        EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s)', v_table) INTO v_nonempty;
        IF v_nonempty THEN
            RAISE EXCEPTION 'Requires a NEW EMPTY disposable target; % is nonempty', v_table;
        END IF;
    END LOOP;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class
        WHERE oid = 'public.relationship_events'::regclass AND relrowsecurity
    ) OR EXISTS (
        SELECT 1 FROM pg_catalog.pg_roles
        WHERE rolname IN ('authenticated', 'anon') AND (rolsuper OR rolbypassrls)
    ) OR has_table_privilege('authenticated', 'public.relationship_events', 'DELETE')
      OR has_table_privilege('anon', 'public.relationship_events', 'DELETE') THEN
        RAISE EXCEPTION 'Unexpected RLS/client deletion privileges';
    END IF;
    IF (SELECT count(*) FROM pg_catalog.pg_policy
        WHERE polrelid = 'public.relationship_events'::regclass
          AND polcmd IN ('d', '*')) <> 1
       OR NOT EXISTS (
           SELECT 1 FROM pg_catalog.pg_policy
           WHERE polrelid = 'public.relationship_events'::regclass
             AND polname = 'Creators can delete their events'
             AND polcmd = 'd' AND polpermissive
             AND polroles = ARRAY[
                 (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'authenticated')
             ]::oid[]
       ) THEN
        RAISE EXCEPTION 'Unexpected competing DELETE/ALL policies';
    END IF;
    IF (SELECT count(*) FROM pg_catalog.pg_constraint
        WHERE contype = 'f' AND confrelid = 'public.relationship_events'::regclass) <> 4
       OR (SELECT count(*) FROM pg_catalog.pg_constraint c
           JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND c.conkey = ARRAY[a.attnum]
           JOIN pg_catalog.pg_attribute p ON p.attrelid = c.confrelid AND c.confkey = ARRAY[p.attnum]
           WHERE c.contype = 'f' AND c.confrelid = 'public.relationship_events'::regclass
             AND c.confdeltype = 'c' AND c.convalidated
             AND a.attname = 'event_id' AND p.attname = 'id'
             AND c.conrelid IN (
                 'public.event_private_reflections'::regclass, 'public.event_perspectives'::regclass,
                 'public.event_repair_states'::regclass, 'private.ros03c_legacy_repair_snapshot'::regclass
             )) <> 4 THEN
        RAISE EXCEPTION 'Expected four event_id cascading foreign keys';
    END IF;
END;
$preflight$;

SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);
CREATE TEMP TABLE f8f_ids(name text PRIMARY KEY, id uuid NOT NULL DEFAULT gen_random_uuid());
INSERT INTO pg_temp.f8f_ids(name) VALUES
    ('a'), ('b'), ('c'), ('d'), ('couple'), ('foreign_couple'), ('replacement_couple'),
    ('a_ours'), ('a_mine'), ('a_positive'), ('b_ours'), ('b_mine'), ('c_ours'), ('c_mine'),
    ('a_former_ours'), ('a_former_mine'), ('a_new'), ('missing');
GRANT SELECT ON pg_temp.f8f_ids TO authenticated, anon;
CREATE FUNCTION pg_temp.f8f_id(p_name text) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
    SELECT id FROM pg_temp.f8f_ids WHERE name = p_name;
$$;

INSERT INTO auth.users(id) SELECT id FROM pg_temp.f8f_ids WHERE name IN ('a', 'b', 'c', 'd');
-- Existing creator trigger supplies A/C memberships; uniqueness permits one couple/user.
INSERT INTO public.couples(id, created_by) VALUES
    (pg_temp.f8f_id('couple'), pg_temp.f8f_id('a')),
    (pg_temp.f8f_id('foreign_couple'), pg_temp.f8f_id('c'));
INSERT INTO public.couple_members(couple_id, user_id) VALUES
    (pg_temp.f8f_id('couple'), pg_temp.f8f_id('b')),
    (pg_temp.f8f_id('foreign_couple'), pg_temp.f8f_id('d'));
-- a_former_* models A-owned events left in a different/former couple. Owner
-- fixture creation intentionally models history; it grants no client rights.
INSERT INTO public.relationship_events(
    id, couple_id, creator_id, event_type, category, intensity, visibility, shared_topic
)
SELECT id,
    pg_temp.f8f_id(CASE WHEN name LIKE 'c_%' OR name LIKE 'a_former_%'
                      THEN 'foreign_couple' ELSE 'couple' END),
    pg_temp.f8f_id(CASE WHEN name LIKE 'b_%' THEN 'b' WHEN name LIKE 'c_%' THEN 'c' ELSE 'a' END),
    CASE WHEN name = 'a_positive' THEN 'positive' ELSE 'friction' END,
    'finding8-synthetic', CASE WHEN name = 'a_positive' THEN NULL ELSE 3 END,
    CASE WHEN name LIKE '%mine' THEN 'mine' ELSE 'ours' END,
    CASE WHEN name LIKE '%mine' THEN NULL ELSE 'Synthetic shared topic' END
FROM pg_temp.f8f_ids
WHERE name IN ('a_ours', 'a_mine', 'a_positive', 'b_ours', 'b_mine', 'c_ours', 'c_mine',
               'a_former_ours', 'a_former_mine');
INSERT INTO public.event_private_reflections(event_id, author_id, note)
SELECT id, creator_id, 'Synthetic creator-only reflection' FROM public.relationship_events;
INSERT INTO public.event_perspectives(event_id, author_id, perspective_text, sharing_status)
SELECT e.id, contributor.author_id, 'Synthetic independent perspective',
    CASE WHEN e.visibility = 'ours' THEN 'submitted' ELSE 'suspended' END
FROM public.relationship_events e
JOIN pg_temp.f8f_ids f ON f.id = e.id
CROSS JOIN LATERAL (VALUES
    (e.creator_id),
    (pg_temp.f8f_id(CASE WHEN f.name LIKE 'b_%' THEN 'a'
                      WHEN f.name LIKE 'c_%' OR f.name LIKE 'a_former_%' THEN 'd' ELSE 'b' END))
) AS contributor(author_id);
INSERT INTO public.event_repair_states(
    event_id, user_id, repair_status, what_helped, sharing_status, shared_at, reported_at, status_origin
)
SELECT e.id, p.author_id,
    CASE WHEN p.author_id = e.creator_id THEN 'open' ELSE 'reconnected' END,
    CASE WHEN p.author_id = e.creator_id THEN NULL ELSE 'talking' END,
    CASE WHEN e.visibility = 'ours' AND p.author_id <> e.creator_id THEN 'shared' ELSE 'private' END,
    CASE WHEN e.visibility = 'ours' AND p.author_id <> e.creator_id THEN now() ELSE NULL END,
    now(), 'explicit'
FROM public.relationship_events e JOIN public.event_perspectives p ON p.event_id = e.id
WHERE e.event_type = 'friction';
INSERT INTO private.ros03c_legacy_repair_snapshot(event_id, repair_status)
SELECT id, 'open' FROM public.relationship_events WHERE event_type = 'friction';

-- Whole-row snapshots run ONLY as postgres, independently of caller RLS. Include
-- identities, membership, invitations and every child table, not just row counts.
CREATE FUNCTION pg_temp.f8f_snapshot(p_exclude uuid[] DEFAULT '{}'::uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_table text; v_rows jsonb; v_result jsonb := '{}'::jsonb; v_filter text;
BEGIN
    FOREACH v_table IN ARRAY ARRAY[
        'auth.users', 'public.profiles', 'public.couples', 'public.couple_members',
        'public.couple_invites', 'public.relationship_events',
        'public.event_private_reflections', 'public.event_perspectives',
        'public.event_repair_states', 'private.ros03c_legacy_repair_snapshot'
    ] LOOP
        v_filter := CASE
            WHEN v_table = 'public.relationship_events' THEN ' WHERE id <> ALL($1)'
            WHEN v_table IN ('public.event_private_reflections', 'public.event_perspectives',
                            'public.event_repair_states', 'private.ros03c_legacy_repair_snapshot')
                THEN ' WHERE event_id <> ALL($1)'
            ELSE '' END;
        EXECUTE format(
            'SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), ''[]''::jsonb) FROM %s t%s',
            v_table, v_filter
        ) INTO v_rows USING p_exclude;
        v_result := v_result || jsonb_build_object(v_table, v_rows);
    END LOOP;
    RETURN v_result;
END;
$$;
CREATE TEMP TABLE f8f_expected AS SELECT pg_temp.f8f_snapshot() AS state;
CREATE FUNCTION pg_temp.f8f_assert_state() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Independent owner verification required'; END IF;
    IF pg_temp.f8f_snapshot() IS DISTINCT FROM (SELECT state FROM pg_temp.f8f_expected) THEN
        RAISE EXCEPTION 'Unexpected parent/child/membership/other-event changes';
    END IF;
END;
$$;

CREATE FUNCTION pg_temp.f8f_expect_permission_denied(p_sql text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    BEGIN
        EXECUTE p_sql;
    EXCEPTION WHEN insufficient_privilege THEN RETURN;
    END;
    RAISE EXCEPTION 'Expected permission denial (42501), not successful filtering';
END;
$$;

-- Check both the public wrapper and the deliberately callable private helper.
CREATE FUNCTION pg_temp.f8f_expect_rpc(p_event uuid, p_error text DEFAULT NULL,
                                      p_private boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_ack boolean; v_details text; v_hint text;
BEGIN
    BEGIN
        EXECUTE 'SELECT ' || CASE WHEN p_private THEN 'private.delete_relationship_event_internal'
                                 ELSE 'public.delete_relationship_event' END || '($1)'
        INTO v_ack USING p_event;
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        GET STACKED DIAGNOSTICS v_details = PG_EXCEPTION_DETAIL, v_hint = PG_EXCEPTION_HINT;
        IF p_error IS NULL OR SQLERRM <> p_error OR v_details <> '' OR v_hint <> '' THEN RAISE; END IF;
        RETURN;
    END;
    IF p_error IS NOT NULL THEN RAISE EXCEPTION 'Expected RPC denial, got acknowledgment'; END IF;
    IF v_ack IS DISTINCT FROM true THEN RAISE EXCEPTION 'Expected literal true deletion acknowledgment'; END IF;
END;
$$;

DO $rpc_metadata$
DECLARE v_signature text;
BEGIN
    FOREACH v_signature IN ARRAY ARRAY[
        'public.delete_relationship_event(uuid)', 'private.delete_relationship_event_internal(uuid)'
    ] LOOP
        IF NOT has_function_privilege('authenticated', v_signature, 'EXECUTE')
           OR has_function_privilege('anon', v_signature, 'EXECUTE')
           OR NOT EXISTS (
               SELECT 1 FROM pg_catalog.pg_proc p
               WHERE p.oid = to_regprocedure(v_signature)
                 AND pg_get_userbyid(p.proowner) = 'postgres'
                 AND p.proconfig = ARRAY['search_path=""']::text[]
                 AND p.prosecdef = (v_signature LIKE 'private.%')
                 AND NOT EXISTS (
                     SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                     WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
                 )
           ) THEN RAISE EXCEPTION 'Unexpected deletion RPC ownership/configuration/ACL'; END IF;
    END LOOP;
END;
$rpc_metadata$;

-- Current partner B, foreign member D, and unrelated/missing/null IDs must get
-- the same fixed availability error through BOTH entry points.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', pg_temp.f8f_id('b')::text, true);
DO $$
DECLARE v_name text; v_private boolean;
BEGIN
    FOREACH v_private IN ARRAY ARRAY[false, true] LOOP
        FOREACH v_name IN ARRAY ARRAY['a_ours', 'a_mine', 'c_ours', 'c_mine', 'missing', 'null'] LOOP
            PERFORM pg_temp.f8f_expect_rpc(pg_temp.f8f_id(v_name), 'Event unavailable', v_private);
        END LOOP;
    END LOOP;
END;
$$;
SELECT set_config('request.jwt.claim.sub', pg_temp.f8f_id('d')::text, true);
SELECT pg_temp.f8f_expect_rpc(pg_temp.f8f_id('c_ours'), 'Event unavailable');
RESET ROLE;
SELECT pg_temp.f8f_assert_state();

-- Active creator: direct DELETE is now a permission error, even for an event
-- that the RPC may delete. Cover bare, ID-filtered and constant-returning forms.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', pg_temp.f8f_id('a')::text, true);
SELECT pg_temp.f8f_expect_permission_denied('DELETE FROM public.relationship_events');
SELECT pg_temp.f8f_expect_permission_denied(format(
    'DELETE FROM public.relationship_events WHERE id = %L::uuid', pg_temp.f8f_id('a_ours')));
SELECT pg_temp.f8f_expect_permission_denied(
    'WITH deleted AS (DELETE FROM public.relationship_events RETURNING 1) SELECT count(*) FROM deleted');
-- Neither a permissive event policy nor parent-couple cascading can substitute
-- for the guarded RPC. Couples retain only their historical SELECT/INSERT RLS.
DO $$
DECLARE v_rows bigint;
BEGIN
    DELETE FROM public.couples;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 0 THEN RAISE EXCEPTION 'Indirect parent-couple deletion bypass'; END IF;
END;
$$;
SELECT pg_temp.f8f_expect_rpc(pg_temp.f8f_id('a_former_ours'), 'Event unavailable');
SELECT pg_temp.f8f_expect_rpc(pg_temp.f8f_id('a_former_mine'), 'Event unavailable', true);
RESET ROLE;
SELECT pg_temp.f8f_assert_state();

-- Preserve active creator permissions and ALL four existing cascades. Excluding
-- only these event IDs from expected whole rows detects collateral modifications.
SAVEPOINT f8f_active;
UPDATE pg_temp.f8f_expected SET state = pg_temp.f8f_snapshot(ARRAY[
    pg_temp.f8f_id('a_ours'), pg_temp.f8f_id('a_mine'), pg_temp.f8f_id('a_positive')]);
SET LOCAL ROLE authenticated;
SELECT pg_temp.f8f_expect_rpc(pg_temp.f8f_id('a_ours'));
SELECT pg_temp.f8f_expect_rpc(pg_temp.f8f_id('a_mine'), NULL, true);
SELECT pg_temp.f8f_expect_rpc(pg_temp.f8f_id('a_positive'));
-- A repeated call cannot return a false success after the parent is gone.
SELECT pg_temp.f8f_expect_rpc(pg_temp.f8f_id('a_ours'), 'Event unavailable');
RESET ROLE;
SELECT pg_temp.f8f_assert_state();
ROLLBACK TO SAVEPOINT f8f_active;
RELEASE SAVEPOINT f8f_active;
SELECT pg_temp.f8f_assert_state();

-- Sequential revocation: same simulated subject, fresh statement snapshots.
DELETE FROM public.couple_members
WHERE couple_id = pg_temp.f8f_id('couple') AND user_id = pg_temp.f8f_id('a');
UPDATE pg_temp.f8f_expected SET state = pg_temp.f8f_snapshot();
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_name text; v_private boolean;
BEGIN
    FOREACH v_private IN ARRAY ARRAY[false, true] LOOP
        FOREACH v_name IN ARRAY ARRAY['a_ours', 'a_mine', 'a_positive', 'a_former_ours', 'missing', 'null'] LOOP
            PERFORM pg_temp.f8f_expect_rpc(pg_temp.f8f_id(v_name), 'Event unavailable', v_private);
        END LOOP;
    END LOOP;
END;
$$;
SELECT pg_temp.f8f_expect_permission_denied('DELETE FROM public.relationship_events');
RESET ROLE;
SELECT pg_temp.f8f_assert_state();

-- Claimless authenticated role is not a signed-in person.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT pg_temp.f8f_expect_rpc(pg_temp.f8f_id('a_ours'), 'Authentication required');
SELECT pg_temp.f8f_expect_rpc(NULL, 'Authentication required', true);
RESET ROLE;
SELECT pg_temp.f8f_assert_state();

-- Anonymous grants, not merely a user-id check, prevent direct and RPC access.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', pg_temp.f8f_id('a')::text, true);
SELECT pg_temp.f8f_expect_permission_denied('DELETE FROM public.relationship_events');
SELECT pg_temp.f8f_expect_permission_denied(format(
    'SELECT public.delete_relationship_event(%L::uuid)', pg_temp.f8f_id('a_ours')));
SELECT pg_temp.f8f_expect_permission_denied(format(
    'SELECT private.delete_relationship_event_internal(%L::uuid)', pg_temp.f8f_id('a_ours')));
RESET ROLE;
SELECT pg_temp.f8f_assert_state();

-- Sequential couple reassignment does not reauthorize former events.
INSERT INTO public.couples(id, created_by)
VALUES (pg_temp.f8f_id('replacement_couple'), pg_temp.f8f_id('a'));
UPDATE pg_temp.f8f_expected SET state = pg_temp.f8f_snapshot();
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', pg_temp.f8f_id('a')::text, true);
SELECT pg_temp.f8f_expect_rpc(pg_temp.f8f_id('a_ours'), 'Event unavailable');
RESET ROLE;
SELECT pg_temp.f8f_assert_state();

DO $$
BEGIN
    RAISE NOTICE 'Finding 8 final-schema sequential SQL assertions passed; rolling back synthetic fixtures.';
END;
$$;
ROLLBACK;
