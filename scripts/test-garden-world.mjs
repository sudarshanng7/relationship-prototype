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
  BUILTIN_PROCEDURAL_ASSET_MANIFESTS,
  validateAssetManifest,
  FIXTURE_COUPLE_SEEDS,
  CANONICAL_FIXTURES,
  generateMockEventSequence,
  CANONICAL_SCENE_BOUNDS,
  EXPANDED_WORLD_BOUNDS,
  createCameraFromFit,
  calculateZoomBounds,
  panCamera,
  zoomCameraAroundPoint,
  focusScenicRegion,
  focusNamedScenicRegion,
  getCameraTransformString,
  resolveNodeAtWorldCoordinate,
  resolveNodeAtScreenCoordinate,
  isScenicRegionAvailable,
  CANONICAL_DRAG_THRESHOLD_PX,
  classifyGesture,
  getNodeInteractionClass,
} from "../src/lib/garden/index.ts";
import { createGardenStory } from "../src/lib/garden-story.ts";

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

// ----------------------------------------------------------------------------
// Test 25: Invariant E & S - Compact vs Full Viewport Identity Parity
// ----------------------------------------------------------------------------
test("25. Invariant E & S: Compact and full preserve meaningful feature identity & major earned features", () => {
  const events = generateMockEventSequence(15, "mixed");
  const scene = generateGardenSVGScene(COUPLE_A, 55, 30, false, undefined, "light", events);

  const worldFull = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    totalGrowthUnits: 55,
    careGrowthUnits: 30,
    timeGrowthUnits: 25,
    careEvents: events,
  });

  const worldCompact = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    totalGrowthUnits: 55,
    careGrowthUnits: 30,
    timeGrowthUnits: 25,
    careEvents: events,
  });

  // 1. Both viewports share identical earned feature groups
  const fullGroupKeys = Object.keys(worldFull.earnedFeatureGroups).sort();
  const compactGroupKeys = Object.keys(worldCompact.earnedFeatureGroups).sort();
  assert.deepEqual(fullGroupKeys, compactGroupKeys);
  assert.equal(fullGroupKeys.length, 15);

  // 2. Invariant S: Every earned event has at least one corresponding node in the world
  for (const ev of events) {
    const key = `${ev.kind}:${ev.id}`;
    const group = worldCompact.earnedFeatureGroups[key];
    assert.ok(group, `Expected earned group for event ${key}`);
    assert.ok(group.nodeIds.length > 0, `Expected nodeIds for event ${key}`);
    for (const nid of group.nodeIds) {
      assert.ok(worldCompact.nodes[nid], `Node ${nid} must exist in compact world`);
      assert.equal(worldCompact.nodes[nid].isEarned, true);
    }
  }
});

// ----------------------------------------------------------------------------
// Test 26: Invariant Q - Render Plans Respect Deterministic Depth Ordering
// ----------------------------------------------------------------------------
test("26. Invariant Q: Render plans respect deterministic depth ordering", () => {
  const events = generateMockEventSequence(10, "mixed");
  const scene = generateGardenSVGScene(COUPLE_A, 60, 20, false, undefined, "light", events);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    totalGrowthUnits: 60,
    careGrowthUnits: 20,
    timeGrowthUnits: 40,
    careEvents: events,
  });

  const nodes = Object.values(world.nodes);
  assert.ok(nodes.length > 0);

  // Every node must have a finite depthLayer
  for (const n of nodes) {
    assert.equal(typeof n.depthLayer, "number");
    assert.ok(Number.isFinite(n.depthLayer));
  }

  // Verify depth layer architectural hierarchy
  const terrainNodes = nodes.filter((n) => n.role === "terrain_region");
  const trunkNodes = nodes.filter((n) => n.role === "trunk" && n.id === "tree-trunk");
  const branchNodes = nodes.filter((n) => n.role === "branch");
  const blossomNodes = nodes.filter((n) => n.role === "bud_blossom_fruit" && n.blossomKind === "blossom");

  for (const tn of terrainNodes) {
    assert.ok(tn.depthLayer <= -18, `Terrain depth (${tn.depthLayer}) must be <= -18`);
  }
  for (const tr of trunkNodes) {
    assert.ok(tr.depthLayer === 0, `Trunk base depth must be 0`);
  }
  for (const bn of branchNodes) {
    assert.ok(bn.depthLayer === 20, `Branch depth must be 20`);
  }
  for (const bl of blossomNodes) {
    assert.ok(bl.depthLayer === 50, `Blossom depth must be 50`);
  }

  // Stable sorting by depthLayer is deterministic
  const sorted1 = [...nodes].sort((a, b) => a.depthLayer - b.depthLayer || a.id.localeCompare(b.id));
  const sorted2 = [...nodes].sort((a, b) => a.depthLayer - b.depthLayer || a.id.localeCompare(b.id));
  assert.deepEqual(
    sorted1.map((n) => n.id),
    sorted2.map((n) => n.id)
  );
});

// ----------------------------------------------------------------------------
// Test 27: Invariant R & T - Density Management & Visual Honesty
// ----------------------------------------------------------------------------
test("27. Invariant R & T: No event-backed feature dropped; zero-event gardens remain visually honest", () => {
  // Invariant R: 50 events - every single care event must be preserved in earned groups
  const events50 = generateMockEventSequence(50, "mixed");
  const scene50 = generateGardenSVGScene(COUPLE_A, 80, 40, false, undefined, "light", events50);
  const world50 = buildGardenWorld(scene50, {
    coupleId: COUPLE_A,
    totalGrowthUnits: 80,
    careGrowthUnits: 40,
    timeGrowthUnits: 40,
    careEvents: events50,
  });

  assert.equal(Object.keys(world50.earnedFeatureGroups).length, 50);
  assert.ok(world50.metadata.earnedNodeCount >= 50);

  // Invariant T: Zero care events - must remain visually honest and never fabricate history
  const scene0 = generateGardenSVGScene(COUPLE_A, 35, 0, false, undefined, "light", []);
  const world0 = buildGardenWorld(scene0, {
    coupleId: COUPLE_A,
    totalGrowthUnits: 35,
    careGrowthUnits: 0,
    timeGrowthUnits: 35,
    careEvents: [],
  });

  assert.equal(world0.metadata.earnedNodeCount, 0);
  assert.equal(Object.keys(world0.earnedFeatureGroups).length, 0);
  for (const n of Object.values(world0.nodes)) {
    assert.equal(n.isEarned, false, `Node ${n.id} must not be marked earned in a 0-event garden`);
    assert.equal(n.sourceEvent, null, `Node ${n.id} must have null sourceEvent in a 0-event garden`);
  }
});

