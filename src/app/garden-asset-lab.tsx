import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image as RNImage,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import {
  CANONICAL_SCENE_BOUNDS,
  EXPANDED_WORLD_BOUNDS,
  type BoundingBox2D,
  type GardenCameraState,
  type Point2D,
} from "@/lib/garden/world-types";
import {
  calculateZoomBounds,
  createCameraFromFit,
  type Viewport,
} from "@/lib/garden/world-projection";
import {
  PAINTERLY_OAK_STRUCTURE_MATURE_V1,
  adaptCanonicalAnchorToPainterly,
  classifyAnchorAttachment,
} from "@/lib/garden/asset-manifest";
import {
  FIXTURE_COUPLE_SEEDS,
  generateMockEventSequence,
} from "@/lib/garden/garden-fixtures";
import { generateGardenSVGScene } from "@/lib/garden-generator";
import { buildGardenWorld } from "@/lib/garden/build-garden-world";

// Load painterly raster assets directly via require
const backplateAsset = require("../../assets/garden/painterly/woodland-backplate-light-v1.png");
const oakAsset = require("../../assets/garden/painterly/oak-structure-mature-alpha-v1.png");

/**
 * Reusable hook to safely resolve bundled image asset URIs without calling
 * native asset resolution methods, preventing crashes on Expo Web.
 */
