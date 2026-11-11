-- PREPARED ONLY: NOT EXECUTED. Requires separate approval and a positively
-- verified NEW EMPTY disposable PostgreSQL target; never use a development DB.
-- Apply all migrations through 20261108120000 separately before this suite.
-- psql -X -v finding9_disposable_authorized=1 -v expected_system_identifier=...
--      --host <verified loopback host> --port <verified port> -f this-file
-- Flags/loopback/emptiness are safeguards, not proof of runtime/storage isolation.
-- SQL role simulation does NOT verify live HTTP/PostgREST or JWT routing.
-- Repair save/share/withdraw final-schema suite. Real lock/concurrency tests
-- are prepared separately in ros03c-finding9-concurrency.py.
\set ON_ERROR_STOP on
\if :{?finding9_disposable_authorized}
\else
\echo 'Separate fresh-disposable-target authorization is required.'
\quit 3
\endif
\if :finding9_disposable_authorized
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
        WHERE version = '20261108120000'
    ) THEN
        RAISE EXCEPTION 'Expected postgres and separately applied Finding 9 repair lock privacy migration';
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
CREATE TEMP TABLE f9_ids(name text PRIMARY KEY, id uuid NOT NULL DEFAULT gen_random_uuid());
INSERT INTO pg_temp.f9_ids(name) VALUES
    ('a'), ('b'), ('c'), ('d'), ('couple'), ('foreign_couple'), ('replacement_couple'),
    ('a_ours'), ('a_mine'), ('a_positive'), ('b_ours'), ('b_mine'), ('c_ours'), ('c_mine'),
    ('a_former_ours'), ('a_former_mine'), ('a_new'), ('missing'),
    ('hidden_empty'), ('hidden_positive'), ('ours_empty'), ('legacy');
GRANT SELECT ON pg_temp.f9_ids TO authenticated, anon;
CREATE FUNCTION pg_temp.f9_id(p_name text) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
    SELECT id FROM pg_temp.f9_ids WHERE name = p_name;
$$;

INSERT INTO auth.users(id) SELECT id FROM pg_temp.f9_ids WHERE name IN ('a', 'b', 'c', 'd');
-- Existing creator trigger supplies A/C memberships; uniqueness permits one couple/user.
INSERT INTO public.couples(id, created_by) VALUES
    (pg_temp.f9_id('couple'), pg_temp.f9_id('a')),
    (pg_temp.f9_id('foreign_couple'), pg_temp.f9_id('c'));
INSERT INTO public.couple_members(couple_id, user_id) VALUES
    (pg_temp.f9_id('couple'), pg_temp.f9_id('b')),
    (pg_temp.f9_id('foreign_couple'), pg_temp.f9_id('d'));
-- a_former_* models A-owned events left in a different/former couple. Owner
-- fixture creation intentionally models history; it grants no client rights.
INSERT INTO public.relationship_events(
    id, couple_id, creator_id, event_type, category, intensity, visibility, shared_topic
)
SELECT id,
    pg_temp.f9_id(CASE WHEN name LIKE 'c_%' OR name LIKE 'a_former_%'
                      THEN 'foreign_couple' ELSE 'couple' END),
    pg_temp.f9_id(CASE WHEN name LIKE 'b_%' THEN 'b' WHEN name LIKE 'c_%' THEN 'c' ELSE 'a' END),
    CASE WHEN name = 'a_positive' THEN 'positive' ELSE 'friction' END,
    'finding9-synthetic', CASE WHEN name = 'a_positive' THEN NULL ELSE 3 END,
    CASE WHEN name LIKE '%mine' THEN 'mine' ELSE 'ours' END,
    CASE WHEN name LIKE '%mine' THEN NULL ELSE 'Synthetic shared topic' END
FROM pg_temp.f9_ids
WHERE name IN ('a_ours', 'a_mine', 'a_positive', 'b_ours', 'b_mine', 'c_ours', 'c_mine',
               'a_former_ours', 'a_former_mine');
INSERT INTO public.event_private_reflections(event_id, author_id, note)
SELECT id, creator_id, 'Synthetic creator-only reflection' FROM public.relationship_events;
INSERT INTO public.event_perspectives(event_id, author_id, perspective_text, sharing_status)
SELECT e.id, contributor.author_id, 'Synthetic independent perspective',
    CASE WHEN e.visibility = 'ours' THEN 'submitted' ELSE 'suspended' END
