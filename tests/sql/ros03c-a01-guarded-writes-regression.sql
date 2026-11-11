-- CANDIDATE STAGE 29. PREPARED ONLY; NEVER EXECUTED BY THIS CHANGE.
-- Requires separate authorization + independently verified NEW EMPTY isolation.
-- psql -X -v a01_candidate_authorized=1 -v expected_system_identifier=... -f this-file
-- Loopback, an authorization flag and empty tables do not prove storage isolation.
\set ON_ERROR_STOP on
\if :{?a01_candidate_authorized}
\else
\quit 3
\endif
\if :a01_candidate_authorized
\else
\quit 3
\endif
\if :{?expected_system_identifier}
\else
\quit 3
\endif
SELECT system_identifier::text=:'expected_system_identifier' AS correct_target
FROM pg_control_system() \gset
\if :correct_target
\else
\quit 3
\endif

BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
SET LOCAL timezone='UTC';
SET LOCAL row_security=on;
DO $candidate_metadata$
DECLARE f record; role_name text; table_name text;
BEGIN
    IF current_user<>'postgres' OR (SELECT array_agg(version::text ORDER BY version) FROM supabase_migrations.schema_migrations)
       IS DISTINCT FROM ARRAY['20261001000000','20261013210000','20261014154911','20261014155951','20261014193712','20261014204124','20261016100826','20261016101735','20261016144728','20261016152107','20261016155850','20261016193312','20261020120246','20261020180334','20261023090000','20261027214000','20261028184500','20261028200000','20261028220000','20261102180000','20261103200000','20261104100000','20261104120000','20261105100000','20261106120000','20261106160000','20261108120000','20261108160000','20261108180000']::text[] THEN RAISE EXCEPTION 'Exact reviewed 29-migration candidate required'; END IF;
    FOR f IN SELECT * FROM (VALUES
        ('public.create_relationship_moment(uuid,text,text,smallint,text,text,text)','f814f2847e988be25a7e642d18d8417f3faa4caa6e81e35c9631f7f52f79adf9'),
        ('private.lock_my_reflection_event_internal(uuid)','4d9314928149102d9757e4de208290891118b6fe757fbcd074b155575a02a9b5'),
        ('public.insert_my_private_reflection(uuid,text)','574e98bbad4168f346afc532262f42e08cc1f06664c118d6d0bbc48b930c4084'),
        ('public.update_my_private_reflection(uuid,text)','39273d6ff762450ce8785f48cea86013b7dc0610c60f64f02f838674fc79400e'),
        ('public.delete_my_private_reflection(uuid)','4f21fda26ed5a8ecf6ca90ce2eebef4ba719396f305182402581a8f20a84240f'),
        ('public.set_moment_visibility(uuid,text,text)','a64f2c3059ece86dca84db589857c650e14e56809b55e84a7cba30b1debc2b27'),
        ('private.delete_relationship_event_internal(uuid)','5a70382ff135a7e4c7e63441fb7edcd45d5f5c006c9015db16b97e39ef1b255d'),
        ('private.save_my_repair_state_checked_internal(uuid,text,text,bigint)','a741e0cc0304e068efd62a76890fc74b1a3c2200ddb6fcf2e491900673c99a5f'),
        ('private.share_my_repair_state_internal(uuid,bigint)','a5d611a103d3a40bd6d43d0d7380628cac6545e5b9fb33f36c4595d638a718eb'),
        ('private.withdraw_my_repair_state_checked_internal(uuid,bigint)','595a8d84dfa0902e7922f0abc5d18ebf92b17064ee2c9ed89e9991e9aaecdc20'),
        ('public.submit_event_perspective(uuid,text)','8e6588803b2dcb027ecc0e81cbe40f3f3f0402ed0c4ea80891e8e53dab5a1a3c'),
        ('public.withdraw_event_perspective(uuid)','5b5c3d51bf32d95307c32728dc3f51864e9215c2c2ec43b842ef5c5d45fb0302'),
        ('private.suspend_shared_repair_states()','6df208466be91129e186055ec386df8787f0d6f80e014430b934c8d5058a445b'),
        ('public.suspend_event_perspectives()','125113e2f8b4ae10d9bddf77e658fdc48fc7809676c862dcfe3a07b3a532c82c')
    ) AS expected(signature,hash) LOOP
        IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure(f.signature)
            AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef
            AND p.proconfig=ARRAY['search_path=""']::text[]
            AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=f.hash) THEN
            RAISE EXCEPTION 'Candidate/preserved function differs: %',f.signature;
        END IF;
    END LOOP;
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
        FOREACH table_name IN ARRAY ARRAY['public.relationship_events','public.event_private_reflections'] LOOP
            IF has_any_column_privilege(role_name,table_name,'INSERT,UPDATE')
               OR has_table_privilege(role_name,table_name,'INSERT,UPDATE,DELETE,TRUNCATE') THEN
                RAISE EXCEPTION 'Direct-write bypass remains';
            END IF;
        END LOOP;
        IF has_function_privilege(role_name,'private.lock_my_reflection_event_internal(uuid)','EXECUTE') THEN
            RAISE EXCEPTION 'Internal-only helper is client executable';
        END IF;
    END LOOP;
    FOREACH table_name IN ARRAY ARRAY['public.relationship_events','public.event_private_reflections','public.couple_members'] LOOP
        IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass(table_name) AND relrowsecurity AND NOT relforcerowsecurity
            AND pg_get_userbyid(relowner)='postgres') THEN RAISE EXCEPTION 'RLS/owner drift'; END IF;
    END LOOP;
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls)) THEN
        RAISE EXCEPTION 'Client bypass role';
    END IF;
    FOREACH table_name IN ARRAY ARRAY[
        'public.create_relationship_moment(uuid,text,text,smallint,text,text,text)',
        'public.insert_my_private_reflection(uuid,text)','public.update_my_private_reflection(uuid,text)',
        'public.delete_my_private_reflection(uuid)'
    ] LOOP
        IF NOT has_function_privilege('authenticated',table_name,'EXECUTE') OR has_function_privilege('anon',table_name,'EXECUTE')
           OR EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
               WHERE p.oid=to_regprocedure(table_name) AND a.grantee=0 AND a.privilege_type='EXECUTE') THEN
            RAISE EXCEPTION 'RPC ACL drift';
        END IF;
    END LOOP;
