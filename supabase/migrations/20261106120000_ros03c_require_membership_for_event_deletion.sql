-- PR #7 Finding 8: creator identity alone does not authorize event deletion.
-- Forward-only, policy-only correction. No application rows are changed.
-- Snapshot membership is NOT a lock against concurrent revocation/reassignment.
-- See ROS-03C-finding8-implementation.md before deployment or runtime testing.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- Hold the same table against policy/schema changes between preflight and ALTER.
LOCK TABLE public.relationship_events IN ACCESS EXCLUSIVE MODE;

DO $preflight$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class
        WHERE oid = 'public.relationship_events'::regclass AND relrowsecurity
    ) THEN
        RAISE EXCEPTION 'Expected relationship_events RLS to be enabled';
    END IF;

    -- Permissive DELETE/ALL policies combine with OR. Do not silently accept
    -- a target with another authorization path, even for a different role.
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
        RAISE EXCEPTION 'Unexpected relationship_events DELETE/ALL policies; review target drift';
    END IF;

    IF NOT has_table_privilege('authenticated', 'public.relationship_events', 'DELETE')
       OR has_table_privilege('anon', 'public.relationship_events', 'DELETE')
       OR EXISTS (
           SELECT 1 FROM pg_catalog.pg_roles
           WHERE rolname = 'authenticated' AND (rolsuper OR rolbypassrls)
       ) THEN
        RAISE EXCEPTION 'Unexpected client event deletion privileges';
    END IF;

    IF to_regprocedure('private.user_couple_ids()') IS NULL
       OR NOT has_schema_privilege('authenticated', 'private', 'USAGE')
       OR NOT has_function_privilege('authenticated', 'private.user_couple_ids()', 'EXECUTE') THEN
        RAISE EXCEPTION 'Expected current-membership helper is unavailable';
    END IF;
END;
$preflight$;

-- Put BOTH requirements on DELETE itself; do not depend on SELECT being used.
-- Reuse the same auth.uid()-scoped membership helper as the event SELECT policy.
ALTER POLICY "Creators can delete their events"
ON public.relationship_events
USING (
    creator_id = (SELECT auth.uid())
    AND couple_id IN (SELECT private.user_couple_ids())
);

-- No grants, functions, triggers, foreign keys, visibility rules or child
-- policies change. Authorized parent deletion retains its existing cascades.
NOTIFY pgrst, 'reload schema';
COMMIT;
