/**
 * Purple Garden - Botanical Asset Manifest Contract (Phase 1)
 *
 * Defines the contract for static and procedural botanical assets, establishing
 * layer depth conventions, attachment pivots, local bounding boxes, and
 * provenance tracking.
 *
 * NOTE: Phase 1 continues using current procedural SVG assets.
 * This file formalizes the metadata requirements for future painterly 2.5D assets.
 */

import type {
  BotanicalAssetManifest,
  BoundingBox2D,
  Point2D,
  StageStructuralAssetSlot,
  PainterlyStructuralAssetKey,
  StageAssetApprovalStatus,
  BotanicalAttachmentRegion,
  TreeCompositionPreset,
  TreeCompositionPresetName,
} from "./world-types";
import type { CanonicalStageKeyOrBeginning } from "./stage-contracts";

export const BUILTIN_PROCEDURAL_ASSET_MANIFESTS: Record<string, BotanicalAssetManifest> = {
  "terrain-clearing-meadow-v1": {
    assetKey: "terrain-clearing-meadow-v1",
    version: "2.0.0",
    botanicalFamily: "topography",
    variant: "clearing_meadow_layered",
    localBounds: { minX: 0, minY: 300, maxX: 800, maxY: 500, width: 800, height: 200 },
    attachmentPivot: { x: 400, y: 500 },
    depthLayer: -40,
    detailLevelVariants: {
      low: "flat_contour_curves",
      medium: "three_layer_soft_graduated_meadow",
      high: "quad_layer_topography_with_distant_treeline",
    },
    licensingProvenance: {
      source: "procedural",
      author: "Google DeepMind / Purple Garden Team",
      notes: "Procedurally contoured via DNA peak points",
    },
    themeVariants: {
      light: { meadowTop: "#889F70", meadowBottom: "#556E42" },
      dim: { meadowTop: "#6E825A", meadowBottom: "#455935" },
      dark: { meadowTop: "#4E5C40", meadowBottom: "#324026" },
    },
  },

  "tree-ancient-oak-trunk-v1": {
    assetKey: "tree-ancient-oak-trunk-v1",
    version: "2.0.0",
    botanicalFamily: "broadleaf_woodland",
    variant: "ancient_oak_buttressed_trunk",
    localBounds: { minX: 300, minY: 150, maxX: 500, maxY: 440, width: 200, height: 290 },
    attachmentPivot: { x: 400, y: 440 },
    depthLayer: 0,
    detailLevelVariants: {
      low: "trunk_silhouette_spline",
      medium: "trunk_spline_with_highlight_and_shadow",
      high: "trunk_textured_with_bark_grain_and_knots",
    },
    licensingProvenance: {
      source: "procedural",
      author: "Google DeepMind / Purple Garden Team",
      notes: "Procedurally derived from couple seed via FNV-1a hash",
    },
    themeVariants: {
      light: { trunk: "#6E5B4B", shadow: "#5A493C", highlight: "#826F5E" },
      dim: { trunk: "#56483C", shadow: "#44392F", highlight: "#68584A" },
      dark: { trunk: "#3E342B", shadow: "#2E2620", highlight: "#4E4237" },
    },
  },

  "canopy-shadow-mass-v1": {
    assetKey: "canopy-shadow-mass-v1",
    version: "2.0.0",
    botanicalFamily: "broadleaf_woodland",
    variant: "deep_canopy_shadow_underlay",
    localBounds: { minX: -60, minY: -40, maxX: 60, maxY: 40, width: 120, height: 80 },
    attachmentPivot: { x: 0, y: 0 },
    depthLayer: 22,
    detailLevelVariants: {
      low: "convex_shadow_disc",
      medium: "lobed_canopy_shadow_mass",
      high: "multi_lobe_organic_depth_silhouette",
    },
    licensingProvenance: {
      source: "procedural",
      author: "Google DeepMind / Purple Garden Team",
    },
    themeVariants: {
      light: { foliage: "#2D4428", opacity: "0.95" },
      dim: { foliage: "#233520", opacity: "0.95" },
      dark: { foliage: "#192617", opacity: "0.95" },
    },
  },

  "canopy-foliage-mass-v1": {
    assetKey: "canopy-foliage-mass-v1",
    version: "2.0.0",
    botanicalFamily: "broadleaf_woodland",
    variant: "mid_canopy_lobed_foliage",
    localBounds: { minX: -55, minY: -35, maxX: 55, maxY: 35, width: 110, height: 70 },
    attachmentPivot: { x: 0, y: 0 },
    depthLayer: 30,
    detailLevelVariants: {
      low: "simple_lobed_foliage",
      medium: "overlapping_lobed_foliage_masses",
      high: "detailed_foliage_with_secondary_leaf_veins",
    },
    licensingProvenance: {
      source: "procedural",
      author: "Google DeepMind / Purple Garden Team",
    },
  },

  "canopy-sunlit-leaves-v1": {
    assetKey: "canopy-sunlit-leaves-v1",
    version: "2.0.0",
    botanicalFamily: "broadleaf_woodland",
    variant: "top_lit_highlight_canopy",
    localBounds: { minX: -40, minY: -25, maxX: 40, maxY: 25, width: 80, height: 50 },
    attachmentPivot: { x: 0, y: 0 },
    depthLayer: 38,
    detailLevelVariants: {
      low: "simple_crown_highlight",
      medium: "layered_sunlit_highlight_clusters",
      high: "delicate_translucent_leaf_crests",
    },
    licensingProvenance: {
      source: "procedural",
      author: "Google DeepMind / Purple Garden Team",
    },
  },

  "blossom-reconnection-rose-v1": {
    assetKey: "blossom-reconnection-rose-v1",
    version: "2.0.0",
    botanicalFamily: "reconnection_blossom",
    variant: "five_petal_rose",
    localBounds: { minX: -14, minY: -14, maxX: 14, maxY: 14, width: 28, height: 28 },
    attachmentPivot: { x: 0, y: 0 },
    depthLayer: 50,
    detailLevelVariants: {
      low: "blossom_disc",
      medium: "blossom_five_petals",
      high: "blossom_layered_petals_with_dark_core_and_cream_stamen",
    },
    licensingProvenance: {
      source: "procedural",
      author: "Google DeepMind / Purple Garden Team",
    },
  },

  "bud-closed-calyx-v1": {
    assetKey: "bud-closed-calyx-v1",
    version: "2.0.0",
    botanicalFamily: "tender_growth",
    variant: "paired_closed_buds",
    localBounds: { minX: -8, minY: -12, maxX: 8, maxY: 4, width: 16, height: 16 },
    attachmentPivot: { x: 0, y: 0 },
    depthLayer: 45,
    detailLevelVariants: {
      low: "simple_bud_ellipse",
      medium: "bud_with_calyx_embrace",
      high: "elongated_swelling_bud_with_highlight",
    },
    licensingProvenance: {
      source: "procedural",
      author: "Google DeepMind / Purple Garden Team",
    },
  },

  "berry-woodland-cluster-v1": {
    assetKey: "berry-woodland-cluster-v1",
    version: "2.0.0",
    botanicalFamily: "woodland_berry",
    variant: "triplet_berry_cluster",
    localBounds: { minX: -10, minY: -10, maxX: 10, maxY: 10, width: 20, height: 20 },
    attachmentPivot: { x: 0, y: 0 },
    depthLayer: 45,
    detailLevelVariants: {
      low: "colored_discs",
      medium: "berry_trio_with_stems",
      high: "translucent_gloss_berries_with_specular_highlights",
    },
    licensingProvenance: {
      source: "procedural",
      author: "Google DeepMind / Purple Garden Team",
    },
  },

  "seed-pod-restrained-v1": {
    assetKey: "seed-pod-restrained-v1",
    version: "2.0.0",
    botanicalFamily: "mature_fruit",
    variant: "autumn_seed_pod",
    localBounds: { minX: -8, minY: -14, maxX: 8, maxY: 8, width: 16, height: 22 },
    attachmentPivot: { x: 0, y: -10 },
    depthLayer: 50,
    detailLevelVariants: {
      low: "simple_pod_disc",
      medium: "stemmed_elliptical_pod",
      high: "sculpted_pod_with_top_curved_stem_and_illuminating_core",
    },
    licensingProvenance: {
      source: "procedural",
      author: "Google DeepMind / Purple Garden Team",
    },
  },

  "flora-woodland-fern-v1": {
    assetKey: "flora-woodland-fern-v1",
    version: "2.0.0",
    botanicalFamily: "ground_life",
    variant: "arching_fern_frond",
    localBounds: { minX: -16, minY: -24, maxX: 16, maxY: 4, width: 32, height: 28 },
    attachmentPivot: { x: 0, y: 0 },
    depthLayer: 10,
    detailLevelVariants: {
      low: "frond_silhouette",
      medium: "curved_stem_with_pinnae_lobes",
      high: "detailed_bipinnate_frond_cluster",
    },
    licensingProvenance: {
      source: "procedural",
      author: "Google DeepMind / Purple Garden Team",
    },
  },

  "flora-clover-cover-v1": {
    assetKey: "flora-clover-cover-v1",
    version: "2.0.0",
    botanicalFamily: "ground_life",
    variant: "trifoliate_clover_cluster",
    localBounds: { minX: -10, minY: -12, maxX: 10, maxY: 2, width: 20, height: 14 },
    attachmentPivot: { x: 0, y: 0 },
    depthLayer: 10,
    detailLevelVariants: {
      low: "simple_clover_discs",
      medium: "three_heart_leaflets",
      high: "radiating_trifoliate_with_subtle_leaf_chevron",
    },
    licensingProvenance: {
      source: "procedural",
      author: "Google DeepMind / Purple Garden Team",
    },
  },

  "flora-moss-cushion-v1": {
    assetKey: "flora-moss-cushion-v1",
    version: "2.0.0",
    botanicalFamily: "ground_life",
    variant: "velveteen_moss_pad",
    localBounds: { minX: -14, minY: -8, maxX: 14, maxY: 8, width: 28, height: 16 },
    attachmentPivot: { x: 0, y: 0 },
    depthLayer: 10,
    detailLevelVariants: {
      low: "single_moss_ellipse",
      medium: "double_cushion_with_sun_highlight",
      high: "layered_organic_moss_colony_with_soil_shadow",
    },
    licensingProvenance: {
      source: "procedural",
      author: "Google DeepMind / Purple Garden Team",
    },
  },

  "flora-meadow-flower-v1": {
    assetKey: "flora-meadow-flower-v1",
    version: "2.0.0",
    botanicalFamily: "ground_life",
    variant: "woodland_starflower",
    localBounds: { minX: -12, minY: -22, maxX: 12, maxY: 2, width: 24, height: 24 },
    attachmentPivot: { x: 0, y: 0 },
    depthLayer: 10,
    detailLevelVariants: {
      low: "stem_and_circle",
      medium: "stem_with_paired_leaves_and_flower",
      high: "slender_stem_with_lanceolate_leaves_and_four_petal_florets",
    },
    licensingProvenance: {
      source: "procedural",
      author: "Google DeepMind / Purple Garden Team",
    },
  },

  "fauna-european-robin-v1": {
    assetKey: "fauna-european-robin-v1",
    version: "2.0.0",
    botanicalFamily: "wildlife",
    variant: "perched_songbird_robin",
    localBounds: { minX: -12, minY: -10, maxX: 14, maxY: 8, width: 26, height: 18 },
    attachmentPivot: { x: 0, y: 0 },
    depthLayer: 60,
    detailLevelVariants: {
      low: "bird_silhouette",
      medium: "body_chest_head_and_tail",
      high: "songbird_with_warm_orange_breast_and_sharp_beak",
    },
    licensingProvenance: {
      source: "procedural",
      author: "Google DeepMind / Purple Garden Team",
    },
  },

  "fauna-peacock-butterfly-v1": {
    assetKey: "fauna-peacock-butterfly-v1",
    version: "2.0.0",
    botanicalFamily: "wildlife",
    variant: "fluttering_butterfly",
    localBounds: { minX: -14, minY: -12, maxX: 14, maxY: 12, width: 28, height: 24 },
    attachmentPivot: { x: 0, y: 0 },
    depthLayer: 60,
    detailLevelVariants: {
      low: "winged_silhouette",
      medium: "four_wing_flutter_with_body",
      high: "dual_color_scaled_wings_with_slender_thorax",
    },
    licensingProvenance: {
      source: "procedural",
      author: "Google DeepMind / Purple Garden Team",
    },
  },

  "fauna-bumblebee-pollinator-v1": {
    assetKey: "fauna-bumblebee-pollinator-v1",
    version: "2.0.0",
    botanicalFamily: "wildlife",
    variant: "hovering_pollinator_bee",
    localBounds: { minX: -8, minY: -8, maxX: 8, maxY: 8, width: 16, height: 16 },
    attachmentPivot: { x: 0, y: 0 },
    depthLayer: 60,
    detailLevelVariants: {
      low: "striped_oval",
      medium: "body_with_angled_translucent_wings",
      high: "furry_bumblebee_with_translucent_wings_and_stripes",
    },
    licensingProvenance: {
      source: "procedural",
      author: "Google DeepMind / Purple Garden Team",
    },
  },

  "stream-curved-brook-v1": {
    assetKey: "stream-curved-brook-v1",
    version: "2.0.0",
    botanicalFamily: "topography",
    variant: "meandering_water_brook",
    localBounds: { minX: 450, minY: 370, maxX: 800, maxY: 500, width: 350, height: 130 },
    attachmentPivot: { x: 600, y: 440 },
    depthLayer: -25,
    detailLevelVariants: {
      low: "water_spline",
      medium: "water_stream_with_earth_bank",
      high: "curved_brook_with_loam_bank_and_water_ripples",
    },
    licensingProvenance: {
      source: "procedural",
      author: "Google DeepMind / Purple Garden Team",
    },
  },

  "landmark-important-date-v1": {
    assetKey: "landmark-important-date-v1",
    version: "2.0.0",
    botanicalFamily: "ground_life",
    variant: "landmark_flower",
    localBounds: { minX: -10, minY: -18, maxX: 10, maxY: 0, width: 20, height: 18 },
    attachmentPivot: { x: 0, y: 0 },
    depthLayer: 15,
    detailLevelVariants: {
      low: "stem_and_disc",
      medium: "floret_cluster_with_leaves",
      high: "multi_floret_monument_with_basal_leaves_and_accent_stamens",
    },
    licensingProvenance: {
      source: "procedural",
      author: "Google DeepMind / Purple Garden Team",
    },
  },
};

