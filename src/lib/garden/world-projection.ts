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

import {
  createEmptyBounds,
  extendBounds,
  type FeatureHighlightResult,
} from "./feature-bounds";
import type {
  BoundingBox2D,
  GardenCameraState,
  GardenNode,
  GardenWorld,
  Point2D,
  ScenicRegion,
  SemanticHitRegion,
  SourceEventRef,
} from "./world-types";

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
  camera: Camera2D | GardenCameraState,
  viewport: Viewport
): Point2D {
  const safeZoom = Math.max(0.01, camera.zoom);
  const tx = "targetX" in camera ? camera.targetX : camera.target.x;
  const ty = "targetY" in camera ? camera.targetY : camera.target.y;
  const screenX = (worldPoint.x - tx) * safeZoom + viewport.width / 2;
  const screenY = (worldPoint.y - ty) * safeZoom + viewport.height / 2;
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
  camera: Camera2D | GardenCameraState,
  viewport: Viewport
): Point2D {
  const safeZoom = Math.max(0.01, camera.zoom);
  const tx = "targetX" in camera ? camera.targetX : camera.target.x;
  const ty = "targetY" in camera ? camera.targetY : camera.target.y;
  const worldX = (screenPoint.x - viewport.width / 2) / safeZoom + tx;
  const worldY = (screenPoint.y - viewport.height / 2) / safeZoom + ty;
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

export interface Insets2D {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface InteractiveSafeViewport {
  x: number;
  y: number;
  width: number;
  height: number;
  insets: Insets2D;
}

/**
 * Canonical insets for Purple Garden interactive safe framing:
 * - Top (68pt): Top bar, back button, theme indicators and header clearance
 * - Bottom (84pt): Sliding scenic/memory bar (height ~56pt) + bottom margin + safe area
 * - Left/Right (16pt): Edge margin preventing clipped flowers/touch targets
 */
export const CANONICAL_GARDEN_INSETS: Insets2D = {
  top: 68,
  bottom: 84,
  left: 16,
  right: 16,
};

/**
 * Calculates the interactive safe viewport that excludes top bar, bottom sliding strip,
 * and edge margins so that all interactive botanical nodes remain fully visible and tappable.
 */
export function calculateInteractiveSafeViewport(
  viewport: Viewport,
  insets: Partial<Insets2D> = {}
): InteractiveSafeViewport {
  const safeInsets: Insets2D = {
    top: insets.top ?? CANONICAL_GARDEN_INSETS.top,
    bottom: insets.bottom ?? CANONICAL_GARDEN_INSETS.bottom,
    left: insets.left ?? CANONICAL_GARDEN_INSETS.left,
    right: insets.right ?? CANONICAL_GARDEN_INSETS.right,
  };
  const width = Math.max(10, viewport.width - safeInsets.left - safeInsets.right);
  const height = Math.max(10, viewport.height - safeInsets.top - safeInsets.bottom);
  return {
    x: safeInsets.left,
    y: safeInsets.top,
    width,
    height,
    insets: safeInsets,
  };
}

/**
 * Computes optimal camera target and zoom to frame worldBounds completely inside the
 * interactive safe viewport (excluding top header and bottom sliding strip).
 */
export function fitCameraToSafeViewport(
  worldBounds: BoundingBox2D,
  viewport: Viewport,
  insets: Partial<Insets2D> = {},
  padding: number = 16
): Camera2D {
  const safeVp = calculateInteractiveSafeViewport(viewport, insets);
  const availW = Math.max(10, safeVp.width - padding * 2);
  const availH = Math.max(10, safeVp.height - padding * 2);

  const zoomX = availW / Math.max(1, worldBounds.width);
  const zoomY = availH / Math.max(1, worldBounds.height);
  const zoom = Math.min(zoomX, zoomY);

  // Screen center vs Safe viewport center
  const screenCenterX = viewport.width / 2;
  const screenCenterY = viewport.height / 2;
  const safeCenterX = safeVp.x + safeVp.width / 2;
  const safeCenterY = safeVp.y + safeVp.height / 2;

  const deltaScreenX = safeCenterX - screenCenterX;
  const deltaScreenY = safeCenterY - screenCenterY;

  const worldCenterX = (worldBounds.minX + worldBounds.maxX) / 2;
  const worldCenterY = (worldBounds.minY + worldBounds.maxY) / 2;

  const targetX = worldCenterX - deltaScreenX / zoom;
  const targetY = worldCenterY - deltaScreenY / zoom;

  return {
    target: {
      x: Math.round(targetX * 100) / 100,
      y: Math.round(targetY * 100) / 100,
    },
    zoom: Math.round(zoom * 1000) / 1000,
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
 * Converts a unified GardenCameraState to a Camera2D structure.
 */
export function cameraStateToCamera2D(state: GardenCameraState): Camera2D {
  return {
    target: { x: state.targetX, y: state.targetY },
    zoom: state.zoom,
  };
}

/**
 * Converts a unified GardenCameraState to a Viewport structure.
 */
export function cameraStateToViewport(state: GardenCameraState): Viewport {
  return {
    width: state.viewportWidth,
    height: state.viewportHeight,
  };
}

export type GardenFitStrategy =
  | "full_structure"
  | "viewport_cover"
  | "focused_compact"
  | "memory_focus"
  | "safe_viewport";

/**
 * Creates a fitted camera state covering the given world bounds inside viewport.
 */
export function createCameraFromFit(
  worldBounds: BoundingBox2D,
  viewport: Viewport,
  padding: number = 24
): GardenCameraState {
  const fit = fitCameraToViewport(worldBounds, viewport, padding);
  return {
    targetX: fit.target.x,
    targetY: fit.target.y,
    zoom: fit.zoom,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
  };
}

/**
 * Creates a camera state matching a deliberate fitting strategy:
 * - "viewport_cover": scales artwork to cover 100% of viewport without blank canvas
 * - "safe_viewport": fits world bounds completely inside the interactive safe viewport
 * - "full_structure": contains entire bounding box with optional padding
 * - "focused_compact": focused tree crop for compact card
 * - "memory_focus": centered on a feature
 */
export function createCameraFromFitStrategy(
  worldBounds: BoundingBox2D,
  viewport: Viewport,
  strategy: GardenFitStrategy = "viewport_cover",
  padding: number = 0,
  insets?: Partial<Insets2D>
): GardenCameraState {
  if (strategy === "safe_viewport") {
    const safeFit = fitCameraToSafeViewport(worldBounds, viewport, insets, padding || 16);
    return {
      targetX: safeFit.target.x,
      targetY: safeFit.target.y,
      zoom: safeFit.zoom,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
    };
  }

  if (strategy === "viewport_cover") {
    const zoomX = viewport.width / Math.max(1, worldBounds.width);
    const zoomY = viewport.height / Math.max(1, worldBounds.height);
    const zoom = Math.max(zoomX, zoomY);
    let target = {
      x: (worldBounds.minX + worldBounds.maxX) / 2,
      y: (worldBounds.minY + worldBounds.maxY) / 2,
    };
    if (insets) {
      const safeVp = calculateInteractiveSafeViewport(viewport, insets);
      const deltaY = (safeVp.y + safeVp.height / 2) - viewport.height / 2;
      target.y = target.y - deltaY / zoom;
    }
    return {
      targetX: Math.round(target.x * 100) / 100,
      targetY: Math.round(target.y * 100) / 100,
      zoom: Math.round(zoom * 1000) / 1000,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
    };
  }

  return createCameraFromFit(worldBounds, viewport, padding);
}

/**
 * Computes min and max zoom limits for a bounded viewport under a fit strategy.
 * For "viewport_cover", minZoom is the cover threshold preventing void/grey exposure.
 */
export function calculateZoomBounds(
  worldBounds: BoundingBox2D,
  viewport: Viewport,
  padding: number = 24,
  strategy: GardenFitStrategy = "full_structure"
): { minZoom: number; maxZoom: number; fitZoom: number } {
  let minZoom: number;
  let fitZoom: number;

  if (strategy === "viewport_cover") {
    const zoomX = viewport.width / Math.max(1, worldBounds.width);
    const zoomY = viewport.height / Math.max(1, worldBounds.height);
    fitZoom = Math.max(zoomX, zoomY);
    minZoom = fitZoom;
  } else {
    const fit = fitCameraToViewport(worldBounds, viewport, padding);
    fitZoom = fit.zoom;
    minZoom = fit.zoom;
  }

  const maxZoom = Math.max(minZoom * 3.5, 2.5);
  return {
    minZoom: Math.round(minZoom * 1000) / 1000,
    maxZoom: Math.round(maxZoom * 1000) / 1000,
    fitZoom: Math.round(fitZoom * 1000) / 1000,
  };
}

/**
 * Pans the camera by a screen pixel delta (dx, dy).
 * Converts screen delta to world delta using current zoom and clamps target to world bounds.
 */
export function panCamera(
  state: GardenCameraState,
  screenDeltaX: number,
  screenDeltaY: number,
  worldBounds: BoundingBox2D
): GardenCameraState {
  const safeZoom = Math.max(0.01, state.zoom);
  const worldDeltaX = screenDeltaX / safeZoom;
  const worldDeltaY = screenDeltaY / safeZoom;

  const rawTarget: Point2D = {
    x: state.targetX - worldDeltaX,
    y: state.targetY - worldDeltaY,
  };

  const clamped = clampCameraTarget(
    rawTarget,
    worldBounds,
    cameraStateToCamera2D(state),
    cameraStateToViewport(state)
  );

  return {
    ...state,
    targetX: Math.round(clamped.x * 100) / 100,
    targetY: Math.round(clamped.y * 100) / 100,
  };
}

/**
 * Zooms the camera around a specific screen focal point (e.g. pointer coordinate or pinch center).
 * Clamps zoom within [minZoom, maxZoom] and adjusts target so focal point remains stable on screen.
 */
export function zoomCameraAroundPoint(
  state: GardenCameraState,
  zoomRatio: number,
  screenFocalPoint: Point2D,
  worldBounds: BoundingBox2D,
  minZoom: number,
  maxZoom: number
): GardenCameraState {
  const camera = cameraStateToCamera2D(state);
  const viewport = cameraStateToViewport(state);
  const oldZoom = Math.max(0.01, state.zoom);
  const newZoom = Math.max(minZoom, Math.min(maxZoom, oldZoom * zoomRatio));

  if (Math.abs(newZoom - oldZoom) < 0.0001) {
    return state;
  }

  // World point beneath the screen focal coordinate before zoom
  const worldFocal = screenToWorld(screenFocalPoint, camera, viewport);

  // New target so worldFocal stays at screenFocalPoint after newZoom
  const rawTargetX = worldFocal.x - (screenFocalPoint.x - viewport.width / 2) / newZoom;
  const rawTargetY = worldFocal.y - (screenFocalPoint.y - viewport.height / 2) / newZoom;

  const clamped = clampCameraTarget(
    { x: rawTargetX, y: rawTargetY },
    worldBounds,
    { target: { x: rawTargetX, y: rawTargetY }, zoom: newZoom },
    viewport
  );

  return {
    ...state,
    targetX: Math.round(clamped.x * 100) / 100,
    targetY: Math.round(clamped.y * 100) / 100,
    zoom: Math.round(newZoom * 1000) / 1000,
  };
}

/**
 * Calculates a camera state focusing directly on a scenic exploration region.
 */
export function focusScenicRegion(
  regionBounds: BoundingBox2D,
  viewport: Viewport,
  worldBounds: BoundingBox2D,
  minZoom: number,
  maxZoom: number,
  padding: number = 32
): GardenCameraState {
  const fit = fitCameraToViewport(regionBounds, viewport, padding);
  const zoom = Math.max(minZoom, Math.min(maxZoom, fit.zoom));
  const clamped = clampCameraTarget(
    fit.target,
    worldBounds,
    { target: fit.target, zoom },
    viewport
  );

  return {
    targetX: Math.round(clamped.x * 100) / 100,
    targetY: Math.round(clamped.y * 100) / 100,
    zoom: Math.round(zoom * 1000) / 1000,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
  };
}

/**
 * Calculates a camera state focusing directly on an earned feature's bounding box,
 * providing generous surrounding botanical context padding.
 */
export function focusFeatureBounds(
  featureBounds: BoundingBox2D,
  viewport: Viewport,
  worldBounds: BoundingBox2D,
  minZoom: number,
  maxZoom: number,
  contextPadding: number = 56
): GardenCameraState {
  const fit = fitCameraToViewport(featureBounds, viewport, contextPadding);
  const zoom = Math.max(
    minZoom,
    Math.min(Math.min(maxZoom, 2.2), Math.max(fit.zoom, minZoom * 1.5))
  );
  const clamped = clampCameraTarget(
    fit.target,
    worldBounds,
    { target: fit.target, zoom },
    viewport
  );

  return {
    targetX: Math.round(clamped.x * 100) / 100,
    targetY: Math.round(clamped.y * 100) / 100,
    zoom: Math.round(zoom * 1000) / 1000,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
  };
}

/**
 * Returns the exact SVG transform string for the world presentation group.
 * Invariant: Applying this transform in SVG maps worldPoint (x, y) precisely to worldToScreen(pt).
 */
export function getCameraTransformString(
  camera: Camera2D | GardenCameraState,
  viewport: Viewport
): string {
  const tx = "targetX" in camera ? camera.targetX : camera.target.x;
  const ty = "targetY" in camera ? camera.targetY : camera.target.y;
  const zoom = camera.zoom;
  const cx = viewport.width / 2;
  const cy = viewport.height / 2;
  return `translate(${cx}, ${cy}) scale(${zoom}) translate(${-tx}, ${-ty})`;
}

/**
 * Canonical unified gesture threshold for distinguishing taps from drags.
 * A stationary press or gesture with movement < 6px is a tap.
 * Movement >= 6px immediately and irreversibly transitions to a pan drag.
 */
export const CANONICAL_DRAG_THRESHOLD_PX = 6;

/**
 * Pure gesture classifier:
 * - Movement strictly less than threshold (< 6px) classifies as "tap".
 * - Movement equal to or greater than threshold (>= 6px) classifies as "drag".
 */
export function classifyGesture(
  dx: number,
  dy: number,
  threshold: number = CANONICAL_DRAG_THRESHOLD_PX
): "tap" | "drag" {
  return Math.hypot(dx, dy) >= threshold ? "drag" : "tap";
}

/**
 * Derives the interaction priority class for a garden node:
 * - Class 3 (highest): Eligible event-backed earned memory feature (isEarned === true and sourceEvent !== null)
 * - Class 2 (middle): Eligible living habitat or fauna node (creatures, habitats)
 * - Class 1 (base): Eligible decorative botanical / landscape node
 */
export function getNodeInteractionClass(node: GardenNode): number {
  if (node.isEarned && node.sourceEvent) {
    return 3;
  }
  if (
    node.role === "creature_node" ||
    node.role === "habitat_node" ||
    node.role === "habitat_detail"
  ) {
    return 2;
  }
  return 1;
}

/**
 * Resolves the topmost eligible node at a world coordinate.
 *
 * SELECTION PRIORITY CONTRACT:
 * 1. Eligible event-backed earned feature (Class 3)
 * 2. Eligible habitat or fauna node (Class 2)
 * 3. Eligible decorative botanical/landscape node (Class 1)
 *
 * Within the same interaction class:
 * - Highest visible depth first (depthLayer descending)
 * - Deterministic node ID tie-breaker (nodeId ascending)
 */
export function resolveNodeAtWorldCoordinate(
  worldPoint: Point2D,
  world: GardenWorld,
  hitSlop: number = 18
): GardenNode | null {
  const candidateNodes = Object.values(world.nodes).filter(
    (n) => n.role !== "world_root"
  );

  candidateNodes.sort((a, b) => {
    const classA = getNodeInteractionClass(a);
    const classB = getNodeInteractionClass(b);
    if (classA !== classB) {
      return classB - classA; // Higher class first (earned 3 > fauna 2 > decorative 1)
    }
    if (a.depthLayer !== b.depthLayer) {
      return b.depthLayer - a.depthLayer; // Within same class, highest depth first
    }
    return a.id.localeCompare(b.id); // Deterministic tie-breaker
  });

  for (const node of candidateNodes) {
    const b = node.worldBounds;
    const minX = b.minX - hitSlop;
    const maxX = b.maxX + hitSlop;
    const minY = b.minY - hitSlop;
    const maxY = b.maxY + hitSlop;

    if (
      worldPoint.x >= minX &&
      worldPoint.x <= maxX &&
      worldPoint.y >= minY &&
      worldPoint.y <= maxY
    ) {
      return node;
    }
  }

  return null;
}

export type GardenInputMode = "mouse" | "touch";

/**
 * Screen-space interaction hit tolerances (in physical screen points/pixels, NOT world units):
 * - Mouse / trackpad: 12 screen pixels default (acceptable range 10–14px)
 * - Touch: 22 screen points default (ensuring an approximately 44-point accessible target)
 */
export const DEFAULT_MOUSE_HIT_SLOP_PX = 12;
export const DEFAULT_TOUCH_HIT_SLOP_PT = 22;

export interface GardenScreenHitOptions {
  inputMode?: GardenInputMode;
  hitSlop?: number;
  hitSlopScreen?: number;
  viewBoxScale?: number;
}

/**
 * Resolves the effective screen-space hit tolerance.
 * Does NOT infer tolerance from world-space zoom; hit slop remains constant on screen.
 */
export function resolveHitTolerance(
  optionsOrSlop?: number | GardenScreenHitOptions
): number {
  if (typeof optionsOrSlop === "number") {
    return optionsOrSlop;
  }
  if (optionsOrSlop && typeof optionsOrSlop === "object") {
    const explicitSlop =
      typeof optionsOrSlop.hitSlop === "number"
        ? optionsOrSlop.hitSlop
        : optionsOrSlop.hitSlopScreen;
    if (typeof explicitSlop === "number") {
      return explicitSlop;
    }
    if (optionsOrSlop.inputMode === "mouse") {
      return DEFAULT_MOUSE_HIT_SLOP_PX;
    }
    if (optionsOrSlop.inputMode === "touch") {
      return DEFAULT_TOUCH_HIT_SLOP_PT;
    }
  }
  return DEFAULT_TOUCH_HIT_SLOP_PT;
}

/**
 * Resolves the topmost eligible node at a screen pixel coordinate.
 *
 * SCREEN-SPACE HIT TESTING CONTRACT:
 * 1. Screen-space projection: visual bounds and anchor points are projected to screen coordinates.
 * 2. Distinct Input Tolerances:
 *    - Mouse / trackpad: 12 screen pixels default (range 10–14px).
 *    - Touch: 22 screen points default (~44pt accessible touch target).
 *    - Independent of camera zoom level.
 * 3. Distance-First Candidate Selection Order:
 *    a. Filter to visible candidates whose screen-space hit region contains the pointer (distanceToGeometry <= hitTolerance).
 *    b. Across every eligible candidate, select the candidate with the smallest distance to its actual rendered visual geometry.
 *    c. If distances are genuinely equal or within tiny floating-point tolerance (<= 0.01px), select the visually topmost candidate by depthLayer/render order.
 *    d. Use interaction class only as a final deterministic tie-breaker after distance and visual depth.
 *    (An earned memory must never defeat a closer decorative or botanical feature merely because its interaction class is higher.)
 * 4. Empty terrain returns null (never selects a distant fallback node).
 */
export function resolveNodeAtScreenCoordinate(
  screenPoint: Point2D,
  world: GardenWorld,
  camera: Camera2D | GardenCameraState,
  viewport: Viewport,
  hitSlopOrOptions?: number | GardenScreenHitOptions,
  viewBoxScale: number = 1.0
): GardenNode | null {
  const cam: Camera2D = "targetX" in camera
    ? { target: { x: camera.targetX, y: camera.targetY }, zoom: camera.zoom }
    : camera;

  const hitTolerance = resolveHitTolerance(hitSlopOrOptions);

  const candidateNodes: GardenNode[] = [];
  const seenIds = new Set<string>();

  for (const node of Object.values(world.nodes)) {
    if (
      !node ||
      node.role === "world_root" ||
      node.id === "terrain-root" ||
      node.id === "tree-root" ||
      node.id === "ground-flora-root" ||
      node.id === "habitat-root" ||
      seenIds.has(node.id)
    ) {
      continue;
    }
    seenIds.add(node.id);
    candidateNodes.push(node);
  }

  interface QualifyingHit {
    node: GardenNode;
    interactionClass: number;
    distanceToGeometry: number;
    distanceToCenter: number;
    depthLayer: number;
  }

  const qualifyingHits: QualifyingHit[] = [];

  for (const node of candidateNodes) {
    const screenVisual = projectBoundsToScreen(node.worldBounds, cam, viewport);

    const dx = screenPoint.x < screenVisual.minX
      ? screenVisual.minX - screenPoint.x
      : screenPoint.x > screenVisual.maxX
        ? screenPoint.x - screenVisual.maxX
        : 0;

    const dy = screenPoint.y < screenVisual.minY
      ? screenVisual.minY - screenPoint.y
      : screenPoint.y > screenVisual.maxY
        ? screenPoint.y - screenVisual.maxY
        : 0;

    const distanceToGeometry = Math.hypot(dx, dy);

    if (distanceToGeometry <= hitTolerance) {
      const centerX = (screenVisual.minX + screenVisual.maxX) / 2;
      const centerY = (screenVisual.minY + screenVisual.maxY) / 2;
      const distanceToCenter = Math.hypot(screenPoint.x - centerX, screenPoint.y - centerY);

      qualifyingHits.push({
        node,
        interactionClass: getNodeInteractionClass(node),
        distanceToGeometry,
        distanceToCenter,
        depthLayer: node.depthLayer ?? 0,
      });
    }
  }

  if (qualifyingHits.length === 0) {
    return null;
  }

  qualifyingHits.sort((a, b) => {
    // 1. Distance to actual rendered visual geometry dominates
    const distDiff = a.distanceToGeometry - b.distanceToGeometry;
    if (Math.abs(distDiff) > 0.01) {
      return distDiff;
    }

    // 2. Visually topmost candidate by depthLayer / render order
    if (a.depthLayer !== b.depthLayer) {
      return b.depthLayer - a.depthLayer;
    }

    // 3. Interaction class tie-breaker (earned memory > fauna > decorative)
    if (a.interactionClass !== b.interactionClass) {
      return b.interactionClass - a.interactionClass;
    }

    // 4. Closer center, then stable deterministic node ID
    const centerDiff = a.distanceToCenter - b.distanceToCenter;
    if (Math.abs(centerDiff) > 0.01) {
      return centerDiff;
    }

    return a.node.id.localeCompare(b.node.id);
  });

  return qualifyingHits[0].node;
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
      sourceMemory: node.sourceMemory || null,
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

/**
 * Determines whether a scenic region is available and selectable in the current garden world.
 * For example, "stream_edge" is only selectable if the garden contains a stream or stream_edge features.
 */
export function isScenicRegionAvailable(world: GardenWorld, region: ScenicRegion): boolean {
  if (!world.scenicRegions || !world.scenicRegions[region]) {
    return false;
  }
  if (region === "stream_edge") {
    return Object.values(world.nodes).some(
      (n) => n.role === "terrain_region" && n.regionKind === "stream_path"
    );
  }
  return true;
}

/**
 * Focuses on a scenic region by name if available, returning the new camera state.
 * Returns null if the region is not available in the current world (e.g. stream when no brook exists).
 */
export function focusNamedScenicRegion(
  region: ScenicRegion,
  world: GardenWorld,
  viewport: Viewport,
  minZoom?: number,
  maxZoom?: number,
  padding: number = 32
): GardenCameraState | null {
  if (!isScenicRegionAvailable(world, region)) {
    return null;
  }
  const bounds = world.scenicRegions?.[region];
  if (!bounds) return null;
  const zoomLimits = calculateZoomBounds(world.worldBounds, viewport);
  return focusScenicRegion(
    bounds,
    viewport,
    world.worldBounds,
    minZoom ?? zoomLimits.minZoom,
    maxZoom ?? zoomLimits.maxZoom,
    padding
  );
}
