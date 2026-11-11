-- PR #7 Finding 11: fence visibility transitions against membership changes.
-- Forward-only; no application-row DML runs during installation.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = pg_catalog, public;

DO $preflight$
DECLARE v_fn record; v_table text;
BEGIN
    IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Expected postgres migration owner'; END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_proc p
        WHERE p.oid = to_regprocedure('public.set_moment_visibility(uuid,text,text)')
          AND pg_get_userbyid(p.proowner) = 'postgres' AND p.prosecdef
          AND p.proconfig = ARRAY['search_path=""']::text[]
          AND p.prorettype = 'uuid'::regtype AND NOT p.proretset
          AND p.provolatile = 'v' AND p.proparallel = 'u' AND p.prokind = 'f'
          AND NOT p.proisstrict AND NOT p.proleakproof
          AND p.prolang = (SELECT oid FROM pg_catalog.pg_language WHERE lanname = 'plpgsql')
          AND p.pronargdefaults = 1
          AND pg_get_expr(p.proargdefaults,0) = 'NULL::text'
          AND p.proargnames = ARRAY['p_event_id','p_visibility','p_shared_topic']::text[]
          AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') =
              '533a29d3121307fc5d9096dab90f985d6a06ca46675e4a077c9e9758f6f1f46c'
          AND has_function_privilege('authenticated',p.oid,'EXECUTE')
          AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
          AND NOT EXISTS (
              SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
              WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
          )
    ) OR (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
          WHERE n.nspname='public' AND p.proname='set_moment_visibility') <> 1 THEN
        RAISE EXCEPTION 'Unexpected visibility function definition/owner/configuration/ACL or overload';
    END IF;

    -- Pin the effective suspension code and Finding 8/9 prerequisites. These
    -- objects are inspected, never replaced or granted new permissions here.
    FOR v_fn IN SELECT * FROM (VALUES
        ('public.suspend_event_perspectives()','125113e2f8b4ae10d9bddf77e658fdc48fc7809676c862dcfe3a07b3a532c82c'),
        ('private.suspend_shared_repair_states()','6df208466be91129e186055ec386df8787f0d6f80e014430b934c8d5058a445b'),
        ('private.delete_relationship_event_internal(uuid)','5a70382ff135a7e4c7e63441fb7edcd45d5f5c006c9015db16b97e39ef1b255d'),
        ('private.save_my_repair_state_checked_internal(uuid,text,text,bigint)','a741e0cc0304e068efd62a76890fc74b1a3c2200ddb6fcf2e491900673c99a5f'),
        ('private.share_my_repair_state_internal(uuid,bigint)','a5d611a103d3a40bd6d43d0d7380628cac6545e5b9fb33f36c4595d638a718eb'),
        ('private.withdraw_my_repair_state_checked_internal(uuid,bigint)','595a8d84dfa0902e7922f0abc5d18ebf92b17064ee2c9ed89e9991e9aaecdc20')
    ) AS f(signature,body_hash) LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(v_fn.signature)
              AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef
              AND p.proconfig=ARRAY['search_path=""']::text[]
              AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=v_fn.body_hash
        ) THEN RAISE EXCEPTION 'Unexpected visibility prerequisite: %',v_fn.signature; END IF;
    END LOOP;

    FOREACH v_table IN ARRAY ARRAY[
        'public.relationship_events','public.couple_members','public.event_perspectives',
        'public.event_repair_states','public.event_private_reflections'
    ] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c
                       WHERE c.oid=to_regclass(v_table) AND c.relkind='r' AND c.relrowsecurity
                         AND pg_get_userbyid(c.relowner)='postgres')
           OR has_table_privilege('anon',v_table,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
           OR has_any_column_privilege('anon',v_table,'SELECT,INSERT,UPDATE') THEN
            RAISE EXCEPTION 'Unexpected visibility table/RLS/owner/anonymous grants: %',v_table;
        END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles
               WHERE rolname IN ('authenticated','anon') AND (rolsuper OR rolbypassrls))
       OR has_any_column_privilege('authenticated','public.relationship_events','UPDATE')
       OR has_table_privilege('authenticated','public.relationship_events','DELETE,TRUNCATE')
       OR EXISTS (SELECT 1 FROM pg_catalog.pg_policy
                  WHERE polrelid='public.couple_members'::regclass AND polcmd <> 'r') THEN
        RAISE EXCEPTION 'Unexpected client visibility/membership mutation or RLS bypass path';
    END IF;

    IF EXISTS (
        SELECT 1 FROM (VALUES
            ('public.relationship_events','id','uuid'),
            ('public.relationship_events','creator_id','uuid'),
            ('public.relationship_events','couple_id','uuid'),
            ('public.relationship_events','visibility','text'),
            ('public.relationship_events','shared_topic','text'),
            ('public.couple_members','couple_id','uuid'),
            ('public.couple_members','user_id','uuid'),
            ('public.event_repair_states','report_version','bigint'),
            ('public.event_repair_states','sharing_status','text'),
            ('public.event_perspectives','sharing_status','text')
        ) AS expected(relation,column_name,type_name)
        WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a
                          WHERE a.attrelid=to_regclass(expected.relation)
                            AND a.attname=expected.column_name AND NOT a.attisdropped
                            AND a.atttypid=to_regtype(expected.type_name))
    ) THEN RAISE EXCEPTION 'Unexpected visibility column types'; END IF;

    FOR v_fn IN SELECT * FROM (VALUES
        ('public.relationship_events','p',ARRAY['id']::text[]),
        ('public.couple_members','p',ARRAY['couple_id','user_id']::text[]),
        ('public.couple_members','u',ARRAY['user_id']::text[]),
        ('public.event_repair_states','p',ARRAY['event_id','user_id']::text[]),
        ('public.event_perspectives','u',ARRAY['event_id','author_id']::text[])
    ) AS expected(relation,constraint_type,columns) LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_constraint c
            WHERE c.conrelid=to_regclass(v_fn.relation) AND c.contype::text=v_fn.constraint_type
              AND c.convalidated AND NOT c.condeferrable
              AND c.conkey=ARRAY(SELECT a.attnum FROM unnest(v_fn.columns) WITH ORDINALITY AS key(name,position)
                                JOIN pg_catalog.pg_attribute a ON a.attrelid=c.conrelid AND a.attname=key.name
                                ORDER BY key.position)::smallint[]
        ) THEN RAISE EXCEPTION 'Unexpected visibility identity keys: %',v_fn.relation; END IF;
    END LOOP;

    IF (SELECT count(*) FROM pg_catalog.pg_trigger
        WHERE tgrelid='public.relationship_events'::regclass AND NOT tgisinternal) <> 2 THEN
        RAISE EXCEPTION 'Unexpected parent event trigger set';
    END IF;
    FOR v_fn IN SELECT * FROM (VALUES
        ('suspend_perspectives_when_mine','public.suspend_event_perspectives()'),
        ('suspend_repair_shares_when_event_mine','private.suspend_shared_repair_states()')
    ) AS expected(trigger_name,signature) LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_trigger t
            WHERE t.tgrelid='public.relationship_events'::regclass AND t.tgname=v_fn.trigger_name
              AND t.tgfoid=to_regprocedure(v_fn.signature) AND NOT t.tgisinternal
              AND t.tgenabled='O' AND t.tgtype=17 AND t.tgnargs=0 AND t.tgqual IS NULL
              AND t.tgattr::text=(SELECT attnum::text FROM pg_catalog.pg_attribute
                                 WHERE attrelid=t.tgrelid AND attname='visibility')
        ) THEN RAISE EXCEPTION 'Unexpected visibility suspension trigger: %',v_fn.trigger_name; END IF;
    END LOOP;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.set_moment_visibility(
    p_event_id uuid,
    p_visibility text,
    p_shared_topic text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_creator_id uuid;
    v_couple_id uuid;
    v_topic text;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_visibility IS NULL
       OR p_visibility NOT IN ('mine', 'ours') THEN
        RAISE EXCEPTION 'Invalid visibility';
    END IF;

    -- Filter ownership and snapshot membership before locking an inaccessible
    -- parent. The locked current parent and membership recheck are authoritative.
    SELECT e.creator_id, e.couple_id
    INTO v_creator_id, v_couple_id
    FROM public.relationship_events e
    WHERE e.id = p_event_id
      AND e.creator_id = v_user_id
      AND EXISTS (
          SELECT 1 FROM public.couple_members cm
          WHERE cm.couple_id = e.couple_id AND cm.user_id = v_user_id
      )
    FOR UPDATE OF e;

    IF NOT FOUND OR v_creator_id <> v_user_id THEN
        RAISE EXCEPTION 'Event unavailable';
    END IF;

    -- Parent -> current membership -> dependent rows (existing triggers).
    -- KEY SHARE fences deletion and changes to either membership identity key.
    -- Recheck after waiting; a snapshot EXISTS alone cannot fence revocation.
    PERFORM 1 FROM public.couple_members cm
    WHERE cm.couple_id = v_couple_id AND cm.user_id = v_user_id
    FOR KEY SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event unavailable';
    END IF;

    IF p_visibility = 'mine' THEN

        -- Withdrawing access also clears the previously
        -- shared topic. Private reflections are untouched.
        UPDATE public.relationship_events
        SET
            visibility = 'mine',
            shared_topic = NULL
        WHERE id = p_event_id;

    ELSE

        -- Sharing always requires freshly supplied text.
        -- No previously shared topic is automatically reused.
        v_topic := NULLIF(btrim(p_shared_topic), '');

        IF v_topic IS NULL THEN
            RAISE EXCEPTION
                'Please provide a topic to share';
        END IF;

        UPDATE public.relationship_events
        SET
            visibility = 'ours',
            shared_topic = v_topic
        WHERE id = p_event_id;

    END IF;

    RETURN p_event_id;
END;
$$;

-- CREATE OR REPLACE preserves owners/ACLs; no other RPC or trigger changes.
NOTIFY pgrst, 'reload schema';
COMMIT;