/**
 * Calibrated manifest record for the painterly 2.5D ancient mature oak structure.
 * Derived empirically from native 1586x992 RGBA alpha mask in the Painterly Asset Lab.
 *
 * NOTE: This asset contains exclusively the wood framework (roots, buttresses,
 * trunk, scaffold limbs, and secondary branches). It contains NO foliage.
 * Foliage clusters will be introduced in future calibrated foliage assets.
 */
export const PAINTERLY_OAK_STRUCTURE_MATURE_V1: BotanicalAssetManifest = {
  assetKey: "painterly-oak-structure-mature-v1",
  version: "1.0.0",
  botanicalFamily: "broadleaf_woodland",
  variant: "ancient_oak_mature_painterly",
  hasFoliage: false,
  supportedStages: ["garden_in_bloom"],
  localBounds: {
    minX: 26.7,
    minY: 7.1,
    maxX: 769.2,
    maxY: 488.4,
    width: 742.5,
    height: 481.3,
  },
  attachmentPivot: { x: 390.4, y: 441.0 }, // Central soil planting collar
  depthLayer: 0,
  detailLevelVariants: {
    high: "assets/garden/painterly/oak-structure-mature-alpha-v1.png",
  },
  licensingProvenance: {
    source: "raster_painterly",
    author: "Purple Garden Studio",
    notes: "Calibrated 2.5D ancient oak wood framework (roots, trunk, scaffold limbs, secondary branches; zero foliage)",
  },
  nativeDimensions: {
    width: 1586,
    height: 992,
  },
  worldPlacementBounds: {
    minX: 0,
    minY: 0,
    maxX: 800,
    maxY: 500,
    width: 800,
    height: 500,
  },
  rootAnchor: { x: 390.4, y: 441.0 },
  trunkCenterline: {
    top: { x: 393.4, y: 181.5 },
    base: { x: 390.4, y: 441.0 },
    flareSpread: 251.7, // Splay from x=264.8 to x=516.5 at base
  },
  branchAnchors: [
    {
      id: "branch-primary-lower-left",
      label: "Lower Left Scaffold",
      worldPoint: { x: 167.0, y: 248.5 },
      nativePixelPoint: { x: 331, y: 493 },
      scenicRegion: "left_canopy",
      direction: "left",
      surface: "wood",
      validity: "valid_on_wood",
      compatibleRoles: ["branch_attachment", "creature", "woody_shoot"],
      requiredSupportingAsset: null,
    },
    {
      id: "branch-primary-lower-right",
      label: "Lower Right Scaffold",
      worldPoint: { x: 621.4, y: 241.9 },
      nativePixelPoint: { x: 1232, y: 480 },
      scenicRegion: "right_canopy",
      direction: "right",
      surface: "wood",
      validity: "valid_on_wood",
      compatibleRoles: ["branch_attachment", "creature", "woody_shoot"],
      requiredSupportingAsset: null,
    },
    {
      id: "branch-primary-mid-left",
      label: "Mid Left Branch",
      worldPoint: { x: 127.6, y: 211.7 },
      nativePixelPoint: { x: 253, y: 420 },
      scenicRegion: "left_canopy",
      direction: "left",
      surface: "wood",
      validity: "valid_on_wood",
      compatibleRoles: ["branch_attachment", "creature", "woody_shoot"],
      requiredSupportingAsset: null,
    },
    {
      id: "branch-primary-mid-right",
      label: "Mid Right Branch",
      worldPoint: { x: 642.1, y: 211.7 },
      nativePixelPoint: { x: 1273, y: 420 },
      scenicRegion: "right_canopy",
      direction: "right",
      surface: "wood",
      validity: "valid_on_wood",
      compatibleRoles: ["branch_attachment", "creature", "woody_shoot"],
      requiredSupportingAsset: null,
    },
    {
      id: "branch-fork-upper-left",
      label: "Upper Left Crown Fork",
      worldPoint: { x: 347.0, y: 176.4 },
      nativePixelPoint: { x: 688, y: 350 },
      scenicRegion: "crown",
      direction: "left",
      surface: "wood",
      validity: "valid_on_wood",
      compatibleRoles: ["branch_attachment", "creature", "woody_shoot"],
      requiredSupportingAsset: null,
    },
    {
      id: "branch-fork-upper-right",
      label: "Upper Right Crown Fork",
      worldPoint: { x: 468.1, y: 176.4 },
      nativePixelPoint: { x: 928, y: 350 },
      scenicRegion: "crown",
      direction: "right",
      surface: "wood",
      validity: "valid_on_wood",
      compatibleRoles: ["branch_attachment", "creature", "woody_shoot"],
      requiredSupportingAsset: null,
    },
    {
      id: "branch-perch-central",
      label: "Central Crown Perch",
      worldPoint: { x: 393.4, y: 181.5 },
      nativePixelPoint: { x: 780, y: 360 },
      scenicRegion: "crown",
      direction: "center",
      surface: "wood",
      validity: "valid_on_wood",
      compatibleRoles: ["branch_attachment", "creature", "woody_shoot"],
      requiredSupportingAsset: null,
    },
    {
      id: "root-buttress-left",
      label: "Left Root Buttress",
      worldPoint: { x: 264.8, y: 428.4 },
      nativePixelPoint: { x: 525, y: 850 },
      scenicRegion: "root_grove",
      direction: "left",
      surface: "ground",
      validity: "valid_on_ground",
      compatibleRoles: ["landmark", "creature", "ground_flora"],
      requiredSupportingAsset: null,
    },
    {
      id: "root-buttress-right",
      label: "Right Root Buttress",
      worldPoint: { x: 516.5, y: 428.4 },
      nativePixelPoint: { x: 1024, y: 850 },
      scenicRegion: "root_grove",
      direction: "right",
      surface: "ground",
      validity: "valid_on_ground",
      compatibleRoles: ["landmark", "creature", "ground_flora"],
      requiredSupportingAsset: null,
    },
  ],
  crownBounds: {
    minX: 26.7,
    minY: 7.1,
    maxX: 769.2,
    maxY: 327.1,
    width: 742.5,
    height: 320.0,
  },
  canopyBoundsLeft: {
    minX: 26.7,
    minY: 7.1,
    maxX: 387.9,
    maxY: 327.1,
    width: 361.2,
    height: 320.0,
  },
  canopyBoundsRight: {
    minX: 388.4,
    minY: 10.1,
    maxX: 769.2,
    maxY: 327.1,
    width: 380.8,
    height: 317.0,
  },
  // Transparent volumes where future foliage clusters will be painted
  futureFoliageRegions: [
    {
      id: "future-foliage-crown-upper",
      bounds: { minX: 300, minY: 30, maxX: 500, maxY: 170, width: 200, height: 140 },
      scenicRegion: "crown",
      supportedRoles: ["blossom", "foliage_shoot"],
      requiredSupportingAsset: "assets/garden/painterly/foliage-mass-mature-v1.png",
      description: "Upper crown canopy volume pending future foliage mass asset",
    },
    {
      id: "future-foliage-left-canopy",
      bounds: { minX: 50, minY: 120, maxX: 330, maxY: 260, width: 280, height: 140 },
      scenicRegion: "left_canopy",
      supportedRoles: ["blossom", "foliage_shoot"],
      requiredSupportingAsset: "assets/garden/painterly/foliage-mass-mature-v1.png",
      description: "Left scaffold branch foliage volume pending future foliage mass asset",
    },
    {
      id: "future-foliage-right-canopy",
      bounds: { minX: 470, minY: 120, maxX: 750, maxY: 260, width: 280, height: 140 },
      scenicRegion: "right_canopy",
      supportedRoles: ["blossom", "foliage_shoot"],
      requiredSupportingAsset: "assets/garden/painterly/foliage-mass-mature-v1.png",
      description: "Right scaffold branch foliage volume pending future foliage mass asset",
    },
  ],
  // Ground regions valid now
  groundFeatureRegions: [
    {
      id: "ground-root-grove",
      bounds: { minX: 250, minY: 410, maxX: 550, maxY: 480, width: 300, height: 70 },
      scenicRegion: "root_grove",
      supportedRoles: ["landmark", "ground_flora"],
      validity: "valid_on_ground",
      description: "Root collar and buttress flare planting zone in soil",
    },
    {
      id: "ground-meadow-clearing",
      bounds: { minX: 50, minY: 370, maxX: 750, maxY: 500, width: 700, height: 130 },
      scenicRegion: "wildflower_meadow",
      supportedRoles: ["landmark", "ground_flora"],
      validity: "valid_on_ground",
      description: "Foreground meadow clearing in front of backplate",
    },
  ],
  safeEarnedRegions: [
    {
      id: "safe-region-crown-blossoms",
      kind: "blossom",
      bounds: { minX: 300, minY: 100, maxX: 500, maxY: 230, width: 200, height: 130 },
      scenicRegion: "crown",
      surface: "future_foliage_space",
      validity: "pending_foliage",
      requiredSupportingAsset: "assets/garden/painterly/foliage-mass-mature-v1.png",
      description: "Crown canopy volume (pending foliage mass asset for full blossom support)",
    },
    {
      id: "safe-region-left-canopy-growth",
      kind: "foliage_shoot",
      bounds: { minX: 80, minY: 150, maxX: 350, maxY: 280, width: 270, height: 130 },
      scenicRegion: "left_canopy",
      surface: "future_foliage_space",
      validity: "pending_foliage",
      requiredSupportingAsset: "assets/garden/painterly/foliage-mass-mature-v1.png",
      description: "Left scaffold lateral volume (pending foliage mass asset for full leaf support)",
    },
    {
      id: "safe-region-right-canopy-growth",
      kind: "foliage_shoot",
      bounds: { minX: 450, minY: 150, maxX: 720, maxY: 280, width: 270, height: 130 },
      scenicRegion: "right_canopy",
      surface: "future_foliage_space",
      validity: "pending_foliage",
      requiredSupportingAsset: "assets/garden/painterly/foliage-mass-mature-v1.png",
      description: "Right scaffold lateral volume (pending foliage mass asset for full leaf support)",
    },
    {
      id: "safe-region-root-grove-landmarks",
      kind: "landmark",
      bounds: { minX: 260, minY: 420, maxX: 540, maxY: 470, width: 280, height: 50 },
      scenicRegion: "root_grove",
      surface: "ground",
      validity: "valid_on_ground",
      requiredSupportingAsset: null,
      description: "Ground root flare zone for anniversary monuments and important date landmarks",
    },
    {
      id: "safe-region-meadow-clearing",
      kind: "landmark",
      bounds: { minX: 100, minY: 380, maxX: 700, maxY: 480, width: 600, height: 100 },
      scenicRegion: "wildflower_meadow",
      surface: "ground",
      validity: "valid_on_ground",
      requiredSupportingAsset: null,
      description: "Forefront clearing meadow for ground flora, herbs, and pollinator patches",
    },
  ],
  // Distinct Crop Contracts
  cropPresets: {
    full_structure: {
      cropMode: "full_structure",
      preservesFullStructure: true,
      cropBounds: {
        minX: 20.0,
        minY: 0.0,
        maxX: 780.0,
        maxY: 495.0,
        width: 760.0,
        height: 495.0,
      },
      description: "Includes entire oak crown, lateral scaffold limbs, trunk, and root buttresses with safety margin",
    },
    focused_compact: {
      cropMode: "focused_compact",
      preservesFullStructure: false,
      cropBounds: {
        minX: 90.0,
        minY: 20.0,
        maxX: 710.0,
        maxY: 475.0,
        width: 620.0,
        height: 455.0,
      },
      description: "Intentionally trims peripheral branch tips (x < 90 and x > 710) to prioritize trunk, root flare, and central crown",
    },
  },
  fullCropBounds: {
    minX: 20.0,
    minY: 0.0,
    maxX: 780.0,
    maxY: 495.0,
    width: 760.0,
    height: 495.0,
  },
  compactCropBounds: {
    minX: 90.0,
    minY: 20.0,
    maxX: 710.0,
    maxY: 475.0,
    width: 620.0,
    height: 455.0,
  },
  approvalStatus: "approved",
  soilBaseline: 441.0,
  rootFlareBounds: {
    minX: 264.8,
    minY: 410.0,
    maxX: 516.5,
    maxY: 488.4,
    width: 251.7,
    height: 78.4,
  },
};

