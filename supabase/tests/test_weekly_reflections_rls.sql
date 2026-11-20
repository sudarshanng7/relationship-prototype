-- Purple Garden — Weekly Reflections RLS & Integrity Database Tests
-- =======================================================================
--
-- PURPOSE:
--   Executable pgTAP tests for public.weekly_reflections:
--   - Privilege hardening: table grants, least-privilege verification.
--   - Function execution hardening: direct EXECUTE revoked from PUBLIC, anon, authenticated.
--   - RLS verification: owner insert/select/update, partner isolation, outsider rejection,
--     anonymous rejection.
--   - Integrity triggers & constraints: trigger fires for authenticated user, unique period,
--     answer validation, note length, and couple membership validation.
--
-- =======================================================================

BEGIN;
SELECT plan(38);

-- SETUP: extensions
CREATE EXTENSION IF NOT EXISTS pgtap;

-- =======================================================================
-- 1. Table Privilege & RLS Hardening Assertions
-- =======================================================================

SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.weekly_reflections'::regclass),
  true,
  '1. RLS remains enabled on public.weekly_reflections'
);

-- anon table privileges
SELECT is(has_table_privilege('anon', 'public.weekly_reflections', 'SELECT'), false, '2a. anon has no SELECT on weekly_reflections');
SELECT is(has_table_privilege('anon', 'public.weekly_reflections', 'INSERT'), false, '2b. anon has no INSERT on weekly_reflections');
SELECT is(has_table_privilege('anon', 'public.weekly_reflections', 'UPDATE'), false, '2c. anon has no UPDATE on weekly_reflections');
SELECT is(has_table_privilege('anon', 'public.weekly_reflections', 'DELETE'), false, '2d. anon has no DELETE on weekly_reflections');
SELECT is(has_table_privilege('anon', 'public.weekly_reflections', 'TRUNCATE'), false, '2e. anon has no TRUNCATE on weekly_reflections');

-- authenticated table privileges (only SELECT, INSERT, UPDATE, DELETE)
SELECT is(has_table_privilege('authenticated', 'public.weekly_reflections', 'SELECT'), true, '3a. authenticated has SELECT on weekly_reflections');
SELECT is(has_table_privilege('authenticated', 'public.weekly_reflections', 'INSERT'), true, '3b. authenticated has INSERT on weekly_reflections');
SELECT is(has_table_privilege('authenticated', 'public.weekly_reflections', 'UPDATE'), true, '3c. authenticated has UPDATE on weekly_reflections');
SELECT is(has_table_privilege('authenticated', 'public.weekly_reflections', 'DELETE'), true, '3d. authenticated has DELETE on weekly_reflections');

-- authenticated must NOT retain TRUNCATE, REFERENCES, TRIGGER
SELECT is(has_table_privilege('authenticated', 'public.weekly_reflections', 'TRUNCATE'), false, '4. authenticated does not have TRUNCATE on weekly_reflections');
SELECT is(has_table_privilege('authenticated', 'public.weekly_reflections', 'REFERENCES'), false, '5. authenticated does not have REFERENCES on weekly_reflections');
SELECT is(has_table_privilege('authenticated', 'public.weekly_reflections', 'TRIGGER'), false, '6. authenticated does not have TRIGGER on weekly_reflections');

-- =======================================================================
-- 2. Function Execution Hardening Assertions
-- =======================================================================

SELECT is(has_function_privilege('public', 'public.weekly_reflections_validate()', 'EXECUTE'), false, '7. PUBLIC cannot execute weekly_reflections_validate()');
SELECT is(has_function_privilege('anon', 'public.weekly_reflections_validate()', 'EXECUTE'), false, '8. anon cannot execute weekly_reflections_validate()');
SELECT is(has_function_privilege('authenticated', 'public.weekly_reflections_validate()', 'EXECUTE'), false, '9. authenticated cannot execute weekly_reflections_validate()');

-- Direct execution rejection checks
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT public.weekly_reflections_validate(); $$,
  '42501',
  NULL,
  '10. authenticated direct execution of weekly_reflections_validate() throws permission denied'
);

SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ SELECT public.weekly_reflections_validate(); $$,
  '42501',
  NULL,
  '11. anon direct execution of weekly_reflections_validate() throws permission denied'
);

-- =======================================================================
-- 3. Fixtures for RLS & Integrity Tests
-- =======================================================================

RESET ROLE;

-- Test fixtures: deterministic UUIDs
CREATE TEMP TABLE weekly_test_ids (key text PRIMARY KEY, value uuid);
INSERT INTO weekly_test_ids (key, value) VALUES
  ('user_a',   '00000003-0001-0001-0001-000000000001'::uuid),
  ('user_b',   '00000003-0002-0002-0002-000000000002'::uuid),
  ('user_c',   '00000003-0003-0003-0003-000000000003'::uuid),
  ('couple_1', '00000003-cccc-1111-0001-000000000001'::uuid),
  ('couple_2', '00000003-cccc-2222-0002-000000000002'::uuid);

-- Create mock auth users
INSERT INTO auth.users (id, email)
SELECT value, key || '@example.com'
FROM weekly_test_ids
WHERE key IN ('user_a', 'user_b', 'user_c');

-- Create Couples & Members
INSERT INTO public.couples (id, created_by)
SELECT value, '00000003-0001-0001-0001-000000000001'::uuid
FROM weekly_test_ids
WHERE key = 'couple_1';

-- User A is auto-added as member via created_by trigger; add User B as partner:
INSERT INTO public.couple_members (couple_id, user_id)
VALUES
  ('00000003-cccc-1111-0001-000000000001'::uuid, '00000003-0002-0002-0002-000000000002'::uuid);

INSERT INTO public.couples (id, created_by)
SELECT value, '00000003-0003-0003-0003-000000000003'::uuid
FROM weekly_test_ids
WHERE key = 'couple_2';
-- User C is auto-added as member of couple_2 via created_by trigger

-- =======================================================================
-- 4. Owner Insert (Validates Trigger Execution for Authenticated User)
-- =======================================================================

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000003-0001-0001-0001-000000000001"}';

SELECT lives_ok(
  $$
    INSERT INTO public.weekly_reflections (
      user_id,
      couple_id,
      week_start,
      week_end,
      stayed_with,
      carry_forward,
      private_note
    ) VALUES (
      '00000003-0001-0001-0001-000000000001'::uuid,
      '00000003-cccc-1111-0001-000000000001'::uuid,
      '2026-11-16T00:00:00Z'::timestamptz,
      '2026-11-23T00:00:00Z'::timestamptz,
      'A moment of closeness',
      'More time together',
      'Quiet tea in the morning was lovely.'
    );
  $$,
  '12. Owner (User A) can insert own weekly reflection through validation trigger'
);

-- =======================================================================
-- 5. Partner Insert Rejection (spoofing user_id)
-- =======================================================================

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000003-0002-0002-0002-000000000002"}';

SELECT throws_ok(
  $$
    INSERT INTO public.weekly_reflections (
      user_id,
      couple_id,
      week_start,
      week_end,
      stayed_with,
      carry_forward
    ) VALUES (
      '00000003-0001-0001-0001-000000000001'::uuid,
      '00000003-cccc-1111-0001-000000000001'::uuid,
      '2026-11-23T00:00:00Z'::timestamptz,
      '2026-11-30T00:00:00Z'::timestamptz,
      'A moment of closeness',
      'More time together'
    );
  $$,
  NULL,
  '13. Partner (User B) cannot insert reflection with User A user_id'
);

-- =======================================================================
-- 6. Owner Select
-- =======================================================================

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000003-0001-0001-0001-000000000001"}';

SELECT results_eq(
  $$
    SELECT count(*)::integer
    FROM public.weekly_reflections
    WHERE user_id = '00000003-0001-0001-0001-000000000001'::uuid
  $$,
  ARRAY[1],
  '14. Owner (User A) can select own weekly reflection'
);

-- =======================================================================
-- 7. Partner Select Rejection (Strict Privacy Isolation)
-- =======================================================================

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000003-0002-0002-0002-000000000002"}';

