-- Migration: 20261122174000_mobile_alpha_stability_batch2.sql
-- Description: Mobile Alpha Stability Batch 2
-- 1. Custom category label on relationship_events with length & trimmed checks
-- 2. 8-argument create_relationship_moment + 7-argument backward-compatible wrapper
-- 3. User notification preferences, push tokens with unique token constraint, and safe registration RPC
-- 4. Atomic notification delivery reservation & completion RPCs with status/attempt tracking
-- 5. Annoyance reframes with relational integrity trigger
-- 6. Annoyance private notes with strict author & reframe ownership RLS
-- 7. Atomic save_annoyance_reframe RPC with field preservation
-- 8. Partner response RPC for database-backed acceptance/dismissal lifecycle

BEGIN;

-- ============================================================================
-- 1. Custom Category Label on relationship_events
-- ============================================================================

ALTER TABLE public.relationship_events
  ADD COLUMN IF NOT EXISTS custom_category_label text;

-- Preserve legacy events created before custom category labels existed by
-- normalizing existing rows before applying the custom category check constraint.
UPDATE public.relationship_events
SET custom_category_label = CASE
  WHEN category = 'other' THEN
    CASE
      WHEN custom_category_label IS NOT NULL AND length(btrim(custom_category_label)) > 0 THEN
        substring(btrim(custom_category_label) from 1 for 60)
      ELSE 'Other'
    END
  ELSE NULL
END;

ALTER TABLE public.relationship_events
  DROP CONSTRAINT IF EXISTS relationship_events_custom_category_check;

ALTER TABLE public.relationship_events
  ADD CONSTRAINT relationship_events_custom_category_check
  CHECK (
    (category = 'other' AND custom_category_label IS NOT NULL AND length(btrim(custom_category_label)) > 0 AND length(custom_category_label) <= 60)
    OR
    (category <> 'other' AND custom_category_label IS NULL)
  );

-- ============================================================================
-- 2. Moment Creation Functions (8-arg implementation + 7-arg compatibility wrapper)
-- ============================================================================

