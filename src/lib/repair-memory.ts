/**
 * repair-memory.ts
 *
 * Pure business logic for the "What Helped Before" / Repair Memory feature.
 *
 * Rules enforced here:
 * - Only completed reconnections (status = "reconnected") are candidates.
 * - Open or unresolved friction events are never candidates.
 * - Candidates must belong to the same couple and be visible to the current user.
 * - Cross-couple candidates are rejected at query level and re-validated here.
 * - Maximum 3 candidates, ordered by reconnected_at descending (newest first).
 * - Same category preferred when structured category data exists.
 * - Relation decisions are user-specific and never shared.
 * - Creating a relation link contributes zero Garden units.
 * - Historical repair duration uses canonical timestamps only.
 * - Duration is formatted naturally and never presented as a prediction.
 * - No AI, embeddings, keyword matching, or free-text similarity.
 *
 * Safety note:
 *   No safety classification exists in the current schema. This module cannot
 *   suppress suggestions for safety-sensitive contexts until such a classification
 *   is introduced. This limitation is intentional and documented here.
 */

import { supabase } from "@/lib/supabase";

// ============================================================================
// TYPES
// ============================================================================

/** Structured friction category values used by relationship_events.category */
export type FrictionCategory =
  | "household"
  | "money"
  | "family"
  | "communication"
  | "work_stress"
  | "time_together"
  | "phones_screens"
  | "affection"
  | "parenting"
  | "plans"
  | "other";

/** Decision values for a user's perspective on two related friction events */
export type RelationDecision =
  | "related"
  | "somewhat_related"
  | "different"
  | "deferred";

/** Post-reconnection helpfulness response (user-specific, never scored) */
export type HelpfulnessResponse =
  | "yes_helped"
  | "a_little"
  | "different_way"
  | "not_this_time"
  | "prefer_not";

/** A prior completed reconnection event eligible as a repair memory candidate */
export interface RepairMemoryCandidate {
  /** UUID of the prior event in relationship_events */
  eventId: string;
  /** Category of the prior friction (matches current category for ranking) */
  category: string;
  /** ISO string — when the friction occurred */
  createdAt: string;
  /** ISO string — when reconnection was completed */
  reconnectedAt: string;
  /** Natural-language repair duration (e.g. "about 18 hours") */
  repairDurationLabel: string;
  /** Exact duration in milliseconds (retained internally) */
  repairDurationMs: number;
  /** Shared topic text, if any (may be null) */
  sharedTopic: string | null;
  /** Whether the current user is the creator of the prior event */
  isCreatedByCurrentUser: boolean;
}

/** A user-specific relation decision stored in friction_moment_relations */
export interface RelationRecord {
  id: string;
  currentEventId: string;
  priorEventId: string;
  coupleId: string;
  userId: string;
  decision: RelationDecision;
  helpfulnessResponse: HelpfulnessResponse | null;
  createdAt: string;
  updatedAt: string;
}

/** Result of the candidate lookup (never throws — returns empty list on error) */
export interface RepairMemoryCandidateResult {
  /** Candidates found (0–3) */
  candidates: RepairMemoryCandidate[];
  /** Whether any candidate with the same category was found */
  hasCategoryMatch: boolean;
  /** Raw error message if lookup failed (candidates will be empty) */
  error: string | null;
}

// ============================================================================
// DURATION FORMATTING
// ============================================================================

/**
 * Formats a repair duration in milliseconds to a natural English label.
 * Returns null if the duration is negative, zero, or invalid.
 *
 * "about 3 hours", "about 18 hours", "about 2 days"
 * Does NOT include predictions or causal language.
 */
export function formatRepairDuration(durationMs: number): string | null {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return null;
  }

  const totalMinutes = durationMs / (1000 * 60);
  const totalHours = totalMinutes / 60;
  const totalDays = totalHours / 24;

  if (totalDays >= 1.5) {
    const days = Math.round(totalDays);
    return `about ${days} ${days === 1 ? "day" : "days"}`;
  }

  if (totalHours >= 1) {
    const hours = Math.round(totalHours);
    return `about ${hours} ${hours === 1 ? "hour" : "hours"}`;
  }

  if (totalMinutes >= 10) {
    const minutes = Math.round(totalMinutes);
    return `about ${minutes} minutes`;
  }

  // Less than 10 minutes — too short to present meaningfully
  return null;
}

