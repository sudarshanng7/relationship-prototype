import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { tokens } from "@/components/couply-tokens";
import { CouplyStatusPill } from "@/components/CouplyUI";
import { useTheme } from "@/context/ThemeContext";
import { useGardenData } from "@/lib/use-garden-data";
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

  // If loading, show a calm minimal placeholder
  if (garden.loading) {
    return (
      <View
        style={[
          styles.container,
          styles.loadingContainer,
          { backgroundColor: theme.secondarySurface, borderColor: theme.borderSoft },
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
    seedString,
    stage,
    isResting,
  } = garden;

  let headingText = "A quiet place growing with the two of you.";
  let bodyText = stage.supportingCopy;

  if (isResting) {
    headingText = "Your garden is resting peacefully.";
    bodyText = "Everything you have grown remains here.";
  } else if (
    stage.key === "garden_in_bloom" ||
    stage.key === "rooted_flourishing"
  ) {
    headingText = "Something new is blooming in your garden.";
    bodyText = stage.supportingCopy;
  }

  const accessibilityLabel = `Your Shared Garden. Stage: ${stage.label}. ${headingText} Tap to enter your garden.`;

  return (
    <Pressable
      onPress={() => router.push("/garden" as any)}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: theme.secondarySurface,
          borderColor: pressed ? theme.primaryAccent : theme.borderSoft,
        },
        pressed && styles.containerPressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Opens the full interactive Shared Garden view"
    >
      {/* Miniature Landscape Garden artwork on top */}
      <View style={styles.artSection}>
        <GardenVisualizer
          compact={true}
          totalGrowthUnits={totalGrowthUnits}
          careGrowthUnits={careGrowthUnits}
          seedString={seedString}
          isResting={isResting}
        />
      </View>

      {/* Integrated Text & Action Column below */}
      <View style={styles.textSection}>
        <View style={styles.headerRow}>
          <Text style={[styles.overline, { color: theme.primaryAccent }]}>
            YOUR SHARED GARDEN
          </Text>
          <CouplyStatusPill
            label={stage.label}
            variant={isResting ? "neutral" : "positive"}
          />
        </View>

        <Text
          style={[styles.heading, { color: theme.primaryText }]}
          numberOfLines={3}
        >
          {headingText}
        </Text>

        <Text
          style={[styles.subtext, { color: theme.secondaryText }]}
          numberOfLines={2}
        >
          {bodyText}
        </Text>

        <View style={styles.actionRow}>
          <Text style={[styles.actionText, { color: theme.primaryAccent }]}>
            Enter your garden ›
          </Text>
        </View>
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
    width: "100%",
    height: 160,
  },
  textSection: {
    padding: 18,
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 2,
  },
  overline: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  heading: {
    fontSize: tokens.typeScale.sectionTitle,
    fontWeight: "700",
    lineHeight: 23,
  },
  subtext: {
    fontSize: tokens.typeScale.body,
    lineHeight: 19,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  actionText: {
    fontSize: tokens.typeScale.body,
    fontWeight: "700",
  },
});
