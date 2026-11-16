/**
 * HelpfulnessQuestion.tsx
 *
 * An optional card shown after a new reconnection is completed when the user
 * had previously linked this friction to a prior completed reconnection.
 *
 * "Did revisiting your previous experience help this time?"
 *
 * Persistence invariants:
 * - On mount: loads the persisted helpfulness_response from friction_moment_relations.
 * - If a response already exists, renders null — the question is permanently closed
 *   for this user. Refreshing or remounting cannot reopen it.
 * - Repeated submission is idempotent (UPDATE sets the same value again).
 * - Partner A's answer never suppresses Partner B's independent question.
 *   Each partner's HelpfulnessQuestion instance checks only their own record.
 * - Database error on save: leaves the question open and shows a retry state.
 * - Unauthenticated or unauthorised UPDATE is rejected by RLS (user_id check).
 *
 * Answers are stored according to the independent-perspective privacy model.
 * They are NEVER converted into scores, streaks, or compliance metrics.
 * Touch targets ≥ 44pt.
 */

import { CouplySectionCard } from "@/components/CouplyUI";
import { useTheme } from "@/context/ThemeContext";
import {
  HelpfulnessResponse,
  loadHelpfulnessResponse,
  saveHelpfulnessResponse,
} from "@/lib/repair-memory";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ThemeColors } from "@/context/ThemeContext";

const HELPFULNESS_OPTIONS: { value: HelpfulnessResponse; label: string }[] = [
  { value: "yes_helped", label: "Yes, it helped" },
  { value: "a_little", label: "A little" },
  { value: "different_way", label: "We found a different way" },
  { value: "not_this_time", label: "Not this time" },
  { value: "prefer_not", label: "Prefer not to say" },
];

interface HelpfulnessQuestionProps {
  currentEventId: string;
  priorEventId: string;
  userId: string;
  /** Called after the response is saved */
  onComplete: () => void;
}

/**
 * Load states for the persisted helpfulness response:
 * - "loading": checking the database on mount
 * - "unanswered": no previous response found — show the question
 * - "answered": a response was found (or just saved) — render null
 * - "error": save failed — keep the question open with a retry option
 */
type LoadState = "loading" | "unanswered" | "answered" | "error";

export function HelpfulnessQuestion({
  currentEventId,
  priorEventId,
  userId,
  onComplete,
}: HelpfulnessQuestionProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [saving, setSaving] = useState(false);

  // On mount: check whether this user has already answered.
  // This is the single source of truth — local `saved` state cannot reopen the
  // question after a page refresh because we always check the database.
  useEffect(() => {
    let cancelled = false;
    loadHelpfulnessResponse({ currentEventId, priorEventId, userId }).then(
      (existing) => {
        if (cancelled) return;
        setLoadState(existing !== null ? "answered" : "unanswered");
      }
    );
    return () => {
      cancelled = true;
    };
  }, [currentEventId, priorEventId, userId]);

  const handleSelect = useCallback(
    async (response: HelpfulnessResponse) => {
      setSaving(true);
      const result = await saveHelpfulnessResponse({
        currentEventId,
        priorEventId,
        userId,
        response,
      });
      setSaving(false);
      if (result.success) {
        setLoadState("answered");
        onComplete();
      } else {
        // Save failed — keep the question open so the user can retry
        setLoadState("error");
      }
    },
    [currentEventId, priorEventId, userId, onComplete]
  );

  // Loading: render nothing until we know whether to show the question
  if (loadState === "loading") return null;

  // Already answered (persisted in DB) — never show again, even after remount
  if (loadState === "answered") return null;

  return (
    <CouplySectionCard variant="lilac" style={styles.container}>
      <Text style={[styles.heading, { color: theme.primaryText }]}>
        Did revisiting your previous experience help this time?
      </Text>
      <Text style={[styles.subtext, { color: theme.secondaryText }]}>
        Your answer is private to you.
      </Text>
      {loadState === "error" && (
        <Text style={[styles.errorText, { color: theme.status.error.text }]}>
          Could not save — please try again.
        </Text>
      )}
      {saving ? (
        <ActivityIndicator size="small" color={theme.primaryAccent} />
      ) : (
        <View style={styles.options}>
          {HELPFULNESS_OPTIONS.map(({ value, label }) => (
            <Pressable
              key={value}
              style={({ pressed }) => [
                styles.optionBtn,
                {
                  backgroundColor: theme.secondarySurface,
                  borderColor: theme.border,
                },
                pressed && { opacity: 0.65 },
              ]}
              onPress={() => handleSelect(value)}
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              <Text
                style={[styles.optionBtnText, { color: theme.primaryText }]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </CouplySectionCard>
  );
}

function createStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: 10,
      marginTop: 12,
    },
    heading: {
      fontSize: 15,
      fontWeight: "700",
      lineHeight: 21,
    },
    subtext: {
      fontSize: 12.5,
      lineHeight: 17,
    },
    errorText: {
      fontSize: 12.5,
      lineHeight: 17,
    },
    options: {
      gap: 8,
    },
    optionBtn: {
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    optionBtnText: {
      fontSize: 14,
      fontWeight: "500",
    },
  });
}