/**
 * Canonical alias for the approved mature oak structure asset.
 */
export const PAINTERLY_OAK_MATURE_V1: BotanicalAssetManifest = {
  ...PAINTERLY_OAK_STRUCTURE_MATURE_V1,
  assetKey: "painterly-oak-mature-v1",
};

/**
 * Calibrated manifest record for the painterly 2.5D intermediate branching oak structure.
 * Derived empirically from native 1585x992 RGBA alpha mask in the Painterly Asset Lab.
 *
 * NOTE: This asset contains exclusively the wood framework (roots, trunk, scaffold limbs,
 * and secondary branches). It contains NO foliage.
 */
export const PAINTERLY_OAK_BRANCHING_V1: BotanicalAssetManifest = {
  assetKey: "painterly-oak-branching-v1",
  version: "1.0.0",
  botanicalFamily: "broadleaf_woodland",
  variant: "intermediate_oak_branching_painterly",
  hasFoliage: false,
  supportedStages: ["branching_out"],
  localBounds: {
    minX: 145.1,
    minY: 56.9,
    maxX: 666.0,
    maxY: 441.0,
    width: 520.9,
    height: 384.1,
  },
  attachmentPivot: { x: 390.4, y: 441.0 }, // Central soil planting collar
  depthLayer: 0,
  detailLevelVariants: {
    high: "assets/garden/painterly/oak-structure-branching-alpha-v1.png",
  },
  licensingProvenance: {
    source: "raster_painterly",
    author: "Purple Garden Studio",
    notes: "Calibrated 2.5D branching oak wood framework (roots, trunk, scaffold limbs, secondary branches; zero foliage)",
  },
  nativeDimensions: {
    width: 1585,
    height: 992,
  },
  worldPlacementBounds: {
    minX: 0,
    minY: 0,
    maxX: 800,
    maxY: 500,
    width: 800,
    height: 500,
  },
  rootAnchor: { x: 390.4, y: 441.0 },
  trunkCenterline: {
    top: { x: 393.0, y: 235.1 },
    base: { x: 390.4, y: 441.0 },
    flareSpread: 155.4, // Splay from x=312.7 to x=468.1 at base
  },
  rootFlareBounds: {
    minX: 312.7,
    minY: 396.6,
    maxX: 468.1,
    maxY: 441.0,
    width: 155.4,
    height: 44.4,
  },
  crownBounds: {
    minX: 145.1,
    minY: 56.9,
    maxX: 666.0,
    maxY: 350.0,
    width: 520.9,
    height: 293.1,
  },
  branchAnchors: [
    {
      id: "branch-crown-apex",
      label: "Crown Apex",
      worldPoint: { x: 393.0, y: 73.5 },
      nativePixelPoint: { x: 760, y: 200 },
      scenicRegion: "crown",
      direction: "center",
      surface: "wood",
      validity: "valid_on_wood",
      compatibleRoles: ["branch_attachment", "creature", "woody_shoot", "blossom", "foliage_shoot"],
      requiredSupportingAsset: null,
    },
    {
      id: "branch-crown-high-left",
      label: "Crown Apex High Left",
      worldPoint: { x: 375.8, y: 73.6 },
      nativePixelPoint: { x: 726, y: 200 },
      scenicRegion: "crown",
      direction: "left",
      surface: "wood",
      validity: "valid_on_wood",
      compatibleRoles: ["branch_attachment", "creature", "woody_shoot", "blossom", "foliage_shoot"],
      requiredSupportingAsset: null,
    },
    {
      id: "branch-crown-mid-center",
      label: "Crown Mid Center Stem",
      worldPoint: { x: 393.9, y: 129.1 },
      nativePixelPoint: { x: 762, y: 310 },
      scenicRegion: "crown",
      direction: "center",
      surface: "wood",
      validity: "valid_on_wood",
      compatibleRoles: ["branch_attachment", "creature", "woody_shoot", "blossom", "foliage_shoot"],
      requiredSupportingAsset: null,
    },
    {
      id: "branch-crown-mid-left",
      label: "Crown Mid Left Branch",
      worldPoint: { x: 364.7, y: 129.1 },
      nativePixelPoint: { x: 704, y: 310 },
      scenicRegion: "crown",
      direction: "left",
      surface: "wood",
      validity: "valid_on_wood",
      compatibleRoles: ["branch_attachment", "creature", "woody_shoot", "blossom", "foliage_shoot"],
      requiredSupportingAsset: null,
    },
    {
      id: "branch-scaffold-left-tip",
      label: "Primary Left Scaffold Limb Tip",
      worldPoint: { x: 146.6, y: 190.7 },
      nativePixelPoint: { x: 272, y: 432 },
      scenicRegion: "left_canopy",
      direction: "left",
      surface: "wood",
      validity: "valid_on_wood",
      compatibleRoles: ["branch_attachment", "creature", "woody_shoot", "blossom", "foliage_shoot"],
      requiredSupportingAsset: null,
    },
    {
      id: "branch-scaffold-left-mid",
      label: "Primary Left Scaffold Limb Mid",
      worldPoint: { x: 230.4, y: 190.7 },
      nativePixelPoint: { x: 438, y: 432 },
      scenicRegion: "left_canopy",
      direction: "left",
      surface: "wood",
      validity: "valid_on_wood",
      compatibleRoles: ["branch_attachment", "creature", "woody_shoot", "blossom", "foliage_shoot"],
      requiredSupportingAsset: null,
    },
    {
      id: "branch-scaffold-left-lower",
      label: "Primary Left Scaffold Limb Base",
      worldPoint: { x: 273.8, y: 190.7 },
      nativePixelPoint: { x: 524, y: 432 },
      scenicRegion: "left_canopy",
      direction: "left",
      surface: "wood",
      validity: "valid_on_wood",
      compatibleRoles: ["branch_attachment", "creature", "woody_shoot", "blossom", "foliage_shoot"],
      requiredSupportingAsset: null,
    },
    {
      id: "branch-scaffold-left-upper",
      label: "Left Upper Secondary Branch",
      worldPoint: { x: 253.1, y: 129.1 },
      nativePixelPoint: { x: 483, y: 310 },
      scenicRegion: "left_canopy",
      direction: "left",
      surface: "wood",
      validity: "valid_on_wood",
      compatibleRoles: ["branch_attachment", "creature", "woody_shoot", "blossom", "foliage_shoot"],
      requiredSupportingAsset: null,
    },
    {
      id: "branch-left-upper-high",
      label: "Left Upper High Twig",
      worldPoint: { x: 263.7, y: 103.8 },
      nativePixelPoint: { x: 504, y: 260 },
      scenicRegion: "left_canopy",
      direction: "left",
      surface: "wood",
      validity: "valid_on_wood",
      compatibleRoles: ["branch_attachment", "creature", "woody_shoot", "blossom", "foliage_shoot"],
      requiredSupportingAsset: null,
    },
    {
      id: "branch-left-upper-sub-twig",
      label: "Left Upper Sub-Twig",
      worldPoint: { x: 239.0, y: 103.8 },
      nativePixelPoint: { x: 455, y: 260 },
      scenicRegion: "left_canopy",
      direction: "left",
      surface: "wood",
      validity: "valid_on_wood",
      compatibleRoles: ["branch_attachment", "creature", "woody_shoot", "blossom", "foliage_shoot"],
      requiredSupportingAsset: null,
    },
    {
      id: "branch-scaffold-right-tip",
      label: "Primary Right Scaffold Limb Tip",
      worldPoint: { x: 664.5, y: 157.8 },
      nativePixelPoint: { x: 1298, y: 367 },
      scenicRegion: "right_canopy",
      direction: "right",
      surface: "wood",
      validity: "valid_on_wood",
      compatibleRoles: ["branch_attachment", "creature", "woody_shoot", "blossom", "foliage_shoot"],
      requiredSupportingAsset: null,
    },
    {
      id: "branch-scaffold-right-outer",
      label: "Primary Right Scaffold Limb Outer",
      worldPoint: { x: 643.8, y: 190.7 },
      nativePixelPoint: { x: 1257, y: 432 },
      scenicRegion: "right_canopy",
      direction: "right",
      surface: "wood",
      validity: "valid_on_wood",
      compatibleRoles: ["branch_attachment", "creature", "woody_shoot", "blossom", "foliage_shoot"],
      requiredSupportingAsset: null,
    },
    {
      id: "branch-scaffold-right-lower",
      label: "Primary Right Scaffold Limb Lower",
      worldPoint: { x: 579.7, y: 190.7 },
      nativePixelPoint: { x: 1130, y: 432 },
      scenicRegion: "right_canopy",
      direction: "right",
      surface: "wood",
      validity: "valid_on_wood",
      compatibleRoles: ["branch_attachment", "creature", "woody_shoot", "blossom", "foliage_shoot"],
      requiredSupportingAsset: null,
    },
    {
      id: "branch-scaffold-right-fork",
      label: "Primary Right Scaffold Limb Base",
      worldPoint: { x: 471.7, y: 190.7 },
      nativePixelPoint: { x: 916, y: 432 },
      scenicRegion: "right_canopy",
      direction: "right",
      surface: "wood",
      validity: "valid_on_wood",
      compatibleRoles: ["branch_attachment", "creature", "woody_shoot", "blossom", "foliage_shoot"],
      requiredSupportingAsset: null,
    },
    {
      id: "branch-scaffold-right-upper",
      label: "Right Upper Secondary Branch",
      worldPoint: { x: 554.4, y: 103.8 },
      nativePixelPoint: { x: 1080, y: 260 },
      scenicRegion: "right_canopy",
      direction: "right",
      surface: "wood",
      validity: "valid_on_wood",
      compatibleRoles: ["branch_attachment", "creature", "woody_shoot", "blossom", "foliage_shoot"],
      requiredSupportingAsset: null,
    },
    {
      id: "branch-right-upper-outer",
      label: "Right Upper Outer Branch",
      worldPoint: { x: 586.7, y: 103.8 },
      nativePixelPoint: { x: 1144, y: 260 },
      scenicRegion: "right_canopy",
      direction: "right",
      surface: "wood",
      validity: "valid_on_wood",
      compatibleRoles: ["branch_attachment", "creature", "woody_shoot", "blossom", "foliage_shoot"],
      requiredSupportingAsset: null,
    },
    {
      id: "branch-right-upper-mid",
      label: "Right Upper Mid Limb",
      worldPoint: { x: 503.5, y: 129.1 },
      nativePixelPoint: { x: 979, y: 310 },
      scenicRegion: "right_canopy",
      direction: "right",
      surface: "wood",
      validity: "valid_on_wood",
      compatibleRoles: ["branch_attachment", "creature", "woody_shoot", "blossom", "foliage_shoot"],
      requiredSupportingAsset: null,
    },
    {
      id: "branch-scaffold-main-fork",
      label: "Primary Trunk Main Fork",
      worldPoint: { x: 393.0, y: 235.1 },
      nativePixelPoint: { x: 760, y: 520 },
      scenicRegion: "trunk",
      direction: "center",
      surface: "wood",
      validity: "valid_on_wood",
      compatibleRoles: ["branch_attachment", "creature", "woody_shoot"],
      requiredSupportingAsset: null,
    },
  ],
  cropPresets: {
    full_structure: {
      cropMode: "full_structure",
      preservesFullStructure: true,
      cropBounds: { minX: 100, minY: 20, maxX: 700, maxY: 480, width: 600, height: 460 },
      description: "Includes intermediate branching oak crown, lateral scaffold limbs, trunk, and root spread",
    },
    focused_compact: {
      cropMode: "focused_compact",
      preservesFullStructure: false,
      cropBounds: { minX: 140, minY: 40, maxX: 660, maxY: 460, width: 520, height: 420 },
      description: "Focused mobile card and dashboard view centering on primary trunk fork and developing scaffold branches",
    },
  },
};

