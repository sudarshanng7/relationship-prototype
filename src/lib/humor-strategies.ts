/**
 * Humor Strategy Engine for Purple Garden.
 *
 * Implements 15 distinct humor strategy families with semantic suitability rules:
 * - H1: Personification
 * - H2: Unexpected occupation
 * - H3: Miniature adventure
 * - H4: Playful contrast
 * - H5: Mock bureaucracy
 * - H6: Dramatic scale exaggeration
 * - H7: Unexpected comparison
 * - H8: Affectionate absurdity
 * - H9: Harmless role reversal
 * - H10: Mock announcement
 * - H11: Genre parody
 * - H12: Understatement
 * - H13: Playful timing mismatch
 * - H14: Visual absurdity
 * - H15: Everyday observational humor
 */

import type { InterpretedSituation } from "./situation-interpreter.ts";

export interface HumorStrategy {
  id: string;
  name: string;
  description: string;
  suitableTones: ("gentle" | "playful" | "exaggerated")[];
  isCompatible: (situation: InterpretedSituation) => boolean;
}

export const HUMOR_STRATEGIES: HumorStrategy[] = [
  {
    id: "H1_personification",
    name: "Personification",
    description: "Giving an object a harmless personality, free will, or innocent intention.",
    suitableTones: ["gentle", "playful"],
    isCompatible: (s) => s.entities.length > 0 && s.sensitivity !== "boundary" && s.sensitivity !== "serious",
  },
  {
    id: "H2_unexpected_occupation",
    name: "Unexpected occupation",
    description: "Turning a habit into a fictional profession, performer, or specialist role.",
    suitableTones: ["playful", "exaggerated"],
    isCompatible: (s) => s.behaviors.length > 0 && s.sensitivity !== "boundary" && s.sensitivity !== "serious",
  },
  {
    id: "H3_miniature_adventure",
    name: "Miniature adventure",
    description: "Framing an everyday habit as a tiny expedition, road trip, or safari.",
    suitableTones: ["gentle", "playful"],
    isCompatible: (s) => (s.family === "time_punctuality" || s.family === "personal_belongings" || s.family === "sleep_routines") && s.sensitivity !== "serious",
  },
  {
    id: "H4_playful_contrast",
    name: "Playful contrast",
    description: "Combining an expected solemn/serious atmosphere with an unexpected interruption.",
    suitableTones: ["gentle", "playful", "exaggerated"],
    isCompatible: (s) => Boolean(s.contrast) && s.sensitivity !== "serious",
  },
  {
    id: "H5_mock_bureaucracy",
    name: "Mock bureaucracy",
    description: "Using fictional committees, unanimous voting, permits, or diplomatic summits.",
    suitableTones: ["playful", "exaggerated"],
    isCompatible: (s) => s.sensitivity === "boundary" || s.family === "kitchen_food" || s.family === "shared_responsibilities",
  },
  {
    id: "H6_dramatic_scale",
    name: "Dramatic scale exaggeration",
    description: "Framing a domestic moment as a stadium broadcast, world tour, or festival.",
    suitableTones: ["exaggerated"],
    isCompatible: (s) => s.sensitivity !== "serious",
  },
  {
    id: "H7_unexpected_comparison",
    name: "Unexpected comparison",
    description: "Comparing the situation with an amusing everyday parallel.",
    suitableTones: ["gentle", "playful"],
    isCompatible: (s) => s.sensitivity !== "serious",
  },
  {
    id: "H8_affectionate_absurdity",
    name: "Affectionate absurdity",
    description: "Inventing an imaginative, warm explanation that lightens without attacking.",
    suitableTones: ["gentle", "playful", "exaggerated"],
    isCompatible: (s) => s.sensitivity !== "serious",
  },
  {
    id: "H9_role_reversal",
    name: "Harmless role reversal",
    description: "An object or circumstance behaving as though it is running the household.",
    suitableTones: ["playful", "exaggerated"],
    isCompatible: (s) => s.entities.length > 0 && s.sensitivity !== "serious",
  },
  {
    id: "H10_mock_announcement",
    name: "Mock announcement",
    description: "Public notice, evening dispatch, or official household broadcast.",
    suitableTones: ["exaggerated"],
    isCompatible: (s) => s.sensitivity !== "boundary" && s.sensitivity !== "serious",
  },
  {
    id: "H11_genre_parody",
    name: "Genre parody",
    description: "Documentary observation, sports play-by-play, or cinematic suspense.",
    suitableTones: ["playful", "exaggerated"],
    isCompatible: (s) => s.sensitivity !== "serious",
  },
  {
    id: "H12_understatement",
    name: "Understatement",
    description: "Dry, gentle observation that makes the contrast amusing through calm economy.",
    suitableTones: ["gentle"],
    isCompatible: (s) => s.sensitivity !== "serious",
  },
  {
    id: "H13_timing_mismatch",
    name: "Playful timing mismatch",
    description: "Highlighting how something arrived at an unexpectedly unsuitable second.",
    suitableTones: ["gentle", "playful"],
    isCompatible: (s) => (Boolean(s.context) || Boolean(s.contrast)) && s.sensitivity !== "serious",
  },
  {
    id: "H14_visual_absurdity",
    name: "Visual absurdity",
    description: "Forming a funny, harmless mental picture of the situation.",
    suitableTones: ["playful", "exaggerated"],
    isCompatible: (s) => s.sensitivity !== "serious",
  },
  {
    id: "H15_everyday_observation",
    name: "Everyday observational humor",
    description: "Highlighting the familiar domestic quirks that everyone recognizes in shared life.",
    suitableTones: ["gentle", "playful"],
    isCompatible: (s) => s.sensitivity !== "serious",
  },
];

/**
 * Selects compatible strategies for a given situation and tone.
 */
export function selectHumorStrategies(
  situation: InterpretedSituation,
  tone: "gentle" | "playful" | "exaggerated"
): HumorStrategy[] {
  return HUMOR_STRATEGIES.filter((st) => st.suitableTones.includes(tone) && st.isCompatible(situation));
}
