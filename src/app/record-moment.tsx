import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    Button,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { supabase } from "@/lib/supabase";

type EventType = "positive" | "friction";
type Visibility = "mine" | "ours";

const positiveCategories = [
  { value: "care", label: "Care" },
  { value: "support", label: "Support" },
  { value: "affection", label: "Affection" },
  { value: "quality_time", label: "Quality time" },
  { value: "humour", label: "Humour" },
  { value: "practical_help", label: "Practical help" },
  { value: "surprise", label: "Surprise" },
  { value: "other", label: "Other" },
];

const frictionCategories = [
  { value: "household", label: "Household" },
  { value: "money", label: "Money" },
  { value: "family", label: "Family" },
  { value: "communication", label: "Communication" },
  { value: "work_stress", label: "Work or stress" },
  { value: "time_together", label: "Time together" },
  { value: "phones_screens", label: "Phones or screens" },
  { value: "affection", label: "Affection" },
  { value: "parenting", label: "Parenting" },
  { value: "plans", label: "Plans" },
  { value: "other", label: "Other" },
];

export default function RecordMomentScreen() {
  const router = useRouter();

  const [coupleId, setCoupleId] = useState<string | null>(null);

  const [eventType, setEventType] = useState<EventType>("friction");

  const [category, setCategory] = useState("");
  const [intensity, setIntensity] = useState(3);
  const [note, setNote] = useState("");

  const [visibility, setVisibility] = useState<Visibility>("mine");

  const [status, setStatus] = useState("");

  useEffect(() => {
    loadCouple();
  }, []);

  async function loadCouple() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/");
      return;
    }

    const { data, error } = await supabase
      .from("couple_members")
      .select("couple_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error(error);
      setStatus(error.message);
      return;
    }

    if (!data) {
      setStatus("No relationship space found.");
      return;
    }

    setCoupleId(data.couple_id);
  }

  function changeEventType(type: EventType) {
    setEventType(type);

    // Categories differ between positive and friction moments.
    setCategory("");
  }

  async function saveMoment() {
    if (!coupleId) {
      setStatus("No relationship space found.");
      return;
    }

    if (!category) {
      setStatus("Please choose a category.");
      return;
    }

    setStatus("Saving...");

    const { error } = await supabase.from("relationship_events").insert({
      couple_id: coupleId,
      event_type: eventType,
      category,
      intensity: eventType === "friction" ? intensity : null,
      note: note.trim() || null,
      visibility,
      status: eventType === "friction" ? "open" : null,
    });

    if (error) {
      console.error(error);
      setStatus(error.message);
      return;
    }

    router.back();
  }

  const categories =
    eventType === "positive" ? positiveCategories : frictionCategories;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Record a Moment</Text>

      <Text style={styles.heading}>What kind of moment was this?</Text>

      <View style={styles.row}>
        <Pressable
          style={[
            styles.option,
            eventType === "positive" && styles.selectedOption,
          ]}
          onPress={() => changeEventType("positive")}
        >
          <Text>Something good</Text>
        </Pressable>

        <Pressable
          style={[
            styles.option,
            eventType === "friction" && styles.selectedOption,
          ]}
          onPress={() => changeEventType("friction")}
        >
          <Text>Something felt off</Text>
        </Pressable>
      </View>

      <Text style={styles.heading}>Category</Text>

      <View style={styles.wrap}>
        {categories.map((item) => (
          <Pressable
            key={item.value}
            style={[
              styles.category,
              category === item.value && styles.selectedOption,
            ]}
            onPress={() => setCategory(item.value)}
          >
            <Text>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {eventType === "friction" && (
        <>
          <Text style={styles.heading}>Intensity</Text>

          <View style={styles.row}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                style={[
                  styles.intensity,
                  intensity === value && styles.selectedOption,
                ]}
                onPress={() => setIntensity(value)}
              >
                <Text>{value}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Text style={styles.heading}>Note</Text>

      <TextInput
        style={styles.note}
        value={note}
        onChangeText={setNote}
        placeholder="Optional"
        multiline
      />

      <Text style={styles.heading}>Who can see this?</Text>

      <View style={styles.row}>
        <Pressable
          style={[
            styles.option,
            visibility === "mine" && styles.selectedOption,
          ]}
          onPress={() => setVisibility("mine")}
        >
          <Text>Mine</Text>
        </Pressable>

        <Pressable
          style={[
            styles.option,
            visibility === "ours" && styles.selectedOption,
          ]}
          onPress={() => setVisibility("ours")}
        >
          <Text>Ours</Text>
        </Pressable>
      </View>

      <Text style={styles.privacyText}>
        Mine stays private to you. Ours can be seen by your partner.
      </Text>

      <View style={styles.saveButton}>
        <Button title="Save moment" onPress={saveMoment} />
      </View>

      {status !== "" && <Text style={styles.status}>{status}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 48,
  },

  title: {
    fontSize: 30,
    fontWeight: "bold",
    marginBottom: 24,
  },

  heading: {
    fontSize: 17,
    fontWeight: "bold",
    marginTop: 22,
    marginBottom: 10,
  },

  row: {
    flexDirection: "row",
    gap: 10,
  },

  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  option: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },

  category: {
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },

  intensity: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },

  selectedOption: {
    borderWidth: 2,
    borderColor: "#333",
  },

  note: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 8,
    padding: 12,
    textAlignVertical: "top",
  },

  privacyText: {
    fontSize: 13,
    marginTop: 10,
  },

  saveButton: {
    marginTop: 30,
  },

  status: {
    marginTop: 16,
    textAlign: "center",
  },
});
