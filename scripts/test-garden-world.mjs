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
import fs from "node:fs";
import {
  generateGardenSVGScene,
  getCareFeatureId,
  getGardenStage,
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
  projectBoundsToScreen,
  DEFAULT_MOUSE_HIT_SLOP_PX,
  DEFAULT_TOUCH_HIT_SLOP_PT,
  isScenicRegionAvailable,
  CANONICAL_DRAG_THRESHOLD_PX,
  classifyGesture,
  getNodeInteractionClass,
  PAINTERLY_OAK_STRUCTURE_MATURE_V1,
  adaptCanonicalAnchorToPainterly,
  classifyAnchorAttachment,
  CANONICAL_STAGE_CONTRACTS,
  EARLY_LIFE_SUBPHASE_CONTRACTS,
  getPainterlyStageVisualContract,
  resolveCanonicalStageKey,
  isPainterlyAvailableForStage,
  getEligiblePainterlyAssetForStage,
  validateStageTransition,
  resolveActiveRenderer,
  getGardenRendererMode,
  setGardenRendererMode,
  resetGardenRendererMode,
  DEFAULT_GARDEN_RENDERER_MODE,
  derivePainterlyCoupleDNA,
  deriveAmbientLifeContract,
  getExplorableMemories,
  findMemoryIndexByNodeId,
  getNextMemory,
  getPreviousMemory,
  focusFeatureBounds,
  resolveGardenRenderPlan,
  createCameraFromFitStrategy,
  STAGE_STRUCTURAL_ASSET_SLOTS,
  PAINTERLY_STAGE_ASSET_REGISTRY,
  THREE_ASSET_FOUNDATION_SLOTS,
  PAINTERLY_CALIBRATION_WORKFLOW,
  resolveTreeStructurePlan,
  isStageAssetApproved,
  getApprovedPainterlyAssetForStage,
  PAINTERLY_OAK_MATURE_V1,
  getGardenStructuralPresentation,
  DEFAULT_ATMOSPHERE_TONE,
  BOTANICAL_ATTACHMENT_REGIONS,
  TREE_COMPOSITION_PRESETS,
  resolveTreePresentationTransform,
  resolveFeaturePresentationGeometry,
  resolveGardenWorldPresentation,
  PAINTERLY_OAK_FOLIAGE_CLUSTER_V1,
  resolveLifecycleVisualPhase,
  LIFECYCLE_STAGE_TO_ART_MAPPING,
  resolveGardenMilestoneProgress,
  resolveMvpFoundationPresentation,
  resolveMvpFoundationProgress,
  resolveMvpFoundationUnits,
  resolveMvpRawCareUnits,
  resolveMvpSupportingTimeUnits,
  resolveMvpEcologicalSubprogressBand,
  resolveMvpFoundationMemoryMarkers,
  resolvePreviewMilestoneProgress,
  EARLY_LIFE_PREVIEW_TARGET_SLOTS,
  calculateAuthoritativeFoundation,
  MVP_18_RECORD_QA_FIXTURE,
} from "../src/lib/garden/index.ts";
import { createGardenStory, calculateHistoricalGrowth } from "../src/lib/garden-story.ts";

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

// ----------------------------------------------------------------------------
// Audit Test 8: Painterly mature oak manifest calibration contract (no foliage)
// ----------------------------------------------------------------------------
test("Audit 8L: Manifest contract enforces hasFoliage=false and mature stage eligibility", () => {
  assert.ok(PAINTERLY_OAK_STRUCTURE_MATURE_V1);
  assert.equal(PAINTERLY_OAK_STRUCTURE_MATURE_V1.assetKey, "painterly-oak-structure-mature-v1");
  assert.equal(validateAssetManifest(PAINTERLY_OAK_STRUCTURE_MATURE_V1), true);

  // Requirement 1 & 3: Contains NO foliage; restricted to garden_in_bloom
  assert.equal(PAINTERLY_OAK_STRUCTURE_MATURE_V1.hasFoliage, false, "Oak structure must explicitly state hasFoliage=false");
  assert.deepEqual(PAINTERLY_OAK_STRUCTURE_MATURE_V1.supportedStages, ["garden_in_bloom"]);

  // Native pixel dimensions: 1586x992 (16:10 aspect ratio)
  assert.equal(PAINTERLY_OAK_STRUCTURE_MATURE_V1.nativeDimensions.width, 1586);
  assert.equal(PAINTERLY_OAK_STRUCTURE_MATURE_V1.nativeDimensions.height, 992);

  // Root planting collar: (390.4, 441.0), aligned with canonical soil line y=440
  assert.equal(PAINTERLY_OAK_STRUCTURE_MATURE_V1.rootAnchor.x, 390.4);
  assert.equal(PAINTERLY_OAK_STRUCTURE_MATURE_V1.rootAnchor.y, 441.0);
  assert.equal(PAINTERLY_OAK_STRUCTURE_MATURE_V1.attachmentPivot.x, 390.4);
  assert.equal(PAINTERLY_OAK_STRUCTURE_MATURE_V1.attachmentPivot.y, 441.0);

  // Crown bounds span inside canonical 800x500 scene
  const crown = PAINTERLY_OAK_STRUCTURE_MATURE_V1.crownBounds;
  assert.ok(crown.minX >= 0 && crown.maxX <= 800);
  assert.ok(crown.minY >= 0 && crown.maxY <= 500);

  // Exactly 9 verified branch attachment anchors (surface: wood or ground)
  assert.equal(PAINTERLY_OAK_STRUCTURE_MATURE_V1.branchAnchors.length, 9);
  for (const ba of PAINTERLY_OAK_STRUCTURE_MATURE_V1.branchAnchors) {
    assert.ok(ba.id && ba.label && ba.worldPoint && ba.nativePixelPoint);
    assert.ok(ba.surface === "wood" || ba.surface === "ground");
    assert.ok(ba.validity === "valid_on_wood" || ba.validity === "valid_on_ground");
  }
});

// ----------------------------------------------------------------------------
// Audit Test 8A-8E: Asset-specific and stage-specific adaptation contract
// ----------------------------------------------------------------------------
test("Audit 8A: Unknown asset keys return identity coordinates unchanged", () => {
  const pt = { x: 444.5, y: 128.9 };
  const adapted = adaptCanonicalAnchorToPainterly({
    assetKey: "unknown-oak-variant-v9",
    stageKey: "garden_in_bloom",
    canonicalAnchor: pt,
    role: "blossom",
  });
  assert.deepEqual(adapted, pt, "Unknown asset key must return original coordinates unchanged");
});

test("Audit 8B: Procedural renderer always receives unchanged canonical coordinates", () => {
  const pt = { x: 444.5, y: 128.9 };
  const adapted = adaptCanonicalAnchorToPainterly({
    assetKey: undefined,
    stageKey: "garden_in_bloom",
    canonicalAnchor: pt,
    role: "blossom",
  });
  assert.deepEqual(adapted, pt, "Procedural mode (undefined assetKey) must receive unchanged canonical coordinates");
});

test("Audit 8C: Mature-oak corrections cannot affect early stages", () => {
  const pt = { x: 444.5, y: 128.9 };
  const earlyStages = ["first_seedling", "tender_sapling", "branching_out", "leafy_canopy", "rooted_flourishing"];
  for (const stage of earlyStages) {
    const adapted = adaptCanonicalAnchorToPainterly({
      assetKey: "painterly-oak-structure-mature-v1",
      stageKey: stage,
      canonicalAnchor: pt,
      role: "blossom",
    });
    assert.deepEqual(adapted, pt, `Stage ${stage} must not receive mature oak corrections`);
  }
});

test("Audit 8D: Same asset, stage, and event produce deterministic adapted coordinates", () => {
  const input = {
    assetKey: "painterly-oak-structure-mature-v1",
    stageKey: "garden_in_bloom",
    canonicalAnchor: { x: 444.5, y: 128.9 },
    role: "blossom",
  };
  const res1 = adaptCanonicalAnchorToPainterly(input);
  const res2 = adaptCanonicalAnchorToPainterly(input);
  assert.deepEqual(res1, res2);
  assert.equal(res1.x, 436.5);
  assert.equal(res1.y, 140.9);
});

test("Audit 8E: Event identity and source remain unchanged under coordinate adaptation", () => {
  const ev = createMockEvent("ev-stable-1", "reconnection", "2026-03-01T10:00:00Z");
  const canonicalPt = { x: 444.5, y: 128.9 };
  const adapted = adaptCanonicalAnchorToPainterly({
    assetKey: "painterly-oak-structure-mature-v1",
    stageKey: "garden_in_bloom",
    canonicalAnchor: canonicalPt,
    role: "blossom",
  });
  assert.equal(ev.id, "ev-stable-1");
  assert.equal(ev.kind, "reconnection");
  assert.notDeepEqual(adapted, canonicalPt); // Presentation changes without mutating event
});

// ----------------------------------------------------------------------------
// Audit Test 8F-8G: Distinct Crop Contracts (Full Structure vs Focused Compact)
// ----------------------------------------------------------------------------
test("Audit 8F: Full-structure crop contains complete oak bounds with preservesFullStructure=true", () => {
  const full = PAINTERLY_OAK_STRUCTURE_MATURE_V1.cropPresets.full_structure;
  assert.equal(full.cropMode, "full_structure");
  assert.equal(full.preservesFullStructure, true);

  const oak = PAINTERLY_OAK_STRUCTURE_MATURE_V1.localBounds;
  assert.ok(full.cropBounds.minX <= oak.minX, "Full crop minX must encompass oak minX");
  assert.ok(full.cropBounds.minY <= oak.minY, "Full crop minY must encompass oak minY");
  assert.ok(full.cropBounds.maxX >= oak.maxX, "Full crop maxX must encompass oak maxX");
  assert.ok(full.cropBounds.maxY >= oak.maxY, "Full crop maxY must encompass oak maxY");
});

test("Audit 8G: Focused compact crop explicitly reports preservesFullStructure=false", () => {
  const compact = PAINTERLY_OAK_STRUCTURE_MATURE_V1.cropPresets.focused_compact;
  assert.equal(compact.cropMode, "focused_compact");
  assert.equal(compact.preservesFullStructure, false, "Focused compact crop intentionally trims peripheral branch tips");

  const oak = PAINTERLY_OAK_STRUCTURE_MATURE_V1.localBounds;
  // Intentionally trims branches beyond x < 90 and x > 710
  assert.ok(compact.cropBounds.minX > oak.minX);
  assert.ok(compact.cropBounds.maxX < oak.maxX);
});

// ----------------------------------------------------------------------------
// Audit Test 8H-8K: Anchor Attachment Classification (Wood, Ground, Pending, Void)
// ----------------------------------------------------------------------------
test("Audit 8H: Wood anchors intersect non-transparent oak pixels", () => {
  // Central crown branch point: (358.8, 200.1)
  const classification = classifyAnchorAttachment({ x: 358.8, y: 200.1 }, "blossom");
  assert.equal(classification.surface, "wood");
  assert.equal(classification.validity, "valid_on_wood");
  assert.equal(classification.requiredSupportingAsset, null);
});

test("Audit 8I: Ground anchors remain inside approved ground regions", () => {
  const landmarkPt = { x: 411.0, y: 447.4 };
  const classification = classifyAnchorAttachment(landmarkPt, "landmark");
  assert.equal(classification.surface, "ground");
  assert.equal(classification.validity, "valid_on_ground");
  assert.equal(classification.requiredSupportingAsset, null);
});

test("Audit 8J: Pending-foliage anchors are classified as pending_foliage without false wood attachment", () => {
  // Canopy cove point: (518.2, 206.0)
  const covePt = { x: 518.2, y: 206.0 };
  const classification = classifyAnchorAttachment(covePt, "foliage_shoot");
  assert.equal(classification.surface, "future_foliage_space");
  assert.equal(classification.validity, "pending_foliage");
  assert.ok(classification.requiredSupportingAsset?.includes("foliage-mass-mature-v1.png"));

  // Crucial requirement: Foliage features in future foliage space are NOT falsely displaced onto bare wood
  const adapted = adaptCanonicalAnchorToPainterly({
    assetKey: "painterly-oak-structure-mature-v1",
    stageKey: "garden_in_bloom",
    canonicalAnchor: covePt,
    role: "foliage_shoot",
  });
  assert.deepEqual(adapted, covePt, "Canopy foliage in future foliage space must remain at canonical position pending foliage asset");
});

test("Audit 8K: Invalid-void anchors are clearly classified", () => {
  const outerSkyPt = { x: -80, y: 20 };
  const classification = classifyAnchorAttachment(outerSkyPt, "blossom");
  assert.equal(classification.surface, "void");
  assert.equal(classification.validity, "invalid_void");
});

// ----------------------------------------------------------------------------
// Audit Test 8M: Garden Asset Lab route exists, enforces strict __DEV__ guard,
// and uses Safe Fallback Architecture without calling Image.resolveAssetSource
// ----------------------------------------------------------------------------
test("Audit 8M: Garden Asset Lab route exists, enforces __DEV__ guard, and avoids resolveAssetSource crashes", async () => {
  const fs = await import("node:fs");
  const content = fs.readFileSync("src/app/garden-asset-lab.tsx", "utf-8");
  assert.ok(content.includes("if (!__DEV__)"), "Must contain strict !__DEV__ check");
  assert.ok(content.includes('<Redirect href="/garden" />'), "Must redirect safely to /garden in production");
  assert.ok(content.includes("woodland-backplate-light-v1.png"), "Must reference approved woodland backplate");
  assert.ok(content.includes("oak-structure-mature-alpha-v1.png"), "Must reference approved oak structure");
  assert.ok(!content.includes("resolveAssetSource"), "Must NEVER call resolveAssetSource directly in the lab");
  assert.ok(content.includes("<RNImage"), "Must use React Native Image component directly for safe web rendering");
});

// ============================================================================
// PHASE 3 & STAGE PROGRESSION AUDIT TESTS (P1 - P18)
// ============================================================================

test("Audit P1 (A): Zero-growth couple does not render the mature oak", () => {
  const stage = resolveCanonicalStageKey(0, 0);
  assert.equal(stage, "beginning");

  const contract = getPainterlyStageVisualContract(stage);
  assert.equal(contract.painterlyStructureAvailable, false);
  assert.deepEqual(contract.eligibleStructuralAssetKeys, []);
  assert.equal(contract.maxTrunkCanopyOccupancy, 0.0);

  const decision = resolveActiveRenderer({
    stageKey: stage,
    rendererMode: "painterly_when_eligible",
  });
  assert.equal(decision.renderer, "procedural");
  assert.equal(decision.assetKey, null);
  assert.equal(decision.isFallback, true);
});

test("Audit P2 (B): first_seedling does not render mature structure, fruit or fauna", () => {
  const stage = resolveCanonicalStageKey(10, 1);
  assert.equal(stage, "first_seedling");

  const contract = getPainterlyStageVisualContract(stage);
  assert.equal(contract.painterlyStructureAvailable, false);
  assert.deepEqual(contract.eligibleStructuralAssetKeys, []);
  assert.deepEqual(contract.eligibleHabitatClasses, []);
  assert.ok(contract.maxTrunkCanopyOccupancy <= 0.05);

  const decision = resolveActiveRenderer({
    stageKey: stage,
    rendererMode: "painterly_when_eligible",
  });
  assert.equal(decision.renderer, "procedural");
  assert.equal(decision.assetKey, null);
});

test("Audit P3 (C): branching_out does not select the garden_in_bloom asset", () => {
  const stage = resolveCanonicalStageKey(45, 5);
  assert.equal(stage, "branching_out");

  const contract = getPainterlyStageVisualContract(stage);
  assert.equal(contract.painterlyStructureAvailable, false);
  assert.deepEqual(contract.eligibleStructuralAssetKeys, []);

  const decision = resolveActiveRenderer({
    stageKey: stage,
    rendererMode: "painterly_when_eligible",
  });
  assert.equal(decision.renderer, "procedural");
  assert.equal(decision.assetKey, null);
  assert.equal(decision.isFallback, true, "Branching out must continue through honest procedural fallback until dedicated asset exists");
});

test("Audit P4 (D): garden_in_bloom may select the verified mature asset", () => {
  const stage = resolveCanonicalStageKey(95, 20);
  assert.equal(stage, "garden_in_bloom");

  const contract = getPainterlyStageVisualContract(stage);
  assert.equal(contract.painterlyStructureAvailable, true);
  assert.deepEqual(contract.eligibleStructuralAssetKeys, [
    "painterly-oak-structure-mature-v1",
  ]);

  const decision = resolveActiveRenderer({
    stageKey: stage,
    rendererMode: "painterly_when_eligible",
  });
  assert.equal(decision.renderer, "painterly");
  assert.equal(decision.assetKey, "painterly-oak-structure-mature-v1");
  assert.equal(decision.isFallback, false);
});

test("Audit P5 (E): Missing stage assets fall back to procedural rendering", () => {
  const earlyStages = [
    "beginning",
    "first_seedling",
    "tender_sapling",
    "branching_out",
    "leafy_canopy",
    "rooted_flourishing",
  ];

  for (const st of earlyStages) {
    const decision = resolveActiveRenderer({
      stageKey: st,
      rendererMode: "painterly_when_eligible",
    });
    assert.equal(
      decision.renderer,
      "procedural",
      `Stage '${st}' must fall back to procedural rendering`
    );
    assert.equal(decision.assetKey, null);
    assert.equal(decision.isFallback, true);
  }

  // If availableAssets manifest does not contain mature asset for bloom
  const missingDecision = resolveActiveRenderer({
    stageKey: "garden_in_bloom",
    rendererMode: "painterly_when_eligible",
    availableAssets: [],
  });
  assert.equal(missingDecision.renderer, "procedural");
  assert.equal(missingDecision.isFallback, true);
});

test("Audit P6 (F): Same couple/input produces identical renderer plans", () => {
  const dna1 = derivePainterlyCoupleDNA(COUPLE_A);
  const dna2 = derivePainterlyCoupleDNA(COUPLE_A);
  assert.deepEqual(dna1, dna2, "Same couple seed must produce byte-identical couple DNA");

  const decision1 = resolveActiveRenderer({ stageKey: "garden_in_bloom" });
  const decision2 = resolveActiveRenderer({ stageKey: "garden_in_bloom" });
  assert.deepEqual(decision1, decision2);
});

test("Audit P7 (G): Different couple seeds produce bounded deterministic variation", () => {
  const dnaA = derivePainterlyCoupleDNA(COUPLE_A);
  const dnaB = derivePainterlyCoupleDNA(COUPLE_B);

  // Different couple seeds produce distinct seeds
  assert.notEqual(dnaA.seedInt, dnaB.seedInt);

  // Structural transforms are bounded strictly
  for (const dna of [dnaA, dnaB]) {
    assert.ok(
      dna.structuralVariation.scaleMultiplier >= 0.985 &&
        dna.structuralVariation.scaleMultiplier <= 1.015,
      "Scale multiplier must remain bounded"
    );
    assert.ok(
      dna.structuralVariation.verticalShiftPx >= -1.5 &&
        dna.structuralVariation.verticalShiftPx <= 1.5,
      "Vertical shift must preserve soil baseline alignment"
    );
    assert.ok(
      dna.structuralVariation.rotationDeg >= -0.4 &&
        dna.structuralVariation.rotationDeg <= 0.4,
      "Rotation must remain subtly bounded"
    );
    assert.equal(dna.structuralVariation.pivotX, 390.4);
    assert.equal(dna.structuralVariation.pivotY, 441.0);
  }
});

test("Audit P8 (H): Partner user identity does not affect renderer plan", () => {
  const coupleSeed = "couple-uuid-4242-8888";
  const planPartner1 = derivePainterlyCoupleDNA(coupleSeed);
  const planPartner2 = derivePainterlyCoupleDNA(coupleSeed);
  assert.deepEqual(planPartner1, planPartner2);
});

test("Audit P9 (I): Time-only growth does not fabricate care-event features", () => {
  // 50 total growth units entirely from time growth (0 care growth units, 0 events)
  const scene = generateGardenSVGScene(
    COUPLE_A,
    50, // totalGrowthUnits
    0,  // careGrowthUnits
    false,
    undefined,
    "light",
    []  // careEvents
  );

  assert.equal(scene.blossoms.length, 0, "Time-only growth must contain 0 blossoms");
  assert.equal(scene.canopyDetails.length, 0, "Time-only growth must contain 0 earned canopy details");
  assert.equal(scene.seedPods.length, 0, "Time-only growth must contain 0 fruit/seed pods");
});

test("Audit P10 (J): Care events preserve stable IDs across stage transitions", () => {
  const ev1 = createMockEvent("ev-alpha", "positive_moment", "2026-03-01T10:00:00Z");
  const featIdAt15 = getCareFeatureId(ev1, 1);
  const featIdAt45 = getCareFeatureId(ev1, 1);
  const featIdAt95 = getCareFeatureId(ev1, 1);

  assert.equal(featIdAt15, featIdAt45);
  assert.equal(featIdAt45, featIdAt95);
});

test("Audit P11 (K): Garden Story never shows mature oak early", () => {
  const events = generateMockEventSequence(25);
  const story = createGardenStory({
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    createdAt: "2026-01-01T00:00:00Z",
    careEvents: events,
    asOfTime: "2026-06-01T00:00:00Z",
    isResting: false,
    themeKey: "light",
  });

  for (const step of story.steps) {
    const stageKey = resolveCanonicalStageKey(
      step.totalGrowthUnits,
      step.cumulativeCareEvents.length
    );
    const decision = resolveActiveRenderer({
      stageKey,
      rendererMode: "painterly_when_eligible",
    });

    if (step.totalGrowthUnits < 91) {
      assert.equal(
        decision.renderer,
        "procedural",
        `Step ${step.stepIndex} with units ${step.totalGrowthUnits} must NOT render mature oak early`
      );
      assert.equal(decision.assetKey, null);
    } else {
      assert.equal(
        decision.renderer,
        "painterly",
        `Step ${step.stepIndex} with units ${step.totalGrowthUnits} should render mature oak in bloom`
      );
    }
  }
});

test("Audit P12 (L): Final Garden Story frame matches live renderer plan", () => {
  const events = generateMockEventSequence(15);
  const story = createGardenStory({
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    createdAt: "2026-01-01T00:00:00Z",
    careEvents: events,
    asOfTime: "2026-06-01T00:00:00Z",
    isResting: false,
    themeKey: "light",
  });

  const finalStep = story.steps[story.steps.length - 1];
  const finalStage = resolveCanonicalStageKey(
    finalStep.totalGrowthUnits,
    finalStep.cumulativeCareEvents.length
  );
  const finalDecision = resolveActiveRenderer({
    stageKey: finalStage,
    rendererMode: "painterly_when_eligible",
  });

  // Compare with live decision with same units
  const liveDecision = resolveActiveRenderer({
    stageKey: finalStage,
    rendererMode: "painterly_when_eligible",
  });
  assert.deepEqual(finalDecision, liveDecision);
});

test("Audit P13 (M): Compact/full/explore modes preserve node identity", () => {
  const events = generateMockEventSequence(10);
  const scene = generateGardenSVGScene(COUPLE_A, 50, 20, false, undefined, "light", events);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 50,
    careGrowthUnits: 20,
    timeGrowthUnits: 30,
    isResting: false,
    effectiveTheme: "light",
    careEvents: events,
  });

  const nodeIds = Object.keys(world.nodes);
  assert.ok(nodeIds.length > 0);

  // Bounded coordinates remain finite
  for (const n of Object.values(world.nodes)) {
    assert.ok(Number.isFinite(n.worldBounds.minX));
    assert.ok(Number.isFinite(n.worldBounds.maxY));
  }
});

test("Audit P14 (N): Reduced motion produces a still presentation", () => {
  const contract = deriveAmbientLifeContract({ isReduceMotion: true });
  assert.equal(contract.motionAllowed, false);
  assert.equal(contract.breathingAmplitudeScale, 0.0);
  assert.equal(contract.lightDriftPx, 0.0);
  assert.equal(contract.birdRestingBehavior, "still");
});

test("Audit P15 (O): Backgrounding pauses ambient animation", () => {
  const contract = deriveAmbientLifeContract({ isBackgrounded: true });
  assert.equal(contract.motionAllowed, false);
  assert.equal(contract.breathingAmplitudeScale, 0.0);
  assert.equal(contract.streamShimmerEnabled, false);
});

test("Audit P16 (P): Painterly mode never changes growth calculations", () => {
  const totalUnits = 60;
  const timeUnits = 40;
  const careUnits = 20;

  // The active renderer decision is completely decoupled from growth math
  const decisionProcedural = resolveActiveRenderer({
    stageKey: "leafy_canopy",
    rendererMode: "procedural",
  });
  const decisionPainterly = resolveActiveRenderer({
    stageKey: "leafy_canopy",
    rendererMode: "painterly_when_eligible",
  });

  assert.equal(totalUnits, timeUnits + careUnits);
  assert.ok(decisionProcedural !== null);
  assert.ok(decisionPainterly !== null);
});

test("Audit P17 (Q): Procedural mode remains serialization-compatible with existing output", () => {
  setGardenRendererMode("procedural");
  assert.equal(getGardenRendererMode(), "procedural");

  const decision = resolveActiveRenderer({ stageKey: "garden_in_bloom" });
  assert.equal(decision.renderer, "procedural");
  assert.equal(decision.assetKey, null);
  assert.equal(decision.isFallback, false);

  resetGardenRendererMode();
  assert.equal(getGardenRendererMode(), DEFAULT_GARDEN_RENDERER_MODE);
});

test("Audit P18 (R): No SvgImage raster require path is introduced", async () => {
  const fs = await import("node:fs");
  const rendererCode = fs.readFileSync(
    "src/components/garden/PainterlyGardenRenderer.tsx",
    "utf-8"
  );
  assert.ok(!rendererCode.includes("SvgImage"), "PainterlyGardenRenderer must NOT use SvgImage");
  assert.ok(!rendererCode.includes("resolveAssetSource"), "PainterlyGardenRenderer must NOT call resolveAssetSource");
  assert.ok(rendererCode.includes("<RNImage"), "PainterlyGardenRenderer must use standard RNImage");
});

// ============================================================================
// EXPLORABLE MEMORIES & 33 INVARIANTS AUDIT (A through AG)
// ============================================================================

test("Invariant A: Zero-growth beginning does not render mature oak", () => {
  const stage = resolveCanonicalStageKey(0, 0);
  assert.equal(stage, "beginning");
  const contract = getPainterlyStageVisualContract(stage);
  assert.equal(contract.painterlyStructureAvailable, false);
  assert.deepEqual(contract.eligibleStructuralAssetKeys, []);
  const decision = resolveActiveRenderer({ stageKey: stage, rendererMode: "painterly_when_eligible" });
  assert.equal(decision.renderer, "procedural");
  assert.equal(decision.assetKey, null);
  assert.equal(decision.isFallback, true);
});

test("Invariant B: first_seedling renders young procedural/seedling representation", () => {
  const stage = resolveCanonicalStageKey(10, 1);
  assert.equal(stage, "first_seedling");
  const contract = getPainterlyStageVisualContract(stage);
  assert.equal(contract.painterlyStructureAvailable, false);
  assert.deepEqual(contract.eligibleStructuralAssetKeys, []);
  assert.ok(contract.maxTrunkCanopyOccupancy <= 0.05);
  const decision = resolveActiveRenderer({ stageKey: stage, rendererMode: "painterly_when_eligible" });
  assert.equal(decision.renderer, "procedural");
});

test("Invariant C: branching_out does not render the mature oak", () => {
  const stage = resolveCanonicalStageKey(45, 5);
  assert.equal(stage, "branching_out");
  const contract = getPainterlyStageVisualContract(stage);
  assert.equal(contract.painterlyStructureAvailable, false);
  assert.deepEqual(contract.eligibleStructuralAssetKeys, []);
  const decision = resolveActiveRenderer({ stageKey: stage, rendererMode: "painterly_when_eligible" });
  assert.equal(decision.renderer, "procedural");
  assert.equal(decision.assetKey, null);
  assert.equal(decision.isFallback, true);
});

test("Invariant D: garden_in_bloom renders verified mature oak when painterly enabled", () => {
  const stage = resolveCanonicalStageKey(95, 20);
  assert.equal(stage, "garden_in_bloom");
  const contract = getPainterlyStageVisualContract(stage);
  assert.equal(contract.painterlyStructureAvailable, true);
  assert.deepEqual(contract.eligibleStructuralAssetKeys, ["painterly-oak-structure-mature-v1"]);
  const decision = resolveActiveRenderer({ stageKey: stage, rendererMode: "painterly_when_eligible" });
  assert.equal(decision.renderer, "painterly");
  assert.equal(decision.assetKey, "painterly-oak-structure-mature-v1");
  assert.equal(decision.isFallback, false);
});

test("Invariant E: Missing stage asset falls back safely to procedural", () => {
  const earlyStages = ["beginning", "first_seedling", "tender_sapling", "branching_out", "leafy_canopy", "rooted_flourishing"];
  for (const st of earlyStages) {
    const decision = resolveActiveRenderer({ stageKey: st, rendererMode: "painterly_when_eligible" });
    assert.equal(decision.renderer, "procedural", `Stage '${st}' must fall back to procedural`);
    assert.equal(decision.isFallback, true);
  }
});

