/**
 * Purple Garden - Canonical Seven-Stage Visual Contract
 *
 * Enforces the visual progression contract across the 7 canonical stages:
 * - Quiet Beginning (zero-growth clearing)
 * - First Seedling (0 - 15 units)
 * - Tender Sapling (16 - 35 units)
 * - Branching Out (36 - 55 units)
 * - Leafy Canopy (56 - 75 units)
 * - Rooted & Flourishing (76 - 90 units)
 * - Garden in Bloom (91 - 100 units)
 *
 * Invariant: The mature ancient oak (painterly-oak-structure-mature-v1) is strictly
 * a destination asset for garden_in_bloom. It is NEVER eligible for earlier stages.
 */

import {
  type GardenCareEvent,
  type GardenStageKey,
  GARDEN_STAGES,
  getGardenStage,
} from "../garden-generator";

export type { GardenCareEvent };

export type CanonicalStageKeyOrBeginning = GardenStageKey | "beginning";

export interface StageSilhouetteExpectations {
  trunkPresence:
  | "none"
  | "slender_stem"
  | "young_trunk"
  | "established_scaffold"
  | "ancient_scaffold";
  canopyPresence:
  | "none"
  | "tender_sprout"
  | "young_foliage"
  | "airy_canopy"
  | "generous_crown"
  | "ancient_canopy";
  rootPresence:
  | "seed_glimmer"
  | "hairline_root"
  | "surface_spread"
  | "lateral_roots"
  | "deep_roots"
  | "massive_buttress";
  clearingOpenness:
  | "open_glade"
  | "dominant_clearing"
  | "balanced_space"
  | "sheltered_grove";
  description: string;
}

export interface PainterlyStageVisualContract {
  stageKey: CanonicalStageKeyOrBeginning;
  label: string;
  minUnits: number;
  maxUnits: number;
  eligibleStructuralAssetKeys: readonly string[];
  fallbackRenderer: "procedural";
  structuralSilhouetteExpectations: StageSilhouetteExpectations;
  maxTrunkCanopyOccupancy: number; // 0.0 to 1.0 fraction of scene area
  rootVisibility: string;
  branchDensityRange: [number, number];
  foliageDensityRange: [number, number];
  eligibleHabitatClasses: readonly string[];
  painterlyStructureAvailable: boolean;
  transitionCompatibility: {
    previous: CanonicalStageKeyOrBeginning | null;
    next: CanonicalStageKeyOrBeginning | null;
  };
}

export const CANONICAL_STAGE_CONTRACTS: Record<
  CanonicalStageKeyOrBeginning,
  PainterlyStageVisualContract
> = {
  beginning: {
    stageKey: "beginning",
    label: "Quiet Beginning",
    minUnits: 0,
    maxUnits: 0,
    eligibleStructuralAssetKeys: [],
    fallbackRenderer: "procedural",
    structuralSilhouetteExpectations: {
      trunkPresence: "none",
      canopyPresence: "none",
      rootPresence: "seed_glimmer",
      clearingOpenness: "open_glade",
      description:
        "Open woodland clearing and quiet soil. No trunk or mature tree. Subtle seed/root glimmer or small planted point. No earned flowers, fruit, wildlife, or landmarks unless qualified data exists.",
    },
    maxTrunkCanopyOccupancy: 0.0,
    rootVisibility: "Subtle seed glimmer or quiet planted point in soil",
    branchDensityRange: [0, 0],
    foliageDensityRange: [0, 0],
    eligibleHabitatClasses: [],
    painterlyStructureAvailable: false,
    transitionCompatibility: {
      previous: null,
      next: "first_seedling",
    },
  },
  first_seedling: {
    stageKey: "first_seedling",
    label: GARDEN_STAGES.first_seedling.label,
    minUnits: 0,
    maxUnits: 15,
    eligibleStructuralAssetKeys: [],
    fallbackRenderer: "procedural",
    structuralSilhouetteExpectations: {
      trunkPresence: "slender_stem",
      canopyPresence: "tender_sprout",
      rootPresence: "hairline_root",
      clearingOpenness: "dominant_clearing",
      description:
        "Very small central sprout/stem, one or two leaves, shallow root indication. No mature branches, fruit, or resident fauna.",
    },
    maxTrunkCanopyOccupancy: 0.05,
    rootVisibility: "Shallow hairline root indication at base",
    branchDensityRange: [0, 0],
    foliageDensityRange: [1, 2],
    eligibleHabitatClasses: [],
    painterlyStructureAvailable: false,
    transitionCompatibility: {
      previous: "beginning",
      next: "tender_sapling",
    },
  },
  tender_sapling: {
    stageKey: "tender_sapling",
    label: GARDEN_STAGES.tender_sapling.label,
    minUnits: 16,
    maxUnits: 35,
    eligibleStructuralAssetKeys: [],
    fallbackRenderer: "procedural",
    structuralSilhouetteExpectations: {
      trunkPresence: "young_trunk",
      canopyPresence: "young_foliage",
      rootPresence: "surface_spread",
      clearingOpenness: "dominant_clearing",
      description:
        "Narrow young trunk, several leaves, and early root spread. Restrained scale relative to the clearing.",
    },
    maxTrunkCanopyOccupancy: 0.15,
    rootVisibility: "Early lateral root spread into meadow soil",
    branchDensityRange: [0, 2],
    foliageDensityRange: [3, 8],
    eligibleHabitatClasses: ["micro_fauna", "pollinator"],
    painterlyStructureAvailable: false,
    transitionCompatibility: {
      previous: "first_seedling",
      next: "branching_out",
    },
  },
  branching_out: {
    stageKey: "branching_out",
    label: GARDEN_STAGES.branching_out.label,
    minUnits: 36,
    maxUnits: 55,
    eligibleStructuralAssetKeys: [],
    fallbackRenderer: "procedural",
    structuralSilhouetteExpectations: {
      trunkPresence: "young_trunk",
      canopyPresence: "airy_canopy",
      rootPresence: "lateral_roots",
      clearingOpenness: "balanced_space",
      description:
        "Visible young trunk, first meaningful scaffold branches, incomplete and airy canopy. Only qualified earned flora and fauna.",
    },
    maxTrunkCanopyOccupancy: 0.35,
    rootVisibility: "Distinct lateral roots anchoring the young trunk",
    branchDensityRange: [3, 6],
    foliageDensityRange: [8, 20],
    eligibleHabitatClasses: ["songbird", "ground_critter", "pollinator"],
    painterlyStructureAvailable: false,
    transitionCompatibility: {
      previous: "tender_sapling",
      next: "leafy_canopy",
    },
  },
  leafy_canopy: {
    stageKey: "leafy_canopy",
    label: GARDEN_STAGES.leafy_canopy.label,
    minUnits: 56,
    maxUnits: 75,
    eligibleStructuralAssetKeys: [],
    fallbackRenderer: "procedural",
    structuralSilhouetteExpectations: {
      trunkPresence: "established_scaffold",
      canopyPresence: "generous_crown",
      rootPresence: "deep_roots",
      clearingOpenness: "balanced_space",
      description:
        "Wider structure, recognizable crown, layered but not mature foliage. Additional habitat capacity.",
    },
    maxTrunkCanopyOccupancy: 0.6,
    rootVisibility: "Pronounced root flare spreading across clearing baseline",
    branchDensityRange: [6, 12],
    foliageDensityRange: [20, 45],
    eligibleHabitatClasses: [
      "songbird",
      "perched_creature",
      "ground_critter",
      "water_dweller",
      "pollinator",
    ],
    painterlyStructureAvailable: false,
    transitionCompatibility: {
      previous: "branching_out",
      next: "rooted_flourishing",
    },
  },
  rooted_flourishing: {
    stageKey: "rooted_flourishing",
    label: GARDEN_STAGES.rooted_flourishing.label,
    minUnits: 76,
    maxUnits: 90,
    eligibleStructuralAssetKeys: [],
    fallbackRenderer: "procedural",
    structuralSilhouetteExpectations: {
      trunkPresence: "established_scaffold",
      canopyPresence: "generous_crown",
      rootPresence: "deep_roots",
      clearingOpenness: "sheltered_grove",
      description:
        "Substantial roots and branches, broad canopy, richer ground ecology. Still visually distinguishable from the final ancient oak.",
    },
    maxTrunkCanopyOccupancy: 0.8,
    rootVisibility: "Deep sprawling root architecture gripping the soil",
    branchDensityRange: [10, 18],
    foliageDensityRange: [45, 80],
    eligibleHabitatClasses: [
      "canopy_dweller",
      "perched_creature",
      "burrower",
      "water_dweller",
      "pollinator",
    ],
    painterlyStructureAvailable: false,
    transitionCompatibility: {
      previous: "leafy_canopy",
      next: "garden_in_bloom",
    },
  },
  garden_in_bloom: {
    stageKey: "garden_in_bloom",
    label: GARDEN_STAGES.garden_in_bloom.label,
    minUnits: 91,
    maxUnits: 100,
    eligibleStructuralAssetKeys: ["painterly-oak-structure-mature-v1"],
    fallbackRenderer: "procedural",
    structuralSilhouetteExpectations: {
      trunkPresence: "ancient_scaffold",
      canopyPresence: "ancient_canopy",
      rootPresence: "massive_buttress",
      clearingOpenness: "sheltered_grove",
      description:
        "Mature painterly oak structure asset, accumulated deterministic foliage, blossoms, landmarks and compatible fauna. Abundant but calm, never visually overloaded.",
    },
    maxTrunkCanopyOccupancy: 1.0,
    rootVisibility: "Massive ancient root buttresses meeting meadow baseline",
    branchDensityRange: [16, 28],
    foliageDensityRange: [70, 150],
    eligibleHabitatClasses: [
      "canopy_dweller",
      "perched_creature",
      "burrower",
      "water_dweller",
      "pollinator",
    ],
    painterlyStructureAvailable: true,
    transitionCompatibility: {
      previous: "rooted_flourishing",
      next: null,
    },
  },
};

