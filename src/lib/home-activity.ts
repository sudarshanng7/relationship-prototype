/**
 * Authoritative activity and gentle-resurfacing selector for Home "What matters now".
 *
 * Requirements:
 * 1. Normalized candidate model with stable keys: `${kind}:${sourceId}:${occurredAt}`.
 * 2. Rolling 24-hour window for recent activities: `now - 24h <= occurredAt <= now`.
 * 3. Gentle resurfacing of older open shared friction moments (>= 72h, <= 14d, actionable,
 *    not snoozed, cooldown 24h, max 2 presentations / 7d).
 * 4. Deterministic priority order (1-4):
 *    - Priority 1: Unopened moment explicitly shared by partner (shared_friction [actionable], shared_positive [informational])
 *    - Priority 2: Partner response or repair action requiring acknowledgement (repair_response [actionable], repair_both_ready [actionable], reconnection_completed [informational])
 *    - Priority 3: Lower-priority shared activity (shared_list_added, shared_list_completed, important_date_added, self_shared_moment [informational])
 *    - Priority 4: Calm empty state ("Nothing needs your attention right now", empty)
 *    (Weekly reflection is maintained as a separate, standalone card and never enters What Matters Now; resurfaced moments never enter What Matters Now).
 * 5. Deterministic tie-breaking:
 *    - priority ascending
 *    - occurredAt descending (newest first)
 *    - candidate key ascending (localeCompare)
 * 6. Privacy: 'mine' moments and private reflections are strictly excluded.
 * 7. Seen / Read lifecycle:
 *    - Private per-user activity receipts tracked in home_activity_receipts.
 *    - Informational candidates excluded permanently once marked seen by that user.
 *    - Actionable candidates suppressed during opened cooldown (24h) and re-evaluated gently if incomplete.
 */

export interface HomeWeeklyPeriod {
  weekStart: string;
  weekEnd: string;
  weekKey: string;
}

export function getWeeklyReflectionPeriod(
  referenceDate?: Date | string | number,
): HomeWeeklyPeriod {
  const ref =
    referenceDate === undefined
      ? new Date()
      : referenceDate instanceof Date
      ? referenceDate
      : new Date(referenceDate);

  if (isNaN(ref.getTime())) {
    throw new Error("Invalid reference date");
  }

  const day = ref.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;

  const start = new Date(
    Date.UTC(
      ref.getUTCFullYear(),
      ref.getUTCMonth(),
      ref.getUTCDate() - daysSinceMonday,
      0,
      0,
      0,
      0,
    ),
  );

  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    weekStart: start.toISOString(),
    weekEnd: end.toISOString(),
    weekKey: start.toISOString().slice(0, 10),
  };
}

export const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
export const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
export const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export type HomeActivityKind =
  | "shared_friction"
  | "shared_positive"
  | "repair_response"
  | "repair_both_ready"
  | "reconnection_completed"
  | "shared_list_added"
  | "shared_list_completed"
  | "important_date_added"
  | "self_shared_moment"
  | "resurfaced_moment"
  | "reflection"
  | "empty";

export interface HomeActivityCandidate {
  key: string;
  kind: HomeActivityKind;
  sourceId: string;
  targetEventId?: string;
  coupleId: string;
  actorId: string | null;
  occurredAt: string;
  priority: number;
  actionable: boolean;
  attentionMode: "informational" | "actionable";
  route: string;
  title: string;
  body: string;
  actionLabel: string;
  overline?: string;
  icon?: string;
  isResurfaced?: boolean;
}

export interface HomeRelationshipEvent {
  id: string;
  couple_id?: string;
  creator_id: string;
  event_type: "friction" | "positive";
  category?: string | null;
  intensity?: number | null;
  visibility: "mine" | "ours";
  status: "open" | "partially_repaired" | "reconnected" | null;
  created_at: string;
  reconnected_at?: string | null;
}

export interface HomeRepairResponse {
  id: string;
  event_id: string;
  couple_id: string;
  user_id: string;
  phase: "arrival" | "settlement" | string;
  response_code: string;
  suggested_step_code?: string | null;
  shared_at: string;
  updated_at: string;
}

export interface HomeRepairOutcome {
  event_id: string;
  couple_id: string;
  completed_by: string;
  takeaway_tag?: string | null;
  takeaway_note?: string | null;
  completed_at: string;
  updated_at?: string;
}

