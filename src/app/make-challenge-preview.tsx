import {
  CouplyChoiceCard,
  CouplyHeader,
  CouplyPrimaryButton,
  CouplyQuietButton,
  CouplySectionCard,
} from "@/components/CouplyUI";
import { getThemedTokens, tokens } from "@/components/couply-tokens";
import { ThemeColors, useTheme } from "@/context/ThemeContext";
import { useChallengePreview } from "@/context/ChallengePreviewContext";
import { useUserIdentity } from "@/context/UserIdentityContext";
import { supabase } from "@/lib/supabase";
import {
  saveAnnoyanceReframe,
  fetchAnnoyanceReframe,
  type AnnoyanceReframeRow,
} from "@/lib/annoyance-reframe";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ParticipantKey = "partner" | "both";

interface ParticipantOption {
  key: ParticipantKey;
  label: string;
  icon: string;
  description: string;
}

const SUGGESTED_IDEAS = [
  {
    title: "Plan our next date",
    icon: "🕯️",
    hint: "Choose a time and place for us",
  },
  {
    title: "Cook dinner together without phones",
    icon: "🍝",
    hint: "Quiet time in the kitchen",
  },
  {
    title: "Brew a cup of tea together",
    icon: "🫖",
    hint: "A warm 5-minute pause",
  },
  {
    title: "Step outside for fresh air",
    icon: "🌱",
    hint: "A quick breath of air together",
  },
];

const COMPLETION_REWARDS_PARTNER = [
  { label: "Breakfast in bed", icon: "☕" },
  { label: "Movie choice tonight", icon: "🍿" },
  { label: "Dinner of your choice", icon: "🍝" },
  { label: "A relaxing massage", icon: "💆" },
  { label: "Sleep-in morning", icon: "🛌" },
  { label: "Choose the playlist", icon: "🎵" },
  { label: "Something sweet", icon: "❤️" },
];

const COMPLETION_REWARDS_BOTH = [
  { label: "Choose a special dessert together", icon: "🍰" },
  { label: "Pick a film we both love", icon: "🍿" },
  { label: "A quiet morning together", icon: "☕" },
  { label: "Cook a cozy meal together", icon: "🍝" },
];

const FALLBACK_REWARDS_PARTNER = [
  { label: "I choose the movie", icon: "🎬" },
  { label: "I choose dinner", icon: "🍝" },
  { label: "I get a massage", icon: "💆" },
  { label: "I control the playlist", icon: "🎵" },
  { label: "I choose our next activity", icon: "🌿" },
];

const FALLBACK_REWARDS_BOTH = [
  { label: "Try something easier together", icon: "🌿" },
  { label: "A gentle 5-minute sofa pause", icon: "🛋️" },
  { label: "Put on one relaxing song", icon: "🎵" },
];

