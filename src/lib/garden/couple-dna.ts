/**
 * Purple Garden - Deterministic Couple DNA & Painterly Variation Contract
 *
 * Derives bounded, reproducible visual parameters strictly from coupleSeed (FNV-1a).
 * Guarantees that:
 * - Both partners in a couple receive byte-identical Garden DNA.
 * - Same seed produces identical clearing archetype, structural transforms, and fauna variants.
 * - Different couple seeds receive meaningfully distinct, bounded variations.
 * - Never depends on user ID, partner ID, session time, or Math.random().
 */

import { hashStringToSeed } from "../garden-generator";

export type EnvironmentArchetype =
  | "misty_morning_clearing"
  | "golden_hour_glade"
  | "deep_emerald_woodland";

export interface CoupleStructuralVariation {
  mirrorX: boolean; // Structural mirroring: scaleX: 1 or -1
  scaleMultiplier: number; // [0.985, 1.015]
  verticalShiftPx: number; // [-1.5, +1.5] px (preserves root baseline)
  rotationDeg: number; // [-0.4, +0.4] deg
  pivotX: number; // 390.4
  pivotY: number; // 441.0
}

export interface CoupleAtmosphereVariation {
  archetype: EnvironmentArchetype;
  woodlandTintOverlay: string;
  tintOpacity: number;
  backplateOpacity: number;
  sunbeamAngleDeg: number;
  mistDensity: number;
  warmthCoolnessBalance: number; // [-1.0 cool, +1.0 warm]
  lightShaftIntensity: number; // [0.04, 0.12]
}

export interface CoupleFaunaVariants {
  pollinatorSpecies: "swallowtail" | "azure_butterfly" | "honeybee";
  perchedBirdSpecies: "nuthatch" | "robin" | "chickadee";
  groundCritterSpecies: "chipmunk" | "dormouse" | "woodland_rabbit";
}

export interface DecorativeMossCushion {
  id: string;
  x: number;
  y: number;
  rx: number;
  ry: number;
  rotation: number;
  scale: number;
  minUnitsToReveal: number;
  sourceEvent: null;
}

export interface DecorativeGroundcoverCluster {
  id: string;
  x: number;
  y: number;
  variant: "woodland_sorrel" | "soft_fern" | "meadow_clover";
  rotation: number;
  scale: number;
  minUnitsToReveal: number;
  sourceEvent: null;
}

export interface DecorativeLeafLitter {
  id: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  shade: "oak_brown" | "russet" | "golden_amber";
  minUnitsToReveal: number;
  sourceEvent: null;
}

export interface DecorativeStoneItem {
  id: string;
  x: number;
  y: number;
  rx: number;
  ry: number;
  rotation: number;
  minUnitsToReveal: number;
  sourceEvent: null;
}

export interface DecorativeWoodlandLightMote {
  id: string;
  x: number;
  y: number;
  r: number;
  intensity: number;
  minUnitsToReveal: number;
  sourceEvent: null;
}

export interface CouplePlantMicroVariation {
  twigLeanDeg: number; // [-1.2, +1.2]
  leafOrientationOffsetDeg: number; // [-3.0, +3.0]
  shootCurvatureMod: number; // [-0.4, +0.4]
}

export interface CoupleEcologyComposition {
  mossCushions: DecorativeMossCushion[];
  groundcoverClusters: DecorativeGroundcoverCluster[];
  leafLitter: DecorativeLeafLitter[];
  smallStones: DecorativeStoneItem[];
  woodlandLightMotes: DecorativeWoodlandLightMote[];
  plantMicroVariation: CouplePlantMicroVariation;
  spacingRhythm: "clustered" | "open_clearing" | "balanced";
}

export interface PainterlyCoupleDNA {
  coupleSeed: string;
  seedInt: number;
  environmentArchetype: EnvironmentArchetype;
  atmosphere: CoupleAtmosphereVariation;
  structuralVariation: CoupleStructuralVariation;
  faunaVariants: CoupleFaunaVariants;
  ecologicalComposition: CoupleEcologyComposition;
}

