BEGIN;
SELECT plan(68);

CREATE EXTENSION IF NOT EXISTS pgtap;

-- Test setup: couple and two partner accounts + unrelated couple C
DO $$
DECLARE
  v_user_a uuid := '00000000-0000-0000-0000-000000000001';
  v_user_b uuid := '00000000-0000-0000-0000-000000000002';
  v_user_c uuid := '00000000-0000-0000-0000-000000000003';
  v_couple_ab uuid := '00000000-0000-0000-0000-000000000010';
  v_couple_c uuid := '00000000-0000-0000-0000-000000000020';
BEGIN
  -- Cleanup
  DELETE FROM public.annoyance_private_notes WHERE author_id IN (v_user_a, v_user_b, v_user_c);
  DELETE FROM public.annoyance_reframes WHERE author_id IN (v_user_a, v_user_b, v_user_c);
  DELETE FROM public.user_device_push_tokens WHERE user_id IN (v_user_a, v_user_b, v_user_c);
  DELETE FROM public.user_notification_preferences WHERE user_id IN (v_user_a, v_user_b, v_user_c);
  DELETE FROM public.relationship_events WHERE creator_id IN (v_user_a, v_user_b, v_user_c);
  DELETE FROM public.couple_members WHERE user_id IN (v_user_a, v_user_b, v_user_c);
  DELETE FROM public.couple_profiles WHERE couple_id IN (v_couple_ab, v_couple_c);
  DELETE FROM public.couples WHERE id IN (v_couple_ab, v_couple_c);
  DELETE FROM auth.users WHERE id IN (v_user_a, v_user_b, v_user_c);

  INSERT INTO auth.users (id, email) VALUES
    (v_user_a, 'user-a@example.com'),
    (v_user_b, 'user-b@example.com'),
    (v_user_c, 'user-c@example.com');

  INSERT INTO public.couples (id, created_by, created_at) VALUES
    (v_couple_ab, v_user_a, now()),
    (v_couple_c, v_user_c, now());

  INSERT INTO public.couple_profiles (couple_id) VALUES
    (v_couple_ab),
    (v_couple_c)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.couple_members (couple_id, user_id) VALUES
    (v_couple_ab, v_user_a),
    (v_couple_ab, v_user_b),
    (v_couple_c, v_user_c)
  ON CONFLICT DO NOTHING;
END $$;

-- 1. Custom category constraint: Valid 'other' with trimmed label <= 60
SELECT is(
  (SELECT count(*)::int FROM public.relationship_events
   WHERE category = 'other'
     AND (custom_category_label IS NULL OR length(btrim(custom_category_label)) = 0 OR length(custom_category_label) > 60)),
  0,
  'No category=other row remains with a null, blank, or over-60-character label'
);

PREPARE valid_other AS
  INSERT INTO public.relationship_events (
    id, couple_id, creator_id, event_type, category, custom_category_label, visibility, status
  ) VALUES (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'positive',
    'other',
    'Star gazing in the backyard',
    'ours',
    'open'
  );
SELECT lives_ok('valid_other', 'Valid category=other with custom_category_label succeeds');

-- 2. Custom category constraint: Reject 'other' with null custom_category_label
PREPARE invalid_other_null AS
  INSERT INTO public.relationship_events (
    id, couple_id, creator_id, event_type, category, custom_category_label, visibility, status
  ) VALUES (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'positive',
    'other',
    NULL,
    'ours',
    'open'
  );
SELECT throws_ok('invalid_other_null', '23514', NULL, 'category=other with null label rejected by check constraint');

-- 3. Custom category constraint: Reject 'other' with empty/whitespace label
PREPARE invalid_other_whitespace AS
  INSERT INTO public.relationship_events (
    id, couple_id, creator_id, event_type, category, custom_category_label, visibility, status
  ) VALUES (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'positive',
    'other',
    '    ',
    'ours',
    'open'
  );
SELECT throws_ok('invalid_other_whitespace', '23514', NULL, 'category=other with whitespace-only label rejected');

-- 4. Custom category constraint: Reject 'other' with label > 60 chars
PREPARE invalid_other_long AS
  INSERT INTO public.relationship_events (
    id, couple_id, creator_id, event_type, category, custom_category_label, visibility, status
  ) VALUES (
    '10000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'positive',
    'other',
    'This custom label exceeds the sixty character limit for a custom category by quite a few characters',
    'ours',
    'open'
  );
