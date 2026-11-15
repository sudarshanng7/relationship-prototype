/**
 * Purple Garden - Production Renderer Configuration & Feature Flag Contract
 *
 * Provides a local, typed feature flag contract for painterly rendering:
 * - "procedural": forces classic procedural SVG rendering across all stages
 * - "painterly_when_eligible": permits verified painterly assets when eligible
 *   (i.e. woodland backplate across all stages, with painterly-oak-structure-mature-v1
 *   strictly for garden_in_bloom) and falls back safely to honest procedural tree
 *   structure for earlier stages or missing assets.
 *
 * Invariants:
 * - Default mode is "painterly_when_eligible".
 * - Never substitutes a later-stage painterly structure for an earlier stage.
 * - Never throws or shows an empty garden if an asset is unavailable.
 */

import {
  type CanonicalStageKeyOrBeginning,
  getEligiblePainterlyAssetForStage,
  isPainterlyAvailableForStage,
  resolveCanonicalStageKey,
  resolveMvpFoundationMemoryMarkers,
  resolveMvpFoundationUnits,
} from "./stage-contracts";
import type { GardenCareEvent } from "../garden-generator";
import type {
  BotanicalAttachmentTarget,
  BoundingBox2D,
  EarnedFeatureGroup,
  GardenAtmosphereTone,
  GardenNode,
  GardenStructuralPresentation,
  GardenWorld,
  Point2D,
  GardenRendererMode,
  ResolveTreeStructurePlanInput,
  TreeStructurePlan,
  TreeCompositionPresetName,
} from "./world-types";
import {
  STAGE_STRUCTURAL_ASSET_SLOTS,
  TREE_COMPOSITION_PRESETS,
  adaptCanonicalAnchorToPainterly,
} from "./asset-manifest";
import type { PainterlyCoupleDNA } from "./couple-dna";

export type { GardenRendererMode, BotanicalAttachmentTarget } from "./world-types";

export const DEFAULT_GARDEN_RENDERER_MODE: GardenRendererMode =
  "painterly_when_eligible";

let activeRendererMode: GardenRendererMode = DEFAULT_GARDEN_RENDERER_MODE;

export function getGardenRendererMode(): GardenRendererMode {
  return activeRendererMode;
}

export function setGardenRendererMode(mode: GardenRendererMode): void {
  activeRendererMode = mode;
}

export function resetGardenRendererMode(): void {
  activeRendererMode = DEFAULT_GARDEN_RENDERER_MODE;
}

export interface GardenRenderPlan {
  mode: GardenRendererMode;
  stageKey: CanonicalStageKeyOrBeginning;
  environmentRenderer: "procedural" | "painterly_backplate";
  structureRenderer: "procedural" | "painterly_asset";
  environmentAssetKey: string | null;
  structureAssetKey: string | null;
  fallbackReason: string | null;
  supportsExplore: boolean;
  supportsCompact: boolean;
  supportsStory: boolean;
}

export interface ResolveActiveRendererInput {
  stageKey: CanonicalStageKeyOrBeginning;
  rendererMode?: GardenRendererMode;
  availableAssets?: readonly string[];
  allowDevelopmentPreview?: boolean;
}

export interface ActiveRendererDecision {
  renderer: "painterly" | "procedural";
  assetKey: string | null;
  reason: string;
  isFallback: boolean;
}

/**
 * Pure structural plan resolver:
 * - Selected asset or null
 * - Painterly asset or procedural fallback
 * - Fallback reason (e.g. dedicated_branching_out_painterly_structure_unavailable)
 * - Crop preset
 * - Soil baseline (441.0)
 * - Calibration transform
 * - Supported full/compact/Explore/Story modes
 *
 * Strict Invariants:
 * 1. Only select an asset when fileExists === true, status === "approved", and exact stage is eligible.
 * 2. Never silently substitute a later-stage asset.
 * 3. Never alters growth units, Garden stage, event qualification, event IDs, source mappings, or Story order.
 */
