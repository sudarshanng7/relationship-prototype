import { tokens } from "@/components/couply-tokens";
import {
  CouplyChoiceCard,
  CouplyHeader,
  CouplyPage,
  CouplyPrimaryButton,
  CouplyQuietButton,
  CouplySectionCard,
  CouplyStatusPill,
} from "@/components/CouplyUI";
import { useRepairPreview } from "@/context/RepairPreviewContext";
import { useUserIdentity } from "@/context/UserIdentityContext";
import { supabase } from "@/lib/supabase";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Pressable,
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

type PreviewPerspective = "alex" | "sam";
type PartnerResponseChoice =
  | "none"
  | "heard"
  | "need_time"
  | "suggest_next_step";
type SuggestedNextStep =
  | "A quiet chat"
  | "A warm hug"
  | "A walk outside"
  | "Quiet time side-by-side"
  | "Fresh tea together";

const SUGGESTED_NEXT_STEPS: SuggestedNextStep[] = [
  "A quiet chat",
  "A warm hug",
  "A walk outside",
  "Quiet time side-by-side",
  "Fresh tea together",
];

const PRIVATE_HELP_OPTIONS = [
  "Feeling heard",
  "Having space",
  "A small gesture",
  "Talking it through",
  "Time together",
] as const;

type PrivateHelpTag = (typeof PRIVATE_HELP_OPTIONS)[number];

const SHARED_TAKEAWAY_OPTIONS = [
  "Feeling heard",
  "Giving space",
  "A small gesture",
  "Talking it through",
  "Time together",
] as const;

type SharedTakeawayTag = (typeof SHARED_TAKEAWAY_OPTIONS)[number];

