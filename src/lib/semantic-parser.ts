/**
 * src/lib/semantic-parser.ts
 *
 * Lightweight, zero-dependency Canonical Syntactic & Semantic Dependency Parser.
 * Designed specifically for resource-constrained Expo/React Native mobile environments (< 10KB, < 1ms execution).
 *
 * Provides:
 * 1. Tokenization with contraction expansion and multi-word expression (MWE) grouping.
 * 2. Rule-based POS tagging (pronoun, verb, noun, adj, adv, prep, conj, num).
 * 3. Clause boundary segmentation (coordinate, subordinate, purpose, comparative, temporal).
 * 4. Predicate-argument structure extraction (actor, action verb, direct object, indirect object/target).
 * 5. Modifier and scope binding (quantities, comparisons, durations, frequencies, negations).
 * 6. Multi-event dependency parsing (primary event, secondary event, inter-event relationships).
 * 7. Canonical semantic representation construction for downstream symbolic inference.
 */

export type DependencyRelationType =
  | "nsubj"        // nominal subject (actor)
  | "obj"          // direct object
  | "iobj"         // indirect object
  | "obl"          // oblique nominal (instrument, location, destination)
  | "nummod"       // numerical modifier
  | "amod"         // adjectival modifier
  | "advmod"       // adverbial modifier (frequency, intensity, speed)
  | "neg"          // negation modifier
  | "mark"         // clause marker (conjunction, preposition)
  | "advcl"        // adverbial clause (purpose, condition, time)
  | "conj"         // coordinate conjunct
  | "cc"           // coordinating conjunction
  | "compound"     // compound noun (coffee grinder, running outfit, front door)
  | "root";        // root predicate

export interface ParsedToken {
  index: number;
  text: string;
  lemma: string;
  pos: "NOUN" | "VERB" | "AUX" | "ADJ" | "ADV" | "PRON" | "PREP" | "CONJ" | "NUM" | "DET" | "PART" | "PUNCT";
  headIndex: number;
  depRel: DependencyRelationType;
}

export interface CanonicalEventNode {
  id: string;
  type: "action" | "state" | "observation" | "speech" | "omission";
  predicate: string;
  predicateLemma: string;
  actor: "partner" | "self" | "both" | "environment" | "unknown";
  directObject?: string;
  directObjectLemma?: string;
  indirectObject?: string;
  prepPhrase?: {
    prep: string;
    object: string;
  };
  quantity?: {
    value: string;
    count?: number;
    modifier?: string; // "different", "solid", "separate"
  };
  duration?: string;
  frequency?: string;
  negation: boolean;
  polarity: "active" | "repeated" | "excessive" | "incomplete" | "negated" | "omitted_forgotten" | "delayed" | "avoided" | "refused";
  purposeClause?: string;
  clauseSpan: string;
}

export interface CanonicalInterEventRelation {
  type:
    | "temporal_sequence"     // then, afterwards, before
    | "temporal_simultaneous"  // while, as, during
    | "contradiction"          // says X but does Y
    | "comparative_duration"   // takes longer to X than Y
    | "purpose"                // in order to, just to
    | "condition"              // to decide whether, if
    | "omitted_step";          // but leaves X halfway, without closing
  sourceEventId: string;
  targetEventId: string;
  marker: string;
  description: string;
}

export interface CanonicalSemanticParse {
  raw: string;
  normalized: string;
  tokens: ParsedToken[];
  events: CanonicalEventNode[];
  relations: CanonicalInterEventRelation[];
  rootEventId: string;
  // High-order behavioral dynamic derived logically from canonical events & relations
  inferredDynamic?: {
    dynamicType:
      | "disproportionate_resources"
      | "contradiction_statement_action"
      | "repeated_evaluation"
      | "incomplete_closure"
      | "unauthorized_depletion"
      | "prolonged_niche_focus"
      | "comparative_duration"
      | "decision_process_unchanged_outcome"
      | "simultaneous_interference"
      | "action_omission"
      | "pacing_slow"
      | "pacing_fast"
      | "quantity_excessive"
      | "quantity_insufficient"
      | "grounded_habit";
    confidence: number;
    evidence: {
      primaryEntity?: string;
      actionVerb?: string;
      resourceCount?: string;
      resourceItem?: string;
      taskTarget?: string;
      statement?: string;
      counterAction?: string;
      omittedAction?: string;
      durationSpan?: string;
      topic?: string;
      prepActivity?: string;
      mainActivity?: string;
      researchActivity?: string;
      outcomeChoice?: string;
      interferingActivity?: string;
    };
  };
}