export function resolveTreeStructurePlan(
  input: ResolveTreeStructurePlanInput
): TreeStructurePlan {
  const stageKey = input.stageKey;
  const rendererMode = input.rendererMode ?? getGardenRendererMode();
  const presentationMode = input.presentationMode ?? "full";
  const registry = input.assetRegistry ?? STAGE_STRUCTURAL_ASSET_SLOTS;
  const slot = registry[stageKey];

  // Pure crop preset selection based on presentation mode (canonical default is middle_distance)
  const cropPreset: TreeCompositionPresetName =
    input.cropPreset ?? "middle_distance";

  const soilBaseline = slot?.soilBaseline ?? 441.0;

  const calibrationTransform = {
    scale: 1.0,
    translateX: 0,
    translateY: 0,
    rotation: 0,
  };

  const supportedModes = {
    full: true,
    compact: true,
    explore: true,
    story: true,
  };

  if (rendererMode === "procedural") {
    return {
      stageKey,
      selectedAssetKey: null,
      selectedAsset: null,
      structureRenderer: "procedural",
      isFallback: true,
      fallbackReason: "procedural_mode_requested",
      cropPreset,
      soilBaseline,
      baselineY: soilBaseline,
      calibrationTransform,
      supportedModes,
    };
  }

  const isDev =
    input.allowDevelopmentPreview ??
    (typeof __DEV__ !== "undefined" ? Boolean(__DEV__) : false);

  // Check if availableAssets manifest explicitly excludes the asset
  const isAvailableInManifest =
    !input.availableAssets ||
    (slot &&
      (input.availableAssets.includes(slot.assetKey) ||
        (slot.assetKey === "painterly-oak-structure-mature-v1" &&
          input.availableAssets.includes("painterly-oak-mature-v1")) ||
        (slot.assetKey === "painterly-oak-branching-v1" &&
          (input.availableAssets.includes("painterly-oak-branching-v1") ||
            input.availableAssets.includes("painterly-oak-structure-branching-v1")))));

  if (slot && !isAvailableInManifest) {
    return {
      stageKey,
      selectedAssetKey: null,
      selectedAsset: null,
      structureRenderer: "procedural",
      isFallback: true,
      fallbackReason:
        stageKey === "garden_in_bloom"
          ? "mature_structure_asset_missing"
          : `dedicated_${stageKey}_painterly_structure_unavailable`,
      cropPreset,
      soilBaseline,
      baselineY: soilBaseline,
      calibrationTransform,
      supportedModes,
    };
  }

  // Strict approval & eligibility check:
  // Must satisfy:
  // - file exists (fileExists === true and filePath !== null)
  // - status is approved (status === "approved" || approvalStatus === "approved")
  //   OR in development preview mode (status === "development_preview" || approvalStatus === "development_preview")
  // - exact stage is eligible (slot.eligibleStage === stageKey)
  // NEVER silently substitute a later-stage asset!
  const isApproved =
    slot && (slot.status === "approved" || slot.approvalStatus === "approved");
  const isDevPreview =
    slot &&
    isDev &&
    (slot.status === "development_preview" ||
      slot.approvalStatus === "development_preview");

  const isEligible =
    slot &&
    slot.fileExists === true &&
    slot.filePath !== null &&
    (isApproved || isDevPreview) &&
    slot.eligibleStage === stageKey;

  if (isEligible) {
    return {
      stageKey,
      selectedAssetKey: slot.assetKey,
      selectedAsset: slot,
      structureRenderer: "painterly_asset",
      isFallback: false,
      fallbackReason: null,
      cropPreset,
      soilBaseline,
      baselineY: soilBaseline,
      calibrationTransform: slot.calibrationTransform
        ? {
            scale: slot.calibrationTransform.scale,
            translateX: slot.calibrationTransform.translateX,
            translateY: slot.calibrationTransform.translateY,
            rotation: slot.calibrationTransform.rotation ?? 0,
          }
        : calibrationTransform,
      supportedModes,
    };
  }

  // Fallback reason for unapproved/missing assets
  const fallbackReason =
    stageKey === "branching_out"
      ? "dedicated_branching_out_painterly_structure_unavailable"
      : `dedicated_${stageKey}_painterly_structure_unavailable`;

  return {
    stageKey,
    selectedAssetKey: null,
    selectedAsset: null,
    structureRenderer: "procedural",
    isFallback: true,
    fallbackReason,
    cropPreset,
    soilBaseline,
    baselineY: soilBaseline,
    calibrationTransform,
    supportedModes,
  };
}

