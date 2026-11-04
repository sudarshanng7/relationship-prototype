/**
 * ROS-03C — typed client for independent, private-by-default repair states.
 *
 * This module does not replace the legacy UI by itself. Do not treat
 * relationship_events.status as an independent repair state.
 *
 * Reads are constrained by database RLS. A returned row may be the caller's
 * own state, or a different participant's deliberately shared state.
 */
import { supabase } from "@/lib/supabase";

export type RepairStatus = "open" | "partially_repaired" | "reconnected";

export type RepairMethod =
  | "talking"
  | "space"
  | "apology"
  | "affection"
  | "humour"
  | "practical_action"
  | "time"
  | "other";

export type RepairSharingStatus = "private" | "shared";

export type RepairStatusOrigin =
  | "explicit"
  | "legacy_creator_report"
  | "legacy_default_unconfirmed";

export type EventRepairState = {
  event_id: string;
  user_id: string;
  repair_status: RepairStatus;
  what_helped: RepairMethod | null;
  sharing_status: RepairSharingStatus;
  shared_at: string | null;
  reported_at: string | null;
  status_origin: RepairStatusOrigin;
  report_version: number;
  created_at: string;
  updated_at: string;
};

const REPAIR_SELECT =
  "event_id, user_id, repair_status, what_helped, sharing_status, shared_at, reported_at, status_origin, report_version, created_at, updated_at";

/** Returns only rows that RLS permits this signed-in caller to read. */
export async function loadEventRepairStates(
  eventId: string,
): Promise<EventRepairState[]> {
  const { data, error } = await supabase
    .from("event_repair_states")
    .select(REPAIR_SELECT)
    .eq("event_id", eventId);

  if (error) throw error;
  return (data ?? []) as EventRepairState[];
}

const SAVE_CONFLICT_MESSAGE = "Repair update changed; reload before saving";
const WITHDRAW_CONFLICT_MESSAGE = "Repair update changed; reload before withdrawing";

export function isRepairWithdrawalConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    error.message === WITHDRAW_CONFLICT_MESSAGE
  );
}

/** PostgREST errors are plain objects, rather than Error instances. */
export function isRepairSaveConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    error.message === SAVE_CONFLICT_MESSAGE
  );
}

/**
 * Saves only the caller's reviewed version and returns the actual new version.
 * Pass null only when the last load found no report. Saving returns it to private.
 * An optional token pins requests from identity-guarded views to their author.
 */
export async function saveMyRepairState(
  eventId: string,
  status: RepairStatus,
  whatHelped: RepairMethod | null,
  expectedReportVersion: number | null,
  accessToken?: string,
): Promise<number> {
  if (
    expectedReportVersion !== null &&
    (!Number.isSafeInteger(expectedReportVersion) || expectedReportVersion < 1)
  ) {
    throw new Error("Reload your repair update before saving.");
  }
  const request = supabase.rpc("save_my_repair_state_checked", {
    p_event_id: eventId,
    p_repair_status: status,
    p_what_helped: whatHelped,
    p_expected_report_version: expectedReportVersion,
  });
  if (accessToken) request.setHeader("Authorization", `Bearer ${accessToken}`);
  const { data, error } = await request;
  if (error) throw error;
  if (typeof data !== "number" || !Number.isSafeInteger(data) || data < 1) {
    throw new Error(
      "The save returned no usable report version. Reload before sharing.",
    );
  }
  return data;
}

/** Shares exactly the report version the caller reviewed in the UI. */
export async function shareMyRepairState(
  eventId: string,
  expectedReportVersion: number,
): Promise<void> {
  if (!Number.isSafeInteger(expectedReportVersion) || expectedReportVersion < 1) {
    throw new Error("Reload your repair update before sharing.");
  }
  const { error } = await supabase.rpc("share_my_repair_state", {
    p_event_id: eventId,
    p_expected_report_version: expectedReportVersion,
  });
  if (error) throw error;
}

/** Keeps the reviewed report private and invalidates shares of that version. */
export async function withdrawMyRepairState(
  eventId: string,
  expectedReportVersion: number,
  accessToken: string,
): Promise<number> {
  if (!Number.isSafeInteger(expectedReportVersion) || expectedReportVersion < 1) {
    throw new Error("Reload your repair update before withdrawing.");
  }
  if (!accessToken) throw new Error("Authentication required");
  const { data, error } = await supabase
    .rpc("withdraw_my_repair_state_checked", {
      p_event_id: eventId,
      p_expected_report_version: expectedReportVersion,
    })
    .setHeader("Authorization", `Bearer ${accessToken}`);
  if (error) throw error;
  if (
    typeof data !== "number" ||
    !Number.isSafeInteger(data) ||
    data !== expectedReportVersion + 1
  ) {
    throw new Error(
      "The withdrawal returned no usable report version. Reload before trying again.",
    );
  }
  return data;
}
