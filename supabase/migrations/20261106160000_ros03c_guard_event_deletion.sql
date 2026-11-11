-- PR #7 Finding 8 follow-up: serialize creator deletion with membership changes.
-- Forward-only. No existing application rows are deleted by this migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.relationship_events IN ACCESS EXCLUSIVE MODE;

DO $preflight$
BEGIN
    IF current_user <> 'postgres'
       OR NOT EXISTS (
           SELECT 1 FROM pg_catalog.pg_class
           WHERE oid = 'public.relationship_events'::regclass AND relrowsecurity
       ) OR NOT EXISTS (
           SELECT 1 FROM pg_catalog.pg_policy
           WHERE polrelid = 'public.relationship_events'::regclass
             AND polname = 'Creators can delete their events' AND polcmd = 'd'
       ) OR to_regprocedure('private.user_couple_ids()') IS NULL THEN
        RAISE EXCEPTION 'Expected postgres and Finding 8 event authorization prerequisites';
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_catalog.pg_roles
        WHERE rolname IN ('authenticated', 'anon') AND (rolsuper OR rolbypassrls)
    ) OR (SELECT relowner FROM pg_catalog.pg_class
          WHERE oid = 'public.relationship_events'::regclass) IN (
              SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN ('authenticated', 'anon')
          ) THEN
        RAISE EXCEPTION 'Unexpected client RLS bypass or event ownership';
    END IF;
END;
$preflight$;

CREATE FUNCTION private.delete_relationship_event_internal(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_user uuid := auth.uid();
    v_couple uuid;
    v_creator uuid;
    v_deleted uuid;
BEGIN
    IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

    -- Filter ownership and snapshot membership BEFORE acquiring a parent row
    -- lock. Missing, hidden and non-owned IDs get the same availability error.
    SELECT e.couple_id, e.creator_id INTO v_couple, v_creator
    FROM public.relationship_events e
    WHERE e.id = p_event_id AND e.creator_id = v_user
      AND EXISTS (
          SELECT 1 FROM public.couple_members cm
          WHERE cm.couple_id = e.couple_id AND cm.user_id = v_user
      )
    FOR UPDATE OF e;
    IF NOT FOUND THEN RAISE EXCEPTION 'Event unavailable'; END IF;

    -- Parent -> membership -> cascading children, matching existing mutation
    -- order. Recheck membership under a lock; the EXISTS snapshot is insufficient.
    PERFORM 1 FROM public.couple_members cm
    WHERE cm.couple_id = v_couple AND cm.user_id = v_user
    FOR KEY SHARE;
    IF NOT FOUND OR v_creator <> v_user THEN RAISE EXCEPTION 'Event unavailable'; END IF;

    DELETE FROM public.relationship_events e
    WHERE e.id = p_event_id AND e.creator_id = v_user AND e.couple_id = v_couple
    RETURNING e.id INTO v_deleted;
    IF v_deleted IS NULL THEN RAISE EXCEPTION 'Event unavailable'; END IF;
    RETURN true;
END;
$$;

CREATE FUNCTION public.delete_relationship_event(p_event_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$
    SELECT private.delete_relationship_event_internal(p_event_id);
$$;

REVOKE ALL ON FUNCTION private.delete_relationship_event_internal(uuid)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_relationship_event(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.delete_relationship_event_internal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_relationship_event(uuid) TO authenticated;

-- Keep the Finding 8 RLS policy as defense in depth. Remove direct grants, and
-- fail the entire migration if inheritance/PUBLIC/other role grants leave a bypass.
-- Do not revoke privileges from unrelated trusted administrative roles implicitly.
REVOKE DELETE ON public.relationship_events FROM PUBLIC, anon, authenticated;
DO $effective_privileges$
BEGIN
    IF has_table_privilege('authenticated', 'public.relationship_events', 'DELETE,TRUNCATE')
       OR has_table_privilege('anon', 'public.relationship_events', 'DELETE,TRUNCATE') THEN
        RAISE EXCEPTION 'Effective client DELETE/TRUNCATE remains; review inherited role grants';
    END IF;
    IF NOT has_schema_privilege('authenticated', 'private', 'USAGE') THEN
        RAISE EXCEPTION 'Expected authenticated private-schema usage';
    END IF;
END;
$effective_privileges$;

NOTIFY pgrst, 'reload schema';
COMMIT;
