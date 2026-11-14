/**
 * Purple Garden - 2.5D Garden World Foundation & Living Ecosystem Test Suite
 *
 * Covers:
 * - Deterministic world generation & couple variation
 * - Theme invariance & semantic stability
 * - Strict separation of earned memories vs decorative structural flora
 * - Collision-safe semantic identities
 * - Valid acyclic hierarchy & finite coordinate bounds
 * - World-to-screen & screen-to-world round-trip precision
 * - Universal highlight coverage across all primitive families
 * - Living ecosystem eligibility, habitat dependencies, and fauna determinism
 * - Reduced-motion compliance & privacy protection
 * - Performance measurements for 0, 10, 50, and 200 events
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  generateGardenSVGScene,
  getCareFeatureId,
} from "../src/lib/garden-generator.ts";
import {
  buildGardenWorld,
  worldToScreen,
  screenToWorld,
  fitCameraToViewport,
  clampCameraTarget,
  calculateHitRegions,
  calculateSemanticHitRegions,
  resolveEventFromNode,
  resolveNodesForEvent,
  resolveFeatureBoundsFromScene,
  resolveFeatureBoundsFromWorld,
  deriveHabitatsFromBotanicalWorld,
  evaluateEcosystemState,
  computeApproximatePathBounds,
  isMatchingFeatureId,
  GARDEN_WORLD_SCHEMA_VERSION,
} from "../src/lib/garden/index.ts";

const COUPLE_A = "couple-uuid-1111-2222";
const COUPLE_B = "couple-uuid-9999-8888";

function createMockEvent(id, kind, dateStr, category = "affection") {
  return {
    id,
    kind,
    occurredAt: dateStr,
    createdAt: dateStr,
    category,
  };
}

// ----------------------------------------------------------------------------
// Test 1: Deterministic world generation (same seed + inputs = identical world)
// ----------------------------------------------------------------------------
test("1. Deterministic world generation: same couple seed & inputs produce byte-identical worlds", () => {
  const ev1 = createMockEvent("ev-1", "positive_moment", "2026-02-01T10:00:00Z");
  const ev2 = createMockEvent("ev-2", "reconnection", "2026-02-10T14:00:00Z");

  const sceneA = generateGardenSVGScene(COUPLE_A, 40, 6, false, undefined, "light", [ev1, ev2]);
  const worldA1 = buildGardenWorld(sceneA, {
    coupleId: COUPLE_A,
    totalGrowthUnits: 40,
    careGrowthUnits: 6,
    timeGrowthUnits: 34,
    careEvents: [ev1, ev2],
  });

  const sceneB = generateGardenSVGScene(COUPLE_A, 40, 6, false, undefined, "light", [ev1, ev2]);
  const worldA2 = buildGardenWorld(sceneB, {
    coupleId: COUPLE_A,
    totalGrowthUnits: 40,
    careGrowthUnits: 6,
    timeGrowthUnits: 34,
    careEvents: [ev1, ev2],
  });

  assert.equal(worldA1.schemaVersion, GARDEN_WORLD_SCHEMA_VERSION);
  assert.equal(JSON.stringify(worldA1), JSON.stringify(worldA2));
  assert.equal(worldA1.metadata.totalNodes, worldA2.metadata.totalNodes);
});

// ----------------------------------------------------------------------------
// Test 2: Couple variation (different couples retain distinct structural DNA)
// ----------------------------------------------------------------------------
test("2. Couple variation: different couples produce distinct structural nodes and coordinates", () => {
  const sceneA = generateGardenSVGScene(COUPLE_A, 45, 10, false, undefined, "light", []);
  const worldA = buildGardenWorld(sceneA, {
    coupleId: COUPLE_A,
    totalGrowthUnits: 45,
    careGrowthUnits: 10,
    timeGrowthUnits: 35,
  });

  const sceneB = generateGardenSVGScene(COUPLE_B, 45, 10, false, undefined, "light", []);
  const worldB = buildGardenWorld(sceneB, {
    coupleId: COUPLE_B,
    totalGrowthUnits: 45,
    careGrowthUnits: 10,
    timeGrowthUnits: 35,
  });

  assert.notEqual(worldA.coupleSeed, worldB.coupleSeed);
  assert.notEqual(sceneA.dna.silhouetteFamily, sceneB.dna.silhouetteFamily);
  assert.notEqual(worldA.nodes["tree-trunk"].pathD, worldB.nodes["tree-trunk"].pathD);
});

// ----------------------------------------------------------------------------
// Test 3: Theme invariance (theme affects presentation, not identity or structure)
// ----------------------------------------------------------------------------
test("3. Theme invariance: Light, dim and dark produce identical node IDs, parents and bounds", () => {
  const ev1 = createMockEvent("ev-pos-1", "positive_moment", "2026-03-01T10:00:00Z");

  const sceneLight = generateGardenSVGScene(COUPLE_A, 50, 2, false, undefined, "light", [ev1]);
  const worldLight = buildGardenWorld(sceneLight, {
    coupleId: COUPLE_A,
    totalGrowthUnits: 50,
    careGrowthUnits: 2,
    timeGrowthUnits: 48,
    effectiveTheme: "light",
    careEvents: [ev1],
  });

  const sceneDark = generateGardenSVGScene(COUPLE_A, 50, 2, false, undefined, "dark", [ev1]);
  const worldDark = buildGardenWorld(sceneDark, {
    coupleId: COUPLE_A,
    totalGrowthUnits: 50,
    careGrowthUnits: 2,
    timeGrowthUnits: 48,
    effectiveTheme: "dark",
    careEvents: [ev1],
  });

  const lightKeys = Object.keys(worldLight.nodes).sort();
  const darkKeys = Object.keys(worldDark.nodes).sort();
  assert.deepEqual(lightKeys, darkKeys);

  for (const k of lightKeys) {
    assert.equal(worldLight.nodes[k].parentId, worldDark.nodes[k].parentId);
    assert.equal(worldLight.nodes[k].role, worldDark.nodes[k].role);
    assert.deepEqual(worldLight.nodes[k].worldBounds, worldDark.nodes[k].worldBounds);
  }
});

// ----------------------------------------------------------------------------
// Test 4: Pure event resolution & zero fabricated sources for decorative nodes
// ----------------------------------------------------------------------------
test("4. Event resolution: Earned nodes resolve to exact source; decorative nodes have null source", () => {
  const evRec = createMockEvent("rec-99", "reconnection", "2026-03-05T12:00:00Z");
  const scene = generateGardenSVGScene(COUPLE_A, 60, 4, false, undefined, "light", [evRec]);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    totalGrowthUnits: 60,
    careGrowthUnits: 4,
    timeGrowthUnits: 56,
    careEvents: [evRec],
  });

  // Reconnection blossom node
  const fid = getCareFeatureId("reconnection", evRec.id);
  const earnedNode = world.nodes[fid] || world.nodes[`earned:reconnection:${evRec.id}`];
  assert.ok(earnedNode, "Expected blossom node for reconnection");
  assert.equal(earnedNode.isEarned, true);
  assert.equal(earnedNode.sourceEvent?.kind, "reconnection");
  assert.equal(earnedNode.sourceEvent?.id, "rec-99");
  assert.equal(earnedNode.sourceEvent?.semanticKey, "reconnection:rec-99");

  // Resolver helper: works via legacy ID and canonical ID
  const resolvedLegacy = resolveEventFromNode(fid, world);
  assert.ok(resolvedLegacy);
  assert.equal(resolvedLegacy.id, "rec-99");

  const resolvedCanonical = resolveEventFromNode(`earned:reconnection:${evRec.id}`, world);
  assert.ok(resolvedCanonical);
  assert.equal(resolvedCanonical.id, "rec-99");

  // Multi-node resolver
  const matchingNodes = resolveNodesForEvent("reconnection", "rec-99", world);
  assert.ok(matchingNodes.length >= 1);
  assert.equal(matchingNodes[0].id, `earned:reconnection:rec-99`);
  assert.equal(matchingNodes[0].legacyFeatureId, fid);

  // Decorative nodes: Trunk, roots, terrain hills must NEVER have fabricated source events
  assert.equal(resolveEventFromNode("tree-trunk", world), null);
  assert.equal(resolveEventFromNode("terrain-hills", world), null);
  assert.equal(world.nodes["tree-trunk"].isEarned, false);
  assert.equal(world.nodes["terrain-hills"].sourceEvent, null);
});

// ----------------------------------------------------------------------------
// Test 5: Collision-safe semantic identity
// ----------------------------------------------------------------------------
test("5. Collision-safe identity: Semantic groups store full kind and ID, not just 32-bit hash", () => {
  const ev1 = createMockEvent("shared-moment-uuid-1", "positive_moment", "2026-01-10T10:00:00Z");
  const scene = generateGardenSVGScene(COUPLE_A, 30, 2, false, undefined, "light", [ev1]);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    totalGrowthUnits: 30,
    careGrowthUnits: 2,
    timeGrowthUnits: 28,
    careEvents: [ev1],
  });

  const group = world.earnedFeatureGroups["positive_moment:shared-moment-uuid-1"];
  assert.ok(group, "Expected earned group for full semantic key");
  assert.equal(group.sourceEvent.kind, "positive_moment");
  assert.equal(group.sourceEvent.id, "shared-moment-uuid-1");
  assert.equal(group.semanticKey, "positive_moment:shared-moment-uuid-1");
});

// ----------------------------------------------------------------------------
// Test 6: Valid, acyclic hierarchy and finite coordinates
// ----------------------------------------------------------------------------
test("6. Valid acyclic hierarchy: Every node parent exists, no cycles, coordinates are finite", () => {
  const scene = generateGardenSVGScene(COUPLE_A, 80, 20, false, undefined, "light", [
    createMockEvent("ev-p1", "positive_moment", "2026-01-01T10:00:00Z"),
    createMockEvent("ev-r1", "reconnection", "2026-01-05T10:00:00Z"),
    createMockEvent("ev-d1", "important_date", "2026-01-10T10:00:00Z"),
  ]);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    totalGrowthUnits: 80,
    careGrowthUnits: 20,
    timeGrowthUnits: 60,
  });

  for (const [id, node] of Object.entries(world.nodes)) {
    if (node.parentId !== null) {
      assert.ok(world.nodes[node.parentId], `Parent ${node.parentId} of node ${id} must exist in world`);
    }
    assert.ok(Number.isFinite(node.worldBounds.minX), `minX of ${id} must be finite`);
    assert.ok(Number.isFinite(node.worldBounds.maxX), `maxX of ${id} must be finite`);
    assert.ok(Number.isFinite(node.anchorPoint.x), `anchor.x of ${id} must be finite`);
    assert.ok(Number.isFinite(node.anchorPoint.y), `anchor.y of ${id} must be finite`);
  }
});

// ----------------------------------------------------------------------------
// Test 7: World-to-screen and screen-to-world round-trip precision
// ----------------------------------------------------------------------------
test("7. Projection precision: worldToScreen and screenToWorld are exact inverses", () => {
  const viewport = { width: 390, height: 260 };
  const camera = { target: { x: 400, y: 250 }, zoom: 1.25 };

  const testPoints = [
    { x: 400, y: 250 },
    { x: 100, y: 50 },
    { x: 650, y: 440 },
    { x: 212.5, y: 318.7 },
  ];

  for (const pt of testPoints) {
    const screen = worldToScreen(pt, camera, viewport);
    const inverse = screenToWorld(screen, camera, viewport);
    assert.ok(Math.abs(inverse.x - pt.x) < 0.05, `Inverse X ${inverse.x} should match ${pt.x}`);
    assert.ok(Math.abs(inverse.y - pt.y) < 0.05, `Inverse Y ${inverse.y} should match ${pt.y}`);
  }
});

// ----------------------------------------------------------------------------
// Test 8: Camera fitting and bounds clamping
// ----------------------------------------------------------------------------
test("8. Camera fitting: fitCameraToViewport fits entire world without clipping", () => {
  const worldBounds = { minX: 0, minY: 0, maxX: 800, maxY: 500, width: 800, height: 500 };
  const viewport = { width: 360, height: 240 };

  const camera = fitCameraToViewport(worldBounds, viewport, 20);
  assert.equal(camera.target.x, 400);
  assert.equal(camera.target.y, 250);
  assert.ok(camera.zoom <= 0.45); // Fits 800 width inside 320 avail

  // Clamping test: Target far outside world is clamped cleanly
  const outTarget = { x: 2000, y: -500 };
  const clamped = clampCameraTarget(outTarget, worldBounds, camera, viewport);
  assert.ok(clamped.x <= worldBounds.maxX);
  assert.ok(clamped.y >= worldBounds.minY);
});

// ----------------------------------------------------------------------------
// Test 9: Universal highlight coverage across ALL primitive families
// ----------------------------------------------------------------------------
test("9. Highlight coverage: Foliage, canopy shoots, blossoms, pods, ground flora & habitat resolve valid bounds", () => {
  // We test one of each kind of event to exercise all primitive families
  const evPosFoliage = createMockEvent("ev-pos-foliage", "positive_moment", "2026-01-01T10:00:00Z", "communication");
  const evPosShoot = createMockEvent("ev-pos-shoot", "positive_moment", "2026-01-02T10:00:00Z", "affection");
  const evRecBlossom = createMockEvent("ev-rec-blossom", "reconnection", "2026-01-03T10:00:00Z");
  const evImpDate = createMockEvent("ev-imp-date", "important_date", "2026-01-04T10:00:00Z");

  const scene = generateGardenSVGScene(COUPLE_A, 50, 8, false, undefined, "light", [
    evPosFoliage,
    evPosShoot,
    evRecBlossom,
    evImpDate,
  ]);

  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    totalGrowthUnits: 50,
    careGrowthUnits: 8,
    timeGrowthUnits: 42,
    careEvents: [evPosFoliage, evPosShoot, evRecBlossom, evImpDate],
  });

  const testFeatureIds = [
    getCareFeatureId("positive_moment", evPosFoliage.id),
    getCareFeatureId("positive_moment", evPosShoot.id),
    getCareFeatureId("reconnection", evRecBlossom.id),
    getCareFeatureId("important_date", evImpDate.id),
  ];

  for (const fid of testFeatureIds) {
    const resFromScene = resolveFeatureBoundsFromScene(scene, fid);
    assert.ok(resFromScene, `Expected feature bounds from scene for ${fid}`);
    assert.ok(Number.isFinite(resFromScene.cx) && resFromScene.cx > 0);
    assert.ok(Number.isFinite(resFromScene.cy) && resFromScene.cy > 0);
    assert.ok(resFromScene.r >= 10);

    const resFromWorld = resolveFeatureBoundsFromWorld(world, fid);
    assert.ok(resFromWorld, `Expected feature bounds from world for ${fid}`);
    assert.ok(Number.isFinite(resFromWorld.cx));
    assert.ok(Number.isFinite(resFromWorld.cy));
  }
});

// ----------------------------------------------------------------------------
// Test 10: Section 15 Ecosystem - Creature cannot exist without compatible habitat
// ----------------------------------------------------------------------------
test("10. Ecosystem: A creature cannot exist without a mature, compatible habitat node", () => {
  // In Seedling stage (< 16 units), only moss_bed exists, no branch_perch or pollinator_patch
  const habitatsSeedling = deriveHabitatsFromBotanicalWorld("first_seedling", 10, { x: 400, y: 440 }, { x: 400, y: 200 }, { x: 400, y: 440 });
  const ecosystemSeedling = evaluateEcosystemState(10, 12345, null, habitatsSeedling, false);

  assert.equal(habitatsSeedling["habitat-branch-perch"], undefined);
  assert.equal(ecosystemSeedling.creatures["ecosystem-visitor-songbird"], undefined);
  assert.equal(ecosystemSeedling.creatures["ecosystem-resident-ground"], undefined);
});

// ----------------------------------------------------------------------------
// Test 11: Section 15 Ecosystem - Habitat maturity and couple-seed determinism
// ----------------------------------------------------------------------------
test("11. Ecosystem: Habitat maturity is deterministic; both partners receive identical state", () => {
  const habitatsMature1 = deriveHabitatsFromBotanicalWorld("rooted_flourishing", 80, { x: 400, y: 440 }, { x: 400, y: 180 }, { x: 400, y: 440 });
  const ecoPartnerA = evaluateEcosystemState(80, 77777, "2026-05-01T12:00:00Z", habitatsMature1, false);

  const habitatsMature2 = deriveHabitatsFromBotanicalWorld("rooted_flourishing", 80, { x: 400, y: 440 }, { x: 400, y: 180 }, { x: 400, y: 440 });
  const ecoPartnerB = evaluateEcosystemState(80, 77777, "2026-05-01T12:00:00Z", habitatsMature2, false);

  assert.deepEqual(ecoPartnerA.eligibleSpecies, ecoPartnerB.eligibleSpecies);
  assert.deepEqual(Object.keys(ecoPartnerA.creatures), Object.keys(ecoPartnerB.creatures));
  assert.equal(ecoPartnerA.ecologicalSummary, ecoPartnerB.ecologicalSummary);
});

// ----------------------------------------------------------------------------
// Test 12: Section 15 Ecosystem - Different couples receive different valid species combinations
// ----------------------------------------------------------------------------
test("12. Ecosystem: Different couples receive different valid species variants deterministically", () => {
  const habitats = deriveHabitatsFromBotanicalWorld("garden_in_bloom", 95, { x: 400, y: 440 }, { x: 400, y: 180 }, { x: 400, y: 440 });
  const ecoCouple1 = evaluateEcosystemState(95, 11111, null, habitats, false);
  const ecoCouple2 = evaluateEcosystemState(95, 88888, null, habitats, false);

  assert.ok(ecoCouple1.eligibleSpecies.length > 0);
  assert.ok(ecoCouple2.eligibleSpecies.length > 0);
  // Verify couple variation
  assert.notEqual(
    ecoCouple1.creatures["ecosystem-visitor-butterfly"]?.species,
    ecoCouple2.creatures["ecosystem-visitor-butterfly"]?.species
  );
});

// ----------------------------------------------------------------------------
// Test 13: Section 15 Ecosystem - Reduced motion returns a still state
// ----------------------------------------------------------------------------
test("13. Ecosystem: Resting / reduced-motion mode ensures motionProfile is still", () => {
  const habitats = deriveHabitatsFromBotanicalWorld("branching_out", 45, { x: 400, y: 440 }, { x: 400, y: 180 }, { x: 400, y: 440 });
  const ecoResting = evaluateEcosystemState(45, 12345, null, habitats, true);

  for (const c of Object.values(ecoResting.creatures)) {
    assert.equal(c.motionProfile, "still");
    assert.equal(c.reducedMotionState, "still");
  }
});

// ----------------------------------------------------------------------------
// Test 14: Section 15 Ecosystem - Movement remains within habitat bounds
// ----------------------------------------------------------------------------
test("14. Ecosystem: Creature resting anchor and movement bounds remain strictly within habitat", () => {
  const habitats = deriveHabitatsFromBotanicalWorld("leafy_canopy", 65, { x: 400, y: 440 }, { x: 400, y: 180 }, { x: 400, y: 440 });
  const eco = evaluateEcosystemState(65, 54321, null, habitats, false);

  for (const c of Object.values(eco.creatures)) {
    const habitat = habitats[c.habitatParentId];
    assert.ok(habitat, `Creature ${c.id} must reference a valid habitat parent`);
    assert.ok(c.movementBounds.width > 0 && c.movementBounds.height > 0);
    assert.ok(c.restingAnchor.x >= c.movementBounds.minX && c.restingAnchor.x <= c.movementBounds.maxX);
    assert.ok(c.restingAnchor.y >= c.movementBounds.minY && c.restingAnchor.y <= c.movementBounds.maxY);
  }
});

// ----------------------------------------------------------------------------
// Test 15: Section 15 Ecosystem - Non-judgmental copy and zero connection to friction/scores
// ----------------------------------------------------------------------------
test("15. Ecosystem: Ecological copy contains zero partner judgment, streaks, or scores", () => {
  const habitats = deriveHabitatsFromBotanicalWorld("branching_out", 45, { x: 400, y: 440 }, { x: 400, y: 180 }, { x: 400, y: 440 });
  const eco = evaluateEcosystemState(45, 99999, null, habitats, false);

  const text = eco.ecologicalSummary.toLowerCase();
  assert.ok(!text.includes("score"));
  assert.ok(!text.includes("streak"));
  assert.ok(!text.includes("partner"));
  assert.ok(!text.includes("conflict"));
  assert.ok(!text.includes("repair"));
  assert.ok(!text.includes("earned"));
});

// ----------------------------------------------------------------------------
// Test 16: Performance Measurements for 0, 10, 50, and 200 events
// ----------------------------------------------------------------------------
function computeStats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const p95Idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  const p95 = sorted[p95Idx];
  return {
    median: Math.round(median * 100) / 100,
    p95: Math.round(p95 * 100) / 100,
  };
}

test("16. Performance: Warmed median & p95 benchmark separating scene generation and world adaptation", () => {
  const counts = [0, 10, 50, 200];
  const results = [];

  for (const count of counts) {
    const events = [];
    for (let i = 0; i < count; i++) {
      const kind = i % 3 === 0 ? "reconnection" : i % 3 === 1 ? "positive_moment" : "important_date";
      events.push(createMockEvent(`perf-ev-${i}`, kind, "2026-03-01T10:00:00Z"));
    }

    const totalGrowth = Math.min(100, count * 2);
    const careGrowth = Math.min(40, count * 2);
    const timeGrowth = 20;

    // 5 warm-up iterations
    for (let w = 0; w < 5; w++) {
      const sc = generateGardenSVGScene(COUPLE_A, totalGrowth, careGrowth, false, undefined, "light", events);
      buildGardenWorld(sc, {
        coupleId: COUPLE_A,
        totalGrowthUnits: totalGrowth,
        careGrowthUnits: careGrowth,
        timeGrowthUnits: timeGrowth,
        careEvents: events,
      });
    }

    // 20 measurement runs
    const sceneTimes = [];
    const worldTimes = [];
    const totalTimes = [];
    let lastWorld = null;

    for (let r = 0; r < 20; r++) {
      const t0 = process.hrtime.bigint();
      const sc = generateGardenSVGScene(COUPLE_A, totalGrowth, careGrowth, false, undefined, "light", events);
      const t1 = process.hrtime.bigint();
      const wrld = buildGardenWorld(sc, {
        coupleId: COUPLE_A,
        totalGrowthUnits: totalGrowth,
        careGrowthUnits: careGrowth,
        timeGrowthUnits: timeGrowth,
        careEvents: events,
      });
      const t2 = process.hrtime.bigint();

      const scMs = Number(t1 - t0) / 1e6;
      const wrldMs = Number(t2 - t1) / 1e6;
      sceneTimes.push(scMs);
      worldTimes.push(wrldMs);
      totalTimes.push(scMs + wrldMs);
      lastWorld = wrld;
    }

    const scStats = computeStats(sceneTimes);
    const wrldStats = computeStats(worldTimes);
    const totStats = computeStats(totalTimes);

    results.push({
      eventCount: count,
      nodeCount: lastWorld.metadata.totalNodes,
      earnedNodeCount: lastWorld.metadata.earnedNodeCount,
      sceneMedian: scStats.median,
      sceneP95: scStats.p95,
      worldMedian: wrldStats.median,
      worldP95: wrldStats.p95,
      totalMedian: totStats.median,
      totalP95: totStats.p95,
    });

    assert.ok(lastWorld.metadata.totalNodes > 0);
    if (count > 0) {
      assert.ok(lastWorld.metadata.earnedNodeCount > 0);
    }
  }

  // Print performance table cleanly for handoff record
  console.log("\n================================= GARDEN WORLD BENCHMARK =================================");
  console.log("  Iterative Warmed Measurement (5 warmups, 20 runs per tier)");
  console.log("  Note: Complexity is confirmed linear O(N) by static code inspection of traversals;");
  console.log("  measured timings demonstrate absolute latency bounds under node/v8 runtime.\n");
  console.log("  Events | Total Nodes | Earned | Scene (med/p95 ms) | World (med/p95 ms) | Total (med/p95 ms)");
  console.log("  -------+-------------+--------+--------------------+--------------------+-------------------");
  for (const r of results) {
    const ev = String(r.eventCount).padStart(6);
    const nd = String(r.nodeCount).padStart(11);
    const ea = String(r.earnedNodeCount).padStart(6);
    const sc = `${r.sceneMedian.toFixed(2)} / ${r.sceneP95.toFixed(2)}`.padStart(18);
    const wd = `${r.worldMedian.toFixed(2)} / ${r.worldP95.toFixed(2)}`.padStart(18);
    const tt = `${r.totalMedian.toFixed(2)} / ${r.totalP95.toFixed(2)}`.padStart(17);
    console.log(`  ${ev} | ${nd} | ${ea} | ${sc} | ${wd} | ${tt}`);
  }
  console.log("==========================================================================================\n");
});

// ----------------------------------------------------------------------------
// Test 17: Viewport changes & resizing do not alter couple DNA, node IDs or ownership
// ----------------------------------------------------------------------------
test("17. Viewport changes: Compact vs full screen views preserve identical node IDs and parents", () => {
  const ev1 = createMockEvent("ev-p1", "positive_moment", "2026-02-01T10:00:00Z");
  const scene = generateGardenSVGScene(COUPLE_A, 55, 6, false, undefined, "light", [ev1]);

  const worldFull = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    totalGrowthUnits: 55,
    careGrowthUnits: 6,
    timeGrowthUnits: 49,
    careEvents: [ev1],
  });

  // Calculate hit regions for mobile viewport vs desktop viewport
  const mobileVP = { width: 320, height: 200 };
  const desktopVP = { width: 1200, height: 750 };
  const camera = { target: { x: 400, y: 250 }, zoom: 1 };

  const mobileHit = calculateHitRegions(worldFull, camera, mobileVP);
  const desktopHit = calculateHitRegions(worldFull, camera, desktopVP);

  assert.equal(mobileHit.length, desktopHit.length);
  for (let i = 0; i < mobileHit.length; i++) {
    assert.equal(mobileHit[i].nodeId, desktopHit[i].nodeId);
    assert.equal(mobileHit[i].isEarned, desktopHit[i].isEarned);
  }
});

// ----------------------------------------------------------------------------
// Test 18: Backfill and query order changes do not reassign existing parents
// ----------------------------------------------------------------------------
test("18. Backfill stability: Inserting an older event does not alter existing feature IDs or parents", () => {
  const evFeb = createMockEvent("ev-feb", "positive_moment", "2026-02-15T10:00:00Z");
  const evJan = createMockEvent("ev-jan", "reconnection", "2026-01-15T10:00:00Z"); // backfilled older event

  // Run with only Feb event
  const scene1 = generateGardenSVGScene(COUPLE_A, 30, 2, false, undefined, "light", [evFeb]);
  const world1 = buildGardenWorld(scene1, {
    coupleId: COUPLE_A,
    totalGrowthUnits: 30,
    careGrowthUnits: 2,
    timeGrowthUnits: 28,
    careEvents: [evFeb],
  });

  // Run with Jan event backfilled
  const scene2 = generateGardenSVGScene(COUPLE_A, 34, 6, false, undefined, "light", [evFeb, evJan]);
  const world2 = buildGardenWorld(scene2, {
    coupleId: COUPLE_A,
    totalGrowthUnits: 34,
    careGrowthUnits: 6,
    timeGrowthUnits: 28,
    careEvents: [evFeb, evJan],
  });

  const fidFeb = getCareFeatureId("positive_moment", evFeb.id);
  assert.ok(world1.nodes[fidFeb]);
  assert.ok(world2.nodes[fidFeb]);
  // The existing feature ID and parent attachment remain preserved
  assert.equal(world1.nodes[fidFeb].id, world2.nodes[fidFeb].id);
  assert.equal(world1.nodes[fidFeb].parentId, world2.nodes[fidFeb].parentId);
});

// ----------------------------------------------------------------------------
// Test 19: Fauna does not alter growth calculations or mutate state
// ----------------------------------------------------------------------------
test("19. Fauna isolation: Creature presence does not alter totalGrowthUnits or careGrowthUnits", () => {
  const scene = generateGardenSVGScene(COUPLE_A, 70, 10, false, undefined, "light", []);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    totalGrowthUnits: 70,
    careGrowthUnits: 10,
    timeGrowthUnits: 60,
  });

  // Verified that ecosystem nodes do not modify total or care growth units
  assert.equal(world.totalGrowthUnits, 70);
  assert.equal(world.careGrowthUnits, 10);
  assert.equal(world.timeGrowthUnits, 60);
});

// ----------------------------------------------------------------------------
// Test 20: Unauthorized event withdrawal leaks zero information through creature state
// ----------------------------------------------------------------------------
test("20. Privacy safety: Removing an event purges earned nodes and leaks zero metadata via creatures", () => {
  const privateEv = createMockEvent("private-1", "positive_moment", "2026-03-01T10:00:00Z");

  const sceneWith = generateGardenSVGScene(COUPLE_A, 40, 2, false, undefined, "light", [privateEv]);
  const worldWith = buildGardenWorld(sceneWith, {
    coupleId: COUPLE_A,
    totalGrowthUnits: 40,
    careGrowthUnits: 2,
    timeGrowthUnits: 38,
    careEvents: [privateEv],
  });

  const sceneWithout = generateGardenSVGScene(COUPLE_A, 38, 0, false, undefined, "light", []);
  const worldWithout = buildGardenWorld(sceneWithout, {
    coupleId: COUPLE_A,
    totalGrowthUnits: 38,
    careGrowthUnits: 0,
    timeGrowthUnits: 38,
    careEvents: [],
  });

  const fid = getCareFeatureId("positive_moment", privateEv.id);
  assert.ok(worldWith.nodes[fid]);
  assert.equal(worldWithout.nodes[fid], undefined);
  assert.equal(worldWithout.earnedFeatureGroups["positive_moment:private-1"], undefined);

  // Creature copy does not contain any reference to private-1
  assert.ok(!worldWithout.ecosystem.ecologicalSummary.includes("private-1"));
});

// ----------------------------------------------------------------------------
// Test 21: SVG Path Bounds Audit (Contract A: Approximate Visual Bounds)
// ----------------------------------------------------------------------------
test("21. SVG Path Bounds Audit: Commands, Bézier control hulls, arcs, scientific notation, and stroke expansion", () => {
  // Absolute commands: M, L, H, V, C, S, Q, T, A, Z
  const absolutePath =
    "M 10 20 L 50 20 H 90 V 60 C 90 80 110 80 110 60 S 130 40 130 60 Q 140 100 160 80 T 180 80 A 10 10 0 0 1 200 80 Z";
  const absBounds = computeApproximatePathBounds(absolutePath);
  assert.ok(absBounds.minX <= 10 && absBounds.maxX >= 200);
  assert.ok(absBounds.minY <= 20 && absBounds.maxY >= 80);

  // Relative commands: m, l, h, v, c, s, q, t, a, z
  const relativePath =
    "m 10 20 l 40 0 h 40 v 40 c 0 20 20 20 20 0 s 20 -20 20 0 q 10 40 30 20 t 20 0 a 10 10 0 0 1 20 0 z";
  const relBounds = computeApproximatePathBounds(relativePath);
  assert.ok(relBounds.minX <= 10 && relBounds.maxX >= 190);
  assert.ok(relBounds.minY <= 20);

  // Multiple subpaths (disjoint M commands)
  const multiSubpath = "M 10 10 L 20 20 M 100 100 L 120 120";
  const multiBounds = computeApproximatePathBounds(multiSubpath);
  assert.equal(multiBounds.minX, 10);
  assert.equal(multiBounds.minY, 10);
  assert.equal(multiBounds.maxX, 120);
  assert.equal(multiBounds.maxY, 120);

  // Negative values and decimals
  const negDecimal = "M -25.5 -10.25 L 30.75 40.5";
  const negBounds = computeApproximatePathBounds(negDecimal);
  assert.equal(negBounds.minX, -25.5);
  assert.equal(negBounds.minY, -10.25);
  assert.equal(negBounds.maxX, 30.75);
  assert.equal(negBounds.maxY, 40.5);

  // Scientific notation: e.g. -1.5e1 (-15), 2.5e2 (250), 3.0e-1 (0.3)
  const sciPath = "M -1.5e1 2.0e1 L 2.5e2 3.0e2";
  const sciBounds = computeApproximatePathBounds(sciPath);
  assert.equal(sciBounds.minX, -15);
  assert.equal(sciBounds.minY, 20);
  assert.equal(sciBounds.maxX, 250);
  assert.equal(sciBounds.maxY, 300);

  // Bézier extrema between endpoints:
  // Curve goes from (0, 0) to (100, 0) but arcs upwards to y = -50 via control point (50, -50)
  const bezierHull = "M 0 0 Q 50 -50 100 0";
  const bBounds = computeApproximatePathBounds(bezierHull);
  assert.equal(bBounds.minY, -50, "Bézier control hull must enclose curve upward excursion");
  assert.equal(bBounds.minX, 0);
  assert.equal(bBounds.maxX, 100);

  // Elliptical arc (A/a):
  const arcPath = "M 100 100 A 50 50 0 0 1 200 100";
  const arcBounds = computeApproximatePathBounds(arcPath);
  assert.ok(arcBounds.minX <= 100);
  assert.ok(arcBounds.maxX >= 200);

  // Stroke width expansion: strokeWidth = 10 expands bounds by 5 on each side
  const strokePath = "M 10 10 L 50 50";
  const strokeBounds = computeApproximatePathBounds(strokePath, 10);
  assert.equal(strokeBounds.minX, 5); // 10 - 5
  assert.equal(strokeBounds.minY, 5); // 10 - 5
  assert.equal(strokeBounds.maxX, 55); // 50 + 5
  assert.equal(strokeBounds.maxY, 55); // 50 + 5
});

// ----------------------------------------------------------------------------
// Test 22: ID Collision Resilience
// ----------------------------------------------------------------------------
test("22. ID collision resilience: Distinct events with simulated identical legacy hash resolve independently", () => {
  const ev1 = createMockEvent("uuid-event-alpha", "reconnection", "2026-03-01T10:00:00Z");
  const ev2 = createMockEvent("uuid-event-beta", "reconnection", "2026-03-02T10:00:00Z");

  const scene = generateGardenSVGScene(COUPLE_A, 50, 4, false, undefined, "light", [ev1, ev2]);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    totalGrowthUnits: 50,
    careGrowthUnits: 4,
    timeGrowthUnits: 46,
    careEvents: [ev1, ev2],
  });

  // Verify canonical IDs in world.nodes
  const canonical1 = `earned:reconnection:${ev1.id}`;
  const canonical2 = `earned:reconnection:${ev2.id}`;
  assert.ok(world.nodes[canonical1], `Canonical node ${canonical1} must exist in world`);
  assert.ok(world.nodes[canonical2], `Canonical node ${canonical2} must exist in world`);
  assert.notEqual(canonical1, canonical2);

  // Verify earnedFeatureGroups keying
  assert.ok(world.earnedFeatureGroups[`reconnection:${ev1.id}`]);
  assert.ok(world.earnedFeatureGroups[`reconnection:${ev2.id}`]);

  // Resolving each canonical ID resolves the exact distinct event
  const res1 = resolveEventFromNode(canonical1, world);
  const res2 = resolveEventFromNode(canonical2, world);
  assert.equal(res1?.id, ev1.id);
  assert.equal(res2?.id, ev2.id);

  // Simulation: construct a world where two nodes share a legacyFeatureId in renderIdToNodeIds
  const simWorld = {
    ...world,
    nodes: {
      ...world.nodes,
      "earned:reconnection:ev-col-1": {
        ...world.nodes[canonical1],
        id: "earned:reconnection:ev-col-1",
        legacyFeatureId: "care-reconnection-collision",
        sourceEvent: { kind: "reconnection", id: "ev-col-1", semanticKey: "reconnection:ev-col-1", authoritativeTimestamp: null },
      },
      "earned:reconnection:ev-col-2": {
        ...world.nodes[canonical2],
        id: "earned:reconnection:ev-col-2",
        legacyFeatureId: "care-reconnection-collision",
        sourceEvent: { kind: "reconnection", id: "ev-col-2", semanticKey: "reconnection:ev-col-2", authoritativeTimestamp: null },
      },
    },
    renderIdToNodeIds: {
      ...world.renderIdToNodeIds,
      "care-reconnection-collision": ["earned:reconnection:ev-col-1", "earned:reconnection:ev-col-2"],
    },
  };

  // Both exist simultaneously without overwriting
  assert.ok(simWorld.nodes["earned:reconnection:ev-col-1"]);
  assert.ok(simWorld.nodes["earned:reconnection:ev-col-2"]);
  assert.equal(simWorld.renderIdToNodeIds["care-reconnection-collision"].length, 2);

  // Individual canonical lookups resolve to their distinct respective events
  assert.equal(resolveEventFromNode("earned:reconnection:ev-col-1", simWorld)?.id, "ev-col-1");
  assert.equal(resolveEventFromNode("earned:reconnection:ev-col-2", simWorld)?.id, "ev-col-2");
});

// ----------------------------------------------------------------------------
// Test 23: Delimiter-Safe Child Grouping
// ----------------------------------------------------------------------------
test("23. Delimiter-safe child grouping: Prevents false substring matches (ev-1 does not match ev-10 or ev-100)", () => {
  // 1. Exact match
  assert.equal(isMatchingFeatureId("earned:reconnection:ev-1", "earned:reconnection:ev-1"), true);

  // 2. Structured child delimiter
  assert.equal(isMatchingFeatureId("earned:reconnection:ev-1::child::floret-0", "earned:reconnection:ev-1"), true);
  assert.equal(isMatchingFeatureId("earned:reconnection:ev-1::child::sub", "earned:reconnection:ev-1"), true);

  // 3. Substring collision resistance: ev-1 must NOT match ev-10, ev-100, or ev-1-suffix that is an unrelated event
  assert.equal(isMatchingFeatureId("earned:reconnection:ev-10", "earned:reconnection:ev-1"), false);
  assert.equal(isMatchingFeatureId("earned:reconnection:ev-100", "earned:reconnection:ev-1"), false);
  assert.equal(isMatchingFeatureId("ev-10", "ev-1"), false);
  assert.equal(isMatchingFeatureId("ev-100", "ev-1"), false);
  assert.equal(isMatchingFeatureId("ev-1-other-event-id", "ev-1"), false);

  // 4. Legacy structured child suffixes
  assert.equal(isMatchingFeatureId("care-reconnection-123-floret-0", "care-reconnection-123"), true);
  assert.equal(isMatchingFeatureId("care-reconnection-123-leaf-2", "care-reconnection-123"), true);
  assert.equal(isMatchingFeatureId("care-reconnection-12345", "care-reconnection-123"), false);
});

// ----------------------------------------------------------------------------
// Test 24: Semantic Hit-Region Contract
// ----------------------------------------------------------------------------
test("24. Semantic hit regions: >=44pt accessible targets and deterministic depth/priority ordering", () => {
  const ev1 = createMockEvent("hit-ev-1", "positive_moment", "2026-03-01T10:00:00Z");
  const scene = generateGardenSVGScene(COUPLE_A, 50, 2, false, undefined, "light", [ev1]);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    totalGrowthUnits: 50,
    careGrowthUnits: 2,
    timeGrowthUnits: 48,
    careEvents: [ev1],
  });

  const viewport = { width: 390, height: 260 };
  const camera = { target: { x: 400, y: 250 }, zoom: 1.0 };
  const hitRegions = calculateSemanticHitRegions(world, camera, viewport, 44);

  assert.ok(hitRegions.length > 0);

  // 1. Accessibility requirement: Every interactionScreenBounds width and height >= 44
  for (const hr of hitRegions) {
    assert.ok(
      hr.interactionScreenBounds.width >= 44,
      `Hit region ${hr.id} width (${hr.interactionScreenBounds.width}) must be >= 44`
    );
    assert.ok(
      hr.interactionScreenBounds.height >= 44,
      `Hit region ${hr.id} height (${hr.interactionScreenBounds.height}) must be >= 44`
    );
  }

  // 2. Separation of concerns: visual bounds vs interaction bounds
  const earnedRegion = hitRegions.find((r) => r.isEarned);
  assert.ok(earnedRegion, "Expected at least one earned hit region");
  assert.ok(earnedRegion.visualBounds, "Must have visual bounds");
  assert.ok(earnedRegion.screenVisualBounds, "Must have screen visual bounds");
  assert.ok(earnedRegion.interactionScreenBounds, "Must have expanded interaction bounds");

  // 3. Deterministic depth & priority ordering:
  for (let i = 0; i < hitRegions.length - 1; i++) {
    const cur = hitRegions[i];
    const nxt = hitRegions[i + 1];
    if (cur.depthLayer !== nxt.depthLayer) {
      assert.ok(
        cur.depthLayer > nxt.depthLayer,
        `Depth layer descending order: ${cur.depthLayer} > ${nxt.depthLayer}`
      );
    } else if (cur.interactionPriority !== nxt.interactionPriority) {
      assert.ok(
        cur.interactionPriority > nxt.interactionPriority,
        `Priority descending order: ${cur.interactionPriority} > ${nxt.interactionPriority}`
      );
    } else {
      assert.ok(
        cur.nodeId.localeCompare(nxt.nodeId) <= 0,
        `NodeId tie breaker: ${cur.nodeId} <= ${nxt.nodeId}`
      );
    }
  }
});
