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
import { resolveMvpFoundationProgress, resolveMvpFoundationUnits, type GardenMilestoneProgress } from "@/lib/garden/stage-contracts";

export interface GardenProgressSectionProps {
  totalGrowthUnits: number;
  careEventsCount?: number;
  careGrowthUnits?: number;
  timeGrowthUnits?: number;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function GardenProgressSection({
  totalGrowthUnits,
  careEventsCount = 0,
  careGrowthUnits,
  timeGrowthUnits,
  compact = false,
  style,
}: GardenProgressSectionProps) {
  const { theme, effectiveTheme } = useTheme();
  const isLight = effectiveTheme === "light";
  const isDim = effectiveTheme === "dim";
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);

  // Derive pure milestone progress model
  const progress: GardenMilestoneProgress = useMemo(() => {
    return resolveMvpFoundationProgress(
      totalGrowthUnits,
      careEventsCount,
      careGrowthUnits,
      timeGrowthUnits
    );
  }, [totalGrowthUnits, careEventsCount, careGrowthUnits, timeGrowthUnits]);
  const foundationUnits = resolveMvpFoundationUnits(
    totalGrowthUnits,
    careGrowthUnits,
    timeGrowthUnits
  );
  const supportedTimeUnits = Math.min(12, Math.max(0, timeGrowthUnits ?? 0));
  const currentLevel = foundationUnits < 8 ? 1 : foundationUnits < 20 ? 2 : 3;
  const unitSummary = `${foundationUnits.toFixed(1)} / 36 foundation units`;

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
  const animatedProgress = useRef(new Animated.Value(progress.intervalProgress)).current;

  useEffect(() => {
    if (isReducedMotion) {
      animatedProgress.setValue(progress.intervalProgress);
    } else {
      Animated.timing(animatedProgress, {
        toValue: progress.intervalProgress,
        duration: 350,
        useNativeDriver: false,
      }).start();
    }
  }, [progress.intervalProgress, isReducedMotion]);

