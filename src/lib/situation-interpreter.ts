/**
 * Compositional Situation Interpreter for Relationship Annoyances.
 *
 * Interprets user input into a structured, compositional model:
 * - Independent recognition of entities, behaviors, states, contexts, frequencies, contrasts
 * - Emotional sensitivity and humor suitability assessment
 * - Genuine contrast detection (seriousness vs silliness, silence vs noise, etc.)
 * - Ambiguity detection without unwarranted guesswork
 */

import {
  normalizeText,
  containsWholeWord,
  analyzeLinguisticStructure,
  type NormalizedInput,
} from "./semantic-normalizer.ts";
import { SEMANTIC_TOPICS, type SemanticTopic } from "./semantic-topics.ts";
import { classifyAnnoyance } from "./semantic-classifier.ts";

export type SituationType =
  | "object"
  | "behavior"
  | "interaction"
  | "routine"
  | "preference"
  | "state"
  | "ambiguous";

export type SensitivityLevel =
  | "light"
  | "interpersonal"
  | "boundary"
  | "serious"
  | "uncertain";

export type HumorSuitability =
  | "high"
  | "moderate"
  | "restricted"
  | "none";

export interface ContrastModel {
  expected: string;
  observed: string;
  type:
    | "seriousness_vs_silliness"
    | "silence_vs_noise"
    | "normal_volume_vs_loudness"
    | "attention_vs_distraction"
    | "readiness_vs_delay"
    | "order_vs_clutter"
    | "decision_vs_indecision"
    | "peace_vs_pressure"
    | "custom";
}

export interface InterpretedSituation {
  rawText: string;
  normalizedText: string;
  linguistic: NormalizedInput;
  family?: string;
  primaryTopic?: string;
  secondaryTopics: string[];
  situationType: SituationType;
  actor: string;
  target: string;
  entities: string[];
  behaviors: string[];
  action?: string;
  state?: string;
  context?: string;
  location?: string;
  timing?: string;
  frequency?: "once" | "sometimes" | "often" | "recurring";
  contrast?: ContrastModel;
  emotionalSignals: string[];
  sensitivity: SensitivityLevel;
  confidence: number;
  ambiguity: boolean;
  humorSuitability: HumorSuitability;
  matchedSignals: string[];
}

// -------------------------------------------------------------
// Known Patterns & Context Extractors
// -------------------------------------------------------------

interface ContextPattern {
  match: RegExp;
  label: string;
  expectedAtmosphere: string;
}

const CONTEXT_PATTERNS: ContextPattern[] = [
  {
    match: /\b(on the phone|during (a )?phone calls?|on a call|speaking on speaker|phone conversation)\b/i,
    label: "phone call",
    expectedAtmosphere: "private call volume",
  },
  {
    match: /\b(in serious situations?|during (a )?serious (conversation|discussion|moment)|discussing something important|important conversation|serious talk|serious debate)\b/i,
    label: "serious conversation",
    expectedAtmosphere: "seriousness and focus",
  },
  {
    match: /\b(during dinner|at dinner|eating dinner|at the table|during meals?|family dinner)\b/i,
    label: "dinner table",
    expectedAtmosphere: "shared attention and conversation",
  },
  {
    match: /\b(while (i am )?(working|studying|reading|concentrating)|trying to concentrate|trying to work)\b/i,
    label: "working or concentrating",
    expectedAtmosphere: "quiet and focus",
  },
  {
    match: /\b(in bed|at night|trying to sleep|sleeping|before sleep|bedtime)\b/i,
    label: "bedtime",
    expectedAtmosphere: "rest and quiet",
  },
  {
    match: /\b(leaving the house|getting ready|before leaving|heading out|going out)\b/i,
    label: "leaving the house",
    expectedAtmosphere: "prompt departure",
  },
  {
    match: /\b(during (the )?conversation|while (we are )?talking|in discussion|chatting|speaking)\b/i,
    label: "conversation",
    expectedAtmosphere: "mutual listening",
  },
];

interface BehaviorPattern {
  match: RegExp;
  label: string;
  family: string;
  topicId: string;
  observedAtmosphere?: string;
  sensitivity?: SensitivityLevel;
}