/**
 * Deterministically resolves the comprehensive 2-layer GardenRenderPlan:
 * - environmentRenderer: "painterly_backplate" (woodland backplate) or "procedural"
 * - structureRenderer: "painterly_asset" (mature oak) or "procedural" (honest young structure)
 */
export function resolveGardenRenderPlan(input: {
  stageKey: CanonicalStageKeyOrBeginning;
  rendererMode?: GardenRendererMode;
  availableAssets?: readonly string[];
  presentationMode?: "full" | "compact" | "explore" | "story";
  assetRegistry?: Record<CanonicalStageKeyOrBeginning, any>;
  allowDevelopmentPreview?: boolean;
}): GardenRenderPlan {
  const treePlan = resolveTreeStructurePlan({
    stageKey: input.stageKey,
    rendererMode: input.rendererMode,
    availableAssets: input.availableAssets,
    presentationMode: input.presentationMode,
    assetRegistry: input.assetRegistry,
    allowDevelopmentPreview: input.allowDevelopmentPreview,
  });

  const mode = input.rendererMode ?? getGardenRendererMode();
  const environmentRenderer =
    mode === "procedural" ? "procedural" : "painterly_backplate";
  const environmentAssetKey =
    mode === "procedural" ? null : "woodland-backplate-light-v1";

  return {
    mode,
    stageKey: input.stageKey,
    environmentRenderer,
    structureRenderer: treePlan.structureRenderer,
    environmentAssetKey,
    structureAssetKey: treePlan.selectedAssetKey,
    fallbackReason: treePlan.fallbackReason,
    supportsExplore: treePlan.supportedModes.explore,
    supportsCompact: treePlan.supportedModes.compact,
    supportsStory: treePlan.supportedModes.story,
  };
}

/**
 * Backward-compatible resolver reflecting structure eligibility.
 */
export function resolveActiveRenderer(
  input: ResolveActiveRendererInput
): ActiveRendererDecision {
  const plan = resolveGardenRenderPlan({
    stageKey: input.stageKey,
    rendererMode: input.rendererMode,
    availableAssets: input.availableAssets,
  });

  return {
    renderer: plan.structureRenderer === "painterly_asset" ? "painterly" : "procedural",
    assetKey: plan.structureAssetKey,
    reason: plan.fallbackReason ?? "Verified painterly asset available",
    isFallback: plan.structureRenderer === "procedural" && plan.mode !== "procedural",
  };
}

export interface TreePresentationTransform {
  scale: number;
  finalScale: number;
  totalScale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  pivotX: number;
  pivotY: number;
  dnaVerticalShift: number;
  dnaScaleMultiplier: number;
}

export function resolveTreePresentationTransform(options?: {
  cropPreset?: TreeCompositionPresetName;
  calibrationTransform?: {
    x?: number;
    y?: number;
    scale?: number;
    rotation?: number;
  };
  coupleDNA?: PainterlyCoupleDNA;
}): TreePresentationTransform {
  const activePreset =
    TREE_COMPOSITION_PRESETS[options?.cropPreset || "middle_distance"] ||
    TREE_COMPOSITION_PRESETS.middle_distance;

  const baseScale = activePreset.scale;
  const userScale = options?.calibrationTransform?.scale ?? 1.0;
  const finalScale = baseScale * userScale;

  const pivotX = activePreset.centerOrigin.x; // 390.4
  const pivotY = activePreset.centerOrigin.y; // 441.0

  const dnaScaleMultiplier =
    options?.coupleDNA?.structuralVariation?.scaleMultiplier ?? 1.0;
  const dnaVerticalShift =
    options?.coupleDNA?.structuralVariation?.verticalShiftPx ?? 0;
  const totalScale = finalScale * dnaScaleMultiplier;

  const offsetX =
    (options?.calibrationTransform?.x ?? 0) + (1 - finalScale) * pivotX;
  const offsetY =
    (options?.calibrationTransform?.y ?? 0) +
    (1 - finalScale) * pivotY +
    dnaVerticalShift;
  const rotation = options?.calibrationTransform?.rotation ?? 0;

  return {
    scale: baseScale,
    finalScale,
    totalScale,
    offsetX,
    offsetY,
    rotation,
    pivotX,
    pivotY,
    dnaVerticalShift,
    dnaScaleMultiplier,
  };
}

