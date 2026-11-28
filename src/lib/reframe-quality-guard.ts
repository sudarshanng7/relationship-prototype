/**
 * Quality Guard for Purple Garden Reframe Generation.
 *
 * Validates candidate angles before presentation:
 * - Semantic relevance and context preservation
 * - Prevention of unsupported hallucinations (unrelated objects, rooms)
 * - Length and brevity constraints
 * - Tone distinctness across cards
 * - Strict sensitivity safeguards (no victim-blaming, humiliation, or coercion dismissal)
 * - Repetition prevention
 */

import type { InterpretedSituation } from "./situation-interpreter.ts";
import type { BoundSituation } from "./knowledge-resolver.ts";
import type { ComposedAngles } from "./tone-composer.ts";

export interface QualityValidationResult {
  isValid: boolean;
  issues: string[];
  validatedAngles: ComposedAngles;
}

const FORBIDDEN_DISMISSIVE_WORDS = [
  "silly",
  "hysterical",
  "laugh it off",
  "get over it",
  "just relax",
  "calm down",
  "overreacting",
  "not a big deal",
];

// Ungrounded generic phrases that indicate generation failure / hallucinated templates
const FORBIDDEN_UNGROUNDED_GENERIC_PATTERNS = [
  /pause button/i,
  /afternoon recess/i,
  /unprecedented pause/i,
  /domestic observers announce/i,
  /declared sovereignty over that corner/i,
  /test our daily observation skills/i,
  /resting quietly right where it is/i,
  /small human moment/i,
  /small everyday moment that just asks for a calm breath/i,
];

function wordCount(str: string): number {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Validates generated angles against strict quality criteria.
 */
export function validateReframeQuality(
  angles: ComposedAngles,
  situation: InterpretedSituation | BoundSituation
): QualityValidationResult {
  const issues: string[] = [];

  const { gentle, playful, exaggerated } = angles;

  // 1. Non-empty string check
  if (!gentle || !playful || !exaggerated) {
    issues.push("Empty angle text detected");
  }

  // 2. Tone distinctness
  if (gentle === playful || playful === exaggerated || gentle === exaggerated) {
    issues.push("Angles must be materially distinct strings");
  }

  // 3. Length constraints
  const gCount = wordCount(gentle);
  const pCount = wordCount(playful);
  const eCount = wordCount(exaggerated);

  if (gCount < 5 || gCount > 30) {
    issues.push(`Gentle tone word count (${gCount}) out of range (5-30)`);
  }
  if (pCount < 6 || pCount > 35) {
    issues.push(`Playful tone word count (${pCount}) out of range (6-35)`);
  }
  if (eCount < 7 || eCount > 40) {
    issues.push(`Exaggerated tone word count (${eCount}) out of range (7-40)`);
  }

  // 4. Sensitivity safeguards for boundary concerns
  const sens = situation?.sensitivity;
  if (sens === "boundary" || sens === "serious" || sens === "boundary_concern" || sens === "serious_unsafe") {
    const combined = (gentle + " " + playful + " " + exaggerated).toLowerCase();
    for (const forbidden of FORBIDDEN_DISMISSIVE_WORDS) {
      if (combined.includes(forbidden)) {
        issues.push(`Forbidden dismissive term "${forbidden}" found in boundary reframe`);
      }
    }
  }

  // 5. Ungrounded generic template rejection:
  // If the situation has an explicit proposition, unknown topic, or lacks grounded physical entities,
  // do not permit returning ungrounded pause-button or sovereignty cliches
  const combinedAll = gentle + " " + playful + " " + exaggerated;
  const legacySit = situation as InterpretedSituation;
  const boundSit = situation as BoundSituation;
  if (
    legacySit?.situationType === "ambiguous" ||
    legacySit?.linguistic?.proposition ||
    boundSit?.outcomeType === "clarification_needed" ||
    boundSit?.proposition
  ) {
    for (const pat of FORBIDDEN_UNGROUNDED_GENERIC_PATTERNS) {
      if (pat.test(combinedAll)) {
        issues.push(`Ungrounded generic template "${pat}" rejected for ambiguous/proposition input`);
        break;
      }
    }
  }

  // 6. Semantic grounding and anti-contradiction checks
  if (boundSit && boundSit.rawText) {
    const rawLower = boundSit.rawText.toLowerCase();
    const combinedLower = combinedAll.toLowerCase();

    // Guard: Active cleaning must not emit soaking/untouched/ignored lines
    if (boundSit.actionPolarity === "active" && /\b(scrub|scrubbing|clean|cleaning|wash|washing)\b/i.test(rawLower)) {
      if (/\b(soaking|bubble bath|unwashed|ignored|waiting for brave|untouched)\b/i.test(combinedLower)) {
        issues.push("Contradictory soaking/omission reframe emitted for active cleaning action");
      }
    }

    // Guard: Avoided/negated chores must not emit vigorous scrubbing lines
    if ((boundSit.actionPolarity === "avoided" || boundSit.actionPolarity === "negated") &&
        /\b(scrubbing so enthusiastically|elbow grease|shaving mirror|upper-body arm workout)\b/i.test(combinedLower)) {
      issues.push("Contradictory vigorous scrubbing reframe emitted for avoided/negated chore");
    }

    // Guard: Unrelated room/location hallucination guard
    if (/\bkitchen\b/i.test(rawLower) && !/\bbedroom\b/i.test(rawLower) && /\bcheck how the bedroom is doing\b/i.test(combinedLower)) {
      issues.push("Contradictory room hallucination (bedroom in kitchen chore)");
    }
  }

  // 7. Basic grammar checks (starts with capital, ends with valid terminal punctuation)
  const isCapitalized = (s: string) => /^[A-Z"“]/.test(s.trim());
  const hasTerminalPunctuation = (s: string) => /[.!?"]$/.test(s.trim());

  if (!isCapitalized(gentle) || !isCapitalized(playful) || !isCapitalized(exaggerated)) {
    issues.push("Angles must start with an uppercase letter or quote");
  }
  if (!hasTerminalPunctuation(gentle) || !hasTerminalPunctuation(playful) || !hasTerminalPunctuation(exaggerated)) {
    issues.push("Angles must end with terminal punctuation");
  }

  return {
    isValid: issues.length === 0,
    issues,
    validatedAngles: angles,
  };
}
