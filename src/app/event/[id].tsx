import { useRepairPreview } from "@/context/RepairPreviewContext";
import { useUserIdentity } from "@/context/UserIdentityContext";
import { supabase } from "@/lib/supabase";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
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

  if (!event) {
    return (
      <SafeAreaView style={styles.safeArea}>
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
      </SafeAreaView>
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
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.column}>
          {/* Back navigation */}
          <Pressable
            style={styles.backButton}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel={backAccessibilityLabel}
          >
            <Text style={styles.backButtonText}>{backLabel}</Text>
          </Pressable>

          {/* Header Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryTopRow}>
              <Text style={styles.momentTypeHeading}>
                {isPositive ? "A good moment" : "Something felt off"}
              </Text>
              <View
                style={[
                  styles.visibilityBadge,
                  event.visibility === "ours"
                    ? styles.visibilityBadgeOurs
                    : styles.visibilityBadgeMine,
                ]}
              >
                <Text
                  style={[
                    styles.visibilityBadgeText,
                    event.visibility === "ours"
                      ? styles.visibilityBadgeTextOurs
                      : styles.visibilityBadgeTextMine,
                  ]}
                >
                  {event.visibility === "ours"
                    ? `Shared with ${partnerRef}`
                    : "Private to you"}
                </Text>
              </View>
            </View>

            <Text style={styles.categoryTitle}>
              {formatCategory(event.category)}
            </Text>

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
          </View>

          {/* Private reflection card (if exists) */}
          {privateNote && (!isSharedFriction || previewPerspective === "alex") && (
            <View style={styles.privateCard}>
              <View style={styles.contentCardHeader}>
                <View style={styles.privateDot} />
                <View style={styles.contentCardTitleGroup}>
                  <Text style={styles.privateCardHeading}>For your eyes</Text>
                  <Text style={styles.privateCardSubtitle}>
                    Only you can see this.
                  </Text>
                </View>
              </View>
              <Text style={styles.noteBodyText}>{privateNote}</Text>
            </View>
          )}

          {/* Sam perspective privacy notice */}
          {isSharedFriction && previewPerspective === "sam" && (
            <View style={styles.privacySafeNotice}>
              <Text style={styles.privacySafeText}>
                🔒 Private reflections remain hidden. You only see what was tenderly shared.
              </Text>
            </View>
          )}

          {/* Shared wording card (if Ours & topic exists) */}
          {event.visibility === "ours" && event.shared_topic && (
            <View style={styles.sharedCard}>
              <View style={styles.contentCardHeader}>
                <View style={styles.sharedDot} />
                <View style={styles.contentCardTitleGroup}>
                  <Text style={styles.sharedCardHeading}>
                    Shared with {partnerRef}
                  </Text>
                </View>
              </View>
              <Text style={styles.noteBodyText}>{event.shared_topic}</Text>
            </View>
          )}

          {/* Positive moment outcome */}
          {isPositive && (
            <View style={styles.positiveOutcomeCard}>
              <Text style={styles.positiveOutcomeTitle}>
                A good moment, kept with care.
              </Text>
              <Text style={styles.positiveOutcomeSubtitle}>
                {event.visibility === "mine"
                  ? "Kept privately for you. You can revisit this whenever you need."
                  : `Part of your shared story with ${partnerRef}.`}
              </Text>
            </View>
          )}

          {/* Friction current state */}
          {!isPositive && (
            <View style={styles.statusDisplayCard}>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Where this stands</Text>
                <View style={styles.statusValueBadge}>
                  <Text style={styles.statusValueText}>
                    {isSharedFriction
                      ? isMutuallySettled
                        ? "Reconnected"
                        : isInCare
                        ? "In care"
                        : "Open"
                      : formatStatus(event.status)}
                  </Text>
                </View>
              </View>

              <Text style={styles.statusGuidanceText}>
                {isSharedFriction
                  ? isMutuallySettled
                    ? "You both feel ready to leave this moment here."
                    : isInCare
                    ? "Tension can take time to ease. You can update this whenever things shift."
                    : `You shared this moment with ${partnerRef}. They can respond whenever it feels right.`
                  : event.status === "reconnected"
                  ? "Taking time to repair helps you stay close."
                  : event.visibility === "mine"
                  ? "Kept privately for you. You can revisit this whenever you need."
                  : "Tension can take time to ease. You can update this whenever things shift."}
              </Text>

              {(!isSharedFriction
                ? event.repair_method
                : isMutuallySettled && isTakeawaySaved && takeawayTag
                ? takeawayTag
                : null) && (
                <View style={[styles.statusRow, { marginTop: 10 }]}>
                  <Text style={styles.statusLabel}>What helped</Text>
                  <Text style={styles.statusMethodText}>
                    {formatCategory(
                      !isSharedFriction ? event.repair_method! : takeawayTag!,
                    )}
                  </Text>
                </View>
              )}

              {!isSharedFriction && event.reconnected_at && (
                <View style={[styles.statusRow, { marginTop: 8 }]}>
                  <Text style={styles.statusLabel}>Reconnected</Text>
                  <Text style={styles.statusSubtext}>
                    {formatDate(event.reconnected_at)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ========================================================= */}
          {/* Consolidated Repair Journey Preview (Shared Friction)      */}
          {/* ========================================================= */}
          {isSharedFriction && (
            <View style={styles.journeyContainer}>
              {/* Visible calm preview notice */}
              <View style={styles.previewModeNotice}>
                <View style={styles.previewModeBadge}>
                  <Text style={styles.previewModeBadgeText}>PREVIEW MODE</Text>
                </View>
                <Text style={styles.previewModeNoticeText}>
                  Preview mode — responses here are temporary and are not yet
                  shared with your partner.
                </Text>
              </View>

              {/* Perspective Switcher */}
              <View style={styles.perspectiveContainer}>
                <Pressable
                  style={[
                    styles.perspectiveCard,
                    previewPerspective === "alex" &&
                      styles.perspectiveCardSelected,
                  ]}
                  onPress={() => setPreviewPerspective("alex")}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: previewPerspective === "alex",
                  }}
                  accessibilityLabel={`View as ${creatorLabel}: Who shared the moment`}
                >
                  <View style={styles.perspectiveHeaderRow}>
                    <Text style={styles.perspectiveEmoji}>✍️</Text>
                    <Text
                      style={[
                        styles.perspectiveTitle,
                        previewPerspective === "alex" &&
                          styles.perspectiveTitleSelected,
                      ]}
                    >
                      Viewing as {creatorLabel}
                    </Text>
                  </View>
                  <Text style={styles.perspectiveSubtext}>
                    Who shared the moment
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.perspectiveCard,
                    previewPerspective === "sam" &&
                      styles.perspectiveCardSelected,
                  ]}
                  onPress={() => setPreviewPerspective("sam")}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: previewPerspective === "sam",
                  }}
                  accessibilityLabel={`View as ${recipientCapitalized}: Partner responding`}
                >
                  <View style={styles.perspectiveHeaderRow}>
                    <Text style={styles.perspectiveEmoji}>🌿</Text>
                    <Text
                      style={[
                        styles.perspectiveTitle,
                        previewPerspective === "sam" &&
                          styles.perspectiveTitleSelected,
                      ]}
                    >
                      Viewing as {recipientCapitalized}
                    </Text>
                  </View>
                  <Text style={styles.perspectiveSubtext}>
                    Partner responding
                  </Text>
                </Pressable>
              </View>

              {/* STAGE A: OPEN */}
              {isOpen && (
                <View style={styles.journeyCard}>
                  {previewPerspective === "alex" ? (
                    <View style={styles.openAlexBlock}>
                      <Text style={styles.journeyHeading}>
                        Waiting quietly for {recipientLabel}
                      </Text>
                      <Text style={styles.journeyText}>
                        You shared this moment with {recipientLabel}. They can respond whenever
                        it feels right.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.openSamBlock}>
                      <Text style={styles.journeyHeading}>
                        {recipientCapitalized}’s Response
                      </Text>
                      <Text style={styles.journeyText}>
                        Respond in your own rhythm. There is no deadline, score,
                        or requirement to fix anything right away.
                      </Text>

                      <View style={styles.responseOptionsGroup}>
                        <Pressable
                          style={[
                            styles.responseOptionButton,
                            (partnerResponse as PartnerResponseChoice) ===
                              "heard" && styles.responseButtonActive,
                          ]}
                          onPress={() => setPartnerResponse("heard")}
                          accessibilityRole="button"
                          accessibilityLabel="I hear you"
                        >
                          <Text style={styles.responseButtonTitle}>
                            🤍 I hear you
                          </Text>
                          <Text style={styles.responseButtonCaption}>
                            Acknowledge without feeling pushed to debate or
                            solve right now
                          </Text>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.responseOptionButton,
                            (partnerResponse as PartnerResponseChoice) ===
                              "need_time" && styles.responseButtonActive,
                          ]}
                          onPress={() => setPartnerResponse("need_time")}
                          accessibilityRole="button"
                          accessibilityLabel="I need a little time"
                        >
                          <Text style={styles.responseButtonTitle}>
                            ⏳ I need a little time
                          </Text>
                          <Text style={styles.responseButtonCaption}>
                            Signal care while taking gentle breathing room
                          </Text>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.responseOptionButton,
                            (partnerResponse as PartnerResponseChoice) ===
                              "suggest_next_step" &&
                              styles.responseButtonActive,
                          ]}
                          onPress={() => {
                            setPartnerResponse("suggest_next_step");
                            if (!suggestedStep) {
                              setSuggestedStep("A quiet chat");
                            }
                          }}
                          accessibilityRole="button"
                          accessibilityLabel="Suggest a small next step"
                        >
                          <Text style={styles.responseButtonTitle}>
                            🌿 Suggest a small next step
                          </Text>
                          <Text style={styles.responseButtonCaption}>
                            Propose a kind, concrete step to help you both
                            soften
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* STAGE B: IN CARE */}
              {!isOpen && (
                <View style={styles.journeyCard}>
                  {/* Selected response display for both perspectives */}
                  <View style={styles.responseDisplayBanner}>
                    <Text style={styles.responseDisplayTitle}>
                      {previewPerspective === "sam" ? (
                        partnerResponse === "heard" ? (
                          "🤍 You acknowledged this: 'I hear you'"
                        ) : partnerResponse === "need_time" ? (
                          "⏳ You signaled: 'I need a little time'"
                        ) : (
                          `🌿 You suggested: ${suggestedStep || "A quiet chat"}`
                        )
                      ) : partnerResponse === "heard" ? (
                        `🤍 ${recipientCapitalized} saw this: 'I hear you'`
                      ) : partnerResponse === "need_time" ? (
                        `⏳ ${recipientCapitalized} needs a little time right now`
                      ) : (
                        `🌿 ${recipientCapitalized} suggested: ${suggestedStep || "A quiet chat"}`
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

                    {previewPerspective === "sam" && (
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

                  {/* Optional compact step chooser if Sam selected suggest_next_step */}
                  {partnerResponse === "suggest_next_step" &&
                    previewPerspective === "sam" && (
                      <View style={styles.nextStepChooserBlock}>
                        <Text style={styles.nextStepChooserHeading}>
                          What small step feels right?
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
                      How does this feel for you now?
                    </Text>
                    <Text style={styles.settlementSubtext}>
                      Both people get to name their own experience. This moment
                      stays open unless each person genuinely feels ready.
                    </Text>

                    <View style={styles.settleChoicesRow}>
                      <Pressable
                        style={[
                          styles.settleChoiceCard,
                          currentSettled === true &&
                            styles.settleChoiceCardActiveSettled,
                        ]}
                        onPress={() => {
                          if (previewPerspective === "alex") {
                            setAlexSettled(true);
                          } else {
                            setSamSettled(true);
                          }
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: currentSettled === true }}
                        accessibilityLabel="This feels settled to me"
                      >
                        <Text
                          style={[
                            styles.settleChoiceTitle,
                            currentSettled === true &&
                              styles.settleChoiceTitleActiveSettled,
                          ]}
                        >
                          🤝 This feels settled to me
                        </Text>
                        <Text style={styles.settleChoiceDescription}>
                          I feel ready to let this moment rest.
                        </Text>
                      </Pressable>

                      <Pressable
                        style={[
                          styles.settleChoiceCard,
                          currentSettled === false &&
                            styles.settleChoiceCardActiveNotSettled,
                        ]}
                        onPress={() => {
                          if (previewPerspective === "alex") {
                            setAlexSettled(false);
                          } else {
                            setSamSettled(false);
                          }
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: currentSettled === false }}
                        accessibilityLabel="Not settled yet"
                      >
                        <Text
                          style={[
                            styles.settleChoiceTitle,
                            currentSettled === false &&
                              styles.settleChoiceTitleActiveNotSettled,
                          ]}
                        >
                          🌿 Not settled yet
                        </Text>
                        <Text style={styles.settleChoiceDescription}>
                          Keep this open with care.
                        </Text>
                      </Pressable>
                    </View>

                    {/* Supportive note when selecting Not settled yet */}
                    {currentSettled === false && (
                      <View style={styles.calmInlineNotice}>
                        <Text style={styles.calmInlineNoticeText}>
                          This stays open with care. Nothing needs to be forced or
                          solved right now.
                        </Text>
                      </View>
                    )}

                    {/* Empathetic notice if other partner is settled and current viewer is not */}
                    {otherSettled === true && currentSettled !== true && (
                      <View style={styles.oneSidedNoticeCard}>
                        <Text style={styles.oneSidedNoticeHeading}>
                          {previewPerspective === "alex"
                            ? `${recipientCapitalized} feels settled.`
                            : `${creatorLabel} feels settled.`}
                        </Text>
                        <Text style={styles.oneSidedNoticeText}>
                          You do not have to match that. This moment can stay
                          open until it feels right for you too.
                        </Text>
                      </View>
                    )}

                    {/* STAGE D: PRIVATE INDIVIDUAL REFLECTION */}
                    {currentSettled === true && !currentPrivateDismissed && (
                      <View style={styles.privateReflectionCard}>
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
                                    isSelected &&
                                      styles.reflectionChipTextSelected,
                                  ]}
                                >
                                  {tag}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>

                        <View style={styles.privateReflectionFooterRow}>
                          <Pressable
                            style={styles.notNowButton}
                            onPress={() => {
                              if (previewPerspective === "alex") {
                                setAlexPrivateDismissed(true);
                              } else {
                                setSamPrivateDismissed(true);
                              }
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Not now"
                          >
                            <Text style={styles.notNowButtonText}>Not now</Text>
                          </Pressable>
                          <Text style={styles.privateReflectionFootnote}>
                            Private reflection — only visible in your view.
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* STAGE E & F: RECONNECTED & SHARED TAKEAWAY */}
                  {isMutuallySettled && (
                    <View style={styles.reconnectedSection}>
                      <View style={styles.journeyDivider} />
                      <View style={styles.reconnectedHeaderRow}>
                        <Text style={styles.reconnectedEmoji}>✨</Text>
                        <Text style={styles.reconnectedHeading}>
                          Reconnected
                        </Text>
                      </View>
                      <Text style={styles.reconnectedText}>
                        You both feel ready to leave this moment here.
                      </Text>

                      {/* Quiet action to see in Ours preview */}
                      <Pressable
                        style={styles.seeInOursButton}
                        onPress={() => {
                          router.push("/events?scope=ours");
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="See this in Ours"
                      >
                        <Text style={styles.seeInOursButtonText}>
                          See this in Ours
                        </Text>
                      </Pressable>

                      {/* Creator-only Takeaway Prompt */}
                      {previewPerspective === "alex" &&
                        !isTakeawaySaved &&
                        !takeawayDismissed && (
                          <View style={styles.takeawayPromptCard}>
                            <Text style={styles.takeawayPromptHeading}>
                              Leave a small note for {recipientLabel}?
                            </Text>
                            <Text style={styles.takeawayPromptText}>
                              Share one gentle thought about what helped this
                              moment soften. It is optional.
                            </Text>

                            <View style={styles.reflectionChipsRow}>
                              {SHARED_TAKEAWAY_OPTIONS.map((tag) => {
                                const isSelected = takeawayTag === tag;
                                return (
                                  <Pressable
                                    key={tag}
                                    style={[
                                      styles.reflectionChip,
                                      isSelected &&
                                        styles.reflectionChipSelected,
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
                                        isSelected &&
                                          styles.reflectionChipTextSelected,
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
                              <Pressable
                                style={[
                                  styles.saveTakeawayButton,
                                  !authoredTakeawayText &&
                                    styles.saveTakeawayButtonDisabled,
                                ]}
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
                                accessibilityRole="button"
                                accessibilityState={{
                                  disabled: !authoredTakeawayText,
                                }}
                                accessibilityLabel="Share this takeaway"
                              >
                                <Text
                                  style={[
                                    styles.saveTakeawayButtonText,
                                    !authoredTakeawayText &&
                                      styles.saveTakeawayButtonTextDisabled,
                                  ]}
                                >
                                  Share this takeaway
                                </Text>
                              </Pressable>
                              <Pressable
                                style={styles.notNowButton}
                                onPress={() => setTakeawayDismissed(true)}
                                accessibilityRole="button"
                                accessibilityLabel="Not now"
                              >
                                <Text style={styles.notNowButtonText}>
                                  Not now
                                </Text>
                              </Pressable>
                            </View>

                            <Text style={styles.takeawayPrivacyReassuranceText}>
                              {recipientCapitalized} will see only this note. Private reflections stay private.
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
                            <Text style={styles.sharedTakeawaySupporting}>
                              In this preview, {recipientLabel} would see this small takeaway in the moment.
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
                              In this preview, {creatorLabel} shared this as a gentle closing note.
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

              {/* Reset preview simulator action */}
              <Pressable
                style={styles.resetPreviewButton}
                onPress={handleResetPreview}
                accessibilityRole="button"
                accessibilityLabel="Start this preview again"
              >
                <Text style={styles.resetPreviewButtonText}>
                  Start this preview again
                </Text>
              </Pressable>
            </View>
          )}

          {/* Non-creator partner informational card (Mine friction only - legacy) */}
          {!isPositive && !isCreator && !isSharedFriction && (
            <View style={styles.partnerNoticeCard}>
              <Text style={styles.partnerNoticeHeading}>
                A moment to reconnect
              </Text>
              <Text style={styles.partnerNoticeText}>
                This was shared so you can reconnect when you feel ready. There’s
                nothing you need to do in the app right now.
              </Text>
            </View>
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
    </SafeAreaView>
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
  safeArea: {
    flex: 1,
    backgroundColor: "#FBF7FC",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 64,
  },
  column: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    gap: 18,
  },
  backButton: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: -6,
  },
  backButtonText: {
    fontSize: 14.5,
    fontWeight: "600",
    color: "#6E416D",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  centerStatusText: {
    fontSize: 15,
    color: "#6D6072",
    textAlign: "center",
  },
  centerBackButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#F1EDF7",
  },
  centerBackButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6E416D",
  },

  /* 1. Summary Card */
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    shadowColor: "#39203B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 8,
  },
  summaryTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  momentTypeHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6E416D",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  categoryTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#3D3040",
    letterSpacing: -0.3,
  },
  visibilityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  visibilityBadgeMine: {
    backgroundColor: "#F1EDF7",
    borderColor: "#E5D8E6",
  },
  visibilityBadgeOurs: {
    backgroundColor: "#FBEFF7",
    borderColor: "#EAD6E8",
  },
  visibilityBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  visibilityBadgeTextMine: {
    color: "#5D4F62",
  },
  visibilityBadgeTextOurs: {
    color: "#6E416D",
  },
  summaryMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  metaRecordedDate: {
    fontSize: 13,
    color: "#6D6072",
  },
  intensityPill: {
    backgroundColor: "#F7EEF7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#EADAEB",
  },
  intensityPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6E416D",
  },

  /* Content Cards */
  contentCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  contentCardTitleGroup: {
    flex: 1,
  },
  privateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6E416D",
  },
  sharedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#9A457D",
  },
  privateCard: {
    backgroundColor: "#F1EDF7",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.2,
    borderColor: "#E5DCE8",
  },
  privateCardHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3D3040",
  },
  privateCardSubtitle: {
    fontSize: 12,
    color: "#6D6072",
    marginTop: 1,
  },
  sharedCard: {
    backgroundColor: "#FBEFF7",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.2,
    borderColor: "#EBD8E8",
  },
  sharedCardHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6E416D",
  },
  noteBodyText: {
    fontSize: 14.5,
    color: "#3D3040",
    lineHeight: 22,
    marginTop: 4,
  },

  /* Outcomes */
  positiveOutcomeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    alignItems: "center",
    gap: 4,
  },
  positiveOutcomeTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6E416D",
    textAlign: "center",
  },
  positiveOutcomeSubtitle: {
    fontSize: 13.5,
    color: "#6D6072",
    textAlign: "center",
  },

  statusDisplayCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusLabel: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#6D6072",
  },
  statusValueBadge: {
    backgroundColor: "#F1E8F3",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E0D0E2",
  },
  statusValueText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6E416D",
  },
  statusMethodText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#3D3040",
  },
  statusSubtext: {
    fontSize: 12.5,
    color: "#6D6072",
  },
  statusGuidanceText: {
    fontSize: 13,
    color: "#6D6072",
    lineHeight: 18,
    marginTop: 8,
  },

  /* Sections */
  sectionContainer: {
    gap: 10,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3D3040",
    letterSpacing: -0.2,
  },
  /* Non-creator partner informational card */
  partnerNoticeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    gap: 6,
  },
  partnerNoticeHeading: {
    fontSize: 15,
    fontWeight: "700",
    color: "#3D3040",
  },
  partnerNoticeText: {
    fontSize: 13.5,
    color: "#6D6072",
    lineHeight: 20,
  },

  /* Friction repair reflection cards */
  repairCardsContainer: {
    gap: 10,
  },
  repairCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  repairCardActive: {
    borderColor: "#6E416D",
    backgroundColor: "#FBEFF7",
  },
  repairCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#3D3040",
    marginBottom: 2,
  },
  repairCardTitleActive: {
    color: "#6E416D",
  },
  repairCardSubtitle: {
    fontSize: 13,
    color: "#6D6072",
    lineHeight: 18,
  },

  repairMethodsSubcard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    gap: 10,
    marginTop: 6,
  },
  repairMethodsTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#3D3040",
  },
  repairMethodsSubtitle: {
    fontSize: 13,
    color: "#6D6072",
  },
  methodsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  methodChip: {
    backgroundColor: "#FBF7FC",
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  methodChipSelected: {
    backgroundColor: "#F1E8F3",
    borderColor: "#6E416D",
  },
  methodChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#3D3040",
  },
  methodChipTextSelected: {
    fontWeight: "600",
    color: "#6E416D",
  },

  /* Sharing card */
  sharingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    gap: 12,
  },
  sharingExplanationText: {
    fontSize: 13.5,
    color: "#6D6072",
    lineHeight: 19,
  },
  secondaryActionButton: {
    backgroundColor: "#F1EDF7",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6E416D",
  },
  sharingActivePanel: {
    gap: 12,
    paddingTop: 6,
  },
  sharingFieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3D3040",
  },
  sharingInput: {
    minHeight: 80,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    padding: 12,
    fontSize: 14,
    color: "#3D3040",
    textAlignVertical: "top",
  },
  warningNoticeBox: {
    backgroundColor: "#FAF0EB",
    borderColor: "#ECD8CF",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  warningNoticeText: {
    fontSize: 13,
    color: "#784433",
    lineHeight: 18,
  },
  primaryConfirmButton: {
    backgroundColor: "#6E416D",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryConfirmText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  cancelLinkButton: {
    paddingVertical: 6,
    alignItems: "center",
  },
  cancelLinkText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6D6072",
  },

  /* Delete */
  deleteContainer: {
    paddingTop: 8,
    alignItems: "center",
  },
  quietDeleteButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  quietDeleteText: {
    fontSize: 13.5,
    color: "#9C4155",
    fontWeight: "500",
    textDecorationLine: "underline",
  },
  deleteConfirmCard: {
    width: "100%",
    backgroundColor: "#FFF5F7",
    borderColor: "#F0D5DA",
    borderWidth: 1.2,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  deleteConfirmTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#8B2E42",
  },
  deleteConfirmSubtitle: {
    fontSize: 13,
    color: "#7B4650",
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0CCD0",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteCancelText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#6D6072",
  },
  deleteFinalButton: {
    flex: 1,
    backgroundColor: "#9C4155",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteFinalText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  /* Status message */
  statusBanner: {
    backgroundColor: "#F7EEF7",
    borderColor: "#E8DCE9",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  statusBannerText: {
    fontSize: 13,
    color: "#6E416D",
    fontWeight: "500",
    textAlign: "center",
  },

  /* Privacy safe notice for Sam perspective */
  privacySafeNotice: {
    backgroundColor: "#FDF8FC",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EADEEB",
  },
  privacySafeText: {
    fontSize: 12.5,
    color: "#6D6072",
    lineHeight: 18,
    fontStyle: "italic",
  },

  /* Consolidated Journey Preview */
  journeyContainer: {
    gap: 16,
    width: "100%",
  },
  previewModeNotice: {
    backgroundColor: "#FAF5FB",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.2,
    borderColor: "#EBD8EA",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  previewModeBadge: {
    backgroundColor: "#F4E5F2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  previewModeBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#6E416D",
    letterSpacing: 0.5,
  },
  previewModeNoticeText: {
    flex: 1,
    fontSize: 12.5,
    color: "#6D6072",
    lineHeight: 17,
  },

  /* Perspective switcher */
  perspectiveContainer: {
    flexDirection: "row",
    gap: 12,
  },
  perspectiveCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    gap: 4,
  },
  perspectiveCardSelected: {
    borderColor: "#6E416D",
    backgroundColor: "#FAF5FB",
  },
  perspectiveHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  perspectiveEmoji: {
    fontSize: 15,
  },
  perspectiveTitle: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#6D6072",
  },
  perspectiveTitleSelected: {
    fontWeight: "700",
    color: "#6E416D",
  },
  perspectiveSubtext: {
    fontSize: 11.5,
    color: "#8E7E94",
  },

  /* Journey Card & Stages */
  journeyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    gap: 14,
  },
  openAlexBlock: {
    gap: 6,
  },
  openSamBlock: {
    gap: 10,
  },
  journeyHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3D3040",
  },
  journeyText: {
    fontSize: 13.5,
    color: "#6D6072",
    lineHeight: 20,
  },

  /* Response option buttons */
  responseOptionsGroup: {
    gap: 10,
    marginTop: 4,
  },
  responseOptionButton: {
    backgroundColor: "#FAF5FB",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    gap: 3,
  },
  responseButtonActive: {
    borderColor: "#6E416D",
    backgroundColor: "#F4E8F4",
  },
  responseButtonTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3D3040",
  },
  responseButtonCaption: {
    fontSize: 12,
    color: "#6D6072",
    lineHeight: 16,
  },

  /* In Care Banner */
  responseDisplayBanner: {
    backgroundColor: "#FAF5FB",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    gap: 6,
  },
  responseDisplayTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#4A154B",
  },
  responseDisplayBody: {
    fontSize: 13,
    color: "#5C4F61",
    lineHeight: 18,
  },
  changeResponseButton: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingVertical: 4,
  },
  changeResponseText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#6E416D",
    textDecorationLine: "underline",
  },

  /* Next step chooser */
  nextStepChooserBlock: {
    gap: 8,
    marginTop: 4,
  },
  nextStepChooserHeading: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#3D3040",
  },
  stepChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  stepChip: {
    backgroundColor: "#FAF5FB",
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
  },
  stepChipSelected: {
    backgroundColor: "#6E416D",
    borderColor: "#6E416D",
  },
  stepChipText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#5C4F61",
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
    backgroundColor: "#F0E5F1",
    marginVertical: 4,
  },
  settlementHeading: {
    fontSize: 15,
    fontWeight: "700",
    color: "#3D3040",
  },
  settlementSubtext: {
    fontSize: 13,
    color: "#6D6072",
    lineHeight: 18,
  },
  settleChoicesRow: {
    flexDirection: "row",
    gap: 10,
  },
  settleChoiceCard: {
    flex: 1,
    backgroundColor: "#FAF5FB",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    gap: 4,
  },
  settleChoiceCardActiveSettled: {
    backgroundColor: "#EBF6EE",
    borderColor: "#2D7738",
  },
  settleChoiceCardActiveNotSettled: {
    backgroundColor: "#FAF2EA",
    borderColor: "#C87A38",
  },
  settleChoiceTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#3D3040",
  },
  settleChoiceTitleActiveSettled: {
    color: "#1E5B28",
  },
  settleChoiceTitleActiveNotSettled: {
    color: "#8B4E1B",
  },
  settleChoiceDescription: {
    fontSize: 11.5,
    color: "#6D6072",
    lineHeight: 16,
  },
  calmInlineNotice: {
    backgroundColor: "#FAF5FB",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E8DCE9",
  },
  calmInlineNoticeText: {
    fontSize: 12,
    color: "#6D6072",
    lineHeight: 17,
  },
  oneSidedNoticeCard: {
    backgroundColor: "#FDF8FC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EADEEB",
    gap: 4,
  },
  oneSidedNoticeHeading: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#6E416D",
  },
  oneSidedNoticeText: {
    fontSize: 12.5,
    color: "#6D6072",
    lineHeight: 17,
  },

  /* Private reflection */
  privateReflectionCard: {
    backgroundColor: "#FDF8FC",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EADEEB",
    gap: 10,
    marginTop: 4,
  },
  privateReflectionHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3D3040",
  },
  privateReflectionSubtext: {
    fontSize: 12.5,
    color: "#6D6072",
  },
  reflectionChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  reflectionChip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1.2,
    borderColor: "#E0D2E3",
  },
  reflectionChipSelected: {
    backgroundColor: "#6E416D",
    borderColor: "#6E416D",
  },
  reflectionChipText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#5C4F61",
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
  notNowButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F1EDF5",
  },
  notNowButtonText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#6D6072",
  },
  privateReflectionFootnote: {
    fontSize: 11,
    color: "#8E7E94",
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
  reconnectedHeading: {
    fontSize: 17,
    fontWeight: "700",
    color: "#3D3040",
  },
  reconnectedText: {
    fontSize: 13.5,
    color: "#5C4F61",
    lineHeight: 19,
  },

  /* Takeaway Prompt */
  takeawayPromptCard: {
    backgroundColor: "#FDF8FC",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.2,
    borderColor: "#EADEEB",
    gap: 8,
    marginTop: 6,
  },
  takeawayPromptHeading: {
    fontSize: 15,
    fontWeight: "700",
    color: "#3D3040",
  },
  takeawayPromptText: {
    fontSize: 13,
    color: "#6D6072",
    lineHeight: 18,
  },
  takeawayInputLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#4A3E4E",
    marginTop: 2,
  },
  takeawayInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: "#D8C7DB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: "#3D3040",
  },
  takeawayActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  saveTakeawayButton: {
    backgroundColor: "#6E416D",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  saveTakeawayButtonDisabled: {
    backgroundColor: "#D8CCD9",
  },
  saveTakeawayButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  saveTakeawayButtonTextDisabled: {
    color: "#8E7E94",
  },
  takeawayPrivacyReassuranceText: {
    fontSize: 11.5,
    color: "#8E7E94",
    fontStyle: "italic",
    marginTop: 2,
    lineHeight: 16,
  },
  takeawayPreviewNoticeText: {
    fontSize: 11,
    color: "#9A8D9F",
    fontStyle: "italic",
    marginTop: 4,
    lineHeight: 15,
  },

  /* Shared Takeaway Display Card */
  sharedTakeawayCard: {
    backgroundColor: "#FAF5FB",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.2,
    borderColor: "#EBD8EA",
    gap: 6,
    marginTop: 6,
  },
  sharedTakeawayOverline: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8B6B92",
    letterSpacing: 0.8,
  },
  sharedTakeawaySupporting: {
    fontSize: 12.5,
    color: "#7D6D82",
    lineHeight: 17,
  },
  sharedTakeawayPill: {
    backgroundColor: "#F4E5F2",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sharedTakeawayPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6E416D",
  },
  sharedTakeawayBodyText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#3D3040",
    lineHeight: 20,
    fontStyle: "italic",
    marginVertical: 2,
  },

  /* Reset Preview Button */
  resetPreviewButton: {
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#F8F3F9",
    borderWidth: 1,
    borderColor: "#E5DAE6",
    marginTop: 4,
  },
  resetPreviewButtonText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#6E416D",
  },

  /* See this in Ours Action */
  seeInOursButton: {
    alignSelf: "flex-start",
    backgroundColor: "#F7EEF8",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1.2,
    borderColor: "#EAD2EC",
    marginTop: 4,
  },
  seeInOursButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6E416D",
  },
});
