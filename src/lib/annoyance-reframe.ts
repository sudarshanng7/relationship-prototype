import type { SupabaseClient } from "@supabase/supabase-js";

export type AnnoyanceTopicKey = "coffee_mug" | "socks" | "directions" | "other";
export type ReframeToneKey = "gentle" | "playful" | "exaggerated";
export type ReframeStatus = "draft" | "active" | "dismissed" | "resolved";

export interface AnnoyanceReframeRow {
  id: string;
  couple_id: string;
  author_id: string;
  event_id?: string | null;
  topic_key: string;
  custom_topic_label?: string | null;
  is_playful: boolean;
  reframe_tone?: ReframeToneKey | null;
  reframe_text?: string | null;
  include_reframe_with_partner: boolean;
  status: ReframeStatus;
  shared_with_partner: boolean;
  challenge_idea?: string | null;
  challenge_participant?: "me" | "partner" | "both" | null;
  challenge_timeframe?: string | null;
  challenge_reward?: string | null;
  created_at: string;
  updated_at: string;
  // Author-only joined field
  private_irritation_input?: string | null;
}

export interface SaveAnnoyanceReframeInput {
  id?: string;
  coupleId: string;
  authorId: string;
  eventId?: string | null;
  topicKey?: string;
  customTopicLabel?: string | null;
  privateIrritationInput?: string | null;
  isPlayful?: boolean;
  reframeTone?: ReframeToneKey | null;
  reframeText?: string | null;
  includeReframeWithPartner?: boolean;
  status?: ReframeStatus;
  sharedWithPartner?: boolean;
  challengeIdea?: string | null;
  challengeParticipant?: "me" | "partner" | "both" | null;
  challengeTimeframe?: string | null;
  challengeReward?: string | null;
  clearReframeText?: boolean;
  clearPrivateNote?: boolean;
}

/**
 * Validates custom topic label length and formatting.
 */
export function validateCustomTopic(
  topicKey?: string,
  customLabel?: string | null,
): { valid: boolean; error?: string } {
  if (topicKey === "other") {
    if (!customLabel || !customLabel.trim()) {
      return { valid: false, error: "Please enter a name for this topic." };
    }
    if (customLabel.trim().length > 60) {
      return { valid: false, error: "Topic name must be 60 characters or fewer." };
    }
  }
  return { valid: true };
}

/**
 * Atomically persists an annoyance reframe and its author-only private note in Supabase via RPC.
 * Correctly distinguishes omitted fields (preserved) from explicitly cleared fields.
 */
export async function saveAnnoyanceReframe(
  supabase: SupabaseClient,
  input: SaveAnnoyanceReframeInput,
): Promise<{ data: AnnoyanceReframeRow | null; error: Error | null }> {
  try {
    if (input.topicKey) {
      const { valid, error: validationErr } = validateCustomTopic(
        input.topicKey,
        input.customTopicLabel,
      );
      if (!valid) {
        return { data: null, error: new Error(validationErr) };
      }
    }

    const trimmedCustom =
      input.topicKey === "other" && input.customTopicLabel
        ? input.customTopicLabel.trim()
        : input.customTopicLabel !== undefined
        ? input.customTopicLabel
        : null;

    const privateText = input.privateIrritationInput?.trim() || null;

    const { data: savedId, error: rpcError } = await supabase.rpc(
      "save_annoyance_reframe",
      {
        p_couple_id: input.coupleId,
        p_topic_key: input.topicKey || null,
        p_custom_topic_label: trimmedCustom,
        p_is_playful: input.isPlayful !== undefined ? input.isPlayful : true,
        p_reframe_tone: input.reframeTone || null,
        p_reframe_text: input.reframeText ? input.reframeText.trim() : null,
        p_include_reframe_with_partner:
          input.includeReframeWithPartner !== undefined
            ? input.includeReframeWithPartner
            : null,
        p_status: input.status || null,
        p_shared_with_partner:
          input.sharedWithPartner !== undefined
            ? input.sharedWithPartner
            : null,
        p_challenge_idea: input.challengeIdea ? input.challengeIdea.trim() : null,
        p_challenge_participant: input.challengeParticipant || null,
        p_challenge_timeframe: input.challengeTimeframe || null,
        p_challenge_reward: input.challengeReward || null,
        p_private_note: privateText,
        p_id: input.id || null,
        p_event_id: input.eventId || null,
        p_clear_reframe_text: Boolean(input.clearReframeText),
        p_clear_private_note: Boolean(input.clearPrivateNote),
      },
    );

    if (rpcError || !savedId) {
      return {
        data: null,
        error: rpcError ? new Error(rpcError.message) : new Error("Failed to save reframe"),
      };
    }

    return await fetchAnnoyanceReframe(supabase, savedId, input.authorId);
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Fetches an annoyance reframe by ID, including private irritation note if caller is author.
 */
export async function fetchAnnoyanceReframe(
  supabase: SupabaseClient,
  reframeId: string,
  currentUserId: string,
): Promise<{ data: AnnoyanceReframeRow | null; error: Error | null }> {
  try {
    const { data: reframe, error: reframeError } = await supabase
      .from("annoyance_reframes")
      .select("*")
      .eq("id", reframeId)
      .single();

    if (reframeError || !reframe) {
      return { data: null, error: reframeError || new Error("Reframe not found") };
    }

    let privateNote: string | null = null;
    if (reframe.author_id === currentUserId) {
      const { data: noteRow } = await supabase
        .from("annoyance_private_notes")
        .select("private_note")
        .eq("reframe_id", reframeId)
        .eq("author_id", currentUserId)
        .maybeSingle();

      if (noteRow?.private_note) {
        privateNote = noteRow.private_note;
      }
    }

    return {
      data: {
        ...reframe,
        private_irritation_input: privateNote,
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Updates lifecycle status (draft -> active -> resolved | dismissed).
 */
export async function updateReframeStatus(
  supabase: SupabaseClient,
  reframeId: string,
  status: ReframeStatus,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("annoyance_reframes")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", reframeId);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Partner responds to an active, shared challenge invitation in the database.
 */
export async function respondToAnnoyanceChallenge(
  supabase: SupabaseClient,
  reframeId: string,
  action: "accept" | "dismiss",
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase.rpc("respond_to_annoyance_challenge", {
      p_reframe_id: reframeId,
      p_action: action,
    });
    if (error) {
      return { success: false, error: new Error(error.message) };
    }
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Safely fetches active partner-authored challenge invitations via SECURITY DEFINER RPC.
 * Base-table RLS denies direct partner SELECT. This RPC ensures:
 * - auth.uid() member of couple
 * - author_id <> auth.uid()
 * - reframe_text is masked (NULL) unless include_reframe_with_partner is true
 * - private irritation notes are never returned
 */
export async function fetchActivePartnerAnnoyanceChallenges(
  supabase: SupabaseClient,
  coupleId: string,
): Promise<{ data: AnnoyanceReframeRow[]; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc(
      "get_active_partner_annoyance_challenges",
      {
        p_couple_id: coupleId,
      },
    );
    if (error) {
      return { data: [], error: new Error(error.message) };
    }
    return { data: (data || []) as AnnoyanceReframeRow[], error: null };
  } catch (err: any) {
    return {
      data: [],
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}
