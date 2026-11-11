-- PREPARED ONLY: NOT EXECUTED. Requires separate approval and a positively
-- verified NEW EMPTY disposable PostgreSQL target; never use a development DB.
-- Apply all migrations through 20261106120000 separately before this suite.
-- psql -X -v finding8_disposable_authorized=1 -v expected_system_identifier=...
--      --host <verified loopback host> --port <verified port> -f this-file
-- Flags/loopback/emptiness are safeguards, not proof of runtime/storage isolation.
-- SQL models return=minimal shapes; it does NOT verify live HTTP/PostgREST.
-- This policy-only correction does NOT promise concurrent revocation fencing.
\set ON_ERROR_STOP on
\if :{?finding8_disposable_authorized}
\else
\echo 'Separate fresh-disposable-target authorization is required.'
\quit 3
\endif
\if :finding8_disposable_authorized
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
        WHERE version = '20261106120000'
    ) THEN
        RAISE EXCEPTION 'Expected postgres and separately applied Finding 8 migration';
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
    ) OR NOT has_table_privilege('authenticated', 'public.relationship_events', 'DELETE')
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
CREATE TEMP TABLE f8_ids(name text PRIMARY KEY, id uuid NOT NULL DEFAULT gen_random_uuid());
INSERT INTO pg_temp.f8_ids(name) VALUES
    ('a'), ('b'), ('c'), ('d'), ('couple'), ('foreign_couple'), ('replacement_couple'),
    ('a_ours'), ('a_mine'), ('a_positive'), ('b_ours'), ('b_mine'), ('c_ours'), ('c_mine'),
    ('a_former_ours'), ('a_former_mine'), ('a_new'), ('missing');
GRANT SELECT ON pg_temp.f8_ids TO authenticated, anon;
CREATE FUNCTION pg_temp.f8_id(p_name text) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
    SELECT id FROM pg_temp.f8_ids WHERE name = p_name;
$$;

INSERT INTO auth.users(id) SELECT id FROM pg_temp.f8_ids WHERE name IN ('a', 'b', 'c', 'd');
-- Existing creator trigger supplies A/C memberships; uniqueness permits one couple/user.
INSERT INTO public.couples(id, created_by) VALUES
    (pg_temp.f8_id('couple'), pg_temp.f8_id('a')),
    (pg_temp.f8_id('foreign_couple'), pg_temp.f8_id('c'));
INSERT INTO public.couple_members(couple_id, user_id) VALUES
    (pg_temp.f8_id('couple'), pg_temp.f8_id('b')),
    (pg_temp.f8_id('foreign_couple'), pg_temp.f8_id('d'));
-- a_former_* models A-owned events left in a different/former couple. Owner
-- fixture creation intentionally models history; it grants no client rights.
INSERT INTO public.relationship_events(
    id, couple_id, creator_id, event_type, category, intensity, visibility, shared_topic
)
SELECT id,
    pg_temp.f8_id(CASE WHEN name LIKE 'c_%' OR name LIKE 'a_former_%'
                      THEN 'foreign_couple' ELSE 'couple' END),
    pg_temp.f8_id(CASE WHEN name LIKE 'b_%' THEN 'b' WHEN name LIKE 'c_%' THEN 'c' ELSE 'a' END),
    CASE WHEN name = 'a_positive' THEN 'positive' ELSE 'friction' END,
    'finding8-synthetic', CASE WHEN name = 'a_positive' THEN NULL ELSE 3 END,
    CASE WHEN name LIKE '%mine' THEN 'mine' ELSE 'ours' END,
    CASE WHEN name LIKE '%mine' THEN NULL ELSE 'Synthetic shared topic' END
FROM pg_temp.f8_ids
WHERE name IN ('a_ours', 'a_mine', 'a_positive', 'b_ours', 'b_mine', 'c_ours', 'c_mine',
               'a_former_ours', 'a_former_mine');
INSERT INTO public.event_private_reflections(event_id, author_id, note)
SELECT id, creator_id, 'Synthetic creator-only reflection' FROM public.relationship_events;
INSERT INTO public.event_perspectives(event_id, author_id, perspective_text, sharing_status)
SELECT e.id, contributor.author_id, 'Synthetic independent perspective',
    CASE WHEN e.visibility = 'ours' THEN 'submitted' ELSE 'suspended' END
