-- Deterministic Acceptance Fixture for Repair Memory MVP
-- Sets up Partner A and Partner B in Couple 1, with:
-- 1. One prior reconnected communication friction event (~18h duration)
-- 2. Partner A's private reflection
-- 3. Partner B's private reflection (distinct)
-- 4. Shared repair takeaway note and tag
-- 5. One new open communication friction event
-- 6. Couple 2 with Partner C (for cross-couple isolation proof)

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Users
INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    aud, role, instance_id
)
SELECT
    t.id, t.email, crypt('Password123!', gen_salt('bf')), now(),
    '', '', '', '',
    now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('partner_name', t.name),
    'authenticated', 'authenticated',
    '00000000-0000-0000-0000-000000000000'
FROM (VALUES
    ('a0000001-0001-0001-0001-000000000001'::uuid, 'partner-a@example.com', 'Partner A'),
    ('b0000001-0001-0001-0001-000000000002'::uuid, 'partner-b@example.com', 'Partner B'),
    ('c0000001-0001-0001-0001-000000000003'::uuid, 'partner-c@example.com', 'Partner C')
) AS t(id, email, name)
ON CONFLICT (id) DO UPDATE SET
    encrypted_password = EXCLUDED.encrypted_password,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

-- 2. Couples
INSERT INTO public.couples (id, created_by, created_at)
VALUES
    ('10000002-0002-0002-0002-000000000001', 'a0000001-0001-0001-0001-000000000001', now()),
    ('20000002-0002-0002-0002-000000000002', 'c0000001-0001-0001-0001-000000000003', now())
ON CONFLICT (id) DO NOTHING;

-- 3. Couple membership
-- Partner A and Partner C are auto-added as creators by on_couple_created trigger.
-- Add Partner B to Couple 1:
INSERT INTO public.couple_members (couple_id, user_id, joined_at)
VALUES ('10000002-0002-0002-0002-000000000001', 'b0000001-0001-0001-0001-000000000002', now())
ON CONFLICT (couple_id, user_id) DO NOTHING;

-- 4. Prior reconnected friction event in Couple 1 (created 48h ago, reconnected 30h ago -> 18h duration)
INSERT INTO public.relationship_events (
    id, couple_id, creator_id, event_type, category,
    intensity, visibility, status, shared_topic,
    created_at, reconnected_at
) VALUES (
    'e0000003-0003-0003-0003-000000000001',
    '10000002-0002-0002-0002-000000000001',
    'a0000001-0001-0001-0001-000000000001',
    'friction',
    'communication',
    3,
    'ours',
    'reconnected',
    'Talking through speaking over each other in meetings',
    now() - interval '48 hours',
    now() - interval '30 hours'
) ON CONFLICT (id) DO NOTHING;

-- 5. Partner A's private reflection on prior event
INSERT INTO public.event_private_reflections (
    event_id, author_id, note, created_at, updated_at
) VALUES (
    'e0000003-0003-0003-0003-000000000001',
    'a0000001-0001-0001-0001-000000000001',
    'I took a deep breath and listened without jumping in immediately.',
    now() - interval '35 hours',
    now() - interval '35 hours'
) ON CONFLICT (event_id, author_id) DO UPDATE SET
    note = EXCLUDED.note;

-- 6. Partner B's private reflection on prior event (completely different note)
INSERT INTO public.event_private_reflections (
    event_id, author_id, note, created_at, updated_at
) VALUES (
    'e0000003-0003-0003-0003-000000000001',
    'b0000001-0001-0001-0001-000000000002',
    'I took a 15-minute walk before responding so my tone stayed gentle.',
    now() - interval '34 hours',
    now() - interval '34 hours'
) ON CONFLICT (event_id, author_id) DO UPDATE SET
    note = EXCLUDED.note;

-- 7. Shared repair outcome on prior event
INSERT INTO public.relationship_event_repair_outcomes (
    event_id, couple_id, completed_by, takeaway_tag, takeaway_note, completed_at
) VALUES (
    'e0000003-0003-0003-0003-000000000001',
    '10000002-0002-0002-0002-000000000001',
    'a0000001-0001-0001-0001-000000000001',
    'talking_it_through',
    'We agreed to pause before reacting when sensitive topics come up.',
    now() - interval '30 hours'
) ON CONFLICT (event_id) DO UPDATE SET
    takeaway_tag = EXCLUDED.takeaway_tag,
    takeaway_note = EXCLUDED.takeaway_note;

-- 8. New open communication friction event in Couple 1 (created 1h ago)
INSERT INTO public.relationship_events (
    id, couple_id, creator_id, event_type, category,
    intensity, visibility, status, shared_topic,
    created_at
) VALUES (
    'e0000003-0003-0003-0003-000000000002',
    '10000002-0002-0002-0002-000000000001',
    'a0000001-0001-0001-0001-000000000001',
    'friction',
    'communication',
    2,
    'ours',
    'open',
    'Misunderstanding about who had evening plans',
    now() - interval '1 hour'
) ON CONFLICT (id) DO NOTHING;

-- 9. Prior reconnected friction in Couple 2 (same-category reconnected event with duration but NO reusable content)
INSERT INTO public.relationship_events (
    id, couple_id, creator_id, event_type, category,
    intensity, visibility, status, shared_topic,
    created_at, reconnected_at
) VALUES (
    'e0000003-0003-0003-0003-000000000009',
    '20000002-0002-0002-0002-000000000002',
    'c0000001-0001-0001-0001-000000000003',
    'friction',
    'communication',
    3,
    'ours',
    'reconnected',
    'Couple 2 prior friction with no reflection or takeaway',
    now() - interval '48 hours',
    now() - interval '30 hours'
) ON CONFLICT (id) DO NOTHING;

-- 10. New open communication friction event in Couple 2 (candidate lookup should yield 0 candidates)
INSERT INTO public.relationship_events (
    id, couple_id, creator_id, event_type, category,
    intensity, visibility, status, shared_topic,
    created_at
) VALUES (
    'e0000003-0003-0003-0003-000000000010',
    '20000002-0002-0002-0002-000000000002',
    'c0000001-0001-0001-0001-000000000003',
    'friction',
    'communication',
    2,
    'ours',
    'open',
    'Couple 2 new friction',
    now() - interval '30 minutes'
) ON CONFLICT (id) DO NOTHING;

COMMIT;