/**
 * Resolves canonical stage key or beginning state.
 */
export function resolveCanonicalStageKey(
  totalGrowthUnits: number,
  careEventsCount = 0
): CanonicalStageKeyOrBeginning {
  if (totalGrowthUnits === 0 && careEventsCount === 0) {
    return "beginning";
  }
  return getGardenStage(totalGrowthUnits).key;
}

/**
 * Retrieves the visual contract for a given stage.
 */
export function getPainterlyStageVisualContract(
  stageKey: CanonicalStageKeyOrBeginning
): PainterlyStageVisualContract {
  return CANONICAL_STAGE_CONTRACTS[stageKey] || CANONICAL_STAGE_CONTRACTS.first_seedling;
}

/**
 * Checks if a verified painterly structural asset is available for the given stage.
 */
export function isPainterlyAvailableForStage(
  stageKey: CanonicalStageKeyOrBeginning
): boolean {
  return CANONICAL_STAGE_CONTRACTS[stageKey]?.painterlyStructureAvailable === true;
}

/**
 * Returns the eligible painterly structural asset key for the stage, or null if none exists.
 */
export function getEligiblePainterlyAssetForStage(
  stageKey: CanonicalStageKeyOrBeginning
): string | null {
  const contract = CANONICAL_STAGE_CONTRACTS[stageKey];
  if (!contract || !contract.painterlyStructureAvailable) return null;
  return contract.eligibleStructuralAssetKeys[0] || null;
}

/**
 * Verifies stage transition compatibility between two stages.
 */
export function validateStageTransition(
  from: CanonicalStageKeyOrBeginning,
  to: CanonicalStageKeyOrBeginning
): boolean {
  if (from === to) return true;
  const fromContract = CANONICAL_STAGE_CONTRACTS[from];
  if (!fromContract) return false;
  return fromContract.transitionCompatibility.next === to;
}

/**
 * Bounded Early-Life Visual Subphases.
 *
 * Establishes the visual subphase contracts reconciling future painterly early-life artwork
 * with existing canonical production stages (beginning, first_seedling, tender_sapling).
 *
 * Invariants:
 * - Does NOT introduce new production growth thresholds (growth ranges remain 0, 0-15, 16-35).
 * - Soil baseline remains fixed at y = 441.0; trunk center remains fixed at x = 390.4.
 * - Natural first leaves (cotyledons/seedling leaves) have sourceEvent = null (zero memory source).
 * - Earned features are independently tracked and clearly distinguished from baseline flora.
 */
export type EarlyLifeSubphaseKey =
  | "planted_acorn"
  | "emerging_shoot"
  | "small_seedling"
  | "small_sapling";

export interface EarlyLifeSubphaseContract {
  subphaseKey: EarlyLifeSubphaseKey;
  label: string;
  reconciledCanonicalStage: CanonicalStageKeyOrBeginning;
  targetAssetKey: string;
  targetFilename: string;
  soilBaseline: number;
  rootOrigin: { x: number; y: number };
  naturalFoliageHasMemorySource: false;
  eligibleEarnedRoles: readonly string[];
  description: string;
}

export const EARLY_LIFE_SUBPHASE_CONTRACTS: Record<
  EarlyLifeSubphaseKey,
  EarlyLifeSubphaseContract
> = {
  planted_acorn: {
    subphaseKey: "planted_acorn",
    label: "Planted Acorn",
    reconciledCanonicalStage: "beginning",
    targetAssetKey: "painterly-oak-acorn-planted-v1",
    targetFilename: "assets/garden/painterly/oak-acorn-planted-alpha-v1.png",
    soilBaseline: 441.0,
    rootOrigin: { x: 390.4, y: 441.0 },
    naturalFoliageHasMemorySource: false,
    eligibleEarnedRoles: [],
    description:
      "Resting acorn in the woodland soil at (390.4, 441.0). Subtle radicle hairline root tip entering the earth. Zero trunk and zero foliage.",
  },
  emerging_shoot: {
    subphaseKey: "emerging_shoot",
    label: "Emerging Shoot",
    reconciledCanonicalStage: "first_seedling",
    targetAssetKey: "painterly-oak-shoot-emerging-v1",
    targetFilename: "assets/garden/painterly/oak-shoot-emerging-alpha-v1.png",
    soilBaseline: 441.0,
    rootOrigin: { x: 390.4, y: 441.0 },
    naturalFoliageHasMemorySource: false,
    eligibleEarnedRoles: ["foliage", "ground_flora"],
    description:
      "Tender green epicotyl rising from acorn settled in soil at (390.4, 441.0). Hypogeal germination: cotyledons remain within acorn; compact terminal bud with small folded first true leaves. Delicate stem anchoring point for earned vegetative features.",
  },
  small_seedling: {
    subphaseKey: "small_seedling",
    label: "Small Oak Seedling",
    reconciledCanonicalStage: "first_seedling",
    targetAssetKey: "painterly-oak-seedling-v1",
    targetFilename: "assets/garden/painterly/oak-seedling-alpha-v1.png",
    soilBaseline: 441.0,
    rootOrigin: { x: 390.4, y: 441.0 },
    naturalFoliageHasMemorySource: false,
    eligibleEarnedRoles: ["foliage", "ground_flora"],
    description:
      "Slender upright green-woody stem (55px tall), 3–4 proportionate juvenile lobed oak leaves, delicate shallow soil entry at (390.4, 441.0). Supports single earned memory as tender oak leaf flush / shoot.",
  },
  small_sapling: {
    subphaseKey: "small_sapling",
    label: "Small Leafy Sapling",
    reconciledCanonicalStage: "tender_sapling",
    targetAssetKey: "painterly-sapling-v1",
    targetFilename: "assets/garden/painterly/oak-structure-sapling-alpha-v1.png",
    soilBaseline: 441.0,
    rootOrigin: { x: 390.4, y: 441.0 },
    naturalFoliageHasMemorySource: false,
    eligibleEarnedRoles: ["foliage", "ground_flora", "creature"],
    description:
      "A slender, lightly woody central stem rising from a narrow root collar entering soil at (390.4, 441.0); fine lateral twigs with modest juvenile oak leaves; zero mature buttress roots, long horizontal root strokes, or thick cylindrical trunk.",
  },
};

/**
 * Resolved bounding boxes and camera inspection parameters for early-life stages.
 * Invariant: Permanent planting anchor remains fixed at local (390.4, 441.0) and world (390.4, 316.68).
 * Inspection camera dynamically frames the plant's actual visible bounds (including foliage)
 * with comfortable padding without mutating or enlarging the plant geometry.
 */
export interface EarlyLifePlantInspection {
  subphaseKey: EarlyLifeSubphaseKey;
  localBounds: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
  worldBounds: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
  plantingAnchor: { x: number; y: number };
  targetX: number;
  targetY: number;
  zoom: number;
}

export const EARLY_LIFE_PLANT_BOUNDS: Record<
  EarlyLifeSubphaseKey,
  {
    localBounds: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
    worldBounds: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
    targetX: number;
    targetY: number;
    fitZoom: number;
  }
> = {
  planted_acorn: {
    localBounds: { minX: 383.0, maxX: 397.0, minY: 435.0, maxY: 444.0, width: 14.0, height: 9.0 },
    worldBounds: { minX: 386.1, maxX: 394.2, minY: 313.2, maxY: 318.4, width: 8.1, height: 5.2 },
    targetX: 390.4,
    targetY: 315.8,
    fitZoom: 3.0,
  },
  emerging_shoot: {
    localBounds: { minX: 383.0, maxX: 398.0, minY: 408.0, maxY: 442.0, width: 15.0, height: 34.0 },
    worldBounds: { minX: 386.1, maxX: 394.8, minY: 297.5, maxY: 317.3, width: 8.7, height: 19.8 },
    targetX: 390.4,
    targetY: 307.4,
    fitZoom: 3.0,
  },
  small_seedling: {
    localBounds: { minX: 372.0, maxX: 409.0, minY: 378.0, maxY: 442.0, width: 37.0, height: 64.0 },
    worldBounds: { minX: 379.7, maxX: 401.2, minY: 280.1, maxY: 317.3, width: 21.5, height: 37.2 },
    targetX: 390.4,
    targetY: 298.7,
    fitZoom: 2.9,
  },
  small_sapling: {
    localBounds: { minX: 352.8, maxX: 430.8, minY: 316.0, maxY: 442.0, width: 78.0, height: 126.0 },
    worldBounds: { minX: 368.6, maxX: 413.8, minY: 244.2, maxY: 317.3, width: 45.2, height: 73.1 },
    targetX: 390.4,
    targetY: 280.8,
    fitZoom: 2.75,
  },
};

