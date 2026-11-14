/**
 * Purple Garden - Garden World Builder
 *
 * Constructs a normalized, renderer-independent GardenWorld representation
 * from the deterministic SVG scene generator and authorized care snapshot.
 *
 * HARDENED INVARIANTS:
 * 1. Canonical Node Identity: Canonical node IDs are guaranteed unique and collision-safe
 *    ("earned:${kind}:${eventId}" or "structural:${role}:${id}").
 * 2. Zero Overwriting: Two events with equal legacy hash or visual prefix exist simultaneously
 *    and independently without overwriting each other in nodes map.
 * 3. Legacy Render ID Mapping: "renderIdToNodeIds" indexes legacy SVG feature IDs for
 *    presentation compatibility.
 * 4. Delimiter-Safe Child Grouping: Multi-element child nodes use structured "::child::"
 *    delimiters to prevent accidental substring prefix matching.
 * 5. Honest Attribution: Decorative structural elements receive sourceEvent: null.
 */

import {
  type GeneratedGardenSVGScene,
  type GardenCareEvent,
  type GardenCareSignals,
  type GardenStage,
  hashStringToSeed,
  getCareFeatureId,
} from "../garden-generator";
import {
  GARDEN_WORLD_SCHEMA_VERSION,
  GARDEN_GENERATOR_VERSION,
  GARDEN_ASSET_SET_VERSION,
  CANONICAL_SCENE_BOUNDS,
  EXPANDED_WORLD_BOUNDS,
  type GardenWorld,
  type GardenNode,
  type EarnedFeatureGroup,
  type SourceEventRef,
  type GardenMemorySource,
  type BoundingBox2D,
  type Transform2D,
  type Point2D,
  type ScenicRegion,
} from "./world-types";
import { getCanonicalEventHeading } from "../event-heading";
import {
  computeApproximatePathBounds,
  createEmptyBounds,
  mergeBounds,
  isMatchingFeatureId,
} from "./feature-bounds";
import {
  deriveHabitatsFromBotanicalWorld,
  evaluateEcosystemState,
} from "./ecosystem";

export interface BuildGardenWorldInput {
  coupleId: string;
  seedString?: string;
  totalGrowthUnits: number;
  careGrowthUnits: number;
  timeGrowthUnits: number;
  isResting?: boolean;
  effectiveTheme?: "light" | "dim" | "dark";
  careEvents?: GardenCareEvent[];
  careSignals?: GardenCareSignals;
  evaluatedAt?: string | null;
  scene?: GeneratedGardenSVGScene;
}

function createDefaultTransform(x: number, y: number): Transform2D {
  return {
    position: { x, y },
    rotation: 0,
    scale: { x: 1, y: 1 },
    pivot: { x, y },
  };
}

/**
 * Validates that there are no reference cycles in parent-child links.
 */
function validateAcyclicHierarchy(nodes: Record<string, GardenNode>, rootId: string): void {
  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(nodeId: string) {
    if (stack.has(nodeId)) {
      throw new Error(`Cycle detected in garden world hierarchy at node: ${nodeId}`);
    }
    if (visited.has(nodeId)) return;

    visited.add(nodeId);
    stack.add(nodeId);

    const node = nodes[nodeId];
    if (node) {
      for (const childId of node.childIds) {
        if (!nodes[childId]) {
          throw new Error(`Orphan child reference: ${childId} referenced by parent ${nodeId}`);
        }
        dfs(childId);
      }
    }

    stack.delete(nodeId);
  }

  dfs(rootId);
}

/**
 * Builds the canonical GardenWorld from procedural scene data.
 */