export default function MakeChallengePreviewScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { displayName, partnerName, partnerRef, coupleId, userId } = useUserIdentity();
  const { activeInvitation, shareInvitation, clearInvitation } =
    useChallengePreview();

  const realPartnerName = partnerName || "your partner";

  const participantOptions: ParticipantOption[] = [
    {
      key: "partner",
      label: partnerName ? `For ${partnerName}` : "My partner",
      icon: "💌",
      description: partnerName
        ? `A small challenge just for ${partnerName}.`
        : "A small challenge just for them.",
    },
    {
      key: "both",
      label: "Both of us",
      icon: "🤝",
      description: "Something you’ll try together.",
    },
  ];

  const params = useLocalSearchParams<{
    idea?: string;
    participant?: string;
    source?: string;
    reframeTone?: string;
    reframeText?: string;
    shareReframe?: string;
    reframeId?: string;
    topicKey?: string;
    customTopicLabel?: string;
  }>();

  const initialIdea = typeof params.idea === "string" ? params.idea : "";
  const initialParticipant: ParticipantKey =
    params.participant === "both" ? "both" : "partner";

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
  const [selectedReward, setSelectedReward] = useState<string>("Breakfast in bed");
  const [customRewardText, setCustomRewardText] = useState<string>("");
  const [selectedFallbackReward, setSelectedFallbackReward] = useState<string>("I choose the movie");
  const [customFallbackText, setCustomFallbackText] = useState<string>("");
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
  const [existingReframe, setExistingReframe] = useState<AnnoyanceReframeRow | null>(null);
  const [isLoadingExistingReframe, setIsLoadingExistingReframe] = useState<boolean>(Boolean(params.reframeId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    if (params.reframeId && userId) {
      setIsLoadingExistingReframe(true);
      setLoadError(null);
      void fetchAnnoyanceReframe(supabase, params.reframeId, userId)
        .then(({ data, error }) => {
          if (!isMounted) return;
          if (error) {
            setLoadError(error.message || "Could not load existing reframe.");
          } else if (data) {
            setExistingReframe(data);
          }
        })
        .catch((err: any) => {
          if (!isMounted) return;
          setLoadError(err?.message || "Could not load existing reframe.");
        })
        .finally(() => {
          if (isMounted) {
            setIsLoadingExistingReframe(false);
          }
        });
    } else {
      setIsLoadingExistingReframe(false);
    }
    return () => {
      isMounted = false;
    };
  }, [params.reframeId, userId]);

  const trimmedText = challengeText.trim();
  const effectiveTitle = trimmedText || "A small gentle pause";
  const isCustomProvided = trimmedText.length > 0;
  const effectiveReward = customRewardText.trim() || selectedReward;
  const effectiveFallbackReward = customFallbackText.trim() || selectedFallbackReward;

  async function handleShareInvitation() {
    if (isSaving || isLoadingExistingReframe || Boolean(loadError)) return;
    const trimmed = challengeText.trim();
    if (!trimmed) {
      setValidationError("Please enter an idea first, or pick a suggestion above.");
      return;
    }
    if (!coupleId || !userId) {
      setSaveError("You must be signed in with an active couple connection to save and share an invitation.");
      return;
    }
    setValidationError(null);
    setSaveError(null);
    setIsSaving(true);

    const isSharingLighter =
      isFromReframe &&
      shareLighterThought &&
      lighterThoughtText.trim().length > 0;

    const mappedParticipant: "partner" | "both" =
      participantChoice === "both" ? "both" : "partner";

    const reframeId = (params.reframeId as string) || existingReframe?.id;
    const topicKey = existingReframe?.topic_key || (params.topicKey as string) || "other";
    const customTopicLabel =
      existingReframe?.custom_topic_label !== undefined
        ? existingReframe.custom_topic_label
        : (params.customTopicLabel as string) || null;
    const privateIrritationInput =
      existingReframe?.private_irritation_input !== undefined
        ? existingReframe.private_irritation_input
        : undefined;
    const reframeTone = isSharingLighter
      ? (incomingReframeTone as any)
      : existingReframe?.reframe_tone || undefined;
    const reframeTextVal = isSharingLighter
      ? lighterThoughtText.trim()
      : existingReframe?.reframe_text || undefined;

    const finalCompletionReward = customRewardText.trim() || selectedReward;
    const finalFallbackReward = customFallbackText.trim() || selectedFallbackReward;

    const { data: savedData, error: saveErr } = await saveAnnoyanceReframe(supabase, {
      id: reframeId || undefined,
      coupleId,
      authorId: userId,
      topicKey,
      customTopicLabel,
      privateIrritationInput,
      isPlayful: true,
      challengeIdea: trimmed,
      challengeParticipant: mappedParticipant,
      challengeTimeframe: "Whenever",
      challengeReward: finalCompletionReward,
      fallbackReward: finalFallbackReward,
      status: "active",
      sharedWithPartner: true,
      reframeTone,
      reframeText: reframeTextVal,
      includeReframeWithPartner: isSharingLighter,
    });

    if (saveErr || !savedData) {
      setSaveError(saveErr?.message || "Could not save challenge invitation. Please try again.");
      setIsSaving(false);
      return;
    }

    const invitationId = createdInvitationId || Date.now().toString();
    shareInvitation({
      id: invitationId,
      idea: trimmed,
      participant: mappedParticipant,
      timeframe: "Whenever",
      reward: finalCompletionReward,
      fallbackReward: finalFallbackReward,
      creatorName: displayName?.trim() || "You",
      partnerName: partnerName?.trim() || undefined,
      reframeTone: isSharingLighter ? incomingReframeTone : undefined,
      reframeText: isSharingLighter ? lighterThoughtText.trim() : undefined,
      shareReframe: isSharingLighter,
      status: "pending",
    });

    setCreatedInvitationId(invitationId);
    setShowSharedConfirmation(true);
    setIsSaving(false);
  }

  function handleReset() {
    setChallengeText("");
    setParticipantChoice("partner");
    setSelectedReward("Breakfast in bed");
    setCustomRewardText("");
    setSelectedFallbackReward("I choose the movie");
    setCustomFallbackText("");
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
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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

            {/* Review mode truth */}
            <CouplySectionCard variant="muted" style={styles.noticeCard}>
              <View style={styles.noticeRow}>
                <View style={styles.noticeBadge}>
                  <Text style={styles.noticeBadgeText}>Preview</Text>
                </View>
                <Text style={styles.noticeText}>
                  Preview — review your invitation before saving or sharing with your partner.
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
                      thumbColor={theme.primaryActionText}
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

            {/* SECTION 1: What should happen? */}
            <CouplySectionCard style={styles.sectionCard}>
              <Text style={styles.sectionNumber}>1 OF 4</Text>
              <Text style={styles.sectionHeading}>What should happen?</Text>
              <Text style={styles.sectionHelper}>
                Write a small, playful challenge you’d love to see happen.
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
                  placeholder="Write your challenge…"
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

            {/* SECTION 2: Who's taking this on? */}
            <CouplySectionCard style={styles.sectionCard}>
              <Text style={styles.sectionNumber}>2 OF 4</Text>
              <Text style={styles.sectionHeading}>Who’s taking this on?</Text>
              <Text style={styles.sectionHelper}>
                An invitation is always optional. Choose whether this is for your partner or for both of you.
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

            {/* SECTION 3: If completed & If not this time */}
            <CouplySectionCard style={styles.sectionCard}>
              <Text style={styles.sectionNumber}>3 OF 4</Text>
              <Text style={styles.sectionHeading}>
                {participantChoice === "both"
                  ? "What do you both get?"
                  : `What does ${realPartnerName} get?`}
              </Text>
              <Text style={styles.sectionHelper}>
                A playful reward if this happens.
              </Text>

              <View style={styles.chipsRow}>
                {(participantChoice === "both"
                  ? COMPLETION_REWARDS_BOTH
                  : COMPLETION_REWARDS_PARTNER
                ).map((reward) => {
                  const isSelected = selectedReward === reward.label && !customRewardText;
                  return (
                    <Pressable
                      key={reward.label}
                      style={[
                        styles.chip,
                        isSelected && styles.chipSelected,
                      ]}
                      onPress={() => {
                        setSelectedReward(reward.label);
                        setCustomRewardText("");
                      }}
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

              <TextInput
                style={styles.customTextInput}
                placeholder="Or write your own completion reward…"
                placeholderTextColor={tokens.colors.textMuted}
                value={customRewardText}
                onChangeText={setCustomRewardText}
                maxLength={80}
              />

              {/* Fallback outcome */}
              <View style={{ marginTop: tokens.spacing.md, gap: tokens.spacing.sm }}>
                <Text style={styles.sectionHeading}>
                  {participantChoice === "both"
                    ? "What happens instead?"
                    : "What do you get instead?"}
                </Text>
                <Text style={styles.sectionHelper}>
                  If not this time, keep it gentle and fun.
                </Text>

                <View style={styles.chipsRow}>
                  {(participantChoice === "both"
                    ? FALLBACK_REWARDS_BOTH
                    : FALLBACK_REWARDS_PARTNER
                  ).map((fallback) => {
                    const isSelected = selectedFallbackReward === fallback.label && !customFallbackText;
                    return (
                      <Pressable
                        key={fallback.label}
                        style={[
                          styles.chip,
                          isSelected && styles.chipSelected,
                        ]}
                        onPress={() => {
                          setSelectedFallbackReward(fallback.label);
                          setCustomFallbackText("");
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={fallback.label}
                      >
                        <Text style={styles.chipEmoji}>{fallback.icon}</Text>
                        <Text
                          style={[
                            styles.chipText,
                            isSelected && styles.chipTextSelected,
                          ]}
                        >
                          {fallback.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <TextInput
                  style={styles.customTextInput}
                  placeholder="Or write your own fallback reward…"
                  placeholderTextColor={tokens.colors.textMuted}
                  value={customFallbackText}
                  onChangeText={setCustomFallbackText}
                  maxLength={80}
                />
              </View>
            </CouplySectionCard>

            {/* SECTION 4: Challenge Preview */}
            <CouplySectionCard style={styles.sectionCard}>
              <Text style={styles.sectionNumber}>4 OF 4</Text>
              <Text style={styles.sectionHeading}>Review your challenge</Text>
              <Text style={styles.sectionHelper}>
                Everything important is visible right here before sending.
              </Text>

              {/* Summary card with task + outcome + reward */}
              <View style={styles.previewBox}>
                <View style={styles.previewHeaderRow}>
                  <Text style={styles.previewIcon}>
                    {participantChoice === "both" ? "🤝" : "🌱"}
                  </Text>
                  <View style={styles.previewHeaderTextGroup}>
                    <Text style={styles.previewOverline}>
                      🌱 YOUR CHALLENGE
                    </Text>
                    <Text style={styles.previewChallengeTitle}>
                      {effectiveTitle}
                    </Text>
                    <Text style={styles.previewTargetText}>
                      {participantChoice === "both"
                        ? "For both of you"
                        : `For ${realPartnerName}`}
                    </Text>
                  </View>
                </View>

                <View style={styles.rewardSummaryStack}>
                  {/* If completed block */}
                  <View style={styles.rewardBlockCompleted}>
                    <Text style={styles.rewardBlockLabel}>
                      {participantChoice === "both"
                        ? "IF YOU DO IT"
                        : `IF ${realPartnerName.toUpperCase()} DOES IT`}
                    </Text>
                    <Text style={styles.rewardBlockText}>
                      🎁 {customRewardText.trim() || selectedReward}
                    </Text>
                  </View>

                  {/* If not this time block */}
                  <View style={styles.rewardBlockFallback}>
                    <Text style={styles.rewardBlockLabelFallback}>
                      IF NOT THIS TIME
                    </Text>
                    <Text style={styles.rewardBlockTextFallback}>
                      🌿 {customFallbackText.trim() || selectedFallbackReward}
                    </Text>
                  </View>
                </View>

                <View style={styles.reassuranceBox}>
                  <Text style={styles.reassuranceText}>
                    {participantChoice === "both"
                      ? "Something you try together. If it doesn't happen, decline easily without penalties."
                      : `${realPartnerName} can join or let it pass with zero pressure or streaks.`}
                  </Text>
                </View>
              </View>

              {/* Validation error if any */}
              {validationError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{validationError}</Text>
                </View>
              )}

              {/* Load error if any */}
              {loadError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{loadError}</Text>
                </View>
              )}

              {/* Persistence save error if any */}
              {saveError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{saveError}</Text>
                </View>
              )}

              {/* Finish Action */}
              <View style={styles.shareActionContainer}>
                <CouplyPrimaryButton
                  label="Send challenge"
                  onPress={handleShareInvitation}
                  disabled={isSaving || isLoadingExistingReframe || Boolean(loadError)}
                  loading={isSaving || isLoadingExistingReframe}
                  style={styles.finishButton}
                />
                <Text style={styles.prototypeNoticeText}>
                  {participantChoice === "both"
                    ? "Shared with your partner in your shared space."
                    : `Sent directly to ${realPartnerName} to review quietly.`}
                </Text>
              </View>

              {/* Shared confirmation card */}
              {showSharedConfirmation && (
                <CouplySectionCard variant="lilac" style={styles.confirmationCard}>
                  <Text style={styles.confirmationOverline}>
                    CHALLENGE READY
                  </Text>
                  <Text style={styles.confirmationTitle}>
                    Challenge sent to your space
                  </Text>
                  <Text style={styles.confirmationBody}>
                    This playful invitation is now live. {realPartnerName} will see it when they open Couply.
                  </Text>
                  <View style={styles.truthfulBox}>
                    <Text style={styles.truthfulText}>
                      Saved with completion reward and fallback reward.
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

            {/* Exploratory lifecycle preview link: Partner/Both */}
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
                      timeframe: "Whenever / no rush",
                      reward: effectiveReward,
                      fallbackReward: effectiveFallbackReward,
                      reframeTone: incomingReframeTone,
                      reframeText: isSharing ? lighterThoughtText.trim() : "",
                      shareReframe: isSharing ? "true" : "false",
                    },
                  } as any);
                }}
                style={styles.lifecycleButton}
              />
            </CouplySectionCard>

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

const createStyles = (theme: ThemeColors) => {
  const tokens = getThemedTokens(theme);
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.pageBackground,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: tokens.spacing.md,
    paddingBottom: 110,
  },
  column: {
    maxWidth: tokens.layout.appShell,
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
    color: theme.primaryActionText,
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
    minWidth: 0,
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
    minHeight: 44,
    justifyContent: "center",
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
    minHeight: 44,
    justifyContent: "center",
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
    minWidth: 0,
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
    flexShrink: 0,
    marginRight: 8,
  },
  summaryValue: {
    fontSize: tokens.typeScale.caption,
    fontWeight: "600",
    color: tokens.colors.text,
    flexShrink: 1,
    textAlign: "right",
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
  customTextInput: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.small,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: tokens.typeScale.body,
    color: tokens.colors.text,
    marginTop: 6,
  },
  previewTargetText: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
    fontWeight: "500",
    marginTop: 2,
  },
  rewardSummaryStack: {
    gap: 8,
  },
  rewardBlockCompleted: {
    backgroundColor: tokens.colors.surfaceLilac,
    borderRadius: tokens.radii.small,
    padding: tokens.spacing.sm + 2,
    borderWidth: 1,
    borderColor: tokens.colors.plum,
    gap: 2,
  },
  rewardBlockLabel: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "700",
    color: tokens.colors.plum,
    letterSpacing: 0.6,
  },
  rewardBlockText: {
    fontSize: tokens.typeScale.body,
    fontWeight: "600",
    color: tokens.colors.text,
  },
  rewardBlockFallback: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.radii.small,
    padding: tokens.spacing.sm + 2,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    gap: 2,
  },
  rewardBlockLabelFallback: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "700",
    color: tokens.colors.textMuted,
    letterSpacing: 0.6,
  },
  rewardBlockTextFallback: {
    fontSize: tokens.typeScale.body,
    fontWeight: "500",
    color: tokens.colors.textSecondary,
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
};