END;
$candidate_metadata$;

DO $empty$
DECLARE t text; nonempty boolean;
BEGIN
    FOREACH t IN ARRAY ARRAY['auth.users','public.profiles','public.couples','public.couple_members',
        'public.couple_invites','public.relationship_events','public.event_private_reflections',
        'public.event_perspectives','public.event_repair_states','private.ros03c_legacy_repair_snapshot'] LOOP
        EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s)',t) INTO nonempty;
        IF nonempty THEN RAISE EXCEPTION 'New EMPTY isolated target required: %',t; END IF;
    END LOOP;
END;
$empty$;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claims','{}',true);
CREATE TEMP TABLE a01_ids(name text PRIMARY KEY,id uuid NOT NULL DEFAULT gen_random_uuid());
INSERT INTO pg_temp.a01_ids(name) VALUES('a'),('b'),('c'),('couple'),('foreign_couple'),
    ('a_ours'),('a_mine'),('a_empty'),('b_ours'),('b_mine'),('foreign'),('missing');
GRANT SELECT ON pg_temp.a01_ids TO authenticated,anon;
CREATE FUNCTION pg_temp.a01_id(n text) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
    SELECT id FROM pg_temp.a01_ids WHERE name=n;
$$;
INSERT INTO auth.users(id) SELECT id FROM pg_temp.a01_ids WHERE name IN('a','b','c');
INSERT INTO public.couples(id,created_by) VALUES(pg_temp.a01_id('couple'),pg_temp.a01_id('a')),
    (pg_temp.a01_id('foreign_couple'),pg_temp.a01_id('c'));