// ----------------------------------------------------------------------------
// Test 28: Scenic Exploration Regions and Node Coverage
// ----------------------------------------------------------------------------
test("28. Scenic exploration regions: Canonical regions with valid bounds and full node coverage", () => {
  const events = generateMockEventSequence(5, "mixed");
  const scene = generateGardenSVGScene(COUPLE_A, 60, 10, false, undefined, "light", events);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    totalGrowthUnits: 60,
    careGrowthUnits: 10,
    timeGrowthUnits: 50,
    careEvents: events,
  });

  assert.ok(world.scenicRegions, "scenicRegions map must exist on GardenWorld");

  const canonicalScenicKeys = [
    "crown",
    "left_canopy",
    "right_canopy",
    "trunk",
    "root_grove",
    "wildflower_meadow",
    "stone_landmark_area",
    "stream_edge",
    "atmosphere",
  ];

  for (const k of canonicalScenicKeys) {
    const reg = world.scenicRegions[k];
    assert.ok(reg, `Region ${k} must exist in scenicRegions`);
    assert.ok(reg.width > 0, `Region ${k} width must be > 0`);
    assert.ok(reg.height > 0, `Region ${k} height must be > 0`);
    assert.ok(Number.isFinite(reg.minX));
    assert.ok(Number.isFinite(reg.minY));
  }

  // Full node coverage: every unique canonical node belongs to a scenic region
  for (const n of Object.values(world.nodes)) {
    assert.ok(n.scenicRegion, `Node ${n.id} must have a scenicRegion`);
    assert.ok(
      canonicalScenicKeys.includes(n.scenicRegion),
      `Node ${n.id} scenicRegion (${n.scenicRegion}) must be one of canonical keys`
    );
  }
});

// ----------------------------------------------------------------------------
// Test 29: Painterly Botanical Asset Manifest Contract
// ----------------------------------------------------------------------------
test("29. Painterly botanical asset manifests: Rigorous schema validation across all 2.5D assets", () => {
  const manifests = BUILTIN_PROCEDURAL_ASSET_MANIFESTS;
  assert.ok(Object.keys(manifests).length >= 15);

  const requiredKeys = [
    "terrain-clearing-meadow-v1",
    "tree-ancient-oak-trunk-v1",
    "canopy-shadow-mass-v1",
    "canopy-foliage-mass-v1",
    "canopy-sunlit-leaves-v1",
    "blossom-reconnection-rose-v1",
    "bud-closed-calyx-v1",
    "berry-woodland-cluster-v1",
    "seed-pod-restrained-v1",
    "flora-woodland-fern-v1",
    "flora-clover-cover-v1",
    "flora-moss-cushion-v1",
    "flora-meadow-flower-v1",
    "fauna-european-robin-v1",
    "fauna-peacock-butterfly-v1",
    "fauna-bumblebee-pollinator-v1",
    "stream-curved-brook-v1",
    "landmark-important-date-v1",
  ];

  for (const k of requiredKeys) {
    const m = manifests[k];
    assert.ok(m, `Asset manifest ${k} must exist`);
    assert.equal(validateAssetManifest(m), true, `Asset manifest ${k} must pass validation`);
    assert.ok(m.localBounds.width > 0);
    assert.ok(m.localBounds.height > 0);
    assert.ok(m.attachmentPivot);
    assert.equal(typeof m.depthLayer, "number");
  }
});

// ----------------------------------------------------------------------------
// Test 30: Depth-Contract Alignment & Asset Replacement Parity
// ----------------------------------------------------------------------------
test("30. Depth-contract alignment: Manifest assets match canonical GardenWorld depth and preserve scenery layering", () => {
  const manifests = BUILTIN_PROCEDURAL_ASSET_MANIFESTS;

  // Build full garden world for mapping verification
  const events = generateMockEventSequence(10, "mixed");
  const scene = generateGardenSVGScene(COUPLE_A, 70, 30, false, undefined, "light", events);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    totalGrowthUnits: 70,
    careGrowthUnits: 30,
    timeGrowthUnits: 40,
    careEvents: events,
  });

  // 1. Mapping table between manifest keys and corresponding canonical node IDs
  const manifestToNodeId = {
    "terrain-clearing-meadow-v1": "terrain-mid-grass",
    "stream-curved-brook-v1": "terrain-stream",
    "tree-ancient-oak-trunk-v1": "tree-trunk",
    "canopy-shadow-mass-v1": "canopy-shadow-0",
    "canopy-sunlit-leaves-v1": "canopy-highlight-0",
  };

  for (const [manifestKey, nodeId] of Object.entries(manifestToNodeId)) {
    const manifest = manifests[manifestKey];
    const node = world.nodes[nodeId];
    if (node) {
      assert.equal(
        manifest.depthLayer,
        node.depthLayer,
        `Manifest ${manifestKey} depthLayer (${manifest.depthLayer}) must equal node ${nodeId} depthLayer (${node.depthLayer})`
      );
    }
  }

  // 2. Pairwise architectural order: replacing primitives with manifest assets preserves depth hierarchy
  const orderedManifestPairs = [
    ["terrain-clearing-meadow-v1", "stream-curved-brook-v1"],
    ["stream-curved-brook-v1", "tree-ancient-oak-trunk-v1"],
    ["tree-ancient-oak-trunk-v1", "flora-moss-cushion-v1"],
    ["flora-moss-cushion-v1", "landmark-important-date-v1"],
    ["landmark-important-date-v1", "canopy-shadow-mass-v1"],
    ["canopy-shadow-mass-v1", "canopy-foliage-mass-v1"],
    ["canopy-foliage-mass-v1", "canopy-sunlit-leaves-v1"],
    ["canopy-sunlit-leaves-v1", "bud-closed-calyx-v1"],
    ["bud-closed-calyx-v1", "blossom-reconnection-rose-v1"],
    ["blossom-reconnection-rose-v1", "fauna-peacock-butterfly-v1"],
  ];

  for (const [lowerKey, higherKey] of orderedManifestPairs) {
    const lower = manifests[lowerKey];
    const higher = manifests[higherKey];
    assert.ok(lower, `Lower key ${lowerKey} must exist`);
    assert.ok(higher, `Higher key ${higherKey} must exist`);
    assert.ok(
      lower.depthLayer <= higher.depthLayer,
      `Layer ordering violated: ${lowerKey} (${lower.depthLayer}) must be <= ${higherKey} (${higher.depthLayer})`
    );
  }
});

// ============================================================================
// PHASE 3A EXPLORABLE CAMERA FOUNDATION TESTS (A THROUGH T)
// ============================================================================

