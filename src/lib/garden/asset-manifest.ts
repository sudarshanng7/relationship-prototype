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
  "tree-trunk-procedural-v1": {
    assetKey: "tree-trunk-procedural-v1",
    version: "1.0.0",
    botanicalFamily: "broadleaf_woodland",
    variant: "procedural_spline",
    localBounds: { minX: 300, minY: 150, maxX: 500, maxY: 440, width: 200, height: 290 },
    attachmentPivot: { x: 400, y: 440 },
    depthLayer: 0,
    detailLevelVariants: {
      low: "trunk_silhouette_spline",
      medium: "trunk_spline_with_highlight",
      high: "trunk_textured_with_bark_shading",
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

  "foliage-pointed-leaf-v1": {
    assetKey: "foliage-pointed-leaf-v1",
    version: "1.0.0",
    botanicalFamily: "tender_growth",
    variant: "single_leaf",
    localBounds: { minX: -15, minY: -30, maxX: 15, maxY: 0, width: 30, height: 30 },
    attachmentPivot: { x: 0, y: 0 },
    depthLayer: 30,
    detailLevelVariants: {
      low: "simple_leaf_path",
      medium: "pointed_leaf_with_central_vein",
      high: "pointed_leaf_with_bifurcated_veins",
    },
    licensingProvenance: {
      source: "procedural",
      author: "Purple Garden Team",
    },
  },

  "blossom-reconnection-rose-v1": {
    assetKey: "blossom-reconnection-rose-v1",
    version: "1.0.0",
    botanicalFamily: "reconnection_blossom",
    variant: "five_petal_rose",
    localBounds: { minX: -12, minY: -12, maxX: 12, maxY: 12, width: 24, height: 24 },
    attachmentPivot: { x: 0, y: 0 },
    depthLayer: 50,
    detailLevelVariants: {
      low: "blossom_disc",
      medium: "blossom_five_petals",
      high: "blossom_layered_petals_with_stamen",
    },
    licensingProvenance: {
      source: "procedural",
      author: "Purple Garden Team",
    },
  },

  "landmark-important-date-v1": {
    assetKey: "landmark-important-date-v1",
    version: "1.0.0",
    botanicalFamily: "ground_life",
    variant: "landmark_flower",
    localBounds: { minX: -10, minY: -18, maxX: 10, maxY: 0, width: 20, height: 18 },
    attachmentPivot: { x: 0, y: 0 },
    depthLayer: 15,
    detailLevelVariants: {
      low: "stem_and_disc",
      medium: "floret_cluster_with_leaves",
    },
    licensingProvenance: {
      source: "procedural",
      author: "Purple Garden Team",
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
