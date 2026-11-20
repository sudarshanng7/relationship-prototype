import test from "node:test";
import assert from "node:assert/strict";

import {
  getWeeklyReflectionPeriod,
  formatWeeklyReflectionPeriod,
  buildWeeklyActivitySummaryLines,
  fetchWeeklyActivitySummary,
  fetchWeeklyMoments,
  fetchCurrentWeeklyReflection,
  saveWeeklyReflection,
  STAYED_WITH_OPTIONS,
  CARRY_FORWARD_OPTIONS,
  isStayedWithOption,
  isCarryForwardOption,
  MAX_PRIVATE_NOTE_LENGTH,
} from "../src/lib/weekly-reflection.ts";

import {
  resolveEventBackNavigation,
  appendNavigationOrigin,
} from "../src/lib/spaces-summary.ts";

// -----------------------------------------------------------------------------
// 1. CANONICAL WEEK PERIOD & BOUNDARY TESTS
// -----------------------------------------------------------------------------

test("Week 1: Monday reference sets week start at Monday 00:00:00.000Z", () => {
  const period = getWeeklyReflectionPeriod("2026-11-16T10:30:00.000Z");
  assert.equal(period.weekStart, "2026-11-16T00:00:00.000Z");
  assert.equal(period.weekEnd, "2026-11-23T00:00:00.000Z");
  assert.equal(period.weekKey, "2026-11-16");
});

test("Week 2: Sunday reference belongs to the Monday-started week (Sunday inclusion)", () => {
  const period = getWeeklyReflectionPeriod("2026-11-22T23:59:59.999Z");
  assert.equal(period.weekStart, "2026-11-16T00:00:00.000Z");
  assert.equal(period.weekEnd, "2026-11-23T00:00:00.000Z");
  assert.equal(period.weekKey, "2026-11-16");
});

test("Week 3: Following Monday at 00:00:00.000Z starts the next week (exclusive end boundary)", () => {
  const period = getWeeklyReflectionPeriod("2026-11-23T00:00:00.000Z");
  assert.equal(period.weekStart, "2026-11-23T00:00:00.000Z");
  assert.equal(period.weekEnd, "2026-11-30T00:00:00.000Z");
  assert.equal(period.weekKey, "2026-11-23");
});

test("Week 4: Month transition handles week crossing month boundary cleanly", () => {
  // Tuesday Dec 1, 2026 -> week starts Monday Nov 30, 2026
  const period = getWeeklyReflectionPeriod("2026-12-01T15:00:00.000Z");
  assert.equal(period.weekStart, "2026-11-30T00:00:00.000Z");
  assert.equal(period.weekEnd, "2026-12-07T00:00:00.000Z");
  assert.equal(period.weekKey, "2026-11-30");

  const formatted = formatWeeklyReflectionPeriod(period);
  assert.equal(formatted, "Nov 30 – Dec 6, 2026");
});

test("Week 5: Year transition handles week crossing year boundary cleanly", () => {
  // Friday Jan 2, 2026 -> week starts Monday Dec 29, 2025
  const period = getWeeklyReflectionPeriod("2026-01-02T12:00:00.000Z");
  assert.equal(period.weekStart, "2025-12-29T00:00:00.000Z");
  assert.equal(period.weekEnd, "2026-01-05T00:00:00.000Z");
  assert.equal(period.weekKey, "2025-12-29");

  const formatted = formatWeeklyReflectionPeriod(period);
  assert.equal(formatted, "Dec 29 – Jan 4, 2026");
});

test("Week 6: Stable week key is always YYYY-MM-DD of Monday", () => {
  const period1 = getWeeklyReflectionPeriod("2026-11-18T14:20:00.000Z"); // Wed
  const period2 = getWeeklyReflectionPeriod("2026-11-20T22:10:00.000Z"); // Fri
  assert.equal(period1.weekKey, "2026-11-16");
  assert.equal(period2.weekKey, "2026-11-16");
  assert.equal(period1.weekStart, period2.weekStart);
  assert.equal(period1.weekEnd, period2.weekEnd);
});

test("Week 7: User-facing period formatting within same month", () => {
  const period = getWeeklyReflectionPeriod("2026-11-16T12:00:00.000Z");
  const formatted = formatWeeklyReflectionPeriod(period);
  assert.equal(formatted, "Nov 16 – 22, 2026");
});

// -----------------------------------------------------------------------------
// 2. FACTUAL ACTIVITY SUMMARY & COPY
// -----------------------------------------------------------------------------

test("Summary 1: Zero-activity state produces empty copy lines and hasAnyActivity=false", () => {
  const lines = buildWeeklyActivitySummaryLines({
    userRecordedMomentsCount: 0,
    partnerSharedMomentsCount: 0,
    privateReflectionsCount: 0,
    reconnectedMomentsCount: 0,
  });
  assert.deepEqual(lines, []);
});