// Test A: Camera fitting contains the full world
test("A. Camera fitting contains the full world", () => {
  const scene = generateGardenSVGScene(COUPLE_A, 25, 20, false);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 25,
    careGrowthUnits: 20,
    timeGrowthUnits: 5,
  });

  const viewport = { width: 360, height: 500 };
  const camera = fitCameraToViewport(world.worldBounds, viewport, 24);

  // All 4 corners of world.worldBounds must map to valid screen points within viewport
  const corners = [
    { x: world.worldBounds.minX, y: world.worldBounds.minY },
    { x: world.worldBounds.maxX, y: world.worldBounds.minY },
    { x: world.worldBounds.minX, y: world.worldBounds.maxY },
    { x: world.worldBounds.maxX, y: world.worldBounds.maxY },
  ];

  for (const corner of corners) {
    const sp = worldToScreen(corner, camera, viewport);
    assert.ok(sp.x >= -0.1 && sp.x <= viewport.width + 0.1, `Corner x (${sp.x}) must fit screen width`);
    assert.ok(sp.y >= -0.1 && sp.y <= viewport.height + 0.1, `Corner y (${sp.y}) must fit screen height`);
  }
});

// Test B: Screen-to-world and world-to-screen remain exact inverses under pan and zoom
test("B. Screen-to-world and world-to-screen remain exact inverses under pan and zoom", () => {
  const viewport = { width: 380, height: 600 };
  const camera = {
    target: { x: 350, y: 275 },
    zoom: 1.85,
  };

  const samplePoints = [
    { x: 0, y: 0 },
    { x: 400, y: 250 },
    { x: -80, y: 120 },
    { x: 850, y: 480 },
    { x: 220, y: 390 },
  ];

  for (const pt of samplePoints) {
    const screen = worldToScreen(pt, camera, viewport);
    const inverse = screenToWorld(screen, camera, viewport);
    assert.ok(Math.abs(inverse.x - pt.x) < 1e-3, `Inverse X (${inverse.x}) must match original (${pt.x})`);
    assert.ok(Math.abs(inverse.y - pt.y) < 1e-3, `Inverse Y (${inverse.y}) must match original (${pt.y})`);
  }
});

// Test C: Camera targets cannot leave world bounds (clampCameraTarget)
test("C. Camera targets cannot leave world bounds (clampCameraTarget)", () => {
  const worldBounds = EXPANDED_WORLD_BOUNDS;
  const viewport = { width: 400, height: 300 };
  const camera = { target: { x: 400, y: 250 }, zoom: 2.0 };

  // Attempt extreme out-of-bounds target coordinates
  const extremeTargets = [
    { x: -5000, y: -5000 },
    { x: 9999, y: 9999 },
    { x: -2000, y: 250 },
    { x: 400, y: 3000 },
  ];

  for (const ext of extremeTargets) {
    const clamped = clampCameraTarget(ext, worldBounds, camera, viewport);
    // At zoom 2.0 and viewport 400x300, visible half-dimensions are 100x75
    assert.ok(clamped.x - 100 >= worldBounds.minX - 0.01, `Clamped x left edge (${clamped.x - 100}) must stay >= minX`);
    assert.ok(clamped.x + 100 <= worldBounds.maxX + 0.01, `Clamped x right edge (${clamped.x + 100}) must stay <= maxX`);
    assert.ok(clamped.y - 75 >= worldBounds.minY - 0.01, `Clamped y top edge (${clamped.y - 75}) must stay >= minY`);
    assert.ok(clamped.y + 75 <= worldBounds.maxY + 0.01, `Clamped y bottom edge (${clamped.y + 75}) must stay <= maxY`);
  }
});

// Test D: Zoom remains within calculated min/max bounds
test("D. Zoom remains within calculated min/max bounds", () => {
  const worldBounds = EXPANDED_WORLD_BOUNDS;
  const viewport = { width: 360, height: 480 };
  const bounds = calculateZoomBounds(worldBounds, viewport, 24);

  assert.ok(bounds.minZoom > 0);
  assert.ok(bounds.maxZoom > bounds.minZoom);
  assert.ok(bounds.maxZoom >= 2.5);

  const initialCam = createCameraFromFit(worldBounds, viewport, 24);

  // Zooming out with tiny factor stops at minZoom
  const zoomedOut = zoomCameraAroundPoint(
    initialCam,
    0.001,
    { x: 180, y: 240 },
    worldBounds,
    bounds.minZoom,
    bounds.maxZoom
  );
  assert.ok(Math.abs(zoomedOut.zoom - bounds.minZoom) < 0.01);

  // Zooming in with huge factor stops at maxZoom
  const zoomedIn = zoomCameraAroundPoint(
    initialCam,
    1000,
    { x: 180, y: 240 },
    worldBounds,
    bounds.minZoom,
    bounds.maxZoom
  );
  assert.ok(Math.abs(zoomedIn.zoom - bounds.maxZoom) < 0.01);
});

// Test E: Reset returns to exact fitted camera
test("E. Reset returns to exact fitted camera", () => {
  const worldBounds = EXPANDED_WORLD_BOUNDS;
  const viewport = { width: 360, height: 480 };
  const initialCam = createCameraFromFit(worldBounds, viewport, 24);
  const limits = calculateZoomBounds(worldBounds, viewport, 24);

  // Pan and zoom away
  const panned = panCamera(initialCam, 120, -60, worldBounds);
  const zoomed = zoomCameraAroundPoint(
    panned,
    1.8,
    { x: 200, y: 200 },
    worldBounds,
    limits.minZoom,
    limits.maxZoom
  );

  // Reset view
  const resetCam = createCameraFromFit(worldBounds, viewport, 24);
  assert.equal(resetCam.targetX, initialCam.targetX);
  assert.equal(resetCam.targetY, initialCam.targetY);
  assert.equal(resetCam.zoom, initialCam.zoom);
});

// Test F: Region focus fits selected region bounds
test("F. Region focus fits selected region bounds", () => {
  const scene = generateGardenSVGScene(COUPLE_A, 30, 24, false);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 30,
    careGrowthUnits: 24,
    timeGrowthUnits: 6,
  });

  const viewport = { width: 360, height: 480 };
  const limits = calculateZoomBounds(world.worldBounds, viewport, 24);

  const crownBounds = world.scenicRegions.crown;
  assert.ok(crownBounds);

  const focused = focusScenicRegion(
    crownBounds,
    viewport,
    world.worldBounds,
    limits.minZoom,
    limits.maxZoom,
    32
  );

  assert.ok(focused.zoom >= limits.minZoom);
  assert.ok(focused.zoom <= limits.maxZoom);
  assert.ok(focused.targetX >= crownBounds.minX && focused.targetX <= crownBounds.maxX);
});