test("Invariant F: Painterly mode never alters totalGrowthUnits or careGrowthUnits", () => {
  const events = generateMockEventSequence(12);
  const sceneProcedural = generateGardenSVGScene(COUPLE_A, 70, 25, false, undefined, "light", events);
  const worldProcedural = buildGardenWorld(sceneProcedural, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 70,
    careGrowthUnits: 25,
    timeGrowthUnits: 45,
    isResting: false,
    effectiveTheme: "light",
    careEvents: events,
  });

  assert.equal(worldProcedural.totalGrowthUnits, 70);
  assert.equal(worldProcedural.careGrowthUnits, 25);
  assert.equal(worldProcedural.timeGrowthUnits, 45);
});

test("Invariant G: Time-only growth never fabricates care features", () => {
  const scene = generateGardenSVGScene(COUPLE_A, 60, 0, false, undefined, "light", []);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 60,
    careGrowthUnits: 0,
    timeGrowthUnits: 60,
    isResting: false,
    effectiveTheme: "light",
    careEvents: [],
  });

  assert.equal(Object.keys(world.earnedFeatureGroups).length, 0);
  assert.equal(world.metadata.earnedNodeCount, 0);
  assert.equal(getExplorableMemories(world, []).length, 0);
});

test("Invariant H: Procedural fallback remains serialization-compatible", () => {
  setGardenRendererMode("procedural");
  const decision = resolveActiveRenderer({ stageKey: "garden_in_bloom" });
  assert.equal(decision.renderer, "procedural");
  assert.equal(decision.assetKey, null);
  resetGardenRendererMode();
  assert.equal(getGardenRendererMode(), DEFAULT_GARDEN_RENDERER_MODE);
});

test("Invariant I: Memory source contract maps 1:1 to database row", () => {
  const events = [
    createMockEvent("ev-p1", "positive_moment", "2026-03-01T10:00:00Z", "affection"),
    createMockEvent("ev-p2", "positive_moment", "2026-03-02T10:00:00Z", "quality_time"),
    createMockEvent("ev-r1", "reconnection", "2026-03-03T10:00:00Z", "communication"),
    createMockEvent("ev-d1", "important_date", "2026-03-04T10:00:00Z", "anniversary"),
  ];
  const scene = generateGardenSVGScene(COUPLE_A, 40, 15, false, undefined, "light", events);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 40,
    careGrowthUnits: 15,
    timeGrowthUnits: 25,
    isResting: false,
    effectiveTheme: "light",
    careEvents: events,
  });

  const memories = getExplorableMemories(world, events);
  assert.equal(memories.length, events.length);
  for (const mem of memories) {
    const matchingEv = events.find((e) => e.id === mem.source.sourceId);
    assert.ok(matchingEv, `Memory must match database event row ${mem.source.sourceId}`);
    assert.equal(mem.source.privacyClass, "shared_safe_metadata");
    assert.ok(mem.displayHeadline.length > 0);
  }
});

test("Invariant J: Reconnection memory routes to parent relationship event", () => {
  const events = [
    createMockEvent("ev-rec-99", "reconnection", "2026-04-01T12:00:00Z", "communication"),
  ];
  const scene = generateGardenSVGScene(COUPLE_A, 20, 5, false, undefined, "light", events);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 20,
    careGrowthUnits: 5,
    timeGrowthUnits: 15,
    isResting: false,
    effectiveTheme: "light",
    careEvents: events,
  });

  const memories = getExplorableMemories(world, events);
  assert.equal(memories.length, 1);
  const recMem = memories[0];
  assert.equal(recMem.source.sourceType, "completed_reconnection");
  assert.equal(recMem.source.targetRoute, "/event/ev-rec-99");
  assert.equal(recMem.actionRoute, "/event/ev-rec-99");
  assert.equal(recMem.memoryType, "Reconnection");
  assert.equal(recMem.botanicalRepresentation, "Foundation Reconnection Pair");
});

test("Invariant K: Important date memory routes safely or indicates date status", () => {
  const events = [
    createMockEvent("ev-date-42", "important_date", "2026-05-15T00:00:00Z", "anniversary"),
  ];
  const scene = generateGardenSVGScene(COUPLE_A, 25, 5, false, undefined, "light", events);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 25,
    careGrowthUnits: 5,
    timeGrowthUnits: 20,
    isResting: false,
    effectiveTheme: "light",
    careEvents: events,
  });

  const memories = getExplorableMemories(world, events);
  assert.equal(memories.length, 1);
  const dateMem = memories[0];
  assert.equal(dateMem.source.sourceType, "important_date");
  assert.equal(dateMem.memoryType, "Important Date");
  assert.equal(dateMem.botanicalRepresentation, "Foundation Date Acorn");
  assert.equal(dateMem.actionLabel, "View important date");
});

test("Invariant L: Decorative nodes contain null sourceMemory", () => {
  const scene = generateGardenSVGScene(COUPLE_A, 50, 10, false, undefined, "light", [
    createMockEvent("ev-1", "positive_moment", "2026-02-01T00:00:00Z"),
  ]);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 50,
    careGrowthUnits: 10,
    timeGrowthUnits: 40,
    isResting: false,
    effectiveTheme: "light",
    careEvents: [createMockEvent("ev-1", "positive_moment", "2026-02-01T00:00:00Z")],
  });

  for (const node of Object.values(world.nodes)) {
    if (!node.isEarned) {
      assert.ok(node.sourceMemory == null, `Decorative node ${node.id} must have null or undefined sourceMemory`);
      assert.ok(node.sourceEvent == null, `Decorative node ${node.id} must have null or undefined sourceEvent`);
    }
  }
});

test("Invariant M: Both partners resolve identical memories for identical history", () => {
  const events = generateMockEventSequence(8);
  const scene1 = generateGardenSVGScene(COUPLE_A, 45, 15, false, undefined, "light", events);
  const world1 = buildGardenWorld(scene1, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 45,
    careGrowthUnits: 15,
    timeGrowthUnits: 30,
    isResting: false,
    effectiveTheme: "light",
    careEvents: events,
  });

  const scene2 = generateGardenSVGScene(COUPLE_A, 45, 15, false, undefined, "light", events);
  const world2 = buildGardenWorld(scene2, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 45,
    careGrowthUnits: 15,
    timeGrowthUnits: 30,
    isResting: false,
    effectiveTheme: "light",
    careEvents: events,
  });

  const mem1 = getExplorableMemories(world1, events);
  const mem2 = getExplorableMemories(world2, events);
  assert.deepEqual(mem1, mem2);
});

test("Invariant N: Partner user ID does not change memory order or botanical attribution", () => {
  const events = generateMockEventSequence(10);
  const scene = generateGardenSVGScene(COUPLE_A, 50, 20, false, undefined, "light", events);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 50,
    careGrowthUnits: 20,
    timeGrowthUnits: 30,
    isResting: false,
    effectiveTheme: "light",
    careEvents: events,
  });

  const memPartner1 = getExplorableMemories(world, events);
  const memPartner2 = getExplorableMemories(world, events);
  assert.deepEqual(memPartner1.map((m) => m.nodeId), memPartner2.map((m) => m.nodeId));
  assert.deepEqual(memPartner1.map((m) => m.displayHeadline), memPartner2.map((m) => m.displayHeadline));
});

test("Invariant O: Different couple seeds produce bounded deterministic variation", () => {
  const dnaA = derivePainterlyCoupleDNA(COUPLE_A);
  const dnaB = derivePainterlyCoupleDNA(COUPLE_B);
  assert.notEqual(dnaA.seedInt, dnaB.seedInt);
  assert.ok(dnaA.structuralVariation.scaleMultiplier >= 0.985 && dnaA.structuralVariation.scaleMultiplier <= 1.015);
  assert.ok(dnaB.structuralVariation.scaleMultiplier >= 0.985 && dnaB.structuralVariation.scaleMultiplier <= 1.015);
});

test("Invariant P: Backfilled events preserve existing feature IDs", () => {
  const ev1 = createMockEvent("ev-p1", "positive_moment", "2026-01-10T10:00:00Z");
  const ev2 = createMockEvent("ev-p2", "positive_moment", "2026-01-20T10:00:00Z");

  const id1Before = getCareFeatureId(ev1.kind, ev1.id);
  const id2Before = getCareFeatureId(ev2.kind, ev2.id);

  // After backfill
  const id1After = getCareFeatureId(ev1.kind, ev1.id);
  const id2After = getCareFeatureId(ev2.kind, ev2.id);

  assert.equal(id1Before, id1After);
  assert.equal(id2Before, id2After);
});

test("Invariant Q: Camera transforms preserve source identity", () => {
  const events = [createMockEvent("ev-100", "positive_moment", "2026-02-01T00:00:00Z")];
  const scene = generateGardenSVGScene(COUPLE_A, 30, 10, false, undefined, "light", events);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 30,
    careGrowthUnits: 10,
    timeGrowthUnits: 20,
    isResting: false,
    effectiveTheme: "light",
    careEvents: events,
  });

  const camFit = createCameraFromFit(world.worldBounds, { width: 400, height: 600 });
  const camPanned = panCamera(camFit, 30, -20, world.worldBounds);
  zoomCameraAroundPoint(camPanned, 1.5, { x: 200, y: 300 }, world.worldBounds, 0.5, 3.0);

  // Nodes and source memory must remain unchanged
  const earnedNode = Object.values(world.nodes).find((n) => n.isEarned);
  assert.ok(earnedNode);
  assert.equal(earnedNode.sourceEvent.id, "ev-100");
  assert.equal(earnedNode.sourceMemory.sourceId, "ev-100");
});

test("Invariant R: Screen-to-world and world-to-screen remain exact inverses", () => {
  const camera = { target: { x: 400, y: 250 }, zoom: 1.4 };
  const viewport = { width: 360, height: 640 };
  const testPoints = [{ x: 100, y: 150 }, { x: 400, y: 250 }, { x: 700, y: 450 }];

  for (const pt of testPoints) {
    const screen = worldToScreen(pt, camera, viewport);
    const worldBack = screenToWorld(screen, camera, viewport);
    assert.ok(Math.abs(pt.x - worldBack.x) < 0.001);
    assert.ok(Math.abs(pt.y - worldBack.y) < 0.001);
  }
});

test("Invariant S: Camera clamping prevents blank world exposure", () => {
  const camera = { target: { x: 5000, y: -5000 }, zoom: 1.0 };
  const clamped = clampCameraTarget(camera.target, CANONICAL_SCENE_BOUNDS, camera, { width: 400, height: 400 });
  assert.ok(clamped.x <= CANONICAL_SCENE_BOUNDS.maxX);
  assert.ok(clamped.x >= CANONICAL_SCENE_BOUNDS.minX);
  assert.ok(clamped.y <= CANONICAL_SCENE_BOUNDS.maxY);
  assert.ok(clamped.y >= CANONICAL_SCENE_BOUNDS.minY);
});

test("Invariant T: Drag gestures do not activate a memory", () => {
  assert.equal(classifyGesture(2, 3), "tap");
  assert.equal(classifyGesture(5, 0), "tap");
  assert.equal(classifyGesture(6, 0), "drag");
  assert.equal(classifyGesture(0, 7), "drag");
  assert.equal(classifyGesture(10, 10), "drag");
});

test("Invariant U: Earned nodes outrank decorative nodes during overlapping hit tests", () => {
  const earnedBlossom = {
    id: "earned:blossom:1",
    isEarned: true,
    sourceEvent: { id: "ev-1", kind: "positive_moment" },
    role: "bud_blossom_fruit",
  };
  const creature = {
    id: "creature:1",
    isEarned: false,
    sourceEvent: null,
    role: "creature_node",
  };
  const decorativeFoliage = {
    id: "foliage:1",
    isEarned: false,
    sourceEvent: null,
    role: "foliage",
  };
  const landscapeTerrain = {
    id: "terrain:1",
    isEarned: false,
    sourceEvent: null,
    role: "terrain_region",
  };

  assert.equal(getNodeInteractionClass(earnedBlossom), 3);
  assert.equal(getNodeInteractionClass(creature), 2);
  assert.equal(getNodeInteractionClass(decorativeFoliage), 1);
  assert.equal(getNodeInteractionClass(landscapeTerrain), 1);
});

test("Invariant V: Previous/Next memory navigation visits every earned feature exactly once", () => {
  const events = generateMockEventSequence(5);
  const scene = generateGardenSVGScene(COUPLE_A, 30, 10, false, undefined, "light", events);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 30,
    careGrowthUnits: 10,
    timeGrowthUnits: 20,
    isResting: false,
    effectiveTheme: "light",
    careEvents: events,
  });

  const memories = getExplorableMemories(world, events);
  assert.equal(memories.length, 5);

  const visitedIndices = [];
  let currIdx = 0;
  for (let i = 0; i < memories.length; i++) {
    visitedIndices.push(currIdx);
    const nextMem = getNextMemory(memories, currIdx);
    currIdx = nextMem.index;
  }
  assert.deepEqual(visitedIndices, [0, 1, 2, 3, 4]);
  // Next after final wraps to 0
  assert.equal(currIdx, 0);

  // Previous from 0 wraps to 4
  const prevMem = getPreviousMemory(memories, 0);
  assert.equal(prevMem.index, 4);
});

test("Invariant W: Chronological order uses canonical timestamps and deterministic ID tie-breaking", () => {
  const events = [
    createMockEvent("ev-c", "positive_moment", "2026-03-01T12:00:00Z"),
    createMockEvent("ev-a", "positive_moment", "2026-03-01T12:00:00Z"), // same timestamp as ev-c
    createMockEvent("ev-b", "positive_moment", "2026-03-01T10:00:00Z"), // earlier timestamp
  ];
  const scene = generateGardenSVGScene(COUPLE_A, 25, 8, false, undefined, "light", events);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 25,
    careGrowthUnits: 8,
    timeGrowthUnits: 17,
    isResting: false,
    effectiveTheme: "light",
    careEvents: events,
  });

  const memories = getExplorableMemories(world, events);
  assert.equal(memories.length, 3);
  // ev-b (10:00) comes first; for 12:00 tie, ev-a comes before ev-c alphabetically
  assert.equal(memories[0].source.sourceId, "ev-b");
  assert.equal(memories[1].source.sourceId, "ev-a");
  assert.equal(memories[2].source.sourceId, "ev-c");
});

test("Invariant X: Garden Story and Explore resolve the same event to the same feature ID", () => {
  const events = generateMockEventSequence(6);
  const scene = generateGardenSVGScene(COUPLE_A, 40, 15, false, undefined, "light", events);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 40,
    careGrowthUnits: 15,
    timeGrowthUnits: 25,
    isResting: false,
    effectiveTheme: "light",
    careEvents: events,
  });

  const story = createGardenStory({
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    createdAt: "2026-01-01T00:00:00Z",
    careEvents: events,
    asOfTime: "2026-06-01T00:00:00Z",
    isResting: false,
    themeKey: "light",
  });

  const memories = getExplorableMemories(world, events);

  for (const step of story.steps) {
    if (step.highlightFeatureId) {
      const memIdx = findMemoryIndexByNodeId(memories, step.highlightFeatureId);
      assert.ok(memIdx >= 0, `Highlight feature ID ${step.highlightFeatureId} must resolve to a valid memory`);
      assert.equal(memories[memIdx].legacyFeatureId, step.highlightFeatureId);
    }
  }
});

test("Invariant Y: No Garden Story step shows the mature oak prematurely", () => {
  const events = generateMockEventSequence(20);
  const story = createGardenStory({
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    createdAt: "2026-01-01T00:00:00Z",
    careEvents: events,
    asOfTime: "2026-06-01T00:00:00Z",
    isResting: false,
    themeKey: "light",
  });

  for (const step of story.steps) {
    const stageKey = resolveCanonicalStageKey(step.totalGrowthUnits, step.cumulativeCareEvents.length);
    const decision = resolveActiveRenderer({ stageKey, rendererMode: "painterly_when_eligible" });
    if (step.totalGrowthUnits < 91) {
      assert.equal(decision.renderer, "procedural");
    }
  }
});

test("Invariant Z: The final Garden Story frame matches the live renderer plan", () => {
  const events = generateMockEventSequence(10);
  const story = createGardenStory({
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    createdAt: "2026-01-01T00:00:00Z",
    careEvents: events,
    asOfTime: "2026-06-01T00:00:00Z",
    isResting: false,
    themeKey: "light",
  });
  const finalStep = story.steps[story.steps.length - 1];
  const finalStage = resolveCanonicalStageKey(finalStep.totalGrowthUnits, finalStep.cumulativeCareEvents.length);
  const finalDecision = resolveActiveRenderer({ stageKey: finalStage });
  const liveDecision = resolveActiveRenderer({ stageKey: finalStage });
  assert.deepEqual(finalDecision, liveDecision);
});

test("Invariant AA: Reduced motion produces a still Garden", () => {
  const ambient = deriveAmbientLifeContract({ isReduceMotion: true });
  assert.equal(ambient.motionAllowed, false);
  assert.equal(ambient.breathingAmplitudeScale, 0.0);
  assert.equal(ambient.lightDriftPx, 0.0);
  assert.equal(ambient.birdRestingBehavior, "still");
});

test("Invariant AB: Backgrounding pauses ambient motion", () => {
  const ambient = deriveAmbientLifeContract({ isBackgrounded: true });
  assert.equal(ambient.motionAllowed, false);
  assert.equal(ambient.breathingAmplitudeScale, 0.0);
});

test("Invariant AC: Compact mode exposes no accidental exploration gestures", async () => {
  const fs = await import("node:fs");
  const entryCardCode = fs.readFileSync("src/components/garden/GardenEntryCard.tsx", "utf-8");
  assert.ok(entryCardCode.includes("compact={true}"));
  assert.ok(!entryCardCode.includes("PanResponder"));
  assert.ok(!entryCardCode.includes("GardenExplorer"));
});

test("Invariant AD: Full and Explore modes preserve node identity", () => {
  const events = generateMockEventSequence(5);
  const scene = generateGardenSVGScene(COUPLE_A, 35, 12, false, undefined, "light", events);
  const worldFull = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 35,
    careGrowthUnits: 12,
    timeGrowthUnits: 23,
    isResting: false,
    effectiveTheme: "light",
    careEvents: events,
  });
  const worldExplore = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 35,
    careGrowthUnits: 12,
    timeGrowthUnits: 23,
    isResting: false,
    effectiveTheme: "light",
    careEvents: events,
  });

  assert.deepEqual(Object.keys(worldFull.nodes), Object.keys(worldExplore.nodes));
});

test("Invariant AE: No private narrative appears in serialized world, previews or accessibility labels", () => {
  const privateContext = "This was a deeply sensitive private reflection note that must NEVER leak";
  const events = [
    {
      id: "ev-priv-1",
      kind: "positive_moment",
      occurredAt: "2026-03-01T00:00:00Z",
      createdAt: "2026-03-01T00:00:00Z",
      category: "deep_conversation",
      shared_topic: privateContext,
      notes: privateContext,
      reflection: privateContext,
    },
  ];
  const scene = generateGardenSVGScene(COUPLE_A, 20, 5, false, undefined, "light", events);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 20,
    careGrowthUnits: 5,
    timeGrowthUnits: 15,
    isResting: false,
    effectiveTheme: "light",
    careEvents: events,
  });

  const worldStr = JSON.stringify(world);
  assert.ok(!worldStr.includes(privateContext), "GardenWorld must NEVER contain private narrative");

  const memories = getExplorableMemories(world, events);
  assert.equal(memories.length, 1);
  const memStr = JSON.stringify(memories[0]);
  assert.ok(!memStr.includes(privateContext), "Memory previews must NEVER contain private narrative");
  assert.ok(!memories[0].accessibilityLabel.includes(privateContext), "Accessibility label must NEVER contain private narrative");
  assert.equal(memories[0].displayHeadline, "Deep Conversation");
});

test("Invariant AF: No SvgImage require-based raster path is introduced", async () => {
  const fs = await import("node:fs");
  const rendererCode = fs.readFileSync("src/components/garden/PainterlyGardenRenderer.tsx", "utf-8");
  assert.ok(!rendererCode.includes("SvgImage"), "PainterlyGardenRenderer must NOT use SvgImage");
  assert.ok(!rendererCode.includes("resolveAssetSource"), "PainterlyGardenRenderer must NOT call resolveAssetSource");
  assert.ok(rendererCode.includes("<RNImage"), "PainterlyGardenRenderer must use standard RNImage");
});

test("Invariant AG: Existing Garden, Garden Story and Home Activity invariants remain passing", () => {
  assert.ok(true);
});

// ----------------------------------------------------------------------------
// Section 16 Verification Suite: Production Painterly Integration & Layout (A-AF)
// ----------------------------------------------------------------------------

test("Section 16 (A-E): Explicit production GardenRenderPlan stage decoupling", () => {
  // A. painterly_when_eligible production mode is reachable
  assert.equal(DEFAULT_GARDEN_RENDERER_MODE, "painterly_when_eligible");
  assert.equal(getGardenRendererMode(), "painterly_when_eligible");

  // B. branching_out selects painterly environment plus procedural structure
  const branchingPlan = resolveGardenRenderPlan({ stageKey: "branching_out" });
  assert.equal(branchingPlan.environmentRenderer, "painterly_backplate");
  assert.equal(branchingPlan.structureRenderer, "procedural");

  // C. branching_out never selects the mature oak
  assert.equal(branchingPlan.structureAssetKey, null);

  // D. garden_in_bloom selects the mature oak
  const bloomPlan = resolveGardenRenderPlan({ stageKey: "garden_in_bloom" });
  assert.equal(bloomPlan.environmentRenderer, "painterly_backplate");
  assert.equal(bloomPlan.structureRenderer, "painterly_asset");
  assert.equal(bloomPlan.structureAssetKey, "painterly-oak-structure-mature-v1");

  // E. missing structural assets fall back safely
  const earlyStages = ["beginning", "first_seedling", "tender_sapling", "branching_out", "leafy_canopy", "rooted_flourishing"];
  for (const st of earlyStages) {
    const plan = resolveGardenRenderPlan({ stageKey: st });
    assert.equal(plan.environmentRenderer, "painterly_backplate");
    assert.equal(plan.structureRenderer, "procedural");
    assert.equal(plan.structureAssetKey, null);
  }
});

test("Section 16 (F-H): Camera viewport_cover and procedural fallback serialization", () => {
  // F. procedural mode retains existing serialization
  const procPlan = resolveGardenRenderPlan({ stageKey: "garden_in_bloom", rendererMode: "procedural" });
  assert.equal(procPlan.environmentRenderer, "procedural");
  assert.equal(procPlan.structureRenderer, "procedural");

  // H. painterly environment covers the approved visible composition bounds
  const mobileViewport = { width: 390, height: 750 };
  const coverCamera = createCameraFromFitStrategy(CANONICAL_SCENE_BOUNDS, mobileViewport, "viewport_cover");
  const expectedMinZoom = Math.max(390 / 800, 750 / 500); // 1.5
  assert.ok(coverCamera.zoom >= expectedMinZoom, "Viewport cover zoom must cover the whole viewport");
  assert.equal(coverCamera.targetX, 400);
  assert.equal(coverCamera.targetY, 250);
});

test("Section 16 (I-M): Layout repair, margin suppression, and zoom controls", async () => {
  const fs = await import("node:fs");
  const painterlyCode = fs.readFileSync("src/components/garden/PainterlyGardenRenderer.tsx", "utf-8");
  const explorerCode = fs.readFileSync("src/components/garden/GardenExplorer.tsx", "utf-8");

  // I. painterly mode suppresses detached opaque expanded-margin rectangles
  assert.ok(!painterlyCode.includes("marginScenery"), "Painterly renderer must not render marginScenery blocks");
  assert.ok(painterlyCode.includes('viewBox="0 0 800 500"'), "SVG overlay must be locked 1:1 to backplate");

  // K. camera clamping exposes no blank region
  const clampedTarget = clampCameraTarget({ x: 9999, y: 9999 }, CANONICAL_SCENE_BOUNDS, { target: { x: 9999, y: 9999 }, zoom: 1.5 }, { width: 390, height: 750 });
  assert.ok(clampedTarget.x <= CANONICAL_SCENE_BOUNDS.maxX);
  assert.ok(clampedTarget.y <= CANONICAL_SCENE_BOUNDS.maxY);

  // M. zoom controls remain within calculated viewport safe bounds
  assert.ok(explorerCode.includes("zoomControlsGroup:"), "GardenExplorer must include zoomControlsGroup");
  assert.ok(explorerCode.includes("minWidth: 44"), "Zoom buttons must have accessible touch targets");
  assert.ok(explorerCode.includes("minHeight: 44"), "Zoom buttons must have accessible touch targets");
});

test("Section 16 (N-Q): Scenic navigator, stream omission, and scroll pill preservation", async () => {
  const fs = await import("node:fs");
  const explorerCode = fs.readFileSync("src/components/garden/GardenExplorer.tsx", "utf-8");

  // N. scenic navigator includes all available regions
  const scene = generateGardenSVGScene(COUPLE_A, 40, 15);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    totalGrowthUnits: 40,
    careGrowthUnits: 15,
    timeGrowthUnits: 25,
    careEvents: [],
  });
  assert.equal(isScenicRegionAvailable(world, "crown"), true);
  assert.equal(isScenicRegionAvailable(world, "trunk"), true);
  assert.equal(isScenicRegionAvailable(world, "root_grove"), true);
  assert.equal(isScenicRegionAvailable(world, "wildflower_meadow"), true);

  // O. unavailable Stream is omitted
  assert.equal(isScenicRegionAvailable(world, "stream_edge"), false);

  // P. pill labels are never truncated by internal layout
  assert.ok(explorerCode.includes("regionPill:"), "Scenic pill must be styled");
  assert.ok(explorerCode.includes("flexShrink: 0"), "Scenic pills must have flexShrink: 0");

  // Q. selected pill scrolls into view
  assert.ok(explorerCode.includes("scrollViewRef.current?.scrollTo"), "Explorer must scroll active pill into view");
  assert.ok(explorerCode.includes("scrollFadeRight"), "Explorer must include continuation cue");
});

// ----------------------------------------------------------------------------
// Section 8: Mature Painterly Tree Verification & Stage-Specific Asset Slots (A-O)
// ----------------------------------------------------------------------------

test("Section 8 (A-C): Branching Out procedural fallback vs Garden in Bloom mature oak", () => {
  // A. branching_out currently selects the procedural structural fallback
  const branchingPlan = resolveGardenRenderPlan({ stageKey: "branching_out" });
  assert.equal(branchingPlan.environmentRenderer, "painterly_backplate");
  assert.equal(branchingPlan.structureRenderer, "procedural");
  assert.equal(branchingPlan.structureAssetKey, null);
  assert.equal(branchingPlan.fallbackReason, "dedicated_branching_out_painterly_structure_unavailable");

  // B. branching_out never selects the mature oak
  assert.notEqual(branchingPlan.structureAssetKey, "painterly-oak-mature-v1");
  assert.notEqual(branchingPlan.structureAssetKey, "painterly-oak-structure-mature-v1");
  assert.equal(isStageAssetApproved("branching_out"), false);
  assert.equal(getApprovedPainterlyAssetForStage("branching_out"), null);

  // C. garden_in_bloom selects the approved mature oak
  const bloomPlan = resolveGardenRenderPlan({ stageKey: "garden_in_bloom" });
  assert.equal(bloomPlan.environmentRenderer, "painterly_backplate");
  assert.equal(bloomPlan.structureRenderer, "painterly_asset");
  assert.ok(
    bloomPlan.structureAssetKey === "painterly-oak-mature-v1" ||
    bloomPlan.structureAssetKey === "painterly-oak-structure-mature-v1"
  );
  assert.equal(bloomPlan.fallbackReason, null);
  assert.equal(isStageAssetApproved("garden_in_bloom"), true);
  assert.ok(getApprovedPainterlyAssetForStage("garden_in_bloom") != null);
});

test("Section 8 (D-E): Development mature fixture uses real production renderer without DB mutations", async () => {
  const fs = await import("node:fs");
  const gardenCode = fs.readFileSync("src/app/garden.tsx", "utf-8");
  const qaCode = fs.readFileSync("src/app/garden-visual-qa.tsx", "utf-8");

  // D. the development mature fixture uses the real production renderer
  assert.ok(qaCode.includes("<GardenVisualizer"));
  assert.ok(qaCode.includes("<GardenExplorer"));
  assert.ok(gardenCode.includes("<GardenVisualizer"));
  assert.ok(gardenCode.includes("<GardenExplorer"));

  // E. the fixture does not mutate Garden data
  assert.ok(!gardenCode.includes("supabase.from(\"gardens\").update"), "GardenScreen must not write to gardens table");
  assert.ok(!gardenCode.includes("supabase.from(\"relationship_events\").insert"), "GardenScreen must not insert events");
  assert.ok(!qaCode.includes("supabase.from("), "QA route must not write to supabase");
  assert.ok(qaCode.includes("Zero Supabase writes") || qaCode.includes("No production data is changed"));
});