test("Summary 2: Singular activity copy for 1 item each", () => {
  const lines = buildWeeklyActivitySummaryLines({
    userRecordedMomentsCount: 1,
    partnerSharedMomentsCount: 1,
    privateReflectionsCount: 1,
    reconnectedMomentsCount: 1,
  });
  assert.equal(lines.length, 4);
  assert.equal(lines[0], "1 moment you recorded");
  assert.equal(lines[1], "1 moment shared by your partner");
  assert.equal(lines[2], "1 private reflection");
  assert.equal(lines[3], "1 moment you worked through together");
});

test("Summary 3: Plural activity copy for multiple items", () => {
  const lines = buildWeeklyActivitySummaryLines({
    userRecordedMomentsCount: 3,
    partnerSharedMomentsCount: 2,
    privateReflectionsCount: 4,
    reconnectedMomentsCount: 2,
  });
  assert.equal(lines.length, 4);
  assert.equal(lines[0], "3 moments you recorded");
  assert.equal(lines[1], "2 moments shared by your partner");
  assert.equal(lines[2], "4 private reflections");
  assert.equal(lines[3], "2 moments you worked through together");
});

// -----------------------------------------------------------------------------
// 3. MOCK SUPABASE DATA FETCHING & DEDUPLICATION TESTS
// -----------------------------------------------------------------------------

test("Data 1: Deduplication of events and correct count attribution", async () => {
  const userId = "user-alice";
  const partnerId = "user-bob";
  const coupleId = "couple-1";

  const period = getWeeklyReflectionPeriod("2026-11-18T12:00:00.000Z");

  const mockEvents = [
    // Alice moment within week
    {
      id: "ev-1",
      creator_id: userId,
      event_type: "positive",
      category: "appreciation",
      visibility: "ours",
      status: null,
      created_at: "2026-11-17T10:00:00.000Z",
      reconnected_at: null,
    },
    // Duplicate of ev-1
    {
      id: "ev-1",
      creator_id: userId,
      event_type: "positive",
      category: "appreciation",
      visibility: "ours",
      status: null,
      created_at: "2026-11-17T10:00:00.000Z",
      reconnected_at: null,
    },
    // Bob moment within week
    {
      id: "ev-2",
      creator_id: partnerId,
      event_type: "friction",
      category: "household",
      visibility: "ours",
      status: "reconnected",
      created_at: "2026-11-18T14:00:00.000Z",
      reconnected_at: "2026-11-19T09:00:00.000Z",
    },
    // Moment outside week (prior week)
    {
      id: "ev-old",
      creator_id: userId,
      event_type: "positive",
      category: "care",
      visibility: "mine",
      status: null,
      created_at: "2026-11-05T10:00:00.000Z",
      reconnected_at: null,
    },
  ];

  const mockReflections = [
    // Alice private reflection on ev-1
    {
      id: "ref-1",
      event_id: "ev-1",
      author_id: userId,
      note: "Felt really heard.",
      created_at: "2026-11-17T11:00:00.000Z",
      relationship_events: {
        id: "ev-1",
        category: "appreciation",
        status: null,
        event_type: "positive",
        visibility: "ours",
      },
    },
  ];

  const mockSupabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: userId } }, error: null }),
    },
    from: (table) => {
      if (table === "couple_members") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { couple_id: coupleId },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "relationship_events") {
        return {
          select: () => ({
            or: async () => ({ data: mockEvents, error: null }),
            eq: async () => ({ data: mockEvents, error: null }),
          }),
        };
      }
      if (table === "event_private_reflections") {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lt: async () => ({ data: mockReflections, error: null }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  const { data: summary } = await fetchWeeklyActivitySummary(
    mockSupabase,
    period,
  );
  assert.equal(summary.userRecordedMomentsCount, 1); // ev-1 deduplicated
  assert.equal(summary.partnerSharedMomentsCount, 1); // ev-2
  assert.equal(summary.privateReflectionsCount, 1); // ref-1
  assert.equal(summary.reconnectedMomentsCount, 1); // ev-2
  assert.equal(summary.hasAnyActivity, true);
  assert.equal(summary.activityLines.length, 4);

  const { data: moments } = await fetchWeeklyMoments(mockSupabase, period);
  assert.equal(moments.length, 2); // ev-1 and ev-2 (ev-old excluded, ev-1 deduplicated)
});