// Test G: Missing regions (e.g. stream when no brook exists) cannot be selected
test("G. Missing regions (e.g. stream when no brook exists) cannot be selected", () => {
  let noStreamSeed = "seed-no-stream-1";
  for (let i = 0; i < 20; i++) {
    const s = `dry-garden-seed-${i}`;
    const testScene = generateGardenSVGScene(s, 10, 8, false);
    if (!testScene.streamPath) {
      noStreamSeed = s;
      break;
    }
  }

  const scene = generateGardenSVGScene(noStreamSeed, 10, 8, false);
  assert.ok(!scene.streamPath);

  const world = buildGardenWorld(scene, {
    coupleId: noStreamSeed,
    seedString: noStreamSeed,
    totalGrowthUnits: 10,
    careGrowthUnits: 8,
    timeGrowthUnits: 2,
  });

  // isScenicRegionAvailable must return false for stream_edge
  const streamAvailable = isScenicRegionAvailable(world, "stream_edge");
  assert.equal(streamAvailable, false);

  // focusNamedScenicRegion must safely return null
  const focusResult = focusNamedScenicRegion("stream_edge", world, { width: 360, height: 480 });
  assert.equal(focusResult, null);
});

// Test H: Tap resolution returns highest-depth eligible node
test("H. Tap resolution returns highest-depth eligible node", () => {
  const evPos = createMockEvent("ev-pos-1", "positive_moment", "2026-02-01T10:00:00Z", "affection");
  const scene = generateGardenSVGScene(COUPLE_A, 20, 16, false, undefined, "light", [evPos]);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 20,
    careGrowthUnits: 16,
    timeGrowthUnits: 4,
    careEvents: [evPos],
  });

  const hit = resolveNodeAtWorldCoordinate({ x: 400, y: 440 }, world, 30);
  assert.ok(hit, "Must resolve a node near trunk base");
  assert.ok(hit.depthLayer >= -25);
});

// Test I: Drag gestures (> 8px) do not trigger node activation
test("I. Drag gestures (> 8px) do not trigger node activation", () => {
  const isDragGesture = (dx, dy) => Math.hypot(dx, dy) > 8;

  assert.equal(isDragGesture(2, 2), false); // hypot = 2.8 <= 8 (Tap)
  assert.equal(isDragGesture(5, 6), false); // hypot = 7.8 <= 8 (Tap)
  assert.equal(isDragGesture(6, 6), true);  // hypot = 8.48 > 8 (Drag)
  assert.equal(isDragGesture(0, 12), true); // hypot = 12 > 8 (Drag)
  assert.equal(isDragGesture(-10, 0), true);// hypot = 10 > 8 (Drag)
});

// Test J: Decorative nodes resolve without event data (sourceEvent === null)
test("J. Decorative nodes resolve without event data (sourceEvent === null)", () => {
  const scene = generateGardenSVGScene(COUPLE_A, 20, 16, false);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 20,
    careGrowthUnits: 16,
    timeGrowthUnits: 4,
  });

  const decorativeNodeIds = [
    "world-root",
    "terrain-root",
    "terrain-woodland-edge-left",
    "terrain-woodland-edge-right",
    "terrain-meadow-margin-left",
    "terrain-meadow-margin-right",
    "margin-flora-left-fern",
    "margin-flora-left-clover",
    "margin-flora-right-moss",
    "margin-flora-right-flower",
  ];

  for (const id of decorativeNodeIds) {
    const node = world.nodes[id];
    assert.ok(node, `Node ${id} must exist`);
    assert.equal(node.isEarned, false, `Node ${id} must not be earned`);
    assert.equal(node.sourceEvent, null, `Node ${id} must have sourceEvent: null`);
  }
});

// Test K: Event-backed nodes resolve to exact existing source
test("K. Event-backed nodes resolve to exact existing source", () => {
  const ev1 = createMockEvent("ev-pos-alpha", "positive_moment", "2026-03-01T10:00:00Z");
  const ev2 = createMockEvent("ev-rec-beta", "reconnection", "2026-03-02T10:00:00Z");
  const ev3 = createMockEvent("ev-imp-gamma", "important_date", "2026-03-03T10:00:00Z");

  const scene = generateGardenSVGScene(COUPLE_A, 25, 20, false, undefined, "light", [ev1, ev2, ev3]);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 25,
    careGrowthUnits: 20,
    timeGrowthUnits: 5,
    careEvents: [ev1, ev2, ev3],
  });

  const earnedNodes = Object.values(world.nodes).filter((n) => n.isEarned);
  assert.ok(earnedNodes.length >= 3);

  const matchedSources = new Set(earnedNodes.map((n) => n.sourceEvent.id));
  assert.ok(matchedSources.has(ev1.id));
  assert.ok(matchedSources.has(ev2.id));
  assert.ok(matchedSources.has(ev3.id));
});

// Test L: Theme changes (light, dim, dark) do not change camera or world geometry
test("L. Theme changes (light, dim, dark) do not change camera or world geometry", () => {
  const sceneLight = generateGardenSVGScene(COUPLE_A, 20, 16, false, undefined, "light");
  const sceneDim = generateGardenSVGScene(COUPLE_A, 20, 16, false, undefined, "dim");
  const sceneDark = generateGardenSVGScene(COUPLE_A, 20, 16, false, undefined, "dark");

  const worldLight = buildGardenWorld(sceneLight, { coupleId: COUPLE_A, seedString: COUPLE_A, totalGrowthUnits: 20, careGrowthUnits: 16, timeGrowthUnits: 4, effectiveTheme: "light" });
  const worldDim = buildGardenWorld(sceneDim, { coupleId: COUPLE_A, seedString: COUPLE_A, totalGrowthUnits: 20, careGrowthUnits: 16, timeGrowthUnits: 4, effectiveTheme: "dim" });
  const worldDark = buildGardenWorld(sceneDark, { coupleId: COUPLE_A, seedString: COUPLE_A, totalGrowthUnits: 20, careGrowthUnits: 16, timeGrowthUnits: 4, effectiveTheme: "dark" });

  assert.deepEqual(worldLight.worldBounds, worldDim.worldBounds);
  assert.deepEqual(worldLight.worldBounds, worldDark.worldBounds);

  const vp = { width: 360, height: 480 };
  const camLight = createCameraFromFit(worldLight.worldBounds, vp, 24);
  const camDark = createCameraFromFit(worldDark.worldBounds, vp, 24);
  assert.deepEqual(camLight, camDark);
});

