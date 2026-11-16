/**
 * Purple Garden - Development-Only Visual QA Surface & Tree-Family Foundation Lab
 *
 * Route: /garden-visual-qa
 *
 * A dedicated development laboratory for visual inspection and calibration of the living garden:
 * - Strictly guarded by __DEV__; safely redirects to /garden in production builds.
 * - ZERO database mutations: no Supabase writes, no couple record mutations, no growth modifications.
 * - 3 Foundation Reference Slots inspection (Beginning, Branching Out, Mature).
 * - Honest unsupplied slot handling: displays "Asset not yet supplied" (never fake tree or mature fallback).
 * - Side-by-side comparison mode and rapid slot switcher with exact coordinate and dimension contracts.
 * - Alignment overlay: trunk centerline (x = 390.4), ground baseline (y = 441.0), root origin marker.
 * - Interactive toggles: alignment guides on/off, woodland on/off, botanical overlays on/off, crop presets.
 * - Full canonical stage simulation & explore mode calibration.
 * - Persistent visual fixture disclaimer banner.
 */

import React, { useMemo, useState } from "react";
import {
  Image as RNImage,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { tokens } from "@/components/couply-tokens";
import { CouplyHeader, CouplyPage } from "@/components/CouplyUI";
import { useTheme } from "@/context/ThemeContext";
import { GardenVisualizer } from "@/components/garden/GardenVisualizer";
import { GardenExplorer } from "@/components/garden/GardenExplorer";
import { GardenProgressSection } from "@/components/garden/GardenProgressSection";
import { GardenStoryPlayer } from "@/components/garden/GardenStoryPlayer";
import { createGardenStory } from "@/lib/garden-story";
import {
  type CanonicalStageKeyOrBeginning,
  type GardenAtmosphereTone,
  type GardenRendererMode,
  type GardenStructuralPresentation,
  type GardenWorld,
  type Viewport,
  type TreeCompositionPresetName,
  type EarlyLifeSubphaseKey,
  CANONICAL_SCENE_BOUNDS,
  TREE_COMPOSITION_PRESETS,
  THREE_ASSET_FOUNDATION_SLOTS,
  EARLY_LIFE_PREVIEW_TARGET_SLOTS,
  EARLY_LIFE_SUBPHASE_CONTRACTS,
  STAGE_STRUCTURAL_ASSET_SLOTS,
  PAINTERLY_STAGE_ASSET_REGISTRY,
  PAINTERLY_CALIBRATION_WORKFLOW,
  BOTANICAL_ATTACHMENT_REGIONS,
  buildGardenWorld,
  getApprovedPainterlyAssetForStage,
  getGardenStructuralPresentation,
  resolveCanonicalStageKey,
  resolveGardenRenderPlan,
  resolveTreeStructurePlan,
  resolvePreviewMilestoneProgress,
  resolvePlantInspectionCamera,
  calculateAuthoritativeFoundation,
} from "@/lib/garden";
import {
  type GardenCareEvent,
  type GardenCareSignals,
  generateGardenSVGScene,
  getGardenStage,
  getCareFeatureId,
} from "@/lib/garden-generator";

const BACKPLATE_ASSET = require("../../assets/garden/painterly/woodland-backplate-light-v1.png");

const EARLY_LIFE_PREVIEW_UNITS: Record<EarlyLifeSubphaseKey, number> = {
  planted_acorn: 0,
  emerging_shoot: 30,
  small_seedling: 64,
  small_sapling: 100,
};

// Realistic deterministic in-memory fixtures
const FIXTURE_COUPLE_ID = "qa-fixture-couple-alpha";
const FIXTURE_SEED = "qa-fixture-couple-alpha";

type FoundationSlotKey = "beginning" | "branching_out" | "mature";

const FOUNDATION_SLOT_CONFIGS: Record<
  FoundationSlotKey,
  {
    label: string;
    stageKey: CanonicalStageKeyOrBeginning;
    assetKey: string;
    targetFilename: string;
    role: "beginning" | "intermediate" | "mature";
    status: "missing" | "development_preview" | "approved";
    fileExists: boolean;
    rootOrigin: { x: number; y: number };
    soilBaseline: number;
    expectedDimensions: { width: number; height: number };
    alphaRequirement: boolean;
    continuity: { previous: string | null; next: string | null };
    description: string;
  }
> = {
  beginning: {
    label: "Beginning Reference Slot",
    stageKey: "beginning",
    assetKey: "painterly-oak-beginning-v1",
    targetFilename: "assets/garden/painterly/oak-beginning-alpha-v1.png",
    role: "beginning",
    status: "missing",
    fileExists: false,
    rootOrigin: { x: 390.4, y: 441.0 },
    soilBaseline: 441.0,
    expectedDimensions: { width: 1586, height: 992 },
    alphaRequirement: true,
    continuity: { previous: null, next: "first_seedling" },
    description: "Future seed / emerging sprout reference slot rooted at soil baseline",
  },
  branching_out: {
    label: "Branching Out Reference Slot",
    stageKey: "branching_out",
    assetKey: "painterly-oak-branching-v1",
    targetFilename: "assets/garden/painterly/oak-structure-branching-alpha-v1.png",
    role: "intermediate",
    status: "development_preview",
    fileExists: true,
    rootOrigin: { x: 390.4, y: 441.0 },
    soilBaseline: 441.0,
    expectedDimensions: { width: 1585, height: 992 },
    alphaRequirement: true,
    continuity: { previous: "tender_sapling", next: "leafy_canopy" },
    description: "Intermediate young oak with developing scaffold branches and airy canopy (Development Integration)",
  },
  mature: {
    label: "Mature Ancient Oak Reference Slot",
    stageKey: "garden_in_bloom",
    assetKey: "painterly-oak-structure-mature-v1",
    targetFilename: "assets/garden/painterly/oak-structure-mature-alpha-v1.png",
    role: "mature",
    status: "approved",
    fileExists: true,
    rootOrigin: { x: 390.4, y: 441.0 },
    soilBaseline: 441.0,
    expectedDimensions: { width: 1586, height: 992 },
    alphaRequirement: true,
    continuity: { previous: "rooted_flourishing", next: null },
    description: "Approved master ancient oak asset with massive buttress roots and grand spreading limbs",
  },
};

const SCENARIOS = {
  zero_events: {
    label: "Zero Events (Level 1 · 0/100)",
    events: [] as GardenCareEvent[],
    signals: { positiveMoments: 0, reconnections: 0, importantDates: 0 },
    elapsedDays: 0,
    isResting: false,
  },
  one_good_moment: {
    label: "1 Good Moment (Level 1 · 4/100)",
    events: [
      {
        id: "qa-ev-pos-1",
        kind: "positive_moment" as const,
        occurredAt: "2026-06-01T10:00:00Z",
        createdAt: "2026-06-01T10:00:00Z",
        category: "appreciation",
        displayTitle: "Morning Coffee on the Porch",
      },
    ],
    signals: { positiveMoments: 1, reconnections: 0, importantDates: 0 },
    elapsedDays: 4,
    isResting: false,
  },
  multiple_good_moments: {
    label: "5 Good Moments (Level 1 · 18/100)",
    events: [
      {
        id: "qa-ev-pos-1",
        kind: "positive_moment" as const,
        occurredAt: "2026-06-01T10:00:00Z",
        createdAt: "2026-06-01T10:00:00Z",
        category: "appreciation",
        displayTitle: "Morning Coffee on the Porch",
      },
      {
        id: "qa-ev-pos-2",
        kind: "positive_moment" as const,
        occurredAt: "2026-06-08T15:30:00Z",
        createdAt: "2026-06-08T15:30:00Z",
        category: "quality_time",
        displayTitle: "Quiet Walk in the Woods",
      },
      {
        id: "qa-ev-pos-3",
        kind: "positive_moment" as const,
        occurredAt: "2026-06-15T19:00:00Z",
        createdAt: "2026-06-15T19:00:00Z",
        category: "affection",
        displayTitle: "A Hug When It Was Needed",
      },
      {
        id: "qa-ev-pos-4",
        kind: "positive_moment" as const,
        occurredAt: "2026-06-22T12:00:00Z",
        createdAt: "2026-06-22T12:00:00Z",
        category: "support",
        displayTitle: "Making Soup for Sick Partner",
      },
      {
        id: "qa-ev-pos-5",
        kind: "positive_moment" as const,
        occurredAt: "2026-06-29T20:30:00Z",
        createdAt: "2026-06-29T20:30:00Z",
        category: "playfulness",
        displayTitle: "Dancing in the Kitchen",
      },
    ],
    signals: { positiveMoments: 5, reconnections: 0, importantDates: 0 },
    elapsedDays: 16,
    isResting: false,
  },
  mvp_level_2_shoot: {
    label: "MVP Level 2 Shoot (30/100 · 14 Care, 16 Time)",
    events: [
      {
        id: "qa-l2-pos-1",
        kind: "positive_moment" as const,
        occurredAt: "2026-06-01T10:00:00Z",
        createdAt: "2026-06-01T10:00:00Z",
        category: "appreciation",
        displayTitle: "Morning Coffee on the Porch",
      },
      {
        id: "qa-l2-pos-2",
        kind: "positive_moment" as const,
        occurredAt: "2026-06-08T15:30:00Z",
        createdAt: "2026-06-08T15:30:00Z",
        category: "quality_time",
        displayTitle: "Quiet Walk in the Woods",
      },
      {
        id: "qa-l2-pos-3",
        kind: "positive_moment" as const,
        occurredAt: "2026-06-15T19:00:00Z",
        createdAt: "2026-06-15T19:00:00Z",
        category: "affection",
        displayTitle: "A Hug When It Was Needed",
      },
      {
        id: "qa-l2-pos-4",
        kind: "positive_moment" as const,
        occurredAt: "2026-06-22T12:00:00Z",
        createdAt: "2026-06-22T12:00:00Z",
        category: "support",
        displayTitle: "Making Soup for Sick Partner",
      },
      {
        id: "qa-l2-pos-5",
        kind: "positive_moment" as const,
        occurredAt: "2026-06-29T20:30:00Z",
        createdAt: "2026-06-29T20:30:00Z",
        category: "playfulness",
        displayTitle: "Dancing in the Kitchen",
      },
      {
        id: "qa-l2-rec-1",
        kind: "reconnection" as const,
        occurredAt: "2026-07-04T16:00:00Z",
        createdAt: "2026-07-04T16:00:00Z",
        reconnected_at: "2026-07-04T16:00:00Z",
        status: "reconnected",
        category: "communication",
        displayTitle: "Listening With Openness",
      },
    ],
    signals: { positiveMoments: 5, reconnections: 1, importantDates: 0 },
    elapsedDays: 32,
    isResting: false,
  },
  mvp_level_3_seedling: {
    label: "MVP Level 3 Seedling (64/100 · 44 Care, 20 Time)",
    events: [
      {
        id: "qa-l3-pos-1",
        kind: "positive_moment" as const,
        occurredAt: "2026-05-15T09:00:00Z",
        createdAt: "2026-05-15T09:00:00Z",
        category: "appreciation",
        displayTitle: "Morning Coffee on the Porch",
      },
      {
        id: "qa-l3-pos-2",
        kind: "positive_moment" as const,
        occurredAt: "2026-05-20T14:30:00Z",
        createdAt: "2026-05-20T14:30:00Z",
        category: "quality_time",
        displayTitle: "Woodland Walk Among Ferns",
      },
      {
        id: "qa-l3-pos-3",
        kind: "positive_moment" as const,
        occurredAt: "2026-05-25T18:00:00Z",
        createdAt: "2026-05-25T18:00:00Z",
        category: "affection",
        displayTitle: "A Gentle Embrace",
      },
      {
        id: "qa-l3-pos-4",
        kind: "positive_moment" as const,
        occurredAt: "2026-05-30T12:00:00Z",
        createdAt: "2026-05-30T12:00:00Z",
        category: "support",
        displayTitle: "Cooking Nourishing Soup",
      },
      {
        id: "qa-l3-pos-5",
        kind: "positive_moment" as const,
        occurredAt: "2026-06-04T20:00:00Z",
        createdAt: "2026-06-04T20:00:00Z",
        category: "playfulness",
        displayTitle: "Dancing in the Kitchen",
      },
      {
        id: "qa-l3-pos-6",
        kind: "positive_moment" as const,
        occurredAt: "2026-06-09T08:30:00Z",
        createdAt: "2026-06-09T08:30:00Z",
        category: "appreciation",
        displayTitle: "Handwritten Note on Desk",
      },
      {
        id: "qa-l3-pos-7",
        kind: "positive_moment" as const,
        occurredAt: "2026-06-14T21:30:00Z",
        createdAt: "2026-06-14T21:30:00Z",
        category: "quality_time",
        displayTitle: "Porch Stargazing",
      },
      {
        id: "qa-l3-pos-8",
        kind: "positive_moment" as const,
        occurredAt: "2026-06-19T11:00:00Z",
        createdAt: "2026-06-19T11:00:00Z",
        category: "affection",
        displayTitle: "Holding Hands on the Drive",
      },
      {
        id: "qa-l3-pos-9",
        kind: "positive_moment" as const,
        occurredAt: "2026-06-24T16:00:00Z",
        createdAt: "2026-06-24T16:00:00Z",
        category: "support",
        displayTitle: "Running Errands in the Rain",
      },
      {
        id: "qa-l3-pos-10",
        kind: "positive_moment" as const,
        occurredAt: "2026-06-29T17:30:00Z",
        createdAt: "2026-06-29T17:30:00Z",
        category: "playfulness",
        displayTitle: "Silly Bookstore Scavenger Hunt",
      },
      {
        id: "qa-l3-pos-11",
        kind: "positive_moment" as const,
        occurredAt: "2026-07-04T10:00:00Z",
        createdAt: "2026-07-04T10:00:00Z",
        category: "appreciation",
        displayTitle: "Complimenting Thoughtfulness",
      },
      {
        id: "qa-l3-pos-12",
        kind: "positive_moment" as const,
        occurredAt: "2026-07-09T15:00:00Z",
        createdAt: "2026-07-09T15:00:00Z",
        category: "quality_time",
        displayTitle: "Quiet Afternoon Reading",
      },
      {
        id: "qa-l3-rec-1",
        kind: "reconnection" as const,
        occurredAt: "2026-05-28T16:00:00Z",
        createdAt: "2026-05-28T16:00:00Z",
        reconnected_at: "2026-05-28T16:00:00Z",
        status: "reconnected",
        category: "communication",
        displayTitle: "Listening With Openness",
      },
      {
        id: "qa-l3-rec-2",
        kind: "reconnection" as const,
        occurredAt: "2026-06-12T18:00:00Z",
        createdAt: "2026-06-12T18:00:00Z",
        reconnected_at: "2026-06-12T18:00:00Z",
        status: "reconnected",
        category: "forgiveness",
        displayTitle: "Clearing the Misunderstanding",
      },
      {
        id: "qa-l3-rec-3",
        kind: "reconnection" as const,
        occurredAt: "2026-06-26T20:00:00Z",
        createdAt: "2026-06-26T20:00:00Z",
        reconnected_at: "2026-06-26T20:00:00Z",
        status: "reconnected",
        category: "space",
        displayTitle: "Gentle Check-in After Space",
      },
      {
        id: "qa-l3-rec-4",
        kind: "reconnection" as const,
        occurredAt: "2026-07-07T14:00:00Z",
        createdAt: "2026-07-07T14:00:00Z",
        reconnected_at: "2026-07-07T14:00:00Z",
        status: "reconnected",
        category: "intimacy",
        displayTitle: "Honest Vulnerability Shared",
      },
      {
        id: "qa-l3-date-1",
        kind: "important_date" as const,
        occurredAt: "2026-05-18T10:00:00Z",
        createdAt: "2026-05-18T10:00:00Z",
        category: "anniversary",
        displayTitle: "First Meeting Anniversary",
      },
      {
        id: "qa-l3-date-2",
        kind: "important_date" as const,
        occurredAt: "2026-06-21T09:00:00Z",
        createdAt: "2026-06-21T09:00:00Z",
        category: "celebration",
        displayTitle: "Summer Solstice Clearing Walk",
      },
    ],
    signals: { positiveMoments: 12, reconnections: 4, importantDates: 2 },
    elapsedDays: 40,
    isResting: false,
  },
  unresolved_friction: {
    label: "Unresolved Friction (Resting)",
    events: [] as GardenCareEvent[],
    signals: { positiveMoments: 0, reconnections: 0, importantDates: 0 },
    elapsedDays: 20,
    isResting: true,
  },
  completed_reconnection: {
    label: "1 Reconnection Shoot",
    events: [
      {
        id: "qa-ev-rec-1",
        kind: "reconnection" as const,
        occurredAt: "2026-07-04T16:00:00Z",
        createdAt: "2026-07-04T16:00:00Z",
        reconnected_at: "2026-07-04T16:00:00Z",
        status: "reconnected",
        category: "communication",
        displayTitle: "Listening With Openness",
      },
    ],
    signals: { positiveMoments: 0, reconnections: 1, importantDates: 0 },
    elapsedDays: 12,
    isResting: false,
  },
  important_date: {
    label: "1 Important Date Landmark",
    events: [
      {
        id: "qa-ev-date-1",
        kind: "important_date" as const,
        occurredAt: "2026-08-10T09:00:00Z",
        createdAt: "2026-08-10T09:00:00Z",
        category: "anniversary",
        displayTitle: "Our Third Anniversary",
      },
    ],
    signals: { positiveMoments: 0, reconnections: 0, importantDates: 1 },
    elapsedDays: 20,
    isResting: false,
  },
  mixed_history: {
    label: "Mixed Rich History",
    events: [
      {
        id: "qa-ev-pos-1",
        kind: "positive_moment" as const,
        occurredAt: "2026-05-10T10:00:00Z",
        createdAt: "2026-05-10T10:00:00Z",
        category: "appreciation",
        displayTitle: "Morning Sunshine",
      },
      {
        id: "qa-ev-rec-1",
        kind: "reconnection" as const,
        occurredAt: "2026-06-01T14:00:00Z",
        createdAt: "2026-06-01T14:00:00Z",
        reconnected_at: "2026-06-01T14:00:00Z",
        status: "reconnected",
        category: "communication",
        displayTitle: "Healing Conversation",
      },
      {
        id: "qa-ev-pos-2",
        kind: "positive_moment" as const,
        occurredAt: "2026-06-18T18:00:00Z",
        createdAt: "2026-06-18T18:00:00Z",
        category: "quality_time",
        displayTitle: "Evening Starlight Walk",
      },
      {
        id: "qa-ev-date-1",
        kind: "important_date" as const,
        occurredAt: "2026-07-01T09:00:00Z",
        createdAt: "2026-07-01T09:00:00Z",
        category: "anniversary",
        displayTitle: "First Date Anniversary",
      },
    ],
    signals: { positiveMoments: 6, reconnections: 2, importantDates: 1 },
    elapsedDays: 28,
    isResting: false,
    hideOverlays: false,
  },
  structure_calibration: {
    label: "Structure Calibration (No Overlays)",
    events: [] as GardenCareEvent[],
    signals: { positiveMoments: 0, reconnections: 0, importantDates: 0 },
    elapsedDays: 0,
    isResting: false,
    hideOverlays: true,
  },
};

type ScenarioKey = keyof typeof SCENARIOS;

const VIEWPORT_PRESETS: Array<{ label: string; width: number; height: number }> = [
  { label: "Phone Compact (320×568)", width: 320, height: 568 },
  { label: "Phone Standard (390×844)", width: 390, height: 844 },
  { label: "Phone Large (412×915)", width: 412, height: 915 },
  { label: "Tablet (768×1024)", width: 768, height: 1024 },
  { label: "Desktop (1024×768)", width: 1024, height: 768 },
];

export default function GardenVisualQARoute() {
  if (!__DEV__) {
    return <Redirect href="/garden" />;
  }

  const router = useRouter();
  const params = useLocalSearchParams<{
    tab?: string;
    stage?: string;
    couple?: string;
    subphase?: string;
    camera?: string;
    guides?: string;
    units?: string;
    presentation?: string;
    scenario?: string;
    initialFeature?: string;
  }>();
  const { theme, effectiveTheme } = useTheme();

  // Top-level Navigation Mode
  const [activeTab, setActiveTab] = useState<
    "slots" | "simulation" | "early_life" | "story"
  >(
    params.tab === "early_life" ||
    params.tab === "simulation" ||
    params.tab === "slots" ||
    params.tab === "story"
      ? params.tab
      : "slots"
  );

  // Early-Life Lifecycle Preview Interactive Controls
  const [earlyLifeSubphase, setEarlyLifeSubphase] =
    useState<EarlyLifeSubphaseKey>(
      params.subphase === "planted_acorn" ||
        params.subphase === "emerging_shoot" ||
        params.subphase === "small_seedling" ||
        params.subphase === "small_sapling"
        ? params.subphase
        : "emerging_shoot"
    );
  const [earlyLifeReducedMotion, setEarlyLifeReducedMotion] = useState(false);
  const [earlyLifeShowEarnedFeature, setEarlyLifeShowEarnedFeature] =
    useState(true);

  // Slot Lab Interactive Controls
  const [selectedSlotKey, setSelectedSlotKey] =
    useState<FoundationSlotKey>("branching_out");
  const [showSideBySide, setShowSideBySide] = useState(false);
  const [showAlignmentGuides, setShowAlignmentGuides] = useState(
    params.guides !== undefined ? params.guides === "true" || params.guides === "1" : false
  );
  const [showWoodlandBackplate, setShowWoodlandBackplate] = useState(true);
  const [showBotanicalOverlays, setShowBotanicalOverlays] = useState(true);
  const [showFoliageProof, setShowFoliageProof] = useState(false);
  const [compositionPreset, setCompositionPreset] =
    useState<TreeCompositionPresetName>("balanced_overview");

  // Simulation Lab Interactive Controls
  const [stageKey, setStageKey] =
    useState<CanonicalStageKeyOrBeginning>(
      params.stage === "beginning" ||
      params.stage === "first_seedling" ||
      params.stage === "tender_sapling" ||
      params.stage === "branching_out" ||
      params.stage === "leafy_canopy" ||
      params.stage === "rooted_flourishing" ||
      params.stage === "garden_in_bloom"
        ? (params.stage as CanonicalStageKeyOrBeginning)
        : "branching_out"
    );
  const [rendererMode, setRendererMode] =
    useState<GardenRendererMode>("painterly_when_eligible");
  const [tone, setTone] = useState<GardenAtmosphereTone>("calm_light");
  const [presentationMode, setPresentationMode] =
    useState<"full" | "compact" | "explore">(
      params.presentation === "explore" || params.presentation === "compact" || params.presentation === "full"
        ? params.presentation
        : "full"
    );
  const [scenarioKey, setScenarioKey] =
    useState<ScenarioKey>(
      params.scenario && params.scenario in SCENARIOS
        ? (params.scenario as ScenarioKey)
        : "multiple_good_moments"
    );
  const [selectedViewportIdx, setSelectedViewportIdx] = useState(1); // 390x844 default

  const scenario = SCENARIOS[scenarioKey];
  const activeViewport = VIEWPORT_PRESETS[selectedViewportIdx];
  const activeSlot = FOUNDATION_SLOT_CONFIGS[selectedSlotKey];

  // Authoritative Foundation Calculation for the active scenario
  const scenarioFoundation = useMemo(() => {
    return calculateAuthoritativeFoundation(
      scenario.events,
      (scenario as any).elapsedDays ?? 0
    );
  }, [scenario]);

  // Default canonical stage growth parameters strictly enforcing supportingTimeContribution <= 20
  const stageDefaultGrowth = useMemo(() => {
    switch (stageKey) {
      case "beginning":
        return { total: 0, care: 0, time: 0 };
      case "first_seedling":
        return { total: 8, care: 4, time: 4 };
      case "tender_sapling":
        return { total: 24, care: 12, time: 12 };
      case "branching_out":
        return { total: 44, care: 24, time: 20 };
      case "leafy_canopy":
        return { total: 64, care: 44, time: 20 };
      case "rooted_flourishing":
        return { total: 82, care: 62, time: 20 };
      case "garden_in_bloom":
      default:
        return { total: 100, care: 80, time: 20 };
    }
  }, [stageKey]);

  // True if a scenario is explicitly requested or active
  const isScenarioActive =
    params.scenario !== undefined ||
    scenarioKey === "mvp_level_2_shoot" ||
    scenarioKey === "mvp_level_3_seedling" ||
    scenario.events.length > 0;

  const growth = useMemo(() => {
    if (isScenarioActive) {
      return {
        total: scenarioFoundation.totalFoundationProgress,
        care: scenarioFoundation.rawCareContribution,
        time: scenarioFoundation.supportingTimeContribution,
      };
    }
    return stageDefaultGrowth;
  }, [isScenarioActive, scenarioFoundation, stageDefaultGrowth]);

  const authoritativeFoundation = useMemo(() => {
    if (isScenarioActive) {
      return scenarioFoundation;
    }
    return calculateAuthoritativeFoundation(growth.total, growth.care, growth.time);
  }, [isScenarioActive, scenarioFoundation, growth]);

  // Diagnostic audit: detect if legacy query param stage conflicts with authoritative MVP foundation
  const legacyStageConflict = useMemo(() => {
    if (!params.stage) return null;
    const requestedLegacy = params.stage as CanonicalStageKeyOrBeginning;
    const calculatedLegacy = getGardenStage(authoritativeFoundation.totalFoundationProgress).key;
    if (requestedLegacy !== calculatedLegacy) {
      return {
        requested: requestedLegacy,
        calculatedLegacy,
        totalUnits: authoritativeFoundation.totalFoundationProgress,
        mvpStage: authoritativeFoundation.currentStage,
        mvpLevel: authoritativeFoundation.currentLevel,
      };
    }
    return null;
  }, [params.stage, authoritativeFoundation]);

  // Compute live render plan for simulation
  const simulationRenderPlan = useMemo(() => {
    return resolveGardenRenderPlan({
      stageKey: getGardenStage(growth.total).key,
      rendererMode,
      availableAssets: [
        "painterly-oak-mature-v1",
        "painterly-oak-structure-mature-v1",
      ],
    });
  }, [growth.total, rendererMode]);

  // Compute presentation parameters for simulation
  const presentation: GardenStructuralPresentation = useMemo(() => {
    return getGardenStructuralPresentation(tone, getGardenStage(growth.total).key, effectiveTheme);
  }, [tone, growth.total, effectiveTheme]);

  // Compute GardenWorld for Explore mode
  const world: GardenWorld = useMemo(() => {
    const coupleSeed = params.couple || FIXTURE_SEED;
    const coupleId = params.couple || FIXTURE_COUPLE_ID;
    const scene = generateGardenSVGScene(
      coupleSeed,
      growth.total,
      growth.care,
      scenario.isResting,
      scenario.signals,
      effectiveTheme,
      scenario.events
    );
    return buildGardenWorld(scene, {
      coupleId,
      seedString: coupleSeed,
      totalGrowthUnits: growth.total,
      careGrowthUnits: growth.care,
      timeGrowthUnits: growth.time,
      isResting: scenario.isResting,
      effectiveTheme,
      careEvents: scenario.events,
      careSignals: scenario.signals,
    });
  }, [growth, scenario, effectiveTheme, params.couple]);

  // Tree structure plan for the selected foundation slot
  const slotStructurePlan = useMemo(() => {
    return resolveTreeStructurePlan({
      stageKey: activeSlot.stageKey,
      rendererMode: "painterly_when_eligible",
      presentationMode: "full",
    });
  }, [activeSlot]);

  // Early-Life Lifecycle Subphase Derivation & Simulated Progress
  const [earlyLifeCameraMode, setEarlyLifeCameraMode] = useState<"overview" | "inspect">(
    params.camera === "inspect" ? "inspect" : "overview"
  );
  const [simulatedUnits, setSimulatedUnits] = useState<number>(
    params.units !== undefined
      ? parseFloat(params.units)
      : EARLY_LIFE_PREVIEW_UNITS[earlyLifeSubphase]
  );
  const [useSimulatedGrowth, setUseSimulatedGrowth] = useState<boolean>(
    params.units !== undefined
  );

  const previewMilestone = useMemo(() => {
    return resolvePreviewMilestoneProgress(
      simulatedUnits,
      earlyLifeShowEarnedFeature ? 1 : 0
    );
  }, [simulatedUnits, earlyLifeShowEarnedFeature]);

  // When simulated growth is active, subphase is driven automatically by simulated units
  const effectiveEarlyLifeSubphase: EarlyLifeSubphaseKey = useSimulatedGrowth
    ? previewMilestone.subphaseKey
    : earlyLifeSubphase;

  const earlyLifeContract = EARLY_LIFE_SUBPHASE_CONTRACTS[effectiveEarlyLifeSubphase];
  const earlyLifeAssetSlot =
    effectiveEarlyLifeSubphase === "small_sapling"
      ? STAGE_STRUCTURAL_ASSET_SLOTS.tender_sapling
      : EARLY_LIFE_PREVIEW_TARGET_SLOTS[effectiveEarlyLifeSubphase];
  const earlyLifeGrowth = useMemo(() => {
    if (useSimulatedGrowth) {
      const clamped = Math.max(0, Math.min(100, simulatedUnits));
      const calc = calculateAuthoritativeFoundation(clamped);
      return {
        total: calc.totalFoundationProgress,
        care: earlyLifeShowEarnedFeature ? calc.rawCareContribution : 0,
        time: earlyLifeShowEarnedFeature
          ? calc.supportingTimeContribution
          : Math.min(20, calc.totalFoundationProgress),
        stageKey: getGardenStage(calc.totalFoundationProgress).key,
      };
    }
    const targetUnits = EARLY_LIFE_PREVIEW_UNITS[earlyLifeSubphase];
    const calc = calculateAuthoritativeFoundation(targetUnits);
    return {
      total: calc.totalFoundationProgress,
      care: earlyLifeShowEarnedFeature ? calc.rawCareContribution : 0,
      time: earlyLifeShowEarnedFeature
        ? calc.supportingTimeContribution
        : Math.min(20, calc.totalFoundationProgress),
      stageKey: getGardenStage(calc.totalFoundationProgress).key,
    };
  }, [useSimulatedGrowth, simulatedUnits, earlyLifeSubphase, earlyLifeShowEarnedFeature]);

  const earlyLifeCamera = useMemo(() => {
    if (earlyLifeCameraMode === "inspect") {
      const inspectData = resolvePlantInspectionCamera(
        effectiveEarlyLifeSubphase,
        activeViewport
      );
      return {
        target: { x: inspectData.targetX, y: inspectData.targetY },
        targetX: inspectData.targetX,
        targetY: inspectData.targetY,
        zoom: inspectData.zoom,
      };
    }
    return {
      target: { x: 400.0, y: 250.0 },
      targetX: 400.0,
      targetY: 250.0,
      zoom: 1.0,
    };
  }, [earlyLifeCameraMode, effectiveEarlyLifeSubphase, activeViewport]);

  const earlyLifeFixtureEvents: GardenCareEvent[] = useMemo(() => {
    if (!earlyLifeShowEarnedFeature || effectiveEarlyLifeSubphase === "planted_acorn") {
      return [];
    }
    return [
      {
        id: "fixture-early-life-1",
        kind: "positive_moment" as const,
        occurredAt: "2026-06-01T10:00:00Z",
        createdAt: "2026-06-01T10:00:00Z",
        category: "appreciation",
        displayTitle: "Morning Quiet Together",
      },
    ];
  }, [earlyLifeShowEarnedFeature, effectiveEarlyLifeSubphase]);

  const earlyLifeWorld = useMemo(() => {
    const scene = generateGardenSVGScene(
      FIXTURE_SEED,
      earlyLifeGrowth.total,
      earlyLifeGrowth.care,
      false,
      undefined,
      effectiveTheme,
      earlyLifeFixtureEvents
    );
    return buildGardenWorld(scene, {
      coupleId: FIXTURE_COUPLE_ID,
      seedString: FIXTURE_SEED,
      totalGrowthUnits: earlyLifeGrowth.total,
      careGrowthUnits: earlyLifeGrowth.care,
      timeGrowthUnits: earlyLifeGrowth.time,
      isResting: false,
      effectiveTheme,
      careEvents: earlyLifeFixtureEvents,
    });
  }, [earlyLifeGrowth, earlyLifeFixtureEvents, effectiveTheme]);

  const qaStory = useMemo(() => {
    const events: GardenCareEvent[] = [
      {
        id: "qa-rec-1",
        kind: "reconnection",
        occurredAt: "2026-01-02T10:00:00Z",
        displayTitle: "Listening With Openness",
      },
      {
        id: "qa-rec-2",
        kind: "reconnection",
        occurredAt: "2026-01-03T10:00:00Z",
        displayTitle: "Giving Space",
      },
      {
        id: "qa-rec-3",
        kind: "reconnection",
        occurredAt: "2026-01-04T10:00:00Z",
        displayTitle: "Gentle Reset",
      },
      {
        id: "qa-rec-4",
        kind: "reconnection",
        occurredAt: "2026-01-05T10:00:00Z",
        displayTitle: "Clear Apology",
      },
      {
        id: "qa-rec-5",
        kind: "reconnection",
        occurredAt: "2026-01-06T10:00:00Z",
        displayTitle: "Mutual Understanding",
      },
      {
        id: "qa-rec-6",
        kind: "reconnection",
        occurredAt: "2026-01-07T10:00:00Z",
        displayTitle: "Finding Balance",
      },
    ];
    return createGardenStory({
      coupleId: FIXTURE_COUPLE_ID,
      seedString: FIXTURE_SEED,
      createdAt: "2026-01-01T00:00:00Z",
      careEvents: events,
      asOfTime: "2026-01-10T00:00:00Z",
      isResting: false,
    });
  }, []);

  const EARLY_LIFE_SUBPHASES: EarlyLifeSubphaseKey[] = [
    "planted_acorn",
    "emerging_shoot",
    "small_seedling",
    "small_sapling",
  ];
  const earlyLifeSubphaseIdx = EARLY_LIFE_SUBPHASES.indexOf(earlyLifeSubphase);
  const handlePrevSubphase = () => {
    if (earlyLifeSubphaseIdx > 0) {
      const nextSubphase = EARLY_LIFE_SUBPHASES[earlyLifeSubphaseIdx - 1];
      setUseSimulatedGrowth(false);
      setEarlyLifeSubphase(nextSubphase);
      setSimulatedUnits(EARLY_LIFE_PREVIEW_UNITS[nextSubphase]);
    }
  };
  const handleNextSubphase = () => {
    if (earlyLifeSubphaseIdx < EARLY_LIFE_SUBPHASES.length - 1) {
      const nextSubphase = EARLY_LIFE_SUBPHASES[earlyLifeSubphaseIdx + 1];
      setUseSimulatedGrowth(false);
      setEarlyLifeSubphase(nextSubphase);
      setSimulatedUnits(EARLY_LIFE_PREVIEW_UNITS[nextSubphase]);
    }
  };

  const isLight = effectiveTheme === "light";

  return (
    <CouplyPage safe={true} contentStyle={styles.page}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <CouplyHeader
          overline="DEVELOPMENT ONLY"
          title="Tree-Family Foundation QA"
          subtitle="Zero Supabase writes. In-memory stage, asset, tone, and explore calibration."
          backLabel="‹ Return to Garden"
          onBack={() => router.replace("/garden")}
        />

        {/* Persistent Warning Banner */}
        <View style={styles.persistentBanner}>
          <Text style={styles.persistentBannerTitle}>
            ⚠️ STRUCTURE CALIBRATION LAB
          </Text>
          <Text style={styles.persistentBannerBody}>
            Development-only structure calibration — no production data is changed
          </Text>
        </View>

        {/* Navigation Mode Tabs */}
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tabButton, activeTab === "slots" && styles.tabButtonActive]}
            onPress={() => setActiveTab("slots")}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "slots" && styles.tabButtonTextActive,
              ]}
            >
              1. Three-Asset Foundation Lab
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tabButton,
              activeTab === "simulation" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("simulation")}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "simulation" && styles.tabButtonTextActive,
              ]}
            >
              2. Stage Progression Simulator
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tabButton,
              activeTab === "early_life" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("early_life")}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "early_life" && styles.tabButtonTextActive,
              ]}
            >
              3. Early-Life Lifecycle Preview
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tabButton,
              activeTab === "story" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("story")}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "story" && styles.tabButtonTextActive,
              ]}
            >
              4. Story (100-Unit Parity)
            </Text>
          </Pressable>
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* TAB 1: THREE-ASSET FOUNDATION CALIBRATION LAB                   */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === "slots" && (
          <View style={styles.sectionContainer}>
            {/* Slot Switcher Pills */}
            <View style={styles.card}>
              <Text style={styles.cardHeading}>FOUNDATION REFERENCE SLOTS</Text>
              <View style={styles.pillRow}>
                {(["beginning", "branching_out", "mature"] as FoundationSlotKey[]).map(
                  (key) => {
                    const slot = FOUNDATION_SLOT_CONFIGS[key];
                    const isSelected = selectedSlotKey === key;
                    return (
                      <Pressable
                        key={key}
                        style={[
                          styles.slotPill,
                          isSelected && styles.slotPillActive,
                        ]}
                        onPress={() => setSelectedSlotKey(key)}
                      >
                        <Text
                          style={[
                            styles.slotPillText,
                            isSelected && styles.slotPillTextActive,
                          ]}
                        >
                          {key === "beginning"
                            ? "1. Beginning (Seed)"
                            : key === "branching_out"
                            ? "2. Branching Out"
                            : "3. Mature Oak"}
                        </Text>
                        <View
                          style={[
                            styles.badge,
                            slot.status === "approved"
                              ? styles.badgeApproved
                              : slot.status === "development_preview"
                              ? styles.badgePreview
                              : styles.badgeMissing,
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              slot.status === "approved"
                                ? styles.badgeTextApproved
                                : slot.status === "development_preview"
                                ? styles.badgeTextPreview
                                : styles.badgeTextMissing,
                            ]}
                          >
                            {slot.status === "development_preview"
                              ? "DEV PREVIEW"
                              : slot.status.toUpperCase()}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  }
                )}
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>
                  Side-by-Side Comparison Mode:
                </Text>
                <Switch
                  value={showSideBySide}
                  onValueChange={setShowSideBySide}
                />
              </View>
            </View>

            {/* Calibration & Environment Toggles */}
            <View style={styles.card}>
              <Text style={styles.cardHeading}>CALIBRATION CONTROLS & TOGGLES</Text>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Alignment Guides (x=390.4, y=441.0):</Text>
                <Switch
                  value={showAlignmentGuides}
                  onValueChange={setShowAlignmentGuides}
                />
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Woodland Backplate:</Text>
                <Switch
                  value={showWoodlandBackplate}
                  onValueChange={setShowWoodlandBackplate}
                />
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Botanical Overlays:</Text>
                <Switch
                  value={showBotanicalOverlays}
                  onValueChange={setShowBotanicalOverlays}
                />
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Painterly Foliage Cluster Proof:</Text>
                <Switch
                  value={showFoliageProof}
                  onValueChange={setShowFoliageProof}
                />
              </View>

              {/* Crop Presets */}
              <Text style={[styles.statusLabel, { marginTop: 12, marginBottom: 4 }]}>
                Composition Preset:
              </Text>
              <View style={styles.pillRow}>
                {(
                  [
                    "balanced_overview",
                    "full_structure",
                    "focused_compact",
                    "explore_world",
                    "story_frame",
                  ] as TreeCompositionPresetName[]
                ).map((preset) => (
                  <Pressable
                    key={preset}
                    style={[
                      styles.pill,
                      compositionPreset === preset && styles.pillActive,
                    ]}
                    onPress={() => setCompositionPreset(preset)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        compositionPreset === preset && styles.pillTextActive,
                      ]}
                    >
                      {preset}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* LIVE CALIBRATION PREVIEW CANVAS */}
            <View style={styles.artworkSection}>
              <Text style={styles.artworkSectionTitle}>
                LIVE CALIBRATION CANVAS: {activeSlot.label.toUpperCase()}
              </Text>
              <View
                style={[
                  styles.viewportContainer,
                  {
                    width: "100%",
                    maxWidth: 760,
                    height: 380,
                    backgroundColor: showWoodlandBackplate ? "#EFEAE3" : "#F3F4F6",
                  },
                ]}
              >
                {/* When the selected slot is approved or in development preview, render real painterly structure */}
                {activeSlot.status === "approved" || activeSlot.status === "development_preview" ? (
                  <View style={{ flex: 1, position: "relative" }}>
                    <GardenVisualizer
                      seedString={params.couple || FIXTURE_SEED}
                      totalGrowthUnits={activeSlot.stageKey === "branching_out" ? 42 : 100}
                      careGrowthUnits={activeSlot.stageKey === "branching_out" ? 18 : 40}
                      timeGrowthUnits={activeSlot.stageKey === "branching_out" ? 24 : 60}
                      isResting={false}
                      compact={false}
                      careSignals={scenario.signals}
                      careEvents={scenario.events}
                      rendererMode="painterly_when_eligible"
                      atmosphereTone="calm_light"
                      presentation={presentation}
                      world={world}
                      style={{ flex: 1 }}
                      hideOverlays={!showBotanicalOverlays}
                      showWoodland={showWoodlandBackplate}
                      cropPreset={compositionPreset}
                      showGuides={showAlignmentGuides}
                      showFoliageProof={showFoliageProof}
                    />
                  </View>
                ) : (
                  /* When the selected slot is unavailable (Beginning),
                     prominently display "Asset not yet supplied" and NEVER fake tree or mature fallback */
                  <View style={styles.unsuppliedContainer}>
                    {/* Optional Layer 1 Woodland Backplate */}
                    {showWoodlandBackplate && (
                      <RNImage
                        source={BACKPLATE_ASSET}
                        style={StyleSheet.absoluteFill}
                        resizeMode="stretch"
                      />
                    )}

                    {/* Prominent "Asset not yet supplied" Card */}
                    <View style={styles.unsuppliedOverlayCard}>
                      <Text style={styles.unsuppliedBadge}>🌿 ASSET NOT YET SUPPLIED</Text>
                      <Text style={styles.unsuppliedHeading}>
                        {activeSlot.label}
                      </Text>
                      <Text style={styles.unsuppliedDescription}>
                        Never displaying fake procedural tree or shrunken mature oak in place of unsupplied painterly slot.
                      </Text>

                      <View style={styles.unsuppliedSpecs}>
                        <Text style={styles.unsuppliedSpecLine}>
                          • Expected File: <Text style={styles.boldMono}>{activeSlot.targetFilename}</Text>
                        </Text>
                        <Text style={styles.unsuppliedSpecLine}>
                          • Canonical Stage: <Text style={styles.boldMono}>{activeSlot.stageKey}</Text>
                        </Text>
                        <Text style={styles.unsuppliedSpecLine}>
                          • Expected Resolution: <Text style={styles.boldMono}>{activeSlot.expectedDimensions.width} × {activeSlot.expectedDimensions.height} RGBA (Alpha required)</Text>
                        </Text>
                        <Text style={styles.unsuppliedSpecLine}>
                          • Soil Baseline: <Text style={styles.boldMono}>y = {activeSlot.soilBaseline.toFixed(1)}</Text> | Trunk Origin: <Text style={styles.boldMono}>x = {activeSlot.rootOrigin.x.toFixed(1)}</Text>
                        </Text>
                        <Text style={styles.unsuppliedSpecLine}>
                          • Current Fallback in Production: <Text style={styles.boldMono}>{slotStructurePlan.fallbackReason}</Text>
                        </Text>
                      </View>
                    </View>

                    {/* Alignment Overlay if toggled */}
                    {showAlignmentGuides && (
                      <Svg
                        style={StyleSheet.absoluteFill}
                        viewBox="0 0 800 500"
                        pointerEvents="none"
                      >
                        {/* Horizontal Baseline (y = 441.0) */}
                        <Line
                          x1={0}
                          y1={441.0}
                          x2={800}
                          y2={441.0}
                          stroke="#38BDF8"
                          strokeWidth={2}
                          strokeDasharray="6,4"
                        />
                        <SvgText
                          x={16}
                          y={434}
                          fill="#38BDF8"
                          fontSize={11}
                          fontWeight="700"
                        >
                          Soil Baseline: y = 441.0
                        </SvgText>

                        {/* Vertical Centerline (x = 390.4) */}
                        <Line
                          x1={390.4}
                          y1={0}
                          x2={390.4}
                          y2={500}
                          stroke="#F43F5E"
                          strokeWidth={2}
                          strokeDasharray="6,4"
                        />
                        <SvgText
                          x={398}
                          y={24}
                          fill="#F43F5E"
                          fontSize={11}
                          fontWeight="700"
                        >
                          Trunk Centerline: x = 390.4
                        </SvgText>

                        {/* Root Origin Marker (390.4, 441.0) */}
                        <Circle
                          cx={390.4}
                          cy={441.0}
                          r={6}
                          fill="#EF4444"
                          stroke="#FFFFFF"
                          strokeWidth={2}
                        />
                        <SvgText
                          x={402}
                          y={445}
                          fill="#EF4444"
                          fontSize={11}
                          fontWeight="800"
                        >
                          Root Origin (390.4, 441.0)
                        </SvgText>
                      </Svg>
                    )}
                  </View>
                )}
              </View>
            </View>

            {/* SIDE-BY-SIDE / THREE-SLOT FOUNDATION CARDS */}
            {(showSideBySide || true) && (
              <View style={styles.card}>
                <Text style={styles.cardHeading}>
                  THREE-ASSET REFERENCE CONTRACT COMPARISON
                </Text>

                <View style={styles.comparisonGrid}>
                  {(["beginning", "branching_out", "mature"] as FoundationSlotKey[]).map(
                    (key) => {
                      const slot = FOUNDATION_SLOT_CONFIGS[key];
                      const isCurrent = selectedSlotKey === key;
                      return (
                        <Pressable
                          key={key}
                          style={[
                            styles.comparisonCard,
                            isCurrent && styles.comparisonCardSelected,
                            { backgroundColor: isLight ? "#FAFAFA" : "#1F1A24" },
                          ]}
                          onPress={() => setSelectedSlotKey(key)}
                        >
                          <View style={styles.cardHeaderRow}>
                            <Text style={styles.comparisonTitle}>
                              {slot.label}
                            </Text>
                            <View
                              style={[
                                styles.badge,
                                slot.status === "approved"
                                  ? styles.badgeApproved
                                  : slot.status === "development_preview"
                                  ? styles.badgePreview
                                  : styles.badgeMissing,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.badgeText,
                                  slot.status === "approved"
                                    ? styles.badgeTextApproved
                                    : slot.status === "development_preview"
                                    ? styles.badgeTextPreview
                                    : styles.badgeTextMissing,
                                ]}
                              >
                                {slot.status === "development_preview"
                                  ? "DEV PREVIEW"
                                  : slot.status.toUpperCase()}
                              </Text>
                            </View>
                          </View>

                          <Text style={styles.comparisonDesc}>
                            {slot.description}
                          </Text>

                          <View style={styles.comparisonMetaList}>
                            <Text style={styles.metaRow}>
                              <Text style={styles.metaLabel}>Slot Key: </Text>
                              <Text style={styles.metaVal}>{slot.assetKey}</Text>
                            </Text>
                            <Text style={styles.metaRow}>
                              <Text style={styles.metaLabel}>Canonical Stage: </Text>
                              <Text style={styles.metaVal}>{slot.stageKey}</Text>
                            </Text>
                            <Text style={styles.metaRow}>
                              <Text style={styles.metaLabel}>Role: </Text>
                              <Text style={styles.metaVal}>{slot.role}</Text>
                            </Text>
                            <Text style={styles.metaRow}>
                              <Text style={styles.metaLabel}>Target File: </Text>
                              <Text style={styles.metaVal}>{slot.targetFilename}</Text>
                            </Text>
                            <Text style={styles.metaRow}>
                              <Text style={styles.metaLabel}>Root Origin: </Text>
                              <Text style={styles.metaVal}>
                                ({slot.rootOrigin.x}, {slot.rootOrigin.y})
                              </Text>
                            </Text>
                            <Text style={styles.metaRow}>
                              <Text style={styles.metaLabel}>Soil Baseline: </Text>
                              <Text style={styles.metaVal}>
                                y = {slot.soilBaseline.toFixed(1)}
                              </Text>
                            </Text>
                            <Text style={styles.metaRow}>
                              <Text style={styles.metaLabel}>Expected Size: </Text>
                              <Text style={styles.metaVal}>
                                {slot.expectedDimensions.width} × {slot.expectedDimensions.height}
                              </Text>
                            </Text>
                            <Text style={styles.metaRow}>
                              <Text style={styles.metaLabel}>Alpha Channel: </Text>
                              <Text style={styles.metaVal}>Required (Transparent PNG)</Text>
                            </Text>
                            <Text style={styles.metaRow}>
                              <Text style={styles.metaLabel}>Continuity: </Text>
                              <Text style={styles.metaVal}>
                                {slot.continuity.previous ?? "none"} → {slot.continuity.next ?? "none"}
                              </Text>
                            </Text>
                          </View>
                        </Pressable>
                      );
                    }
                  )}
                </View>
              </View>
            )}

            {/* 12-Step Calibration Workflow Contract */}
            <View style={styles.card}>
              <Text style={styles.cardHeading}>
                12-STEP PAINTERLY ASSET CALIBRATION WORKFLOW
              </Text>
              <Text style={styles.workflowIntro}>
                Every newly created painterly tree-family PNG must proceed through this exact 12-step contract before approval:
              </Text>
              <View style={styles.workflowList}>
                {PAINTERLY_CALIBRATION_WORKFLOW.map((step, idx) => (
                  <View key={step} style={styles.workflowItem}>
                    <Text style={styles.workflowStepNumber}>#{idx + 1}</Text>
                    <Text style={styles.workflowStepText}>{step}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 9 Botanical Attachment Regions */}
            <View style={styles.card}>
              <Text style={styles.cardHeading}>
                9 PREPARED BOTANICAL ATTACHMENT REGIONS (PHASE 1 CONTRACT)
              </Text>
              <Text style={styles.workflowIntro}>
                Calibrated attachment zones preserving relationship event-semantics without changing existing botanical feature IDs:
              </Text>
              <View style={styles.regionsGrid}>
                {Object.values(BOTANICAL_ATTACHMENT_REGIONS).map((reg) => (
                  <View key={reg.id} style={styles.regionCard}>
                    <Text style={styles.regionTitle}>{reg.label}</Text>
                    <Text style={styles.regionDesc}>{reg.description}</Text>
                    <Text style={styles.regionBounds}>
                      Bounds: ({reg.bounds.minX}, {reg.bounds.minY}) to ({reg.bounds.maxX}, {reg.bounds.maxY})
                    </Text>
                    <Text style={styles.regionRoles}>
                      Roles: {reg.compatibleBotanicalRoles.join(", ")}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* TAB 2: STAGE PROGRESSION SIMULATOR                               */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === "simulation" && (
          <View style={styles.sectionContainer}>
            {/* Live Status Card */}
            <View
              style={[
                styles.card,
                { backgroundColor: isLight ? "#F9F6FB" : "#2A2132" },
              ]}
            >
              <Text style={styles.cardHeading}>ACTIVE SIMULATION PLAN</Text>
              <View style={styles.statusGrid}>
                <Text style={[styles.statusLabel, { color: isLight ? "#6B7280" : "#C4B5D0" }]}>Authoritative Progress:</Text>
                <Text style={[styles.statusValue, { color: isLight ? "#1F2937" : "#F7F1FA" }]}>
                  {authoritativeFoundation.totalFoundationProgress.toFixed(1)} / 100 ({authoritativeFoundation.overallDisplayPercent}%)
                </Text>

                <Text style={[styles.statusLabel, { color: isLight ? "#6B7280" : "#C4B5D0" }]}>MVP Visual Stage:</Text>
                <Text style={[styles.statusValue, { color: isLight ? "#1F2937" : "#F7F1FA" }]}>
                  {authoritativeFoundation.levelLabel} · {authoritativeFoundation.currentStage} ({authoritativeFoundation.subphaseKey})
                </Text>

                <Text style={[styles.statusLabel, { color: isLight ? "#6B7280" : "#C4B5D0" }]}>Care / Time Breakdown:</Text>
                <Text style={[styles.statusValue, { color: isLight ? "#1F2937" : "#F7F1FA" }]}>
                  Care: {authoritativeFoundation.rawCareContribution.toFixed(1)} | Time: {authoritativeFoundation.supportingTimeContribution.toFixed(1)} (max 20)
                </Text>

                <Text style={[styles.statusLabel, { color: isLight ? "#6B7280" : "#C4B5D0" }]}>Underlying Legacy Stage:</Text>
                <Text style={[styles.statusValue, { color: isLight ? "#1F2937" : "#F7F1FA" }]}>{stageKey} (diagnostic only)</Text>

                <Text style={[styles.statusLabel, { color: isLight ? "#6B7280" : "#C4B5D0" }]}>Environment Renderer:</Text>
                <Text style={[styles.statusValue, { color: isLight ? "#1F2937" : "#F7F1FA" }]}>
                  {simulationRenderPlan.environmentRenderer}
                </Text>

                <Text style={[styles.statusLabel, { color: isLight ? "#6B7280" : "#C4B5D0" }]}>Structure Renderer:</Text>
                <Text style={[styles.statusValue, { color: isLight ? "#1F2937" : "#F7F1FA" }]}>
                  {simulationRenderPlan.structureRenderer === "painterly_asset"
                    ? "painterly_living_tree"
                    : "procedural (honest fallback)"}
                </Text>

                <Text style={[styles.statusLabel, { color: isLight ? "#6B7280" : "#C4B5D0" }]}>Fallback Reason:</Text>
                <Text style={[styles.statusValue, { color: isLight ? "#1F2937" : "#F7F1FA" }]}>
                  {simulationRenderPlan.fallbackReason ??
                    "None (verified painterly asset active)"}
                </Text>

                <Text style={[styles.statusLabel, { color: isLight ? "#6B7280" : "#C4B5D0" }]}>Structure Scale / Opacity:</Text>
                <Text style={[styles.statusValue, { color: isLight ? "#1F2937" : "#F7F1FA" }]}>
                  {presentation.structureScale.toFixed(2)}x /{" "}
                  {(presentation.structureOpacity * 100).toFixed(0)}%
                </Text>
              </View>
            </View>

            {legacyStageConflict && (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: isLight ? "#FFFBEB" : "#38290E",
                    borderColor: "#D97706",
                    borderWidth: 1.5,
                  },
                ]}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#B45309", marginBottom: 4 }}>
                  ⚠️ DIAGNOSTIC NOTICE: LEGACY STAGE OVERRIDE REJECTED
                </Text>
                <Text style={{ fontSize: 12, color: theme.primaryText, lineHeight: 18 }}>
                  Query parameter stage='{legacyStageConflict.requested}' conflicts with authoritative progress{" "}
                  {legacyStageConflict.totalUnits.toFixed(1)} units ({legacyStageConflict.mvpStage}, Level {legacyStageConflict.mvpLevel} of 3).{" "}
                  Authoritative calculateAuthoritativeFoundation takes strict precedence for MVP visual rendering.
                </Text>
              </View>
            )}

            {/* Stage Selector */}
            <View style={styles.card}>
              <Text style={styles.cardHeading}>1. CANONICAL STAGE</Text>
              <View style={styles.pillRow}>
                {(
                  [
                    "beginning",
                    "first_seedling",
                    "tender_sapling",
                    "branching_out",
                    "leafy_canopy",
                    "rooted_flourishing",
                    "garden_in_bloom",
                  ] as CanonicalStageKeyOrBeginning[]
                ).map((s) => (
                  <Pressable
                    key={s}
                    style={[styles.pill, stageKey === s && styles.pillActive]}
                    onPress={() => setStageKey(s)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        stageKey === s && styles.pillTextActive,
                      ]}
                    >
                      {s}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Atmosphere Tone & Renderer Mode */}
            <View style={styles.card}>
              <Text style={styles.cardHeading}>
                2. ATMOSPHERE TONE & RENDERER MODE
              </Text>
              <View style={styles.pillRow}>
                {(
                  ["calm_light", "calm_dim", "calm_dark"] as GardenAtmosphereTone[]
                ).map((t) => (
                  <Pressable
                    key={t}
                    style={[styles.pill, tone === t && styles.pillActive]}
                    onPress={() => setTone(t)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        tone === t && styles.pillTextActive,
                      ]}
                    >
                      {t}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={[styles.pillRow, { marginTop: 10 }]}>
                {(
                  [
                    "painterly_when_eligible",
                    "procedural",
                  ] as GardenRendererMode[]
                ).map((m) => (
                  <Pressable
                    key={m}
                    style={[
                      styles.pill,
                      rendererMode === m && styles.pillActive,
                    ]}
                    onPress={() => setRendererMode(m)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        rendererMode === m && styles.pillTextActive,
                      ]}
                    >
                      {m}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* History Scenario */}
            <View style={styles.card}>
              <Text style={styles.cardHeading}>
                3. RELATIONSHIP HISTORY SCENARIO
              </Text>
              <View style={styles.pillRow}>
                {(Object.keys(SCENARIOS) as ScenarioKey[]).map((sk) => (
                  <Pressable
                    key={sk}
                    style={[
                      styles.pill,
                      scenarioKey === sk && styles.pillActive,
                    ]}
                    onPress={() => setScenarioKey(sk)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        scenarioKey === sk && styles.pillTextActive,
                      ]}
                    >
                      {SCENARIOS[sk].label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Presentation & Viewport */}
            <View style={styles.card}>
              <Text style={styles.cardHeading}>4. PRESENTATION & VIEWPORT</Text>
              <View style={styles.pillRow}>
                {(["full", "compact", "explore"] as const).map((pm) => (
                  <Pressable
                    key={pm}
                    style={[
                      styles.pill,
                      presentationMode === pm && styles.pillActive,
                    ]}
                    onPress={() => setPresentationMode(pm)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        presentationMode === pm && styles.pillTextActive,
                      ]}
                    >
                      {pm.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={[styles.pillRow, { marginTop: 10 }]}>
                {VIEWPORT_PRESETS.map((vp, idx) => (
                  <Pressable
                    key={vp.label}
                    style={[
                      styles.pill,
                      selectedViewportIdx === idx && styles.pillActive,
                    ]}
                    onPress={() => setSelectedViewportIdx(idx)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        selectedViewportIdx === idx && styles.pillTextActive,
                      ]}
                    >
                      {vp.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Simulation Preview */}
            <View style={styles.artworkSection}>
              <Text style={styles.artworkSectionTitle}>
                SIMULATION PREVIEW · {authoritativeFoundation.levelLabel.toUpperCase()} · {authoritativeFoundation.currentStage.toUpperCase()} ({authoritativeFoundation.totalFoundationProgress.toFixed(1)}/100)
              </Text>
              <View
                style={[
                  styles.viewportContainer,
                  {
                    width: "100%",
                    maxWidth: activeViewport.width,
                    height:
                      presentationMode === "explore"
                        ? 480
                        : presentationMode === "compact"
                        ? 160
                        : 340,
                  },
                ]}
              >
                {presentationMode === "explore" ? (
                  <GardenExplorer
                    world={world}
                    theme={theme}
                    isLight={isLight}
                    isDim={effectiveTheme === "dim"}
                    seedString={params.couple || FIXTURE_SEED}
                    totalGrowthUnits={growth.total}
                    careGrowthUnits={growth.care}
                    timeGrowthUnits={growth.time}
                    isResting={scenario.isResting}
                    careSignals={scenario.signals}
                    careEvents={scenario.events}
                    initialCameraMode={
                      params.camera === "focus" || params.camera === "inspect"
                        ? "plant_focus"
                        : undefined
                    }
                    initialFeatureId={
                      params.initialFeature === "none" || params.initialFeature === "null"
                        ? null
                        : params.initialFeature ||
                          (scenario.events[0]
                            ? getCareFeatureId(scenario.events[0].kind, scenario.events[0].id)
                            : null)
                    }
                    onClose={() => setPresentationMode("full")}
                  />
                ) : (
                  <View style={{ flex: 1, position: "relative" }}>
                    <GardenVisualizer
                      seedString={params.couple || FIXTURE_SEED}
                      totalGrowthUnits={growth.total}
                      careGrowthUnits={growth.care}
                      timeGrowthUnits={growth.time}
                      isResting={scenario.isResting}
                      compact={presentationMode === "compact"}
                      careSignals={scenario.signals}
                      careEvents={scenario.events}
                      rendererMode={rendererMode}
                      atmosphereTone={tone}
                      presentation={presentation}
                      world={world}
                      style={{ flex: 1 }}
                      hideOverlays={Boolean((scenario as any).hideOverlays)}
                      cropPreset={compositionPreset}
                      showGuides={showAlignmentGuides}
                      showFoliageProof={showFoliageProof}
                    />
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* TAB 3: EARLY-LIFE LIFECYCLE FOUNDATION PREVIEW                   */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === "early_life" && (
          <View style={styles.sectionContainer}>
            {/* Subphase Selector */}
            <View style={styles.card}>
              <Text style={styles.cardHeading}>EARLY-LIFE VISUAL SUBPHASES</Text>
              <Text style={styles.cardSubtext}>
                Bounded visual subphases reconciled with canonical stages. Zero production threshold changes.
              </Text>
              <View style={styles.pillRow}>
                {EARLY_LIFE_SUBPHASES.map((spKey) => {
                  const spContract = EARLY_LIFE_SUBPHASE_CONTRACTS[spKey];
                  const isSelected = effectiveEarlyLifeSubphase === spKey;
                  return (
                    <Pressable
                      key={spKey}
                      style={[
                        styles.pill,
                        isSelected && styles.pillActive,
                      ]}
                      onPress={() => {
                        setUseSimulatedGrowth(false);
                        setEarlyLifeSubphase(spKey);
                        setSimulatedUnits(EARLY_LIFE_PREVIEW_UNITS[spKey]);
                      }}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          isSelected && styles.pillTextActive,
                        ]}
                      >
                        {spContract.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Simulated Progress Control (Development Preview Only) */}
            <View
              style={[
                styles.card,
                {
                  borderWidth: 1.5,
                  borderColor: useSimulatedGrowth ? "#7C3AED" : theme.borderSoft,
                  backgroundColor: useSimulatedGrowth
                    ? isLight
                      ? "#FAF5FF"
                      : "#2E1A47"
                    : theme.surface,
                },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardHeading, { color: useSimulatedGrowth ? "#7C3AED" : theme.primaryText }]}>
                    SIMULATED PROGRESSION CONTROL (PREVIEW)
                  </Text>
                  <Text style={styles.cardSubtext}>
                    Demonstrates: progress changes → threshold crossing → next visual state. Development preview only.
                  </Text>
                </View>
                <Switch
                  value={useSimulatedGrowth}
                  onValueChange={setUseSimulatedGrowth}
                  trackColor={{ false: "#767577", true: "#7C3AED" }}
                />
              </View>

              {/* Status Row */}
              <View
                style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 10,
                  backgroundColor: isLight ? "#FFFFFF" : "#1F162B",
                  borderWidth: 1,
                  borderColor: theme.borderSoft,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: theme.primaryText }}>
                    Units: {simulatedUnits.toFixed(1)}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#7C3AED" }}>
                    {previewMilestone.intervalDisplayPercent}% toward {previewMilestone.nextMilestoneLabel || "Full Bloom"}
                  </Text>
                </View>

                {/* Progress Bar */}
                <View
                  style={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: isLight ? "#E5E1E8" : "#372F3F",
                    overflow: "hidden",
                    marginVertical: 8,
                    width: "100%",
                  }}
                >
                  <View
                    style={{
                      height: "100%",
                      borderRadius: 4,
                      backgroundColor: "#7C3AED",
                      width: `${Math.round(previewMilestone.intervalProgress * 100)}%`,
                    }}
                  />
                </View>

                <Text style={{ fontSize: 12, color: theme.secondaryText }}>
                  {useSimulatedGrowth ? "Active simulated subphase" : "Manual preview selection"}: <Text style={{ fontWeight: "600", color: theme.primaryText }}>{previewMilestone.label}</Text>
                  {simulatedUnits === 8.0 && " • Exactly at shoot-to-seedling boundary"}
                  {simulatedUnits === 16.0 && " • Exactly at seedling-to-sapling boundary"}
                </Text>
              </View>

              {/* Threshold Crossing Simulation Presets */}
              <Text style={[styles.toggleLabel, { marginTop: 12, marginBottom: 6 }]}>
                100-Unit MVP Boundary Test Points:
              </Text>
              <View style={styles.pillRow}>
                {[
                  { label: "0.0 (Acorn 0%)", val: 0.0 },
                  { label: "23.99 (Level 1 99%)", val: 23.99 },
                  { label: "24.0 (Level 2 0%)", val: 24.0 },
                  { label: "59.99 (Level 2 99%)", val: 59.99 },
                  { label: "60.0 (Level 3 0%)", val: 60.0 },
                  { label: "99.99 (Level 3 99%)", val: 99.99 },
                  { label: "100.0 (Complete)", val: 100.0 },
                ].map((pt) => {
                  const isCur = Math.abs(simulatedUnits - pt.val) < 0.05 && useSimulatedGrowth;
                  return (
                    <Pressable
                      key={pt.label}
                      style={[
                        styles.pill,
                        isCur && styles.pillActive,
                      ]}
                      onPress={() => {
                        setUseSimulatedGrowth(true);
                        setSimulatedUnits(pt.val);
                      }}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          isCur && styles.pillTextActive,
                        ]}
                      >
                        {pt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Stepper Fine Adjustment */}
              <View style={[styles.pillRow, { marginTop: 8 }]}>
                <Pressable
                  style={styles.pill}
                  onPress={() => {
                    setUseSimulatedGrowth(true);
                    setSimulatedUnits((u) => Math.max(0, parseFloat((u - 1.0).toFixed(1))));
                  }}
                >
                  <Text style={styles.pillText}>-1.0</Text>
                </Pressable>
                <Pressable
                  style={styles.pill}
                  onPress={() => {
                    setUseSimulatedGrowth(true);
                    setSimulatedUnits((u) => Math.max(0, parseFloat((u - 0.1).toFixed(1))));
                  }}
                >
                  <Text style={styles.pillText}>-0.1</Text>
                </Pressable>
                <Pressable
                  style={styles.pill}
                  onPress={() => {
                    setUseSimulatedGrowth(true);
                    setSimulatedUnits((u) => Math.min(36, parseFloat((u + 0.1).toFixed(1))));
                  }}
                >
                  <Text style={styles.pillText}>+0.1</Text>
                </Pressable>
                <Pressable
                  style={styles.pill}
                  onPress={() => {
                    setUseSimulatedGrowth(true);
                    setSimulatedUnits((u) => Math.min(36, parseFloat((u + 1.0).toFixed(1))));
                  }}
                >
                  <Text style={styles.pillText}>+1.0</Text>
                </Pressable>
              </View>
            </View>

            {/* Subphase Contract & Canonical Alignment Card */}
            <View
              style={[
                styles.card,
                { backgroundColor: isLight ? "#F9F6FB" : "#2A2132" },
              ]}
            >
              <Text
                style={[
                  styles.cardHeading,
                  { color: isLight ? "#6B7280" : "#D8CBE0" },
                ]}
              >
                SUBPHASE SPECIFICATION & INTEGRATION CONTRACT
              </Text>
              <View style={styles.statusGrid}>
                <Text style={[styles.statusLabel, { color: isLight ? "#6B7280" : "#C4B5D0" }]}>Subphase:</Text>
                <Text style={[styles.statusValue, { color: isLight ? "#1F2937" : "#F7F1FA" }]}>
                  {earlyLifeContract.label} ({earlyLifeContract.subphaseKey})
                </Text>

                <Text style={[styles.statusLabel, { color: isLight ? "#6B7280" : "#C4B5D0" }]}>Canonical Stage:</Text>
                <Text style={[styles.statusValue, { color: isLight ? "#1F2937" : "#F7F1FA" }]}>
                  {earlyLifeContract.reconciledCanonicalStage} ({earlyLifeGrowth.total} units)
                </Text>

                <Text style={[styles.statusLabel, { color: isLight ? "#6B7280" : "#C4B5D0" }]}>Soil Horizon Baseline:</Text>
                <Text style={[styles.statusValue, { color: isLight ? "#1F2937" : "#F7F1FA" }]}>
                  y = {earlyLifeContract.soilBaseline.toFixed(1)} px (Continuous clearing soil)
                </Text>

                <Text style={[styles.statusLabel, { color: isLight ? "#6B7280" : "#C4B5D0" }]}>Trunk / Shoot Origin:</Text>
                <Text style={[styles.statusValue, { color: isLight ? "#1F2937" : "#F7F1FA" }]}>
                  x = {earlyLifeContract.rootOrigin.x.toFixed(1)} px
                </Text>

                <Text style={[styles.statusLabel, { color: isLight ? "#6B7280" : "#C4B5D0" }]}>Target Asset:</Text>
                <Text
                  style={[
                    styles.statusValue,
                    {
                      color:
                        earlyLifeAssetSlot.status === "missing"
                          ? "#F59E0B"
                          : earlyLifeAssetSlot.status === "approved"
                          ? "#34D399"
                          : "#A78BFA",
                    },
                  ]}
                >
                  {earlyLifeAssetSlot.targetFilename} (Status: {earlyLifeAssetSlot.status === "development_preview" ? "PRESENT — DEVELOPMENT PREVIEW" : earlyLifeAssetSlot.status.toUpperCase()})
                </Text>

                <Text style={[styles.statusLabel, { color: isLight ? "#6B7280" : "#C4B5D0" }]}>Active Rendering Path:</Text>
                <Text style={[styles.statusValue, { color: isLight ? "#1F2937" : "#F7F1FA" }]}>
                  {earlyLifeAssetSlot.status === "missing"
                    ? "Stage-correct procedural fallback (no mature tree scaling)"
                    : "Calibrated painterly raster asset"}
                </Text>

                <Text style={[styles.statusLabel, { color: isLight ? "#6B7280" : "#C4B5D0" }]}>Natural Foliage Source:</Text>
                <Text style={[styles.statusValue, { color: isLight ? "#1F2937" : "#F7F1FA" }]}>
                  sourceEvent = null, isEarned = false (Zero memory attribution)
                </Text>
              </View>
              <Text style={[styles.cardSubtext, { marginTop: 10, fontStyle: "italic", color: isLight ? "#6B7280" : "#C4B5D0" }]}>
                {earlyLifeContract.description}
              </Text>
            </View>

            {/* Interactive Lifecycle Controls Card */}
            <View style={styles.card}>
              <Text style={styles.cardHeading}>INTERACTIVE LIFECYCLE CONTROLS</Text>

              {/* Reduced Motion Toggle & Manual Navigation */}
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Reduced Motion Mode</Text>
                  <Text style={styles.toggleDescription}>
                    {earlyLifeReducedMotion
                      ? "ON: Settled states with manual stepping (auto-advance disabled)"
                      : "OFF: Interactive transitions"}
                  </Text>
                </View>
                <Switch
                  value={earlyLifeReducedMotion}
                  onValueChange={setEarlyLifeReducedMotion}
                  trackColor={{ false: "#767577", true: "#7C3AED" }}
                />
              </View>

              {earlyLifeReducedMotion && (
                <View style={[styles.pillRow, { marginTop: 12 }]}>
                  <Pressable
                    style={[
                      styles.pill,
                      earlyLifeSubphaseIdx === 0 && { opacity: 0.4 },
                    ]}
                    onPress={handlePrevSubphase}
                    disabled={earlyLifeSubphaseIdx === 0}
                  >
                    <Text style={styles.pillText}>‹ Previous Subphase</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.pill,
                      earlyLifeSubphaseIdx === EARLY_LIFE_SUBPHASES.length - 1 && {
                        opacity: 0.4,
                      },
                    ]}
                    onPress={handleNextSubphase}
                    disabled={
                      earlyLifeSubphaseIdx === EARLY_LIFE_SUBPHASES.length - 1
                    }
                  >
                    <Text style={styles.pillText}>Next Subphase ›</Text>
                  </Pressable>
                </View>
              )}

              {/* Earned Feature Demonstrator Toggle */}
              <View style={[styles.toggleRow, { marginTop: 16 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Demonstrate Earned Feature</Text>
                  <Text style={styles.toggleDescription}>
                    {earlyLifeShowEarnedFeature && earlyLifeSubphase !== "planted_acorn"
                      ? "Showing 1 clearly labeled fixture moment attached to structure"
                      : "Zero events (pure baseline botanical structure)"}
                  </Text>
                </View>
                <Switch
                  value={earlyLifeShowEarnedFeature}
                  onValueChange={setEarlyLifeShowEarnedFeature}
                  trackColor={{ false: "#767577", true: "#7C3AED" }}
                />
              </View>

              {/* Alignment Guides Toggle */}
              <View style={[styles.toggleRow, { marginTop: 16 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Diagnostic Alignment Guides</Text>
                  <Text style={styles.toggleDescription}>
                    {showAlignmentGuides
                      ? "ON: Showing centerline (x=390.4), ground baseline (y=441.0), and root pivot"
                      : "OFF: Clean visual review without diagnostic lines or crosshairs"}
                  </Text>
                </View>
                <Switch
                  value={showAlignmentGuides}
                  onValueChange={setShowAlignmentGuides}
                  trackColor={{ false: "#767577", true: "#7C3AED" }}
                />
              </View>

              {earlyLifeShowEarnedFeature && earlyLifeSubphase !== "planted_acorn" && (
                <View
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 8,
                    backgroundColor: isLight ? "#EFF6FF" : "#1E293B",
                    borderWidth: 1,
                    borderColor: isLight ? "#BFDBFE" : "#3B82F6",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: isLight ? "#1D4ED8" : "#93C5FD",
                    }}
                  >
                    🌿 SEPARATELY IDENTIFIED EARNED FEATURE FIXTURE (OAK LEAF FLUSH)
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: isLight ? "#1E40AF" : "#BFDBFE",
                      marginTop: 4,
                    }}
                  >
                    ID: earned:positive_moment:fixture-early-life-1 • Title: Morning Quiet Together
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: isLight ? "#1E40AF" : "#BFDBFE",
                      marginTop: 2,
                    }}
                  >
                    Attachment: Lateral stem node (391.0, 395.0) • Tender oak leaf flush / shoot (no flower/blossom)
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: isLight ? "#15803D" : "#86EFAC",
                      marginTop: 4,
                      fontWeight: "600",
                    }}
                  >
                    ✓ Baseline natural first leaves carry sourceEvent = null (zero memory attribution)
                  </Text>
                </View>
              )}
            </View>

            {/* Live Canvas Viewport Card */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardHeading}>
                  EARLY-LIFE LIVE CANVAS ({activeViewport.label})
                </Text>
                <Text style={styles.cardSubtext}>
                  Anchor: (390.4, 316.7) | Preset: middle_distance
                </Text>
              </View>

              {/* Camera Action Buttons: Inspect Plant & Reset View */}
              <View style={[styles.pillRow, { marginBottom: 10 }]}>
                <Pressable
                  style={[
                    styles.pill,
                    earlyLifeCameraMode === "inspect" && styles.pillActive,
                  ]}
                  onPress={() => setEarlyLifeCameraMode("inspect")}
                  accessibilityRole="button"
                  accessibilityLabel="Inspect plant"
                  accessibilityHint="Zooms camera to inspect plant at permanent planting anchor without moving the object"
                >
                  <Text
                    style={[
                      styles.pillText,
                      earlyLifeCameraMode === "inspect" && styles.pillTextActive,
                    ]}
                  >
                    🔍 Inspect Plant (Zoom Camera)
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.pill,
                    earlyLifeCameraMode === "overview" && styles.pillActive,
                  ]}
                  onPress={() => setEarlyLifeCameraMode("overview")}
                  accessibilityRole="button"
                  accessibilityLabel="Reset clearing view"
                  accessibilityHint="Restores camera to approved middle-distance clearing overview"
                >
                  <Text
                    style={[
                      styles.pillText,
                      earlyLifeCameraMode === "overview" && styles.pillTextActive,
                    ]}
                  >
                    ↺ Reset (Clearing Overview)
                  </Text>
                </Pressable>
              </View>

              <View
                style={{
                  marginBottom: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                  backgroundColor: isLight ? "#F3F4F6" : "#1F2937",
                }}
              >
                <Text style={{ fontSize: 11, color: isLight ? "#4B5563" : "#9CA3AF" }}>
                  Camera: {earlyLifeCameraMode === "inspect" ? `Inspect Mode (Zoom: ${earlyLifeCamera.zoom.toFixed(2)}x, Target: ${earlyLifeCamera.targetX.toFixed(1)}, ${earlyLifeCamera.targetY.toFixed(1)})` : "Clearing Overview (Zoom: 1.0x, middle_distance)"} • Anchor: (390.4, 316.68)
                </Text>
              </View>

              <View
                style={[
                  styles.previewViewportWrapper,
                  {
                    maxWidth: activeViewport.width,
                    height: 380,
                  },
                ]}
              >
                <GardenVisualizer
                  seedString={FIXTURE_SEED}
                  totalGrowthUnits={earlyLifeGrowth.total}
                  careGrowthUnits={earlyLifeGrowth.care}
                  timeGrowthUnits={earlyLifeGrowth.time}
                  isResting={false}
                  compact={false}
                  careSignals={{
                    positiveMoments: earlyLifeFixtureEvents.length,
                    reconnections: 0,
                    importantDates: 0,
                  }}
                  careEvents={earlyLifeFixtureEvents}
                  rendererMode="painterly_when_eligible"
                  atmosphereTone="calm_light"
                  world={earlyLifeWorld}
                  style={{ flex: 1 }}
                  cropPreset="middle_distance"
                  showGuides={showAlignmentGuides}
                  exploreMode={earlyLifeCameraMode === "inspect"}
                  camera={earlyLifeCamera}
                />
              </View>

              {/* Production MVP 100-Unit Growth Progress Section */}
              <GardenProgressSection
                totalGrowthUnits={earlyLifeGrowth.total}
                careGrowthUnits={earlyLifeGrowth.care}
                timeGrowthUnits={earlyLifeGrowth.time}
                style={{ marginTop: 12 }}
              />

              {/* Our Space Compact Card Variant */}
              <View
                style={[
                  styles.card,
                  {
                    marginTop: 12,
                    backgroundColor: isLight ? "#FFFFFF" : "#1F162B",
                    padding: 14,
                    borderColor: theme.borderSoft,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={styles.cardHeading}>OUR SPACE COMPACT CARD VARIANT</Text>
                <GardenProgressSection
                  totalGrowthUnits={earlyLifeGrowth.total}
                  careGrowthUnits={earlyLifeGrowth.care}
                  timeGrowthUnits={earlyLifeGrowth.time}
                  compact={true}
                />
              </View>
            </View>

            {/* Invariant Verification Grid */}
            <View
              style={[
                styles.card,
                { backgroundColor: isLight ? "#F0FDF4" : "#14532D" },
              ]}
            >
              <Text
                style={[
                  styles.cardHeading,
                  { color: isLight ? "#166534" : "#BBF7D0" },
                ]}
              >
                EARLY-LIFE INVARIANT CHECKLIST
              </Text>
              <View style={{ marginTop: 8, gap: 6 }}>
                <Text
                  style={{
                    fontSize: 12,
                    color: isLight ? "#166534" : "#BBF7D0",
                  }}
                >
                  ✓ Soil position continuous at baseline y = 441.0 and center x = 390.4
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: isLight ? "#166534" : "#BBF7D0",
                  }}
                >
                  ✓ Reconciles with canonical stages (beginning, seedling, sapling); zero new thresholds
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: isLight ? "#166534" : "#BBF7D0",
                  }}
                >
                  ✓ Natural first leaves have sourceEvent = null (zero memory attribution)
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: isLight ? "#166534" : "#BBF7D0",
                  }}
                >
                  ✓ Earned features independently identified and labeled
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: isLight ? "#166534" : "#BBF7D0",
                  }}
                >
                  ✓ Missing artwork slots exposed honestly; no mature oak scaling
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: isLight ? "#166534" : "#BBF7D0",
                  }}
                >
                  ✓ Presentation-only animation; zero database writes or state persistence
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* TAB 4: GARDEN STORY 100-UNIT MILESTONE PARITY                   */}
        {/* ---------------------------------------------------------------- */}
        {activeTab === "story" && (
          <View style={styles.sectionContainer}>
            <View style={styles.card}>
              <Text style={styles.cardHeading}>GARDEN STORY 100-UNIT PLAYBACK LAB</Text>
              <Text style={styles.cardSubtext}>
                Inspects event-first ordering, memory leaf highlight, followed by the crossed milestone frame.
              </Text>
            </View>

            <View
              style={{
                width: "100%",
                maxWidth: 420,
                alignSelf: "center",
                borderRadius: 20,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: theme.borderSoft,
              }}
            >
              <GardenStoryPlayer
                key="qa-story-player"
                story={qaStory}
                theme={theme}
                isLight={isLight}
                isDim={effectiveTheme === "dim"}
                coupleId={FIXTURE_COUPLE_ID}
                liveCareEvents={qaStory.steps[qaStory.steps.length - 1].cumulativeCareEvents}
                onClose={() => setActiveTab("early_life")}
                onPlayAgain={() => {}}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </CouplyPage>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 16,
  },
  persistentBanner: {
    backgroundColor: "#FDF2F8",
    borderWidth: 1.5,
    borderColor: "#F472B6",
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  persistentBannerTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#BE185D",
    letterSpacing: 0.5,
  },
  persistentBannerBody: {
    fontSize: 12,
    color: "#9D174D",
    lineHeight: 18,
  },
  tabBar: {
    flexDirection: "row",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: "#7C3AED",
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4B5563",
  },
  tabButtonTextActive: {
    color: "#FFFFFF",
  },
  sectionContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 10,
  },
  cardHeading: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#6B7280",
  },
  cardSubtext: {
    fontSize: 11,
    color: "#6B7280",
  },
  toggleDescription: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  previewViewportWrapper: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#7C3AED",
    width: "100%",
  },
  statusGrid: {
    gap: 6,
  },
  statusLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
  },
  statusValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  pillActive: {
    backgroundColor: "#7C3AED",
    borderColor: "#6D28D9",
  },
  pillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4B5563",
  },
  pillTextActive: {
    color: "#FFFFFF",
  },
  slotPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  slotPillActive: {
    backgroundColor: "#EDE9FE",
    borderColor: "#7C3AED",
  },
  slotPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },
  slotPillTextActive: {
    color: "#6D28D9",
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeApproved: {
    backgroundColor: "#D1FAE5",
  },
  badgePreview: {
    backgroundColor: "#DBEAFE",
  },
  badgeMissing: {
    backgroundColor: "#FEE2E2",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
  },
  badgeTextApproved: {
    color: "#065F46",
  },
  badgeTextPreview: {
    color: "#1D4ED8",
  },
  badgeTextMissing: {
    color: "#991B1B",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  artworkSection: {
    gap: 8,
    alignItems: "center",
  },
  artworkSectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#4B5563",
    alignSelf: "flex-start",
  },
  viewportContainer: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#7C3AED",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  unsuppliedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  unsuppliedOverlayCard: {
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#F87171",
    padding: 16,
    maxWidth: 520,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    gap: 8,
  },
  unsuppliedBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: "#B91C1C",
    letterSpacing: 1,
  },
  unsuppliedHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1F2937",
    textAlign: "center",
  },
  unsuppliedDescription: {
    fontSize: 12,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 17,
  },
  unsuppliedSpecs: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#FEE2E2",
    width: "100%",
    gap: 4,
  },
  unsuppliedSpecLine: {
    fontSize: 11,
    color: "#374151",
    lineHeight: 16,
  },
  boldMono: {
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
    fontWeight: "700",
    color: "#111827",
  },
  comparisonGrid: {
    gap: 12,
  },
  comparisonCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  comparisonCardSelected: {
    borderColor: "#7C3AED",
    backgroundColor: "#FAF5FF",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  comparisonTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1F2937",
  },
  comparisonDesc: {
    fontSize: 11,
    color: "#6B7280",
    lineHeight: 16,
  },
  comparisonMetaList: {
    marginTop: 4,
    gap: 3,
  },
  metaRow: {
    fontSize: 11,
    color: "#4B5563",
  },
  metaLabel: {
    fontWeight: "700",
    color: "#374151",
  },
  metaVal: {
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
    fontSize: 10,
    color: "#1F2937",
  },
  workflowIntro: {
    fontSize: 12,
    color: "#4B5563",
    lineHeight: 18,
  },
  workflowList: {
    marginTop: 4,
    gap: 6,
  },
  workflowItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  workflowStepNumber: {
    fontSize: 10,
    fontWeight: "800",
    color: "#7C3AED",
    width: 28,
  },
  workflowStepText: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
    color: "#374151",
  },
  regionsGrid: {
    gap: 8,
  },
  regionCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    gap: 3,
  },
  regionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1F2937",
  },
  regionDesc: {
    fontSize: 11,
    color: "#4B5563",
    lineHeight: 16,
  },
  regionBounds: {
    fontSize: 10,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
    color: "#6B7280",
  },
  regionRoles: {
    fontSize: 10,
    fontWeight: "600",
    color: "#7C3AED",
  },
});
