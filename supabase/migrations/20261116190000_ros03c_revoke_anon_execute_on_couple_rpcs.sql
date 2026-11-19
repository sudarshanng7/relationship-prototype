-- PROPOSAL ONLY: no source integration or hosted execution is authorized.
-- Forward migration30 after the immutable29; staging write procedure required.
-- Only two explicit anonymous EXECUTE grants are removed. No default ACL change.
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
SET LOCAL idle_in_transaction_session_timeout = '30s';
SET LOCAL search_path = pg_catalog;

DO $ros03c_targeted_anon_execute$
DECLARE
    v_owner oid;
    v_anon oid;
    v_authenticated oid;
    v_service oid;
    v_expected record;
    v_signature text;
    v_proc pg_catalog.pg_proc%ROWTYPE;
    v_before jsonb;
    v_after jsonb;
BEGIN
    IF current_user <> 'postgres' OR session_user <> 'postgres'
       OR current_database() <> 'postgres'
       OR current_setting('server_version_num') <> '170011'
       OR NOT EXISTS (
           SELECT 1 FROM pg_catalog.pg_stat_ssl
           WHERE pid=pg_catalog.pg_backend_pid() AND ssl
             AND version IN ('TLSv1.2','TLSv1.3') AND bits>=128
       ) THEN
        RAISE EXCEPTION 'STOP: Unexpected migration role/database/version/upstream TLS';
    END IF;
    -- Database name and TLS do not prove Supabase project identity. The separate
    -- reviewed launcher MUST pin the project-qualified endpoint/user and verify-full.
    IF pg_catalog.to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
        RAISE EXCEPTION 'STOP: Accepted predecessor migration ledger missing';
    END IF;
    IF (SELECT count(*)=29 AND count(DISTINCT version)=29
               AND array_agg(version ORDER BY version)=ARRAY['20261001000000','20261013210000','20261014154911','20261014155951','20261014193712','20261014204124','20261016100826','20261016101735','20261016144728','20261016152107','20261016155850','20261016193312','20261020120246','20261020180334','20261023090000','20261027214000','20261028184500','20261028200000','20261028220000','20261102180000','20261103200000','20261104100000','20261104120000','20261105100000','20261106120000','20261106160000','20261108120000','20261108160000','20261108180000']::text[]
        FROM supabase_migrations.schema_migrations) IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'STOP: Expected exactly the accepted29 predecessor versions';
    END IF;
    SELECT oid INTO v_owner FROM pg_catalog.pg_roles WHERE rolname='postgres';
    SELECT oid INTO v_anon FROM pg_catalog.pg_roles WHERE rolname='anon';
    SELECT oid INTO v_authenticated FROM pg_catalog.pg_roles WHERE rolname='authenticated';
    SELECT oid INTO v_service FROM pg_catalog.pg_roles WHERE rolname='service_role';
    IF v_owner IS NULL OR v_anon IS NULL OR v_authenticated IS NULL OR v_service IS NULL
       OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles
                 WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls)) THEN
        RAISE EXCEPTION 'STOP: Missing or privileged ordinary roles';
    END IF;

    FOR v_expected IN SELECT * FROM (VALUES
        ('public.accept_couple_invite(text)', '05be705853244d8bfa410b57df8868bd0eac2959666f56101879fba8874cadba', false, 'uuid', 'v', ARRAY['invite_code']::text[]),
        ('public.get_partner_display_name()', '0d1216006a90b022889eb3b4eb9b9706362cb04c70e9cc2cf68f854597a57657', true, 'text', 's', ARRAY[]::text[])
    ) AS expected(signature,body_hash,definer,result_type,volatility,argnames) LOOP
        SELECT * INTO v_proc FROM pg_catalog.pg_proc
        WHERE oid=pg_catalog.to_regprocedure(v_expected.signature);
        IF NOT FOUND THEN RAISE EXCEPTION 'STOP: Expected routine missing'; END IF;
        IF v_proc.proowner<>v_owner OR v_proc.prokind<>'f'
           OR v_proc.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname='sql')
           OR v_proc.prosecdef IS DISTINCT FROM v_expected.definer
           OR v_proc.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
           OR v_proc.prorettype<>pg_catalog.to_regtype(v_expected.result_type)
           OR v_proc.proretset OR v_proc.provolatile::text<>v_expected.volatility
           OR v_proc.proparallel<>'u' OR v_proc.proisstrict OR v_proc.proleakproof
           OR v_proc.prosupport<>0 OR v_proc.provariadic<>0
           OR v_proc.pronargdefaults<>0 OR v_proc.proargmodes IS NOT NULL
           OR v_proc.proallargtypes IS NOT NULL OR v_proc.prosqlbody IS NOT NULL
           OR COALESCE(v_proc.proargnames,ARRAY[]::text[]) IS DISTINCT FROM v_expected.argnames
           OR encode(pg_catalog.sha256(pg_catalog.convert_to(v_proc.prosrc,'UTF8')),'hex') IS DISTINCT FROM v_expected.body_hash
           OR (SELECT count(*) FROM pg_catalog.pg_proc p
               WHERE p.pronamespace=v_proc.pronamespace AND p.proname=v_proc.proname)<>1 THEN
            RAISE EXCEPTION 'STOP: Routine contract, ownership or overload differs';
        END IF;
        -- Pin the observed owner-issued, nongrantable direct grants. Never repair
        -- unrelated grants, inherited paths or role changes to make this pass.
        IF v_proc.proacl IS NULL
           OR (SELECT count(*) FROM pg_catalog.aclexplode(v_proc.proacl))<>4
           OR (SELECT count(DISTINCT grantee) FROM pg_catalog.aclexplode(v_proc.proacl))<>4
           OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(v_proc.proacl) a
                     WHERE a.grantee NOT IN (v_owner,v_anon,v_authenticated,v_service)
                        OR a.grantor<>v_owner OR a.privilege_type<>'EXECUTE' OR a.is_grantable)
           OR pg_catalog.has_function_privilege('anon',v_proc.oid,'EXECUTE') IS DISTINCT FROM true
           OR pg_catalog.has_function_privilege('authenticated',v_proc.oid,'EXECUTE') IS DISTINCT FROM true
           OR pg_catalog.has_function_privilege('service_role',v_proc.oid,'EXECUTE') IS DISTINCT FROM true
           OR pg_catalog.has_schema_privilege('authenticated',v_proc.pronamespace,'USAGE') IS DISTINCT FROM true
           OR pg_catalog.has_schema_privilege('service_role',v_proc.pronamespace,'USAGE') IS DISTINCT FROM true THEN
            RAISE EXCEPTION 'STOP: Targeted grant prerequisites differ from reviewed findings';
        END IF;
    END LOOP;

    -- In-memory snapshots only; no temporary relation, function or GUC is created.
    -- All pg_proc fields except the intended ACL change must remain identical.
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'oid',p.oid,'metadata',pg_catalog.to_jsonb(p)-'proacl',
        'acl',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(a)
                   ORDER BY a.grantee,a.grantor,a.privilege_type)
               FROM pg_catalog.aclexplode(p.proacl) a WHERE a.grantee<>v_anon),'[]'::jsonb))
        ORDER BY p.oid)
    INTO v_before FROM pg_catalog.pg_proc p
    WHERE p.oid IN (pg_catalog.to_regprocedure('public.accept_couple_invite(text)'),
                   pg_catalog.to_regprocedure('public.get_partner_display_name()'));

    REVOKE EXECUTE ON FUNCTION public.accept_couple_invite(text) FROM anon RESTRICT;
    REVOKE EXECUTE ON FUNCTION public.get_partner_display_name() FROM anon RESTRICT;

    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'oid',p.oid,'metadata',pg_catalog.to_jsonb(p)-'proacl',
        'acl',COALESCE((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(a)
                   ORDER BY a.grantee,a.grantor,a.privilege_type)
               FROM pg_catalog.aclexplode(p.proacl) a),'[]'::jsonb))
        ORDER BY p.oid)
    INTO v_after FROM pg_catalog.pg_proc p
    WHERE p.oid IN (pg_catalog.to_regprocedure('public.accept_couple_invite(text)'),
                   pg_catalog.to_regprocedure('public.get_partner_display_name()'));
    IF v_before IS NULL OR jsonb_array_length(v_before)<>2
       OR v_after IS DISTINCT FROM v_before THEN
        RAISE EXCEPTION 'STOP: Non-anonymous ACL or function metadata changed unexpectedly';
    END IF;
    FOREACH v_signature IN ARRAY ARRAY[
        'public.accept_couple_invite(text)','public.get_partner_display_name()'
    ] LOOP
        IF pg_catalog.has_function_privilege('anon',v_signature,'EXECUTE') IS DISTINCT FROM false
           OR pg_catalog.has_function_privilege('authenticated',v_signature,'EXECUTE') IS DISTINCT FROM true
           OR pg_catalog.has_function_privilege('service_role',v_signature,'EXECUTE') IS DISTINCT FROM true THEN
            RAISE EXCEPTION 'STOP: Effective targeted RPC privileges do not match intended result';
        END IF;
    END LOOP;
END;
$ros03c_targeted_anon_execute$;