FROM public.relationship_events e
JOIN pg_temp.f9_ids f ON f.id = e.id
CROSS JOIN LATERAL (VALUES
    (e.creator_id),
    (pg_temp.f9_id(CASE WHEN f.name LIKE 'b_%' THEN 'a'
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

-- Additional repair-specific fixtures: B has no owned report on hidden_empty.
INSERT INTO public.relationship_events(id,couple_id,creator_id,event_type,category,visibility)
SELECT id, pg_temp.f9_id('couple'), pg_temp.f9_id('a'),
    CASE WHEN name='hidden_positive' THEN 'positive' ELSE 'friction' END,
    'finding9-synthetic', CASE WHEN name LIKE 'hidden_%' THEN 'mine' ELSE 'ours' END
FROM pg_temp.f9_ids WHERE name IN ('hidden_empty','hidden_positive','ours_empty','legacy');
INSERT INTO public.event_repair_states(event_id,user_id,repair_status,status_origin)
VALUES (pg_temp.f9_id('hidden_empty'),pg_temp.f9_id('a'),'open','explicit'),
       (pg_temp.f9_id('legacy'),pg_temp.f9_id('a'),'open','legacy_default_unconfirmed');

-- Whole-row snapshots run ONLY as postgres, independently of caller RLS. Include
-- identities, membership, invitations and every child table, not just row counts.
CREATE FUNCTION pg_temp.f9_snapshot(p_exclude uuid[] DEFAULT '{}'::uuid[]) RETURNS jsonb
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
CREATE TEMP TABLE f9_expected AS SELECT pg_temp.f9_snapshot() AS state;
CREATE FUNCTION pg_temp.f9_assert_state() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Independent owner verification required'; END IF;
    IF pg_temp.f9_snapshot() IS DISTINCT FROM (SELECT state FROM pg_temp.f9_expected) THEN
        RAISE EXCEPTION 'Unexpected parent/child/membership/other-event changes';
    END IF;
END;
$$;

CREATE FUNCTION pg_temp.f9_capture(p_sql text) RETURNS jsonb
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
CREATE FUNCTION pg_temp.f9_error(p_message text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
    SELECT jsonb_build_object('code','P0001','message',p_message,'details','','hint','');
$$;
CREATE FUNCTION pg_temp.f9_expect(p_sql text,p_expected jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    IF pg_temp.f9_capture(p_sql) IS DISTINCT FROM p_expected THEN
        RAISE EXCEPTION 'Unexpected repair response/error classification for %',p_sql;
    END IF;
END;
$$;
CREATE FUNCTION pg_temp.f9_call(p_fn text,p_event uuid,p_version text DEFAULT '1',
                               p_status text DEFAULT 'open',p_method text DEFAULT NULL) RETURNS text
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
    -- Names/version literals are fixed trusted fixture inputs, not user input.
    SELECT CASE WHEN p_fn LIKE '%save%' THEN format('SELECT %s(%L::uuid,%L::text,%L::text,%s::bigint)',
        p_fn,p_event,p_status,p_method,p_version)
    ELSE format('SELECT %s(%L::uuid,%s::bigint)',p_fn,p_event,p_version) END;
$$;
CREATE FUNCTION pg_temp.f9_denied(p_events text[]) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_fn text; v_name text; v_version text; v_error jsonb;
BEGIN
    FOREACH v_fn IN ARRAY ARRAY[
        'public.save_my_repair_state_checked','private.save_my_repair_state_checked_internal',
        'public.share_my_repair_state','private.share_my_repair_state_internal',
        'public.withdraw_my_repair_state_checked','private.withdraw_my_repair_state_checked_internal'
    ] LOOP
        v_error := pg_temp.f9_error(CASE WHEN v_fn LIKE '%share_my%' THEN
            'Moment unavailable for sharing' ELSE 'Moment unavailable' END);
        FOREACH v_name IN ARRAY p_events LOOP
            FOREACH v_version IN ARRAY ARRAY['NULL','-1','0','1','999'] LOOP
                PERFORM pg_temp.f9_expect(pg_temp.f9_call(v_fn,pg_temp.f9_id(v_name),v_version),v_error);
                IF v_fn LIKE '%save%' THEN
                    PERFORM pg_temp.f9_expect(pg_temp.f9_call(v_fn,pg_temp.f9_id(v_name),v_version,
                        'invalid-status','invalid-method'),v_error);
                    PERFORM pg_temp.f9_expect(pg_temp.f9_call(v_fn,pg_temp.f9_id(v_name),v_version,NULL,NULL),v_error);
                END IF;
            END LOOP;
        END LOOP;
    END LOOP;
END;
$$;

-- Authorized operations may change ONLY the caller's repair row. Keep all
-- parents, private reflections, perspectives, memberships and partner rows exact.
CREATE FUNCTION pg_temp.f9_without_report(p_state jsonb,p_event uuid,p_user uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
    SELECT jsonb_set(p_state,'{public.event_repair_states}',
        (SELECT coalesce(jsonb_agg(item ORDER BY item::text),'[]'::jsonb)
         FROM jsonb_array_elements(p_state->'public.event_repair_states') AS r(item)
         WHERE item->>'event_id' <> p_event::text OR item->>'user_id' <> p_user::text));
$$;
CREATE FUNCTION pg_temp.f9_assert_others(p_event uuid,p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Owner verification required'; END IF;
    IF pg_temp.f9_without_report(pg_temp.f9_snapshot(),p_event,p_user) IS DISTINCT FROM
       pg_temp.f9_without_report((SELECT state FROM pg_temp.f9_expected),p_event,p_user) THEN
        RAISE EXCEPTION 'Repair mutation changed other parent/partner/perspective/membership data';
    END IF;
END;
$$;

-- Active APIs preserve their reviewed ACLs/modes; retired entry points remain shut.
DO $metadata$
DECLARE v_fn text; v_signature text;
BEGIN
    FOREACH v_fn IN ARRAY ARRAY[
        'public.save_my_repair_state_checked','private.save_my_repair_state_checked_internal',
        'public.share_my_repair_state','private.share_my_repair_state_internal',
        'public.withdraw_my_repair_state_checked','private.withdraw_my_repair_state_checked_internal'
    ] LOOP
        v_signature := v_fn || CASE WHEN v_fn LIKE '%save%' THEN '(uuid,text,text,bigint)' ELSE '(uuid,bigint)' END;
        IF NOT has_function_privilege('authenticated',v_signature,'EXECUTE')
           OR has_function_privilege('anon',v_signature,'EXECUTE')
           OR NOT EXISTS (
               SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(v_signature)
                 AND pg_get_userbyid(p.proowner)='postgres'
                 AND p.prosecdef=(v_fn LIKE 'private.%')
                 AND p.proconfig=ARRAY['search_path=""']::text[] AND p.provolatile='v'
                 AND NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
                                 WHERE a.grantee=0 AND a.privilege_type='EXECUTE')
           ) THEN RAISE EXCEPTION 'Unexpected active repair metadata: %',v_signature; END IF;
    END LOOP;
    FOREACH v_signature IN ARRAY ARRAY[
        'public.save_my_repair_state(uuid,text,text)','private.save_my_repair_state_internal(uuid,text,text)',
        'public.withdraw_my_repair_state(uuid)','private.withdraw_my_repair_state_internal(uuid)'
    ] LOOP
        IF has_function_privilege('authenticated',v_signature,'EXECUTE')
           OR has_function_privilege('anon',v_signature,'EXECUTE') THEN
            RAISE EXCEPTION 'Retired API re-enabled: %',v_signature;
        END IF;
    END LOOP;
END;
$metadata$;

-- Current partner, no owned report: hidden and nonexistent parents have equal
-- SQLSTATE/message/details/hint even with invalid/null input or stale versions.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f9_id('b')::text,true);
SELECT pg_temp.f9_denied(ARRAY['hidden_empty','hidden_positive','c_ours','c_mine','missing','null']);
-- An owned suspended row does not grant save/share access to its hidden parent.
SELECT pg_temp.f9_expect(pg_temp.f9_call('public.save_my_repair_state_checked',pg_temp.f9_id('a_mine')),
    pg_temp.f9_error('Moment unavailable'));
SELECT pg_temp.f9_expect(pg_temp.f9_call('private.share_my_repair_state_internal',pg_temp.f9_id('a_mine'),'NULL'),
    pg_temp.f9_error('Moment unavailable for sharing'));
RESET ROLE;
SELECT pg_temp.f9_assert_state();

-- Nonmember, including a former creator with owned history in that other couple.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f9_id('a')::text,true);
SELECT pg_temp.f9_denied(ARRAY['c_ours','c_mine','a_former_ours','a_former_mine','missing','null']);
RESET ROLE;
SELECT pg_temp.f9_assert_state();

SAVEPOINT f9_suspended;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f9_id('b')::text,true);
SELECT pg_temp.f9_expect(pg_temp.f9_call('public.withdraw_my_repair_state_checked',pg_temp.f9_id('a_mine'),'1'),
    '{"value":2}');
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.relationship_events WHERE id=pg_temp.f9_id('a_mine'))
       OR EXISTS (SELECT 1 FROM public.event_repair_states WHERE event_id=pg_temp.f9_id('a_mine') AND user_id=pg_temp.f9_id('a'))
       OR NOT EXISTS (SELECT 1 FROM public.event_repair_states WHERE event_id=pg_temp.f9_id('a_mine')
                      AND user_id=auth.uid() AND report_version=2 AND sharing_status='private'
                      AND repair_status='reconnected' AND what_helped='talking' AND status_origin='explicit') THEN
        RAISE EXCEPTION 'Own suspended withdrawal visibility/content/version regression';
    END IF;
END;
$$;
RESET ROLE;
SELECT pg_temp.f9_assert_others(pg_temp.f9_id('a_mine'),pg_temp.f9_id('b'));
ROLLBACK TO SAVEPOINT f9_suspended;
RELEASE SAVEPOINT f9_suspended;

SAVEPOINT f9_mine;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f9_id('a')::text,true);
SELECT pg_temp.f9_expect(pg_temp.f9_call('private.save_my_repair_state_checked_internal',pg_temp.f9_id('a_mine'),
    '1','reconnected','talking'),'{"value":2}');
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.event_repair_states WHERE event_id=pg_temp.f9_id('a_mine')
                   AND user_id=auth.uid() AND report_version=2 AND sharing_status='private'
                   AND shared_at IS NULL AND status_origin='explicit') THEN RAISE EXCEPTION 'Mine save is not private'; END IF;
