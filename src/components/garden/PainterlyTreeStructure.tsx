/**
 * Purple Garden - Painterly Tree Structure Compositor (Phase 1)
 *
 * Implements the physical structural compositor for the Living Garden:
 * - Natural 9-layer ground-contact & atmosphere integration
 * - Standard React Native Image (never react-native-svg raster Image with require)
 * - 100% physical opacity for structural wood (never ghost-like)
 * - Restrained organic root-contact shadow (sourceEvent = null, non-selectable)
 * - Foreground moss and meadow overlap bedding the roots into the soil
 * - Non-destructive lighting & color harmony (softened golden highlights, cool forest ambient)
 * - Shared canonical coordinate system & uniform scale anchored at soil baseline (y = 441.0)
 * - Strict stage eligibility (master ancient oak for garden_in_bloom and QA calibration only)
 * - Calibrated composition presets: full_structure, balanced_overview, focused_compact, explore_world, story_frame
 */

import React, { useId } from "react";
import {
  Image as RNImage,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import type {
  BoundingBox2D,
  GardenAtmosphereTone,
  GardenStructuralPresentation,
  TreeCompositionPresetName,
} from "@/lib/garden/world-types";
import type { CanonicalStageKeyOrBeginning } from "@/lib/garden/stage-contracts";
import type { PainterlyCoupleDNA } from "@/lib/garden/couple-dna";
import {
  CANONICAL_SCENE_BOUNDS,
  TREE_COMPOSITION_PRESETS,
} from "@/lib/garden";
import type { GeneratedGardenSVGScene } from "@/lib/garden-generator";

// Master calibrated transparent ancient oak (1586x992 alpha PNG)
const OAK_MATURE_ASSET = require("../../../assets/garden/painterly/oak-structure-mature-alpha-v1.png");
// Calibrated transparent intermediate branching oak (1585x992 alpha PNG)
const OAK_BRANCHING_ASSET = require("../../../assets/garden/painterly/oak-structure-branching-alpha-v1.png");

export interface PainterlyTreeStructureProps {
  structuralAssetKey?: string | null;
  stageKey: CanonicalStageKeyOrBeginning;
  worldBounds?: BoundingBox2D;
  cameraTransform?: {
    scale?: number;
    translateX?: number;
    translateY?: number;
  };
  presentationMode?: "full" | "compact" | "explore" | "story";
  theme?: string;
  atmosphereTone?: GardenAtmosphereTone;
  reducedMotion?: boolean;
  cropPreset?: TreeCompositionPresetName;
  calibrationTransform?: {
    x?: number;
    y?: number;
    scale?: number;
    rotation?: number;
  };
  showGuides?: boolean;
  coupleDNA?: PainterlyCoupleDNA;
  presentation?: GardenStructuralPresentation;
  scene?: GeneratedGardenSVGScene;
  style?: StyleProp<ViewStyle>;
}

export function PainterlyTreeStructure({
  structuralAssetKey,
  stageKey,
  worldBounds = CANONICAL_SCENE_BOUNDS,
  cameraTransform,
  presentationMode = "full",
  theme = "light",
  atmosphereTone = "calm_light",
  reducedMotion = false,
  cropPreset = "balanced_overview",
  calibrationTransform,
  showGuides = false,
  coupleDNA,
  presentation,
  scene,
  style,
}: PainterlyTreeStructureProps) {
  const gradientId = useId().replace(/:/g, "_");

  // Determine whether this structure is eligible for the painterly mature oak asset
  const isMatureOakEligible =
    stageKey === "garden_in_bloom" ||
    structuralAssetKey === "painterly-oak-mature-v1" ||
    structuralAssetKey === "painterly-oak-structure-mature-v1";

  // Determine whether this structure is eligible for the painterly branching oak asset
  const isBranchingOakEligible =
    stageKey === "branching_out" &&
    (structuralAssetKey === "painterly-oak-branching-v1" ||
      structuralAssetKey === "painterly-oak-structure-branching-v1");

  // Active composition preset
  const activePreset =
    TREE_COMPOSITION_PRESETS[cropPreset] ||
    TREE_COMPOSITION_PRESETS.balanced_overview;

  const baseScale = activePreset.scale;
  const userScale = calibrationTransform?.scale ?? 1.0;
  const finalScale = baseScale * userScale;

  // Anchor point: soil baseline at y = 441.0, trunk origin at x = 390.4
  const pivotX = activePreset.centerOrigin.x;
  const pivotY = activePreset.centerOrigin.y;

  const offsetX = (calibrationTransform?.x ?? 0) + (1 - finalScale) * pivotX;
  const offsetY = (calibrationTransform?.y ?? 0) + (1 - finalScale) * pivotY;
  const rotation = calibrationTransform?.rotation ?? 0;

  // DNA structural variations (subtle organic lean and scale within bounds)
  const dnaScaleMultiplier = coupleDNA?.structuralVariation?.scaleMultiplier ?? 1.0;
  const dnaVerticalShift = coupleDNA?.structuralVariation?.verticalShiftPx ?? 0;

  return (
    <View
      style={[
        styles.container,
        {
          width: worldBounds.width,
          height: worldBounds.height,
        },
        style,
      ]}
      pointerEvents="box-none"
    >
      {/* ------------------------------------------------------------- */}
      {/* LAYER 2: REAR ATMOSPHERIC VEIL                                */}
      {/* Softens distant woodland backdrop behind the tree canopy      */}
      {/* ------------------------------------------------------------- */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor:
              theme === "dark"
                ? "rgba(15, 23, 42, 0.12)"
                : theme === "dim"
                ? "rgba(30, 25, 45, 0.08)"
                : "rgba(225, 235, 220, 0.07)",
            opacity: presentation?.atmosphericVeilOpacity ?? 0.08,
            pointerEvents: "none",
          },
        ]}
      />

      {/* ------------------------------------------------------------- */}
      {/* LAYER 3: REAR GROUND & CLEARING MOSS OVERLAP                 */}
      {/* Soft clearing ground contours behind the root flare           */}
      {/* ------------------------------------------------------------- */}
      <Svg
        style={StyleSheet.absoluteFill}
        viewBox={`0 0 ${worldBounds.width} ${worldBounds.height}`}
        pointerEvents="none"
      >
        <Defs>
          <RadialGradient
            id={`rearGroundGlow_${gradientId}`}
            cx="48%"
            cy="88%"
            r="40%"
          >
            <Stop offset="0%" stopColor="#4A5E35" stopOpacity={0.22} />
            <Stop offset="60%" stopColor="#354825" stopOpacity={0.12} />
            <Stop offset="100%" stopColor="#253518" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Path
          d="M 220 448 Q 320 436 400 439 T 580 447 Q 660 455 720 460 L 720 480 L 180 480 Z"
          fill={`url(#rearGroundGlow_${gradientId})`}
        />
      </Svg>

      {/* ------------------------------------------------------------- */}
      {/* LAYER 4: TREE STRUCTURE (100% PHYSICALLY OPAQUE)              */}
      {/* Either approved master ancient oak or honest young fallback    */}
      {/* ------------------------------------------------------------- */}
      <View
        style={[
          styles.structureGroup,
          {
            transform: [
              { translateX: offsetX },
              { translateY: offsetY + dnaVerticalShift },
              { scale: finalScale * dnaScaleMultiplier },
              { rotate: `${rotation}deg` },
            ],
            transformOrigin: "0px 0px",
          },
        ]}
        pointerEvents="box-none"
      >
        {isMatureOakEligible ? (
          /* Master 2.5D Calibrated Ancient Oak (Standard React Native Image) */
          <RNImage
            source={OAK_MATURE_ASSET}
            style={styles.matureOakImage}
            resizeMode="stretch"
          />
        ) : isBranchingOakEligible ? (
          /* Calibrated 2.5D Intermediate Branching Oak (Standard React Native Image) */
          <RNImage
            source={OAK_BRANCHING_ASSET}
            style={styles.branchingOakImage}
            resizeMode="stretch"
          />
        ) : (
          /* Honest Younger Procedural Structure (early stages or procedural fallback) */
          <Svg
            style={styles.proceduralSvg}
            viewBox={`0 0 ${worldBounds.width} ${worldBounds.height}`}
            pointerEvents="none"
          >
            <G id="honest-procedural-tree-structure" opacity={1.0}>
              {/* Roots merging into soil */}
              {scene?.rootPaths?.map((rootD, idx) => (
                <Path
                  key={`root-${idx}`}
                  d={rootD}
                  stroke={scene?.palette.trunk || "#4E3629"}
                  strokeWidth={4.0}
                  strokeLinecap="round"
                  fill="none"
                  opacity={1.0}
                />
              ))}
              {/* Trunk Shadow */}
              {scene?.trunkShadowPath && (
                <Path
                  d={scene.trunkShadowPath}
                  stroke={scene.palette.trunkShadow || "#34221A"}
                  strokeWidth={3.8}
                  strokeLinecap="round"
                  fill="none"
                  opacity={0.65}
                />
              )}
              {/* Trunk Body */}
              {scene?.trunkPath && (
                <Path
                  d={scene.trunkPath}
                  fill={scene?.palette.trunk || "#4E3629"}
                  opacity={1.0}
                />
              )}
              {/* Trunk Highlight */}
              {scene?.trunkHighlightPath && (
                <Path
                  d={scene.trunkHighlightPath}
                  stroke={scene?.palette.trunkHighlight || "#7D5840"}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  fill="none"
                  opacity={0.7}
                />
              )}
              {/* Bark Texture */}
              {scene?.barkTexturePaths?.map((bt) => (
                <Path
                  key={bt.id}
                  d={bt.d}
                  stroke={bt.color}
                  strokeWidth={bt.strokeWidth || 1.4}
                  strokeLinecap="round"
                  fill="none"
                  opacity={bt.opacity}
                />
              ))}
              {/* Branches for young tree */}
              {scene?.branches?.map((branchD, i) => (
                <Path
                  key={`branch-${i}`}
                  d={branchD}
                  fill={scene?.palette.trunk || "#4E3629"}
                  opacity={1.0}
                />
              ))}
              {/* Foliage Clusters for young tree (calibrated visual density) */}
              {scene?.foliageClusters?.map((cluster) => (
                <Path
                  key={cluster.id}
                  d={cluster.d}
                  fill={cluster.color}
                  opacity={0.88}
                />
              ))}
            </G>
          </Svg>
        )}
      </View>

      {/* ------------------------------------------------------------- */}
      {/* LAYER 5: ORGANIC ROOT-CONTACT SHADOW                          */}
      {/* Resting shadow hugging root flare: sourceEvent=null, non-selectable */}
      {/* ------------------------------------------------------------- */}
      <Svg
        style={StyleSheet.absoluteFill}
        viewBox={`0 0 ${worldBounds.width} ${worldBounds.height}`}
        pointerEvents="none"
      >
        <Defs>
          <RadialGradient
            id={`rootContactShadow_${gradientId}`}
            cx="48%"
            cy="89%"
            r="35%"
          >
            <Stop offset="0%" stopColor="#1B2414" stopOpacity={0.42} />
            <Stop offset="45%" stopColor="#25311B" stopOpacity={0.24} />
            <Stop offset="80%" stopColor="#303E23" stopOpacity={0.08} />
            <Stop offset="100%" stopColor="#303E23" stopOpacity={0} />
          </RadialGradient>
          <LinearGradient
            id={`rootAmbientOcclusion_${gradientId}`}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <Stop offset="0%" stopColor="#172010" stopOpacity={0} />
            <Stop offset="70%" stopColor="#172010" stopOpacity={0.32} />
            <Stop offset="100%" stopColor="#172010" stopOpacity={0.45} />
          </LinearGradient>
        </Defs>

        {/* Ambient occlusion bed immediately beneath main root spread */}
        <Path
          d="M 255 444 C 290 440, 340 442, 390 443 C 440 444, 490 441, 525 445 C 500 454, 430 458, 385 457 C 330 456, 280 452, 255 444 Z"
          fill={`url(#rootContactShadow_${gradientId})`}
        />

        {/* Organic contact crevices directly under buttress root forks */}
        <Path
          d="M 320 443 Q 345 446 370 444 T 425 445 Q 460 447 485 444 Q 455 450 420 449 T 340 448 Z"
          fill={`url(#rootAmbientOcclusion_${gradientId})`}
        />
      </Svg>

      {/* ------------------------------------------------------------- */}
      {/* LAYER 6: FOREGROUND MOSS & GRASS OVERLAP                       */}
      {/* Partially occludes lowest root tips: sourceEvent=null, non-selectable */}
      {/* ------------------------------------------------------------- */}
      <Svg
        style={StyleSheet.absoluteFill}
        viewBox={`0 0 ${worldBounds.width} ${worldBounds.height}`}
        pointerEvents="none"
      >
        <G id="foreground-moss-overlap" opacity={0.88}>
          {/* Left root flare moss cushion */}
          <Path
            d="M 268 446 C 275 442, 285 443, 296 445 C 304 444, 312 447, 318 448 C 308 450, 290 451, 268 446 Z"
            fill="#455B32"
          />
          {/* Center-left root tuft */}
          <Path
            d="M 335 446 C 342 443, 350 444, 358 447 C 352 449, 344 449, 335 446 Z"
            fill="#566F3E"
          />
          {/* Center-right soil overlap */}
          <Path
            d="M 405 447 C 414 444, 424 445, 434 448 C 426 450, 416 450, 405 447 Z"
            fill="#455B32"
          />
          {/* Far-right root tip gentle grass blades */}
          <Path
            d="M 482 446 C 490 443, 498 444, 508 447 C 500 450, 492 450, 482 446 Z"
            fill="#566F3E"
          />
          {/* Fine meadow blades bedding roots into clearing soil */}
          <Path
            d="M 285 446 L 288 440 L 291 446 M 345 447 L 348 441 L 351 447 M 420 448 L 423 442 L 426 448 M 495 447 L 497 442 L 500 447"
            stroke="#638048"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </G>
      </Svg>

      {/* ------------------------------------------------------------- */}
      {/* LIGHTING & COLOR HARMONY: NON-DESTRUCTIVE CROSS-PLATFORM VEILS */}
      {/* Softens golden highlights, cool forest ambient, edge vignette */}
      {/* ------------------------------------------------------------- */}
      {isMatureOakEligible && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* Highlight softening: gentle daylight wash */}
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: "rgba(220, 230, 215, 0.05)",
                pointerEvents: "none",
              },
            ]}
          />
          {/* Shadow-side forest-green ambient veil */}
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: "rgba(40, 58, 36, 0.04)",
                pointerEvents: "none",
              },
            ]}
          />
        </View>
      )}

      {/* ------------------------------------------------------------- */}
      {/* CALIBRATION GUIDES (Development Structure-Calibration Only)   */}
      {/* ------------------------------------------------------------- */}
      {showGuides && (
        <Svg
          style={StyleSheet.absoluteFill}
          viewBox={`0 0 ${worldBounds.width} ${worldBounds.height}`}
          pointerEvents="none"
        >
          {/* Soil Baseline at y = 441.0 */}
          <Path
            d="M 0 441.0 L 800 441.0"
            stroke="#38BDF8"
            strokeWidth={1.5}
            strokeDasharray="6,4"
          />
          <SvgText
            x={16}
            y={436}
            fill="#38BDF8"
            fontSize={11}
            fontWeight="600"
          >
            Soil Baseline: y = 441.0
          </SvgText>

          {/* Trunk Origin at x = 390.4 */}
          <Path
            d="M 390.4 0 L 390.4 500"
            stroke="#F43F5E"
            strokeWidth={1.5}
            strokeDasharray="6,4"
          />
          <SvgText
            x={395}
            y={24}
            fill="#F43F5E"
            fontSize={11}
            fontWeight="600"
          >
            Trunk Center: x = 390.4
          </SvgText>

          {/* Root Origin Marker (x = 390.4, y = 441.0) */}
          <Circle
            cx={390.4}
            cy={441.0}
            r={5}
            fill="#EF4444"
            stroke="#FFFFFF"
            strokeWidth={1.5}
          />
          <SvgText
            x={400}
            y={445}
            fill="#EF4444"
            fontSize={10}
            fontWeight="700"
          >
            Root Origin (390.4, 441.0)
          </SvgText>

          {/* Root Flare Bounds Box */}
          <Rect
            x={isBranchingOakEligible ? 312.7 : 264.8}
            y={isBranchingOakEligible ? 396.6 : 410.0}
            width={isBranchingOakEligible ? 155.4 : 251.7}
            height={isBranchingOakEligible ? 44.4 : 78.4}
            stroke="#A855F7"
            strokeWidth={1.2}
            strokeDasharray="4,4"
            fill="none"
          />
          <SvgText
            x={isBranchingOakEligible ? 315 : 270}
            y={isBranchingOakEligible ? 392 : 405}
            fill="#A855F7"
            fontSize={10}
            fontWeight="600"
          >
            {isBranchingOakEligible
              ? "Root Flare Bounds (155.4 x 44.4)"
              : "Root Flare Bounds (251.7 x 78.4)"}
          </SvgText>

          {/* Structural Framework Bounds Box */}
          <Rect
            x={isBranchingOakEligible ? 145.1 : 26.7}
            y={isBranchingOakEligible ? 56.9 : 7.1}
            width={isBranchingOakEligible ? 520.9 : 742.5}
            height={isBranchingOakEligible ? 384.1 : 481.3}
            stroke="#F59E0B"
            strokeWidth={1.0}
            strokeDasharray="5,5"
            fill="none"
          />
          <SvgText
            x={isBranchingOakEligible ? 150 : 32}
            y={isBranchingOakEligible ? 50 : 20}
            fill="#F59E0B"
            fontSize={10}
            fontWeight="600"
          >
            {isBranchingOakEligible
              ? "Structural Bounds (520.9 x 384.1)"
              : "Structural Bounds (742.5 x 481.3)"}
          </SvgText>
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    top: 0,
    overflow: "hidden",
  },
  structureGroup: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 800,
    height: 500,
  },
  matureOakImage: {
    width: 800,
    height: 500,
    opacity: 1.0, // 100% physically opaque structure
  },
  branchingOakImage: {
    position: "absolute",
    left: 9.33,
    top: -27.39,
    width: 800,
    height: 500.69,
    opacity: 1.0, // 100% physically opaque structure
  },
  proceduralSvg: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 800,
    height: 500,
  },
});
