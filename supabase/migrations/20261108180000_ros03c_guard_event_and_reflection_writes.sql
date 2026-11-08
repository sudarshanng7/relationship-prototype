-- A01 CANDIDATE ONLY: guarded event/reflection writes; integration not approved.
-- Forward-only, following 20261108160000. No application-row DML on installation.
-- Retires authenticated direct event INSERT and reflection INSERT/UPDATE/DELETE.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = pg_catalog, public;
LOCK TABLE public.relationship_events, public.event_private_reflections IN ACCESS EXCLUSIVE MODE;

DO $preflight$
DECLARE v_fn record; v_table text;
BEGIN
    IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Expected postgres migration owner'; END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        WHERE p.oid=to_regprocedure('public.create_relationship_moment(uuid,text,text,smallint,text,text,text)')
          AND pg_get_userbyid(p.proowner)='postgres' AND NOT p.prosecdef
          AND p.proconfig=ARRAY['search_path=""']::text[]
          AND p.prorettype='uuid'::regtype AND NOT p.proretset AND p.prokind='f'
          AND p.provolatile='v' AND NOT p.proisstrict AND NOT p.proleakproof AND p.proparallel='u'
          AND p.prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql')
          AND p.pronargdefaults=2
          AND regexp_replace(pg_get_expr(p.proargdefaults,0),'[[:space:]]','','g')='NULL::text,NULL::text'
          AND p.proargnames=ARRAY['p_couple_id','p_event_type','p_category','p_intensity','p_visibility','p_private_note','p_shared_topic']::text[]
          AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='8d82f24275a7475c00b05cf8e0320f9ef07fcfa4c78c3dd5271fad0869d96374'
          AND has_function_privilege('authenticated',p.oid,'EXECUTE')
          AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
          AND NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
                          WHERE a.grantee=0 AND a.privilege_type='EXECUTE')
    ) OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
          WHERE n.nspname='public' AND p.proname='create_relationship_moment')<>1 THEN
        RAISE EXCEPTION 'Unexpected creation predecessor definition/owner/defaults/ACL/overload';
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE (n.nspname='public' AND p.proname IN (
            'insert_my_private_reflection','update_my_private_reflection','delete_my_private_reflection'))
           OR (n.nspname='private' AND p.proname='lock_my_reflection_event_internal')
    ) THEN RAISE EXCEPTION 'A01 candidate function names already exist; review partial installation'; END IF;

    -- Pin the guarded operations this candidate must not silently replace.
    FOR v_fn IN SELECT * FROM (VALUES
        ('public.set_moment_visibility(uuid,text,text)','a64f2c3059ece86dca84db589857c650e14e56809b55e84a7cba30b1debc2b27'),
        ('private.delete_relationship_event_internal(uuid)','5a70382ff135a7e4c7e63441fb7edcd45d5f5c006c9015db16b97e39ef1b255d'),
        ('private.save_my_repair_state_checked_internal(uuid,text,text,bigint)','a741e0cc0304e068efd62a76890fc74b1a3c2200ddb6fcf2e491900673c99a5f'),
        ('private.share_my_repair_state_internal(uuid,bigint)','a5d611a103d3a40bd6d43d0d7380628cac6545e5b9fb33f36c4595d638a718eb'),
        ('private.withdraw_my_repair_state_checked_internal(uuid,bigint)','595a8d84dfa0902e7922f0abc5d18ebf92b17064ee2c9ed89e9991e9aaecdc20'),
        ('public.submit_event_perspective(uuid,text)','8e6588803b2dcb027ecc0e81cbe40f3f3f0402ed0c4ea80891e8e53dab5a1a3c'),
        ('public.withdraw_event_perspective(uuid)','5b5c3d51bf32d95307c32728dc3f51864e9215c2c2ec43b842ef5c5d45fb0302'),
        ('private.suspend_shared_repair_states()','6df208466be91129e186055ec386df8787f0d6f80e014430b934c8d5058a445b'),
        ('public.suspend_event_perspectives()','125113e2f8b4ae10d9bddf77e658fdc48fc7809676c862dcfe3a07b3a532c82c')
    ) AS f(signature,body_hash) LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure(v_fn.signature)
              AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef
              AND p.proconfig=ARRAY['search_path=""']::text[]
              AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=v_fn.body_hash
        ) THEN RAISE EXCEPTION 'Unexpected guarded predecessor: %',v_fn.signature; END IF;
    END LOOP;
    FOREACH v_table IN ARRAY ARRAY['public.relationship_events','public.event_private_reflections','public.couple_members'] LOOP
        IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass(v_table) AND relkind='r'
                      AND relrowsecurity AND NOT relforcerowsecurity AND pg_get_userbyid(relowner)='postgres')
           OR has_any_column_privilege('anon',v_table,'SELECT,INSERT,UPDATE')
           OR has_table_privilege('anon',v_table,'DELETE,TRUNCATE') THEN
            RAISE EXCEPTION 'Unexpected A01 table/owner/RLS/anonymous privileges: %',v_table;
        END IF;
    END LOOP;
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('authenticated','anon') AND (rolsuper OR rolbypassrls))
       OR has_any_column_privilege('authenticated','public.relationship_events','UPDATE')
       OR has_table_privilege('authenticated','public.relationship_events','DELETE,TRUNCATE')
       OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.couple_members'::regclass AND polcmd<>'r')
       OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.event_private_reflections'::regclass AND NOT tgisinternal)
       OR NOT has_table_privilege('authenticated','public.event_private_reflections','SELECT')
       OR NOT has_table_privilege('authenticated','public.event_private_reflections','INSERT')
       OR NOT has_table_privilege('authenticated','public.event_private_reflections','DELETE')
       OR NOT has_column_privilege('authenticated','public.event_private_reflections','note','UPDATE')
       OR NOT has_column_privilege('authenticated','public.event_private_reflections','updated_at','UPDATE') THEN
        RAISE EXCEPTION 'Unexpected A01 client mutation or trigger prerequisites';
    END IF;
    -- Count/name/role metadata is checked; actual target policy expressions still
    -- require the separately approved deployment audit. Policies are not replaced.
    IF (SELECT count(*) FROM pg_policy WHERE polrelid='public.event_private_reflections'::regclass)<>4
       OR EXISTS(SELECT 1 FROM (VALUES
           ('Authors can read private reflections','r'),('Creators can add private reflections','a'),
           ('Authors can update private reflections','w'),('Authors can delete private reflections','d')
       ) AS expected(name,command) WHERE NOT EXISTS(
           SELECT 1 FROM pg_policy p WHERE p.polrelid='public.event_private_reflections'::regclass
             AND p.polname=expected.name AND p.polcmd::text=expected.command AND p.polpermissive
             AND p.polroles=ARRAY[(SELECT oid FROM pg_roles WHERE rolname='authenticated')]::oid[]
       )) THEN RAISE EXCEPTION 'Unexpected reflection policies'; END IF;
    IF EXISTS(SELECT 1 FROM (VALUES
        ('public.couple_members','p',ARRAY['couple_id','user_id']::text[]),
        ('public.couple_members','u',ARRAY['user_id']::text[]),
        ('public.relationship_events','p',ARRAY['id']::text[]),
        ('public.event_private_reflections','p',ARRAY['id']::text[]),
        ('public.event_private_reflections','u',ARRAY['event_id','author_id']::text[])
    ) AS expected(relation,kind,columns) WHERE NOT EXISTS(
        SELECT 1 FROM pg_constraint c WHERE c.conrelid=to_regclass(expected.relation)
          AND c.contype::text=expected.kind AND c.convalidated AND NOT c.condeferrable
          AND c.conkey=ARRAY(SELECT a.attnum FROM unnest(expected.columns) WITH ORDINALITY AS k(name,position)
              JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attname=k.name ORDER BY k.position)::smallint[]
    )) THEN RAISE EXCEPTION 'Unexpected A01 identity constraints'; END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.event_private_reflections'::regclass
        AND c.contype='f' AND c.confrelid='public.relationship_events'::regclass
        AND c.confdeltype='c' AND c.convalidated AND NOT c.condeferrable
        AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='event_id')]::smallint[]
        AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.confrelid AND attname='id')]::smallint[]
    ) THEN RAISE EXCEPTION 'Expected reflection event cascade'; END IF;
