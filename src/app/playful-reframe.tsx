import { useUserIdentity } from "@/context/UserIdentityContext";
import { useRouter } from "expo-router";
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

type SampleKey = "coffee_mug" | "socks" | "directions";
type ConsentChoice = "pending" | "try" | "not_today";
type ToneKey = "gentle" | "playful" | "exaggerated";
type ParticipantKey = "me" | "sam" | "both";
type TimeframeKey = "Today" | "Tomorrow" | "This weekend";

interface ChallengeIdea {
  title: string;
  icon: string;
  description: string;
}

interface IrritationPreset {
  key: SampleKey;
  label: string;
  emoji: string;
  reframes: Record<
    ToneKey,
    {
      toneLabel: string;
      icon: string;
      text: string;
    }
  >;
  challenges: ChallengeIdea[];
}

const SAMPLE_IRRITATIONS: IrritationPreset[] = [
  {
    key: "coffee_mug",
    label: "The unwashed coffee mug",
    emoji: "☕",
    reframes: {
      gentle: {
        toneLabel: "Gentle and cute",
        icon: "🌷",
        text: "One little mug is waiting for its journey home.",
      },
      playful: {
        toneLabel: "More playful",
        icon: "🏛️",
        text: "The kitchen museum has acquired a new exhibit: Mug, Untouched.",
      },
      exaggerated: {
        toneLabel: "Slightly exaggerated",
        icon: "📢",
        text: "Alert: the mug has declared independence from the dishwasher.",
      },
    },
    challenges: [
      {
        title: "Bring the mug home",
        icon: "☕",
        description: "A gentle 30-second return of the wanderer to the sink.",
      },
      {
        title: "A five-minute kitchen reset",
        icon: "⏱️",
        description: "Quick, quiet teamwork before sitting down together.",
      },
      {
        title: "Make a coffee together",
        icon: "✨",
        description: "Turn the wandering mug into a warm, shared moment.",
      },
    ],
  },
  {
    key: "socks",
    label: "The disappearing socks",
    emoji: "🧦",
    reframes: {
      gentle: {
        toneLabel: "Gentle and cute",
        icon: "🌸",
        text: "A lonely sock looking for its missing twin.",
      },
      playful: {
        toneLabel: "More playful",
        icon: "🧺",
        text: "The dryer has accepted its customary tax of one single sock.",
      },
      exaggerated: {
        toneLabel: "Slightly exaggerated",
        icon: "🌀",
        text: "Breaking news: secret underground sock portal discovered in laundry room.",
      },
    },
    challenges: [
      {
        title: "A tiny sock rescue",
        icon: "🧦",
        description: "Rescuing rogue socks before the dryer claims another.",
      },
      {
        title: "Find one matching pair",
        icon: "🔍",
        description: "One small victory for the sock drawer.",
      },
      {
        title: "Fold a small pile together",
        icon: "🧺",
        description: "Lighthearted chatting while folding a tiny pile.",
      },
    ],
  },
  {
    key: "directions",
    label: "The direction debate",
    emoji: "🧭",
    reframes: {
      gentle: {
        toneLabel: "Gentle and cute",
        icon: "🗺️",
        text: "Two explorers with two slightly different maps.",
      },
      playful: {
        toneLabel: "More playful",
        icon: "🚗",
        text: "Taking the scenic detour to test the car’s suspension.",
      },
      exaggerated: {
        toneLabel: "Slightly exaggerated",
        icon: "🗳️",
        text: "The GPS was politely voted out by the executive passenger council.",
      },
    },
    challenges: [
      {
        title: "Let the next route be a surprise",
        icon: "🎲",
        description: "Embrace the scenic route without checking the ETA.",
      },
      {
        title: "Take a five-minute walking reset",
        icon: "🚶",
        description: "Fresh air and moving forward side-by-side.",
      },
      {
        title: "Pick the playlist together",
        icon: "🎵",
        description: "Good tunes to smooth out any bumpy journey.",
      },
    ],
  },
];

const CUSTOM_REFRAMES: Record<
  ToneKey,
  { toneLabel: string; icon: string; text: string }
> = {
  gentle: {
    toneLabel: "Gentle and cute",
    icon: "🌱",
    text: "A small moment that just needs a quiet breath and a little kindness.",
  },
  playful: {
    toneLabel: "More playful",
    icon: "🎭",
    text: "A classic plot twist in today's shared domestic adventure.",
  },
  exaggerated: {
    toneLabel: "Slightly exaggerated",
    icon: "🔭",
    text: "Scientists confirm this domestic anomaly is officially unprecedented in history.",
  },
};

const CUSTOM_CHALLENGES: ChallengeIdea[] = [
  {
    title: "A five-minute quiet reset together",
    icon: "🌱",
    description: "Pause, breathe, and reset the mood together quietly.",
  },
  {
    title: "A gentle pause and a deep breath",
    icon: "☕",
    description: "Step away for a minute and return with a soft smile.",
  },
  {
    title: "Make a cup of tea together",
    icon: "🫖",
    description: "A small warm gesture to reset and reconnect.",
  },
];

const PARTICIPANT_OPTIONS: {
  key: ParticipantKey;
  label: string;
  icon: string;
}[] = [
  { key: "me", label: "For me", icon: "🙋" },
  { key: "sam", label: "Invite partner", icon: "💌" },
  { key: "both", label: "Both of us", icon: "🤝" },
];