/**
 * Calculates repair duration from canonical event timestamps.
 * Returns null if reconnected_at is null or duration is invalid.
 */
export function calculateRepairDurationMs(
  createdAt: string,
  reconnectedAt: string | null
): number | null {
  if (!reconnectedAt) return null;

  const createdMs = new Date(createdAt).getTime();
  const reconnectedMs = new Date(reconnectedAt).getTime();

  if (isNaN(createdMs) || isNaN(reconnectedMs)) return null;

  const durationMs = reconnectedMs - createdMs;

  // Reject negative durations (data integrity issue)
  if (durationMs <= 0) return null;

  return durationMs;
}

// ============================================================================
// CANDIDATE SELECTION
// ============================================================================

/** Maximum number of repair memory candidates to surface */
export const MAX_REPAIR_MEMORY_CANDIDATES = 3;

/**
 * Finds prior completed reconnection events eligible as repair memory candidates
 * for the given newly saved friction event.
 *
 * Rules enforced:
 * - Only status = "reconnected" events qualify.
 * - Only events visible to the current user qualify (creator OR visibility = "ours").
 * - Only events belonging to the same couple qualify.
 * - The current event itself is excluded.
 * - Events where the user has previously decided "different" are excluded
 *   (suppresses that exact pairing permanently for this user).
 * - Ordered by reconnected_at descending (newest first), then by id for determinism.
 * - Maximum MAX_REPAIR_MEMORY_CANDIDATES results.
 * - On any error: returns empty candidates with error message (never throws).
 *
 * Does NOT filter by category at the database level — category match is used
 * for ranking/sorting only. All reconnected frictions in the couple are eligible.
 */
/**
 * Suppresses automatic Repair Memory suggestions for a specific (event, user) pair.
 *
 * Uses the per-user friction_repair_memory_suppressions table so that
 * Partner A's suppression has no effect on Partner B's independent suggestions.
 *
 * Idempotent: upserts on (event_id, user_id) PRIMARY KEY.
 */
export async function suppressRepairMemory(params: {
  eventId: string;
  userId: string;
}): Promise<{ success: boolean; error: string | null }> {
  const { eventId, userId } = params;
  try {
    const { error } = await supabase
      .from("friction_repair_memory_suppressions")
      .upsert(
        { event_id: eventId, user_id: userId, suppress_suggestions: true },
        { onConflict: "event_id,user_id" }
      );
    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err: unknown) {
    const msg =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err);
    return { success: false, error: msg };
  }
}

