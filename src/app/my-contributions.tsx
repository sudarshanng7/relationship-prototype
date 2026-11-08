import { AccountSessionBoundary, useAccountSessionScope } from "@/components/AccountSessionBoundary";
import {
  CouplyEmptyState, CouplyHeader, CouplyPage, CouplyQuietButton,
  CouplySectionCard, CouplyStatusPill,
} from "@/components/CouplyUI";
import { tokens } from "@/components/couply-tokens";
import type { EventRepairState } from "@/lib/repair-states";
import { supabase } from "@/lib/supabase";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
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
type State = { loading: boolean; error: string; items: Contribution[] };
const EMPTY: State = { loading: true, error: "", items: [] };
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
  const [state, setState] = useState<State>(EMPTY);
  const [reload, setReload] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    let request = 0;
    let channelFailed = false;

    async function load() {
      const id = ++request;
      const valid = () => active && !channelFailed && scope.isCurrent() && id === request;
      if (!valid()) return;
      setState(EMPTY);
      try {
        const auth = await scope.authorize();
        if (!auth || !valid()) return;
        const membership = async () => {
          const { data, error } = await supabase.from("couple_members")
            .select("couple_id").eq("user_id", scope.userId).maybeSingle()
            .setHeader("Authorization", `Bearer ${auth.token}`);
          if (error || !data?.couple_id) throw new Error("Membership unavailable");
          return data.couple_id as string;
        };
        const coupleId = await membership();
        if (!valid()) return;
        // Direct child reads only. RLS remains authoritative, including hidden
        // parents and revoked membership. Never request parent metadata/title.
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
        if (!valid()) return;
        if (perspectives.error || repairs.error) throw new Error("Contributions unavailable");
        if (await membership() !== coupleId) throw new Error("Membership changed");
        if (!valid() || !(await scope.authorize()) || !valid()) return;
        // Defense in depth: never render a partner row, even from a bad cache.
        const items: Contribution[] = [
          ...((perspectives.data ?? []) as OwnPerspective[])
            .filter((row) => row.author_id === scope.userId)
            .map((row): Contribution => ({ kind: "perspective", row })),
          ...((repairs.data ?? []) as OwnRepair[])
            .filter((row) => row.user_id === scope.userId)
            .map((row): Contribution => ({ kind: "repair", row })),
        ];
        items.sort((a, b) => b.row.updated_at.localeCompare(a.row.updated_at));
        setState({ loading: false, error: "", items });
      } catch {
        if (valid()) setState({ loading: false, items: [], error: "Could not verify access to your contributions. Refresh to check again." });
      }
    }

    const channel = supabase.channel(`own-contributions-${scope.userId}-${reload}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "couple_members", filter: `user_id=eq.${scope.userId}` }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "event_perspectives", filter: `author_id=eq.${scope.userId}` }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "event_repair_states", filter: `user_id=eq.${scope.userId}` }, () => { void load(); })
      .subscribe((status) => {
        if (active && scope.isCurrent() && ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          channelFailed = true;
          request++;
          setState({ loading: false, items: [], error: "Live access checks are unavailable. Refresh to check your contributions again." });
        }
      });
    void load();
    return () => {
      active = false;
      request++;
      setState(EMPTY);
      void supabase.removeChannel(channel);
    };
  }, [scope, reload]));

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
              onPress={() => setReload((value) => value + 1)}
            />
            {state.loading && (
              <CouplySectionCard variant="muted" style={styles.notice}>
                <ActivityIndicator size="small" color={tokens.colors.plum} />
                <Text accessibilityLiveRegion="polite" style={styles.body}>Checking access…</Text>
              </CouplySectionCard>
            )}
            {state.error !== "" && (
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
