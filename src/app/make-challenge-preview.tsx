import {
  CouplyChoiceCard,
  CouplyHeader,
  CouplyPrimaryButton,
  CouplyQuietButton,
  CouplySectionCard,
} from "@/components/CouplyUI";
import { tokens } from "@/components/couply-tokens";
import { useChallengePreview } from "@/context/ChallengePreviewContext";
import { useUserIdentity } from "@/context/UserIdentityContext";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
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
  const { displayName, partnerName, partnerRef } = useUserIdentity();
  const { activeInvitation, shareInvitation, clearInvitation } =
    useChallengePreview();

  const realPartnerName = partnerName || "your partner";

  const participantOptions: ParticipantOption[] = [
    {
      key: "sam",
      label: partnerName ? `Invite ${partnerName}` : "Invite partner",
      icon: "💌",
      description: partnerName
        ? `A gentle, optional invitation for ${partnerName}`
        : "A gentle, optional invitation for your partner",
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

  const params = useLocalSearchParams<{
    idea?: string;
    participant?: string;
    source?: string;
    reframeTone?: string;
    reframeText?: string;
    shareReframe?: string;
  }>();

  const initialIdea = typeof params.idea === "string" ? params.idea : "";
  const initialParticipant: ParticipantKey =
    params.participant === "me" ||
    params.participant === "sam" ||
    params.participant === "both"
      ? params.participant
      : "sam";

  const incomingReframeText =
    typeof params.reframeText === "string" ? params.reframeText : "";
  const incomingReframeTone =
    typeof params.reframeTone === "string" ? params.reframeTone : "";
  const hasReframeText = incomingReframeText.trim().length > 0;
  const isFromReframe = params.source === "reframe" && hasReframeText;
  const initialShareReframe = params.shareReframe === "true";

  const [challengeText, setChallengeText] = useState(initialIdea);
  const [participantChoice, setParticipantChoice] =
    useState<ParticipantKey>(initialParticipant);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>("Today");
  const [selectedReward, setSelectedReward] = useState<string>(
    "No reward — just the moment",
  );
  const [shareLighterThought, setShareLighterThought] =
    useState(initialShareReframe);
  const [lighterThoughtText, setLighterThoughtText] =
    useState(incomingReframeText);

  const [createdInvitationId, setCreatedInvitationId] = useState<string | null>(
    null,
  );
  const [showSharedConfirmation, setShowSharedConfirmation] =
    useState<boolean>(false);
  const [showPersonalConfirmation, setShowPersonalConfirmation] =
    useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const trimmedText = challengeText.trim();
  const effectiveTitle = trimmedText || "A small gentle pause";
  const isCustomProvided = trimmedText.length > 0;

  function handleShareInvitation() {
    const trimmed = challengeText.trim();
    if (!trimmed) {
      setValidationError("Please enter an idea first, or pick a suggestion above.");
      return;
    }
    setValidationError(null);

    const invitationId = createdInvitationId || Date.now().toString();
    const isSharingLighter =
      isFromReframe &&
      shareLighterThought &&
      lighterThoughtText.trim().length > 0;

    const mappedParticipant: "partner" | "both" =
      participantChoice === "both" ? "both" : "partner";

    shareInvitation({
      id: invitationId,
      idea: trimmed,
      participant: mappedParticipant,
      timeframe: selectedTimeframe,
      reward: selectedReward,
      creatorName: displayName?.trim() || "You",
      partnerName: partnerName?.trim() || undefined,
      reframeTone: isSharingLighter ? incomingReframeTone : undefined,
      reframeText: isSharingLighter ? lighterThoughtText.trim() : undefined,
      shareReframe: isSharingLighter,
      status: "pending",
    });

    setCreatedInvitationId(invitationId);
    setShowSharedConfirmation(true);
  }

  function handleFinishPersonal() {
    const trimmed = challengeText.trim();
    if (!trimmed) {
      setValidationError("Please enter an idea first, or pick a suggestion above.");
      return;
    }
    setValidationError(null);
    setShowPersonalConfirmation(true);
  }

  function handleReset() {
    setChallengeText("");
    setParticipantChoice("sam");
    setSelectedTimeframe("Today");
    setSelectedReward("No reward — just the moment");
    setShareLighterThought(false);
    setLighterThoughtText(incomingReframeText);
    setShowSharedConfirmation(false);
    setShowPersonalConfirmation(false);
    setValidationError(null);
    if (createdInvitationId && activeInvitation?.id === createdInvitationId) {
      clearInvitation();
    }
    setCreatedInvitationId(null);
  }

  function handleSelectSuggestion(title: string) {
    setChallengeText(title);
    if (validationError) {
      setValidationError(null);
    }
  }

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/home");
    }
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
            {/* Header */}
            <CouplyHeader
              title="Make a tiny challenge"
              subtitle="Compose a small, kind invitation that is easy to accept or quietly let pass."
              onBack={handleBack}
              backLabel="‹ Back"
            />

            {/* Development preview truth */}
            <CouplySectionCard variant="muted" style={styles.noticeCard}>
              <View style={styles.noticeRow}>
                <View style={styles.noticeBadge}>
                  <Text style={styles.noticeBadgeText}>Preview</Text>
                </View>
                <Text style={styles.noticeText}>
                  Local preview — everything here is temporary. Nothing has been
                  sent or saved to a real partner.
                </Text>
              </View>
            </CouplySectionCard>

            {/* Context banner when arriving from playful reframe */}
            {isFromReframe && (
              <CouplySectionCard variant="lilac" style={styles.reframeBannerCard}>
                <View style={styles.reframeBannerHeader}>
                  <View style={styles.reframeBannerBadge}>
                    <Text style={styles.reframeBannerBadgeText}>
                      FROM YOUR REFRAME
                    </Text>
                  </View>
                </View>
                <Text style={styles.reframeBannerBody}>
                  A small, kind idea to help you two reset. You can edit or keep
                  the lighter thought below.
                </Text>

                {/* Lighter thought Switch control */}
                <View style={styles.switchWrapper}>
                  <Pressable
                    style={styles.switchRow}
                    onPress={() => setShareLighterThought((prev) => !prev)}
                    accessible={false}
                  >
                    <View style={styles.switchTextGroup}>
                      <Text style={styles.switchTitle}>
                        Include your lighter thought
                      </Text>
                      <Text style={styles.switchSubtitle}>
                        {shareLighterThought
                          ? "Your edited lighter thought will appear with this invitation."
                          : "It stays private. Your original irritation is never shared."}
                      </Text>
                    </View>
                    <Switch
                      value={shareLighterThought}
                      onValueChange={setShareLighterThought}
                      trackColor={{
                        false: tokens.colors.border,
                        true: tokens.colors.plum,
                      }}
                      thumbColor="#FFFFFF"
                      accessibilityRole="switch"
                      accessibilityLabel="Include your lighter thought"
                      accessibilityState={{ checked: shareLighterThought }}
                    />
                  </Pressable>

                  {/* Lighter thought editable text */}
                  <View style={styles.lighterThoughtInputBox}>
                    <Text style={styles.lighterThoughtInputLabel}>
                      Your lighter thought:
                    </Text>
                    <TextInput
                      style={styles.lighterThoughtTextInput}
                      value={lighterThoughtText}
                      onChangeText={setLighterThoughtText}
                      placeholder="A warm angle to share..."
                      placeholderTextColor={tokens.colors.textMuted}
                      multiline
                      accessibilityLabel="Your lighter thought"
                    />
                    <Text style={styles.lighterThoughtPrivacyNote}>
                      {shareLighterThought
                        ? "Only this edited lighter thought will be shared. Your original irritation is never shared."
                        : "This stays only with you. Your original irritation is never shared."}
                    </Text>
                  </View>
                </View>
              </CouplySectionCard>
            )}

            {/* SECTION 1: Your tiny idea */}
            <CouplySectionCard style={styles.sectionCard}>
              <Text style={styles.sectionNumber}>1 OF 4</Text>
              <Text style={styles.sectionHeading}>Your tiny idea</Text>
              <Text style={styles.sectionHelper}>
                Keep it small, specific, and easy to decline.
              </Text>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.challengeTextInput}
                  value={challengeText}
                  onChangeText={(text) => {
                    setChallengeText(text);
                    if (validationError) {
                      setValidationError(null);
                    }
                  }}
                  placeholder="e.g. Brew a fresh cup of tea, or take a 5-minute quiet walk..."
                  placeholderTextColor={tokens.colors.textMuted}
                  multiline
                  maxLength={120}
                  accessibilityLabel="Challenge idea text"
                />
                <View style={styles.inputFooter}>
                  <Text style={styles.inputCounter}>
                    {challengeText.length}/120
                  </Text>
                </View>
              </View>

              {/* Suggestions */}
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsTitle}>
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
            </CouplySectionCard>

            {/* SECTION 2: Who is it for? */}
            <CouplySectionCard style={styles.sectionCard}>
              <Text style={styles.sectionNumber}>2 OF 4</Text>
              <Text style={styles.sectionHeading}>Who is it for?</Text>
              <Text style={styles.sectionHelper}>
                An invitation is always optional. It is never a task for someone
                else to complete.
              </Text>

              <View style={styles.participantsList}>
                {participantOptions.map((item) => {
                  const isSelected = participantChoice === item.key;
                  return (
                    <CouplyChoiceCard
                      key={item.key}
                      title={item.label}
                      description={item.description}
                      selected={isSelected}
                      onPress={() => {
                        setParticipantChoice(item.key);
                        setShowSharedConfirmation(false);
                        setShowPersonalConfirmation(false);
                      }}
                      icon={
                        <Text style={styles.participantIcon}>{item.icon}</Text>
                      }
                      accessibilityLabel={`${item.label}: ${item.description}`}
                      style={styles.participantChoiceCard}
                    />
                  );
                })}
              </View>
            </CouplySectionCard>

            {/* SECTION 3: A little context */}
            <CouplySectionCard style={styles.sectionCard}>
              <Text style={styles.sectionNumber}>3 OF 4</Text>
              <Text style={styles.sectionHeading}>A little context</Text>
              <Text style={styles.sectionHelper}>
                No urgency or deadlines. Invitations can simply expire quietly.
              </Text>

              {/* Timing */}
              <Text style={styles.subHeading}>When would this feel nice?</Text>
              <View style={styles.chipsRow}>
                {TIMEFRAME_OPTIONS.map((timeframe) => {
                  const isSelected = selectedTimeframe === timeframe;
                  return (
                    <Pressable
                      key={timeframe}
                      style={[
                        styles.chip,
                        isSelected && styles.chipSelected,
                      ]}
                      onPress={() => setSelectedTimeframe(timeframe)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={timeframe}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {timeframe}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Reward */}
              <Text style={[styles.subHeading, { marginTop: 14 }]}>
                Add an optional small reward?
              </Text>
              <View style={styles.chipsRow}>
                {REWARD_OPTIONS.map((reward) => {
                  const isSelected = selectedReward === reward.label;
                  return (
                    <Pressable
                      key={reward.label}
                      style={[
                        styles.chip,
                        isSelected && styles.chipSelected,
                      ]}
                      onPress={() => setSelectedReward(reward.label)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={reward.label}
                    >
                      <Text style={styles.chipEmoji}>{reward.icon}</Text>
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {reward.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </CouplySectionCard>

            {/* SECTION 4: What they would see */}
            <CouplySectionCard style={styles.sectionCard}>
              <Text style={styles.sectionNumber}>4 OF 4</Text>
              <Text style={styles.sectionHeading}>What they would see</Text>
              <Text style={styles.sectionHelper}>
                Here is how this tiny invitation will feel. Notice how light and
                calm it stays.
              </Text>

              {/* Preview card */}
              <View style={styles.previewBox}>
                <View style={styles.previewHeaderRow}>
                  <Text style={styles.previewIcon}>
                    {participantChoice === "me"
                      ? "🌱"
                      : participantChoice === "sam"
                      ? "💌"
                      : "🤝"}
                  </Text>
                  <View style={styles.previewHeaderTextGroup}>
                    <Text style={styles.previewOverline}>
                      {participantChoice === "me"
                        ? "A personal reset"
                        : participantChoice === "sam"
                        ? `A tiny invitation for ${realPartnerName}`
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

                <View style={styles.summaryTable}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Participant</Text>
                    <Text style={styles.summaryValue}>
                      {participantChoice === "me"
                        ? "Just me"
                        : participantChoice === "sam"
                        ? realPartnerName
                        : "Both of us"}
                    </Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Timing</Text>
                    <Text style={styles.summaryValue}>{selectedTimeframe}</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Reward</Text>
                    <Text style={styles.summaryValue}>{selectedReward}</Text>
                  </View>
                  {isFromReframe && (
                    <>
                      <View style={styles.summaryDivider} />
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Lighter thought</Text>
                        <Text style={styles.summaryValue}>
                          {shareLighterThought
                            ? incomingReframeTone || "Included"
                            : "Private"}
                        </Text>
                      </View>
                    </>
                  )}
                </View>

                <View style={styles.reassuranceBox}>
                  <Text style={styles.reassuranceText}>
                    {participantChoice === "sam"
                      ? `${realPartnerName} can choose to join, suggest a tweak, or quietly let it pass. No countdowns, streaks, or notifications are created.`
                      : participantChoice === "both"
                      ? "Both of you choose this together. Shared moments feel lightest when both feel free to decline easily."
                      : "A quiet personal commitment, just for your own peace of mind."}
                  </Text>
                </View>
              </View>

              {/* Validation error if any */}
              {validationError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{validationError}</Text>
                </View>
              )}

              {/* Finish Action: Participant-specific */}
              {participantChoice === "me" ? (
                // Personal finish
                <CouplyPrimaryButton
                  label="Finish personal preview"
                  onPress={handleFinishPersonal}
                  style={styles.finishButton}
                />
              ) : (
                // Shared / Partner finish
                <View style={styles.shareActionContainer}>
                  <CouplyPrimaryButton
                    label="Share invitation in preview"
                    onPress={handleShareInvitation}
                    style={styles.finishButton}
                  />
                  <Text style={styles.prototypeNoticeText}>
                    Local prototype only — nothing is sent to your partner’s device.
                  </Text>
                </View>
              )}

              {/* Personal completion confirmation */}
              {showPersonalConfirmation && participantChoice === "me" && (
                <CouplySectionCard variant="lilac" style={styles.confirmationCard}>
                  <Text style={styles.confirmationTitle}>
                    Your tiny plan is ready
                  </Text>
                  <Text style={styles.confirmationBody}>
                    Keep it close and return to it whenever it feels useful.
                  </Text>
                  <View style={styles.truthfulBox}>
                    <Text style={styles.truthfulText}>
                      This is only a preview and has not been saved.
                    </Text>
                  </View>
                  <CouplyPrimaryButton
                    label="Go to My Rhythm"
                    onPress={() => router.push("/home")}
                    style={styles.confirmationAction}
                  />
                </CouplySectionCard>
              )}

              {/* Shared confirmation card */}
              {showSharedConfirmation && participantChoice !== "me" && (
                <CouplySectionCard variant="lilac" style={styles.confirmationCard}>
                  <Text style={styles.confirmationOverline}>
                    LOCAL PREVIEW ACTIVE
                  </Text>
                  <Text style={styles.confirmationTitle}>
                    Invitation shared in preview
                  </Text>
                  <Text style={styles.confirmationBody}>
                    In this browser session, you can now see how this small
                    invitation would appear for {realPartnerName}.
                  </Text>
                  <View style={styles.truthfulBox}>
                    <Text style={styles.truthfulText}>
                      Nothing has been sent, saved, or shown to a real partner.
                    </Text>
                  </View>
                  <View style={styles.confirmationActionsGroup}>
                    <CouplyPrimaryButton
                      label="Go to My Rhythm"
                      onPress={() => router.push("/home")}
                      style={styles.confirmationAction}
                    />
                    <CouplyQuietButton
                      label="Explore recipient experience"
                      variant="soft"
                      onPress={() =>
                        router.push({
                          pathname: "/challenge-lifecycle-preview",
                          params: { source: "challenge-preview" },
                        } as any)
                      }
                      style={styles.confirmationAction}
                    />
                  </View>
                </CouplySectionCard>
              )}
            </CouplySectionCard>

            {/* Exploratory lifecycle preview link: Partner/Both only */}
            {participantChoice !== "me" && (
              <CouplySectionCard variant="muted" style={styles.lifecycleCard}>
                <Text style={styles.lifecycleTitle}>
                  Curious what happens next?
                </Text>
                <Text style={styles.lifecycleBody}>
                  Explore the lifecycle preview to see how waiting, accepted,
                  declined, and expired states feel.
                </Text>
                <CouplyQuietButton
                  label="Preview recipient experience ›"
                  variant="soft"
                  onPress={() => {
                    const isSharing = isFromReframe && shareLighterThought;
                    router.push({
                      pathname: "/challenge-lifecycle-preview",
                      params: {
                        idea: challengeText.trim(),
                        participant: participantChoice,
                        timeframe: selectedTimeframe,
                        reward: selectedReward,
                        reframeTone: incomingReframeTone,
                        reframeText: isSharing ? lighterThoughtText.trim() : "",
                        shareReframe: isSharing ? "true" : "false",
                      },
                    } as any);
                  }}
                  style={styles.lifecycleButton}
                />
              </CouplySectionCard>
            )}

            {/* Reset */}
            <View style={styles.resetRow}>
              <CouplyQuietButton
                label="Reset preview"
                variant="text"
                onPress={handleReset}
              />
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
    backgroundColor: tokens.colors.pageBackground,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: tokens.spacing.page,
    paddingTop: tokens.spacing.md,
    paddingBottom: 48,
  },
  column: {
    maxWidth: tokens.layout.maxContentWidth,
    width: "100%",
    alignSelf: "center",
    gap: tokens.spacing.lg,
  },
  noticeCard: {
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
  },
  noticeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  noticeBadge: {
    backgroundColor: tokens.colors.surfaceLilac,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.small,
  },
  noticeBadgeText: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "700",
    color: tokens.colors.plum,
    textTransform: "uppercase",
  },
  noticeText: {
    flex: 1,
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
    lineHeight: 17,
  },
  reframeBannerCard: {
    gap: tokens.spacing.md,
  },
  reframeBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  reframeBannerBadge: {
    backgroundColor: tokens.colors.plum,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 3,
    borderRadius: tokens.radii.small,
  },
  reframeBannerBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  reframeBannerBody: {
    fontSize: tokens.typeScale.body,
    color: tokens.colors.textSecondary,
    lineHeight: 18,
  },
  switchWrapper: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.card,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    gap: tokens.spacing.md,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
  },
  switchTextGroup: {
    flex: 1,
    gap: 2,
  },
  switchTitle: {
    fontSize: tokens.typeScale.bodyLarge,
    fontWeight: "600",
    color: tokens.colors.text,
  },
  switchSubtitle: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
    lineHeight: 16,
  },
  lighterThoughtInputBox: {
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    paddingTop: 10,
    gap: 6,
  },
  lighterThoughtInputLabel: {
    fontSize: tokens.typeScale.caption,
    fontWeight: "600",
    color: tokens.colors.textSecondary,
  },
  lighterThoughtTextInput: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.small,
    backgroundColor: tokens.colors.pageBackground,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: tokens.typeScale.body,
    color: tokens.colors.text,
    minHeight: 48,
    textAlignVertical: "top",
  },
  lighterThoughtPrivacyNote: {
    fontSize: tokens.typeScale.overline,
    color: tokens.colors.textMuted,
    lineHeight: 15,
  },
  sectionCard: {
    gap: tokens.spacing.md,
  },
  sectionNumber: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: tokens.colors.textMuted,
    textTransform: "uppercase",
  },
  sectionHeading: {
    fontSize: tokens.typeScale.sectionTitle + 1,
    fontWeight: "600",
    color: tokens.colors.text,
  },
  sectionHelper: {
    fontSize: tokens.typeScale.body,
    color: tokens.colors.textSecondary,
    lineHeight: 18,
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.card,
    backgroundColor: tokens.colors.surface,
    padding: 10,
    gap: 4,
  },
  challengeTextInput: {
    fontSize: tokens.typeScale.bodyLarge,
    color: tokens.colors.text,
    minHeight: 56,
    textAlignVertical: "top",
  },
  inputFooter: {
    alignItems: "flex-end",
  },
  inputCounter: {
    fontSize: tokens.typeScale.overline,
    color: tokens.colors.textMuted,
  },
  suggestionsContainer: {
    gap: 8,
    marginTop: 4,
  },
  suggestionsTitle: {
    fontSize: tokens.typeScale.caption,
    fontWeight: "500",
    color: tokens.colors.textSecondary,
  },
  suggestionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: tokens.radii.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  suggestionChipSelected: {
    borderColor: tokens.colors.plum,
    backgroundColor: tokens.colors.surfaceLilac,
  },
  suggestionIcon: {
    fontSize: 14,
  },
  suggestionText: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.text,
  },
  suggestionTextSelected: {
    color: tokens.colors.plum,
    fontWeight: "600",
  },
  participantsList: {
    gap: 8,
  },
  participantChoiceCard: {
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: 14,
  },
  participantIcon: {
    fontSize: 18,
  },
  subHeading: {
    fontSize: tokens.typeScale.body,
    fontWeight: "600",
    color: tokens.colors.text,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: tokens.radii.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  chipSelected: {
    borderColor: tokens.colors.plum,
    backgroundColor: tokens.colors.surfaceLilac,
  },
  chipEmoji: {
    fontSize: 14,
  },
  chipText: {
    fontSize: tokens.typeScale.body,
    color: tokens.colors.text,
  },
  chipTextSelected: {
    color: tokens.colors.plum,
    fontWeight: "600",
  },
  previewBox: {
    backgroundColor: tokens.colors.pageBackground,
    borderRadius: tokens.radii.card,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    gap: tokens.spacing.md,
  },
  previewHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  previewIcon: {
    fontSize: 22,
  },
  previewHeaderTextGroup: {
    flex: 1,
  },
  previewOverline: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: tokens.colors.plum,
    textTransform: "uppercase",
  },
  previewChallengeTitle: {
    fontSize: tokens.typeScale.sectionTitle,
    fontWeight: "600",
    color: tokens.colors.text,
    marginTop: 2,
  },
  sampleHintBox: {
    backgroundColor: tokens.colors.surfaceMuted,
    padding: 8,
    borderRadius: tokens.radii.small,
  },
  sampleHintText: {
    fontSize: tokens.typeScale.overline + 0.5,
    color: tokens.colors.textSecondary,
    fontStyle: "italic",
  },
  summaryTable: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.small,
    padding: 10,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
  },
  summaryValue: {
    fontSize: tokens.typeScale.caption,
    fontWeight: "600",
    color: tokens.colors.text,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: tokens.colors.border,
  },
  reassuranceBox: {
    paddingTop: 4,
  },
  reassuranceText: {
    fontSize: tokens.typeScale.caption - 0.5,
    color: tokens.colors.textMuted,
    lineHeight: 16,
  },
  errorBox: {
    backgroundColor: tokens.colors.surfaceBlush,
    padding: 10,
    borderRadius: tokens.radii.small,
  },
  errorText: {
    fontSize: tokens.typeScale.body,
    color: tokens.colors.dangerText,
    fontWeight: "500",
  },
  finishButton: {
    width: "100%",
    marginTop: 4,
  },
  shareActionContainer: {
    width: "100%",
    gap: 6,
    alignItems: "center",
  },
  prototypeNoticeText: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textMuted,
    textAlign: "center",
    lineHeight: 16,
  },
  confirmationCard: {
    gap: 10,
    marginTop: 8,
  },
  confirmationOverline: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: tokens.colors.plum,
    textTransform: "uppercase",
  },
  confirmationTitle: {
    fontSize: tokens.typeScale.sectionTitle,
    fontWeight: "600",
    color: tokens.colors.text,
  },
  confirmationBody: {
    fontSize: tokens.typeScale.body,
    color: tokens.colors.textSecondary,
    lineHeight: 18,
  },
  truthfulBox: {
    backgroundColor: tokens.colors.surfaceMuted,
    padding: 8,
    borderRadius: tokens.radii.small,
  },
  truthfulText: {
    fontSize: tokens.typeScale.caption - 0.5,
    color: tokens.colors.textSecondary,
  },
  confirmationActionsGroup: {
    gap: 8,
    marginTop: 4,
  },
  confirmationAction: {
    width: "100%",
  },
  lifecycleCard: {
    gap: 8,
  },
  lifecycleTitle: {
    fontSize: tokens.typeScale.bodyLarge,
    fontWeight: "600",
    color: tokens.colors.text,
  },
  lifecycleBody: {
    fontSize: tokens.typeScale.body,
    color: tokens.colors.textSecondary,
    lineHeight: 18,
  },
  lifecycleButton: {
    alignSelf: "flex-start",
    marginTop: 4,
  },
  resetRow: {
    alignItems: "center",
    paddingVertical: 8,
  },
});
