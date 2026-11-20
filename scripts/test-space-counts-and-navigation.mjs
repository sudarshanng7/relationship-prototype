import test from "node:test";
import assert from "node:assert/strict";

import {
  isWithinPastSevenDays,
  filterCanonicalPrivateReflections,
  formatMineSummary,
  filterCanonicalOursEvents,
  countOursEventsThisWeek,
  formatOursSummary,
  resolveEventBackNavigation,
  appendNavigationOrigin,
  SEVEN_DAYS_MS,
} from "../src/lib/spaces-summary.ts";

// -----------------------------------------------------------------------------
// CANONICAL MINE TESTS
// -----------------------------------------------------------------------------

test("Mine 1: Counts current user's private reflections with non-empty notes and valid parent events", () => {
  const currentUserId = "user-alice";
  const rows = [
    {
      id: "ref-1",
      event_id: "ev-1",
      author_id: "user-alice",
      note: "Felt overwhelmed, took five deep breaths.",
      created_at: "2026-11-20T10:00:00.000Z",
      relationship_events: {
        id: "ev-1",
        category: "communication",
        status: "open",
        event_type: "friction",
        visibility: "ours",
      },
    },
    {
      id: "ref-2",
      event_id: "ev-2",
      author_id: "user-alice",
      note: "Grateful for morning coffee together.",
      created_at: "2026-11-19T08:30:00.000Z",
      relationship_events: {
        id: "ev-2",
        category: "affection",
        status: null,
        event_type: "positive",
        visibility: "mine",
      },
    },
  ];

  const filtered = filterCanonicalPrivateReflections(rows, currentUserId);
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0].id, "ref-1");
  assert.equal(filtered[0].note, "Felt overwhelmed, took five deep breaths.");
  assert.equal(filtered[0].eventCategory, "communication");
  assert.equal(filtered[1].id, "ref-2");
  assert.equal(filtered[1].note, "Grateful for morning coffee together.");
  assert.equal(formatMineSummary(filtered.length), "2 private reflections");
});

test("Mine 2: Strictly excludes partner-authored private reflections", () => {
  const currentUserId = "user-alice";
  const partnerId = "user-bob";
  const rows = [
    {
      id: "ref-alice",
      event_id: "ev-1",
      author_id: currentUserId,
      note: "Alice private thought",
      relationship_events: { id: "ev-1", category: "chores" },
    },
    {
      id: "ref-bob",
      event_id: "ev-1",
      author_id: partnerId,
      note: "Bob private thought",
      relationship_events: { id: "ev-1", category: "chores" },
    },
  ];

  const filtered = filterCanonicalPrivateReflections(rows, currentUserId);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].authorId, currentUserId);
  assert.equal(filtered[0].note, "Alice private thought");
  assert.equal(formatMineSummary(filtered.length), "1 private reflection");
});

test("Mine 3: Excludes blank or whitespace-only reflection notes", () => {
  const currentUserId = "user-alice";
  const rows = [
    {
      id: "ref-empty-1",
      event_id: "ev-1",
      author_id: currentUserId,
      note: "",
      relationship_events: { id: "ev-1" },
    },
    {
      id: "ref-empty-2",
      event_id: "ev-2",
      author_id: currentUserId,
      note: "    \n\t   ",
      relationship_events: { id: "ev-2" },
    },
    {
      id: "ref-null",
      event_id: "ev-3",
      author_id: currentUserId,
      note: null,
      relationship_events: { id: "ev-3" },
    },
    {
      id: "ref-valid",
      event_id: "ev-4",
      author_id: currentUserId,
      note: "Meaningful reflection note",
      relationship_events: { id: "ev-4" },
    },
  ];

  const filtered = filterCanonicalPrivateReflections(rows, currentUserId);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "ref-valid");
  assert.equal(filtered[0].note, "Meaningful reflection note");
});

test("Mine 4: Excludes reflections with missing or inaccessible parent events", () => {
  const currentUserId = "user-alice";
  const rows = [
    {
      id: "ref-orphan",
      event_id: "ev-deleted",
      author_id: currentUserId,
      note: "Orphaned reflection with deleted event",
      relationship_events: null,
    },
    {
      id: "ref-valid",
      event_id: "ev-alive",
      author_id: currentUserId,
      note: "Active reflection",
      relationship_events: { id: "ev-alive" },
    },
  ];

  const filtered = filterCanonicalPrivateReflections(rows, currentUserId);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "ref-valid");
});

