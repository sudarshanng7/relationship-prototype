-- ROS-03C / 02 — REVISED LEGACY CUTOVER DRAFT v2 / REVIEW ONLY / DO NOT EXECUTE
-- Depends on 01, successful local RLS tests, revised Event Detail + Moments UI,
-- and coordinated activation. NEVER deploy this ahead of compatible client.
-- WARNING: Existing deployed clients reading relationship_events.status,
-- repair_method or reconnected_at WILL BREAK after this cutover.

BEGIN;

-- Prevent concurrent legacy-column writes while snapshot verification,
-- delta import, and DROP COLUMN are performed in the SAME transaction.
-- This is a blocking operation. Schedule a maintenance window.
LOCK TABLE public.relationship_events IN ACCESS EXCLUSIVE MODE;

-- Abort rather than silently discard a legacy edit made after Draft 01.
-- This check covers source rows existing at the time of the snapshot.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM private.ros03c_legacy_repair_snapshot s
        JOIN public.relationship_events e ON e.id = s.event_id
        WHERE (e.status, e.repair_method, e.reconnected_at)
          IS DISTINCT FROM (s.repair_status, s.what_helped, s.reconnected_at)
    ) THEN
        RAISE EXCEPTION
          'Legacy repair rows changed after ROS-03C additive backfill; reconcile before cutover';
    END IF;
END;
$$;

-- Import events CREATED AFTER Draft 01, while old creation function still
-- set a default Open. Do not overwrite a user's newer explicit report.
INSERT INTO public.event_repair_states (
    event_id, user_id, repair_status, what_helped, sharing_status,
    reported_at, status_origin
)
SELECT
    e.id, e.creator_id, e.status, e.repair_method, 'private',
    CASE WHEN e.status = 'reconnected' THEN e.reconnected_at ELSE NULL END,
    CASE WHEN e.status = 'open'
      THEN 'legacy_default_unconfirmed'
      ELSE 'legacy_creator_report'
    END
FROM public.relationship_events e
WHERE e.event_type = 'friction' AND e.status IS NOT NULL
ON CONFLICT (event_id, user_id) DO NOTHING;

-- Confirm SQL references/dependencies on the legacy columns before running.
-- This replacement is based on the current tracked creator RPC definition.
-- New friction moments will have NO personal status row until a user reports.
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
DECLARE
    v_user_id uuid;
    v_event_id uuid;
    v_private_note text;
    v_shared_topic text;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    IF p_visibility IS NULL OR p_visibility NOT IN ('mine','ours') THEN
        RAISE EXCEPTION 'Invalid visibility';
    END IF;
    IF p_event_type IS NULL OR p_event_type NOT IN ('positive','friction') THEN
        RAISE EXCEPTION 'Invalid event type';
    END IF;
    IF p_category IS NULL OR btrim(p_category) = '' THEN
        RAISE EXCEPTION 'Category is required';
    END IF;
    IF p_event_type = 'friction'
       AND (p_intensity IS NULL OR p_intensity NOT BETWEEN 1 AND 5) THEN
        RAISE EXCEPTION 'Friction intensity must be between 1 and 5';
    END IF;

    v_private_note := NULLIF(btrim(p_private_note), '');
    v_shared_topic := NULLIF(btrim(p_shared_topic), '');
    IF p_visibility = 'mine' AND v_shared_topic IS NOT NULL THEN
        RAISE EXCEPTION 'Private moments cannot contain shared topics';
    END IF;

    -- No more status, repair_method or reconnected_at on shared parent rows.
    INSERT INTO public.relationship_events (
        couple_id, creator_id, event_type, category, intensity,
        visibility, shared_topic
    ) VALUES (
        p_couple_id, v_user_id, p_event_type, btrim(p_category),
        CASE WHEN p_event_type = 'friction' THEN p_intensity ELSE NULL END,
        p_visibility, v_shared_topic
    ) RETURNING id INTO v_event_id;

    IF v_private_note IS NOT NULL THEN
        INSERT INTO public.event_private_reflections (event_id, author_id, note)
        VALUES (v_event_id, v_user_id, v_private_note);
    END IF;
    RETURN v_event_id;
END;
$$;

-- Do NOT CASCADE-drop: unreviewed views/functions must block this cutover.
-- Parent events no longer contain an author's individual repair state.
ALTER TABLE public.relationship_events
    DROP COLUMN status,
    DROP COLUMN repair_method,
    DROP COLUMN reconnected_at;

-- Private snapshot is no longer needed after a successful atomic cutover.
DROP TABLE private.ros03c_legacy_repair_snapshot;

-- Remove legacy creator UPDATE grants. Visibility continues to be changed
-- only through the existing owner-checked set_moment_visibility() RPC.
REVOKE UPDATE ON TABLE public.relationship_events FROM authenticated;

-- Application MUST stop selecting/updating old fields on Event Detail and
-- Moments. Do not infer joint repair from the two child rows.
COMMIT;
