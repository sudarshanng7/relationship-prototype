/**
 * Purple Garden - Feature Bounds & Highlight Coverage Resolver
 *
 * Universal approximate visual bounding-box calculator and semantic feature bounds
 * resolver for living botanical elements across all primitive families:
 * - Foliage clusters and path-based leaves
 * - Canopy shoots, stems, buds and berries
 * - Blossoms and petal clusters
 * - Fruit and seed pods
 * - Ground flora, companion plants and landmarks
 * - Habitat details and creatures
 * - Multi-element child primitives belonging to one earned care event
 *
 * CONTRACT: Approximate Visual Bounds
 * Calculates conservative bounding boxes enclosing the path's endpoints and control-point
 * convex hulls. Suitable for highlight halos and visual framing.
 * Not authoritative for interactive hit testing (interactive selection uses semantic hit
 * regions with minimum accessible target bounds).
 */

import type {
  GeneratedGardenSVGScene,
  FoliageClusterSVG,
  BlossomSVG,
  SeedPodSVG,
  GroundDetailSVG,
  CanopyDetailSVG,
  HabitatDetailSVG,
} from "../garden-generator";
import type { BoundingBox2D, Point2D } from "./world-types";

/**
 * Creates an empty or default bounding box.
 */
export function createEmptyBounds(): BoundingBox2D {
  return {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
    width: 0,
    height: 0,
  };
}

/**
 * Extends a bounding box to include a 2D point.
 */
export function extendBounds(bounds: BoundingBox2D, x: number, y: number): void {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  if (x < bounds.minX) bounds.minX = x;
  if (y < bounds.minY) bounds.minY = y;
  if (x > bounds.maxX) bounds.maxX = x;
  if (y > bounds.maxY) bounds.maxY = y;
  bounds.width = Math.max(0, bounds.maxX - bounds.minX);
  bounds.height = Math.max(0, bounds.maxY - bounds.minY);
}

/**
 * Merges multiple bounding boxes into a single enclosing bounding box.
 */