export function resolvePlantInspectionCamera(
  subphaseOrStage: EarlyLifeSubphaseKey | CanonicalStageKeyOrBeginning | LifecycleVisualPhaseKey,
  viewport?: { width: number; height: number },
  minZoom = 1.0,
  maxZoom = 3.2
): EarlyLifePlantInspection {
  const isBranching =
    subphaseOrStage === "branching_oak" ||
    subphaseOrStage === "branching_out" ||
    subphaseOrStage === "leafy_canopy" ||
    subphaseOrStage === "rooted_flourishing";
  const isMature =
    subphaseOrStage === "mature_oak" ||
    subphaseOrStage === "garden_in_bloom";

  if (isBranching) {
    return {
      subphaseKey: "small_sapling",
      localBounds: { minX: 180, maxX: 620, minY: 68, maxY: 442, width: 440, height: 374 },
      worldBounds: { minX: 268, maxX: 524, minY: 100, maxY: 317, width: 256, height: 217 },
      plantingAnchor: { x: 390.4, y: 316.68 },
      targetX: 390.4,
      targetY: 220.0,
      zoom: Math.min(maxZoom, Math.max(minZoom, 1.6)),
    };
  }

  if (isMature) {
    return {
      subphaseKey: "small_sapling",
      localBounds: { minX: 100, maxX: 700, minY: 20, maxY: 442, width: 600, height: 422 },
      worldBounds: { minX: 222, maxX: 570, minY: 72, maxY: 317, width: 348, height: 245 },
      plantingAnchor: { x: 390.4, y: 316.68 },
      targetX: 390.4,
      targetY: 200.0,
      zoom: Math.min(maxZoom, Math.max(minZoom, 1.25)),
    };
  }

  const subphaseKey: EarlyLifeSubphaseKey =
    subphaseOrStage === "planted_acorn" ||
    subphaseOrStage === "emerging_shoot" ||
    subphaseOrStage === "small_seedling" ||
    subphaseOrStage === "small_sapling"
      ? subphaseOrStage
      : subphaseOrStage === "beginning"
      ? "planted_acorn"
      : subphaseOrStage === "tender_sapling"
      ? "small_sapling"
      : "small_seedling";

  const data = EARLY_LIFE_PLANT_BOUNDS[subphaseKey];
  let zoom = data.fitZoom;

  if (viewport && viewport.height > 0) {
    const verticalPadding = 48;
    const availH = Math.max(10, viewport.height - verticalPadding * 2);
    const calculatedZoom = availH / Math.max(1, data.worldBounds.height);
    // For tiny plants, maximum zoom may still leave them small: do not enlarge their world geometry
    zoom = Math.min(zoom, Math.max(minZoom, Math.min(maxZoom, calculatedZoom)));
  }

  return {
    subphaseKey,
    localBounds: data.localBounds,
    worldBounds: data.worldBounds,
    plantingAnchor: { x: 390.4, y: 316.68 },
    targetX: data.targetX,
    targetY: data.targetY,
    zoom: Math.round(zoom * 100) / 100,
  };
}

/**
 * Derived Growth-Progress Model (Authoritative Source of Truth)
 *
 * Provides a pure, typed resolver deriving continuous progress within the active
 * canonical interval, exact next milestone expectations, and gentle non-judgmental copy.
 */
export interface GardenMilestoneProgress {
  /** The current canonical stage key (e.g. "beginning", "first_seedling", etc.) */
  currentStageKey: CanonicalStageKeyOrBeginning;
  /** Human-readable label for the current stage */
  currentStageLabel: string;
  /** The next canonical milestone key, or null if already at the final stage */
  nextMilestoneKey: CanonicalStageKeyOrBeginning | null;
  /** Human-readable label for the next milestone, or null if at final stage */
  nextMilestoneLabel: string | null;
  /** Starting total growth units of the current stage interval */
  intervalStartUnits: number;
  /** Ending total growth units of the current stage interval (threshold for next milestone) */
  intervalEndUnits: number;
  /** Growth units accumulated within the current interval (unrounded float) */
  unitsInInterval: number;
  /** Total growth units spanning the current interval */
  intervalTotalUnits: number;
  /** Continuous progress fraction within the current interval [0.0, 1.0], clamped */
  intervalProgress: number;
  /** Rounded integer percentage for display [0, 100]. Strictly capped at 99% before threshold */
  intervalDisplayPercent: number;
  /** Overall foundation progress fraction [0.0, 1.0] across all 100 units */
  overallProgress?: number;
  /** Overall rounded integer foundation percentage [0, 100] out of 100 total units */
  overallDisplayPercent?: number;
  /** Remaining growth units to reach the next milestone, or 0 if final stage */
  remainingUnits: number;
  /** True if the garden is at the final canonical stage (garden_in_bloom) */
  isFinalStage: boolean;
  /** Gentle supporting message (e.g. "Growing through time and shared care.") */
  supportingCopy: string;
  /** User-facing next milestone copy */
  nextMilestoneCopy: string;
}

export type MvpEcologicalSubprogressBand =
  | "0-7.99"
  | "8-15.99"
  | "16-23.99"
  | "24-35.99"
  | "36-47.99"
  | "48-59.99"
  | "60-73.99"
  | "74-87.99"
  | "88-99.99"
  | "100";

export interface MvpFoundationPresentation {
  subphaseKey: "planted_acorn" | "emerging_shoot" | "small_seedling";
  label: "Planted Acorn" | "Emerging Oak Shoot" | "Small Oak Seedling";
  level: 1 | 2 | 3;
  levelLabel: "Level 1 of 3" | "Level 2 of 3" | "Level 3 of 3";
  supportingCopy: string;
  isFoundationComplete: boolean;
  /** Continuous progress inside the visible level [0, 1]. */
  levelProgress: number;
  /** Integer percentage inside current level [0, 99], or 100 if completed. */
  levelDisplayPercent: number;
  /** Visual foundation units [0, 100]. */
  foundationUnits: number;
  /** Overall progress through the bounded 100-unit MVP foundation [0, 1]. */
  foundationProgress: number;
  /** Overall percentage out of 100 (primary display value). */
  overallDisplayPercent: number;
  nextMilestoneLabel: string | null;
  subprogressBand: MvpEcologicalSubprogressBand;
}

export const MVP_FOUNDATION_TIME_CAP = 20;
export const MVP_FOUNDATION_COMPLETE_UNITS = 100;

/**
 * Authoritative Pure Typed 100-Point Foundation Growth Model
 *
 * Consolidation source of truth for:
 * - Garden screen
 * - Our Space Garden card
 * - GardenProgressSection
 * - Garden Explorer
 * - PainterlyGardenRenderer
 * - PainterlyTreeStructure
 * - Explorable memory resolver
 * - Garden Story
 * - Development Visual QA
 * - Tests
 *
 * Rules:
 * - positive shared moment: +2 growth
 * - completed reconnection: +4 growth
 * - important date: +2 growth
 * - supporting time: +0.5 per elapsed day (max 20)
 * - total foundation progress maximum: 100
 * - time alone can never exceed 20 points
 * - at least 80 points must come from meaningful shared care
 * - deduplicate events using stable event ID before counting
 * - incomplete reconnections contribute zero
 * - invalid, duplicate, or ineligible records contribute zero
 * - exact boundaries:
 *     0–23.99: Level 1 of 3 · Planted Acorn
 *     24–59.99: Level 2 of 3 · Emerging Oak Shoot
 *     60–99.99: Level 3 of 3 · Small Oak Seedling
 *     100: Level 3 complete · Foundation Complete (Small Oak Seedling remains visible)
 */
export interface AuthoritativeFoundationCalculation {
  totalRegisteredEvents: number;
  totalUniqueEvents: number;
  eligiblePositiveMoments: number;
  completedReconnections: number;
  importantDates: number;
  excludedOrIneligibleEvents: number;
  rawCareContribution: number;
  elapsedDays: number;
  supportingTimeContribution: number;
  totalFoundationProgress: number;
  overallDisplayPercent: number;
  currentLevel: 1 | 2 | 3;
  currentStage: "Planted Acorn" | "Emerging Oak Shoot" | "Small Oak Seedling";
  nextThreshold: number | null;
  pointsUntilNextThreshold: number;
  isFoundationComplete: boolean;
  subphaseKey: "planted_acorn" | "emerging_shoot" | "small_seedling";
  levelLabel: "Level 1 of 3" | "Level 2 of 3" | "Level 3 of 3";
  supportingCopy: string;
  nextMilestoneLabel: string | null;
  subprogressBand: MvpEcologicalSubprogressBand;
  uniqueCareEvents: GardenCareEvent[];
}

/**
 * Authoritative pure resolver for the 100-point MVP foundation journey.
 */
