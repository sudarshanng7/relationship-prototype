/**
 * ROS-03C Step 4B — individual repair updates for friction moments.
 *
 * Source of truth: public.event_repair_states. Reads use the typed client;
 * guarded RPC writes pin the identity validated by the parent view.
 * Never read or write relationship_events.status, repair_method or reconnected_at.
 * Database RLS controls which partner reports this caller can read.
 */
import { CouplySectionCard, CouplyStatusPill } from "@/components/CouplyUI";
import { tokens } from "@/components/couply-tokens";
import {
  isRepairSaveConflict,
  isRepairSharingRejection,
  isRepairWithdrawalConflict,
  loadEventRepairStates,
  saveMyRepairState,
  withdrawMyRepairState,
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

type RepairWrite = "share_my_repair_state";

const STATUSES: { value: RepairStatus; label: string }[] = [
  { value: "open", label: "Still unresolved" },
  { value: "partially_repaired", label: "A little better" },
  { value: "reconnected", label: "I feel reconnected" },
];

const IMPORTED_STATUS_LABELS: Record<RepairStatus, string> = {
  open: "Open", partially_repaired: "Partially repaired", reconnected: "Reconnected",
};

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
  const message = typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
    ? error.message
    : null;

  // Match only reviewed messages and return fixed UI copy. Never display raw
  // backend messages, details, or hints, including suffixes on known messages.
  switch (message) {
    case "Moment unavailable":
      return "Moment unavailable";
    case "Moment unavailable for sharing":
      return "Moment unavailable for sharing";
    case "Authentication required":
      return "Please sign in again.";
    case "Reload your repair update before saving.":
      return "Reload your repair update before saving.";
    case "Reload your repair update before sharing.":
    case "Please reload your repair update before sharing":
      return "Reload your repair update before sharing.";
    case "Repair update changed, was already shared, or needs confirmation; please reload":
      return "Your repair update changed or needs confirmation. Reload before sharing.";
    case "Reload your repair update before withdrawing.":
    case "Please reload your repair update before withdrawing":
      return "Reload your repair update before withdrawing.";
    case "The withdrawal returned no usable report version. Reload before trying again.":
      return "Your withdrawal could not be confirmed. Reload before trying again.";
    case "The save returned no usable report version. Reload before sharing.":
      return "Your saved update could not be confirmed. Reload before sharing.";
    default:
      return "Something went wrong. Please try again.";
  }
}

const SAVE_CONFLICT_NOTICE =
  "A newer repair report exists. Your choices are still here and were not saved or shared. Load the newer update before saving again; loading it will replace your unsaved choices.";

const WITHDRAW_CONFLICT_NOTICE =
  "Your repair report changed. Sharing was not withdrawn by this request. Your unsaved choices are still here. Load the newer update before confirming withdrawal again; loading it will replace your unsaved choices.";

type SharingAttempt = {
  kind: "share";
  version: number;
  status: RepairStatus;
  method: RepairMethod | null;
  saved: boolean;
  outcome: "unknown" | "confirmed" | "rejected";
  rejection?: string;
};

type PrivateSaveAttempt = {
  kind: "private-save";
  version: number;
  status: RepairStatus;
  method: RepairMethod | null;
};

type RepairAttempt = SharingAttempt | PrivateSaveAttempt;

const SHARING_SUCCESS = "Your update was saved and shared with your partner.";
const SHARING_UNKNOWN =
  "We couldn't confirm whether your update was shared. Please refresh to check its current sharing status.";
const SHARING_REFRESH_FAILED =
  "The current sharing status could not be verified. Please refresh to check it.";

// A read describes current state. Only this version/content match confirms that
// the intended update is currently shared; a newer report proves no history.
function matchesSharingAttempt(report: EventRepairState, attempt: SharingAttempt) {
  return report.status_origin === "explicit" &&
    report.repair_status === attempt.status &&
    report.what_helped === attempt.method &&
    report.report_version === attempt.version +
      (report.sharing_status === "shared" ? 1 : 0);
}