test("Mine 5: Deduplicates duplicate rows by reflection ID and event ID", () => {
  const currentUserId = "user-alice";
  const rows = [
    {
      id: "ref-1",
      event_id: "ev-1",
      author_id: currentUserId,
      note: "Note A",
      relationship_events: { id: "ev-1" },
    },
    {
      id: "ref-1",
      event_id: "ev-1",
      author_id: currentUserId,
      note: "Note A duplicate",
      relationship_events: { id: "ev-1" },
    },
    {
      id: "ref-duplicate-event",
      event_id: "ev-1",
      author_id: currentUserId,
      note: "Note on same event",
      relationship_events: { id: "ev-1" },
    },
  ];

  const filtered = filterCanonicalPrivateReflections(rows, currentUserId);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "ref-1");
});

test("Mine 6: Truthful singular/plural and empty formatting", () => {
  assert.equal(formatMineSummary(0), "No private reflections yet");
  assert.equal(formatMineSummary(-1), "No private reflections yet");
  assert.equal(formatMineSummary(1), "1 private reflection");
  assert.equal(formatMineSummary(2), "2 private reflections");
  assert.equal(formatMineSummary(5), "5 private reflections");
});

// -----------------------------------------------------------------------------
// CANONICAL OURS TESTS
// -----------------------------------------------------------------------------

test("Ours 1: Counts shared moments belonging to active couple and excludes mine-only or cross-couple events", () => {
  const activeCoupleId = "couple-123";
  const otherCoupleId = "couple-999";

  const rawEvents = [
    {
      id: "ev-shared-1",
      couple_id: activeCoupleId,
      visibility: "ours",
      event_type: "friction",
      category: "communication",
      status: "open",
      created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    },
    {
      id: "ev-shared-2",
      couple_id: activeCoupleId,
      visibility: "ours",
      event_type: "positive",
      category: "appreciation",
      status: null,
      created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    },
    {
      id: "ev-mine-only",
      couple_id: activeCoupleId,
      visibility: "mine",
      event_type: "friction",
      category: "finances",
      status: "open",
      created_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    },
    {
      id: "ev-other-couple",
      couple_id: otherCoupleId,
      visibility: "ours",
      event_type: "friction",
      category: "communication",
      status: "open",
      created_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    },
  ];

  const filtered = filterCanonicalOursEvents(rawEvents, activeCoupleId);
  assert.equal(filtered.length, 2);
  assert.deepEqual(
    filtered.map((e) => e.id),
    ["ev-shared-1", "ev-shared-2"],
  );
});

test("Ours 2: Week boundary strictly uses trailing 7 days (now - 7d <= ts <= now)", () => {
  const nowMs = new Date("2026-11-20T12:00:00.000Z").getTime();
  const coupleId = "couple-123";

  const rawEvents = [
    {
      id: "ev-today",
      couple_id: coupleId,
      visibility: "ours",
      created_at: "2026-11-20T10:00:00.000Z", // 2h ago
    },
    {
      id: "ev-3-days-ago",
      couple_id: coupleId,
      visibility: "ours",
      created_at: "2026-11-17T12:00:00.000Z", // 3 days ago
    },
    {
      id: "ev-exactly-7-days-ago",
      couple_id: coupleId,
      visibility: "ours",
      created_at: "2026-11-13T12:00:00.000Z", // exactly 7 * 24h ago
    },
    {
      id: "ev-8-days-ago",
      couple_id: coupleId,
      visibility: "ours",
      created_at: "2026-11-12T11:59:59.000Z", // older than 7 days
    },
    {
      id: "ev-last-month",
      couple_id: coupleId,
      visibility: "ours",
      created_at: "2026-10-15T12:00:00.000Z", // historical
    },
  ];

  const filtered = filterCanonicalOursEvents(rawEvents, coupleId);
  assert.equal(filtered.length, 5); // All 5 are accessible in Ours space

  const weekCount = countOursEventsThisWeek(filtered, nowMs);
  assert.equal(weekCount, 3); // today, 3-days-ago, exactly-7-days-ago
  assert.equal(formatOursSummary(weekCount), "3 shared moments this week");
});

test("Ours 3: Truthful singular/plural and empty formatting", () => {
  assert.equal(formatOursSummary(0), "No shared moments this week");
  assert.equal(formatOursSummary(-1), "No shared moments this week");
  assert.equal(formatOursSummary(1), "1 shared moment this week");
  assert.equal(formatOursSummary(2), "2 shared moments this week");
  assert.equal(formatOursSummary(10), "10 shared moments this week");
});

// -----------------------------------------------------------------------------
// ORIGIN-AWARE NAVIGATION TESTS
// -----------------------------------------------------------------------------