export function calculateAuthoritativeFoundation(
  eventsOrTotal?:
    | GardenCareEvent[]
    | Array<any>
    | { positiveCount?: number; reconnectionCount?: number; importantDateCount?: number }
    | number
    | null,
  couplesCreatedAtOrElapsedDays?: string | number | null,
  asOfTimeOrNow?: string | number | null,
  careOrTimeFallback?: number,
  timeOrRecFallback?: number
): AuthoritativeFoundationCalculation {
  let totalRegisteredEvents = 0;
  let eligiblePositiveMoments = 0;
  let completedReconnections = 0;
  let importantDates = 0;
  let excludedOrIneligibleEvents = 0;
  let directCareUnits: number | null = null;
  const uniqueCareEvents: GardenCareEvent[] = [];

  const asOfMs =
    typeof asOfTimeOrNow === "string"
      ? new Date(asOfTimeOrNow).getTime()
      : typeof asOfTimeOrNow === "number"
      ? asOfTimeOrNow
      : Date.now();
  const safeAsOfMs = isNaN(asOfMs) ? Date.now() : asOfMs;

  let elapsedDays = 0;
  if (typeof couplesCreatedAtOrElapsedDays === "number") {
    elapsedDays = Math.max(0, couplesCreatedAtOrElapsedDays);
  } else if (typeof couplesCreatedAtOrElapsedDays === "string") {
    const createdMs = new Date(couplesCreatedAtOrElapsedDays).getTime();
    if (!isNaN(createdMs)) {
      elapsedDays = Math.max(
        0,
        Math.floor((safeAsOfMs - createdMs) / (1000 * 60 * 60 * 24))
      );
    }
  } else if (typeof timeOrRecFallback === "number") {
    elapsedDays = Math.max(0, timeOrRecFallback / 0.5);
  } else if (typeof careOrTimeFallback === "number" && typeof eventsOrTotal === "number") {
    elapsedDays = Math.max(0, careOrTimeFallback / 0.5);
  }

  // 1. Process Array of events/records
  if (Array.isArray(eventsOrTotal)) {
    totalRegisteredEvents = eventsOrTotal.length;
    const seenIds = new Set<string>();

    for (const record of eventsOrTotal) {
      if (!record || typeof record !== "object") {
        excludedOrIneligibleEvents += 1;
        continue;
      }
      const rawId = record.id !== undefined && record.id !== null ? String(record.id).trim() : "";
      if (!rawId) {
        excludedOrIneligibleEvents += 1;
        continue;
      }

      // Deduplication by stable event ID
      if (seenIds.has(rawId)) {
        excludedOrIneligibleEvents += 1;
        continue;
      }

      const kind = record.kind || (record.event_type === "positive" ? "positive_moment" : record.event_type === "friction" ? "reconnection" : null);

      if (kind === "positive_moment" || record.event_type === "positive") {
        if (record.visibility && record.visibility !== "ours") {
          excludedOrIneligibleEvents += 1;
          continue;
        }
        seenIds.add(rawId);
        eligiblePositiveMoments += 1;
        uniqueCareEvents.push({
          id: rawId,
          kind: "positive_moment",
          occurredAt: record.occurredAt || record.created_at || new Date().toISOString(),
          createdAt: record.createdAt || record.created_at || null,
          category: record.category ?? null,
          displayTitle: record.displayTitle ?? null,
        });
      } else if (kind === "reconnection") {
        // Reconnections require completed status (must not be open, unresolved, or incomplete)
        const isCompleted =
          record.status === "reconnected" ||
          Boolean(record.reconnected_at || record.reconnectedAt) ||
          (record.kind === "reconnection" &&
            record.status !== "open" &&
            record.status !== "unresolved" &&
            record.reconnected_at !== null &&
            !record.incomplete);

        if (!isCompleted) {
          excludedOrIneligibleEvents += 1;
          continue;
        }
        if (record.visibility && record.visibility !== "ours") {
          excludedOrIneligibleEvents += 1;
          continue;
        }

        seenIds.add(rawId);
        completedReconnections += 1;
        uniqueCareEvents.push({
          id: rawId,
          kind: "reconnection",
          occurredAt: record.occurredAt || record.reconnected_at || record.created_at || new Date().toISOString(),
          createdAt: record.createdAt || record.created_at || null,
          category: record.category ?? null,
          displayTitle: record.displayTitle ?? null,
        });
      } else if (kind === "important_date" || record.event_date) {
        // Must not be in the future relative to asOfMs
        const dateIso = record.event_date || record.occurredAt || record.created_at;
        if (dateIso) {
          const dateMs = new Date(dateIso).getTime();
          if (!isNaN(dateMs) && dateMs > safeAsOfMs + 86400000) {
            // Future important date
            excludedOrIneligibleEvents += 1;
            continue;
          }
        }
        seenIds.add(rawId);
        importantDates += 1;
        uniqueCareEvents.push({
          id: rawId,
          kind: "important_date",
          occurredAt: record.occurredAt || record.event_date || record.created_at || new Date().toISOString(),
          createdAt: record.createdAt || record.created_at || null,
          category: record.category ?? null,
          displayTitle: record.displayTitle || record.label || null,
        });
      } else if (kind === "completed_challenge" || record.completed_at || record.completedAt) {
        seenIds.add(rawId);
        eligiblePositiveMoments += 1; // Completed challenges bloom with care contribution
        uniqueCareEvents.push({
          id: rawId,
          kind: "completed_challenge",
          occurredAt: record.occurredAt || record.completed_at || record.completedAt || new Date().toISOString(),
          createdAt: record.createdAt || record.created_at || null,
          category: record.category ?? null,
          displayTitle: record.displayTitle || record.challenge_idea || null,
        });
      } else {
        excludedOrIneligibleEvents += 1;
      }
    }
  } else if (typeof eventsOrTotal === "object" && eventsOrTotal !== null) {
    if ("care" in eventsOrTotal || "time" in eventsOrTotal) {
      const obj = eventsOrTotal as { care?: number; time?: number };
      const directCare = Math.max(0, obj.care ?? 0);
      directCareUnits = directCare;
      const timeVal = Math.max(0, obj.time ?? 0);
      elapsedDays = timeVal / 0.5;
      totalRegisteredEvents = Math.floor(directCare / 2);
    } else {
      eligiblePositiveMoments = Math.max(0, eventsOrTotal.positiveCount ?? 0);
      completedReconnections = Math.max(0, eventsOrTotal.reconnectionCount ?? 0);
      importantDates = Math.max(0, eventsOrTotal.importantDateCount ?? 0);
      totalRegisteredEvents = eligiblePositiveMoments + completedReconnections + importantDates;
    }
  } else if (typeof eventsOrTotal === "number") {
    if (typeof careOrTimeFallback === "number" && typeof timeOrRecFallback === "number") {
      // (totalUnits, careUnits, timeUnits) via fallbacks
      const directCare = Math.max(0, careOrTimeFallback);
      directCareUnits = directCare;
      elapsedDays = Math.max(0, timeOrRecFallback / 0.5);
    } else if (typeof couplesCreatedAtOrElapsedDays === "number" && typeof asOfTimeOrNow === "number") {
      // Direct (totalUnits, careUnits, timeUnits)
      const directCare = Math.max(0, couplesCreatedAtOrElapsedDays);
      directCareUnits = directCare;
      elapsedDays = Math.max(0, asOfTimeOrNow / 0.5);
    } else if (typeof couplesCreatedAtOrElapsedDays === "number" && (asOfTimeOrNow === null || asOfTimeOrNow === undefined)) {
      // Direct (careUnits, timeUnits) e.g. calculateAuthoritativeFoundation(22, 42)
      const directCare = Math.max(0, eventsOrTotal);
      directCareUnits = directCare;
      elapsedDays = Math.max(0, couplesCreatedAtOrElapsedDays / 0.5);
    } else if (typeof careOrTimeFallback === "number") {
      // (careUnits, timeUnits) via fallback
      const directCare = Math.max(0, eventsOrTotal);
      directCareUnits = directCare;
      elapsedDays = Math.max(0, careOrTimeFallback / 0.5);
    } else {
      // Single total units number (e.g. 23.99, 24.0, 59.99, 60.0, 99.99, 100)
      const directUnits = Math.max(0, eventsOrTotal);
      eligiblePositiveMoments = Math.floor(directUnits / 2);
    }
    totalRegisteredEvents = directCareUnits !== null ? Math.floor(directCareUnits / 2) : eligiblePositiveMoments;
  }

  const totalUniqueEvents = eligiblePositiveMoments + completedReconnections + importantDates;

  // Authoritative Growth Formula:
  // rawCareContribution = positiveMomentCount * 2 + completedReconnectionCount * 4 + importantDateCount * 2
  // supportingTimeContribution = min(20, max(0, elapsedDays * 0.5))
  // totalFoundationProgress = min(100, rawCareContribution + supportingTimeContribution)
  const supportingTimeContribution = Math.min(
    MVP_FOUNDATION_TIME_CAP,
    Math.max(0, elapsedDays * 0.5)
  );

  const isDirectSingleNumber =
    typeof eventsOrTotal === "number" &&
    directCareUnits === null;

  const rawCareContribution = directCareUnits !== null
    ? directCareUnits
    : isDirectSingleNumber
    ? Math.max(0, (eventsOrTotal as number) - supportingTimeContribution)
    : eligiblePositiveMoments * 2 +
      completedReconnections * 4 +
      importantDates * 2;

  const totalFoundationProgress = Math.min(
    MVP_FOUNDATION_COMPLETE_UNITS,
    isDirectSingleNumber
      ? Math.max(0, eventsOrTotal as number)
      : Math.max(0, rawCareContribution + supportingTimeContribution)
  );

  const overallDisplayPercent = Math.min(
    100,
    Math.floor(totalFoundationProgress)
  );

  const subprogressBand = resolveMvpEcologicalSubprogressBand(totalFoundationProgress);

  // Exact milestone boundaries:
  // 0 - 23.99: Level 1 of 3 · Planted Acorn
  // 24 - 59.99: Level 2 of 3 · Emerging Oak Shoot
  // 60 - 99.99: Level 3 of 3 · Small Oak Seedling
  // 100+: Level 3 complete · Foundation Complete (Small Oak Seedling remains visible)
  if (totalFoundationProgress < 24) {
    return {
      totalRegisteredEvents,
      totalUniqueEvents,
      eligiblePositiveMoments,
      completedReconnections,
      importantDates,
      excludedOrIneligibleEvents,
      rawCareContribution,
      elapsedDays,
      supportingTimeContribution,
      totalFoundationProgress,
      overallDisplayPercent,
      currentLevel: 1,
      currentStage: "Planted Acorn",
      nextThreshold: 24,
      pointsUntilNextThreshold: Math.max(
        0,
        Math.round((24 - totalFoundationProgress) * 100) / 100
      ),
      isFoundationComplete: false,
      subphaseKey: "planted_acorn",
      levelLabel: "Level 1 of 3",
      supportingCopy: "Your shared garden begins quietly in the woodland soil.",
      nextMilestoneLabel: "Emerging Oak Shoot",
      subprogressBand,
      uniqueCareEvents,
    };
  }

  if (totalFoundationProgress < 60) {
    return {
      totalRegisteredEvents,
      totalUniqueEvents,
      eligiblePositiveMoments,
      completedReconnections,
      importantDates,
      excludedOrIneligibleEvents,
      rawCareContribution,
      elapsedDays,
      supportingTimeContribution,
      totalFoundationProgress,
      overallDisplayPercent,
      currentLevel: 2,
      currentStage: "Emerging Oak Shoot",
      nextThreshold: 60,
      pointsUntilNextThreshold: Math.max(
        0,
        Math.round((60 - totalFoundationProgress) * 100) / 100
      ),
      isFoundationComplete: false,
      subphaseKey: "emerging_shoot",
      levelLabel: "Level 2 of 3",
      supportingCopy: "A first shoot is reaching gently toward the light.",
      nextMilestoneLabel: "Small Oak Seedling",
      subprogressBand,
      uniqueCareEvents,
    };
  }

  if (totalFoundationProgress < 100) {
    return {
      totalRegisteredEvents,
      totalUniqueEvents,
      eligiblePositiveMoments,
      completedReconnections,
      importantDates,
      excludedOrIneligibleEvents,
      rawCareContribution,
      elapsedDays,
      supportingTimeContribution,
      totalFoundationProgress,
      overallDisplayPercent,
      currentLevel: 3,
      currentStage: "Small Oak Seedling",
      nextThreshold: 100,
      pointsUntilNextThreshold: Math.max(
        0,
        Math.round((100 - totalFoundationProgress) * 100) / 100
      ),
      isFoundationComplete: false,
      subphaseKey: "small_seedling",
      levelLabel: "Level 3 of 3",
      supportingCopy: "Your young oak has opened its first leaves.",
      nextMilestoneLabel: "Foundation Complete",
      subprogressBand,
      uniqueCareEvents,
    };
  }

  // Foundation Complete (100)
  return {
    totalRegisteredEvents,
    totalUniqueEvents,
    eligiblePositiveMoments,
    completedReconnections,
    importantDates,
    excludedOrIneligibleEvents,
    rawCareContribution,
    elapsedDays,
    supportingTimeContribution,
    totalFoundationProgress: 100,
    overallDisplayPercent: 100,
    currentLevel: 3,
    currentStage: "Small Oak Seedling",
    nextThreshold: null,
    pointsUntilNextThreshold: 0,
    isFoundationComplete: true,
    subphaseKey: "small_seedling",
    levelLabel: "Level 3 of 3",
    supportingCopy:
      "The MVP foundation journey is complete. Shared moments will continue to gather here.",
    nextMilestoneLabel: null,
    subprogressBand: "100",
    uniqueCareEvents,
  };
}

