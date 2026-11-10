import React, { useId, useMemo } from "react";
import {
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { tokens } from "@/components/couply-tokens";
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
} from "react-native-svg";
import {
  generateGardenSVGScene,
  GeneratedGardenSVGScene,
} from "@/lib/garden-generator";

export interface GardenVisualizerProps {
  totalGrowthUnits: number;
  careGrowthUnits: number;
  timeGrowthUnits?: number;
  seedString: string;
  isResting?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function GardenVisualizer({
  totalGrowthUnits,
  careGrowthUnits,
  seedString,
  isResting = false,
  compact = false,
  style,
  children,
}: GardenVisualizerProps) {
  const sceneId = useId().replace(/:/g, "_");

  const scene: GeneratedGardenSVGScene = useMemo(() => {
    return generateGardenSVGScene(
      seedString,
      totalGrowthUnits,
      careGrowthUnits,
      isResting
    );
  }, [seedString, totalGrowthUnits, careGrowthUnits, isResting]);

  const skyGradId = `gardenSkyGrad_${sceneId}`;
  const sunGlowId = `gardenSunGlow_${sceneId}`;

  return (
    <View
      style={[
        compact ? styles.compactContainer : styles.fullContainer,
        style,
      ]}
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={scene.accessibilityDescription}
    >
      <View
        style={styles.svgWrapper}
        accessibilityElementsHidden={true}
        importantForAccessibility="no"
      >
        <Svg
          viewBox="0 0 800 500"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid slice"
        >
          <Defs>
            <LinearGradient id={skyGradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={scene.skyTop} />
              <Stop offset="65%" stopColor={scene.skyBottom} />
              <Stop
                offset="100%"
                stopColor={isResting ? scene.skyBottom : "#FFFFFF"}
                stopOpacity={isResting ? 1 : 0.8}
              />
            </LinearGradient>

            <RadialGradient
              id={sunGlowId}
              cx="50%"
              cy="50%"
              r="50%"
              fx="50%"
              fy="50%"
            >
              <Stop
                offset="0%"
                stopColor={scene.sunGlowColor}
                stopOpacity={isResting ? 0.6 : 0.9}
              />
              <Stop
                offset="45%"
                stopColor={scene.sunGlowColor}
                stopOpacity={isResting ? 0.3 : 0.45}
              />
              <Stop
                offset="100%"
                stopColor={scene.sunGlowColor}
                stopOpacity={0}
              />
            </RadialGradient>
          </Defs>

          {/* 1. Sky & Atmospheric Background */}
          <Rect
            x="0"
            y="0"
            width="800"
            height="500"
            rx={compact ? 16 : 24}
            fill={`url(#${skyGradId})`}
          />

          {/* Sun / Moon Orb */}
          <Circle
            cx="640"
            cy="115"
            r={isResting ? 36 : 56}
            fill={`url(#${sunGlowId})`}
          />
          {isResting && (
            <Circle
              cx="644"
              cy="112"
              r="14"
              fill={scene.palette.blossomSecondary}
              opacity={0.7}
            />
          )}

          {/* Distant soft landscape layer */}
          <Path
            d={scene.distantHillsPath}
            fill={scene.palette.deepFoliage}
            opacity={0.18}
          />

          {/* 2. Three depth-layered ground paths */}
          <Path
            d={scene.groundLayerBack}
            fill={scene.palette.groundBase}
            opacity={0.65}
          />
          <Path
            d={scene.groundLayerMid}
            fill={scene.palette.groundHighlight}
          />
          <Path
            d={scene.groundLayerFront}
            fill={scene.palette.groundBase}
          />

          {/* 3. Ground Details (stones, grass tufts, tiny flowers) */}
          {scene.groundDetails.map((item) => {
            if (item.type === "stone" && item.cx && item.cy) {
              return (
                <Ellipse
                  key={item.id}
                  cx={item.cx}
                  cy={item.cy}
                  rx={item.rx || 8}
                  ry={item.ry || 4}
                  fill={item.color}
                  opacity={0.5}
                />
              );
            }
            if (item.type === "grass" && item.d) {
              return (
                <Path
                  key={item.id}
                  d={item.d}
                  stroke={item.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  fill="none"
                  opacity={0.8}
                />
              );
            }
            if (item.type === "flower" && item.cx && item.cy) {
              return (
                <G key={item.id}>
                  <Circle
                    cx={item.cx}
                    cy={item.cy}
                    r={3.5}
                    fill={item.color}
                  />
                  <Circle
                    cx={item.cx - 2}
                    cy={item.cy - 1}
                    r={2}
                    fill={item.accentColor || scene.palette.blossomSecondary}
                    opacity={0.8}
                  />
                </G>
              );
            }
            return null;
          })}

          {/* 4. Tree Structure: Trunk & Root Flare */}
          <Path
            d={scene.trunkPath}
            fill={
              scene.stage.key === "first_seedling"
                ? scene.palette.accentLeaf
                : scene.palette.trunk
            }
          />

          {scene.trunkHighlightPath && (
            <Path
              d={scene.trunkHighlightPath}
              stroke={
                scene.stage.key === "first_seedling"
                  ? scene.palette.lightFoliage
                  : scene.palette.trunkHighlight
              }
              strokeWidth={2}
              strokeLinecap="round"
              fill="none"
              opacity={0.65}
            />
          )}

          {/* Branches */}
          {scene.branches.map((branchD, i) => (
            <Path
              key={`branch-${i}`}
              d={branchD}
              fill={scene.palette.trunk}
            />
          ))}

          {/* 5. Organic Overlapping Foliage Clusters */}
          {scene.foliageClusters.map((cluster) => (
            <Path
              key={cluster.id}
              d={cluster.d}
              fill={cluster.color}
              opacity={cluster.opacity}
            />
          ))}

          {/* 6. Blossoms */}
          {scene.blossoms.map((blossom) => (
            <G key={blossom.id}>
              {/* Petal cluster halo */}
              {blossom.hasCluster && (
                <>
                  <Circle
                    cx={blossom.cx - 3}
                    cy={blossom.cy - 1}
                    r={blossom.r * 0.75}
                    fill={blossom.petalColor}
                    opacity={0.85}
                  />
                  <Circle
                    cx={blossom.cx + 3}
                    cy={blossom.cy - 1}
                    r={blossom.r * 0.75}
                    fill={blossom.petalColor}
                    opacity={0.85}
                  />
                  <Circle
                    cx={blossom.cx}
                    cy={blossom.cy + 3}
                    r={blossom.r * 0.75}
                    fill={blossom.petalColor}
                    opacity={0.85}
                  />
                </>
              )}
              {/* Main blossom core */}
              <Circle
                cx={blossom.cx}
                cy={blossom.cy}
                r={blossom.r}
                fill={blossom.color}
              />
              <Circle
                cx={blossom.cx}
                cy={blossom.cy}
                r={blossom.r * 0.35}
                fill="#FFFFFF"
                opacity={0.8}
              />
            </G>
          ))}

          {/* 7. Wildlife: Resting Creature */}
          {scene.restingCreature && (
            <G>
              {scene.restingCreature.type === "butterfly" ? (
                <G>
                  <Path
                    d={`M ${scene.restingCreature.cx},${scene.restingCreature.cy} C ${scene.restingCreature.cx - 10},${scene.restingCreature.cy - 8} ${scene.restingCreature.cx - 8},${scene.restingCreature.cy + 6} ${scene.restingCreature.cx},${scene.restingCreature.cy + 3} Z`}
                    fill={scene.palette.blossomSecondary}
                  />
                  <Path
                    d={`M ${scene.restingCreature.cx},${scene.restingCreature.cy} C ${scene.restingCreature.cx + 10},${scene.restingCreature.cy - 8} ${scene.restingCreature.cx + 8},${scene.restingCreature.cy + 6} ${scene.restingCreature.cx},${scene.restingCreature.cy + 3} Z`}
                    fill={scene.palette.blossomPrimary}
                  />
                  <Circle
                    cx={scene.restingCreature.cx}
                    cy={scene.restingCreature.cy + 2}
                    r={1.5}
                    fill={scene.palette.trunk}
                  />
                </G>
              ) : (
                <G>
                  <Ellipse
                    cx={scene.restingCreature.cx}
                    cy={scene.restingCreature.cy}
                    rx={6}
                    ry={4}
                    fill={scene.palette.trunk}
                  />
                  <Circle
                    cx={scene.restingCreature.cx - 5}
                    cy={scene.restingCreature.cy - 2}
                    r={3}
                    fill={scene.palette.trunkHighlight}
                  />
                </G>
              )}
            </G>
          )}
        </Svg>
      </View>

      {/* Optional Overlay / Children */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fullContainer: {
    width: "100%",
    maxWidth: tokens.layout.appShell,
    aspectRatio: 16 / 10,
    minHeight: 300,
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
    alignSelf: "center",
    shadowColor: "#2D1F33",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  compactContainer: {
    width: "100%",
    height: "100%",
    borderRadius: 18,
    overflow: "hidden",
    position: "relative",
  },
  svgWrapper: {
    ...StyleSheet.absoluteFill,
  },
});
