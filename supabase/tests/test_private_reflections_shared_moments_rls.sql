-- Purple Garden — Private Reflection Shared Moments RLS Tests
-- =============================================================
--
-- PURPOSE:
--   Comprehensive pgTAP tests for public.event_private_reflections:
--   1. pg_policies inventory inspection (canonical policies, no legacy duplicates).
--   2. Insertion permissions: shared positive moments, shared friction moments.
--   3. Partner privacy isolation on SELECT, UPDATE, and DELETE.
--   4. Behavioural mutation assertions: affected row counts, unchanged notes, retained rows.
--   5. Forgery prevention on INSERT and UPDATE (rejected by WITH CHECK).
--   6. Event boundary isolation: Mine/private partner event rejection, cross-couple rejection.
--
-- =============================================================

BEGIN;
SELECT plan(24);

CREATE EXTENSION IF NOT EXISTS pgtap;

-- ============================================================================
-- PART 1: pg_policies Inspection Assertions
-- ============================================================================

SELECT is(
    (SELECT count(*)::integer FROM pg_policies WHERE tablename = 'event_private_reflections' AND schemaname = 'public'),
    4,
    '1. Exactly four policies exist on public.event_private_reflections'
);

SELECT set_has(
    $$ SELECT policyname FROM pg_policies WHERE tablename = 'event_private_reflections' AND schemaname = 'public' $$,
    $$ VALUES
        ('Authors can add private reflections'),
        ('Authors can read private reflections'),
        ('Authors can update private reflections'),
        ('Authors can delete private reflections')
    $$,
    '2. Intended four canonical "Authors can..." policies are present'
);

SELECT is(
    (SELECT count(*)::integer FROM pg_policies WHERE tablename = 'event_private_reflections' AND schemaname = 'public' AND policyname IN (
        'Creators can add private reflections',
        'Couple members can add private reflections to shared friction events',
        'Users can insert reflections for own or shared couple events'
    )),
    0,
    '3. No known legacy policy names remain on event_private_reflections'
);

SELECT is(
    (SELECT count(*)::integer FROM pg_policies WHERE tablename = 'event_private_reflections' AND schemaname = 'public' AND cmd = 'INSERT'),
    1,
    '4. Exactly one authenticated INSERT policy exists'
);

SELECT is(
    (SELECT count(*)::integer FROM pg_policies WHERE tablename = 'event_private_reflections' AND schemaname = 'public' AND cmd = 'SELECT'),
    1,
    '5. Exactly one authenticated SELECT policy exists'
);

SELECT is(
    (SELECT count(*)::integer FROM pg_policies WHERE tablename = 'event_private_reflections' AND schemaname = 'public' AND cmd = 'UPDATE'),
    1,
    '6. Exactly one authenticated UPDATE policy exists'
);

SELECT is(
    (SELECT count(*)::integer FROM pg_policies WHERE tablename = 'event_private_reflections' AND schemaname = 'public' AND cmd = 'DELETE'),
    1,
    '7. Exactly one authenticated DELETE policy exists'
);

-- ============================================================================
-- PART 2: Test Fixtures Setup
-- ============================================================================

-- Fixture IDs
-- user_a: couple_1 creator
-- user_b: couple_1 partner
-- user_c: couple_2 member (unrelated cross-couple user)
-- ev_shared_positive: created by user_a, visibility 'ours', event_type 'positive'
-- ev_shared_friction: created by user_a, visibility 'ours', event_type 'friction'
-- ev_mine_private: created by user_a, visibility 'mine', event_type 'friction'
-- ev_cross_couple: created by user_c in couple_2, visibility 'ours', event_type 'positive'

INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    aud, role, instance_id
)
SELECT
    t.id, t.email, 'x', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, 'authenticated', 'authenticated',
    '00000000-0000-0000-0000-000000000000'