INSERT INTO public.couple_members(couple_id,user_id) VALUES(pg_temp.a01_id('couple'),pg_temp.a01_id('b'));
INSERT INTO public.relationship_events(id,couple_id,creator_id,event_type,category,intensity,visibility,shared_topic)
SELECT id,pg_temp.a01_id(CASE WHEN name='foreign' THEN 'foreign_couple' ELSE 'couple' END),
    pg_temp.a01_id(CASE WHEN name='foreign' THEN 'c' WHEN name LIKE 'b_%' THEN 'b' ELSE 'a' END),
    'friction','a01-synthetic',3,CASE WHEN name LIKE '%mine' THEN 'mine' ELSE 'ours' END,
    CASE WHEN name LIKE '%mine' THEN NULL ELSE 'Synthetic shared topic' END
FROM pg_temp.a01_ids WHERE name IN('a_ours','a_mine','a_empty','b_ours','b_mine','foreign');
INSERT INTO public.event_private_reflections(event_id,author_id,note)
SELECT id,creator_id,'Original private note' FROM public.relationship_events
WHERE id<>pg_temp.a01_id('a_empty') AND creator_id<>pg_temp.a01_id('b');
INSERT INTO public.event_perspectives(event_id,author_id,perspective_text,sharing_status)
SELECT id,creator_id,'Independent perspective',CASE WHEN visibility='mine' THEN 'suspended' ELSE 'submitted' END
FROM public.relationship_events;
INSERT INTO public.event_repair_states(event_id,user_id,repair_status)
SELECT id,creator_id,'open' FROM public.relationship_events;
INSERT INTO private.ros03c_legacy_repair_snapshot(event_id,repair_status)
SELECT id,'open' FROM public.relationship_events;

CREATE FUNCTION pg_temp.a01_snapshot() RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t text; v_rows jsonb; result jsonb:='{}';
BEGIN
    IF current_user<>'postgres' THEN RAISE EXCEPTION 'Owner snapshot required'; END IF;
    FOREACH t IN ARRAY ARRAY['auth.users','public.profiles','public.couples','public.couple_members',
        'public.couple_invites','public.relationship_events','public.event_private_reflections',
        'public.event_perspectives','public.event_repair_states','private.ros03c_legacy_repair_snapshot'] LOOP
        EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),''[]''::jsonb) FROM %s r',t) INTO v_rows;
        result:=result||jsonb_build_object(t,v_rows);
    END LOOP;
    RETURN result;
