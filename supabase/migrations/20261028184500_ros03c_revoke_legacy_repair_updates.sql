
-- ROS-03C Step 5C.2a
-- Revoke direct authenticated updates to legacy repair columns.
--
-- Independent repair reports must be modified through
-- the authorized event_repair_states RPCs.
--
-- This migration does not modify existing data, RLS
-- policies, INSERT grants or SELECT grants.

BEGIN;

REVOKE UPDATE (
    status,
    repair_method,
    reconnected_at
)
ON TABLE public.relationship_events
FROM authenticated;

COMMIT;
