import { useChallengePreview } from "@/context/ChallengePreviewContext";
import { useUserIdentity } from "@/context/UserIdentityContext";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Perspective = "sam" | "alex";

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
      ? activeInvitation.creatorName || "You"
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

  const displayTitle = passedIdea || "Bring the mug home";
  const displayContext = passedIdea
    ? "A small reset chosen together"
    : "A warm drink together after a long day";

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
      : "Coffee together";

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

  const [perspective, setPerspective] = useState<Perspective>("sam");
  const [responseState, setResponseState] =
    useState<ResponseState>(initialResponseState);
  const [selectedTweak, setSelectedTweak] = useState<TweakOption | null>(null);
  const [isCompleted, setIsCompleted] = useState(initialCompleted);
  const [showSharedMemoryPreview, setShowSharedMemoryPreview] = useState(false);

  function handleResetAll() {
    setPerspective("sam");
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
            <Text style={styles.title}>A tiny invitation</Text>
            <Text style={styles.subtitle}>
              A local preview of how a small invitation can stay light for both
              people.
            </Text>
          </View>

          {/* Local-only dev preview notice */}
          <View style={styles.devNoticeCard}>
            <View style={styles.devNoticeBadge}>
              <Text style={styles.devNoticeBadgeText}>DEV PREVIEW</Text>
            </View>
            <Text style={styles.devNoticeText}>
              Everything on this screen is a local example. Nothing is sent,
              saved, or shown to {recipientLabel}.
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
              accessibilityLabel={`View as ${recipientCapitalized}: Receiving the invitation`}
            >
              <View style={styles.perspectiveHeaderRow}>
                <Text style={styles.perspectiveEmoji}>💌</Text>
                <Text
                  style={[
                    styles.perspectiveTitle,
                    perspective === "sam" && styles.perspectiveTitleSelected,
                  ]}
                >
                  Viewing as {recipientCapitalized}
                </Text>
              </View>
              <Text style={styles.perspectiveSubtext}>
                Receiving the invitation
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
              accessibilityLabel={`View as ${creatorLabel}: Seeing the outcome`}
            >
              <View style={styles.perspectiveHeaderRow}>
                <Text style={styles.perspectiveEmoji}>🙋</Text>
                <Text
                  style={[
                    styles.perspectiveTitle,
                    perspective === "alex" && styles.perspectiveTitleSelected,
                  ]}
                >
                  Viewing as {creatorLabel}
                </Text>
              </View>
              <Text style={styles.perspectiveSubtext}>Seeing the outcome</Text>
            </Pressable>
          </View>

          {/* 3. Shared sample invitation context card */}
          <View style={styles.invitationCard}>
            <View style={styles.invitationHeaderRow}>
              <View style={styles.invitationIconBubble}>
                <Text style={styles.invitationIconEmoji}>{displayIcon}</Text>
              </View>
              <View style={styles.invitationHeaderTextGroup}>
                <Text style={styles.invitationOverline}>
                  A tiny invitation from {creatorLabel}
                </Text>
                <Text style={styles.invitationTitle}>{displayTitle}</Text>
                <Text style={styles.invitationContext}>{displayContext}</Text>
              </View>
            </View>

            {shouldShowLighterThought && (
              <View style={styles.lighterThoughtCard}>
                <View style={styles.lighterThoughtHeaderRow}>
                  <Text style={styles.lighterThoughtOverline}>
                    A LIGHTER THOUGHT FROM {creatorLabel.toUpperCase()}
                  </Text>
                  {displayReframeTone.length > 0 && (
                    <View style={styles.lighterThoughtTonePill}>
                      <Text style={styles.lighterThoughtTonePillText}>
                        {displayReframeTone}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.lighterThoughtText}>
                  {displayReframeText}
                </Text>
                <Text style={styles.lighterThoughtSupportingNote}>
                  A warm angle shared with this invitation — not a criticism.
                </Text>
              </View>
            )}

            <View style={styles.invitationDivider} />

            <View style={styles.pillsRow}>
              <View style={styles.pillBadge}>
                <Text style={styles.pillBadgeText}>{displayTimeframe}</Text>
              </View>
              <View style={styles.pillBadge}>
                <Text style={styles.pillBadgeText}>{displayReward}</Text>
              </View>
            </View>
          </View>

          {/* ========================================================= */}
          {/* 9. Shared completion preview (Visible in both perspectives) */}
          {/* ========================================================= */}
          {isCompleted ? (
            <View style={styles.outcomeCard}>
              <View style={styles.outcomeHeaderRow}>
                <View style={styles.outcomeIconBubble}>
                  <Text style={styles.outcomeIconEmoji}>✨</Text>
                </View>
                <Text style={styles.outcomeHeading}>A little win.</Text>
              </View>

              <Text style={styles.outcomeBodyText}>
                You two made a small moment feel lighter.
              </Text>

              {/* Keepsake memory toggle */}
              <View style={styles.completionToggleSection}>
                <Pressable
                  style={[
                    styles.toggleButton,
                    showSharedMemoryPreview && styles.toggleButtonSelected,
                  ]}
                  onPress={() =>
                    setShowSharedMemoryPreview(!showSharedMemoryPreview)
                  }
                  accessibilityRole="button"
                  accessibilityState={{ selected: showSharedMemoryPreview }}
                  accessibilityLabel="Preview as a shared good moment"
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      showSharedMemoryPreview && styles.toggleButtonTextSelected,
                    ]}
                  >
                    {showSharedMemoryPreview
                      ? "✓ Previewing shared good moment"
                      : "Preview as a shared good moment"}
                  </Text>
                </Pressable>

                {showSharedMemoryPreview && (
                  <View style={styles.mockMemoryCard}>
                    <View style={styles.mockMemoryHeaderRow}>
                      <View style={styles.mockMemoryBadge}>
                        <Text style={styles.mockMemoryBadgeText}>
                          Ours · Shared
                        </Text>
                      </View>
                      <Text style={styles.mockMemoryDate}>Just now</Text>
                    </View>
                    <Text style={styles.mockMemoryTitle}>
                      {displayTitle}
                    </Text>
                    <Text style={styles.mockMemoryDetails}>
                      {displayContext} · completed together
                    </Text>
                    <View style={styles.mockMemoryNotice}>
                      <Text style={styles.mockMemoryNoticeText}>
                        This is only a visual preview. This completion only
                        updates the current browser session. No moment has been
                        added to Our Space.
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Perspective switch or reset */}
              <View style={styles.actionButtonGroup}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() =>
                    setPerspective(perspective === "sam" ? "alex" : "sam")
                  }
                  accessibilityRole="button"
                  accessibilityLabel={
                    perspective === "sam"
                      ? `View as ${creatorLabel}`
                      : `View as ${recipientCapitalized}`
                  }
                >
                  <Text style={styles.secondaryButtonText}>
                    {perspective === "sam"
                      ? `View as ${creatorLabel}`
                      : `View as ${recipientCapitalized}`}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.quietResetButton}
                  onPress={handleResetAll}
                  accessibilityRole="button"
                  accessibilityLabel="Start this preview again"
                >
                  <Text style={styles.quietResetButtonText}>
                    Start this preview again
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : perspective === "sam" ? (
            /* ========================================================= */
            /* 4, 5, 6, 7. SAM'S RECIPIENT VIEW                          */
            /* ========================================================= */
            <View style={styles.flowSection}>
              {responseState === "none" && (
                <View style={styles.responseContainer}>
                  <View style={styles.recipientPromptBlock}>
                    <Text style={styles.recipientHeadline}>
                      Up for a small reset together?
                    </Text>
                    <View style={styles.reassuranceCard}>
                      <Text style={styles.reassuranceText}>
                        Take your time. An invitation is never an obligation,
                        and choosing not today is always completely okay.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.responseButtonsRow}>
                    <Pressable
                      style={styles.primaryActionButton}
                      onPress={handleAccept}
                      accessibilityRole="button"
                      accessibilityLabel="Accept this tiny invitation"
                    >
                      <Text style={styles.primaryActionEmoji}>🤝</Text>
                      <Text style={styles.primaryActionButtonText}>I’m in</Text>
                    </Pressable>

                    <Pressable
                      style={styles.tweakActionButton}
                      onPress={handleStartTweak}
                      accessibilityRole="button"
                      accessibilityLabel="Suggest a gentler alternative"
                    >
                      <Text style={styles.tweakActionEmoji}>💬</Text>
                      <Text style={styles.tweakActionButtonText}>
                        Suggest a tweak
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.declineActionButton}
                      onPress={handleDecline}
                      accessibilityRole="button"
                      accessibilityLabel="Decline this invitation for now"
                    >
                      <Text style={styles.declineActionEmoji}>🌱</Text>
                      <Text style={styles.declineActionButtonText}>
                        Not today
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* 5. Sam accepts */}
              {responseState === "in" && (
                <View style={styles.outcomeCard}>
                  <View style={styles.outcomeHeaderRow}>
                    <View style={styles.outcomeIconBubble}>
                      <Text style={styles.outcomeIconEmoji}>🤝</Text>
                    </View>
                    <Text style={styles.outcomeHeading}>You’re in.</Text>
                  </View>

                  <Text style={styles.outcomeBodyText}>
                    Enjoy this little reset together whenever it feels right.
                  </Text>

                  <View style={styles.truthfulNoteBox}>
                    <Text style={styles.truthfulNoteText}>
                      In this preview, {creatorLabel} would see that you are open
                      to the idea. This response only updates the current browser
                      session.
                    </Text>
                  </View>

                  <View style={styles.actionButtonGroup}>
                    <Pressable
                      style={styles.primaryWideButton}
                      onPress={handleComplete}
                      accessibilityRole="button"
                      accessibilityLabel="We did this together: mark as completed"
                    >
                      <Text style={styles.primaryWideButtonText}>
                        ✨ We did this together
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => setPerspective("alex")}
                      accessibilityRole="button"
                      accessibilityLabel={`View as ${creatorLabel}`}
                    >
                      <Text style={styles.secondaryButtonText}>
                        View as {creatorLabel}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.quietResetButton}
                      onPress={handleResetAll}
                      accessibilityRole="button"
                      accessibilityLabel="Start this preview again"
                    >
                      <Text style={styles.quietResetButtonText}>
                        Start this preview again
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* 6. Sam suggests a tweak: composing */}
              {responseState === "tweak_composing" && (
                <View style={styles.outcomeCard}>
                  <View style={styles.outcomeHeaderRow}>
                    <View style={styles.outcomeIconBubble}>
                      <Text style={styles.outcomeIconEmoji}>💬</Text>
                    </View>
                    <Text style={styles.outcomeHeading}>
                      What would feel easier?
                    </Text>
                  </View>

                  <Text style={styles.outcomeBodyText}>
                    A tiny change can make an invitation feel more natural.
                  </Text>

                  <View style={styles.tweakChipsColumn}>
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

                  <View style={styles.actionButtonGroup}>
                    <Pressable
                      style={styles.primaryWideButton}
                      onPress={handleShareTweak}
                      accessibilityRole="button"
                      accessibilityLabel="Share this suggestion in preview"
                    >
                      <Text style={styles.primaryWideButtonText}>
                        Share this suggestion in preview
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.quietResetButton}
                      onPress={handleResetAll}
                      accessibilityRole="button"
                      accessibilityLabel="Start this preview again"
                    >
                      <Text style={styles.quietResetButtonText}>
                        Start this preview again
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* 6. Sam suggests a tweak: shared */}
              {responseState === "tweak_shared" && (
                <View style={styles.outcomeCard}>
                  <View style={styles.outcomeHeaderRow}>
                    <View style={styles.outcomeIconBubble}>
                      <Text style={styles.outcomeIconEmoji}>💬</Text>
                    </View>
                    <Text style={styles.outcomeHeading}>
                      A gentle alternative is ready.
                    </Text>
                  </View>

                  <Text style={styles.outcomeBodyText}>
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

                  <View style={styles.truthfulNoteBox}>
                    <Text style={styles.truthfulNoteText}>
                      In this preview, this response only updates the current
                      browser session. Nothing has been shared or saved.
                    </Text>
                  </View>

                  <View style={styles.actionButtonGroup}>
                    <Pressable
                      style={styles.primaryWideButton}
                      onPress={() => setPerspective("alex")}
                      accessibilityRole="button"
                      accessibilityLabel={`View as ${creatorLabel}`}
                    >
                      <Text style={styles.primaryWideButtonText}>
                        View as {creatorLabel}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.quietResetButton}
                      onPress={handleResetAll}
                      accessibilityRole="button"
                      accessibilityLabel="Start this preview again"
                    >
                      <Text style={styles.quietResetButtonText}>
                        Start this preview again
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* 7. Sam chooses Not today */}
              {responseState === "not_today" && (
                <View style={styles.outcomeCard}>
                  <View style={styles.outcomeHeaderRow}>
                    <View style={styles.outcomeIconBubble}>
                      <Text style={styles.outcomeIconEmoji}>🌱</Text>
                    </View>
                    <Text style={styles.outcomeHeading}>Completely fine.</Text>
                  </View>

                  <Text style={styles.outcomeBodyText}>
                    Tiny invitations only work when declining is easy.
                  </Text>

                  <View style={styles.truthfulNoteBox}>
                    <Text style={styles.truthfulNoteText}>
                      In this preview, {creatorLabel} sees this as a gentle
                      pass. This response only updates the current browser
                      session. Nothing has been sent or saved.
                    </Text>
                  </View>

                  <View style={styles.actionButtonGroup}>
                    <Pressable
                      style={styles.primaryWideButton}
                      onPress={() => setPerspective("alex")}
                      accessibilityRole="button"
                      accessibilityLabel={`View as ${creatorLabel}`}
                    >
                      <Text style={styles.primaryWideButtonText}>
                        View as {creatorLabel}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.quietResetButton}
                      onPress={handleResetAll}
                      accessibilityRole="button"
                      accessibilityLabel="Start this preview again"
                    >
                      <Text style={styles.quietResetButtonText}>
                        Start this preview again
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          ) : (
            /* ========================================================= */
            /* 8. ALEX'S SENDER VIEW                                     */
            /* ========================================================= */
            <View style={styles.flowSection}>
              {/* Default / no response */}
              {responseState === "none" && (
                <View style={styles.outcomeCard}>
                  <View style={styles.outcomeHeaderRow}>
                    <View style={styles.outcomeIconBubble}>
                      <Text style={styles.outcomeIconEmoji}>⏳</Text>
                    </View>
                    <Text style={styles.outcomeHeading}>Waiting quietly</Text>
                  </View>

                  <Text style={styles.outcomeBodyText}>
                    {recipientCapitalized} can respond whenever it feels right,
                    or simply let it pass.
                  </Text>

                  <View style={styles.truthfulNoteBox}>
                    <Text style={styles.truthfulNoteText}>
                      No reminders or countdown timers are sent.
                    </Text>
                  </View>

                  <View style={styles.actionButtonGroup}>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={handleTimePass}
                      accessibilityRole="button"
                      accessibilityLabel="Preview time passing quietly"
                    >
                      <Text style={styles.secondaryButtonText}>
                        Preview time passing quietly
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => setPerspective("sam")}
                      accessibilityRole="button"
                      accessibilityLabel={`View as ${recipientCapitalized}`}
                    >
                      <Text style={styles.secondaryButtonText}>
                        View as {recipientCapitalized}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Time passed */}
              {responseState === "time_passed" && (
                <View style={styles.outcomeCard}>
                  <View style={styles.outcomeHeaderRow}>
                    <View style={styles.outcomeIconBubble}>
                      <Text style={styles.outcomeIconEmoji}>🌙</Text>
                    </View>
                    <Text style={styles.outcomeHeading}>
                      Time passed quietly
                    </Text>
                  </View>

                  <Text style={styles.outcomeBodyText}>
                    The timeframe passed without reminders, penalties, or
                    awkward follow-ups.
                  </Text>

                  <View style={styles.truthfulNoteBox}>
                    <Text style={styles.truthfulNoteText}>
                      This is only a local preview.
                    </Text>
                  </View>

                  <View style={styles.actionButtonGroup}>
                    <Pressable
                      style={styles.quietResetButton}
                      onPress={handleResetAll}
                      accessibilityRole="button"
                      accessibilityLabel="Start this preview again"
                    >
                      <Text style={styles.quietResetButtonText}>
                        Start this preview again
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* After acceptance */}
              {responseState === "in" && (
                <View style={styles.outcomeCard}>
                  <View style={styles.outcomeHeaderRow}>
                    <View style={styles.outcomeIconBubble}>
                      <Text style={styles.outcomeIconEmoji}>🤝</Text>
                    </View>
                    <Text style={styles.outcomeHeading}>
                      {recipientCapitalized} is in.
                    </Text>
                  </View>

                  <Text style={styles.outcomeBodyText}>
                    You can enjoy a small shared reset whenever it feels right.
                  </Text>

                  <View style={styles.truthfulNoteBox}>
                    <Text style={styles.truthfulNoteText}>
                      In this preview, this response only updates the current
                      browser session. Shared moments feel lightest when both feel
                      free to choose them.
                    </Text>
                  </View>

                  <View style={styles.actionButtonGroup}>
                    <Pressable
                      style={styles.primaryWideButton}
                      onPress={handleComplete}
                      accessibilityRole="button"
                      accessibilityLabel="We did this together: mark as completed"
                    >
                      <Text style={styles.primaryWideButtonText}>
                        ✨ We did this together
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.quietResetButton}
                      onPress={handleResetAll}
                      accessibilityRole="button"
                      accessibilityLabel="Start this preview again"
                    >
                      <Text style={styles.quietResetButtonText}>
                        Start this preview again
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* After a tweak */}
              {(responseState === "tweak_shared" ||
                responseState === "tweak_composing") && (
                <View style={styles.outcomeCard}>
                  <View style={styles.outcomeHeaderRow}>
                    <View style={styles.outcomeIconBubble}>
                      <Text style={styles.outcomeIconEmoji}>💬</Text>
                    </View>
                    <Text style={styles.outcomeHeading}>
                      {recipientCapitalized} suggested a gentler version.
                    </Text>
                  </View>

                  <Text style={styles.outcomeBodyText}>
                    “{selectedTweak || "Tomorrow instead?"}”
                  </Text>

                  <View style={styles.truthfulNoteBox}>
                    <Text style={styles.truthfulNoteText}>
                      In this preview, this response only updates the current
                      browser session. You could decide whether it still feels
                      right.
                    </Text>
                  </View>

                  <View style={styles.actionButtonGroup}>
                    <Pressable
                      style={styles.quietResetButton}
                      onPress={handleResetAll}
                      accessibilityRole="button"
                      accessibilityLabel="Start this preview again"
                    >
                      <Text style={styles.quietResetButtonText}>
                        Start this preview again
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* After Not today */}
              {responseState === "not_today" && (
                <View style={styles.outcomeCard}>
                  <View style={styles.outcomeHeaderRow}>
                    <View style={styles.outcomeIconBubble}>
                      <Text style={styles.outcomeIconEmoji}>🌱</Text>
                    </View>
                    <Text style={styles.outcomeHeading}>
                      {recipientCapitalized} chose not today.
                    </Text>
                  </View>

                  <Text style={styles.outcomeBodyText}>
                    That is completely okay. Shared moments stay light because
                    declining is easy.
                  </Text>

                  <View style={styles.truthfulNoteBox}>
                    <Text style={styles.truthfulNoteText}>
                      In this preview, this response only updates the current
                      browser session. Declining easily is what keeps invitations
                      safe to receive.
                    </Text>
                  </View>

                  <View style={styles.actionButtonGroup}>
                    <Pressable
                      style={styles.quietResetButton}
                      onPress={handleResetAll}
                      accessibilityRole="button"
                      accessibilityLabel="Start this preview again"
                    >
                      <Text style={styles.quietResetButtonText}>
                        Start this preview again
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Bottom spacer */}
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 60,
  },
  column: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    gap: 18,
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
  perspectiveContainer: {
    flexDirection: "row",
    gap: 10,
  },
  perspectiveCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    gap: 4,
  },
  perspectiveCardSelected: {
    backgroundColor: "#FBEFF7",
    borderColor: "#6E416D",
  },
  perspectiveHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  perspectiveEmoji: {
    fontSize: 14,
  },
  perspectiveTitle: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#3D3040",
  },
  perspectiveTitleSelected: {
    fontWeight: "700",
    color: "#6E416D",
  },
  perspectiveSubtext: {
    fontSize: 11.5,
    color: "#8E7E94",
  },
  invitationCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    gap: 12,
  },
  invitationHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  invitationIconBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F8F3F9",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  invitationIconEmoji: {
    fontSize: 18,
  },
  invitationHeaderTextGroup: {
    flex: 1,
    gap: 3,
  },
  invitationOverline: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E7E94",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  invitationTitle: {
    fontSize: 16.5,
    fontWeight: "700",
    color: "#3D3040",
  },
  invitationContext: {
    fontSize: 13,
    color: "#6D6072",
    lineHeight: 18,
  },
  invitationDivider: {
    height: 1,
    backgroundColor: "#F4EDF6",
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pillBadge: {
    backgroundColor: "#FBF7FC",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0E4F1",
  },
  pillBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6E416D",
  },
  flowSection: {
    gap: 16,
  },
  recipientPromptBlock: {
    gap: 8,
  },
  recipientHeadline: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3D3040",
    letterSpacing: -0.2,
  },
  reassuranceCard: {
    backgroundColor: "#FAF5FB",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F0E4F1",
  },
  reassuranceText: {
    fontSize: 13,
    color: "#6D6072",
    lineHeight: 18,
  },
  responseContainer: {
    gap: 14,
  },
  responseButtonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  primaryActionButton: {
    flex: 1.2,
    backgroundColor: "#6E416D",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  primaryActionEmoji: {
    fontSize: 14,
  },
  primaryActionButtonText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  tweakActionButton: {
    flex: 1.5,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  tweakActionEmoji: {
    fontSize: 14,
  },
  tweakActionButtonText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#6E416D",
  },
  declineActionButton: {
    flex: 1.1,
    backgroundColor: "#FBF7FC",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  declineActionEmoji: {
    fontSize: 13,
  },
  declineActionButtonText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#6D6072",
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1EDF7",
    alignItems: "center",
    justifyContent: "center",
  },
  outcomeIconEmoji: {
    fontSize: 17,
  },
  outcomeHeading: {
    fontSize: 16.5,
    fontWeight: "700",
    color: "#3D3040",
  },
  outcomeBodyText: {
    fontSize: 14,
    color: "#3D3040",
    lineHeight: 21,
  },
  truthfulNoteBox: {
    backgroundColor: "#FBF7FC",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#F0E4F1",
  },
  truthfulNoteText: {
    fontSize: 12.5,
    color: "#6D6072",
    lineHeight: 17,
    fontStyle: "italic",
  },
  selectedTweakBox: {
    backgroundColor: "#FAF5FB",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F0E4F1",
    gap: 4,
  },
  selectedTweakLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#8E7E94",
    textTransform: "uppercase",
  },
  selectedTweakText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6E416D",
  },
  tweakChipsColumn: {
    gap: 8,
    marginVertical: 4,
  },
  tweakChip: {
    backgroundColor: "#FBF7FC",
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
  },
  tweakChipSelected: {
    backgroundColor: "#FBEFF7",
    borderColor: "#6E416D",
  },
  tweakChipText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#6D6072",
  },
  tweakChipTextSelected: {
    color: "#6E416D",
    fontWeight: "700",
  },
  actionButtonGroup: {
    gap: 8,
    marginTop: 4,
  },
  primaryWideButton: {
    backgroundColor: "#6E416D",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryWideButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#6E416D",
  },
  quietResetButton: {
    backgroundColor: "#F8F3F9",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E5DAE6",
    alignItems: "center",
    justifyContent: "center",
  },
  quietResetButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6E416D",
  },
  completionToggleSection: {
    gap: 10,
    marginTop: 4,
  },
  toggleButton: {
    backgroundColor: "#FBF7FC",
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    alignItems: "center",
    justifyContent: "center",
  },
  toggleButtonSelected: {
    backgroundColor: "#FBEFF7",
    borderColor: "#6E416D",
  },
  toggleButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6D6072",
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
    marginTop: 2,
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
  bottomSpacer: {
    height: 10,
  },
  lighterThoughtCard: {
    backgroundColor: "#FDF8FC",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EADEEB",
    gap: 6,
  },
  lighterThoughtHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  lighterThoughtOverline: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8B6B92",
    letterSpacing: 0.5,
  },
  lighterThoughtTonePill: {
    backgroundColor: "#F3E7F2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  lighterThoughtTonePillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6E416D",
  },
  lighterThoughtText: {
    fontSize: 14,
    color: "#3D3040",
    lineHeight: 20,
    fontStyle: "italic",
  },
  lighterThoughtSupportingNote: {
    fontSize: 11.5,
    color: "#857388",
    lineHeight: 16,
  },
});
