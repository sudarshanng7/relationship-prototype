import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { tokens } from "@/components/couply-tokens";
import {
  GardenCareEvent,
  GardenCareSignals,
} from "@/lib/garden-generator";
import {
  type GardenWorld,
  type GardenNode,
  type GardenCameraState,
  type GardenCameraMode,
  type Viewport,
  type ScenicRegion,
  CANONICAL_SCENE_BOUNDS,
  calculateZoomBounds,
  createCameraFromFitStrategy,
  panCamera,
  zoomCameraAroundPoint,
  focusScenicRegion,
  focusFeatureBounds,
  resolveNodeAtScreenCoordinate,
  isScenicRegionAvailable,
  CANONICAL_DRAG_THRESHOLD_PX,
  getExplorableMemories,
  type ExplorableMemoryItem,
  findMemoryIndexByNodeId,
  getNextMemory,
  getPreviousMemory,
  resolveGardenWorldPresentation,
} from "@/lib/garden";
import { GardenVisualizer } from "./GardenVisualizer";

export interface GardenExplorerProps {
  world: GardenWorld;
  theme: any;
  isLight: boolean;
  isDim: boolean;
  seedString: string;
  totalGrowthUnits: number;
  careGrowthUnits: number;
  timeGrowthUnits?: number;
  isResting?: boolean;
  careSignals?: GardenCareSignals;
  careEvents?: GardenCareEvent[];
  initialFeatureId?: string | null;
  onClose: () => void;
}

interface RegionItem {
  id: ScenicRegion;
  label: string;
}

const ALL_REGIONS: RegionItem[] = [
  { id: "crown", label: "Crown" },
  { id: "left_canopy", label: "Canopy" },
  { id: "trunk", label: "Trunk" },
  { id: "root_grove", label: "Roots" },
  { id: "wildflower_meadow", label: "Meadow" },
  { id: "stream_edge", label: "Stream" },
  { id: "stone_landmark_area", label: "Landmarks" },
];

