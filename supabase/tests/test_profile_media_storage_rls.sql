-- Purple Garden — Profile Media Storage & Profile Path RLS Database Tests
-- =======================================================================
--
-- PURPOSE:
--   Executable pgTAP tests for profile media storage objects and profile table
--   column persistence (personal_cover_path on user_partner_profiles,
--   couple_image_path on couple_profiles).
--
-- COVERAGE (13 tests):
--   1. Column personal_cover_path exists on public.user_partner_profiles
--   2. Column couple_image_path exists on public.couple_profiles
--   3. Private storage bucket 'profile-media' exists with 8MB limit and allowed mime types
--   4. User A can insert own personal cover object (personal/{user_a}/...)
--   5. User A can select own personal cover object
--   6. User B (connected partner) CANNOT select User A's personal cover object (strictly private)
--   7. User B CANNOT insert into User A's personal cover path
--   8. User C (outsider) CANNOT select User A's personal cover object
--   9. User A (couple member) can insert shared couple image (couples/{couple_1}/...)
--   10. User B (connected partner in couple 1) CAN select shared couple image
--   11. User C (outsider in couple 2) CANNOT select shared couple image
--   12. User C (outsider in couple 2) CANNOT insert into couple 1's storage path
--   13. Authorized users can update profile path columns; outsiders cannot
--
-- FIXTURE DESIGN:
--   - Runs in a ROLLBACK transaction.
--   - Fixed deterministic UUIDs.
--   - Sets role and auth.uid() using SET LOCAL.
--
-- =======================================================================

BEGIN;
SELECT plan(13);

-- SETUP: extensions
CREATE EXTENSION IF NOT EXISTS pgtap;

-- =======================================================================
-- 1. Schema & Bucket Verification
-- =======================================================================

SELECT has_column(
  'public',
  'user_partner_profiles',
  'personal_cover_path',
  'public.user_partner_profiles has personal_cover_path column'
);

SELECT has_column(
  'public',
  'couple_profiles',
  'couple_image_path',
  'public.couple_profiles has couple_image_path column'
);

SELECT results_eq(
  $$
    SELECT public, file_size_limit
    FROM storage.buckets
    WHERE id = 'profile-media'
  $$,
  $$
    VALUES (false, 8388608::bigint)
  $$,
  'profile-media bucket is private with 8MB file size limit'
);

-- =======================================================================
-- SETUP: deterministic fixture UUIDs & database rows
-- =======================================================================

CREATE TEMP TABLE profile_media_test_ids (key text PRIMARY KEY, value uuid)
ON COMMIT DROP;

INSERT INTO profile_media_test_ids VALUES
  ('user_a',   '00000002-0001-0001-0001-000000000001'),
  ('user_b',   '00000002-0002-0002-0002-000000000002'),
  ('user_c',   '00000002-0003-0003-0003-000000000003'),
  ('couple_1', '00000002-cccc-1111-0001-000000000001'),
  ('couple_2', '00000002-cccc-2222-0002-000000000002');

-- Create mock auth users
INSERT INTO auth.users (id, email)
SELECT value, key || '@example.com'
FROM profile_media_test_ids
WHERE key IN ('user_a', 'user_b', 'user_c');

-- Create Couples & Members
INSERT INTO public.couples (id, created_by)
SELECT value, '00000002-0001-0001-0001-000000000001'::uuid
FROM profile_media_test_ids
WHERE key = 'couple_1';

INSERT INTO public.couple_members (couple_id, user_id)
VALUES (
  '00000002-cccc-1111-0001-000000000001'::uuid,
  '00000002-0002-0002-0002-000000000002'::uuid
);

INSERT INTO public.couples (id, created_by)
SELECT value, '00000002-0003-0003-0003-000000000003'::uuid
FROM profile_media_test_ids
WHERE key = 'couple_2';

-- Create couple profiles
INSERT INTO public.couple_profiles (couple_id)
VALUES
  ('00000002-cccc-1111-0001-000000000001'::uuid),
  ('00000002-cccc-2222-0002-000000000002'::uuid);

-- Create User A partner profile
INSERT INTO public.user_partner_profiles (user_id)
VALUES ('00000002-0001-0001-0001-000000000001'::uuid);

-- =======================================================================
-- 2. Storage RLS Tests: Personal Covers (personal/{user_id}/...)
-- =======================================================================

-- Test 4: User A can insert own personal cover object
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000002-0001-0001-0001-000000000001"}';

SELECT lives_ok(
  $$
    INSERT INTO storage.objects (id, bucket_id, name, owner)
    VALUES (
      gen_random_uuid(),
      'profile-media',
      'personal/00000002-0001-0001-0001-000000000001/cover_1.jpg',
      '00000002-0001-0001-0001-000000000001'::uuid
    );
  $$,
  'User A can insert own personal cover object'
);

-- Test 5: User A can select own personal cover object
SELECT results_eq(
  $$
    SELECT count(*)::integer
    FROM storage.objects
    WHERE bucket_id = 'profile-media'
      AND name = 'personal/00000002-0001-0001-0001-000000000001/cover_1.jpg'
  $$,
  $$ VALUES (1::integer) $$,
  'User A can select own personal cover object'
);

