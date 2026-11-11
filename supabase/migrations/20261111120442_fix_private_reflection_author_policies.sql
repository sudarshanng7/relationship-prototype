-- Purple Garden database change
-- Feature: Private Reflection Author Policies
-- Purpose: Consolidate and correct RLS policies on public.event_private_reflections so every authenticated author can manage their own private reflections while strictly enforcing partner isolation
-- Data classification: Strictly confidential personal reflections (never readable by partners)
-- Security boundary: author_id = auth.uid(), event existence, event creator or couple-scoped shared friction event
-- Introduced: 2026-11-11

BEGIN;

-- ============================================================================
-- 1. DROP LEGACY AND OVERLAPPING POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Creators can add private reflections" ON public.event_private_reflections;
DROP POLICY IF EXISTS "Couple members can add private reflections to shared friction events" ON public.event_private_reflections;
DROP POLICY IF EXISTS "Authors can read private reflections" ON public.event_private_reflections;
DROP POLICY IF EXISTS "Authors can update private reflections" ON public.event_private_reflections;
DROP POLICY IF EXISTS "Authors can delete private reflections" ON public.event_private_reflections;
DROP POLICY IF EXISTS "Authors can add private reflections" ON public.event_private_reflections;

-- ============================================================================
-- 2. CONSOLIDATED INSERT POLICY
-- ============================================================================

CREATE POLICY "Authors can add private reflections"
ON public.event_private_reflections
FOR INSERT TO authenticated
WITH CHECK (
    author_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.relationship_events e
        WHERE e.id = event_id
          AND (
              e.creator_id = (SELECT auth.uid())
              OR (
                  e.visibility = 'ours'
                  AND e.event_type = 'friction'
                  AND e.couple_id IN (SELECT private.user_couple_ids())
              )
          )
    )
);

-- ============================================================================
-- 3. RECREATED SELECT POLICY (STRICT MUTUAL PARTNER ISOLATION)
-- ============================================================================

CREATE POLICY "Authors can read private reflections"
ON public.event_private_reflections
FOR SELECT TO authenticated
USING (
    author_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.relationship_events e
        WHERE e.id = event_id
          AND (
              e.creator_id = (SELECT auth.uid())
              OR (
                  e.visibility = 'ours'
                  AND e.event_type = 'friction'
                  AND e.couple_id IN (SELECT private.user_couple_ids())
              )
          )
    )
);

-- ============================================================================
-- 4. RECREATED UPDATE POLICY (IDENTICAL USING AND WITH CHECK)
-- ============================================================================

CREATE POLICY "Authors can update private reflections"
ON public.event_private_reflections
FOR UPDATE TO authenticated
USING (
    author_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.relationship_events e
        WHERE e.id = event_id
          AND (
              e.creator_id = (SELECT auth.uid())
              OR (
                  e.visibility = 'ours'
                  AND e.event_type = 'friction'
                  AND e.couple_id IN (SELECT private.user_couple_ids())
              )
          )
    )
)
WITH CHECK (
    author_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.relationship_events e
        WHERE e.id = event_id
          AND (
              e.creator_id = (SELECT auth.uid())
              OR (
                  e.visibility = 'ours'
                  AND e.event_type = 'friction'
                  AND e.couple_id IN (SELECT private.user_couple_ids())
              )
          )
    )
);

-- ============================================================================
-- 5. RECREATED DELETE POLICY
-- ============================================================================

CREATE POLICY "Authors can delete private reflections"
ON public.event_private_reflections
FOR DELETE TO authenticated
USING (
    author_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.relationship_events e
        WHERE e.id = event_id
          AND (
              e.creator_id = (SELECT auth.uid())
              OR (
                  e.visibility = 'ours'
                  AND e.event_type = 'friction'
                  AND e.couple_id IN (SELECT private.user_couple_ids())
              )
          )
    )
);

-- ============================================================================
-- 6. POLICY DOCUMENTATION COMMENTS
-- ============================================================================

COMMENT ON POLICY "Authors can add private reflections" ON public.event_private_reflections IS
    'Purple Garden Privacy Boundary: Allows authenticated users to author private reflections strictly for their own events or shared friction moments in their active couple. Requires author_id = auth.uid().';

COMMENT ON POLICY "Authors can read private reflections" ON public.event_private_reflections IS
    'Purple Garden Privacy Boundary: Strict partner reflection isolation. Authenticated users may read only their own private reflections (author_id = auth.uid()) on valid accessible events. Partners can never read each others private reflections.';

COMMENT ON POLICY "Authors can update private reflections" ON public.event_private_reflections IS
    'Purple Garden Privacy Boundary: Authenticated users may update only their own private reflections (author_id = auth.uid()) without transferring authorship or reassigning to inaccessible events.';

COMMENT ON POLICY "Authors can delete private reflections" ON public.event_private_reflections IS
    'Purple Garden Privacy Boundary: Authenticated users may delete only their own private reflections (author_id = auth.uid()) on valid accessible events.';

COMMIT;