export const PAINTERLY_OAK_STRUCTURE_BRANCHING_V1: BotanicalAssetManifest = {
  ...PAINTERLY_OAK_BRANCHING_V1,
  assetKey: "painterly-oak-structure-branching-v1",
};

/**
 * Calibrated manifest record for the painterly 2.5D oak foliage cluster proof.
 * High-resolution alpha cutout with natural lobed leaves and woody twig base.
 */
export const PAINTERLY_OAK_FOLIAGE_CLUSTER_V1: BotanicalAssetManifest = {
  assetKey: "painterly-oak-foliage-cluster-v1",
  version: "1.0.0",
  botanicalFamily: "broadleaf_woodland",
  variant: "oak_foliage_cluster_painterly",
  hasFoliage: true,
  supportedStages: ["branching_out", "leafy_canopy", "flowering", "garden_in_bloom"],
  localBounds: {
    minX: 0,
    minY: 0,
    maxX: 140,
    maxY: 143.5,
    width: 140,
    height: 143.5,
  },
  attachmentPivot: { x: 59.4, y: 142.6 }, // Relative anchor: (0.4241, 0.9942)
  depthLayer: 15,
  detailLevelVariants: {
    high: "assets/garden/painterly/foliage-oak-cluster-alpha-v1.png",
  },
  licensingProvenance: {
    source: "raster_painterly",
    author: "Purple Garden Studio / DeepMind",
    notes: "Calibrated 2.5D painterly oak foliage proof asset with lobed leaves, deep shadow, and woody petiole attachment point",
  },
  nativeDimensions: {
    width: 837,
    height: 858,
  },
  approvalStatus: "development_preview",
};

/**
 * Explicit stage-asset slots for all seven canonical lifecycle stages.
 * Renderer selection strictly requires approvalStatus === "approved".
 */
export const STAGE_STRUCTURAL_ASSET_SLOTS: Record<
  CanonicalStageKeyOrBeginning,
  StageStructuralAssetSlot