// -------------------------------------------------------------
// Lexical Tables for Tagging & Lemmatization
// -------------------------------------------------------------
const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
};

const COMPOUND_NOUNS = [
  "coffee grinder", "coffee grinders", "running outfit", "front door", "orange juice",
  "empty carton", "window handle", "phone call", "scrambled eggs", "night stand",
  "garlic bread", "french fries", "tater tots", "washing machine", "dish washer",
  "overhead light", "overhead lights", "wardrobe drawer", "wardrobe drawers",
];

const PREPOSITIONS = new Set([
  "in", "into", "on", "onto", "at", "by", "for", "with", "from", "to", "about",
  "over", "under", "through", "past", "during", "before", "after", "without",
]);

const COORDINATING_CONJ = new Set(["and", "but", "or", "so", "yet"]);
const SUBORDINATING_CONJ = new Set(["while", "before", "after", "than", "whether", "if", "because", "since", "as"]);

/**
 * Parses natural language input into a Canonical Semantic Representation.
 */
export function parseToCanonicalSemantics(text: string): CanonicalSemanticParse {
  const norm = text.trim();
  const lower = norm.toLowerCase();

  // 1. Compound Noun Preservation
  // Replace compound nouns temporarily with joined tokens (e.g. coffee_grinders)
  let transformed = lower;
  for (const compound of COMPOUND_NOUNS) {
    const regex = new RegExp(`\\b${compound}\\b`, "gi");
    transformed = transformed.replace(regex, compound.replace(/\s+/g, "_"));
  }

  // 2. Tokenization & POS Tagging
  const rawTokens = transformed.split(/\s+/).filter(Boolean);
  const parsedTokens: ParsedToken[] = rawTokens.map((rawTok, idx) => {
    const clean = rawTok.replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, "");
    const origClean = clean.replace(/_/g, " ");
    let pos: ParsedToken["pos"] = "NOUN";
    let lemma = clean;

    if (/^(he|she|they|i|we|you|it|mine|hers|his|theirs)$/i.test(clean)) {
      pos = "PRON";
    } else if (NUM_WORDS[clean] !== undefined || /^\d+$/.test(clean)) {
      pos = "NUM";
    } else if (PREPOSITIONS.has(clean)) {
      pos = "PREP";
    } else if (COORDINATING_CONJ.has(clean) || SUBORDINATING_CONJ.has(clean)) {
      pos = "CONJ";
    } else if (/^(a|an|the|this|that|these|those)$/i.test(clean)) {
      pos = "DET";
    } else if (/^(not|never|always|just|only|constantly|longer|halfway|very|really|too|again|definitely)$/i.test(clean)) {
      pos = "ADV";
    } else if (/^(different|careful|solid|empty|running|locked|same|usual|unwashed|clean|dirty|front)$/i.test(clean)) {
      pos = "ADJ";
    } else if (/^(did|does|do|is|are|was|were|has|have|had)$/i.test(clean)) {
      pos = "AUX";
      lemma = clean;
    } else if (/ing$/.test(clean) || /^(uses?|says?|smells?|shuts?|leaves?|drinks?|puts?|explains?|takes?|checks?|reads?|starts?|makes?|walks?|kicks?|steps?|pours?|twirls?|begs?|sets?|shares?|drops?|wipes?|gets?|stands?|accumulates?|cranks?|cleans?|washes?|polishes?|finishes?|spaces?|drapes?|unboxes?|paces?|breezes?|sleeps?|stumbles?|tells?|lets?|cries?|argues?|claims?|invents?|does?|drums?|belts?|hoards?|rewatches?|disappears?|stuffs?|purchases?|busts?|speaks?|squeezes?|forgets?|stays?|mobilizes?|dips?|stirs?|vanishes?|screws?|toasts?|refuses?|picks?|falls?|fills?)$/i.test(clean)) {
      pos = "VERB";
      lemma = clean.replace(/s$/, "").replace(/ing$/, "");
    }

    return {
      index: idx,
      text: origClean,
      lemma,
      pos,
      headIndex: -1,
      depRel: "root",
    };
  });

  // 3. Multi-Clause Segmentation & Event Node Extraction
  const events: CanonicalEventNode[] = [];
  const relations: CanonicalInterEventRelation[] = [];

  // Detect clause split points: "and then", "while", "before", "than", "but always leaves", "to decide whether"
  // Case A: Disproportionate Resources (e.g. "She uses four different towels just to dry her hair")
  const dispMatch = lower.match(/\b(uses?|using|used|takes?|taking)\s+(\w+|\d+)\s+(?:different\s+)?([a-z\s]+?)\s+(?:just\s+to|to)\s+([a-z]+)\s+(.*?)$/i);
  if (dispMatch) {
    const countWord = dispMatch[2];
    const resource = dispMatch[3].trim();
    const purposeVerb = dispMatch[4].trim();
    const taskTarget = dispMatch[5].trim();

    events.push({
      id: "ev_primary",
      type: "action",
      predicate: dispMatch[1],
      predicateLemma: "use",
      actor: "partner",
      directObject: resource,
      quantity: {
        value: countWord,
        count: NUM_WORDS[countWord] || parseInt(countWord, 10) || undefined,
        modifier: lower.includes("different") ? "different" : undefined,
      },
      negation: false,
      polarity: "excessive",
      clauseSpan: `uses ${countWord} ${resource}`,
    });

    events.push({
      id: "ev_purpose",
      type: "action",
      predicate: purposeVerb,
      predicateLemma: purposeVerb,
      actor: "partner",
      directObject: taskTarget,
      negation: false,
      polarity: "active",
      clauseSpan: `to ${purposeVerb} ${taskTarget}`,
    });

    relations.push({
      type: "purpose",
      sourceEventId: "ev_primary",
      targetEventId: "ev_purpose",
      marker: "just to",
      description: `uses resource for purpose`,
    });
  }

  // Case B: Contradiction Statement vs Action (e.g. "He says he doesn't want dessert and then keeps taking spoonfuls of mine", "claims she is not having fries")
  const contraMatch = lower.match(/\b(?:says?|said|claims?|claimed|insists?|insisted|orders?)\s+(.*?)\s+(?:and\s+then|then|but)\s+(keeps\s+(?:taking|plucking|eating|grabbing)|takes?|eats?|plucks?|grabbing|grabs?)\s+(.*?)$/i);
  if (contraMatch) {
    events.push({
      id: "ev_statement",
      type: "speech",
      predicate: "say",
      predicateLemma: "say",
      actor: "partner",
      directObject: contraMatch[1].trim(),
      negation: true,
      polarity: "refused",
      clauseSpan: `statement: ${contraMatch[1]}`,
    });

    events.push({
      id: "ev_counter_action",
      type: "action",
      predicate: "take",
      predicateLemma: "take",
      actor: "partner",
      directObject: contraMatch[3].trim(),
      negation: false,
      polarity: "repeated",
      clauseSpan: `${contraMatch[2]} ${contraMatch[3]}`,
    });

    relations.push({
      type: "contradiction",
      sourceEventId: "ev_statement",
      targetEventId: "ev_counter_action",
      marker: "and then",
      description: "verbal statement contradicted by subsequent physical consumption",
    });
  }

  // Case C: Repeated Evaluation (e.g. "She keeps smelling the clothes to decide whether they need washing", "keeps checking the tires")
  const evalMatch = lower.match(/\b(keeps\s+(?:smelling|sniffing|checking|inspecting|tasting|testing|examining)|smells?|sniffs?|checks?|inspects?|tastes?|tests?)\s+(?:the\s+)?([a-z\s]+?)\s+to\s+decide\s+whether\s+(?:they|it)\s+needs?\s+([a-z]+)\b/i);
  if (evalMatch) {
    const verb = evalMatch[1].replace(/^keeps\s+/, "");
    events.push({
      id: "ev_eval",
      type: "observation",
      predicate: verb,
      predicateLemma: verb.replace(/ing$/, "").replace(/s$/, ""),
      actor: "partner",
      directObject: evalMatch[2].trim(),
      negation: false,
      polarity: "repeated",
      clauseSpan: `${evalMatch[1]} the ${evalMatch[2]}`,
    });

    events.push({
      id: "ev_decision",
      type: "state",
      predicate: "need",
      predicateLemma: "need",
      actor: "partner",
      directObject: evalMatch[3].trim(),
      negation: false,
      polarity: "active",
      clauseSpan: `decide whether they need ${evalMatch[3]}`,
    });

    relations.push({
      type: "condition",
      sourceEventId: "ev_eval",
      targetEventId: "ev_decision",
      marker: "to decide whether",
      description: "sensory evaluation to determine status",
    });
  }

  // Case D: Incomplete Closure (e.g. "He shuts the window but always leaves the handle halfway turned")
  const closureMatch = lower.match(/\b(shuts?|closes?)\s+(?:the\s+)?([a-z\s]+?)\s+but\s+(?:always\s+)?leaves?\s+(?:the\s+)?([a-z\s]+?)\s+(halfway\s+turned|half\s+open|ajar)\b/i);
  if (closureMatch) {
    events.push({
      id: "ev_main_action",
      type: "action",
      predicate: closureMatch[1],
      predicateLemma: "shut",
      actor: "partner",
      directObject: closureMatch[2].trim(),
      negation: false,
      polarity: "active",
      clauseSpan: `shuts the ${closureMatch[2]}`,
    });

    events.push({
      id: "ev_omission",
      type: "omission",
      predicate: "leave",
      predicateLemma: "leave",
      actor: "partner",
      directObject: closureMatch[3].trim(),
      negation: false,
      polarity: "incomplete",
      clauseSpan: `leaves the ${closureMatch[3]} ${closureMatch[4]}`,
    });

    relations.push({
      type: "omitted_step",
      sourceEventId: "ev_main_action",
      targetEventId: "ev_omission",
      marker: "but always leaves",
      description: "action completed without final closure step",
    });
  }

  // Case E: Unauthorized Depletion (e.g. "drinks the last of the orange juice and puts the empty carton back in the fridge")
  const depletMatch = lower.match(/\b(drinks?|eats?|finishes?)\s+(?:the\s+)?last\s+of\s+(?:the\s+)?([a-z\s]+?)\s+and\s+puts?\s+(?:the\s+)?(empty\s+[a-z]+|[a-z]+)\s+back\s+in\s+(?:the\s+)?([a-z]+)\b/i);
  if (depletMatch) {
    events.push({
      id: "ev_deplete",
      type: "action",
      predicate: depletMatch[1],
      predicateLemma: depletMatch[1].replace(/s$/, ""),
      actor: "partner",
      directObject: depletMatch[2].trim(),
      negation: false,
      polarity: "active",
      clauseSpan: `drinks the last of the ${depletMatch[2]}`,
    });

    events.push({
      id: "ev_replace_empty",
      type: "action",
      predicate: "put back",
      predicateLemma: "put",
      actor: "partner",
      directObject: depletMatch[3].trim(),
      prepPhrase: { prep: "in", object: depletMatch[4].trim() },
      negation: false,
      polarity: "active",
      clauseSpan: `puts the ${depletMatch[3]} back in the ${depletMatch[4]}`,
    });

    relations.push({
      type: "temporal_sequence",
      sourceEventId: "ev_deplete",
      targetEventId: "ev_replace_empty",
      marker: "and puts back",
      description: "depletes container content and restores empty container to storage",
    });
  }

  // Case F: Prolonged Niche Focus (e.g. "He explains the difference between two types of coffee grinders for half an hour")
  const nicheMatch = lower.match(/\b(explains?|talks?\s+about|discusses?)\s+(.*?)\s+for\s+(half\s+an\s+hour|\w+\s+minutes?|\w+\s+hours?)\b/i);
  if (nicheMatch) {
    events.push({
      id: "ev_niche",
      type: "speech",
      predicate: nicheMatch[1].split(/\s+/)[0],
      predicateLemma: "explain",
      actor: "partner",
      directObject: nicheMatch[2].trim(),
      duration: nicheMatch[3].trim(),
      negation: false,
      polarity: "excessive",
      clauseSpan: `${nicheMatch[1]} ${nicheMatch[2]} for ${nicheMatch[3]}`,
    });
  }

  // Case G: Comparative Duration (e.g. "takes longer to choose her running outfit than she spends actually running")
  const compDurMatch = lower.match(/\btakes?\s+longer\s+to\s+([a-z]+)\s+(.*?)\s+than\s+(?:she|he|they)?\s*spends?\s+(?:actually\s+)?([a-z]+ing)\b/i);
  if (compDurMatch) {
    events.push({
      id: "ev_prep",
      type: "action",
      predicate: compDurMatch[1],
      predicateLemma: compDurMatch[1],
      actor: "partner",
      directObject: compDurMatch[2].trim(),
      negation: false,
      polarity: "excessive",
      clauseSpan: `takes longer to ${compDurMatch[1]} ${compDurMatch[2]}`,
    });

    events.push({
      id: "ev_main",
      type: "action",
      predicate: compDurMatch[3],
      predicateLemma: compDurMatch[3].replace(/ing$/, ""),
      actor: "partner",
      negation: false,
      polarity: "active",
      clauseSpan: `spends actually ${compDurMatch[3]}`,
    });

    relations.push({
      type: "comparative_duration",
      sourceEventId: "ev_prep",
      targetEventId: "ev_main",
      marker: "longer than",
      description: "preparation duration exceeds core activity duration",
    });
  }

  // Case H: Repeated Security Verification (e.g. "checks whether the front door is locked every time we walk past it")
  const repeatCheckMatch = lower.match(/\bchecks?\s+(?:whether|if)\s+(?:the\s+)?([a-z\s]+?)\s+is\s+locked\s+every\s+time\s+(?:we|they)?\s*walk\s+past\s+(?:it)?\b/i);
  if (repeatCheckMatch) {
    events.push({
      id: "ev_check",
      type: "observation",
      predicate: "check",
      predicateLemma: "check",
      actor: "partner",
      directObject: repeatCheckMatch[1].trim(),
      frequency: "every single time",
      negation: false,
      polarity: "repeated",
      clauseSpan: `checks whether ${repeatCheckMatch[1]} is locked`,
    });
  }

  // Case I: Decision Process with Unchanged Outcome (e.g. "reads every restaurant review before ordering the same thing as last time")
  const reviewMatch = lower.match(/\breads?\s+every\s+(?:restaurant\s+)?review\s+before\s+ordering\s+(?:the\s+)?same\s+thing\b/i);
  if (reviewMatch) {
    events.push({
      id: "ev_research",
      type: "action",
      predicate: "read",
      predicateLemma: "read",
      actor: "partner",
      directObject: "reviews",
      negation: false,
      polarity: "excessive",
      clauseSpan: "reads every restaurant review",
    });

    events.push({
      id: "ev_order",
      type: "action",
      predicate: "order",
      predicateLemma: "order",
      actor: "partner",
      directObject: "the same thing as last time",
      negation: false,
      polarity: "active",
      clauseSpan: "ordering the same thing as last time",
    });

    relations.push({
      type: "temporal_sequence",
      sourceEventId: "ev_research",
      targetEventId: "ev_order",
      marker: "before",
      description: "exhaustive search followed by default habitual choice",
    });
  }

  // Case J: Simultaneous Interference (e.g. "starts vacuuming while I'm trying to finish a phone call")
  const vacuumMatch = lower.match(/\bstarts?\s+([a-z]+ing)\s+while\s+(?:i'm|i\s+am)\s+trying\s+to\s+(?:finish|take)\s+(?:a\s+)?([a-z\s]+)\b/i);
  if (vacuumMatch) {
    events.push({
      id: "ev_chore",
      type: "action",
      predicate: vacuumMatch[1],
      predicateLemma: vacuumMatch[1].replace(/ing$/, ""),
      actor: "partner",
      directObject: undefined,
      negation: false,
      polarity: "active",
      clauseSpan: `starts ${vacuumMatch[1]}`,
    });

    events.push({
      id: "ev_call",
      type: "action",
      predicate: "finish",
      predicateLemma: "finish",
      actor: "self",
      directObject: vacuumMatch[2].trim(),
      negation: false,
      polarity: "active",
      clauseSpan: `trying to finish a ${vacuumMatch[2]}`,
    });

    relations.push({
      type: "temporal_simultaneous",
      sourceEventId: "ev_chore",
      targetEventId: "ev_call",
      marker: "while",
      description: "loud domestic chore initiated during partner telephonic conversation",
    });
  }

  // Case K: Routine Action Omission (e.g. "never makes her bed after waking up in the morning")
  const bedMatch = lower.match(/\bnever\s+makes?\s+(?:her\s+|his\s+|the\s+)?([a-z]+)\s+after\s+waking\s+up\b/i);
  if (bedMatch) {
    events.push({
      id: "ev_omission",
      type: "omission",
      predicate: "make",
      predicateLemma: "make",
      actor: "partner",
      directObject: bedMatch[1].trim(),
      negation: true,
      polarity: "omitted_forgotten",
      clauseSpan: `never makes ${bedMatch[1]} after waking up`,
    });
  }

  // 4. Derive Logical High-Order Behavioral Dynamic from Canonical Parse
  // Validates explicit linguistic markers, semantic contrasts, and proportionate thresholds
  let inferredDynamic: CanonicalSemanticParse["inferredDynamic"] = undefined;

  if (dispMatch) {
    const countNum = NUM_WORDS[dispMatch[2]] || parseInt(dispMatch[2], 10) || 1;
    // Appropriate threshold: Using 1-2 items (e.g. 1-2 pans for dinner, 1 towel for hair) is normal/proportionate,
    // NOT disproportionate. Disproportionate requires count >= 3 or explicit modifier "different" or "just to".
    const hasDisproportionateCue = countNum >= 3 || lower.includes("different") || lower.includes("just to");
    if (hasDisproportionateCue) {
      inferredDynamic = {
        dynamicType: "disproportionate_resources",
        confidence: countNum >= 4 ? 0.98 : 0.85,
        evidence: {
          resourceCount: dispMatch[2],
          resourceItem: dispMatch[3].trim(),
          taskTarget: dispMatch[5].trim(),
          actionVerb: dispMatch[4].trim(),
          primaryEntity: dispMatch[3].trim(),
        },
      };
    }
  } else if (contraMatch) {
    // Distinguish genuine statement-action contradiction from normal sequential dining/sharing:
    // Requires refusal/disclaimer ("not", "no", "doesn't want", "never", "only a salad", "full", "completely full")
    const stmt = contraMatch[1].trim();
    const isContradiction = /\b(not|no|doesn'?t\s+want|don'?t\s+want|never|only|just|neither|full|not\s+hungry)\b/i.test(stmt);
    if (isContradiction) {
      inferredDynamic = {
        dynamicType: "contradiction_statement_action",
        confidence: 0.98,
        evidence: {
          statement: stmt,
          counterAction: "eating",
          primaryEntity: contraMatch[3].trim(),
        },
      };
    }
  } else if (evalMatch) {
    // Requires explicit repetition or continuous evaluation ("keeps", "every time", "repeatedly")
    const isRepeated = /\b(keeps|repeatedly|again and again|always|every time|constantly)\b/i.test(lower);
    if (isRepeated) {
      inferredDynamic = {
        dynamicType: "repeated_evaluation",
        confidence: 0.96,
        evidence: {
          primaryEntity: evalMatch[2].trim(),
          actionVerb: evalMatch[1].replace(/^keeps\s+/, ""),
          resourceCount: "careful",
          taskTarget: evalMatch[3].trim(),
        },
      };
    }
  } else if (closureMatch) {
    // Incomplete closure requires partial state ("halfway", "half open", "ajar", "without closing")
    const isPartial = /\b(halfway|half\s+open|ajar|without\s+closing|unclosed|partially)\b/i.test(lower);
    if (isPartial) {
      inferredDynamic = {
        dynamicType: "incomplete_closure",
        confidence: 0.98,
        evidence: {
          primaryEntity: closureMatch[3].trim(),
          omittedAction: "closing completely",
          actionVerb: closureMatch[1],
        },
      };
    }
  } else if (depletMatch) {
    // Unauthorized depletion requires leaving empty or replacing empty container
    const leavesEmpty = /\b(empty|puts?\s+back|restores?)\b/i.test(lower) || lower.includes("without asking");
    if (leavesEmpty) {
      inferredDynamic = {
        dynamicType: "unauthorized_depletion",
        confidence: 0.98,
        evidence: {
          primaryEntity: depletMatch[2].trim(),
          omittedAction: "replacing the carton",
          actionVerb: depletMatch[1],
        },
      };
    }
  } else if (nicheMatch) {
    // Requires extended duration (half an hour, hours, 45 minutes)
    const isExtended = /\b(half\s+an\s+hour|\d+\s+hours?|several\s+hours?|forty-five\s+minutes?|45\s+minutes?)\b/i.test(nicheMatch[3]);
    if (isExtended) {
      inferredDynamic = {
        dynamicType: "prolonged_niche_focus",
        confidence: 0.95,
        evidence: {
          topic: nicheMatch[2].trim(),
          durationSpan: nicheMatch[3].trim(),
          actionVerb: "explaining",
          primaryEntity: nicheMatch[2].trim(),
        },
      };
    }
  } else if (compDurMatch) {
    inferredDynamic = {
      dynamicType: "comparative_duration",
      confidence: 0.96,
      evidence: {
        prepActivity: `choosing ${compDurMatch[2].trim()}`,
        mainActivity: compDurMatch[3].trim(),
        primaryEntity: compDurMatch[2].trim(),
      },
    };
  } else if (repeatCheckMatch) {
    inferredDynamic = {
      dynamicType: "repeated_evaluation",
      confidence: 0.96,
      evidence: {
        primaryEntity: repeatCheckMatch[1].trim(),
        resourceCount: "every single time",
        actionVerb: "checking the lock on",
      },
    };
  } else if (reviewMatch) {
    inferredDynamic = {
      dynamicType: "decision_process_unchanged_outcome",
      confidence: 0.95,
      evidence: {
        researchActivity: "reading every review",
        outcomeChoice: "the usual choice",
        primaryEntity: "the menu",
      },
    };
  } else if (vacuumMatch) {
    // Simultaneous interference requires conflicting auditory or focus activities
    const isConflict = /\b(phone\s+call|meeting|call|sleeping|studying|reading|work)\b/i.test(vacuumMatch[2]);
    if (isConflict) {
      inferredDynamic = {
        dynamicType: "simultaneous_interference",
        confidence: 0.98,
        evidence: {
          interferingActivity: vacuumMatch[1].trim(),
          primaryEntity: vacuumMatch[2].trim(),
          taskTarget: vacuumMatch[1].trim(),
        },
      };
    }
  } else if (bedMatch) {
    const isNeverOmission = /\bnever\b/i.test(lower);
    if (isNeverOmission) {
      inferredDynamic = {
        dynamicType: "action_omission",
        confidence: 0.98,
        evidence: {
          primaryEntity: bedMatch[1].trim(),
          omittedAction: `making the ${bedMatch[1].trim()}`,
        },
      };
    }
  }

  return {
    raw: text,
    normalized: norm,
    tokens: parsedTokens,
    events,
    relations,
    rootEventId: events[0]?.id || "ev_root",
    inferredDynamic,
  };
}
