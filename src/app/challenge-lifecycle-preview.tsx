import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type LifecycleStateKey =
  | "waiting"
  | "accepted"
  | "declined"
  | "expired"
  | "completed";

interface LifecycleStateConfig {
  key: LifecycleStateKey;
  label: string;
  icon: string;
  heading: string;
  text: string;
  supportingNote: string;
}

const LIFECYCLE_STATES: LifecycleStateConfig[] = [
  {
    key: "waiting",
    label: "Waiting quietly",
    icon: "⏳",
    heading: "Waiting quietly",
    text: "This invitation can sit here without pressure. Sam can respond whenever it feels right, or simply let it pass.",
    supportingNote: "No reminders or countdown timers are sent.",
  },
  {
    key: "accepted",
    label: "Sam is in",
    icon: "🤝",
    heading: "Sam is in",
    text: "In this preview, Sam has chosen to join. The tiny reset can now be enjoyed together.",
    supportingNote: "Shared moments feel lightest when both feel free to choose them.",
  },
  {
    key: "declined",
    label: "Not today",
    icon: "🌱",
    heading: "Not today",
    text: "In this preview, Sam chose not today. That is completely okay—tiny invitations never create an obligation.",
    supportingNote: "Declining easily is what keeps invitations safe to receive.",
  },
  {
    key: "expired",
    label: "Time passed",
    icon: "🌙",
    heading: "Time passed quietly",
    text: "The timeframe passed. No reminders, penalties, or awkward follow-ups were created.",
    supportingNote: "Sometimes life gets full, and invitations simply slip away peacefully.",
  },
  {
    key: "completed",
    label: "A little win",
    icon: "✨",
    heading: "A little win",
    text: "You two made a small moment feel lighter. That is worth noticing.",
    supportingNote: "A tiny shared reset helps good energy stick.",
  },
];