END;
$preflight$;

-- Creation remains the SAME public API; explicit authorization replaces invoker
-- INSERT RLS because direct client grants are retired atomically below.
CREATE OR REPLACE FUNCTION public.create_relationship_moment(
    p_couple_id uuid,
    p_event_type text,
    p_category text,
    p_intensity smallint,
    p_visibility text,
    p_private_note text DEFAULT NULL,
    p_shared_topic text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_event_id uuid;
    v_private_note text;
    v_shared_topic text;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_visibility NOT IN ('mine', 'ours')
       OR p_visibility IS NULL THEN
        RAISE EXCEPTION 'Invalid visibility';
    END IF;

    IF p_event_type NOT IN ('positive', 'friction')
       OR p_event_type IS NULL THEN
        RAISE EXCEPTION 'Invalid event type';
    END IF;

    IF p_category IS NULL OR trim(p_category) = '' THEN
        RAISE EXCEPTION 'Category is required';
    END IF;

    IF p_event_type = 'friction'
       AND (p_intensity IS NULL OR p_intensity NOT BETWEEN 1 AND 5)
    THEN
        RAISE EXCEPTION 'Friction intensity must be between 1 and 5';
    END IF;

    v_private_note := NULLIF(trim(p_private_note), '');
    v_shared_topic := NULLIF(trim(p_shared_topic), '');

    IF p_visibility = 'mine' AND v_shared_topic IS NOT NULL THEN
        RAISE EXCEPTION 'Private moments cannot contain shared topics';
    END IF;

    -- VOLATILE locking read rechecks the current membership after any wait.
    -- Hold it until the whole creation transaction (including note) completes.
    PERFORM 1 FROM public.couple_members cm
    WHERE cm.couple_id = p_couple_id AND cm.user_id = v_user_id
    FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Relationship membership required'; END IF;

    -- Caller identity and membership are enforced explicitly above.
    -- Legacy repair columns are intentionally not populated.
    INSERT INTO public.relationship_events (
        couple_id,
        creator_id,
        event_type,
        category,
        intensity,
        visibility,
        shared_topic
    )
    VALUES (
        p_couple_id,
        v_user_id,
        p_event_type,
        trim(p_category),
        CASE
            WHEN p_event_type = 'friction' THEN p_intensity
            ELSE NULL
        END,
        p_visibility,
        v_shared_topic
    )
    RETURNING id INTO v_event_id;

    -- Same guarded transaction; note ownership comes only from auth.uid().
    IF v_private_note IS NOT NULL THEN
        INSERT INTO public.event_private_reflections (
            event_id,
            author_id,
            note
        )
        VALUES (
            v_event_id,
            v_user_id,
            v_private_note
        );
    END IF;

    RETURN v_event_id;
END;
$$;

-- Internal authorization primitive, not an authenticated/private RPC surface.
-- Every existing-parent mutation calls it BEFORE touching a reflection tuple.
CREATE FUNCTION private.lock_my_reflection_event_internal(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_user uuid := auth.uid();
    v_couple uuid;
BEGIN
    IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    SELECT e.couple_id INTO v_couple
    FROM public.relationship_events e
    WHERE e.id=p_event_id AND e.creator_id=v_user
      AND EXISTS(SELECT 1 FROM public.couple_members cm
                 WHERE cm.couple_id=e.couple_id AND cm.user_id=v_user)
    FOR SHARE OF e;
    IF NOT FOUND THEN RAISE EXCEPTION 'Event unavailable'; END IF;
    PERFORM 1 FROM public.couple_members cm
    WHERE cm.couple_id=v_couple AND cm.user_id=v_user FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Event unavailable'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.lock_my_reflection_event_internal(uuid)
FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.insert_my_private_reflection(p_event_id uuid,p_note text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_user uuid := auth.uid(); v_id uuid;
BEGIN
    PERFORM private.lock_my_reflection_event_internal(p_event_id);
    IF p_note IS NULL THEN RAISE EXCEPTION 'Reflection note is required'; END IF;
    -- INSERT only. A duplicate never replaces or confirms existing content.
    INSERT INTO public.event_private_reflections(event_id,author_id,note)
    VALUES(p_event_id,v_user,p_note)
    ON CONFLICT(event_id,author_id) DO NOTHING RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Private reflection already exists'; END IF;
    RETURN v_id;
END;
$$;

CREATE FUNCTION public.update_my_private_reflection(p_event_id uuid,p_note text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_user uuid := auth.uid(); v_id uuid;
BEGIN
    PERFORM private.lock_my_reflection_event_internal(p_event_id);
    IF p_note IS NULL THEN RAISE EXCEPTION 'Reflection note is required'; END IF;
    UPDATE public.event_private_reflections SET note=p_note,updated_at=now()
    WHERE event_id=p_event_id AND author_id=v_user RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Private reflection not found'; END IF;
    RETURN v_id;
END;
$$;

CREATE FUNCTION public.delete_my_private_reflection(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_user uuid := auth.uid(); v_id uuid;
BEGIN
    PERFORM private.lock_my_reflection_event_internal(p_event_id);
    DELETE FROM public.event_private_reflections
    WHERE event_id=p_event_id AND author_id=v_user RETURNING id INTO v_id;
    RETURN v_id IS NOT NULL;
END;
$$;

-- Existing public creation owner and service-role ACL survive replacement.
-- New public functions retain the reviewed schema's trusted-role defaults.
REVOKE ALL ON FUNCTION public.create_relationship_moment(uuid,text,text,smallint,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_relationship_moment(uuid,text,text,smallint,text,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.insert_my_private_reflection(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.update_my_private_reflection(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.delete_my_private_reflection(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.insert_my_private_reflection(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_private_reflection(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_private_reflection(uuid) TO authenticated;

-- Table revocations also revoke corresponding column privileges in PostgreSQL.
-- Explicit column revocation documents the known bypasses being retired.
REVOKE INSERT ON TABLE public.relationship_events FROM PUBLIC,anon,authenticated;
REVOKE INSERT(couple_id,creator_id,event_type,category,intensity,visibility,shared_topic)
ON TABLE public.relationship_events FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON TABLE public.event_private_reflections FROM PUBLIC,anon,authenticated;
REVOKE INSERT(id,event_id,author_id,note,created_at,updated_at),
       UPDATE(id,event_id,author_id,note,created_at,updated_at)
ON TABLE public.event_private_reflections FROM PUBLIC,anon,authenticated;

DO $effective_acl$
DECLARE v_role text; v_fn text;
BEGIN
    FOREACH v_role IN ARRAY ARRAY['anon','authenticated'] LOOP
        IF has_any_column_privilege(v_role,'public.relationship_events','INSERT,UPDATE')
           OR has_table_privilege(v_role,'public.relationship_events','INSERT,UPDATE,DELETE,TRUNCATE')
           OR has_any_column_privilege(v_role,'public.event_private_reflections','INSERT,UPDATE')
           OR has_table_privilege(v_role,'public.event_private_reflections','INSERT,UPDATE,DELETE,TRUNCATE') THEN
            RAISE EXCEPTION 'Effective A01 direct-write bypass remains; review inherited/PUBLIC grants for %',v_role;
        END IF;
    END LOOP;
    IF NOT has_table_privilege('authenticated','public.relationship_events','SELECT')
       OR NOT has_table_privilege('authenticated','public.event_private_reflections','SELECT')
       OR has_function_privilege('authenticated','private.lock_my_reflection_event_internal(uuid)','EXECUTE')
       OR has_function_privilege('anon','private.lock_my_reflection_event_internal(uuid)','EXECUTE') THEN
        RAISE EXCEPTION 'Unexpected A01 read or internal-helper privileges';
    END IF;
    FOREACH v_fn IN ARRAY ARRAY[
        'public.create_relationship_moment(uuid,text,text,smallint,text,text,text)',
        'public.insert_my_private_reflection(uuid,text)',
        'public.update_my_private_reflection(uuid,text)',
        'public.delete_my_private_reflection(uuid)'
    ] LOOP
        IF NOT has_function_privilege('authenticated',v_fn,'EXECUTE')
           OR has_function_privilege('anon',v_fn,'EXECUTE')
           OR EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
                     WHERE p.oid=to_regprocedure(v_fn) AND a.grantee=0 AND a.privilege_type='EXECUTE') THEN
            RAISE EXCEPTION 'Unexpected A01 RPC privileges: %',v_fn;
        END IF;
    END LOOP;
END;
$effective_acl$;

NOTIFY pgrst, 'reload schema';
COMMIT;