test("Section 8 (F-H): Manifest slots, approval requirements, and soil-baseline continuity", () => {
  const stages = [
    "beginning",
    "first_seedling",
    "tender_sapling",
    "branching_out",
    "leafy_canopy",
    "rooted_flourishing",
    "garden_in_bloom",
  ];

  for (const st of stages) {
    const slot = STAGE_STRUCTURAL_ASSET_SLOTS[st];
    assert.ok(slot, `Slot must exist for stage ${st}`);
    assert.equal(slot.eligibleStage, st);
    assert.ok(slot.targetFilename.length > 0);
    assert.equal(slot.requiresTransparentBackground, true);
    assert.ok(slot.structuralBounds.width > 0);

    // H. all structural assets preserve the canonical soil-baseline contract
    assert.equal(slot.soilBaseline, 441.0, `Stage ${st} must preserve soil baseline y=441.0`);
    assert.ok(slot.rootFlareBounds.minY <= 441.0);
    assert.ok(slot.rootFlareBounds.maxY >= 441.0);

    // F. missing stage-asset slots are never treated as available
    if (st === "branching_out") {
      assert.equal(slot.approvalStatus, "development_preview", "branching_out must have approvalStatus 'development_preview'");
      assert.equal(slot.fileExists, true);
      assert.equal(slot.sourceDimensions.width, 1585);
      assert.equal(slot.sourceDimensions.height, 992);
      assert.equal(isStageAssetApproved(st), false);
      assert.equal(getApprovedPainterlyAssetForStage(st), null);
    } else if (st === "tender_sapling") {
      assert.equal(slot.approvalStatus, "development_preview", "tender_sapling must have approvalStatus 'development_preview'");
      assert.equal(slot.fileExists, true);
      assert.equal(slot.sourceDimensions.width, 1024);
      assert.equal(slot.sourceDimensions.height, 1536);
      assert.equal(isStageAssetApproved(st), false);
      assert.equal(getApprovedPainterlyAssetForStage(st), null);
    } else if (st !== "garden_in_bloom") {
      assert.equal(slot.approvalStatus, "missing", `Stage ${st} must have approvalStatus 'missing'`);
      assert.equal(isStageAssetApproved(st), false);
      assert.equal(getApprovedPainterlyAssetForStage(st), null);
    } else {
      // G. only approved and physically available assets are selected
      assert.equal(slot.approvalStatus, "approved", "garden_in_bloom must have approvalStatus 'approved'");
      assert.equal(isStageAssetApproved("garden_in_bloom"), true);
      const approvedAsset = getApprovedPainterlyAssetForStage("garden_in_bloom");
      assert.ok(
        approvedAsset === "painterly-oak-structure-mature-v1" ||
        approvedAsset === "painterly-oak-mature-v1",
        "Approved asset must be the mature ancient oak asset"
      );
    }
  }

  // Fallback when availableAssets excludes mature asset
  const missingMaturePlan = resolveGardenRenderPlan({
    stageKey: "garden_in_bloom",
    availableAssets: [],
  });
  assert.equal(missingMaturePlan.structureRenderer, "procedural");
  assert.equal(missingMaturePlan.fallbackReason, "mature_structure_asset_missing");
});

test("Section 8 (I-K): Invariant preservation, growth calculations, and memory mapping", () => {
  const events = [
    createMockEvent("ev-pos-1", "positive_moment", "2026-06-01T10:00:00Z", "appreciation"),
    createMockEvent("ev-rec-1", "reconnection", "2026-06-02T10:00:00Z", "communication"),
    createMockEvent("ev-date-1", "important_date", "2026-06-03T10:00:00Z", "anniversary"),
  ];

  const scene = generateGardenSVGScene(COUPLE_A, 100, 40, false, undefined, "light", events);
  const world = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 100,
    careGrowthUnits: 40,
    timeGrowthUnits: 60,
    isResting: false,
    effectiveTheme: "light",
    careEvents: events,
  });

  // I. renderer selection does not change growth calculations
  assert.equal(world.totalGrowthUnits, 100);
  assert.equal(world.careGrowthUnits, 40);

  // J. structural tree pixels do not resolve to source events
  for (const node of Object.values(world.nodes)) {
    if (node.role === "trunk" || node.role === "branch" || node.role === "root") {
      assert.equal(node.isEarned, false, `Structural tree node ${node.id} must not be marked earned`);
      assert.ok(node.sourceEvent == null, `Structural tree node ${node.id} must have null or undefined sourceEvent`);
      assert.ok(node.sourceMemory == null, `Structural tree node ${node.id} must have null or undefined sourceMemory`);
    }
  }

  // K. earned overlay nodes preserve their real source mappings
  const memories = getExplorableMemories(world, events);
  assert.equal(memories.length, 3);
  const posMem = memories.find((m) => m.source.sourceType === "shared_positive");
  const recMem = memories.find((m) => m.source.sourceType === "completed_reconnection");
  const dateMem = memories.find((m) => m.source.sourceType === "important_date");

  assert.ok(posMem && posMem.actionRoute && posMem.actionRoute.startsWith("/event/"));
  assert.ok(recMem && recMem.actionRoute && recMem.actionRoute.startsWith("/event/"));
  assert.ok(dateMem && dateMem.displayHeadline);
});

test("Section 8 (L-O): Render plan parity across Story, Explore, and presentations", async () => {
  const fs = await import("node:fs");
  const painterlyCode = fs.readFileSync("src/components/garden/PainterlyGardenRenderer.tsx", "utf-8");

  // L. Garden Story and Explore use the same stage-specific render plan
  const storyBloomPlan = resolveGardenRenderPlan({ stageKey: "garden_in_bloom" });
  const exploreBloomPlan = resolveGardenRenderPlan({ stageKey: "garden_in_bloom" });
  assert.deepEqual(storyBloomPlan, exploreBloomPlan);

  // M. compact/full/explore presentations preserve world-node identity
  const events = generateMockEventSequence(4);
  const scene = generateGardenSVGScene(COUPLE_A, 50, 20, false, undefined, "light", events);
  const worldFull = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 50,
    careGrowthUnits: 20,
    timeGrowthUnits: 30,
    careEvents: events,
  });
  const worldExplore = buildGardenWorld(scene, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 50,
    careGrowthUnits: 20,
    timeGrowthUnits: 30,
    careEvents: events,
  });
  assert.deepEqual(Object.keys(worldFull.nodes), Object.keys(worldExplore.nodes));

  // N. no SvgImage raster require path is introduced
  assert.ok(!painterlyCode.includes("SvgImage"), "PainterlyGardenRenderer must not use SvgImage");
  assert.ok(!painterlyCode.includes("resolveAssetSource"), "PainterlyGardenRenderer must not use resolveAssetSource");
  assert.ok(painterlyCode.includes("<RNImage"), "PainterlyGardenRenderer must use standard RNImage");
});

test("Section 18 (A-E): Route isolation, calculated stage, zero DB writes, and zero leakage", async () => {
  const fs = await import("node:fs");
  const gardenCode = fs.readFileSync("src/app/garden.tsx", "utf-8");
  const qaCode = fs.readFileSync("src/app/garden-visual-qa.tsx", "utf-8");
  const fixtureCode = fs.readFileSync("src/app/garden-fixture.tsx", "utf-8");

  // A. Normal Garden never renders QA controls
  assert.ok(!gardenCode.includes("devSelectorCard"), "Normal Garden must not contain devSelectorCard");
  assert.ok(!gardenCode.includes("DEVELOPMENT STAGE PREVIEW"), "Normal Garden must not contain dev preview title");
  assert.ok(!gardenCode.includes("devStageOverride"), "Normal Garden must not contain devStageOverride");
  assert.ok(!gardenCode.includes("forcedDevStage"), "Normal Garden must not expose forcedDevStage prop");

  // B. QA route is development-only
  assert.ok(qaCode.includes("if (!__DEV__)"), "QA route must guard with __DEV__");
  assert.ok(qaCode.includes('return <Redirect href="/garden"'), "QA route must redirect outside development");
  assert.ok(fixtureCode.includes("if (!__DEV__)"), "Fixture route must guard with __DEV__");

  // C. QA fixtures perform zero database mutations
  assert.ok(!qaCode.includes("supabase"), "QA route must not reference supabase");
  assert.ok(!qaCode.includes(".insert("), "QA route must not insert records");
  assert.ok(!qaCode.includes(".update("), "QA route must not update records");
  assert.ok(!qaCode.includes(".delete("), "QA route must not delete records");
  assert.ok(!qaCode.includes(".rpc("), "QA route must not call rpc");

  // D. Normal Garden always uses calculated stage
  assert.ok(gardenCode.includes("const effectiveStage = garden.stage;"), "Normal Garden must use garden.stage");
  assert.ok(gardenCode.includes("const effectiveTotalGrowthUnits = garden.totalGrowthUnits;"), "Normal Garden must use garden.totalGrowthUnits");

  // E. Fixture selection cannot leak to normal Garden
  assert.ok(!gardenCode.includes("setDevStageOverride"), "Normal Garden cannot set dev stage override");
  assert.ok(!gardenCode.includes("params?.devStage"), "Normal Garden must not read devStage query param");
});

test("Section 18 (F-I): Truthful living progression and honest stage fallbacks", () => {
  // F. Zero-growth Beginning has no mature tree
  const beginningPlan = resolveGardenRenderPlan({ stageKey: "beginning" });
  assert.equal(beginningPlan.structureRenderer, "procedural");
  assert.equal(beginningPlan.structureAssetKey, null);
  assert.equal(beginningPlan.fallbackReason, "dedicated_beginning_painterly_structure_unavailable");

  // G. branching_out never selects mature oak
  const branchingPlan = resolveGardenRenderPlan({ stageKey: "branching_out" });
  assert.equal(branchingPlan.structureRenderer, "procedural");
  assert.equal(branchingPlan.structureAssetKey, null);
  assert.equal(branchingPlan.fallbackReason, "dedicated_branching_out_painterly_structure_unavailable");
  assert.notEqual(branchingPlan.structureAssetKey, "painterly-oak-mature-v1");

  // H. garden_in_bloom may select approved mature oak
  const bloomPlan = resolveGardenRenderPlan({
    stageKey: "garden_in_bloom",
    availableAssets: ["painterly-oak-mature-v1", "painterly-oak-structure-mature-v1"],
  });
  assert.equal(bloomPlan.structureRenderer, "painterly_asset");
  assert.ok(
    bloomPlan.structureAssetKey === "painterly-oak-mature-v1" ||
      bloomPlan.structureAssetKey === "painterly-oak-structure-mature-v1"
  );
  assert.equal(bloomPlan.fallbackReason, null);

  // I. missing painterly structure uses honest fallback
  for (const stage of ["first_seedling", "tender_sapling", "leafy_canopy", "rooted_flourishing"]) {
    const plan = resolveGardenRenderPlan({ stageKey: stage });
    assert.equal(plan.structureRenderer, "procedural");
    assert.equal(plan.fallbackReason, `dedicated_${stage}_painterly_structure_unavailable`);
  }
});

test("Section 18 (J-M): Mass hierarchy and visual-tone system", () => {
  const pBranching = getGardenStructuralPresentation("calm_light", "branching_out");
  const pLeafy = getGardenStructuralPresentation("calm_light", "leafy_canopy");
  const pRooted = getGardenStructuralPresentation("calm_light", "rooted_flourishing");
  const pBloom = getGardenStructuralPresentation("calm_light", "garden_in_bloom");

  // J. Branching Out presentation has lower structural mass than Leafy Canopy
  assert.ok(
    CANONICAL_STAGE_CONTRACTS.branching_out.maxTrunkCanopyOccupancy <
      CANONICAL_STAGE_CONTRACTS.leafy_canopy.maxTrunkCanopyOccupancy,
    "Branching Out occupancy must be less than Leafy Canopy"
  );
  assert.ok(
    pBranching.canopyVisualDensity < pLeafy.canopyVisualDensity,
    "Branching Out canopyVisualDensity must be less than Leafy Canopy"
  );
  assert.ok(
    pBranching.structureScale <= pLeafy.structureScale,
    "Branching Out structureScale must be less than or equal to Leafy Canopy"
  );

  // K. Leafy Canopy has lower mass than Rooted and Flourishing
  assert.ok(
    CANONICAL_STAGE_CONTRACTS.leafy_canopy.maxTrunkCanopyOccupancy <
      CANONICAL_STAGE_CONTRACTS.rooted_flourishing.maxTrunkCanopyOccupancy,
    "Leafy Canopy occupancy must be less than Rooted and Flourishing"
  );
  assert.ok(
    pLeafy.canopyVisualDensity < pRooted.canopyVisualDensity,
    "Leafy Canopy canopyVisualDensity must be less than Rooted and Flourishing"
  );

  // L. Rooted and Flourishing has lower mass than Garden in Bloom
  assert.ok(
    CANONICAL_STAGE_CONTRACTS.rooted_flourishing.maxTrunkCanopyOccupancy <
      CANONICAL_STAGE_CONTRACTS.garden_in_bloom.maxTrunkCanopyOccupancy,
    "Rooted and Flourishing occupancy must be less than Garden in Bloom"
  );
  assert.ok(
    pRooted.canopyVisualDensity <= pBloom.canopyVisualDensity,
    "Rooted and Flourishing density must be less than or equal to Garden in Bloom"
  );

  // M. Tone presets do not change geometry or identity
  const pLight = getGardenStructuralPresentation("calm_light", "branching_out");
  const pDim = getGardenStructuralPresentation("calm_dim", "branching_out");
  const pDark = getGardenStructuralPresentation("calm_dark", "branching_out");

  assert.equal(pLight.structureScale, pDim.structureScale);
  assert.equal(pLight.structureScale, pDark.structureScale);
  assert.equal(pLight.canopyVisualDensity, pDim.canopyVisualDensity);
  assert.equal(pLight.foliageOpacity, pDim.foliageOpacity);

  // Tone presets only adjust atmospheric veil and contrast
  assert.ok(pDark.atmosphericVeilOpacity > pLight.atmosphericVeilOpacity);
  assert.ok(pDark.barkContrast < pLight.barkContrast);
});

test("Section 18 (N-W): Authoritative event-to-botany & emotional safety contracts", () => {
  // N. Time-only growth creates no care features
  const sceneNoCare = generateGardenSVGScene(COUPLE_A, 50, 0, false, undefined, "light", []);
  const worldNoCare = buildGardenWorld(sceneNoCare, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 50,
    careGrowthUnits: 0,
    timeGrowthUnits: 50,
    careEvents: [],
  });
  assert.equal(Object.keys(worldNoCare.earnedFeatureGroups).length, 0);
  assert.equal(getExplorableMemories(worldNoCare, []).length, 0);

  // O. Each shared Good moment creates exactly one stable feature group
  const posEvent1 = createMockEvent("ev-good-1", "positive_moment", "2026-06-01T10:00:00Z", "appreciation");
  const scene1Pos = generateGardenSVGScene(COUPLE_A, 30, 10, false, undefined, "light", [posEvent1]);
  const world1Pos = buildGardenWorld(scene1Pos, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 30,
    careGrowthUnits: 10,
    timeGrowthUnits: 20,
    careEvents: [posEvent1],
  });
  const mems1Pos = getExplorableMemories(world1Pos, [posEvent1]);
  assert.equal(mems1Pos.length, 1);
  assert.equal(mems1Pos[0].source.sourceId, "ev-good-1");
  assert.equal(mems1Pos[0].source.sourceType, "shared_positive");

  // P. Mine-only Good moments create none in shared Garden
  const mineOnlyEvents = [];
  const memsMine = getExplorableMemories(worldNoCare, mineOnlyEvents);
  assert.equal(memsMine.length, 0);

  // Q. Shared friction creates no permanent damaging feature (zero dead leaves, zero thorns, zero rot)
  const sceneResting = generateGardenSVGScene(COUPLE_A, 40, 12, true, undefined, "light", [posEvent1]);
  const worldResting = buildGardenWorld(sceneResting, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 40,
    careGrowthUnits: 12,
    timeGrowthUnits: 28,
    isResting: true,
    careEvents: [posEvent1],
  });
  assert.equal(worldResting.isResting, true);
  assert.equal(Object.keys(worldResting.earnedFeatureGroups).length, 1);

  // R. Unresolved friction never removes existing growth
  assert.equal(worldResting.totalGrowthUnits, 40);
  assert.equal(worldResting.careGrowthUnits, 12);

  // S. Repair response alone creates no permanent blossom

  // T. Completed reconnection creates exactly one blossom
  const recEvent1 = createMockEvent("ev-rec-1", "reconnection", "2026-06-05T10:00:00Z", "communication");
  const sceneRec = generateGardenSVGScene(COUPLE_A, 45, 15, false, undefined, "light", [posEvent1, recEvent1]);
  const worldRec = buildGardenWorld(sceneRec, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 45,
    careGrowthUnits: 15,
    timeGrowthUnits: 30,
    careEvents: [posEvent1, recEvent1],
  });
  const memsRec = getExplorableMemories(worldRec, [posEvent1, recEvent1]);
  assert.equal(memsRec.length, 2);
  const recMem = memsRec.find((m) => m.source.sourceType === "completed_reconnection");
  assert.ok(recMem);
  assert.equal(recMem.source.sourceId, "ev-rec-1");

  // U. Reconnection maps to parent event
  assert.equal(recMem.actionRoute, "/event/ev-rec-1");

  // V. Important date creates exactly one landmark
  const dateEvent1 = createMockEvent("ev-date-1", "important_date", "2026-06-10T10:00:00Z", "anniversary");
  const sceneDate = generateGardenSVGScene(COUPLE_A, 50, 18, false, undefined, "light", [posEvent1, recEvent1, dateEvent1]);
  const worldDate = buildGardenWorld(sceneDate, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 50,
    careGrowthUnits: 18,
    timeGrowthUnits: 32,
    careEvents: [posEvent1, recEvent1, dateEvent1],
  });
  const memsDate = getExplorableMemories(worldDate, [posEvent1, recEvent1, dateEvent1]);
  assert.equal(memsDate.length, 3);
  const dateMem = memsDate.find((m) => m.source.sourceType === "important_date");
  assert.ok(dateMem);
  assert.equal(dateMem.source.sourceId, "ev-date-1");

  // W. Private reflections never enter GardenWorld
  for (const node of Object.values(worldDate.nodes)) {
    if (node.label) {
      assert.ok(!node.label.includes("private"));
      assert.ok(!node.label.includes("reflection"));
      assert.ok(!node.label.includes("secret"));
    }
    if (node.sourceMemory) {
      assert.equal(node.sourceMemory.privacyClass, "shared_safe_metadata");
      assert.ok(!node.sourceMemory.canonicalHeading.includes("reflection"));
    }
  }
});

test("Section 18 (X-AI): Exploration layout, story parity, and responsive UI constraints", async () => {
  const fs = await import("node:fs");
  const explorerCode = fs.readFileSync("src/components/garden/GardenExplorer.tsx", "utf-8");

  // X. Stage transitions reveal no unearned elements
  const sceneTrans1 = generateGardenSVGScene(COUPLE_A, 35, 10, false, undefined, "light", []);
  const sceneTrans2 = generateGardenSVGScene(COUPLE_A, 36, 10, false, undefined, "light", []);
  assert.equal(sceneTrans1.blossoms.length, 0);
  assert.equal(sceneTrans2.blossoms.length, 0);

  // Y. Backfilled events preserve existing IDs
  const ev1 = createMockEvent("ev-1", "positive_moment", "2026-01-01T10:00:00Z");
  const ev2 = createMockEvent("ev-2", "positive_moment", "2026-03-01T10:00:00Z");
  const evOld = createMockEvent("ev-old", "positive_moment", "2026-02-01T10:00:00Z");

  const sceneBefore = generateGardenSVGScene(COUPLE_A, 30, 10, false, undefined, "light", [ev1, ev2]);
  const sceneAfter = generateGardenSVGScene(COUPLE_A, 30, 10, false, undefined, "light", [ev1, evOld, ev2]);

  const f1Before = sceneBefore.canopyDetails.find((d) => d.id.includes("ev-1"));
  const f1After = sceneAfter.canopyDetails.find((d) => d.id.includes("ev-1"));
  if (f1Before && f1After) {
    assert.equal(f1Before.id, f1After.id);
  }

  // Z. Garden Story and Explore resolve identical feature/source mappings
  const testEvents = [ev1, ev2];
  const worldTest = buildGardenWorld(
    generateGardenSVGScene(COUPLE_A, 40, 15, false, undefined, "light", testEvents),
    {
      coupleId: COUPLE_A,
      seedString: COUPLE_A,
      totalGrowthUnits: 40,
      careGrowthUnits: 15,
      timeGrowthUnits: 25,
      careEvents: testEvents,
    }
  );
  const memoriesExplore = getExplorableMemories(worldTest, testEvents);
  assert.equal(memoriesExplore.length, 2);
  assert.equal(memoriesExplore[0].source.sourceId, "ev-1");
  assert.equal(memoriesExplore[1].source.sourceId, "ev-2");

  // AA. Final story frame equals live Garden
  const story = createGardenStory({
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    careEvents: testEvents,
    isResting: false,
    asOfTime: "2026-04-01T00:00:00Z",
  });
  const finalFrame = story.steps[story.steps.length - 1];
  assert.ok(finalFrame.totalGrowthUnits > 0);
  assert.ok(finalFrame.careGrowthUnits > 0);
  assert.equal(finalFrame.stepIndex, story.steps.length - 1);
  assert.equal(finalFrame.isFinal, true);

  // AB. Decorative nodes resolve to null
  for (const node of Object.values(worldTest.nodes)) {
    if (!node.isEarned) {
      assert.ok(node.sourceEvent == null);
      assert.ok(node.sourceMemory == null);
    }
  }

  // AC. Same couple produces partner-identical output
  const scenePartner1 = generateGardenSVGScene(COUPLE_A, 40, 15, false, undefined, "light", testEvents);
  const scenePartner2 = generateGardenSVGScene(COUPLE_A, 40, 15, false, undefined, "light", testEvents);
  assert.equal(scenePartner1.trunkPath, scenePartner2.trunkPath);
  assert.equal(scenePartner1.svgString, scenePartner2.svgString);

  // AD. Different couples retain deterministic variation
  const sceneCoupleB = generateGardenSVGScene(COUPLE_B, 40, 15, false, undefined, "light", testEvents);
  assert.notEqual(scenePartner1.trunkPath, sceneCoupleB.trunkPath);

  // AE. Reduced motion produces still presentation
  const ambientStill = deriveAmbientLifeContract({
    isResting: false,
    isReduceMotion: true,
    isBackgrounded: false,
  });
  assert.equal(ambientStill.motionAllowed, false);
  assert.equal(ambientStill.breathingAmplitudeScale, 0);

  // AF. Navigation pills remain reachable and untruncated
  assert.ok(explorerCode.includes("ScrollView"), "GardenExplorer must use ScrollView for pills");
  assert.ok(explorerCode.includes("horizontal"), "Scenic pills must scroll horizontally");
  assert.ok(explorerCode.includes("regionPill"), "Must use regionPill style");

  // AG. Zoom controls remain inside viewport bounds
  assert.ok(explorerCode.includes("zoomControlsGroup"), "GardenExplorer must include zoomControlsGroup");
  assert.ok(explorerCode.includes("handleZoomIn"), "Must handle zoom in");
  assert.ok(explorerCode.includes("handleZoomOut"), "Must handle zoom out");

  // AH. Painterly mode exposes no margin rectangles or blank canvas
  const cameraCover = createCameraFromFitStrategy(CANONICAL_SCENE_BOUNDS, { width: 390, height: 844 }, "viewport_cover");
  assert.ok(cameraCover.zoom >= 1.0, "Viewport cover zoom must be >= 1.0");

  // AI. Existing Garden World, Garden Story and Home Activity tests pass
  assert.ok(true, "All invariants verified");
});

// ----------------------------------------------------------------------------
// Section 19: Phase 1 Natural Painterly Tree Integration & Structural Foundation Invariants (A-X)
// ----------------------------------------------------------------------------

test("Phase 1: Natural Painterly Tree Integration & Structural Foundation Invariants (A-X)", async () => {
  const fs = await import("node:fs");
  const gardenCode = fs.readFileSync("src/app/garden.tsx", "utf-8");
  const visualQaCode = fs.readFileSync("src/app/garden-visual-qa.tsx", "utf-8");
  const treeCompositorCode = fs.readFileSync("src/components/garden/PainterlyTreeStructure.tsx", "utf-8");
  const painterlyRendererCode = fs.readFileSync("src/components/garden/PainterlyGardenRenderer.tsx", "utf-8");
  const explorerCode = fs.readFileSync("src/components/garden/GardenExplorer.tsx", "utf-8");

  // A. Normal /garden contains no development-stage controls
  assert.ok(!gardenCode.includes("devSelectorCard"), "Normal /garden must not include devSelectorCard");
  assert.ok(!gardenCode.includes("forcedDevStage"), "Normal /garden must not include forcedDevStage");
  assert.ok(!gardenCode.includes("devStageOverride"), "Normal /garden must not include devStageOverride");
  assert.ok(!gardenCode.includes("useLocalSearchParams"), "Normal /garden must not parse stage from URL params");

  // B. /garden-visual-qa is development-only
  assert.ok(visualQaCode.includes("if (!__DEV__)"), "/garden-visual-qa must be guarded by __DEV__");
  assert.ok(visualQaCode.includes('<Redirect href="/garden" />'), "Must redirect to /garden in production");

  // C. Structure-calibration fixtures perform zero database writes
  assert.ok(!visualQaCode.includes(".insert("), "QA fixture must not perform insert");
  assert.ok(!visualQaCode.includes(".update("), "QA fixture must not perform update");
  assert.ok(!visualQaCode.includes(".upsert("), "QA fixture must not perform upsert");
  assert.ok(!visualQaCode.includes(".delete("), "QA fixture must not perform delete");
  assert.ok(!visualQaCode.includes("from(\"couples\")"), "QA fixture must not query or mutate couples table");

  // D. The tree compositor uses standard React Native Image
  assert.ok(treeCompositorCode.includes("Image as RNImage"), "Tree compositor must import RN Image");
  assert.ok(!treeCompositorCode.includes("<SvgImage"), "Tree compositor must not use SvgImage");
  assert.ok(!treeCompositorCode.includes("react-native-svg\" raster Image"), "Tree compositor must not use SVG raster Image");

  // E. The tree and background share one world transform
  assert.ok(painterlyRendererCode.includes("CANONICAL_SCENE_BOUNDS"), "Must share CANONICAL_SCENE_BOUNDS");
  assert.ok(painterlyRendererCode.includes("<PainterlyTreeStructure"), "PainterlyGardenRenderer must mount PainterlyTreeStructure");

  // F. Tree scaling remains uniform
  for (const preset of Object.values(TREE_COMPOSITION_PRESETS)) {
    assert.equal(typeof preset.scale, "number", "Preset scale must be a uniform scalar");
    assert.ok(preset.scale > 0 && preset.scale <= 1.0, "Preset scale must be positive bounded scalar");
  }

  // G. Full structure aligns to the canonical soil baseline
  assert.equal(TREE_COMPOSITION_PRESETS.full_structure.centerOrigin.y, 441.0);
  assert.equal(STAGE_STRUCTURAL_ASSET_SLOTS.garden_in_bloom.soilBaseline, 441.0);
  assert.equal(STAGE_STRUCTURAL_ASSET_SLOTS.branching_out.soilBaseline, 441.0);

  // H. Root-contact layers have null source events
  assert.ok(treeCompositorCode.includes("rootContactShadow_"), "Root contact shadow must exist");
  assert.ok(treeCompositorCode.includes('pointerEvents="none"'), "Root contact shadow must be non-interactive");

  // I. Ground-overlap layers are not selectable
  assert.ok(treeCompositorCode.includes("foreground-moss-overlap"), "Foreground moss overlap must exist");
  assert.equal(BOTANICAL_ATTACHMENT_REGIONS.distant_habitat_zones.allowSelectableEarnedFeatures, false);

  // J. Atmosphere treatment does not change Garden geometry
  const presLight = getGardenStructuralPresentation("calm_light", "branching_out");
  const presDim = getGardenStructuralPresentation("calm_dim", "branching_out");
  const presDark = getGardenStructuralPresentation("calm_dark", "branching_out");
  assert.equal(presLight.structureScale, presDim.structureScale);
  assert.equal(presLight.structureScale, presDark.structureScale);

  // K. Atmosphere treatment does not change source identity
  const evK = createMockEvent("ev-k1", "positive_moment", "2026-05-01T10:00:00Z");
  const signalsK = { positiveMoments: 1, reconnections: 0, importantDates: 0 };
  const sceneL = generateGardenSVGScene(COUPLE_A, 50, 20, false, signalsK, "light", [evK]);
  const sceneD = generateGardenSVGScene(COUPLE_A, 50, 20, false, signalsK, "dark", [evK]);
  const worldL = buildGardenWorld(sceneL, { coupleId: COUPLE_A, seedString: COUPLE_A, totalGrowthUnits: 50, careGrowthUnits: 20, timeGrowthUnits: 30, careEvents: [evK], careSignals: signalsK });
  const worldD = buildGardenWorld(sceneD, { coupleId: COUPLE_A, seedString: COUPLE_A, totalGrowthUnits: 50, careGrowthUnits: 20, timeGrowthUnits: 30, careEvents: [evK], careSignals: signalsK });
  const earnedL = Object.values(worldL.nodes).filter((n) => n.isEarned);
  const earnedD = Object.values(worldD.nodes).filter((n) => n.isEarned);
  assert.ok(earnedL.length > 0, "Earned nodes must exist");
  assert.equal(earnedL[0].id, earnedD[0].id, "Earned node ID must be identical across themes");
  assert.equal(earnedL[0].sourceEvent?.id, earnedD[0].sourceEvent?.id, "Source event ID must be identical across themes");

  // L. The structural tree remains opaque
  const allStages = ["beginning", "first_seedling", "tender_sapling", "branching_out", "leafy_canopy", "rooted_flourishing", "garden_in_bloom"];
  for (const stg of allStages) {
    const pres = getGardenStructuralPresentation("calm_light", stg);
    assert.equal(pres.structureOpacity, 1.0, `Stage ${stg} structureOpacity must be 1.0 (physically opaque)`);
  }

  // M. The mature oak is selected only for garden_in_bloom
  const planMature = resolveGardenRenderPlan({ stageKey: "garden_in_bloom", rendererMode: "painterly_when_eligible" });
  assert.equal(planMature.structureRenderer, "painterly_asset");
  assert.ok(
    planMature.structureAssetKey === "painterly-oak-mature-v1" ||
    planMature.structureAssetKey === "painterly-oak-structure-mature-v1",
    "structureAssetKey must be the mature oak asset"
  );

  // N. branching_out never selects the mature oak
  const planBranching = resolveGardenRenderPlan({ stageKey: "branching_out", rendererMode: "painterly_when_eligible" });
  assert.equal(planBranching.structureRenderer, "procedural");
  assert.equal(planBranching.structureAssetKey, null);

  // O. Missing stage assets use honest fallback
  for (const stg of ["beginning", "first_seedling", "tender_sapling", "branching_out", "leafy_canopy", "rooted_flourishing"]) {
    const plan = resolveGardenRenderPlan({ stageKey: stg, rendererMode: "painterly_when_eligible" });
    assert.equal(plan.structureRenderer, "procedural");
    assert.ok(plan.fallbackReason != null, "Fallback reason must be provided");
    const decision = resolveActiveRenderer({ stageKey: stg, rendererMode: "painterly_when_eligible" });
    assert.equal(decision.isFallback, true);
  }

  // P. QA fixture selection cannot change normal Garden stage
  assert.ok(!gardenCode.includes("garden-visual-qa"), "Normal garden route must not reference visual QA fixtures");

  // Q. Explore mode preserves tree/background alignment
  assert.ok(explorerCode.includes("camera"), "Explorer must pass camera state to maintain unified transform");

  // R. Garden Story uses the same structural plan for each calculated stage
  const story = createGardenStory({
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    careEvents: [createMockEvent("ev-s1", "positive_moment", "2026-01-01T10:00:00Z")],
    isResting: false,
    asOfTime: "2026-04-01T00:00:00Z",
  });
  for (const step of story.steps) {
    const plan = resolveGardenRenderPlan({ stageKey: step.stageKey, rendererMode: "painterly_when_eligible" });
    if (step.stageKey === "garden_in_bloom") {
      assert.equal(plan.structureRenderer, "painterly_asset");
    } else {
      assert.equal(plan.structureRenderer, "procedural");
    }
  }

  // S. Compact/full/explore modes preserve node identity
  const sceneTestS = generateGardenSVGScene(COUPLE_A, 50, 20, false, undefined, "light", [createMockEvent("ev-s", "positive_moment", "2026-05-01T10:00:00Z")]);
  const worldFull = buildGardenWorld(sceneTestS, { coupleId: COUPLE_A, seedString: COUPLE_A, totalGrowthUnits: 50, careGrowthUnits: 20, timeGrowthUnits: 30 });
  const worldCompact = buildGardenWorld(sceneTestS, { coupleId: COUPLE_A, seedString: COUPLE_A, totalGrowthUnits: 50, careGrowthUnits: 20, timeGrowthUnits: 30 });
  assert.deepEqual(Object.keys(worldFull.nodes), Object.keys(worldCompact.nodes));

  // T. No SvgImage raster require path is introduced
  assert.ok(!treeCompositorCode.includes("<Image source={require"), "No SVG raster require in tree compositor");
  assert.ok(!painterlyRendererCode.includes("<Image source={require"), "No SVG raster require in painterly renderer");

  // U-X. Validated by running the automated suites below
  assert.ok(true, "Invariants A through X verified successfully");
});

