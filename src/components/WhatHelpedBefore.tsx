/**
 * WhatHelpedBefore.tsx
 *
 * An optional card shown inside the repair loop experience when the user has
 * previously linked this friction to a prior completed reconnection.
 *
 * Shows:
 * - Safe topic label (formatted category, not raw private notes)
 * - Previous occurrence date
 * - Historical repair duration ("about 18 hours")
 * - Current user's own private "what helped" reflection, labeled "You noted privately…"
 * - Explicitly shared takeaway, labeled "You both recorded…"
 * - Reminder that the current situation may be different
 *
 * Rules:
 * - Never shows another user's private reflection.
 * - Shared content is labeled as shared.
 * - Available actions do not carry compliance/score language.
 * - Chosen action is stored neutrally via the relation record.
 * - Touch targets ≥ 44pt.
 */

import { CouplySectionCard } from "@/components/CouplyUI";
import { tokens } from "@/components/couply-tokens";
import { useTheme } from "@/context/ThemeContext";
import { formatCategory } from "@/lib/event-heading";
import {
  HelpfulnessResponse,
  RepairMemoryCandidate,
  fetchPriorPrivateReflection,
  fetchPriorSharedTakeaway,
  saveRelationDecision,
} from "@/lib/repair-memory";
import { TAKEAWAY_TAG_LABELS } from "@/lib/use-repair-workflow";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ThemeColors } from "@/context/ThemeContext";

/** How the user chose to engage with the prior experience */
export type WhatHelpedAction =
  | "try_same"
  | "adapt"
  | "choose_different"
  | "not_related";

export interface WhatHelpedBeforeProps {
  /** ID of the current friction event */
  currentEventId: string;
  /** Category of the current friction event */
  currentCategory?: string | null;
  /** The couple ID */
  coupleId: string;
  /** The current authenticated user */
  userId: string;
  /** The candidate record (prior completed reconnection) */
  candidate: RepairMemoryCandidate;
  /** Called when the user picks an action */
  onAction?: (action: WhatHelpedAction) => void;
  /** Called when user selects "This situation is not related" */
  onNotRelated?: () => void;
}

const ACKNOWLEDGEMENT_TEXT: Record<"try_same" | "adapt", string> = {
  try_same: "✓ We’ll keep this approach in view while you work through this moment.",
  adapt: "✓ You can carry forward what helped and adjust it for this moment.",
};

