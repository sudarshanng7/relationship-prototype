import { supabase } from "@/lib/supabase";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Button, ScrollView, StyleSheet, Text, View } from "react-native";

type RelationshipEvent = {
  id: string;
  creator_id: string;
  event_type: "positive" | "friction";
  category: string;
  intensity: number | null;
  note: string | null;
  visibility: "mine" | "ours";
  status: "open" | "partially_repaired" | "reconnected" | null;
  repair_method: string | null;
  reconnected_at: string | null;
  created_at: string;
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
        note,
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

    setEvent(data);
    setStatusMessage("");
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

      {event.note && (
        <View style={styles.section}>
          <Text style={styles.label}>Note</Text>

          <Text>{event.note}</Text>
        </View>
      )}

      {event.event_type === "friction" && (
        <View style={styles.section}>
          <Text style={styles.label}>Current state</Text>

          <Text>{formatStatus(event.status)}</Text>
        </View>
      )}

      {event.repair_method && (
        <View style={styles.section}>
          <Text style={styles.label}>What helped</Text>

          <Text>{formatCategory(event.repair_method)}</Text>
        </View>
      )}

      {event.reconnected_at && (
        <View style={styles.section}>
          <Text style={styles.label}>Marked reconnected</Text>

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
        <View style={styles.deleteSection}>
          <Button title="Delete moment" onPress={deleteEvent} />
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
