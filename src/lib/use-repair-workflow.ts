import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useRef, useState } from "react";

export type ArrivalResponseCode = "heard" | "need_time" | "suggest_next_step";
export type SuggestedStepCode =
  | "quiet_chat"
  | "warm_hug"
  | "walk_outside"
  | "quiet_time_together"
  | "tea_together";

export type SettlementResponseCode = "ready" | "reconnecting" | "need_time";

export type TakeawayTagCode =
  | "feeling_heard"
  | "giving_space"
  | "small_gesture"
  | "talking_it_through"
  | "time_together";

export type DerivedRepairStage =
  | "open"
  | "in_care"
  | "reconnecting"
  | "both_ready"
  | "reconnected";

export interface RepairResponse {
  id: string;
  event_id: string;
  couple_id: string;
  user_id: string;
  phase: "arrival" | "settlement";
  response_code: ArrivalResponseCode | SettlementResponseCode | string;
  suggested_step_code: SuggestedStepCode | string | null;
  shared_at: string;
  updated_at: string;
}

export interface RepairOutcome {
  event_id: string;
  couple_id: string;
  completed_by: string;
  takeaway_tag: TakeawayTagCode | string | null;
  takeaway_note: string | null;
  completed_at: string;
  updated_at: string;
}

export const ARRIVAL_LABELS: Record<
  ArrivalResponseCode,
  { title: string; description: string; shortLabel: string }
> = {
  heard: {
    title: "🤍 I’ve heard this",
    description: "Acknowledge without feeling pushed to debate or solve right now",
    shortLabel: "I’ve heard this",
  },
  need_time: {
    title: "⏳ I need a little more time",
    description: "Signal care while taking gentle breathing room",
    shortLabel: "I need a little more time",
  },
  suggest_next_step: {
    title: "🌿 I’d like to suggest a small next step",
    description: "Propose a kind, concrete step to help you both soften",
    shortLabel: "Suggested a small next step",
  },
};

export const SUGGESTED_STEP_LABELS: Record<SuggestedStepCode, string> = {
  quiet_chat: "A quiet chat",
  warm_hug: "A warm hug",
  walk_outside: "A walk outside",
  quiet_time_together: "Quiet time side-by-side",
  tea_together: "Fresh tea together",
};

export const SETTLEMENT_LABELS: Record<
  SettlementResponseCode,
  { title: string; description: string; shortLabel: string }
> = {
  ready: {
    title: "🌿 I feel ready to leave this here",
    description: "Ready to gently set this moment down",
    shortLabel: "Ready to leave this here",
  },
  reconnecting: {
    title: "🌱 The issue feels settled, but I’m still reconnecting",
    description: "The tension has softened, but connection is still finding its way",
    shortLabel: "Settled, still reconnecting",
  },
  need_time: {
    title: "⏳ I need more time",
    description: "More space or care is needed before closing this",
    shortLabel: "Needs more time",
  },
};

export const TAKEAWAY_TAG_LABELS: Record<TakeawayTagCode, string> = {
  feeling_heard: "Feeling heard",
  giving_space: "Giving space",
  small_gesture: "A small gesture",
  talking_it_through: "Talking it through",
  time_together: "Time together",
};

function formatDatabaseErrorMessage(error: unknown): string {
  if (!error) return "An unexpected error occurred.";
  const raw =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);

  if (raw.includes("Authentication required")) {
    return "Please sign in to respond to this moment.";
  }
  if (raw.includes("Relationship membership required")) {
    return "You are not a member of the couple space for this moment.";
  }
  if (raw.includes("Event unavailable")) {
    return "This shared moment is unavailable or has been removed.";
  }
  if (raw.includes("Event is already reconnected")) {
    return "This moment has already been reconnected.";
  }
  if (raw.includes("Only the recipient may submit an arrival response")) {
    return "Only your partner can submit the first response to this shared moment.";
  }
  if (raw.includes("Recipient arrival response required before settlement")) {
    return "Waiting for the first response before closing check-in can begin.";
  }
  if (raw.includes("Both partners must be ready before completing reconnection")) {
    return "Both partners must feel ready before closing reconnection.";
  }
  if (raw.includes("Only the event creator may complete reconnection")) {
    return "Only the creator of this moment can complete reconnection.";
  }
  if (raw.includes("Takeaway note cannot be whitespace only")) {
    return "Takeaway note cannot be whitespace only.";
  }
  if (raw.includes("Takeaway note exceeds maximum length")) {
    return "Takeaway note must be 500 characters or fewer.";
  }
  return raw;
}