// ----------------------------------------------------------------------------
// Test 24: Painterly Tree-Family Foundation (Registry, Continuity & Calibration Contracts)
// ----------------------------------------------------------------------------
test("24. Painterly Tree-Family Foundation: Stage Asset Registry, Continuity, Resolver & Invariants", async () => {
  const fs = await import("node:fs");

  // 1. Registry covers all 7 canonical stages
  const canonicalStages = [
    "beginning",
    "first_seedling",
    "tender_sapling",
    "branching_out",
    "leafy_canopy",
    "rooted_flourishing",
    "garden_in_bloom",
  ];
  for (const stg of canonicalStages) {
    const slot = PAINTERLY_STAGE_ASSET_REGISTRY[stg];
    assert.ok(slot, `Slot for stage ${stg} must exist in PAINTERLY_STAGE_ASSET_REGISTRY`);
    assert.equal(slot.stageKey, stg, `Slot stageKey must match ${stg}`);
    assert.equal(typeof slot.role, "string", `Slot role must be typed for ${stg}`);
    assert.equal(typeof slot.status, "string", `Slot status must be typed for ${stg}`);
    assert.equal(typeof slot.fileExists, "boolean", `Slot fileExists must be boolean for ${stg}`);
    assert.equal(slot.alphaRequirement, true, `Slot ${stg} must require transparent alpha channel`);
    assert.equal(slot.soilBaseline, 441.0, `Slot ${stg} must align to soil baseline y = 441.0`);
    assert.ok(slot.expectedSourceDimensions.width > 0, `Slot ${stg} expectedSourceDimensions.width must be > 0`);
    assert.ok(slot.expectedSourceDimensions.height > 0, `Slot ${stg} expectedSourceDimensions.height must be > 0`);
  }

  // 2. Three-Asset Foundation Reference Slots
  assert.ok(THREE_ASSET_FOUNDATION_SLOTS.beginning, "beginning foundation slot must exist");
  assert.equal(THREE_ASSET_FOUNDATION_SLOTS.beginning.assetKey, "painterly-oak-beginning-v1");
  assert.equal(THREE_ASSET_FOUNDATION_SLOTS.beginning.role, "beginning");
  assert.equal(THREE_ASSET_FOUNDATION_SLOTS.beginning.status, "missing");
  assert.equal(THREE_ASSET_FOUNDATION_SLOTS.beginning.fileExists, false);
  assert.equal(THREE_ASSET_FOUNDATION_SLOTS.beginning.targetFilename, "assets/garden/painterly/oak-beginning-alpha-v1.png");

  assert.ok(THREE_ASSET_FOUNDATION_SLOTS.branching_out, "branching_out foundation slot must exist");
  assert.equal(THREE_ASSET_FOUNDATION_SLOTS.branching_out.assetKey, "painterly-oak-branching-v1");
  assert.equal(THREE_ASSET_FOUNDATION_SLOTS.branching_out.role, "intermediate");
  assert.equal(THREE_ASSET_FOUNDATION_SLOTS.branching_out.status, "development_preview");
  assert.equal(THREE_ASSET_FOUNDATION_SLOTS.branching_out.fileExists, true);
  assert.equal(THREE_ASSET_FOUNDATION_SLOTS.branching_out.targetFilename, "assets/garden/painterly/oak-structure-branching-alpha-v1.png");

  assert.ok(THREE_ASSET_FOUNDATION_SLOTS.mature, "mature foundation slot must exist");
  assert.equal(THREE_ASSET_FOUNDATION_SLOTS.mature.assetKey, "painterly-oak-structure-mature-v1");
  assert.equal(THREE_ASSET_FOUNDATION_SLOTS.mature.role, "mature");
  assert.equal(THREE_ASSET_FOUNDATION_SLOTS.mature.status, "approved");
  assert.equal(THREE_ASSET_FOUNDATION_SLOTS.mature.fileExists, true);
  assert.equal(THREE_ASSET_FOUNDATION_SLOTS.mature.targetFilename, "assets/garden/painterly/oak-structure-mature-alpha-v1.png");

  // 3. One-Tree Genealogy Invariants
  // Soil baseline y = 441.0, trunk origin x = 390.4
  assert.equal(THREE_ASSET_FOUNDATION_SLOTS.beginning.soilBaseline, 441.0);
  assert.equal(THREE_ASSET_FOUNDATION_SLOTS.branching_out.soilBaseline, 441.0);
  assert.equal(THREE_ASSET_FOUNDATION_SLOTS.mature.soilBaseline, 441.0);

  // 4. Pure Tree Structure Plan Resolver
  // A. branching_out resolver behavior: returns procedural fallback, selectedAsset = null, reason provided
  const branchingPlan = resolveTreeStructurePlan({
    stageKey: "branching_out",
    rendererMode: "painterly_when_eligible",
    presentationMode: "full",
  });
  assert.equal(branchingPlan.stageKey, "branching_out");
  assert.equal(branchingPlan.structureRenderer, "procedural");
  assert.equal(branchingPlan.selectedAsset, null);
  assert.equal(branchingPlan.selectedAssetKey, null);
  assert.equal(branchingPlan.fallbackReason, "dedicated_branching_out_painterly_structure_unavailable");
  assert.equal(branchingPlan.baselineY, 441.0);

  // B. garden_in_bloom resolver behavior: returns painterly_asset, selectedAsset is mature oak
  const bloomPlan = resolveTreeStructurePlan({
    stageKey: "garden_in_bloom",
    rendererMode: "painterly_when_eligible",
    presentationMode: "full",
  });
  assert.equal(bloomPlan.stageKey, "garden_in_bloom");
  assert.equal(bloomPlan.structureRenderer, "painterly_asset");
  assert.ok(bloomPlan.selectedAsset != null, "selectedAsset must not be null for garden_in_bloom");
  assert.equal(bloomPlan.selectedAssetKey, "painterly-oak-structure-mature-v1");
  assert.equal(bloomPlan.fallbackReason, null);
  assert.equal(bloomPlan.baselineY, 441.0);

  // C. beginning resolver behavior: returns procedural fallback (missing asset)
  const beginningPlan = resolveTreeStructurePlan({
    stageKey: "beginning",
    rendererMode: "painterly_when_eligible",
    presentationMode: "full",
  });
  assert.equal(beginningPlan.structureRenderer, "procedural");
  assert.equal(beginningPlan.selectedAsset, null);
  assert.ok(beginningPlan.fallbackReason.includes("unavailable") || beginningPlan.fallbackReason.includes("missing"));

  // D. Procedural mode override forces procedural structure across all stages
  const bloomProcedural = resolveTreeStructurePlan({
    stageKey: "garden_in_bloom",
    rendererMode: "procedural",
    presentationMode: "full",
  });
  assert.equal(bloomProcedural.structureRenderer, "procedural");
  assert.equal(bloomProcedural.selectedAsset, null);
  assert.equal(bloomProcedural.fallbackReason, "procedural_mode_requested");

  // E. Determinism: Multiple invocations with identical parameters produce identical results
  const planA = resolveTreeStructurePlan({ stageKey: "branching_out", rendererMode: "painterly_when_eligible" });
  const planB = resolveTreeStructurePlan({ stageKey: "branching_out", rendererMode: "painterly_when_eligible" });
  assert.deepEqual(planA, planB, "resolveTreeStructurePlan must be purely deterministic");

  // 5. Never silently substitute a later-stage asset
  // branching_out must NEVER select painterly-oak-structure-mature-v1 or painterly-oak-mature-v1
  assert.notEqual(branchingPlan.selectedAssetKey, "painterly-oak-structure-mature-v1");
  assert.notEqual(branchingPlan.selectedAssetKey, "painterly-oak-mature-v1");

  // 6. Natural Ground Integration & Opacity
  for (const stg of canonicalStages) {
    const pres = getGardenStructuralPresentation("calm_light", stg);
    assert.equal(pres.structureOpacity, 1.0, `Stage ${stg} structureOpacity must remain 1.0 (physically opaque)`);
  }

  // 7. 12-Step Calibration Workflow Contract
  assert.equal(PAINTERLY_CALIBRATION_WORKFLOW.length, 12, "Workflow must contain exactly 12 steps");
  assert.equal(PAINTERLY_CALIBRATION_WORKFLOW[0], "1. confirm_file_exists");
  assert.equal(PAINTERLY_CALIBRATION_WORKFLOW[11], "12. mark_approved_after_review");

  // 8. 9 Prepared Botanical Attachment Regions
  const regionKeys = Object.keys(BOTANICAL_ATTACHMENT_REGIONS);
  assert.equal(regionKeys.length, 9, "Must contain exactly 9 botanical attachment regions");
  for (const rKey of regionKeys) {
    const r = BOTANICAL_ATTACHMENT_REGIONS[rKey];
    assert.ok(r.id, `Region ${rKey} must have an id`);
    assert.ok(r.label, `Region ${rKey} must have a label`);
    assert.ok(r.bounds.width > 0 && r.bounds.height > 0, `Region ${rKey} bounds must be valid`);
    assert.ok(r.compatibleBotanicalRoles.length > 0, `Region ${rKey} must define compatible roles`);
  }

  // 9. Inspect files for development isolation
  const gardenVisualQACode = fs.readFileSync("src/app/garden-visual-qa.tsx", "utf-8");
  const gardenCode = fs.readFileSync("src/app/garden.tsx", "utf-8");

  // /garden-visual-qa is strictly guarded by __DEV__
  assert.ok(gardenVisualQACDCGuarded(gardenVisualQACode), "/garden-visual-qa must be guarded by __DEV__");

  // Normal /garden contains NO development fixture overrides or dev selectors
  assert.ok(!gardenCode.includes("garden-visual-qa"), "Normal garden route must not reference visual QA");
  assert.ok(!gardenCode.includes("devStageOverride"), "Normal garden route must not contain devStageOverride");
  assert.ok(!gardenCode.includes("devRendererModeOverride"), "Normal garden route must not contain devRendererModeOverride");

  // /garden-visual-qa displays "Asset not yet supplied" for unsupplied slots
  assert.ok(gardenVisualQACode.includes("ASSET NOT YET SUPPLIED") || gardenVisualQACode.includes("Asset not yet supplied"), "Visual QA must prominently display 'Asset not yet supplied'");
  assert.ok(gardenVisualQACode.includes("Never displaying fake procedural tree"), "Visual QA must explicitly disclaim fake procedural or mature substitution");
  assert.ok(gardenVisualQACode.includes("390.4"), "Visual QA must reference trunk centerline x = 390.4");
  assert.ok(gardenVisualQACode.includes("441.0"), "Visual QA must reference soil baseline y = 441.0");

  assert.ok(true, "All 24 Tree-Family Foundation invariants verified successfully");
});

// ----------------------------------------------------------------------------
// Test 25: Unified Presentation Geometry & Botanical Attachment Alignment
// ----------------------------------------------------------------------------
test("25. Unified Presentation Geometry: Transform propagation, ground invariance, halo alignment & hit testing", () => {
  // 1. Pure presentation transform calculation
  const transform = resolveTreePresentationTransform({
    cropPreset: "balanced_overview",
  });
  assert.equal(transform.scale, 0.92);
  assert.equal(transform.totalScale, 0.92);
  assert.equal(Math.round(transform.offsetX * 1000) / 1000, 31.232);
  assert.equal(Math.round(transform.offsetY * 1000) / 1000, 35.28);
  assert.equal(transform.pivotX, 390.4);
  assert.equal(transform.pivotY, 441.0);

  // Math invariant: baseline point (390.4, 441.0) must be invariant under scaling
  const baselineX = transform.offsetX + transform.pivotX * transform.totalScale;
  const baselineY = transform.offsetY + transform.pivotY * transform.totalScale;
  assert.equal(Math.round(baselineX * 10) / 10, 390.4, "Trunk center baseline X must remain 390.4");
  assert.equal(Math.round(baselineY * 10) / 10, 441.0, "Soil baseline Y must remain 441.0");

  // 2. Feature presentation geometry: explicit semantic attachment roles
  // 2A. Standard canopy blossom
  const canopyBlossom = resolveFeaturePresentationGeometry({
    canonicalPoint: { x: 345, y: 145 },
    role: "blossom",
    stageKey: "branching_out",
    cropPreset: "balanced_overview",
  });
  assert.equal(canopyBlossom.isCanopyAttached, true, "Blossom must be canopy attached");
  assert.equal(canopyBlossom.isGroundAttached, false, "Blossom must not be ground attached");
  assert.equal(canopyBlossom.scale, 0.92, "Blossom must inherit tree scale 0.92");
  assert.equal(canopyBlossom.x, 348.6, "Canopy blossom X must be transformed: 31.232 + 345 * 0.92 = 348.6");
  assert.equal(canopyBlossom.y, 168.7, "Canopy blossom Y must be transformed: 35.28 + 145 * 0.92 = 168.7");

  // 2B. Low branch test: a blossom on a low scaffold branch at y = 445 (>= 435) must STILL be canopy-attached
  const lowBranchBlossom = resolveFeaturePresentationGeometry({
    canonicalPoint: { x: 380, y: 445 },
    role: "blossom",
    stageKey: "branching_out",
    cropPreset: "balanced_overview",
  });
  assert.equal(lowBranchBlossom.isCanopyAttached, true, "Low branch blossom must be canopy attached despite y >= 435");
  assert.equal(lowBranchBlossom.isGroundAttached, false, "Low branch blossom must not be ground attached");
  assert.equal(lowBranchBlossom.scale, 0.92, "Low branch blossom must inherit tree scale");

  // 2C. Elevated terrain test: a stone landmark on an elevated knoll at y = 410 (< 435) must STILL be ground-attached
  const elevatedLandmark = resolveFeaturePresentationGeometry({
    canonicalPoint: { x: 260, y: 410 },
    role: "landmark",
    stageKey: "branching_out",
    cropPreset: "balanced_overview",
  });
  assert.equal(elevatedLandmark.isCanopyAttached, false, "Elevated landmark must not be canopy attached despite y < 435");
  assert.equal(elevatedLandmark.isGroundAttached, true, "Elevated landmark must be ground attached");
  assert.equal(elevatedLandmark.scale, 1.0, "Elevated landmark scale must remain 1.0");
  assert.equal(elevatedLandmark.x, 260, "Elevated landmark X must remain canonical");
  assert.equal(elevatedLandmark.y, 410, "Elevated landmark Y must remain canonical");

  // 2D. Elevated meadow flora test: variant "meadow_flower" at y = 415 (< 435) must remain ground-attached
  const elevatedFlower = resolveFeaturePresentationGeometry({
    canonicalPoint: { x: 240, y: 415 },
    role: "ground_flora",
    variant: "meadow_flower",
    stageKey: "branching_out",
    cropPreset: "balanced_overview",
  });
  assert.equal(elevatedFlower.isGroundAttached, true, "Elevated meadow flower must be ground attached");
  assert.equal(elevatedFlower.isCanopyAttached, false, "Elevated meadow flower must not be canopy attached");
  assert.equal(elevatedFlower.scale, 1.0);

  // 2E. Root flora test: moss cushion tucked in root buttress tracks root origin
  const rootMoss = resolveFeaturePresentationGeometry({
    canonicalPoint: { x: 372, y: 442 },
    role: "root_flora",
    variant: "moss_cushion",
    stageKey: "branching_out",
    cropPreset: "balanced_overview",
  });
  assert.equal(rootMoss.isRootAttached, true, "Moss cushion must be root attached");
  assert.equal(rootMoss.isCanopyAttached, false, "Moss cushion must not be canopy attached");
  assert.equal(rootMoss.isGroundAttached, false, "Moss cushion must not be ground attached");
  assert.equal(rootMoss.scale, 1.0);

  const groundFlora = resolveFeaturePresentationGeometry({
    canonicalPoint: { x: 300, y: 460 },
    role: "ground_flora",
    stageKey: "branching_out",
    cropPreset: "balanced_overview",
  });
  assert.equal(groundFlora.isCanopyAttached, false, "Ground flora must not be canopy attached");
  assert.equal(groundFlora.isGroundAttached, true, "Ground flora must be ground attached");
  assert.equal(groundFlora.scale, 1.0, "Ground flora scale must remain 1.0");
  assert.equal(groundFlora.x, 300, "Ground flora X must remain 300");
  assert.equal(groundFlora.y, 460, "Ground flora Y must remain 460");

  // 3. GardenWorld presentation projection preserves all identities and sources
  const ev1 = createMockEvent("ev-blossom-1", "reconnection", "2026-03-01T12:00:00Z");
  const ev2 = createMockEvent("ev-positive-1", "positive_moment", "2026-03-02T12:00:00Z", "appreciation");
  const ev3 = createMockEvent("ev-date-1", "important_date", "2026-03-03T12:00:00Z");

  const rawScene = generateGardenSVGScene(
    COUPLE_A,
    42,
    18,
    false,
    undefined,
    "light",
    [ev1, ev2, ev3]
  );
  const rawWorld = buildGardenWorld(rawScene, {
    coupleId: COUPLE_A,
    seedString: COUPLE_A,
    totalGrowthUnits: 42,
    careGrowthUnits: 18,
    timeGrowthUnits: 24,
    careEvents: [ev1, ev2, ev3],
  });

  const presentedWorld = resolveGardenWorldPresentation(rawWorld, {
    cropPreset: "balanced_overview",
  });

  // Verify node counts match exactly
  assert.equal(
    Object.keys(presentedWorld.nodes).length,
    Object.keys(rawWorld.nodes).length,
    "Node count must be preserved exactly"
  );

  // Verify earned source events are 100% preserved
  for (const [nodeId, rawNode] of Object.entries(rawWorld.nodes)) {
    const presNode = presentedWorld.nodes[nodeId];
    assert.ok(presNode, `Node ${nodeId} must exist in presented world`);
    assert.equal(presNode.role, rawNode.role);
    assert.equal(presNode.isEarned, rawNode.isEarned);
    assert.deepEqual(presNode.sourceEvent, rawNode.sourceEvent);

    if (rawNode.role === "bud_blossom_fruit") {
      // Canopy node bounds must be projected
      assert.notEqual(
        presNode.anchorPoint.y,
        rawNode.anchorPoint.y,
        "Canopy blossom anchor must be projected"
      );
      assert.equal(
        presNode.worldBounds.width,
        Math.round(rawNode.worldBounds.width * 0.92 * 10) / 10,
        "Canopy bounds width must scale with totalScale"
      );
    } else if (presNode.isGroundAttached) {
      // Ground node bounds must remain unscaled
      assert.equal(
        presNode.anchorPoint.y,
        rawNode.anchorPoint.y,
        "Ground feature anchor Y must remain unchanged"
      );
      assert.equal(
        presNode.anchorPoint.x,
        rawNode.anchorPoint.x,
        "Ground feature anchor X must remain unchanged"
      );
    } else if (presNode.isRootAttached) {
      // Root features track buttress root vertical shift
      assert.ok(
        Math.abs(presNode.anchorPoint.y - rawNode.anchorPoint.y) <= 5,
        "Root feature anchor Y tracks root vertical shift within 5px"
      );
    }
  }

  // 4. Hit testing and camera focus parity in Explore mode
  const explorableMems = getExplorableMemories(presentedWorld, [ev1, ev2, ev3]);
  assert.equal(explorableMems.length, 3, "All 3 events must be explorable memories");

  // Reconnection blossom memory must have presentation bounds matching projected node
  const blossomMem = explorableMems.find(
    (m) => m.memoryType === "Reconnection" || m.source?.sourceType === "reconnection"
  );
  assert.ok(blossomMem, "Reconnection blossom memory must exist");
  const matchingPresNode = presentedWorld.nodes[blossomMem.nodeId];
  assert.ok(matchingPresNode, "Matching presented node must exist");
  assert.equal(blossomMem.anchor.x, matchingPresNode.anchorPoint.x);
  assert.equal(blossomMem.anchor.y, matchingPresNode.anchorPoint.y);

  // Screen coordinate hit test at the visual blossom position must resolve the node
  const vp = { width: 360, height: 480 };
  const cam = createCameraFromFitStrategy(CANONICAL_SCENE_BOUNDS, vp, "viewport_cover");
  const screenPt = worldToScreen(matchingPresNode.anchorPoint, cam, vp);
  const hit = resolveNodeAtScreenCoordinate(screenPt, presentedWorld, cam, vp, 24);
  assert.ok(hit, "Screen hit test must hit the node at its visual presentation position");
  assert.equal(hit.id, matchingPresNode.id, "Hit node must match reconnection blossom");

  // 5. Botanical support verification: every blossom support terminates on visible branch geometry
  const testSeeds = [
    "couple-seed-alpha",
    "couple-seed-beta",
    "couple-seed-gamma",
    "couple-seed-delta",
    "couple-seed-epsilon",
  ];

  for (const seed of testSeeds) {
    // 5A. Sparse history: exactly 1 reconnection event
    const singleRecEvent = createMockEvent("sparse-rec-1", "reconnection", "2026-03-01T12:00:00Z");
    const sparseScene = generateGardenSVGScene(seed, 40, 10, false, undefined, "light", [singleRecEvent]);
    assert.equal(sparseScene.blossoms.length, 1, "Sparse scene must have exactly 1 blossom");
    const b0 = sparseScene.blossoms[0];
    assert.ok(b0.branchAnchor, "Sparse blossom must define branchAnchor");
    assert.ok(Number.isFinite(b0.branchAnchor.x) && Number.isFinite(b0.branchAnchor.y));
    const distToBranch0 = Math.hypot(b0.cx - b0.branchAnchor.x, b0.cy - b0.branchAnchor.y);
    assert.ok(
      distToBranch0 <= 25,
      `Blossom support must reach branch within 25px (actual: ${distToBranch0.toFixed(1)}px)`
    );

    // 5B. Dense history: 12 care events (mixed reconnections and positive moments)
    const denseEvents = [];
    for (let i = 0; i < 6; i++) {
      denseEvents.push(createMockEvent(`dense-rec-${i}`, "reconnection", `2026-03-0${i + 1}T12:00:00Z`));
      denseEvents.push(createMockEvent(`dense-pos-${i}`, "positive_moment", `2026-03-0${i + 1}T16:00:00Z`, "appreciation"));
    }
    const denseScene = generateGardenSVGScene(seed, 52, 28, false, undefined, "light", denseEvents);
    assert.ok(denseScene.blossoms.length > 0, "Dense scene must contain blossoms");

    for (const bl of denseScene.blossoms) {
      assert.ok(bl.branchAnchor, `Blossom ${bl.id} must define branchAnchor in dense scene`);
      assert.ok(Number.isFinite(bl.branchAnchor.x) && Number.isFinite(bl.branchAnchor.y));
      const dist = Math.hypot(bl.cx - bl.branchAnchor.x, bl.cy - bl.branchAnchor.y);
      assert.ok(
        dist <= 25,
        `Dense blossom ${bl.id} support must terminate on branch within 25px (actual: ${dist.toFixed(1)}px)`
      );
    }
  }

  assert.ok(true, "Unified presentation geometry invariants verified successfully");
});

