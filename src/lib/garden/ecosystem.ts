/**
 * Purple Garden - Living Ecosystem Foundation
 *
 * Renderer-independent ecological model managing restrained temperate flora,
 * fauna, and habitat relationships.
 *
 * CORE INVARIANTS:
 * 1. Ecological neutrality: Fauna represents a hospitable garden ecosystem—NOT relationship
 *    health, streaks, conflict frequency, or partner judgment.
 * 2. Deterministic habitat eligibility: A creature CANNOT exist without a compatible, mature
 *    habitat node.
 * 3. Seed determinism: Couple identity (not user account or device) selects species variants.
 *    Both partners see 100% identical ecosystem state for identical inputs.
 * 4. Zero runtime randomness: Zero Math.random() calls; evaluation relies strictly on coupleSeed
 *    and explicit evaluatedAt timestamp.
 * 5. Bounded movement & reduced motion: Creature movement never exceeds habitat bounds;
 *    under reduced-motion settings, creatures return a still, restful pose.
 */

import type {
  GardenWorld,
  HabitatNode,
  CreatureNode,
  GardenEcosystemState,
  CreatureType,
  CreatureLifestyle,
  HabitatKind,
  Point2D,
  BoundingBox2D,
} from "./world-types";

// Temperate garden and woodland species pools
const SONGBIRD_SPECIES = [
  "European Robin",
  "Eurasian Goldfinch",
  "Barn Swallow",
  "Eurasian Blue Tit",
  "Song Thrush",
];

const BUTTERFLY_SPECIES = [
  "Peacock Butterfly",
  "Red Admiral",
  "Brimstone",
  "Small Tortoiseshell",
  "Meadow Brown",
];

const POLLINATOR_SPECIES = [
  "Buff-tailed Bumblebee",
  "Red-tailed Bumblebee",
  "Early Bumblebee",
  "Honeybee",
];

const AMBIENT_MICRO_SPECIES = [
  "Seven-spot Ladybird",
  "Two-spot Ladybird",
  "Garden Hoverfly",
];

const GROUND_RESIDENT_SPECIES = [
  "European Hedgehog",
  "Woodland Shrew",
];

/**
 * Deterministic PRNG helper based on seed.
 */