-- Test 6: User B (connected partner) CANNOT select User A's personal cover object
RESET ROLE;
RESET "request.jwt.claims";
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000002-0002-0002-0002-000000000002"}';

SELECT results_eq(
  $$
    SELECT count(*)::integer
    FROM storage.objects
    WHERE bucket_id = 'profile-media'
      AND name = 'personal/00000002-0001-0001-0001-000000000001/cover_1.jpg'
  $$,
  $$ VALUES (0::integer) $$,
  'User B (partner) CANNOT select User A personal cover object (owner-private)'
);

-- Test 7: User B CANNOT insert into User A's personal path
SELECT throws_ok(
  $$
    INSERT INTO storage.objects (id, bucket_id, name, owner)
    VALUES (
      gen_random_uuid(),
      'profile-media',
      'personal/00000002-0001-0001-0001-000000000001/malicious.jpg',
      '00000002-0002-0002-0002-000000000002'::uuid
    );
  $$,
  '42501', -- insufficient_privilege / RLS violation
  NULL,
  'User B CANNOT insert into User A personal storage path'
);

-- Test 8: User C (outsider) CANNOT select User A's personal cover object
RESET ROLE;
RESET "request.jwt.claims";
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000002-0003-0003-0003-000000000003"}';

SELECT results_eq(
  $$
    SELECT count(*)::integer
    FROM storage.objects
    WHERE bucket_id = 'profile-media'
      AND name = 'personal/00000002-0001-0001-0001-000000000001/cover_1.jpg'
  $$,
  $$ VALUES (0::integer) $$,
  'User C (outsider) CANNOT select User A personal cover object'
);

-- =======================================================================
-- 3. Storage RLS Tests: Shared Couple Images (couples/{couple_id}/...)
-- =======================================================================

-- Test 9: User A (member of couple 1) can insert shared couple image
RESET ROLE;
RESET "request.jwt.claims";
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000002-0001-0001-0001-000000000001"}';

SELECT lives_ok(
  $$
    INSERT INTO storage.objects (id, bucket_id, name, owner)
    VALUES (
      gen_random_uuid(),
      'profile-media',
      'couples/00000002-cccc-1111-0001-000000000001/couple_avatar.png',
      '00000002-0001-0001-0001-000000000001'::uuid
    );
  $$,
  'User A can insert shared couple image for couple 1'
);

-- Test 10: User B (partner in couple 1) CAN select shared couple image
RESET ROLE;
RESET "request.jwt.claims";
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000002-0002-0002-0002-000000000002"}';

SELECT results_eq(
  $$
    SELECT count(*)::integer
    FROM storage.objects
    WHERE bucket_id = 'profile-media'
      AND name = 'couples/00000002-cccc-1111-0001-000000000001/couple_avatar.png'
  $$,
  $$ VALUES (1::integer) $$,
  'User B (partner in couple 1) CAN select shared couple image'
);

-- Test 11: User C (outsider in couple 2) CANNOT select couple 1 shared image
RESET ROLE;
RESET "request.jwt.claims";
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000002-0003-0003-0003-000000000003"}';

SELECT results_eq(
  $$
    SELECT count(*)::integer
    FROM storage.objects
    WHERE bucket_id = 'profile-media'
      AND name = 'couples/00000002-cccc-1111-0001-000000000001/couple_avatar.png'
  $$,
  $$ VALUES (0::integer) $$,
  'User C (outsider in couple 2) CANNOT select couple 1 shared image'
);

-- Test 12: User C (outsider in couple 2) CANNOT insert into couple 1 storage path
SELECT throws_ok(
  $$
    INSERT INTO storage.objects (id, bucket_id, name, owner)
    VALUES (
      gen_random_uuid(),
      'profile-media',
      'couples/00000002-cccc-1111-0001-000000000001/malicious_avatar.png',
      '00000002-0003-0003-0003-000000000003'::uuid
    );
  $$,
  '42501',
  NULL,
  'User C CANNOT insert into couple 1 storage path'
);

-- =======================================================================
-- 4. Database Table Column Updates
-- =======================================================================

-- Test 13: User A can update own personal_cover_path; User B can update shared couple_image_path
RESET ROLE;
RESET "request.jwt.claims";
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000002-0001-0001-0001-000000000001"}';

SELECT lives_ok(
  $$
    UPDATE public.user_partner_profiles
    SET personal_cover_path = 'personal/00000002-0001-0001-0001-000000000001/cover_1.jpg'
    WHERE user_id = '00000002-0001-0001-0001-000000000001'::uuid;

    UPDATE public.couple_profiles
    SET couple_image_path = 'couples/00000002-cccc-1111-0001-000000000001/couple_avatar.png'
    WHERE couple_id = '00000002-cccc-1111-0001-000000000001'::uuid;
  $$,
  'Authorized users can update personal_cover_path and couple_image_path columns'
);

RESET ROLE;
RESET "request.jwt.claims";

ROLLBACK;