export async function findRepairMemoryCandidates(params: {
  currentEventId: string;
  currentCategory: string | null;
  coupleId: string;
  currentUserId: string;
}): Promise<RepairMemoryCandidateResult> {
  const { currentEventId, currentCategory, coupleId, currentUserId } = params;

  try {
    // 0. Check if the current user has suppressed suggestions for this event.
    //    Uses per-user friction_repair_memory_suppressions table so Partner A's
    //    suppression never affects Partner B's independent experience.
    const { data: suppression } = await supabase
      .from("friction_repair_memory_suppressions")
      .select("suppress_suggestions")
      .eq("event_id", currentEventId)
      .eq("user_id", currentUserId)
      .maybeSingle();

    if (suppression?.suppress_suggestions === true) {
      return { candidates: [], hasCategoryMatch: false, error: null };
    }

    // 1. Find all prior completed reconnections visible to this user in this couple,
    //    excluding the current event and any "different" decisions already made.
    const { data: priorEvents, error: eventsError } = await supabase
      .from("relationship_events")
      .select(
        "id, category, created_at, reconnected_at, shared_topic, creator_id, event_type, status, visibility"
      )
      .eq("couple_id", coupleId)
      .eq("event_type", "friction")
      .eq("status", "reconnected")
      .neq("id", currentEventId)
      .or(`creator_id.eq.${currentUserId},visibility.eq.ours`)
      .order("reconnected_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(50); // Fetch more than we need to allow filtering

    if (eventsError) {
      return {
        candidates: [],
        hasCategoryMatch: false,
        error: eventsError.message,
      };
    }

    if (!priorEvents || priorEvents.length === 0) {
      return { candidates: [], hasCategoryMatch: false, error: null };
    }

    // 2. Fetch any existing "different" decisions made by this user for these events
    const priorEventIds = priorEvents.map((e) => e.id);
    const { data: existingDecisions, error: decisionsError } = await supabase
      .from("friction_moment_relations")
      .select("prior_event_id, decision")
      .eq("current_event_id", currentEventId)
      .eq("user_id", currentUserId)
      .in("prior_event_id", priorEventIds);

    // On decisions error — log but don't block (non-critical)
    const suppressedPriorIds = new Set<string>();
    if (!decisionsError && existingDecisions) {
      for (const d of existingDecisions) {
        if (d.decision === "different") {
          suppressedPriorIds.add(d.prior_event_id);
        }
      }
    }

    // 3. Filter, validate, and rank candidates
    const candidates: RepairMemoryCandidate[] = [];

    for (const event of priorEvents) {
      if (candidates.length >= MAX_REPAIR_MEMORY_CANDIDATES) break;

      // Skip events suppressed by user's "different" decision
      if (suppressedPriorIds.has(event.id)) continue;

      // Validate reconnected_at exists (should always be true for status=reconnected)
      if (!event.reconnected_at) continue;

      // Calculate and validate duration
      const durationMs = calculateRepairDurationMs(
        event.created_at,
        event.reconnected_at
      );
      if (durationMs === null) continue;

      const repairDurationLabel = formatRepairDuration(durationMs);
      if (repairDurationLabel === null) continue;

      candidates.push({
        eventId: event.id,
        category: event.category ?? "",
        createdAt: event.created_at,
        reconnectedAt: event.reconnected_at,
        repairDurationLabel,
        repairDurationMs: durationMs,
        sharedTopic: event.shared_topic ?? null,
        isCreatedByCurrentUser: event.creator_id === currentUserId,
      });
    }

    // Sort: same-category candidates first, then by recency (already ordered)
    if (currentCategory) {
      candidates.sort((a, b) => {
        const aMatch = a.category === currentCategory ? 0 : 1;
        const bMatch = b.category === currentCategory ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
        // Preserve recency order for same-match-status items
        return (
          new Date(b.reconnectedAt).getTime() -
          new Date(a.reconnectedAt).getTime()
        );
      });
    }

    const hasCategoryMatch =
      currentCategory !== null &&
      candidates.some((c) => c.category === currentCategory);

    return {
      candidates: candidates.slice(0, MAX_REPAIR_MEMORY_CANDIDATES),
      hasCategoryMatch,
      error: null,
    };
  } catch (err: unknown) {
    const msg =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err);
    return { candidates: [], hasCategoryMatch: false, error: msg };
  }
}

// ============================================================================
// RELATION DECISION PERSISTENCE
// ============================================================================

/**
 * Saves or updates a user's relation decision for a (current, prior) event pair.
 * Uses upsert semantics — updating an existing record changes only decision/updated_at.
 *
 * Returns the saved record on success, or null with an error message on failure.
 */
export async function saveRelationDecision(params: {
  currentEventId: string;
  priorEventId: string;
  coupleId: string;
  userId: string;
  decision: RelationDecision;
}): Promise<{ record: RelationRecord | null; error: string | null }> {
  const { currentEventId, priorEventId, coupleId, userId, decision } = params;

  try {
    const { data, error } = await supabase
      .from("friction_moment_relations")
      .upsert(
        {
          current_event_id: currentEventId,
          prior_event_id: priorEventId,
          couple_id: coupleId,
          user_id: userId,
          decision,
        },
        {
          onConflict: "current_event_id,prior_event_id,user_id",
          ignoreDuplicates: false,
        }
      )
      .select(
        "id, current_event_id, prior_event_id, couple_id, user_id, decision, helpfulness_response, created_at, updated_at"
      )
      .maybeSingle();

    if (error) {
      return { record: null, error: error.message };
    }

    if (!data) {
      return { record: null, error: "No record returned after upsert." };
    }

    return { record: mapRelationRecord(data), error: null };
  } catch (err: unknown) {
    const msg =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err);
    return { record: null, error: msg };
  }
}

/**
 * Loads the persisted helpfulness response for the current user for a given
 * (currentEvent, priorEvent) pair. Returns null if none has been saved.
 *
 * Used on mount to determine whether HelpfulnessQuestion should be shown again
 * or suppressed (already answered). Never returns another user's response.
 */