function sharingFeedback(attempt: SharingAttempt, report?: EventRepairState) {
  const saved = attempt.saved ? "Your update was saved. " : "";
  const current = report
    ? `Your current saved update is ${report.sharing_status === "shared"
      ? "shared with your partner" : "private"}.`
    : "";
  if (attempt.outcome === "confirmed") {
    return {
      notice: report && !(report.sharing_status === "shared" && matchesSharingAttempt(report, attempt))
        ? `Sharing was confirmed. ${!matchesSharingAttempt(report, attempt) ? "Your repair report changed. " : ""}${current}`
        : SHARING_SUCCESS,
      error: report ? "" : SHARING_REFRESH_FAILED,
    };
  }
  if (attempt.outcome === "rejected") {
    return {
      notice: current,
      error: `${saved}This sharing request was rejected. ${attempt.rejection}${report ? "" : ` ${SHARING_REFRESH_FAILED}`}`,
    };
  }
  if (!report) return { notice: "", error: `${saved}${SHARING_UNKNOWN}` };
  const changed = !matchesSharingAttempt(report, attempt);
  return {
    notice: `${saved}${changed ? "Your repair report changed. " : ""}${current}${changed && report.sharing_status === "shared"
      ? " This does not confirm whether the earlier update was shared." : ""}`,
    error: "",
  };
}

function matchesPrivateSave(report: EventRepairState, attempt: PrivateSaveAttempt) {
  return report.report_version === attempt.version &&
    report.sharing_status === "private" &&
    report.repair_status === attempt.status &&
    report.what_helped === attempt.method &&
    report.status_origin === "explicit";
}

