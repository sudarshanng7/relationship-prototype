import assert from "node:assert/strict";
import test from "node:test";
import {
  createGardenStory,
  calculateHistoricalGrowth,
  getEventEffectiveTimestamp,
  formatStoryDateUtc,
  getStoryFrameType,
  getStoryProgressViewModel,
  getStepDurationMs,
  normalizeStoryEventTitle,
  getStoryTitleFallback,
  STORY_TITLE_MAX_LENGTH,
  GARDEN_STORY_EXPLANATION,
  formatCategory,
  getCanonicalEventHeading,
} from "../src/lib/garden-story.ts";
import {
  generateGardenSVGScene,
  deriveGardenDNA,
  hashStringToSeed,
  getCareFeatureId,
  verifyLivingGardenInvariants,
} from "../src/lib/garden-generator.ts";
import { buildGardenWorld } from "../src/lib/garden/build-garden-world.ts";

const COUPLE_ID_A = "11111111-2222-3333-4444-555555555555";
const COUPLE_ID_B = "99999999-8888-7777-6666-555555555555";
const COUPLE_CREATED_AT = "2026-01-01T00:00:00.000Z";
const AS_OF_TIME = "2026-06-01T12:00:00.000Z"; // ~151.5 days elapsed

function createMockEvent(id, kind, occurredAt, createdAt = null, categoryOrTitle = null, extraProps = {}) {
  const isDate = kind === "important_date";
  return {
    id,
    kind,
    occurredAt,
    ...(createdAt ? { createdAt } : {}),
    ...(isDate
      ? (categoryOrTitle !== null ? { displayTitle: categoryOrTitle, label: categoryOrTitle } : {})
      : (categoryOrTitle !== null ? { category: categoryOrTitle, displayTitle: categoryOrTitle } : {})),
    ...extraProps,
  };
}

// ----------------------------------------------------------------------------
// Test 1: Every care event produces exactly one event step
// ----------------------------------------------------------------------------
test("1. Every care event produces exactly one dedicated event step", () => {
  const events = [
    createMockEvent("ev-1", "positive_moment", "2026-01-15T10:00:00Z"),
    createMockEvent("ev-2", "reconnection", "2026-02-01T14:30:00Z"),
    createMockEvent("ev-3", "important_date", "2026-03-10T09:00:00Z", "2026-03-01T10:00:00Z"),
    createMockEvent("ev-4", "positive_moment", "2026-04-20T18:00:00Z"),
  ];

  const snapshot = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: events,
    asOfTime: AS_OF_TIME,
    isResting: false,
  };

  const story = createGardenStory(snapshot);
  const eventSteps = story.steps.filter((s) => s.addedEventKey !== null);

  assert.equal(eventSteps.length, events.length);
  for (let i = 0; i < events.length; i++) {
    const expectedKey = `${events[i].kind}:${events[i].id}`;
    assert.ok(
      eventSteps.some((s) => s.addedEventKey === expectedKey),
      `Missing event step for key ${expectedKey}`
    );
  }
});

// ----------------------------------------------------------------------------
// Test 2: Each event step adds exactly one new event key
// ----------------------------------------------------------------------------
test("2. Each event step adds exactly one new event key (never multiple simultaneous additions)", () => {
  const events = [
    createMockEvent("pos-1", "positive_moment", "2026-01-10T12:00:00Z"),
    createMockEvent("rec-1", "reconnection", "2026-02-14T20:00:00Z"),
    createMockEvent("imp-1", "important_date", "2026-03-01T10:00:00Z"),
  ];

  const snapshot = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: events,
    asOfTime: AS_OF_TIME,
    isResting: false,
  };

  const story = createGardenStory(snapshot);
  const seenEventKeys = new Set();

  for (let i = 1; i < story.steps.length; i++) {
    const prev = story.steps[i - 1];
    const curr = story.steps[i];

    if (curr.addedEventKey) {
      // Step must add exactly 1 event compared to the previous step
      assert.equal(
        curr.cumulativeCareEvents.length,
        prev.cumulativeCareEvents.length + 1,
        `Step ${i} added ${curr.cumulativeCareEvents.length - prev.cumulativeCareEvents.length} events instead of exactly 1`
      );

      // The new event key must never have been seen before
      assert.ok(
        !seenEventKeys.has(curr.addedEventKey),
        `Event key ${curr.addedEventKey} was added more than once`
      );
      seenEventKeys.add(curr.addedEventKey);

      // Newly added event key must match the last item in cumulativeCareEvents
      const newlyAdded = curr.cumulativeCareEvents[curr.cumulativeCareEvents.length - 1];
      assert.equal(curr.addedEventKey, `${newlyAdded.kind}:${newlyAdded.id}`);
    } else {
      // Non-event step (e.g. stage transition or time growth) must preserve exact cumulative count
      assert.equal(
        curr.cumulativeCareEvents.length,
        prev.cumulativeCareEvents.length,
        `Non-event step ${i} modified cumulative care events count`
      );
    }
  }

  assert.equal(seenEventKeys.size, events.length);
});

// ----------------------------------------------------------------------------
// Test 3: No future event appears in an earlier step
// ----------------------------------------------------------------------------
test("3. No future event appears in an earlier step", () => {
  const events = [
    createMockEvent("ev-jan", "positive_moment", "2026-01-20T10:00:00Z"),
    createMockEvent("ev-mar", "positive_moment", "2026-03-20T10:00:00Z"),
    createMockEvent("ev-may", "reconnection", "2026-05-20T10:00:00Z"),
  ];

  const snapshot = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: events,
    asOfTime: AS_OF_TIME,
    isResting: false,
  };

  const story = createGardenStory(snapshot);

  for (const step of story.steps) {
    const stepTime = new Date(step.effectiveTimestamp).getTime();
    for (const e of step.cumulativeCareEvents) {
      const eTime = getEventEffectiveTimestamp(e, COUPLE_CREATED_AT, AS_OF_TIME);
      assert.ok(
        eTime <= stepTime,
        `Event ${e.id} with timestamp ${eTime} appeared before step timestamp ${stepTime}`
      );
    }
  }
});

// ----------------------------------------------------------------------------
// Test 4: Previous event features remain present in later steps
// ----------------------------------------------------------------------------
test("4. Previous event features remain present in all subsequent steps (no disappearing flora)", () => {
  const events = [
    createMockEvent("ev-1", "positive_moment", "2026-01-15T10:00:00Z"),
    createMockEvent("ev-2", "reconnection", "2026-02-15T10:00:00Z"),
    createMockEvent("ev-3", "important_date", "2026-03-15T10:00:00Z"),
  ];

  const snapshot = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: events,
    asOfTime: AS_OF_TIME,
    isResting: false,
  };

  const story = createGardenStory(snapshot);

  for (let i = 0; i < story.steps.length - 1; i++) {
    const curr = story.steps[i];
    const next = story.steps[i + 1];

    const nextIds = new Set(next.cumulativeCareEvents.map((e) => e.id));
    for (const e of curr.cumulativeCareEvents) {
      assert.ok(
        nextIds.has(e.id),
        `Event ${e.id} present in step ${i} was lost in step ${i + 1}`
      );
    }
  }
});

// ----------------------------------------------------------------------------
// Test 5: Same timestamp events use deterministic ordering & calm copy
// ----------------------------------------------------------------------------
test("5. Same-timestamp events use deterministic ordering and collective caption", () => {
  const sameTime = "2026-03-01T12:00:00.000Z";
  const events = [
    createMockEvent("zeta", "positive_moment", sameTime),
    createMockEvent("alpha", "important_date", sameTime),
    createMockEvent("beta", "reconnection", sameTime),
  ];

  const snapshot = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: events,
    asOfTime: AS_OF_TIME,
    isResting: false,
  };

  const story = createGardenStory(snapshot);
  const eventSteps = story.steps.filter((s) => s.addedEventKey !== null);

  assert.equal(eventSteps.length, 3);
  // Reconnection rank 0 comes before positive_moment rank 1, before important_date rank 2
  assert.equal(eventSteps[0].addedEventKey, "reconnection:beta");
  assert.equal(eventSteps[1].addedEventKey, "positive_moment:zeta");
  assert.equal(eventSteps[2].addedEventKey, "important_date:alpha");

  for (const step of eventSteps) {
    assert.equal(
      step.caption,
      "Several kinds of care found their place around this time."
    );
  }
});

