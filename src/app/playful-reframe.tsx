import {
  CouplyChoiceCard,
  CouplyHeader,
  CouplyPrimaryButton,
  CouplyQuietButton,
  CouplySectionCard,
} from "@/components/CouplyUI";
import { tokens } from "@/components/couply-tokens";
import { useUserIdentity } from "@/context/UserIdentityContext";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

type SampleKey = "coffee_mug" | "socks" | "directions";
type ConsentChoice = "pending" | "try" | "not_today";
type ToneKey = "gentle" | "playful" | "exaggerated";

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

export default function PlayfulReframeScreen() {
  const router = useRouter();
  const { partnerName } = useUserIdentity();

  const [selectedSampleKey, setSelectedSampleKey] =
    useState<SampleKey>("coffee_mug");
  const [customText, setCustomText] = useState("");
  const [consentChoice, setConsentChoice] = useState<ConsentChoice>("try");
  const [selectedTone, setSelectedTone] = useState<ToneKey | null>(null);
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

  function handleShapeTinyChallenge() {
    router.push({
      pathname: "/make-challenge-preview",
      params: {
        idea: getStarterIdea(),
        participant: "sam",
        source: "reframe",
        reframeTone: selectedToneLabel,
        reframeText: effectiveLighterThought.trim(),
        shareReframe: shareLighterThought ? "true" : "false",
      },
    });
  }

  function handleReturnToRhythm() {
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
          </CouplySectionCard>

          {/* STAGE 2: Choose a lighter angle */}
          <CouplySectionCard style={styles.stageCard}>
            <Text style={styles.stageNumber}>STAGE 2 OF 3</Text>
            <Text style={styles.stageTitle}>Choose a lighter angle</Text>
            <Text style={styles.stageSubtitle}>
              Some moments just need gentle care. Pick a perspective that feels
              easiest to smile at.
            </Text>

            {/* Consent Options */}
            <View style={styles.consentRow}>
              <Pressable
                style={[
                  styles.consentButton,
                  consentChoice === "try" && styles.consentButtonSelected,
                ]}
                onPress={() => setConsentChoice("try")}
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
                <CouplyQuietButton
                  label="That is enough for now"
                  onPress={handleReturnToRhythm}
                  variant="soft"
                  style={styles.notTodayButton}
                />
              </View>
            )}

            {/* Tone Choices */}
            {consentChoice === "try" && (
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

              {/* Lighter thought toggle */}
              <View style={styles.switchContainer}>
                <Pressable
                  style={styles.switchRow}
                  onPress={() => setShareLighterThought((prev) => !prev)}
                  accessible={false}
                >
                  <View style={styles.switchTextGroup}>
                    <Text style={styles.switchTitle}>
                      {shareLighterThought
                        ? "Include your lighter thought"
                        : "Keep this lighter thought private"}
                    </Text>
                    <Text style={styles.switchBody}>
                      {shareLighterThought
                        ? "Your edited lighter thought can appear with the invitation."
                        : "It stays only with you. Your original irritation is never shared."}
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
                    accessibilityLabel={
                      shareLighterThought
                        ? "Include your lighter thought"
                        : "Keep this lighter thought private"
                    }
                    accessibilityState={{ checked: shareLighterThought }}
                  />
                </Pressable>
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
});
