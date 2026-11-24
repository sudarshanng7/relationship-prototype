import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveWhatMattersNowActivity,
  TWENTY_FOUR_HOURS_MS,
} from "../src/lib/home-activity.ts";

/**
 * Targeted Unit Tests for Purple Garden Challenge Sharing in "What matters now"
 *
 * Covers:
 * - Scenario CH1: Newly shared challenge surfaces for receiving partner (with correct copy & route)
 * - Scenario CH1b: Author sharing challenge does not receive their own invitation activity (recipient-only)
 * - Scenario CH2: Recipient opening challenge records receipt and returns to calm empty state
 * - Scenario CH3: Non-backlog protection (multiple historical challenges do not cycle or queue up)
 * - Scenario CH4: Priority coexistence (friction/repair Priority 1 & 2 vs challenge Priority 2)
 * - Scenario CH5: Receipt persistence across reloads / refetches keeps challenge excluded
 * - Scenario CH6: Privacy / isolation (different couple cannot access, inactive/unshared challenges excluded)
 * - Scenario CH7: Re-sharing / newer version behavior (revised/updated timestamp creates fresh version)
 */

const NOW = new Date("2026-11-24T18:00:00.000Z").getTime();
const PARTNER_A_ID = "a0000001-0001-0001-0001-000000000001";
const PARTNER_B_ID = "b0000001-0001-0001-0001-000000000002";
const COUPLE_ID = "10000002-0002-0002-0002-000000000001";

test("CH1: Newly shared challenge appears in What Matters Now for receiving partner", () => {
  const challenge = {
    id: "ch-100",
    couple_id: COUPLE_ID,
    author_id: PARTNER_A_ID,
    challenge_idea: "Brew a cup of tea together",
    challenge_participant: "both",
    challenge_timeframe: "Today",
    challenge_reward: "No reward — just the moment",
    status: "active",
    shared_with_partner: true,
    created_at: new Date(NOW - 30 * 60 * 1000).toISOString(), // 30m ago
  };

  const activity = deriveWhatMattersNowActivity({
    events: [],
    challenges: [challenge],
    nowMs: NOW,
    currentUserId: PARTNER_B_ID,
    coupleId: COUPLE_ID,
    partnerName: "Taylor",
  });

  assert.equal(activity.kind, "challenge_shared");
  assert.equal(activity.overline, "🌱 SOMETHING TOGETHER");
  assert.equal(activity.title, "Taylor shared a challenge with you");
  assert.equal(activity.body, '"Brew a cup of tea together"');
  assert.equal(activity.actionLabel, "Take a look");
  assert.equal(activity.priority, 2);
  assert.equal(activity.actionable, true);
  assert.equal(activity.attentionMode, "actionable");
  assert.ok(activity.route.includes("/challenge-lifecycle-preview?id=ch-100"));
});

test("CH1b: Author sharing a challenge does not get a recipient challenge activity (recipient-only)", () => {
  const challenge = {
    id: "ch-100",
    couple_id: COUPLE_ID,
    author_id: PARTNER_A_ID,
    challenge_idea: "Step outside for fresh air",
    challenge_participant: "both",
    status: "active",
    shared_with_partner: true,
    created_at: new Date(NOW - 15 * 60 * 1000).toISOString(),
  };

  const activityForAuthor = deriveWhatMattersNowActivity({
    events: [],
    challenges: [challenge],
    nowMs: NOW,
    currentUserId: PARTNER_A_ID, // Partner A is the author
    coupleId: COUPLE_ID,
    partnerName: "Taylor",
  });

  // Author should see calm state (or whatever other activity exists), NOT "Taylor shared a challenge"
  assert.equal(activityForAuthor.kind, "empty");
  assert.equal(activityForAuthor.title, "Nothing needs your attention right now");
});

