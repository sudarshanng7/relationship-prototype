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

import type { BotanicalAssetManifest, BoundingBox2D, Point2D } from "./world-types";

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
 * Validates that an asset manifest meets the strict requirements for future 2.5D integration.
 */
export function validateAssetManifest(manifest: BotanicalAssetManifest): boolean {
  if (!manifest.assetKey || !manifest.version) return false;
  if (!manifest.localBounds || manifest.localBounds.width <= 0 || manifest.localBounds.height <= 0) return false;
  if (!manifest.attachmentPivot) return false;
  if (typeof manifest.depthLayer !== "number") return false;
  return true;
}
