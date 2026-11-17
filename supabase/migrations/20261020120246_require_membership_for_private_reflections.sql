
BEGIN;

-- Require current access to the parent event
-- before allowing an author to read their reflection.

DROP POLICY IF EXISTS "Authors can read private reflections"
ON public.event_private_reflections;

CREATE POLICY "Authors can read private reflections"
ON public.event_private_reflections
FOR SELECT TO authenticated
USING (
    author_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.relationship_events e
        WHERE e.id = event_id
          AND e.creator_id = (SELECT auth.uid())
    )
);

COMMIT;