test("Navigation 1: Maps allowlisted origins to exact labels and destinations", () => {
  const rhythmNav = resolveEventBackNavigation("my-rhythm");
  assert.equal(rhythmNav.origin, "my-rhythm");
  assert.equal(rhythmNav.backLabel, "‹ Back to My Rhythm");
  assert.equal(rhythmNav.backAccessibilityLabel, "Back to My Rhythm");
  assert.equal(rhythmNav.destination, "/home");

  const mineNav = resolveEventBackNavigation("mine");
  assert.equal(mineNav.origin, "mine");
  assert.equal(mineNav.backLabel, "‹ Back to Mine");
  assert.equal(mineNav.backAccessibilityLabel, "Back to Mine");
  assert.equal(mineNav.destination, "/events?scope=mine");

  const oursNav = resolveEventBackNavigation("ours");
  assert.equal(oursNav.origin, "ours");
  assert.equal(oursNav.backLabel, "‹ Back to Our Space");
  assert.equal(oursNav.backAccessibilityLabel, "Back to Our Space");
  assert.equal(oursNav.destination, "/events?scope=ours");

  const momentsNav = resolveEventBackNavigation("moments");
  assert.equal(momentsNav.origin, "moments");
  assert.equal(momentsNav.backLabel, "‹ Back to Moments");
  assert.equal(momentsNav.backAccessibilityLabel, "Back to Moments");
  assert.equal(momentsNav.destination, "/events");
});

test("Navigation 2: Prevents arbitrary origin injection and safely falls back", () => {
  // Disallowed injection string
  const maliciousNav = resolveEventBackNavigation("https://malicious.site/phish");
  assert.equal(maliciousNav.origin, "moments");
  assert.equal(maliciousNav.destination, "/events");

  // Invalid origin with scope=mine fallback
  const fallbackMine = resolveEventBackNavigation("invalid-origin", "mine");
  assert.equal(fallbackMine.origin, "mine");
  assert.equal(fallbackMine.destination, "/events?scope=mine");

  // Invalid origin with scope=ours fallback
  const fallbackOurs = resolveEventBackNavigation(null, "ours");
  assert.equal(fallbackOurs.origin, "ours");
  assert.equal(fallbackOurs.destination, "/events?scope=ours");

  // Missing origin and missing scope falls back to event.visibility
  const fallbackEventVis = resolveEventBackNavigation(null, null, "mine");
  assert.equal(fallbackEventVis.origin, "mine");
  assert.equal(fallbackEventVis.destination, "/events?scope=mine");

  // Total missing fallback
  const fallbackDefault = resolveEventBackNavigation(null, null, null);
  assert.equal(fallbackDefault.origin, "moments");
  assert.equal(fallbackDefault.destination, "/events");
});

test("Navigation 3: Array param handling from useLocalSearchParams", () => {
  const fromArray = resolveEventBackNavigation(["my-rhythm", "mine"]);
  assert.equal(fromArray.origin, "my-rhythm");
  assert.equal(fromArray.destination, "/home");
});

test("Navigation 4: appendNavigationOrigin helper idempotent behavior", () => {
  assert.equal(
    appendNavigationOrigin("/event/123", "my-rhythm"),
    "/event/123?from=my-rhythm",
  );
  assert.equal(
    appendNavigationOrigin("/event/123?scope=ours", "my-rhythm"),
    "/event/123?scope=ours&from=my-rhythm",
  );
  // Idempotent: does not duplicate from parameter
  assert.equal(
    appendNavigationOrigin("/event/123?scope=ours&from=my-rhythm", "my-rhythm"),
    "/event/123?scope=ours&from=my-rhythm",
  );
});

// -----------------------------------------------------------------------------
// CORE REGRESSION CONTRACT
// -----------------------------------------------------------------------------

test("Regression: Opening an event from My Rhythm returns to /home, not /events?scope=ours", () => {
  // Given a shared event candidate generated for Home
  const targetEventRoute = "/event/shared-friction-456?scope=ours";
  const navigatedRoute = appendNavigationOrigin(targetEventRoute, "my-rhythm");

  assert.equal(navigatedRoute, "/event/shared-friction-456?scope=ours&from=my-rhythm");

  // When EventDetail parses parameters from URL
  const parsedParams = {
    id: "shared-friction-456",
    scope: "ours",
    from: "my-rhythm",
  };

  const backConfig = resolveEventBackNavigation(
    parsedParams.from,
    parsedParams.scope,
    "ours",
  );

  // Then back destination MUST be /home and back label MUST be Back to My Rhythm
  assert.equal(backConfig.destination, "/home");
  assert.equal(backConfig.backLabel, "‹ Back to My Rhythm");
  assert.notEqual(backConfig.destination, "/events?scope=ours");
  assert.notEqual(backConfig.backLabel, "‹ Back to Our Space");
});
