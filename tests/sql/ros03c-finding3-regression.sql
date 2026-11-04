-- NOT EXECUTED by authoring this file. Requires separately authorized disposable
-- Supabase with all numbered migrations through 20261104100000 already applied.
-- Run as postgres with psql -X -v finding3_disposable_authorized=1 -f this-file.
-- Never run on the original development database or a hosted database.
\set ON_ERROR_STOP on
\if :{?finding3_disposable_authorized}
\else
\echo 'Explicit disposable-database authorization flag is required.'
\quit 3
\endif
\if :finding3_disposable_authorized
\else
\echo 'Disposable-database authorization flag must be true.'
\quit 3
\endif

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL row_security = on;

DO $$
BEGIN
    IF current_user <> 'postgres' THEN
        RAISE EXCEPTION 'Run only as postgres on an approved disposable database';
    END IF;
    IF to_regprocedure('public.save_my_repair_state_checked(uuid,text,text,bigint)') IS NULL THEN
        RAISE EXCEPTION 'Finding 2 checked-save prerequisite is missing';
    END IF;
END;
$$;

-- Random, synthetic fixtures only. All objects and rows roll back.
CREATE TEMP TABLE f3_ids (name text PRIMARY KEY, id uuid NOT NULL DEFAULT gen_random_uuid());
INSERT INTO pg_temp.f3_ids(name) VALUES
    ('a'), ('b'), ('outsider'), ('couple'), ('other_couple'),
    ('mine'), ('hidden_empty'), ('hidden_positive'), ('ours'), ('positive'), ('empty'),
    ('foreign'), ('foreign_positive'), ('suspended'), ('missing');
GRANT SELECT ON pg_temp.f3_ids TO authenticated;

CREATE FUNCTION pg_temp.f3_id(p_name text) RETURNS uuid
LANGUAGE sql SECURITY INVOKER AS $$
    SELECT id FROM pg_temp.f3_ids WHERE name = p_name;
$$;

INSERT INTO auth.users(id)
SELECT id FROM pg_temp.f3_ids WHERE name IN ('a', 'b', 'outsider');
-- The existing couple trigger adds each creator's membership.
INSERT INTO public.couples(id, created_by) VALUES
    (pg_temp.f3_id('couple'), pg_temp.f3_id('a')),
    (pg_temp.f3_id('other_couple'), pg_temp.f3_id('outsider'));
INSERT INTO public.couple_members(couple_id, user_id)
VALUES (pg_temp.f3_id('couple'), pg_temp.f3_id('b'));
INSERT INTO public.relationship_events(id, couple_id, creator_id, event_type, category, visibility)
SELECT f.id,
       pg_temp.f3_id(CASE WHEN f.name LIKE 'foreign%' THEN 'other_couple' ELSE 'couple' END),
       pg_temp.f3_id(CASE WHEN f.name LIKE 'foreign%' THEN 'outsider' ELSE 'a' END),
       CASE WHEN f.name LIKE '%positive' THEN 'positive' ELSE 'friction' END,
       'finding3-synthetic',
       CASE WHEN f.name IN ('mine', 'hidden_empty', 'hidden_positive') THEN 'mine' ELSE 'ours' END
FROM pg_temp.f3_ids f
WHERE f.name IN ('mine', 'hidden_empty', 'hidden_positive', 'ours', 'positive', 'empty',
                 'foreign', 'foreign_positive', 'suspended');

