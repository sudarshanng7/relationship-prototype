import {
  type GardenCareEvent,
  type GardenCareSignals,
  type GardenStage,
  type GardenStageKey,
  GARDEN_STAGES,
  getGardenStage,
  getCareFeatureId,
  stableEventHash,
} from "./garden-generator";

const STAGE_KEYS: GardenStageKey[] = [
  "first_seedling",
  "tender_sapling",
  "branching_out",
  "leafy_canopy",
  "rooted_flourishing",
  "garden_in_bloom",
];

/**
 * Explanatory line for the honest historical playback:
 * Playback is a reconstruction from currently available shared records, NOT an exact audit history.
 */
export const GARDEN_STORY_EXPLANATION =
  "A look back, grown from the shared moments still in your garden.";

export type StoryEventKind =
  | "positive_moment"
  | "reconnection"
  | "important_date"
  | "time_growth"
  | "stage_transition"
  | "today";

export interface GardenStoryChapter {
  id: string;
  title: string;
  chapterIndex: number; // 0-based
  totalChapters: number;
  stepCount: number;
}

/**
 * Individual chronological growth step within Our Garden Story.
 *
 * RESTING AMBIENCE POLICY:
 * - Historical steps (stepIndex < totalSteps - 1) depict active chronological growth;
 *   resting ambience is intentionally false for historical steps to show the botanical tree
 *   unfolding actively through time.
 * - The final "today" step (isFinal === true) strictly adopts the snapshot's live resting
 *   ambience (snapshot.isResting) so it matches the live garden visualizer scene identically.
 */
export interface GardenStoryStep {
  id: string;
  chapterId: string;
  chapterTitle: string;
  chapterIndex: number;
  totalChapters: number;
  stepIndex: number; // 0-based across whole story
  totalSteps: number;
  chapterStepIndex: number; // 1-based index within its chapter
  chapterTotalSteps: number; // total steps within its chapter
  effectiveTimestamp: string; // ISO string
  addedEventKey: string | null; // e.g. "positive_moment:uuid"
  eventKind: StoryEventKind;
  cumulativeCareEvents: GardenCareEvent[];
  timeGrowthUnits: number;
  careGrowthUnits: number;
  totalGrowthUnits: number;
  stage: GardenStage;
  careSignals: GardenCareSignals;
  caption: string;
  dateLabel: string | null;
  highlightFeatureId: string | null; // e.g. "care-positive-01a2b3c4"
  isResting: boolean;
  isFinal: boolean;
}

// Backward-compatible alias for existing consumers
export type GardenStoryFrame = GardenStoryStep;

/**
 * Immutable snapshot captured when user initiates playback.
 * Preserves stable playback even if live queries subsequently refresh.
 */
export interface GardenStorySnapshot {
  coupleId: string;
  seedString: string;
  createdAt: string | null;
  careEvents: GardenCareEvent[];
  asOfTime: string; // ISO string captured once at start of playback
  isResting: boolean;
  themeKey?: string;
  pacing?: "gentle" | "quick";
}

/**
 * Complete story model containing ordered chapters, steps, and metadata.
 */
export interface GardenStory {
  chapters: GardenStoryChapter[];
  steps: GardenStoryStep[];
  frames: GardenStoryStep[]; // backward-compatible alias to steps
  seedString: string;
  asOfTime: string;
  totalSteps: number;
  totalChapters: number;
  hasCareEvents: boolean;
  explanation: string;
  isResting: boolean;
  themeKey?: string;
  pacing: "gentle" | "quick";
}

/**
 * Month names for UTC deterministic date formatting.
 */
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

/**
 * Formats a timestamp into a UTC date string (e.g. "Mar 15, 2026")
 * so both partners see the exact same chronological day regardless of local timezone.
 */
export function formatStoryDateUtc(isoStringOrMs: string | number): string {
  const d = new Date(isoStringOrMs);
  if (isNaN(d.getTime())) return "";
  const month = MONTH_NAMES[d.getUTCMonth()];
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  return `${month} ${day}, ${year}`;
}

/**
 * Privacy-safe caption for stage transition steps.
 */
