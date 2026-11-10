-- Purple Garden database change
-- Feature: Partner-Visible Personal Profile
-- Purpose: Store optional personal details deliberately visible to a connected partner (birthday, traits, support preferences, interests, bio)
-- Ownership: Individual user-owned (1:1 with auth.users)
-- Data classification: Partner-visible user content (NOT private reflections, NOT public)
-- Security boundary: RLS read access for owner and connected partner via private.user_couple_ids(); owner-only writes
-- Introduced: 2026-11-10

-- 1. Helper function for validating tag arrays (max 12 entries, 1-40 chars trimmed, case-insensitively unique)
CREATE OR REPLACE FUNCTION private.validate_profile_tags(tags text[])
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
DECLARE
  tag text;
  normalized_tags text[] := '{}';
BEGIN
  IF tags IS NULL THEN
    RETURN false;
  END IF;

  IF cardinality(tags) > 12 THEN
    RETURN false;
  END IF;

  FOREACH tag IN ARRAY tags LOOP
    IF tag IS NULL THEN
      RETURN false;
    END IF;

    IF tag <> btrim(tag) OR char_length(tag) < 1 OR char_length(tag) > 40 THEN
      RETURN false;
    END IF;

    IF lower(tag) = ANY (normalized_tags) THEN
      RETURN false;
    END IF;

    normalized_tags := array_append(normalized_tags, lower(tag));
  END LOOP;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION private.validate_profile_tags(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.validate_profile_tags(text[]) TO authenticated, service_role;

COMMENT ON FUNCTION private.validate_profile_tags(text[]) IS 'Internal validation helper enforcing tag array constraints: maximum 12 non-empty trimmed strings (1-40 characters) and case-insensitive uniqueness.';

-- 2. Create public.user_partner_profiles table
CREATE TABLE public.user_partner_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  birth_month smallint NULL,
  birth_day smallint NULL,
  introduction text NULL,
  support_preferences text NULL,
  personality_traits text[] NOT NULL DEFAULT '{}'::text[],
  interests text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT user_partner_profiles_birth_date_consistency CHECK (
    (birth_month IS NULL AND birth_day IS NULL) OR
    (birth_month IS NOT NULL AND birth_day IS NOT NULL)
  ),
  CONSTRAINT user_partner_profiles_birth_date_valid_calendar CHECK (
    (birth_month IS NULL AND birth_day IS NULL) OR (
      birth_month BETWEEN 1 AND 12
      AND birth_day >= 1
      AND birth_day <= CASE
        WHEN birth_month IN (1, 3, 5, 7, 8, 10, 12) THEN 31
        WHEN birth_month IN (4, 6, 9, 11) THEN 30
        WHEN birth_month = 2 THEN 29
      END
    )
  ),
  CONSTRAINT user_partner_profiles_introduction_check CHECK (
    introduction IS NULL OR (
      introduction = btrim(introduction) AND
      char_length(introduction) >= 1 AND
      char_length(introduction) <= 300
    )
  ),
  CONSTRAINT user_partner_profiles_support_preferences_check CHECK (
    support_preferences IS NULL OR (
      support_preferences = btrim(support_preferences) AND
      char_length(support_preferences) >= 1 AND
      char_length(support_preferences) <= 300
    )
  ),
  CONSTRAINT user_partner_profiles_personality_traits_check CHECK (
    private.validate_profile_tags(personality_traits)
  ),
  CONSTRAINT user_partner_profiles_interests_check CHECK (
    private.validate_profile_tags(interests)
  )
);

-- 3. Automatic updated_at trigger (reuses existing private.set_updated_at())
CREATE TRIGGER on_user_partner_profile_updated
BEFORE UPDATE ON public.user_partner_profiles
FOR EACH ROW
EXECUTE FUNCTION private.set_updated_at();

