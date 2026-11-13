-- Migration: create_home_activity_receipts
-- Description: Creates private per-user activity receipt tracking to record when intentional interaction
-- occurs on Home "What matters now" activities (e.g. viewing a Good moment, opening a task, etc.).
-- Security: Strict per-user RLS (users can only read their own receipts within their active couple),
-- source-first couple derivation, hardened source-table semantic validation, and canonical-key integrity.

BEGIN;

-- 1. Create table public.home_activity_receipts
CREATE TABLE public.home_activity_receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_key text NOT NULL,
    activity_kind text NOT NULL,
    source_id uuid NOT NULL,
    attention_mode text NOT NULL,
    seen_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT home_activity_receipts_user_activity_key_unique UNIQUE (user_id, activity_key),
    CONSTRAINT home_activity_receipts_activity_key_check CHECK (
        activity_key = btrim(activity_key) AND
        char_length(activity_key) >= 1 AND
        char_length(activity_key) <= 250
    ),
    CONSTRAINT home_activity_receipts_attention_mode_check CHECK (
        attention_mode IN ('informational', 'actionable')
    ),
    CONSTRAINT home_activity_receipts_activity_kind_check CHECK (
        activity_kind IN (
            'repair_response',
            'repair_both_ready',
            'shared_friction',
            'shared_positive',
            'reconnection_completed',
            'shared_list_added',
            'shared_list_completed',
            'important_date_added',
            'self_shared_moment',
            'resurfaced_moment'
        )
    )
);

-- 2. Automatic updated_at trigger (reuses private.set_updated_at())
CREATE TRIGGER on_home_activity_receipt_updated
BEFORE UPDATE ON public.home_activity_receipts
FOR EACH ROW
EXECUTE FUNCTION private.set_updated_at();

-- 3. Indexes for fast per-user lookups and chronological queries
CREATE INDEX home_activity_receipts_user_seen_idx
ON public.home_activity_receipts USING btree (user_id, seen_at DESC);