export function deriveRepairStage(
  eventStatus: string | null | undefined,
  hasOutcome: boolean,
  arrivalResponse: RepairResponse | null,
  mySettlement: RepairResponse | null,
  partnerSettlement: RepairResponse | null,
): DerivedRepairStage {
  if (eventStatus === "reconnected" || hasOutcome) {
    return "reconnected";
  }

  if (!arrivalResponse) {
    return "open";
  }

  // bothReady requires two distinct settlement user IDs and both response_code === "ready"
  const hasDistinctSettlements =
    mySettlement !== null &&
    partnerSettlement !== null &&
    mySettlement.user_id !== partnerSettlement.user_id;

  const myCode = mySettlement?.response_code;
  const partnerCode = partnerSettlement?.response_code;

  if (
    hasDistinctSettlements &&
    myCode === "ready" &&
    partnerCode === "ready"
  ) {
    return "both_ready";
  }

  // If neither needs time and at least one is reconnecting, and both checked in:
  if (
    hasDistinctSettlements &&
    myCode !== "need_time" &&
    partnerCode !== "need_time" &&
    (myCode === "reconnecting" || partnerCode === "reconnecting")
  ) {
    return "reconnecting";
  }

  return "in_care";
}

interface UseRepairWorkflowParams {
  eventId: string | undefined;
  currentUserId: string | null;
  creatorId: string | undefined;
  eventStatus: string | null | undefined;
  onEventRefetch?: () => void;
}

