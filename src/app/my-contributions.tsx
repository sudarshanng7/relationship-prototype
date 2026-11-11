import { AccountSessionBoundary, useAccountSessionScope } from "@/components/AccountSessionBoundary";
import {
  CouplyEmptyState, CouplyHeader, CouplyPage, CouplyQuietButton,
  CouplySectionCard, CouplyStatusPill,
} from "@/components/CouplyUI";
import { tokens } from "@/components/couply-tokens";
import { useAccessRevalidation, type AccessResult } from "@/hooks/useAccessRevalidation";
import type { EventRepairState } from "@/lib/repair-states";
import { supabase } from "@/lib/supabase";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";

type OwnPerspective = {
  id: string;
  author_id: string;
  perspective_text: string;
  sharing_status: "submitted" | "suspended";
  updated_at: string;
};
type OwnRepair = Pick<EventRepairState,
  "event_id" | "user_id" | "repair_status" | "what_helped" |
  "sharing_status" | "status_origin" | "updated_at"
>;
type Contribution = { kind: "perspective"; row: OwnPerspective } | { kind: "repair"; row: OwnRepair };
type Snapshot = { coupleId: string; items: Contribution[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
// Ownership remains an RLS decision; these checks reject malformed transport
// fields rather than interpreting them as absent or another author's data.
const isIdentifier = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value === value.trim();
const isTimestamp = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));

function isOwnPerspective(value: unknown): value is OwnPerspective {
  return isRecord(value) && isIdentifier(value.id) && isIdentifier(value.author_id) &&
    typeof value.perspective_text === "string" && value.perspective_text.replace(/^ +| +$/g, "").length > 0 &&
    ["submitted", "suspended"].includes(value.sharing_status as string) && isTimestamp(value.updated_at);
}

function isOwnRepair(value: unknown): value is OwnRepair {
  return isRecord(value) && isIdentifier(value.event_id) && isIdentifier(value.user_id) &&
    ["open", "partially_repaired", "reconnected"].includes(value.repair_status as string) &&
    (value.what_helped === null || ["talking", "space", "apology", "affection", "humour",
      "practical_action", "time", "other"].includes(value.what_helped as string)) &&
    ["private", "shared"].includes(value.sharing_status as string) &&
    ["explicit", "legacy_creator_report", "legacy_default_unconfirmed"].includes(value.status_origin as string) &&
    (value.sharing_status !== "shared" || value.status_origin === "explicit") &&
    isTimestamp(value.updated_at);
}
const REPAIR_LABELS = {
  open: "I still feel unresolved",
  partially_repaired: "I feel partly repaired",
  reconnected: "I feel reconnected",
};
const METHOD_LABELS = {
  talking: "Talking", space: "Space", apology: "An apology", affection: "Affection",
  humour: "Humour", practical_action: "Practical action", time: "Time", other: "Other",
};

export default function MyContributionsScreen() {
  return <AccountSessionBoundary routeKey="my-contributions"><MyContributionsContent /></AccountSessionBoundary>;
}