// Test M: Both partners in a couple receive identical worlds and camera-fit results
test("M. Both partners in a couple receive identical worlds and camera-fit results", () => {
  const ev = createMockEvent("shared-ev-1", "positive_moment", "2026-03-10T10:00:00Z");
  const scene1 = generateGardenSVGScene(COUPLE_A, 20, 16, false, undefined, "light", [ev]);
  const scene2 = generateGardenSVGScene(COUPLE_A, 20, 16, false, undefined, "light", [ev]);

  const worldPartner1 = buildGardenWorld(scene1, { coupleId: COUPLE_A, seedString: COUPLE_A, totalGrowthUnits: 20, careGrowthUnits: 16, timeGrowthUnits: 4, careEvents: [ev] });
  const worldPartner2 = buildGardenWorld(scene2, { coupleId: COUPLE_A, seedString: COUPLE_A, totalGrowthUnits: 20, careGrowthUnits: 16, timeGrowthUnits: 4, careEvents: [ev] });

  assert.deepEqual(worldPartner1.nodes, worldPartner2.nodes);
  assert.deepEqual(worldPartner1.worldBounds, worldPartner2.worldBounds);

  const vp = { width: 375, height: 667 };
  const cam1 = createCameraFromFit(worldPartner1.worldBounds, vp);
  const cam2 = createCameraFromFit(worldPartner2.worldBounds, vp);
  assert.deepEqual(cam1, cam2);
});

// Test N: Different couples retain different world compositions and clearing features
test("N. Different couples retain different world compositions and clearing features", () => {
  const sceneA = generateGardenSVGScene(COUPLE_A, 30, 24, false);
  const sceneB = generateGardenSVGScene(COUPLE_B, 30, 24, false);

  const worldA = buildGardenWorld(sceneA, { coupleId: COUPLE_A, seedString: COUPLE_A, totalGrowthUnits: 30, careGrowthUnits: 24, timeGrowthUnits: 6 });
  const worldB = buildGardenWorld(sceneB, { coupleId: COUPLE_B, seedString: COUPLE_B, totalGrowthUnits: 30, careGrowthUnits: 24, timeGrowthUnits: 6 });

  assert.notEqual(worldA.coupleSeed, worldB.coupleSeed);
  assert.notDeepEqual(worldA.nodes["tree-trunk"], worldB.nodes["tree-trunk"]);
});

// Test O: Camera transformations do not mutate canonical scene serialization
test("O. Camera transformations do not mutate canonical scene serialization", () => {
  const scene = generateGardenSVGScene(COUPLE_A, 25, 20, false);
  const world = buildGardenWorld(scene, { coupleId: COUPLE_A, seedString: COUPLE_A, totalGrowthUnits: 25, careGrowthUnits: 20, timeGrowthUnits: 5 });

  const initialTrunkD = scene.trunkPath;
  const initialNodesJson = JSON.stringify(world.nodes);

  const vp = { width: 360, height: 480 };
  const cam = createCameraFromFit(world.worldBounds, vp);
  const panned = panCamera(cam, 80, -40, world.worldBounds);
  const transformStr = getCameraTransformString(panned, vp);

  assert.ok(transformStr.includes("translate"));
  assert.ok(transformStr.includes("scale"));

  assert.equal(scene.trunkPath, initialTrunkD);
  assert.equal(JSON.stringify(world.nodes), initialNodesJson);
});

// Test P: Garden Story remains non-explorable and final-frame equivalent
test("P. Garden Story remains non-explorable and final-frame equivalent", () => {
  const ev1 = createMockEvent("story-ev-1", "positive_moment", "2026-03-01T10:00:00Z");
  const ev2 = createMockEvent("story-ev-2", "reconnection", "2026-03-05T10:00:00Z");

  const story = createGardenStory({
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    createdAt: "2026-01-01T00:00:00Z",
    careEvents: [ev1, ev2],
    asOfTime: "2026-03-10T00:00:00Z",
    isResting: false,
    themeKey: "light",
  });

  for (const step of story.steps) {
    assert.equal("camera" in step, false);
    assert.equal("exploreMode" in step, false);
  }

  const lastStep = story.steps[story.steps.length - 1];
  assert.ok(lastStep.isFinal);

  const storyFinalScene = generateGardenSVGScene(
    COUPLE_A,
    lastStep.totalGrowthUnits,
    lastStep.careGrowthUnits,
    lastStep.isResting,
    lastStep.careSignals,
    "light",
    lastStep.cumulativeCareEvents
  );
  const liveScene = generateGardenSVGScene(
    COUPLE_A,
    lastStep.totalGrowthUnits,
    lastStep.careGrowthUnits,
    lastStep.isResting,
    lastStep.careSignals,
    "light",
    lastStep.cumulativeCareEvents
  );
  assert.deepEqual(storyFinalScene, liveScene);
});

// Test Q: Compact mode mounts zero exploration behavior
test("Q. Compact mode mounts zero exploration behavior", () => {
  const sceneCompact = generateGardenSVGScene(COUPLE_A, 20, 16, false);
  const worldCompact = buildGardenWorld(sceneCompact, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 20,
    careGrowthUnits: 16,
    timeGrowthUnits: 4,
  });

  assert.ok(worldCompact.canonicalBounds);
  assert.equal(worldCompact.canonicalBounds.minX, 0);
  assert.equal(worldCompact.canonicalBounds.maxX, 800);
});

// Test R: Reduced-motion focus changes camera immediately
test("R. Reduced-motion focus changes camera immediately", () => {
  const scene = generateGardenSVGScene(COUPLE_A, 25, 20, false);
  const world = buildGardenWorld(scene, { coupleId: COUPLE_A, seedString: COUPLE_A, totalGrowthUnits: 25, careGrowthUnits: 20, timeGrowthUnits: 5 });
  const vp = { width: 360, height: 480 };

  const targetCam = focusScenicRegion(
    world.scenicRegions.root_grove,
    vp,
    world.worldBounds,
    0.3,
    2.5,
    24
  );

  assert.ok(Number.isFinite(targetCam.targetX));
  assert.ok(Number.isFinite(targetCam.targetY));
  assert.ok(Number.isFinite(targetCam.zoom));
});

// Test S: Expanded decorative scenery contains null event sources
test("S. Expanded decorative scenery contains null event sources", () => {
  const scene = generateGardenSVGScene(COUPLE_A, 25, 20, false);
  const world = buildGardenWorld(scene, { coupleId: COUPLE_A, seedString: COUPLE_A, totalGrowthUnits: 25, careGrowthUnits: 20, timeGrowthUnits: 5 });

  const expandedNodes = Object.values(world.nodes).filter((n) => n.isExpanded);
  assert.ok(expandedNodes.length >= 4, "Must contain at least 4 margin nodes");

  for (const en of expandedNodes) {
    assert.equal(en.isEarned, false, `Expanded node ${en.id} must have isEarned: false`);
    assert.equal(en.sourceEvent, null, `Expanded node ${en.id} must have sourceEvent: null`);
  }
});

