import { AppBottomNav } from "@/components/AppBottomNav";
import { supabase } from "@/lib/supabase";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type RelationshipEvent = {
  id: string;
  creator_id: string;
  event_type: "positive" | "friction";
  category: string;
  intensity: number | null;
  visibility: "mine" | "ours";
  status: "open" | "partially_repaired" | "reconnected" | null;
  created_at: string;
};

type FilterOption = "all" | "mine" | "ours";

type OursFilter = "open" | "softening" | "reconnected";

export default function EventsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ scope?: string }>();
  const isMineMode = params.scope === "mine";
  const isOursMode = params.scope === "ours";

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [coupleId, setCoupleId] = useState<string | null>(null);

  const [events, setEvents] = useState<RelationshipEvent[]>([]);
  const [status, setStatus] = useState("Loading...");
  const [filter, setFilter] = useState<FilterOption>("all");
  const [oursFilter, setOursFilter] = useState<OursFilter | null>(null);
  const [hasFinishedInitialLoad, setHasFinishedInitialLoad] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadPage();
    }, []),
  );

  useEffect(() => {
    if (!coupleId) {
      return;
    }

    const channelName = `relationship-events-${coupleId}`;
    let isDisposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const startRealtime = async () => {
      const existingChannel = supabase
        .getChannels()
        .find((candidate) => candidate.topic === `realtime:${channelName}`);

      if (existingChannel) {
        await supabase.removeChannel(existingChannel);
      }

      if (isDisposed) {
        return;
      }

      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "relationship_events",
            filter: `couple_id=eq.${coupleId}`,
          },
          () => {
            loadEvents(coupleId);
          },
        )
        .subscribe();
    };

    void startRealtime();

    return () => {
      isDisposed = true;

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [coupleId]);

  async function loadPage() {
    setStatus("Loading...");
    setHasFinishedInitialLoad(false);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setStatus("No signed-in user");
      return;
    }

    setCurrentUserId(user.id);

    const { data: membership, error: membershipError } = await supabase
      .from("couple_members")
      .select("couple_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      console.error(membershipError);
      setStatus(membershipError.message);
      return;
    }

    if (!membership) {
      setStatus("You do not belong to a relationship space.");
      return;
    }

    setCoupleId(membership.couple_id);

    const didLoadEvents = await loadEvents(membership.couple_id);
    if (didLoadEvents) {
      setHasFinishedInitialLoad(true);
    }
  }

  async function loadEvents(currentCoupleId: string) {
    const { data, error } = await supabase
      .from("relationship_events")
      .select(
        `
        id,
        creator_id,
        event_type,
        category,
        intensity,
        visibility,
        status,
        created_at
      `,
      )
      .eq("couple_id", currentCoupleId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setStatus(error.message);
      return false;
    }

    setEvents(data ?? []);
    setStatus("");
    return true;
  }

  async function createTestEvent(visibility: "mine" | "ours") {
    if (!coupleId) {
      setStatus("No relationship space found.");
      return;
    }

    setStatus(`Creating ${visibility} test event...`);

    const { error } = await supabase.from("relationship_events").insert({
      couple_id: coupleId,
      event_type: "friction",
      category: "communication",
      intensity: 3,
      visibility,
      status: "open",
    });

    if (error) {
      console.error(error);
      setStatus(error.message);
      return;
    }

    await loadEvents(coupleId);

    setStatus(`${capitalize(visibility)} test event created`);
  }

  function openEvent(eventId: string) {
    const currentScope = isMineMode
      ? "mine"
      : isOursMode
      ? "ours"
      : "moments";

    router.push({
      pathname: "/event/[id]",
      params: {
        id: eventId,
        scope: currentScope,
      },
    });
  }

  const visibleEvents = events.filter((event) => {
    if (isMineMode) {
      return (
        event.visibility === "mine" &&
        event.creator_id === currentUserId
      );
    }
    if (isOursMode) {
      if (event.visibility !== "ours") {
        return false;
      }
      if (oursFilter === "open") {
        return event.event_type === "friction" && event.status === "open";
      }
      if (oursFilter === "softening") {
        return (
          event.event_type === "friction" &&
          event.status === "partially_repaired"
        );
      }
      if (oursFilter === "reconnected") {
        return (
          event.event_type === "friction" && event.status === "reconnected"
        );
      }
      return true;
    }
    if (filter === "mine") {
      return event.visibility === "mine";
    }
    if (filter === "ours") {
      return event.visibility === "ours";
    }
    return true;
  });

  const isLoading = status === "Loading...";
  const hasSpaceError = status === "You do not belong to a relationship space.";
  const hasGenericError =
    status !== "" &&
    !isLoading &&
    !hasSpaceError &&
    !status.includes("test event");

  const shouldShowLoading =
    isLoading ||
    ((isMineMode || isOursMode) &&
      !hasFinishedInitialLoad &&
      !hasSpaceError &&
      !hasGenericError);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainColumn}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>
                {isMineMode ? "Mine" : isOursMode ? "Our Space" : "Moments"}
              </Text>
              <Text style={styles.subtitle}>
                {isMineMode
                  ? "A private place to understand what you feel."
                  : isOursMode
                  ? "Moments shared between you and Sam."
                  : "“A place to return to what mattered.”"}
              </Text>
            </View>

            <Pressable
              onPress={() =>
                router.push(
                  isMineMode
                    ? "/record-moment?visibility=mine"
                    : isOursMode
                    ? "/record-moment?visibility=ours"
                    : "/record-moment"
                )
              }
              style={({ pressed }) => [
                styles.recordHeaderButton,
                pressed && styles.pressedState,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                isMineMode
                  ? "+ Write a reflection"
                  : isOursMode
                  ? "+ Share a moment"
                  : "Record a moment"
              }
            >
              <Text style={styles.recordHeaderButtonText}>
                {isMineMode
                  ? "+ Write a reflection"
                  : isOursMode
                  ? "+ Share a moment"
                  : "+ Record a moment"}
              </Text>
            </Pressable>
          </View>

          {/* Mine / Ours mode quiet action vs normal segmented filter */}
          {isMineMode || isOursMode ? (
            <View style={styles.mineNavRow}>
              <Pressable
                onPress={() => router.push("/events")}
                style={({ pressed }) => [
                  styles.viewAllButton,
                  pressed && styles.pressedState,
                ]}
                accessibilityRole="button"
                accessibilityLabel="View all moments"
              >
                <Text style={styles.viewAllButtonText}>View all moments</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.segmentedFilterContainer} role="tablist">
              {(["all", "mine", "ours"] as const).map((seg) => {
                const isSelected = filter === seg;
                const label =
                  seg === "all" ? "All" : seg === "mine" ? "Mine" : "Ours";

                return (
                  <Pressable
                    key={seg}
                    onPress={() => setFilter(seg)}
                    style={[
                      styles.segmentButton,
                      isSelected && styles.segmentButtonActive,
                    ]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Show ${label} moments`}
                  >
                    <Text
                      style={[
                        styles.segmentButtonText,
                        isSelected && styles.segmentButtonTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Ours status filter chips */}
          {isOursMode && (
            <View style={styles.oursFilterSection}>
              <View style={styles.oursFilterRow} role="tablist">
                {(
                  [
                    { key: "open", label: "Open" },
                    { key: "softening", label: "Softening" },
                    { key: "reconnected", label: "Reconnected" },
                  ] as const
                ).map(({ key, label }) => {
                  const isSelected = oursFilter === key;

                  return (
                    <Pressable
                      key={key}
                      onPress={() => setOursFilter(isSelected ? null : key)}
                      style={[
                        styles.oursFilterChip,
                        isSelected && styles.oursFilterChipActive,
                      ]}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`Filter by ${label}`}
                    >
                      <Text
                        style={[
                          styles.oursFilterChipText,
                          isSelected && styles.oursFilterChipTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Quiet text action only when a filter is active */}
              {oursFilter !== null && (
                <Pressable
                  style={styles.clearFilterButton}
                  onPress={() => setOursFilter(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Clear shared moment status filter"
                >
                  <Text style={styles.clearFilterButtonText}>
                    Show all shared moments
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Relationship space error */}
          {hasSpaceError && (
            <View style={styles.centeredNoticeCard}>
              <Text style={styles.centeredNoticeTitle}>Relationship Space</Text>
              <Text style={styles.centeredNoticeText}>
                You do not belong to a relationship space.
              </Text>
            </View>
          )}

          {/* Generic backend error banner */}
          {hasGenericError && (
            <View style={styles.errorNoticeCard}>
              <Text style={styles.errorNoticeText}>{status}</Text>
            </View>
          )}

          {/* Calm loading skeleton layout */}
          {shouldShowLoading && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Restoring your moments...</Text>
              <View style={styles.skeletonCard} />
              <View style={[styles.skeletonCard, { opacity: 0.55 }]} />
            </View>
          )}

          {/* Empty states */}
          {!shouldShowLoading &&
            ((!isMineMode && !isOursMode) || hasFinishedInitialLoad) &&
            visibleEvents.length === 0 &&
            !hasSpaceError && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>
                {isMineMode
                  ? "Your private space is quiet for now."
                  : isOursMode
                  ? oursFilter === "open"
                    ? "No moments are currently lingering."
                    : oursFilter === "softening"
                    ? "No moments are softening right now."
                    : oursFilter === "reconnected"
                    ? "No reconnected moments yet."
                    : "Nothing has been shared yet."
                  : filter === "all"
                  ? "No moments here yet."
                  : filter === "mine"
                  ? "Your private space is quiet for now."
                  : "Nothing has been shared yet."}
              </Text>

              <Text style={styles.emptySubtitle}>
                {isMineMode
                  ? "Private reflections you keep will appear here."
                  : isOursMode
                  ? oursFilter === "open"
                    ? "Frictions that feel unresolved will appear here when recorded."
                    : oursFilter === "softening"
                    ? "Moments where care or space is opening up will appear here."
                    : oursFilter === "reconnected"
                    ? "Moments where you two found your way back will be kept here."
                    : "Only moments you intentionally share with Sam will appear here."
                  : filter === "all"
                  ? "You can record something good or something that felt off whenever it matters."
                  : filter === "mine"
                  ? "Private reflections you keep will appear here."
                  : "Only moments you intentionally share with Sam will appear here."}
              </Text>

              {!isMineMode && !isOursMode && filter === "all" && (
                <Pressable
                  onPress={() => router.push("/record-moment")}
                  style={({ pressed }) => [
                    styles.emptyActionButton,
                    pressed && styles.pressedState,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Record a moment"
                >
                  <Text style={styles.emptyActionText}>Record a moment</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* List of redesigned moment cards */}
          {!shouldShowLoading &&
            visibleEvents.map((event) => {
              const isCreator = event.creator_id === currentUserId;
              const naturalDate = formatNaturalDate(event.created_at);
              const isPositive = event.event_type === "positive";
              const privacyLabel =
                event.visibility === "mine" ? "Mine · Private" : "Ours · Shared";
              const attribution = isCreator ? "Recorded by you" : "Shared by Sam";
              const accessiblePrivacy =
                event.visibility === "mine" ? "private" : "shared";

              return (
                <Pressable
                  key={event.id}
                  onPress={() => openEvent(event.id)}
                  style={({ pressed }) => [
                    styles.card,
                    isPositive && styles.positiveCard,
                    pressed && styles.cardPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${accessiblePrivacy} ${formatCategory(
                    event.category,
                  )} moment recorded ${naturalDate.toLowerCase()}.`}
                >
                  {/* Top card row: Icon + Category + Attribution & Date + Chevron */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardHeaderLeft}>
                      <View
                        style={[
                          styles.iconBadge,
                          isPositive
                            ? styles.positiveIconBadge
                            : styles.frictionIconBadge,
                        ]}
                      >
                        <Text
                          style={[
                            styles.iconSymbol,
                            isPositive && styles.positiveIconSymbol,
                          ]}
                        >
                          {isPositive ? "✦" : "〰"}
                        </Text>
                      </View>

                      <View style={styles.categoryWrap}>
                        <Text style={styles.categoryTitle}>
                          {formatCategory(event.category)}
                        </Text>
                        <Text style={styles.attributionText}>{attribution}</Text>
                      </View>
                    </View>

                    <View style={styles.cardHeaderRight}>
                      <Text style={styles.dateText}>{naturalDate}</Text>
                      <Text style={styles.chevron}>›</Text>
                    </View>
                  </View>

                  {/* Bottom card row: Privacy badge & calm friction status / celebration badge */}
                  <View
                    style={[
                      styles.cardFooterRow,
                      isPositive && styles.positiveCardFooterRow,
                    ]}
                  >
                    <View
                      style={[
                        styles.privacyBadge,
                        event.visibility === "mine"
                          ? isPositive
                            ? styles.minePositivePrivacyBadge
                            : styles.minePrivacyBadge
                          : isPositive
                          ? styles.oursPositivePrivacyBadge
                          : styles.oursPrivacyBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.privacyBadgeText,
                          event.visibility === "mine"
                            ? isPositive
                              ? styles.minePositivePrivacyText
                              : styles.minePrivacyText
                            : isPositive
                            ? styles.oursPositivePrivacyText
                            : styles.oursPrivacyText,
                        ]}
                      >
                        {privacyLabel}
                      </Text>
                    </View>

                    {isPositive ? (
                      <View style={styles.positiveBadge}>
                        <Text style={styles.positiveBadgeText}>
                          Celebration
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.statusBadge}>
                        <Text style={styles.statusBadgeText}>
                          {formatStatus(event.status)}
                        </Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}

          {/* Development privacy tests (Only rendered when __DEV__ is true) */}
          {__DEV__ && (
            <View style={styles.devSection}>
              <View style={styles.devHeaderRow}>
                <Text style={styles.devHeading}>Development privacy tests</Text>
                <Text style={styles.devTag}>DEV ONLY</Text>
              </View>

              <Text style={styles.devDescription}>
                These controls are temporary and help verify Mine/Ours security.
                They are never shown in production builds.
              </Text>

              <View style={styles.devButtonsRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.devButton,
                    pressed && styles.pressedState,
                  ]}
                  onPress={() => createTestEvent("mine")}
                  accessibilityRole="button"
                  accessibilityLabel="Create Mine test event"
                >
                  <Text style={styles.devButtonText}>Create Mine test event</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.devButton,
                    pressed && styles.pressedState,
                  ]}
                  onPress={() => createTestEvent("ours")}
                  accessibilityRole="button"
                  accessibilityLabel="Create Ours test event"
                >
                  <Text style={styles.devButtonText}>Create Ours test event</Text>
                </Pressable>
              </View>

              {status.includes("test event") && (
                <Text style={styles.devStatusText}>{status}</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Fixed bottom navigation */}
      <AppBottomNav
        activeTab={
          isOursMode ? "our_space" : isMineMode ? "rhythm" : "moments"
        }
        isRootTab={!isMineMode}
      />
    </SafeAreaView>
  );
}

function formatCategory(category: string) {
  return category
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatStatus(status: RelationshipEvent["status"]) {
  switch (status) {
    case "open":
      return "Still lingering";
    case "partially_repaired":
      return "Softening";
    case "reconnected":
      return "Reconnected";
    default:
      return "Still lingering";
  }
}

function formatNaturalDate(createdAt: string) {
  try {
    const date = new Date(createdAt);
    if (isNaN(date.getTime())) {
      return createdAt;
    }

    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isToday) return "Today";
    if (isYesterday) return "Yesterday";

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return createdAt;
  }
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FAF7FC",
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
    backgroundColor: "#FAF7FC",
  },

  mainColumn: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },

  headerTextWrap: {
    flex: 1,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#3D3040",
    letterSpacing: -0.4,
  },

  subtitle: {
    fontSize: 13.5,
    color: "#6D6072",
    fontStyle: "italic",
    marginTop: 4,
    lineHeight: 18,
  },

  recordHeaderButton: {
    backgroundColor: "#F3EDF7",
    borderColor: "#E2D3E5",
    borderWidth: 1.2,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },

  recordHeaderButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6E416D",
  },

  /* Mine mode navigation */
  mineNavRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },

  viewAllButton: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#F3EDF7",
    borderWidth: 1,
    borderColor: "#E2D3E5",
  },

  viewAllButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6E416D",
  },

  /* Segmented control */
  segmentedFilterContainer: {
    flexDirection: "row",
    backgroundColor: "#EFE8F2",
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },

  segmentButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  segmentButtonActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },

  segmentButtonText: {
    fontSize: 13.5,
    fontWeight: "500",
    color: "#6D6072",
  },

  segmentButtonTextActive: {
    fontWeight: "700",
    color: "#3D3040",
  },

  /* Ours mode status filter chips */
  oursFilterSection: {
    marginBottom: 16,
    gap: 8,
  },

  oursFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  clearFilterButton: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 2,
  },

  clearFilterButtonText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#6E416D",
  },

  oursFilterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#F3EDF7",
    borderWidth: 1,
    borderColor: "#E2D3E5",
    alignItems: "center",
    justifyContent: "center",
  },

  oursFilterChipActive: {
    backgroundColor: "#6E416D",
    borderColor: "#6E416D",
  },

  oursFilterChipText: {
    fontSize: 12.5,
    fontWeight: "500",
    color: "#6D6072",
  },

  oursFilterChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },

  /* Cards */
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.2,
    borderColor: "#EAE0EC",
    shadowColor: "#2A1828",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },

  positiveCard: {
    backgroundColor: "#FDF8F5",
    borderColor: "#F2DFD4",
  },

  cardPressed: {
    opacity: 0.88,
    backgroundColor: "#FCFAFD",
  },

  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },

  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  positiveIconBadge: {
    backgroundColor: "#F9EEF6",
    borderWidth: 1,
    borderColor: "#EDD6E6",
  },

  frictionIconBadge: {
    backgroundColor: "#F1EDF8",
    borderWidth: 1,
    borderColor: "#DDD6EB",
  },

  iconSymbol: {
    fontSize: 16,
    color: "#6E416D",
  },

  positiveIconSymbol: {
    color: "#9E4D38",
  },

  categoryWrap: {
    flex: 1,
  },

  categoryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3D3040",
    letterSpacing: -0.2,
  },

  attributionText: {
    fontSize: 12.5,
    color: "#7E6F86",
    marginTop: 2,
  },

  cardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  dateText: {
    fontSize: 12.5,
    color: "#7E6F86",
    fontWeight: "500",
  },

  chevron: {
    fontSize: 18,
    color: "#B2A3B8",
    fontWeight: "600",
    marginTop: -2,
  },

  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F4EDF5",
  },

  positiveCardFooterRow: {
    borderTopColor: "#F5E6DC",
  },

  privacyBadge: {
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderWidth: 1,
  },

  minePrivacyBadge: {
    backgroundColor: "#F3EDF7",
    borderColor: "#E3D5E7",
  },

  minePositivePrivacyBadge: {
    backgroundColor: "#FDF4EE",
    borderColor: "#EEDAD0",
  },

  oursPrivacyBadge: {
    backgroundColor: "#FBEFF7",
    borderColor: "#EBD8E8",
  },

  oursPositivePrivacyBadge: {
    backgroundColor: "#FDF0EB",
    borderColor: "#F4D9CE",
  },

  privacyBadgeText: {
    fontSize: 11.5,
    fontWeight: "600",
  },

  minePrivacyText: {
    color: "#533C64",
  },

  minePositivePrivacyText: {
    color: "#7E4938",
  },

  oursPrivacyText: {
    color: "#6E416D",
  },

  oursPositivePrivacyText: {
    color: "#8B412D",
  },

  statusBadge: {
    backgroundColor: "#F6F1F8",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderWidth: 1,
    borderColor: "#E5DAE8",
  },

  statusBadgeText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#6D6072",
  },

  positiveBadge: {
    backgroundColor: "#FDF0EB",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderWidth: 1,
    borderColor: "#F4D9CE",
  },

  positiveBadgeText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#8B412D",
  },

  /* Empty states */
  emptyContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: "center",
    marginTop: 12,
    marginBottom: 20,
    borderWidth: 1.2,
    borderColor: "#EAE0EC",
    gap: 8,
  },

  emptyTitle: {
    fontSize: 16.5,
    fontWeight: "700",
    color: "#3D3040",
    textAlign: "center",
  },

  emptySubtitle: {
    fontSize: 13.5,
    color: "#6D6072",
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 280,
  },

  emptyActionButton: {
    marginTop: 12,
    backgroundColor: "#F3EDF7",
    borderColor: "#E0D0E2",
    borderWidth: 1.2,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyActionText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#6E416D",
  },

  /* Loading */
  loadingContainer: {
    marginTop: 8,
    gap: 12,
  },

  loadingText: {
    fontSize: 14,
    color: "#6D6072",
    textAlign: "center",
    marginBottom: 4,
  },

  skeletonCard: {
    backgroundColor: "#FFFFFF",
    height: 94,
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: "#EAE0EC",
  },

  /* Notices & Errors */
  centeredNoticeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    marginVertical: 16,
    borderWidth: 1.2,
    borderColor: "#EAE0EC",
    gap: 6,
  },

  centeredNoticeTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3D3040",
  },

  centeredNoticeText: {
    fontSize: 13.5,
    color: "#6D6072",
    textAlign: "center",
  },

  errorNoticeCard: {
    backgroundColor: "#FFF5F7",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.2,
    borderColor: "#F0D5DA",
  },

  errorNoticeText: {
    fontSize: 13,
    color: "#8B2E42",
    textAlign: "center",
  },

  /* Development section */
  devSection: {
    marginTop: 32,
    borderWidth: 1.2,
    borderColor: "#DCD0DF",
    borderRadius: 16,
    padding: 16,
    backgroundColor: "#FAF5FB",
  },

  devHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  devHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: "#5B4D60",
  },

  devTag: {
    fontSize: 10,
    fontWeight: "800",
    color: "#6E416D",
    backgroundColor: "#EBDDEE",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    letterSpacing: 0.5,
  },

  devDescription: {
    fontSize: 12,
    color: "#7E6F86",
    lineHeight: 16,
    marginBottom: 14,
  },

  devButtonsRow: {
    flexDirection: "row",
    gap: 10,
  },

  devButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.2,
    borderColor: "#D8C9DB",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  devButtonText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#5B4D60",
    textAlign: "center",
  },

  devStatusText: {
    marginTop: 10,
    fontSize: 12,
    color: "#6E416D",
    fontStyle: "italic",
    textAlign: "center",
  },

  pressedState: {
    opacity: 0.75,
  },
});
