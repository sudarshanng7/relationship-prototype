import { EventRepairSection } from "@/components/EventRepairSection";
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
  created_at: string;
};

type EventPerspective = {
  id: string;
  author_id: string;
  perspective_text: string;
  sharing_status: "submitted" | "suspended";
};

export default function EventDetailScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const eventId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [event, setEvent] = useState<RelationshipEvent | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [statusMessage, setStatusMessage] = useState("Loading...");

  const [privateNote, setPrivateNote] = useState<string | null>(null);

  const [showSharingControls, setShowSharingControls] = useState(false);
  const [sharedTopicInput, setSharedTopicInput] = useState("");
  const [changingVisibility, setChangingVisibility] = useState(false);
  const [perspectives, setPerspectives] = useState<EventPerspective[]>([]);
  const [perspectivesLoading, setPerspectivesLoading] = useState(true);
  const [perspectiveInput, setPerspectiveInput] = useState("");
  const [editingPerspective, setEditingPerspective] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savingPerspective, setSavingPerspective] = useState(false);

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
      setPerspectives([]);
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
    // RLS exposes only the author's own perspective and submitted partner
    // perspectives. A suspended record is not visible to the partner.
    const { data: perspectiveRows, error: perspectiveError } = await supabase
      .from("event_perspectives")
      .select("id, author_id, perspective_text, sharing_status")
      .eq("event_id", eventId);

    if (perspectiveError) {
      console.error("Failed to load perspectives:", perspectiveError);
      setPerspectives([]);
      setStatusMessage(
        `Could not load perspectives: ${perspectiveError.message}`,
      );
    } else {
      setPerspectives((perspectiveRows ?? []) as EventPerspective[]);
      setStatusMessage("");
    }
    setPerspectivesLoading(false);
  }

  async function changeMomentVisibility(newVisibility: "mine" | "ours") {
    if (!event || !currentUserId) return;

    // Only the event creator should see or initiate this action.
    // The database function independently enforces ownership.
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

  async function submitPerspective() {
    if (!event || event.visibility !== "ours" || savingPerspective) return;
    const text = perspectiveInput.trim();
    if (!text) {
      setStatusMessage("Write a perspective before sharing.");
      return;
    }

    setSavingPerspective(true);
    setStatusMessage("Saving perspective...");
    try {
      const { error } = await supabase.rpc("submit_event_perspective", {
        p_event_id: event.id,
        p_perspective_text: text,
      });
      if (error) throw error;
      setPerspectiveInput("");
      setEditingPerspective(false);
      setConfirmWithdraw(false);
      await loadEvent();
      setStatusMessage("Your perspective was shared.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Could not share perspective.",
      );
    } finally {
      setSavingPerspective(false);
    }
  }

  async function withdrawPerspective() {
    if (!event || savingPerspective) return;
    setSavingPerspective(true);
    setStatusMessage("Withdrawing perspective...");
    try {
      const { data, error } = await supabase.rpc("withdraw_event_perspective", {
        p_event_id: event.id,
      });
      if (error) throw error;
      setPerspectiveInput("");
      setEditingPerspective(false);
      setConfirmWithdraw(false);
      await loadEvent();
      setStatusMessage(
        data === true
          ? "Your perspective was withdrawn."
          : "No perspective was available to withdraw.",
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Could not withdraw perspective.",
      );
    } finally {
      setSavingPerspective(false);
    }
  }

  async function deleteEvent() {
    if (!event) {
      return;
    }

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

  if (!event) {
    return (
      <View style={styles.center}>
        <Text>{statusMessage}</Text>
      </View>
    );
  }

  const isCreator = event.creator_id === currentUserId;
  const myPerspective = perspectives.find((p) => p.author_id === currentUserId);
  const partnerPerspective = perspectives.find(
    (p) => p.author_id !== currentUserId && p.sharing_status === "submitted",
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Moment summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <Text style={styles.eyebrow}>
            {event.event_type === "friction"
              ? "SOMETHING FELT OFF"
              : "A GOOD MOMENT"}
          </Text>

          <View
            style={[
              styles.visibilityBadge,
              event.visibility === "ours"
                ? styles.visibilityBadgeOurs
                : styles.visibilityBadgeMine,
            ]}
          >
            <Text style={styles.visibilityBadgeText}>
              {event.visibility === "ours" ? "Ours · Shared" : "Mine · Private"}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>{formatCategory(event.category)}</Text>

        <Text style={styles.meta}>
          Recorded {formatDate(event.created_at)}
          {" · "}
          {isCreator ? "by you" : "by your partner"}
        </Text>

        {event.event_type === "friction" && event.intensity !== null && (
          <Text style={styles.intensityText}>
            {isCreator
              ? "Your reported intensity"
              : "Recorder's reported intensity"}
            : {event.intensity} / 5
          </Text>
        )}
      </View>

      {/* Shared topic */}
      {event.visibility === "ours" && event.shared_topic && (
        <View style={[styles.contentCard, styles.sharedCard]}>
          <Text style={styles.contentTitle}>Shared topic</Text>

          <Text style={styles.contentBody}>{event.shared_topic}</Text>

          <Text style={styles.contentHint}>
            This topic is intentionally shared with your partner.
          </Text>
        </View>
      )}

      {/* Private reflection */}
      {privateNote && (
        <View style={[styles.contentCard, styles.privateCard]}>
          <Text style={styles.contentTitle}>My private reflection</Text>

          <Text style={styles.contentBody}>{privateNote}</Text>

          <Text style={styles.contentHint}>
            Private — only you can see this reflection.
          </Text>
        </View>
      )}

      {event.event_type === "friction" && currentUserId && (
        <EventRepairSection
          key={`${event.id}:${currentUserId}`}
          eventId={event.id}
          userId={currentUserId}
          visibility={event.visibility}
        />
      )}

      {/* Our Perspectives */}
      {event.visibility === "ours" && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Our perspectives</Text>

          <Text style={styles.helperText}>
            Each perspective belongs to its author. Sharing a perspective does
            not mean agreement or repair.
          </Text>

          {perspectivesLoading ? (
            <Text style={styles.helperText}>Loading perspectives...</Text>
          ) : (
            <>
              {/* Own perspective */}
              <View style={styles.perspectiveCard}>
                <Text style={styles.perspectiveHeading}>Your perspective</Text>

                {myPerspective ? (
                  <>
                    <Text style={styles.perspectiveStatus}>
                      {myPerspective.sharing_status === "submitted"
                        ? "Shared with your partner"
                        : "Not shared — only you can see this"}
                    </Text>

                    <Text style={styles.perspectiveText}>
                      {myPerspective.perspective_text}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.helperText}>
                    You haven't shared your perspective yet.
                  </Text>
                )}

                {!editingPerspective ? (
                  <Pressable
                    style={[
                      styles.secondaryButton,
                      savingPerspective && styles.disabled,
                    ]}
                    disabled={savingPerspective}
                    accessibilityRole="button"
                    onPress={() => {
                      setPerspectiveInput(
                        myPerspective?.sharing_status === "submitted"
                          ? myPerspective.perspective_text
                          : "",
                      );
                      setEditingPerspective(true);
                      setConfirmWithdraw(false);
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {myPerspective?.sharing_status === "submitted"
                        ? "Edit my perspective"
                        : "Write and share my perspective"}
                    </Text>
                  </Pressable>
                ) : (
                  <>
                    <Text style={styles.helperText}>
                      Only the text you submit will be shared.
                    </Text>

                    <TextInput
                      style={styles.sharingInput}
                      value={perspectiveInput}
                      onChangeText={setPerspectiveInput}
                      placeholder="Describe your experience"
                      multiline
                      editable={!savingPerspective}
                    />

                    <Pressable
                      style={[
                        styles.primaryButton,
                        (savingPerspective || !perspectiveInput.trim()) &&
                          styles.disabled,
                      ]}
                      disabled={savingPerspective || !perspectiveInput.trim()}
                      accessibilityRole="button"
                      onPress={submitPerspective}
                    >
                      <Text style={styles.primaryButtonText}>
                        {savingPerspective
                          ? "Sharing..."
                          : "Share my perspective"}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.secondaryButton}
                      disabled={savingPerspective}
                      accessibilityRole="button"
                      onPress={() => {
                        setPerspectiveInput("");
                        setEditingPerspective(false);
                      }}
                    >
                      <Text style={styles.secondaryButtonText}>Cancel</Text>
                    </Pressable>
                  </>
                )}

                {myPerspective && !confirmWithdraw && (
                  <Pressable
                    style={styles.dangerButton}
                    disabled={savingPerspective}
                    accessibilityRole="button"
                    onPress={() => setConfirmWithdraw(true)}
                  >
                    <Text style={styles.dangerButtonText}>
                      Withdraw my perspective
                    </Text>
                  </Pressable>
                )}

                {myPerspective && confirmWithdraw && (
                  <View style={styles.confirmCard}>
                    <Text style={styles.helperText}>
                      Withdrawing permanently deletes your perspective. This
                      cannot be undone.
                    </Text>

                    <Pressable
                      style={styles.dangerButton}
                      disabled={savingPerspective}
                      accessibilityRole="button"
                      onPress={withdrawPerspective}
                    >
                      <Text style={styles.dangerButtonText}>Yes, withdraw</Text>
                    </Pressable>

                    <Pressable
                      style={styles.secondaryButton}
                      disabled={savingPerspective}
                      accessibilityRole="button"
                      onPress={() => setConfirmWithdraw(false)}
                    >
                      <Text style={styles.secondaryButtonText}>
                        Keep my perspective
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Partner perspective */}
              <View
                style={[styles.perspectiveCard, styles.partnerPerspectiveCard]}
              >
                <Text style={styles.perspectiveHeading}>
                  Your partner's perspective
                </Text>

                {partnerPerspective ? (
                  <>
                    <Text style={styles.perspectiveStatus}>
                      Shared by your partner
                    </Text>

                    <Text style={styles.perspectiveText}>
                      {partnerPerspective.perspective_text}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.helperText}>
                    Your partner hasn't shared a perspective.
                  </Text>
                )}
              </View>
            </>
          )}
        </View>
      )}

      {/* Moment visibility — creator only */}
      {isCreator && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Moment visibility</Text>

          <Text style={styles.helperText}>
            This moment is currently{" "}
            {event.visibility === "mine" ? "Mine" : "Ours"}. Your private
            reflection and personal repair update are not automatically shared.
          </Text>

          {!showSharingControls ? (
            <Pressable
              style={styles.secondaryButton}
              accessibilityRole="button"
              onPress={() => {
                setSharedTopicInput("");
                setShowSharingControls(true);
                setStatusMessage("");
              }}
            >
              <Text style={styles.secondaryButtonText}>
                {event.visibility === "mine"
                  ? "Share this moment"
                  : "Change moment visibility"}
              </Text>
            </Pressable>
          ) : (
            <>
              {event.visibility === "mine" ? (
                <>
                  <Text style={styles.helperText}>
                    What would you like to share? Only the topic you enter below
                    will be shared automatically.
                  </Text>

                  <TextInput
                    style={styles.sharingInput}
                    value={sharedTopicInput}
                    onChangeText={setSharedTopicInput}
                    placeholder="Enter a topic to share"
                    multiline
                    editable={!changingVisibility}
                  />

                  <Pressable
                    style={[
                      styles.primaryButton,
                      (changingVisibility || !sharedTopicInput.trim()) &&
                        styles.disabled,
                    ]}
                    disabled={changingVisibility || !sharedTopicInput.trim()}
                    accessibilityRole="button"
                    onPress={() => changeMomentVisibility("ours")}
                  >
                    <Text style={styles.primaryButtonText}>
                      Confirm sharing
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.helperText}>
                    Moving this moment to Mine removes your partner's access.
                    Shared perspectives and repair updates become private.
                    Information previously seen cannot be recalled.
                  </Text>

                  <Pressable
                    style={[
                      styles.dangerButton,
                      changingVisibility && styles.disabled,
                    ]}
                    disabled={changingVisibility}
                    accessibilityRole="button"
                    onPress={() => changeMomentVisibility("mine")}
                  >
                    <Text style={styles.dangerButtonText}>
                      Confirm move to Mine
                    </Text>
                  </Pressable>
                </>
              )}

              <Pressable
                style={styles.secondaryButton}
                disabled={changingVisibility}
                accessibilityRole="button"
                onPress={() => {
                  setSharedTopicInput("");
                  setShowSharingControls(false);
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {/* Delete moment — creator only */}
      {isCreator && (
        <View style={styles.deleteSection}>
          {!confirmDelete ? (
            <Pressable
              style={styles.dangerButton}
              accessibilityRole="button"
              onPress={() => setConfirmDelete(true)}
            >
              <Text style={styles.dangerButtonText}>Delete moment</Text>
            </Pressable>
          ) : (
            <View style={styles.confirmCard}>
              <Text style={styles.sectionTitle}>Delete this moment?</Text>

              <Text style={styles.helperText}>
                This permanently deletes the moment and its associated
                reflections, perspectives and repair updates, including
                contributions from your partner. This cannot be undone.
              </Text>

              <Pressable
                style={styles.dangerButton}
                accessibilityRole="button"
                onPress={deleteEvent}
              >
                <Text style={styles.dangerButtonText}>
                  Yes, delete permanently
                </Text>
              </Pressable>

              <Pressable
                style={styles.secondaryButton}
                accessibilityRole="button"
                onPress={() => setConfirmDelete(false)}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {statusMessage !== "" && (
        <Text style={styles.status}>{statusMessage}</Text>
      )}
    </ScrollView>
  );
}

function formatCategory(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 60,
    backgroundColor: "#FBF7FC",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E8DCE9",
    padding: 20,
  },

  summaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },

  eyebrow: {
    color: "#6E416D",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    flexShrink: 1,
  },

  title: {
    fontSize: 27,
    fontWeight: "700",
    color: "#3D3040",
  },

  meta: {
    color: "#6D6072",
    fontSize: 13,
    marginTop: 8,
  },

  intensityText: {
    color: "#6E416D",
    fontSize: 13,
    marginTop: 14,
  },

  visibilityBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  visibilityBadgeMine: {
    backgroundColor: "#F1EDF7",
  },

  visibilityBadgeOurs: {
    backgroundColor: "#FBEFF7",
  },

  visibilityBadgeText: {
    color: "#6E416D",
    fontSize: 11,
    fontWeight: "700",
  },

  contentCard: {
    padding: 18,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
  },

  privateCard: {
    backgroundColor: "#F3F0F8",
    borderColor: "#E0D8EB",
  },

  sharedCard: {
    backgroundColor: "#FFF7FA",
    borderColor: "#F0DCE9",
  },

  contentTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3D3040",
    marginBottom: 10,
  },

  contentBody: {
    fontSize: 15,
    lineHeight: 23,
    color: "#3D3040",
  },

  contentHint: {
    fontSize: 12,
    color: "#6D6072",
    marginTop: 12,
  },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8DCE9",
    padding: 18,
    marginTop: 22,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#3D3040",
    marginBottom: 8,
  },

  helperText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#6D6072",
    marginTop: 6,
    marginBottom: 12,
  },

  perspectiveCard: {
    backgroundColor: "#F8F5FA",
    borderRadius: 13,
    padding: 15,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#E8DCE9",
  },

  partnerPerspectiveCard: {
    backgroundColor: "#FCF8FB",
  },

  perspectiveHeading: {
    fontSize: 15,
    fontWeight: "700",
    color: "#3D3040",
  },

  perspectiveStatus: {
    fontSize: 12,
    color: "#6E416D",
    marginTop: 6,
    marginBottom: 10,
  },

  perspectiveText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#3D3040",
  },

  sharingInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: "#D8C8DC",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
    textAlignVertical: "top",
    marginTop: 8,
    marginBottom: 10,
    fontSize: 14,
    color: "#3D3040",
  },

  primaryButton: {
    backgroundColor: "#6E416D",
    borderRadius: 11,
    padding: 13,
    alignItems: "center",
    marginTop: 10,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },

  secondaryButton: {
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#6E416D",
    padding: 12,
    marginTop: 10,
    alignItems: "center",
  },

  secondaryButtonText: {
    color: "#6E416D",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },

  dangerButton: {
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#A33C43",
    padding: 12,
    marginTop: 10,
    alignItems: "center",
  },

  dangerButtonText: {
    color: "#A33C43",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },

  disabled: {
    opacity: 0.5,
  },

  deleteSection: {
    marginTop: 34,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#E8DCE9",
  },

  confirmCard: {
    backgroundColor: "#FFF7F7",
    padding: 14,
    marginTop: 12,
    borderRadius: 12,
  },

  status: {
    marginTop: 20,
    fontSize: 13,
    textAlign: "center",
    color: "#6E416D",
  },
});
