-- Purple Garden database change
-- Feature: Shared Relationship Profile and Important Dates
-- Purpose: Collaborative couple profile (stage, anniversary, shared interests, intentions) and shared milestone dates
-- Ownership: Couple-owned (1:1 with public.couples and 1:N milestone dates)
-- Data classification: Couple-scoped shared content (visible and editable by both connected partners)
-- Security boundary: RLS membership checks via private.user_couple_ids()
-- Introduced: 2026-11-10

-- 1. Create public.couple_profiles table
CREATE TABLE public.couple_profiles (
  couple_id uuid PRIMARY KEY REFERENCES public.couples(id) ON DELETE CASCADE,
  relationship_stage text NULL,
  together_since date NULL,
  together_since_precision text NULL,
  shared_interests text[] NOT NULL DEFAULT '{}'::text[],
  relationship_description text NULL,
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT couple_profiles_relationship_stage_check CHECK (
    relationship_stage IS NULL OR relationship_stage IN (
      'dating',
      'committed_relationship',
      'engaged',
      'married',
      'civil_partnership',
      'other'
    )
  ),
  CONSTRAINT couple_profiles_together_since_consistency CHECK (
    (together_since IS NULL AND together_since_precision IS NULL) OR
    (together_since IS NOT NULL AND together_since_precision IS NOT NULL)
  ),
  CONSTRAINT couple_profiles_together_since_precision_check CHECK (
    together_since_precision IS NULL OR together_since_precision IN ('day', 'month', 'year')
  ),
  CONSTRAINT couple_profiles_together_since_month_precision CHECK (
    together_since_precision IS NULL OR
    together_since_precision <> 'month' OR
    extract(day from together_since) = 1
  ),
  CONSTRAINT couple_profiles_together_since_year_precision CHECK (
    together_since_precision IS NULL OR
    together_since_precision <> 'year' OR (
      extract(month from together_since) = 1 AND
      extract(day from together_since) = 1
    )
  ),
  CONSTRAINT couple_profiles_relationship_description_check CHECK (
    relationship_description IS NULL OR (
      relationship_description = btrim(relationship_description) AND
      char_length(relationship_description) >= 1 AND
      char_length(relationship_description) <= 500
    )
  ),
  CONSTRAINT couple_profiles_shared_interests_check CHECK (
    private.validate_profile_tags(shared_interests)
  )
);

-- 2. Validation trigger for couple_profiles (not future date, database-controlled updated_by)
CREATE OR REPLACE FUNCTION private.validate_couple_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Validate together_since is not in the future
  IF NEW.together_since IS NOT NULL AND NEW.together_since > CURRENT_DATE THEN
    RAISE EXCEPTION 'together_since date cannot be in the future';
  END IF;

  current_user_id := auth.uid();

  -- Authenticated Data API operations: assign updated_by from auth.uid() and verify membership
  IF current_user_id IS NOT NULL THEN
    NEW.updated_by := current_user_id;

    IF NOT EXISTS (
      SELECT 1
      FROM public.couple_members cm
      WHERE cm.couple_id = NEW.couple_id
        AND cm.user_id = current_user_id
    ) THEN
      RAISE EXCEPTION 'Current user is not a member of the owning couple';
    END IF;
  ELSE
    -- Administrative / service-role execution without auth context:
    -- If updated_by is explicitly specified, verify it belongs to the couple
    IF NEW.updated_by IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.couple_members cm
        WHERE cm.couple_id = NEW.couple_id
          AND cm.user_id = NEW.updated_by
      ) THEN
        RAISE EXCEPTION 'updated_by must be a member of the owning couple';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.validate_couple_profile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.validate_couple_profile() TO authenticated, service_role;

COMMENT ON FUNCTION private.validate_couple_profile() IS 'Internal trigger function validating that together_since is not in the future, assigning updated_by from auth.uid(), and confirming couple membership.';

CREATE TRIGGER on_couple_profile_validated
BEFORE INSERT OR UPDATE ON public.couple_profiles
FOR EACH ROW
EXECUTE FUNCTION private.validate_couple_profile();