END;
$$;
RESET ROLE;
SELECT pg_temp.f9_assert_others(pg_temp.f9_id('a_mine'),pg_temp.f9_id('a'));
ROLLBACK TO SAVEPOINT f9_mine;
RELEASE SAVEPOINT f9_mine;

SAVEPOINT f9_ours;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f9_id('a')::text,true);
SELECT pg_temp.f9_expect(pg_temp.f9_call('public.save_my_repair_state_checked',pg_temp.f9_id('ours_empty'),
    'NULL','invalid-status',NULL),pg_temp.f9_error('Invalid repair status'));
SELECT pg_temp.f9_expect(pg_temp.f9_call('public.save_my_repair_state_checked',pg_temp.f9_id('ours_empty'),
    'NULL','reconnected','invalid-method'),pg_temp.f9_error('Invalid repair method'));
SELECT pg_temp.f9_expect(pg_temp.f9_call('private.save_my_repair_state_checked_internal',pg_temp.f9_id('ours_empty'),
    '0'),pg_temp.f9_error('Invalid report version'));
SELECT pg_temp.f9_expect(pg_temp.f9_call('public.share_my_repair_state',pg_temp.f9_id('ours_empty'),'NULL'),
    pg_temp.f9_error('Please reload your repair update before sharing'));