END; $$;
CREATE TEMP TABLE a01_expected AS SELECT pg_temp.a01_snapshot() AS state;
CREATE TEMP TABLE a01_results(name text PRIMARY KEY,value jsonb);
GRANT INSERT,SELECT ON pg_temp.a01_results TO authenticated;
CREATE FUNCTION pg_temp.a01_check(expected jsonb DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE canonical jsonb;
BEGIN
    IF current_user<>'postgres' THEN RAISE EXCEPTION 'Owner verification required'; END IF;
    expected:=coalesce(expected,(SELECT state FROM pg_temp.a01_expected));
    SELECT jsonb_object_agg(key,(SELECT coalesce(jsonb_agg(item ORDER BY item::text),'[]'::jsonb)
        FROM jsonb_array_elements(value) r(item))) INTO canonical FROM jsonb_each(expected);
    IF pg_temp.a01_snapshot() IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'Unexpected parent/child/partner/identity changes'; END IF;
    UPDATE pg_temp.a01_expected SET state=canonical;
END; $$;
CREATE FUNCTION pg_temp.a01_capture(statement text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE answer jsonb; code text; message text; details text; hint text;
BEGIN
    EXECUTE statement INTO answer;
    RETURN jsonb_build_object('value',answer);
EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS code=RETURNED_SQLSTATE,message=MESSAGE_TEXT,details=PG_EXCEPTION_DETAIL,hint=PG_EXCEPTION_HINT;
    RETURN jsonb_build_object('code',code,'message',message,'details',details,'hint',hint);
END; $$;
CREATE FUNCTION pg_temp.a01_error(message text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
    SELECT jsonb_build_object('code','P0001','message',message,'details','','hint','');
$$;
CREATE FUNCTION pg_temp.a01_expect(statement text,expected jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
    IF pg_temp.a01_capture(statement) IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Unexpected outcome for %',statement; END IF;
END; $$;
CREATE FUNCTION pg_temp.a01_permission(statement text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
    IF pg_temp.a01_capture(statement)->>'code' IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'Expected privilege denial for %',statement; END IF;
END; $$;
CREATE FUNCTION pg_temp.a01_denied(targets text[]) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE n text; note text;
BEGIN
    FOREACH n IN ARRAY targets LOOP
        FOREACH note IN ARRAY ARRAY[NULL::text,'','  exact  '] LOOP
            PERFORM pg_temp.a01_expect(format('SELECT to_jsonb(public.insert_my_private_reflection(%L::uuid,%L::text))',pg_temp.a01_id(n),note),pg_temp.a01_error('Event unavailable'));
            PERFORM pg_temp.a01_expect(format('SELECT to_jsonb(public.update_my_private_reflection(%L::uuid,%L::text))',pg_temp.a01_id(n),note),pg_temp.a01_error('Event unavailable'));
        END LOOP;
        PERFORM pg_temp.a01_expect(format('SELECT to_jsonb(public.delete_my_private_reflection(%L::uuid))',pg_temp.a01_id(n)),pg_temp.a01_error('Event unavailable'));
    END LOOP;
END; $$;
CREATE FUNCTION pg_temp.a01_reflection_effect(target uuid,actor uuid,operation text,note text,result_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE expected jsonb; v_rows jsonb; new_row jsonb;
BEGIN
    SELECT state INTO expected FROM pg_temp.a01_expected;
    IF operation='insert' THEN
        IF result_id IS NULL THEN RAISE EXCEPTION 'Missing actual insert identity'; END IF;
        new_row:=jsonb_build_object('id',result_id,'event_id',target,'author_id',actor,'note',note,'created_at',now(),'updated_at',now());
        v_rows:=(expected->'public.event_private_reflections')||jsonb_build_array(new_row);
    ELSE
        SELECT coalesce(jsonb_agg(CASE WHEN item->>'event_id'=target::text AND item->>'author_id'=actor::text
            THEN item||jsonb_build_object('note',note,'updated_at',now()) ELSE item END),'[]'::jsonb)
        INTO v_rows FROM jsonb_array_elements(expected->'public.event_private_reflections') r(item)
        WHERE operation<>'delete' OR NOT(item->>'event_id'=target::text AND item->>'author_id'=actor::text);
    END IF;
    PERFORM pg_temp.a01_check(jsonb_set(expected,'{public.event_private_reflections}',v_rows));
END; $$;
CREATE FUNCTION pg_temp.a01_creation_effect(target uuid,actor uuid,event_type text,category text,intensity smallint,visibility text,note text,topic text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE expected jsonb; reflection_id uuid; new_event jsonb;
BEGIN
    SELECT state INTO expected FROM pg_temp.a01_expected;
    IF target IS NULL THEN RAISE EXCEPTION 'Missing actual creation UUID'; END IF;
    new_event:=jsonb_build_object('id',target,'couple_id',pg_temp.a01_id('couple'),'creator_id',actor,'event_type',event_type,
        'category',btrim(category),'intensity',CASE WHEN event_type='friction' THEN intensity ELSE NULL END,
        'visibility',visibility,'shared_topic',nullif(btrim(topic),''),'created_at',now());
    expected:=jsonb_set(expected,'{public.relationship_events}',(expected->'public.relationship_events')||jsonb_build_array(new_event));
    IF nullif(btrim(note),'') IS NOT NULL THEN
        SELECT id INTO reflection_id FROM public.event_private_reflections WHERE event_id=target AND author_id=actor;
        IF reflection_id IS NULL THEN RAISE EXCEPTION 'Atomic reflection absent'; END IF;
        expected:=jsonb_set(expected,'{public.event_private_reflections}',(expected->'public.event_private_reflections')||jsonb_build_array(
            jsonb_build_object('id',reflection_id,'event_id',target,'author_id',actor,'note',btrim(note),'created_at',now(),'updated_at',now())));
    END IF;
    PERFORM pg_temp.a01_check(expected);
END; $$;

-- No authenticated SQL shape can bypass the replacements, even on own rows.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.a01_id('a')::text,true);
SELECT pg_temp.a01_permission(format('INSERT INTO public.relationship_events(couple_id,creator_id,event_type,category,visibility) VALUES(%L,auth.uid(),''positive'',''forbidden'',''mine'')',pg_temp.a01_id('couple')));
SELECT pg_temp.a01_permission(format('INSERT INTO public.event_private_reflections(event_id,author_id,note) VALUES(%L,auth.uid(),''forbidden'')',pg_temp.a01_id('a_empty')));
SELECT pg_temp.a01_permission('UPDATE public.event_private_reflections SET note=''forbidden'',updated_at=now()');
SELECT pg_temp.a01_permission('DELETE FROM public.event_private_reflections');
SELECT pg_temp.a01_permission(format('INSERT INTO public.event_private_reflections(id,event_id,author_id,note,created_at,updated_at) VALUES(gen_random_uuid(),%L,auth.uid(),''forbidden'',now(),now()) ON CONFLICT(event_id,author_id) DO UPDATE SET note=EXCLUDED.note',pg_temp.a01_id('a_ours')));
SELECT pg_temp.a01_permission(format('INSERT INTO public.event_private_reflections(id,event_id,author_id,note) SELECT id,%L,auth.uid(),''forbidden'' FROM public.event_private_reflections WHERE event_id=%L ON CONFLICT(id) DO UPDATE SET note=EXCLUDED.note',pg_temp.a01_id('a_empty'),pg_temp.a01_id('a_ours')));
SELECT pg_temp.a01_permission('SELECT private.lock_my_reflection_event_internal(NULL::uuid)');
-- Parent authorization precedes NULL/content errors; missing and inaccessible agree.
SELECT pg_temp.a01_denied(ARRAY['b_ours','b_mine','foreign','missing','null']);
SELECT set_config('request.jwt.claim.sub',pg_temp.a01_id('b')::text,true);
SELECT pg_temp.a01_denied(ARRAY['a_ours','a_mine','foreign','missing','null']);
SELECT set_config('request.jwt.claim.sub',pg_temp.a01_id('c')::text,true);
SELECT pg_temp.a01_denied(ARRAY['a_ours','a_mine','b_ours','missing','null']);
SELECT pg_temp.a01_expect(format('SELECT to_jsonb(public.create_relationship_moment(%L,''positive'',''no'',NULL::smallint,''mine''))',pg_temp.a01_id('couple')),pg_temp.a01_error('Relationship membership required'));
RESET ROLE;
SELECT pg_temp.a01_check();

-- Creator explicit reflection INSERT preserves whitespace; editing preserves IDs.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.a01_id('a')::text,true);
INSERT INTO pg_temp.a01_results VALUES('insert',to_jsonb(public.insert_my_private_reflection(pg_temp.a01_id('a_empty'),'  exact whitespace  ')));
RESET ROLE;
SELECT pg_temp.a01_reflection_effect(pg_temp.a01_id('a_empty'),pg_temp.a01_id('a'),'insert','  exact whitespace  ',
    (SELECT (value#>>'{}')::uuid FROM pg_temp.a01_results WHERE name='insert'));
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.a01_id('a')::text,true);
SELECT pg_temp.a01_expect(format('SELECT to_jsonb(public.insert_my_private_reflection(%L,''overwrite''))',pg_temp.a01_id('a_empty')),pg_temp.a01_error('Private reflection already exists'));
SELECT pg_temp.a01_expect(format('SELECT to_jsonb(public.update_my_private_reflection(%L,NULL::text))',pg_temp.a01_id('a_empty')),pg_temp.a01_error('Reflection note is required'));
SELECT pg_temp.a01_expect(format('SELECT to_jsonb(public.insert_my_private_reflection(%L,NULL::text))',pg_temp.a01_id('a_mine')),pg_temp.a01_error('Reflection note is required'));
RESET ROLE;
SELECT pg_temp.a01_check();
-- Give updated_at a distinct old value so omitting its server update cannot pass
-- merely because now() is stable throughout this outer test transaction.
UPDATE public.event_private_reflections SET updated_at='2000-01-01T00:00:00Z'
WHERE event_id=pg_temp.a01_id('a_empty') AND author_id=pg_temp.a01_id('a');
UPDATE pg_temp.a01_expected SET state=jsonb_set(state,'{public.event_private_reflections}',
    (SELECT jsonb_agg(CASE WHEN item->>'event_id'=pg_temp.a01_id('a_empty')::text AND item->>'author_id'=pg_temp.a01_id('a')::text
        THEN item||jsonb_build_object('updated_at','2000-01-01T00:00:00Z'::timestamptz) ELSE item END)
     FROM jsonb_array_elements(state->'public.event_private_reflections') r(item)));
SELECT pg_temp.a01_check();
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.a01_id('a')::text,true);
INSERT INTO pg_temp.a01_results VALUES('update',to_jsonb(public.update_my_private_reflection(pg_temp.a01_id('a_empty'),'')));
RESET ROLE;
DO $$ BEGIN
    IF (SELECT value FROM pg_temp.a01_results WHERE name='update') IS DISTINCT FROM (SELECT value FROM pg_temp.a01_results WHERE name='insert') THEN RAISE EXCEPTION 'Edit changed reflection identity'; END IF;
END; $$;
SELECT pg_temp.a01_reflection_effect(pg_temp.a01_id('a_empty'),pg_temp.a01_id('a'),'update','');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.a01_id('a')::text,true);
SELECT pg_temp.a01_expect(format('SELECT to_jsonb(public.delete_my_private_reflection(%L))',pg_temp.a01_id('a_empty')),'{"value":true}');
SELECT pg_temp.a01_expect(format('SELECT to_jsonb(public.delete_my_private_reflection(%L))',pg_temp.a01_id('a_empty')),'{"value":false}');
SELECT pg_temp.a01_expect(format('SELECT to_jsonb(public.update_my_private_reflection(%L,''missing''))',pg_temp.a01_id('a_empty')),pg_temp.a01_error('Private reflection not found'));
RESET ROLE;
SELECT pg_temp.a01_reflection_effect(pg_temp.a01_id('a_empty'),pg_temp.a01_id('a'),'delete',NULL);

-- Partner retains the SAME creator capabilities on their own Mine parent.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.a01_id('b')::text,true);
INSERT INTO pg_temp.a01_results VALUES('b_insert',to_jsonb(public.insert_my_private_reflection(pg_temp.a01_id('b_mine'),'')));
RESET ROLE;
SELECT pg_temp.a01_reflection_effect(pg_temp.a01_id('b_mine'),pg_temp.a01_id('b'),'insert','',
    (SELECT (value#>>'{}')::uuid FROM pg_temp.a01_results WHERE name='b_insert'));
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.a01_id('b')::text,true);
INSERT INTO pg_temp.a01_results VALUES('b_edit',to_jsonb(public.update_my_private_reflection(pg_temp.a01_id('b_mine'),'   ')));
RESET ROLE;
SELECT pg_temp.a01_reflection_effect(pg_temp.a01_id('b_mine'),pg_temp.a01_id('b'),'update','   ');

-- Creation uses unchanged defaults/UUID and atomic optional-note semantics.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.a01_id('a')::text,true);
INSERT INTO pg_temp.a01_results VALUES('new_note',to_jsonb(public.create_relationship_moment(pg_temp.a01_id('couple'),'friction','  test category  ',3::smallint,'ours','  trimmed note  ','  shared topic  ')));
RESET ROLE;
SELECT pg_temp.a01_creation_effect((SELECT (value#>>'{}')::uuid FROM pg_temp.a01_results WHERE name='new_note'),pg_temp.a01_id('a'),'friction','test category',3::smallint,'ours','trimmed note','shared topic');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.a01_id('b')::text,true);
INSERT INTO pg_temp.a01_results VALUES('new_default',to_jsonb(public.create_relationship_moment(pg_temp.a01_id('couple'),'positive','default args',5::smallint,'mine')));
RESET ROLE;
SELECT pg_temp.a01_creation_effect((SELECT (value#>>'{}')::uuid FROM pg_temp.a01_results WHERE name='new_default'),pg_temp.a01_id('b'),'positive','default args',5::smallint,'mine',NULL,NULL);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.a01_id('a')::text,true);
INSERT INTO pg_temp.a01_results VALUES('new_blank',to_jsonb(public.create_relationship_moment(pg_temp.a01_id('couple'),'positive','blank note',NULL::smallint,'ours','   ','   ')));
RESET ROLE;
SELECT pg_temp.a01_creation_effect((SELECT (value#>>'{}')::uuid FROM pg_temp.a01_results WHERE name='new_blank'),pg_temp.a01_id('a'),'positive','blank note',NULL::smallint,'ours','   ','   ');

-- Preserve creation's reviewed validation messages/order; these are input-only.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.a01_id('a')::text,true);
DO $$ DECLARE q text; expected text;
BEGIN
    FOR q,expected IN SELECT * FROM (VALUES
        ('SELECT to_jsonb(public.create_relationship_moment(NULL,''positive'',''x'',NULL::smallint,NULL))','Invalid visibility'),
        ('SELECT to_jsonb(public.create_relationship_moment(NULL,''bad'',''x'',NULL::smallint,''mine''))','Invalid event type'),
        ('SELECT to_jsonb(public.create_relationship_moment(NULL,''positive'',''   '',NULL::smallint,''mine''))','Category is required'),
        ('SELECT to_jsonb(public.create_relationship_moment(NULL,''friction'',''x'',0::smallint,''mine''))','Friction intensity must be between 1 and 5'),
        ('SELECT to_jsonb(public.create_relationship_moment(NULL,''positive'',''x'',NULL::smallint,''mine'',NULL,''not private''))','Private moments cannot contain shared topics')
    ) AS cases(statement,message) LOOP PERFORM pg_temp.a01_expect(q,pg_temp.a01_error(expected)); END LOOP;
END; $$;
RESET ROLE;
SELECT pg_temp.a01_check();

-- A synthetic post-parent child failure must roll back the entire creation call.
SAVEPOINT atomic_failure;
CREATE FUNCTION public.a01_candidate_test_abort_note() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN IF NEW.note='Synthetic abort note' THEN RAISE EXCEPTION 'Synthetic reflection insert failed'; END IF; RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public.a01_candidate_test_abort_note() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER a01_candidate_abort_note BEFORE INSERT ON public.event_private_reflections
FOR EACH ROW EXECUTE FUNCTION public.a01_candidate_test_abort_note();
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.a01_id('a')::text,true);
SELECT pg_temp.a01_expect(format('SELECT to_jsonb(public.create_relationship_moment(%L,''positive'',''must rollback'',NULL::smallint,''mine'',''Synthetic abort note''))',pg_temp.a01_id('couple')),pg_temp.a01_error('Synthetic reflection insert failed'));
RESET ROLE;
SELECT pg_temp.a01_check();
ROLLBACK TO SAVEPOINT atomic_failure;

-- New RPCs never alter SELECT privacy, including partner/unrelated/anonymous reads.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.a01_id('b')::text,true);
DO $$ BEGIN
    IF EXISTS(SELECT 1 FROM public.event_private_reflections WHERE author_id<>auth.uid()) THEN RAISE EXCEPTION 'Private reflection read leak'; END IF;
END; $$;
RESET ROLE;
SELECT pg_temp.a01_check();

-- Owner-side fixture mutation is explicit; denied former-member calls preserve it.
DELETE FROM public.couple_members WHERE user_id=pg_temp.a01_id('a');
UPDATE pg_temp.a01_expected SET state=pg_temp.a01_snapshot();
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.a01_id('a')::text,true);
SELECT pg_temp.a01_denied(ARRAY['a_ours','a_mine','a_empty','missing','null']);
SELECT pg_temp.a01_expect(format('SELECT to_jsonb(public.create_relationship_moment(%L,''positive'',''no'',NULL::smallint,''mine''))',pg_temp.a01_id('couple')),pg_temp.a01_error('Relationship membership required'));
SELECT pg_temp.a01_expect('SELECT to_jsonb(count(*)) FROM public.event_private_reflections','{"value":0}');
RESET ROLE;
SELECT pg_temp.a01_check();
INSERT INTO public.couple_members(couple_id,user_id) VALUES(pg_temp.a01_id('foreign_couple'),pg_temp.a01_id('a'));
UPDATE pg_temp.a01_expected SET state=pg_temp.a01_snapshot();
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',pg_temp.a01_id('a')::text,true);
SELECT pg_temp.a01_denied(ARRAY['a_ours','a_mine','a_empty']);
SELECT set_config('request.jwt.claim.sub','',true);
SELECT pg_temp.a01_expect('SELECT to_jsonb(public.create_relationship_moment(NULL,''bad'',NULL,NULL::smallint,NULL))',pg_temp.a01_error('Authentication required'));
SELECT pg_temp.a01_expect('SELECT to_jsonb(public.insert_my_private_reflection(NULL,NULL))',pg_temp.a01_error('Authentication required'));
SELECT pg_temp.a01_expect('SELECT to_jsonb(public.update_my_private_reflection(NULL,NULL))',pg_temp.a01_error('Authentication required'));
SELECT pg_temp.a01_expect('SELECT to_jsonb(public.delete_my_private_reflection(NULL))',pg_temp.a01_error('Authentication required'));
RESET ROLE;
SELECT pg_temp.a01_check();
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub',pg_temp.a01_id('a')::text,true);
SELECT pg_temp.a01_permission('SELECT public.create_relationship_moment(NULL,''positive'',''no'',NULL::smallint,''mine'')');
SELECT pg_temp.a01_permission('SELECT public.insert_my_private_reflection(NULL,NULL)');
SELECT pg_temp.a01_permission('SELECT public.update_my_private_reflection(NULL,NULL)');
SELECT pg_temp.a01_permission('SELECT public.delete_my_private_reflection(NULL)');
SELECT pg_temp.a01_permission('SELECT private.lock_my_reflection_event_internal(NULL)');
SELECT pg_temp.a01_permission('SELECT * FROM public.event_private_reflections');
SELECT pg_temp.a01_permission('UPDATE public.event_private_reflections SET note=''forbidden''');
RESET ROLE;
SELECT pg_temp.a01_check();
DO $$ BEGIN RAISE NOTICE 'Candidate sequential assertions completed; rolling back all fixtures. This is not concurrency/HTTP acceptance.'; END; $$;
ROLLBACK;
