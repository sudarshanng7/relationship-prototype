/**
 * Authoritative summary and navigation contract for Mine and Ours spaces.
 *
 * Responsibilities:
 * 1. Canonical Mine: private reflections belonging strictly to the authenticated user
 *    (public.event_private_reflections where author_id = auth.uid()) joined with
 *    accessible parent relationship_events.
 * 2. Canonical Ours: shared moments belonging to the active couple
 *    (public.relationship_events where visibility = 'ours') with deterministic
 *    trailing 7-day week boundary.
 * 3. Consistent Home/Destination counts and formatting (singular/plural/empty).
 * 4. Origin-aware event detail navigation contract (from=my-rhythm|mine|ours|moments).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type EventNavigationOrigin =
  | "my-rhythm"
  | "mine"
  | "ours"
  | "moments"
  | "weekly-reflection";

export interface EventBackConfig {
  origin: EventNavigationOrigin;
  backLabel: string;
  backAccessibilityLabel: string;
  destination: string;
}

export type RelationshipEventStatus =
  | "open"
  | "partially_repaired"
  | "reconnected"
  | null;

export interface CanonicalPrivateReflection {
  id: string;
  eventId: string;
  authorId: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  eventCategory: string | null;
  eventStatus: RelationshipEventStatus;
  eventType: string | null;
  eventCreatedAt: string | null;
  eventVisibility: string | null;
}

export interface CanonicalOursEvent {
  id: string;
  coupleId: string;
  creatorId: string;
  eventType: string;
  category: string;
  status: string;
  visibility: string;
  createdAt: string;
}

/**
 * Trailing 7-day week boundary definition.
 * Deterministic and timezone-agnostic: now - 7 days <= occurredAt <= now.
 */
export function isWithinPastSevenDays(
  dateInput: string | Date | number,
  nowMs: number = Date.now(),
): boolean {
  const ts =
    typeof dateInput === "number"
      ? dateInput
      : typeof dateInput === "string"
      ? new Date(dateInput).getTime()
      : dateInput.getTime();

  if (isNaN(ts)) return false;
  return ts <= nowMs && ts >= nowMs - SEVEN_DAYS_MS;
}

/**
 * Filter and deduplicate raw reflection rows against the canonical Mine ownership rules:
 * - author_id must match currentUserId (partner-authored reflections strictly excluded).
 * - note must be non-empty after trimming.
 * - parent event must exist and be accessible.
 * - duplicate reflection IDs or duplicate event IDs are suppressed.
 */
export function filterCanonicalPrivateReflections(
  rows: any[] | null | undefined,
  currentUserId: string,
): CanonicalPrivateReflection[] {
  if (!rows || !Array.isArray(rows) || !currentUserId) return [];

  const seenReflectionIds = new Set<string>();
  const seenEventIds = new Set<string>();
  const result: CanonicalPrivateReflection[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;

    // Strict ownership rule
    if (row.author_id !== currentUserId) continue;

    // Exclude null or whitespace-only reflection notes
    const rawNote = typeof row.note === "string" ? row.note.trim() : "";
    if (!rawNote) continue;

    // Associated event metadata check (must have a valid, accessible parent event)
    const event = row.relationship_events;
    if (!event || typeof event !== "object" || !event.id) continue;
    const eventId = event.id || row.event_id;
    if (!eventId || typeof eventId !== "string") continue;

    // Deduplication check
    const reflectionId = row.id || `${eventId}:${currentUserId}`;
    if (seenReflectionIds.has(reflectionId) || seenEventIds.has(eventId)) {
      continue;
    }
    seenReflectionIds.add(reflectionId);
    seenEventIds.add(eventId);

    result.push({
      id: reflectionId,
      eventId,
      authorId: row.author_id,
      note: rawNote,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
      eventCategory: event?.category ?? null,
      eventStatus: event?.status ?? null,
      eventType: event?.event_type ?? null,
      eventCreatedAt: event?.created_at ?? null,
      eventVisibility: event?.visibility ?? null,
    });
  }

  return result;
}

/**
 * Fetch canonical private reflections for the current authenticated user.
 */