export function getStageTransitionCaption(stageKey: string): string {
  switch (stageKey) {
    case "tender_sapling":
      return "The young tree grew into a tender sapling.";
    case "branching_out":
      return "New branches found room to stretch.";
    case "leafy_canopy":
      return "The canopy became fuller.";
    case "rooted_flourishing":
      return "The garden became more deeply rooted.";
    case "garden_in_bloom":
      return "The garden came into bloom.";
    default:
      return "With time, the first seedling began to take shape.";
  }
}

/**
 * Helper to compute growth units, stage, and care signals for a given set of events and elapsed days.
 * Strictly reuses the canonical Purple Garden formulas:
 * - timeGrowthUnits = min(60, elapsedDays * 0.5)
 * - careGrowthUnits = min(40, positive * 2 + reconnections * 4 + importantDates * 2)
 * - totalGrowthUnits = min(100, timeGrowthUnits + careGrowthUnits)
 * - stage = getGardenStage(totalGrowthUnits)
 */
export function calculateHistoricalGrowth(
  events: GardenCareEvent[],
  elapsedDays: number
): {
  timeGrowthUnits: number;
  careGrowthUnits: number;
  totalGrowthUnits: number;
  stage: GardenStage;
  careSignals: GardenCareSignals;
} {
  const timeGrowthUnits = Math.min(60, Math.max(0, elapsedDays * 0.5));
  const posCount = events.filter((e) => e.kind === "positive_moment").length;
  const recCount = events.filter((e) => e.kind === "reconnection").length;
  const impCount = events.filter((e) => e.kind === "important_date").length;

  const rawCareUnits = posCount * 2 + recCount * 4 + impCount * 2;
  const careGrowthUnits = Math.min(40, rawCareUnits);
  const totalGrowthUnits = Math.min(100, timeGrowthUnits + careGrowthUnits);
  const stage = getGardenStage(totalGrowthUnits);

  const careSignals: GardenCareSignals = {
    positiveMoments: posCount,
    reconnections: recCount,
    importantDates: impCount,
  };

  return {
    timeGrowthUnits,
    careGrowthUnits,
    totalGrowthUnits,
    stage,
    careSignals,
  };
}

/**
 * Resolves the authoritative historical timestamp for when an event was added or earned:
 * - positive_moment: created_at (when shared)
 * - reconnection: reconnected_at (when repair completed)
 * - important_date: created_at (when recorded into the couple space), or occurredAt if createdAt
 *   is absent; clamped to not precede couple creation so historical anniversary dates from past
 *   years do not appear before the garden itself began.
 */
export function getEventEffectiveTimestamp(
  event: GardenCareEvent,
  coupleCreatedAt: number | string | null,
  asOfTime: number | string
): number {
  const coupleCreatedMs =
    typeof coupleCreatedAt === "number"
      ? coupleCreatedAt
      : coupleCreatedAt
      ? new Date(coupleCreatedAt).getTime()
      : NaN;

  const asOfMs =
    typeof asOfTime === "number"
      ? asOfTime
      : asOfTime
      ? new Date(asOfTime).getTime()
      : Date.now();

  let t = NaN;

  if (event.kind === "important_date" && event.createdAt) {
    t = new Date(event.createdAt).getTime();
  }

  if (isNaN(t)) {
    t = new Date(event.occurredAt).getTime();
  }

  if (isNaN(t)) {
    t = !isNaN(coupleCreatedMs) ? coupleCreatedMs : asOfMs;
  }

  // Clamping rule: milestone events cannot pre-date the couple's existence in the garden
  if (!isNaN(coupleCreatedMs) && t < coupleCreatedMs) {
    t = coupleCreatedMs;
  }

  // Upper bound clamping: milestone events cannot appear in future after asOfTime
  if (!isNaN(asOfMs) && t > asOfMs) {
    t = asOfMs;
  }

  return t;
}

const KIND_TIE_BREAK_ORDER: Record<string, number> = {
  reconnection: 0,
  positive_moment: 1,
  important_date: 2,
};

