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
import { resolveGardenMilestoneProgress, type GardenMilestoneProgress } from "@/lib/garden/stage-contracts";

export interface GardenProgressSectionProps {
  totalGrowthUnits: number;
  careEventsCount?: number;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function GardenProgressSection({
  totalGrowthUnits,
  careEventsCount = 0,
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
    return resolveGardenMilestoneProgress(totalGrowthUnits, careEventsCount);
  }, [totalGrowthUnits, careEventsCount]);

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
  const trackBg = isLight ? "#E5E1E8" : isDim ? "#372F3F" : "#2A2132";
  const fillBg = isLight ? "#7C3AED" : isDim ? "#9D68F7" : "#A78BFA";
  const pillBg = isLight ? "#F3EFF8" : isDim ? "#322A3A" : "#231B2A";
  const infoCardBg = isLight ? "#FAF7FC" : isDim ? "#251D2D" : "#1A1521";

  const accessibilityValueText = progress.isFinalStage
    ? "100 percent, final growth milestone reached"
    : `${progress.intervalDisplayPercent} percent progress toward ${progress.nextMilestoneLabel}`;

  const accessibilityLabel = progress.isFinalStage
    ? "Garden milestone progress: Garden in Bloom reached. Your garden keeps collecting your shared moments."
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
              ? "Garden in full bloom"
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
          />
        </View>

        <Text
          style={[styles.compactCaption, { color: theme.secondaryText }]}
          numberOfLines={1}
        >
          {progress.supportingCopy}
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
          borderColor: theme.borderSoft,
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
              ? "Garden in full bloom"
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
            style={[styles.percentBadge, { backgroundColor: pillBg, borderColor: theme.borderSoft }]}
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
        />
      </View>

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
          All milestone developments unlocked. Every shared moment continues to bloom.
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
                Shared activities contribute up to 40 units of garden development. Beyond 40 units, all new moments continue to appear as permanent flowers, foliage, and memories in your tree.
              </Text>
            </View>

            <View style={styles.bulletItem}>
              <Text style={[styles.bulletDot, { color: theme.primaryAccent }]}>•</Text>
              <Text style={[styles.bulletText, { color: theme.secondaryText }]}>
                <Text style={{ fontWeight: "600", color: theme.primaryText }}>Steady time: </Text>
                Time together gently nurtures your tree, adding 0.5 units per elapsed day (up to 60 units).
              </Text>
            </View>

            <Text style={[styles.explanationOutro, { color: theme.mutedText }]}>
              Together, care and shared time nurture the garden toward its 100-unit full bloom. There are no daily obligations or partner comparisons.
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
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
    width: "100%",
  },
  compactFill: {
    height: "100%",
    borderRadius: 3,
  },
  compactCaption: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.9,
  },

  // Standard full styles
  standardContainer: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginVertical: 12,
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
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    width: "100%",
    marginVertical: 6,
  },
  fill: {
    height: "100%",
    borderRadius: 4,
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