SELECT pg_temp.f9_expect(pg_temp.f9_call('private.withdraw_my_repair_state_checked_internal',pg_temp.f9_id('ours_empty'),'0'),
    pg_temp.f9_error('Please reload your repair update before withdrawing'));
SELECT pg_temp.f9_expect(pg_temp.f9_call('public.save_my_repair_state_checked',pg_temp.f9_id('ours_empty'),
    'NULL','reconnected','talking'),'{"value":1}');
SELECT pg_temp.f9_expect(pg_temp.f9_call('private.share_my_repair_state_internal',pg_temp.f9_id('ours_empty'),'1'),'{"value":true}');
SELECT pg_temp.f9_expect(pg_temp.f9_call('public.save_my_repair_state_checked',pg_temp.f9_id('ours_empty'),'1'),
    pg_temp.f9_error('Repair update changed; reload before saving'));
SELECT pg_temp.f9_expect(pg_temp.f9_call('public.withdraw_my_repair_state_checked',pg_temp.f9_id('ours_empty'),'1'),
    pg_temp.f9_error('Repair update changed; reload before withdrawing'));
SELECT pg_temp.f9_expect(pg_temp.f9_call('public.withdraw_my_repair_state_checked',pg_temp.f9_id('ours_empty'),'2'),'{"value":3}');
SELECT pg_temp.f9_expect(pg_temp.f9_call('private.withdraw_my_repair_state_checked_internal',pg_temp.f9_id('ours_empty'),'3'),'{"value":4}');
SELECT pg_temp.f9_expect(pg_temp.f9_call('public.share_my_repair_state',pg_temp.f9_id('ours_empty'),'3'),
    pg_temp.f9_error('Repair update changed, was already shared, or needs confirmation; please reload'));