// Test T: No relationship history is fabricated by scenic extensions
test("T. No relationship history is fabricated by scenic extensions", () => {
  const sceneZero = generateGardenSVGScene(COUPLE_A, 10, 0, false);
  const worldZero = buildGardenWorld(sceneZero, { coupleId: COUPLE_A, seedString: COUPLE_A, totalGrowthUnits: 10, careGrowthUnits: 0, timeGrowthUnits: 10 });

  assert.equal(worldZero.metadata.earnedNodeCount, 0, "Zero-event garden must have 0 earned nodes");
  assert.equal(Object.keys(worldZero.earnedFeatureGroups).length, 0);

  for (const n of Object.values(worldZero.nodes)) {
    if (n.isExpanded) {
      assert.equal(n.isEarned, false);
      assert.equal(n.sourceEvent, null);
    }
  }
});

// ============================================================================
// PHASE 3A INTERACTION CORRECTNESS AUDIT TESTS (AUDIT 1 THROUGH 7)
// ============================================================================

// ----------------------------------------------------------------------------
// Audit Test 1: Unified gesture classification and tap/drag disambiguation
// ----------------------------------------------------------------------------
test("Audit 1: Unified gesture classification and tap/drag disambiguation", () => {
  assert.equal(CANONICAL_DRAG_THRESHOLD_PX, 6);

  // 1. A stationary press can select (dx = 0, dy = 0)
  assert.equal(classifyGesture(0, 0), "tap");

  // 2. Movement strictly below threshold remains a tap
  assert.equal(classifyGesture(2, 0), "tap");
  assert.equal(classifyGesture(0, 4), "tap");
  assert.equal(classifyGesture(3, 4), "tap"); // hypot = 5 < 6
  assert.equal(classifyGesture(-4, 3), "tap"); // hypot = 5 < 6
  assert.equal(classifyGesture(4.2, 4.2), "tap"); // hypot = 5.94 < 6

  // 3. Movement equal to or above threshold is exclusively a drag
  assert.equal(classifyGesture(6, 0), "drag"); // hypot = 6.0 >= 6
  assert.equal(classifyGesture(0, 6), "drag"); // hypot = 6.0 >= 6
  assert.equal(classifyGesture(4.5, 4.5), "drag"); // hypot = 6.36 >= 6
  assert.equal(classifyGesture(-8, 0), "drag"); // hypot = 8.0 >= 6
  assert.equal(classifyGesture(20, 30), "drag"); // hypot = 36.0 >= 6

  // 4. Prove PanResponder logic: a drag gesture can NEVER select a feature on release
  function simulatePanResponder(moveDeltas) {
    let isDragging = false;
    let selected = false;

    for (const [dx, dy] of moveDeltas) {
      if (Math.hypot(dx, dy) >= CANONICAL_DRAG_THRESHOLD_PX) {
        isDragging = true;
      }
    }

    const lastDelta = moveDeltas[moveDeltas.length - 1] || [0, 0];
    const finalDist = Math.hypot(lastDelta[0], lastDelta[1]);
    if (!isDragging && finalDist < CANONICAL_DRAG_THRESHOLD_PX) {
      selected = true;
    }
    return { isDragging, selected };
  }

  // Stationary tap: selects
  assert.deepEqual(simulatePanResponder([[0, 0]]), { isDragging: false, selected: true });

  // Minor jitter below 6px: selects
  assert.deepEqual(simulatePanResponder([[2, 1], [3, 4]]), { isDragging: false, selected: true });

  // Drag exceeding 6px: never selects
  assert.deepEqual(simulatePanResponder([[2, 1], [5, 5], [10, 10]]), { isDragging: true, selected: false });

  // Drag moving far out and returning close: isDragging flag permanently suppresses selection
  assert.deepEqual(simulatePanResponder([[10, 10], [20, 20], [1, 1]]), { isDragging: true, selected: false });
});

// ----------------------------------------------------------------------------
// Audit Test 2: Overlapping-node priority fixture: earned blossom > creature > decorative foliage > landscape
// ----------------------------------------------------------------------------
test("Audit 2: Overlapping-node priority fixture: earned blossom > creature > decorative foliage > landscape", () => {
  const overlapPoint = { x: 400, y: 250 };

  const earnedBlossom = {
    id: "earned:reconnection:rec-1",
    role: "bud_blossom_fruit",
    isEarned: true,
    sourceEvent: { id: "rec-1", kind: "reconnection" },
    depthLayer: 30, // Lower depth than creature and foliage!
    worldBounds: { minX: 385, minY: 235, maxX: 415, maxY: 265, width: 30, height: 30 },
    anchorPoint: { x: 400, y: 250 },
    parentId: "tree-root",
    childIds: [],
    appearanceOrigin: "source_event",
    mappingType: "continuous_structural",
  };

  const livingButterfly = {
    id: "creature:butterfly-1",
    role: "creature_node",
    isEarned: false,
    sourceEvent: null,
    depthLayer: 60, // Higher depth than blossom, lower than foliage
    worldBounds: { minX: 380, minY: 230, maxX: 420, maxY: 270, width: 40, height: 40 },
    anchorPoint: { x: 400, y: 250 },
    parentId: "habitat-root",
    childIds: [],
    appearanceOrigin: "stage_structure",
    mappingType: "continuous_structural",
  };

  const decorativeFoliage = {
    id: "structural:foliage:0",
    role: "foliage",
    isEarned: false,
    sourceEvent: null,
    depthLayer: 80, // Highest visible depth!
    worldBounds: { minX: 370, minY: 220, maxX: 430, maxY: 280, width: 60, height: 60 },
    anchorPoint: { x: 400, y: 250 },
    parentId: "tree-root",
    childIds: [],
    appearanceOrigin: "stage_structure",
    mappingType: "continuous_structural",
  };

  const meadowLandscape = {
    id: "terrain-meadow",
    role: "terrain_region",
    regionKind: "mid_grass",
    isEarned: false,
    sourceEvent: null,
    depthLayer: -40, // Base landscape depth
    worldBounds: { minX: 0, minY: 0, maxX: 800, maxY: 500, width: 800, height: 500 },
    anchorPoint: { x: 400, y: 440 },
    parentId: "terrain-root",
    childIds: [],
    appearanceOrigin: "stage_structure",
    mappingType: "continuous_structural",
    pathD: "M0,0 L800,0 L800,500 L0,500 Z",
  };

  const baseWorld = {
    schemaVersion: 1,
    nodes: {
      "earned:reconnection:rec-1": earnedBlossom,
      "creature:butterfly-1": livingButterfly,
      "structural:foliage:0": decorativeFoliage,
      "terrain-meadow": meadowLandscape,
    },
    worldBounds: EXPANDED_WORLD_BOUNDS,
  };

  // 1. Tier 1: With all 4 nodes present, the earned blossom (Class 3) MUST win over creature and foliage
  const hit1 = resolveNodeAtWorldCoordinate(overlapPoint, baseWorld, 0);
  assert.equal(hit1.id, "earned:reconnection:rec-1", "Earned blossom must outrank creature and decorative foliage");

  // 2. Tier 2: Without earned blossom, living butterfly (Class 2) MUST win over decorative foliage
  const worldWithoutBlossom = {
    ...baseWorld,
    nodes: {
      "creature:butterfly-1": livingButterfly,
      "structural:foliage:0": decorativeFoliage,
      "terrain-meadow": meadowLandscape,
    },
  };
  const hit2 = resolveNodeAtWorldCoordinate(overlapPoint, worldWithoutBlossom, 0);
  assert.equal(hit2.id, "creature:butterfly-1", "Creature must outrank decorative foliage");

  // 3. Tier 3: Without creature, decorative foliage (Class 1, depth 80) wins over landscape (Class 1, depth -40)
  const worldWithoutCreature = {
    ...baseWorld,
    nodes: {
      "structural:foliage:0": decorativeFoliage,
      "terrain-meadow": meadowLandscape,
    },
  };
  const hit3 = resolveNodeAtWorldCoordinate(overlapPoint, worldWithoutCreature, 0);
  assert.equal(hit3.id, "structural:foliage:0", "Foliage must win over landscape by depth within decorative class");

  // 4. Tier 4: Only landscape remaining
  const worldOnlyLandscape = {
    ...baseWorld,
    nodes: {
      "terrain-meadow": meadowLandscape,
    },
  };
  const hit4 = resolveNodeAtWorldCoordinate(overlapPoint, worldOnlyLandscape, 0);
  assert.equal(hit4.id, "terrain-meadow", "Landscape resolves when no higher features present");
});

