
-- ROS-03A: Prevent clients from reassigning private reflections.

-- Remove the existing broad UPDATE grant.
REVOKE UPDATE
ON TABLE public.event_private_reflections
FROM authenticated;

-- Allow users to edit only the reflection's content
-- and its modification timestamp.
GRANT UPDATE (note, updated_at)
ON TABLE public.event_private_reflections
TO authenticated;

-- The existing RLS policies still ensure that
-- users can update only their own reflections.
