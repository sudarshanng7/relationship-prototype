import {
  CouplyChoiceCard,
  CouplyHeader,
  CouplyPrimaryButton,
  CouplyQuietButton,
  CouplySectionCard,
} from "@/components/CouplyUI";
import { getThemedTokens, tokens } from "@/components/couply-tokens";
import { ThemeColors, useTheme } from "@/context/ThemeContext";
import { useUserIdentity } from "@/context/UserIdentityContext";
import { saveAnnoyanceReframe } from "@/lib/annoyance-reframe";
import { setDraftPrivateReflectionNote } from "@/lib/draft-reflection-store";
import {
  generateLighterAnglesHybrid,
  generateLocalSemanticAngles,
  type ReframeAngles,
  type ReframeOutcome,
} from "@/lib/reframe-generator";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type SampleKey = "coffee_mug" | "socks" | "directions";
type ConsentChoice = "pending" | "try" | "not_today";
type ToneKey = "gentle" | "playful" | "exaggerated";

interface IrritationPreset {
  key: SampleKey;
  label: string;
  emoji: string;
  canonicalText: string;
  reframes: ReframeAngles;
}

const SAMPLE_IRRITATIONS: IrritationPreset[] = [
  {
    key: "coffee_mug",
    label: "The unwashed coffee mug",
    emoji: "☕",
    canonicalText: "The unwashed coffee mug left on the table",
    reframes: generateLocalSemanticAngles("coffee mug left on table", 0),
  },
  {
    key: "socks",
    label: "The disappearing socks",
    emoji: "🧦",
    canonicalText: "The disappearing socks missing their pair",
    reframes: generateLocalSemanticAngles("disappearing socks in laundry", 0),
  },
  {
    key: "directions",
    label: "The direction debate",
    emoji: "🧭",
    canonicalText: "The direction debate and taking scenic routes",
    reframes: generateLocalSemanticAngles("direction debate and navigation detour", 0),
  },
];