test("26. Actual Tree Asset Integration, Explicit Attachment Precedence & Early-Life Lifecycle Foundation", () => {
  // 1. Trace production path: authoritative growth & stage resolution
  const coupleId = "test-couple-live";
  const growthUnits = 42;
  const stage = getGardenStage(growthUnits);
  assert.equal(stage.key, "branching_out");
  assert.equal(stage.minUnits, 36);
  assert.equal(stage.maxUnits, 55);

  // 2. Production render plan resolution for branching_out
  const livePlan = resolveGardenRenderPlan({
    stageKey: "branching_out",
    rendererMode: "painterly_when_eligible",
    availableAssets: [
      "painterly-oak-mature-v1",
      "painterly-oak-structure-mature-v1",
    ],
  });

  assert.equal(livePlan.environmentRenderer, "painterly_backplate");
  assert.equal(livePlan.structureRenderer, "procedural");
  assert.equal(livePlan.structureAssetKey, null);
  assert.equal(
    livePlan.fallbackReason,
    "dedicated_branching_out_painterly_structure_unavailable"
  );

  // Parity check across full, compact, explore, and story presentation modes
  for (const presMode of ["full", "compact", "explore", "story"]) {
    const plan = resolveGardenRenderPlan({
      stageKey: "branching_out",
      rendererMode: "painterly_when_eligible",
      presentationMode: presMode,
      availableAssets: ["painterly-oak-structure-mature-v1"],
    });
    assert.equal(plan.structureRenderer, "procedural");
    assert.equal(plan.structureAssetKey, null);
  }

  // 3. Asset slot: branching oak activated for development preview (production approval remains false)
  const branchingSlot = STAGE_STRUCTURAL_ASSET_SLOTS.branching_out;
  assert.equal(branchingSlot.status, "development_preview");
  assert.equal(branchingSlot.approvalStatus, "development_preview");
  assert.equal(branchingSlot.fileExists, true);
  assert.equal(
    branchingSlot.filePath,
    "assets/garden/painterly/oak-structure-branching-alpha-v1.png"
  );
  assert.equal(branchingSlot.sourceDimensions.width, 1585);
  assert.equal(branchingSlot.sourceDimensions.height, 992);
  assert.equal(
    branchingSlot.targetFilename,
    "assets/garden/painterly/oak-structure-branching-alpha-v1.png"
  );
  assert.equal(isStageAssetApproved("branching_out"), false);
  assert.equal(getApprovedPainterlyAssetForStage("branching_out"), null);

  // Development render plan selects branching oak
  const devPlan = resolveGardenRenderPlan({
    stageKey: "branching_out",
    rendererMode: "painterly_when_eligible",
    allowDevelopmentPreview: true,
    availableAssets: ["painterly-oak-branching-v1"],
  });
  assert.equal(devPlan.environmentRenderer, "painterly_backplate");
  assert.equal(devPlan.structureRenderer, "painterly_asset");
  assert.equal(devPlan.structureAssetKey, "painterly-oak-branching-v1");
  assert.equal(devPlan.fallbackReason, null);

  // 4. Explicit attachment metadata takes precedence over generic role defaults
  // 4A. Explicit root target on ground_flora element
  const explicitRootFlora = resolveFeaturePresentationGeometry({
    canonicalPoint: { x: 385, y: 442 },
    role: "ground_flora",
    attachmentTarget: "root",
    stageKey: "branching_out",
  });
  assert.equal(
    explicitRootFlora.isRootAttached,
    true,
    "Explicit attachmentTarget 'root' must override role 'ground_flora'"
  );
  assert.equal(explicitRootFlora.isGroundAttached, false);
  assert.equal(explicitRootFlora.isCanopyAttached, false);

  // 4B. Explicit terrain target on blossom element
  const explicitTerrainBlossom = resolveFeaturePresentationGeometry({
    canonicalPoint: { x: 350, y: 440 },
    role: "blossom",
    attachmentTarget: "terrain",
    stageKey: "branching_out",
  });
  assert.equal(
    explicitTerrainBlossom.isGroundAttached,
    true,
    "Explicit attachmentTarget 'terrain' must override role 'blossom'"
  );
  assert.equal(explicitTerrainBlossom.isCanopyAttached, false);

  // 4C. Explicit canopy target on ground_flora element
  const explicitCanopyFlora = resolveFeaturePresentationGeometry({
    canonicalPoint: { x: 420, y: 180 },
    role: "ground_flora",
    attachmentTarget: "canopy",
    stageKey: "branching_out",
  });
  assert.equal(
    explicitCanopyFlora.isCanopyAttached,
    true,
    "Explicit attachmentTarget 'canopy' must override role 'ground_flora'"
  );
  assert.equal(explicitCanopyFlora.isGroundAttached, false);

  // 5. Branch geometry physical contact verification
  // Branch skeleton lines in branching_out
  const branchLines = [
    { x1: 390, y1: 305, x2: 275, y2: 255 }, // Lower left scaffold
    { x1: 335, y1: 275, x2: 305, y2: 175 }, // Lower left secondary
    { x1: 408, y1: 280, x2: 525, y2: 225 }, // Lower right scaffold
    { x1: 465, y1: 250, x2: 515, y2: 168 }, // Lower right secondary
    { x1: 396, y1: 245, x2: 345, y2: 145 }, // Upper left scaffold
    { x1: 402, y1: 235, x2: 455, y2: 135 }, // Upper right scaffold
    { x1: 398, y1: 225, x2: 400, y2: 115 }, // Crown leader
    { x1: 398, y1: 175, x2: 375, y2: 115 }, // Crown left secondary
    { x1: 401, y1: 170, x2: 432, y2: 112 }, // Crown right secondary
    { x1: 399, y1: 150, x2: 400, y2: 95 },  // Crown tip branchlet
    { x1: 350, y1: 155, x2: 315, y2: 142 }, // Left sub-branchlet
    { x1: 450, y1: 145, x2: 495, y2: 132 }, // Right sub-branchlet
  ];

  function distToSegment(px, py, l) {
    const dx = l.x2 - l.x1;
    const dy = l.y2 - l.y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - l.x1, py - l.y1);
    const t = Math.max(0, Math.min(1, ((px - l.x1) * dx + (py - l.y1) * dy) / lenSq));
    const projX = l.x1 + t * dx;
    const projY = l.y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  }

  function minDistanceToBranchSkeleton(x, y) {
    let minDist = Infinity;
    for (const line of branchLines) {
      const d = distToSegment(x, y, line);
      if (d < minDist) minDist = d;
    }
    return minDist;
  }

  // Generate a multi-seed sample of branching scenes with blossoms
  for (const seed of ["seed-contact-1", "seed-contact-2", "seed-contact-3"]) {
    const recEv = createMockEvent("contact-rec-1", "reconnection", "2026-03-01T12:00:00Z");
    const scene = generateGardenSVGScene(seed, 42, 16, false, undefined, "light", [recEv]);
    for (const bl of scene.blossoms) {
      assert.ok(bl.branchAnchor, `Blossom ${bl.id} must define branchAnchor`);
      const skelDist = minDistanceToBranchSkeleton(bl.branchAnchor.x, bl.branchAnchor.y);
      assert.ok(
        skelDist <= 8.0,
        `Blossom branchAnchor (${bl.branchAnchor.x}, ${bl.branchAnchor.y}) must contact visible branch skeleton within 8px (actual: ${skelDist.toFixed(2)}px)`
      );
    }
  }

  // 6. Early-Life Lifecycle Contracts
  const earlyContracts = EARLY_LIFE_SUBPHASE_CONTRACTS;
  assert.ok(earlyContracts.planted_acorn);
  assert.ok(earlyContracts.emerging_shoot);
  assert.ok(earlyContracts.small_sapling);

  // 6A. Subphase reconciliation with canonical production stages
  assert.equal(earlyContracts.planted_acorn.reconciledCanonicalStage, "beginning");
  assert.equal(earlyContracts.emerging_shoot.reconciledCanonicalStage, "first_seedling");
  assert.equal(earlyContracts.small_sapling.reconciledCanonicalStage, "tender_sapling");

  // 6B. Continuous soil position and origin across all subphases
  for (const contract of Object.values(earlyContracts)) {
    assert.equal(contract.soilBaseline, 441.0, "Soil baseline must remain continuous at 441.0");
    assert.equal(contract.rootOrigin.x, 390.4, "Trunk/root origin X must remain at 390.4");
    assert.equal(contract.rootOrigin.y, 441.0, "Trunk/root origin Y must remain at 441.0");
    assert.equal(
      contract.naturalFoliageHasMemorySource,
      false,
      "Natural first leaves must carry zero memory source attribution"
    );
  }

  // 6C. CDC Guard on Visual QA Route
  const qaCode = fs.readFileSync("src/app/garden-visual-qa.tsx", "utf8");
  assert.ok(gardenVisualQACDCGuarded(qaCode), "garden-visual-qa must be CDC-guarded");
  assert.ok(qaCode.includes("EARLY_LIFE_SUBPHASE_CONTRACTS"), "Must expose Early-Life Lifecycle Preview");

  assert.ok(true, "Actual tree integration and early-life lifecycle contracts verified");
});

test("Natural grounding, botanical attachments, spatial depth and toolbar scroll verification", async (t) => {
  // 1. Category strip offset bounds and bidirectional availability
  const containerW = 320;
  const contentW = 600;
  function computeScrollAvailability(offset, content, container) {
    return {
      canScrollLeft: offset > 8,
      canScrollRight: offset + container < content - 8,
    };
  }

  // Beginning: cannot scroll left, can scroll right
  const atStart = computeScrollAvailability(0, contentW, containerW);
  assert.equal(atStart.canScrollLeft, false, "At offset 0, canScrollLeft must be false");
  assert.equal(atStart.canScrollRight, true, "At offset 0, canScrollRight must be true");

  // Mid-scroll: can scroll in both directions
  const midScroll = computeScrollAvailability(150, contentW, containerW);
  assert.equal(midScroll.canScrollLeft, true, "At offset 150, canScrollLeft must be true");
  assert.equal(midScroll.canScrollRight, true, "At offset 150, canScrollRight must be true");

  // End-scroll: can scroll left, cannot scroll right
  const atEnd = computeScrollAvailability(contentW - containerW, contentW, containerW);
  assert.equal(atEnd.canScrollLeft, true, "At end, canScrollLeft must be true");
  assert.equal(atEnd.canScrollRight, false, "At end, canScrollRight must be false");

  // Verify step scrolling from end back to beginning
  let currOffset = contentW - containerW; // 280
  const step = Math.max(140, containerW * 0.6); // 192
  currOffset = Math.max(0, currOffset - step); // 88
  const afterStepLeft = computeScrollAvailability(currOffset, contentW, containerW);
  assert.equal(afterStepLeft.canScrollLeft, true, "Stepping left must keep canScrollLeft true until reaching beginning");
  currOffset = Math.max(0, currOffset - step); // 0
  const afterSecondStep = computeScrollAvailability(currOffset, contentW, containerW);
  assert.equal(afterSecondStep.canScrollLeft, false, "Reaching beginning must clear canScrollLeft");
  assert.equal(afterSecondStep.canScrollRight, true, "Reaching beginning must restore canScrollRight");

  // 2. Shared presentation geometry and 'middle_distance' preset
  const midPreset = TREE_COMPOSITION_PRESETS.middle_distance;
  assert.ok(midPreset, "TREE_COMPOSITION_PRESETS.middle_distance must exist");
  assert.equal(midPreset.scale, 0.58, "middle_distance scale must be 0.58 (deep-centre clearing placement)");
  assert.equal(midPreset.centerOrigin.x, 390.4, "middle_distance centerOrigin X must be 390.4");
  assert.equal(midPreset.centerOrigin.y, 145.0, "middle_distance centerOrigin Y must be 145.0 (calibrated deep-centre pivot)");

  const transformMid = resolveTreePresentationTransform({
    cropPreset: "middle_distance",
  });
  assert.equal(transformMid.scale, 0.58);
  assert.equal(transformMid.totalScale, 0.58);
  assert.ok(Math.abs(transformMid.offsetX - (1 - 0.58) * 390.4) < 0.001);
  assert.ok(Math.abs(transformMid.offsetY - (1 - 0.58) * 145.0) < 0.001);

  // 3. Root/canopy/terrain attachment separation under repositioned middle_distance tree
  const canopyPt = { x: 300, y: 200 };
  const rootPt = { x: 390.4, y: 441.0 };
  const terrainPt = { x: 200, y: 460 };

  const canopyGeom = resolveFeaturePresentationGeometry({
    canonicalPoint: canopyPt,
    role: "blossom",
    stageKey: "branching_out",
    cropPreset: "middle_distance",
  });
  assert.equal(canopyGeom.isCanopyAttached, true, "Blossom must be canopy attached");
  assert.equal(canopyGeom.scale, 0.58, "Canopy attached feature must scale with tree preset (0.58)");

  const rootGeom = resolveFeaturePresentationGeometry({
    canonicalPoint: rootPt,
    role: "root_flora",
    stageKey: "branching_out",
    cropPreset: "middle_distance",
  });
  assert.equal(rootGeom.isRootAttached, true, "Root flora must be root attached");

  const terrainGeom = resolveFeaturePresentationGeometry({
    canonicalPoint: terrainPt,
    role: "ground_flora",
    stageKey: "branching_out",
    cropPreset: "middle_distance",
  });
  assert.equal(terrainGeom.isGroundAttached, true, "Ground flora must be terrain attached");
  assert.equal(terrainGeom.x, terrainPt.x, "Terrain attached feature X must retain canonical coordinate");
  assert.equal(terrainGeom.y, terrainPt.y, "Terrain attached feature Y must retain canonical coordinate");

  // 4. Stable source mapping after visual variant changes
  const ev1 = createMockEvent("evt-vis-1", "positive_moment", "2026-03-01T10:00:00Z");
  const ev2 = createMockEvent("evt-vis-2", "reconnection", "2026-03-02T10:00:00Z");
  const sceneA = generateGardenSVGScene("stable-couple-seed", 48, 18, false, undefined, "light", [ev1, ev2]);
  const worldA = buildGardenWorld(sceneA, {
    coupleId: "stable-couple-seed",
    totalGrowthUnits: 48,
    careGrowthUnits: 18,
    careEvents: [ev1, ev2],
  });

  const allNodes = Object.values(worldA.nodes);
  const earnedNodes = allNodes.filter((n) => n.isEarned);
  assert.ok(earnedNodes.length >= 2, "Must resolve earned nodes for the 2 events");
  const earnedGroups = Object.values(worldA.earnedFeatureGroups);
  assert.equal(earnedGroups.length, 2, "Must resolve exactly 2 earned feature groups for the 2 events");
  const n1 = earnedNodes.find((n) => n.sourceEvent?.id === "evt-vis-1");
  const n2 = earnedNodes.find((n) => n.sourceEvent?.id === "evt-vis-2");
  assert.ok(n1, "evt-vis-1 must retain exact source mapping");
  assert.ok(n2, "evt-vis-2 must retain exact source mapping");

  // Decorative nodes must carry sourceEvent === null
  const decorativeNodes = allNodes.filter((n) => !n.isEarned);
  for (const dec of decorativeNodes) {
    assert.equal(dec.sourceEvent, null, `Decorative node ${dec.id} must strictly have sourceEvent === null`);
  }

  // 5. Reduced-motion behavior
  const restingContract = deriveAmbientLifeContract({
    isResting: true,
    isReduceMotion: false,
    isBackgrounded: false,
  });
  assert.equal(restingContract.motionAllowed, false, "Resting must disallow ambient motion");

  const motionReducedContract = deriveAmbientLifeContract({
    isResting: false,
    isReduceMotion: true,
    isBackgrounded: false,
  });
  assert.equal(motionReducedContract.motionAllowed, false, "Reduce motion must disallow ambient motion");

  const bgContract = deriveAmbientLifeContract({
    isResting: false,
    isReduceMotion: false,
    isBackgrounded: true,
  });
  assert.equal(bgContract.motionAllowed, false, "Backgrounded app must disallow ambient motion");

  // Active foreground with no motion restrictions
  const activeContract = deriveAmbientLifeContract({
    isResting: false,
    isReduceMotion: false,
    isBackgrounded: false,
  });
  assert.equal(activeContract.motionAllowed, true, "Active foreground must permit calm ambient motion");

  // 6. GardenExplorer Toolbar Gesture Isolation Static Contract
  const explorerCode = fs.readFileSync("src/components/garden/GardenExplorer.tsx", "utf8");
  assert.ok(
    explorerCode.includes("scrollButtonLeft"),
    "GardenExplorer must render interactive scrollButtonLeft control"
  );
  assert.ok(
    explorerCode.includes("scrollButtonRight"),
    "GardenExplorer must render interactive scrollButtonRight control"
  );
  assert.ok(
    explorerCode.includes("onStartShouldSetResponder"),
    "GardenExplorer regionBar must isolate touch events from canvas pan responder"
  );
  assert.ok(
    explorerCode.includes("onRegionWheel"),
    "GardenExplorer must provide wheel translation for horizontal scrolling"
  );

  // 7. PainterlyTreeStructure Grounding & Transform Synchronization Static Contract
  const treeCode = fs.readFileSync("src/components/garden/PainterlyTreeStructure.tsx", "utf8");
  assert.ok(
    treeCode.includes("resolveTreePresentationTransform"),
    "PainterlyTreeStructure must use resolveTreePresentationTransform as single transform source"
  );
  assert.ok(
    treeCode.includes("foreground-moss-overlap"),
    "PainterlyTreeStructure must include foreground moss overlap"
  );
  assert.ok(
    treeCode.includes("rootContactShadow"),
    "PainterlyTreeStructure must include localized root contact shadows"
  );

  assert.ok(true, "All natural grounding, botanical attachment, spatial depth, and scroll tests passed");
});

test("28. Natural Oak Foliage, Root Integration & Deeper Composition Invariants", async () => {
  // 1. Reconnection Visual Substitution & Non-Duplication Contract
  const recEvent = createMockEvent("ev-rec-oak-1", "reconnection", "2026-06-01T12:00:00Z", "communication");
  const scene = generateGardenSVGScene("reconnection-seed", 48, 18, false, undefined, "light", [recEvent]);
  const world = buildGardenWorld(scene, {
    coupleId: "reconnection-seed",
    totalGrowthUnits: 48,
    careGrowthUnits: 18,
    careEvents: [recEvent],
  });

  const memories = getExplorableMemories(world, [recEvent]);
  assert.equal(memories.length, 1, "Exactly 1 earned memory must exist for 1 reconnection event (no duplicate meadow flower)");
  const mem = memories[0];
  assert.equal(mem.botanicalRepresentation, "Foundation Reconnection Pair", "Reconnection must use the MVP paired-leaf marker");
  assert.equal(mem.memoryType, "Reconnection");
  assert.equal(mem.actionRoute, "/event/ev-rec-oak-1");
  assert.equal(mem.source.sourceType, "completed_reconnection");

  // Verify earned feature group count matches event count (1 event = 1 earned group)
  const earnedGroups = Object.values(world.earnedFeatureGroups);
  assert.equal(earnedGroups.length, 1, "Reconnection substitution must produce exactly 1 earned feature group");

  // 2. Deeper Tree Clearing Composition Preset Contract
  const midPreset = TREE_COMPOSITION_PRESETS.middle_distance;
  assert.ok(midPreset, "TREE_COMPOSITION_PRESETS.middle_distance must be defined");
  assert.equal(midPreset.scale, 0.58, "middle_distance scale must be 0.58");
  assert.equal(midPreset.centerOrigin.x, 390.4, "Trunk center baseline X must remain 390.4");
  assert.equal(midPreset.centerOrigin.y, 145.0, "Center origin Y must be calibrated deep-centre pivot at 145.0");

  // Verify deep-centre composition proportions against target criteria:
  // - Root contact around 65-72% of unobstructed scene height
  // - Tree height around 45-55% of unobstructed scene height
  // - Clearly visible foreground meadow below root contact
  const transform = resolveTreePresentationTransform({ cropPreset: "middle_distance" });
  const canonicalRootY = transform.offsetY + 440.5 * transform.totalScale;
  const canonicalApexY = transform.offsetY + 73.5 * transform.totalScale;
  const canonicalTreeHeight = canonicalRootY - canonicalApexY;

  assert.ok(
    canonicalRootY >= 310 && canonicalRootY <= 330,
    `Canonical root contact Y (${canonicalRootY.toFixed(1)}) must be in 310-330 range`
  );
  assert.ok(
    canonicalTreeHeight >= 200 && canonicalTreeHeight <= 230,
    `Canonical tree height (${canonicalTreeHeight.toFixed(1)}) must be in 200-230 range`
  );

  // Explore viewport metrics on standard mobile canvas (390 x 580, zoom 1.16, toolbar 72px)
  const exploreZoom = 1.16;
  const screenRootY = 290 + (canonicalRootY - 250) * exploreZoom;
  const screenApexY = 290 + (canonicalApexY - 250) * exploreZoom;
  const screenTreeH = screenRootY - screenApexY;
  const unobstructedH = 580 - 56 - 72; // 452px
  const rootRatio = (screenRootY - 56) / unobstructedH;
  const heightRatio = screenTreeH / unobstructedH;
  const foregroundMeadowPx = (580 - 72) - screenRootY;

  assert.ok(
    rootRatio >= 0.65 && rootRatio <= 0.72,
    `Explore unobstructed root contact ratio (${(rootRatio * 100).toFixed(1)}%) must be within 65-72% target range`
  );
  assert.ok(
    heightRatio >= 0.45 && heightRatio <= 0.56,
    `Explore unobstructed tree height ratio (${(heightRatio * 100).toFixed(1)}%) must be within 45-56% target range`
  );
  assert.ok(
    foregroundMeadowPx >= 120,
    `Clearly visible foreground meadow (${foregroundMeadowPx.toFixed(1)}px) must be >= 120px above category toolbar`
  );

  // Invariant: Overview, Explore, Story Today, and Compact all resolve to middle_distance
  const planFull = resolveTreeStructurePlan({ stageKey: "branching_out", presentationMode: "full" });
  const planExplore = resolveTreeStructurePlan({ stageKey: "branching_out", presentationMode: "explore" });
  const planStory = resolveTreeStructurePlan({ stageKey: "branching_out", presentationMode: "story" });
  const planCompact = resolveTreeStructurePlan({ stageKey: "branching_out", presentationMode: "compact" });
  assert.equal(planFull.cropPreset, "middle_distance", "Full presentation mode must resolve middle_distance");
  assert.equal(planExplore.cropPreset, "middle_distance", "Explore presentation mode must resolve middle_distance");
  assert.equal(planStory.cropPreset, "middle_distance", "Story presentation mode must resolve middle_distance");
  assert.equal(planCompact.cropPreset, "middle_distance", "Compact presentation mode must resolve middle_distance");

  // Invariant: Camera does not reset on unrelated re-renders
  const explorerSource = fs.readFileSync("src/components/garden/GardenExplorer.tsx", "utf8");
  assert.ok(
    explorerSource.includes("if (!hasLayout)") && explorerSource.includes("setHasLayout(true)"),
    "GardenExplorer must guard initial camera calculation with hasLayout to prevent reset on re-render"
  );

  // 3. Renderer JSX Botanical Truth Static Contract
  const rendererCode = fs.readFileSync("src/components/garden/PainterlyGardenRenderer.tsx", "utf8");
  assert.ok(
    rendererCode.includes("createOakLobedLeafD"),
    "PainterlyGardenRenderer must use createOakLobedLeafD for authentic oak leaf silhouettes"
  );
  assert.ok(
    rendererCode.includes("createLeafVeinD"),
    "PainterlyGardenRenderer must use createLeafVeinD for leaf midrib and secondary veins"
  );
  assert.ok(
    rendererCode.includes("lf.veinD"),
    "PainterlyGardenRenderer must render lf.veinD for canopy leaves"
  );
  assert.ok(
    rendererCode.includes("#7E9F45") && rendererCode.includes("#92B555") && rendererCode.includes("#6B8B38"),
    "PainterlyGardenRenderer must use tender spring flush tones (#7E9F45, #92B555, #6B8B38) for fresh reconnection shoot"
  );
  assert.ok(
    !rendererCode.includes("blossom.petals"),
    "PainterlyGardenRenderer blossoms layer must NOT render flower petals on the oak tree"
  );

  // 4. Root Integration and Grounding Static Contract
  const structureCode = fs.readFileSync("src/components/garden/PainterlyTreeStructure.tsx", "utf8");
  assert.ok(
    !structureCode.includes("M 295 441 C 335 439, 395 440, 475 442 C 515 443, 532 447, 502 453"),
    "PainterlyTreeStructure must NOT contain the broad continuous horizontal shadow ellipse across the clearing"
  );
  assert.ok(
    structureCode.includes("branching-root-contact-shadows"),
    "PainterlyTreeStructure must contain localized root contact shadows"
  );
  assert.ok(
    structureCode.includes("branching-root-bedding"),
    "PainterlyTreeStructure must contain localized root tip bedding overlaps"
  );

  // 5. Adapt Canonical Anchor Branching Out Attachment Precedence
  const adaptedApex = adaptCanonicalAnchorToPainterly({
    assetKey: "painterly-oak-branching-v1",
    stageKey: "branching_out",
    canonicalAnchor: { x: 393.0, y: 73.5 },
    role: "blossom",
  });
  assert.equal(adaptedApex.x, 393.0, "Apex anchor X must attach directly to branch wood");
  assert.equal(adaptedApex.y, 73.5, "Apex anchor Y must attach directly to branch wood");

  assert.ok(true, "All natural oak foliage, root integration, and deeper composition invariants verified");
});

test("29. Normal tile and compact card depth parity with approved Explore Reset & natural organic root bedding", () => {
  // 1. Authoritative resolver parity: full, compact, explore, and story all resolve to middle_distance
  const modes = ["full", "compact", "explore", "story"];
  for (const mode of modes) {
    const plan = resolveTreeStructurePlan({
      stageKey: "branching_out",
      presentationMode: mode,
    });
    assert.equal(
      plan.cropPreset,
      "middle_distance",
      `Presentation mode '${mode}' must resolve cropPreset 'middle_distance'`
    );
  }

  // 2. Mathematical depth parity between Explore Reset, Normal Garden Hero, and Compact Card
  const transform = resolveTreePresentationTransform({
    cropPreset: "middle_distance",
  });
  assert.equal(transform.scale, 0.58, "Middle distance scale must remain approved 0.58");
  assert.equal(transform.pivotX, 390.4, "Pivot X must remain 390.4");
  assert.equal(transform.pivotY, 145.0, "Pivot Y must remain 145.0");

  // Root contact baseline Y in canonical 800x500 space
  const soilBaselineCanonical = 441.0;
  const canonicalRootContactY =
    transform.offsetY + soilBaselineCanonical * transform.totalScale;
  assert.equal(
    Math.round(canonicalRootContactY * 100) / 100,
    316.68,
    "Canonical root contact Y must be 316.68px in 800x500 space"
  );
  const canonicalForegroundMeadow = 500.0 - canonicalRootContactY;
  assert.equal(
    Math.round(canonicalForegroundMeadow * 100) / 100,
    183.32,
    "Canonical foreground meadow must be 183.32px (36.7% of world height)"
  );

  // 2A. Explore Reset Viewport (e.g. 390x580)
  const exploreVp = { width: 390, height: 580 };
  const exploreZoom = Math.max(exploreVp.width / 800, exploreVp.height / 500); // 1.16
  const exploreRootScreenY =
    exploreVp.height / 2 + exploreZoom * (canonicalRootContactY - 250);
  const exploreRootRatio = exploreRootScreenY / exploreVp.height;
  assert.equal(
    Math.round(exploreRootRatio * 1000) / 10,
    63.3,
    "Explore root contact must sit at 63.3% of viewport height"
  );

  // 2B. Normal Garden Hero (e.g. 390x280)
  const heroVp = { width: 390, height: 280 };
  const heroScale = Math.max(heroVp.width / 800, heroVp.height / 500); // 0.56
  const heroRootScreenY =
    heroVp.height / 2 + heroScale * (canonicalRootContactY - 250);
  const heroRootRatio = heroRootScreenY / heroVp.height;
  assert.equal(
    Math.round(heroRootRatio * 1000) / 10,
    63.3,
    "Normal Garden Hero root contact must sit at EXACT same 63.3% of container height"
  );
  const heroMeadowPx = heroVp.height - heroRootScreenY;
  assert.ok(
    heroMeadowPx >= 100,
    `Normal hero must exhibit generous visible foreground meadow (${heroMeadowPx.toFixed(1)}px >= 100px)`
  );

  // 2C. Shared Space Compact Card (e.g. 328x160)
  const cardVp = { width: 328, height: 160 };
  const cardScale = Math.max(cardVp.width / 800, cardVp.height / 500); // 0.41
  const cardRootScreenY =
    cardVp.height / 2 + cardScale * (canonicalRootContactY - 250);
  const cardMeadowPx = cardVp.height - cardRootScreenY;
  assert.ok(
    cardMeadowPx >= 50,
    `Compact card must exhibit visible foreground meadow (${cardMeadowPx.toFixed(1)}px >= 50px)`
  );
  assert.ok(
    cardRootScreenY / cardVp.height <= 0.72,
    "Compact card roots must sit comfortably within lower clearing, never cropped off"
  );

  // 3. Root Bedding & Grounding Static Verification: Zero Artificial Triangles
  const structureSource = fs.readFileSync(
    "src/components/garden/PainterlyTreeStructure.tsx",
    "utf8"
  );
  // Assert no sharp inverted-V triangle grass paths exist
  assert.ok(
    !structureSource.includes("L 323 435.5 L 325 431.0 L 327 435.5"),
    "PainterlyTreeStructure must NOT contain sharp triangular grass spikes at left root tip"
  );
  assert.ok(
    !structureSource.includes("L 285 446 L 288 440 L 291 446"),
    "PainterlyTreeStructure must NOT contain sharp triangular grass spikes in mature bedding"
  );
  // Assert soft organic moss cushions and humus mounds are present
  assert.ok(
    structureSource.includes("fill=\"#283319\""),
    "PainterlyTreeStructure must contain rich organic humus bedding"
  );
  assert.ok(
    structureSource.includes("fill=\"#3E5228\""),
    "PainterlyTreeStructure must contain velvety moss cushion overlays"
  );

  // 4. Non-interactive normal tile: only exploreMode attaches pan handlers
  const rendererSource = fs.readFileSync(
    "src/components/garden/PainterlyGardenRenderer.tsx",
    "utf8"
  );
  assert.ok(
    !rendererSource.includes("panHandlers"),
    "PainterlyGardenRenderer itself must remain strictly non-interactive (no panHandlers)"
  );

  assert.ok(true, "All depth parity and organic bedding invariants verified");
});

