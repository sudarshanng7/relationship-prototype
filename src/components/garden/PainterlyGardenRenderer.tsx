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

// Production bundled painterly raster assets
const BACKPLATE_ASSET = require("../../../assets/garden/painterly/woodland-backplate-light-v1.png");

export interface PainterlyGardenRendererProps
  extends ProceduralGardenRendererProps {
  rendererMode?: GardenRendererMode;
  atmosphereTone?: GardenAtmosphereTone;
  presentation?: GardenStructuralPresentation;
  hideOverlays?: boolean;
  showWoodland?: boolean;
  cropPreset?: TreeCompositionPresetName;
  showGuides?: boolean;
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
  cropPreset,
  showGuides = false,
  calibrationTransform,
}: PainterlyGardenRendererProps) {
  const sceneId = useId().replace(/:/g, "_");
  const { effectiveTheme } = useTheme();

  // 1. Accessibility & App Lifecycle State
  const [isReduceMotion, setIsReduceMotion] = useState(false);
  const [isBackgrounded, setIsBackgrounded] = useState(false);
  const [containerViewport, setContainerViewport] = useState<Viewport>({
    width: compact ? 360 : 800,
    height: compact ? 160 : 500,
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

  const activeMode = modeProp ?? getGardenRendererMode();
  const isDev = typeof __DEV__ !== "undefined" ? Boolean(__DEV__) : false;

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
        attachmentTarget = habitatMatch.cy >= 435 ? "terrain" : "canopy";
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
  } else if (compact) {
    // Focused compact crop preset: [90, 710] x [20, 475]
    const scale = Math.max(
      activeViewport.width / 620,
      activeViewport.height / 455
    );
    transformMatrix = [
      { translateX: activeViewport.width / 2 },
      { translateY: activeViewport.height / 2 },
      { scale },
      { translateX: -400 },
      { translateY: -247.5 },
    ];
  } else {
    // Full structure cover preset: [0, 800] x [0, 500]
    const scale = Math.max(
      activeViewport.width / 800,
      activeViewport.height / 500
    );
    transformMatrix = [
      { translateX: activeViewport.width / 2 },
      { translateY: activeViewport.height / 2 },
      { scale },
      { translateX: -400 },
      { translateY: -250 },
    ];
  }

  // 7. Ground and Canopy Flora details
  const groundFlora = useMemo(() => {
    return scene.groundDetails.filter((item) => {
      if (compact && item.compact === false) return false;
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
  }, [scene.groundDetails, compact]);

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
      if (
        hab.kind === "bird-perch" ||
        hab.kind === "nest-material" ||
        hab.cy < 420
      ) {
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

  const isMatureOakStructure = renderPlan.structureRenderer === "painterly_asset";

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
            worldBounds={CANONICAL_SCENE_BOUNDS}
            cropPreset={cropPreset}
            showGuides={showGuides}
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
                      {item.florets?.map((fl, fIdx) => (
                        <Circle
                          key={`${item.id}-f-${fIdx}`}
                          cx={fl.cx}
                          cy={fl.cy}
                          r={fl.r}
                          fill={fl.petalColor}
                          opacity={0.95}
                        />
                      ))}
                    </G>
                  );
                }
                if (item.cx && item.cy && item.color) {
                  return (
                    <Circle
                      key={item.id}
                      cx={item.cx}
                      cy={item.cy}
                      r={item.rx || 2.5}
                      fill={item.color}
                      opacity={0.88}
                    />
                  );
                }
                return null;
              })}
              {/* Ground habitats (butterflies, meadow pollinators) */}
              {groundHabitats.map((hab) => {
                const s = hab.scale || 1.0;
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

            {/* 3B-E. Unified Canopy Presentation Group */}
            {/* Scales and translates in lockstep with the tree structure */}
            <G
              id="canopy-presentation-group"
              transform={`translate(${presentationTransform.offsetX.toFixed(2)}, ${presentationTransform.offsetY.toFixed(2)}) scale(${presentationTransform.totalScale.toFixed(4)})`}
            >
              {/* 3B. Earned Reconnection Blossoms & Positive Moments */}
              <G id="blossoms-layer">
              {scene.blossoms.map((blossom) => {
                let dx = 0;
                let dy = 0;
                if (isMatureOakStructure) {
                  const adapted = adaptCanonicalAnchorToPainterly({
                    assetKey: renderPlan.structureAssetKey || "painterly-oak-mature-v1",
                    stageKey: "garden_in_bloom",
                    canonicalAnchor: { x: blossom.cx, y: blossom.cy },
                    role: "blossom",
                  });
                  dx = adapted.x - blossom.cx;
                  dy = adapted.y - blossom.cy;
                }

                const bx = blossom.cx;
                const by = blossom.cy;
                const r = blossom.r;

                // Physical woody support twig terminating directly on visible branch geometry
                const targetBranchX = blossom.branchAnchor?.x ?? (bx >= 400 ? bx - 6 : bx + 6);
                const targetBranchY = blossom.branchAnchor?.y ?? (by + r + 8);
                const midX = (bx + targetBranchX) / 2 + (bx >= 400 ? -1.5 : 1.5);
                const midY = (by + targetBranchY) / 2;
                const twigPath = `M ${bx.toFixed(1)},${(by + r * 0.2).toFixed(1)} Q ${midX.toFixed(1)},${midY.toFixed(1)} ${targetBranchX.toFixed(1)},${targetBranchY.toFixed(1)}`;

                // Floral sepal calyx hugging the blossom base and oriented toward the branch wood
                const tdx = targetBranchX - bx;
                const tdy = targetBranchY - by;
                const tdist = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
                const unx = tdx / tdist;
                const uny = tdy / tdist;
                const upx = -uny;
                const upy = unx;
                const sepalSpread = r * 0.55;
                const calyxTipX = bx + unx * (r + 2.5);
                const calyxTipY = by + uny * (r + 2.5);
                const calyxLeftX = bx - upx * sepalSpread;
                const calyxLeftY = by - upy * sepalSpread;
                const calyxRightX = bx + upx * sepalSpread;
                const calyxRightY = by + upy * sepalSpread;
                const calyxPath = `M ${calyxLeftX.toFixed(1)},${calyxLeftY.toFixed(1)} Q ${bx.toFixed(1)},${by.toFixed(1)} ${calyxRightX.toFixed(1)},${calyxRightY.toFixed(1)} L ${calyxTipX.toFixed(1)},${calyxTipY.toFixed(1)} Z`;

                return (
                  <G
                    key={blossom.id}
                    transform={
                      dx !== 0 || dy !== 0
                        ? `translate(${dx.toFixed(2)}, ${dy.toFixed(2)})`
                        : undefined
                    }
                  >
                    {/* Structural woody support twig */}
                    <Path
                      d={twigPath}
                      stroke={scene.palette.trunk || "#4E3629"}
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      fill="none"
                    />

                    {/* Floral sepal calyx */}
                    <Path
                      d={calyxPath}
                      fill="#3B5323"
                      opacity={0.95}
                    />

                    {blossom.petals ? (
                      blossom.petals.map((petal, pIdx) => (
                        <Path
                          key={`${blossom.id}-p-${pIdx}`}
                          d={petal.d}
                          fill={petal.fill}
                          opacity={petal.opacity}
                        />
                      ))
                    ) : (
                      <Circle
                        cx={blossom.cx}
                        cy={blossom.cy}
                        r={blossom.r}
                        fill={blossom.color}
                      />
                    )}
                    <Circle
                      cx={blossom.cx}
                      cy={blossom.cy}
                      r={blossom.centerRadius || Math.max(1.8, blossom.r * 0.32)}
                      fill={blossom.centerColor || scene.palette.blossomCenter}
                      opacity={0.92}
                    />
                    <Circle
                      cx={blossom.cx - blossom.r * 0.08}
                      cy={blossom.cy - blossom.r * 0.08}
                      r={Math.max(0.8, blossom.r * 0.12)}
                      fill={blossom.highlightColor || scene.palette.blossomCream}
                      opacity={0.45}
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
                if (isMatureOakStructure) {
                  const firstPt = detail.buds?.[0] || detail.berries?.[0];
                  if (firstPt) {
                    const adapted = adaptCanonicalAnchorToPainterly({
                      assetKey: renderPlan.structureAssetKey || "painterly-oak-mature-v1",
                      stageKey: "garden_in_bloom",
                      canonicalAnchor: { x: firstPt.cx, y: firstPt.cy },
                      role: "foliage_shoot",
                    });
                    dx = adapted.x - firstPt.cx;
                    dy = adapted.y - firstPt.cy;
                  }
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
                      <Path
                        key={lf.id}
                        d={lf.d}
                        fill={lf.color}
                        opacity={0.94}
                      />
                    ))}
                    {detail.buds?.map((bd) => (
                      <Ellipse
                        key={bd.id}
                        cx={bd.cx}
                        cy={bd.cy}
                        rx={bd.rx}
                        ry={bd.ry}
                        fill={bd.budColor}
                      />
                    ))}
                    {detail.berries?.map((br) => (
                      <Circle
                        key={br.id}
                        cx={br.cx}
                        cy={br.cy}
                        r={br.rx || 2.5}
                        fill={br.color}
                      />
                    ))}
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
            </G>

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
    height: 160,
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