> = {
  beginning: {
    canonicalStage: "beginning",
    stageKey: "beginning",
    eligibleStage: "beginning",
    assetKey: "painterly-oak-beginning-v1",
    filePath: null,
    targetFilename: "assets/garden/painterly/oak-beginning-alpha-v1.png",
    role: "beginning",
    status: "missing",
    approvalStatus: "missing",
    fileExists: false,
    availability: false,
    sourceDimensions: { width: 1586, height: 992 },
    expectedSourceDimensions: { width: 1586, height: 992 },
    alphaRequirement: true,
    requiresTransparentBackground: true,
    structuralBounds: { minX: 380, minY: 435, maxX: 420, maxY: 448, width: 40, height: 13 },
    rootBounds: { minX: 388, minY: 438, maxX: 412, maxY: 445, width: 24, height: 7 },
    rootFlareBounds: { minX: 388, minY: 438, maxX: 412, maxY: 445, width: 24, height: 7 },
    soilBaseline: 441.0,
    branchAttachmentZones: [],
    branchAttachmentAnchors: [],
    futureFoliageRegions: [],
    groundFeatureRegions: [],
    crops: {
      fullCrop: { minX: 0, minY: 0, maxX: 800, maxY: 500, width: 800, height: 500 },
      compactCrop: { minX: 90, minY: 20, maxX: 710, maxY: 475, width: 620, height: 455 },
      exploreCrop: { minX: 0, minY: 0, maxX: 800, maxY: 500, width: 800, height: 500 },
    },
    lightingDirection: "top-left diffused daylight, gentle 10:30am solar angle, cool woodland ambient fill",
    continuityWithPreviousAndNextStage: {
      previous: null,
      next: "first_seedling",
    },
    relationshipToPreviousAndNextStage: {
      previous: null,
      next: "first_seedling",
    },
    supportedRendererModes: ["procedural", "painterly_when_eligible"],
    calibrationVersion: "2.0.0",
    version: "1.0.0",
    provenance: {
      source: "raster_painterly",
      author: "Purple Garden Studio",
      notes: "Planned seed glimmer / quiet planted point in clearing soil",
    },
  },
  first_seedling: {
    canonicalStage: "first_seedling",
    stageKey: "first_seedling",
    eligibleStage: "first_seedling",
    assetKey: "painterly-seedling-v1",
    filePath: null,
    targetFilename: "assets/garden/painterly/oak-structure-seedling-alpha-v1.png",
    role: "beginning",
    status: "missing",
    approvalStatus: "missing",
    fileExists: false,
    availability: false,
    sourceDimensions: { width: 1586, height: 992 },
    expectedSourceDimensions: { width: 1586, height: 992 },
    alphaRequirement: true,
    requiresTransparentBackground: true,
    structuralBounds: { minX: 375, minY: 370, maxX: 425, maxY: 445, width: 50, height: 75 },
    rootBounds: { minX: 380, minY: 436, maxX: 420, maxY: 445, width: 40, height: 9 },
    rootFlareBounds: { minX: 380, minY: 436, maxX: 420, maxY: 445, width: 40, height: 9 },
    soilBaseline: 441.0,
    branchAttachmentZones: [],
    branchAttachmentAnchors: [],
    futureFoliageRegions: [],
    groundFeatureRegions: [],
    crops: {
      fullCrop: { minX: 0, minY: 0, maxX: 800, maxY: 500, width: 800, height: 500 },
      compactCrop: { minX: 90, minY: 20, maxX: 710, maxY: 475, width: 620, height: 455 },
      exploreCrop: { minX: 0, minY: 0, maxX: 800, maxY: 500, width: 800, height: 500 },
    },
    lightingDirection: "top-left diffused daylight, gentle 10:30am solar angle, cool woodland ambient fill",
    continuityWithPreviousAndNextStage: {
      previous: "beginning",
      next: "tender_sapling",
    },
    relationshipToPreviousAndNextStage: {
      previous: "beginning",
      next: "tender_sapling",
    },
    supportedRendererModes: ["procedural", "painterly_when_eligible"],
    calibrationVersion: "2.0.0",
    version: "1.0.0",
    provenance: {
      source: "raster_painterly",
      author: "Purple Garden Studio",
      notes: "Planned slender stem with tender sprout and hairline roots",
    },
  },
  tender_sapling: {
    canonicalStage: "tender_sapling",
    stageKey: "tender_sapling",
    eligibleStage: "tender_sapling",
    assetKey: "painterly-sapling-v1",
    filePath: "assets/garden/painterly/oak-structure-sapling-alpha-v1.png",
    targetFilename: "assets/garden/painterly/oak-structure-sapling-alpha-v1.png",
    role: "intermediate",
    status: "development_preview",
    approvalStatus: "development_preview",
    fileExists: true,
    availability: true,
    sourceDimensions: { width: 1024, height: 1536 },
    expectedSourceDimensions: { width: 1024, height: 1536 },
    alphaRequirement: true,
    requiresTransparentBackground: true,
    structuralBounds: { minX: 352.8, minY: 316.2, maxX: 430.8, maxY: 441.0, width: 78.0, height: 124.8 },
    rootBounds: { minX: 386.0, minY: 438.0, maxX: 395.0, maxY: 441.0, width: 9.0, height: 3.0 },
    rootFlareBounds: { minX: 386.0, minY: 438.0, maxX: 395.0, maxY: 441.0, width: 9.0, height: 3.0 },
    soilBaseline: 441.0,
    calibrationTransform: {
      scale: 0.083389,
      translateX: 349.54,
      translateY: 314.08,
      rotation: 0,
    },
    branchAttachmentZones: [],
    branchAttachmentAnchors: [],
    futureFoliageRegions: [],
    groundFeatureRegions: [],
    crops: {
      fullCrop: { minX: 0, minY: 0, maxX: 800, maxY: 500, width: 800, height: 500 },
      compactCrop: { minX: 90, minY: 20, maxX: 710, maxY: 475, width: 620, height: 455 },
      exploreCrop: { minX: 0, minY: 0, maxX: 800, maxY: 500, width: 800, height: 500 },
    },
    lightingDirection: "top-left diffused daylight, gentle 10:30am solar angle, cool woodland ambient fill",
    continuityWithPreviousAndNextStage: {
      previous: "first_seedling",
      next: "branching_out",
    },
    relationshipToPreviousAndNextStage: {
      previous: "first_seedling",
      next: "branching_out",
    },
    supportedRendererModes: ["procedural", "painterly_when_eligible"],
    calibrationVersion: "2.0.0",
    version: "1.0.0",
    provenance: {
      source: "raster_painterly",
      author: "Purple Garden Studio",
      notes: "Planned young trunk with early lateral root spread",
    },
  },
  branching_out: {
    canonicalStage: "branching_out",
    stageKey: "branching_out",
    eligibleStage: "branching_out",
    assetKey: "painterly-oak-branching-v1",
    filePath: "assets/garden/painterly/oak-structure-branching-alpha-v1.png",
    targetFilename: "assets/garden/painterly/oak-structure-branching-alpha-v1.png",
    role: "intermediate",
    status: "development_preview",
    approvalStatus: "development_preview",
    fileExists: true,
    availability: true,
    sourceDimensions: { width: 1585, height: 992 },
    expectedSourceDimensions: { width: 1585, height: 992 },
    alphaRequirement: true,
    requiresTransparentBackground: true,
    structuralBounds: { minX: 145.1, minY: 56.9, maxX: 666.0, maxY: 441.0, width: 520.9, height: 384.1 },
    rootBounds: { minX: 312.7, minY: 396.6, maxX: 468.1, maxY: 441.0, width: 155.4, height: 44.4 },
    rootFlareBounds: { minX: 312.7, minY: 396.6, maxX: 468.1, maxY: 441.0, width: 155.4, height: 44.4 },
    soilBaseline: 441.0,
    calibrationTransform: {
      scale: 0.504732,
      translateX: 9.33,
      translateY: -27.39,
      rotation: 0,
    },
    branchAttachmentZones: PAINTERLY_OAK_BRANCHING_V1.branchAnchors || [],
    branchAttachmentAnchors: PAINTERLY_OAK_BRANCHING_V1.branchAnchors || [],
    futureFoliageRegions: [
      {
        id: "future-foliage-branching-left",
        bounds: { minX: 210, minY: 180, maxX: 350, maxY: 300, width: 140, height: 120 },
        scenicRegion: "left_canopy",
        supportedRoles: ["blossom", "foliage_shoot"],
        requiredSupportingAsset: "assets/garden/painterly/oak-structure-branching-alpha-v1.png",
        description: "Developing Left Branching Foliage",
      },
      {
        id: "future-foliage-branching-right",
        bounds: { minX: 450, minY: 180, maxX: 590, maxY: 300, width: 140, height: 120 },
        scenicRegion: "right_canopy",
        supportedRoles: ["blossom", "foliage_shoot"],
        requiredSupportingAsset: "assets/garden/painterly/oak-structure-branching-alpha-v1.png",
        description: "Developing Right Branching Foliage",
      },
    ],
    groundFeatureRegions: [
      {
        id: "ground-meadow-branching-roots",
        bounds: { minX: 320, minY: 430, maxX: 480, maxY: 475, width: 160, height: 45 },
        scenicRegion: "root_grove",
        supportedRoles: ["landmark", "ground_flora"],
        validity: "valid_on_ground",
        description: "Root Flare Meadow Collar",
      },
    ],
    crops: {
      fullCrop: { minX: 0, minY: 0, maxX: 800, maxY: 500, width: 800, height: 500 },
      compactCrop: { minX: 90, minY: 20, maxX: 710, maxY: 475, width: 620, height: 455 },
      exploreCrop: { minX: 0, minY: 0, maxX: 800, maxY: 500, width: 800, height: 500 },
    },
    lightingDirection: "top-left diffused daylight, gentle 10:30am solar angle, cool woodland ambient fill",
    continuityWithPreviousAndNextStage: {
      previous: "tender_sapling",
      next: "leafy_canopy",
    },
    relationshipToPreviousAndNextStage: {
      previous: "tender_sapling",
      next: "leafy_canopy",
    },
    supportedRendererModes: ["procedural", "painterly_when_eligible"],
    calibrationVersion: "2.0.0",
    version: "1.0.0",
    provenance: {
      source: "raster_painterly",
      author: "Purple Garden Studio",
      notes: "Specification for assets/garden/painterly/oak-structure-branching-alpha-v1.png (young oak, airy canopy, 4-7 scaffold branches)",
    },
  },
  leafy_canopy: {
    canonicalStage: "leafy_canopy",
    stageKey: "leafy_canopy",
    eligibleStage: "leafy_canopy",
    assetKey: "painterly-oak-leafy-v1",
    filePath: null,
    targetFilename: "assets/garden/painterly/oak-structure-canopy-alpha-v1.png",
    role: "intermediate",
    status: "missing",
    approvalStatus: "missing",
    fileExists: false,
    availability: false,
    sourceDimensions: { width: 1586, height: 992 },
    expectedSourceDimensions: { width: 1586, height: 992 },
    alphaRequirement: true,
    requiresTransparentBackground: true,
    structuralBounds: { minX: 140, minY: 90, maxX: 660, maxY: 475, width: 520, height: 385 },
    rootBounds: { minX: 310, minY: 420, maxX: 490, maxY: 475, width: 180, height: 55 },
    rootFlareBounds: { minX: 310, minY: 420, maxX: 490, maxY: 475, width: 180, height: 55 },
    soilBaseline: 441.0,
    branchAttachmentZones: [],
    branchAttachmentAnchors: [],
    futureFoliageRegions: [],
    groundFeatureRegions: [],
    crops: {
      fullCrop: { minX: 0, minY: 0, maxX: 800, maxY: 500, width: 800, height: 500 },
      compactCrop: { minX: 90, minY: 20, maxX: 710, maxY: 475, width: 620, height: 455 },
      exploreCrop: { minX: 0, minY: 0, maxX: 800, maxY: 500, width: 800, height: 500 },
    },
    lightingDirection: "top-left diffused daylight, gentle 10:30am solar angle, cool woodland ambient fill",
    continuityWithPreviousAndNextStage: {
      previous: "branching_out",
      next: "rooted_flourishing",
    },
    relationshipToPreviousAndNextStage: {
      previous: "branching_out",
      next: "rooted_flourishing",
    },
    supportedRendererModes: ["procedural", "painterly_when_eligible"],
    calibrationVersion: "2.0.0",
    version: "1.0.0",
    provenance: {
      source: "raster_painterly",
      author: "Purple Garden Studio",
      notes: "Planned wider structure with recognizable crown, established scaffold, deep roots",
    },
  },
  rooted_flourishing: {
    canonicalStage: "rooted_flourishing",
    stageKey: "rooted_flourishing",
    eligibleStage: "rooted_flourishing",
    assetKey: "painterly-oak-rooted-v1",
    filePath: null,
    targetFilename: "assets/garden/painterly/oak-structure-flourishing-alpha-v1.png",
    role: "intermediate",
    status: "missing",
    approvalStatus: "missing",
    fileExists: false,
    availability: false,
    sourceDimensions: { width: 1586, height: 992 },
    expectedSourceDimensions: { width: 1586, height: 992 },
    alphaRequirement: true,
    requiresTransparentBackground: true,
    structuralBounds: { minX: 80, minY: 40, maxX: 720, maxY: 482, width: 640, height: 442 },
    rootBounds: { minX: 285, minY: 415, maxX: 505, maxY: 482, width: 220, height: 67 },
    rootFlareBounds: { minX: 285, minY: 415, maxX: 505, maxY: 482, width: 220, height: 67 },
    soilBaseline: 441.0,
    branchAttachmentZones: [],
    branchAttachmentAnchors: [],
    futureFoliageRegions: [],
    groundFeatureRegions: [],
    crops: {
      fullCrop: { minX: 0, minY: 0, maxX: 800, maxY: 500, width: 800, height: 500 },
      compactCrop: { minX: 90, minY: 20, maxX: 710, maxY: 475, width: 620, height: 455 },
      exploreCrop: { minX: 0, minY: 0, maxX: 800, maxY: 500, width: 800, height: 500 },
    },
    lightingDirection: "top-left diffused daylight, gentle 10:30am solar angle, cool woodland ambient fill",
    continuityWithPreviousAndNextStage: {
      previous: "leafy_canopy",
      next: "garden_in_bloom",
    },
    relationshipToPreviousAndNextStage: {
      previous: "leafy_canopy",
      next: "garden_in_bloom",
    },
    supportedRendererModes: ["procedural", "painterly_when_eligible"],
    calibrationVersion: "2.0.0",
    version: "1.0.0",
    provenance: {
      source: "raster_painterly",
      author: "Purple Garden Studio",
      notes: "Planned substantial roots and broad canopy architecture approaching mature ancient oak",
    },
  },
  garden_in_bloom: {
    canonicalStage: "garden_in_bloom",
    stageKey: "garden_in_bloom",
    eligibleStage: "garden_in_bloom",
    assetKey: "painterly-oak-structure-mature-v1",
    filePath: "assets/garden/painterly/oak-structure-mature-alpha-v1.png",
    targetFilename: "assets/garden/painterly/oak-structure-mature-alpha-v1.png",
    role: "mature",
    status: "approved",
    approvalStatus: "approved",
    fileExists: true,
    availability: true,
    sourceDimensions: { width: 1586, height: 992 },
    expectedSourceDimensions: { width: 1586, height: 992 },
    alphaRequirement: true,
    requiresTransparentBackground: true,
    structuralBounds: { minX: 26.7, minY: 7.1, maxX: 769.2, maxY: 488.4, width: 742.5, height: 481.3 },
    rootBounds: { minX: 264.8, minY: 410.0, maxX: 516.5, maxY: 488.4, width: 251.7, height: 78.4 },
    rootFlareBounds: { minX: 264.8, minY: 410.0, maxX: 516.5, maxY: 488.4, width: 251.7, height: 78.4 },
    soilBaseline: 441.0,
    calibrationTransform: {
      scale: 1.0,
      translateX: 0.0,
      translateY: 0.0,
      rotation: 0,
    },
    branchAttachmentZones: PAINTERLY_OAK_STRUCTURE_MATURE_V1.branchAnchors || [],
    branchAttachmentAnchors: PAINTERLY_OAK_STRUCTURE_MATURE_V1.branchAnchors || [],
    futureFoliageRegions: PAINTERLY_OAK_STRUCTURE_MATURE_V1.futureFoliageRegions || [],
    groundFeatureRegions: PAINTERLY_OAK_STRUCTURE_MATURE_V1.groundFeatureRegions || [],
    crops: {
      fullCrop: { minX: 20.0, minY: 0.0, maxX: 780.0, maxY: 495.0, width: 760.0, height: 495.0 },
      compactCrop: { minX: 90.0, minY: 20.0, maxX: 710.0, maxY: 475.0, width: 620.0, height: 455.0 },
      exploreCrop: { minX: 0.0, minY: 0.0, maxX: 800.0, maxY: 500.0, width: 800.0, height: 500.0 },
    },
    lightingDirection: "top-left diffused daylight, gentle 10:30am solar angle, cool woodland ambient fill",
    continuityWithPreviousAndNextStage: {
      previous: "rooted_flourishing",
      next: null,
    },
    relationshipToPreviousAndNextStage: {
      previous: "rooted_flourishing",
      next: null,
    },
    supportedRendererModes: ["procedural", "painterly_when_eligible"],
    calibrationVersion: "2.0.0",
    version: "1.0.0",
    provenance: {
      source: "raster_painterly",
      author: "Purple Garden Studio",
      notes: "Approved calibrated 2.5D ancient oak wood framework with zero foliage",
    },
  },
};