-- Primary 8-argument function (NO default on 8th argument to prevent ambiguity)
CREATE OR REPLACE FUNCTION public.create_relationship_moment(
    p_couple_id uuid,
    p_event_type text,
    p_category text,
    p_intensity smallint,
    p_visibility text,
    p_private_note text,
    p_shared_topic text,
    p_custom_category_label text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_event_id uuid;
    v_private_note text;
    v_shared_topic text;
    v_custom_category_label text;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_visibility NOT IN ('mine', 'ours')
       OR p_visibility IS NULL THEN
        RAISE EXCEPTION 'Invalid visibility';
    END IF;

    IF p_event_type NOT IN ('positive', 'friction')
       OR p_event_type IS NULL THEN
        RAISE EXCEPTION 'Invalid event type';
    END IF;

    IF p_category IS NULL OR trim(p_category) = '' THEN
        RAISE EXCEPTION 'Category is required';
    END IF;

    IF p_event_type = 'friction'
       AND (p_intensity IS NULL OR p_intensity NOT BETWEEN 1 AND 5)
    THEN
        RAISE EXCEPTION 'Friction intensity must be between 1 and 5';
    END IF;

    v_private_note := NULLIF(trim(p_private_note), '');
    v_shared_topic := NULLIF(trim(p_shared_topic), '');
    v_custom_category_label := NULLIF(trim(p_custom_category_label), '');

    IF trim(p_category) = 'other' THEN
        IF v_custom_category_label IS NULL OR length(v_custom_category_label) > 60 THEN
            RAISE EXCEPTION 'Custom category label is required and must be 60 characters or fewer';
        END IF;
    ELSE
        v_custom_category_label := NULL;
    END IF;

    IF p_visibility = 'mine' AND v_shared_topic IS NOT NULL THEN
        RAISE EXCEPTION 'Private moments cannot contain shared topics';
    END IF;

    INSERT INTO public.relationship_events (
        couple_id,
        creator_id,
        event_type,
        category,
        custom_category_label,
        intensity,
        visibility,
        status,
        shared_topic
    )
    VALUES (
        p_couple_id,
        v_user_id,
        p_event_type,
        trim(p_category),
        v_custom_category_label,
        CASE
            WHEN p_event_type = 'friction' THEN p_intensity
            ELSE NULL
        END,
        p_visibility,
        CASE
            WHEN p_event_type = 'friction' THEN 'open'
            ELSE NULL
        END,
        v_shared_topic
    )
    RETURNING id INTO v_event_id;

    IF v_private_note IS NOT NULL THEN
        INSERT INTO public.event_private_reflections (
            event_id,
            author_id,
            note
        )
        VALUES (
            v_event_id,
            v_user_id,
            v_private_note
        );
    END IF;

    RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_relationship_moment(uuid, text, text, smallint, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_relationship_moment(uuid, text, text, smallint, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_relationship_moment(uuid, text, text, smallint, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_relationship_moment(uuid, text, text, smallint, text, text, text, text) TO service_role;

-- Backward-compatible 7-argument wrapper for installed v0.1.0 APK
CREATE OR REPLACE FUNCTION public.create_relationship_moment(
    p_couple_id uuid,
    p_event_type text,
    p_category text,
    p_intensity smallint,
    p_visibility text,
    p_private_note text DEFAULT NULL,
    p_shared_topic text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    RETURN public.create_relationship_moment(
        p_couple_id,
        p_event_type,
        p_category,
        p_intensity,
        p_visibility,
        p_private_note,
        p_shared_topic,
        CASE
            WHEN trim(p_category) = 'other' THEN 'Other'
            ELSE NULL::text
        END
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_relationship_moment(uuid, text, text, smallint, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_relationship_moment(uuid, text, text, smallint, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_relationship_moment(uuid, text, text, smallint, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_relationship_moment(uuid, text, text, smallint, text, text, text) TO service_role;

-- ============================================================================
-- 3. User Notification Preferences & Device Push Tokens
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notify_on_partner_shared_moment boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_notification_preferences TO authenticated;
GRANT ALL ON TABLE public.user_notification_preferences TO service_role;

DROP POLICY IF EXISTS "Users can read own notification preferences" ON public.user_notification_preferences;
CREATE POLICY "Users can read own notification preferences"
  ON public.user_notification_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own notification preferences" ON public.user_notification_preferences;
CREATE POLICY "Users can insert own notification preferences"
  ON public.user_notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notification preferences" ON public.user_notification_preferences;
CREATE POLICY "Users can update own notification preferences"
  ON public.user_notification_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Device Push Tokens
CREATE TABLE IF NOT EXISTS public.user_device_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_device_push_tokens_expo_push_token_key UNIQUE (expo_push_token)
);

ALTER TABLE public.user_device_push_tokens ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_device_push_tokens TO authenticated;
GRANT ALL ON TABLE public.user_device_push_tokens TO service_role;

DROP POLICY IF EXISTS "Users can read own push tokens" ON public.user_device_push_tokens;
CREATE POLICY "Users can read own push tokens"
  ON public.user_device_push_tokens
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own push tokens" ON public.user_device_push_tokens;
CREATE POLICY "Users can insert own push tokens"
  ON public.user_device_push_tokens
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own push tokens" ON public.user_device_push_tokens;
CREATE POLICY "Users can update own push tokens"
  ON public.user_device_push_tokens
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own push tokens" ON public.user_device_push_tokens;
CREATE POLICY "Users can delete own push tokens"
  ON public.user_device_push_tokens
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Safe token registration RPC: transfers token ownership atomically if device switched users
CREATE OR REPLACE FUNCTION public.register_device_push_token(
    p_token text,
    p_platform text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_platform NOT IN ('android', 'ios', 'web') THEN
        RAISE EXCEPTION 'Invalid platform';
    END IF;

    IF p_token IS NULL OR pg_catalog.btrim(p_token) = '' THEN
        RAISE EXCEPTION 'Token is required';
    END IF;

    -- Safely remove any existing assignment of this token across users
    DELETE FROM public.user_device_push_tokens
    WHERE expo_push_token = pg_catalog.btrim(p_token);

    -- Insert fresh for the calling authenticated user
    INSERT INTO public.user_device_push_tokens (
        user_id,
        expo_push_token,
        platform,
        updated_at
    )
    VALUES (
        v_user_id,
        pg_catalog.btrim(p_token),
        p_platform,
        pg_catalog.now()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.register_device_push_token(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_device_push_token(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.register_device_push_token(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_device_push_token(text, text) TO service_role;

-- Safe token unregister RPC: removes token if assigned to calling user
CREATE OR REPLACE FUNCTION public.unregister_device_push_token(
    p_token text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    DELETE FROM public.user_device_push_tokens
    WHERE expo_push_token = pg_catalog.btrim(p_token)
      AND user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.unregister_device_push_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unregister_device_push_token(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.unregister_device_push_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unregister_device_push_token(text) TO service_role;

-- ============================================================================
-- 4. Notification Deliveries Atomic Reservation & Completion
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shared_moment_notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.relationship_events(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'failed')),
  attempt_count int NOT NULL DEFAULT 1,
  last_error text,
  reserved_at timestamp with time zone NOT NULL DEFAULT now(),
  accepted_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT shared_moment_notification_deliveries_event_recipient_key UNIQUE (event_id, recipient_id)
);

ALTER TABLE public.shared_moment_notification_deliveries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.shared_moment_notification_deliveries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shared_moment_notification_deliveries TO service_role;

-- Atomic reservation RPC: reserves one delivery attempt before contacting Expo
CREATE OR REPLACE FUNCTION public.reserve_shared_moment_notification_delivery(
    p_event_id uuid,
    p_recipient_id uuid,
    p_stale_timeout_seconds int DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_row record;
    v_stale_threshold timestamptz;
BEGIN
    v_stale_threshold := pg_catalog.now() - (p_stale_timeout_seconds || ' seconds')::interval;

    -- 1. Try initial atomic insert (first attempt)
    BEGIN
        INSERT INTO public.shared_moment_notification_deliveries (
            event_id,
            recipient_id,
            status,
            attempt_count,
            reserved_at,
            updated_at
        )
        VALUES (
            p_event_id,
            p_recipient_id,
            'pending',
            1,
            pg_catalog.now(),
            pg_catalog.now()
        )
        RETURNING * INTO v_row;

        RETURN pg_catalog.jsonb_build_object(
            'reserved', true,
            'attempt_count', 1,
            'status', 'pending'
        );
    EXCEPTION
        WHEN unique_violation THEN
            -- Row already exists, proceed to lock and evaluate transition
            NULL;
    END;

    -- 2. Lock existing row to prevent concurrent race conditions
    SELECT * INTO v_row
    FROM public.shared_moment_notification_deliveries
    WHERE event_id = p_event_id
      AND recipient_id = p_recipient_id
    FOR UPDATE;

    IF v_row.status = 'accepted' THEN
        RETURN pg_catalog.jsonb_build_object(
            'reserved', false,
            'reason', 'already_accepted'
        );
    ELSIF v_row.status = 'failed' THEN
        -- Retry failed delivery
        UPDATE public.shared_moment_notification_deliveries
        SET status = 'pending',
            attempt_count = attempt_count + 1,
            reserved_at = pg_catalog.now(),
            updated_at = pg_catalog.now(),
            last_error = NULL
        WHERE id = v_row.id;

        RETURN pg_catalog.jsonb_build_object(
            'reserved', true,
            'attempt_count', v_row.attempt_count + 1,
            'status', 'pending'
        );
    ELSIF v_row.status = 'pending' THEN
        -- Check if stale
        IF v_row.reserved_at < v_stale_threshold THEN
            UPDATE public.shared_moment_notification_deliveries
            SET attempt_count = attempt_count + 1,
                reserved_at = pg_catalog.now(),
                updated_at = pg_catalog.now()
            WHERE id = v_row.id;

            RETURN pg_catalog.jsonb_build_object(
                'reserved', true,
                'attempt_count', v_row.attempt_count + 1,
                'status', 'pending',
                'retrying_stale', true
            );
        ELSE
            -- Concurrent in-progress attempt
            RETURN pg_catalog.jsonb_build_object(
                'reserved', false,
                'reason', 'pending_in_progress'
            );
        END IF;
    END IF;

    RETURN pg_catalog.jsonb_build_object('reserved', false, 'reason', 'unknown');
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_shared_moment_notification_delivery(uuid, uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_shared_moment_notification_delivery(uuid, uuid, int) TO service_role;

-- Drop legacy 4-arg completion RPC if it exists
DROP FUNCTION IF EXISTS public.complete_shared_moment_notification_delivery(uuid, uuid, text, text);

-- Atomic completion RPC: records final status after contacting Expo, bound to reservation attempt
CREATE OR REPLACE FUNCTION public.complete_shared_moment_notification_delivery(
    p_event_id uuid,
    p_recipient_id uuid,
    p_attempt_count int,
    p_status text,
    p_error text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_updated boolean;
BEGIN
    IF p_status NOT IN ('accepted', 'failed') THEN
        RAISE EXCEPTION 'Invalid status. Must be accepted or failed';
    END IF;

    IF p_status = 'accepted' THEN
        UPDATE public.shared_moment_notification_deliveries
        SET status = 'accepted',
            accepted_at = pg_catalog.now(),
            last_error = NULL,
            updated_at = pg_catalog.now()
        WHERE event_id = p_event_id
          AND recipient_id = p_recipient_id
          AND status = 'pending'
          AND attempt_count = p_attempt_count;
    ELSE
        UPDATE public.shared_moment_notification_deliveries
        SET status = 'failed',
            last_error = p_error,
            updated_at = pg_catalog.now()
        WHERE event_id = p_event_id
          AND recipient_id = p_recipient_id
          AND status = 'pending'
          AND attempt_count = p_attempt_count;
    END IF;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN (v_updated = true);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_shared_moment_notification_delivery(uuid, uuid, int, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_shared_moment_notification_delivery(uuid, uuid, int, text, text) TO service_role;

-- ============================================================================
-- 5. Annoyance Reframes & Relational Integrity Trigger
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.annoyance_reframes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.relationship_events(id) ON DELETE CASCADE,
  topic_key text NOT NULL,
  custom_topic_label text,
  is_playful boolean NOT NULL DEFAULT true,
  reframe_tone text CHECK (reframe_tone IS NULL OR reframe_tone IN ('gentle', 'playful', 'exaggerated')),
  reframe_text text,
  include_reframe_with_partner boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'dismissed', 'resolved')),
  shared_with_partner boolean NOT NULL DEFAULT false,
  challenge_idea text,
  challenge_participant text CHECK (challenge_participant IS NULL OR challenge_participant IN ('me', 'partner', 'both')),
  challenge_timeframe text,
  challenge_reward text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT annoyance_reframes_custom_topic_check CHECK (
    (topic_key = 'other' AND (custom_topic_label IS NULL OR (length(btrim(custom_topic_label)) > 0 AND length(custom_topic_label) <= 60)))
    OR
    (topic_key <> 'other' AND custom_topic_label IS NULL)
  )
);

ALTER TABLE public.annoyance_reframes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.annoyance_reframes TO authenticated;
GRANT ALL ON TABLE public.annoyance_reframes TO service_role;

-- Relational Integrity Trigger: validates event couple matches reframe couple, author is member, prevents couple transfer
CREATE OR REPLACE FUNCTION public.annoyance_reframes_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_event_couple_id uuid;
BEGIN
    -- Verify author is a member of NEW.couple_id
    IF NOT EXISTS (
        SELECT 1 FROM public.couple_members rm
        WHERE rm.couple_id = NEW.couple_id
          AND rm.user_id = NEW.author_id
    ) THEN
        RAISE EXCEPTION 'annoyance_reframes: author is not a member of the couple'
            USING ERRCODE = 'check_violation';
    END IF;

    -- If event_id is non-null, verify that the event belongs to the same couple
    IF NEW.event_id IS NOT NULL THEN
        SELECT e.couple_id INTO v_event_couple_id
        FROM public.relationship_events e
        WHERE e.id = NEW.event_id;

        IF v_event_couple_id IS NULL THEN
            RAISE EXCEPTION 'annoyance_reframes: event % does not exist', NEW.event_id
                USING ERRCODE = 'foreign_key_violation';
        END IF;

        IF v_event_couple_id <> NEW.couple_id THEN
            RAISE EXCEPTION 'annoyance_reframes: event % belongs to a different couple', NEW.event_id
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    -- Prevent modifying couple_id or author_id once created
    IF TG_OP = 'UPDATE' THEN
        IF NEW.couple_id <> OLD.couple_id THEN
            RAISE EXCEPTION 'annoyance_reframes: couple_id cannot be changed'
                USING ERRCODE = 'check_violation';
        END IF;
        IF NEW.author_id <> OLD.author_id THEN
            RAISE EXCEPTION 'annoyance_reframes: author_id cannot be changed'
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_annoyance_reframes_validate ON public.annoyance_reframes;
CREATE TRIGGER on_annoyance_reframes_validate
  BEFORE INSERT OR UPDATE ON public.annoyance_reframes
  FOR EACH ROW
  EXECUTE FUNCTION public.annoyance_reframes_validate();

-- RLS Policies on annoyance_reframes (Base table SELECT exposes full row only to author/service role)
DROP POLICY IF EXISTS "Authors can view own annoyance reframes" ON public.annoyance_reframes;
CREATE POLICY "Authors can view own annoyance reframes"
  ON public.annoyance_reframes
  FOR SELECT TO authenticated
  USING (
    author_id = auth.uid()
  );

-- Authenticated SECURITY DEFINER RPC: Safely exposes active partner challenges with unshared reframe text masked
CREATE OR REPLACE FUNCTION public.get_active_partner_annoyance_challenges(
    p_couple_id uuid
)
RETURNS TABLE (
    id uuid,
    couple_id uuid,
    author_id uuid,
    event_id uuid,
    topic_key text,
    custom_topic_label text,
    is_playful boolean,
    reframe_tone text,
    reframe_text text,
    include_reframe_with_partner boolean,
    status text,
    shared_with_partner boolean,
    challenge_idea text,
    challenge_participant text,
    challenge_timeframe text,
    challenge_reward text,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Verify auth.uid() is a member of p_couple_id
    IF NOT EXISTS (
        SELECT 1 FROM public.couple_members cm
        WHERE cm.couple_id = p_couple_id
          AND cm.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Forbidden: not a member of this couple';
    END IF;

    RETURN QUERY
    SELECT
        ar.id,
        ar.couple_id,
        ar.author_id,
        ar.event_id,
        ar.topic_key,
        ar.custom_topic_label,
        ar.is_playful,
        ar.reframe_tone,
        CASE
            WHEN ar.include_reframe_with_partner THEN ar.reframe_text
            ELSE NULL
        END AS reframe_text,
        ar.include_reframe_with_partner,
        ar.status,
        ar.shared_with_partner,
        ar.challenge_idea,
        ar.challenge_participant,
        ar.challenge_timeframe,
        ar.challenge_reward,
        ar.created_at,
        ar.updated_at
    FROM public.annoyance_reframes ar
    WHERE ar.couple_id = p_couple_id
      AND ar.author_id <> v_user_id
      AND ar.shared_with_partner = true
      AND ar.status = 'active'
    ORDER BY ar.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_active_partner_annoyance_challenges(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_partner_annoyance_challenges(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Authors can insert own annoyance reframes" ON public.annoyance_reframes;
CREATE POLICY "Authors can insert own annoyance reframes"
  ON public.annoyance_reframes
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND couple_id IN (SELECT private.user_couple_ids())
  );

DROP POLICY IF EXISTS "Authors can update own annoyance reframes" ON public.annoyance_reframes;
CREATE POLICY "Authors can update own annoyance reframes"
  ON public.annoyance_reframes
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (
    author_id = auth.uid()
    AND couple_id IN (SELECT private.user_couple_ids())
  );

DROP POLICY IF EXISTS "Authors can delete own annoyance reframes" ON public.annoyance_reframes;
CREATE POLICY "Authors can delete own annoyance reframes"
  ON public.annoyance_reframes
  FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- ============================================================================
-- 6. Author-Only Private Irritation Notes (Strict Ownership Integrity)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.annoyance_private_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reframe_id uuid NOT NULL REFERENCES public.annoyance_reframes(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  private_note text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT annoyance_private_notes_reframe_author_key UNIQUE (reframe_id, author_id)
);

ALTER TABLE public.annoyance_private_notes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.annoyance_private_notes TO authenticated;
GRANT ALL ON TABLE public.annoyance_private_notes TO service_role;

DROP POLICY IF EXISTS "Authors can view own private annoyance notes" ON public.annoyance_private_notes;
CREATE POLICY "Authors can view own private annoyance notes"
  ON public.annoyance_private_notes
  FOR SELECT TO authenticated
  USING (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.annoyance_reframes ar
      WHERE ar.id = reframe_id
        AND ar.author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authors can insert own private annoyance notes" ON public.annoyance_private_notes;
CREATE POLICY "Authors can insert own private annoyance notes"
  ON public.annoyance_private_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.annoyance_reframes ar
      WHERE ar.id = reframe_id
        AND ar.author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authors can update own private annoyance notes" ON public.annoyance_private_notes;
CREATE POLICY "Authors can update own private annoyance notes"
  ON public.annoyance_private_notes
  FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.annoyance_reframes ar
      WHERE ar.id = reframe_id
        AND ar.author_id = auth.uid()
    )
  )
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.annoyance_reframes ar
      WHERE ar.id = reframe_id
        AND ar.author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authors can delete own private annoyance notes" ON public.annoyance_private_notes;
CREATE POLICY "Authors can delete own private annoyance notes"
  ON public.annoyance_private_notes
  FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.annoyance_reframes ar
      WHERE ar.id = reframe_id
        AND ar.author_id = auth.uid()
    )
  );

-- ============================================================================
-- 7. Atomic save_annoyance_reframe RPC (Field Preservation on Updates)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_annoyance_reframe(
    p_couple_id uuid,
    p_topic_key text,
    p_custom_topic_label text,
    p_is_playful boolean,
    p_reframe_tone text,
    p_reframe_text text,
    p_include_reframe_with_partner boolean,
    p_status text,
    p_shared_with_partner boolean,
    p_challenge_idea text,
    p_challenge_participant text,
    p_challenge_timeframe text,
    p_challenge_reward text,
    p_private_note text,
    p_id uuid DEFAULT NULL,
    p_event_id uuid DEFAULT NULL,
    p_clear_reframe_text boolean DEFAULT false,
    p_clear_private_note boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
    v_user_id uuid;
    v_reframe_id uuid;
    v_private_note text;
    v_custom_topic text;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    v_private_note := NULLIF(trim(p_private_note), '');
    v_custom_topic := NULLIF(trim(p_custom_topic_label), '');

    IF p_id IS NOT NULL THEN
        -- Verify author owns reframe
        IF NOT EXISTS (
            SELECT 1 FROM public.annoyance_reframes
            WHERE id = p_id AND author_id = v_user_id
        ) THEN
            RAISE EXCEPTION 'Reframe not found or not owned by user';
        END IF;

        -- Update with strict field preservation when parameters are omitted/null
        UPDATE public.annoyance_reframes
        SET
            topic_key = COALESCE(NULLIF(trim(p_topic_key), ''), topic_key),
            custom_topic_label = CASE
                WHEN p_custom_topic_label IS NOT NULL THEN NULLIF(trim(p_custom_topic_label), '')
                ELSE custom_topic_label
            END,
            is_playful = COALESCE(p_is_playful, is_playful),
            reframe_tone = CASE
                WHEN p_reframe_tone IS NOT NULL THEN NULLIF(trim(p_reframe_tone), '')
                ELSE reframe_tone
            END,
            reframe_text = CASE
                WHEN p_clear_reframe_text THEN NULL
                WHEN p_reframe_text IS NOT NULL THEN NULLIF(trim(p_reframe_text), '')
                ELSE reframe_text
            END,
            include_reframe_with_partner = COALESCE(p_include_reframe_with_partner, include_reframe_with_partner),
            status = COALESCE(p_status, status),
            shared_with_partner = COALESCE(p_shared_with_partner, shared_with_partner),
            challenge_idea = CASE
                WHEN p_challenge_idea IS NOT NULL THEN NULLIF(trim(p_challenge_idea), '')
                ELSE challenge_idea
            END,
            challenge_participant = COALESCE(p_challenge_participant, challenge_participant),
            challenge_timeframe = COALESCE(p_challenge_timeframe, challenge_timeframe),
            challenge_reward = COALESCE(p_challenge_reward, challenge_reward),
            event_id = COALESCE(p_event_id, event_id),
            updated_at = now()
        WHERE id = p_id AND author_id = v_user_id
        RETURNING id INTO v_reframe_id;
    ELSE
        INSERT INTO public.annoyance_reframes (
            couple_id,
            author_id,
            event_id,
            topic_key,
            custom_topic_label,
            is_playful,
            reframe_tone,
            reframe_text,
            include_reframe_with_partner,
            status,
            shared_with_partner,
            challenge_idea,
            challenge_participant,
            challenge_timeframe,
            challenge_reward
        )
        VALUES (
            p_couple_id,
            v_user_id,
            p_event_id,
            p_topic_key,
            v_custom_topic,
            p_is_playful,
            p_reframe_tone,
            p_reframe_text,
            p_include_reframe_with_partner,
            p_status,
            p_shared_with_partner,
            p_challenge_idea,
            p_challenge_participant,
            p_challenge_timeframe,
            p_challenge_reward
        )
        RETURNING id INTO v_reframe_id;
    END IF;

    -- Manage private irritation note with preservation
    IF p_clear_private_note THEN
        DELETE FROM public.annoyance_private_notes
        WHERE reframe_id = v_reframe_id AND author_id = v_user_id;
    ELSIF v_private_note IS NOT NULL THEN
        INSERT INTO public.annoyance_private_notes (
            reframe_id,
            author_id,
            private_note,
            updated_at
        )
        VALUES (
            v_reframe_id,
            v_user_id,
            v_private_note,
            now()
        )
        ON CONFLICT (reframe_id, author_id)
        DO UPDATE SET
            private_note = EXCLUDED.private_note,
            updated_at = now();
    END IF;

    RETURN v_reframe_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_annoyance_reframe(uuid, text, text, boolean, text, text, boolean, text, boolean, text, text, text, text, text, uuid, uuid, boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_annoyance_reframe(uuid, text, text, boolean, text, text, boolean, text, boolean, text, text, text, text, text, uuid, uuid, boolean, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_annoyance_reframe(uuid, text, text, boolean, text, text, boolean, text, boolean, text, text, text, text, text, uuid, uuid, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_annoyance_reframe(uuid, text, text, boolean, text, text, boolean, text, boolean, text, text, text, text, text, uuid, uuid, boolean, boolean) TO service_role;

-- ============================================================================
-- 8. Partner Response RPC (Database-Backed Acceptance/Dismissal Lifecycle)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.respond_to_annoyance_challenge(
    p_reframe_id uuid,
    p_action text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_reframe record;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT * INTO v_reframe
    FROM public.annoyance_reframes
    WHERE id = p_reframe_id;

    IF v_reframe.id IS NULL THEN
        RAISE EXCEPTION 'Challenge invitation not found';
    END IF;

    -- Prevent self-response: author cannot accept or dismiss own invitation
    IF v_reframe.author_id = v_user_id THEN
        RAISE EXCEPTION 'Author cannot respond to own challenge invitation';
    END IF;

    -- Require caller to be the other active couple member
    IF NOT EXISTS (
        SELECT 1 FROM public.couple_members
        WHERE couple_id = v_reframe.couple_id
          AND user_id = v_user_id
          AND user_id <> v_reframe.author_id
    ) THEN
        RAISE EXCEPTION 'Forbidden: not a partner member of this couple';
    END IF;

    -- Verify it is shared and active
    IF NOT (v_reframe.shared_with_partner = true AND v_reframe.status = 'active') THEN
        RAISE EXCEPTION 'Challenge invitation is not active or not shared';
    END IF;

    IF p_action = 'accept' THEN
        UPDATE public.annoyance_reframes
        SET status = 'resolved', updated_at = pg_catalog.now()
        WHERE id = p_reframe_id;
    ELSIF p_action = 'dismiss' THEN
        UPDATE public.annoyance_reframes
        SET status = 'dismissed', updated_at = pg_catalog.now()
        WHERE id = p_reframe_id;
    ELSE
        RAISE EXCEPTION 'Invalid action. Must be accept or dismiss';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_annoyance_challenge(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_to_annoyance_challenge(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.respond_to_annoyance_challenge(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_annoyance_challenge(uuid, text) TO service_role;

COMMIT;
