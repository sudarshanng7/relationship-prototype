import { getThemedTokens, tokens } from "@/components/couply-tokens";
import {
  CouplyChoiceCard,
  CouplyHeader,
  CouplyPrimaryButton,
  CouplyQuietButton,
  CouplySectionCard,
  CouplyStatusPill,
} from "@/components/CouplyUI";
import { ThemeColors, useTheme } from "@/context/ThemeContext";
import { useUserIdentity } from "@/context/UserIdentityContext";
import { supabase } from "@/lib/supabase";
import { formatCategory } from "@/lib/event-heading";
import {
  ArrivalResponseCode,
  SettlementResponseCode,
  SETTLEMENT_LABELS,
  SuggestedStepCode,
  SUGGESTED_STEP_LABELS,
  TakeawayTagCode,
  TAKEAWAY_TAG_LABELS,
  useRepairWorkflow,
} from "@/lib/use-repair-workflow";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type RelationshipEvent = {
  id: string;
  creator_id: string;
  event_type: "positive" | "friction";
  category: string;
  intensity: number | null;
  shared_topic: string | null;
  visibility: "mine" | "ours";
  status: "open" | "partially_repaired" | "reconnected" | null;
  repair_method: string | null;
  reconnected_at: string | null;
  created_at: string;
};

const repairMethods = [
  { value: "talking", label: "Talking" },
  { value: "space", label: "Space" },
  { value: "apology", label: "Apology" },
  { value: "affection", label: "Affection" },
  { value: "humour", label: "Humour" },
  { value: "practical_action", label: "Practical action" },
  { value: "time", label: "Time" },
  { value: "other", label: "Other" },
];

