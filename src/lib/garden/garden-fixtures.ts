/**
 * Purple Garden - Painterly 2.5D Living Garden Fixtures
 *
 * Deterministic test and development fixtures covering:
 * - All 6 life stages
 * - Scaled event counts: 0, 1, 3, 10, 25, 50 mixed events
 * - Categorical histories: positive-only, reconnection-only, important-dates-only
 * - Theme variants: light, dim, dark
 * - Rest mode: day vs night resting
 * - Viewport layouts: compact vs full
 * - 3 distinct couple seeds for cross-couple variation
 */

import {
  type GardenCareEvent,
  type GardenCareSignals,
  type GardenStageKey,
  GARDEN_STAGES,
} from "../garden-generator";

export const FIXTURE_COUPLE_SEEDS = {
  ALPHA: "couple-seed-alpha-evergreen",
  BETA: "couple-seed-beta-wildflower",
  GAMMA: "couple-seed-gamma-riverside",
} as const;

export const FIXTURE_STAGES: Record<
  GardenStageKey,
  { label: string; minTotalUnits: number; careUnits: number; timeUnits: number }
> = {
  first_seedling: {
    label: GARDEN_STAGES.first_seedling.label,
    minTotalUnits: 0,
    careUnits: 0,
    timeUnits: 0,
  },
  tender_sapling: {
    label: GARDEN_STAGES.tender_sapling.label,
    minTotalUnits: 16,
    careUnits: 4,
    timeUnits: 12,
  },
  branching_out: {
    label: GARDEN_STAGES.branching_out.label,
    minTotalUnits: 36,
    careUnits: 10,
    timeUnits: 26,
  },
  leafy_canopy: {
    label: GARDEN_STAGES.leafy_canopy.label,
    minTotalUnits: 56,
    careUnits: 18,
    timeUnits: 38,
  },
  rooted_flourishing: {
    label: GARDEN_STAGES.rooted_flourishing.label,
    minTotalUnits: 76,
    careUnits: 30,
    timeUnits: 46,
  },
  garden_in_bloom: {
    label: GARDEN_STAGES.garden_in_bloom.label,
    minTotalUnits: 91,
    careUnits: 40,
    timeUnits: 55,
  },
};

export function createMockCareEvent(
  id: string,
  kind: "positive_moment" | "reconnection" | "important_date",
  timestamp: string,
  overrides?: Partial<GardenCareEvent>
): GardenCareEvent {
  return {
    id,
    kind,
    createdAt: timestamp,
    occurredAt: timestamp,
    displayTitle:
      kind === "positive_moment"
        ? `Shared walk (${id})`
        : kind === "reconnection"
        ? `Gentle talk (${id})`
        : `Anniversary (${id})`,
    ...overrides,
  };
}

/**
 * Deterministically generates a sequence of mock care events.
 */
export function generateMockEventSequence(
  count: number,
  composition: "mixed" | "positive_only" | "reconnection_only" | "important_date_only" = "mixed"
): GardenCareEvent[] {
  const events: GardenCareEvent[] = [];
  const baseTime = new Date("2026-01-01T10:00:00Z").getTime();
  const dayMs = 86400000;

  for (let i = 0; i < count; i++) {
    const timeIso = new Date(baseTime + i * dayMs * 2).toISOString();
    let kind: "positive_moment" | "reconnection" | "important_date";

    if (composition === "positive_only") {
      kind = "positive_moment";
    } else if (composition === "reconnection_only") {
      kind = "reconnection";
    } else if (composition === "important_date_only") {
      kind = "important_date";
    } else {
      // Mixed distribution: ~60% positive, ~25% reconnection, ~15% important dates
      const mod = i % 10;
      if (mod === 2 || mod === 7) {
        kind = "important_date";
      } else if (mod === 4 || mod === 9) {
        kind = "reconnection";
      } else {
        kind = "positive_moment";
      }
    }

    events.push(createMockCareEvent(`mock-ev-${i + 1}`, kind, timeIso));
  }

  return events;
}

export interface GardenFixtureScenario {
  id: string;
  name: string;
  coupleSeed: string;
  stageKey: GardenStageKey;
  totalGrowthUnits: number;
  careGrowthUnits: number;
  timeGrowthUnits: number;
  isResting: boolean;
  theme: "light" | "dim" | "dark";
  compact: boolean;
  careEvents: GardenCareEvent[];
  careSignals: GardenCareSignals;
}

export function buildFixtureScenario(
  stageKey: GardenStageKey,
  eventCount: number,
  options?: {
    coupleSeed?: string;
    isResting?: boolean;
    theme?: "light" | "dim" | "dark";
    compact?: boolean;
    composition?: "mixed" | "positive_only" | "reconnection_only" | "important_date_only";
  }
): GardenFixtureScenario {
  const stageCfg = FIXTURE_STAGES[stageKey];
  const events = generateMockEventSequence(eventCount, options?.composition || "mixed");

  let positiveMoments = 0;
  let reconnections = 0;
  let importantDates = 0;

  for (const ev of events) {
    if (ev.kind === "positive_moment") positiveMoments++;
    else if (ev.kind === "reconnection") reconnections++;
    else if (ev.kind === "important_date") importantDates++;
  }

  const careGrowthUnits = Math.min(40, eventCount * 2);
  const totalGrowthUnits = Math.max(stageCfg.minTotalUnits, careGrowthUnits + stageCfg.timeUnits);
  const timeGrowthUnits = totalGrowthUnits - careGrowthUnits;

  return {
    id: `scenario-${stageKey}-${eventCount}events-${options?.theme || "light"}-${options?.isResting ? "resting" : "day"}`,
    name: `${stageCfg.label} with ${eventCount} events (${options?.theme || "light"})`,
    coupleSeed: options?.coupleSeed || FIXTURE_COUPLE_SEEDS.ALPHA,
    stageKey,
    totalGrowthUnits,
    careGrowthUnits,
    timeGrowthUnits,
    isResting: Boolean(options?.isResting),
    theme: options?.theme || "light",
    compact: Boolean(options?.compact),
    careEvents: events,
    careSignals: {
      positiveMoments,
      reconnections,
      importantDates,
    },
  };
}

/**
 * Canonical test fixtures for standard validation suites.
 */
export const CANONICAL_FIXTURES = {
  zeroEventsSeedling: buildFixtureScenario("first_seedling", 0),
  oneEventSapling: buildFixtureScenario("tender_sapling", 1),
  threeEventsBranching: buildFixtureScenario("branching_out", 3),
  tenEventsCanopy: buildFixtureScenario("leafy_canopy", 10),
  twentyFiveEventsInBloom: buildFixtureScenario("rooted_flourishing", 25),
  fiftyEventsDeeplyRooted: buildFixtureScenario("garden_in_bloom", 50),
  positiveOnlyHistory: buildFixtureScenario("leafy_canopy", 15, { composition: "positive_only" }),
  reconnectionOnlyHistory: buildFixtureScenario("branching_out", 8, { composition: "reconnection_only" }),
  importantDatesOnlyHistory: buildFixtureScenario("branching_out", 5, { composition: "important_date_only" }),
  nightRestingMode: buildFixtureScenario("garden_in_bloom", 20, { isResting: true, theme: "dark" }),
  dimThemeMode: buildFixtureScenario("branching_out", 12, { theme: "dim" }),
  compactWidgetMode: buildFixtureScenario("leafy_canopy", 15, { compact: true }),
};