-- 3. Automatic updated_at trigger for couple_profiles (reuses private.set_updated_at())
CREATE TRIGGER on_couple_profile_updated
BEFORE UPDATE ON public.couple_profiles
FOR EACH ROW
EXECUTE FUNCTION private.set_updated_at();

-- 4. Create public.couple_important_dates table
CREATE TABLE public.couple_important_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  label text NOT NULL,
  event_date date NOT NULL,
  created_by uuid NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT couple_important_dates_label_check CHECK (
    label = btrim(label) AND
    char_length(label) >= 1 AND
    char_length(label) <= 80
  )
);

-- 5. Automatic updated_at trigger for couple_important_dates (reuses private.set_updated_at())
CREATE TRIGGER on_couple_important_date_updated
BEFORE UPDATE ON public.couple_important_dates
FOR EACH ROW
EXECUTE FUNCTION private.set_updated_at();

-- 6. Indexes
CREATE INDEX couple_profiles_updated_by_idx ON public.couple_profiles USING btree (updated_by);

-- Composite index supports couple_id-leading lookups and chronological couple-date queries; standalone couple_id index is redundant
CREATE INDEX couple_important_dates_couple_id_event_date_idx ON public.couple_important_dates USING btree (couple_id, event_date);
CREATE INDEX couple_important_dates_created_by_idx ON public.couple_important_dates USING btree (created_by);

-- 7. Row Level Security (RLS)
ALTER TABLE public.couple_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_important_dates ENABLE ROW LEVEL SECURITY;

-- couple_profiles policies (whole-profile DELETE policy intentionally removed; clearing optional fields is handled via UPDATE)
CREATE POLICY "Couple members can read couple profile"
ON public.couple_profiles
FOR SELECT TO authenticated
USING (
  couple_id IN (SELECT private.user_couple_ids())
);

CREATE POLICY "Couple members can insert couple profile"
ON public.couple_profiles
FOR INSERT TO authenticated
WITH CHECK (
  couple_id IN (SELECT private.user_couple_ids())
);

CREATE POLICY "Couple members can update couple profile"
ON public.couple_profiles
FOR UPDATE TO authenticated
USING (
  couple_id IN (SELECT private.user_couple_ids())
)
WITH CHECK (
  couple_id IN (SELECT private.user_couple_ids())
);

-- couple_important_dates policies
CREATE POLICY "Couple members can read important dates"
ON public.couple_important_dates
FOR SELECT TO authenticated
USING (
  couple_id IN (SELECT private.user_couple_ids())
);

CREATE POLICY "Couple members can insert important dates"
ON public.couple_important_dates
FOR INSERT TO authenticated
WITH CHECK (
  couple_id IN (SELECT private.user_couple_ids())
  AND (created_by IS NULL OR created_by = (SELECT auth.uid()))
);

CREATE POLICY "Couple members can update important dates"
ON public.couple_important_dates
FOR UPDATE TO authenticated
USING (
  couple_id IN (SELECT private.user_couple_ids())
)
WITH CHECK (
  couple_id IN (SELECT private.user_couple_ids())
);

CREATE POLICY "Couple members can delete important dates"
ON public.couple_important_dates
FOR DELETE TO authenticated
USING (
  couple_id IN (SELECT private.user_couple_ids())
);

-- 8. Least-privilege permissions
REVOKE ALL ON TABLE public.couple_profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.couple_important_dates FROM PUBLIC, anon, authenticated;

-- couple_profiles grants (DELETE omitted; updated_by omitted to prevent direct client mutation)
GRANT SELECT ON TABLE public.couple_profiles TO authenticated;

GRANT INSERT (
  couple_id,
  relationship_stage,
  together_since,
  together_since_precision,
  shared_interests,
  relationship_description
) ON TABLE public.couple_profiles TO authenticated;

GRANT UPDATE (
  relationship_stage,
  together_since,
  together_since_precision,
  shared_interests,
  relationship_description
) ON TABLE public.couple_profiles TO authenticated;

GRANT ALL ON TABLE public.couple_profiles TO service_role;

-- couple_important_dates grants
GRANT SELECT, DELETE ON TABLE public.couple_important_dates TO authenticated;