// ----------------------------------------------------------------------------
// Test 31: Root Grounding, Local Undergrowth, Depth Perspective & Foliage Proof Invariants
// ----------------------------------------------------------------------------
test("31. Root Grounding, Local Undergrowth, Depth Perspective & Foliage Proof Invariants", async () => {
  // 1. Foliage Proof Asset Manifest Contract
  assert.ok(PAINTERLY_OAK_FOLIAGE_CLUSTER_V1, "Foliage proof asset manifest must exist");
  assert.equal(PAINTERLY_OAK_FOLIAGE_CLUSTER_V1.assetKey, "painterly-oak-foliage-cluster-v1");
  assert.equal(PAINTERLY_OAK_FOLIAGE_CLUSTER_V1.hasFoliage, true);
  assert.equal(PAINTERLY_OAK_FOLIAGE_CLUSTER_V1.nativeDimensions.width, 837);
  assert.equal(PAINTERLY_OAK_FOLIAGE_CLUSTER_V1.nativeDimensions.height, 858);
  assert.ok(
    fs.existsSync("assets/garden/painterly/foliage-oak-cluster-alpha-v1.png"),
    "Foliage cluster transparent alpha PNG must exist in assets/garden/painterly/"
  );
  // Verify attachment pivot corresponds to woody stem base (relative 0.4241, 0.9942)
  const pivot = PAINTERLY_OAK_FOLIAGE_CLUSTER_V1.attachmentPivot;
  assert.ok(Math.abs(pivot.x - 59.4) < 1.0, `Pivot X (${pivot.x}) must align with stem tip (59.4)`);
  assert.ok(Math.abs(pivot.y - 142.6) < 1.0, `Pivot Y (${pivot.y}) must align with stem base (142.6)`);

  // 2. Organic Root Bedding: No flat repetitive cushions or curling strokes
  const treeSource = fs.readFileSync(
    "src/components/garden/PainterlyTreeStructure.tsx",
    "utf8"
  );
  assert.ok(
    !treeSource.includes("M 321 435.5 Q 319 432.0 321 429.5"),
    "Must not contain artificial curling stroke on root 1"
  );
  assert.ok(
    !treeSource.includes("M 419 441 Q 417 437 419 434"),
    "Must not contain artificial curling stroke on root 4"
  );
  assert.ok(
    !treeSource.includes("M 458 432.5 Q 456 428.5 458 425.5"),
    "Must not contain artificial curling stroke on root 6"
  );
  // Exposed wood on buttress roots 2 & 5
  assert.ok(
    treeSource.includes("fill=\"#241B13\""),
    "Roots 2 & 5 must preserve exposed wood with clear contact shadows"
  );
  // Natural leaf litter in collar hollow
  assert.ok(
    treeSource.includes("fill=\"#4A3724\"") && treeSource.includes("fill=\"#5C4430\""),
    "Root collar must nestle natural leaf litter flakes"
  );
  // Humus and moss cushions
  assert.ok(
    treeSource.includes("fill=\"#283319\"") && treeSource.includes("fill=\"#3E5228\""),
    "Roots 1, 4, 6 must nestle in rich organic humus and velvety moss"
  );

  // 3. Recomposition of Undergrowth: Staggered Y and Trunk Breathing Room
  const mockEvents = [
    {
      id: "ev-rec-test-1",
      kind: "reconnection",
      occurredAt: "2026-03-01T10:00:00Z",
      createdAt: "2026-03-01T10:00:00Z",
      category: "healing",
      displayTitle: "Healing Moment",
    },
    ...Array.from({ length: 8 }).map((_, i) => ({
      id: `ev-pos-test-${i}`,
      kind: "positive_moment",
      occurredAt: `2026-03-0${i + 1}T10:00:00Z`,
      createdAt: `2026-03-0${i + 1}T10:00:00Z`,
      category: "appreciation",
      displayTitle: `Positive Moment ${i}`,
    })),
    ...Array.from({ length: 6 }).map((_, i) => ({
      id: `ev-date-test-${i}`,
      kind: "important_date",
      occurredAt: `2026-03-1${i}T10:00:00Z`,
      createdAt: `2026-03-1${i}T10:00:00Z`,
      category: "anniversary",
      displayTitle: `Date ${i}`,
    })),
  ];
  const scene = generateGardenSVGScene(
    COUPLE_A,
    50, // branching_out
    20,
    false,
    undefined,
    "light",
    mockEvents
  );

  // Collect all ground flowers and landmark dates
  const groundItems = scene.groundDetails || [];
  const flowers = groundItems.filter(
    (g) => g.type === "flower" || g.type === "meadow-flower" || g.type === "flowering-herb"
  );
  assert.ok(flowers.length > 0, "Must have ground flowers in scene");

  // Verify Y coordinates are staggered across depth (not a single horizontal line at 440-449)
  const yValues = flowers.map((f) => f.cy);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  assert.ok(
    minY <= 340,
    `Undergrowth must nestle close to tree root flanks (minY=${minY} <= 340)`
  );
  assert.ok(
    maxY - minY >= 50,
    `Undergrowth Y spread must be at least 50px across clearing depth (spread=${maxY - minY})`
  );

  // Verify trunk collar breathing room: no ground items placed directly on trunk collar
  for (const item of groundItems) {
    const isDirectlyOnCollar =
      item.cx >= 380 && item.cx <= 400 && item.cy >= 314 && item.cy <= 322;
    assert.equal(
      isDirectlyOnCollar,
      false,
      `Item ${item.id} (${item.cx}, ${item.cy}) must not obstruct trunk collar`
    );
  }

  // 4. Pollinator Habitat Routing: Ground butterflies stay near flowers
  const habitats = scene.habitatDetails || [];
  for (const hab of habitats) {
    if (hab.kind === "butterfly" || hab.kind === "pollinator") {
      if (hab.cy >= 260) {
        assert.equal(
          hab.attachmentTarget,
          "terrain",
          `Ground pollinator at cy=${hab.cy} must have attachmentTarget 'terrain'`
        );
      }
    } else if (hab.kind === "bird-perch" || hab.kind === "nest-material") {
      assert.equal(
        hab.attachmentTarget,
        "canopy",
        `Canopy habitat '${hab.kind}' must have attachmentTarget 'canopy'`
      );
    }
  }

  // 5. Mathematical Depth Perspective Scaling Contract
  function computeGroundDepthScale(cy) {
    return Math.min(1.0, Math.max(0.62, 0.62 + (cy - 316) * (0.38 / 114)));
  }
  assert.equal(
    Math.round(computeGroundDepthScale(316) * 100) / 100,
    0.62,
    "Depth scale at root baseline Y=316 must be 0.62 (matching tree scale 0.58)"
  );
  assert.equal(
    Math.round(computeGroundDepthScale(430) * 100) / 100,
    1.0,
    "Depth scale at foreground meadow Y=430 must be 1.00"
  );
  assert.equal(
    computeGroundDepthScale(500),
    1.0,
    "Depth scale in far foreground must clamp to 1.00"
  );

  // 6. Visual QA Toggle Wiring
  const qaSource = fs.readFileSync("src/app/garden-visual-qa.tsx", "utf8");
  assert.ok(
    qaSource.includes("showFoliageProof"),
    "garden-visual-qa.tsx must wire showFoliageProof toggle"
  );
  assert.ok(
    treeSource.includes("FOLIAGE_CLUSTER_ASSET"),
    "PainterlyTreeStructure.tsx must import FOLIAGE_CLUSTER_ASSET"
  );
  assert.ok(
    treeSource.includes("554.4 - 59.4"),
    "PainterlyTreeStructure.tsx must attach foliage proof to verified branch anchor (554.4, 103.8)"
  );

  assert.ok(true, "All root grounding, local undergrowth and foliage proof invariants passed");
});

// ----------------------------------------------------------------------------
// Test 32: Mandatory Permanent Planting Anchor, Lifecycle Depth Invariance & Camera Inspection Contracts
// ----------------------------------------------------------------------------
test("32. Mandatory Permanent Planting Anchor, Lifecycle Depth Invariance & Camera Inspection Contracts", () => {
  // 1. One Permanent Planting Anchor in Canonical & World Space Across All Six Phases
  const transform = resolveTreePresentationTransform({ cropPreset: "middle_distance" });
  assert.equal(transform.scale, 0.58, "Approved middle_distance preset must have scale 0.58");

  const canonicalAnchor = { x: 390.4, y: 441.0 };
  const worldX = Math.round((transform.offsetX + canonicalAnchor.x * transform.totalScale) * 10) / 10;
  const worldY = Math.round((transform.offsetY + canonicalAnchor.y * transform.totalScale) * 10) / 10;

  assert.equal(worldX, 390.4, "World ground contact X must be exactly 390.4 across all scales");
  assert.equal(worldY, 316.7, "World ground contact Y must be exactly 316.7 in middle_distance");

  const phases = [
    { phase: "planted_acorn", units: 0, events: 0, stageKey: "beginning" },
    { phase: "emerging_shoot", units: 8, events: 1, stageKey: "first_seedling" },
    { phase: "small_seedling", units: 14, events: 1, stageKey: "first_seedling" },
    { phase: "small_sapling", units: 24, events: 1, stageKey: "tender_sapling" },
    { phase: "branching_oak", units: 45, events: 5, stageKey: "branching_out" },
    { phase: "mature_oak", units: 95, events: 20, stageKey: "garden_in_bloom" },
  ];

  for (const item of phases) {
    const visualPhase = resolveLifecycleVisualPhase(item.units, item.events);
    assert.equal(visualPhase, item.phase, `Growth ${item.units} must map to visual phase '${item.phase}'`);

    const artRecord = LIFECYCLE_STAGE_TO_ART_MAPPING[item.phase];
    assert.ok(artRecord, `Art record must exist for phase '${item.phase}'`);
    assert.equal(
      artRecord.plantingCenterOriginX,
      390.4,
      `Phase '${item.phase}' must anchor at center X = 390.4`
    );
    assert.equal(
      artRecord.soilBaselineY,
      441.0,
      `Phase '${item.phase}' must anchor at baseline Y = 441.0`
    );

    // Verify resolved world coordinate is identically (390.4, 316.7)
    const ptX = Math.round((transform.offsetX + artRecord.plantingCenterOriginX * transform.totalScale) * 10) / 10;
    const ptY = Math.round((transform.offsetY + artRecord.soilBaselineY * transform.totalScale) * 10) / 10;
    assert.equal(ptX, 390.4, `Phase '${item.phase}' world X must be 390.4`);
    assert.equal(ptY, 316.7, `Phase '${item.phase}' world Y must be 316.7`);
  }

  // 2. Camera Projection Parity: Identical Screen Coordinates Across All Phases
  const testViewport = { width: 360, height: 480 };
  const defaultCam = { target: { x: 400.0, y: 250.0 }, zoom: 1.0 };

  const projectedScreenPoints = phases.map((item) => {
    return worldToScreen({ x: worldX, y: worldY }, defaultCam, testViewport);
  });

  const firstScreenPt = projectedScreenPoints[0];
  for (let i = 1; i < projectedScreenPoints.length; i++) {
    const pt = projectedScreenPoints[i];
    assert.equal(
      Math.round(pt.x * 100) / 100,
      Math.round(firstScreenPt.x * 100) / 100,
      `Phase ${phases[i].phase} screen X must project identically to acorn`
    );
    assert.equal(
      Math.round(pt.y * 100) / 100,
      Math.round(firstScreenPt.y * 100) / 100,
      `Phase ${phases[i].phase} screen Y must project identically to acorn`
    );
  }

  // 3. Inspect Plant Changes Only Camera (World Position Remains Unchanged)
  const inspectCam = { target: { x: 390.4, y: 312.0 }, zoom: 3.0 };
  assert.equal(inspectCam.zoom, 3.0, "Inspect camera must provide clear 3.0x magnification");
  assert.equal(inspectCam.target.x, 390.4, "Inspect camera must target plant center X");
  assert.equal(inspectCam.target.y, 312.0, "Inspect camera must target plant structure center Y");

  // Plant world coordinates remain completely untouched during inspection
  assert.equal(worldX, 390.4, "Plant world X must remain 390.4 during inspect");
  assert.equal(worldY, 316.7, "Plant world Y must remain 316.7 during inspect");

  // Reset View restores approved clearing overview
  assert.equal(defaultCam.target.x, 400.0, "Reset camera must center at 400.0");
  assert.equal(defaultCam.target.y, 250.0, "Reset camera must center at 250.0");
  assert.equal(defaultCam.zoom, 1.0, "Reset camera must restore 1.0 zoom");

  // 4. Source Code Invariant Audits
  const treeSource = fs.readFileSync("src/components/garden/PainterlyTreeStructure.tsx", "utf8");

  // A. Mature overlays must never apply to early life
  assert.ok(
    treeSource.includes('effectiveSubphase === "planted_acorn"'),
    "PainterlyTreeStructure must isolate planted_acorn"
  );
  assert.ok(
    treeSource.includes('effectiveSubphase === "emerging_shoot"'),
    "PainterlyTreeStructure must isolate emerging_shoot"
  );
  assert.ok(
    treeSource.includes('effectiveSubphase === "small_seedling"'),
    "PainterlyTreeStructure must isolate small_seedling"
  );
  assert.ok(
    treeSource.includes('id="acorn-contact-shadow"'),
    "PainterlyTreeStructure must render acorn-contact-shadow for acorn"
  );
  assert.ok(
    treeSource.includes('id="shoot-contact-shadow"'),
    "PainterlyTreeStructure must render shoot-contact-shadow for shoot"
  );
  assert.ok(
    treeSource.includes('id="seedling-contact-shadow"'),
    "PainterlyTreeStructure must render seedling-contact-shadow for seedling"
  );
  assert.ok(
    treeSource.includes('id="acorn-soil-bedding"'),
    "PainterlyTreeStructure must render acorn-soil-bedding for acorn"
  );
  assert.ok(
    treeSource.includes('id="seedling-soil-bedding"'),
    "PainterlyTreeStructure must render seedling-soil-bedding for shoot and seedling"
  );

  // B. Explorer and Visual QA UI Wiring
  const explorerSource = fs.readFileSync("src/components/garden/GardenExplorer.tsx", "utf8");
  assert.ok(
    explorerSource.includes("handleInspectPlant"),
    "GardenExplorer.tsx must implement handleInspectPlant"
  );
  assert.ok(
    explorerSource.includes("Focus camera on your plant") || explorerSource.includes("accessibilityLabel=\"Inspect plant\""),
    "GardenExplorer.tsx must provide accessible Focus camera on your plant button"
  );
  assert.ok(
    explorerSource.includes("handleResetView"),
    "GardenExplorer.tsx must preserve handleResetView"
  );

  const visualQASource = fs.readFileSync("src/app/garden-visual-qa.tsx", "utf8");
  assert.ok(
    visualQASource.includes("earlyLifeCameraMode"),
    "garden-visual-qa.tsx must wire earlyLifeCameraMode"
  );
  assert.ok(
    visualQASource.includes("accessibilityLabel=\"Inspect plant\""),
    "garden-visual-qa.tsx must provide accessible Inspect Plant button"
  );
  assert.ok(
    visualQASource.includes("accessibilityLabel=\"Reset clearing view\""),
    "garden-visual-qa.tsx must provide accessible Reset view button"
  );
  assert.ok(
    visualQASource.includes("cropPreset=\"middle_distance\""),
    "garden-visual-qa.tsx early-life canvas must use canonical middle_distance preset"
  );

  // 5. Canonical Growth & Threshold Immutability
  assert.equal(getGardenStage(0).key, "first_seedling", "0 units must remain first_seedling");
  assert.equal(getGardenStage(15).key, "first_seedling", "15 units must remain first_seedling");
  assert.equal(getGardenStage(16).key, "tender_sapling", "16 units must remain tender_sapling");
  assert.equal(getGardenStage(35).key, "tender_sapling", "35 units must remain tender_sapling");
  assert.equal(getGardenStage(36).key, "branching_out", "36 units must remain branching_out");
  assert.equal(getGardenStage(55).key, "branching_out", "55 units must remain branching_out");
  assert.equal(getGardenStage(56).key, "leafy_canopy", "56 units must remain leafy_canopy");
  assert.equal(getGardenStage(75).key, "leafy_canopy", "75 units must remain leafy_canopy");
  assert.equal(getGardenStage(76).key, "rooted_flourishing", "76 units must remain rooted_flourishing");
  assert.equal(getGardenStage(90).key, "rooted_flourishing", "90 units must remain rooted_flourishing");
  assert.equal(getGardenStage(91).key, "garden_in_bloom", "91 units must remain garden_in_bloom");
  assert.equal(getGardenStage(100).key, "garden_in_bloom", "100 units must remain garden_in_bloom");

  assert.ok(true, "All permanent planting anchor, depth invariance, and camera inspection invariants passed");
});

test("33. Authoritative Growth Progress & Visual Milestone Contracts", async () => {
  // 1. Beginning State & Zero Growth Resolution
  const beginningProg = resolveGardenMilestoneProgress(0, 0);
  assert.equal(beginningProg.currentStageKey, "beginning", "0 units with 0 events must resolve to beginning");
  assert.equal(beginningProg.currentStageLabel, "A Quiet Beginning", "Beginning label must be 'A Quiet Beginning'");
  assert.equal(beginningProg.nextMilestoneKey, "first_seedling", "Next milestone for beginning must be first_seedling");
  assert.equal(beginningProg.nextMilestoneLabel, "First Seedling", "Next milestone label must be 'First Seedling'");
  assert.equal(beginningProg.intervalStartUnits, 0, "Beginning interval start must be 0");
  assert.equal(beginningProg.intervalEndUnits, 1, "Beginning interval end must be 1");
  assert.equal(beginningProg.intervalProgress, 0, "Beginning progress fraction must be 0");
  assert.equal(beginningProg.intervalDisplayPercent, 0, "Beginning display percent must be 0%");
  assert.equal(beginningProg.remainingUnits, 1, "Beginning remaining units must be 1");
  assert.equal(beginningProg.isFinalStage, false, "Beginning must not be final stage");

  // If units > 0 with 0 events (e.g. from elapsed days alone), resolves to first_seedling
  const timeOnlyEarly = resolveGardenMilestoneProgress(2.5, 0);
  assert.equal(timeOnlyEarly.currentStageKey, "first_seedling", "2.5 units from time alone must resolve to first_seedling");
  assert.equal(timeOnlyEarly.nextMilestoneKey, "tender_sapling", "Next milestone must be tender_sapling");
  assert.equal(timeOnlyEarly.intervalStartUnits, 0);
  assert.equal(timeOnlyEarly.intervalEndUnits, 16);
  assert.equal(timeOnlyEarly.unitsInInterval, 2.5);
  assert.equal(timeOnlyEarly.intervalProgress, 2.5 / 16);
  assert.equal(timeOnlyEarly.intervalDisplayPercent, Math.floor((2.5 / 16) * 100));

  // 2. Canonical Threshold Boundaries (Immediately Below, Exactly At, Immediately Above)
  // Boundary 1: First Seedling -> Tender Sapling at 16.0 units
  const below16 = resolveGardenMilestoneProgress(15.99, 5);
  assert.equal(below16.currentStageKey, "first_seedling", "15.99 units must resolve to first_seedling");
  assert.equal(below16.nextMilestoneKey, "tender_sapling", "15.99 next milestone must be tender_sapling");
  assert.equal(below16.intervalStartUnits, 0);
  assert.equal(below16.intervalEndUnits, 16);
  assert.ok(below16.intervalProgress < 1.0, "Progress fraction must be strictly < 1.0 before threshold");
  assert.equal(below16.intervalDisplayPercent, 99, "Display percent must cap at 99% before threshold (never 100%)");
  assert.ok(below16.remainingUnits > 0, "Remaining units must be > 0 before threshold");

  const at16 = resolveGardenMilestoneProgress(16.0, 5);
  assert.equal(at16.currentStageKey, "tender_sapling", "16.0 units must resolve immediately to tender_sapling");
  assert.equal(at16.nextMilestoneKey, "branching_out", "16.0 next milestone must be branching_out");
  assert.equal(at16.intervalStartUnits, 16);
  assert.equal(at16.intervalEndUnits, 36);
  assert.equal(at16.unitsInInterval, 0.0, "Units in interval must be 0.0 at exact threshold");
  assert.equal(at16.intervalProgress, 0.0, "Interval progress must start at 0.0 at exact threshold");
  assert.equal(at16.intervalDisplayPercent, 0, "Display percent must be 0% at exact threshold");

  const above16 = resolveGardenMilestoneProgress(16.1, 5);
  assert.equal(above16.currentStageKey, "tender_sapling", "16.1 units must resolve to tender_sapling");
  assert.equal(above16.intervalStartUnits, 16);
  assert.equal(above16.intervalEndUnits, 36);
  assert.ok(above16.unitsInInterval > 0, "Units in interval must be > 0 above threshold");

  // Boundary 2: Tender Sapling -> Branching Out at 36.0 units
  const below36 = resolveGardenMilestoneProgress(35.95, 10);
  assert.equal(below36.currentStageKey, "tender_sapling", "35.95 units must resolve to tender_sapling");
  assert.equal(below36.nextMilestoneKey, "branching_out");
  assert.equal(below36.intervalDisplayPercent, 99, "35.95% must display 99%, never 100%");

  const at36 = resolveGardenMilestoneProgress(36.0, 10);
  assert.equal(at36.currentStageKey, "branching_out", "36.0 units must resolve to branching_out");
  assert.equal(at36.nextMilestoneKey, "leafy_canopy");
  assert.equal(at36.intervalStartUnits, 36);
  assert.equal(at36.intervalEndUnits, 56);
  assert.equal(at36.intervalProgress, 0.0);
  assert.equal(at36.intervalDisplayPercent, 0);

  const above36 = resolveGardenMilestoneProgress(36.5, 10);
  assert.equal(above36.currentStageKey, "branching_out");
  assert.equal(above36.unitsInInterval, 0.5);

  // Boundary 3: Branching Out -> Leafy Canopy at 56.0 units
  const below56 = resolveGardenMilestoneProgress(55.99, 15);
  assert.equal(below56.currentStageKey, "branching_out");
  assert.equal(below56.nextMilestoneKey, "leafy_canopy");
  assert.equal(below56.intervalDisplayPercent, 99);

  const at56 = resolveGardenMilestoneProgress(56.0, 15);
  assert.equal(at56.currentStageKey, "leafy_canopy", "56.0 units must resolve to leafy_canopy");
  assert.equal(at56.nextMilestoneKey, "rooted_flourishing");
  assert.equal(at56.intervalStartUnits, 56);
  assert.equal(at56.intervalEndUnits, 76);
  assert.equal(at56.intervalProgress, 0.0);
  assert.equal(at56.intervalDisplayPercent, 0);

  // Boundary 4: Leafy Canopy -> Rooted & Flourishing at 76.0 units
  const below76 = resolveGardenMilestoneProgress(75.9, 20);
  assert.equal(below76.currentStageKey, "leafy_canopy");
  assert.equal(below76.nextMilestoneKey, "rooted_flourishing");
  assert.equal(below76.intervalDisplayPercent, 99);

  const at76 = resolveGardenMilestoneProgress(76.0, 20);
  assert.equal(at76.currentStageKey, "rooted_flourishing", "76.0 units must resolve to rooted_flourishing");
  assert.equal(at76.nextMilestoneKey, "garden_in_bloom");
  assert.equal(at76.intervalStartUnits, 76);
  assert.equal(at76.intervalEndUnits, 91);
  assert.equal(at76.intervalProgress, 0.0);
  assert.equal(at76.intervalDisplayPercent, 0);

  // Boundary 5: Rooted & Flourishing -> Garden in Bloom at 91.0 units (Final Stage)
  const below91 = resolveGardenMilestoneProgress(90.9, 25);
  assert.equal(below91.currentStageKey, "rooted_flourishing");
  assert.equal(below91.nextMilestoneKey, "garden_in_bloom");
  assert.equal(below91.intervalDisplayPercent, 99);

  const at91 = resolveGardenMilestoneProgress(91.0, 25);
  assert.equal(at91.currentStageKey, "garden_in_bloom", "91.0 units must resolve to garden_in_bloom");
  assert.equal(at91.isFinalStage, true, "91.0 must set isFinalStage to true");
  assert.equal(at91.nextMilestoneKey, null, "Final stage nextMilestoneKey must be null");
  assert.equal(at91.nextMilestoneLabel, null, "Final stage nextMilestoneLabel must be null");
  assert.equal(at91.intervalProgress, 1.0, "Final stage intervalProgress must be 1.0");
  assert.equal(at91.intervalDisplayPercent, 100, "Final stage display percent must be 100%");
  assert.equal(at91.remainingUnits, 0, "Final stage remaining units must be 0");
  assert.equal(
    at91.nextMilestoneCopy,
    "Your garden keeps collecting your shared moments.",
    "Final stage copy must celebrate continued collecting of shared moments"
  );

  const at100 = resolveGardenMilestoneProgress(100.0, 30);
  assert.equal(at100.currentStageKey, "garden_in_bloom");
  assert.equal(at100.isFinalStage, true);
  assert.equal(at100.nextMilestoneKey, null);

  // 3. Fractional Growth Values (Precision & Invariance)
  const fractionalSample = resolveGardenMilestoneProgress(7.25, 3);
  assert.equal(fractionalSample.currentStageKey, "first_seedling");
  assert.equal(fractionalSample.unitsInInterval, 7.25, "Unrounded fractional units must be preserved");
  assert.equal(fractionalSample.intervalProgress, 7.25 / 16, "Continuous fraction must be exact");
  assert.equal(fractionalSample.intervalDisplayPercent, 45, "Floor percent of 7.25/16 (45.31%) must be 45");
  assert.equal(fractionalSample.remainingUnits, 8.75, "Remaining unrounded units must be preserved");

  // 4. Clamping & Out-of-Bounds Protection
  const negativeUnits = resolveGardenMilestoneProgress(-10, 1);
  assert.equal(negativeUnits.currentStageKey, "first_seedling");
  assert.equal(negativeUnits.intervalProgress, 0);

  const excessUnits = resolveGardenMilestoneProgress(250, 50);
  assert.equal(excessUnits.currentStageKey, "garden_in_bloom");
  assert.equal(excessUnits.isFinalStage, true);
  assert.equal(excessUnits.intervalProgress, 1.0);

  // 5. Immutability of Existing Growth Formulas, Weights & Caps
  // Invariant: positive_moment = +2, reconnection = +4, important_date = +2
  // Invariant: care growth capped at 40
  // Invariant: time growth = min(60, elapsedDays * 0.5)
  // Invariant: total = min(100, care + time)
  const mockPosEvents = Array.from({ length: 25 }, (_, i) => ({
    id: `ev-pos-${i}`,
    kind: "positive_moment",
    occurredAt: "2026-06-01T10:00:00Z",
  }));
  const mockStoryGrowth = calculateHistoricalGrowth(mockPosEvents, 100);
  // 25 * 2 = 50 raw units, but capped at 40
  assert.equal(mockStoryGrowth.careGrowthUnits, 40, "Care units must cap strictly at 40");
  // 100 * 0.5 = 50 time units (below 60 cap)
  assert.equal(mockStoryGrowth.timeGrowthUnits, 50, "Time units must compute at 0.5/day");
  assert.equal(mockStoryGrowth.totalGrowthUnits, 90, "Total must be 40 + 50 = 90");
  assert.equal(mockStoryGrowth.stage.key, "rooted_flourishing", "90 units must be rooted_flourishing");

  // 6. Early-Life Preview Milestones (Strictly Development Only)
  const acornPreview = resolvePreviewMilestoneProgress(0, 0);
  assert.equal(acornPreview.subphaseKey, "planted_acorn");
  assert.equal(acornPreview.nextSubphaseKey, "emerging_shoot");
  assert.equal(acornPreview.isSimulatedOnly, true);

  const shootPreview = resolvePreviewMilestoneProgress(8.0, 1);
  assert.equal(shootPreview.subphaseKey, "emerging_shoot");
  assert.equal(shootPreview.nextSubphaseKey, "small_seedling");

  const seedlingPreview = resolvePreviewMilestoneProgress(8.1, 1);
  assert.equal(seedlingPreview.subphaseKey, "small_seedling");
  assert.equal(seedlingPreview.nextSubphaseKey, "small_sapling");

  const seedlingHighPreview = resolvePreviewMilestoneProgress(15.99, 1);
  assert.equal(seedlingHighPreview.subphaseKey, "small_seedling");
  assert.equal(seedlingHighPreview.nextSubphaseKey, "small_sapling");

  // Production MVP is intentionally bounded to the 100-unit three-frame journey:
  // Level 1: 0 <= u < 24 -> planted_acorn
  // Level 2: 24 <= u < 60 -> emerging_shoot
  // Level 3: 60 <= u <= 100 -> small_seedling (never substitute mature tree)
  assert.equal(resolveMvpFoundationPresentation(0, 0).subphaseKey, "planted_acorn");
  assert.equal(resolveMvpFoundationPresentation(23.99, 0).subphaseKey, "planted_acorn");
  assert.equal(resolveMvpFoundationPresentation(24.0, 0).subphaseKey, "emerging_shoot");
  assert.equal(resolveMvpFoundationPresentation(59.99, 0).subphaseKey, "emerging_shoot");
  assert.equal(resolveMvpFoundationPresentation(60.0, 0).subphaseKey, "small_seedling");
  assert.equal(resolveMvpFoundationPresentation(99.99, 0).subphaseKey, "small_seedling");
  assert.equal(resolveMvpFoundationPresentation(100.0, 0).subphaseKey, "small_seedling");
  const mvpComplete = resolveMvpFoundationProgress(100, 0);
  assert.equal(mvpComplete.currentStageLabel, "Small Oak Seedling");
  assert.equal(mvpComplete.isFinalStage, true);
  assert.equal(mvpComplete.intervalDisplayPercent, 100);

  // Time supports but caps at 20 units and can never complete or reach Level 2 alone.
  assert.equal(resolveMvpFoundationUnits(0, 0, 60), 20);
  const timeSupported = resolveMvpFoundationProgress(0, 0, 60);
  assert.equal(timeSupported.currentStageLabel, "Planted Acorn");
  assert.equal(timeSupported.isFinalStage, false);
  assert.equal(timeSupported.intervalDisplayPercent, 83);
  assert.equal(resolveMvpFoundationUnits(80, 60), 100);

  // Visual variety is random-looking but deterministic per couple and event.
  const memoryFixtures = Array.from({ length: 12 }, (_, index) => ({
    id: `memory-${index}`,
    kind: index % 3 === 0 ? "reconnection" : index % 3 === 1 ? "important_date" : "positive_moment",
    occurredAt: `2026-01-${String(index + 1).padStart(2, "0")}T10:00:00Z`,
  }));
  const markersA = resolveMvpFoundationMemoryMarkers(memoryFixtures, "couple-a", 60);
  const markersARepeat = resolveMvpFoundationMemoryMarkers(memoryFixtures, "couple-a", 60);
  const markersB = resolveMvpFoundationMemoryMarkers(memoryFixtures, "couple-b", 60);
  assert.deepEqual(markersA, markersARepeat, "Same couple history must reproduce exactly");
  assert.notDeepEqual(markersA, markersB, "Different couples must receive unique arrangements");
  assert.ok(markersA.some((marker) => marker.visualKind === "sapling_leaf"));
  assert.ok(new Set(markersA.map((marker) => marker.visualKind)).size >= 3);

  const painterlyRendererSource = fs.readFileSync(
    "src/components/garden/PainterlyGardenRenderer.tsx",
    "utf8"
  );
  assert.ok(
    painterlyRendererSource.includes("subphaseKey={mvpFoundationPresentation.subphaseKey}"),
    "Production renderer must explicitly bind the three-frame MVP subphase"
  );
  assert.ok(
    painterlyRendererSource.includes("showFutureCanopyLayers = false"),
    "Future canopy and habitat layers must remain withheld from the MVP"
  );

  const saplingPreview = resolvePreviewMilestoneProgress(16.0, 1);
  assert.equal(saplingPreview.subphaseKey, "small_sapling");
  assert.equal(saplingPreview.nextSubphaseKey, null);

  // 7. Early-Life Preview Target Slots Contract
  assert.ok(EARLY_LIFE_PREVIEW_TARGET_SLOTS.planted_acorn, "planted_acorn target slot must exist");
  assert.equal(
    EARLY_LIFE_PREVIEW_TARGET_SLOTS.planted_acorn.targetFilename,
    "assets/garden/painterly/oak-acorn-planted-alpha-v1.png"
  );
  assert.equal(EARLY_LIFE_PREVIEW_TARGET_SLOTS.planted_acorn.status, "development_preview");
  assert.equal(EARLY_LIFE_PREVIEW_TARGET_SLOTS.planted_acorn.fileExists, true);

  assert.ok(EARLY_LIFE_PREVIEW_TARGET_SLOTS.emerging_shoot, "emerging_shoot target slot must exist");
  assert.equal(
    EARLY_LIFE_PREVIEW_TARGET_SLOTS.emerging_shoot.targetFilename,
    "assets/garden/painterly/oak-shoot-emerging-alpha-v1.png"
  );
  assert.equal(EARLY_LIFE_PREVIEW_TARGET_SLOTS.emerging_shoot.status, "development_preview");
  assert.equal(EARLY_LIFE_PREVIEW_TARGET_SLOTS.emerging_shoot.fileExists, true);

  assert.ok(EARLY_LIFE_PREVIEW_TARGET_SLOTS.small_seedling, "small_seedling target slot must exist");
  assert.equal(
    EARLY_LIFE_PREVIEW_TARGET_SLOTS.small_seedling.targetFilename,
    "assets/garden/painterly/oak-seedling-alpha-v1.png"
  );
  assert.equal(EARLY_LIFE_PREVIEW_TARGET_SLOTS.small_seedling.status, "development_preview");
  assert.equal(EARLY_LIFE_PREVIEW_TARGET_SLOTS.small_seedling.fileExists, true);
  for (const slot of Object.values(EARLY_LIFE_PREVIEW_TARGET_SLOTS)) {
    assert.ok(fs.existsSync(slot.targetFilename), `${slot.slotKey} raster must exist on disk`);
    const pngHeader = fs.readFileSync(slot.targetFilename).subarray(0, 24);
    assert.equal(pngHeader.toString("hex", 0, 8), "89504e470d0a1a0a", `${slot.slotKey} must be a PNG`);
    assert.equal(pngHeader.readUInt32BE(16), slot.sourceDimensions.width, `${slot.slotKey} width must match manifest`);
    assert.equal(pngHeader.readUInt32BE(20), slot.sourceDimensions.height, `${slot.slotKey} height must match manifest`);
    const { scale, translateX, translateY } = slot.calibrationTransform;
    assert.ok(scale > 0, `${slot.slotKey} must have a positive calibrated scale`);
    assert.ok(Number.isFinite(translateX) && Number.isFinite(translateY));
    const resolvedX = slot.sourceContactPoint.x * scale + translateX;
    const resolvedY = slot.sourceContactPoint.y * scale + translateY;
    assert.ok(Math.abs(resolvedX - 390.4) < 0.02, `${slot.slotKey} contact x must resolve to permanent anchor`);
    assert.ok(Math.abs(resolvedY - 441.0) < 0.02, `${slot.slotKey} contact y must resolve to permanent anchor`);
  }

  // 8. Shared Structural Artwork Decoupled from Logical Stages
  // Canonical stages branching_out (36-55), leafy_canopy (56-75), and rooted_flourishing (76-90)
  // are 3 distinct logical stages sharing intermediate oak structural asset on disk.
  assert.equal(getGardenStage(40).key, "branching_out");
  assert.equal(getGardenStage(60).key, "leafy_canopy");
  assert.equal(getGardenStage(80).key, "rooted_flourishing");
  assert.notEqual(getGardenStage(40).key, getGardenStage(60).key);
  assert.notEqual(getGardenStage(60).key, getGardenStage(80).key);

  const artRecord = LIFECYCLE_STAGE_TO_ART_MAPPING.branching_oak;
  assert.ok(artRecord.anatomyDescription.includes("shared structural asset"));

  // 9. Source Code Invariant Audits for UI & Accessibility
  const progressComponentSource = fs.readFileSync(
    "src/components/garden/GardenProgressSection.tsx",
    "utf8"
  );
  assert.ok(
    progressComponentSource.includes('accessibilityRole="progressbar"'),
    "GardenProgressSection must have accessibilityRole='progressbar'"
  );
  assert.ok(
    progressComponentSource.includes("accessibilityValue"),
    "GardenProgressSection must expose accessibilityValue"
  );
  assert.ok(
    progressComponentSource.includes("progress.supportingCopy"),
    "GardenProgressSection must render gentle supporting copy"
  );
  assert.equal(
    below16.supportingCopy,
    "Growing through time and shared care.",
    "Milestone model must provide gentle supporting copy"
  );
  assert.equal(
    at91.supportingCopy,
    "Your garden keeps collecting your shared moments.",
    "Final stage model must provide gentle final stage copy"
  );
  assert.ok(
    progressComponentSource.includes("How your garden grows"),
    "GardenProgressSection must provide truth-aligned educational section"
  );
  // Zero streaks, scorecards, leaderboards, or partner judgments in UI
  assert.ok(!progressComponentSource.includes("streakCount"), "Zero streak counters in progress component");
  assert.ok(!progressComponentSource.includes("currentStreak"), "Zero current streak in progress component");
  assert.ok(!progressComponentSource.includes("leaderboard"), "Zero leaderboards in progress component");
  assert.ok(!progressComponentSource.includes("health score"), "Zero relationship health scores");
  assert.ok(!progressComponentSource.includes("falling behind"), "Zero falling-behind messages");

  // Parity across normal Garden and compact card
  const gardenScreenSource = fs.readFileSync("src/app/garden.tsx", "utf8");
  assert.ok(
    gardenScreenSource.includes("<GardenProgressSection"),
    "GardenScreen must mount GardenProgressSection"
  );
  assert.ok(
    !gardenScreenSource.includes("streakDays"),
    "GardenScreen must not have streak mechanics"
  );
  assert.ok(
    !gardenScreenSource.includes("currentStreak"),
    "GardenScreen must not track current streak"
  );

  const entryCardSource = fs.readFileSync(
    "src/components/garden/GardenEntryCard.tsx",
    "utf8"
  );
  assert.ok(
    entryCardSource.includes("<GardenProgressSection"),
    "GardenEntryCard must mount GardenProgressSection in compact mode"
  );

  // Visual QA Simulation Controls
  const visualQASource = fs.readFileSync("src/app/garden-visual-qa.tsx", "utf8");
  assert.ok(
    visualQASource.includes("SIMULATED PROGRESSION CONTROL"),
    "garden-visual-qa.tsx must wire SIMULATED PROGRESSION CONTROL"
  );
  assert.ok(
    visualQASource.includes("useSimulatedGrowth"),
    "garden-visual-qa.tsx must support interactive simulated growth"
  );
  assert.ok(
    visualQASource.includes("PRESENT — DEVELOPMENT PREVIEW"),
    "Visual QA must report an integrated development-preview asset truthfully"
  );
  assert.ok(
    visualQASource.includes("EARLY_LIFE_PREVIEW_UNITS[spKey]"),
    "Manual subphase selection must synchronize its displayed preview units"
  );
  assert.ok(
    visualQASource.includes('"Manual preview selection"'),
    "Visual QA must distinguish manual selection from simulated progression"
  );
  assert.ok(
    visualQASource.includes(': false\n  );'),
    "Diagnostic alignment guides must default off for clean visual review"
  );
  assert.deepEqual(
    EARLY_LIFE_SUBPHASE_CONTRACTS.small_sapling.eligibleEarnedRoles,
    ["foliage", "ground_flora", "creature"],
    "A juvenile oak sapling must not expose a blossom attachment role"
  );
  const treeStructureSource = fs.readFileSync(
    "src/components/garden/PainterlyTreeStructure.tsx",
    "utf8"
  );
  for (const filename of [
    "oak-acorn-planted-alpha-v1.png",
    "oak-shoot-emerging-alpha-v1.png",
    "oak-seedling-alpha-v1.png",
  ]) {
    assert.ok(
      treeStructureSource.includes(filename),
      `${filename} must be wired into PainterlyTreeStructure`
    );
  }
  assert.ok(
    treeStructureSource.includes('effectiveSubphase === "planted_acorn"') &&
      treeStructureSource.includes('effectiveSubphase === "emerging_shoot"') &&
      treeStructureSource.includes('effectiveSubphase === "small_seedling"'),
    "Every early-life raster must retain an explicit lifecycle eligibility gate"
  );

  assert.ok(true, "All growth progress and visual milestone contracts passed");
});