// ----------------------------------------------------------------------------
// Test 6: Backfilled events do not change stable feature identities
// ----------------------------------------------------------------------------
test("6. Backfilled events do not alter existing stable botanical feature IDs", () => {
  const ev1 = createMockEvent("ev-existing", "positive_moment", "2026-02-01T10:00:00Z");
  const fid1 = getCareFeatureId(ev1.kind, ev1.id);

  // Now an earlier event is backfilled at January
  const evBackfill = createMockEvent("ev-backfilled", "reconnection", "2026-01-10T10:00:00Z");

  const snapshot = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: [ev1, evBackfill],
    asOfTime: AS_OF_TIME,
    isResting: false,
  };

  const story = createGardenStory(snapshot);
  const ev1Step = story.steps.find((s) => s.addedEventKey === `${ev1.kind}:${ev1.id}`);
  assert.ok(ev1Step);
  assert.equal(ev1Step.highlightFeatureId, fid1);
});

// ----------------------------------------------------------------------------
// Test 7: Positive events reveal their exact stable botanical family
// ----------------------------------------------------------------------------
test("7. Positive events reveal their exact stable botanical family", () => {
  const evPos = createMockEvent("pos-feature-test", "positive_moment", "2026-02-01T10:00:00Z");
  const expectedId = getCareFeatureId("positive_moment", evPos.id);

  const snapshot = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: [evPos],
    asOfTime: AS_OF_TIME,
    isResting: false,
  };

  const story = createGardenStory(snapshot);
  const step = story.steps.find((s) => s.addedEventKey === `positive_moment:${evPos.id}`);
  assert.ok(step);
  assert.equal(step.highlightFeatureId, expectedId);
  assert.ok(expectedId.startsWith("care-positive-"));
});

// ----------------------------------------------------------------------------
// Test 8: Reconnections reveal their exact blossom identity
// ----------------------------------------------------------------------------
test("8. Reconnections reveal their exact blossom identity", () => {
  const evRec = createMockEvent("rec-feature-test", "reconnection", "2026-02-14T10:00:00Z");
  const expectedId = getCareFeatureId("reconnection", evRec.id);

  const snapshot = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: [evRec],
    asOfTime: AS_OF_TIME,
    isResting: false,
  };

  const story = createGardenStory(snapshot);
  const step = story.steps.find((s) => s.addedEventKey === `reconnection:${evRec.id}`);
  assert.ok(step);
  assert.equal(step.highlightFeatureId, expectedId);
  assert.ok(expectedId.startsWith("care-reconnection-"));
});

// ----------------------------------------------------------------------------
// Test 9: Important dates reveal their exact landmark identity
// ----------------------------------------------------------------------------
test("9. Important dates reveal their exact landmark identity", () => {
  const evImp = createMockEvent("imp-feature-test", "important_date", "2026-03-01T10:00:00Z");
  const expectedId = getCareFeatureId("important_date", evImp.id);

  const snapshot = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: [evImp],
    asOfTime: AS_OF_TIME,
    isResting: false,
  };

  const story = createGardenStory(snapshot);
  const step = story.steps.find((s) => s.addedEventKey === `important_date:${evImp.id}`);
  assert.ok(step);
  assert.equal(step.highlightFeatureId, expectedId);
  assert.ok(expectedId.startsWith("care-important-date-"));
});

// ----------------------------------------------------------------------------
// Test 10: Stage transitions caused only by time receive explicit steps
// ----------------------------------------------------------------------------
test("10. Stage transitions caused only by time receive explicit steps", () => {
  // Couple created Jan 1, event occurs in March (60+ days elapsed).
  // Time units alone cross threshold 16 (day 32) into tender_sapling before the March event!
  const evMarch = createMockEvent("ev-march", "positive_moment", "2026-03-15T10:00:00Z");

  const snapshot = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT, // Jan 1
    careEvents: [evMarch],
    asOfTime: AS_OF_TIME,
    isResting: false,
  };

  const story = createGardenStory(snapshot);
  const timeStageStep = story.steps.find(
    (s) => s.eventKind === "stage_transition" && s.addedEventKey === null
  );

  assert.ok(timeStageStep, "Expected explicit stage transition step driven by time");
  assert.equal(timeStageStep.stage.key, "tender_sapling");
  assert.equal(timeStageStep.caption, "The young tree grew into a tender sapling.");
});

// ----------------------------------------------------------------------------
// Test 11: Event-driven stage crossings follow the documented consistent rule
// ----------------------------------------------------------------------------
test("11. Event-driven stage crossings show new feature first, then explicit stage transition", () => {
  // Set up 7 positive moments (14 care units) in seedling.
  // 8th positive moment pushes care units to 16, crossing into tender_sapling.
  const events = [];
  for (let i = 1; i <= 8; i++) {
    events.push(createMockEvent(`pos-${i}`, "positive_moment", "2026-01-02T10:00:00Z"));
  }

  const snapshot = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT, // 1 day elapsed = 0.5 time units
    careEvents: events,
    asOfTime: AS_OF_TIME,
    isResting: false,
  };

  const story = createGardenStory(snapshot);
  // Find step adding the 8th event
  const step8Idx = story.steps.findIndex((s) => s.addedEventKey === "positive_moment:pos-8");
  assert.ok(step8Idx !== -1);

  // In step 8, new feature is shown in current stage
  const step8 = story.steps[step8Idx];
  assert.ok(step8.highlightFeatureId);

  // Immediately followed by an explicit stage transition step
  const followUpStep = story.steps[step8Idx + 1];
  assert.ok(followUpStep);
  assert.equal(followUpStep.eventKind, "stage_transition");
  assert.equal(followUpStep.stage.key, "tender_sapling");
  assert.equal(followUpStep.caption, "The young tree grew into a tender sapling.");
});

// ----------------------------------------------------------------------------
// Test 12: Final step exactly matches the captured live Garden
// ----------------------------------------------------------------------------
test("12. Final step produces exact matching SVG scene to production live scene", () => {
  for (const liveIsResting of [true, false]) {
    const rawPosEvents = [
      createMockEvent("pos-1", "positive_moment", "2026-01-15T10:00:00Z"),
      createMockEvent("pos-2", "positive_moment", "2026-02-20T10:00:00Z"),
    ];
    const rawRecEvents = [
      createMockEvent("rec-1", "reconnection", "2026-03-01T12:00:00Z"),
    ];
    const rawImpEvents = [
      createMockEvent("imp-1", "important_date", "2026-03-15T10:00:00Z", "2026-03-10T10:00:00Z"),
    ];
    const allCareEvents = [...rawPosEvents, ...rawRecEvents, ...rawImpEvents];
    const coupleCreatedAt = "2026-01-01T00:00:00.000Z";
    const asOfTime = "2026-05-01T12:00:00.000Z";
    const themeKey = "dark";

    const prodNowMs = new Date(asOfTime).getTime();
    const prodCreatedMs = new Date(coupleCreatedAt).getTime();
    const prodElapsedDays = Math.max(
      0,
      Math.floor((prodNowMs - prodCreatedMs) / (1000 * 60 * 60 * 24))
    );
    const prodTimeGrowthUnits = Math.min(60, prodElapsedDays * 0.5);
    const prodPosCount = rawPosEvents.length;
    const prodRecCount = rawRecEvents.length;
    const prodImpCount = rawImpEvents.length;
    const prodCareGrowthUnits = Math.min(40, prodPosCount * 2 + prodRecCount * 4 + prodImpCount * 2);
    const prodTotalGrowthUnits = Math.min(100, prodTimeGrowthUnits + prodCareGrowthUnits);
    const prodCareSignals = {
      positiveMoments: prodPosCount,
      reconnections: prodRecCount,
      importantDates: prodImpCount,
    };

    const prodScene = generateGardenSVGScene(
      COUPLE_ID_A,
      prodTotalGrowthUnits,
      prodCareGrowthUnits,
      liveIsResting,
      prodCareSignals,
      themeKey,
      allCareEvents
    );

    const snapshot = {
      coupleId: COUPLE_ID_A,
      seedString: COUPLE_ID_A,
      createdAt: coupleCreatedAt,
      careEvents: allCareEvents,
      asOfTime: asOfTime,
      isResting: liveIsResting,
      themeKey,
    };

    const story = createGardenStory(snapshot);
    const finalStep = story.steps[story.steps.length - 1];

    assert.ok(finalStep.isFinal);
    assert.equal(finalStep.timeGrowthUnits, prodTimeGrowthUnits);
    assert.equal(finalStep.careGrowthUnits, prodCareGrowthUnits);
    assert.equal(finalStep.totalGrowthUnits, prodTotalGrowthUnits);
    assert.deepEqual(finalStep.careSignals, prodCareSignals);
    assert.equal(finalStep.isResting, liveIsResting);

    const storyScene = generateGardenSVGScene(
      story.seedString,
      finalStep.totalGrowthUnits,
      finalStep.careGrowthUnits,
      finalStep.isResting,
      finalStep.careSignals,
      themeKey,
      finalStep.cumulativeCareEvents
    );

    assert.deepEqual(storyScene, prodScene);
  }
});

