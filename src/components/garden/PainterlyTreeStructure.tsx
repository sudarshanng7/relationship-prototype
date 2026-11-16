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
  Ellipse,
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
import type {
  CanonicalStageKeyOrBeginning,
  EarlyLifeSubphaseKey,
} from "@/lib/garden/stage-contracts";
import type { PainterlyCoupleDNA } from "@/lib/garden/couple-dna";
import {
  CANONICAL_SCENE_BOUNDS,
  EARLY_LIFE_PREVIEW_TARGET_SLOTS,
  isCanonicalBranchingAssetKey,
  isCanonicalMatureAssetKey,
  isCanonicalSaplingAssetKey,
  resolveTreePresentationTransform,
  STAGE_STRUCTURAL_ASSET_SLOTS,
  TREE_COMPOSITION_PRESETS,
} from "@/lib/garden";
import {
  createLeafVeinD,
  createOakLobedLeafD,
  type GeneratedGardenSVGScene,
} from "@/lib/garden-generator";

// Master calibrated transparent ancient oak (1586x992 alpha PNG)
const OAK_MATURE_ASSET = require("../../../assets/garden/painterly/oak-structure-mature-alpha-v1.png");
// Calibrated transparent intermediate branching oak (1585x992 alpha PNG)
const OAK_BRANCHING_ASSET = require("../../../assets/garden/painterly/oak-structure-branching-alpha-v1.png");
// Calibrated transparent small leafy oak sapling (1024x1536 alpha PNG)
const OAK_SAPLING_ASSET = require("../../../assets/garden/painterly/oak-structure-sapling-alpha-v1.png");
const OAK_ACORN_ASSET = require("../../../assets/garden/painterly/oak-acorn-planted-alpha-v1.png");
const OAK_SHOOT_ASSET = require("../../../assets/garden/painterly/oak-shoot-emerging-alpha-v1.png");
const OAK_SEEDLING_ASSET = require("../../../assets/garden/painterly/oak-seedling-alpha-v1.png");
// Calibrated painterly oak foliage cluster proof (837x858 alpha PNG)
const FOLIAGE_CLUSTER_ASSET = require("../../../assets/garden/painterly/foliage-oak-cluster-alpha-v1.png");

/**
 * Juvenile leaf flushes for the Branching Out interval. Coordinates are in
 * canonical structure space and terminate at verified outer twig regions of
 * the branching oak. They unlock gradually, so the stage visibly develops
 * toward Leafy Canopy without presenting a finished crown prematurely.
 */
const BRANCHING_FOLIAGE_FLUSHES = [
  { key: "leader", left: 357, top: 35, size: 54, rotation: "-4deg", unlockAt: 0.08 },
  { key: "left-upper", left: 207, top: 70, size: 58, rotation: "-28deg", unlockAt: 0.22 },
  { key: "right-upper", left: 535, top: 68, size: 58, rotation: "24deg", unlockAt: 0.36 },
  { key: "left-outer", left: 120, top: 151, size: 62, rotation: "-46deg", unlockAt: 0.52 },
  { key: "right-outer", left: 621, top: 142, size: 62, rotation: "42deg", unlockAt: 0.68 },
  { key: "left-inner", left: 276, top: 126, size: 52, rotation: "-17deg", unlockAt: 0.82 },
  { key: "right-inner", left: 464, top: 124, size: 52, rotation: "16deg", unlockAt: 0.94 },
] as const;

export interface PainterlyTreeStructureProps {
  structuralAssetKey?: string | null;
  stageKey: CanonicalStageKeyOrBeginning;
  totalGrowthUnits?: number;
  subphaseKey?: EarlyLifeSubphaseKey;
  foundationLevelProgress?: number;
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
  showFoliageProof?: boolean;
  coupleDNA?: PainterlyCoupleDNA;
  presentation?: GardenStructuralPresentation;
  scene?: GeneratedGardenSVGScene;
  style?: StyleProp<ViewStyle>;
}

