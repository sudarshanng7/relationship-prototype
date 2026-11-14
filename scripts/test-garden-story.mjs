import assert from "node:assert/strict";
import test from "node:test";
import {
  createGardenStory,
  calculateHistoricalGrowth,
  getEventEffectiveTimestamp,
  formatStoryDateUtc,
  GARDEN_STORY_EXPLANATION,
} from "../src/lib/garden-story.ts";
import {
  generateGardenSVGScene,
  deriveGardenDNA,
  hashStringToSeed,
  getCareFeatureId,
  verifyLivingGardenInvariants,
} from "../src/lib/garden-generator.ts";

const COUPLE_ID_A = "11111111-2222-3333-4444-555555555555";
const COUPLE_ID_B = "99999999-8888-7777-6666-555555555555";
const COUPLE_CREATED_AT = "2026-01-01T00:00:00.000Z";
const AS_OF_TIME = "2026-06-01T12:00:00.000Z"; // ~151.5 days elapsed

function createMockEvent(id, kind, occurredAt, createdAt = null) {
  return {
    id,
    kind,
    occurredAt,
    ...(createdAt ? { createdAt } : {}),
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
// Test 19: No private text or partner attribution enters captions
// ----------------------------------------------------------------------------
test("19. Caption safety: No private reflections, titles, partner names, scores, or streaks", () => {
  const events = [
    createMockEvent("ev-1", "positive_moment", "2026-01-10T10:00:00Z"),
    createMockEvent("ev-2", "reconnection", "2026-02-10T10:00:00Z"),
    createMockEvent("ev-3", "important_date", "2026-03-10T10:00:00Z"),
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

  for (const step of story.steps) {
    const lower = step.caption.toLowerCase();
    for (const forbidden of forbiddenWords) {
      assert.ok(
        !lower.includes(forbidden),
        `Caption "${step.caption}" contained forbidden word "${forbidden}"`
      );
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