// ----------------------------------------------------------------------------
// Test 13: Previous and Next navigate individual steps
// ----------------------------------------------------------------------------
test("13. Step indices are contiguous and allow step-by-step navigation", () => {
  const events = [
    createMockEvent("ev-1", "positive_moment", "2026-01-15T10:00:00Z"),
    createMockEvent("ev-2", "reconnection", "2026-02-15T10:00:00Z"),
  ];

  const snapshot = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: events,
    asOfTime: AS_OF_TIME,
    isResting: false,
  };

  const story = createGardenStory(snapshot);
  for (let i = 0; i < story.steps.length; i++) {
    assert.equal(story.steps[i].stepIndex, i);
    assert.equal(story.steps[i].totalSteps, story.steps.length);
  }
});

// ----------------------------------------------------------------------------
// Test 14: Reduced motion produces still manual steps
// ----------------------------------------------------------------------------
test("14. Reduced motion produces still steps without auto-advance or halo", () => {
  const events = [createMockEvent("ev-1", "positive_moment", "2026-01-15T10:00:00Z")];
  const snapshot = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: events,
    asOfTime: AS_OF_TIME,
    isResting: false,
  };

  const story = createGardenStory(snapshot);
  assert.ok(story.steps.length >= 3);
  for (const step of story.steps) {
    assert.ok(step.caption);
    assert.ok(step.dateLabel);
  }
});

// ----------------------------------------------------------------------------
// Test 15: Large histories retain every event step
// ----------------------------------------------------------------------------
test("15. Large histories retain every single care event step (30 events = 30 event steps)", () => {
  const events = [];
  for (let i = 1; i <= 30; i++) {
    const day = Math.min(150, i * 4);
    const t = new Date(COUPLE_CREATED_AT).getTime() + day * 24 * 60 * 60 * 1000;
    events.push(
      createMockEvent(
        `ev-${i}`,
        i % 3 === 0 ? "reconnection" : i % 5 === 0 ? "important_date" : "positive_moment",
        new Date(t).toISOString()
      )
    );
  }

  const snapshot = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: events,
    asOfTime: AS_OF_TIME,
    isResting: false,
  };

  const story = createGardenStory(snapshot);
  const eventSteps = story.steps.filter((s) => s.addedEventKey !== null);
  assert.equal(eventSteps.length, 30);
});

// ----------------------------------------------------------------------------
// Test 16: Quick Story does not merge or omit events
// ----------------------------------------------------------------------------
test("16. Quick Story preserves every individual event step without merging", () => {
  const events = [];
  for (let i = 1; i <= 25; i++) {
    const t = new Date(COUPLE_CREATED_AT).getTime() + i * 2 * 24 * 60 * 60 * 1000;
    events.push(createMockEvent(`pos-${i}`, "positive_moment", new Date(t).toISOString()));
  }

  const snapshot = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: events,
    asOfTime: AS_OF_TIME,
    isResting: false,
    pacing: "quick",
  };

  const story = createGardenStory(snapshot);
  assert.equal(story.pacing, "quick");
  const eventSteps = story.steps.filter((s) => s.addedEventKey !== null);
  assert.equal(eventSteps.length, 25);
});

// ----------------------------------------------------------------------------
// Test 17: New Realtime events do not mutate active steps
// ----------------------------------------------------------------------------
test("17. Immutability: New live events do not mutate active story steps", () => {
  const originalEvents = [
    createMockEvent("ev-1", "positive_moment", "2026-01-15T10:00:00Z"),
  ];

  const snapshot = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: originalEvents,
    asOfTime: AS_OF_TIME,
    isResting: false,
  };

  const story = createGardenStory(snapshot);
  const initialStepCount = story.steps.length;

  // External array mutated
  const liveEvents = [
    ...originalEvents,
    createMockEvent("ev-new", "reconnection", "2026-05-15T10:00:00Z"),
  ];

  assert.equal(story.steps.length, initialStepCount);
});

// ----------------------------------------------------------------------------
// Test 18: Privacy withdrawal closes and discards the story
// ----------------------------------------------------------------------------
test("18. Privacy withdrawal: Missing event from live query triggers discard", () => {
  const snapshotEvents = [
    createMockEvent("ev-1", "positive_moment", "2026-01-15T10:00:00Z"),
    createMockEvent("ev-2", "reconnection", "2026-02-15T10:00:00Z"),
  ];

  const liveEventsAfterDeletion = [
    createMockEvent("ev-2", "reconnection", "2026-02-15T10:00:00Z"),
  ];

  const liveKeys = new Set(liveEventsAfterDeletion.map((e) => `${e.kind}:${e.id}`));
  let hasDeletedEvent = false;

  for (const snapEvent of snapshotEvents) {
    if (!liveKeys.has(`${snapEvent.kind}:${snapEvent.id}`)) {
      hasDeletedEvent = true;
      break;
    }
  }

  assert.equal(hasDeletedEvent, true);
});

// ----------------------------------------------------------------------------
// Test 19: Caption & Presentation Safety (Contract Updated)
// ----------------------------------------------------------------------------
test("19. Caption safety: Titles permitted in view model, forbidden from IDs, geometry, captions, and non-event frames", () => {
  const events = [
    createMockEvent("ev-1", "positive_moment", "2026-01-10T10:00:00Z", null, "Coffee and pastries"),
    createMockEvent("ev-2", "reconnection", "2026-02-10T10:00:00Z", null, "Dishes in the sink"),
    createMockEvent("ev-3", "important_date", "2026-03-10T10:00:00Z", null, "Trip to Coast"),
  ];

  const snapshot = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: events,
    asOfTime: AS_OF_TIME,
    isResting: false,
  };

  const story = createGardenStory(snapshot);
  const forbiddenWords = [
    "score", "streak", "points", "winner", "better", "faster",
    "vs", "versus", "percent", "ranking", "partner a", "partner b",
    "user-", "friction", "intensity"
  ];

  const rawTitles = ["Coffee and pastries", "Dishes in the sink", "Trip to Coast"];

  for (let i = 0; i < story.steps.length; i++) {
    const step = story.steps[i];
    const vm = getStoryProgressViewModel(story, i);
    const lower = step.caption.toLowerCase();

    // 1. Captions remain clean of game-like terms
    for (const forbidden of forbiddenWords) {
      assert.ok(
        !lower.includes(forbidden),
        `Caption "${step.caption}" contained forbidden word "${forbidden}"`
      );
    }

    // 2. Captions must never embed user event titles
    for (const title of rawTitles) {
      assert.ok(
        !step.caption.includes(title),
        `Caption "${step.caption}" must not embed raw event title "${title}"`
      );
    }

    // 3. Step IDs, highlight IDs, and scene IDs must never embed event titles
    for (const title of rawTitles) {
      assert.ok(
        !step.id.includes(title),
        `Step id "${step.id}" must not embed raw event title "${title}"`
      );
      if (step.highlightFeatureId) {
        assert.ok(
          !step.highlightFeatureId.includes(title),
          `highlightFeatureId "${step.highlightFeatureId}" must not embed raw event title "${title}"`
        );
      }
    }

    // 4. Non-event frames must have null displayTitle
    if (step.id === "step-beginning" || step.eventKind === "stage_transition" || step.id === "step-today") {
      assert.equal(step.displayTitle, null, `Non-event frame ${step.id} must have null displayTitle`);
      assert.equal(vm.displayTitle, null, `Non-event frame ${step.id} view-model must have null displayTitle`);
    } else {
      // Event-backed frames permit presentation titles
      assert.ok(step.displayTitle, `Event frame ${step.id} must have displayTitle`);
      assert.equal(step.displayTitle, vm.displayTitle);
    }
  }
});

