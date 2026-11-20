-- Purple Garden database migration
-- Feature: Persistent Personal and Shared Couple Images
-- Purpose:
--   1. Add personal_cover_path to user_partner_profiles for "Your corner" cover photo.
--   2. Add couple_image_path to couple_profiles for the circular "Ours" couple icon.
--   3. Create private profile-media storage bucket with strict path-based RLS policies.
-- Security:
--   - personal/{user_id}/... is strictly private to auth.uid() = user_id.
--   - couples/{couple_id}/... is accessible only to active couple members via private.user_couple_ids().
--   - Outsiders and former members cannot read or write couple objects.
--   - Bucket is private (signed URLs required).

BEGIN;

-- ============================================================================
-- 1. DATABASE SCHEMA EXTENSIONS
-- ============================================================================

-- Personal cover path on user_partner_profiles (user-owned, partner-private storage)
ALTER TABLE public.user_partner_profiles
  ADD COLUMN IF NOT EXISTS personal_cover_path text NULL;

COMMENT ON COLUMN public.user_partner_profiles.personal_cover_path IS
  'Storage object path for personal cover image (personal/{user_id}/{filename}). Private to the owner.';

-- Couple image path on couple_profiles (shared across current couple members)
ALTER TABLE public.couple_profiles
  ADD COLUMN IF NOT EXISTS couple_image_path text NULL;

COMMENT ON COLUMN public.couple_profiles.couple_image_path IS
  'Storage object path for shared couple image (couples/{couple_id}/{filename}). Accessible to active couple members.';

-- Column-level grants for authenticated users
GRANT INSERT (personal_cover_path), UPDATE (personal_cover_path)
  ON TABLE public.user_partner_profiles TO authenticated;

GRANT INSERT (couple_image_path), UPDATE (couple_image_path)
  ON TABLE public.couple_profiles TO authenticated;

-- ============================================================================
-- 2. PRIVATE STORAGE BUCKET: profile-media
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-media',
  'profile-media',
  false,
  8388608, -- 8MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 8388608,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- ============================================================================
-- 3. STORAGE POLICIES: PERSONAL COVER IMAGES (personal/{user_id}/...)
-- ============================================================================

-- SELECT: Only the owner can read/sign their personal cover objects
DROP POLICY IF EXISTS "Users can select own personal profile images" ON storage.objects;
CREATE POLICY "Users can select own personal profile images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-media'
  AND split_part(name, '/', 1) = 'personal'
  AND split_part(name, '/', 2) = (SELECT auth.uid()::text)
);

-- INSERT: Only the owner can upload to their personal path
DROP POLICY IF EXISTS "Users can insert own personal profile images" ON storage.objects;
CREATE POLICY "Users can insert own personal profile images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-media'
  AND split_part(name, '/', 1) = 'personal'
  AND split_part(name, '/', 2) = (SELECT auth.uid()::text)
);

-- UPDATE: Only the owner can update their personal objects
DROP POLICY IF EXISTS "Users can update own personal profile images" ON storage.objects;
CREATE POLICY "Users can update own personal profile images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-media'
  AND split_part(name, '/', 1) = 'personal'
  AND split_part(name, '/', 2) = (SELECT auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'profile-media'
  AND split_part(name, '/', 1) = 'personal'
  AND split_part(name, '/', 2) = (SELECT auth.uid()::text)
);

-- DELETE: Only the owner can delete their personal objects
DROP POLICY IF EXISTS "Users can delete own personal profile images" ON storage.objects;
CREATE POLICY "Users can delete own personal profile images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-media'
  AND split_part(name, '/', 1) = 'personal'
  AND split_part(name, '/', 2) = (SELECT auth.uid()::text)
);

-- ============================================================================
-- 4. STORAGE POLICIES: SHARED COUPLE IMAGES (couples/{couple_id}/...)
-- ============================================================================

-- SELECT: Active couple members can read/sign shared couple images
DROP POLICY IF EXISTS "Couple members can select shared couple images" ON storage.objects;
CREATE POLICY "Couple members can select shared couple images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-media'
  AND split_part(name, '/', 1) = 'couples'
  AND (
    CASE
      WHEN split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN split_part(name, '/', 2)::uuid IN (SELECT private.user_couple_ids())
      ELSE false
    END
  )
);

-- INSERT: Active couple members can upload shared couple images
DROP POLICY IF EXISTS "Couple members can insert shared couple images" ON storage.objects;
CREATE POLICY "Couple members can insert shared couple images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-media'
  AND split_part(name, '/', 1) = 'couples'
  AND (
    CASE
      WHEN split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN split_part(name, '/', 2)::uuid IN (SELECT private.user_couple_ids())
      ELSE false
    END
  )
);

-- UPDATE: Active couple members can update shared couple images
DROP POLICY IF EXISTS "Couple members can update shared couple images" ON storage.objects;
CREATE POLICY "Couple members can update shared couple images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-media'
  AND split_part(name, '/', 1) = 'couples'
  AND (
    CASE
      WHEN split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN split_part(name, '/', 2)::uuid IN (SELECT private.user_couple_ids())
      ELSE false
    END
  )
)
WITH CHECK (
  bucket_id = 'profile-media'
  AND split_part(name, '/', 1) = 'couples'
  AND (
    CASE
      WHEN split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN split_part(name, '/', 2)::uuid IN (SELECT private.user_couple_ids())
      ELSE false
    END
  )
);

-- DELETE: Active couple members can delete shared couple images
DROP POLICY IF EXISTS "Couple members can delete shared couple images" ON storage.objects;
CREATE POLICY "Couple members can delete shared couple images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-media'
  AND split_part(name, '/', 1) = 'couples'
  AND (
    CASE
      WHEN split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN split_part(name, '/', 2)::uuid IN (SELECT private.user_couple_ids())
      ELSE false
    END
  )
);

COMMIT;
