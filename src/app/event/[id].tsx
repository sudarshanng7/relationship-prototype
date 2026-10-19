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

  const [showSharingControls, setShowSharingControls] = useState(false);
  const [sharedTopicInput, setSharedTopicInput] = useState("");
  const [changingVisibility, setChangingVisibility] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
                    ? "Shared with Sam"
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
              {!isPositive && event.intensity !== null && (
                <View style={styles.intensityPill}>
                  <Text style={styles.intensityPillText}>
                    It weighed on you: {event.intensity} of 5
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Private reflection card (if exists) */}
          {privateNote && (
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

          {/* Shared wording card (if Ours & topic exists) */}
          {event.visibility === "ours" && event.shared_topic && (
            <View style={styles.sharedCard}>
              <View style={styles.contentCardHeader}>
                <View style={styles.sharedDot} />
                <View style={styles.contentCardTitleGroup}>
                  <Text style={styles.sharedCardHeading}>Shared with Sam</Text>
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
                  : "Part of your shared story with Sam."}
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
                    {formatStatus(event.status)}
                  </Text>
                </View>
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
            </View>
          )}

          {/* Non-creator partner informational card (Ours friction only) */}
          {!isPositive && !isCreator && event.visibility === "ours" && (
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

          {/* Friction repair controls (creator only) */}
          {!isPositive && isCreator && (
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
                    ? "This is private to you. Sam will only see the version you choose to share."
                    : "Sam can see the shared wording below. Your private reflection remains private."}
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
                        ? "Choose what to share with Sam"
                        : "Change sharing"
                    }
                  >
                    <Text style={styles.secondaryActionText}>
                      {event.visibility === "mine"
                        ? "Choose what to share with Sam"
                        : "Change sharing"}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={styles.sharingActivePanel}>
                    {event.visibility === "mine" ? (
                      <>
                        <Text style={styles.sharingFieldLabel}>
                          What would you like Sam to know?
                        </Text>
                        <TextInput
                          style={styles.sharingInput}
                          value={sharedTopicInput}
                          onChangeText={setSharedTopicInput}
                          placeholder="Enter a gentle topic Sam can see"
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
                            Moving this to Mine removes Sam’s future access.
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
});