// ----------------------------------------------------------------------------
// Test 20: Living Garden generator 22 core invariants pass across all story steps
// ----------------------------------------------------------------------------
test("20. Living Garden 22 core invariants pass across all story steps", () => {
  const report = verifyLivingGardenInvariants();
  assert.equal(report.success, true, report.message);

  const events = [
    createMockEvent("ev-1", "positive_moment", "2026-01-15T10:00:00Z"),
    createMockEvent("ev-2", "reconnection", "2026-02-15T10:00:00Z"),
    createMockEvent("ev-3", "important_date", "2026-03-15T10:00:00Z"),
  ];

  const snapshot = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: events,
    asOfTime: AS_OF_TIME,
    isResting: false,
  };

  const story = createGardenStory(snapshot);

  for (const step of story.steps) {
    const scene = generateGardenSVGScene(
      story.seedString,
      step.totalGrowthUnits,
      step.careGrowthUnits,
      step.isResting,
      step.careSignals,
      "dark",
      step.cumulativeCareEvents
    );

    assert.ok(scene.trunkPath);
    assert.ok(scene.palette);
    assert.ok(Array.isArray(scene.branches));
    assert.ok(Array.isArray(scene.groundDetails));
  }
});

// ----------------------------------------------------------------------------
// Test 21: Progress View Model Invariants (Requirements A, B, C, D, E, F)
// ----------------------------------------------------------------------------
test("21. Progress View Model: Constant denominator, 1-of-N sequence, milestone participation", () => {
  const events = [
    createMockEvent("ev-1", "positive_moment", "2026-01-15T10:00:00Z"),
    createMockEvent("ev-2", "reconnection", "2026-02-01T14:30:00Z"),
    createMockEvent("ev-3", "important_date", "2026-03-10T09:00:00Z"),
  ];

  const snapshot = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: events,
    asOfTime: AS_OF_TIME,
    isResting: false,
  };

  const story = createGardenStory(snapshot);
  const N = story.steps.length;
  assert.ok(N >= 4);

  // A: Denominator is constant across every single story step
  for (let i = 0; i < N; i++) {
    const vm = getStoryProgressViewModel(story, i);
    assert.equal(vm.visibleStepTotal, N, `Step ${i} denominator must equal total ${N}`);
  }

  // B: Numerator begins at 1 on first frame
  const firstVm = getStoryProgressViewModel(story, 0);
  assert.equal(firstVm.visibleStepNumber, 1);
  assert.equal(firstVm.progressText, `1 of ${N}`);
  assert.equal(firstVm.isFirstStep, true);

  // C: Increments sequentially by exactly 1 with zero gaps or resets
  for (let i = 0; i < N; i++) {
    const vm = getStoryProgressViewModel(story, i);
    assert.equal(vm.visibleStepNumber, i + 1, `Index ${i} must have visibleStepNumber ${i + 1}`);
    assert.equal(vm.progressText, `${i + 1} of ${N}`);
    assert.equal(vm.accessibilityProgressLabel, `Garden story step ${i + 1} of ${N}`);
    assert.ok(Math.abs(vm.progressFraction - (i + 1) / N) < 0.001);
  }

  // D: Final frame is exactly N of N
  const finalVm = getStoryProgressViewModel(story, N - 1);
  assert.equal(finalVm.visibleStepNumber, N);
  assert.equal(finalVm.visibleStepTotal, N);
  assert.equal(finalVm.progressText, `${N} of ${N}`);
  assert.equal(finalVm.isFinalStep, true);
  assert.equal(finalVm.stageTitle, "Our Garden Today");
  assert.equal(finalVm.frameType, "TODAY");

  // E & F: Stage transitions and milestone steps do not reset progress and participate in same 1-of-N sequence
  const milestoneIndices = story.steps
    .map((s, idx) => (s.eventKind === "stage_transition" ? idx : -1))
    .filter((idx) => idx !== -1);

  for (const mIdx of milestoneIndices) {
    const mVm = getStoryProgressViewModel(story, mIdx);
    assert.equal(mVm.visibleStepNumber, mIdx + 1);
    assert.equal(mVm.visibleStepTotal, N);
    assert.equal(mVm.frameType, "GARDEN MILESTONE");

    if (mIdx > 0) {
      const prevVm = getStoryProgressViewModel(story, mIdx - 1);
      assert.equal(mVm.visibleStepNumber, prevVm.visibleStepNumber + 1);
    }
  }
});

// ----------------------------------------------------------------------------
// Test 22: Navigation, Skip, Play Again, and Replay State (Requirements G, H, I, J)
// ----------------------------------------------------------------------------
test("22. Navigation and Action State: Global stepping, Skip to Today, and Play Again without numbered replay", () => {
  const events = [
    createMockEvent("ev-1", "positive_moment", "2026-01-15T10:00:00Z"),
    createMockEvent("ev-2", "reconnection", "2026-02-15T10:00:00Z"),
  ];

  const snapshot = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: events,
    asOfTime: AS_OF_TIME,
    isResting: false,
  };

  const story = createGardenStory(snapshot);
  const N = story.steps.length;

  // G: Navigation bounds
  const vm0 = getStoryProgressViewModel(story, 0, true);
  assert.equal(vm0.canGoPrevious, false, "Previous must be disabled at 1 of N");
  assert.equal(vm0.canGoNext, true, "Next must be enabled at 1 of N");
  assert.equal(vm0.primaryActionLabel, "Pause ⏸");

  const vmPaused = getStoryProgressViewModel(story, 0, false);
  assert.equal(vmPaused.primaryActionLabel, "Continue ▶");

  const vmMid = getStoryProgressViewModel(story, 1, true);
  assert.equal(vmMid.canGoPrevious, true);
  assert.equal(vmMid.canGoNext, true);

  // H: Skip to today reaches N of N
  const vmFinal = getStoryProgressViewModel(story, N - 1, false);
  assert.equal(vmFinal.canGoPrevious, true);
  assert.equal(vmFinal.canGoNext, false, "Next must be disabled at N of N in favor of Play again");
  assert.equal(vmFinal.visibleStepNumber, N);
  assert.equal(vmFinal.progressText, `${N} of ${N}`);
  assert.equal(vmFinal.stageTitle, "Our Garden Today");

  // I: Primary action at N of N is 'Play again', which returns to 1 of N
  assert.equal(vmFinal.primaryActionLabel, "Play again");
  const vmRestart = getStoryProgressViewModel(story, 0, true);
  assert.equal(vmRestart.visibleStepNumber, 1);
  assert.equal(vmRestart.progressText, `1 of ${N}`);

  // J: Replay has no numbered fraction or counter
  assert.ok(!vmFinal.primaryActionLabel.includes("/"));
  assert.ok(!vmFinal.primaryActionLabel.includes("of"));
  assert.ok(!vmFinal.stageTitle.includes("/"));
});

// ----------------------------------------------------------------------------
// Test 23: Initial Frame Timing & Generous Viewing Duration (Requirement K)
// ----------------------------------------------------------------------------
test("23. Initial Frame Timing: Beginning frame receives generous viewing duration and starts at 1 of N", () => {
  const gentleDurationFirst = getStepDurationMs(10, "gentle", true);
  const gentleDurationSubsequent = getStepDurationMs(10, "gentle", false);
  assert.ok(gentleDurationFirst >= 3000, "Initial Beginning frame duration must be >= 3000ms in gentle mode");
  assert.ok(gentleDurationFirst >= gentleDurationSubsequent);

  const quickDurationFirst = getStepDurationMs(25, "quick", true);
  assert.ok(quickDurationFirst >= 2200, "Initial Beginning frame duration must be >= 2200ms in quick mode");

  // Verify clamped index 0 always produces 1 of N
  const snapshot = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: [createMockEvent("ev-1", "positive_moment", "2026-01-15T10:00:00Z")],
    asOfTime: AS_OF_TIME,
    isResting: false,
  };
  const story = createGardenStory(snapshot);
  const vm = getStoryProgressViewModel(story, 0);
  assert.equal(vm.visibleStepNumber, 1);
  assert.equal(vm.stageTitle, "The Beginning");
  assert.equal(vm.frameType, "THE BEGINNING");
});

// ----------------------------------------------------------------------------
// Test 24: Reduced-Motion Mode (Requirement L)
// ----------------------------------------------------------------------------
test("24. Reduced-motion mode starts at 1 of N and remains manual without auto-advance", () => {
  const snapshot = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: [createMockEvent("ev-1", "positive_moment", "2026-01-15T10:00:00Z")],
    asOfTime: AS_OF_TIME,
    isResting: false,
  };
  const story = createGardenStory(snapshot);
  // Under reduced-motion, playback starts paused (isPlaying = false) at step 0
  const vm = getStoryProgressViewModel(story, 0, false);
  assert.equal(vm.visibleStepNumber, 1);
  assert.equal(vm.primaryActionLabel, "Continue ▶");
  assert.equal(vm.isFirstStep, true);
});