test("Data 2: Excludes partner private reflections and empty reflection notes", async () => {
  const userId = "user-alice";
  const partnerId = "user-bob";
  const period = getWeeklyReflectionPeriod("2026-11-18T12:00:00.000Z");

  const mockReflections = [
    // Partner's private reflection (must be ignored)
    {
      id: "ref-partner",
      event_id: "ev-1",
      author_id: partnerId,
      note: "Partner's private thoughts",
      created_at: "2026-11-17T11:00:00.000Z",
      relationship_events: { id: "ev-1" },
    },
    // User's empty reflection (whitespace only - must be ignored)
    {
      id: "ref-empty",
      event_id: "ev-2",
      author_id: userId,
      note: "   ",
      created_at: "2026-11-17T11:00:00.000Z",
      relationship_events: { id: "ev-2" },
    },
    // Reflection missing parent event (must be ignored)
    {
      id: "ref-orphan",
      event_id: "ev-missing",
      author_id: userId,
      note: "Orphaned reflection",
      created_at: "2026-11-17T11:00:00.000Z",
      relationship_events: null,
    },
  ];

  const mockSupabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: userId } }, error: null }),
    },
    from: (table) => {
      if (table === "couple_members") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === "relationship_events") {
        return {
          select: () => ({
            eq: async () => ({ data: [], error: null }),
          }),
        };
      }
      if (table === "event_private_reflections") {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lt: async () => ({ data: mockReflections, error: null }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  const { data: summary } = await fetchWeeklyActivitySummary(
    mockSupabase,
    period,
  );
  assert.equal(summary.privateReflectionsCount, 0);
  assert.equal(summary.hasAnyActivity, false);
});

// -----------------------------------------------------------------------------
// 4. VALIDATION & ANSWER OPTIONS
// -----------------------------------------------------------------------------

test("Validation 1: Supported options validation", () => {
  assert.equal(STAYED_WITH_OPTIONS.length, 5);
  assert.equal(CARRY_FORWARD_OPTIONS.length, 6);

  for (const opt of STAYED_WITH_OPTIONS) {
    assert.equal(isStayedWithOption(opt), true);
  }
  for (const opt of CARRY_FORWARD_OPTIONS) {
    assert.equal(isCarryForwardOption(opt), true);
  }

  assert.equal(isStayedWithOption("Random answer"), false);
  assert.equal(isStayedWithOption(null), false);
  assert.equal(isCarryForwardOption(123), false);
  assert.equal(isCarryForwardOption(""), false);
});

test("Validation 2: saveWeeklyReflection rejects invalid answers", async () => {
  const period = getWeeklyReflectionPeriod("2026-11-18T12:00:00.000Z");
  const mockSupabase = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-123" } },
        error: null,
      }),
    },
  };

  const res1 = await saveWeeklyReflection(mockSupabase, {
    period,
    stayedWith: "Invalid choice",
    carryForward: "More time together",
  });
  assert.notEqual(res1.error, null);
  assert.match(
    res1.error.message,
    /select what stayed with you from this week/i,
  );

  const res2 = await saveWeeklyReflection(mockSupabase, {
    period,
    stayedWith: "A moment of closeness",
    carryForward: "Invalid carry forward",
  });
  assert.notEqual(res2.error, null);
  assert.match(
    res2.error.message,
    /select what you would like to carry into next week/i,
  );
});

test("Validation 3: saveWeeklyReflection rejects notes longer than 1000 characters", async () => {
  const period = getWeeklyReflectionPeriod("2026-11-18T12:00:00.000Z");
  const mockSupabase = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-123" } },
        error: null,
      }),
    },
  };

  const longNote = "a".repeat(1001);
  const res = await saveWeeklyReflection(mockSupabase, {
    period,
    stayedWith: "A moment of closeness",
    carryForward: "More time together",
    privateNote: longNote,
  });
  assert.notEqual(res.error, null);
  assert.match(res.error.message, /1000 characters or less/i);
});

test("Validation 4: saveWeeklyReflection trims private note and turns whitespace into null", async () => {
  const period = getWeeklyReflectionPeriod("2026-11-18T12:00:00.000Z");
  let capturedInsertPayload = null;

  const mockSupabase = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-123" } },
        error: null,
      }),
    },
    from: (table) => {
      if (table === "couple_members") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === "weekly_reflections") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
          insert: (payload) => {
            capturedInsertPayload = payload;
            return {
              select: () => ({
                single: async () => ({
                  data: {
                    id: "wr-new",
                    user_id: payload.user_id,
                    couple_id: payload.couple_id,
                    week_start: payload.week_start,
                    week_end: payload.week_end,
                    stayed_with: payload.stayed_with,
                    carry_forward: payload.carry_forward,
                    private_note: payload.private_note,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                  error: null,
                }),
              }),
            };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  const res = await saveWeeklyReflection(mockSupabase, {
    period,
    stayedWith: "A moment of closeness",
    carryForward: "More time together",
    privateNote: "   \t\n  ",
  });

  assert.equal(res.error, null);
  assert.notEqual(capturedInsertPayload, null);
  assert.equal(capturedInsertPayload.private_note, null);
});

