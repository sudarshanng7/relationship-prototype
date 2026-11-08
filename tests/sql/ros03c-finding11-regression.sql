-- PREPARED ONLY: NOT EXECUTED. Requires separate approval and a positively
-- verified NEW EMPTY disposable PostgreSQL target; never use a development DB.
-- Apply all migrations through 20261108160000 separately before this suite.
-- psql -X -v finding11_disposable_authorized=1 -v expected_system_identifier=...
--      --host <verified loopback host> --port <verified port> -f this-file
-- Flags/loopback/emptiness are safeguards, not proof of runtime/storage isolation.
-- SQL role simulation does NOT verify live HTTP/PostgREST or JWT routing.
-- Visibility final-schema suite. Real two-session tests are prepared separately
-- in ros03c-finding11-concurrency.py.
\set ON_ERROR_STOP on
\if :{?finding11_disposable_authorized}
\else
\echo 'Separate fresh-disposable-target authorization is required.'
\quit 3
\endif
\if :finding11_disposable_authorized
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
        WHERE version = '20261108160000'
    ) THEN
        RAISE EXCEPTION 'Expected postgres and separately applied Finding 11 visibility membership fence migration';
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
CREATE TEMP TABLE f11_ids(name text PRIMARY KEY, id uuid NOT NULL DEFAULT gen_random_uuid());
INSERT INTO pg_temp.f11_ids(name) VALUES
    ('a'), ('b'), ('c'), ('d'), ('couple'), ('foreign_couple'), ('replacement_couple'),
    ('a_ours'), ('a_mine'), ('a_positive'), ('b_ours'), ('b_mine'), ('c_ours'), ('c_mine'),
    ('a_former_ours'), ('a_former_mine'), ('a_new'), ('missing');
GRANT SELECT ON pg_temp.f11_ids TO authenticated, anon;
CREATE FUNCTION pg_temp.f11_id(p_name text) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
    SELECT id FROM pg_temp.f11_ids WHERE name = p_name;
$$;

INSERT INTO auth.users(id) SELECT id FROM pg_temp.f11_ids WHERE name IN ('a', 'b', 'c', 'd');
-- Existing creator trigger supplies A/C memberships; uniqueness permits one couple/user.
INSERT INTO public.couples(id, created_by) VALUES
    (pg_temp.f11_id('couple'), pg_temp.f11_id('a')),
    (pg_temp.f11_id('foreign_couple'), pg_temp.f11_id('c'));
INSERT INTO public.couple_members(couple_id, user_id) VALUES
    (pg_temp.f11_id('couple'), pg_temp.f11_id('b')),
    (pg_temp.f11_id('foreign_couple'), pg_temp.f11_id('d'));
-- a_former_* models A-owned events left in a different/former couple. Owner
-- fixture creation intentionally models history; it grants no client rights.
INSERT INTO public.relationship_events(
    id, couple_id, creator_id, event_type, category, intensity, visibility, shared_topic
)
SELECT id,
    pg_temp.f11_id(CASE WHEN name LIKE 'c_%' OR name LIKE 'a_former_%'
                      THEN 'foreign_couple' ELSE 'couple' END),
    pg_temp.f11_id(CASE WHEN name LIKE 'b_%' THEN 'b' WHEN name LIKE 'c_%' THEN 'c' ELSE 'a' END),
    CASE WHEN name = 'a_positive' THEN 'positive' ELSE 'friction' END,
    'finding11-synthetic', CASE WHEN name = 'a_positive' THEN NULL ELSE 3 END,
    CASE WHEN name LIKE '%mine' THEN 'mine' ELSE 'ours' END,
    CASE WHEN name LIKE '%mine' THEN NULL ELSE 'Synthetic shared topic' END
FROM pg_temp.f11_ids
WHERE name IN ('a_ours', 'a_mine', 'a_positive', 'b_ours', 'b_mine', 'c_ours', 'c_mine',
               'a_former_ours', 'a_former_mine');
INSERT INTO public.event_private_reflections(event_id, author_id, note)
SELECT id, creator_id, 'Synthetic creator-only reflection' FROM public.relationship_events;
INSERT INTO public.event_perspectives(event_id, author_id, perspective_text, sharing_status)
SELECT e.id, contributor.author_id, 'Synthetic independent perspective',
    CASE WHEN e.visibility = 'ours' THEN 'submitted' ELSE 'suspended' END
