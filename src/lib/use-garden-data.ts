import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { supabase } from "@/lib/supabase";
import { formatCategory } from "@/lib/event-heading";
import {
  GardenCareEvent,
  GardenCareSignals,
  GardenStage,
  getGardenStage,
  getPositiveGrowthNotice,
  getPositiveLatestSubtext,
  resolvePositiveFeatureFamily,
} from "@/lib/garden-generator";

export type { GardenCareEvent };

export interface LatestGardenEvent {
  kind: "positive_moment" | "reconnection" | "important_date";
  headline: string;
  subtext: string;
  timestamp: string;
}

export interface GardenDataState {
  loading: boolean;
  error: string | null;
  coupleId: string | null;
  seedString: string;
  timeGrowthUnits: number;
  careGrowthUnits: number;
  totalGrowthUnits: number;
  stage: GardenStage;
  isResting: boolean;
  isNewGarden: boolean;
  daysSinceLatest: number | null;
  positiveCount: number;
  reconnectedCount: number;
  importantDatesCount: number;
  careSignals: GardenCareSignals;
  careEvents: GardenCareEvent[];
  newGrowthNotice: string | null;
  latestEvent: LatestGardenEvent | null;
  createdAt: string | null;
}

const GENERIC_ERROR_MESSAGE =
  "Your garden could not be prepared just now. Nothing has been changed. You can return to Our Space and try again later.";

const INITIAL_STATE: GardenDataState = {
  loading: true,
  error: null,
  coupleId: null,
  seedString: "purple-garden-couple-seed",
  timeGrowthUnits: 0,
  careGrowthUnits: 0,
  totalGrowthUnits: 0,
  stage: getGardenStage(0),
  isResting: false,
  isNewGarden: true,
  daysSinceLatest: null,
  positiveCount: 0,
  reconnectedCount: 0,
  importantDatesCount: 0,
  careSignals: {
    positiveMoments: 0,
    reconnections: 0,
    importantDates: 0,
  },
  careEvents: [],
  newGrowthNotice: null,
  latestEvent: null,
  createdAt: null,
};

function normalizeTimestamp(
  ts: string | null | undefined,
  fallback: string
): string {
  if (!ts) return fallback;
  const time = new Date(ts).getTime();
  if (isNaN(time)) return fallback;
  return new Date(time).toISOString();
}

