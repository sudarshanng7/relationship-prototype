/**
 * Linguistic Normalization Layer for Semantic Interpretation.
 *
 * Provides:
 * - Case, punctuation, and whitespace normalization
 * - Contraction expansion (can't -> cannot, doesn't -> does not)
 * - Spelling variant and typo normalization
 * - Compound word normalization (dish washer -> dishwasher)
 * - Strict token boundaries (prevents 'act' from matching 'ac', 'carpet' from 'car')
 * - Verb inflection and gerund stemming (mock/mocks/mocking, interrupt/interrupts/interrupting)
 * - Negation and direction detection (leaves on vs turns off vs forgets to turn off)
 * - Relational pronoun and actor-target detection
 */

export interface NormalizedInput {
  raw: string;
  normalized: string;
  tokens: string[];
  hasNegation: boolean;
  negatedPhrases: string[];
  actor: "partner" | "both" | "self" | "environment" | "unknown";
  target: "user" | "partner" | "both" | "environment" | "unknown";
  quantityModifier?: {
    type: "negligible" | "excessive" | "insufficient" | "none";
    target?: string;
  };
  proposition?: {
    subject: string;
    predicate: string;
    isNegated: boolean;
  };
}

const CONTRACTIONS: Record<string, string> = {
  "can't": "cannot",
  "won't": "will not",
  "don't": "do not",
  "doesn't": "does not",
  "didn't": "did not",
  "isn't": "is not",
  "aren't": "are not",
  "wasn't": "was not",
  "weren't": "were not",
  "haven't": "have not",
  "hasn't": "has not",
  "hadn't": "had not",
  "couldn't": "could not",
  "shouldn't": "should not",
  "wouldn't": "would not",
  "i'm": "i am",
  "you're": "you are",
  "we're": "we are",
  "they're": "they are",
  "he's": "he is",
  "she's": "she is",
  "it's": "it is",
  "that's": "that is",
  "what's": "what is",
};

const COMMON_MISSPELLINGS: Record<string, string> = {
  seperate: "separate",
  definately: "definitely",
  decibals: "decibels",
  decibal: "decibel",
  interupt: "interrupt",
  interupting: "interrupting",
  dishes: "dishes",
  unwash: "unwashed",
  snooz: "snooze",
  snoozing: "snoozing",
};

/**
 * Normalizes text for similarity and semantic interpretation.
 */
