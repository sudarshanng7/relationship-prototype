/**
 * Authoritative data-access and pure calculation module for "Your week, gently" Weekly Reflection.
 *
 * Requirements:
 * 1. Canonical week: Monday 00:00:00.000Z to following Monday 00:00:00.000Z (exclusive).
 * 2. Strict privacy: user_id = auth.uid(), partner isolation, no partner-private notes.
 * 3. Factual authorized weekly activity overview.
 * 4. User-selected reflection answers (single-selection from defined options).
 * 5. Optional private note (max 1,000 characters, trimmed).
 * 6. Idempotent one-row-per-week persistence (update existing rather than duplicate).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_PRIVATE_NOTE_LENGTH = 1000;

export const STAYED_WITH_OPTIONS = [
  "A moment of closeness",
  "Something we worked through",
  "Something still on my mind",
  "An ordinary moment I appreciated",
  "Nothing in particular",
] as const;

export type StayedWithOption = (typeof STAYED_WITH_OPTIONS)[number];

export const CARRY_FORWARD_OPTIONS = [
  "More time together",
  "A gentler conversation",
  "More space and patience",
  "Something playful",
  "Keep things as they are",
  "I’m not sure yet",
] as const;

export type CarryForwardOption = (typeof CARRY_FORWARD_OPTIONS)[number];

export function isStayedWithOption(val: unknown): val is StayedWithOption {
  return typeof val === "string" && STAYED_WITH_OPTIONS.includes(val as any);
}

export function isCarryForwardOption(val: unknown): val is CarryForwardOption {
  return typeof val === "string" && CARRY_FORWARD_OPTIONS.includes(val as any);
}

export interface WeeklyReflectionPeriod {
  weekStart: string; // ISO string e.g. "2026-11-16T00:00:00.000Z"
  weekEnd: string;   // ISO string e.g. "2026-11-23T00:00:00.000Z"
  weekKey: string;   // e.g. "2026-11-16"
}

/**
 * Deterministic canonical week definition:
 * Week begins Monday at 00:00:00.000Z.
 * Week ends following Monday at 00:00:00.000Z (exclusive).
 */
export function getWeeklyReflectionPeriod(
  referenceDate?: Date | string | number,
): WeeklyReflectionPeriod {
  const ref =
    referenceDate === undefined
      ? new Date()
      : referenceDate instanceof Date
      ? referenceDate
      : new Date(referenceDate);

  if (isNaN(ref.getTime())) {
    throw new Error("Invalid reference date");
  }

  // Canonical UTC day of week: 0 = Sun, 1 = Mon, ..., 6 = Sat
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

  const weekStart = start.toISOString();
  const weekEnd = end.toISOString();
  const weekKey = weekStart.slice(0, 10);

  return { weekStart, weekEnd, weekKey };
}

/**
 * Format user-facing period label: Monday through Sunday (inclusive user-facing).
 */
export function formatWeeklyReflectionPeriod(
  period: WeeklyReflectionPeriod,
): string {
  const start = new Date(period.weekStart);
  const sunday = new Date(new Date(period.weekEnd).getTime() - 1);

  const startMonth = start.toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  const startDay = start.getUTCDate();
  const endMonth = sunday.toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  const endDay = sunday.getUTCDate();
  const year = sunday.getUTCFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} – ${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
}

export interface WeeklyActivitySummary {
  userRecordedMomentsCount: number;
  sharedMomentsCount: number;
  partnerSharedMomentsCount: number;
  privateReflectionsCount: number;
  reconnectedMomentsCount: number;
  hasAnyActivity: boolean;
  activityLines: string[];
}

export interface WeeklyMomentItem {
  id: string;
  category: string;
  eventType: "friction" | "positive";
  visibility: "mine" | "ours";
  status: string | null;
  sharedTopic: string | null;
  createdAt: string;
  reconnectedAt: string | null;
  isCreator: boolean;
}

