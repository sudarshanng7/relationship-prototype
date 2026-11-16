-- Purple Garden — Repair Memory pgTAP Database Tests
-- =====================================================
--
-- PURPOSE:
--   Executable pgTAP tests for friction_moment_relations and
--   friction_repair_memory_suppressions. These tests FAIL when a database
--   invariant is broken and pass only when the database enforces it correctly.
--
-- HOW TO RUN:
--   npx supabase db reset   (applies all migrations against local Postgres)
--   npx supabase test db    (runs all files in supabase/tests/)
--
-- EXECUTION STATUS:
--   Requires Docker Desktop with WSL2 integration enabled.
--   npx supabase test db executes these 16 assertions against the local
--   Postgres container managed by Docker.
--
-- COVERAGE (16 tests):
--   1.  Valid owner INSERT into friction_moment_relations succeeds
--   2.  Partner B inserts independent decision (no conflict with Partner A)
--   3.  Partner-independent suppression: Partner A suppresses, Partner B is unaffected
--   4.  Outsider (different couple) INSERT rejected by RLS
--   5.  Non-member (no couple) INSERT rejected
--   6.  False user_id on INSERT rejected by RLS WITH CHECK
--   7.  False couple_id on INSERT rejected by validation trigger
--   8.  Cross-couple current_event_id rejected by validation trigger
--   9.  Cross-couple prior_event_id rejected by validation trigger
--   10. Self-reference (current_event_id = prior_event_id) rejected by CHECK constraint
--   11. Non-reconnected prior event with 'related' decision rejected by trigger
--   12. Identity-column UPDATE (user_id) rejected by trigger
--   13. Identity-column UPDATE (current_event_id) rejected by trigger
--   14. Valid decision UPDATE by owner succeeds
--   15. Valid helpfulness_response UPDATE by owner succeeds
--   16. CASCADE deletion removes relation rows when event is deleted
--
-- FIXTURE DESIGN NOTES:
--   - Runs entirely within a single ROLLBACK transaction; leaves no data behind.
--   - INSERT INTO public.couples explicitly supplies created_by because auth.uid()
--     returns NULL when running as the postgres superuser (not in an auth session).
--     The on_couple_created trigger auto-adds created_by to couple_members, so
--     the fixture does NOT manually insert that membership row again.
--   - INSERT INTO public.relationship_events supplies the required category column.
--   - Fixed deterministic UUIDs are used so fixture IDs are stable across runs.
--
-- =====================================================

BEGIN;
SELECT plan(16);

-- =====================================================
-- SETUP: extensions
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgtap;

-- =====================================================
-- SETUP: deterministic fixture UUIDs
-- =====================================================

-- Using fixed UUIDs so fixtures are fully deterministic and idempotent.
-- All test data is isolated within this transaction (rolled back at end).

CREATE TEMP TABLE repair_memory_test_ids (key text PRIMARY KEY, value uuid)
ON COMMIT DROP;

INSERT INTO repair_memory_test_ids VALUES
    -- Users: four auth.users fixtures
    ('user_a',   '00000001-0001-0001-0001-000000000001'),  -- couple_1 creator + member
    ('user_b',   '00000001-0001-0001-0001-000000000002'),  -- couple_1 second member
    ('user_c',   '00000001-0001-0001-0001-000000000003'),  -- couple_2 creator + member
    ('user_d',   '00000001-0001-0001-0001-000000000004'),  -- no couple (non-member)
    -- Couples
    ('couple_1', '00000002-0002-0002-0002-000000000001'),
    ('couple_2', '00000002-0002-0002-0002-000000000002'),
    -- Events
    ('ev_current','00000003-0003-0003-0003-000000000001'), -- friction, open,        couple_1
    ('ev_prior',  '00000003-0003-0003-0003-000000000002'), -- friction, reconnected, couple_1
    ('ev_open',   '00000003-0003-0003-0003-000000000003'), -- friction, open,        couple_1
    ('ev_cross',  '00000003-0003-0003-0003-000000000004'); -- friction, reconnected, couple_2