export function GardenExplorer({
  world,
  theme,
  isLight,
  isDim,
  seedString,
  totalGrowthUnits,
  careGrowthUnits,
  timeGrowthUnits,
  isResting = false,
  careSignals,
  careEvents = [],
  initialFeatureId = null,
  onClose,
}: GardenExplorerProps) {
  const router = useRouter();
  const [viewport, setViewport] = useState<Viewport>({ width: 360, height: 480 });
  const [hasLayout, setHasLayout] = useState(false);

  // Camera Mode: "overview" | "explore" | "memory_focus" | "scenic_focus" | "future_first_person"
  const [cameraMode, setCameraMode] = useState<GardenCameraMode>("overview");

  // Accessible reduced-motion preference
  const [isReduceMotion, setIsReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => setIsReduceMotion(Boolean(enabled)))
      .catch(() => setIsReduceMotion(false));
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      setIsReduceMotion(Boolean(enabled));
    });
    return () => {
      if (typeof sub?.remove === "function") sub.remove();
    };
  }, []);

  // Compute zoom bounds using viewport_cover strategy so artwork always covers viewport
  const zoomLimits = useMemo(() => {
    return calculateZoomBounds(CANONICAL_SCENE_BOUNDS, viewport, 0, "viewport_cover");
  }, [viewport]);

  // Pure canonical camera state initialized with continuous viewport cover
  const [cameraState, setCameraState] = useState<GardenCameraState>(() => {
    return createCameraFromFitStrategy(CANONICAL_SCENE_BOUNDS, { width: 360, height: 480 }, "viewport_cover");
  });

  const cameraStateRef = useRef<GardenCameraState>(cameraState);
  cameraStateRef.current = cameraState;

  // Selected feature / memory state
  const [selectedNode, setSelectedNode] = useState<GardenNode | null>(null);
  const [selectedMemoryIndex, setSelectedMemoryIndex] = useState<number>(-1);

  // Horizontal scroll indicator state for scenic/memory strip
  const scrollViewRef = useRef<ScrollView>(null);
  const [scrollState, setScrollState] = useState({
    canScrollLeft: false,
    canScrollRight: true,
  });

  const handleScroll = useCallback((e: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const canLeft = contentOffset.x > 6;
    const canRight = contentOffset.x + layoutMeasurement.width < contentSize.width - 6;
    setScrollState({ canScrollLeft: canLeft, canScrollRight: canRight });
  }, []);

  // Gesture tracking refs
  const canvasRef = useRef<View>(null);
  const dragStartCamera = useRef<GardenCameraState | null>(null);
  const isDraggingRef = useRef(false);
  const initialFocusDoneRef = useRef(false);

  // Resolved presentation geometry of the world aligning camera and hit testing
  // with active structure scaling, offset, and couple DNA
  const presentationWorld = useMemo(() => {
    return resolveGardenWorldPresentation(world);
  }, [world]);

  // Canonical chronological collection of explorable earned memories
  const explorableMemories = useMemo(() => {
    return getExplorableMemories(presentationWorld, careEvents);
  }, [presentationWorld, careEvents]);

  // Active memory item
  const activeMemory: ExplorableMemoryItem | null = useMemo(() => {
    if (selectedMemoryIndex >= 0 && selectedMemoryIndex < explorableMemories.length) {
      return explorableMemories[selectedMemoryIndex];
    }
    return null;
  }, [selectedMemoryIndex, explorableMemories]);

  // Initial layout handler (sets viewport and initializes cover camera)
  const handleLayout = useCallback(
    (e: any) => {
      const { width, height } = e.nativeEvent.layout;
      if (width > 0 && height > 0) {
        const nextVp: Viewport = { width, height };
        setViewport(nextVp);
        if (!hasLayout) {
          setHasLayout(true);
          const initialCam = createCameraFromFitStrategy(
            CANONICAL_SCENE_BOUNDS,
            nextVp,
            "viewport_cover"
          );
          setCameraState(initialCam);
        }
      }
    },
    [hasLayout]
  );

  // Memory focus helper
  const focusOnMemory = useCallback(
    (mem: ExplorableMemoryItem, index: number) => {
      setSelectedMemoryIndex(index);
      const matchingNode =
        presentationWorld.nodes[mem.nodeId] ||
        Object.values(presentationWorld.nodes).find(
          (n) => n.legacyFeatureId === mem.legacyFeatureId || n.id === mem.nodeId
        ) ||
        null;
      setSelectedNode(matchingNode);
      setCameraMode("memory_focus");

      const focusedCam = focusFeatureBounds(
        mem.bounds,
        viewport,
        CANONICAL_SCENE_BOUNDS,
        zoomLimits.minZoom,
        zoomLimits.maxZoom,
        56
      );
      setCameraState(focusedCam);

      try {
        if (mem.accessibilityLabel && AccessibilityInfo.announceForAccessibility) {
          AccessibilityInfo.announceForAccessibility(mem.accessibilityLabel);
        }
      } catch {
        // Non-blocking accessibility announcement fallback
      }
    },
    [presentationWorld.nodes, viewport, zoomLimits]
  );

  // Previous & Next memory navigation
  const handlePrevMemory = useCallback(() => {
    if (explorableMemories.length === 0) return;
    const targetIdx =
      selectedMemoryIndex <= 0
        ? explorableMemories.length - 1
        : selectedMemoryIndex - 1;
    const mem = explorableMemories[targetIdx];
    focusOnMemory(mem, targetIdx);
  }, [explorableMemories, selectedMemoryIndex, focusOnMemory]);

  const handleNextMemory = useCallback(() => {
    if (explorableMemories.length === 0) return;
    const targetIdx =
      selectedMemoryIndex < 0
        ? 0
        : (selectedMemoryIndex + 1) % explorableMemories.length;
    const mem = explorableMemories[targetIdx];
    focusOnMemory(mem, targetIdx);
  }, [explorableMemories, selectedMemoryIndex, focusOnMemory]);

  // Initial feature ID handler (e.g. invoked from Garden Story Player)
  useEffect(() => {
    if (!initialFeatureId || !hasLayout || initialFocusDoneRef.current) return;
    initialFocusDoneRef.current = true;
    const memIdx = findMemoryIndexByNodeId(explorableMemories, initialFeatureId);
    if (memIdx >= 0) {
      focusOnMemory(explorableMemories[memIdx], memIdx);
    } else {
      const node = Object.values(presentationWorld.nodes).find(
        (n) => n.legacyFeatureId === initialFeatureId || n.id === initialFeatureId
      );
      if (node) {
        setSelectedNode(node);
        setSelectedMemoryIndex(-1);
        const cam = focusFeatureBounds(
          node.worldBounds,
          viewport,
          CANONICAL_SCENE_BOUNDS,
          zoomLimits.minZoom,
          zoomLimits.maxZoom,
          56
        );
        setCameraState(cam);
        setCameraMode("explore");
      }
    }
  }, [
    initialFeatureId,
    hasLayout,
    explorableMemories,
    focusOnMemory,
    presentationWorld.nodes,
    viewport,
    zoomLimits,
  ]);

  // Screen tap handler (distinguishing drags from taps via canonical threshold)
  const handleScreenTap = useCallback(
    (screenX: number, screenY: number) => {
      const hitNode = resolveNodeAtScreenCoordinate(
        { x: screenX, y: screenY },
        presentationWorld,
        cameraStateRef.current,
        viewport,
        22
      );
      setSelectedNode(hitNode);
      if (hitNode?.isEarned) {
        const memIdx = findMemoryIndexByNodeId(
          explorableMemories,
          hitNode.legacyFeatureId || hitNode.id
        );
        if (memIdx >= 0) {
          setSelectedMemoryIndex(memIdx);
          setCameraMode("memory_focus");
          const mem = explorableMemories[memIdx];
          try {
            if (mem.accessibilityLabel && AccessibilityInfo.announceForAccessibility) {
              AccessibilityInfo.announceForAccessibility(mem.accessibilityLabel);
            }
          } catch {}
          return;
        }
      }
      setSelectedMemoryIndex(-1);
      if (hitNode) {
        setCameraMode("explore");
      }
    },
    [presentationWorld, viewport, explorableMemories]
  );

  // PanResponder for mobile 1-finger pan and pointer drag with unified threshold
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => {
          return Math.hypot(gesture.dx, gesture.dy) >= CANONICAL_DRAG_THRESHOLD_PX;
        },
        onPanResponderGrant: () => {
          dragStartCamera.current = cameraStateRef.current;
          isDraggingRef.current = false;
        },
        onPanResponderMove: (_, gesture) => {
          if (!dragStartCamera.current) return;
          const dist = Math.hypot(gesture.dx, gesture.dy);
          if (dist >= CANONICAL_DRAG_THRESHOLD_PX) {
            isDraggingRef.current = true;
            setCameraMode("explore");
            const updated = panCamera(
              dragStartCamera.current,
              gesture.dx,
              gesture.dy,
              CANONICAL_SCENE_BOUNDS
            );
            setCameraState(updated);
          }
        },
        onPanResponderRelease: (e, gesture) => {
          const dist = Math.hypot(gesture.dx, gesture.dy);
          if (!isDraggingRef.current && dist < CANONICAL_DRAG_THRESHOLD_PX) {
            const locX = e.nativeEvent.locationX;
            const locY = e.nativeEvent.locationY;
            handleScreenTap(locX, locY);
          }
          dragStartCamera.current = null;
          isDraggingRef.current = false;
        },
        onPanResponderTerminate: () => {
          dragStartCamera.current = null;
          isDraggingRef.current = false;
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [handleScreenTap]
  );

  // Web mouse-wheel zoom listener with active preventDefault (passive: false)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const element = canvasRef.current as any;
    if (!element) return;
    const domNode: HTMLElement | null = element.tagName
      ? element
      : (element._node ?? null);
    if (!domNode?.addEventListener) return;

    const onWheelHandler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      const rect = domNode.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      setCameraMode("explore");
      setCameraState((prev) =>
        zoomCameraAroundPoint(
          prev,
          factor,
          { x: screenX, y: screenY },
          CANONICAL_SCENE_BOUNDS,
          zoomLimits.minZoom,
          zoomLimits.maxZoom
        )
      );
    };

    domNode.addEventListener("wheel", onWheelHandler, { passive: false });
    return () => {
      domNode.removeEventListener("wheel", onWheelHandler);
    };
  }, [zoomLimits]);

  // Zoom In control
  const handleZoomIn = useCallback(() => {
    setCameraMode("explore");
    setCameraState((prev) =>
      zoomCameraAroundPoint(
        prev,
        1.25,
        { x: viewport.width / 2, y: viewport.height / 2 },
        CANONICAL_SCENE_BOUNDS,
        zoomLimits.minZoom,
        zoomLimits.maxZoom
      )
    );
  }, [viewport, zoomLimits]);

  // Zoom Out control
  const handleZoomOut = useCallback(() => {
    setCameraMode("explore");
    setCameraState((prev) =>
      zoomCameraAroundPoint(
        prev,
        0.8,
        { x: viewport.width / 2, y: viewport.height / 2 },
        CANONICAL_SCENE_BOUNDS,
        zoomLimits.minZoom,
        zoomLimits.maxZoom
      )
    );
  }, [viewport, zoomLimits]);

  // Reset View to continuous viewport cover
  const handleResetView = useCallback(() => {
    setCameraState(
      createCameraFromFitStrategy(CANONICAL_SCENE_BOUNDS, viewport, "viewport_cover")
    );
    setSelectedNode(null);
    setSelectedMemoryIndex(-1);
    setCameraMode("overview");
  }, [viewport]);

  // Filter available scenic regions
  const availableRegions = useMemo(() => {
    return ALL_REGIONS.filter((reg) => isScenicRegionAvailable(presentationWorld, reg.id));
  }, [presentationWorld]);

  // Region focus handler
  const handleFocusRegion = useCallback(
    (regionId: ScenicRegion, index: number) => {
      const regBounds = presentationWorld.scenicRegions?.[regionId];
      if (!regBounds) return;
      const focusedCam = focusScenicRegion(
        regBounds,
        viewport,
        CANONICAL_SCENE_BOUNDS,
        zoomLimits.minZoom,
        zoomLimits.maxZoom,
        32
      );
      setCameraState(focusedCam);
      setSelectedNode(null);
      setSelectedMemoryIndex(-1);
      setCameraMode("scenic_focus");

      // Auto-scroll pill into view
      scrollViewRef.current?.scrollTo({
        x: Math.max(0, index * 80 - 40),
        animated: true,
      });
    },
    [presentationWorld, viewport, zoomLimits]
  );

  // Descriptive label for decorative / landscape nodes
  const decorativeLabel = useMemo(() => {
    if (!selectedNode || selectedNode.isEarned) return null;
    if (selectedNode.role === "trunk") return "Ancient Oak Trunk";
    if (selectedNode.role === "root") return "Ancient Oak Root Base";
    if (selectedNode.role === "foliage") return "Canopy Foliage";
    if (selectedNode.role === "branch") return "Living Oak Branch";
    if (selectedNode.role === "terrain_region") {
      if (selectedNode.regionKind === "distant_woodland") return "Ancient Woodland Edge";
      if (selectedNode.regionKind === "distant_hills") return "Distant Hills";
      if (selectedNode.regionKind === "stream_path") return "Natural Clearing Brook";
      return "Wildflower Meadow";
    }
    if (selectedNode.role === "ground_flora") {
      if (selectedNode.floraType === "moss") return "Lush Moss Cushion";
      if (selectedNode.floraType === "clover") return "Four-Leaf Clover Cover";
      if (selectedNode.floraType === "fern") return "Woodland Margin Fern";
      return "Wildflower Flora";
    }
    if (selectedNode.role === "creature_node") {
      return "Garden Pollinator Visitor";
    }
    return "Garden Feature";
  }, [selectedNode]);

  // Theme-derived colors
  const cardBg = isLight ? "#FFFFFF" : isDim ? "#2A2232" : "#1A1420";
  const cardBorder = isLight ? "rgba(74, 55, 82, 0.12)" : "rgba(224, 214, 230, 0.15)";
  const overlayBg = isLight ? "rgba(255, 255, 255, 0.94)" : "rgba(26, 20, 32, 0.94)";
  const pillActiveBg = isLight ? "#2D1F33" : "#F4EFF6";
  const pillActiveText = isLight ? "#FFFFFF" : "#1A1420";
  const pillInactiveBg = isLight ? "rgba(45, 31, 51, 0.08)" : "rgba(255, 255, 255, 0.12)";
  const pillInactiveText = isLight ? "#4A3752" : "#E0D6E6";

  const subtitleLabel = useMemo(() => {
    if (activeMemory) {
      return `Memory ${activeMemory.index + 1} of ${activeMemory.totalMemories}`;
    }
    if (cameraMode === "scenic_focus") {
      return "Scenic view";
    }
    return "Pan, zoom & tap features";
  }, [activeMemory, cameraMode]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isLight ? "#EFEAE3" : isDim ? "#1C1722" : "#120E18" },
      ]}
      onLayout={handleLayout}
      accessible={true}
      accessibilityLabel="Interactive Garden Exploration"
    >
      {/* 1. Exploration Top Navigation Bar */}
      <View style={[styles.topBar, { backgroundColor: overlayBg, borderColor: cardBorder }]}>
        <Pressable
          style={({ pressed }) => [
            styles.iconButton,
            { backgroundColor: isLight ? "#FFFFFF" : "#2E2436", borderColor: cardBorder },
            pressed && styles.buttonPressed,
          ]}
          onPress={onClose}
          focusable={true}
          accessibilityRole="button"
          accessibilityLabel="Return to garden view"
          accessibilityHint="Exits exploration mode and returns to normal garden card"
          hitSlop={8}
        >
          <Text style={[styles.backIcon, { color: theme.primaryText }]}>‹</Text>
          <Text style={[styles.backLabel, { color: theme.primaryText }]}>Return</Text>
        </Pressable>

        <View style={styles.titleContainer}>
          <Text
            style={[styles.modeTitle, { color: theme.primaryText }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {viewport.width <= 340 ? "Explore" : "Explore Garden"}
          </Text>
          <Text
            style={[styles.modeSubtitle, { color: theme.secondaryText }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {subtitleLabel}
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.resetButton,
            { backgroundColor: isLight ? "#FFFFFF" : "#2E2436", borderColor: cardBorder },
            pressed && styles.buttonPressed,
          ]}
          onPress={handleResetView}
          focusable={true}
          accessibilityRole="button"
          accessibilityLabel="Reset garden view"
          accessibilityHint="Returns camera to fit entire garden"
          hitSlop={8}
        >
          <Text style={[styles.resetLabel, { color: theme.primaryAccent }]}>Reset</Text>
        </Pressable>
      </View>

      {/* 2. Interactive SVG Canvas Surface */}
      <View
        ref={canvasRef}
        style={styles.canvasSurface}
        {...panResponder.panHandlers}
      >
        <GardenVisualizer
          seedString={seedString}
          totalGrowthUnits={totalGrowthUnits}
          careGrowthUnits={careGrowthUnits}
          timeGrowthUnits={timeGrowthUnits}
          isResting={isResting}
          compact={false}
          careSignals={careSignals}
          careEvents={careEvents}
          world={presentationWorld}
          camera={cameraState}
          viewport={viewport}
          exploreMode={true}
          highlightFeatureId={
            activeMemory?.legacyFeatureId ||
            selectedNode?.legacyFeatureId ||
            selectedNode?.id ||
            null
          }
          style={styles.fullVisualizer}
        />
      </View>

      {/* 3. Floating Zoom Controls (+ / -) */}
      <View
        style={[
          styles.zoomControlsGroup,
          {
            backgroundColor: overlayBg,
            borderColor: cardBorder,
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.zoomButton,
            pressed && styles.buttonPressed,
            cameraState.zoom >= zoomLimits.maxZoom && styles.buttonDisabled,
          ]}
          onPress={handleZoomIn}
          disabled={cameraState.zoom >= zoomLimits.maxZoom}
          focusable={true}
          accessibilityRole="button"
          accessibilityLabel="Zoom in"
          accessibilityState={{ disabled: cameraState.zoom >= zoomLimits.maxZoom }}
          hitSlop={8}
        >
          <Text
            style={[
              styles.zoomButtonText,
              {
                color:
                  cameraState.zoom >= zoomLimits.maxZoom
                    ? theme.mutedText
                    : theme.primaryText,
              },
            ]}
          >
            +
          </Text>
        </Pressable>
        <View style={[styles.zoomDivider, { backgroundColor: cardBorder }]} />
        <Pressable
          style={({ pressed }) => [
            styles.zoomButton,
            pressed && styles.buttonPressed,
            cameraState.zoom <= zoomLimits.minZoom && styles.buttonDisabled,
          ]}
          onPress={handleZoomOut}
          disabled={cameraState.zoom <= zoomLimits.minZoom}
          focusable={true}
          accessibilityRole="button"
          accessibilityLabel="Zoom out"
          accessibilityState={{ disabled: cameraState.zoom <= zoomLimits.minZoom }}
          hitSlop={8}
        >
          <Text
            style={[
              styles.zoomButtonText,
              {
                color:
                  cameraState.zoom <= zoomLimits.minZoom
                    ? theme.mutedText
                    : theme.primaryText,
              },
            ]}
          >
            −
          </Text>
        </Pressable>
      </View>

      {/* 4. Scenic Region & Memory Focus Navigator */}
      <View style={[styles.regionBar, { backgroundColor: overlayBg, borderColor: cardBorder }]}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.regionScrollContent}
        >
          {explorableMemories.length > 0 && (
            <Pressable
              style={({ pressed }) => [
                styles.regionPill,
                {
                  backgroundColor: activeMemory ? pillActiveBg : pillInactiveBg,
                  borderColor: activeMemory ? theme.primaryAccent : cardBorder,
                },
                pressed && styles.buttonPressed,
              ]}
              onPress={() => {
                if (activeMemory) {
                  handleNextMemory();
                } else {
                  focusOnMemory(explorableMemories[0], 0);
                }
              }}
              focusable={true}
              accessibilityRole="button"
              accessibilityLabel={`Browse ${explorableMemories.length} relationship memories`}
              accessibilityState={{ selected: Boolean(activeMemory) }}
              accessibilityHint="Focuses camera on relationship moments grown from your shared care"
              hitSlop={6}
            >
              <Text
                style={[
                  styles.regionPillText,
                  { color: activeMemory ? pillActiveText : pillInactiveText },
                ]}
              >
                Memories ({explorableMemories.length})
              </Text>
            </Pressable>
          )}

          {availableRegions.map((region, idx) => (
            <Pressable
              key={region.id}
              style={({ pressed }) => [
                styles.regionPill,
                {
                  backgroundColor:
                    cameraMode === "scenic_focus" && selectedNode?.scenicRegion === region.id
                      ? pillActiveBg
                      : pillInactiveBg,
                  borderColor: cardBorder,
                },
                pressed && styles.buttonPressed,
              ]}
              onPress={() => handleFocusRegion(region.id, idx + 1)}
              focusable={true}
              accessibilityRole="button"
              accessibilityLabel={`Focus ${region.label}`}
              accessibilityState={{
                selected:
                  cameraMode === "scenic_focus" && selectedNode?.scenicRegion === region.id,
              }}
              accessibilityHint={`Focuses garden camera on the ${region.label} region`}
              hitSlop={6}
            >
              <Text style={[styles.regionPillText, { color: pillInactiveText }]}>
                {region.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Right overflow indicator fade cue */}
        {scrollState.canScrollRight && (
          <View
            style={[
              styles.scrollFadeRight,
              {
                backgroundColor: isLight
                  ? "rgba(255, 255, 255, 0.9)"
                  : "rgba(26, 20, 32, 0.9)",
              },
            ]}
            pointerEvents="none"
          >
            <Text style={[styles.scrollFadeCue, { color: theme.primaryAccent }]}>›</Text>
          </View>
        )}
      </View>

      {/* 5. Selected Memory Preview Card (Earned Feature) */}
      {activeMemory && (
        <View style={[styles.selectionCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles.selectionCardHeader}>
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.kindBadge,
                  {
                    backgroundColor: isLight ? "#F0EBF4" : "#34263E",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.kindBadgeText,
                    { color: theme.primaryAccent },
                  ]}
                >
                  {activeMemory.botanicalRepresentation.toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.memoryCounterTag, { color: theme.secondaryText }]}>
                {`Memory ${activeMemory.index + 1} of ${activeMemory.totalMemories}`}
              </Text>
              {activeMemory.scenicRegion && (
                <Text style={[styles.regionTag, { color: theme.secondaryText }]}>
                  {activeMemory.scenicRegion.replace(/_/g, " ")}
                </Text>
              )}
            </View>

            <Pressable
              style={styles.closeSelectionButton}
              onPress={() => {
                setSelectedNode(null);
                setSelectedMemoryIndex(-1);
                setCameraMode("explore");
              }}
              focusable={true}
              accessibilityRole="button"
              accessibilityLabel="Dismiss feature preview"
              hitSlop={10}
            >
              <Text style={[styles.closeSelectionText, { color: theme.secondaryText }]}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.memoryDetails}>
            <Text style={[styles.featureTitle, { color: theme.primaryText }]}>
              {activeMemory.displayHeadline}
            </Text>
            {activeMemory.displayDateLabel ? (
              <Text style={[styles.featureDate, { color: theme.secondaryText }]}>
                {activeMemory.displayDateLabel}
              </Text>
            ) : null}
            <Text style={[styles.featureHint, { color: theme.secondaryText }]}>
              {activeMemory.explanatoryCopy}
            </Text>
          </View>

          {/* Memory Navigation & Action Row */}
          <View style={styles.memoryActionsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.memoryNavButton,
                { backgroundColor: pillInactiveBg, borderColor: cardBorder },
                pressed && styles.buttonPressed,
              ]}
              onPress={handlePrevMemory}
              focusable={true}
              accessibilityRole="button"
              accessibilityLabel="Previous memory"
              hitSlop={6}
            >
              <Text style={[styles.memoryNavButtonText, { color: theme.primaryText }]}>‹ Prev</Text>
            </Pressable>

            {activeMemory.actionRoute ? (
              <Pressable
                style={({ pressed }) => [
                  styles.memoryActionButton,
                  { backgroundColor: theme.primaryAccent },
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => {
                  if (activeMemory.actionRoute) {
                    router.push(activeMemory.actionRoute as any);
                  }
                }}
                focusable={true}
                accessibilityRole="button"
                accessibilityLabel={`${activeMemory.actionLabel} for ${activeMemory.displayHeadline}`}
                hitSlop={6}
              >
                <Text style={styles.memoryActionButtonText}>
                  {activeMemory.actionLabel} →
                </Text>
              </Pressable>
            ) : (
              <View style={styles.memoryActionPlaceholder} />
            )}

            <Pressable
              style={({ pressed }) => [
                styles.memoryNavButton,
                { backgroundColor: pillInactiveBg, borderColor: cardBorder },
                pressed && styles.buttonPressed,
              ]}
              onPress={handleNextMemory}
              focusable={true}
              accessibilityRole="button"
              accessibilityLabel="Next memory"
              hitSlop={6}
            >
              <Text style={[styles.memoryNavButtonText, { color: theme.primaryText }]}>Next ›</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* 6. Selected Decorative Botanical Feature (No event source) */}
      {!activeMemory && selectedNode && (
        <View style={[styles.selectionCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles.selectionCardHeader}>
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.kindBadge,
                  {
                    backgroundColor: isLight ? "#E8EFEA" : "#223126",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.kindBadgeText,
                    { color: isLight ? "#2D5A3A" : "#82C194" },
                  ]}
                >
                  BOTANICAL FEATURE
                </Text>
              </View>
              {selectedNode.scenicRegion && (
                <Text style={[styles.regionTag, { color: theme.secondaryText }]}>
                  {selectedNode.scenicRegion.replace(/_/g, " ")}
                </Text>
              )}
            </View>

            <Pressable
              style={styles.closeSelectionButton}
              onPress={() => {
                setSelectedNode(null);
                setSelectedMemoryIndex(-1);
                setCameraMode("explore");
              }}
              focusable={true}
              accessibilityRole="button"
              accessibilityLabel="Dismiss feature preview"
              hitSlop={10}
            >
              <Text style={[styles.closeSelectionText, { color: theme.secondaryText }]}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.memoryDetails}>
            <Text style={[styles.featureTitle, { color: theme.primaryText }]}>
              {decorativeLabel}
            </Text>
            <Text style={[styles.featureHint, { color: theme.secondaryText }]}>
              A living part of your shared sanctuary.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: tokens.layout.appShell,
    height: 580,
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
    alignSelf: "center",
    shadowColor: "#2D1F33",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
  },
  topBar: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconButton: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    flexShrink: 0,
  },
  buttonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.38,
  },
  backIcon: {
    fontSize: 20,
    fontWeight: "700",
    marginRight: 4,
  },
  backLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  titleContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 8,
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  modeSubtitle: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
  },
  resetButton: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  resetLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  canvasSurface: {
    ...StyleSheet.absoluteFill,
    cursor: "grab" as any,
    userSelect: "none" as any,
  },
  fullVisualizer: {
    width: "100%",
    height: "100%",
    borderRadius: 0,
    maxWidth: undefined,
    aspectRatio: undefined,
    minHeight: undefined,
  },
  zoomControlsGroup: {
    position: "absolute",
    right: 12,
    top: 76,
    zIndex: 20,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  zoomButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomButtonText: {
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 22,
  },
  zoomDivider: {
    height: 1,
    width: "100%",
  },
  regionBar: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    zIndex: 20,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  regionScrollContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    gap: 8,
  },
  regionPill: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  regionPillText: {
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 0,
  },
  scrollFadeRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 28,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollFadeCue: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 20,
  },
  selectionCard: {
    position: "absolute",
    bottom: 74,
    left: 14,
    right: 14,
    zIndex: 25,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    shadowColor: "#2D1F33",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  selectionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  kindBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  kindBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  memoryCounterTag: {
    fontSize: 11,
    fontWeight: "600",
  },
  regionTag: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  closeSelectionButton: {
    minWidth: 32,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  closeSelectionText: {
    fontSize: 16,
    fontWeight: "600",
  },
  memoryDetails: {
    gap: 2,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  featureDate: {
    fontSize: 12,
    fontWeight: "500",
  },
  featureHint: {
    fontSize: 12,
    fontWeight: "400",
    marginTop: 2,
  },
  memoryActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 10,
  },
  memoryNavButton: {
    minWidth: 54,
    minHeight: 38,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  memoryNavButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  memoryActionButton: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  memoryActionButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  memoryActionPlaceholder: {
    flex: 1,
  },
});