const BEHAVIOR_PATTERNS: BehaviorPattern[] = [
  // Noise in serious context or weird noise
  {
    match: /\b(weird noises?|strange noises?|funny noises?|random sounds?|odd noises?|making sounds?|makes noises?|making noises?)\b/i,
    label: "making unusual sounds",
    family: "noise_sensory",
    topicId: "bodily_habits_noise",
    observedAtmosphere: "unexpected sound effects",
    sensitivity: "light",
  },
  // Preparing tea or coffee
  {
    match: /\b(making tea|brewing tea|tea with|making coffee|brewing coffee|cup of tea|cup of coffee)\b/i,
    label: "making tea or coffee",
    family: "kitchen_food",
    topicId: "kitchen_tea_coffee",
    observedAtmosphere: "kitchen beverage preparation",
    sensitivity: "light",
  },
  // Washing dishes and utensils
  {
    match: /\b(wash(?:ing)? (?:the )?(?:big |large )?(?:utensils?|dishes|pots?|pans?)|avoiding (?:the )?(?:pots?|pans?|big utensils?)|leaving (?:the )?(?:big |large )?(?:utensils?|pots?|pans?)|dishes in sink|dirty pots)\b/i,
    label: "washing dishes or utensils",
    family: "household_upkeep",
    topicId: "dishes_sink_piled",
    observedAtmosphere: "sink and cookware dilemma",
    sensitivity: "light",
  },
  // Voice and conversational volume
  {
    match: /\b(conversational volume|volume increases?|voice increases?|voice getting loud(er)?|conversational decibel|decibel increases?|talk(s|ing)? (very |too )?loud(ly)?|raises? (his|her|their)? voice|shouting|booming voice)\b/i,
    label: "raising voice or volume",
    family: "communication",
    topicId: "communication_volume",
    observedAtmosphere: "stadium broadcast volume",
    sensitivity: "interpersonal",
  },
  // Mocking & teasing
  {
    match: /\b(mocking (everyone|other person|me|people)?|mocks me|making fun of|teasing goes too far|teases me|roasting me|poking fun|constant mocking|mocking all the time)\b/i,
    label: "mocking or teasing",
    family: "communication",
    topicId: "interpersonal_mocking",
    observedAtmosphere: "unplanned comedy roast",
    sensitivity: "interpersonal",
  },
  // Pushiness & boundary pressure
  {
    match: /\b(too pushy( to act)?|pressur(ing|es) me|insisting after i say no|pushes me to|wont take no for an answer|does not take no|forcing me to act|i do not want to|i dont want to|i said no|i am not comfortable|i asked (them|him|her) to stop|keep(s)? insisting|keep(s)? pushing after|wont stop when asked|refuses to stop|disrespect(ing)? my boundary)\b/i,
    label: "being pushy or pressuring",
    family: "boundaries",
    topicId: "boundary_pushiness",
    observedAtmosphere: "high-pressure campaign",
    sensitivity: "boundary",
  },
  // Bodily habits: snoring, burping, chewing
  {
    match: /\b(burping and snoring|snoring and burping|burp(s|ing)?|snor(es|ing)?|chewing loud(ly)?|chews loud(ly)?|tapping constantly|keeps humming)\b/i,
    label: "bodily noises",
    family: "noise_sensory",
    topicId: "bodily_habits_noise",
    observedAtmosphere: "live percussion section",
    sensitivity: "light",
  },
  // Interrupting & talking over
  {
    match: /\b(interrupt(s|ing)?|talking over|cuts? me off|leaves? conversations? halfway)\b/i,
    label: "interrupting",
    family: "communication",
    topicId: "communication_interrupting",
    observedAtmosphere: "talking at the same time",
    sensitivity: "interpersonal",
  },
  // Distracted listening & phone use
  {
    match: /\b(not listening|distracted|looking at phone|answers while looking at phone|scrolling on phone|phone during dinner|tuning out|looking at screen)\b/i,
    label: "phone distraction and tuned-out listening",
    family: "digital_habits",
    topicId: "phone_distraction_meals",
    observedAtmosphere: "digital absorption",
    sensitivity: "interpersonal",
  },
  // Routine: staying inside / reluctant to leave
  {
    match: /\b(not getting out of bed|always wants? to stay home|refuses? to leave|wont leave the house|staying inside)\b/i,
    label: "reluctance to leave or staying inside",
    family: "sleep_routines",
    topicId: "routine_leaving_stuck",
    observedAtmosphere: "cozy hibernation",
    sensitivity: "light",
  },
  // Delay & departure: taking forever
  {
    match: /\b(takes? forever|taking an hour|takes? so long|running late again|always rushing)\b/i,
    label: "taking long to get ready or leave",
    family: "time_punctuality",
    topicId: "running_late_ready",
    observedAtmosphere: "extended launch sequence",
    sensitivity: "light",
  },
  // Indecision: dinner / plans
  {
    match: /\b(never decides? where to eat|cant decide what to eat|keeps? changing plans|debating for an hour what takeaway)\b/i,
    label: "dinner or plans indecision",
    family: "kitchen_food",
    topicId: "dinner_decision_indecision",
    observedAtmosphere: "prolonged culinary summit",
    sensitivity: "light",
  },
];