test("Validation 5: saveWeeklyReflection updates existing row rather than duplicate insert", async () => {
  const period = getWeeklyReflectionPeriod("2026-11-18T12:00:00.000Z");
  let updatedPayload = null;
  let updateCalled = false;
  let insertCalled = false;

  const existingRow = {
    id: "wr-existing-123",
    user_id: "user-123",
    couple_id: "couple-1",
    week_start: period.weekStart,
    week_end: period.weekEnd,
    stayed_with: "Nothing in particular",
    carry_forward: "Keep things as they are",
    private_note: null,
    created_at: "2026-11-16T10:00:00.000Z",
    updated_at: "2026-11-16T10:00:00.000Z",
  };

  const mockSupabase = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-123" } },
        error: null,
      }),
    },
    from: (table) => {
      if (table === "couple_members") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { couple_id: "couple-1" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "weekly_reflections") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: existingRow, error: null }),
              }),
            }),
          }),
          update: (payload) => {
            updateCalled = true;
            updatedPayload = payload;
            return {
              eq: () => ({
                select: () => ({
                  single: async () => ({
                    data: {
                      ...existingRow,
                      ...payload,
                      updated_at: new Date().toISOString(),
                    },
                    error: null,
                  }),
                }),
              }),
            };
          },
          insert: () => {
            insertCalled = true;
            throw new Error("Insert should not be called when row exists!");
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  const res = await saveWeeklyReflection(mockSupabase, {
    period,
    stayedWith: "Something we worked through",
    carryForward: "A gentler conversation",
    privateNote: "  Updated note with trimming.  ",
  });

  assert.equal(res.error, null);
  assert.equal(updateCalled, true);
  assert.equal(insertCalled, false);
  assert.equal(updatedPayload.stayed_with, "Something we worked through");
  assert.equal(updatedPayload.carry_forward, "A gentler conversation");
  assert.equal(updatedPayload.private_note, "Updated note with trimming.");
  assert.equal(res.data.id, "wr-existing-123");
});

// -----------------------------------------------------------------------------
// 5. NAVIGATION ORIGIN INTEGRATION & PRESERVATION TESTS
// -----------------------------------------------------------------------------

test("Navigation 1: Maps weekly-reflection origin to Back to Your Week destination", () => {
  const config = resolveEventBackNavigation("weekly-reflection");
  assert.equal(config.origin, "weekly-reflection");
  assert.equal(config.backLabel, "‹ Back to Your Week");
  assert.equal(config.backAccessibilityLabel, "Back to Your Week");
  assert.equal(config.destination, "/weekly-reflection?from=my-rhythm");
});

test("Navigation 2: Appends weekly-reflection origin idempotently", () => {
  const url1 = appendNavigationOrigin("/event/123", "weekly-reflection");
  assert.equal(url1, "/event/123?from=weekly-reflection");

  // Idempotent: does not append duplicate from parameter
  const url2 = appendNavigationOrigin(url1, "weekly-reflection");
  assert.equal(url2, "/event/123?from=weekly-reflection");
});

test("Navigation 3: Preserves existing my-rhythm origin", () => {
  const config = resolveEventBackNavigation("my-rhythm");
  assert.equal(config.origin, "my-rhythm");
  assert.equal(config.backLabel, "‹ Back to My Rhythm");
  assert.equal(config.destination, "/home");
});

test("Navigation 4: Preserves existing mine origin", () => {
  const config = resolveEventBackNavigation("mine");
  assert.equal(config.origin, "mine");
  assert.equal(config.backLabel, "‹ Back to Mine");
  assert.equal(config.destination, "/events?scope=mine");
});

test("Navigation 5: Preserves existing ours origin", () => {
  const config = resolveEventBackNavigation("ours");
  assert.equal(config.origin, "ours");
  assert.equal(config.backLabel, "‹ Back to Our Space");
  assert.equal(config.destination, "/events?scope=ours");
});

test("Navigation 6: Preserves existing moments origin", () => {
  const config = resolveEventBackNavigation("moments");
  assert.equal(config.origin, "moments");
  assert.equal(config.backLabel, "‹ Back to Moments");
  assert.equal(config.destination, "/events");
});

test("Navigation 7: Unknown origin falls back safely based on visibility/scope", () => {
  const configMine = resolveEventBackNavigation("invalid-origin", undefined, "mine");
  assert.equal(configMine.destination, "/events?scope=mine");

  const configOurs = resolveEventBackNavigation("unknown", undefined, "ours");
  assert.equal(configOurs.destination, "/events?scope=ours");
});