/**
 * Deterministic Development QA Fixture containing exactly 18 registered records.
 * Used for development visual QA and automated test verification of the 18-record couple calculation.
 *
 * Composition:
 * - 10 positive shared moments (+20 growth units)
 * - 4 completed reconnections (+16 growth units)
 * - 2 important dates (+4 growth units)
 * - 1 incomplete/open reconnection (reconnected_at: null, +0 units, excluded)
 * - 1 duplicate record (duplicate of qa-pm-01, +0 units, deduplicated)
 *
 * Totals:
 * - totalRegisteredEvents: 18
 * - totalUniqueEvents: 16 (matches 16 explorable memory markers in Garden Explorer)
 * - excludedOrIneligibleEvents: 2
 * - rawCareContribution: 40 units
 * - with elapsedDays = 28: supportingTimeContribution = 14 units (cap 20)
 * - totalFoundationProgress: 54 units (Level 2 of 3 · Emerging Oak Shoot)
 * - pointsUntilNextThreshold: 6 units until Small Oak Seedling (at 60)
 */
export const MVP_18_RECORD_QA_FIXTURE: readonly any[] = [
  { id: "qa-pm-01", kind: "positive_moment", occurredAt: "2026-02-01T10:00:00.000Z", category: "kindness", displayTitle: "Morning coffee together" },
  { id: "qa-pm-02", kind: "positive_moment", occurredAt: "2026-02-03T14:30:00.000Z", category: "laughter", displayTitle: "Cooked new recipe" },
  { id: "qa-pm-03", kind: "positive_moment", occurredAt: "2026-02-06T18:00:00.000Z", category: "support", displayTitle: "Evening walk in park" },
  { id: "qa-pm-04", kind: "positive_moment", occurredAt: "2026-02-09T11:15:00.000Z", category: "adventure", displayTitle: "Weekend road trip" },
  { id: "qa-pm-05", kind: "positive_moment", occurredAt: "2026-02-12T20:00:00.000Z", category: "gratitude", displayTitle: "Quiet reading together" },
  { id: "qa-pm-06", kind: "positive_moment", occurredAt: "2026-02-15T09:45:00.000Z", category: "kindness", displayTitle: "Left sweet note on counter" },
  { id: "qa-pm-07", kind: "positive_moment", occurredAt: "2026-02-18T16:20:00.000Z", category: "laughter", displayTitle: "Board game showdown" },
  { id: "qa-pm-08", kind: "positive_moment", occurredAt: "2026-02-21T13:00:00.000Z", category: "support", displayTitle: "Comfort after long week" },
  { id: "qa-pm-09", kind: "positive_moment", occurredAt: "2026-02-24T19:30:00.000Z", category: "adventure", displayTitle: "Tried new bistro downtown" },
  { id: "qa-pm-10", kind: "positive_moment", occurredAt: "2026-02-26T21:00:00.000Z", category: "gratitude", displayTitle: "Late night conversation" },
  { id: "qa-rc-01", kind: "reconnection", status: "reconnected", reconnected_at: "2026-02-05T12:00:00.000Z", category: "communication", displayTitle: "Addressed schedule tension" },
  { id: "qa-rc-02", kind: "reconnection", status: "reconnected", reconnected_at: "2026-02-14T15:00:00.000Z", category: "chores", displayTitle: "Clarified weekend plans" },
  { id: "qa-rc-03", kind: "reconnection", status: "reconnected", reconnected_at: "2026-02-20T17:30:00.000Z", category: "finances", displayTitle: "Gentle repair after disagreement" },
  { id: "qa-rc-04", kind: "reconnection", status: "reconnected", reconnected_at: "2026-02-27T10:00:00.000Z", category: "time", displayTitle: "Listened through tough evening" },
  { id: "qa-id-01", kind: "important_date", event_date: "2026-01-15", category: "anniversary", displayTitle: "Relationship Milestone" },
  { id: "qa-id-02", kind: "important_date", event_date: "2026-02-14", category: "celebration", displayTitle: "First Shared Valentine's" },
  { id: "qa-rc-open", kind: "reconnection", status: "open", reconnected_at: null, incomplete: true, displayTitle: "Unresolved chore discussion" },
  { id: "qa-pm-01", kind: "positive_moment", occurredAt: "2026-02-01T10:00:00.000Z", displayTitle: "Duplicate sync record" },
];

/**
 * Calculates raw, uncapped care growth units from shared activity snapshot:
 *   positive moments × 2
 *   + completed reconnections × 4
 *   + important dates × 2
 */
export function resolveMvpRawCareUnits(
  eventsOrCountsOrCare:
    | GardenCareEvent[]
    | { positiveCount?: number; reconnectionCount?: number; importantDateCount?: number }
    | number,
  reconnections = 0,
  importantDates = 0
): number {
  if (Array.isArray(eventsOrCountsOrCare)) {
    const calc = calculateAuthoritativeFoundation(eventsOrCountsOrCare, 0);
    return calc.rawCareContribution;
  }
  if (typeof eventsOrCountsOrCare === "object" && eventsOrCountsOrCare !== null) {
    const calc = calculateAuthoritativeFoundation(eventsOrCountsOrCare, 0);
    return calc.rawCareContribution;
  }
  if (typeof eventsOrCountsOrCare === "number") {
    if (reconnections !== 0 || importantDates !== 0) {
      return (
        Math.max(0, eventsOrCountsOrCare) * 2 +
        Math.max(0, reconnections) * 4 +
        Math.max(0, importantDates) * 2
      );
    }
    return Math.max(0, eventsOrCountsOrCare);
  }
  return 0;
}

/**
 * Time supports growth at 0.5 units per elapsed day, but caps at 20 units.
 * Time alone can never reach Level 2 (24 units), Level 3 (60 units), or complete the journey.
 */
export function resolveMvpSupportingTimeUnits(timeGrowthUnits = 0): number {
  return Math.min(MVP_FOUNDATION_TIME_CAP, Math.max(0, timeGrowthUnits));
}

/**
 * Pure, typed 100-unit MVP visual score resolver:
 * rawCareUnits = (positive × 2) + (reconnections × 4) + (important dates × 2)
 * supportingTimeUnits = min(20, max(0, timeGrowthUnits))
 * mvpFoundationUnits = min(100, rawCareUnits + supportingTimeUnits)
 */
export function resolveMvpFoundationUnits(
  eventsOrTotal:
    | GardenCareEvent[]
    | { positiveCount?: number; reconnectionCount?: number; importantDateCount?: number }
    | number,
  careOrTime?: number,
  timeOrRec?: number,
  importantDates?: number
): number {
  const calc = calculateAuthoritativeFoundation(
    eventsOrTotal,
    typeof timeOrRec === "number" ? timeOrRec / 0.5 : typeof careOrTime === "number" ? careOrTime / 0.5 : 0,
    null,
    careOrTime,
    timeOrRec
  );
  return calc.totalFoundationProgress;
}

/**
 * Resolves whole-garden ecological subprogress bands inside each level.
 */
export function resolveMvpEcologicalSubprogressBand(
  mvpUnits: number
): MvpEcologicalSubprogressBand {
  const u = Math.max(0, Math.min(100, mvpUnits));
  if (u < 8) return "0-7.99";
  if (u < 16) return "8-15.99";
  if (u < 24) return "16-23.99";
  if (u < 36) return "24-35.99";
  if (u < 48) return "36-47.99";
  if (u < 60) return "48-59.99";
  if (u < 74) return "60-73.99";
  if (u < 88) return "74-87.99";
  if (u < 100) return "88-99.99";
  return "100";
}

/**
 * The production MVP tells the first three frames of the living oak journey:
 * Level 1 (0 <= u < 24): Planted Acorn
 * Level 2 (24 <= u < 60): Emerging Oak Shoot
 * Level 3 (60 <= u < 100): Small Oak Seedling
 * Complete (u = 100): Small Oak Seedling remains complete (never substitute a sapling or larger tree)
 */