FROM (VALUES
    ('00000004-0001-0001-0001-000000000001'::uuid, 'ref-a@test.com'),
    ('00000004-0001-0001-0001-000000000002'::uuid, 'ref-b@test.com'),
    ('00000004-0001-0001-0001-000000000003'::uuid, 'ref-c@test.com')
) AS t(id, email)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.couples (id, created_by, created_at)
VALUES
    ('00000004-0002-0002-0002-000000000001', '00000004-0001-0001-0001-000000000001', now()),
    ('00000004-0002-0002-0002-000000000002', '00000004-0001-0001-0001-000000000003', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.couple_members (couple_id, user_id, joined_at)
VALUES
    ('00000004-0002-0002-0002-000000000001', '00000004-0001-0001-0001-000000000001', now()),
    ('00000004-0002-0002-0002-000000000001', '00000004-0001-0001-0001-000000000002', now()),
    ('00000004-0002-0002-0002-000000000002', '00000004-0001-0001-0001-000000000003', now())
ON CONFLICT (couple_id, user_id) DO NOTHING;

-- Shared positive event created by user_a in couple_1
INSERT INTO public.relationship_events
    (id, couple_id, creator_id, event_type, category, visibility, status, created_at)
VALUES
    ('00000004-0003-0003-0003-000000000001',
     '00000004-0002-0002-0002-000000000001',
     '00000004-0001-0001-0001-000000000001',
     'positive', 'quality_time', 'ours', 'open', now())
ON CONFLICT (id) DO NOTHING;

-- Shared friction event created by user_a in couple_1
INSERT INTO public.relationship_events
    (id, couple_id, creator_id, event_type, category, visibility, status, created_at)
VALUES
    ('00000004-0003-0003-0003-000000000002',
     '00000004-0002-0002-0002-000000000001',
     '00000004-0001-0001-0001-000000000001',
     'friction', 'communication', 'ours', 'open', now())
ON CONFLICT (id) DO NOTHING;

-- Mine-only friction event created by user_a in couple_1
INSERT INTO public.relationship_events
    (id, couple_id, creator_id, event_type, category, visibility, status, created_at)
VALUES
    ('00000004-0003-0003-0003-000000000004',
     '00000004-0002-0002-0002-000000000001',
     '00000004-0001-0001-0001-000000000001',
     'friction', 'communication', 'mine', 'open', now())
ON CONFLICT (id) DO NOTHING;

-- Cross-couple event in couple_2
INSERT INTO public.relationship_events
    (id, couple_id, creator_id, event_type, category, visibility, status, created_at)
VALUES
    ('00000004-0003-0003-0003-000000000003',
     '00000004-0002-0002-0002-000000000002',
     '00000004-0001-0001-0001-000000000003',
     'positive', 'appreciation', 'ours', 'open', now())
ON CONFLICT (id) DO NOTHING;

-- Helper functions to capture exact affected row counts
CREATE OR REPLACE FUNCTION test_execute_update_rows(p_id uuid, p_note text) RETURNS integer AS $$
DECLARE
    v_rows integer;
BEGIN
    UPDATE public.event_private_reflections
    SET note = p_note
    WHERE id = p_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE OR REPLACE FUNCTION test_execute_delete_rows(p_id uuid) RETURNS integer AS $$
DECLARE
    v_rows integer;
BEGIN
    DELETE FROM public.event_private_reflections
    WHERE id = p_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- ============================================================================
-- PART 3: INSERT Permissions & Boundary Tests
-- ============================================================================

-- 8. Shared positive moment: Partner B can reflect privately
SELECT lives_ok(
    $$
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "00000004-0001-0001-0001-000000000002"}';
    SET LOCAL "request.jwt.claim.sub" = '00000004-0001-0001-0001-000000000002';
    INSERT INTO public.event_private_reflections (id, event_id, author_id, note)
    VALUES (
        '00000004-0004-0004-0004-000000000001',
        '00000004-0003-0003-0003-000000000001',
        '00000004-0001-0001-0001-000000000002',
        'Loved cooking dinner together tonight.'
    );
    $$,
    '8. Partner B can reflect privately on an accessible shared positive moment'
);
RESET ROLE;
RESET "request.jwt.claims";
RESET "request.jwt.claim.sub";

-- 9. Shared friction moment: Partner B can reflect privately
SELECT lives_ok(
    $$
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "00000004-0001-0001-0001-000000000002"}';
    SET LOCAL "request.jwt.claim.sub" = '00000004-0001-0001-0001-000000000002';
    INSERT INTO public.event_private_reflections (id, event_id, author_id, note)
    VALUES (
        '00000004-0004-0004-0004-000000000002',
        '00000004-0003-0003-0003-000000000002',
        '00000004-0001-0001-0001-000000000002',
        'I felt misunderstood during our morning conversation.'
    );
    $$,
    '9. Partner B can reflect privately on an accessible shared friction moment'
);
RESET ROLE;
RESET "request.jwt.claims";
RESET "request.jwt.claim.sub";