SELECT results_eq(
  $$
    SELECT count(*)::integer
    FROM public.weekly_reflections
    WHERE user_id = '00000003-0001-0001-0001-000000000001'::uuid
  $$,
  ARRAY[0],
  '15. Partner (User B) CANNOT select User A weekly reflection (isolated)'
);

-- =======================================================================
-- 8. Outsider Select Rejection
-- =======================================================================

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000003-0003-0003-0003-000000000003"}';

SELECT results_eq(
  $$
    SELECT count(*)::integer
    FROM public.weekly_reflections
    WHERE user_id = '00000003-0001-0001-0001-000000000001'::uuid
  $$,
  ARRAY[0],
  '16. Outsider (User C) CANNOT select User A weekly reflection'
);

-- =======================================================================
-- 9. Owner Update (Validates Update Trigger Execution for Authenticated User)
-- =======================================================================

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000003-0001-0001-0001-000000000001"}';

SELECT lives_ok(
  $$
    UPDATE public.weekly_reflections
    SET private_note = 'Updated reflection note.'
    WHERE user_id = '00000003-0001-0001-0001-000000000001'::uuid
      AND week_start = '2026-11-16T00:00:00Z'::timestamptz;
  $$,
  '17. Owner (User A) can update own weekly reflection through validation trigger'
);

-- =======================================================================
-- 10. Partner Update Rejection
-- =======================================================================

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000003-0002-0002-0002-000000000002"}';

SELECT results_eq(
  $$
    WITH updated AS (
      UPDATE public.weekly_reflections
      SET private_note = 'Malicious partner update'
      WHERE user_id = '00000003-0001-0001-0001-000000000001'::uuid
      RETURNING 1
    )
    SELECT count(*)::integer FROM updated;
  $$,
  ARRAY[0],
  '18. Partner (User B) CANNOT update User A weekly reflection'
);

-- =======================================================================
-- 11. Anonymous Table Access Rejection
-- =======================================================================

SET LOCAL ROLE anon;

SELECT throws_ok(
  $$
    SELECT count(*) FROM public.weekly_reflections;
  $$,
  '42501',
  NULL,
  '19. Anonymous role has no select privilege on public.weekly_reflections'
);

-- =======================================================================
-- 12. Duplicate User/Week Rejection (Unique Constraint)
-- =======================================================================

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000003-0001-0001-0001-000000000001"}';

SELECT throws_ok(
  $$
    INSERT INTO public.weekly_reflections (
      user_id,
      week_start,
      week_end,
      stayed_with,
      carry_forward
    ) VALUES (
      '00000003-0001-0001-0001-000000000001'::uuid,
      '2026-11-16T00:00:00Z'::timestamptz,
      '2026-11-23T00:00:00Z'::timestamptz,
      'Something we worked through',
      'A gentler conversation'
    );
  $$,
  '23505',
  NULL,
  '20. Cannot insert duplicate reflection for same user and week_start'
);

-- =======================================================================
-- 13. Invalid Period Rejection (week_end <= week_start)
-- =======================================================================

SELECT throws_ok(
  $$
    INSERT INTO public.weekly_reflections (
      user_id,
      week_start,
      week_end,
      stayed_with,
      carry_forward
    ) VALUES (
      '00000003-0001-0001-0001-000000000001'::uuid,
      '2026-11-23T00:00:00Z'::timestamptz,
      '2026-11-22T00:00:00Z'::timestamptz,
      'A moment of closeness',
      'More time together'
    );
  $$,
  '23514',
  NULL,
  '21. Rejects invalid period where week_end is before week_start'
);

-- =======================================================================
-- 14. Invalid Answer Rejection
-- =======================================================================

SELECT throws_ok(
  $$
    INSERT INTO public.weekly_reflections (
      user_id,
      week_start,
      week_end,
      stayed_with,
      carry_forward
    ) VALUES (
      '00000003-0001-0001-0001-000000000001'::uuid,
      '2026-11-23T00:00:00Z'::timestamptz,
      '2026-11-30T00:00:00Z'::timestamptz,
      'Totally invalid answer',
      'More time together'
    );
  $$,
  '23514',
  NULL,
  '22. Rejects unsupported answer value for stayed_with'
);