export interface ResolvedFeaturePresentation {
  x: number;
  y: number;
  scale: number;
  dx: number;
  dy: number;
  isCanopyAttached: boolean;
  isGroundAttached: boolean;
  isRootAttached: boolean;
}

export interface ResolveFeaturePresentationGeometryInput {
  canonicalPoint: Point2D;
  role:
    | "blossom"
    | "foliage_shoot"
    | "landmark"
    | "creature"
    | "ground_flora"
    | "root_flora"
    | string;
  stageKey: CanonicalStageKeyOrBeginning;
  structuralAssetKey?: string | null;
  cropPreset?: TreeCompositionPresetName;
  calibrationTransform?: {
    x?: number;
    y?: number;
    scale?: number;
    rotation?: number;
  };
  coupleDNA?: PainterlyCoupleDNA;
  attachmentTarget?: BotanicalAttachmentTarget;
  variant?: string | null;
  scenicRegion?: string | null;
}

export function resolveFeaturePresentationGeometry(
  input: ResolveFeaturePresentationGeometryInput
): ResolvedFeaturePresentation {
  const {
    canonicalPoint,
    role,
    stageKey,
    structuralAssetKey,
    cropPreset,
    calibrationTransform,
    coupleDNA,
    attachmentTarget,
    variant,
    scenicRegion,
  } = input;
  const transform = resolveTreePresentationTransform({
    cropPreset,
    calibrationTransform,
    coupleDNA,
  });

  // 1. Explicit semantic classification deriving attachment from botanical metadata
  let target: BotanicalAttachmentTarget = "canopy";

  if (attachmentTarget) {
    target = attachmentTarget;
  } else if (variant === "moss_cushion" || role === "root" || role === "root_flora") {
    target = "root";
  } else if (
    role === "landmark" ||
    role === "ground_flora" ||
    role === "terrain_region" ||
    (variant &&
      [
        "fern_frond",
        "meadow_flower",
        "clover_cover",
        "seed_head",
        "sprout",
        "flowering_herb",
      ].includes(variant))
  ) {
    target = "terrain";
  } else if (
    role === "blossom" ||
    role === "bud_blossom_fruit" ||
    role === "foliage_shoot" ||
    role === "foliage" ||
    role === "branch" ||
    role === "trunk" ||
    (variant &&
      [
        "single_leaf",
        "paired_leaf_shoot",
        "twig_shoot",
        "upward_shoot",
        "closed_bud",
        "paired_buds",
        "flowering_shoot",
        "berry_cluster",
        "fruit_bud",
        "restrained_pod",
        "bird_perch",
        "nest_material",
      ].includes(variant))
  ) {
    target = "canopy";
  } else if (scenicRegion === "root_grove") {
    target = "root";
  } else if (
    scenicRegion === "wildflower_meadow" ||
    scenicRegion === "stone_landmark_area" ||
    scenicRegion === "stream_edge"
  ) {
    target = "terrain";
  } else if (
    scenicRegion === "crown" ||
    scenicRegion === "left_canopy" ||
    scenicRegion === "right_canopy" ||
    scenicRegion === "trunk"
  ) {
    target = "canopy";
  } else {
    // Ultimate fallback for custom unknown roles with zero metadata
    target = canonicalPoint.y >= 435 ? "terrain" : "canopy";
  }

  // 2. Terrain geometry: sits in the clearing/meadow, unaffected by tree scaling
  if (target === "terrain") {
    return {
      x: canonicalPoint.x,
      y: canonicalPoint.y,
      scale: 1.0,
      dx: 0,
      dy: 0,
      isCanopyAttached: false,
      isGroundAttached: true,
      isRootAttached: false,
    };
  }

  // 3. Root geometry: nestles in buttress roots, tracks root origin & DNA vertical shift
  if (target === "root") {
    return {
      x: canonicalPoint.x,
      y: canonicalPoint.y + transform.dnaVerticalShift,
      scale: 1.0,
      dx: 0,
      dy: transform.dnaVerticalShift,
      isCanopyAttached: false,
      isGroundAttached: false,
      isRootAttached: true,
    };
  }

  // 4. Canopy geometry: attached to structural wood, scales and rotates in lockstep with tree
  let basePoint = { ...canonicalPoint };
  if (
    stageKey === "garden_in_bloom" &&
    (structuralAssetKey === "painterly-oak-mature-v1" ||
      structuralAssetKey === "painterly-oak-structure-mature-v1")
  ) {
    basePoint = adaptCanonicalAnchorToPainterly({
      assetKey: structuralAssetKey,
      stageKey: "garden_in_bloom",
      canonicalAnchor: canonicalPoint,
      role,
    });
  } else if (
    stageKey === "branching_out" &&
    (structuralAssetKey === "painterly-oak-branching-v1" ||
      structuralAssetKey === "painterly-oak-structure-branching-v1")
  ) {
    basePoint = adaptCanonicalAnchorToPainterly({
      assetKey: structuralAssetKey,
      stageKey: "branching_out",
      canonicalAnchor: canonicalPoint,
      role,
    });
  }

  // Apply active structural presentation transform
  const resolvedX =
    Math.round((transform.offsetX + basePoint.x * transform.totalScale) * 10) /
    10;
  const resolvedY =
    Math.round((transform.offsetY + basePoint.y * transform.totalScale) * 10) /
    10;

  return {
    x: resolvedX,
    y: resolvedY,
    scale: transform.totalScale,
    dx: resolvedX - canonicalPoint.x,
    dy: resolvedY - canonicalPoint.y,
    isCanopyAttached: true,
    isGroundAttached: false,
    isRootAttached: false,
  };
}