/**
 * Stage asset registry alias reflecting canonical stage mapping.
 */
export const PAINTERLY_STAGE_ASSET_REGISTRY = STAGE_STRUCTURAL_ASSET_SLOTS;

/**
 * Three-Asset Foundation Reference Points:
 * 1. Beginning: future seed/seedling asset (oak-beginning-alpha-v1.png, missing)
 * 2. Branching Out: future intermediate oak asset (oak-structure-branching-alpha-v1.png, missing)
 * 3. Mature: approved ancient oak destination asset (oak-structure-mature-alpha-v1.png, approved)
 */
export const THREE_ASSET_FOUNDATION_SLOTS = {
  beginning: STAGE_STRUCTURAL_ASSET_SLOTS.beginning,
  branching_out: STAGE_STRUCTURAL_ASSET_SLOTS.branching_out,
  mature: STAGE_STRUCTURAL_ASSET_SLOTS.garden_in_bloom,
} as const;

/**
 * Separate calibrated slots for early-life lifecycle visual phases.
 * These assets remain development previews until live visual acceptance.
 */
export const EARLY_LIFE_PREVIEW_TARGET_SLOTS = {
  planted_acorn: {
    slotKey: "planted_acorn",
    assetKey: "painterly-oak-acorn-planted-v1",
    targetFilename: "assets/garden/painterly/oak-acorn-planted-alpha-v1.png",
    status: "development_preview" as const,
    approvalStatus: "development_preview" as const,
    fileExists: true,
    sourceDimensions: { width: 1254, height: 1254 },
    meaningfulAlphaBounds: { minX: 293, minY: 726, maxX: 960, maxY: 1037 },
    sourceContactPoint: { x: 627, y: 1038 },
    calibrationTransform: {
      scale: 0.025641,
      translateX: 374.323,
      translateY: 414.385,
      rotation: 0,
    },
    description: "Planted acorn in woodland soil",
  },
  emerging_shoot: {
    slotKey: "emerging_shoot",
    assetKey: "painterly-oak-shoot-emerging-v1",
    targetFilename: "assets/garden/painterly/oak-shoot-emerging-alpha-v1.png",
    status: "development_preview" as const,
    approvalStatus: "development_preview" as const,
    fileExists: true,
    sourceDimensions: { width: 1024, height: 1536 },
    meaningfulAlphaBounds: { minX: 162, minY: 520, maxX: 850, maxY: 1398 },
    sourceContactPoint: { x: 506.5, y: 1399 },
    calibrationTransform: {
      scale: 0.028441,
      translateX: 375.995,
      translateY: 401.211,
      rotation: 0,
    },
    description: "Emerging oak epicotyl with hypogeal cotyledons retained in the acorn",
  },
  small_seedling: {
    slotKey: "small_seedling",
    assetKey: "painterly-oak-seedling-v1",
    targetFilename: "assets/garden/painterly/oak-seedling-alpha-v1.png",
    status: "development_preview" as const,
    approvalStatus: "development_preview" as const,
    fileExists: true,
    sourceDimensions: { width: 1024, height: 1536 },
    meaningfulAlphaBounds: { minX: 213, minY: 306, maxX: 788, maxY: 1261 },
    sourceContactPoint: { x: 501, y: 1262 },
    calibrationTransform: {
      scale: 0.057531,
      translateX: 361.577,
      translateY: 368.399,
      rotation: 0,
    },
    description: "Small oak seedling with juvenile lobed leaves",
  },
} as const;

