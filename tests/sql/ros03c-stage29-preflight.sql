-- PREPARED ONLY. Exact stage-29 preflight, derived from unchanged A01 metadata checks.
-- No fixtures; transaction rolls back. Flags/system ID do not establish isolation.
\set ON_ERROR_STOP on
\if :{?stage29_disposable_authorized}
\else
\quit 3
\endif
\if :stage29_disposable_authorized
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

ROLLBACK;
