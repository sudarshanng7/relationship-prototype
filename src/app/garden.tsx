import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { tokens } from "@/components/couply-tokens";
import {
  CouplyEmptyState,
  CouplyHeader,
  CouplyPage,
  CouplyPrimaryButton,
  CouplySectionCard,
  CouplyStatusPill,
} from "@/components/CouplyUI";
import { useTheme } from "@/context/ThemeContext";
import { useUserIdentity } from "@/context/UserIdentityContext";
import { supabase } from "@/lib/supabase";
import { useGardenData } from "@/lib/use-garden-data";
import { GardenVisualizer } from "@/components/garden/GardenVisualizer";
import { getAmbienceLabel } from "@/lib/garden-generator";

export default function GardenScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const {
    coupleId: contextCoupleId,
    partnerName,
    isLoading: isIdentityLoading,
  } = useUserIdentity();

  const [resolvedCoupleId, setResolvedCoupleId] = useState<string | null>(
    contextCoupleId
  );
  const [isResolvingCouple, setIsResolvingCouple] = useState<boolean>(
    !contextCoupleId
  );
  const [spaceError, setSpaceError] = useState<string | null>(null);

  useEffect(() => {
    if (contextCoupleId) {
      setResolvedCoupleId(contextCoupleId);
      setIsResolvingCouple(false);
      return;
    }

    let isDisposed = false;

    async function resolveCouple() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          if (!isDisposed) {
            setSpaceError("Please sign in to view your shared garden.");
            setIsResolvingCouple(false);
          }
          return;
        }

        const { data: membership, error: membershipError } = await supabase
          .from("couple_members")
          .select("couple_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (membershipError || !membership) {
          if (!isDisposed) {
            setSpaceError("You do not belong to a relationship space yet.");
            setIsResolvingCouple(false);
          }
          return;
        }

        if (!isDisposed) {
          setResolvedCoupleId(membership.couple_id);
          setIsResolvingCouple(false);
        }
      } catch (err: any) {
        if (!isDisposed) {
          setSpaceError(err?.message || "Failed to locate relationship space.");
          setIsResolvingCouple(false);
        }
      }
    }

    void resolveCouple();

    return () => {
      isDisposed = true;
    };
  }, [contextCoupleId]);

  const garden = useGardenData(resolvedCoupleId);

  const handleBackToOurSpace = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace({ pathname: "/events", params: { scope: "ours" } });
    }
  };

  // 1. Initial Identity / Membership Loading State
  if (isIdentityLoading || isResolvingCouple || (garden.loading && !garden.error)) {
    return (
      <CouplyPage safe={true}>
        <CouplyHeader
          overline="OUR SPACE"
          title="Shared Garden"
          backLabel="‹ Our Space"
          onBack={handleBackToOurSpace}
        />
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="large" color={theme.primaryAccent} />
          <Text style={[styles.loadingNotice, { color: theme.secondaryText }]}>
            Preparing your shared garden…
          </Text>
        </View>
      </CouplyPage>
    );
  }

  // 2. Space Error or No Couple Membership State
  if (spaceError || (!resolvedCoupleId && !garden.loading)) {
    return (
      <CouplyPage safe={true}>
        <CouplyHeader
          overline="OUR SPACE"
          title="Shared Garden"
          backLabel="‹ Our Space"
          onBack={handleBackToOurSpace}
        />
        <CouplyEmptyState
          title="No shared space found"
          body={
            spaceError ||
            "The Shared Garden is a couple-owned space. Connect with your partner to begin growing your garden together."
          }
          action={
            <CouplyPrimaryButton
              label="Return to Our Space"
              onPress={handleBackToOurSpace}
              accessibilityLabel="Return to Our Space"
            />
          }
          style={styles.emptyStateCard}
        />
      </CouplyPage>
    );
  }

  // 3. Garden Data Fetch Error State
  if (garden.error) {
    return (
      <CouplyPage safe={true}>
        <CouplyHeader
          overline="OUR SPACE"
          title="Shared Garden"
          backLabel="‹ Our Space"
          onBack={handleBackToOurSpace}
        />
        <CouplyEmptyState
          title="Your garden could not be prepared just now."
          body="Nothing has been changed. You can return to Our Space and try again later."
          action={
            <CouplyPrimaryButton
              label="Return to Our Space"
              onPress={handleBackToOurSpace}
              accessibilityLabel="Return to Our Space"
            />
          }
          style={styles.emptyStateCard}
        />
      </CouplyPage>
    );
  }

  const {
    totalGrowthUnits,
    careGrowthUnits,
    timeGrowthUnits,
    seedString,
    stage,
    isResting,
    latestEvent,
  } = garden;

  const ambienceLabel = getAmbienceLabel(stage.key, isResting);

  return (
    <CouplyPage safe={true} contentStyle={styles.pageContent}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainColumn}>
          {/* Header */}
          <CouplyHeader
            overline="OUR SPACE"
            title="Shared Garden"
            subtitle={
              partnerName
                ? `A living reflection of time and care with ${partnerName}.`
                : "A living reflection of the time and care you have built together."
            }
            backLabel="‹ Our Space"
            onBack={handleBackToOurSpace}
          />

          {/* SECTION 1 — Immersive Garden Hero with Integrated Overlay */}
          <View style={styles.heroSection}>
            <GardenVisualizer
              totalGrowthUnits={totalGrowthUnits}
              careGrowthUnits={careGrowthUnits}
              timeGrowthUnits={timeGrowthUnits}
              seedString={seedString}
              isResting={isResting}
            >
              {/* Integrated Scene Overlay: Stage, Single Ambience, Short Reflection */}
              <View style={styles.heroOverlayBadgeContainer}>
                <View
                  style={[
                    styles.heroOverlayPillBox,
                    {
                      backgroundColor: isResting
                        ? "rgba(45, 31, 51, 0.72)"
                        : "rgba(255, 255, 255, 0.88)",
                      borderColor: isResting
                        ? "rgba(255, 255, 255, 0.15)"
                        : "rgba(0, 0, 0, 0.08)",
                    },
                  ]}
                >
                  <View style={styles.heroBadgeTopRow}>
                    <Text
                      style={[
                        styles.heroStageTitle,
                        {
                          color: isResting ? "#FFFFFF" : theme.primaryText,
                        },
                      ]}
                    >
                      {stage.label}
                    </Text>
                    <CouplyStatusPill
                      label={ambienceLabel}
                      variant={isResting ? "neutral" : "positive"}
                    />
                  </View>
                  <Text
                    style={[
                      styles.heroStageSubtitle,
                      {
                        color: isResting
                          ? "rgba(255, 255, 255, 0.85)"
                          : theme.secondaryText,
                      },
                    ]}
                  >
                    {stage.supportingCopy}
                  </Text>
                </View>
              </View>
            </GardenVisualizer>
          </View>

          {/* SECTION 2 — Recent Growth Reflection (Only when eligible event exists) */}
          {latestEvent && (
            <CouplySectionCard style={styles.reflectionCard}>
              <Text
                style={[
                  styles.reflectionHeading,
                  { color: theme.primaryText },
                ]}
              >
                Something new in your garden
              </Text>
              <Text
                style={[
                  styles.reflectionSubtext,
                  { color: theme.secondaryText },
                ]}
              >
                {latestEvent.subtext}
              </Text>
              <Text
                style={[
                  styles.reflectionReassurance,
                  { color: theme.mutedText },
                ]}
              >
                Nourishing your shared tree together.
              </Text>
            </CouplySectionCard>
          )}

          {/* SECTION 3 — About Your Garden (Grouped principles without scorecards/counts) */}
          <CouplySectionCard variant="muted" style={styles.aboutCard}>
            <Text
              style={[styles.aboutHeading, { color: theme.primaryText }]}
            >
              About your garden
            </Text>

            <View style={styles.aboutList}>
              <View style={styles.aboutRow}>
                <View
                  style={[
                    styles.bulletDot,
                    { backgroundColor: theme.primaryAccent },
                  ]}
                />
                <Text
                  style={[styles.aboutRowText, { color: theme.secondaryText }]}
                >
                  Time gives the garden steady roots.
                </Text>
              </View>

              <View style={styles.aboutRow}>
                <View
                  style={[
                    styles.bulletDot,
                    { backgroundColor: theme.status.celebration.text },
                  ]}
                />
                <Text
                  style={[styles.aboutRowText, { color: theme.secondaryText }]}
                >
                  Shared good moments bring new leaves.
                </Text>
              </View>

              <View style={styles.aboutRow}>
                <View
                  style={[
                    styles.bulletDot,
                    { backgroundColor: theme.status.reconnected.text },
                  ]}
                />
                <Text
                  style={[styles.aboutRowText, { color: theme.secondaryText }]}
                >
                  Reconnection may open blossoms.
                </Text>
              </View>

              <View style={styles.aboutRow}>
                <View
                  style={[
                    styles.bulletDot,
                    { backgroundColor: theme.primaryAccent },
                  ]}
                />
                <Text
                  style={[styles.aboutRowText, { color: theme.secondaryText }]}
                >
                  Meaningful dates add lasting details.
                </Text>
              </View>

              <View style={styles.aboutRow}>
                <View
                  style={[
                    styles.bulletDot,
                    { backgroundColor: theme.secondaryText },
                  ]}
                />
                <Text
                  style={[styles.aboutRowText, { color: theme.secondaryText }]}
                >
                  There is no streak to maintain.
                </Text>
              </View>

              <View style={styles.aboutRow}>
                <View
                  style={[
                    styles.bulletDot,
                    { backgroundColor: theme.secondaryText },
                  ]}
                />
                <Text
                  style={[styles.aboutRowText, { color: theme.secondaryText }]}
                >
                  The garden never loses what it has grown.
                </Text>
              </View>

              <View style={styles.aboutRow}>
                <View
                  style={[
                    styles.bulletDot,
                    { backgroundColor: theme.secondaryText },
                  ]}
                />
                <Text
                  style={[styles.aboutRowText, { color: theme.secondaryText }]}
                >
                  Private reflections and everyday chores never affect it.
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.privacyDivider,
                { backgroundColor: theme.borderSoft },
              ]}
            />

            <Text
              style={[styles.privacyNote, { color: theme.mutedText }]}
            >
              A private sanctuary for two. Identical on both screens.
            </Text>
          </CouplySectionCard>

          {/* PART D — Unobtrusive Prototype Notice in Development Only */}
          {__DEV__ && (
            <Text
              style={[styles.devNotice, { color: theme.mutedText }]}
            >
              DEV PREVIEW · Visual state is not yet persisted
            </Text>
          )}
        </View>
      </ScrollView>
    </CouplyPage>
  );
}

