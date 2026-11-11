-- ROS-03C / 01 — POST-MIGRATION READ-ONLY CHECKS (LOCAL)
-- Run in local Supabase Studio SQL Editor, not a hosted project.
-- SQL Editor uses privileged postgres role; these checks confirm schema
-- and data preservation but DO NOT prove RLS behavior.

-- CHECK A: new table and temporary snapshot exist.
SELECT
    to_regclass('public.event_repair_states') IS NOT NULL AS has_repair_table,
    to_regclass('private.ros03c_legacy_repair_snapshot') IS NOT NULL AS has_legacy_snapshot;

-- CHECK B: expected source/import counts.
SELECT
    (SELECT count(*) FROM public.relationship_events
     WHERE event_type='friction' AND status IS NOT NULL) AS legacy_source_count,
    (SELECT count(*) FROM public.event_repair_states) AS imported_repair_rows,
    (SELECT count(*) FROM private.ros03c_legacy_repair_snapshot) AS snapshot_rows;

-- CHECK C: distribution of imported states.
SELECT
    repair_status, status_origin, sharing_status, count(*) AS row_count
FROM public.event_repair_states
GROUP BY repair_status, status_origin, sharing_status
ORDER BY repair_status, status_origin, sharing_status;

-- CHECK D: no imported data is shared, and every source row maps to the
-- creator's new record with same status/method and timestamp when known.
SELECT
    count(*) FILTER (WHERE rs.event_id IS NULL) AS missing_imports,
    count(*) FILTER (WHERE rs.event_id IS NOT NULL AND
        (rs.repair_status, rs.what_helped, rs.reported_at)
        IS DISTINCT FROM
        (e.status, e.repair_method,
         CASE WHEN e.status='reconnected' THEN e.reconnected_at ELSE NULL END)
    ) AS changed_imports,
    count(*) FILTER (WHERE rs.sharing_status='shared') AS mistakenly_shared
FROM public.relationship_events e
LEFT JOIN public.event_repair_states rs
  ON rs.event_id=e.id AND rs.user_id=e.creator_id
WHERE e.event_type='friction' AND e.status IS NOT NULL;

-- CHECK E: authenticated may SELECT but not mutate the repair table directly.
SELECT
    has_table_privilege('authenticated', 'public.event_repair_states', 'SELECT') AS may_select,
    has_table_privilege('authenticated', 'public.event_repair_states', 'INSERT') AS may_insert,
    has_table_privilege('authenticated', 'public.event_repair_states', 'UPDATE') AS may_update,
    has_table_privilege('authenticated', 'public.event_repair_states', 'DELETE') AS may_delete;

-- CHECK F: RLS and visibility-suspension trigger are installed.
SELECT
    c.relrowsecurity AS rls_enabled,
    EXISTS (SELECT 1 FROM pg_policies p
        WHERE p.schemaname='public' AND p.tablename='event_repair_states'
        AND p.policyname='Read authorized individual repair states') AS has_select_policy,
    EXISTS (SELECT 1 FROM pg_trigger t
        WHERE t.tgrelid='public.relationship_events'::regclass
        AND t.tgname='suspend_repair_shares_when_event_mine'
        AND NOT t.tgisinternal) AS has_suspension_trigger
FROM pg_class c
WHERE c.oid='public.event_repair_states'::regclass;

-- CHECK G: version recorded (if applied with migration up).
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE version='20261023090000';