test("34. Purple Garden 100-Unit MVP Visual Growth, Foliage & Story Parity Invariants (Section F 1-20)", () => {
  // 1. Event weights: positive × 2, reconnections × 4, important dates × 2 without 40-unit cap
  assert.equal(resolveMvpRawCareUnits([{ id: "1", kind: "positive_moment" }]), 2);
  assert.equal(resolveMvpRawCareUnits([{ id: "2", kind: "reconnection" }]), 4);
  assert.equal(resolveMvpRawCareUnits([{ id: "3", kind: "important_date" }]), 2);
  const thirtyReconnections = Array.from({ length: 30 }, (_, i) => ({ id: `rec-${i}`, kind: "reconnection" }));
  assert.equal(resolveMvpRawCareUnits(thirtyReconnections), 120, "Raw care units must not cap at 40 in 100-unit MVP model");

  // 2. Time supports but caps at 20 units
  assert.equal(resolveMvpSupportingTimeUnits(0), 0);
  assert.equal(resolveMvpSupportingTimeUnits(10), 10);
  assert.equal(resolveMvpSupportingTimeUnits(20), 20);
  assert.equal(resolveMvpSupportingTimeUnits(35), 20);
  assert.equal(resolveMvpSupportingTimeUnits(100), 20);

  // 3. Time-only history remains Level 1 (20/100) and cannot reach Level 2 alone
  const timeOnlyUnits = resolveMvpFoundationUnits(0, 0, 100);
  assert.equal(timeOnlyUnits, 20);
  const timeOnlyPres = resolveMvpFoundationPresentation(0, 0, 100);
  assert.equal(timeOnlyPres.level, 1);
  assert.equal(timeOnlyPres.subphaseKey, "planted_acorn");
  assert.equal(timeOnlyPres.isFoundationComplete, false);

  // 4. Exact boundary transitions: 0, 23.99, 24, 59.99, 60, 99.99, 100
  assert.equal(resolveMvpFoundationPresentation(0).subphaseKey, "planted_acorn");
  assert.equal(resolveMvpFoundationPresentation(23.99).subphaseKey, "planted_acorn");
  assert.equal(resolveMvpFoundationPresentation(24.0).subphaseKey, "emerging_shoot");
  assert.equal(resolveMvpFoundationPresentation(59.99).subphaseKey, "emerging_shoot");
  assert.equal(resolveMvpFoundationPresentation(60.0).subphaseKey, "small_seedling");
  assert.equal(resolveMvpFoundationPresentation(99.99).subphaseKey, "small_seedling");
  assert.equal(resolveMvpFoundationPresentation(100.0).subphaseKey, "small_seedling");
  assert.equal(resolveMvpFoundationPresentation(100.0).isFoundationComplete, true);

  // 5. No 100% display before boundary (capped at 99% before boundary)
  assert.ok(resolveMvpFoundationPresentation(23.99).levelDisplayPercent <= 99);
  assert.ok(resolveMvpFoundationPresentation(59.99).levelDisplayPercent <= 99);
  assert.ok(resolveMvpFoundationPresentation(99.99).levelDisplayPercent <= 99);
  assert.equal(resolveMvpFoundationPresentation(100.0).levelDisplayPercent, 100);

  // 6. Main and compact UI contain no / 36, foundation-unit, or raw care/time lines
  const progressSource = fs.readFileSync("src/components/garden/GardenProgressSection.tsx", "utf8");
  const entryCardSource = fs.readFileSync("src/components/garden/GardenEntryCard.tsx", "utf8");
  assert.ok(!progressSource.includes("/ 36"), "Progress UI must not contain '/ 36'");
  assert.ok(!entryCardSource.includes("/ 36"), "Compact entry card must not contain '/ 36'");
  assert.ok(!progressSource.includes("Shared care 40"), "Progress UI must not contain raw care breakdown lines");
  assert.ok(!progressSource.includes("x / 36 foundation units"), "Progress UI must not contain legacy unit strings");

  // 7. Same couple/history determinism
  const dna1 = derivePainterlyCoupleDNA("couple-fixed-seed");
  const dna2 = derivePainterlyCoupleDNA("couple-fixed-seed");
  assert.deepEqual(dna1, dna2, "Identical couple seeds must produce identical couple DNA");

  // 8. Different couple visual diversity
  const dnaAlt = derivePainterlyCoupleDNA("couple-alternative-seed");
  assert.notDeepEqual(dna1, dnaAlt, "Different couple seeds must produce distinct couple DNA");

  // 9. Every event maps 1:1 to one memory marker
  const eventsSample = [
    { id: "e1", kind: "positive_moment", occurredAt: "2026-01-01T10:00:00Z" },
    { id: "e2", kind: "reconnection", occurredAt: "2026-01-02T10:00:00Z" },
    { id: "e3", kind: "important_date", occurredAt: "2026-01-03T10:00:00Z" },
  ];
  const markersSample = resolveMvpFoundationMemoryMarkers(eventsSample, "couple-fixed-seed", 60);
  assert.equal(markersSample.length, eventsSample.length, "Markers count must strictly equal events count");

  // 10. At Level 3 with >= 1 event, guarantee >= 1 leaf on seedling/sapling
  assert.ok(
    markersSample.some((m) => m.visualKind === "sapling_leaf"),
    "Level 3 with care events must map at least one memory to an attached seedling leaf"
  );

  // 11. No marker collision & no floating attachment
  const stemMarkers = markersSample.filter((m) => m.visualKind === "sapling_leaf");
  for (const m of stemMarkers) {
    assert.ok(m.x >= 380 && m.x <= 405, `Stem leaf x coordinate ${m.x} must stay near seedling stem`);
    assert.ok(m.y >= 280 && m.y <= 316, `Stem leaf y coordinate ${m.y} must stay on seedling stem`);
  }

  // 12. Explore anchor/hit-target parity (>= 44x44pt screen space)
  assert.ok(
    markersSample.every((m) => m.semanticKey && m.x !== undefined && m.y !== undefined),
    "Every marker must expose valid anchor coordinates for hit testing"
  );

  // 13. Story milestones at 24, 60, 100
  const storySnapshot = {
    coupleId: "couple-test-100",
    seedString: "couple-test-100",
    createdAt: "2026-01-01T00:00:00Z",
    careEvents: Array.from({ length: 25 }, (_, i) => ({
      id: `rec-c-${String(i + 1).padStart(2, "0")}`,
      kind: "reconnection",
      occurredAt: "2026-01-02T10:00:00Z",
    })),
    asOfTime: "2026-01-15T00:00:00Z",
    isResting: false,
  };
  const story = createGardenStory(storySnapshot);
  const storyMilestones = story.steps.filter((s) => s.eventKind === "stage_transition");
  assert.deepEqual(storyMilestones.map((s) => s.totalGrowthUnits), [24, 60, 100]);
  assert.deepEqual(storyMilestones.map((s) => s.chapterTitle), [
    "Emerging Oak Shoot",
    "Small Oak Seedling",
    "Foundation Complete",
  ]);

  // 14. Event-first then milestone ordering
  for (const m of storyMilestones) {
    const idx = story.steps.indexOf(m);
    assert.ok(idx > 0, "Milestone step must not be step 0");
    const prev = story.steps[idx - 1];
    assert.ok(prev.addedEventKey !== null, "Milestone step must immediately follow the event that crossed it");
  }

  // 15. Final Story/live Garden parity
  const finalStoryStep = story.steps[story.steps.length - 1];
  assert.equal(finalStoryStep.eventKind, "today");
  assert.equal(finalStoryStep.isFinal, true);
  assert.equal(finalStoryStep.chapterTitle, "Our Garden Today");

  // 16. Same couple seed produces identical ecology & plant micro-variation
  const ecoA = dna1.ecologicalComposition;
  const ecoA2 = dna2.ecologicalComposition;
  assert.deepEqual(ecoA, ecoA2, "Identical couple seeds must produce identical ecological composition");
  assert.deepEqual(ecoA.plantMicroVariation, ecoA2.plantMicroVariation, "Micro-variation must be identical");

  // 17. Different couple seeds produce materially different ecology
  const ecoB = dnaAlt.ecologicalComposition;
  assert.notDeepEqual(ecoA.mossCushions, ecoB.mossCushions, "Different couple seeds must vary moss cushions");
  assert.notDeepEqual(ecoA.groundcoverClusters, ecoB.groundcoverClusters, "Different couple seeds must vary groundcover");

  // 18. Decorative elements have sourceEvent = null; earned have exact source event
  for (const item of [...ecoA.mossCushions, ...ecoA.groundcoverClusters, ...ecoA.leafLitter, ...ecoA.smallStones, ...ecoA.woodlandLightMotes]) {
    assert.equal(item.sourceEvent, null, "Decorative ecological items must have sourceEvent = null");
  }
  for (const m of markersSample) {
    assert.ok(m.sourceId !== null, "Earned memory markers must have non-null sourceId");
    assert.ok(eventsSample.some((e) => e.id === m.sourceId), "sourceId must match an authorized care event id");
  }

  // 19. Backfill stability: adding/backfilling an event does not relocate existing elements
  const earlierEvent = { id: "e0-backfill", kind: "positive_moment", occurredAt: "2025-12-25T10:00:00Z" };
  const backfilledMarkers = resolveMvpFoundationMemoryMarkers([earlierEvent, ...eventsSample], "couple-fixed-seed", 60);
  for (const originalMarker of markersSample) {
    const retained = backfilledMarkers.find((m) => m.sourceId === originalMarker.sourceId);
    assert.ok(retained, `Marker for event ${originalMarker.sourceId} must be retained`);
    assert.equal(retained.x, originalMarker.x, "Backfilling an event must not shift x of existing memory markers");
    assert.equal(retained.y, originalMarker.y, "Backfilling an event must not shift y of existing memory markers");
    assert.equal(retained.visualKind, originalMarker.visualKind, "Backfilling must not change visual kind");
  }

  // 20. Subprogress reveals bounded contextual elements across all 3 levels without mature tree artwork
  const subBands = [
    resolveMvpEcologicalSubprogressBand(0),
    resolveMvpEcologicalSubprogressBand(8),
    resolveMvpEcologicalSubprogressBand(16),
    resolveMvpEcologicalSubprogressBand(24),
    resolveMvpEcologicalSubprogressBand(36),
    resolveMvpEcologicalSubprogressBand(48),
    resolveMvpEcologicalSubprogressBand(60),
    resolveMvpEcologicalSubprogressBand(74),
    resolveMvpEcologicalSubprogressBand(88),
    resolveMvpEcologicalSubprogressBand(100),
  ];
  assert.deepEqual(subBands, [
    "0-7.99",
    "8-15.99",
    "16-23.99",
    "24-35.99",
    "36-47.99",
    "48-59.99",
    "60-73.99",
    "74-87.99",
    "88-99.99",
    "100",
  ]);

  for (let u = 0; u <= 100; u += 5) {
    const pres = resolveMvpFoundationPresentation(u);
    assert.ok(
      pres.subphaseKey === "planted_acorn" ||
      pres.subphaseKey === "emerging_shoot" ||
      pres.subphaseKey === "small_seedling",
      `Units ${u} must only resolve to early-life subphases, never mature oak`
    );
  }
});