export function useRepairWorkflow({
  eventId,
  currentUserId,
  creatorId,
  eventStatus,
  onEventRefetch,
}: UseRepairWorkflowParams) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [arrivalResponse, setArrivalResponse] = useState<RepairResponse | null>(
    null,
  );
  const [mySettlement, setMySettlement] = useState<RepairResponse | null>(null);
  const [partnerSettlement, setPartnerSettlement] =
    useState<RepairResponse | null>(null);
  const [repairOutcome, setRepairOutcome] = useState<RepairOutcome | null>(null);

  const [privateReflectionId, setPrivateReflectionId] = useState<string | null>(
    null,
  );
  const [privateNote, setPrivateNote] = useState<string | null>(null);
  const [reflectionLoading, setReflectionLoading] = useState(false);
  const [reflectionError, setReflectionError] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetchRepairData = useCallback(async () => {
    if (!eventId || !currentUserId) return;

    try {
      // 1. Fetch repair responses
      const { data: responses, error: respError } = await supabase
        .from("relationship_event_repair_responses")
        .select(
          "id, event_id, couple_id, user_id, phase, response_code, suggested_step_code, shared_at, updated_at",
        )
        .eq("event_id", eventId);

      if (respError) throw respError;

      // 2. Fetch repair outcomes
      const { data: outcome, error: outError } = await supabase
        .from("relationship_event_repair_outcomes")
        .select(
          "event_id, couple_id, completed_by, takeaway_tag, takeaway_note, completed_at, updated_at",
        )
        .eq("event_id", eventId)
        .maybeSingle();

      if (outError) throw outError;

      // 3. Fetch strictly current user's private reflection (id and note)
      const { data: reflection, error: refError } = await supabase
        .from("event_private_reflections")
        .select("id, note")
        .eq("event_id", eventId)
        .eq("author_id", currentUserId)
        .maybeSingle();

      if (refError) throw refError;

      if (!isMountedRef.current) return;

      const respList = (responses || []) as RepairResponse[];

      // Recipient arrival response is from a user who is not creatorId
      const arrival =
        respList.find(
          (r) => r.phase === "arrival" && (!creatorId || r.user_id !== creatorId),
        ) || null;

      const mySett =
        respList.find(
          (r) => r.phase === "settlement" && r.user_id === currentUserId,
        ) || null;

      const partnerSett =
        respList.find(
          (r) => r.phase === "settlement" && r.user_id !== currentUserId,
        ) || null;

      setArrivalResponse(arrival);
      setMySettlement(mySett);
      setPartnerSettlement(partnerSett);
      setRepairOutcome((outcome as RepairOutcome) || null);
      setPrivateReflectionId(reflection?.id ?? null);
      setPrivateNote(reflection?.note ?? null);
      setError(null);
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const techMsg =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : String(err);
        console.error("Failed to load repair workflow data:", techMsg);
        setError(formatDatabaseErrorMessage(err));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [eventId, currentUserId, creatorId]);

  // Initial load
  useEffect(() => {
    isMountedRef.current = true;
    if (eventId && currentUserId) {
      setLoading(true);
      refetchRepairData();
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [eventId, currentUserId, refetchRepairData]);

  // Realtime subscription setup
  useEffect(() => {
    if (!eventId) return;

    let isSubscribed = true;
    const channelName = `repair-sync-${eventId}`;

    const triggerDebouncedRefetch = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        if (isSubscribed && isMountedRef.current) {
          refetchRepairData();
          onEventRefetch?.();
        }
      }, 200);
    };

    // Remove any previous channel with the same topic
    const existing = supabase
      .getChannels()
      .find((c) => c.topic === `realtime:${channelName}`);
    if (existing) {
      supabase.removeChannel(existing);
    }

    const channel = supabase.channel(channelName);

    // Register all callbacks before subscribe()
    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "relationship_events",
          filter: `id=eq.${eventId}`,
        },
        () => {
          triggerDebouncedRefetch();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "relationship_event_repair_responses",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          triggerDebouncedRefetch();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "relationship_event_repair_outcomes",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          triggerDebouncedRefetch();
        },
      );

    channel.subscribe();

    return () => {
      isSubscribed = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [eventId, refetchRepairData, onEventRefetch]);

  // RPC: submit arrival response
  const submitArrivalResponse = useCallback(
    async (
      responseCode: ArrivalResponseCode,
      suggestedStepCode?: SuggestedStepCode | null,
    ): Promise<boolean> => {
      if (!eventId) return false;
      setActionLoading(true);
      setActionError(null);
      setActionSuccess(null);

      try {
        const { error: rpcError } = await supabase.rpc(
          "submit_repair_response",
          {
            p_event_id: eventId,
            p_phase: "arrival",
            p_response_code: responseCode,
            p_suggested_step_code:
              responseCode === "suggest_next_step"
                ? suggestedStepCode || null
                : null,
          },
        );

        if (rpcError) throw rpcError;

        await refetchRepairData();
        onEventRefetch?.();
        setActionSuccess("Your initial response has been shared.");
        return true;
      } catch (err: unknown) {
        const techMsg =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : String(err);
        console.error("submit_repair_response (arrival) failed:", techMsg);
        setActionError(formatDatabaseErrorMessage(err));
        return false;
      } finally {
        if (isMountedRef.current) {
          setActionLoading(false);
        }
      }
    },
    [eventId, refetchRepairData, onEventRefetch],
  );

  // RPC: submit settlement response
  const submitSettlementResponse = useCallback(
    async (responseCode: SettlementResponseCode): Promise<boolean> => {
      if (!eventId) return false;
      setActionLoading(true);
      setActionError(null);
      setActionSuccess(null);

      try {
        const { error: rpcError } = await supabase.rpc(
          "submit_repair_response",
          {
            p_event_id: eventId,
            p_phase: "settlement",
            p_response_code: responseCode,
            p_suggested_step_code: null,
          },
        );

        if (rpcError) throw rpcError;

        await refetchRepairData();
        onEventRefetch?.();
        setActionSuccess("Where you stand has been shared.");
        return true;
      } catch (err: unknown) {
        const techMsg =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : String(err);
        console.error("submit_repair_response (settlement) failed:", techMsg);
        setActionError(formatDatabaseErrorMessage(err));
        return false;
      } finally {
        if (isMountedRef.current) {
          setActionLoading(false);
        }
      }
    },
    [eventId, refetchRepairData, onEventRefetch],
  );

  // RPC: complete reconnection
  const completeReconnection = useCallback(
    async (
      takeawayTag?: TakeawayTagCode | null,
      takeawayNote?: string | null,
    ): Promise<boolean> => {
      if (!eventId) return false;
      setActionLoading(true);
      setActionError(null);
      setActionSuccess(null);

      try {
        const trimmedNote = takeawayNote?.trim() ? takeawayNote.trim() : null;
        const { error: rpcError } = await supabase.rpc(
          "complete_repair_reconnection",
          {
            p_event_id: eventId,
            p_takeaway_tag: takeawayTag || null,
            p_takeaway_note: trimmedNote,
          },
        );

        if (rpcError) throw rpcError;

        await refetchRepairData();
        onEventRefetch?.();
        setActionSuccess("Reconnection completed.");
        return true;
      } catch (err: unknown) {
        const techMsg =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : String(err);
        console.error("complete_repair_reconnection failed:", techMsg);
        setActionError(formatDatabaseErrorMessage(err));
        return false;
      } finally {
        if (isMountedRef.current) {
          setActionLoading(false);
        }
      }
    },
    [eventId, refetchRepairData, onEventRefetch],
  );

  // Private reflection: save (existence-aware insert vs update, no upsert)
  const savePrivateReflection = useCallback(
    async (note: string): Promise<boolean> => {
      if (!eventId || !currentUserId) return false;
      setReflectionLoading(true);
      setReflectionError(null);

      try {
        const trimmed = note.trim();
        if (!trimmed) {
          setReflectionError("Private reflection cannot be empty.");
          return false;
        }

        // 1. Determine whether reflection exists for this author on this event
        let existingId = privateReflectionId;
        if (!existingId && privateNote === null) {
          const { data: checkRow, error: checkError } = await supabase
            .from("event_private_reflections")
            .select("id")
            .eq("event_id", eventId)
            .eq("author_id", currentUserId)
            .maybeSingle();

          if (!checkError && checkRow?.id) {
            existingId = checkRow.id;
            setPrivateReflectionId(checkRow.id);
          }
        }

        if (existingId || privateNote !== null) {
          // UPDATE only: note = trimmed note
          // Filter by event_id and author_id = currentUserId
          // Payload contains ONLY note
          const { error: updateError } = await supabase
            .from("event_private_reflections")
            .update({ note: trimmed })
            .eq("event_id", eventId)
            .eq("author_id", currentUserId);

          if (updateError) throw updateError;

          setPrivateNote(trimmed);
          return true;
        } else {
          // INSERT only: event_id, author_id, note
          const { data: insertRow, error: insertError } = await supabase
            .from("event_private_reflections")
            .insert({
              event_id: eventId,
              author_id: currentUserId,
              note: trimmed,
            })
            .select("id")
            .maybeSingle();

          if (insertError) {
            // Check for PostgreSQL unique-violation code 23505
            const isUniqueViolation =
              insertError.code === "23505" ||
              (typeof insertError.message === "string" &&
                (insertError.message.includes("23505") ||
                  insertError.message.toLowerCase().includes("unique")));

            if (isUniqueViolation) {
              // Race condition: row was inserted concurrently. Retry with UPDATE of note only.
              const { data: racedRow, error: refetchError } = await supabase
                .from("event_private_reflections")
                .select("id")
                .eq("event_id", eventId)
                .eq("author_id", currentUserId)
                .maybeSingle();

              if (refetchError) throw refetchError;

              const { error: retryUpdateError } = await supabase
                .from("event_private_reflections")
                .update({ note: trimmed })
                .eq("event_id", eventId)
                .eq("author_id", currentUserId);

              if (retryUpdateError) throw retryUpdateError;

              if (racedRow?.id) {
                setPrivateReflectionId(racedRow.id);
              }
              setPrivateNote(trimmed);
              return true;
            }

            throw insertError;
          }

          if (insertRow?.id) {
            setPrivateReflectionId(insertRow.id);
          }
          setPrivateNote(trimmed);
          return true;
        }
      } catch (err: unknown) {
        const techMsg =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : String(err);
        console.error("savePrivateReflection failed:", techMsg);
        setReflectionError(formatDatabaseErrorMessage(err));
        return false;
      } finally {
        if (isMountedRef.current) {
          setReflectionLoading(false);
        }
      }
    },
    [eventId, currentUserId, privateReflectionId, privateNote],
  );

  // Private reflection: delete
  const deletePrivateReflection = useCallback(async (): Promise<boolean> => {
    if (!eventId || !currentUserId) return false;
    setReflectionLoading(true);
    setReflectionError(null);

    try {
      const { error: deleteError } = await supabase
        .from("event_private_reflections")
        .delete()
        .eq("event_id", eventId)
        .eq("author_id", currentUserId);

      if (deleteError) throw deleteError;

      setPrivateReflectionId(null);
      setPrivateNote(null);
      return true;
    } catch (err: unknown) {
      const techMsg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err);
      console.error("deletePrivateReflection failed:", techMsg);
      setReflectionError(formatDatabaseErrorMessage(err));
      return false;
    } finally {
      if (isMountedRef.current) {
        setReflectionLoading(false);
      }
    }
  }, [eventId, currentUserId]);

  const derivedStage = deriveRepairStage(
    eventStatus,
    repairOutcome !== null,
    arrivalResponse,
    mySettlement,
    partnerSettlement,
  );

  return {
    loading,
    error,
    actionLoading,
    actionError,
    actionSuccess,
    clearActionError: () => setActionError(null),
    clearActionSuccess: () => setActionSuccess(null),
    arrivalResponse,
    mySettlement,
    partnerSettlement,
    repairOutcome,
    privateNote,
    reflectionLoading,
    reflectionError,
    derivedStage,
    submitArrivalResponse,
    submitSettlementResponse,
    completeReconnection,
    savePrivateReflection,
    deletePrivateReflection,
    refetchRepairData,
  };
}