export function resolveMvpFoundationPresentation(
  eventsOrTotal:
    | GardenCareEvent[]
    | { positiveCount?: number; reconnectionCount?: number; importantDateCount?: number }
    | number,
  careOrTime?: number,
  timeOrRec?: number,
  importantDates?: number
): MvpFoundationPresentation {
  const calc = calculateAuthoritativeFoundation(
    eventsOrTotal,
    typeof timeOrRec === "number" ? timeOrRec / 0.5 : typeof careOrTime === "number" ? careOrTime / 0.5 : 0,
    null,
    careOrTime,
    timeOrRec
  );
  const units = calc.totalFoundationProgress;
  const foundationProgress = Math.max(0, Math.min(1, units / 100));

  let levelProgress = 0;
  let levelDisplayPercent = 0;

  if (units < 24) {
    levelProgress = Math.max(0, Math.min(1, units / 24));
    levelDisplayPercent = Math.min(99, Math.floor(levelProgress * 100));
  } else if (units < 60) {
    levelProgress = Math.max(0, Math.min(1, (units - 24) / 36));
    levelDisplayPercent = Math.min(99, Math.floor(levelProgress * 100));
  } else if (units < 100) {
    levelProgress = Math.max(0, Math.min(1, (units - 60) / 40));
    levelDisplayPercent = Math.min(99, Math.floor(levelProgress * 100));
  } else {
    levelProgress = 1;
    levelDisplayPercent = 100;
  }

  return {
    subphaseKey: calc.subphaseKey,
    label: calc.currentStage,
    level: calc.currentLevel,
    levelLabel: calc.levelLabel,
    supportingCopy: calc.supportingCopy,
    isFoundationComplete: calc.isFoundationComplete,
    levelProgress,
    levelDisplayPercent,
    foundationUnits: units,
    foundationProgress,
    overallDisplayPercent: calc.overallDisplayPercent,
    nextMilestoneLabel: calc.nextMilestoneLabel,
    subprogressBand: calc.subprogressBand,
  };
}

/** Gentle progress for the 100-unit three-frame MVP foundation journey. */
export function resolveMvpFoundationProgress(
  eventsOrTotal:
    | GardenCareEvent[]
    | { positiveCount?: number; reconnectionCount?: number; importantDateCount?: number }
    | number,
  careOrTime?: number,
  timeOrRec?: number,
  importantDates?: number
): GardenMilestoneProgress {
  const calc = calculateAuthoritativeFoundation(
    eventsOrTotal,
    typeof timeOrRec === "number" ? timeOrRec / 0.5 : typeof careOrTime === "number" ? careOrTime / 0.5 : 0,
    null,
    careOrTime,
    timeOrRec
  );
  const units = calc.totalFoundationProgress;
  const overallDisplayPercent = calc.overallDisplayPercent;
  const foundationProgress = Math.max(0, Math.min(1, units / 100));

  if (calc.currentLevel === 1) {
    return {
      currentStageKey: "beginning",
      currentStageLabel: calc.currentStage,
      nextMilestoneKey: "first_seedling",
      nextMilestoneLabel: "Emerging Oak Shoot",
      intervalStartUnits: 0,
      intervalEndUnits: 24,
      unitsInInterval: units,
      intervalTotalUnits: 24,
      intervalProgress: Math.max(0, Math.min(1, units / 24)),
      intervalDisplayPercent: Math.min(99, Math.floor((units / 24) * 100)),
      overallProgress: foundationProgress,
      overallDisplayPercent: overallDisplayPercent,
      remainingUnits: calc.pointsUntilNextThreshold,
      isFinalStage: false,
      supportingCopy: calc.supportingCopy,
      nextMilestoneCopy: "Next growth: Emerging Oak Shoot",
    };
  }

  if (calc.currentLevel === 2) {
    return {
      currentStageKey: "first_seedling",
      currentStageLabel: calc.currentStage,
      nextMilestoneKey: "tender_sapling",
      nextMilestoneLabel: "Small Oak Seedling",
      intervalStartUnits: 24,
      intervalEndUnits: 60,
      unitsInInterval: Math.min(36, units - 24),
      intervalTotalUnits: 36,
      intervalProgress: Math.max(0, Math.min(1, (units - 24) / 36)),
      intervalDisplayPercent: Math.min(99, Math.floor(((units - 24) / 36) * 100)),
      overallProgress: foundationProgress,
      overallDisplayPercent: overallDisplayPercent,
      remainingUnits: calc.pointsUntilNextThreshold,
      isFinalStage: false,
      supportingCopy: calc.supportingCopy,
      nextMilestoneCopy: "Next growth: Small Oak Seedling",
    };
  }

  if (!calc.isFoundationComplete) {
    return {
      currentStageKey: "tender_sapling",
      currentStageLabel: calc.currentStage,
      nextMilestoneKey: "branching_out",
      nextMilestoneLabel: "Foundation Complete",
      intervalStartUnits: 60,
      intervalEndUnits: 100,
      unitsInInterval: Math.min(40, units - 60),
      intervalTotalUnits: 40,
      intervalProgress: Math.max(0, Math.min(1, (units - 60) / 40)),
      intervalDisplayPercent: Math.min(99, Math.floor(((units - 60) / 40) * 100)),
      overallProgress: foundationProgress,
      overallDisplayPercent: overallDisplayPercent,
      remainingUnits: calc.pointsUntilNextThreshold,
      isFinalStage: false,
      supportingCopy: calc.supportingCopy,
      nextMilestoneCopy: "Next growth: Foundation Complete",
    };
  }

  return {
    currentStageKey: "tender_sapling",
    currentStageLabel: calc.currentStage,
    nextMilestoneKey: null,
    nextMilestoneLabel: null,
    intervalStartUnits: 60,
    intervalEndUnits: 100,
    unitsInInterval: 40,
    intervalTotalUnits: 40,
    intervalProgress: 1,
    intervalDisplayPercent: 100,
    overallProgress: 1,
    overallDisplayPercent: 100,
    remainingUnits: 0,
    isFinalStage: true,
    supportingCopy: calc.supportingCopy,
    nextMilestoneCopy: "Your young oak keeps collecting your shared moments.",
  };
}

export type MvpMemorySemanticRole =
  | "living_oak_leaf"
  | "moss_cushion"
  | "fallen_oak_leaf"
  | "acorn_seed"
  | "woodland_light_mote";

export interface MvpFoundationMemoryMarker {
  semanticKey: string;
  sourceId: string;
  kind: GardenCareEvent["kind"];
  index: number;
  x: number;
  y: number;
  visualKind: "sapling_leaf" | "moss" | "woodland_leaf" | "acorn" | "light_mote";
  semanticRole: MvpMemorySemanticRole;
  attachment: "tree" | "ground" | "air";
  rotation: number;
  scale: number;
}

const TREE_TWIG_SLOTS = [
  { x: 387.2, y: 305.8, rotation: -22 },
  { x: 393.6, y: 304.2, rotation: 24 },
  { x: 385.0, y: 298.5, rotation: -38 },
  { x: 395.8, y: 297.0, rotation: 36 },
  { x: 386.4, y: 292.0, rotation: -28 },
  { x: 394.8, y: 290.5, rotation: 30 },
  { x: 388.5, y: 286.2, rotation: -16 },
  { x: 392.3, y: 285.8, rotation: 18 },
  { x: 388.0, y: 295.0, rotation: -12 },
  { x: 393.0, y: 294.0, rotation: 14 },
] as const;

/**
 * A deterministic, couple-unique memory constellation shared by live Garden,
 * Explore hit regions, and Story.
 *
 * Invariants:
 * - Deterministic: Same couple + same history = byte-stable positions & visual kinds.
 * - Persistent: Adding or backfilling an event does not relocate existing elements.
 * - Array-independent: Never uses array index as spatial coordinate or visual identity.
 * - Botanically plausible: Sapling leaves attach to real twig nodes at Level 3.
 * - Guaranteed representation: At Level 3 with >= 1 event, at least one event is an attached sapling leaf.
 */
export function resolveMvpFoundationMemoryMarkers(
  careEvents: GardenCareEvent[],
  seedString = "purple-garden-couple-seed",
  totalGrowthUnitsOrFoundation = 0
): MvpFoundationMemoryMarker[] {
  const stableHash = (value: string) => {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  };

  const foundationUnits = Math.max(0, totalGrowthUnitsOrFoundation);
  // Level 3 begins at 60 units in the 100-unit model
  const canUseTree = foundationUnits >= 60;

  const baseKinds = ["moss", "woodland_leaf", "acorn", "light_mote"] as const;

  // Check if any event naturally qualifies for sapling_leaf on the tree
  const hasNaturalSaplingLeaf =
    canUseTree &&
    careEvents.some((ev) => {
      const h = stableHash(`${seedString}|marker_kind|${ev.kind}|${ev.id}`);
      return h % 3 === 0;
    });

  // If tree is available but no event naturally hit sapling_leaf, determine the guaranteed event
  let guaranteedTreeEventId: string | null = null;
  if (canUseTree && !hasNaturalSaplingLeaf && careEvents.length > 0) {
    let bestScore = -1;
    for (const ev of careEvents) {
      const score = stableHash(`${seedString}|tree_guarantee|${ev.id}`);
      if (score > bestScore) {
        bestScore = score;
        guaranteedTreeEventId = ev.id;
      }
    }
  }

  return careEvents.map((event, index) => {
    // Pure hash derived strictly from couple seed and event identity (never array index)
    const hash = stableHash(`${seedString}|marker_v4|${event.kind}|${event.id}`);

    const isGuaranteedLeaf =
      canUseTree &&
      (event.id === guaranteedTreeEventId || (!hasNaturalSaplingLeaf && careEvents.length === 1));

    const visualKind = isGuaranteedLeaf || (canUseTree && hash % 3 === 0)
      ? "sapling_leaf"
      : baseKinds[(hash >>> 4) % baseKinds.length];

    const attachment =
      visualKind === "sapling_leaf"
        ? "tree"
        : visualKind === "light_mote"
        ? "air"
        : "ground";

    let x: number;
    let y: number;
    let rotation: number;
    let scale: number;

    if (visualKind === "sapling_leaf") {
      const slotIndex = (hash >>> 6) % TREE_TWIG_SLOTS.length;
      const slot = TREE_TWIG_SLOTS[slotIndex];
      x = slot.x;
      y = slot.y;
      rotation = slot.rotation + (((hash >>> 10) % 7) - 3);
      scale = Math.round((0.88 + (((hash >>> 14) % 24) / 100)) * 100) / 100;
    } else if (visualKind === "light_mote") {
      const angle = (((hash >>> 5) % 1000) / 1000) * 2 * Math.PI;
      const dist = 18 + (((hash >>> 15) % 1000) / 1000) * 48;
      x = Math.round((390.4 + Math.cos(angle) * dist * 1.35) * 10) / 10;
      y = Math.round((288 + ((hash >>> 9) % 32)) * 10) / 10;
      rotation = 0;
      scale = Math.round((0.85 + (((hash >>> 18) % 30) / 100)) * 100) / 100;
    } else {
      const angle = (((hash >>> 5) % 1000) / 1000) * 2 * Math.PI;
      const ring = 20 + (((hash >>> 14) % 1000) / 1000) * 58;
      x = Math.round((390.4 + Math.cos(angle) * ring * 1.62) * 10) / 10;
      y = Math.round((338 + Math.sin(angle) * ring * 0.52) * 10) / 10;
      rotation = (hash % 71) - 35;
      scale = Math.round((0.84 + (((hash >>> 18) % 32) / 100)) * 100) / 100;
    }

    const semanticRole: MvpMemorySemanticRole =
      visualKind === "sapling_leaf"
        ? "living_oak_leaf"
        : visualKind === "moss"
        ? "moss_cushion"
        : visualKind === "woodland_leaf"
        ? "fallen_oak_leaf"
        : visualKind === "acorn"
        ? "acorn_seed"
        : "woodland_light_mote";

    return {
      semanticKey: `${event.kind}:${event.id}`,
      sourceId: event.id,
      kind: event.kind,
      index,
      x,
      y,
      visualKind,
      semanticRole,
      attachment,
      rotation,
      scale,
    };
  });
}

