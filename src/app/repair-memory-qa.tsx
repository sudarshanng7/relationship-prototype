/**
 * Repair Memory — Development-Only Visual QA Surface
 *
 * Route: /repair-memory-qa
 *
 * A development-only harness for visual inspection of the Repair Memory
 * "What Helped Before" feature. All fixtures are in-memory; zero database
 * writes are made.
 *
 * Fixtures:
 *  1. Post-save suggestion with one candidate
 *  2. Post-save suggestion with three candidates
 *  3. No-candidate state (suggestion sheet should not appear)
 *  4. What Helped Before — with private current-user reflection
 *  5. What Helped Before — with shared takeaway
 *  6. Deferred state inside the repair loop (candidate accessible from repair loop)
 *  7. Different/suppressed state (candidate suppressed)
 *  8. Post-reconnection helpfulness question
 *  9. Already-answered helpfulness state
 * 10. Same event pair — Partner A and Partner B with different decisions
 *
 * Strictly guarded by __DEV__. Redirects to /garden in production.
 */

import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect } from "expo-router";
import { tokens } from "@/components/couply-tokens";
import { CouplyHeader, CouplyPage, CouplySectionCard } from "@/components/CouplyUI";
import { useTheme } from "@/context/ThemeContext";
import { ThemeColors } from "@/context/ThemeContext";
import { RepairMemorySuggestion } from "@/components/RepairMemorySuggestion";
import { WhatHelpedBefore } from "@/components/WhatHelpedBefore";
import { HelpfulnessQuestion } from "@/components/HelpfulnessQuestion";
import type { RepairMemoryCandidate } from "@/lib/repair-memory";

// ---------------------------------------------------------------------------
// In-memory fixtures — no database writes
// ---------------------------------------------------------------------------

const FIXTURE_CANDIDATE_A: RepairMemoryCandidate = {
  eventId: "fixture-prior-event-aaa",
  category: "communication",
  createdAt: "2026-09-10T14:00:00.000Z",
  reconnectedAt: "2026-09-11T08:00:00.000Z",
  repairDurationLabel: "about 18 hours",
  repairDurationMs: 18 * 60 * 60 * 1000,
  sharedTopic: "We talked about interrupting each other",
  isCreatedByCurrentUser: true,
};

const FIXTURE_CANDIDATE_B: RepairMemoryCandidate = {
  eventId: "fixture-prior-event-bbb",
  category: "time_together",
  createdAt: "2026-07-20T10:00:00.000Z",
  reconnectedAt: "2026-07-22T10:00:00.000Z",
  repairDurationLabel: "about 2 days",
  repairDurationMs: 2 * 24 * 60 * 60 * 1000,
  sharedTopic: "Needed more intentional evenings together",
  isCreatedByCurrentUser: false,
};

const FIXTURE_CANDIDATE_C: RepairMemoryCandidate = {
  eventId: "fixture-prior-event-ccc",
  category: "communication",
  createdAt: "2026-05-01T09:00:00.000Z",
  reconnectedAt: "2026-05-01T17:30:00.000Z",
  repairDurationLabel: "about 8 hours",
  repairDurationMs: 8 * 60 * 60 * 1000,
  sharedTopic: null,
  isCreatedByCurrentUser: true,
};

const FIXTURE_CURRENT_EVENT_ID = "fixture-current-event-xyz";
const FIXTURE_COUPLE_ID = "fixture-couple-aabbccdd";
const FIXTURE_USER_ID_A = "fixture-user-partner-a";
const FIXTURE_USER_ID_B = "fixture-user-partner-b";

// ---------------------------------------------------------------------------
// Fixtures manifest
// ---------------------------------------------------------------------------

type FixtureId =
  | "one-candidate"
  | "three-candidates"
  | "no-candidates"
  | "what-helped-private"
  | "what-helped-shared"
  | "deferred"
  | "different"
  | "helpfulness-question"
  | "helpfulness-answered"
  | "partner-decisions";