FROM public.relationship_events e
JOIN pg_temp.f11_ids f ON f.id = e.id
CROSS JOIN LATERAL (VALUES
    (e.creator_id),
    (pg_temp.f11_id(CASE WHEN f.name LIKE 'b_%' THEN 'a'
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
CREATE FUNCTION pg_temp.f11_snapshot(p_exclude uuid[] DEFAULT '{}'::uuid[]) RETURNS jsonb
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
CREATE TEMP TABLE f11_expected AS SELECT pg_temp.f11_snapshot() AS state;
CREATE FUNCTION pg_temp.f11_assert_state() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Independent owner verification required'; END IF;
    IF pg_temp.f11_snapshot() IS DISTINCT FROM (SELECT state FROM pg_temp.f11_expected) THEN
        RAISE EXCEPTION 'Unexpected parent/child/membership/other-event changes';
    END IF;
END;
$$;

CREATE FUNCTION pg_temp.f11_capture(p_sql text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_value jsonb; v_code text; v_message text; v_details text; v_hint text;
BEGIN
    EXECUTE 'SELECT to_jsonb(value) FROM (' || p_sql || ') AS result(value)' INTO v_value;
    RETURN jsonb_build_object('value',v_value);
EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_code = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT,
        v_details = PG_EXCEPTION_DETAIL, v_hint = PG_EXCEPTION_HINT;
    RETURN jsonb_build_object('code',v_code,'message',v_message,'details',v_details,'hint',v_hint);
END;
$$;
CREATE FUNCTION pg_temp.f11_error(p_message text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
    SELECT jsonb_build_object('code','P0001','message',p_message,'details','','hint','');
$$;
CREATE FUNCTION pg_temp.f11_expect(p_sql text,p_expected jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    IF pg_temp.f11_capture(p_sql) IS DISTINCT FROM p_expected THEN
        RAISE EXCEPTION 'Unexpected repair response/error classification for %',p_sql;
    END IF;
END;
$$;

-- Model only the approved parent/trigger effects. Every other field and every
-- unrelated row must remain exact, including private reflections and identities.
-- now() is transaction-stable: fixture and trigger timestamps share this clock.
CREATE FUNCTION pg_temp.f11_check_transition(p_event uuid,p_target text,p_topic text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_expected jsonb; v_old text; v_rows jsonb;
BEGIN
    IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Independent owner verification required'; END IF;
    SELECT state INTO v_expected FROM pg_temp.f11_expected;
    SELECT item->>'visibility' INTO v_old
    FROM jsonb_array_elements(v_expected->'public.relationship_events') AS r(item)
    WHERE item->>'id'=p_event::text;
    SELECT jsonb_agg(CASE WHEN item->>'id'=p_event::text
        THEN item || jsonb_build_object('visibility',p_target,'shared_topic',
            CASE WHEN p_target='ours' THEN btrim(p_topic) ELSE NULL END) ELSE item END ORDER BY item::text)
    INTO v_rows FROM jsonb_array_elements(v_expected->'public.relationship_events') AS r(item);
    v_expected:=jsonb_set(v_expected,'{public.relationship_events}',v_rows);
    IF v_old='ours' AND p_target='mine' THEN
        SELECT jsonb_agg(CASE WHEN item->>'event_id'=p_event::text
            THEN item || jsonb_build_object('sharing_status','private','shared_at',NULL,
                'report_version',(item->>'report_version')::bigint+1) ELSE item END ORDER BY item::text)
        INTO v_rows FROM jsonb_array_elements(v_expected->'public.event_repair_states') AS r(item);
        v_expected:=jsonb_set(v_expected,'{public.event_repair_states}',v_rows);
    END IF;
    IF v_old IS DISTINCT FROM 'mine' AND p_target='mine' THEN
        SELECT jsonb_agg(CASE WHEN item->>'event_id'=p_event::text AND item->>'sharing_status'='submitted'
            THEN item || jsonb_build_object('sharing_status','suspended') ELSE item END ORDER BY item::text)
        INTO v_rows FROM jsonb_array_elements(v_expected->'public.event_perspectives') AS r(item);
        v_expected:=jsonb_set(v_expected,'{public.event_perspectives}',v_rows);
    END IF;
    -- Canonicalize arrays after mutating their sorting fields.
    SELECT jsonb_object_agg(key,(SELECT coalesce(jsonb_agg(item ORDER BY item::text),'[]'::jsonb)
        FROM jsonb_array_elements(value) AS r(item))) INTO v_expected FROM jsonb_each(v_expected);
    IF pg_temp.f11_snapshot() IS DISTINCT FROM v_expected THEN
        RAISE EXCEPTION 'Visibility transition changed unexpected parent/dependent/private data';
    END IF;
    UPDATE pg_temp.f11_expected SET state=v_expected;
END;
$$;
CREATE FUNCTION pg_temp.f11_call(p_event uuid,p_visibility text,p_topic text DEFAULT NULL) RETURNS text
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
    SELECT format('SELECT public.set_moment_visibility(%L::uuid,%L::text,%L::text)',p_event,p_visibility,p_topic);
$$;
CREATE FUNCTION pg_temp.f11_denied(p_events text[]) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_name text; v_target text; v_topic text;
BEGIN
    FOREACH v_name IN ARRAY p_events LOOP
        FOREACH v_target IN ARRAY ARRAY['mine','ours'] LOOP
            FOREACH v_topic IN ARRAY ARRAY[NULL::text,'','  ','Synthetic fresh topic'] LOOP
                PERFORM pg_temp.f11_expect(pg_temp.f11_call(pg_temp.f11_id(v_name),v_target,v_topic),
                    pg_temp.f11_error('Event unavailable'));
            END LOOP;
        END LOOP;
    END LOOP;
END;
$$;

DO $metadata$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc p
        WHERE p.oid='public.set_moment_visibility(uuid,text,text)'::regprocedure
          AND p.prosecdef AND pg_get_userbyid(p.proowner)='postgres'
          AND p.proconfig=ARRAY['search_path=""']::text[] AND p.prorettype='uuid'::regtype
          AND p.pronargdefaults=1 AND p.provolatile='v'
          AND has_function_privilege('authenticated',p.oid,'EXECUTE')
          AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
          AND NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
                          WHERE a.grantee=0 AND a.privilege_type='EXECUTE')) THEN
        RAISE EXCEPTION 'Unexpected visibility RPC metadata or ACLs';
    END IF;
END;
$metadata$;

-- Active noncreator partner, unrelated users and former-couple creator all
-- receive the same generic error as missing/null IDs, including empty topics.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f11_id('b')::text,true);
SELECT pg_temp.f11_denied(ARRAY['a_mine','a_ours','a_positive','c_mine','c_ours','missing','null']);
RESET ROLE;
SELECT pg_temp.f11_assert_state();
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f11_id('a')::text,true);
SELECT pg_temp.f11_denied(ARRAY['c_mine','c_ours','a_former_mine','a_former_ours','missing','null']);
RESET ROLE;
SELECT pg_temp.f11_assert_state();

-- Invalid visibility is input-only, deliberately still validated before lookup.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f11_id('a')::text,true);
DO $$
DECLARE v_target text; v_name text; v_topic text;
BEGIN
    FOREACH v_name IN ARRAY ARRAY['a_mine','a_ours','c_mine','missing','null'] LOOP
        FOREACH v_target IN ARRAY ARRAY[NULL::text,'','invalid','OURS'] LOOP
            PERFORM pg_temp.f11_expect(pg_temp.f11_call(pg_temp.f11_id(v_name),v_target,'Synthetic topic'),
                pg_temp.f11_error('Invalid visibility'));
        END LOOP;
    END LOOP;
    FOREACH v_topic IN ARRAY ARRAY[NULL::text,'','   '] LOOP
        PERFORM pg_temp.f11_expect(pg_temp.f11_call(pg_temp.f11_id('a_mine'),'ours',v_topic),
            pg_temp.f11_error('Please provide a topic to share'));
    END LOOP;
    PERFORM pg_temp.f11_expect(format('SELECT public.set_moment_visibility(%L::uuid,''ours'')',pg_temp.f11_id('a_mine')),
        pg_temp.f11_error('Please provide a topic to share'));
END;
$$;
RESET ROLE;
SELECT pg_temp.f11_assert_state();

-- Mine -> Ours: freshly supplied/trimmed topic; no implicit contribution share.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f11_id('a')::text,true);
SELECT pg_temp.f11_expect(pg_temp.f11_call(pg_temp.f11_id('a_mine'),'ours','  Synthetic new topic  '),
    jsonb_build_object('value',pg_temp.f11_id('a_mine')));
RESET ROLE;
SELECT pg_temp.f11_check_transition(pg_temp.f11_id('a_mine'),'ours','  Synthetic new topic  ');
-- Ours -> Mine invalidates BOTH private and shared reviewed repair versions.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f11_id('a')::text,true);
SELECT pg_temp.f11_expect(pg_temp.f11_call(pg_temp.f11_id('a_ours'),'mine','Ignored topic'),
    jsonb_build_object('value',pg_temp.f11_id('a_ours')));