SELECT throws_ok('invalid_other_long', '23514', NULL, 'category=other with label > 60 characters rejected');

-- 5. Custom category constraint: Reject non-other category with non-null custom_category_label
PREPARE invalid_non_other_with_label AS
  INSERT INTO public.relationship_events (
    id, couple_id, creator_id, event_type, category, custom_category_label, visibility, status
  ) VALUES (
    '10000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'positive',
    'appreciation',
    'Custom text not allowed here',
    'ours',
    'open'
  );
SELECT throws_ok('invalid_non_other_with_label', '23514', NULL, 'category<>other with custom label rejected');

-- 6. User Notification Preferences: User A can insert and read own preferences
SET ROLE authenticated;
SET "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

INSERT INTO public.user_notification_preferences (user_id, notify_on_partner_shared_moment)
VALUES ('00000000-0000-0000-0000-000000000001', true);

SELECT is(
  (SELECT notify_on_partner_shared_moment FROM public.user_notification_preferences WHERE user_id = '00000000-0000-0000-0000-000000000001'),
  true,
  'User A can read own notification preferences'
);

-- 7. User A cannot insert preferences for User B
PREPARE forged_pref_insert AS
  INSERT INTO public.user_notification_preferences (user_id, notify_on_partner_shared_moment)
  VALUES ('00000000-0000-0000-0000-000000000002', true);
SELECT throws_ok('forged_pref_insert', '42501', NULL, 'Forged user_id in notification preferences rejected by RLS');

-- 8. User B cannot see User A notification preferences
SET "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SET "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

SELECT is(
  (SELECT count(*)::int FROM public.user_notification_preferences WHERE user_id = '00000000-0000-0000-0000-000000000001'),
  0,
  'User B cannot read User A notification preferences'
);

-- 9. Device Push Tokens: User A registers token via register_device_push_token RPC
SET "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

PREPARE register_token_a AS
  SELECT public.register_device_push_token('ExponentPushToken[shared_device_token_999]', 'android');
SELECT lives_ok('register_token_a', 'User A registers device push token');

-- 10. Device Push Tokens: User B logs into same physical device and registers SAME token
SET "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SET "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

PREPARE register_token_b AS
  SELECT public.register_device_push_token('ExponentPushToken[shared_device_token_999]', 'android');
SELECT lives_ok('register_token_b', 'User B registers same device push token (account transfer)');

-- 11. User A no longer has this token registered (token ownership safely replaced)
SELECT is(
  (SELECT count(*)::int FROM public.user_device_push_tokens WHERE expo_push_token = 'ExponentPushToken[shared_device_token_999]' AND user_id = '00000000-0000-0000-0000-000000000001'),
  0,
  'User A no longer owns push token after User B registered it'
);

-- 12. User B currently owns the token
SELECT is(
  (SELECT count(*)::int FROM public.user_device_push_tokens WHERE expo_push_token = 'ExponentPushToken[shared_device_token_999]' AND user_id = '00000000-0000-0000-0000-000000000002'),
  1,
  'User B owns the push token'
);

-- 13. Unregister push token removes it cleanly
PREPARE unregister_token_b AS
  SELECT public.unregister_device_push_token('ExponentPushToken[shared_device_token_999]');
SELECT lives_ok('unregister_token_b', 'User B unregisters push token');

-- 14. Annoyance Reframes: User A creates a draft reframe
SET "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

PREPARE insert_draft_reframe AS
  INSERT INTO public.annoyance_reframes (
    id, couple_id, author_id, topic_key, is_playful, reframe_tone, reframe_text, status, shared_with_partner
  ) VALUES (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'socks',
    true,
    'playful',
    'The laundry museum has a new lonely sock exhibit',
    'draft',
    false
  );
SELECT lives_ok('insert_draft_reframe', 'Author A creates draft annoyance reframe');

-- 15. Partner B cannot read User A draft reframe
SET "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SET "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

SELECT is(
  (SELECT count(*)::int FROM public.annoyance_reframes WHERE id = '20000000-0000-0000-0000-000000000001'),
  0,
  'Partner B cannot read author draft reframe'
);

-- 16. Annoyance Private Notes: Author A inserts private note
SET "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

PREPARE insert_private_note_a AS
  INSERT INTO public.annoyance_private_notes (
    reframe_id, author_id, private_note
  ) VALUES (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'I felt really frustrated seeing socks left on the floor again'
  );
