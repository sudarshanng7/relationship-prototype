import { supabase } from "@/lib/supabase";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Button,
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

type EventPerspective = {
  id: string;
  author_id: string;
  perspective_text: string;
  sharing_status: "submitted" | "suspended";
};

const repairMethods = [
  {
    value: "talking",
    label: "Talking",
  },
  {
    value: "space",
    label: "Space",
  },
  {
    value: "apology",
    label: "Apology",
  },
  {
    value: "affection",
    label: "Affection",
  },
  {
    value: "humour",
    label: "Humour",
  },
  {
    value: "practical_action",
    label: "Practical action",
  },
  {
    value: "time",
    label: "Time",
  },
  {
    value: "other",
    label: "Other",
  },
];

export default function EventDetailScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const eventId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [event, setEvent] = useState<RelationshipEvent | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [statusMessage, setStatusMessage] = useState("Loading...");

  const [showRepairMethods, setShowRepairMethods] = useState(false);

  const [privateNote, setPrivateNote] = useState<string | null>(null);

  const [showSharingControls, setShowSharingControls] = useState(false);
  const [sharedTopicInput, setSharedTopicInput] = useState("");
  const [changingVisibility, setChangingVisibility] = useState(false);
  const [perspectives, setPerspectives] = useState<EventPerspective[]>([]);
  const [perspectivesLoading, setPerspectivesLoading] = useState(true);
  const [perspectiveInput, setPerspectiveInput] = useState("");
  const [editingPerspective, setEditingPerspective] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
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

  async function updateEventStatus(newStatus: "open" | "partially_repaired") {
    if (!event) {
      return;
    }

    setStatusMessage("Updating...");

    /*
     * If a previously reconnected event is changed back to
     * Open or A little better, its previous repair information
     * is no longer valid.
     */
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

    setStatusMessage("Event updated");
  }

  async function markReconnected(repairMethod: string) {
    if (!event) {
      return;
    }

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
      <Text style={styles.title}>{formatCategory(event.category)}</Text>

      <Text style={styles.meta}>
        {event.event_type === "friction" ? "Friction" : "Positive moment"}
        {" · "}
        {event.visibility === "mine" ? "Mine" : "Ours"}
      </Text>

      <View style={styles.section}>
        <Text style={styles.label}>Recorded</Text>

        <Text>{formatDate(event.created_at)}</Text>
      </View>

      {event.intensity !== null && (
        <View style={styles.section}>
          <Text style={styles.label}>Intensity</Text>

          <Text>{event.intensity} / 5</Text>
        </View>
      )}

      {event.visibility === "ours" && event.shared_topic && (
        <View style={styles.section}>
          <Text style={styles.label}>Shared topic</Text>
          <Text>{event.shared_topic}</Text>
        </View>
      )}

      {privateNote && (
        <View style={styles.section}>
          <Text style={styles.label}>My private reflection</Text>
          <Text>{privateNote}</Text>
          <Text style={styles.helperText}>
            Only you can see this reflection.
          </Text>
        </View>
      )}

      {event.event_type === "friction" && (
        <View style={styles.section}>
          <Text style={styles.label}>
            {isCreator
              ? "Your reported state"
              : "The recorder's reported state"}
          </Text>

          <Text>{formatStatus(event.status)}</Text>
        </View>
      )}

      {event.repair_method && (
        <View style={styles.section}>
          <Text style={styles.label}>
            {isCreator
              ? "What helped you"
              : "What the recorder reported helped"}
          </Text>

          <Text>{formatCategory(event.repair_method)}</Text>
        </View>
      )}

      {event.reconnected_at && (
        <View style={styles.section}>
          <Text style={styles.label}>
            {isCreator
              ? "You marked this reconnected"
              : "The recorder marked this reconnected"}
          </Text>

          <Text>{formatDate(event.reconnected_at)}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.label}>Recorded by</Text>

        <Text>{isCreator ? "You" : "Your partner"}</Text>
      </View>

      {event.event_type === "friction" && isCreator && (
        <View style={styles.repairSection}>
          <Text style={styles.sectionTitle}>How does this feel now?</Text>

          <View style={styles.button}>
            <Button
              title="Still unresolved"
              onPress={() => updateEventStatus("open")}
            />
          </View>

          <View style={styles.button}>
            <Button
              title="A little better"
              onPress={() => updateEventStatus("partially_repaired")}
            />
          </View>

          <View style={styles.button}>
            <Button
              title="I feel reconnected"
              onPress={() => setShowRepairMethods(true)}
            />
          </View>

          {showRepairMethods && (
            <View style={styles.repairMethods}>
              <Text style={styles.sectionTitle}>What helped?</Text>

              <Text style={styles.helperText}>
                Choose the main thing that helped this time.
              </Text>

              {repairMethods.map((method) => (
                <View key={method.value} style={styles.button}>
                  <Button
                    title={method.label}
                    onPress={() => markReconnected(method.value)}
                  />
                </View>
              ))}

              <View style={styles.cancelButton}>
                <Button
                  title="Cancel"
                  onPress={() => setShowRepairMethods(false)}
                />
              </View>
            </View>
          )}
        </View>
      )}

      {isCreator && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sharing</Text>

          <Text style={styles.helperText}>
            This moment is currently{" "}
            {event.visibility === "mine" ? "Mine" : "Ours"}. Your private
            reflection is never shared.
          </Text>

          {!showSharingControls ? (
            <Button
              title={
                event.visibility === "mine"
                  ? "Share with partner"
                  : "Change sharing"
              }
              onPress={() => {
                setSharedTopicInput("");
                setShowSharingControls(true);
                setStatusMessage("");
              }}
            />
          ) : (
            <View>
              {event.visibility === "mine" ? (
                <>
                  <Text style={styles.label}>
                    What would you like to share?
                  </Text>

                  <TextInput
                    style={styles.sharingInput}
                    value={sharedTopicInput}
                    onChangeText={setSharedTopicInput}
                    placeholder="Enter a topic your partner can see"
                    multiline
                    editable={!changingVisibility}
                  />

                  <View style={styles.button}>
                    <Button
                      title="Confirm sharing"
                      disabled={changingVisibility || !sharedTopicInput.trim()}
                      onPress={() => changeMomentVisibility("ours")}
                    />
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.helperText}>
                    Moving this moment to Mine removes your partner's access and
                    clears the shared topic. Information already seen cannot be
                    recalled.
                  </Text>

                  <View style={styles.button}>
                    <Button
                      title="Confirm move to Mine"
                      disabled={changingVisibility}
                      onPress={() => changeMomentVisibility("mine")}
                    />
                  </View>
                </>
              )}

              <Button
                title="Cancel"
                disabled={changingVisibility}
                onPress={() => {
                  setSharedTopicInput("");
                  setShowSharingControls(false);
                }}
              />
            </View>
          )}
        </View>
      )}

      {isCreator && (
        <View style={styles.deleteSection}>
          <Button title="Delete moment" onPress={deleteEvent} />
        </View>
      )}

      {event.visibility === "ours" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Perspectives</Text>
          <Text style={styles.helperText}>
            Each perspective belongs to its author. Sharing does not imply
            agreement or repair.
          </Text>

          {perspectivesLoading ? (
            <Text>Loading perspectives...</Text>
          ) : (
            <>
              <Text style={styles.label}>Your perspective</Text>
              {myPerspective ? (
                <View style={styles.perspectiveCard}>
                  <Text style={styles.helperText}>
                    {myPerspective.sharing_status === "suspended"
                      ? "Not shared — only you can see this text."
                      : "Shared with your partner"}
                  </Text>
                  <Text>{myPerspective.perspective_text}</Text>
                </View>
              ) : (
                <Text style={styles.helperText}>
                  You have not shared a perspective.
                </Text>
              )}

              {!editingPerspective ? (
                <View style={styles.button}>
                  <Button
                    title={
                      myPerspective?.sharing_status === "submitted"
                        ? "Edit my perspective"
                        : "Write my perspective"
                    }
                    onPress={() => {
                      // Deliberate resubmission must not reuse suspended text.
                      setPerspectiveInput(
                        myPerspective?.sharing_status === "submitted"
                          ? myPerspective.perspective_text
                          : "",
                      );
                      setEditingPerspective(true);
                      setConfirmWithdraw(false);
                    }}
                  />
                </View>
              ) : (
                <View>
                  <Text style={styles.helperText}>
                    Only text you explicitly submit will be shared.
                  </Text>
                  <TextInput
                    style={styles.sharingInput}
                    value={perspectiveInput}
                    onChangeText={setPerspectiveInput}
                    placeholder="Describe your experience in your own words"
                    multiline
                    editable={!savingPerspective}
                  />
                  <View style={styles.button}>
                    <Button
                      title="Share my perspective"
                      onPress={submitPerspective}
                      disabled={savingPerspective || !perspectiveInput.trim()}
                    />
                  </View>
                  <Button
                    title="Cancel"
                    disabled={savingPerspective}
                    onPress={() => {
                      setPerspectiveInput("");
                      setEditingPerspective(false);
                    }}
                  />
                </View>
              )}

              {myPerspective && !confirmWithdraw && (
                <View style={styles.button}>
                  <Button
                    title="Withdraw my perspective"
                    color="#a33"
                    disabled={savingPerspective}
                    onPress={() => setConfirmWithdraw(true)}
                  />
                </View>
              )}
              {myPerspective && confirmWithdraw && (
                <View style={styles.perspectiveCard}>
                  <Text style={styles.helperText}>
                    Withdraw permanently deletes your perspective. Continue?
                  </Text>
                  <View style={styles.button}>
                    <Button
                      title="Yes, withdraw"
                      color="#a33"
                      disabled={savingPerspective}
                      onPress={withdrawPerspective}
                    />
                  </View>
                  <Button
                    title="Keep my perspective"
                    disabled={savingPerspective}
                    onPress={() => setConfirmWithdraw(false)}
                  />
                </View>
              )}

              <Text style={[styles.label, styles.partnerLabel]}>
                Your partner's perspective
              </Text>
              {partnerPerspective ? (
                <View style={styles.perspectiveCard}>
                  <Text>{partnerPerspective.perspective_text}</Text>
                </View>
              ) : (
                <Text style={styles.helperText}>
                  No perspective has been shared by your partner.
                </Text>
              )}
            </>
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

function formatStatus(status: RelationshipEvent["status"]) {
  switch (status) {
    case "open":
      return "Open";

    case "partially_repaired":
      return "A little better";

    case "reconnected":
      return "Reconnected";

    default:
      return "—";
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 48,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  title: {
    fontSize: 30,
    fontWeight: "bold",
  },

  meta: {
    marginTop: 6,
    fontSize: 15,
  },

  section: {
    marginTop: 24,
  },

  label: {
    fontWeight: "bold",
    marginBottom: 6,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "bold",
    marginBottom: 10,
  },

  helperText: {
    marginBottom: 14,
  },

  repairSection: {
    marginTop: 32,
  },

  repairMethods: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },

  button: {
    marginBottom: 10,
  },

  cancelButton: {
    marginTop: 8,
  },

  sharingInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 8,
    padding: 12,
    textAlignVertical: "top",
    marginBottom: 12,
  },

  perspectiveCard: {
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#f2f2f2",
    borderRadius: 8,
  },

  partnerLabel: {
    marginTop: 20,
  },

  deleteSection: {
    marginTop: 36,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },

  status: {
    marginTop: 20,
    textAlign: "center",
  },
});