export interface WeeklyReflectionRecord {
  id: string;
  userId: string;
  coupleId: string | null;
  weekStart: string;
  weekEnd: string;
  stayedWith: StayedWithOption;
  carryForward: CarryForwardOption;
  privateNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Pure helper to build factual activity summary lines with singular/plural copy.
 */
export function buildWeeklyActivitySummaryLines(params: {
  userRecordedMomentsCount: number;
  partnerSharedMomentsCount: number;
  privateReflectionsCount: number;
  reconnectedMomentsCount: number;
}): string[] {
  const lines: string[] = [];

  if (params.userRecordedMomentsCount > 0) {
    lines.push(
      params.userRecordedMomentsCount === 1
        ? "1 moment you recorded"
        : `${params.userRecordedMomentsCount} moments you recorded`,
    );
  }

  if (params.partnerSharedMomentsCount > 0) {
    lines.push(
      params.partnerSharedMomentsCount === 1
        ? "1 moment shared by your partner"
        : `${params.partnerSharedMomentsCount} moments shared by your partner`,
    );
  }

  if (params.privateReflectionsCount > 0) {
    lines.push(
      params.privateReflectionsCount === 1
        ? "1 private reflection"
        : `${params.privateReflectionsCount} private reflections`,
    );
  }

  if (params.reconnectedMomentsCount > 0) {
    lines.push(
      params.reconnectedMomentsCount === 1
        ? "1 moment you worked through together"
        : `${params.reconnectedMomentsCount} moments you worked through together`,
    );
  }

  return lines;
}

/**
 * Fetch factual activity summary for the current authenticated user within the period.
 */
export async function fetchWeeklyActivitySummary(
  supabase: SupabaseClient,
  period: WeeklyReflectionPeriod,
): Promise<{ data: WeeklyActivitySummary; error: Error | null }> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        data: {
          userRecordedMomentsCount: 0,
          sharedMomentsCount: 0,
          partnerSharedMomentsCount: 0,
          privateReflectionsCount: 0,
          reconnectedMomentsCount: 0,
          hasAnyActivity: false,
          activityLines: [],
        },
        error: userError ? new Error(userError.message) : null,
      };
    }

    const { data: membership } = await supabase
      .from("couple_members")
      .select("couple_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const coupleId = membership?.couple_id || null;

    // Parallel fetch of events and private reflections
    const eventQuery = coupleId
      ? supabase
          .from("relationship_events")
          .select(
            "id, creator_id, event_type, category, visibility, status, created_at, reconnected_at",
          )
          .or(
            `and(couple_id.eq.${coupleId},visibility.eq.ours),and(creator_id.eq.${user.id},visibility.eq.mine)`,
          )
      : supabase
          .from("relationship_events")
          .select(
            "id, creator_id, event_type, category, visibility, status, created_at, reconnected_at",
          )
          .eq("creator_id", user.id);

    const [eventsRes, reflectionsRes] = await Promise.all([
      eventQuery,
      supabase
        .from("event_private_reflections")
        .select(
          `
          id,
          event_id,
          author_id,
          note,
          created_at,
          relationship_events (
            id,
            category,
            status,
            event_type,
            visibility
          )
        `,
        )
        .eq("author_id", user.id)
        .gte("created_at", period.weekStart)
        .lt("created_at", period.weekEnd),
    ]);

    if (eventsRes.error) {
      return {
        data: {
          userRecordedMomentsCount: 0,
          sharedMomentsCount: 0,
          partnerSharedMomentsCount: 0,
          privateReflectionsCount: 0,
          reconnectedMomentsCount: 0,
          hasAnyActivity: false,
          activityLines: [],
        },
        error: new Error(eventsRes.error.message),
      };
    }

    const weekStartMs = new Date(period.weekStart).getTime();
    const weekEndMs = new Date(period.weekEnd).getTime();

    // Deduplicate events
    const rawEvents = eventsRes.data || [];
    const eventMap = new Map<string, any>();
    for (const ev of rawEvents) {
      if (ev && ev.id) eventMap.set(ev.id, ev);
    }
    const events = Array.from(eventMap.values());

    let userRecordedMomentsCount = 0;
    let sharedMomentsCount = 0;
    let partnerSharedMomentsCount = 0;
    let reconnectedMomentsCount = 0;

    for (const ev of events) {
      const createdMs = new Date(ev.created_at).getTime();
      const inCreatedWeek = createdMs >= weekStartMs && createdMs < weekEndMs;

      if (inCreatedWeek) {
        if (ev.creator_id === user.id) {
          userRecordedMomentsCount++;
        } else if (ev.visibility === "ours") {
          partnerSharedMomentsCount++;
        }
        if (ev.visibility === "ours") {
          sharedMomentsCount++;
        }
      }

      if (ev.reconnected_at) {
        const reconnectedMs = new Date(ev.reconnected_at).getTime();
        if (reconnectedMs >= weekStartMs && reconnectedMs < weekEndMs) {
          reconnectedMomentsCount++;
        }
      }
    }

    // Deduplicate private reflections and ensure parent event exists and note is non-empty
    const rawReflections = reflectionsRes.data || [];
    const seenReflectionEvents = new Set<string>();
    let privateReflectionsCount = 0;

    for (const ref of rawReflections) {
      if (!ref || ref.author_id !== user.id) continue;
      if (!ref.note || typeof ref.note !== "string" || !ref.note.trim()) continue;
      const parentRaw = ref.relationship_events as any;
      const parent = Array.isArray(parentRaw) ? parentRaw[0] : parentRaw;
      if (!parent || typeof parent !== "object" || !parent.id) continue;

      if (!seenReflectionEvents.has(ref.event_id)) {
        seenReflectionEvents.add(ref.event_id);
        privateReflectionsCount++;
      }
    }

    const activityLines = buildWeeklyActivitySummaryLines({
      userRecordedMomentsCount,
      partnerSharedMomentsCount,
      privateReflectionsCount,
      reconnectedMomentsCount,
    });

    const hasAnyActivity =
      userRecordedMomentsCount > 0 ||
      partnerSharedMomentsCount > 0 ||
      privateReflectionsCount > 0 ||
      reconnectedMomentsCount > 0;

    return {
      data: {
        userRecordedMomentsCount,
        sharedMomentsCount,
        partnerSharedMomentsCount,
        privateReflectionsCount,
        reconnectedMomentsCount,
        hasAnyActivity,
        activityLines,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: {
        userRecordedMomentsCount: 0,
        sharedMomentsCount: 0,
        partnerSharedMomentsCount: 0,
        privateReflectionsCount: 0,
        reconnectedMomentsCount: 0,
        hasAnyActivity: false,
        activityLines: [],
      },
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Fetch accessible moments from the week for optional display.
 */
export async function fetchWeeklyMoments(
  supabase: SupabaseClient,
  period: WeeklyReflectionPeriod,
): Promise<{ data: WeeklyMomentItem[]; error: Error | null }> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { data: [], error: userError ? new Error(userError.message) : null };
    }

    const { data: membership } = await supabase
      .from("couple_members")
      .select("couple_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const coupleId = membership?.couple_id || null;

    const eventQuery = coupleId
      ? supabase
          .from("relationship_events")
          .select(
            "id, creator_id, event_type, category, visibility, status, shared_topic, created_at, reconnected_at",
          )
          .or(
            `and(couple_id.eq.${coupleId},visibility.eq.ours),and(creator_id.eq.${user.id},visibility.eq.mine)`,
          )
      : supabase
          .from("relationship_events")
          .select(
            "id, creator_id, event_type, category, visibility, status, shared_topic, created_at, reconnected_at",
          )
          .eq("creator_id", user.id);

    const { data, error } = await eventQuery;

    if (error) {
      return { data: [], error: new Error(error.message) };
    }

    const weekStartMs = new Date(period.weekStart).getTime();
    const weekEndMs = new Date(period.weekEnd).getTime();

    const seenIds = new Set<string>();
    const moments: WeeklyMomentItem[] = [];

    for (const ev of data || []) {
      if (!ev || !ev.id || seenIds.has(ev.id)) continue;

      const createdMs = new Date(ev.created_at).getTime();
      const inCreatedWeek = createdMs >= weekStartMs && createdMs < weekEndMs;

      let inReconnectedWeek = false;
      if (ev.reconnected_at) {
        const reconnectedMs = new Date(ev.reconnected_at).getTime();
        inReconnectedWeek =
          reconnectedMs >= weekStartMs && reconnectedMs < weekEndMs;
      }

      if (inCreatedWeek || inReconnectedWeek) {
        seenIds.add(ev.id);
        moments.push({
          id: ev.id,
          category: ev.category || "general",
          eventType: ev.event_type || "friction",
          visibility: ev.visibility || "ours",
          status: ev.status || null,
          sharedTopic: ev.shared_topic || null,
          createdAt: ev.created_at,
          reconnectedAt: ev.reconnected_at || null,
          isCreator: ev.creator_id === user.id,
        });
      }
    }

    // Sort newest first
    moments.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return { data: moments, error: null };
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Fetch existing weekly reflection for the authenticated user and period.
 */
export async function fetchCurrentWeeklyReflection(
  supabase: SupabaseClient,
  period: WeeklyReflectionPeriod,
): Promise<{ data: WeeklyReflectionRecord | null; error: Error | null }> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { data: null, error: userError ? new Error(userError.message) : null };
    }

    const { data, error } = await supabase
      .from("weekly_reflections")
      .select("*")
      .eq("user_id", user.id)
      .eq("week_start", period.weekStart)
      .maybeSingle();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    if (!data) {
      return { data: null, error: null };
    }

    return {
      data: {
        id: data.id,
        userId: data.user_id,
        coupleId: data.couple_id,
        weekStart: data.week_start,
        weekEnd: data.week_end,
        stayedWith: data.stayed_with,
        carryForward: data.carry_forward,
        privateNote: data.private_note,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

export interface SaveWeeklyReflectionParams {
  period: WeeklyReflectionPeriod;
  stayedWith: StayedWithOption;
  carryForward: CarryForwardOption;
  privateNote?: string | null;
}

/**
 * Save or update weekly reflection.
 * Idempotently updates existing row for (user_id, week_start) rather than inserting duplicates.
 */
export async function saveWeeklyReflection(
  supabase: SupabaseClient,
  params: SaveWeeklyReflectionParams,
): Promise<{ data: WeeklyReflectionRecord | null; error: Error | null }> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        data: null,
        error: new Error(
          userError?.message || "Please sign in to save your reflection.",
        ),
      };
    }

    // Validate answers
    if (!isStayedWithOption(params.stayedWith)) {
      return {
        data: null,
        error: new Error("Please select what stayed with you from this week."),
      };
    }

    if (!isCarryForwardOption(params.carryForward)) {
      return {
        data: null,
        error: new Error(
          "Please select what you would like to carry into next week.",
        ),
      };
    }

    // Validate private note
    let trimmedNote: string | null = null;
    if (params.privateNote && typeof params.privateNote === "string") {
      const trimmed = params.privateNote.trim();
      if (trimmed.length > MAX_PRIVATE_NOTE_LENGTH) {
        return {
          data: null,
          error: new Error(
            `Private note must be ${MAX_PRIVATE_NOTE_LENGTH} characters or less.`,
          ),
        };
      }
      if (trimmed.length > 0) {
        trimmedNote = trimmed;
      }
    }

    const { data: membership } = await supabase
      .from("couple_members")
      .select("couple_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const coupleId = membership?.couple_id || null;

    // Check if reflection already exists for this user and week
    const { data: existing } = await supabase
      .from("weekly_reflections")
      .select("id")
      .eq("user_id", user.id)
      .eq("week_start", params.period.weekStart)
      .maybeSingle();

    if (existing?.id) {
      const { data: updated, error: updateError } = await supabase
        .from("weekly_reflections")
        .update({
          stayed_with: params.stayedWith,
          carry_forward: params.carryForward,
          private_note: trimmedNote,
          couple_id: coupleId,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (updateError) {
        return {
          data: null,
          error: new Error(
            "We could not save your reflection right now. Please try again.",
          ),
        };
      }

      return {
        data: {
          id: updated.id,
          userId: updated.user_id,
          coupleId: updated.couple_id,
          weekStart: updated.week_start,
          weekEnd: updated.week_end,
          stayedWith: updated.stayed_with,
          carryForward: updated.carry_forward,
          privateNote: updated.private_note,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at,
        },
        error: null,
      };
    }

    // Insert new reflection
    const { data: inserted, error: insertError } = await supabase
      .from("weekly_reflections")
      .insert({
        user_id: user.id,
        couple_id: coupleId,
        week_start: params.period.weekStart,
        week_end: params.period.weekEnd,
        stayed_with: params.stayedWith,
        carry_forward: params.carryForward,
        private_note: trimmedNote,
      })
      .select()
      .single();

    if (insertError) {
      return {
        data: null,
        error: new Error(
          "We could not save your reflection right now. Please try again.",
        ),
      };
    }

    return {
      data: {
        id: inserted.id,
        userId: inserted.user_id,
        coupleId: inserted.couple_id,
        weekStart: inserted.week_start,
        weekEnd: inserted.week_end,
        stayedWith: inserted.stayed_with,
        carryForward: inserted.carry_forward,
        privateNote: inserted.private_note,
        createdAt: inserted.created_at,
        updatedAt: inserted.updated_at,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: new Error(
        "We could not save your reflection right now. Please try again.",
      ),
    };
  }
}
