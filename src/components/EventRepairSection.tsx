/**
 * ROS-03C Step 4B — individual repair updates for friction moments.
 *
 * Source of truth: public.event_repair_states, via the tested typed client.
 * Never read or write relationship_events.status, repair_method or reconnected_at.
 * Database RLS controls which partner reports this caller can read.
 */
import {
  loadEventRepairStates,
  saveMyRepairState,
  shareMyRepairState,
  withdrawMyRepairState,
  type EventRepairState,
  type RepairMethod,
  type RepairStatus,
} from "@/lib/repair-states";
import { supabase } from "@/lib/supabase";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = {
  eventId: string;
  userId: string;
  visibility: "mine" | "ours";
};

const STATUSES: { value: RepairStatus; label: string }[] = [
  { value: "open", label: "Still unresolved" },
  { value: "partially_repaired", label: "A little better" },
  { value: "reconnected", label: "I feel reconnected" },
];

const METHODS: { value: RepairMethod | null; label: string }[] = [
  { value: null, label: "Not sure / none" },
  { value: "talking", label: "Talking" },
  { value: "space", label: "Space" },
  { value: "apology", label: "Apology" },
  { value: "affection", label: "Affection" },
  { value: "humour", label: "Humour" },
  { value: "practical_action", label: "Practical action" },
  { value: "time", label: "Time" },
  { value: "other", label: "Other" },
];

function statusLabel(value: RepairStatus): string {
  return STATUSES.find((item) => item.value === value)?.label ?? value;
}