export async function fetchCanonicalMineReflections(
  supabase: SupabaseClient,
  currentUserId: string,
): Promise<{ data: CanonicalPrivateReflection[]; error: Error | null }> {
  if (!currentUserId) {
    return { data: [], error: null };
  }

  try {
    const { data, error } = await supabase
      .from("event_private_reflections")
      .select(
        `
        id,
        event_id,
        author_id,
        note,
        created_at,
        updated_at,
        relationship_events (
          id,
          category,
          status,
          event_type,
          visibility,
          created_at
        )
      `,
      )
      .eq("author_id", currentUserId)
      .order("created_at", { ascending: false });

    if (error) {
      return { data: [], error: new Error(error.message) };
    }

    const filtered = filterCanonicalPrivateReflections(data, currentUserId);
    return { data: filtered, error: null };
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Format Mine summary text with singular/plural/empty copy.
 */
export function formatMineSummary(count: number): string {
  if (count <= 0) {
    return "No private reflections yet";
  }
  if (count === 1) {
    return "1 private reflection";
  }
  return `${count} private reflections`;
}

/**
 * Filter shared relationship events for the active couple.
 */
export function filterCanonicalOursEvents(
  events: any[] | null | undefined,
  coupleId: string,
): CanonicalOursEvent[] {
  if (!events || !Array.isArray(events) || !coupleId) return [];

  const seenIds = new Set<string>();
  const result: CanonicalOursEvent[] = [];

  for (const ev of events) {
    if (!ev || typeof ev !== "object" || !ev.id) continue;
    if (ev.visibility !== "ours") continue;
    if (ev.couple_id && ev.couple_id !== coupleId) continue;
    if (seenIds.has(ev.id)) continue;
    seenIds.add(ev.id);

    result.push({
      id: ev.id,
      coupleId: ev.couple_id ?? coupleId,
      creatorId: ev.creator_id ?? "",
      eventType: ev.event_type ?? "friction",
      category: ev.category ?? "",
      status: ev.status ?? "open",
      visibility: ev.visibility,
      createdAt: ev.created_at ?? new Date().toISOString(),
    });
  }

  return result;
}

/**
 * Count qualifying Ours moments within the trailing 7 days.
 */
export function countOursEventsThisWeek(
  oursEvents: CanonicalOursEvent[],
  nowMs: number = Date.now(),
): number {
  return oursEvents.filter((ev) => isWithinPastSevenDays(ev.createdAt, nowMs))
    .length;
}

/**
 * Format Ours summary text with singular/plural/empty copy.
 */
export function formatOursSummary(thisWeekCount: number): string {
  if (thisWeekCount <= 0) {
    return "No shared moments this week";
  }
  if (thisWeekCount === 1) {
    return "1 shared moment this week";
  }
  return `${thisWeekCount} shared moments this week`;
}

/**
 * Centrally resolve the Back navigation label, accessibility label, and destination.
 *
 * Strict mapping:
 * - my-rhythm -> "‹ Back to My Rhythm", "/home"
 * - mine -> "‹ Back to Mine", "/events?scope=mine"
 * - ours -> "‹ Back to Our Space", "/events?scope=ours"
 * - moments -> "‹ Back to Moments", "/events"
 *
 * Fallback (when origin is missing or unrecognized):
 * - scope === "mine" -> Mine
 * - scope === "ours" -> Our Space
 * - fallbackEventVisibility === "mine" -> Mine
 * - fallbackEventVisibility === "ours" -> Our Space
 * - default -> Moments
 */
export function resolveEventBackNavigation(
  fromParam?: string | string[] | null,
  scopeParam?: string | string[] | null,
  fallbackEventVisibility?: string | null,
): EventBackConfig {
  const rawFrom = Array.isArray(fromParam) ? fromParam[0] : fromParam;
  const rawScope = Array.isArray(scopeParam) ? scopeParam[0] : scopeParam;

  let origin: EventNavigationOrigin;

  if (
    rawFrom === "my-rhythm" ||
    rawFrom === "mine" ||
    rawFrom === "ours" ||
    rawFrom === "moments" ||
    rawFrom === "weekly-reflection"
  ) {
    origin = rawFrom;
  } else if (rawScope === "mine") {
    origin = "mine";
  } else if (rawScope === "ours") {
    origin = "ours";
  } else if (rawScope === "moments") {
    origin = "moments";
  } else if (fallbackEventVisibility === "mine") {
    origin = "mine";
  } else if (fallbackEventVisibility === "ours") {
    origin = "ours";
  } else {
    origin = "moments";
  }

  switch (origin) {
    case "weekly-reflection":
      return {
        origin,
        backLabel: "‹ Back to Your Week",
        backAccessibilityLabel: "Back to Your Week",
        destination: "/weekly-reflection?from=my-rhythm",
      };
    case "my-rhythm":
      return {
        origin,
        backLabel: "‹ Back to My Rhythm",
        backAccessibilityLabel: "Back to My Rhythm",
        destination: "/home",
      };
    case "mine":
      return {
        origin,
        backLabel: "‹ Back to Mine",
        backAccessibilityLabel: "Back to Mine",
        destination: "/events?scope=mine",
      };
    case "ours":
      return {
        origin,
        backLabel: "‹ Back to Our Space",
        backAccessibilityLabel: "Back to Our Space",
        destination: "/events?scope=ours",
      };
    case "moments":
    default:
      return {
        origin: "moments",
        backLabel: "‹ Back to Moments",
        backAccessibilityLabel: "Back to Moments",
        destination: "/events",
      };
  }
}

/**
 * Safely append from=<origin> to a route string if not already present.
 */
export function appendNavigationOrigin(
  route: string,
  origin: EventNavigationOrigin,
): string {
  if (!route || typeof route !== "string") return route;
  if (route.includes("from=")) return route;

  const separator = route.includes("?") ? "&" : "?";
  return `${route}${separator}from=${encodeURIComponent(origin)}`;
}