/**
 * Resolves derived growth progress toward the next visual milestone.
 *
 * Rules:
 * - Beginning state (0 units AND 0 care events) resolves to "beginning" progressing toward "first_seedling".
 * - Canonical thresholds: 16 (tender_sapling), 36 (branching_out), 56 (leafy_canopy), 76 (rooted_flourishing), 91 (garden_in_bloom).
 * - At an exact threshold: resolves the new stage immediately and begins its next interval at 0%.
 * - Never displays 100% before the actual threshold is crossed.
 * - At final stage: isFinalStage = true, nextMilestoneKey = null, intervalProgress = 1.0, 100%.
 */
export function resolveGardenMilestoneProgress(
  totalGrowthUnits: number,
  careEventsCount = 0
): GardenMilestoneProgress {
  const isBeginning = totalGrowthUnits === 0 && careEventsCount === 0;

  if (isBeginning) {
    return {
      currentStageKey: "beginning",
      currentStageLabel: "A Quiet Beginning",
      nextMilestoneKey: "first_seedling",
      nextMilestoneLabel: "First Seedling",
      intervalStartUnits: 0,
      intervalEndUnits: 1,
      unitsInInterval: 0,
      intervalTotalUnits: 1,
      intervalProgress: 0,
      intervalDisplayPercent: 0,
      remainingUnits: 1,
      isFinalStage: false,
      supportingCopy: "Growing through time and shared care.",
      nextMilestoneCopy: "Next growth: First Seedling",
    };
  }

  const clampedUnits = Math.max(0, Math.min(100, totalGrowthUnits));

  if (clampedUnits < 16) {
    const start = 0;
    const end = 16;
    const unitsIn = clampedUnits - start;
    const totalSpan = end - start;
    const progress = Math.max(0, Math.min(1, unitsIn / totalSpan));
    const displayPercent = Math.min(99, Math.floor(progress * 100));
    const remaining = Math.max(0, end - clampedUnits);
    return {
      currentStageKey: "first_seedling",
      currentStageLabel: "First Seedling",
      nextMilestoneKey: "tender_sapling",
      nextMilestoneLabel: "Tender Sapling",
      intervalStartUnits: start,
      intervalEndUnits: end,
      unitsInInterval: unitsIn,
      intervalTotalUnits: totalSpan,
      intervalProgress: progress,
      intervalDisplayPercent: displayPercent,
      remainingUnits: remaining,
      isFinalStage: false,
      supportingCopy: "Growing through time and shared care.",
      nextMilestoneCopy: "Next growth: Tender Sapling",
    };
  }

  if (clampedUnits < 36) {
    const start = 16;
    const end = 36;
    const unitsIn = clampedUnits - start;
    const totalSpan = end - start;
    const progress = Math.max(0, Math.min(1, unitsIn / totalSpan));
    const displayPercent = Math.min(99, Math.floor(progress * 100));
    const remaining = Math.max(0, end - clampedUnits);
    return {
      currentStageKey: "tender_sapling",
      currentStageLabel: "Tender Sapling",
      nextMilestoneKey: "branching_out",
      nextMilestoneLabel: "Branching Out",
      intervalStartUnits: start,
      intervalEndUnits: end,
      unitsInInterval: unitsIn,
      intervalTotalUnits: totalSpan,
      intervalProgress: progress,
      intervalDisplayPercent: displayPercent,
      remainingUnits: remaining,
      isFinalStage: false,
      supportingCopy: "Growing through time and shared care.",
      nextMilestoneCopy: "Next growth: Branching Out",
    };
  }

  if (clampedUnits < 56) {
    const start = 36;
    const end = 56;
    const unitsIn = clampedUnits - start;
    const totalSpan = end - start;
    const progress = Math.max(0, Math.min(1, unitsIn / totalSpan));
    const displayPercent = Math.min(99, Math.floor(progress * 100));
    const remaining = Math.max(0, end - clampedUnits);
    return {
      currentStageKey: "branching_out",
      currentStageLabel: "Branching Out",
      nextMilestoneKey: "leafy_canopy",
      nextMilestoneLabel: "Leafy Canopy",
      intervalStartUnits: start,
      intervalEndUnits: end,
      unitsInInterval: unitsIn,
      intervalTotalUnits: totalSpan,
      intervalProgress: progress,
      intervalDisplayPercent: displayPercent,
      remainingUnits: remaining,
      isFinalStage: false,
      supportingCopy: "Growing through time and shared care.",
      nextMilestoneCopy: "Next growth: Leafy Canopy",
    };
  }

  if (clampedUnits < 76) {
    const start = 56;
    const end = 76;
    const unitsIn = clampedUnits - start;
    const totalSpan = end - start;
    const progress = Math.max(0, Math.min(1, unitsIn / totalSpan));
    const displayPercent = Math.min(99, Math.floor(progress * 100));
    const remaining = Math.max(0, end - clampedUnits);
    return {
      currentStageKey: "leafy_canopy",
      currentStageLabel: "Leafy Canopy",
      nextMilestoneKey: "rooted_flourishing",
      nextMilestoneLabel: "Rooted & Flourishing",
      intervalStartUnits: start,
      intervalEndUnits: end,
      unitsInInterval: unitsIn,
      intervalTotalUnits: totalSpan,
      intervalProgress: progress,
      intervalDisplayPercent: displayPercent,
      remainingUnits: remaining,
      isFinalStage: false,
      supportingCopy: "Growing through time and shared care.",
      nextMilestoneCopy: "Next growth: Rooted & Flourishing",
    };
  }

  if (clampedUnits < 91) {
    const start = 76;
    const end = 91;
    const unitsIn = clampedUnits - start;
    const totalSpan = end - start;
    const progress = Math.max(0, Math.min(1, unitsIn / totalSpan));
    const displayPercent = Math.min(99, Math.floor(progress * 100));
    const remaining = Math.max(0, end - clampedUnits);
    return {
      currentStageKey: "rooted_flourishing",
      currentStageLabel: "Rooted & Flourishing",
      nextMilestoneKey: "garden_in_bloom",
      nextMilestoneLabel: "Garden in Bloom",
      intervalStartUnits: start,
      intervalEndUnits: end,
      unitsInInterval: unitsIn,
      intervalTotalUnits: totalSpan,
      intervalProgress: progress,
      intervalDisplayPercent: displayPercent,
      remainingUnits: remaining,
      isFinalStage: false,
      supportingCopy: "Growing through time and shared care.",
      nextMilestoneCopy: "Next growth: Garden in Bloom",
    };
  }

  // Final stage: Garden in Bloom [91, 100]
  return {
    currentStageKey: "garden_in_bloom",
    currentStageLabel: "Garden in Bloom",
    nextMilestoneKey: null,
    nextMilestoneLabel: null,
    intervalStartUnits: 91,
    intervalEndUnits: 100,
    unitsInInterval: clampedUnits - 91,
    intervalTotalUnits: 9,
    intervalProgress: 1.0,
    intervalDisplayPercent: 100,
    remainingUnits: 0,
    isFinalStage: true,
    supportingCopy: "Your garden keeps collecting your shared moments.",
    nextMilestoneCopy: "Your garden keeps collecting your shared moments.",
  };
}

/**
 * Preview Milestone Progress Model (strictly development-only simulation).
 * Demonstrates simulated progress crossing thresholds into next visual subphases.
 */
export interface PreviewMilestoneProgress {
  subphaseKey: EarlyLifeSubphaseKey;
  label: string;
  nextSubphaseKey: EarlyLifeSubphaseKey | null;
  nextMilestoneLabel: string | null;
  previewUnitThreshold: number;
  intervalStartUnits: number;
  intervalEndUnits: number;
  intervalProgress: number;
  intervalDisplayPercent: number;
  isSimulatedOnly: true;
}

