import { AppBottomNav } from "@/components/AppBottomNav";
import {
  CouplyEmptyState, CouplyHeader, CouplyPage, CouplyPrimaryButton,
  CouplyQuietButton, CouplySectionCard, CouplyStatusPill,
} from "@/components/CouplyUI";
import { tokens } from "@/components/couply-tokens";
import type { EventRepairState } from "@/lib/repair-states";
import { supabase } from "@/lib/supabase";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
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
  created_at: string;
};

// Only the fields required for Moments cards are selected.
// The database's repair RLS governs which records can reach this screen.
type RepairCardState = Pick<
  EventRepairState,
  "event_id" | "user_id" | "repair_status" | "what_helped" | "sharing_status" | "status_origin"
>;

type MomentFilter = "all" | "mine" | "ours";

type EventsState = {
  loading: boolean;
  events: RelationshipEvent[];
  repairStates: RepairCardState[];
  userId: string | null;
  coupleId: string | null;
  error: string | null;
};

const EMPTY_STATE: EventsState = {
  loading: true,
  events: [],
  repairStates: [],
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
  const [filterScope, setFilterScope] = useState(scope);
  const [state, setState] = useState<EventsState>(EMPTY_STATE);
  const [authEpoch, setAuthEpoch] = useState(0);
  const [reloadEpoch, setReloadEpoch] = useState(0);

  // Switching between Our Space and Moments starts with the right filter.
  if (filterScope !== scope) {
    setFilterScope(scope);
    setFilter("all");
  }

  // Both epochs restart the focused loader, including its subscriptions.
  const focusContext = useMemo(
    () => ({ router, authEpoch, reloadEpoch }),
    [router, authEpoch, reloadEpoch],
  );

  // Reload on focus, and discard results belonging to an older request/session.
  useFocusEffect(
    useCallback(() => {
      const { router } = focusContext;
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
            repairStates: [],
            userId: user.id,
            coupleId: null,
            error: membershipError
              ? "Could not load your relationship space. Please try again."
              : "Create or join a relationship space in Settings to record moments.",
          });
          return;
        }

        // Event RLS is the first boundary. Do not read legacy repair columns.
        const { data, error } = await supabase
          .from("relationship_events")
          .select(
            "id, creator_id, event_type, category, intensity, visibility, created_at",
          )
          .eq("couple_id", membership.couple_id)
          .order("created_at", { ascending: false });
        if (!active || thisRequest !== requestNumber) return;

        if (error) {
          removeRealtimeChannel();
          setState({
            loading: false,
            events: [],
            repairStates: [],
            userId: user.id,
            coupleId: membership.couple_id,
            error: "Could not load moments. Please return to this screen to retry.",
          });
          return;
        }

        // Client-side authorization is defense-in-depth; Supabase RLS is mandatory.
        const events = ((data ?? []) as RelationshipEvent[]).filter(
          (event) => event.visibility === "ours" || event.creator_id === user.id,
        );
        const frictionIds = events
          .filter((event) => event.event_type === "friction")
          .map((event) => event.id);

        let repairStates: RepairCardState[] = [];
        if (frictionIds.length > 0) {
          // One batched read, not one query per card. RLS exposes own records
          // and deliberately shared partner records only.
          const { data: repairData, error: repairError } = await supabase
            .from("event_repair_states")
            .select(
              "event_id, user_id, repair_status, what_helped, sharing_status, status_origin",
            )
            .in("event_id", frictionIds);
          if (!active || thisRequest !== requestNumber) return;

          // Fail closed: never display half-loaded or stale repair details.
          if (repairError) {
            removeRealtimeChannel();
            setState({
              loading: false,
              events: [],
              repairStates: [],
              userId: user.id,
              coupleId: membership.couple_id,
              error: "Could not load repair updates. Please refresh to retry.",
            });
            return;
          }
          repairStates = (repairData ?? []) as RepairCardState[];
        }

        // Recheck the account AFTER both requests, before rendering anything.
        const { data: latestAuth, error: latestAuthError } =
          await supabase.auth.getUser();
        if (!active || thisRequest !== requestNumber) return;
        if (latestAuthError || latestAuth.user?.id !== user.id) {
          requestNumber++;
          removeRealtimeChannel();
          setState({ ...EMPTY_STATE });
          if (latestAuth.user) void refresh();
          else router.replace("/");
          return;
        }

        setState({
          loading: false,
          events,
          repairStates,
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
    }, [focusContext]),
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
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <CouplyPage safe={false} contentStyle={styles.column}>
          <CouplyHeader
            overline="RELATIONSHIP OS"
            title={title}
            subtitle={subtitle}
            rightSlot={
              <CouplyPrimaryButton
                label="+ Record a moment"
                accessibilityLabel="Record a moment"
                onPress={() => router.push("/record-moment")}
              />
            }
          />

          <View style={styles.actions}>
            <CouplyQuietButton
              label={state.loading ? "Refreshing…" : "↻ Refresh updates"}
              accessibilityLabel="Refresh moments and repair updates"
              disabled={state.loading}
              loading={state.loading}
              onPress={() => setReloadEpoch((value) => value + 1)}
            />
            <CouplyQuietButton
              label="My contributions"
              variant="text"
              onPress={() => router.push("/my-contributions")}
            />
          </View>

          {!isOursSpace && !isMineSpace && (
            <View style={styles.filters} accessibilityRole="tablist">
              {FILTERS.map((option) => {
                const selected = filter === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setFilter(option.value)}
                    style={({ pressed }) => [styles.filter, selected && styles.filterSelected, pressed && styles.pressed]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Show ${option.label} moments`}
                  >
                    <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {state.loading || !state.userId ? (
            <CouplySectionCard variant="muted" style={styles.notice}>
              <ActivityIndicator size="small" color={tokens.colors.plum} />
              <Text accessibilityLiveRegion="polite" style={styles.body}>Loading your moments...</Text>
            </CouplySectionCard>
          ) : state.error ? (
            <CouplySectionCard style={styles.notice}>
              <Text accessibilityRole="header" style={styles.noticeTitle}>Moments aren&apos;t available</Text>
              <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.body}>{state.error}</Text>
              {!state.coupleId && (
                <CouplyQuietButton label="Go to Settings" onPress={() => router.push("/profile")} />
              )}
            </CouplySectionCard>
          ) : visibleEvents.length === 0 ? (
            <CouplyEmptyState
              title={isOursSpace || filter === "ours"
                ? "Nothing shared here yet"
                : isMineSpace || filter === "mine"
                  ? "Your private space is quiet for now"
                  : "No moments here yet"}
              body={isOursSpace || filter === "ours"
                ? "Only moments deliberately shared as Ours will appear here."
                : "You can record something whenever it matters to you."}
            />
          ) : (
            <View style={styles.list}>
              {visibleEvents.map((event) => {
                const isCreator = event.creator_id === state.userId;
                const isPositive = event.event_type === "positive";
                const relevantRepairs = state.repairStates.filter(
                  (repair) => repair.event_id === event.id,
                );
                const myRepair = relevantRepairs.find(
                  (repair) => repair.user_id === state.userId,
                );
                const partnerRepair = event.visibility === "ours"
                  ? relevantRepairs.find(
                      (repair) => repair.user_id !== state.userId &&
                        repair.sharing_status === "shared" &&
                        repair.status_origin === "explicit",
                    )
                  : undefined;
                return (
                  <Pressable
                    key={event.id}
                    testID={`moment-${event.id}`}
                    style={({ pressed }) => pressed && styles.pressed}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${event.visibility} ${formatCategory(event.category)} moment`}
                    onPress={() =>
                      router.push({
                        pathname: "/event/[id]",
                        params: { id: event.id },
                      })
                    }
                  >
                    <CouplySectionCard style={[styles.card, isPositive && styles.positiveCard]}>
                      <View style={styles.cardTop}>
                        <View style={[styles.iconBubble, isPositive && styles.positiveIcon]}>
                          <Text accessible={false} style={styles.icon}>{isPositive ? "✦" : "〰"}</Text>
                        </View>
                        <View style={styles.cardHeaderText}>
                          <Text style={styles.cardTitle}>{formatCategory(event.category)}</Text>
                          <Text style={styles.cardMeta}>{isCreator ? "Recorded by you" : "Shared by your partner"}</Text>
                        </View>
                        <Text style={styles.date}>{formatDate(event.created_at)}</Text>
                        <Text accessible={false} style={styles.chevron}>›</Text>
                      </View>

                      <View style={styles.cardBottom}>
                        <CouplyStatusPill
                          label={event.visibility === "mine" ? "Mine · Private" : "Ours · Shared"}
                          style={event.visibility === "ours" ? styles.sharedTag : styles.privateTag}
                        />
                        <CouplyStatusPill label={isPositive ? "Positive" : "Friction"} variant={isPositive ? "positive" : "neutral"} />
                      </View>

                      {!isPositive && (
                        <View style={styles.repairSummary}>
                          <Text style={styles.repairStatus}>
                            {myRepair
                              ? myRepair.status_origin === "legacy_default_unconfirmed"
                                ? "Your update: Imported Open (not confirmed)"
                                : myRepair.status_origin !== "explicit"
                                  ? `Your earlier update: ${formatRepairStatus(myRepair.repair_status)} (review before sharing)`
                                  : `Your update: ${formatRepairStatus(myRepair.repair_status)} · ${myRepair.sharing_status === "shared" ? "Shared" : "Private"}`
                              : "Your update: Not recorded yet"}
                          </Text>
                          {partnerRepair && (
                            <Text style={styles.repairStatus}>
                              {`Partner shared: ${formatRepairStatus(partnerRepair.repair_status)}`}
                              {partnerRepair.what_helped
                                ? ` · ${formatCategory(partnerRepair.what_helped)} helped`
                                : ""}
                            </Text>
                          )}
                        </View>
                      )}
                    </CouplySectionCard>
                  </Pressable>
                );
              })}
            </View>
          )}
        </CouplyPage>
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