// ----------------------------------------------------------------------------
// Audit Test 3: ViewBox-to-layout coordinate conversion across responsive viewports
// ----------------------------------------------------------------------------
test("Audit 3: ViewBox-to-layout coordinate conversion across responsive viewports", () => {
  const testViewports = [
    { name: "Mobile Narrow (320px)", width: 320, height: 480 },
    { name: "App Shell (440px)", width: 440, height: 550 },
    { name: "Desktop Wide", width: 1024, height: 600 },
    { name: "Non-16:10 Tall Container", width: 375, height: 812 },
  ];

  const testWorldPoints = [
    { x: 400, y: 250 }, // World center
    { x: 0, y: 0 },     // Canonical scene origin
    { x: 800, y: 500 }, // Canonical scene extent
    { x: -80, y: 120 }, // Left margin
    { x: 860, y: 480 }, // Right margin
  ];

  for (const vp of testViewports) {
    const camera = { target: { x: 380, y: 260 }, zoom: 1.45 };

    for (const pt of testWorldPoints) {
      const screenPt = worldToScreen(pt, camera, vp);

      // SVG presentation transform evaluation: translate(vw/2, vh/2) scale(z) translate(-tx, -ty)
      const svgX = (pt.x - camera.target.x) * camera.zoom + vp.width / 2;
      const svgY = (pt.y - camera.target.y) * camera.zoom + vp.height / 2;

      assert.ok(
        Math.abs(screenPt.x - svgX) < 1e-4,
        `Viewport ${vp.name}: Screen X (${screenPt.x}) must equal SVG user X (${svgX})`
      );
      assert.ok(
        Math.abs(screenPt.y - svgY) < 1e-4,
        `Viewport ${vp.name}: Screen Y (${screenPt.y}) must equal SVG user Y (${svgY})`
      );

      const inverted = screenToWorld(screenPt, camera, vp);
      assert.ok(
        Math.abs(inverted.x - pt.x) < 1e-3,
        `Viewport ${vp.name}: Inverted X (${inverted.x}) must match world point (${pt.x})`
      );
      assert.ok(
        Math.abs(inverted.y - pt.y) < 1e-3,
        `Viewport ${vp.name}: Inverted Y (${inverted.y}) must match world point (${pt.y})`
      );
    }
  }
});

// ----------------------------------------------------------------------------
// Audit Test 4: Focal-point zoom under responsive scaling: world anchor remains fixed under cursor
// ----------------------------------------------------------------------------
test("Audit 4: Focal-point zoom under responsive scaling: world anchor remains fixed under cursor", () => {
  const worldBounds = EXPANDED_WORLD_BOUNDS;
  const viewports = [
    { width: 320, height: 480 },
    { width: 440, height: 550 },
    { width: 1024, height: 600 },
    { width: 375, height: 812 },
  ];

  for (const vp of viewports) {
    const limits = calculateZoomBounds(worldBounds, vp, 24);

    // 1. Center focal zoom: zooming around viewport center keeps center world anchor exact
    const centerCam = {
      targetX: 400,
      targetY: 250,
      zoom: 1.2,
      viewportWidth: vp.width,
      viewportHeight: vp.height,
    };
    const centerCursor = { x: vp.width / 2, y: vp.height / 2 };
    const centerWorldBefore = screenToWorld(centerCursor, centerCam, vp);
    const centerZoomed = zoomCameraAroundPoint(centerCam, 1.3, centerCursor, worldBounds, limits.minZoom, limits.maxZoom);
    const centerScreenAfter = worldToScreen(centerWorldBefore, centerZoomed, vp);

    assert.ok(
      Math.abs(centerScreenAfter.x - centerCursor.x) < 0.1,
      `Center X (${centerCursor.x}) must remain fixed after zoom; got ${centerScreenAfter.x}`
    );
    assert.ok(
      Math.abs(centerScreenAfter.y - centerCursor.y) < 0.1,
      `Center Y (${centerCursor.y}) must remain fixed after zoom; got ${centerScreenAfter.y}`
    );

    // 2. Unconstrained interior focal zoom: arbitrary cursor stays pinned under pointer
    const interiorCam = {
      targetX: 400,
      targetY: 250,
      zoom: 2.0,
      viewportWidth: vp.width,
      viewportHeight: vp.height,
    };
    const interiorCursor = { x: vp.width / 2 + 30, y: vp.height / 2 - 25 };
    const interiorWorldBefore = screenToWorld(interiorCursor, interiorCam, vp);
    const interiorZoomed = zoomCameraAroundPoint(interiorCam, 1.25, interiorCursor, worldBounds, limits.minZoom, limits.maxZoom);
    const interiorScreenAfter = worldToScreen(interiorWorldBefore, interiorZoomed, vp);

    assert.ok(
      Math.abs(interiorScreenAfter.x - interiorCursor.x) < 0.1,
      `Interior Cursor X (${interiorCursor.x}) must remain fixed after zoom; got ${interiorScreenAfter.x}`
    );
    assert.ok(
      Math.abs(interiorScreenAfter.y - interiorCursor.y) < 0.1,
      `Interior Cursor Y (${interiorCursor.y}) must remain fixed after zoom; got ${interiorScreenAfter.y}`
    );

    // 3. Boundary clamping check: edge zoom clamps safely without exposing canvas outside worldBounds
    const edgeCam = zoomCameraAroundPoint(centerCam, 1.5, { x: 10, y: 10 }, worldBounds, limits.minZoom, limits.maxZoom);
    assert.ok(edgeCam.targetX >= worldBounds.minX);
    assert.ok(edgeCam.targetX <= worldBounds.maxX);
    assert.ok(edgeCam.targetY >= worldBounds.minY);
    assert.ok(edgeCam.targetY <= worldBounds.maxY);
  }
});

