import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type ParticipantKey = "me" | "sam" | "both";

interface ParticipantOption {
  key: ParticipantKey;
  label: string;
  icon: string;
  description: string;
}

const PARTICIPANT_OPTIONS: ParticipantOption[] = [
  {
    key: "sam",
    label: "Invite Sam",
    icon: "💌",
    description: "A gentle, optional invitation for Sam",
  },
  {
    key: "both",
    label: "Both of us",
    icon: "🤝",
    description: "Something to choose together",
  },
  {
    key: "me",
    label: "For me",
    icon: "🙋",
    description: "A personal reset for your own peace of mind",
  },
];

const SUGGESTED_IDEAS = [
  {
    title: "Brew a cup of tea together",
    icon: "🫖",
    hint: "A warm 5-minute pause",
  },
  {
    title: "Five quiet minutes with no screens",
    icon: "🛋️",
    hint: "Just a gentle pause to exhale",
  },
  {
    title: "Step outside for fresh air",
    icon: "🌱",
    hint: "A quick breath of air together",
  },
  {
    title: "Put on one relaxing song",
    icon: "🎵",
    hint: "A tiny mood reset",
  },
];

const TIMEFRAME_OPTIONS = [
  "Today",
  "Tomorrow",
  "This weekend",
  "No rush / Whenever",
];

const REWARD_OPTIONS = [
  { label: "No reward — just the moment", icon: "🌱" },
  { label: "Coffee together", icon: "☕" },
  { label: "Pick tonight’s film", icon: "🎬" },
  { label: "A relaxed five minutes", icon: "🛋️" },
];

