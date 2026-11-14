/**
 * Purple Garden - Ambient Living Visual Behavior Contract
 *
 * Defines restrained, deterministic ambient life motion profiles:
 * - Gentle canopy breathing (subtle sine scale 0.995 to 1.005)
 * - Soft atmospheric sunbeam glimmer
 * - Still perched fauna with rare, restrained posture
 * - Stream water shimmer when a stream exists
 *
 * Invariants:
 * - Purely decorative animation with zero effect on growth units or events.
 * - Pauses completely when app/tab is backgrounded.
 * - Becomes completely still under reduced motion (prefers-reduced-motion) or resting mode.
 * - Zero uncontrolled Math.random() or gamified particle effects.
 */

export interface AmbientLifeContract {
  motionAllowed: boolean;
  canopyBreathingPeriodMs: number;
  lightGlimmerPeriodMs: number;
  streamShimmerEnabled: boolean;
  birdRestingBehavior: "still" | "perched_still";
  breathingAmplitudeScale: number; // e.g. 0.005 (0.5% oscillation)
  lightDriftPx: number; // e.g. 4px bounded drift
}

export interface DeriveAmbientLifeInput {
  isResting?: boolean;
  isReduceMotion?: boolean;
  isBackgrounded?: boolean;
  hasStream?: boolean;
}

/**
 * Derives ambient life configuration respecting system accessibility
 * and life-cycle invariants.
 */
export function deriveAmbientLifeContract(
  input: DeriveAmbientLifeInput
): AmbientLifeContract {
  const isResting = Boolean(input.isResting);
  const isReduceMotion = Boolean(input.isReduceMotion);
  const isBackgrounded = Boolean(input.isBackgrounded);

  const motionAllowed = !isResting && !isReduceMotion && !isBackgrounded;

  return {
    motionAllowed,
    canopyBreathingPeriodMs: 6000,
    lightGlimmerPeriodMs: 8000,
    streamShimmerEnabled: motionAllowed && Boolean(input.hasStream),
    birdRestingBehavior: "still",
    breathingAmplitudeScale: motionAllowed ? 0.005 : 0.0,
    lightDriftPx: motionAllowed ? 4.0 : 0.0,
  };
}
