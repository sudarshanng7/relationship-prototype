"""Prepared stage-29 target contract; invoked only by explicitly authorized runners.

No connection or subprocess code. Import is inert. The caller must first verify
its independently approved target's system identifier. This is not isolation proof.
"""
import hashlib
import json
from pathlib import Path

A01_MANIFEST_SHA256 = "f0307c87be337ac61d6c822d90b365c386533e9b4f3c3e119bcce9c0c77d6d36"


def require_stage29(sql):
    path = Path(__file__).with_name("ros03c-a01-guarded-writes-manifest.json")
    source = path.read_bytes()
    if hashlib.sha256(source).hexdigest() != A01_MANIFEST_SHA256:
        raise RuntimeError("Reviewed A01 contract changed; separate review required")
    manifest = json.loads(source)
    if sql("SELECT current_user;") != "postgres":
        raise RuntimeError("Expected approved disposable postgres role")
    ledger = json.loads(sql("SELECT json_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations;"))
    if ledger != manifest["versions"]:
        raise RuntimeError("Exact reviewed stage-29 ledger required")
    for signature, spec in manifest["functions"].items():
        actual = json.loads(sql("SELECT json_build_object('body_hash',encode(sha256(convert_to(prosrc,'UTF8')),'hex'),"
                                "'owner',pg_get_userbyid(proowner),'definer',prosecdef,'config',proconfig) "
                                f"FROM pg_proc WHERE oid='{signature}'::regprocedure;"))
        if actual != {"body_hash": spec["body_hash"], "owner": "postgres", "definer": True, "config": ['search_path=""']}:
            raise RuntimeError("Stage-29 function/security drift: " + signature)
    for role in ("authenticated", "anon"):
        if sql(f"SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname='{role}';") != "f":
            raise RuntimeError("Unexpected client RLS bypass role")
        for table in ("public.relationship_events", "public.event_private_reflections"):
            if sql(f"SELECT has_any_column_privilege('{role}','{table}','INSERT,UPDATE') OR "
                   f"has_table_privilege('{role}','{table}','INSERT,UPDATE,DELETE,TRUNCATE');") != "f":
                raise RuntimeError("Stage-29 direct-write bypass remains")
        if sql(f"SELECT has_function_privilege('{role}','private.lock_my_reflection_event_internal(uuid)','EXECUTE');") != "f":
            raise RuntimeError("Internal reflection helper is client-executable")
    if sql("SELECT count(*) FROM pg_class WHERE oid IN ('public.relationship_events'::regclass,"
           "'public.event_private_reflections'::regclass,'public.couple_members'::regclass) "
           "AND relrowsecurity AND NOT relforcerowsecurity AND pg_get_userbyid(relowner)='postgres';") != "3":
        raise RuntimeError("Unexpected stage-29 table ownership/RLS")
