-- PREPARED ONLY. Do not execute before separate fresh-disposable-target approval.
-- Requires every numbered migration through 20261105100000, applied separately.
-- psql -X -v finding5_disposable_authorized=1 -v expected_system_identifier=...
--      --host <verified loopback host> --port <verified port> -f this-file
-- Run as postgres. The flag/identifier are safeguards, not proof of isolation.
\set ON_ERROR_STOP on
\if :{?finding5_disposable_authorized}
\else
\echo 'Separate fresh-disposable-target authorization is required.'
\quit 3
\endif
\if :finding5_disposable_authorized
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

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL row_security = on;
DO $$
BEGIN
    IF current_user <> 'postgres' OR NOT EXISTS (
        SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261105100000'
    ) THEN RAISE EXCEPTION 'Expected postgres and separately applied Finding 5 migration'; END IF;
    IF EXISTS (SELECT 1 FROM auth.users) OR EXISTS (SELECT 1 FROM public.profiles)
       OR EXISTS (SELECT 1 FROM public.couples) OR EXISTS (SELECT 1 FROM public.couple_members)
       OR EXISTS (SELECT 1 FROM public.relationship_events)
       OR EXISTS (SELECT 1 FROM public.event_perspectives)
       OR EXISTS (SELECT 1 FROM public.event_repair_states)
       OR EXISTS (SELECT 1 FROM public.event_private_reflections) THEN
        RAISE EXCEPTION 'Requires a fresh empty disposable target; never reuse an existing stack';
    END IF;
END;
$$;

CREATE TEMP TABLE f5_ids(name text PRIMARY KEY, id uuid NOT NULL DEFAULT gen_random_uuid());
INSERT INTO pg_temp.f5_ids(name) VALUES
    ('a'), ('b'), ('outsider'), ('couple'), ('foreign_couple'), ('missing'),
    ('hidden_empty'), ('hidden_a_only'), ('ours'), ('empty'), ('positive'),
    ('cycle'), ('hidden_own'), ('foreign_ours'), ('foreign_mine');
GRANT SELECT ON pg_temp.f5_ids TO authenticated, anon;
CREATE FUNCTION pg_temp.f5_id(p_name text) RETURNS uuid LANGUAGE sql SECURITY INVOKER AS $$
    SELECT id FROM pg_temp.f5_ids WHERE name = p_name;
$$;
INSERT INTO auth.users(id) SELECT id FROM pg_temp.f5_ids WHERE name IN ('a', 'b', 'outsider');
INSERT INTO public.couples(id, created_by) VALUES
    (pg_temp.f5_id('couple'), pg_temp.f5_id('a')),
    (pg_temp.f5_id('foreign_couple'), pg_temp.f5_id('outsider'));
INSERT INTO public.couple_members(couple_id, user_id)
VALUES (pg_temp.f5_id('couple'), pg_temp.f5_id('b'));
INSERT INTO public.relationship_events(id, couple_id, creator_id, event_type, category, visibility, shared_topic)
SELECT id,
    pg_temp.f5_id(CASE WHEN name LIKE 'foreign%' THEN 'foreign_couple' ELSE 'couple' END),
    pg_temp.f5_id(CASE WHEN name LIKE 'foreign%' THEN 'outsider' ELSE 'a' END),
    CASE WHEN name = 'positive' THEN 'positive' ELSE 'friction' END,
    'finding5-synthetic',
    CASE WHEN name IN ('hidden_empty', 'hidden_a_only', 'foreign_mine') THEN 'mine' ELSE 'ours' END,
    'Synthetic topic; never returned by perspective RPCs'
FROM pg_temp.f5_ids WHERE name IN ('hidden_empty', 'hidden_a_only', 'ours', 'empty', 'positive',
                                 'cycle', 'hidden_own', 'foreign_ours', 'foreign_mine');
INSERT INTO public.event_perspectives(event_id, author_id, perspective_text, sharing_status)
VALUES (pg_temp.f5_id('hidden_a_only'), pg_temp.f5_id('a'), 'A synthetic suspended text', 'suspended');
INSERT INTO public.event_private_reflections(event_id, author_id, note)
VALUES (pg_temp.f5_id('ours'), pg_temp.f5_id('a'), 'A synthetic private reflection');

