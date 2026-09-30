import { supabase } from "@/lib/supabase";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Button, ScrollView, StyleSheet, Text, View } from "react-native";

type RelationshipEvent = {
  id: string;
  creator_id: string;
  event_type: "positive" | "friction";
  category: string;
  intensity: number | null;
  visibility: "mine" | "ours";
  status: "open" | "partially_repaired" | "reconnected" | null;
  created_at: string;
};

export default function EventsScreen() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [coupleId, setCoupleId] = useState<string | null>(null);

  const [events, setEvents] = useState<RelationshipEvent[]>([]);
  const [status, setStatus] = useState("Loading...");

  useFocusEffect(
    useCallback(() => {
      loadPage();
    }, []),
  );

  useEffect(() => {
    if (!coupleId) {
      return;
    }

    const channel = supabase
      .channel(`relationship-events-${coupleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "relationship_events",
          filter: `couple_id=eq.${coupleId}`,
        },
        () => {
          loadEvents(coupleId);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [coupleId]);

  async function loadPage() {
    setStatus("Loading...");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setStatus("No signed-in user");
      return;
    }

    setCurrentUserId(user.id);

    const { data: membership, error: membershipError } = await supabase
      .from("couple_members")
      .select("couple_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      console.error(membershipError);
      setStatus(membershipError.message);
      return;
    }

    if (!membership) {
      setStatus("You do not belong to a relationship space.");
      return;
    }

    setCoupleId(membership.couple_id);

    await loadEvents(membership.couple_id);
  }

  async function loadEvents(currentCoupleId: string) {
    const { data, error } = await supabase
      .from("relationship_events")
      .select(
        `
        id,
        creator_id,
        event_type,
        category,
        intensity,
        visibility,
        status,
        created_at
      `,
      )
      .eq("couple_id", currentCoupleId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setStatus(error.message);
      return;
    }

    setEvents(data ?? []);
    setStatus("");
  }

  async function createTestEvent(visibility: "mine" | "ours") {
    if (!coupleId) {
      setStatus("No relationship space found.");
      return;
    }

    setStatus(`Creating ${visibility} test event...`);

    const { error } = await supabase.from("relationship_events").insert({
      couple_id: coupleId,
      event_type: "friction",
      category: "communication",
      intensity: 3,
      visibility,
      status: "open",
    });

    if (error) {
      console.error(error);
      setStatus(error.message);
      return;
    }

    await loadEvents(coupleId);

    setStatus(`${capitalize(visibility)} test event created`);
  }

  function openEvent(eventId: string) {
    router.push({
      pathname: "/event/[id]",
      params: {
        id: eventId,
      },
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Relationship Moments</Text>

      <Text style={styles.description}>
        Record moments and review the events you are allowed to see.
      </Text>

      {/* Real application flow */}
      <View style={styles.primarySection}>
        <Button
          title="Record a Moment"
          onPress={() => router.push("/record-moment")}
        />
      </View>

      {/* Temporary development controls */}
      <View style={styles.testSection}>
        <Text style={styles.testHeading}>Development privacy tests</Text>

        <Text style={styles.testDescription}>
          These buttons are temporary and help us verify Mine/Ours security.
        </Text>

        <View style={styles.button}>
          <Button
            title="Create Mine test event"
            onPress={() => createTestEvent("mine")}
          />
        </View>

        <View style={styles.button}>
          <Button
            title="Create Ours test event"
            onPress={() => createTestEvent("ours")}
          />
        </View>
      </View>

      <Text style={styles.heading}>Moments I can see</Text>

      {events.length === 0 && status === "" && (
        <Text style={styles.emptyText}>No visible moments yet.</Text>
      )}

      {events.map((event) => {
        const isCreator = event.creator_id === currentUserId;

        return (
          <View key={event.id} style={styles.event}>
            <View style={styles.eventHeader}>
              <Text style={styles.eventTitle}>
                {formatCategory(event.category)}
              </Text>

              <Text style={styles.eventType}>
                {event.event_type === "friction" ? "Friction" : "Positive"}
              </Text>
            </View>

            <Text>
              Visibility: {event.visibility === "mine" ? "Mine" : "Ours"}
            </Text>

            {event.intensity !== null && (
              <Text>Intensity: {event.intensity} / 5</Text>
            )}

            {event.event_type === "friction" && (
              <Text>Status: {formatStatus(event.status)}</Text>
            )}

            <Text style={styles.small}>
              Recorded by: {isCreator ? "You" : "Your partner"}
            </Text>

            <Text style={styles.small}>{formatDate(event.created_at)}</Text>

            <View style={styles.viewButton}>
              <Button title="View moment" onPress={() => openEvent(event.id)} />
            </View>
          </View>
        );
      })}

      {status !== "" && <Text style={styles.status}>{status}</Text>}
    </ScrollView>
  );
}

function formatCategory(category: string) {
  return category
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

function formatDate(createdAt: string) {
  return new Date(createdAt).toLocaleString();
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 48,
  },

  title: {
    fontSize: 30,
    fontWeight: "bold",
    marginBottom: 8,
  },

  description: {
    marginBottom: 24,
  },

  primarySection: {
    marginBottom: 28,
  },

  testSection: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 16,
    marginBottom: 28,
  },

  testHeading: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 6,
  },

  testDescription: {
    fontSize: 13,
    marginBottom: 16,
  },

  heading: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 14,
  },

  event: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },

  eventHeader: {
    marginBottom: 10,
  },

  eventTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },

  eventType: {
    fontSize: 13,
    marginTop: 2,
  },

  viewButton: {
    marginTop: 16,
  },

  button: {
    marginBottom: 10,
  },

  small: {
    fontSize: 12,
    marginTop: 6,
  },

  emptyText: {
    marginTop: 8,
  },

  status: {
    marginTop: 20,
    textAlign: "center",
  },
});
