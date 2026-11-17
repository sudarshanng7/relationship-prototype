
BEGIN;

-- ROS-03B security fix:
-- Remove broad UPDATE permissions before granting
-- updates to specific perspective fields.

REVOKE UPDATE
ON TABLE public.event_perspectives
FROM authenticated;

GRANT UPDATE (
    perspective_text,
    sharing_status,
    updated_at
)
ON TABLE public.event_perspectives
TO authenticated;

COMMIT;