export function mergeBounds(boxes: BoundingBox2D[]): BoundingBox2D {
  const merged = createEmptyBounds();
  for (const b of boxes) {
    if (b.minX <= b.maxX && b.minY <= b.maxY) {
      extendBounds(merged, b.minX, b.minY);
      extendBounds(merged, b.maxX, b.maxY);
    }
  }
  if (!Number.isFinite(merged.minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  return merged;
}

/**
 * CONTRACT: Approximate Visual Path Bounds.
 *
 * Interprets SVG path data commands to compute a conservative bounding box.
 * Evaluates endpoints, Bézier control-point convex hulls (which strictly enclose
 * curve extrema), arc boundaries, and multiple subpaths.
 *
 * Supported commands:
 * - Absolute: M, L, H, V, C, S, Q, T, A, Z
 * - Relative: m, l, h, v, c, s, q, t, a, z
 * - Scientific notation (e.g. -1.2e-3, 4.5e2)
 * - Negative values and decimals
 * - Stroke width expansion
 */
export function computeApproximatePathBounds(
  d?: string | null,
  strokeWidth: number = 0
): BoundingBox2D {
  if (!d || typeof d !== "string") {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  const bounds = createEmptyBounds();

  // Tokenize commands and floating point numbers (supporting decimals, signs, scientific notation)
  const tokenRegex = /([a-zA-Z])|([-+]?(?:[0-9]*\.[0-9]+|[0-9]+)(?:[eE][-+]?[0-9]+)?)/g;
  const tokens: Array<{ type: "cmd" | "num"; val: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(d)) !== null) {
    if (match[1]) {
      tokens.push({ type: "cmd", val: match[1] });
    } else if (match[2]) {
      tokens.push({ type: "num", val: match[2] });
    }
  }

  let curX = 0;
  let curY = 0;
  let subStartX = 0;
  let subStartY = 0;
  let idx = 0;
  let currentCmd = "";

  while (idx < tokens.length) {
    const t = tokens[idx];
    if (t.type === "cmd") {
      currentCmd = t.val;
      idx++;
    }

    if (idx >= tokens.length && currentCmd !== "Z" && currentCmd !== "z") {
      break;
    }

    switch (currentCmd) {
      case "M": {
        // MoveTo absolute: x, y
        if (idx + 1 < tokens.length && tokens[idx].type === "num" && tokens[idx + 1].type === "num") {
          curX = parseFloat(tokens[idx++].val);
          curY = parseFloat(tokens[idx++].val);
          subStartX = curX;
          subStartY = curY;
          extendBounds(bounds, curX, curY);
          currentCmd = "L"; // subsequent numbers treated as implicit LineTo
        } else {
          idx++;
        }
        break;
      }
      case "m": {
        // MoveTo relative: dx, dy
        if (idx + 1 < tokens.length && tokens[idx].type === "num" && tokens[idx + 1].type === "num") {
          curX += parseFloat(tokens[idx++].val);
          curY += parseFloat(tokens[idx++].val);
          subStartX = curX;
          subStartY = curY;
          extendBounds(bounds, curX, curY);
          currentCmd = "l";
        } else {
          idx++;
        }
        break;
      }
      case "L": {
        // LineTo absolute: x, y
        if (idx + 1 < tokens.length && tokens[idx].type === "num" && tokens[idx + 1].type === "num") {
          curX = parseFloat(tokens[idx++].val);
          curY = parseFloat(tokens[idx++].val);
          extendBounds(bounds, curX, curY);
        } else {
          idx++;
        }
        break;
      }
      case "l": {
        // LineTo relative: dx, dy
        if (idx + 1 < tokens.length && tokens[idx].type === "num" && tokens[idx + 1].type === "num") {
          curX += parseFloat(tokens[idx++].val);
          curY += parseFloat(tokens[idx++].val);
          extendBounds(bounds, curX, curY);
        } else {
          idx++;
        }
        break;
      }
      case "H": {
        // Horizontal LineTo absolute: x
        if (tokens[idx].type === "num") {
          curX = parseFloat(tokens[idx++].val);
          extendBounds(bounds, curX, curY);
        } else {
          idx++;
        }
        break;
      }
      case "h": {
        // Horizontal LineTo relative: dx
        if (tokens[idx].type === "num") {
          curX += parseFloat(tokens[idx++].val);
          extendBounds(bounds, curX, curY);
        } else {
          idx++;
        }
        break;
      }
      case "V": {
        // Vertical LineTo absolute: y
        if (tokens[idx].type === "num") {
          curY = parseFloat(tokens[idx++].val);
          extendBounds(bounds, curX, curY);
        } else {
          idx++;
        }
        break;
      }
      case "v": {
        // Vertical LineTo relative: dy
        if (tokens[idx].type === "num") {
          curY += parseFloat(tokens[idx++].val);
          extendBounds(bounds, curX, curY);
        } else {
          idx++;
        }
        break;
      }
      case "C": {
        // Cubic Bézier absolute: x1, y1, x2, y2, x, y
        if (idx + 5 < tokens.length) {
          const x1 = parseFloat(tokens[idx++].val);
          const y1 = parseFloat(tokens[idx++].val);
          const x2 = parseFloat(tokens[idx++].val);
          const y2 = parseFloat(tokens[idx++].val);
          curX = parseFloat(tokens[idx++].val);
          curY = parseFloat(tokens[idx++].val);
          // Control point convex hull strictly encloses Bézier curve extrema
          extendBounds(bounds, x1, y1);
          extendBounds(bounds, x2, y2);
          extendBounds(bounds, curX, curY);
        } else {
          idx++;
        }
        break;
      }
      case "c": {
        // Cubic Bézier relative: dx1, dy1, dx2, dy2, dx, dy
        if (idx + 5 < tokens.length) {
          const x1 = curX + parseFloat(tokens[idx++].val);
          const y1 = curY + parseFloat(tokens[idx++].val);
          const x2 = curX + parseFloat(tokens[idx++].val);
          const y2 = curY + parseFloat(tokens[idx++].val);
          curX += parseFloat(tokens[idx++].val);
          curY += parseFloat(tokens[idx++].val);
          extendBounds(bounds, x1, y1);
          extendBounds(bounds, x2, y2);
          extendBounds(bounds, curX, curY);
        } else {
          idx++;
        }
        break;
      }
      case "S": {
        // Smooth Cubic Bézier absolute: x2, y2, x, y
        if (idx + 3 < tokens.length) {
          const x2 = parseFloat(tokens[idx++].val);
          const y2 = parseFloat(tokens[idx++].val);
          curX = parseFloat(tokens[idx++].val);
          curY = parseFloat(tokens[idx++].val);
          extendBounds(bounds, x2, y2);
          extendBounds(bounds, curX, curY);
        } else {
          idx++;
        }
        break;
      }
      case "s": {
        // Smooth Cubic Bézier relative: dx2, dy2, dx, dy
        if (idx + 3 < tokens.length) {
          const x2 = curX + parseFloat(tokens[idx++].val);
          const y2 = curY + parseFloat(tokens[idx++].val);
          curX += parseFloat(tokens[idx++].val);
          curY += parseFloat(tokens[idx++].val);
          extendBounds(bounds, x2, y2);
          extendBounds(bounds, curX, curY);
        } else {
          idx++;
        }
        break;
      }
      case "Q": {
        // Quadratic Bézier absolute: x1, y1, x, y
        if (idx + 3 < tokens.length) {
          const x1 = parseFloat(tokens[idx++].val);
          const y1 = parseFloat(tokens[idx++].val);
          curX = parseFloat(tokens[idx++].val);
          curY = parseFloat(tokens[idx++].val);
          extendBounds(bounds, x1, y1);
          extendBounds(bounds, curX, curY);
        } else {
          idx++;
        }
        break;
      }
      case "q": {
        // Quadratic Bézier relative: dx1, dy1, dx, dy
        if (idx + 3 < tokens.length) {
          const x1 = curX + parseFloat(tokens[idx++].val);
          const y1 = curY + parseFloat(tokens[idx++].val);
          curX += parseFloat(tokens[idx++].val);
          curY += parseFloat(tokens[idx++].val);
          extendBounds(bounds, x1, y1);
          extendBounds(bounds, curX, curY);
        } else {
          idx++;
        }
        break;
      }
      case "T": {
        // Smooth Quadratic Bézier absolute: x, y
        if (idx + 1 < tokens.length) {
          curX = parseFloat(tokens[idx++].val);
          curY = parseFloat(tokens[idx++].val);
          extendBounds(bounds, curX, curY);
        } else {
          idx++;
        }
        break;
      }
      case "t": {
        // Smooth Quadratic Bézier relative: dx, dy
        if (idx + 1 < tokens.length) {
          curX += parseFloat(tokens[idx++].val);
          curY += parseFloat(tokens[idx++].val);
          extendBounds(bounds, curX, curY);
        } else {
          idx++;
        }
        break;
      }
      case "A": {
        // Elliptical Arc absolute: rx, ry, x-axis-rotation, large-arc-flag, sweep-flag, x, y
        if (idx + 6 < tokens.length) {
          const rx = Math.abs(parseFloat(tokens[idx++].val));
          const ry = Math.abs(parseFloat(tokens[idx++].val));
          idx += 3; // rot, largeArc, sweep
          curX = parseFloat(tokens[idx++].val);
          curY = parseFloat(tokens[idx++].val);
          extendBounds(bounds, curX - rx, curY - ry);
          extendBounds(bounds, curX + rx, curY + ry);
          extendBounds(bounds, curX, curY);
        } else {
          idx++;
        }
        break;
      }
      case "a": {
        // Elliptical Arc relative: rx, ry, x-axis-rotation, large-arc-flag, sweep-flag, dx, dy
        if (idx + 6 < tokens.length) {
          const rx = Math.abs(parseFloat(tokens[idx++].val));
          const ry = Math.abs(parseFloat(tokens[idx++].val));
          idx += 3; // rot, largeArc, sweep
          curX += parseFloat(tokens[idx++].val);
          curY += parseFloat(tokens[idx++].val);
          extendBounds(bounds, curX - rx, curY - ry);
          extendBounds(bounds, curX + rx, curY + ry);
          extendBounds(bounds, curX, curY);
        } else {
          idx++;
        }
        break;
      }
      case "Z":
      case "z": {
        // ClosePath: closes back to current subpath origin
        curX = subStartX;
        curY = subStartY;
        extendBounds(bounds, curX, curY);
        break;
      }
      default: {
        idx++;
        break;
      }
    }
  }

  if (!Number.isFinite(bounds.minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  // Expand bounds for stroke width if specified
  if (strokeWidth > 0) {
    const half = strokeWidth / 2;
    bounds.minX -= half;
    bounds.maxX += half;
    bounds.minY -= half;
    bounds.maxY += half;
    bounds.width = bounds.maxX - bounds.minX;
    bounds.height = bounds.maxY - bounds.minY;
  }

  return bounds;
}

/**
 * Backward compatibility alias for computeApproximatePathBounds.
 */
export const computePathBounds = computeApproximatePathBounds;

/**
 * Checks if a candidate element ID matches the target feature ID with delimiter safety.
 *
 * Supported relationships:
 * 1. Exact equality: candidateId === targetFeatureId
 * 2. Delimiter-safe child suffix: candidateId.startsWith(`${targetFeatureId}::child::`)
 * 3. Legacy child suffix: candidateId.startsWith(`${targetFeatureId}-`) where remainder
 *    identifies a child component (floret, leaf, bud, shoot, berry, grain, petal, stem, sub)
 *
 * Invariant: Never matches unrelated IDs where targetFeatureId is merely an arbitrary
 * substring (e.g. "ev-1" will never match "ev-10" or "ev-100").
 */
export function isMatchingFeatureId(candidateId: string, targetFeatureId: string): boolean {
  if (!candidateId || !targetFeatureId) return false;
  if (candidateId === targetFeatureId) return true;
  if (candidateId.startsWith(`${targetFeatureId}::child::`)) return true;

  // Legacy SVG generator child suffixes (e.g. ${fid}-floret-${i}, ${fid}-leaf-${i})
  const legacyPrefix = `${targetFeatureId}-`;
  if (candidateId.startsWith(legacyPrefix)) {
    const remainder = candidateId.slice(legacyPrefix.length);
    if (
      remainder.startsWith("floret") ||
      remainder.startsWith("leaf") ||
      remainder.startsWith("bud") ||
      remainder.startsWith("stem") ||
      remainder.startsWith("shoot") ||
      remainder.startsWith("berry") ||
      remainder.startsWith("grain") ||
      remainder.startsWith("petal") ||
      remainder.startsWith("sub")
    ) {
      return true;
    }
  }
  return false;
}

export interface FeatureHighlightResult {
  cx: number;
  cy: number;
  r: number;
  bounds: BoundingBox2D;
}

/**
 * Resolves the conservative approximate bounding box and center coordinate
 * for ANY earned feature within a GeneratedGardenSVGScene.
 */
export function resolveFeatureBoundsFromScene(
  scene: GeneratedGardenSVGScene,
  highlightFeatureId?: string | null
): FeatureHighlightResult | null {
  if (!highlightFeatureId || !scene) return null;

  const childBounds: BoundingBox2D[] = [];

  // 1. Blossoms
  for (const b of scene.blossoms || []) {
    if (isMatchingFeatureId(b.id, highlightFeatureId)) {
      const r = b.r || 10;
      childBounds.push({
        minX: b.cx - r,
        minY: b.cy - r,
        maxX: b.cx + r,
        maxY: b.cy + r,
        width: r * 2,
        height: r * 2,
      });
    }
  }

  // 2. Foliage clusters (single leaves and foliage groups)
  for (const f of scene.foliageClusters || []) {
    if (isMatchingFeatureId(f.id, highlightFeatureId)) {
      const pb = computeApproximatePathBounds(f.d);
      if (pb.width > 0 || pb.height > 0) {
        childBounds.push(pb);
      }
    }
  }

  // 3. Canopy details (paired shoots, twig shoots, buds, berries, leaves)
  for (const c of scene.canopyDetails || []) {
    if (isMatchingFeatureId(c.id, highlightFeatureId)) {
      if (c.stemPath) {
        childBounds.push(computeApproximatePathBounds(c.stemPath, c.stemWidth || 1.5));
      }
      if (c.leaves && c.leaves.length > 0) {
        for (const l of c.leaves) {
          childBounds.push(computeApproximatePathBounds(l.d));
        }
      }
      if (c.buds && c.buds.length > 0) {
        for (const bud of c.buds) {
          const rx = bud.rx || 6;
          const ry = bud.ry || 8;
          childBounds.push({
            minX: bud.cx - rx,
            minY: bud.cy - ry,
            maxX: bud.cx + rx,
            maxY: bud.cy + ry,
            width: rx * 2,
            height: ry * 2,
          });
        }
      }
      if (c.berries && c.berries.length > 0) {
        for (const ber of c.berries) {
          const rx = ber.rx || 5;
          const ry = ber.ry || 5;
          childBounds.push({
            minX: ber.cx - rx,
            minY: ber.cy - ry,
            maxX: ber.cx + rx,
            maxY: ber.cy + ry,
            width: rx * 2,
            height: ry * 2,
          });
        }
      }
    }
  }

  // 4. Seed pods
  for (const p of scene.seedPods || []) {
    if (isMatchingFeatureId(p.id, highlightFeatureId)) {
      const rx = p.rx || 6;
      const ry = p.ry || 8;
      childBounds.push({
        minX: p.cx - rx,
        minY: p.cy - ry,
        maxX: p.cx + rx,
        maxY: p.cy + ry,
        width: rx * 2,
        height: ry * 2,
      });
    }
  }

  // 5. Ground details (flowers, ferns, clover, seed heads, herbs, sprouts)
  for (const g of scene.groundDetails || []) {
    if (isMatchingFeatureId(g.id, highlightFeatureId)) {
      if (typeof g.cx === "number" && typeof g.cy === "number") {
        const rx = g.rx || 8;
        const ry = g.ry || 8;
        childBounds.push({
          minX: g.cx - rx,
          minY: g.cy - ry,
          maxX: g.cx + rx,
          maxY: g.cy + ry,
          width: rx * 2,
          height: ry * 2,
        });
      }
      if (g.d) {
        childBounds.push(computeApproximatePathBounds(g.d));
      }
      if (g.stemPath) {
        childBounds.push(computeApproximatePathBounds(g.stemPath));
      }
      if (g.leafPaths && g.leafPaths.length > 0) {
        for (const lp of g.leafPaths) {
          childBounds.push(computeApproximatePathBounds(lp.d));
        }
      }
      if (g.florets && g.florets.length > 0) {
        for (const fl of g.florets) {
          const r = fl.r || 4;
          childBounds.push({
            minX: fl.cx - r,
            minY: fl.cy - r,
            maxX: fl.cx + r,
            maxY: fl.cy + r,
            width: r * 2,
            height: r * 2,
          });
        }
      }
      if (g.seedGrains && g.seedGrains.length > 0) {
        for (const sg of g.seedGrains) {
          const rx = sg.rx || 2;
          const ry = sg.ry || 3;
          childBounds.push({
            minX: sg.cx - rx,
            minY: sg.cy - ry,
            maxX: sg.cx + rx,
            maxY: sg.cy + ry,
            width: rx * 2,
            height: ry * 2,
          });
        }
      }
    }
  }

  // 6. Habitat details (butterflies, pollinators, bird perches, nests)
  for (const h of scene.habitatDetails || []) {
    if (isMatchingFeatureId(h.id, highlightFeatureId)) {
      const radius = 14 * (h.scale || 1);
      childBounds.push({
        minX: h.cx - radius,
        minY: h.cy - radius,
        maxX: h.cx + radius,
        maxY: h.cy + radius,
        width: radius * 2,
        height: radius * 2,
      });
      if (h.stemPath) {
        childBounds.push(computeApproximatePathBounds(h.stemPath));
      }
    }
  }

  if (childBounds.length === 0) {
    return null;
  }

  const groupBounds = mergeBounds(childBounds);
  const cx = Math.round(((groupBounds.minX + groupBounds.maxX) / 2) * 10) / 10;
  const cy = Math.round(((groupBounds.minY + groupBounds.maxY) / 2) * 10) / 10;
  const halfDiag = Math.hypot(groupBounds.width, groupBounds.height) / 2;
  const r = Math.round(Math.max(12, Math.min(36, halfDiag * 1.15)) * 10) / 10;

  return {
    cx,
    cy,
    r,
    bounds: groupBounds,
  };
}