export default function PlayfulReframeScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { partnerName, coupleId, userId } = useUserIdentity();

  const [selectedSampleKey, setSelectedSampleKey] =
    useState<SampleKey>("coffee_mug");
  const [customText, setCustomText] = useState("");
  const [canonicalStage1Text, setCanonicalStage1Text] = useState<string>("");
  const [consentChoice, setConsentChoice] = useState<ConsentChoice>("try");
  const [selectedTone, setSelectedTone] = useState<ToneKey | null>(null);
  const [lighterThoughtCustomText, setLighterThoughtCustomText] = useState<
    string | null
  >(null);

  // Stage 2 generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAngles, setGeneratedAngles] = useState<ReframeAngles | null>(null);
  const [reframeOutcome, setReframeOutcome] = useState<ReframeOutcome | null>(null);
  const [generationSeed, setGenerationSeed] = useState(0);
  const [generationError, setGenerationError] = useState(false);
  const [clarificationAttemptCount, setClarificationAttemptCount] = useState(0);

  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);

  function handleFocusAndEditDescription() {
    setSelectedTone(null);
    if (!isCustomActive && currentPreset.canonicalText) {
      setCustomText(currentPreset.canonicalText);
    }
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 180, animated: true });
      textInputRef.current?.focus();
    }, 100);
  }

  const isCustomActive = customText.trim().length > 0;
  const currentPreset = SAMPLE_IRRITATIONS.find(
    (item) => item.key === selectedSampleKey,
  )!;

  // The canonical text for generation: either custom text (when active) or preset description
  const activeInputText = isCustomActive ? customText.trim() : currentPreset.canonicalText;

  // If canonicalStage1Text changes, we invalidate generatedAngles until next continue/load
  const isStale = canonicalStage1Text !== activeInputText && canonicalStage1Text !== "";

  // Trigger generation function
  async function triggerGeneration(textToGenerate: string, seed: number) {
    setIsGenerating(true);
    setGenerationError(false);
    try {
      const res = await generateLighterAnglesHybrid(supabase, {
        text: textToGenerate,
        seedModifier: seed,
        mode: "local_only",
      });
      setGeneratedAngles(res.angles);
      if (res.outcome) {
        setReframeOutcome(res.outcome);
        if (res.outcome.type === "clarification_needed") {
          setClarificationAttemptCount((prev) => prev + 1);
        } else {
          setClarificationAttemptCount(0);
        }
      }
      setCanonicalStage1Text(textToGenerate);
    } catch {
      // Fallback locally
      const fallback = generateLocalSemanticAngles(textToGenerate, seed);
      setGeneratedAngles(fallback);
      setReframeOutcome(null);
      setCanonicalStage1Text(textToGenerate);
    } finally {
      setIsGenerating(false);
    }
  }

  // Initial load for preset
  useEffect(() => {
    if (!generatedAngles && !isCustomActive) {
      setGeneratedAngles(currentPreset.reframes);
      setCanonicalStage1Text(currentPreset.canonicalText);
    }
  }, [currentPreset, isCustomActive, generatedAngles]);

  // When user clicks "Continue to lighter angles" or edits
  async function handleContinueToStage2() {
    setSelectedTone(null);
    setLighterThoughtCustomText(null);
    await triggerGeneration(activeInputText, 0);
  }

  // Regenerate option: "Try three new angles"
  async function handleRegenerate() {
    if (isGenerating) return;
    const nextSeed = generationSeed + 1;
    setGenerationSeed(nextSeed);
    setSelectedTone(null);
    setLighterThoughtCustomText(null);
    await triggerGeneration(canonicalStage1Text || activeInputText, nextSeed);
  }

  const currentReframes: ReframeAngles =
    generatedAngles ||
    (isCustomActive
      ? generateLocalSemanticAngles(customText, 0)
      : currentPreset.reframes);

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

  async function handleShapeTinyChallenge() {
    let savedId: string | undefined = undefined;
    if (coupleId && userId) {
      try {
        const res = await saveAnnoyanceReframe(supabase, {
          coupleId,
          authorId: userId,
          topicKey: isCustomActive ? "other" : selectedSampleKey,
          customTopicLabel: isCustomActive ? customText.trim().slice(0, 60) : null,
          privateIrritationInput: isCustomActive ? customText.trim() : null,
          isPlayful: true,
          reframeTone: selectedTone,
          reframeText: effectiveLighterThought.trim(),
          includeReframeWithPartner: false,
          status: "draft",
        });
        if (res.data?.id) {
          savedId = res.data.id;
        }
      } catch (err) {
        console.error("Failed to persist draft annoyance reframe:", err);
      }
    }

    router.push({
      pathname: "/make-challenge-preview",
      params: {
        idea: getStarterIdea(),
        participant: "partner",
        source: "reframe",
        reframeTone: selectedToneLabel,
        reframeText: effectiveLighterThought.trim(),
        shareReframe: "false",
        reframeId: savedId,
        topicKey: isCustomActive ? "other" : selectedSampleKey,
        customTopicLabel: isCustomActive ? customText.trim().slice(0, 60) : "",
      },
    });
  }

  function handleReturnToRhythm() {
    if (coupleId && userId && consentChoice === "not_today") {
      void saveAnnoyanceReframe(supabase, {
        coupleId,
        authorId: userId,
        topicKey: isCustomActive ? "other" : selectedSampleKey,
        customTopicLabel: isCustomActive ? customText.trim().slice(0, 60) : null,
        privateIrritationInput: isCustomActive ? customText.trim() : null,
        isPlayful: false,
        status: "dismissed",
      }).catch(() => {});
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/home");
    }
  }

  function handleRecordFrictionMoment() {
    const note = isCustomActive ? customText.trim() : currentPreset.canonicalText;
    setDraftPrivateReflectionNote(note || null);
    router.push({
      pathname: "/record-moment",
      params: {
        type: "friction",
        visibility: "mine",
      },
    });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            { flexGrow: 1, paddingBottom: 110 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.column}>
          {/* Couply Header */}
          <CouplyHeader
            title="Playful reframe"
            subtitle="A lighthearted way to look at a small everyday irritation."
            onBack={handleReturnToRhythm}
            backLabel="‹ Back"
          />

          {/* Privacy reassurance note */}
          <CouplySectionCard variant="muted" style={styles.privacyCard}>
            <View style={styles.privacyRow}>
              <Text style={styles.privacyIcon}>🔒</Text>
              <View style={styles.privacyTextGroup}>
                <Text style={styles.privacyHeading}>Private space</Text>
                <Text style={styles.privacyBody}>
                  This starts privately. Nothing is saved or shared unless you
                  choose to share a tiny challenge.
                </Text>
              </View>
            </View>
          </CouplySectionCard>

          {/* STAGE 1: What felt a little annoying? */}
          <CouplySectionCard style={styles.stageCard}>
            <Text style={styles.stageNumber}>STAGE 1 OF 3</Text>
            <Text style={styles.stageTitle}>What felt a little annoying?</Text>
            <Text style={styles.stageSubtitle}>
              Pick a classic everyday scenario or describe your own in words.
            </Text>

            {/* Presets */}
            <View style={styles.presetOptionsGrid}>
              {SAMPLE_IRRITATIONS.map((preset) => {
                const isSelected =
                  !isCustomActive && selectedSampleKey === preset.key;
                return (
                  <Pressable
                    key={preset.key}
                    style={[
                      styles.presetChip,
                      isSelected && styles.presetChipSelected,
                    ]}
                    onPress={() => {
                      setCustomText("");
                      setSelectedSampleKey(preset.key);
                      setSelectedTone(null);
                      setLighterThoughtCustomText(null);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={preset.label}
                  >
                    <Text style={styles.presetChipEmoji}>{preset.emoji}</Text>
                    <Text
                      style={[
                        styles.presetChipText,
                        isSelected && styles.presetChipTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Custom text */}
            <View style={styles.customTextWrapper}>
              <Text style={styles.customTextLabel}>
                Or describe it your way
              </Text>
              <TextInput
                ref={textInputRef}
                style={styles.textInput}
                value={customText}
                onChangeText={(text) => {
                  setCustomText(text);
                  setSelectedTone(null);
                  setLighterThoughtCustomText(null);
                }}
                placeholder="What happened? (e.g. shoes left in the hallway)"
                placeholderTextColor={tokens.colors.textMuted}
                multiline
              />
              <Text style={styles.customHelperText}>
                Preview only — this raw text is never shared.
              </Text>
            </View>

            {/* If custom text is active and not yet generated or stale, show button to generate */}
            {isCustomActive && isStale && (
              <View style={styles.stage1ContinueWrapper}>
                <CouplyPrimaryButton
                  label={isGenerating ? "Finding lighter angles…" : "See lighter angles"}
                  onPress={handleContinueToStage2}
                  disabled={isGenerating || customText.trim().length === 0}
                  style={styles.stage1ContinueButton}
                />
              </View>
            )}
          </CouplySectionCard>

          {/* STAGE 2: Choose a lighter angle */}
          <CouplySectionCard style={styles.stageCard}>
            <Text style={styles.stageNumber}>STAGE 2 OF 3</Text>
            <Text style={styles.stageTitle}>
              {reframeOutcome?.type === "clarification_needed"
                ? "A little more context"
                : reframeOutcome?.type === "understood_unavailable_humor"
                ? "A moment of perspective"
                : reframeOutcome?.type === "respectful_reflection"
                ? "A safe, respectful pause"
                : "Choose a lighter angle"}
            </Text>
            <Text style={styles.stageSubtitle}>
              {reframeOutcome?.type === "clarification_needed"
                ? "We want to understand your moment accurately before finding a lighter side."
                : reframeOutcome?.type === "understood_unavailable_humor"
                ? "We understand what happened, and we want to handle it thoughtfully."
                : reframeOutcome?.type === "respectful_reflection"
                ? "Some moments deserve quiet reflection rather than humor."
                : "Some moments just need gentle care. Pick a perspective that feels easiest to smile at."}
            </Text>

            {/* Loading Indicator */}
            {isGenerating && (
              <View style={styles.loadingWrapper}>
                <ActivityIndicator size="small" color={tokens.colors.plum} />
                <Text style={styles.loadingText}>Finding a lighter angle… 🌱</Text>
              </View>
            )}

            {/* Error / Offline Retry Card */}
            {generationError && !isGenerating && (
              <View style={styles.generationErrorWrapper}>
                <Text style={styles.generationErrorTitle}>
                  We couldn't reach the lighter angles service just now.
                </Text>
                <Text style={styles.generationErrorBody}>
                  Local semantic angles are ready below, or you can try generating again.
                </Text>
                <CouplyQuietButton
                  label="Try again"
                  onPress={() => triggerGeneration(activeInputText, generationSeed)}
                  variant="soft"
                  style={styles.retryButton}
                />
              </View>
            )}

            {/* "Not today" path */}
            {consentChoice === "not_today" && (
              <View style={styles.notTodayWrapper}>
                <Text style={styles.notTodayTitle}>
                  That is completely okay. You can keep this thought to
                  yourself.
                </Text>
                <Text style={styles.notTodayBody}>
                  Not every moment is meant to be reframed. Giving yourself
                  space and honoring your feeling is always valid.
                </Text>
                <View style={styles.notTodayActionsRow}>
                  <CouplyQuietButton
                    label="That is enough for now"
                    onPress={handleReturnToRhythm}
                    variant="soft"
                    style={styles.notTodayButton}
                  />
                  <CouplyQuietButton
                    label="Try a playful reframe"
                    onPress={() => setConsentChoice("try")}
                    variant="soft"
                    style={styles.notTodayButton}
                  />
                </View>
              </View>
            )}

            {/* Tone Choices & Alternatives */}
            {consentChoice === "try" && !isGenerating && (
              <>
                {reframeOutcome?.type === "respectful_reflection" ? (
                  <View style={styles.alternativeCard}>
                    <Text style={styles.alternativeHeading}>
                      Not every moment needs a lighter angle
                    </Text>
                    <Text style={styles.alternativeBody}>
                      Some things deserve to be taken seriously. You can leave this as a private reflection if that feels right.
                    </Text>
                    <View style={styles.alternativeActionRow}>
                      <Pressable
                        style={[styles.alternativeQuietButton, styles.alternativeActionHalf]}
                        onPress={handleFocusAndEditDescription}
                      >
                        <Text style={styles.alternativeQuietButtonText}>Edit my reflection</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.alternativeQuietButton, styles.alternativeActionHalf, styles.alternativeActionPrimary]}
                        onPress={handleRecordFrictionMoment}
                      >
                        <Text style={[styles.alternativeQuietButtonText, styles.alternativeActionPrimaryText]}>Continue anyway</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : reframeOutcome?.type === "understood_unavailable_humor" ? (
                  <View style={styles.alternativeCard}>
                    <Text style={styles.alternativeHeading}>
                      {reframeOutcome.continuationTitle || "Let's leave this one as it is."}
                    </Text>
                    <Text style={styles.alternativeBody}>
                      {reframeOutcome.continuationBody || "We don't have a lighter angle that quite fits this moment yet."}
                    </Text>
                    <View style={styles.alternativeActionRow}>
                      <Pressable
                        style={[styles.alternativeQuietButton, styles.alternativeActionHalf]}
                        onPress={handleFocusAndEditDescription}
                      >
                        <Text style={styles.alternativeQuietButtonText}>Edit my description</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.alternativeQuietButton, styles.alternativeActionHalf, styles.alternativeActionPrimary]}
                        onPress={handleRecordFrictionMoment}
                      >
                        <Text style={[styles.alternativeQuietButtonText, styles.alternativeActionPrimaryText]}>Continue anyway</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : reframeOutcome?.type === "clarification_needed" && clarificationAttemptCount > 1 ? (
                  <View style={styles.alternativeCard}>
                    <Text style={styles.alternativeHeading}>
                      Every moment is different.
                    </Text>
                    <Text style={styles.alternativeBody}>
                      We don't have a lighter angle for this one just yet, but your moment still matters.
                    </Text>
                    <View style={styles.alternativeActionRow}>
                      <Pressable
                        style={[styles.alternativeQuietButton, styles.alternativeActionHalf]}
                        onPress={handleFocusAndEditDescription}
                      >
                        <Text style={styles.alternativeQuietButtonText}>Edit my description</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.alternativeQuietButton, styles.alternativeActionHalf, styles.alternativeActionPrimary]}
                        onPress={handleRecordFrictionMoment}
                      >
                        <Text style={[styles.alternativeQuietButtonText, styles.alternativeActionPrimaryText]}>Continue anyway</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : reframeOutcome?.type === "clarification_needed" ? (
                  <View style={styles.alternativeCard}>
                    <Text style={styles.alternativeHeading}>
                      A little more about this moment?
                    </Text>
                    <Text style={styles.alternativeBody}>
                      If you'd like, add a small detail and we'll see if there's a lighter side to it.
                    </Text>
                    <View style={styles.alternativeActionRow}>
                      <Pressable
                        style={[styles.alternativeQuietButton, styles.alternativeActionHalf]}
                        onPress={handleFocusAndEditDescription}
                      >
                        <Text style={styles.alternativeQuietButtonText}>Add a little detail</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.alternativeQuietButton, styles.alternativeActionHalf, styles.alternativeActionPrimary]}
                        onPress={handleRecordFrictionMoment}
                      >
                        <Text style={[styles.alternativeQuietButtonText, styles.alternativeActionPrimaryText]}>Continue anyway</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={styles.tonesList}>
                      {(["gentle", "playful", "exaggerated"] as const).map(
                        (toneKey) => {
                          const item = currentReframes[toneKey];
                          const isSelected = selectedTone === toneKey;

                          return (
                            <CouplyChoiceCard
                              key={toneKey}
                              title={item.toneLabel}
                              description={item.text}
                              selected={isSelected}
                              onPress={() => {
                                setSelectedTone(toneKey);
                                setLighterThoughtCustomText(null);
                              }}
                              icon={<Text style={styles.toneIcon}>{item.icon}</Text>}
                              accessibilityLabel={`${item.toneLabel}: ${item.text}`}
                              style={styles.toneChoiceCard}
                            />
                          );
                        },
                      )}
                    </View>

                    {/* Regenerate Option: "Try three new angles" */}
                    <View style={styles.regenerateWrapper}>
                      <CouplyQuietButton
                        label="Try three new angles"
                        onPress={handleRegenerate}
                        variant="soft"
                        style={styles.regenerateButton}
                      />
                    </View>
                  </>
                )}

                {/* Subtle divider and caption */}
                <View style={styles.careDividerBlock}>
                  <View style={styles.careDividerLine} />
                  <Text style={styles.careDividerCaption}>
                    Or choose a different kind of care
                  </Text>
                  <View style={styles.careDividerLine} />
                </View>

                {/* Full-width calm alternative card */}
                <Pressable
                  style={({ pressed }) => [
                    styles.alternativeCard,
                    pressed && styles.alternativeCardPressed,
                  ]}
                  onPress={handleRecordFrictionMoment}
                  accessibilityRole="button"
                  accessibilityLabel="Record this as a friction moment instead"
                >
                  <Text style={styles.alternativeOverline}>
                    A DIFFERENT NEXT STEP
                  </Text>
                  <Text style={styles.alternativeHeading}>
                    This feels bigger than a reframe
                  </Text>
                  <Text style={styles.alternativeBody}>
                    Record what happened privately, then decide yourself whether
                    it belongs in Our Space.
                  </Text>
                  <View style={styles.alternativeActionRow}>
                    <View style={styles.alternativeQuietButton}>
                      <Text style={styles.alternativeQuietButtonText}>
                        Record a friction moment
                      </Text>
                    </View>
                  </View>
                </Pressable>

                {/* Existing "Not today" action */}
                <CouplyQuietButton
                  label="Not today"
                  onPress={() => {
                    setConsentChoice("not_today");
                    setSelectedTone(null);
                  }}
                  variant="soft"
                  style={styles.notTodayConsentButton}
                />
              </>
            )}
          </CouplySectionCard>

          {/* STAGE 3: What would help next? (Outcome Card) */}
          {consentChoice === "try" && selectedTone !== null && (
            <CouplySectionCard variant="lilac" style={styles.stageCard}>
              <Text style={styles.stageNumberLilac}>STAGE 3 OF 3</Text>
              <Text style={styles.stageTitle}>What would help next?</Text>

              {/* A lighter angle display */}
              <View style={styles.lighterAngleCard}>
                <View style={styles.lighterAngleHeaderRow}>
                  <Text style={styles.lighterAngleIcon}>
                    {selectedReframe?.icon}
                  </Text>
                  <Text style={styles.lighterAngleHeading}>
                    A lighter angle
                  </Text>
                </View>
                <Text style={styles.lighterAngleThought}>
                  "{effectiveLighterThought}"
                </Text>
                <Text style={styles.lighterAngleSupport}>
                  This doesn’t mean your feeling wasn’t real. It is simply one
                  gentle angle to smile at.
                </Text>
                <View style={styles.cautionNotice}>
                  <Text style={styles.cautionNoticeText}>
                    A playful reframe is never a way to dismiss what matters. It
                    simply offers a soft pause before moving forward.
                  </Text>
                </View>
              </View>

              {/* Privacy notice for lighter thought */}
              <View style={styles.cautionNotice}>
                <Text style={styles.cautionNoticeText}>
                  This lighter thought stays completely private to you as gentle inspiration.
                </Text>
              </View>

              {/* Clear endings */}
              <View style={styles.outcomeActions}>
                <CouplyPrimaryButton
                  label="Shape a tiny challenge"
                  onPress={handleShapeTinyChallenge}
                  style={styles.primaryActionButton}
                />
                <CouplyQuietButton
                  label="That is enough for now"
                  onPress={handleReturnToRhythm}
                  variant="soft"
                  style={styles.quietActionButton}
                />
              </View>
            </CouplySectionCard>
          )}
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
  privacyCard: {
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
  },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
  },
  privacyIcon: {
    fontSize: 22,
  },
  privacyTextGroup: {
    flex: 1,
  },
  privacyHeading: {
    fontSize: tokens.typeScale.bodyLarge,
    fontWeight: "600",
    color: tokens.colors.text,
  },
  privacyBody: {
    fontSize: tokens.typeScale.body,
    color: tokens.colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  stageCard: {
    gap: tokens.spacing.md,
  },
  stageNumber: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: tokens.colors.textMuted,
    textTransform: "uppercase",
  },
  stageNumberLilac: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: tokens.colors.plum,
    textTransform: "uppercase",
  },
  stageTitle: {
    fontSize: tokens.typeScale.screenTitle - 10,
    fontWeight: "600",
    color: tokens.colors.text,
  },
  stageSubtitle: {
    fontSize: tokens.typeScale.bodyLarge,
    color: tokens.colors.textSecondary,
    lineHeight: 20,
  },
  presetOptionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
    marginTop: 4,
  },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radii.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  presetChipSelected: {
    borderColor: tokens.colors.plum,
    backgroundColor: tokens.colors.surfaceLilac,
  },
  presetChipEmoji: {
    fontSize: 16,
  },
  presetChipText: {
    fontSize: tokens.typeScale.body,
    color: tokens.colors.text,
  },
  presetChipTextSelected: {
    fontWeight: "600",
    color: tokens.colors.plum,
  },
  customTextWrapper: {
    marginTop: 8,
    gap: 6,
  },
  customTextLabel: {
    fontSize: tokens.typeScale.body,
    fontWeight: "500",
    color: tokens.colors.textSecondary,
  },
  textInput: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.card,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
    fontSize: tokens.typeScale.bodyLarge,
    color: tokens.colors.text,
    minHeight: 56,
    textAlignVertical: "top",
  },
  customHelperText: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textMuted,
  },
  consentRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  consentButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radii.card,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  consentButtonSelected: {
    borderColor: tokens.colors.plum,
    backgroundColor: tokens.colors.surfaceLilac,
  },
  consentButtonText: {
    fontSize: tokens.typeScale.bodyLarge,
    color: tokens.colors.textSecondary,
    fontWeight: "500",
  },
  consentButtonTextSelected: {
    color: tokens.colors.plum,
    fontWeight: "600",
  },
  notTodayWrapper: {
    padding: 14,
    borderRadius: tokens.radii.card,
    backgroundColor: tokens.colors.surfaceMuted,
    gap: 8,
    marginTop: 6,
  },
  notTodayTitle: {
    fontSize: tokens.typeScale.bodyLarge,
    fontWeight: "600",
    color: tokens.colors.text,
  },
  notTodayBody: {
    fontSize: tokens.typeScale.body,
    color: tokens.colors.textSecondary,
    lineHeight: 18,
  },
  notTodayButton: {
    marginTop: 4,
    alignSelf: "flex-start",
  },
  tonesList: {
    gap: 8,
    marginTop: 4,
  },
  toneIcon: {
    fontSize: 20,
  },
  toneChoiceCard: {
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: 14,
  },
  lighterAngleCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.card,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    gap: 10,
  },
  lighterAngleHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  lighterAngleIcon: {
    fontSize: 20,
  },
  lighterAngleHeading: {
    fontSize: tokens.typeScale.bodyLarge,
    fontWeight: "600",
    color: tokens.colors.plum,
  },
  lighterAngleThought: {
    fontSize: tokens.typeScale.sectionTitle,
    fontStyle: "italic",
    color: tokens.colors.text,
    lineHeight: 22,
  },
  lighterAngleSupport: {
    fontSize: tokens.typeScale.body,
    color: tokens.colors.textSecondary,
    lineHeight: 18,
  },
  cautionNotice: {
    backgroundColor: tokens.colors.surfaceMuted,
    padding: 10,
    borderRadius: tokens.radii.small,
    borderLeftWidth: 3,
    borderLeftColor: tokens.colors.plum,
  },
  cautionNoticeText: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
    lineHeight: 17,
  },
  switchContainer: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.card,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
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
  switchBody: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
    lineHeight: 16,
  },
  outcomeActions: {
    gap: 10,
    marginTop: 4,
  },
  primaryActionButton: {
    width: "100%",
  },
  quietActionButton: {
    width: "100%",
  },
  careDividerBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.sm,
    marginVertical: tokens.spacing.xs,
  },
  careDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: tokens.colors.borderSoft,
  },
  careDividerCaption: {
    fontSize: tokens.typeScale.caption,
    fontWeight: "500",
    color: tokens.colors.textSecondary,
  },
  alternativeCard: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: tokens.radii.card,
    borderWidth: 1,
    borderColor: tokens.colors.borderSoft,
    padding: tokens.spacing.md,
    gap: 6,
  },
  alternativeCardPressed: {
    backgroundColor: tokens.colors.surfaceLilac,
    borderColor: tokens.colors.border,
  },
  alternativeOverline: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: tokens.colors.textMuted,
    textTransform: "uppercase",
  },
  alternativeHeading: {
    fontSize: tokens.typeScale.bodyLarge,
    fontWeight: "600",
    color: tokens.colors.text,
  },
  alternativeBody: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
    lineHeight: 18,
  },
  alternativeActionRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
    alignItems: "stretch",
  },
  alternativeQuietButton: {
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.borderSoft,
    borderRadius: tokens.radii.small,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  alternativeActionHalf: {
    flex: 1,
  },
  alternativeActionPrimary: {
    backgroundColor: tokens.colors.plum,
    borderColor: tokens.colors.plum,
  },
  alternativeQuietButtonText: {
    fontSize: tokens.typeScale.body,
    fontWeight: "600",
    color: tokens.colors.plum,
    textAlign: "center",
  },
  alternativeActionPrimaryText: {
    color: tokens.colors.surface,
  },
  notTodayConsentButton: {
    width: "100%",
    marginTop: 2,
  },
  notTodayActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  stage1ContinueWrapper: {
    marginTop: 8,
  },
  stage1ContinueButton: {
    width: "100%",
  },
  loadingWrapper: {
    paddingVertical: tokens.spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: tokens.typeScale.body,
    color: tokens.colors.plum,
    fontWeight: "500",
  },
  generationErrorWrapper: {
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.card,
    backgroundColor: tokens.colors.surfaceMuted,
    gap: 6,
    marginBottom: tokens.spacing.sm,
  },
  generationErrorTitle: {
    fontSize: tokens.typeScale.bodyLarge,
    fontWeight: "600",
    color: tokens.colors.text,
  },
  generationErrorBody: {
    fontSize: tokens.typeScale.caption,
    color: tokens.colors.textSecondary,
    lineHeight: 16,
  },
  retryButton: {
    alignSelf: "flex-start",
    marginTop: 4,
  },
  regenerateWrapper: {
    alignItems: "center",
    marginVertical: tokens.spacing.xs,
  },
  regenerateButton: {
    alignSelf: "center",
  },
});
};