export function resolvePreviewMilestoneProgress(
  simulatedUnits: number,
  eventsCount = 0
): PreviewMilestoneProgress {
  if (simulatedUnits === 0 && eventsCount === 0) {
    return {
      subphaseKey: "planted_acorn",
      label: "Planted Acorn",
      nextSubphaseKey: "emerging_shoot",
      nextMilestoneLabel: "Emerging Oak Shoot",
      previewUnitThreshold: 0.1,
      intervalStartUnits: 0,
      intervalEndUnits: 0.1,
      intervalProgress: 0,
      intervalDisplayPercent: 0,
      isSimulatedOnly: true,
    };
  }

  const clamped = Math.max(0, Math.min(36, simulatedUnits));

  if (clamped <= 8.0) {
    const progress = Math.max(0, Math.min(1, clamped / 8.0));
    return {
      subphaseKey: "emerging_shoot",
      label: "Emerging Oak Shoot",
      nextSubphaseKey: "small_seedling",
      nextMilestoneLabel: "Small Oak Seedling",
      previewUnitThreshold: 8.0,
      intervalStartUnits: 0,
      intervalEndUnits: 8.0,
      intervalProgress: progress,
      intervalDisplayPercent: clamped < 8.0 ? Math.min(99, Math.floor(progress * 100)) : 100,
      isSimulatedOnly: true,
    };
  }

  if (clamped < 16.0) {
    const progress = Math.max(0, Math.min(1, (clamped - 8.0) / 8.0));
    return {
      subphaseKey: "small_seedling",
      label: "Small Oak Seedling",
      nextSubphaseKey: "small_sapling",
      nextMilestoneLabel: "Young Sapling",
      previewUnitThreshold: 16.0,
      intervalStartUnits: 8.0,
      intervalEndUnits: 16.0,
      intervalProgress: progress,
      intervalDisplayPercent: clamped < 16.0 ? Math.min(99, Math.floor(progress * 100)) : 100,
      isSimulatedOnly: true,
    };
  }

  const progress = Math.max(0, Math.min(1, (clamped - 16.0) / 20.0));
  return {
    subphaseKey: "small_sapling",
    label: "Young Sapling",
    nextSubphaseKey: null,
    nextMilestoneLabel: "Intermediate Branching Oak",
    previewUnitThreshold: 36.0,
    intervalStartUnits: 16.0,
    intervalEndUnits: 36.0,
    intervalProgress: progress,
    intervalDisplayPercent: clamped < 36.0 ? Math.min(99, Math.floor(progress * 100)) : 100,
    isSimulatedOnly: true,
  };
}

/**
 * Six Authoritative Lifecycle Visual Phases.
 * Provides explicit reconciliation between existing production growth logic
 * and naturalistic biological tree development.
 */
export type LifecycleVisualPhaseKey =
  | "planted_acorn"
  | "emerging_shoot"
  | "small_seedling"
  | "small_sapling"
  | "branching_oak"
  | "mature_oak";

export interface LifecycleStageToArtRecord {
  visualPhase: LifecycleVisualPhaseKey;
  label: string;
  reconciledCanonicalStage: CanonicalStageKeyOrBeginning;
  canonicalGrowthUnitRange: [number, number];
  targetAssetKey: string;
  targetFilename: string;
  assetStatus: "approved" | "development_preview" | "missing";
  approvalStatus: "approved" | "development_preview" | "missing";
  activeRenderingPath: "painterly_asset" | "procedural_silhouette";
  soilBaselineY: number;
  plantingCenterOriginX: number;
  rootContactModel: "subterranean_radicle" | "delicate_stem_entry" | "lateral_roots" | "buttress_roots";
  memoryAttachmentCapacity: string;
  anatomyDescription: string;
}

export const LIFECYCLE_STAGE_TO_ART_MAPPING: Record<
  LifecycleVisualPhaseKey,
  LifecycleStageToArtRecord
> = {
  planted_acorn: {
    visualPhase: "planted_acorn",
    label: "Planted Acorn",
    reconciledCanonicalStage: "beginning",
    canonicalGrowthUnitRange: [0, 0],
    targetAssetKey: "painterly-oak-acorn-planted-v1",
    targetFilename: "assets/garden/painterly/oak-acorn-planted-alpha-v1.png",
    assetStatus: "development_preview",
    approvalStatus: "development_preview",
    activeRenderingPath: "painterly_asset",
    soilBaselineY: 441.0,
    plantingCenterOriginX: 390.4,
    rootContactModel: "subterranean_radicle",
    memoryAttachmentCapacity: "0 aerial canopy features; earned events trigger biological progression",
    anatomyDescription:
      "Planted acorn resting horizontally in woodland soil hollow; textured cupule cap on left, smooth nut body on right, subtle subterranean radicle tip.",
  },
  emerging_shoot: {
    visualPhase: "emerging_shoot",
    label: "Emerging Shoot",
    reconciledCanonicalStage: "first_seedling",
    canonicalGrowthUnitRange: [0, 8],
    targetAssetKey: "painterly-oak-shoot-emerging-v1",
    targetFilename: "assets/garden/painterly/oak-shoot-emerging-alpha-v1.png",
    assetStatus: "development_preview",
    approvalStatus: "development_preview",
    activeRenderingPath: "painterly_asset",
    soilBaselineY: 441.0,
    plantingCenterOriginX: 390.4,
    rootContactModel: "delicate_stem_entry",
    memoryAttachmentCapacity: "1 delicate budding leaflet / tender vegetative accent at shoot apex",
    anatomyDescription:
      "Slender 25px emerging epicotyl rising from acorn settled in soil baseline; hypogeal germination with cotyledons retained inside acorn; compact terminal bud and small folded first true leaves; underground radicle occluded by soil.",
  },
  small_seedling: {
    visualPhase: "small_seedling",
    label: "Small Oak Seedling",
    reconciledCanonicalStage: "first_seedling",
    canonicalGrowthUnitRange: [9, 15],
    targetAssetKey: "painterly-oak-seedling-v1",
    targetFilename: "assets/garden/painterly/oak-seedling-alpha-v1.png",
    assetStatus: "development_preview",
    approvalStatus: "development_preview",
    activeRenderingPath: "painterly_asset",
    soilBaselineY: 441.0,
    plantingCenterOriginX: 390.4,
    rootContactModel: "delicate_stem_entry",
    memoryAttachmentCapacity: "1 earned lateral oak leaf flush or tender vegetative shoot attachment on stem",
    anatomyDescription:
      "Slender upright 55px green-woody stem; 3–4 proportionate juvenile lobed leaves arranged spirally; terminal apical bud.",
  },
  small_sapling: {
    visualPhase: "small_sapling",
    label: "Small Leafy Sapling",
    reconciledCanonicalStage: "tender_sapling",
    canonicalGrowthUnitRange: [16, 35],
    targetAssetKey: "painterly-sapling-v1",
    targetFilename: "assets/garden/painterly/oak-structure-sapling-alpha-v1.png",
    assetStatus: "development_preview",
    approvalStatus: "development_preview",
    activeRenderingPath: "painterly_asset",
    soilBaselineY: 441.0,
    plantingCenterOriginX: 390.4,
    rootContactModel: "delicate_stem_entry",
    memoryAttachmentCapacity: "Slender lateral twigs and tender oak leaf shoots",
    anatomyDescription:
      "A slender, lightly woody central stem rising from a narrow root collar entering soil at (390.4, 441.0); fine lateral twigs with modest juvenile oak leaves; clearly larger than the seedling but much thinner than the branching oak; zero mature buttress roots, long horizontal root strokes, or thick cylindrical trunk.",
  },
  branching_oak: {
    visualPhase: "branching_oak",
    label: "Branching Oak (Shared Structural Artwork)",
    reconciledCanonicalStage: "branching_out",
    canonicalGrowthUnitRange: [36, 90], // Shared structural asset across branching_out (36–55), leafy_canopy (56–75), and rooted_flourishing (76–90)
    targetAssetKey: "painterly-oak-branching-v1",
    targetFilename: "assets/garden/painterly/oak-structure-branching-alpha-v1.png",
    assetStatus: "development_preview",
    approvalStatus: "development_preview",
    activeRenderingPath: "painterly_asset",
    soilBaselineY: 441.0,
    plantingCenterOriginX: 390.4,
    rootContactModel: "buttress_roots",
    memoryAttachmentCapacity: "18 verified limb wood attachment zones; shared trunk asset across 3 distinct canonical stages",
    anatomyDescription:
      "Calibrated 2.5D painterly young oak framework; 4–7 primary scaffold limbs; airy canopy; serves as shared structural asset for branching_out, leafy_canopy, and rooted_flourishing while each retains distinct logical stage thresholds and foliage density.",
  },
  mature_oak: {
    visualPhase: "mature_oak",
    label: "Mature Ancient Oak",
    reconciledCanonicalStage: "garden_in_bloom",
    canonicalGrowthUnitRange: [91, 100],
    targetAssetKey: "painterly-oak-structure-mature-v1",
    targetFilename: "assets/garden/painterly/oak-structure-mature-alpha-v1.png",
    assetStatus: "approved",
    approvalStatus: "approved",
    activeRenderingPath: "painterly_asset",
    soilBaselineY: 441.0,
    plantingCenterOriginX: 390.4,
    rootContactModel: "buttress_roots",
    memoryAttachmentCapacity: "Full canopy scaffold anchors, generous foliage mass, resident wildlife habitats",
    anatomyDescription:
      "Ancient broadleaf woodland oak destination asset; massive spreading buttress roots meeting meadow baseline.",
  },
};

/**
 * Derives the visual lifecycle phase from authoritative production growth units
 * without altering any production stage thresholds.
 * Accurately covers fractional growth values (e.g. 15.99 < 16 stays seedling).
 */
export function resolveLifecycleVisualPhase(
  totalGrowthUnits: number,
  careEventsCount = 0
): LifecycleVisualPhaseKey {
  if (totalGrowthUnits === 0 && careEventsCount === 0) {
    return "planted_acorn";
  }
  const clamped = Math.max(0, Math.min(100, totalGrowthUnits));
  if (clamped <= 8) return "emerging_shoot";
  if (clamped < 16) return "small_seedling";
  if (clamped < 36) return "small_sapling";
  if (clamped < 91) return "branching_oak";
  return "mature_oak";
}
