import { AppBottomNav } from "@/components/AppBottomNav";
import { supabase } from "@/lib/supabase";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

type MomentFilter = "all" | "mine" | "ours";

type EventsState = {
  loading: boolean;
  events: RelationshipEvent[];
  userId: string | null;
  coupleId: string | null;
  error: string | null;
};

const EMPTY_STATE: EventsState = {
  loading: true,
  events: [],
  userId: null,
  coupleId: null,
  error: null,
};

const FILTERS: { value: MomentFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "mine", label: "Mine" },
  { value: "ours", label: "Ours" },
];

export default function EventsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ scope?: string | string[] }>();
  const scope = Array.isArray(params.scope) ? params.scope[0] : params.scope;
  const isOursSpace = scope === "ours";
  const isMineSpace = scope === "mine";

  const [filter, setFilter] = useState<MomentFilter>("all");
  const [state, setState] = useState<EventsState>(EMPTY_STATE);
  const [authEpoch, setAuthEpoch] = useState(0);

  // Switching between Our Space and Moments starts with the right filter.
  useEffect(() => {
    setFilter("all");
  }, [scope]);

  // Reload on focus, and discard results belonging to an older request/session.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      let requestNumber = 0;
      let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
      let channelFor: string | null = null;

      function removeRealtimeChannel() {
        const oldChannel = realtimeChannel;
        realtimeChannel = null;
        channelFor = null;
        if (oldChannel) {
          void supabase.removeChannel(oldChannel);
        }
      }

      async function refresh() {
        const thisRequest = ++requestNumber;
        // Hide previous-user records while authorization is checked again.
        setState({ ...EMPTY_STATE });

        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (!active || thisRequest !== requestNumber) return;

        const user = authData.user;
        if (authError || !user) {
          removeRealtimeChannel();
          setState({ ...EMPTY_STATE, loading: false });
          router.replace("/");
          return;
        }

        const { data: membership, error: membershipError } = await supabase
          .from("couple_members")
          .select("couple_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!active || thisRequest !== requestNumber) return;

        if (membershipError || !membership) {
          removeRealtimeChannel();
          setState({
            loading: false,
            events: [],
            userId: user.id,
            coupleId: null,
            error: membershipError
              ? "Could not load your relationship space. Please try again."
              : "Create or join a relationship space in Settings to record moments.",
          });
          return;
        }

        const { data, error } = await supabase
          .from("relationship_events")
          .select(
            "id, creator_id, event_type, category, intensity, visibility, status, created_at",
          )
          .eq("couple_id", membership.couple_id)
          .order("created_at", { ascending: false });
        if (!active || thisRequest !== requestNumber) return;

        // A pending request must never render after a different account logs in.
        const { data: latestAuth } = await supabase.auth.getUser();
        if (!active || thisRequest !== requestNumber) return;
        if (latestAuth.user?.id !== user.id) {
          removeRealtimeChannel();
          void refresh();
          return;
        }

        if (error) {
          removeRealtimeChannel();
          setState({
            loading: false,
            events: [],
            userId: user.id,
            coupleId: membership.couple_id,
            error:
              "Could not load moments. Please return to this screen to retry.",
          });
          return;
        }

        setState({
          loading: false,
          events: (data ?? []) as RelationshipEvent[],
          userId: user.id,
          coupleId: membership.couple_id,
          error: null,
        });

        const desiredChannel = `${user.id}:${membership.couple_id}`;
        if (channelFor !== desiredChannel) {
          removeRealtimeChannel();
          realtimeChannel = supabase
            .channel(`moments-list-${user.id}-${membership.couple_id}`)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "relationship_events",
                filter: `couple_id=eq.${membership.couple_id}`,
              },
              () => {
                // Re-validate membership and visibility before redisplaying data.
                void refresh();
              },
            )
            .subscribe();
          channelFor = desiredChannel;
        }
      }

      const { data: authListener } = supabase.auth.onAuthStateChange(
        (event) => {
          if (!active) return;
          if (event === "SIGNED_OUT") {
            requestNumber++;
            removeRealtimeChannel();
            setState({ ...EMPTY_STATE, loading: false });
            router.replace("/");
          } else if (event === "SIGNED_IN") {
            requestNumber++;
            removeRealtimeChannel();
            setState({ ...EMPTY_STATE });
            // Restart the focused effect outside the auth callback.
            setAuthEpoch((previous) => previous + 1);
          }
        },
      );

      void refresh();
      return () => {
        active = false;
        requestNumber++;
        authListener.subscription.unsubscribe();
        removeRealtimeChannel();
      };
    }, [router, authEpoch]),
  );

  // UI filtering is not a substitute for Supabase Row Level Security.
  const authorizedEvents = state.events.filter(
    (event) => event.visibility === "ours" || event.creator_id === state.userId,
  );
  const visibleEvents = authorizedEvents.filter((event) => {
    if (isOursSpace) return event.visibility === "ours";
    if (isMineSpace) {
      return event.visibility === "mine" && event.creator_id === state.userId;
    }
    if (filter === "mine") {
      return event.visibility === "mine" && event.creator_id === state.userId;
    }
    if (filter === "ours") return event.visibility === "ours";
    return true;
  });

  const title = isOursSpace ? "Our Space" : isMineSpace ? "Mine" : "Moments";
  const subtitle = isOursSpace
    ? "The moments intentionally shared between you and your partner."
    : isMineSpace
      ? "Your private moments, visible only to you."
      : "A place to return to what mattered.";

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.column}>
          <View style={styles.headingRow}>
            <View style={styles.headingCopy}>
              <Text style={styles.eyebrow}>RELATIONSHIP OS</Text>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <Pressable
              style={styles.recordButton}
              onPress={() => router.push("/record-moment")}
              accessibilityRole="button"
              accessibilityLabel="Record a moment"
            >
              <Text style={styles.recordButtonText}>+ Record</Text>
            </Pressable>
          </View>

          {!isOursSpace && !isMineSpace && (
            <View style={styles.filters}>
              {FILTERS.map((option) => {
                const selected = filter === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setFilter(option.value)}
                    style={[styles.filter, selected && styles.filterSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Show ${option.label} moments`}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        selected && styles.filterTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {state.loading ? (
            <View style={styles.centerMessage}>
              <ActivityIndicator size="small" color="#6E416D" />
              <Text style={styles.messageText}>Loading your moments...</Text>
            </View>
          ) : state.error ? (
            <View style={styles.centerMessage}>
              <Text style={styles.messageTitle}>Moments aren't available</Text>
              <Text style={styles.messageText}>{state.error}</Text>
              {!state.coupleId && (
                <Pressable
                  onPress={() => router.push("/profile")}
                  accessibilityRole="button"
                >
                  <Text style={styles.actionLink}>Go to Settings</Text>
                </Pressable>
              )}
            </View>
          ) : visibleEvents.length === 0 ? (
            <View style={styles.centerMessage}>
              <Text style={styles.messageTitle}>
                {isOursSpace || filter === "ours"
                  ? "Nothing shared here yet"
                  : isMineSpace || filter === "mine"
                    ? "Your private space is quiet for now"
                    : "No moments here yet"}
              </Text>
              <Text style={styles.messageText}>
                {isOursSpace || filter === "ours"
                  ? "Only moments deliberately shared as Ours will appear here."
                  : "You can record something whenever it matters to you."}
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {visibleEvents.map((event) => {
                const isCreator = event.creator_id === state.userId;
                const isPositive = event.event_type === "positive";
                return (
                  <Pressable
                    key={event.id}
                    style={styles.card}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${event.visibility} ${formatCategory(event.category)} moment`}
                    onPress={() =>
                      router.push({
                        pathname: "/event/[id]",
                        params: { id: event.id },
                      })
                    }
                  >
                    <View style={styles.cardTop}>
                      <View style={styles.iconBubble}>
                        <Text style={styles.icon}>
                          {isPositive ? "✦" : "〰"}
                        </Text>
                      </View>
                      <View style={styles.cardHeaderText}>
                        <Text style={styles.cardTitle}>
                          {formatCategory(event.category)}
                        </Text>
                        <Text style={styles.cardMeta}>
                          {isCreator
                            ? "Recorded by you"
                            : "Shared by your partner"}
                        </Text>
                      </View>
                      <Text style={styles.date}>
                        {formatDate(event.created_at)}
                      </Text>
                      <Text style={styles.chevron}>›</Text>
                    </View>

                    <View style={styles.cardBottom}>
                      <View
                        style={[
                          styles.privacyTag,
                          event.visibility === "ours" && styles.sharedTag,
                        ]}
                      >
                        <Text style={styles.privacyTagText}>
                          {event.visibility === "mine"
                            ? "Mine · Private"
                            : "Ours · Shared"}
                        </Text>
                      </View>
                      <Text style={styles.eventType}>
                        {isPositive ? "Positive" : "Friction"}
                      </Text>
                    </View>

                    {!isPositive && (
                      <Text style={styles.repairStatus}>
                        {isCreator ? "Your update" : "Creator's update"}:{" "}
                        {formatStatus(event.status)}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
      <AppBottomNav activeTab={isOursSpace ? "our_space" : "moments"} />
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
      return "Still unresolved";
    case "partially_repaired":
      return "A little better";
    case "reconnected":
      return "Feels reconnected";
    default:
      return "No update";
  }
}

function formatDate(iso: string) {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return "Date unavailable";
  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FBF7FC" },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 36,
  },
  column: { width: "100%", maxWidth: 720, alignSelf: "center", gap: 20 },
  headingRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  headingCopy: { flex: 1 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#6E416D",
    marginBottom: 10,
  },
  title: { fontSize: 28, fontWeight: "700", color: "#3D3040" },
  subtitle: { marginTop: 7, fontSize: 14, lineHeight: 21, color: "#6D6072" },
  recordButton: {
    backgroundColor: "#6E416D",
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 13,
  },
  recordButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  filters: {
    flexDirection: "row",
    backgroundColor: "#F2EBF3",
    padding: 4,
    borderRadius: 14,
    gap: 4,
  },
  filter: {
    flex: 1,
    borderRadius: 11,
    paddingVertical: 11,
    alignItems: "center",
  },
  filterSelected: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8DCE9",
  },
  filterText: { color: "#6D6072", fontWeight: "500", fontSize: 14 },
  filterTextSelected: { color: "#6E416D", fontWeight: "700" },
  centerMessage: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8DCE9",
    borderRadius: 18,
    padding: 26,
    alignItems: "center",
    gap: 11,
  },
  messageTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#3D3040",
    textAlign: "center",
  },
  messageText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6D6072",
    textAlign: "center",
  },
  actionLink: {
    color: "#6E416D",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 6,
  },
  list: { gap: 12 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E8DCE9",
    padding: 16,
    gap: 13,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1EDF7",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 21, color: "#6E416D" },
  cardHeaderText: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#3D3040" },
  cardMeta: { fontSize: 12, marginTop: 4, color: "#6D6072" },
  date: { fontSize: 11, color: "#8E7E94", maxWidth: 90, textAlign: "right" },
  chevron: { fontSize: 22, color: "#8E7E94" },
  cardBottom: { flexDirection: "row", alignItems: "center", gap: 9 },
  privacyTag: {
    backgroundColor: "#F1EDF7",
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  sharedTag: { backgroundColor: "#FBEFF7" },
  privacyTagText: { color: "#6E416D", fontSize: 12, fontWeight: "700" },
  eventType: { color: "#6D6072", fontSize: 12 },
  repairStatus: { color: "#6D6072", fontSize: 12, lineHeight: 18 },
});
