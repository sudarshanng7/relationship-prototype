/**
 * Purple Garden - Production Living Garden Renderer
 *
 * Unified production renderer component that respects:
 * - Local typed feature flag: "procedural" | "painterly_when_eligible"
 * - Decoupled GardenRenderPlan:
 *   - environmentRenderer: "painterly_backplate" (woodland backplate across all stages)
 *     or "procedural"
 *   - structureRenderer: "painterly_asset" (mature oak strictly for garden_in_bloom)
 *     or "procedural" (honest younger structural fallback for branching_out and earlier stages)
 * - Standard React Native Image layers inside camera-transformed parent View
 *   (guaranteed Expo Web and Native safety without native asset resolution method crashes).
 * - Deterministic Couple DNA: archetype, woodland tint, bounded transforms, and fauna variants.
 * - Restrained ambient living behavior: pauses on reduced motion, resting, or app backgrounding.
 * - Continuous exploration viewport cover without detached rectangular margin blocks.
 */

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  AppStateStatus,
  Image as RNImage,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";
import {
  type GardenCareEvent,
  type GardenCareSignals,
  type GeneratedGardenSVGScene,
  generateGardenSVGScene,
  getCareFeatureId,
  createOakLobedLeafD,
  createLeafVeinD,
} from "@/lib/garden-generator";
import {
  type Camera2D,
  type GardenCameraState,
  type GardenRendererMode,
  type GardenRenderPlan,
  type GardenWorld,
  type Viewport,
  type GardenAtmosphereTone,
  type GardenStructuralPresentation,
  CANONICAL_SCENE_BOUNDS,
  adaptCanonicalAnchorToPainterly,
  deriveAmbientLifeContract,
  derivePainterlyCoupleDNA,
  getGardenRendererMode,
  getGardenStructuralPresentation,
  isCanonicalBranchingAssetKey,
  isCanonicalMatureAssetKey,
  resolveCanonicalStageKey,
  resolveFeatureBoundsFromScene,
  resolveGardenRenderPlan,
  resolveTreePresentationTransform,
  resolveFeaturePresentationGeometry,
  isMatchingFeatureId,
  type TreeCompositionPresetName,
} from "@/lib/garden";
import {
  ProceduralGardenRenderer,
  type ProceduralGardenRendererProps,
} from "./ProceduralGardenRenderer";
import { PainterlyTreeStructure } from "./PainterlyTreeStructure";
import { resolveMvpFoundationPresentation, resolveMvpFoundationUnits } from "@/lib/garden/stage-contracts";
import { resolveMvpFoundationMemoryMarkers } from "@/lib/garden/stage-contracts";

// Production bundled painterly raster assets
const BACKPLATE_ASSET = require("../../../assets/garden/painterly/woodland-backplate-light-v1.png");

// Authentic woodland oak palette and tender spring reconnection flush tones
const OAK_FOLIAGE_PALETTE = {
  mutedWoodlandPrimary: "#56723D",
  mutedWoodlandTender: "#6A864D",
  mutedWoodlandDeep: "#435B2E",
  springFlushPrimary: "#7E9F45",
  springFlushTender: "#92B555",
  springFlushYoung: "#6B8B38",
};

export interface PainterlyGardenRendererProps
  extends ProceduralGardenRendererProps {
  rendererMode?: GardenRendererMode;
  atmosphereTone?: GardenAtmosphereTone;
  presentation?: GardenStructuralPresentation;
  hideOverlays?: boolean;
  showWoodland?: boolean;
  cropPreset?: TreeCompositionPresetName;
  showGuides?: boolean;
  showFoliageProof?: boolean;
  calibrationTransform?: {
    x?: number;
    y?: number;
    scale?: number;
    rotation?: number;
  };
}