const REWARD_OPTIONS = [
  { label: "No reward", icon: "🌱" },
  { label: "Coffee together", icon: "☕" },
  { label: "Pick tonight’s film", icon: "🎬" },
  { label: "A relaxed five minutes", icon: "🛋️" },
];

const TIMEFRAME_OPTIONS: TimeframeKey[] = [
  "Today",
  "Tomorrow",
  "This weekend",
];

export default function PlayfulReframeScreen() {
  const router = useRouter();
  const { partnerName, partnerRef } = useUserIdentity();

  const participantOptions = [
    { key: "me" as ParticipantKey, label: "For me", icon: "🙋" },
    {
      key: "sam" as ParticipantKey,
      label: partnerName ? `Invite ${partnerName}` : "Invite partner",
      icon: "💌",
    },
    { key: "both" as ParticipantKey, label: "Both of us", icon: "🤝" },
  ];

  const [selectedSampleKey, setSelectedSampleKey] =
    useState<SampleKey>("coffee_mug");
  const [customText, setCustomText] = useState("");
  const [consentChoice, setConsentChoice] = useState<ConsentChoice>("pending");
  const [selectedTone, setSelectedTone] = useState<ToneKey | null>(null);

  // Challenge Builder Preview State (Local Only)
  const [showChallengeBuilder, setShowChallengeBuilder] = useState(false);
  const [challengeDeclined, setChallengeDeclined] = useState(false);
  const [participantChoice, setParticipantChoice] =
    useState<ParticipantKey | null>(null);
  const [selectedIdea, setSelectedIdea] = useState<string | null>(null);
  const [selectedReward, setSelectedReward] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] =
    useState<TimeframeKey | null>(null);
  const [shareLighterThought, setShareLighterThought] = useState(false);
  const [lighterThoughtCustomText, setLighterThoughtCustomText] = useState<
    string | null
  >(null);

  const isCustomActive = customText.trim().length > 0;
  const currentPreset = SAMPLE_IRRITATIONS.find(
    (item) => item.key === selectedSampleKey,
  )!;

  const currentReframes = isCustomActive
    ? CUSTOM_REFRAMES
    : currentPreset.reframes;

  const currentChallenges = isCustomActive
    ? CUSTOM_CHALLENGES
    : currentPreset.challenges;

  const selectedReframe = selectedTone ? currentReframes[selectedTone] : null;
  const selectedToneLabel = selectedReframe?.toneLabel ?? "";
  const selectedReframeSentence = selectedReframe?.text ?? "";
  const effectiveLighterThought =
    lighterThoughtCustomText !== null
      ? lighterThoughtCustomText
      : selectedReframeSentence;

  function getStarterIdea(): string {
    if (isCustomActive) {
      return "Take a five-minute quiet pause together";
    }
    switch (selectedSampleKey) {
      case "coffee_mug":
        return "Have a tea or coffee together";
      case "socks":
        return "Find one matching pair together";
      case "directions":
        return "Take a five-minute walking reset";
      default:
        return "Take a five-minute quiet pause together";
    }
  }

  function handleResetAll() {
    setSelectedSampleKey("coffee_mug");
    setCustomText("");
    setConsentChoice("pending");
    setSelectedTone(null);
    setShowChallengeBuilder(false);
    setChallengeDeclined(false);
    setParticipantChoice(null);
    setSelectedIdea(null);
    setSelectedReward(null);
    setSelectedTimeframe(null);
    setShareLighterThought(false);
    setLighterThoughtCustomText(null);
  }

  function handleTryAnotherTone() {
    setSelectedTone(null);
    setShowChallengeBuilder(false);
    setChallengeDeclined(false);
    setParticipantChoice(null);
    setSelectedIdea(null);
    setSelectedReward(null);
    setSelectedTimeframe(null);
    setShareLighterThought(false);
    setLighterThoughtCustomText(null);
  }

  function handleEditChallengeChoices() {
    setParticipantChoice(null);
    setSelectedIdea(null);
    setSelectedReward(null);
    setSelectedTimeframe(null);
  }

  function handleCloseChallengeBuilder() {
    setShowChallengeBuilder(false);
    setChallengeDeclined(true);
    setParticipantChoice(null);
    setSelectedIdea(null);
    setSelectedReward(null);
    setSelectedTimeframe(null);
    setShareLighterThought(false);
    setLighterThoughtCustomText(null);
  }

  const isChallengeFullyConfigured =
    participantChoice !== null &&
    selectedIdea !== null &&
    selectedReward !== null &&
    selectedTimeframe !== null;

  const previewHeading =
    participantChoice === "me"
      ? "Your small reset"
      : participantChoice === "sam"
      ? `What ${partnerName || "your partner"} would see`
      : "Your shared little reset";

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

          {/* Header */}
          <View style={styles.headerBlock}>
            <Text style={styles.title}>Playful reframe</Text>
            <Text style={styles.subtitle}>
              A lighthearted way to look at a small everyday irritation.
            </Text>
          </View>

          {/* Privacy reassurance card */}
          <View style={styles.privacyCard}>
            <View style={styles.privacyIconBubble}>
              <Text style={styles.privacyIconText}>🔒</Text>
            </View>
            <View style={styles.privacyTextGroup}>
              <Text style={styles.privacyHeading}>Private space</Text>
              <Text style={styles.privacyText}>
                This starts privately. Nothing is shared unless you choose it.
              </Text>
              <Text style={styles.previewNoticeText}>
                Preview only — nothing here is saved or sent.
              </Text>
            </View>
          </View>

          {/* Step 1: Irritation chooser */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Choose a tiny irritation</Text>
            <Text style={styles.sectionSubtitle}>
              Pick a classic everyday scenario or describe your own.
            </Text>

            <View style={styles.presetOptionsContainer}>
              {SAMPLE_IRRITATIONS.map((preset) => {
                const isSelected =
                  !isCustomActive && selectedSampleKey === preset.key;
                return (
                  <Pressable
                    key={preset.key}
                    style={[
                      styles.presetCard,
                      isSelected && styles.presetCardSelected,
                    ]}
                    onPress={() => {
                      setCustomText("");
                      setSelectedSampleKey(preset.key);
                      setSelectedTone(null);
                      setShowChallengeBuilder(false);
                      setChallengeDeclined(false);
                      setParticipantChoice(null);
                      setSelectedIdea(null);
                      setSelectedReward(null);
                      setSelectedTimeframe(null);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={preset.label}
                  >
                    <View
                      style={[
                        styles.presetIconBubble,
                        isSelected && styles.presetIconBubbleSelected,
                      ]}
                    >
                      <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                    </View>
                    <Text
                      style={[
                        styles.presetCardLabel,
                        isSelected && styles.presetCardLabelSelected,
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Custom text input */}
            <View style={styles.customInputBlock}>
              <Text style={styles.inputLabel}>Or describe it your way</Text>
              <TextInput
                style={styles.textInput}
                value={customText}
                onChangeText={(text) => {
                  setCustomText(text);
                  setSelectedTone(null);
                  setShowChallengeBuilder(false);
                  setChallengeDeclined(false);
                  setParticipantChoice(null);
                  setSelectedIdea(null);
                  setSelectedReward(null);
                  setSelectedTimeframe(null);
                }}
                placeholder="What happened?"
                placeholderTextColor="#9A8D9D"
                multiline
              />
              <Text style={styles.inputHelperText}>
                Preview only — this is not saved.
              </Text>
            </View>
          </View>

          {/* Step 2: Gentle consent step */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>
              Would a light reframe feel right?
            </Text>
            <Text style={styles.sectionSubtitle}>
              Some things need care, not humour. You can always keep this
              private.
            </Text>

            <View style={styles.consentButtonsRow}>
              <Pressable
                style={[
                  styles.consentButton,
                  consentChoice === "try" && styles.consentButtonSelected,
                ]}
                onPress={() => {
                  setConsentChoice("try");
                  setSelectedTone(null);
                  setShowChallengeBuilder(false);
                  setChallengeDeclined(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: consentChoice === "try" }}
                accessibilityLabel="Try a playful reframe"
              >
                <Text
                  style={[
                    styles.consentButtonText,
                    consentChoice === "try" && styles.consentButtonTextSelected,
                  ]}
                >
                  Try a playful reframe
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.consentButton,
                  consentChoice === "not_today" && styles.consentButtonSelected,
                ]}
                onPress={() => {
                  setConsentChoice("not_today");
                  setSelectedTone(null);
                  setShowChallengeBuilder(false);
                  setChallengeDeclined(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: consentChoice === "not_today" }}
                accessibilityLabel="Not today"
              >
                <Text
                  style={[
                    styles.consentButtonText,
                    consentChoice === "not_today" &&
                      styles.consentButtonTextSelected,
                  ]}
                >
                  Not today
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Outcome A: "Not today" selected */}
          {consentChoice === "not_today" && (
            <View style={styles.notTodayCard}>
              <Text style={styles.notTodayTitle}>
                That is completely okay. You can keep this thought to yourself.
              </Text>
              <Text style={styles.notTodaySubtitle}>
                Not every moment is meant to be reframed. Giving yourself space
                is always valid.
              </Text>
              <Pressable
                style={styles.quietResetButton}
                onPress={handleResetAll}
                accessibilityRole="button"
                accessibilityLabel="Start again"
              >
                <Text style={styles.quietResetButtonText}>Start again</Text>
              </Pressable>
            </View>
          )}

          {/* Outcome B: "Try a playful reframe" selected */}
          {consentChoice === "try" && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Choose a gentle tone</Text>
              <Text style={styles.sectionSubtitle}>
                Pick the perspective that feels easiest to smile at.
              </Text>

              <View style={styles.reframeCardsContainer}>
                {(["gentle", "playful", "exaggerated"] as const).map(
                  (toneKey) => {
                    const item = currentReframes[toneKey];
                    const isSelected = selectedTone === toneKey;

                    return (
                      <Pressable
                        key={toneKey}
                        style={[
                          styles.reframeCard,
                          isSelected && styles.reframeCardSelected,
                        ]}
                        onPress={() => {
                          setSelectedTone(toneKey);
                          setShowChallengeBuilder(false);
                          setChallengeDeclined(false);
                          setShareLighterThought(false);
                          setLighterThoughtCustomText(null);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={`${item.toneLabel}: ${item.text}`}
                      >
                        <View style={styles.reframeCardHeader}>
                          <View
                            style={[
                              styles.reframeIconBubble,
                              isSelected && styles.reframeIconBubbleSelected,
                            ]}
                          >
                            <Text style={styles.reframeIcon}>{item.icon}</Text>
                          </View>
                          <Text
                            style={[
                              styles.reframeToneLabel,
                              isSelected && styles.reframeToneLabelSelected,
                            ]}
                          >
                            {item.toneLabel}
                          </Text>
                        </View>
                        <Text style={styles.reframeBodyText}>{item.text}</Text>
                      </Pressable>
                    );
                  },
                )}
              </View>

              {/* Selected reframe confirmation / outcome card */}
              {selectedTone !== null && (
                <View style={styles.outcomeCard}>
                  <Text style={styles.outcomeHeading}>
                    A lighter way to see it.
                  </Text>
                  <Text style={styles.outcomeSubtext}>
                    This doesn’t mean your feeling wasn’t real. It is simply one
                    gentle angle to smile at. Nothing is saved or shared.
                  </Text>
                  <View style={styles.outcomeNoteBox}>
                    <Text style={styles.outcomeNoteText}>
                      A playful reframe is never a way to ignore what matters.
                      It simply offers a soft pause before moving forward.
                    </Text>
                  </View>

                  <View style={styles.outcomeActionsRow}>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={handleTryAnotherTone}
                      accessibilityRole="button"
                      accessibilityLabel="Try another tone"
                    >
                      <Text style={styles.secondaryButtonText}>
                        Try another tone
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.quietResetSmallButton}
                      onPress={handleResetAll}
                      accessibilityRole="button"
                      accessibilityLabel="Start over"
                    >
                      <Text style={styles.quietResetSmallText}>Start over</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Step 1 of Tiny Challenge: Optional Entry Point Prompt */}
              {selectedTone !== null &&
                !showChallengeBuilder &&
                !challengeDeclined && (
                  <View style={styles.challengeInviteCard}>
                    <View style={styles.challengeInviteHeaderRow}>
                      <View style={styles.challengeInviteIconBubble}>
                        <Text style={styles.challengeInviteEmoji}>✨</Text>
                      </View>
                      <View style={styles.challengeInviteHeaderTextGroup}>
                        <Text style={styles.challengeInviteHeading}>
                          Up for a tiny challenge?
                        </Text>
                        <Text style={styles.challengeInviteSubtext}>
                          Only if it feels light and kind. You can stop here
                          anytime.
                        </Text>
                      </View>
                    </View>

                    <View style={styles.challengeInviteActionsRow}>
                      <Pressable
                        style={styles.challengePrimaryInviteButton}
                        onPress={() => setShowChallengeBuilder(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Explore tiny challenge"
                      >
                        <Text style={styles.challengePrimaryInviteButtonText}>
                          Up for a tiny challenge?
                        </Text>
                      </Pressable>

                      <Pressable
                        style={styles.challengeQuietDismissButton}
                        onPress={handleCloseChallengeBuilder}
                        accessibilityRole="button"
                        accessibilityLabel="Not now"
                      >
                        <Text style={styles.challengeQuietDismissText}>
                          Not now
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}

              {/* Step 2 to 6: Tiny Challenge Builder Preview Section */}
              {selectedTone !== null && showChallengeBuilder && (
                <View style={styles.challengeBuilderSection}>
                  <View style={styles.challengeBuilderHeaderRow}>
                    <View style={styles.challengeSectionBadge}>
                      <Text style={styles.challengeSectionBadgeText}>
                        Preview
                      </Text>
                    </View>
                    <Pressable
                      style={styles.challengeBuilderCloseButton}
                      onPress={handleCloseChallengeBuilder}
                      accessibilityRole="button"
                      accessibilityLabel="Close challenge builder"
                    >
                      <Text style={styles.challengeBuilderCloseText}>
                        Not now
                      </Text>
                    </Pressable>
                  </View>

                  {/* 2. Participation choice */}
                  <View style={styles.challengeBlock}>
                    <Text style={styles.challengeSectionTitle}>
                      Who is this little reset for?
                    </Text>
                    <Text style={styles.challengeSectionSubtitle}>
                      An invitation is always optional. It is never a task for
                      someone else to complete.
                    </Text>

                    <View style={styles.participantsRow}>
                      {participantOptions.map((item) => {
                        const isSelected = participantChoice === item.key;
                        return (
                          <Pressable
                            key={item.key}
                            style={[
                              styles.participantCard,
                              isSelected && styles.participantCardSelected,
                            ]}
                            onPress={() => {
                              setParticipantChoice(item.key);
                              setSelectedIdea(null);
                              setSelectedReward(null);
                              setSelectedTimeframe(null);
                            }}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                            accessibilityLabel={item.label}
                          >
                            <Text style={styles.participantEmoji}>
                              {item.icon}
                            </Text>
                            <Text
                              style={[
                                styles.participantLabel,
                                isSelected && styles.participantLabelSelected,
                              ]}
                            >
                              {item.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {/* 3. Safe preset challenge ideas */}
                  {participantChoice !== null && (
                    <View style={styles.challengeBlock}>
                      <Text style={styles.challengeSectionTitle}>
                        Choose a tiny idea
                      </Text>
                      <Text style={styles.challengeSectionSubtitle}>
                        Small, kind, and easy to decline.
                      </Text>

                      <View style={styles.challengeIdeasContainer}>
                        {currentChallenges.map((idea) => {
                          const isSelected = selectedIdea === idea.title;
                          return (
                            <Pressable
                              key={idea.title}
                              style={[
                                styles.challengeIdeaCard,
                                isSelected && styles.challengeIdeaCardSelected,
                              ]}
                              onPress={() => {
                                setSelectedIdea(idea.title);
                                setSelectedReward(null);
                                setSelectedTimeframe(null);
                              }}
                              accessibilityRole="button"
                              accessibilityState={{ selected: isSelected }}
                              accessibilityLabel={`${idea.title}: ${idea.description}`}
                            >
                              <View
                                style={[
                                  styles.challengeIdeaIconBubble,
                                  isSelected &&
                                    styles.challengeIdeaIconBubbleSelected,
                                ]}
                              >
                                <Text style={styles.challengeIdeaEmoji}>
                                  {idea.icon}
                                </Text>
                              </View>
                              <View style={styles.challengeIdeaTextCol}>
                                <Text
                                  style={[
                                    styles.challengeIdeaTitle,
                                    isSelected &&
                                      styles.challengeIdeaTitleSelected,
                                  ]}
                                >
                                  {idea.title}
                                </Text>
                                <Text style={styles.challengeIdeaDesc}>
                                  {idea.description}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}

                        <Pressable
                          style={styles.customChallengeBridgeCard}
                          onPress={() => {
                            router.push({
                              pathname: "/make-challenge-preview",
                              params: {
                                idea: getStarterIdea(),
                                participant: participantChoice ?? "sam",
                                source: "reframe",
                                reframeTone: selectedToneLabel,
                                reframeText: selectedReframeSentence,
                                shareReframe: "false",
                              },
                            } as any);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel="Make your own tiny challenge with playful reframe context"
                        >
                          <View style={styles.customChallengeBridgeIconBubble}>
                            <Text style={styles.customChallengeBridgeEmoji}>
                              ✍️
                            </Text>
                          </View>
                          <View style={styles.customChallengeBridgeTextCol}>
                            <Text style={styles.customChallengeBridgeTitle}>
                              Make your own tiny challenge ›
                            </Text>
                            <Text style={styles.customChallengeBridgeDesc}>
                              Write a small reset that fits your home today.
                            </Text>
                          </View>
                        </Pressable>
                      </View>
                    </View>
                  )}

                  {/* 4. Optional reward */}
                  {selectedIdea !== null && (
                    <View style={styles.challengeBlock}>
                      <Text style={styles.challengeSectionTitle}>
                        Add a small shared reward?
                      </Text>
                      <Text style={styles.challengeSectionSubtitle}>
                        Optional — the moment matters more than completing a
                        task.
                      </Text>

                      <View style={styles.rewardsRowWrap}>
                        {REWARD_OPTIONS.map((reward) => {
                          const isSelected = selectedReward === reward.label;
                          return (
                            <Pressable
                              key={reward.label}
                              style={[
                                styles.rewardChip,
                                isSelected && styles.rewardChipSelected,
                              ]}
                              onPress={() => {
                                setSelectedReward(reward.label);
                                setSelectedTimeframe(null);
                              }}
                              accessibilityRole="button"
                              accessibilityState={{ selected: isSelected }}
                              accessibilityLabel={reward.label}
                            >
                              <Text style={styles.rewardChipIcon}>
                                {reward.icon}
                              </Text>
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
                  )}

                  {/* 5. Gentle timeframe */}
                  {selectedReward !== null && (
                    <View style={styles.challengeBlock}>
                      <Text style={styles.challengeSectionTitle}>
                        When would this feel nice?
                      </Text>

                      <View style={styles.timeframesRow}>
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
                                  isSelected &&
                                    styles.timeframeChipTextSelected,
                                ]}
                              >
                                {timeframe}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* 6. Final preview card */}
                  {isChallengeFullyConfigured && (
                    <View style={styles.finalPreviewCard}>
                      <View style={styles.finalPreviewHeader}>
                        <View style={styles.finalPreviewIconBubble}>
                          <Text style={styles.finalPreviewEmoji}>
                            {participantChoice === "me"
                              ? "🌱"
                              : participantChoice === "sam"
                              ? "💌"
                              : "🤝"}
                          </Text>
                        </View>
                        <Text style={styles.finalPreviewHeading}>
                          {previewHeading}
                        </Text>
                      </View>

                      {/* Summary fields */}
                      <View style={styles.summaryBox}>
                        <View style={styles.summaryItemRow}>
                          <Text style={styles.summaryItemLabel}>Challenge</Text>
                          <Text style={styles.summaryItemValue}>
                            {selectedIdea}
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
                            {selectedReward === "No reward"
                              ? "No reward — just the moment"
                              : selectedReward}
                          </Text>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryItemRow}>
                          <Text style={styles.summaryItemLabel}>
                            Lighter thought
                          </Text>
                          <Text style={styles.summaryItemValue}>
                            {shareLighterThought && participantChoice !== "me"
                              ? selectedToneLabel
                              : "Private"}
                          </Text>
                        </View>
                      </View>

                      {/* Optional Lighter Thought sharing section */}
                      {(participantChoice === "sam" ||
                        participantChoice === "both") && (
                        <View style={styles.lighterThoughtShareSection}>
                          <Text style={styles.lighterThoughtSectionHeading}>
                            Include your lighter thought?
                          </Text>
                          <Text style={styles.lighterThoughtSectionSupporting}>
                            Share the warm angle you chose, without sharing the
                            original irritation.
                          </Text>

                          <Pressable
                            style={[
                              styles.lighterThoughtToggle,
                              shareLighterThought &&
                                styles.lighterThoughtToggleActive,
                            ]}
                            onPress={() =>
                              setShareLighterThought(!shareLighterThought)
                            }
                            accessibilityRole="button"
                            accessibilityState={{
                              selected: shareLighterThought,
                            }}
                            accessibilityLabel={
                              shareLighterThought
                                ? "Keep this lighter thought private"
                                : "Include this lighter thought with the invitation"
                            }
                          >
                            <View style={styles.toggleIndicatorRow}>
                              <View
                                style={[
                                  styles.toggleCheckbox,
                                  shareLighterThought &&
                                    styles.toggleCheckboxActive,
                                ]}
                              >
                                {shareLighterThought && (
                                  <Text style={styles.toggleCheckboxCheck}>
                                    ✓
                                  </Text>
                                )}
                              </View>
                              <Text
                                style={[
                                  styles.lighterThoughtToggleText,
                                  shareLighterThought &&
                                    styles.lighterThoughtToggleTextActive,
                                ]}
                              >
                                {shareLighterThought
                                  ? "Keep this lighter thought private"
                                  : "Include this lighter thought with the invitation"}
                              </Text>
                            </View>
                          </Pressable>

                          {shareLighterThought && (
                            <View style={styles.lighterThoughtInputContainer}>
                              <Text style={styles.lighterThoughtInputLabel}>
                                Your lighter thought
                              </Text>
                              <TextInput
                                style={styles.lighterThoughtTextInput}
                                value={effectiveLighterThought}
                                onChangeText={setLighterThoughtCustomText}
                                placeholder="A warm angle to share..."
                                placeholderTextColor="#9C8E9E"
                                multiline
                                accessibilityLabel="Your lighter thought"
                              />
                              <Text style={styles.lighterThoughtMutedNote}>
                                Only this edited lighter thought will be shown.
                                Your original irritation stays private.
                              </Text>
                            </View>
                          )}
                        </View>
                      )}

                      {/* Reassurance text */}
                      <Text style={styles.finalReassuranceText}>
                        {participantChoice === "sam"
                          ? `${partnerName || "Your partner"} could accept, suggest a small change, or simply choose not today.`
                          : participantChoice === "both"
                          ? "Both of you would need to choose this together."
                          : "A quiet personal commitment, just for your own peace of mind."}
                      </Text>

                      {/* Clearly disabled non-interactive button */}
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

                      {/* Actions */}
                      <View style={styles.finalActionsRow}>
                        <Pressable
                          style={styles.finalSecondaryButton}
                          onPress={handleEditChallengeChoices}
                          accessibilityRole="button"
                          accessibilityLabel="Edit choices"
                        >
                          <Text style={styles.finalSecondaryButtonText}>
                            Edit choices
                          </Text>
                        </Pressable>

                        <Pressable
                          style={styles.finalSecondaryButton}
                          onPress={handleResetAll}
                          accessibilityRole="button"
                          accessibilityLabel="Start over"
                        >
                          <Text style={styles.finalSecondaryButtonText}>
                            Start over
                          </Text>
                        </Pressable>
                      </View>

                      <Pressable
                        style={styles.recipientBridgeButton}
                        onPress={() => {
                          const isSharing =
                            shareLighterThought && participantChoice !== "me";
                          router.push({
                            pathname: "/challenge-lifecycle-preview",
                            params: {
                              idea: selectedIdea ?? "",
                              participant: participantChoice ?? "sam",
                              timeframe: selectedTimeframe ?? "Today",
                              reward:
                                selectedReward ??
                                "No reward — just the moment",
                              reframeTone: selectedToneLabel,
                              reframeText: isSharing
                                ? effectiveLighterThought.trim()
                                : "",
                              shareReframe: isSharing ? "true" : "false",
                            },
                          } as any);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Preview recipient experience"
                      >
                        <Text style={styles.recipientBridgeButtonText}>
                          Preview recipient experience ›
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
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
    backgroundColor: "#FBF7FC",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 70,
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
  privacyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  privacyIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1EDF7",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  privacyIconText: {
    fontSize: 14,
  },
  privacyTextGroup: {
    flex: 1,
    gap: 3,
  },
  privacyHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3D3040",
  },
  privacyText: {
    fontSize: 13,
    color: "#6D6072",
    lineHeight: 18,
  },
  previewNoticeText: {
    fontSize: 11.5,
    color: "#8E7E94",
    marginTop: 2,
    fontStyle: "italic",
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
  presetOptionsContainer: {
    gap: 8,
  },
  presetCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  presetCardSelected: {
    borderColor: "#6E416D",
    backgroundColor: "#FBEFF7",
  },
  presetIconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F8F3F9",
    alignItems: "center",
    justifyContent: "center",
  },
  presetIconBubbleSelected: {
    backgroundColor: "#F1E8F3",
  },
  presetEmoji: {
    fontSize: 16,
  },
  presetCardLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3D3040",
    flex: 1,
  },
  presetCardLabelSelected: {
    color: "#6E416D",
    fontWeight: "700",
  },
  customInputBlock: {
    marginTop: 6,
    gap: 6,
  },
  inputLabel: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#3D3040",
  },
  textInput: {
    minHeight: 70,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    padding: 12,
    fontSize: 14,
    color: "#3D3040",
    textAlignVertical: "top",
  },
  inputHelperText: {
    fontSize: 11.5,
    color: "#8E7E94",
    fontStyle: "italic",
  },
  consentButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  consentButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  consentButtonSelected: {
    borderColor: "#6E416D",
    backgroundColor: "#FBEFF7",
  },
  consentButtonText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#3D3040",
    textAlign: "center",
  },
  consentButtonTextSelected: {
    color: "#6E416D",
    fontWeight: "700",
  },
  notTodayCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    gap: 8,
    alignItems: "center",
  },
  notTodayTitle: {
    fontSize: 14.5,
    fontWeight: "600",
    color: "#3D3040",
    textAlign: "center",
    lineHeight: 21,
  },
  notTodaySubtitle: {
    fontSize: 13,
    color: "#6D6072",
    textAlign: "center",
    lineHeight: 18,
  },
  quietResetButton: {
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#F8F3F9",
    borderWidth: 1,
    borderColor: "#E5DAE6",
  },
  quietResetButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6E416D",
  },
  reframeCardsContainer: {
    gap: 10,
    marginTop: 4,
  },
  reframeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    gap: 8,
  },
  reframeCardSelected: {
    borderColor: "#6E416D",
    backgroundColor: "#FBEFF7",
  },
  reframeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reframeIconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F1EDF7",
    alignItems: "center",
    justifyContent: "center",
  },
  reframeIconBubbleSelected: {
    backgroundColor: "#F4E0EF",
  },
  reframeIcon: {
    fontSize: 14,
  },
  reframeToneLabel: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#6D6072",
  },
  reframeToneLabelSelected: {
    color: "#6E416D",
  },
  reframeBodyText: {
    fontSize: 14.5,
    color: "#3D3040",
    lineHeight: 21,
  },
  outcomeCard: {
    backgroundColor: "#FDF9FD",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.2,
    borderColor: "#EBDCEB",
    marginTop: 6,
    alignItems: "center",
    gap: 8,
  },
  outcomeHeading: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6E416D",
    textAlign: "center",
  },
  outcomeSubtext: {
    fontSize: 13,
    color: "#6D6072",
    textAlign: "center",
    lineHeight: 18,
  },
  outcomeActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
    width: "100%",
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 12,
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
  quietResetSmallButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "#F8F3F9",
    borderWidth: 1,
    borderColor: "#E5DAE6",
    alignItems: "center",
    justifyContent: "center",
  },
  quietResetSmallText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#6D6072",
  },

  /* Step 1: Challenge Invite Card */
  challengeInviteCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    marginTop: 4,
    gap: 12,
  },
  challengeInviteHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  challengeInviteIconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FBEFF7",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  challengeInviteEmoji: {
    fontSize: 16,
  },
  challengeInviteHeaderTextGroup: {
    flex: 1,
    gap: 3,
  },
  challengeInviteHeading: {
    fontSize: 15,
    fontWeight: "700",
    color: "#3D3040",
  },
  challengeInviteSubtext: {
    fontSize: 13,
    color: "#6D6072",
    lineHeight: 18,
  },
  challengeInviteActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
  },
  challengePrimaryInviteButton: {
    flex: 1,
    backgroundColor: "#6E416D",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  challengePrimaryInviteButtonText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  challengeQuietDismissButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#F8F3F9",
    borderWidth: 1,
    borderColor: "#E5DAE6",
    alignItems: "center",
    justifyContent: "center",
  },
  challengeQuietDismissText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6D6072",
  },

  /* Challenge Builder Container */
  challengeBuilderSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    marginTop: 6,
    gap: 20,
  },
  challengeBuilderHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F3EDF6",
  },
  challengeSectionBadge: {
    backgroundColor: "#F1EDF7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  challengeSectionBadgeText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#6E416D",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  challengeBuilderCloseButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  challengeBuilderCloseText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E7E94",
  },
  challengeBlock: {
    gap: 10,
  },
  challengeSectionTitle: {
    fontSize: 15.5,
    fontWeight: "700",
    color: "#3D3040",
  },
  challengeSectionSubtitle: {
    fontSize: 13,
    color: "#6D6072",
    lineHeight: 18,
    marginTop: -4,
  },
  participantsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  participantCard: {
    flex: 1,
    backgroundColor: "#FBF7FC",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 70,
  },
  participantCardSelected: {
    borderColor: "#6E416D",
    backgroundColor: "#FBEFF7",
  },
  participantEmoji: {
    fontSize: 18,
  },
  participantLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3D3040",
    textAlign: "center",
  },
  participantLabelSelected: {
    color: "#6E416D",
    fontWeight: "700",
  },

  /* Challenge Ideas */
  challengeIdeasContainer: {
    gap: 8,
    marginTop: 4,
  },
  challengeIdeaCard: {
    backgroundColor: "#FBF7FC",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  challengeIdeaCardSelected: {
    borderColor: "#6E416D",
    backgroundColor: "#FBEFF7",
  },
  challengeIdeaIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1EDF7",
    alignItems: "center",
    justifyContent: "center",
  },
  challengeIdeaIconBubbleSelected: {
    backgroundColor: "#F4E0EF",
  },
  challengeIdeaEmoji: {
    fontSize: 15,
  },
  challengeIdeaTextCol: {
    flex: 1,
    gap: 2,
  },
  challengeIdeaTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#3D3040",
  },
  challengeIdeaTitleSelected: {
    color: "#6E416D",
  },
  challengeIdeaDesc: {
    fontSize: 12.5,
    color: "#6D6072",
    lineHeight: 16,
  },

  /* Rewards */
  rewardsRowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  rewardChip: {
    backgroundColor: "#FBF7FC",
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rewardChipSelected: {
    borderColor: "#6E416D",
    backgroundColor: "#FBEFF7",
  },
  rewardChipIcon: {
    fontSize: 14,
  },
  rewardChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#3D3040",
  },
  rewardChipTextSelected: {
    color: "#6E416D",
    fontWeight: "700",
  },

  /* Timeframe */
  timeframesRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  timeframeChip: {
    flex: 1,
    backgroundColor: "#FBF7FC",
    borderRadius: 14,
    paddingVertical: 10,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    alignItems: "center",
    justifyContent: "center",
  },
  timeframeChipSelected: {
    borderColor: "#6E416D",
    backgroundColor: "#FBEFF7",
  },
  timeframeChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3D3040",
  },
  timeframeChipTextSelected: {
    color: "#6E416D",
    fontWeight: "700",
  },

  /* Final Preview Card */
  finalPreviewCard: {
    backgroundColor: "#FDF8FC",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.2,
    borderColor: "#EBD8EA",
    gap: 12,
  },
  finalPreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  finalPreviewIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3E3F0",
    alignItems: "center",
    justifyContent: "center",
  },
  finalPreviewEmoji: {
    fontSize: 16,
  },
  finalPreviewHeading: {
    fontSize: 15.5,
    fontWeight: "700",
    color: "#3D3040",
  },
  summaryBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EFE2EE",
    gap: 8,
  },
  summaryItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryItemLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#6D6072",
  },
  summaryItemValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3D3040",
    maxWidth: "65%",
    textAlign: "right",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#F6EEF5",
  },
  finalReassuranceText: {
    fontSize: 13,
    color: "#6D6072",
    lineHeight: 18,
    fontStyle: "italic",
    textAlign: "center",
    paddingHorizontal: 4,
  },
  disabledPreviewButton: {
    backgroundColor: "#ECE4EE",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DFD2E1",
  },
  disabledPreviewButtonText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#8E7E94",
  },
  finalActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  finalSecondaryButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    alignItems: "center",
    justifyContent: "center",
  },
  finalSecondaryButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6E416D",
  },
  outcomeNoteBox: {
    backgroundColor: "#FAF5FB",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#F0E4F1",
    width: "100%",
    marginTop: 2,
  },
  outcomeNoteText: {
    fontSize: 12.5,
    color: "#6D6072",
    lineHeight: 17,
    textAlign: "center",
    fontStyle: "italic",
  },
  customChallengeBridgeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.2,
    borderColor: "#E8DCE9",
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  customChallengeBridgeIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1EDF7",
    alignItems: "center",
    justifyContent: "center",
  },
  customChallengeBridgeEmoji: {
    fontSize: 16,
  },
  customChallengeBridgeTextCol: {
    flex: 1,
    gap: 2,
  },
  customChallengeBridgeTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#6E416D",
  },
  customChallengeBridgeDesc: {
    fontSize: 12.5,
    color: "#6D6072",
  },
  recipientBridgeButton: {
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  recipientBridgeButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6E416D",
  },
  lighterThoughtShareSection: {
    backgroundColor: "#FDF8FC",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EADEEB",
    gap: 8,
  },
  lighterThoughtSectionHeading: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#3D3040",
  },
  lighterThoughtSectionSupporting: {
    fontSize: 12.5,
    color: "#6D6072",
    lineHeight: 17,
  },
  lighterThoughtToggle: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1.2,
    borderColor: "#E0D2E3",
    marginTop: 2,
  },
  lighterThoughtToggleActive: {
    backgroundColor: "#F4ECF6",
    borderColor: "#8B5388",
  },
  toggleIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  toggleCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#B4A2B8",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  toggleCheckboxActive: {
    backgroundColor: "#6E416D",
    borderColor: "#6E416D",
  },
  toggleCheckboxCheck: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  lighterThoughtToggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5C4F61",
    flex: 1,
  },
  lighterThoughtToggleTextActive: {
    color: "#4A154B",
    fontWeight: "700",
  },
  lighterThoughtInputContainer: {
    marginTop: 6,
    gap: 6,
  },
  lighterThoughtInputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5C4F61",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  lighterThoughtTextInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: "#D8C7DB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#3D3040",
    lineHeight: 20,
    minHeight: 60,
  },
  lighterThoughtMutedNote: {
    fontSize: 11.5,
    color: "#857388",
    lineHeight: 16,
    fontStyle: "italic",
  },
});