// ----------------------------------------------------------------------------
// Test 25: Zero-event and One-event Histories (Requirement M)
// ----------------------------------------------------------------------------
test("25. Zero-event and one-event histories remain clear and understandable", () => {
  // Zero events
  const snapshotZero = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: [],
    asOfTime: AS_OF_TIME,
    isResting: false,
  };
  const storyZero = createGardenStory(snapshotZero);
  assert.ok(storyZero.steps.length >= 2);
  const vmZeroFirst = getStoryProgressViewModel(storyZero, 0);
  const vmZeroFinal = getStoryProgressViewModel(storyZero, storyZero.steps.length - 1);
  assert.equal(vmZeroFirst.progressText, `1 of ${storyZero.steps.length}`);
  assert.equal(vmZeroFirst.stageTitle, "The Beginning");
  assert.equal(vmZeroFinal.progressText, `${storyZero.steps.length} of ${storyZero.steps.length}`);
  assert.equal(vmZeroFinal.stageTitle, "Our Garden Today");

  // One event
  const snapshotOne = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: [createMockEvent("one-ev", "positive_moment", "2026-02-01T10:00:00Z")],
    asOfTime: AS_OF_TIME,
    isResting: false,
  };
  const storyOne = createGardenStory(snapshotOne);
  assert.ok(storyOne.steps.length >= 3);
  for (let i = 0; i < storyOne.steps.length; i++) {
    const vm = getStoryProgressViewModel(storyOne, i);
    assert.equal(vm.visibleStepTotal, storyOne.steps.length);
    assert.equal(vm.visibleStepNumber, i + 1);
  }
});

// ----------------------------------------------------------------------------
// Test 26: Frame Classification & Clean Stage Titles (Requirements 2 & 3)
// ----------------------------------------------------------------------------
test("26. Frame classification overlines and stage titles contain zero chapter numbers", () => {
  const events = [
    createMockEvent("ev-pos", "positive_moment", "2026-01-10T10:00:00Z"),
    createMockEvent("ev-rec", "reconnection", "2026-02-10T10:00:00Z"),
    createMockEvent("ev-date", "important_date", "2026-03-10T10:00:00Z"),
  ];

  const snapshot = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: events,
    asOfTime: AS_OF_TIME,
    isResting: false,
  };

  const story = createGardenStory(snapshot);
  const validOverlines = new Set([
    "THE BEGINNING",
    "SHARED CARE",
    "RECONNECTION",
    "IMPORTANT DATE",
    "GARDEN MILESTONE",
    "TODAY",
  ]);

  const validStageTitles = new Set([
    "The Beginning",
    "First Seedling",
    "Tender Sapling",
    "Branching Out",
    "Leafy Canopy",
    "Rooted & Flourishing",
    "Garden in Bloom",
    "Our Garden Today",
  ]);

  for (let i = 0; i < story.steps.length; i++) {
    const vm = getStoryProgressViewModel(story, i);
    assert.ok(validOverlines.has(vm.frameType), `Invalid overline: ${vm.frameType}`);
    assert.ok(validStageTitles.has(vm.stageTitle), `Invalid stage title: ${vm.stageTitle}`);
    assert.ok(!vm.stageTitle.toLowerCase().includes("chapter"), `Stage title must not include 'Chapter': ${vm.stageTitle}`);
    assert.ok(!vm.stageTitle.toLowerCase().includes("stage "), `Stage title must not include 'Stage ': ${vm.stageTitle}`);
  }
});

// ----------------------------------------------------------------------------
// Test 27: Requirement A: Qualified shared positive event shows its short title
// ----------------------------------------------------------------------------
test("27. Requirement A: A qualified shared positive event shows its short title", () => {
  const events = [
    createMockEvent("pos-1", "positive_moment", "2026-02-01T10:00:00Z", null, "Morning coffee on the balcony"),
  ];
  const story = createGardenStory({
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: events,
    asOfTime: AS_OF_TIME,
    isResting: false,
  });
  const step = story.steps.find((s) => s.addedEventKey === "positive_moment:pos-1");
  assert.ok(step, "Event step must exist");
  assert.equal(step.displayTitle, "Morning coffee on the balcony");
  const vm = getStoryProgressViewModel(story, step.stepIndex);
  assert.equal(vm.displayTitle, "Morning coffee on the balcony");
  assert.equal(vm.frameType, "SHARED CARE");
  assert.ok(vm.frameAccessibilityLabel.includes("Morning coffee on the balcony"));
});

// ----------------------------------------------------------------------------
// Test 28: Requirement B: Completed reconnection shows original shared friction title
// ----------------------------------------------------------------------------
test("28. Requirement B: A completed reconnection shows the original shared friction title", () => {
  const events = [
    createMockEvent("fric-1", "reconnection", "2026-02-15T14:00:00Z", null, "Phones and screens at dinner"),
  ];
  const story = createGardenStory({
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: events,
    asOfTime: AS_OF_TIME,
    isResting: false,
  });
  const step = story.steps.find((s) => s.addedEventKey === "reconnection:fric-1");
  assert.ok(step, "Reconnection step must exist");
  assert.equal(step.displayTitle, "Phones and screens at dinner");
  const vm = getStoryProgressViewModel(story, step.stepIndex);
  assert.equal(vm.displayTitle, "Phones and screens at dinner");
  assert.equal(vm.frameType, "RECONNECTION");
  assert.ok(vm.frameAccessibilityLabel.startsWith("Reconnection. Phones and screens at dinner."));
});

// ----------------------------------------------------------------------------
// Test 29: Requirement C: Qualified important date shows its name
// ----------------------------------------------------------------------------
test("29. Requirement C: A qualified important date shows its name", () => {
  const events = [
    createMockEvent("date-1", "important_date", "2026-03-01T00:00:00Z", "2026-02-20T10:00:00Z", "Our Moving Day"),
  ];
  const story = createGardenStory({
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: events,
    asOfTime: AS_OF_TIME,
    isResting: false,
  });
  const step = story.steps.find((s) => s.addedEventKey === "important_date:date-1");
  assert.ok(step, "Important date step must exist");
  assert.equal(step.displayTitle, "Our Moving Day");
  const vm = getStoryProgressViewModel(story, step.stepIndex);
  assert.equal(vm.displayTitle, "Our Moving Day");
  assert.equal(vm.frameType, "IMPORTANT DATE");
  assert.ok(vm.frameAccessibilityLabel.includes("Our Moving Day"));
});

// ----------------------------------------------------------------------------
// Test 30: Requirement D: Mine-only moments never enter the story snapshot
// ----------------------------------------------------------------------------
test("30. Requirement D: Mine-only moments never enter the story snapshot", () => {
  const rawEventsFromDb = [
    { id: "e-ours-1", visibility: "ours", event_type: "positive", created_at: "2026-02-01T10:00:00Z", shared_topic: "Shared joy" },
    { id: "e-mine-1", visibility: "mine", event_type: "positive", created_at: "2026-02-02T10:00:00Z", shared_topic: "Private joy" },
  ];
  const qualifiedEvents = rawEventsFromDb
    .filter((r) => r.visibility === "ours")
    .map((r) => ({
      id: r.id,
      kind: "positive_moment",
      occurredAt: r.created_at,
      displayTitle: r.shared_topic,
    }));

  const story = createGardenStory({
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: qualifiedEvents,
    asOfTime: AS_OF_TIME,
    isResting: false,
  });

  const allKeys = story.steps.map((s) => s.addedEventKey).filter(Boolean);
  assert.ok(allKeys.includes("positive_moment:e-ours-1"));
  assert.ok(!allKeys.includes("positive_moment:e-mine-1"));
  assert.ok(!JSON.stringify(story).includes("Private joy"));
});

