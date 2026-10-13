
-- ROS-01: Serialize invitation acceptance per couple.
-- Preserve existing authentication, expiry and membership checks.

CREATE OR REPLACE FUNCTION private.accept_couple_invite_internal(
  invite_code text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  current_user_id uuid;
  selected_invite public.couple_invites%ROWTYPE;
  member_count integer;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;

  -- Find and lock the pending invitation.
  SELECT *
  INTO selected_invite
  FROM public.couple_invites
  WHERE code = upper(trim(invite_code))
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or unavailable invite code';
  END IF;

  -- Check invitation expiration.
  IF selected_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'This invite has expired';
  END IF;

  -- Serialize acceptance for all invites to this couple.
  -- This protects the membership count from concurrent
  -- acceptance of two different invitation codes.
  PERFORM 1
  FROM public.couples
  WHERE id = selected_invite.couple_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Relationship space not found';
  END IF;

  -- One relationship space per user in the MVP.
  IF EXISTS (
    SELECT 1
    FROM public.couple_members
    WHERE user_id = current_user_id
  ) THEN
    RAISE EXCEPTION
      'You already belong to a relationship space';
  END IF;

  -- Couples have a maximum of two members.
  SELECT count(*)
  INTO member_count
  FROM public.couple_members
  WHERE couple_id = selected_invite.couple_id;

  IF member_count >= 2 THEN
    RAISE EXCEPTION
      'This relationship space already has two members';
  END IF;

  -- Add the accepting partner.
  INSERT INTO public.couple_members (
    couple_id,
    user_id
  )
  VALUES (
    selected_invite.couple_id,
    current_user_id
  );

  -- Mark the invitation as accepted.
  UPDATE public.couple_invites
  SET
    status = 'accepted',
    accepted_by = current_user_id,
    accepted_at = now()
  WHERE id = selected_invite.id;

  RETURN selected_invite.couple_id;
END;
$function$;
