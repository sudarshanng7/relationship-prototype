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
import { tokens } from "@/components/couply-tokens";
import {
  GardenCareEvent,
  GardenCareSignals,
} from "@/lib/garden-generator";
import {
  type GardenWorld,
  type GardenNode,
  type GardenCameraState,
  type Viewport,
  type ScenicRegion,
  createCameraFromFit,
  calculateZoomBounds,
  panCamera,
  zoomCameraAroundPoint,
  focusScenicRegion,
  resolveNodeAtScreenCoordinate,
  isScenicRegionAvailable,
  CANONICAL_DRAG_THRESHOLD_PX,
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
  { id: "stone_landmark_area", label: "Landmarks" },
  { id: "stream_edge", label: "Stream" },
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
  onClose,
}: GardenExplorerProps) {
  const [viewport, setViewport] = useState<Viewport>({ width: 360, height: 480 });
  const [hasLayout, setHasLayout] = useState(false);

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

  // Compute zoom bounds based on viewport and world bounds
  const zoomLimits = useMemo(() => {
    return calculateZoomBounds(world.worldBounds, viewport, 24);
  }, [world.worldBounds, viewport]);

  // Pure canonical camera state
  const [cameraState, setCameraState] = useState<GardenCameraState>(() => {
    return createCameraFromFit(world.worldBounds, { width: 360, height: 480 }, 24);
  });

  const cameraStateRef = useRef<GardenCameraState>(cameraState);
  cameraStateRef.current = cameraState;

  // Selected feature / memory state
  const [selectedNode, setSelectedNode] = useState<GardenNode | null>(null);

  // Gesture tracking refs
  const canvasRef = useRef<View>(null);
  const dragStartCamera = useRef<GardenCameraState | null>(null);
  const isDraggingRef = useRef(false);

  // Initial layout handler
  const handleLayout = useCallback(
    (e: any) => {
      const { width, height } = e.nativeEvent.layout;
      if (width > 0 && height > 0) {
        const nextVp: Viewport = { width, height };
        setViewport(nextVp);
        if (!hasLayout) {
          setHasLayout(true);
          const initialCam = createCameraFromFit(world.worldBounds, nextVp, 24);
          setCameraState(initialCam);
        }
      }
    },
    [hasLayout, world.worldBounds]
  );

  // Screen tap handler (distinguishing drags from taps via canonical threshold)
  const handleScreenTap = useCallback(
    (screenX: number, screenY: number) => {
      const hitNode = resolveNodeAtScreenCoordinate(
        { x: screenX, y: screenY },
        world,
        cameraStateRef.current,
        viewport,
        22
      );
      setSelectedNode(hitNode);
    },
    [world, viewport]
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
            const updated = panCamera(
              dragStartCamera.current,
              gesture.dx,
              gesture.dy,
              world.worldBounds
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
          // Never leave dragging stuck if interrupted or cursor exits window
          dragStartCamera.current = null;
          isDraggingRef.current = false;
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [world.worldBounds, handleScreenTap]
  );

  // Web mouse-wheel zoom listener with active preventDefault (passive: false)
  // preventing page scrolling only while pointer is directly over Explore canvas
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

      setCameraState((prev) =>
        zoomCameraAroundPoint(
          prev,
          factor,
          { x: screenX, y: screenY },
          world.worldBounds,
          zoomLimits.minZoom,
          zoomLimits.maxZoom
        )
      );
    };

    domNode.addEventListener("wheel", onWheelHandler, { passive: false });
    return () => {
      domNode.removeEventListener("wheel", onWheelHandler);
    };
  }, [world.worldBounds, zoomLimits]);

  // Zoom In control
  const handleZoomIn = useCallback(() => {
    setCameraState((prev) =>
      zoomCameraAroundPoint(
        prev,
        1.25,
        { x: viewport.width / 2, y: viewport.height / 2 },
        world.worldBounds,
        zoomLimits.minZoom,
        zoomLimits.maxZoom
      )
    );
  }, [viewport, world.worldBounds, zoomLimits]);

  // Zoom Out control
  const handleZoomOut = useCallback(() => {
    setCameraState((prev) =>
      zoomCameraAroundPoint(
        prev,
        0.8,
        { x: viewport.width / 2, y: viewport.height / 2 },
        world.worldBounds,
        zoomLimits.minZoom,
        zoomLimits.maxZoom
      )
    );
  }, [viewport, world.worldBounds, zoomLimits]);

  // Reset View to fit
  const handleResetView = useCallback(() => {
    setCameraState(createCameraFromFit(world.worldBounds, viewport, 24));
    setSelectedNode(null);
  }, [world.worldBounds, viewport]);

  // Filter available scenic regions
  const availableRegions = useMemo(() => {
    return ALL_REGIONS.filter((reg) => isScenicRegionAvailable(world, reg.id));
  }, [world]);

  // Region focus handler
  const handleFocusRegion = useCallback(
    (regionId: ScenicRegion) => {
      const regBounds = world.scenicRegions?.[regionId];
      if (!regBounds) return;
      const focusedCam = focusScenicRegion(
        regBounds,
        viewport,
        world.worldBounds,
        zoomLimits.minZoom,
        zoomLimits.maxZoom,
        32
      );
      setCameraState(focusedCam);
      setSelectedNode(null);
    },
    [world, viewport, zoomLimits]
  );

  // Resolve matching event details for selected node if earned
  const selectedEvent = useMemo(() => {
    if (!selectedNode?.isEarned || !selectedNode.sourceEvent) return null;
    const evId = selectedNode.sourceEvent.id;
    return careEvents.find((e) => e.id === evId) || null;
  }, [selectedNode, careEvents]);

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
  const overlayBg = isLight ? "rgba(255, 255, 255, 0.92)" : "rgba(26, 20, 32, 0.92)";
  const pillActiveBg = isLight ? "#2D1F33" : "#F4EFF6";
  const pillActiveText = isLight ? "#FFFFFF" : "#1A1420";
  const pillInactiveBg = isLight ? "rgba(45, 31, 51, 0.08)" : "rgba(255, 255, 255, 0.12)";
  const pillInactiveText = isLight ? "#4A3752" : "#E0D6E6";

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
          <Text style={[styles.modeTitle, { color: theme.primaryText }]}>Explore Garden</Text>
          <Text style={[styles.modeSubtitle, { color: theme.secondaryText }]}>
            Pan, zoom & tap features
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
          world={world}
          camera={cameraState}
          viewport={viewport}
          exploreMode={true}
          highlightFeatureId={selectedNode?.legacyFeatureId || selectedNode?.id || null}
          style={styles.fullVisualizer}
        />
      </View>

      {/* 3. Floating Zoom Controls (+ / -) */}
      <View style={[styles.zoomControlsGroup, { backgroundColor: overlayBg, borderColor: cardBorder }]}>
        <Pressable
          style={({ pressed }) => [styles.zoomButton, pressed && styles.buttonPressed]}
          onPress={handleZoomIn}
          focusable={true}
          accessibilityRole="button"
          accessibilityLabel="Zoom in"
          hitSlop={8}
        >
          <Text style={[styles.zoomButtonText, { color: theme.primaryText }]}>+</Text>
        </Pressable>
        <View style={[styles.zoomDivider, { backgroundColor: cardBorder }]} />
        <Pressable
          style={({ pressed }) => [styles.zoomButton, pressed && styles.buttonPressed]}
          onPress={handleZoomOut}
          focusable={true}
          accessibilityRole="button"
          accessibilityLabel="Zoom out"
          hitSlop={8}
        >
          <Text style={[styles.zoomButtonText, { color: theme.primaryText }]}>−</Text>
        </Pressable>
      </View>

      {/* 4. Scenic Region Focus Navigator */}
      <View style={[styles.regionBar, { backgroundColor: overlayBg, borderColor: cardBorder }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.regionScrollContent}
        >
          {availableRegions.map((region) => (
            <Pressable
              key={region.id}
              style={({ pressed }) => [
                styles.regionPill,
                {
                  backgroundColor: pillInactiveBg,
                  borderColor: cardBorder,
                },
                pressed && styles.buttonPressed,
              ]}
              onPress={() => handleFocusRegion(region.id)}
              focusable={true}
              accessibilityRole="button"
              accessibilityLabel={`Focus ${region.label}`}
              accessibilityHint={`Focuses garden camera on the ${region.label} region`}
              hitSlop={6}
            >
              <Text style={[styles.regionPillText, { color: pillInactiveText }]}>
                {region.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* 5. Selected Feature / Memory Preview Banner */}
      {selectedNode && (
        <View style={[styles.selectionCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles.selectionCardHeader}>
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.kindBadge,
                  {
                    backgroundColor: selectedNode.isEarned
                      ? isLight
                        ? "#F0EBF4"
                        : "#34263E"
                      : isLight
                      ? "#E8EFEA"
                      : "#223126",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.kindBadgeText,
                    {
                      color: selectedNode.isEarned
                        ? theme.primaryAccent
                        : isLight
                        ? "#2D5A3A"
                        : "#82C194",
                    },
                  ]}
                >
                  {selectedNode.isEarned ? "SHARED MEMORY" : "BOTANICAL FEATURE"}
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
              onPress={() => setSelectedNode(null)}
              focusable={true}
              accessibilityRole="button"
              accessibilityLabel="Dismiss feature preview"
              hitSlop={10}
            >
              <Text style={[styles.closeSelectionText, { color: theme.secondaryText }]}>✕</Text>
            </Pressable>
          </View>

          {/* Earned Memory Content */}
          {selectedNode.isEarned ? (
            <View style={styles.memoryDetails}>
              <Text style={[styles.featureTitle, { color: theme.primaryText }]}>
                {selectedEvent?.displayTitle ||
                  (selectedNode.sourceEvent?.kind === "reconnection"
                    ? "Reconnection Blossom"
                    : selectedNode.sourceEvent?.kind === "important_date"
                    ? "Anniversary Landmark"
                    : "Shared Moment Bloom")}
              </Text>
              {selectedEvent?.occurredAt && (
                <Text style={[styles.featureDate, { color: theme.secondaryText }]}>
                  {new Date(selectedEvent.occurredAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </Text>
              )}
              <Text style={[styles.featureHint, { color: theme.secondaryText }]}>
                Nourished by your relationship care.
              </Text>
            </View>
          ) : (
            /* Decorative Landscape Feature Content */
            <View style={styles.memoryDetails}>
              <Text style={[styles.featureTitle, { color: theme.primaryText }]}>
                {decorativeLabel}
              </Text>
              <Text style={[styles.featureHint, { color: theme.secondaryText }]}>
                A living part of your shared sanctuary.
              </Text>
            </View>
          )}
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
    paddingHorizontal: 12,
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
  },
  buttonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
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
    alignItems: "center",
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  modeSubtitle: {
    fontSize: 11,
    fontWeight: "500",
  },
  resetButton: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
    borderRadius: 16,
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
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  regionPillText: {
    fontSize: 13,
    fontWeight: "600",
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
});