SELECT lives_ok('insert_private_note_a', 'Author A inserts private irritation note');

-- 17. Author A can read own private irritation note
SELECT is(
  (SELECT private_note FROM public.annoyance_private_notes WHERE reframe_id = '20000000-0000-0000-0000-000000000001'),
  'I felt really frustrated seeing socks left on the floor again',
  'Author A can read own private irritation note'
);

-- 18. Adversarial: User B attempts to attach private note to User A reframe -> REJECTED by RLS
SET "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SET "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

PREPARE adversarial_note_insert AS
  INSERT INTO public.annoyance_private_notes (
    reframe_id, author_id, private_note
  ) VALUES (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'Sneaking a note into partner reframe'
  );
SELECT throws_ok('adversarial_note_insert', '42501', NULL, 'User B attaching private note to User A reframe rejected by RLS');

-- 19. Adversarial: User B attempts to update User A private note -> REJECTED by RLS
CREATE OR REPLACE FUNCTION pg_temp.attempt_user_b_update_note()
RETURNS int LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_rows int;
BEGIN
  UPDATE public.annoyance_private_notes
  SET private_note = 'Hacked note'
  WHERE reframe_id = '20000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;
SELECT is(pg_temp.attempt_user_b_update_note(), 0, 'User B cannot update User A private note (0 rows)');

-- 20. Partner B CANNOT read Author A private note
SELECT is(
  (SELECT count(*)::int FROM public.annoyance_private_notes WHERE reframe_id = '20000000-0000-0000-0000-000000000001'),
  0,
  'Partner B cannot read Author A private irritation note'
);

-- 21. Shared Reframe: Author A marks reframe active and shared_with_partner = true
SET "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

PREPARE share_reframe_a AS
  UPDATE public.annoyance_reframes
  SET status = 'active', shared_with_partner = true
  WHERE id = '20000000-0000-0000-0000-000000000001';
SELECT lives_ok('share_reframe_a', 'Author A shares reframe with partner');

-- 22. Partner B CANNOT directly SELECT from base annoyance_reframes table (author-only RLS)
SET "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SET "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

SELECT is(
  (SELECT count(*)::int FROM public.annoyance_reframes WHERE id = '20000000-0000-0000-0000-000000000001'),
  0,
  'Partner B cannot directly SELECT from base annoyance_reframes table (author-only RLS)'
);

-- 23. But Partner B STILL cannot read the private note even after sharing reframe
SELECT is(
  (SELECT count(*)::int FROM public.annoyance_private_notes WHERE reframe_id = '20000000-0000-0000-0000-000000000001'),
  0,
  'Partner B still cannot read private irritation note even after sharing reframe'
);

-- 24. Partner B cannot delete Author A reframe
CREATE OR REPLACE FUNCTION pg_temp.attempt_partner_delete_reframe()
RETURNS int LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_rows int;
BEGIN
  DELETE FROM public.annoyance_reframes WHERE id = '20000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;
SELECT is(pg_temp.attempt_partner_delete_reframe(), 0, 'Partner B cannot delete author reframe (0 rows)');

-- 25. Partner B cannot update Author A reframe
CREATE OR REPLACE FUNCTION pg_temp.attempt_partner_update_reframe()
RETURNS int LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_rows int;
BEGIN
  UPDATE public.annoyance_reframes SET reframe_text = 'Tampered' WHERE id = '20000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;
SELECT is(pg_temp.attempt_partner_update_reframe(), 0, 'Partner B cannot update author reframe (0 rows)');

-- 26. Cross-couple: Author A attempts to link reframe to an event belonging to Couple C -> trigger rejects
-- First create an event for Couple C
SET ROLE postgres;
INSERT INTO public.relationship_events (
  id, couple_id, creator_id, event_type, category, visibility, status
) VALUES (
  '10000000-0000-0000-0000-000000000099',
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000003',
  'positive',
  'appreciation',
  'ours',
  'open'
);

SET ROLE authenticated;
SET "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

PREPARE cross_couple_event_link AS
  INSERT INTO public.annoyance_reframes (
    couple_id, author_id, event_id, topic_key, status
  ) VALUES (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000099',
    'socks',
    'draft'
  );
SELECT throws_ok('cross_couple_event_link', '23514', NULL, 'Linking reframe to event of a different couple rejected by trigger');

