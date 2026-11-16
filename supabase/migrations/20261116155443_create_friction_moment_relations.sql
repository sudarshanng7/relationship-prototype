-- Purple Garden database change
-- Feature: Repair Memory — "What Helped Before"
-- Purpose: User-specific perspective on relation between a new friction and a prior completed reconnection.
--          Stores relation decisions independently per user (perspective-specific, never shared).
--          Also stores optional post-reconnection helpfulness response.
--          Per-user suggestion suppression is stored in a dedicated table so Partner A's
--          suppression has no effect on Partner B.
-- Data classification: User-specific private perspective data; never shared between partners.
-- Security boundary: RLS user_id checks + couple membership validation via private.user_couple_ids()
-- Introduced: 2026-11-16
-- Note: This is the single consolidated migration. The earlier draft split across two files has
--       been replaced by this file. The second draft (20261116170000) has been removed.

BEGIN;

-- ============================================================================
-- 1. FRICTION MOMENT RELATIONS TABLE
-- ============================================================================

CREATE TABLE public.friction_moment_relations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The newly created friction (the "current" event)
    current_event_id uuid NOT NULL
        REFERENCES public.relationship_events(id)
        ON DELETE CASCADE,

    -- The prior completed reconnection being referenced
    prior_event_id uuid NOT NULL
        REFERENCES public.relationship_events(id)
        ON DELETE CASCADE,

    -- The couple owning both events (cross-couple prevention)
    couple_id uuid NOT NULL
        REFERENCES public.couples(id)
        ON DELETE CASCADE,

    -- The user who made this classification decision (perspective-specific)
    user_id uuid NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    -- User's perspective on the relation
    -- related: clearly the same recurring topic
    -- somewhat_related: feels partly familiar
    -- different: explicitly different; suppresses future suggestions for this pairing
    -- deferred: "maybe later" — keeps the suggestion accessible from the repair loop
    decision text NOT NULL
        CONSTRAINT friction_moment_relations_decision_check
        CHECK (decision IN ('related', 'somewhat_related', 'different', 'deferred')),

    -- Optional post-reconnection helpfulness response (stored after the new event reconnects)
    -- Stored independently per user; never converted into a shared score
    helpfulness_response text NULL
        CONSTRAINT friction_moment_relations_helpfulness_check
        CHECK (helpfulness_response IS NULL OR helpfulness_response IN (
            'yes_helped',
            'a_little',
            'different_way',
            'not_this_time',
            'prefer_not'
        )),

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- One decision record per (current event, prior event, user) triplet
    -- Supports upsert for decision updates
    CONSTRAINT friction_moment_relations_unique_perspective
        UNIQUE (current_event_id, prior_event_id, user_id),

    -- current event and prior event must be different
    CONSTRAINT friction_moment_relations_no_self_reference
        CHECK (current_event_id <> prior_event_id)
);

COMMENT ON TABLE public.friction_moment_relations IS
    'Purple Garden Repair Memory: Stores user-specific perspective on the relation between a new friction and a prior completed reconnection. Each row belongs to exactly one user; partners may hold different classifications for the same event pair.';

COMMENT ON COLUMN public.friction_moment_relations.id IS 'Primary key.';
COMMENT ON COLUMN public.friction_moment_relations.current_event_id IS 'The newly recorded friction event.';
COMMENT ON COLUMN public.friction_moment_relations.prior_event_id IS 'The earlier completed reconnection being referenced.';
COMMENT ON COLUMN public.friction_moment_relations.couple_id IS 'Couple owning both events. Prevents cross-couple relations.';
COMMENT ON COLUMN public.friction_moment_relations.user_id IS 'User who made this classification. Perspective is strictly private to this user.';
COMMENT ON COLUMN public.friction_moment_relations.decision IS 'User perspective: related, somewhat_related, different (suppresses suggestion), deferred (keeps access).';
COMMENT ON COLUMN public.friction_moment_relations.helpfulness_response IS 'Optional post-reconnection reflection stored after the current event reconnects. Never shared or scored.';
COMMENT ON COLUMN public.friction_moment_relations.created_at IS 'When this relation record was first created.';
COMMENT ON COLUMN public.friction_moment_relations.updated_at IS 'When this record was last updated (decision change, helpfulness response added).';

-- ============================================================================
-- 2. PER-USER REPAIR MEMORY SUPPRESSION TABLE
--
--    Partners must be able to suppress automatic Repair Memory suggestions
--    independently for any given friction event they created. One partner's
--    suppression must NOT affect the other partner's suggestions.
--
--    Design rationale for a separate table (not a column on relationship_events):
--    - relationship_events is couple-scoped. Adding suppress_repair_memory there
--      would make Partner A's setting visible to and enforceable against Partner B
--      when they view the same shared event. That violates independent perspectives.
--    - This table is strictly (event_id, user_id) scoped with owner-only RLS,
--      ensuring each partner's suppression preference is completely private.
--    - ON DELETE CASCADE keeps the table self-cleaning.
-- ============================================================================