export function PainterlyGardenRenderer({
  totalGrowthUnits,
  careGrowthUnits,
  timeGrowthUnits,
  seedString,
  isResting = false,
  compact = false,
  careSignals,
  careEvents,
  style,
  children,
  highlightFeatureId,
  world: worldProp,
  camera,
  viewport: viewportProp,
  exploreMode = false,
  rendererMode: modeProp,
  atmosphereTone: toneProp,
  presentation: presentationProp,
  hideOverlays = false,
  showWoodland = true,
  cropPreset = "middle_distance",
  showGuides = false,
  showFoliageProof,
  calibrationTransform,
}: PainterlyGardenRendererProps) {
  const sceneId = useId().replace(/:/g, "_");
  const { effectiveTheme } = useTheme();

  // 1. Accessibility & App Lifecycle State
  const [isReduceMotion, setIsReduceMotion] = useState(false);
  const [isBackgrounded, setIsBackgrounded] = useState(false);
  const [containerViewport, setContainerViewport] = useState<Viewport>({
    width: compact ? 360 : 800,
    height: compact ? 188 : 500,
  });

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => setIsReduceMotion(Boolean(enabled)))
      .catch(() => setIsReduceMotion(false));
    const subMotion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => setIsReduceMotion(Boolean(enabled))
    );
    const subAppState = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        setIsBackgrounded(state !== "active");
      }
    );
    return () => {
      if (typeof subMotion?.remove === "function") subMotion.remove();
      if (typeof subAppState?.remove === "function") subAppState.remove();
    };
  }, []);

  // 2. Stage Resolution & Production Render Plan
  const stageKey = useMemo(() => {
    return resolveCanonicalStageKey(totalGrowthUnits, careEvents?.length ?? 0);
  }, [totalGrowthUnits, careEvents]);

  const mvpFoundationPresentation = useMemo(
    () =>
      resolveMvpFoundationPresentation(
        totalGrowthUnits,
        careEvents?.length ?? 0,
        careGrowthUnits,
        timeGrowthUnits
      ),
    [totalGrowthUnits, careGrowthUnits, timeGrowthUnits, careEvents]
  );
  const mvpFoundationUnits = useMemo(
    () => resolveMvpFoundationUnits(totalGrowthUnits, careGrowthUnits, timeGrowthUnits),
    [totalGrowthUnits, careGrowthUnits, timeGrowthUnits]
  );
  // Future canopy, habitat and mature-tree layers remain implemented but are
  // intentionally withheld from the bounded three-frame MVP journey.
  const showFutureCanopyLayers = false;
  const foundationMemoryMarkers = useMemo(
    () => resolveMvpFoundationMemoryMarkers(careEvents ?? [], seedString, mvpFoundationUnits),
    [careEvents, seedString, mvpFoundationUnits]
  );

  const activeMode = modeProp ?? getGardenRendererMode();
  const isDev =
    typeof __DEV__ !== "undefined"
      ? Boolean(__DEV__)
      : process.env.NODE_ENV !== "production";

  const renderPlan: GardenRenderPlan = useMemo(() => {
    return resolveGardenRenderPlan({
      stageKey,
      rendererMode: activeMode,
      allowDevelopmentPreview: isDev,
      availableAssets: [
        "painterly-oak-mature-v1",
        "painterly-oak-structure-mature-v1",
        "painterly-oak-branching-v1",
      ],
    });
  }, [stageKey, activeMode, isDev]);

  // Calm living presentation tone resolution
  const presentation = useMemo(() => {
    if (presentationProp) return presentationProp;
    return getGardenStructuralPresentation(
      toneProp || "calm_light",
      stageKey,
      effectiveTheme
    );
  }, [presentationProp, toneProp, stageKey, effectiveTheme]);

  // 3. Fallback: If environmentRenderer is procedural (pure procedural mode requested),
  // immediately mount ProceduralGardenRenderer
  if (renderPlan.environmentRenderer === "procedural") {
    return (
      <ProceduralGardenRenderer
        totalGrowthUnits={totalGrowthUnits}
        careGrowthUnits={careGrowthUnits}
        timeGrowthUnits={timeGrowthUnits}
        seedString={seedString}
        isResting={isResting}
        compact={compact}
        careSignals={careSignals}
        careEvents={careEvents}
        style={style}
        children={children}
        highlightFeatureId={highlightFeatureId}
        world={worldProp}
        camera={camera}
        viewport={viewportProp}
        exploreMode={exploreMode}
      />
    );
  }

  // --------------------------------------------------------------------------
  // PAINTERLY RENDERER EXECUTION
  // --------------------------------------------------------------------------

  // 4. Deterministic Couple DNA & Ambient Life Contracts
  const coupleDNA = useMemo(
    () => derivePainterlyCoupleDNA(seedString),
    [seedString]
  );

  const ambientLife = useMemo(
    () =>
      deriveAmbientLifeContract({
        isResting,
        isReduceMotion,
        isBackgrounded,
        hasStream: false,
      }),
    [isResting, isReduceMotion, isBackgrounded]
  );

  // Subtle ambient canopy breathing loop
  const breathAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ambientLife.motionAllowed) {
      breathAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, {
          toValue: 1,
          duration: ambientLife.canopyBreathingPeriodMs / 2,
          useNativeDriver: true,
        }),
        Animated.timing(breathAnim, {
          toValue: 0,
          duration: ambientLife.canopyBreathingPeriodMs / 2,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [ambientLife.motionAllowed, ambientLife.canopyBreathingPeriodMs]);

  // Interpolated gentle scale (0.996 to 1.004)
  const canopyBreathScale = breathAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.0, 1.0 + ambientLife.breathingAmplitudeScale],
  });

  // 5. Scene Generation for Botanical Parity
  const scene: GeneratedGardenSVGScene = useMemo(() => {
    return generateGardenSVGScene(
      seedString,
      totalGrowthUnits,
      careGrowthUnits,
      isResting,
      careSignals,
      effectiveTheme,
      careEvents
    );
  }, [
    seedString,
    totalGrowthUnits,
    careGrowthUnits,
    isResting,
    careSignals,
    effectiveTheme,
    careEvents,
  ]);

  // 5B. Unified Tree Presentation Transform
  const presentationTransform = useMemo(() => {
    return resolveTreePresentationTransform({
      cropPreset,
      calibrationTransform,
      coupleDNA,
    });
  }, [cropPreset, calibrationTransform, coupleDNA]);

  const highlightCoord = useMemo(() => {
    if (!highlightFeatureId) return null;
    const foundationMarker = foundationMemoryMarkers.find((marker) =>
      isMatchingFeatureId(
        highlightFeatureId,
        getCareFeatureId(marker.kind, marker.sourceId)
      )
    );
    if (foundationMarker) {
      return { cx: foundationMarker.x, cy: foundationMarker.y, r: 8 };
    }
    const baseBounds = resolveFeatureBoundsFromScene(scene, highlightFeatureId);
    if (!baseBounds) return null;

    // Resolve presentation geometry derived from semantic feature type
    let role = "blossom";
    let attachmentTarget: "canopy" | "root" | "terrain" | undefined;
    let variant: string | undefined;

    const blossomMatch = scene.blossoms?.find((b) => isMatchingFeatureId(b.id, highlightFeatureId));
    const canopyMatch = scene.canopyDetails?.find((c) => isMatchingFeatureId(c.id, highlightFeatureId));
    const groundMatch = scene.groundDetails?.find((g) => isMatchingFeatureId(g.id, highlightFeatureId));
    const habitatMatch = scene.habitatDetails?.find((h) => isMatchingFeatureId(h.id, highlightFeatureId));

    if (blossomMatch) {
      role = "blossom";
      attachmentTarget = "canopy";
    } else if (canopyMatch) {
      role = "foliage_shoot";
      attachmentTarget = "canopy";
      variant = (canopyMatch as any).variant;
    } else if (groundMatch) {
      if (groundMatch.type === "moss") {
        role = "root_flora";
        attachmentTarget = "root";
        variant = "moss_cushion";
      } else {
        role = "ground_flora";
        attachmentTarget = "terrain";
        variant = (groundMatch as any).variant;
      }
    } else if (habitatMatch) {
      if (habitatMatch.kind === "bird-perch" || habitatMatch.kind === "nest-material") {
        role = "creature";
        attachmentTarget = "canopy";
      } else {
        role = "creature";
        attachmentTarget =
          (habitatMatch as any).attachmentTarget ??
          (habitatMatch.cy < 260 ? "canopy" : "terrain");
      }
    }

    const geom = resolveFeaturePresentationGeometry({
      canonicalPoint: { x: baseBounds.cx, y: baseBounds.cy },
      role,
      stageKey,
      structuralAssetKey: renderPlan.structureAssetKey,
      cropPreset,
      calibrationTransform,
      coupleDNA,
      attachmentTarget,
      variant,
    });

    return {
      cx: geom.x,
      cy: geom.y,
      r: baseBounds.r * geom.scale,
    };
  }, [
    scene,
    highlightFeatureId,
    stageKey,
    renderPlan.structureAssetKey,
    cropPreset,
    calibrationTransform,
    coupleDNA,
    foundationMemoryMarkers,
  ]);

  // 6. Viewport and Camera Transformations
  const isExplore = Boolean(exploreMode && camera && (viewportProp || containerViewport));
  const activeViewport = viewportProp || containerViewport;

  // Compute camera matrix or fit transform
  let transformMatrix: any[];
  if (isExplore && camera) {
    const camX = "targetX" in camera ? camera.targetX : camera.target.x;
    const camY = "targetY" in camera ? camera.targetY : camera.target.y;
    transformMatrix = [
      { translateX: activeViewport.width / 2 },
      { translateY: activeViewport.height / 2 },
      { scale: camera.zoom },
      { translateX: -camX },
      { translateY: -camY },
    ];
  } else {
    // Both full tile and compact card share the canonical [0, 800] x [0, 500] coordinate space.
    // In compact mode, centering on (400, 210) provides perfectly balanced top/bottom margins (46px each)
    // so the entire crown and roots are visible without clipping.
    const scale = Math.max(
      activeViewport.width / 800,
      activeViewport.height / 500
    );
    const targetY = compact ? 210 : 250;
    transformMatrix = [
      { translateX: activeViewport.width / 2 },
      { translateY: activeViewport.height / 2 },
      { scale },
      { translateX: -400 },
      { translateY: -targetY },
    ];
  }

  // 7. Ground and Canopy Flora details
  const groundFlora = useMemo(() => {
    const earnedFeatureIds = (careEvents ?? []).map((event) =>
      getCareFeatureId(event.kind, event.id)
    );
    return scene.groundDetails.filter((item) => {
      if (compact && item.compact === false) return false;
      if (earnedFeatureIds.some((id) => isMatchingFeatureId(item.id, id))) {
        return false;
      }
      return (
        item.type === "moss" ||
        item.type === "grass" ||
        item.type === "ground-cover" ||
        item.type === "flower" ||
        item.type === "bud" ||
        item.type === "fern" ||
        item.type === "clover" ||
        item.type === "seed-head" ||
        item.type === "sprout" ||
        item.type === "meadow-flower" ||
        item.type === "flowering-herb"
      );
    });
  }, [scene.groundDetails, compact, careEvents]);

  const canopyAccents = useMemo(() => {
    return (scene.canopyDetails || []).filter(
      (item) => !(compact && item.compact === false)
    );
  }, [scene.canopyDetails, compact]);

  const habitats = useMemo(() => {
    return (scene.habitatDetails || []).filter(
      (item) => !(compact && item.compact === false)
    );
  }, [scene.habitatDetails, compact]);

  const { canopyHabitats, groundHabitats } = useMemo(() => {
    const canopy: typeof habitats = [];
    const ground: typeof habitats = [];
    for (const hab of habitats) {
      const isCanopy =
        hab.attachmentTarget === "canopy" ||
        hab.kind === "bird-perch" ||
        hab.kind === "nest-material" ||
        hab.cy < 260;
      if (isCanopy) {
        canopy.push(hab);
      } else {
        ground.push(hab);
      }
    }
    return { canopyHabitats: canopy, groundHabitats: ground };
  }, [habitats]);

  // Theme overlay tint for twilight/night harmony
  const themeDarkOverlay =
    effectiveTheme === "dark"
      ? "rgba(10, 15, 29, 0.45)"
      : effectiveTheme === "dim"
      ? "rgba(24, 20, 32, 0.22)"
      : isResting
      ? "rgba(30, 25, 45, 0.15)"
      : null;

  const isMatureOakStructure =
    renderPlan.structureRenderer === "painterly_asset" &&
    isCanonicalMatureAssetKey(renderPlan.structureAssetKey);
  const isBranchingOakStructure =
    renderPlan.structureRenderer === "painterly_asset" &&
    isCanonicalBranchingAssetKey(renderPlan.structureAssetKey);

  const effectiveShowFoliageProof =
    showFoliageProof !== undefined
      ? showFoliageProof
      : false;

  return (
    <View
      style={[
        compact
          ? styles.compactContainer
          : isExplore
          ? styles.exploreContainer
          : styles.fullContainer,
        style,
      ]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) {
          setContainerViewport({ width, height });
        }
      }}
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={scene.accessibilityDescription}
    >
      <View
        style={styles.innerWrapper}
        accessibilityElementsHidden={true}
        importantForAccessibility="no"
      >
        {/* Camera-transformed world coordinate parent View */}
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 0,
            height: 0,
            overflow: "visible",
            transform: transformMatrix,
          }}
        >
          {/* LAYER 1: Painterly Woodland Backplate (Standard RN Image) */}
          {showWoodland && (
            <RNImage
              source={BACKPLATE_ASSET}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: 800,
                height: 500,
                opacity: coupleDNA.atmosphere.backplateOpacity,
              }}
              resizeMode="stretch"
            />
          )}

          {/* LAYER 1B: Couple DNA Atmosphere Tint */}
          {showWoodland && (
            <View
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: 800,
                height: 500,
                backgroundColor: coupleDNA.atmosphere.woodlandTintOverlay,
                pointerEvents: "none",
              }}
            />
          )}

          {/* LAYER 1C: Night/Resting Theme Overlay */}
          {showWoodland && themeDarkOverlay && (
            <View
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: 800,
                height: 500,
                backgroundColor: themeDarkOverlay,
                pointerEvents: "none",
              }}
            />
          )}

          {/* LAYERS 2 through 6: Painterly Tree Structure & Natural Ground Integration */}
          <PainterlyTreeStructure
            structuralAssetKey={renderPlan.structureAssetKey}
            stageKey={stageKey}
            totalGrowthUnits={totalGrowthUnits}
            subphaseKey={mvpFoundationPresentation.subphaseKey}
            foundationLevelProgress={mvpFoundationPresentation.levelProgress}
            worldBounds={CANONICAL_SCENE_BOUNDS}
            cropPreset={cropPreset}
            showGuides={showGuides}
            showFoliageProof={effectiveShowFoliageProof}
            calibrationTransform={calibrationTransform}
            coupleDNA={coupleDNA}
            presentation={presentation}
            theme={effectiveTheme}
            atmosphereTone={toneProp}
            scene={scene}
            presentationMode={compact ? "compact" : isExplore ? "explore" : "full"}
          />

          {/* LAYERS 7 through 9: SVG Overlays (Aligned 1:1 in 800x500 canonical space) */}
          {!hideOverlays && (
            <Svg
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: 800,
                height: 500,
                pointerEvents: "none",
              }}
              viewBox="0 0 800 500"
            >
              <Defs>
                <RadialGradient
                  id={`painterlyGlow_${sceneId}`}
                  cx="50%"
                  cy="50%"
                  r="50%"
                >
                  <Stop offset="0%" stopColor="#FDE68A" stopOpacity={0.8} />
                  <Stop offset="100%" stopColor="#F59E0B" stopOpacity={0.0} />
                </RadialGradient>
              </Defs>

              {/* 3A. Ground flora, meadow flowers, and root moss */}
              <G id="ground-flora-layer">
              {groundFlora.map((item) => {
                if (item.type === "fern" && item.stemPath) {
                  return (
                    <G key={item.id}>
                      {item.leafPaths?.map((lp) => (
                        <Path
                          key={lp.id}
                          d={lp.d}
                          fill={lp.color}
                          opacity={0.92}
                        />
                      ))}
                      <Path
                        d={item.stemPath}
                        stroke={item.accentColor || "#4B6043"}
                        strokeWidth={1.3}
                        fill="none"
                      />
                    </G>
                  );
                }
                if (item.type === "clover" && item.leafPaths) {
                  return (
                    <G key={item.id}>
                      {item.leafPaths.map((lp) => (
                        <Path
                          key={lp.id}
                          d={lp.d}
                          fill={lp.color}
                          opacity={0.9}
                        />
                      ))}
                    </G>
                  );
                }
                if (
                  (item.type === "meadow-flower" ||
                    item.type === "flowering-herb") &&
                  item.stemPath
                ) {
                  return (
                    <G key={item.id}>
                      <Path
                        d={item.stemPath}
                        stroke={item.accentColor || "#4B6043"}
                        strokeWidth={1.2}
                        fill="none"
                      />
                      {item.florets?.map((fl, fIdx) => {
                        const petalCount = 5;
                        const pr = Math.max(1.3, fl.r * 0.62);
                        return (
                          <G key={`${item.id}-f-${fIdx}`}>
                            {Array.from({ length: petalCount }).map((_, pIdx) => {
                              const angle = (pIdx * 2 * Math.PI) / petalCount - Math.PI / 2;
                              const px = fl.cx + Math.cos(angle) * (fl.r * 0.52);
                              const py = fl.cy + Math.sin(angle) * (fl.r * 0.52);
                              return (
                                <Circle
                                  key={`p-${pIdx}`}
                                  cx={px}
                                  cy={py}
                                  r={pr}
                                  fill={fl.petalColor}
                                  opacity={0.94}
                                />
                              );
                            })}
                            <Circle
                              cx={fl.cx}
                              cy={fl.cy}
                              r={Math.max(0.7, fl.r * 0.32)}
                              fill="#FDE68A"
                              opacity={0.96}
                            />
                          </G>
                        );
                      })}
                    </G>
                  );
                }
                if (item.cx && item.cy && item.color) {
                  // Depth perspective scaling: plants near deep-centre tree (cy ~316)
                  // scale to ~62%, matching the tree's scale (0.58), while foreground
                  // meadow plants (cy ~430+) scale up to 100%.
                  const depthScale = Math.min(
                    1.0,
                    Math.max(0.62, 0.62 + (item.cy - 316) * (0.38 / 114))
                  );
                  const stemH = 7.0 * depthScale;
                  const stemPath = `M ${item.cx.toFixed(1)},${(item.cy + stemH).toFixed(1)} Q ${(item.cx + 0.8 * depthScale).toFixed(1)},${(item.cy + stemH * 0.5).toFixed(1)} ${item.cx.toFixed(1)},${item.cy.toFixed(1)}`;
                  const fr = (item.rx || 2.4) * depthScale;
                  const pr = Math.max(0.9, fr * 0.60);
                  const petalCount = 5;
                  const basalW = 2.5 * depthScale;
                  const basalH = 1.0 * depthScale;
                  return (
                    <G key={item.id}>
                      {/* Rooted meadow stem into soil */}
                      <Path
                        d={stemPath}
                        stroke="#455B32"
                        strokeWidth={Math.max(0.8, 1.1 * depthScale)}
                        fill="none"
                      />
                      {/* Basal foliage leaflets */}
                      <Path
                        d={`M ${(item.cx - basalW).toFixed(1)},${(item.cy + stemH - basalH).toFixed(1)} Q ${(item.cx - basalW * 2).toFixed(1)},${(item.cy + stemH - basalH * 3).toFixed(1)} ${(item.cx - basalW * 0.4).toFixed(1)},${(item.cy + stemH - basalH * 2).toFixed(1)} Z`}
                        fill="#546E3A"
                        opacity={0.9}
                      />
                      <Path
                        d={`M ${(item.cx + basalW).toFixed(1)},${(item.cy + stemH - basalH).toFixed(1)} Q ${(item.cx + basalW * 2).toFixed(1)},${(item.cy + stemH - basalH * 3).toFixed(1)} ${(item.cx + basalW * 0.4).toFixed(1)},${(item.cy + stemH - basalH * 2).toFixed(1)} Z`}
                        fill="#455B32"
                        opacity={0.9}
                      />
                      {/* Multi-petal floret */}
                      {Array.from({ length: petalCount }).map((_, pIdx) => {
                        const angle = (pIdx * 2 * Math.PI) / petalCount - Math.PI / 2;
                        const px = item.cx! + Math.cos(angle) * (fr * 0.5);
                        const py = item.cy! + Math.sin(angle) * (fr * 0.5);
                        return (
                          <Circle
                            key={`p-${pIdx}`}
                            cx={px}
                            cy={py}
                            r={pr}
                            fill={item.color}
                            opacity={0.92}
                          />
                        );
                      })}
                      <Circle
                        cx={item.cx}
                        cy={item.cy}
                        r={Math.max(0.5, fr * 0.3)}
                        fill="#FDE68A"
                        opacity={0.95}
                      />
                    </G>
                  );
                }
                return null;
              })}
              {/* Ground habitats (butterflies, meadow pollinators) */}
              {groundHabitats.map((hab) => {
                const habDepth = Math.min(
                  1.0,
                  Math.max(0.68, 0.68 + (hab.cy - 316) * (0.32 / 114))
                );
                const s = (hab.scale || 1.0) * habDepth;
                const dir = hab.flip ? -1 : 1;
                return (
                  <G key={hab.id}>
                    <Ellipse
                      cx={hab.cx}
                      cy={hab.cy}
                      rx={2.8 * s}
                      ry={1.8 * s}
                      fill={hab.primaryColor}
                    />
                    <Circle
                      cx={hab.cx - dir * 2.5 * s}
                      cy={hab.cy - 1.5 * s}
                      r={1.0 * s}
                      fill={hab.secondaryColor}
                    />
                  </G>
                );
              })}
            </G>

            {/* MVP event history: one deterministic memory marker per authorized event. */}
            <G id="mvp-foundation-memory-markers">
              {foundationMemoryMarkers.map((marker) => {
                if (marker.visualKind === "acorn") {
                  return (
                    <G key={marker.semanticKey}>
                      <Ellipse
                        cx={marker.x}
                        cy={marker.y + 1.5}
                        rx={6.2}
                        ry={2.2}
                        fill="#192219"
                        opacity={0.28}
                      />
                      <Path
                        d={`M ${marker.x - 4.8},${marker.y} Q ${marker.x},${marker.y - 7.5} ${marker.x + 4.8},${marker.y} Q ${marker.x},${marker.y + 5.5} ${marker.x - 4.8},${marker.y} Z`}
                        fill="#B99155"
                        stroke="#E1C58C"
                        strokeWidth={0.8}
                      />
                      <Circle cx={marker.x} cy={marker.y - 0.8} r={1.2} fill="#F2D995" />
                    </G>
                  );
                }

                if (marker.visualKind === "sapling_leaf") {
                  return (
                    <G
                      key={marker.semanticKey}
                      transform={`rotate(${marker.rotation} ${marker.x} ${marker.y})`}
                    >
                      <Path
                        d={`M ${marker.x},${marker.y + 2} C ${marker.x - 2},${marker.y} ${marker.x - 7},${marker.y - 1} ${marker.x - 6},${marker.y - 5} C ${marker.x - 4},${marker.y - 4} ${marker.x - 3},${marker.y - 9} ${marker.x},${marker.y - 8} C ${marker.x + 3},${marker.y - 9} ${marker.x + 4},${marker.y - 4} ${marker.x + 6},${marker.y - 5} C ${marker.x + 7},${marker.y - 1} ${marker.x + 2},${marker.y} ${marker.x},${marker.y + 2} Z`}
                        fill="#83A956"
                        stroke="#B6CB7D"
                        strokeWidth={0.65}
                      />
                      <Path
                        d={`M ${marker.x},${marker.y + 3} L ${marker.x},${marker.y - 7}`}
                        stroke="#49673A"
                        strokeWidth={0.7}
                      />
                    </G>
                  );
                }

                if (marker.visualKind === "moss") {
                  return (
                    <G key={marker.semanticKey}>
                      <Ellipse cx={marker.x} cy={marker.y + 1} rx={6.5 * marker.scale} ry={2.4 * marker.scale} fill="#263A27" opacity={0.32} />
                      <Circle cx={marker.x - 2.8} cy={marker.y - 1.4} r={3.2 * marker.scale} fill="#66824B" />
                      <Circle cx={marker.x + 2.3} cy={marker.y - 1.1} r={3.7 * marker.scale} fill="#789657" />
                      <Circle cx={marker.x} cy={marker.y - 3.1} r={2.6 * marker.scale} fill="#91AA62" />
                    </G>
                  );
                }

                if (marker.visualKind === "light_mote") {
                  return (
                    <G key={marker.semanticKey}>
                      <Circle cx={marker.x} cy={marker.y} r={6 * marker.scale} fill="#E9D88C" opacity={0.08} />
                      <Circle cx={marker.x} cy={marker.y} r={1.8 * marker.scale} fill="#E6D07A" opacity={0.82} />
                    </G>
                  );
                }

                return (
                  <G key={marker.semanticKey}>
                    <Path
                      d={`M ${marker.x - 1},${marker.y + 2} C ${marker.x - 7},${marker.y} ${marker.x - 8},${marker.y - 5} ${marker.x - 2},${marker.y - 7} C ${marker.x + 5},${marker.y - 5} ${marker.x + 6},${marker.y} ${marker.x - 1},${marker.y + 2} Z`}
                      fill="#927B4E"
                      stroke="#B7A36D"
                      strokeWidth={0.7}
                    />
                    <Path
                      d={`M ${marker.x - 1},${marker.y + 1} L ${marker.x - 2},${marker.y - 6}`}
                      stroke="#5F5137"
                      strokeWidth={0.7}
                    />
                  </G>
                );
              })}
            </G>

            {/* 3B-E. Unified Canopy Presentation Group */}
            {/* Scales and translates in lockstep with the tree structure */}
            {showFutureCanopyLayers && <G
              id="canopy-presentation-group"
              transform={`translate(${presentationTransform.offsetX.toFixed(2)}, ${presentationTransform.offsetY.toFixed(2)}) scale(${presentationTransform.totalScale.toFixed(4)})`}
            >
              {/* 3B. Earned Reconnection Shoots (Fresh spring oak leaf flush) */}
              <G id="blossoms-layer">
              {scene.blossoms.map((blossom) => {
                let adapted = { x: blossom.cx, y: blossom.cy };
                if (isMatureOakStructure || isBranchingOakStructure) {
                  adapted = adaptCanonicalAnchorToPainterly({
                    assetKey: renderPlan.structureAssetKey || (isBranchingOakStructure ? "painterly-oak-branching-v1" : "painterly-oak-mature-v1"),
                    stageKey,
                    canonicalAnchor: { x: blossom.cx, y: blossom.cy },
                    role: "blossom",
                  });
                }
                const dx = adapted.x - blossom.cx;
                const dy = adapted.y - blossom.cy;

                // When foliage proof is displayed, suppress placeholder SVG at branch-scaffold-right-upper (554.4, 103.8)
                if (
                  effectiveShowFoliageProof &&
                  Math.hypot(adapted.x - 554.4, adapted.y - 103.8) < 14
                ) {
                  return null;
                }

                const bx = blossom.cx;
                const by = blossom.cy;
                const r = blossom.r;

                // Shoot emerges directly from branch wood surface
                const dir = bx >= 400 ? 1 : -1;
                const shootHeadX = bx + dir * 3.5;
                const shootHeadY = by - 7.5;
                const twigPath = `M ${bx.toFixed(1)},${by.toFixed(1)} Q ${(bx + dir * 1.5).toFixed(1)},${(by - 4).toFixed(1)} ${shootHeadX.toFixed(1)},${shootHeadY.toFixed(1)}`;

                // Tender spring leaf flush: 3 young lobed oak leaves in authentic muted woodland greens
                // #56723D, #6A864D, #435B2E
                // Leaf 1: Main upright shoot leaf (#56723D)
                const l1Tx = shootHeadX + dir * 3;
                const l1Ty = shootHeadY - Math.max(13, r * 1.7);
                const leaf1D = createOakLobedLeafD(shootHeadX, shootHeadY, l1Tx, l1Ty, 0.35);
                const vein1D = createLeafVeinD(shootHeadX, shootHeadY, l1Tx, l1Ty, dir * 1, -1, false);

                // Leaf 2: Lateral leaf (#6A864D)
                const l2Tx = shootHeadX - dir * Math.max(10, r * 1.3);
                const l2Ty = shootHeadY - Math.max(7, r * 0.9);
                const leaf2D = createOakLobedLeafD(shootHeadX, shootHeadY, l2Tx, l2Ty, 0.35);
                const vein2D = createLeafVeinD(shootHeadX, shootHeadY, l2Tx, l2Ty, -dir * 1, -1, false);

                // Leaf 3: Opposite spreading leaf (#435B2E)
                const l3Tx = shootHeadX + dir * Math.max(12, r * 1.5);
                const l3Ty = shootHeadY - Math.max(4, r * 0.6);
                const leaf3D = createOakLobedLeafD(shootHeadX, shootHeadY, l3Tx, l3Ty, 0.32);
                const vein3D = createLeafVeinD(shootHeadX, shootHeadY, l3Tx, l3Ty, dir * 1, 0, false);

                return (
                  <G
                    key={blossom.id}
                    transform={
                      dx !== 0 || dy !== 0
                        ? `translate(${dx.toFixed(2)}, ${dy.toFixed(2)})`
                        : undefined
                    }
                  >
                    {/* Woody support twig connecting directly out from branch wood */}
                    <Path
                      d={twigPath}
                      stroke={scene.palette.trunk || "#4E3629"}
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      fill="none"
                    />

                    {/* Vegetative terminal bud scale / bark collar embedded on branch wood surface */}
                    <Ellipse
                      cx={bx}
                      cy={by}
                      rx={2.2}
                      ry={1.5}
                      fill="#3D2817"
                      opacity={0.95}
                    />

                    {/* Leaf 2 (Lateral leaf #6A864D) */}
                    <Path
                      d={leaf2D}
                      fill="#6A864D"
                      opacity={0.92}
                    />
                    <Path
                      d={vein2D}
                      stroke="#384B24"
                      strokeWidth={0.6}
                      strokeLinecap="round"
                      fill="none"
                      opacity={0.8}
                    />

                    {/* Leaf 3 (Lateral leaf #435B2E) */}
                    <Path
                      d={leaf3D}
                      fill="#435B2E"
                      opacity={0.92}
                    />
                    <Path
                      d={vein3D}
                      stroke="#2C3D1E"
                      strokeWidth={0.6}
                      strokeLinecap="round"
                      fill="none"
                      opacity={0.8}
                    />

                    {/* Leaf 1 (Main upright shoot leaf #56723D) */}
                    <Path
                      d={leaf1D}
                      fill="#56723D"
                      opacity={0.96}
                    />
                    <Path
                      d={vein1D}
                      stroke="#384B24"
                      strokeWidth={0.6}
                      strokeLinecap="round"
                      fill="none"
                      opacity={0.85}
                    />
                  </G>
                );
              })}
            </G>

            {/* 3C. Positive Moment Canopy Accents */}
            <G id="canopy-accents-layer">
              {canopyAccents.map((detail) => {
                let dx = 0;
                let dy = 0;
                let adaptedX = 0;
                let adaptedY = 0;
                if (isMatureOakStructure || isBranchingOakStructure) {
                  const firstPt = detail.buds?.[0] || detail.berries?.[0];
                  if (firstPt) {
                    const adapted = adaptCanonicalAnchorToPainterly({
                      assetKey: renderPlan.structureAssetKey || (isBranchingOakStructure ? "painterly-oak-branching-v1" : "painterly-oak-mature-v1"),
                      stageKey,
                      canonicalAnchor: { x: firstPt.cx, y: firstPt.cy },
                      role: "foliage_shoot",
                    });
                    dx = adapted.x - firstPt.cx;
                    dy = adapted.y - firstPt.cy;
                    adaptedX = adapted.x;
                    adaptedY = adapted.y;
                  }
                }

                // When foliage proof is displayed, suppress placeholder SVG at branch-scaffold-right-upper (554.4, 103.8)
                if (
                  effectiveShowFoliageProof &&
                  adaptedX > 0 &&
                  Math.hypot(adaptedX - 554.4, adaptedY - 103.8) < 14
                ) {
                  return null;
                }

                return (
                  <G
                    key={detail.id}
                    transform={
                      dx !== 0 || dy !== 0
                        ? `translate(${dx.toFixed(2)}, ${dy.toFixed(2)})`
                        : undefined
                    }
                  >
                    {detail.stemPath && (
                      <Path
                        d={detail.stemPath}
                        stroke={detail.stemColor || scene.palette.trunk}
                        strokeWidth={detail.stemWidth ?? 1.5}
                        strokeLinecap="round"
                        fill="none"
                      />
                    )}
                    {detail.leaves?.map((lf) => (
                      <G key={lf.id}>
                        <Path
                          d={lf.d}
                          fill={lf.color}
                          opacity={0.94}
                        />
                        {lf.veinD && (
                          <Path
                            d={lf.veinD}
                            stroke={lf.veinColor || "#384E25"}
                            strokeWidth={0.8}
                            strokeLinecap="round"
                            fill="none"
                            opacity={0.85}
                          />
                        )}
                      </G>
                    ))}
                    {detail.buds?.map((bd) => {
                      const budBase = bd.cy + bd.ry * 0.4;
                      const budTip = bd.cy - bd.ry * 1.1;
                      const budLeft = bd.cx - bd.rx;
                      const budRight = bd.cx + bd.rx;
                      const budPath = `M ${budLeft.toFixed(1)},${budBase.toFixed(1)} Q ${bd.cx.toFixed(1)},${bd.cy.toFixed(1)} ${budLeft.toFixed(1)},${budTip.toFixed(1)} Q ${bd.cx.toFixed(1)},${(budTip - 1).toFixed(1)} ${budRight.toFixed(1)},${budTip.toFixed(1)} Q ${bd.cx.toFixed(1)},${bd.cy.toFixed(1)} ${budRight.toFixed(1)},${budBase.toFixed(1)} Z`;
                      return (
                        <G key={bd.id}>
                          <Ellipse
                            cx={bd.cx}
                            cy={budBase}
                            rx={bd.rx * 0.9}
                            ry={bd.ry * 0.45}
                            fill="#3B281B"
                            opacity={0.9}
                          />
                          <Path
                            d={budPath}
                            fill={bd.budColor || "#5C4A32"}
                            opacity={0.95}
                          />
                          <Path
                            d={`M ${(bd.cx - bd.rx * 0.4).toFixed(1)},${bd.cy.toFixed(1)} Q ${bd.cx.toFixed(1)},${(bd.cy - bd.ry * 0.5).toFixed(1)} ${(bd.cx + bd.rx * 0.4).toFixed(1)},${bd.cy.toFixed(1)}`}
                            stroke="#7D6646"
                            strokeWidth={0.6}
                            fill="none"
                            opacity={0.7}
                          />
                        </G>
                      );
                    })}
                    {detail.berries?.map((br) => {
                      const r = br.rx || 2.5;
                      const cupuleW = r * 1.25;
                      const cupuleH = r * 0.8;
                      const nutH = r * 1.5;
                      return (
                        <G key={br.id}>
                          <Path
                            d={`M ${(br.cx - r).toFixed(1)},${br.cy.toFixed(1)} C ${(br.cx - r).toFixed(1)},${(br.cy + nutH * 0.7).toFixed(1)} ${(br.cx - r * 0.3).toFixed(1)},${(br.cy + nutH).toFixed(1)} ${br.cx.toFixed(1)},${(br.cy + nutH).toFixed(1)} C ${(br.cx + r * 0.3).toFixed(1)},${(br.cy + nutH).toFixed(1)} ${(br.cx + r).toFixed(1)},${(br.cy + nutH * 0.7).toFixed(1)} ${(br.cx + r).toFixed(1)},${br.cy.toFixed(1)} Z`}
                            fill={br.color || "#685038"}
                            opacity={0.95}
                          />
                          <Path
                            d={`M ${(br.cx - cupuleW).toFixed(1)},${br.cy.toFixed(1)} C ${(br.cx - cupuleW).toFixed(1)},${(br.cy - cupuleH).toFixed(1)} ${(br.cx + cupuleW).toFixed(1)},${(br.cy - cupuleH).toFixed(1)} ${(br.cx + cupuleW).toFixed(1)},${br.cy.toFixed(1)} Z`}
                            fill="#463525"
                            opacity={0.95}
                          />
                          <Path
                            d={`M ${(br.cx - cupuleW * 0.7).toFixed(1)},${(br.cy - cupuleH * 0.3).toFixed(1)} Q ${br.cx.toFixed(1)},${(br.cy - cupuleH * 0.6).toFixed(1)} ${(br.cx + cupuleW * 0.7).toFixed(1)},${(br.cy - cupuleH * 0.3).toFixed(1)}`}
                            stroke="#2C1F16"
                            strokeWidth={0.6}
                            fill="none"
                            opacity={0.8}
                          />
                        </G>
                      );
                    })}
                  </G>
                );
              })}
            </G>

            {/* 3D. Seed Pods and Fruit in Mature Stages */}
            {scene.seedPods && scene.seedPods.length > 0 && (
              <G id="seed-pods-layer">
                {scene.seedPods.map((pod) => (
                  <G key={pod.id}>
                    <Path
                      d={`M ${pod.cx},${pod.cy - pod.ry} Q ${pod.cx + 2},${pod.cy - pod.ry - 6} ${pod.cx + 4},${pod.cy - pod.ry - 10}`}
                      stroke={pod.stemColor || "#5C4033"}
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      fill="none"
                    />
                    <Ellipse
                      cx={pod.cx}
                      cy={pod.cy}
                      rx={pod.rx}
                      ry={pod.ry}
                      fill={pod.color}
                      opacity={0.92}
                    />
                  </G>
                ))}
              </G>
            )}

            {/* 3E. Canopy Living Habitats & Perched Wildlife */}
            {canopyHabitats.length > 0 && (
              <G id="habitats-fauna-layer">
                {canopyHabitats.map((hab) => {
                  const s = hab.scale || 1.0;
                  const dir = hab.flip ? -1 : 1;
                  if (hab.kind === "bird-perch") {
                    return (
                      <G key={hab.id}>
                        {hab.stemPath && (
                          <Path
                            d={hab.stemPath}
                            stroke={hab.accentColor || scene.palette.trunk}
                            strokeWidth={1.4}
                            strokeLinecap="round"
                            fill="none"
                          />
                        )}
                        <Ellipse
                          cx={hab.cx}
                          cy={hab.cy}
                          rx={3.5 * s}
                          ry={2.2 * s}
                          fill={hab.primaryColor}
                        />
                        <Circle
                          cx={hab.cx - dir * 2.5 * s}
                          cy={hab.cy - 1.5 * s}
                          r={1.8 * s}
                          fill={hab.secondaryColor}
                        />
                      </G>
                    );
                  }
                  if (hab.kind === "butterfly" || hab.kind === "pollinator") {
                    return (
                      <G key={hab.id}>
                        <Ellipse
                          cx={hab.cx}
                          cy={hab.cy}
                          rx={2.8 * s}
                          ry={1.8 * s}
                          fill={hab.primaryColor}
                        />
                        <Circle
                          cx={hab.cx}
                          cy={hab.cy - 1.5 * s}
                          r={1.0 * s}
                          fill={hab.secondaryColor}
                        />
                      </G>
                    );
                  }
                  return (
                    <G key={hab.id}>
                      <Ellipse
                        cx={hab.cx}
                        cy={hab.cy}
                        rx={4.0 * s}
                        ry={2.0 * s}
                        fill={hab.primaryColor}
                      />
                    </G>
                  );
                })}
              </G>
            )}
            </G>}

            {/* 3G. Accessible Highlight Ring / Halo */}
            {highlightCoord && (
              <G id="painterly-story-reveal-halo">
                <Circle
                  cx={highlightCoord.cx}
                  cy={highlightCoord.cy}
                  r={Math.max(16, highlightCoord.r * 1.8)}
                  stroke={scene.palette.blossomCenter || "#D4AF37"}
                  strokeWidth={1.5}
                  strokeDasharray="3,3"
                  fill={scene.palette.blossomSecondary || "#FFFFFF"}
                  fillOpacity={0.22}
                  opacity={0.85}
                />
              </G>
            )}
          </Svg>
          )}

          {/* LAYER 4: Calm Edge Vignette Framing (Intimate, peaceful clearing) */}
          {presentation.edgeVignetteOpacity > 0 && (
            <View
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: 800,
                height: 500,
                borderWidth: 16,
                borderColor: "rgba(18, 22, 18, 0.06)",
                opacity: presentation.edgeVignetteOpacity,
                pointerEvents: "none",
              }}
            />
          )}
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  compactContainer: {
    width: "100%",
    height: 188,
    overflow: "hidden",
    position: "relative",
  },
  fullContainer: {
    width: "100%",
    aspectRatio: 16 / 10,
    minHeight: 280,
    overflow: "hidden",
    position: "relative",
    borderRadius: 24,
  },
  exploreContainer: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    position: "relative",
  },
  innerWrapper: {
    width: "100%",
    height: "100%",
    position: "relative",
    overflow: "hidden",
  },
});