RESET ROLE;
SELECT pg_temp.f11_check_transition(pg_temp.f11_id('a_ours'),'mine','Ignored topic');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f11_id('a')::text,true);
-- A repeat Mine call must not bump versions again.
SELECT pg_temp.f11_expect(pg_temp.f11_call(pg_temp.f11_id('a_ours'),'mine'),
    jsonb_build_object('value',pg_temp.f11_id('a_ours')));
RESET ROLE;
SELECT pg_temp.f11_check_transition(pg_temp.f11_id('a_ours'),'mine',NULL);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f11_id('a')::text,true);
SELECT pg_temp.f11_expect(pg_temp.f11_call(pg_temp.f11_id('a_ours'),'ours','Fresh return topic'),
    jsonb_build_object('value',pg_temp.f11_id('a_ours')));
RESET ROLE;
SELECT pg_temp.f11_check_transition(pg_temp.f11_id('a_ours'),'ours','Fresh return topic');
-- Positive events keep the same visibility capability without repair synthesis.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f11_id('a')::text,true);
SELECT pg_temp.f11_expect(pg_temp.f11_call(pg_temp.f11_id('a_positive'),'mine'),
    jsonb_build_object('value',pg_temp.f11_id('a_positive')));
RESET ROLE;
SELECT pg_temp.f11_check_transition(pg_temp.f11_id('a_positive'),'mine',NULL);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f11_id('a')::text,true);
SELECT pg_temp.f11_expect(pg_temp.f11_call(pg_temp.f11_id('a_positive'),'ours','Positive fresh topic'),
    jsonb_build_object('value',pg_temp.f11_id('a_positive')));
