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
    targetAssetKey: "painterly-oak-beginning-v1",
    targetFilename: "assets/garden/painterly/oak-beginning-alpha-v1.png",
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
    targetAssetKey: "painterly-seedling-v1",
    targetFilename: "assets/garden/painterly/oak-structure-seedling-alpha-v1.png",
    soilBaseline: 441.0,
    rootOrigin: { x: 390.4, y: 441.0 },
    naturalFoliageHasMemorySource: false,
    eligibleEarnedRoles: ["blossom", "ground_flora"],
    description:
      "Tender green hypocotyl/plumule rising from the split acorn at (390.4, 441.0). First pair of natural seedling leaves (cotyledons) with zero memory source. Delicate stem anchoring point for earned care features.",
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
    eligibleEarnedRoles: ["blossom", "ground_flora", "creature"],
    description:
      "Slender upright young woody trunk, early lateral roots anchoring into clearing soil, 4–6 small leaves, young terminal shoot. Supports first earned blossoms with dynamic calyx and twig attachment.",
  },
};
