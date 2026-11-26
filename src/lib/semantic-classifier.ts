/**
 * Semantic Topic Classifier for Relationship Annoyances.
 *
 * Provides:
 * - Similarity normalization (compound splitting, plural handling, typo variants)
 * - Structured SituationModel extraction (entities, behaviors, states, frequency, relationalTarget, sensitivity)
 * - Anti-signal and token exclusion handling (e.g. 'act' never triggers 'ac')
 * - Behavior-first prioritization for interpersonal dynamics
 * - Weighted confidence scoring (phrase: 0.45, behavior: 0.40, entity: 0.35, action: 0.20, synonym: 0.15, location: 0.10, hints: 0.10)
 * - Ambiguity handling (routes to universal fallback if top two unrelated topics are close)
 * - Multi-behavior combination within same family
 * - Privacy-safe MVP learning metadata (no raw text)
 */

import { SEMANTIC_TOPICS, type SemanticTopic } from "./semantic-topics.ts";

export type SituationFrequency = "once" | "sometimes" | "often" | "recurring";
export type RelationalTarget = "partner" | "both" | "environment" | "unknown";
export type SituationSensitivity = "light" | "interpersonal" | "boundary";
export type SituationType = "object" | "behavior" | "interaction" | "state";

export interface SituationModel {
  family: string;
  topic: string;
  entity?: string;
  behavior?: string;
  action?: string;
  location?: string;
  frequency?: SituationFrequency;
  relationalTarget?: RelationalTarget;
  sensitivity?: SituationSensitivity;
  situationType?: SituationType;
  confidence: number;
  matchedSignals: string[];
}

export interface ExtractedSituation {
  entity: string;
  action: string;
  location: string;
  frequencyCue: string | null;
  relationalSubject: string | null;
  rawObjectPhrase: string;
  behavior?: string;
  frequency?: SituationFrequency;
  relationalTarget?: RelationalTarget;
  sensitivity?: SituationSensitivity;
  situationType?: SituationType;
}

export interface ClassificationResult {
  topic: SemanticTopic | null;
  family: string;
  topicId: string;
  confidence: number;
  isUnknown: boolean;
  matchedTerms: string[];
  extractedSituation: ExtractedSituation;
  situationModel: SituationModel;
}

export interface ReframeMetadata {
  semantic_family: string;
  semantic_topic: string;
  confidence: number;
  generation_source: "provider" | "local_semantic" | "universal_fallback";
  unknown_topic: boolean;
  matched_count: number;
}

/**
 * Normalizes text for similarity matching:
 * - lowercase
 * - punctuation to spaces
 * - handles compound variants (dish washer -> dishwasher)
 * - handles common UK/US and plural variations
 */
