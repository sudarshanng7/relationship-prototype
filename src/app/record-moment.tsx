import {
  AccountSessionBoundary, useAccountSessionScope,
} from "@/components/AccountSessionBoundary";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { supabase } from "@/lib/supabase";

type EventType = "positive" | "friction";
type Visibility = "mine" | "ours";
type MembershipState = "loading" | "ready" | "unavailable" | "error";

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

type MomentRoute = { type?: string; visibility?: string; lockType?: string };

export default function RecordMomentScreen() {
  const raw = useLocalSearchParams<{
    type?: string | string[];
    visibility?: string | string[];
    lockType?: string | string[];
  }>();
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const params: MomentRoute = {
    type: first(raw.type), visibility: first(raw.visibility), lockType: first(raw.lockType),
  };
  const routeKey = JSON.stringify([params.type, params.visibility, params.lockType]);
  return (
    <AccountSessionBoundary routeKey={routeKey}>
      <RecordMomentForm params={params} />
    </AccountSessionBoundary>
  );
}

function RecordMomentForm({ params }: { params: MomentRoute }) {
  const scope = useAccountSessionScope();
  const router = useRouter();

  const isPrivateReflectionMode = params.visibility === "mine";
  const isSharedMomentMode = params.visibility === "ours";
  const isTypeLocked =
    params.lockType === "true" &&
    (params.type === "positive" || params.type === "friction");

  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [membershipState, setMembershipState] = useState<MembershipState>("loading");

  const initialType: EventType =
    params.type === "positive" ? "positive" : "friction";
  const [eventType, setEventType] = useState<EventType>(initialType);

  const [category, setCategory] = useState("");
  const [intensity, setIntensity] = useState(3);
  const [privateNote, setPrivateNote] = useState("");
  const [sharedTopic, setSharedTopic] = useState("");
  const [saving, setSaving] = useState(false);

  const [visibility, setVisibility] = useState<Visibility>(
    params.visibility === "ours" ? "ours" : "mine",
  );

  const [status, setStatus] = useState("Checking relationship space...");

  const requestId = useRef(0);
  const writeInFlight = useRef(false);

  const loadCouple = useCallback(async () => {
    const id = ++requestId.current;
    const valid = () => scope.isCurrent() && id === requestId.current;
    if (!valid()) return;
    setMembershipState("loading");
    setCoupleId(null);
    setStatus("Checking relationship space...");
    try {
      const auth = await scope.authorize();
      if (!auth || !valid()) return;
      const { data, error } = await supabase.from("couple_members")
        .select("couple_id").eq("user_id", scope.userId).maybeSingle()
        .setHeader("Authorization", `Bearer ${auth.token}`);
      if (!valid()) return;
      if (error) throw new Error(error.message);
      if (!(await scope.authorize()) || !valid()) return;
      setCoupleId(data?.couple_id ?? null);
      setMembershipState(data?.couple_id ? "ready" : "unavailable");
      setStatus(data?.couple_id ? "" : "No relationship space found. Create or join one in Settings.");
    } catch {
      if (valid()) {
        setMembershipState("error");
        setStatus("Could not verify your relationship space. Reopen this form to try again.");
      }
    }
  }, [scope]);

  useFocusEffect(useCallback(() => {
    void loadCouple();
  }, [loadCouple]));

  function changeEventType(type: EventType) {
    setEventType(type);

    // Categories differ between positive and friction moments.
    setCategory("");
  }

  const willShare =
    isSharedMomentMode || (!isPrivateReflectionMode && visibility === "ours");

  async function saveMoment() {
    if (!scope.isCurrent() || writeInFlight.current || saving || membershipState !== "ready") return;

    if (!coupleId) {
      setStatus("No relationship space found.");
      return;
    }

    if (!category) {
      setStatus("Please choose a category.");
      return;
    }

    if (willShare && !sharedTopic.trim()) {
      setStatus("Please write what you would like to share with your partner.");
      return;
    }

    writeInFlight.current = true;
    requestId.current++;
    setSaving(true);
    setStatus("Saving...");

    try {
      const auth = await scope.authorize();
      if (!auth || !scope.isCurrent()) return;
      // Never apply a retained draft to a replacement relationship space.
      const { data: membership, error: membershipError } = await supabase
        .from("couple_members").select("couple_id").eq("user_id", scope.userId)
        .maybeSingle().setHeader("Authorization", `Bearer ${auth.token}`);
      if (!scope.isCurrent()) return;
      if (membershipError) {
        setMembershipState("error");
        throw new Error("Could not verify your relationship space. Reopen this form to try again.");
      }
      if (membership?.couple_id !== coupleId) {
        setCoupleId(null);
        setMembershipState("unavailable");
        setPrivateNote("");
        setSharedTopic("");
        setCategory("");
        throw new Error("Relationship space changed. Reopen this form before saving.");
      }
      const finalVisibility: Visibility = isPrivateReflectionMode
        ? "mine"
        : isSharedMomentMode
          ? "ours"
          : visibility;

      const { data: eventId, error } = await supabase.rpc(
        "create_relationship_moment",
        {
          p_couple_id: coupleId,
          p_event_type: eventType,
          p_category: category,
          p_intensity: eventType === "friction" ? intensity : null,
          p_visibility: finalVisibility,
          p_private_note: privateNote.trim() || null,
          p_shared_topic:
            finalVisibility === "ours" ? sharedTopic.trim() || null : null,
        },
      ).setHeader("Authorization", `Bearer ${auth.token}`);
      if (!scope.isCurrent()) return;
      if (error) throw new Error(error.message);

      if (!eventId) {
        throw new Error("Moment could not be created.");
      }

      if (!(await scope.authorize()) || !scope.isCurrent()) return;
      router.replace({
        pathname: "/event/[id]",
        params: { id: eventId, scope: finalVisibility },
      });
    } catch (error) {
      if (!scope.isCurrent()) return;
      setStatus(
        error instanceof Error ? error.message : "Could not save the moment.",
      );
    } finally {
      if (scope.isCurrent()) {
        writeInFlight.current = false;
        setSaving(false);
      }
    }
  }

  const categories =
    eventType === "positive" ? positiveCategories : frictionCategories;

  const canSave = membershipState === "ready" && Boolean(coupleId) &&
    Boolean(category) && (!willShare || Boolean(sharedTopic.trim())) && !saving;

  const saveButtonLabel = saving
    ? "Saving..."
    : isPrivateReflectionMode
      ? "Save privately"
      : isSharedMomentMode
        ? "Share with your partner"
        : visibility === "mine"
          ? "Save to Mine"
          : "Share with your partner";

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.column}>
          {/* Top navigation row */}
          <View style={styles.topNavRow}>
            <Pressable
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace("/home");
                }
              }}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Text style={styles.backButtonText}>‹ Back</Text>
            </Pressable>
          </View>

          {/* Header */}
          <View style={styles.headerBlock}>
            <Text style={styles.title}>
              {isPrivateReflectionMode
                ? "Write a reflection"
                : isSharedMomentMode
                  ? "Share a moment"
                  : "Record a moment"}
            </Text>
            <Text style={styles.subtitle}>
              A small place to notice what mattered.
            </Text>
          </View>

          {/* Moment type */}
          {!isTypeLocked && (
            <View style={styles.sectionBlock}>
              <View style={styles.typeCardsRow}>
                <Pressable
                  style={[
                    styles.typeCard,
                    eventType === "positive" && styles.typeCardSelected,
                  ]}
                  onPress={() => changeEventType("positive")}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: eventType === "positive" }}
                  accessibilityLabel="Something good: A kind moment, appreciation, or small joy."
                >
                  <View
                    style={[
                      styles.typeIconBubble,
                      eventType === "positive" && styles.typeIconBubbleSelected,
                    ]}
                  >
                    <Text style={styles.typeIcon}>🌷</Text>
                  </View>
                  <Text
                    style={[
                      styles.typeCardTitle,
                      eventType === "positive" && styles.typeCardTitleSelected,
                    ]}
                  >
                    Something good
                  </Text>
                  <Text style={styles.typeCardSubtitle}>
                    A kind moment, appreciation, or small joy.
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.typeCard,
                    eventType === "friction" && styles.typeCardSelected,
                  ]}
                  onPress={() => changeEventType("friction")}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: eventType === "friction" }}
                  accessibilityLabel="Something felt off: Tension, hesitation, or a disconnect."
                >
                  <View
                    style={[
                      styles.typeIconBubble,
                      eventType === "friction" && styles.typeIconBubbleSelected,
                    ]}
                  >
                    <Text style={styles.typeIcon}>🌧️</Text>
                  </View>
                  <Text
                    style={[
                      styles.typeCardTitle,
                      eventType === "friction" && styles.typeCardTitleSelected,
                    ]}
                  >
                    Something felt off
                  </Text>
                  <Text style={styles.typeCardSubtitle}>
                    Tension, hesitation, or a disconnect.
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Category */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>What was it about?</Text>
            <View style={styles.categoriesWrap}>
              {categories.map((item) => {
                const isSelected = category === item.value;
                return (
                  <Pressable
                    key={item.value}
                    style={[
                      styles.categoryChip,
                      isSelected && styles.categoryChipSelected,
                    ]}
                    onPress={() => setCategory(item.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={item.label}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected && styles.categoryChipTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Friction intensity */}
          {eventType === "friction" && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>
                How much did it weigh on you?
              </Text>
              <View style={styles.intensityCard}>
                <View style={styles.intensityRow}>
                  {[1, 2, 3, 4, 5].map((value) => {
                    const isSelected = intensity === value;
                    return (
                      <Pressable
                        key={value}
                        style={[
                          styles.intensityButton,
                          isSelected && styles.intensityButtonSelected,
                        ]}
                        onPress={() => setIntensity(value)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={`Weight level ${value}`}
                      >
                        <Text
                          style={[
                            styles.intensityButtonText,
                            isSelected && styles.intensityButtonTextSelected,
                          ]}
                        >
                          {value}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.intensityLabelsRow}>
                  <Text style={styles.intensityLabelText}>A little</Text>
                  <Text style={styles.intensityLabelText}>Hard to shake</Text>
                </View>
              </View>
            </View>
          )}

          {/* Private reflection */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>
              {isPrivateReflectionMode ? "Your reflection" : "For your eyes"}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {isPrivateReflectionMode
                ? "Put it into words in whatever way helps."
                : "Write what happened or how it felt. This stays private."}
            </Text>
            <TextInput
              style={styles.textInput}
              value={privateNote}
              onChangeText={setPrivateNote}
              placeholder={
                isPrivateReflectionMode
                  ? "What happened? What are you feeling?"
                  : "What happened? How did you feel?"
              }
              placeholderTextColor="#9A8D9D"
              multiline
              editable={!saving}
            />
          </View>

          {/* Sharing decision */}
          {isPrivateReflectionMode ? (
            <View style={styles.privacyMessageBlock}>
              <Text style={styles.privacyMessageText}>
                Only you can see this. It will not be shared with your partner.
              </Text>
            </View>
          ) : isSharedMomentMode ? (
            <View style={styles.sharedContextBlock}>
              <Text style={styles.sharedContextHeading}>
                Sharing with your partner
              </Text>
              <Text style={styles.sharedContextText}>
                This moment will be shared with your partner. Your private
                reflection remains only for you.
              </Text>
            </View>
          ) : (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Where should this live?</Text>
              <View style={styles.visibilityCardsRow}>
                <Pressable
                  style={[
                    styles.visibilityCard,
                    visibility === "mine" && styles.visibilityCardMineSelected,
                  ]}
                  onPress={() => setVisibility("mine")}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: visibility === "mine" }}
                  accessibilityLabel="Mine: Keep this reflection private."
                >
                  <Text
                    style={[
                      styles.visibilityCardTitle,
                      visibility === "mine" &&
                        styles.visibilityCardTitleSelected,
                    ]}
                  >
                    Mine
                  </Text>
                  <Text style={styles.visibilityCardSubtitle}>
                    Keep this reflection private.
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.visibilityCard,
                    visibility === "ours" && styles.visibilityCardOursSelected,
                  ]}
                  onPress={() => setVisibility("ours")}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: visibility === "ours" }}
                  accessibilityLabel="Ours: Share a gentle version with your partner."
                >
                  <Text
                    style={[
                      styles.visibilityCardTitle,
                      visibility === "ours" &&
                        styles.visibilityCardTitleSelected,
                    ]}
                  >
                    Ours
                  </Text>
                  <Text style={styles.visibilityCardSubtitle}>
                    Share a gentle version with your partner.
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Ours shared topic */}
          {(isSharedMomentMode ||
            (!isPrivateReflectionMode && visibility === "ours")) && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>
                What would you like your partner to know?
              </Text>
              <Text style={styles.sectionSubtitle}>
                This part is visible to your partner. Keep private details in
                your reflection above.
              </Text>
              <TextInput
                style={[styles.textInput, styles.sharedTopicInput]}
                value={sharedTopic}
                onChangeText={setSharedTopic}
                placeholder="What would you like your partner to know?"
                placeholderTextColor="#9A8D9D"
                multiline
                editable={!saving}
              />
            </View>
          )}

          {/* Save Action */}
          <View style={styles.saveButtonWrap}>
            <Pressable
              style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
              onPress={saveMoment}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityLabel={saveButtonLabel}
              accessibilityState={{ disabled: !canSave }}
            >
              <Text style={styles.saveButtonText}>{saveButtonLabel}</Text>
            </Pressable>
          </View>

          {/* Status feedback */}
          {status !== "" && (
            <View style={styles.statusCard}>
              <Text style={styles.statusText}>{status}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FBF7FC",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 60,
  },
  column: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    gap: 22,
  },
  topNavRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: -8,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignSelf: "flex-start",
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6E416D",
  },
  headerBlock: {
    gap: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#3D3040",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14.5,
    color: "#6D6072",
    lineHeight: 20,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3D3040",
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 13.5,
    color: "#6D6072",
    lineHeight: 18,
    marginTop: -4,
  },
  typeCardsRow: {
    flexDirection: "row",
    gap: 12,
  },
  typeCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "#E8DCE9",
    minHeight: 110,
    justifyContent: "flex-start",
  },
  typeCardSelected: {
    borderColor: "#6E416D",
    backgroundColor: "#FBEFF7",
  },
  typeIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1EDF7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  typeIconBubbleSelected: {
    backgroundColor: "#F4E0EF",
  },
  typeIcon: {
    fontSize: 16,
  },
  typeCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#3D3040",
    marginBottom: 4,
  },
  typeCardTitleSelected: {
    color: "#6E416D",
  },
  typeCardSubtitle: {
    fontSize: 12.5,
    color: "#6D6072",
    lineHeight: 16,
  },
  categoriesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  categoryChipSelected: {
    backgroundColor: "#F1E8F3",
    borderColor: "#6E416D",
  },
  categoryChipText: {
    fontSize: 13.5,
    fontWeight: "500",
    color: "#3D3040",
  },
  categoryChipTextSelected: {
    fontWeight: "600",
    color: "#6E416D",
  },
  intensityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    gap: 12,
  },
  intensityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  intensityButton: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FBF7FC",
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    alignItems: "center",
    justifyContent: "center",
  },
  intensityButtonSelected: {
    backgroundColor: "#6E416D",
    borderColor: "#6E416D",
  },
  intensityButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#3D3040",
  },
  intensityButtonTextSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  intensityLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  intensityLabelText: {
    fontSize: 12.5,
    color: "#6D6072",
    fontWeight: "500",
  },
  textInput: {
    minHeight: 110,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    padding: 14,
    fontSize: 14.5,
    color: "#3D3040",
    lineHeight: 21,
    textAlignVertical: "top",
  },
  sharedTopicInput: {
    minHeight: 90,
  },
  visibilityCardsRow: {
    flexDirection: "row",
    gap: 12,
  },
  visibilityCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "#E8DCE9",
    minHeight: 96,
    justifyContent: "flex-start",
  },
  visibilityCardMineSelected: {
    borderColor: "#6E416D",
    backgroundColor: "#F1EDF7",
  },
  visibilityCardOursSelected: {
    borderColor: "#6E416D",
    backgroundColor: "#FBEFF7",
  },
  visibilityCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#3D3040",
    marginBottom: 4,
  },
  visibilityCardTitleSelected: {
    color: "#6E416D",
  },
  visibilityCardSubtitle: {
    fontSize: 12.5,
    color: "#6D6072",
    lineHeight: 16,
  },
  saveButtonWrap: {
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: "#6E416D",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    shadowColor: "#39203B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  statusCard: {
    backgroundColor: "#F7EEF7",
    borderWidth: 1,
    borderColor: "#E8DCE9",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  statusText: {
    fontSize: 13.5,
    color: "#6E416D",
    fontWeight: "500",
    textAlign: "center",
  },
  privacyMessageBlock: {
    backgroundColor: "#F7EEF7",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E8DCE9",
  },
  privacyMessageText: {
    fontSize: 13.5,
    color: "#6E416D",
    lineHeight: 18,
    fontWeight: "500",
  },
  sharedContextBlock: {
    backgroundColor: "#F7EEF7",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E8DCE9",
    gap: 4,
  },
  sharedContextHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3D3040",
  },
  sharedContextText: {
    fontSize: 13,
    color: "#6D6072",
    lineHeight: 18,
  },
});
