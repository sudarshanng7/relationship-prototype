/**
 * Purple Garden - 2.5D World Projection & Camera Engine
 *
 * Renderer-independent pure mathematical projection functions for:
 * - World-to-screen coordinate mapping
 * - Screen-to-world inverse projection (e.g. for hit testing / selection)
 * - Fit-to-viewport camera calculation
 * - Camera bounds clamping
 * - Semantic hit-region calculation with accessible target expansion
 * - Collision-safe pure event and memory resolution
 *
 * HIT-REGION CONTRACT:
 * 1. Render bounds: Approximate visual bounding box in world space.
 * 2. Screen visual bounds: Projected pixel bounding box on current display.
 * 3. Interaction screen bounds: Expanded bounding box ensuring minimum accessible touch target
 *    (>= 44x44pt) centered on anchor, without fabricating larger visual geometry.
 * 4. Deterministic depth/priority ordering: Higher depth layer in front; earned memories
 *    outrank structural flora and terrain; alphanumeric node ID tie-breaker.
 */

import type {
  BoundingBox2D,
  Point2D,
  GardenWorld,
  GardenNode,
  SourceEventRef,
  SemanticHitRegion,
} from "./world-types";
import {
  extendBounds,
  createEmptyBounds,
  type FeatureHighlightResult,
} from "./feature-bounds";

export interface Camera2D {
  target: Point2D; // World point positioned at center of viewport
  zoom: number;    // 1.0 = 100%, 2.0 = 200% zoom
}

export interface Viewport {
  width: number;
  height: number;
}

export type ScreenHitRegion = SemanticHitRegion;

/**
 * Projects a 2D world coordinate into screen pixel coordinates.
 */
export function worldToScreen(
  worldPoint: Point2D,
  camera: Camera2D,
  viewport: Viewport
): Point2D {
  const safeZoom = Math.max(0.01, camera.zoom);
  const screenX = (worldPoint.x - camera.target.x) * safeZoom + viewport.width / 2;
  const screenY = (worldPoint.y - camera.target.y) * safeZoom + viewport.height / 2;
  return {
    x: Math.round(screenX * 100) / 100,
    y: Math.round(screenY * 100) / 100,
  };
}

/**
 * Converts a screen pixel coordinate back into world space.
 * Invariant: screenToWorld(worldToScreen(pt)) === pt (within float precision).
 */
export function screenToWorld(
  screenPoint: Point2D,
  camera: Camera2D,
  viewport: Viewport
): Point2D {
  const safeZoom = Math.max(0.01, camera.zoom);
  const worldX = (screenPoint.x - viewport.width / 2) / safeZoom + camera.target.x;
  const worldY = (screenPoint.y - viewport.height / 2) / safeZoom + camera.target.y;
  return {
    x: Math.round(worldX * 100) / 100,
    y: Math.round(worldY * 100) / 100,
  };
}

/**
 * Projects a world-space bounding box into screen coordinates.
 */
export function projectBoundsToScreen(
  bounds: BoundingBox2D,
  camera: Camera2D,
  viewport: Viewport
): BoundingBox2D {
  const tl = worldToScreen({ x: bounds.minX, y: bounds.minY }, camera, viewport);
  const br = worldToScreen({ x: bounds.maxX, y: bounds.maxY }, camera, viewport);
  return {
    minX: Math.min(tl.x, br.x),
    minY: Math.min(tl.y, br.y),
    maxX: Math.max(tl.x, br.x),
    maxY: Math.max(tl.y, br.y),
    width: Math.abs(br.x - tl.x),
    height: Math.abs(br.y - tl.y),
  };
}

/**
 * Computes the optimal camera target and zoom to frame a world bounding box
 * completely inside the given viewport without clipping.
 */
export function fitCameraToViewport(
  worldBounds: BoundingBox2D,
  viewport: Viewport,
  padding: number = 24
): Camera2D {
  const availW = Math.max(10, viewport.width - padding * 2);
  const availH = Math.max(10, viewport.height - padding * 2);

  const zoomX = availW / Math.max(1, worldBounds.width);
  const zoomY = availH / Math.max(1, worldBounds.height);
  const zoom = Math.min(zoomX, zoomY);

  return {
    target: {
      x: (worldBounds.minX + worldBounds.maxX) / 2,
      y: (worldBounds.minY + worldBounds.maxY) / 2,
    },
    zoom: Math.round(zoom * 1000) / 1000,
  };
}

/**
 * Clamps the camera target so the viewport does not pan beyond world bounds.
 */