RESET ROLE;
SELECT pg_temp.f11_check_transition(pg_temp.f11_id('a_positive'),'ours','Positive fresh topic');

-- Current reads after the cycle still enforce independent ownership/privacy.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f11_id('b')::text,true);
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.event_private_reflections WHERE author_id=pg_temp.f11_id('a'))
       OR EXISTS (SELECT 1 FROM public.event_repair_states
                  WHERE event_id=pg_temp.f11_id('a_ours') AND user_id=pg_temp.f11_id('a'))
       OR EXISTS (SELECT 1 FROM public.event_perspectives
                  WHERE event_id=pg_temp.f11_id('a_ours') AND author_id=pg_temp.f11_id('a')) THEN
        RAISE EXCEPTION 'Visibility cycle republished private creator contributions';
    END IF;
END;
$$;
RESET ROLE;
SELECT pg_temp.f11_assert_state();

-- A revoked creator and then that creator assigned to another couple both deny.
DELETE FROM public.couple_members WHERE user_id=pg_temp.f11_id('a');
UPDATE pg_temp.f11_expected SET state=pg_temp.f11_snapshot();
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f11_id('a')::text,true);
SELECT pg_temp.f11_denied(ARRAY['a_mine','a_ours','a_positive','missing']);
RESET ROLE;
SELECT pg_temp.f11_assert_state();
INSERT INTO public.couples(id,created_by) VALUES (pg_temp.f11_id('replacement_couple'),pg_temp.f11_id('a'));
UPDATE pg_temp.f11_expected SET state=pg_temp.f11_snapshot();
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f11_id('a')::text,true);
SELECT pg_temp.f11_denied(ARRAY['a_mine','a_ours','a_positive','missing']);
SELECT set_config('request.jwt.claim.sub','',true);
SELECT pg_temp.f11_expect(pg_temp.f11_call(pg_temp.f11_id('a_ours'),'mine'),pg_temp.f11_error('Authentication required'));
-- Authentication still precedes even invalid visibility validation.
SELECT pg_temp.f11_expect(pg_temp.f11_call(pg_temp.f11_id('missing'),NULL),pg_temp.f11_error('Authentication required'));
RESET ROLE;
SELECT pg_temp.f11_assert_state();
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub',pg_temp.f11_id('a')::text,true);
DO $$
BEGIN
    IF pg_temp.f11_capture(pg_temp.f11_call(pg_temp.f11_id('a_ours'),'mine'))->>'code' IS DISTINCT FROM '42501' THEN
        RAISE EXCEPTION 'Anonymous visibility execution was not a permission error';
    END IF;
END;
$$;
RESET ROLE;
SELECT pg_temp.f11_assert_state();
DO $$ BEGIN RAISE NOTICE 'Finding 11 sequential assertions passed; rolling back synthetic fixtures.'; END; $$;
ROLLBACK;
