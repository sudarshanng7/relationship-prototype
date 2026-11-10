/**
 * Purple Garden - Deterministic Botanical Generator (SVG Redesign)
 *
 * NOTE: This is the Phase 1 botanical generator using react-native-svg.
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
  const clamped = Math.max(0, Math.min(100, Math.round(totalUnits)));
  if (clamped <= 15) return GARDEN_STAGES.first_seedling;
  if (clamped <= 35) return GARDEN_STAGES.tender_sapling;
  if (clamped <= 55) return GARDEN_STAGES.branching_out;
  if (clamped <= 75) return GARDEN_STAGES.leafy_canopy;
  if (clamped <= 90) return GARDEN_STAGES.rooted_flourishing;
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
// 3. CONTROLLED BOTANICAL PALETTES
// ----------------------------------------------------

export interface BotanicalPalette {
  name: string;
  trunk: string;
  trunkHighlight: string;
  deepFoliage: string;
  midFoliage: string;
  lightFoliage: string;
  accentLeaf: string;
  blossomPrimary: string;
  blossomSecondary: string;
  groundBase: string;
  groundHighlight: string;
  skyTop: string;
  skyBottom: string;
  restingSkyTop: string;
  restingSkyBottom: string;
  sunGlow: string;
}

export const BOTANICAL_PALETTES: BotanicalPalette[] = [
  // 1. Plum & Sage
  {
    name: "Plum & Sage",
    trunk: "#4E3A4D",
    trunkHighlight: "#684E67",
    deepFoliage: "#2E4736",
    midFoliage: "#436650",
    lightFoliage: "#668D72",
    accentLeaf: "#527B5E",
    blossomPrimary: "#CF7288",
    blossomSecondary: "#E8B2C0",
    groundBase: "#364C3B",
    groundHighlight: "#4C6B53",
    skyTop: "#F4EFF6",
    skyBottom: "#EAE2EE",
    restingSkyTop: "#E7DFEA",
    restingSkyBottom: "#D7CDDC",
    sunGlow: "#F9ECE4",
  },
  // 2. Lavender & Teal
  {
    name: "Lavender & Teal",
    trunk: "#403646",
    trunkHighlight: "#594B60",
    deepFoliage: "#24474A",
    midFoliage: "#36666A",
    lightFoliage: "#5B9296",
    accentLeaf: "#487D81",
    blossomPrimary: "#B588BC",
    blossomSecondary: "#DEB8E4",
    groundBase: "#2D4B4D",
    groundHighlight: "#416769",
    skyTop: "#F0F4F7",
    skyBottom: "#E3EBF0",
    restingSkyTop: "#E2E7ED",
    restingSkyBottom: "#D2DAE2",
    sunGlow: "#F6F1E5",
  },
  // 3. Forest & Mauve
  {
    name: "Forest & Mauve",
    trunk: "#44342E",
    trunkHighlight: "#5E4941",
    deepFoliage: "#244227",
    midFoliage: "#375C3B",
    lightFoliage: "#5E8762",
    accentLeaf: "#476F4B",
    blossomPrimary: "#A85E77",
    blossomSecondary: "#D397A9",
    groundBase: "#2B482E",
    groundHighlight: "#3F6543",
    skyTop: "#F6F2EC",
    skyBottom: "#EBE3D8",
    restingSkyTop: "#EAE3DA",
    restingSkyBottom: "#D9D0C4",
    sunGlow: "#FAF1DF",
  },
  // 4. Violet & Moss
  {
    name: "Violet & Moss",
    trunk: "#3E3044",
    trunkHighlight: "#55445C",
    deepFoliage: "#2B4324",
    midFoliage: "#3F5E36",
    lightFoliage: "#6A8C60",
    accentLeaf: "#527548",
    blossomPrimary: "#CE7C8D",
    blossomSecondary: "#E6B2BD",
    groundBase: "#30482B",
    groundHighlight: "#44643E",
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
 * Creates an organic billowing foliage cloud path using 6 overlapping bezier lobes.
 */
function createOrganicCloudPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  skewX: number = 0
): string {
  const p1 = `${cx - rx},${cy}`;
  const c1a = `${cx - rx},${cy - ry * 0.7}`;
  const c1b = `${cx - rx * 0.5 + skewX},${cy - ry * 1.05}`;
  const p2 = `${cx + skewX * 0.5},${cy - ry * 0.95}`;

  const c2a = `${cx + rx * 0.5 + skewX},${cy - ry * 1.05}`;
  const c2b = `${cx + rx},${cy - ry * 0.6}`;
  const p3 = `${cx + rx},${cy}`;

  const c3a = `${cx + rx * 1.05},${cy + ry * 0.6}`;
  const c3b = `${cx + rx * 0.5},${cy + ry * 0.95}`;
  const p4 = `${cx},${cy + ry * 0.85}`;

  const c4a = `${cx - rx * 0.5},${cy + ry * 0.95}`;
  const c4b = `${cx - rx},${cy + ry * 0.5}`;

  return `M ${p1} C ${c1a} ${c1b} ${p2} C ${c2a} ${c2b} ${p3} C ${c3a} ${c3b} ${p4} C ${c4a} ${c4b} ${p1} Z`;
}

export interface FoliageClusterSVG {
  id: string;
  d: string;
  color: string;
  opacity: number;
}

export interface BlossomSVG {
  id: string;
  cx: number;
  cy: number;
  r: number;
  color: string;
  petalColor: string;
  hasCluster: boolean;
}

export interface GroundDetailSVG {
  id: string;
  type: "stone" | "grass" | "flower";
  d?: string;
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  color: string;
  accentColor?: string;
}

export interface GeneratedGardenSVGScene {
  stage: GardenStage;
  palette: BotanicalPalette;
  isResting: boolean;
  ambienceLabel: AmbienceLabel;
  skyTop: string;
  skyBottom: string;
  sunGlowColor: string;
  distantHillsPath: string;
  groundLayerBack: string;
  groundLayerMid: string;
  groundLayerFront: string;
  trunkPath: string;
  trunkHighlightPath?: string;
  branches: string[];
  foliageClusters: FoliageClusterSVG[];
  blossoms: BlossomSVG[];
  groundDetails: GroundDetailSVG[];
  restingCreature?: {
    type: "sparrow" | "butterfly";
    cx: number;
    cy: number;
  };
  accessibilityDescription: string;
}

// ----------------------------------------------------
// 5. MASTER PROCEDURAL SCENE GENERATOR
// ----------------------------------------------------