export function normalizeText(raw: string): string {
  let text = raw.toLowerCase().trim();

  // Expand contractions
  for (const [contraction, expansion] of Object.entries(CONTRACTIONS)) {
    const regex = new RegExp(`\\b${contraction.replace("'", "['’]")}\\b`, "gi");
    text = text.replace(regex, expansion);
  }

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
    .replace(/\bfront\s*door\b/g, "front door")
    .replace(/\bair\s*con(ditioner)?\b/g, "ac")
    .replace(/\bbath\s*room\b/g, "bathroom")
    .replace(/\bliving\s*room\b/g, "living room")
    .replace(/\bbed\s*room\b/g, "bedroom")
    .replace(/\bnight\s*stand\b/g, "bedside table")
    .replace(/\bout\s*door\s*voice\b/g, "outdoor voice");

  // Fix known misspellings
  for (const [wrong, right] of Object.entries(COMMON_MISSPELLINGS)) {
    const reg = new RegExp(`\\b${wrong}\\b`, "gi");
    text = text.replace(reg, right);
  }

  // Strip punctuation except hyphens inside words
  text = text.replace(/[^a-z0-9\s-]/g, " ");

  // Collapse multiple spaces
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

/**
 * Checks for whole-word presence with strict boundaries.
 * Prevents 'act' matching 'ac', 'carpet' matching 'car', etc.
 */
export function containsWholeWord(text: string, word: string): boolean {
  const trimmedWord = word.trim().toLowerCase();
  if (!trimmedWord) return false;
  const escaped = trimmedWord.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const regex = new RegExp(`(^|\\s)${escaped}(\\s|$)`, "i");
  return regex.test(text);
}

/**
 * Checks if word matches a target stem or plural/singular variant.
 */
export function matchesStem(word: string, target: string): boolean {
  if (word === target) return true;
  // Simple plural check
  if (word.endsWith("s") && word.slice(0, -1) === target) return true;
  if (target.endsWith("s") && target.slice(0, -1) === word) return true;
  if (word.endsWith("es") && word.slice(0, -2) === target) return true;
  if (target.endsWith("es") && target.slice(0, -2) === word) return true;
  if (word.endsWith("ing") && word.slice(0, -3) === target) return true;
  if (target.endsWith("ing") && target.slice(0, -3) === word) return true;
  if (word.endsWith("ed") && word.slice(0, -2) === target) return true;
  if (target.endsWith("ed") && target.slice(0, -2) === word) return true;
  return false;
}

/**
 * Analyzes linguistic structure, negation, actors, and targets.
 */
export function analyzeLinguisticStructure(raw: string): NormalizedInput {
  const normalized = normalizeText(raw);
  const tokens = normalized.split(" ").filter((t) => t.length > 0);

  // Negation detection
  const negationRegex = /\b(not|never|no|cannot|will not|does not|did not|without|refuses to|stop)\b/i;
  const hasNegation = negationRegex.test(normalized);
  const negatedPhrases: string[] = [];
  if (hasNegation) {
    const parts = normalized.split(/\b(not|never|no|cannot|will not|does not|did not|without)\b/i);
    for (let i = 1; i < parts.length; i += 2) {
      if (parts[i + 1]) {
        negatedPhrases.push(parts[i + 1].trim().split(" ").slice(0, 3).join(" "));
      }
    }
  }

  // Actor detection
  let actor: "partner" | "both" | "self" | "environment" | "unknown" = "unknown";
  if (/\b(he|she|his|her|partner|they|them|you|husband|wife|boyfriend|girlfriend)\b/i.test(normalized)) {
    actor = "partner";
  } else if (/\b(we|us|our|both)\b/i.test(normalized)) {
    actor = "both";
  } else if (/\b(i|my|myself)\b/i.test(normalized) && !/\b(he|she|you|partner)\b/i.test(normalized)) {
    actor = "self";
  } else if (/\b(room|house|sink|dishwasher|fridge|kitchen|bed)\b/i.test(normalized)) {
    actor = "environment";
  }

  // Target detection
  let target: "user" | "partner" | "both" | "environment" | "unknown" = "unknown";
  if (/\b(at me|to me|with me|interrupts me|mocks me|mocking me|pushes me|talking to me|about me|me|my|myself)\b/i.test(normalized)) {
    target = "user";
  } else if (/\b(at him|at her|to him|to her|at you|mocking everyone|other person)\b/i.test(normalized)) {
    target = "partner";
  } else if (/\b(us|our|each other)\b/i.test(normalized)) {
    target = "both";
  } else if (/\b(house|room|sink|floor|table)\b/i.test(normalized)) {
    target = "environment";
  }

  // Quantity and proportion modifiers
  let quantityModifier: NormalizedInput["quantityModifier"] = undefined;
  if (/\b(namesake|in name only|just a drop of|barely any|hardly any|tiny amount of|trace of)\s+([a-z]+)/i.test(normalized)) {
    const match = normalized.match(/\b(?:namesake|in name only|just a drop of|barely any|hardly any|tiny amount of|trace of)\s+([a-z]+)/i);
    quantityModifier = {
      type: "negligible",
      target: match ? match[1] : undefined,
    };
  } else if (/\b(too much|excessive|drowning in)\s+([a-z]+)/i.test(normalized)) {
    const match = normalized.match(/\b(?:too much|excessive|drowning in)\s+([a-z]+)/i);
    quantityModifier = {
      type: "excessive",
      target: match ? match[1] : undefined,
    };
  } else if (/\b(too little|not enough)\s+([a-z]+)/i.test(normalized)) {
    const match = normalized.match(/\b(?:too little|not enough)\s+([a-z]+)/i);
    quantityModifier = {
      type: "insufficient",
      target: match ? match[1] : undefined,
    };
  }

  // Proposition detection: "X is (not) Y", "X does not count as Y", "yoga is not an exercise"
  // Strictly matches statements of conceptual opinion/classification: e.g. "X is not an exercise", "X is not a real sport"
  // Does NOT match passive physical states of appliances/objects like "dishwasher is not started", "light is not turned off"
  let proposition: NormalizedInput["proposition"] = undefined;
  const propMatch = normalized.match(/^([a-z]+(?:\s+[a-z]+){0,2})\s+(is not|isnt|does not count as|is never)\s+(a |an )?([a-z]+(?:\s+[a-z]+){0,2})$/i);
  if (propMatch) {
    const subj = propMatch[1].trim();
    const copula = propMatch[2].trim();
    const article = propMatch[3] ? propMatch[3].trim() : "";
    const pred = propMatch[4].trim();
    const isNeg = /\b(not|isnt|never)\b/i.test(copula);
    // Ignore physical states/actions such as started, finished, broken, washed, closed, opened, clean, dirty
    const isPhysicalState = /\b(started|finished|broken|washed|closed|opened|clean|dirty|left|turned|running|plugged|unplugged)\b/i.test(pred);
    if (!/^(he|she|they|it|i|we|you|there|this|that)$/i.test(subj) && !isPhysicalState) {
      proposition = {
        subject: subj,
        predicate: article ? `${article} ${pred}` : pred,
        isNegated: isNeg,
      };
    }
  }

  return {
    raw,
    normalized,
    tokens,
    hasNegation,
    negatedPhrases,
    actor,
    target,
    quantityModifier,
    proposition,
  };
}