/**
 * Resolves a GardenWorld by projecting every node's worldBounds and anchorPoint
 * into the resolved presentation geometry of the active structure.
 */
export function resolveGardenWorldPresentation(
  world: GardenWorld,
  options?: {
    cropPreset?: TreeCompositionPresetName;
    calibrationTransform?: {
      x?: number;
      y?: number;
      scale?: number;
      rotation?: number;
    };
    coupleDNA?: PainterlyCoupleDNA;
    stageKey?: CanonicalStageKeyOrBeginning;
    structuralAssetKey?: string | null;
    mvpFoundationMemories?: boolean;
  }
): GardenWorld {
  if (!world || !world.nodes) return world;

  const stageKey =
    options?.stageKey ||
    (world.totalGrowthUnits !== undefined
      ? resolveCanonicalStageKey(
          world.totalGrowthUnits,
          world.careGrowthUnits ?? 0
        )
      : "branching_out");

  const resolvedNodes: Record<string, GardenNode> = {};

  for (const [nodeId, node] of Object.entries(world.nodes)) {
    const role =
      node.role === "bud_blossom_fruit"
        ? "blossom"
        : node.role === "foliage"
        ? "foliage_shoot"
        : node.role === "landmark"
        ? "landmark"
        : node.role === "ground_flora"
        ? "ground_flora"
        : node.role === "creature_node"
        ? "creature"
        : node.role;

    const anchor = node.anchorPoint || {
      x: (node.worldBounds.minX + node.worldBounds.maxX) / 2,
      y: (node.worldBounds.minY + node.worldBounds.maxY) / 2,
    };

    const geom = resolveFeaturePresentationGeometry({
      canonicalPoint: anchor,
      role,
      stageKey,
      structuralAssetKey: options?.structuralAssetKey,
      cropPreset: options?.cropPreset,
      calibrationTransform: options?.calibrationTransform,
      coupleDNA: options?.coupleDNA,
      variant: (node as any).variant,
      scenicRegion: node.scenicRegion,
      attachmentTarget: node.attachmentTarget,
    });

    if (geom.dx === 0 && geom.dy === 0 && geom.scale === 1.0) {
      resolvedNodes[nodeId] = {
        ...node,
        isCanopyAttached: geom.isCanopyAttached,
        isGroundAttached: geom.isGroundAttached,
        isRootAttached: geom.isRootAttached,
      };
      continue;
    }

    const halfW = (node.worldBounds.width / 2) * geom.scale;
    const halfH = (node.worldBounds.height / 2) * geom.scale;

    const updatedNode = {
      ...node,
      anchorPoint: { x: geom.x, y: geom.y },
      worldBounds: {
        minX: Math.round((geom.x - halfW) * 10) / 10,
        minY: Math.round((geom.y - halfH) * 10) / 10,
        maxX: Math.round((geom.x + halfW) * 10) / 10,
        maxY: Math.round((geom.y + halfH) * 10) / 10,
        width: Math.round(halfW * 2 * 10) / 10,
        height: Math.round(halfH * 2 * 10) / 10,
      },
      isCanopyAttached: geom.isCanopyAttached,
      isGroundAttached: geom.isGroundAttached,
      isRootAttached: geom.isRootAttached,
    } as any;

    if (node.role === "bud_blossom_fruit") {
      updatedNode.center = { x: geom.x, y: geom.y };
      if (node.radius) {
        updatedNode.radius = node.radius * geom.scale;
      }
    } else if (node.role === "creature_node") {
      updatedNode.restingAnchor = { x: geom.x, y: geom.y };
    }

    resolvedNodes[nodeId] = updatedNode as GardenNode;
  }

  const resolvedGroups: Record<string, EarnedFeatureGroup> = {};
  if (options?.mvpFoundationMemories && world.earnedFeatureGroups) {
    const markerEvents: GardenCareEvent[] = Object.values(
      world.earnedFeatureGroups
    ).map((group) => ({
      id: group.sourceEvent.id,
      kind: group.sourceEvent.kind,
      occurredAt: group.sourceEvent.authoritativeTimestamp || "",
      createdAt: group.sourceEvent.authoritativeTimestamp || null,
    }));
    const markers = resolveMvpFoundationMemoryMarkers(
      markerEvents,
      world.seedString,
      resolveMvpFoundationUnits(
        world.totalGrowthUnits,
        world.careGrowthUnits,
        world.timeGrowthUnits
      )
    );

    for (const marker of markers) {
      const group = world.earnedFeatureGroups[marker.semanticKey];
      const primaryId = group?.nodeIds[0];
      const primaryNode = primaryId ? resolvedNodes[primaryId] : null;
      if (!group || !primaryId || !primaryNode) continue;

      const isSaplingLeaf = marker.visualKind === "sapling_leaf";
      const boundsWidth = isSaplingLeaf ? 5.2 : 9.0;
      const boundsHeight = isSaplingLeaf ? 4.8 : 7.0;
      const halfW = boundsWidth / 2;

      resolvedNodes[primaryId] = {
        ...primaryNode,
        anchorPoint: { x: marker.x, y: marker.y },
        worldBounds: {
          minX: marker.x - halfW,
          minY: isSaplingLeaf ? marker.y - 4.8 : marker.y - 3.5,
          maxX: marker.x + halfW,
          maxY: isSaplingLeaf ? marker.y + 0.5 : marker.y + 3.5,
          width: boundsWidth,
          height: boundsHeight,
        },
        attachmentTarget: marker.attachment === "tree" ? "canopy" : "terrain",
        scenicRegion: marker.attachment === "tree" ? "crown" : "root_grove",
        isCanopyAttached: marker.attachment === "tree",
        isGroundAttached: marker.attachment === "ground",
        isRootAttached: false,
        mvpMemoryVisualKind: marker.visualKind,
      };
    }
  }

  if (world.earnedFeatureGroups) {
    for (const [key, group] of Object.entries(world.earnedFeatureGroups)) {
      const primaryNode = resolvedNodes[group.nodeIds[0]];
      if (primaryNode) {
        resolvedGroups[key] = {
          ...group,
          anchor: { ...primaryNode.anchorPoint },
          bounds: { ...primaryNode.worldBounds },
        };
      } else {
        resolvedGroups[key] = group;
      }
    }
  }

  return {
    ...world,
    nodes: resolvedNodes,
    earnedFeatureGroups: resolvedGroups,
  };
}

