import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { tokens } from "@/components/couply-tokens";
import {
  CouplyEmptyState,
  CouplyHeader,
  CouplyPage,
  CouplyPrimaryButton,
  CouplySectionCard,
} from "@/components/CouplyUI";
import { useTheme } from "@/context/ThemeContext";
import { useUserIdentity } from "@/context/UserIdentityContext";
import { supabase } from "@/lib/supabase";
import { useGardenData } from "@/lib/use-garden-data";
import { GardenVisualizer } from "@/components/garden/GardenVisualizer";
import { getAmbienceLabel } from "@/lib/garden-generator";
import {
  createGardenStory,
  type GardenStory,
  type GardenStorySnapshot,
} from "@/lib/garden-story";
import { GardenStoryPlayer } from "@/components/garden/GardenStoryPlayer";

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

  useFocusEffect(
    useCallback(() => {
      void garden.refetch(true);
    }, [garden.refetch])
  );

  const handleBackToOurSpace = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace({ pathname: "/events", params: { scope: "ours" } });
    }
  };

  // Garden Story Playback State
  const [isPlayingStory, setIsPlayingStory] = useState(false);
  const [story, setStory] = useState<GardenStory | null>(null);

  // If couple membership changes, reset any active story playback
  useEffect(() => {
    setIsPlayingStory(false);
    setStory(null);
  }, [resolvedCoupleId]);

  const handleStartStory = useCallback(() => {
    if (!resolvedCoupleId) return;
    const snapshot: GardenStorySnapshot = {
      coupleId: resolvedCoupleId,
      seedString: garden.seedString,
      createdAt: garden.createdAt,
      careEvents: garden.careEvents,
      asOfTime: new Date().toISOString(),
      isResting: garden.isResting,
      themeKey: theme.key,
    };
    const newStory = createGardenStory(snapshot);
    setStory(newStory);
    setIsPlayingStory(true);
  }, [
    resolvedCoupleId,
    garden.seedString,
    garden.createdAt,
    garden.careEvents,
    garden.isResting,
    theme.key,
  ]);

  const handleCloseStory = useCallback(() => {
    setIsPlayingStory(false);
    setStory(null);
  }, []);

  const handlePlayAgain = useCallback(() => {
    if (!resolvedCoupleId) return;
    const snapshot: GardenStorySnapshot = {
      coupleId: resolvedCoupleId,
      seedString: garden.seedString,
      createdAt: garden.createdAt,
      careEvents: garden.careEvents,
      asOfTime: new Date().toISOString(),
      isResting: garden.isResting,
      themeKey: theme.key,
    };
    const newStory = createGardenStory(snapshot);
    setStory(newStory);
  }, [
    resolvedCoupleId,
    garden.seedString,
    garden.createdAt,
    garden.careEvents,
    garden.isResting,
    theme.key,
  ]);

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
    careSignals,
    careEvents,
    newGrowthNotice,
    latestEvent,
  } = garden;

  const ambienceLabel = getAmbienceLabel(stage.key, isResting);

  // Contrast-safe botanical pill colors aligned with Purple Garden identity
  const isLight = theme.key === "light";
  const isDim = theme.key === "dim";

  const summaryBg = isLight ? "#F4EEF7" : isDim ? "#514958" : "#302536";

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

  const dynamicGrowthNote = isResting
    ? "Your garden is resting peacefully. Everything you have grown remains here."
    : careGrowthUnits > 0
    ? "The care you share is taking shape here."
    : "Your roots are deepening quietly with time.";

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

          {/* Temporary Calm Growth Acknowledgement (PART 8) */}
          {newGrowthNotice && (
            <View
              style={[
                styles.noticeBanner,
                {
                  backgroundColor: pillBg,
                  borderColor: pillBorder,
                },
              ]}
              accessibilityLiveRegion="polite"
            >
              <Text style={[styles.noticeText, { color: pillText }]}>
                {newGrowthNotice}
              </Text>
            </View>
          )}

          {/* Discreet Play Story Toolbar immediately above artwork */}
          {!isPlayingStory && (
            <View style={styles.gardenToolbar}>
              <Pressable
                style={({ pressed }) => [
                  styles.playStoryButton,
                  {
                    backgroundColor: isLight
                      ? "#FFFFFF"
                      : isDim
                      ? "#3C3444"
                      : "#241B2B",
                    borderColor: theme.borderSoft,
                  },
                  pressed && styles.playStoryButtonPressed,
                ]}
                onPress={handleStartStory}
                focusable={true}
                accessibilityRole="button"
                accessibilityLabel="Play our garden story"
                accessibilityHint="Watch how your garden has grown from shared moments"
              >
                <Text
                  style={[
                    styles.playStoryIcon,
                    { color: theme.primaryAccent },
                  ]}
                >
                  ▶
                </Text>
                <Text
                  style={[
                    styles.playStoryLabel,
                    { color: theme.primaryText },
                  ]}
                >
                  Our garden story
                </Text>
              </Pressable>
            </View>
          )}

          {/* SECTION 1 — Immersive Garden Hero / Garden Story Playback */}
          {isPlayingStory && story ? (
            <GardenStoryPlayer
              key={`${story.seedString}-${story.asOfTime}`}
              story={story}
              theme={theme}
              isLight={isLight}
              isDim={isDim}
              coupleId={resolvedCoupleId}
              liveCareEvents={careEvents}
              isLiveLoading={garden.loading}
              liveError={garden.error}
              onClose={handleCloseStory}
              onPlayAgain={handlePlayAgain}
            />
          ) : (
            <View
              style={[
                styles.gardenHero,
                {
                  backgroundColor: summaryBg,
                  borderColor: theme.borderSoft,
                },
              ]}
            >
              <GardenVisualizer
                totalGrowthUnits={totalGrowthUnits}
                careGrowthUnits={careGrowthUnits}
                timeGrowthUnits={timeGrowthUnits}
                seedString={seedString}
                isResting={isResting}
                careSignals={careSignals}
                careEvents={careEvents}
                style={styles.heroVisualizer}
              />
              <View
                style={[
                  styles.gardenSummary,
                  {
                    backgroundColor: summaryBg,
                    borderTopColor: theme.borderSoft,
                  },
                ]}
              >
                <View style={styles.summaryTopRow}>
                  <Text
                    style={[
                      styles.summaryStageTitle,
                      { color: theme.primaryText },
                    ]}
                    numberOfLines={1}
                  >
                    {stage.label}
                  </Text>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: pillBg,
                        borderColor: pillBorder,
                      },
                    ]}
                  >
                    <Text style={[styles.statusPillText, { color: pillText }]}>
                      {ambienceLabel}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.summarySupportingCopy,
                    { color: theme.primaryText },
                  ]}
                >
                  {stage.supportingCopy}
                </Text>
                <Text
                  style={[
                    styles.summaryCareReflection,
                    { color: theme.secondaryText },
                  ]}
                >
                  {dynamicGrowthNote}
                </Text>
              </View>
            </View>
          )}

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
                  Shared good moments bring fresh growth, buds, and quiet abundance.
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
  noticeBanner: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: "center",
  },
  noticeText: {
    fontSize: tokens.typeScale.body,
    fontWeight: "600",
    textAlign: "center",
  },
  gardenHero: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#2D1F33",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  heroVisualizer: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  gardenToolbar: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: -4,
  },
  playStoryButton: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  playStoryButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  playStoryIcon: {
    fontSize: 12,
    fontWeight: "700",
  },
  playStoryLabel: {
    fontSize: tokens.typeScale.caption,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  gardenSummary: {
    position: "relative",
    zIndex: 2,
    width: "100%",
    opacity: 1,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 6,
  },
  summaryTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 2,
  },
  summaryStageTitle: {
    fontSize: tokens.typeScale.sectionTitle,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  summarySupportingCopy: {
    fontSize: tokens.typeScale.body,
    fontWeight: "500",
    lineHeight: 20,
  },
  summaryCareReflection: {
    fontSize: tokens.typeScale.caption,
    fontWeight: "400",
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
