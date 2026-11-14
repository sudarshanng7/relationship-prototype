/**
 * Purple Garden - Production Garden Visualizer (Unified Entrypoint)
 *
 * Re-exports the unified PainterlyGardenRenderer as the canonical GardenVisualizer.
 * Automatically delegates to ProceduralGardenRenderer for earlier stages (beginning through
 * rooted_flourishing) or when rendererMode="procedural" is active, while mounting the
 * verified painterly mature oak asset when garden_in_bloom is reached.
 */

export {
  PainterlyGardenRenderer as GardenVisualizer,
  type PainterlyGardenRendererProps as GardenVisualizerProps,
} from "./PainterlyGardenRenderer";

export {
  ProceduralGardenRenderer,
  type ProceduralGardenRendererProps,
} from "./ProceduralGardenRenderer";