CREATE FUNCTION pg_temp.f3_capture(p_sql text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
    v_value jsonb;
    v_code text;
    v_message text;
    v_details text;
    v_hint text;
BEGIN
    EXECUTE 'SELECT to_jsonb(value) FROM (' || p_sql || ') AS result(value)' INTO v_value;
    RETURN jsonb_build_object('value', v_value);
EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_code = RETURNED_SQLSTATE,
        v_message = MESSAGE_TEXT, v_details = PG_EXCEPTION_DETAIL, v_hint = PG_EXCEPTION_HINT;
    RETURN jsonb_build_object('code', v_code, 'message', v_message,
        'details', v_details, 'hint', v_hint);
END;
$$;

CREATE FUNCTION pg_temp.f3_expect(p_sql text, p_expected jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_actual jsonb := pg_temp.f3_capture(p_sql);
BEGIN
    IF v_actual IS DISTINCT FROM p_expected THEN
        RAISE EXCEPTION 'Unexpected outcome for %: expected %, got %', p_sql, p_expected, v_actual;
    END IF;
END;
$$;

CREATE FUNCTION pg_temp.f3_error(p_message text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER AS $$
    SELECT jsonb_build_object('code', 'P0001', 'message', p_message, 'details', '', 'hint', '');
$$;

-- Function names and version fragments below are fixed test inputs, not user data.
CREATE FUNCTION pg_temp.f3_call(p_fn text, p_event uuid, p_version text DEFAULT '1',
                              p_status text DEFAULT 'open', p_method text DEFAULT NULL)
RETURNS text LANGUAGE sql SECURITY INVOKER AS $$
    SELECT CASE
        WHEN p_fn LIKE '%save%' THEN format('SELECT %s(%L::uuid,%L::text,%L::text,%s::bigint)',
            p_fn, p_event, p_status, p_method, p_version)
        WHEN p_fn LIKE '%share_my%' THEN format('SELECT %s(%L::uuid,%s::bigint)', p_fn, p_event, p_version)
        ELSE format('SELECT %s(%L::uuid)', p_fn, p_event)
    END;
$$;

-- Run the same unauthorized matrix against public wrappers AND directly callable
-- private helpers. Compare SQLSTATE/message/details/hint and success return values.
CREATE FUNCTION pg_temp.f3_denied(p_events text[]) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_fn text; v_name text; v_version text; v_error jsonb;
BEGIN
    FOREACH v_fn IN ARRAY ARRAY[
        'public.save_my_repair_state_checked', 'private.save_my_repair_state_checked_internal',
        'public.share_my_repair_state', 'private.share_my_repair_state_internal',
        'public.withdraw_my_repair_state', 'private.withdraw_my_repair_state_internal'
    ] LOOP
        v_error := pg_temp.f3_error(CASE WHEN v_fn LIKE '%share_my%' THEN
            'Moment unavailable for sharing' ELSE 'Moment unavailable' END);
        FOREACH v_name IN ARRAY p_events LOOP
            FOREACH v_version IN ARRAY ARRAY['NULL', '-1', '0', '1', '999'] LOOP
                PERFORM pg_temp.f3_expect(pg_temp.f3_call(v_fn, pg_temp.f3_id(v_name), v_version), v_error);
                IF v_fn LIKE '%save%' THEN
                    -- Even invalid status/method must not outrank authorization.
                    PERFORM pg_temp.f3_expect(pg_temp.f3_call(v_fn, pg_temp.f3_id(v_name),
                        v_version, 'invalid-status', 'invalid-method'), v_error);
                END IF;
            END LOOP;
        END LOOP;
    END LOOP;
END;
$$;

-- Confirm effective privileges, including inherited/PUBLIC grants.
DO $$
DECLARE v_signature text; v_role text;
BEGIN
    FOREACH v_signature IN ARRAY ARRAY[
        'public.save_my_repair_state(uuid,text,text)',
        'private.save_my_repair_state_internal(uuid,text,text)'
    ] LOOP
        FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
            IF has_function_privilege(v_role, v_signature, 'EXECUTE') THEN
                RAISE EXCEPTION 'Retired save is executable: %, %', v_role, v_signature;
            END IF;
        END LOOP;
    END LOOP;
    FOREACH v_signature IN ARRAY ARRAY[
        'public.save_my_repair_state_checked(uuid,text,text,bigint)',
        'private.save_my_repair_state_checked_internal(uuid,text,text,bigint)',
        'public.share_my_repair_state(uuid,bigint)', 'private.share_my_repair_state_internal(uuid,bigint)',
        'public.withdraw_my_repair_state(uuid)', 'private.withdraw_my_repair_state_internal(uuid)'
    ] LOOP
        IF has_function_privilege('anon', v_signature, 'EXECUTE')
           OR NOT has_function_privilege('authenticated', v_signature, 'EXECUTE') THEN
            RAISE EXCEPTION 'Unexpected active RPC privilege: %', v_signature;
        END IF;
    END LOOP;
    IF has_table_privilege('authenticated', 'public.event_repair_states', 'INSERT,UPDATE,DELETE') THEN
        RAISE EXCEPTION 'Client has direct repair-table write privileges';
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_proc WHERE oid IN (
            'private.save_my_repair_state_checked_internal(uuid,text,text,bigint)'::regprocedure,
            'private.share_my_repair_state_internal(uuid,bigint)'::regprocedure,
            'private.withdraw_my_repair_state_internal(uuid)'::regprocedure
        ) AND (NOT prosecdef OR NOT (COALESCE(proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""']))
    ) THEN
        RAISE EXCEPTION 'Missing definer/empty search_path protection';
    END IF;
END;
$$;

-- Deliberate shadow objects: definer helpers must use the real public tables.
CREATE TEMP TABLE relationship_events (id uuid);
CREATE TEMP TABLE couple_members (user_id uuid);
CREATE TEMP TABLE event_repair_states (event_id uuid);
SET LOCAL search_path = pg_temp, public;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', pg_temp.f3_id('a')::text, true);
DO $$
DECLARE v_version bigint;
BEGIN
    -- Creator's Mine report: private first save, checked edit, no sharing.
    PERFORM pg_temp.f3_expect(pg_temp.f3_call('public.save_my_repair_state_checked',
        pg_temp.f3_id('mine'), 'NULL'), '{"value":1}');
    PERFORM pg_temp.f3_expect(pg_temp.f3_call('public.save_my_repair_state_checked',
        pg_temp.f3_id('mine'), '1', 'reconnected', 'talking'), '{"value":2}');
    PERFORM pg_temp.f3_expect(pg_temp.f3_call('public.share_my_repair_state', pg_temp.f3_id('mine'), '2'),
        pg_temp.f3_error('Moment unavailable for sharing'));
    PERFORM pg_temp.f3_expect(pg_temp.f3_call('public.withdraw_my_repair_state', pg_temp.f3_id('mine')), '{"value":false}');
    -- Ours creator and partner save independently; explicit share then withdraw.
    v_version := public.save_my_repair_state_checked(pg_temp.f3_id('ours'), 'reconnected', 'talking', NULL);
    PERFORM pg_temp.f3_expect(pg_temp.f3_call('public.share_my_repair_state', pg_temp.f3_id('ours'), v_version::text), '{"value":true}');
    PERFORM pg_temp.f3_expect(pg_temp.f3_call('public.withdraw_my_repair_state', pg_temp.f3_id('ours')), '{"value":true}');
    PERFORM pg_temp.f3_expect(pg_temp.f3_call('public.withdraw_my_repair_state', pg_temp.f3_id('ours')), '{"value":false}');
    IF NOT EXISTS (SELECT 1 FROM public.event_repair_states WHERE event_id = pg_temp.f3_id('ours')
        AND user_id = auth.uid() AND repair_status = 'reconnected' AND what_helped = 'talking'
        AND sharing_status = 'private' AND shared_at IS NULL AND report_version = v_version + 2) THEN
        RAISE EXCEPTION 'Share/withdraw must retain the author report and advance its version';
    END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', pg_temp.f3_id('b')::text, true);
DO $$
DECLARE v_version bigint; v_bad text;
BEGIN
    -- Hidden friction with and without A's report, and hidden positive with no report.
    PERFORM pg_temp.f3_denied(ARRAY['mine', 'hidden_empty', 'hidden_positive', 'foreign', 'foreign_positive', 'missing']);
    IF EXISTS (SELECT 1 FROM public.relationship_events WHERE id IN
        (pg_temp.f3_id('mine'), pg_temp.f3_id('hidden_positive'), pg_temp.f3_id('foreign'))) THEN
        RAISE EXCEPTION 'RLS exposed an inaccessible event';
    END IF;
    IF EXISTS (SELECT 1 FROM public.event_repair_states WHERE event_id = pg_temp.f3_id('ours')) THEN
        RAISE EXCEPTION 'Partner read a private repair report';
    END IF;
    -- Partner is also authorized on Ours, with no implicit joint status.
    v_version := public.save_my_repair_state_checked(pg_temp.f3_id('ours'), 'open', 'talking', NULL);
    IF NOT EXISTS (SELECT 1 FROM public.event_repair_states WHERE event_id = pg_temp.f3_id('ours')
        AND user_id = auth.uid() AND repair_status = 'open' AND what_helped IS NULL
        AND sharing_status = 'private' AND status_origin = 'explicit') THEN
        RAISE EXCEPTION 'Partner save must be independent, private, explicit, and clear open method';
    END IF;
    -- Missing, stale, and invalid expected versions remain distinct only for authorized events.
    PERFORM pg_temp.f3_expect(pg_temp.f3_call('public.save_my_repair_state_checked', pg_temp.f3_id('ours'), 'NULL'),
        pg_temp.f3_error('Repair update changed; reload before saving'));
    PERFORM pg_temp.f3_expect(pg_temp.f3_call('public.save_my_repair_state_checked', pg_temp.f3_id('ours'), '999'),
        pg_temp.f3_error('Repair update changed; reload before saving'));
    FOREACH v_bad IN ARRAY ARRAY['0', '-1'] LOOP
        PERFORM pg_temp.f3_expect(pg_temp.f3_call('public.save_my_repair_state_checked', pg_temp.f3_id('ours'), v_bad),
            pg_temp.f3_error('Invalid report version'));
    END LOOP;
    FOREACH v_bad IN ARRAY ARRAY['NULL', '0', '-1'] LOOP
        PERFORM pg_temp.f3_expect(pg_temp.f3_call('public.share_my_repair_state', pg_temp.f3_id('ours'), v_bad),
            pg_temp.f3_error('Please reload your repair update before sharing'));
    END LOOP;
    PERFORM pg_temp.f3_expect(pg_temp.f3_call('public.share_my_repair_state', pg_temp.f3_id('ours'), '999'),
        pg_temp.f3_error('Repair update changed, was already shared, or needs confirmation; please reload'));
    PERFORM pg_temp.f3_expect(pg_temp.f3_call('public.share_my_repair_state', pg_temp.f3_id('empty')),
        pg_temp.f3_error('Repair update changed, was already shared, or needs confirmation; please reload'));
    PERFORM pg_temp.f3_expect(pg_temp.f3_call('public.save_my_repair_state_checked', pg_temp.f3_id('empty'), '1'),
        pg_temp.f3_error('Repair update changed; reload before saving'));
    PERFORM pg_temp.f3_expect(pg_temp.f3_call('public.withdraw_my_repair_state', pg_temp.f3_id('empty')), '{"value":false}');
    -- Readable positive moments still reject save/share; withdrawal is a no-op.
    PERFORM pg_temp.f3_expect(pg_temp.f3_call('public.save_my_repair_state_checked', pg_temp.f3_id('positive'), 'NULL'),
        pg_temp.f3_error('Repair state is only available for friction moments'));
    PERFORM pg_temp.f3_expect(pg_temp.f3_call('public.share_my_repair_state', pg_temp.f3_id('positive')),
        pg_temp.f3_error('Moment unavailable for sharing'));
    PERFORM pg_temp.f3_expect(pg_temp.f3_call('public.withdraw_my_repair_state', pg_temp.f3_id('positive')), '{"value":false}');
    -- Legitimate partner sharing and shared-to-private checked editing remain functional.
    PERFORM public.share_my_repair_state(pg_temp.f3_id('ours'), v_version);
    PERFORM pg_temp.f3_expect(pg_temp.f3_call('public.share_my_repair_state', pg_temp.f3_id('ours'), v_version::text),
        pg_temp.f3_error('Repair update changed, was already shared, or needs confirmation; please reload'));
    v_version := public.save_my_repair_state_checked(pg_temp.f3_id('ours'), 'partially_repaired', 'space', v_version + 1);
    IF NOT EXISTS (SELECT 1 FROM public.event_repair_states WHERE event_id = pg_temp.f3_id('ours')
        AND user_id = auth.uid() AND sharing_status = 'private' AND shared_at IS NULL) THEN
        RAISE EXCEPTION 'Editing shared report must return it to private';
    END IF;
    -- Create a report while Ours, then exercise the legitimate hidden-parent exception.
    v_version := public.save_my_repair_state_checked(pg_temp.f3_id('suspended'), 'open', NULL, NULL);
    PERFORM public.share_my_repair_state(pg_temp.f3_id('suspended'), v_version);
END;
$$;

SELECT set_config('request.jwt.claim.sub', pg_temp.f3_id('a')::text, true);
SELECT public.set_moment_visibility(pg_temp.f3_id('suspended'), 'mine', NULL);
SELECT set_config('request.jwt.claim.sub', pg_temp.f3_id('b')::text, true);
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.relationship_events WHERE id = pg_temp.f3_id('suspended'))
       OR NOT EXISTS (SELECT 1 FROM public.event_repair_states WHERE event_id = pg_temp.f3_id('suspended')
           AND user_id = auth.uid() AND sharing_status = 'private' AND report_version = 3) THEN
        RAISE EXCEPTION 'Hidden parent must suspend sharing but retain own-report reads';
    END IF;
    PERFORM pg_temp.f3_expect(pg_temp.f3_call('public.withdraw_my_repair_state', pg_temp.f3_id('suspended')), '{"value":false}');
    PERFORM pg_temp.f3_expect(pg_temp.f3_call('private.withdraw_my_repair_state_internal', pg_temp.f3_id('suspended')), '{"value":false}');
    -- Ownership exception does not permit saving or sharing a hidden parent.
    PERFORM pg_temp.f3_expect(pg_temp.f3_call('public.save_my_repair_state_checked', pg_temp.f3_id('suspended'), '3'),
        pg_temp.f3_error('Moment unavailable'));
    PERFORM pg_temp.f3_expect(pg_temp.f3_call('public.share_my_repair_state', pg_temp.f3_id('suspended'), '3'),
        pg_temp.f3_error('Moment unavailable for sharing'));
END;
$$;
SELECT set_config('request.jwt.claim.sub', pg_temp.f3_id('a')::text, true);
SELECT public.set_moment_visibility(pg_temp.f3_id('suspended'), 'ours', 'Synthetic shared topic');
SELECT set_config('request.jwt.claim.sub', pg_temp.f3_id('b')::text, true);
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.event_repair_states WHERE event_id = pg_temp.f3_id('suspended')
        AND user_id = auth.uid() AND sharing_status = 'private' AND report_version = 3) THEN
        RAISE EXCEPTION 'Returning to Ours must not automatically re-share';
    END IF;
END;
$$;

-- Same SQL session/JWT after membership deletion; not a browser revocation test.
RESET ROLE;
DELETE FROM public.couple_members WHERE couple_id = pg_temp.f3_id('couple') AND user_id = pg_temp.f3_id('b');
CREATE TEMP TABLE f3_reports_before_denial AS SELECT * FROM public.event_repair_states;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
    PERFORM pg_temp.f3_denied(ARRAY['mine', 'hidden_empty', 'hidden_positive', 'ours', 'positive', 'suspended', 'missing']);
    IF EXISTS (SELECT 1 FROM public.event_repair_states) THEN
        RAISE EXCEPTION 'Former member retained repair read access';
    END IF;
END;
$$;
SELECT set_config('request.jwt.claim.sub', pg_temp.f3_id('outsider')::text, true);
SELECT pg_temp.f3_denied(ARRAY['mine', 'hidden_empty', 'hidden_positive', 'ours', 'positive', 'suspended', 'missing']);

-- Retired public/private saves must reject actual direct SQL calls.
DO $$
DECLARE v_sql text; v_result jsonb;
BEGIN
    FOREACH v_sql IN ARRAY ARRAY[
        'SELECT public.save_my_repair_state(NULL::uuid, ''open'', NULL)',
        'SELECT private.save_my_repair_state_internal(NULL::uuid, ''open'', NULL)'
    ] LOOP
        v_result := pg_temp.f3_capture(v_sql);
        IF v_result->>'code' IS DISTINCT FROM '42501' THEN
            RAISE EXCEPTION 'Retired save not denied: %', v_result;
        END IF;
    END LOOP;
END;
$$;

-- Revocation also denies the original creator, including their own Mine report.
RESET ROLE;
DELETE FROM public.couple_members WHERE couple_id = pg_temp.f3_id('couple') AND user_id = pg_temp.f3_id('a');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', pg_temp.f3_id('a')::text, true);
SELECT pg_temp.f3_denied(ARRAY['mine', 'hidden_empty', 'hidden_positive', 'ours', 'positive', 'suspended', 'missing']);
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.event_repair_states) THEN
        RAISE EXCEPTION 'Former creator retained own repair read access';
    END IF;
END;
$$;

-- A role named authenticated with no user claim must still fail authentication.
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);
DO $$
DECLARE v_fn text;
BEGIN
    FOREACH v_fn IN ARRAY ARRAY[
        'public.save_my_repair_state_checked', 'private.save_my_repair_state_checked_internal',
        'public.share_my_repair_state', 'private.share_my_repair_state_internal',
        'public.withdraw_my_repair_state', 'private.withdraw_my_repair_state_internal'
    ] LOOP
        PERFORM pg_temp.f3_expect(pg_temp.f3_call(v_fn, NULL), pg_temp.f3_error('Authentication required'));
    END LOOP;
END;
$$;

RESET ROLE;
SET LOCAL ROLE anon;
DO $$
DECLARE v_sql text;
BEGIN
    FOREACH v_sql IN ARRAY ARRAY[
        'SELECT public.save_my_repair_state_checked(NULL::uuid, ''open'', NULL, NULL)',
        'SELECT private.save_my_repair_state_checked_internal(NULL::uuid, ''open'', NULL, NULL)',
        'SELECT public.share_my_repair_state(NULL::uuid, 1)',
        'SELECT private.share_my_repair_state_internal(NULL::uuid, 1)',
        'SELECT public.withdraw_my_repair_state(NULL::uuid)',
        'SELECT private.withdraw_my_repair_state_internal(NULL::uuid)',
        'SELECT public.save_my_repair_state(NULL::uuid, ''open'', NULL)',
        'SELECT private.save_my_repair_state_internal(NULL::uuid, ''open'', NULL)'
    ] LOOP
        BEGIN
            EXECUTE v_sql;
            RAISE EXCEPTION 'Anonymous execution unexpectedly succeeded: %', v_sql;
        EXCEPTION WHEN insufficient_privilege THEN NULL;
        END;
    END LOOP;
END;
$$;
RESET ROLE;

DO $$
BEGIN
    -- Privileged verification independent of RLS: denied attempts changed no report.
    IF EXISTS ((SELECT * FROM public.event_repair_states EXCEPT SELECT * FROM pg_temp.f3_reports_before_denial)
        UNION ALL (SELECT * FROM pg_temp.f3_reports_before_denial EXCEPT SELECT * FROM public.event_repair_states)) THEN
        RAISE EXCEPTION 'Unauthorized calls changed repair rows';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.event_repair_states WHERE event_id = pg_temp.f3_id('ours')
        AND user_id = pg_temp.f3_id('a') AND repair_status = 'reconnected' AND what_helped = 'talking'
        AND sharing_status = 'private') THEN
        RAISE EXCEPTION 'Partner operations changed A''s independent report';
    END IF;
    RAISE NOTICE 'Finding 3 database regression assertions passed; rolling back all synthetic fixtures.';
END;
$$;
ROLLBACK;