export function generateGardenSVGScene(
  seedString: string,
  totalGrowthUnits: number,
  careGrowthUnits: number,
  isResting: boolean = false
): GeneratedGardenSVGScene {
  const seed = hashStringToSeed(seedString || "purple-garden-couple-seed");
  const rand = createPRNG(seed);

  const stage = getGardenStage(totalGrowthUnits);
  const palette = getPaletteForSeed(seed);
  const ambienceLabel = getAmbienceLabel(stage.key, isResting);

  const skyTop = isResting ? palette.restingSkyTop : palette.skyTop;
  const skyBottom = isResting ? palette.restingSkyBottom : palette.skyBottom;
  const sunGlowColor = palette.sunGlow;

  // Gentle subtle tilt for natural variance (-3 to +3 px)
  const tilt = (rand() - 0.5) * 6;

  // 1. Distant rolling landscape layer
  const distantHillsPath = `M 0,335 Q 200,305 410,325 T 800,315 L 800,500 L 0,500 Z`;

  // 2. Three depth-layered ground paths
  const groundLayerBack = `M 0,370 Q 250,345 510,365 T 800,350 L 800,500 L 0,500 Z`;
  const groundLayerMid = `M 0,402 Q 230,375 470,398 T 800,385 L 800,500 L 0,500 Z`;
  const groundLayerFront = `M 0,436 Q 270,412 530,432 T 800,422 L 800,500 L 0,500 Z`;

  // Ground details (seeded stones, grass tufts, tiny flowers)
  const groundDetails: GroundDetailSVG[] = [
    // Pebbles
    {
      id: "pebble-1",
      type: "stone",
      cx: 325 + rand() * 10,
      cy: 446,
      rx: 9,
      ry: 5,
      color: palette.trunkHighlight,
    },
    {
      id: "pebble-2",
      type: "stone",
      cx: 475 + rand() * 10,
      cy: 450,
      rx: 12,
      ry: 6,
      color: palette.trunk,
    },
    {
      id: "pebble-3",
      type: "stone",
      cx: 515 + rand() * 8,
      cy: 456,
      rx: 7,
      ry: 4,
      color: palette.trunkHighlight,
    },
    // Grass tufts
    {
      id: "grass-1",
      type: "grass",
      d: "M 270,428 Q 265,414 260,408 Q 267,416 272,428 M 273,428 Q 276,412 282,406 Q 278,416 276,428",
      color: palette.lightFoliage,
    },
    {
      id: "grass-2",
      type: "grass",
      d: "M 530,438 Q 525,422 518,416 Q 527,425 532,438 M 533,438 Q 537,420 544,414 Q 539,425 536,438",
      color: palette.lightFoliage,
    },
    {
      id: "grass-3",
      type: "grass",
      d: "M 360,442 Q 355,430 350,424 Q 358,432 363,442 M 364,442 Q 367,428 373,422 Q 369,431 366,442",
      color: palette.accentLeaf,
    },
  ];

  let trunkPath = "";
  let trunkHighlightPath: string | undefined = undefined;
  const branches: string[] = [];
  const foliageClusters: FoliageClusterSVG[] = [];
  const blossoms: BlossomSVG[] = [];

  // ==================================================
  // STAGE 1: FIRST SEEDLING (0–15 units)
  // ==================================================
  if (stage.key === "first_seedling") {
    // Curved young stem emerging from small soil mound
    trunkPath = `M 397,440 Q 399,380 404,320 Q 407,250 396,190 Q 391,155 395,130 Q 399,155 403,190 Q 412,250 408,320 Q 403,380 402,440 Z`;
    trunkHighlightPath = `M 399,430 Q 401,380 405,320 Q 407,250 398,190`;

    // Real organic botanical leaf shapes branching off the young stem
    // Leaf 1 (Left lower):
    foliageClusters.push({
      id: "seedling-leaf-1",
      d: "M 405,310 C 365,296 332,268 320,235 C 346,238 382,266 403,298 Z",
      color: palette.midFoliage,
      opacity: 0.95,
    });
    // Leaf 2 (Right mid):
    foliageClusters.push({
      id: "seedling-leaf-2",
      d: "M 402,260 C 442,246 474,216 486,185 C 458,188 424,216 404,248 Z",
      color: palette.lightFoliage,
      opacity: 0.95,
    });
    // Leaf 3 (Left upper):
    foliageClusters.push({
      id: "seedling-leaf-3",
      d: "M 397,200 C 365,184 340,154 336,126 C 358,130 384,158 398,188 Z",
      color: palette.accentLeaf,
      opacity: 0.95,
    });
    // Leaf 4 (Crown left):
    foliageClusters.push({
      id: "seedling-crown-1",
      d: "M 395,145 C 378,124 380,102 394,86 C 402,106 400,128 397,145 Z",
      color: palette.lightFoliage,
      opacity: 0.95,
    });
    // Leaf 5 (Crown right):
    foliageClusters.push({
      id: "seedling-crown-2",
      d: "M 396,145 C 414,124 412,102 398,86 C 392,106 393,128 395,145 Z",
      color: palette.accentLeaf,
      opacity: 0.95,
    });

    // Companion tender sprout near base
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
    // Stronger young trunk with root start
    trunkPath = `M 388,442 Q 392,375 395,305 Q 397,245 400,195 Q 404,245 407,305 Q 411,375 416,442 Z`;
    trunkHighlightPath = `M 392,430 Q 395,375 398,305 Q 400,245 402,205`;

    // 2 natural branches
    branches.push(
      "M 395,290 Q 355,265 315,245 Q 355,275 396,305 Z",
      "M 405,255 Q 450,230 488,210 Q 448,242 404,270 Z"
    );

    // 3 distinct organic foliage masses
    foliageClusters.push(
      {
        id: "sapling-foliage-left",
        d: createOrganicCloudPath(310 + tilt, 225, 62, 45, -8),
        color: palette.deepFoliage,
        opacity: 0.95,
      },
      {
        id: "sapling-foliage-right",
        d: createOrganicCloudPath(490 + tilt, 195, 66, 48, 8),
        color: palette.midFoliage,
        opacity: 0.95,
      },
      {
        id: "sapling-foliage-crown",
        d: createOrganicCloudPath(400 + tilt, 155, 75, 55, 0),
        color: palette.lightFoliage,
        opacity: 0.92,
      }
    );

    // First ground wildflowers
    groundDetails.push(
      {
        id: "sapling-flower-1",
        type: "flower",
        cx: 345,
        cy: 438,
        color: palette.blossomPrimary,
      },
      {
        id: "sapling-flower-2",
        type: "flower",
        cx: 455,
        cy: 444,
        color: palette.blossomSecondary,
      }
    );
  }

  // ==================================================
  // STAGE 3: BRANCHING OUT (36–55 units)
  // ==================================================
  else if (stage.key === "branching_out") {
    // Solid tapering trunk with natural root base
    trunkPath = `M 382,444 Q 388,415 391,370 Q 394,300 398,230 Q 404,300 408,370 Q 412,415 422,444 Z`;
    trunkHighlightPath = `M 388,435 Q 394,370 397,300 Q 399,240 401,230`;

    // Spreading branch framework
    branches.push(
      "M 393,310 Q 345,280 280,260 Q 345,292 394,324 Z",
      "M 406,280 Q 460,250 520,230 Q 460,265 404,295 Z",
      "M 397,240 Q 370,195 345,170 Q 380,205 399,245 Z"
    );

    // 5 layered foliage clusters (deep, mid, and sunlit light)
    foliageClusters.push(
      {
        id: "branching-deep-left",
        d: createOrganicCloudPath(275 + tilt, 245, 80, 55, -12),
        color: palette.deepFoliage,
        opacity: 0.95,
      },
      {
        id: "branching-deep-right",
        d: createOrganicCloudPath(525 + tilt, 215, 85, 60, 14),
        color: palette.deepFoliage,
        opacity: 0.95,
      },
      {
        id: "branching-mid-center",
        d: createOrganicCloudPath(395 + tilt, 205, 95, 68, 0),
        color: palette.midFoliage,
        opacity: 0.95,
      },
      {
        id: "branching-light-left",
        d: createOrganicCloudPath(340 + tilt, 160, 75, 52, -6),
        color: palette.lightFoliage,
        opacity: 0.92,
      },
      {
        id: "branching-light-crown",
        d: createOrganicCloudPath(420 + tilt, 130, 80, 56, 6),
        color: palette.accentLeaf,
        opacity: 0.9,
      }
    );

    // First accent blossoms (4 blossoms)
    blossoms.push(
      {
        id: "b-1",
        cx: 260 + tilt,
        cy: 235,
        r: 5.5,
        color: palette.blossomPrimary,
        petalColor: palette.blossomSecondary,
        hasCluster: false,
      },
      {
        id: "b-2",
        cx: 345 + tilt,
        cy: 145,
        r: 6,
        color: palette.blossomSecondary,
        petalColor: palette.blossomPrimary,
        hasCluster: true,
      },
      {
        id: "b-3",
        cx: 440 + tilt,
        cy: 125,
        r: 5.5,
        color: palette.blossomPrimary,
        petalColor: palette.blossomSecondary,
        hasCluster: false,
      },
      {
        id: "b-4",
        cx: 535 + tilt,
        cy: 205,
        r: 6,
        color: palette.blossomSecondary,
        petalColor: palette.blossomPrimary,
        hasCluster: true,
      }
    );
  }

  // ==================================================
  // STAGES 4, 5, 6: LEAFY CANOPY, ROOTED, IN BLOOM
  // ==================================================
  else {
    const isMature = stage.key === "garden_in_bloom";
    const isFlourishing = stage.key === "rooted_flourishing" || isMature;

    // Grounded trunk with pronounced root flare
    const flareLeft = isFlourishing ? 366 : 374;
    const flareRight = isFlourishing ? 438 : 428;

    trunkPath = `M ${flareLeft},446 Q 384,418 388,365 Q 392,295 396,215 Q 404,295 408,365 Q 414,418 ${flareRight},446 Z`;
    trunkHighlightPath = `M ${flareLeft + 8},436 Q 390,365 394,295 Q 397,225 400,215`;

    // Robust branch architecture
    branches.push(
      "M 390,330 Q 330,290 250,265 Q 330,305 392,345 Z",
      "M 408,300 Q 475,260 550,235 Q 475,280 405,318 Z",
      "M 394,250 Q 350,195 310,165 Q 360,210 397,258 Z",
      "M 403,230 Q 438,180 475,150 Q 435,195 402,238 Z"
    );

    // Multi-layered lush canopy (8 to 11 overlapping lobes)
    foliageClusters.push(
      // Deep foundation shadow lobes
      {
        id: "canopy-deep-left",
        d: createOrganicCloudPath(245 + tilt, 255, 95, 65, -15),
        color: palette.deepFoliage,
        opacity: 0.96,
      },
      {
        id: "canopy-deep-right",
        d: createOrganicCloudPath(555 + tilt, 225, 100, 70, 15),
        color: palette.deepFoliage,
        opacity: 0.96,
      },
      {
        id: "canopy-deep-mid",
        d: createOrganicCloudPath(400 + tilt, 220, 115, 80, 0),
        color: palette.deepFoliage,
        opacity: 0.96,
      },
      // Mid-canopy masses
      {
        id: "canopy-mid-left",
        d: createOrganicCloudPath(310 + tilt, 195, 95, 68, -8),
        color: palette.midFoliage,
        opacity: 0.96,
      },
      {
        id: "canopy-mid-right",
        d: createOrganicCloudPath(485 + tilt, 175, 100, 72, 8),
        color: palette.midFoliage,
        opacity: 0.96,
      },
      {
        id: "canopy-mid-center",
        d: createOrganicCloudPath(400 + tilt, 150, 105, 75, 0),
        color: palette.midFoliage,
        opacity: 0.96,
      },
      // Sunlit crown highlights
      {
        id: "canopy-light-left",
        d: createOrganicCloudPath(345 + tilt, 125, 85, 60, -6),
        color: palette.lightFoliage,
        opacity: 0.94,
      },
      {
        id: "canopy-light-right",
        d: createOrganicCloudPath(455 + tilt, 110, 88, 62, 6),
        color: palette.lightFoliage,
        opacity: 0.94,
      },
      {
        id: "canopy-crest",
        d: createOrganicCloudPath(400 + tilt, 85, 90, 62, 0),
        color: palette.accentLeaf,
        opacity: 0.92,
      }
    );

    // Blossoms scaled by care activity and mature stage
    const count = isMature ? 14 : isFlourishing ? 11 : 8;
    const baseBlossomCoords = [
      { x: 235, y: 245 },
      { x: 290, y: 185 },
      { x: 335, y: 130 },
      { x: 385, y: 80 },
      { x: 440, y: 75 },
      { x: 495, y: 110 },
      { x: 550, y: 165 },
      { x: 575, y: 220 },
      { x: 270, y: 220 },
      { x: 370, y: 145 },
      { x: 445, y: 140 },
      { x: 515, y: 175 },
      { x: 320, y: 170 },
      { x: 470, y: 145 },
    ];

    for (let i = 0; i < count; i++) {
      const coord = baseBlossomCoords[i % baseBlossomCoords.length];
      const isEven = i % 2 === 0;
      blossoms.push({
        id: `blossom-${i}`,
        cx: coord.x + tilt + (rand() - 0.5) * 8,
        cy: coord.y + (rand() - 0.5) * 6,
        r: 5.5 + (i % 3),
        color: isEven ? palette.blossomPrimary : palette.blossomSecondary,
        petalColor: isEven ? palette.blossomSecondary : palette.blossomPrimary,
        hasCluster: i % 3 === 0,
      });
    }

    // Ground flora under tree
    groundDetails.push(
      {
        id: "ground-flower-1",
        type: "flower",
        cx: 335,
        cy: 438,
        color: palette.blossomPrimary,
      },
      {
        id: "ground-flower-2",
        type: "flower",
        cx: 470,
        cy: 442,
        color: palette.blossomSecondary,
      },
      {
        id: "ground-flower-3",
        type: "flower",
        cx: 520,
        cy: 446,
        color: palette.blossomPrimary,
      }
    );
  }

  // Resting creature placement in flourishing or resting states
  let restingCreature: GeneratedGardenSVGScene["restingCreature"] = undefined;
  if ((isResting || stage.key === "garden_in_bloom") && totalGrowthUnits >= 30) {
    restingCreature = {
      type: rand() > 0.5 ? "butterfly" : "sparrow",
      cx: 325 + tilt,
      cy: 235,
    };
  }

  const restingText = isResting
    ? "resting quietly under calm twilight"
    : "growing gently in soft light";
  const accessibilityDescription = `A shared botanical garden tree in the ${stage.label} stage, ${restingText}.`;

  return {
    stage,
    palette,
    isResting,
    ambienceLabel,
    skyTop,
    skyBottom,
    sunGlowColor,
    distantHillsPath,
    groundLayerBack,
    groundLayerMid,
    groundLayerFront,
    trunkPath,
    trunkHighlightPath,
    branches,
    foliageClusters,
    blossoms,
    groundDetails,
    restingCreature,
    accessibilityDescription,
  };
}