CREATE INDEX home_activity_receipts_couple_user_idx
ON public.home_activity_receipts USING btree (couple_id, user_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.home_activity_receipts ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Users may only read their own activity receipts for their active couple
CREATE POLICY "Users can read own activity receipts"
ON public.home_activity_receipts
FOR SELECT TO authenticated
USING (
    user_id = (SELECT auth.uid())
    AND couple_id IN (SELECT private.user_couple_ids())
);

-- 5. Revoke default broad privileges and grant least-privilege permissions
REVOKE ALL ON TABLE public.home_activity_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.home_activity_receipts TO authenticated;
GRANT ALL ON TABLE public.home_activity_receipts TO service_role;

-- 6. RPC: Hardened, source-first couple derivation with canonical-key integrity
CREATE OR REPLACE FUNCTION public.record_home_activity_receipt(
    p_activity_key text,
    p_activity_kind text,
    p_source_id uuid,
    p_attention_mode text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_couple_id uuid := NULL;
    v_source_ts timestamptz := NULL;
    v_ready_count integer := 0;
    v_trimmed_key text;
    v_expected_prefix text;
    v_key_ts_str text;
    v_key_ts timestamptz := NULL;
    v_canonical_key text;
BEGIN
    -- 1. Authentication requirement
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- 2. Basic parameter validations
    IF p_activity_key IS NULL OR p_activity_kind IS NULL OR p_source_id IS NULL OR p_attention_mode IS NULL THEN
        RAISE EXCEPTION 'Activity unavailable';
    END IF;

    v_trimmed_key := btrim(p_activity_key);
    IF char_length(v_trimmed_key) < 1 OR char_length(v_trimmed_key) > 250 THEN
        RAISE EXCEPTION 'Activity unavailable';
    END IF;

    -- 3. Enforce strict kind / attention-mode alignment
    IF (p_activity_kind IN (
        'shared_positive',
        'reconnection_completed',
        'shared_list_added',
        'shared_list_completed',
        'important_date_added',
        'self_shared_moment'
    ) AND p_attention_mode <> 'informational') OR
    (p_activity_kind IN (
        'repair_response',
        'repair_both_ready',
        'shared_friction',
        'resurfaced_moment'
    ) AND p_attention_mode <> 'actionable') THEN
        RAISE EXCEPTION 'Activity unavailable';
    END IF;

    -- 4. Source-first couple derivation and semantic validation
    CASE p_activity_kind
        WHEN 'shared_positive' THEN
            SELECT e.couple_id, e.created_at
            INTO v_couple_id, v_source_ts
            FROM public.relationship_events e
            WHERE e.id = p_source_id
              AND e.visibility = 'ours'
              AND e.event_type = 'positive';

        WHEN 'shared_friction', 'resurfaced_moment' THEN
            SELECT e.couple_id, e.created_at
            INTO v_couple_id, v_source_ts
            FROM public.relationship_events e
            WHERE e.id = p_source_id
              AND e.visibility = 'ours'
              AND e.event_type = 'friction'
              AND e.status IS DISTINCT FROM 'reconnected';

        WHEN 'self_shared_moment' THEN
            SELECT e.couple_id, e.created_at
            INTO v_couple_id, v_source_ts
            FROM public.relationship_events e
            WHERE e.id = p_source_id
              AND e.visibility = 'ours'
              AND e.creator_id = v_user_id;

        WHEN 'repair_response' THEN
            SELECT r.couple_id, COALESCE(r.updated_at, r.shared_at)
            INTO v_couple_id, v_source_ts
            FROM public.relationship_event_repair_responses r
            JOIN public.relationship_events e ON e.id = r.event_id
            WHERE r.id = p_source_id
              AND r.couple_id = e.couple_id
              AND e.visibility = 'ours'
              AND e.status IS DISTINCT FROM 'reconnected';

        WHEN 'repair_both_ready' THEN
            SELECT e.couple_id
            INTO v_couple_id
            FROM public.relationship_events e
            WHERE e.id = p_source_id
              AND e.visibility = 'ours'
              AND e.event_type = 'friction'
              AND e.creator_id = v_user_id
              AND e.status IS DISTINCT FROM 'reconnected';

            IF v_couple_id IS NOT NULL THEN
                -- Validate both distinct partners currently have settlement response_code = 'ready'
                SELECT count(DISTINCT r.user_id), max(COALESCE(r.updated_at, r.shared_at))
                INTO v_ready_count, v_source_ts
                FROM public.relationship_event_repair_responses r
                WHERE r.event_id = p_source_id
                  AND r.phase = 'settlement'
                  AND r.response_code = 'ready';

                IF v_ready_count < 2 OR v_source_ts IS NULL THEN
                    v_couple_id := NULL;
                END IF;
            END IF;

        WHEN 'reconnection_completed' THEN
            SELECT o.couple_id, o.completed_at
            INTO v_couple_id, v_source_ts
            FROM public.relationship_event_repair_outcomes o
            JOIN public.relationship_events e ON e.id = o.event_id
            WHERE o.event_id = p_source_id
              AND o.couple_id = e.couple_id
              AND e.visibility = 'ours'
              AND e.status = 'reconnected'
              AND o.completed_at IS NOT NULL;

        WHEN 'shared_list_added' THEN
            SELECT t.couple_id, t.created_at
            INTO v_couple_id, v_source_ts
            FROM public.couple_tasks t
            WHERE t.id = p_source_id;

        WHEN 'shared_list_completed' THEN
            SELECT t.couple_id, t.completed_at
            INTO v_couple_id, v_source_ts
            FROM public.couple_tasks t
            WHERE t.id = p_source_id
              AND t.status = 'completed'
              AND t.completed_at IS NOT NULL;

        WHEN 'important_date_added' THEN
            SELECT d.couple_id, d.created_at
            INTO v_couple_id, v_source_ts
            FROM public.couple_important_dates d
            WHERE d.id = p_source_id;

        ELSE
            RAISE EXCEPTION 'Activity unavailable';
    END CASE;

    IF v_couple_id IS NULL OR v_source_ts IS NULL THEN
        RAISE EXCEPTION 'Activity unavailable';
    END IF;

    -- 5. Validate caller's active membership in the exact derived source couple
    IF NOT EXISTS (
        SELECT 1
        FROM public.couple_members cm
        WHERE cm.couple_id = v_couple_id
          AND cm.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Activity unavailable';
    END IF;

    -- 6. Activity-key integrity: verify prefix and timestamp alignment
    v_expected_prefix := p_activity_kind || ':' || p_source_id::text || ':';
    IF NOT (v_trimmed_key LIKE v_expected_prefix || '%') THEN
        RAISE EXCEPTION 'Activity unavailable';
    END IF;

    v_key_ts_str := substring(v_trimmed_key from char_length(v_expected_prefix) + 1);
    BEGIN
        v_key_ts := v_key_ts_str::timestamptz;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Activity unavailable';
    END;

    IF v_key_ts IS NULL THEN
        RAISE EXCEPTION 'Activity unavailable';
    END IF;

    -- Verify client-supplied timestamp equals authoritative source timestamp within 1s tolerance
    IF abs(extract(epoch from (v_key_ts - v_source_ts))) > 1 THEN
        RAISE EXCEPTION 'Activity unavailable';
    END IF;

    -- Construct canonical activity key on the server
    v_canonical_key := v_expected_prefix || to_char(v_source_ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

    -- 7. Idempotent write strictly for the authenticated caller
    INSERT INTO public.home_activity_receipts (
        couple_id,
        user_id,
        activity_key,
        activity_kind,
        source_id,
        attention_mode,
        seen_at,
        created_at,
        updated_at
    ) VALUES (
        v_couple_id,
        v_user_id,
        v_canonical_key,
        p_activity_kind,
        p_source_id,
        p_attention_mode,
        now(),
        now(),
        now()
    )
    ON CONFLICT (user_id, activity_key) DO UPDATE SET
        seen_at = now(),
        updated_at = now();
END;
$$;

-- Permissions on RPC function
REVOKE ALL ON FUNCTION public.record_home_activity_receipt(text, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_home_activity_receipt(text, text, uuid, text) TO authenticated, service_role;

-- 7. Realtime setup
ALTER TABLE public.home_activity_receipts REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'home_activity_receipts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.home_activity_receipts;
    END IF;
END;
$$;

COMMIT;
