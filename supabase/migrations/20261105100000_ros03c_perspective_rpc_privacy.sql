-- PR #7 Finding 5: authorize perspectives before validation or private-state errors.
-- Forward-only; no data backfill. Review and validate on a new disposable target.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $preflight$
BEGIN
    IF to_regprocedure('public.submit_event_perspective(uuid,text)') IS NULL
       OR to_regprocedure('public.withdraw_event_perspective(uuid)') IS NULL
       OR to_regprocedure('private.can_access_own_event_perspective(uuid)') IS NULL THEN
        RAISE EXCEPTION 'Expected ROS-03B perspective functions are missing';
    END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.submit_event_perspective(
    p_event_id uuid, p_perspective_text text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_event_couple_id uuid;
    v_text text;
    v_perspective_id uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Filter authorization BEFORE locking: an inaccessible Mine event should
    -- not even wait on a private parent's row lock. Recheck membership under a
    -- lock below, since the EXISTS snapshot alone cannot fence revocation.
    SELECT e.couple_id INTO v_event_couple_id
    FROM public.relationship_events e
    WHERE e.id = p_event_id
      AND e.visibility = 'ours'
      AND EXISTS (
          SELECT 1 FROM public.couple_members cm
          WHERE cm.couple_id = e.couple_id AND cm.user_id = v_user_id
      )
    FOR SHARE OF e;
    IF NOT FOUND THEN RAISE EXCEPTION 'Event unavailable'; END IF;

    -- Lock order: parent -> current membership -> caller-owned perspective.
    -- KEY SHARE fences deletion and changes to either membership key; SHARE
    -- on the parent fences visibility changes, deletion and parent reassignment.
    PERFORM 1 FROM public.couple_members cm
    WHERE cm.couple_id = v_event_couple_id AND cm.user_id = v_user_id
    FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Event unavailable'; END IF;

    v_text := NULLIF(btrim(p_perspective_text), '');
    IF v_text IS NULL THEN RAISE EXCEPTION 'Perspective text is required'; END IF;

    INSERT INTO public.event_perspectives (
        event_id, author_id, perspective_text, sharing_status
    ) VALUES (p_event_id, v_user_id, v_text, 'submitted')
    ON CONFLICT (event_id, author_id) DO UPDATE SET
        perspective_text = EXCLUDED.perspective_text,
        sharing_status = 'submitted',
        updated_at = now()
    RETURNING id INTO v_perspective_id;
    RETURN v_perspective_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_event_perspective(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_event_couple_id uuid;
    v_creator_id uuid;
    v_visibility text;
    v_deleted_id uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Own suspended contributions remain withdrawable without exposing the
    -- hidden parent's metadata. Never lock a hidden event for a nonparticipant.
    SELECT e.couple_id, e.creator_id, e.visibility
    INTO v_event_couple_id, v_creator_id, v_visibility
    FROM public.relationship_events e
    WHERE e.id = p_event_id
      AND EXISTS (
          SELECT 1 FROM public.couple_members cm
          WHERE cm.couple_id = e.couple_id AND cm.user_id = v_user_id
      )
      AND (
          e.visibility = 'ours' OR e.creator_id = v_user_id
          OR EXISTS (
              SELECT 1 FROM public.event_perspectives p
              WHERE p.event_id = e.id AND p.author_id = v_user_id
          )
      )
    FOR SHARE OF e;
    IF NOT FOUND THEN RAISE EXCEPTION 'Perspective unavailable'; END IF;

    PERFORM 1 FROM public.couple_members cm
    WHERE cm.couple_id = v_event_couple_id AND cm.user_id = v_user_id
    FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Perspective unavailable'; END IF;

    DELETE FROM public.event_perspectives p
    WHERE p.event_id = p_event_id AND p.author_id = v_user_id
    RETURNING p.id INTO v_deleted_id;

    -- A concurrent withdrawal may have deleted the row after the EXISTS check.
    -- Return false only for a currently readable parent, never a hidden one.
    IF v_deleted_id IS NULL AND v_visibility = 'mine' AND v_creator_id <> v_user_id THEN
        RAISE EXCEPTION 'Perspective unavailable';
    END IF;
    RETURN v_deleted_id IS NOT NULL;
END;
$$;

-- This RLS helper is directly callable by authenticated users. Membership alone
-- must not reveal a hidden event. The owner bypasses RLS here, avoiding recursion
-- into the perspective SELECT policy while checking only auth.uid()'s own row.
CREATE OR REPLACE FUNCTION private.can_access_own_event_perspective(p_event_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.event_perspectives p
        JOIN public.relationship_events e ON e.id = p.event_id
        JOIN public.couple_members cm ON cm.couple_id = e.couple_id
        WHERE p.event_id = p_event_id
          AND p.author_id = (SELECT auth.uid())
          AND cm.user_id = (SELECT auth.uid())
    );
$$;

-- CREATE OR REPLACE retains ownership. Set client ACLs explicitly, including
-- the callable RLS helper; preserve existing service/owner permissions.
REVOKE ALL ON FUNCTION public.submit_event_perspective(uuid,text)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.withdraw_event_perspective(uuid)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.can_access_own_event_perspective(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_event_perspective(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_event_perspective(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_own_event_perspective(uuid) TO authenticated;

-- Existing table grants, RLS policies, suspension trigger and repair RPCs remain.
NOTIFY pgrst, 'reload schema';
COMMIT;