-- 27. Cross-couple: Author A attempts to update couple_id on reframe -> rejected by trigger
PREPARE update_reframe_couple AS
  UPDATE public.annoyance_reframes
  SET couple_id = '00000000-0000-0000-0000-000000000020'
  WHERE id = '20000000-0000-0000-0000-000000000001';
SELECT throws_ok('update_reframe_couple', '23514', NULL, 'Changing couple_id on annoyance reframe rejected by trigger');

-- 28. Forged author_id on annoyance reframe insertion is rejected by RLS
SET "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SET "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

PREPARE forged_reframe_author AS
  INSERT INTO public.annoyance_reframes (
    couple_id, author_id, topic_key, status
  ) VALUES (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'coffee_mug',
    'draft'
  );
SELECT throws_ok('forged_reframe_author', '42501', NULL, 'Forged author_id in annoyance_reframes rejected by RLS');

-- Function signature existence and unambiguity checks
SELECT has_function(
  'public',
  'create_relationship_moment',
  ARRAY['uuid', 'text', 'text', 'smallint', 'text', 'text', 'text'],
  '7-argument create_relationship_moment compatibility wrapper exists'
);

SELECT has_function(
  'public',
  'create_relationship_moment',
  ARRAY['uuid', 'text', 'text', 'smallint', 'text', 'text', 'text', 'text'],
  '8-argument create_relationship_moment function exists'
);

-- 29. Backward-compatible 7-argument create_relationship_moment call succeeds (installed v0.1.0 APK)
SET "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

PREPARE rpc_7arg_call AS
  SELECT public.create_relationship_moment(
    '00000000-0000-0000-0000-000000000010'::uuid,
    'positive',
    'appreciation',
    NULL::smallint,
    'ours',
    'My private gratitude note',
    'Evening tea'
  );
SELECT lives_ok('rpc_7arg_call', '7-argument create_relationship_moment compatibility wrapper succeeds');

SELECT is(
  (SELECT custom_category_label FROM public.relationship_events WHERE shared_topic = 'Evening tea' AND category = 'appreciation'),
  NULL,
  '7-argument create_relationship_moment stores NULL custom_category_label for non-other event'
);

-- 7-argument create_relationship_moment with category=other stores 'Other'
PREPARE rpc_7arg_other AS
  SELECT public.create_relationship_moment(
    '00000000-0000-0000-0000-000000000010'::uuid,
    'positive',
    'other',
    NULL::smallint,
    'ours',
    '7-arg legacy moment note',
    'Legacy other shared topic'
  );
SELECT lives_ok('rpc_7arg_other', '7-argument create_relationship_moment creates category=other event');

SELECT is(
  (SELECT custom_category_label FROM public.relationship_events WHERE shared_topic = 'Legacy other shared topic' AND category = 'other'),
  'Other',
  '7-argument RPC stores custom_category_label = Other for category=other'
);

-- 30. 8-argument create_relationship_moment with custom_category_label for category=other succeeds
PREPARE rpc_8arg_valid_other AS
  SELECT public.create_relationship_moment(
    '00000000-0000-0000-0000-000000000010'::uuid,
    'positive',
    'other',
    NULL::smallint,
    'ours',
    'Private note',
    'Shared topic',
    'Backyard gardening'
  );
SELECT lives_ok('rpc_8arg_valid_other', '8-argument create_relationship_moment with custom_category_label succeeds');

-- 8-argument create_relationship_moment stores supplied trimmed custom label
PREPARE rpc_8arg_trimmed_other AS
  SELECT public.create_relationship_moment(
    '00000000-0000-0000-0000-000000000010'::uuid,
    'positive',
    'other',
    NULL::smallint,
    'ours',
    '8-arg trimmed note',
    'Stargazing topic',
    '   Stargazing on roof   '
  );
SELECT lives_ok('rpc_8arg_trimmed_other', '8-argument create_relationship_moment with trimmed custom label succeeds');

SELECT is(
  (SELECT custom_category_label FROM public.relationship_events WHERE shared_topic = 'Stargazing topic' AND category = 'other'),
  'Stargazing on roof',
  '8-argument RPC stores supplied trimmed custom label'
);