function MyContributionsContent() {
  const scope = useAccountSessionScope();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [channelEpoch, setChannelEpoch] = useState(0);
  const [liveFailed, setLiveFailed] = useState(false);
  const liveFailure = useRef(false);
  const verify = useCallback(async (currentRead: () => boolean): Promise<AccessResult<Snapshot>> => {
    const valid = () => currentRead() && scope.isCurrent();
    const auth = await scope.authorize();
    if (!auth || !valid()) return { kind: "failed" };
    const membership = async () => {
      const { data, error } = await supabase.from("couple_members")
        .select("couple_id").eq("user_id", scope.userId).maybeSingle()
        .setHeader("Authorization", `Bearer ${auth.token}`);
      if (error) throw new Error("Membership verification failed");
      return data?.couple_id as string | undefined;
    };
    const coupleId = await membership();
    if (!valid()) return { kind: "failed" };
    if (!coupleId) { setSnapshot(null); return { kind: "unavailable" }; }
    // Deliberately no parent query: own child RLS can retain contributions under
    // hidden parents. These filters never authorize another partner's experience.
    const [perspectives, repairs] = await Promise.all([
      supabase.from("event_perspectives")
        .select("id, author_id, perspective_text, sharing_status, updated_at")
        .eq("author_id", scope.userId).order("updated_at", { ascending: false })
        .setHeader("Authorization", `Bearer ${auth.token}`),
      supabase.from("event_repair_states")
        .select("event_id, user_id, repair_status, what_helped, sharing_status, status_origin, updated_at")
        .eq("user_id", scope.userId).order("updated_at", { ascending: false })
        .setHeader("Authorization", `Bearer ${auth.token}`),
    ]);
    if (!valid()) return { kind: "failed" };
    if (perspectives.error || repairs.error || !Array.isArray(perspectives.data) || !Array.isArray(repairs.data) ||
      !perspectives.data.every(isOwnPerspective) || !repairs.data.every(isOwnRepair)) return { kind: "failed" };
    const latestCouple = await membership();
    if (!valid()) return { kind: "failed" };
    if (latestCouple !== coupleId) { setSnapshot(null); return { kind: "unavailable" }; }
    if (!(await scope.authorize()) || !valid()) return { kind: "failed" };
    const items: Contribution[] = [
      ...perspectives.data.filter((row) => row.author_id === scope.userId)
        .map((row): Contribution => ({ kind: "perspective", row })),
      ...repairs.data.filter((row) => row.user_id === scope.userId)
        .map((row): Contribution => ({ kind: "repair", row })),
    ];
    items.sort((a, b) => b.row.updated_at.localeCompare(a.row.updated_at));
    return { kind: "ready", data: { coupleId, items } };
  }, [scope]);
  const publish = useCallback((next: Snapshot) => { if (scope.isCurrent()) setSnapshot(next); }, [scope]);
  const access = useAccessRevalidation({ verify, publish });
  const controller = access.controller;
  useFocusEffect(useCallback(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]));
  const channelCouple = access.state.phase === "unavailable" ? null : snapshot?.coupleId;
  useFocusEffect(useCallback(() => {
    if (!channelCouple || !scope.isCurrent()) return;
    liveFailure.current = false;
    setLiveFailed(false);
    let active = true;
    let failed = false;
    const hint = () => { if (active && scope.isCurrent()) void controller.refresh(true); };
    const channel = supabase.channel(`own-contributions-${scope.userId}-${channelCouple}-${channelEpoch}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "couple_members", filter: `user_id=eq.${scope.userId}` }, hint)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_perspectives", filter: `author_id=eq.${scope.userId}` }, hint)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_repair_states", filter: `user_id=eq.${scope.userId}` }, hint)
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
  const state = {
    loading: access.state.phase === "checking",
    items: verified ? snapshot?.items ?? [] : [],
    error: verified ? "" : access.state.phase === "unavailable"
      ? "Could not verify access to your contributions. Your relationship space is unavailable."
      : liveFailed
        ? "Live access checks are unavailable. Refresh to check your contributions again."
        : "Could not verify access to your contributions. Refresh to check again.",
  };

  return (
    <CouplyPage edges={["top", "left", "right", "bottom"]} testID="my-contributions-page">
      <FlatList
        style={styles.list}
        data={state.items}
        keyExtractor={(item) => item.kind === "perspective" ? `perspective:${item.row.id}` : `repair:${item.row.event_id}`}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <CouplyHeader
              overline="RELATIONSHIP OS"
              title="My contributions"
              subtitle="Your own perspectives and repair updates, including retained contributions when a moment is no longer available to you."
              backLabel="Back to Moments"
              onBack={() => { if (scope.isCurrent()) router.replace("/events"); }}
            />
            <CouplySectionCard variant="lilac" style={styles.explanation}>
              <Text style={styles.body}>These are your experiences. They do not imply agreement or mutual repair. Sharing labels describe your contribution; they do not confirm current access to its moment.</Text>
              <Text style={styles.body}>This page is read-only. Nothing here is automatically shared or resubmitted.</Text>
            </CouplySectionCard>
            <CouplyQuietButton
              label={state.loading ? "Checking access…" : "Refresh my contributions"}
              accessibilityLabel="Refresh my contributions"
              disabled={state.loading}
              loading={state.loading}
              onPress={refresh}
            />
            {state.loading && (
              <CouplySectionCard variant="muted" style={styles.notice}>
                <ActivityIndicator size="small" color={tokens.colors.plum} />
                <Text accessibilityLiveRegion="polite" style={styles.body}>Checking access…</Text>
              </CouplySectionCard>
            )}
            {!state.loading && state.error !== "" && (
              <CouplySectionCard style={styles.notice}>
                <Text accessibilityRole="header" style={styles.heading}>Contributions aren&apos;t available</Text>
                <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.body}>{state.error}</Text>
              </CouplySectionCard>
            )}
          </View>
        }
        ListEmptyComponent={!state.loading && !state.error ? (
          <CouplyEmptyState
            title="No contributions available."
            body="Perspectives you submit and your repair updates will appear here when you have access."
          />
        ) : null}
        renderItem={({ item }) => (
          <CouplySectionCard style={styles.card}>
            <View style={styles.cardHeader}>
              <Text accessibilityRole="header" style={styles.heading}>{item.kind === "perspective" ? "My perspective" : "My repair update"}</Text>
              <CouplyStatusPill
                label={item.kind === "perspective"
                  ? item.row.sharing_status === "suspended" ? "Sharing suspended" : "Submitted"
                  : item.row.sharing_status === "shared" ? "Shared" : "Private"}
                style={item.row.sharing_status === "shared" ? styles.sharedTag
                  : item.row.sharing_status === "suspended" ? undefined : styles.ownTag}
              />
            </View>
            {item.kind === "perspective" ? <>
              <Text style={styles.body}>{item.row.perspective_text}</Text>
              <Text style={styles.body}>{item.row.sharing_status === "suspended"
                ? "Sharing suspended — not visible to your partner."
                : "Submitted for sharing. Partner access depends on the moment remaining shared."}</Text>
            </> : <>
              <Text style={styles.body}>{item.row.status_origin === "legacy_default_unconfirmed"
                ? "Unconfirmed legacy default — not a personal repair report."
                : `My report: ${REPAIR_LABELS[item.row.repair_status]}`}</Text>
              {item.row.status_origin === "legacy_creator_report" && <Text style={styles.body}>Preserved legacy report.</Text>}
              {item.row.what_helped && item.row.status_origin !== "legacy_default_unconfirmed" &&
                <Text style={styles.body}>What helped me: {METHOD_LABELS[item.row.what_helped]}</Text>}
              <Text style={styles.body}>{item.row.sharing_status === "shared"
                ? "Shared by you. Partner access depends on the moment remaining shared."
                : "Private — not shared with your partner."}</Text>
            </>}
            <Text style={styles.timestamp}>Contribution updated: {new Date(item.row.updated_at).toLocaleString()}</Text>
          </CouplySectionCard>
        )}
      />
    </CouplyPage>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { flexGrow: 1, paddingTop: tokens.spacing.sm, paddingBottom: tokens.spacing.xxl },
  header: { gap: tokens.spacing.lg, marginBottom: tokens.spacing.xl },
  explanation: { gap: tokens.spacing.md },
  notice: { gap: tokens.spacing.md, alignItems: "center" },
  heading: { color: tokens.colors.text, fontSize: tokens.typeScale.sectionTitle, fontWeight: "700", flexShrink: 1 },
  body: { color: tokens.colors.textSecondary, fontSize: tokens.typeScale.bodyLarge, lineHeight: 23 },
  card: { gap: tokens.spacing.md, marginBottom: tokens.spacing.lg },
  cardHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: tokens.spacing.sm, justifyContent: "space-between" },
  ownTag: { backgroundColor: tokens.colors.surfaceLilac },
  sharedTag: { backgroundColor: tokens.colors.surfaceBlush },
  timestamp: { color: tokens.colors.textMuted, fontSize: tokens.typeScale.caption },
});