export function buildGardenWorld(
  scene: GeneratedGardenSVGScene,
  input: BuildGardenWorldInput
): GardenWorld {
  const seedString = input.seedString || input.coupleId || "purple-garden-couple-seed";
  const coupleSeed = hashStringToSeed(seedString);
  const evaluatedAt = input.evaluatedAt || null;
  const isResting = Boolean(input.isResting ?? scene.isResting);
  const effectiveTheme = input.effectiveTheme || "light";

  const careEvents = input.careEvents || [];
  const eventLookup = new Map<string, { event: GardenCareEvent; featureId: string }>();
  for (const ev of careEvents) {
    const fid = getCareFeatureId(ev.kind, ev.id);
    eventLookup.set(fid, { event: ev, featureId: fid });
    eventLookup.set(`${ev.kind}:${ev.id}`, { event: ev, featureId: fid });
  }

  const nodes: Record<string, GardenNode> = {};
  const renderIdToNodeIds: Record<string, string[]> = {};
  const earnedFeatureGroups: Record<string, EarnedFeatureGroup> = {};
  const stageMappingGaps: string[] = [];

  if (scene.stage.key === "first_seedling" || scene.stage.key === "tender_sapling") {
    stageMappingGaps.push(
      `Stage ${scene.stage.key} uses dedicated botanical morphology that transitions via discrete procedural stages rather than continuous morphing splines.`
    );
  }

  function registerRenderId(renderId: string | undefined | null, canonicalNodeId: string) {
    if (!renderId) return;
    if (!renderIdToNodeIds[renderId]) {
      renderIdToNodeIds[renderId] = [];
    }
    if (!renderIdToNodeIds[renderId].includes(canonicalNodeId)) {
      renderIdToNodeIds[renderId].push(canonicalNodeId);
    }
  }

  // 1. World Root
  const rootNodeId = "world-root";
  const worldBounds: BoundingBox2D = EXPANDED_WORLD_BOUNDS;
  const canonicalBounds: BoundingBox2D = CANONICAL_SCENE_BOUNDS;

  nodes[rootNodeId] = {
    id: rootNodeId,
    role: "world_root",
    parentId: null,
    childIds: ["terrain-root", "tree-root", "ground-flora-root", "habitat-root"],
    depthLayer: -100,
    localTransform: createDefaultTransform(400, 250),
    worldBounds,
    anchorPoint: { x: 400, y: 440 },
    isEarned: false,
    sourceEvent: null,
    appearanceOrigin: "stage_structure",
    mappingType: "continuous_structural",
    scenicRegion: "atmosphere",
  };
  registerRenderId(rootNodeId, rootNodeId);

  // Helper to safely register a child on its parent
  function registerChild(parentId: string, childId: string) {
    if (nodes[parentId] && !nodes[parentId].childIds.includes(childId)) {
      nodes[parentId].childIds.push(childId);
    }
  }

  // Helper to resolve an element ID to canonical earned identity or fallback
  function matchEarnedEvent(
    elemId: string,
    defaultRole: string,
    defaultIdx: number
  ): {
    canonicalId: string;
    isEarned: boolean;
    sourceEvent: SourceEventRef | null;
    sourceMemory: GardenMemorySource | null;
    semanticKey: string | null;
    earnedGroupKey: string | null;
    legacyFeatureId: string;
  } {
    for (const [key, val] of eventLookup.entries()) {
      if (isMatchingFeatureId(elemId, val.featureId)) {
        const ev = val.event;
        const semanticKey = `${ev.kind}:${ev.id}`;
        let canonicalId = `earned:${ev.kind}:${ev.id}`;
        if (elemId !== val.featureId) {
          const suffix = elemId.slice(val.featureId.length).replace(/^[-:]+/, "");
          canonicalId = `earned:${ev.kind}:${ev.id}::child::${suffix || "sub"}`;
        }

        let sourceType: GardenMemorySource["sourceType"];
        if (ev.kind === "positive_moment") {
          sourceType = "shared_positive";
        } else if (ev.kind === "reconnection") {
          sourceType = "completed_reconnection";
        } else {
          sourceType = "important_date";
        }

        const canonicalHeading = getCanonicalEventHeading(ev);
        const targetRoute =
          ev.kind === "positive_moment" || ev.kind === "reconnection"
            ? `/event/${ev.id}`
            : null;

        const sourceMemory: GardenMemorySource = {
          sourceType,
          sourceId: ev.id,
          coupleId: input.coupleId,
          occurredAt: ev.occurredAt || ev.createdAt || "",
          canonicalHeading,
          targetRoute,
          privacyClass: "shared_safe_metadata",
        };

        return {
          canonicalId,
          isEarned: true,
          sourceEvent: {
            kind: ev.kind,
            id: ev.id,
            semanticKey,
            authoritativeTimestamp: ev.createdAt || ev.occurredAt || null,
          },
          sourceMemory,
          semanticKey,
          earnedGroupKey: semanticKey,
          legacyFeatureId: elemId,
        };
      }
    }

    const canonicalId = elemId.startsWith("structural:")
      ? elemId
      : `structural:${defaultRole}:${defaultIdx}`;
    return {
      canonicalId,
      isEarned: false,
      sourceEvent: null,
      sourceMemory: null,
      semanticKey: null,
      earnedGroupKey: null,
      legacyFeatureId: elemId,
    };
  }

  // Helper to add a node to earnedFeatureGroups
  function trackEarnedNode(node: GardenNode) {
    if (!node.isEarned || !node.sourceEvent || !node.semanticKey) return;
    const key = node.semanticKey;
    if (!earnedFeatureGroups[key]) {
      earnedFeatureGroups[key] = {
        semanticKey: key,
        sourceEvent: node.sourceEvent,
        sourceMemory: node.sourceMemory || undefined,
        nodeIds: [node.id],
        bounds: { ...node.worldBounds },
        anchor: { ...node.anchorPoint },
      };
    } else {
      const g = earnedFeatureGroups[key];
      if (!g.nodeIds.includes(node.id)) {
        g.nodeIds.push(node.id);
      }
      if (node.sourceMemory && !g.sourceMemory) {
        g.sourceMemory = node.sourceMemory;
      }
      g.bounds = mergeBounds([g.bounds, node.worldBounds]);
      g.anchor = {
        x: Math.round(((g.bounds.minX + g.bounds.maxX) / 2) * 10) / 10,
        y: Math.round(((g.bounds.minY + g.bounds.maxY) / 2) * 10) / 10,
      };
    }
  }

  function determineScenicRegion(node: GardenNode): ScenicRegion {
    const x = node.anchorPoint ? node.anchorPoint.x : 400;
    const y = node.anchorPoint ? node.anchorPoint.y : 250;

    if (node.role === "world_root") {
      return "atmosphere";
    }

    if (node.role === "terrain_region") {
      if (node.regionKind === "distant_woodland" || node.regionKind === "distant_hills") {
        return "atmosphere";
      }
      if (node.regionKind === "stream_path") {
        return "stream_edge";
      }
      if (node.regionKind === "root_shadow" || node.regionKind === "soil_bed") {
        return "root_grove";
      }
      return "wildflower_meadow";
    }

    if (node.role === "landmark") {
      return "stone_landmark_area";
    }

    if (node.role === "root") {
      return "root_grove";
    }

    if (node.role === "trunk") {
      if (y > 430) return "root_grove";
      return "trunk";
    }

    if (node.role === "ground_flora") {
      if (node.floraType === "stone") {
        return "stone_landmark_area";
      }
      if (x > 500 && y > 380 && (node.pathD?.includes("stream") || x > 540)) {
        return "stream_edge";
      }
      if (y >= 430 && Math.abs(x - 400) < 100) {
        return "root_grove";
      }
      return "wildflower_meadow";
    }

    if (node.role === "foliage" || node.role === "bud_blossom_fruit" || node.role === "branch") {
      if (y < 160 || (y < 210 && Math.abs(x - 400) < 70)) {
        return "crown";
      }
      if (x < 380) {
        return "left_canopy";
      }
      if (x > 420) {
        return "right_canopy";
      }
      return y < 250 ? "crown" : "trunk";
    }

    if (node.role === "habitat_detail" || node.role === "habitat_node" || node.role === "creature_node") {
      if (y > 380) {
        return x > 520 ? "stream_edge" : "wildflower_meadow";
      }
      if (y < 170) {
        return "crown";
      }
      if (x < 380) {
        return "left_canopy";
      }
      if (x > 420) {
        return "right_canopy";
      }
      return "trunk";
    }

    return "wildflower_meadow";
  }

  // Unified node registration helper: ensures canonical storage and legacy alias
  function addNode(node: GardenNode, legacyId?: string) {
    if (!node.scenicRegion) {
      node.scenicRegion = determineScenicRegion(node);
    }
    nodes[node.id] = node;
    if (legacyId) {
      registerRenderId(legacyId, node.id);
      if (!nodes[legacyId]) {
        nodes[legacyId] = node; // Backward compatibility alias
      }
    }
    if (node.parentId) {
      registerChild(node.parentId, node.id);
    }
    if (node.isEarned) {
      trackEarnedNode(node);
    }
  }

  // ----------------------------------------------------
  // 2. TERRAIN BRANCH
  // ----------------------------------------------------
  const terrainRootId = "terrain-root";
  const terrainRootNode: GardenNode = {
    id: terrainRootId,
    role: "terrain_region",
    regionKind: "soil_bed",
    parentId: rootNodeId,
    childIds: [],
    depthLayer: -70,
    localTransform: createDefaultTransform(400, 440),
    worldBounds,
    anchorPoint: { x: 400, y: 440 },
    isEarned: false,
    sourceEvent: null,
    appearanceOrigin: "stage_structure",
    mappingType: "continuous_structural",
    pathD: scene.soilBedPath || "",
  };
  addNode(terrainRootNode, terrainRootId);

  const terrainRegions: Array<{
    id: string;
    kind:
      | "distant_woodland"
      | "distant_hills"
      | "rear_grass"
      | "mid_grass"
      | "front_grass"
      | "stream_path"
      | "garden_path"
      | "soil_bed"
      | "root_shadow";
    pathD: string;
    depth: number;
  }> = [];

  if (scene.distantWoodlandPath) {
    terrainRegions.push({
      id: "terrain-woodland",
      kind: "distant_woodland",
      pathD: scene.distantWoodlandPath,
      depth: -85,
    });
  }

  terrainRegions.push(
    { id: "terrain-hills", kind: "distant_hills", pathD: scene.distantHillsPath, depth: -80 },
    { id: "terrain-rear-grass", kind: "rear_grass", pathD: scene.groundLayerBack, depth: -60 },
    { id: "terrain-mid-grass", kind: "mid_grass", pathD: scene.groundLayerMid, depth: -40 },
    { id: "terrain-front-grass", kind: "front_grass", pathD: scene.groundLayerFront, depth: -30 }
  );

  if (scene.streamPath) {
    terrainRegions.push({
      id: "terrain-stream",
      kind: "stream_path",
      pathD: scene.streamPath,
      depth: -25,
    });
  }
  if (scene.gardenPathD) {
    terrainRegions.push({
      id: "terrain-path",
      kind: "garden_path",
      pathD: scene.gardenPathD,
      depth: -25,
    });
  }

  if (scene.soilBedPath) {
    terrainRegions.push({
      id: "terrain-soil-bed",
      kind: "soil_bed",
      pathD: scene.soilBedPath,
      depth: -20,
    });
  }
  if (scene.rootShadowPath) {
    terrainRegions.push({
      id: "terrain-root-shadow",
      kind: "root_shadow",
      pathD: scene.rootShadowPath,
      depth: -18,
    });
  }

  for (const tr of terrainRegions) {
    const b = computeApproximatePathBounds(tr.pathD);
    const trNode: GardenNode = {
      id: tr.id,
      role: "terrain_region",
      regionKind: tr.kind,
      parentId: terrainRootId,
      childIds: [],
      depthLayer: tr.depth,
      localTransform: createDefaultTransform(
        (b.minX + b.maxX) / 2 || 400,
        (b.minY + b.maxY) / 2 || 440
      ),
      worldBounds: b,
      anchorPoint: { x: (b.minX + b.maxX) / 2 || 400, y: b.maxY || 440 },
      isEarned: false,
      sourceEvent: null,
      appearanceOrigin: "stage_structure",
      mappingType: "continuous_structural",
      pathD: tr.pathD,
    };
    addNode(trNode, tr.id);
  }

  // Expanded terrain margin nodes (deterministic breathing room outside canonical [0,0,800,500])
  const expandedTerrainRegions: Array<{
    id: string;
    kind: "distant_woodland" | "mid_grass" | "stream_path";
    depth: number;
    bounds: BoundingBox2D;
    anchor: Point2D;
    scenicRegion: ScenicRegion;
    pathD: string;
  }> = [
    {
      id: "terrain-woodland-edge-left",
      kind: "distant_woodland",
      depth: -85,
      bounds: { minX: -100, minY: 100, maxX: 40, maxY: 320, width: 140, height: 220 },
      anchor: { x: -30, y: 320 },
      scenicRegion: "atmosphere",
      pathD: "M-100,100 L40,100 L40,320 L-100,320 Z",
    },
    {
      id: "terrain-woodland-edge-right",
      kind: "distant_woodland",
      depth: -85,
      bounds: { minX: 760, minY: 100, maxX: 900, maxY: 320, width: 140, height: 220 },
      anchor: { x: 830, y: 320 },
      scenicRegion: "atmosphere",
      pathD: "M760,100 L900,100 L900,320 L760,320 Z",
    },
    {
      id: "terrain-meadow-margin-left",
      kind: "mid_grass",
      depth: -40,
      bounds: { minX: -100, minY: 340, maxX: 50, maxY: 540, width: 150, height: 200 },
      anchor: { x: -25, y: 480 },
      scenicRegion: "wildflower_meadow",
      pathD: "M-100,340 L50,340 L50,540 L-100,540 Z",
    },
    {
      id: "terrain-meadow-margin-right",
      kind: "mid_grass",
      depth: -40,
      bounds: { minX: 750, minY: 340, maxX: 900, maxY: 540, width: 150, height: 200 },
      anchor: { x: 825, y: 480 },
      scenicRegion: "wildflower_meadow",
      pathD: "M750,340 L900,340 L900,540 L750,540 Z",
    },
  ];

  if (scene.streamPath) {
    expandedTerrainRegions.push({
      id: "terrain-stream-continuation",
      kind: "stream_path",
      depth: -25,
      bounds: { minX: 780, minY: 440, maxX: 900, maxY: 550, width: 120, height: 110 },
      anchor: { x: 840, y: 500 },
      scenicRegion: "stream_edge",
      pathD: "M780,440 L900,440 L900,550 L780,550 Z",
    });
  }

  for (const etr of expandedTerrainRegions) {
    const etrNode: GardenNode = {
      id: etr.id,
      role: "terrain_region",
      regionKind: etr.kind,
      parentId: terrainRootId,
      childIds: [],
      depthLayer: etr.depth,
      localTransform: createDefaultTransform(etr.anchor.x, etr.anchor.y),
      worldBounds: etr.bounds,
      anchorPoint: etr.anchor,
      isEarned: false,
      sourceEvent: null,
      appearanceOrigin: "stage_structure",
      mappingType: "continuous_structural",
      scenicRegion: etr.scenicRegion,
      pathD: etr.pathD,
      isExpanded: true,
    };
    addNode(etrNode, etr.id);
  }

  // ----------------------------------------------------
  // 3. TREE BRANCH (TRUNK, ROOTS, BRANCHES)
  // ----------------------------------------------------
  const treeRootId = "tree-root";
  const trunkBounds = computeApproximatePathBounds(scene.trunkPath);
  const trunkAnchor = {
    x: Math.round(((trunkBounds.minX + trunkBounds.maxX) / 2) * 10) / 10 || 400,
    y: trunkBounds.maxY || 440,
  };

  const treeRootNode: GardenNode = {
    id: treeRootId,
    role: "trunk",
    parentId: rootNodeId,
    childIds: ["tree-trunk"],
    depthLayer: 0,
    localTransform: createDefaultTransform(trunkAnchor.x, trunkAnchor.y),
    worldBounds: trunkBounds,
    anchorPoint: trunkAnchor,
    isEarned: false,
    sourceEvent: null,
    appearanceOrigin: "stage_structure",
    mappingType:
      scene.stage.key === "first_seedling" || scene.stage.key === "tender_sapling"
        ? "legacy_stage_local"
        : "continuous_structural",
    pathD: scene.trunkPath,
    highlightPathD: scene.trunkHighlightPath,
    shadowPathD: scene.trunkShadowPath,
  };
  addNode(treeRootNode, treeRootId);

  const trunkNode: GardenNode = {
    id: "tree-trunk",
    role: "trunk",
    parentId: treeRootId,
    childIds: [],
    depthLayer: 0,
    localTransform: createDefaultTransform(trunkAnchor.x, trunkAnchor.y),
    worldBounds: trunkBounds,
    anchorPoint: trunkAnchor,
    isEarned: false,
    sourceEvent: null,
    appearanceOrigin: "stage_structure",
    mappingType:
      scene.stage.key === "first_seedling" || scene.stage.key === "tender_sapling"
        ? "legacy_stage_local"
        : "continuous_structural",
    pathD: scene.trunkPath,
    highlightPathD: scene.trunkHighlightPath,
    shadowPathD: scene.trunkShadowPath,
  };
  addNode(trunkNode, "tree-trunk");

  // Bark textures on the trunk
  if (scene.barkTexturePaths && scene.barkTexturePaths.length > 0) {
    scene.barkTexturePaths.forEach((bt, idx) => {
      const bb = computeApproximatePathBounds(bt.d, bt.strokeWidth || 1.2);
      const btId = `tree-bark-texture-${idx}`;
      const btNode: GardenNode = {
        id: btId,
        role: "trunk",
        parentId: "tree-trunk",
        childIds: [],
        depthLayer: 18,
        localTransform: createDefaultTransform((bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2),
        worldBounds: bb,
        anchorPoint: { x: (bb.minX + bb.maxX) / 2, y: (bb.minY + bb.maxY) / 2 },
        isEarned: false,
        sourceEvent: null,
        appearanceOrigin: "stage_structure",
        mappingType: "continuous_structural",
        pathD: bt.d,
        color: bt.color,
      };
      addNode(btNode, bt.id || btId);
    });
  }

  // Roots
  if (scene.rootPaths && scene.rootPaths.length > 0) {
    scene.rootPaths.forEach((rp, idx) => {
      const rb = computeApproximatePathBounds(rp);
      const rootId = `tree-root-${idx}`;
      const rNode: GardenNode = {
        id: rootId,
        role: "root",
        rootIndex: idx,
        parentId: treeRootId,
        childIds: [],
        depthLayer: -5,
        localTransform: createDefaultTransform((rb.minX + rb.maxX) / 2, rb.minY),
        worldBounds: rb,
        anchorPoint: { x: (rb.minX + rb.maxX) / 2, y: rb.minY },
        isEarned: false,
        sourceEvent: null,
        appearanceOrigin: "stage_structure",
        mappingType: "continuous_structural",
        pathD: rp,
      };
      addNode(rNode, rootId);
    });
  }

  // Branches
  const branchIds: string[] = [];
  scene.branches.forEach((bp, idx) => {
    const bb = computeApproximatePathBounds(bp);
    const branchId = `tree-branch-${idx}`;
    branchIds.push(branchId);
    const bNode: GardenNode = {
      id: branchId,
      role: "branch",
      branchIndex: idx,
      parentId: "tree-trunk",
      childIds: [],
      depthLayer: 20,
      localTransform: createDefaultTransform((bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2),
      worldBounds: bb,
      anchorPoint: { x: (bb.minX + bb.maxX) / 2, y: bb.maxY },
      isEarned: false,
      sourceEvent: null,
      appearanceOrigin: "stage_structure",
      mappingType: "continuous_structural",
      pathD: bp,
    };
    addNode(bNode, branchId);
  });

  const canopyParentId = branchIds.length > 0 ? branchIds[0] : "tree-trunk";

  // ----------------------------------------------------
  // 4. CANOPY FOLIAGE, BLOSSOMS, SEED PODS & SHOOTS
  // ----------------------------------------------------

  // Canopy Shadow Masses (Layer 22)
  if (scene.canopyShadowClusters && scene.canopyShadowClusters.length > 0) {
    scene.canopyShadowClusters.forEach((sc, idx) => {
      const fb = computeApproximatePathBounds(sc.d);
      const scId = `canopy-shadow-${idx}`;
      const scNode: GardenNode = {
        id: scId,
        role: "foliage",
        canopyDepthType: "shadow_mass",
        parentId: "tree-trunk",
        childIds: [],
        depthLayer: 22,
        localTransform: createDefaultTransform((fb.minX + fb.maxX) / 2, (fb.minY + fb.maxY) / 2),
        worldBounds: fb,
        anchorPoint: { x: (fb.minX + fb.maxX) / 2, y: (fb.minY + fb.maxY) / 2 },
        isEarned: false,
        sourceEvent: null,
        appearanceOrigin: "stage_structure",
        mappingType: "continuous_structural",
        pathD: sc.d,
        color: sc.color,
      };
      addNode(scNode, sc.id || scId);
    });
  }

  // Foliage Clusters
  scene.foliageClusters.forEach((fc, idx) => {
    const fb = computeApproximatePathBounds(fc.d);
    const match = matchEarnedEvent(fc.id, "foliage", idx);
    const parentId = branchIds.length > 0 ? branchIds[idx % branchIds.length] : canopyParentId;

    const fNode: GardenNode = {
      id: match.canonicalId,
      legacyFeatureId: match.legacyFeatureId,
      earnedGroupKey: match.earnedGroupKey,
      role: "foliage",
      canopyDepthType: "mid_canopy",
      semanticKey: match.semanticKey,
      parentId,
      childIds: [],
      depthLayer: 30,
      localTransform: createDefaultTransform((fb.minX + fb.maxX) / 2, (fb.minY + fb.maxY) / 2),
      worldBounds: fb,
      anchorPoint: { x: (fb.minX + fb.maxX) / 2, y: (fb.minY + fb.maxY) / 2 },
      attachmentTarget: "canopy",
      isEarned: match.isEarned,
      sourceEvent: match.sourceEvent,
      sourceMemory: match.sourceMemory,
      appearanceOrigin: match.isEarned ? "source_event" : "stage_structure",
      mappingType: "continuous_structural",
      pathD: fc.d,
      color: fc.color,
    };
    addNode(fNode, fc.id);
  });

  // Canopy Highlight Masses (Layer 38)
  if (scene.canopyHighlightClusters && scene.canopyHighlightClusters.length > 0) {
    scene.canopyHighlightClusters.forEach((hc, idx) => {
      const fb = computeApproximatePathBounds(hc.d);
      const hcId = `canopy-highlight-${idx}`;
      const hcNode: GardenNode = {
        id: hcId,
        role: "foliage",
        canopyDepthType: "highlight_cluster",
        parentId: "tree-trunk",
        childIds: [],
        depthLayer: 38,
        localTransform: createDefaultTransform((fb.minX + fb.maxX) / 2, (fb.minY + fb.maxY) / 2),
        worldBounds: fb,
        anchorPoint: { x: (fb.minX + fb.maxX) / 2, y: (fb.minY + fb.maxY) / 2 },
        isEarned: false,
        sourceEvent: null,
        appearanceOrigin: "stage_structure",
        mappingType: "continuous_structural",
        pathD: hc.d,
        color: hc.color,
      };
      addNode(hcNode, hc.id || hcId);
    });
  }

  // Blossoms
  scene.blossoms.forEach((b, idx) => {
    const radius = b.r || 10;
    const bb: BoundingBox2D = {
      minX: b.cx - radius,
      minY: b.cy - radius,
      maxX: b.cx + radius,
      maxY: b.cy + radius,
      width: radius * 2,
      height: radius * 2,
    };
    const match = matchEarnedEvent(b.id, "blossom", idx);
    const parentId = branchIds.length > 0 ? branchIds[idx % branchIds.length] : canopyParentId;

    const bNode: GardenNode = {
      id: match.canonicalId,
      legacyFeatureId: match.legacyFeatureId,
      earnedGroupKey: match.earnedGroupKey,
      role: "bud_blossom_fruit",
      blossomKind: "blossom",
      semanticKey: match.semanticKey,
      parentId,
      childIds: [],
      depthLayer: 50,
      localTransform: createDefaultTransform(b.cx, b.cy),
      worldBounds: bb,
      anchorPoint: { x: b.cx, y: b.cy },
      isEarned: match.isEarned,
      sourceEvent: match.sourceEvent,
      sourceMemory: match.sourceMemory,
      appearanceOrigin: match.isEarned ? "source_event" : "stage_structure",
      mappingType: "continuous_structural",
      attachmentTarget: "canopy",
      center: { x: b.cx, y: b.cy },
      radius,
      petalCount: b.petalCount || 5,
      rotation: b.rotation || 0,
      primaryColor: b.color,
      secondaryColor: b.petalColor,
    };
    addNode(bNode, b.id);
  });

  // Seed Pods
  if (scene.seedPods) {
    scene.seedPods.forEach((p, idx) => {
      const rx = p.rx || 6;
      const ry = p.ry || 8;
      const pb: BoundingBox2D = {
        minX: p.cx - rx,
        minY: p.cy - ry,
        maxX: p.cx + rx,
        maxY: p.cy + ry,
        width: rx * 2,
        height: ry * 2,
      };
      const match = matchEarnedEvent(p.id, "seed_pod", idx);
      const parentId = branchIds.length > 0 ? branchIds[idx % branchIds.length] : canopyParentId;

      const pNode: GardenNode = {
        id: match.canonicalId,
        legacyFeatureId: match.legacyFeatureId,
        earnedGroupKey: match.earnedGroupKey,
        role: "bud_blossom_fruit",
        blossomKind: "seed_pod",
        semanticKey: match.semanticKey,
        parentId,
        childIds: [],
        depthLayer: 50,
        localTransform: createDefaultTransform(p.cx, p.cy),
        worldBounds: pb,
        anchorPoint: { x: p.cx, y: p.cy },
        isEarned: match.isEarned,
        sourceEvent: match.sourceEvent,
        sourceMemory: match.sourceMemory,
        appearanceOrigin: match.isEarned ? "source_event" : "stage_structure",
        mappingType: "continuous_structural",
        attachmentTarget: "canopy",
        center: { x: p.cx, y: p.cy },
        radius: Math.max(rx, ry),
        primaryColor: p.color,
      };
      addNode(pNode, p.id);
    });
  }

  // Canopy Details (shoots, buds, berries)
  if (scene.canopyDetails) {
    scene.canopyDetails.forEach((cd, idx) => {
      const subBounds: BoundingBox2D[] = [];
      if (cd.stemPath) subBounds.push(computeApproximatePathBounds(cd.stemPath, cd.stemWidth || 1.5));
      if (cd.leaves) {
        cd.leaves.forEach((l) => subBounds.push(computeApproximatePathBounds(l.d)));
      }
      if (cd.buds) {
        cd.buds.forEach((b) =>
          subBounds.push({
            minX: b.cx - (b.rx || 6),
            minY: b.cy - (b.ry || 8),
            maxX: b.cx + (b.rx || 6),
            maxY: b.cy + (b.ry || 8),
            width: (b.rx || 6) * 2,
            height: (b.ry || 8) * 2,
          })
        );
      }
      if (cd.berries) {
        cd.berries.forEach((b) =>
          subBounds.push({
            minX: b.cx - (b.rx || 5),
            minY: b.cy - (b.ry || 5),
            maxX: b.cx + (b.rx || 5),
            maxY: b.cy + (b.ry || 5),
            width: (b.rx || 5) * 2,
            height: (b.ry || 5) * 2,
          })
        );
      }

      const cb = mergeBounds(subBounds);
      const cx = (cb.minX + cb.maxX) / 2 || 400;
      const cy = (cb.minY + cb.maxY) / 2 || 200;
      const match = matchEarnedEvent(cd.id, "canopy_detail", idx);
      const parentId = branchIds.length > 0 ? branchIds[idx % branchIds.length] : canopyParentId;

      const cdNode: GardenNode = {
        id: match.canonicalId,
        legacyFeatureId: match.legacyFeatureId,
        earnedGroupKey: match.earnedGroupKey,
        role: cd.buds || cd.berries ? "bud_blossom_fruit" : "foliage",
        blossomKind: cd.berries ? "berry_cluster" : cd.buds ? "paired_buds" : undefined,
        family: cd.family,
        variant: cd.variant,
        semanticKey: match.semanticKey,
        parentId,
        childIds: [],
        depthLayer: 40,
        localTransform: createDefaultTransform(cx, cy),
        worldBounds: cb,
        anchorPoint: { x: cx, y: cy },
        isEarned: match.isEarned,
        sourceEvent: match.sourceEvent,
        sourceMemory: match.sourceMemory,
        appearanceOrigin: match.isEarned ? "source_event" : "stage_structure",
        mappingType: "continuous_structural",
        center: { x: cx, y: cy },
        radius: Math.max(8, Math.hypot(cb.width, cb.height) / 2),
      } as GardenNode;

      addNode(cdNode, cd.id);
    });
  }

  // ----------------------------------------------------
  // 5. GROUND FLORA & LANDMARKS
  // ----------------------------------------------------
  const groundFloraRootId = "ground-flora-root";
  const groundFloraRootNode: GardenNode = {
    id: groundFloraRootId,
    role: "ground_flora",
    floraType: "moss",
    parentId: rootNodeId,
    childIds: [],
    depthLayer: 10,
    localTransform: createDefaultTransform(400, 440),
    worldBounds,
    anchorPoint: { x: 400, y: 440 },
    isEarned: false,
    sourceEvent: null,
    appearanceOrigin: "stage_structure",
    mappingType: "continuous_structural",
    position: { x: 400, y: 440 },
  };
  addNode(groundFloraRootNode, groundFloraRootId);

  scene.groundDetails.forEach((gd, idx) => {
    const isLandmark = gd.id.startsWith("care-important-date-");
    const match = matchEarnedEvent(gd.id, isLandmark ? "landmark" : "ground_flora", idx);

    const subBounds: BoundingBox2D[] = [];
    if (typeof gd.cx === "number" && typeof gd.cy === "number") {
      const rx = gd.rx || 8;
      const ry = gd.ry || 8;
      subBounds.push({
        minX: gd.cx - rx,
        minY: gd.cy - ry,
        maxX: gd.cx + rx,
        maxY: gd.cy + ry,
        width: rx * 2,
        height: ry * 2,
      });
    }
    if (gd.d) subBounds.push(computeApproximatePathBounds(gd.d));
    if (gd.stemPath) subBounds.push(computeApproximatePathBounds(gd.stemPath));
    if (gd.leafPaths) {
      gd.leafPaths.forEach((lp) => subBounds.push(computeApproximatePathBounds(lp.d)));
    }
    if (gd.florets) {
      gd.florets.forEach((fl) =>
        subBounds.push({
          minX: fl.cx - (fl.r || 4),
          minY: fl.cy - (fl.r || 4),
          maxX: fl.cx + (fl.r || 4),
          maxY: fl.cy + (fl.r || 4),
          width: (fl.r || 4) * 2,
          height: (fl.r || 4) * 2,
        })
      );
    }

    const gb = mergeBounds(subBounds);
    const cx = typeof gd.cx === "number" ? gd.cx : (gb.minX + gb.maxX) / 2 || 400;
    const cy = typeof gd.cy === "number" ? gd.cy : (gb.minY + gb.maxY) / 2 || 440;

    let node: GardenNode;
    if (isLandmark) {
      node = {
        id: match.canonicalId,
        legacyFeatureId: match.legacyFeatureId,
        earnedGroupKey: match.earnedGroupKey,
        role: "landmark",
        semanticKey: match.semanticKey,
        parentId: groundFloraRootId,
        childIds: [],
        depthLayer: 15,
        localTransform: createDefaultTransform(cx, cy),
        worldBounds: gb,
        anchorPoint: { x: cx, y: cy },
        isEarned: true,
        sourceEvent: match.sourceEvent,
        sourceMemory: match.sourceMemory,
        appearanceOrigin: "source_event",
        mappingType: "continuous_structural",
        position: { x: cx, y: cy },
        color: gd.color,
        attachmentTarget: "terrain",
      };
    } else {
      const isMoss = gd.type === "moss";
      node = {
        id: match.canonicalId,
        legacyFeatureId: match.legacyFeatureId,
        earnedGroupKey: match.earnedGroupKey,
        role: "ground_flora",
        floraType: gd.type,
        semanticKey: match.semanticKey,
        parentId: groundFloraRootId,
        childIds: [],
        depthLayer: gd.type === "soil-fleck" || gd.type === "stone" ? -15 : 10,
        localTransform: createDefaultTransform(cx, cy),
        worldBounds: gb,
        anchorPoint: { x: cx, y: cy },
        isEarned: match.isEarned,
        sourceEvent: match.sourceEvent,
        sourceMemory: match.sourceMemory,
        appearanceOrigin: match.isEarned ? "source_event" : "stage_structure",
        mappingType: "continuous_structural",
        position: { x: cx, y: cy },
        color: gd.color,
        pathD: gd.d,
        attachmentTarget: isMoss ? "root" : "terrain",
        variant: isMoss ? "moss_cushion" : undefined,
      };
    }

    addNode(node, gd.id);
  });

  // Margin flora: deterministic decorative botanicals in expanded breathing room (-100..0 and 800..900)
  const marginFloraDetails: Array<{
    id: string;
    floraType: "fern" | "clover" | "moss" | "flower";
    cx: number;
    cy: number;
    radius: number;
  }> = [
    { id: "margin-flora-left-fern", floraType: "fern", cx: -45, cy: 460, radius: 16 },
    { id: "margin-flora-left-clover", floraType: "clover", cx: -20, cy: 495, radius: 12 },
    { id: "margin-flora-right-moss", floraType: "moss", cx: 825, cy: 470, radius: 14 },
    { id: "margin-flora-right-flower", floraType: "flower", cx: 860, cy: 505, radius: 15 },
  ];

  for (const mf of marginFloraDetails) {
    const mfNode: GardenNode = {
      id: mf.id,
      legacyFeatureId: mf.id,
      role: "ground_flora",
      floraType: mf.floraType,
      parentId: groundFloraRootId,
      childIds: [],
      depthLayer: 10,
      localTransform: createDefaultTransform(mf.cx, mf.cy),
      worldBounds: {
        minX: mf.cx - mf.radius,
        minY: mf.cy - mf.radius,
        maxX: mf.cx + mf.radius,
        maxY: mf.cy + mf.radius,
        width: mf.radius * 2,
        height: mf.radius * 2,
      },
      anchorPoint: { x: mf.cx, y: mf.cy },
      attachmentTarget: mf.floraType === "moss" ? "root" : "terrain",
      isEarned: false,
      sourceEvent: null,
      appearanceOrigin: "stage_structure",
      mappingType: "continuous_structural",
      scenicRegion: "wildflower_meadow",
      isExpanded: true,
      position: { x: mf.cx, y: mf.cy },
    };
    addNode(mfNode, mf.id);
  }

  // ----------------------------------------------------
  // 6. HABITAT DETAILS & WILDLIFE
  // ----------------------------------------------------
  const habitatRootId = "habitat-root";
  const habitatRootNode: GardenNode = {
    id: habitatRootId,
    role: "habitat_detail",
    creatureKind: "butterfly",
    parentId: rootNodeId,
    childIds: [],
    depthLayer: 60,
    localTransform: createDefaultTransform(400, 200),
    worldBounds,
    anchorPoint: { x: 400, y: 200 },
    isEarned: false,
    sourceEvent: null,
    appearanceOrigin: "stage_structure",
    mappingType: "continuous_structural",
    position: { x: 400, y: 200 },
    scale: 1,
  };
  addNode(habitatRootNode, habitatRootId);

  if (scene.habitatDetails) {
    scene.habitatDetails.forEach((hd, idx) => {
      const radius = 14 * (hd.scale || 1);
      const hb: BoundingBox2D = {
        minX: hd.cx - radius,
        minY: hd.cy - radius,
        maxX: hd.cx + radius,
        maxY: hd.cy + radius,
        width: radius * 2,
        height: radius * 2,
      };
      const match = matchEarnedEvent(hd.id, "habitat_detail", idx);

      const hNode: GardenNode = {
        id: match.canonicalId,
        legacyFeatureId: match.legacyFeatureId,
        earnedGroupKey: match.earnedGroupKey,
        role: "habitat_detail",
        creatureKind: hd.kind,
        semanticKey: match.semanticKey,
        parentId: habitatRootId,
        childIds: [],
        depthLayer: 60,
        localTransform: createDefaultTransform(hd.cx, hd.cy),
        worldBounds: hb,
        anchorPoint: { x: hd.cx, y: hd.cy },
        isEarned: match.isEarned,
        sourceEvent: match.sourceEvent,
        sourceMemory: match.sourceMemory,
        appearanceOrigin: match.isEarned ? "source_event" : "stage_structure",
        mappingType: "continuous_structural",
        position: { x: hd.cx, y: hd.cy },
        scale: hd.scale || 1,
        primaryColor: hd.primaryColor,
      };
      addNode(hNode, hd.id);
    });
  }

  // Resting Creature
  if (scene.restingCreature) {
    const rc = scene.restingCreature;
    const rcb: BoundingBox2D = {
      minX: rc.cx - 16,
      minY: rc.cy - 16,
      maxX: rc.cx + 16,
      maxY: rc.cy + 16,
      width: 32,
      height: 32,
    };
    const rcId = "resting-creature";
    const rcNode: GardenNode = {
      id: rcId,
      role: "habitat_detail",
      creatureKind: rc.type,
      parentId: habitatRootId,
      childIds: [],
      depthLayer: 65,
      localTransform: createDefaultTransform(rc.cx, rc.cy),
      worldBounds: rcb,
      anchorPoint: { x: rc.cx, y: rc.cy },
      isEarned: false,
      sourceEvent: null,
      appearanceOrigin: "stage_structure",
      mappingType: "continuous_structural",
      position: { x: rc.cx, y: rc.cy },
      scale: 1,
    };
    addNode(rcNode, rcId);
  }

  // ----------------------------------------------------
  // 6B. LIVING ECOSYSTEM INTEGRATION (SECTION 15)
  // ----------------------------------------------------
  const rawHabitats = deriveHabitatsFromBotanicalWorld(
    scene.stage.key,
    input.totalGrowthUnits,
    trunkAnchor,
    { x: 400, y: 180 },
    { x: 400, y: 440 }
  );

  const ecosystem = evaluateEcosystemState(
    input.totalGrowthUnits,
    coupleSeed,
    evaluatedAt,
    rawHabitats,
    isResting
  );

  // Register habitat nodes
  for (const h of Object.values(ecosystem.habitats)) {
    if (h.sourceEvent === undefined) (h as any).sourceEvent = null;
    addNode(h, h.id);
  }

  // Register creature nodes
  for (const c of Object.values(ecosystem.creatures)) {
    if (c.sourceEvent === undefined) (c as any).sourceEvent = null;
    addNode(c, c.id);
  }

  // ----------------------------------------------------
  // 7. HIERARCHY VALIDATION
  // ----------------------------------------------------
  validateAcyclicHierarchy(nodes, rootNodeId);

  // Statistics: count unique canonical nodes
  const allNodes = Object.values(nodes);
  // Filter out any legacy alias duplicates if they point to the same object
  const uniqueNodes = Array.from(new Set(allNodes));
  const earnedNodeCount = uniqueNodes.filter((n) => n.isEarned).length;
  const decorativeNodeCount = uniqueNodes.length - earnedNodeCount;

  // ----------------------------------------------------
  // 8. SCENIC EXPLORATION REGIONS
  // ----------------------------------------------------
  const scenicRegionBounds: Partial<Record<ScenicRegion, BoundingBox2D>> = {};
  for (const node of uniqueNodes) {
    if (node.scenicRegion && node.worldBounds && node.worldBounds.width > 0 && node.worldBounds.height > 0) {
      if (!scenicRegionBounds[node.scenicRegion]) {
        scenicRegionBounds[node.scenicRegion] = { ...node.worldBounds };
      } else {
        scenicRegionBounds[node.scenicRegion] = mergeBounds([
          scenicRegionBounds[node.scenicRegion]!,
          node.worldBounds,
        ]);
      }
    }
  }

  const allScenicKeys: ScenicRegion[] = [
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

  const defaultScenicRegions: Record<ScenicRegion, BoundingBox2D> = {
    crown: { minX: 250, minY: 50, maxX: 550, maxY: 220, width: 300, height: 170 },
    left_canopy: { minX: 120, minY: 140, maxX: 380, maxY: 340, width: 260, height: 200 },
    right_canopy: { minX: 420, minY: 130, maxX: 680, maxY: 330, width: 260, height: 200 },
    trunk: { minX: 340, minY: 220, maxX: 460, maxY: 440, width: 120, height: 220 },
    root_grove: { minX: 280, minY: 400, maxX: 520, maxY: 470, width: 240, height: 70 },
    wildflower_meadow: { minX: 40, minY: 360, maxX: 760, maxY: 490, width: 720, height: 130 },
    stone_landmark_area: { minX: 450, minY: 410, maxX: 650, maxY: 480, width: 200, height: 70 },
    stream_edge: { minX: 480, minY: 370, maxX: 800, maxY: 500, width: 320, height: 130 },
    atmosphere: { minX: 0, minY: 0, maxX: 800, maxY: 320, width: 800, height: 320 },
  };

  const scenicRegions: Record<ScenicRegion, BoundingBox2D> = {} as any;
  for (const key of allScenicKeys) {
    scenicRegions[key] = scenicRegionBounds[key]
      ? mergeBounds([scenicRegionBounds[key]!, defaultScenicRegions[key]])
      : defaultScenicRegions[key];
  }

  return {
    schemaVersion: GARDEN_WORLD_SCHEMA_VERSION,
    generatorVersion: GARDEN_GENERATOR_VERSION,
    assetSetVersion: GARDEN_ASSET_SET_VERSION,
    coupleSeed,
    seedString,
    stage: scene.stage,
    evaluatedAt,
    totalGrowthUnits: input.totalGrowthUnits,
    careGrowthUnits: input.careGrowthUnits,
    timeGrowthUnits: input.timeGrowthUnits,
    isResting,
    effectiveTheme,
    careSignals: input.careSignals || {
      positiveMoments: 0,
      reconnections: 0,
      importantDates: 0,
    },
    rootNodeId,
    nodes,
    renderIdToNodeIds,
    earnedFeatureGroups,
    ecosystem,
    canonicalBounds,
    worldBounds,
    scenicRegions,
    metadata: {
      totalNodes: uniqueNodes.length,
      earnedNodeCount,
      decorativeNodeCount,
      habitatNodeCount: Object.keys(ecosystem.habitats).length,
      creatureNodeCount: Object.keys(ecosystem.creatures).length,
      stageMappingGaps,
    },
  };
}