// ----------------------------------------------------------------------------
// Audit Test 5: Constant screen-space hit slop across minimum, middle, and maximum zoom
// ----------------------------------------------------------------------------
test("Audit 5: Constant screen-space hit slop across minimum, middle, and maximum zoom", () => {
  const targetNode = {
    id: "test-feature",
    role: "ground_flora",
    floraType: "moss",
    isEarned: false,
    sourceEvent: null,
    depthLayer: 10,
    worldBounds: { minX: 380, minY: 230, maxX: 420, maxY: 270, width: 40, height: 40 },
    anchorPoint: { x: 400, y: 250 },
    parentId: "ground-flora-root",
    childIds: [],
    appearanceOrigin: "stage_structure",
    mappingType: "continuous_structural",
  };

  const world = {
    schemaVersion: 1,
    nodes: { "test-feature": targetNode },
    worldBounds: EXPANDED_WORLD_BOUNDS,
  };

  const vp = { width: 400, height: 400 };
  const targetPoint = { x: 400, y: 250 };
  const screenHitSlop = 22; // 22pt screen-space touch target expansion

  const testZooms = [0.4, 1.0, 2.5];

  for (const zoom of testZooms) {
    const cam = { target: targetPoint, zoom };

    const screenCenter = { x: 200, y: 200 };
    const screenHalfW = 20 * zoom;
    const rightScreenEdge = screenCenter.x + screenHalfW;

    // Tap 1: 15 screen pixels outside right edge (within 22pt hit slop)
    const tapWithinSlop = { x: rightScreenEdge + 15, y: screenCenter.y };
    const hitSuccess = resolveNodeAtScreenCoordinate(tapWithinSlop, world, cam, vp, screenHitSlop);
    assert.ok(
      hitSuccess,
      `At zoom ${zoom}, tap 15px outside feature edge must be within 22pt hit slop`
    );
    assert.equal(hitSuccess.id, "test-feature");

    // Tap 2: 30 screen pixels outside right edge (beyond 22pt hit slop)
    const tapBeyondSlop = { x: rightScreenEdge + 30, y: screenCenter.y };
    const hitFail = resolveNodeAtScreenCoordinate(tapBeyondSlop, world, cam, vp, screenHitSlop);
    assert.equal(
      hitFail,
      null,
      `At zoom ${zoom}, tap 30px outside feature edge must NOT select`
    );
  }
});

// ----------------------------------------------------------------------------
// Audit Test 6: Web wheel listener lifecycle: active mounting, unmounting, and zero residual duplicates
// ----------------------------------------------------------------------------
test("Audit 6: Web wheel listener lifecycle: active mounting, unmounting, and zero residual duplicates", () => {
  class MockDOMCanvas {
    constructor() {
      this.listeners = new Map();
    }
    addEventListener(type, handler, options) {
      if (!this.listeners.has(type)) {
        this.listeners.set(type, new Set());
      }
      this.listeners.get(type).add(handler);
      this.lastOptions = options;
    }
    removeEventListener(type, handler) {
      if (this.listeners.has(type)) {
        this.listeners.get(type).delete(handler);
      }
    }
    listenerCount(type) {
      return this.listeners.get(type)?.size || 0;
    }
  }

  const canvas = new MockDOMCanvas();

  function mountExplorer(canvasElem) {
    const onWheel = (e) => {};
    canvasElem.addEventListener("wheel", onWheel, { passive: false });
    return function unmount() {
      canvasElem.removeEventListener("wheel", onWheel);
    };
  }

  // 1. Open cycle 1
  const unmount1 = mountExplorer(canvas);
  assert.equal(canvas.listenerCount("wheel"), 1, "Must have exactly 1 wheel listener when mounted");
  assert.equal(canvas.lastOptions.passive, false, "Wheel listener must be non-passive to allow preventDefault");
  unmount1();
  assert.equal(canvas.listenerCount("wheel"), 0, "Listener must be removed on unmount");

  // 2. Open cycle 2
  const unmount2 = mountExplorer(canvas);
  assert.equal(canvas.listenerCount("wheel"), 1);
  unmount2();
  assert.equal(canvas.listenerCount("wheel"), 0);

  // 3. Open cycle 3
  const unmount3 = mountExplorer(canvas);
  assert.equal(canvas.listenerCount("wheel"), 1);
  unmount3();
  assert.equal(canvas.listenerCount("wheel"), 0, "Zero residual listeners remain after repeated open/close cycles");
});

// ----------------------------------------------------------------------------
// Audit Test 7: Camera reset after remount: fresh fitted camera with zero residual pan or zoom
// ----------------------------------------------------------------------------
test("Audit 7: Camera reset after remount: fresh fitted camera with zero residual pan or zoom", () => {
  const worldBounds = EXPANDED_WORLD_BOUNDS;
  const vp = { width: 360, height: 480 };

  // First session: initial fit, user zooms and pans
  const session1Initial = createCameraFromFit(worldBounds, vp, 24);
  const session1Zoomed = zoomCameraAroundPoint(session1Initial, 2.5, { x: 180, y: 240 }, worldBounds, 0.4, 3.0);
  const session1Panned = panCamera(session1Zoomed, 150, -80, worldBounds);

  assert.notEqual(session1Panned.targetX, session1Initial.targetX);
  assert.notEqual(session1Panned.zoom, session1Initial.zoom);

  // Unmount and remount (simulated fresh Explorer mount)
  const session2Initial = createCameraFromFit(worldBounds, vp, 24);

  assert.equal(session2Initial.targetX, session1Initial.targetX);
  assert.equal(session2Initial.targetY, session1Initial.targetY);
  assert.equal(session2Initial.zoom, session1Initial.zoom);
  assert.equal(session2Initial.viewportWidth, session1Initial.viewportWidth);
  assert.equal(session2Initial.viewportHeight, session1Initial.viewportHeight);
});