export default function ChallengeLifecyclePreviewScreen() {
  const router = useRouter();

  const [selectedStateKey, setSelectedStateKey] =
    useState<LifecycleStateKey>("waiting");
  const [showSharedMemoryPreview, setShowSharedMemoryPreview] = useState(false);

  const currentState = LIFECYCLE_STATES.find(
    (item) => item.key === selectedStateKey,
  )!;

  function handleReset() {
    setSelectedStateKey("waiting");
    setShowSharedMemoryPreview(false);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>
          {/* Top navigation row */}
          <View style={styles.topNavRow}>
            <Pressable
              onPress={() => router.back()}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Text style={styles.backButtonText}>‹ Back</Text>
            </Pressable>
          </View>

          {/* 1. Header */}
          <View style={styles.headerBlock}>
            <Text style={styles.title}>Challenge lifecycle preview</Text>
            <Text style={styles.subtitle}>
              Explore how a tiny invitation can stay light, kind, and optional.
            </Text>
          </View>

          {/* 2. Development notice */}
          <View style={styles.devNoticeCard}>
            <View style={styles.devNoticeBadge}>
              <Text style={styles.devNoticeBadgeText}>Dev Preview</Text>
            </View>
            <Text style={styles.devNoticeText}>
              Development preview — every state below is sample content. Nothing
              has been sent or saved.
            </Text>
          </View>

          {/* 3. Sample context card */}
          <View style={styles.contextCard}>
            <View style={styles.contextHeaderRow}>
              <View style={styles.contextIconBubble}>
                <Text style={styles.contextIcon}>☕</Text>
              </View>
              <View style={styles.contextTextGroup}>
                <Text style={styles.contextOverline}>A tiny invitation</Text>
                <Text style={styles.contextChallengeTitle}>
                  Bring the mug home
                </Text>
              </View>
            </View>
            <View style={styles.contextDivider} />
            <View style={styles.contextFooterRow}>
              <Text style={styles.contextDetailsText}>
                Today · Coffee together
              </Text>
              <Text style={styles.contextSupportingText}>
                A small reset from a playful reframe.
              </Text>
            </View>
          </View>

          {/* 4. Preview state chooser */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Try a sample outcome</Text>
            <Text style={styles.sectionSubtitle}>
              Select any state to explore how it looks and feels.
            </Text>

            <View style={styles.stateChipsRow}>
              {LIFECYCLE_STATES.map((stateItem) => {
                const isSelected = selectedStateKey === stateItem.key;
                return (
                  <Pressable
                    key={stateItem.key}
                    style={[
                      styles.stateChip,
                      isSelected && styles.stateChipSelected,
                    ]}
                    onPress={() => {
                      setSelectedStateKey(stateItem.key);
                      if (stateItem.key !== "completed") {
                        setShowSharedMemoryPreview(false);
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={stateItem.label}
                  >
                    <Text style={styles.stateChipEmoji}>{stateItem.icon}</Text>
                    <Text
                      style={[
                        styles.stateChipText,
                        isSelected && styles.stateChipTextSelected,
                      ]}
                    >
                      {stateItem.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 5. Dynamic outcome card */}
          <View style={styles.outcomeCard}>
            <View style={styles.outcomeHeaderRow}>
              <View style={styles.outcomeIconBubble}>
                <Text style={styles.outcomeIconEmoji}>{currentState.icon}</Text>
              </View>
              <Text style={styles.outcomeHeading}>{currentState.heading}</Text>
            </View>

            <Text style={styles.outcomeBodyText}>{currentState.text}</Text>

            <View style={styles.outcomeNoteBox}>
              <Text style={styles.outcomeNoteText}>
                {currentState.supportingNote}
              </Text>
            </View>
          </View>

          {/* 6. Completion-only section (Show ONLY for 'A little win') */}
          {selectedStateKey === "completed" && (
            <View style={styles.completionSectionCard}>
              <Text style={styles.completionHeading}>Keep this good moment?</Text>
              <Text style={styles.completionSubtitle}>
                You could choose to remember this in your shared space.
              </Text>

              <View style={styles.toggleRow}>
                <Pressable
                  style={[
                    styles.toggleButton,
                    !showSharedMemoryPreview && styles.toggleButtonSelected,
                  ]}
                  onPress={() => setShowSharedMemoryPreview(false)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: !showSharedMemoryPreview }}
                  accessibilityLabel="Not keeping it"
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      !showSharedMemoryPreview &&
                        styles.toggleButtonTextSelected,
                    ]}
                  >
                    Not keeping it
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.toggleButton,
                    showSharedMemoryPreview && styles.toggleButtonSelected,
                  ]}
                  onPress={() => setShowSharedMemoryPreview(true)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: showSharedMemoryPreview }}
                  accessibilityLabel="Preview as a shared good moment"
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      showSharedMemoryPreview &&
                        styles.toggleButtonTextSelected,
                    ]}
                  >
                    Preview as a shared good moment
                  </Text>
                </Pressable>
              </View>

              {/* Compact mock shared-memory card */}
              {showSharedMemoryPreview && (
                <View style={styles.mockMemoryCard}>
                  <View style={styles.mockMemoryHeaderRow}>
                    <View style={styles.mockMemoryBadge}>
                      <Text style={styles.mockMemoryBadgeText}>Ours · Shared</Text>
                    </View>
                    <Text style={styles.mockMemoryDate}>Just now</Text>
                  </View>
                  <Text style={styles.mockMemoryCategory}>A tiny reset</Text>
                  <Text style={styles.mockMemoryTitle}>Bring the mug home</Text>
                  <Text style={styles.mockMemoryDetails}>
                    Today · Coffee together
                  </Text>
                  <View style={styles.mockMemoryNotice}>
                    <Text style={styles.mockMemoryNoticeText}>
                      Preview only — this is not saved to Our Space.
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* 7. Reset action */}
          <View style={styles.bottomActions}>
            <Pressable
              style={styles.resetButton}
              onPress={handleReset}
              accessibilityRole="button"
              accessibilityLabel="Reset preview"
            >
              <Text style={styles.resetButtonText}>Reset preview</Text>
            </Pressable>
          </View>
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
  contextCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    gap: 12,
  },
  contextHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  contextIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F8F3F9",
    alignItems: "center",
    justifyContent: "center",
  },
  contextIcon: {
    fontSize: 17,
  },
  contextTextGroup: {
    flex: 1,
    gap: 2,
  },
  contextOverline: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#8E7E94",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  contextChallengeTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3D3040",
  },
  contextDivider: {
    height: 1,
    backgroundColor: "#F4EDF6",
  },
  contextFooterRow: {
    gap: 4,
  },
  contextDetailsText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#6E416D",
  },
  contextSupportingText: {
    fontSize: 12.5,
    color: "#6D6072",
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
  stateChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  stateChip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stateChipSelected: {
    backgroundColor: "#FBEFF7",
    borderColor: "#6E416D",
  },
  stateChipEmoji: {
    fontSize: 14,
  },
  stateChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3D3040",
  },
  stateChipTextSelected: {
    color: "#6E416D",
    fontWeight: "700",
  },
  outcomeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    gap: 12,
  },
  outcomeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  outcomeIconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F1EDF7",
    alignItems: "center",
    justifyContent: "center",
  },
  outcomeIconEmoji: {
    fontSize: 16,
  },
  outcomeHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3D3040",
  },
  outcomeBodyText: {
    fontSize: 14,
    color: "#3D3040",
    lineHeight: 21,
  },
  outcomeNoteBox: {
    backgroundColor: "#FBF7FC",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#F0E4F1",
  },
  outcomeNoteText: {
    fontSize: 12.5,
    color: "#6D6072",
    lineHeight: 17,
    fontStyle: "italic",
  },
  completionSectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    gap: 12,
  },
  completionHeading: {
    fontSize: 15.5,
    fontWeight: "700",
    color: "#3D3040",
  },
  completionSubtitle: {
    fontSize: 13,
    color: "#6D6072",
    lineHeight: 18,
    marginTop: -6,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  toggleButton: {
    flex: 1,
    backgroundColor: "#FBF7FC",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  toggleButtonSelected: {
    backgroundColor: "#FBEFF7",
    borderColor: "#6E416D",
  },
  toggleButtonText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#6D6072",
    textAlign: "center",
  },
  toggleButtonTextSelected: {
    color: "#6E416D",
    fontWeight: "700",
  },
  mockMemoryCard: {
    backgroundColor: "#FDF8FC",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.2,
    borderColor: "#EBD8EA",
    gap: 6,
    marginTop: 4,
  },
  mockMemoryHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mockMemoryBadge: {
    backgroundColor: "#F4E5F2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  mockMemoryBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6E416D",
  },
  mockMemoryDate: {
    fontSize: 12,
    color: "#8E7E94",
  },
  mockMemoryCategory: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3D3040",
    marginTop: 2,
  },
  mockMemoryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6E416D",
  },
  mockMemoryDetails: {
    fontSize: 12.5,
    color: "#6D6072",
  },
  mockMemoryNotice: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#F3E3F0",
  },
  mockMemoryNoticeText: {
    fontSize: 11.5,
    color: "#8E7E94",
    fontStyle: "italic",
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
