
BEGIN;

-- ROS-03B: Allow an author to read their own
-- suspended perspective even when the parent event
-- has been moved to Mine by the event creator.
--
-- Do not change the parent event's RLS policy.

-- Private helper bypasses parent-event SELECT RLS,
-- but checks current couple membership explicitly.

CREATE FUNCTION private.can_access_own_event_perspective(
    p_event_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.relationship_events e
        JOIN public.couple_members cm
            ON cm.couple_id = e.couple_id
        WHERE e.id = p_event_id
          AND cm.user_id = (SELECT auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION
    private.can_access_own_event_perspective(uuid)
FROM PUBLIC;

REVOKE ALL ON FUNCTION
    private.can_access_own_event_perspective(uuid)
FROM anon;

GRANT EXECUTE ON FUNCTION
    private.can_access_own_event_perspective(uuid)
TO authenticated;

-- Replace the existing read policy.
-- Authors see their own records if they remain members.
-- The other partner sees only submitted perspectives
-- on events that are currently Ours.

DROP POLICY IF EXISTS "Read permitted perspectives"
ON public.event_perspectives;

CREATE POLICY "Read permitted perspectives"
ON public.event_perspectives
FOR SELECT TO authenticated
USING (
    (
        author_id = (SELECT auth.uid())
        AND private.can_access_own_event_perspective(event_id)
    )
    OR
    (
        sharing_status = 'submitted'
        AND EXISTS (
            SELECT 1
            FROM public.relationship_events e
            JOIN public.couple_members cm
                ON cm.couple_id = e.couple_id
            WHERE e.id = event_id
              AND e.visibility = 'ours'
              AND cm.user_id = (SELECT auth.uid())
        )
    )
);

COMMIT;