interface InterimStep {
  id: string;
  chapterTitle: string;
  effectiveTimestamp: string;
  addedEventKey: string | null;
  eventKind: StoryEventKind;
  cumulativeCareEvents: GardenCareEvent[];
  timeGrowthUnits: number;
  careGrowthUnits: number;
  totalGrowthUnits: number;
  stage: GardenStage;
  careSignals: GardenCareSignals;
  caption: string;
  dateLabel: string | null;
  highlightFeatureId: string | null;
  isResting: boolean;
  isFinal: boolean;
}

/**
 * Pure generator constructing the immutable chronological chapters and individual growth steps
 * of Our Garden Story.
 * Every eligible care event receives exactly one dedicated growth step.
 * Never calls Date.now() internally; relies strictly on snapshot.asOfTime.
 */
export function createGardenStory(snapshot: GardenStorySnapshot): GardenStory {
  const asOfMs = new Date(snapshot.asOfTime).getTime();
  const safeAsOfMs = isNaN(asOfMs) ? Date.now() : asOfMs;

  const coupleCreatedMs = snapshot.createdAt
    ? new Date(snapshot.createdAt).getTime()
    : NaN;

  // 1. Deduplicate and filter out future events relative to safeAsOfMs
  const dedupMap = new Map<string, { event: GardenCareEvent; effectiveMs: number }>();
  for (const ev of snapshot.careEvents || []) {
    const effMs = getEventEffectiveTimestamp(ev, coupleCreatedMs, safeAsOfMs);
    if (effMs <= safeAsOfMs) {
      dedupMap.set(`${ev.kind}:${ev.id}`, { event: ev, effectiveMs: effMs });
    }
  }

  // 2. Canonical deterministic sort:
  //    1. effectiveMs ascending
  //    2. fixed event kind rank (reconnection < positive_moment < important_date)
  //    3. event.id ascending (localeCompare)
  const sortedEntries = Array.from(dedupMap.values()).sort((a, b) => {
    if (a.effectiveMs !== b.effectiveMs) return a.effectiveMs - b.effectiveMs;
    const rankA = KIND_TIE_BREAK_ORDER[a.event.kind] ?? 99;
    const rankB = KIND_TIE_BREAK_ORDER[b.event.kind] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    return a.event.id.localeCompare(b.event.id);
  });

  // Count cluster sizes for identical timestamps (for collective caption rule)
  const timestampCounts = new Map<number, number>();
  for (const entry of sortedEntries) {
    const c = timestampCounts.get(entry.effectiveMs) || 0;
    timestampCounts.set(entry.effectiveMs, c + 1);
  }

  // 3. Establish beginning timestamp and elapsed boundaries
  const startMs = !isNaN(coupleCreatedMs)
    ? coupleCreatedMs
    : sortedEntries.length > 0
    ? sortedEntries[0].effectiveMs
    : safeAsOfMs;

  const totalElapsedDays = Math.max(
    0,
    Math.floor((safeAsOfMs - startMs) / (1000 * 60 * 60 * 24))
  );

  const rawSteps: InterimStep[] = [];

  // Step 0: The Quiet Beginning
  const initialGrowth = calculateHistoricalGrowth([], 0);
  rawSteps.push({
    id: "step-beginning",
    chapterTitle: "The Beginning",
    effectiveTimestamp: new Date(startMs).toISOString(),
    addedEventKey: null,
    eventKind: "time_growth",
    cumulativeCareEvents: [],
    timeGrowthUnits: initialGrowth.timeGrowthUnits,
    careGrowthUnits: initialGrowth.careGrowthUnits,
    totalGrowthUnits: initialGrowth.totalGrowthUnits,
    stage: initialGrowth.stage,
    careSignals: initialGrowth.careSignals,
    caption: "A quiet beginning is taking root.",
    dateLabel: formatStoryDateUtc(startMs),
    highlightFeatureId: null,
    isResting: false,
    isFinal: false,
  });

  let currentCumulative: GardenCareEvent[] = [];
  let lastRecordedElapsedDays = 0;
  let lastRecordedStageKey = initialGrowth.stage.key;

  // 4. Chronological traversal through every qualifying care event
  for (let i = 0; i < sortedEntries.length; i++) {
    const entry = sortedEntries[i];
    const event = entry.event;
    const eventElapsedDays = Math.max(
      0,
      Math.floor((entry.effectiveMs - startMs) / (1000 * 60 * 60 * 24))
    );

    // 4A. Check if elapsed time alone crossed one or more stage thresholds before this event
    const currentCareUnits = calculateHistoricalGrowth(currentCumulative, 0).careGrowthUnits;
    const timeUnitsBeforeTime = Math.min(60, lastRecordedElapsedDays * 0.5);
    const timeUnitsAtEvent = Math.min(60, eventElapsedDays * 0.5);

    const startStageIdx = STAGE_KEYS.indexOf(lastRecordedStageKey);
    if (startStageIdx !== -1) {
      for (let s = startStageIdx + 1; s < STAGE_KEYS.length; s++) {
        const candidateStageKey = STAGE_KEYS[s];
        const candidateStage = GARDEN_STAGES[candidateStageKey];
        const neededUnitsFromTime = candidateStage.minUnits - currentCareUnits;

        if (neededUnitsFromTime > 60) {
          // Time alone caps at 60 units; cannot reach this stage without care events
          break;
        }

        if (neededUnitsFromTime > timeUnitsBeforeTime && neededUnitsFromTime <= timeUnitsAtEvent) {
          const transDays = Math.ceil(neededUnitsFromTime / 0.5);
          const transMs = startMs + transDays * (1000 * 60 * 60 * 24);
          const transGrowth = calculateHistoricalGrowth(currentCumulative, transDays);

          rawSteps.push({
            id: `step-time-stage-${candidateStageKey}-${i}`,
            chapterTitle: candidateStage.label,
            effectiveTimestamp: new Date(transMs).toISOString(),
            addedEventKey: null,
            eventKind: "stage_transition",
            cumulativeCareEvents: [...currentCumulative],
            timeGrowthUnits: transGrowth.timeGrowthUnits,
            careGrowthUnits: transGrowth.careGrowthUnits,
            totalGrowthUnits: transGrowth.totalGrowthUnits,
            stage: candidateStage,
            careSignals: transGrowth.careSignals,
            caption: getStageTransitionCaption(candidateStageKey),
            dateLabel: formatStoryDateUtc(transMs),
            highlightFeatureId: null,
            isResting: false,
            isFinal: false,
          });

          lastRecordedElapsedDays = transDays;
          lastRecordedStageKey = candidateStageKey;
        }
      }
    }

    // 4B. The Event Step: Add exactly this single care event
    currentCumulative = [...currentCumulative, event];
    const eventGrowth = calculateHistoricalGrowth(currentCumulative, eventElapsedDays);
    const highlightId = getCareFeatureId(event.kind, event.id);

    // Formatting date and caption
    let dateLabel: string;
    if (event.kind === "important_date") {
      dateLabel = `Entered garden ${formatStoryDateUtc(entry.effectiveMs)}`;
    } else {
      dateLabel = formatStoryDateUtc(entry.effectiveMs);
    }

    const isSharedTimestamp = (timestampCounts.get(entry.effectiveMs) || 0) > 1;
    let caption: string;
    if (isSharedTimestamp) {
      caption = "Several kinds of care found their place around this time.";
    } else if (event.kind === "reconnection") {
      caption = "A moment of reconnection opened a blossom.";
    } else if (event.kind === "positive_moment") {
      caption = "Shared care encouraged fresh growth.";
    } else {
      caption = "A meaningful date found a lasting place in the garden.";
    }

    // Determine stage for event step:
    // If adding this care event crossed a stage threshold, show the newly earned feature
    // in the current stage first, followed by an explicit stage transition step.
    const stageBeforeEvent = getGardenStage(
      Math.min(100, eventGrowth.timeGrowthUnits + currentCareUnits)
    );
    const stageAfterEvent = eventGrowth.stage;
    const crossedStage = stageAfterEvent.key !== stageBeforeEvent.key;

    rawSteps.push({
      id: `step-event-${event.kind}-${event.id}`,
      chapterTitle: stageBeforeEvent.label,
      effectiveTimestamp: new Date(entry.effectiveMs).toISOString(),
      addedEventKey: `${event.kind}:${event.id}`,
      eventKind: event.kind,
      cumulativeCareEvents: [...currentCumulative],
      timeGrowthUnits: eventGrowth.timeGrowthUnits,
      careGrowthUnits: eventGrowth.careGrowthUnits,
      totalGrowthUnits: eventGrowth.totalGrowthUnits,
      stage: crossedStage ? stageBeforeEvent : stageAfterEvent,
      careSignals: eventGrowth.careSignals,
      caption,
      dateLabel,
      highlightFeatureId: highlightId,
      isResting: false,
      isFinal: false,
    });

    // 4C. If adding this care event crossed a stage threshold, emit immediate stage transition step
    if (crossedStage) {
      rawSteps.push({
        id: `step-event-stage-${stageAfterEvent.key}-${event.id}`,
        chapterTitle: stageAfterEvent.label,
        effectiveTimestamp: new Date(entry.effectiveMs).toISOString(),
        addedEventKey: null,
        eventKind: "stage_transition",
        cumulativeCareEvents: [...currentCumulative],
        timeGrowthUnits: eventGrowth.timeGrowthUnits,
        careGrowthUnits: eventGrowth.careGrowthUnits,
        totalGrowthUnits: eventGrowth.totalGrowthUnits,
        stage: stageAfterEvent,
        careSignals: eventGrowth.careSignals,
        caption: getStageTransitionCaption(stageAfterEvent.key),
        dateLabel,
        highlightFeatureId: null,
        isResting: false,
        isFinal: false,
      });

      lastRecordedStageKey = stageAfterEvent.key;
    } else {
      lastRecordedStageKey = stageAfterEvent.key;
    }

    lastRecordedElapsedDays = eventElapsedDays;
  }

  // 5. Post-event time progression to asOfMs (Today)
  const finalCareUnits = calculateHistoricalGrowth(currentCumulative, 0).careGrowthUnits;
  const timeUnitsBeforeToday = Math.min(60, lastRecordedElapsedDays * 0.5);
  const timeUnitsToday = Math.min(60, totalElapsedDays * 0.5);

  const startStageIdxToday = STAGE_KEYS.indexOf(lastRecordedStageKey);
  if (startStageIdxToday !== -1) {
    for (let s = startStageIdxToday + 1; s < STAGE_KEYS.length; s++) {
      const candidateStageKey = STAGE_KEYS[s];
      const candidateStage = GARDEN_STAGES[candidateStageKey];
      const neededUnitsFromTime = candidateStage.minUnits - finalCareUnits;

      if (neededUnitsFromTime > 60) {
        break;
      }

      if (neededUnitsFromTime > timeUnitsBeforeToday && neededUnitsFromTime <= timeUnitsToday) {
        const transDays = Math.ceil(neededUnitsFromTime / 0.5);
        const transMs = startMs + transDays * (1000 * 60 * 60 * 24);
        const transGrowth = calculateHistoricalGrowth(currentCumulative, transDays);

        rawSteps.push({
          id: `step-time-stage-${candidateStageKey}-final`,
          chapterTitle: candidateStage.label,
          effectiveTimestamp: new Date(transMs).toISOString(),
          addedEventKey: null,
          eventKind: "stage_transition",
          cumulativeCareEvents: [...currentCumulative],
          timeGrowthUnits: transGrowth.timeGrowthUnits,
          careGrowthUnits: transGrowth.careGrowthUnits,
          totalGrowthUnits: transGrowth.totalGrowthUnits,
          stage: candidateStage,
          careSignals: transGrowth.careSignals,
          caption: getStageTransitionCaption(candidateStageKey),
          dateLabel: formatStoryDateUtc(transMs),
          highlightFeatureId: null,
          isResting: false,
          isFinal: false,
        });

        lastRecordedElapsedDays = transDays;
        lastRecordedStageKey = candidateStageKey;
      }
    }
  }

  // 6. Final Step: "Today" (strictly reflects the captured live garden)
  const todayGrowth = calculateHistoricalGrowth(currentCumulative, totalElapsedDays);
  rawSteps.push({
    id: "step-today",
    chapterTitle: "Our Garden Today",
    effectiveTimestamp: new Date(safeAsOfMs).toISOString(),
    addedEventKey: null,
    eventKind: "today",
    cumulativeCareEvents: [...currentCumulative],
    timeGrowthUnits: todayGrowth.timeGrowthUnits,
    careGrowthUnits: todayGrowth.careGrowthUnits,
    totalGrowthUnits: todayGrowth.totalGrowthUnits,
    stage: todayGrowth.stage,
    careSignals: todayGrowth.careSignals,
    caption: "This is your garden today.",
    dateLabel: formatStoryDateUtc(safeAsOfMs),
    highlightFeatureId: null,
    isResting: Boolean(snapshot.isResting),
    isFinal: true,
  });

  // 7. Group steps into ordered, bounded Chapters
  // Group contiguous steps sharing the same chapterTitle
  interface ChapterAccumulator {
    id: string;
    title: string;
    steps: InterimStep[];
  }

  const rawChapters: ChapterAccumulator[] = [];
  for (const step of rawSteps) {
    const currentChapter = rawChapters[rawChapters.length - 1];
    if (currentChapter && currentChapter.title === step.chapterTitle) {
      currentChapter.steps.push(step);
    } else {
      rawChapters.push({
        id: `chapter-${rawChapters.length + 1}-${step.chapterTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        title: step.chapterTitle,
        steps: [step],
      });
    }
  }

  const totalChapters = rawChapters.length;
  const totalSteps = rawSteps.length;

  const chapters: GardenStoryChapter[] = rawChapters.map((ch, chIdx) => ({
    id: ch.id,
    title: ch.title,
    chapterIndex: chIdx,
    totalChapters,
    stepCount: ch.steps.length,
  }));

  // 8. Assign finalized chapter IDs and step indices
  const finalizedSteps: GardenStoryStep[] = [];
  let globalStepIndex = 0;

  for (let chIdx = 0; chIdx < rawChapters.length; chIdx++) {
    const ch = rawChapters[chIdx];
    const chapterTotalSteps = ch.steps.length;

    for (let sIdx = 0; sIdx < ch.steps.length; sIdx++) {
      const step = ch.steps[sIdx];
      finalizedSteps.push({
        id: step.id,
        chapterId: ch.id,
        chapterTitle: ch.title,
        chapterIndex: chIdx,
        totalChapters,
        stepIndex: globalStepIndex,
        totalSteps,
        chapterStepIndex: sIdx + 1,
        chapterTotalSteps,
        effectiveTimestamp: step.effectiveTimestamp,
        addedEventKey: step.addedEventKey,
        eventKind: step.eventKind,
        cumulativeCareEvents: step.cumulativeCareEvents,
        timeGrowthUnits: step.timeGrowthUnits,
        careGrowthUnits: step.careGrowthUnits,
        totalGrowthUnits: step.totalGrowthUnits,
        stage: step.stage,
        careSignals: step.careSignals,
        caption: step.caption,
        dateLabel: step.dateLabel,
        highlightFeatureId: step.highlightFeatureId,
        isResting: step.isResting,
        isFinal: step.isFinal,
      });

      globalStepIndex++;
    }
  }

  const pacing: "gentle" | "quick" =
    snapshot.pacing || (sortedEntries.length > 20 ? "gentle" : "gentle");

  return {
    chapters,
    steps: finalizedSteps,
    frames: finalizedSteps, // backward-compatible alias
    seedString: snapshot.seedString,
    asOfTime: snapshot.asOfTime,
    totalSteps: finalizedSteps.length,
    totalChapters: chapters.length,
    hasCareEvents: sortedEntries.length > 0,
    explanation: GARDEN_STORY_EXPLANATION,
    isResting: Boolean(snapshot.isResting),
    themeKey: snapshot.themeKey,
    pacing,
  };
}