const ARCHETYPES: readonly EnvironmentArchetype[] = [
  "misty_morning_clearing",
  "golden_hour_glade",
  "deep_emerald_woodland",
] as const;

const ARCHETYPE_TINTS: Record<
  EnvironmentArchetype,
  { color: string; opacity: number }
> = {
  misty_morning_clearing: { color: "rgba(180, 210, 230, 0.12)", opacity: 0.12 },
  golden_hour_glade: { color: "rgba(250, 220, 160, 0.10)", opacity: 0.10 },
  deep_emerald_woodland: { color: "rgba(100, 160, 130, 0.08)", opacity: 0.08 },
};

const POLLINATORS = ["swallowtail", "azure_butterfly", "honeybee"] as const;
const BIRDS = ["nuthatch", "robin", "chickadee"] as const;
const CRITTERS = ["chipmunk", "dormouse", "woodland_rabbit"] as const;

/**
 * Derives deterministic couple DNA from couple seed.
 */
export function derivePainterlyCoupleDNA(coupleSeed: string): PainterlyCoupleDNA {
  const seedInt = hashStringToSeed(coupleSeed || "couply-default-seed");
  const abs = Math.abs(seedInt);
  const u = abs >>> 0; // guarantee positive 32-bit unsigned integer

  const archetype = ARCHETYPES[u % ARCHETYPES.length];
  const tint = ARCHETYPE_TINTS[archetype];

  const mirrorX = ((u >>> 3) & 1) === 1;
  const scaleMultiplier = 0.985 + ((u >>> 5) % 30) / 1000; // 0.985 - 1.014
  const verticalShiftPx = -1.5 + ((u >>> 9) % 30) / 10; // -1.5 - +1.4
  const rotationDeg = -0.4 + ((u >>> 13) % 80) / 100; // -0.4 - +0.4

  const sunbeamAngleDeg = -12 + ((u >>> 15) % 25); // -12 - +12
  const mistDensity = 0.05 + ((u >>> 16) % 10) / 100; // 0.05 - 0.14
  const warmthCoolnessBalance = -0.6 + ((u >>> 18) % 120) / 100; // -0.6 to +0.6
  const lightShaftIntensity = 0.04 + ((u >>> 20) % 8) / 100; // 0.04 to 0.11

  const pollinatorSpecies = POLLINATORS[(u >>> 17) % POLLINATORS.length];
  const perchedBirdSpecies = BIRDS[(u >>> 19) % BIRDS.length];
  const groundCritterSpecies = CRITTERS[(u >>> 21) % CRITTERS.length];

  const rhythmOptions = ["clustered", "open_clearing", "balanced"] as const;
  const spacingRhythm = rhythmOptions[(u >>> 22) % rhythmOptions.length];

  // Deterministic couple-seeded ecological elements (sourceEvent: null)
  const mossCushions: DecorativeMossCushion[] = [
    {
      id: `seed-moss-1`,
      x: 374 + ((u >>> 7) % 8) - 4,
      y: 444 + ((u >>> 9) % 4) - 2,
      rx: 7.2 + ((u >>> 11) % 20) / 10,
      ry: 3.2 + ((u >>> 13) % 12) / 10,
      rotation: ((u >>> 14) % 20) - 10,
      scale: 0.9 + ((u >>> 16) % 20) / 100,
      minUnitsToReveal: 8,
      sourceEvent: null,
    },
    {
      id: `seed-moss-2`,
      x: 412 + ((u >>> 8) % 8) - 4,
      y: 445 + ((u >>> 10) % 4) - 2,
      rx: 6.8 + ((u >>> 12) % 20) / 10,
      ry: 3.0 + ((u >>> 14) % 12) / 10,
      rotation: ((u >>> 15) % 20) - 10,
      scale: 0.88 + ((u >>> 17) % 24) / 100,
      minUnitsToReveal: 24,
      sourceEvent: null,
    },
    {
      id: `seed-moss-3`,
      x: 356 + ((u >>> 13) % 10) - 5,
      y: 449 + ((u >>> 15) % 4) - 2,
      rx: 6.0 + ((u >>> 17) % 16) / 10,
      ry: 2.8 + ((u >>> 19) % 10) / 10,
      rotation: ((u >>> 20) % 30) - 15,
      scale: 0.85 + ((u >>> 21) % 25) / 100,
      minUnitsToReveal: 48,
      sourceEvent: null,
    },
    {
      id: `seed-moss-4`,
      x: 428 + ((u >>> 14) % 10) - 5,
      y: 448 + ((u >>> 16) % 4) - 2,
      rx: 6.5 + ((u >>> 18) % 16) / 10,
      ry: 2.9 + ((u >>> 20) % 10) / 10,
      rotation: ((u >>> 21) % 30) - 15,
      scale: 0.86 + ((u >>> 22) % 25) / 100,
      minUnitsToReveal: 60,
      sourceEvent: null,
    },
  ];

  const groundVariants = ["woodland_sorrel", "soft_fern", "meadow_clover"] as const;
  const groundcoverClusters: DecorativeGroundcoverCluster[] = [
    {
      id: `seed-gc-1`,
      x: 342 + ((u >>> 6) % 8),
      y: 446 + ((u >>> 8) % 3),
      variant: groundVariants[(u >>> 3) % groundVariants.length],
      rotation: ((u >>> 5) % 24) - 12,
      scale: 0.85 + ((u >>> 7) % 25) / 100,
      minUnitsToReveal: 16,
      sourceEvent: null,
    },
    {
      id: `seed-gc-2`,
      x: 436 + ((u >>> 9) % 8),
      y: 447 + ((u >>> 11) % 3),
      variant: groundVariants[((u >>> 3) + 1) % groundVariants.length],
      rotation: ((u >>> 12) % 24) - 12,
      scale: 0.88 + ((u >>> 14) % 20) / 100,
      minUnitsToReveal: 24,
      sourceEvent: null,
    },
    {
      id: `seed-gc-3`,
      x: 365 + ((u >>> 15) % 8),
      y: 452 + ((u >>> 17) % 3),
      variant: groundVariants[((u >>> 3) + 2) % groundVariants.length],
      rotation: ((u >>> 18) % 30) - 15,
      scale: 0.82 + ((u >>> 20) % 25) / 100,
      minUnitsToReveal: 48,
      sourceEvent: null,
    },
    {
      id: `seed-gc-4`,
      x: 418 + ((u >>> 21) % 8),
      y: 451 + ((u >>> 23) % 3),
      variant: groundVariants[(u >>> 4) % groundVariants.length],
      rotation: ((u >>> 24) % 30) - 15,
      scale: 0.85 + ((u >>> 25) % 25) / 100,
      minUnitsToReveal: 74,
      sourceEvent: null,
    },
  ];

  const leafShades = ["oak_brown", "russet", "golden_amber"] as const;
  const leafLitter: DecorativeLeafLitter[] = [
    {
      id: `seed-litter-1`,
      x: 384 + ((u >>> 4) % 6) - 3,
      y: 442.2 + ((u >>> 6) % 2) * 0.5,
      rotation: ((u >>> 8) % 60) - 30,
      scale: 0.75 + ((u >>> 10) % 25) / 100,
      shade: leafShades[(u >>> 12) % leafShades.length],
      minUnitsToReveal: 0,
      sourceEvent: null,
    },
    {
      id: `seed-litter-2`,
      x: 396 + ((u >>> 7) % 6) - 3,
      y: 442.5 + ((u >>> 9) % 2) * 0.5,
      rotation: ((u >>> 11) % 60) - 30,
      scale: 0.72 + ((u >>> 13) % 25) / 100,
      shade: leafShades[((u >>> 12) + 1) % leafShades.length],
      minUnitsToReveal: 0,
      sourceEvent: null,
    },
    {
      id: `seed-litter-3`,
      x: 368 + ((u >>> 14) % 8),
      y: 446 + ((u >>> 16) % 3),
      rotation: ((u >>> 17) % 70) - 35,
      scale: 0.8 + ((u >>> 19) % 25) / 100,
      shade: leafShades[((u >>> 12) + 2) % leafShades.length],
      minUnitsToReveal: 8,
      sourceEvent: null,
    },
    {
      id: `seed-litter-4`,
      x: 422 + ((u >>> 20) % 8),
      y: 445 + ((u >>> 22) % 3),
      rotation: ((u >>> 23) % 70) - 35,
      scale: 0.78 + ((u >>> 25) % 25) / 100,
      shade: leafShades[(u >>> 5) % leafShades.length],
      minUnitsToReveal: 36,
      sourceEvent: null,
    },
  ];

  const smallStones: DecorativeStoneItem[] = [
    {
      id: `seed-stone-1`,
      x: 378 + ((u >>> 10) % 6) - 3,
      y: 443 + ((u >>> 12) % 2),
      rx: 3.2 + ((u >>> 14) % 15) / 10,
      ry: 1.8 + ((u >>> 16) % 10) / 10,
      rotation: ((u >>> 18) % 20) - 10,
      minUnitsToReveal: 8,
      sourceEvent: null,
    },
    {
      id: `seed-stone-2`,
      x: 405 + ((u >>> 19) % 6) - 3,
      y: 444 + ((u >>> 21) % 2),
      rx: 3.6 + ((u >>> 23) % 15) / 10,
      ry: 2.0 + ((u >>> 25) % 10) / 10,
      rotation: ((u >>> 26) % 20) - 10,
      minUnitsToReveal: 36,
      sourceEvent: null,
    },
  ];

  const woodlandLightMotes: DecorativeWoodlandLightMote[] = [
    {
      id: `seed-mote-1`,
      x: 365 + ((u >>> 11) % 20),
      y: 395 + ((u >>> 13) % 15),
      r: 1.4 + ((u >>> 15) % 8) / 10,
      intensity: 0.6 + ((u >>> 17) % 30) / 100,
      minUnitsToReveal: 24,
      sourceEvent: null,
    },
    {
      id: `seed-mote-2`,
      x: 415 + ((u >>> 18) % 20),
      y: 390 + ((u >>> 20) % 15),
      r: 1.6 + ((u >>> 22) % 8) / 10,
      intensity: 0.65 + ((u >>> 24) % 30) / 100,
      minUnitsToReveal: 36,
      sourceEvent: null,
    },
  ];

  const plantMicroVariation: CouplePlantMicroVariation = {
    twigLeanDeg: -1.0 + ((u >>> 22) % 200) / 100, // -1.0 to +1.0
    leafOrientationOffsetDeg: -2.5 + ((u >>> 24) % 500) / 100, // -2.5 to +2.5
    shootCurvatureMod: -0.3 + ((u >>> 26) % 60) / 100, // -0.3 to +0.3
  };

  return {
    coupleSeed,
    seedInt,
    environmentArchetype: archetype,
    atmosphere: {
      archetype,
      woodlandTintOverlay: tint.color,
      tintOpacity: tint.opacity,
      backplateOpacity: 0.98,
      sunbeamAngleDeg,
      mistDensity,
      warmthCoolnessBalance,
      lightShaftIntensity,
    },
    structuralVariation: {
      mirrorX,
      scaleMultiplier,
      verticalShiftPx,
      rotationDeg,
      pivotX: 390.4,
      pivotY: 441.0,
    },
    faunaVariants: {
      pollinatorSpecies,
      perchedBirdSpecies,
      groundCritterSpecies,
    },
    ecologicalComposition: {
      mossCushions,
      groundcoverClusters,
      leafLitter,
      smallStones,
      woodlandLightMotes,
      plantMicroVariation,
      spacingRhythm,
    },
  };
}
