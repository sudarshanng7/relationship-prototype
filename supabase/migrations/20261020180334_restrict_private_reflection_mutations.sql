
BEGIN;

-- ROS-03B security hardening:
-- Current couple membership is required to modify
-- or delete a private reflection.
--
-- The existing SELECT policy already requires
-- current access to the parent event.

DROP POLICY IF EXISTS "Authors can update private reflections"
ON public.event_private_reflections;

CREATE POLICY "Authors can update private reflections"
ON public.event_private_reflections
FOR UPDATE TO authenticated
USING (
    author_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.relationship_events e
        WHERE e.id = event_id
          AND e.creator_id = (SELECT auth.uid())
    )
)
WITH CHECK (
    author_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.relationship_events e
        WHERE e.id = event_id
          AND e.creator_id = (SELECT auth.uid())
    )
);

DROP POLICY IF EXISTS "Authors can delete private reflections"
ON public.event_private_reflections;

CREATE POLICY "Authors can delete private reflections"
ON public.event_private_reflections
FOR DELETE TO authenticated
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