function privateSaveFeedback(attempt: PrivateSaveAttempt, report?: EventRepairState) {
  return {
    // The acknowledgment describes this operation, never the report's history.
    notice: `Saved privately.${report
      ? ` ${matchesPrivateSave(report, attempt) ? "" : "Your repair report changed since this save. "}The latest refresh found your update ${report.sharing_status === "shared" ? "shared with your partner" : "private"}.`
      : ""}`,
    error: report ? "" : SHARING_REFRESH_FAILED,
  };
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
  const [reloadRequired, setReloadRequired] = useState(false);
  const [sharingUnverified, setSharingUnverified] = useState(false);
  const repairAttempt = useRef<RepairAttempt | null>(null);
  const requestId = useRef(0);
  const focusGeneration = useRef(0);
  const writeInFlight = useRef(false);

  useLayoutEffect(
    () => () => {
      requestId.current++;
      focusGeneration.current++;
    },
    [eventId, userId, visibility, authorize, isCurrent],
  );

  const refresh = useCallback(async ({ preserveDraft = false, afterWrite = false } = {}) => {
    // A retained button handler must not start a competing load during a write.
    if (writeInFlight.current && !afterWrite) return;
    const id = ++requestId.current;
    const valid = () => id === requestId.current && isCurrent();
    if (!valid()) return;
    setLoading(true);
    setError("");
    try {
      const token = await authorize();
      if (!valid()) return;
      if (!token) throw new Error("Authentication required");
      const loaded = await loadEventRepairStates(eventId, token);
      if (!valid()) return;
      const authorized = await authorize();
      if (!valid()) return;
      if (!authorized) throw new Error("Authentication required");
      if (loaded.some((record) => record.event_id !== eventId) ||
        loaded.filter((record) => record.user_id === userId).length > 1) {
        throw new Error("Unexpected repair report identity");
      }
      const records = loaded.filter((record) => record.user_id === userId ||
        (visibility === "ours" && record.sharing_status === "shared"));
      const mine = records.find((record) => record.user_id === userId);
      setRows(records);
      const attempt = repairAttempt.current;
      if (attempt) {
        const report = mine && Number.isSafeInteger(mine.report_version) &&
          mine.report_version >= attempt.version &&
          (mine.sharing_status === "private" || mine.sharing_status === "shared") &&
          (attempt.kind !== "private-save" || (
            mine.status_origin === "explicit" &&
            STATUSES.some((item) => item.value === mine.repair_status) &&
            METHODS.some((item) => item.value === mine.what_helped) &&
            (mine.report_version > attempt.version || matchesPrivateSave(mine, attempt))
          ))
          ? mine : undefined;
        const feedback = attempt.kind === "private-save"
          ? privateSaveFeedback(attempt, report) : sharingFeedback(attempt, report);
        setNotice(feedback.notice);
        setError(feedback.error);
        setSharingUnverified(!report);
        const matches = report && (attempt.kind === "private-save"
          ? matchesPrivateSave(report, attempt) : matchesSharingAttempt(report, attempt));
        setReloadRequired(!report || (preserveDraft && !matches));
        // No row is not evidence of privacy: deletion, revocation or hidden
        // membership may all leave an authenticated read without our report.
        if (!report) {
          if (attempt.kind === "private-save") setRows([]);
          return;
        }
        repairAttempt.current = null;
      } else {
        setNotice("");
        setReloadRequired(false);
        setSharingUnverified(false);
      }
      if (!preserveDraft) {
        // Imported history is not a current choice. Even selecting Open again
        // must be a deliberate action before a checked save confirms it.
        setDraftStatus(mine?.status_origin === "explicit" ? mine.repair_status : null);
        setDraftMethod(mine?.status_origin === "explicit" ? mine.what_helped : null);
      }
      setConfirmShare(false);
      setConfirmWithdraw(false);
    } catch (e) {
      if (valid()) {
        setRows([]);
        const attempt = repairAttempt.current;
        if (attempt) {
          const feedback = attempt.kind === "private-save"
            ? privateSaveFeedback(attempt) : sharingFeedback(attempt);
          setNotice(feedback.notice);
          setError(feedback.error);
          setSharingUnverified(true);
          setReloadRequired(true);
        } else {
          if (!preserveDraft) {
            setDraftStatus(null);
            setDraftMethod(null);
          }
          setError(errorText(e));
        }
      }
    } finally {
      if (valid()) setLoading(false);
    }
  }, [eventId, userId, visibility, authorize, isCurrent]);

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
      setReloadRequired(false);
      repairAttempt.current = null;
      setSharingUnverified(false);
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
    !reloadRequired &&
    draftStatus !== null &&
    (!mine || dirty || mine.status_origin !== "explicit");
  const canShare = Boolean(
    !reloadRequired &&
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
    if (!valid()) return false;
    if (!token) throw new Error("Authentication required");
    const { data, error } = await supabase
      .rpc(name, args)
      .setHeader("Authorization", `Bearer ${token}`);
    if (error) throw error;
    if (data !== true) throw new Error("Sharing response could not be confirmed");
    return valid();
  }

  async function saveRepairState(
    status: RepairStatus,
    method: RepairMethod | null,
    expectedVersion: number | null,
    valid: () => boolean,
  ): Promise<number | null> {
    const token = await authorize();
    if (!token || !valid()) return null;
    const version = await saveMyRepairState(
      eventId,
      status,
      method,
      expectedVersion,
      token,
    );
    return valid() ? version : null;
  }

  function showSaveError(error: unknown) {
    setConfirmShare(false);
    if (isRepairSaveConflict(error)) {
      setReloadRequired(true);
      setError(SAVE_CONFLICT_NOTICE);
    } else {
      setError(errorText(error));
    }
  }

  async function savePrivately() {
    if (
      !isCurrent() ||
      writeInFlight.current ||
      busy ||
      loading ||
      !canSave ||
      draftStatus === null
    )
      return;
    const generation = focusGeneration.current;
    const valid = () => isCurrent() && generation === focusGeneration.current;
    writeInFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const version = await saveRepairState(
        draftStatus,
        currentMethod,
        mine?.report_version ?? null,
        valid,
      );
      if (version === null) return;
      repairAttempt.current = {
        kind: "private-save", version, status: draftStatus, method: currentMethod,
      };
      setSharingUnverified(true);
      // Reconcile through the guarded read path. A failed or superseded read
      // must never be followed by an unconditional current-privacy assurance.
      await refresh({ preserveDraft: true, afterWrite: true });
    } catch (e) {
      // Keep both the draft and its loaded version; never retry against a newer
      // version without the user deliberately loading and reviewing that report.
      if (valid()) showSaveError(e);
    } finally {
      if (valid()) {
        writeInFlight.current = false;
        setBusy(false);
      }
    }
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

    // Share the version returned by this exact save, never a guessed or reloaded
    // version that could refer to a different device's report.
    const reviewedStatus = draftStatus;
    const reviewedMethod = currentMethod;
    const needsSave = canSave;
    let expectedVersion = mine?.report_version ?? null;
    let savedPrivately = false;

    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (needsSave) {
        expectedVersion = await saveRepairState(
          reviewedStatus,
          reviewedMethod,
          expectedVersion,
          valid,
        );
        if (expectedVersion === null) return;
        savedPrivately = true;
      }

      if (expectedVersion === null) return;
      const attempt: SharingAttempt = {
        kind: "share",
        version: expectedVersion,
        status: reviewedStatus,
        method: reviewedMethod,
        saved: savedPrivately,
        outcome: "unknown",
      };
      repairAttempt.current = attempt;
      setSharingUnverified(true);
      setConfirmShare(false);

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
      attempt.outcome = "confirmed";
      setNotice(SHARING_SUCCESS);
      await refresh({ preserveDraft: true, afterWrite: true });
    } catch (e) {
      if (!valid()) return;
      if (needsSave && !savedPrivately) {
        showSaveError(e);
        return;
      }
      const attempt = repairAttempt.current;
      if (!attempt || attempt.kind !== "share") return;
      if (isRepairSharingRejection(e)) {
        attempt.outcome = "rejected";
        attempt.rejection = errorText(e);
      }
      // Read only: a transport error can hide a committed transaction. Never
      // resubmit sharing or replace the author's choices during reconciliation.
      await refresh({ preserveDraft: true, afterWrite: true });
    } finally {
      if (valid()) {
        writeInFlight.current = false;
        setBusy(false);
      }
    }
  }

  async function withdraw() {
    if (
      !isCurrent() ||
      writeInFlight.current ||
      busy ||
      loading ||
      reloadRequired ||
      !mine ||
      !confirmWithdraw
    )
      return;
    const generation = focusGeneration.current;
    const valid = () => isCurrent() && generation === focusGeneration.current;
    const expectedVersion = mine.report_version;
    writeInFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const token = await authorize();
      if (!token || !valid()) return;
      await withdrawMyRepairState(eventId, expectedVersion, token);
      if (!valid()) return;
      setConfirmWithdraw(false);
      await refresh({ afterWrite: true });
      if (valid()) setNotice("Withdrawal recorded; your personal record remains.");
    } catch (e) {
      if (!valid()) return;
      setConfirmWithdraw(false);
      setConfirmShare(false);
      if (isRepairWithdrawalConflict(e)) {
        // Keep the loaded version and draft; never fetch/retry a newer version
        // until the author deliberately reloads and confirms a new withdrawal.
        setReloadRequired(true);
        setError(WITHDRAW_CONFLICT_NOTICE);
      } else {
        const message = errorText(e);
        if (message === "Moment unavailable" || message === "Please sign in again.") {
          // Purge inaccessible rows using the existing authorized read path.
          await refresh({ afterWrite: true });
        } else {
          // A transport or malformed-response failure can hide a committed write.
          // Preserve choices, but require reconciliation before another write.
          setReloadRequired(true);
        }
        if (valid()) setError(message);
      }
    } finally {
      if (valid()) {
        writeInFlight.current = false;
        setBusy(false);
      }
    }
  }

  return (
    <CouplySectionCard style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>Your repair update</Text>
      <Text style={styles.helper}>
        Your experience belongs to you. Choose to save privately or explicitly
        share your update with your partner.
      </Text>

      {loading ? (
        <CouplySectionCard variant="muted" style={styles.loadingRow}>
          <ActivityIndicator size="small" color={tokens.colors.plum} />
          <Text accessibilityLiveRegion="polite" style={styles.helper}>Loading personal updates…</Text>
        </CouplySectionCard>
      ) : error && !mine && draftStatus === null ? (
        <Pressable
          onPress={() => void refresh()}
          style={styles.outlineButton}
          accessibilityRole="button"
          accessibilityLabel="Could not load updates. Tap to retry."
        >
          <Text style={styles.buttonLabel}>
            Could not load updates. Tap to retry.
          </Text>
        </Pressable>
      ) : (
        <>
          {mine ? (
            <CouplySectionCard variant="lilac" style={styles.summary}>
              <Text style={styles.summaryTitle}>
                {mine.status_origin === "legacy_default_unconfirmed"
                  ? `Imported status: ${IMPORTED_STATUS_LABELS[mine.repair_status]} — not confirmed by you`
                  : mine.status_origin === "legacy_creator_report"
                    ? `Earlier report: ${statusLabel(mine.repair_status)}`
                    : `${reloadRequired ? "Last loaded for you" : "Saved for you"}: ${statusLabel(mine.repair_status)}`}
              </Text>
              <CouplyStatusPill
                label={sharingUnverified
                  ? "Sharing status needs verification"
                  : mine.sharing_status === "shared"
                  ? "Shared with your partner"
                  : "Private — not shared"}
                style={styles.sharingBadge}
              />
              {mine.what_helped && mine.status_origin !== "legacy_default_unconfirmed" && (
                <Text style={styles.summarySecondary}>
                  {mine.status_origin === "legacy_creator_report" ? "What helped in that report" : "What helped"}: {methodLabel(mine.what_helped)}
                </Text>
              )}
              {mine.status_origin === "legacy_default_unconfirmed" && (
                <Text style={styles.legacyNote}>
                  This status came from an earlier version and may have been set
                  automatically. Choose how you feel now to record your own update.
                </Text>
              )}
              {mine.status_origin === "legacy_creator_report" && (
                <Text style={styles.legacyNote}>
                  This is a preserved report from an earlier version. Choose how
                  you feel now before saving a current update.
                </Text>
              )}
            </CouplySectionCard>
          ) : (
            <Text style={styles.helper}>
              {sharingUnverified
                ? "Sharing status needs verification. Your choices are still here."
                : reloadRequired
                ? "Your newer saved report has not been loaded here yet."
                : "You haven't recorded a personal repair update yet."}
            </Text>
          )}

          <Text accessibilityRole="header" style={styles.subheading}>How does this feel now?</Text>
          <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel="How does this feel now?">
            {STATUSES.map((item) => (
              <Pressable
                key={item.value}
                accessibilityRole="radio"
                accessibilityLabel={item.label}
                accessibilityState={{
                  checked: draftStatus === item.value,
                  disabled: busy,
                }}
                disabled={busy}
                style={[
                  styles.choice,
                  draftStatus === item.value && styles.selected,
                  busy && styles.disabled,
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
              <Text accessibilityRole="header" style={styles.subheading}>What helped? (optional)</Text>
              <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel="What helped? (optional)">
                {METHODS.map((item) => (
                  <Pressable
                    key={item.value ?? "none"}
                    accessibilityRole="radio"
                    accessibilityLabel={item.label}
                    accessibilityState={{
                      checked: draftMethod === item.value,
                      disabled: busy,
                    }}
                    disabled={busy}
                    style={[
                      styles.choice,
                      draftMethod === item.value && styles.selected,
                      busy && styles.disabled,
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
          {(canSave || (mine && mine.status_origin !== "explicit" && draftStatus === null)) && (
            <Pressable
              style={[styles.primaryButton, (busy || !canSave) && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel="Save privately"
              accessibilityState={{ disabled: busy || !canSave }}
              disabled={busy || !canSave}
              onPress={() => void savePrivately()}
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
                accessibilityLabel={canSave ? "Save & share with partner" : "Share saved update"}
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={() => setConfirmShare(true)}
              >
                <Text style={styles.buttonLabel}>
                  {canSave ? "Save & share with partner" : "Share saved update"}
                </Text>
              </Pressable>
            ) : (
              <CouplySectionCard variant="muted" style={styles.confirm}>
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
                  accessibilityLabel="Confirm save & share"
                  accessibilityState={{ disabled: busy }}
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
                  accessibilityLabel="Cancel sharing"
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  onPress={() => setConfirmShare(false)}
                >
                  <Text style={styles.buttonLabel}>Cancel</Text>
                </Pressable>
              </CouplySectionCard>
            ))}

          {!reloadRequired && visibility === "ours" && mine?.sharing_status === "shared" && (
            <View style={styles.shareSection}>
              <Text accessibilityRole="header" style={styles.subheading}>Sharing your update</Text>
              <Text style={styles.helper}>
                Your current saved update is visible to your partner.
              </Text>
              {!confirmWithdraw ? (
                <Pressable
                  style={[styles.outlineButton, busy && styles.disabled]}
                  accessibilityRole="button"
                  accessibilityLabel="Withdraw shared update"
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  onPress={() => setConfirmWithdraw(true)}
                >
                  <Text style={styles.buttonLabel}>Withdraw shared update</Text>
                </Pressable>
              ) : (
                <CouplySectionCard variant="muted" style={styles.confirm}>
                  <Text style={styles.helper}>
                    Withdraw sharing? Your private record will remain, but your
                    partner will no longer be able to fetch it.
                  </Text>
                  <Pressable
                    style={[styles.primaryButton, busy && styles.disabled]}
                    accessibilityRole="button"
                    accessibilityLabel="Confirm withdrawal"
                    accessibilityState={{ disabled: busy }}
                    disabled={busy}
                    onPress={() => void withdraw()}
                  >
                    <Text style={styles.primaryLabel}>Confirm withdrawal</Text>
                  </Pressable>
                  <Pressable
                    style={styles.outlineButton}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel withdrawal"
                    accessibilityState={{ disabled: busy }}
                    disabled={busy}
                    onPress={() => setConfirmWithdraw(false)}
                  >
                    <Text style={styles.buttonLabel}>Cancel</Text>
                  </Pressable>
                </CouplySectionCard>
              )}
            </View>
          )}
        </>
      )}

      {visibility === "ours" && !loading && !error && (
        <CouplySectionCard variant="blush" style={styles.partnerSection}>
          <Text accessibilityRole="header" style={styles.partnerTitle}>Your partner&apos;s shared update</Text>
          {partner ? (
            <CouplySectionCard style={styles.summary}>
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
            </CouplySectionCard>
          ) : (
            <Text style={styles.helper}>
              No repair update has been shared with you.
            </Text>
          )}
        </CouplySectionCard>
      )}

      {!!error && (
        <CouplySectionCard variant="muted" style={styles.feedback}>
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        </CouplySectionCard>
      )}
      {!!notice && (
        <CouplySectionCard variant="muted" style={styles.feedback}>
          <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>
        </CouplySectionCard>
      )}
      <Pressable
        style={styles.refreshButton}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy || loading }}
        onPress={() => void refresh()}
        disabled={busy || loading}
      >
        <Text style={styles.refreshLabel}>
          {sharingUnverified
            ? "Refresh sharing status (replaces your choices)"
            : reloadRequired
            ? "Load newer update (replaces your choices)"
            : "Refresh updates"}
        </Text>
      </Pressable>
    </CouplySectionCard>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: tokens.spacing.xl },
  title: { color: tokens.colors.text, fontSize: tokens.typeScale.sectionTitle, fontWeight: "700" },
  subheading: { color: tokens.colors.text, fontSize: tokens.typeScale.bodyLarge, fontWeight: "700", marginTop: tokens.spacing.lg, marginBottom: tokens.spacing.sm },
  helper: { color: tokens.colors.textSecondary, fontSize: tokens.typeScale.body, lineHeight: 20, marginTop: tokens.spacing.sm },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.sm },
  choice: { minHeight: tokens.layout.minTouchTarget, maxWidth: "100%", flexShrink: 1, borderRadius: tokens.radii.small, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surface, paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, alignItems: "center", justifyContent: "center" },
  selected: { backgroundColor: tokens.colors.plum, borderColor: tokens.colors.plum },
  choiceText: { color: tokens.colors.plum, fontSize: tokens.typeScale.bodyLarge, fontWeight: "600", textAlign: "center" },
  selectedText: { color: tokens.colors.surface },
  summary: { marginTop: tokens.spacing.md },
  summaryTitle: { color: tokens.colors.text, fontSize: tokens.typeScale.bodyLarge, fontWeight: "700", lineHeight: 22 },
  summarySecondary: { color: tokens.colors.textSecondary, fontSize: tokens.typeScale.body, marginTop: tokens.spacing.sm, lineHeight: 20 },
  sharingBadge: { marginTop: tokens.spacing.sm },
  legacyNote: { color: tokens.colors.celebrationText, fontSize: tokens.typeScale.body, marginTop: tokens.spacing.sm, lineHeight: 20 },
  primaryButton: { minHeight: tokens.layout.minTouchTarget, marginTop: tokens.spacing.md, backgroundColor: tokens.colors.plum, borderRadius: tokens.radii.small, padding: tokens.spacing.md, alignItems: "center", justifyContent: "center" },
  primaryLabel: { color: tokens.colors.surface, fontSize: tokens.typeScale.bodyLarge, fontWeight: "700", textAlign: "center" },
  outlineButton: { minHeight: tokens.layout.minTouchTarget, borderRadius: tokens.radii.small, borderWidth: 1, borderColor: tokens.colors.plum, padding: tokens.spacing.md, marginTop: tokens.spacing.md, alignItems: "center", justifyContent: "center" },
  buttonLabel: { color: tokens.colors.plum, fontSize: tokens.typeScale.bodyLarge, fontWeight: "700", textAlign: "center" },
  disabled: { opacity: 0.55 },
  shareSection: { marginTop: tokens.spacing.md, borderTopWidth: 1, borderTopColor: tokens.colors.borderSoft, paddingTop: tokens.spacing.xs },
  partnerSection: { marginTop: tokens.spacing.xl },
  partnerTitle: { color: tokens.colors.text, fontSize: tokens.typeScale.bodyLarge, fontWeight: "700" },
  confirm: { marginTop: tokens.spacing.md },
  feedback: { marginTop: tokens.spacing.md },
  error: { color: tokens.colors.dangerText, fontSize: tokens.typeScale.body, lineHeight: 20 },
  notice: { color: tokens.colors.plum, fontSize: tokens.typeScale.body, lineHeight: 20 },
  refreshButton: { minHeight: tokens.layout.minTouchTarget, marginTop: tokens.spacing.md, paddingVertical: tokens.spacing.sm, paddingHorizontal: tokens.spacing.sm, alignItems: "center", justifyContent: "center" },
  refreshLabel: { color: tokens.colors.plum, fontSize: tokens.typeScale.body, fontWeight: "600", textAlign: "center" },
  loadingRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: tokens.spacing.sm, marginTop: tokens.spacing.md },
});
