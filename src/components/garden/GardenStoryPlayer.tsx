import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  AppStateStatus,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { tokens } from "@/components/couply-tokens";
import { ThemeColors } from "@/context/ThemeContext";
import type { GardenCareEvent } from "@/lib/garden-generator";
import type { GardenStory } from "@/lib/garden-story";
import { GardenVisualizer } from "@/components/garden/GardenVisualizer";

export interface GardenStoryPlayerProps {
  story: GardenStory;
  theme: ThemeColors;
  isLight: boolean;
  isDim: boolean;
  coupleId: string | null;
  liveCareEvents: GardenCareEvent[];
  isLiveLoading?: boolean;
  liveError?: string | null;
  onClose: () => void;
  onPlayAgain: () => void;
}

export function GardenStoryPlayer({
  story,
  theme,
  isLight,
  isDim,
  coupleId,
  liveCareEvents,
  isLiveLoading = false,
  liveError = null,
  onClose,
  onPlayAgain,
}: GardenStoryPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isReduceMotion, setIsReduceMotion] = useState(false);
  const [pacingMode, setPacingMode] = useState<"gentle" | "quick">(story.pacing || "gentle");
  const [showHalo, setShowHalo] = useState(true);

  const stepFadeAnim = useRef(new Animated.Value(1)).current;
  const haloTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const totalSteps = story.steps.length;
  const currentStep = story.steps[currentIndex] || story.steps[0];
  const previousStep = currentIndex > 0 ? story.steps[currentIndex - 1] : null;
  const isFinalStep = currentIndex === totalSteps - 1;

  // 1. Reduced Motion Detection (Accessibility)
  useEffect(() => {
    mountedRef.current = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mountedRef.current && enabled) {
          setIsReduceMotion(true);
          setIsPlaying(false); // Reduced motion defaults to still, manual control
        }
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      if (mountedRef.current) {
        setIsReduceMotion(enabled);
        if (enabled) setIsPlaying(false);
      }
    });

    if (typeof window !== "undefined" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (mq.matches) {
        setIsReduceMotion(true);
        setIsPlaying(false);
      }
      const listener = (e: MediaQueryListEvent) => {
        if (mountedRef.current) {
          setIsReduceMotion(e.matches);
          if (e.matches) setIsPlaying(false);
        }
      };
      if (mq.addEventListener) {
        mq.addEventListener("change", listener);
      }
    }

    return () => {
      mountedRef.current = false;
      sub?.remove();
    };
  }, []);

  // 2. AppState & Web Document Visibility (Pause on background, do not auto-resume)
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState !== "active") {
        setIsPlaying(false);
      }
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        setIsPlaying(false);
      }
    };

    if (typeof document !== "undefined" && document.addEventListener) {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      sub.remove();
      if (typeof document !== "undefined" && document.removeEventListener) {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, []);

  // 3. Snapshot Safety & Privacy Boundary
  // If an event was deleted, made private, or withdrawn, or couple changed: end playback immediately.
  // A temporary network error or in-flight refresh must not be mistaken for a privacy withdrawal.
  useEffect(() => {
    if (!coupleId || coupleId !== story.seedString) {
      onClose();
      return;
    }

    if (liveError || isLiveLoading) {
      return;
    }

    const liveKeys = new Set(liveCareEvents.map((e) => `${e.kind}:${e.id}`));
    const capturedKeys = new Set<string>();
    for (const step of story.steps) {
      if (step.addedEventKey) {
        capturedKeys.add(step.addedEventKey);
      }
    }

    for (const key of capturedKeys) {
      if (!liveKeys.has(key)) {
        // Authoritative withdrawal confirmed from successful refresh:
        // Discard playback immediately so withdrawn moments are never displayed
        onClose();
        return;
      }
    }
  }, [coupleId, story.seedString, story.steps, liveCareEvents, isLiveLoading, liveError, onClose]);

  // 4. Realtime Growth Notice (if new events arrived that were not in snapshot)
  const hasNewLiveGrowth = useMemo(() => {
    const capturedKeys = new Set<string>();
    for (const step of story.steps) {
      if (step.addedEventKey) {
        capturedKeys.add(step.addedEventKey);
      }
    }
    return liveCareEvents.some((e) => !capturedKeys.has(`${e.kind}:${e.id}`));
  }, [story.steps, liveCareEvents]);

  // 5. Gentle Step Reveal Animation & Temporary Halo Accent
  useEffect(() => {
    if (haloTimerRef.current) {
      clearTimeout(haloTimerRef.current);
      haloTimerRef.current = null;
    }

    if (isReduceMotion) {
      stepFadeAnim.setValue(1);
      setShowHalo(false);
      return;
    }

    // Restrained opacity transition: only new features materialize over existing rock-solid base
    stepFadeAnim.setValue(0);
    setShowHalo(true);

    Animated.timing(stepFadeAnim, {
      toValue: 1,
      duration: 650,
      useNativeDriver: true,
    }).start();

    // Subtle highlight aura remains for 800ms during reveal, then is cleanly removed
    haloTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setShowHalo(false);
      }
    }, 850);

    return () => {
      if (haloTimerRef.current) {
        clearTimeout(haloTimerRef.current);
        haloTimerRef.current = null;
      }
    };
  }, [currentIndex, isReduceMotion, stepFadeAnim]);

  // 6. Playback Pacing & Auto-advance Timer
  useEffect(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }

    if (!isPlaying || isReduceMotion || isFinalStep) {
      return;
    }

    // Adaptive pacing based on history size and pacing mode
    let stepDurationMs: number;
    const careCount = story.steps.filter((s) => s.addedEventKey !== null).length;

    if (careCount > 20) {
      stepDurationMs = pacingMode === "quick" ? 1400 : 2200;
    } else if (careCount > 8) {
      stepDurationMs = 1900;
    } else {
      stepDurationMs = 2800;
    }

    advanceTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setCurrentIndex((prev) => {
          if (prev < totalSteps - 1) {
            return prev + 1;
          }
          setIsPlaying(false);
          return prev;
        });
      }
    }, stepDurationMs);

    return () => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };
  }, [currentIndex, isPlaying, isReduceMotion, isFinalStep, totalSteps, story.steps, pacingMode]);

  // Navigation Handlers (navigates individual growth steps)
  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(totalSteps - 1, prev + 1));
  }, [totalSteps]);

  const handleTogglePlayPause = useCallback(() => {
    if (isFinalStep) {
      setCurrentIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying((prev) => !prev);
    }
  }, [isFinalStep]);

  const handleSkipToToday = useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    setCurrentIndex(totalSteps - 1);
    setIsPlaying(false);
  }, [totalSteps]);

  const handleReplay = useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    setCurrentIndex(0);
    setIsPlaying(true);
    onPlayAgain();
  }, [onPlayAgain]);

  // Themed backgrounds & borders
  const footerBg = isLight ? "#F4EEF7" : isDim ? "#514958" : "#302536";
  const controlBtnBg = isLight ? "#FFFFFF" : isDim ? "#3C3444" : "#241B2B";
  const controlBtnBorder = isLight ? "#DECDE3" : isDim ? "#63566C" : "#4A3952";
  const pillBg = isLight ? "#E8F0EA" : isDim ? "#324438" : "#223528";
  const pillBorder = isLight ? "#CFDFD2" : isDim ? "#4A6352" : "#35503D";
  const pillText = isLight ? "#244E2F" : isDim ? "#C7E5CF" : "#BFE2CA";

  const totalCareEventsCount = story.steps.filter((s) => s.addedEventKey !== null).length;

  return (
    <View style={styles.container}>
      {/* 1. Artwork Playback Stage with Layered Reveal */}
      <View style={styles.artSection}>
        {/* Layer 1: Base scene holding previous step rock-solid without flashing */}
        {previousStep && (
          <View style={StyleSheet.absoluteFill}>
            <GardenVisualizer
              totalGrowthUnits={previousStep.totalGrowthUnits}
              careGrowthUnits={previousStep.careGrowthUnits}
              timeGrowthUnits={previousStep.timeGrowthUnits}
              seedString={story.seedString}
              isResting={previousStep.isResting}
              careSignals={previousStep.careSignals}
              careEvents={previousStep.cumulativeCareEvents}
              style={styles.heroVisualizer}
            />
          </View>
        )}

        {/* Layer 2: Current step scene smoothly fading in with gentle highlight aura */}
        <Animated.View
          style={[
            styles.animatedWrapper,
            !isReduceMotion && { opacity: stepFadeAnim },
          ]}
        >
          <GardenVisualizer
            totalGrowthUnits={currentStep.totalGrowthUnits}
            careGrowthUnits={currentStep.careGrowthUnits}
            timeGrowthUnits={currentStep.timeGrowthUnits}
            seedString={story.seedString}
            isResting={currentStep.isResting}
            careSignals={currentStep.careSignals}
            careEvents={currentStep.cumulativeCareEvents}
            highlightFeatureId={showHalo && !isReduceMotion ? currentStep.highlightFeatureId : null}
            style={styles.heroVisualizer}
          />
        </Animated.View>
      </View>

      {/* 2. Normal Document Flow Controller Deck */}
      <View
        style={[
          styles.playerFooter,
          {
            backgroundColor: footerBg,
            borderTopColor: theme.borderSoft,
          },
        ]}
      >
        {/* Explanatory Line */}
        <Text style={[styles.explanationText, { color: theme.secondaryText }]}>
          {story.explanation}
        </Text>

        {/* Realtime New Growth Notice */}
        {hasNewLiveGrowth && (
          <View
            style={[
              styles.realtimeNoticeBanner,
              { backgroundColor: pillBg, borderColor: pillBorder },
            ]}
            accessibilityLiveRegion="polite"
          >
            <Text style={[styles.realtimeNoticeText, { color: pillText }]}>
              Your garden has new growth waiting.
            </Text>
            <Pressable
              onPress={onClose}
              style={styles.realtimeActionBtn}
              accessibilityRole="button"
              accessibilityLabel="Exit playback and view new live growth"
            >
              <Text style={[styles.realtimeActionText, { color: pillText }]}>
                View now
              </Text>
            </Pressable>
          </View>
        )}

        {/* Chapter & Growth Step Indicators */}
        <View style={styles.headerInfoRow}>
          <View style={styles.chapterTitleBlock}>
            <Text style={[styles.chapterHeading, { color: theme.secondaryText }]}>
              {`Chapter ${currentStep.chapterIndex + 1} · ${currentStep.chapterTitle}`}
            </Text>
            <Text style={[styles.stepCounter, { color: theme.primaryText }]}>
              {currentStep.addedEventKey
                ? `Growth ${currentStep.chapterStepIndex} of ${currentStep.chapterTotalSteps}`
                : `Step ${currentStep.stepIndex + 1} of ${totalSteps}`}
            </Text>
          </View>

          {currentStep.dateLabel && (
            <View
              style={[
                styles.dateBadge,
                { backgroundColor: controlBtnBg, borderColor: controlBtnBorder },
              ]}
            >
              <Text style={[styles.dateBadgeText, { color: theme.primaryText }]}>
                {currentStep.dateLabel}
              </Text>
            </View>
          )}
        </View>

        {/* Caption */}
        <View
          style={styles.captionContainer}
          accessibilityLiveRegion="polite"
          aria-live="polite"
        >
          <Text style={[styles.chapterCaption, { color: theme.primaryText }]}>
            {currentStep.caption}
          </Text>
        </View>

        {/* Playback Controls (Min 44x44 Touch Targets) */}
        <View style={styles.controlsRow}>
          {/* Previous Step Button */}
          <Pressable
            onPress={handlePrevious}
            disabled={currentIndex === 0}
            style={({ pressed }) => [
              styles.controlBtn,
              {
                backgroundColor: controlBtnBg,
                borderColor: controlBtnBorder,
                opacity: currentIndex === 0 ? 0.35 : pressed ? 0.8 : 1,
              },
            ]}
            focusable={true}
            accessibilityRole="button"
            accessibilityLabel="Previous growth step"
            accessibilityState={{ disabled: currentIndex === 0 }}
          >
            <Text style={[styles.controlBtnText, { color: theme.primaryText }]}>
              ‹ Prev
            </Text>
          </Pressable>

          {/* Pause / Continue Button */}
          <Pressable
            onPress={handleTogglePlayPause}
            style={({ pressed }) => [
              styles.controlBtn,
              styles.primaryControlBtn,
              {
                backgroundColor: theme.primaryAccent,
                borderColor: theme.primaryAccent,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
            focusable={true}
            accessibilityRole="button"
            accessibilityLabel={
              isFinalStep
                ? "Replay story from the beginning"
                : isPlaying
                ? "Pause playback"
                : "Continue playback"
            }
          >
            <Text style={styles.primaryControlBtnText}>
              {isFinalStep ? "Replay ↺" : isPlaying ? "Pause ⏸" : "Continue ▶"}
            </Text>
          </Pressable>

          {/* Next Step Button */}
          <Pressable
            onPress={handleNext}
            disabled={isFinalStep}
            style={({ pressed }) => [
              styles.controlBtn,
              {
                backgroundColor: controlBtnBg,
                borderColor: controlBtnBorder,
                opacity: isFinalStep ? 0.35 : pressed ? 0.8 : 1,
              },
            ]}
            focusable={true}
            accessibilityRole="button"
            accessibilityLabel="Next growth step"
            accessibilityState={{ disabled: isFinalStep }}
          >
            <Text style={[styles.controlBtnText, { color: theme.primaryText }]}>
              Next ›
            </Text>
          </Pressable>
        </View>

        {/* Pacing Toggle for Larger Histories (> 20 events) */}
        {totalCareEventsCount > 20 && (
          <View style={styles.pacingToggleRow}>
            <Text style={[styles.pacingLabel, { color: theme.mutedText }]}>
              Pacing:
            </Text>
            <Pressable
              onPress={() => setPacingMode("gentle")}
              style={[
                styles.pacingPill,
                pacingMode === "gentle" && {
                  backgroundColor: theme.primaryAccent,
                  borderColor: theme.primaryAccent,
                },
                pacingMode !== "gentle" && {
                  backgroundColor: controlBtnBg,
                  borderColor: controlBtnBorder,
                },
              ]}
              focusable={true}
              accessibilityRole="button"
              accessibilityLabel="Gentle story pacing"
            >
              <Text
                style={[
                  styles.pacingPillText,
                  {
                    color:
                      pacingMode === "gentle" ? "#FFFFFF" : theme.primaryText,
                  },
                ]}
              >
                Gentle
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setPacingMode("quick")}
              style={[
                styles.pacingPill,
                pacingMode === "quick" && {
                  backgroundColor: theme.primaryAccent,
                  borderColor: theme.primaryAccent,
                },
                pacingMode !== "quick" && {
                  backgroundColor: controlBtnBg,
                  borderColor: controlBtnBorder,
                },
              ]}
              focusable={true}
              accessibilityRole="button"
              accessibilityLabel="Quick story pacing"
            >
              <Text
                style={[
                  styles.pacingPillText,
                  {
                    color:
                      pacingMode === "quick" ? "#FFFFFF" : theme.primaryText,
                  },
                ]}
              >
                Quick
              </Text>
            </Pressable>
          </View>
        )}

        {/* Secondary Actions: Skip to today & Close */}
        <View style={styles.secondaryActionsRow}>
          {!isFinalStep && (
            <Pressable
              onPress={handleSkipToToday}
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && { opacity: 0.7 },
              ]}
              focusable={true}
              accessibilityRole="button"
              accessibilityLabel="Skip to today's garden"
            >
              <Text
                style={[
                  styles.secondaryBtnText,
                  { color: theme.primaryAccent },
                ]}
              >
                Skip to today
              </Text>
            </Pressable>
          )}

          {isFinalStep && (
            <Pressable
              onPress={handleReplay}
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && { opacity: 0.7 },
              ]}
              focusable={true}
              accessibilityRole="button"
              accessibilityLabel="Play story again with fresh data"
            >
              <Text
                style={[
                  styles.secondaryBtnText,
                  { color: theme.primaryAccent },
                ]}
              >
                Play again ↺
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && { opacity: 0.7 },
            ]}
            focusable={true}
            accessibilityRole="button"
            accessibilityLabel="Close garden story and return to shared garden"
          >
            <Text
              style={[styles.secondaryBtnText, { color: theme.secondaryText }]}
            >
              Close
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
  },
  artSection: {
    width: "100%",
    position: "relative",
    aspectRatio: 16 / 10,
    minHeight: 300,
  },
  animatedWrapper: {
    width: "100%",
    height: "100%",
  },
  heroVisualizer: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  playerFooter: {
    width: "100%",
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 12,
  },
  explanationText: {
    fontSize: tokens.typeScale.caption,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 2,
  },
  realtimeNoticeBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  realtimeNoticeText: {
    fontSize: tokens.typeScale.caption,
    fontWeight: "600",
    flex: 1,
  },
  realtimeActionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  realtimeActionText: {
    fontSize: tokens.typeScale.caption,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  headerInfoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  chapterTitleBlock: {
    flex: 1,
    gap: 2,
  },
  chapterHeading: {
    fontSize: tokens.typeScale.caption,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  stepCounter: {
    fontSize: tokens.typeScale.sectionTitle,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  dateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  dateBadgeText: {
    fontSize: tokens.typeScale.overline,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  captionContainer: {
    minHeight: 44,
    justifyContent: "center",
  },
  chapterCaption: {
    fontSize: tokens.typeScale.bodyLarge,
    fontWeight: "500",
    lineHeight: 22,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 4,
  },
  controlBtn: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryControlBtn: {
    flex: 1.4,
  },
  controlBtnText: {
    fontSize: tokens.typeScale.body,
    fontWeight: "600",
  },
  primaryControlBtnText: {
    fontSize: tokens.typeScale.body,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  pacingToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 2,
  },
  pacingLabel: {
    fontSize: tokens.typeScale.caption,
  },
  pacingPill: {
    minWidth: 44,
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pacingPillText: {
    fontSize: tokens.typeScale.caption,
    fontWeight: "600",
  },
  secondaryActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    marginTop: 2,
  },
  secondaryBtn: {
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    fontSize: tokens.typeScale.body,
    fontWeight: "600",
  },
});
