import React, { useId, useMemo } from "react";
import {
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { tokens } from "@/components/couply-tokens";
import { useTheme } from "@/context/ThemeContext";
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
  GardenCareEvent,
  GardenCareSignals,
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
  careSignals?: GardenCareSignals;
  careEvents?: GardenCareEvent[];
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  highlightFeatureId?: string | null;
}

export function GardenVisualizer({
  totalGrowthUnits,
  careGrowthUnits,
  seedString,
  isResting = false,
  compact = false,
  careSignals,
  careEvents,
  style,
  children,
  highlightFeatureId,
}: GardenVisualizerProps) {
  const sceneId = useId().replace(/:/g, "_");
  const { effectiveTheme } = useTheme();

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

  const skyGradId = `gardenSkyGrad_${sceneId}`;
  const sunGlowId = `gardenSunGlow_${sceneId}`;
  const meadowGradId = `gardenMeadowGrad_${sceneId}`;
  const rearGrassGradId = `gardenRearGrassGrad_${sceneId}`;
  const midGrassGradId = `gardenMidGrassGrad_${sceneId}`;
  const foregroundGrassGradId = `gardenForegroundGrassGrad_${sceneId}`;
  const soilMoundGradId = `gardenSoilMoundGrad_${sceneId}`;

  const isCompact = compact === true;

  const highlightCoord = useMemo(() => {
    if (!highlightFeatureId) return null;
    const b = scene.blossoms.find((x) => x.id === highlightFeatureId || x.id.startsWith(highlightFeatureId));
    if (b) return { cx: b.cx, cy: b.cy, r: b.r || 10 };

    const h = (scene.habitatDetails || []).find((x) => x.id === highlightFeatureId || x.id.startsWith(highlightFeatureId));
    if (h) return { cx: h.cx, cy: h.cy, r: 14 };

    const c = (scene.canopyDetails || []).find((x) => x.id === highlightFeatureId || x.id.startsWith(highlightFeatureId));
    if (c) {
      if (c.buds && c.buds.length > 0) return { cx: c.buds[0].cx, cy: c.buds[0].cy, r: 12 };
      if (c.berries && c.berries.length > 0) return { cx: c.berries[0].cx, cy: c.berries[0].cy, r: 10 };
    }

    const g = scene.groundDetails.find((x) => x.id === highlightFeatureId || x.id.startsWith(highlightFeatureId));
    if (g && typeof g.cx === "number" && typeof g.cy === "number") {
      return { cx: g.cx, cy: g.cy, r: 12 };
    }

    return null;
  }, [scene, highlightFeatureId]);

  // Step 7: Soil texture, embedded stones and root flare shadow (rendered beneath roots and trunk)
  const preTreeDetails = useMemo(() => {
    return scene.groundDetails.filter((item) => {
      if (isCompact && item.compact === false) return false;
      return (
        item.type === "soil-fleck" ||
        item.type === "stone" ||
        item.type === "root-shadow"
      );
    });
  }, [scene.groundDetails, isCompact]);

  // Step 9: Moss, grass blades, ground cover and companion flora (layering in front of root base)
  const postTreeDetails = useMemo(() => {
    return scene.groundDetails.filter((item) => {
      if (isCompact && item.compact === false) return false;
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
  }, [scene.groundDetails, isCompact]);

  const visibleCanopyDetails = useMemo(() => {
    return (scene.canopyDetails || []).filter(
      (item) => !(isCompact && item.compact === false)
    );
  }, [scene.canopyDetails, isCompact]);

  const visibleHabitatDetails = useMemo(() => {
    return (scene.habitatDetails || []).filter(
      (item) => !(isCompact && item.compact === false)
    );
  }, [scene.habitatDetails, isCompact]);

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

            {/* Natural Landscape Linear Gradients */}
            <LinearGradient id={meadowGradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={scene.groundPalette.meadowTop} />
              <Stop offset="100%" stopColor={scene.groundPalette.meadowBottom} />
            </LinearGradient>

            <LinearGradient id={rearGrassGradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={scene.groundPalette.rearGrassTop} />
              <Stop offset="100%" stopColor={scene.groundPalette.rearGrassBottom} />
            </LinearGradient>

            <LinearGradient id={midGrassGradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={scene.groundPalette.midGrassTop} />
              <Stop offset="100%" stopColor={scene.groundPalette.midGrassBottom} />
            </LinearGradient>

            <LinearGradient id={foregroundGrassGradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={scene.groundPalette.frontGrassTop} />
              <Stop offset="100%" stopColor={scene.groundPalette.frontGrassBottom} />
            </LinearGradient>

            <LinearGradient id={soilMoundGradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={scene.groundPalette.exposedSoilTop} />
              <Stop offset="45%" stopColor={scene.groundPalette.exposedSoilMid} />
              <Stop offset="100%" stopColor={scene.groundPalette.exposedSoilBottom} />
            </LinearGradient>
          </Defs>

          {/* 1. Sky & Atmospheric Background */}
          <Rect
            x="0"
            y="0"
            width="800"
            height="500"
            rx={compact ? 0 : 24}
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

          {/* 2. Distant rolling landscape layer */}
          <Path
            d={scene.distantHillsPath}
            fill={`url(#${meadowGradId})`}
          />

          {/* 3. Rear grass layer */}
          <Path
            d={scene.groundLayerBack}
            fill={`url(#${rearGrassGradId})`}
          />

          {/* 4. Middle grass layer */}
          <Path
            d={scene.groundLayerMid}
            fill={`url(#${midGrassGradId})`}
          />

          {/* 5. Foreground grass layer */}
          <Path
            d={scene.groundLayerFront}
            fill={`url(#${foregroundGrassGradId})`}
          />

          {/* 6. Exposed soil mound */}
          {scene.soilBedPath && (
            <Path
              d={scene.soilBedPath}
              fill={`url(#${soilMoundGradId})`}
            />
          )}

          {/* 7. Soil texture and embedded stones (rendered beneath roots and trunk) */}
          {preTreeDetails.map((item) => {
            if (item.type === "root-shadow" && item.d) {
              return (
                <Path
                  key={item.id}
                  d={item.d}
                  fill={item.color}
                  opacity={0.38}
                />
              );
            }
            if (item.type === "soil-fleck" && item.d) {
              return (
                <Path
                  key={item.id}
                  d={item.d}
                  stroke={item.color}
                  strokeWidth={1.2}
                  strokeLinecap="round"
                  fill="none"
                  opacity={0.65}
                />
              );
            }
            if (item.type === "stone" && item.cx && item.cy && item.rx && item.ry) {
              return (
                <G key={item.id}>
                  {/* Bedding contact shadow */}
                  <Ellipse
                    cx={item.cx}
                    cy={item.cy + item.ry * 0.4}
                    rx={item.rx * 1.05}
                    ry={item.ry * 0.55}
                    fill={scene.groundPalette.deepSoilShadow}
                    opacity={0.45}
                  />
                  {/* Stone body */}
                  <Ellipse
                    cx={item.cx}
                    cy={item.cy}
                    rx={item.rx}
                    ry={item.ry}
                    fill={item.color}
                  />
                  {/* Gentle top highlight */}
                  <Ellipse
                    cx={item.cx - item.rx * 0.12}
                    cy={item.cy - item.ry * 0.22}
                    rx={item.rx * 0.65}
                    ry={item.ry * 0.45}
                    fill={item.accentColor || scene.groundPalette.stoneLight}
                    opacity={0.55}
                  />
                </G>
              );
            }
            return null;
          })}

          {/* 8. Roots and Trunk Flare (firmly planted on soil mound) */}
          {scene.rootShadowPath && (
            <Path
              d={scene.rootShadowPath}
              fill={scene.groundPalette.deepSoilShadow}
              opacity={0.35}
            />
          )}

          {/* Roots merging into soil */}
          {scene.rootPaths?.map((rootD, idx) => (
            <Path
              key={`root-${idx}`}
              d={rootD}
              stroke={scene.palette.trunk}
              strokeWidth={3.5}
              strokeLinecap="round"
              fill="none"
              opacity={0.95}
            />
          ))}

          {/* Soft shadow on trunk */}
          {scene.trunkShadowPath && (
            <Path
              d={scene.trunkShadowPath}
              stroke={scene.palette.trunkShadow}
              strokeWidth={3.5}
              strokeLinecap="round"
              fill="none"
              opacity={0.55}
            />
          )}

          {/* Trunk & Bark */}
          <Path d={scene.trunkPath} fill={scene.palette.trunk} />

          {/* Soft highlight on trunk */}
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

          {/* 9. Moss, grass blades, ground cover and companion flora (layering in front of root base) */}
          {postTreeDetails.map((item) => {
            if (item.type === "moss" && item.cx && item.cy && item.rx && item.ry) {
              return (
                <G key={item.id}>
                  {/* Main cushion */}
                  <Ellipse
                    cx={item.cx}
                    cy={item.cy}
                    rx={item.rx}
                    ry={item.ry}
                    fill={item.color}
                    opacity={0.88}
                  />
                  {/* Companion micro-cushion */}
                  <Ellipse
                    cx={item.cx + item.rx * 0.35}
                    cy={item.cy + item.ry * 0.15}
                    rx={item.rx * 0.55}
                    ry={item.ry * 0.65}
                    fill={item.color}
                    opacity={0.82}
                  />
                  {/* Gentle sun highlight */}
                  <Ellipse
                    cx={item.cx - item.rx * 0.15}
                    cy={item.cy - item.ry * 0.2}
                    rx={item.rx * 0.5}
                    ry={item.ry * 0.4}
                    fill={item.accentColor || scene.groundPalette.mossHighlight}
                    opacity={0.6}
                  />
                </G>
              );
            }
            if (item.type === "grass" && item.d) {
              return (
                <Path
                  key={item.id}
                  d={item.d}
                  stroke={item.color}
                  strokeWidth={1.4}
                  strokeLinecap="round"
                  fill="none"
                  opacity={0.85}
                />
              );
            }
            if (item.type === "ground-cover" && item.cx && item.cy) {
              return (
                <G key={item.id}>
                  <Ellipse
                    cx={item.cx - 3.5}
                    cy={item.cy}
                    rx={3.5}
                    ry={2.0}
                    fill={item.color}
                    transform={`rotate(-25, ${item.cx - 3.5}, ${item.cy})`}
                    opacity={0.85}
                  />
                  <Ellipse
                    cx={item.cx + 3.5}
                    cy={item.cy}
                    rx={3.5}
                    ry={2.0}
                    fill={item.color}
                    transform={`rotate(25, ${item.cx + 3.5}, ${item.cy})`}
                    opacity={0.85}
                  />
                  <Circle
                    cx={item.cx}
                    cy={item.cy - 1.5}
                    r={1.2}
                    fill={item.accentColor || scene.groundPalette.midGrassTop}
                  />
                </G>
              );
            }
            if (item.type === "bud" && item.cx && item.cy && item.rx && item.ry) {
              return (
                <Ellipse
                  key={item.id}
                  cx={item.cx}
                  cy={item.cy}
                  rx={item.rx}
                  ry={item.ry}
                  fill={item.color}
                />
              );
            }
            if (item.type === "flower" && item.cx && item.cy) {
              return (
                <G key={item.id}>
                  {item.accentColor && (
                    <Path
                      d={`M ${item.cx},${item.cy} C ${item.cx - 6},${item.cy - 2} ${item.cx - 8},${item.cy - 7} ${item.cx - 4},${item.cy - 7} Z`}
                      fill={item.accentColor}
                    />
                  )}
                  {/* Organic alpine flower petals */}
                  <Circle
                    cx={item.cx - 2}
                    cy={item.cy - 1}
                    r={2.2}
                    fill={item.color}
                    opacity={0.9}
                  />
                  <Circle
                    cx={item.cx + 2}
                    cy={item.cy - 1}
                    r={2.2}
                    fill={item.color}
                    opacity={0.9}
                  />
                  <Circle
                    cx={item.cx}
                    cy={item.cy + 2}
                    r={2.2}
                    fill={item.color}
                    opacity={0.9}
                  />
                  {/* Flower Center */}
                  <Circle
                    cx={item.cx}
                    cy={item.cy}
                    r={1.8}
                    fill={scene.palette.blossomCenter}
                  />
                  <Circle
                    cx={item.cx}
                    cy={item.cy}
                    r={0.8}
                    fill={scene.palette.blossomCream}
                    opacity={0.7}
                  />
                </G>
              );
            }
            if (item.type === "fern" && item.stemPath) {
              return (
                <G key={item.id}>
                  {item.leafPaths?.map((lp) => (
                    <Path
                      key={lp.id}
                      d={lp.d}
                      fill={lp.color}
                      opacity={0.94}
                    />
                  ))}
                  <Path
                    d={item.stemPath}
                    stroke={item.accentColor || scene.groundPalette.midGrassTop}
                    strokeWidth={1.3}
                    strokeLinecap="round"
                    fill="none"
                  />
                </G>
              );
            }
            if (item.type === "clover" && item.leafPaths) {
              return (
                <G key={item.id}>
                  {item.stemPath && (
                    <Path
                      d={item.stemPath}
                      stroke={item.color}
                      strokeWidth={1.2}
                      strokeLinecap="round"
                      fill="none"
                    />
                  )}
                  {item.leafPaths.map((lp) => (
                    <Path
                      key={lp.id}
                      d={lp.d}
                      fill={lp.color}
                      opacity={0.92}
                    />
                  ))}
                </G>
              );
            }
            if (item.type === "seed-head" && item.stemPath) {
              return (
                <G key={item.id}>
                  <Path
                    d={item.stemPath}
                    stroke={item.color}
                    strokeWidth={1.3}
                    strokeLinecap="round"
                    fill="none"
                  />
                  {item.seedGrains?.map((sg, idx) => (
                    <Ellipse
                      key={`${item.id}-grain-${idx}`}
                      cx={sg.cx}
                      cy={sg.cy}
                      rx={sg.rx}
                      ry={sg.ry}
                      fill={sg.color}
                      transform={`rotate(${sg.angle}, ${sg.cx}, ${sg.cy})`}
                      opacity={0.95}
                    />
                  ))}
                </G>
              );
            }
            if (item.type === "sprout" && item.stemPath) {
              return (
                <G key={item.id}>
                  <Path
                    d={item.stemPath}
                    stroke={item.color}
                    strokeWidth={1.3}
                    strokeLinecap="round"
                    fill="none"
                  />
                  {item.leafPaths?.map((lp) => (
                    <Path
                      key={lp.id}
                      d={lp.d}
                      fill={lp.color}
                      opacity={0.94}
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
                    stroke={item.accentColor || scene.groundPalette.midGrassTop}
                    strokeWidth={1.3}
                    strokeLinecap="round"
                    fill="none"
                  />
                  {item.florets?.map((fl, fIdx) => (
                    <G key={`${item.id}-floret-${fIdx}`}>
                      <Ellipse
                        cx={fl.cx - fl.r * 0.72}
                        cy={fl.cy}
                        rx={fl.r * 0.7}
                        ry={fl.r * 0.45}
                        fill={fl.petalColor}
                        opacity={0.95}
                      />
                      <Ellipse
                        cx={fl.cx + fl.r * 0.72}
                        cy={fl.cy}
                        rx={fl.r * 0.7}
                        ry={fl.r * 0.45}
                        fill={fl.petalColor}
                        opacity={0.95}
                      />
                      <Ellipse
                        cx={fl.cx}
                        cy={fl.cy - fl.r * 0.72}
                        rx={fl.r * 0.45}
                        ry={fl.r * 0.7}
                        fill={fl.petalColor}
                        opacity={0.95}
                      />
                      <Ellipse
                        cx={fl.cx}
                        cy={fl.cy + fl.r * 0.72}
                        rx={fl.r * 0.45}
                        ry={fl.r * 0.7}
                        fill={fl.petalColor}
                        opacity={0.95}
                      />
                      <Circle
                        cx={fl.cx}
                        cy={fl.cy}
                        r={Math.max(1.0, fl.r * 0.42)}
                        fill={fl.centerColor}
                      />
                    </G>
                  ))}
                </G>
              );
            }
            return null;
          })}

          {/* 10. Tree Branches, Foliage, Leaf Veins, Canopy Positive Accents, Blossoms, Seed Pods and Wildlife */}
          {/* Branches */}
          {scene.branches.map((branchD, i) => (
            <Path
              key={`branch-${i}`}
              d={branchD}
              fill={scene.palette.trunk}
            />
          ))}

          {/* Organic Overlapping Foliage Clusters */}
          {scene.foliageClusters.map((cluster) => (
            <Path
              key={cluster.id}
              d={cluster.d}
              fill={cluster.color}
              opacity={cluster.opacity}
            />
          ))}

          {/* Leaf Veins (central & secondary veins shown in full view) */}
          {!compact &&
            scene.leafVeins?.map((vein) => (
              <Path
                key={vein.id}
                d={vein.d}
                stroke={vein.color}
                strokeWidth={vein.strokeWidth}
                strokeLinecap="round"
                fill="none"
                opacity={vein.opacity ?? 0.5}
              />
            ))}

          {/* Diversified Positive Moment Canopy Details (shoots, twigs, closed buds, berries) */}
          {visibleCanopyDetails.map((detail) => (
            <G key={detail.id}>
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
                  <Path d={lf.d} fill={lf.color} opacity={0.95} />
                  {!compact && lf.veinD && (
                    <Path
                      d={lf.veinD}
                      stroke={lf.veinColor || scene.palette.foliageVein}
                      strokeWidth={1.1}
                      strokeLinecap="round"
                      fill="none"
                      opacity={0.5}
                    />
                  )}
                </G>
              ))}
              {detail.buds?.map((bd) => (
                <G
                  key={bd.id}
                  transform={`rotate(${bd.angle}, ${bd.cx}, ${bd.cy})`}
                >
                  {/* Elongated unopened bud body */}
                  <Ellipse
                    cx={bd.cx}
                    cy={bd.cy - bd.ry * 0.4}
                    rx={bd.rx}
                    ry={bd.ry}
                    fill={bd.budColor}
                    opacity={0.96}
                  />
                  {/* Sepal calyx embrace at bud base */}
                  <Path
                    d={`M ${(bd.cx - bd.rx * 1.05).toFixed(1)},${(bd.cy + bd.ry * 0.25).toFixed(1)} Q ${bd.cx.toFixed(1)},${(bd.cy - bd.ry * 0.25).toFixed(1)} ${(bd.cx + bd.rx * 1.05).toFixed(1)},${(bd.cy + bd.ry * 0.25).toFixed(1)} Q ${bd.cx.toFixed(1)},${(bd.cy + bd.ry * 0.72).toFixed(1)} ${(bd.cx - bd.rx * 1.05).toFixed(1)},${(bd.cy + bd.ry * 0.25).toFixed(1)} Z`}
                    fill={bd.calyxColor}
                    opacity={0.95}
                  />
                  {/* Delicate highlight */}
                  <Circle
                    cx={bd.cx - bd.rx * 0.28}
                    cy={bd.cy - bd.ry * 0.65}
                    r={Math.max(0.7, bd.rx * 0.28)}
                    fill={bd.highlightColor}
                    opacity={0.55}
                  />
                </G>
              ))}
              {detail.berries?.map((br) => (
                <G key={br.id}>
                  <Ellipse
                    cx={br.cx}
                    cy={br.cy}
                    rx={br.rx}
                    ry={br.ry}
                    fill={br.color}
                    opacity={0.96}
                  />
                  <Circle
                    cx={br.cx - br.rx * 0.32}
                    cy={br.cy - br.ry * 0.3}
                    r={Math.max(0.7, br.rx * 0.28)}
                    fill={br.highlightColor}
                    opacity={0.62}
                  />
                </G>
              ))}
            </G>
          ))}

          {/* Organic Layered Blossoms (rendered in compact and full view) */}
          {scene.blossoms.map((blossom) => (
            <G key={blossom.id}>
              {/* Petals */}
              {blossom.petals ? (
                blossom.petals.map((petal, pIdx) => (
                  <Path
                    key={`${blossom.id}-petal-${pIdx}`}
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

              {/* Darker Floral Core Center */}
              <Circle
                cx={blossom.cx}
                cy={blossom.cy}
                r={blossom.centerRadius ?? Math.max(1.8, blossom.r * 0.32)}
                fill={blossom.centerColor ?? scene.palette.blossomCenter}
                opacity={0.92}
              />

              {/* Gentle Illuminating Core Highlight */}
              <Circle
                cx={blossom.cx - blossom.r * 0.08}
                cy={blossom.cy - blossom.r * 0.08}
                r={Math.max(0.8, blossom.r * 0.12)}
                fill={blossom.highlightColor ?? scene.palette.blossomCream}
                opacity={0.45}
              />
            </G>
          ))}

          {/* Seed Pods / Fruit in Mature Stages */}
          {scene.seedPods?.map((pod) => (
            <G key={pod.id}>
              {/* Stem attaching pod to branch */}
              <Path
                d={`M ${pod.cx},${pod.cy - pod.ry} Q ${pod.cx + 2},${pod.cy - pod.ry - 6} ${pod.cx + 4},${pod.cy - pod.ry - 10}`}
                stroke={pod.stemColor}
                strokeWidth={1.5}
                strokeLinecap="round"
                fill="none"
              />
              {/* Main organic fruit / seed-pod body */}
              <Ellipse
                cx={pod.cx}
                cy={pod.cy}
                rx={pod.rx}
                ry={pod.ry}
                fill={pod.color}
                opacity={0.92}
              />
              {/* Gentle highlight */}
              <Circle
                cx={pod.cx - pod.rx * 0.3}
                cy={pod.cy - pod.ry * 0.3}
                r={pod.rx * 0.3}
                fill={pod.highlightColor ?? scene.palette.blossomCream}
                opacity={0.45}
              />
            </G>
          ))}

          {/* Wildlife: Resting Creature */}
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

          {/* Positive-History Habitat Enrichment (Butterflies, Pollinators, Perch Birds, Nest Material) */}
          {visibleHabitatDetails.map((h) => {
            const s = h.scale;
            const dir = h.flip ? -1 : 1;
            if (h.kind === "butterfly") {
              return (
                <G key={h.id}>
                  {/* Upper wings */}
                  <Path
                    d={`M ${h.cx},${h.cy} C ${h.cx - 9 * s},${h.cy - 9 * s} ${h.cx - 11 * s},${h.cy + 1 * s} ${h.cx},${h.cy + 2 * s} Z`}
                    fill={h.primaryColor}
                    opacity={0.92}
                  />
                  <Path
                    d={`M ${h.cx},${h.cy} C ${h.cx + 9 * s},${h.cy - 9 * s} ${h.cx + 11 * s},${h.cy + 1 * s} ${h.cx},${h.cy + 2 * s} Z`}
                    fill={h.secondaryColor}
                    opacity={0.92}
                  />
                  {/* Lower wings */}
                  <Path
                    d={`M ${h.cx},${h.cy + 1.5 * s} C ${h.cx - 6 * s},${h.cy + 2 * s} ${h.cx - 5 * s},${h.cy + 8 * s} ${h.cx},${h.cy + 5 * s} Z`}
                    fill={h.secondaryColor}
                    opacity={0.86}
                  />
                  <Path
                    d={`M ${h.cx},${h.cy + 1.5 * s} C ${h.cx + 6 * s},${h.cy + 2 * s} ${h.cx + 5 * s},${h.cy + 8 * s} ${h.cx},${h.cy + 5 * s} Z`}
                    fill={h.primaryColor}
                    opacity={0.86}
                  />
                  <Ellipse
                    cx={h.cx}
                    cy={h.cy + 2 * s}
                    rx={1.1 * s}
                    ry={3.4 * s}
                    fill={h.accentColor}
                  />
                </G>
              );
            }
            if (h.kind === "pollinator") {
              return (
                <G key={h.id}>
                  <Ellipse
                    cx={h.cx - dir * 1.4 * s}
                    cy={h.cy - 2.6 * s}
                    rx={2.6 * s}
                    ry={1.6 * s}
                    fill={h.secondaryColor}
                    transform={`rotate(${-dir * 20}, ${h.cx - dir * 1.4 * s}, ${h.cy - 2.6 * s})`}
                    opacity={0.78}
                  />
                  <Ellipse
                    cx={h.cx + dir * 1.2 * s}
                    cy={h.cy - 2.4 * s}
                    rx={2.4 * s}
                    ry={1.5 * s}
                    fill={h.secondaryColor}
                    transform={`rotate(${dir * 22}, ${h.cx + dir * 1.2 * s}, ${h.cy - 2.4 * s})`}
                    opacity={0.72}
                  />
                  <Ellipse
                    cx={h.cx}
                    cy={h.cy}
                    rx={3.1 * s}
                    ry={1.9 * s}
                    fill={h.primaryColor}
                  />
                  <Path
                    d={`M ${(h.cx - 0.6 * s).toFixed(1)},${(h.cy - 1.7 * s).toFixed(1)} L ${(h.cx - 0.6 * s).toFixed(1)},${(h.cy + 1.7 * s).toFixed(1)} M ${(h.cx + 1.0 * s).toFixed(1)},${(h.cy - 1.5 * s).toFixed(1)} L ${(h.cx + 1.0 * s).toFixed(1)},${(h.cy + 1.5 * s).toFixed(1)}`}
                    stroke={h.accentColor}
                    strokeWidth={1.0}
                  />
                </G>
              );
            }
            if (h.kind === "bird-perch") {
              return (
                <G key={h.id}>
                  {h.stemPath && (
                    <Path
                      d={h.stemPath}
                      stroke={h.primaryColor}
                      strokeWidth={2.0}
                      strokeLinecap="round"
                      fill="none"
                    />
                  )}
                  {/* Tail feather */}
                  <Path
                    d={`M ${(h.cx + dir * 4 * s).toFixed(1)},${(h.cy + 1 * s).toFixed(1)} L ${(h.cx + dir * 11 * s).toFixed(1)},${(h.cy - 2 * s).toFixed(1)} L ${(h.cx + dir * 10 * s).toFixed(1)},${(h.cy + 3 * s).toFixed(1)} Z`}
                    fill={h.primaryColor}
                  />
                  {/* Perched songbird body */}
                  <Ellipse
                    cx={h.cx}
                    cy={h.cy}
                    rx={5.4 * s}
                    ry={3.8 * s}
                    fill={h.primaryColor}
                  />
                  <Ellipse
                    cx={h.cx - dir * 1.2 * s}
                    cy={h.cy + 0.9 * s}
                    rx={3.4 * s}
                    ry={2.2 * s}
                    fill={h.accentColor}
                    opacity={0.75}
                  />
                  {/* Head & beak */}
                  <Circle
                    cx={h.cx - dir * 4.4 * s}
                    cy={h.cy - 2.6 * s}
                    r={2.8 * s}
                    fill={h.secondaryColor}
                  />
                  <Path
                    d={`M ${(h.cx - dir * 6.8 * s).toFixed(1)},${(h.cy - 3.0 * s).toFixed(1)} L ${(h.cx - dir * 9.5 * s).toFixed(1)},${(h.cy - 2.2 * s).toFixed(1)} L ${(h.cx - dir * 6.8 * s).toFixed(1)},${(h.cy - 1.5 * s).toFixed(1)} Z`}
                    fill={h.accentColor}
                  />
                </G>
              );
            }
            // nest-material tucked securely into branch fork
            return (
              <G key={h.id}>
                <Path
                  d={`M ${(h.cx - 9.5 * s).toFixed(1)},${(h.cy - 2 * s).toFixed(1)} Q ${h.cx.toFixed(1)},${(h.cy + 1.5 * s).toFixed(1)} ${(h.cx + 9.5 * s).toFixed(1)},${(h.cy - 2 * s).toFixed(1)} Q ${(h.cx + 7.5 * s).toFixed(1)},${(h.cy + 7.5 * s).toFixed(1)} ${h.cx.toFixed(1)},${(h.cy + 7.8 * s).toFixed(1)} Q ${(h.cx - 7.5 * s).toFixed(1)},${(h.cy + 7.5 * s).toFixed(1)} ${(h.cx - 9.5 * s).toFixed(1)},${(h.cy - 2 * s).toFixed(1)} Z`}
                  fill={h.primaryColor}
                  opacity={0.95}
                />
                <Path
                  d={`M ${(h.cx - 7.5 * s).toFixed(1)},${(h.cy - 0.5 * s).toFixed(1)} Q ${h.cx.toFixed(1)},${(h.cy + 3.0 * s).toFixed(1)} ${(h.cx + 7.5 * s).toFixed(1)},${(h.cy - 0.5 * s).toFixed(1)}`}
                  stroke={h.secondaryColor}
                  strokeWidth={1.3}
                  strokeLinecap="round"
                  fill="none"
                />
                <Path
                  d={`M ${(h.cx - 6.0 * s).toFixed(1)},${(h.cy + 2.5 * s).toFixed(1)} Q ${h.cx.toFixed(1)},${(h.cy + 5.5 * s).toFixed(1)} ${(h.cx + 6.0 * s).toFixed(1)},${(h.cy + 2.5 * s).toFixed(1)}`}
                  stroke={h.accentColor}
                  strokeWidth={1.1}
                  strokeLinecap="round"
                  fill="none"
                  opacity={0.8}
                />
              </G>
            );
          })}

          {/* Gentle temporary aura around newly revealed botanical feature during story playback */}
          {highlightCoord && (
            <G id="story-reveal-halo">
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
    overflow: "hidden",
    position: "relative",
  },
  svgWrapper: {
    ...StyleSheet.absoluteFill,
  },
});
