/**
 * RepairMemorySuggestion.tsx
 *
 * A lightweight optional sheet displayed after a new friction has been saved,
 * when prior completed reconnections are found that may be related.
 *
 * Rules:
 * - Shown ONLY after the friction is fully saved (never blocks registration).
 * - Dismissed state is local — does not persist across app restarts.
 * - "This feels different" suppresses this exact candidate pairing permanently.
 * - "Maybe later" records a "deferred" decision and closes the sheet.
 * - "Show me" records a "related" decision and calls onShowCandidate.
 * - Maximum 3 candidates surfaced.
 * - Touch targets ≥ 44pt.
 */

import {
  CouplyPrimaryButton,
  CouplyQuietButton,
  CouplySectionCard,
} from "@/components/CouplyUI";
import { tokens } from "@/components/couply-tokens";
import { useTheme } from "@/context/ThemeContext";
import {
  MAX_REPAIR_MEMORY_CANDIDATES,
  RepairMemoryCandidate,
  RelationDecision,
  saveRelationDecision,
  suppressRepairMemory,
} from "@/lib/repair-memory";
import { formatCategory } from "@/lib/event-heading";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ThemeColors } from "@/context/ThemeContext";

export interface RepairMemorySuggestionProps {
  /** ID of the newly saved friction event */
  currentEventId: string;
  /** Category of the newly saved friction event */
  currentCategory?: string | null;
  /** The couple this event belongs to */
  coupleId: string;
  /** The current authenticated user */
  userId: string;
  /** Candidates returned from findRepairMemoryCandidates (1–3 items) */
  candidates: RepairMemoryCandidate[];
  /** Called when the user selects "Show me" for a candidate */
  onShowCandidate: (candidate: RepairMemoryCandidate) => void;
  /** Called when the user dismisses the sheet (any action closes it) */
  onDismiss: () => void;
}

