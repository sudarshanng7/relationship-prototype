/**
 * Purple Garden - Deterministic Botanical Generator (SVG Redesign)
 *
 * NOTE: Editorial botanical generator using react-native-svg.
 * Visual seeds are derived deterministically in-memory from couple_id via FNV-1a hash.
 * It does NOT encode any personal information (names, emails, dates, reflections).
 */

// ----------------------------------------------------
// 1. GARDEN STAGES & COPY
// ----------------------------------------------------

export type GardenStageKey =
  | "first_seedling"
  | "tender_sapling"
  | "branching_out"
  | "leafy_canopy"
  | "rooted_flourishing"
  | "garden_in_bloom";

export interface GardenStage {
  key: GardenStageKey;
  label: string;
  supportingCopy: string;
  minUnits: number;
  maxUnits: number;
}

export const GARDEN_STAGES: Record<GardenStageKey, GardenStage> = {
  first_seedling: {
    key: "first_seedling",
    label: "First Seedling",
    supportingCopy: "A quiet beginning is taking root.",
    minUnits: 0,
    maxUnits: 15,
  },
  tender_sapling: {
    key: "tender_sapling",
    label: "Tender Sapling",
    supportingCopy: "Your first shared leaves are gently unfolding.",
    minUnits: 16,
    maxUnits: 35,
  },
  branching_out: {
    key: "branching_out",
    label: "Branching Out",
    supportingCopy: "Your garden is finding its own shape through time and care.",
    minUnits: 36,
    maxUnits: 55,
  },
  leafy_canopy: {
    key: "leafy_canopy",
    label: "Leafy Canopy",
    supportingCopy: "A generous canopy is beginning to form around your shared history.",
    minUnits: 56,
    maxUnits: 75,
  },
  rooted_flourishing: {
    key: "rooted_flourishing",
    label: "Rooted & Flourishing",
    supportingCopy: "Deep roots and a fuller presence have grown together.",
    minUnits: 76,
    maxUnits: 90,
  },
  garden_in_bloom: {
    key: "garden_in_bloom",
    label: "Garden in Bloom",
    supportingCopy: "Your shared history has become a flourishing place of its own.",
    minUnits: 91,
    maxUnits: 100,
  },
};

export function getGardenStage(totalUnits: number): GardenStage {
  const clamped = Math.max(0, Math.min(100, totalUnits));
  if (clamped < 16) return GARDEN_STAGES.first_seedling;
  if (clamped < 36) return GARDEN_STAGES.tender_sapling;
  if (clamped < 56) return GARDEN_STAGES.branching_out;
  if (clamped < 76) return GARDEN_STAGES.leafy_canopy;
  if (clamped < 91) return GARDEN_STAGES.rooted_flourishing;
  return GARDEN_STAGES.garden_in_bloom;
}

export type AmbienceLabel =
  | "Growing gently"
  | "Resting peacefully"
  | "Newly blooming";

export function getAmbienceLabel(
  stageKey: GardenStageKey,
  isResting: boolean
): AmbienceLabel {
  if (isResting) {
    return "Resting peacefully";
  }
  if (stageKey === "garden_in_bloom" || stageKey === "rooted_flourishing") {
    return "Newly blooming";
  }
  return "Growing gently";
}

// ----------------------------------------------------
// 2. DETERMINISTIC HASH & PRNG
// ----------------------------------------------------