SELECT pg_temp.f9_expect(pg_temp.f9_call('public.save_my_repair_state_checked',pg_temp.f9_id('ours_empty'),
    '4','partially_repaired','space'),'{"value":5}');
SELECT pg_temp.f9_expect(pg_temp.f9_call('public.share_my_repair_state',pg_temp.f9_id('ours_empty'),'5'),'{"value":true}');
SELECT pg_temp.f9_expect(pg_temp.f9_call('private.save_my_repair_state_checked_internal',pg_temp.f9_id('ours_empty'),
    '6','open','talking'),'{"value":7}');
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.event_repair_states WHERE event_id=pg_temp.f9_id('ours_empty')
                   AND user_id=auth.uid() AND report_version=7 AND repair_status='open'
                   AND what_helped IS NULL AND sharing_status='private' AND shared_at IS NULL
                   AND status_origin='explicit') THEN RAISE EXCEPTION 'Save/share/withdraw semantics changed'; END IF;
END;
$$;
RESET ROLE;
SELECT pg_temp.f9_assert_others(pg_temp.f9_id('ours_empty'),pg_temp.f9_id('a'));
ROLLBACK TO SAVEPOINT f9_ours;
RELEASE SAVEPOINT f9_ours;

SAVEPOINT f9_legacy;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f9_id('a')::text,true);
SELECT pg_temp.f9_expect(pg_temp.f9_call('public.share_my_repair_state',pg_temp.f9_id('legacy'),'1'),
    pg_temp.f9_error('Repair update changed, was already shared, or needs confirmation; please reload'));
SELECT pg_temp.f9_expect(pg_temp.f9_call('public.withdraw_my_repair_state_checked',pg_temp.f9_id('legacy'),'1'),'{"value":2}');
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.event_repair_states WHERE event_id=pg_temp.f9_id('legacy')
                   AND user_id=auth.uid() AND status_origin='legacy_default_unconfirmed'
                   AND reported_at IS NULL AND report_version=2 AND sharing_status='private') THEN
        RAISE EXCEPTION 'Withdrawal changed legacy provenance';
    END IF;
END;
$$;
SELECT pg_temp.f9_expect(pg_temp.f9_call('public.share_my_repair_state',pg_temp.f9_id('legacy'),'2'),
    pg_temp.f9_error('Repair update changed, was already shared, or needs confirmation; please reload'));
SELECT pg_temp.f9_expect(pg_temp.f9_call('public.save_my_repair_state_checked',pg_temp.f9_id('legacy'),'2'),'{"value":3}');
SELECT pg_temp.f9_expect(pg_temp.f9_call('private.share_my_repair_state_internal',pg_temp.f9_id('legacy'),'3'),'{"value":true}');
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.event_repair_states WHERE event_id=pg_temp.f9_id('legacy')
                   AND user_id=auth.uid() AND status_origin='explicit' AND reported_at IS NOT NULL
                   AND report_version=4 AND sharing_status='shared') THEN
        RAISE EXCEPTION 'Legacy confirmation did not require a deliberate save before sharing';
    END IF;
END;
$$;
RESET ROLE;
SELECT pg_temp.f9_assert_others(pg_temp.f9_id('legacy'),pg_temp.f9_id('a'));
ROLLBACK TO SAVEPOINT f9_legacy;
RELEASE SAVEPOINT f9_legacy;

SAVEPOINT f9_visibility;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f9_id('a')::text,true);
SELECT public.set_moment_visibility(pg_temp.f9_id('a_ours'),'mine',NULL);
RESET ROLE;
UPDATE pg_temp.f9_expected SET state=pg_temp.f9_snapshot();
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f9_id('b')::text,true);
SELECT pg_temp.f9_expect(pg_temp.f9_call('public.withdraw_my_repair_state_checked',pg_temp.f9_id('a_ours'),'1'),
    pg_temp.f9_error('Repair update changed; reload before withdrawing'));