export function RepairMemorySuggestion({
  currentEventId,
  currentCategory,
  coupleId,
  userId,
  candidates,
  onShowCandidate,
  onDismiss,
}: RepairMemorySuggestionProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [loading, setLoading] = useState(false);
  // Track which candidate IDs have been suppressed this session
  const [suppressedIds, setSuppressedIds] = useState<Set<string>>(new Set());
  const handlingActionRef = React.useRef(false);

  // Defensive display rule: only render candidates strictly matching currentCategory
  const visibleCandidates = candidates
    .filter(
      (c) =>
        !suppressedIds.has(c.eventId) &&
        (!currentCategory || c.category === currentCategory)
    )
    .slice(0, MAX_REPAIR_MEMORY_CANDIDATES);

  const saveDecision = useCallback(
    async (candidate: RepairMemoryCandidate, decision: RelationDecision) => {
      if (
        currentCategory &&
        candidate.category !== currentCategory &&
        decision !== "different"
      ) {
        // Defensive check: never persist a cross-category relation
        return;
      }
      setLoading(true);
      try {
        await saveRelationDecision({
          currentEventId,
          priorEventId: candidate.eventId,
          coupleId,
          userId,
          decision,
        });
      } catch {
        // Persistence failure must never block the user
      } finally {
        setLoading(false);
      }
    },
    [currentEventId, currentCategory, coupleId, userId]
  );

  const handleShowMe = useCallback(
    async (candidate: RepairMemoryCandidate) => {
      if (handlingActionRef.current) return;
      handlingActionRef.current = true;
      if (currentCategory && candidate.category !== currentCategory) {
        onDismiss();
        return;
      }
      await saveDecision(candidate, "related");
      onShowCandidate(candidate);
      onDismiss();
    },
    [currentCategory, saveDecision, onShowCandidate, onDismiss]
  );

  const handleMaybeLater = useCallback(
    async (candidate: RepairMemoryCandidate) => {
      if (handlingActionRef.current) return;
      handlingActionRef.current = true;
      if (currentCategory && candidate.category !== currentCategory) {
        onDismiss();
        return;
      }
      await saveDecision(candidate, "deferred");
      onDismiss();
    },
    [currentCategory, saveDecision, onDismiss]
  );

  const handleDifferent = useCallback(
    async (candidate: RepairMemoryCandidate) => {
      if (handlingActionRef.current) return;
      handlingActionRef.current = true;
      await saveDecision(candidate, "different");
      setSuppressedIds((prev) => new Set([...prev, candidate.eventId]));
      handlingActionRef.current = false;
      // If all candidates are now suppressed, dismiss the sheet
      if (visibleCandidates.length <= 1) {
        onDismiss();
      }
    },
    [saveDecision, visibleCandidates.length, onDismiss]
  );

  /**
   * Beta safety feature gate: "Do not suggest previous repair memories for
   * this moment." Stored privately — suppresses all future suggestions for
   * this specific friction event without implying any safety diagnosis.
   */
  const handleSuppressAll = useCallback(async () => {
    if (handlingActionRef.current) return;
    handlingActionRef.current = true;
    try {
      await suppressRepairMemory({ eventId: currentEventId, userId });
    } catch {
      // Persistence failure must never block the user
    }
    onDismiss();
  }, [currentEventId, userId, onDismiss]);

  if (visibleCandidates.length === 0) return null;

  // For MVP: show the top candidate (the persistence model supports multiple)
  const primary = visibleCandidates[0];
  const categoryLabel = primary.category
    ? formatCategory(primary.category)
    : null;

  return (
    <CouplySectionCard variant="lilac" style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.overline, { color: theme.primaryAccent }]}>
          THIS MAY FEEL FAMILIAR
        </Text>
        <Text style={[styles.heading, { color: theme.primaryText }]}>
          You worked through something related before
        </Text>
        <Text style={[styles.body, { color: theme.secondaryText }]}>
          Would revisiting what helped be useful?
        </Text>
      </View>

      {/* Prior event summary */}
      <View style={[styles.candidateCard, { borderColor: theme.borderSoft }]}>
        {categoryLabel && (
          <Text style={[styles.categoryLabel, { color: theme.mutedText }]}>
            {categoryLabel}
          </Text>
        )}
        <Text style={[styles.durationText, { color: theme.primaryText }]}>
          Last time, you felt reconnected {primary.repairDurationLabel}.
        </Text>
        {primary.sharedTopic ? (
          <Text
            style={[styles.sharedTopicText, { color: theme.secondaryText }]}
            numberOfLines={2}
          >
            "{primary.sharedTopic}"
          </Text>
        ) : null}
      </View>

      {/* Actions */}
      {loading ? (
        <ActivityIndicator
          size="small"
          color={theme.primaryAccent}
          style={{ marginTop: 8 }}
        />
      ) : (
        <View style={styles.actions}>
          <CouplyPrimaryButton
            label="Show me"
            onPress={() => handleShowMe(primary)}
            accessibilityLabel="Show what helped before"
            style={styles.primaryBtn}
          />
          <CouplyQuietButton
            label="Maybe later"
            onPress={() => handleMaybeLater(primary)}
            accessibilityLabel="Remind me later from the repair loop"
            style={styles.quietBtn}
          />
          <Pressable
            style={({ pressed }) => [
              styles.differentBtn,
              pressed && { opacity: 0.65 },
            ]}
            onPress={() => handleDifferent(primary)}
            accessibilityRole="button"
            accessibilityLabel="This feels different — do not suggest this pairing again"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text
              style={[styles.differentBtnText, { color: theme.mutedText }]}
            >
              This feels different
            </Text>
          </Pressable>
          {/* Beta safety feature gate: suppress all repair memory suggestions for this moment */}
          <Pressable
            style={({ pressed }) => [
              styles.differentBtn,
              { marginTop: 2 },
              pressed && { opacity: 0.65 },
            ]}
            onPress={handleSuppressAll}
            accessibilityRole="button"
            accessibilityLabel="Do not suggest previous repair memories for this moment"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text
              style={[styles.differentBtnText, { color: theme.mutedText, fontSize: 12.5 }]}
            >
              Do not suggest previous repair memories for this moment
            </Text>
          </Pressable>
        </View>
      )}
    </CouplySectionCard>
  );
}

function createStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginTop: 16,
      gap: 12,
    },
    header: {
      gap: 6,
    },
    overline: {
      fontSize: 10.5,
      fontWeight: "700",
      letterSpacing: 0.8,
    },
    heading: {
      fontSize: 16,
      fontWeight: "700",
      lineHeight: 22,
    },
    body: {
      fontSize: 14,
      lineHeight: 20,
    },
    candidateCard: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      backgroundColor: theme.surface,
      gap: 4,
    },
    categoryLabel: {
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.3,
    },
    durationText: {
      fontSize: 14,
      fontWeight: "600",
      lineHeight: 20,
    },
    sharedTopicText: {
      fontSize: 13,
      lineHeight: 18,
      fontStyle: "italic",
    },
    actions: {
      gap: 8,
    },
    primaryBtn: {
      minHeight: 44,
    },
    quietBtn: {
      minHeight: 44,
    },
    differentBtn: {
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
    },
    differentBtnText: {
      fontSize: 13.5,
      fontWeight: "500",
    },
  });
}