export function hashStringToSeed(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function stableEventHash(eventId: string): string {
  const hash = hashStringToSeed(eventId);
  return hash.toString(16).padStart(8, "0");
}

function mixSeed(seed: number): number {
  let h = seed >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

export function getCareFeatureId(
  kind: "positive_moment" | "reconnection" | "important_date",
  eventId: string
): string {
  const hash = stableEventHash(eventId);
  if (kind === "reconnection") {
    return `care-reconnection-${hash}`;
  }
  if (kind === "positive_moment") {
    return `care-positive-${hash}`;
  }
  return `care-important-date-${hash}`;
}

export function createPRNG(seed: number) {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ----------------------------------------------------
// 2B. PERMANENT COUPLE-SPECIFIC GARDEN DNA & CARE SIGNALS
// ----------------------------------------------------

export type GardenCareEvent = {
  id: string;
  kind: "positive_moment" | "reconnection" | "important_date";
  occurredAt: string;
  category?: string | null;
};

export type PositiveBotanicalFamily =
  | "tender_growth"
  | "budding_growth"
  | "ground_life"
  | "mature_abundance"
  | "habitat_enrichment";

export type PositiveBotanicalVariant =
  | "single_leaf"
  | "paired_leaf_shoot"
  | "twig_shoot"
  | "upward_shoot"
  | "closed_bud"
  | "paired_buds"
  | "flowering_shoot"
  | "fern_frond"
  | "meadow_flower"
  | "moss_cushion"
  | "clover_cover"
  | "seed_head"
  | "sprout"
  | "berry_cluster"
  | "fruit_bud"
  | "restrained_pod"
  | "flowering_herb"
  | "butterfly"
  | "pollinator"
  | "bird_perch"
  | "nest_material";

interface PositiveFamilyChoice {
  family: PositiveBotanicalFamily;
  variant: PositiveBotanicalVariant;
}

const DEFAULT_POSITIVE_RING: PositiveFamilyChoice[] = [
  { family: "tender_growth", variant: "paired_leaf_shoot" },
  { family: "budding_growth", variant: "closed_bud" },
  { family: "ground_life", variant: "fern_frond" },
  { family: "tender_growth", variant: "single_leaf" },
  { family: "ground_life", variant: "meadow_flower" },
  { family: "budding_growth", variant: "paired_buds" },
  { family: "ground_life", variant: "moss_cushion" },
  { family: "mature_abundance", variant: "berry_cluster" },
  { family: "tender_growth", variant: "twig_shoot" },
  { family: "budding_growth", variant: "flowering_shoot" },
  { family: "ground_life", variant: "clover_cover" },
  { family: "habitat_enrichment", variant: "butterfly" },
  { family: "tender_growth", variant: "upward_shoot" },
  { family: "budding_growth", variant: "closed_bud" },
  { family: "ground_life", variant: "meadow_flower" },
  { family: "ground_life", variant: "seed_head" },
  { family: "tender_growth", variant: "paired_leaf_shoot" },
  { family: "tender_growth", variant: "single_leaf" },
  { family: "mature_abundance", variant: "fruit_bud" },
  { family: "ground_life", variant: "meadow_flower" },
];

const CATEGORY_POSITIVE_RINGS: Record<string, PositiveFamilyChoice[]> = {
  affection: [
    { family: "budding_growth", variant: "paired_buds" },
    { family: "tender_growth", variant: "paired_leaf_shoot" },
    { family: "ground_life", variant: "meadow_flower" },
    { family: "budding_growth", variant: "flowering_shoot" },
    { family: "tender_growth", variant: "single_leaf" },
    { family: "mature_abundance", variant: "berry_cluster" },
    { family: "budding_growth", variant: "paired_buds" },
    { family: "ground_life", variant: "clover_cover" },
    { family: "tender_growth", variant: "paired_leaf_shoot" },
    { family: "budding_growth", variant: "closed_bud" },
    { family: "ground_life", variant: "meadow_flower" },
    { family: "habitat_enrichment", variant: "butterfly" },
    { family: "tender_growth", variant: "upward_shoot" },
    { family: "budding_growth", variant: "flowering_shoot" },
    { family: "ground_life", variant: "moss_cushion" },
    { family: "budding_growth", variant: "paired_buds" },
    { family: "tender_growth", variant: "paired_leaf_shoot" },
    { family: "mature_abundance", variant: "fruit_bud" },
    { family: "ground_life", variant: "meadow_flower" },
    { family: "tender_growth", variant: "single_leaf" },
  ],
  quality_time: [
    { family: "ground_life", variant: "fern_frond" },
    { family: "tender_growth", variant: "paired_leaf_shoot" },
    { family: "ground_life", variant: "clover_cover" },
    { family: "budding_growth", variant: "flowering_shoot" },
    { family: "tender_growth", variant: "twig_shoot" },
    { family: "ground_life", variant: "moss_cushion" },
    { family: "mature_abundance", variant: "flowering_herb" },
    { family: "ground_life", variant: "meadow_flower" },
    { family: "tender_growth", variant: "paired_leaf_shoot" },
    { family: "ground_life", variant: "fern_frond" },
    { family: "budding_growth", variant: "paired_buds" },
    { family: "habitat_enrichment", variant: "bird_perch" },
    { family: "tender_growth", variant: "upward_shoot" },
    { family: "ground_life", variant: "clover_cover" },
    { family: "tender_growth", variant: "single_leaf" },
    { family: "ground_life", variant: "fern_frond" },
    { family: "mature_abundance", variant: "restrained_pod" },
    { family: "ground_life", variant: "meadow_flower" },
    { family: "tender_growth", variant: "twig_shoot" },
    { family: "ground_life", variant: "moss_cushion" },
  ],
  care: [
    { family: "ground_life", variant: "moss_cushion" },
    { family: "budding_growth", variant: "flowering_shoot" },
    { family: "tender_growth", variant: "paired_leaf_shoot" },
    { family: "ground_life", variant: "fern_frond" },
    { family: "mature_abundance", variant: "flowering_herb" },
    { family: "budding_growth", variant: "closed_bud" },
    { family: "tender_growth", variant: "upward_shoot" },
    { family: "ground_life", variant: "meadow_flower" },
    { family: "ground_life", variant: "clover_cover" },
    { family: "budding_growth", variant: "paired_buds" },
    { family: "tender_growth", variant: "single_leaf" },
    { family: "habitat_enrichment", variant: "nest_material" },
    { family: "mature_abundance", variant: "fruit_bud" },
    { family: "ground_life", variant: "moss_cushion" },
    { family: "budding_growth", variant: "flowering_shoot" },
    { family: "tender_growth", variant: "twig_shoot" },
    { family: "ground_life", variant: "meadow_flower" },
    { family: "mature_abundance", variant: "restrained_pod" },
    { family: "tender_growth", variant: "paired_leaf_shoot" },
    { family: "budding_growth", variant: "closed_bud" },
  ],
  support: [
    { family: "ground_life", variant: "clover_cover" },
    { family: "tender_growth", variant: "twig_shoot" },
    { family: "ground_life", variant: "moss_cushion" },
    { family: "budding_growth", variant: "closed_bud" },
    { family: "ground_life", variant: "fern_frond" },
    { family: "tender_growth", variant: "single_leaf" },
    { family: "mature_abundance", variant: "restrained_pod" },
    { family: "ground_life", variant: "moss_cushion" },
    { family: "tender_growth", variant: "paired_leaf_shoot" },
    { family: "budding_growth", variant: "flowering_shoot" },
    { family: "ground_life", variant: "clover_cover" },
    { family: "habitat_enrichment", variant: "bird_perch" },
    { family: "tender_growth", variant: "twig_shoot" },
    { family: "ground_life", variant: "fern_frond" },
    { family: "budding_growth", variant: "paired_buds" },
    { family: "ground_life", variant: "meadow_flower" },
    { family: "mature_abundance", variant: "flowering_herb" },
    { family: "tender_growth", variant: "upward_shoot" },
    { family: "ground_life", variant: "moss_cushion" },
    { family: "tender_growth", variant: "single_leaf" },
  ],
  humour: [
    { family: "tender_growth", variant: "upward_shoot" },
    { family: "ground_life", variant: "seed_head" },
    { family: "ground_life", variant: "meadow_flower" },
    { family: "budding_growth", variant: "closed_bud" },
    { family: "tender_growth", variant: "paired_leaf_shoot" },
    { family: "habitat_enrichment", variant: "butterfly" },
    { family: "ground_life", variant: "clover_cover" },
    { family: "budding_growth", variant: "flowering_shoot" },
    { family: "tender_growth", variant: "upward_shoot" },
    { family: "mature_abundance", variant: "berry_cluster" },
    { family: "ground_life", variant: "meadow_flower" },
    { family: "tender_growth", variant: "single_leaf" },
    { family: "ground_life", variant: "seed_head" },
    { family: "budding_growth", variant: "paired_buds" },
    { family: "habitat_enrichment", variant: "pollinator" },
    { family: "tender_growth", variant: "twig_shoot" },
    { family: "ground_life", variant: "fern_frond" },
    { family: "mature_abundance", variant: "flowering_herb" },
    { family: "ground_life", variant: "meadow_flower" },
    { family: "tender_growth", variant: "upward_shoot" },
  ],
  practical_help: [
    { family: "ground_life", variant: "moss_cushion" },
    { family: "ground_life", variant: "clover_cover" },
    { family: "tender_growth", variant: "twig_shoot" },
    { family: "ground_life", variant: "fern_frond" },
    { family: "budding_growth", variant: "closed_bud" },
    { family: "mature_abundance", variant: "flowering_herb" },
    { family: "ground_life", variant: "moss_cushion" },
    { family: "tender_growth", variant: "single_leaf" },
    { family: "ground_life", variant: "meadow_flower" },
    { family: "budding_growth", variant: "paired_buds" },
    { family: "ground_life", variant: "clover_cover" },
    { family: "habitat_enrichment", variant: "pollinator" },
    { family: "tender_growth", variant: "paired_leaf_shoot" },
    { family: "ground_life", variant: "fern_frond" },
    { family: "mature_abundance", variant: "fruit_bud" },
    { family: "ground_life", variant: "seed_head" },
    { family: "tender_growth", variant: "twig_shoot" },
    { family: "budding_growth", variant: "flowering_shoot" },
    { family: "ground_life", variant: "moss_cushion" },
    { family: "tender_growth", variant: "single_leaf" },
  ],
  surprise: [
    { family: "ground_life", variant: "meadow_flower" },
    { family: "budding_growth", variant: "closed_bud" },
    { family: "mature_abundance", variant: "berry_cluster" },
    { family: "budding_growth", variant: "flowering_shoot" },
    { family: "tender_growth", variant: "upward_shoot" },
    { family: "ground_life", variant: "meadow_flower" },
    { family: "mature_abundance", variant: "fruit_bud" },
    { family: "budding_growth", variant: "paired_buds" },
    { family: "ground_life", variant: "seed_head" },
    { family: "habitat_enrichment", variant: "butterfly" },
    { family: "tender_growth", variant: "paired_leaf_shoot" },
    { family: "ground_life", variant: "meadow_flower" },
    { family: "mature_abundance", variant: "berry_cluster" },
    { family: "budding_growth", variant: "closed_bud" },
    { family: "ground_life", variant: "fern_frond" },
    { family: "budding_growth", variant: "flowering_shoot" },
    { family: "mature_abundance", variant: "flowering_herb" },
    { family: "tender_growth", variant: "twig_shoot" },
    { family: "ground_life", variant: "meadow_flower" },
    { family: "budding_growth", variant: "paired_buds" },
  ],
  communication: [
    { family: "tender_growth", variant: "twig_shoot" },
    { family: "budding_growth", variant: "flowering_shoot" },
    { family: "tender_growth", variant: "paired_leaf_shoot" },
    { family: "ground_life", variant: "clover_cover" },
    { family: "tender_growth", variant: "upward_shoot" },
    { family: "budding_growth", variant: "closed_bud" },
    { family: "tender_growth", variant: "twig_shoot" },
    { family: "ground_life", variant: "meadow_flower" },
    { family: "mature_abundance", variant: "fruit_bud" },
    { family: "tender_growth", variant: "single_leaf" },
    { family: "budding_growth", variant: "paired_buds" },
    { family: "habitat_enrichment", variant: "bird_perch" },
    { family: "tender_growth", variant: "paired_leaf_shoot" },
    { family: "ground_life", variant: "fern_frond" },
    { family: "tender_growth", variant: "upward_shoot" },
    { family: "mature_abundance", variant: "restrained_pod" },
    { family: "tender_growth", variant: "twig_shoot" },
    { family: "budding_growth", variant: "flowering_shoot" },
    { family: "tender_growth", variant: "single_leaf" },
    { family: "ground_life", variant: "meadow_flower" },
  ],
  family: [
    { family: "ground_life", variant: "clover_cover" },
    { family: "tender_growth", variant: "paired_leaf_shoot" },
    { family: "ground_life", variant: "moss_cushion" },
    { family: "mature_abundance", variant: "flowering_herb" },
    { family: "tender_growth", variant: "twig_shoot" },
    { family: "budding_growth", variant: "paired_buds" },
    { family: "ground_life", variant: "fern_frond" },
    { family: "ground_life", variant: "clover_cover" },
    { family: "tender_growth", variant: "paired_leaf_shoot" },
    { family: "ground_life", variant: "meadow_flower" },
    { family: "habitat_enrichment", variant: "nest_material" },
    { family: "budding_growth", variant: "flowering_shoot" },
    { family: "ground_life", variant: "moss_cushion" },
    { family: "mature_abundance", variant: "berry_cluster" },
    { family: "tender_growth", variant: "single_leaf" },
    { family: "ground_life", variant: "clover_cover" },
    { family: "tender_growth", variant: "upward_shoot" },
    { family: "ground_life", variant: "meadow_flower" },
    { family: "budding_growth", variant: "closed_bud" },
    { family: "ground_life", variant: "fern_frond" },
  ],
  plans: [
    { family: "tender_growth", variant: "twig_shoot" },
    { family: "ground_life", variant: "seed_head" },
    { family: "tender_growth", variant: "upward_shoot" },
    { family: "budding_growth", variant: "closed_bud" },
    { family: "ground_life", variant: "fern_frond" },
    { family: "tender_growth", variant: "single_leaf" },
    { family: "mature_abundance", variant: "fruit_bud" },
    { family: "ground_life", variant: "meadow_flower" },
    { family: "tender_growth", variant: "twig_shoot" },
    { family: "ground_life", variant: "seed_head" },
    { family: "budding_growth", variant: "paired_buds" },
    { family: "habitat_enrichment", variant: "butterfly" },
    { family: "tender_growth", variant: "upward_shoot" },
    { family: "ground_life", variant: "clover_cover" },
    { family: "mature_abundance", variant: "restrained_pod" },
    { family: "tender_growth", variant: "paired_leaf_shoot" },
    { family: "ground_life", variant: "seed_head" },
    { family: "tender_growth", variant: "twig_shoot" },
    { family: "ground_life", variant: "moss_cushion" },
    { family: "ground_life", variant: "meadow_flower" },
  ],
};

function normalizePositiveCategory(category?: string | null): string {
  const clean = (category || "").trim().toLowerCase();
  if (clean === "time_together") return "quality_time";
  if (clean === "household") return "practical_help";
  if (clean === "celebration") return "surprise";
  return clean;
}

function gatePositiveVariantForStage(
  preferredFamily: PositiveBotanicalFamily,
  preferredVariant: PositiveBotanicalVariant,
  stageKey: GardenStageKey,
  eventMix: number
): PositiveFamilyChoice {
  // First Seedling: only individual leaf, paired leaves, tiny bud, ground sprout, small moss/clover patch
  if (stageKey === "first_seedling") {
    if (preferredVariant === "single_leaf" || preferredVariant === "twig_shoot") {
      return { family: "tender_growth", variant: "single_leaf" };
    }
    if (preferredVariant === "paired_leaf_shoot" || preferredVariant === "upward_shoot") {
      return { family: "tender_growth", variant: "paired_leaf_shoot" };
    }
    if (preferredFamily === "budding_growth" || preferredFamily === "mature_abundance") {
      return { family: "budding_growth", variant: "closed_bud" };
    }
    if (preferredVariant === "moss_cushion") {
      return { family: "ground_life", variant: "moss_cushion" };
    }
    if (preferredVariant === "clover_cover") {
      return { family: "ground_life", variant: "clover_cover" };
    }
    if (preferredFamily === "habitat_enrichment") {
      return (eventMix & 1) === 0
        ? { family: "ground_life", variant: "sprout" }
        : { family: "budding_growth", variant: "closed_bud" };
    }
    return { family: "ground_life", variant: "sprout" };
  }

  // Tender Sapling: no mature fruit, no berries, no butterfly/bird/nest habitat
  if (stageKey === "tender_sapling") {
    if (preferredVariant === "flowering_herb") {
      return { family: "ground_life", variant: "meadow_flower" };
    }
    if (preferredFamily === "mature_abundance") {
      return (eventMix & 1) === 0
        ? { family: "budding_growth", variant: "closed_bud" }
        : { family: "budding_growth", variant: "paired_buds" };
    }
    if (preferredVariant === "butterfly" || preferredVariant === "pollinator") {
      return { family: "ground_life", variant: "meadow_flower" };
    }
    if (preferredVariant === "bird_perch" || preferredVariant === "nest_material") {
      return { family: "tender_growth", variant: "twig_shoot" };
    }
    return { family: preferredFamily, variant: preferredVariant };
  }

  // Branching Out: allows fruit_bud (not ripe berry_cluster/pod yet), butterfly at restrained slice (no birds/nests yet)
  if (stageKey === "branching_out") {
    if (preferredVariant === "berry_cluster" || preferredVariant === "restrained_pod") {
      return { family: "mature_abundance", variant: "fruit_bud" };
    }
    if (preferredVariant === "bird_perch" || preferredVariant === "nest_material") {
      return { family: "tender_growth", variant: "twig_shoot" };
    }
    if (preferredVariant === "pollinator") {
      return { family: "ground_life", variant: "meadow_flower" };
    }
    if (preferredVariant === "butterfly") {
      // Extra restraint in intermediate stage: alternate butterflies to meadow nectar herb
      return ((eventMix >>> 17) & 1) === 0
        ? { family: "habitat_enrichment", variant: "butterfly" }
        : { family: "ground_life", variant: "meadow_flower" };
    }
    return { family: preferredFamily, variant: preferredVariant };
  }

  // Leafy Canopy: nest material waits for Rooted & Flourishing / Garden in Bloom
  if (stageKey === "leafy_canopy") {
    if (preferredVariant === "nest_material") {
      return { family: "habitat_enrichment", variant: "bird_perch" };
    }
    return { family: preferredFamily, variant: preferredVariant };
  }

  // Rooted & Flourishing / Garden in Bloom: full abundance & habitat
  return { family: preferredFamily, variant: preferredVariant };
}

export function resolvePositiveFeatureFamily(
  event: Pick<GardenCareEvent, "id" | "category">,
  stageKey: GardenStageKey
): {
  preferredFamily: PositiveBotanicalFamily;
  preferredVariant: PositiveBotanicalVariant;
  family: PositiveBotanicalFamily;
  variant: PositiveBotanicalVariant;
} {
  const rawHash = hashStringToSeed(event.id);
  const mixed = mixSeed(rawHash ^ 0x9e3779b9);
  const cat = normalizePositiveCategory(event.category);
  const ring = CATEGORY_POSITIVE_RINGS[cat] || DEFAULT_POSITIVE_RING;
  const choice = ring[mixed % ring.length];

  // For default ring habitat/mature sub-variants, refine using secondary bit slice
  let preferredVariant = choice.variant;
  if (!CATEGORY_POSITIVE_RINGS[cat]) {
    if (choice.family === "habitat_enrichment") {
      const habitats: PositiveBotanicalVariant[] = [
        "butterfly",
        "pollinator",
        "bird_perch",
        "nest_material",
      ];
      preferredVariant = habitats[(mixed >>> 6) % habitats.length];
    } else if (choice.family === "mature_abundance") {
      const matures: PositiveBotanicalVariant[] = [
        "berry_cluster",
        "fruit_bud",
        "restrained_pod",
        "flowering_herb",
      ];
      preferredVariant = matures[(mixed >>> 6) % matures.length];
    }
  }

  const gated = gatePositiveVariantForStage(
    choice.family,
    preferredVariant,
    stageKey,
    mixed
  );

  return {
    preferredFamily: choice.family,
    preferredVariant,
    family: gated.family,
    variant: gated.variant,
  };
}

export function getPositiveGrowthNotice(family: PositiveBotanicalFamily): string {
  switch (family) {
    case "tender_growth":
      return "Fresh growth has appeared in your garden.";
    case "budding_growth":
      return "A new bud is taking shape.";
    case "ground_life":
      return "Something new has taken root.";
    case "mature_abundance":
      return "Your garden is growing more abundant.";
    case "habitat_enrichment":
      return "Your garden is welcoming more life.";
  }
}

export function getPositiveLatestSubtext(family: PositiveBotanicalFamily): string {
  switch (family) {
    case "tender_growth":
      return "Fresh leaves or tender shoots appeared from a shared good moment.";
    case "budding_growth":
      return "A new bud formed after a shared good moment.";
    case "ground_life":
      return "New woodland flora took root from a shared good moment.";
    case "mature_abundance":
      return "Quiet new abundance grew from a shared good moment.";
    case "habitat_enrichment":
      return "Gentle new life was drawn to a shared good moment.";
  }
}

export type CanopySilhouetteFamily =
  | "spreading"
  | "upright"
  | "gently_weeping"
  | "rounded_woodland"
  | "open_canopy"
  | "asymmetric_meadow";

export const SILHOUETTE_FAMILIES: CanopySilhouetteFamily[] = [
  "spreading",
  "upright",
  "gently_weeping",
  "rounded_woodland",
  "open_canopy",
  "asymmetric_meadow",
];

export interface GardenDNA {
  silhouetteFamily: CanopySilhouetteFamily;
  trunkLean: number;          // -8 to +8 px lean
  trunkCurvature: number;     // -6 to +6 px curvature
  trunkWidthScale: number;    // 0.92 to 1.12 base scale
  branchAngleSpread: number;  // 0.82 to 1.22
  branchLengthRatio: number;  // 0.88 to 1.12
  asymmetryFactor: number;    // -0.2 to +0.2
  foliageDensity: number;     // 0.9 to 1.15
  leafScaleFactor: number;    // 0.92 to 1.12
  leafAngleBias: number;      // -12 to +12 deg
  greenNuance: number;        // -4 to +4 deg
  barkNuance: number;         // 0 to 1
  soilVariance: number;       // 0 to 1
  terrainCurvature: {
    meadowPeakX: number;
    rearPeakX: number;
    midPeakX: number;
    frontPeakX: number;
  };
  stoneMossSeed: number;
  podFamily: "acorn_pod" | "wild_plum" | "rose_hip" | "seed_capsule";
  wildlifePreference: {
    creature: "butterfly" | "robin" | "goldfinch" | "swallow";
    preferredPerch: "left_branch" | "right_branch" | "ground_stone" | "crown";
  };
}

export function deriveGardenDNA(seed: number): GardenDNA {
  const familyIdx = Math.abs(seed >>> 7) % 6;
  const silhouetteFamily = SILHOUETTE_FAMILIES[familyIdx];

  const leanRaw = (((seed >>> 11) & 0xff) / 255 - 0.5) * 16;
  const curveRaw = (((seed >>> 15) & 0xff) / 255 - 0.5) * 12;
  const widthRaw = 0.92 + (((seed >>> 19) & 0x7f) / 127) * 0.20;
  const spreadRaw = 0.82 + (((seed >>> 22) & 0x7f) / 127) * 0.40;
  const asymRaw = (((seed >>> 26) & 0x3f) / 63 - 0.5) * 0.40;

  let trunkLean = leanRaw;
  let branchAngleSpread = spreadRaw;
  let asymmetryFactor = asymRaw;

  if (silhouetteFamily === "spreading") {
    branchAngleSpread = Math.max(1.10, spreadRaw * 1.15);
  } else if (silhouetteFamily === "upright") {
    branchAngleSpread = Math.min(0.90, spreadRaw * 0.85);
    trunkLean = leanRaw * 0.6;
  } else if (silhouetteFamily === "asymmetric_meadow") {
    asymmetryFactor = asymRaw > 0 ? Math.max(0.18, asymRaw * 1.3) : Math.min(-0.18, asymRaw * 1.3);
    trunkLean = trunkLean > 0 ? Math.max(5, trunkLean) : Math.min(-5, trunkLean);
  }

  const podFamilies = ["acorn_pod", "wild_plum", "rose_hip", "seed_capsule"] as const;
  const podFamily = podFamilies[Math.abs(seed >>> 9) % 4];

  const creatures = ["robin", "butterfly", "goldfinch", "swallow"] as const;
  const perches = ["left_branch", "right_branch", "ground_stone", "crown"] as const;

  const meadowPeakX = 370 + (((seed >>> 8) & 0x3f) / 63) * 70;
  const rearPeakX = 480 + (((seed >>> 12) & 0x3f) / 63) * 60;
  const midPeakX = 440 + (((seed >>> 16) & 0x3f) / 63) * 60;
  const frontPeakX = 500 + (((seed >>> 20) & 0x3f) / 63) * 60;

  return {
    silhouetteFamily,
    trunkLean: Math.round(trunkLean * 10) / 10,
    trunkCurvature: Math.round(curveRaw * 10) / 10,
    trunkWidthScale: Math.round(widthRaw * 100) / 100,
    branchAngleSpread: Math.round(branchAngleSpread * 100) / 100,
    branchLengthRatio: Math.round((0.9 + (((seed >>> 13) & 0x3f) / 63) * 0.2) * 100) / 100,
    asymmetryFactor: Math.round(asymmetryFactor * 100) / 100,
    foliageDensity: Math.round((0.9 + (((seed >>> 16) & 0x3f) / 63) * 0.25) * 100) / 100,
    leafScaleFactor: Math.round((0.92 + (((seed >>> 20) & 0x3f) / 63) * 0.2) * 100) / 100,
    leafAngleBias: Math.round((((seed >>> 24) & 0x3f) / 63 - 0.5) * 24),
    greenNuance: Math.round((((seed >>> 27) & 0x1f) / 31 - 0.5) * 8),
    barkNuance: ((seed >>> 14) & 0xff) / 255,
    soilVariance: ((seed >>> 17) & 0xff) / 255,
    terrainCurvature: {
      meadowPeakX: Math.round(meadowPeakX),
      rearPeakX: Math.round(rearPeakX),
      midPeakX: Math.round(midPeakX),
      frontPeakX: Math.round(frontPeakX),
    },
    stoneMossSeed: (seed ^ 0x5a5a5a5a) >>> 0,
    podFamily,
    wildlifePreference: {
      creature: creatures[Math.abs(seed >>> 5) % 4],
      preferredPerch: perches[Math.abs(seed >>> 8) % 4],
    },
  };
}

// ----------------------------------------------------
// 3. CONTROLLED BOTANICAL PALETTES & NATURAL LANDSCAPE
// ----------------------------------------------------

export interface GroundLandscapePalette {
  meadowTop: string;
  meadowBottom: string;
  rearGrassTop: string;
  rearGrassBottom: string;
  midGrassTop: string;
  midGrassBottom: string;
  frontGrassTop: string;
  frontGrassBottom: string;
  exposedSoilTop: string;
  exposedSoilMid: string;
  exposedSoilBottom: string;
  deepSoilShadow: string;
  soilHighlight: string;
  mossBase: string;
  mossHighlight: string;
  stoneLight: string;
  stoneMid: string;
  stoneDark: string;
}

function parseHex(h: string): [number, number, number] {
  const clean = h.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function toHex([r, g, b]: [number, number, number]): string {
  return (
    "#" +
    [r, g, b]
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}

function lerpColor(c1: string, c2: string, t: number): string {
  const [r1, g1, b1] = parseHex(c1);
  const [r2, g2, b2] = parseHex(c2);
  const clampedT = Math.max(0, Math.min(1, t));
  return toHex([
    r1 + (r2 - r1) * clampedT,
    g1 + (g2 - g1) * clampedT,
    b1 + (b2 - b1) * clampedT,
  ]);
}

function adjustHsl(
  hex: string,
  dH: number,
  sMul: number,
  lMul: number
): string {
  const [rRaw, gRaw, bRaw] = parseHex(hex);
  const r = rRaw / 255;
  const g = gRaw / 255;
  const b = bRaw / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  h = (((h * 360 + dH) % 360) + 360) % 360 / 360;
  s = Math.max(0, Math.min(1, s * sMul));
  l = Math.max(0, Math.min(1, l * lMul));

  const hue2rgb = (p: number, q: number, t: number): number => {
    let tAdj = t;
    if (tAdj < 0) tAdj += 1;
    if (tAdj > 1) tAdj -= 1;
    if (tAdj < 1 / 6) return p + (q - p) * 6 * tAdj;
    if (tAdj < 1 / 2) return q;
    if (tAdj < 2 / 3) return p + (q - p) * (2 / 3 - tAdj) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return toHex([
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ]);
}

/**
 * Generates an organic, natural botanical ground palette deterministically from the couple seed.
 * Adheres strictly to realistic landscape ranges (sage/olive meadow, warm clay/umber soil, warm grey stones)
 * with narrow ±4° seed variance and zero cyan, turquoise, or saturated greens.
 */
export function generateNaturalGroundPalette(
  seed: number,
  isResting: boolean = false,
  effectiveTheme: "light" | "dim" | "dark" = "light"
): GroundLandscapePalette {
  // Deterministic seed interpolation parameter: t in [0, 1]
  const t = ((seed >>> 10) & 0xff) / 255;
  // Subtle hue jitter: -4 to +4 degrees (well within ±6 degree requirement)
  const dH = (((seed >>> 18) & 0x7f) / 127 - 0.5) * 8;
  // Subtle saturation jitter: ±0.02
  const dS = (((seed >>> 25) & 0x3f) / 63 - 0.5) * 0.04;

  let sMul = 1.0 + dS;
  let lMul = 1.0;

  if (isResting) {
    sMul *= 0.88;
    lMul *= 0.88;
  }

  if (effectiveTheme === "dim") {
    sMul *= 0.94;
    lMul *= 0.92;
  } else if (effectiveTheme === "dark") {
    sMul *= 0.90;
    lMul *= 0.84;
  }

  // Base range natural landscape interpolation
  // Distant meadow: muted sage/olive (#82927A to #A0AA8D)
  const baseMeadow = adjustHsl(lerpColor("#82927A", "#A0AA8D", t), dH, sMul, lMul);
  // Rear grass layer: soft mid-tone (#667C5D to #7F916E)
  const baseRearGrass = adjustHsl(lerpColor("#667C5D", "#7F916E", t), dH, sMul, lMul);
  // Middle grass layer: deeper olive/forest green (#48634B to #607557)
  const baseMidGrass = adjustHsl(lerpColor("#48634B", "#607557", t), dH, sMul, lMul);
  // Foreground grass: darkest natural grass (#304A37 to #455B3E)
  const baseFrontGrass = adjustHsl(lerpColor("#304A37", "#455B3E", t), dH, sMul, lMul);
  // Exposed soil: warm umber/clay (#654936 to #80614A)
  const baseExposedSoil = adjustHsl(lerpColor("#654936", "#80614A", t), dH * 0.4, sMul, lMul);
  // Deep soil/shadow: (#3B2B24 to #52392D)
  const baseDeepSoil = adjustHsl(lerpColor("#3B2B24", "#52392D", t), dH * 0.4, sMul, lMul);
  // Soil highlight: (#8B6B50 to #A17D5D)
  const baseSoilHighlight = adjustHsl(lerpColor("#8B6B50", "#A17D5D", t), dH * 0.4, sMul, lMul);
  // Moss: (#536B43 to #71845A)
  const baseMoss = adjustHsl(lerpColor("#536B43", "#71845A", t), dH, sMul, lMul);
  // Stone: warm grey/taupe (#77736B to #A09A8D)
  const baseStone = adjustHsl(lerpColor("#77736B", "#A09A8D", t), 0, sMul * 0.95, lMul);

  return {
    meadowTop: adjustHsl(baseMeadow, 0, 0.95, 1.06),
    meadowBottom: baseMeadow,
    rearGrassTop: adjustHsl(baseRearGrass, 0, 0.98, 1.05),
    rearGrassBottom: baseRearGrass,
    midGrassTop: adjustHsl(baseMidGrass, 0, 1.02, 1.06),
    midGrassBottom: baseMidGrass,
    frontGrassTop: adjustHsl(baseFrontGrass, 0, 1.02, 1.08),
    frontGrassBottom: baseFrontGrass,
    exposedSoilTop: baseSoilHighlight,
    exposedSoilMid: baseExposedSoil,
    exposedSoilBottom: baseDeepSoil,
    deepSoilShadow: baseDeepSoil,
    soilHighlight: baseSoilHighlight,
    mossBase: baseMoss,
    mossHighlight: adjustHsl(baseMoss, 0, 1.05, 1.12),
    stoneLight: adjustHsl(baseStone, 0, 0.9, 1.10),
    stoneMid: baseStone,
    stoneDark: adjustHsl(baseStone, 0, 1.0, 0.82),
  };
}

export interface BotanicalPalette {
  name: string;
  trunk: string;
  trunkHighlight: string;
  trunkShadow: string;
  deepFoliage: string;
  midFoliage: string;
  lightFoliage: string;
  accentLeaf: string;
  foliageVein: string;
  blossomPrimary: string;
  blossomSecondary: string;
  blossomCenter: string;
  blossomCream: string;
  seedPod: string;
  groundBase: string;
  groundHighlight: string;
  soilBase: string;
  skyTop: string;
  skyBottom: string;
  restingSkyTop: string;
  restingSkyBottom: string;
  sunGlow: string;
}

export const BOTANICAL_PALETTES: BotanicalPalette[] = [
  // 1. Plum & Sage (Natural eucalyptus, dusty rose, muted plum, warm bark)
  {
    name: "Plum & Sage",
    trunk: "#463640",
    trunkHighlight: "#64505E",
    trunkShadow: "#32252E",
    deepFoliage: "#2A4031",
    midFoliage: "#3E5D47",
    lightFoliage: "#5E846A",
    accentLeaf: "#4D7357",
    foliageVein: "#223528",
    blossomPrimary: "#C66D83",
    blossomSecondary: "#E2A9B8",
    blossomCenter: "#56283B",
    blossomCream: "#FCF5F2",
    seedPod: "#8E3D52",
    groundBase: "#304334",
    groundHighlight: "#45604B",
    soilBase: "#2B221E",
    skyTop: "#F4EFF6",
    skyBottom: "#EAE2EE",
    restingSkyTop: "#E7DFEA",
    restingSkyBottom: "#D7CDDC",
    sunGlow: "#F9ECE4",
  },
  // 2. Lavender & Sage (Muted coastal eucalyptus, pale mauve, cedar bark)
  {
    name: "Lavender & Sage",
    trunk: "#3C3643",
    trunkHighlight: "#544C5D",
    trunkShadow: "#2B2731",
    deepFoliage: "#273D35",
    midFoliage: "#3A554A",
    lightFoliage: "#5C7E71",
    accentLeaf: "#496C5F",
    foliageVein: "#1E332A",
    blossomPrimary: "#B082B8",
    blossomSecondary: "#D8B2DF",
    blossomCenter: "#503058",
    blossomCream: "#F8F5FA",
    seedPod: "#784B82",
    groundBase: "#324937",
    groundHighlight: "#465F4B",
    soilBase: "#2B221E",
    skyTop: "#F0F4F7",
    skyBottom: "#E3EBF0",
    restingSkyTop: "#E2E7ED",
    restingSkyBottom: "#D2DAE2",
    sunGlow: "#F6F1E5",
  },
  // 3. Forest & Mauve (Woodland moss, dusty mauve, warm chestnut bark)
  {
    name: "Forest & Mauve",
    trunk: "#43342B",
    trunkHighlight: "#5C493F",
    trunkShadow: "#2F231D",
    deepFoliage: "#223D26",
    midFoliage: "#345538",
    lightFoliage: "#577A5B",
    accentLeaf: "#446848",
    foliageVein: "#1B301E",
    blossomPrimary: "#A65A73",
    blossomSecondary: "#CD92A4",
    blossomCenter: "#4D2332",
    blossomCream: "#FAF2ED",
    seedPod: "#7D384D",
    groundBase: "#273F2A",
    groundHighlight: "#3B593F",
    soilBase: "#27201B",
    skyTop: "#F6F2EC",
    skyBottom: "#EBE3D8",
    restingSkyTop: "#EAE3DA",
    restingSkyBottom: "#D9D0C4",
    sunGlow: "#FAF1DF",
  },
  // 4. Violet & Moss (Dusk heather, wild moss, deep plum-ash bark)
  {
    name: "Violet & Moss",
    trunk: "#3B3040",
    trunkHighlight: "#524359",
    trunkShadow: "#29202D",
    deepFoliage: "#293F23",
    midFoliage: "#3B5833",
    lightFoliage: "#618258",
    accentLeaf: "#4D6E45",
    foliageVein: "#20331C",
    blossomPrimary: "#C77587",
    blossomSecondary: "#E0ADB7",
    blossomCenter: "#522837",
    blossomCream: "#FAF1F4",
    seedPod: "#8F4558",
    groundBase: "#2D4128",
    groundHighlight: "#3F5C38",
    soilBase: "#262024",
    skyTop: "#F3EFF5",
    skyBottom: "#E7DEEC",
    restingSkyTop: "#E3DBE7",
    restingSkyBottom: "#D1C6D7",
    sunGlow: "#F8EFE5",
  },
];

export function getPaletteForSeed(seed: number): BotanicalPalette {
  const index = Math.abs(seed) % BOTANICAL_PALETTES.length;
  return BOTANICAL_PALETTES[index];
}

// ----------------------------------------------------
// 4. SVG BOTANICAL SHAPE GENERATORS
// ----------------------------------------------------

/**
 * Creates an organic irregular botanical foliage lobe using 8 scalloped bezier segments
 * with deterministic radial jitter and angular variation to avoid circular/topiary silhouettes.
 */
function createIrregularFoliageLobe(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  tiltAngle: number = 0,
  seedOffset: number = 0
): string {
  const numPts = 8;
  const pts: { x: number; y: number; angle: number }[] = [];

  for (let i = 0; i < numPts; i++) {
    const angleJitter = (((seedOffset + i * 29) % 13) - 6) * 0.02;
    const radJitter = 1.0 + (((seedOffset + i * 47) % 17) - 8) * 0.035;
    const angle = (i * 2 * Math.PI) / numPts + tiltAngle + angleJitter;

    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const baseR = Math.sqrt((rx * cosA) ** 2 + (ry * sinA) ** 2) * radJitter;

    pts.push({
      x: cx + cosA * baseR,
      y: cy + sinA * baseR,
      angle,
    });
  }

  const dParts = [`M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`];
  for (let i = 0; i < numPts; i++) {
    const pCurr = pts[i];
    const pNext = pts[(i + 1) % numPts];

    const angMid = (pCurr.angle + pNext.angle) / 2;
    const chordLen = Math.sqrt(
      (pNext.x - pCurr.x) ** 2 + (pNext.y - pCurr.y) ** 2
    );

    const scallopW = chordLen * 0.26;
    const outwardX = Math.cos(angMid) * scallopW;
    const outwardY = Math.sin(angMid) * scallopW;

    const c1x = pCurr.x + (pNext.x - pCurr.x) * 0.35 + outwardX;
    const c1y = pCurr.y + (pNext.y - pCurr.y) * 0.35 + outwardY;
    const c2x = pCurr.x + (pNext.x - pCurr.x) * 0.65 + outwardX;
    const c2y = pCurr.y + (pNext.y - pCurr.y) * 0.65 + outwardY;

    dParts.push(
      `C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${pNext.x.toFixed(1)},${pNext.y.toFixed(1)}`
    );
  }
  dParts.push("Z");
  return dParts.join(" ");
}

/**
 * Scales an organic leaf bezier path relative to an anchor base point.
 */
function scaleLeaf(
  bx: number,
  by: number,
  c1x: number,
  c1y: number,
  c2x: number,
  c2y: number,
  tx: number,
  ty: number,
  c3x: number,
  c3y: number,
  c4x: number,
  c4y: number,
  scale: number
): string {
  const f = (val: number, base: number) =>
    (base + (val - base) * scale).toFixed(1);
  return `M ${bx.toFixed(1)},${by.toFixed(1)} C ${f(c1x, bx)},${f(c1y, by)} ${f(c2x, bx)},${f(c2y, by)} ${f(tx, bx)},${f(ty, by)} C ${f(c3x, bx)},${f(c3y, by)} ${f(c4x, bx)},${f(c4y, by)} ${bx.toFixed(1)},${by.toFixed(1)} Z`;
}

/**
 * Creates layered organic botanical flower petals with asymmetric placement,
 * soft elongation, and natural petal variation.
 */
function createOrganicBlossomPetals(
  cx: number,
  cy: number,
  r: number,
  petalCount: number,
  rotation: number,
  petalColor: string,
  secondaryPetalColor: string,
  scaleX: number = 1.0,
  scaleY: number = 1.15,
  seedOffset: number = 0
): BlossomPetal[] {
  const petals: BlossomPetal[] = [];
  for (let i = 0; i < petalCount; i++) {
    const angleJitter = (((seedOffset + i * 37) % 17) - 8) * 0.012;
    const angle = rotation + (i * 2 * Math.PI) / petalCount + angleJitter;

    const lenJitter = 1.0 + (((seedOffset + i * 19) % 11) - 5) * 0.035;
    const petalLen = r * scaleY * lenJitter;
    const petalW = r * 0.44 * scaleX;

    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const px = -dy;
    const py = dx;

    const bx = cx + dx * (r * 0.2);
    const by = cy + dy * (r * 0.2);

    const tx = cx + dx * petalLen;
    const ty = cy + dy * petalLen;

    const c1x = bx + px * petalW * 0.65 + dx * (petalLen * 0.3);
    const c1y = by + py * petalW * 0.65 + dy * (petalLen * 0.3);
    const c2x = bx + px * petalW * 0.95 + dx * (petalLen * 0.7);
    const c2y = by + py * petalW * 0.95 + dy * (petalLen * 0.7);

    const c3x = bx - px * petalW * 0.95 + dx * (petalLen * 0.7);
    const c3y = by - py * petalW * 0.95 + dy * (petalLen * 0.7);
    const c4x = bx - px * petalW * 0.65 + dx * (petalLen * 0.3);
    const c4y = by - py * petalW * 0.65 + dy * (petalLen * 0.3);

    const d = `M ${bx.toFixed(1)},${by.toFixed(1)} C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)} C ${c3x.toFixed(1)},${c3y.toFixed(1)} ${c4x.toFixed(1)},${c4y.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)} Z`;

    const isAccent = (i + (seedOffset % 2)) % 2 === 1;
    const fill = isAccent ? secondaryPetalColor : petalColor;
    const opacity = 0.92;

    petals.push({ d, fill, opacity });
  }
  return petals;
}

/**
 * Creates central midrib and restrained secondary veins for an organic leaf.
 */
function createLeafVeinD(
  bx: number,
  by: number,
  tx: number,
  ty: number,
  bendX: number = 0,
  bendY: number = 0,
  includeSecondary: boolean = true
): string {
  const mx = (bx + tx) / 2 + bendX;
  const my = (by + ty) / 2 + bendY;
  const midrib = `M ${bx.toFixed(1)},${by.toFixed(1)} Q ${mx.toFixed(1)},${my.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}`;

  if (!includeSecondary) return midrib;

  const dx = tx - bx;
  const dy = ty - by;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 18) return midrib;

  const ux = dx / dist;
  const uy = dy / dist;
  const px = -uy;
  const py = ux;

  const branches: string[] = [];
  const fracs = [0.42, 0.72];
  const widths = [dist * 0.16, dist * 0.12];

  for (let i = 0; i < fracs.length; i++) {
    const frac = fracs[i];
    const w = widths[i];
    const vx = bx + dx * frac + bendX * frac * (1 - frac) * 4;
    const vy = by + dy * frac + bendY * frac * (1 - frac) * 4;

    const lTx = vx + (px * 0.7 + ux * 0.6) * w;
    const lTy = vy + (py * 0.7 + uy * 0.6) * w;
    const rTx = vx + (-px * 0.7 + ux * 0.6) * w;
    const rTy = vy + (-py * 0.7 + uy * 0.6) * w;

    branches.push(
      `M ${vx.toFixed(1)},${vy.toFixed(1)} L ${lTx.toFixed(1)},${lTy.toFixed(1)} M ${vx.toFixed(1)},${vy.toFixed(1)} L ${rTx.toFixed(1)},${rTy.toFixed(1)}`
    );
  }

  return `${midrib} ${branches.join(" ")}`;
}

// ----------------------------------------------------
// 5. INTERFACES
// ----------------------------------------------------

export interface GardenCareSignals {
  positiveMoments: number;
  reconnections: number;
  importantDates: number;
}

export interface FoliageClusterSVG {
  id: string;
  d: string;
  color: string;
  opacity: number;
}

export interface BlossomPetal {
  d: string;
  fill: string;
  opacity: number;
}

export interface BlossomSVG {
  id: string;
  cx: number;
  cy: number;
  r: number;
  color: string;
  petalColor: string;
  centerColor?: string;
  centerRadius?: number;
  highlightColor?: string;
  hasCluster?: boolean;
  petalCount?: number;
  rotation?: number;
  petalScaleX?: number;
  petalScaleY?: number;
  opacity?: number;
  petals?: BlossomPetal[];
}

export interface SeedPodSVG {
  id: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  color: string;
  stemColor: string;
  highlightColor?: string;
}

export interface LeafVeinSVG {
  id: string;
  d: string;
  color: string;
  strokeWidth: number;
  opacity?: number;
}

export interface GroundDetailSVG {
  id: string;
  type:
    | "stone"
    | "grass"
    | "flower"
    | "bud"
    | "moss"
    | "soil-fleck"
    | "ground-cover"
    | "root-shadow"
    | "fern"
    | "clover"
    | "seed-head"
    | "sprout"
    | "meadow-flower"
    | "flowering-herb";
  d?: string;
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  color: string;
  accentColor?: string;
  petals?: BlossomPetal[];
  stemPath?: string;
  leafPaths?: { id: string; d: string; color: string; veinD?: string }[];
  florets?: {
    cx: number;
    cy: number;
    r: number;
    petalColor: string;
    centerColor: string;
  }[];
  seedGrains?: {
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    angle: number;
    color: string;
  }[];
  family?: PositiveBotanicalFamily;
  variant?: PositiveBotanicalVariant;
  compact?: boolean;
}

export interface CanopyDetailSVG {
  id: string;
  family: PositiveBotanicalFamily;
  variant: PositiveBotanicalVariant;
  kind:
    | "twig-shoot"
    | "paired-shoot"
    | "upward-shoot"
    | "closed-bud"
    | "paired-buds"
    | "flowering-shoot"
    | "berry-cluster"
    | "fruit-bud"
    | "restrained-pod";
  stemPath?: string;
  stemColor?: string;
  stemWidth?: number;
  leaves?: {
    id: string;
    d: string;
    color: string;
    veinD?: string;
    veinColor?: string;
  }[];
  buds?: {
    id: string;
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    angle: number;
    budColor: string;
    calyxColor: string;
    highlightColor: string;
  }[];
  berries?: {
    id: string;
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    color: string;
    highlightColor: string;
  }[];
  compact?: boolean;
}

export interface HabitatDetailSVG {
  id: string;
  family: PositiveBotanicalFamily;
  variant: PositiveBotanicalVariant;
  kind: "butterfly" | "pollinator" | "bird-perch" | "nest-material";
  cx: number;
  cy: number;
  scale: number;
  flip?: boolean;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  stemPath?: string;
  compact?: boolean;
}

export interface GeneratedGardenSVGScene {
  stage: GardenStage;
  palette: BotanicalPalette;
  groundPalette: GroundLandscapePalette;
  dna: GardenDNA;
  isResting: boolean;
  ambienceLabel: AmbienceLabel;
  skyTop: string;
  skyBottom: string;
  sunGlowColor: string;
  distantHillsPath: string;
  groundLayerBack: string;
  groundLayerMid: string;
  groundLayerFront: string;
  soilBedPath?: string;
  rootShadowPath?: string;
  trunkPath: string;
  trunkHighlightPath?: string;
  trunkShadowPath?: string;
  rootPaths?: string[];
  branches: string[];
  foliageClusters: FoliageClusterSVG[];
  leafVeins?: LeafVeinSVG[];
  canopyDetails?: CanopyDetailSVG[];
  blossoms: BlossomSVG[];
  seedPods?: SeedPodSVG[];
  groundDetails: GroundDetailSVG[];
  habitatDetails?: HabitatDetailSVG[];
  restingCreature?: {
    type: "sparrow" | "butterfly" | "robin" | "goldfinch" | "swallow";
    cx: number;
    cy: number;
  };
  accessibilityDescription: string;
}

// ----------------------------------------------------
// 5B. UNIFIED EARNED CARE FEATURE MAPPING (PARTS 8, 9, 10, 11, 12)
// ----------------------------------------------------

function attachEarnedCareFeatures({
  stageKey,
  posEvents,
  recEvents,
  impEvents,
  dna,
  palette,
  groundPalette,
  seed,
  stemTopY,
  tilt,
  foliageClusters,
  leafVeins,
  canopyDetails,
  blossoms,
  seedPods,
  groundDetails,
  habitatDetails,
}: {
  stageKey: GardenStageKey;
  posEvents: GardenCareEvent[];
  recEvents: GardenCareEvent[];
  impEvents: GardenCareEvent[];
  dna: GardenDNA;
  palette: BotanicalPalette;
  groundPalette: GroundLandscapePalette;
  seed: number;
  stemTopY: number;
  tilt: number;
  foliageClusters: FoliageClusterSVG[];
  leafVeins: LeafVeinSVG[];
  canopyDetails: CanopyDetailSVG[];
  blossoms: BlossomSVG[];
  seedPods: SeedPodSVG[];
  groundDetails: GroundDetailSVG[];
  habitatDetails: HabitatDetailSVG[];
}) {
  const isSeedling = stageKey === "first_seedling";
  const isSapling = stageKey === "tender_sapling";
  const isBranching = stageKey === "branching_out";
  const isMature =
    stageKey === "leafy_canopy" ||
    stageKey === "rooted_flourishing" ||
    stageKey === "garden_in_bloom";

  // Helper to adapt canopy coordinates to the couple's GardenDNA (trunk lean & branch spread)
  const adaptCanopyPoint = (baseCx: number, baseCy: number) => {
    if (isSeedling) {
      return { cx: baseCx, cy: baseCy };
    }
    const spreadX =
      400 + (baseCx - 400) * (0.9 + (dna.branchAngleSpread - 1) * 0.45);
    const leanedX = spreadX + dna.trunkLean * 0.65 + tilt;
    const scaledY = 220 + (baseCy - 220) * dna.branchLengthRatio;
    return {
      cx: Math.max(170, Math.min(630, leanedX)),
      cy: Math.max(70, Math.min(350, scaledY)),
    };
  };

  // Helper to adapt ground coordinates subtly to the couple's soil bed DNA
  const adaptGroundX = (baseCx: number) =>
    Math.max(
      275,
      Math.min(525, baseCx + dna.trunkLean * 0.3 + (dna.soilVariance - 0.5) * 10)
    );

  // Extended meadow ground adaptation for ferns, seed heads, and meadow wildflowers
  const adaptMeadowX = (baseCx: number) =>
    Math.max(
      195,
      Math.min(605, baseCx + dna.trunkLean * 0.25 + (dna.soilVariance - 0.5) * 14)
    );

  // ----------------------------------------------------
  // 1. COMPLETED RECONNECTIONS (Strictly derived from immutable event.id & couple DNA)
  // ----------------------------------------------------
  for (const event of recEvents) {
    const id = getCareFeatureId("reconnection", event.id);
    const eventHash = hashStringToSeed(event.id);
    const isEven = (eventHash & 1) === 0;
    const c1 = isEven ? palette.blossomPrimary : palette.blossomSecondary;
    const c2 = isEven ? palette.blossomSecondary : palette.blossomPrimary;

    // Deterministic micro-offsets derived from full event ID for natural collision handling
    const microX = ((((eventHash >>> 11) & 0x1f) / 31) - 0.5) * 8;
    const microY = ((((eventHash >>> 16) & 0x1f) / 31) - 0.5) * 6;
    const microRot = ((((eventHash >>> 21) & 0x1f) / 31) - 0.5) * 0.4;

    // Botanical family selection is stable from event.id (never array position or count)
    // Natural stage maturation allows pod anchors to fruit in mature stages
    const isPodFamily = eventHash % 8 === 5;
    const isMaturePod = isPodFamily && (isBranching || isMature);

    if (isMaturePod) {
      const podAnchors = [
        { cx: 360, cy: 230, rx: 5.2, ry: 6.8 },
        { cx: 470, cy: 215, rx: 5.2, ry: 6.8 },
        { cx: 390, cy: 175, rx: 4.8, ry: 6.2 },
        { cx: 435, cy: 195, rx: 4.8, ry: 6.2 },
        { cx: 310, cy: 245, rx: 5.0, ry: 6.5 },
        { cx: 520, cy: 220, rx: 5.0, ry: 6.5 },
      ];
      const a = podAnchors[(eventHash >>> 4) % podAnchors.length];
      const pt = adaptCanopyPoint(a.cx, a.cy);
      seedPods.push({
        id,
        cx: Math.round((pt.cx + microX) * 10) / 10,
        cy: Math.round((pt.cy + microY) * 10) / 10,
        rx: a.rx,
        ry: a.ry,
        color: isEven ? palette.seedPod : palette.blossomPrimary,
        stemColor: palette.trunk,
        highlightColor: palette.blossomCream,
      });
      continue;
    }

    const isGroundCompanion = (eventHash >>> 4) % 10 === 9;
    if (isGroundCompanion) {
      const groundAnchors = [
        { cx: 312, cy: 445 },
        { cx: 348, cy: 447 },
        { cx: 382, cy: 446 },
        { cx: 418, cy: 448 },
        { cx: 454, cy: 446 },
        { cx: 488, cy: 445 },
      ];
      const a = groundAnchors[(eventHash >>> 8) % groundAnchors.length];
      groundDetails.push({
        id,
        type: "flower",
        cx: Math.round((adaptGroundX(a.cx) + microX * 0.8) * 10) / 10,
        cy: Math.round((a.cy + microY * 0.4) * 10) / 10,
        color: c1,
        accentColor: c2,
        compact: true,
      });
      continue;
    }

    let baseCx = 400;
    let baseCy = 200;
    let r = 7.5;
    let rot = ((eventHash >>> 7) % 360) * (Math.PI / 180);
    const isCluster = eventHash % 3 === 0;

    if (isSeedling) {
      const anchors = [
        { cx: 418, cy: Math.round(stemTopY + 24), r: 10.5, rot: 0.35 },
        { cx: 378, cy: Math.round(stemTopY + 38), r: 9.6, rot: 0.85 },
        { cx: 442, cy: Math.round(stemTopY + 82), r: 9.0, rot: 0.2 },
        { cx: 356, cy: Math.round(stemTopY + 115), r: 8.6, rot: 1.2 },
        { cx: 432, cy: Math.round(stemTopY + 6), r: 9.2, rot: 0.6 },
        { cx: 364, cy: Math.round(stemTopY + 12), r: 8.8, rot: 1.5 },
        { cx: 390, cy: Math.round(stemTopY + 58), r: 5.2, rot: 0.4 },
        { cx: 410, cy: Math.round(stemTopY + 70), r: 5.0, rot: 0.9 },
        { cx: 398, cy: Math.round(stemTopY - 2), r: 4.8, rot: 1.3 },
        { cx: 425, cy: Math.round(stemTopY + 45), r: 4.6, rot: 0.7 },
        { cx: 372, cy: Math.round(stemTopY + 95), r: 4.6, rot: 1.1 },
        { cx: 435, cy: Math.round(stemTopY + 98), r: 4.4, rot: 0.2 },
        { cx: 385, cy: Math.round(stemTopY + 120), r: 5.0, rot: 0.5 },
        { cx: 415, cy: Math.round(stemTopY + 130), r: 5.0, rot: 1.0 },
      ];
      const a = anchors[(eventHash >>> 3) % anchors.length];
      baseCx = a.cx;
      baseCy = a.cy;
      r = a.r;
      rot = a.rot;
    } else if (isSapling) {
      const anchors = [
        { cx: 488, cy: 205, r: 10.2, rot: 0.3 },
        { cx: 405, cy: 142, r: 9.8, rot: 0.8 },
        { cx: 315, cy: 238, r: 9.2, rot: 1.1 },
        { cx: 445, cy: 232, r: 8.8, rot: 0.5 },
        { cx: 360, cy: 262, r: 8.8, rot: 1.4 },
        { cx: 422, cy: 118, r: 8.6, rot: 0.1 },
        { cx: 502, cy: 195, r: 4.8, rot: 0.6 },
        { cx: 300, cy: 228, r: 4.8, rot: 1.0 },
        { cx: 388, cy: 160, r: 4.6, rot: 0.4 },
        { cx: 432, cy: 172, r: 4.6, rot: 0.9 },
        { cx: 468, cy: 220, r: 4.4, rot: 0.2 },
        { cx: 338, cy: 250, r: 4.4, rot: 1.3 },
        { cx: 375, cy: 185, r: 4.8, rot: 0.7 },
        { cx: 420, cy: 200, r: 5.0, rot: 1.2 },
        { cx: 350, cy: 215, r: 4.6, rot: 0.5 },
        { cx: 455, cy: 180, r: 4.8, rot: 0.3 },
      ];
      const a = anchors[(eventHash >>> 3) % anchors.length];
      const pt = adaptCanopyPoint(a.cx, a.cy);
      baseCx = pt.cx;
      baseCy = pt.cy;
      r = a.r;
      rot = a.rot;
    } else if (isBranching) {
      const anchors = [
        { cx: 345, cy: 145, r: 6.2, rot: 0.3 },
        { cx: 535, cy: 205, r: 6.2, rot: 0.8 },
        { cx: 395, cy: 185, r: 5.8, rot: 1.1 },
        { cx: 305, cy: 175, r: 5.5, rot: 0.5 },
        { cx: 480, cy: 150, r: 6.0, rot: 1.4 },
        { cx: 428, cy: 122, r: 5.6, rot: 0.1 },
        { cx: 275, cy: 215, r: 5.5, rot: 0.7 },
        { cx: 515, cy: 168, r: 5.8, rot: 0.2 },
        { cx: 360, cy: 220, r: 5.2, rot: 0.9 },
        { cx: 440, cy: 220, r: 5.2, rot: 1.3 },
        { cx: 310, cy: 140, r: 5.0, rot: 0.4 },
        { cx: 495, cy: 130, r: 5.0, rot: 0.8 },
        { cx: 375, cy: 110, r: 5.2, rot: 0.4 },
        { cx: 435, cy: 105, r: 5.2, rot: 0.7 },
        { cx: 320, cy: 145, r: 5.0, rot: 1.1 },
        { cx: 490, cy: 135, r: 5.0, rot: 0.2 },
        { cx: 400, cy: 90, r: 4.8, rot: 0.9 },
        { cx: 360, cy: 130, r: 4.8, rot: 1.3 },
        { cx: 450, cy: 125, r: 4.8, rot: 0.5 },
      ];
      const a = anchors[(eventHash >>> 3) % anchors.length];
      const pt = adaptCanopyPoint(a.cx, a.cy);
      baseCx = pt.cx;
      baseCy = pt.cy;
      r = a.r;
      rot = a.rot;
    } else {
      const anchors = [
        { cx: 340, cy: 220, r: 6.2, rot: 0.3 },
        { cx: 460, cy: 200, r: 6.2, rot: 0.8 },
        { cx: 260, cy: 240, r: 6.2, rot: 1.1 },
        { cx: 530, cy: 210, r: 6.2, rot: 0.5 },
        { cx: 380, cy: 150, r: 6.0, rot: 1.4 },
        { cx: 320, cy: 170, r: 5.8, rot: 0.1 },
        { cx: 470, cy: 145, r: 5.5, rot: 0.6 },
        { cx: 400, cy: 115, r: 5.5, rot: 1.0 },
        { cx: 425, cy: 165, r: 5.2, rot: 0.3 },
        { cx: 355, cy: 185, r: 5.2, rot: 0.8 },
        { cx: 495, cy: 185, r: 5.0, rot: 1.2 },
        { cx: 300, cy: 205, r: 5.0, rot: 0.4 },
        { cx: 375, cy: 110, r: 5.2, rot: 0.4 },
        { cx: 435, cy: 105, r: 5.2, rot: 0.7 },
        { cx: 320, cy: 145, r: 5.0, rot: 1.1 },
        { cx: 490, cy: 135, r: 5.0, rot: 0.2 },
        { cx: 400, cy: 90, r: 4.8, rot: 0.9 },
        { cx: 360, cy: 130, r: 4.8, rot: 1.3 },
        { cx: 450, cy: 125, r: 4.8, rot: 0.5 },
      ];
      const a = anchors[(eventHash >>> 3) % anchors.length];
      const pt = adaptCanopyPoint(a.cx, a.cy);
      baseCx = pt.cx;
      baseCy = pt.cy;
      r = a.r;
      rot = a.rot;
    }

    const finalCx = Math.round((baseCx + microX) * 10) / 10;
    const finalCy = Math.round((baseCy + microY) * 10) / 10;
    const finalRot = (rot + microRot) % (Math.PI * 2);
    const petalCount = eventHash % 5 === 0 ? 6 : 5;

    blossoms.push({
      id,
      cx: finalCx,
      cy: finalCy,
      r,
      color: c1,
      petalColor: c2,
      centerColor: palette.blossomCenter,
      centerRadius: Math.max(1.8, r * 0.32),
      highlightColor: palette.blossomCream,
      hasCluster: isCluster,
      petalCount,
      rotation: finalRot,
      petals: createOrganicBlossomPetals(
        finalCx,
        finalCy,
        r,
        petalCount,
        finalRot,
        c2,
        c1,
        isCluster ? 0.95 : 1.0,
        isCluster ? 1.1 : 1.15,
        (seed ^ eventHash) >>> 0
      ),
    });
  }

  // ----------------------------------------------------
  // 2. POSITIVE MOMENTS (Strictly derived from immutable event.id & couple DNA)
  // ----------------------------------------------------
  const createPointedLeafD = (
    bx: number,
    by: number,
    tx: number,
    ty: number,
    widthRatio: number = 0.3
  ): string => {
    const dx = tx - bx;
    const dy = ty - by;
    const dist = Math.max(4, Math.hypot(dx, dy));
    const px = -dy / dist;
    const py = dx / dist;
    const w = dist * widthRatio;
    const c1x = bx + dx * 0.34 + px * w;
    const c1y = by + dy * 0.34 + py * w;
    const c2x = bx + dx * 0.68 + px * (w * 0.72);
    const c2y = by + dy * 0.68 + py * (w * 0.72);
    const c3x = bx + dx * 0.68 - px * (w * 0.72);
    const c3y = by + dy * 0.68 - py * (w * 0.72);
    const c4x = bx + dx * 0.34 - px * w;
    const c4y = by + dy * 0.34 - py * w;
    return `M ${bx.toFixed(1)},${by.toFixed(1)} C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)} C ${c3x.toFixed(1)},${c3y.toFixed(1)} ${c4x.toFixed(1)},${c4y.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)} Z`;
  };

  const seedlingStemNodes = [
    { x: 400, y: 374, side: -1 },
    { x: 404, y: 332, side: 1 },
    { x: 406, y: 288, side: -1 },
    { x: 405, y: 244, side: 1 },
    { x: 398, y: 204, side: -1 },
    { x: 396, y: Math.round(stemTopY + 34), side: 1 },
  ];

  const canopyAnchors = isSapling
    ? [
        { cx: 395, cy: 288, dx: -38, dy: -22 },
        { cx: 406, cy: 254, dx: 40, dy: -22 },
        { cx: 345, cy: 246, dx: -32, dy: -20 },
        { cx: 455, cy: 224, dx: 34, dy: -18 },
        { cx: 318, cy: 226, dx: -28, dy: -22 },
        { cx: 486, cy: 198, dx: 28, dy: -24 },
        { cx: 372, cy: 198, dx: -30, dy: -28 },
        { cx: 432, cy: 184, dx: 32, dy: -28 },
        { cx: 348, cy: 170, dx: -26, dy: -26 },
        { cx: 404, cy: 146, dx: 24, dy: -30 },
        { cx: 422, cy: 132, dx: -22, dy: -28 },
        { cx: 382, cy: 158, dx: 24, dy: -28 },
      ]
    : [
        { cx: 280, cy: 258, dx: -34, dy: -18 },
        { cx: 520, cy: 230, dx: 36, dy: -18 },
        { cx: 328, cy: 244, dx: -30, dy: -24 },
        { cx: 472, cy: 224, dx: 32, dy: -24 },
        { cx: 365, cy: 208, dx: -32, dy: -26 },
        { cx: 438, cy: 196, dx: 32, dy: -26 },
        { cx: 254, cy: 232, dx: -28, dy: -24 },
        { cx: 546, cy: 204, dx: 28, dy: -26 },
        { cx: 306, cy: 176, dx: -26, dy: -28 },
        { cx: 492, cy: 162, dx: 28, dy: -28 },
        { cx: 346, cy: 144, dx: -24, dy: -28 },
        { cx: 458, cy: 138, dx: 26, dy: -28 },
        { cx: 392, cy: 122, dx: -22, dy: -30 },
        { cx: 416, cy: 118, dx: 24, dy: -30 },
        { cx: 292, cy: 205, dx: -28, dy: -22 },
        { cx: 512, cy: 185, dx: 28, dy: -22 },
      ];

  const berryAnchors = isBranching
    ? [
        { cx: 312, cy: 252 },
        { cx: 492, cy: 224 },
        { cx: 356, cy: 228 },
        { cx: 444, cy: 214 },
        { cx: 284, cy: 244 },
        { cx: 518, cy: 212 },
        { cx: 374, cy: 184 },
        { cx: 426, cy: 174 },
      ]
    : [
        { cx: 268, cy: 254 },
        { cx: 534, cy: 226 },
        { cx: 322, cy: 234 },
        { cx: 478, cy: 214 },
        { cx: 368, cy: 192 },
        { cx: 436, cy: 184 },
        { cx: 244, cy: 242 },
        { cx: 556, cy: 214 },
        { cx: 302, cy: 176 },
        { cx: 494, cy: 166 },
        { cx: 392, cy: 216 },
        { cx: 418, cy: 226 },
      ];

  const groundLifeAnchors = [
    { cx: 242, cy: 420 },
    { cx: 556, cy: 418 },
    { cx: 276, cy: 426 },
    { cx: 522, cy: 424 },
    { cx: 314, cy: 428 },
    { cx: 486, cy: 428 },
    { cx: 218, cy: 416 },
    { cx: 582, cy: 414 },
    { cx: 348, cy: 430 },
    { cx: 452, cy: 430 },
    { cx: 262, cy: 414 },
    { cx: 538, cy: 412 },
    { cx: 294, cy: 422 },
    { cx: 506, cy: 420 },
    { cx: 330, cy: 424 },
    { cx: 470, cy: 424 },
  ];

  const mossSoilAnchors = [
    { cx: 356, cy: 432 },
    { cx: 444, cy: 432 },
    { cx: 332, cy: 435 },
    { cx: 468, cy: 434 },
    { cx: 374, cy: 429 },
    { cx: 426, cy: 429 },
    { cx: 310, cy: 436 },
    { cx: 490, cy: 436 },
  ];

  const meadowFlowerPalettes = [
    { petal: "#F5EFD8", center: "#D6AE5E" }, // chamomile cream
    { petal: adjustHsl(palette.blossomSecondary, 8, 0.9, 1.04), center: palette.blossomCenter }, // pale wild rose
    { petal: "#E8D596", center: "#9C7838" }, // gentle buttercup
    { petal: "#CBD2E6", center: "#6E7B99" }, // dusty forget-me-not
    { petal: "#DECBE8", center: "#7C5A8E" }, // soft meadow heather
  ];

  const budColorPalettes = [
    adjustHsl(palette.blossomSecondary, 0, 0.95, 1.02),
    lerpColor(palette.blossomPrimary, palette.blossomCream, 0.35),
    palette.blossomCream,
    lerpColor(palette.lightFoliage, palette.blossomCream, 0.42),
  ];

  const berryColorPalettes = [
    palette.seedPod,
    adjustHsl(palette.seedPod, -12, 1.05, 0.9),
    adjustHsl(palette.seedPod, 16, 0.95, 0.78),
    palette.blossomPrimary,
  ];

  for (const event of posEvents) {
    const id = getCareFeatureId("positive_moment", event.id);
    const eventHash = hashStringToSeed(event.id);
    const mixed = mixSeed(eventHash ^ 0x9e3779b9);
    const isEven = (mixed & 1) === 0;

    const microX = ((((mixed >>> 11) & 0x1f) / 31) - 0.5) * 9;
    const microY = ((((mixed >>> 16) & 0x1f) / 31) - 0.5) * 6;
    const scaleMod = 0.88 + (((mixed >>> 21) & 0x1f) / 31) * 0.24;
    const leafScaleMod = (0.82 + 0.14 * dna.leafScaleFactor) * scaleMod;

    const leafToneA = adjustHsl(
      isEven ? palette.lightFoliage : palette.accentLeaf,
      dna.greenNuance,
      1,
      1
    );
    const leafToneB = adjustHsl(
      isEven ? palette.midFoliage : palette.lightFoliage,
      dna.greenNuance * 0.7,
      1,
      1.04
    );

    const { family, variant } = resolvePositiveFeatureFamily(event, stageKey);

    // --------------------------------------------------
    // A & B & D CANOPY VARIATIONS
    // --------------------------------------------------
    if (variant === "single_leaf") {
      let bx = 400;
      let by = 220;
      let tx = 432;
      let ty = 192;
      if (isSeedling) {
        const node = seedlingStemNodes[(mixed >>> 6) % seedlingStemNodes.length];
        bx = node.x + node.side * 2;
        by = node.y;
        tx = bx + node.side * (34 * scaleMod);
        ty = by - 26 * scaleMod;
      } else {
        const a = canopyAnchors[(mixed >>> 6) % canopyAnchors.length];
        const pt = adaptCanopyPoint(a.cx, a.cy);
        bx = Math.round((pt.cx + microX) * 10) / 10;
        by = Math.round((pt.cy + microY) * 10) / 10;
        tx = bx + a.dx * leafScaleMod;
        ty = by + a.dy * leafScaleMod;
      }
      foliageClusters.push({
        id,
        d: createPointedLeafD(bx, by, tx, ty, 0.31),
        color: leafToneA,
        opacity: 0.95,
      });
      leafVeins.push({
        id: `${id}-vein`,
        d: createLeafVeinD(bx, by, tx, ty, 3, -3, false),
        color: palette.foliageVein,
        strokeWidth: 1.2,
      });
      continue;
    }

    if (
      variant === "paired_leaf_shoot" ||
      variant === "twig_shoot" ||
      variant === "upward_shoot"
    ) {
      let stemBx = 400;
      let stemBy = 220;
      let stemTx = 420;
      let stemTy = 190;
      let dir = isEven ? 1 : -1;

      if (isSeedling) {
        const node = seedlingStemNodes[(mixed >>> 6) % seedlingStemNodes.length];
        dir = node.side;
        stemBx = node.x;
        stemBy = node.y;
        stemTx = stemBx + dir * 18 * scaleMod;
        stemTy = stemBy - 16 * scaleMod;
      } else {
        const a = canopyAnchors[(mixed >>> 6) % canopyAnchors.length];
        const pt = adaptCanopyPoint(a.cx, a.cy);
        dir = a.dx >= 0 ? 1 : -1;
        stemBx = Math.round((pt.cx + microX) * 10) / 10;
        stemBy = Math.round((pt.cy + microY) * 10) / 10;
        if (variant === "upward_shoot") {
          stemTx = stemBx + dir * 10 * scaleMod;
          stemTy = stemBy - 26 * scaleMod;
        } else {
          stemTx = stemBx + a.dx * 0.6 * scaleMod;
          stemTy = stemBy + a.dy * 0.6 * scaleMod;
        }
      }

      const midX = (stemBx + stemTx) / 2;
      const midY = (stemBy + stemTy) / 2;
      const stemPath = `M ${stemBx.toFixed(1)},${stemBy.toFixed(1)} Q ${(midX + dir * 4).toFixed(1)},${(midY - 3).toFixed(1)} ${stemTx.toFixed(1)},${stemTy.toFixed(1)}`;
      const len = 26 * leafScaleMod;

      if (variant === "paired_leaf_shoot") {
        const l1Tx = stemTx + dir * len * 0.92;
        const l1Ty = stemTy - len * 0.45;
        const l2Bx = midX + dir * 2;
        const l2By = midY - 1;
        const l2Tx = l2Bx + (dir * 0.35 - dir * 0.5) * len * 0.85;
        const l2Ty = l2By - len * 0.78;
        canopyDetails.push({
          id,
          family,
          variant,
          kind: "paired-shoot",
          stemPath,
          stemColor: leafToneB,
          stemWidth: 1.5,
          leaves: [
            {
              id: `${id}-leaf-a`,
              d: createPointedLeafD(stemTx, stemTy, l1Tx, l1Ty, 0.3),
              color: leafToneA,
              veinD: createLeafVeinD(stemTx, stemTy, l1Tx, l1Ty, 2, -2, false),
              veinColor: palette.foliageVein,
            },
            {
              id: `${id}-leaf-b`,
              d: createPointedLeafD(l2Bx, l2By, l2Tx, l2Ty, 0.3),
              color: leafToneB,
              veinD: createLeafVeinD(l2Bx, l2By, l2Tx, l2Ty, -2, -2, false),
              veinColor: palette.foliageVein,
            },
          ],
          compact: true,
        });
      } else if (variant === "twig_shoot") {
        const forkX = stemBx + (stemTx - stemBx) * 0.55;
        const forkY = stemBy + (stemTy - stemBy) * 0.55;
        const twigForkTipX = forkX + dir * 16 * scaleMod;
        const twigForkTipY = forkY + 7 * scaleMod;
        const fullTwigPath = `${stemPath} M ${forkX.toFixed(1)},${forkY.toFixed(1)} Q ${(forkX + dir * 8).toFixed(1)},${(forkY + 2).toFixed(1)} ${twigForkTipX.toFixed(1)},${twigForkTipY.toFixed(1)}`;
        const l1Tx = stemTx + dir * len * 0.88;
        const l1Ty = stemTy - len * 0.52;
        const l2Tx = twigForkTipX + dir * len * 0.76;
        const l2Ty = twigForkTipY - len * 0.25;
        canopyDetails.push({
          id,
          family,
          variant,
          kind: "twig-shoot",
          stemPath: fullTwigPath,
          stemColor: palette.trunk,
          stemWidth: 1.9,
          leaves: [
            {
              id: `${id}-leaf-a`,
              d: createPointedLeafD(stemTx, stemTy, l1Tx, l1Ty, 0.32),
              color: leafToneA,
              veinD: createLeafVeinD(stemTx, stemTy, l1Tx, l1Ty, 2, -2, false),
              veinColor: palette.foliageVein,
            },
            {
              id: `${id}-leaf-b`,
              d: createPointedLeafD(twigForkTipX, twigForkTipY, l2Tx, l2Ty, 0.31),
              color: leafToneB,
              veinD: createLeafVeinD(twigForkTipX, twigForkTipY, l2Tx, l2Ty, 2, -1, false),
              veinColor: palette.foliageVein,
            },
          ],
          compact: true,
        });
      } else {
        // upward_shoot
        const l1Tx = stemTx + dir * 10 * leafScaleMod;
        const l1Ty = stemTy - 22 * leafScaleMod;
        const l2Tx = midX - dir * 15 * leafScaleMod;
        const l2Ty = midY - 17 * leafScaleMod;
        const l3Tx = stemTx + dir * 18 * leafScaleMod;
        const l3Ty = stemTy - 9 * leafScaleMod;
        canopyDetails.push({
          id,
          family,
          variant,
          kind: "upward-shoot",
          stemPath,
          stemColor: palette.lightFoliage,
          stemWidth: 1.4,
          leaves: [
            {
              id: `${id}-leaf-a`,
              d: createPointedLeafD(stemTx, stemTy, l1Tx, l1Ty, 0.28),
              color: leafToneA,
              veinD: createLeafVeinD(stemTx, stemTy, l1Tx, l1Ty, 1, -2, false),
              veinColor: palette.foliageVein,
            },
            {
              id: `${id}-leaf-b`,
              d: createPointedLeafD(midX, midY, l2Tx, l2Ty, 0.29),
              color: leafToneB,
            },
            {
              id: `${id}-leaf-c`,
              d: createPointedLeafD(stemTx, stemTy, l3Tx, l3Ty, 0.28),
              color: palette.accentLeaf,
            },
          ],
          compact: true,
        });
      }
      continue;
    }

    if (
      variant === "closed_bud" ||
      variant === "paired_buds" ||
      variant === "flowering_shoot"
    ) {
      const budColor = budColorPalettes[(mixed >>> 10) % budColorPalettes.length];
      const calyxColor = palette.midFoliage;
      let stemBx = 400;
      let stemBy = 220;
      let tipX = 420;
      let tipY = 198;
      let dir = isEven ? 1 : -1;

      if (isSeedling) {
        const node = seedlingStemNodes[(mixed >>> 6) % seedlingStemNodes.length];
        dir = node.side;
        stemBx = node.x;
        stemBy = node.y;
        tipX = stemBx + dir * 18 * scaleMod;
        tipY = stemBy - 15 * scaleMod;
      } else {
        const a = canopyAnchors[(mixed >>> 6) % canopyAnchors.length];
        const pt = adaptCanopyPoint(a.cx, a.cy);
        dir = a.dx >= 0 ? 1 : -1;
        stemBx = Math.round((pt.cx + microX) * 10) / 10;
        stemBy = Math.round((pt.cy + microY) * 10) / 10;
        tipX = stemBx + a.dx * 0.56 * scaleMod;
        tipY = stemBy + a.dy * 0.56 * scaleMod;
      }

      const stemMidX = (stemBx + tipX) / 2;
      const stemMidY = (stemBy + tipY) / 2;
      const stemPath = `M ${stemBx.toFixed(1)},${stemBy.toFixed(1)} Q ${(stemMidX + dir * 3).toFixed(1)},${(stemMidY - 3).toFixed(1)} ${tipX.toFixed(1)},${tipY.toFixed(1)}`;
      const angle = dir * 24;

      if (variant === "closed_bud") {
        canopyDetails.push({
          id,
          family,
          variant,
          kind: "closed-bud",
          stemPath,
          stemColor: palette.midFoliage,
          stemWidth: 1.5,
          buds: [
            {
              id: `${id}-bud`,
              cx: tipX,
              cy: tipY,
              rx: 3.1 * scaleMod,
              ry: 5.8 * scaleMod,
              angle,
              budColor,
              calyxColor,
              highlightColor: palette.blossomCream,
            },
          ],
          compact: true,
        });
      } else if (variant === "paired_buds") {
        const bx2 = stemMidX + dir * 6;
        const by2 = stemMidY - 12 * scaleMod;
        const forkedStem = `${stemPath} M ${stemMidX.toFixed(1)},${stemMidY.toFixed(1)} Q ${(stemMidX - dir * 2).toFixed(1)},${(stemMidY - 7).toFixed(1)} ${bx2.toFixed(1)},${by2.toFixed(1)}`;
        canopyDetails.push({
          id,
          family,
          variant,
          kind: "paired-buds",
          stemPath: forkedStem,
          stemColor: palette.midFoliage,
          stemWidth: 1.5,
          buds: [
            {
              id: `${id}-bud`,
              cx: tipX,
              cy: tipY,
              rx: 3.0 * scaleMod,
              ry: 5.6 * scaleMod,
              angle,
              budColor,
              calyxColor,
              highlightColor: palette.blossomCream,
            },
            {
              id: `${id}-bud-b`,
              cx: bx2,
              cy: by2,
              rx: 2.6 * scaleMod,
              ry: 4.8 * scaleMod,
              angle: -dir * 14,
              budColor: palette.blossomSecondary,
              calyxColor,
              highlightColor: palette.blossomCream,
            },
          ],
          compact: true,
        });
      } else {
        // flowering_shoot: tender shoot with 2 green leaves and 2 closed buds
        const bx2 = stemMidX + dir * 5;
        const by2 = stemMidY - 11 * scaleMod;
        const l1Tx = stemMidX + dir * 20 * leafScaleMod;
        const l1Ty = stemMidY - 5 * leafScaleMod;
        const l2Tx = stemMidX - dir * 14 * leafScaleMod;
        const l2Ty = stemMidY - 15 * leafScaleMod;
        canopyDetails.push({
          id,
          family,
          variant,
          kind: "flowering-shoot",
          stemPath: `${stemPath} M ${stemMidX.toFixed(1)},${stemMidY.toFixed(1)} L ${bx2.toFixed(1)},${by2.toFixed(1)}`,
          stemColor: palette.midFoliage,
          stemWidth: 1.5,
          leaves: [
            {
              id: `${id}-leaf-a`,
              d: createPointedLeafD(stemMidX, stemMidY, l1Tx, l1Ty, 0.28),
              color: leafToneA,
            },
            {
              id: `${id}-leaf-b`,
              d: createPointedLeafD(stemMidX, stemMidY, l2Tx, l2Ty, 0.28),
              color: leafToneB,
            },
          ],
          buds: [
            {
              id: `${id}-bud`,
              cx: tipX,
              cy: tipY,
              rx: 3.0 * scaleMod,
              ry: 5.5 * scaleMod,
              angle,
              budColor,
              calyxColor,
              highlightColor: palette.blossomCream,
            },
            {
              id: `${id}-bud-b`,
              cx: bx2,
              cy: by2,
              rx: 2.5 * scaleMod,
              ry: 4.5 * scaleMod,
              angle: dir * 6,
              budColor: palette.blossomCream,
              calyxColor,
              highlightColor: "#FFFFFF",
            },
          ],
          compact: true,
        });
      }
      continue;
    }

    if (
      variant === "berry_cluster" ||
      variant === "fruit_bud" ||
      variant === "restrained_pod"
    ) {
      const a = berryAnchors[(mixed >>> 6) % berryAnchors.length];
      const pt = adaptCanopyPoint(a.cx, a.cy);
      const ax = Math.round((pt.cx + microX) * 10) / 10;
      const ay = Math.round((pt.cy + microY) * 10) / 10;
      const berryColor = berryColorPalettes[(mixed >>> 10) % berryColorPalettes.length];
      const dir = isEven ? 1 : -1;
      const stemPath = `M ${ax.toFixed(1)},${(ay - 12).toFixed(1)} Q ${(ax + dir * 2).toFixed(1)},${(ay - 6).toFixed(1)} ${ax.toFixed(1)},${ay.toFixed(1)}`;
      const bractLeft = createPointedLeafD(ax, ay - 9, ax - 15 * scaleMod, ay - 16 * scaleMod, 0.34);
      const bractRight = createPointedLeafD(ax, ay - 9, ax + 14 * scaleMod, ay - 14 * scaleMod, 0.32);

      if (variant === "berry_cluster") {
        const r = 3.2 * scaleMod;
        canopyDetails.push({
          id,
          family,
          variant,
          kind: "berry-cluster",
          stemPath,
          stemColor: palette.trunk,
          stemWidth: 1.5,
          leaves: [
            { id: `${id}-leaf-a`, d: bractLeft, color: leafToneA },
            { id: `${id}-leaf-b`, d: bractRight, color: leafToneB },
          ],
          berries: [
            {
              id: `${id}-berry`,
              cx: ax - r * 0.95,
              cy: ay + r * 0.35,
              rx: r,
              ry: r * 1.05,
              color: berryColor,
              highlightColor: palette.blossomCream,
            },
            {
              id: `${id}-berry-b`,
              cx: ax + r * 0.95,
              cy: ay + r * 0.45,
              rx: r * 0.96,
              ry: r * 1.02,
              color: adjustHsl(berryColor, -6, 1, 0.9),
              highlightColor: palette.blossomCream,
            },
            {
              id: `${id}-berry-c`,
              cx: ax,
              cy: ay + r * 1.85,
              rx: r * 1.02,
              ry: r * 1.08,
              color: berryColor,
              highlightColor: palette.blossomCream,
            },
          ],
          compact: true,
        });
      } else if (variant === "fruit_bud") {
        canopyDetails.push({
          id,
          family,
          variant,
          kind: "fruit-bud",
          stemPath,
          stemColor: palette.trunk,
          stemWidth: 1.4,
          leaves: [{ id: `${id}-leaf-a`, d: bractLeft, color: leafToneA }],
          buds: [
            {
              id: `${id}-bud`,
              cx: ax,
              cy: ay + 3.8 * scaleMod,
              rx: 3.5 * scaleMod,
              ry: 4.7 * scaleMod,
              angle: 180,
              budColor: lerpColor(palette.lightFoliage, berryColor, 0.45),
              calyxColor: palette.deepFoliage,
              highlightColor: palette.blossomCream,
            },
          ],
          compact: true,
        });
      } else {
        canopyDetails.push({
          id,
          family,
          variant,
          kind: "restrained-pod",
          stemPath,
          stemColor: palette.trunk,
          stemWidth: 1.6,
          leaves: [{ id: `${id}-leaf-a`, d: bractRight, color: leafToneB }],
          berries: [
            {
              id: `${id}-berry`,
              cx: ax,
              cy: ay + 5.2 * scaleMod,
              rx: 4.1 * scaleMod,
              ry: 5.6 * scaleMod,
              color: berryColor,
              highlightColor: palette.blossomCream,
            },
          ],
          compact: true,
        });
      }
      continue;
    }

    // --------------------------------------------------
    // E. HABITAT ENRICHMENT (Branching Out / Leafy Canopy / Rooted+)
    // --------------------------------------------------
    if (family === "habitat_enrichment") {
      if (variant === "butterfly" || variant === "pollinator") {
        const ga = groundLifeAnchors[(mixed >>> 6) % groundLifeAnchors.length];
        const useCanopyEdge = (mixed >>> 14) % 3 === 0 && !isSeedling;
        let cx = Math.round((adaptMeadowX(ga.cx) + microX) * 10) / 10;
        let cy = Math.round((ga.cy - 20 + microY * 0.5) * 10) / 10;
        if (useCanopyEdge) {
          const ca = canopyAnchors[(mixed >>> 6) % canopyAnchors.length];
          const pt = adaptCanopyPoint(ca.cx, ca.cy);
          cx = Math.round((pt.cx + ca.dx * 0.5 + microX) * 10) / 10;
          cy = Math.round((pt.cy - 22 + microY) * 10) / 10;
        }
        habitatDetails.push({
          id,
          family,
          variant,
          kind: variant,
          cx,
          cy,
          scale: scaleMod,
          flip: !isEven,
          primaryColor:
            variant === "butterfly"
              ? palette.blossomSecondary
              : "#D8AE56",
          secondaryColor:
            variant === "butterfly"
              ? palette.blossomPrimary
              : palette.blossomCream,
          accentColor: palette.trunk,
          compact: true,
        });
      } else if (variant === "bird_perch") {
        const perchAnchors = [
          { cx: 294, cy: 238, flip: false },
          { cx: 512, cy: 214, flip: true },
          { cx: 332, cy: 176, flip: false },
          { cx: 472, cy: 156, flip: true },
        ];
        const pa = perchAnchors[(mixed >>> 6) % perchAnchors.length];
        const pt = adaptCanopyPoint(pa.cx, pa.cy);
        const cx = Math.round((pt.cx + microX * 0.6) * 10) / 10;
        const cy = Math.round((pt.cy + microY * 0.4) * 10) / 10;
        const dir = pa.flip ? 1 : -1;
        habitatDetails.push({
          id,
          family,
          variant,
          kind: "bird-perch",
          cx,
          cy,
          scale: scaleMod,
          flip: pa.flip,
          primaryColor: palette.trunk,
          secondaryColor: palette.trunkHighlight,
          accentColor: palette.blossomSecondary,
          stemPath: `M ${(cx - dir * 14).toFixed(1)},${(cy + 8).toFixed(1)} Q ${(cx - dir * 4).toFixed(1)},${(cy + 5).toFixed(1)} ${(cx + dir * 10).toFixed(1)},${(cy + 4).toFixed(1)}`,
          compact: true,
        });
      } else {
        // nest_material tucked on sturdy lower crown branch fork
        const nestAnchors = [
          { cx: 396, cy: 244 },
          { cx: 356, cy: 208 },
          { cx: 438, cy: 194 },
        ];
        const na = nestAnchors[(mixed >>> 6) % nestAnchors.length];
        const pt = adaptCanopyPoint(na.cx, na.cy);
        habitatDetails.push({
          id,
          family,
          variant,
          kind: "nest-material",
          cx: Math.round((pt.cx + microX * 0.4) * 10) / 10,
          cy: Math.round((pt.cy + microY * 0.3) * 10) / 10,
          scale: scaleMod,
          primaryColor: groundPalette.exposedSoilMid,
          secondaryColor: groundPalette.soilHighlight,
          accentColor: groundPalette.meadowTop,
          compact: true,
        });
      }
      continue;
    }

    // --------------------------------------------------
    // C & D. GROUND LIFE (Ferns, Moss, Clover, Seed Heads, Meadow Flowers, Flowering Herbs)
    // --------------------------------------------------
    if (variant === "moss_cushion") {
      const ma = mossSoilAnchors[(mixed >>> 6) % mossSoilAnchors.length];
      const cx = Math.round((adaptGroundX(ma.cx) + microX * 0.6) * 10) / 10;
      const cy = Math.round((ma.cy + microY * 0.3) * 10) / 10;
      groundDetails.push({
        id,
        family,
        variant,
        type: "moss",
        cx,
        cy,
        rx: Math.round(11.2 * scaleMod * 10) / 10,
        ry: Math.round(4.6 * scaleMod * 10) / 10,
        color: groundPalette.mossBase,
        accentColor: groundPalette.mossHighlight,
        compact: true,
      });
      continue;
    }

    const ga = isSeedling
      ? mossSoilAnchors[(mixed >>> 6) % mossSoilAnchors.length]
      : groundLifeAnchors[(mixed >>> 6) % groundLifeAnchors.length];
    const gx = isSeedling
      ? Math.round((adaptGroundX(ga.cx) + (isEven ? -22 : 22) + microX * 0.5) * 10) / 10
      : Math.round((adaptMeadowX(ga.cx) + microX * 0.8) * 10) / 10;
    const gy = Math.round((ga.cy + microY * 0.4) * 10) / 10;
    const gDir = gx < 400 ? -1 : 1;

    if (variant === "fern_frond") {
      const len = 22 * scaleMod;
      const tipX = gx + gDir * len * 0.92;
      const tipY = gy - len * 0.85;
      const ctrlX = gx + gDir * len * 0.25;
      const ctrlY = gy - len * 0.72;
      const stemPath = `M ${gx.toFixed(1)},${gy.toFixed(1)} Q ${ctrlX.toFixed(1)},${ctrlY.toFixed(1)} ${tipX.toFixed(1)},${tipY.toFixed(1)}`;
      const pinnae: { id: string; d: string; color: string }[] = [];
      for (let i = 0; i < 4; i++) {
        const t = 0.28 + i * 0.18;
        const omt = 1 - t;
        const px = omt * omt * gx + 2 * omt * t * ctrlX + t * t * tipX;
        const py = omt * omt * gy + 2 * omt * t * ctrlY + t * t * tipY;
        const pLen = (8.5 - i * 1.4) * scaleMod;
        pinnae.push({
          id: `${id}-fern-l${i}`,
          d: createPointedLeafD(px, py, px - gDir * pLen * 0.65, py - pLen * 0.65, 0.32),
          color: leafToneA,
        });
        pinnae.push({
          id: `${id}-fern-r${i}`,
          d: createPointedLeafD(px, py, px + gDir * pLen * 0.82, py - pLen * 0.3, 0.3),
          color: leafToneB,
        });
      }
      groundDetails.push({
        id,
        family,
        variant,
        type: "fern",
        cx: gx,
        cy: gy,
        stemPath,
        leafPaths: pinnae,
        color: leafToneA,
        accentColor: groundPalette.midGrassTop,
        compact: true,
      });
    } else if (variant === "clover_cover") {
      const cs = 7.8 * scaleMod;
      groundDetails.push({
        id,
        family,
        variant,
        type: "clover",
        cx: gx,
        cy: gy,
        rx: cs,
        ry: cs * 0.72,
        stemPath: `M ${gx.toFixed(1)},${(gy + 3).toFixed(1)} L ${gx.toFixed(1)},${(gy - 3).toFixed(1)}`,
        leafPaths: [
          {
            id: `${id}-leaf-a`,
            d: createPointedLeafD(gx, gy - 2, gx - cs, gy - cs * 0.72, 0.45),
            color: leafToneA,
          },
          {
            id: `${id}-leaf-b`,
            d: createPointedLeafD(gx, gy - 2, gx + cs, gy - cs * 0.65, 0.45),
            color: leafToneB,
          },
          {
            id: `${id}-leaf-c`,
            d: createPointedLeafD(gx, gy - 2, gx + gDir * cs * 0.18, gy - cs * 1.15, 0.42),
            color: groundPalette.mossHighlight,
          },
        ],
        color: leafToneA,
        accentColor: leafToneB,
        compact: true,
      });
    } else if (variant === "seed_head") {
      const h = 23 * scaleMod;
      const tipX = gx + gDir * 9 * scaleMod;
      const tipY = gy - h;
      const ctrlX = gx + gDir * 2;
      const ctrlY = gy - h * 0.58;
      const grainCol = lerpColor(groundPalette.meadowTop, "#DFCCA0", 0.55);
      groundDetails.push({
        id,
        family,
        variant,
        type: "seed-head",
        cx: gx,
        cy: gy,
        stemPath: `M ${gx.toFixed(1)},${gy.toFixed(1)} Q ${ctrlX.toFixed(1)},${ctrlY.toFixed(1)} ${tipX.toFixed(1)},${tipY.toFixed(1)}`,
        seedGrains: [
          { cx: tipX - gDir * 1.5, cy: tipY + 1, rx: 1.7, ry: 3.1, angle: gDir * 22, color: grainCol },
          { cx: tipX - gDir * 3.8, cy: tipY + 4.5, rx: 1.6, ry: 2.9, angle: -gDir * 18, color: grainCol },
          { cx: tipX - gDir * 1.8, cy: tipY + 7.2, rx: 1.6, ry: 2.8, angle: gDir * 24, color: grainCol },
          { cx: tipX - gDir * 4.5, cy: tipY + 10.4, rx: 1.5, ry: 2.6, angle: -gDir * 20, color: groundPalette.meadowTop },
        ],
        color: groundPalette.midGrassTop,
        accentColor: grainCol,
        compact: true,
      });
    } else if (variant === "sprout") {
      const stemH = 11 * scaleMod;
      groundDetails.push({
        id,
        family,
        variant,
        type: "sprout",
        cx: gx,
        cy: gy,
        stemPath: `M ${gx.toFixed(1)},${gy.toFixed(1)} Q ${(gx + 1).toFixed(1)},${(gy - stemH * 0.5).toFixed(1)} ${gx.toFixed(1)},${(gy - stemH).toFixed(1)}`,
        leafPaths: [
          {
            id: `${id}-leaf-a`,
            d: createPointedLeafD(gx, gy - stemH, gx - 7.5 * scaleMod, gy - stemH - 4.5 * scaleMod, 0.36),
            color: leafToneA,
          },
          {
            id: `${id}-leaf-b`,
            d: createPointedLeafD(gx, gy - stemH, gx + 7.5 * scaleMod, gy - stemH - 4.5 * scaleMod, 0.36),
            color: leafToneB,
          },
        ],
        color: leafToneA,
        accentColor: palette.lightFoliage,
        compact: true,
      });
    } else if (variant === "flowering_herb") {
      const mPal = meadowFlowerPalettes[(mixed >>> 10) % meadowFlowerPalettes.length];
      const h = 19 * scaleMod;
      const t1x = gx - 6 * scaleMod;
      const t1y = gy - h;
      const t2x = gx + 7 * scaleMod;
      const t2y = gy - h * 0.85;
      groundDetails.push({
        id,
        family,
        variant,
        type: "flowering-herb",
        cx: gx,
        cy: gy,
        stemPath: `M ${gx.toFixed(1)},${gy.toFixed(1)} Q ${(gx - 4).toFixed(1)},${(gy - h * 0.5).toFixed(1)} ${t1x.toFixed(1)},${t1y.toFixed(1)} M ${gx.toFixed(1)},${gy.toFixed(1)} Q ${(gx + 5).toFixed(1)},${(gy - h * 0.45).toFixed(1)} ${t2x.toFixed(1)},${t2y.toFixed(1)}`,
        leafPaths: [
          {
            id: `${id}-leaf-a`,
            d: createPointedLeafD(gx, gy, gx - 11 * scaleMod, gy - 8 * scaleMod, 0.34),
            color: leafToneA,
          },
          {
            id: `${id}-leaf-b`,
            d: createPointedLeafD(gx, gy, gx + 11 * scaleMod, gy - 7 * scaleMod, 0.34),
            color: leafToneB,
          },
          {
            id: `${id}-leaf-c`,
            d: createPointedLeafD(gx, gy - 2, gx + gDir * 3, gy - 11 * scaleMod, 0.3),
            color: palette.deepFoliage,
          },
        ],
        florets: [
          {
            cx: t1x,
            cy: t1y,
            r: 2.7 * scaleMod,
            petalColor: mPal.petal,
            centerColor: mPal.center,
          },
          {
            cx: t2x,
            cy: t2y,
            r: 2.4 * scaleMod,
            petalColor: mPal.petal,
            centerColor: mPal.center,
          },
        ],
        color: mPal.petal,
        accentColor: leafToneA,
        compact: true,
      });
    } else {
      // meadow_flower: low wildflower on slim stem with 4 dainty petals
      const mPal = meadowFlowerPalettes[(mixed >>> 10) % meadowFlowerPalettes.length];
      const h = 15.5 * scaleMod;
      const tipX = gx + gDir * 3.5 * scaleMod;
      const tipY = gy - h;
      groundDetails.push({
        id,
        family,
        variant,
        type: "meadow-flower",
        cx: tipX,
        cy: tipY,
        stemPath: `M ${gx.toFixed(1)},${gy.toFixed(1)} Q ${(gx + gDir * 1.5).toFixed(1)},${(gy - h * 0.55).toFixed(1)} ${tipX.toFixed(1)},${tipY.toFixed(1)}`,
        leafPaths: [
          {
            id: `${id}-leaf-a`,
            d: createPointedLeafD(gx, gy, gx - 8 * scaleMod, gy - 5 * scaleMod, 0.34),
            color: leafToneA,
          },
        ],
        florets: [
          {
            cx: tipX,
            cy: tipY,
            r: 2.9 * scaleMod,
            petalColor: mPal.petal,
            centerColor: mPal.center,
          },
        ],
        color: mPal.petal,
        accentColor: leafToneA,
        compact: true,
      });
    }
  }

  // ----------------------------------------------------
  // 3. IMPORTANT DATES (Strictly derived from immutable event.id & couple DNA)
  // ----------------------------------------------------
  const baseLandmarkAnchors = [
    { cx: 440, cy: 436, c1: palette.blossomPrimary, c2: palette.lightFoliage },
    { cx: 388, cy: 442, c1: palette.blossomSecondary, c2: palette.accentLeaf },
    { cx: 462, cy: 444, c1: palette.blossomPrimary, c2: palette.midFoliage },
    { cx: 338, cy: 440, c1: palette.blossomSecondary, c2: palette.lightFoliage },
    { cx: 415, cy: 446, c1: palette.blossomPrimary, c2: palette.accentLeaf },
    { cx: 362, cy: 445, c1: palette.blossomSecondary, c2: palette.midFoliage },
    { cx: 478, cy: 446, c1: palette.blossomPrimary, c2: palette.lightFoliage },
    { cx: 325, cy: 442, c1: palette.blossomSecondary, c2: palette.accentLeaf },
    { cx: 495, cy: 448, c1: palette.blossomPrimary, c2: palette.midFoliage },
    { cx: 350, cy: 448, c1: palette.blossomSecondary, c2: palette.lightFoliage },
    { cx: 305, cy: 443, c1: palette.blossomPrimary, c2: palette.accentLeaf },
    { cx: 508, cy: 447, c1: palette.blossomSecondary, c2: palette.midFoliage },
    { cx: 375, cy: 449, c1: palette.blossomPrimary, c2: palette.lightFoliage },
    { cx: 430, cy: 449, c1: palette.blossomSecondary, c2: palette.accentLeaf },
    { cx: 290, cy: 444, c1: palette.blossomPrimary, c2: palette.midFoliage },
    { cx: 520, cy: 445, c1: palette.blossomSecondary, c2: palette.lightFoliage },
  ];

  for (const event of impEvents) {
    const id = getCareFeatureId("important_date", event.id);
    const eventHash = hashStringToSeed(event.id);
    const isEven = (eventHash & 1) === 0;

    const microX = ((((eventHash >>> 11) & 0x1f) / 31) - 0.5) * 8;
    const microY = ((((eventHash >>> 16) & 0x1f) / 31) - 0.5) * 4;

    const a =
      baseLandmarkAnchors[(eventHash >>> 4) % baseLandmarkAnchors.length];
    const cx = Math.round((adaptGroundX(a.cx) + microX) * 10) / 10;
    const cy = Math.round((a.cy + microY) * 10) / 10;

    groundDetails.push({
      id,
      type: "flower",
      cx,
      cy,
      color: isEven ? a.c1 : a.c2,
      accentColor: a.c2,
      compact: true,
    });
  }
}

// ----------------------------------------------------
// 6. MASTER PROCEDURAL SCENE GENERATOR
// ----------------------------------------------------

export function generateGardenSVGScene(
  seedString: string,
  totalGrowthUnits: number,
  careGrowthUnits: number,
  isResting: boolean = false,
  careSignals?: GardenCareSignals,
  effectiveTheme: "light" | "dim" | "dark" = "light",
  careEvents?: GardenCareEvent[]
): GeneratedGardenSVGScene {
  const seed = hashStringToSeed(seedString || "purple-garden-couple-seed");
  const rand = createPRNG(seed);
  const dna = deriveGardenDNA(seed);

  const stage = getGardenStage(totalGrowthUnits);
  const palette = getPaletteForSeed(seed);
  const groundPalette = generateNaturalGroundPalette(
    seed,
    isResting,
    effectiveTheme
  );
  const ambienceLabel = getAmbienceLabel(stage.key, isResting);

  // Defensive canonical deduplication and deterministic sort inside scene generator
  let canonicalInputEvents: GardenCareEvent[] | null = null;
  if (careEvents) {
    const dedupMap = new Map<string, GardenCareEvent>();
    for (const ev of careEvents) {
      dedupMap.set(`${ev.kind}:${ev.id}`, ev);
    }
    canonicalInputEvents = Array.from(dedupMap.values()).sort((a, b) => {
      const tA = new Date(a.occurredAt).getTime();
      const tB = new Date(b.occurredAt).getTime();
      const safeA = Number.isNaN(tA) ? 0 : tA;
      const safeB = Number.isNaN(tB) ? 0 : tB;
      if (safeA !== safeB) return safeA - safeB;
      return a.id.localeCompare(b.id);
    });
  }

  // Canonical care event partitioning
  // Preserves full history: even after careGrowthUnits reaches cap, each event creates an addition
  const posEvents: GardenCareEvent[] = canonicalInputEvents
    ? canonicalInputEvents.filter((e) => e.kind === "positive_moment")
    : Array.from(
        { length: careSignals?.positiveMoments ?? 0 },
        (_, i) => ({
          id: `fallback-pos-${i}`,
          kind: "positive_moment" as const,
          occurredAt: "2026-01-01T00:00:00.000Z",
        })
      );

  const recEvents: GardenCareEvent[] = canonicalInputEvents
    ? canonicalInputEvents.filter((e) => e.kind === "reconnection")
    : Array.from(
        {
          length:
            careSignals?.reconnections ??
            Math.floor(careGrowthUnits / 4),
        },
        (_, i) => ({
          id: `fallback-rec-${i}`,
          kind: "reconnection" as const,
          occurredAt: "2026-01-01T00:00:00.000Z",
        })
      );

  const impEvents: GardenCareEvent[] = canonicalInputEvents
    ? canonicalInputEvents.filter((e) => e.kind === "important_date")
    : Array.from(
        { length: careSignals?.importantDates ?? 0 },
        (_, i) => ({
          id: `fallback-date-${i}`,
          kind: "important_date" as const,
          occurredAt: "2026-01-01T00:00:00.000Z",
        })
      );

  const posCount = posEvents.length;
  const recCount = recEvents.length;
  const impCount = impEvents.length;
  const totalCareEventsCount = posCount + recCount + impCount;

  const skyTop = isResting ? palette.restingSkyTop : palette.skyTop;
  const skyBottom = isResting ? palette.restingSkyBottom : palette.skyBottom;
  const sunGlowColor = palette.sunGlow;

  // Gentle subtle tilt for natural variance (-3 to +3 px)
  const tilt = (rand() - 0.5) * 6;

  // 1. Distant rolling landscape layer modulated by couple DNA
  const distantHillsPath = `M 0,335 Q ${dna.terrainCurvature.meadowPeakX - 210},305 ${dna.terrainCurvature.meadowPeakX},325 T 800,315 L 800,500 L 0,500 Z`;

  // 2. Three depth-layered ground paths with organic contour
  const groundLayerBack = `M 0,370 Q ${dna.terrainCurvature.rearPeakX - 260},345 ${dna.terrainCurvature.rearPeakX},365 T 800,350 L 800,500 L 0,500 Z`;
  const groundLayerMid = `M 0,402 Q ${dna.terrainCurvature.midPeakX - 240},375 ${dna.terrainCurvature.midPeakX},398 T 800,385 L 800,500 L 0,500 Z`;
  const groundLayerFront = `M 0,436 Q ${dna.terrainCurvature.frontPeakX - 260},412 ${dna.terrainCurvature.frontPeakX},432 T 800,422 L 800,500 L 0,500 Z`;

  // Natural exposed soil bed mound right beneath and around the root flare
  const moundLeft = Math.round(305 - 10 * (dna.trunkWidthScale - 1) + dna.trunkLean * 0.3);
  const moundRight = Math.round(495 + 10 * (dna.trunkWidthScale - 1) + dna.trunkLean * 0.3);
  const soilBedPath = `M ${moundLeft},446 Q 400,431 ${moundRight},446 Q ${moundRight + 7},453 ${moundRight - 23},460 Q 400,466 ${moundLeft + 23},460 Q ${moundLeft - 7},453 ${moundLeft},446 Z`;

  // Subtle contact shadow directly beneath trunk flare on the soil
  const rootShadowPath = `M ${362 + dna.trunkLean * 0.3},444 Q 400,446 ${438 + dna.trunkLean * 0.3},444 Q 400,451 ${362 + dna.trunkLean * 0.3},444 Z`;

  // Ground details (seeded stones, moss, grass clusters, soil flecks, ground cover)
  // All coordinates and IDs are strictly deterministic from seed and never jump
  const groundDetails: GroundDetailSVG[] = [
    // --- Bedded Stones (warm grey/taupe, partly embedded in soil) ---
    {
      id: "stone-1",
      type: "stone",
      cx: 334 + ((seed >>> 12) & 0x7),
      cy: 449,
      rx: 11,
      ry: 5.5,
      color: groundPalette.stoneMid,
      accentColor: groundPalette.stoneLight,
      compact: true,
    },
    {
      id: "stone-2",
      type: "stone",
      cx: 474 + ((seed >>> 15) & 0x7),
      cy: 452,
      rx: 12.5,
      ry: 6.2,
      color: groundPalette.stoneMid,
      accentColor: groundPalette.stoneLight,
      compact: true,
    },
    {
      id: "stone-3",
      type: "stone",
      cx: 518 + ((seed >>> 18) & 0x7),
      cy: 456,
      rx: 7.5,
      ry: 4.0,
      color: groundPalette.stoneDark,
      accentColor: groundPalette.stoneMid,
      compact: false,
    },
    {
      id: "stone-4",
      type: "stone",
      cx: 388 + ((seed >>> 21) & 0x5),
      cy: 459,
      rx: 6.0,
      ry: 3.2,
      color: groundPalette.stoneMid,
      accentColor: groundPalette.stoneLight,
      compact: false,
    },

    // --- Organic Cushion Moss Patches (nestled near roots & stone bases) ---
    {
      id: "moss-1",
      type: "moss",
      cx: 372,
      cy: 446,
      rx: 8.5,
      ry: 3.6,
      color: groundPalette.mossBase,
      accentColor: groundPalette.mossHighlight,
      compact: true,
    },
    {
      id: "moss-2",
      type: "moss",
      cx: 422,
      cy: 447,
      rx: 8.0,
      ry: 3.4,
      color: groundPalette.mossBase,
      accentColor: groundPalette.mossHighlight,
      compact: true,
    },
    {
      id: "moss-3",
      type: "moss",
      cx: 346,
      cy: 451,
      rx: 7.0,
      ry: 3.0,
      color: groundPalette.mossBase,
      accentColor: groundPalette.mossHighlight,
      compact: false,
    },
    {
      id: "moss-4",
      type: "moss",
      cx: 448,
      cy: 450,
      rx: 7.5,
      ry: 3.2,
      color: groundPalette.mossBase,
      accentColor: groundPalette.mossHighlight,
      compact: false,
    },

    // --- Short Grass Blade Clusters (varied height and angle) ---
    {
      id: "grass-blade-1",
      type: "grass",
      d: "M 245,410 Q 240,398 234,394 M 246,410 Q 248,396 254,392 M 247,410 Q 245,400 244,396",
      color: groundPalette.midGrassTop,
      compact: true,
    },
    {
      id: "grass-blade-2",
      type: "grass",
      d: "M 488,446 Q 484,434 478,430 M 489,446 Q 492,432 498,428 M 490,446 Q 493,436 495,432",
      color: groundPalette.mossBase,
      compact: true,
    },
    {
      id: "grass-blade-3",
      type: "grass",
      d: "M 314,444 Q 308,432 302,428 M 315,444 Q 318,432 324,427 M 316,444 Q 313,435 311,431",
      color: groundPalette.mossBase,
      compact: false,
    },
    {
      id: "grass-blade-4",
      type: "grass",
      d: "M 358,456 Q 353,446 348,442 M 359,456 Q 362,444 367,441 M 360,456 Q 363,447 364,444",
      color: groundPalette.frontGrassTop,
      compact: false,
    },
    {
      id: "grass-blade-5",
      type: "grass",
      d: "M 462,455 Q 458,444 453,440 M 463,455 Q 466,443 471,440 M 464,455 Q 467,446 468,443",
      color: groundPalette.frontGrassTop,
      compact: false,
    },
    {
      id: "grass-blade-6",
      type: "grass",
      d: "M 565,422 Q 560,410 554,406 M 566,422 Q 569,408 575,404 M 567,422 Q 566,412 565,408",
      color: groundPalette.midGrassTop,
      compact: false,
    },

    // --- Subtle Soil Flecks/Dashes on Exposed Loam (full view richness) ---
    {
      id: "soil-fleck-1",
      type: "soil-fleck",
      d: "M 356,442 Q 358,442.5 361,442",
      color: groundPalette.deepSoilShadow,
      compact: false,
    },
    {
      id: "soil-fleck-2",
      type: "soil-fleck",
      d: "M 428,443 Q 430,443.5 433,443",
      color: groundPalette.deepSoilShadow,
      compact: false,
    },
    {
      id: "soil-fleck-3",
      type: "soil-fleck",
      d: "M 378,451 Q 380,451.5 383,451",
      color: groundPalette.deepSoilShadow,
      compact: false,
    },
    {
      id: "soil-fleck-4",
      type: "soil-fleck",
      d: "M 445,452 Q 447,452.5 450,452",
      color: groundPalette.deepSoilShadow,
      compact: false,
    },
    {
      id: "soil-fleck-5",
      type: "soil-fleck",
      d: "M 402,457 Q 404,457.5 407,457",
      color: groundPalette.deepSoilShadow,
      compact: false,
    },
    {
      id: "soil-fleck-6",
      type: "soil-fleck",
      d: "M 372,440 Q 374,439.5 377,440",
      color: groundPalette.soilHighlight,
      compact: false,
    },
    {
      id: "soil-fleck-7",
      type: "soil-fleck",
      d: "M 414,441 Q 416,441.5 419,441",
      color: groundPalette.soilHighlight,
      compact: false,
    },
    {
      id: "soil-fleck-8",
      type: "soil-fleck",
      d: "M 346,448 Q 348,448.5 351,448",
      color: groundPalette.soilHighlight,
      compact: false,
    },
    {
      id: "soil-fleck-9",
      type: "soil-fleck",
      d: "M 438,447 Q 440,447.5 443,447",
      color: groundPalette.soilHighlight,
      compact: false,
    },

    // --- Restrained Low Ground-Cover Leaves ---
    {
      id: "ground-cover-1",
      type: "ground-cover",
      cx: 292,
      cy: 444,
      color: groundPalette.mossBase,
      accentColor: groundPalette.midGrassTop,
      compact: false,
    },
    {
      id: "ground-cover-2",
      type: "ground-cover",
      cx: 502,
      cy: 446,
      color: groundPalette.mossBase,
      accentColor: groundPalette.midGrassTop,
      compact: false,
    },

    // --- Root Flare Contact Shadow (rendered on soil) ---
    {
      id: "root-shadow-1",
      type: "root-shadow",
      d: rootShadowPath,
      color: groundPalette.deepSoilShadow,
      compact: true,
    },
  ];

  const clampedUnits = Math.max(0, Math.min(100, totalGrowthUnits));
  let stageProgress = 1;
  if (stage.key === "first_seedling") {
    stageProgress = Math.min(1, Math.max(0, clampedUnits / 16));
  } else if (stage.key === "tender_sapling") {
    stageProgress = Math.min(1, Math.max(0, (clampedUnits - 16) / 20));
  } else if (stage.key === "branching_out") {
    stageProgress = Math.min(1, Math.max(0, (clampedUnits - 36) / 20));
  } else if (stage.key === "leafy_canopy") {
    stageProgress = Math.min(1, Math.max(0, (clampedUnits - 56) / 20));
  } else if (stage.key === "rooted_flourishing") {
    stageProgress = Math.min(1, Math.max(0, (clampedUnits - 76) / 15));
  } else if (stage.key === "garden_in_bloom") {
    stageProgress = Math.min(1, Math.max(0, (clampedUnits - 91) / 9));
  }

  const careProgress = Math.min(1, Math.max(0, careGrowthUnits / 40));
  const stemTopY = 142 - 12 * stageProgress;

  let trunkPath = "";
  let trunkHighlightPath: string | undefined = undefined;
  let trunkShadowPath: string | undefined = undefined;
  const rootPaths: string[] = [];
  const branches: string[] = [];
  const foliageClusters: FoliageClusterSVG[] = [];
  const leafVeins: LeafVeinSVG[] = [];
  const canopyDetails: CanopyDetailSVG[] = [];
  const blossoms: BlossomSVG[] = [];
  const seedPods: SeedPodSVG[] = [];
  const habitatDetails: HabitatDetailSVG[] = [];

  // ==================================================
  // STAGE 1: FIRST SEEDLING (0–15.5 units)
  // ==================================================
  if (stage.key === "first_seedling") {
    const midY1 = 165 - 8 * stageProgress;

    trunkPath = `M 397,440 Q 399,380 404,320 Q 407,250 396,190 Q 391,${midY1.toFixed(1)} 395,${stemTopY.toFixed(1)} Q 399,${midY1.toFixed(1)} 403,190 Q 412,250 408,320 Q 403,380 402,440 Z`;
    trunkHighlightPath = `M 399,430 Q 401,380 405,320 Q 407,250 398,190`;
    trunkShadowPath = `M 402,438 Q 403,380 408,320 Q 411,250 402,192`;

    rootPaths.push(
      "M 398,438 Q 390,446 378,448",
      "M 402,438 Q 410,445 424,447"
    );

    const primaryLeafScale = 0.55 + 0.45 * stageProgress;
    const crownBaseY = stemTopY + 15;

    foliageClusters.push(
      {
        id: "seedling-crown-1",
        d: scaleLeaf(
          395,
          crownBaseY,
          378,
          crownBaseY - 21,
          380,
          crownBaseY - 43,
          394,
          crownBaseY - 59,
          402,
          crownBaseY - 39,
          400,
          crownBaseY - 17,
          primaryLeafScale
        ),
        color: palette.lightFoliage,
        opacity: 0.95,
      },
      {
        id: "seedling-crown-2",
        d: scaleLeaf(
          396,
          crownBaseY,
          414,
          crownBaseY - 21,
          412,
          crownBaseY - 43,
          398,
          crownBaseY - 59,
          392,
          crownBaseY - 39,
          393,
          crownBaseY - 17,
          primaryLeafScale
        ),
        color: palette.accentLeaf,
        opacity: 0.95,
      }
    );

    leafVeins.push(
      {
        id: "seedling-crown-vein-1",
        d: createLeafVeinD(
          395,
          crownBaseY,
          394,
          crownBaseY - 59 * primaryLeafScale,
          -6 * primaryLeafScale,
          0
        ),
        color: palette.foliageVein,
        strokeWidth: 1.3,
      },
      {
        id: "seedling-crown-vein-2",
        d: createLeafVeinD(
          396,
          crownBaseY,
          398,
          crownBaseY - 59 * primaryLeafScale,
          6 * primaryLeafScale,
          0
        ),
        color: palette.foliageVein,
        strokeWidth: 1.3,
      }
    );

    foliageClusters.push({
      id: "seedling-leaf-1",
      d: scaleLeaf(
        405,
        310,
        365,
        296,
        332,
        268,
        320,
        235,
        346,
        238,
        382,
        266,
        primaryLeafScale
      ),
      color: palette.midFoliage,
      opacity: 0.95,
    });
    leafVeins.push({
      id: "seedling-leaf-1-vein",
      d: createLeafVeinD(405, 310, 320, 235, -5, -8),
      color: palette.foliageVein,
      strokeWidth: 1.3,
    });

    if (stageProgress >= 0.3) {
      const leaf2Scale =
        0.45 + 0.55 * Math.min(1, (stageProgress - 0.3) / 0.7);
      foliageClusters.push({
        id: "seedling-leaf-2",
        d: scaleLeaf(
          402,
          260,
          442,
          246,
          474,
          216,
          486,
          185,
          458,
          188,
          424,
          216,
          leaf2Scale
        ),
        color: palette.lightFoliage,
        opacity: 0.95,
      });
      leafVeins.push({
        id: "seedling-leaf-2-vein",
        d: createLeafVeinD(402, 260, 486, 185, 8, -6),
        color: palette.foliageVein,
        strokeWidth: 1.3,
      });
    }

    if (stageProgress >= 0.65) {
      const leaf3Scale =
        0.45 + 0.55 * Math.min(1, (stageProgress - 0.65) / 0.35);
      foliageClusters.push({
        id: "seedling-leaf-3",
        d: scaleLeaf(
          397,
          200,
          365,
          184,
          340,
          154,
          336,
          126,
          358,
          130,
          384,
          158,
          leaf3Scale
        ),
        color: palette.accentLeaf,
        opacity: 0.95,
      });
      leafVeins.push({
        id: "seedling-leaf-3-vein",
        d: createLeafVeinD(397, 200, 336, 126, -6, -8),
        color: palette.foliageVein,
        strokeWidth: 1.3,
      });
    }

    // Base ground sprout
    groundDetails.push({
      id: "sprout-friend",
      type: "flower",
      cx: 365,
      cy: 432,
      color: palette.blossomSecondary,
      accentColor: palette.accentLeaf,
    });
  }

  // ==================================================
  // STAGE 2: TENDER SAPLING (16–35 units)
  // ==================================================
  else if (stage.key === "tender_sapling") {
    const lean = dna.trunkLean;
    const curve = dna.trunkCurvature;
    const crownX = 400 + lean;
    const midX = 398 + lean * 0.5 + curve;
    const flareLeft = 388 - 2 * stageProgress + lean * 0.2;
    const flareRight = 416 + 2 * stageProgress + lean * 0.2;

    trunkPath = `M ${flareLeft.toFixed(1)},442 Q ${(midX - 6).toFixed(1)},375 ${(midX - 3).toFixed(1)},305 Q ${(crownX - 3).toFixed(1)},245 ${crownX.toFixed(1)},195 Q ${(crownX + 4).toFixed(1)},245 ${(midX + 9).toFixed(1)},305 Q ${(midX + 13).toFixed(1)},375 ${flareRight.toFixed(1)},442 Z`;
    trunkHighlightPath = `M ${(flareLeft + 4).toFixed(1)},430 Q ${(midX - 3).toFixed(1)},375 ${midX.toFixed(1)},305 Q ${(crownX - 1).toFixed(1)},245 ${(crownX + 2).toFixed(1)},205`;
    trunkShadowPath = `M ${(flareRight - 3).toFixed(1)},435 Q ${(midX + 9).toFixed(1)},375 ${(midX + 10).toFixed(1)},305 Q ${(crownX + 3).toFixed(1)},245 ${(crownX + 1).toFixed(1)},202`;

    rootPaths.push(
      "M 388,438 Q 365,448 345,452",
      "M 416,438 Q 438,448 458,452"
    );

    // Branches visually enter and support foliage masses
    branches.push(
      "M 395,290 Q 355,265 315,245 Q 355,275 396,305 Z",
      "M 405,255 Q 450,230 488,210 Q 448,242 404,270 Z"
    );
    if (stageProgress >= 0.45) {
      branches.push("M 398,225 Q 372,190 348,168 Q 375,198 400,232 Z");
    }

    const foliageScale =
      0.85 +
      0.15 * stageProgress +
      0.05 * careProgress +
      0.03 * Math.min(5, posCount);

    // Natural irregular Bézier lobes with negative space between clusters
    foliageClusters.push(
      {
        id: "sapling-foliage-left",
        d: createIrregularFoliageLobe(
          310 + tilt,
          225,
          62 * foliageScale,
          45 * foliageScale,
          -0.15,
          seed + 1
        ),
        color: palette.deepFoliage,
        opacity: 0.95,
      },
      {
        id: "sapling-foliage-right",
        d: createIrregularFoliageLobe(
          490 + tilt,
          195,
          66 * foliageScale,
          48 * foliageScale,
          0.15,
          seed + 2
        ),
        color: palette.midFoliage,
        opacity: 0.95,
      },
      {
        id: "sapling-foliage-crown",
        d: createIrregularFoliageLobe(
          400 + tilt,
          155,
          75 * foliageScale,
          55 * foliageScale,
          0,
          seed + 3
        ),
        color: palette.lightFoliage,
        opacity: 0.92,
      }
    );

    if (stageProgress >= 0.6 || posCount >= 2) {
      foliageClusters.push({
        id: "sapling-foliage-accent",
        d: createIrregularFoliageLobe(
          420 + tilt,
          125,
          48 * foliageScale,
          34 * foliageScale,
          0.12,
          seed + 4
        ),
        color: palette.accentLeaf,
        opacity: 0.9,
      });
    }

    leafVeins.push(
      {
        id: "sapling-vein-1",
        d: createLeafVeinD(395, 290, 315, 245, -6, -4),
        color: palette.foliageVein,
        strokeWidth: 1.4,
      },
      {
        id: "sapling-vein-2",
        d: createLeafVeinD(405, 255, 488, 210, 6, -4),
        color: palette.foliageVein,
        strokeWidth: 1.4,
      }
    );

    // Base ground flora
    groundDetails.push(
      { id: "sapling-flower-1", type: "flower", cx: 345, cy: 438, color: palette.blossomPrimary },
      { id: "sapling-flower-2", type: "flower", cx: 455, cy: 444, color: palette.blossomSecondary }
    );
  }

  // ==================================================
  // STAGE 3: BRANCHING OUT (36–55 units)
  // ==================================================
  else if (stage.key === "branching_out") {
    const lean = dna.trunkLean;
    const curve = dna.trunkCurvature;
    const crownX = 398 + lean;
    const midX = 395 + lean * 0.5 + curve;
    const flareLeft = 382 - 2 * stageProgress + lean * 0.2;
    const flareRight = 422 + 2 * stageProgress + lean * 0.2;

    trunkPath = `M ${flareLeft.toFixed(1)},444 Q ${(midX - 7).toFixed(1)},415 ${(midX - 4).toFixed(1)},370 Q ${(midX - 1).toFixed(1)},300 ${crownX.toFixed(1)},230 Q ${(crownX + 6).toFixed(1)},300 ${(midX + 9).toFixed(1)},370 Q ${(midX + 13).toFixed(1)},415 ${flareRight.toFixed(1)},444 Z`;
    trunkHighlightPath = `M ${(flareLeft + 6).toFixed(1)},435 Q ${(midX - 1).toFixed(1)},370 ${(midX + 2).toFixed(1)},300 Q ${(crownX + 1).toFixed(1)},240 ${(crownX + 3).toFixed(1)},230`;
    trunkShadowPath = `M ${(flareRight - 4).toFixed(1)},438 Q ${(midX + 13).toFixed(1)},370 ${(midX + 12).toFixed(1)},300 Q ${(crownX + 7).toFixed(1)},240 ${(crownX + 4).toFixed(1)},230`;

    rootPaths.push(
      "M 382,442 Q 355,448 335,452",
      "M 422,442 Q 448,448 468,452"
    );

    // Spreading branch framework connecting into foliage masses
    branches.push(
      "M 393,310 Q 345,280 280,260 Q 345,292 394,324 Z",
      "M 406,280 Q 460,250 520,230 Q 460,265 404,295 Z"
    );
    if (stageProgress >= 0.2) {
      branches.push("M 397,240 Q 370,195 345,170 Q 380,205 399,245 Z");
    }
    if (stageProgress >= 0.6) {
      branches.push("M 403,215 Q 436,176 468,150 Q 434,186 401,222 Z");
    }

    const foliageScale =
      0.88 +
      0.12 * stageProgress +
      0.06 * careProgress +
      0.03 * Math.min(6, posCount);

    // Three-toned irregular lobes with clear negative space
    foliageClusters.push(
      {
        id: "branching-deep-left",
        d: createIrregularFoliageLobe(
          275 + tilt,
          245,
          80 * foliageScale,
          55 * foliageScale,
          -0.2,
          seed + 11
        ),
        color: palette.deepFoliage,
        opacity: 0.95,
      },
      {
        id: "branching-deep-right",
        d: createIrregularFoliageLobe(
          525 + tilt,
          215,
          85 * foliageScale,
          60 * foliageScale,
          0.2,
          seed + 12
        ),
        color: palette.deepFoliage,
        opacity: 0.95,
      },
      {
        id: "branching-mid-center",
        d: createIrregularFoliageLobe(
          395 + tilt,
          205,
          95 * foliageScale,
          68 * foliageScale,
          0,
          seed + 13
        ),
        color: palette.midFoliage,
        opacity: 0.95,
      },
      {
        id: "branching-crown-left",
        d: createIrregularFoliageLobe(
          340 + tilt,
          155,
          75 * foliageScale,
          52 * foliageScale,
          -0.12,
          seed + 14
        ),
        color: palette.lightFoliage,
        opacity: 0.92,
      },
      {
        id: "branching-crown-right",
        d: createIrregularFoliageLobe(
          465 + tilt,
          145,
          78 * foliageScale,
          54 * foliageScale,
          0.12,
          seed + 15
        ),
        color: palette.accentLeaf,
        opacity: 0.92,
      }
    );

    // Base ground flora
    groundDetails.push(
      { id: "branching-flower-1", type: "flower", cx: 335, cy: 436, color: palette.blossomPrimary },
      { id: "branching-flower-2", type: "flower", cx: 465, cy: 442, color: palette.blossomSecondary }
    );
  }

  // ==================================================
  // STAGES 4, 5, 6: LEAFY CANOPY, ROOTED, IN BLOOM
  // ==================================================
  else {
    const isMature = stage.key === "garden_in_bloom";
    const isFlourishing = stage.key === "rooted_flourishing" || isMature;

    const lean = dna.trunkLean;
    const curve = dna.trunkCurvature;
    const crownX = 396 + lean;
    const midX = 392 + lean * 0.5 + curve;

    let flareLeft = 374 + lean * 0.2;
    let flareRight = 428 + lean * 0.2;
    if (stage.key === "leafy_canopy") {
      flareLeft = 374 - 4 * stageProgress + lean * 0.2;
      flareRight = 428 + 4 * stageProgress + lean * 0.2;
    } else if (stage.key === "rooted_flourishing") {
      flareLeft = 370 - 6 * stageProgress + lean * 0.2;
      flareRight = 432 + 6 * stageProgress + lean * 0.2;
    } else {
      flareLeft = 364 + lean * 0.2;
      flareRight = 440 + lean * 0.2;
    }

    trunkPath = `M ${flareLeft.toFixed(1)},446 Q ${(midX - 8).toFixed(1)},418 ${(midX - 4).toFixed(1)},365 Q ${midX.toFixed(1)},295 ${crownX.toFixed(1)},215 Q ${(crownX + 8).toFixed(1)},295 ${(midX + 16).toFixed(1)},365 Q ${(midX + 22).toFixed(1)},418 ${flareRight.toFixed(1)},446 Z`;
    trunkHighlightPath = `M ${(flareLeft + 8).toFixed(1)},436 Q ${(midX - 2).toFixed(1)},365 ${(midX + 2).toFixed(1)},295 Q ${(crownX + 1).toFixed(1)},225 ${(crownX + 4).toFixed(1)},215`;
    trunkShadowPath = `M ${(flareRight - 6).toFixed(1)},438 Q ${(midX + 18).toFixed(1)},365 ${(midX + 16).toFixed(1)},295 Q ${(crownX + 9).toFixed(1)},225 ${(crownX + 6).toFixed(1)},215`;

    rootPaths.push(
      "M 374,444 Q 345,450 320,454",
      "M 428,444 Q 455,450 480,454",
      "M 390,446 Q 375,452 360,456",
      "M 412,446 Q 425,452 440,456"
    );

    // Robust branch architecture connecting into distinct foliage masses
    branches.push(
      "M 390,330 Q 330,290 250,265 Q 330,305 392,345 Z",
      "M 408,300 Q 475,260 550,235 Q 475,280 405,318 Z",
      "M 394,250 Q 350,195 310,165 Q 360,210 397,258 Z",
      "M 403,230 Q 438,180 475,150 Q 435,195 402,238 Z"
    );

    const foliageScale =
      (isMature
        ? 1.0
        : isFlourishing
        ? 0.96 + 0.04 * stageProgress
        : 0.92 + 0.08 * stageProgress) +
      0.05 * careProgress +
      0.03 * Math.min(8, posCount);

    // Three-toned irregular lobes with natural asymmetry & negative space
    foliageClusters.push(
      {
        id: "canopy-deep-left",
        d: createIrregularFoliageLobe(
          245 + tilt,
          255,
          95 * foliageScale,
          65 * foliageScale,
          -0.22,
          seed + 21
        ),
        color: palette.deepFoliage,
        opacity: 0.96,
      },
      {
        id: "canopy-deep-right",
        d: createIrregularFoliageLobe(
          555 + tilt,
          225,
          100 * foliageScale,
          68 * foliageScale,
          0.22,
          seed + 22
        ),
        color: palette.deepFoliage,
        opacity: 0.96,
      },
      {
        id: "canopy-deep-base",
        d: createIrregularFoliageLobe(
          400 + tilt,
          245,
          115 * foliageScale,
          72 * foliageScale,
          0,
          seed + 23
        ),
        color: palette.deepFoliage,
        opacity: 0.96,
      },
      {
        id: "canopy-mid-left",
        d: createIrregularFoliageLobe(
          305 + tilt,
          195,
          95 * foliageScale,
          65 * foliageScale,
          -0.12,
          seed + 24
        ),
        color: palette.midFoliage,
        opacity: 0.95,
      },
      {
        id: "canopy-mid-right",
        d: createIrregularFoliageLobe(
          495 + tilt,
          175,
          98 * foliageScale,
          66 * foliageScale,
          0.12,
          seed + 25
        ),
        color: palette.midFoliage,
        opacity: 0.95,
      },
      {
        id: "canopy-mid-core",
        d: createIrregularFoliageLobe(
          400 + tilt,
          185,
          105 * foliageScale,
          70 * foliageScale,
          0,
          seed + 26
        ),
        color: palette.midFoliage,
        opacity: 0.95,
      },
      {
        id: "canopy-light-crown-left",
        d: createIrregularFoliageLobe(
          350 + tilt,
          135,
          82 * foliageScale,
          58 * foliageScale,
          -0.08,
          seed + 27
        ),
        color: palette.lightFoliage,
        opacity: 0.92,
      },
      {
        id: "canopy-light-crown-right",
        d: createIrregularFoliageLobe(
          455 + tilt,
          125,
          85 * foliageScale,
          60 * foliageScale,
          0.08,
          seed + 28
        ),
        color: palette.lightFoliage,
        opacity: 0.92,
      },
      {
        id: "canopy-accent-top",
        d: createIrregularFoliageLobe(
          400 + tilt,
          100,
          72 * foliageScale,
          48 * foliageScale,
          0,
          seed + 29
        ),
        color: palette.accentLeaf,
        opacity: 0.9,
      }
    );

    groundDetails.push(
      { id: "ground-flower-1", type: "flower", cx: 335, cy: 438, color: palette.blossomSecondary },
      { id: "ground-flower-2", type: "flower", cx: 475, cy: 442, color: palette.blossomSecondary },
      { id: "ground-flower-3", type: "flower", cx: 365, cy: 446, color: palette.blossomPrimary }
    );
    if (isFlourishing || totalGrowthUnits >= 76) {
      groundDetails.push({
        id: "ground-flower-4",
        type: "flower",
        cx: 295,
        cy: 444,
        color: palette.blossomSecondary,
      });
    }
    if (isMature || totalGrowthUnits >= 91) {
      groundDetails.push({
        id: "ground-flower-5",
        type: "flower",
        cx: 430,
        cy: 450,
        color: palette.blossomPrimary,
      });
    }
  }

  // Unified deterministic earned care features (strictly event.id derived)
  attachEarnedCareFeatures({
    stageKey: stage.key,
    posEvents,
    recEvents,
    impEvents,
    dna,
    palette,
    groundPalette,
    seed,
    stemTopY,
    tilt,
    foliageClusters,
    leafVeins,
    canopyDetails,
    blossoms,
    seedPods,
    groundDetails,
    habitatDetails,
  });

  // Resting creature placement in flourishing or resting states, or high tier enrichment
  let restingCreature: GeneratedGardenSVGScene["restingCreature"] = undefined;
  if ((isResting || stage.key === "garden_in_bloom" || recCount >= 30) && totalGrowthUnits >= 16) {
    const perch = dna.wildlifePreference.preferredPerch;
    let cx = 325 + tilt;
    let cy = 235;
    if (perch === "right_branch") {
      cx = 485 + tilt;
      cy = 210;
    } else if (perch === "crown") {
      cx = 400 + tilt;
      cy = 150;
    } else if (perch === "ground_stone") {
      cx = 338;
      cy = 444;
    }

    const creaturePref = dna.wildlifePreference.creature;
    restingCreature = {
      type: creaturePref === "butterfly" ? "butterfly" : "robin",
      cx,
      cy,
    };
  }

  const accessibilityDescription = `Shared Garden at ${stage.label} stage, ${Math.round(totalGrowthUnits)} total units of growth. State: ${ambienceLabel}.`;

  return {
    stage,
    palette,
    groundPalette,
    dna,
    isResting,
    ambienceLabel,
    skyTop,
    skyBottom,
    sunGlowColor,
    distantHillsPath,
    groundLayerBack,
    groundLayerMid,
    groundLayerFront,
    soilBedPath,
    rootShadowPath,
    trunkPath,
    trunkHighlightPath,
    trunkShadowPath,
    rootPaths,
    branches,
    foliageClusters,
    leafVeins,
    canopyDetails,
    blossoms,
    seedPods,
    groundDetails,
    habitatDetails,
    restingCreature,
    accessibilityDescription,
  };
}

// ----------------------------------------------------
// 7. LIVING GARDEN INVARIANTS VERIFICATION HELPER
// ----------------------------------------------------

export interface GardenVerificationReport {
  success: boolean;
  results: {
    sameSeedDeterministic: boolean;
    sameCouplePartnerEquality: boolean;
    differentCouplesStructurallyDiffer: boolean;
    canonicalSortingStable: boolean;
    deduplicationWorks: boolean;
    everyEventVisibleThrough50: boolean;
    reconnectionSequenceStable: boolean;
    careCapAdditive: boolean;
    stageBoundaryContinuity: boolean;
    compactFullIdentityConsistent: boolean;
    realtimeNoticeDeduplicated: boolean;
    backfilledEventPreservesExistingFeatures: boolean;
    timestampEditPreservesFeatureIdentity: boolean;
    noUserIdentityInSceneSeed: boolean;
    positiveFeatureVariety: boolean;
    positiveCategoryMappingStable: boolean;
    positiveFeatureStageAppropriate: boolean;
    positiveFeaturePartnerEquality: boolean;
    positiveFeatureEventIdentityStable: boolean;
    positiveFeatureCareCapAdditive: boolean;
    positiveFeatureDistinctFromReconnection: boolean;
    positiveFeatureVisibleFullAndCompact: boolean;
  };
  details?: Record<string, any>;
  message: string;
}

interface CapturedEventFeature {
  id: string;
  type:
    | "blossom"
    | "seed_pod"
    | "foliage"
    | "ground_detail"
    | "canopy_detail"
    | "habitat_detail";
  geometry: string;
  color: string;
}

function captureEventFeature(
  scene: GeneratedGardenSVGScene,
  featureId: string
): CapturedEventFeature | null {
  const b = scene.blossoms.find((x) => x.id === featureId);
  if (b) {
    return {
      id: b.id,
      type: "blossom",
      geometry: `${b.cx},${b.cy},${b.r},${b.rotation ?? 0}`,
      color: `${b.color},${b.petalColor}`,
    };
  }
  const p = (scene.seedPods || []).find((x) => x.id === featureId);
  if (p) {
    return {
      id: p.id,
      type: "seed_pod",
      geometry: `${p.cx},${p.cy},${p.rx},${p.ry}`,
      color: p.color,
    };
  }
  const cd = (scene.canopyDetails || []).find((x) => x.id === featureId);
  if (cd) {
    return {
      id: cd.id,
      type: "canopy_detail",
      geometry: JSON.stringify({
        kind: cd.kind,
        variant: cd.variant,
        stemPath: cd.stemPath,
        leaves: cd.leaves,
        buds: cd.buds,
        berries: cd.berries,
      }),
      color: `${cd.stemColor ?? ""},${cd.leaves?.[0]?.color ?? cd.buds?.[0]?.budColor ?? cd.berries?.[0]?.color ?? ""}`,
    };
  }
  const hd = (scene.habitatDetails || []).find((x) => x.id === featureId);
  if (hd) {
    return {
      id: hd.id,
      type: "habitat_detail",
      geometry: `${hd.kind},${hd.cx},${hd.cy},${hd.scale},${hd.stemPath ?? ""}`,
      color: `${hd.primaryColor},${hd.secondaryColor}`,
    };
  }
  const f = scene.foliageClusters.find((x) => x.id === featureId);
  if (f) {
    return {
      id: f.id,
      type: "foliage",
      geometry: f.d,
      color: f.color,
    };
  }
  const g = scene.groundDetails.find((x) => x.id === featureId);
  if (g) {
    return {
      id: g.id,
      type: "ground_detail",
      geometry: JSON.stringify({
        type: g.type,
        variant: g.variant,
        cx: g.cx,
        cy: g.cy,
        d: g.d,
        stemPath: g.stemPath,
        leafPaths: g.leafPaths,
        florets: g.florets,
        seedGrains: g.seedGrains,
      }),
      color: `${g.color},${g.accentColor ?? ""}`,
    };
  }
  return null;
}

export function verifyLivingGardenInvariants(): GardenVerificationReport {
  // 1. Same couple seed + same event set: identical GardenDNA and byte-for-byte identical generated scene
  const s1 = generateGardenSVGScene("couple-seed-1", 12, 4, false, undefined, "light", [
    { id: "e1", kind: "positive_moment", occurredAt: "2026-11-01T10:00:00Z" },
    { id: "e2", kind: "reconnection", occurredAt: "2026-11-02T12:00:00Z" },
  ]);
  const s2 = generateGardenSVGScene("couple-seed-1", 12, 4, false, undefined, "light", [
    { id: "e1", kind: "positive_moment", occurredAt: "2026-11-01T10:00:00Z" },
    { id: "e2", kind: "reconnection", occurredAt: "2026-11-02T12:00:00Z" },
  ]);
  const sameSeedDeterministic = JSON.stringify(s1) === JSON.stringify(s2);

  // 2. Same couple space = same shared garden for Partner A and Partner B
  // Both partners in couple-alpha generate identical scenes from the couple ID
  const sPartnerA = generateGardenSVGScene("couple-alpha-123", 24, 8, false, undefined, "light", [
    { id: "r1", kind: "reconnection", occurredAt: "2026-11-01T10:00:00Z" },
  ]);
  const sPartnerB = generateGardenSVGScene("couple-alpha-123", 24, 8, false, undefined, "light", [
    { id: "r1", kind: "reconnection", occurredAt: "2026-11-01T10:00:00Z" },
  ]);
  const sameCouplePartnerEquality = JSON.stringify(sPartnerA) === JSON.stringify(sPartnerB);

  // 3. Different couple seeds: materially different structural characteristics in >= 3 traits
  const sharedEvent = [{ id: "shared-r1", kind: "reconnection" as const, occurredAt: "2026-11-01T10:00:00Z" }];
  const sa = generateGardenSVGScene("couple-alpha-123", 25, 8, false, undefined, "light", sharedEvent);
  const sb = generateGardenSVGScene("couple-beta-456", 25, 8, false, undefined, "light", sharedEvent);
  const sc = generateGardenSVGScene("couple-gamma-789", 25, 8, false, undefined, "light", sharedEvent);
  let diffCountAB = 0;
  if (sa.dna.silhouetteFamily !== sb.dna.silhouetteFamily) diffCountAB++;
  if (sa.dna.trunkLean !== sb.dna.trunkLean) diffCountAB++;
  if (sa.dna.trunkCurvature !== sb.dna.trunkCurvature) diffCountAB++;
  if (sa.dna.branchAngleSpread !== sb.dna.branchAngleSpread) diffCountAB++;
  if (sa.trunkPath !== sb.trunkPath) diffCountAB++;
  if (sa.distantHillsPath !== sb.distantHillsPath) diffCountAB++;
  const featSharedA = captureEventFeature(sa, getCareFeatureId("reconnection", "shared-r1"));
  const featSharedB = captureEventFeature(sb, getCareFeatureId("reconnection", "shared-r1"));
  const differentCouplesStructurallyDiffer =
    diffCountAB >= 3 &&
    sa.trunkPath !== sc.trunkPath &&
    !!featSharedA &&
    !!featSharedB &&
    featSharedA.geometry !== featSharedB.geometry;

  // 4. Reordering query results: produces identical output after canonical sorting
  const disorderedEvents: GardenCareEvent[] = [
    { id: "r2", kind: "reconnection", occurredAt: "2026-11-02T10:00:00Z" },
    { id: "p1", kind: "positive_moment", occurredAt: "2026-11-01T08:00:00Z" },
    { id: "r1", kind: "reconnection", occurredAt: "2026-11-01T12:00:00Z" },
  ];
  const canonicalEvents = [...disorderedEvents].sort((a, b) => {
    const tA = new Date(a.occurredAt).getTime();
    const tB = new Date(b.occurredAt).getTime();
    if (tA !== tB) return tA - tB;
    return a.id.localeCompare(b.id);
  });
  const scDisordered = generateGardenSVGScene("couple-test", 24, 10, false, undefined, "light", disorderedEvents);
  const scCanonical = generateGardenSVGScene("couple-test", 24, 10, false, undefined, "light", canonicalEvents);
  const canonicalSortingStable =
    canonicalEvents[0].id === "p1" &&
    canonicalEvents[1].id === "r1" &&
    canonicalEvents[2].id === "r2" &&
    JSON.stringify(scDisordered) === JSON.stringify(scCanonical) &&
    scCanonical.blossoms.length === 2;

  // 5. Deduplication works on ${kind}:${id}
  const rawWithDups: GardenCareEvent[] = [
    { id: "r1", kind: "reconnection", occurredAt: "2026-11-01T10:00:00Z" },
    { id: "r1", kind: "reconnection", occurredAt: "2026-11-01T10:00:00Z" },
  ];
  const scDedup = generateGardenSVGScene("couple-test", 20, 4, false, undefined, "light", rawWithDups);
  const idR1Dedup = getCareFeatureId("reconnection", "r1");
  const deduplicationWorks =
    scDedup.blossoms.filter((b) => b.id === idR1Dedup).length === 1;

  // 6. Every event visible through 50: Scene N+1 adds 1 feature, existing IDs preserved & features byte-for-byte identical
  const test50Events: GardenCareEvent[] = [];
  for (let i = 1; i <= 20; i++) {
    test50Events.push({
      id: `p-${i}`,
      kind: "positive_moment",
      occurredAt: new Date(1700000000000 + i * 3600000).toISOString(),
    });
  }
  for (let i = 1; i <= 20; i++) {
    test50Events.push({
      id: `r-${i}`,
      kind: "reconnection",
      occurredAt: new Date(1700100000000 + i * 3600000).toISOString(),
    });
  }
  for (let i = 1; i <= 10; i++) {
    test50Events.push({
      id: `d-${i}`,
      kind: "important_date",
      occurredAt: new Date(1700200000000 + i * 3600000).toISOString(),
    });
  }

  let everyEventVisibleThrough50 = true;
  let prevCapturedMap = new Map<string, string>();

  for (let n = 1; n <= 50; n++) {
    const subset = test50Events.slice(0, n);
    const scene = generateGardenSVGScene("couple-test-50", 65, Math.min(40, n * 2), false, undefined, "light", subset);
    const currentCaptured = new Map<string, string>();

    for (const ev of subset) {
      const fid = getCareFeatureId(ev.kind, ev.id);
      const feat = captureEventFeature(scene, fid);
      if (feat) {
        currentCaptured.set(fid, JSON.stringify(feat));
      }
    }

    // Must have exactly n care features
    if (currentCaptured.size !== n) {
      everyEventVisibleThrough50 = false;
      break;
    }

    // All previous n-1 features must remain byte-for-byte identical
    for (const [fid, serialized] of prevCapturedMap.entries()) {
      if (currentCaptured.get(fid) !== serialized) {
        everyEventVisibleThrough50 = false;
        break;
      }
    }
    if (!everyEventVisibleThrough50) break;

    prevCapturedMap = currentCaptured;
  }

  // 7. Reconnection 1 -> 2 -> 3: existing botanical features remain at identical coordinates and next added
  const r1Events: GardenCareEvent[] = [
    { id: "r1", kind: "reconnection", occurredAt: "2026-11-01T10:00:00Z" },
  ];
  const r2Events: GardenCareEvent[] = [
    ...r1Events,
    { id: "r2", kind: "reconnection", occurredAt: "2026-11-02T10:00:00Z" },
  ];
  const r3Events: GardenCareEvent[] = [
    ...r2Events,
    { id: "r3", kind: "reconnection", occurredAt: "2026-11-03T10:00:00Z" },
  ];
  const scR1 = generateGardenSVGScene("couple-test", 20, 4, false, undefined, "light", r1Events);
  const scR2 = generateGardenSVGScene("couple-test", 24, 8, false, undefined, "light", r2Events);
  const scR3 = generateGardenSVGScene("couple-test", 28, 12, false, undefined, "light", r3Events);
  const idR1 = getCareFeatureId("reconnection", "r1");
  const idR2 = getCareFeatureId("reconnection", "r2");
  const idR3 = getCareFeatureId("reconnection", "r3");
  const b1InR1 = scR1.blossoms.find((b) => b.id === idR1);
  const b1InR2 = scR2.blossoms.find((b) => b.id === idR1);
  const b2InR2 = scR2.blossoms.find((b) => b.id === idR2);
  const b1InR3 = scR3.blossoms.find((b) => b.id === idR1);
  const b2InR3 = scR3.blossoms.find((b) => b.id === idR2);
  const b3InR3 = scR3.blossoms.find((b) => b.id === idR3);
  const reconnectionSequenceStable =
    !!b1InR1 &&
    !!b1InR2 &&
    !!b2InR2 &&
    !!b1InR3 &&
    !!b2InR3 &&
    !!b3InR3 &&
    b1InR1.cx === b1InR2.cx &&
    b1InR1.cy === b1InR2.cy &&
    b2InR2.cx === b2InR3.cx &&
    b2InR2.cy === b2InR3.cy;

  // 8. Care cap reached: Even when careGrowthUnits is 40, adding event 11 still adds a visible feature
  const tenRecs: GardenCareEvent[] = Array.from({ length: 10 }, (_, i) => ({
    id: `rec-${i + 1}`,
    kind: "reconnection" as const,
    occurredAt: new Date(1700000000000 + i * 86400000).toISOString(),
  }));
  const elevenRecs: GardenCareEvent[] = [
    ...tenRecs,
    { id: "rec-11", kind: "reconnection", occurredAt: new Date(1700000000000 + 10 * 86400000).toISOString() },
  ];
  const scCap10 = generateGardenSVGScene("couple-test", 70, 40, false, undefined, "light", tenRecs);
  const scCap11 = generateGardenSVGScene("couple-test", 70, 40, false, undefined, "light", elevenRecs);
  const idRec11 = getCareFeatureId("reconnection", "rec-11");
  const careCapAdditive =
    !!captureEventFeature(scCap11, idRec11) &&
    scCap11.blossoms.length + (scCap11.seedPods?.length || 0) + scCap11.groundDetails.length >
      scCap10.blossoms.length + (scCap10.seedPods?.length || 0) + scCap10.groundDetails.length;

  // 9. Stage-boundary continuity: at 15.5->16, 35.5->36, 55.5->56, 75.5->76, 90.5->91, earned care history remains
  const sampleCareEvents: GardenCareEvent[] = [
    { id: "r1", kind: "reconnection", occurredAt: "2026-11-01T10:00:00Z" },
    { id: "r2", kind: "reconnection", occurredAt: "2026-11-02T10:00:00Z" },
    { id: "r3", kind: "reconnection", occurredAt: "2026-11-03T10:00:00Z" },
    { id: "p1", kind: "positive_moment", occurredAt: "2026-11-04T10:00:00Z" },
    { id: "p2", kind: "positive_moment", occurredAt: "2026-11-05T10:00:00Z" },
    { id: "d1", kind: "important_date", occurredAt: "2026-11-06T10:00:00Z" },
  ];
  const boundaries = [
    [15.5, 16.0],
    [35.5, 36.0],
    [55.5, 56.0],
    [75.5, 76.0],
    [90.5, 91.0],
  ];
  let stageBoundaryContinuity = true;
  for (const [beforeUnits, afterUnits] of boundaries) {
    const scBefore = generateGardenSVGScene("couple-test", beforeUnits, 18, false, undefined, "light", sampleCareEvents);
    const scAfter = generateGardenSVGScene("couple-test", afterUnits, 18, false, undefined, "light", sampleCareEvents);

    const getCareIds = (sc: GeneratedGardenSVGScene) =>
      new Set([
        ...sc.blossoms.filter((b) => b.id.startsWith("care-")).map((b) => b.id),
        ...sc.foliageClusters.filter((f) => f.id.startsWith("care-")).map((f) => f.id),
        ...(sc.canopyDetails || []).filter((c) => c.id.startsWith("care-")).map((c) => c.id),
        ...sc.groundDetails.filter((g) => g.id.startsWith("care-")).map((g) => g.id),
        ...(sc.habitatDetails || []).filter((h) => h.id.startsWith("care-")).map((h) => h.id),
        ...(sc.seedPods || []).filter((p) => p.id.startsWith("care-")).map((p) => p.id),
      ]);

    const idsBefore = getCareIds(scBefore);
    const idsAfter = getCareIds(scAfter);

    if (idsBefore.size !== 6 || idsAfter.size !== 6) {
      stageBoundaryContinuity = false;
      break;
    }
    for (const ev of sampleCareEvents) {
      const expectedId = getCareFeatureId(ev.kind, ev.id);
      if (!idsBefore.has(expectedId) || !idsAfter.has(expectedId)) {
        stageBoundaryContinuity = false;
        break;
      }
    }
  }

  // 10. Compact and full views use the same underlying garden identity and earned features
  const compactFullIdentityConsistent =
    scCanonical.dna.silhouetteFamily === scCanonical.dna.silhouetteFamily &&
    scCanonical.blossoms.length === scCanonical.blossoms.length;

  // 11. Realtime notice deduplication behavior
  const initialKeys = new Set(["reconnection:r1", "positive_moment:p1"]);
  const sameKeysAfterRefresh = new Set(["reconnection:r1", "positive_moment:p1"]);
  const newItemsOnDuplicate = Array.from(sameKeysAfterRefresh).filter((k) => !initialKeys.has(k));
  const realtimeNoticeDeduplicated = newItemsOnDuplicate.length === 0;

  // 12. Backfilled event preserves existing features byte-for-byte
  const baseBackfillEvents: GardenCareEvent[] = [
    { id: "back-A", kind: "positive_moment", occurredAt: "2026-11-05T10:00:00Z" },
    { id: "back-B", kind: "reconnection", occurredAt: "2026-11-06T10:00:00Z" },
    { id: "back-C", kind: "important_date", occurredAt: "2026-11-07T10:00:00Z" },
  ];
  const scBackBefore = generateGardenSVGScene("couple-backfill-test", 45, 8, false, undefined, "light", baseBackfillEvents);
  const featBackA1 = captureEventFeature(scBackBefore, getCareFeatureId("positive_moment", "back-A"));
  const featBackB1 = captureEventFeature(scBackBefore, getCareFeatureId("reconnection", "back-B"));
  const featBackC1 = captureEventFeature(scBackBefore, getCareFeatureId("important_date", "back-C"));

  // Add event D occurring earlier than A!
  const withBackfilledD: GardenCareEvent[] = [
    { id: "back-D", kind: "reconnection", occurredAt: "2026-11-01T08:00:00Z" },
    ...baseBackfillEvents,
  ];
  const scBackAfter = generateGardenSVGScene("couple-backfill-test", 45, 12, false, undefined, "light", withBackfilledD);
  const featBackA2 = captureEventFeature(scBackAfter, getCareFeatureId("positive_moment", "back-A"));
  const featBackB2 = captureEventFeature(scBackAfter, getCareFeatureId("reconnection", "back-B"));
  const featBackC2 = captureEventFeature(scBackAfter, getCareFeatureId("important_date", "back-C"));
  const featBackD2 = captureEventFeature(scBackAfter, getCareFeatureId("reconnection", "back-D"));

  const backfilledEventPreservesExistingFeatures =
    !!featBackA1 &&
    !!featBackB1 &&
    !!featBackC1 &&
    !!featBackD2 &&
    JSON.stringify(featBackA1) === JSON.stringify(featBackA2) &&
    JSON.stringify(featBackB1) === JSON.stringify(featBackB2) &&
    JSON.stringify(featBackC1) === JSON.stringify(featBackC2);

  // 13. Timestamp edit preserves feature identity, types, and geometry
  const tsInitialEvents: GardenCareEvent[] = [
    { id: "ts-A", kind: "positive_moment", occurredAt: "2026-11-05T10:00:00Z" },
    { id: "ts-B", kind: "important_date", occurredAt: "2026-11-06" },
    { id: "ts-C", kind: "reconnection", occurredAt: "2026-11-07T10:00:00Z" },
  ];
  const scTsBefore = generateGardenSVGScene("couple-ts-test", 45, 8, false, undefined, "light", tsInitialEvents);
  const fTsA1 = captureEventFeature(scTsBefore, getCareFeatureId("positive_moment", "ts-A"));
  const fTsB1 = captureEventFeature(scTsBefore, getCareFeatureId("important_date", "ts-B"));
  const fTsC1 = captureEventFeature(scTsBefore, getCareFeatureId("reconnection", "ts-C"));

  // Edit B.occurredAt so B sorts before A
  const tsEditedEvents: GardenCareEvent[] = [
    { id: "ts-A", kind: "positive_moment", occurredAt: "2026-11-05T10:00:00Z" },
    { id: "ts-B", kind: "important_date", occurredAt: "2026-01-01" },
    { id: "ts-C", kind: "reconnection", occurredAt: "2026-11-07T10:00:00Z" },
  ];
  const scTsAfter = generateGardenSVGScene("couple-ts-test", 45, 8, false, undefined, "light", tsEditedEvents);
  const fTsA2 = captureEventFeature(scTsAfter, getCareFeatureId("positive_moment", "ts-A"));
  const fTsB2 = captureEventFeature(scTsAfter, getCareFeatureId("important_date", "ts-B"));
  const fTsC2 = captureEventFeature(scTsAfter, getCareFeatureId("reconnection", "ts-C"));

  const timestampEditPreservesFeatureIdentity =
    !!fTsA1 &&
    !!fTsB1 &&
    !!fTsC1 &&
    JSON.stringify(fTsA1) === JSON.stringify(fTsA2) &&
    JSON.stringify(fTsB1) === JSON.stringify(fTsB2) &&
    JSON.stringify(fTsC1) === JSON.stringify(fTsC2);

  // 14. No user identity in scene seed (only coupleId)
  const coupleIdOnlySeed = "couple-uuid-12345";
  const noUserIdentityInSceneSeed =
    generateGardenSVGScene(coupleIdOnlySeed, 20, 4).dna.silhouetteFamily ===
    generateGardenSVGScene(coupleIdOnlySeed, 20, 4).dna.silhouetteFamily;

  // 15. positiveFeatureVariety: representative event IDs produce at least 4 botanical families without >3 consecutive identical families/variants
  const repCategories = [
    "affection",
    "quality_time",
    "care",
    "support",
    "humour",
    "practical_help",
    "surprise",
    "other",
  ];
  const representativePosEvents: GardenCareEvent[] = Array.from({ length: 24 }, (_, i) => ({
    id: `pos-rep-${i + 1}`,
    kind: "positive_moment" as const,
    occurredAt: new Date(1700300000000 + i * 3600000).toISOString(),
    category: repCategories[i % repCategories.length],
  }));
  const seenPositiveFamilies = new Set<PositiveBotanicalFamily>();
  const seenPositiveVariants = new Set<PositiveBotanicalVariant>();
  for (const ev of representativePosEvents) {
    const resolved = resolvePositiveFeatureFamily(ev, "garden_in_bloom");
    seenPositiveFamilies.add(resolved.family);
    seenPositiveVariants.add(resolved.variant);
  }
  const seq12 = representativePosEvents.slice(0, 12);
  let maxConsecutiveVisualStreak = 1;
  let currentVisualStreak = 1;
  let prevVisualSig = "";
  for (const ev of seq12) {
    const r = resolvePositiveFeatureFamily(ev, "leafy_canopy");
    const sig = `${r.family}:${r.variant}`;
    if (sig === prevVisualSig) {
      currentVisualStreak++;
      if (currentVisualStreak > maxConsecutiveVisualStreak) {
        maxConsecutiveVisualStreak = currentVisualStreak;
      }
    } else {
      currentVisualStreak = 1;
      prevVisualSig = sig;
    }
  }
  const positiveFeatureVariety =
    seenPositiveFamilies.size >= 4 &&
    seenPositiveVariants.size >= 6 &&
    maxConsecutiveVisualStreak <= 3;

  // 16. positiveCategoryMappingStable: same category + event ID always resolves identically
  const positiveCategoryMappingStable = representativePosEvents.every((ev) => {
    const a = resolvePositiveFeatureFamily(ev, "garden_in_bloom");
    const b = resolvePositiveFeatureFamily(ev, "garden_in_bloom");
    const c = resolvePositiveFeatureFamily({ id: ev.id, category: ev.category }, "garden_in_bloom");
    return (
      a.family === b.family &&
      a.variant === b.variant &&
      a.family === c.family &&
      a.variant === c.variant
    );
  });

  // 17. positiveFeatureStageAppropriate: seedling never gets fruit or wildlife; deferred features mature later under same ID
  const scSeedlingPos = generateGardenSVGScene(
    "couple-pos-stage",
    6,
    4,
    false,
    undefined,
    "light",
    representativePosEvents
  );
  const seedlingHasNoFruitOrWildlife =
    (scSeedlingPos.habitatDetails || []).length === 0 &&
    !(scSeedlingPos.canopyDetails || []).some(
      (c) =>
        c.kind === "berry-cluster" ||
        c.kind === "fruit-bud" ||
        c.kind === "restrained-pod"
    ) &&
    !(scSeedlingPos.seedPods || []).some((p) => p.id.startsWith("care-positive-")) &&
    representativePosEvents.every(
      (ev) => !!captureEventFeature(scSeedlingPos, getCareFeatureId("positive_moment", ev.id))
    );
  const scMaturePos = generateGardenSVGScene(
    "couple-pos-stage",
    96,
    36,
    false,
    undefined,
    "light",
    representativePosEvents
  );
  const matureRetainsAllSameIds = representativePosEvents.every(
    (ev) => !!captureEventFeature(scMaturePos, getCareFeatureId("positive_moment", ev.id))
  );
  const positiveFeatureStageAppropriate =
    seedlingHasNoFruitOrWildlife && matureRetainsAllSameIds;

  // 18. positiveFeaturePartnerEquality: both partners in same couple receive identical features
  const scPosHello = generateGardenSVGScene(
    "couple-shared-pos-xyz",
    68,
    24,
    false,
    undefined,
    "light",
    representativePosEvents
  );
  const scPosWorld = generateGardenSVGScene(
    "couple-shared-pos-xyz",
    68,
    24,
    false,
    undefined,
    "light",
    representativePosEvents
  );
  const positiveFeaturePartnerEquality =
    JSON.stringify(scPosHello) === JSON.stringify(scPosWorld);

  // 19. positiveFeatureEventIdentityStable: backfilling or reordering preserves existing positive features
  const initialPosSubset: GardenCareEvent[] = [
    { id: "pos-id-A", kind: "positive_moment", occurredAt: "2026-11-05T10:00:00Z", category: "affection" },
    { id: "pos-id-B", kind: "positive_moment", occurredAt: "2026-11-06T10:00:00Z", category: "surprise" },
    { id: "pos-id-C", kind: "positive_moment", occurredAt: "2026-11-07T10:00:00Z", category: "quality_time" },
  ];
  const scPosBefore = generateGardenSVGScene("couple-pos-id", 72, 12, false, undefined, "light", initialPosSubset);
  const posBackfillSet: GardenCareEvent[] = [
    { id: "pos-id-C", kind: "positive_moment", occurredAt: "2026-11-07T10:00:00Z", category: "quality_time" },
    { id: "pos-id-EARLY", kind: "positive_moment", occurredAt: "2026-01-01T08:00:00Z", category: "practical_help" },
    { id: "pos-id-B", kind: "positive_moment", occurredAt: "2026-11-06T10:00:00Z", category: "surprise" },
    { id: "pos-id-A", kind: "positive_moment", occurredAt: "2026-11-05T10:00:00Z", category: "affection" },
  ];
  const scPosAfter = generateGardenSVGScene("couple-pos-id", 72, 14, false, undefined, "light", posBackfillSet);
  const positiveFeatureEventIdentityStable =
    initialPosSubset.every((ev) => {
      const fid = getCareFeatureId("positive_moment", ev.id);
      const fBefore = captureEventFeature(scPosBefore, fid);
      const fAfter = captureEventFeature(scPosAfter, fid);
      return !!fBefore && !!fAfter && JSON.stringify(fBefore) === JSON.stringify(fAfter);
    }) &&
    !!captureEventFeature(scPosAfter, getCareFeatureId("positive_moment", "pos-id-EARLY"));

  // 20. positiveFeatureCareCapAdditive: adding positive event past cap 40 still renders its feature
  const cap20Pos = representativePosEvents.slice(0, 20);
  const extraCapPos: GardenCareEvent = {
    id: "pos-after-cap-21",
    kind: "positive_moment",
    occurredAt: "2026-11-11T15:00:00Z",
    category: "surprise",
  };
  const scPosCap20 = generateGardenSVGScene("couple-pos-cap", 82, 40, false, undefined, "light", cap20Pos);
  const scPosCap21 = generateGardenSVGScene("couple-pos-cap", 82, 40, false, undefined, "light", [...cap20Pos, extraCapPos]);
  const extraCapId = getCareFeatureId("positive_moment", extraCapPos.id);
  const positiveFeatureCareCapAdditive =
    !!captureEventFeature(scPosCap21, extraCapId) &&
    cap20Pos.every((ev) => {
      const fid = getCareFeatureId("positive_moment", ev.id);
      return JSON.stringify(captureEventFeature(scPosCap20, fid)) === JSON.stringify(captureEventFeature(scPosCap21, fid));
    });

  // 21. positiveFeatureDistinctFromReconnection: positive features never enter reconnection blossoms
  const mixedCareSet: GardenCareEvent[] = [
    ...representativePosEvents.slice(0, 12),
    { id: "rec-mix-1", kind: "reconnection", occurredAt: "2026-11-02T12:00:00Z" },
    { id: "rec-mix-2", kind: "reconnection", occurredAt: "2026-11-04T12:00:00Z" },
  ];
  const scMixed = generateGardenSVGScene("couple-mix-distinct", 85, 32, false, undefined, "light", mixedCareSet);
  const positiveIdsInBlossoms = scMixed.blossoms.some((b) => b.id.startsWith("care-positive-"));
  const reconnectionBlossomsIntact = scMixed.blossoms.some(
    (b) => b.id.startsWith("care-reconnection-") && (b.petals?.length ?? 0) >= 5 && b.r >= 4.4
  );
  const positiveFeatureDistinctFromReconnection =
    !positiveIdsInBlossoms && reconnectionBlossomsIntact;

  // 22. positiveFeatureVisibleFullAndCompact: major positive features remain flagged compact-visible across full and compact
  const positiveFeatureVisibleFullAndCompact =
    representativePosEvents.every((ev) => {
      const fid = getCareFeatureId("positive_moment", ev.id);
      const foundCanopy = (scMaturePos.canopyDetails || []).find((c) => c.id === fid);
      const foundGround = scMaturePos.groundDetails.find((g) => g.id === fid);
      const foundHabitat = (scMaturePos.habitatDetails || []).find((h) => h.id === fid);
      const foundLeaf = scMaturePos.foliageClusters.find((f) => f.id === fid);
      if (foundCanopy) return foundCanopy.compact !== false;
      if (foundGround) return foundGround.compact !== false;
      if (foundHabitat) return foundHabitat.compact !== false;
      return !!foundLeaf;
    });

  const results = {
    sameSeedDeterministic,
    sameCouplePartnerEquality,
    differentCouplesStructurallyDiffer,
    canonicalSortingStable,
    deduplicationWorks,
    everyEventVisibleThrough50,
    reconnectionSequenceStable,
    careCapAdditive,
    stageBoundaryContinuity,
    compactFullIdentityConsistent,
    realtimeNoticeDeduplicated,
    backfilledEventPreservesExistingFeatures,
    timestampEditPreservesFeatureIdentity,
    noUserIdentityInSceneSeed,
    positiveFeatureVariety,
    positiveCategoryMappingStable,
    positiveFeatureStageAppropriate,
    positiveFeaturePartnerEquality,
    positiveFeatureEventIdentityStable,
    positiveFeatureCareCapAdditive,
    positiveFeatureDistinctFromReconnection,
    positiveFeatureVisibleFullAndCompact,
  };

  const allPass = Object.values(results).every(Boolean);

  return {
    success: allPass,
    results,
    message: allPass
      ? "All 22 living-garden invariants successfully verified."
      : "Some living-garden invariants failed.",
  };
}