export const DEFAULT_ATMOSPHERE_TONE: GardenAtmosphereTone = "calm_light";

/**
 * Resolves the typed calm visual presentation parameters for the living tree and atmosphere.
 * Pure visual transformation: strictly preserves world bounds, growth units, node IDs, and source mappings.
 */
export function getGardenStructuralPresentation(
  tone: GardenAtmosphereTone = "calm_light",
  stageKey: CanonicalStageKeyOrBeginning = "branching_out",
  effectiveTheme?: string
): GardenStructuralPresentation {
  let base: GardenStructuralPresentation;

  switch (stageKey) {
    case "beginning":
      base = {
        structureOpacity: 1.0,
        structureScale: 0.8,
        canopyVisualDensity: 0.0,
        foliageOpacity: 0.0,
        barkContrast: 0.78,
        atmosphericVeilOpacity: 0.06,
        edgeVignetteOpacity: 0.1,
        groundSeparationOpacity: 0.15,
        earnedFeatureEmphasis: 1.0,
      };
      break;
    case "first_seedling":
      base = {
        structureOpacity: 1.0,
        structureScale: 0.82,
        canopyVisualDensity: 0.1,
        foliageOpacity: 0.85,
        barkContrast: 0.78,
        atmosphericVeilOpacity: 0.06,
        edgeVignetteOpacity: 0.1,
        groundSeparationOpacity: 0.15,
        earnedFeatureEmphasis: 1.05,
      };
      break;
    case "tender_sapling":
      base = {
        structureOpacity: 1.0,
        structureScale: 0.85,
        canopyVisualDensity: 0.25,
        foliageOpacity: 0.85,
        barkContrast: 0.76,
        atmosphericVeilOpacity: 0.08,
        edgeVignetteOpacity: 0.12,
        groundSeparationOpacity: 0.18,
        earnedFeatureEmphasis: 1.1,
      };
      break;
    case "branching_out":
      base = {
        structureOpacity: 1.0,
        structureScale: 0.86,
        canopyVisualDensity: 0.35,
        foliageOpacity: 0.85,
        barkContrast: 0.74,
        atmosphericVeilOpacity: 0.08,
        edgeVignetteOpacity: 0.12,
        groundSeparationOpacity: 0.2,
        earnedFeatureEmphasis: 1.15,
      };
      break;
    case "leafy_canopy":
      base = {
        structureOpacity: 1.0,
        structureScale: 0.9,
        canopyVisualDensity: 0.65,
        foliageOpacity: 0.9,
        barkContrast: 0.78,
        atmosphericVeilOpacity: 0.09,
        edgeVignetteOpacity: 0.14,
        groundSeparationOpacity: 0.22,
        earnedFeatureEmphasis: 1.15,
      };
      break;
    case "rooted_flourishing":
      base = {
        structureOpacity: 1.0,
        structureScale: 0.92,
        canopyVisualDensity: 0.78,
        foliageOpacity: 0.92,
        barkContrast: 0.8,
        atmosphericVeilOpacity: 0.1,
        edgeVignetteOpacity: 0.15,
        groundSeparationOpacity: 0.24,
        earnedFeatureEmphasis: 1.15,
      };
      break;
    case "garden_in_bloom":
    default:
      base = {
        structureOpacity: 1.0,
        structureScale: 0.92,
        canopyVisualDensity: 0.8,
        foliageOpacity: 0.95,
        barkContrast: 0.8,
        atmosphericVeilOpacity: 0.1,
        edgeVignetteOpacity: 0.15,
        groundSeparationOpacity: 0.25,
        earnedFeatureEmphasis: 1.15,
      };
      break;
  }

  if (tone === "calm_dim" || effectiveTheme === "dim") {
    return {
      ...base,
      atmosphericVeilOpacity: base.atmosphericVeilOpacity + 0.04,
      barkContrast: Math.max(0.65, base.barkContrast - 0.04),
      edgeVignetteOpacity: base.edgeVignetteOpacity + 0.03,
    };
  }

  if (tone === "calm_dark" || effectiveTheme === "dark") {
    return {
      ...base,
      atmosphericVeilOpacity: base.atmosphericVeilOpacity + 0.08,
      barkContrast: Math.max(0.6, base.barkContrast - 0.08),
      edgeVignetteOpacity: base.edgeVignetteOpacity + 0.06,
    };
  }

  return base;
}