const FIXTURES: { id: FixtureId; label: string }[] = [
  { id: "one-candidate", label: "1. Suggestion · 1 candidate" },
  { id: "three-candidates", label: "2. Suggestion · 3 candidates" },
  { id: "no-candidates", label: "3. No-candidate state" },
  { id: "what-helped-private", label: "4. What Helped Before · private reflection" },
  { id: "what-helped-shared", label: "5. What Helped Before · shared takeaway" },
  { id: "deferred", label: "6. Deferred — available in repair loop" },
  { id: "different", label: "7. Different/suppressed — candidate hidden" },
  { id: "helpfulness-question", label: "8. Post-reconnection helpfulness question" },
  { id: "helpfulness-answered", label: "9. Helpfulness already answered" },
  { id: "partner-decisions", label: "10. Partner A vs Partner B decisions" },
];

// ---------------------------------------------------------------------------
// Mock WhatHelpedBefore that uses hardcoded fixture data instead of Supabase
// ---------------------------------------------------------------------------

function MockWhatHelpedBefore({
  candidate,
  privateReflection,
  sharedTakeaway,
}: {
  candidate: RepairMemoryCandidate;
  privateReflection: string | null;
  sharedTakeaway: { takeawayNote: string | null; takeawayTag: string | null } | null;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createMockStyles(theme), [theme]);

  const categoryLabel = candidate.category
    ? candidate.category.replace(/_/g, " ")
    : null;

  const priorDate = new Date(candidate.createdAt).toLocaleDateString("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <CouplySectionCard variant="lilac" style={{ gap: 10, marginTop: 12 }}>
      <Text style={[styles.overline, { color: theme.primaryAccent }]}>
        WHAT HELPED BEFORE
      </Text>

      {categoryLabel && (
        <Text style={[styles.categoryLabel, { color: theme.mutedText }]}>
          {categoryLabel} · {priorDate}
        </Text>
      )}

      <Text style={[styles.durationLine, { color: theme.primaryText }]}>
        Last time, you felt reconnected {candidate.repairDurationLabel}.
      </Text>

      <Text style={[styles.disclaimer, { color: theme.secondaryText }]}>
        Every situation is different. You can reuse, adapt or leave this approach.
      </Text>

      {privateReflection ? (
        <View style={[styles.reflectionBlock, { backgroundColor: theme.secondarySurface }]}>
          <Text style={[styles.reflectionLabel, { color: theme.mutedText }]}>
            You noted privately…
          </Text>
          <Text style={[styles.reflectionText, { color: theme.primaryText }]}>
            "{privateReflection}"
          </Text>
        </View>
      ) : (
        <View style={[styles.reflectionBlock, { backgroundColor: theme.secondarySurface, opacity: 0.5 }]}>
          <Text style={[styles.reflectionLabel, { color: theme.mutedText }]}>
            You noted privately…
          </Text>
          <Text style={[styles.reflectionText, { color: theme.mutedText }]}>
            (no private reflection for this event)
          </Text>
        </View>
      )}

      {sharedTakeaway?.takeawayNote ? (
        <View style={[styles.reflectionBlock, { backgroundColor: theme.blushSurface }]}>
          <Text style={[styles.reflectionLabel, { color: theme.mutedText }]}>
            You both recorded…
          </Text>
          <Text style={[styles.reflectionText, { color: theme.primaryText }]}>
            "{sharedTakeaway.takeawayNote}"
          </Text>
        </View>
      ) : null}

      <View style={{ gap: 8, marginTop: 4 }}>
        {[
          "Try the same shared approach",
          "Adapt it for this situation",
          "Choose something different",
          "This situation is not related",
        ].map((label) => (
          <View
            key={label}
            style={{
              minHeight: 44,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: label === "This situation is not related"
                ? "transparent"
                : theme.secondarySurface,
              paddingHorizontal: 14,
              paddingVertical: 11,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: label === "This situation is not related"
                  ? theme.mutedText
                  : theme.primaryText,
              }}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>
    </CouplySectionCard>
  );
}

// ---------------------------------------------------------------------------
// Mock HelpfulnessQuestion (answered state)
// ---------------------------------------------------------------------------

function HelpfulnessAnsweredState() {
  const { theme } = useTheme();
  return (
    <CouplySectionCard variant="lilac" style={{ gap: 10, marginTop: 12 }}>
      <Text style={{ fontSize: 15, fontWeight: "700", color: theme.primaryText }}>
        Did revisiting your previous experience help this time?
      </Text>
      <Text style={{ fontSize: 12.5, color: theme.secondaryText }}>
        Your answer is private to you.
      </Text>
      <View
        style={{
          backgroundColor: theme.secondarySurface,
          borderRadius: 10,
          padding: 12,
        }}
      >
        <Text style={{ fontSize: 13.5, color: theme.mutedText }}>
          ✓ You answered: "Yes, it helped" (saved privately)
        </Text>
      </View>
    </CouplySectionCard>
  );
}

// ---------------------------------------------------------------------------
// Partner decisions side-by-side
// ---------------------------------------------------------------------------

function PartnerDecisionsFixture() {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <CouplySectionCard style={{ gap: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: theme.mutedText, letterSpacing: 0.5 }}>
          PARTNER A — THEIR PERSPECTIVE
        </Text>
        <Text style={{ fontSize: 14, color: theme.primaryText, fontWeight: "600" }}>
          Decision: related
        </Text>
        <Text style={{ fontSize: 13, color: theme.secondaryText }}>
          Partner A sees this as the same recurring pattern and chose "Show me".
        </Text>
        <Text style={{ fontSize: 11.5, color: theme.mutedText }}>
          → WhatHelpedBefore card shown in their repair loop
        </Text>
      </CouplySectionCard>

      <CouplySectionCard style={{ gap: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: theme.mutedText, letterSpacing: 0.5 }}>
          PARTNER B — THEIR PERSPECTIVE
        </Text>
        <Text style={{ fontSize: 14, color: theme.primaryText, fontWeight: "600" }}>
          Decision: different
        </Text>
        <Text style={{ fontSize: 13, color: theme.secondaryText }}>
          Partner B sees this as a completely different situation and chose "This feels different".
        </Text>
        <Text style={{ fontSize: 11.5, color: theme.mutedText }}>
          → Candidate suppressed for Partner B; not shown again for this pair
        </Text>
      </CouplySectionCard>

      <CouplySectionCard variant="lilac" style={{ gap: 6 }}>
        <Text style={{ fontSize: 12, fontWeight: "600", color: theme.secondaryText }}>
          Invariant: Partners A and B share the same couple and event pair, but
          each holds a fully independent decision record. Neither decision is
          visible to the other. Both are stored in friction_moment_relations with
          separate (current_event_id, prior_event_id, user_id) rows.
        </Text>
      </CouplySectionCard>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Deferred state fixture
// ---------------------------------------------------------------------------

function DeferredStateFixture() {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <CouplySectionCard variant="lilac" style={{ gap: 8 }}>
        <Text style={{ fontSize: 10.5, fontWeight: "700", letterSpacing: 0.8, color: theme.primaryAccent }}>
          WHAT HELPED BEFORE
        </Text>
        <Text style={{ fontSize: 13, color: theme.secondaryText }}>
          Decision: deferred — the user chose "Maybe later" on the post-save sheet.
          This card is accessible from the repair loop for the duration of the event.
        </Text>
        <Text style={{ fontSize: 14, fontWeight: "600", color: theme.primaryText }}>
          Last time, you felt reconnected about 18 hours.
        </Text>
        <Text style={{ fontSize: 12, color: theme.mutedText }}>
          → Deferred candidates are loaded from fetchRelationDecisions in event/[id].tsx
          and shown if decision is "deferred", "related", or "somewhat_related".
        </Text>
      </CouplySectionCard>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Different/suppressed state fixture
// ---------------------------------------------------------------------------

function DifferentStateFixture() {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <CouplySectionCard style={{ gap: 8 }}>
        <Text style={{ fontSize: 10.5, fontWeight: "700", letterSpacing: 0.8, color: theme.mutedText }}>
          SUPPRESSED CANDIDATE
        </Text>
        <Text style={{ fontSize: 14, fontWeight: "600", color: theme.primaryText }}>
          Decision: different
        </Text>
        <Text style={{ fontSize: 13, color: theme.secondaryText }}>
          The user chose "This feels different" on the post-save sheet.
          This candidate is permanently suppressed for this user+event pair.
          The findRepairMemoryCandidates function excludes it on future lookups.
        </Text>
        <Text style={{ fontSize: 12, color: theme.mutedText }}>
          → suppressedPriorIds.has(candidate.eventId) = true
          → Session-local suppression in RepairMemorySuggestion
          → Permanent suppression stored in friction_moment_relations.decision = 'different'
        </Text>
      </CouplySectionCard>

      <CouplySectionCard variant="lilac" style={{ gap: 8 }}>
        <Text style={{ fontSize: 13, color: theme.secondaryText }}>
          No suggestion card is shown. The user navigates directly to their repair loop.
        </Text>
        <View style={{
          minHeight: 44,
          borderRadius: 10,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.borderSoft,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 14,
        }}>
          <Text style={{ color: theme.mutedText, fontSize: 13 }}>
            (no suggestion shown)
          </Text>
        </View>
      </CouplySectionCard>
    </View>
  );
}

// ---------------------------------------------------------------------------
// No-candidate state
// ---------------------------------------------------------------------------

function NoCandidateStateFixture() {
  const { theme } = useTheme();
  return (
    <CouplySectionCard style={{ gap: 8 }}>
      <Text style={{ fontSize: 14, fontWeight: "700", color: theme.primaryText }}>
        No candidates found
      </Text>
      <Text style={{ fontSize: 13, color: theme.secondaryText }}>
        findRepairMemoryCandidates returned an empty array. showSuggestion is false.
        The user navigates directly to their saved event's repair loop.
      </Text>
      <Text style={{ fontSize: 12, color: theme.mutedText }}>
        Reasons candidates may be absent:
        — No prior completed reconnections for this couple
        — All prior candidates were marked "different"
        — suppress_repair_memory = true for this event (beta gate)
        — Lookup failed (non-blocking; user still reaches repair loop)
      </Text>
    </CouplySectionCard>
  );
}

// ---------------------------------------------------------------------------
// Fixture selector tabs
// ---------------------------------------------------------------------------

function FixtureTab({
  selected,
  label,
  onPress,
}: {
  selected: boolean;
  label: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      style={[
        tabStyles.tab,
        {
          backgroundColor: selected ? theme.primaryAccent : theme.surface,
          borderColor: selected ? theme.primaryAccent : theme.border,
        },
      ]}
    >
      <Text
        style={[
          tabStyles.tabLabel,
          { color: selected ? "#fff" : theme.secondaryText },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const tabStyles = StyleSheet.create({
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
    minHeight: 36,
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 11.5,
    fontWeight: "600",
  },
});

// ---------------------------------------------------------------------------
// Main QA screen
// ---------------------------------------------------------------------------

export default function RepairMemoryQA() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!__DEV__) {
    return <Redirect href="/garden" />;
  }

  const [activeFixture, setActiveFixture] = useState<FixtureId>("one-candidate");

  // Track dismissal state for suggestion demo
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [helpfulnessCompleted, setHelpfulnessCompleted] = useState(false);

  function resetFixture() {
    setSuggestionDismissed(false);
    setHelpfulnessCompleted(false);
  }

  function renderFixture() {
    switch (activeFixture) {
      case "one-candidate":
        return (
          <View style={{ gap: 12 }}>
            <CouplySectionCard style={{ gap: 4 }}>
              <Text style={[styles.fixtureMeta, { color: theme.mutedText }]}>
                Post-save confirmation · 1 candidate found
              </Text>
              <Text style={[styles.fixtureNote, { color: theme.secondaryText }]}>
                ✓ Your friction moment has been saved and your repair loop is open.
              </Text>
            </CouplySectionCard>
            {suggestionDismissed ? (
              <CouplySectionCard variant="lilac" style={{ gap: 4 }}>
                <Text style={{ color: theme.secondaryText, fontSize: 13 }}>
                  Sheet dismissed — user would navigate to repair loop.
                </Text>
                <Pressable onPress={resetFixture} style={styles.resetBtn}>
                  <Text style={{ color: theme.primaryAccent, fontSize: 13, fontWeight: "600" }}>
                    Reset fixture
                  </Text>
                </Pressable>
              </CouplySectionCard>
            ) : (
              <RepairMemorySuggestion
                currentEventId={FIXTURE_CURRENT_EVENT_ID}
                coupleId={FIXTURE_COUPLE_ID}
                userId={FIXTURE_USER_ID_A}
                candidates={[FIXTURE_CANDIDATE_A]}
                onShowCandidate={() => setSuggestionDismissed(true)}
                onDismiss={() => setSuggestionDismissed(true)}
              />
            )}
          </View>
        );

      case "three-candidates":
        return (
          <View style={{ gap: 12 }}>
            <CouplySectionCard style={{ gap: 4 }}>
              <Text style={[styles.fixtureMeta, { color: theme.mutedText }]}>
                Post-save confirmation · 3 candidates found (shows top 1 for MVP)
              </Text>
            </CouplySectionCard>
            {suggestionDismissed ? (
              <CouplySectionCard variant="lilac" style={{ gap: 4 }}>
                <Text style={{ color: theme.secondaryText, fontSize: 13 }}>
                  Sheet dismissed.
                </Text>
                <Pressable onPress={resetFixture} style={styles.resetBtn}>
                  <Text style={{ color: theme.primaryAccent, fontSize: 13, fontWeight: "600" }}>Reset</Text>
                </Pressable>
              </CouplySectionCard>
            ) : (
              <RepairMemorySuggestion
                currentEventId={FIXTURE_CURRENT_EVENT_ID}
                coupleId={FIXTURE_COUPLE_ID}
                userId={FIXTURE_USER_ID_A}
                candidates={[FIXTURE_CANDIDATE_A, FIXTURE_CANDIDATE_B, FIXTURE_CANDIDATE_C]}
                onShowCandidate={() => setSuggestionDismissed(true)}
                onDismiss={() => setSuggestionDismissed(true)}
              />
            )}
          </View>
        );

      case "no-candidates":
        return <NoCandidateStateFixture />;

      case "what-helped-private":
        return (
          <MockWhatHelpedBefore
            candidate={FIXTURE_CANDIDATE_A}
            privateReflection="We both needed to slow down and actually listen before responding."
            sharedTakeaway={null}
          />
        );

      case "what-helped-shared":
        return (
          <MockWhatHelpedBefore
            candidate={FIXTURE_CANDIDATE_A}
            privateReflection={null}
            sharedTakeaway={{
              takeawayNote: "Taking a 10-minute walk before continuing the conversation really helped.",
              takeawayTag: "took_space",
            }}
          />
        );

      case "deferred":
        return <DeferredStateFixture />;

      case "different":
        return <DifferentStateFixture />;

      case "helpfulness-question":
        return helpfulnessCompleted ? (
          <CouplySectionCard variant="lilac" style={{ gap: 4 }}>
            <Text style={{ color: theme.secondaryText, fontSize: 13 }}>
              Helpfulness response saved privately.
            </Text>
            <Pressable onPress={resetFixture} style={styles.resetBtn}>
              <Text style={{ color: theme.primaryAccent, fontSize: 13, fontWeight: "600" }}>Reset</Text>
            </Pressable>
          </CouplySectionCard>
        ) : (
          <HelpfulnessQuestion
            currentEventId={FIXTURE_CURRENT_EVENT_ID}
            priorEventId={FIXTURE_CANDIDATE_A.eventId}
            userId={FIXTURE_USER_ID_A}
            onComplete={() => setHelpfulnessCompleted(true)}
          />
        );

      case "helpfulness-answered":
        return <HelpfulnessAnsweredState />;

      case "partner-decisions":
        return <PartnerDecisionsFixture />;

      default:
        return null;
    }
  }

  return (
    <CouplyPage>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <CouplyHeader
          title="Repair Memory QA"
          subtitle="Development fixtures — zero database writes"
          style={styles.header}
        />

        {/* Beta / DEV warning banner */}
        <View style={[styles.devBanner, { backgroundColor: tokens.colors.warningSoft, borderColor: tokens.colors.warningBorder }]}>
          <Text style={[styles.devBannerText, { color: tokens.colors.warningText }]}>
            DEV ONLY · All fixtures are in-memory · No Supabase writes · Beta feature
          </Text>
        </View>

        {/* Fixture selector */}
        <View style={styles.fixtureSelector}>
          {FIXTURES.map(({ id, label }) => (
            <FixtureTab
              key={id}
              selected={activeFixture === id}
              label={label}
              onPress={() => { setActiveFixture(id); resetFixture(); }}
            />
          ))}
        </View>

        {/* Active fixture */}
        <View style={styles.fixtureContainer}>
          {renderFixture()}
        </View>

        {/* Privacy invariants reminder */}
        <CouplySectionCard variant="lilac" style={{ marginTop: 24, gap: 6 }}>
          <Text style={{ fontSize: 10.5, fontWeight: "700", letterSpacing: 0.5, color: theme.mutedText }}>
            PRIVACY INVARIANTS (all fixtures)
          </Text>
          <Text style={{ fontSize: 11.5, lineHeight: 16, color: theme.secondaryText }}>
            • Private reflections: author_id filter — never shown to partner{"\n"}
            • Shared takeaway: couple-visible via RLS on repair_outcomes{"\n"}
            • Relation decisions: user_id = auth.uid() — private per person{"\n"}
            • Helpfulness response: user_id scoped — never aggregated or scored{"\n"}
            • suppress_repair_memory: private to creator — never shared{"\n"}
            • Garden contribution from linking: 0 (unchanged)
          </Text>
        </CouplySectionCard>

        <View style={{ height: 60 }} />
      </ScrollView>
    </CouplyPage>
  );
}

function createMockStyles(theme: ThemeColors) {
  return StyleSheet.create({
    overline: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.8 },
    categoryLabel: { fontSize: 12.5, fontWeight: "500" },
    durationLine: { fontSize: 15, fontWeight: "600", lineHeight: 21 },
    disclaimer: { fontSize: 13, lineHeight: 18 },
    reflectionBlock: { borderRadius: 10, padding: 12, gap: 4 },
    reflectionLabel: { fontSize: 11.5, fontWeight: "600", letterSpacing: 0.2 },
    reflectionText: { fontSize: 13.5, lineHeight: 19 },
  });
}

function createStyles(theme: ThemeColors) {
  return StyleSheet.create({
    scroll: { flex: 1 },
    content: { paddingHorizontal: 16, paddingBottom: 32 },
    header: { marginBottom: 12 },
    devBanner: {
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 7,
      marginBottom: 16,
      alignItems: "center",
    },
    devBannerText: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.3,
      textAlign: "center",
    },
    fixtureSelector: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginBottom: 16,
    },
    fixtureContainer: {
      minHeight: 200,
    },
    fixtureMeta: {
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.3,
    },
    fixtureNote: {
      fontSize: 13,
      lineHeight: 18,
    },
    resetBtn: {
      minHeight: 36,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 4,
    },
  });
}