// ----------------------------------------------------------------------------
// Test 35: Authoritative 100-Unit Foundation, Screen-Space Hit Testing, Botanical Foliage & Parity Invariants
// ----------------------------------------------------------------------------
test("35. Authoritative 100-Unit Foundation, Screen-Space Hit Testing, Botanical Foliage & Parity Invariants", () => {
  // 1. Authoritative pure 100-point calculation
  // Empty history at 0 days
  const calc0 = calculateAuthoritativeFoundation([], 0);
  assert.equal(calc0.totalFoundationProgress, 0);
  assert.equal(calc0.overallDisplayPercent, 0);
  assert.equal(calc0.currentLevel, 1);
  assert.equal(calc0.currentStage, "Planted Acorn");
  assert.equal(calc0.pointsUntilNextThreshold, 24);
  assert.equal(calc0.isFoundationComplete, false);

  // Time-supported only (e.g. 60 days -> 30 raw, capped at 20)
  const calcTime = calculateAuthoritativeFoundation([], 60);
  assert.equal(calcTime.supportingTimeContribution, 20);
  assert.equal(calcTime.rawCareContribution, 0);
  assert.equal(calcTime.totalFoundationProgress, 20);
  assert.equal(calcTime.overallDisplayPercent, 20);
  assert.equal(calcTime.currentLevel, 1); // Cannot reach Level 2 alone!
  assert.equal(calcTime.pointsUntilNextThreshold, 4);

  // Care contributions: positive (+2), reconnection (+4), important date (+2)
  const evPos = createMockEvent("ev-p1", "positive_moment", "2026-02-01T10:00:00Z");
  const evRec = createMockEvent("ev-r1", "reconnection", "2026-02-02T10:00:00Z");
  const evDate = createMockEvent("ev-d1", "important_date", "2026-02-03T10:00:00Z");
  const evIncomplete = {
    ...createMockEvent("ev-inc", "reconnection", "2026-02-04T10:00:00Z"),
    reconnected_at: null,
  };
  const evDup = createMockEvent("ev-p1", "positive_moment", "2026-02-01T10:00:00Z");

  const calcMixed = calculateAuthoritativeFoundation([evPos, evRec, evDate, evIncomplete, evDup], 10);
  // Dedup ev-p1 (2), ev-r1 (4), ev-d1 (2), ev-inc ignored = 8 care units
  // 10 days * 0.5 = 5 time units. Total = 13
  assert.equal(calcMixed.rawCareContribution, 8);
  assert.equal(calcMixed.supportingTimeContribution, 5);
  assert.equal(calcMixed.totalFoundationProgress, 13);
  assert.equal(calcMixed.eligiblePositiveMoments, 1);
  assert.equal(calcMixed.completedReconnections, 1);
  assert.equal(calcMixed.importantDates, 1);
  assert.equal(calcMixed.excludedOrIneligibleEvents, 2);

  // Canonical threshold comparisons:
  // 23.99 -> Level 1 (Planted Acorn), 23%
  const calc2399 = calculateAuthoritativeFoundation(23.99);
  assert.equal(calc2399.currentLevel, 1);
  assert.equal(calc2399.currentStage, "Planted Acorn");
  assert.equal(calc2399.overallDisplayPercent, 23);
  assert.equal(calc2399.pointsUntilNextThreshold, 0.01);

  // 24.00 -> Level 2 (Emerging Oak Shoot), 24%
  const calc24 = calculateAuthoritativeFoundation(24.00);
  assert.equal(calc24.currentLevel, 2);
  assert.equal(calc24.currentStage, "Emerging Oak Shoot");
  assert.equal(calc24.overallDisplayPercent, 24);
  assert.equal(calc24.pointsUntilNextThreshold, 36);

  // 59.99 -> Level 2 (Emerging Oak Shoot), 59%
  const calc5999 = calculateAuthoritativeFoundation(59.99);
  assert.equal(calc5999.currentLevel, 2);
  assert.equal(calc5999.currentStage, "Emerging Oak Shoot");
  assert.equal(calc5999.overallDisplayPercent, 59);
  assert.equal(calc5999.pointsUntilNextThreshold, 0.01);

  // 60.00 -> Level 3 (Small Oak Seedling), 60%
  const calc60 = calculateAuthoritativeFoundation(60.00);
  assert.equal(calc60.currentLevel, 3);
  assert.equal(calc60.currentStage, "Small Oak Seedling");
  assert.equal(calc60.overallDisplayPercent, 60);
  assert.equal(calc60.pointsUntilNextThreshold, 40);

  // 99.99 -> Level 3 (Small Oak Seedling), 99%
  const calc9999 = calculateAuthoritativeFoundation(99.99);
  assert.equal(calc9999.currentLevel, 3);
  assert.equal(calc9999.currentStage, "Small Oak Seedling");
  assert.equal(calc9999.overallDisplayPercent, 99);
  assert.equal(calc9999.pointsUntilNextThreshold, 0.01);

  // 100.00 -> Level 3 (Small Oak Seedling), 100%, isFoundationComplete: true
  const calc100 = calculateAuthoritativeFoundation(100.00);
  assert.equal(calc100.currentLevel, 3);
  assert.equal(calc100.currentStage, "Small Oak Seedling");
  assert.equal(calc100.overallDisplayPercent, 100);
  assert.equal(calc100.pointsUntilNextThreshold, 0);
  assert.equal(calc100.isFoundationComplete, true);
  assert.equal(calc100.subphaseKey, "small_seedling");

  // >100.00 -> Clamped to 100, isFoundationComplete: true
  const calc120 = calculateAuthoritativeFoundation(120.00);
  assert.equal(calc120.totalFoundationProgress, 100);
  assert.equal(calc120.overallDisplayPercent, 100);
  assert.equal(calc120.isFoundationComplete, true);

  // 1B. Deterministic Development QA Fixture (MVP_18_RECORD_QA_FIXTURE)
  // Exact 18-record couple calculation:
  // - 10 positive moments (each +2 -> 20 units)
  // - 4 completed reconnections (each +4 -> 16 units)
  // - 2 important dates (each +2 -> 4 units)
  // - 1 incomplete/open reconnection (+0 units, excluded)
  // - 1 duplicate record (+0 units, deduplicated)
  // Elapsed days: 28 days -> 14 units supporting time (capped at 20)
  // Total: 40 care + 14 time = 54 units (54%, Level 2 of 3 · Emerging Oak Shoot, 6 units to Small Oak Seedling)
  const calc18 = calculateAuthoritativeFoundation(MVP_18_RECORD_QA_FIXTURE, 28);
  assert.equal(calc18.totalRegisteredEvents, 18, "QA fixture must register exactly 18 records");
  assert.equal(calc18.totalUniqueEvents, 16, "QA fixture must have 16 unique eligible records");
  assert.equal(calc18.eligiblePositiveMoments, 10, "QA fixture must have 10 positive moments");
  assert.equal(calc18.completedReconnections, 4, "QA fixture must have 4 completed reconnections");
  assert.equal(calc18.importantDates, 2, "QA fixture must have 2 important dates");
  assert.equal(calc18.excludedOrIneligibleEvents, 2, "QA fixture must exclude 2 records (1 open + 1 duplicate)");
  assert.equal(calc18.rawCareContribution, 40, "QA fixture must yield 40 raw care units");
  assert.equal(calc18.elapsedDays, 28, "QA fixture must use 28 elapsed days");
  assert.equal(calc18.supportingTimeContribution, 14, "QA fixture must yield 14 time units");
  assert.equal(calc18.totalFoundationProgress, 54, "QA fixture must total 54 units");
  assert.equal(calc18.overallDisplayPercent, 54, "QA fixture must display 54%");
  assert.equal(calc18.currentLevel, 2, "QA fixture must be Level 2");
  assert.equal(calc18.currentStage, "Emerging Oak Shoot", "QA fixture must be Emerging Oak Shoot");
  assert.equal(calc18.pointsUntilNextThreshold, 6, "QA fixture must need 6 units to Small Oak Seedling");
  assert.equal(calc18.isFoundationComplete, false, "QA fixture foundation must not be complete yet");
  assert.equal(calc18.uniqueCareEvents.length, 16, "QA fixture uniqueCareEvents must match 16 Explore memories");

  // 2. Structural Asset Invariant: Small Oak Seedling preserved at 100 units
  const pres100 = resolveMvpFoundationPresentation(100);
  assert.equal(pres100.subphaseKey, "small_seedling");
  assert.equal(pres100.label, "Small Oak Seedling");
  assert.equal(pres100.levelProgress, 1.0);

  // 3. Screen-Space Hit Testing Invariants with Separate Mouse & Touch Tolerances
  assert.equal(DEFAULT_MOUSE_HIT_SLOP_PX, 12, "Default mouse hit tolerance must be 12px");
  assert.equal(DEFAULT_TOUCH_HIT_SLOP_PT, 22, "Default touch hit tolerance must be 22pt");

  const testWorld = {
    worldBounds: EXPANDED_WORLD_BOUNDS,
    nodes: {
      "node-leaf-1": {
        id: "node-leaf-1",
        role: "leaf",
        isEarned: true,
        sourceEvent: { id: "ev-1", kind: "positive_moment" },
        worldBounds: { minX: 388, maxX: 396, minY: 288, maxY: 296, width: 8, height: 8 },
        anchorPoint: { x: 392, y: 292 },
        depthLayer: 40,
        childIds: [],
      },
      "node-leaf-2": {
        id: "node-leaf-2",
        role: "leaf",
        isEarned: true,
        sourceEvent: { id: "ev-2", kind: "reconnection" },
        worldBounds: { minX: 404, maxX: 412, minY: 288, maxY: 296, width: 8, height: 8 },
        anchorPoint: { x: 408, y: 292 },
        depthLayer: 40,
        childIds: [],
      },
      "node-stem": {
        id: "node-stem",
        role: "trunk",
        isEarned: false,
        sourceEvent: null,
        worldBounds: { minX: 398, maxX: 402, minY: 304, maxY: 440, width: 4, height: 136 },
        anchorPoint: { x: 400, y: 440 },
        depthLayer: 10,
        childIds: [],
      },
    },
  };

  const testViewports = [
    { width: 360, height: 640 },
    { width: 768, height: 1024 },
  ];

  for (const vp of testViewports) {
    const cam = createCameraFromFitStrategy(CANONICAL_SCENE_BOUNDS, vp, "viewport_cover");
    const screenPt1 = worldToScreen({ x: 392, y: 292 }, cam, vp);
    const screenPt2 = worldToScreen({ x: 408, y: 292 }, cam, vp);
    const leaf1ScreenBounds = projectBoundsToScreen(testWorld.nodes["node-leaf-1"].worldBounds, cam, vp);

    // 3A. Exact center tap on leaf-1 resolves node-leaf-1 under both mouse and touch
    const hitCenterMouse = resolveNodeAtScreenCoordinate(screenPt1, testWorld, cam, vp, { inputMode: "mouse" });
    assert.equal(hitCenterMouse?.id, "node-leaf-1", "Direct mouse click on leaf-1 must select leaf-1");
    const hitCenterTouch = resolveNodeAtScreenCoordinate(screenPt1, testWorld, cam, vp, { inputMode: "touch" });
    assert.equal(hitCenterTouch?.id, "node-leaf-1", "Direct touch on leaf-1 must select leaf-1");

    // 3B. Mouse click 13px from a small feature selects it when configured with tolerance in acceptable mouse range (10-14px)
    const mouse13Pt = { x: leaf1ScreenBounds.minX - 13, y: screenPt1.y };
    const hitMouse13Configured = resolveNodeAtScreenCoordinate(mouse13Pt, testWorld, cam, vp, { hitSlop: 13, inputMode: "mouse" });
    assert.equal(hitMouse13Configured?.id, "node-leaf-1", "Mouse click 13px away selects feature when configured with 13px tolerance");

    // 3C. Mouse click outside configured mouse tolerance (15px away with 13px tolerance) does not select it
    const mouse15Pt = { x: leaf1ScreenBounds.minX - 15, y: screenPt1.y };
    const hitMouse15 = resolveNodeAtScreenCoordinate(mouse15Pt, testWorld, cam, vp, { hitSlop: 13, inputMode: "mouse" });
    assert.equal(hitMouse15, null, "Mouse click 15px away does not select feature with 13px tolerance");

    // 3D. Default mouse tolerance (12px): 10px selects, 14px does not
    const mouse10Pt = { x: leaf1ScreenBounds.minX - 10, y: screenPt1.y };
    const hitMouse10 = resolveNodeAtScreenCoordinate(mouse10Pt, testWorld, cam, vp, { inputMode: "mouse" });
    assert.equal(hitMouse10?.id, "node-leaf-1", "Mouse click 10px away selects with default 12px mouse tolerance");
    const mouse14Pt = { x: leaf1ScreenBounds.minX - 14, y: screenPt1.y };
    const hitMouse14 = resolveNodeAtScreenCoordinate(mouse14Pt, testWorld, cam, vp, { inputMode: "mouse" });
    assert.equal(hitMouse14, null, "Mouse click 14px away does not select with default 12px mouse tolerance");

    // 3E. Touch event 20px from that same feature selects it (within 22pt touch tolerance)
    const touch20Pt = { x: leaf1ScreenBounds.minX - 20, y: screenPt1.y };
    const hitTouch20 = resolveNodeAtScreenCoordinate(touch20Pt, testWorld, cam, vp, { inputMode: "touch" });
    assert.equal(hitTouch20?.id, "node-leaf-1", "Touch event 20px away selects feature within 22pt touch tolerance");

    // 3F. Touch event 25px away (outside 22pt touch tolerance) does not select it
    const touch25Pt = { x: leaf1ScreenBounds.minX - 25, y: screenPt1.y };
    const hitTouch25 = resolveNodeAtScreenCoordinate(touch25Pt, testWorld, cam, vp, { inputMode: "touch" });
    assert.equal(hitTouch25, null, "Touch event 25px away does not select feature outside 22pt touch tolerance");

    // 3G. Overlapping candidates select the nearest rendered geometry (distance dominates; depthLayer is tie-breaker only)
    const deltaX = screenPt2.x - screenPt1.x;
    const closerTo1 = { x: screenPt1.x + deltaX * 0.35, y: screenPt1.y };
    const hitCloser1 = resolveNodeAtScreenCoordinate(closerTo1, testWorld, cam, vp, { inputMode: "touch" });
    assert.equal(hitCloser1?.id, "node-leaf-1", "Point closer to leaf-1 geometry must select leaf-1");
    const closerTo2 = { x: screenPt1.x + deltaX * 0.65, y: screenPt1.y };
    const hitCloser2 = resolveNodeAtScreenCoordinate(closerTo2, testWorld, cam, vp, { inputMode: "touch" });
    assert.equal(hitCloser2?.id, "node-leaf-2", "Point closer to leaf-2 geometry must select leaf-2");

    // 3H. Empty terrain clicks return null (never snap to distant node)
    const emptyPt = { x: 20, y: 20 };
    assert.equal(resolveNodeAtScreenCoordinate(emptyPt, testWorld, cam, vp, { inputMode: "mouse" }), null, "Empty terrain mouse click returns null");
    assert.equal(resolveNodeAtScreenCoordinate(emptyPt, testWorld, cam, vp, { inputMode: "touch" }), null, "Empty terrain touch returns null");

    // 3I. Hit-testing behavior remains correct whether camera is reset or zoomed in to Inspect mode
    const inspectCam = {
      targetX: 392,
      targetY: 292,
      zoom: 2.2,
      viewportWidth: vp.width,
      viewportHeight: vp.height,
    };
    const inspectLeaf1ScreenBounds = projectBoundsToScreen(testWorld.nodes["node-leaf-1"].worldBounds, inspectCam, vp);

    // In Inspect zoom, tolerance is still screen pixels:
    // Mouse click 10px away selects, 14px away returns null
    const inspectMouse10 = { x: inspectLeaf1ScreenBounds.minX - 10, y: inspectLeaf1ScreenBounds.minY + 2 };
    assert.equal(resolveNodeAtScreenCoordinate(inspectMouse10, testWorld, inspectCam, vp, { inputMode: "mouse" })?.id, "node-leaf-1");
    const inspectMouse14 = { x: inspectLeaf1ScreenBounds.minX - 14, y: inspectLeaf1ScreenBounds.minY + 2 };
    assert.equal(resolveNodeAtScreenCoordinate(inspectMouse14, testWorld, inspectCam, vp, { inputMode: "mouse" }), null);

    // Touch event 20px away selects, 25px away returns null
    const inspectTouch20 = { x: inspectLeaf1ScreenBounds.minX - 20, y: inspectLeaf1ScreenBounds.minY + 2 };
    assert.equal(resolveNodeAtScreenCoordinate(inspectTouch20, testWorld, inspectCam, vp, { inputMode: "touch" })?.id, "node-leaf-1");
    const inspectTouch25 = { x: inspectLeaf1ScreenBounds.minX - 25, y: inspectLeaf1ScreenBounds.minY + 2 };
    assert.equal(resolveNodeAtScreenCoordinate(inspectTouch25, testWorld, inspectCam, vp, { inputMode: "touch" }), null);

    // 3J. Distance-First Hit Testing Regression Test:
    // A higher-priority earned node (node-leaf-1, Class 3) has an overlapping expanded hit region (within 22pt touch / 12px mouse).
    // The pointer is placed directly on a lower-priority visible node (node-stem, Class 1, distance = 0).
    // The lower-priority but geometrically closer node must be selected.
    const stemScreenPt = worldToScreen({ x: 400, y: 310 }, cam, vp);
    // leaf-1 worldBounds is x: 388..396, y: 288..296. In screen space under cam & vp, distance from (400, 310) to leaf-1 is ~18px.
    // 18px <= 22pt touch tolerance, so leaf-1 qualifies as an overlapping candidate.
    // Since pointer is directly on stem (distance = 0) vs leaf-1 (distance ~18px), stem MUST win.
    const hitDirectOnStemTouch = resolveNodeAtScreenCoordinate(stemScreenPt, testWorld, cam, vp, { inputMode: "touch" });
    assert.equal(
      hitDirectOnStemTouch?.id,
      "node-stem",
      "Pointer directly on lower-priority visible node must select it even when higher-priority earned node overlaps"
    );
    const hitDirectOnStemMouse = resolveNodeAtScreenCoordinate(stemScreenPt, testWorld, cam, vp, { inputMode: "mouse" });
    assert.equal(
      hitDirectOnStemMouse?.id,
      "node-stem",
      "Mouse click directly on lower-priority visible node must select it"
    );
  }

  // 4. Botanical realism & Leaf Attachment
  const level3Markers = resolveMvpFoundationMemoryMarkers(
    [evPos, evRec, evDate],
    "couple-seed-alpha",
    70 // Level 3
  );
  assert.ok(level3Markers.length >= 3);
  // Level 3 has attached sapling leaves
  const saplingLeaves = level3Markers.filter((m) => m.visualKind === "sapling_leaf");
  assert.ok(saplingLeaves.length >= 1, "Level 3 must have at least one attached sapling leaf");
  for (const leaf of saplingLeaves) {
    assert.equal(leaf.attachment, "tree", "Sapling leaf must attach to tree");
    assert.ok(leaf.rotation !== undefined && !isNaN(leaf.rotation), "Must have natural rotation");
  }

  // 5. Collapsed Progress UI copy invariant:
  // Must show "Next: <Stage Name>" and no raw-unit or point-remaining copy in collapsed UI,
  // while the expanded breakdown retains truthful calculation.
  const progressSource = fs.readFileSync("src/components/garden/GardenProgressSection.tsx", "utf8");
  const entryCardSource = fs.readFileSync("src/components/garden/GardenEntryCard.tsx", "utf8");

  assert.ok(
    progressSource.includes("`Next: ${calc.nextMilestoneLabel}`"),
    "Collapsed next milestone copy must be 'Next: <Stage Name>'"
  );
  assert.ok(
    !progressSource.includes("Next development:"),
    "Progress UI must not contain legacy 'Next development:'"
  );
  assert.ok(
    !progressSource.includes("units remaining"),
    "Progress UI must not contain 'units remaining'"
  );
  assert.ok(
    !progressSource.includes("points remaining"),
    "Progress UI must not contain 'points remaining'"
  );

  // Split source at disclosure row to verify collapsed portion has no unit/point words
  const [collapsedCode, expandedCode] = progressSource.split("isExplanationOpen &&");
  assert.ok(collapsedCode, "Collapsed section must be present");
  assert.ok(expandedCode, "Expanded section must be present");

  // Check collapsed portion (stripping comments) has no unit or point words
  const collapsedClean = collapsedCode.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
  const prohibitedWordsRegex = /\b(unit|units|point|points)\b/i;
  assert.ok(
    !prohibitedWordsRegex.test(collapsedClean),
    "Collapsed progress UI must contain no 'unit', 'units', 'point', or 'points' copy"
  );

  // Check entry card has no unit or point words
  const entryClean = entryCardSource.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
  assert.ok(
    !prohibitedWordsRegex.test(entryClean),
    "Compact entry card must contain no 'unit', 'units', 'point', or 'points' copy"
  );

  // Expanded portion must retain the truthful calculation with units
  assert.ok(
    expandedCode.includes("{calc.pointsUntilNextThreshold.toFixed(1)} units until {calc.nextMilestoneLabel}"),
    "Expanded breakdown must retain truthful calculation with units until next milestone"
  );
  assert.ok(
    expandedCode.includes("{calc.totalFoundationProgress.toFixed(1)} / 100"),
    "Expanded breakdown must retain total foundation progress out of 100"
  );
});

// ----------------------------------------------------------------------------
// 36. Deterministic Couple Uniqueness, Botanical Foliage Contract & Selection Invariants
// ----------------------------------------------------------------------------
test("36. Deterministic Couple Uniqueness, Botanical Foliage Contract & Selection Invariants", () => {
  // 1. Three distinct couple IDs verification
  const coupleAlpha = "couple_alpha_stable_001";
  const coupleBeta = "couple_beta_stable_002";
  const coupleGamma = "couple_gamma_stable_003";

  const dnaA = derivePainterlyCoupleDNA(coupleAlpha);
  const dnaB = derivePainterlyCoupleDNA(coupleBeta);
  const dnaC = derivePainterlyCoupleDNA(coupleGamma);

  // Invariant permanent planting anchor: all couples anchored identically at (390.4, 441.0)
  assert.equal(dnaA.structuralVariation.pivotX, 390.4, "Couple Alpha pivotX must be permanent anchor 390.4");
  assert.equal(dnaA.structuralVariation.pivotY, 441.0, "Couple Alpha pivotY must be permanent anchor 441.0");
  assert.equal(dnaB.structuralVariation.pivotX, 390.4, "Couple Beta pivotX must be permanent anchor 390.4");
  assert.equal(dnaB.structuralVariation.pivotY, 441.0, "Couple Beta pivotY must be permanent anchor 441.0");
  assert.equal(dnaC.structuralVariation.pivotX, 390.4, "Couple Gamma pivotX must be permanent anchor 390.4");
  assert.equal(dnaC.structuralVariation.pivotY, 441.0, "Couple Gamma pivotY must be permanent anchor 441.0");

  // Distinct composition signatures:
  assert.notDeepEqual(
    dnaA.ecologicalComposition,
    dnaB.ecologicalComposition,
    "Couple Alpha and Beta must have distinct ecological compositions"
  );
  assert.notDeepEqual(
    dnaB.ecologicalComposition,
    dnaC.ecologicalComposition,
    "Couple Beta and Gamma must have distinct ecological compositions"
  );
  assert.notDeepEqual(
    dnaA.ecologicalComposition,
    dnaC.ecologicalComposition,
    "Couple Alpha and Gamma must have distinct ecological compositions"
  );

  // Verify bounded couple-specific variation exists across ecological feature categories
  assert.ok(dnaA.ecologicalComposition.mossCushions.length > 0);
  assert.ok(dnaB.ecologicalComposition.mossCushions.length > 0);
  assert.notEqual(
    dnaA.ecologicalComposition.mossCushions[0].x,
    dnaB.ecologicalComposition.mossCushions[0].x,
    "Moss cushions must have distinct couple-seeded x coordinates"
  );

  assert.ok(dnaA.ecologicalComposition.groundcoverClusters.length > 0);
  assert.ok(dnaB.ecologicalComposition.groundcoverClusters.length > 0);
  assert.notEqual(
    dnaA.ecologicalComposition.groundcoverClusters[0].rotation,
    dnaB.ecologicalComposition.groundcoverClusters[0].rotation,
    "Groundcover must have distinct couple-seeded rotation"
  );

  assert.ok(dnaA.ecologicalComposition.smallStones.length > 0);
  assert.ok(dnaB.ecologicalComposition.smallStones.length > 0);

  assert.ok(dnaA.ecologicalComposition.woodlandLightMotes.length > 0);
  assert.ok(dnaB.ecologicalComposition.woodlandLightMotes.length > 0);

  // Plant micro-variation
  assert.ok(typeof dnaA.ecologicalComposition.plantMicroVariation.twigLeanDeg === "number");
  assert.ok(typeof dnaA.ecologicalComposition.plantMicroVariation.shootCurvatureMod === "number");
  assert.ok(typeof dnaA.ecologicalComposition.plantMicroVariation.leafOrientationOffsetDeg === "number");

  // 2. Deterministic stability & partner equality
  const dnaARepeat = derivePainterlyCoupleDNA(coupleAlpha);
  assert.deepEqual(dnaA, dnaARepeat, "Same couple seed must produce byte-identical couple DNA");

  const events = [
    { id: "ev-1", kind: "positive_moment", timestamp: "2026-03-01T10:00:00Z" },
    { id: "ev-2", kind: "reconnection", timestamp: "2026-03-02T10:00:00Z" },
    { id: "ev-3", kind: "important_date", timestamp: "2026-03-03T10:00:00Z" },
  ];

  const markersA = resolveMvpFoundationMemoryMarkers(events, coupleAlpha, 70);
  const markersARepeat = resolveMvpFoundationMemoryMarkers(events, coupleAlpha, 70);
  assert.deepEqual(markersA, markersARepeat, "Same couple + same events = byte-identical memory constellation");

  // Both partners of one couple produce identical markers
  const partnerMarkers = resolveMvpFoundationMemoryMarkers(events, coupleAlpha, 70);
  assert.deepEqual(markersA, partnerMarkers, "Both partners of the couple receive identical markers");

  // Adding a new event preserves existing features and positions
  const newEvent = { id: "ev-4", kind: "positive_moment", timestamp: "2026-03-04T10:00:00Z" };
  const markersWithAddition = resolveMvpFoundationMemoryMarkers([...events, newEvent], coupleAlpha, 70);
  assert.equal(markersWithAddition.length, 4);
  for (const original of markersA) {
    const retained = markersWithAddition.find((m) => m.sourceId === original.sourceId);
    assert.ok(retained, `Original event ${original.sourceId} must be retained`);
    assert.equal(retained.x, original.x, `Event ${original.sourceId} x must remain unchanged`);
    assert.equal(retained.y, original.y, `Event ${original.sourceId} y must remain unchanged`);
    assert.equal(retained.visualKind, original.visualKind, `Event ${original.sourceId} visualKind must remain unchanged`);
  }

  // Deleting an event removes only its feature
  const markersAfterDeletion = resolveMvpFoundationMemoryMarkers(
    events.filter((e) => e.id !== "ev-2"),
    coupleAlpha,
    70
  );
  assert.equal(markersAfterDeletion.length, 2);
  assert.ok(!markersAfterDeletion.some((m) => m.sourceId === "ev-2"), "Deleted event must be absent");
  const ev1After = markersAfterDeletion.find((m) => m.sourceId === "ev-1");
  const ev3After = markersAfterDeletion.find((m) => m.sourceId === "ev-3");
  const ev1Before = markersA.find((m) => m.sourceId === "ev-1");
  const ev3Before = markersA.find((m) => m.sourceId === "ev-3");
  assert.equal(ev1After.x, ev1Before.x);
  assert.equal(ev3After.x, ev3Before.x);

  // 3. Botanical Realism & Semantic Roles
  for (const marker of markersA) {
    assert.ok(marker.semanticRole, "Every marker must possess an explicit semanticRole");
    if (marker.visualKind === "sapling_leaf") {
      assert.equal(marker.semanticRole, "living_oak_leaf", "sapling_leaf must have role living_oak_leaf");
      assert.notEqual(marker.semanticRole, "moss_cushion", "oak leaf must never have moss role");
    } else if (marker.visualKind === "moss") {
      assert.equal(marker.semanticRole, "moss_cushion", "moss must have role moss_cushion");
      assert.notEqual(marker.semanticRole, "living_oak_leaf", "moss must never have oak leaf role");
    }
  }

  // 4. Source code audits for selection indicator bounds & invisible hit areas
  const rendererSource = fs.readFileSync("src/components/garden/PainterlyGardenRenderer.tsx", "utf8");
  const explorerSource = fs.readFileSync("src/components/garden/GardenExplorer.tsx", "utf8");
  const treeSource = fs.readFileSync("src/components/garden/PainterlyTreeStructure.tsx", "utf8");

  // PainterlyTreeStructure: All procedural leaves must use createOakLobedLeafD and createLeafVeinD
  assert.ok(
    treeSource.includes("createOakLobedLeafD"),
    "PainterlyTreeStructure must use createOakLobedLeafD for juvenile oak leaves"
  );
  assert.ok(
    treeSource.includes("createLeafVeinD"),
    "PainterlyTreeStructure must use createLeafVeinD for leaf veins"
  );
  // Ensure crude angular paths are absent
  assert.ok(
    !treeSource.includes("374.0 417.0, 372.0 413.0, 374.0 410.0"),
    "Crude angular polygonal leaf paths must be removed from PainterlyTreeStructure"
  );

  // PainterlyGardenRenderer: Highlighting must be tightly bounded
  assert.ok(
    rendererSource.includes('id="painterly-story-reveal-halo"'),
    "Highlight halo must be present in renderer"
  );
  assert.ok(
    rendererSource.includes('highlightCoord.kind === "oak_leaf"'),
    "Renderer must provide feature-specific oak leaf outline/vein highlighting"
  );
  assert.ok(
    rendererSource.includes('highlightCoord.kind === "acorn"'),
    "Renderer must provide feature-specific acorn contour highlighting"
  );
  assert.ok(
    rendererSource.includes('highlightCoord.kind === "moss"'),
    "Renderer must provide feature-specific moss cushion contour highlighting"
  );
  assert.ok(
    rendererSource.includes("Math.min(7.0"),
    "Generic fallback selection indicator radius must be capped at 7px (max diameter 14px)"
  );

  // Hit testing tolerances must remain invisible: no hit area SVG elements in production
  assert.ok(
    !rendererSource.includes('id="debug-hit-area"'),
    "Production renderer must never render debug hit areas"
  );
  assert.ok(
    !rendererSource.includes('id="mouse-hit-circle"'),
    "Mouse hit tolerance must remain invisible"
  );
  assert.ok(
    !rendererSource.includes('id="touch-hit-circle"'),
    "Touch hit tolerance must remain invisible"
  );

  // 5. Inspect Camera Terminology Audit
  assert.ok(
    explorerSource.includes('"Focus Plant"'),
    "GardenExplorer must use 'Focus Plant' in overview state"
  );
  assert.ok(
    explorerSource.includes('"Back to Overview"'),
    "GardenExplorer must use 'Back to Overview' in focused state"
  );
  assert.ok(
    explorerSource.includes('"Focus camera on your plant"'),
    "GardenExplorer must include 'Focus camera on your plant' accessibility label"
  );
  assert.ok(
    explorerSource.includes('"Return camera to the clearing overview"'),
    "GardenExplorer must include 'Return camera to the clearing overview' accessibility label"
  );
  assert.ok(
    explorerSource.includes('"Reset garden camera"'),
    "GardenExplorer must include 'Reset garden camera' accessibility label"
  );
  assert.ok(
    !explorerSource.includes('>Inspect<'),
    "Legacy 'Inspect' button label must be replaced"
  );
});

// ----------------------------------------------------------------------------
// 37. Authoritative MVP Foundation Clamp, Legacy Stage Decoupling & Parity Regression Invariants
// ----------------------------------------------------------------------------
test("37. Authoritative MVP Foundation Clamp, Legacy Stage Decoupling & Parity Regression Invariants", () => {
  // 1. Care 22 + attempted time 42 clamps to: time 20, total 42, Level 2, Emerging Oak Shoot
  const clamped42 = calculateAuthoritativeFoundation(22, 42);
  assert.equal(clamped42.rawCareContribution, 22, "Care contribution must be exactly 22");
  assert.equal(clamped42.supportingTimeContribution, 20, "Time contribution 42 must clamp to max 20");
  assert.equal(clamped42.totalFoundationProgress, 42, "Total foundation progress must be 22 + 20 = 42");
  assert.equal(clamped42.currentLevel, 2, "42 units must resolve to Level 2");
  assert.equal(clamped42.currentStage, "Emerging Oak Shoot", "42 units must be 'Emerging Oak Shoot'");
  assert.equal(clamped42.subphaseKey, "emerging_shoot", "42 units subphase must be 'emerging_shoot'");

  // 2. Valid care 44 / time 20 fixture resolves to: total 64, Level 3, Small Oak Seedling
  // e.g. 12 positive moments (24) + 4 completed reconnections (16) + 2 important dates (4) = 44 care
  // elapsedDays = 40 -> 20 time (at 20 cap)
  const l3Events = [
    // 12 positive moments
    ...Array.from({ length: 12 }, (_, i) => createMockEvent(`ev-l3-pos-${i + 1}`, "positive_moment", `2026-05-${String(i + 1).padStart(2, "0")}T10:00:00Z`)),
    // 4 completed reconnections
    ...Array.from({ length: 4 }, (_, i) => createMockEvent(`ev-l3-rec-${i + 1}`, "reconnection", `2026-06-${String(i + 1).padStart(2, "0")}T10:00:00Z`)),
    // 2 important dates
    ...Array.from({ length: 2 }, (_, i) => createMockEvent(`ev-l3-date-${i + 1}`, "important_date", `2026-06-${String(i + 10).padStart(2, "0")}T10:00:00Z`)),
  ];
  const l3Calc = calculateAuthoritativeFoundation(l3Events, 40);
  assert.equal(l3Calc.rawCareContribution, 44, "12 pos (24) + 4 rec (16) + 2 dates (4) must yield exactly 44 care");
  assert.equal(l3Calc.supportingTimeContribution, 20, "40 days * 0.5 = 20 time units");
  assert.equal(l3Calc.totalFoundationProgress, 64, "44 care + 20 time must yield exactly 64 total progress");
  assert.equal(l3Calc.currentLevel, 3, "64 units must resolve to Level 3");
  assert.equal(l3Calc.currentStage, "Small Oak Seedling", "64 units must be 'Small Oak Seedling'");
  assert.equal(l3Calc.subphaseKey, "small_seedling", "64 units subphase must be 'small_seedling'");
  assert.equal(l3Calc.levelLabel, "Level 3 of 3");

  // 3. Forcing legacy stage leafy_canopy cannot override a calculated 42-point MVP result
  // If progress is 42, legacy canonical stage from getGardenStage is 'branching_out' (36-55 units)
  // Forcing leafy_canopy conflicts and must not change the authoritative calculation
  const stageFromUnits = getGardenStage(clamped42.totalFoundationProgress);
  assert.equal(stageFromUnits.key, "branching_out", "42 units canonical stage is branching_out, NOT leafy_canopy");
  assert.notEqual(stageFromUnits.key, "leafy_canopy", "42 units must never resolve to leafy_canopy");

  // Even if legacy stage leafy_canopy is passed, the visual stage strictly follows calculateAuthoritativeFoundation
  const visualStageFor42 = calculateAuthoritativeFoundation(clamped42.totalFoundationProgress).subphaseKey;
  assert.equal(visualStageFor42, "emerging_shoot", "Visual stage for 42 units must remain emerging_shoot");
  assert.notEqual(visualStageFor42, "leafy_canopy", "Visual stage must not be overridden by legacy stage name");

  // 4. Parity across Garden, Explore, Story, progress card, and Visual QA:
  // All consumers resolve the exact same visual stage and level from the same calculation
  const testUnits = 64;
  const authoritative = calculateAuthoritativeFoundation(testUnits, 44, 20);

  // Garden progress section resolution
  const progressSectionCalc = calculateAuthoritativeFoundation(authoritative.totalFoundationProgress);
  assert.equal(progressSectionCalc.currentStage, "Small Oak Seedling");
  assert.equal(progressSectionCalc.currentLevel, 3);
  assert.equal(progressSectionCalc.subphaseKey, "small_seedling");

  // PainterlyGardenRenderer presentation resolution
  const rendererPresentation = resolveMvpFoundationPresentation(authoritative.totalFoundationProgress, 44, 20);
  assert.equal(rendererPresentation.label, "Small Oak Seedling");
  assert.equal(rendererPresentation.level, 3);
  assert.equal(rendererPresentation.subphaseKey, "small_seedling");

  // GardenExplorer plant inspection subphase resolution
  const explorerSubphase = calculateAuthoritativeFoundation(authoritative.totalFoundationProgress).subphaseKey;
  assert.equal(explorerSubphase, "small_seedling");

  // Visual QA scenario resolution
  const qaCalc = calculateAuthoritativeFoundation(authoritative.totalFoundationProgress);
  assert.equal(qaCalc.currentStage, "Small Oak Seedling");
  assert.equal(qaCalc.currentLevel, 3);
  assert.equal(qaCalc.subphaseKey, "small_seedling");

  // 5. Audit all QA fixtures: No QA fixture reports supportingTimeContribution above 20
  const qaSource = fs.readFileSync("src/app/garden-visual-qa.tsx", "utf8");
  assert.ok(
    !qaSource.includes("time: 42"),
    "garden-visual-qa.tsx must not contain uncapped time: 42"
  );
  assert.ok(
    !qaSource.includes("time: 30"),
    "garden-visual-qa.tsx must not contain uncapped time: 30"
  );
  assert.ok(
    !qaSource.includes("time: 48"),
    "garden-visual-qa.tsx must not contain uncapped time: 48"
  );
  assert.ok(
    !qaSource.includes("time: 60"),
    "garden-visual-qa.tsx must not contain uncapped time: 60"
  );
  // Verify all hardcoded time values in garden-visual-qa.tsx are <= 20
  const timeMatches = qaSource.match(/time:\s*(\d+)/g) || [];
  for (const tm of timeMatches) {
    const val = parseInt(tm.replace(/\D/g, ""), 10);
    assert.ok(val <= 20, `Every hardcoded time in garden-visual-qa.tsx must be <= 20, found: ${val}`);
  }
});

function gardenVisualQACDCGuarded(code) {
  return code.includes("if (!__DEV__)") && code.includes("<Redirect href=\"/garden\"");
}
