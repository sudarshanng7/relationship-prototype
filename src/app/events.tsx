import { AccountSessionBoundary, useAccountSessionScope } from "@/components/AccountSessionBoundary";
import { AppBottomNav } from "@/components/AppBottomNav";
import {
  CouplyEmptyState, CouplyHeader, CouplyPage, CouplyPrimaryButton,
  CouplyQuietButton, CouplySectionCard, CouplyStatusPill,
} from "@/components/CouplyUI";
import { tokens } from "@/components/couply-tokens";
import { useAccessRevalidation, type AccessResult } from "@/hooks/useAccessRevalidation";
import type { EventRepairState } from "@/lib/repair-states";
import { supabase } from "@/lib/supabase";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
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
  couple_id: string;
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
  "event_id" | "user_id" | "repair_status" | "what_helped" | "sharing_status" | "status_origin" | "report_version"
>;

type MomentFilter = "all" | "mine" | "ours";

type EventsSnapshot = {
  events: RelationshipEvent[];
  repairStates: RepairCardState[];
  userId: string;
  coupleId: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
// Treat identifiers as opaque nonblank strings; database UUID/FK/RLS checks
// remain authoritative. Never coerce a missing ownership field into a string.
const isIdentifier = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value === value.trim();
const isTimestamp = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));

function isRelationshipEvent(value: unknown): value is RelationshipEvent {
  return isRecord(value) && isIdentifier(value.id) && isIdentifier(value.couple_id) &&
    isIdentifier(value.creator_id) && ["positive", "friction"].includes(value.event_type as string) &&
    ["mine", "ours"].includes(value.visibility as string) && typeof value.category === "string" &&
    (value.intensity === null || (Number.isInteger(value.intensity) &&
      (value.intensity as number) >= 1 && (value.intensity as number) <= 5)) && isTimestamp(value.created_at);
}

function isRepairCardState(value: unknown): value is RepairCardState {
  return isRecord(value) && isIdentifier(value.event_id) && isIdentifier(value.user_id) &&
    ["open", "partially_repaired", "reconnected"].includes(value.repair_status as string) &&
    (value.what_helped === null || ["talking", "space", "apology", "affection", "humour",
      "practical_action", "time", "other"].includes(value.what_helped as string)) &&
    ["private", "shared"].includes(value.sharing_status as string) &&
    ["explicit", "legacy_creator_report", "legacy_default_unconfirmed"].includes(value.status_origin as string) &&
    (value.sharing_status !== "shared" || value.status_origin === "explicit") &&
    Number.isSafeInteger(value.report_version) && (value.report_version as number) > 0;
}

// Compare only the selected projection, independently of database row order.
const eventSignature = (rows: RelationshipEvent[]) => JSON.stringify(rows.map((row) => JSON.stringify([
  row.id, row.couple_id, row.creator_id, row.event_type, row.category, row.intensity, row.visibility, row.created_at,
])).sort());
const repairSignature = (rows: RepairCardState[]) => JSON.stringify(rows.map((row) => JSON.stringify([
  row.event_id, row.user_id, row.repair_status, row.what_helped, row.sharing_status, row.status_origin, row.report_version,
])).sort());

const FILTERS: { value: MomentFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "mine", label: "Mine" },
  { value: "ours", label: "Ours" },
];

export default function EventsScreen() {
  const params = useLocalSearchParams<{ scope?: string | string[] }>();
  const scope = Array.isArray(params.scope) ? params.scope[0] : params.scope;

  const [filter, setFilter] = useState<MomentFilter>("all");
  const [filterScope, setFilterScope] = useState(scope);
  // Switching between Our Space and Moments starts with the right filter.
  if (filterScope !== scope) {
    setFilterScope(scope);
    setFilter("all");
  }

  return <AccountSessionBoundary routeKey="moments">
    <EventsContent routeScope={scope} filter={filter} setFilter={setFilter} />
  </AccountSessionBoundary>;
}

