import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  GardenStage,
  getGardenStage,
} from "@/lib/garden-generator";

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
  latestEvent: null,
  createdAt: null,
};

export function useGardenData(coupleId: string | null) {
  const [data, setData] = useState<GardenDataState>(INITIAL_STATE);

  const fetchGardenData = useCallback(async () => {
    if (!coupleId) {
      setData((prev) => ({ ...prev, loading: false }));
      return;
    }

    try {
      setData((prev) => ({ ...prev, loading: true, error: null }));

      // 1. Fetch couple record for created_at
      const { data: coupleData, error: coupleError } = await supabase
        .from("couples")
        .select("created_at")
        .eq("id", coupleId)
        .maybeSingle();

      // 2. Fetch positive shared moments (event_type = 'positive' AND visibility = 'ours')
      const { data: positiveEvents, error: positiveError } = await supabase
        .from("relationship_events")
        .select("id, created_at, event_type")
        .eq("couple_id", coupleId)
        .eq("event_type", "positive")
        .eq("visibility", "ours")
        .order("created_at", { ascending: false });

      // 3. Fetch reconnected shared friction moments (event_type = 'friction' AND visibility = 'ours' AND status = 'reconnected')
      const { data: reconnectedEvents, error: reconnectedError } = await supabase
        .from("relationship_events")
        .select("id, reconnected_at, created_at, event_type, status")
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
        .select("id, event_date")
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
        setData((prev) => ({
          ...prev,
          loading: false,
          error: GENERIC_ERROR_MESSAGE,
        }));
        return;
      }

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
      const timeGrowthUnits = Math.min(60, Math.floor(elapsedDays * 0.5));

      // Care counts
      const posCount = positiveEvents?.length ?? 0;
      const recCount = reconnectedEvents?.length ?? 0;
      const impCount = importantDates?.length ?? 0;
      const totalCareEventsCount = posCount + recCount + impCount;

      // Care units: min(40, (pos * 2) + (rec * 3) + (imp * 2))
      const rawCareUnits = posCount * 2 + recCount * 3 + impCount * 2;
      const careGrowthUnits = Math.min(40, rawCareUnits);

      // Total units: min(100, timeGrowthUnits + careGrowthUnits)
      const totalGrowthUnits = Math.min(
        100,
        timeGrowthUnits + careGrowthUnits
      );
      const stage = getGardenStage(totalGrowthUnits);

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
        candidates.push({
          timeMs,
          kind: "positive_moment",
          headline: "Shared good moment",
          subtext: "A little more green was added by a shared good moment.",
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
          subtext: "A small garden detail now remembers one of your meaningful dates.",
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

      setData({
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
        latestEvent,
        createdAt: couplesCreatedAt,
      });
    } catch (err: any) {
      if (__DEV__) {
        console.warn("Shared Garden unexpected fetch error:", err?.message);
      }
      setData((prev) => ({
        ...prev,
        loading: false,
        error: GENERIC_ERROR_MESSAGE,
      }));
    }
  }, [coupleId]);

  useEffect(() => {
    void fetchGardenData();
  }, [fetchGardenData]);

  return {
    ...data,
    refetch: fetchGardenData,
  };
}