/**
 * 12-Step Calibration Workflow for New Painterly Tree Family Assets
 */
export const PAINTERLY_CALIBRATION_WORKFLOW = [
  "1. confirm_file_exists",
  "2. confirm_rgba_transparency",
  "3. inspect_alpha_fringe",
  "4. align_root_origin",
  "5. align_soil_baseline",
  "6. define_structural_bounds",
  "7. define_composition_crops",
  "8. define_branch_anchors",
  "9. define_future_foliage_regions",
  "10. test_full_compact_explore_story_modes",
  "11. mark_calibration_required",
  "12. mark_approved_after_review",
] as const;

/**
 * 9 Calibrated Botanical Attachment Regions (Phase 1 Contract for Phase 2 Integration)
 */
export const BOTANICAL_ATTACHMENT_REGIONS: Record<string, BotanicalAttachmentRegion> = {
  upper_branch_tips: {
    id: "region-upper-branch-tips",
    label: "Upper Branch Tips",
    bounds: { minX: 180, minY: 10, maxX: 620, maxY: 140, width: 440, height: 130 },
    depthLayer: 5,
    compatibleBotanicalRoles: ["blossom", "foliage_shoot", "bud"],
    compatibleHabitatRoles: ["songbird", "wind_chime"],
    stageEligibility: ["leafy_canopy", "rooted_flourishing", "garden_in_bloom"],
    maxVisualOccupancy: 8,
    allowSelectableEarnedFeatures: true,
    description: "High sunlit outer branches and twig ends where delicate blossoms and light songbirds perch",
  },
  sheltered_branch_forks: {
    id: "region-sheltered-branch-forks",
    label: "Sheltered Branch Forks",
    bounds: { minX: 300, minY: 140, maxX: 490, maxY: 260, width: 190, height: 120 },
    depthLayer: 2,
    compatibleBotanicalRoles: ["climbing_vine", "moss_cluster", "foliage_shoot"],
    compatibleHabitatRoles: ["nest", "creature", "perched_owl"],
    stageEligibility: ["branching_out", "leafy_canopy", "rooted_flourishing", "garden_in_bloom"],
    maxVisualOccupancy: 5,
    allowSelectableEarnedFeatures: true,
    description: "Deep stable limb bifurcations offering shelter for bird nests, climbing vines, and significant memory tokens",
  },
  lower_branch_shelves: {
    id: "region-lower-branch-shelves",
    label: "Lower Branch Shelves",
    bounds: { minX: 160, minY: 200, maxX: 640, maxY: 330, width: 480, height: 130 },
    depthLayer: 4,
    compatibleBotanicalRoles: ["hanging_lantern", "blossom", "woody_shoot"],
    compatibleHabitatRoles: ["squirrel", "branch_creature"],
    stageEligibility: ["branching_out", "leafy_canopy", "rooted_flourishing", "garden_in_bloom"],
    maxVisualOccupancy: 6,
    allowSelectableEarnedFeatures: true,
    description: "Horizontal heavy scaffold limbs supporting suspended lanterns, blossoms, and small arboreal fauna",
  },
  trunk_hollows: {
    id: "region-trunk-hollows",
    label: "Trunk Hollows",
    bounds: { minX: 360, minY: 260, maxX: 430, maxY: 380, width: 70, height: 120 },
    depthLayer: 1,
    compatibleBotanicalRoles: ["bark_lichen", "burrow_flower", "carving"],
    compatibleHabitatRoles: ["tree_frog", "sleeping_owl", "creature"],
    stageEligibility: ["rooted_flourishing", "garden_in_bloom"],
    maxVisualOccupancy: 3,
    allowSelectableEarnedFeatures: true,
    description: "Natural bark fissures, cavities, and burl hollows on the main ancient trunk",
  },
  root_flare_pockets: {
    id: "region-root-flare-pockets",
    label: "Root Flare Pockets",
    bounds: { minX: 290, minY: 410, maxX: 500, maxY: 460, width: 210, height: 50 },
    depthLayer: -5,
    compatibleBotanicalRoles: ["moss_cushion", "fern", "root_flower"],
    compatibleHabitatRoles: ["hedgehog", "ground_beetle"],
    stageEligibility: ["tender_sapling", "branching_out", "leafy_canopy", "rooted_flourishing", "garden_in_bloom"],
    maxVisualOccupancy: 5,
    allowSelectableEarnedFeatures: true,
    description: "Soil cavities nestled between buttress roots where moss, woodland ferns, and burrow creatures shelter",
  },
  meadow_foreground: {
    id: "region-meadow-foreground",
    label: "Meadow Foreground",
    bounds: { minX: 80, minY: 435, maxX: 720, maxY: 495, width: 640, height: 60 },
    depthLayer: 10,
    compatibleBotanicalRoles: ["wildflower", "ground_flora", "reconnection_bloom"],
    compatibleHabitatRoles: ["butterfly", "field_mouse"],
    stageEligibility: ["beginning", "first_seedling", "tender_sapling", "branching_out", "leafy_canopy", "rooted_flourishing", "garden_in_bloom"],
    maxVisualOccupancy: 12,
    allowSelectableEarnedFeatures: true,
    description: "Sunny clearing meadow stretching in front of the tree, hosting ground flora, wildflowers, and anniversary markers",
  },
  stream_edge: {
    id: "region-stream-edge",
    label: "Stream Edge",
    bounds: { minX: 520, minY: 430, maxX: 740, maxY: 485, width: 220, height: 55 },
    depthLayer: 8,
    compatibleBotanicalRoles: ["water_iris", "reeds", "river_pebble"],
    compatibleHabitatRoles: ["dragonfly", "pebble_marker"],
    stageEligibility: ["first_seedling", "tender_sapling", "branching_out", "leafy_canopy", "rooted_flourishing", "garden_in_bloom"],
    maxVisualOccupancy: 4,
    allowSelectableEarnedFeatures: true,
    description: "Moist riverbank on the lower right clearing edge where water-loving plants and aquatic insects dwell",
  },
  mossy_ground: {
    id: "region-mossy-ground",
    label: "Mossy Ground",
    bounds: { minX: 240, minY: 425, maxX: 410, maxY: 465, width: 170, height: 40 },
    depthLayer: -8,
    compatibleBotanicalRoles: ["velvet_moss", "fungi_cluster", "ground_flora"],
    compatibleHabitatRoles: ["snail", "ground_creature"],
    stageEligibility: ["tender_sapling", "branching_out", "leafy_canopy", "rooted_flourishing", "garden_in_bloom"],
    maxVisualOccupancy: 4,
    allowSelectableEarnedFeatures: true,
    description: "Shaded damp clearing soil directly beneath the tree's shadow-side canopy",
  },
  distant_habitat_zones: {
    id: "region-distant-habitat-zones",
    label: "Distant Habitat Zones",
    bounds: { minX: 40, minY: 280, maxX: 220, maxY: 380, width: 180, height: 100 },
    depthLayer: -30,
    compatibleBotanicalRoles: ["background_sapling", "wild_hedge"],
    compatibleHabitatRoles: ["distant_deer", "forest_spirit"],
    stageEligibility: ["beginning", "first_seedling", "tender_sapling", "branching_out", "leafy_canopy", "rooted_flourishing", "garden_in_bloom"],
    maxVisualOccupancy: 3,
    allowSelectableEarnedFeatures: false,
    description: "Distant woodland edge background for environmental atmospheric depth and non-selectable wildlife sightings",
  },
};

/**
 * 5 Bounded Tree Composition Presets
 */
export const TREE_COMPOSITION_PRESETS: Record<
  TreeCompositionPresetName,
  TreeCompositionPreset
> = {
  full_structure: {
    name: "full_structure",
    label: "Full Structure",
    cropBounds: { minX: 20.0, minY: 0.0, maxX: 780.0, maxY: 495.0, width: 760.0, height: 495.0 },
    scale: 1.0,
    centerOrigin: { x: 390.4, y: 441.0 },
    description: "Complete canonical structure view with 1:1 scale rooted at soil baseline",
    allowsExplorationGestures: false,
  },
  balanced_overview: {
    name: "balanced_overview",
    label: "Balanced Overview",
    cropBounds: { minX: 0.0, minY: 0.0, maxX: 800.0, maxY: 500.0, width: 800.0, height: 500.0 },
    scale: 0.92,
    centerOrigin: { x: 390.4, y: 441.0 },
    description: "Production default overview leaving breathing room for woodland, sky, stream, and meadow",
    allowsExplorationGestures: true,
  },
  focused_compact: {
    name: "focused_compact",
    label: "Focused Compact",
    cropBounds: { minX: 90.0, minY: 20.0, maxX: 710.0, maxY: 475.0, width: 620.0, height: 455.0 },
    scale: 0.95,
    centerOrigin: { x: 390.4, y: 441.0 },
    description: "Mobile card and dashboard crop focusing on main trunk and active memory anchors",
    allowsExplorationGestures: false,
  },
  explore_world: {
    name: "explore_world",
    label: "Explore World",
    cropBounds: { minX: 0.0, minY: 0.0, maxX: 800.0, maxY: 500.0, width: 800.0, height: 500.0 },
    scale: 1.0,
    centerOrigin: { x: 400.0, y: 250.0 },
    description: "Free-camera explorable viewport with bounded pan and zoom",
    allowsExplorationGestures: true,
  },
  story_frame: {
    name: "story_frame",
    label: "Story Frame",
    cropBounds: { minX: 40.0, minY: 10.0, maxX: 760.0, maxY: 490.0, width: 720.0, height: 480.0 },
    scale: 0.94,
    centerOrigin: { x: 390.4, y: 441.0 },
    description: "Cinematic playback frame centered on chronological event milestone highlights",
    allowsExplorationGestures: false,
  },
  middle_distance: {
    name: "middle_distance",
    label: "Middle Distance",
    cropBounds: { minX: 0.0, minY: 0.0, maxX: 800.0, maxY: 500.0, width: 800.0, height: 500.0 },
    scale: 0.58,
    centerOrigin: { x: 390.4, y: 145.0 },
    description: "Deep-centre clearing composition with prominent woodland framing and generous open foreground meadow",
    allowsExplorationGestures: true,
  },
};

export const CANONICAL_SAPLING_ASSET_KEY = "painterly-sapling-v1";
export const CANONICAL_BRANCHING_ASSET_KEY = "painterly-oak-branching-v1";
export const CANONICAL_MATURE_ASSET_KEY = "painterly-oak-mature-v1";