-- =====================================================
-- SETUP: auth.users (4 fixtures)
-- Running as postgres role, which has INSERT on auth.users in local Supabase.
-- =====================================================

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
    ('00000001-0001-0001-0001-000000000001'::uuid, 'test-a@repair.test'),
    ('00000001-0001-0001-0001-000000000002'::uuid, 'test-b@repair.test'),
    ('00000001-0001-0001-0001-000000000003'::uuid, 'test-c@repair.test'),
    ('00000001-0001-0001-0001-000000000004'::uuid, 'test-d@repair.test')
) AS t(id, email)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- SETUP: couples
--
-- IMPORTANT: explicitly supply created_by.
-- auth.uid() returns NULL as the postgres superuser (no auth session),
-- and created_by is NOT NULL. The on_couple_created trigger fires after each
-- INSERT and automatically adds created_by to couple_members, so we must NOT
-- insert that membership row manually afterwards.
-- =====================================================

INSERT INTO public.couples (id, created_by, created_at)
VALUES
    ('00000002-0002-0002-0002-000000000001', '00000001-0001-0001-0001-000000000001', now()),
    ('00000002-0002-0002-0002-000000000002', '00000001-0001-0001-0001-000000000003', now())
ON CONFLICT (id) DO NOTHING;

-- After the inserts above, couple_members contains:
--   (couple_1, user_a)   <- auto-inserted by on_couple_created trigger
--   (couple_2, user_c)   <- auto-inserted by on_couple_created trigger
--
-- Now add user_b to couple_1 manually.
-- user_a is already there (trigger); do NOT insert user_a again.

INSERT INTO public.couple_members (couple_id, user_id, joined_at)
VALUES ('00000002-0002-0002-0002-000000000001', '00000001-0001-0001-0001-000000000002', now())
ON CONFLICT (couple_id, user_id) DO NOTHING;

-- user_d: no membership — simulates non-member / former-member scenario.

-- =====================================================
-- SETUP: relationship_events (4 fixtures)
--
-- relationship_events requires: couple_id, creator_id, event_type,
-- category (NOT NULL), visibility, and optionally status/reconnected_at.
-- =====================================================

INSERT INTO public.relationship_events
    (id, couple_id, creator_id, event_type, category, visibility, status, created_at)
VALUES
    -- ev_current: open friction in couple_1 (the "new" event being recorded)
    ('00000003-0003-0003-0003-000000000001',
     '00000002-0002-0002-0002-000000000001',
     '00000001-0001-0001-0001-000000000001',
     'friction', 'communication', 'ours', 'open', now()),

    -- ev_open: another open friction in couple_1 (non-reconnected prior, for test 11)
    ('00000003-0003-0003-0003-000000000003',
     '00000002-0002-0002-0002-000000000001',
     '00000001-0001-0001-0001-000000000001',
     'friction', 'communication', 'ours', 'open', now() - interval '5 days')
ON CONFLICT (id) DO NOTHING;

-- ev_prior: reconnected friction in couple_1 (valid prior event for related decision)
INSERT INTO public.relationship_events
    (id, couple_id, creator_id, event_type, category, visibility, status, reconnected_at, created_at)