export function normalizeText(raw: string): string {
  let text = raw.toLowerCase();

  // Normalize common compound words
  text = text
    .replace(/\bdish\s*washer\b/g, "dishwasher")
    .replace(/\bflip\s*flops?\b/g, "flippers")
    .replace(/\btooth\s*paste\b/g, "toothpaste")
    .replace(/\bcard\s*board\b/g, "cardboard")
    .replace(/\btoilet\s*paper\b/g, "toilet roll")
    .replace(/\btoilet\s*roll\b/g, "toilet roll")
    .replace(/\bpower\s*cord\b/g, "charger")
    .replace(/\bcharging\s*cable\b/g, "charger")
    .replace(/\bphone\s*charger\b/g, "charger")
    .replace(/\bbalcony\s*door\b/g, "balcony door")
    .replace(/\bair\s*con(ditioner)?\b/g, "ac")
    .replace(/\bfront\s*door\b/g, "door")
    .replace(/\bbath\s*room\b/g, "bathroom")
    .replace(/\bliving\s*room\b/g, "living room")
    .replace(/\bbed\s*room\b/g, "bedroom");

  // Remove punctuation
  text = text.replace(/[^a-z0-9\s-]/g, " ");

  // Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

/**
 * Checks whole-word presence in normalized text.
 */
export function containsWholeWord(text: string, word: string): boolean {
  const regex = new RegExp(`(^|\\s)${word.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}(\\s|$)`, "i");
  return regex.test(text);
}

/**
 * Checks for word stem or singular/plural equivalence.
 */
function matchesStem(word: string, target: string): boolean {
  if (word === target) return true;
  // Simple plural check (s, es)
  if (word.endsWith("s") && word.slice(0, -1) === target) return true;
  if (target.endsWith("s") && target.slice(0, -1) === word) return true;
  if (word.endsWith("es") && word.slice(0, -2) === target) return true;
  if (target.endsWith("es") && target.slice(0, -2) === word) return true;
  return false;
}

/**
 * Extracts situation components from normalized and raw text without preserving blame.
 */
export function extractSituation(rawText: string): ExtractedSituation {
  const normalized = normalizeText(rawText);

  // 1. Detect frequency
  let frequencyCue: string | null = null;
  let frequency: SituationFrequency = "once";
  const freqKeywords = [
    { pattern: /\b(all the time|always|constantly|every day|every time|forever)\b/i, cue: "all the time", type: "recurring" as SituationFrequency },
    { pattern: /\b(often|keeps|repeatedly)\b/i, cue: "often", type: "often" as SituationFrequency },
    { pattern: /\b(sometimes|occasionally)\b/i, cue: "sometimes", type: "sometimes" as SituationFrequency },
  ];
  for (const f of freqKeywords) {
    if (f.pattern.test(normalized)) {
      frequencyCue = f.cue;
      frequency = f.type;
      break;
    }
  }

  // 2. Detect relational context
  let relationalSubject: string | null = null;
  let relationalTarget: RelationalTarget = "unknown";
  if (/\b(other person|partner|he|she|him|her)\b/i.test(normalized)) {
    relationalSubject = "partner";
    relationalTarget = "partner";
  } else if (/\b(we|us|our|both)\b/i.test(normalized)) {
    relationalSubject = "we";
    relationalTarget = "both";
  } else if (/\b(they|them)\b/i.test(normalized)) {
    relationalSubject = "they";
    relationalTarget = "partner";
  } else if (/\b(room|house|kitchen|bathroom|sink|bed|living room|hallway)\b/i.test(normalized)) {
    relationalTarget = "environment";
  }

  // 3. Detect locations
  const knownLocations = [
    "kitchen",
    "sink",
    "counter",
    "bathroom",
    "shower",
    "bedroom",
    "bed",
    "living room",
    "hallway",
    "sofa",
    "couch",
    "table",
    "fridge",
    "refrigerator",
    "balcony",
    "car",
    "floor",
    "door",
  ];
  let location = "around the house";
  for (const loc of knownLocations) {
    if (containsWholeWord(normalized, loc)) {
      location = loc;
      break;
    }
  }

  // 4. Detect behavior signals
  let behavior: string | undefined = undefined;
  const behaviorKeywords = [
    { match: /\b(mocking|mocks|teasing|teases|making fun|poking fun|roasting)\b/i, label: "mocking" },
    { match: /\b(pushy|pressuring|insisting|insists|forces|forcing|pushing to act|unwanted persuasion)\b/i, label: "pushiness" },
    { match: /\b(interrupting|interrupts|talking over|cutting off|leaves conversations halfway)\b/i, label: "interrupting" },
    { match: /\b(decibel|decibels|conversational volume|volume increases|getting louder|raises voice|shouting|yelling)\b/i, label: "conversational volume" },
    { match: /\b(snoring|snores|burping|burps|chewing loudly|chews loudly|tapping constantly|keeps humming)\b/i, label: "bodily noises" },
    { match: /\b(not getting out|staying home|staying inside|refusing to leave|won't leave)\b/i, label: "staying inside" },
    { match: /\b(not listening|distracted|tuning out|ignores|ignoring)\b/i, label: "distracted listening" },
  ];
  for (const b of behaviorKeywords) {
    if (b.match.test(normalized)) {
      behavior = b.label;
      break;
    }
  }

  // 5. Entity extraction: strict whole-token matching
  const hasActToken = /\b(act|action|acting|actual)\b/i.test(normalized);
  const commonEntities = [
    "hoverboard",
    "ukulele",
    "mystery artifact",
    "dishwasher",
    "dishes",
    "plates",
    "mugs",
    "mug",
    "pan",
    "pots",
    "clothes",
    "laundry",
    "socks",
    "towels",
    "towel",
    "slippers",
    "flippers",
    "shoes",
    "trainers",
    "boots",
    "light",
    "lamp",
    "balcony door",
    "heater",
    "ac",
    "thermostat",
    "charger",
    "cable",
    "keys",
    "wallet",
    "glasses",
    "bottles",
    "bottle",
    "carton",
    "boxes",
    "box",
    "packaging",
    "packages",
    "toilet roll",
    "groceries",
    "dinner",
    "alarm",
    "phone",
    "screen",
    "plants",
    "plant",
    "cat",
    "dog",
    "car",
    "gps",
    "tv",
  ];

  let entity = "this small thing";
  for (const ent of commonEntities) {
    if (containsWholeWord(normalized, ent)) {
      // Exclude AC when act/action/acting/actual is present
      if (ent === "ac" && hasActToken) {
        continue;
      }
      entity = ent;
      break;
    }
  }

  // Fallback entity extraction if no concrete noun matched and no behavior was detected
  if (entity === "this small thing" && !behavior) {
    let cleaned = rawText
      .replace(/\b(you always|you never|you did|you didn't|he always|she always|they always|my partner)\b/gi, "")
      .replace(/^(the|a|an|my|our|their|his|her)\s+/i, "")
      .replace(/\s+(is|are|was|were|has|have|gets|got)\s+.*$/i, "")
      .replace(/[.,!?;:]+$/, "")
      .trim();

    // Check if cleaned string looks like an action/gerund rather than a noun
    const isActionPhrase = /^(not\s+|never\s+|to\s+|always\s+|getting\s+|doing\s+|saying\s+|making\s+)/i.test(cleaned);
    if (!isActionPhrase && cleaned.length >= 2) {
      const parts = cleaned.split(/\s+/).slice(0, 3).join(" ");
      if (parts.length >= 2 && parts.length <= 35) {
        entity = parts;
      }
    }
  }

  // 6. Actions
  let action = "is taking a moment";
  const actionMatchers = [
    { match: "left open", label: "stays open" },
    { match: "not started", label: "waits to start" },
    { match: "not emptied", label: "rests full" },
    { match: "on the floor", label: "rests on the floor" },
    { match: "in the sink", label: "waits in the sink" },
    { match: "on the bed", label: "rests on the bed" },
    { match: "running late", label: "takes an unhurried pace" },
    { match: "snoozing", label: "enjoys five more minutes" },
    { match: "empty", label: "is finished" },
    { match: "migrating", label: "goes exploring" },
    { match: "lost", label: "plays hide-and-seek" },
    { match: "loud", label: "speaks brightly" },
    { match: "open", label: "remains open" },
    { match: "left", label: "rests comfortably" },
  ];

  for (const a of actionMatchers) {
    if (containsWholeWord(normalized, a.match) || normalized.includes(a.match)) {
      action = a.label;
      break;
    }
  }

  // 7. Sensitivity and Situation Type
  let sensitivity: SituationSensitivity = "light";
  if (behavior === "pushiness" || /\b(pushy|pressuring|insisting|unwanted)\b/i.test(normalized)) {
    sensitivity = "boundary";
  } else if (
    behavior === "mocking" ||
    behavior === "interrupting" ||
    behavior === "conversational volume" ||
    behavior === "distracted listening" ||
    relationalTarget === "partner"
  ) {
    sensitivity = "interpersonal";
  }

  let situationType: SituationType = "object";
  if (behavior === "pushiness") {
    situationType = "interaction";
  } else if (behavior) {
    situationType = relationalTarget === "partner" || relationalTarget === "both" ? "interaction" : "behavior";
  } else if (entity === "this small thing") {
    situationType = "state";
  }

  return {
    entity,
    action,
    location,
    frequencyCue,
    relationalSubject,
    rawObjectPhrase: entity,
    behavior,
    frequency,
    relationalTarget,
    sensitivity,
    situationType,
  };
}

/**
 * Classifies an annoyance text against the semantic taxonomy.
 */
export function classifyAnnoyance(text: string): ClassificationResult {
  const normalized = normalizeText(text);
  const situation = extractSituation(text);
  const inputWords = normalized.split(" ").filter((w) => w.length > 2);

  // Anti-signal check: If input has "act", "action", etc., do NOT match AC
  const hasActToken = /\b(act|action|acting|actual)\b/i.test(normalized);

  let bestTopic: SemanticTopic | null = null;
  let highestScore = 0;
  let bestMatchedTerms: string[] = [];

  let runnerUpTopic: SemanticTopic | null = null;
  let runnerUpScore = 0;

  for (const topic of SEMANTIC_TOPICS) {
    // Check topic-level token exclusions
    if (topic.excludeWhenTokens) {
      const hasExcludedToken = topic.excludeWhenTokens.some((tok) =>
        containsWholeWord(normalized, tok)
      );
      if (hasExcludedToken) {
        continue;
      }
    }

    let score = 0;
    const matchedTerms: string[] = [];

    // 1. Exact phrase matches (Weight: 0.45)
    if (topic.phrases) {
      for (const phrase of topic.phrases) {
        const normPhrase = normalizeText(phrase);
        if (normalized.includes(normPhrase)) {
          score += 0.45;
          matchedTerms.push(phrase);
          break;
        }
      }
    }

    // 2. Behaviors (Weight: 0.40) - behavior-first priority
    if (topic.behaviors) {
      for (const b of topic.behaviors) {
        const normB = normalizeText(b);
        if (containsWholeWord(normalized, normB) || normalized.includes(normB)) {
          score += 0.40;
          matchedTerms.push(b);
          break;
        }
      }
    }

    // 3. Entity matches (Weight: 0.35) - requires whole-word boundary
    let entityMatched = false;
    for (const entity of topic.entities) {
      const normEntity = normalizeText(entity);
      if (normEntity === "ac" && hasActToken) {
        continue;
      }
      if (containsWholeWord(normalized, normEntity)) {
        score += 0.35;
        matchedTerms.push(entity);
        entityMatched = true;
        break;
      }
      for (const word of inputWords) {
        if (matchesStem(word, normEntity)) {
          score += 0.30;
          matchedTerms.push(entity);
          entityMatched = true;
          break;
        }
      }
      if (entityMatched) break;
    }

    // 4. Synonym matches (Weight: 0.15) - requires whole-word boundary
    for (const syn of topic.synonyms) {
      const normSyn = normalizeText(syn);
      if (normSyn === "ac" && hasActToken) continue;
      if (containsWholeWord(normalized, normSyn)) {
        score += 0.15;
        matchedTerms.push(syn);
        break;
      }
    }

    // 5. Action matches (Weight: 0.20)
    for (const act of topic.actions) {
      const normAct = normalizeText(act);
      if (containsWholeWord(normalized, normAct) || normalized.includes(normAct)) {
        score += 0.20;
        matchedTerms.push(act);
        break;
      }
    }

    // 6. Location matches (Weight: 0.10)
    if (topic.locations) {
      for (const loc of topic.locations) {
        const normLoc = normalizeText(loc);
        if (containsWholeWord(normalized, normLoc)) {
          score += 0.10;
          matchedTerms.push(loc);
          break;
        }
      }
    }

    // 7. Semantic hints / keywords (Weight: 0.10)
    if (topic.semanticHints) {
      for (const hint of topic.semanticHints) {
        if (containsWholeWord(normalized, normalizeText(hint))) {
          score += 0.10;
          matchedTerms.push(hint);
          break;
        }
      }
    }

    // Behavior-first boost: if input has explicit behavior matching this topic
    if (situation.behavior && topic.behaviors) {
      if (
        topic.behaviors.some(
          (tb) =>
            normalizeText(tb).includes(situation.behavior!) ||
            situation.behavior!.includes(normalizeText(tb))
        )
      ) {
        score += 0.20;
      }
    }

    if (score > highestScore) {
      runnerUpScore = highestScore;
      runnerUpTopic = bestTopic;
      highestScore = score;
      bestTopic = topic;
      bestMatchedTerms = matchedTerms;
    } else if (score > runnerUpScore) {
      runnerUpScore = score;
      runnerUpTopic = topic;
    }
  }

  // Confidence calculation
  let confidence = Math.min(Math.round(highestScore * 100) / 100, 1.0);

  // Confidence calibration: Incidental single-word match check (LS48)
  if (
    bestMatchedTerms.length === 1 &&
    !bestTopic?.phrases?.some((p) => normalizeText(p) === normalizeText(bestMatchedTerms[0])) &&
    !bestTopic?.behaviors?.some((b) => normalizeText(b) === normalizeText(bestMatchedTerms[0]))
  ) {
    if (!situation.behavior && situation.action === "is taking a moment") {
      confidence = Math.min(confidence, 0.30);
    }
  }

  // Ambiguity handling (LS43):
  // If runner-up has a close score from a DIFFERENT family and margin is < 0.05
  let isAmbiguous = false;
  if (
    bestTopic &&
    runnerUpTopic &&
    bestTopic.family !== runnerUpTopic.family &&
    confidence < 0.50 &&
    highestScore - runnerUpScore < 0.05
  ) {
    isAmbiguous = true;
  }

  const isUnknown = confidence < 0.35 || bestTopic === null || isAmbiguous;

  const finalSensitivity = bestTopic?.sensitivity ?? situation.sensitivity ?? "light";

  const situationModel: SituationModel = {
    family: bestTopic ? bestTopic.family : (situation.relationalTarget === "partner" ? "communication" : "unknown_household"),
    topic: bestTopic ? bestTopic.id : "unknown",
    entity: situation.entity !== "this small thing" ? situation.entity : undefined,
    behavior: situation.behavior,
    action: situation.action !== "is taking a moment" ? situation.action : undefined,
    location: situation.location !== "around the house" ? situation.location : undefined,
    frequency: situation.frequency,
    relationalTarget: situation.relationalTarget,
    sensitivity: finalSensitivity,
    situationType: situation.situationType,
    confidence,
    matchedSignals: bestMatchedTerms,
  };

  return {
    topic: isUnknown ? null : bestTopic,
    family: bestTopic ? bestTopic.family : "unknown_household",
    topicId: bestTopic ? bestTopic.id : "unknown",
    confidence,
    isUnknown,
    matchedTerms: bestMatchedTerms,
    extractedSituation: situation,
    situationModel,
  };
}

/**
 * Creates privacy-safe metadata for learning/analytics (never stores raw text).
 */
export function buildPrivacySafeMetadata(
  classification: ClassificationResult,
  source: "provider" | "local_semantic" | "universal_fallback" = "local_semantic"
): ReframeMetadata {
  return {
    semantic_family: classification.family,
    semantic_topic: classification.topicId,
    confidence: classification.confidence,
    generation_source: source,
    unknown_topic: classification.isUnknown,
    matched_count: classification.matchedTerms.length,
  };
}