const styles = StyleSheet.create({
  pageContent: {
    paddingHorizontal: 0,
  },
  scrollContainer: {
    paddingHorizontal: tokens.layout.pagePaddingStandard,
    paddingBottom: 48,
    alignItems: "center",
  },
  mainColumn: {
    width: "100%",
    maxWidth: tokens.layout.appShell,
    gap: 20,
  },
  loadingWrapper: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 16,
  },
  loadingNotice: {
    fontSize: tokens.typeScale.bodyLarge,
  },
  emptyStateCard: {
    marginTop: 24,
  },
  heroSection: {
    width: "100%",
    alignItems: "center",
  },
  heroOverlayBadgeContainer: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    maxWidth: 440,
  },
  heroOverlayPillBox: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  heroBadgeTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  heroStageTitle: {
    fontSize: tokens.typeScale.sectionTitle,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  heroStageSubtitle: {
    fontSize: tokens.typeScale.body,
    lineHeight: 18,
  },
  reflectionCard: {
    padding: 18,
    gap: 6,
    borderRadius: 20,
  },
  reflectionHeading: {
    fontSize: tokens.typeScale.sectionTitle,
    fontWeight: "600",
  },
  reflectionSubtext: {
    fontSize: tokens.typeScale.bodyLarge,
    lineHeight: 22,
  },
  reflectionReassurance: {
    fontSize: tokens.typeScale.caption,
    fontStyle: "italic",
    marginTop: 4,
  },
  aboutCard: {
    padding: 20,
    gap: 14,
    borderRadius: 20,
  },
  aboutHeading: {
    fontSize: tokens.typeScale.sectionTitle,
    fontWeight: "600",
  },
  aboutList: {
    gap: 10,
  },
  aboutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  aboutRowText: {
    fontSize: tokens.typeScale.body,
    lineHeight: 20,
    flex: 1,
  },
  privacyDivider: {
    height: 1,
    width: "100%",
    marginVertical: 2,
  },
  privacyNote: {
    fontSize: tokens.typeScale.caption,
    fontStyle: "italic",
    textAlign: "center",
  },
  devNotice: {
    fontSize: tokens.typeScale.overline,
    textAlign: "center",
    letterSpacing: 0.6,
    marginTop: 12,
  },
});
