
BEGIN;

-- ROS-03B: Author-controlled perspective withdrawal.
-- Withdrawal permanently deletes the author's perspective.
-- It must work even when the parent event is Mine.

-- Prevent clients from bypassing the withdrawal function.
REVOKE DELETE
ON TABLE public.event_perspectives
FROM authenticated;

CREATE FUNCTION public.withdraw_event_perspective(
    p_event_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_deleted_id uuid;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Confirm that the user still belongs to the couple.
    -- Deliberately do not require event visibility = 'ours'.
    --
    -- The function runs with database-owner privileges,
    -- so an author can withdraw without being granted
    -- access to the other person's private event.

    IF NOT EXISTS (
        SELECT 1
        FROM public.relationship_events e
        JOIN public.couple_members cm
          ON cm.couple_id = e.couple_id
        WHERE e.id = p_event_id
          AND cm.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Perspective unavailable';
    END IF;

    -- Delete only the authenticated user's perspective.
    -- Never delete another partner's contribution.
    DELETE FROM public.event_perspectives p
    WHERE p.event_id = p_event_id
      AND p.author_id = v_user_id
    RETURNING p.id INTO v_deleted_id;

    RETURN v_deleted_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_event_perspective(uuid)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.withdraw_event_perspective(uuid)
FROM anon;

GRANT EXECUTE ON FUNCTION public.withdraw_event_perspective(uuid)
TO authenticated;

COMMIT;