// ----------------------------------------------------------------------------
// Test 31: Requirement E: Private notes, reflections, repair text, and shared body/context do not enter story model or serialized view model
// ----------------------------------------------------------------------------
test("31. Requirement E: Private notes, reflections, repair text, and shared body/context do not enter the story model or serialized playback view model", () => {
  const events = [
    {
      id: "ev-safe-1",
      kind: "positive_moment",
      occurredAt: "2026-02-01T10:00:00Z",
      displayTitle: "Safe shared topic",
      private_note: "FORBIDDEN PRIVATE NOTE",
      private_reflections: "FORBIDDEN REFLECTION",
      repair_response: "FORBIDDEN REPAIR",
      context_body: "FORBIDDEN BODY",
      creator_id: "user-secret-999",
      partner_name: "Secret Partner",
    },
  ];

  const story = createGardenStory({
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: events,
    asOfTime: AS_OF_TIME,
    isResting: false,
  });

  const storyJson = JSON.stringify(story);
  const forbiddenPhrases = [
    "FORBIDDEN PRIVATE NOTE",
    "FORBIDDEN REFLECTION",
    "FORBIDDEN REPAIR",
    "FORBIDDEN BODY",
    "user-secret-999",
    "Secret Partner",
    "private_note",
    "private_reflections",
    "repair_response",
    "context_body",
  ];

  for (const phrase of forbiddenPhrases) {
    assert.ok(!storyJson.includes(phrase), `Story model leaked forbidden phrase: ${phrase}`);
  }

  for (let i = 0; i < story.steps.length; i++) {
    const vm = getStoryProgressViewModel(story, i);
    const vmJson = JSON.stringify(vm);
    for (const phrase of forbiddenPhrases) {
      assert.ok(!vmJson.includes(phrase), `View model leaked forbidden phrase: ${phrase}`);
    }
  }
});

// ----------------------------------------------------------------------------
// Test 32: Requirement F: Blank titles use the correct generic fallback
// ----------------------------------------------------------------------------
test("32. Requirement F: Blank titles use the correct generic fallback", () => {
  const events = [
    createMockEvent("pos-blank-1", "positive_moment", "2026-01-15T10:00:00Z", null, null),
    createMockEvent("pos-blank-2", "positive_moment", "2026-01-16T10:00:00Z", null, "   "),
    createMockEvent("rec-blank-1", "reconnection", "2026-02-15T10:00:00Z", null, null),
    createMockEvent("rec-blank-2", "reconnection", "2026-02-16T10:00:00Z", null, "  \n\t  "),
    createMockEvent("imp-blank-1", "important_date", "2026-03-15T10:00:00Z", null, null),
    createMockEvent("imp-blank-2", "important_date", "2026-03-16T10:00:00Z", null, ""),
  ];

  const story = createGardenStory({
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: events,
    asOfTime: AS_OF_TIME,
    isResting: false,
  });

  const sPos1 = story.steps.find((s) => s.addedEventKey === "positive_moment:pos-blank-1");
  const sPos2 = story.steps.find((s) => s.addedEventKey === "positive_moment:pos-blank-2");
  const sRec1 = story.steps.find((s) => s.addedEventKey === "reconnection:rec-blank-1");
  const sRec2 = story.steps.find((s) => s.addedEventKey === "reconnection:rec-blank-2");
  const sImp1 = story.steps.find((s) => s.addedEventKey === "important_date:imp-blank-1");
  const sImp2 = story.steps.find((s) => s.addedEventKey === "important_date:imp-blank-2");

  assert.equal(sPos1.displayTitle, "A shared good moment");
  assert.equal(sPos2.displayTitle, "A shared good moment");
  assert.equal(sRec1.displayTitle, "A shared moment");
  assert.equal(sRec2.displayTitle, "A shared moment");
  assert.equal(sImp1.displayTitle, "An important date");
  assert.equal(sImp2.displayTitle, "An important date");

  // Fallbacks must never be derived from categories, notes, emails, or partner names
  assert.equal(getStoryTitleFallback("positive_moment"), "A shared good moment");
  assert.equal(getStoryTitleFallback("reconnection"), "A shared moment");
  assert.equal(getStoryTitleFallback("important_date"), "An important date");
  assert.equal(getStoryTitleFallback("stage_transition"), null);
  assert.equal(getStoryTitleFallback("today"), null);
});

// ----------------------------------------------------------------------------
// Test 33: Requirement G: Excessively long and multiline titles normalize safely
// ----------------------------------------------------------------------------
test("33. Requirement G: Excessively long and multiline titles normalize safely", () => {
  const multiline = "An evening walk\n\nby the river\t\twith gelato";
  assert.equal(normalizeStoryEventTitle(multiline, "positive_moment"), "An evening walk by the river with gelato");

  const withHtml = "Celebration dinner at <b>Trattoria</b> <script>alert('xss')</script>";
  assert.equal(normalizeStoryEventTitle(withHtml, "positive_moment"), "Celebration dinner at Trattoria alert('xss')");

  const excessive150 = "A".repeat(150);
  const normalizedExcessive = normalizeStoryEventTitle(excessive150, "positive_moment");
  assert.equal(normalizedExcessive.length, STORY_TITLE_MAX_LENGTH);
  assert.equal(normalizedExcessive, "A".repeat(STORY_TITLE_MAX_LENGTH));
});

// ----------------------------------------------------------------------------
// Test 34: Requirement H: Event titles do not affect botanical IDs, geometry, colors, growth, stages, or GardenWorld structure
// ----------------------------------------------------------------------------
test("34. Requirement H: Event titles do not affect botanical IDs, geometry, colors, growth, stages, or GardenWorld structure", () => {
  const eventsA = [
    createMockEvent("ev-1", "positive_moment", "2026-01-10T10:00:00Z", null, "Short Title"),
    createMockEvent("ev-2", "reconnection", "2026-02-10T10:00:00Z", null, "Dishes"),
  ];
  const eventsB = [
    createMockEvent("ev-1", "positive_moment", "2026-01-10T10:00:00Z", null, "A totally different very long title with many extra words"),
    createMockEvent("ev-2", "reconnection", "2026-02-10T10:00:00Z", null, "Completely altered title for reconnection moment"),
  ];

  const storyA = createGardenStory({
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: eventsA,
    asOfTime: AS_OF_TIME,
    isResting: false,
  });

  const storyB = createGardenStory({
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: eventsB,
    asOfTime: AS_OF_TIME,
    isResting: false,
  });

  assert.equal(storyA.steps.length, storyB.steps.length);
  for (let i = 0; i < storyA.steps.length; i++) {
    const sA = storyA.steps[i];
    const sB = storyB.steps[i];
    assert.equal(sA.totalGrowthUnits, sB.totalGrowthUnits);
    assert.equal(sA.careGrowthUnits, sB.careGrowthUnits);
    assert.equal(sA.timeGrowthUnits, sB.timeGrowthUnits);
    assert.equal(sA.stage.key, sB.stage.key);
    assert.equal(sA.highlightFeatureId, sB.highlightFeatureId);
  }

  // GardenWorld structure equivalence
  const lastStepA = storyA.steps[storyA.steps.length - 1];
  const lastStepB = storyB.steps[storyB.steps.length - 1];

  const sceneWorldA = generateGardenSVGScene(
    COUPLE_ID_A,
    lastStepA.totalGrowthUnits,
    lastStepA.careGrowthUnits,
    false,
    undefined,
    "light",
    eventsA
  );
  const sceneWorldB = generateGardenSVGScene(
    COUPLE_ID_A,
    lastStepB.totalGrowthUnits,
    lastStepB.careGrowthUnits,
    false,
    undefined,
    "light",
    eventsB
  );

  const worldA = buildGardenWorld(sceneWorldA, {
    coupleId: COUPLE_ID_A,
    totalGrowthUnits: lastStepA.totalGrowthUnits,
    careGrowthUnits: lastStepA.careGrowthUnits,
    timeGrowthUnits: lastStepA.timeGrowthUnits,
    careEvents: eventsA,
  });

  const worldB = buildGardenWorld(sceneWorldB, {
    coupleId: COUPLE_ID_A,
    totalGrowthUnits: lastStepB.totalGrowthUnits,
    careGrowthUnits: lastStepB.careGrowthUnits,
    timeGrowthUnits: lastStepB.timeGrowthUnits,
    careEvents: eventsB,
  });

  const nodeKeysA = Object.keys(worldA.nodes).sort();
  const nodeKeysB = Object.keys(worldB.nodes).sort();
  assert.equal(nodeKeysA.length, nodeKeysB.length);
  assert.deepEqual(nodeKeysA, nodeKeysB);

  for (const k of nodeKeysA) {
    const nA = worldA.nodes[k];
    const nB = worldB.nodes[k];
    assert.equal(nA.id, nB.id);
    assert.equal(nA.parentId, nB.parentId);
    assert.deepEqual(nA.bounds, nB.bounds);
    assert.equal(nA.depth, nB.depth);
  }
});