export interface HomeCoupleTask {
  id: string;
  couple_id: string;
  created_by: string | null;
  title: string;
  category: string;
  status: "open" | "completed";
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HomeImportantDate {
  id: string;
  couple_id: string;
  label: string;
  event_date: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HomeAttentionState {
  event_id: string;
  couple_id: string;
  user_id: string;
  last_presented_at: string | null;
  snoozed_until: string | null;
  presentation_count: number;
  last_opened_at: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface HomeActivityReceipt {
  id?: string;
  couple_id: string;
  user_id: string;
  activity_key: string;
  activity_kind: HomeActivityKind | string;
  source_id: string;
  attention_mode: "informational" | "actionable";
  seen_at: string;
  created_at?: string;
  updated_at?: string;
}

export interface HomeWeeklyReflectionRecord {
  id?: string;
  userId?: string;
  weekStart?: string;
  weekEnd?: string;
  [key: string]: any;
}

export interface DeriveHomeActivityParams {
  events: HomeRelationshipEvent[];
  repairResponses?: HomeRepairResponse[];
  outcomes?: HomeRepairOutcome[];
  tasks?: HomeCoupleTask[];
  importantDates?: HomeImportantDate[];
  attentionStates?: HomeAttentionState[];
  receipts?: HomeActivityReceipt[];
  seenKeys?: Set<string>;
  nowMs: number;
  currentUserId: string | null;
  coupleId: string | null;
  partnerName?: string | null;
  isReflectionActive?: boolean;
  weeklyReflection?: HomeWeeklyReflectionRecord | null;
  isWeeklyReflectionDue?: boolean;
}

/**
 * Normalizes an ISO timestamp string to standard 8601 representation (e.g. .000Z),
 * avoiding mismatches between database return styles and client timestamps.
 */
export function normalizeIsoTimestamp(
  timeStr: string | null | undefined,
): string {
  if (!timeStr) return "";
  const ms = new Date(timeStr).getTime();
  if (isNaN(ms)) return String(timeStr).trim();
  return new Date(ms).toISOString();
}

/**
 * Normalizes a composite candidate key: `${kind}:${sourceId}:${normalizedIsoTimestamp}`.
 */
export function normalizeActivityKey(key: string): string {
  if (!key) return "";
  const trimmed = key.trim();
  const parts = trimmed.split(":");
  if (parts.length >= 3) {
    const kind = parts[0];
    const sourceId = parts[1];
    const rawTs = parts.slice(2).join(":");
    return `${kind}:${sourceId}:${normalizeIsoTimestamp(rawTs)}`;
  }
  return trimmed;
}

/**
 * Checks whether a timestamp is within the rolling 24-hour window:
 * `now - 24 hours <= occurredAt <= now`.
 * A 60-second forward tolerance is allowed for client-server clock skew.
 */
export function isWithinPast24Hours(
  timeStr: string | null | undefined,
  nowMs: number,
): boolean {
  if (!timeStr) return false;
  const ms = new Date(timeStr).getTime();
  if (isNaN(ms)) return false;
  const age = nowMs - ms;
  return age >= -60000 && age <= TWENTY_FOUR_HOURS_MS;
}

/**
 * Deterministically sorts candidates by:
 * 1. priority ascending (lowest number = highest priority)
 * 2. occurredAt descending (newest timestamp first)
 * 3. stable candidate key ascending (localeCompare tie-breaker)
 */
export function sortCandidates(
  candidates: HomeActivityCandidate[],
): HomeActivityCandidate[] {
  return [...candidates].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    const timeA = new Date(a.occurredAt).getTime();
    const timeB = new Date(b.occurredAt).getTime();
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return a.key.localeCompare(b.key);
  });
}

/**
 * Evaluates whether an older open friction moment qualifies for gentle resurfacing
 * and selects the top candidate if multiple qualify.
 */
export function deriveResurfacedCandidate(
  params: DeriveHomeActivityParams,
): HomeActivityCandidate | null {
  const {
    events,
    repairResponses = [],
    outcomes = [],
    attentionStates = [],
    receipts = [],
    seenKeys,
    nowMs,
    currentUserId,
    coupleId,
  } = params;

  if (!currentUserId) return null;

  // Build receipts lookup map for current user
  const receiptsMap = new Map<string, HomeActivityReceipt>();
  for (const r of receipts) {
    if (!currentUserId || r.user_id === currentUserId) {
      if (r.activity_key) {
        receiptsMap.set(normalizeActivityKey(r.activity_key), r);
      }
    }
  }
  if (seenKeys) {
    for (const key of seenKeys) {
      const normalized = normalizeActivityKey(key);
      if (!receiptsMap.has(normalized)) {
        receiptsMap.set(normalized, {
          couple_id: coupleId || "",
          user_id: currentUserId,
          activity_key: normalized,
          activity_kind: normalized.split(":")[0] || "resurfaced_moment",
          source_id: normalized.split(":")[1] || "",
          attention_mode: "actionable",
          seen_at: new Date(nowMs).toISOString(),
        });
      }
    }
  }

  // Filter strictly to shared friction moments
  const sharedFrictionEvents = events.filter(
    (e) => e.visibility === "ours" && e.event_type === "friction",
  );

  const outcomesByEventId = new Set<string>();
  for (const o of outcomes) {
    if (o.completed_at) {
      outcomesByEventId.add(o.event_id);
    }
  }

  const attentionByEventId = new Map<string, HomeAttentionState>();
  for (const att of attentionStates) {
    if (att.user_id === currentUserId) {
      attentionByEventId.set(att.event_id, att);
    }
  }

  interface QualifiedResurface {
    event: HomeRelationshipEvent;
    createdAtMs: number;
    lastPresentedMs: number | null;
    actionable: boolean;
  }

  const qualified: QualifiedResurface[] = [];

  for (const ev of sharedFrictionEvents) {
    // 1. Must not be reconnected or have repair outcome
    if (ev.status === "reconnected" || outcomesByEventId.has(ev.id)) {
      continue;
    }

    // 2. Age checks: at least 72h old, at most 14 days old
    const createdAtMs = new Date(ev.created_at).getTime();
    if (isNaN(createdAtMs)) continue;
    const ageMs = nowMs - createdAtMs;

    if (ageMs < SEVENTY_TWO_HOURS_MS) {
      // Too young for resurfacing (< 72h)
      continue;
    }
    if (ageMs > FOURTEEN_DAYS_MS) {
      // After 14 days, stop automatic Home resurfacing
      continue;
    }

    // 3. Inspect repair responses for this event
    const eventResponses = repairResponses.filter((r) => r.event_id === ev.id);

    // Rule: If either partner selected need_time, respect quiet period (no pressure)
    const hasNeedTime = eventResponses.some(
      (r) => r.response_code === "need_time",
    );
    if (hasNeedTime) {
      continue;
    }

    // Arrival response (submitted by recipient, i.e. user_id !== ev.creator_id)
    const arrival = eventResponses.find(
      (r) => r.phase === "arrival" && r.user_id !== ev.creator_id,
    );

    // Settlement responses
    const mySettlement = eventResponses.find(
      (r) => r.phase === "settlement" && r.user_id === currentUserId,
    );
    const partnerSettlement = eventResponses.find(
      (r) => r.phase === "settlement" && r.user_id !== currentUserId,
    );

    let isEligibleRole = false;

    if (!arrival) {
      // Case 1: No recipient arrival response
      // Recipient may be reminded; creator must NOT be reminded (creator is waiting)
      if (currentUserId !== ev.creator_id) {
        isEligibleRole = true;
      }
    } else {
      // Arrival response exists
      if (!mySettlement) {
        // Case 2 & 3: Current user owes settlement check-in
        isEligibleRole = true;
      } else if (!partnerSettlement) {
        // Current user already submitted settlement; partner has not.
        // Current user is merely waiting for partner -> do NOT remind current user!
        isEligibleRole = false;
      } else {
        // Both settlement responses exist
        const bothReady =
          mySettlement.response_code === "ready" &&
          partnerSettlement.response_code === "ready";
        if (bothReady) {
          // Case 5: Both ready -> only creator can complete reconnection
          if (currentUserId === ev.creator_id) {
            isEligibleRole = true;
          }
        }
      }
    }

    if (!isEligibleRole) {
      continue;
    }

    // 4. Attention state evaluation for current user
    const att = attentionByEventId.get(ev.id);
    if (att) {
      // Snooze check: explicit snooze takes precedence
      if (att.snoozed_until) {
        const snoozedUntilMs = new Date(att.snoozed_until).getTime();
        if (!isNaN(snoozedUntilMs)) {
          if (snoozedUntilMs > nowMs) {
            continue; // Active snooze
          }
          // Snooze expired -> explicit snooze overrides opened cooldown
        }
      } else {
        // If no explicit snooze, check opened cooldown (24 hours)
        if (att.last_opened_at) {
          const lastOpenedMs = new Date(att.last_opened_at).getTime();
          if (
            !isNaN(lastOpenedMs) &&
            nowMs - lastOpenedMs < TWENTY_FOUR_HOURS_MS
          ) {
            continue;
          }
        }
      }

      // Consecutive days check / Cooldown (24 hours)
      if (att.last_presented_at) {
        const lastPresentedMs = new Date(att.last_presented_at).getTime();
        if (
          !isNaN(lastPresentedMs) &&
          nowMs - lastPresentedMs < TWENTY_FOUR_HOURS_MS
        ) {
          continue;
        }
      }

      // Frequency limit: max 2 automatic presentations in rolling 7-day period
      if (att.presentation_count >= 2 && att.last_presented_at) {
        const lastPresentedMs = new Date(att.last_presented_at).getTime();
        if (!isNaN(lastPresentedMs) && nowMs - lastPresentedMs < SEVEN_DAYS_MS) {
          continue;
        }
      }
    }

    // Receipt-level opened cooldown (if no explicit snooze is set)
    const normalizedFrictionKey = normalizeActivityKey(
      `shared_friction:${ev.id}:${normalizeIsoTimestamp(ev.created_at)}`,
    );
    const normalizedResurfaceKey = normalizeActivityKey(
      `resurfaced_moment:${ev.id}:${normalizeIsoTimestamp(ev.created_at)}`,
    );
    const eventReceipt =
      receiptsMap.get(normalizedFrictionKey) ||
      receiptsMap.get(normalizedResurfaceKey);

    if (eventReceipt && (!att || !att.snoozed_until)) {
      const seenAtMs = new Date(eventReceipt.seen_at).getTime();
      if (!isNaN(seenAtMs) && nowMs - seenAtMs < TWENTY_FOUR_HOURS_MS) {
        continue;
      }
    }

    const lastPresentedMs = att?.last_presented_at
      ? new Date(att.last_presented_at).getTime()
      : null;

    qualified.push({
      event: ev,
      createdAtMs,
      lastPresentedMs: isNaN(lastPresentedMs ?? NaN) ? null : lastPresentedMs,
      actionable: true,
    });
  }

  if (qualified.length === 0) {
    return null;
  }

  // Rank multiple qualified old moments:
  // 1. Actionable over informational (all qualified are actionable)
  // 2. Least recently presented (null / never presented first, then oldest lastPresentedMs)
  // 3. Oldest next-action waiting time (oldest createdAtMs first)
  // 4. Event ID ascending as deterministic tie-breaker
  qualified.sort((a, b) => {
    // Least recently presented
    if (a.lastPresentedMs === null && b.lastPresentedMs !== null) return -1;
    if (a.lastPresentedMs !== null && b.lastPresentedMs === null) return 1;
    if (
      a.lastPresentedMs !== null &&
      b.lastPresentedMs !== null &&
      a.lastPresentedMs !== b.lastPresentedMs
    ) {
      return a.lastPresentedMs - b.lastPresentedMs;
    }

    // Oldest waiting time
    if (a.createdAtMs !== b.createdAtMs) {
      return a.createdAtMs - b.createdAtMs;
    }

    // Event ID ascending
    return a.event.id.localeCompare(b.event.id);
  });

  const selected = qualified[0].event;
  const occurredAt = normalizeIsoTimestamp(selected.created_at);

  return {
    key: `resurfaced_moment:${selected.id}:${occurredAt}`,
    kind: "resurfaced_moment",
    sourceId: selected.id,
    targetEventId: selected.id,
    coupleId: selected.couple_id || coupleId || "",
    actorId: null,
    occurredAt: selected.created_at,
    priority: 3,
    actionable: true,
    attentionMode: "actionable",
    route: `/event/${selected.id}?scope=ours`,
    overline: "A MOMENT RESTING IN OUR SPACE",
    title: "There is still room for this moment",
    body: "There is no rush. Return whenever it feels right, or give it a little more room.",
    actionLabel: "Return to the moment",
    isResurfaced: true,
  };
}

/**
 * Pure selector deriving the single authoritative "What matters now" tile candidate.
 * Canonical priority hierarchy:
 * - Priority 1: Unopened moment explicitly shared by partner (shared_friction [actionable], shared_positive [informational])
 * - Priority 2: Partner response or repair action requiring acknowledgement (repair_response [actionable], repair_both_ready [actionable], reconnection_completed [informational])
 * - Priority 3: Lower-priority shared activity (shared_list_added, shared_list_completed, important_date_added, self_shared_moment [informational])
 * - Priority 4: Quiet calm empty state (empty)
 *
 * Sorting rules:
 * 1. Lower numeric priority wins (Priority 1 > Priority 2 > Priority 3 > Priority 4).
 * 2. Within the same priority, newest occurredAt timestamp wins.
 * 3. If timestamps are identical, tie-break using stable candidate key ascending (localeCompare).
 *
 * Product constraints & non-backlog rules:
 * - Resurfaced moments never enter What Matters Now.
 * - Weekly reflection is excluded from What Matters Now and rendered only in its dedicated bottom tile.
 * - What Matters Now does NOT act as a backlog queue:
 *   - Each actionable stream (shared_friction, repair_response, repair_both_ready) selects its single newest eligible candidate before checking seen receipts.
 *   - Informational activity selects its single newest eligible candidate before checking seen receipts.
 *   - Opening an item suppresses that item and returns to the calm empty state rather than cycling through older unseen events from the same stream.
 *   - A separate unseen candidate from another priority stream may still appear.
 * - Historical moments remain untouched (status = 'open') and accessible through Moments / Our Space.
 * - "Reflect on today" is permanently decoupled as an independent secondary action on Home.
 */
export function deriveWhatMattersNowActivity(
  params: DeriveHomeActivityParams,
): HomeActivityCandidate {
  const {
    events,
    repairResponses = [],
    outcomes = [],
    tasks = [],
    importantDates = [],
    attentionStates = [],
    receipts = [],
    seenKeys,
    nowMs,
    currentUserId,
    coupleId,
    partnerName,
  } = params;

  const partnerLabel = partnerName?.trim() || "Your partner";
  const candidatesMap = new Map<string, HomeActivityCandidate>();

  // Build receipts lookup map strictly for current user
  const receiptsMap = new Map<string, HomeActivityReceipt>();
  if (receipts && Array.isArray(receipts)) {
    for (const r of receipts) {
      if (!currentUserId || r.user_id === currentUserId) {
        if (r.activity_key) {
          receiptsMap.set(normalizeActivityKey(r.activity_key), r);
        }
      }
    }
  }

  // Fold in any optimistic seen keys for the active session
  if (seenKeys) {
    for (const key of seenKeys) {
      const normalized = normalizeActivityKey(key);
      if (!receiptsMap.has(normalized)) {
        receiptsMap.set(normalized, {
          couple_id: coupleId || "",
          user_id: currentUserId || "",
          activity_key: normalized,
          activity_kind: normalized.split(":")[0] || "empty",
          source_id: normalized.split(":")[1] || "",
          attention_mode: "informational",
          seen_at: new Date(nowMs).toISOString(),
        });
      }
    }
  }

  // Filter strictly to shared moments ('ours'). Private moments ('mine') are strictly excluded.
  const sharedEvents = events.filter((e) => e.visibility === "ours");
  const eventsById = new Map<string, HomeRelationshipEvent>();
  for (const ev of sharedEvents) {
    eventsById.set(ev.id, ev);
  }

  const outcomesByEventId = new Map<string, HomeRepairOutcome>();
  for (const o of outcomes) {
    if (o.completed_at) {
      outcomesByEventId.set(o.event_id, o);
    }
  }

  const attentionByEventId = new Map<string, HomeAttentionState>();
  for (const att of attentionStates) {
    if (att.user_id === currentUserId) {
      attentionByEventId.set(att.event_id, att);
    }
  }

  // ==========================================================================
  // ACTIONABLE CANDIDATES (Tier 1 & Tier 2: Non-Backlog Selection)
  // ==========================================================================
  // Determine the newest relevant candidate within each actionable stream.
  // If the newest candidate has already been opened by the user, we do NOT
  // fall back to older unseen moments from the same backlog, preventing
  // inbox-style cycling through old unresolved moments while keeping genuinely
  // pending actions accessible in Moments / Our Space.

  // 1. Newly shared partner friction moment (Actionable, Priority 1)
  const rawSharedFrictionCandidates: HomeActivityCandidate[] = [];
  for (const ev of sharedEvents) {
    if (
      ev.event_type !== "friction" ||
      ev.status === "reconnected" ||
      outcomesByEventId.has(ev.id)
    ) {
      continue;
    }
    if (currentUserId && ev.creator_id === currentUserId) {
      continue;
    }

    if (isWithinPast24Hours(ev.created_at, nowMs)) {
      const normalizedTs = normalizeIsoTimestamp(ev.created_at);
      const key = `shared_friction:${ev.id}:${normalizedTs}`;

      rawSharedFrictionCandidates.push({
        key,
        kind: "shared_friction",
        sourceId: ev.id,
        targetEventId: ev.id,
        coupleId: ev.couple_id || coupleId || "",
        actorId: ev.creator_id,
        occurredAt: ev.created_at,
        priority: 1,
        actionable: true,
        attentionMode: "actionable",
        route: `/event/${ev.id}?scope=ours`,
        overline: "A SHARED MOMENT",
        title: `${partnerLabel} shared a moment`,
        body: "There is no rush. Take a look whenever you feel ready.",
        actionLabel: "Open when ready",
      });
    }
  }

  if (rawSharedFrictionCandidates.length > 0) {
    rawSharedFrictionCandidates.sort((a, b) => {
      const timeA = new Date(a.occurredAt).getTime();
      const timeB = new Date(b.occurredAt).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return a.key.localeCompare(b.key);
    });

    const newestFriction = rawSharedFrictionCandidates[0];
    const isFrictionSeen =
      receiptsMap.has(normalizeActivityKey(newestFriction.key)) ||
      Boolean(attentionByEventId.get(newestFriction.sourceId)?.last_opened_at);

    if (!isFrictionSeen) {
      candidatesMap.set(newestFriction.key, newestFriction);
    }
  }

  // 2a. Partner repair response requiring current-user action (Actionable, Priority 2)
  const rawRepairResponseCandidates: HomeActivityCandidate[] = [];
  for (const resp of repairResponses) {
    if (currentUserId && resp.user_id === currentUserId) {
      continue;
    }
    const ev = eventsById.get(resp.event_id);
    if (!ev || ev.status === "reconnected" || outcomesByEventId.has(resp.event_id)) {
      continue;
    }

    // If both partners are already ready on this event, it is represented by repair_both_ready
    const eventResponses = repairResponses.filter((r) => r.event_id === resp.event_id);
    const mySettlement = eventResponses.find(
      (r) => r.phase === "settlement" && r.user_id === currentUserId,
    );
    if (
      mySettlement?.response_code === "ready" &&
      resp.phase === "settlement" &&
      resp.response_code === "ready"
    ) {
      continue;
    }

    const occurredAt = resp.updated_at || resp.shared_at;
    if (isWithinPast24Hours(occurredAt, nowMs)) {
      const normalizedTs = normalizeIsoTimestamp(occurredAt);
      const key = `repair_response:${resp.id}:${normalizedTs}`;

      rawRepairResponseCandidates.push({
        key,
        kind: "repair_response",
        sourceId: resp.id,
        targetEventId: resp.event_id,
        coupleId: resp.couple_id || coupleId || "",
        actorId: resp.user_id,
        occurredAt,
        priority: 2,
        actionable: true,
        attentionMode: "actionable",
        route: `/event/${resp.event_id}?scope=ours`,
        overline: "A SHARED MOMENT",
        title: `${partnerLabel} responded to your moment`,
        body: "They shared where they are right now.",
        actionLabel: "See their response",
        icon: "🤝",
      });
    }
  }

  if (rawRepairResponseCandidates.length > 0) {
    rawRepairResponseCandidates.sort((a, b) => {
      const timeA = new Date(a.occurredAt).getTime();
      const timeB = new Date(b.occurredAt).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return a.key.localeCompare(b.key);
    });

    const newestResponse = rawRepairResponseCandidates[0];
    const responseReceipt = receiptsMap.get(
      normalizeActivityKey(newestResponse.key),
    );
    const isResponseSeen = Boolean(
      responseReceipt &&
        nowMs - new Date(responseReceipt.seen_at).getTime() <
          TWENTY_FOUR_HOURS_MS,
    );

    if (!isResponseSeen) {
      candidatesMap.set(newestResponse.key, newestResponse);
    }
  }

  // 2b. Both partners ready, current user is event creator (can complete) (Actionable, Priority 2)
  const rawBothReadyCandidates: HomeActivityCandidate[] = [];
  for (const ev of sharedEvents) {
    if (
      ev.event_type !== "friction" ||
      ev.status === "reconnected" ||
      outcomesByEventId.has(ev.id)
    ) {
      continue;
    }
    if (currentUserId && ev.creator_id !== currentUserId) {
      continue;
    }

    const eventResponses = repairResponses.filter((r) => r.event_id === ev.id);
    const mySettlement = eventResponses.find(
      (r) => r.phase === "settlement" && r.user_id === currentUserId,
    );
    const partnerSettlement = eventResponses.find(
      (r) => r.phase === "settlement" && r.user_id !== currentUserId,
    );

    if (
      mySettlement?.response_code === "ready" &&
      partnerSettlement?.response_code === "ready"
    ) {
      const myTs = new Date(mySettlement.updated_at || mySettlement.shared_at).getTime();
      const partnerTs = new Date(
        partnerSettlement.updated_at || partnerSettlement.shared_at,
      ).getTime();
      const latestTs = Math.max(
        isNaN(myTs) ? 0 : myTs,
        isNaN(partnerTs) ? 0 : partnerTs,
      );
      const occurredAt = new Date(latestTs).toISOString();

      if (isWithinPast24Hours(occurredAt, nowMs)) {
        const normalizedTs = normalizeIsoTimestamp(occurredAt);
        const key = `repair_both_ready:${ev.id}:${normalizedTs}`;

        rawBothReadyCandidates.push({
          key,
          kind: "repair_both_ready",
          sourceId: ev.id,
          targetEventId: ev.id,
          coupleId: ev.couple_id || coupleId || "",
          actorId: partnerSettlement.user_id,
          occurredAt,
          priority: 2,
          actionable: true,
          attentionMode: "actionable",
          route: `/event/${ev.id}?scope=ours`,
          overline: "A SHARED MOMENT",
          title: "You both feel ready",
          body: "You can gently close this moment when it feels right.",
          actionLabel: "Complete reconnection",
          icon: "🌿",
        });
      }
    }
  }

  if (rawBothReadyCandidates.length > 0) {
    rawBothReadyCandidates.sort((a, b) => {
      const timeA = new Date(a.occurredAt).getTime();
      const timeB = new Date(b.occurredAt).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return a.key.localeCompare(b.key);
    });

    const newestBothReady = rawBothReadyCandidates[0];
    const bothReadyReceipt = receiptsMap.get(
      normalizeActivityKey(newestBothReady.key),
    );
    const isBothReadySeen = Boolean(
      bothReadyReceipt &&
        nowMs - new Date(bothReadyReceipt.seen_at).getTime() <
          TWENTY_FOUR_HOURS_MS,
    );

    if (!isBothReadySeen) {
      candidatesMap.set(newestBothReady.key, newestBothReady);
    }
  }

  // ==========================================================================
  // INFORMATIONAL CANDIDATES (Non-Backlog Selection)
  // ==========================================================================
  // Collect all eligible informational items within the 24h rolling window.
  // We determine the single newest relevant candidate across the backlog before
  // applying seen/receipt suppression. If that newest candidate has already been
  // opened by the current user, we do NOT fall back to an older unseen item.
  const rawInformationalCandidates: HomeActivityCandidate[] = [];

  // Newly shared partner Good moment (Informational, Priority 1)
  for (const ev of sharedEvents) {
    if (ev.event_type !== "positive") {
      continue;
    }
    if (currentUserId && ev.creator_id === currentUserId) {
      continue;
    }

    if (isWithinPast24Hours(ev.created_at, nowMs)) {
      const normalizedTs = normalizeIsoTimestamp(ev.created_at);
      const key = `shared_positive:${ev.id}:${normalizedTs}`;

      rawInformationalCandidates.push({
        key,
        kind: "shared_positive",
        sourceId: ev.id,
        targetEventId: ev.id,
        coupleId: ev.couple_id || coupleId || "",
        actorId: ev.creator_id,
        occurredAt: ev.created_at,
        priority: 1,
        actionable: false,
        attentionMode: "informational",
        route: `/event/${ev.id}?scope=ours`,
        overline: "A SHARED MOMENT",
        title: `${partnerLabel} shared something good`,
        body: "A small piece of your shared story is waiting for you.",
        actionLabel: "See the moment",
        icon: "🌷",
      });
    }
  }

  // Reconnection completed (Informational, Priority 2)
  for (const outcome of outcomes) {
    if (!outcome.completed_at) continue;
    if (isWithinPast24Hours(outcome.completed_at, nowMs)) {
      const ev = eventsById.get(outcome.event_id);
      const normalizedTs = normalizeIsoTimestamp(outcome.completed_at);
      const key = `reconnection_completed:${outcome.event_id}:${normalizedTs}`;

      rawInformationalCandidates.push({
        key,
        kind: "reconnection_completed",
        sourceId: outcome.event_id,
        targetEventId: outcome.event_id,
        coupleId: outcome.couple_id || ev?.couple_id || coupleId || "",
        actorId: outcome.completed_by,
        occurredAt: outcome.completed_at,
        priority: 2,
        actionable: false,
        attentionMode: "informational",
        route: `/event/${outcome.event_id}?scope=ours`,
        overline: "A SHARED MOMENT",
        title: "You found your way back",
        body: "This moment has become part of what you have grown together.",
        actionLabel: "See the moment",
        icon: "🌱",
      });
    }
  }

  // Meaningful partner shared-list activity (added or completed) (Informational, Priority 3)
  for (const task of tasks) {
    if (task.created_by && currentUserId && task.created_by !== currentUserId) {
      if (isWithinPast24Hours(task.created_at, nowMs)) {
        const normalizedTs = normalizeIsoTimestamp(task.created_at);
        const key = `shared_list_added:${task.id}:${normalizedTs}`;

        rawInformationalCandidates.push({
          key,
          kind: "shared_list_added",
          sourceId: task.id,
          coupleId: task.couple_id || coupleId || "",
          actorId: task.created_by,
          occurredAt: task.created_at,
          priority: 3,
          actionable: false,
          attentionMode: "informational",
          route: "/shared-list",
          overline: "SHARED LIST",
          title: `${partnerLabel} added something to your shared list`,
          body: "Your shared list has something new.",
          actionLabel: "Open Shared List",
          icon: "📝",
        });
      }
    }

    if (task.status === "completed" && task.completed_at) {
      if (isWithinPast24Hours(task.completed_at, nowMs)) {
        const isPartnerTask =
          !currentUserId || (task.created_by && task.created_by !== currentUserId);
        if (isPartnerTask) {
          const normalizedTs = normalizeIsoTimestamp(task.completed_at);
          const key = `shared_list_completed:${task.id}:${normalizedTs}`;

          rawInformationalCandidates.push({
            key,
            kind: "shared_list_completed",
            sourceId: task.id,
            coupleId: task.couple_id || coupleId || "",
            actorId: task.created_by,
            occurredAt: task.completed_at,
            priority: 3,
            actionable: false,
            attentionMode: "informational",
            route: "/shared-list",
            overline: "SHARED LIST",
            title: `${partnerLabel} completed an item on your shared list`,
            body: "A shared task was marked as completed.",
            actionLabel: "Open Shared List",
            icon: "✓",
          });
        }
      }
    }
  }

  // Important date added by partner (Informational, Priority 3)
  for (const date of importantDates) {
    if (date.created_by && currentUserId && date.created_by !== currentUserId) {
      if (isWithinPast24Hours(date.created_at, nowMs)) {
        const normalizedTs = normalizeIsoTimestamp(date.created_at);
        const key = `important_date_added:${date.id}:${normalizedTs}`;

        rawInformationalCandidates.push({
          key,
          kind: "important_date_added",
          sourceId: date.id,
          coupleId: date.couple_id || coupleId || "",
          actorId: date.created_by,
          occurredAt: date.created_at,
          priority: 3,
          actionable: false,
          attentionMode: "informational",
          route: "/profile",
          overline: "IMPORTANT DATES",
          title: `${partnerLabel} added an important date`,
          body: "Another meaningful date now has a place in your shared space.",
          actionLabel: "See Important Dates",
          icon: "🗓️",
        });
      }
    }
  }

  // Qualifying activity created by current user (Informational, Priority 3)
  for (const ev of sharedEvents) {
    if (currentUserId && ev.creator_id === currentUserId) {
      if (isWithinPast24Hours(ev.created_at, nowMs)) {
        const normalizedTs = normalizeIsoTimestamp(ev.created_at);
        const key = `self_shared_moment:${ev.id}:${normalizedTs}`;

        rawInformationalCandidates.push({
          key,
          kind: "self_shared_moment",
          sourceId: ev.id,
          targetEventId: ev.id,
          coupleId: ev.couple_id || coupleId || "",
          actorId: currentUserId,
          occurredAt: ev.created_at,
          priority: 3,
          actionable: false,
          attentionMode: "informational",
          route: `/event/${ev.id}?scope=ours`,
          overline: "OUR SPACE",
          title: `You shared a moment with ${partnerLabel}`,
          body: "It now has a place in Our Space.",
          actionLabel: "See the moment",
        });
      }
    }
  }

  // Determine the newest relevant informational candidate across the backlog.
  // If the newest candidate was already opened by the current user, do NOT
  // fall back to an older unseen item from the same backlog.
  if (rawInformationalCandidates.length > 0) {
    rawInformationalCandidates.sort((a, b) => {
      const timeA = new Date(a.occurredAt).getTime();
      const timeB = new Date(b.occurredAt).getTime();
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.key.localeCompare(b.key);
    });

    const newestInformational = rawInformationalCandidates[0];
    const isNewestSeen = receiptsMap.has(
      normalizeActivityKey(newestInformational.key),
    );

    if (!isNewestSeen) {
      candidatesMap.set(newestInformational.key, newestInformational);
    }
  }

  // ==========================================================================
  // CALM EMPTY STATE (Tier 4)
  // ==========================================================================
  const emptyOccurredAt = new Date(nowMs).toISOString();
  const emptyKey = `empty:calm:state`;
  candidatesMap.set(emptyKey, {
    key: emptyKey,
    kind: "empty",
    sourceId: "empty",
    coupleId: coupleId || "",
    actorId: null,
    occurredAt: emptyOccurredAt,
    priority: 4,
    actionable: false,
    attentionMode: "informational",
    route: "/events?scope=ours",
    overline: "WHAT MATTERS NOW",
    title: "Nothing needs your attention right now",
    body: "Your shared space is here whenever something feels worth noticing.",
    actionLabel: "Visit Our Space",
  });

  // Sort deterministically and return top candidate
  const sorted = sortCandidates(Array.from(candidatesMap.values()));
  return sorted[0];
}

/**
 * Focused mark-seen helper. Writes a private per-user activity receipt.
 * Uses duplicate-safe RPC helper or table upsert idempotently.
 * Non-blocking: returns boolean without throwing or blocking navigation.
 */
export interface MarkHomeActivitySeenParams {
  supabase: any;
  candidate: HomeActivityCandidate;
  coupleId?: string | null;
  userId?: string | null;
}

export async function markHomeActivitySeen(
  params: MarkHomeActivitySeenParams,
): Promise<boolean> {
  const { supabase: client, candidate } = params;
  if (!client || !candidate?.key) return false;

  // Calm empty state and active evening reflection never persist receipts
  if (candidate.kind === "empty" || candidate.kind === "reflection") {
    return false;
  }

  const trimmedKey = candidate.key.trim();

  try {
    // Dedicated hardened SECURITY DEFINER RPC helper
    const rpcRes = await client.rpc("record_home_activity_receipt", {
      p_activity_key: trimmedKey,
      p_activity_kind: candidate.kind,
      p_source_id: candidate.sourceId,
      p_attention_mode: candidate.attentionMode,
    });

    if (!rpcRes?.error) {
      return true;
    }

    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn(
        "record_home_activity_receipt warning:",
        rpcRes.error.message,
      );
    }
    return false;
  } catch (err: any) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("markHomeActivitySeen technical warning:", err?.message || err);
    }
    return false;
  }
}
