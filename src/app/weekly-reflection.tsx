import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  CouplyHeader,
  CouplyPrimaryButton,
  CouplyQuietButton,
  CouplySectionCard,
  CouplyStatusPill,
} from "@/components/CouplyUI";
import { tokens } from "@/components/couply-tokens";
import { ThemeColors, useTheme } from "@/context/ThemeContext";
import { formatCategory } from "@/lib/event-heading";
import { supabase } from "@/lib/supabase";
import {
  CARRY_FORWARD_OPTIONS,
  CarryForwardOption,
  MAX_PRIVATE_NOTE_LENGTH,
  STAYED_WITH_OPTIONS,
  StayedWithOption,
  WeeklyActivitySummary,
  WeeklyMomentItem,
  WeeklyReflectionRecord,
  fetchCurrentWeeklyReflection,
  fetchWeeklyActivitySummary,
  fetchWeeklyMoments,
  formatWeeklyReflectionPeriod,
  getWeeklyReflectionPeriod,
  saveWeeklyReflection,
} from "@/lib/weekly-reflection";

export default function WeeklyReflectionScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Current canonical week period
  const period = useMemo(() => getWeeklyReflectionPeriod(), []);
  const formattedPeriod = useMemo(
    () => formatWeeklyReflectionPeriod(period),
    [period],
  );

  // Loading & State
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<WeeklyActivitySummary | null>(null);
  const [moments, setMoments] = useState<WeeklyMomentItem[]>([]);
  const [existingReflection, setExistingReflection] =
    useState<WeeklyReflectionRecord | null>(null);

  // Form selections
  const [stayedWith, setStayedWith] = useState<StayedWithOption | null>(null);
  const [carryForward, setCarryForward] = useState<CarryForwardOption | null>(
    null,
  );
  const [privateNote, setPrivateNote] = useState("");

  // Save feedback & double-click protection
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(
    null,
  );
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Fetch initial data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setSaveErrorMessage(null);

    try {
      const [summaryRes, momentsRes, reflectionRes] = await Promise.all([
        fetchWeeklyActivitySummary(supabase, period),
        fetchWeeklyMoments(supabase, period),
        fetchCurrentWeeklyReflection(supabase, period),
      ]);

      if (!mountedRef.current) return;

      if (summaryRes.data) {
        setSummary(summaryRes.data);
      }
      if (momentsRes.data) {
        setMoments(momentsRes.data);
      }
      if (reflectionRes.data) {
        setExistingReflection(reflectionRes.data);
        setStayedWith(reflectionRes.data.stayedWith);
        setCarryForward(reflectionRes.data.carryForward);
        setPrivateNote(reflectionRes.data.privateNote || "");
      }
    } catch (err) {
      if (__DEV__) {
        console.warn("Weekly reflection load error:", err);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [period]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleBack = () => {
    router.replace("/home");
  };

  const handleOpenMoment = (momentId: string) => {
    router.push({
      pathname: "/event/[id]",
      params: {
        id: momentId,
        from: "weekly-reflection",
      },
    });
  };

  const handleSave = async () => {
    if (!stayedWith || !carryForward) return;
    if (isSavingRef.current) return;

    isSavingRef.current = true;
    setIsSaving(true);
    setSaveErrorMessage(null);

    try {
      const result = await saveWeeklyReflection(supabase, {
        period,
        stayedWith,
        carryForward,
        privateNote,
      });

      if (!mountedRef.current) return;

      if (result.error || !result.data) {
        setSaveErrorMessage(
          result.error?.message ||
            "We could not save your reflection right now. Please try again.",
        );
      } else {
        setExistingReflection(result.data);
        setSaveSuccessMessage("Your reflection has been gently saved.");
      }
    } catch (err) {
      if (mountedRef.current) {
        setSaveErrorMessage(
          "We could not save your reflection right now. Please try again.",
        );
      }
    } finally {
      isSavingRef.current = false;
      if (mountedRef.current) {
        setIsSaving(false);
      }
    }
  };

  const isSaveDisabled = !stayedWith || !carryForward || isSaving;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>
          {/* Header */}
          <CouplyHeader
            title="Your week, gently"
            subtitle="A quiet moment to notice what has stayed with you."
            onBack={handleBack}
            backLabel="‹ Back to My Rhythm"
            style={styles.header}
          />

          {/* Period Chip */}
          <View style={styles.periodBanner}>
            <Text style={styles.periodText}>🌿 {formattedPeriod}</Text>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                size="small"
                color={theme.primaryAccent}
                accessibilityLabel="Loading this week's activity"
              />
              <Text style={styles.loadingText}>Noticing your week…</Text>
            </View>
          ) : (
            <>
              {/* Activity Overview Card */}
              <CouplySectionCard style={styles.summaryCard}>
                <View style={styles.summaryHeaderRow}>
                  <Text style={styles.summaryIcon}>🌱</Text>
                  <Text style={styles.summaryTitle}>
                    {summary?.hasAnyActivity
                      ? "This week held:"
                      : "A quiet week"}
                  </Text>
                </View>

                {summary?.hasAnyActivity ? (
                  <View style={styles.summaryLinesCol}>
                    {summary.activityLines.map((line, idx) => (
                      <View key={idx} style={styles.summaryLineRow}>
                        <Text style={styles.summaryBullet}>•</Text>
                        <Text style={styles.summaryLineText}>{line}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyActivityBox}>
                    <Text style={styles.emptyActivityTitle}>
                      Nothing needed recording this week.
                    </Text>
                    <Text style={styles.emptyActivitySub}>
                      You can still pause and notice how the week felt to you.
                    </Text>
                  </View>
                )}
              </CouplySectionCard>

              {/* Optional Moments List */}
              {moments.length > 0 && (
                <View style={styles.momentsSection}>
                  <Text style={styles.sectionLabel}>
                    Moments from this week
                  </Text>
                  <View style={styles.momentsList}>
                    {moments.map((moment) => {
                      const momentDate = new Date(
                        moment.createdAt,
                      ).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      });
                      const categoryLabel = formatCategory(moment.category);
                      const isShared = moment.visibility === "ours";

                      return (
                        <Pressable
                          key={moment.id}
                          style={({ pressed }) => [
                            styles.momentCard,
                            pressed && styles.momentCardPressed,
                          ]}
                          onPress={() => handleOpenMoment(moment.id)}
                          accessibilityRole="button"
                          accessibilityLabel={`View ${categoryLabel} moment from ${momentDate}`}
                        >
                          <View style={styles.momentTopRow}>
                            <View style={styles.momentCategoryGroup}>
                              <Text style={styles.momentCategoryText}>
                                {categoryLabel}
                              </Text>
                              <CouplyStatusPill
                                label={isShared ? "Shared" : "Mine"}
                                variant={isShared ? "neutral" : "softening"}
                              />
                            </View>
                            <Text style={styles.momentDateText}>
                              {momentDate}
                            </Text>
                          </View>

                          {moment.sharedTopic ? (
                            <Text
                              style={styles.momentTopicText}
                              numberOfLines={1}
                            >
                              {moment.sharedTopic}
                            </Text>
                          ) : null}

                          <View style={styles.momentBottomRow}>
                            {moment.reconnectedAt ? (
                              <CouplyStatusPill
                                label="Reconnected"
                                variant="reconnected"
                              />
                            ) : null}
                            <Text style={styles.momentViewLink}>View →</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Question 1: What stayed with you */}
              <View style={styles.questionSection}>
                <Text style={styles.questionTitle}>
                  What stayed with you from this week?
                </Text>
                <Text style={styles.questionSubtitle}>
                  Choose the option that feels closest.
                </Text>
                <View style={styles.choicesCol}>
                  {STAYED_WITH_OPTIONS.map((option) => {
                    const isSelected = stayedWith === option;
                    return (
                      <Pressable
                        key={option}
                        style={({ pressed }) => [
                          styles.choiceOption,
                          isSelected && styles.choiceOptionSelected,
                          pressed && styles.choiceOptionPressed,
                        ]}
                        onPress={() => setStayedWith(option)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={option}
                      >
                        <View style={styles.choiceRadioOuter}>
                          {isSelected && <View style={styles.choiceRadioInner} />}
                        </View>
                        <Text
                          style={[
                            styles.choiceText,
                            isSelected && styles.choiceTextSelected,
                          ]}
                        >
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Question 2: Carry forward */}
              <View style={styles.questionSection}>
                <Text style={styles.questionTitle}>
                  What would you like to carry into next week?
                </Text>
                <Text style={styles.questionSubtitle}>
                  A small intention or hope for the days ahead.
                </Text>
                <View style={styles.choicesCol}>
                  {CARRY_FORWARD_OPTIONS.map((option) => {
                    const isSelected = carryForward === option;
                    return (
                      <Pressable
                        key={option}
                        style={({ pressed }) => [
                          styles.choiceOption,
                          isSelected && styles.choiceOptionSelected,
                          pressed && styles.choiceOptionPressed,
                        ]}
                        onPress={() => setCarryForward(option)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={option}
                      >
                        <View style={styles.choiceRadioOuter}>
                          {isSelected && <View style={styles.choiceRadioInner} />}
                        </View>
                        <Text
                          style={[
                            styles.choiceText,
                            isSelected && styles.choiceTextSelected,
                          ]}
                        >
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Private Note (Optional) */}
              <View style={styles.questionSection}>
                <View style={styles.noteLabelRow}>
                  <Text style={styles.questionTitle}>
                    Anything you want to remember?
                  </Text>
                  <Text style={styles.noteCounter}>
                    {privateNote.length}/{MAX_PRIVATE_NOTE_LENGTH}
                  </Text>
                </View>
                <Text style={styles.questionSubtitle}>
                  This stays in your private space.
                </Text>
                <TextInput
                  style={styles.noteInput}
                  multiline
                  value={privateNote}
                  onChangeText={(text) => {
                    if (text.length <= MAX_PRIVATE_NOTE_LENGTH) {
                      setPrivateNote(text);
                    }
                  }}
                  placeholder="A few words for yourself (optional)…"
                  placeholderTextColor={theme.mutedText}
                  maxLength={MAX_PRIVATE_NOTE_LENGTH}
                  accessibilityLabel="Private reflection note"
                />
              </View>

              {/* Save Feedback Banner */}
              {saveSuccessMessage && (
                <View style={styles.successBanner}>
                  <Text style={styles.successBannerTitle}>
                    Your week is saved
                  </Text>
                  <Text style={styles.successBannerBody}>
                    You can return whenever you want to remember what stood out.
                  </Text>
                </View>
              )}

              {saveErrorMessage && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>{saveErrorMessage}</Text>
                </View>
              )}

              {/* Actions */}
              <View style={styles.actionButtonsCol}>
                <CouplyPrimaryButton
                  label={
                    existingReflection
                      ? "Update my reflection"
                      : "Save my reflection"
                  }
                  onPress={handleSave}
                  disabled={isSaveDisabled}
                  loading={isSaving}
                  accessibilityLabel={
                    existingReflection
                      ? "Update my reflection"
                      : "Save my reflection"
                  }
                />

                {saveSuccessMessage && (
                  <CouplyQuietButton
                    label="Back to My Rhythm"
                    onPress={handleBack}
                    variant="soft"
                    accessibilityLabel="Return to My Rhythm"
                  />
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: ThemeColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.pageBackground,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 64,
      alignItems: "center",
    },
    column: {
      width: "100%",
      maxWidth: 520,
      paddingHorizontal: tokens.spacing.md,
      gap: 20,
    },
    header: {
      marginTop: 8,
    },
    periodBanner: {
      backgroundColor: theme.secondarySurface,
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 14,
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: theme.borderSoft,
    },
    periodText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.primaryAccent,
      letterSpacing: 0.1,
    },
    loadingContainer: {
      paddingVertical: 48,
      alignItems: "center",
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
      color: theme.secondaryText,
    },
    summaryCard: {
      padding: 18,
      gap: 12,
      borderRadius: 16,
    },
    summaryHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    summaryIcon: {
      fontSize: 20,
    },
    summaryTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.primaryText,
      letterSpacing: -0.2,
    },
    summaryLinesCol: {
      gap: 8,
      paddingLeft: 4,
    },
    summaryLineRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    summaryBullet: {
      fontSize: 14,
      color: theme.primaryAccent,
      lineHeight: 20,
    },
    summaryLineText: {
      fontSize: 14,
      color: theme.primaryText,
      lineHeight: 20,
      flex: 1,
    },
    emptyActivityBox: {
      gap: 4,
    },
    emptyActivityTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.primaryText,
    },
    emptyActivitySub: {
      fontSize: 13,
      color: theme.secondaryText,
      lineHeight: 18,
    },
    momentsSection: {
      gap: 10,
    },
    sectionLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.secondaryText,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    momentsList: {
      gap: 10,
    },
    momentCard: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      gap: 8,
      minHeight: 44,
    },
    momentCardPressed: {
      backgroundColor: theme.secondarySurface,
      borderColor: theme.primaryAccent,
    },
    momentTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    momentCategoryGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    momentCategoryText: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.primaryText,
    },
    momentDateText: {
      fontSize: 12.5,
      color: theme.mutedText,
    },
    momentTopicText: {
      fontSize: 13,
      color: theme.secondaryText,
    },
    momentBottomRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 2,
    },
    momentViewLink: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.primaryAccent,
      marginLeft: "auto",
    },
    questionSection: {
      gap: 10,
    },
    questionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.primaryText,
      letterSpacing: -0.2,
    },
    questionSubtitle: {
      fontSize: 13,
      color: theme.secondaryText,
      lineHeight: 18,
    },
    choicesCol: {
      gap: 8,
      marginTop: 4,
    },
    choiceOption: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1.2,
      borderColor: theme.border,
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 12,
      minHeight: 48,
    },
    choiceOptionSelected: {
      backgroundColor: theme.secondarySurface,
      borderColor: theme.primaryAccent,
      borderWidth: 1.6,
    },
    choiceOptionPressed: {
      backgroundColor: theme.borderSoft,
    },
    choiceRadioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.8,
      borderColor: theme.primaryAccent,
      justifyContent: "center",
      alignItems: "center",
    },
    choiceRadioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.primaryAccent,
    },
    choiceText: {
      fontSize: 14.5,
      fontWeight: "500",
      color: theme.primaryText,
      flex: 1,
    },
    choiceTextSelected: {
      fontWeight: "700",
      color: theme.primaryAccent,
    },
    noteLabelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    noteCounter: {
      fontSize: 12,
      color: theme.mutedText,
    },
    noteInput: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1.2,
      borderColor: theme.border,
      padding: 14,
      fontSize: 14.5,
      color: theme.primaryText,
      minHeight: 100,
      textAlignVertical: "top",
    },
    successBanner: {
      backgroundColor: theme.secondarySurface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      padding: 16,
      gap: 4,
    },
    successBannerTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.primaryAccent,
    },
    successBannerBody: {
      fontSize: 13.5,
      color: theme.secondaryText,
      lineHeight: 18,
    },
    errorBanner: {
      backgroundColor: theme.blushSurface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
    },
    errorBannerText: {
      fontSize: 13.5,
      color: theme.primaryText,
      lineHeight: 18,
    },
    actionButtonsCol: {
      gap: 12,
      marginTop: 8,
    },
  });
}