CREATE FUNCTION pg_temp.f5_capture(p_sql text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_value jsonb; v_code text; v_message text; v_details text; v_hint text;
BEGIN
    EXECUTE 'SELECT to_jsonb(value) FROM (' || p_sql || ') AS result(value)' INTO v_value;
    RETURN jsonb_build_object('value', v_value);
EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_code = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT,
        v_details = PG_EXCEPTION_DETAIL, v_hint = PG_EXCEPTION_HINT;
    RETURN jsonb_build_object('code', v_code, 'message', v_message, 'details', v_details, 'hint', v_hint);
END;
$$;
CREATE FUNCTION pg_temp.f5_error(p_message text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER AS $$
    SELECT jsonb_build_object('code', 'P0001', 'message', p_message, 'details', '', 'hint', '');
$$;
CREATE FUNCTION pg_temp.f5_expect(p_sql text, p_expected jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_actual jsonb := pg_temp.f5_capture(p_sql);
BEGIN
    IF v_actual IS DISTINCT FROM p_expected THEN
        RAISE EXCEPTION 'Unexpected outcome for %: expected %, got %', p_sql, p_expected, v_actual;
    END IF;
END;
$$;
CREATE FUNCTION pg_temp.f5_denied(p_events text[]) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_name text; v_text text; v_event uuid;
BEGIN
    FOREACH v_name IN ARRAY p_events LOOP
        v_event := pg_temp.f5_id(v_name); -- Unknown fixture name intentionally supplies NULL.
        FOREACH v_text IN ARRAY ARRAY[NULL, '', '   ', 'Synthetic new contribution'] LOOP
            PERFORM pg_temp.f5_expect(format('SELECT public.submit_event_perspective(%L::uuid,%L::text)',
                v_event, v_text), pg_temp.f5_error('Event unavailable'));
        END LOOP;
        PERFORM pg_temp.f5_expect(format('SELECT public.withdraw_event_perspective(%L::uuid)', v_event),
            pg_temp.f5_error('Perspective unavailable'));
        PERFORM pg_temp.f5_expect(format('SELECT private.can_access_own_event_perspective(%L::uuid)', v_event),
            '{"value":false}');
    END LOOP;
END;
$$;

-- Check effective client ACLs, empty search paths and secure definitions.
DO $$
DECLARE v_signature text;
BEGIN
    FOREACH v_signature IN ARRAY ARRAY['public.submit_event_perspective(uuid,text)',
        'public.withdraw_event_perspective(uuid)', 'private.can_access_own_event_perspective(uuid)'] LOOP
        IF has_function_privilege('anon', v_signature, 'EXECUTE')
           OR NOT has_function_privilege('authenticated', v_signature, 'EXECUTE') THEN
            RAISE EXCEPTION 'Unexpected effective ACL: %', v_signature;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_proc p, LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
                   WHERE p.oid = v_signature::regprocedure AND a.grantee = 0 AND a.privilege_type = 'EXECUTE') THEN
            RAISE EXCEPTION 'PUBLIC execute grant remains: %', v_signature;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_proc WHERE oid = v_signature::regprocedure
                   AND (NOT prosecdef OR NOT (COALESCE(proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""']))) THEN
            RAISE EXCEPTION 'Missing definer/empty search_path: %', v_signature;
        END IF;
    END LOOP;
    IF has_table_privilege('authenticated', 'public.event_perspectives', 'INSERT,UPDATE,DELETE')
       OR has_any_column_privilege('authenticated', 'public.event_perspectives', 'INSERT,UPDATE') THEN
        RAISE EXCEPTION 'Direct perspective write privilege remains';
    END IF;
END;
$$;
-- Shadow names must not affect fully qualified SECURITY DEFINER operations.
CREATE TEMP TABLE relationship_events(id uuid);
CREATE TEMP TABLE couple_members(user_id uuid);
CREATE TEMP TABLE event_perspectives(event_id uuid);
SET LOCAL search_path = pg_temp, public;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', pg_temp.f5_id('a')::text, true);
SELECT public.submit_event_perspective(pg_temp.f5_id('ours'), 'A independent contribution');
SELECT public.submit_event_perspective(pg_temp.f5_id('cycle'), 'A cycle contribution');
SELECT public.submit_event_perspective(pg_temp.f5_id('hidden_own'), 'A retained contribution');
RESET ROLE;
CREATE TEMP TABLE f5_a_ours_before AS
SELECT * FROM public.event_perspectives
WHERE event_id = pg_temp.f5_id('ours') AND author_id = pg_temp.f5_id('a');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', pg_temp.f5_id('b')::text, true);
DO $$
DECLARE v_id uuid; v_text text;
BEGIN
    PERFORM pg_temp.f5_denied(ARRAY['missing', 'null_id', 'hidden_empty', 'hidden_a_only', 'foreign_ours', 'foreign_mine']);
    FOREACH v_text IN ARRAY ARRAY[NULL, '', '   '] LOOP
        PERFORM pg_temp.f5_expect(format('SELECT public.submit_event_perspective(%L::uuid,%L::text)',
            pg_temp.f5_id('ours'), v_text), pg_temp.f5_error('Perspective text is required'));
    END LOOP;
    PERFORM pg_temp.f5_expect(format('SELECT public.withdraw_event_perspective(%L::uuid)', pg_temp.f5_id('empty')),
        '{"value":false}');
    v_id := public.submit_event_perspective(pg_temp.f5_id('ours'), '  B first contribution  ');
    IF v_id IS NULL OR public.submit_event_perspective(pg_temp.f5_id('ours'), ' B replacement ') IS DISTINCT FROM v_id THEN
        RAISE EXCEPTION 'Resubmission must preserve own row ID';
    END IF;
    IF (SELECT count(*) FROM public.event_perspectives WHERE event_id = pg_temp.f5_id('ours')) <> 2
       OR NOT EXISTS (SELECT 1 FROM public.event_perspectives WHERE id = v_id AND author_id = auth.uid()
                      AND perspective_text = 'B replacement' AND sharing_status = 'submitted') THEN
        RAISE EXCEPTION 'Independent submission or trimming failed';
    END IF;
    IF EXISTS (SELECT 1 FROM public.event_private_reflections)
       OR EXISTS (SELECT 1 FROM public.relationship_events WHERE id IN
           (pg_temp.f5_id('hidden_empty'), pg_temp.f5_id('hidden_a_only'), pg_temp.f5_id('foreign_ours'))) THEN
        RAISE EXCEPTION 'Private reflection or inaccessible parent exposed';
    END IF;
    IF NOT public.withdraw_event_perspective(pg_temp.f5_id('ours'))
       OR public.withdraw_event_perspective(pg_temp.f5_id('ours')) THEN
        RAISE EXCEPTION 'Readable-parent withdrawal must return true then false';
    END IF;
    -- Both positive and friction Ours moments retain perspective support.
    PERFORM public.submit_event_perspective(pg_temp.f5_id('positive'), 'B positive contribution');
    PERFORM public.submit_event_perspective(pg_temp.f5_id('ours'), 'B retained for revocation');
    PERFORM public.submit_event_perspective(pg_temp.f5_id('cycle'), 'B cycle contribution');
    PERFORM public.submit_event_perspective(pg_temp.f5_id('hidden_own'), 'B withdrawable contribution');
END;
$$;
SELECT set_config('request.jwt.claim.sub', pg_temp.f5_id('a')::text, true);
SELECT public.set_moment_visibility(pg_temp.f5_id('cycle'), 'mine');
SELECT public.set_moment_visibility(pg_temp.f5_id('hidden_own'), 'mine');
-- Creator can withdraw on Mine with no perspective (readable parent).
SELECT pg_temp.f5_expect(format('SELECT public.withdraw_event_perspective(%L::uuid)', pg_temp.f5_id('hidden_empty')),
    '{"value":false}');
SELECT set_config('request.jwt.claim.sub', pg_temp.f5_id('b')::text, true);
DO $$
DECLARE v_text text;
BEGIN
    IF EXISTS (SELECT 1 FROM public.relationship_events WHERE id IN (pg_temp.f5_id('cycle'), pg_temp.f5_id('hidden_own')))
       OR (SELECT count(*) FROM public.event_perspectives WHERE event_id IN
           (pg_temp.f5_id('cycle'), pg_temp.f5_id('hidden_own'))) <> 2
       OR EXISTS (SELECT 1 FROM public.event_perspectives WHERE event_id IN
           (pg_temp.f5_id('cycle'), pg_temp.f5_id('hidden_own')) AND (author_id <> auth.uid() OR sharing_status <> 'suspended')) THEN
        RAISE EXCEPTION 'Suspension must retain only own contribution reads and hide parents';
    END IF;
    FOREACH v_text IN ARRAY ARRAY[NULL, '', '   ', 'Synthetic replacement while hidden'] LOOP
        PERFORM pg_temp.f5_expect(format('SELECT public.submit_event_perspective(%L::uuid,%L::text)',
            pg_temp.f5_id('hidden_own'), v_text), pg_temp.f5_error('Event unavailable'));
    END LOOP;
    IF NOT private.can_access_own_event_perspective(pg_temp.f5_id('hidden_own'))
       OR NOT public.withdraw_event_perspective(pg_temp.f5_id('hidden_own')) THEN
        RAISE EXCEPTION 'Own suspended contribution must remain withdrawable';
    END IF;
    PERFORM pg_temp.f5_denied(ARRAY['hidden_own']); -- Deleted own row no longer authorizes the hidden parent.
    PERFORM pg_temp.f5_expect(format('SELECT public.submit_event_perspective(%L::uuid,NULL)', pg_temp.f5_id('cycle')),
        pg_temp.f5_error('Event unavailable')); -- Ownership exception never permits Mine submission.
END;
$$;
SELECT set_config('request.jwt.claim.sub', pg_temp.f5_id('a')::text, true);
SELECT public.set_moment_visibility(pg_temp.f5_id('cycle'), 'ours', 'Fresh synthetic topic');
SELECT set_config('request.jwt.claim.sub', pg_temp.f5_id('b')::text, true);
DO $$
BEGIN
    IF (SELECT count(*) FROM public.event_perspectives WHERE event_id = pg_temp.f5_id('cycle')) <> 1
       OR NOT EXISTS (SELECT 1 FROM public.event_perspectives WHERE event_id = pg_temp.f5_id('cycle')
                      AND author_id = auth.uid() AND sharing_status = 'suspended') THEN
        RAISE EXCEPTION 'Mine to Ours must not automatically reshare perspectives';
    END IF;
    PERFORM public.submit_event_perspective(pg_temp.f5_id('cycle'), 'B explicitly resubmitted');
END;
$$;
RESET ROLE;
DO $$
BEGIN
    IF (SELECT count(*) FROM public.event_perspectives WHERE event_id = pg_temp.f5_id('cycle')) <> 2
       OR NOT EXISTS (SELECT 1 FROM public.event_perspectives WHERE event_id = pg_temp.f5_id('cycle')
           AND author_id = pg_temp.f5_id('a') AND perspective_text = 'A cycle contribution' AND sharing_status = 'suspended')
       OR NOT EXISTS (SELECT 1 FROM public.event_perspectives WHERE event_id = pg_temp.f5_id('hidden_own')
           AND author_id = pg_temp.f5_id('a') AND perspective_text = 'A retained contribution' AND sharing_status = 'suspended')
       OR NOT EXISTS (SELECT 1 FROM public.event_perspectives WHERE event_id = pg_temp.f5_id('ours')
           AND author_id = pg_temp.f5_id('a') AND perspective_text = 'A independent contribution') THEN
        RAISE EXCEPTION 'Partner operations changed A''s independent contributions';
    END IF;
    IF EXISTS ((SELECT * FROM public.event_perspectives WHERE event_id = pg_temp.f5_id('ours')
                    AND author_id = pg_temp.f5_id('a') EXCEPT SELECT * FROM pg_temp.f5_a_ours_before)
        UNION ALL (SELECT * FROM pg_temp.f5_a_ours_before EXCEPT SELECT * FROM public.event_perspectives
                    WHERE event_id = pg_temp.f5_id('ours') AND author_id = pg_temp.f5_id('a'))) THEN
        RAISE EXCEPTION 'Partner submission/resubmission/withdrawal altered fields of A''s own row';
    END IF;
END;
$$;
CREATE TEMP TABLE f5_before_denial AS SELECT * FROM public.event_perspectives;
CREATE TEMP TABLE f5_events_before_denial AS SELECT * FROM public.relationship_events;
DELETE FROM public.couple_members WHERE couple_id = pg_temp.f5_id('couple') AND user_id = pg_temp.f5_id('b');
SET LOCAL ROLE authenticated;
-- Same JWT/session, fresh requests after membership revocation.
SELECT pg_temp.f5_denied(ARRAY['ours', 'positive', 'cycle', 'hidden_own', 'hidden_empty', 'hidden_a_only', 'missing']);
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.event_perspectives) THEN RAISE EXCEPTION 'Revoked member retained read access'; END IF;
END;
$$;
SELECT set_config('request.jwt.claim.sub', pg_temp.f5_id('outsider')::text, true);
SELECT pg_temp.f5_denied(ARRAY['ours', 'positive', 'cycle', 'hidden_own', 'hidden_empty', 'hidden_a_only', 'missing']);
RESET ROLE;
DELETE FROM public.couple_members WHERE couple_id = pg_temp.f5_id('couple') AND user_id = pg_temp.f5_id('a');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', pg_temp.f5_id('a')::text, true);
SELECT pg_temp.f5_denied(ARRAY['ours', 'positive', 'cycle', 'hidden_own', 'hidden_empty', 'hidden_a_only', 'missing']);
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.event_perspectives) THEN
        RAISE EXCEPTION 'Revoked creator retained own contribution read access';
    END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);
DO $$
DECLARE v_event uuid;
BEGIN
    FOREACH v_event IN ARRAY ARRAY[pg_temp.f5_id('missing'), pg_temp.f5_id('ours'), pg_temp.f5_id('hidden_empty'), NULL] LOOP
        PERFORM pg_temp.f5_expect(format('SELECT public.submit_event_perspective(%L::uuid,NULL)', v_event),
            pg_temp.f5_error('Authentication required'));
        PERFORM pg_temp.f5_expect(format('SELECT public.withdraw_event_perspective(%L::uuid)', v_event),
            pg_temp.f5_error('Authentication required'));
        PERFORM pg_temp.f5_expect(format('SELECT private.can_access_own_event_perspective(%L::uuid)', v_event), '{"value":false}');
    END LOOP;
END;
$$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$
DECLARE v_fn text; v_event uuid; v_result jsonb;
BEGIN
    FOREACH v_fn IN ARRAY ARRAY['public.submit_event_perspective', 'public.withdraw_event_perspective',
                                'private.can_access_own_event_perspective'] LOOP
        FOREACH v_event IN ARRAY ARRAY[pg_temp.f5_id('missing'), pg_temp.f5_id('hidden_empty'), NULL] LOOP
            v_result := pg_temp.f5_capture(format('SELECT %s(%L::uuid%s)', v_fn, v_event,
                CASE WHEN v_fn LIKE '%submit%' THEN ',NULL::text' ELSE '' END));
            IF v_result->>'code' IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'Anonymous call allowed: %', v_result; END IF;
        END LOOP;
    END LOOP;
END;
$$;
-- Even a forged subject claim cannot bypass the anon role's EXECUTE denial.
SELECT set_config('request.jwt.claim.sub', pg_temp.f5_id('outsider')::text, true);
DO $$
DECLARE v_sql text;
BEGIN
    FOREACH v_sql IN ARRAY ARRAY[
        'SELECT public.submit_event_perspective(NULL::uuid,''synthetic'')',
        'SELECT public.withdraw_event_perspective(NULL::uuid)',
        'SELECT private.can_access_own_event_perspective(NULL::uuid)'
    ] LOOP
        IF pg_temp.f5_capture(v_sql)->>'code' IS DISTINCT FROM '42501' THEN
            RAISE EXCEPTION 'Anonymous role bypassed EXECUTE protection with a subject claim';
        END IF;
    END LOOP;
END;
$$;
RESET ROLE;
DO $$
BEGIN
    IF EXISTS ((SELECT * FROM public.event_perspectives EXCEPT SELECT * FROM pg_temp.f5_before_denial)
        UNION ALL (SELECT * FROM pg_temp.f5_before_denial EXCEPT SELECT * FROM public.event_perspectives))
       OR EXISTS ((SELECT * FROM public.relationship_events EXCEPT SELECT * FROM pg_temp.f5_events_before_denial)
        UNION ALL (SELECT * FROM pg_temp.f5_events_before_denial EXCEPT SELECT * FROM public.relationship_events)) THEN
        RAISE EXCEPTION 'Denied requests changed perspective or parent rows';
    END IF;
    RAISE NOTICE 'Finding 5 PostgreSQL assertions passed; rolling back all synthetic fixtures.';
END;
$$;
ROLLBACK;
