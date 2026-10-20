
BEGIN;

-- ROS-03B: Current couple membership is required
-- to read a relationship event, even for its creator.
--
-- Mine: only the creator, while still a member.
-- Ours: any current member of the event's couple.

DROP POLICY IF EXISTS "Users can view permitted events"
ON public.relationship_events;

CREATE POLICY "Users can view permitted events"
ON public.relationship_events
FOR SELECT
TO authenticated
USING (
    couple_id IN (
        SELECT private.user_couple_ids()
    )
    AND (
        creator_id = (SELECT auth.uid())
        OR visibility = 'ours'
    )
);

COMMIT;