export default function MakeChallengePreviewScreen() {
  const router = useRouter();

  const [challengeText, setChallengeText] = useState("");
  const [participantChoice, setParticipantChoice] =
    useState<ParticipantKey>("sam");
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>("Today");
  const [selectedReward, setSelectedReward] = useState<string>(
    "No reward — just the moment",
  );

  const trimmedText = challengeText.trim();
  const effectiveTitle = trimmedText || "Bring the mug home";
  const isCustomProvided = trimmedText.length > 0;

  function handleReset() {
    setChallengeText("");
    setParticipantChoice("sam");
    setSelectedTimeframe("Today");
    setSelectedReward("No reward — just the moment");
  }

  function handleSelectSuggestion(title: string) {
    setChallengeText(title);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
              <Text style={styles.title}>Make a tiny challenge</Text>
              <Text style={styles.subtitle}>
                Compose a small, kind invitation that is easy to accept or
                quietly let pass.
              </Text>
            </View>

            {/* 2. Development notice */}
            <View style={styles.devNoticeCard}>
              <View style={styles.devNoticeBadge}>
                <Text style={styles.devNoticeBadgeText}>Dev Preview</Text>
              </View>
              <Text style={styles.devNoticeText}>
                Development preview — everything here is local and temporary.
                Nothing has been sent or saved.
              </Text>
            </View>

            {/* Step 1: Challenge Idea */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>1. What is the tiny idea?</Text>
              <Text style={styles.sectionSubtitle}>
                Keep it small, kind, and easy to decline. Low friction, high
                warmth.
              </Text>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  value={challengeText}
                  onChangeText={setChallengeText}
                  placeholder="e.g. Brew a fresh cup of tea, or take a 5-minute quiet walk..."
                  placeholderTextColor="#A89BB0"
                  multiline
                  maxLength={120}
                  accessibilityLabel="Challenge idea text"
                />
                <View style={styles.inputFooter}>
                  <Text style={styles.inputCounterText}>
                    {challengeText.length}/120
                  </Text>
                </View>
              </View>

              {/* Suggestions row */}
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsHeading}>
                  Or pick a safe starting point:
                </Text>
                <View style={styles.suggestionsWrap}>
                  {SUGGESTED_IDEAS.map((item) => {
                    const isSelected = challengeText === item.title;
                    return (
                      <Pressable
                        key={item.title}
                        style={[
                          styles.suggestionChip,
                          isSelected && styles.suggestionChipSelected,
                        ]}
                        onPress={() => handleSelectSuggestion(item.title)}
                        accessibilityRole="button"
                        accessibilityLabel={`Suggestion: ${item.title}`}
                      >
                        <Text style={styles.suggestionIcon}>{item.icon}</Text>
                        <Text
                          style={[
                            styles.suggestionText,
                            isSelected && styles.suggestionTextSelected,
                          ]}
                        >
                          {item.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Step 2: Participation Choice */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>2. Who is this for?</Text>
              <Text style={styles.sectionSubtitle}>
                An invitation is always optional. It is never a task for someone
                else to complete.
              </Text>

              <View style={styles.participantsColumn}>
                {PARTICIPANT_OPTIONS.map((item) => {
                  const isSelected = participantChoice === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      style={[
                        styles.participantCard,
                        isSelected && styles.participantCardSelected,
                      ]}
                      onPress={() => setParticipantChoice(item.key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`${item.label}: ${item.description}`}
                    >
                      <View
                        style={[
                          styles.participantIconBubble,
                          isSelected && styles.participantIconBubbleSelected,
                        ]}
                      >
                        <Text style={styles.participantEmoji}>{item.icon}</Text>
                      </View>
                      <View style={styles.participantTextCol}>
                        <Text
                          style={[
                            styles.participantLabel,
                            isSelected && styles.participantLabelSelected,
                          ]}
                        >
                          {item.label}
                        </Text>
                        <Text style={styles.participantDescription}>
                          {item.description}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.radioButton,
                          isSelected && styles.radioButtonSelected,
                        ]}
                      >
                        {isSelected && <View style={styles.radioButtonDot} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Step 3: Timing & Context */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>3. When would this feel nice?</Text>
              <Text style={styles.sectionSubtitle}>
                No urgency or deadlines. Invitations can simply expire quietly.
              </Text>

              <View style={styles.chipsRow}>
                {TIMEFRAME_OPTIONS.map((timeframe) => {
                  const isSelected = selectedTimeframe === timeframe;
                  return (
                    <Pressable
                      key={timeframe}
                      style={[
                        styles.timeframeChip,
                        isSelected && styles.timeframeChipSelected,
                      ]}
                      onPress={() => setSelectedTimeframe(timeframe)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={timeframe}
                    >
                      <Text
                        style={[
                          styles.timeframeChipText,
                          isSelected && styles.timeframeChipTextSelected,
                        ]}
                      >
                        {timeframe}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 12 }]}>
                Add a small shared reward?
              </Text>
              <Text style={styles.sectionSubtitle}>
                Optional — the moment matters more than completing a task.
              </Text>

              <View style={styles.chipsRow}>
                {REWARD_OPTIONS.map((reward) => {
                  const isSelected = selectedReward === reward.label;
                  return (
                    <Pressable
                      key={reward.label}
                      style={[
                        styles.rewardChip,
                        isSelected && styles.rewardChipSelected,
                      ]}
                      onPress={() => setSelectedReward(reward.label)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={reward.label}
                    >
                      <Text style={styles.rewardChipIcon}>{reward.icon}</Text>
                      <Text
                        style={[
                          styles.rewardChipText,
                          isSelected && styles.rewardChipTextSelected,
                        ]}
                      >
                        {reward.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Step 4: Calm Live Preview Card */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>4. Preview your invitation</Text>
              <Text style={styles.sectionSubtitle}>
                Here is how this tiny invitation will feel. Notice how light and
                calm it stays.
              </Text>

              <View style={styles.previewCard}>
                <View style={styles.previewHeaderRow}>
                  <View style={styles.previewIconBubble}>
                    <Text style={styles.previewIconEmoji}>
                      {participantChoice === "me"
                        ? "🌱"
                        : participantChoice === "sam"
                        ? "💌"
                        : "🤝"}
                    </Text>
                  </View>
                  <View style={styles.previewHeaderTextGroup}>
                    <Text style={styles.previewOverline}>
                      {participantChoice === "me"
                        ? "A personal reset"
                        : participantChoice === "sam"
                        ? "A tiny invitation for Sam"
                        : "A shared invitation"}
                    </Text>
                    <Text style={styles.previewChallengeTitle}>
                      {effectiveTitle}
                    </Text>
                  </View>
                </View>

                {!isCustomProvided && (
                  <View style={styles.sampleHintBox}>
                    <Text style={styles.sampleHintText}>
                      Sample placeholder text shown above. Type your own idea in
                      step 1 anytime.
                    </Text>
                  </View>
                )}

                <View style={styles.previewDivider} />

                {/* Summary Details */}
                <View style={styles.summaryBox}>
                  <View style={styles.summaryItemRow}>
                    <Text style={styles.summaryItemLabel}>Participant</Text>
                    <Text style={styles.summaryItemValue}>
                      {participantChoice === "me"
                        ? "Just me"
                        : participantChoice === "sam"
                        ? "Sam"
                        : "Both of us"}
                    </Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItemRow}>
                    <Text style={styles.summaryItemLabel}>Timing</Text>
                    <Text style={styles.summaryItemValue}>
                      {selectedTimeframe}
                    </Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItemRow}>
                    <Text style={styles.summaryItemLabel}>Reward</Text>
                    <Text style={styles.summaryItemValue}>
                      {selectedReward}
                    </Text>
                  </View>
                </View>

                {/* Gentle Reassurance */}
                <View style={styles.reassuranceNoteBox}>
                  <Text style={styles.reassuranceNoteText}>
                    {participantChoice === "sam"
                      ? "Sam can choose to join, suggest a tweak, or quietly let it pass. No countdowns, streaks, or notifications are created."
                      : participantChoice === "both"
                      ? "Both of you choose this together. Shared moments feel lightest when both feel free to decline easily."
                      : "A quiet personal commitment, just for your own peace of mind."}
                  </Text>
                </View>

                {/* Disabled Preview Action */}
                <View
                  style={styles.disabledPreviewButton}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: true }}
                  accessibilityLabel="Invitation preview: sending comes later"
                >
                  <Text style={styles.disabledPreviewButtonText}>
                    Invitation preview — sending comes later
                  </Text>
                </View>
              </View>
            </View>

            {/* Quick cross-link to sample lifecycle outcomes */}
            <View style={styles.lifecycleCard}>
              <View style={styles.lifecycleTextGroup}>
                <Text style={styles.lifecycleHeading}>
                  Curious what happens next?
                </Text>
                <Text style={styles.lifecycleSubtext}>
                  Explore the lifecycle preview to see how waiting, accepted,
                  declined, and expired states feel.
                </Text>
              </View>
              <Pressable
                style={styles.lifecycleButton}
                onPress={() => router.push("/challenge-lifecycle-preview")}
                accessibilityRole="button"
                accessibilityLabel="Explore sample lifecycle outcomes"
              >
                <Text style={styles.lifecycleButtonText}>
                  Explore lifecycle outcomes ›
                </Text>
              </Pressable>
            </View>

            {/* Bottom Actions */}
            <View style={styles.bottomActions}>
              <Pressable
                style={styles.resetButton}
                onPress={handleReset}
                accessibilityRole="button"
                accessibilityLabel="Reset form"
              >
                <Text style={styles.resetButtonText}>Reset form</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FBF7FC",
  },
  keyboardAvoid: {
    flex: 1,
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
    gap: 20,
  },
  topNavRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: -6,
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
  devNoticeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  devNoticeBadge: {
    backgroundColor: "#F1EDF7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  devNoticeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6E416D",
    textTransform: "uppercase",
  },
  devNoticeText: {
    flex: 1,
    fontSize: 12.5,
    color: "#6D6072",
    lineHeight: 17,
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
  inputContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    padding: 14,
    gap: 8,
  },
  textInput: {
    fontSize: 15,
    color: "#3D3040",
    minHeight: 70,
    textAlignVertical: "top",
    lineHeight: 22,
  },
  inputFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  inputCounterText: {
    fontSize: 11.5,
    color: "#8E7E94",
  },
  suggestionsContainer: {
    gap: 8,
    marginTop: 4,
  },
  suggestionsHeading: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#8E7E94",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  suggestionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  suggestionChipSelected: {
    backgroundColor: "#FBEFF7",
    borderColor: "#6E416D",
  },
  suggestionIcon: {
    fontSize: 13,
  },
  suggestionText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#6D6072",
  },
  suggestionTextSelected: {
    color: "#6E416D",
    fontWeight: "700",
  },
  participantsColumn: {
    gap: 8,
  },
  participantCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  participantCardSelected: {
    backgroundColor: "#FBEFF7",
    borderColor: "#6E416D",
  },
  participantIconBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1EDF7",
    alignItems: "center",
    justifyContent: "center",
  },
  participantIconBubbleSelected: {
    backgroundColor: "#F4E5F2",
  },
  participantEmoji: {
    fontSize: 18,
  },
  participantTextCol: {
    flex: 1,
    gap: 2,
  },
  participantLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#3D3040",
  },
  participantLabelSelected: {
    color: "#6E416D",
  },
  participantDescription: {
    fontSize: 12.5,
    color: "#6D6072",
    lineHeight: 16,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#C5B6C8",
    alignItems: "center",
    justifyContent: "center",
  },
  radioButtonSelected: {
    borderColor: "#6E416D",
  },
  radioButtonDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#6E416D",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timeframeChip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
  },
  timeframeChipSelected: {
    backgroundColor: "#FBEFF7",
    borderColor: "#6E416D",
  },
  timeframeChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6D6072",
  },
  timeframeChipTextSelected: {
    color: "#6E416D",
    fontWeight: "700",
  },
  rewardChip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rewardChipSelected: {
    backgroundColor: "#FBEFF7",
    borderColor: "#6E416D",
  },
  rewardChipIcon: {
    fontSize: 13,
  },
  rewardChipText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#6D6072",
  },
  rewardChipTextSelected: {
    color: "#6E416D",
    fontWeight: "700",
  },
  previewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    gap: 12,
  },
  previewHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  previewIconBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F8F3F9",
    alignItems: "center",
    justifyContent: "center",
  },
  previewIconEmoji: {
    fontSize: 18,
  },
  previewHeaderTextGroup: {
    flex: 1,
    gap: 2,
  },
  previewOverline: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E7E94",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  previewChallengeTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3D3040",
  },
  sampleHintBox: {
    backgroundColor: "#FAF5FB",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sampleHintText: {
    fontSize: 12,
    color: "#8E7E94",
    fontStyle: "italic",
  },
  previewDivider: {
    height: 1,
    backgroundColor: "#F4EDF6",
  },
  summaryBox: {
    backgroundColor: "#FBF7FC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F0E4F1",
    gap: 8,
  },
  summaryItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryItemLabel: {
    fontSize: 12.5,
    color: "#8E7E94",
    fontWeight: "500",
  },
  summaryItemValue: {
    fontSize: 13,
    color: "#3D3040",
    fontWeight: "600",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#F4EDF6",
  },
  reassuranceNoteBox: {
    backgroundColor: "#FAF5FB",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#F0E4F1",
  },
  reassuranceNoteText: {
    fontSize: 12.5,
    color: "#6D6072",
    lineHeight: 17,
    fontStyle: "italic",
  },
  disabledPreviewButton: {
    backgroundColor: "#F3ECF5",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E8DCE9",
    marginTop: 2,
  },
  disabledPreviewButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E7E94",
  },
  lifecycleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    gap: 10,
  },
  lifecycleTextGroup: {
    gap: 3,
  },
  lifecycleHeading: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#3D3040",
  },
  lifecycleSubtext: {
    fontSize: 12.5,
    color: "#6D6072",
    lineHeight: 17,
  },
  lifecycleButton: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 0,
  },
  lifecycleButtonText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#6E416D",
  },
  bottomActions: {
    alignItems: "center",
    marginTop: 4,
  },
  resetButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#F8F3F9",
    borderWidth: 1,
    borderColor: "#E5DAE6",
  },
  resetButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6E416D",
  },
});