-- 31. 8-argument create_relationship_moment for category=other without label throws exception
PREPARE rpc_8arg_invalid_other AS
  SELECT public.create_relationship_moment(
    '00000000-0000-0000-0000-000000000010'::uuid,
    'positive',
    'other',
    NULL::smallint,
    'ours',
    NULL,
    NULL,
    NULL
  );
SELECT throws_ok('rpc_8arg_invalid_other', NULL, 'Custom category label is required and must be 60 characters or fewer', 'create_relationship_moment without custom label for other throws');

-- 8-argument create_relationship_moment for category=other with blank/whitespace label throws exception
PREPARE rpc_8arg_blank_other AS
  SELECT public.create_relationship_moment(
    '00000000-0000-0000-0000-000000000010'::uuid,
    'positive',
    'other',
    NULL::smallint,
    'ours',
    NULL,
    NULL,
    '     '
  );
SELECT throws_ok('rpc_8arg_blank_other', NULL, 'Custom category label is required and must be 60 characters or fewer', '8-argument create_relationship_moment with blank custom label throws');

-- 8-argument create_relationship_moment with non-other category clears custom_category_label
PREPARE rpc_8arg_non_other_with_label AS
  SELECT public.create_relationship_moment(
    '00000000-0000-0000-0000-000000000010'::uuid,
    'positive',
    'appreciation',
    NULL::smallint,
    'ours',
    'Appreciation note',
    'Non-other topic',
    'Should be cleared'
  );
SELECT lives_ok('rpc_8arg_non_other_with_label', '8-argument RPC with non-other category and label succeeds');

SELECT is(
  (SELECT custom_category_label FROM public.relationship_events WHERE shared_topic = 'Non-other topic' AND category = 'appreciation'),
  NULL,
  'Non-other events do not retain custom_category_label'
);

-- 32. Atomic save_annoyance_reframe RPC inserts reframe and private note atomically
PREPARE atomic_save_rpc AS
  SELECT public.save_annoyance_reframe(
    '00000000-0000-0000-0000-000000000010'::uuid,
    'coffee_mug',
    NULL,
    true,
    'gentle',
    'One little mug waiting for its journey home',
    false,
    'draft',
    false,
    NULL,
    NULL,
    NULL,
    NULL,
    'I really wish mugs were placed in the dishwasher directly'
  );
SELECT lives_ok('atomic_save_rpc', 'Atomic save_annoyance_reframe RPC executes successfully');

-- 33. Verify atomic save_annoyance_reframe persisted the private note
SELECT is(
  (SELECT count(*)::int FROM public.annoyance_private_notes WHERE private_note = 'I really wish mugs were placed in the dishwasher directly'),
  1,
  'Atomic save_annoyance_reframe RPC saved the private note in the same transaction'
);

-- 34. Atomic save_annoyance_reframe RPC update on own reframe succeeds
PREPARE atomic_update_rpc AS
  SELECT public.save_annoyance_reframe(
    '00000000-0000-0000-0000-000000000010'::uuid,
    'coffee_mug',
    NULL,
    true,
    'playful',
    'Kitchen museum mug exhibit updated',
    true,
    'active',
    true,
    'Wash mug together',
    'both',
    'Today',
    'Tea together',
    'Updated irritation note',
    '20000000-0000-0000-0000-000000000001'::uuid
  );
SELECT lives_ok('atomic_update_rpc', 'Atomic save_annoyance_reframe RPC update succeeds');

-- 35. Atomic reserve_shared_moment_notification_delivery reserves delivery attempt
RESET ROLE;
SET ROLE postgres;
SELECT is(
  (public.reserve_shared_moment_notification_delivery(
    '10000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid,
    60
  ))->>'reserved',
  'true',
  'First reservation returns reserved = true'
);

-- 36. Concurrent second reservation returns reserved = false with reason = pending_in_progress
SELECT is(
  (public.reserve_shared_moment_notification_delivery(
    '10000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid,
    60
  ))->>'reason',
  'pending_in_progress',
  'Concurrent reservation blocked with pending_in_progress'
);

-- 37. Complete delivery bound to reservation attempt 1 succeeds
SELECT is(
  public.complete_shared_moment_notification_delivery(
    '10000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid,
    1,
    'accepted',
    NULL
  ),
  true,
  'complete_shared_moment_notification_delivery marks delivery accepted on matching attempt'
);

-- 38. Reservation attempt after acceptance returns reserved = false with reason = already_accepted
SELECT is(
  (public.reserve_shared_moment_notification_delivery(
    '10000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid,
    60
  ))->>'reason',
  'already_accepted',
  'Reservation blocked when already accepted'
);