function methodLabel(value: RepairMethod | null): string | null {
  if (!value) return null;
  return METHODS.find((item) => item.value === value)?.label ?? value;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function EventRepairSection({ eventId, userId, visibility }: Props) {
  const [rows, setRows] = useState<EventRepairState[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draftStatus, setDraftStatus] = useState<RepairStatus | null>(null);
  const [draftMethod, setDraftMethod] = useState<RepairMethod | null>(null);
  const [confirmShare, setConfirmShare] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || auth.user?.id !== userId) {
        throw new Error("Your session changed. Reopen this moment.");
      }
      const records = await loadEventRepairStates(eventId);
      const { data: after } = await supabase.auth.getUser();
      if (id !== requestId.current) return;
      if (after.user?.id !== userId) {
        setRows([]);
        setDraftStatus(null);
        throw new Error("Your session changed. Reopen this moment.");
      }
      const mine = records.find((record) => record.user_id === userId);
      setRows(records);
      setDraftStatus(mine?.repair_status ?? null);
      setDraftMethod(mine?.what_helped ?? null);
      setConfirmShare(false);
      setConfirmWithdraw(false);
    } catch (e) {
      if (id === requestId.current) {
        setRows([]);
        setDraftStatus(null);
        setDraftMethod(null);
        setError(errorText(e));
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [eventId, userId]);

  // Always recheck membership, RLS and account identity when returning here.
  useFocusEffect(
    useCallback(() => {
      setRows([]);
      setNotice("");
      setLoading(true);
      void refresh();
      return () => {
        requestId.current++;
      };
    }, [refresh, visibility]),
  );

  const mine = rows.find((row) => row.user_id === userId);
  const partner = visibility === "ours"
    ? rows.find((row) => row.user_id !== userId && row.sharing_status === "shared")
    : undefined;
  const currentMethod = draftStatus === "open" ? null : draftMethod;
  const dirty = Boolean(
    mine && (draftStatus !== mine.repair_status || currentMethod !== mine.what_helped),
  );
  const canSave = draftStatus !== null &&
    (!mine || dirty || mine.status_origin !== "explicit");
  const canShare = Boolean(
    visibility === "ours" && mine &&
    mine.sharing_status === "private" &&
    mine.status_origin === "explicit" && !dirty,
  );

  async function execute(action: () => Promise<unknown>, success: string) {
    if (busy || loading) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      // Recheck the currently authenticated account before any write.
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user?.id !== userId) throw new Error("Your session changed. Reopen this moment.");
      await action();
      await refresh();
      setNotice(success);
    } catch (e) {
      const message = errorText(e);
      // Reload after a stale-version error rather than reusing the old value.
      await refresh();
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Your repair update</Text>
      <Text style={styles.helper}>
        Your experience belongs to you. Saving is private; sharing with your partner is a separate choice.
      </Text>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#6E416D" />
          <Text style={styles.helper}>Loading personal updates…</Text>
        </View>
      ) : error && !mine && draftStatus === null ? (
        <Pressable onPress={() => void refresh()} style={styles.outlineButton} accessibilityRole="button">
          <Text style={styles.buttonLabel}>Could not load updates. Tap to retry.</Text>
        </Pressable>
      ) : (
        <>
          {mine ? (
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>Saved for you: {statusLabel(mine.repair_status)}</Text>
              <Text style={styles.summarySecondary}>
                {mine.sharing_status === "shared" ? "Shared with your partner" : "Private — not shared"}
              </Text>
              {mine.what_helped && (
                <Text style={styles.summarySecondary}>What helped: {methodLabel(mine.what_helped)}</Text>
              )}
              {mine.status_origin !== "explicit" && (
                <Text style={styles.legacyNote}>
                  This was imported from an earlier version. It may include an automatic default.
                  Review and save it deliberately before sharing.
                </Text>
              )}
            </View>
          ) : (
            <Text style={styles.helper}>You haven't recorded a personal repair update yet.</Text>
          )}

          <Text style={styles.subheading}>How does this feel now?</Text>
          <View style={styles.choices}>
            {STATUSES.map((item) => (
              <Pressable
                key={item.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: draftStatus === item.value, disabled: busy }}
                disabled={busy}
                style={[styles.choice, draftStatus === item.value && styles.selected]}
                onPress={() => {
                  setDraftStatus(item.value);
                  if (item.value === "open") setDraftMethod(null);
                  setConfirmShare(false);
                }}
              >
                <Text style={[styles.choiceText, draftStatus === item.value && styles.selectedText]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {draftStatus !== null && draftStatus !== "open" && (
            <>
              <Text style={styles.subheading}>What helped? (optional)</Text>
              <View style={styles.choices}>
                {METHODS.map((item) => (
                  <Pressable
                    key={item.value ?? "none"}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: draftMethod === item.value, disabled: busy }}
                    disabled={busy}
                    style={[styles.choice, draftMethod === item.value && styles.selected]}
                    onPress={() => {
                      setDraftMethod(item.value);
                      setConfirmShare(false);
                    }}
                  >
                    <Text style={[styles.choiceText, draftMethod === item.value && styles.selectedText]}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {mine?.sharing_status === "shared" && canSave && (
            <Text style={styles.helper}>
              Saving a change will withdraw the currently shared update. Your partner may have already seen it.
            </Text>
          )}
          {canSave && (
            <Pressable
              style={[styles.primaryButton, busy && styles.disabled]}
              accessibilityRole="button"
              disabled={busy}
              onPress={() => {
                if (!draftStatus) return;
                void execute(
                  () => saveMyRepairState(eventId, draftStatus, currentMethod),
                  "Saved privately. You can share it separately when ready.",
                );
              }}
            >
              <Text style={styles.primaryLabel}>{busy ? "Saving…" : "Save privately"}</Text>
            </Pressable>
          )}

          {visibility === "ours" && Boolean(mine) && (
            <View style={styles.shareSection}>
              <Text style={styles.subheading}>Sharing your update</Text>
              {dirty && <Text style={styles.helper}>Save your changes privately before sharing.</Text>}
              {mine?.status_origin !== "explicit" && (
                <Text style={styles.helper}>Confirm the imported state with Save privately before sharing.</Text>
              )}
              {mine?.sharing_status === "shared" ? (
                <>
                  <Text style={styles.helper}>Your current saved update is visible to your partner.</Text>
                  {!confirmWithdraw ? (
                    <Pressable
                      style={[styles.outlineButton, busy && styles.disabled]}
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => setConfirmWithdraw(true)}
                    >
                      <Text style={styles.buttonLabel}>Withdraw shared update</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.confirm}>
                      <Text style={styles.helper}>
                        Withdraw sharing? Your private record will remain, but your partner will no longer be able to fetch it.
                      </Text>
                      <Pressable
                        style={[styles.primaryButton, busy && styles.disabled]}
                        disabled={busy}
                        accessibilityRole="button"
                        onPress={() => void execute(
                          () => withdrawMyRepairState(eventId),
                          "Update withdrawn from sharing; your personal record remains.",
                        )}
                      >
                        <Text style={styles.primaryLabel}>Confirm withdrawal</Text>
                      </Pressable>
                      <Pressable style={styles.outlineButton} disabled={busy} onPress={() => setConfirmWithdraw(false)}>
                        <Text style={styles.buttonLabel}>Cancel</Text>
                      </Pressable>
                    </View>
                  )}
                </>
              ) : canShare ? (
                !confirmShare ? (
                  <Pressable style={[styles.outlineButton, busy && styles.disabled]} disabled={busy} accessibilityRole="button" onPress={() => setConfirmShare(true)}>
                    <Text style={styles.buttonLabel}>Share my saved update</Text>
                  </Pressable>
                ) : (
                  <View style={styles.confirm}>
                    <Text style={styles.helper}>
                      Share “{statusLabel(mine!.repair_status)}”{mine!.what_helped ? ` (what helped: ${methodLabel(mine!.what_helped)})` : ""} with your partner?
                      This does not mean your partner agrees or feels repaired.
                    </Text>
                    <Pressable
                      style={[styles.primaryButton, busy && styles.disabled]}
                      disabled={busy}
                      accessibilityRole="button"
                      onPress={() => void execute(
                        () => shareMyRepairState(eventId, mine!.report_version),
                        "Your update was shared with your partner.",
                      )}
                    >
                      <Text style={styles.primaryLabel}>Confirm sharing</Text>
                    </Pressable>
                    <Pressable style={styles.outlineButton} disabled={busy} onPress={() => setConfirmShare(false)}>
                      <Text style={styles.buttonLabel}>Cancel</Text>
                    </Pressable>
                  </View>
                )
              ) : null}
            </View>
          )}
        </>
      )}

      {visibility === "ours" && !loading && !error && (
        <View style={styles.partnerSection}>
          <Text style={styles.subheading}>Your partner's shared update</Text>
          {partner ? (
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>{statusLabel(partner.repair_status)}</Text>
              {partner.what_helped && (
                <Text style={styles.summarySecondary}>What helped them: {methodLabel(partner.what_helped)}</Text>
              )}
              <Text style={styles.helper}>This is your partner's reported experience, not a joint conclusion.</Text>
            </View>
          ) : (
            <Text style={styles.helper}>No repair update has been shared with you.</Text>
          )}
        </View>
      )}

      {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
      {!!notice && <Text style={styles.notice}>{notice}</Text>}
      <Pressable style={styles.refreshButton} accessibilityRole="button" onPress={() => void refresh()} disabled={busy || loading}>
        <Text style={styles.refreshLabel}>Refresh updates</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 28, padding: 18, backgroundColor: "#FAF7FC", borderRadius: 16, borderWidth: 1, borderColor: "#E8DCE9" },
  title: { fontSize: 20, fontWeight: "700", color: "#3D3040" },
  subheading: { fontSize: 15, fontWeight: "700", marginTop: 18, marginBottom: 9, color: "#3D3040" },
  helper: { fontSize: 13, lineHeight: 20, color: "#6D6072", marginTop: 7 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { borderRadius: 10, borderWidth: 1, borderColor: "#D8C8DC", backgroundColor: "#FFFFFF", paddingHorizontal: 11, paddingVertical: 10 },
  selected: { backgroundColor: "#6E416D", borderColor: "#6E416D" },
  choiceText: { fontSize: 13, color: "#6E416D", fontWeight: "600" },
  selectedText: { color: "#FFFFFF" },
  summary: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 13, marginTop: 10, borderWidth: 1, borderColor: "#E8DCE9" },
  summaryTitle: { fontSize: 15, fontWeight: "700", color: "#3D3040" },
  summarySecondary: { fontSize: 13, color: "#6D6072", marginTop: 5 },
  legacyNote: { fontSize: 13, marginTop: 9, color: "#8B4A34", lineHeight: 19 },
  primaryButton: { marginTop: 14, backgroundColor: "#6E416D", borderRadius: 11, padding: 13, alignItems: "center" },
  primaryLabel: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  outlineButton: { borderRadius: 11, borderWidth: 1, borderColor: "#6E416D", padding: 12, marginTop: 11, alignItems: "center" },
  buttonLabel: { color: "#6E416D", fontWeight: "700", fontSize: 14, textAlign: "center" },
  disabled: { opacity: 0.55 },
  shareSection: { marginTop: 14, borderTopWidth: 1, borderTopColor: "#E8DCE9", paddingTop: 5 },
  partnerSection: { marginTop: 19, borderTopWidth: 1, borderTopColor: "#E8DCE9", paddingTop: 8 },
  confirm: { marginTop: 8 },
  notice: { color: "#226F57", fontSize: 13, marginTop: 14 },
  error: { color: "#A33C43", fontSize: 13, marginTop: 14 },
  refreshButton: { alignSelf: "flex-start", marginTop: 12, padding: 6 },
  refreshLabel: { color: "#6E416D", fontSize: 13, textDecorationLine: "underline" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
});