export function useGardenData(coupleId: string | null) {
  const reactInstanceId = useId();
  const channelInstanceId = useMemo(
    () => reactInstanceId.replace(/[^a-zA-Z0-9_-]/g, "") || "instance",
    [reactInstanceId]
  );

  const [data, setData] = useState<GardenDataState>(INITIAL_STATE);
  const mountedRef = useRef(true);
  const isFetchingRef = useRef(false);
  const pendingSilentRefetchRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousEventKeysRef = useRef<Set<string> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscriptionSeqRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchGardenData = useCallback(
    async (isSilent = false) => {
      if (!coupleId) {
        if (mountedRef.current) {
          setData((prev) => ({ ...prev, loading: false }));
        }
        return;
      }

      if (isFetchingRef.current) {
        if (isSilent) {
          pendingSilentRefetchRef.current = true;
        }
        return;
      }
      isFetchingRef.current = true;

      try {
        if (!isSilent && mountedRef.current) {
          setData((prev) => ({ ...prev, loading: true, error: null }));
        }

        // 1. Fetch couple record for created_at
        const { data: coupleData, error: coupleError } = await supabase
          .from("couples")
          .select("created_at")
          .eq("id", coupleId)
          .maybeSingle();

        // 2. Fetch positive shared moments (event_type = 'positive' AND visibility = 'ours')
        const { data: positiveEvents, error: positiveError } = await supabase
          .from("relationship_events")
          .select("id, created_at, event_type, category")
          .eq("couple_id", coupleId)
          .eq("event_type", "positive")
          .eq("visibility", "ours")
          .order("created_at", { ascending: false });

        // 3. Fetch reconnected shared friction moments (event_type = 'friction' AND visibility = 'ours' AND status = 'reconnected')
        const { data: reconnectedEvents, error: reconnectedError } = await supabase
          .from("relationship_events")
          .select("id, reconnected_at, created_at, event_type, status, category")
          .eq("couple_id", coupleId)
          .eq("event_type", "friction")
          .eq("visibility", "ours")
          .eq("status", "reconnected")
          .not("reconnected_at", "is", null)
          .order("reconnected_at", { ascending: false });

        // 4. Fetch past & present important dates (event_date <= CURRENT_DATE)
        const todayUtcStr = new Date().toISOString().slice(0, 10);
        const { data: importantDates, error: datesError } = await supabase
          .from("couple_important_dates")
          .select("id, event_date, created_at, label")
          .eq("couple_id", coupleId)
          .lte("event_date", todayUtcStr)
          .order("event_date", { ascending: false });

        // Partial-failure safety: if any required query fails, return error state
        // without fabricating zero events or calculating misleading growth.
        if (coupleError || positiveError || reconnectedError || datesError) {
          if (__DEV__) {
            console.warn("Shared Garden query issue:", {
              couple: coupleError?.message,
              positive: positiveError?.message,
              reconnected: reconnectedError?.message,
              dates: datesError?.message,
            });
          }
          if (mountedRef.current) {
            setData((prev) => ({
              ...prev,
              loading: false,
              error: GENERIC_ERROR_MESSAGE,
            }));
          }
          return;
        }

        // ------------------------------------------------
        // CANONICAL CARE SIGNALS (PART 2)
        // ------------------------------------------------
        const eventMap = new Map<string, GardenCareEvent>();
        const nowIso = new Date().toISOString();

        for (const row of positiveEvents || []) {
          const safeTs = normalizeTimestamp(row.created_at, nowIso);
          eventMap.set(`positive_moment:${row.id}`, {
            id: row.id,
            kind: "positive_moment",
            occurredAt: safeTs,
            category: row.category ?? null,
            displayTitle: formatCategory(row.category) || null,
          });
        }

        for (const row of reconnectedEvents || []) {
          // Reconnection occurredAt strictly uses reconnected_at
          const safeTs = normalizeTimestamp(
            row.reconnected_at,
            normalizeTimestamp(row.created_at, nowIso)
          );
          eventMap.set(`reconnection:${row.id}`, {
            id: row.id,
            kind: "reconnection",
            occurredAt: safeTs,
            category: row.category ?? null,
            displayTitle: formatCategory(row.category) || null,
          });
        }

        for (const row of importantDates || []) {
          const safeTs = normalizeTimestamp(row.event_date, nowIso);
          eventMap.set(`important_date:${row.id}`, {
            id: row.id,
            kind: "important_date",
            occurredAt: safeTs,
            createdAt: row.created_at
              ? normalizeTimestamp(row.created_at, nowIso)
              : null,
            displayTitle: row.label ? row.label.trim() : null,
          });
        }

        // Canonical deterministic sort:
        // 1. occurredAt ascending
        // 2. id ascending as tie-breaker
        const careEvents = Array.from(eventMap.values());
        careEvents.sort((a, b) => {
          const tA = new Date(a.occurredAt).getTime();
          const tB = new Date(b.occurredAt).getTime();
          if (tA !== tB) return tA - tB;
          return a.id.localeCompare(b.id);
        });

        // ------------------------------------------------
        // CALCULATIONS
        // ------------------------------------------------

        // Time units: min(60, elapsedUtcDays * 0.5)
        const couplesCreatedAt = coupleData?.created_at ?? null;
        const nowMs = Date.now();
        const createdMs = couplesCreatedAt
          ? new Date(couplesCreatedAt).getTime()
          : nowMs;
        const elapsedDays = Math.max(
          0,
          Math.floor((nowMs - createdMs) / (1000 * 60 * 60 * 24))
        );
        const timeGrowthUnits = Math.min(60, elapsedDays * 0.5);

        // Care counts
        const posCount = positiveEvents?.length ?? 0;
        const recCount = reconnectedEvents?.length ?? 0;
        const impCount = importantDates?.length ?? 0;
        const totalCareEventsCount = posCount + recCount + impCount;

        // Care units:
        // - positive shared moment: 2
        // - completed reconnection: 4
        // - important date: 2
        // - overall care contribution remains capped at 40
        const rawCareUnits = posCount * 2 + recCount * 4 + impCount * 2;
        const careGrowthUnits = Math.min(40, rawCareUnits);

        // Total units: min(100, timeGrowthUnits + careGrowthUnits)
        const totalGrowthUnits = Math.min(
          100,
          timeGrowthUnits + careGrowthUnits
        );
        const stage = getGardenStage(totalGrowthUnits);

        // ------------------------------------------------
        // NEW GROWTH ACKNOWLEDGEMENT (PARTS 8, 16, 17)
        // ------------------------------------------------
        let noticeText: string | null = null;
        const isInitialFetch = previousEventKeysRef.current === null;
        const currentKeys = new Set(careEvents.map((e) => `${e.kind}:${e.id}`));

        if (!isInitialFetch && previousEventKeysRef.current) {
          const newItems = careEvents.filter(
            (e) => !previousEventKeysRef.current?.has(`${e.kind}:${e.id}`)
          );
          // Only show growth notice if events increased and genuine new item added
          if (
            newItems.length > 0 &&
            careEvents.length >= previousEventKeysRef.current.size
          ) {
            const hasReconnection = newItems.some(
              (e) => e.kind === "reconnection"
            );
            if (hasReconnection) {
              noticeText = "A new blossom has opened in your garden.";
            } else {
              const newPosItems = newItems.filter(
                (e) => e.kind === "positive_moment"
              );
              if (newPosItems.length > 0) {
                const newestPos = newPosItems[newPosItems.length - 1];
                const resolvedPos = resolvePositiveFeatureFamily(
                  newestPos,
                  stage.key
                );
                noticeText = getPositiveGrowthNotice(resolvedPos.family);
              } else {
                noticeText = "Something new has taken root.";
              }
            }
          }
        }

        const wasDeleted =
          previousEventKeysRef.current !== null &&
          careEvents.length < previousEventKeysRef.current.size;

        previousEventKeysRef.current = currentKeys;

        if (noticeText && mountedRef.current) {
          if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
          noticeTimerRef.current = setTimeout(() => {
            if (mountedRef.current) {
              setData((prev) => ({ ...prev, newGrowthNotice: null }));
            }
          }, 5000);
        } else if (wasDeleted) {
          if (noticeTimerRef.current) {
            clearTimeout(noticeTimerRef.current);
            noticeTimerRef.current = null;
          }
        }

        // ------------------------------------------------
        // LATEST ACTIVITY & RESTING AMBIENCE (METADATA ONLY)
        // ------------------------------------------------
        interface CandidateEvent {
          timeMs: number;
          kind: LatestGardenEvent["kind"];
          headline: string;
          subtext: string;
          timestamp: string;
        }

        const candidates: CandidateEvent[] = [];

        if (positiveEvents && positiveEvents.length > 0) {
          const topPos = positiveEvents[0];
          const timeMs = new Date(topPos.created_at).getTime();
          const topPosFamily = resolvePositiveFeatureFamily(
            { id: topPos.id, category: topPos.category ?? null },
            stage.key
          ).family;
          candidates.push({
            timeMs,
            kind: "positive_moment",
            headline: "Shared good moment",
            subtext: getPositiveLatestSubtext(topPosFamily),
            timestamp: topPos.created_at,
          });
        }

        if (reconnectedEvents && reconnectedEvents.length > 0) {
          const topRec = reconnectedEvents[0];
          const dateStr = topRec.reconnected_at || topRec.created_at;
          const timeMs = new Date(dateStr).getTime();
          candidates.push({
            timeMs,
            kind: "reconnection",
            headline: "Moment of reconnection",
            subtext: "A new blossom opened after a moment of reconnection.",
            timestamp: dateStr,
          });
        }

        if (importantDates && importantDates.length > 0) {
          const topDate = importantDates[0];
          const timeMs = new Date(topDate.event_date).getTime();
          candidates.push({
            timeMs,
            kind: "important_date",
            headline: "Meaningful date",
            subtext:
              "A small garden detail now remembers one of your meaningful dates.",
            timestamp: topDate.event_date,
          });
        }

        // Sort candidate events by timestamp descending
        candidates.sort((a, b) => b.timeMs - a.timeMs);
        const latestCandidate = candidates.length > 0 ? candidates[0] : null;

        let isResting = false;
        let isNewGarden = false;
        let daysSinceLatest: number | null = null;

        if (totalCareEventsCount === 0) {
          // No care events yet: A quiet beginning (New Garden state), NOT resting
          isNewGarden = true;
          isResting = false;
        } else if (latestCandidate) {
          daysSinceLatest = Math.max(
            0,
            Math.floor((nowMs - latestCandidate.timeMs) / (1000 * 60 * 60 * 24))
          );
          isResting = daysSinceLatest > 7;
          isNewGarden = false;
        }

        const latestEvent: LatestGardenEvent | null = latestCandidate
          ? {
              kind: latestCandidate.kind,
              headline: latestCandidate.headline,
              subtext: latestCandidate.subtext,
              timestamp: latestCandidate.timestamp,
            }
          : null;

        const careSignals: GardenCareSignals = {
          positiveMoments: posCount,
          reconnections: recCount,
          importantDates: impCount,
        };

        if (mountedRef.current) {
          setData((prev) => ({
            ...prev,
            loading: false,
            error: null,
            coupleId,
            seedString: coupleId,
            timeGrowthUnits,
            careGrowthUnits,
            totalGrowthUnits,
            stage,
            isResting,
            isNewGarden,
            daysSinceLatest,
            positiveCount: posCount,
            reconnectedCount: recCount,
            importantDatesCount: impCount,
            careSignals,
            careEvents,
            newGrowthNotice: noticeText
              ? noticeText
              : wasDeleted
              ? null
              : prev.newGrowthNotice,
            latestEvent,
            createdAt: couplesCreatedAt,
          }));
        }
      } catch (err: any) {
        if (__DEV__) {
          console.warn("Shared Garden unexpected fetch error:", err?.message);
        }
        if (mountedRef.current) {
          setData((prev) => ({
            ...prev,
            loading: false,
            error: GENERIC_ERROR_MESSAGE,
          }));
        }
      } finally {
        isFetchingRef.current = false;
        if (pendingSilentRefetchRef.current && mountedRef.current) {
          pendingSilentRefetchRef.current = false;
          void fetchGardenDataRef.current(true);
        }
      }
    },
    [coupleId]
  );

  const fetchGardenDataRef = useRef(fetchGardenData);
  fetchGardenDataRef.current = fetchGardenData;

  useEffect(() => {
    previousEventKeysRef.current = null;
    pendingSilentRefetchRef.current = false;
    void fetchGardenData();
  }, [fetchGardenData]);

  // Realtime relationship events subscription (per-instance channel ownership)
  useEffect(() => {
    if (!coupleId) return;

    const subscriptionSeq = ++subscriptionSeqRef.current;
    const channelName = `pg_garden_${coupleId}_${channelInstanceId}_${subscriptionSeq}`;
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    const scheduleSilentRefresh = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        if (mountedRef.current) {
          void fetchGardenDataRef.current(true);
        }
      }, 200);
    };

    // Register every listener synchronously BEFORE subscribe()
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "relationship_events",
        filter: `couple_id=eq.${coupleId}`,
      },
      (payload) => {
        const eventType = payload.eventType;
        const newRow = payload.new as any;
        const oldRow = payload.old as any;

        // Defensive handling for DELETE (payload.new is empty in Supabase)
        if (eventType === "DELETE") {
          scheduleSilentRefresh();
          return;
        }

        const isPositive =
          newRow?.event_type === "positive" && newRow?.visibility === "ours";
        const isReconnected =
          newRow?.event_type === "friction" &&
          newRow?.status === "reconnected" &&
          newRow?.visibility === "ours";

        const wasPositive =
          oldRow?.event_type === "positive" && oldRow?.visibility === "ours";
        const wasReconnected =
          oldRow?.event_type === "friction" &&
          oldRow?.status === "reconnected" &&
          oldRow?.visibility === "ours";

        if (isPositive || isReconnected || wasPositive || wasReconnected) {
          scheduleSilentRefresh();
        }
      }
    );

    channel.subscribe((status, err) => {
      if (__DEV__ && (status === "CHANNEL_ERROR" || status === "TIMED_OUT")) {
        console.warn("Garden Realtime status:", status, err?.message || "");
      }
    });

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = null;
      }
      const ownedChannel = channelRef.current;
      channelRef.current = null;
      if (ownedChannel) {
        void supabase.removeChannel(ownedChannel);
      }
    };
  }, [coupleId, channelInstanceId]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && mountedRef.current) {
        void fetchGardenDataRef.current(true);
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);

  const clearNewGrowthNotice = useCallback(() => {
    setData((prev) => ({ ...prev, newGrowthNotice: null }));
  }, []);

  return {
    ...data,
    refetch: fetchGardenData,
    clearNewGrowthNotice,
  };
}
