-- ROS-03C LOCAL DATABASE PRE-FLIGHT AUDIT
-- REVIEW / READ ONLY -- 2026-10-23
-- Run ONLY in LOCAL Supabase Studio SQL Editor, executing one section at a time.
-- No statements in this file modify schema or data.
-- These SQL Editor reads run with administrative privileges and DO NOT prove RLS enforcement.
-- Do not share rows containing private relationship content or credentials.

-- 1. Verify database context and presence of tables.
SELECT
    current_database() AS database_name,
    current_user AS sql_editor_role,
    current_setting('server_version') AS postgres_version,
    to_regclass('public.relationship_events') IS NOT NULL AS has_events_table,
    to_regclass('public.couple_members') IS NOT NULL AS has_memberships_table,
    to_regclass('public.event_private_reflections') IS NOT NULL AS has_private_reflections,
    to_regclass('public.event_perspectives') IS NOT NULL AS has_perspectives,
    to_regclass('public.event_repair_states') IS NOT NULL AS repair_table_already_exists;



SELECT
    table_name, ordinal_position, column_name, data_type,
    is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('relationship_events', 'event_repair_states')
ORDER BY table_name, ordinal_position;

-- 3. RLS enabled/forced status on core application tables.
SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND c.relname IN (
      'couples', 'couple_members', 'relationship_events',
      'event_private_reflections', 'event_perspectives', 'event_repair_states'
  )
ORDER BY c.relname;

-- 4. Current RLS rules and their USING / WITH CHECK expressions.
SELECT
    tablename, policyname, cmd, roles,
    qual AS using_expression,
    with_check AS check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
      'couple_members', 'relationship_events',
      'event_private_reflections', 'event_perspectives', 'event_repair_states'
  )
ORDER BY tablename, cmd, policyname;

-- 5. Check CURRENT authenticated table and column privileges.
-- This is not an RLS test; a privilege alone does not grant row access.
SELECT
    has_table_privilege('authenticated', 'public.relationship_events', 'SELECT')
        AS authenticated_can_select_events,
    has_column_privilege('authenticated','public.relationship_events','status','SELECT')
        AS authenticated_can_select_legacy_status,
    has_column_privilege('authenticated','public.relationship_events','repair_method','SELECT')
        AS authenticated_can_select_legacy_method,
    has_column_privilege('authenticated','public.relationship_events','reconnected_at','SELECT')
        AS authenticated_can_select_legacy_reconnected_at,
    has_column_privilege('authenticated','public.relationship_events','status','UPDATE')
        AS authenticated_can_update_legacy_status;
-- This query assumes legacy columns still exist; if not, inspect query 2 first.


-- 6. Look for database functions relevant to old/new repair and visibility flows.
SELECT
    n.nspname AS function_schema,
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS argument_types,
    p.prosecdef AS security_definer,
    has_function_privilege('authenticated', p.oid, 'EXECUTE')
        AS authenticated_execute_privilege
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'private')
  AND p.prokind = 'f'
  AND p.proname IN (
      'create_relationship_moment', 'set_moment_visibility',
      'submit_event_perspective', 'withdraw_event_perspective',
      'save_my_repair_state', 'share_my_repair_state',
      'withdraw_my_repair_state', 'suspend_shared_repair_states',
      'user_couple_ids'
  )
ORDER BY n.nspname, p.proname;