function EventsContent({ routeScope, filter, setFilter }: {
  routeScope: string | undefined; filter: MomentFilter; setFilter: (filter: MomentFilter) => void;
}) {
  const scope = useAccountSessionScope();
  const router = useRouter();
  const isOursSpace = routeScope === "ours";
  const isMineSpace = routeScope === "mine";
  const [snapshot, setSnapshot] = useState<EventsSnapshot | null>(null);
  const [channelEpoch, setChannelEpoch] = useState(0);
  const [liveFailed, setLiveFailed] = useState(false);
  const liveFailure = useRef(false);

  const verify = useCallback(async (currentRead: () => boolean): Promise<AccessResult<EventsSnapshot>> => {
    const valid = () => currentRead() && scope.isCurrent();
    const auth = await scope.authorize();
    if (!auth || !valid()) return { kind: "failed" };
    const bearer = `Bearer ${auth.token}`;
    const membership = async () => {
      const result = await supabase.from("couple_members").select("couple_id")
        .eq("user_id", scope.userId).maybeSingle().setHeader("Authorization", bearer);
      if (result.error) throw new Error("Membership verification failed");
      return result.data?.couple_id as string | undefined;
    };
    const coupleId = await membership();
    if (!valid()) return { kind: "failed" };
    if (!coupleId) { setSnapshot(null); return { kind: "unavailable" }; }
    const readEvents = async () => {
      const result = await supabase.from("relationship_events")
        .select("id, couple_id, creator_id, event_type, category, intensity, visibility, created_at")
        .eq("couple_id", coupleId).order("created_at", { ascending: false }).setHeader("Authorization", bearer);
      if (result.error || !Array.isArray(result.data) || !result.data.every(isRelationshipEvent)) throw new Error("Moments verification failed");
      return result.data.filter((row) => row.couple_id === coupleId &&
        (row.visibility === "ours" || row.creator_id === scope.userId));
    };
    const events = await readEvents();
    if (!valid()) return { kind: "failed" };
    const parents = new Map(events.map((event) => [event.id, event]));
    const frictionIds = events.filter((row) => row.event_type === "friction").map((row) => row.id);
    const readRepairs = async (): Promise<RepairCardState[]> => {
      if (!frictionIds.length) return [];
      const result = await supabase.from("event_repair_states")
        .select("event_id, user_id, repair_status, what_helped, sharing_status, status_origin, report_version")
        .in("event_id", frictionIds).setHeader("Authorization", bearer);
      if (result.error || !Array.isArray(result.data) || !result.data.every(isRepairCardState)) throw new Error("Repair verification failed");
      return result.data.filter((row) => {
        const parent = parents.get(row.event_id);
        return parent && (row.user_id === scope.userId || (parent.visibility === "ours" &&
          row.sharing_status === "shared" && row.status_origin === "explicit"));
      });
    };
    const repairs = await readRepairs();
    if (!valid()) return { kind: "failed" };
    // A withdrawal/version change during assembly must not publish an old summary.
    const latestRepairs = await readRepairs();
    if (!valid()) return { kind: "failed" };
    const latestEvents = await readEvents();
    if (!valid()) return { kind: "failed" };
    const latestCouple = await membership();
    if (!valid()) return { kind: "failed" };
    if (latestCouple !== coupleId) { setSnapshot(null); return { kind: "unavailable" }; }
    if (eventSignature(events) !== eventSignature(latestEvents) ||
        repairSignature(repairs) !== repairSignature(latestRepairs)) return { kind: "failed" };
    if (!(await scope.authorize()) || !valid()) return { kind: "failed" };
    return { kind: "ready", data: { events: latestEvents, repairStates: latestRepairs, userId: scope.userId, coupleId } };
  }, [scope]);
  const publish = useCallback((next: EventsSnapshot) => { if (scope.isCurrent()) setSnapshot(next); }, [scope]);
  const access = useAccessRevalidation({ verify, publish });
  const controller = access.controller;
  useFocusEffect(useCallback(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]));

  // One relationship-event subscription per focused account/couple, not per read.
  // Notifications never carry authorization; missed notifications use the lease timer.
  const channelCouple = access.state.phase === "unavailable" ? null : snapshot?.coupleId;
  useFocusEffect(useCallback(() => {
    if (!channelCouple || !scope.isCurrent()) return;
    liveFailure.current = false;
    setLiveFailed(false);
    let active = true;
    let failed = false;
    const channel = supabase.channel(`moments-list-${scope.userId}-${channelCouple}-${channelEpoch}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "relationship_events", filter: `couple_id=eq.${channelCouple}` }, () => {
        if (active && scope.isCurrent()) void controller.refresh(true);
      })
      .subscribe((status) => {
        if (!active || !scope.isCurrent()) return;
        if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          failed = true; liveFailure.current = true; setLiveFailed(true); controller.invalidate();
        } else if (status === "SUBSCRIBED" && failed) {
          failed = false; liveFailure.current = false; setLiveFailed(false); void controller.refresh(true);
        }
      });
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [channelCouple, channelEpoch, controller, scope]));
  const refresh = () => {
    if (!scope.isCurrent()) return;
    if (liveFailure.current) {
      liveFailure.current = false; setLiveFailed(false); setChannelEpoch((value) => value + 1);
    }
    void controller.refresh(true);
  };
  const verified = access.state.phase === "ready" && controller.hasFreshAccess() && scope.isCurrent();
  const unavailable = access.state.phase === "unavailable";
  const state = {
    loading: access.state.phase === "checking",
    events: verified ? snapshot?.events ?? [] : [],
    repairStates: verified ? snapshot?.repairStates ?? [] : [],
    userId: scope.userId,
    error: verified ? null : unavailable
      ? "Your relationship space is unavailable. Check Settings or refresh to verify access."
      : liveFailed ? "Live access checks are unavailable. Refresh to verify your moments again."
        : "Could not verify access to your moments. Refresh to check again.",
  };

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
              onPress={refresh}
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
              {unavailable && (
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
                    onPress={() => {
                      if (!scope.isCurrent() || !controller.hasFreshAccess()) return;
                      router.push({
                        pathname: "/event/[id]",
                        params: { id: event.id },
                      });
                    }}
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
                              : "Your update: No current report available"}
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