function pseudoRandom(seed: number, offset: number): number {
  let s = (seed + offset * 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Evaluates the deterministic ecological state of the garden world based on
 * botanical maturity, established habitats, and canonical couple seed.
 */
export function evaluateEcosystemState(
  totalGrowthUnits: number,
  coupleSeed: number,
  evaluatedAt: string | null,
  habitats: Record<string, HabitatNode>,
  isResting: boolean = false
): GardenEcosystemState {
  const creatures: Record<string, CreatureNode> = {};
  const eligibleSpecies: string[] = [];

  // 1. Minimum Botanical Maturity Check
  // In the First Seedling stage (< 16 units), the habitat is just beginning to sprout.
  // Micro-life (ladybirds) may visit from tender sapling onward.
  const isSapling = totalGrowthUnits >= 16;
  const isBranching = totalGrowthUnits >= 36;
  const isCanopy = totalGrowthUnits >= 56;
  const isMature = totalGrowthUnits >= 76;

  // 2. Pollinators & Butterflies (Require flowering flora / pollinator patch)
  const pollinatorHabitat = Object.values(habitats).find(
    (h) => h.habitatKind === "pollinator_patch" || h.habitatKind === "moss_bed"
  );

  if (isSapling && pollinatorHabitat) {
    const butterflyIdx = Math.floor(pseudoRandom(coupleSeed, 11) * BUTTERFLY_SPECIES.length);
    const butterflySpecies = BUTTERFLY_SPECIES[butterflyIdx];
    eligibleSpecies.push(butterflySpecies);

    // If resting at night, butterflies roost; during day/active, they visit gently
    const bAnchor: Point2D = {
      x: pollinatorHabitat.anchorPoint.x + (pseudoRandom(coupleSeed, 12) - 0.5) * 16,
      y: pollinatorHabitat.anchorPoint.y - 12,
    };
    const bBounds: BoundingBox2D = {
      minX: bAnchor.x - 20,
      minY: bAnchor.y - 20,
      maxX: bAnchor.x + 20,
      maxY: bAnchor.y + 20,
      width: 40,
      height: 40,
    };

    const butterflyId = "ecosystem-visitor-butterfly";
    creatures[butterflyId] = {
      id: butterflyId,
      role: "creature_node",
      parentId: pollinatorHabitat.id,
      childIds: [],
      depthLayer: 60,
      localTransform: {
        position: bAnchor,
        rotation: 0,
        scale: { x: 1, y: 1 },
        pivot: bAnchor,
      },
      worldBounds: bBounds,
      anchorPoint: bAnchor,
      isEarned: false,
      appearanceOrigin: "ecosystem_natural",
      mappingType: "continuous_structural",
      creatureType: "butterfly",
      species: butterflySpecies,
      lifestyle: "visitor",
      habitatParentId: pollinatorHabitat.id,
      anchorType: "blossom_pollinator",
      restingAnchor: bAnchor,
      movementBounds: bBounds,
      scaleRange: [0.95, 1.05],
      motionProfile: isResting ? "still" : "wing_flutter",
      reducedMotionState: "still",
      lodVisibility: "always",
      accessibleDescription: `A gentle ${butterflySpecies} visiting the quiet blossoms.`,
    };
  }

  // 3. Songbirds (Require stable branch perch or canopy shelter in Branching Out or higher)
  const branchPerchHabitat = Object.values(habitats).find(
    (h) => h.habitatKind === "branch_perch" || h.habitatKind === "canopy_shelter"
  );

  if (isBranching && branchPerchHabitat) {
    const birdIdx = Math.floor(pseudoRandom(coupleSeed, 23) * SONGBIRD_SPECIES.length);
    const birdSpecies = SONGBIRD_SPECIES[birdIdx];
    eligibleSpecies.push(birdSpecies);

    const birdAnchor: Point2D = {
      x: branchPerchHabitat.anchorPoint.x,
      y: branchPerchHabitat.anchorPoint.y - 8,
    };
    const birdBounds: BoundingBox2D = {
      minX: birdAnchor.x - 18,
      minY: birdAnchor.y - 18,
      maxX: birdAnchor.x + 18,
      maxY: birdAnchor.y + 18,
      width: 36,
      height: 36,
    };

    const birdId = "ecosystem-visitor-songbird";
    creatures[birdId] = {
      id: birdId,
      role: "creature_node",
      parentId: branchPerchHabitat.id,
      childIds: [],
      depthLayer: 62,
      localTransform: {
        position: birdAnchor,
        rotation: 0,
        scale: { x: 1, y: 1 },
        pivot: birdAnchor,
      },
      worldBounds: birdBounds,
      anchorPoint: birdAnchor,
      isEarned: false,
      appearanceOrigin: "ecosystem_natural",
      mappingType: "continuous_structural",
      creatureType: "bird",
      species: birdSpecies,
      lifestyle: isMature ? "resident" : "visitor",
      habitatParentId: branchPerchHabitat.id,
      anchorType: "branch_perch",
      restingAnchor: birdAnchor,
      movementBounds: birdBounds,
      scaleRange: [0.92, 1.08],
      motionProfile: isResting ? "still" : "perching",
      reducedMotionState: "still",
      lodVisibility: "always",
      accessibleDescription: `A tranquil ${birdSpecies} resting gently upon a sheltered branch.`,
    };
  }

  // 4. Ground Resident (Requires mature root shelter or stone shelter in mature stages)
  const rootShelterHabitat = Object.values(habitats).find(
    (h) => h.habitatKind === "root_shelter" || h.habitatKind === "stone_shelter"
  );

  if (isMature && rootShelterHabitat) {
    const groundSpecies = GROUND_RESIDENT_SPECIES[Math.floor(pseudoRandom(coupleSeed, 37) * GROUND_RESIDENT_SPECIES.length)];
    eligibleSpecies.push(groundSpecies);

    const groundAnchor: Point2D = {
      x: rootShelterHabitat.anchorPoint.x,
      y: rootShelterHabitat.anchorPoint.y + 4,
    };
    const groundBounds: BoundingBox2D = {
      minX: groundAnchor.x - 22,
      minY: groundAnchor.y - 12,
      maxX: groundAnchor.x + 22,
      maxY: groundAnchor.y + 12,
      width: 44,
      height: 24,
    };

    const residentId = "ecosystem-resident-ground";
    creatures[residentId] = {
      id: residentId,
      role: "creature_node",
      parentId: rootShelterHabitat.id,
      childIds: [],
      depthLayer: 12,
      localTransform: {
        position: groundAnchor,
        rotation: 0,
        scale: { x: 1, y: 1 },
        pivot: groundAnchor,
      },
      worldBounds: groundBounds,
      anchorPoint: groundAnchor,
      isEarned: false,
      appearanceOrigin: "ecosystem_natural",
      mappingType: "continuous_structural",
      creatureType: "hedgehog",
      species: groundSpecies,
      lifestyle: "resident",
      habitatParentId: rootShelterHabitat.id,
      anchorType: "root_shelter",
      restingAnchor: groundAnchor,
      movementBounds: groundBounds,
      scaleRange: [0.95, 1.0],
      motionProfile: isResting ? "still" : "gentle_forage",
      reducedMotionState: "still",
      lodVisibility: "close_zoom",
      accessibleDescription: `A quiet ${groundSpecies} nestled safely in the root shelter.`,
    };
  }

  // 5. Ecological Summary (Calm, non-judgmental description)
  let ecologicalSummary: string;
  if (isMature && Object.keys(creatures).length >= 2) {
    ecologicalSummary =
      "With deep roots, mature branches and sheltered ground, temperate birds, pollinators and small woodland creatures find a peaceful home here.";
  } else if (isBranching && Object.keys(creatures).length > 0) {
    ecologicalSummary =
      "As the tree branched out and flowers blossomed, gentle songbirds and pollinators began to visit the garden.";
  } else if (isSapling) {
    ecologicalSummary =
      "As the first shared leaves unfolded, quiet pollinators found early nectar.";
  } else {
    ecologicalSummary =
      "A quiet beginning is taking root; the soil is preparing to welcome garden life as growth deepens.";
  }

  return {
    habitats,
    creatures,
    eligibleSpecies,
    ecologicalSummary,
  };
}

/**
 * Builds standard habitat nodes from current botanical world elements.
 */
export function deriveHabitatsFromBotanicalWorld(
  stageKey: string,
  totalGrowthUnits: number,
  trunkAnchor: Point2D,
  canopyAnchor: Point2D,
  soilAnchor: Point2D
): Record<string, HabitatNode> {
  const habitats: Record<string, HabitatNode> = {};

  // Soil & Moss Ground Habitat (Available from seedling onward)
  const mossBedId = "habitat-moss-ground-bed";
  habitats[mossBedId] = {
    id: mossBedId,
    role: "habitat_node",
    habitatKind: "moss_bed",
    parentId: "terrain-root",
    childIds: [],
    depthLayer: -10,
    localTransform: {
      position: soilAnchor,
      rotation: 0,
      scale: { x: 1, y: 1 },
      pivot: soilAnchor,
    },
    worldBounds: {
      minX: soilAnchor.x - 120,
      minY: soilAnchor.y - 30,
      maxX: soilAnchor.x + 120,
      maxY: soilAnchor.y + 30,
      width: 240,
      height: 60,
    },
    anchorPoint: soilAnchor,
    isEarned: false,
    appearanceOrigin: "stage_structure",
    mappingType: "continuous_structural",
    capacity: 3,
    supportedCreatureTypes: ["hedgehog", "ladybird"],
    stabilityMaturityUnits: 0,
    anchorType: "ground_cover",
  };

  // Pollinator Patch (Available when stage has companion flora or blossoms >= 16 units)
  if (totalGrowthUnits >= 16) {
    const pollinatorId = "habitat-pollinator-patch";
    const pAnchor = { x: soilAnchor.x + 45, y: soilAnchor.y - 10 };
    habitats[pollinatorId] = {
      id: pollinatorId,
      role: "habitat_node",
      habitatKind: "pollinator_patch",
      parentId: "ground-flora-root",
      childIds: [],
      depthLayer: 15,
      localTransform: {
        position: pAnchor,
        rotation: 0,
        scale: { x: 1, y: 1 },
        pivot: pAnchor,
      },
      worldBounds: {
        minX: pAnchor.x - 40,
        minY: pAnchor.y - 30,
        maxX: pAnchor.x + 40,
        maxY: pAnchor.y + 30,
        width: 80,
        height: 60,
      },
      anchorPoint: pAnchor,
      isEarned: false,
      appearanceOrigin: "stage_structure",
      mappingType: "continuous_structural",
      capacity: 4,
      supportedCreatureTypes: ["butterfly", "bee", "ladybird"],
      stabilityMaturityUnits: 16,
      anchorType: "blossom_pollinator",
    };
  }

  // Branch Perch & Canopy Shelter (Available when branching out >= 36 units)
  if (totalGrowthUnits >= 36) {
    const perchId = "habitat-branch-perch";
    habitats[perchId] = {
      id: perchId,
      role: "habitat_node",
      habitatKind: "branch_perch",
      parentId: "tree-trunk",
      childIds: [],
      depthLayer: 25,
      localTransform: {
        position: canopyAnchor,
        rotation: 0,
        scale: { x: 1, y: 1 },
        pivot: canopyAnchor,
      },
      worldBounds: {
        minX: canopyAnchor.x - 50,
        minY: canopyAnchor.y - 30,
        maxX: canopyAnchor.x + 50,
        maxY: canopyAnchor.y + 30,
        width: 100,
        height: 60,
      },
      anchorPoint: canopyAnchor,
      isEarned: false,
      appearanceOrigin: "stage_structure",
      mappingType: "continuous_structural",
      capacity: 2,
      supportedCreatureTypes: ["bird"],
      stabilityMaturityUnits: 36,
      anchorType: "branch_perch",
    };
  }

  // Deep Root Shelter (Available when rooted & flourishing >= 76 units)
  if (totalGrowthUnits >= 76) {
    const rootShelterId = "habitat-root-shelter";
    const rAnchor = { x: trunkAnchor.x - 48, y: trunkAnchor.y - 8 };
    habitats[rootShelterId] = {
      id: rootShelterId,
      role: "habitat_node",
      habitatKind: "root_shelter",
      parentId: "tree-root",
      childIds: [],
      depthLayer: -2,
      localTransform: {
        position: rAnchor,
        rotation: 0,
        scale: { x: 1, y: 1 },
        pivot: rAnchor,
      },
      worldBounds: {
        minX: rAnchor.x - 30,
        minY: rAnchor.y - 20,
        maxX: rAnchor.x + 30,
        maxY: rAnchor.y + 20,
        width: 60,
        height: 40,
      },
      anchorPoint: rAnchor,
      isEarned: false,
      appearanceOrigin: "stage_structure",
      mappingType: "continuous_structural",
      capacity: 1,
      supportedCreatureTypes: ["hedgehog"],
      stabilityMaturityUnits: 76,
      anchorType: "root_shelter",
    };
  }

  return habitats;
}
