-- Purple Garden — Weekly Reflections RLS & Integrity Database Tests
-- =======================================================================
--
-- PURPOSE:
--   Executable pgTAP tests for public.weekly_reflections:
--   Owner insert/select/update, partner isolation, outsider rejection,
--   anonymous rejection, unique period enforcement, constraint validation,
--   and couple membership validation.
--
-- =======================================================================

BEGIN;
SELECT plan(13);

-- SETUP: extensions
CREATE EXTENSION IF NOT EXISTS pgtap;

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
-- 1. Owner Insert
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
  'Owner (User A) can insert own weekly reflection'
);

-- =======================================================================
-- 2. Partner Insert Rejection (spoofing user_id)
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
  'Partner (User B) cannot insert reflection with User A user_id'
);

-- =======================================================================
-- 3. Owner Select
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
  'Owner (User A) can select own weekly reflection'
);

-- =======================================================================
-- 4. Partner Select Rejection (Strict Privacy Isolation)
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
  'Partner (User B) CANNOT select User A weekly reflection (isolated)'
);

-- =======================================================================
-- 5. Outsider Select Rejection
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
  'Outsider (User C) CANNOT select User A weekly reflection'
);

-- =======================================================================
-- 6. Owner Update
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
  'Owner (User A) can update own weekly reflection'
);

-- =======================================================================
-- 7. Partner Update Rejection
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
  'Partner (User B) CANNOT update User A weekly reflection'
);

-- =======================================================================
-- 8. Anonymous Access Rejection
-- =======================================================================

SET LOCAL ROLE anon;

SELECT throws_ok(
  $$
    SELECT count(*) FROM public.weekly_reflections;
  $$,
  NULL,
  'Anonymous role has no select privilege on public.weekly_reflections'
);

-- =======================================================================
-- 9. Duplicate User/Week Rejection (Unique Constraint)
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
  'Cannot insert duplicate reflection for same user and week_start'
);

-- =======================================================================
-- 10. Invalid Period Rejection (week_end <= week_start)
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
  'Rejects invalid period where week_end is before week_start'
);

-- =======================================================================
-- 11. Invalid Answer Rejection
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
  'Rejects unsupported answer value for stayed_with'
);

-- =======================================================================
-- 12. Oversized Note Rejection (> 1000 characters)
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
  'Rejects private note exceeding 1000 characters'
);

-- =======================================================================
-- 13. Spoofed Couple Membership Rejection
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
  'Rejects insertion with spoofed couple_id where user is not a member'
);

SELECT * FROM finish();
ROLLBACK;
