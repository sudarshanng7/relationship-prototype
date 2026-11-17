-- Purple Garden database migration
-- Feature: Repair Memory — Enforce Same-Category Invariant
-- Purpose: Enforce that all friction_moment_relations rows connect events
--          having exactly the same non-null category, regardless of decision
--          (related, somewhat_related, deferred, different).
-- Security: SECURITY DEFINER with safe search_path, explicit object qualification,
--           restricted EXECUTE privilege.

BEGIN;

CREATE OR REPLACE FUNCTION public.friction_moment_relations_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
DECLARE
    v_current_couple_id uuid;
    v_prior_couple_id uuid;
    v_prior_status text;
    v_prior_event_type text;
    v_current_category text;
    v_prior_category text;
BEGIN
    -- (a) Self-reference guard (redundant with CHECK, belt-and-suspenders)
    IF NEW.current_event_id = NEW.prior_event_id THEN
        RAISE EXCEPTION
            'repair_memory: current_event_id and prior_event_id must be different'
            USING ERRCODE = 'check_violation';
    END IF;

    -- (b) Verify current event belongs to the declared couple and fetch category
    SELECT couple_id, category
    INTO v_current_couple_id, v_current_category
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

    -- (c) Verify prior event belongs to the declared couple, fetch category, status, event_type
    SELECT couple_id, status, event_type, category
    INTO v_prior_couple_id, v_prior_status, v_prior_event_type, v_prior_category
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

    -- (d) Strict category match: both events must have non-null matching categories
    --     Applies to all relation decisions (related, somewhat_related, deferred, different)
    IF v_current_category IS NULL
       OR v_prior_category IS NULL
       OR v_current_category IS DISTINCT FROM v_prior_category THEN
        RAISE EXCEPTION
            'repair_memory: related events must share the same category (current: %, prior: %)',
            v_current_category, v_prior_category
            USING ERRCODE = 'check_violation';
    END IF;

    -- (e) For 'related' or 'somewhat_related' decisions, the prior event must
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

-- Ensure minimum execute privileges (revoke public/anon RPC execution)
REVOKE ALL ON FUNCTION public.friction_moment_relations_validate() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.friction_moment_relations_validate() FROM anon;
GRANT EXECUTE ON FUNCTION public.friction_moment_relations_validate() TO authenticated, service_role;

COMMENT ON FUNCTION public.friction_moment_relations_validate() IS
    'Validates couple ownership, reconnection status, and identical non-null categories for all friction moment relations.';

COMMIT;