-- 10. Forged author_id on INSERT is rejected
SELECT throws_ok(
    $$
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "00000004-0001-0001-0001-000000000002"}';
    SET LOCAL "request.jwt.claim.sub" = '00000004-0001-0001-0001-000000000002';
    INSERT INTO public.event_private_reflections (event_id, author_id, note)
    VALUES (
        '00000004-0003-0003-0003-000000000001',
        '00000004-0001-0001-0001-000000000001',
        'Forged reflection authored as Partner A'
    );
    $$,
    '42501',
    NULL,
    '10. Forged author_id on INSERT is rejected by RLS WITH CHECK'
);
RESET ROLE;
RESET "request.jwt.claims";
RESET "request.jwt.claim.sub";

-- 11. Mine/private partner event remains inaccessible to non-creator partner
SELECT throws_ok(
    $$
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "00000004-0001-0001-0001-000000000002"}';
    SET LOCAL "request.jwt.claim.sub" = '00000004-0001-0001-0001-000000000002';
    INSERT INTO public.event_private_reflections (event_id, author_id, note)
    VALUES (
        '00000004-0003-0003-0003-000000000004',
        '00000004-0001-0001-0001-000000000002',
        'Partner B reflection on Partner A private mine event'
    );
    $$,
    '42501',
    NULL,
    '11. Partner B cannot insert private reflection on Partner A mine-only event'
);
RESET ROLE;
RESET "request.jwt.claims";
RESET "request.jwt.claim.sub";

-- 12. Cross-couple event remains inaccessible
SELECT throws_ok(
    $$
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"sub": "00000004-0001-0001-0001-000000000002"}';
    SET LOCAL "request.jwt.claim.sub" = '00000004-0001-0001-0001-000000000002';
    INSERT INTO public.event_private_reflections (event_id, author_id, note)
    VALUES (
        '00000004-0003-0003-0003-000000000003',
        '00000004-0001-0001-0001-000000000002',
        'Cross-couple intruder reflection'
    );
    $$,
    '42501',
    NULL,
    '12. Partner B cannot insert private reflection on cross-couple event'
);
RESET ROLE;
RESET "request.jwt.claims";
RESET "request.jwt.claim.sub";

-- ============================================================================
-- PART 4: SELECT Permissions & Partner Isolation
-- ============================================================================

-- 13. Author B can read their own private reflection
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000004-0001-0001-0001-000000000002"}';
SET LOCAL "request.jwt.claim.sub" = '00000004-0001-0001-0001-000000000002';

SELECT is(
    (SELECT count(*)::integer FROM public.event_private_reflections WHERE id = '00000004-0004-0004-0004-000000000001'),
    1,
    '13. Author B can read their own private reflection'
);
RESET ROLE;
RESET "request.jwt.claims";
RESET "request.jwt.claim.sub";

-- 14. Partner A cannot read Partner B's private reflection
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000004-0001-0001-0001-000000000001"}';
SET LOCAL "request.jwt.claim.sub" = '00000004-0001-0001-0001-000000000001';

SELECT is(
    (SELECT count(*)::integer FROM public.event_private_reflections WHERE id = '00000004-0004-0004-0004-000000000001'),
    0,
    '14. Partner A cannot read Partner B private reflection on shared positive moment'
);
RESET ROLE;
RESET "request.jwt.claims";
RESET "request.jwt.claim.sub";

-- ============================================================================
-- PART 5: Unauthorized UPDATE/DELETE Behavioural Tests
-- ============================================================================

-- 15. Partner A attempts to UPDATE Partner B's reflection: exactly 0 rows affected
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000004-0001-0001-0001-000000000001"}';
SET LOCAL "request.jwt.claim.sub" = '00000004-0001-0001-0001-000000000001';

SELECT is(
    test_execute_update_rows('00000004-0004-0004-0004-000000000001'::uuid, 'Tampered by Partner A'),
    0,
    '15. Partner A attempts to UPDATE Partner B reflection: exactly zero rows affected'
);
RESET ROLE;
RESET "request.jwt.claims";
RESET "request.jwt.claim.sub";

