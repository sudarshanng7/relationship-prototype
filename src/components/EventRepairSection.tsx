/**
 * ROS-03C Step 4B — individual repair updates for friction moments.
 *
 * Source of truth: public.event_repair_states. Reads use the typed client;
 * guarded RPC writes pin the identity validated by the parent view.
 * Never read or write relationship_events.status, repair_method or reconnected_at.
 * Database RLS controls which partner reports this caller can read.
 */
import {
  loadEventRepairStates,
  type EventRepairState,
  type RepairMethod,
  type RepairStatus,
} from "@/lib/repair-states";
import { supabase } from "@/lib/supabase";
import { useFocusEffect } from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  authorize: () => Promise<string | null>;
  isCurrent: () => boolean;
};

type RepairWrite =
  | "save_my_repair_state"
  | "share_my_repair_state"
  | "withdraw_my_repair_state";

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
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

export function EventRepairSection({
  eventId,
  userId,
  visibility,
  authorize,
  isCurrent,
}: Props) {
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
  const focusGeneration = useRef(0);
  const writeInFlight = useRef(false);

  useLayoutEffect(
    () => () => {
      requestId.current++;
      focusGeneration.current++;
    },
    [],
  );

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    const valid = () => id === requestId.current && isCurrent();
    if (!valid()) return;
    setLoading(true);
    setError("");
    try {
      if (!(await authorize()) || !valid()) return;
      const records = await loadEventRepairStates(eventId);
      if (!valid()) return;
      if (!(await authorize()) || !valid()) return;
      const mine = records.find((record) => record.user_id === userId);
      setRows(records);
      setDraftStatus(mine?.repair_status ?? null);
      setDraftMethod(mine?.what_helped ?? null);
      setConfirmShare(false);
      setConfirmWithdraw(false);
    } catch (e) {
      if (valid()) {
        setRows([]);
        setDraftStatus(null);
        setDraftMethod(null);
        setError(errorText(e));
      }
    } finally {
      if (valid()) setLoading(false);
    }
  }, [eventId, userId, authorize, isCurrent]);

  // Visibility changes restart the focused lifecycle even when refresh is stable.
  const focusContext = useMemo(
    () => ({ refresh, visibility }),
    [refresh, visibility],
  );

  // Always recheck membership, RLS and account identity when returning here.
  useFocusEffect(
    useCallback(() => {
      const { refresh } = focusContext;
      focusGeneration.current++;
      writeInFlight.current = false;
      setRows([]);
      setDraftStatus(null);
      setDraftMethod(null);
      setConfirmShare(false);
      setConfirmWithdraw(false);
      setBusy(false);
      setNotice("");
      setLoading(true);
      void refresh();
      return () => {
        requestId.current++;
        focusGeneration.current++;
      };
    }, [focusContext]),
  );

  const mine = rows.find((row) => row.user_id === userId);
  const partner =
    visibility === "ours"
      ? rows.find(
          (row) => row.user_id !== userId && row.sharing_status === "shared",
        )
      : undefined;
  const currentMethod = draftStatus === "open" ? null : draftMethod;
  const dirty = Boolean(
    mine &&
    (draftStatus !== mine.repair_status || currentMethod !== mine.what_helped),
  );
  const canSave =
    draftStatus !== null &&
    (!mine || dirty || mine.status_origin !== "explicit");
  const canShare = Boolean(
    visibility === "ours" &&
    mine &&
    mine.sharing_status === "private" &&
    mine.status_origin === "explicit" &&
    !dirty,
  );
  // A new or edited report can be saved privately OR saved and shared.
  // An existing, unchanged private report can be shared without saving again.
  const canSaveAndShare =
    visibility === "ours" && draftStatus !== null && (canSave || canShare);

  // Per-request Authorization keeps a delayed request bound to its author,
  // even if the shared Supabase client switches accounts before dispatch.
  async function writeRepairState(
    name: RepairWrite,
    args: Record<string, unknown>,
    valid: () => boolean,
  ) {
    if (name === "share_my_repair_state") {
      const version = args.p_expected_report_version;
      if (
        typeof version !== "number" ||
        !Number.isSafeInteger(version) ||
        version < 1
      ) {
        throw new Error("Reload your repair update before sharing.");
      }
    }
    const token = await authorize();
    if (!token || !valid()) return false;
    const { error } = await supabase
      .rpc(name, args)
      .setHeader("Authorization", `Bearer ${token}`);
    if (error) throw error;
    return valid();
  }

  async function saveAndShare() {
    if (
      !isCurrent() ||
      writeInFlight.current ||
      busy ||
      loading ||
      !canSaveAndShare ||
      draftStatus === null
    )
      return;
    const generation = focusGeneration.current;
    const valid = () => isCurrent() && generation === focusGeneration.current;
    writeInFlight.current = true;

    // Capture exactly the draft reviewed in the confirmation. The save RPC
    // increments report_version by one on both inserts and updates.
    // Never re-read a version after save and blindly share it: another device
    // might have edited the report between the requests.
    const reviewedStatus = draftStatus;
    const reviewedMethod = currentMethod;
    const needsSave = canSave;
    const expectedVersion = (mine?.report_version ?? 0) + (needsSave ? 1 : 0);
    let savedPrivately = false;

    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (needsSave) {
        if (
          !(await writeRepairState(
            "save_my_repair_state",
            {
              p_event_id: eventId,
              p_repair_status: reviewedStatus,
              p_what_helped: reviewedMethod,
            },
            valid,
          ))
        )
          return;
        savedPrivately = true;
      }

      // Server refuses to share a stale version, legacy/unconfirmed report,
      // a Mine event, or a report not owned by this authenticated caller.
      if (
        !(await writeRepairState(
          "share_my_repair_state",
          {
            p_event_id: eventId,
            p_expected_report_version: expectedVersion,
          },
          valid,
        ))
      )
        return;
      await refresh();
      if (valid())
        setNotice("Your update was saved and shared with your partner.");
    } catch (e) {
      if (!valid()) return;
      const detail = errorText(e);
      await refresh();
      if (!valid()) return;
      setError(
        savedPrivately
          ? `Your update was saved privately but was NOT shared. ${detail}`
          : `Your update was NOT shared. ${detail}`,
      );
    } finally {
      if (valid()) {
        writeInFlight.current = false;
        setBusy(false);
      }
    }
  }

  async function execute(
    name: RepairWrite,
    args: Record<string, unknown>,
    success: string,
  ) {
    if (!isCurrent() || writeInFlight.current || busy || loading) return;
    const generation = focusGeneration.current;
    const valid = () => isCurrent() && generation === focusGeneration.current;
    writeInFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!(await writeRepairState(name, args, valid))) return;
      await refresh();
      if (valid()) setNotice(success);
    } catch (e) {
      if (!valid()) return;
      const message = errorText(e);
      // Reload after a stale-version error rather than reusing the old value.
      await refresh();
      if (valid()) setError(message);
    } finally {
      if (valid()) {
        writeInFlight.current = false;
        setBusy(false);
      }
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Your repair update</Text>
      <Text style={styles.helper}>
        Your experience belongs to you. Choose to save privately or explicitly
        share your update with your partner.
      </Text>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#6E416D" />
          <Text style={styles.helper}>Loading personal updates…</Text>
        </View>
      ) : error && !mine && draftStatus === null ? (
        <Pressable
          onPress={() => void refresh()}
          style={styles.outlineButton}
          accessibilityRole="button"
        >
          <Text style={styles.buttonLabel}>
            Could not load updates. Tap to retry.
          </Text>
        </Pressable>
      ) : (
        <>
          {mine ? (
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>
                Saved for you: {statusLabel(mine.repair_status)}
              </Text>
              <Text style={styles.summarySecondary}>
                {mine.sharing_status === "shared"
                  ? "Shared with your partner"
                  : "Private — not shared"}
              </Text>
              {mine.what_helped && (
                <Text style={styles.summarySecondary}>
                  What helped: {methodLabel(mine.what_helped)}
                </Text>
              )}
              {mine.status_origin !== "explicit" && (
                <Text style={styles.legacyNote}>
                  This was imported from an earlier version. It may include an
                  automatic default. Review your selection before saving or
                  sharing. An imported Open value may be an automatic default.
                </Text>
              )}
            </View>
          ) : (
            <Text style={styles.helper}>
              You haven&apos;t recorded a personal repair update yet.
            </Text>
          )}

          <Text style={styles.subheading}>How does this feel now?</Text>
          <View style={styles.choices}>
            {STATUSES.map((item) => (
              <Pressable
                key={item.value}
                accessibilityRole="radio"
                accessibilityState={{
                  checked: draftStatus === item.value,
                  disabled: busy,
                }}
                disabled={busy}
                style={[
                  styles.choice,
                  draftStatus === item.value && styles.selected,
                ]}
                onPress={() => {
                  setDraftStatus(item.value);
                  if (item.value === "open") setDraftMethod(null);
                  setConfirmShare(false);
                }}
              >
                <Text
                  style={[
                    styles.choiceText,
                    draftStatus === item.value && styles.selectedText,
                  ]}
                >
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
                    accessibilityState={{
                      checked: draftMethod === item.value,
                      disabled: busy,
                    }}
                    disabled={busy}
                    style={[
                      styles.choice,
                      draftMethod === item.value && styles.selected,
                    ]}
                    onPress={() => {
                      setDraftMethod(item.value);
                      setConfirmShare(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        draftMethod === item.value && styles.selectedText,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {mine?.sharing_status === "shared" && canSave && (
            <Text style={styles.helper}>
              Saving privately withdraws your previous shared update. Save &amp;
              share replaces it with your new choice. Your partner may already
              have seen the earlier update.
            </Text>
          )}

          {/* Two clear choices at the moment of saving; sharing is NEVER the default. */}
          {canSave && (
            <Pressable
              style={[styles.primaryButton, busy && styles.disabled]}
              accessibilityRole="button"
              disabled={busy}
              onPress={() => {
                if (!draftStatus) return;
                void execute(
                  "save_my_repair_state",
                  {
                    p_event_id: eventId,
                    p_repair_status: draftStatus,
                    p_what_helped: currentMethod,
                  },
                  "Saved privately. It was not shared with your partner.",
                );
              }}
            >
              <Text style={styles.primaryLabel}>
                {busy ? "Saving…" : "Save privately"}
              </Text>
            </Pressable>
          )}

          {canSaveAndShare &&
            (!confirmShare ? (
              <Pressable
                style={[styles.outlineButton, busy && styles.disabled]}
                accessibilityRole="button"
                disabled={busy}
                onPress={() => setConfirmShare(true)}
              >
                <Text style={styles.buttonLabel}>
                  {canSave ? "Save & share with partner" : "Share saved update"}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.confirm}>
                <Text style={styles.helper}>
                  Share “{statusLabel(draftStatus!)}”
                  {currentMethod
                    ? ` (what helped: ${methodLabel(currentMethod)})`
                    : ""}{" "}
                  with your partner?
                  {mine?.status_origin !== "explicit"
                    ? " This confirms that your selected state reflects how you feel now, not just an old imported default."
                    : ""}{" "}
                  Your partner will be able to see this report. It does not
                  imply they agree or feel reconnected.
                </Text>
                <Pressable
                  style={[styles.primaryButton, busy && styles.disabled]}
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void saveAndShare()}
                >
                  <Text style={styles.primaryLabel}>
                    {busy ? "Working…" : "Confirm save & share"}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.outlineButton}
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => setConfirmShare(false)}
                >
                  <Text style={styles.buttonLabel}>Cancel</Text>
                </Pressable>
              </View>
            ))}

          {visibility === "ours" && mine?.sharing_status === "shared" && (
            <View style={styles.shareSection}>
              <Text style={styles.subheading}>Sharing your update</Text>
              <Text style={styles.helper}>
                Your current saved update is visible to your partner.
              </Text>
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
                    Withdraw sharing? Your private record will remain, but your
                    partner will no longer be able to fetch it.
                  </Text>
                  <Pressable
                    style={[styles.primaryButton, busy && styles.disabled]}
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() =>
                      void execute(
                        "withdraw_my_repair_state",
                        { p_event_id: eventId },
                        "Update withdrawn from sharing; your personal record remains.",
                      )
                    }
                  >
                    <Text style={styles.primaryLabel}>Confirm withdrawal</Text>
                  </Pressable>
                  <Pressable
                    style={styles.outlineButton}
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => setConfirmWithdraw(false)}
                  >
                    <Text style={styles.buttonLabel}>Cancel</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </>
      )}

      {visibility === "ours" && !loading && !error && (
        <View style={styles.partnerSection}>
          <Text style={styles.subheading}>Your partner&apos;s shared update</Text>
          {partner ? (
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>
                {statusLabel(partner.repair_status)}
              </Text>
              {partner.what_helped && (
                <Text style={styles.summarySecondary}>
                  What helped them: {methodLabel(partner.what_helped)}
                </Text>
              )}
              <Text style={styles.helper}>
                This is your partner&apos;s reported experience, not a joint
                conclusion.
              </Text>
            </View>
          ) : (
            <Text style={styles.helper}>
              No repair update has been shared with you.
            </Text>
          )}
        </View>
      )}

      {!!error && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
      {!!notice && <Text style={styles.notice}>{notice}</Text>}
      <Pressable
        style={styles.refreshButton}
        accessibilityRole="button"
        onPress={() => void refresh()}
        disabled={busy || loading}
      >
        <Text style={styles.refreshLabel}>Refresh updates</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 28,
    padding: 18,
    backgroundColor: "#FAF7FC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8DCE9",
  },
  title: { fontSize: 20, fontWeight: "700", color: "#3D3040" },
  subheading: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 9,
    color: "#3D3040",
  },
  helper: { fontSize: 13, lineHeight: 20, color: "#6D6072", marginTop: 7 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D8C8DC",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  selected: { backgroundColor: "#6E416D", borderColor: "#6E416D" },
  choiceText: { fontSize: 13, color: "#6E416D", fontWeight: "600" },
  selectedText: { color: "#FFFFFF" },
  summary: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 13,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E8DCE9",
  },
  summaryTitle: { fontSize: 15, fontWeight: "700", color: "#3D3040" },
  summarySecondary: { fontSize: 13, color: "#6D6072", marginTop: 5 },
  legacyNote: { fontSize: 13, marginTop: 9, color: "#8B4A34", lineHeight: 19 },
  primaryButton: {
    marginTop: 14,
    backgroundColor: "#6E416D",
    borderRadius: 11,
    padding: 13,
    alignItems: "center",
  },
  primaryLabel: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  outlineButton: {
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#6E416D",
    padding: 12,
    marginTop: 11,
    alignItems: "center",
  },
  buttonLabel: {
    color: "#6E416D",
    fontWeight: "700",
    fontSize: 14,
    textAlign: "center",
  },
  disabled: { opacity: 0.55 },
  shareSection: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#E8DCE9",
    paddingTop: 5,
  },
  partnerSection: {
    marginTop: 19,
    borderTopWidth: 1,
    borderTopColor: "#E8DCE9",
    paddingTop: 8,
  },
  confirm: { marginTop: 8 },
  notice: { color: "#226F57", fontSize: 13, marginTop: 14 },
  error: { color: "#A33C43", fontSize: 13, marginTop: 14 },
  refreshButton: { alignSelf: "flex-start", marginTop: 12, padding: 6 },
  refreshLabel: {
    color: "#6E416D",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
});
