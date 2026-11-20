-- Migration: harden_weekly_reflection_privileges
-- Description: Hardens public.weekly_reflections table privileges and public.weekly_reflections_validate()
-- execution privileges to strictly enforce least privilege before alpha distribution.
-- - Revokes unnecessary table privileges (TRUNCATE, REFERENCES, TRIGGER) from authenticated.
-- - Revokes all table privileges from anon and PUBLIC.
-- - Explicitly grants only SELECT, INSERT, UPDATE, DELETE to authenticated.
-- - Revokes direct EXECUTE on public.weekly_reflections_validate() from PUBLIC, anon, and authenticated.
-- - Grants EXECUTE on public.weekly_reflections_validate() only to service_role.

BEGIN;

-- 1. Table privilege hardening on public.weekly_reflections
REVOKE ALL ON TABLE public.weekly_reflections FROM PUBLIC;
REVOKE ALL ON TABLE public.weekly_reflections FROM anon;
REVOKE ALL ON TABLE public.weekly_reflections FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.weekly_reflections TO authenticated;
GRANT ALL ON TABLE public.weekly_reflections TO service_role;

-- 2. Function execution hardening on public.weekly_reflections_validate()
REVOKE ALL ON FUNCTION public.weekly_reflections_validate() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.weekly_reflections_validate() FROM anon;
REVOKE ALL ON FUNCTION public.weekly_reflections_validate() FROM authenticated;

GRANT EXECUTE ON FUNCTION public.weekly_reflections_validate() TO service_role;

COMMIT;
