
-- ROS-03C Step 5C.2b
-- Restrict authenticated INSERT permissions on relationship_events.
--
-- Only columns needed by create_relationship_moment remain insertable.
-- Legacy repair fields must not be populated through direct INSERT.
--
-- Existing events, private reflections, and repair states are unchanged.

BEGIN;

-- Remove unrestricted table-level INSERT access.
REVOKE INSERT
ON TABLE public.relationship_events
FROM authenticated;

-- Explicitly remove any legacy column-level INSERT grants.
REVOKE INSERT (
    status,
    repair_method,
    reconnected_at
)
ON TABLE public.relationship_events
FROM authenticated;

-- Permit the columns used by create_relationship_moment.
-- id and created_at continue using database defaults.
GRANT INSERT (
    couple_id,
    creator_id,
    event_type,
    category,
    intensity,
    visibility,
    shared_topic
)
ON TABLE public.relationship_events
TO authenticated;

COMMIT;
