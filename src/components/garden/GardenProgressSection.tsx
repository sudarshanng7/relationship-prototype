/**
 * Purple Garden - Gentle Accessible Milestone Progress Section
 *
 * Provides a gentle, non-judgmental representation of shared garden growth.
 * Designed beneath the garden visualizer canvas (never overlaying or resizing the canvas).
 *
 * Core principles:
 * - A gentle reflection of shared history, not a competition or daily chore.
 * - Displays progress toward the NEXT canonical garden milestone.
 * - Accessible progressbar role with meaningful value text.
 * - Reduced-motion support without abrupt animations.
 * - Concise, truth-aligned explanation of growth.
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  AccessibilityInfo,
  Animated,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import {
  calculateAuthoritativeFoundation,
  resolveMvpFoundationProgress,
  type AuthoritativeFoundationCalculation,
  type GardenMilestoneProgress,
  type GardenCareEvent,
} from "@/lib/garden/stage-contracts";

export interface GardenProgressSectionProps {
  totalGrowthUnits?: number;
  careEventsCount?: number;
  careGrowthUnits?: number;
  timeGrowthUnits?: number;
  careEvents?: GardenCareEvent[];
  foundationCalculation?: AuthoritativeFoundationCalculation;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function GardenProgressSection({
  totalGrowthUnits = 0,
  careEventsCount = 0,
  careGrowthUnits,
  timeGrowthUnits,
  careEvents,
  foundationCalculation: calcProp,
  compact = false,
  style,
}: GardenProgressSectionProps) {
  const { theme, effectiveTheme } = useTheme();
  const isLight = effectiveTheme === "light";
  const isDim = effectiveTheme === "dim";
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);

  // Authoritative pure typed 100-point calculation
  const calc: AuthoritativeFoundationCalculation = useMemo(() => {
    if (calcProp) return calcProp;
    if (careEvents && careEvents.length > 0) {
      return calculateAuthoritativeFoundation(
        careEvents,
        typeof timeGrowthUnits === "number" ? timeGrowthUnits / 0.5 : 0,
        null
      );
    }
    return calculateAuthoritativeFoundation(
      totalGrowthUnits,
      typeof timeGrowthUnits === "number" ? timeGrowthUnits / 0.5 : 0,
      null,
      careGrowthUnits,
      timeGrowthUnits
    );
  }, [calcProp, careEvents, totalGrowthUnits, careGrowthUnits, timeGrowthUnits]);

  const progress: GardenMilestoneProgress = useMemo(() => {
    return resolveMvpFoundationProgress(
      careEvents && careEvents.length > 0 ? careEvents : totalGrowthUnits,
      careGrowthUnits,
      timeGrowthUnits
    );
  }, [careEvents, totalGrowthUnits, careGrowthUnits, timeGrowthUnits]);

  const levelHeading = `${calc.levelLabel} · ${calc.currentStage}`;
  const overallPercent = calc.overallDisplayPercent;
  const progressRatio = Math.max(0, Math.min(1, calc.totalFoundationProgress / 100));

  // Reduced motion listener
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setIsReducedMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      if (mounted) setIsReducedMotion(enabled);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  // Smooth progress bar fill animation (disabled under reduced motion)
  const animatedProgress = useRef(new Animated.Value(progressRatio)).current;

  useEffect(() => {
    if (isReducedMotion) {
      animatedProgress.setValue(progressRatio);
    } else {
      Animated.timing(animatedProgress, {
        toValue: progressRatio,
        duration: 350,
        useNativeDriver: false,
      }).start();
    }
  }, [progressRatio, isReducedMotion]);

  const animatedWidth = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
    extrapolate: "clamp",
  });

  // Restrained botanical color palette
  const trackBg = isLight ? "#DDE6DD" : isDim ? "#34423A" : "#29362F";
  const fillBg = isLight ? "#4F775B" : isDim ? "#8DB895" : "#9CC7A0";
  const fillHighlight = isLight ? "#C9DCC4" : "#D5E8D0";
  const pillBg = isLight ? "#EFF5EE" : isDim ? "#2D3932" : "#223029";
  const botanicalBorder = isLight ? "#D5E1D4" : isDim ? "#45564B" : "#35463B";
  const markerColor = isLight ? "rgba(255, 255, 255, 0.65)" : "rgba(255, 255, 255, 0.35)";
  const infoCardBg = isLight ? "#FAF7FC" : isDim ? "#251D2D" : "#1A1521";

  const nextDevMessage = calc.isFoundationComplete
    ? "Foundation Complete"
    : `Next: ${calc.nextMilestoneLabel}`;

  const accessibilityValueText = calc.isFoundationComplete
    ? `100 percent, ${levelHeading} reached. Foundation Complete.`
    : `${overallPercent} percent overall progress. ${levelHeading}. ${nextDevMessage}`;

  const accessibilityLabel = calc.isFoundationComplete
    ? `Garden growth progress: ${levelHeading} reached. Foundation complete. Your garden keeps collecting your shared moments.`
    : `Garden growth progress: ${levelHeading}. ${overallPercent} percent overall progress. ${nextDevMessage}.`;

  // --------------------------------------------------------------------------
  // COMPACT VARIANT (For Our Space GardenEntryCard)
  // --------------------------------------------------------------------------
  if (compact) {
    return (
      <View
        style={[styles.compactContainer, style]}
        accessible={true}
        accessibilityRole="progressbar"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{
          min: 0,
          max: 100,
          now: overallPercent,
          text: accessibilityValueText,
        }}
      >
        <View style={styles.compactRow}>
          <Text
            style={[styles.compactTitle, { color: theme.primaryText }]}
            numberOfLines={1}
          >
            {levelHeading}
          </Text>
          <Text
            style={[styles.compactPercent, { color: theme.secondaryText }]}
            accessibilityLabel={`${overallPercent} percent overall progress`}
          >
            {overallPercent}%
          </Text>
        </View>

        {/* Progress Bar Track with 24% and 60% threshold markers */}
        <View style={[styles.compactTrack, { backgroundColor: trackBg }]}>
          {/* Subtle visual threshold markers at 24% and 60% */}
          <View
            style={[styles.thresholdMarker, { left: "24%", backgroundColor: markerColor }]}
            pointerEvents="none"
          />
          <View
            style={[styles.thresholdMarker, { left: "60%", backgroundColor: markerColor }]}
            pointerEvents="none"
          />
          <Animated.View
            style={[
              styles.compactFill,
              {
                backgroundColor: fillBg,
                width: isReducedMotion
                  ? `${Math.round(progressRatio * 100)}%`
                  : (animatedWidth as any),
              },
            ]}
          >
            <View style={[styles.fillTip, { backgroundColor: fillHighlight }]} />
          </Animated.View>
        </View>

        <Text
          style={[styles.compactCaption, { color: theme.secondaryText }]}
          numberOfLines={1}
        >
          {nextDevMessage}
        </Text>
      </View>
    );
  }

  // --------------------------------------------------------------------------
  // STANDARD FULL VARIANT (For normal Garden view beneath artwork)
  // --------------------------------------------------------------------------
  return (
    <View
      style={[
        styles.standardContainer,
        {
          backgroundColor: theme.surface,
          borderColor: botanicalBorder,
        },
        style,
      ]}
      accessible={true}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{
        min: 0,
        max: 100,
        now: overallPercent,
        text: accessibilityValueText,
      }}
    >
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitles}>
          <Text
            style={[styles.milestoneHeading, { color: theme.primaryText }]}
            numberOfLines={1}
          >
            {levelHeading}
          </Text>
          <Text
            style={[styles.supportingCopy, { color: theme.secondaryText }]}
            numberOfLines={1}
          >
            {nextDevMessage}
          </Text>
        </View>

        <View
          style={[styles.percentBadge, { backgroundColor: pillBg, borderColor: botanicalBorder }]}
          accessible={false}
        >
          <Text style={[styles.percentText, { color: fillBg }]}>
            {overallPercent}%
          </Text>
        </View>
      </View>

      {/* Progress Bar Track with 24% and 60% threshold markers */}
      <View
        style={[styles.track, { backgroundColor: trackBg }]}
        accessible={false}
      >
        {/* Subtle visual threshold markers at 24% and 60% */}
        <View
          style={[styles.thresholdMarker, { left: "24%", backgroundColor: markerColor }]}
          pointerEvents="none"
        />
        <View
          style={[styles.thresholdMarker, { left: "60%", backgroundColor: markerColor }]}
          pointerEvents="none"
        />
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: fillBg,
              width: isReducedMotion
                ? `${Math.round(progressRatio * 100)}%`
                : (animatedWidth as any),
            },
          ]}
        >
          <View style={styles.fillSheen} pointerEvents="none" />
          <View style={[styles.fillTip, { backgroundColor: fillHighlight }]} />
        </Animated.View>
      </View>

      {/* Pressable disclosure row: "How your garden grows" */}
      <View style={[styles.explanationSection, { borderTopColor: theme.borderSoft }]}>
        <Pressable
          onPress={() => setIsExplanationOpen((prev) => !prev)}
          style={styles.explanationToggle}
          accessibilityRole="button"
          accessibilityLabel="How your garden grows"
          accessibilityHint={
            isExplanationOpen
              ? "Collapses the garden growth breakdown"
              : "Expands the live calculation and breakdown of shared care"
          }
          accessibilityState={{ expanded: isExplanationOpen }}
        >
          <Text style={[styles.explanationToggleText, { color: theme.primaryAccent }]}>
            {isExplanationOpen ? "Hide how your garden grows" : "How your garden grows"}
          </Text>
          <Text style={[styles.chevron, { color: theme.primaryAccent }]}>
            {isExplanationOpen ? "▲" : "▼"}
          </Text>
        </Pressable>

        {isExplanationOpen && (
          <View style={[styles.explanationCard, { backgroundColor: infoCardBg }]}>
            <Text style={[styles.explanationIntro, { color: theme.primaryText }]}>
              {progress.supportingCopy}
            </Text>

            {/* Dynamic Couple Growth Breakdown */}
            <View style={styles.breakdownCard}>
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: theme.secondaryText }]}>
                  Registered memories
                </Text>
                <Text style={[styles.breakdownValue, { color: theme.primaryText }]}>
                  {calc.totalRegisteredEvents}
                </Text>
              </View>

              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: theme.secondaryText }]}>
                  Unique eligible records
                </Text>
                <Text style={[styles.breakdownValue, { color: theme.primaryText }]}>
                  {calc.totalUniqueEvents}
                </Text>
              </View>

              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: theme.secondaryText }]}>
                  Current development
                </Text>
                <Text style={[styles.breakdownValue, { color: theme.primaryText }]}>
                  {calc.levelLabel} · {calc.currentStage}
                </Text>
              </View>

              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: theme.secondaryText }]}>
                  Shared moments ({calc.eligiblePositiveMoments} × 2)
                </Text>
                <Text style={[styles.breakdownValue, { color: theme.primaryText }]}>
                  +{calc.eligiblePositiveMoments * 2} growth
                </Text>
              </View>

              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: theme.secondaryText }]}>
                  Completed reconnections ({calc.completedReconnections} × 4)
                </Text>
                <Text style={[styles.breakdownValue, { color: theme.primaryText }]}>
                  +{calc.completedReconnections * 4} growth
                </Text>
              </View>

              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: theme.secondaryText }]}>
                  Important dates ({calc.importantDates} × 2)
                </Text>
                <Text style={[styles.breakdownValue, { color: theme.primaryText }]}>
                  +{calc.importantDates * 2} growth
                </Text>
              </View>

              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: theme.secondaryText }]}>
                  Supporting time ({calc.elapsedDays} elapsed days)
                </Text>
                <Text style={[styles.breakdownValue, { color: theme.primaryText }]}>
                  +{calc.supportingTimeContribution.toFixed(1)} / 20.0 max
                </Text>
              </View>

              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: theme.mutedText }]}>
                  Ineligible or non-growth records
                </Text>
                <Text style={[styles.breakdownValue, { color: theme.mutedText }]}>
                  {calc.excludedOrIneligibleEvents}
                </Text>
              </View>

              <View style={[styles.breakdownDivider, { backgroundColor: theme.borderSoft }]} />

              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabelBold, { color: theme.primaryText }]}>
                  Total foundation progress
                </Text>
                <Text style={[styles.breakdownValueBold, { color: fillBg }]}>
                  {calc.totalFoundationProgress.toFixed(1)} / 100 ({overallPercent}%)
                </Text>
              </View>

              {!calc.isFoundationComplete ? (
                <View style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabel, { color: theme.secondaryText }]}>
                    Progress to next development
                  </Text>
                  <Text style={[styles.breakdownValue, { color: theme.secondaryText }]}>
                    {calc.pointsUntilNextThreshold.toFixed(1)} units until {calc.nextMilestoneLabel}
                  </Text>
                </View>
              ) : (
                <View style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabelBold, { color: fillBg }]}>
                    Foundation Complete
                  </Text>
                  <Text style={[styles.breakdownValue, { color: theme.secondaryText }]}>
                    Shared care continues to flourish
                  </Text>
                </View>
              )}
            </View>

            <Text style={[styles.explanationOutro, { color: theme.mutedText }]}>
              At least 80 points come from meaningful shared care. There are no daily streaks, scores, or partner comparisons.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Compact styles
  compactContainer: {
    marginTop: 10,
    width: "100%",
  },
  compactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  compactTitle: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  compactPercent: {
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 8,
  },
  compactTrack: {
    height: 6,
    borderRadius: 6,
    overflow: "hidden",
    width: "100%",
  },
  compactFill: {
    height: "100%",
    borderRadius: 6,
    minWidth: 3,
    overflow: "hidden",
  },
  compactCaption: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.9,
  },
  compactDetail: {
    fontSize: 10,
    marginTop: 2,
  },

  // Standard full styles
  standardContainer: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 17,
    marginVertical: 12,
    shadowColor: "#172A1D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerTitles: {
    flex: 1,
    marginRight: 12,
  },
  milestoneHeading: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  supportingCopy: {
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  percentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  percentText: {
    fontSize: 13,
    fontWeight: "700",
  },
  track: {
    height: 7,
    borderRadius: 7,
    overflow: "hidden",
    width: "100%",
    marginVertical: 6,
  },
  fill: {
    height: "100%",
    borderRadius: 7,
    minWidth: 3,
    overflow: "hidden",
  },
  fillSheen: {
    position: "absolute",
    left: 2,
    right: 2,
    top: 1,
    height: 1,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  fillTip: {
    position: "absolute",
    right: 1,
    top: 1,
    width: 4,
    bottom: 1,
    borderRadius: 4,
    opacity: 0.72,
  },
  boundsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  boundText: {
    fontSize: 11,
  },
  completedNote: {
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4,
  },
  levelDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 7,
  },
  levelDetailText: {
    fontSize: 11,
  },
  unitBreakdown: {
    fontSize: 10,
    marginTop: 4,
  },
  explanationSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 14,
    paddingTop: 10,
  },
  explanationToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  explanationToggleText: {
    fontSize: 13,
    fontWeight: "600",
  },
  chevron: {
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 6,
  },
  explanationCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
  },
  explanationIntro: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  bulletItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginVertical: 3,
  },
  bulletDot: {
    fontSize: 14,
    marginRight: 6,
    lineHeight: 18,
  },
  bulletText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  thresholdMarker: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1.5,
    zIndex: 2,
  },
  breakdownCard: {
    marginVertical: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.03)",
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 3,
  },
  breakdownLabel: {
    fontSize: 12,
  },
  breakdownValue: {
    fontSize: 12,
    fontWeight: "600",
  },
  breakdownDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 6,
  },
  breakdownLabelBold: {
    fontSize: 13,
    fontWeight: "700",
  },
  breakdownValueBold: {
    fontSize: 13,
    fontWeight: "700",
  },
  explanationOutro: {
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 8,
    lineHeight: 16,
  },
});