export function PainterlyTreeStructure({
  structuralAssetKey,
  stageKey,
  totalGrowthUnits,
  subphaseKey,
  foundationLevelProgress,
  worldBounds = CANONICAL_SCENE_BOUNDS,
  cameraTransform,
  presentationMode = "full",
  theme = "light",
  atmosphereTone = "calm_light",
  reducedMotion = false,
  cropPreset = "middle_distance",
  calibrationTransform,
  showGuides = false,
  showFoliageProof,
  coupleDNA,
  presentation,
  scene,
  style,
}: PainterlyTreeStructureProps) {
  const gradientId = useId().replace(/:/g, "_");
  const isDev =
    typeof __DEV__ !== "undefined"
      ? Boolean(__DEV__)
      : process.env.NODE_ENV !== "production";

  // Determine effective early-life subphase if applicable
  const effectiveSubphase: EarlyLifeSubphaseKey | null =
    subphaseKey ||
    (stageKey === "beginning"
      ? "planted_acorn"
      : stageKey === "first_seedling"
      ? (totalGrowthUnits ?? 0) <= 8
        ? "emerging_shoot"
        : "small_seedling"
      : stageKey === "tender_sapling"
      ? "small_sapling"
      : null);

  // Determine whether this structure is eligible for the painterly mature oak asset
  const isMatureOakEligible =
    !subphaseKey &&
    (stageKey === "garden_in_bloom" ||
      isCanonicalMatureAssetKey(structuralAssetKey));

  // Determine whether this structure is eligible for the painterly branching oak asset
  const isBranchingOakEligible =
    !subphaseKey &&
    stageKey === "branching_out" &&
    isCanonicalBranchingAssetKey(structuralAssetKey);

  const effectiveShowFoliageProof =
    showFoliageProof !== undefined
      ? showFoliageProof
      : false;

  const branchingIntervalProgress = Math.max(
    0,
    Math.min(1, ((totalGrowthUnits ?? 36) - 36) / 20)
  );

  // Consolidated single transform source shared with renderer and geometry resolver
  const presentationTransform = resolveTreePresentationTransform({
    cropPreset,
    calibrationTransform,
    coupleDNA,
  });

  // Branching asset calibrated image placement derived dynamically from slot
  const branchingSlot = STAGE_STRUCTURAL_ASSET_SLOTS.branching_out;
  const branchingCal = branchingSlot?.calibrationTransform ?? {
    scale: 0.504732,
    translateX: 9.33,
    translateY: -27.39,
    rotation: 0,
  };
  const branchingWidth =
    (branchingSlot?.sourceDimensions?.width ?? 1585) * (branchingCal.scale ?? 0.504732);
  const branchingHeight =
    (branchingSlot?.sourceDimensions?.height ?? 992) * (branchingCal.scale ?? 0.504732);
  const branchingLeft = branchingCal.translateX ?? 9.33;
  const branchingTop = branchingCal.translateY ?? -27.39;

  // Small oak sapling asset calibrated image placement derived dynamically from slot
  const saplingSlot = STAGE_STRUCTURAL_ASSET_SLOTS.tender_sapling;
  const saplingCal = saplingSlot?.calibrationTransform ?? {
    scale: 0.083389,
    translateX: 349.54,
    translateY: 314.08,
    rotation: 0,
  };
  const saplingWidth =
    (saplingSlot?.sourceDimensions?.width ?? 1024) * (saplingCal.scale ?? 0.083389);
  const saplingHeight =
    (saplingSlot?.sourceDimensions?.height ?? 1536) * (saplingCal.scale ?? 0.083389);
  const saplingLeft = saplingCal.translateX ?? 349.54;
  const saplingTop = saplingCal.translateY ?? 314.08;

  // Determine whether this structure is eligible for the painterly small sapling raster asset
  const isSaplingRasterEligible =
    effectiveSubphase === "small_sapling" &&
    (structuralAssetKey === "painterly-sapling-v1" ||
      isCanonicalSaplingAssetKey(structuralAssetKey) ||
      saplingSlot?.status === "development_preview" ||
      saplingSlot?.status === "approved");

  const earlyLifeRasterSlot =
    effectiveSubphase && effectiveSubphase !== "small_sapling"
      ? EARLY_LIFE_PREVIEW_TARGET_SLOTS[effectiveSubphase]
      : null;
  const earlyLifeCalibration = earlyLifeRasterSlot?.calibrationTransform;
  const earlyLifeRasterSource =
    effectiveSubphase === "planted_acorn"
      ? OAK_ACORN_ASSET
      : effectiveSubphase === "emerging_shoot"
      ? OAK_SHOOT_ASSET
      : effectiveSubphase === "small_seedling"
      ? OAK_SEEDLING_ASSET
      : null;
  const isEarlyLifeRasterEligible =
    Boolean(earlyLifeRasterSlot?.fileExists) &&
    earlyLifeRasterSlot?.status === "development_preview" &&
    Boolean(earlyLifeRasterSource && earlyLifeCalibration);

  const boundedFoundationProgress = Math.max(
    0,
    Math.min(1, foundationLevelProgress ?? 1)
  );
  const earlyLifeGrowthScale =
    effectiveSubphase === "planted_acorn"
      ? 0.94 + boundedFoundationProgress * 0.06
      : effectiveSubphase === "emerging_shoot"
      ? 0.82 + boundedFoundationProgress * 0.18
      : 0.84 + boundedFoundationProgress * 0.16;

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
      {/* LAYER 4: TREE STRUCTURE & GROUNDING (SYNCHRONIZED TRANSFORM)   */}
      {/* Localized contact shadows, 100% opaque wood, & moss overlap   */}
      {/* ------------------------------------------------------------- */}
      <View
        style={[
          styles.structureGroup,
          {
            transform: [
              { translateX: presentationTransform.offsetX },
              { translateY: presentationTransform.offsetY },
              { scale: presentationTransform.totalScale },
              { rotate: `${presentationTransform.rotation}deg` },
            ],
            transformOrigin: "0px 0px",
          },
        ]}
        pointerEvents="box-none"
      >
        {/* ------------------------------------------------------------- */}
        {/* LAYER 5: ORGANIC ROOT-CONTACT SHADOWS & LOCALIZED GROUNDING   */}
        {/* Hugging individual root flares; shares presentation transform */}
        {/* ------------------------------------------------------------- */}
        <Svg
          style={StyleSheet.absoluteFill}
          viewBox="0 0 800 500"
          pointerEvents="none"
        >
          <Defs>
            <RadialGradient
              id={`rootContactShadow_${gradientId}`}
              cx="50%"
              cy="50%"
              r="50%"
            >
              <Stop offset="0%" stopColor="#121A0C" stopOpacity={0.48} />
              <Stop offset="55%" stopColor="#1E2814" stopOpacity={0.24} />
              <Stop offset="85%" stopColor="#2A371C" stopOpacity={0.06} />
              <Stop offset="100%" stopColor="#2A371C" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient
              id={`woodlandGroundShadow_${gradientId}`}
              cx="45%"
              cy="48%"
              r="48%"
            >
              <Stop offset="0%" stopColor="#17220E" stopOpacity={0.28} />
              <Stop offset="60%" stopColor="#223016" stopOpacity={0.12} />
              <Stop offset="100%" stopColor="#223016" stopOpacity={0} />
            </RadialGradient>
            <LinearGradient
              id={`rootCreviceAO_${gradientId}`}
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <Stop offset="0%" stopColor="#10180B" stopOpacity={0.10} />
              <Stop offset="65%" stopColor="#10180B" stopOpacity={0.35} />
              <Stop offset="100%" stopColor="#10180B" stopOpacity={0.55} />
            </LinearGradient>
          </Defs>

          {/* Soft, localized ambient tree shadow (no broad horizontal dark band across clearing) */}
          {effectiveSubphase === "planted_acorn" ? (
            <Ellipse
              cx={390.4}
              cy={441.5}
              rx={6.5}
              ry={1.8}
              fill={`url(#woodlandGroundShadow_${gradientId})`}
              opacity={0.4}
            />
          ) : effectiveSubphase === "emerging_shoot" ? (
            <Ellipse
              cx={390.4}
              cy={441.2}
              rx={6.0}
              ry={1.8}
              fill={`url(#woodlandGroundShadow_${gradientId})`}
              opacity={0.4}
            />
          ) : effectiveSubphase === "small_seedling" ? (
            <Ellipse
              cx={390.4}
              cy={441.2}
              rx={6.5}
              ry={1.8}
              fill={`url(#woodlandGroundShadow_${gradientId})`}
              opacity={0.4}
            />
          ) : effectiveSubphase === "small_sapling" ? (
            <Ellipse
              cx={390.4}
              cy={441.0}
              rx={16.0}
              ry={4.0}
              fill={`url(#woodlandGroundShadow_${gradientId})`}
              opacity={0.45}
            />
          ) : isBranchingOakEligible ? (
            <Ellipse
              cx={390.4}
              cy={440.0}
              rx={95}
              ry={14}
              fill={`url(#woodlandGroundShadow_${gradientId})`}
              opacity={0.55}
            />
          ) : (
            <Path
              d="M 245 442 C 290 439, 350 440, 445 443 C 530 444, 555 450, 520 457 C 460 462, 330 459, 245 450 Z"
              fill={`url(#woodlandGroundShadow_${gradientId})`}
            />
          )}

          {/* Localized contact shadows under individual root tips, stems or seed */}
          {effectiveSubphase === "planted_acorn" ? (
            <G id="acorn-contact-shadow">
              <Ellipse
                cx={390.4}
                cy={441.5}
                rx={5.2}
                ry={1.4}
                fill={`url(#rootContactShadow_${gradientId})`}
                opacity={0.6}
              />
            </G>
          ) : effectiveSubphase === "emerging_shoot" ? (
            <G id="shoot-contact-shadow">
              <Ellipse
                cx={390.4}
                cy={441.2}
                rx={4.8}
                ry={1.4}
                fill={`url(#rootContactShadow_${gradientId})`}
                opacity={0.6}
              />
            </G>
          ) : effectiveSubphase === "small_seedling" ? (
            <G id="seedling-contact-shadow">
              <Ellipse
                cx={390.4}
                cy={441.2}
                rx={5.2}
                ry={1.4}
                fill={`url(#rootContactShadow_${gradientId})`}
                opacity={0.6}
              />
            </G>
          ) : effectiveSubphase === "small_sapling" ? (
            <G id="sapling-contact-shadow">
              <Ellipse
                cx={390.4}
                cy={441.0}
                rx={9.5}
                ry={2.5}
                fill={`url(#rootContactShadow_${gradientId})`}
                opacity={0.6}
              />
            </G>
          ) : isBranchingOakEligible ? (
            <G id="branching-root-contact-shadows">
              {/* Root 1: Left distal root tip (x: 322-332, y: 435.5) */}
              <Path
                d="M 321 435.5 C 324 434.8, 330 434.8, 333 435.5 C 330 436.8, 324 436.8, 321 435.5 Z"
                fill={`url(#rootContactShadow_${gradientId})`}
              />
              {/* Root 2: Left buttress tip (x: 348-355, y: 440.5) */}
              <Path
                d="M 347 440.5 C 350 439.6, 355 439.6, 357 440.5 C 354 441.8, 349 441.8, 347 440.5 Z"
                fill={`url(#rootContactShadow_${gradientId})`}
              />
              {/* Root 3: Central collar base (x: 380-396, y: 439.5) */}
              <Path
                d="M 380 439.5 C 385 438.7, 395 438.7, 400 439.5 C 395 441.0, 385 441.0, 380 439.5 Z"
                fill={`url(#rootContactShadow_${gradientId})`}
              />
              {/* Root 4: Right buttress tip (x: 417-423, y: 441.0) */}
              <Path
                d="M 416 441.0 C 419 440.2, 423 440.2, 425 441.0 C 423 442.2, 418 442.2, 416 441.0 Z"
                fill={`url(#rootContactShadow_${gradientId})`}
              />
              {/* Root 5: Right middle root (x: 428-440, y: 438.5) */}
              <Path
                d="M 428 438.5 C 432 437.8, 439 437.8, 442 438.5 C 438 439.8, 431 439.8, 428 438.5 Z"
                fill={`url(#rootContactShadow_${gradientId})`}
              />
              {/* Root 6: Right distal root tip (x: 452-466, y: 432.0) */}
              <Path
                d="M 452 432.0 C 456 431.2, 464 431.2, 467 432.0 C 463 433.2, 455 433.2, 452 432.0 Z"
                fill={`url(#rootContactShadow_${gradientId})`}
              />
              {/* Subtle ambient crevice between buttresses */}
              <Path
                d="M 350 440.8 Q 370 441.6 390.4 441.0 T 422 441.2 Q 406 442.2 390.4 441.8 T 350 440.8 Z"
                fill={`url(#rootCreviceAO_${gradientId})`}
              />
            </G>
          ) : (
            <G id="mature-root-contact-shadows">
              <Path
                d="M 255 444 C 290 440, 340 442, 390 443 C 440 444, 490 441, 525 445 C 500 454, 430 458, 385 457 C 330 456, 280 452, 255 444 Z"
                fill={`url(#rootContactShadow_${gradientId})`}
              />
              <Path
                d="M 320 443 Q 345 446 370 444 T 425 445 Q 460 447 485 444 Q 455 450 420 449 T 340 448 Z"
                fill={`url(#rootCreviceAO_${gradientId})`}
              />
            </G>
          )}
        </Svg>

        {isMatureOakEligible ? (
          /* Master 2.5D Calibrated Ancient Oak (Standard React Native Image) */
          <RNImage
            source={OAK_MATURE_ASSET}
            style={styles.matureOakImage}
            resizeMode="stretch"
          />
        ) : isBranchingOakEligible ? (
          <>
            {/* Calibrated 2.5D Intermediate Branching Oak */}
            <RNImage
              source={OAK_BRANCHING_ASSET}
              style={[
                styles.branchingOakImage,
                {
                  left: branchingLeft,
                  top: branchingTop,
                  width: branchingWidth,
                  height: branchingHeight,
                },
              ]}
              resizeMode="stretch"
            />

            {/* Stage-progressive juvenile oak flushes at real twig endpoints. */}
            {BRANCHING_FOLIAGE_FLUSHES.map((flush) => {
              const reveal = Math.max(
                0,
                Math.min(1, (branchingIntervalProgress - flush.unlockAt) / 0.14)
              );
              if (reveal <= 0) return null;

              const renderedSize = flush.size * (0.84 + reveal * 0.16);

              return (
                <View
                  key={flush.key}
                  style={[
                    styles.branchingFoliageFlush,
                    {
                      left: flush.left,
                      top: flush.top,
                      width: renderedSize,
                      height: renderedSize * 0.76,
                      opacity: 0.58 + reveal * 0.34,
                      transform: [{ rotate: flush.rotation }],
                    },
                  ]}
                  pointerEvents="none"
                >
                  <RNImage
                    source={FOLIAGE_CLUSTER_ASSET}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      width: renderedSize,
                      height: renderedSize,
                    }}
                    resizeMode="contain"
                  />
                </View>
              );
            })}
          </>
        ) : isSaplingRasterEligible ? (
          /* Calibrated 2.5D Small Oak Sapling Raster Asset */
          <RNImage
            source={OAK_SAPLING_ASSET}
            style={[
              styles.saplingOakImage,
              {
                left: saplingLeft,
                top: saplingTop,
                width: saplingWidth,
                height: saplingHeight,
              },
            ]}
            resizeMode="stretch"
          />
        ) : isEarlyLifeRasterEligible && earlyLifeRasterSlot && earlyLifeCalibration ? (
          /* Calibrated realistic early-life oak raster; procedural branches remain the safe fallback. */
          <RNImage
            source={earlyLifeRasterSource}
            style={[
              styles.earlyLifeOakImage,
              {
                left:
                  390.4 -
                  earlyLifeRasterSlot.sourceContactPoint.x *
                    earlyLifeCalibration.scale *
                    earlyLifeGrowthScale,
                top:
                  441.0 -
                  earlyLifeRasterSlot.sourceContactPoint.y *
                    earlyLifeCalibration.scale *
                    earlyLifeGrowthScale,
                width:
                  earlyLifeRasterSlot.sourceDimensions.width *
                  earlyLifeCalibration.scale *
                  earlyLifeGrowthScale,
                height:
                  earlyLifeRasterSlot.sourceDimensions.height *
                  earlyLifeCalibration.scale *
                  earlyLifeGrowthScale,
              },
            ]}
            resizeMode="stretch"
          />
        ) : effectiveSubphase === "planted_acorn" ? (
          /* Bounded Planted Acorn SVG rooted at (390.4, 441.0) */
          <Svg
            style={styles.proceduralSvg}
            viewBox={`0 0 ${worldBounds.width} ${worldBounds.height}`}
            pointerEvents="none"
          >
            <G id="planted-acorn-structure">
              {/* Subterranean radicle tip entering earth at (390.4, 441.0) */}
              <Path
                d="M 390.4 440.8 C 390.8 441.8, 391.2 442.8, 391.0 443.5"
                stroke="#D8C8A8"
                strokeWidth={1.0}
                strokeLinecap="round"
                opacity={0.85}
              />
              {/* Acorn cupule (cap) on left */}
              <Path
                d="M 384.0 440.2 C 383.0 437.5, 385.5 435.0, 388.5 435.5 C 389.0 437.5, 388.5 440.0, 386.0 441.0 Z"
                fill="#4A3520"
              />
              {/* Textured cupule scales */}
              <Path
                d="M 385.2 437.5 C 386.0 436.8, 387.2 437.0, 387.8 438.0"
                stroke="#3A2718"
                strokeWidth={0.8}
                strokeLinecap="round"
                fill="none"
              />
              {/* Acorn nut body on right */}
              <Path
                d="M 388.0 435.8 C 392.5 436.2, 396.0 438.5, 396.5 440.2 C 395.5 441.5, 391.0 441.6, 387.5 440.8 Z"
                fill="#784E2A"
              />
              {/* Subtle gloss highlight on nut body */}
              <Path
                d="M 389.0 437.0 C 392.0 437.2, 394.5 438.5, 395.0 439.5"
                stroke="#9C683B"
                strokeWidth={0.8}
                strokeLinecap="round"
                fill="none"
                opacity={0.75}
              />
            </G>
          </Svg>
        ) : effectiveSubphase === "emerging_shoot" ? (
          /* Bounded Emerging Shoot SVG rising 25px from (390.4, 441.0) */
          /* Hypogeal germination: Acorn settled in soil, cotyledons inside acorn, slender epicotyl with terminal bud & folded first true leaves */
          <Svg
            style={styles.proceduralSvg}
            viewBox={`0 0 ${worldBounds.width} ${worldBounds.height}`}
            pointerEvents="none"
          >
            <G id="emerging-shoot-structure">
              {/* Acorn settled in soil at (390.4, 441.0) retaining cotyledons */}
              {/* Acorn body */}
              <Path
                d="M 387.5 441.2 C 386.0 439.0, 388.5 437.0, 391.8 437.5 C 394.5 438.0, 396.0 440.0, 394.5 441.5 C 392.0 442.2, 389.0 442.0, 387.5 441.2 Z"
                fill="#784E2A"
              />
              <Path
                d="M 388.5 438.2 C 391.0 437.8, 393.5 438.8, 394.0 440.0 C 392.5 440.6, 390.0 440.2, 388.5 438.2 Z"
                fill="#9C683B"
                opacity={0.6}
              />
              {/* Acorn cupule cap on left */}
              <Path
                d="M 384.5 441.0 C 383.8 439.2, 385.0 437.5, 387.5 437.5 C 388.2 439.0, 388.0 440.8, 386.5 441.4 Z"
                fill="#4A3520"
              />
              <Path
                d="M 385.2 438.8 C 385.8 438.2, 386.8 438.5, 387.2 439.2"
                stroke="#3A2718"
                strokeWidth={0.7}
                fill="none"
              />

              {/* Slender emerging epicotyl rising from acorn at (390.4, 441.0) to apex (390.4, 416.0) */}
              {/* Lower epicotyl with reddish-woody seedling flush tint (#7E5434) */}
              <Path
                d="M 390.4 441.0 C 389.8 433.0, 391.0 426.0, 390.4 416.0"
                stroke="#647E36"
                strokeWidth={2.0}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d="M 390.4 441.0 C 390.1 436.0, 390.6 431.0, 390.4 427.0"
                stroke="#7E5434"
                strokeWidth={1.8}
                strokeLinecap="round"
                fill="none"
                opacity={0.8}
              />
              {/* Epicotyl highlight */}
              <Path
                d="M 390.1 438.0 C 389.7 432.0, 390.7 424.0, 390.2 417.0"
                stroke="#9EBF58"
                strokeWidth={0.8}
                strokeLinecap="round"
                fill="none"
                opacity={0.75}
              />

              {/* Hypogeal terminal bud and miniature authentic lobed oak leaves at apex (390.4, 416.0) */}
              {/* Compact terminal oak bud */}
              <Path
                d="M 390.4 416.5 C 389.5 415.0, 389.8 413.2, 390.4 412.0 C 391.0 413.2, 391.3 415.0, 390.4 416.5 Z"
                fill="#7A5636"
              />
              {/* Left tiny juvenile lobed oak leaf */}
              <Path
                d={createOakLobedLeafD(390.2, 415.5, 384.5, 408.0, 0.32)}
                fill="#6A864D"
                stroke="#4C6534"
                strokeWidth={0.35}
              />
              <Path
                d={createLeafVeinD(390.2, 415.5, 384.5, 408.0, -1, 1, false)}
                stroke="#8EAF52"
                strokeWidth={0.45}
                strokeLinecap="round"
                fill="none"
                opacity={0.8}
              />
              {/* Right tiny juvenile lobed oak leaf */}
              <Path
                d={createOakLobedLeafD(390.6, 415.5, 396.0, 408.0, 0.32)}
                fill="#7E9F45"
                stroke="#597330"
                strokeWidth={0.35}
              />
              <Path
                d={createLeafVeinD(390.6, 415.5, 396.0, 408.0, 1, 1, false)}
                stroke="#9EBF58"
                strokeWidth={0.45}
                strokeLinecap="round"
                fill="none"
                opacity={0.8}
              />
            </G>
          </Svg>
        ) : effectiveSubphase === "small_seedling" ? (
          /* Bounded Small Oak Seedling SVG rising 55px from (390.4, 441.0) */
          <Svg
            style={styles.proceduralSvg}
            viewBox={`0 0 ${worldBounds.width} ${worldBounds.height}`}
            pointerEvents="none"
          >
            <G id="small-seedling-structure">
              {/* Slender green-woody stem rising from (390.4, 441.0) to (390.4, 386.0) */}
              <Path
                d="M 390.4 441.0 C 389.5 423.0, 391.2 405.0, 390.4 386.0"
                stroke="#4E3629"
                strokeWidth={2.8}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d="M 390.4 425.0 C 390.8 412.0, 390.0 398.0, 390.4 386.0"
                stroke="#586E32"
                strokeWidth={2.0}
                strokeLinecap="round"
                fill="none"
              />
              {/* Stem highlight */}
              <Path
                d="M 390.1 435.0 C 390.5 420.0, 389.8 402.0, 390.2 387.0"
                stroke="#788E48"
                strokeWidth={0.9}
                strokeLinecap="round"
                fill="none"
                opacity={0.7}
              />
              {/* Leaf 1: Lower left juvenile lobed oak leaf (stem node at 390.0, 422.0) */}
              <Path
                d="M 390.0 422.0 Q 384.0 420.5 380.0 419.0"
                stroke="#4B3A26"
                strokeWidth={0.9}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d={createOakLobedLeafD(380.0, 419.0, 366.0, 414.0, 0.35)}
                fill="#56723D"
                stroke="#3E5629"
                strokeWidth={0.4}
              />
              <Path
                d={createLeafVeinD(380.0, 419.0, 366.0, 414.0, -1, 1, false)}
                stroke="#8EAF52"
                strokeWidth={0.45}
                strokeLinecap="round"
                fill="none"
                opacity={0.85}
              />

              {/* Leaf 2: Mid right juvenile lobed oak leaf (stem node at 390.5, 410.0) */}
              <Path
                d="M 390.5 410.0 Q 396.0 408.5 400.0 407.0"
                stroke="#4B3A26"
                strokeWidth={0.9}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d={createOakLobedLeafD(400.0, 407.0, 414.0, 402.0, 0.35)}
                fill="#6A864D"
                stroke="#4D6734"
                strokeWidth={0.4}
              />
              <Path
                d={createLeafVeinD(400.0, 407.0, 414.0, 402.0, 1, -1, false)}
                stroke="#9EBF58"
                strokeWidth={0.45}
                strokeLinecap="round"
                fill="none"
                opacity={0.85}
              />

              {/* Leaf 3: Upper left juvenile lobed oak leaf (stem node at 390.2, 398.0) */}
              <Path
                d="M 390.2 398.0 Q 386.0 395.0 382.0 393.0"
                stroke="#4B3A26"
                strokeWidth={0.8}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d={createOakLobedLeafD(382.0, 393.0, 369.0, 387.0, 0.34)}
                fill="#7E9F45"
                stroke="#597330"
                strokeWidth={0.38}
              />
              <Path
                d={createLeafVeinD(382.0, 393.0, 369.0, 387.0, -1, 1, false)}
                stroke="#A6C964"
                strokeWidth={0.45}
                strokeLinecap="round"
                fill="none"
                opacity={0.85}
              />

              {/* Leaf 4: Apical juvenile shoot leaf pair at (390.4, 386.0) */}
              <Path
                d={createOakLobedLeafD(390.4, 386.0, 383.0, 376.0, 0.32)}
                fill="#8DB54C"
                stroke="#638531"
                strokeWidth={0.35}
              />
              <Path
                d={createLeafVeinD(390.4, 386.0, 383.0, 376.0, -1, 0, false)}
                stroke="#B5D973"
                strokeWidth={0.4}
                strokeLinecap="round"
                fill="none"
                opacity={0.8}
              />
              <Path
                d={createOakLobedLeafD(390.4, 386.0, 397.0, 376.0, 0.32)}
                fill="#7E9F45"
                stroke="#597330"
                strokeWidth={0.35}
              />
              <Path
                d={createLeafVeinD(390.4, 386.0, 397.0, 376.0, 1, 0, false)}
                stroke="#A6C964"
                strokeWidth={0.4}
                strokeLinecap="round"
                fill="none"
                opacity={0.8}
              />
            </G>
          </Svg>
        ) : effectiveSubphase === "small_sapling" ? (
          /* Bounded Small Leafy Sapling SVG rising 125px from (390.4, 441.0) */
          /* Slender lightly woody stem, narrow root collar, modest juvenile oak leaves, zero mature buttress roots */
          <Svg
            style={styles.proceduralSvg}
            viewBox={`0 0 ${worldBounds.width} ${worldBounds.height}`}
            pointerEvents="none"
          >
            <G id="small-sapling-structure" accessibilityLabel="Small leafy sapling procedural fallback (Placeholder)">
              {/* Narrow root collar entering soil at (390.4, 441.0) */}
              <Path
                d="M 387.2 441.0 C 387.8 438.5, 388.5 432.0, 388.8 422.0 L 392.0 422.0 C 392.3 432.0, 393.0 438.5, 393.6 441.0 Z"
                fill="#4E3629"
              />

              {/* Slender lightly woody central stem with subtle organic curve from (390.4, 441.0) to (390.4, 324.0) */}
              <Path
                d="M 390.4 441.0 C 389.2 418.0, 391.6 392.0, 390.0 366.0 C 388.8 348.0, 391.0 334.0, 390.4 324.0"
                stroke="#4E3629"
                strokeWidth={3.6}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d="M 390.4 430.0 C 389.4 412.0, 391.4 388.0, 390.0 364.0 C 388.9 346.0, 390.8 333.0, 390.4 324.0"
                stroke="#5C4430"
                strokeWidth={2.4}
                strokeLinecap="round"
                fill="none"
              />
              {/* Bark highlight (chlorophyll undertone) */}
              <Path
                d="M 390.0 436.0 C 389.0 416.0, 391.2 390.0, 389.8 366.0 C 388.7 348.0, 390.7 334.0, 390.2 325.0"
                stroke="#788E48"
                strokeWidth={0.8}
                strokeLinecap="round"
                fill="none"
                opacity={0.65}
              />

              {/* Twig 1: Lower-mid left lateral twig (emerges at 389.8, 388.0) */}
              <Path
                d="M 389.8 388.0 Q 380.0 382.0 372.0 377.0"
                stroke="#5C4430"
                strokeWidth={1.3}
                strokeLinecap="round"
                fill="none"
              />
              {/* Twig 1 Leaf A: juvenile lobed oak leaf at node (380.0, 382.0) */}
              <Path
                d="M 380.0 382.0 Q 374.0 384.5 369.0 388.0"
                stroke="#586E32"
                strokeWidth={0.9}
                fill="none"
              />
              <Path
                d={createOakLobedLeafD(369.0, 388.0, 356.0, 393.0, 0.35)}
                fill="#56723D"
                stroke="#3E5629"
                strokeWidth={0.35}
              />
              <Path
                d={createLeafVeinD(369.0, 388.0, 356.0, 393.0, -1, 1, false)}
                stroke="#8EAF52"
                strokeWidth={0.4}
                strokeLinecap="round"
                fill="none"
                opacity={0.8}
              />
              {/* Twig 1 Leaf B: terminal juvenile lobed oak leaf at (372.0, 377.0) */}
              <Path
                d={createOakLobedLeafD(372.0, 377.0, 359.0, 370.0, 0.35)}
                fill="#6A864D"
                stroke="#4D6734"
                strokeWidth={0.35}
              />
              <Path
                d={createLeafVeinD(372.0, 377.0, 359.0, 370.0, -1, 1, false)}
                stroke="#9EBF58"
                strokeWidth={0.4}
                strokeLinecap="round"
                fill="none"
                opacity={0.8}
              />

              {/* Twig 2: Mid-right lateral twig (emerges at 390.6, 365.0) */}
              <Path
                d="M 390.6 365.0 Q 401.0 358.0 411.0 352.0"
                stroke="#5C4430"
                strokeWidth={1.3}
                strokeLinecap="round"
                fill="none"
              />
              {/* Twig 2 Leaf A: juvenile leaf at mid-twig (402.0, 360.0) */}
              <Path
                d="M 402.0 360.0 Q 407.0 364.0 412.0 368.0"
                stroke="#586E32"
                strokeWidth={0.9}
                fill="none"
              />
              <Path
                d={createOakLobedLeafD(412.0, 368.0, 425.0, 374.0, 0.35)}
                fill="#56723D"
                stroke="#3E5629"
                strokeWidth={0.35}
              />
              <Path
                d={createLeafVeinD(412.0, 368.0, 425.0, 374.0, 1, 1, false)}
                stroke="#8EAF52"
                strokeWidth={0.4}
                strokeLinecap="round"
                fill="none"
                opacity={0.8}
              />
              {/* Twig 2 Leaf B: terminal juvenile lobed oak leaf at (411.0, 352.0) */}
              <Path
                d={createOakLobedLeafD(411.0, 352.0, 424.0, 345.0, 0.35)}
                fill="#6A864D"
                stroke="#4D6734"
                strokeWidth={0.35}
              />
              <Path
                d={createLeafVeinD(411.0, 352.0, 424.0, 345.0, 1, -1, false)}
                stroke="#9EBF58"
                strokeWidth={0.4}
                strokeLinecap="round"
                fill="none"
                opacity={0.8}
              />

              {/* Twig 3: Upper-left lateral twig (emerges at 390.0, 344.0) */}
              <Path
                d="M 390.0 344.0 Q 382.5 338.5 375.0 333.5"
                stroke="#6B533E"
                strokeWidth={1.1}
                strokeLinecap="round"
                fill="none"
              />
              {/* Twig 3 Leaf A: terminal juvenile leaf pointing outward */}
              <Path
                d={createOakLobedLeafD(375.0, 333.5, 363.0, 325.0, 0.34)}
                fill="#7E9F45"
                stroke="#597330"
                strokeWidth={0.35}
              />
              <Path
                d={createLeafVeinD(375.0, 333.5, 363.0, 325.0, -1, 1, false)}
                stroke="#A6C964"
                strokeWidth={0.4}
                strokeLinecap="round"
                fill="none"
                opacity={0.8}
              />
              {/* Twig 3 Leaf B: small leaf at node (381.0, 337.0) */}
              <Path
                d={createOakLobedLeafD(381.0, 337.0, 371.0, 334.0, 0.32)}
                fill="#8DB54C"
                stroke="#638531"
                strokeWidth={0.32}
              />
              <Path
                d={createLeafVeinD(381.0, 337.0, 371.0, 334.0, -1, 0, false)}
                stroke="#B5D973"
                strokeWidth={0.38}
                strokeLinecap="round"
                fill="none"
                opacity={0.8}
              />

              {/* Terminal Leader: Central upright apical cluster at (390.4, 324.0) to (390.4, 314.0) */}
              <Path
                d="M 390.4 324.0 L 390.4 319.0"
                stroke="#6E8838"
                strokeWidth={1.2}
                strokeLinecap="round"
                fill="none"
              />
              {/* Apical leaf 1: left young oak leaf */}
              <Path
                d={createOakLobedLeafD(390.4, 321.0, 383.0, 312.0, 0.30)}
                fill="#8DB54C"
                stroke="#638531"
                strokeWidth={0.32}
              />
              <Path
                d={createLeafVeinD(390.4, 321.0, 383.0, 312.0, -1, 0, false)}
                stroke="#B5D973"
                strokeWidth={0.38}
                strokeLinecap="round"
                fill="none"
                opacity={0.8}
              />
              {/* Apical leaf 2: center upright young leaf */}
              <Path
                d={createOakLobedLeafD(390.4, 319.0, 390.4, 308.0, 0.30)}
                fill="#9EC05C"
                stroke="#6E8838"
                strokeWidth={0.32}
              />
              <Path
                d={createLeafVeinD(390.4, 319.0, 390.4, 308.0, 0, -1, false)}
                stroke="#C6E57E"
                strokeWidth={0.38}
                strokeLinecap="round"
                fill="none"
                opacity={0.8}
              />
              {/* Apical leaf 3: right young oak leaf */}
              <Path
                d={createOakLobedLeafD(390.4, 321.0, 398.0, 312.0, 0.30)}
                fill="#7E9F45"
                stroke="#597330"
                strokeWidth={0.32}
              />
              <Path
                d={createLeafVeinD(390.4, 321.0, 398.0, 312.0, 1, 0, false)}
                stroke="#A6C964"
                strokeWidth={0.38}
                strokeLinecap="round"
                fill="none"
                opacity={0.8}
              />
            </G>
          </Svg>
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

        {/* Development-Only Painterly Foliage Cluster Proof */}
        {/* Attached to verified branch anchor 'branch-scaffold-right-upper' (554.4, 103.8) */}
        {/* Calibrated from baseline 554.4 - 59.4 (140px cluster) to 50x51 cluster to match branch thickness */}
        {effectiveShowFoliageProof && (
          <RNImage
            source={FOLIAGE_CLUSTER_ASSET}
            style={{
              position: "absolute",
              left: 554.4 - 59.4 + 35.4, // 554.4 - 24
              top: 103.8 - 48,
              width: 50,
              height: 51,
            }}
            resizeMode="contain"
          />
        )}

        {/* ------------------------------------------------------------- */}
        {/* LAYER 6: FOREGROUND SOIL, MOSS & LEAF LITTER OVERLAP          */}
        {/* Partially occludes only bottom 2-4px of root tips; shares transform */}
        {/* ------------------------------------------------------------- */}
        <Svg
          style={StyleSheet.absoluteFill}
          viewBox="0 0 800 500"
          pointerEvents="none"
        >
          <G id="foreground-moss-overlap" opacity={0.92}>
            {effectiveSubphase === "planted_acorn" ? (
              <G id="acorn-soil-bedding">
                <Path
                  d="M 387.0 441.2 C 388.5 440.8, 392.0 440.8, 393.5 441.4 C 391.5 441.9, 388.8 441.8, 387.0 441.2 Z"
                  fill="#3A2A1A"
                  opacity={0.75}
                />
                <Circle cx={388.2} cy={441.8} r={0.7} fill="#241B13" opacity={0.8} />
                <Circle cx={392.6} cy={441.6} r={0.6} fill="#241B13" opacity={0.8} />
              </G>
            ) : effectiveSubphase === "emerging_shoot" ||
              effectiveSubphase === "small_seedling" ? (
              <G id="seedling-soil-bedding">
                <Path
                  d="M 388.0 441.2 C 389.2 440.7, 391.6 440.7, 392.8 441.3 C 391.2 441.8, 389.5 441.7, 388.0 441.2 Z"
                  fill="#241B13"
                  opacity={0.8}
                />
                <Circle cx={389.0} cy={441.6} r={0.6} fill="#3E5228" opacity={0.8} />
                <Circle cx={391.8} cy={441.5} r={0.7} fill="#241B13" opacity={0.7} />
              </G>
            ) : effectiveSubphase === "small_sapling" ? (
              <G id="sapling-soil-bedding">
                <Path
                  d="M 383.8 441.5 C 386.8 440.4, 393.8 440.3, 397.0 441.4 C 394.2 442.3, 387.0 442.4, 383.8 441.5 Z"
                  fill="#2B2518"
                  opacity={0.78}
                />
                <Path
                  d="M 385.0 441.2 C 386.6 439.8, 388.3 439.8, 389.5 441.1 C 388.0 441.5, 386.4 441.5, 385.0 441.2 Z"
                  fill="#4B5B2D"
                  opacity={0.68}
                />
                <Path
                  d="M 391.7 441.1 C 393.4 439.7, 395.1 440.0, 396.0 441.2 C 394.4 441.7, 393.0 441.6, 391.7 441.1 Z"
                  fill="#596536"
                  opacity={0.62}
                />
                <Circle cx={384.8} cy={442.0} r={0.65} fill="#1F1A12" opacity={0.65} />
                <Circle cx={396.0} cy={441.8} r={0.55} fill="#3E5228" opacity={0.72} />
              </G>
            ) : isBranchingOakEligible ? (
              <G id="branching-root-bedding">
                {/* Center collar base preserves clean bark exposure. */}
                {/* Natural woodland leaf-litter flakes collected in the shaded crevice */}
                <Path
                  d="M 374.2 440.6 C 376.5 439.8, 379.2 440.0, 380.8 441.2 C 378.2 441.9, 375.4 441.6, 374.2 440.6 Z"
                  fill="#4A3724"
                  opacity={0.85}
                />
                <Path
                  d="M 377.5 441.4 C 379.2 440.8, 381.8 441.0, 383.0 442.0 C 381.0 442.5, 378.6 442.2, 377.5 441.4 Z"
                  fill="#5C4430"
                  opacity={0.80}
                />

                {/* Roots 2 & 5: Boldly exposed wood with subtle distal soil contact */}
                <Path
                  d="M 349.5 440.8 C 351.2 440.0, 353.8 440.0, 355.2 440.9 C 353.4 441.6, 350.8 441.6, 349.5 440.8 Z"
                  fill="#241B13"
                  opacity={0.80}
                />
                <Path
                  d="M 439.2 438.8 C 440.6 438.2, 442.4 438.2, 443.4 438.9 C 442.0 439.5, 440.2 439.5, 439.2 438.8 Z"
                  fill="#241B13"
                  opacity={0.75}
                />
              </G>
            ) : (
              <G id="mature-root-bedding">
                {/* Left root flare moss cushion */}
                <Path
                  d="M 268 446 C 275 442, 285 443, 296 445 C 304 444, 312 447, 318 448 C 308 450, 290 451, 268 446 Z"
                  fill="#283319"
                />
                {/* Center-left root tuft */}
                <Path
                  d="M 335 446 C 342 443, 350 444, 358 447 C 352 449, 344 449, 335 446 Z"
                  fill="#3E5228"
                />
                {/* Center-right soil overlap */}
                <Path
                  d="M 405 447 C 414 444, 424 445, 434 448 C 426 450, 416 450, 405 447 Z"
                  fill="#283319"
                />
                {/* Far-right root tip gentle grass blades */}
                <Path
                  d="M 482 446 C 490 443, 498 444, 508 447 C 500 450, 492 450, 482 446 Z"
                  fill="#3E5228"
                />
                {/* Gentle curved meadow blades bedding roots into clearing soil */}
                <Path
                  d="M 285 446 Q 288 442 287 439 M 345 447 Q 348 443 347 440 M 420 448 Q 423 444 425 441 M 495 447 Q 497 443 496 440"
                  stroke="#526E38"
                  strokeWidth={1.1}
                  strokeLinecap="round"
                  fill="none"
                />
              </G>
            )}
          </G>
        </Svg>
      </View>

      {/* ------------------------------------------------------------- */}
      {/* LIGHTING & COLOR HARMONY: NON-DESTRUCTIVE CROSS-PLATFORM VEILS */}
      {/* Softens golden highlights, cool forest ambient, edge vignette */}
      {/* ------------------------------------------------------------- */}
      {(isMatureOakEligible || isBranchingOakEligible) && (
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
    opacity: 1.0, // 100% physically opaque structure
  },
  branchingFoliageFlush: {
    position: "absolute",
    zIndex: 5,
    overflow: "hidden",
  },
  saplingOakImage: {
    position: "absolute",
    opacity: 1.0, // 100% physically opaque structure
  },
  earlyLifeOakImage: {
    position: "absolute",
    zIndex: 4,
  },
  proceduralSvg: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 800,
    height: 500,
  },
});