  const animatedWidth = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
    extrapolate: "clamp",
  });

  // Dynamic color palette based on theme
  // A restrained botanical palette keeps progress feeling like organic
  // development instead of a game score competing with the garden artwork.
  const trackBg = isLight ? "#DDE6DD" : isDim ? "#34423A" : "#29362F";
  const fillBg = isLight ? "#4F775B" : isDim ? "#8DB895" : "#9CC7A0";
  const fillHighlight = isLight ? "#C9DCC4" : "#D5E8D0";
  const pillBg = isLight ? "#EFF5EE" : isDim ? "#2D3932" : "#223029";
  const botanicalBorder = isLight ? "#D5E1D4" : isDim ? "#45564B" : "#35463B";
  const infoCardBg = isLight ? "#FAF7FC" : isDim ? "#251D2D" : "#1A1521";

  const accessibilityValueText = progress.isFinalStage
    ? `100 percent, ${progress.currentStageLabel} foundation reached`
    : `${progress.intervalDisplayPercent} percent progress toward ${progress.nextMilestoneLabel}`;

  const accessibilityLabel = progress.isFinalStage
    ? `Garden milestone progress: ${progress.currentStageLabel} reached. Your garden keeps collecting your shared moments.`
    : `Garden milestone progress: Current stage is ${progress.currentStageLabel}. Next growth: ${progress.nextMilestoneLabel}, ${progress.intervalDisplayPercent} percent toward next development.`;

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
          now: progress.intervalDisplayPercent,
          text: accessibilityValueText,
        }}
      >
        <View style={styles.compactRow}>
          <Text
            style={[styles.compactTitle, { color: theme.primaryText }]}
            numberOfLines={1}
          >
            {progress.isFinalStage
              ? progress.currentStageLabel
              : `Next growth: ${progress.nextMilestoneLabel}`}
          </Text>
          {!progress.isFinalStage && (
            <Text
              style={[styles.compactPercent, { color: theme.secondaryText }]}
              accessibilityLabel={`${progress.intervalDisplayPercent} percent toward next development`}
            >
              {progress.intervalDisplayPercent}%
            </Text>
          )}
        </View>

        {/* Progress Bar Track */}
        <View style={[styles.compactTrack, { backgroundColor: trackBg }]}>
          <Animated.View
            style={[
              styles.compactFill,
              {
                backgroundColor: fillBg,
                width: isReducedMotion
                  ? `${Math.round(progress.intervalProgress * 100)}%`
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
          {progress.supportingCopy}
        </Text>
        <Text style={[styles.compactDetail, { color: theme.mutedText }]} numberOfLines={1}>
          Level {currentLevel} of 3 · {unitSummary}
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
        now: progress.intervalDisplayPercent,
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
            {progress.isFinalStage
              ? progress.currentStageLabel
              : `Next growth: ${progress.nextMilestoneLabel}`}
          </Text>
          <Text
            style={[styles.supportingCopy, { color: theme.secondaryText }]}
          >
            {progress.supportingCopy}
          </Text>
        </View>

        {!progress.isFinalStage && (
          <View
            style={[styles.percentBadge, { backgroundColor: pillBg, borderColor: botanicalBorder }]}
            accessible={false}
          >
            <Text style={[styles.percentText, { color: fillBg }]}>
              {progress.intervalDisplayPercent}%
            </Text>
          </View>
        )}
      </View>

      {/* Progress Bar Track */}
      <View
        style={[styles.track, { backgroundColor: trackBg }]}
        accessible={false}
      >
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: fillBg,
              width: isReducedMotion
                ? `${Math.round(progress.intervalProgress * 100)}%`
                : (animatedWidth as any),
            },
          ]}
        >
          <View style={styles.fillSheen} pointerEvents="none" />
          <View style={[styles.fillTip, { backgroundColor: fillHighlight }]} />
        </Animated.View>
      </View>

      <View style={styles.levelDetailRow}>
        <Text style={[styles.levelDetailText, { color: theme.secondaryText }]}>
          Level {currentLevel} of 3 · {unitSummary}
        </Text>
        {!progress.isFinalStage && (
          <Text style={[styles.levelDetailText, { color: theme.secondaryText }]}>
            {progress.remainingUnits.toFixed(1)} units to next growth
          </Text>
        )}
      </View>
      {typeof careGrowthUnits === "number" && typeof timeGrowthUnits === "number" && (
        <Text style={[styles.unitBreakdown, { color: theme.mutedText }]}>
          Shared care {careGrowthUnits.toFixed(1)} · Time support {supportedTimeUnits.toFixed(1)} / 12
        </Text>
      )}

      {/* Interval Bounds Subtext */}
      {!progress.isFinalStage ? (
        <View style={styles.boundsRow} accessible={false}>
          <Text style={[styles.boundText, { color: theme.mutedText }]}>
            {progress.currentStageLabel}
          </Text>
          <Text style={[styles.boundText, { color: theme.mutedText }]}>
            {progress.nextMilestoneLabel}
          </Text>
        </View>
      ) : (
        <Text style={[styles.completedNote, { color: theme.secondaryText }]}>
          The three-step MVP foundation is complete. Every shared moment remains part of your garden.
        </Text>
      )}

      {/* Concise "How your garden grows" Educational Section */}
      <View style={[styles.explanationSection, { borderTopColor: theme.borderSoft }]}>
        <Pressable
          onPress={() => setIsExplanationOpen((prev) => !prev)}
          style={styles.explanationToggle}
          accessibilityRole="button"
          accessibilityLabel="How your garden grows"
          accessibilityHint={
            isExplanationOpen
              ? "Collapses the garden growth explanation"
              : "Expands an explanation of eligible activities and time contributions"
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
              Your garden develops gently through shared connection and steady time:
            </Text>

            <View style={styles.bulletItem}>
              <Text style={[styles.bulletDot, { color: theme.primaryAccent }]}>•</Text>
              <Text style={[styles.bulletText, { color: theme.secondaryText }]}>
                <Text style={{ fontWeight: "600", color: theme.primaryText }}>Shared moments: </Text>
                Appreciations, affection, and moments of gratitude add 2 units of growth.
              </Text>
            </View>

            <View style={styles.bulletItem}>
              <Text style={[styles.bulletDot, { color: theme.primaryAccent }]}>•</Text>
              <Text style={[styles.bulletText, { color: theme.secondaryText }]}>
                <Text style={{ fontWeight: "600", color: theme.primaryText }}>Reconnections: </Text>
                Working through friction and completing a reconnection adds 4 units of growth.
              </Text>
            </View>

            <View style={styles.bulletItem}>
              <Text style={[styles.bulletDot, { color: theme.primaryAccent }]}>•</Text>
              <Text style={[styles.bulletText, { color: theme.secondaryText }]}>
                <Text style={{ fontWeight: "600", color: theme.primaryText }}>Important dates: </Text>
                Anniversaries and saved dates add 2 units of growth.
              </Text>
            </View>

            <View style={styles.bulletItem}>
              <Text style={[styles.bulletDot, { color: theme.primaryAccent }]}>•</Text>
              <Text style={[styles.bulletText, { color: theme.secondaryText }]}>
                <Text style={{ fontWeight: "600", color: theme.primaryText }}>Care contribution: </Text>
                Shared activities contribute up to 40 units. Every eligible moment also becomes a stable, explorable part of your unique garden.
              </Text>
            </View>

            <View style={styles.bulletItem}>
              <Text style={[styles.bulletDot, { color: theme.primaryAccent }]}>•</Text>
              <Text style={[styles.bulletText, { color: theme.secondaryText }]}>
                <Text style={{ fontWeight: "600", color: theme.primaryText }}>Steady time: </Text>
                Time adds 0.5 units per elapsed day, but supports at most 12 of the 36 MVP foundation units. Time alone cannot complete the foundation.
              </Text>
            </View>

            <Text style={[styles.explanationOutro, { color: theme.mutedText }]}>
              The MVP foundation completes at 36 units. At least 24 must come from shared care; there are no daily obligations or partner comparisons.
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
  explanationOutro: {
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 8,
    lineHeight: 16,
  },
});
