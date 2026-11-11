import { tokens } from "@/components/couply-tokens";
import {
  CouplyPrimaryButton,
  CouplyQuietButton,
} from "@/components/CouplyUI";
import { ThemeColors, useTheme } from "@/context/ThemeContext";
import { useUserIdentity } from "@/context/UserIdentityContext";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

// ----------------------------------------------------
// CONSTANTS & PRESETS (reused from Profile)
// ----------------------------------------------------

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const PERSONALITY_PRESETS = [
  "Thoughtful",
  "Playful",
  "Quiet at first",
  "Planner",
  "Spontaneous",
  "Morning person",
];

const INTEREST_PRESETS = [
  "Cooking",
  "Travel",
  "Music",
  "Films",
  "Walking",
  "Gardening",
];

function getDaysInMonth(month: number): number {
  if (month === 2) return 29; // Allows leap-year day 29 per database check
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

function normalizeTags(rawTags: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of rawTags) {
    if (!tag) continue;
    const trimmed = tag.trim();
    if (trimmed.length < 1 || trimmed.length > 40) continue;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    normalized.push(trimmed);
    if (normalized.length >= 12) break;
  }

  return normalized;
}

// ----------------------------------------------------
// ONBOARDING SCREEN
// ----------------------------------------------------

export default function OnboardingScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { refreshIdentity } = useUserIdentity();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const scrollViewRef = useRef<ScrollView>(null);
  const isMountedRef = useRef(true);

  // Progressive flow step: 1 | 2 | 3
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Screen state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [step2Error, setStep2Error] = useState("");

  // Existing database record tracking (for returning unfinished users)
  const [hasExistingPartnerProfileRow, setHasExistingPartnerProfileRow] =
    useState(false);

  // Explicit intent tracking for Step 2: Skip vs Save
  const [skipOptionalProfileWrite, setSkipOptionalProfileWrite] =
    useState(false);

  // Step 1: Your space
  const [displayName, setDisplayName] = useState("");

  // Step 2: What you'd like to share (optional partner profile fields)
  const [birthMonth, setBirthMonth] = useState<number | null>(null);
  const [birthDay, setBirthDay] = useState<number | null>(null);
  const [intro, setIntro] = useState("");
  const [support, setSupport] = useState("");
  const [traits, setTraits] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [newTraitInput, setNewTraitInput] = useState("");
  const [newInterestInput, setNewInterestInput] = useState("");

  // Month & Day picker modal state (sibling backdrop prevents RN-web nested button errors)
  const [pickerModal, setPickerModal] = useState<{
    isOpen: boolean;
    title: string;
    type: "month" | "day";
    maxDays: number;
    selectedValue: number | null;
    onSelect: (val: number) => void;
  }>({
    isOpen: false,
    title: "",
    type: "month",
    maxDays: 31,
    selectedValue: null,
    onSelect: () => {},
  });

  // ----------------------------------------------------
  // INITIAL DATA CHECK & PREFILL
  // ----------------------------------------------------

  useEffect(() => {
    isMountedRef.current = true;

    async function checkSetup() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!isMountedRef.current) return;

        if (userError || !user) {
          router.replace("/");
          return;
        }

        // 1. Check account profile
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("display_name, onboarding_completed")
          .eq("id", user.id)
          .maybeSingle();

        if (!isMountedRef.current) return;

        if (profileError || !profile) {
          setErrorMessage(
            profileError?.message ?? "Your profile could not be found."
          );
          setLoading(false);
          return;
        }

        // Returning users who already completed onboarding bypass this screen
        if (profile.onboarding_completed) {
          router.replace("/home");
          return;
        }

        if (profile.display_name) {
          setDisplayName(profile.display_name);
        }

        // 2. Prefill existing personal profile info if user previously started onboarding
        const { data: partnerData } = await supabase
          .from("user_partner_profiles")
          .select(
            "birth_month, birth_day, introduction, support_preferences, personality_traits, interests"
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (!isMountedRef.current) return;

        if (partnerData) {
          setHasExistingPartnerProfileRow(true);
          setBirthMonth(partnerData.birth_month ?? null);
          setBirthDay(partnerData.birth_day ?? null);
          setIntro(partnerData.introduction ?? "");
          setSupport(partnerData.support_preferences ?? "");
          setTraits(
            Array.isArray(partnerData.personality_traits)
              ? partnerData.personality_traits
              : []
          );
          setInterests(
            Array.isArray(partnerData.interests) ? partnerData.interests : []
          );
        }
      } catch (err: any) {
        console.error("Failed to load onboarding info:", err);
        if (isMountedRef.current) {
          setErrorMessage("Failed to check your account status.");
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    }

    void checkSetup();

    return () => {
      isMountedRef.current = false;
    };
  }, [router]);

  // ----------------------------------------------------
  // NAVIGATION HANDLERS
  // ----------------------------------------------------

  function handleStep1Continue() {
    setErrorMessage("");
    setStep(2);
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    });
  }

  function handleStep2Back() {
    setStep2Error("");
    setStep(1);
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    });
  }

  function handleStep2Continue() {
    setStep2Error("");

    // Birthday validation: both or neither
    if (
      (birthMonth !== null && birthDay === null) ||
      (birthMonth === null && birthDay !== null)
    ) {
      setStep2Error(
        "Please select both a month and a day, or remove the birthday."
      );
      return;
    }

    if (birthMonth !== null && birthDay !== null) {
      const maxDays = getDaysInMonth(birthMonth);
      if (birthDay > maxDays) {
        setStep2Error(`The selected month only has ${maxDays} days.`);
        return;
      }
    }

    const cleanIntro = intro.trim();
    if (cleanIntro.length > 300) {
      setStep2Error("Introduction must be 300 characters or fewer.");
      return;
    }

    const cleanSupport = support.trim();
    if (cleanSupport.length > 300) {
      setStep2Error("Support preferences must be 300 characters or fewer.");
      return;
    }

    // Normal Continue path treats visible fields as intentional and enables saving
    setSkipOptionalProfileWrite(false);
    setStep(3);
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    });
  }

  function handleStep2Skip() {
    setStep2Error("");
    // Skip Step 2 write: do not touch or overwrite existing user_partner_profiles data
    setSkipOptionalProfileWrite(true);
    setStep(3);
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    });
  }

  function handleStep3Back() {
    setErrorMessage("");
    setStep(2);
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    });
  }

  // ----------------------------------------------------
  // TAG HANDLERS (Step 2)
  // ----------------------------------------------------

  function handleAddTrait() {
    const trimmed = newTraitInput.trim();
    if (!trimmed) return;
    if (traits.length >= 12) return;
    setSkipOptionalProfileWrite(false);
    setTraits((prev) => normalizeTags([...prev, trimmed]));
    setNewTraitInput("");
  }

  function handleRemoveTrait(trait: string) {
    setSkipOptionalProfileWrite(false);
    setTraits((prev) => prev.filter((t) => t !== trait));
  }

  function handleAddPresetTrait(preset: string) {
    if (traits.length >= 12) return;
    setSkipOptionalProfileWrite(false);
    setTraits((prev) => normalizeTags([...prev, preset]));
  }

  function handleAddInterest() {
    const trimmed = newInterestInput.trim();
    if (!trimmed) return;
    if (interests.length >= 12) return;
    setSkipOptionalProfileWrite(false);
    setInterests((prev) => normalizeTags([...prev, trimmed]));
    setNewInterestInput("");
  }

  function handleRemoveInterest(interest: string) {
    setSkipOptionalProfileWrite(false);
    setInterests((prev) => prev.filter((i) => i !== interest));
  }

  function handleAddPresetInterest(preset: string) {
    if (interests.length >= 12) return;
    setSkipOptionalProfileWrite(false);
    setInterests((prev) => normalizeTags([...prev, preset]));
  }

  // ----------------------------------------------------
  // DATE PICKER MODAL OPENERS
  // ----------------------------------------------------

  function openMonthPicker(
    title: string,
    currentVal: number | null,
    onSelect: (val: number) => void
  ) {
    setPickerModal({
      isOpen: true,
      title,
      type: "month",
      maxDays: 31,
      selectedValue: currentVal,
      onSelect,
    });
  }

  function openDayPicker(
    title: string,
    currentVal: number | null,
    maxDays: number,
    onSelect: (val: number) => void
  ) {
    setPickerModal({
      isOpen: true,
      title,
      type: "day",
      maxDays,
      selectedValue: currentVal,
      onSelect,
    });
  }

  // ----------------------------------------------------
  // FINAL SUBMISSION (Step 3)
  // ----------------------------------------------------

  async function completeOnboarding() {
    if (saving) return;

    setSaving(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/");
        return;
      }

      // 1. Save user_partner_profiles ONLY IF optional profile write is not skipped
      if (!skipOptionalProfileWrite) {
        const cleanIntro = intro.trim() || null;
        const cleanSupport = support.trim() || null;
        const normTraits = normalizeTags(traits);
        const normInterests = normalizeTags(interests);

        const hasAnyPartnerProfileData =
          (birthMonth !== null && birthDay !== null) ||
          cleanIntro !== null ||
          cleanSupport !== null ||
          normTraits.length > 0 ||
          normInterests.length > 0;

        // Save user_partner_profiles if data was entered OR if a row already exists
        if (hasAnyPartnerProfileData || hasExistingPartnerProfileRow) {
          const editablePayload = {
            birth_month: birthMonth,
            birth_day: birthDay,
            introduction: cleanIntro,
            support_preferences: cleanSupport,
            personality_traits: normTraits,
            interests: normInterests,
          };

          if (hasExistingPartnerProfileRow) {
            const { error: updateError } = await supabase
              .from("user_partner_profiles")
              .update(editablePayload)
              .eq("user_id", user.id);

            if (updateError) {
              console.error("user_partner_profiles update error:", updateError);
              throw updateError;
            }
          } else {
            const { error: insertError } = await supabase
              .from("user_partner_profiles")
              .insert({
                user_id: user.id,
                ...editablePayload,
              });

            if (insertError) {
              // Concurrent insert conflict fallback
              if (
                insertError.code === "23505" ||
                insertError.message?.includes("duplicate")
              ) {
                const { error: retryError } = await supabase
                  .from("user_partner_profiles")
                  .update(editablePayload)
                  .eq("user_id", user.id);

                if (retryError) {
                  console.error(
                    "user_partner_profiles retry error:",
                    retryError
                  );
                  throw retryError;
                }
              } else {
                console.error(
                  "user_partner_profiles insert error:",
                  insertError
                );
                throw insertError;
              }
            }
            setHasExistingPartnerProfileRow(true);
          }
        }
      }

      // 2. ONLY after user_partner_profiles succeeds (or was safely skipped), complete profile onboarding
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || null,
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
        .select("id")
        .single();

      if (profileError) {
        console.error("profiles update error:", profileError);
        throw profileError;
      }

      // 3. Refresh user identity context
      await refreshIdentity();

      // 4. Land on My Rhythm (/home)
      router.replace("/home");
    } catch (error: any) {
      console.error("Onboarding completion failed:", error);
      setErrorMessage(
        error?.message || "Could not save your setup. Please try again."
      );
    } finally {
      if (isMountedRef.current) {
        setSaving(false);
      }
    }
  }

  // ----------------------------------------------------
  // LOADING STATE
  // ----------------------------------------------------

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primaryAccent} />
          <Text style={styles.loadingText}>Loading Purple Garden...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ----------------------------------------------------
  // RENDER MAIN SCREEN
  // ----------------------------------------------------

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.column}>
            {/* Header Brand Area */}
            <View style={styles.headerContainer}>
              <View style={styles.logoRow}>
                <Text style={styles.logoHeart}>♡</Text>
                <Text style={styles.brandTitle}>Purple Garden</Text>
              </View>
              <Text style={styles.brandSubtitle}>
                A quieter place to tend to what matters between you.
              </Text>
            </View>

            {/* Step Progress Indicator */}
            <View style={styles.stepProgressContainer}>
              <View style={styles.stepBarsRow}>
                <View
                  style={[
                    styles.stepBar,
                    step >= 1 && styles.stepBarActive,
                  ]}
                />
                <View
                  style={[
                    styles.stepBar,
                    step >= 2 && styles.stepBarActive,
                  ]}
                />
                <View
                  style={[
                    styles.stepBar,
                    step >= 3 && styles.stepBarActive,
                  ]}
                />
              </View>
              <Text style={styles.stepIndicatorText}>{step} of 3</Text>
            </View>

            {/* --------------------------------------------------
                STEP 1: YOUR SPACE
                -------------------------------------------------- */}
            {step === 1 && (
              <View style={styles.card}>
                <View style={styles.cardHeaderGroup}>
                  <Text style={styles.stepHeading}>
                    Welcome to Purple Garden
                  </Text>
                  <Text style={styles.stepSupportingText}>
                    Let’s make this space feel like yours.
                  </Text>
                </View>

                {/* Preferred name field */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>
                    Preferred name (optional)
                  </Text>
                  <Text style={styles.helperText}>
                    Use your first name or a nickname. You can change this
                    anytime.
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Your preferred name"
                    placeholderTextColor={theme.mutedText}
                    value={displayName}
                    onChangeText={setDisplayName}
                    maxLength={60}
                    autoCapitalize="words"
                    returnKeyType="next"
                    editable={!saving}
                    accessibilityLabel="Preferred name (optional)"
                    onSubmitEditing={handleStep1Continue}
                  />
                </View>

                {/* Actions */}
                <View style={styles.actionsRow}>
                  <CouplyPrimaryButton
                    label="Continue"
                    onPress={handleStep1Continue}
                    accessibilityLabel="Continue to step 2"
                    style={styles.flexButton}
                  />
                </View>
              </View>
            )}

            {/* --------------------------------------------------
                STEP 2: WHAT YOU'D LIKE TO SHARE
                -------------------------------------------------- */}
            {step === 2 && (
              <View style={styles.card}>
                <View style={styles.cardHeaderGroup}>
                  <Text style={styles.stepHeading}>A little about you</Text>
                  <Text style={styles.stepSupportingText}>
                    These details can help your partner understand and care for
                    you. Everything here is optional, and you can change it
                    later.
                  </Text>
                </View>

                {/* Step 2 Inline Error Feedback */}
                {step2Error !== "" && (
                  <View
                    style={styles.errorCard}
                    accessibilityLiveRegion="polite"
                    accessibilityRole="alert"
                  >
                    <Text style={styles.errorText}>{step2Error}</Text>
                  </View>
                )}

                {/* 1. Birthday (month/day only) */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Birthday (optional)</Text>
                  <Text style={styles.helperText}>
                    Month and day only; year and age are never requested or
                    shown.
                  </Text>

                  <View style={styles.dateSelectorRow}>
                    <Pressable
                      style={styles.selectorButton}
                      onPress={() =>
                        openMonthPicker(
                          "Select birth month",
                          birthMonth,
                          (m) => {
                            setSkipOptionalProfileWrite(false);
                            setBirthMonth(m);
                            if (birthDay) {
                              const maxD = getDaysInMonth(m);
                              if (birthDay > maxD) {
                                setBirthDay(maxD);
                              }
                            }
                          }
                        )
                      }
                      accessibilityRole="button"
                      accessibilityLabel={
                        birthMonth
                          ? `Month: ${MONTH_NAMES[birthMonth - 1]}`
                          : "Choose month"
                      }
                    >
                      <Text style={styles.selectorButtonText}>
                        {birthMonth
                          ? MONTH_NAMES[birthMonth - 1]
                          : "Choose month"}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.selectorButton}
                      onPress={() => {
                        const maxD = getDaysInMonth(birthMonth || 1);
                        openDayPicker(
                          "Select birth day",
                          birthDay,
                          maxD,
                          (d) => {
                            setSkipOptionalProfileWrite(false);
                            setBirthDay(d);
                          }
                        );
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={
                        birthDay ? `Day: ${birthDay}` : "Choose day"
                      }
                    >
                      <Text style={styles.selectorButtonText}>
                        {birthDay ? `Day ${birthDay}` : "Choose day"}
                      </Text>
                    </Pressable>

                    {(birthMonth !== null || birthDay !== null) && (
                      <CouplyQuietButton
                        label="Remove"
                        onPress={() => {
                          setSkipOptionalProfileWrite(false);
                          setBirthMonth(null);
                          setBirthDay(null);
                        }}
                        accessibilityLabel="Remove birthday"
                        variant="soft"
                        style={styles.removeDateBtn}
                      />
                    )}
                  </View>
                </View>

                {/* 2. Short introduction */}
                <View style={styles.fieldBlock}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabel}>
                      Short introduction (optional)
                    </Text>
                    <Text style={styles.counterText}>
                      {intro.length}/300
                    </Text>
                  </View>
                  <Text style={styles.helperText}>
                    A short note about where you are right now.
                  </Text>
                  <TextInput
                    style={styles.textArea}
                    value={intro}
                    onChangeText={(val) => {
                      setSkipOptionalProfileWrite(false);
                      setIntro(val);
                    }}
                    placeholder="A short note about where you are right now"
                    placeholderTextColor={theme.mutedText}
                    multiline
                    maxLength={300}
                    accessibilityLabel="Short introduction (optional)"
                  />
                </View>

                {/* 3. How I prefer to receive support */}
                <View style={styles.fieldBlock}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabel}>
                      How I prefer to receive support (optional)
                    </Text>
                    <Text style={styles.counterText}>
                      {support.length}/300
                    </Text>
                  </View>
                  <Text style={styles.helperText}>
                    What helps when you're overwhelmed, tired, or quiet.
                  </Text>
                  <TextInput
                    style={styles.textArea}
                    value={support}
                    onChangeText={(val) => {
                      setSkipOptionalProfileWrite(false);
                      setSupport(val);
                    }}
                    placeholder="What helps when you're overwhelmed, tired, or quiet"
                    placeholderTextColor={theme.mutedText}
                    multiline
                    maxLength={300}
                    accessibilityLabel="How I prefer to receive support (optional)"
                  />
                </View>

                {/* 4. Personality traits */}
                <View style={styles.fieldBlock}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabel}>
                      Personality traits (optional)
                    </Text>
                    <Text style={styles.counterText}>
                      {traits.length}/12 tags
                    </Text>
                  </View>
                  <Text style={styles.helperText}>
                    Choose from suggestions or write your own (max 40 chars
                    each).
                  </Text>

                  {traits.length > 0 && (
                    <View style={styles.chipsRow}>
                      {traits.map((trait) => (
                        <View key={trait} style={styles.editableChip}>
                          <Text style={styles.editableChipText}>{trait}</Text>
                          <Pressable
                            style={styles.chipRemovePressable}
                            onPress={() => handleRemoveTrait(trait)}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove trait ${trait}`}
                          >
                            <Text style={styles.chipRemoveText}>✕</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}

                  {traits.length < 12 && (
                    <>
                      <View style={styles.tagInputRow}>
                        <TextInput
                          style={styles.tagInput}
                          value={newTraitInput}
                          onChangeText={(val) => {
                            setSkipOptionalProfileWrite(false);
                            setNewTraitInput(val);
                          }}
                          placeholder="Add personality trait"
                          placeholderTextColor={theme.mutedText}
                          maxLength={40}
                          returnKeyType="done"
                          accessibilityLabel="Add personality trait"
                          onSubmitEditing={handleAddTrait}
                        />
                        <CouplyQuietButton
                          label="Add"
                          onPress={handleAddTrait}
                          disabled={!newTraitInput.trim()}
                          accessibilityLabel="Add trait"
                          variant="soft"
                          style={styles.tagAddBtn}
                        />
                      </View>

                      <View style={styles.presetsBlock}>
                        <Text style={styles.presetLabel}>Suggestions:</Text>
                        <View style={styles.chipsRow}>
                          {PERSONALITY_PRESETS.filter(
                            (p) =>
                              !traits.some(
                                (t) => t.toLowerCase() === p.toLowerCase()
                              )
                          ).map((preset) => (
                            <Pressable
                              key={preset}
                              style={styles.presetChip}
                              onPress={() => handleAddPresetTrait(preset)}
                              accessibilityRole="button"
                              accessibilityLabel={`Add suggestion ${preset}`}
                            >
                              <Text style={styles.presetChipText}>
                                + {preset}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    </>
                  )}
                </View>

                {/* 5. Interests & hobbies */}
                <View style={styles.fieldBlock}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabel}>
                      Interests & hobbies (optional)
                    </Text>
                    <Text style={styles.counterText}>
                      {interests.length}/12 tags
                    </Text>
                  </View>
                  <Text style={styles.helperText}>
                    Things you enjoy doing or exploring (max 40 chars each).
                  </Text>

                  {interests.length > 0 && (
                    <View style={styles.chipsRow}>
                      {interests.map((interest) => (
                        <View key={interest} style={styles.editableChip}>
                          <Text style={styles.editableChipText}>
                            {interest}
                          </Text>
                          <Pressable
                            style={styles.chipRemovePressable}
                            onPress={() => handleRemoveInterest(interest)}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove interest ${interest}`}
                          >
                            <Text style={styles.chipRemoveText}>✕</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}

                  {interests.length < 12 && (
                    <>
                      <View style={styles.tagInputRow}>
                        <TextInput
                          style={styles.tagInput}
                          value={newInterestInput}
                          onChangeText={(val) => {
                            setSkipOptionalProfileWrite(false);
                            setNewInterestInput(val);
                          }}
                          placeholder="Add interest or hobby"
                          placeholderTextColor={theme.mutedText}
                          maxLength={40}
                          returnKeyType="done"
                          accessibilityLabel="Add interest or hobby"
                          onSubmitEditing={handleAddInterest}
                        />
                        <CouplyQuietButton
                          label="Add"
                          onPress={handleAddInterest}
                          disabled={!newInterestInput.trim()}
                          accessibilityLabel="Add interest"
                          variant="soft"
                          style={styles.tagAddBtn}
                        />
                      </View>

                      <View style={styles.presetsBlock}>
                        <Text style={styles.presetLabel}>Suggestions:</Text>
                        <View style={styles.chipsRow}>
                          {INTEREST_PRESETS.filter(
                            (p) =>
                              !interests.some(
                                (i) => i.toLowerCase() === p.toLowerCase()
                              )
                          ).map((preset) => (
                            <Pressable
                              key={preset}
                              style={styles.presetChip}
                              onPress={() => handleAddPresetInterest(preset)}
                              accessibilityRole="button"
                              accessibilityLabel={`Add suggestion ${preset}`}
                            >
                              <Text style={styles.presetChipText}>
                                + {preset}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    </>
                  )}
                </View>

                {/* Actions */}
                <View style={styles.actionsColumn}>
                  <View style={styles.actionsRow}>
                    <CouplyQuietButton
                      label="Back"
                      onPress={handleStep2Back}
                      accessibilityLabel="Back to step 1"
                      variant="soft"
                      style={styles.backButton}
                    />
                    <CouplyPrimaryButton
                      label="Continue"
                      onPress={handleStep2Continue}
                      accessibilityLabel="Continue to step 3"
                      style={styles.flexButton}
                    />
                  </View>

                  <CouplyQuietButton
                    label="Skip for now"
                    onPress={handleStep2Skip}
                    accessibilityLabel="Skip optional profile fields for now"
                    variant="text"
                    style={styles.skipButton}
                  />
                </View>
              </View>
            )}

            {/* --------------------------------------------------
                STEP 3: PRIVACY AND CONTROL
                -------------------------------------------------- */}
            {step === 3 && (
              <View style={styles.card}>
                <View style={styles.cardHeaderGroup}>
                  <Text style={styles.stepHeading}>
                    You choose what is shared
                  </Text>
                </View>

                {/* Privacy Explanations */}
                <View style={styles.spacesBlock}>
                  {/* Mine */}
                  <View style={styles.spaceCardMine}>
                    <Text style={styles.spaceBadgeMine}>Mine</Text>
                    <Text style={styles.spaceText}>
                      Private thoughts and reflections stay visible only to
                      you.
                    </Text>
                  </View>

                  {/* Our Space */}
                  <View style={styles.spaceCardOurs}>
                    <Text style={styles.spaceBadgeOurs}>Our Space</Text>
                    <Text style={styles.spaceText}>
                      Shared moments appear for your partner only when you
                      intentionally choose to share them.
                    </Text>
                  </View>

                  {/* Profile details */}
                  <View style={styles.spaceCardProfile}>
                    <Text style={styles.spaceBadgeProfile}>
                      Profile details
                    </Text>
                    <Text style={styles.spaceText}>
                      The information you added about yourself can be seen by
                      your connected partner. You can edit or remove it later in
                      Settings.
                    </Text>
                  </View>
                </View>

                {/* Reassurance Callout */}
                <View style={styles.reassuranceRow}>
                  <Text style={styles.reassuranceIcon}>🔒</Text>
                  <Text style={styles.reassuranceText}>
                    Nothing is shared automatically.
                  </Text>
                </View>

                {/* Quiet Closing Note */}
                <Text style={styles.closingNote}>
                  You can connect with your partner later from Settings.
                </Text>

                {/* Error Message Card if any */}
                {errorMessage !== "" && (
                  <View
                    style={styles.errorCard}
                    accessibilityLiveRegion="polite"
                    accessibilityRole="alert"
                  >
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.actionsRow}>
                  <CouplyQuietButton
                    label="Back"
                    onPress={handleStep3Back}
                    disabled={saving}
                    accessibilityLabel="Back to step 2"
                    variant="soft"
                    style={styles.backButton}
                  />
                  <CouplyPrimaryButton
                    label={saving ? "Setting up..." : "Finish setup"}
                    onPress={completeOnboarding}
                    loading={saving}
                    disabled={saving}
                    accessibilityLabel={
                      saving
                        ? "Setting up your space"
                        : "Finish setup and enter Purple Garden"
                    }
                    style={styles.flexButton}
                  />
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* -------------------------------------------
          MONTH / DAY SELECTOR MODAL
          Sibling backdrop pattern prevents RN-web nested-button errors
         ------------------------------------------- */}
      <Modal
        visible={pickerModal.isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() =>
          setPickerModal((prev) => ({ ...prev, isOpen: false }))
        }
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() =>
              setPickerModal((prev) => ({ ...prev, isOpen: false }))
            }
            accessibilityRole="button"
            accessibilityLabel="Close picker"
          />
          <View
            style={styles.modalCard}
            accessibilityLabel={pickerModal.title}
          >
            <Text style={styles.modalHeading}>{pickerModal.title}</Text>

            {pickerModal.type === "month" ? (
              <View style={styles.monthGrid}>
                {MONTH_NAMES.map((name, idx) => {
                  const mNum = idx + 1;
                  const isSelected = pickerModal.selectedValue === mNum;
                  return (
                    <Pressable
                      key={name}
                      style={[
                        styles.gridChoiceBtn,
                        isSelected && styles.gridChoiceBtnSelected,
                      ]}
                      onPress={() => {
                        pickerModal.onSelect(mNum);
                        setPickerModal((prev) => ({
                          ...prev,
                          isOpen: false,
                        }));
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={name}
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text
                        style={[
                          styles.gridChoiceBtnText,
                          isSelected && styles.gridChoiceBtnTextSelected,
                        ]}
                      >
                        {name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <ScrollView
                style={styles.dayScroll}
                contentContainerStyle={styles.dayGrid}
                showsVerticalScrollIndicator={false}
              >
                {Array.from(
                  { length: pickerModal.maxDays },
                  (_, i) => i + 1
                ).map((dayNum) => {
                  const isSelected = pickerModal.selectedValue === dayNum;
                  return (
                    <Pressable
                      key={dayNum}
                      style={[
                        styles.dayChoiceBtn,
                        isSelected && styles.dayChoiceBtnSelected,
                      ]}
                      onPress={() => {
                        pickerModal.onSelect(dayNum);
                        setPickerModal((prev) => ({
                          ...prev,
                          isOpen: false,
                        }));
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Day ${dayNum}`}
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text
                        style={[
                          styles.dayChoiceBtnText,
                          isSelected && styles.dayChoiceBtnTextSelected,
                        ]}
                      >
                        {dayNum}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <CouplyQuietButton
              label="Cancel"
              onPress={() =>
                setPickerModal((prev) => ({ ...prev, isOpen: false }))
              }
              accessibilityLabel="Cancel date picker"
              variant="soft"
              style={styles.modalCancelBtn}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ----------------------------------------------------
// STYLES
// ----------------------------------------------------

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.pageBackground,
    },
    keyboardAvoid: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
    },
    column: {
      width: "100%",
      maxWidth: tokens.layout.focusedForm, // 480
      alignSelf: "center",
      paddingHorizontal: tokens.layout.pagePaddingStandard, // 20
      paddingTop: 28,
      paddingBottom: 40,
      gap: 18,
    },

    /* Center / Loading State */
    centerContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
      gap: 12,
    },
    loadingText: {
      fontSize: 14.5,
      color: theme.secondaryText,
      fontWeight: "500",
    },

    /* Brand Header */
    headerContainer: {
      alignItems: "center",
      gap: 6,
      paddingVertical: 8,
    },
    logoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    logoHeart: {
      fontSize: 26,
      color: theme.primaryAccent,
      lineHeight: 30,
    },
    brandTitle: {
      fontSize: 28,
      fontWeight: "700",
      color: theme.primaryText,
      letterSpacing: -0.4,
    },
    brandSubtitle: {
      fontSize: 14.5,
      color: theme.secondaryText,
      textAlign: "center",
      lineHeight: 21,
      paddingHorizontal: 12,
    },

    /* Step Progress Indicator */
    stepProgressContainer: {
      gap: 6,
      alignItems: "center",
      marginBottom: 2,
    },
    stepBarsRow: {
      flexDirection: "row",
      gap: 8,
      width: "100%",
    },
    stepBar: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
    },
    stepBarActive: {
      backgroundColor: theme.primaryAccent,
    },
    stepIndicatorText: {
      fontSize: 12.5,
      fontWeight: "600",
      color: theme.secondaryText,
      letterSpacing: 0.2,
    },

    /* Card */
    card: {
      backgroundColor: theme.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 22,
      gap: 18,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    cardHeaderGroup: {
      gap: 6,
    },
    stepHeading: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.primaryText,
      letterSpacing: -0.3,
    },
    stepSupportingText: {
      fontSize: 14.5,
      color: theme.secondaryText,
      lineHeight: 21,
    },

    /* Field Blocks */
    fieldBlock: {
      gap: 6,
    },
    fieldLabelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    fieldLabel: {
      fontSize: 13.5,
      fontWeight: "600",
      color: theme.primaryText,
    },
    counterText: {
      fontSize: 12,
      color: theme.secondaryText,
      fontWeight: "500",
    },
    helperText: {
      fontSize: 12.5,
      color: theme.secondaryText,
      lineHeight: 17,
    },
    input: {
      minHeight: 50,
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1.2,
      borderColor: theme.border,
      paddingHorizontal: 14,
      fontSize: 15,
      color: theme.primaryText,
    },
    textArea: {
      minHeight: 88,
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1.2,
      borderColor: theme.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14.5,
      color: theme.primaryText,
      textAlignVertical: "top",
    },

    /* Date Selector */
    dateSelectorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
      marginTop: 2,
    },
    selectorButton: {
      flex: 1,
      minWidth: 120,
      minHeight: 48,
      backgroundColor: theme.secondarySurface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      justifyContent: "center",
      alignItems: "center",
    },
    selectorButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.primaryText,
    },
    removeDateBtn: {
      minHeight: 44,
      paddingHorizontal: 14,
    },

    /* Tag Chips */
    chipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 2,
    },
    editableChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.secondarySurface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      paddingLeft: 12,
      paddingRight: 4,
      minHeight: 44,
    },
    editableChipText: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.primaryText,
      marginRight: 4,
    },
    chipRemovePressable: {
      minWidth: 44,
      minHeight: 44,
      justifyContent: "center",
      alignItems: "center",
    },
    chipRemoveText: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.secondaryText,
    },

    /* Tag Input Row */
    tagInputRow: {
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
      marginTop: 4,
    },
    tagInput: {
      flex: 1,
      minHeight: 46,
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1.2,
      borderColor: theme.border,
      paddingHorizontal: 12,
      fontSize: 14,
      color: theme.primaryText,
    },
    tagAddBtn: {
      minHeight: 44,
      paddingHorizontal: 16,
    },

    /* Presets */
    presetsBlock: {
      gap: 6,
      marginTop: 4,
    },
    presetLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.secondaryText,
    },
    presetChip: {
      backgroundColor: theme.secondarySurface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 44,
      justifyContent: "center",
    },
    presetChipText: {
      fontSize: 12.5,
      color: theme.primaryAccent,
      fontWeight: "600",
    },

    /* Spaces Explanation Block (Step 3) */
    spacesBlock: {
      gap: 10,
    },
    spaceCardMine: {
      backgroundColor: theme.secondarySurface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      gap: 4,
    },
    spaceBadgeMine: {
      alignSelf: "flex-start",
      fontSize: 11.5,
      fontWeight: "700",
      color: theme.secondaryText,
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    spaceCardOurs: {
      backgroundColor: theme.blushSurface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      padding: 14,
      gap: 4,
    },
    spaceBadgeOurs: {
      alignSelf: "flex-start",
      fontSize: 11.5,
      fontWeight: "700",
      color: theme.primaryAccent,
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    spaceCardProfile: {
      backgroundColor: theme.secondarySurface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      gap: 4,
    },
    spaceBadgeProfile: {
      alignSelf: "flex-start",
      fontSize: 11.5,
      fontWeight: "700",
      color: theme.secondaryText,
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    spaceText: {
      fontSize: 13.5,
      color: theme.primaryText,
      lineHeight: 19,
    },

    /* Reassurance Row */
    reassuranceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.secondarySurface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    reassuranceIcon: {
      fontSize: 14,
    },
    reassuranceText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.primaryText,
    },

    /* Closing Note */
    closingNote: {
      fontSize: 12.5,
      color: theme.secondaryText,
      textAlign: "center",
      lineHeight: 17,
      paddingHorizontal: 8,
    },

    /* Errors */
    errorCard: {
      backgroundColor: theme.secondarySurface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    errorText: {
      fontSize: 13,
      color: theme.primaryAccent,
      lineHeight: 18,
      fontWeight: "500",
    },

    /* Actions */
    actionsColumn: {
      gap: 10,
      marginTop: 4,
    },
    actionsRow: {
      flexDirection: "row",
      gap: 12,
      alignItems: "center",
      marginTop: 4,
    },
    flexButton: {
      flex: 1,
      minHeight: 48,
    },
    backButton: {
      minWidth: 90,
      minHeight: 48,
    },
    skipButton: {
      alignSelf: "center",
      minHeight: 44,
      paddingHorizontal: 16,
    },

    /* Modal / Date Selector */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalCard: {
      width: "100%",
      maxWidth: tokens.layout.dialogCompact, // 380
      backgroundColor: theme.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 20,
      gap: 16,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 6,
    },
    modalHeading: {
      fontSize: 17,
      fontWeight: "700",
      color: theme.primaryText,
      textAlign: "center",
    },
    monthGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      justifyContent: "center",
    },
    gridChoiceBtn: {
      width: "30%",
      minHeight: 44,
      backgroundColor: theme.secondarySurface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 8,
    },
    gridChoiceBtnSelected: {
      backgroundColor: theme.primaryAccent,
      borderColor: theme.primaryAccent,
    },
    gridChoiceBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.primaryText,
    },
    gridChoiceBtnTextSelected: {
      color: theme.primaryActionText,
      fontWeight: "700",
    },
    dayScroll: {
      maxHeight: 280,
    },
    dayGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      justifyContent: "center",
      paddingBottom: 8,
    },
    dayChoiceBtn: {
      width: 44,
      height: 44,
      backgroundColor: theme.secondarySurface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: "center",
      alignItems: "center",
    },
    dayChoiceBtnSelected: {
      backgroundColor: theme.primaryAccent,
      borderColor: theme.primaryAccent,
    },
    dayChoiceBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.primaryText,
    },
    dayChoiceBtnTextSelected: {
      color: theme.primaryActionText,
      fontWeight: "700",
    },
    modalCancelBtn: {
      minHeight: 44,
      alignSelf: "stretch",
    },
  });
