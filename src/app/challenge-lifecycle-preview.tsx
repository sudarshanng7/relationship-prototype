import {
  CouplyChoiceCard,
  CouplyHeader,
  CouplyPrimaryButton,
  CouplyQuietButton,
  CouplySectionCard,
  CouplyStatusPill,
} from "@/components/CouplyUI";
import { tokens } from "@/components/couply-tokens";
import { useChallengePreview } from "@/context/ChallengePreviewContext";
import { useUserIdentity } from "@/context/UserIdentityContext";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
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
  const { displayName, partnerName, partnerRef } = useUserIdentity();
  const { activeInvitation, updateInvitationStatus } = useChallengePreview();
  const params = useLocalSearchParams<{
    idea?: string;
    participant?: string;
    timeframe?: string;
    reward?: string;
    reframeTone?: string;
    reframeText?: string;
    shareReframe?: string;
    source?: string;
  }>();

  const isFromPreviewFlow =
    params.source === "home-preview" || params.source === "challenge-preview";
  const shouldUseActiveInvitation =
    Boolean(activeInvitation) && isFromPreviewFlow;

  const creatorLabel =
    shouldUseActiveInvitation && activeInvitation
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

  const displayTimeframe =
    shouldUseActiveInvitation && activeInvitation
      ? activeInvitation.timeframe
      : typeof params.timeframe === "string" &&
        params.timeframe.trim().length > 0
      ? params.timeframe
      : "Whenever / no rush";

  const displayReward =
    shouldUseActiveInvitation && activeInvitation
      ? activeInvitation.reward
      : typeof params.reward === "string" && params.reward.trim().length > 0
      ? params.reward
      : "No reward — just the moment";

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
  const [showSharedMemoryPreview, setShowSharedMemoryPreview] = useState(false);

  function handleResetAll() {
    setPerspective("recipient");
    setResponseState("none");
    setSelectedTweak(null);
    setIsCompleted(false);
    setShowSharedMemoryPreview(false);
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

  function handleComplete() {
    setIsCompleted(true);
    if (shouldUseActiveInvitation) {
      updateInvitationStatus("completed");
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
            title="A tiny invitation"
            subtitle="A local preview of how a small invitation can stay light for both people."
            onBack={handleBack}
            backLabel="‹ Back"
          />

          {/* Purpose notice */}
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

          {/* Perspective Switcher */}
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
              <CouplyStatusPill label={displayReward} variant="neutral" />
            </View>
          </CouplySectionCard>

          {/* COMPLETED STATE (both perspectives) */}
          {isCompleted ? (
            <CouplySectionCard variant="lilac" style={styles.outcomeCard}>
              <View style={styles.outcomeHeaderRow}>
                <Text style={styles.outcomeEmoji}>✨</Text>
                <Text style={styles.outcomeHeading}>A little win.</Text>
              </View>
              <Text style={styles.outcomeBody}>
                You two made a small moment feel lighter.
              </Text>

              {/* Keepsake memory preview */}
              <View style={styles.memorySection}>
                <Pressable
                  style={[
                    styles.memoryToggleButton,
                    showSharedMemoryPreview && styles.memoryToggleButtonActive,
                  ]}
                  onPress={() =>
                    setShowSharedMemoryPreview(!showSharedMemoryPreview)
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Preview as a shared good moment"
                >
                  <Text
                    style={[
                      styles.memoryToggleText,
                      showSharedMemoryPreview && styles.memoryToggleTextActive,
                    ]}
                  >
                    {showSharedMemoryPreview
                      ? "✓ Previewing shared good moment"
                      : "Preview as a shared good moment"}
                  </Text>
                </Pressable>

                {showSharedMemoryPreview && (
                  <View style={styles.memoryCard}>
                    <View style={styles.memoryCardHeader}>
                      <CouplyStatusPill
                        label="Ours · Shared"
                        variant="positive"
                      />
                      <Text style={styles.memoryDate}>Just now</Text>
                    </View>
                    <Text style={styles.memoryTitle}>{displayTitle}</Text>
                    <Text style={styles.memoryDetails}>
                      {displayContext} · completed together
                    </Text>
                    <View style={styles.memoryTruthfulBox}>
                      <Text style={styles.memoryTruthfulText}>
                        This is only a visual preview in this browser session.
                        No moment has been added to Our Space.
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.actionsStack}>
                <CouplyQuietButton
                  label={
                    perspective === "recipient"
                      ? `View as ${creatorLabel}`
                      : `View as ${recipientCapitalized}`
                  }
                  variant="soft"
                  onPress={() =>
                    setPerspective(
                      perspective === "recipient" ? "creator" : "recipient",
                    )
                  }
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
                      title="Not today"
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
                      label={`View as ${creatorLabel}`}
                      variant="soft"
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.pageBackground,
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
  tweakList: {
    gap: 8,
    marginVertical: 4,
  },
  tweakChip: {
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
  memorySection: {
    marginVertical: 6,
    gap: 8,
  },
  memoryToggleButton: {
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