// Physical entities
const KNOWN_ENTITIES = [
  "wardrobe",
  "drawers",
  "drawer",
  "dishwasher",
  "dishes",
  "plates",
  "mugs",
  "mug",
  "coffee mug",
  "socks",
  "towel",
  "towels",
  "bath towel",
  "charger",
  "charging cable",
  "phone charger",
  "keys",
  "car keys",
  "wallet",
  "shoes",
  "utensils",
  "utensil",
  "pots",
  "pot",
  "pans",
  "pan",
  "tea",
  "milk",
  "slippers",
  "flippers",
  "trainers",
  "thermostat",
  "heater",
  "ac",
  "air conditioner",
  "light",
  "bathroom light",
  "tv",
  "gps",
  "toilet roll",
  "cardboard",
  "boxes",
  "fridge",
  "bed",
  "sofa",
];

/**
 * Interprets relationship annoyance into a rich compositional model.
 */
export function interpretSituation(rawText: string): InterpretedSituation {
  const linguistic = analyzeLinguisticStructure(rawText);
  const normalized = linguistic.normalized;

  // If input is an ungrounded proposition (e.g. "yoga is not an exercise"), flag early
  const isProposition = Boolean(linguistic.proposition);

  // 1. Detect serious or unsafe situations (Level D - Zero humor allowed)
  const seriousUnsafeKeywords = [
    /\b(afraid of|terrified|scared of|feel scared|scared|threaten(ed|ing)?|physical(ly)? violent|violence|hit me|punched|slapped|choked|abusive|abuse|coerc(ed|ive|ion)|forcing me to give|locks me out|locked me out|sexual pressure|forced me sexually|stalking|destroyed (my )?(belongings|stuff|things)|fear for my safety|unsafe|in anger)\b/i,
  ];
  for (const pat of seriousUnsafeKeywords) {
    if (pat.test(normalized)) {
      return {
        rawText,
        normalizedText: normalized,
        linguistic,
        situationType: "behavior",
        actor: "partner",
        target: "user",
        entities: [],
        behaviors: ["serious safety concern"],
        emotionalSignals: ["fear", "coercion", "unsafe"],
        sensitivity: "serious",
        confidence: 1.0,
        ambiguity: false,
        humorSuitability: "none",
        matchedSignals: ["safety_boundary_triggered"],
        secondaryTopics: [],
      };
    }
  }

  // 2. Extract situational context
  let context: string | undefined = undefined;
  let expectedAtmosphere = "peace and balance";
  for (const cp of CONTEXT_PATTERNS) {
    if (cp.match.test(normalized)) {
      context = cp.label;
      expectedAtmosphere = cp.expectedAtmosphere;
      break;
    }
  }

  // 3. Extract behaviors
  const detectedBehaviors: string[] = [];
  const matchedSignals: string[] = [];
  let primaryTopic: string | undefined = undefined;
  let detectedFamily: string | undefined = undefined;
  let observedAtmosphere = "unexpected quirk";
  let sensitivity: SensitivityLevel = "light";
  const secondaryTopics: string[] = [];

  for (const bp of BEHAVIOR_PATTERNS) {
    if (bp.match.test(normalized)) {
      detectedBehaviors.push(bp.label);
      matchedSignals.push(bp.label);
      if (!primaryTopic) {
        primaryTopic = bp.topicId;
        detectedFamily = bp.family;
        observedAtmosphere = bp.observedAtmosphere || "unexpected quirk";
        if (bp.sensitivity) sensitivity = bp.sensitivity;
      } else if (!secondaryTopics.includes(bp.topicId)) {
        secondaryTopics.push(bp.topicId);
      }
    }
  }

  // 4. Extract physical entities
  let detectedEntities: string[] = [];
  const hasActToken = /\b(act|action|acting|actual)\b/i.test(normalized);
  if (!isProposition) {
    for (const ent of KNOWN_ENTITIES) {
      if (containsWholeWord(normalized, ent)) {
        if (ent === "ac" && hasActToken) continue;
        if (!detectedEntities.includes(ent)) {
          detectedEntities.push(ent);
          matchedSignals.push(ent);
        }
      }
    }
  }

  // 5. Detect frequency
  let frequency: "once" | "sometimes" | "often" | "recurring" = "once";
  if (/\b(all the time|always|constantly|every day|every time|forever)\b/i.test(normalized)) {
    frequency = "recurring";
  } else if (/\b(often|keeps|repeatedly)\b/i.test(normalized)) {
    frequency = "often";
  } else if (/\b(sometimes|occasionally)\b/i.test(normalized)) {
    frequency = "sometimes";
  }

  // 6. Detect physical states / conditions
  let state: string | undefined = undefined;
  if (/\b(half opened?|wide open|left open|open)\b/i.test(normalized)) state = "open";
  else if (/\b(empty|finished)\b/i.test(normalized)) state = "empty";
  else if (/\b(unwashed|dirty)\b/i.test(normalized)) state = "unwashed";
  else if (/\b(on the floor|crumpled)\b/i.test(normalized)) state = "on the floor";
  else if (/\b(too loud|blaring)\b/i.test(normalized)) state = "too loud";

  // 7. Check taxonomy classification & fallback
  const classification = isProposition ? { topic: null, matchedTerms: [], extractedSituation: null, confidence: 0 } : classifyAnnoyance(normalized);
  if (!primaryTopic && classification.topic) {
    primaryTopic = classification.topic.id;
    detectedFamily = classification.topic.family;
    if (classification.topic.sensitivity) {
      sensitivity = classification.topic.sensitivity;
    }
  }
  if (classification.matchedTerms.length > 0) {
    for (const term of classification.matchedTerms) {
      if (!matchedSignals.includes(term)) matchedSignals.push(term);
    }
  }
  if (!isProposition && classification.extractedSituation?.entity && classification.extractedSituation.entity !== "this small thing") {
    if (!detectedEntities.includes(classification.extractedSituation.entity)) {
      detectedEntities.push(classification.extractedSituation.entity);
    }
  }

  if (!primaryTopic && !isProposition) {
    for (const topic of SEMANTIC_TOPICS) {
      if (topic.phrases?.some((p) => normalized.includes(normalizeText(p)))) {
        primaryTopic = topic.id;
        detectedFamily = topic.family;
        if (topic.sensitivity) sensitivity = topic.sensitivity;
        matchedSignals.push(topic.id);
        break;
      }
      for (const ent of topic.entities) {
        if (ent === "ac" && hasActToken) continue;
        if (containsWholeWord(normalized, normalizeText(ent))) {
          if (!primaryTopic) {
            primaryTopic = topic.id;
            detectedFamily = topic.family;
            if (topic.sensitivity) sensitivity = topic.sensitivity;
            matchedSignals.push(ent);
          }
          break;
        }
      }
    }
  }

  // 8. Contrast Detection
  let contrast: ContrastModel | undefined = undefined;
  if (context === "phone call" && detectedBehaviors.includes("raising voice or volume")) {
    contrast = {
      expected: "indoor phone conversation",
      observed: "loudspeaker broadcast volume",
      type: "normal_volume_vs_loudness",
    };
  } else if (context === "serious conversation" && (detectedBehaviors.includes("making unusual sounds") || normalized.includes("noise") || normalized.includes("sound") || normalized.includes("face") || normalized.includes("joke"))) {
    contrast = {
      expected: "seriousness and solemn focus",
      observed: "unexpected sound effects or playfulness",
      type: "seriousness_vs_silliness",
    };
  } else if (detectedBehaviors.includes("raising voice or volume") || normalized.includes("decibel") || (context === "conversation" && normalized.includes("loud"))) {
    contrast = {
      expected: "indoor conversational tone",
      observed: "stadium broadcast volume",
      type: "normal_volume_vs_loudness",
    };
  } else if (detectedBehaviors.includes("bodily noises") || (normalized.includes("snoring") && normalized.includes("burping"))) {
    contrast = {
      expected: "peaceful bedroom silence",
      observed: "spontaneous acoustic symphony",
      type: "silence_vs_noise",
    };
  } else if (context === "dinner table" && (detectedBehaviors.includes("phone distraction and tuned-out listening") || normalized.includes("phone"))) {
    contrast = {
      expected: "shared dinner conversation",
      observed: "screen distraction",
      type: "attention_vs_distraction",
    };
  } else if (detectedBehaviors.includes("being pushy or pressuring")) {
    contrast = {
      expected: "moving at own pace with freedom to choose",
      observed: "urgent insistence and pressure",
      type: "peace_vs_pressure",
    };
  } else if (detectedEntities.includes("drawers") || detectedEntities.includes("wardrobe") || (detectedEntities.length > 0 && state === "open")) {
    contrast = {
      expected: "closed and tidy storage",
      observed: "open-door display",
      type: "order_vs_clutter",
    };
  } else if (detectedBehaviors.includes("taking long to get ready or leave")) {
    contrast = {
      expected: "timely departure",
      observed: "leisurely multi-stage launch ceremony",
      type: "readiness_vs_delay",
    };
  } else if (detectedBehaviors.includes("dinner or plans indecision")) {
    contrast = {
      expected: "a quick meal choice",
      observed: "philosophical culinary deliberation",
      type: "decision_vs_indecision",
    };
  }

  // 9. Boundary Sensitivity check
  if (sensitivity !== "serious") {
    const isRepeatedInsistenceOrRefusal = /\b(i (do not|dont) want|i said no|i asked (them|him|her) to stop|insist(ing|s)? after|keep(s)? pushing|wont take no|does not take no|wont stop when asked|refuses to stop|disrespect(ing)?)\b/i.test(normalized);
    const isRepeatedMocking = /\b(all the time|constantly|always|repeated(ly)?)\b/i.test(normalized) && (detectedBehaviors.includes("mocking or teasing") || /\bmock(ing)?\b/i.test(normalized));
    
    if (detectedBehaviors.includes("being pushy or pressuring") || isRepeatedInsistenceOrRefusal || isRepeatedMocking || /\b(pushy|pressuring|guilt trip)\b/i.test(normalized)) {
      sensitivity = "boundary";
    } else if (detectedBehaviors.includes("mocking or teasing") || detectedBehaviors.includes("raising voice or volume") || detectedBehaviors.includes("interrupting")) {
      sensitivity = "interpersonal";
    }
  }

  // 10. Ambiguity and Proposition Detection
  // Check if input is a statement/proposition without relational context (e.g. "yoga is not an exercise")
  const isExtremelyShort = normalized.split(" ").length <= 3;
  const isVagueActionOnly = /^(not getting out|getting out|out of it|stuff happens|things|it happens)$/i.test(normalized);
  const isAmbiguous = isVagueActionOnly || isProposition || (isExtremelyShort && detectedEntities.length === 0 && detectedBehaviors.length === 0 && !context);

  let situationType: SituationType = "behavior";
  if (isProposition) {
    situationType = "ambiguous";
    sensitivity = "uncertain";
    // Disallow treating proposition subject as physical entity
    detectedEntities = [];
  } else if (isAmbiguous) {
    situationType = "ambiguous";
    sensitivity = "uncertain";
  } else if (detectedEntities.length > 0 && detectedBehaviors.length === 0) {
    situationType = "object";
  } else if (detectedBehaviors.length > 0 && (linguistic.actor === "partner" || linguistic.target === "user")) {
    situationType = "interaction";
  } else if (state && detectedEntities.length > 0) {
    situationType = "state";
  }

  // 11. Humor Suitability
  let humorSuitability: HumorSuitability = "high";
  if (sensitivity === "serious") {
    humorSuitability = "none";
  } else if (sensitivity === "boundary") {
    humorSuitability = "restricted";
  } else if (sensitivity === "uncertain") {
    humorSuitability = "moderate";
  } else if (sensitivity === "interpersonal") {
    humorSuitability = "moderate";
  }

  // 12. Confidence calculation
  let confidence = 0.25;
  if (sensitivity === "serious") {
    confidence = 1.0;
  } else if (isAmbiguous) {
    confidence = 0.25;
  } else if (contrast && (detectedBehaviors.length > 0 || detectedEntities.length > 0)) {
    confidence = 0.90;
  } else if (detectedBehaviors.length > 0 && context) {
    confidence = 0.85;
  } else if (detectedBehaviors.length > 0 || primaryTopic) {
    confidence = 0.80;
  } else if (detectedEntities.length > 0 && state) {
    confidence = 0.75;
  } else if (detectedEntities.length > 0 || classification.confidence >= 0.35) {
    confidence = Math.max(0.65, classification.confidence);
  } else if (normalized.split(" ").length >= 4) {
    confidence = 0.55;
  }

  return {
    rawText,
    normalizedText: normalized,
    linguistic,
    family: detectedFamily,
    primaryTopic,
    secondaryTopics,
    situationType,
    actor: linguistic.actor,
    target: linguistic.target,
    entities: detectedEntities,
    behaviors: detectedBehaviors,
    action: detectedBehaviors[0],
    state,
    context,
    timing: context,
    frequency,
    contrast,
    emotionalSignals: [],
    sensitivity,
    confidence,
    ambiguity: isAmbiguous,
    humorSuitability,
    matchedSignals,
  };
}