-- 4. Row Level Security (RLS)
ALTER TABLE public.user_partner_profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: Allowed to the row owner or to the owner's currently connected partner
CREATE POLICY "Users and connected partners can read partner profile"
ON public.user_partner_profiles
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR user_id IN (
    SELECT cm.user_id
    FROM public.couple_members cm
    WHERE cm.couple_id IN (SELECT private.user_couple_ids())
      AND cm.user_id <> (SELECT auth.uid())
  )
);

-- INSERT: Allowed only for the authenticated user's own row
CREATE POLICY "Users can insert own partner profile"
ON public.user_partner_profiles
FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
);

-- UPDATE: Allowed only to the row owner (partner has read-only access)
CREATE POLICY "Users can update own partner profile"
ON public.user_partner_profiles
FOR UPDATE TO authenticated
USING (
  user_id = (SELECT auth.uid())
)
WITH CHECK (
  user_id = (SELECT auth.uid())
);

-- DELETE: Allowed only to the row owner
CREATE POLICY "Users can delete own partner profile"
ON public.user_partner_profiles
FOR DELETE TO authenticated
USING (
  user_id = (SELECT auth.uid())
);

-- 5. Least-privilege permissions
REVOKE ALL ON TABLE public.user_partner_profiles FROM PUBLIC, anon, authenticated;

GRANT SELECT, DELETE ON TABLE public.user_partner_profiles TO authenticated;

GRANT INSERT (
  user_id,
  birth_month,
  birth_day,
  introduction,
  support_preferences,
  personality_traits,
  interests
) ON TABLE public.user_partner_profiles TO authenticated;

GRANT UPDATE (
  birth_month,
  birth_day,
  introduction,
  support_preferences,
  personality_traits,
  interests
) ON TABLE public.user_partner_profiles TO authenticated;

GRANT ALL ON TABLE public.user_partner_profiles TO service_role;

-- 6. Documentation comments
COMMENT ON TABLE public.user_partner_profiles IS 'Optional personal details deliberately visible to a connected partner in Purple Garden. User-owned, partner-visible, and owner-editable only. Not private reflections.';

COMMENT ON COLUMN public.user_partner_profiles.user_id IS 'Auth user ID of the profile owner (foreign key referencing auth.users).';
COMMENT ON COLUMN public.user_partner_profiles.birth_month IS 'Optional birth month (1 through 12) without birth year or age. Must be populated together with birth_day.';
COMMENT ON COLUMN public.user_partner_profiles.birth_day IS 'Optional birth day (1 through 31) validated against leap year calendar (allows February 29, rejects invalid month-day combinations).';
COMMENT ON COLUMN public.user_partner_profiles.introduction IS 'Optional short personal introduction or reflection, trimmed, 1 through 300 characters.';
COMMENT ON COLUMN public.user_partner_profiles.support_preferences IS 'Optional description of how the user prefers to receive support from their partner, trimmed, 1 through 300 characters.';
COMMENT ON COLUMN public.user_partner_profiles.personality_traits IS 'Optional self-defined personality trait tags, maximum 12 items, each trimmed, 1 through 40 characters, case-insensitively unique.';
COMMENT ON COLUMN public.user_partner_profiles.interests IS 'Optional personal interest tags, maximum 12 items, each trimmed, 1 through 40 characters, case-insensitively unique.';
COMMENT ON COLUMN public.user_partner_profiles.created_at IS 'Timestamp when this partner profile record was created.';
COMMENT ON COLUMN public.user_partner_profiles.updated_at IS 'Timestamp when this partner profile record was last updated, maintained by trigger.';

COMMENT ON POLICY "Users and connected partners can read partner profile" ON public.user_partner_profiles IS 'Allows the profile owner and their currently connected partner in the same couple space to view partner profile details.';
COMMENT ON POLICY "Users can insert own partner profile" ON public.user_partner_profiles IS 'Restricts partner profile creation strictly to the authenticated user for their own user_id.';
COMMENT ON POLICY "Users can update own partner profile" ON public.user_partner_profiles IS 'Ensures only the row owner can update their personal profile; partners have read-only access.';
COMMENT ON POLICY "Users can delete own partner profile" ON public.user_partner_profiles IS 'Ensures only the row owner can delete their partner profile record.';