CREATE TABLE public.friction_repair_memory_suppressions (
    event_id uuid NOT NULL
        REFERENCES public.relationship_events(id)
        ON DELETE CASCADE,

    user_id uuid NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    -- When true, findRepairMemoryCandidates returns empty for this (event, user) pair.
    suppress_suggestions boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (event_id, user_id)
);

COMMENT ON TABLE public.friction_repair_memory_suppressions IS
    'Purple Garden beta feature gate: per-user, per-event suppression of automatic Repair Memory suggestions. '
    'Each partner manages their own suppression independently. '
    'Row existence with suppress_suggestions=true means no suggestion for that (event, user) pair. '
    'ON DELETE CASCADE keeps this table self-cleaning when events or users are deleted.';

COMMENT ON COLUMN public.friction_repair_memory_suppressions.event_id IS 'The friction event for which suggestions are suppressed.';
COMMENT ON COLUMN public.friction_repair_memory_suppressions.user_id IS 'The user who set their suppression preference.';
COMMENT ON COLUMN public.friction_repair_memory_suppressions.suppress_suggestions IS 'When true, no Repair Memory suggestions are shown to this user for this event.';

-- ============================================================================
-- 3. UPDATED_AT TRIGGERS (using private.set_updated_at if available, else inline)
-- ============================================================================

-- Main relations table: inline trigger function (no dependency on private schema)
CREATE OR REPLACE FUNCTION public.friction_moment_relations_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER friction_moment_relations_updated_at
    BEFORE UPDATE ON public.friction_moment_relations
    FOR EACH ROW
    EXECUTE FUNCTION public.friction_moment_relations_set_updated_at();

-- Suppressions table: reuse same pattern
CREATE OR REPLACE FUNCTION public.friction_repair_memory_suppressions_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER friction_repair_memory_suppressions_updated_at
    BEFORE UPDATE ON public.friction_repair_memory_suppressions
    FOR EACH ROW
    EXECUTE FUNCTION public.friction_repair_memory_suppressions_set_updated_at();

-- ============================================================================
-- 4. IDENTITY COLUMNS IMMUTABILITY TRIGGER
--    Prevents UPDATE from changing user_id, couple_id, current_event_id,
--    or prior_event_id after the row is created.
--    Enforced at trigger level (applies to service_role too, unlike RLS).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.friction_moment_relations_protect_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION
            'repair_memory: user_id is immutable after creation (got %, expected %)',
            NEW.user_id, OLD.user_id
            USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.couple_id IS DISTINCT FROM OLD.couple_id THEN
        RAISE EXCEPTION
            'repair_memory: couple_id is immutable after creation (got %, expected %)',
            NEW.couple_id, OLD.couple_id
            USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.current_event_id IS DISTINCT FROM OLD.current_event_id THEN
        RAISE EXCEPTION
            'repair_memory: current_event_id is immutable after creation (got %, expected %)',
            NEW.current_event_id, OLD.current_event_id
            USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.prior_event_id IS DISTINCT FROM OLD.prior_event_id THEN
        RAISE EXCEPTION
            'repair_memory: prior_event_id is immutable after creation (got %, expected %)',
            NEW.prior_event_id, OLD.prior_event_id
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER friction_moment_relations_protect_identity_trigger
    BEFORE UPDATE ON public.friction_moment_relations
    FOR EACH ROW
    EXECUTE FUNCTION public.friction_moment_relations_protect_identity();

-- Suppressions table: event_id and user_id are immutable (they form the PK)
CREATE OR REPLACE FUNCTION public.friction_repair_memory_suppressions_protect_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
    IF NEW.event_id IS DISTINCT FROM OLD.event_id THEN
        RAISE EXCEPTION
            'repair_memory_suppression: event_id is immutable after creation'
            USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION
            'repair_memory_suppression: user_id is immutable after creation'
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER friction_repair_memory_suppressions_protect_identity_trigger
    BEFORE UPDATE ON public.friction_repair_memory_suppressions
    FOR EACH ROW
    EXECUTE FUNCTION public.friction_repair_memory_suppressions_protect_identity();