GRANT INSERT (
  couple_id,
  label,
  event_date
) ON TABLE public.couple_important_dates TO authenticated;

GRANT UPDATE (
  label,
  event_date
) ON TABLE public.couple_important_dates TO authenticated;

GRANT ALL ON TABLE public.couple_important_dates TO service_role;

-- 9. Documentation comments
COMMENT ON TABLE public.couple_profiles IS 'Shared relationship details owned by a couple space in Purple Garden. Editable by either connected partner.';

COMMENT ON COLUMN public.couple_profiles.couple_id IS 'Foreign key referencing the couple space that owns this relationship profile (primary key).';
COMMENT ON COLUMN public.couple_profiles.relationship_stage IS 'Optional relationship stage (dating, committed_relationship, engaged, married, civil_partnership, other).';
COMMENT ON COLUMN public.couple_profiles.together_since IS 'Optional date representing when the couple got together; stored with precision anchor (day 1 for month, Jan 1 for year). Must not be in the future.';
COMMENT ON COLUMN public.couple_profiles.together_since_precision IS 'Precision level of together_since date: day, month, or year. Must be populated together with together_since.';
COMMENT ON COLUMN public.couple_profiles.shared_interests IS 'Shared interests and activities enjoyed together, maximum 12 items, each trimmed, 1 through 40 characters.';
COMMENT ON COLUMN public.couple_profiles.relationship_description IS 'Optional shared reflection or intention statement for the relationship, trimmed, 1 through 500 characters.';
COMMENT ON COLUMN public.couple_profiles.updated_by IS 'Auth user ID of the partner who last modified this couple profile, assigned by the database from auth.uid().';
COMMENT ON COLUMN public.couple_profiles.created_at IS 'Timestamp when this couple profile was initialized.';
COMMENT ON COLUMN public.couple_profiles.updated_at IS 'Timestamp when this couple profile was last updated, maintained by trigger.';

COMMENT ON POLICY "Couple members can read couple profile" ON public.couple_profiles IS 'Restricts couple profile reads to authenticated members of the owning couple space.';
COMMENT ON POLICY "Couple members can insert couple profile" ON public.couple_profiles IS 'Allows an authenticated couple member to create the initial couple profile for their space.';
COMMENT ON POLICY "Couple members can update couple profile" ON public.couple_profiles IS 'Allows either partner to update couple profile fields, preventing reassignment to another couple.';

COMMENT ON TABLE public.couple_important_dates IS 'Important shared dates and milestones owned by a couple space in Purple Garden. Editable by either connected partner.';

COMMENT ON COLUMN public.couple_important_dates.id IS 'Unique identifier for the important date generated by the database.';
COMMENT ON COLUMN public.couple_important_dates.couple_id IS 'Foreign key referencing the couple space that owns this milestone date.';
COMMENT ON COLUMN public.couple_important_dates.label IS 'Trimmed user-defined milestone label, 1 through 80 characters.';
COMMENT ON COLUMN public.couple_important_dates.event_date IS 'Calendar date of the milestone.';
COMMENT ON COLUMN public.couple_important_dates.created_by IS 'Auth user ID of the partner who created this milestone date entry.';
COMMENT ON COLUMN public.couple_important_dates.created_at IS 'Timestamp when this milestone date was created.';
COMMENT ON COLUMN public.couple_important_dates.updated_at IS 'Timestamp when this milestone date was last updated, maintained by trigger.';

COMMENT ON POLICY "Couple members can read important dates" ON public.couple_important_dates IS 'Restricts milestone date reads to authenticated members of the owning couple space.';
COMMENT ON POLICY "Couple members can insert important dates" ON public.couple_important_dates IS 'Allows an authenticated couple member to insert milestone dates for their active couple space.';
COMMENT ON POLICY "Couple members can update important dates" ON public.couple_important_dates IS 'Allows either partner to edit milestone labels and dates, preventing reassignment to another couple.';
COMMENT ON POLICY "Couple members can delete important dates" ON public.couple_important_dates IS 'Allows members of the owning couple to delete milestone dates.';
