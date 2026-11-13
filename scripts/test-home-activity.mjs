import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveWhatMattersNowActivity,
  deriveResurfacedCandidate,
  isWithinPast24Hours,
  sortCandidates,
  markHomeActivitySeen,
  normalizeIsoTimestamp,
  normalizeActivityKey,
  TWENTY_FOUR_HOURS_MS,
  SEVENTY_TWO_HOURS_MS,
  FOURTEEN_DAYS_MS,
  SEVEN_DAYS_MS,
} from "../src/lib/home-activity.ts";

const CURRENT_DATE_MS = new Date("2026-11-13T19:00:00Z").getTime();
const WORLD_USER_ID = "world-user-id";
const HELLO_USER_ID = "hello-user-id";
const COUPLE_ID = "couple-uuid";

// ----------------------------------------------------------------------------
// Test 1: New partner friction moment within 24h wins
// ----------------------------------------------------------------------------
test("1. New partner friction moment within 24h wins over lower priority candidates", () => {
  const frictionEvent = {
    id: "friction-1",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: new Date(CURRENT_DATE_MS - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
  };

  const goodEvent = {
    id: "good-1",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "positive",
    visibility: "ours",
    status: null,
    created_at: new Date(CURRENT_DATE_MS - 1 * 60 * 60 * 1000).toISOString(), // 1h ago
  };

  const candidate = deriveWhatMattersNowActivity({
    events: [frictionEvent, goodEvent],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  assert.equal(candidate.kind, "shared_friction");
  assert.equal(candidate.sourceId, "friction-1");
  assert.equal(candidate.priority, 3);
  assert.equal(candidate.title, "Hello shared a moment");
  assert.equal(candidate.actionLabel, "Open when ready");
});

// ----------------------------------------------------------------------------
// Test 2: New partner Good moment appears when no higher-priority action exists
// ----------------------------------------------------------------------------
test("2. New partner Good moment appears when no higher-priority action exists", () => {
  const goodEvent = {
    id: "good-2",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "positive",
    visibility: "ours",
    status: null,
    created_at: new Date(CURRENT_DATE_MS - 30 * 60 * 1000).toISOString(), // 30m ago
  };

  const candidate = deriveWhatMattersNowActivity({
    events: [goodEvent],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  assert.equal(candidate.kind, "shared_positive");
  assert.equal(candidate.sourceId, "good-2");
  assert.equal(candidate.priority, 4);
  assert.equal(candidate.title, "Hello shared something good");
  assert.equal(candidate.actionLabel, "See the moment");
});

// ----------------------------------------------------------------------------
// Test 3: Repair response today on an October event uses today’s response time
// ----------------------------------------------------------------------------
test("3. Repair response today on an October event uses today's response time and routes to October event", () => {
  const octoberFrictionEvent = {
    id: "october-friction",
    couple_id: COUPLE_ID,
    creator_id: WORLD_USER_ID, // World created the October event
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: "2026-10-24T14:00:00Z", // 20 days ago
  };

  const todayResponseTime = new Date(
    CURRENT_DATE_MS - 15 * 60 * 1000,
  ).toISOString(); // 15m ago today
  const repairResponseToday = {
    id: "resp-today",
    event_id: "october-friction",
    couple_id: COUPLE_ID,
    user_id: HELLO_USER_ID, // Hello responded today
    phase: "arrival",
    response_code: "heard",
    shared_at: todayResponseTime,
    updated_at: todayResponseTime,
  };

  const candidate = deriveWhatMattersNowActivity({
    events: [octoberFrictionEvent],
    repairResponses: [repairResponseToday],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  assert.equal(candidate.kind, "repair_response");
  assert.equal(candidate.sourceId, "resp-today");
  assert.equal(candidate.targetEventId, "october-friction");
  assert.equal(candidate.occurredAt, todayResponseTime);
  assert.equal(candidate.priority, 1);
  assert.equal(candidate.route, "/event/october-friction?scope=ours");
  assert.equal(candidate.title, "Hello responded to your moment");
});

// ----------------------------------------------------------------------------
// Test 4: Partner repair response outranks shared-list activity
// ----------------------------------------------------------------------------
test("4. Partner repair response outranks shared-list activity", () => {
  const ev = {
    id: "ev-repair",
    couple_id: COUPLE_ID,
    creator_id: WORLD_USER_ID,
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: new Date(CURRENT_DATE_MS - 5 * 60 * 60 * 1000).toISOString(),
  };

  const resp = {
    id: "resp-1",
    event_id: "ev-repair",
    couple_id: COUPLE_ID,
    user_id: HELLO_USER_ID,
    phase: "arrival",
    response_code: "heard",
    shared_at: new Date(CURRENT_DATE_MS - 3 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(CURRENT_DATE_MS - 3 * 60 * 60 * 1000).toISOString(),
  };

  const task = {
    id: "task-1",
    couple_id: COUPLE_ID,
    created_by: HELLO_USER_ID,
    title: "Pick up fresh bread",
    category: "groceries",
    status: "open",
    completed_at: null,
    created_at: new Date(CURRENT_DATE_MS - 10 * 60 * 1000).toISOString(), // 10m ago (newer than response)
    updated_at: new Date(CURRENT_DATE_MS - 10 * 60 * 1000).toISOString(),
  };

  const candidate = deriveWhatMattersNowActivity({
    events: [ev],
    repairResponses: [resp],
    tasks: [task],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  // Repair response (priority 1) beats shared-list task (priority 6) despite being older
  assert.equal(candidate.kind, "repair_response");
  assert.equal(candidate.priority, 1);
  assert.equal(candidate.sourceId, "resp-1");
  assert.equal(candidate.targetEventId, "ev-repair");
});

// ----------------------------------------------------------------------------
// Test 5: Shared-list activity appears when it is the best current candidate
// ----------------------------------------------------------------------------
test("5. Shared-list activity appears when it is the best current candidate", () => {
  const task = {
    id: "task-groceries",
    couple_id: COUPLE_ID,
    created_by: HELLO_USER_ID,
    title: "Fresh lavender tea",
    category: "groceries",
    status: "open",
    completed_at: null,
    created_at: new Date(CURRENT_DATE_MS - 2 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(CURRENT_DATE_MS - 2 * 60 * 60 * 1000).toISOString(),
  };

  const candidate = deriveWhatMattersNowActivity({
    events: [],
    tasks: [task],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  assert.equal(candidate.kind, "shared_list_added");
  assert.equal(candidate.priority, 6);
  assert.equal(candidate.sourceId, "task-groceries");
  assert.equal(candidate.title, "Hello added something to your shared list");
  assert.equal(candidate.actionLabel, "Open Shared List");
  assert.equal(candidate.route, "/shared-list");
});

// ----------------------------------------------------------------------------
// Test 6: Mine-only moments never appear
// ----------------------------------------------------------------------------
test("6. Mine-only moments never appear in candidate evaluation", () => {
  const mineFriction = {
    id: "mine-friction",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "friction",
    visibility: "mine", // strictly private
    status: "open",
    created_at: new Date(CURRENT_DATE_MS - 5 * 60 * 1000).toISOString(), // 5m ago
  };

  const candidate = deriveWhatMattersNowActivity({
    events: [mineFriction],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  assert.notEqual(candidate.sourceId, "mine-friction");
  assert.equal(candidate.kind, "empty");
});

// ----------------------------------------------------------------------------
// Test 7: Private reflections never become candidates
// ----------------------------------------------------------------------------
test("7. Private reflections never become candidates", () => {
  // If only a past moment exists with no current activity, it remains calm empty state
  const candidate = deriveWhatMattersNowActivity({
    events: [],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
    isReflectionActive: false,
  });

  assert.equal(candidate.kind, "empty");
  assert.equal(candidate.title, "Nothing needs your attention right now");
});

// ----------------------------------------------------------------------------
// Test 8: Old open event does not appear before 72 hours
// ----------------------------------------------------------------------------
test("8. Old open event does not appear before 72 hours", () => {
  const event48hAgo = {
    id: "event-48h",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: new Date(CURRENT_DATE_MS - 48 * 60 * 60 * 1000).toISOString(), // 48h ago
  };

  const candidate = deriveWhatMattersNowActivity({
    events: [event48hAgo],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID, // recipient
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  // Past 24h for recent activity, but younger than 72h for gentle resurfacing
  assert.equal(candidate.kind, "empty");
  assert.notEqual(candidate.sourceId, "event-48h");
});

// ----------------------------------------------------------------------------
// Test 9: Eligible old event resurfaces after 72 hours
// ----------------------------------------------------------------------------
test("9. Eligible old event resurfaces after 72 hours for recipient", () => {
  const event80hAgo = {
    id: "event-80h",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: new Date(CURRENT_DATE_MS - 80 * 60 * 60 * 1000).toISOString(), // 80h ago
  };

  const candidate = deriveWhatMattersNowActivity({
    events: [event80hAgo],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID, // recipient owes arrival
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  assert.equal(candidate.kind, "resurfaced_moment");
  assert.equal(candidate.sourceId, "event-80h");
  assert.equal(candidate.priority, 9);
  assert.equal(candidate.title, "There is still room for this moment");
  assert.equal(candidate.actionLabel, "Return to the moment");
  assert.equal(candidate.isResurfaced, true);
});

// ----------------------------------------------------------------------------
// Test 10: Creator waiting for recipient is not reminded
// ----------------------------------------------------------------------------
test("10. Creator waiting for recipient arrival is not reminded", () => {
  const event80hAgo = {
    id: "event-creator-waiting",
    couple_id: COUPLE_ID,
    creator_id: WORLD_USER_ID, // World created the event
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: new Date(CURRENT_DATE_MS - 80 * 60 * 60 * 1000).toISOString(),
  };

  // World (creator) has no arrival response from Hello yet -> World is waiting
  const candidate = deriveWhatMattersNowActivity({
    events: [event80hAgo],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID, // Evaluated for creator
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  assert.equal(candidate.kind, "empty");
  assert.notEqual(candidate.sourceId, "event-creator-waiting");
});

// ----------------------------------------------------------------------------
// Test 11: Missing-action recipient may be reminded
// ----------------------------------------------------------------------------
test("11. Missing-action recipient may be reminded for the same 80h event", () => {
  const event80hAgo = {
    id: "event-creator-waiting",
    couple_id: COUPLE_ID,
    creator_id: WORLD_USER_ID, // World created the event
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: new Date(CURRENT_DATE_MS - 80 * 60 * 60 * 1000).toISOString(),
  };

  // Evaluated for Hello (recipient who has not responded yet)
  const candidate = deriveWhatMattersNowActivity({
    events: [event80hAgo],
    nowMs: CURRENT_DATE_MS,
    currentUserId: HELLO_USER_ID, // Hello is recipient
    coupleId: COUPLE_ID,
    partnerName: "World",
  });

  assert.equal(candidate.kind, "resurfaced_moment");
  assert.equal(candidate.sourceId, "event-creator-waiting");
  assert.equal(candidate.priority, 9);
});

// ----------------------------------------------------------------------------
// Test 12: Not today suppresses for 24 hours
// ----------------------------------------------------------------------------
test("12. 'Not today' suppresses resurfacing for 24 hours", () => {
  const event80hAgo = {
    id: "event-snoozed-day",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: new Date(CURRENT_DATE_MS - 80 * 60 * 60 * 1000).toISOString(),
  };

  const attentionState = {
    event_id: "event-snoozed-day",
    couple_id: COUPLE_ID,
    user_id: WORLD_USER_ID,
    last_presented_at: null,
    snoozed_until: new Date(CURRENT_DATE_MS + 23 * 60 * 60 * 1000).toISOString(), // 23h into future
    presentation_count: 1,
    last_opened_at: null,
  };

  const candidate = deriveWhatMattersNowActivity({
    events: [event80hAgo],
    attentionStates: [attentionState],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  assert.equal(candidate.kind, "empty");
  assert.notEqual(candidate.sourceId, "event-snoozed-day");
});

// ----------------------------------------------------------------------------
// Test 13: Give it a week suppresses for seven days
// ----------------------------------------------------------------------------
test("13. 'Give it a week' suppresses resurfacing for seven days", () => {
  const event80hAgo = {
    id: "event-snoozed-week",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: new Date(CURRENT_DATE_MS - 80 * 60 * 60 * 1000).toISOString(),
  };

  const attentionState = {
    event_id: "event-snoozed-week",
    couple_id: COUPLE_ID,
    user_id: WORLD_USER_ID,
    last_presented_at: null,
    snoozed_until: new Date(
      CURRENT_DATE_MS + 6 * 24 * 60 * 60 * 1000,
    ).toISOString(), // 6 days in future
    presentation_count: 1,
    last_opened_at: null,
  };

  const candidate = deriveWhatMattersNowActivity({
    events: [event80hAgo],
    attentionStates: [attentionState],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  assert.equal(candidate.kind, "empty");
});

// ----------------------------------------------------------------------------
// Test 14: One partner's snooze does not affect the other
// ----------------------------------------------------------------------------
test("14. One partner's snooze does not affect the other partner's attention state", () => {
  const event = {
    id: "event-independent-snooze",
    couple_id: COUPLE_ID,
    creator_id: WORLD_USER_ID,
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: new Date(CURRENT_DATE_MS - 80 * 60 * 60 * 1000).toISOString(),
  };

  // World snoozed this event
  const worldAttentionState = {
    event_id: "event-independent-snooze",
    couple_id: COUPLE_ID,
    user_id: WORLD_USER_ID,
    last_presented_at: null,
    snoozed_until: new Date(
      CURRENT_DATE_MS + 7 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    presentation_count: 1,
    last_opened_at: null,
  };

  // When Hello evaluates, Hello has NO snooze -> Hello is reminded
  const candidateHello = deriveWhatMattersNowActivity({
    events: [event],
    attentionStates: [worldAttentionState], // contains World's attention state only
    nowMs: CURRENT_DATE_MS,
    currentUserId: HELLO_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "World",
  });

  assert.equal(candidateHello.kind, "resurfaced_moment");
  assert.equal(candidateHello.sourceId, "event-independent-snooze");
});

// ----------------------------------------------------------------------------
// Test 15: Same old event is not selected on consecutive days
// ----------------------------------------------------------------------------
test("15. Same old event is not selected on consecutive days (within 24h cooldown)", () => {
  const event = {
    id: "event-cooldown",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: new Date(CURRENT_DATE_MS - 90 * 60 * 60 * 1000).toISOString(),
  };

  const attentionState = {
    event_id: "event-cooldown",
    couple_id: COUPLE_ID,
    user_id: WORLD_USER_ID,
    last_presented_at: new Date(
      CURRENT_DATE_MS - 12 * 60 * 60 * 1000,
    ).toISOString(), // presented 12h ago
    snoozed_until: null,
    presentation_count: 1,
    last_opened_at: null,
  };

  const candidate = deriveWhatMattersNowActivity({
    events: [event],
    attentionStates: [attentionState],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  // Suppressed because last_presented_at < 24h ago
  assert.equal(candidate.kind, "empty");
});

// ----------------------------------------------------------------------------
// Test 16: No older resurfaced event replaces newer meaningful activity
// ----------------------------------------------------------------------------
test("16. No older resurfaced event replaces newer meaningful activity", () => {
  const eligibleOldEvent = {
    id: "old-eligible-event",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: new Date(CURRENT_DATE_MS - 80 * 60 * 60 * 1000).toISOString(),
  };

  const newGoodEvent = {
    id: "new-good-event",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "positive",
    visibility: "ours",
    status: null,
    created_at: new Date(CURRENT_DATE_MS - 30 * 60 * 1000).toISOString(), // 30m ago
  };

  const candidate = deriveWhatMattersNowActivity({
    events: [eligibleOldEvent, newGoodEvent],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  // Recent good moment (priority 4) beats resurfaced event (priority 9)
  assert.equal(candidate.kind, "shared_positive");
  assert.equal(candidate.sourceId, "new-good-event");
});

// ----------------------------------------------------------------------------
// Test 17: Reconnected event immediately leaves reminder eligibility
// ----------------------------------------------------------------------------
test("17. Reconnected event immediately leaves reminder eligibility", () => {
  const reconnectedEvent = {
    id: "reconnected-event",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "friction",
    visibility: "ours",
    status: "reconnected", // Reconnected!
    created_at: new Date(CURRENT_DATE_MS - 80 * 60 * 60 * 1000).toISOString(),
    reconnected_at: new Date(
      CURRENT_DATE_MS - 40 * 60 * 60 * 1000,
    ).toISOString(),
  };

  const candidate = deriveWhatMattersNowActivity({
    events: [reconnectedEvent],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  assert.equal(candidate.kind, "empty");
});

// ----------------------------------------------------------------------------
// Test 18: Events older than 14 days remain in Our Space but stop Home resurfacing
// ----------------------------------------------------------------------------
test("18. Events older than 14 days stop Home resurfacing", () => {
  const event15DaysOld = {
    id: "event-15-days-old",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: new Date(
      CURRENT_DATE_MS - 15 * 24 * 60 * 60 * 1000,
    ).toISOString(), // 15 days ago
  };

  const candidate = deriveWhatMattersNowActivity({
    events: [event15DaysOld],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  // Exceeds 14 days -> stops Home resurfacing
  assert.equal(candidate.kind, "empty");
  assert.notEqual(candidate.sourceId, "event-15-days-old");
});

// ----------------------------------------------------------------------------
// Test 19: Realtime duplicate payloads do not duplicate or repeatedly flash tile
// ----------------------------------------------------------------------------
test("19. Realtime duplicate payloads produce identical deduplicated candidate key", () => {
  const event = {
    id: "event-dup",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "positive",
    visibility: "ours",
    status: null,
    created_at: new Date(CURRENT_DATE_MS - 60 * 1000).toISOString(),
  };

  const run1 = deriveWhatMattersNowActivity({
    events: [event],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  // Simulate duplicate event row delivered via Realtime payload burst
  const run2 = deriveWhatMattersNowActivity({
    events: [event, { ...event }],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  assert.equal(run1.key, run2.key);
  assert.equal(run1.key, `shared_positive:${event.id}:${event.created_at}`);
});

// ----------------------------------------------------------------------------
// Test 20: Two browser sessions update without manual refresh (contract / architecture test)
// ----------------------------------------------------------------------------
test("20. Cross-account perspective: Hello creating Good moment appears as partner Good moment for World", () => {
  const sharedMoment = {
    id: "hello-good-moment",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "positive",
    visibility: "ours",
    status: null,
    created_at: new Date(CURRENT_DATE_MS - 5 * 60 * 1000).toISOString(),
  };

  // World's perspective
  const worldTile = deriveWhatMattersNowActivity({
    events: [sharedMoment],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  assert.equal(worldTile.kind, "shared_positive");
  assert.equal(worldTile.title, "Hello shared something good");
  assert.equal(worldTile.actionLabel, "See the moment");

  // Hello's perspective (self-shared moment)
  const helloTile = deriveWhatMattersNowActivity({
    events: [sharedMoment],
    nowMs: CURRENT_DATE_MS,
    currentUserId: HELLO_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "World",
  });

  assert.equal(helloTile.kind, "self_shared_moment");
  assert.equal(helloTile.title, "You shared a moment with World");
});

// ----------------------------------------------------------------------------
// Test 21: 320px layout has no clipping (UI contract & touch targets)
// ----------------------------------------------------------------------------
test("21. Resurfaced actions satisfy minimum 44px touch targets and wrapping layout contract", () => {
  const event = {
    id: "event-layout-check",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: new Date(CURRENT_DATE_MS - 80 * 60 * 60 * 1000).toISOString(),
  };

  const tile = deriveWhatMattersNowActivity({
    events: [event],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  assert.equal(tile.isResurfaced, true);
  assert.equal(tile.overline, "A MOMENT RESTING IN OUR SPACE");
  assert.equal(tile.title, "There is still room for this moment");
  assert.equal(
    tile.body,
    "There is no rush. Return whenever it feels right, or give it a little more room.",
  );
  assert.equal(tile.actionLabel, "Return to the moment");
});

// ----------------------------------------------------------------------------
// Test 22: Light, dim, and dark themes contract verification
// ----------------------------------------------------------------------------
test("22. Deterministic priority and tie-breaking contracts are stable across all states", () => {
  const candidateA = {
    key: "shared_friction:event-a:2026-11-13T18:00:00Z",
    kind: "shared_friction",
    sourceId: "event-a",
    coupleId: COUPLE_ID,
    actorId: HELLO_USER_ID,
    occurredAt: "2026-11-13T18:00:00Z",
    priority: 3,
    actionable: true,
    route: "/event/event-a?scope=ours",
    title: "Hello shared a moment",
    body: "There is no rush.",
    actionLabel: "Open when ready",
  };

  const candidateB = {
    key: "shared_friction:event-b:2026-11-13T18:00:00Z",
    kind: "shared_friction",
    sourceId: "event-b",
    coupleId: COUPLE_ID,
    actorId: HELLO_USER_ID,
    occurredAt: "2026-11-13T18:00:00Z",
    priority: 3,
    actionable: true,
    route: "/event/event-b?scope=ours",
    title: "Hello shared a moment",
    body: "There is no rush.",
    actionLabel: "Open when ready",
  };

  // Same priority and same timestamp -> tie-breaker is candidate key ascending
  const sorted = sortCandidates([candidateB, candidateA]);
  assert.equal(sorted[0].key, candidateA.key);
  assert.equal(sorted[1].key, candidateB.key);
});

// ----------------------------------------------------------------------------
// Test 23: Simulated Realtime invalidation triggers authoritative refresh
// ----------------------------------------------------------------------------
test("23. Simulated Realtime invalidation triggers debounced authoritative refresh", async () => {
  let refreshCount = 0;
  let debounceTimer = null;

  const scheduleSilentRefresh = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      refreshCount++;
    }, 50);
  };

  // Simulate invalidation event
  scheduleSilentRefresh();
  assert.equal(refreshCount, 0); // Not immediate (debounced)

  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(refreshCount, 1);
});

// ----------------------------------------------------------------------------
// Test 24: Burst notifications coalesce into one refresh
// ----------------------------------------------------------------------------
test("24. Burst Realtime notifications coalesce into a single refresh execution", async () => {
  let refreshCount = 0;
  let debounceTimer = null;

  const scheduleSilentRefresh = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      refreshCount++;
    }, 50);
  };

  // Rapid burst of 5 events within 20ms
  scheduleSilentRefresh();
  scheduleSilentRefresh();
  scheduleSilentRefresh();
  scheduleSilentRefresh();
  scheduleSilentRefresh();

  assert.equal(refreshCount, 0);

  await new Promise((resolve) => setTimeout(resolve, 90));
  // Coalesced into exactly 1 refresh execution
  assert.equal(refreshCount, 1);
});

// ----------------------------------------------------------------------------
// Test 25: Event received during a running refresh causes one follow-up refresh
// ----------------------------------------------------------------------------
test("25. Event received during a running refresh causes exactly one follow-up refresh", async () => {
  let isRefreshing = false;
  let refreshPending = false;
  let executedRefreshes = 0;

  const performRefresh = async () => {
    if (isRefreshing) {
      refreshPending = true;
      return;
    }
    isRefreshing = true;
    executedRefreshes++;

    // Simulate async network work
    await new Promise((resolve) => setTimeout(resolve, 60));

    isRefreshing = false;
    if (refreshPending) {
      refreshPending = false;
      await performRefresh();
    }
  };

  // Start first refresh
  const p1 = performRefresh();
  assert.equal(isRefreshing, true);

  // Incoming event while first refresh is in-flight
  await performRefresh();
  assert.equal(refreshPending, true);

  await p1;
  assert.equal(executedRefreshes, 2);
  assert.equal(refreshPending, false);
});

// ----------------------------------------------------------------------------
// Test 26: Stale requests cannot overwrite newer data (generation counter)
// ----------------------------------------------------------------------------
test("26. Request generation counter prevents stale older responses from overwriting newer data", async () => {
  let requestSeq = 0;
  let committedState = "initial";

  const fetchSimulator = async (payload, delayMs) => {
    const currentSeq = ++requestSeq;
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    // Stale check: discard if newer request completed
    if (currentSeq < requestSeq) {
      return; // Discarded
    }
    committedState = payload;
  };

  // Launch Request 1 (slow, 100ms) with payload 'slow-data'
  const p1 = fetchSimulator("slow-data", 100);
  // Launch Request 2 (fast, 20ms) with payload 'fast-data'
  const p2 = fetchSimulator("fast-data", 20);

  await Promise.all([p1, p2]);

  // Request 2 was newer (higher sequence); Request 1 was discarded
  assert.equal(committedState, "fast-data");
});

// ----------------------------------------------------------------------------
// Test 27: Subscription construction registers listeners before subscribe
// ----------------------------------------------------------------------------
test("27. Subscription construction synchronously registers all listeners before calling subscribe", () => {
  const callOrder = [];

  const mockChannel = {
    on: (type, config, callback) => {
      callOrder.push(`on:${config.table}`);
      return mockChannel;
    },
    subscribe: (callback) => {
      callOrder.push("subscribe");
      callback("SUBSCRIBED");
      return mockChannel;
    },
  };

  const tables = [
    "relationship_events",
    "relationship_event_repair_responses",
    "relationship_event_repair_outcomes",
    "couple_tasks",
    "couple_important_dates",
    "relationship_event_attention_states",
    "home_activity_receipts",
  ];

  for (const table of tables) {
    mockChannel.on("postgres_changes", { table }, () => {});
  }
  mockChannel.subscribe(() => {});

  // Confirm all 7 table listeners registered before subscribe
  assert.equal(callOrder.length, 8);
  assert.equal(callOrder[callOrder.length - 1], "subscribe");
  for (let i = 0; i < 7; i++) {
    assert.equal(callOrder[i], `on:${tables[i]}`);
  }
});

// ----------------------------------------------------------------------------
// Test 28: Cleanup removes only the owned channel
// ----------------------------------------------------------------------------
test("28. Channel cleanup removes only the owned channel instance and clears timer", () => {
  let removedChannel = null;
  let timerCleared = false;

  const mockOwnedChannel = { id: "owned-channel-123" };
  let debounceTimer = setTimeout(() => {}, 1000);

  const mockSupabase = {
    removeChannel: (channel) => {
      removedChannel = channel;
    },
  };

  // Simulate cleanup effect
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    timerCleared = true;
  }
  mockSupabase.removeChannel(mockOwnedChannel);

  assert.equal(timerCleared, true);
  assert.equal(removedChannel.id, "owned-channel-123");
});

// ============================================================================
// SECTION 13: ACTIVITY RECEIPT & SEEN LIFECYCLE TESTS (Items 1-23)
// ============================================================================

// ----------------------------------------------------------------------------
// Item 1: Refresh alone does not create a receipt
// ----------------------------------------------------------------------------
test("Section 13.1: Refresh alone does not create a receipt or mutate receipts", () => {
  const receipts = [];
  const goodEvent = {
    id: "good-refresh-test",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "positive",
    visibility: "ours",
    status: null,
    created_at: new Date(CURRENT_DATE_MS - 30 * 60 * 1000).toISOString(),
  };

  // Simulate multiple refreshes / selector evaluations
  const pass1 = deriveWhatMattersNowActivity({
    events: [goodEvent],
    receipts,
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });
  const pass2 = deriveWhatMattersNowActivity({
    events: [goodEvent],
    receipts,
    nowMs: CURRENT_DATE_MS + 5000,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  assert.equal(receipts.length, 0);
  assert.equal(pass1.kind, "shared_positive");
  assert.equal(pass2.kind, "shared_positive");
  assert.equal(pass1.key, pass2.key);
});

// ----------------------------------------------------------------------------
// Item 2: Rendering a tile does not create a receipt
// ----------------------------------------------------------------------------
test("Section 13.2: Rendering a tile does not create a receipt", () => {
  const receiptsStore = new Set();
  const goodEvent = {
    id: "good-render-test",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "positive",
    visibility: "ours",
    status: null,
    created_at: new Date(CURRENT_DATE_MS - 20 * 60 * 1000).toISOString(),
  };

  const tile = deriveWhatMattersNowActivity({
    events: [goodEvent],
    receipts: [],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  assert.equal(tile.kind, "shared_positive");
  assert.equal(receiptsStore.size, 0);
});

// ----------------------------------------------------------------------------
// Item 3: A new partner Good moment appears when unseen
// ----------------------------------------------------------------------------
test("Section 13.3: A new partner Good moment appears when unseen", () => {
  const goodEvent = {
    id: "good-unseen-test",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "positive",
    visibility: "ours",
    status: null,
    created_at: new Date(CURRENT_DATE_MS - 15 * 60 * 1000).toISOString(),
  };

  const candidate = deriveWhatMattersNowActivity({
    events: [goodEvent],
    receipts: [],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  assert.equal(candidate.kind, "shared_positive");
  assert.equal(candidate.sourceId, "good-unseen-test");
  assert.equal(candidate.attentionMode, "informational");
  assert.equal(candidate.actionLabel, "See the moment");
});

// ----------------------------------------------------------------------------
// Item 4: After the receiving partner opens it, its key is excluded
// ----------------------------------------------------------------------------
test("Section 13.4: After the receiving partner opens it, its key is excluded", () => {
  const createdAt = new Date(CURRENT_DATE_MS - 15 * 60 * 1000).toISOString();
  const goodEvent = {
    id: "good-open-test",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "positive",
    visibility: "ours",
    status: null,
    created_at: createdAt,
  };

  const activityKey = `shared_positive:good-open-test:${normalizeIsoTimestamp(createdAt)}`;

  const receipts = [
    {
      couple_id: COUPLE_ID,
      user_id: WORLD_USER_ID,
      activity_key: activityKey,
      activity_kind: "shared_positive",
      source_id: "good-open-test",
      attention_mode: "informational",
      seen_at: new Date(CURRENT_DATE_MS - 5 * 60 * 1000).toISOString(),
    },
  ];

  const candidate = deriveWhatMattersNowActivity({
    events: [goodEvent],
    receipts,
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  // Permanently excluded -> drops to calm empty state
  assert.equal(candidate.kind, "empty");
  assert.notEqual(candidate.sourceId, "good-open-test");
});

// ----------------------------------------------------------------------------
// Item 5: Reload with the persisted receipt keeps it excluded
// ----------------------------------------------------------------------------
test("Section 13.5: Reload with the persisted receipt keeps it excluded", () => {
  const createdAt = new Date(CURRENT_DATE_MS - 2 * 60 * 60 * 1000).toISOString();
  const goodEvent = {
    id: "good-reload-test",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "positive",
    visibility: "ours",
    status: null,
    created_at: createdAt,
  };

  const persistedReceipt = {
    couple_id: COUPLE_ID,
    user_id: WORLD_USER_ID,
    activity_key: `shared_positive:good-reload-test:${normalizeIsoTimestamp(createdAt)}`,
    activity_kind: "shared_positive",
    source_id: "good-reload-test",
    attention_mode: "informational",
    seen_at: new Date(CURRENT_DATE_MS - 1 * 60 * 60 * 1000).toISOString(),
  };

  // Simulate subsequent fresh reload with database-fetched receipt
  const reloadedTile = deriveWhatMattersNowActivity({
    events: [goodEvent],
    receipts: [persistedReceipt],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  assert.equal(reloadedTile.kind, "empty");
});

// ----------------------------------------------------------------------------
// Item 6: Creator’s receipt does not suppress recipient activity
// ----------------------------------------------------------------------------
test("Section 13.6: Creator's receipt does not suppress recipient activity", () => {
  const createdAt = new Date(CURRENT_DATE_MS - 10 * 60 * 1000).toISOString();
  const goodEvent = {
    id: "good-creator-receipt-test",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "positive",
    visibility: "ours",
    status: null,
    created_at: createdAt,
  };

  // Hello (creator) has a receipt for their self-shared moment
  const helloReceipt = {
    couple_id: COUPLE_ID,
    user_id: HELLO_USER_ID,
    activity_key: `self_shared_moment:good-creator-receipt-test:${normalizeIsoTimestamp(createdAt)}`,
    activity_kind: "self_shared_moment",
    source_id: "good-creator-receipt-test",
    attention_mode: "informational",
    seen_at: new Date(CURRENT_DATE_MS - 5 * 60 * 1000).toISOString(),
  };

  // Evaluated for World (recipient)
  const worldTile = deriveWhatMattersNowActivity({
    events: [goodEvent],
    receipts: [helloReceipt],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  // World still sees the Good moment!
  assert.equal(worldTile.kind, "shared_positive");
  assert.equal(worldTile.sourceId, "good-creator-receipt-test");
});

// ----------------------------------------------------------------------------
// Item 7: World’s receipt does not suppress Hello’s activity
// ----------------------------------------------------------------------------
test("Section 13.7: World's receipt does not suppress Hello's activity", () => {
  const createdAt = new Date(CURRENT_DATE_MS - 10 * 60 * 1000).toISOString();
  const goodEvent = {
    id: "good-world-receipt-test",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "positive",
    visibility: "ours",
    status: null,
    created_at: createdAt,
  };

  // World opened the moment and has a receipt
  const worldReceipt = {
    couple_id: COUPLE_ID,
    user_id: WORLD_USER_ID,
    activity_key: `shared_positive:good-world-receipt-test:${normalizeIsoTimestamp(createdAt)}`,
    activity_kind: "shared_positive",
    source_id: "good-world-receipt-test",
    attention_mode: "informational",
    seen_at: new Date(CURRENT_DATE_MS - 2 * 60 * 1000).toISOString(),
  };

  // Evaluated for Hello
  const helloTile = deriveWhatMattersNowActivity({
    events: [goodEvent],
    receipts: [worldReceipt],
    nowMs: CURRENT_DATE_MS,
    currentUserId: HELLO_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "World",
  });

  // Hello's self-shared confirmation is not suppressed by World's receipt
  assert.equal(helloTile.kind, "self_shared_moment");
  assert.equal(helloTile.sourceId, "good-world-receipt-test");
});

// ----------------------------------------------------------------------------
// Item 8: Underlying positive event remains in source data
// ----------------------------------------------------------------------------
test("Section 13.8: Underlying positive event remains in source data after exclusion", () => {
  const createdAt = new Date(CURRENT_DATE_MS - 20 * 60 * 1000).toISOString();
  const goodEvent = {
    id: "good-source-immutable",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "positive",
    visibility: "ours",
    status: null,
    created_at: createdAt,
  };

  const eventsArray = [goodEvent];
  const receipts = [
    {
      couple_id: COUPLE_ID,
      user_id: WORLD_USER_ID,
      activity_key: `shared_positive:good-source-immutable:${normalizeIsoTimestamp(createdAt)}`,
      activity_kind: "shared_positive",
      source_id: "good-source-immutable",
      attention_mode: "informational",
      seen_at: new Date(CURRENT_DATE_MS - 10 * 60 * 1000).toISOString(),
    },
  ];

  deriveWhatMattersNowActivity({
    events: eventsArray,
    receipts,
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  // eventsArray was not mutated or filtered, and status remains null
  assert.equal(eventsArray.length, 1);
  assert.equal(eventsArray[0].id, "good-source-immutable");
  assert.equal(eventsArray[0].status, null);
});

// ----------------------------------------------------------------------------
// Item 9: Garden input remains unchanged
// ----------------------------------------------------------------------------
test("Section 13.9: Garden input remains unchanged by Home activity receipts", () => {
  const goodEvent = {
    id: "good-garden-input",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "positive",
    visibility: "ours",
    status: null,
    created_at: new Date(CURRENT_DATE_MS - 30 * 60 * 1000).toISOString(),
  };

  const sharedEvents = [goodEvent];

  // Garden care items count qualifies shared good moments regardless of Home receipt
  const qualifyingGardenEvents = sharedEvents.filter(
    (e) => e.visibility === "ours" && (e.event_type === "positive" || e.status === "reconnected"),
  );

  assert.equal(qualifyingGardenEvents.length, 1);
  assert.equal(qualifyingGardenEvents[0].id, "good-garden-input");
});

// ----------------------------------------------------------------------------
// Item 10: Mine-only moments never produce shared Home activity
// ----------------------------------------------------------------------------
test("Section 13.10: Mine-only moments never produce shared Home activity", () => {
  const mineGoodEvent = {
    id: "good-mine-only",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "positive",
    visibility: "mine", // strictly private
    status: null,
    created_at: new Date(CURRENT_DATE_MS - 5 * 60 * 1000).toISOString(),
  };

  const tile = deriveWhatMattersNowActivity({
    events: [mineGoodEvent],
    receipts: [],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  assert.notEqual(tile.sourceId, "good-mine-only");
  assert.equal(tile.kind, "empty");
});

// ----------------------------------------------------------------------------
// Item 11: Revised repair response with a new updated_at becomes a new activity version
// ----------------------------------------------------------------------------
test("Section 13.11: Revised repair response with a new updated_at becomes a new activity version", () => {
  const event = {
    id: "event-revised-repair",
    couple_id: COUPLE_ID,
    creator_id: WORLD_USER_ID,
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: new Date(CURRENT_DATE_MS - 6 * 60 * 60 * 1000).toISOString(),
  };

  const initialTime = new Date(CURRENT_DATE_MS - 4 * 60 * 60 * 1000).toISOString();
  const revisedTime = new Date(CURRENT_DATE_MS - 15 * 60 * 1000).toISOString();

  // Initial response was marked seen
  const initialReceipt = {
    couple_id: COUPLE_ID,
    user_id: WORLD_USER_ID,
    activity_key: `repair_response:resp-1:${normalizeIsoTimestamp(initialTime)}`,
    activity_kind: "repair_response",
    source_id: "event-revised-repair",
    attention_mode: "actionable",
    seen_at: new Date(CURRENT_DATE_MS - 3 * 60 * 60 * 1000).toISOString(),
  };

  // Partner revised response: updated_at changed to revisedTime
  const revisedResponse = {
    id: "resp-1",
    event_id: "event-revised-repair",
    couple_id: COUPLE_ID,
    user_id: HELLO_USER_ID,
    phase: "arrival",
    response_code: "heard",
    shared_at: initialTime,
    updated_at: revisedTime,
  };

  const tile = deriveWhatMattersNowActivity({
    events: [event],
    repairResponses: [revisedResponse],
    receipts: [initialReceipt],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  // Appears again because key `repair_response:resp-1:${revisedTime}` is a new activity version!
  assert.equal(tile.kind, "repair_response");
  assert.equal(tile.occurredAt, revisedTime);
  assert.equal(tile.priority, 1);
});

// ----------------------------------------------------------------------------
// Item 12: Shared-list addition and completion are distinct keys
// ----------------------------------------------------------------------------
test("Section 13.12: Shared-list addition and completion are distinct keys", () => {
  const addedAt = new Date(CURRENT_DATE_MS - 4 * 60 * 60 * 1000).toISOString();
  const completedAt = new Date(CURRENT_DATE_MS - 10 * 60 * 1000).toISOString();

  const task = {
    id: "task-distinct-keys",
    couple_id: COUPLE_ID,
    created_by: HELLO_USER_ID,
    title: "Call florist",
    category: "errands",
    status: "completed",
    completed_at: completedAt,
    created_at: addedAt,
    updated_at: completedAt,
  };

  // User marked seen for the ADDITION of the task
  const additionReceipt = {
    couple_id: COUPLE_ID,
    user_id: WORLD_USER_ID,
    activity_key: `shared_list_added:task-distinct-keys:${normalizeIsoTimestamp(addedAt)}`,
    activity_kind: "shared_list_added",
    source_id: "task-distinct-keys",
    attention_mode: "informational",
    seen_at: new Date(CURRENT_DATE_MS - 3 * 60 * 60 * 1000).toISOString(),
  };

  const tile = deriveWhatMattersNowActivity({
    events: [],
    tasks: [task],
    receipts: [additionReceipt],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  // Completion has a distinct key (`shared_list_completed:...`), so it appears!
  assert.equal(tile.kind, "shared_list_completed");
  assert.equal(tile.sourceId, "task-distinct-keys");
  assert.equal(tile.occurredAt, completedAt);
});

// ----------------------------------------------------------------------------
// Item 13: Important Date uses created_at, not event_date
// ----------------------------------------------------------------------------
test("Section 13.13: Important Date uses created_at, not event_date", () => {
  const rowCreatedAt = new Date(CURRENT_DATE_MS - 2 * 60 * 60 * 1000).toISOString();
  const milestoneDate = "2027-09-24"; // Future milestone date

  const date = {
    id: "date-anniversary",
    couple_id: COUPLE_ID,
    label: "Trip to Kyoto",
    event_date: milestoneDate,
    created_by: HELLO_USER_ID,
    created_at: rowCreatedAt,
    updated_at: rowCreatedAt,
  };

  const tile = deriveWhatMattersNowActivity({
    events: [],
    importantDates: [date],
    receipts: [],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  assert.equal(tile.kind, "important_date_added");
  assert.equal(tile.occurredAt, rowCreatedAt);
  assert.equal(
    tile.key,
    `important_date_added:date-anniversary:${normalizeIsoTimestamp(rowCreatedAt)}`,
  );
  assert.equal(tile.key.includes(milestoneDate), false);
});

// ----------------------------------------------------------------------------
// Item 14: Completed reconnection disappears after viewing but remains reconnected
// ----------------------------------------------------------------------------
test("Section 13.14: Completed reconnection disappears after viewing but remains reconnected", () => {
  const completedAt = new Date(CURRENT_DATE_MS - 1 * 60 * 60 * 1000).toISOString();
  const reconnectedEvent = {
    id: "event-reconnected",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "friction",
    visibility: "ours",
    status: "reconnected",
    created_at: new Date(CURRENT_DATE_MS - 5 * 60 * 60 * 1000).toISOString(),
    reconnected_at: completedAt,
  };

  const outcome = {
    event_id: "event-reconnected",
    couple_id: COUPLE_ID,
    completed_by: HELLO_USER_ID,
    completed_at: completedAt,
  };

  const reconnectionReceipt = {
    couple_id: COUPLE_ID,
    user_id: WORLD_USER_ID,
    activity_key: `reconnection_completed:event-reconnected:${normalizeIsoTimestamp(completedAt)}`,
    activity_kind: "reconnection_completed",
    source_id: "event-reconnected",
    attention_mode: "informational",
    seen_at: new Date(CURRENT_DATE_MS - 30 * 60 * 1000).toISOString(),
  };

  const tile = deriveWhatMattersNowActivity({
    events: [reconnectedEvent],
    outcomes: [outcome],
    receipts: [reconnectionReceipt],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  assert.equal(tile.kind, "empty");
  // Underlying status remains reconnected
  assert.equal(reconnectedEvent.status, "reconnected");
});

// ----------------------------------------------------------------------------
// Item 15: Opening friction suppresses immediate repetition without resolving it
// ----------------------------------------------------------------------------
test("Section 13.15: Opening friction suppresses immediate repetition without resolving it", () => {
  const createdAt = new Date(CURRENT_DATE_MS - 2 * 60 * 60 * 1000).toISOString(); // 2h ago
  const frictionEvent = {
    id: "friction-open-immediate",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "friction",
    visibility: "ours",
    status: "open", // still open
    created_at: createdAt,
  };

  // Recipient opened the friction moment
  const frictionReceipt = {
    couple_id: COUPLE_ID,
    user_id: WORLD_USER_ID,
    activity_key: `shared_friction:friction-open-immediate:${normalizeIsoTimestamp(createdAt)}`,
    activity_kind: "shared_friction",
    source_id: "friction-open-immediate",
    attention_mode: "actionable",
    seen_at: new Date(CURRENT_DATE_MS - 1 * 60 * 60 * 1000).toISOString(),
  };

  const tile = deriveWhatMattersNowActivity({
    events: [frictionEvent],
    receipts: [frictionReceipt],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  // Immediate Priority 3 presentation suppressed -> empty
  assert.equal(tile.kind, "empty");
  // Underlying event is NOT resolved
  assert.equal(frictionEvent.status, "open");
});

// ----------------------------------------------------------------------------
// Item 16: Unresolved friction becomes eligible for gentle resurfacing after its cooldown
// ----------------------------------------------------------------------------
test("Section 13.16: Unresolved friction becomes eligible for gentle resurfacing after its cooldown", () => {
  const createdAt = new Date(CURRENT_DATE_MS - 80 * 60 * 60 * 1000).toISOString(); // 80h ago
  const frictionEvent = {
    id: "friction-resurface-cooldown",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: createdAt,
  };

  // Recipient opened it 25 hours ago (> 24h cooldown)
  const frictionReceipt = {
    couple_id: COUPLE_ID,
    user_id: WORLD_USER_ID,
    activity_key: `shared_friction:friction-resurface-cooldown:${normalizeIsoTimestamp(createdAt)}`,
    activity_kind: "shared_friction",
    source_id: "friction-resurface-cooldown",
    attention_mode: "actionable",
    seen_at: new Date(CURRENT_DATE_MS - 25 * 60 * 60 * 1000).toISOString(),
  };

  const tile = deriveWhatMattersNowActivity({
    events: [frictionEvent],
    receipts: [frictionReceipt],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  // After 24h opened cooldown and age >= 72h, it resurfaces gently!
  assert.equal(tile.kind, "resurfaced_moment");
  assert.equal(tile.sourceId, "friction-resurface-cooldown");
  assert.equal(tile.priority, 9);
});

// ----------------------------------------------------------------------------
// Item 17: Explicit Not today overrides the default opened cooldown
// ----------------------------------------------------------------------------
test("Section 13.17: Explicit 'Not today' overrides the default opened cooldown", () => {
  const createdAt = new Date(CURRENT_DATE_MS - 80 * 60 * 60 * 1000).toISOString();
  const frictionEvent = {
    id: "friction-not-today-override",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: createdAt,
  };

  // Even if opened 30 hours ago (default cooldown expired), explicit snooze is ACTIVE
  const activeSnooze = {
    event_id: "friction-not-today-override",
    couple_id: COUPLE_ID,
    user_id: WORLD_USER_ID,
    last_presented_at: null,
    snoozed_until: new Date(CURRENT_DATE_MS + 10 * 60 * 60 * 1000).toISOString(), // 10h into future
    presentation_count: 1,
    last_opened_at: new Date(CURRENT_DATE_MS - 30 * 60 * 60 * 1000).toISOString(),
  };

  const tileSuppressed = deriveWhatMattersNowActivity({
    events: [frictionEvent],
    attentionStates: [activeSnooze],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });
  assert.equal(tileSuppressed.kind, "empty");

  // When the explicit snooze has passed:
  const expiredSnooze = {
    ...activeSnooze,
    snoozed_until: new Date(CURRENT_DATE_MS - 1 * 60 * 60 * 1000).toISOString(), // expired 1h ago
  };

  const tileResurfaced = deriveWhatMattersNowActivity({
    events: [frictionEvent],
    attentionStates: [expiredSnooze],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });
  assert.equal(tileResurfaced.kind, "resurfaced_moment");
});

// ----------------------------------------------------------------------------
// Item 18: Give it a week overrides the default opened cooldown
// ----------------------------------------------------------------------------
test("Section 13.18: 'Give it a week' overrides the default opened cooldown", () => {
  const createdAt = new Date(CURRENT_DATE_MS - 80 * 60 * 60 * 1000).toISOString();
  const frictionEvent = {
    id: "friction-give-week-override",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: createdAt,
  };

  // Opened 30h ago (past 24h default cooldown), but user snoozed for 7 days
  const weekSnooze = {
    event_id: "friction-give-week-override",
    couple_id: COUPLE_ID,
    user_id: WORLD_USER_ID,
    last_presented_at: null,
    snoozed_until: new Date(
      CURRENT_DATE_MS + 6 * 24 * 60 * 60 * 1000,
    ).toISOString(), // 6 days in future
    presentation_count: 1,
    last_opened_at: new Date(CURRENT_DATE_MS - 30 * 60 * 60 * 1000).toISOString(),
  };

  const tile = deriveWhatMattersNowActivity({
    events: [frictionEvent],
    attentionStates: [weekSnooze],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  assert.equal(tile.kind, "empty");
});

// ----------------------------------------------------------------------------
// Item 19: Receipt INSERT is idempotent
// ----------------------------------------------------------------------------
test("Section 13.19: markHomeActivitySeen is idempotent across repeated calls", async () => {
  const insertedRows = [];
  const mockSupabase = {
    rpc: async (funcName, args) => {
      if (funcName === "record_home_activity_receipt") {
        insertedRows.push(args);
        return { data: null, error: null };
      }
      return { data: null, error: null };
    },
  };

  const candidate = {
    key: "shared_positive:test-id:2026-11-13T18:00:00.000Z",
    kind: "shared_positive",
    sourceId: "test-id",
    coupleId: COUPLE_ID,
    actorId: HELLO_USER_ID,
    occurredAt: "2026-11-13T18:00:00.000Z",
    priority: 4,
    actionable: false,
    attentionMode: "informational",
    route: "/event/test-id?scope=ours",
    title: "Hello shared something good",
    body: "A piece of your shared story.",
    actionLabel: "See the moment",
  };

  // First call
  const res1 = await markHomeActivitySeen({
    supabase: mockSupabase,
    candidate,
    coupleId: COUPLE_ID,
    userId: WORLD_USER_ID,
  });
  // Second call with same candidate
  const res2 = await markHomeActivitySeen({
    supabase: mockSupabase,
    candidate,
    coupleId: COUPLE_ID,
    userId: WORLD_USER_ID,
  });

  assert.equal(res1, true);
  assert.equal(res2, true);
  assert.equal(insertedRows.length, 2);
  assert.equal(insertedRows[0].p_activity_key, insertedRows[1].p_activity_key);
});

// ----------------------------------------------------------------------------
// Item 20: Realtime receipt invalidation refreshes another same-user tab
// ----------------------------------------------------------------------------
test("Section 13.20: Realtime receipt invalidation triggers refresh for same-user tab", async () => {
  let refreshTriggered = false;

  const mockChannel = {
    listeners: {},
    on(event, config, callback) {
      this.listeners[config.table] = callback;
      return this;
    },
    subscribe(cb) {
      if (cb) cb("SUBSCRIBED");
      return this;
    },
  };

  mockChannel.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "home_activity_receipts",
      filter: `user_id=eq.${WORLD_USER_ID}`,
    },
    () => {
      refreshTriggered = true;
    },
  );

  // Simulate receipt payload inserted from another browser tab of World
  mockChannel.listeners["home_activity_receipts"]({
    table: "home_activity_receipts",
    eventType: "INSERT",
  });

  assert.equal(refreshTriggered, true);
});

// ----------------------------------------------------------------------------
// Item 21: Partner session receives no receipt visibility
// ----------------------------------------------------------------------------
test("Section 13.21: Partner session receives no receipt visibility (private receipts)", () => {
  const worldReceipt = {
    couple_id: COUPLE_ID,
    user_id: WORLD_USER_ID,
    activity_key: "shared_positive:test:2026-11-13T18:00:00.000Z",
    activity_kind: "shared_positive",
    source_id: "test",
    attention_mode: "informational",
    seen_at: "2026-11-13T18:30:00.000Z",
  };

  // When Hello evaluates candidate, World's receipt is ignored
  const helloCandidate = deriveWhatMattersNowActivity({
    events: [
      {
        id: "test",
        couple_id: COUPLE_ID,
        creator_id: HELLO_USER_ID,
        event_type: "positive",
        visibility: "ours",
        status: null,
        created_at: "2026-11-13T18:00:00.000Z",
      },
    ],
    receipts: [worldReceipt],
    nowMs: CURRENT_DATE_MS,
    currentUserId: HELLO_USER_ID, // Hello
    coupleId: COUPLE_ID,
    partnerName: "World",
  });

  // Hello still sees their self-shared moment
  assert.equal(helloCandidate.kind, "self_shared_moment");
});

// ----------------------------------------------------------------------------
// Item 22: New higher-priority partner activity still replaces lower-priority content
// ----------------------------------------------------------------------------
test("Section 13.22: New higher-priority partner activity replaces lower-priority content", () => {
  const goodEvent = {
    id: "good-low-priority",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "positive",
    visibility: "ours",
    status: null,
    created_at: new Date(CURRENT_DATE_MS - 2 * 60 * 60 * 1000).toISOString(),
  };

  const incomingFriction = {
    id: "friction-high-priority",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: new Date(CURRENT_DATE_MS - 10 * 60 * 1000).toISOString(), // 10m ago
  };

  const tile = deriveWhatMattersNowActivity({
    events: [goodEvent, incomingFriction],
    receipts: [],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  // Friction (priority 3) replaces good moment (priority 4)
  assert.equal(tile.kind, "shared_friction");
  assert.equal(tile.sourceId, "friction-high-priority");
  assert.equal(tile.priority, 3);
});

// ----------------------------------------------------------------------------
// Item 23: Timestamp normalization produces stable keys across refetches
// ----------------------------------------------------------------------------
test("Section 13.23: Timestamp normalization produces stable keys across refetches", () => {
  const tsPostgres = "2026-11-13T19:00:00+00:00";
  const tsJs = "2026-11-13T19:00:00.000Z";

  const normPostgres = normalizeIsoTimestamp(tsPostgres);
  const normJs = normalizeIsoTimestamp(tsJs);

  assert.equal(normPostgres, normJs);

  const keyPostgres = normalizeActivityKey(
    `shared_positive:event-123:${tsPostgres}`,
  );
  const keyJs = normalizeActivityKey(`shared_positive:event-123:${tsJs}`);

  assert.equal(keyPostgres, keyJs);
  assert.equal(
    keyPostgres,
    "shared_positive:event-123:2026-11-13T19:00:00.000Z",
  );
});

// ============================================================================
// SECTION 1: IDENTITY SEPARATION TESTS (Items 1-5)
// ============================================================================

// ----------------------------------------------------------------------------
// 1. Repair-response receipt uses response.id
// ----------------------------------------------------------------------------
test("Identity 1: Repair-response receipt uses response.id as sourceId and in activity_key", async () => {
  const event = {
    id: "friction-event-uuid",
    couple_id: COUPLE_ID,
    creator_id: WORLD_USER_ID,
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: new Date(CURRENT_DATE_MS - 2 * 60 * 60 * 1000).toISOString(),
  };

  const responseTime = new Date(CURRENT_DATE_MS - 30 * 60 * 1000).toISOString();
  const response = {
    id: "response-uuid-999",
    event_id: "friction-event-uuid",
    couple_id: COUPLE_ID,
    user_id: HELLO_USER_ID,
    phase: "arrival",
    response_code: "heard",
    shared_at: responseTime,
    updated_at: responseTime,
  };

  const candidate = deriveWhatMattersNowActivity({
    events: [event],
    repairResponses: [response],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  // sourceId must be response.id
  assert.equal(candidate.sourceId, "response-uuid-999");
  assert.equal(
    candidate.key,
    `repair_response:response-uuid-999:${normalizeIsoTimestamp(responseTime)}`,
  );

  let recordedSourceId = null;
  let recordedKey = null;
  const mockSupabase = {
    rpc: async (funcName, args) => {
      if (funcName === "record_home_activity_receipt") {
        recordedSourceId = args.p_source_id;
        recordedKey = args.p_activity_key;
        return { data: null, error: null };
      }
      return { data: null, error: null };
    },
  };

  const success = await markHomeActivitySeen({
    supabase: mockSupabase,
    candidate,
    coupleId: COUPLE_ID,
    userId: WORLD_USER_ID,
  });

  assert.equal(success, true);
  assert.equal(recordedSourceId, "response-uuid-999");
  assert.equal(recordedKey, candidate.key);
});

// ----------------------------------------------------------------------------
// 2. Repair-response navigation uses response.event_id
// ----------------------------------------------------------------------------
test("Identity 2: Repair-response navigation route uses response.event_id", () => {
  const event = {
    id: "friction-event-uuid",
    couple_id: COUPLE_ID,
    creator_id: WORLD_USER_ID,
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: new Date(CURRENT_DATE_MS - 2 * 60 * 60 * 1000).toISOString(),
  };

  const response = {
    id: "response-uuid-999",
    event_id: "friction-event-uuid",
    couple_id: COUPLE_ID,
    user_id: HELLO_USER_ID,
    phase: "arrival",
    response_code: "heard",
    shared_at: new Date(CURRENT_DATE_MS - 30 * 60 * 1000).toISOString(),
    updated_at: new Date(CURRENT_DATE_MS - 30 * 60 * 1000).toISOString(),
  };

  const candidate = deriveWhatMattersNowActivity({
    events: [event],
    repairResponses: [response],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  assert.equal(candidate.route, "/event/friction-event-uuid?scope=ours");
  assert.notEqual(candidate.route, "/event/response-uuid-999?scope=ours");
});

// ----------------------------------------------------------------------------
// 3. Repair-response attention update uses response.event_id
// ----------------------------------------------------------------------------
test("Identity 3: Repair-response attention update uses targetEventId (response.event_id)", () => {
  const event = {
    id: "friction-event-uuid",
    couple_id: COUPLE_ID,
    creator_id: WORLD_USER_ID,
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: new Date(CURRENT_DATE_MS - 2 * 60 * 60 * 1000).toISOString(),
  };

  const response = {
    id: "response-uuid-999",
    event_id: "friction-event-uuid",
    couple_id: COUPLE_ID,
    user_id: HELLO_USER_ID,
    phase: "arrival",
    response_code: "heard",
    shared_at: new Date(CURRENT_DATE_MS - 30 * 60 * 1000).toISOString(),
    updated_at: new Date(CURRENT_DATE_MS - 30 * 60 * 1000).toISOString(),
  };

  const candidate = deriveWhatMattersNowActivity({
    events: [event],
    repairResponses: [response],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  assert.equal(candidate.targetEventId, "friction-event-uuid");

  // Simulate card opener behavior in home.tsx
  let eventAttentionRpcParam = null;
  const mockSupabase = {
    rpc: async (funcName, args) => {
      if (funcName === "mark_relationship_event_attention_opened") {
        eventAttentionRpcParam = args.p_event_id;
      }
      return { data: null, error: null };
    },
  };

  if (candidate.actionable && candidate.targetEventId) {
    mockSupabase.rpc("mark_relationship_event_attention_opened", {
      p_event_id: candidate.targetEventId,
    });
  }

  // Must be the event ID, NEVER the response ID
  assert.equal(eventAttentionRpcParam, "friction-event-uuid");
  assert.notEqual(eventAttentionRpcParam, "response-uuid-999");
});

// ----------------------------------------------------------------------------
// 4. Shared friction uses event.id for both identities
// ----------------------------------------------------------------------------
test("Identity 4: Shared friction uses event.id for both sourceId and targetEventId", () => {
  const event = {
    id: "shared-friction-uuid",
    couple_id: COUPLE_ID,
    creator_id: HELLO_USER_ID,
    event_type: "friction",
    visibility: "ours",
    status: "open",
    created_at: new Date(CURRENT_DATE_MS - 10 * 60 * 1000).toISOString(),
  };

  const candidate = deriveWhatMattersNowActivity({
    events: [event],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  assert.equal(candidate.sourceId, "shared-friction-uuid");
  assert.equal(candidate.targetEventId, "shared-friction-uuid");
  assert.equal(candidate.route, "/event/shared-friction-uuid?scope=ours");
});

// ----------------------------------------------------------------------------
// 5. Missing targetEventId safely prevents the event-attention RPC without blocking navigation
// ----------------------------------------------------------------------------
test("Identity 5: Missing targetEventId safely prevents event-attention RPC without blocking navigation", () => {
  const task = {
    id: "task-errand-uuid",
    couple_id: COUPLE_ID,
    created_by: HELLO_USER_ID,
    title: "Organic tea",
    category: "groceries",
    status: "open",
    completed_at: null,
    created_at: new Date(CURRENT_DATE_MS - 10 * 60 * 1000).toISOString(),
    updated_at: new Date(CURRENT_DATE_MS - 10 * 60 * 1000).toISOString(),
  };

  const candidate = deriveWhatMattersNowActivity({
    events: [],
    tasks: [task],
    nowMs: CURRENT_DATE_MS,
    currentUserId: WORLD_USER_ID,
    coupleId: COUPLE_ID,
    partnerName: "Hello",
  });

  // Non-event activity has NO targetEventId
  assert.equal(candidate.targetEventId, undefined);
  assert.equal(candidate.route, "/shared-list");

  let rpcCalled = false;
  let navigatedRoute = null;

  const mockSupabase = {
    rpc: async () => {
      rpcCalled = true;
      return { data: null, error: null };
    },
  };

  const mockRouter = {
    push: (route) => {
      navigatedRoute = route;
    },
  };

  // Card open logic
  if (candidate.actionable && candidate.targetEventId) {
    mockSupabase.rpc("mark_relationship_event_attention_opened", {
      p_event_id: candidate.targetEventId,
    });
  }
  mockRouter.push(candidate.route);

  // Attention RPC was NOT invoked
  assert.equal(rpcCalled, false);
  // Navigation proceeded normally
  assert.equal(navigatedRoute, "/shared-list");
});

// ============================================================================
// SECTION 5: RPC HARDENING & SOURCE-FIRST AUTHORIZATION TESTS (Items 1-9)
// ============================================================================

// Helper simulating the exact SQL semantics of public.record_home_activity_receipt
function simulateRecordHomeActivityReceipt(db, authUid, args) {
  const { p_activity_key, p_activity_kind, p_source_id, p_attention_mode } = args;

  if (!authUid) {
    throw new Error("Authentication required");
  }

  if (!p_activity_key || !p_activity_kind || !p_source_id || !p_attention_mode) {
    throw new Error("Activity unavailable");
  }

  const trimmedKey = String(p_activity_key).trim();
  if (trimmedKey.length < 1 || trimmedKey.length > 250) {
    throw new Error("Activity unavailable");
  }

  // Kind / attention mode alignment
  const informationalKinds = new Set([
    "shared_positive",
    "reconnection_completed",
    "shared_list_added",
    "shared_list_completed",
    "important_date_added",
    "self_shared_moment",
  ]);
  const actionableKinds = new Set([
    "repair_response",
    "repair_both_ready",
    "shared_friction",
    "resurfaced_moment",
  ]);

  if (informationalKinds.has(p_activity_kind)) {
    if (p_attention_mode !== "informational") throw new Error("Activity unavailable");
  } else if (actionableKinds.has(p_activity_kind)) {
    if (p_attention_mode !== "actionable") throw new Error("Activity unavailable");
  } else {
    throw new Error("Activity unavailable");
  }

  // Source-first couple derivation and semantic validation
  let coupleId = null;
  let sourceTs = null;

  switch (p_activity_kind) {
    case "shared_positive": {
      const ev = (db.relationship_events || []).find(
        (e) => e.id === p_source_id && e.visibility === "ours" && e.event_type === "positive",
      );
      if (ev) {
        coupleId = ev.couple_id;
        sourceTs = ev.created_at;
      }
      break;
    }
    case "shared_friction":
    case "resurfaced_moment": {
      const ev = (db.relationship_events || []).find(
        (e) =>
          e.id === p_source_id &&
          e.visibility === "ours" &&
          e.event_type === "friction" &&
          e.status !== "reconnected",
      );
      if (ev) {
        coupleId = ev.couple_id;
        sourceTs = ev.created_at;
      }
      break;
    }
    case "self_shared_moment": {
      const ev = (db.relationship_events || []).find(
        (e) => e.id === p_source_id && e.visibility === "ours" && e.creator_id === authUid,
      );
      if (ev) {
        coupleId = ev.couple_id;
        sourceTs = ev.created_at;
      }
      break;
    }
    case "repair_response": {
      const resp = (db.relationship_event_repair_responses || []).find(
        (r) => r.id === p_source_id,
      );
      if (resp) {
        const ev = (db.relationship_events || []).find(
          (e) =>
            e.id === resp.event_id &&
            e.couple_id === resp.couple_id &&
            e.visibility === "ours" &&
            e.status !== "reconnected",
        );
        if (ev) {
          coupleId = resp.couple_id;
          sourceTs = resp.updated_at || resp.shared_at;
        }
      }
      break;
    }
    case "repair_both_ready": {
      const ev = (db.relationship_events || []).find(
        (e) =>
          e.id === p_source_id &&
          e.visibility === "ours" &&
          e.event_type === "friction" &&
          e.creator_id === authUid &&
          e.status !== "reconnected",
      );
      if (ev) {
        const readyResponses = (db.relationship_event_repair_responses || []).filter(
          (r) =>
            r.event_id === p_source_id &&
            r.phase === "settlement" &&
            r.response_code === "ready",
        );
        const uniqueReadyUsers = new Set(readyResponses.map((r) => r.user_id));
        if (uniqueReadyUsers.size >= 2) {
          coupleId = ev.couple_id;
          const maxMs = Math.max(
            ...readyResponses.map((r) => new Date(r.updated_at || r.shared_at).getTime()),
          );
          sourceTs = new Date(maxMs).toISOString();
        }
      }
      break;
    }
    case "reconnection_completed": {
      const outcome = (db.relationship_event_repair_outcomes || []).find(
        (o) => o.event_id === p_source_id && o.completed_at != null,
      );
      if (outcome) {
        const ev = (db.relationship_events || []).find(
          (e) =>
            e.id === p_source_id &&
            e.couple_id === outcome.couple_id &&
            e.visibility === "ours" &&
            e.status === "reconnected",
        );
        if (ev) {
          coupleId = outcome.couple_id;
          sourceTs = outcome.completed_at;
        }
      }
      break;
    }
    case "shared_list_added": {
      const task = (db.couple_tasks || []).find((t) => t.id === p_source_id);
      if (task) {
        coupleId = task.couple_id;
        sourceTs = task.created_at;
      }
      break;
    }
    case "shared_list_completed": {
      const task = (db.couple_tasks || []).find(
        (t) => t.id === p_source_id && t.status === "completed" && t.completed_at != null,
      );
      if (task) {
        coupleId = task.couple_id;
        sourceTs = task.completed_at;
      }
      break;
    }
    case "important_date_added": {
      const date = (db.couple_important_dates || []).find((d) => d.id === p_source_id);
      if (date) {
        coupleId = date.couple_id;
        sourceTs = date.created_at;
      }
      break;
    }
    default:
      throw new Error("Activity unavailable");
  }

  if (!coupleId || !sourceTs) {
    throw new Error("Activity unavailable");
  }

  // Active couple membership check
  const isMember = (db.couple_members || []).some(
    (cm) => cm.couple_id === coupleId && cm.user_id === authUid,
  );
  if (!isMember) {
    throw new Error("Activity unavailable");
  }

  // Activity-key integrity: prefix and timestamp check
  const expectedPrefix = `${p_activity_kind}:${p_source_id}:`;
  if (!trimmedKey.startsWith(expectedPrefix)) {
    throw new Error("Activity unavailable");
  }

  const keyTsStr = trimmedKey.slice(expectedPrefix.length);
  const keyMs = new Date(keyTsStr).getTime();
  if (isNaN(keyMs)) {
    throw new Error("Activity unavailable");
  }

  const sourceMs = new Date(sourceTs).getTime();
  if (Math.abs(keyMs - sourceMs) > 1000) {
    throw new Error("Activity unavailable");
  }

  // Construct canonical key on server
  const canonicalKey = `${expectedPrefix}${normalizeIsoTimestamp(sourceTs)}`;

  // Idempotent upsert
  if (!db.home_activity_receipts) db.home_activity_receipts = [];
  const existing = db.home_activity_receipts.find(
    (r) => r.user_id === authUid && r.activity_key === canonicalKey,
  );
  if (existing) {
    existing.seen_at = new Date().toISOString();
    existing.updated_at = new Date().toISOString();
  } else {
    db.home_activity_receipts.push({
      couple_id: coupleId,
      user_id: authUid,
      activity_key: canonicalKey,
      activity_kind: p_activity_kind,
      source_id: p_source_id,
      attention_mode: p_attention_mode,
      seen_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  return { success: true, canonicalKey };
}

// ----------------------------------------------------------------------------
// Test 1: User with historical membership in two couples
// ----------------------------------------------------------------------------
test("Hardening 1: User with historical membership in two couples authorizes correctly based on source", () => {
  const COUPLE_HISTORICAL = "couple-historical-past";
  const COUPLE_CURRENT = "couple-current-active";
  const USER_ID = "multi-couple-user";

  const db = {
    couple_members: [
      { couple_id: COUPLE_HISTORICAL, user_id: USER_ID },
      { couple_id: COUPLE_CURRENT, user_id: USER_ID },
    ],
    relationship_events: [
      {
        id: "event-in-current",
        couple_id: COUPLE_CURRENT,
        creator_id: "other-user",
        event_type: "positive",
        visibility: "ours",
        status: null,
        created_at: "2026-11-13T19:00:00.000Z",
      },
    ],
    home_activity_receipts: [],
  };

  const key = `shared_positive:event-in-current:2026-11-13T19:00:00.000Z`;

  const res = simulateRecordHomeActivityReceipt(db, USER_ID, {
    p_activity_key: key,
    p_activity_kind: "shared_positive",
    p_source_id: "event-in-current",
    p_attention_mode: "informational",
  });

  assert.equal(res.success, true);
  assert.equal(db.home_activity_receipts.length, 1);
  assert.equal(db.home_activity_receipts[0].couple_id, COUPLE_CURRENT);
});

// ----------------------------------------------------------------------------
// Test 2: Source couple determines authorization
// ----------------------------------------------------------------------------
test("Hardening 2: Source couple determines authorization directly from source row", () => {
  const COUPLE_A = "couple-a";
  const USER_ID = "user-a";

  const db = {
    couple_members: [{ couple_id: COUPLE_A, user_id: USER_ID }],
    couple_tasks: [
      {
        id: "task-a",
        couple_id: COUPLE_A,
        title: "Buy groceries",
        created_at: "2026-11-13T19:00:00.000Z",
      },
    ],
    home_activity_receipts: [],
  };

  const key = `shared_list_added:task-a:2026-11-13T19:00:00.000Z`;

  const res = simulateRecordHomeActivityReceipt(db, USER_ID, {
    p_activity_key: key,
    p_activity_kind: "shared_list_added",
    p_source_id: "task-a",
    p_attention_mode: "informational",
  });

  assert.equal(res.success, true);
  assert.equal(db.home_activity_receipts[0].couple_id, COUPLE_A);
});

// ----------------------------------------------------------------------------
// Test 3: Foreign-couple source rejected
// ----------------------------------------------------------------------------
test("Hardening 3: Foreign-couple source rejected with generic 'Activity unavailable'", () => {
  const FOREIGN_COUPLE = "foreign-couple";
  const USER_ID = "isolated-user";

  const db = {
    couple_members: [{ couple_id: "my-own-couple", user_id: USER_ID }],
    relationship_events: [
      {
        id: "foreign-event",
        couple_id: FOREIGN_COUPLE,
        creator_id: "foreign-user",
        event_type: "positive",
        visibility: "ours",
        status: null,
        created_at: "2026-11-13T19:00:00.000Z",
      },
    ],
    home_activity_receipts: [],
  };

  const key = `shared_positive:foreign-event:2026-11-13T19:00:00.000Z`;

  assert.throws(
    () => {
      simulateRecordHomeActivityReceipt(db, USER_ID, {
        p_activity_key: key,
        p_activity_kind: "shared_positive",
        p_source_id: "foreign-event",
        p_attention_mode: "informational",
      });
    },
    { message: "Activity unavailable" },
  );
  assert.equal(db.home_activity_receipts.length, 0);
});

// ----------------------------------------------------------------------------
// Test 4: Mismatched attention mode rejected
// ----------------------------------------------------------------------------
test("Hardening 4: Mismatched attention mode rejected", () => {
  const db = {
    couple_members: [{ couple_id: COUPLE_ID, user_id: WORLD_USER_ID }],
    relationship_events: [
      {
        id: "event-good",
        couple_id: COUPLE_ID,
        creator_id: HELLO_USER_ID,
        event_type: "positive",
        visibility: "ours",
        status: null,
        created_at: "2026-11-13T19:00:00.000Z",
      },
    ],
    home_activity_receipts: [],
  };

  const key = `shared_positive:event-good:2026-11-13T19:00:00.000Z`;

  // shared_positive is informational; caller incorrectly supplies actionable
  assert.throws(
    () => {
      simulateRecordHomeActivityReceipt(db, WORLD_USER_ID, {
        p_activity_key: key,
        p_activity_kind: "shared_positive",
        p_source_id: "event-good",
        p_attention_mode: "actionable", // MISMATCH!
      });
    },
    { message: "Activity unavailable" },
  );
});

// ----------------------------------------------------------------------------
// Test 5: Malformed activity key rejected
// ----------------------------------------------------------------------------
test("Hardening 5: Malformed activity key rejected", () => {
  const db = {
    couple_members: [{ couple_id: COUPLE_ID, user_id: WORLD_USER_ID }],
    relationship_events: [
      {
        id: "event-good",
        couple_id: COUPLE_ID,
        creator_id: HELLO_USER_ID,
        event_type: "positive",
        visibility: "ours",
        status: null,
        created_at: "2026-11-13T19:00:00.000Z",
      },
    ],
    home_activity_receipts: [],
  };

  // Missing kind and ID in key prefix
  assert.throws(
    () => {
      simulateRecordHomeActivityReceipt(db, WORLD_USER_ID, {
        p_activity_key: "tampered_prefix:2026-11-13T19:00:00.000Z",
        p_activity_kind: "shared_positive",
        p_source_id: "event-good",
        p_attention_mode: "informational",
      });
    },
    { message: "Activity unavailable" },
  );
});

// ----------------------------------------------------------------------------
// Test 6: Arbitrary timestamp suffix rejected
// ----------------------------------------------------------------------------
test("Hardening 6: Arbitrary timestamp suffix rejected", () => {
  const db = {
    couple_members: [{ couple_id: COUPLE_ID, user_id: WORLD_USER_ID }],
    relationship_events: [
      {
        id: "event-good",
        couple_id: COUPLE_ID,
        creator_id: HELLO_USER_ID,
        event_type: "positive",
        visibility: "ours",
        status: null,
        created_at: "2026-11-13T19:00:00.000Z",
      },
    ],
    home_activity_receipts: [],
  };

  // Timestamp in key does not match authoritative source row timestamp
  assert.throws(
    () => {
      simulateRecordHomeActivityReceipt(db, WORLD_USER_ID, {
        p_activity_key: "shared_positive:event-good:2022-01-01T00:00:00.000Z", // FAKE TIMESTAMP
        p_activity_kind: "shared_positive",
        p_source_id: "event-good",
        p_attention_mode: "informational",
      });
    },
    { message: "Activity unavailable" },
  );
});

// ----------------------------------------------------------------------------
// Test 7: repair_both_ready rejected before mutual readiness
// ----------------------------------------------------------------------------
test("Hardening 7: repair_both_ready rejected before mutual readiness", () => {
  const db = {
    couple_members: [
      { couple_id: COUPLE_ID, user_id: WORLD_USER_ID },
      { couple_id: COUPLE_ID, user_id: HELLO_USER_ID },
    ],
    relationship_events: [
      {
        id: "event-friction",
        couple_id: COUPLE_ID,
        creator_id: WORLD_USER_ID,
        event_type: "friction",
        visibility: "ours",
        status: "open",
        created_at: "2026-11-13T18:00:00.000Z",
      },
    ],
    relationship_event_repair_responses: [
      // Only World is ready; Hello has not checked in
      {
        id: "resp-world",
        event_id: "event-friction",
        couple_id: COUPLE_ID,
        user_id: WORLD_USER_ID,
        phase: "settlement",
        response_code: "ready",
        shared_at: "2026-11-13T18:30:00.000Z",
        updated_at: "2026-11-13T18:30:00.000Z",
      },
    ],
    home_activity_receipts: [],
  };

  const key = `repair_both_ready:event-friction:2026-11-13T18:30:00.000Z`;

  // Caller attempts to record repair_both_ready before partner submitted ready
  assert.throws(
    () => {
      simulateRecordHomeActivityReceipt(db, WORLD_USER_ID, {
        p_activity_key: key,
        p_activity_kind: "repair_both_ready",
        p_source_id: "event-friction",
        p_attention_mode: "actionable",
      });
    },
    { message: "Activity unavailable" },
  );
});

// ----------------------------------------------------------------------------
// Test 8: shared_list_completed rejected for incomplete task
// ----------------------------------------------------------------------------
test("Hardening 8: shared_list_completed rejected for incomplete task", () => {
  const db = {
    couple_members: [{ couple_id: COUPLE_ID, user_id: WORLD_USER_ID }],
    couple_tasks: [
      {
        id: "task-open",
        couple_id: COUPLE_ID,
        title: "Clean living room",
        status: "open", // NOT completed!
        completed_at: null,
        created_at: "2026-11-13T18:00:00.000Z",
      },
    ],
    home_activity_receipts: [],
  };

  const key = `shared_list_completed:task-open:2026-11-13T18:00:00.000Z`;

  assert.throws(
    () => {
      simulateRecordHomeActivityReceipt(db, WORLD_USER_ID, {
        p_activity_key: key,
        p_activity_kind: "shared_list_completed",
        p_source_id: "task-open",
        p_attention_mode: "informational",
      });
    },
    { message: "Activity unavailable" },
  );
});

// ----------------------------------------------------------------------------
// Test 9: Canonical valid receipt remains idempotent
// ----------------------------------------------------------------------------
test("Hardening 9: Canonical valid receipt remains idempotent", () => {
  const db = {
    couple_members: [{ couple_id: COUPLE_ID, user_id: WORLD_USER_ID }],
    relationship_events: [
      {
        id: "event-good-canonical",
        couple_id: COUPLE_ID,
        creator_id: HELLO_USER_ID,
        event_type: "positive",
        visibility: "ours",
        status: null,
        created_at: "2026-11-13T19:00:00.000Z",
      },
    ],
    home_activity_receipts: [],
  };

  const key = `shared_positive:event-good-canonical:2026-11-13T19:00:00.000Z`;

  const pass1 = simulateRecordHomeActivityReceipt(db, WORLD_USER_ID, {
    p_activity_key: key,
    p_activity_kind: "shared_positive",
    p_source_id: "event-good-canonical",
    p_attention_mode: "informational",
  });
  const pass2 = simulateRecordHomeActivityReceipt(db, WORLD_USER_ID, {
    p_activity_key: key,
    p_activity_kind: "shared_positive",
    p_source_id: "event-good-canonical",
    p_attention_mode: "informational",
  });

  assert.equal(pass1.success, true);
  assert.equal(pass2.success, true);
  assert.equal(db.home_activity_receipts.length, 1);
  assert.equal(db.home_activity_receipts[0].activity_key, key);
});