export function useBundledAssetUri(moduleRef: any): {
  uri: string | null;
  isLoading: boolean;
  error: Error | null;
} {
  const [state, setState] = useState<{ uri: string | null; isLoading: boolean; error: Error | null }>({
    uri: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;
    try {
      if (!moduleRef) {
        if (isMounted) setState({ uri: null, isLoading: false, error: new Error("No module reference provided") });
        return;
      }

      let resolvedUri: string | null = null;
      if (typeof moduleRef === "string") {
        resolvedUri = moduleRef;
      } else if (typeof moduleRef === "object" && moduleRef !== null) {
        if (typeof moduleRef.default === "string") {
          resolvedUri = moduleRef.default;
        } else if (typeof moduleRef.uri === "string") {
          resolvedUri = moduleRef.uri;
        } else if (typeof moduleRef.default === "object" && moduleRef.default && typeof moduleRef.default.src === "string") {
          resolvedUri = moduleRef.default.src;
        }
      }

      if (isMounted) {
        setState({
          uri: resolvedUri,
          isLoading: false,
          error: null,
        });
      }
    } catch (err: any) {
      if (isMounted) {
        setState({
          uri: null,
          isLoading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    }

    return () => {
      isMounted = false;
    };
  }, [moduleRef]);

  return state;
}

// Calibrated baseline parameters
const DEFAULT_CALIBRATION = {
  backplate: {
    mode: "canonical" as "canonical" | "expanded" | "custom",
    x: 0,
    y: 0,
    width: 800,
    height: 500,
    opacity: 1.0,
  },
  oak: {
    x: 0,
    y: 0,
    scale: 1.0,
    scaleX: 1.0,
    rotation: 0,
    opacity: 1.0,
    pivotX: 390.4,
    pivotY: 441.0,
  },
};

export default function GardenAssetLabScreen() {
  // 1. Strict __DEV__ Guard: Redirect safely in production
  if (!__DEV__) {
    return <Redirect href="/garden" />;
  }

  const router = useRouter();
  const containerRef = useRef<View>(null);

  // Asset URI resolution tracking
  const backplateUriState = useBundledAssetUri(backplateAsset);
  const oakUriState = useBundledAssetUri(oakAsset);

  // Viewport layout
  const [viewport, setViewport] = useState<Viewport>({ width: 400, height: 600 });
  const [hasLayout, setHasLayout] = useState(false);

  // Calibration state: Backplate
  const [backplateConfig, setBackplateConfig] = useState(DEFAULT_CALIBRATION.backplate);

  // Calibration state: Mature Oak Cutout
  const [oakConfig, setOakConfig] = useState(DEFAULT_CALIBRATION.oak);

  // Crop Preset Selection
  const [activeCropMode, setActiveCropMode] = useState<"full_structure" | "focused_compact">("full_structure");
  const [showCropOverlay, setShowCropOverlay] = useState(true);

  // Fixture scenario selection
  const [fixtureSeedKey, setFixtureSeedKey] = useState<keyof typeof FIXTURE_COUPLE_SEEDS>("ALPHA");
  const [fixtureEventCount, setFixtureEventCount] = useState<number>(25);

  // World debugging overlay toggles
  const [showCanonicalBounds, setShowCanonicalBounds] = useState(true);
  const [showExpandedBounds, setShowExpandedBounds] = useState(true);
  const [showCenterCrosshair, setShowCenterCrosshair] = useState(true);
  const [showSoilBaseline, setShowSoilBaseline] = useState(true);
  const [showProceduralTrunk, setShowProceduralTrunk] = useState(false);
  const [showBranchAnchors, setShowBranchAnchors] = useState(true);
  const [showScenicRegions, setShowScenicRegions] = useState(false);
  const [showFixtureAnchors, setShowFixtureAnchors] = useState(true);
  const [useAdaptedMapping, setUseAdaptedMapping] = useState(true);
  const [showLegend, setShowLegend] = useState(true);

  // Layer visibility toggles
  const [showBackplate, setShowBackplate] = useState(true);
  const [showOak, setShowOak] = useState(true);

  // UI Control Panel collapsed/expanded
  const [isControlsExpanded, setIsControlsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<"placement" | "crop" | "debug" | "fixtures" | "code">("placement");

  // Camera state
  const [camera, setCamera] = useState<GardenCameraState>({
    targetX: 400,
    targetY: 250,
    zoom: 1.0,
    viewportWidth: 400,
    viewportHeight: 600,
  });

  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const dragStartCameraRef = useRef<GardenCameraState | null>(null);

  // Initialize camera when layout is first measured
  const handleLayout = useCallback(
    (event: any) => {
      const { width, height } = event.nativeEvent.layout;
      if (width <= 0 || height <= 0) return;
      setViewport({ width, height });
      if (!hasLayout) {
        setHasLayout(true);
        const fit = createCameraFromFit(CANONICAL_SCENE_BOUNDS, { width, height }, 20);
        setCamera(fit);
      } else {
        setCamera((prev) => ({
          ...prev,
          viewportWidth: width,
          viewportHeight: height,
        }));
      }
    },
    [hasLayout]
  );

  // Pan Responder for interactive panning
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.hypot(gesture.dx, gesture.dy) > 4,
        onPanResponderGrant: () => {
          dragStartCameraRef.current = cameraRef.current;
        },
        onPanResponderMove: (_, gesture) => {
          if (!dragStartCameraRef.current) return;
          const initial = dragStartCameraRef.current;
          const safeZoom = Math.max(0.01, initial.zoom);
          setCamera((prev) => ({
            ...prev,
            targetX: Math.round((initial.targetX - gesture.dx / safeZoom) * 100) / 100,
            targetY: Math.round((initial.targetY - gesture.dy / safeZoom) * 100) / 100,
          }));
        },
        onPanResponderRelease: () => {
          dragStartCameraRef.current = null;
        },
      }),
    []
  );

  // Web Wheel Zoom listener (non-passive, preventDefault)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const el = containerRef.current as any;
    if (!el || typeof el.addEventListener !== "function") return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      setCamera((prev) => {
        const newZoom = Math.max(0.15, Math.min(5.0, prev.zoom * factor));
        return {
          ...prev,
          zoom: Math.round(newZoom * 1000) / 1000,
        };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  // Compute deterministic GardenWorld & scene
  const coupleSeed = FIXTURE_COUPLE_SEEDS[fixtureSeedKey];
  const events = useMemo(
    () => generateMockEventSequence(fixtureEventCount, "mixed"),
    [fixtureEventCount]
  );

  const scene = useMemo(
    () => generateGardenSVGScene(coupleSeed, 95, 40, false, undefined, "light", events),
    [coupleSeed, events]
  );

  const world = useMemo(
    () =>
      buildGardenWorld(scene, {
        coupleId: coupleSeed,
        seedString: coupleSeed,
        totalGrowthUnits: 95,
        careGrowthUnits: 40,
        timeGrowthUnits: 55,
        careEvents: events,
      }),
    [scene, coupleSeed, events]
  );

  // Quick camera presets
  const handleFitCanonical = useCallback(() => {
    const fit = createCameraFromFit(CANONICAL_SCENE_BOUNDS, viewport, 20);
    setCamera(fit);
  }, [viewport]);

  const handleFitExpanded = useCallback(() => {
    const fit = createCameraFromFit(EXPANDED_WORLD_BOUNDS, viewport, 20);
    setCamera(fit);
  }, [viewport]);

  const handleFocusCrown = useCallback(() => {
    setCamera((prev) => ({
      ...prev,
      targetX: 400,
      targetY: 180,
      zoom: 1.8,
    }));
  }, []);

  const handleFocusRoots = useCallback(() => {
    setCamera((prev) => ({
      ...prev,
      targetX: 400,
      targetY: 440,
      zoom: 1.8,
    }));
  }, []);

  const handleResetCalibration = useCallback(() => {
    setBackplateConfig(DEFAULT_CALIBRATION.backplate);
    setOakConfig(DEFAULT_CALIBRATION.oak);
    setActiveCropMode("full_structure");
  }, []);

  // Backplate Crop Mode selection
  const handleSelectBackplateMode = useCallback((mode: "canonical" | "expanded" | "custom") => {
    if (mode === "canonical") {
      setBackplateConfig({
        mode: "canonical",
        x: 0,
        y: 0,
        width: 800,
        height: 500,
        opacity: 1.0,
      });
    } else if (mode === "expanded") {
      setBackplateConfig({
        mode: "expanded",
        x: -100,
        y: -62.5,
        width: 1000,
        height: 625.5,
        opacity: 1.0,
      });
    } else {
      setBackplateConfig((prev) => ({ ...prev, mode: "custom" }));
    }
  }, []);

  // Classify all fixture anchors accurately
  const classifiedFixtureAnchors = useMemo(() => {
    const list: Array<{
      key: string;
      rawAnchor: Point2D;
      targetAnchor: Point2D;
      kind: string;
      surface: string;
      validity: string;
      color: string;
      statusLabel: string;
      explanation: string;
    }> = [];

    for (const [key, group] of Object.entries(world.earnedFeatureGroups)) {
      const rawAnchor = group.anchor;
      const role =
        group.sourceEvent.kind === "reconnection"
          ? "blossom"
          : group.sourceEvent.kind === "important_date"
          ? "landmark"
          : rawAnchor.y > 360
          ? "ground_flora"
          : "foliage_shoot";

      // Pure asset-specific adaptation
      const targetAnchor = useAdaptedMapping
        ? adaptCanonicalAnchorToPainterly({
            assetKey: "painterly-oak-structure-mature-v1",
            stageKey: "garden_in_bloom",
            canonicalAnchor: rawAnchor,
            role,
          })
        : rawAnchor;

      const classification = classifyAnchorAttachment(rawAnchor, role, PAINTERLY_OAK_STRUCTURE_MATURE_V1);

      let color = "#22D3EE"; // Wood (cyan)
      let statusLabel = "Wood";
      if (classification.validity === "valid_on_ground") {
        color = "#F59E0B"; // Ground (amber)
        statusLabel = "Ground";
      } else if (classification.validity === "near_branch_tip") {
        color = "#14B8A6"; // Near tip (teal)
        statusLabel = "Near Tip";
      } else if (classification.validity === "pending_foliage") {
        color = "#C084FC"; // Pending foliage (purple)
        statusLabel = "Pending Foliage";
      } else if (classification.validity === "invalid_void") {
        color = "#EF4444"; // Invalid void (red)
        statusLabel = "Void";
      }

      list.push({
        key,
        rawAnchor,
        targetAnchor,
        kind: group.sourceEvent.kind,
        surface: classification.surface,
        validity: classification.validity,
        color,
        statusLabel,
        explanation: classification.explanation,
      });
    }
    return list;
  }, [world.earnedFeatureGroups, useAdaptedMapping]);

  // Summary counts
  const summaryCounts = useMemo(() => {
    let wood = 0,
      ground = 0,
      nearTip = 0,
      pendingFoliage = 0,
      invalidVoid = 0;
    for (const item of classifiedFixtureAnchors) {
      if (item.validity === "valid_on_wood") wood++;
      else if (item.validity === "valid_on_ground") ground++;
      else if (item.validity === "near_branch_tip") nearTip++;
      else if (item.validity === "pending_foliage") pendingFoliage++;
      else if (item.validity === "invalid_void") invalidVoid++;
    }
    return { wood, ground, nearTip, pendingFoliage, invalidVoid, total: classifiedFixtureAnchors.length };
  }, [classifiedFixtureAnchors]);

  // Active crop preset
  const activeCropPreset = PAINTERLY_OAK_STRUCTURE_MATURE_V1.cropPresets?.[activeCropMode]!;

  return (
    <View style={styles.container}>
      {/* 1. Header Toolbar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.push("/garden")}
            accessibilityRole="button"
            accessibilityLabel="Return to Garden"
          >
            <Text style={styles.backButtonText}>← Exit Lab</Text>
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>Purple Garden — Painterly Asset Lab</Text>
            <Text style={styles.headerSubtitle}>
              Calibrating oak wood framework (roots, trunk, branches; no foliage) & backplate
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Pressable style={styles.pillButton} onPress={handleFitCanonical}>
            <Text style={styles.pillButtonText}>Fit Canonical</Text>
          </Pressable>
          <Pressable style={styles.pillButton} onPress={handleFitExpanded}>
            <Text style={styles.pillButtonText}>Fit Expanded</Text>
          </Pressable>
          <Pressable style={styles.pillButton} onPress={handleFocusCrown}>
            <Text style={styles.pillButtonText}>Crown</Text>
          </Pressable>
          <Pressable style={styles.pillButton} onPress={handleFocusRoots}>
            <Text style={styles.pillButtonText}>Roots</Text>
          </Pressable>
          <Pressable
            style={[styles.pillButton, styles.pillButtonPrimary]}
            onPress={() => setIsControlsExpanded((prev) => !prev)}
          >
            <Text style={styles.pillButtonPrimaryText}>
              {isControlsExpanded ? "Hide Controls" : "Controls & HUD"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* 2. Unified Canvas Viewport (Safe Fallback: Transformed World Parent View) */}
      <View
        ref={containerRef}
        style={styles.canvasContainer}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        {/*
          SHARED TRANSFORMED WORLD VIEW
          Ensures that Backplate Image, Oak Cutout Image, and SVG Overlays share
          identical camera translation and scale, guaranteeing zero pixel drift.
        */}
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 0,
            height: 0,
            overflow: "visible",
            transform: [
              { translateX: viewport.width / 2 },
              { translateY: viewport.height / 2 },
              { scale: camera.zoom },
              { translateX: -camera.targetX },
              { translateY: -camera.targetY },
            ],
          }}
        >
          {/* Extended background fill in world space */}
          <View
            style={{
              position: "absolute",
              left: -250,
              top: -150,
              width: 1300,
              height: 850,
              backgroundColor: "#0F172A",
            }}
          />

          {/* LAYER 1: Painterly Woodland Backplate (Standard RN Image) */}
          {showBackplate && (
            <RNImage
              source={backplateAsset}
              style={{
                position: "absolute",
                left: backplateConfig.x,
                top: backplateConfig.y,
                width: backplateConfig.width,
                height: backplateConfig.height,
                opacity: backplateConfig.opacity,
              }}
              resizeMode="stretch"
            />
          )}

          {/* LAYER 2: Painterly Ancient Oak Wood Cutout (Standard RN Image) */}
          {showOak && (
            <View
              style={{
                position: "absolute",
                left: oakConfig.x,
                top: oakConfig.y,
                width: 800,
                height: 500,
                transformOrigin: `${oakConfig.pivotX}px ${oakConfig.pivotY}px`,
                transform: [
                  { scale: oakConfig.scale },
                  { scaleX: oakConfig.scaleX },
                  { rotate: `${oakConfig.rotation}deg` },
                ],
              }}
            >
              <RNImage
                source={oakAsset}
                style={{
                  width: 800,
                  height: 500,
                  opacity: oakConfig.opacity,
                }}
                resizeMode="stretch"
              />
            </View>
          )}

          {/* LAYER 3: Aligned SVG Overlay for Guides & Anchors */}
          <Svg
            style={{
              position: "absolute",
              left: -250,
              top: -150,
              width: 1300,
              height: 850,
              pointerEvents: "none",
            }}
            viewBox="-250 -150 1300 850"
          >
            {/* Procedural Trunk Silhouette Overlay */}
            {showProceduralTrunk && (
              <G opacity={0.45}>
                {scene.trunkPath && (
                  <Path
                    d={scene.trunkPath}
                    fill={scene.palette.trunk}
                    stroke="#F59E0B"
                    strokeWidth={1.5}
                    strokeDasharray="4,4"
                  />
                )}
                {scene.branches.map((b, i) => (
                  <Path key={`proc-branch-${i}`} d={b} fill={scene.palette.trunk} stroke="#F59E0B" strokeWidth={1} />
                ))}
              </G>
            )}

            {/* Scenic Regions */}
            {showScenicRegions && (
              <G opacity={0.6}>
                <Rect
                  x={PAINTERLY_OAK_STRUCTURE_MATURE_V1.crownBounds!.minX}
                  y={PAINTERLY_OAK_STRUCTURE_MATURE_V1.crownBounds!.minY}
                  width={PAINTERLY_OAK_STRUCTURE_MATURE_V1.crownBounds!.width}
                  height={PAINTERLY_OAK_STRUCTURE_MATURE_V1.crownBounds!.height}
                  fill="#A855F7"
                  fillOpacity={0.06}
                  stroke="#A855F7"
                  strokeWidth={1.5}
                  strokeDasharray="5,5"
                />
                <SvgText x={35} y={30} fill="#A855F7" fontSize="11" fontWeight="bold">
                  Crown Bounds (Foliage pending future asset)
                </SvgText>
              </G>
            )}

            {/* Canonical Bounds */}
            {showCanonicalBounds && (
              <G>
                <Rect
                  x="0"
                  y="0"
                  width="800"
                  height="500"
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth={2}
                  strokeDasharray="8,4"
                />
                <SvgText x="10" y="20" fill="#38BDF8" fontSize="11" fontWeight="bold">
                  Canonical Scene Bounds: [0, 800] x [0, 500] (16:10)
                </SvgText>
                <SvgText x="710" y="490" fill="#38BDF8" fontSize="10">
                  (800, 500)
                </SvgText>
              </G>
            )}

            {/* Expanded World Bounds */}
            {showExpandedBounds && (
              <G>
                <Rect
                  x="-100"
                  y="-50"
                  width="1000"
                  height="600"
                  fill="none"
                  stroke="#A855F7"
                  strokeWidth={1.5}
                  strokeDasharray="6,6"
                />
                <SvgText x="-90" y="-30" fill="#A855F7" fontSize="11" fontWeight="bold">
                  Expanded World Bounds: [-100, 900] x [-50, 550]
                </SvgText>
              </G>
            )}

            {/* Active Crop Preset Overlay */}
            {showCropOverlay && (
              <G>
                <Rect
                  x={activeCropPreset.cropBounds.minX}
                  y={activeCropPreset.cropBounds.minY}
                  width={activeCropPreset.cropBounds.width}
                  height={activeCropPreset.cropBounds.height}
                  fill="none"
                  stroke={activeCropPreset.preservesFullStructure ? "#10B981" : "#F59E0B"}
                  strokeWidth={2}
                  strokeDasharray="4,2"
                />
                <SvgText
                  x={activeCropPreset.cropBounds.minX + 8}
                  y={activeCropPreset.cropBounds.maxY - 8}
                  fill={activeCropPreset.preservesFullStructure ? "#10B981" : "#F59E0B"}
                  fontSize="10"
                  fontWeight="bold"
                >
                  {activeCropPreset.cropMode === "full_structure"
                    ? "✓ Full Structure Crop (Preserves Complete Crown & Roots)"
                    : "✂ Focused Compact Crop (Intentionally Trims Peripheral Branch Tips)"}
                </SvgText>
              </G>
            )}

            {/* Soil Baseline & World Center */}
            {showSoilBaseline && (
              <G>
                <Rect x="-100" y="420" width="1000" height="40" fill="#EAB308" fillOpacity={0.08} />
                <Line x1="-100" y1="440" x2="900" y2="440" stroke="#EAB308" strokeWidth={2} strokeDasharray="6,3" />
                <SvgText x="-90" y="435" fill="#EAB308" fontSize="10" fontWeight="bold">
                  Soil Baseline: y = 440 (Root Flare Zone: 420-460)
                </SvgText>
              </G>
            )}

            {showCenterCrosshair && (
              <G>
                <Line x1="400" y1="-50" x2="400" y2="550" stroke="#F43F5E" strokeWidth={1} strokeDasharray="4,4" />
                <Line x1="-100" y1="250" x2="900" y2="250" stroke="#F43F5E" strokeWidth={1} strokeDasharray="4,4" />
                <Circle cx="400" cy="250" r="4" fill="#F43F5E" />
                <SvgText x="408" y="246" fill="#F43F5E" fontSize="10" fontWeight="bold">
                  World Center (400, 250)
                </SvgText>
              </G>
            )}

            {/* Calibrated Branch Attachment Anchors (Wood Only) */}
            {showBranchAnchors && (
              <G>
                {PAINTERLY_OAK_STRUCTURE_MATURE_V1.branchAnchors?.map((ba) => (
                  <G key={`anchor-${ba.id}`}>
                    <Circle cx={ba.worldPoint.x} cy={ba.worldPoint.y} r="5" fill="#22D3EE" stroke="#FFFFFF" strokeWidth={1.5} />
                    <Line
                      x1={ba.worldPoint.x}
                      y1={ba.worldPoint.y}
                      x2={390.4}
                      y2={Math.max(181.5, Math.min(441.0, ba.worldPoint.y))}
                      stroke="#22D3EE"
                      strokeWidth={0.8}
                      strokeDasharray="2,2"
                      opacity={0.6}
                    />
                    <SvgText
                      x={ba.worldPoint.x + 8}
                      y={ba.worldPoint.y - 4}
                      fill="#22D3EE"
                      fontSize="9"
                      fontWeight="bold"
                    >
                      {ba.label} ({ba.worldPoint.x.toFixed(0)}, {ba.worldPoint.y.toFixed(0)})
                    </SvgText>
                  </G>
                ))}
              </G>
            )}

            {/* Earned Fixture Anchors with Exact Attachment Classification */}
            {showFixtureAnchors && (
              <G>
                {classifiedFixtureAnchors.map((item) => {
                  const isAdapted =
                    useAdaptedMapping &&
                    (item.rawAnchor.x !== item.targetAnchor.x || item.rawAnchor.y !== item.targetAnchor.y);

                  return (
                    <G key={`fixture-${item.key}`}>
                      {/* Adaptation Vector */}
                      {isAdapted && (
                        <Line
                          x1={item.rawAnchor.x}
                          y1={item.rawAnchor.y}
                          x2={item.targetAnchor.x}
                          y2={item.targetAnchor.y}
                          stroke="#10B981"
                          strokeWidth={1.5}
                          strokeDasharray="2,2"
                        />
                      )}
                      <Circle
                        cx={item.targetAnchor.x}
                        cy={item.targetAnchor.y}
                        r="4.5"
                        fill={item.color}
                        stroke="#FFFFFF"
                        strokeWidth={1.2}
                      />
                      <SvgText
                        x={item.targetAnchor.x + 6}
                        y={item.targetAnchor.y + 3}
                        fill={item.color}
                        fontSize="8.5"
                        fontWeight="600"
                      >
                        {item.statusLabel} ({item.kind})
                      </SvgText>
                    </G>
                  );
                })}
              </G>
            )}

            {/* Tree Root Collar Marker */}
            <Circle cx={oakConfig.pivotX} cy={oakConfig.pivotY} r="6" fill="#F43F5E" stroke="#FFFFFF" strokeWidth={2} />
            <SvgText x={oakConfig.pivotX + 8} y={oakConfig.pivotY + 4} fill="#F43F5E" fontSize="9" fontWeight="bold">
              Root Collar Pivot ({oakConfig.pivotX}, {oakConfig.pivotY})
            </SvgText>
          </Svg>
        </View>

        {/* Live Coordinate HUD & Legend Overlay */}
        <View style={styles.hudBadge}>
          <Text style={styles.hudBadgeText}>
            Camera: ({camera.targetX.toFixed(1)}, {camera.targetY.toFixed(1)}) • Zoom: {camera.zoom.toFixed(2)}x
          </Text>
          <Text style={styles.hudBadgeSubtext}>
            Stage: {world.stage.label} • Wood Only: hasFoliage=false
          </Text>
        </View>

        {/* Floating Attachment Classification Legend */}
        {showLegend && (
          <View style={styles.legendContainer}>
            <Text style={styles.legendTitle}>Anchor Attachment Classification</Text>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#22D3EE" }]} />
              <Text style={styles.legendText}>Valid on Wood ({summaryCounts.wood})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#14B8A6" }]} />
              <Text style={styles.legendText}>Near Branch Tip ({summaryCounts.nearTip})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#C084FC" }]} />
              <Text style={styles.legendText}>Pending Foliage Asset ({summaryCounts.pendingFoliage})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#F59E0B" }]} />
              <Text style={styles.legendText}>Valid on Ground ({summaryCounts.ground})</Text>
            </View>
            {summaryCounts.invalidVoid > 0 && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
                <Text style={styles.legendText}>Invalid Void ({summaryCounts.invalidVoid})</Text>
              </View>
            )}
            <Text style={styles.legendNote}>
              * No anchors land on painted foliage. The oak asset provides the wood framework only.
            </Text>
          </View>
        )}
      </View>

      {/* 3. Collapsible Calibration Drawer */}
      {isControlsExpanded && (
        <View style={styles.controlPanel}>
          <View style={styles.tabBar}>
            <Pressable
              style={[styles.tabItem, activeTab === "placement" && styles.tabItemActive]}
              onPress={() => setActiveTab("placement")}
            >
              <Text style={[styles.tabItemText, activeTab === "placement" && styles.tabItemTextActive]}>
                🎨 Placement & Scale
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tabItem, activeTab === "crop" && styles.tabItemActive]}
              onPress={() => setActiveTab("crop")}
            >
              <Text style={[styles.tabItemText, activeTab === "crop" && styles.tabItemTextActive]}>
                ✂ Crop Presets
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tabItem, activeTab === "debug" && styles.tabItemActive]}
              onPress={() => setActiveTab("debug")}
            >
              <Text style={[styles.tabItemText, activeTab === "debug" && styles.tabItemTextActive]}>
                📐 Guides & Overlays
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tabItem, activeTab === "fixtures" && styles.tabItemActive]}
              onPress={() => setActiveTab("fixtures")}
            >
              <Text style={[styles.tabItemText, activeTab === "fixtures" && styles.tabItemTextActive]}>
                🌱 Fixture Scenarios
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tabItem, activeTab === "code" && styles.tabItemActive]}
              onPress={() => setActiveTab("code")}
            >
              <Text style={[styles.tabItemText, activeTab === "code" && styles.tabItemTextActive]}>
                📋 Manifest Export
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentInner}>
            {/* TAB 1: PLACEMENT & SCALE */}
            {activeTab === "placement" && (
              <View style={styles.sectionGroup}>
                {/* Backplate Controls */}
                <View style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>Woodland Backplate (1586x992 px)</Text>
                    <Pressable
                      style={[styles.toggleBadge, showBackplate && styles.toggleBadgeActive]}
                      onPress={() => setShowBackplate((prev) => !prev)}
                    >
                      <Text style={styles.toggleBadgeText}>{showBackplate ? "Visible" : "Hidden"}</Text>
                    </Pressable>
                  </View>

                  <View style={styles.buttonRow}>
                    <Pressable
                      style={[styles.segmentBtn, backplateConfig.mode === "canonical" && styles.segmentBtnActive]}
                      onPress={() => handleSelectBackplateMode("canonical")}
                    >
                      <Text style={styles.segmentBtnText}>Canonical Fit (800x500)</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.segmentBtn, backplateConfig.mode === "expanded" && styles.segmentBtnActive]}
                      onPress={() => handleSelectBackplateMode("expanded")}
                    >
                      <Text style={styles.segmentBtnText}>Expanded Fit (1000x625)</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.segmentBtn, backplateConfig.mode === "custom" && styles.segmentBtnActive]}
                      onPress={() => handleSelectBackplateMode("custom")}
                    >
                      <Text style={styles.segmentBtnText}>Custom</Text>
                    </Pressable>
                  </View>

                  <View style={styles.paramGrid}>
                    <View style={styles.paramItem}>
                      <Text style={styles.paramLabel}>X Position: {backplateConfig.x} px</Text>
                      <View style={styles.stepperRow}>
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() => setBackplateConfig((p) => ({ ...p, x: p.x - 10, mode: "custom" }))}
                        >
                          <Text style={styles.stepBtnText}>-10</Text>
                        </Pressable>
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() => setBackplateConfig((p) => ({ ...p, x: p.x + 10, mode: "custom" }))}
                        >
                          <Text style={styles.stepBtnText}>+10</Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.paramItem}>
                      <Text style={styles.paramLabel}>Y Position: {backplateConfig.y} px</Text>
                      <View style={styles.stepperRow}>
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() => setBackplateConfig((p) => ({ ...p, y: p.y - 10, mode: "custom" }))}
                        >
                          <Text style={styles.stepBtnText}>-10</Text>
                        </Pressable>
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() => setBackplateConfig((p) => ({ ...p, y: p.y + 10, mode: "custom" }))}
                        >
                          <Text style={styles.stepBtnText}>+10</Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.paramItem}>
                      <Text style={styles.paramLabel}>Width: {backplateConfig.width} px</Text>
                      <View style={styles.stepperRow}>
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() =>
                            setBackplateConfig((p) => ({
                              ...p,
                              width: p.width - 20,
                              height: Math.round((p.width - 20) * (992 / 1586)),
                              mode: "custom",
                            }))
                          }
                        >
                          <Text style={styles.stepBtnText}>-20</Text>
                        </Pressable>
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() =>
                            setBackplateConfig((p) => ({
                              ...p,
                              width: p.width + 20,
                              height: Math.round((p.width + 20) * (992 / 1586)),
                              mode: "custom",
                            }))
                          }
                        >
                          <Text style={styles.stepBtnText}>+20</Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.paramItem}>
                      <Text style={styles.paramLabel}>Opacity: {backplateConfig.opacity.toFixed(2)}</Text>
                      <View style={styles.stepperRow}>
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() =>
                            setBackplateConfig((p) => ({
                              ...p,
                              opacity: Math.max(0.1, Math.round((p.opacity - 0.1) * 10) / 10),
                            }))
                          }
                        >
                          <Text style={styles.stepBtnText}>-0.1</Text>
                        </Pressable>
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() =>
                            setBackplateConfig((p) => ({
                              ...p,
                              opacity: Math.min(1.0, Math.round((p.opacity + 0.1) * 10) / 10),
                            }))
                          }
                        >
                          <Text style={styles.stepBtnText}>+0.1</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Oak Cutout Controls */}
                <View style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>Mature Oak Cutout (Wood Framework Only)</Text>
                    <Pressable
                      style={[styles.toggleBadge, showOak && styles.toggleBadgeActive]}
                      onPress={() => setShowOak((prev) => !prev)}
                    >
                      <Text style={styles.toggleBadgeText}>{showOak ? "Visible" : "Hidden"}</Text>
                    </Pressable>
                  </View>

                  <View style={styles.paramGrid}>
                    <View style={styles.paramItem}>
                      <Text style={styles.paramLabel}>X Translation: {oakConfig.x} px</Text>
                      <View style={styles.stepperRow}>
                        <Pressable style={styles.stepBtn} onPress={() => setOakConfig((p) => ({ ...p, x: p.x - 5 }))}>
                          <Text style={styles.stepBtnText}>-5</Text>
                        </Pressable>
                        <Pressable style={styles.stepBtn} onPress={() => setOakConfig((p) => ({ ...p, x: p.x + 5 }))}>
                          <Text style={styles.stepBtnText}>+5</Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.paramItem}>
                      <Text style={styles.paramLabel}>Y Translation: {oakConfig.y} px</Text>
                      <View style={styles.stepperRow}>
                        <Pressable style={styles.stepBtn} onPress={() => setOakConfig((p) => ({ ...p, y: p.y - 5 }))}>
                          <Text style={styles.stepBtnText}>-5</Text>
                        </Pressable>
                        <Pressable style={styles.stepBtn} onPress={() => setOakConfig((p) => ({ ...p, y: p.y + 5 }))}>
                          <Text style={styles.stepBtnText}>+5</Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.paramItem}>
                      <Text style={styles.paramLabel}>Uniform Scale: {oakConfig.scale.toFixed(3)}</Text>
                      <View style={styles.stepperRow}>
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() =>
                            setOakConfig((p) => ({
                              ...p,
                              scale: Math.max(0.5, Math.round((p.scale - 0.02) * 100) / 100),
                            }))
                          }
                        >
                          <Text style={styles.stepBtnText}>-0.02</Text>
                        </Pressable>
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() =>
                            setOakConfig((p) => ({
                              ...p,
                              scale: Math.min(1.5, Math.round((p.scale + 0.02) * 100) / 100),
                            }))
                          }
                        >
                          <Text style={styles.stepBtnText}>+0.02</Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.paramItem}>
                      <Text style={styles.paramLabel}>ScaleX (Aspect Calib): {oakConfig.scaleX.toFixed(3)}</Text>
                      <View style={styles.stepperRow}>
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() =>
                            setOakConfig((p) => ({
                              ...p,
                              scaleX: Math.max(0.8, Math.round((p.scaleX - 0.01) * 100) / 100),
                            }))
                          }
                        >
                          <Text style={styles.stepBtnText}>-0.01</Text>
                        </Pressable>
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() =>
                            setOakConfig((p) => ({
                              ...p,
                              scaleX: Math.min(1.2, Math.round((p.scaleX + 0.01) * 100) / 100),
                            }))
                          }
                        >
                          <Text style={styles.stepBtnText}>+0.01</Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.paramItem}>
                      <Text style={styles.paramLabel}>Rotation: {oakConfig.rotation.toFixed(1)}°</Text>
                      <View style={styles.stepperRow}>
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() =>
                            setOakConfig((p) => ({
                              ...p,
                              rotation: Math.max(-5, Math.round((p.rotation - 0.5) * 10) / 10),
                            }))
                          }
                        >
                          <Text style={styles.stepBtnText}>-0.5°</Text>
                        </Pressable>
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() =>
                            setOakConfig((p) => ({
                              ...p,
                              rotation: Math.min(5, Math.round((p.rotation + 0.5) * 10) / 10),
                            }))
                          }
                        >
                          <Text style={styles.stepBtnText}>+0.5°</Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.paramItem}>
                      <Text style={styles.paramLabel}>Oak Opacity: {oakConfig.opacity.toFixed(2)}</Text>
                      <View style={styles.stepperRow}>
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() =>
                            setOakConfig((p) => ({
                              ...p,
                              opacity: Math.max(0.1, Math.round((p.opacity - 0.1) * 10) / 10),
                            }))
                          }
                        >
                          <Text style={styles.stepBtnText}>-0.1</Text>
                        </Pressable>
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() =>
                            setOakConfig((p) => ({
                              ...p,
                              opacity: Math.min(1.0, Math.round((p.opacity + 0.1) * 10) / 10),
                            }))
                          }
                        >
                          <Text style={styles.stepBtnText}>+0.1</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  <Pressable style={styles.resetCalibrationBtn} onPress={handleResetCalibration}>
                    <Text style={styles.resetCalibrationBtnText}>↺ Reset to Approved Calibrated Values</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* TAB 2: CROP PRESETS */}
            {activeTab === "crop" && (
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>Crop Mode & Preservation Contracts</Text>
                  <Pressable
                    style={[styles.toggleBadge, showCropOverlay && styles.toggleBadgeActive]}
                    onPress={() => setShowCropOverlay((p) => !p)}
                  >
                    <Text style={styles.toggleBadgeText}>{showCropOverlay ? "Overlay Visible" : "Overlay Hidden"}</Text>
                  </Pressable>
                </View>

                <View style={styles.buttonRow}>
                  <Pressable
                    style={[styles.segmentBtn, activeCropMode === "full_structure" && styles.segmentBtnActive]}
                    onPress={() => setActiveCropMode("full_structure")}
                  >
                    <Text style={styles.segmentBtnText}>A. Full-Structure Crop</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.segmentBtn, activeCropMode === "focused_compact" && styles.segmentBtnActive]}
                    onPress={() => setActiveCropMode("focused_compact")}
                  >
                    <Text style={styles.segmentBtnText}>B. Focused Compact Crop</Text>
                  </Pressable>
                </View>

                <View style={styles.fixtureStatsBox}>
                  <Text style={styles.fixtureStatsTitle}>
                    {activeCropMode === "full_structure"
                      ? "Full-Structure Crop Contract (preservesFullStructure = true)"
                      : "Focused Compact Crop Contract (preservesFullStructure = false)"}
                  </Text>
                  <Text style={styles.fixtureStatsText}>
                    • Bounds: [{activeCropPreset.cropBounds.minX}, {activeCropPreset.cropBounds.minY}] to [
                    {activeCropPreset.cropBounds.maxX}, {activeCropPreset.cropBounds.maxY}] (
                    {activeCropPreset.cropBounds.width} x {activeCropPreset.cropBounds.height} pt)
                  </Text>
                  <Text style={styles.fixtureStatsText}>• Description: {activeCropPreset.description}</Text>
                  <Text style={styles.fixtureStatsText}>
                    • Complete Crown Preservation: {activeCropPreset.preservesFullStructure ? "YES" : "NO (Intentionally trims peripheral branch tips)"}
                  </Text>
                </View>
              </View>
            )}

            {/* TAB 3: GUIDES & OVERLAYS */}
            {activeTab === "debug" && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>World Geometry & Calibration Overlays</Text>

                <View style={styles.toggleGrid}>
                  <Pressable
                    style={[styles.toggleCard, showCanonicalBounds && styles.toggleCardActive]}
                    onPress={() => setShowCanonicalBounds((p) => !p)}
                  >
                    <Text style={styles.toggleCardTitle}>Canonical Bounds [0, 800]x[0, 500]</Text>
                    <Text style={styles.toggleCardDesc}>Cyan dashed line marking 16:10 production scene</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.toggleCard, showExpandedBounds && styles.toggleCardActive]}
                    onPress={() => setShowExpandedBounds((p) => !p)}
                  >
                    <Text style={styles.toggleCardTitle}>Expanded Explore Bounds</Text>
                    <Text style={styles.toggleCardDesc}>Purple dashed box [-100, 900]x[-50, 550]</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.toggleCard, showCenterCrosshair && styles.toggleCardActive]}
                    onPress={() => setShowCenterCrosshair((p) => !p)}
                  >
                    <Text style={styles.toggleCardTitle}>World Center Crosshair</Text>
                    <Text style={styles.toggleCardDesc}>Rose crosshair centered at (400, 250)</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.toggleCard, showSoilBaseline && styles.toggleCardActive]}
                    onPress={() => setShowSoilBaseline((p) => !p)}
                  >
                    <Text style={styles.toggleCardTitle}>Soil Planting Baseline (y=440)</Text>
                    <Text style={styles.toggleCardDesc}>Amber line & root collar planting band [420-460]</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.toggleCard, showBranchAnchors && styles.toggleCardActive]}
                    onPress={() => setShowBranchAnchors((p) => !p)}
                  >
                    <Text style={styles.toggleCardTitle}>Branch Wood Anchors (9 items)</Text>
                    <Text style={styles.toggleCardDesc}>Cyan pivots on primary oak scaffold limbs</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.toggleCard, showFixtureAnchors && styles.toggleCardActive]}
                    onPress={() => setShowFixtureAnchors((p) => !p)}
                  >
                    <Text style={styles.toggleCardTitle}>Classified Fixture Anchors ({events.length} items)</Text>
                    <Text style={styles.toggleCardDesc}>Classified into wood, tip, pending foliage, and ground</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.toggleCard, showLegend && styles.toggleCardActive]}
                    onPress={() => setShowLegend((p) => !p)}
                  >
                    <Text style={styles.toggleCardTitle}>Attachment Classification Legend</Text>
                    <Text style={styles.toggleCardDesc}>Floating badge explaining colors & counts</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.toggleCard, showProceduralTrunk && styles.toggleCardActive]}
                    onPress={() => setShowProceduralTrunk((p) => !p)}
                  >
                    <Text style={styles.toggleCardTitle}>Procedural SVG Silhouette</Text>
                    <Text style={styles.toggleCardDesc}>Faint outline of procedural trunk for comparison</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.toggleCard,
                      styles.toggleCardSpecial,
                      useAdaptedMapping && styles.toggleCardSpecialActive,
                    ]}
                    onPress={() => setUseAdaptedMapping((p) => !p)}
                  >
                    <Text style={styles.toggleCardTitle}>
                      {useAdaptedMapping ? "✓ Asset-Specific Adaptation (ACTIVE)" : "⚡ Asset-Specific Adaptation"}
                    </Text>
                    <Text style={styles.toggleCardDesc}>
                      Restricted to painterly-oak-structure-mature-v1 & garden_in_bloom; never alters procedural mode
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* TAB 4: FIXTURE SCENARIOS */}
            {activeTab === "fixtures" && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Deterministic Local Fixture Scenarios</Text>

                <View style={styles.scenarioSection}>
                  <Text style={styles.paramLabel}>Couple Seed Key:</Text>
                  <View style={styles.buttonRow}>
                    {(Object.keys(FIXTURE_COUPLE_SEEDS) as Array<keyof typeof FIXTURE_COUPLE_SEEDS>).map((key) => (
                      <Pressable
                        key={key}
                        style={[styles.segmentBtn, fixtureSeedKey === key && styles.segmentBtnActive]}
                        onPress={() => setFixtureSeedKey(key)}
                      >
                        <Text style={styles.segmentBtnText}>Seed {key}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.scenarioSection}>
                  <Text style={styles.paramLabel}>Care Event Count:</Text>
                  <View style={styles.buttonRow}>
                    {[0, 10, 25, 50].map((cnt) => (
                      <Pressable
                        key={`cnt-${cnt}`}
                        style={[styles.segmentBtn, fixtureEventCount === cnt && styles.segmentBtnActive]}
                        onPress={() => setFixtureEventCount(cnt)}
                      >
                        <Text style={styles.segmentBtnText}>{cnt} Events</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.fixtureStatsBox}>
                  <Text style={styles.fixtureStatsTitle}>Attachment Breakdown for Current Scenario:</Text>
                  <Text style={styles.fixtureStatsText}>• Valid on Wood: {summaryCounts.wood}</Text>
                  <Text style={styles.fixtureStatsText}>• Near Branch Tip: {summaryCounts.nearTip}</Text>
                  <Text style={styles.fixtureStatsText}>• Pending Foliage Asset: {summaryCounts.pendingFoliage}</Text>
                  <Text style={styles.fixtureStatsText}>• Valid on Ground: {summaryCounts.ground}</Text>
                  <Text style={styles.fixtureStatsText}>• Invalid Void: {summaryCounts.invalidVoid}</Text>
                </View>
              </View>
            )}

            {/* TAB 5: MANIFEST EXPORT CODE */}
            {activeTab === "code" && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Calibrated Manifest Contract Record</Text>
                <Text style={styles.cardSubtitle}>
                  Accurate metadata: wood framework only, explicit stage eligibility, distinct crop contracts.
                </Text>

                <View style={styles.codeBlock}>
                  <Text style={styles.codeText}>
                    {JSON.stringify(
                      {
                        assetKey: PAINTERLY_OAK_STRUCTURE_MATURE_V1.assetKey,
                        hasFoliage: PAINTERLY_OAK_STRUCTURE_MATURE_V1.hasFoliage,
                        supportedStages: PAINTERLY_OAK_STRUCTURE_MATURE_V1.supportedStages,
                        nativeDimensions: PAINTERLY_OAK_STRUCTURE_MATURE_V1.nativeDimensions,
                        worldPlacementBounds: {
                          minX: backplateConfig.x,
                          minY: backplateConfig.y,
                          width: backplateConfig.width,
                          height: backplateConfig.height,
                        },
                        rootAnchor: { x: oakConfig.pivotX, y: oakConfig.pivotY },
                        scaleCalibration: {
                          uniformScale: oakConfig.scale,
                          scaleX: oakConfig.scaleX,
                          rotationDegrees: oakConfig.rotation,
                        },
                        cropPresets: PAINTERLY_OAK_STRUCTURE_MATURE_V1.cropPresets,
                        branchAnchorsCount: PAINTERLY_OAK_STRUCTURE_MATURE_V1.branchAnchors?.length,
                        futureFoliageRegionsCount: PAINTERLY_OAK_STRUCTURE_MATURE_V1.futureFoliageRegions?.length,
                        groundFeatureRegionsCount: PAINTERLY_OAK_STRUCTURE_MATURE_V1.groundFeatureRegions?.length,
                      },
                      null,
                      2
                    )}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030712",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: "#111827",
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#1F2937",
  },
  backButtonText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  headerTitle: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "#64748B",
    fontSize: 11,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pillButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#1F2937",
  },
  pillButtonText: {
    color: "#CBD5E1",
    fontSize: 11,
    fontWeight: "600",
  },
  pillButtonPrimary: {
    backgroundColor: "#7C3AED",
  },
  pillButtonPrimaryText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  canvasContainer: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  hudBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    gap: 2,
  },
  hudBadgeText: {
    color: "#E2E8F0",
    fontSize: 11,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  hudBadgeSubtext: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "500",
  },
  legendContainer: {
    position: "absolute",
    bottom: 12,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    gap: 4,
    maxWidth: 320,
  },
  legendTitle: {
    color: "#F8FAFC",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: "#CBD5E1",
    fontSize: 10,
    fontWeight: "500",
  },
  legendNote: {
    color: "#64748B",
    fontSize: 9,
    fontStyle: "italic",
    marginTop: 2,
  },
  controlPanel: {
    height: 290,
    backgroundColor: "#0B0F19",
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#0F172A",
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabItemActive: {
    borderBottomColor: "#8B5CF6",
    backgroundColor: "#131C31",
  },
  tabItemText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
  },
  tabItemTextActive: {
    color: "#F8FAFC",
  },
  tabContent: {
    flex: 1,
  },
  tabContentInner: {
    padding: 14,
    gap: 12,
  },
  sectionGroup: {
    gap: 12,
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1E293B",
    padding: 12,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "700",
  },
  cardSubtitle: {
    color: "#64748B",
    fontSize: 11,
  },
  toggleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "#334155",
  },
  toggleBadgeActive: {
    backgroundColor: "#15803D",
  },
  toggleBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  segmentBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#1E293B",
  },
  segmentBtnActive: {
    backgroundColor: "#6D28D9",
  },
  segmentBtnText: {
    color: "#CBD5E1",
    fontSize: 11,
    fontWeight: "600",
  },
  paramGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  paramItem: {
    minWidth: 150,
    flex: 1,
    backgroundColor: "#0B0F19",
    padding: 8,
    borderRadius: 6,
    gap: 6,
  },
  paramLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "500",
  },
  stepperRow: {
    flexDirection: "row",
    gap: 6,
  },
  stepBtn: {
    flex: 1,
    paddingVertical: 4,
    alignItems: "center",
    backgroundColor: "#1E293B",
    borderRadius: 4,
  },
  stepBtnText: {
    color: "#F1F5F9",
    fontSize: 11,
    fontWeight: "700",
  },
  resetCalibrationBtn: {
    marginTop: 4,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "rgba(109, 40, 217, 0.15)",
    borderWidth: 1,
    borderColor: "#7C3AED",
    borderRadius: 6,
  },
  resetCalibrationBtnText: {
    color: "#C4B5FD",
    fontSize: 11,
    fontWeight: "700",
  },
  toggleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  toggleCard: {
    width: "48%",
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 6,
    padding: 8,
    gap: 2,
  },
  toggleCardActive: {
    borderColor: "#38BDF8",
    backgroundColor: "rgba(56, 189, 248, 0.1)",
  },
  toggleCardSpecial: {
    width: "100%",
    borderColor: "#059669",
    backgroundColor: "rgba(5, 150, 105, 0.08)",
  },
  toggleCardSpecialActive: {
    borderColor: "#10B981",
    backgroundColor: "rgba(16, 185, 129, 0.2)",
  },
  toggleCardTitle: {
    color: "#F1F5F9",
    fontSize: 11,
    fontWeight: "700",
  },
  toggleCardDesc: {
    color: "#64748B",
    fontSize: 10,
  },
  scenarioSection: {
    gap: 6,
  },
  fixtureStatsBox: {
    backgroundColor: "#0B0F19",
    padding: 10,
    borderRadius: 6,
    gap: 4,
  },
  fixtureStatsTitle: {
    color: "#A7F3D0",
    fontSize: 11,
    fontWeight: "700",
  },
  fixtureStatsText: {
    color: "#94A3B8",
    fontSize: 11,
  },
  codeBlock: {
    backgroundColor: "#030712",
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  codeText: {
    color: "#38BDF8",
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 15,
  },
});