export function clampCameraTarget(
  target: Point2D,
  worldBounds: BoundingBox2D,
  camera: Camera2D,
  viewport: Viewport
): Point2D {
  const halfVisibleW = viewport.width / (2 * Math.max(0.01, camera.zoom));
  const halfVisibleH = viewport.height / (2 * Math.max(0.01, camera.zoom));

  const minX = worldBounds.width <= halfVisibleW * 2
    ? (worldBounds.minX + worldBounds.maxX) / 2
    : worldBounds.minX + halfVisibleW;
  const maxX = worldBounds.width <= halfVisibleW * 2
    ? (worldBounds.minX + worldBounds.maxX) / 2
    : worldBounds.maxX - halfVisibleW;

  const minY = worldBounds.height <= halfVisibleH * 2
    ? (worldBounds.minY + worldBounds.maxY) / 2
    : worldBounds.minY + halfVisibleH;
  const maxY = worldBounds.height <= halfVisibleH * 2
    ? (worldBounds.minY + worldBounds.maxY) / 2
    : worldBounds.maxY - halfVisibleH;

  return {
    x: Math.max(minX, Math.min(maxX, target.x)),
    y: Math.max(minY, Math.min(maxY, target.y)),
  };
}

/**
 * Calculates semantic hit regions on screen for all nodes in the garden world.
 *
 * Separates visual render bounds from minimum accessible interaction touch targets
 * (default >= 44x44pt).
 *
 * Orders regions deterministically:
 * 1. depthLayer descending (highest layer in front)
 * 2. interactionPriority descending (earned memories before branches/terrain)
 * 3. nodeId ascending (tie-breaker)
 */
export function calculateSemanticHitRegions(
  world: GardenWorld,
  camera: Camera2D,
  viewport: Viewport,
  minTargetSize: number = 44
): SemanticHitRegion[] {
  const regions: SemanticHitRegion[] = [];

  for (const node of Object.values(world.nodes)) {
    if (node.role === "world_root") continue;

    const screenVisual = projectBoundsToScreen(node.worldBounds, camera, viewport);
    const centerScreen = worldToScreen(node.anchorPoint, camera, viewport);

    const halfSize = minTargetSize / 2;
    const interactionScreenBounds: BoundingBox2D = {
      minX: Math.min(screenVisual.minX, centerScreen.x - halfSize),
      minY: Math.min(screenVisual.minY, centerScreen.y - halfSize),
      maxX: Math.max(screenVisual.maxX, centerScreen.x + halfSize),
      maxY: Math.max(screenVisual.maxY, centerScreen.y + halfSize),
      width: Math.max(screenVisual.width, minTargetSize),
      height: Math.max(screenVisual.height, minTargetSize),
    };

    let priority = 10; // Default decorative/terrain
    if (node.isEarned) {
      priority = 100; // Earned memory feature
    } else if (node.role === "creature_node") {
      priority = 60; // Living wildlife
    } else if (node.role === "habitat_node") {
      priority = 40; // Habitat anchor
    } else if (node.role === "branch" || node.role === "trunk") {
      priority = 20; // Structural tree
    }

    regions.push({
      id: `hit:${node.id}`,
      nodeId: node.id,
      semanticKey: node.semanticKey || null,
      role: node.role,
      sourceEvent: node.sourceEvent || null,
      isEarned: node.isEarned,
      depthLayer: node.depthLayer,
      interactionPriority: priority,
      visualBounds: node.worldBounds,
      screenVisualBounds: screenVisual,
      interactionScreenBounds,
      anchorPoint: node.anchorPoint,
      isAccessibleTarget: true,
    });
  }

  // Deterministic depth and priority ordering
  regions.sort((a, b) => {
    if (a.depthLayer !== b.depthLayer) {
      return b.depthLayer - a.depthLayer;
    }
    if (a.interactionPriority !== b.interactionPriority) {
      return b.interactionPriority - a.interactionPriority;
    }
    return a.nodeId.localeCompare(b.nodeId);
  });

  return regions;
}

export const calculateHitRegions = calculateSemanticHitRegions;

/**
 * Resolves a botanical node ID to its authorized source care event.
 * Supports canonical node IDs as well as legacy render IDs.
 * Pure invariant: Decorative nodes return null; earned nodes return their exact source.
 */
export function resolveEventFromNode(
  nodeId: string,
  world: GardenWorld
): SourceEventRef | null {
  let node = world.nodes[nodeId];
  if (!node && world.renderIdToNodeIds && world.renderIdToNodeIds[nodeId]) {
    const firstCanonical = world.renderIdToNodeIds[nodeId][0];
    node = world.nodes[firstCanonical];
  }
  if (!node || !node.isEarned || !node.sourceEvent) {
    return null;
  }
  return node.sourceEvent;
}