VALUES
    ('00000003-0003-0003-0003-000000000002',
     '00000002-0002-0002-0002-000000000001',
     '00000001-0001-0001-0001-000000000001',
     'friction', 'communication', 'ours', 'reconnected', now(), now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

-- ev_cross: reconnected friction in couple_2 (cross-couple event for tests 8 & 9)
INSERT INTO public.relationship_events
    (id, couple_id, creator_id, event_type, category, visibility, status, reconnected_at, created_at)
VALUES
    ('00000003-0003-0003-0003-000000000004',
     '00000002-0002-0002-0002-000000000002',
     '00000001-0001-0001-0001-000000000003',
     'friction', 'communication', 'ours', 'reconnected', now(), now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- SETUP: pre-insert a valid relation row for User A
-- (needed as a target for UPDATE tests 12–15 and DELETE test 16)
-- Inserted as postgres role, bypassing RLS.
-- =====================================================

INSERT INTO public.friction_moment_relations
    (current_event_id, prior_event_id, couple_id, user_id, decision)
VALUES (
    '00000003-0003-0003-0003-000000000001',
    '00000003-0003-0003-0003-000000000002',
    '00000002-0002-0002-0002-000000000001',
    '00000001-0001-0001-0001-000000000001',
    'deferred'
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- SETUP: pre-insert Partner A's suppression row
-- (needed so test 3 can verify Partner B is unaffected)
-- =====================================================

INSERT INTO public.friction_repair_memory_suppressions
    (event_id, user_id, suppress_suggestions)
VALUES (
    '00000003-0003-0003-0003-000000000001',
    '00000001-0001-0001-0001-000000000001',
    true
)
ON CONFLICT (event_id, user_id) DO NOTHING;

-- =====================================================
-- TEST 1: Valid owner INSERT into friction_moment_relations succeeds
-- User A (couple_1 member) inserts a row for a new event pair.
-- Uses ev_open as current so it doesn't conflict with the pre-inserted row.
-- =====================================================
SELECT lives_ok(
    $$
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claim.sub = '00000001-0001-0001-0001-000000000001';
    INSERT INTO public.friction_moment_relations
        (current_event_id, prior_event_id, couple_id, user_id, decision)
    VALUES (
        '00000003-0003-0003-0003-000000000003',
        '00000003-0003-0003-0003-000000000002',
        '00000002-0002-0002-0002-000000000001',
        '00000001-0001-0001-0001-000000000001',
        'deferred'
    );
    $$,
    'TEST 1: valid owner INSERT succeeds'
);

-- =====================================================
-- TEST 2: Partner B inserts independent decision — no conflict with Partner A
-- Same (current_event_id, prior_event_id) pair, different user_id.
-- =====================================================
SELECT lives_ok(
    $$
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claim.sub = '00000001-0001-0001-0001-000000000002';
    INSERT INTO public.friction_moment_relations
        (current_event_id, prior_event_id, couple_id, user_id, decision)
    VALUES (
        '00000003-0003-0003-0003-000000000001',
        '00000003-0003-0003-0003-000000000002',
        '00000002-0002-0002-0002-000000000001',
        '00000001-0001-0001-0001-000000000002',
        'related'
    );
    $$,
    'TEST 2: Partner B inserts independent decision — no conflict with Partner A'
);

-- =====================================================
-- TEST 3: Per-user suppression — Partner A suppressed; Partner B has no suppression row
-- Partner A's suppression was inserted in setup. Assert Partner B is unaffected.
-- =====================================================
SELECT is(
    (SELECT COUNT(*)::integer
     FROM public.friction_repair_memory_suppressions
     WHERE event_id = '00000003-0003-0003-0003-000000000001'
       AND user_id  = '00000001-0001-0001-0001-000000000002'),
    0,
    'TEST 3: Partner B has no suppression row — independent from Partner A'
);

-- =====================================================
-- TEST 4: Outsider (User C, couple_2) cannot INSERT into couple_1 relations
-- =====================================================
SELECT throws_ok(
    $$
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claim.sub = '00000001-0001-0001-0001-000000000003';
    INSERT INTO public.friction_moment_relations
        (current_event_id, prior_event_id, couple_id, user_id, decision)
    VALUES (
        '00000003-0003-0003-0003-000000000001',
        '00000003-0003-0003-0003-000000000002',
        '00000002-0002-0002-0002-000000000001',
        '00000001-0001-0001-0001-000000000003',
        'deferred'
    );
    $$,
    NULL, NULL,
    'TEST 4: outsider INSERT rejected by RLS'
);

-- =====================================================
-- TEST 5: Non-member (User D, no couple) cannot INSERT
-- =====================================================
SELECT throws_ok(
    $$
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claim.sub = '00000001-0001-0001-0001-000000000004';
    INSERT INTO public.friction_moment_relations
        (current_event_id, prior_event_id, couple_id, user_id, decision)
    VALUES (
        '00000003-0003-0003-0003-000000000001',
        '00000003-0003-0003-0003-000000000002',
        '00000002-0002-0002-0002-000000000001',
        '00000001-0001-0001-0001-000000000004',
        'deferred'
    );
    $$,
    NULL, NULL,
    'TEST 5: non-member INSERT rejected'
);

-- =====================================================
-- TEST 6: False user_id (user_id != auth.uid()) rejected by RLS WITH CHECK
-- User A authenticates but supplies user_b as user_id.
-- =====================================================
SELECT throws_ok(
    $$
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claim.sub = '00000001-0001-0001-0001-000000000001';
    INSERT INTO public.friction_moment_relations
        (current_event_id, prior_event_id, couple_id, user_id, decision)
    VALUES (
        '00000003-0003-0003-0003-000000000003',
        '00000003-0003-0003-0003-000000000002',
        '00000002-0002-0002-0002-000000000001',
        '00000001-0001-0001-0001-000000000002',  -- user_b, not auth.uid()
        'deferred'
    );
    $$,
    NULL, NULL,
    'TEST 6: false user_id (not auth.uid()) rejected by RLS WITH CHECK'
);

-- =====================================================
-- TEST 7: False couple_id (couple_2 events don't belong to couple_1) rejected
-- User A is in couple_1 but specifies couple_2 as couple_id.
-- The validation trigger checks ev_current belongs to couple_id.
-- =====================================================
SELECT throws_ok(
    $$
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claim.sub = '00000001-0001-0001-0001-000000000001';
    INSERT INTO public.friction_moment_relations
        (current_event_id, prior_event_id, couple_id, user_id, decision)
    VALUES (
        '00000003-0003-0003-0003-000000000001',
        '00000003-0003-0003-0003-000000000002',
        '00000002-0002-0002-0002-000000000002',  -- couple_2, but events belong to couple_1
        '00000001-0001-0001-0001-000000000001',
        'deferred'
    );
    $$,
    NULL, NULL,
    'TEST 7: false couple_id rejected by validation trigger or RLS'
);

-- =====================================================
-- TEST 8: Cross-couple current_event_id rejected
-- ev_cross belongs to couple_2; couple_id is couple_1.
-- =====================================================
SELECT throws_ok(
    $$
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claim.sub = '00000001-0001-0001-0001-000000000001';
    INSERT INTO public.friction_moment_relations
        (current_event_id, prior_event_id, couple_id, user_id, decision)
    VALUES (
        '00000003-0003-0003-0003-000000000004',  -- ev_cross: couple_2!
        '00000003-0003-0003-0003-000000000002',
        '00000002-0002-0002-0002-000000000001',
        '00000001-0001-0001-0001-000000000001',
        'deferred'
    );
    $$,
    NULL, NULL,
    'TEST 8: cross-couple current_event_id rejected by validation trigger'
);

-- =====================================================
-- TEST 9: Cross-couple prior_event_id rejected
-- ev_cross belongs to couple_2; prior must belong to same couple as current.
-- =====================================================
SELECT throws_ok(
    $$
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claim.sub = '00000001-0001-0001-0001-000000000001';
    INSERT INTO public.friction_moment_relations
        (current_event_id, prior_event_id, couple_id, user_id, decision)
    VALUES (
        '00000003-0003-0003-0003-000000000001',
        '00000003-0003-0003-0003-000000000004',  -- ev_cross: couple_2!
        '00000002-0002-0002-0002-000000000001',
        '00000001-0001-0001-0001-000000000001',
        'deferred'
    );
    $$,
    NULL, NULL,
    'TEST 9: cross-couple prior_event_id rejected by validation trigger'
);

-- =====================================================
-- TEST 10: Self-reference (current_event_id = prior_event_id) rejected by CHECK
-- =====================================================
SELECT throws_ok(
    $$
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claim.sub = '00000001-0001-0001-0001-000000000001';
    INSERT INTO public.friction_moment_relations
        (current_event_id, prior_event_id, couple_id, user_id, decision)
    VALUES (
        '00000003-0003-0003-0003-000000000001',
        '00000003-0003-0003-0003-000000000001',  -- same as current_event_id!
        '00000002-0002-0002-0002-000000000001',
        '00000001-0001-0001-0001-000000000001',
        'deferred'
    );
    $$,
    '23514', NULL,
    'TEST 10: self-reference (current_event_id = prior_event_id) rejected by CHECK'
);

-- =====================================================
-- TEST 11: Non-reconnected prior event with 'related' decision rejected by trigger
-- ev_open has status='open', not 'reconnected'. The validate trigger requires
-- prior_event status = 'reconnected' when decision IN ('related','somewhat_related').
-- =====================================================
SELECT throws_ok(
    $$
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claim.sub = '00000001-0001-0001-0001-000000000001';
    INSERT INTO public.friction_moment_relations
        (current_event_id, prior_event_id, couple_id, user_id, decision)
    VALUES (
        '00000003-0003-0003-0003-000000000001',
        '00000003-0003-0003-0003-000000000003',  -- ev_open: status='open', not 'reconnected'
        '00000002-0002-0002-0002-000000000001',
        '00000001-0001-0001-0001-000000000001',
        'related'
    );
    $$,
    NULL, NULL,
    'TEST 11: related decision with non-reconnected prior event rejected by trigger'
);

-- =====================================================
-- TEST 12: Identity-column UPDATE (user_id) rejected by protect_identity trigger
-- The pre-inserted row has user_id = user_a. Trying to change it to user_b
-- must raise an exception (SQLSTATE 23514 from trigger RAISE).
-- =====================================================
SELECT throws_ok(
    $$
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claim.sub = '00000001-0001-0001-0001-000000000001';
    UPDATE public.friction_moment_relations
    SET user_id = '00000001-0001-0001-0001-000000000002'
    WHERE user_id        = '00000001-0001-0001-0001-000000000001'
      AND current_event_id = '00000003-0003-0003-0003-000000000001';
    $$,
    '23514', NULL,
    'TEST 12: user_id UPDATE rejected by identity-protection trigger'
);

-- =====================================================
-- TEST 13: Identity-column UPDATE (current_event_id) rejected by trigger
-- =====================================================
SELECT throws_ok(
    $$
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claim.sub = '00000001-0001-0001-0001-000000000001';
    UPDATE public.friction_moment_relations
    SET current_event_id = '00000003-0003-0003-0003-000000000003'
    WHERE user_id        = '00000001-0001-0001-0001-000000000001'
      AND current_event_id = '00000003-0003-0003-0003-000000000001';
    $$,
    '23514', NULL,
    'TEST 13: current_event_id UPDATE rejected by identity-protection trigger'
);

-- =====================================================
-- TEST 14: Valid decision UPDATE by owner succeeds
-- =====================================================
SELECT lives_ok(
    $$
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claim.sub = '00000001-0001-0001-0001-000000000001';
    UPDATE public.friction_moment_relations
    SET decision = 'related'
    WHERE user_id        = '00000001-0001-0001-0001-000000000001'
      AND current_event_id = '00000003-0003-0003-0003-000000000001';
    $$,
    'TEST 14: valid decision UPDATE by owner succeeds'
);

-- =====================================================
-- TEST 15: Valid helpfulness_response UPDATE by owner succeeds
-- =====================================================
SELECT lives_ok(
    $$
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claim.sub = '00000001-0001-0001-0001-000000000001';
    UPDATE public.friction_moment_relations
    SET helpfulness_response = 'yes_helped'
    WHERE user_id        = '00000001-0001-0001-0001-000000000001'
      AND current_event_id = '00000003-0003-0003-0003-000000000001';
    $$,
    'TEST 15: valid helpfulness_response UPDATE by owner succeeds'
);

-- =====================================================
-- TEST 16: CASCADE deletion — deleting the event removes relation rows
-- Step 1: delete the event as postgres role (bypasses RLS).
-- Step 2: assert relation rows are gone (CASCADE FK ON DELETE CASCADE).
-- =====================================================

-- Delete the event (as postgres superuser — bypasses RLS intentionally).
DELETE FROM public.relationship_events
WHERE id = '00000003-0003-0003-0003-000000000001';

-- Now verify CASCADE removed all relation rows for that event.
SELECT is(
    (SELECT COUNT(*)::integer FROM public.friction_moment_relations
     WHERE current_event_id = '00000003-0003-0003-0003-000000000001'),
    0,
    'TEST 16: CASCADE deletion removes relation rows when event is deleted'
);

-- =====================================================
-- Finish and rollback — leaves no data in the database
-- =====================================================
SELECT * FROM finish();
ROLLBACK;