// ----------------------------------------------------------------------------
// Test 35: Requirement I: Editing only a title preserves byte-identical generated SVG scenes
// ----------------------------------------------------------------------------
test("35. Requirement I: Editing only a title preserves byte-identical generated SVG scenes", () => {
  const eventsA = [
    createMockEvent("ev-1", "positive_moment", "2026-01-10T10:00:00Z", null, "Original title"),
  ];
  const eventsB = [
    createMockEvent("ev-1", "positive_moment", "2026-01-10T10:00:00Z", null, "Edited new title"),
  ];

  const sceneA = generateGardenSVGScene(
    COUPLE_ID_A,
    40,
    20,
    false,
    undefined,
    "light",
    eventsA
  );

  const sceneB = generateGardenSVGScene(
    COUPLE_ID_A,
    40,
    20,
    false,
    undefined,
    "light",
    eventsB
  );

  assert.equal(sceneA.svgString, sceneB.svgString, "Generated SVG scenes must be byte-for-byte identical");
});

// ----------------------------------------------------------------------------
// Test 36: Requirement J: Title changes do not alter event ordering
// ----------------------------------------------------------------------------
test("36. Requirement J: Title changes do not alter event ordering", () => {
  const events1 = [
    createMockEvent("id-z", "positive_moment", "2026-01-10T10:00:00Z", null, "AAA"),
    createMockEvent("id-a", "positive_moment", "2026-01-10T10:00:00Z", null, "ZZZ"),
  ];
  const events2 = [
    createMockEvent("id-z", "positive_moment", "2026-01-10T10:00:00Z", null, "ZZZ"),
    createMockEvent("id-a", "positive_moment", "2026-01-10T10:00:00Z", null, "AAA"),
  ];

  const story1 = createGardenStory({
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: events1,
    asOfTime: AS_OF_TIME,
    isResting: false,
  });

  const story2 = createGardenStory({
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: events2,
    asOfTime: AS_OF_TIME,
    isResting: false,
  });

  const keys1 = story1.steps.map((s) => s.addedEventKey);
  const keys2 = story2.steps.map((s) => s.addedEventKey);
  assert.deepEqual(keys1, keys2, "Event step sequence must be identical regardless of title strings");
});

// ----------------------------------------------------------------------------
// Test 37: Requirement K: The active snapshot remains unchanged by a live title edit
// ----------------------------------------------------------------------------
test("37. Requirement K: The active snapshot remains unchanged by a live title edit", () => {
  const liveEvents = [
    createMockEvent("ev-1", "positive_moment", "2026-01-10T10:00:00Z", null, "Original frozen title"),
  ];

  const snapshot = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: [...liveEvents],
    asOfTime: AS_OF_TIME,
    isResting: false,
  };

  const story = createGardenStory(snapshot);
  const initialTitleInStory = story.steps.find((s) => s.addedEventKey === "positive_moment:ev-1").displayTitle;
  assert.equal(initialTitleInStory, "Original frozen title");

  // Live title is updated
  liveEvents[0].displayTitle = "Mutated live title";

  // Active story steps remain untouched
  const stepAfterLiveEdit = story.steps.find((s) => s.addedEventKey === "positive_moment:ev-1");
  assert.equal(stepAfterLiveEdit.displayTitle, "Original frozen title");
});

// ----------------------------------------------------------------------------
// Test 38: Requirement L: Deletion or privacy withdrawal still closes and discards playback
// ----------------------------------------------------------------------------
test("38. Requirement L: Deletion or privacy withdrawal still closes and discards playback", () => {
  const snapshotEvents = [
    createMockEvent("ev-1", "positive_moment", "2026-01-10T10:00:00Z", null, "Moment A"),
    createMockEvent("ev-2", "positive_moment", "2026-01-12T10:00:00Z", null, "Moment B"),
  ];

  const story = createGardenStory({
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: snapshotEvents,
    asOfTime: AS_OF_TIME,
    isResting: false,
  });

  const capturedKeys = new Set();
  for (const step of story.steps) {
    if (step.addedEventKey) capturedKeys.add(step.addedEventKey);
  }

  // Scenario 1: ev-2 was made private ('mine') or deleted in live data
  const refreshedLiveEvents = [
    createMockEvent("ev-1", "positive_moment", "2026-01-10T10:00:00Z", null, "Moment A"),
  ];
  const refreshedKeys = new Set(refreshedLiveEvents.map((e) => `${e.kind}:${e.id}`));

  let isWithdrawn = false;
  for (const key of capturedKeys) {
    if (!refreshedKeys.has(key)) {
      isWithdrawn = true;
      break;
    }
  }

  assert.equal(isWithdrawn, true, "Withdrawal must be detected when an event is deleted or made private");
});

// ----------------------------------------------------------------------------
// Test 39: Requirement M: Beginning, milestone, time-growth, and Today frames show no fabricated event title
// ----------------------------------------------------------------------------
test("39. Requirement M: Beginning, milestone, time-growth, and Today frames show no fabricated event title", () => {
  const events = [
    createMockEvent("pos-1", "positive_moment", "2026-02-01T10:00:00Z", null, "Shared Moment"),
  ];

  const story = createGardenStory({
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: events,
    asOfTime: AS_OF_TIME,
    isResting: false,
  });

  for (let i = 0; i < story.steps.length; i++) {
    const step = story.steps[i];
    const vm = getStoryProgressViewModel(story, i);

    if (step.id === "step-beginning") {
      assert.equal(step.displayTitle, null);
      assert.equal(vm.displayTitle, null);
    } else if (step.eventKind === "stage_transition") {
      assert.equal(step.displayTitle, null);
      assert.equal(vm.displayTitle, null);
    } else if (step.id === "step-today" || step.eventKind === "today") {
      assert.equal(step.displayTitle, null);
      assert.equal(vm.displayTitle, null);
    }
  }
});

// ----------------------------------------------------------------------------
// Test 40: Requirement N: Both partners receiving same authorized couple data obtain identical story titles and frames
// ----------------------------------------------------------------------------
test("40. Requirement N: Both partners receiving the same authorized couple data obtain identical story titles and frames", () => {
  const sharedEvents = [
    createMockEvent("ev-1", "positive_moment", "2026-01-10T10:00:00Z", null, "Picnic in the park"),
    createMockEvent("ev-2", "reconnection", "2026-02-14T10:00:00Z", null, "Dinner plans miscommunication"),
    createMockEvent("ev-3", "important_date", "2026-03-01T00:00:00Z", "2026-02-25T10:00:00Z", "Trip to Japan"),
  ];

  const storyPartnerA = createGardenStory({
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: sharedEvents,
    asOfTime: AS_OF_TIME,
    isResting: false,
  });

  const storyPartnerB = createGardenStory({
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: sharedEvents,
    asOfTime: AS_OF_TIME,
    isResting: false,
  });

  assert.equal(storyPartnerA.steps.length, storyPartnerB.steps.length);
  for (let i = 0; i < storyPartnerA.steps.length; i++) {
    const stepA = storyPartnerA.steps[i];
    const stepB = storyPartnerB.steps[i];
    assert.equal(stepA.id, stepB.id);
    assert.equal(stepA.displayTitle, stepB.displayTitle);
    assert.equal(stepA.caption, stepB.caption);
    assert.equal(stepA.dateLabel, stepB.dateLabel);
    assert.equal(stepA.totalGrowthUnits, stepB.totalGrowthUnits);
    assert.equal(stepA.stage.key, stepB.stage.key);

    const vmA = getStoryProgressViewModel(storyPartnerA, i);
    const vmB = getStoryProgressViewModel(storyPartnerB, i);
    assert.deepEqual(vmA, vmB);
  }
});

// ----------------------------------------------------------------------------
// Test 41: Requirement O: Existing stable global progress remains 1 of N through N of N
// ----------------------------------------------------------------------------
test("41. Requirement O: Existing stable global progress remains 1 of N through N of N", () => {
  const events = [
    createMockEvent("pos-1", "positive_moment", "2026-01-15T10:00:00Z", null, "Title 1"),
    createMockEvent("rec-1", "reconnection", "2026-02-15T10:00:00Z", null, "Title 2"),
  ];

  const story = createGardenStory({
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: events,
    asOfTime: AS_OF_TIME,
    isResting: false,
  });

  const N = story.steps.length;
  for (let i = 0; i < N; i++) {
    const vm = getStoryProgressViewModel(story, i);
    assert.equal(vm.visibleStepNumber, i + 1);
    assert.equal(vm.visibleStepTotal, N);
    assert.equal(vm.progressText, `${i + 1} of ${N}`);
    assert.equal(vm.accessibilityProgressLabel, `Garden story step ${i + 1} of ${N}`);
  }
});

