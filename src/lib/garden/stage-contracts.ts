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
  type GardenStageKey,
  GARDEN_STAGES,
  getGardenStage,
} from "../garden-generator";

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
  /** Remaining growth units to reach the next milestone, or 0 if final stage */
  remainingUnits: number;
  /** True if the garden is at the final canonical stage (garden_in_bloom) */
  isFinalStage: boolean;
  /** Gentle supporting message (e.g. "Growing through time and shared care.") */
  supportingCopy: string;
  /** User-facing next milestone copy */
  nextMilestoneCopy: string;
}

export interface MvpFoundationPresentation {
  subphaseKey: "planted_acorn" | "emerging_shoot" | "small_seedling";
  label: string;
  supportingCopy: string;
  isFoundationComplete: boolean;
}

/**
 * The production MVP intentionally tells only the first three frames of the
 * oak journey. Canonical growth data is retained for compatibility and future
 * releases, while the live visual presentation stops at the small seedling.
 */
export function resolveMvpFoundationPresentation(
  totalGrowthUnits: number,
  careEventsCount = 0
): MvpFoundationPresentation {
  const units = Math.max(0, totalGrowthUnits);

  if (units === 0 && careEventsCount === 0) {
    return {
      subphaseKey: "planted_acorn",
      label: "Planted Acorn",
      supportingCopy: "Your shared garden begins quietly in the woodland soil.",
      isFoundationComplete: false,
    };
  }

  if (units <= 8) {
    return {
      subphaseKey: "emerging_shoot",
      label: "Emerging Oak Shoot",
      supportingCopy: "A first shoot is reaching gently toward the light.",
      isFoundationComplete: false,
    };
  }

  return {
    subphaseKey: "small_seedling",
    label: "Small Oak Seedling",
    supportingCopy: "Your young oak has opened its first leaves.",
    isFoundationComplete: true,
  };
}

/** Gentle progress for the bounded three-frame MVP foundation journey. */
export function resolveMvpFoundationProgress(
  totalGrowthUnits: number,
  careEventsCount = 0
): GardenMilestoneProgress {
  const presentation = resolveMvpFoundationPresentation(
    totalGrowthUnits,
    careEventsCount
  );
  const units = Math.max(0, totalGrowthUnits);

  if (presentation.subphaseKey === "planted_acorn") {
    return {
      currentStageKey: "beginning",
      currentStageLabel: presentation.label,
      nextMilestoneKey: "first_seedling",
      nextMilestoneLabel: "Emerging Oak Shoot",
      intervalStartUnits: 0,
      intervalEndUnits: 1,
      unitsInInterval: 0,
      intervalTotalUnits: 1,
      intervalProgress: 0,
      intervalDisplayPercent: 0,
      remainingUnits: 1,
      isFinalStage: false,
      supportingCopy: "The first sign of growth will appear through shared care and time.",
      nextMilestoneCopy: "Next growth: Emerging Oak Shoot",
    };
  }

  if (presentation.subphaseKey === "emerging_shoot") {
    const progress = Math.max(0, Math.min(1, units / 8));
    return {
      currentStageKey: "first_seedling",
      currentStageLabel: presentation.label,
      nextMilestoneKey: "tender_sapling",
      nextMilestoneLabel: "Small Oak Seedling",
      intervalStartUnits: 0,
      intervalEndUnits: 8,
      unitsInInterval: Math.min(8, units),
      intervalTotalUnits: 8,
      intervalProgress: progress,
      intervalDisplayPercent: Math.min(99, Math.floor(progress * 100)),
      remainingUnits: Math.max(0, 8 - units),
      isFinalStage: false,
      supportingCopy: "Growing toward its first true leaves.",
      nextMilestoneCopy: "Next growth: Small Oak Seedling",
    };
  }

  return {
    currentStageKey: "tender_sapling",
    currentStageLabel: presentation.label,
    nextMilestoneKey: null,
    nextMilestoneLabel: null,
    intervalStartUnits: 8,
    intervalEndUnits: 8,
    unitsInInterval: 0,
    intervalTotalUnits: 0,
    intervalProgress: 1,
    intervalDisplayPercent: 100,
    remainingUnits: 0,
    isFinalStage: true,
    supportingCopy: "The MVP foundation journey is complete. Shared moments will continue to gather here.",
    nextMilestoneCopy: "Your young oak keeps collecting your shared moments.",
  };
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