export default function EventDetailScreen() {
  const router = useRouter();

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
  const [privateNote, setPrivateNote] = useState<string | null>(null);

  const { displayName, partnerName, partnerRef } = useUserIdentity();

  const isCurrentUserCreator = event
    ? event.creator_id === currentUserId
    : true;
  const creatorLabel = isCurrentUserCreator
    ? displayName || "You"
    : partnerName || "Your partner";
  const recipientLabel = isCurrentUserCreator
    ? partnerName || "your partner"
    : displayName || "You";
  const recipientCapitalized = isCurrentUserCreator
    ? partnerName || "Your partner"
    : displayName || "You";

  const [showSharingControls, setShowSharingControls] = useState(false);
  const [sharedTopicInput, setSharedTopicInput] = useState("");
  const [changingVisibility, setChangingVisibility] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Consolidated repair journey preview local state
  const [previewPerspective, setPreviewPerspective] =
    useState<PreviewPerspective>("alex");
  const [partnerResponse, setPartnerResponse] =
    useState<PartnerResponseChoice>("none");
  const [suggestedStep, setSuggestedStep] = useState<SuggestedNextStep | null>(
    null,
  );

  // Independent settlement
  const [alexSettled, setAlexSettled] = useState<boolean | null>(null);
  const [samSettled, setSamSettled] = useState<boolean | null>(null);

  // Private individual reflections (separate for Alex and Sam)
  const [alexPrivateTag, setAlexPrivateTag] = useState<PrivateHelpTag | null>(
    null,
  );
  const [alexPrivateDismissed, setAlexPrivateDismissed] = useState(false);
  const [samPrivateTag, setSamPrivateTag] = useState<PrivateHelpTag | null>(
    null,
  );
  const [samPrivateDismissed, setSamPrivateDismissed] = useState(false);

  // Creator-only shared takeaway (Alex)
  const [showTakeawayForm, setShowTakeawayForm] = useState(false);
  const [takeawayDismissed, setTakeawayDismissed] = useState(false);
  const [takeawayTag, setTakeawayTag] = useState<SharedTakeawayTag | null>(
    null,
  );
  const [takeawayNote, setTakeawayNote] = useState("");
  const [isTakeawaySaved, setIsTakeawaySaved] = useState(false);

  const {
    previewEventId,
    previewStatus,
    sharedTakeawayNote,
    sharedTakeawayTag,
    hasSharedTakeaway,
    setReconnectedPreview,
    setSharedTakeaway,
    clearRepairPreview,
  } = useRepairPreview();

  function handleResetPreview() {
    clearRepairPreview();
    setPreviewPerspective("alex");
    setPartnerResponse("none");
    setSuggestedStep(null);
    setAlexSettled(null);
    setSamSettled(null);
    setAlexPrivateTag(null);
    setAlexPrivateDismissed(false);
    setSamPrivateTag(null);
    setSamPrivateDismissed(false);
    setShowTakeawayForm(false);
    setTakeawayDismissed(false);
    setTakeawayTag(null);
    setTakeawayNote("");
    setIsTakeawaySaved(false);
  }

  const isMutuallySettled = alexSettled === true && samSettled === true;

  useEffect(() => {
    if (isMutuallySettled && event?.id) {
      setReconnectedPreview(event.id);
    } else if (alexSettled === false || samSettled === false) {
      clearRepairPreview();
    }
  }, [
    isMutuallySettled,
    alexSettled,
    samSettled,
    event?.id,
    setReconnectedPreview,
    clearRepairPreview,
  ]);

  useEffect(() => {
    if (event?.id && event.id === previewEventId) {
      if (previewStatus === "reconnected") {
        setAlexSettled(true);
        setSamSettled(true);
        setPartnerResponse((prev) => (prev === "none" ? "heard" : prev));
      }
      if (hasSharedTakeaway) {
        setIsTakeawaySaved(true);
        if (sharedTakeawayNote !== null) {
          setTakeawayNote(sharedTakeawayNote);
        }
        if (sharedTakeawayTag !== null) {
          setTakeawayTag(sharedTakeawayTag as SharedTakeawayTag);
        }
      }
    }
  }, [
    event?.id,
    previewEventId,
    previewStatus,
    hasSharedTakeaway,
    sharedTakeawayNote,
    sharedTakeawayTag,
  ]);

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
      console.error(error);
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

    setPrivateNote(null);

    const { data: reflection, error: reflectionError } = await supabase
      .from("event_private_reflections")
      .select("note")
      .eq("event_id", eventId)
      .eq("author_id", user.id)
      .maybeSingle();

    if (reflectionError) {
      console.error("Failed to load private reflection:", reflectionError);
      setStatusMessage(reflectionError.message);
      return;
    }

    setPrivateNote(reflection?.note ?? null);
    setEvent(data);
    setStatusMessage("");
  }

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
      console.error(error);
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
      console.error(error);
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
      console.error("Visibility change failed:", error);
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
      console.error(error);
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
      <CouplyPage>
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
      </CouplyPage>
    );
  }

  const isCreator = event.creator_id === currentUserId;
  const isPositive = event.event_type === "positive";
  const isSharedFriction = !isPositive && event.visibility === "ours";

  const isInCare = partnerResponse !== "none" && !isMutuallySettled;
  const isOpen = partnerResponse === "none";

  const currentSettled =
    previewPerspective === "alex" ? alexSettled : samSettled;
  const otherSettled =
    previewPerspective === "alex" ? samSettled : alexSettled;

  const currentPrivateTag =
    previewPerspective === "alex" ? alexPrivateTag : samPrivateTag;
  const currentPrivateDismissed =
    previewPerspective === "alex"
      ? alexPrivateDismissed
      : samPrivateDismissed;

  const authoredTakeawayText =
    takeawayNote.trim().length > 0
      ? takeawayNote.trim()
      : takeawayTag ?? "";

  return (
    <CouplyPage>
      <CouplyHeader
        title={screenTitle}
        onBack={handleBack}
        backLabel={backLabel}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.column}>
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
                    ? isMutuallySettled
                      ? "Reconnected"
                      : isInCare
                      ? "In care"
                      : "Open"
                    : isPositive
                    ? "Good moment"
                    : formatStatus(event.status)
                }
                variant={
                  isSharedFriction
                    ? isMutuallySettled
                      ? "reconnected"
                      : isInCare
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
                <Text style={styles.sharedTopicContextLabel}>Shared context</Text>
                <Text style={styles.sharedTopicContextText}>
                  {event.shared_topic}
                </Text>
              </View>
            ) : null}

            <View style={styles.summaryMetaRow}>
              <Text style={styles.metaRecordedDate}>
                Recorded {formatDate(event.created_at)}
              </Text>
              {!isPositive &&
                event.intensity !== null &&
                (!isSharedFriction || previewPerspective === "alex") && (
                  <View style={styles.intensityPill}>
                    <Text style={styles.intensityPillText}>
                      It weighed on you: {event.intensity} of 5
                    </Text>
                  </View>
                )}
            </View>
          </CouplySectionCard>

          {/* C. Privacy Boundary */}
          {/* Creator private note */}
          {privateNote && (!isSharedFriction || previewPerspective === "alex") && (
            <CouplySectionCard variant="lilac" style={styles.privacyCardSpacing}>
              <View style={styles.privacyCardHeaderRow}>
                <View style={styles.privatePill}>
                  <Text style={styles.privatePillText}>Private to you</Text>
                </View>
                <Text style={styles.privacySubtext}>Only you can see this.</Text>
              </View>
              <Text style={styles.noteBodyText}>{privateNote}</Text>
            </CouplySectionCard>
          )}

          {/* Recipient perspective privacy notice (Sam view) */}
          {isSharedFriction && previewPerspective === "sam" && (
            <CouplySectionCard variant="muted" style={styles.privacyCardSpacing}>
              <View style={styles.privacySafeNoticeRow}>
                <Text style={styles.privacySafeIcon}>🔒</Text>
                <Text style={styles.privacySafeText}>
                  Private reflections remain hidden. You only see what was tenderly shared.
                </Text>
              </View>
            </CouplySectionCard>
          )}

          {/* Shared wording card (Ours & topic exists) */}
          {event.visibility === "ours" && event.shared_topic && (
            <CouplySectionCard variant="default" style={styles.privacyCardSpacing}>
              <View style={styles.privacyCardHeaderRow}>
                <View style={styles.sharedPill}>
                  <Text style={styles.sharedPillText}>Shared with {partnerRef}</Text>
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

          {/* D. Consolidated Repair Journey (Shared Friction) */}
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

              {/* Local Walkthrough Notice */}
              <View style={styles.localWalkthroughCard}>
                <Text style={styles.localWalkthroughOverline}>LOCAL WALKTHROUGH</Text>
                <Text style={styles.localWalkthroughText}>
                  Use this space to explore how a shared moment can gently move forward. Changes here are only visible in this browser.
                </Text>
              </View>

              {/* Perspective Segmented Control */}
              <View style={styles.segmentedControlCard}>
                <View
                  style={styles.segmentedControlRow}
                  role="tablist"
                  accessibilityRole="tablist"
                >
                  <Pressable
                    style={[
                      styles.segmentTab,
                      previewPerspective === "alex" && styles.segmentTabSelected,
                    ]}
                    onPress={() => setPreviewPerspective("alex")}
                    accessibilityRole="tab"
                    accessibilityState={{
                      selected: previewPerspective === "alex",
                    }}
                    accessibilityLabel={`Viewing as ${creatorLabel}`}
                  >
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={[
                        styles.segmentTabText,
                        previewPerspective === "alex" && styles.segmentTabTextSelected,
                      ]}
                    >
                      Viewing as {creatorLabel}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.segmentTab,
                      previewPerspective === "sam" && styles.segmentTabSelected,
                    ]}
                    onPress={() => setPreviewPerspective("sam")}
                    accessibilityRole="tab"
                    accessibilityState={{
                      selected: previewPerspective === "sam",
                    }}
                    accessibilityLabel={`Viewing as ${recipientCapitalized}`}
                  >
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={[
                        styles.segmentTabText,
                        previewPerspective === "sam" && styles.segmentTabTextSelected,
                      ]}
                    >
                      Viewing as {recipientCapitalized}
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.segmentCaption}>
                  Explore each person’s view without changing what is saved.
                </Text>
              </View>

              {/* One Next Action at Each Stage: "What feels right next?" Card */}
              <CouplySectionCard style={styles.nextActionCard}>
                <View style={styles.nextActionHeader}>
                  <Text style={styles.nextActionOverline}>NEXT STEP</Text>
                  <Text style={styles.nextActionTitle}>What feels right next?</Text>
                </View>

                {/* STAGE A: OPEN */}
                {isOpen && (
                  <View style={styles.stageContentBlock}>
                    {previewPerspective === "alex" ? (
                      <View style={styles.openAlexBlock}>
                        <Text style={styles.stageSubheading}>
                          Waiting quietly for {recipientLabel}
                        </Text>
                        <Text style={styles.stageBodyText}>
                          You shared this moment with {recipientLabel}. In this preview, you can switch to viewing as {recipientCapitalized} above to see how they can respond in their own rhythm.
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.openSamBlock}>
                        <Text style={styles.stageSubheading}>
                          {recipientCapitalized}’s response
                        </Text>
                        <Text style={styles.stageBodyText}>
                          Respond in your own rhythm. There is no deadline, score, or requirement to fix anything right away.
                        </Text>

                        <View style={styles.choicesStack}>
                          <CouplyChoiceCard
                            title="🤍 I hear you"
                            description="Acknowledge without feeling pushed to debate or solve right now"
                            selected={(partnerResponse as string) === "heard"}
                            onPress={() => setPartnerResponse("heard")}
                            accessibilityLabel="I hear you: Acknowledge without feeling pushed to debate or solve right now"
                          />
                          <CouplyChoiceCard
                            title="⏳ I need a little time"
                            description="Signal care while taking gentle breathing room"
                            selected={
                              (partnerResponse as string) === "need_time"
                            }
                            onPress={() => setPartnerResponse("need_time")}
                            accessibilityLabel="I need a little time: Signal care while taking gentle breathing room"
                          />
                          <CouplyChoiceCard
                            title="🌿 Suggest a small next step"
                            description="Propose a kind, concrete step to help you both soften"
                            selected={
                              (partnerResponse as string) ===
                              "suggest_next_step"
                            }
                            onPress={() => {
                              setPartnerResponse("suggest_next_step");
                              if (!suggestedStep) {
                                setSuggestedStep("A quiet chat");
                              }
                            }}
                            accessibilityLabel="Suggest a small next step: Propose a kind, concrete step to help you both soften"
                          />
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* STAGE B: IN CARE */}
                {!isOpen && (
                  <View style={styles.stageContentBlock}>
                    {/* Selected response banner */}
                    <View style={styles.responseDisplayBanner}>
                      <Text style={styles.responseDisplayTitle}>
                        {previewPerspective === "sam" ? (
                          partnerResponse === "heard" ? (
                            "🤍 You acknowledged this in preview: 'I hear you'"
                          ) : partnerResponse === "need_time" ? (
                            "⏳ You signaled in preview: 'I need a little time'"
                          ) : (
                            `🌿 You suggested in preview: ${suggestedStep || "A quiet chat"}`
                          )
                        ) : partnerResponse === "heard" ? (
                          `🤍 In this preview, ${recipientCapitalized} saw this: 'I hear you'`
                        ) : partnerResponse === "need_time" ? (
                          `⏳ In this preview, ${recipientCapitalized} needs a little time`
                        ) : (
                          `🌿 In this preview, ${recipientCapitalized} suggested: ${suggestedStep || "A quiet chat"}`
                        )}
                      </Text>

                      <Text style={styles.responseDisplayBody}>
                        {partnerResponse === "need_time"
                          ? previewPerspective === "sam"
                            ? "Taking quiet space to process emotions gently. Nothing needs to happen immediately."
                            : `${recipientCapitalized} needs a little quiet space right now. Giving each other time protects emotional safety.`
                          : partnerResponse === "heard"
                          ? previewPerspective === "sam"
                            ? `${creatorLabel} knows you received this with care and no defense. You can talk when ready.`
                            : "Your shared thoughts were received with openness. Connection is softening."
                          : previewPerspective === "sam"
                          ? "Offering a kind, low-pressure gesture to help you both reconnect."
                          : `${recipientCapitalized} offered a gentle next step whenever you both feel ready.`}
                      </Text>

                      {previewPerspective === "sam" && !isMutuallySettled && (
                        <Pressable
                          style={styles.changeResponseButton}
                          onPress={() => setPartnerResponse("none")}
                          accessibilityRole="button"
                          accessibilityLabel="Change your response"
                        >
                          <Text style={styles.changeResponseText}>
                            Change response
                          </Text>
                        </Pressable>
                      )}
                    </View>

                    {/* Optional step chooser if Sam selected suggest_next_step */}
                    {partnerResponse === "suggest_next_step" &&
                      previewPerspective === "sam" && (
                        <View style={styles.nextStepChooserBlock}>
                          <Text style={styles.nextStepChooserHeading}>
                            What might feel easier?
                          </Text>
                          <View style={styles.stepChipsRow}>
                            {SUGGESTED_NEXT_STEPS.map((step) => {
                              const isSelected = suggestedStep === step;
                              return (
                                <Pressable
                                  key={step}
                                  style={[
                                    styles.stepChip,
                                    isSelected && styles.stepChipSelected,
                                  ]}
                                  onPress={() => setSuggestedStep(step)}
                                  accessibilityRole="button"
                                  accessibilityState={{ selected: isSelected }}
                                  accessibilityLabel={step}
                                >
                                  <Text
                                    style={[
                                      styles.stepChipText,
                                      isSelected && styles.stepChipTextSelected,
                                    ]}
                                  >
                                    {step}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      )}

                    {/* STAGE C: INDIVIDUAL SETTLEMENT */}
                    <View style={styles.settlementBlock}>
                      <View style={styles.journeyDivider} />
                      <Text style={styles.settlementHeading}>
                        How does this feel for you?
                      </Text>
                      <Text style={styles.settlementSubtext}>
                        Your answer does not decide it for anyone else.
                      </Text>

                      <View style={styles.settleChoicesRow}>
                        <CouplyChoiceCard
                          style={styles.settleChoiceCardFlex}
                          title="🤝 This feels settled to me"
                          description="I feel ready to let this moment rest."
                          selected={currentSettled === true}
                          onPress={() => {
                            if (previewPerspective === "alex") {
                              setAlexSettled(true);
                            } else {
                              setSamSettled(true);
                            }
                          }}
                          accessibilityLabel="This feels settled to me"
                        />
                        <CouplyChoiceCard
                          style={styles.settleChoiceCardFlex}
                          title="🌿 Not settled yet"
                          description="Keep this open with care."
                          selected={currentSettled === false}
                          onPress={() => {
                            if (previewPerspective === "alex") {
                              setAlexSettled(false);
                            } else {
                              setSamSettled(false);
                            }
                          }}
                          accessibilityLabel="Not settled yet"
                        />
                      </View>

                      {/* Supportive note when selecting Not settled yet */}
                      {currentSettled === false && (
                        <View style={styles.calmInlineNotice}>
                          <Text style={styles.calmInlineNoticeText}>
                            This stays open with care. Nothing needs to be forced or solved right now.
                          </Text>
                        </View>
                      )}

                      {/* Empathetic notice if other partner is settled and current viewer is not */}
                      {otherSettled === true && currentSettled !== true && (
                        <View style={styles.oneSidedNoticeCard}>
                          <Text style={styles.oneSidedNoticeHeading}>
                            {previewPerspective === "alex"
                              ? `In this preview, ${recipientCapitalized} feels settled.`
                              : `In this preview, ${creatorLabel} feels settled.`}
                          </Text>
                          <Text style={styles.oneSidedNoticeText}>
                            You do not have to match that. This moment can stay open until it feels right for you too.
                          </Text>
                        </View>
                      )}

                      {/* STAGE D: PRIVATE INDIVIDUAL REFLECTION */}
                      {currentSettled === true && !currentPrivateDismissed && (
                        <View style={styles.privateReflectionCard}>
                          <View style={styles.privateReflectionBadgeRow}>
                            <View style={styles.privatePill}>
                              <Text style={styles.privatePillText}>Private to you</Text>
                            </View>
                          </View>
                          <Text style={styles.privateReflectionHeading}>
                            What helped you feel more connected again?
                          </Text>
                          <Text style={styles.privateReflectionSubtext}>
                            A small private reflection, only for you.
                          </Text>

                          <View style={styles.reflectionChipsRow}>
                            {PRIVATE_HELP_OPTIONS.map((tag) => {
                              const isSelected = currentPrivateTag === tag;
                              return (
                                <Pressable
                                  key={tag}
                                  style={[
                                    styles.reflectionChip,
                                    isSelected && styles.reflectionChipSelected,
                                  ]}
                                  onPress={() => {
                                    if (previewPerspective === "alex") {
                                      setAlexPrivateTag(tag);
                                    } else {
                                      setSamPrivateTag(tag);
                                    }
                                  }}
                                  accessibilityRole="button"
                                  accessibilityState={{ selected: isSelected }}
                                  accessibilityLabel={tag}
                                >
                                  <Text
                                    style={[
                                      styles.reflectionChipText,
                                      isSelected && styles.reflectionChipTextSelected,
                                    ]}
                                  >
                                    {tag}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>

                          <View style={styles.privateReflectionFooterRow}>
                            <CouplyQuietButton
                              variant="text"
                              label="Not now"
                              onPress={() => {
                                if (previewPerspective === "alex") {
                                  setAlexPrivateDismissed(true);
                                } else {
                                  setSamPrivateDismissed(true);
                                }
                              }}
                              accessibilityLabel="Not now"
                            />
                            <Text style={styles.privateReflectionFootnote}>
                              Private reflection — only visible in your view.
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* STAGE E & F: MUTUAL RECONNECTION & SHARED TAKEAWAY */}
                    {isMutuallySettled && (
                      <View style={styles.reconnectedSection}>
                        <View style={styles.journeyDivider} />
                        <View style={styles.reconnectedHeaderRow}>
                          <Text style={styles.reconnectedEmoji}>✨</Text>
                          <View style={styles.reconnectedTitleGroup}>
                            <Text style={styles.reconnectedHeading}>
                              You both feel ready to leave this moment here.
                            </Text>
                            <Text style={styles.reconnectedBody}>
                              A small shared moment can be enough.
                            </Text>
                          </View>
                        </View>

                        {/* Quiet action to see in Ours preview */}
                        <CouplyQuietButton
                          variant="soft"
                          label="See this in Ours"
                          onPress={() => {
                            router.push("/events?scope=ours");
                          }}
                          accessibilityLabel="See this in Ours"
                          style={styles.seeInOursButton}
                        />

                        {/* Creator-only Takeaway Prompt */}
                        {previewPerspective === "alex" &&
                          !isTakeawaySaved &&
                          !takeawayDismissed && (
                            <View style={styles.takeawayPromptCard}>
                              <Text style={styles.takeawayPromptHeading}>
                                Leave a small note for {recipientLabel}?
                              </Text>
                              <Text style={styles.takeawayPromptText}>
                                Share one gentle thought about what helped this moment soften. It is optional.
                              </Text>

                              <View style={styles.reflectionChipsRow}>
                                {SHARED_TAKEAWAY_OPTIONS.map((tag) => {
                                  const isSelected = takeawayTag === tag;
                                  return (
                                    <Pressable
                                      key={tag}
                                      style={[
                                        styles.reflectionChip,
                                        isSelected && styles.reflectionChipSelected,
                                      ]}
                                      onPress={() =>
                                        setTakeawayTag(isSelected ? null : tag)
                                      }
                                      accessibilityRole="button"
                                      accessibilityState={{
                                        selected: isSelected,
                                      }}
                                      accessibilityLabel={tag}
                                    >
                                      <Text
                                        style={[
                                          styles.reflectionChipText,
                                          isSelected && styles.reflectionChipTextSelected,
                                        ]}
                                      >
                                        {tag}
                                      </Text>
                                    </Pressable>
                                  );
                                })}
                              </View>

                              <Text style={styles.takeawayInputLabel}>
                                Your small takeaway
                              </Text>
                              <TextInput
                                style={styles.takeawayInput}
                                placeholder="e.g., Pausing for a breath helped us hear each other."
                                placeholderTextColor="#A89BB0"
                                value={takeawayNote}
                                onChangeText={setTakeawayNote}
                                accessibilityLabel="Your small takeaway"
                              />

                              <View style={styles.takeawayActionsRow}>
                                <CouplyPrimaryButton
                                  label="Share this takeaway"
                                  disabled={!authoredTakeawayText}
                                  onPress={() => {
                                    if (authoredTakeawayText) {
                                      setIsTakeawaySaved(true);
                                      setSharedTakeaway(
                                        takeawayNote.trim(),
                                        takeawayTag,
                                      );
                                    }
                                  }}
                                  accessibilityLabel="Share this takeaway"
                                />
                                <CouplyQuietButton
                                  variant="text"
                                  label="Not now"
                                  onPress={() => setTakeawayDismissed(true)}
                                  accessibilityLabel="Not now"
                                />
                              </View>

                              <Text style={styles.takeawayPrivacyReassuranceText}>
                                In this preview, {recipientCapitalized} will see only this note. Private reflections stay private.
                              </Text>
                            </View>
                          )}

                        {/* After creator shares: creator's perspective view */}
                        {isTakeawaySaved &&
                          authoredTakeawayText.length > 0 &&
                          previewPerspective === "alex" && (
                            <View style={styles.sharedTakeawayCard}>
                              <Text style={styles.sharedTakeawayOverline}>
                                SHARED IN THIS PREVIEW
                              </Text>
                              {takeawayTag && takeawayNote.trim().length > 0 && (
                                <View style={styles.sharedTakeawayPill}>
                                  <Text style={styles.sharedTakeawayPillText}>
                                    🏷️ {takeawayTag}
                                  </Text>
                                </View>
                              )}
                              <Text style={styles.sharedTakeawayBodyText}>
                                "{authoredTakeawayText}"
                              </Text>
                              <Text style={styles.sharedTakeawaySupporting}>
                                In this preview, {recipientLabel} would see this small takeaway in the moment.
                              </Text>
                              <Text style={styles.takeawayPreviewNoticeText}>
                                Preview only — this has not been saved or shared outside this browser.
                              </Text>
                            </View>
                          )}

                        {/* After creator shares: recipient's perspective read-only card */}
                        {isTakeawaySaved &&
                          authoredTakeawayText.length > 0 &&
                          previewPerspective === "sam" && (
                            <View style={styles.sharedTakeawayCard}>
                              <Text style={styles.sharedTakeawayOverline}>
                                A SMALL TAKEAWAY FROM {creatorLabel.toUpperCase()}
                              </Text>
                              {takeawayTag && takeawayNote.trim().length > 0 && (
                                <View style={styles.sharedTakeawayPill}>
                                  <Text style={styles.sharedTakeawayPillText}>
                                    🏷️ {takeawayTag}
                                  </Text>
                                </View>
                              )}
                              <Text style={styles.sharedTakeawayBodyText}>
                                "{authoredTakeawayText}"
                              </Text>
                              <Text style={styles.sharedTakeawaySupporting}>
                                {creatorLabel} shared this as a gentle closing note.
                              </Text>
                              <Text style={styles.takeawayPreviewNoticeText}>
                                Preview only — this has not been saved or shared outside this browser.
                              </Text>
                            </View>
                          )}
                      </View>
                    )}
                  </View>
                )}
              </CouplySectionCard>

              {/* Reset preview simulator action */}
              <CouplyQuietButton
                variant="soft"
                label="Start this preview again"
                onPress={handleResetPreview}
                accessibilityLabel="Start this preview again"
                style={styles.resetPreviewButton}
              />
            </View>
          )}

          {/* Non-creator partner informational card (Mine friction only - legacy) */}
          {!isPositive && !isCreator && !isSharedFriction && (
            <CouplySectionCard>
              <Text style={styles.partnerNoticeHeading}>
                A moment to reconnect
              </Text>
              <Text style={styles.partnerNoticeText}>
                This was shared so you can reconnect when you feel ready. There’s
                nothing you need to do in the app right now.
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
                  accessibilityLabel="Softening: It is beginning to ease."
                >
                  <Text
                    style={[
                      styles.repairCardTitle,
                      event.status === "partially_repaired" &&
                        styles.repairCardTitleActive,
                    ]}
                  >
                    Softening
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
                          placeholderTextColor="#9A8D9D"
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
                            Moving this to Mine removes {partnerName ? `${partnerName}’s` : "your partner’s"} future access.
                            Anything already seen cannot be taken back.
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
    </CouplyPage>
  );
}

function formatCategory(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatStatus(status: RelationshipEvent["status"]) {
  switch (status) {
    case "open":
      return "Still lingering";
    case "partially_repaired":
      return "Softening";
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

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 64,
  },
  column: {
    width: "100%",
    maxWidth: tokens.layout.maxContentWidth,
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
    letterSpacing: -0.3,
  },
  sharedTopicContextBox: {
    backgroundColor: tokens.colors.surfaceLilac,
    borderRadius: tokens.radii.small,
    padding: tokens.spacing.sm + 2,
    marginTop: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: tokens.colors.borderSoft,
  },
  sharedTopicContextLabel: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "700",
    color: tokens.colors.plum,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  sharedTopicContextText: {
    fontSize: tokens.typeScale.body,
    color: tokens.colors.text,
    lineHeight: 20,
  },
  summaryMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: tokens.spacing.md,
  },
  metaRecordedDate: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
  },
  intensityPill: {
    backgroundColor: tokens.colors.surfaceBlush,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.radii.small,
    borderWidth: 1,
    borderColor: tokens.colors.borderSoft,
  },
  intensityPillText: {
    fontSize: tokens.typeScale.caption,
    fontWeight: "600",
    color: tokens.colors.plum,
  },

  /* Privacy boundary */
  privacyCardSpacing: {
    marginTop: -4,
  },
  privacyCardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  privatePill: {
    backgroundColor: tokens.colors.surfaceBlush,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.radii.pill,
  },
  privatePillText: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "700",
    color: tokens.colors.plum,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  privacySubtext: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
  },
  privacySafeNoticeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  privacySafeIcon: {
    fontSize: 14,
  },
  privacySafeText: {
    flex: 1,
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
    lineHeight: 18,
  },
  sharedPill: {
    backgroundColor: tokens.colors.surfaceLilac,
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
    fontSize: tokens.typeScale.bodyLarge,
    color: tokens.colors.text,
    lineHeight: 22,
    marginTop: 4,
  },

  /* Outcomes */
  positiveOutcomeTitle: {
    fontSize: tokens.typeScale.bodyLarge,
    fontWeight: "700",
    color: tokens.colors.plum,
    textAlign: "center",
  },
  positiveOutcomeSubtitle: {
    fontSize: tokens.typeScale.body,
    color: tokens.colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },

  /* Mine Friction Status Display */
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusLabel: {
    fontSize: tokens.typeScale.body,
    fontWeight: "600",
    color: tokens.colors.textSecondary,
  },
  statusMethodText: {
    fontSize: tokens.typeScale.body,
    fontWeight: "600",
    color: tokens.colors.text,
  },
  statusSubtext: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
  },
  statusGuidanceText: {
    fontSize: tokens.typeScale.body,
    color: tokens.colors.textSecondary,
    lineHeight: 20,
    marginTop: 8,
  },

  /* Journey Header & Preview Notice */
  journeyContainer: {
    gap: 14,
    width: "100%",
  },
  journeyHeaderBlock: {
    marginHorizontal: tokens.spacing.page,
    gap: 4,
    paddingTop: tokens.spacing.sm,
  },
  journeyOverline: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: tokens.colors.plum,
    textTransform: "uppercase",
  },
  journeyHeading: {
    fontSize: 20,
    fontWeight: "700",
    color: tokens.colors.text,
    letterSpacing: -0.3,
  },
  journeySupportingText: {
    fontSize: tokens.typeScale.body,
    color: tokens.colors.textSecondary,
    lineHeight: 20,
  },
  localWalkthroughCard: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.radii.card,
    borderWidth: 1.2,
    borderColor: tokens.colors.border,
    padding: tokens.spacing.md,
    marginHorizontal: tokens.spacing.page,
    gap: 4,
  },
  localWalkthroughOverline: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: tokens.colors.plum,
  },
  localWalkthroughText: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
    lineHeight: 18,
  },

  /* Perspective Segmented Control */
  segmentedControlCard: {
    backgroundColor: tokens.colors.surfaceLilac,
    borderRadius: tokens.radii.card,
    borderWidth: 1.2,
    borderColor: tokens.colors.borderSoft,
    padding: tokens.spacing.sm,
    marginHorizontal: tokens.spacing.page,
    gap: tokens.spacing.xs,
  },
  segmentedControlRow: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#EFE8F2",
    borderRadius: tokens.radii.card - 4,
    padding: 4,
  },
  segmentTab: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: tokens.radii.card - 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.2,
    borderColor: "transparent",
  },
  segmentTabSelected: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.plum,
    shadowColor: tokens.colors.plum,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentTabText: {
    fontSize: tokens.typeScale.body,
    fontWeight: "500",
    color: tokens.colors.textSecondary,
    textAlign: "center",
  },
  segmentTabTextSelected: {
    fontWeight: "700",
    color: tokens.colors.plum,
  },
  segmentCaption: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
    textAlign: "center",
    paddingTop: 2,
  },

  /* One Next Action Card */
  nextActionCard: {
    gap: tokens.spacing.md,
  },
  nextActionHeader: {
    gap: 2,
  },
  nextActionOverline: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: tokens.colors.plum,
  },
  nextActionTitle: {
    fontSize: tokens.typeScale.sectionTitle,
    fontWeight: "700",
    color: tokens.colors.text,
  },
  stageContentBlock: {
    gap: tokens.spacing.md,
  },
  openAlexBlock: {
    gap: 6,
  },
  openSamBlock: {
    gap: 10,
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
    color: "#FFFFFF",
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
  settleChoicesRow: {
    flexDirection: "row",
    gap: 10,
  },
  settleChoiceCardFlex: {
    flex: 1,
  },
  calmInlineNotice: {
    backgroundColor: tokens.colors.surfaceLilac,
    borderRadius: tokens.radii.small,
    padding: 10,
    borderWidth: 1,
    borderColor: tokens.colors.borderSoft,
  },
  calmInlineNoticeText: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
    lineHeight: 17,
  },
  oneSidedNoticeCard: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.radii.small,
    padding: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    gap: 4,
  },
  oneSidedNoticeHeading: {
    fontSize: tokens.typeScale.body,
    fontWeight: "700",
    color: tokens.colors.plum,
  },
  oneSidedNoticeText: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
    lineHeight: 17,
  },

  /* Private reflection */
  privateReflectionCard: {
    backgroundColor: tokens.colors.surfaceLilac,
    borderRadius: tokens.radii.card,
    padding: 14,
    borderWidth: 1.2,
    borderColor: tokens.colors.borderSoft,
    gap: 10,
    marginTop: 4,
  },
  privateReflectionBadgeRow: {
    flexDirection: "row",
  },
  privateReflectionHeading: {
    fontSize: tokens.typeScale.bodyLarge,
    fontWeight: "700",
    color: tokens.colors.text,
  },
  privateReflectionSubtext: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
  },
  reflectionChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  reflectionChip: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.small,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1.2,
    borderColor: tokens.colors.border,
  },
  reflectionChipSelected: {
    backgroundColor: tokens.colors.plum,
    borderColor: tokens.colors.plum,
  },
  reflectionChipText: {
    fontSize: tokens.typeScale.caption,
    fontWeight: "600",
    color: tokens.colors.text,
  },
  reflectionChipTextSelected: {
    color: "#FFFFFF",
  },
  privateReflectionFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  privateReflectionFootnote: {
    fontSize: tokens.typeScale.overline,
    color: tokens.colors.textSecondary,
    fontStyle: "italic",
  },

  /* Reconnected section */
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
  seeInOursButton: {
    alignSelf: "flex-start",
    marginTop: 4,
  },

  /* Takeaway Prompt */
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
    fontSize: 15,
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
  takeawayPrivacyReassuranceText: {
    fontSize: tokens.typeScale.overline,
    color: tokens.colors.textSecondary,
    fontStyle: "italic",
    marginTop: 2,
    lineHeight: 16,
  },
  takeawayPreviewNoticeText: {
    fontSize: tokens.typeScale.overline,
    color: tokens.colors.textSecondary,
    fontStyle: "italic",
    marginTop: 4,
    lineHeight: 15,
  },

  /* Shared Takeaway Display Card */
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
  sharedTakeawaySupporting: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
    lineHeight: 17,
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
  sharedTakeawayBodyText: {
    fontSize: tokens.typeScale.bodyLarge,
    fontWeight: "500",
    color: tokens.colors.text,
    lineHeight: 20,
    fontStyle: "italic",
    marginVertical: 2,
  },

  /* Reset Preview Button */
  resetPreviewButton: {
    alignSelf: "center",
    marginTop: 8,
  },

  /* Sections */
  sectionContainer: {
    gap: 10,
    marginHorizontal: tokens.spacing.page,
  },
  sectionHeading: {
    fontSize: tokens.typeScale.sectionTitle,
    fontWeight: "700",
    color: tokens.colors.text,
    letterSpacing: -0.2,
  },
  partnerNoticeHeading: {
    fontSize: 15,
    fontWeight: "700",
    color: tokens.colors.text,
  },
  partnerNoticeText: {
    fontSize: tokens.typeScale.body,
    color: tokens.colors.textSecondary,
    lineHeight: 20,
    marginTop: 4,
  },

  /* Friction repair reflection cards */
  repairCardsContainer: {
    gap: 10,
  },
  repairCard: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1.2,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.card,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  repairCardActive: {
    borderColor: tokens.colors.plum,
    backgroundColor: tokens.colors.surfaceLilac,
  },
  repairCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: tokens.colors.text,
    marginBottom: 2,
  },
  repairCardTitleActive: {
    color: tokens.colors.plum,
  },
  repairCardSubtitle: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
    lineHeight: 18,
  },

  repairMethodsSubcard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.card,
    padding: 16,
    borderWidth: 1.2,
    borderColor: tokens.colors.border,
    gap: 10,
    marginTop: 6,
  },
  repairMethodsTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: tokens.colors.text,
  },
  repairMethodsSubtitle: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
  },
  methodsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  methodChip: {
    backgroundColor: tokens.colors.pageBackground,
    borderWidth: 1.2,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.pill,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  methodChipSelected: {
    backgroundColor: tokens.colors.surfaceLilac,
    borderColor: tokens.colors.plum,
  },
  methodChipText: {
    fontSize: tokens.typeScale.caption,
    fontWeight: "500",
    color: tokens.colors.text,
  },
  methodChipTextSelected: {
    fontWeight: "600",
    color: tokens.colors.plum,
  },
  cancelLinkButton: {
    paddingVertical: 6,
    alignItems: "center",
  },
  cancelLinkText: {
    fontSize: tokens.typeScale.caption,
    fontWeight: "600",
    color: tokens.colors.textSecondary,
  },

  /* Sharing card */
  sharingCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.card,
    padding: 16,
    borderWidth: 1.2,
    borderColor: tokens.colors.border,
    gap: 12,
  },
  sharingExplanationText: {
    fontSize: tokens.typeScale.body,
    color: tokens.colors.textSecondary,
    lineHeight: 19,
  },
  secondaryActionButton: {
    backgroundColor: tokens.colors.surfaceLilac,
    borderRadius: tokens.radii.small,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionText: {
    fontSize: tokens.typeScale.bodyLarge,
    fontWeight: "600",
    color: tokens.colors.plum,
  },
  sharingActivePanel: {
    gap: 12,
    paddingTop: 6,
  },
  sharingFieldLabel: {
    fontSize: tokens.typeScale.bodyLarge,
    fontWeight: "600",
    color: tokens.colors.text,
  },
  sharingInput: {
    minHeight: 80,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.small,
    borderWidth: 1.2,
    borderColor: tokens.colors.border,
    padding: 12,
    fontSize: tokens.typeScale.body,
    color: tokens.colors.text,
    textAlignVertical: "top",
  },
  warningNoticeBox: {
    backgroundColor: tokens.colors.surfaceBlush,
    borderColor: tokens.colors.borderSoft,
    borderWidth: 1,
    borderRadius: tokens.radii.small,
    padding: 12,
  },
  warningNoticeText: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.plum,
    lineHeight: 18,
  },
  primaryConfirmButton: {
    backgroundColor: tokens.colors.plum,
    borderRadius: tokens.radii.small,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryConfirmText: {
    fontSize: tokens.typeScale.bodyLarge,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  /* Delete */
  deleteContainer: {
    paddingTop: 8,
    alignItems: "center",
    marginHorizontal: tokens.spacing.page,
  },
  quietDeleteButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  quietDeleteText: {
    fontSize: tokens.typeScale.body,
    color: tokens.colors.textSecondary,
    fontWeight: "500",
    textDecorationLine: "underline",
  },
  deleteConfirmCard: {
    width: "100%",
    backgroundColor: tokens.colors.surfaceBlush,
    borderColor: tokens.colors.borderSoft,
    borderWidth: 1.2,
    borderRadius: tokens.radii.card,
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  deleteConfirmTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: tokens.colors.plum,
  },
  deleteConfirmSubtitle: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
    marginBottom: 8,
  },
  deleteActionsRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginTop: 4,
  },
  deleteCancelButton: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.small,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteCancelText: {
    fontSize: tokens.typeScale.body,
    fontWeight: "600",
    color: tokens.colors.textSecondary,
  },
  deleteFinalButton: {
    flex: 1,
    backgroundColor: tokens.colors.plum,
    borderRadius: tokens.radii.small,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteFinalText: {
    fontSize: tokens.typeScale.body,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  /* Status message */
  statusBanner: {
    backgroundColor: tokens.colors.surfaceLilac,
    borderColor: tokens.colors.borderSoft,
    borderWidth: 1,
    borderRadius: tokens.radii.small,
    padding: 12,
    alignItems: "center",
    marginHorizontal: tokens.spacing.page,
  },
  statusBannerText: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.plum,
    fontWeight: "500",
    textAlign: "center",
  },
});