-- ============================================================================
-- 5. COUPLE MEMBERSHIP AND PRIOR EVENT VALIDATION TRIGGER
--    On INSERT into friction_moment_relations, enforces:
--    a) current_event_id.couple_id = this row's couple_id
--    b) prior_event_id.couple_id = this row's couple_id
--    c) When decision is 'related' or 'somewhat_related', the prior event
--       must be a completed reconnection (status = 'reconnected').
--    d) current_event_id != prior_event_id (belt-and-suspenders; already a CHECK)
--
--    Fires for ALL roles including service_role (unlike RLS).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.friction_moment_relations_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
    v_current_couple_id uuid;
    v_prior_couple_id uuid;
    v_prior_status text;
    v_prior_event_type text;
BEGIN
    -- (a) Self-reference guard (redundant with CHECK, belt-and-suspenders)
    IF NEW.current_event_id = NEW.prior_event_id THEN
        RAISE EXCEPTION
            'repair_memory: current_event_id and prior_event_id must be different'
            USING ERRCODE = 'check_violation';
    END IF;

    -- (b) Verify current event belongs to the declared couple
    SELECT couple_id INTO v_current_couple_id
    FROM public.relationship_events
    WHERE id = NEW.current_event_id;

    IF v_current_couple_id IS NULL THEN
        RAISE EXCEPTION
            'repair_memory: current_event_id % does not exist',
            NEW.current_event_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF v_current_couple_id <> NEW.couple_id THEN
        RAISE EXCEPTION
            'repair_memory: current_event_id % belongs to couple %, not %',
            NEW.current_event_id, v_current_couple_id, NEW.couple_id
            USING ERRCODE = 'check_violation';
    END IF;

    -- (c) Verify prior event belongs to the declared couple
    SELECT couple_id, status, event_type
    INTO v_prior_couple_id, v_prior_status, v_prior_event_type
    FROM public.relationship_events
    WHERE id = NEW.prior_event_id;

    IF v_prior_couple_id IS NULL THEN
        RAISE EXCEPTION
            'repair_memory: prior_event_id % does not exist',
            NEW.prior_event_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF v_prior_couple_id <> NEW.couple_id THEN
        RAISE EXCEPTION
            'repair_memory: prior_event_id % belongs to couple %, not %',
            NEW.prior_event_id, v_prior_couple_id, NEW.couple_id
            USING ERRCODE = 'check_violation';
    END IF;

    -- (d) For 'related' or 'somewhat_related' decisions, the prior event must
    --     be a completed reconnection (status = 'reconnected', event_type = 'friction')
    IF NEW.decision IN ('related', 'somewhat_related') THEN
        IF v_prior_event_type <> 'friction' THEN
            RAISE EXCEPTION
                'repair_memory: prior_event_id % is not a friction event (type=%)',
                NEW.prior_event_id, v_prior_event_type
                USING ERRCODE = 'check_violation';
        END IF;

        IF v_prior_status <> 'reconnected' THEN
            RAISE EXCEPTION
                'repair_memory: prior_event_id % is not a completed reconnection (status=%)',
                NEW.prior_event_id, v_prior_status
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER friction_moment_relations_validate_trigger
    BEFORE INSERT ON public.friction_moment_relations
    FOR EACH ROW
    EXECUTE FUNCTION public.friction_moment_relations_validate();

-- Suppressions table: validate event belongs to user's couple
CREATE OR REPLACE FUNCTION public.friction_repair_memory_suppressions_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
    v_event_couple_id uuid;
BEGIN
    -- The event must belong to a couple the inserting user is a member of
    SELECT e.couple_id INTO v_event_couple_id
    FROM public.relationship_events e
    WHERE e.id = NEW.event_id;

    IF v_event_couple_id IS NULL THEN
        RAISE EXCEPTION
            'repair_memory_suppression: event_id % does not exist', NEW.event_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.couple_members cm
        WHERE cm.couple_id = v_event_couple_id
          AND cm.user_id = NEW.user_id
    ) THEN
        RAISE EXCEPTION
            'repair_memory_suppression: user % is not a member of the couple owning event %',
            NEW.user_id, NEW.event_id
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER friction_repair_memory_suppressions_validate_trigger
    BEFORE INSERT ON public.friction_repair_memory_suppressions
    FOR EACH ROW
    EXECUTE FUNCTION public.friction_repair_memory_suppressions_validate();

-- ============================================================================
-- 6. INDEXES
-- ============================================================================

-- friction_moment_relations: fast lookup by current event + user (repair loop)
CREATE INDEX friction_moment_relations_current_event_user_idx
    ON public.friction_moment_relations (current_event_id, user_id);

-- friction_moment_relations: fast lookup by prior event + user
CREATE INDEX friction_moment_relations_prior_event_user_idx
    ON public.friction_moment_relations (prior_event_id, user_id);

