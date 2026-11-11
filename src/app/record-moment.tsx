import {
  AccountSessionBoundary, useAccountSessionScope,
} from "@/components/AccountSessionBoundary";
import {
  CouplyChoiceCard, CouplyHeader, CouplyPage, CouplyPrimaryButton,
  CouplyQuietButton, CouplySectionCard,
} from "@/components/CouplyUI";
import { tokens } from "@/components/couply-tokens";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { supabase } from "@/lib/supabase";
import {
  ACKNOWLEDGED_CREATION_NOTICE, UNCERTAIN_CREATION_NOTICE,
  isMomentCreationRejection, isMomentId, type CreationAttempt,
} from "@/lib/moment-creation";

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
  // Non-sensitive gate survives focus/session re-verification remounts. Drafts
  // and tokens stay inside the boundary and are cleared when it invalidates.
  const attemptRef = useRef<CreationAttempt | null>(null);
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
      <RecordMomentForm params={params} routeKey={routeKey} attemptRef={attemptRef} />
    </AccountSessionBoundary>
  );
}

function RecordMomentForm({ params, routeKey, attemptRef }: {
  params: MomentRoute;
  routeKey: string;
  attemptRef: RefObject<CreationAttempt | null>;
}) {
  const scope = useAccountSessionScope();
  const router = useRouter();
  const [creationPhase, setCreationPhase] = useState<CreationAttempt["phase"] | "checking">("checking");
  useLayoutEffect(() => {
    if (!scope.isCurrent()) return;
    if (attemptRef.current?.userId !== scope.userId || attemptRef.current.routeKey !== routeKey) {
      attemptRef.current = { userId: scope.userId, routeKey, phase: "idle" };
    } else if (attemptRef.current.phase === "pending") {
      // The previous focused scope can no longer acknowledge its request.
      attemptRef.current.phase = "uncertain";
    }
    setCreationPhase(attemptRef.current.phase);
  }, [attemptRef, routeKey, scope]);
  const creationNotice = creationPhase === "uncertain" ? UNCERTAIN_CREATION_NOTICE
    : creationPhase === "acknowledged" ? ACKNOWLEDGED_CREATION_NOTICE : "";

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
    if (!scope.isCurrent() || writeInFlight.current || saving ||
        attemptRef.current?.phase !== "idle" || membershipState !== "ready") return;

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

    let dispatched = false;
    let preflightNotice = "Nothing was sent. Could not prepare your moment. Please try again.";
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
        preflightNotice = "Nothing was sent. Could not verify your relationship space. Reopen this form to try again.";
        throw new Error("Membership unavailable");
      }
      if (membership?.couple_id !== coupleId) {
        setCoupleId(null);
        setMembershipState("unavailable");
        setPrivateNote("");
        setSharedTopic("");
        setCategory("");
        preflightNotice = "Nothing was sent. Relationship space changed. Reopen this form before saving.";
        throw new Error("Membership changed");
      }
      const finalVisibility: Visibility = isPrivateReflectionMode
        ? "mine"
        : isSharedMomentMode
          ? "ours"
          : visibility;

      const creationRequest = supabase.rpc(
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
      ).setHeader("Authorization", `Bearer ${auth.token}`).retry(false);
      // The installed PostgREST builder dispatches when awaited, so local
      // construction failures above still establish that nothing was sent.
      dispatched = true;
      attemptRef.current!.phase = "pending";
      const { data: eventId, error } = await creationRequest;
      if (!scope.isCurrent()) return;
      if (error && eventId === null && isMomentCreationRejection(error)) {
        attemptRef.current!.phase = "idle";
        if (!(await scope.authorize()) || !scope.isCurrent()) return;
        setStatus("The server rejected this creation; no moment was created. You can review your draft and try again.");
        return;
      }
      if (error || !isMomentId(eventId)) throw new Error("Uncertain creation");

      attemptRef.current!.phase = "acknowledged";
      setCreationPhase("acknowledged");
      if (!(await scope.authorize(ACKNOWLEDGED_CREATION_NOTICE)) || !scope.isCurrent()) return;
      router.replace({
        pathname: "/event/[id]",
        params: { id: eventId, scope: finalVisibility },
      });
    } catch {
      if (!scope.isCurrent()) return;
      if (dispatched) {
        if (attemptRef.current!.phase !== "acknowledged") {
          attemptRef.current!.phase = "uncertain";
          setCreationPhase("uncertain");
        }
        const notice = attemptRef.current!.phase === "acknowledged"
          ? ACKNOWLEDGED_CREATION_NOTICE : UNCERTAIN_CREATION_NOTICE;
        const auth = await scope.authorize(notice);
        if (!auth || !scope.isCurrent()) return;
        // A response loss must not keep a draft in a replacement relationship
        // space. These checks are reads and can never resend the creation.
        try {
          const { data, error } = await supabase.from("couple_members")
            .select("couple_id").eq("user_id", scope.userId).maybeSingle()
            .setHeader("Authorization", `Bearer ${auth.token}`);
          if (!scope.isCurrent()) return;
          if (error || data?.couple_id !== coupleId) {
            setPrivateNote("");
            setSharedTopic("");
            setCategory("");
            setCoupleId(null);
            setMembershipState("unavailable");
          }
        } catch {
          if (!scope.isCurrent()) return;
          setPrivateNote("");
          setSharedTopic("");
          setCategory("");
          setCoupleId(null);
          setMembershipState("error");
        }
        if (!scope.isCurrent()) return;
        setStatus("");
      } else {
        setStatus(preflightNotice);
      }
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
    Boolean(category) && (!willShare || Boolean(sharedTopic.trim())) && !saving &&
    creationPhase === "idle";

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
    <CouplyPage>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <CouplyHeader
          overline="RELATIONSHIP OS"
          title={isPrivateReflectionMode
            ? "Write a reflection"
            : isSharedMomentMode ? "Share a moment" : "Record a moment"}
          subtitle="A small place to notice what mattered."
          onBack={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/home");
            }
          }}
          backLabel="Back"
        />

        {!isTypeLocked && (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>What kind of moment?</Text>
            <View style={styles.choiceRow}>
              <View style={styles.choiceColumn}>
                <CouplyChoiceCard
                  title="Something good"
                  description="A kind moment, appreciation, or small joy."
                  icon={<Text accessible={false} style={styles.choiceIcon}>🌷</Text>}
                  selected={eventType === "positive"}
                  onPress={() => changeEventType("positive")}
                  accessibilityRole="radio"
                  accessibilityLabel="Something good: A kind moment, appreciation, or small joy."
                />
              </View>
              <View style={styles.choiceColumn}>
                <CouplyChoiceCard
                  title="Something felt off"
                  description="Tension, hesitation, or a disconnect."
                  icon={<Text accessible={false} style={styles.choiceIcon}>🌧️</Text>}
                  selected={eventType === "friction"}
                  onPress={() => changeEventType("friction")}
                  accessibilityRole="radio"
                  accessibilityLabel="Something felt off: Tension, hesitation, or a disconnect."
                />
              </View>
            </View>
          </View>
        )}

        <CouplySectionCard style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>What was it about?</Text>
          <View style={styles.categories}>
            {categories.map((item) => {
              const isSelected = category === item.value;
              return (
                <Pressable
                  key={item.value}
                  style={({ pressed }) => [
                    styles.categoryChip,
                    isSelected && styles.categoryChipSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setCategory(item.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={item.label}
                >
                  <Text style={[styles.categoryText, isSelected && styles.selectedText]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </CouplySectionCard>

        {eventType === "friction" && (
          <CouplySectionCard variant="muted" style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>How much did it weigh on you?</Text>
            <View style={styles.intensityRow}>
              {[1, 2, 3, 4, 5].map((value) => {
                const isSelected = intensity === value;
                return (
                  <Pressable
                    key={value}
                    style={({ pressed }) => [
                      styles.intensityButton,
                      isSelected && styles.intensitySelected,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setIntensity(value)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={`Weight level ${value}`}
                  >
                    <Text style={[styles.intensityText, isSelected && styles.selectedText]}>{value}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.intensityLabels}>
              <Text style={styles.caption}>A little</Text>
              <Text style={styles.caption}>Hard to shake</Text>
            </View>
          </CouplySectionCard>
        )}

        <CouplySectionCard variant="lilac" style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {isPrivateReflectionMode ? "Your reflection" : "For your eyes"}
          </Text>
          <Text style={styles.body}>
            {isPrivateReflectionMode
              ? "Put it into words in whatever way helps."
              : "Write what happened or how it felt. This stays private."}
          </Text>
          <TextInput
            style={styles.textInput}
            value={privateNote}
            onChangeText={setPrivateNote}
            placeholder={isPrivateReflectionMode
              ? "What happened? What are you feeling?"
              : "What happened? How did you feel?"}
            placeholderTextColor={tokens.colors.textMuted}
            multiline
            editable={!saving}
            accessibilityLabel="Private reflection"
            accessibilityHint="Only you can see this, whether the moment is Mine or Ours."
          />
        </CouplySectionCard>

        {isPrivateReflectionMode ? (
          <CouplySectionCard variant="muted">
            <Text style={styles.body}>Only you can see this. It will not be shared with your partner.</Text>
          </CouplySectionCard>
        ) : isSharedMomentMode ? (
          <CouplySectionCard variant="blush" style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Sharing with your partner</Text>
            <Text style={styles.body}>
              This moment will be shared with your partner. Your private
              reflection remains only for you.
            </Text>
          </CouplySectionCard>
        ) : (
          <CouplySectionCard style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Where should this live?</Text>
            <View style={styles.choiceRow}>
              <View style={styles.choiceColumn}>
                <CouplyChoiceCard
                  title="Mine"
                  description="Keep this reflection private."
                  selected={visibility === "mine"}
                  onPress={() => setVisibility("mine")}
                  accessibilityRole="radio"
                  accessibilityLabel="Mine: Keep this reflection private."
                />
              </View>
              <View style={styles.choiceColumn}>
                <CouplyChoiceCard
                  title="Ours"
                  description="Share a gentle version with your partner."
                  selected={visibility === "ours"}
                  onPress={() => setVisibility("ours")}
                  accessibilityRole="radio"
                  accessibilityLabel="Ours: Share a gentle version with your partner."
                />
              </View>
            </View>
          </CouplySectionCard>
        )}

        {(isSharedMomentMode || (!isPrivateReflectionMode && visibility === "ours")) && (
          <CouplySectionCard variant="blush" style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>What would you like your partner to know?</Text>
            <Text style={styles.body}>
              This part is visible to your partner. Keep private details in
              your reflection above.
            </Text>
            <TextInput
              style={styles.textInput}
              value={sharedTopic}
              onChangeText={setSharedTopic}
              placeholder="What would you like your partner to know?"
              placeholderTextColor={tokens.colors.textMuted}
              multiline
              editable={!saving}
              accessibilityLabel="Shared topic"
              accessibilityHint="Only this separate topic is shared as context for an Ours moment."
            />
          </CouplySectionCard>
        )}

        <CouplyPrimaryButton
          testID="record-moment-save"
          label={saveButtonLabel}
          onPress={saveMoment}
          disabled={!canSave}
          loading={saving}
          accessibilityLabel={saveButtonLabel}
        />

        {creationNotice !== "" && (
          <CouplySectionCard variant="muted" style={styles.section} testID="moment-creation-notice">
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.body}>
              {creationNotice}
            </Text>
            <CouplyQuietButton
              label="Check existing moments"
              onPress={() => {
                if (scope.isCurrent()) router.replace("/events");
              }}
            />
          </CouplySectionCard>
        )}
        {status !== "" && (
          <CouplySectionCard variant="muted" testID="moment-form-status">
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.body}>{status}</Text>
          </CouplySectionCard>
        )}
      </ScrollView>
    </CouplyPage>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingTop: tokens.spacing.sm, paddingBottom: 48, gap: tokens.spacing.xl },
  section: { gap: tokens.spacing.md },
  sectionTitle: { fontSize: tokens.typeScale.sectionTitle, fontWeight: "700", color: tokens.colors.text },
  body: { fontSize: tokens.typeScale.bodyLarge, color: tokens.colors.textSecondary, lineHeight: 22 },
  caption: { fontSize: tokens.typeScale.caption, color: tokens.colors.textSecondary },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.md },
  choiceColumn: { flexGrow: 1, flexBasis: 180, minWidth: 0 },
  choiceIcon: { fontSize: 24 },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.sm },
  categoryChip: {
    minHeight: tokens.layout.minTouchTarget,
    minWidth: tokens.layout.minTouchTarget,
    maxWidth: "100%",
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceMuted,
    justifyContent: "center",
  },
  categoryChipSelected: { borderColor: tokens.colors.plum, backgroundColor: tokens.colors.surfaceLilac },
  categoryText: { fontSize: tokens.typeScale.body, color: tokens.colors.textSecondary, textAlign: "center" },
  selectedText: { color: tokens.colors.plum, fontWeight: "700" },
  intensityRow: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.sm },
  intensityButton: {
    minHeight: tokens.layout.minTouchTarget,
    minWidth: tokens.layout.minTouchTarget,
    padding: tokens.spacing.sm,
    borderRadius: tokens.radii.small,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  intensitySelected: { backgroundColor: tokens.colors.surfaceLilac, borderColor: tokens.colors.plum },
  intensityText: { fontSize: tokens.typeScale.bodyLarge, color: tokens.colors.textSecondary },
  intensityLabels: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: tokens.spacing.sm },
  pressed: { opacity: 0.75 },
  textInput: {
    minHeight: 140,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.small,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: tokens.spacing.md,
    fontSize: 16,
    color: tokens.colors.text,
    textAlignVertical: "top",
  },
});