export function WhatHelpedBefore({
  currentEventId,
  currentCategory,
  coupleId,
  userId,
  candidate,
  onAction,
  onNotRelated,
}: WhatHelpedBeforeProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [privateReflection, setPrivateReflection] = useState<string | null>(
    null
  );
  const [sharedTakeaway, setSharedTakeaway] = useState<{
    takeawayNote: string | null;
    takeawayTag: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<WhatHelpedAction | null>(null);
  const [selectedApproach, setSelectedApproach] = useState<"try_same" | "adapt" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      const [reflection, takeaway] = await Promise.all([
        fetchPriorPrivateReflection({
          priorEventId: candidate.eventId,
          userId,
        }),
        fetchPriorSharedTakeaway({ priorEventId: candidate.eventId }),
      ]);
      if (!cancelled) {
        setPrivateReflection(reflection);
        setSharedTakeaway(takeaway);
        setLoading(false);
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [candidate.eventId, userId]);

  const handleAction = useCallback(
    async (action: WhatHelpedAction) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setActionLoading(true);
      setActiveAction(action);
      setActionError(null);

      try {
        if (action === "not_related") {
          const res = await saveRelationDecision({
            currentEventId,
            priorEventId: candidate.eventId,
            coupleId,
            userId,
            decision: "different",
          });
          if (res?.error) {
            setActionError("Unable to update relation. Please try again.");
            return;
          }
          onNotRelated?.();
          onAction?.(action);
          return;
        }

        if (action === "try_same" || action === "adapt") {
          if (currentCategory && candidate.category !== currentCategory) {
            return;
          }
          const res = await saveRelationDecision({
            currentEventId,
            priorEventId: candidate.eventId,
            coupleId,
            userId,
            decision: "related",
          });
          if (res?.error) {
            setActionError("Unable to save selection. Please try again.");
            return;
          }
          setSelectedApproach(action);
          onAction?.(action);
          return;
        }

        if (action === "choose_different") {
          setSelectedApproach(null);
          onAction?.(action);
          return;
        }
      } catch {
        setActionError("An unexpected error occurred. Please try again.");
      } finally {
        isProcessingRef.current = false;
        setActionLoading(false);
        setActiveAction(null);
      }
    },
    [currentEventId, candidate.eventId, coupleId, userId, onAction, onNotRelated]
  );

  const categoryLabel = candidate.category
    ? formatCategory(candidate.category)
    : null;

  const priorDate = new Date(candidate.createdAt).toLocaleDateString("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const hasReusableContent = Boolean(
    (privateReflection && privateReflection.trim().length > 0) ||
      (sharedTakeaway?.takeawayNote &&
        sharedTakeaway.takeawayNote.trim().length > 0) ||
      (sharedTakeaway?.takeawayTag &&
        sharedTakeaway.takeawayTag.trim().length > 0)
  );

  // Defensive check: Do not render guidance card if there is no reusable content, or if categories mismatch
  if (
    loading ||
    !hasReusableContent ||
    (currentCategory && candidate.category !== currentCategory)
  ) {
    return null;
  }

  return (
    <CouplySectionCard variant="lilac" style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.overline, { color: theme.primaryAccent }]}>
          WHAT HELPED BEFORE
        </Text>
      </View>

      {categoryLabel && (
        <Text style={[styles.categoryLabel, { color: theme.mutedText }]}>
          {categoryLabel} · {priorDate}
        </Text>
      )}

      <Text style={[styles.durationLine, { color: theme.primaryText }]}>
        Last time, you felt reconnected {candidate.repairDurationLabel}.
      </Text>

      <Text style={[styles.disclaimer, { color: theme.secondaryText }]}>
        Every situation is different. You can reuse, adapt or leave this
        approach.
      </Text>

      {/* Private reflection (current user's own — clearly labeled) */}
      {loading ? (
        <ActivityIndicator size="small" color={theme.primaryAccent} />
      ) : (
        <>
          {privateReflection ? (
            <View
              style={[
                styles.reflectionBlock,
                { backgroundColor: theme.secondarySurface },
              ]}
            >
              <Text
                style={[styles.reflectionLabel, { color: theme.mutedText }]}
              >
                You noted privately…
              </Text>
              <Text
                style={[styles.reflectionText, { color: theme.primaryText }]}
              >
                "{privateReflection}"
              </Text>
            </View>
          ) : null}

          {/* Shared takeaway (both partners' explicitly shared content) */}
          {sharedTakeaway?.takeawayNote ||
          sharedTakeaway?.takeawayTag ? (
            <View
              style={[
                styles.reflectionBlock,
                { backgroundColor: theme.blushSurface },
              ]}
            >
              <Text
                style={[styles.reflectionLabel, { color: theme.mutedText }]}
              >
                You both recorded…
              </Text>
              {sharedTakeaway.takeawayTag && (
                <Text
                  style={[
                    styles.reflectionText,
                    { color: theme.primaryText, fontWeight: "600" },
                  ]}
                >
                  {TAKEAWAY_TAG_LABELS[
                    sharedTakeaway.takeawayTag as keyof typeof TAKEAWAY_TAG_LABELS
                  ] ?? sharedTakeaway.takeawayTag}
                </Text>
              )}
              {sharedTakeaway.takeawayNote ? (
                <Text
                  style={[
                    styles.reflectionText,
                    { color: theme.primaryText },
                  ]}
                >
                  "{sharedTakeaway.takeawayNote}"
                </Text>
              ) : null}
            </View>
          ) : null}
        </>
      )}

      {/* Action choices — neutral labels, no compliance/score language */}
      <View style={styles.actions}>
        {(
          [
            {
              action: "try_same" as const,
              label: "Try the same shared approach",
            },
            { action: "adapt" as const, label: "Adapt it for this situation" },
            {
              action: "choose_different" as const,
              label: "Choose something different",
            },
            {
              action: "not_related" as const,
              label: "This situation is not related",
            },
          ] as { action: WhatHelpedAction; label: string }[]
        ).map(({ action, label }) => {
          const isSelected = selectedApproach === action;
          const isBusy = actionLoading && activeAction === action;
          const isNotRelated = action === "not_related";

          return (
            <Pressable
              key={action}
              disabled={actionLoading}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: isSelected
                    ? theme.primaryAccent
                    : isNotRelated
                    ? "transparent"
                    : theme.secondarySurface,
                  borderColor: isSelected
                    ? theme.primaryAccent
                    : isNotRelated
                    ? "transparent"
                    : theme.border,
                },
                pressed && !actionLoading && { opacity: 0.65 },
                actionLoading && !isBusy && { opacity: 0.5 },
              ]}
              onPress={() => handleAction(action)}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{
                selected: isSelected,
                busy: isBusy,
                disabled: actionLoading,
              }}
            >
              {isBusy ? (
                <ActivityIndicator
                  size="small"
                  color={
                    isSelected ? theme.primaryActionText : theme.primaryAccent
                  }
                />
              ) : (
                <Text
                  style={[
                    styles.actionBtnText,
                    {
                      color: isSelected
                        ? theme.primaryActionText
                        : isNotRelated
                        ? theme.mutedText
                        : theme.primaryText,
                    },
                  ]}
                >
                  {isSelected ? `✓ ${label}` : label}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Inline acknowledgement */}
      {selectedApproach && (
        <View
          style={[
            styles.acknowledgementBox,
            {
              backgroundColor: theme.blushSurface,
              borderColor: theme.borderSoft,
            },
          ]}
          accessibilityLiveRegion="polite"
        >
          <Text
            style={[styles.acknowledgementText, { color: theme.primaryText }]}
          >
            {ACKNOWLEDGEMENT_TEXT[selectedApproach]}
          </Text>
        </View>
      )}

      {/* Non-blocking error banner */}
      {actionError ? (
        <View
          style={[
            styles.errorBox,
            {
              backgroundColor: theme.status?.error?.bg ?? "#FDF0F0",
              borderColor: theme.status?.error?.border ?? "#FECDCA",
            },
          ]}
          accessibilityLiveRegion="assertive"
        >
          <Text
            style={[
              styles.errorText,
              { color: theme.status?.error?.text ?? "#B42318" },
            ]}
          >
            {actionError}
          </Text>
        </View>
      ) : null}
    </CouplySectionCard>
  );
}

function createStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: 10,
      marginTop: 12,
      marginBottom: 4,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    overline: {
      fontSize: 10.5,
      fontWeight: "700",
      letterSpacing: 0.8,
    },
    categoryLabel: {
      fontSize: 12.5,
      fontWeight: "500",
    },
    durationLine: {
      fontSize: 15,
      fontWeight: "600",
      lineHeight: 21,
    },
    disclaimer: {
      fontSize: 13,
      lineHeight: 18,
    },
    reflectionBlock: {
      borderRadius: 10,
      padding: 12,
      gap: 4,
    },
    reflectionLabel: {
      fontSize: 11.5,
      fontWeight: "600",
      letterSpacing: 0.2,
    },
    reflectionText: {
      fontSize: 13.5,
      lineHeight: 19,
    },
    actions: {
      gap: 8,
      marginTop: 4,
    },
    actionBtn: {
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    actionBtnText: {
      fontSize: 14,
      fontWeight: "600",
    },
    acknowledgementBox: {
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginTop: 2,
    },
    acknowledgementText: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "500",
    },
    errorBox: {
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 9,
      marginTop: 2,
    },
    errorText: {
      fontSize: 12.5,
      lineHeight: 17,
      fontWeight: "500",
    },
  });
}