-- friction_moment_relations: couple-scoped lookup for cross-couple prevention
CREATE INDEX friction_moment_relations_couple_user_idx
    ON public.friction_moment_relations (couple_id, user_id);

-- friction_repair_memory_suppressions: PK (event_id, user_id) covers primary lookup
-- Additional index for user-scoped queries
CREATE INDEX friction_repair_memory_suppressions_user_idx
    ON public.friction_repair_memory_suppressions (user_id);

-- ============================================================================
-- 7. ROW LEVEL SECURITY — friction_moment_relations
-- ============================================================================

ALTER TABLE public.friction_moment_relations ENABLE ROW LEVEL SECURITY;

-- Users may read only their own relation records (perspective is private)
CREATE POLICY "Users can view their own relation decisions"
ON public.friction_moment_relations
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

-- Users may insert a relation only for their own couple (prevents cross-couple links)
CREATE POLICY "Users can create relation decisions within their couple"
ON public.friction_moment_relations
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND couple_id IN (SELECT private.user_couple_ids())
    AND EXISTS (
        SELECT 1 FROM public.relationship_events ce
        WHERE ce.id = current_event_id
          AND ce.couple_id = couple_id
          AND (
            ce.creator_id = (SELECT auth.uid())
            OR (ce.visibility = 'ours' AND ce.couple_id IN (SELECT private.user_couple_ids()))
          )
    )
    AND EXISTS (
        SELECT 1 FROM public.relationship_events pe
        WHERE pe.id = prior_event_id
          AND pe.couple_id = couple_id
          AND (
            pe.creator_id = (SELECT auth.uid())
            OR (pe.visibility = 'ours' AND pe.couple_id IN (SELECT private.user_couple_ids()))
          )
    )
);

-- Users may update only their own records; identity columns are protected by trigger
CREATE POLICY "Users can update their own relation decisions"
ON public.friction_moment_relations
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND couple_id IN (SELECT private.user_couple_ids())
);

-- Users may delete only their own records
CREATE POLICY "Users can delete their own relation decisions"
ON public.friction_moment_relations
FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));

-- ============================================================================
-- 8. ROW LEVEL SECURITY — friction_repair_memory_suppressions
-- ============================================================================

ALTER TABLE public.friction_repair_memory_suppressions ENABLE ROW LEVEL SECURITY;

-- Owner-only SELECT
CREATE POLICY "Users can view their own suppression preferences"
ON public.friction_repair_memory_suppressions
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

-- Owner-only INSERT; event must belong to user's couple
CREATE POLICY "Users can create their own suppression preferences"
ON public.friction_repair_memory_suppressions
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.relationship_events e
        JOIN public.couple_members cm ON cm.couple_id = e.couple_id
        WHERE e.id = event_id
          AND cm.user_id = (SELECT auth.uid())
    )
);

-- Owner-only UPDATE (only suppress_suggestions may change; identity protected by trigger)
CREATE POLICY "Users can update their own suppression preferences"
ON public.friction_repair_memory_suppressions
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

-- Owner-only DELETE
CREATE POLICY "Users can delete their own suppression preferences"
ON public.friction_repair_memory_suppressions
FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));

-- ============================================================================
-- 9. GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE public.friction_moment_relations
    TO authenticated;

GRANT ALL
    ON TABLE public.friction_moment_relations
    TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE public.friction_repair_memory_suppressions
    TO authenticated;

GRANT ALL
    ON TABLE public.friction_repair_memory_suppressions
    TO service_role;

GRANT EXECUTE
    ON FUNCTION public.friction_moment_relations_set_updated_at()
    TO authenticated, service_role;

GRANT EXECUTE
    ON FUNCTION public.friction_repair_memory_suppressions_set_updated_at()
    TO authenticated, service_role;

GRANT EXECUTE
    ON FUNCTION public.friction_moment_relations_protect_identity()
    TO authenticated, service_role;

GRANT EXECUTE
    ON FUNCTION public.friction_repair_memory_suppressions_protect_identity()
    TO authenticated, service_role;

GRANT EXECUTE
    ON FUNCTION public.friction_moment_relations_validate()
    TO authenticated, service_role;

GRANT EXECUTE
    ON FUNCTION public.friction_repair_memory_suppressions_validate()
    TO authenticated, service_role;

-- ============================================================================
-- 10. REALTIME PUBLICATION
--     friction_moment_relations: users may want live updates to their own decisions.
--     friction_repair_memory_suppressions: no realtime needed (pure local preference).
-- ============================================================================

ALTER TABLE public.friction_moment_relations REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'friction_moment_relations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.friction_moment_relations;
    END IF;
END;
$$;

COMMIT;