-- 39. Reset to failed to test retry and attempt binding
UPDATE public.shared_moment_notification_deliveries
SET status = 'failed', last_error = 'DeviceNotRegistered', updated_at = now()
WHERE event_id = '10000000-0000-0000-0000-000000000001'::uuid
  AND recipient_id = '00000000-0000-0000-0000-000000000002'::uuid;

SELECT is(
  (SELECT status FROM public.shared_moment_notification_deliveries WHERE event_id = '10000000-0000-0000-0000-000000000001'::uuid),
  'failed',
  'Status reset to failed'
);

-- 40. Reserve call after failed status succeeds with reserved = true and increments attempt_count to 2
SELECT is(
  (public.reserve_shared_moment_notification_delivery(
    '10000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid,
    60
  ))->>'reserved',
  'true',
  'Failed delivery can be retried'
);

-- 41. Stale pending reservation retries after stale timeout (increments to attempt 3)
UPDATE public.shared_moment_notification_deliveries
SET reserved_at = now() - interval '120 seconds'
WHERE event_id = '10000000-0000-0000-0000-000000000001'::uuid
  AND recipient_id = '00000000-0000-0000-0000-000000000002'::uuid;

SELECT is(
  (public.reserve_shared_moment_notification_delivery(
    '10000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid,
    60
  ))->>'attempt_count',
  '3',
  'Stale pending reservation increments attempt_count to 3'
);

-- 42. Stale worker test: Attempt 1 cannot complete after Attempt 3 has reserved
SELECT is(
  public.complete_shared_moment_notification_delivery(
    '10000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid,
    1,
    'accepted',
    NULL
  ),
  false,
  'Stale attempt 1 cannot complete after attempt 3 has reserved'
);

-- 43. Authenticated user cannot SELECT from shared_moment_notification_deliveries (REVOKE check)
SET ROLE authenticated;
SET "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

PREPARE auth_select_deliveries AS
  SELECT * FROM public.shared_moment_notification_deliveries;
SELECT throws_ok('auth_select_deliveries', '42501', NULL, 'Authenticated user cannot SELECT from deliveries table');