-- =======================================================================
-- 15. Oversized Note Rejection (> 1000 characters)
-- =======================================================================

SELECT throws_ok(
  $$
    INSERT INTO public.weekly_reflections (
      user_id,
      week_start,
      week_end,
      stayed_with,
      carry_forward,
      private_note
    ) VALUES (
      '00000003-0001-0001-0001-000000000001'::uuid,
      '2026-11-23T00:00:00Z'::timestamptz,
      '2026-11-30T00:00:00Z'::timestamptz,
      'A moment of closeness',
      'More time together',
      repeat('a', 1001)
    );
  $$,
  '23514',
  NULL,
  '23. Rejects private note exceeding 1000 characters'
);

-- =======================================================================
-- 16. Spoofed Couple Membership Rejection
-- =======================================================================

SELECT throws_ok(
  $$
    INSERT INTO public.weekly_reflections (
      user_id,
      couple_id,
      week_start,
      week_end,
      stayed_with,
      carry_forward
    ) VALUES (
      '00000003-0001-0001-0001-000000000001'::uuid,
      '00000003-cccc-2222-0002-000000000002'::uuid, -- Couple 2 (User A not a member)
      '2026-11-23T00:00:00Z'::timestamptz,
      '2026-11-30T00:00:00Z'::timestamptz,
      'A moment of closeness',
      'More time together'
    );
  $$,
  NULL,
  '24. Rejects insertion with spoofed couple_id where user is not a member'
);

-- =======================================================================
-- 17. Immutability Guards on UPDATE
-- =======================================================================

SELECT throws_ok(
  $$
    UPDATE public.weekly_reflections
    SET user_id = '00000003-0002-0002-0002-000000000002'::uuid
    WHERE user_id = '00000003-0001-0001-0001-000000000001'::uuid;
  $$,
  NULL,
  '25. Rejects UPDATE that mutates user_id'
);

SELECT throws_ok(
  $$
    UPDATE public.weekly_reflections
    SET week_start = '2026-11-09T00:00:00Z'::timestamptz
    WHERE user_id = '00000003-0001-0001-0001-000000000001'::uuid;
  $$,
  NULL,
  '26. Rejects UPDATE that mutates week_start'
);

-- =======================================================================
-- 18. Truncate Rejection
-- =======================================================================

SELECT throws_ok(
  $$ TRUNCATE TABLE public.weekly_reflections; $$,
  '42501',
  NULL,
  '27. authenticated cannot TRUNCATE weekly_reflections'
);

SET LOCAL ROLE anon;
SELECT throws_ok(
  $$ TRUNCATE TABLE public.weekly_reflections; $$,
  '42501',
  NULL,
  '28. anon cannot TRUNCATE weekly_reflections'
);

-- =======================================================================
-- 19. Anon Mutation Rejections
-- =======================================================================

SELECT throws_ok(
  $$
    INSERT INTO public.weekly_reflections (
      user_id, week_start, week_end, stayed_with, carry_forward
    ) VALUES (
      '00000003-0001-0001-0001-000000000001'::uuid,
      '2026-11-30T00:00:00Z'::timestamptz,
      '2026-12-07T00:00:00Z'::timestamptz,
      'A moment of closeness',
      'More time together'
    );
  $$,
  '42501',
  NULL,
  '29. anon has no INSERT privilege on public.weekly_reflections'
);

SELECT throws_ok(
  $$
    UPDATE public.weekly_reflections
    SET private_note = 'anon update';
  $$,
  '42501',
  NULL,
  '30. anon has no UPDATE privilege on public.weekly_reflections'
);

SELECT throws_ok(
  $$
    DELETE FROM public.weekly_reflections;
  $$,
  '42501',
  NULL,
  '31. anon has no DELETE privilege on public.weekly_reflections'
);

SELECT * FROM finish();
ROLLBACK;