FROM public.relationship_events e
JOIN pg_temp.f8_ids f ON f.id = e.id
CROSS JOIN LATERAL (VALUES
    (e.creator_id),
    (pg_temp.f8_id(CASE WHEN f.name LIKE 'b_%' THEN 'a'
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
CREATE FUNCTION pg_temp.f8_snapshot(p_exclude uuid[] DEFAULT '{}'::uuid[]) RETURNS jsonb
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
CREATE TEMP TABLE f8_expected AS SELECT pg_temp.f8_snapshot() AS state;
CREATE FUNCTION pg_temp.f8_assert_state() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Independent owner verification required'; END IF;
    IF pg_temp.f8_snapshot() IS DISTINCT FROM (SELECT state FROM pg_temp.f8_expected) THEN
        RAISE EXCEPTION 'Unexpected parent/child/membership/other-event changes';
    END IF;
END;
$$;

-- Execute raw DELETE directly. Do not turn the no-WHERE/no-RETURNING case into
-- SELECT/RETURNING id: that could accidentally add the SELECT authorization gate.
CREATE FUNCTION pg_temp.f8_expect_delete(p_sql text, p_expected bigint) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_rows bigint;
BEGIN
    EXECUTE p_sql;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> p_expected THEN
        RAISE EXCEPTION 'DELETE expected % affected rows, got %', p_expected, v_rows;
    END IF;
    -- Permission/other SQL errors deliberately propagate: zero-row filtering is
    -- the expected authenticated denial and must not be confused with 42501.
END;
$$;
CREATE FUNCTION pg_temp.f8_expect_minimal(p_sql text, p_expected bigint) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_rows bigint;
BEGIN
    -- Models a constant-returning mutation CTE, with no target-column SELECT.
    -- The SQL shape is representative, not proof of a particular HTTP server.
    EXECUTE 'WITH deleted AS (' || p_sql || ' RETURNING 1) SELECT count(*) FROM deleted' INTO v_rows;
    IF v_rows <> p_expected THEN
        RAISE EXCEPTION 'Constant-returning DELETE expected % rows, got %', p_expected, v_rows;
    END IF;
END;
$$;
CREATE FUNCTION pg_temp.f8_expect_permission_denied(p_sql text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    BEGIN
        EXECUTE p_sql;
    EXCEPTION WHEN insufficient_privilege THEN RETURN;
    END;
    RAISE EXCEPTION 'Expected anonymous permission denial (42501), not successful filtering';
END;
$$;

-- Noncreator B: both a readable Ours and hidden Mine, plus foreign/missing IDs.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', pg_temp.f8_id('b')::text, true);
DO $$
DECLARE v_name text;
BEGIN
    FOREACH v_name IN ARRAY ARRAY['a_ours', 'a_mine', 'a_positive', 'c_ours', 'c_mine', 'missing'] LOOP
        PERFORM pg_temp.f8_expect_delete(format(
            'DELETE FROM public.relationship_events WHERE id = %L::uuid', pg_temp.f8_id(v_name)), 0);
    END LOOP;
END;
$$;
RESET ROLE;
SELECT pg_temp.f8_assert_state();

-- D is a current member of the foreign couple, but creates none of these events.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', pg_temp.f8_id('d')::text, true);
SELECT pg_temp.f8_expect_delete('DELETE FROM public.relationship_events', 0);
SELECT pg_temp.f8_expect_minimal('DELETE FROM public.relationship_events', 0);
RESET ROLE;
SELECT pg_temp.f8_assert_state();

-- A's creator identity on a former couple is insufficient even while A is an
-- active member of a different couple. No SELECT permission is relied upon.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', pg_temp.f8_id('a')::text, true);
SELECT pg_temp.f8_expect_delete(format('DELETE FROM public.relationship_events WHERE id = %L::uuid',
    pg_temp.f8_id('a_former_ours')), 0);
SELECT pg_temp.f8_expect_delete(format('DELETE FROM public.relationship_events WHERE id = %L::uuid',
    pg_temp.f8_id('a_former_mine')), 0);
RESET ROLE;
SELECT pg_temp.f8_assert_state();

-- Active creator: ID-filtered no-return DELETE retains Mine/Ours/positive behavior
-- and the existing cascades, including partner contributions. This test records
-- existing behavior; it does not decide the separate product deletion policy.
SAVEPOINT f8_active_ids;
UPDATE pg_temp.f8_expected SET state = pg_temp.f8_snapshot(ARRAY[
    pg_temp.f8_id('a_ours'), pg_temp.f8_id('a_mine'), pg_temp.f8_id('a_positive')]);
SET LOCAL ROLE authenticated;
SELECT pg_temp.f8_expect_delete(format('DELETE FROM public.relationship_events WHERE id = %L::uuid',
    pg_temp.f8_id('a_ours')), 1);
SELECT pg_temp.f8_expect_delete(format('DELETE FROM public.relationship_events WHERE id = %L::uuid',
    pg_temp.f8_id('a_mine')), 1);
SELECT pg_temp.f8_expect_delete(format('DELETE FROM public.relationship_events WHERE id = %L::uuid',
    pg_temp.f8_id('a_positive')), 1);
RESET ROLE;
SELECT pg_temp.f8_assert_state();
ROLLBACK TO SAVEPOINT f8_active_ids;
RELEASE SAVEPOINT f8_active_ids;
SELECT pg_temp.f8_assert_state();

SAVEPOINT f8_active_returning;
UPDATE pg_temp.f8_expected SET state = pg_temp.f8_snapshot(ARRAY[pg_temp.f8_id('a_ours')]);
SET LOCAL ROLE authenticated;
SELECT pg_temp.f8_expect_delete(format('DELETE FROM public.relationship_events WHERE id = %L::uuid RETURNING id',
    pg_temp.f8_id('a_ours')), 1);
RESET ROLE;
SELECT pg_temp.f8_assert_state();
ROLLBACK TO SAVEPOINT f8_active_returning;
RELEASE SAVEPOINT f8_active_returning;

SAVEPOINT f8_active_bulk;
UPDATE pg_temp.f8_expected SET state = pg_temp.f8_snapshot(ARRAY[
    pg_temp.f8_id('a_ours'), pg_temp.f8_id('a_mine'), pg_temp.f8_id('a_positive')]);
SET LOCAL ROLE authenticated;
SELECT pg_temp.f8_expect_delete('DELETE FROM public.relationship_events', 3);
RESET ROLE;
SELECT pg_temp.f8_assert_state();
ROLLBACK TO SAVEPOINT f8_active_bulk;
RELEASE SAVEPOINT f8_active_bulk;

SAVEPOINT f8_active_minimal;
UPDATE pg_temp.f8_expected SET state = pg_temp.f8_snapshot(ARRAY[
    pg_temp.f8_id('a_ours'), pg_temp.f8_id('a_mine'), pg_temp.f8_id('a_positive')]);
SET LOCAL ROLE authenticated;
SELECT pg_temp.f8_expect_minimal('DELETE FROM public.relationship_events', 3);
RESET ROLE;
SELECT pg_temp.f8_assert_state();
ROLLBACK TO SAVEPOINT f8_active_minimal;
RELEASE SAVEPOINT f8_active_minimal;
SELECT pg_temp.f8_assert_state();

-- Membership deletion is visible to later statements; retain the same JWT.
-- This is sequential SQL, NOT a concurrent transaction/HTTP revocation test.
DELETE FROM public.couple_members
WHERE couple_id = pg_temp.f8_id('couple') AND user_id = pg_temp.f8_id('a');
UPDATE pg_temp.f8_expected SET state = pg_temp.f8_snapshot();
SET LOCAL ROLE authenticated;
SELECT pg_temp.f8_expect_delete('DELETE FROM public.relationship_events', 0);
SELECT pg_temp.f8_expect_minimal('DELETE FROM public.relationship_events', 0);
DO $$
DECLARE v_name text;
BEGIN
    FOREACH v_name IN ARRAY ARRAY['a_ours', 'a_mine', 'a_positive', 'a_former_ours',
                                 'a_former_mine', 'b_ours', 'c_ours', 'missing'] LOOP
        PERFORM pg_temp.f8_expect_delete(format(
            'DELETE FROM public.relationship_events WHERE id = %L::uuid', pg_temp.f8_id(v_name)), 0);
        PERFORM pg_temp.f8_expect_delete(format(
            'DELETE FROM public.relationship_events WHERE id = %L::uuid RETURNING id', pg_temp.f8_id(v_name)), 0);
        PERFORM pg_temp.f8_expect_minimal(format(
            'DELETE FROM public.relationship_events WHERE id = %L::uuid', pg_temp.f8_id(v_name)), 0);
    END LOOP;
END;
$$;
RESET ROLE;
SELECT pg_temp.f8_assert_state();

-- A missing subject filters rows even with the authenticated table grant.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT pg_temp.f8_expect_delete('DELETE FROM public.relationship_events', 0);
RESET ROLE;
SELECT pg_temp.f8_assert_state();

-- Anonymous denial is a permission error, including a forged A subject; no grant
-- should turn this into a successful zero-row statement.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', pg_temp.f8_id('a')::text, true);
SELECT pg_temp.f8_expect_permission_denied('DELETE FROM public.relationship_events');
SELECT pg_temp.f8_expect_permission_denied(format(
    'DELETE FROM public.relationship_events WHERE id = %L::uuid', pg_temp.f8_id('a_ours')));
RESET ROLE;
SELECT pg_temp.f8_assert_state();

-- Sequential reassignment: joining a new couple must not authorize former-couple
-- events. A bulk delete may remove only A's new, currently authorized event.
INSERT INTO public.couples(id, created_by)
VALUES (pg_temp.f8_id('replacement_couple'), pg_temp.f8_id('a'));
INSERT INTO public.relationship_events(id, couple_id, creator_id, event_type, category, visibility)
VALUES (pg_temp.f8_id('a_new'), pg_temp.f8_id('replacement_couple'), pg_temp.f8_id('a'),
        'positive', 'finding8-synthetic-replacement', 'mine');
UPDATE pg_temp.f8_expected SET state = pg_temp.f8_snapshot(ARRAY[pg_temp.f8_id('a_new')]);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', pg_temp.f8_id('a')::text, true);
SELECT pg_temp.f8_expect_delete(format('DELETE FROM public.relationship_events WHERE id = %L::uuid',
    pg_temp.f8_id('a_ours')), 0);
SELECT pg_temp.f8_expect_delete('DELETE FROM public.relationship_events', 1);
RESET ROLE;
SELECT pg_temp.f8_assert_state();

DO $$
BEGIN
    RAISE NOTICE 'Finding 8 sequential SQL assertions passed; rolling back all synthetic fixtures.';
END;
$$;
ROLLBACK;
