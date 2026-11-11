import React, { useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { tokens } from "@/components/couply-tokens";
import { useTheme } from "@/context/ThemeContext";
import { useGardenData } from "@/lib/use-garden-data";
import { getAmbienceLabel } from "@/lib/garden-generator";
import { GardenVisualizer } from "@/components/garden/GardenVisualizer";

export interface GardenEntryCardProps {
  coupleId: string;
  style?: StyleProp<ViewStyle>;
  bentoDesktop?: boolean;
}

export function GardenEntryCard({
  coupleId,
  style,
}: GardenEntryCardProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const garden = useGardenData(coupleId);

  useFocusEffect(
    useCallback(() => {
      void garden.refetch(true);
    }, [garden.refetch])
  );

  // Explicit opaque background colors per theme mode
  const footerBg =
    theme.key === "light"
      ? "#F4EEF7"
      : theme.key === "dim"
      ? "#514958"
      : "#302536";

  // If loading, show a calm minimal placeholder
  if (garden.loading) {
    return (
      <View
        style={[
          styles.container,
          styles.loadingContainer,
          {
            backgroundColor: footerBg,
            borderColor: theme.borderSoft,
          },
          style,
        ]}
      >
        <ActivityIndicator size="small" color={theme.primaryAccent} />
        <Text style={[styles.loadingText, { color: theme.secondaryText }]}>
          Loading your shared garden…
        </Text>
      </View>
    );
  }

  // If there's an error, don't break Our Space
  if (garden.error) {
    return null;
  }

  const {
    totalGrowthUnits,
    careGrowthUnits,
    timeGrowthUnits,
    seedString,
    stage,
    isResting,
    careSignals,
    careEvents,
  } = garden;

  const ambienceLabel = getAmbienceLabel(stage.key, isResting);

  // Clear, truth-aligned editorial lines
  const primaryLine = stage.supportingCopy;
  const secondaryLine = isResting
    ? "Your garden is resting peacefully. Everything you have grown remains here."
    : careGrowthUnits > 0
    ? "The care you share is taking shape here."
    : "Your roots are deepening quietly with time.";

  const accessibilityLabel = `Your Shared Garden. Stage: ${stage.label}. ${primaryLine} ${secondaryLine} Tap to enter your garden.`;

  // Contrast-safe botanical pill colors aligned with Purple Garden identity
  const isLight = theme.key === "light";
  const isDim = theme.key === "dim";

  const pillBg = isResting
    ? isLight
      ? "#ECE5F0"
      : isDim
      ? "#3F3746"
      : "#2B2132"
    : isLight
    ? "#E8F0EA"
    : isDim
    ? "#324438"
    : "#223528";

  const pillBorder = isResting
    ? isLight
      ? "#DACFE0"
      : isDim
      ? "#584E61"
      : "#45364E"
    : isLight
    ? "#CFDFD2"
    : isDim
    ? "#4A6352"
    : "#35503D";

  const pillText = isResting
    ? isLight
      ? "#5C4A63"
      : isDim
      ? "#D9CCE0"
      : "#D6C7DC"
    : isLight
    ? "#244E2F"
    : isDim
    ? "#C7E5CF"
    : "#BFE2CA";

  return (
    <Pressable
      onPress={() => router.push("/garden" as any)}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: footerBg,
          borderColor: pressed ? theme.primaryAccent : theme.borderSoft,
        },
        pressed && styles.containerPressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Opens the full interactive Shared Garden view"
    >
      {/* 1. Botanical artwork region (top portion, 160px, full width) */}
      <View style={styles.artSection}>
        <GardenVisualizer
          compact={true}
          totalGrowthUnits={totalGrowthUnits}
          careGrowthUnits={careGrowthUnits}
          timeGrowthUnits={timeGrowthUnits}
          seedString={seedString}
          isResting={isResting}
          careSignals={careSignals}
          careEvents={careEvents}
        />
      </View>

      {/* 2. Information footer (rendered directly below artwork as sibling) */}
      <View
        style={[
          styles.infoFooter,
          {
            backgroundColor: footerBg,
            borderTopColor: theme.borderSoft,
          },
        ]}
      >
        {/* Top row: Stage label + Quiet status pill */}
        <View style={styles.footerTopRow}>
          <Text
            style={[styles.stageLabel, { color: theme.primaryText }]}
            numberOfLines={1}
          >
            {stage.label}
          </Text>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: pillBg, borderColor: pillBorder },
            ]}
          >
            <Text style={[styles.statusPillText, { color: pillText }]}>
              {ambienceLabel}
            </Text>
          </View>
        </View>

        {/* Primary line: Current stage developmental description */}
        <Text
          style={[styles.primaryLine, { color: theme.primaryText }]}
          numberOfLines={2}
        >
          {primaryLine}
        </Text>

        {/* Secondary line: Quiet truth-aligned care-reflection line */}
        <Text
          style={[styles.secondaryLine, { color: theme.secondaryText }]}
          numberOfLines={2}
        >
          {secondaryLine}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#2D1F33",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    flexDirection: "column",
  },
  containerPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.995 }],
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 36,
  },
  loadingText: {
    fontSize: tokens.typeScale.body,
  },
  artSection: {
    height: 160,
    flexShrink: 0,
    position: "relative",
    overflow: "hidden",
    width: "100%",
  },
  infoFooter: {
    position: "relative",
    zIndex: 2,
    width: "100%",
    opacity: 1,
    borderTopWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 5,
  },
  footerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 2,
  },
  stageLabel: {
    fontSize: tokens.typeScale.body,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  primaryLine: {
    fontSize: tokens.typeScale.body,
    fontWeight: "500",
    lineHeight: 20,
  },
  secondaryLine: {
    fontSize: tokens.typeScale.caption,
    fontWeight: "400",
    lineHeight: 18,
  },
});
