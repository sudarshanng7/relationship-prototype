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
}

export interface CoupleFaunaVariants {
  pollinatorSpecies: "swallowtail" | "azure_butterfly" | "honeybee";
  perchedBirdSpecies: "nuthatch" | "robin" | "chickadee";
  groundCritterSpecies: "chipmunk" | "dormouse" | "woodland_rabbit";
}

export interface PainterlyCoupleDNA {
  coupleSeed: string;
  seedInt: number;
  environmentArchetype: EnvironmentArchetype;
  atmosphere: CoupleAtmosphereVariation;
  structuralVariation: CoupleStructuralVariation;
  faunaVariants: CoupleFaunaVariants;
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

  const pollinatorSpecies = POLLINATORS[(u >>> 17) % POLLINATORS.length];
  const perchedBirdSpecies = BIRDS[(u >>> 19) % BIRDS.length];
  const groundCritterSpecies = CRITTERS[(u >>> 21) % CRITTERS.length];

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
  };
}
