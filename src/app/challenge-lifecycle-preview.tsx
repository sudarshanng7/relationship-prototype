import {
  CouplyChoiceCard,
  CouplyHeader,
  CouplyPrimaryButton,
  CouplyQuietButton,
  CouplySectionCard,
  CouplyStatusPill,
} from "@/components/CouplyUI";
import { getThemedTokens, tokens } from "@/components/couply-tokens";
import { ThemeColors, useTheme } from "@/context/ThemeContext";
import { useChallengePreview } from "@/context/ChallengePreviewContext";
import { useUserIdentity } from "@/context/UserIdentityContext";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  completeAnnoyanceChallenge,
  resolveChallengeOutcome,
  fetchChallengeMemories,
  type ChallengeMemoryRow,
} from "@/lib/annoyance-reframe";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Perspective = "recipient" | "creator";

type ResponseState =
  | "none"
  | "in"
  | "tweak_composing"
  | "tweak_shared"
  | "not_today"
  | "time_passed";

type TweakOption =
  | "Tomorrow instead?"
  | "Later today"
  | "Could we make it even simpler?";

const TWEAK_OPTIONS: TweakOption[] = [
  "Tomorrow instead?",
  "Later today",
  "Could we make it even simpler?",
];

const MEMORY_REACTIONS = [
  "That felt good",
  "We should do this again",
  "It surprised me",
  "A small thing, but meaningful",
] as const;

type MemoryReaction = (typeof MEMORY_REACTIONS)[number];

function getDisplayIcon(title: string): string {
  const lower = title.toLowerCase();
  if (
    lower.includes("tea") ||
    lower.includes("coffee") ||
    lower.includes("mug")
  ) {
    return "☕";
  }
  if (lower.includes("walk")) {
    return "🚶";
  }
  if (lower.includes("sock")) {
    return "🧦";
  }
  if (lower.includes("pause") || lower.includes("breath")) {
    return "🌱";
  }
  if (
    lower.includes("song") ||
    lower.includes("playlist") ||
    lower.includes("music")
  ) {
    return "🎵";
  }
  if (lower.includes("screen") || lower.includes("sofa")) {
    return "🛋️";
  }
  return "✨";
}

export default function ChallengeLifecyclePreviewScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { displayName, partnerName, partnerRef } = useUserIdentity();
  const { activeInvitation, updateInvitationStatus } = useChallengePreview();
  const params = useLocalSearchParams<{
    idea?: string;
    participant?: string;
    timeframe?: string;
    reward?: string;
    fallbackReward?: string;
    reframeTone?: string;
    reframeText?: string;
    shareReframe?: string;
    source?: string;
    id?: string;
    from?: string;
  }>();

  const isSharedChallenge = params.source === "what-matters-now" || Boolean(params.id);
  const isFromPreviewFlow =
    params.source === "home-preview" || params.source === "challenge-preview";
  const shouldUseActiveInvitation =
    Boolean(activeInvitation) && isFromPreviewFlow;

  const creatorLabel =
    isSharedChallenge
      ? partnerName || "Your partner"
      : shouldUseActiveInvitation && activeInvitation
      ? activeInvitation.creatorName || displayName || "You"
      : displayName || "You";

  const recipientCapitalized =
    shouldUseActiveInvitation && activeInvitation
      ? activeInvitation.partnerName || partnerName || "Your partner"
      : partnerName || "Your partner";

  const recipientLabel =
    shouldUseActiveInvitation && activeInvitation
      ? activeInvitation.partnerName || partnerRef || "your partner"
      : partnerRef;

  const passedIdea =
    shouldUseActiveInvitation && activeInvitation
      ? activeInvitation.idea.trim()
      : typeof params.idea === "string"
      ? params.idea.trim()
      : "";

  const displayTitle = passedIdea || "A small gentle pause";
  const displayContext = passedIdea
    ? "A small reset chosen together"
    : "A warm pause together";

  const displayParticipant =
    shouldUseActiveInvitation && activeInvitation
      ? activeInvitation.participant
      : params.participant === "both"
      ? "both"
      : "partner";

  const displayTimeframe =
    shouldUseActiveInvitation && activeInvitation
      ? activeInvitation.timeframe
      : typeof params.timeframe === "string" &&
        params.timeframe.trim().length > 0
      ? params.timeframe
      : "Whenever / no rush";

  const rawReward =
    shouldUseActiveInvitation && activeInvitation
      ? activeInvitation.reward
      : typeof params.reward === "string" && params.reward.trim().length > 0
      ? params.reward
      : "";

  const displayReward =
    rawReward.trim().length > 0 ? rawReward : "No reward — just the moment";

  const rawFallback =
    shouldUseActiveInvitation && activeInvitation
      ? activeInvitation.fallbackReward
      : typeof params.fallbackReward === "string" && params.fallbackReward.trim().length > 0
      ? params.fallbackReward
      : "";

  const [persistedFallbackReward, setPersistedFallbackReward] = useState<string>(rawFallback || "");
  const effectiveFallbackReward = persistedFallbackReward || rawFallback || "";

  const displayIcon = passedIdea ? getDisplayIcon(passedIdea) : "☕";

  const shouldShowLighterThought =
    shouldUseActiveInvitation && activeInvitation
      ? Boolean(
          activeInvitation.shareReframe &&
            activeInvitation.reframeText &&
            activeInvitation.reframeText.trim().length > 0,
        )
      : params.shareReframe === "true" &&
        typeof params.reframeText === "string" &&
        params.reframeText.trim().length > 0;

  const displayReframeText =
    shouldUseActiveInvitation && activeInvitation
      ? activeInvitation.reframeText?.trim() || ""
      : typeof params.reframeText === "string"
      ? params.reframeText.trim()
      : "";

  const displayReframeTone =
    shouldUseActiveInvitation && activeInvitation
      ? activeInvitation.reframeTone?.trim() || ""
      : typeof params.reframeTone === "string"
      ? params.reframeTone.trim()
      : "";

  const initialResponseState: ResponseState = (() => {
    if (shouldUseActiveInvitation && activeInvitation) {
      if (activeInvitation.status === "accepted") return "in";
      if (activeInvitation.status === "tweaked") return "tweak_shared";
      if (activeInvitation.status === "declined") return "not_today";
    }
    return "none";
  })();

  const initialCompleted =
    shouldUseActiveInvitation && activeInvitation?.status === "completed";

  const [perspective, setPerspective] = useState<Perspective>("recipient");
  const [responseState, setResponseState] =
    useState<ResponseState>(initialResponseState);
  const [selectedTweak, setSelectedTweak] = useState<TweakOption | null>(null);
  const [isCompleted, setIsCompleted] = useState(initialCompleted);
  const [isNotThisTime, setIsNotThisTime] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<MemoryReaction | null>(null);
  const [customMemoryNote, setCustomMemoryNote] = useState<string>("");
  const [persistedMemories, setPersistedMemories] = useState<ChallengeMemoryRow[]>([]);
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);

  // If viewing a real persisted challenge, fetch its real status, outcome and existing memories
  useEffect(() => {
    if (!params.id) return;
    let isMounted = true;

    async function loadPersistedChallenge() {
      try {
        const { data: reframe } = await supabase
          .from("annoyance_reframes")
          .select("id, status, fallback_reward, challenge_outcome, completed_at, completed_by")
          .eq("id", params.id)
          .maybeSingle();

        if (reframe && isMounted) {
          if (reframe.fallback_reward) {
            setPersistedFallbackReward(reframe.fallback_reward);
          }
          if (reframe.challenge_outcome === "not_this_time") {
            setIsNotThisTime(true);
            setIsCompleted(false);
          } else if (reframe.completed_at || reframe.challenge_outcome === "completed") {
            setIsCompleted(true);
            setIsNotThisTime(false);
            setResponseState("in");
          } else if (reframe.status === "resolved") {
            setResponseState("in");
          } else if (reframe.status === "dismissed") {
            setResponseState("not_today");
          }
        }

        const { data: memories } = await fetchChallengeMemories(supabase, params.id as string);
        if (memories && isMounted) {
          setPersistedMemories(memories);
          // Pre-populate if current user already has a saved memory
          const { data: { user } } = await supabase.auth.getUser();
          const myMem = memories.find((m) => m.user_id === user?.id);
          if (myMem) {
            if (myMem.reaction) setSelectedReaction(myMem.reaction as MemoryReaction);
            if (myMem.memory_note) setCustomMemoryNote(myMem.memory_note);
          }
        }
      } catch {
        // Fall back gracefully to preview state
      }
    }

    void loadPersistedChallenge();
    return () => {
      isMounted = false;
    };
  }, [params.id]);

  function handleResetAll() {
    setPerspective("recipient");
    setResponseState("none");
    setSelectedTweak(null);
    setIsCompleted(false);
    setIsNotThisTime(false);
    setSelectedReaction(null);
    setCustomMemoryNote("");
    if (shouldUseActiveInvitation) {
      updateInvitationStatus("pending");
    }
  }

  function handleAccept() {
    setResponseState("in");
    if (shouldUseActiveInvitation) {
      updateInvitationStatus("accepted");
    }
  }

  function handleStartTweak() {
    setResponseState("tweak_composing");
    if (!selectedTweak) {
      setSelectedTweak("Tomorrow instead?");
    }
  }

  function handleShareTweak() {
    setResponseState("tweak_shared");
    if (shouldUseActiveInvitation) {
      updateInvitationStatus("tweaked");
    }
  }

  function handleDecline() {
    setResponseState("not_today");
    if (shouldUseActiveInvitation) {
      updateInvitationStatus("declined");
    }
  }

  function handleTimePass() {
    setResponseState("time_passed");
  }

  async function handleComplete() {
    setIsCompleted(true);
    setIsNotThisTime(false);
    if (shouldUseActiveInvitation) {
      updateInvitationStatus("completed");
    }

    if (params.id) {
      setIsSubmittingCompletion(true);
      try {
        await resolveChallengeOutcome(supabase, {
          reframeId: params.id,
          outcome: "completed",
          reaction: selectedReaction || null,
          memoryNote: customMemoryNote.trim() || null,
        });
        const { data: memories } = await fetchChallengeMemories(supabase, params.id);
        if (memories) {
          setPersistedMemories(memories);
        }
      } catch (err) {
        if (__DEV__) {
          console.warn("Failed to persist completion:", err);
        }
      } finally {
        setIsSubmittingCompletion(false);
      }
    }
  }

  async function handleNotThisTime() {
    setIsNotThisTime(true);
    setIsCompleted(false);

    if (params.id) {
      setIsSubmittingCompletion(true);
      try {
        await resolveChallengeOutcome(supabase, {
          reframeId: params.id,
          outcome: "not_this_time",
        });
      } catch (err) {
        if (__DEV__) {
          console.warn("Failed to record not this time:", err);
        }
      } finally {
        setIsSubmittingCompletion(false);
      }
    }
  }

  async function handleSaveMemory() {
    if (!params.id) return;
    setIsSubmittingCompletion(true);
    try {
      await resolveChallengeOutcome(supabase, {
        reframeId: params.id,
        outcome: "completed",
        reaction: selectedReaction || null,
        memoryNote: customMemoryNote.trim() || null,
      });
      const { data: memories } = await fetchChallengeMemories(supabase, params.id);
      if (memories) {
        setPersistedMemories(memories);
      }
    } catch (err) {
      if (__DEV__) {
        console.warn("Failed to save memory:", err);
      }
    } finally {
      setIsSubmittingCompletion(false);
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>
          {/* Header */}
          <CouplyHeader
            title={isSharedChallenge ? "Shared invitation" : "A tiny invitation"}
            subtitle={
              isSharedChallenge
                ? "Something small you can try together, whenever it feels right."
                : "A local preview of how a small invitation can stay light for both people."
            }
            onBack={handleBack}
            backLabel="‹ Back"
          />

          {/* Purpose notice (Preview only) */}
          {!isSharedChallenge && (
            <CouplySectionCard variant="muted" style={styles.purposeCard}>
              <Text style={styles.purposeOverline}>
                INVITATION EXPERIENCE PREVIEW
              </Text>
              <Text style={styles.purposeBody}>
                Explore how this small invitation can stay optional and kind for
                both people.
              </Text>
              <View style={styles.purposeTruthfulBox}>
                <Text style={styles.purposeTruthfulText}>
                  Everything on this screen is a local preview in this browser
                  session. Nothing is sent, saved, or shown to {recipientLabel}.
                </Text>
              </View>
            </CouplySectionCard>
          )}

          {/* Perspective Switcher (Preview only) */}
          {!isSharedChallenge && (
            <View style={styles.perspectiveSection}>
              <View style={styles.perspectiveHeaderRow}>
                <Text style={styles.perspectiveSectionTitle}>Viewpoint</Text>
                <Text style={styles.perspectiveCaption}>
                  Explore each view without sending anything.
                </Text>
              </View>
              <View style={styles.perspectiveCardsRow}>
                <CouplyChoiceCard
                  title={`Viewing as ${recipientCapitalized}`}
                  description="Receiving the invitation"
                  selected={perspective === "recipient"}
                  onPress={() => setPerspective("recipient")}
                  icon={<Text style={styles.perspectiveEmoji}>💌</Text>}
                  accessibilityLabel={`View as ${recipientCapitalized}: Receiving the invitation`}
                  style={styles.perspectiveCard}
                />
                <CouplyChoiceCard
                  title={`Viewing as ${creatorLabel}`}
                  description="Seeing the outcome"
                  selected={perspective === "creator"}
                  onPress={() => setPerspective("creator")}
                  icon={<Text style={styles.perspectiveEmoji}>🙋</Text>}
                  accessibilityLabel={`View as ${creatorLabel}: Seeing the outcome`}
                  style={styles.perspectiveCard}
                />
              </View>
            </View>
          )}

          {/* Invitation Context Card */}
          <CouplySectionCard style={styles.invitationCard}>
            <View style={styles.invitationHeader}>
              <Text style={styles.invitationIcon}>{displayIcon}</Text>
              <View style={styles.invitationHeaderTextGroup}>
                <Text style={styles.invitationOverline}>
                  A tiny invitation from {creatorLabel}
                </Text>
                <Text style={styles.invitationTitle}>{displayTitle}</Text>
                <Text style={styles.invitationSubtitle}>{displayContext}</Text>
              </View>
            </View>

            {/* Lighter Thought Card: only if shared & non-empty */}
            {shouldShowLighterThought && (
              <CouplySectionCard variant="lilac" style={styles.lighterThoughtCard}>
                <View style={styles.lighterThoughtHeaderRow}>
                  <Text style={styles.lighterThoughtOverline}>
                    A LIGHTER THOUGHT FROM {creatorLabel.toUpperCase()}
                  </Text>
                  {displayReframeTone.length > 0 && (
                    <CouplyStatusPill
                      label={displayReframeTone}
                      variant="preview"
                    />
                  )}
                </View>
                <Text style={styles.lighterThoughtText}>
                  "{displayReframeText}"
                </Text>
                <Text style={styles.lighterThoughtSupport}>
                  A warm angle shared with this invitation — not a criticism.
                </Text>
              </CouplySectionCard>
            )}

            <View style={styles.pillsRow}>
              <CouplyStatusPill label={displayTimeframe} variant="neutral" />
              <CouplyStatusPill
                label={displayParticipant === "both" ? "Both of us" : `For ${recipientCapitalized}`}
                variant="neutral"
              />
            </View>

            {/* Structured Reward Architecture Display */}
            <View style={styles.rewardSummaryContainer}>
              <View style={styles.rewardRow}>
                <Text style={styles.rewardLeadEmoji}>🎁</Text>
                <View style={styles.rewardTextCol}>
                  <Text style={styles.rewardRowHeading}>
                    {displayParticipant === "both"
                      ? "If we do it"
                      : perspective === "recipient"
                      ? "If you do it"
                      : `If ${recipientCapitalized} does it`}
                  </Text>
                  <Text style={styles.rewardRowBody}>{displayReward}</Text>
                </View>
              </View>

              {Boolean(effectiveFallbackReward) && (
                <View style={styles.rewardRow}>
                  <Text style={styles.rewardLeadEmoji}>🍵</Text>
                  <View style={styles.rewardTextCol}>
                    <Text style={styles.rewardRowHeading}>If not this time</Text>
                    <Text style={styles.rewardRowBody}>
                      {displayParticipant === "both"
                        ? effectiveFallbackReward
                        : perspective === "recipient"
                        ? `${creatorLabel}'s turn: ${effectiveFallbackReward}`
                        : `Your turn: ${effectiveFallbackReward}`}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </CouplySectionCard>

          {/* NOT THIS TIME STATE */}
          {isNotThisTime ? (
            <CouplySectionCard variant="muted" style={styles.outcomeCard}>
              <View style={styles.outcomeHeaderRow}>
                <Text style={styles.outcomeEmoji}>🌿</Text>
                <View style={styles.outcomeTitleGroup}>
                  <Text style={styles.outcomeOverline}>🌿 NOT THIS TIME</Text>
                  <Text style={styles.outcomeHeading}>
                    This one didn't happen — and that's okay.
                  </Text>
                </View>
              </View>

              <Text style={styles.outcomeBody}>
                Challenges only stay fun when not doing them is completely safe.
              </Text>

              {Boolean(effectiveFallbackReward) && (
                <View style={styles.fallbackNoticeBox}>
                  <Text style={styles.fallbackNoticeLabel}>
                    {displayParticipant === "both"
                      ? "Our reset"
                      : `${creatorLabel}'s turn`}
                  </Text>
                  <Text style={styles.fallbackNoticeValue}>{effectiveFallbackReward}</Text>
                </View>
              )}

              <View style={styles.actionsStack}>
                <CouplyPrimaryButton
                  label="Leave it here"
                  onPress={handleBack}
                  style={styles.actionButton}
                />
                {!isSharedChallenge && (
                  <CouplyQuietButton
                    label="Start this preview again"
                    variant="text"
                    onPress={handleResetAll}
                    style={styles.actionButton}
                  />
                )}
              </View>
            </CouplySectionCard>
          ) : isCompleted ? (
            /* COMPLETED STATE (both perspectives) */
            <CouplySectionCard variant="lilac" style={styles.outcomeCard}>
              <View style={styles.outcomeHeaderRow}>
                <Text style={styles.outcomeEmoji}>🌿</Text>
                <View style={styles.outcomeTitleGroup}>
                  <Text style={styles.outcomeOverline}>🌿 SOMETHING BLOOMED</Text>
                  <Text style={styles.outcomeHeading}>You did this together</Text>
                </View>
              </View>

              {/* Challenge reference & Completed Reward */}
              <View style={styles.challengeReferenceBox}>
                <Text style={styles.challengeReferenceEmoji}>{displayIcon}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.challengeReferenceTitle}>{displayTitle}</Text>
                  <Text style={styles.completedRewardText}>
                    {displayParticipant === "both"
                      ? `Our reward: ${displayReward}`
                      : `${recipientCapitalized}'s reward: ${displayReward}`}
                  </Text>
                </View>
              </View>

              <Text style={styles.outcomeBody}>
                A small thing you chose to make space for together.
              </Text>

              {/* Memory Ritual: Anything from this you'd like to keep? */}
              <View style={styles.memoryRitualCard}>
                <Text style={styles.memoryRitualPrompt}>
                  Anything from this you’d like to keep?
                </Text>

                {/* 4 Quick reaction pills */}
                <View style={styles.reactionsList}>
                  {MEMORY_REACTIONS.map((reaction) => {
                    const isSelected = selectedReaction === reaction;
                    return (
                      <Pressable
                        key={reaction}
                        style={[
                          styles.reactionChip,
                          isSelected && styles.reactionChipSelected,
                        ]}
                        onPress={() =>
                          setSelectedReaction(isSelected ? null : reaction)
                        }
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={reaction}
                      >
                        <Text
                          style={[
                            styles.reactionChipText,
                            isSelected && styles.reactionChipTextSelected,
                          ]}
                        >
                          {reaction}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Short optional free-text memory */}
                <TextInput
                  style={styles.customMemoryInput}
                  placeholder="Add a few words…"
                  placeholderTextColor={tokens.colors.textMuted}
                  value={customMemoryNote}
                  onChangeText={setCustomMemoryNote}
                  maxLength={200}
                  multiline
                />

                {/* Individual partner contribution indication */}
                {(selectedReaction || customMemoryNote.trim().length > 0) && (
                  <View style={styles.partnerMemoryPreviewBox}>
                    <Text style={styles.partnerMemoryLabel}>
                      {displayName || "You"} · Personal reflection
                    </Text>
                    {Boolean(selectedReaction) && (
                      <Text style={styles.partnerMemoryQuote}>
                        “{selectedReaction}”
                      </Text>
                    )}
                    {customMemoryNote.trim().length > 0 && (
                      <Text style={styles.partnerMemoryNote}>
                        {customMemoryNote.trim()}
                      </Text>
                    )}
                    {Boolean(params.id) && (
                      <CouplyQuietButton
                        label="Update memory"
                        variant="soft"
                        onPress={handleSaveMemory}
                        disabled={isSubmittingCompletion}
                        style={{ marginTop: 4, alignSelf: "flex-start" }}
                      />
                    )}
                  </View>
                )}

                {/* Display other partner's memory if available */}
                {persistedMemories.filter((m) => m.reaction || m.memory_note).map((mem) => {
                  const isOtherPartner = mem.reaction !== selectedReaction || mem.memory_note !== customMemoryNote;
                  if (!isOtherPartner) return null;
                  return (
                    <View key={mem.id} style={styles.partnerMemoryPreviewBox}>
                      <Text style={styles.partnerMemoryLabel}>
                        {partnerName || "Partner"} · Reflection
                      </Text>
                      {Boolean(mem.reaction) && (
                        <Text style={styles.partnerMemoryQuote}>
                          “{mem.reaction}”
                        </Text>
                      )}
                      {Boolean(mem.memory_note) && (
                        <Text style={styles.partnerMemoryNote}>
                          {mem.memory_note}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Primary CTA and Leave it here action */}
              <View style={styles.actionsStack}>
                <CouplyPrimaryButton
                  label="🌱 See what grew"
                  onPress={() => router.push("/garden")}
                  style={styles.actionButton}
                />
                <CouplyQuietButton
                  label="Leave it here"
                  variant="soft"
                  onPress={handleBack}
                  style={styles.actionButton}
                />
                {!isSharedChallenge && (
                  <CouplyQuietButton
                    label="Start this preview again"
                    variant="text"
                    onPress={handleResetAll}
                    style={styles.actionButton}
                  />
                )}
              </View>
            </CouplySectionCard>
          ) : perspective === "recipient" ? (
            /* RECIPIENT VIEW */
            <View style={styles.stateContainer}>
              {/* Choice area: None chosen yet */}
              {responseState === "none" && (
                <CouplySectionCard style={styles.responseSectionCard}>
                  <Text style={styles.recipientPromptTitle}>
                    Up for a small reset together?
                  </Text>
                  <View style={styles.reassuranceBox}>
                    <Text style={styles.reassuranceText}>
                      Take your time. An invitation is never an obligation, and
                      choosing not today is always completely okay.
                    </Text>
                  </View>

                  <View style={styles.choicesList}>
                    <CouplyChoiceCard
                      title="I’m in"
                      description="Accept this tiny invitation"
                      icon={<Text style={styles.choiceEmoji}>🤝</Text>}
                      onPress={handleAccept}
                      accessibilityLabel="Accept this tiny invitation"
                      style={styles.recipientChoiceCard}
                    />
                    <CouplyChoiceCard
                      title="Suggest a tweak"
                      description="Suggest a gentler alternative or timing"
                      icon={<Text style={styles.choiceEmoji}>💬</Text>}
                      onPress={handleStartTweak}
                      accessibilityLabel="Suggest a gentler alternative"
                      style={styles.recipientChoiceCard}
                    />
                    <CouplyChoiceCard
                      title="Not this one"
                      description="A gentle, completely safe pass"
                      icon={<Text style={styles.choiceEmoji}>🌱</Text>}
                      onPress={handleDecline}
                      accessibilityLabel="Decline this invitation for now"
                      style={styles.recipientChoiceCard}
                    />
                  </View>
                </CouplySectionCard>
              )}

              {/* Recipient accepted */}
              {responseState === "in" && (
                <CouplySectionCard variant="lilac" style={styles.outcomeCard}>
                  <View style={styles.outcomeHeaderRow}>
                    <Text style={styles.outcomeEmoji}>🤝</Text>
                    <Text style={styles.outcomeHeading}>You’re in.</Text>
                  </View>
                  <Text style={styles.outcomeBody}>
                    Enjoy this little reset together whenever it feels right.
                  </Text>
                  <View style={styles.truthfulBox}>
                    <Text style={styles.truthfulText}>
                      In this preview, {creatorLabel} would see that you are
                      open to the idea. This response only updates the current
                      browser session.
                    </Text>
                  </View>
                  <View style={styles.actionsStack}>
                    <CouplyPrimaryButton
                      label="✨ We did this together"
                      onPress={handleComplete}
                      style={styles.actionButton}
                    />
                    <CouplyQuietButton
                      label="Not this time"
                      variant="soft"
                      onPress={handleNotThisTime}
                      style={styles.actionButton}
                    />
                    {!isSharedChallenge && (
                      <CouplyQuietButton
                        label={`View as ${creatorLabel}`}
                        variant="soft"
                        onPress={() => setPerspective("creator")}
                        style={styles.actionButton}
                      />
                    )}
                    {!isSharedChallenge && (
                      <CouplyQuietButton
                        label="Start this preview again"
                        variant="text"
                        onPress={handleResetAll}
                        style={styles.actionButton}
                      />
                    )}
                  </View>
                </CouplySectionCard>
              )}

              {/* Recipient composing a tweak */}
              {responseState === "tweak_composing" && (
                <CouplySectionCard style={styles.outcomeCard}>
                  <View style={styles.outcomeHeaderRow}>
                    <Text style={styles.outcomeEmoji}>💬</Text>
                    <Text style={styles.outcomeHeading}>
                      What would feel easier?
                    </Text>
                  </View>
                  <Text style={styles.outcomeBody}>
                    A tiny change can make an invitation feel more natural.
                  </Text>
                  <View style={styles.tweakList}>
                    {TWEAK_OPTIONS.map((tweak) => {
                      const isSelected = selectedTweak === tweak;
                      return (
                        <Pressable
                          key={tweak}
                          style={[
                            styles.tweakChip,
                            isSelected && styles.tweakChipSelected,
                          ]}
                          onPress={() => setSelectedTweak(tweak)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          accessibilityLabel={tweak}
                        >
                          <Text
                            style={[
                              styles.tweakChipText,
                              isSelected && styles.tweakChipTextSelected,
                            ]}
                          >
                            {tweak}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={styles.actionsStack}>
                    <CouplyPrimaryButton
                      label="Share this suggestion in preview"
                      onPress={handleShareTweak}
                      style={styles.actionButton}
                    />
                    <CouplyQuietButton
                      label="Start this preview again"
                      variant="text"
                      onPress={handleResetAll}
                      style={styles.actionButton}
                    />
                  </View>
                </CouplySectionCard>
              )}

              {/* Recipient shared a tweak */}
              {responseState === "tweak_shared" && (
                <CouplySectionCard variant="lilac" style={styles.outcomeCard}>
                  <View style={styles.outcomeHeaderRow}>
                    <Text style={styles.outcomeEmoji}>💬</Text>
                    <Text style={styles.outcomeHeading}>
                      A gentle alternative is ready.
                    </Text>
                  </View>
                  <Text style={styles.outcomeBody}>
                    In this preview, {creatorLabel} would see your suggestion
                    and could take it from there.
                  </Text>
                  <View style={styles.selectedTweakBox}>
                    <Text style={styles.selectedTweakLabel}>
                      Suggested tweak:
                    </Text>
                    <Text style={styles.selectedTweakText}>
                      “{selectedTweak}”
                    </Text>
                  </View>
                  <View style={styles.truthfulBox}>
                    <Text style={styles.truthfulText}>
                      In this preview, this response only updates the current
                      browser session. Nothing has been shared or saved.
                    </Text>
                  </View>
                  <View style={styles.actionsStack}>
                    <CouplyPrimaryButton
                      label={`View as ${creatorLabel}`}
                      onPress={() => setPerspective("creator")}
                      style={styles.actionButton}
                    />
                    <CouplyQuietButton
                      label="Start this preview again"
                      variant="text"
                      onPress={handleResetAll}
                      style={styles.actionButton}
                    />
                  </View>
                </CouplySectionCard>
              )}

              {/* Recipient chose Not today */}
              {responseState === "not_today" && (
                <CouplySectionCard variant="muted" style={styles.outcomeCard}>
                  <View style={styles.outcomeHeaderRow}>
                    <Text style={styles.outcomeEmoji}>🌱</Text>
                    <Text style={styles.outcomeHeading}>Completely fine.</Text>
                  </View>
                  <Text style={styles.outcomeBody}>
                    Tiny invitations only work when declining is easy.
                  </Text>
                  <View style={styles.truthfulBox}>
                    <Text style={styles.truthfulText}>
                      In this preview, {creatorLabel} sees this as a gentle
                      pass. This response only updates the current browser
                      session. Nothing has been sent or saved.
                    </Text>
                  </View>
                  <View style={styles.actionsStack}>
                    <CouplyPrimaryButton
                      label={`View as ${creatorLabel}`}
                      onPress={() => setPerspective("creator")}
                      style={styles.actionButton}
                    />
                    <CouplyQuietButton
                      label="Start this preview again"
                      variant="text"
                      onPress={handleResetAll}
                      style={styles.actionButton}
                    />
                  </View>
                </CouplySectionCard>
              )}
            </View>
          ) : (
            /* CREATOR / SENDER VIEW */
            <View style={styles.stateContainer}>
              {/* Waiting quietly */}
              {responseState === "none" && (
                <CouplySectionCard variant="muted" style={styles.outcomeCard}>
                  <View style={styles.outcomeHeaderRow}>
                    <Text style={styles.outcomeEmoji}>⏳</Text>
                    <Text style={styles.outcomeHeading}>Waiting quietly</Text>
                  </View>
                  <Text style={styles.outcomeBody}>
                    {recipientCapitalized} can respond whenever it feels right,
                    or simply let it pass.
                  </Text>
                  <View style={styles.truthfulBox}>
                    <Text style={styles.truthfulText}>
                      No reminders, deadlines, or countdown timers are sent.
                    </Text>
                  </View>
                  <View style={styles.actionsStack}>
                    <CouplyQuietButton
                      label="Preview time passing quietly"
                      variant="soft"
                      onPress={handleTimePass}
                      style={styles.actionButton}
                    />
                    <CouplyQuietButton
                      label={`View as ${recipientCapitalized}`}
                      variant="soft"
                      onPress={() => setPerspective("recipient")}
                      style={styles.actionButton}
                    />
                  </View>
                </CouplySectionCard>
              )}

              {/* Time passed */}
              {responseState === "time_passed" && (
                <CouplySectionCard variant="muted" style={styles.outcomeCard}>
                  <View style={styles.outcomeHeaderRow}>
                    <Text style={styles.outcomeEmoji}>🌙</Text>
                    <Text style={styles.outcomeHeading}>
                      Time passed quietly
                    </Text>
                  </View>
                  <Text style={styles.outcomeBody}>
                    The timeframe passed without reminders, penalties, or
                    awkward follow-ups.
                  </Text>
                  <View style={styles.truthfulBox}>
                    <Text style={styles.truthfulText}>
                      This is only a local preview.
                    </Text>
                  </View>
                  <View style={styles.actionsStack}>
                    <CouplyQuietButton
                      label="Start this preview again"
                      variant="text"
                      onPress={handleResetAll}
                      style={styles.actionButton}
                    />
                  </View>
                </CouplySectionCard>
              )}

              {/* Sender sees partner is in */}
              {responseState === "in" && (
                <CouplySectionCard variant="lilac" style={styles.outcomeCard}>
                  <View style={styles.outcomeHeaderRow}>
                    <Text style={styles.outcomeEmoji}>🤝</Text>
                    <Text style={styles.outcomeHeading}>
                      {recipientCapitalized} is in.
                    </Text>
                  </View>
                  <Text style={styles.outcomeBody}>
                    You can enjoy a small shared reset whenever it feels right.
                  </Text>
                  <View style={styles.truthfulBox}>
                    <Text style={styles.truthfulText}>
                      In this preview, this response only updates the current
                      browser session. Shared moments feel lightest when both
                      feel free to choose them.
                    </Text>
                  </View>
                  <View style={styles.actionsStack}>
                    <CouplyPrimaryButton
                      label="✨ We did this together"
                      onPress={handleComplete}
                      style={styles.actionButton}
                    />
                    <CouplyQuietButton
                      label="Not this time"
                      variant="soft"
                      onPress={handleNotThisTime}
                      style={styles.actionButton}
                    />
                    <CouplyQuietButton
                      label="Start this preview again"
                      variant="text"
                      onPress={handleResetAll}
                      style={styles.actionButton}
                    />
                  </View>
                </CouplySectionCard>
              )}

              {/* Sender sees partner suggested a tweak */}
              {(responseState === "tweak_shared" ||
                responseState === "tweak_composing") && (
                <CouplySectionCard variant="lilac" style={styles.outcomeCard}>
                  <View style={styles.outcomeHeaderRow}>
                    <Text style={styles.outcomeEmoji}>💬</Text>
                    <Text style={styles.outcomeHeading}>
                      {recipientCapitalized} suggested a gentler version.
                    </Text>
                  </View>
                  <Text style={styles.outcomeBody}>
                    “{selectedTweak || "Tomorrow instead?"}”
                  </Text>
                  <View style={styles.truthfulBox}>
                    <Text style={styles.truthfulText}>
                      In this preview, this response only updates the current
                      browser session. You could decide whether it still feels
                      right.
                    </Text>
                  </View>
                  <View style={styles.actionsStack}>
                    <CouplyQuietButton
                      label="Start this preview again"
                      variant="text"
                      onPress={handleResetAll}
                      style={styles.actionButton}
                    />
                  </View>
                </CouplySectionCard>
              )}

              {/* Sender sees partner chose not today */}
              {responseState === "not_today" && (
                <CouplySectionCard variant="muted" style={styles.outcomeCard}>
                  <View style={styles.outcomeHeaderRow}>
                    <Text style={styles.outcomeEmoji}>🌱</Text>
                    <Text style={styles.outcomeHeading}>
                      {recipientCapitalized} chose not today.
                    </Text>
                  </View>
                  <Text style={styles.outcomeBody}>
                    That is completely okay. Shared moments stay light because
                    declining is easy.
                  </Text>
                  <View style={styles.truthfulBox}>
                    <Text style={styles.truthfulText}>
                      In this preview, this response only updates the current
                      browser session. Declining easily is what keeps invitations
                      safe to receive.
                    </Text>
                  </View>
                  <View style={styles.actionsStack}>
                    <CouplyQuietButton
                      label="Start this preview again"
                      variant="text"
                      onPress={handleResetAll}
                      style={styles.actionButton}
                    />
                  </View>
                </CouplySectionCard>
              )}
            </View>
          )}
        </View>
      </ScrollView>
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
  scrollContent: {
    paddingTop: tokens.spacing.md,
    paddingBottom: 48,
  },
  column: {
    maxWidth: tokens.layout.appShell,
    width: "100%",
    alignSelf: "center",
    gap: tokens.spacing.lg,
  },
  purposeCard: {
    gap: 6,
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
  },
  purposeOverline: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: tokens.colors.plum,
    textTransform: "uppercase",
  },
  purposeBody: {
    fontSize: tokens.typeScale.body,
    color: tokens.colors.text,
    lineHeight: 18,
  },
  purposeTruthfulBox: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  purposeTruthfulText: {
    fontSize: tokens.typeScale.overline + 0.5,
    color: tokens.colors.textMuted,
    lineHeight: 16,
  },
  perspectiveSection: {
    gap: 10,
    marginHorizontal: tokens.spacing.page,
  },
  perspectiveHeaderRow: {
    gap: 2,
  },
  perspectiveSectionTitle: {
    fontSize: tokens.typeScale.body,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: tokens.colors.text,
    textTransform: "uppercase",
  },
  perspectiveCaption: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
  },
  perspectiveCardsRow: {
    gap: 8,
  },
  perspectiveCard: {
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg - 2,
  },
  perspectiveEmoji: {
    fontSize: 18,
  },
  invitationCard: {
    gap: tokens.spacing.md,
  },
  invitationHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.md,
  },
  invitationIcon: {
    fontSize: 26,
    marginTop: 2,
  },
  invitationHeaderTextGroup: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  invitationOverline: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: tokens.colors.plum,
    textTransform: "uppercase",
  },
  invitationTitle: {
    fontSize: tokens.typeScale.sectionTitle + 1,
    fontWeight: "600",
    color: tokens.colors.text,
  },
  invitationSubtitle: {
    fontSize: tokens.typeScale.body,
    color: tokens.colors.textSecondary,
    lineHeight: 18,
  },
  lighterThoughtCard: {
    marginHorizontal: 0,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
  lighterThoughtHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  lighterThoughtOverline: {
    fontSize: tokens.typeScale.overline - 0.5,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: tokens.colors.plum,
    textTransform: "uppercase",
    flex: 1,
  },
  lighterThoughtText: {
    fontSize: tokens.typeScale.bodyLarge,
    fontStyle: "italic",
    color: tokens.colors.text,
    lineHeight: 20,
  },
  lighterThoughtSupport: {
    fontSize: tokens.typeScale.caption - 1,
    color: tokens.colors.textSecondary,
    lineHeight: 16,
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
    paddingTop: 4,
  },
  rewardSummaryContainer: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.radii.small,
    padding: tokens.spacing.sm,
    gap: tokens.spacing.sm,
    marginTop: 4,
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: tokens.spacing.sm,
  },
  rewardLeadEmoji: {
    fontSize: 18,
    marginTop: 1,
  },
  rewardTextCol: {
    flex: 1,
    gap: 1,
  },
  rewardRowHeading: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "700",
    color: tokens.colors.plum,
    textTransform: "uppercase",
  },
  rewardRowBody: {
    fontSize: tokens.typeScale.caption + 1,
    color: tokens.colors.text,
    lineHeight: 17,
  },
  stateContainer: {
    gap: tokens.spacing.md,
  },
  responseSectionCard: {
    gap: tokens.spacing.md,
  },
  recipientPromptTitle: {
    fontSize: tokens.typeScale.sectionTitle,
    fontWeight: "600",
    color: tokens.colors.text,
  },
  reassuranceBox: {
    backgroundColor: tokens.colors.surfaceMuted,
    padding: 10,
    borderRadius: tokens.radii.small,
  },
  reassuranceText: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
    lineHeight: 17,
  },
  choicesList: {
    gap: 8,
    marginTop: 4,
  },
  recipientChoiceCard: {
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg - 2,
  },
  choiceEmoji: {
    fontSize: 18,
  },
  outcomeCard: {
    gap: 10,
  },
  outcomeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  outcomeEmoji: {
    fontSize: 22,
  },
  outcomeHeading: {
    fontSize: tokens.typeScale.sectionTitle + 1,
    fontWeight: "600",
    color: tokens.colors.text,
  },
  outcomeBody: {
    fontSize: tokens.typeScale.body,
    color: tokens.colors.textSecondary,
    lineHeight: 19,
  },
  truthfulBox: {
    backgroundColor: tokens.colors.surfaceMuted,
    padding: 10,
    borderRadius: tokens.radii.small,
  },
  truthfulText: {
    fontSize: tokens.typeScale.caption - 0.5,
    color: tokens.colors.textSecondary,
    lineHeight: 16,
  },
  fallbackNoticeBox: {
    backgroundColor: tokens.colors.surfaceLilac,
    borderRadius: tokens.radii.small,
    padding: tokens.spacing.md,
    gap: 2,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  fallbackNoticeLabel: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "700",
    color: tokens.colors.plum,
    textTransform: "uppercase",
  },
  fallbackNoticeValue: {
    fontSize: tokens.typeScale.bodyLarge,
    fontWeight: "600",
    color: tokens.colors.text,
  },
  tweakList: {
    gap: 8,
    marginVertical: 4,
  },
  tweakChip: {
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: tokens.spacing.lg - 2,
    borderRadius: tokens.radii.card,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  tweakChipSelected: {
    borderColor: tokens.colors.plum,
    backgroundColor: tokens.colors.surfaceLilac,
  },
  tweakChipText: {
    fontSize: tokens.typeScale.body,
    color: tokens.colors.text,
  },
  tweakChipTextSelected: {
    fontWeight: "600",
    color: tokens.colors.plum,
  },
  selectedTweakBox: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.small,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    gap: 4,
  },
  selectedTweakLabel: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "700",
    color: tokens.colors.textMuted,
    textTransform: "uppercase",
  },
  selectedTweakText: {
    fontSize: tokens.typeScale.bodyLarge,
    fontWeight: "500",
    color: tokens.colors.text,
  },
  actionsStack: {
    gap: 8,
    marginTop: 6,
  },
  actionButton: {
    width: "100%",
  },
  outcomeTitleGroup: {
    flex: 1,
    gap: 2,
  },
  outcomeOverline: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "700",
    color: tokens.colors.plum,
    letterSpacing: 0.8,
  },
  challengeReferenceBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    backgroundColor: tokens.colors.surface,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radii.small,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  challengeReferenceEmoji: {
    fontSize: 20,
  },
  challengeReferenceTitle: {
    fontSize: tokens.typeScale.body,
    fontWeight: "600",
    color: tokens.colors.text,
    flex: 1,
  },
  completedRewardText: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.plum,
    fontWeight: "500",
  },
  memoryRitualCard: {
    backgroundColor: tokens.colors.surface,
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.card,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    gap: tokens.spacing.sm,
    marginTop: 4,
  },
  memoryRitualPrompt: {
    fontSize: tokens.typeScale.body,
    fontWeight: "600",
    color: tokens.colors.text,
  },
  reactionsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 4,
  },
  reactionChip: {
    minHeight: 38,
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: tokens.radii.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  reactionChipSelected: {
    borderColor: tokens.colors.plum,
    backgroundColor: tokens.colors.surfaceLilac,
  },
  reactionChipText: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.text,
  },
  reactionChipTextSelected: {
    fontWeight: "600",
    color: tokens.colors.plum,
  },
  customMemoryInput: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.small,
    padding: tokens.spacing.sm,
    fontSize: tokens.typeScale.caption + 1,
    color: tokens.colors.text,
    backgroundColor: tokens.colors.surfaceMuted,
    minHeight: 50,
    textAlignVertical: "top",
  },
  partnerMemoryPreviewBox: {
    backgroundColor: tokens.colors.surfaceLilac,
    padding: tokens.spacing.sm,
    borderRadius: tokens.radii.small,
    gap: 2,
  },
  partnerMemoryLabel: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "700",
    color: tokens.colors.plum,
    textTransform: "uppercase",
  },
  partnerMemoryQuote: {
    fontSize: tokens.typeScale.caption,
    fontWeight: "600",
    color: tokens.colors.text,
    fontStyle: "italic",
  },
  partnerMemoryNote: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
    lineHeight: 16,
  },
  memorySection: {
    marginVertical: 6,
    gap: 8,
  },
  memoryToggleButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: 9,
    paddingHorizontal: tokens.spacing.lg - 2,
    borderRadius: tokens.radii.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    alignSelf: "flex-start",
  },
  memoryToggleButtonActive: {
    borderColor: tokens.colors.plum,
    backgroundColor: tokens.colors.surfaceLilac,
  },
  memoryToggleText: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
    fontWeight: "500",
  },
  memoryToggleTextActive: {
    color: tokens.colors.plum,
    fontWeight: "600",
  },
  memoryCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.card,
    padding: tokens.spacing.lg - 2,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    gap: 8,
  },
  memoryCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  memoryDate: {
    fontSize: tokens.typeScale.overline + 0.5,
    color: tokens.colors.textMuted,
  },
  memoryTitle: {
    fontSize: tokens.typeScale.bodyLarge + 0.5,
    fontWeight: "600",
    color: tokens.colors.text,
  },
  memoryDetails: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
  },
  memoryTruthfulBox: {
    backgroundColor: tokens.colors.surfaceMuted,
    padding: tokens.spacing.sm,
    borderRadius: tokens.radii.small,
  },
  memoryTruthfulText: {
    fontSize: tokens.typeScale.overline,
    color: tokens.colors.textMuted,
    lineHeight: 15,
  },
});
};