-- 16. Note remains unchanged after Partner A's UPDATE attempt
RESET ROLE;
RESET "request.jwt.claims";
RESET "request.jwt.claim.sub";

SELECT is(
    (SELECT note FROM public.event_private_reflections WHERE id = '00000004-0004-0004-0004-000000000001'),
    'Loved cooking dinner together tonight.',
    '16. Note remains unchanged after Partner A unauthorized UPDATE attempt'
);

-- 17. Partner A attempts to DELETE Partner B's reflection: exactly 0 rows affected
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000004-0001-0001-0001-000000000001"}';
SET LOCAL "request.jwt.claim.sub" = '00000004-0001-0001-0001-000000000001';

SELECT is(
    test_execute_delete_rows('00000004-0004-0004-0004-000000000001'::uuid),
    0,
    '17. Partner A attempts to DELETE Partner B reflection: exactly zero rows affected'
);
RESET ROLE;
RESET "request.jwt.claims";
RESET "request.jwt.claim.sub";

-- 18. Row remains present to Partner B after Partner A's DELETE attempt
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000004-0001-0001-0001-000000000002"}';
SET LOCAL "request.jwt.claim.sub" = '00000004-0001-0001-0001-000000000002';

SELECT is(
    (SELECT count(*)::integer FROM public.event_private_reflections WHERE id = '00000004-0004-0004-0004-000000000001'),
    1,
    '18. Row remains present to Partner B after Partner A DELETE attempt'
);
RESET ROLE;
RESET "request.jwt.claims";
RESET "request.jwt.claim.sub";

-- 19. Author B attempts to change author_id to Partner A: rejected by UPDATE WITH CHECK
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000004-0001-0001-0001-000000000002"}';
SET LOCAL "request.jwt.claim.sub" = '00000004-0001-0001-0001-000000000002';

SELECT throws_ok(
    $$
    UPDATE public.event_private_reflections
    SET author_id = '00000004-0001-0001-0001-000000000001'::uuid
    WHERE id = '00000004-0004-0004-0004-000000000001';
    $$,
    '42501',
    NULL,
    '19. Author B attempts to change author_id to Partner A: rejected by UPDATE WITH CHECK'
);
RESET ROLE;
RESET "request.jwt.claims";
RESET "request.jwt.claim.sub";

-- 20. Ownership remains unchanged after forged update attempt
SELECT is(
    (SELECT author_id FROM public.event_private_reflections WHERE id = '00000004-0004-0004-0004-000000000001'),
    '00000004-0001-0001-0001-000000000002'::uuid,
    '20. Ownership remains unchanged (author_id is still Partner B)'
);

-- ============================================================================
-- PART 6: Authorized Author UPDATE/DELETE Tests
-- ============================================================================

-- 21. Author B updates their own note: exactly 1 row affected
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000004-0001-0001-0001-000000000002"}';
SET LOCAL "request.jwt.claim.sub" = '00000004-0001-0001-0001-000000000002';

SELECT is(
    test_execute_update_rows('00000004-0004-0004-0004-000000000001'::uuid, 'Author B updated note'),
    1,
    '21. Author B updates their own note: exactly one row affected'
);

-- 22. Updated note is readable by Author B
SELECT is(
    (SELECT note FROM public.event_private_reflections WHERE id = '00000004-0004-0004-0004-000000000001'),
    'Author B updated note',
    '22. Updated note is returned and readable by Author B'
);

-- 23. Author B deletes their own reflection: exactly 1 row affected
SELECT is(
    test_execute_delete_rows('00000004-0004-0004-0004-000000000001'::uuid),
    1,
    '23. Author B deletes their own reflection: exactly one row affected'
);

-- 24. Reflection is deleted and count is 0 for Author B
SELECT is(
    (SELECT count(*)::integer FROM public.event_private_reflections WHERE id = '00000004-0004-0004-0004-000000000001'),
    0,
    '24. Reflection is deleted and count is 0 for Author B'
);
RESET ROLE;
RESET "request.jwt.claims";
RESET "request.jwt.claim.sub";

SELECT * FROM finish();
ROLLBACK;