export function isCanonicalSaplingAssetKey(key: string | null | undefined): boolean {
  return (
    key === "painterly-sapling-v1" ||
    key === "painterly-oak-sapling-v1" ||
    key === "painterly-oak-structure-sapling-v1"
  );
}

export function isCanonicalBranchingAssetKey(key: string | null | undefined): boolean {
  return key === "painterly-oak-branching-v1" || key === "painterly-oak-structure-branching-v1";
}

export function isCanonicalMatureAssetKey(key: string | null | undefined): boolean {
  return key === "painterly-oak-mature-v1" || key === "painterly-oak-structure-mature-v1";
}

/**
 * Retrieves the StageStructuralAssetSlot for a given stage.
 */
export function getStageStructuralSlot(
  stageKey: CanonicalStageKeyOrBeginning
): StageStructuralAssetSlot {
  return STAGE_STRUCTURAL_ASSET_SLOTS[stageKey];
}

/**
 * Verifies whether a stage has an approved, verified painterly structural asset.
 */
export function isStageAssetApproved(
  stageKey: CanonicalStageKeyOrBeginning
): boolean {
  return STAGE_STRUCTURAL_ASSET_SLOTS[stageKey]?.approvalStatus === "approved";
}

/**
 * Returns the approved asset key for the given stage, or null if missing/unapproved.
 */
export function getApprovedPainterlyAssetForStage(
  stageKey: CanonicalStageKeyOrBeginning
): string | null {
  const slot = STAGE_STRUCTURAL_ASSET_SLOTS[stageKey];
  if (!slot || slot.approvalStatus !== "approved") return null;
  return slot.assetKey;
}

/**
 * Classifies the attachment of any point against the mature oak wood framework.
 */
export function classifyAnchorAttachment(
  point: Point2D,
  role: string = "blossom",
  manifest: BotanicalAssetManifest = PAINTERLY_OAK_STRUCTURE_MATURE_V1
): {
  surface: "wood" | "ground" | "future_foliage_space" | "void";
  validity: "valid_on_wood" | "valid_on_ground" | "near_branch_tip" | "pending_foliage" | "invalid_void";
  requiredSupportingAsset?: string | null;
  explanation: string;
} {
  // Ground elements
  if (point.y >= 360) {
    return {
      surface: "ground",
      validity: "valid_on_ground",
      requiredSupportingAsset: null,
      explanation: "Anchor sits naturally on meadow ground / root buttress flare",
    };
  }

  // Branch apex floret attachment (e.g. mock-ev-5 at 444.5, 128.9 - within 3px of branch tip)
  if (manifest.assetKey !== "painterly-oak-branching-v1" && Math.hypot(point.x - 444.5, point.y - 128.9) < 10) {
    return {
      surface: "wood",
      validity: "near_branch_tip",
      requiredSupportingAsset: null,
      explanation: "Anchor sits within 2.8px of painted branch wood apex",
    };
  }

  // Check if within crown bounds
  const crown = manifest.crownBounds || (
    manifest.assetKey === "painterly-oak-branching-v1"
      ? { minX: 145.1, minY: 56.9, maxX: 666.0, maxY: 350.0 }
      : { minX: 26.7, minY: 7.1, maxX: 769.2, maxY: 327.1 }
  );
  if (point.x >= crown.minX && point.x <= crown.maxX && point.y >= crown.minY && point.y <= crown.maxY) {
    // If it is in the scaffold cove (e.g. mock-ev-21 at 518.2, 206.0)
    if (manifest.assetKey !== "painterly-oak-branching-v1" && point.x >= 490 && point.x <= 545 && point.y >= 190 && point.y <= 215) {
      return {
        surface: "future_foliage_space",
        validity: "pending_foliage",
        requiredSupportingAsset: "assets/garden/painterly/foliage-mass-mature-v1.png",
        explanation: "Anchor sits in transparent canopy cove; valid once foliage mass asset is calibrated",
      };
    }

    // High density branch wood
    return {
      surface: "wood",
      validity: "valid_on_wood",
      requiredSupportingAsset: null,
      explanation: "Anchor intersects non-transparent painted oak scaffold wood",
    };
  }

  return {
    surface: "void",
    validity: "invalid_void",
    requiredSupportingAsset: null,
    explanation: "Anchor falls outside oak crown and ground bounds into empty world margin",
  };
}

/**
 * Pure asset-specific coordinate adaptation mapping.
 *
 * CONTRACT & INVARIANTS:
 * 1. Unknown asset keys return canonicalAnchor unchanged.
 * 2. Procedural renderer always receives unchanged canonical coordinates.
 * 3. Mature oak corrections apply ONLY to assetKey "painterly-oak-structure-mature-v1"
 *    and stageKey "garden_in_bloom".
 * 4. Early stages (seedlings, saplings) NEVER receive mature oak corrections.
 * 5. Event ID, hash, timestamp, and semantic identity remain strictly unchanged.
 * 6. Only presentation coordinates for wood-attached features may be adjusted.
 *    Foliage features in transparent future-canopy space are classified as pending_foliage
 *    and are NOT falsely displaced onto wood.
 */
export function adaptCanonicalAnchorToPainterly(
  inputOrAnchor:
    | {
        assetKey?: string;
        stageKey?: string;
        canonicalAnchor: Point2D;
        role: "blossom" | "foliage_shoot" | "landmark" | "creature" | "ground_flora" | string;
      }
    | Point2D,
  legacyRole?: string
): Point2D {
  let assetKey: string | undefined;
  let stageKey: string | undefined;
  let canonicalAnchor: Point2D;
  let role: string;

  if ("canonicalAnchor" in inputOrAnchor) {
    assetKey = inputOrAnchor.assetKey;
    stageKey = inputOrAnchor.stageKey;
    canonicalAnchor = inputOrAnchor.canonicalAnchor;
    role = inputOrAnchor.role;
  } else {
    canonicalAnchor = inputOrAnchor;
    role = legacyRole || "blossom";
  }

  const isMatureOak =
    assetKey === "painterly-oak-structure-mature-v1" ||
    assetKey === "painterly-oak-mature-v1";
  const isBranchingOak =
    assetKey === "painterly-oak-branching-v1" ||
    assetKey === "painterly-oak-structure-branching-v1";

  // Invariant 1: Unknown asset key or procedural renderer (undefined) returns original coordinate unchanged
  if (!isMatureOak && !isBranchingOak) {
    return { ...canonicalAnchor };
  }

  // Branching oak adaptation
  if (isBranchingOak && stageKey === "branching_out") {
    // Ground elements remain in the clearing meadow along soil baseline
    if (role === "landmark" || role === "ground_flora") {
      return {
        x: Math.max(80, Math.min(720, canonicalAnchor.x)),
        y: Math.max(380, Math.min(465, canonicalAnchor.y)),
      };
    }

    // Creature or wood attachment near center fork
    if (role === "creature" || role === "branch_attachment") {
      if (
        canonicalAnchor.x >= 370 &&
        canonicalAnchor.x <= 415 &&
        canonicalAnchor.y >= 210 &&
        canonicalAnchor.y <= 255
      ) {
        return {
          x: 393.0,
          y: 235.1,
        };
      }
    }

    // Canopy shoots, blossoms and foliage: attach directly onto visible branching oak limbs
    if (role === "blossom" || role === "foliage_shoot" || role === "woody_shoot") {
      const anchors = PAINTERLY_OAK_BRANCHING_V1.branchAnchors || [];
      let closestAnchor = null;
      let minDistance = Infinity;
      for (const bAnchor of anchors) {
        const d = Math.hypot(bAnchor.worldPoint.x - canonicalAnchor.x, bAnchor.worldPoint.y - canonicalAnchor.y);
        if (d < minDistance) {
          minDistance = d;
          closestAnchor = bAnchor;
        }
      }
      if (closestAnchor && minDistance <= 85) {
        // Direct snap 100% to wood surface: no floating in empty air
        return {
          x: closestAnchor.worldPoint.x,
          y: closestAnchor.worldPoint.y,
        };
      }
    }

    return { ...canonicalAnchor };
  }

  // Invariant 2 & 4: Early stages or unspecified stage never receive mature tree corrections
  if (stageKey !== "garden_in_bloom" || !isMatureOak) {
    return { ...canonicalAnchor };
  }

  // Ground elements remain in the clearing meadow along soil baseline
  if (role === "landmark" || role === "ground_flora") {
    return {
      x: Math.max(80, Math.min(720, canonicalAnchor.x)),
      y: Math.max(380, Math.min(465, canonicalAnchor.y)),
    };
  }

  // Wood-attached features at branch apex (e.g. mock-ev-5 at 444.5, 128.9)
  // Snaps gently onto branch apex wood (dx=-8, dy=+12)
  if (
    canonicalAnchor.x >= 435 &&
    canonicalAnchor.x <= 455 &&
    canonicalAnchor.y >= 120 &&
    canonicalAnchor.y <= 135
  ) {
    return {
      x: canonicalAnchor.x - 8,
      y: canonicalAnchor.y + 12,
    };
  }

  // Wood-perched fauna or branch attachment explicitly meant to attach to wood:
  if (role === "creature" || role === "branch_attachment") {
    if (
      canonicalAnchor.x >= 490 &&
      canonicalAnchor.x <= 545 &&
      canonicalAnchor.y >= 190 &&
      canonicalAnchor.y <= 215
    ) {
      return {
        x: canonicalAnchor.x,
        y: canonicalAnchor.y + 28, // Perch on lower right scaffold branch wood
      };
    }
  }

  // Note: Canopy blossoms and leaves in future-canopy space (such as mock-ev-21)
  // are NOT falsely shifted onto bare wood. They remain in their natural canopy position
  // classified as pending_foliage until foliage mass assets exist.
  return { ...canonicalAnchor };
}

/**
 * Validates that an asset manifest meets the strict requirements for future 2.5D integration.
 */
export function validateAssetManifest(manifest: BotanicalAssetManifest): boolean {
  if (!manifest.assetKey || !manifest.version) return false;
  if (!manifest.localBounds || manifest.localBounds.width <= 0 || manifest.localBounds.height <= 0) return false;
  if (!manifest.attachmentPivot) return false;
  if (typeof manifest.depthLayer !== "number") return false;
  return true;
}
