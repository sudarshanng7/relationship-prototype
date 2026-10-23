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

/** Saves the caller's report and automatically returns it to private. */
export async function saveMyRepairState(
  eventId: string,
  status: RepairStatus,
  whatHelped: RepairMethod | null = null,
): Promise<void> {
  const { error } = await supabase.rpc("save_my_repair_state", {
    p_event_id: eventId,
    p_repair_status: status,
    p_what_helped: whatHelped,
  });
  if (error) throw error;
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

/** Withdraws the caller's shared report while preserving the private record. */
export async function withdrawMyRepairState(
  eventId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("withdraw_my_repair_state", {
    p_event_id: eventId,
  });
  if (error) throw error;
  return data === true;
}