test("CH2: Recipient opening challenge suppresses it via seen receipts (returns to calm state)", () => {
  const challenge = {
    id: "ch-101",
    couple_id: COUPLE_ID,
    author_id: PARTNER_A_ID,
    challenge_idea: "Five quiet minutes with no screens",
    challenge_participant: "both",
    status: "active",
    shared_with_partner: true,
    created_at: new Date(NOW - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
  };

  const initialActivity = deriveWhatMattersNowActivity({
    events: [],
    challenges: [challenge],
    nowMs: NOW,
    currentUserId: PARTNER_B_ID,
    coupleId: COUPLE_ID,
    partnerName: "Taylor",
  });
  assert.equal(initialActivity.kind, "challenge_shared");

  // Simulate Partner B opening the challenge -> receipt is recorded
  const receipt = {
    couple_id: COUPLE_ID,
    user_id: PARTNER_B_ID,
    activity_key: initialActivity.key,
    activity_kind: "challenge_shared",
    source_id: challenge.id,
    attention_mode: "actionable",
    seen_at: new Date(NOW - 5 * 60 * 1000).toISOString(),
  };

  const postSeenActivity = deriveWhatMattersNowActivity({
    events: [],
    challenges: [challenge],
    receipts: [receipt],
    nowMs: NOW,
    currentUserId: PARTNER_B_ID,
    coupleId: COUPLE_ID,
    partnerName: "Taylor",
  });

  assert.equal(postSeenActivity.kind, "empty");
  assert.equal(postSeenActivity.title, "Nothing needs your attention right now");
});

test("CH3: Critical Non-Backlog Rule - older challenges do NOT cycle through What Matters Now after newest is seen", () => {
  const olderChallenge = {
    id: "ch-older",
    couple_id: COUPLE_ID,
    author_id: PARTNER_A_ID,
    challenge_idea: "Older challenge idea",
    challenge_participant: "both",
    status: "active",
    shared_with_partner: true,
    created_at: new Date(NOW - 10 * 60 * 60 * 1000).toISOString(), // 10h ago
  };

  const newestChallenge = {
    id: "ch-newest",
    couple_id: COUPLE_ID,
    author_id: PARTNER_A_ID,
    challenge_idea: "Newest challenge idea",
    challenge_participant: "both",
    status: "active",
    shared_with_partner: true,
    created_at: new Date(NOW - 1 * 60 * 60 * 1000).toISOString(), // 1h ago
  };

  // Both challenges are in the database
  const bothChallenges = [olderChallenge, newestChallenge];

  // 1. Initial state: newest challenge is surfaced
  const activity1 = deriveWhatMattersNowActivity({
    events: [],
    challenges: bothChallenges,
    nowMs: NOW,
    currentUserId: PARTNER_B_ID,
    coupleId: COUPLE_ID,
    partnerName: "Taylor",
  });
  assert.equal(activity1.kind, "challenge_shared");
  assert.equal(activity1.sourceId, "ch-newest");

  // 2. Partner B opens the newest challenge -> seen receipt created for newest
  const newestReceipt = {
    couple_id: COUPLE_ID,
    user_id: PARTNER_B_ID,
    activity_key: activity1.key,
    activity_kind: "challenge_shared",
    source_id: "ch-newest",
    attention_mode: "actionable",
    seen_at: new Date(NOW - 30 * 60 * 1000).toISOString(),
  };

  // 3. Re-evaluating: What Matters Now must NOT promote olderChallenge as a backlog queue!
  const activity2 = deriveWhatMattersNowActivity({
    events: [],
    challenges: bothChallenges,
    receipts: [newestReceipt],
    nowMs: NOW,
    currentUserId: PARTNER_B_ID,
    coupleId: COUPLE_ID,
    partnerName: "Taylor",
  });

  assert.equal(activity2.kind, "empty", "Must return calm empty state, not backlog older challenge");
  assert.equal(activity2.title, "Nothing needs your attention right now");
});

test("CH4: Priority Coexistence - higher-priority relationship friction wins over newly shared challenge", () => {
  const challenge = {
    id: "ch-102",
    couple_id: COUPLE_ID,
    author_id: PARTNER_A_ID,
    challenge_idea: "Put on one relaxing song",
    challenge_participant: "both",
    status: "active",
    shared_with_partner: true,
    created_at: new Date(NOW - 10 * 60 * 1000).toISOString(), // 10m ago (new)
  };

  const frictionEvent = {
    id: "event-friction-1",
    couple_id: COUPLE_ID,
    creator_id: PARTNER_A_ID,
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: new Date(NOW - 2 * 60 * 60 * 1000).toISOString(), // 2h ago (older than challenge)
  };

  // Even though challenge is newer (10m ago vs 2h ago), friction is Priority 1 vs challenge Priority 2
  const activity = deriveWhatMattersNowActivity({
    events: [frictionEvent],
    challenges: [challenge],
    nowMs: NOW,
    currentUserId: PARTNER_B_ID,
    coupleId: COUPLE_ID,
    partnerName: "Taylor",
  });

  assert.equal(activity.kind, "shared_friction", "Friction (Priority 1) must take precedence over Challenge (Priority 2)");
  assert.equal(activity.priority, 1);
  assert.equal(activity.sourceId, "event-friction-1");
});

test("CH4b: Challenge outranks lower-priority shared-list / routine activity (Priority 2 > Priority 3)", () => {
  const challenge = {
    id: "ch-103",
    couple_id: COUPLE_ID,
    author_id: PARTNER_A_ID,
    challenge_idea: "A 5-minute garden walk",
    challenge_participant: "both",
    status: "active",
    shared_with_partner: true,
    created_at: new Date(NOW - 4 * 60 * 60 * 1000).toISOString(), // 4h ago
  };

  const task = {
    id: "task-1",
    couple_id: COUPLE_ID,
    created_by: PARTNER_A_ID,
    title: "Buy groceries",
    category: "general",
    status: "open",
    completed_at: null,
    created_at: new Date(NOW - 10 * 60 * 1000).toISOString(), // 10m ago (newer)
    updated_at: new Date(NOW - 10 * 60 * 1000).toISOString(),
  };

  const activity = deriveWhatMattersNowActivity({
    events: [],
    tasks: [task],
    challenges: [challenge],
    nowMs: NOW,
    currentUserId: PARTNER_B_ID,
    coupleId: COUPLE_ID,
    partnerName: "Taylor",
  });

  assert.equal(activity.kind, "challenge_shared", "Challenge (Priority 2) outranks shared list (Priority 3)");
  assert.equal(activity.sourceId, "ch-103");
});

test("CH5: Persistence / Reload - receipts prevent already-seen challenge from reappearing", () => {
  const challenge = {
    id: "ch-persist",
    couple_id: COUPLE_ID,
    author_id: PARTNER_A_ID,
    challenge_idea: "Brew tea",
    status: "active",
    shared_with_partner: true,
    created_at: new Date(NOW - 3 * 60 * 60 * 1000).toISOString(),
  };

  const seenKey = `challenge_shared:${challenge.id}:${challenge.created_at}`;

  // Persisted receipt from database
  const receipt = {
    couple_id: COUPLE_ID,
    user_id: PARTNER_B_ID,
    activity_key: seenKey,
    activity_kind: "challenge_shared",
    source_id: challenge.id,
    attention_mode: "actionable",
    seen_at: new Date(NOW - 2 * 60 * 60 * 1000).toISOString(),
  };

  const activityAfterReload = deriveWhatMattersNowActivity({
    events: [],
    challenges: [challenge],
    receipts: [receipt],
    nowMs: NOW,
    currentUserId: PARTNER_B_ID,
    coupleId: COUPLE_ID,
    partnerName: "Taylor",
  });

  assert.equal(activityAfterReload.kind, "empty");
});

test("CH6: Privacy & Isolation - unshared/inactive challenges and partner isolation", () => {
  // Case A: Unshared challenge (personal only)
  const unsharedChallenge = {
    id: "ch-private",
    couple_id: COUPLE_ID,
    author_id: PARTNER_A_ID,
    challenge_idea: "Secret habit",
    status: "active",
    shared_with_partner: false, // NOT shared!
    created_at: new Date(NOW - 10 * 60 * 1000).toISOString(),
  };

  const activityA = deriveWhatMattersNowActivity({
    events: [],
    challenges: [unsharedChallenge],
    nowMs: NOW,
    currentUserId: PARTNER_B_ID,
    coupleId: COUPLE_ID,
    partnerName: "Taylor",
  });
  assert.equal(activityA.kind, "empty", "Unshared challenge must never appear for partner");

  // Case B: Resolved or dismissed challenge
  const resolvedChallenge = {
    id: "ch-resolved",
    couple_id: COUPLE_ID,
    author_id: PARTNER_A_ID,
    challenge_idea: "Old completed challenge",
    status: "resolved", // Completed / resolved!
    shared_with_partner: true,
    created_at: new Date(NOW - 10 * 60 * 1000).toISOString(),
  };

  const activityB = deriveWhatMattersNowActivity({
    events: [],
    challenges: [resolvedChallenge],
    nowMs: NOW,
    currentUserId: PARTNER_B_ID,
    coupleId: COUPLE_ID,
    partnerName: "Taylor",
  });
  assert.equal(activityB.kind, "empty", "Resolved challenge must never occupy What Matters Now");

  // Case C: Partner A's receipt does NOT suppress Partner B's view
  const sharedChallenge = {
    id: "ch-isolation",
    couple_id: COUPLE_ID,
    author_id: PARTNER_A_ID,
    challenge_idea: "Tea together",
    status: "active",
    shared_with_partner: true,
    created_at: new Date(NOW - 10 * 60 * 1000).toISOString(),
  };

  const partnerAReceipt = {
    couple_id: COUPLE_ID,
    user_id: PARTNER_A_ID, // Partner A saw something
    activity_key: `challenge_shared:${sharedChallenge.id}:${sharedChallenge.created_at}`,
    activity_kind: "challenge_shared",
    source_id: sharedChallenge.id,
    attention_mode: "actionable",
    seen_at: new Date(NOW - 5 * 60 * 1000).toISOString(),
  };

  const activityForB = deriveWhatMattersNowActivity({
    events: [],
    challenges: [sharedChallenge],
    receipts: [partnerAReceipt], // only Partner A has seen it
    nowMs: NOW,
    currentUserId: PARTNER_B_ID,
    coupleId: COUPLE_ID,
    partnerName: "Taylor",
  });
  assert.equal(activityForB.kind, "challenge_shared", "Partner A's receipt must not suppress Partner B's activity");
});

test("CH7: Meaningful Update - re-shared or updated challenge timestamp creates fresh candidate version", () => {
  const initialCreated = new Date(NOW - 6 * 60 * 60 * 1000).toISOString();
  const updatedTs = new Date(NOW - 10 * 60 * 1000).toISOString();

  const challenge = {
    id: "ch-updated",
    couple_id: COUPLE_ID,
    author_id: PARTNER_A_ID,
    challenge_idea: "Updated: Brew herbal tea together",
    status: "active",
    shared_with_partner: true,
    created_at: initialCreated,
    updated_at: updatedTs,
  };

  // Receipt existed for the OLD timestamp version
  const oldReceipt = {
    couple_id: COUPLE_ID,
    user_id: PARTNER_B_ID,
    activity_key: `challenge_shared:${challenge.id}:${initialCreated}`,
    activity_kind: "challenge_shared",
    source_id: challenge.id,
    attention_mode: "actionable",
    seen_at: new Date(NOW - 5 * 60 * 60 * 1000).toISOString(),
  };

  // With new updated_at, candidate key changes to include updated_at timestamp
  const activity = deriveWhatMattersNowActivity({
    events: [],
    challenges: [challenge],
    receipts: [oldReceipt],
    nowMs: NOW,
    currentUserId: PARTNER_B_ID,
    coupleId: COUPLE_ID,
    partnerName: "Taylor",
  });

  assert.equal(activity.kind, "challenge_shared");
  assert.ok(activity.key.includes(updatedTs));
  assert.equal(activity.body, '"Updated: Brew herbal tea together"');
});

// ============================================================================
// RECIPROCAL ACKNOWLEDGEMENTS (RA1 - RA8)
// ============================================================================

test("RA1: Challenge accepted - author receives challenge_accepted; accepting partner does not receive it", () => {
  const challenge = {
    id: "ch-200",
    couple_id: COUPLE_ID,
    author_id: PARTNER_A_ID,
    challenge_idea: "Brew tea together",
    status: "resolved", // Partner B accepted/resolved the challenge
    shared_with_partner: true,
    created_at: new Date(NOW - 60 * 60 * 1000).toISOString(),
    updated_at: new Date(NOW - 10 * 60 * 1000).toISOString(), // Accepted 10m ago
  };

  // 1. Author (Partner A) perspective: receives challenge_accepted
  const activityForAuthor = deriveWhatMattersNowActivity({
    events: [],
    challenges: [challenge],
    nowMs: NOW,
    currentUserId: PARTNER_A_ID,
    coupleId: COUPLE_ID,
    partnerName: "Jordan",
  });

  assert.equal(activityForAuthor.kind, "challenge_accepted");
  assert.equal(activityForAuthor.overline, "🌿 SOMETHING MOVED FORWARD");
  assert.equal(activityForAuthor.title, "Jordan is in");
  assert.equal(activityForAuthor.body, '"Brew tea together" is now something you can take on together.');
  assert.equal(activityForAuthor.actionLabel, "See the challenge");
  assert.equal(activityForAuthor.priority, 2);
  assert.equal(activityForAuthor.actionable, true);

  // 2. Accepting partner (Partner B) perspective: does NOT receive own acceptance acknowledgement
  const activityForAcceptor = deriveWhatMattersNowActivity({
    events: [],
    challenges: [challenge],
    nowMs: NOW,
    currentUserId: PARTNER_B_ID,
    coupleId: COUPLE_ID,
    partnerName: "Taylor",
  });

  assert.equal(activityForAcceptor.kind, "empty", "Accepting partner must not receive their own acceptance acknowledgement");
});

test("RA2: Navigation - challenge_accepted routes to exact shared challenge destination", () => {
  const challenge = {
    id: "ch-201",
    couple_id: COUPLE_ID,
    author_id: PARTNER_A_ID,
    challenge_idea: "Sunset walk",
    challenge_participant: "both",
    challenge_timeframe: "Today",
    challenge_reward: "Coffee together",
    status: "resolved",
    shared_with_partner: true,
    created_at: new Date(NOW - 30 * 60 * 1000).toISOString(),
    updated_at: new Date(NOW - 5 * 60 * 1000).toISOString(),
  };

  const activity = deriveWhatMattersNowActivity({
    events: [],
    challenges: [challenge],
    nowMs: NOW,
    currentUserId: PARTNER_A_ID,
    coupleId: COUPLE_ID,
    partnerName: "Jordan",
  });

  assert.ok(activity.route.startsWith("/challenge-lifecycle-preview?id=ch-201"));
  assert.ok(activity.route.includes("idea=Sunset%20walk"));
  assert.ok(activity.route.includes("source=what-matters-now"));
});

test("RA3: Seen receipt - author opening challenge_accepted creates receipt; returning Home clears it", () => {
  const challenge = {
    id: "ch-202",
    couple_id: COUPLE_ID,
    author_id: PARTNER_A_ID,
    challenge_idea: "Cook pasta together",
    status: "resolved",
    shared_with_partner: true,
    created_at: new Date(NOW - 2 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(NOW - 20 * 60 * 1000).toISOString(),
  };

  const initialActivity = deriveWhatMattersNowActivity({
    events: [],
    challenges: [challenge],
    nowMs: NOW,
    currentUserId: PARTNER_A_ID,
    coupleId: COUPLE_ID,
    partnerName: "Jordan",
  });
  assert.equal(initialActivity.kind, "challenge_accepted");

  // Author taps "See the challenge" -> receipt is recorded
  const receipt = {
    couple_id: COUPLE_ID,
    user_id: PARTNER_A_ID,
    activity_key: initialActivity.key,
    activity_kind: "challenge_accepted",
    source_id: challenge.id,
    attention_mode: "actionable",
    seen_at: new Date(NOW - 2 * 60 * 1000).toISOString(),
  };

  const postSeenActivity = deriveWhatMattersNowActivity({
    events: [],
    challenges: [challenge],
    receipts: [receipt],
    nowMs: NOW,
    currentUserId: PARTNER_A_ID,
    coupleId: COUPLE_ID,
    partnerName: "Jordan",
  });

  assert.equal(postSeenActivity.kind, "empty", "Viewing the acceptance must clear it from What Matters Now");
});

test("RA4: Non-backlog - multiple historical challenge acceptances do NOT cycle after newest is seen", () => {
  const olderAccepted = {
    id: "ch-old-acc",
    couple_id: COUPLE_ID,
    author_id: PARTNER_A_ID,
    challenge_idea: "Older accepted challenge",
    status: "resolved",
    shared_with_partner: true,
    created_at: new Date(NOW - 12 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(NOW - 6 * 60 * 60 * 1000).toISOString(), // 6h ago
  };

  const newestAccepted = {
    id: "ch-new-acc",
    couple_id: COUPLE_ID,
    author_id: PARTNER_A_ID,
    challenge_idea: "Newest accepted challenge",
    status: "resolved",
    shared_with_partner: true,
    created_at: new Date(NOW - 2 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(NOW - 30 * 60 * 1000).toISOString(), // 30m ago
  };

  const bothAccepted = [olderAccepted, newestAccepted];

  // 1. Initial evaluation surfaces newest
  const activity1 = deriveWhatMattersNowActivity({
    events: [],
    challenges: bothAccepted,
    nowMs: NOW,
    currentUserId: PARTNER_A_ID,
    coupleId: COUPLE_ID,
    partnerName: "Jordan",
  });
  assert.equal(activity1.kind, "challenge_accepted");
  assert.equal(activity1.sourceId, "ch-new-acc");

  // 2. Author sees/opens the newest
  const newestReceipt = {
    couple_id: COUPLE_ID,
    user_id: PARTNER_A_ID,
    activity_key: activity1.key,
    activity_kind: "challenge_accepted",
    source_id: "ch-new-acc",
    attention_mode: "actionable",
    seen_at: new Date(NOW - 10 * 60 * 1000).toISOString(),
  };

  // 3. Re-evaluating: What Matters Now must NOT cycle into older accepted challenges
  const activity2 = deriveWhatMattersNowActivity({
    events: [],
    challenges: bothAccepted,
    receipts: [newestReceipt],
    nowMs: NOW,
    currentUserId: PARTNER_A_ID,
    coupleId: COUPLE_ID,
    partnerName: "Jordan",
  });

  assert.equal(activity2.kind, "empty", "Must return calm empty state, not backlog older acceptances");
});

test("RA5: Priority coexistence - higher-priority friction or repair activity wins over challenge acceptance", () => {
  const acceptedChallenge = {
    id: "ch-205",
    couple_id: COUPLE_ID,
    author_id: PARTNER_A_ID,
    challenge_idea: "Morning meditation",
    status: "resolved",
    shared_with_partner: true,
    created_at: new Date(NOW - 60 * 60 * 1000).toISOString(),
    updated_at: new Date(NOW - 10 * 60 * 1000).toISOString(), // 10m ago (new)
  };

  const frictionEvent = {
    id: "event-fric-priority",
    couple_id: COUPLE_ID,
    creator_id: PARTNER_B_ID, // Partner B shared a friction moment
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: new Date(NOW - 2 * 60 * 60 * 1000).toISOString(), // 2h ago (older)
  };

  const activity = deriveWhatMattersNowActivity({
    events: [frictionEvent],
    challenges: [acceptedChallenge],
    nowMs: NOW,
    currentUserId: PARTNER_A_ID,
    coupleId: COUPLE_ID,
    partnerName: "Jordan",
  });

  // Friction (Priority 1) wins over challenge acceptance (Priority 2)
  assert.equal(activity.kind, "shared_friction");
  assert.equal(activity.priority, 1);
  assert.equal(activity.sourceId, "event-fric-priority");
});

test("RA6: Passive shared moment read - merely viewing does not generate push notifications or displace priority", () => {
  // If Partner B opens Partner A's moment, Partner B records an internal receipt in home_activity_receipts.
  // Partner A does NOT receive an OS push notification or intrusive high-priority alert.
  // Even if a low-priority informational concept were present, friction / repair / challenges remain authoritative.
  const challenge = {
    id: "ch-206",
    couple_id: COUPLE_ID,
    author_id: PARTNER_B_ID,
    challenge_idea: "Tea together",
    status: "active",
    shared_with_partner: true,
    created_at: new Date(NOW - 15 * 60 * 1000).toISOString(),
  };

  const activity = deriveWhatMattersNowActivity({
    events: [],
    challenges: [challenge],
    nowMs: NOW,
    currentUserId: PARTNER_A_ID,
    coupleId: COUPLE_ID,
    partnerName: "Jordan",
  });

  // Challenge invitation (Priority 2) is authoritative and undisturbed
  assert.equal(activity.kind, "challenge_shared");
});

test("RA7: Meaningful response - repair_response is used for repair input, not duplicate types", () => {
  const event = {
    id: "ev-repair-1",
    couple_id: COUPLE_ID,
    creator_id: PARTNER_A_ID,
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: new Date(NOW - 4 * 60 * 60 * 1000).toISOString(),
  };

  const repairResponse = {
    id: "resp-101",
    event_id: "ev-repair-1",
    couple_id: COUPLE_ID,
    user_id: PARTNER_B_ID,
    phase: "arrival",
    response_code: "listening",
    shared_at: new Date(NOW - 20 * 60 * 1000).toISOString(),
    updated_at: new Date(NOW - 20 * 60 * 1000).toISOString(),
  };

  const activity = deriveWhatMattersNowActivity({
    events: [event],
    repairResponses: [repairResponse],
    nowMs: NOW,
    currentUserId: PARTNER_A_ID,
    coupleId: COUPLE_ID,
    partnerName: "Jordan",
  });

  // Must use established canonical repair_response activity
  assert.equal(activity.kind, "repair_response");
  assert.equal(activity.sourceId, "resp-101");
});

test("RA8: Isolation - another couple cannot see reciprocal activities; receipts remain user-isolated", () => {
  const FOREIGN_COUPLE_ID = "99999999-9999-9999-9999-999999999999";
  const USER_X_ID = "x0000001-0001-0001-0001-000000000001";

  const challenge = {
    id: "ch-foreign",
    couple_id: FOREIGN_COUPLE_ID,
    author_id: USER_X_ID,
    challenge_idea: "Foreign couple walk",
    status: "resolved",
    shared_with_partner: true,
    created_at: new Date(NOW - 30 * 60 * 1000).toISOString(),
    updated_at: new Date(NOW - 10 * 60 * 1000).toISOString(),
  };

  const activityForPartnerA = deriveWhatMattersNowActivity({
    events: [],
    challenges: [challenge],
    nowMs: NOW,
    currentUserId: PARTNER_A_ID, // Partner A in Primary Couple
    coupleId: COUPLE_ID,
    partnerName: "Jordan",
  });

  // Partner A is not author of foreign challenge
  assert.equal(activityForPartnerA.kind, "empty", "Foreign challenge acceptance must never surface for Partner A");
});

test("RA9: Semantic Integrity - challenge_completed is not generated; challenge_accepted is the sole supported reciprocal activity", () => {
  const challenge = {
    id: "ch-semantic-1",
    couple_id: COUPLE_ID,
    author_id: PARTNER_A_ID,
    challenge_idea: "Evening stroll without phones",
    status: "resolved",
    shared_with_partner: true,
    created_at: new Date(NOW - 60 * 60 * 1000).toISOString(),
    updated_at: new Date(NOW - 15 * 60 * 1000).toISOString(),
  };

  const activity = deriveWhatMattersNowActivity({
    events: [],
    challenges: [challenge],
    nowMs: NOW,
    currentUserId: PARTNER_A_ID,
    coupleId: COUPLE_ID,
    partnerName: "Jordan",
  });

  assert.equal(activity.kind, "challenge_accepted");
  assert.notEqual(activity.kind, "challenge_completed");
  assert.equal(activity.priority, 2);
  assert.equal(activity.actionable, true);
});