/**
 * Resolves all botanical nodes associated with an authoritative care event.
 */
export function resolveNodesForEvent(
  sourceKind: string,
  sourceId: string,
  world: GardenWorld
): GardenNode[] {
  const semanticKey = `${sourceKind}:${sourceId}`;
  const group = world.earnedFeatureGroups[semanticKey];
  if (!group) return [];

  return group.nodeIds
    .map((id) => world.nodes[id])
    .filter((n): n is GardenNode => Boolean(n));
}

/**
 * Resolves conservative approximate bounding box and highlight anchor from the
 * canonical GardenWorld model. Supports canonical IDs, semantic keys, and legacy render IDs.
 */
export function resolveFeatureBoundsFromWorld(
  world: GardenWorld,
  featureIdOrSemanticKey: string
): FeatureHighlightResult | null {
  if (!world || !featureIdOrSemanticKey) return null;

  // 1. Direct match on earned feature group (e.g. "reconnection:uuid")
  const group = world.earnedFeatureGroups[featureIdOrSemanticKey];
  if (group) {
    const halfDiag = Math.hypot(group.bounds.width, group.bounds.height) / 2;
    const r = Math.round(Math.max(12, Math.min(36, halfDiag * 1.15)) * 10) / 10;
    return {
      cx: group.anchor.x,
      cy: group.anchor.y,
      r,
      bounds: group.bounds,
    };
  }

  // 2. Query via renderIdToNodeIds (for legacy render IDs e.g. "care-reconnection-3f4a...")
  if (
    world.renderIdToNodeIds &&
    world.renderIdToNodeIds[featureIdOrSemanticKey] &&
    world.renderIdToNodeIds[featureIdOrSemanticKey].length > 0
  ) {
    const canonicalIds = world.renderIdToNodeIds[featureIdOrSemanticKey];
    const groupBounds = createEmptyBounds();
    for (const cid of canonicalIds) {
      const n = world.nodes[cid];
      if (n) {
        extendBounds(groupBounds, n.worldBounds.minX, n.worldBounds.minY);
        extendBounds(groupBounds, n.worldBounds.maxX, n.worldBounds.maxY);
      }
    }
    if (Number.isFinite(groupBounds.minX)) {
      const cx = (groupBounds.minX + groupBounds.maxX) / 2;
      const cy = (groupBounds.minY + groupBounds.maxY) / 2;
      const halfDiag = Math.hypot(groupBounds.width, groupBounds.height) / 2;
      const r = Math.round(Math.max(12, Math.min(36, halfDiag * 1.15)) * 10) / 10;
      return { cx, cy, r, bounds: groupBounds };
    }
  }

  // 3. Direct match on canonical node ID
  const directNode = world.nodes[featureIdOrSemanticKey];
  if (directNode) {
    const b = directNode.worldBounds;
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const halfDiag = Math.hypot(b.width, b.height) / 2;
    const r = Math.round(Math.max(12, Math.min(36, halfDiag * 1.15)) * 10) / 10;
    return {
      cx,
      cy,
      r,
      bounds: b,
    };
  }

  // 4. Delimiter-safe child search (using exact canonical child prefix "::child::")
  const matchingNodes = Object.values(world.nodes).filter(
    (n) =>
      n.id === featureIdOrSemanticKey ||
      n.id.startsWith(`${featureIdOrSemanticKey}::child::`) ||
      n.semanticKey === featureIdOrSemanticKey ||
      n.earnedGroupKey === featureIdOrSemanticKey
  );

  if (matchingNodes.length === 0) {
    return null;
  }

  const bounds = createEmptyBounds();
  for (const n of matchingNodes) {
    extendBounds(bounds, n.worldBounds.minX, n.worldBounds.minY);
    extendBounds(bounds, n.worldBounds.maxX, n.worldBounds.maxY);
  }

  const cx = Math.round(((bounds.minX + bounds.maxX) / 2) * 10) / 10;
  const cy = Math.round(((bounds.minY + bounds.maxY) / 2) * 10) / 10;
  const halfDiag = Math.hypot(bounds.width, bounds.height) / 2;
  const r = Math.round(Math.max(12, Math.min(36, halfDiag * 1.15)) * 10) / 10;

  return {
    cx,
    cy,
    r,
    bounds,
  };
}