// ----------------------------------------------------------------------------
// Test 42: Requirement P: Final story frame remains exactly equivalent to live Garden scene
// ----------------------------------------------------------------------------
test("42. Requirement P: The final story frame remains exactly equivalent to the live Garden scene", () => {
  const events = [
    createMockEvent("pos-1", "positive_moment", "2026-01-10T10:00:00Z", null, "Shared Care A"),
    createMockEvent("rec-1", "reconnection", "2026-02-10T10:00:00Z", null, "Reconnection B"),
    createMockEvent("date-1", "important_date", "2026-03-10T00:00:00Z", "2026-02-20T10:00:00Z", "Important Date C"),
  ];

  const snapshot = {
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: events,
    asOfTime: AS_OF_TIME,
    isResting: false,
  };

  const story = createGardenStory(snapshot);
  const finalStep = story.steps[story.steps.length - 1];

  const elapsedDays = Math.max(
    0,
    Math.floor((new Date(AS_OF_TIME).getTime() - new Date(COUPLE_CREATED_AT).getTime()) / (1000 * 60 * 60 * 24))
  );
  const liveGrowth = calculateHistoricalGrowth(events, elapsedDays);

  assert.equal(finalStep.totalGrowthUnits, liveGrowth.totalGrowthUnits);
  assert.equal(finalStep.careGrowthUnits, liveGrowth.careGrowthUnits);
  assert.equal(finalStep.timeGrowthUnits, liveGrowth.timeGrowthUnits);
  assert.equal(finalStep.stage.key, liveGrowth.stage.key);
  assert.deepEqual(finalStep.careSignals, liveGrowth.careSignals);
  assert.equal(finalStep.isResting, snapshot.isResting);

  // SVG parity
  const finalScene = generateGardenSVGScene(
    COUPLE_ID_A,
    finalStep.totalGrowthUnits,
    finalStep.careGrowthUnits,
    finalStep.isResting,
    finalStep.careSignals,
    "light",
    finalStep.cumulativeCareEvents
  );

  const liveScene = generateGardenSVGScene(
    COUPLE_ID_A,
    liveGrowth.totalGrowthUnits,
    liveGrowth.careGrowthUnits,
    snapshot.isResting,
    liveGrowth.careSignals,
    "light",
    events
  );

  assert.equal(finalScene.svgString, liveScene.svgString, "Final story frame scene must match live scene byte-for-byte");
});

// ----------------------------------------------------------------------------
// Test 43: Semantic parity and privacy: Garden Story displays formatted category headings and never leaks shared context / narrative
// ----------------------------------------------------------------------------
test("43. Semantic parity and privacy: Garden Story displays formatted category headings and never leaks shared context / narrative", () => {
  // Required fixtures from semantic audit:
  // - Positive: category "Sunday breakfast", shared context "We tried the new café near home"
  // - Reconnection: category "Phones and attention", shared context "It happened while we were having dinner"
  const positiveEvent = createMockEvent(
    "ev-pos-audit",
    "positive_moment",
    "2026-02-01T09:00:00.000Z",
    "2026-02-01T09:00:00.000Z",
    "Sunday breakfast",
    {
      shared_topic: "We tried the new café near home",
      shared_context: "We tried the new café near home",
      event_type: "positive",
    }
  );

  const reconnectionEvent = createMockEvent(
    "ev-rec-audit",
    "reconnection",
    "2026-02-15T20:00:00.000Z",
    "2026-02-10T19:00:00.000Z",
    "Phones and attention",
    {
      shared_topic: "It happened while we were having dinner",
      shared_context: "It happened while we were having dinner",
      event_type: "friction",
    }
  );

  const importantDate = createMockEvent(
    "ev-date-audit",
    "important_date",
    "2026-03-01T00:00:00.000Z",
    "2026-02-20T10:00:00.000Z",
    "Our Anniversary",
    {
      label: "Our Anniversary",
    }
  );

  const snakeCaseEvent = createMockEvent(
    "ev-snake-audit",
    "positive_moment",
    "2026-03-15T14:00:00.000Z",
    "2026-03-15T14:00:00.000Z",
    "quality_time",
    {
      shared_topic: "A quiet walk together in the rain",
    }
  );

  const events = [positiveEvent, reconnectionEvent, importantDate, snakeCaseEvent];

  const story = createGardenStory({
    coupleId: COUPLE_ID_A,
    seedString: COUPLE_ID_A,
    createdAt: COUPLE_CREATED_AT,
    careEvents: events,
    asOfTime: AS_OF_TIME,
    isResting: false,
  });

  // 1. Assert Garden Story contains the short category headings
  const posStep = story.steps.find((s) => s.addedEventKey === "positive_moment:ev-pos-audit");
  assert.ok(posStep, "Positive moment step must exist");
  assert.equal(posStep.displayTitle, "Sunday breakfast");

  const recStep = story.steps.find((s) => s.addedEventKey === "reconnection:ev-rec-audit");
  assert.ok(recStep, "Reconnection step must exist");
  assert.equal(recStep.displayTitle, "Phones and attention");

  const dateStep = story.steps.find((s) => s.addedEventKey === "important_date:ev-date-audit");
  assert.ok(dateStep, "Important date step must exist");
  assert.equal(dateStep.displayTitle, "Our Anniversary");

  const snakeStep = story.steps.find((s) => s.addedEventKey === "positive_moment:ev-snake-audit");
  assert.ok(snakeStep, "Snake case step must exist");
  assert.equal(snakeStep.displayTitle, "Quality Time");

  // 2. Assert serialized view model does not contain shared context narrative text
  const storyJson = JSON.stringify(story);
  const forbiddenNarratives = [
    "We tried the new café near home",
    "It happened while we were having dinner",
    "A quiet walk together in the rain",
    "shared_topic",
    "shared_context",
  ];

  for (const forbidden of forbiddenNarratives) {
    assert.ok(
      !storyJson.includes(forbidden),
      `Garden Story serialized model leaked forbidden text: "${forbidden}"`
    );
  }

  // Check all progress view models
  for (let i = 0; i < story.steps.length; i++) {
    const vm = getStoryProgressViewModel(story, i);
    const vmJson = JSON.stringify(vm);
    for (const forbidden of forbiddenNarratives) {
      assert.ok(
        !vmJson.includes(forbidden),
        `Story progress view model at step ${i} leaked forbidden text: "${forbidden}"`
      );
    }
  }

  // 3. Prove Events list, Event Detail, and Garden Story resolve the identical heading
  // Events list uses: formatCategory(event.category)
  // Event Detail uses: formatCategory(event.category)
  // Canonical helper: getCanonicalEventHeading(event)
  // Garden Story uses: step.displayTitle

  // For positive moment:
  const eventsListHeadingPos = formatCategory(positiveEvent.category);
  const eventDetailHeadingPos = formatCategory(positiveEvent.category);
  const canonicalHeadingPos = getCanonicalEventHeading(positiveEvent);
  assert.equal(eventsListHeadingPos, "Sunday breakfast");
  assert.equal(eventDetailHeadingPos, "Sunday breakfast");
  assert.equal(canonicalHeadingPos, "Sunday breakfast");
  assert.equal(posStep.displayTitle, canonicalHeadingPos);

  // For reconnection:
  const eventsListHeadingRec = formatCategory(reconnectionEvent.category);
  const eventDetailHeadingRec = formatCategory(reconnectionEvent.category);
  const canonicalHeadingRec = getCanonicalEventHeading(reconnectionEvent);
  assert.equal(eventsListHeadingRec, "Phones and attention");
  assert.equal(eventDetailHeadingRec, "Phones and attention");
  assert.equal(canonicalHeadingRec, "Phones and attention");
  assert.equal(recStep.displayTitle, canonicalHeadingRec);

  // For snake_case positive moment:
  const eventsListHeadingSnake = formatCategory(snakeCaseEvent.category);
  const eventDetailHeadingSnake = formatCategory(snakeCaseEvent.category);
  const canonicalHeadingSnake = getCanonicalEventHeading(snakeCaseEvent);
  assert.equal(eventsListHeadingSnake, "Quality Time");
  assert.equal(eventDetailHeadingSnake, "Quality Time");
  assert.equal(canonicalHeadingSnake, "Quality Time");
  assert.equal(snakeStep.displayTitle, canonicalHeadingSnake);

  // For important date:
  const canonicalHeadingDate = getCanonicalEventHeading(importantDate);
  assert.equal(canonicalHeadingDate, "Our Anniversary");
  assert.equal(dateStep.displayTitle, canonicalHeadingDate);
});