export default function EventDetailScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const params = useLocalSearchParams<{
    id?: string | string[];
    scope?: string;
  }>();

  const eventId = Array.isArray(params.id) ? params.id[0] : params.id;
  const scopeParam = Array.isArray(params.scope)
    ? params.scope[0]
    : params.scope;

  const [event, setEvent] = useState<RelationshipEvent | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Loading...");
  const [showRepairMethods, setShowRepairMethods] = useState(false);

  const { displayName, partnerName, partnerRef } = useUserIdentity();

  const [showSharingControls, setShowSharingControls] = useState(false);
  const [sharedTopicInput, setSharedTopicInput] = useState("");
  const [changingVisibility, setChangingVisibility] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Local drafting state for user actions (not saved until explicitly shared)
  const [draftArrivalCode, setDraftArrivalCode] =
    useState<ArrivalResponseCode | null>(null);
  const [draftSuggestedStep, setDraftSuggestedStep] =
    useState<SuggestedStepCode | null>(null);
  const [isEditingArrival, setIsEditingArrival] = useState(false);

  const [draftSettlementCode, setDraftSettlementCode] =
    useState<SettlementResponseCode | null>(null);
  const [isEditingSettlement, setIsEditingSettlement] = useState(false);

  const [takeawayTag, setTakeawayTag] = useState<TakeawayTagCode | null>(null);
  const [takeawayNote, setTakeawayNote] = useState("");

  const [isEditingReflection, setIsEditingReflection] = useState(false);
  const [reflectionInput, setReflectionInput] = useState("");

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  async function loadEvent() {
    if (!eventId) {
      setStatusMessage("Invalid event.");
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/");
      return;
    }

    setCurrentUserId(user.id);

    const { data, error } = await supabase
      .from("relationship_events")
      .select(
        `
        id,
        creator_id,
        event_type,
        category,
        intensity,
        shared_topic,
        visibility,
        status,
        repair_method,
        reconnected_at,
        created_at
      `,
      )
      .eq("id", eventId)
      .maybeSingle();

    if (error) {
      console.error("loadEvent error:", error.message);
      setStatusMessage(error.message);
      return;
    }

    if (!data) {
      setEvent(null);
      setStatusMessage(
        "Event not found or you do not have permission to view it.",
      );
      return;
    }

    setEvent(data as RelationshipEvent);
    setStatusMessage("");
  }

  // Hook for real repair workflow persistence, RPCs, and Realtime sync
  const repairWorkflow = useRepairWorkflow({
    eventId: event?.id,
    currentUserId,
    creatorId: event?.creator_id,
    eventStatus: event?.status,
    onEventRefetch: loadEvent,
  });

  async function updateEventStatus(newStatus: "open" | "partially_repaired") {
    if (!event) return;

    setStatusMessage("Updating...");

    const { error } = await supabase
      .from("relationship_events")
      .update({
        status: newStatus,
        repair_method: null,
        reconnected_at: null,
      })
      .eq("id", event.id);

    if (error) {
      console.error("updateEventStatus error:", error.message);
      setStatusMessage(error.message);
      return;
    }

    setShowRepairMethods(false);
    await loadEvent();
    setStatusMessage("Updated");
  }

  async function markReconnected(repairMethod: string) {
    if (!event) return;

    setStatusMessage("Saving repair...");

    const { error } = await supabase
      .from("relationship_events")
      .update({
        status: "reconnected",
        repair_method: repairMethod,
        reconnected_at: new Date().toISOString(),
      })
      .eq("id", event.id);

    if (error) {
      console.error("markReconnected error:", error.message);
      setStatusMessage(error.message);
      return;
    }

    setShowRepairMethods(false);
    await loadEvent();
    setStatusMessage("Repair saved");
  }

  async function changeMomentVisibility(newVisibility: "mine" | "ours") {
    if (!event || !currentUserId) return;
    if (event.creator_id !== currentUserId) return;
    if (changingVisibility) return;

    const topic = newVisibility === "ours" ? sharedTopicInput.trim() : null;

    if (newVisibility === "ours" && !topic) {
      setStatusMessage("Please enter a topic to share.");
      return;
    }

    setChangingVisibility(true);
    setStatusMessage("Updating sharing...");

    try {
      const { error } = await supabase.rpc("set_moment_visibility", {
        p_event_id: event.id,
        p_visibility: newVisibility,
        p_shared_topic: topic,
      });

      if (error) throw error;

      setSharedTopicInput("");
      setShowSharingControls(false);

      await loadEvent();

      setStatusMessage(
        newVisibility === "ours"
          ? "Moment shared with your partner."
          : "Moment moved to Mine. Shared topic cleared.",
      );
    } catch (error) {
      console.error(
        "Visibility change failed:",
        error instanceof Error ? error.message : "unknown",
      );
      setStatusMessage(
        error instanceof Error ? error.message : "Could not change visibility.",
      );
    } finally {
      setChangingVisibility(false);
    }
  }

  async function deleteEvent() {
    if (!event) return;

    setStatusMessage("Deleting moment...");

    const { error } = await supabase
      .from("relationship_events")
      .delete()
      .eq("id", event.id);

    if (error) {
      console.error("deleteEvent error:", error.message);
      setStatusMessage(error.message);
      return;
    }

    router.back();
  }

  const returnScope =
    scopeParam === "mine" || scopeParam === "ours" || scopeParam === "moments"
      ? scopeParam
      : event?.visibility === "mine" || event?.visibility === "ours"
      ? event.visibility
      : null;

  const backLabel =
    returnScope === "mine"
      ? "‹ Back to Mine"
      : returnScope === "ours"
      ? "‹ Back to Our Space"
      : "‹ Back to Moments";

  const backAccessibilityLabel =
    returnScope === "mine"
      ? "Back to Mine"
      : returnScope === "ours"
      ? "Back to Our Space"
      : "Back to Moments";

  function handleBack() {
    if (returnScope === "mine") {
      router.replace("/events?scope=mine");
    } else if (returnScope === "ours") {
      router.replace("/events?scope=ours");
    } else {
      router.replace("/events");
    }
  }

  const screenTitle =
    returnScope === "mine"
      ? "Mine"
      : returnScope === "ours"
      ? "Our Space"
      : "Moments";

  if (!event) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.column}>
            <CouplyHeader
              title={screenTitle}
              onBack={handleBack}
              backLabel={backLabel}
            />
            <View style={styles.centerContainer}>
              <Text style={styles.centerStatusText}>{statusMessage}</Text>
              <Pressable
                style={styles.centerBackButton}
                onPress={handleBack}
                accessibilityRole="button"
                accessibilityLabel={backAccessibilityLabel}
              >
                <Text style={styles.centerBackButtonText}>{backLabel}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const isCreator = event.creator_id === currentUserId;
  const isPositive = event.event_type === "positive";
  const isSharedFriction = !isPositive && event.visibility === "ours";

  const partnerDisplayName = partnerName || "your partner";
  const creatorDisplayName = isCreator
    ? displayName || "You"
    : partnerDisplayName;
  const recipientDisplayName = isCreator
    ? partnerDisplayName
    : displayName || "You";

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.column}>
          <CouplyHeader
            title={screenTitle}
            onBack={handleBack}
            backLabel={backLabel}
          />
          {/* B. Moment Context Card */}
          <CouplySectionCard>
            <View style={styles.momentCardTopRow}>
              <Text style={styles.momentOverline}>
                {isSharedFriction
                  ? "SHARED MOMENT"
                  : isPositive
                  ? "GOOD MOMENT"
                  : "PRIVATE MOMENT"}
              </Text>
              <CouplyStatusPill
                label={
                  isSharedFriction
                    ? repairWorkflow.derivedStage === "reconnected"
                      ? "Reconnected"
                      : repairWorkflow.derivedStage === "both_ready"
                      ? "Ready"
                      : repairWorkflow.derivedStage === "reconnecting"
                      ? "Reconnecting"
                      : repairWorkflow.derivedStage === "in_care"
                      ? "In care"
                      : "Open"
                    : isPositive
                    ? "Good moment"
                    : formatStatus(event.status)
                }
                variant={
                  isSharedFriction
                    ? repairWorkflow.derivedStage === "reconnected"
                      ? "reconnected"
                      : repairWorkflow.derivedStage === "both_ready"
                      ? "softening"
                      : repairWorkflow.derivedStage === "reconnecting"
                      ? "softening"
                      : repairWorkflow.derivedStage === "in_care"
                      ? "softening"
                      : "open"
                    : isPositive
                    ? "positive"
                    : event.status === "reconnected"
                    ? "reconnected"
                    : event.status === "partially_repaired"
                    ? "softening"
                    : "open"
                }
              />
            </View>

            <Text style={styles.categoryTitle}>
              {formatCategory(event.category)}
            </Text>

            {isSharedFriction && event.shared_topic ? (
              <View style={styles.sharedTopicContextBox}>
                <Text style={styles.sharedTopicContextLabel}>
                  Shared context
                </Text>
                <Text style={styles.sharedTopicContextText}>
                  {event.shared_topic}
                </Text>
              </View>
            ) : null}

            <View style={styles.summaryMetaRow}>
              <Text style={styles.metaRecordedDate}>
                Recorded {formatDate(event.created_at)}
                {event.visibility === "ours"
                  ? ` · ${
                      isCreator
                        ? "Recorded by you"
                        : `Shared by ${partnerName || "partner"}`
                    }`
                  : ""}
              </Text>
              {!isPositive &&
                event.intensity !== null &&
                (!isSharedFriction || isCreator) && (
                  <View style={styles.intensityPill}>
                    <Text style={styles.intensityPillText}>
                      It weighed on you: {event.intensity} of 5
                    </Text>
                  </View>
                )}
            </View>
          </CouplySectionCard>

          {/* Shared wording card (Ours & topic exists) */}
          {event.visibility === "ours" && event.shared_topic && (
            <CouplySectionCard
              variant="default"
              style={styles.privacyCardSpacing}
            >
              <View style={styles.privacyCardHeaderRow}>
                <View style={styles.sharedPill}>
                  <Text style={styles.sharedPillText}>
                    {isCreator
                      ? `Shared with ${partnerRef}`
                      : `Shared by ${partnerDisplayName}`}
                  </Text>
                </View>
              </View>
              <Text style={styles.noteBodyText}>{event.shared_topic}</Text>
            </CouplySectionCard>
          )}

          {/* Positive moment outcome */}
          {isPositive && (
            <CouplySectionCard variant="lilac">
              <Text style={styles.positiveOutcomeTitle}>
                A good moment, kept with care.
              </Text>
              <Text style={styles.positiveOutcomeSubtitle}>
                {event.visibility === "mine"
                  ? "Kept privately for you. You can revisit this whenever you need."
                  : `Part of your shared story with ${partnerRef}.`}
              </Text>
            </CouplySectionCard>
          )}

          {/* Friction current state (Mine friction only) */}
          {!isPositive && !isSharedFriction && (
            <CouplySectionCard>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Where this stands</Text>
                <CouplyStatusPill
                  label={formatStatus(event.status)}
                  variant={
                    event.status === "reconnected"
                      ? "reconnected"
                      : event.status === "partially_repaired"
                      ? "softening"
                      : "open"
                  }
                />
              </View>

              <Text style={styles.statusGuidanceText}>
                {event.status === "reconnected"
                  ? "Taking time to repair helps you stay close."
                  : event.visibility === "mine"
                  ? "Kept privately for you. You can revisit this whenever you need."
                  : "Tension can take time to ease. You can update this whenever things shift."}
              </Text>

              {event.repair_method && (
                <View style={[styles.statusRow, { marginTop: 10 }]}>
                  <Text style={styles.statusLabel}>What helped</Text>
                  <Text style={styles.statusMethodText}>
                    {formatCategory(event.repair_method)}
                  </Text>
                </View>
              )}

              {event.reconnected_at && (
                <View style={[styles.statusRow, { marginTop: 8 }]}>
                  <Text style={styles.statusLabel}>Reconnected</Text>
                  <Text style={styles.statusSubtext}>
                    {formatDate(event.reconnected_at)}
                  </Text>
                </View>
              )}
            </CouplySectionCard>
          )}

          {/* D. REAL SHARED FRICTION REPAIR JOURNEY */}
          {isSharedFriction && (
            <View style={styles.journeyContainer}>
              {/* Journey Header */}
              <View style={styles.journeyHeaderBlock}>
                <Text style={styles.journeyOverline}>REPAIR JOURNEY</Text>
                <Text style={styles.journeyHeading}>A small way forward</Text>
                <Text style={styles.journeySupportingText}>
                  There is no rush. Each person can respond in their own time.
                </Text>
              </View>

              {/* Action Error / Success Feedback */}
              {repairWorkflow.actionError ? (
                <View style={styles.statusBanner}>
                  <Text
                    style={[
                      styles.statusBannerText,
                      { color: tokens.colors.dangerText },
                    ]}
                  >
                    {repairWorkflow.actionError}
                  </Text>
                </View>
              ) : null}

              {repairWorkflow.actionSuccess ? (
                <View
                  style={[
                    styles.statusBanner,
                    { borderColor: tokens.colors.plum },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBannerText,
                      { color: tokens.colors.plum },
                    ]}
                  >
                    {repairWorkflow.actionSuccess}
                  </Text>
                </View>
              ) : null}

              {/* Stage: Reconnected Outcome */}
              {repairWorkflow.derivedStage === "reconnected" ? (
                <CouplySectionCard
                  variant="lilac"
                  style={styles.reconnectedSection}
                >
                  <View style={styles.reconnectedHeaderRow}>
                    <Text style={styles.reconnectedEmoji}>🌱</Text>
                    <View style={styles.reconnectedTitleGroup}>
                      <Text style={styles.reconnectingOverline}>
                        RECONNECTED
                      </Text>
                      <Text style={styles.reconnectedHeading}>
                        We found our way back.
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.reconnectedBody}>
                    This moment has been tenderly resolved and reconnected.
                    Everything you navigated together remains part of your
                    shared care.
                  </Text>
                  <Text style={styles.statusSubtext}>
                    Reconnected on{" "}
                    {formatDate(
                      repairWorkflow.repairOutcome?.completed_at ||
                        event.reconnected_at ||
                        event.created_at,
                    )}
                  </Text>

                  {repairWorkflow.repairOutcome?.takeaway_tag && (
                    <View style={styles.sharedTakeawayPill}>
                      <Text style={styles.sharedTakeawayPillText}>
                        What helped:{" "}
                        {TAKEAWAY_TAG_LABELS[
                          repairWorkflow.repairOutcome
                            .takeaway_tag as TakeawayTagCode
                        ] || repairWorkflow.repairOutcome.takeaway_tag}
                      </Text>
                    </View>
                  )}

                  {repairWorkflow.repairOutcome?.takeaway_note && (
                    <View style={styles.sharedTakeawayCard}>
                      <Text style={styles.sharedTakeawayOverline}>
                        SHARED TAKEAWAY
                      </Text>
                      <Text style={styles.sharedTakeawayBodyText}>
                        “{repairWorkflow.repairOutcome.takeaway_note}”
                      </Text>
                    </View>
                  )}
                </CouplySectionCard>
              ) : (
                /* Active Stages: Open, In Care, Reconnecting, Both Ready */
                <CouplySectionCard style={styles.nextActionCard}>
                  {/* Phase 1: Arrival */}
                  {!repairWorkflow.arrivalResponse ? (
                    /* No recipient response yet */
                    isCreator ? (
                      <View style={styles.stageContentBlock}>
                        <View style={styles.nextActionHeader}>
                          <Text style={styles.nextActionOverline}>
                            INITIAL RESPONSE
                          </Text>
                          <Text style={styles.nextActionTitle}>
                            Waiting quietly for {recipientDisplayName}
                          </Text>
                        </View>
                        <View style={styles.openAlexBlock}>
                          <Text style={styles.stageBodyText}>
                            You shared this moment with {recipientDisplayName}.
                            They can respond here in their own rhythm whenever
                            they feel ready. There is nothing you need to do
                            right now.
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.stageContentBlock}>
                        <View style={styles.nextActionHeader}>
                          <Text style={styles.nextActionOverline}>
                            FIRST RESPONSE
                          </Text>
                          <Text style={styles.nextActionTitle}>
                            What feels right as a first response?
                          </Text>
                        </View>
                        <Text style={styles.stageBodyText}>
                          Respond in your own rhythm. There is no deadline,
                          score, or requirement to fix anything right away.
                        </Text>

                        <View style={styles.choicesStack}>
                          <CouplyChoiceCard
                            title="🤍 I’ve heard this"
                            description="Acknowledge without feeling pushed to debate or solve right now"
                            selected={draftArrivalCode === "heard"}
                            onPress={() => {
                              setDraftArrivalCode("heard");
                              setDraftSuggestedStep(null);
                            }}
                            accessibilityLabel="I’ve heard this: Acknowledge without feeling pushed to debate or solve right now"
                          />
                          <CouplyChoiceCard
                            title="⏳ I need a little more time"
                            description="Signal care while taking gentle breathing room"
                            selected={draftArrivalCode === "need_time"}
                            onPress={() => {
                              setDraftArrivalCode("need_time");
                              setDraftSuggestedStep(null);
                            }}
                            accessibilityLabel="I need a little more time: Signal care while taking gentle breathing room"
                          />
                          <CouplyChoiceCard
                            title="🌿 I’d like to suggest a small next step"
                            description="Propose a kind, concrete step to help you both soften"
                            selected={draftArrivalCode === "suggest_next_step"}
                            onPress={() => {
                              setDraftArrivalCode("suggest_next_step");
                              if (!draftSuggestedStep) {
                                setDraftSuggestedStep("quiet_chat");
                              }
                            }}
                            accessibilityLabel="Suggest a small next step: Propose a kind, concrete step to help you both soften"
                          />
                        </View>

                        {draftArrivalCode === "suggest_next_step" && (
                          <View style={styles.nextStepChooserBlock}>
                            <Text style={styles.nextStepChooserHeading}>
                              What might feel easier?
                            </Text>
                            <View style={styles.stepChipsRow}>
                              {(
                                [
                                  "quiet_chat",
                                  "warm_hug",
                                  "walk_outside",
                                  "quiet_time_together",
                                  "tea_together",
                                ] as SuggestedStepCode[]
                              ).map((step) => {
                                const isSelected =
                                  (draftSuggestedStep || "quiet_chat") === step;
                                return (
                                  <Pressable
                                    key={step}
                                    style={[
                                      styles.stepChip,
                                      isSelected && styles.stepChipSelected,
                                    ]}
                                    onPress={() => setDraftSuggestedStep(step)}
                                    accessibilityRole="button"
                                    accessibilityState={{
                                      selected: isSelected,
                                    }}
                                    accessibilityLabel={
                                      SUGGESTED_STEP_LABELS[step]
                                    }
                                  >
                                    <Text
                                      style={[
                                        styles.stepChipText,
                                        isSelected &&
                                          styles.stepChipTextSelected,
                                      ]}
                                    >
                                      {SUGGESTED_STEP_LABELS[step]}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        )}

                        {draftArrivalCode !== null && (
                          <View style={styles.reviewCard}>
                            <Text style={styles.reviewCardOverline}>
                              YOUR FIRST RESPONSE
                            </Text>
                            <Text style={styles.reviewCardHeading}>
                              {draftArrivalCode === "heard"
                                ? "You chose to acknowledge this."
                                : draftArrivalCode === "need_time"
                                ? "You chose to take a little more time."
                                : "You chose to suggest a small next step."}
                            </Text>
                            <Text style={styles.reviewCardBody}>
                              Share this response with {creatorDisplayName}. You
                              can revise it later if things shift.
                            </Text>
                            <View style={styles.reviewCardActionsRow}>
                              <CouplyPrimaryButton
                                label={
                                  repairWorkflow.actionLoading
                                    ? "Sharing..."
                                    : `Share with ${creatorDisplayName}`
                                }
                                disabled={repairWorkflow.actionLoading}
                                onPress={async () => {
                                  const ok =
                                    await repairWorkflow.submitArrivalResponse(
                                      draftArrivalCode,
                                      draftArrivalCode === "suggest_next_step"
                                        ? draftSuggestedStep || "quiet_chat"
                                        : null,
                                    );
                                  if (ok) {
                                    setDraftArrivalCode(null);
                                    setDraftSuggestedStep(null);
                                  }
                                }}
                                accessibilityLabel={`Share with ${creatorDisplayName}`}
                              />
                              <CouplyQuietButton
                                variant="text"
                                label="Keep deciding"
                                disabled={repairWorkflow.actionLoading}
                                onPress={() => {
                                  setDraftArrivalCode(null);
                                  setDraftSuggestedStep(null);
                                }}
                                accessibilityLabel="Keep deciding"
                              />
                            </View>
                          </View>
                        )}
                      </View>
                    )
                  ) : (
                    /* Recipient arrival response already exists - both see it */
                    <View style={styles.stageContentBlock}>
                      <View style={styles.responseDisplayBanner}>
                        <Text style={styles.responseDisplayTitle}>
                          {!isCreator
                            ? repairWorkflow.arrivalResponse.response_code ===
                              "heard"
                              ? "🤍 You shared: 'I’ve heard this'"
                              : repairWorkflow.arrivalResponse.response_code ===
                                "need_time"
                              ? "⏳ You shared: 'I need a little more time'"
                              : `🌿 You suggested: ${
                                  repairWorkflow.arrivalResponse
                                    .suggested_step_code
                                    ? SUGGESTED_STEP_LABELS[
                                        repairWorkflow.arrivalResponse
                                          .suggested_step_code as SuggestedStepCode
                                      ] ||
                                      repairWorkflow.arrivalResponse
                                        .suggested_step_code
                                    : "A small next step"
                                }`
                            : repairWorkflow.arrivalResponse.response_code ===
                              "heard"
                            ? `🤍 ${recipientDisplayName} has heard this.`
                            : repairWorkflow.arrivalResponse.response_code ===
                              "need_time"
                            ? `⏳ ${recipientDisplayName} needs a little more time.`
                            : `🌿 ${recipientDisplayName} suggested: ${
                                repairWorkflow.arrivalResponse
                                  .suggested_step_code
                                  ? SUGGESTED_STEP_LABELS[
                                      repairWorkflow.arrivalResponse
                                        .suggested_step_code as SuggestedStepCode
                                    ] ||
                                    repairWorkflow.arrivalResponse
                                      .suggested_step_code
                                  : "A small next step"
                              }`}
                        </Text>
                        <Text style={styles.responseDisplayBody}>
                          Shared{" "}
                          {formatDate(
                            repairWorkflow.arrivalResponse.shared_at,
                          )}
                          {repairWorkflow.arrivalResponse.updated_at !==
                          repairWorkflow.arrivalResponse.shared_at
                            ? ` (revised ${formatDate(repairWorkflow.arrivalResponse.updated_at)})`
                            : ""}
                        </Text>

                        {!isCreator &&
                          (!isEditingArrival ? (
                            <Pressable
                              style={styles.changeResponseButton}
                              onPress={() => {
                                setDraftArrivalCode(
                                  (repairWorkflow.arrivalResponse
                                    ?.response_code as ArrivalResponseCode) ||
                                    "heard",
                                );
                                setDraftSuggestedStep(
                                  (repairWorkflow.arrivalResponse
                                    ?.suggested_step_code as SuggestedStepCode) ||
                                    null,
                                );
                                setIsEditingArrival(true);
                              }}
                              accessibilityRole="button"
                              accessibilityLabel="Revise initial response"
                            >
                              <Text style={styles.changeResponseText}>
                                Revise initial response
                              </Text>
                            </Pressable>
                          ) : (
                            <View style={{ marginTop: 10, gap: 10 }}>
                              <Text style={styles.stageSubheading}>
                                Revise your first response
                              </Text>
                              <View style={styles.choicesStack}>
                                <CouplyChoiceCard
                                  title="🤍 I’ve heard this"
                                  description="Acknowledge without feeling pushed to debate or solve right now"
                                  selected={draftArrivalCode === "heard"}
                                  onPress={() => {
                                    setDraftArrivalCode("heard");
                                    setDraftSuggestedStep(null);
                                  }}
                                  accessibilityLabel="I’ve heard this"
                                />
                                <CouplyChoiceCard
                                  title="⏳ I need a little more time"
                                  description="Signal care while taking gentle breathing room"
                                  selected={draftArrivalCode === "need_time"}
                                  onPress={() => {
                                    setDraftArrivalCode("need_time");
                                    setDraftSuggestedStep(null);
                                  }}
                                  accessibilityLabel="I need a little more time"
                                />
                                <CouplyChoiceCard
                                  title="🌿 I’d like to suggest a small next step"
                                  description="Propose a kind, concrete step to help you both soften"
                                  selected={
                                    draftArrivalCode === "suggest_next_step"
                                  }
                                  onPress={() => {
                                    setDraftArrivalCode("suggest_next_step");
                                    if (!draftSuggestedStep) {
                                      setDraftSuggestedStep("quiet_chat");
                                    }
                                  }}
                                  accessibilityLabel="Suggest a small next step"
                                />
                              </View>

                              {draftArrivalCode === "suggest_next_step" && (
                                <View style={styles.nextStepChooserBlock}>
                                  <Text style={styles.nextStepChooserHeading}>
                                    What might feel easier?
                                  </Text>
                                  <View style={styles.stepChipsRow}>
                                    {(
                                      [
                                        "quiet_chat",
                                        "warm_hug",
                                        "walk_outside",
                                        "quiet_time_together",
                                        "tea_together",
                                      ] as SuggestedStepCode[]
                                    ).map((step) => {
                                      const isSelected =
                                        (draftSuggestedStep ||
                                          "quiet_chat") === step;
                                      return (
                                        <Pressable
                                          key={step}
                                          style={[
                                            styles.stepChip,
                                            isSelected &&
                                              styles.stepChipSelected,
                                          ]}
                                          onPress={() =>
                                            setDraftSuggestedStep(step)
                                          }
                                          accessibilityRole="button"
                                          accessibilityState={{
                                            selected: isSelected,
                                          }}
                                          accessibilityLabel={
                                            SUGGESTED_STEP_LABELS[step]
                                          }
                                        >
                                          <Text
                                            style={[
                                              styles.stepChipText,
                                              isSelected &&
                                                styles.stepChipTextSelected,
                                            ]}
                                          >
                                            {SUGGESTED_STEP_LABELS[step]}
                                          </Text>
                                        </Pressable>
                                      );
                                    })}
                                  </View>
                                </View>
                              )}

                              <View style={styles.reviewCardActionsRow}>
                                <CouplyPrimaryButton
                                  label={
                                    repairWorkflow.actionLoading
                                      ? "Updating..."
                                      : `Update with ${creatorDisplayName}`
                                  }
                                  disabled={
                                    !draftArrivalCode ||
                                    repairWorkflow.actionLoading
                                  }
                                  onPress={async () => {
                                    if (!draftArrivalCode) return;
                                    const ok =
                                      await repairWorkflow.submitArrivalResponse(
                                        draftArrivalCode,
                                        draftArrivalCode === "suggest_next_step"
                                          ? draftSuggestedStep || "quiet_chat"
                                          : null,
                                      );
                                    if (ok) {
                                      setIsEditingArrival(false);
                                    }
                                  }}
                                  accessibilityLabel={`Update with ${creatorDisplayName}`}
                                />
                                <CouplyQuietButton
                                  variant="text"
                                  label="Cancel"
                                  disabled={repairWorkflow.actionLoading}
                                  onPress={() => {
                                    setDraftArrivalCode(
                                      (repairWorkflow.arrivalResponse
                                        ?.response_code as ArrivalResponseCode) ||
                                        null,
                                    );
                                    setDraftSuggestedStep(
                                      (repairWorkflow.arrivalResponse
                                        ?.suggested_step_code as SuggestedStepCode) ||
                                        null,
                                    );
                                    setIsEditingArrival(false);
                                  }}
                                  accessibilityLabel="Cancel revising initial response"
                                />
                              </View>
                            </View>
                          ))}
                      </View>

                      {/* Phase 2: Settlement (Available after arrival exists) */}
                      <View style={styles.settlementBlock}>
                        <View style={styles.journeyDivider} />
                        <View style={styles.reconnectCheckinHeader}>
                          <Text style={styles.checkInOverline}>
                            CLOSING CHECK-IN
                          </Text>
                          <Text style={styles.settlementHeading}>
                            Where do you stand?
                          </Text>
                          <Text style={styles.settlementSubtext}>
                            Share where you are whenever you feel ready. Each
                            person responds in their own time.
                          </Text>
                        </View>

                        {/* Guidance notice based on settlement state */}
                        {repairWorkflow.mySettlement?.response_code ===
                          "need_time" ||
                        repairWorkflow.partnerSettlement?.response_code ===
                          "need_time" ? (
                          <View style={styles.calmInlineNotice}>
                            <Text style={styles.calmInlineNoticeText}>
                              ⏳ More time is welcome here. There is no rush to
                              close this moment.
                            </Text>
                          </View>
                        ) : repairWorkflow.derivedStage === "reconnecting" ? (
                          <View style={styles.calmInlineNotice}>
                            <Text style={styles.calmInlineNoticeText}>
                              🌱 The issue feels settled, but connection is
                              still finding its way. There is nothing to force
                              or finish today.
                            </Text>
                          </View>
                        ) : null}

                        {/* Check-in selector: if user has not checked in OR user is editing */}
                        {!repairWorkflow.mySettlement ||
                        isEditingSettlement ? (
                          <View style={{ gap: 10 }}>
                            <View style={styles.checkInChoicesStack}>
                              <CouplyChoiceCard
                                title="🌿 I feel ready to leave this here"
                                description="Ready to gently set this moment down"
                                selected={draftSettlementCode === "ready"}
                                onPress={() => setDraftSettlementCode("ready")}
                                accessibilityLabel="I feel ready to leave this here: Ready to gently set this moment down"
                              />
                              <CouplyChoiceCard
                                title="🌱 The issue feels settled, but I’m still reconnecting"
                                description="The tension has softened, but connection is still finding its way"
                                selected={
                                  draftSettlementCode === "reconnecting"
                                }
                                onPress={() =>
                                  setDraftSettlementCode("reconnecting")
                                }
                                accessibilityLabel="The issue feels settled, but I’m still reconnecting"
                              />
                              <CouplyChoiceCard
                                title="⏳ I need more time"
                                description="More space or care is needed before closing this"
                                selected={draftSettlementCode === "need_time"}
                                onPress={() =>
                                  setDraftSettlementCode("need_time")
                                }
                                accessibilityLabel="I need more time: More space or care is needed before closing this"
                              />
                            </View>

                            <View style={styles.reviewCardActionsRow}>
                              <CouplyPrimaryButton
                                label={
                                  repairWorkflow.actionLoading
                                    ? "Sharing..."
                                    : repairWorkflow.mySettlement
                                    ? "Update where I am"
                                    : "Share where I am"
                                }
                                disabled={
                                  !draftSettlementCode ||
                                  repairWorkflow.actionLoading
                                }
                                onPress={async () => {
                                  if (!draftSettlementCode) return;
                                  const ok =
                                    await repairWorkflow.submitSettlementResponse(
                                      draftSettlementCode,
                                    );
                                  if (ok) {
                                    setIsEditingSettlement(false);
                                  }
                                }}
                                accessibilityLabel={
                                  repairWorkflow.mySettlement
                                    ? "Update where I am"
                                    : "Share where I am"
                                }
                              />
                              {repairWorkflow.mySettlement && (
                                <CouplyQuietButton
                                  variant="text"
                                  label="Cancel"
                                  disabled={repairWorkflow.actionLoading}
                                  onPress={() => {
                                    setDraftSettlementCode(
                                      (repairWorkflow.mySettlement
                                        ?.response_code as SettlementResponseCode) ||
                                        null,
                                    );
                                    setIsEditingSettlement(false);
                                  }}
                                  accessibilityLabel="Cancel editing check-in"
                                />
                              )}
                            </View>
                          </View>
                        ) : (
                          /* Current user shared status */
                          <View style={styles.currentSharedCheckInCard}>
                            <Text style={styles.checkInOverline}>
                              YOUR CHECK-IN
                            </Text>
                            <Text style={styles.currentSharedCheckInTitle}>
                              {SETTLEMENT_LABELS[
                                repairWorkflow.mySettlement
                                  .response_code as SettlementResponseCode
                              ]?.title ||
                                repairWorkflow.mySettlement.response_code}
                            </Text>
                            <Text
                              style={styles.currentSharedCheckInDescription}
                            >
                              {
                                SETTLEMENT_LABELS[
                                  repairWorkflow.mySettlement
                                    .response_code as SettlementResponseCode
                                ]?.description
                              }
                            </Text>
                            <Pressable
                              style={styles.updateCheckInButton}
                              onPress={() => {
                                setDraftSettlementCode(
                                  (repairWorkflow.mySettlement
                                    ?.response_code as SettlementResponseCode) ||
                                    "ready",
                                );
                                setIsEditingSettlement(true);
                              }}
                              accessibilityRole="button"
                              accessibilityLabel="Revise where you stand"
                            >
                              <Text style={styles.changeResponseText}>
                                Revise where I am
                              </Text>
                            </Pressable>
                          </View>
                        )}

                        {/* Partner settlement status */}
                        <View style={styles.otherReconnectionNoticeCard}>
                          <Text style={styles.checkInOverline}>
                            {partnerDisplayName.toUpperCase()}’S CHECK-IN
                          </Text>
                          {repairWorkflow.partnerSettlement ? (
                            <>
                              <Text
                                style={styles.otherReconnectionNoticeHeading}
                              >
                                {SETTLEMENT_LABELS[
                                  repairWorkflow.partnerSettlement
                                    .response_code as SettlementResponseCode
                                ]?.title ||
                                  repairWorkflow.partnerSettlement
                                    .response_code}
                              </Text>
                              <Text style={styles.otherReconnectionNoticeText}>
                                {
                                  SETTLEMENT_LABELS[
                                    repairWorkflow.partnerSettlement
                                      .response_code as SettlementResponseCode
                                  ]?.description
                                }
                              </Text>
                            </>
                          ) : (
                            <Text style={styles.otherReconnectionNoticeText}>
                              Waiting gently for {partnerDisplayName} to check
                              in.
                            </Text>
                          )}
                        </View>

                        {/* When both partners are ready */}
                        {repairWorkflow.derivedStage === "both_ready" && (
                          <View style={{ marginTop: 12 }}>
                            <View style={styles.journeyDivider} />
                            {isCreator ? (
                              <View style={styles.takeawayPromptCard}>
                                <Text style={styles.checkInOverline}>
                                  MUTUAL READINESS
                                </Text>
                                <Text style={styles.takeawayPromptHeading}>
                                  Gently close this moment
                                </Text>
                                <Text style={styles.takeawayPromptText}>
                                  Both of you feel ready to leave this here. You
                                  can choose what helped soften this moment and
                                  add an optional takeaway for your shared
                                  story.
                                </Text>

                                <Text style={styles.takeawayInputLabel}>
                                  What helped you reconnect? (optional)
                                </Text>
                                <View style={styles.stepChipsRow}>
                                  {(
                                    [
                                      "feeling_heard",
                                      "giving_space",
                                      "small_gesture",
                                      "talking_it_through",
                                      "time_together",
                                    ] as TakeawayTagCode[]
                                  ).map((tag) => {
                                    const isSelected = takeawayTag === tag;
                                    return (
                                      <Pressable
                                        key={tag}
                                        style={[
                                          styles.stepChip,
                                          isSelected && styles.stepChipSelected,
                                        ]}
                                        onPress={() =>
                                          setTakeawayTag(
                                            isSelected ? null : tag,
                                          )
                                        }
                                        accessibilityRole="button"
                                        accessibilityState={{
                                          selected: isSelected,
                                        }}
                                        accessibilityLabel={
                                          TAKEAWAY_TAG_LABELS[tag]
                                        }
                                      >
                                        <Text
                                          style={[
                                            styles.stepChipText,
                                            isSelected &&
                                              styles.stepChipTextSelected,
                                          ]}
                                        >
                                          {TAKEAWAY_TAG_LABELS[tag]}
                                        </Text>
                                      </Pressable>
                                    );
                                  })}
                                </View>

                                <View style={{ gap: 4, marginTop: 4 }}>
                                  <Text style={styles.takeawayInputLabel}>
                                    A gentle takeaway for your shared story
                                    (optional)
                                  </Text>
                                  <TextInput
                                    style={[
                                      styles.takeawayInput,
                                      {
                                        minHeight: 64,
                                        textAlignVertical: "top",
                                      },
                                    ]}
                                    value={takeawayNote}
                                    onChangeText={(text) => {
                                      if (text.length <= 500) {
                                        setTakeawayNote(text);
                                      }
                                    }}
                                    placeholder="What helped soften this moment..."
                                    placeholderTextColor={theme.mutedText}
                                    maxLength={500}
                                    multiline
                                    editable={!repairWorkflow.actionLoading}
                                  />
                                  <Text
                                    style={{
                                      fontSize: tokens.typeScale.caption,
                                      color: tokens.colors.textSecondary,
                                      alignSelf: "flex-end",
                                    }}
                                  >
                                    {takeawayNote.length} / 500
                                  </Text>
                                </View>

                                <View style={styles.takeawayActionsRow}>
                                  <CouplyPrimaryButton
                                    label={
                                      repairWorkflow.actionLoading
                                        ? "Closing moment..."
                                        : "Complete reconnection"
                                    }
                                    disabled={repairWorkflow.actionLoading}
                                    onPress={async () => {
                                      await repairWorkflow.completeReconnection(
                                        takeawayTag,
                                        takeawayNote,
                                      );
                                    }}
                                    accessibilityLabel="Complete reconnection"
                                  />
                                </View>
                              </View>
                            ) : (
                              <View style={styles.calmInlineNotice}>
                                <Text style={styles.checkInOverline}>
                                  MUTUAL READINESS
                                </Text>
                                <Text style={styles.oneSidedNoticeHeading}>
                                  You both feel ready
                                </Text>
                                <Text style={styles.calmInlineNoticeText}>
                                  Waiting for {creatorDisplayName} to gently
                                  close this moment and complete reconnection.
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </CouplySectionCard>
              )}
            </View>
          )}

          {/* C. INDIVIDUAL PRIVATE REFLECTION (Confidential to authenticated author) */}
          <CouplySectionCard variant="lilac" style={styles.privacyCardSpacing}>
            <View style={styles.privacyCardHeaderRow}>
              <View style={styles.privatePill}>
                <Text style={styles.privatePillText}>Private to you</Text>
              </View>
              <Text style={styles.privacySubtext}>
                Only you can see this. It is never shared with {partnerRef}.
              </Text>
            </View>

            {repairWorkflow.reflectionError ? (
              <View style={styles.calmInlineNotice}>
                <Text
                  style={[
                    styles.calmInlineNoticeText,
                    { color: tokens.colors.dangerText },
                  ]}
                >
                  {repairWorkflow.reflectionError}
                </Text>
              </View>
            ) : null}

            {isEditingReflection ? (
              <View style={{ gap: 10, marginTop: 4 }}>
                <TextInput
                  style={[
                    styles.takeawayInput,
                    { minHeight: 80, textAlignVertical: "top" },
                  ]}
                  value={reflectionInput}
                  onChangeText={setReflectionInput}
                  placeholder="Add your personal notes or reflections here..."
                  placeholderTextColor={theme.mutedText}
                  multiline
                  editable={!repairWorkflow.reflectionLoading}
                />
                <View style={styles.takeawayActionsRow}>
                  <CouplyPrimaryButton
                    label={
                      repairWorkflow.reflectionLoading
                        ? "Saving..."
                        : "Save note"
                    }
                    disabled={
                      repairWorkflow.reflectionLoading ||
                      !reflectionInput.trim()
                    }
                    onPress={async () => {
                      const ok =
                        await repairWorkflow.savePrivateReflection(
                          reflectionInput,
                        );
                      if (ok) {
                        setIsEditingReflection(false);
                      }
                    }}
                    accessibilityLabel="Save private reflection"
                  />
                  <CouplyQuietButton
                    variant="text"
                    label="Cancel"
                    disabled={repairWorkflow.reflectionLoading}
                    onPress={() => {
                      setReflectionInput(repairWorkflow.privateNote || "");
                      setIsEditingReflection(false);
                    }}
                    accessibilityLabel="Cancel editing private reflection"
                  />
                </View>
              </View>
            ) : repairWorkflow.privateNote ? (
              <View style={{ gap: 10 }}>
                <Text style={styles.noteBodyText}>
                  {repairWorkflow.privateNote}
                </Text>
                <View style={styles.reviewCardActionsRow}>
                  <CouplyQuietButton
                    variant="soft"
                    label="Edit note"
                    onPress={() => {
                      setReflectionInput(repairWorkflow.privateNote || "");
                      setIsEditingReflection(true);
                    }}
                    accessibilityLabel="Edit private reflection"
                  />
                  <CouplyQuietButton
                    variant="text"
                    label="Remove note"
                    disabled={repairWorkflow.reflectionLoading}
                    onPress={async () => {
                      await repairWorkflow.deletePrivateReflection();
                      setReflectionInput("");
                    }}
                    accessibilityLabel="Remove private reflection"
                  />
                </View>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                <Text style={styles.reconnectingBody}>
                  Write down personal thoughts or feelings. This stays strictly
                  private to your account.
                </Text>
                <CouplyQuietButton
                  variant="soft"
                  label="+ Add a private reflection"
                  onPress={() => {
                    setReflectionInput("");
                    setIsEditingReflection(true);
                  }}
                  accessibilityLabel="Add a private reflection"
                />
              </View>
            )}
          </CouplySectionCard>

          {/* Non-creator partner informational card (Mine friction only) */}
          {!isPositive && !isCreator && !isSharedFriction && (
            <CouplySectionCard>
              <Text style={styles.partnerNoticeHeading}>
                A moment to reconnect
              </Text>
              <Text style={styles.partnerNoticeText}>
                This was shared so you can reconnect when you feel ready.
                There’s nothing you need to do in the app right now.
              </Text>
            </CouplySectionCard>
          )}

          {/* Friction repair controls (creator only, Mine friction only) */}
          {!isPositive && isCreator && !isSharedFriction && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeading}>How does this feel now?</Text>

              <View style={styles.repairCardsContainer}>
                <Pressable
                  style={[
                    styles.repairCard,
                    event.status === "open" && styles.repairCardActive,
                  ]}
                  onPress={() => updateEventStatus("open")}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: event.status === "open" }}
                  accessibilityLabel="Still lingering: This is still with us. Giving it time."
                >
                  <Text
                    style={[
                      styles.repairCardTitle,
                      event.status === "open" && styles.repairCardTitleActive,
                    ]}
                  >
                    Still lingering
                  </Text>
                  <Text style={styles.repairCardSubtitle}>
                    This is still with us. Giving it time.
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.repairCard,
                    event.status === "partially_repaired" &&
                      styles.repairCardActive,
                  ]}
                  onPress={() => updateEventStatus("partially_repaired")}
                  accessibilityRole="radio"
                  accessibilityState={{
                    selected: event.status === "partially_repaired",
                  }}
                  accessibilityLabel="In care: It is beginning to ease."
                >
                  <Text
                    style={[
                      styles.repairCardTitle,
                      event.status === "partially_repaired" &&
                        styles.repairCardTitleActive,
                    ]}
                  >
                    In care
                  </Text>
                  <Text style={styles.repairCardSubtitle}>
                    It is beginning to ease.
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.repairCard,
                    event.status === "reconnected" && styles.repairCardActive,
                  ]}
                  onPress={() => setShowRepairMethods(true)}
                  accessibilityRole="radio"
                  accessibilityState={{
                    selected: event.status === "reconnected",
                  }}
                  accessibilityLabel="Reconnected: We found our way back."
                >
                  <Text
                    style={[
                      styles.repairCardTitle,
                      event.status === "reconnected" &&
                        styles.repairCardTitleActive,
                    ]}
                  >
                    Reconnected
                  </Text>
                  <Text style={styles.repairCardSubtitle}>
                    We found our way back.
                  </Text>
                </Pressable>
              </View>

              {/* Repair method selection sub-panel */}
              {showRepairMethods && (
                <View style={styles.repairMethodsSubcard}>
                  <Text style={styles.repairMethodsTitle}>
                    What helped you reconnect?
                  </Text>
                  <Text style={styles.repairMethodsSubtitle}>
                    Choose the main thing that helped this time.
                  </Text>

                  <View style={styles.methodsWrap}>
                    {repairMethods.map((method) => {
                      const isSelected = event.repair_method === method.value;
                      return (
                        <Pressable
                          key={method.value}
                          style={[
                            styles.methodChip,
                            isSelected && styles.methodChipSelected,
                          ]}
                          onPress={() => markReconnected(method.value)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          accessibilityLabel={method.label}
                        >
                          <Text
                            style={[
                              styles.methodChipText,
                              isSelected && styles.methodChipTextSelected,
                            ]}
                          >
                            {method.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Pressable
                    style={styles.cancelLinkButton}
                    onPress={() => setShowRepairMethods(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel repair selection"
                  >
                    <Text style={styles.cancelLinkText}>Cancel</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* Sharing controls (creator only) */}
          {isCreator && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeading}>Sharing</Text>

              <View style={styles.sharingCard}>
                <Text style={styles.sharingExplanationText}>
                  {event.visibility === "mine"
                    ? `This is private to you. ${partnerRef} will only see the version you choose to share.`
                    : `${partnerRef} can see the shared wording below. Your private reflection remains private.`}
                </Text>

                {!showSharingControls ? (
                  <Pressable
                    style={styles.secondaryActionButton}
                    onPress={() => {
                      setSharedTopicInput("");
                      setShowSharingControls(true);
                      setStatusMessage("");
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={
                      event.visibility === "mine"
                        ? `Choose what to share with ${partnerRef}`
                        : "Change sharing"
                    }
                  >
                    <Text style={styles.secondaryActionText}>
                      {event.visibility === "mine"
                        ? `Choose what to share with ${partnerRef}`
                        : "Change sharing"}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={styles.sharingActivePanel}>
                    {event.visibility === "mine" ? (
                      <>
                        <Text style={styles.sharingFieldLabel}>
                          What would you like {partnerRef} to know?
                        </Text>
                        <TextInput
                          style={styles.sharingInput}
                          value={sharedTopicInput}
                          onChangeText={setSharedTopicInput}
                          placeholder={`Enter a gentle topic ${partnerRef} can see`}
                          placeholderTextColor={theme.mutedText}
                          multiline
                          editable={!changingVisibility}
                        />

                        <Pressable
                          style={[
                            styles.primaryConfirmButton,
                            (changingVisibility || !sharedTopicInput.trim()) &&
                              styles.buttonDisabled,
                          ]}
                          disabled={
                            changingVisibility || !sharedTopicInput.trim()
                          }
                          onPress={() => changeMomentVisibility("ours")}
                          accessibilityRole="button"
                          accessibilityLabel="Confirm sharing"
                        >
                          <Text style={styles.primaryConfirmText}>
                            {changingVisibility
                              ? "Updating..."
                              : "Confirm sharing"}
                          </Text>
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <View style={styles.warningNoticeBox}>
                          <Text style={styles.warningNoticeText}>
                            Moving this to Mine removes{" "}
                            {partnerName ? `${partnerName}’s` : "your partner’s"}{" "}
                            future access. Anything already seen cannot be taken
                            back.
                          </Text>
                        </View>

                        <Pressable
                          style={[
                            styles.primaryConfirmButton,
                            changingVisibility && styles.buttonDisabled,
                          ]}
                          disabled={changingVisibility}
                          onPress={() => changeMomentVisibility("mine")}
                          accessibilityRole="button"
                          accessibilityLabel="Confirm move to Mine"
                        >
                          <Text style={styles.primaryConfirmText}>
                            {changingVisibility
                              ? "Updating..."
                              : "Confirm move to Mine"}
                          </Text>
                        </Pressable>
                      </>
                    )}

                    <Pressable
                      style={styles.cancelLinkButton}
                      disabled={changingVisibility}
                      onPress={() => {
                        setSharedTopicInput("");
                        setShowSharingControls(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel sharing change"
                    >
                      <Text style={styles.cancelLinkText}>Cancel</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Delete section with local confirmation (creator only) */}
          {isCreator && (
            <View style={styles.deleteContainer}>
              {!showDeleteConfirm ? (
                <Pressable
                  style={styles.quietDeleteButton}
                  onPress={() => setShowDeleteConfirm(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Delete this moment"
                >
                  <Text style={styles.quietDeleteText}>Delete this moment</Text>
                </Pressable>
              ) : (
                <View style={styles.deleteConfirmCard}>
                  <Text style={styles.deleteConfirmTitle}>
                    Delete this moment permanently?
                  </Text>
                  <Text style={styles.deleteConfirmSubtitle}>
                    This cannot be undone.
                  </Text>

                  <View style={styles.deleteActionsRow}>
                    <Pressable
                      style={styles.deleteCancelButton}
                      onPress={() => setShowDeleteConfirm(false)}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel deletion"
                    >
                      <Text style={styles.deleteCancelText}>Cancel</Text>
                    </Pressable>

                    <Pressable
                      style={styles.deleteFinalButton}
                      onPress={deleteEvent}
                      accessibilityRole="button"
                      accessibilityLabel="Delete moment permanently"
                    >
                      <Text style={styles.deleteFinalText}>Delete moment</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Status feedback message */}
          {statusMessage !== "" && (
            <View style={styles.statusBanner}>
              <Text style={styles.statusBannerText}>{statusMessage}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatStatus(status: RelationshipEvent["status"]) {
  switch (status) {
    case "open":
      return "Still lingering";
    case "partially_repaired":
      return "In care";
    case "reconnected":
      return "Reconnected";
    default:
      return "—";
  }
}

function formatDate(value: string) {
  try {
    const d = new Date(value);
    return (
      d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) +
      " at " +
      d.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
    );
  } catch {
    return value;
  }
}

const createStyles = (theme: ThemeColors) => {
  const tokens = getThemedTokens(theme);
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.pageBackground,
    },
    scrollView: {
      flex: 1,
      backgroundColor: theme.pageBackground,
    },
    scrollContent: {
      flexGrow: 1,
      paddingTop: 4,
      paddingBottom: 64,
      backgroundColor: theme.pageBackground,
    },
    column: {
      width: "100%",
      maxWidth: tokens.layout.appShell,
      alignSelf: "center",
      gap: 14,
    },
    centerContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: tokens.spacing.xl,
      gap: tokens.spacing.md,
    },
    centerStatusText: {
      fontSize: tokens.typeScale.bodyLarge,
      color: tokens.colors.textSecondary,
      textAlign: "center",
    },
    centerBackButton: {
      minHeight: 44,
      justifyContent: "center",
      paddingVertical: tokens.spacing.sm,
      paddingHorizontal: tokens.spacing.lg,
      borderRadius: tokens.radii.small,
      backgroundColor: tokens.colors.surfaceLilac,
    },
    centerBackButtonText: {
      fontSize: tokens.typeScale.body,
      fontWeight: "600",
      color: tokens.colors.plum,
    },

    /* Moment Card */
    momentCardTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: tokens.spacing.xs,
    },
    momentOverline: {
      fontSize: tokens.typeScale.overline,
      fontWeight: "700",
      letterSpacing: 0.8,
      color: tokens.colors.plum,
      textTransform: "uppercase",
    },
    categoryTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: tokens.colors.text,
      marginBottom: tokens.spacing.xs,
    },
    sharedTopicContextBox: {
      backgroundColor: tokens.colors.surfaceLilac,
      borderRadius: tokens.radii.small,
      padding: tokens.spacing.sm,
      borderLeftWidth: 3,
      borderLeftColor: tokens.colors.plum,
      marginVertical: tokens.spacing.xs,
      gap: 2,
    },
    sharedTopicContextLabel: {
      fontSize: tokens.typeScale.overline,
      fontWeight: "700",
      color: tokens.colors.plum,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    sharedTopicContextText: {
      fontSize: tokens.typeScale.body,
      color: tokens.colors.text,
      lineHeight: 18,
    },
    summaryMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: tokens.spacing.xs,
      marginTop: tokens.spacing.xs,
    },
    metaRecordedDate: {
      fontSize: tokens.typeScale.caption,
      color: tokens.colors.textSecondary,
    },
    intensityPill: {
      backgroundColor: tokens.colors.surfaceMuted,
      borderRadius: tokens.radii.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: tokens.colors.border,
    },
    intensityPillText: {
      fontSize: tokens.typeScale.caption,
      color: tokens.colors.textSecondary,
      fontWeight: "500",
    },

    /* Privacy Boundary Card */
    privacyCardSpacing: {
      marginTop: 2,
    },
    privacyCardHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: tokens.spacing.xs,
      marginBottom: tokens.spacing.xs,
    },
    privatePill: {
      backgroundColor: tokens.colors.surfaceLilac,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: tokens.radii.pill,
    },
    privatePillText: {
      fontSize: tokens.typeScale.overline,
      fontWeight: "700",
      color: tokens.colors.plum,
      letterSpacing: 0.5,
    },
    privacySubtext: {
      fontSize: tokens.typeScale.caption,
      color: tokens.colors.textSecondary,
      flex: 1,
    },
    sharedPill: {
      backgroundColor: tokens.colors.surfaceBlush,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: tokens.radii.pill,
    },
    sharedPillText: {
      fontSize: tokens.typeScale.overline,
      fontWeight: "700",
      color: tokens.colors.plum,
      letterSpacing: 0.5,
    },
    noteBodyText: {
      fontSize: tokens.typeScale.body,
      color: tokens.colors.text,
      lineHeight: 20,
    },

    /* Positive Outcome */
    positiveOutcomeTitle: {
      fontSize: tokens.typeScale.bodyLarge,
      fontWeight: "700",
      color: tokens.colors.text,
      marginBottom: 4,
    },
    positiveOutcomeSubtitle: {
      fontSize: tokens.typeScale.body,
      color: tokens.colors.textSecondary,
      lineHeight: 18,
    },

    /* Status Display */
    statusRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    statusLabel: {
      fontSize: tokens.typeScale.caption,
      fontWeight: "600",
      color: tokens.colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    statusMethodText: {
      fontSize: tokens.typeScale.body,
      fontWeight: "600",
      color: tokens.colors.plum,
    },
    statusSubtext: {
      fontSize: tokens.typeScale.caption,
      color: tokens.colors.textSecondary,
    },
    statusGuidanceText: {
      fontSize: tokens.typeScale.body,
      color: tokens.colors.textSecondary,
      marginTop: tokens.spacing.xs,
      lineHeight: 18,
    },

    /* Journey Container */
    journeyContainer: {
      gap: 12,
    },
    journeyHeaderBlock: {
      gap: 4,
      paddingHorizontal: tokens.spacing.page,
    },
    journeyOverline: {
      fontSize: tokens.typeScale.overline,
      fontWeight: "700",
      color: tokens.colors.plum,
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    journeyHeading: {
      fontSize: 20,
      fontWeight: "700",
      color: tokens.colors.text,
    },
    journeySupportingText: {
      fontSize: tokens.typeScale.body,
      color: tokens.colors.textSecondary,
      lineHeight: 18,
    },

    /* Next Action Card */
    nextActionCard: {
      gap: 12,
    },
    nextActionHeader: {
      gap: 4,
    },
    nextActionOverline: {
      fontSize: tokens.typeScale.overline,
      fontWeight: "700",
      color: tokens.colors.plum,
      letterSpacing: 0.8,
    },
    nextActionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: tokens.colors.text,
    },
    stageContentBlock: {
      gap: 12,
    },
    openAlexBlock: {
      gap: 8,
    },
    stageSubheading: {
      fontSize: tokens.typeScale.bodyLarge,
      fontWeight: "700",
      color: tokens.colors.text,
    },
    stageBodyText: {
      fontSize: tokens.typeScale.body,
      color: tokens.colors.textSecondary,
      lineHeight: 20,
    },
    choicesStack: {
      gap: 10,
      marginTop: 4,
    },

    /* Response Display Banner */
    responseDisplayBanner: {
      backgroundColor: tokens.colors.surfaceLilac,
      borderRadius: tokens.radii.card,
      padding: 14,
      borderWidth: 1.2,
      borderColor: tokens.colors.borderSoft,
      gap: 6,
    },
    responseDisplayTitle: {
      fontSize: tokens.typeScale.bodyLarge,
      fontWeight: "700",
      color: tokens.colors.plum,
    },
    responseDisplayBody: {
      fontSize: tokens.typeScale.body,
      color: tokens.colors.textSecondary,
      lineHeight: 18,
    },
    changeResponseButton: {
      alignSelf: "flex-start",
      marginTop: 4,
      minHeight: 44,
      justifyContent: "center",
      paddingVertical: 4,
    },
    changeResponseText: {
      fontSize: tokens.typeScale.caption,
      fontWeight: "600",
      color: tokens.colors.plum,
      textDecorationLine: "underline",
    },

    /* Next step chooser */
    nextStepChooserBlock: {
      gap: 8,
      marginTop: 4,
    },
    nextStepChooserHeading: {
      fontSize: tokens.typeScale.body,
      fontWeight: "600",
      color: tokens.colors.text,
    },
    stepChipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    stepChip: {
      backgroundColor: tokens.colors.surfaceLilac,
      borderRadius: tokens.radii.small,
      minHeight: 44,
      justifyContent: "center",
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderWidth: 1.2,
      borderColor: tokens.colors.border,
    },
    stepChipSelected: {
      backgroundColor: tokens.colors.plum,
      borderColor: tokens.colors.plum,
    },
    stepChipText: {
      fontSize: tokens.typeScale.caption,
      fontWeight: "600",
      color: tokens.colors.text,
    },
    stepChipTextSelected: {
      color: theme.primaryActionText,
    },

    /* Review Card */
    reviewCard: {
      backgroundColor: tokens.colors.surfaceLilac,
      borderRadius: tokens.radii.card,
      padding: 14,
      borderWidth: 1.2,
      borderColor: tokens.colors.borderSoft,
      gap: 8,
      marginTop: 8,
    },
    reviewCardOverline: {
      fontSize: tokens.typeScale.overline,
      fontWeight: "700",
      color: tokens.colors.plum,
      letterSpacing: 0.8,
    },
    reviewCardHeading: {
      fontSize: tokens.typeScale.bodyLarge,
      fontWeight: "700",
      color: tokens.colors.text,
    },
    reviewCardBody: {
      fontSize: tokens.typeScale.body,
      color: tokens.colors.textSecondary,
      lineHeight: 18,
    },
    reviewCardActionsRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 10,
      marginTop: 4,
    },

    /* Settlement */
    settlementBlock: {
      gap: 12,
    },
    journeyDivider: {
      height: 1,
      backgroundColor: tokens.colors.borderSoft,
      marginVertical: 4,
    },
    settlementHeading: {
      fontSize: tokens.typeScale.bodyLarge,
      fontWeight: "700",
      color: tokens.colors.text,
    },
    settlementSubtext: {
      fontSize: tokens.typeScale.body,
      color: tokens.colors.textSecondary,
      lineHeight: 18,
    },
    checkInOverline: {
      fontSize: tokens.typeScale.overline,
      fontWeight: "700",
      color: tokens.colors.plum,
      letterSpacing: 0.8,
    },
    checkInChoicesStack: {
      gap: 8,
    },
    calmInlineNotice: {
      backgroundColor: tokens.colors.surfaceLilac,
      borderRadius: tokens.radii.small,
      padding: 10,
      borderWidth: 1,
      borderColor: tokens.colors.borderSoft,
      gap: 4,
    },
    calmInlineNoticeText: {
      fontSize: tokens.typeScale.caption,
      color: tokens.colors.textSecondary,
      lineHeight: 17,
    },
    currentSharedCheckInCard: {
      backgroundColor: tokens.colors.surfaceLilac,
      borderRadius: tokens.radii.card,
      padding: 14,
      borderWidth: 1.2,
      borderColor: tokens.colors.borderSoft,
      gap: 6,
      marginTop: 4,
    },
    currentSharedCheckInTitle: {
      fontSize: tokens.typeScale.bodyLarge,
      fontWeight: "700",
      color: tokens.colors.text,
    },
    currentSharedCheckInDescription: {
      fontSize: tokens.typeScale.body,
      color: tokens.colors.textSecondary,
      lineHeight: 18,
    },
    updateCheckInButton: {
      alignSelf: "flex-start",
      marginTop: 2,
      minHeight: 44,
      justifyContent: "center",
    },
    otherReconnectionNoticeCard: {
      backgroundColor: tokens.colors.surfaceMuted,
      borderRadius: tokens.radii.small,
      padding: 12,
      borderWidth: 1,
      borderColor: tokens.colors.border,
      gap: 4,
      marginTop: 4,
    },
    otherReconnectionNoticeHeading: {
      fontSize: tokens.typeScale.body,
      fontWeight: "700",
      color: tokens.colors.plum,
    },
    otherReconnectionNoticeText: {
      fontSize: tokens.typeScale.caption,
      color: tokens.colors.textSecondary,
      lineHeight: 17,
    },
    reconnectCheckinHeader: {
      gap: 4,
      marginTop: 4,
    },

    /* Reconnection Mutual Readiness */
    oneSidedNoticeHeading: {
      fontSize: tokens.typeScale.body,
      fontWeight: "700",
      color: tokens.colors.plum,
    },
    takeawayPromptCard: {
      backgroundColor: tokens.colors.surfaceLilac,
      borderRadius: tokens.radii.card,
      padding: 14,
      borderWidth: 1.2,
      borderColor: tokens.colors.borderSoft,
      gap: 8,
      marginTop: 6,
    },
    takeawayPromptHeading: {
      fontSize: 16,
      fontWeight: "700",
      color: tokens.colors.text,
    },
    takeawayPromptText: {
      fontSize: tokens.typeScale.body,
      color: tokens.colors.textSecondary,
      lineHeight: 18,
    },
    takeawayInputLabel: {
      fontSize: tokens.typeScale.caption,
      fontWeight: "600",
      color: tokens.colors.text,
      marginTop: 2,
    },
    takeawayInput: {
      backgroundColor: tokens.colors.surface,
      borderRadius: tokens.radii.small,
      borderWidth: 1.2,
      borderColor: tokens.colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: tokens.typeScale.body,
      color: tokens.colors.text,
    },
    takeawayActionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 4,
    },

    /* Reconnected Section */
    reconnectedSection: {
      gap: 10,
    },
    reconnectedHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    reconnectedEmoji: {
      fontSize: 20,
    },
    reconnectedTitleGroup: {
      flex: 1,
      gap: 2,
    },
    reconnectingOverline: {
      fontSize: tokens.typeScale.overline,
      fontWeight: "700",
      color: tokens.colors.plum,
      letterSpacing: 0.8,
    },
    reconnectedHeading: {
      fontSize: 16,
      fontWeight: "700",
      color: tokens.colors.text,
    },
    reconnectedBody: {
      fontSize: tokens.typeScale.body,
      color: tokens.colors.textSecondary,
      lineHeight: 19,
    },
    sharedTakeawayPill: {
      backgroundColor: tokens.colors.surfaceBlush,
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: tokens.radii.pill,
    },
    sharedTakeawayPillText: {
      fontSize: tokens.typeScale.caption,
      fontWeight: "600",
      color: tokens.colors.plum,
    },
    sharedTakeawayCard: {
      backgroundColor: tokens.colors.surfaceLilac,
      borderRadius: tokens.radii.card,
      padding: 14,
      borderWidth: 1.2,
      borderColor: tokens.colors.borderSoft,
      gap: 6,
      marginTop: 6,
    },
    sharedTakeawayOverline: {
      fontSize: tokens.typeScale.overline,
      fontWeight: "700",
      color: tokens.colors.plum,
      letterSpacing: 0.8,
    },
    sharedTakeawayBodyText: {
      fontSize: tokens.typeScale.bodyLarge,
      fontWeight: "500",
      color: tokens.colors.text,
      lineHeight: 20,
      fontStyle: "italic",
      marginVertical: 2,
    },
    reconnectingBody: {
      fontSize: tokens.typeScale.body,
      color: tokens.colors.textSecondary,
      lineHeight: 18,
    },

    /* Mine Friction Controls */
    sectionContainer: {
      gap: 10,
      marginHorizontal: tokens.spacing.page,
    },
    sectionHeading: {
      fontSize: tokens.typeScale.sectionTitle,
      fontWeight: "700",
      color: tokens.colors.text,
    },
    partnerNoticeHeading: {
      fontSize: tokens.typeScale.bodyLarge,
      fontWeight: "700",
      color: tokens.colors.text,
      marginBottom: tokens.spacing.xs,
    },
    partnerNoticeText: {
      fontSize: tokens.typeScale.body,
      color: tokens.colors.textSecondary,
      lineHeight: 20,
    },
    repairCardsContainer: {
      gap: tokens.spacing.sm,
    },
    repairCard: {
      backgroundColor: tokens.colors.surface,
      borderRadius: tokens.radii.card,
      padding: tokens.spacing.md,
      borderWidth: 1.5,
      borderColor: tokens.colors.border,
    },
    repairCardActive: {
      borderColor: tokens.colors.plum,
      backgroundColor: tokens.colors.surfaceLilac,
    },
    repairCardTitle: {
      fontSize: tokens.typeScale.bodyLarge,
      fontWeight: "600",
      color: tokens.colors.text,
      marginBottom: 2,
    },
    repairCardTitleActive: {
      color: tokens.colors.plum,
      fontWeight: "700",
    },
    repairCardSubtitle: {
      fontSize: tokens.typeScale.body,
      color: tokens.colors.textSecondary,
      lineHeight: 18,
    },
    repairMethodsSubcard: {
      backgroundColor: tokens.colors.surfaceMuted,
      borderRadius: tokens.radii.card,
      padding: tokens.spacing.md,
      marginTop: tokens.spacing.xs,
      gap: tokens.spacing.sm,
    },
    repairMethodsTitle: {
      fontSize: tokens.typeScale.bodyLarge,
      fontWeight: "600",
      color: tokens.colors.text,
    },
    repairMethodsSubtitle: {
      fontSize: tokens.typeScale.caption,
      color: tokens.colors.textSecondary,
    },
    methodsWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: tokens.spacing.xs,
    },
    methodChip: {
      backgroundColor: tokens.colors.surface,
      borderRadius: tokens.radii.pill,
      minHeight: 44,
      justifyContent: "center",
      paddingVertical: tokens.spacing.xs,
      paddingHorizontal: tokens.spacing.sm,
      borderWidth: 1,
      borderColor: tokens.colors.border,
    },
    methodChipSelected: {
      backgroundColor: tokens.colors.plum,
      borderColor: tokens.colors.plum,
    },
    methodChipText: {
      fontSize: tokens.typeScale.caption,
      fontWeight: "500",
      color: tokens.colors.text,
    },
    methodChipTextSelected: {
      color: theme.primaryActionText,
    },
    cancelLinkButton: {
      alignSelf: "center",
      paddingVertical: tokens.spacing.xs,
      minHeight: 44,
      justifyContent: "center",
    },
    cancelLinkText: {
      fontSize: tokens.typeScale.caption,
      color: tokens.colors.textSecondary,
      textDecorationLine: "underline",
    },

    /* Sharing section */
    sharingCard: {
      backgroundColor: tokens.colors.surface,
      borderRadius: tokens.radii.card,
      padding: tokens.spacing.md,
      borderWidth: 1,
      borderColor: tokens.colors.border,
      gap: tokens.spacing.sm,
    },
    sharingExplanationText: {
      fontSize: tokens.typeScale.body,
      color: tokens.colors.textSecondary,
      lineHeight: 20,
    },
    secondaryActionButton: {
      minHeight: 44,
      borderRadius: tokens.radii.small,
      borderWidth: 1.5,
      borderColor: tokens.colors.plum,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: tokens.spacing.sm,
      paddingHorizontal: tokens.spacing.md,
    },
    secondaryActionText: {
      fontSize: tokens.typeScale.body,
      fontWeight: "600",
      color: tokens.colors.plum,
    },
    sharingActivePanel: {
      gap: tokens.spacing.sm,
    },
    sharingFieldLabel: {
      fontSize: tokens.typeScale.body,
      fontWeight: "600",
      color: tokens.colors.text,
    },
    sharingInput: {
      backgroundColor: tokens.colors.surfaceMuted,
      borderRadius: tokens.radii.small,
      padding: tokens.spacing.sm,
      fontSize: tokens.typeScale.body,
      color: tokens.colors.text,
      minHeight: 70,
      textAlignVertical: "top",
      borderWidth: 1,
      borderColor: tokens.colors.border,
    },
    primaryConfirmButton: {
      minHeight: 44,
      borderRadius: tokens.radii.small,
      backgroundColor: tokens.colors.plum,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: tokens.spacing.sm,
      paddingHorizontal: tokens.spacing.md,
    },
    primaryConfirmText: {
      fontSize: tokens.typeScale.body,
      fontWeight: "600",
      color: theme.primaryActionText,
    },
    warningNoticeBox: {
      backgroundColor: tokens.colors.surfaceBlush,
      borderRadius: tokens.radii.small,
      padding: tokens.spacing.sm,
      borderWidth: 1,
      borderColor: tokens.colors.borderSoft,
    },
    warningNoticeText: {
      fontSize: tokens.typeScale.caption,
      color: tokens.colors.plum,
      lineHeight: 18,
    },
    buttonDisabled: {
      opacity: 0.5,
    },

    /* Delete */
    deleteContainer: {
      marginTop: tokens.spacing.md,
      marginHorizontal: tokens.spacing.page,
      alignItems: "center",
    },
    quietDeleteButton: {
      minHeight: 44,
      justifyContent: "center",
      paddingVertical: tokens.spacing.xs,
    },
    quietDeleteText: {
      fontSize: tokens.typeScale.caption,
      color: tokens.colors.textSecondary,
      textDecorationLine: "underline",
    },
    deleteConfirmCard: {
      backgroundColor: tokens.colors.surfaceBlush,
      borderRadius: tokens.radii.card,
      padding: tokens.spacing.md,
      borderWidth: 1,
      borderColor: tokens.colors.borderSoft,
      gap: tokens.spacing.xs,
      width: "100%",
    },
    deleteConfirmTitle: {
      fontSize: tokens.typeScale.bodyLarge,
      fontWeight: "700",
      color: tokens.colors.plum,
    },
    deleteConfirmSubtitle: {
      fontSize: tokens.typeScale.caption,
      color: tokens.colors.textSecondary,
    },
    deleteActionsRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: tokens.spacing.sm,
      marginTop: tokens.spacing.sm,
    },
    deleteCancelButton: {
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: tokens.spacing.md,
    },
    deleteCancelText: {
      fontSize: tokens.typeScale.body,
      color: tokens.colors.textSecondary,
    },
    deleteFinalButton: {
      minHeight: 44,
      backgroundColor: tokens.colors.plum,
      borderRadius: tokens.radii.small,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: tokens.spacing.md,
    },
    deleteFinalText: {
      fontSize: tokens.typeScale.body,
      fontWeight: "600",
      color: theme.primaryActionText,
    },

    /* Status banner */
    statusBanner: {
      backgroundColor: tokens.colors.surfaceMuted,
      borderRadius: tokens.radii.small,
      padding: tokens.spacing.sm,
      borderWidth: 1,
      borderColor: tokens.colors.border,
      marginHorizontal: tokens.spacing.page,
    },
    statusBannerText: {
      fontSize: tokens.typeScale.caption,
      color: tokens.colors.textSecondary,
      textAlign: "center",
    },
  });
};