-- 44. Authenticated user cannot INSERT into shared_moment_notification_deliveries (REVOKE check)
PREPARE auth_insert_deliveries AS
  INSERT INTO public.shared_moment_notification_deliveries (event_id, recipient_id, status)
  VALUES ('10000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'pending');
SELECT throws_ok('auth_insert_deliveries', '42501', NULL, 'Authenticated user cannot INSERT into deliveries table');

-- 45. save_annoyance_reframe challenge-only update preserves topic, tone, text, and private note
SELECT public.save_annoyance_reframe(
  p_couple_id := '00000000-0000-0000-0000-000000000010'::uuid,
  p_topic_key := NULL::text,
  p_custom_topic_label := NULL::text,
  p_is_playful := true,
  p_reframe_tone := NULL::text,
  p_reframe_text := NULL::text,
  p_include_reframe_with_partner := true,
  p_status := 'active'::text,
  p_shared_with_partner := true,
  p_challenge_idea := 'Have a fresh cup of tea'::text,
  p_challenge_participant := 'both'::text,
  p_challenge_timeframe := 'Tomorrow'::text,
  p_challenge_reward := 'A warm hug'::text,
  p_private_note := NULL::text,
  p_id := '20000000-0000-0000-0000-000000000001'::uuid,
  p_event_id := NULL::uuid,
  p_clear_reframe_text := false,
  p_clear_private_note := false
);

SELECT is(
  (SELECT topic_key FROM public.annoyance_reframes WHERE id = '20000000-0000-0000-0000-000000000001'::uuid),
  'coffee_mug',
  'save_annoyance_reframe preserved existing topic_key when not supplied'
);

-- 46. Verify private note is preserved after challenge-only update
SELECT is(
  (SELECT private_note FROM public.annoyance_private_notes WHERE reframe_id = '20000000-0000-0000-0000-000000000001'::uuid),
  'Updated irritation note',
  'save_annoyance_reframe preserved existing private note on challenge update'
);

-- 47. Partner (user 2) directly running SELECT from annoyance_reframes returns 0 rows (base-table RLS)
SET "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SET "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

SELECT is(
  (SELECT count(*)::int FROM public.annoyance_reframes WHERE id = '20000000-0000-0000-0000-000000000001'::uuid),
  0,
  'Partner cannot directly SELECT author base reframe row'
);

-- 48. Partner cannot view author private irritation note (RLS check)
SELECT is(
  (SELECT count(*)::int FROM public.annoyance_private_notes WHERE reframe_id = '20000000-0000-0000-0000-000000000001'::uuid),
  0,
  'Partner cannot view author private irritation note'
);

-- 49. Safe RPC get_active_partner_annoyance_challenges returns shared active partner invitation
SELECT is(
  (SELECT count(*)::int FROM public.get_active_partner_annoyance_challenges('00000000-0000-0000-0000-000000000010'::uuid)),
  1,
  'Safe RPC returns shared active partner invitation for partner'
);

-- 50. Safe RPC returns reframe_text when include_reframe_with_partner is true
SELECT is(
  (SELECT reframe_text FROM public.get_active_partner_annoyance_challenges('00000000-0000-0000-0000-000000000010'::uuid) LIMIT 1),
  'Kitchen museum mug exhibit updated',
  'Safe RPC returns reframe_text when inclusion is true'
);

-- 51. Safe RPC excludes author-created invitation when queried by the author
SET "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

SELECT is(
  (SELECT count(*)::int FROM public.get_active_partner_annoyance_challenges('00000000-0000-0000-0000-000000000010'::uuid)),
  0,
  'Safe RPC excludes author-created invitation from author'
);

-- 52. Safe RPC masks reframe_text to NULL when include_reframe_with_partner is false
-- Author updates reframe to include_reframe_with_partner = false
UPDATE public.annoyance_reframes
SET include_reframe_with_partner = false
WHERE id = '20000000-0000-0000-0000-000000000001'::uuid;

-- Switch back to partner
SET "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SET "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

SELECT ok(
  (SELECT reframe_text IS NULL FROM public.get_active_partner_annoyance_challenges('00000000-0000-0000-0000-000000000010'::uuid) LIMIT 1),
  'Safe RPC masks reframe_text to NULL when inclusion is false'
);

-- 53. Unrelated user C calling safe RPC throws 'Forbidden: not a member of this couple'
SET "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SET "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';

PREPARE unauth_couple_rpc AS
  SELECT * FROM public.get_active_partner_annoyance_challenges('00000000-0000-0000-0000-000000000010'::uuid);
SELECT throws_ok('unauth_couple_rpc', NULL, 'Forbidden: not a member of this couple', 'Unrelated user cannot call safe RPC for another couple');

-- 54. Author attempting to respond to own challenge throws 'Author cannot respond to own challenge invitation'
SET "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

PREPARE author_self_response AS
  SELECT public.respond_to_annoyance_challenge(
    '20000000-0000-0000-0000-000000000001'::uuid,
    'accept'
  );
SELECT throws_ok('author_self_response', NULL, 'Author cannot respond to own challenge invitation', 'Author cannot respond to own challenge invitation');

-- 55. Unrelated user C attempting to respond throws 'Forbidden: not a partner member of this couple'
SET "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SET "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000003';

PREPARE unauth_challenge_response AS
  SELECT public.respond_to_annoyance_challenge(
    '20000000-0000-0000-0000-000000000001'::uuid,
    'accept'
  );
SELECT throws_ok('unauth_challenge_response', NULL, 'Forbidden: not a partner member of this couple', 'Unrelated user cannot respond to couple challenge');

-- 56. Partner accepts challenge invitation via respond_to_annoyance_challenge
SET "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SET "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000002';

PREPARE partner_accept_challenge AS
  SELECT public.respond_to_annoyance_challenge(
    '20000000-0000-0000-0000-000000000001'::uuid,
    'accept'
  );
SELECT lives_ok('partner_accept_challenge', 'Partner accepting challenge succeeds');

-- 57. Reframe status transitioned to resolved (verified by author)
SET "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SET "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';

SELECT is(
  (SELECT status FROM public.annoyance_reframes WHERE id = '20000000-0000-0000-0000-000000000001'::uuid),
  'resolved',
  'Reframe status transitioned to resolved upon acceptance'
);

-- Cleanup and reset
RESET ROLE;
RESET "request.jwt.claims";
RESET "request.jwt.claim.sub";

SELECT * FROM finish();
ROLLBACK;
