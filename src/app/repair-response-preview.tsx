import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Perspective = "sam" | "alex";

type PartnerResponseChoice = "none" | "heard" | "need_time" | "suggest_repair";

type RepairSuggestion =
  | "A quiet chat"
  | "A warm hug"
  | "A walk outside"
  | "Quiet time side-by-side"
  | "Fresh tea together";

const REPAIR_OPTIONS: RepairSuggestion[] = [
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

export default function RepairResponsePreviewScreen() {
  const router = useRouter();

  const [perspective, setPerspective] = useState<Perspective>("sam");
  const [partnerResponse, setPartnerResponse] =
    useState<PartnerResponseChoice>("none");
  const [chosenRepair, setChosenRepair] = useState<RepairSuggestion | null>(
    null
  );
  const [samSettled, setSamSettled] = useState(false);
  const [alexSettled, setAlexSettled] = useState(false);
  const [samExplicitNotSettled, setSamExplicitNotSettled] = useState(false);
  const [alexExplicitNotSettled, setAlexExplicitNotSettled] = useState(false);
  const [showFutureStepPreview, setShowFutureStepPreview] = useState(false);

  // Private individual reflections
  const [samPrivateTag, setSamPrivateTag] = useState<PrivateHelpTag | null>(null);
  const [samPrivateDismissed, setSamPrivateDismissed] = useState(false);
  const [alexPrivateTag, setAlexPrivateTag] = useState<PrivateHelpTag | null>(null);
  const [alexPrivateDismissed, setAlexPrivateDismissed] = useState(false);

  // Shared takeaway (available only after mutual resolution)
  const [sharedTakeawayTag, setSharedTakeawayTag] =
    useState<SharedTakeawayTag | null>(null);
  const [sharedTakeawayNote, setSharedTakeawayNote] = useState("");
  const [showSharedTakeawayPreview, setShowSharedTakeawayPreview] =
    useState(false);
  const [sharedTakeawayDismissed, setSharedTakeawayDismissed] = useState(false);

  const sampleSharedTopic =
    "Felt disconnected when plans shifted quickly yesterday without checking in.";
  const sampleAlexPrivate =
    "Was feeling overwhelmed from work and reacted defensively instead of saying I was tired.";

  const isMutuallySettled = samSettled && alexSettled;

  function handleResetAll() {
    setPerspective("sam");
    setPartnerResponse("none");
    setChosenRepair(null);
    setSamSettled(false);
    setAlexSettled(false);
    setSamExplicitNotSettled(false);
    setAlexExplicitNotSettled(false);
    setShowFutureStepPreview(false);

    // Reset private reflection state
    setSamPrivateTag(null);
    setSamPrivateDismissed(false);
    setAlexPrivateTag(null);
    setAlexPrivateDismissed(false);

    // Reset shared takeaway state
    setSharedTakeawayTag(null);
    setSharedTakeawayNote("");
    setShowSharedTakeawayPreview(false);
    setSharedTakeawayDismissed(false);
  }

  function handleAcknowledge() {
    setPartnerResponse("heard");
  }

  function handleNeedTime() {
    setPartnerResponse("need_time");
  }

  function handleStartSuggestRepair() {
    setPartnerResponse("suggest_repair");
    if (!chosenRepair) {
      setChosenRepair("A quiet chat");
    }
  }

  function handleSetSettledForCurrent(isSettled: boolean) {
    if (perspective === "sam") {
      setSamSettled(isSettled);
      setSamExplicitNotSettled(!isSettled);
    } else {
      setAlexSettled(isSettled);
      setAlexExplicitNotSettled(!isSettled);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
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

          {/* 1. Header */}
          <View style={styles.headerBlock}>
            <Text style={styles.title}>Shared Repair Response</Text>
            <Text style={styles.subtitle}>
              A calm local preview of how a shared friction moment invites care,
              not a verdict.
            </Text>
          </View>

          {/* Local-only dev preview notice */}
          <View style={styles.devNoticeCard}>
            <View style={styles.devNoticeBadge}>
              <Text style={styles.devNoticeBadgeText}>DEV PREVIEW</Text>
            </View>
            <Text style={styles.devNoticeText}>
              Everything on this screen is a local preview. Nothing is saved,
              sent, or delivered to a real partner or database.
            </Text>
          </View>

          {/* 2. Perspective Selector */}
          <View style={styles.perspectiveContainer}>
            <Pressable
              style={[
                styles.perspectiveCard,
                perspective === "sam" && styles.perspectiveCardSelected,
              ]}
              onPress={() => setPerspective("sam")}
              accessibilityRole="button"
              accessibilityState={{ selected: perspective === "sam" }}
              accessibilityLabel="View as Sam: Partner responding to the moment"
            >
              <View style={styles.perspectiveHeaderRow}>
                <Text style={styles.perspectiveEmoji}>🌿</Text>
                <Text
                  style={[
                    styles.perspectiveTitle,
                    perspective === "sam" && styles.perspectiveTitleSelected,
                  ]}
                >
                  Viewing as Sam
                </Text>
              </View>
              <Text style={styles.perspectiveSubtext}>
                Partner responding
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.perspectiveCard,
                perspective === "alex" && styles.perspectiveCardSelected,
              ]}
              onPress={() => setPerspective("alex")}
              accessibilityRole="button"
              accessibilityState={{ selected: perspective === "alex" }}
              accessibilityLabel="View as Alex: The person who recorded and shared"
            >
              <View style={styles.perspectiveHeaderRow}>
                <Text style={styles.perspectiveEmoji}>✍️</Text>
                <Text
                  style={[
                    styles.perspectiveTitle,
                    perspective === "alex" && styles.perspectiveTitleSelected,
                  ]}
                >
                  Viewing as Alex
                </Text>
              </View>
              <Text style={styles.perspectiveSubtext}>
                Who shared the moment
              </Text>
            </Pressable>
          </View>

          {/* 3. The Shared Moment Card */}
          <View style={styles.momentCard}>
            <View style={styles.momentHeaderRow}>
              <View style={styles.momentTagBadge}>
                <Text style={styles.momentTagBadgeText}>FRICTION · OURS</Text>
              </View>
              <Text style={styles.momentTimeText}>Yesterday evening</Text>
            </View>

            <View style={styles.sharedTopicBox}>
              <Text style={styles.sharedTopicLabel}>SHARED WITH BOTH OF YOU</Text>
              <Text style={styles.sharedTopicText}>{sampleSharedTopic}</Text>
            </View>

            {perspective === "alex" ? (
              <View style={styles.privateBox}>
                <Text style={styles.privateLabel}>FOR YOUR EYES ONLY (ALEX)</Text>
                <Text style={styles.privateText}>{sampleAlexPrivate}</Text>
              </View>
            ) : (
              <View style={styles.privacySafeNotice}>
                <Text style={styles.privacySafeText}>
                  🔒 Private reflections remain hidden. You only see what was
                  tenderly shared.
                </Text>
              </View>
            )}
          </View>

          {/* 4. Perspective Content */}
          {perspective === "sam" ? (
            /* SAM'S VIEW (RECIPIENT / PARTNER) */
            <View style={styles.actionCard}>
              <Text style={styles.sectionHeading}>Sam’s Response</Text>
              <Text style={styles.sectionSubtext}>
                Respond in your own rhythm. There is no deadline, score, or
                requirement to fix anything right away.
              </Text>

              {/* Status display */}
              <View style={styles.statusDisplayBanner}>
                <Text style={styles.statusDisplayTitle}>
                  {partnerResponse === "none" &&
                    "🌱 Awaiting your gentle response"}
                  {partnerResponse === "heard" &&
                    "🤍 You acknowledged this: 'I hear you'"}
                  {partnerResponse === "need_time" &&
                    "⏳ You signaled: 'Need a little time'"}
                  {partnerResponse === "suggest_repair" &&
                    `🌿 Suggested repair: ${chosenRepair || "A quiet chat"}`}
                </Text>
                <Text style={styles.statusDisplayBody}>
                  {partnerResponse === "none" &&
                    "Alex shared this to invite closeness, not a verdict. Choose what feels true for you now."}
                  {partnerResponse === "heard" &&
                    "Alex knows you received this with care and no defense. You can talk when ready."}
                  {partnerResponse === "need_time" &&
                    "Taking quiet space to process emotions gently. No rush or explanation required."}
                  {partnerResponse === "suggest_repair" &&
                    "Offering a kind, low-pressure gesture to help you both reconnect."}
                </Text>
              </View>

              {/* Response Buttons */}
              <View style={styles.buttonsColumn}>
                <Pressable
                  style={[
                    styles.primaryOptionButton,
                    partnerResponse === "heard" && styles.buttonActive,
                  ]}
                  onPress={handleAcknowledge}
                  accessibilityRole="button"
                  accessibilityLabel="I hear you"
                >
                  <Text
                    style={[
                      styles.primaryOptionButtonText,
                      partnerResponse === "heard" &&
                        styles.primaryOptionButtonTextActive,
                    ]}
                  >
                    🤍 I hear you
                  </Text>
                  <Text style={styles.buttonCaption}>
                    Acknowledge without feeling pushed to debate or solve right now
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.secondaryOptionButton,
                    partnerResponse === "need_time" && styles.buttonActive,
                  ]}
                  onPress={handleNeedTime}
                  accessibilityRole="button"
                  accessibilityLabel="I care, but need some time"
                >
                  <Text
                    style={[
                      styles.secondaryOptionButtonText,
                      partnerResponse === "need_time" &&
                        styles.secondaryOptionButtonTextActive,
                    ]}
                  >
                    ⏳ I care, but need some time
                  </Text>
                  <Text style={styles.buttonCaption}>
                    Signal love while asking for gentle breathing room
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.secondaryOptionButton,
                    partnerResponse === "suggest_repair" && styles.buttonActive,
                  ]}
                  onPress={handleStartSuggestRepair}
                  accessibilityRole="button"
                  accessibilityLabel="Propose a small repair"
                >
                  <Text
                    style={[
                      styles.secondaryOptionButtonText,
                      partnerResponse === "suggest_repair" &&
                        styles.secondaryOptionButtonTextActive,
                    ]}
                  >
                    🌿 Propose a small repair
                  </Text>
                  <Text style={styles.buttonCaption}>
                    Suggest a kind, concrete step to restore warmth
                  </Text>
                </Pressable>
              </View>

              {/* Repair options picker (if suggest_repair is selected) */}
              {partnerResponse === "suggest_repair" && (
                <View style={styles.repairPickerBlock}>
                  <Text style={styles.repairPickerTitle}>
                    What kind gesture would help you two soften?
                  </Text>
                  <View style={styles.repairChipsRow}>
                    {REPAIR_OPTIONS.map((opt) => {
                      const isSelected = chosenRepair === opt;
                      return (
                        <Pressable
                          key={opt}
                          style={[
                            styles.chip,
                            isSelected && styles.chipSelected,
                          ]}
                          onPress={() => setChosenRepair(opt)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          accessibilityLabel={opt}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              isSelected && styles.chipTextSelected,
                            ]}
                          >
                            {opt}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Resolution check-in for Sam */}
              <View style={styles.resolutionDivider} />
              <Text style={styles.resolutionHeading}>
                How does it feel for you now?
              </Text>
              <Text style={styles.resolutionSubtext}>
                Both people get to name their own experience. This moment stays
                open unless each person genuinely feels ready.
              </Text>

              {/* Two parallel equal choices for Sam */}
              <View style={styles.settleChoicesRow}>
                <Pressable
                  style={[
                    styles.settleChoiceCard,
                    samSettled && styles.settleChoiceCardActiveSettled,
                  ]}
                  onPress={() => handleSetSettledForCurrent(true)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: samSettled }}
                  accessibilityLabel="Mark that this moment feels settled to me"
                >
                  <Text
                    style={[
                      styles.settleChoiceTitle,
                      samSettled && styles.settleChoiceTitleActiveSettled,
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
                    samExplicitNotSettled && styles.settleChoiceCardActiveNotSettled,
                  ]}
                  onPress={() => handleSetSettledForCurrent(false)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: samExplicitNotSettled }}
                  accessibilityLabel="Mark that this moment does not feel settled to me yet"
                >
                  <Text
                    style={[
                      styles.settleChoiceTitle,
                      samExplicitNotSettled && styles.settleChoiceTitleActiveNotSettled,
                    ]}
                  >
                    🌿 Not settled yet
                  </Text>
                  <Text style={styles.settleChoiceDescription}>
                    Keep this open with care.
                  </Text>
                </Pressable>
              </View>

              {/* Calm inline note when current viewer explicitly selects Not settled yet */}
              {samExplicitNotSettled && (
                <View style={styles.calmInlineNotice}>
                  <Text style={styles.calmInlineNoticeText}>
                    This stays open with care. Nothing needs to be forced or
                    solved right now.
                  </Text>
                </View>
              )}

              {/* Private individual reflection for Sam */}
              {samSettled && !samPrivateDismissed && (
                <View style={styles.privateReflectionCard}>
                  <Text style={styles.privateReflectionHeading}>
                    What helped you feel more connected?
                  </Text>
                  <Text style={styles.privateReflectionSubtext}>
                    A small private reflection, only for you.
                  </Text>

                  <View style={styles.reflectionChipsRow}>
                    {PRIVATE_HELP_OPTIONS.map((tag) => {
                      const isSelected = samPrivateTag === tag;
                      return (
                        <Pressable
                          key={tag}
                          style={[
                            styles.chip,
                            isSelected && styles.chipSelected,
                          ]}
                          onPress={() => setSamPrivateTag(tag)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          accessibilityLabel={tag}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              isSelected && styles.chipTextSelected,
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
                      onPress={() => setSamPrivateDismissed(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Not now"
                    >
                      <Text style={styles.notNowButtonText}>Not now</Text>
                    </Pressable>
                    <Text style={styles.privateReflectionTruthfulNote}>
                      This is only a private preview. Nothing is saved.
                    </Text>
                  </View>
                </View>
              )}

              {/* One-sided settlement messaging: if Alex is settled and Sam is not */}
              {alexSettled && !samSettled && (
                <View style={styles.oneSidedNoticeCard}>
                  <Text style={styles.oneSidedNoticeHeading}>
                    Alex feels settled.
                  </Text>
                  <Text style={styles.oneSidedNoticeText}>
                    You do not have to match that. This moment can stay open
                    until it feels right for you too.
                  </Text>
                  <Text style={styles.oneSidedNoticeFootnote}>
                    You can choose another gentle repair above, or simply leave
                    room for now.
                  </Text>
                </View>
              )}
            </View>
          ) : (
            /* ALEX'S VIEW (ORIGINAL RECORDER) */
            <View style={styles.actionCard}>
              <Text style={styles.sectionHeading}>Alex’s Perspective</Text>
              <Text style={styles.sectionSubtext}>
                How the moment looks to you as Sam takes in what you shared.
              </Text>

              {/* What Alex sees based on Sam's current status */}
              <View style={styles.statusDisplayBanner}>
                <Text style={styles.statusDisplayTitle}>
                  {partnerResponse === "none" &&
                    "Waiting quietly for Sam"}
                  {partnerResponse === "heard" &&
                    "Sam saw this: 'I hear you'"}
                  {partnerResponse === "need_time" &&
                    "Sam needs some quiet time right now"}
                  {partnerResponse === "suggest_repair" &&
                    `Sam suggested a repair: ${chosenRepair || "A quiet chat"}`}
                </Text>
                <Text style={styles.statusDisplayBody}>
                  {partnerResponse === "none" &&
                    "Sam has not responded yet. There is no deadline or reminder timer ticking."}
                  {partnerResponse === "heard" &&
                    "Your shared thoughts were received with openness. Connection is softening."}
                  {partnerResponse === "need_time" &&
                    "Giving each other space protects emotional safety. Trust the pause."}
                  {partnerResponse === "suggest_repair" &&
                    "Sam offered a gentle way forward whenever you both feel ready."}
                </Text>
              </View>

              {/* Resolution check-in for Alex */}
              <View style={styles.resolutionDivider} />
              <Text style={styles.resolutionHeading}>
                How does it feel for you now?
              </Text>
              <Text style={styles.resolutionSubtext}>
                Both people get to name their own experience. This moment stays
                open unless each person genuinely feels ready.
              </Text>

              {/* Two parallel equal choices for Alex */}
              <View style={styles.settleChoicesRow}>
                <Pressable
                  style={[
                    styles.settleChoiceCard,
                    alexSettled && styles.settleChoiceCardActiveSettled,
                  ]}
                  onPress={() => handleSetSettledForCurrent(true)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: alexSettled }}
                  accessibilityLabel="Mark that this moment feels settled to me"
                >
                  <Text
                    style={[
                      styles.settleChoiceTitle,
                      alexSettled && styles.settleChoiceTitleActiveSettled,
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
                    alexExplicitNotSettled && styles.settleChoiceCardActiveNotSettled,
                  ]}
                  onPress={() => handleSetSettledForCurrent(false)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: alexExplicitNotSettled }}
                  accessibilityLabel="Mark that this moment does not feel settled to me yet"
                >
                  <Text
                    style={[
                      styles.settleChoiceTitle,
                      alexExplicitNotSettled && styles.settleChoiceTitleActiveNotSettled,
                    ]}
                  >
                    🌿 Not settled yet
                  </Text>
                  <Text style={styles.settleChoiceDescription}>
                    Keep this open with care.
                  </Text>
                </Pressable>
              </View>

              {/* Calm inline note when current viewer explicitly selects Not settled yet */}
              {alexExplicitNotSettled && (
                <View style={styles.calmInlineNotice}>
                  <Text style={styles.calmInlineNoticeText}>
                    This stays open with care. Nothing needs to be forced or
                    solved right now.
                  </Text>
                </View>
              )}

              {/* Private individual reflection for Alex */}
              {alexSettled && !alexPrivateDismissed && (
                <View style={styles.privateReflectionCard}>
                  <Text style={styles.privateReflectionHeading}>
                    What helped you feel more connected?
                  </Text>
                  <Text style={styles.privateReflectionSubtext}>
                    A small private reflection, only for you.
                  </Text>

                  <View style={styles.reflectionChipsRow}>
                    {PRIVATE_HELP_OPTIONS.map((tag) => {
                      const isSelected = alexPrivateTag === tag;
                      return (
                        <Pressable
                          key={tag}
                          style={[
                            styles.chip,
                            isSelected && styles.chipSelected,
                          ]}
                          onPress={() => setAlexPrivateTag(tag)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          accessibilityLabel={tag}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              isSelected && styles.chipTextSelected,
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
                      onPress={() => setAlexPrivateDismissed(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Not now"
                    >
                      <Text style={styles.notNowButtonText}>Not now</Text>
                    </Pressable>
                    <Text style={styles.privateReflectionTruthfulNote}>
                      This is only a private preview. Nothing is saved.
                    </Text>
                  </View>
                </View>
              )}

              {/* One-sided settlement messaging: if Sam is settled and Alex is not */}
              {samSettled && !alexSettled && (
                <View style={styles.oneSidedNoticeCard}>
                  <Text style={styles.oneSidedNoticeHeading}>
                    Sam feels settled.
                  </Text>
                  <Text style={styles.oneSidedNoticeText}>
                    You do not have to match that. This moment can stay open
                    until it feels right for you too.
                  </Text>
                  <Text style={styles.oneSidedNoticeFootnote}>
                    You can choose another gentle repair above, or simply leave
                    room for now.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* 5. Mutual Resolution State Box */}
          <View style={styles.resolutionStatusCard}>
            <View style={styles.resolutionStatusHeader}>
              <Text style={styles.resolutionStatusIcon}>
                {isMutuallySettled ? "✨" : "🕊️"}
              </Text>
              <Text style={styles.resolutionStatusTitle}>
                {isMutuallySettled
                  ? "Moment settled together"
                  : "Resolution Status"}
              </Text>
            </View>

            <View style={styles.settledTrackerRow}>
              <View style={styles.settledTrackerPill}>
                <Text style={styles.settledTrackerEmoji}>
                  {alexSettled ? "✓" : "○"}
                </Text>
                <Text style={styles.settledTrackerText}>
                  Alex: {alexSettled ? "Settled" : "Not yet settled"}
                </Text>
              </View>
              <View style={styles.settledTrackerPill}>
                <Text style={styles.settledTrackerEmoji}>
                  {samSettled ? "✓" : "○"}
                </Text>
                <Text style={styles.settledTrackerText}>
                  Sam: {samSettled ? "Settled" : "Not yet settled"}
                </Text>
              </View>
            </View>

            <Text style={styles.resolutionExplanation}>
              {isMutuallySettled
                ? "Both of you found your way back to each other. Taking care of small frictions keeps your bond strong."
                : samSettled || alexSettled
                ? "One partner feels settled. The moment gently stays open until both people feel complete."
                : "A moment stays open without pressure until both people feel heard and at peace."}
            </Text>

            {/* Before both are settled: Always-discoverable future-step preview */}
            {!isMutuallySettled && (
              <View style={styles.futurePreviewContainer}>
                <Pressable
                  style={styles.futurePreviewLinkButton}
                  onPress={() =>
                    setShowFutureStepPreview(!showFutureStepPreview)
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Preview the optional next step after both partners feel settled"
                >
                  <Text style={styles.futurePreviewLinkText}>
                    {showFutureStepPreview
                      ? "Hide future-step preview ‹"
                      : "Preview what comes after mutual settlement ›"}
                  </Text>
                </Pressable>

                {showFutureStepPreview && (
                  <View style={styles.futureStepPreviewCard}>
                    <View style={styles.futureStepHeaderRow}>
                      <View style={styles.futureStepBadge}>
                        <Text style={styles.futureStepBadgeText}>
                          AFTER BOTH FEEL SETTLED · PREVIEW
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.futureStepHeading}>
                      A quiet learning note can be optional.
                    </Text>
                    <Text style={styles.futureStepText}>
                      Once both people independently feel settled, you may
                      choose to notice what helped.
                    </Text>
                    <Text style={styles.futureStepFootnote}>
                      This preview does not change the moment or mark anyone as
                      settled.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Actual mutual-resolution: Optional Shared Takeaway for Our Space */}
            {isMutuallySettled && !sharedTakeawayDismissed && (
              <View style={styles.sharedTakeawayCard}>
                <Text style={styles.sharedTakeawayHeading}>
                  What helped you two find your way back?
                </Text>
                <Text style={styles.sharedTakeawaySubtext}>
                  If it feels useful, keep one small reminder for your shared
                  space.
                </Text>

                <View style={styles.reflectionChipsRow}>
                  {SHARED_TAKEAWAY_OPTIONS.map((tag) => {
                    const isSelected = sharedTakeawayTag === tag;
                    return (
                      <Pressable
                        key={tag}
                        style={[
                          styles.chip,
                          isSelected && styles.chipSelected,
                        ]}
                        onPress={() => setSharedTakeawayTag(tag)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={tag}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            isSelected && styles.chipTextSelected,
                          ]}
                        >
                          {tag}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Optional short text input */}
                <View style={styles.takeawayInputBlock}>
                  <Text style={styles.takeawayInputLabel}>
                    A small reminder for next time
                  </Text>
                  <TextInput
                    style={styles.takeawayTextInput}
                    placeholder="e.g., Pausing for a moment helped us hear each other."
                    placeholderTextColor="#A89BAE"
                    value={sharedTakeawayNote}
                    onChangeText={setSharedTakeawayNote}
                    multiline={false}
                    accessibilityLabel="A small reminder for next time"
                  />
                </View>

                {/* Actions: Primary preview and Secondary not now */}
                <View style={styles.takeawayActionsRow}>
                  <Pressable
                    style={[
                      styles.previewOurSpaceButton,
                      !sharedTakeawayTag && styles.previewOurSpaceButtonDisabled,
                    ]}
                    onPress={() => {
                      if (sharedTakeawayTag) {
                        setShowSharedTakeawayPreview(true);
                      }
                    }}
                    disabled={!sharedTakeawayTag}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !sharedTakeawayTag }}
                    accessibilityLabel="Preview this shared takeaway locally"
                  >
                    <Text
                      style={[
                        styles.previewOurSpaceButtonText,
                        !sharedTakeawayTag &&
                          styles.previewOurSpaceButtonTextDisabled,
                      ]}
                    >
                      Preview shared takeaway
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.notNowSharedButton}
                    onPress={() => setSharedTakeawayDismissed(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Not now"
                  >
                    <Text style={styles.notNowSharedButtonText}>Not now</Text>
                  </Pressable>
                </View>

                {/* Mock Shared Takeaway Preview Card */}
                {showSharedTakeawayPreview && sharedTakeawayTag && (
                  <View style={styles.mockTakeawayPreviewBox}>
                    <View style={styles.mockTakeawayHeaderRow}>
                      <View style={styles.mockTakeawayBadge}>
                        <Text style={styles.mockTakeawayBadgeText}>
                          OURS · SHARED TAKEAWAY · PREVIEW
                        </Text>
                      </View>
                    </View>
                    <View style={styles.mockTakeawayPill}>
                      <Text style={styles.mockTakeawayPillText}>
                        🏷️ {sharedTakeawayTag}
                      </Text>
                    </View>
                    <Text style={styles.mockTakeawayBodyText}>
                      {sharedTakeawayNote.trim().length > 0
                        ? `"${sharedTakeawayNote.trim()}"`
                        : "A small reminder of what helped you reconnect."}
                    </Text>
                    <Text style={styles.mockTakeawayTruthfulFootnote}>
                      This is a visual preview only. Nothing has been added to
                      Our Space.
                    </Text>

                    <Pressable
                      style={styles.viewOurSpaceLinkButton}
                      onPress={() => router.push("/events?scope=ours")}
                      accessibilityRole="button"
                      accessibilityLabel="Open the current shared moments space"
                    >
                      <Text style={styles.viewOurSpaceLinkText}>
                        View Our Space ›
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* 6. Dev Controls & Reset */}
          <View style={styles.devControlsCard}>
            <Text style={styles.devControlsTitle}>Simulator Controls</Text>
            <Text style={styles.devControlsDescription}>
              Switch perspectives above or reset state below to test all paths
              of care, breathing room, and resolution.
            </Text>
            <Pressable
              style={styles.resetButton}
              onPress={handleResetAll}
              accessibilityRole="button"
              accessibilityLabel="Start this preview again"
            >
              <Text style={styles.resetButtonText}>Start this preview again</Text>
            </Pressable>
          </View>

          <View style={styles.bottomSpacer} />
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  column: {
    width: "100%",
    maxWidth: 540,
    gap: 14,
  },
  topNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F1EDF7",
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6E416D",
  },
  headerBlock: {
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#3D3040",
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 19,
    color: "#6D6072",
  },
  devNoticeCard: {
    backgroundColor: "#F4EFF6",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E6DCE8",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  devNoticeBadge: {
    backgroundColor: "#6E416D",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  devNoticeBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  devNoticeText: {
    flex: 1,
    fontSize: 11.5,
    color: "#6D6072",
    lineHeight: 16,
  },
  perspectiveContainer: {
    flexDirection: "row",
    gap: 10,
  },
  perspectiveCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: "#E8DCE9",
    gap: 3,
  },
  perspectiveCardSelected: {
    borderColor: "#6E416D",
    backgroundColor: "#FBF4FA",
  },
  perspectiveHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  perspectiveEmoji: {
    fontSize: 16,
  },
  perspectiveTitle: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#6D6072",
  },
  perspectiveTitleSelected: {
    color: "#6E416D",
    fontWeight: "700",
  },
  perspectiveSubtext: {
    fontSize: 11.5,
    color: "#8E7E94",
  },
  momentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8DCE9",
    gap: 12,
  },
  momentHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  momentTagBadge: {
    backgroundColor: "#FDF0EB",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  momentTagBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9E4D38",
    letterSpacing: 0.4,
  },
  momentTimeText: {
    fontSize: 12,
    color: "#8E7E94",
  },
  sharedTopicBox: {
    backgroundColor: "#FBF7FC",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EFE4F0",
    gap: 4,
  },
  sharedTopicLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#6E416D",
    letterSpacing: 0.5,
  },
  sharedTopicText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#3D3040",
  },
  privateBox: {
    backgroundColor: "#F6F1F8",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E7DDE9",
    gap: 4,
  },
  privateLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#4E3F50",
    letterSpacing: 0.5,
  },
  privateText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#4E3F50",
    fontStyle: "italic",
  },
  privacySafeNotice: {
    paddingVertical: 4,
  },
  privacySafeText: {
    fontSize: 11.5,
    color: "#8E7E94",
    lineHeight: 16,
  },
  actionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8DCE9",
    gap: 12,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3D3040",
  },
  sectionSubtext: {
    fontSize: 12.5,
    color: "#6D6072",
    lineHeight: 17,
  },
  statusDisplayBanner: {
    backgroundColor: "#F7F2F9",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EBE0ED",
    gap: 4,
  },
  statusDisplayTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#6E416D",
  },
  statusDisplayBody: {
    fontSize: 12.5,
    color: "#6D6072",
    lineHeight: 17,
  },
  buttonsColumn: {
    gap: 8,
  },
  primaryOptionButton: {
    backgroundColor: "#FAF5FC",
    borderWidth: 1.5,
    borderColor: "#E0D1E3",
    padding: 12,
    borderRadius: 12,
    gap: 2,
  },
  secondaryOptionButton: {
    backgroundColor: "#FAF5FC",
    borderWidth: 1.5,
    borderColor: "#E0D1E3",
    padding: 12,
    borderRadius: 12,
    gap: 2,
  },
  buttonActive: {
    borderColor: "#6E416D",
    backgroundColor: "#F5E9F5",
  },
  primaryOptionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4E3F50",
  },
  primaryOptionButtonTextActive: {
    color: "#6E416D",
    fontWeight: "700",
  },
  secondaryOptionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4E3F50",
  },
  secondaryOptionButtonTextActive: {
    color: "#6E416D",
    fontWeight: "700",
  },
  buttonCaption: {
    fontSize: 11.5,
    color: "#8E7E94",
  },
  repairPickerBlock: {
    backgroundColor: "#FBF7FC",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EFE4F0",
    gap: 8,
  },
  repairPickerTitle: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#6E416D",
  },
  repairChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DCD0DF",
  },
  chipSelected: {
    backgroundColor: "#6E416D",
    borderColor: "#6E416D",
  },
  chipText: {
    fontSize: 12,
    color: "#4E3F50",
    fontWeight: "500",
  },
  chipTextSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  resolutionDivider: {
    height: 1,
    backgroundColor: "#EFE4F0",
    marginVertical: 4,
  },
  resolutionHeading: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#3D3040",
  },
  resolutionSubtext: {
    fontSize: 12,
    color: "#6D6072",
    lineHeight: 16,
  },
  settleChoicesRow: {
    gap: 8,
  },
  settleChoiceCard: {
    backgroundColor: "#FAF5FC",
    borderWidth: 1.5,
    borderColor: "#E0D1E3",
    padding: 12,
    borderRadius: 12,
    gap: 2,
  },
  settleChoiceCardActiveSettled: {
    backgroundColor: "#F0FDF4",
    borderColor: "#059669",
  },
  settleChoiceCardActiveNotSettled: {
    backgroundColor: "#F4EFF6",
    borderColor: "#6E416D",
  },
  settleChoiceTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4E3F50",
  },
  settleChoiceTitleActiveSettled: {
    color: "#059669",
    fontWeight: "700",
  },
  settleChoiceTitleActiveNotSettled: {
    color: "#6E416D",
    fontWeight: "700",
  },
  settleChoiceDescription: {
    fontSize: 11.5,
    color: "#6D6072",
  },
  calmInlineNotice: {
    backgroundColor: "#F8F4FA",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#EADEEB",
  },
  calmInlineNoticeText: {
    fontSize: 12,
    color: "#6D6072",
    lineHeight: 16.5,
    fontStyle: "italic",
  },
  oneSidedNoticeCard: {
    backgroundColor: "#FBF7FC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.2,
    borderColor: "#E5DAE6",
    gap: 4,
  },
  oneSidedNoticeHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6E416D",
  },
  oneSidedNoticeText: {
    fontSize: 12.5,
    color: "#3D3040",
    lineHeight: 17,
  },
  oneSidedNoticeFootnote: {
    fontSize: 11.5,
    color: "#8E7E94",
    lineHeight: 16,
    marginTop: 2,
  },
  futurePreviewContainer: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#EFE4F0",
    paddingTop: 8,
    gap: 8,
  },
  futurePreviewLinkButton: {
    paddingVertical: 6,
  },
  futurePreviewLinkText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#6E416D",
  },
  futureStepPreviewCard: {
    backgroundColor: "#FBF7FC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E8DCE9",
    gap: 4,
  },
  futureStepHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  futureStepBadge: {
    backgroundColor: "#F1EDF7",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  futureStepBadgeText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#6E416D",
    letterSpacing: 0.5,
  },
  futureStepHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3D3040",
    marginTop: 2,
  },
  futureStepText: {
    fontSize: 12,
    color: "#6D6072",
    lineHeight: 16.5,
  },
  futureStepFootnote: {
    fontSize: 11,
    color: "#8E7E94",
    fontStyle: "italic",
    marginTop: 2,
  },
  resolutionStatusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8DCE9",
    gap: 10,
  },
  resolutionStatusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resolutionStatusIcon: {
    fontSize: 18,
  },
  resolutionStatusTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#3D3040",
  },
  settledTrackerRow: {
    flexDirection: "row",
    gap: 8,
  },
  settledTrackerPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FBF7FC",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#EFE4F0",
  },
  settledTrackerEmoji: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6E416D",
  },
  settledTrackerText: {
    fontSize: 12,
    color: "#4E3F50",
    fontWeight: "500",
  },
  resolutionExplanation: {
    fontSize: 12.5,
    color: "#6D6072",
    lineHeight: 17,
  },
  // Private reflection styles
  privateReflectionCard: {
    backgroundColor: "#FBF7FC",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.2,
    borderColor: "#EBD8EA",
    gap: 8,
    marginTop: 4,
  },
  privateReflectionHeading: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#6E416D",
  },
  privateReflectionSubtext: {
    fontSize: 12,
    color: "#6D6072",
    lineHeight: 16,
  },
  reflectionChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  privateReflectionFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3E3F0",
  },
  notNowButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#F4EFF6",
  },
  notNowButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6E416D",
  },
  privateReflectionTruthfulNote: {
    fontSize: 11,
    color: "#8E7E94",
    fontStyle: "italic",
    flex: 1,
    textAlign: "right",
    marginLeft: 10,
  },

  // Shared takeaway styles
  sharedTakeawayCard: {
    backgroundColor: "#FDF8FC",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.2,
    borderColor: "#EBD8EA",
    gap: 10,
    marginTop: 8,
  },
  sharedTakeawayHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6E416D",
  },
  sharedTakeawaySubtext: {
    fontSize: 12,
    color: "#6D6072",
    lineHeight: 16.5,
  },
  takeawayInputBlock: {
    gap: 5,
    marginTop: 2,
  },
  takeawayInputLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#4E3F50",
  },
  takeawayTextInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DCD0DF",
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: "#3D3040",
  },
  takeawayActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
  },
  previewOurSpaceButton: {
    backgroundColor: "#6E416D",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  previewOurSpaceButtonDisabled: {
    backgroundColor: "#E2D7E4",
  },
  previewOurSpaceButtonText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  previewOurSpaceButtonTextDisabled: {
    color: "#9C8C9F",
  },
  notNowSharedButton: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#F8F3F9",
    borderWidth: 1,
    borderColor: "#E5DAE6",
  },
  notNowSharedButtonText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#6E416D",
  },
  mockTakeawayPreviewBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.2,
    borderColor: "#E0D0DF",
    gap: 6,
    marginTop: 6,
  },
  mockTakeawayHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  mockTakeawayBadge: {
    backgroundColor: "#F4E8F3",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  mockTakeawayBadgeText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#6E416D",
    letterSpacing: 0.5,
  },
  mockTakeawayPill: {
    alignSelf: "flex-start",
    backgroundColor: "#FBF7FC",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#EFE4F0",
  },
  mockTakeawayPillText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#4E3F50",
  },
  mockTakeawayBodyText: {
    fontSize: 13,
    color: "#3D3040",
    lineHeight: 18,
    fontStyle: "italic",
  },
  mockTakeawayTruthfulFootnote: {
    fontSize: 11,
    color: "#8E7E94",
    fontStyle: "italic",
    marginTop: 2,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#F4EAF3",
  },
  viewOurSpaceLinkButton: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginTop: 2,
  },
  viewOurSpaceLinkText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#6E416D",
  },
  devControlsCard: {
    backgroundColor: "#F8F3F9",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EADEEB",
    gap: 6,
  },
  devControlsTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6E416D",
  },
  devControlsDescription: {
    fontSize: 12,
    color: "#6D6072",
    lineHeight: 16,
  },
  resetButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#DACCDC",
    alignItems: "center",
    marginTop: 4,
  },
  resetButtonText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#6E416D",
  },
  bottomSpacer: {
    height: 16,
  },
});