function formatRepairStatus(status: RepairCardState["repair_status"]): string {
  switch (status) {
    case "open":
      return "Still unresolved";
    case "partially_repaired":
      return "A little better";
    case "reconnected":
      return "I feel reconnected";
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
  screen: { flex: 1, backgroundColor: tokens.colors.pageBackground },
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingTop: tokens.spacing.sm, paddingBottom: tokens.spacing.xxl },
  column: { gap: tokens.spacing.xl },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: tokens.spacing.sm },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: tokens.colors.surfaceLilac,
    padding: tokens.spacing.xs,
    borderRadius: tokens.radii.card,
    gap: tokens.spacing.xs,
  },
  filter: {
    flexGrow: 1,
    flexBasis: 72,
    minHeight: tokens.layout.minTouchTarget,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.small,
    alignItems: "center",
    justifyContent: "center",
  },
  filterSelected: { backgroundColor: tokens.colors.surface, borderWidth: 1, borderColor: tokens.colors.border },
  filterText: { color: tokens.colors.textSecondary, fontSize: tokens.typeScale.bodyLarge, fontWeight: "500" },
  filterTextSelected: { color: tokens.colors.plum, fontWeight: "700" },
  notice: { alignItems: "center", gap: tokens.spacing.md },
  noticeTitle: { color: tokens.colors.text, fontSize: tokens.typeScale.sectionTitle, fontWeight: "700", textAlign: "center" },
  body: { color: tokens.colors.textSecondary, fontSize: tokens.typeScale.bodyLarge, lineHeight: 22, textAlign: "center" },
  list: { gap: tokens.spacing.md },
  card: { minHeight: tokens.layout.minTouchTarget, gap: tokens.spacing.md },
  positiveCard: { borderColor: tokens.colors.celebrationBorder },
  cardTop: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: tokens.spacing.sm },
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: tokens.radii.pill,
    backgroundColor: tokens.colors.surfaceLilac,
    alignItems: "center",
    justifyContent: "center",
  },
  positiveIcon: { backgroundColor: tokens.colors.celebrationSoft },
  icon: { color: tokens.colors.plum, fontSize: 21 },
  cardHeaderText: { flexGrow: 1, flexShrink: 1, flexBasis: 120, minWidth: 0 },
  cardTitle: { color: tokens.colors.text, fontSize: tokens.typeScale.sectionTitle, fontWeight: "700" },
  cardMeta: { color: tokens.colors.textSecondary, fontSize: tokens.typeScale.caption, marginTop: tokens.spacing.xs },
  date: { color: tokens.colors.textMuted, fontSize: tokens.typeScale.caption, flexShrink: 1 },
  chevron: { color: tokens.colors.textMuted, fontSize: 22 },
  cardBottom: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: tokens.spacing.sm },
  privateTag: { backgroundColor: tokens.colors.surfaceLilac },
  sharedTag: { backgroundColor: tokens.colors.surfaceBlush },
  repairSummary: { gap: tokens.spacing.sm, borderTopWidth: 1, borderTopColor: tokens.colors.borderSoft, paddingTop: tokens.spacing.md },
  repairStatus: { color: tokens.colors.textSecondary, fontSize: tokens.typeScale.body, lineHeight: 21 },
  pressed: { opacity: 0.75 },
});