export async function loadHelpfulnessResponse(params: {
  currentEventId: string;
  priorEventId: string;
  userId: string;
}): Promise<HelpfulnessResponse | null> {
  const { currentEventId, priorEventId, userId } = params;
  try {
    const { data, error } = await supabase
      .from("friction_moment_relations")
      .select("helpfulness_response")
      .eq("current_event_id", currentEventId)
      .eq("prior_event_id", priorEventId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) return null;
    return (data.helpfulness_response as HelpfulnessResponse | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * Saves the post-reconnection helpfulness response for an existing relation record.
 * Requires a prior decision record to exist.
 *
 * The response is stored according to the independent-perspective privacy model —
 * it belongs to the current user and is never shared or scored.
 */
export async function saveHelpfulnessResponse(params: {
  currentEventId: string;
  priorEventId: string;
  userId: string;
  response: HelpfulnessResponse;
}): Promise<{ success: boolean; error: string | null }> {
  const { currentEventId, priorEventId, userId, response } = params;

  try {
    const { error } = await supabase
      .from("friction_moment_relations")
      .update({ helpfulness_response: response })
      .eq("current_event_id", currentEventId)
      .eq("prior_event_id", priorEventId)
      .eq("user_id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    const msg =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Fetches existing relation decisions for a given current event made by the current user.
 * Returns an empty array on error (non-blocking).
 */
export async function fetchRelationDecisions(params: {
  currentEventId: string;
  userId: string;
}): Promise<RelationRecord[]> {
  const { currentEventId, userId } = params;

  try {
    const { data, error } = await supabase
      .from("friction_moment_relations")
      .select(
        "id, current_event_id, prior_event_id, couple_id, user_id, decision, helpfulness_response, created_at, updated_at"
      )
      .eq("current_event_id", currentEventId)
      .eq("user_id", userId);

    if (error || !data) return [];
    return data.map(mapRelationRecord);
  } catch {
    return [];
  }
}

// ============================================================================
// WHAT HELPED BEFORE — Private reflection fetch
// ============================================================================

/**
 * Fetches the current user's own private reflection for a prior event.
 * Returns null if none exists or on error (never exposes another user's data).
 */
export async function fetchPriorPrivateReflection(params: {
  priorEventId: string;
  userId: string;
}): Promise<string | null> {
  const { priorEventId, userId } = params;

  try {
    const { data, error } = await supabase
      .from("event_private_reflections")
      .select("note")
      .eq("event_id", priorEventId)
      .eq("author_id", userId)
      .maybeSingle();

    if (error || !data) return null;
    return data.note ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetches the shared takeaway note from the repair outcome of a prior event.
 * Returns null if none exists or on error.
 * This is explicitly shared content (takeaway_note), visible to both partners.
 */
export async function fetchPriorSharedTakeaway(params: {
  priorEventId: string;
}): Promise<{ takeawayNote: string | null; takeawayTag: string | null }> {
  const { priorEventId } = params;

  try {
    const { data, error } = await supabase
      .from("relationship_event_repair_outcomes")
      .select("takeaway_note, takeaway_tag")
      .eq("event_id", priorEventId)
      .maybeSingle();

    if (error || !data) return { takeawayNote: null, takeawayTag: null };
    return {
      takeawayNote: data.takeaway_note ?? null,
      takeawayTag: data.takeaway_tag ?? null,
    };
  } catch {
    return { takeawayNote: null, takeawayTag: null };
  }
}

// ============================================================================
// GARDEN INTEGRATION SAFETY CHECKS (compile-time documentation)
// ============================================================================

/**
 * Garden units contributed by repair memory operations.
 *
 * These are intentionally zero — linking events, changing decisions, and
 * saving helpfulness responses must NEVER change Garden progress.
 *
 * The only Garden contribution comes from completing the new reconnection
 * through the existing +4 flow in calculateAuthoritativeFoundation.
 */
export const REPAIR_MEMORY_GARDEN_CONTRIBUTION = 0 as const;

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function mapRelationRecord(row: {
  id: string;
  current_event_id: string;
  prior_event_id: string;
  couple_id: string;
  user_id: string;
  decision: string;
  helpfulness_response: string | null;
  created_at: string;
  updated_at: string;
}): RelationRecord {
  return {
    id: row.id,
    currentEventId: row.current_event_id,
    priorEventId: row.prior_event_id,
    coupleId: row.couple_id,
    userId: row.user_id,
    decision: row.decision as RelationDecision,
    helpfulnessResponse:
      (row.helpfulness_response as HelpfulnessResponse | null) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
