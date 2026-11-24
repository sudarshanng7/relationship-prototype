-- Migration: 20261124213000_create_challenge_completion_and_memories.sql
-- Purpose: Persistent challenge completion, per-partner shared memories, and atomic completion RPC.
-- Strictly preserves: status = 'resolved' as accepted; completion is stored orthogonally via completed_at / completed_by.

BEGIN;

-- 1. Add persistent challenge completion metadata to annoyance_reframes
ALTER TABLE public.annoyance_reframes
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES auth.users(id);

-- 2. Create dedicated challenge memories table (one row per partner)
CREATE TABLE IF NOT EXISTS public.challenge_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reframe_id uuid NOT NULL REFERENCES public.annoyance_reframes(id) ON DELETE CASCADE,
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction text CHECK (reaction IS NULL OR reaction IN (
    'That felt good',
    'We should do this again',
    'It surprised me',
    'A small thing, but meaningful'
  )),
  memory_note text CHECK (memory_note IS NULL OR length(btrim(memory_note)) <= 280),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT challenge_memories_unique_partner UNIQUE (reframe_id, user_id)
);

-- Index for efficient querying by couple_id and reframe_id
CREATE INDEX IF NOT EXISTS idx_challenge_memories_couple_id
  ON public.challenge_memories(couple_id);

CREATE INDEX IF NOT EXISTS idx_challenge_memories_reframe_id
  ON public.challenge_memories(reframe_id);

-- Enable RLS
ALTER TABLE public.challenge_memories ENABLE ROW LEVEL SECURITY;

-- Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.challenge_memories TO authenticated;
GRANT ALL ON TABLE public.challenge_memories TO service_role;

-- RLS Policies
DROP POLICY IF EXISTS "Couple members can view challenge memories" ON public.challenge_memories;
CREATE POLICY "Couple members can view challenge memories"
  ON public.challenge_memories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = challenge_memories.couple_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own challenge memories" ON public.challenge_memories;
CREATE POLICY "Users can insert own challenge memories"
  ON public.challenge_memories FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = challenge_memories.couple_id
        AND cm.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.annoyance_reframes ar
      WHERE ar.id = challenge_memories.reframe_id
        AND ar.couple_id = challenge_memories.couple_id
    )
  );

DROP POLICY IF EXISTS "Users can update own challenge memories" ON public.challenge_memories;
CREATE POLICY "Users can update own challenge memories"
  ON public.challenge_memories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = challenge_memories.couple_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own challenge memories" ON public.challenge_memories;
CREATE POLICY "Users can delete own challenge memories"
  ON public.challenge_memories FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Atomic Completion RPC
CREATE OR REPLACE FUNCTION public.complete_annoyance_challenge(
    p_reframe_id uuid,
    p_reaction text DEFAULT NULL,
    p_memory_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_reframe record;
    v_trimmed_note text;
    v_clean_reaction text;
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

    -- Verify membership in couple
    IF NOT EXISTS (
        SELECT 1 FROM public.couple_members
        WHERE couple_id = v_reframe.couple_id
          AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Forbidden: not a member of this couple';
    END IF;

    -- Require shared_with_partner = true
    IF NOT COALESCE(v_reframe.shared_with_partner, false) THEN
        RAISE EXCEPTION 'Challenge has not been shared with partner';
    END IF;

    -- Must be in accepted ('resolved') state to complete
    IF v_reframe.status <> 'resolved' THEN
        RAISE EXCEPTION 'Challenge must be accepted (status = resolved) before it can be completed';
    END IF;

    -- Validate reaction if provided
    IF p_reaction IS NOT NULL THEN
        v_clean_reaction := pg_catalog.btrim(p_reaction);
        IF v_clean_reaction NOT IN (
            'That felt good',
            'We should do this again',
            'It surprised me',
            'A small thing, but meaningful'
        ) THEN
            RAISE EXCEPTION 'Invalid reaction value';
        END IF;
    ELSE
        v_clean_reaction := NULL;
    END IF;

    -- Validate and trim memory note if provided
    IF p_memory_note IS NOT NULL THEN
        v_trimmed_note := pg_catalog.btrim(p_memory_note);
        IF pg_catalog.length(v_trimmed_note) = 0 THEN
            v_trimmed_note := NULL;
        ELSIF pg_catalog.length(v_trimmed_note) > 280 THEN
            RAISE EXCEPTION 'Memory note must not exceed 280 characters';
        END IF;
    ELSE
        v_trimmed_note := NULL;
    END IF;

    -- Mark completion idempotently: preserve original completed_at & completed_by
    UPDATE public.annoyance_reframes
    SET completed_at = COALESCE(completed_at, pg_catalog.now()),
        completed_by = COALESCE(completed_by, v_user_id),
        updated_at = pg_catalog.now()
    WHERE id = p_reframe_id;

    -- Upsert caller's memory reflection if provided
    IF v_clean_reaction IS NOT NULL OR v_trimmed_note IS NOT NULL THEN
        INSERT INTO public.challenge_memories (
            reframe_id, couple_id, user_id, reaction, memory_note, created_at, updated_at
        )
        VALUES (
            p_reframe_id, v_reframe.couple_id, v_user_id, v_clean_reaction, v_trimmed_note, pg_catalog.now(), pg_catalog.now()
        )
        ON CONFLICT (reframe_id, user_id)
        DO UPDATE SET
            reaction = EXCLUDED.reaction,
            memory_note = EXCLUDED.memory_note,
            updated_at = pg_catalog.now();
    END IF;

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'reframe_id', p_reframe_id,
        'completed_at', (SELECT completed_at FROM public.annoyance_reframes WHERE id = p_reframe_id),
        'completed_by', (SELECT completed_by FROM public.annoyance_reframes WHERE id = p_reframe_id)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_annoyance_challenge(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_annoyance_challenge(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_annoyance_challenge(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_annoyance_challenge(uuid, text, text) TO service_role;

-- 4. Safe RPC to fetch challenge memories for couple members
CREATE OR REPLACE FUNCTION public.get_challenge_memories(
    p_reframe_id uuid
)
RETURNS TABLE (
    id uuid,
    reframe_id uuid,
    couple_id uuid,
    user_id uuid,
    reaction text,
    memory_note text,
    created_at timestamptz,
    updated_at timestamptz
)
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
        RETURN;
    END IF;

    -- Verify membership in couple
    IF NOT EXISTS (
        SELECT 1 FROM public.couple_members
        WHERE couple_id = v_reframe.couple_id
          AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Forbidden: not a member of this couple';
    END IF;

    RETURN QUERY
    SELECT cm.id, cm.reframe_id, cm.couple_id, cm.user_id, cm.reaction, cm.memory_note, cm.created_at, cm.updated_at
    FROM public.challenge_memories cm
    WHERE cm.reframe_id = p_reframe_id
    ORDER BY cm.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_challenge_memories(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_challenge_memories(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_challenge_memories(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_challenge_memories(uuid) TO service_role;

COMMIT;