SELECT pg_temp.f9_expect(pg_temp.f9_call('private.withdraw_my_repair_state_checked_internal',pg_temp.f9_id('a_ours'),'2'),'{"value":3}');
RESET ROLE;
SELECT pg_temp.f9_assert_others(pg_temp.f9_id('a_ours'),pg_temp.f9_id('b'));
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f9_id('a')::text,true);
SELECT public.set_moment_visibility(pg_temp.f9_id('a_ours'),'ours','Synthetic fresh topic');
RESET ROLE;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.event_repair_states WHERE event_id=pg_temp.f9_id('a_ours')
               AND (sharing_status<>'private' OR shared_at IS NOT NULL))
       OR EXISTS (SELECT 1 FROM public.event_perspectives WHERE event_id=pg_temp.f9_id('a_ours')
                  AND sharing_status<>'suspended') THEN RAISE EXCEPTION 'Visibility cycle automatically republished'; END IF;
END;
$$;
ROLLBACK TO SAVEPOINT f9_visibility;
RELEASE SAVEPOINT f9_visibility;
SELECT pg_temp.f9_assert_state();

-- Same simulated subject after membership deletion. Includes own hidden reports.
DELETE FROM public.couple_members WHERE couple_id=pg_temp.f9_id('couple') AND user_id=pg_temp.f9_id('a');
UPDATE pg_temp.f9_expected SET state=pg_temp.f9_snapshot();
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.f9_id('a')::text,true);
SELECT pg_temp.f9_denied(ARRAY['a_mine','a_ours','hidden_empty','legacy','ours_empty','missing']);
SELECT set_config('request.jwt.claim.sub','',true);
DO $$
DECLARE v_fn text;
BEGIN
    FOREACH v_fn IN ARRAY ARRAY[
        'public.save_my_repair_state_checked','private.save_my_repair_state_checked_internal',
        'public.share_my_repair_state','private.share_my_repair_state_internal',
        'public.withdraw_my_repair_state_checked','private.withdraw_my_repair_state_checked_internal'
    ] LOOP
        PERFORM pg_temp.f9_expect(pg_temp.f9_call(v_fn,pg_temp.f9_id('a_ours')),pg_temp.f9_error('Authentication required'));
    END LOOP;
END;
$$;
-- Retired functions must be actual permission errors, not merely filtered calls.
DO $$
DECLARE v_sql text;
BEGIN
    FOREACH v_sql IN ARRAY ARRAY[
        'SELECT public.save_my_repair_state(NULL::uuid,''open'',NULL)',
        'SELECT private.save_my_repair_state_internal(NULL::uuid,''open'',NULL)',
        'SELECT public.withdraw_my_repair_state(NULL::uuid)',
        'SELECT private.withdraw_my_repair_state_internal(NULL::uuid)'
    ] LOOP
        IF pg_temp.f9_capture(v_sql)->>'code' IS DISTINCT FROM '42501' THEN
            RAISE EXCEPTION 'Retired helper was executable';
        END IF;
    END LOOP;
END;
$$;
RESET ROLE;
SELECT pg_temp.f9_assert_state();
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub',pg_temp.f9_id('b')::text,true);
DO $$
DECLARE v_fn text;
BEGIN
    FOREACH v_fn IN ARRAY ARRAY[
        'public.save_my_repair_state_checked','private.save_my_repair_state_checked_internal',
        'public.share_my_repair_state','private.share_my_repair_state_internal',
        'public.withdraw_my_repair_state_checked','private.withdraw_my_repair_state_checked_internal'
    ] LOOP
        IF pg_temp.f9_capture(pg_temp.f9_call(v_fn,pg_temp.f9_id('a_ours')))->>'code' IS DISTINCT FROM '42501' THEN
            RAISE EXCEPTION 'Anonymous repair helper was executable';
        END IF;
    END LOOP;
END;
$$;
RESET ROLE;
SELECT pg_temp.f9_assert_state();
DO $$
BEGIN
    RAISE NOTICE 'Finding 9 sequential assertions passed; rolling back synthetic fixtures.';
END;
$$;
ROLLBACK;
