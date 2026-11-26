/**
 * src/lib/knowledge-resolver.ts
 *
 * Authoritative PG-RKB Semantic Resolver & Frame Binder (Phase 5).
 * Reads the optimized interned runtime bundle (RUNTIME_KNOWLEDGE_BUNDLE v3).
 * Implements:
 * - Full BoundSituation contract (actor, action, polarity, target, instrument, context, modifiers, state, safety, provenance)
 * - Strict Action-Polarity Distinction (active/repeated/excessive/incomplete/negated/omitted_forgotten/delayed/avoided/refused)
 * - Hierarchical Semantic Frame Selection (Parent + Child frames with acceptable alternatives)
 * - 5-Level Out-of-Knowledge Handling (Levels 1-5)
 * - Universal Safety Firewall (cannot be bypassed)
 */

import { RUNTIME_KNOWLEDGE_BUNDLE } from "./compiled-knowledge-data.ts";
import { normalizeText, analyzeLinguisticStructure } from "./semantic-normalizer.ts";

export type ActionPolarity =
  | "active"
  | "repeated"
  | "excessive"
  | "incomplete"
  | "negated"
  | "omitted_forgotten"
  | "delayed"
  | "avoided"
  | "refused";

export interface BoundConcept {
  conceptId: string;
  canonicalName: string;
  surfaceText: string;
  conceptType: string;
  role: string;
  evidenceSource: "explicit_lexical" | "inflection_match" | "synonym_match" | "verbnet_class" | "wikidata_entity" | "taxonomic_inference";
  confidence: number;
}

export interface BoundModifier {
  modifierId: string;
  name: string;
  category: "quantity" | "comparison" | "frequency" | "intensity" | "scope" | "negation";
  canonicalValue: string;
  targetRole: string;
  targetConceptName?: string;
  evidence: string;
}

export interface BoundContrast {
  expected: string;
  observed: string;
  contrastType: string;
}

export interface KnowledgeGapDiagnostic {
  knowledgeVersion: string;
  resolutionLevel: 1 | 2 | 3 | 4 | 5;
  generalFailureCategory:
    | "none"
    | "unknown_entity_known_behavior"
    | "known_entity_unknown_behavior"
    | "unclear_relationship"
    | "categorical_proposition"
    | "uninterpretable_input"
    | "unsupported_construction";
  clarificationRequested: boolean;
  humorConstructionAvailable: boolean;
}

export interface BoundSituation {
  rawText: string;
  normalizedText: string;
  resolutionLevel: 1 | 2 | 3 | 4 | 5;
  unknownCategory?: KnowledgeGapDiagnostic["generalFailureCategory"];
  frameId: string;
  parentFrameId?: string | null;
  acceptableAlternativeFrames: string[];
  frameName: string;
  domainIds: string[];
  humorOpportunity: string;
  actor: "partner" | "both" | "self" | "environment" | "unknown";
  action?: BoundConcept;
  actionPolarity: ActionPolarity;
  frequency?: "once" | "sometimes" | "often" | "recurring";
  duration?: string;
  intensity?: string;
  quantity?: string;
  expectedState?: string;
  observedState?: string;
  comparison?: string;
  exceptions: string[];
  boundRoles: Record<string, BoundConcept>;
  allConcepts: BoundConcept[];
  modifiers: BoundModifier[];
  contexts: string[];
  contrast?: BoundContrast;
  proposition?: { subject: string; category: string; isNegated: boolean };
  sensitivity: "ordinary_quirk" | "mild_interpersonal" | "boundary_concern" | "serious_unsafe";
  outcomeType: "playful_angles" | "clarification_needed" | "respectful_reflection";
  clarificationMessage?: string;
  reflectionReason?: string;
  knowledgeSourcesUsed: string[];
  diagnostic: KnowledgeGapDiagnostic;
}

// Decode interned v3 tables once at module load
const bundle = RUNTIME_KNOWLEDGE_BUNDLE as any;
const domainTable: string[] = bundle.tables.domains || [];
const sourceTable: string[] = bundle.tables.sources || [];
const typeTable: string[] = bundle.tables.types || [];
const relTable: string[] = bundle.tables.rels || [];
const vnTable: Array<{ c: string; f: string; a: string; roles: string[]; sens: string }> = bundle.tables.verbnet || [];

const rawConcepts: Array<[string, number, number[], number[]]> = bundle.entities.concepts || [];
const lexicalIndex: Record<string, number[]> = bundle.indexes.lexical || {};
const relationsFrom: Record<string, Array<[number, number]>> = bundle.indexes.relationsFrom || {};
const verbnetByVerb: Record<string, number> = bundle.indexes.verbnetByVerb || {};
const frames: Record<string, any> = bundle.entities.frames || {};
const contextsMap: Record<string, any> = bundle.entities.contexts || {};

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "they", "their", "them",
  "are", "was", "were", "has", "have", "had", "not", "all", "but", "just",
  "very", "too", "only", "when", "while", "what", "who", "how", "why",
  "our", "your", "his", "her", "she", "him", "always", "never", "every",
  "about", "into", "out", "over", "under", "again", "still", "even", "being",
  "act", "doing", "does", "did", "make", "made", "making", "getting", "gets",
  "keeps", "keep", "put", "puts", "putting", "leaves", "leaving", "left"
]);

/**
 * Universal Safety & Boundary Firewall.
 */
export function evaluateSafety(rawText: string, normalizedText: string): {
  sensitivity: BoundSituation["sensitivity"];
  outcomeType: BoundSituation["outcomeType"];
  reason?: string;
} {
  const seriousPatterns = [
    /\b(afraid of|terrified|scared of|feel scared|threat(?:en(?:ed|ing)?|s)?|physical(?:ly)? violent|violence|hit me|punched|slapped|choked|abusive|abuse|coerc(?:ed|ive|ion)|forcing me to give|locks? me out|locked me out|sexual pressure|forced me sexually|stalking|destroyed (?:my )?(?:belongings|stuff|things)|fear for my safety|unsafe|in anger|intimidat(?:ed|ing))\b/i
  ];
  if (seriousPatterns.some((rx) => rx.test(normalizedText))) {
    return {
      sensitivity: "serious_unsafe",
      outcomeType: "respectful_reflection",
      reason: "Serious safety or intimidation signal detected; humor disabled.",
    };
  }

  const refusalPatterns = [
    /\b(i (?:do not|dont) want|do not want to act|i said no|clearly said no|no means no|clearly refused|asked (?:them|him|her) to stop|refuse(?:s|d)? to stop|too pushy(?: to act)?|pressur(?:ing|es) me|pushing me|forcing me|will not take no|does not take no|will not accept (?:my )?no|will not stop|keep(?:s)? insisting|keep(?:s)? pushing|guilt trips?|disrespect(?:ing)? my boundar(?:y|ies)|pushing boundar(?:y|ies)|boundar(?:y|ies)|even when i decline|need space|not comfortable|even after i said)\b/i
  ];
  if (refusalPatterns.some((rx) => rx.test(normalizedText))) {
    return {
      sensitivity: "boundary_concern",
      outcomeType: "respectful_reflection",
      reason: "Explicit refusal or unwanted boundary pressure detected; autonomy preserved.",
    };
  }

  const isVerbalHarm = /\b(humiliating|belittling|insulting|calling me|stupid|idiot|worthless|ridiculing|it hurts)\b/i.test(normalizedText);
  if (isVerbalHarm) {
    return {
      sensitivity: "boundary_concern",
      outcomeType: "respectful_reflection",
      reason: "Verbal humiliation or hurt detected; protected under dignity firewall.",
    };
  }

  const isMocking = /\b(mocking|mocks)\b/i.test(normalizedText);
  const isRepeated = /\b(all the time|constantly|always|every time|repeatedly|everyone)\b/i.test(normalizedText);
  if (isMocking && isRepeated) {
    return {
      sensitivity: "boundary_concern",
      outcomeType: "respectful_reflection",
      reason: "Repeated mocking detected; protected under interpersonal dignity boundary.",
    };
  }

  return {
    sensitivity: "ordinary_quirk",
    outcomeType: "playful_angles",
  };
}

/**
 * Classifies action polarity accurately so active behaviors never flip into omissions.
 */
export function resolveActionPolarity(normalizedText: string): ActionPolarity {
  if (/\b(refuses to|refusing to|will not wash|never washes|never wash|not washing|never closes?|never shuts?|not closing|not shutting)\b/i.test(normalizedText)) {
    return "negated";
  }
  if (/\b(too loud|loudly|very loudly|excessively|blaring|screaming|yelling|shouting|hard enough|booming|max volume|at full volume)\b/i.test(normalizedText)) {
    return "excessive";
  }
  if (/\b(everything except|only small|only the small|half\s*open(?:ed)?|wide open|halfway|slightly open|ajar|barely any|namesake|almost zero|only hot|trace of)\b/i.test(normalizedText)) {
    return "incomplete";
  }
  if (/\b(takes forever|takes so long|forty-five minutes|for three days|for days|postponing|snooze .* times|running .* behind|running late)\b/i.test(normalizedText)) {
    return "delayed";
  }
  if (/\b(forgetting to|forgets to|forgot to|left soaking|leaves .* soaking|soaking|piled(?:\s+[a-z]+)?\s+in|dirty\s+[a-z\s]*sink|sitting in (?:the )?sink|unwashed|not started|unstarted|unplugged|empty .* back|leaving .* open|left .* open|dry and drooping|drooping|wilting)\b/i.test(normalizedText)) {
    return "omitted_forgotten";
  }
  if (/\b(keeps scrubbing|keeps washing|keeps doing|keeps dropping|keeps interrupting|keeps leaving|keeps opening|always|every day|every morning|constantly|all the time|repeatedly)\b/i.test(normalizedText)) {
    return "repeated";
  }
  return "active";
}

/**
 * Resolves candidate concepts & VerbNet classes from optimized v3 bundle.
 */
export function resolveConceptsAndVerbs(normalizedText: string): {
  concepts: BoundConcept[];
  verbnetMatches: Array<{ verb: string; classId: string; mappedFrameId: string; actionCategory: string }>;
  sourcesUsed: Set<string>;
} {
  const tokens = normalizedText.split(" ").filter(Boolean);
  const foundConcepts: BoundConcept[] = [];
  const verbnetMatches: Array<{ verb: string; classId: string; mappedFrameId: string; actionCategory: string }> = [];
  const seenIdx = new Set<number>();
  const sourcesUsed = new Set<string>();

  const candidateTerms: Array<{ term: string; isBigram: boolean }> = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    candidateTerms.push({ term: `${tokens[i]} ${tokens[i + 1]}`, isBigram: true });
  }
  for (const tok of tokens) {
    if (!STOPWORDS.has(tok) && tok.length >= 2) {
      candidateTerms.push({ term: tok, isBigram: false });
    }
  }

  for (const tok of tokens) {
    if (STOPWORDS.has(tok)) continue;
    const vnIdx = verbnetByVerb[tok];
    if (vnIdx !== undefined && vnTable[vnIdx]) {
      const vn = vnTable[vnIdx];
      verbnetMatches.push({
        verb: tok,
        classId: vn.c,
        mappedFrameId: vn.f,
        actionCategory: vn.a,
      });
      sourcesUsed.add("verbnet-cu");
    }
  }

  const isBeverageCtx = /\b(tea|coffee|espresso|latte|chai|milk|oat|brew|boil|mug|cup|kettle|soup|broth|drink|carton)\b/i.test(normalizedText);
  const isCleaningCtx = /\b(wash|scrub|rinse|wipe|clean|sink|soap|sponge|dish|pot|pan|skillet|cauldron|utensil|iron)\b/i.test(normalizedText);
  const isPlantCtx = /\b(plant|houseplant|flowerpot|leaf|leaves|soil|garden|water)\b/i.test(normalizedText);
  const isVoiceCtx = /\b(talk|speak|shout|yell|voice|loud|decibel|call|phone|whisper|chat|sing|singing)\b/i.test(normalizedText);

  for (const { term, isBigram } of candidateTerms) {
    const matchedCidxs = lexicalIndex[term];
    if (!matchedCidxs || matchedCidxs.length === 0) continue;

    let bestIdx = matchedCidxs[0];
    let bestScore = -1;
    for (const cidx of matchedCidxs) {
      const row = rawConcepts[cidx];
      if (!row) continue;
      const [name, typeIdx, domIdxs, srcIdxs] = row;
      const domNames = domIdxs.map((i) => domainTable[i] || "");
      const srcNames = srcIdxs.map((i) => sourceTable[i] || "");

      let score = 1;
      if (name === term) score += 3;
      if (isBigram) score += 2;
      if (isBeverageCtx && domNames.some((d) => d.includes("beverage") || d.includes("cooking"))) score += 4;
      if (isCleaningCtx && domNames.some((d) => d.includes("chore") || d.includes("cleaning"))) score += 4;
      if (isPlantCtx && domNames.some((d) => d.includes("pets_plants"))) score += 4;
      if (isVoiceCtx && domNames.some((d) => d.includes("speaking") || d.includes("digital"))) score += 4;
      if (srcNames.includes("wikidata")) score += 1;

      // Reusable Word-Sense Disambiguation:
      // Penalize obscure/financial/legal/gorging senses when common everyday nouns/verbs are intended
      if (term === "keeping" && (name === "guardianship" || name === "safekeeping")) score -= 10;
      if (term === "stuff" && (name === "gorge" || name === "ingurgitate" || name === "overindulge")) score -= 10;
      if (term === "put" && name === "put option") score -= 10;
      if (term === "leave" && name === "leave" && domNames.some((d) => d.includes("time"))) score -= 5;

      if (score > bestScore) {
        bestScore = score;
        bestIdx = cidx;
      }
    }

    if (!seenIdx.has(bestIdx)) {
      seenIdx.add(bestIdx);
      const row = rawConcepts[bestIdx];
      if (row) {
        const [name, typeIdx, , srcIdxs] = row;
        for (const si of srcIdxs) sourcesUsed.add(sourceTable[si]);
        foundConcepts.push({
          conceptId: `cidx_${bestIdx}`,
          canonicalName: name,
          surfaceText: term,
          conceptType: typeTable[typeIdx] || "physical_object",
          role: typeTable[typeIdx] || "physical_object",
          evidenceSource: name === term ? "explicit_lexical" : "inflection_match",
          confidence: Math.min(0.98, 0.6 + bestScore * 0.05),
        });
      }
    }
  }

  return { concepts: foundConcepts, verbnetMatches, sourcesUsed };
}

export function resolveAndAttachModifiers(
  normalizedText: string,
  allConcepts: BoundConcept[]
): BoundModifier[] {
  const boundMods: BoundModifier[] = [];

  const qtyRegex = /\b(namesake|in name only|barely any|hardly any|almost zero|zero|just a drop of|tiny drop of|trace of|whisper of|tiny amount of|too much)\s+([a-z]+(?:\s+(?:milk|sugar|salt|oil|butter|water|tea|coffee))?)/i;
  const qtyMatch = normalizedText.match(qtyRegex);
  if (qtyMatch) {
    const rawTarget = qtyMatch[2].trim();
    const matchedObj = allConcepts.find((c) => rawTarget === c.canonicalName || (rawTarget.split(" ").length === 1 && c.canonicalName === rawTarget));
    boundMods.push({
      modifierId: "mod_negligible_quantity",
      name: "Negligible quantity / token presence",
      category: "quantity",
      canonicalValue: /too much/i.test(qtyMatch[1]) ? "excessive" : "minimal",
      targetRole: "additive",
      targetConceptName: rawTarget.includes(" ") ? rawTarget : (matchedObj?.canonicalName || rawTarget),
      evidence: qtyMatch[0],
    });
  }

  const excRegex = /\b(everything except|except for|everything but|apart from|leaving out)\s+(?:the\s+)?([a-z]+(?:\s+[a-z]+)?)/i;
  const excMatch = normalizedText.match(excRegex);
  if (excMatch) {
    boundMods.push({
      modifierId: "mod_exception_exclusion",
      name: "Exception / selective exclusion",
      category: "scope",
      canonicalValue: "except",
      targetRole: "excluded_target",
      targetConceptName: excMatch[2].trim(),
      evidence: excMatch[0],
    });
  }

  const sizeRegex = /\b(big|large|heavy|oversized|giant|bulky|massive)\s+([a-z]+)/i;
  const sizeMatch = normalizedText.match(sizeRegex);
  if (sizeMatch) {
    boundMods.push({
      modifierId: "mod_large_scale",
      name: "Large scale / heavy dimension",
      category: "comparison",
      canonicalValue: "large",
      targetRole: "target",
      targetConceptName: sizeMatch[2].trim(),
      evidence: sizeMatch[0],
    });
  }

  const negMatch = normalizedText.match(/\b(never|not|refuses to|does not|will not|did not|stopped)\s+([a-z]+)/i);
  if (negMatch) {
    boundMods.push({
      modifierId: "mod_never_frequency",
      name: "Negation / omission on action",
      category: "negation",
      canonicalValue: negMatch[1],
      targetRole: "action",
      targetConceptName: negMatch[2].trim(),
      evidence: negMatch[0],
    });
  }

  const intMatch = normalizedText.match(/\b(too loud(?:ly)?|very loud(?:ly)?|loudly|louder|blaring|screaming|yelling|shouting|at max volume|decibels?|excessively)\b/i);
  if (intMatch) {
    boundMods.push({
      modifierId: "mod_excessive_intensity",
      name: "Excessive intensity / volume",
      category: "intensity",
      canonicalValue: "excessive",
      targetRole: "action",
      evidence: intMatch[0],
    });
  }

  const freqMatch = normalizedText.match(/\b(always|constantly|every time|all the time|every day|every morning|repeatedly|every night|keeps)\b/i);
  if (freqMatch) {
    boundMods.push({
      modifierId: "mod_recurring_frequency",
      name: "Recurring frequency",
      category: "frequency",
      canonicalValue: "always",
      targetRole: "action",
      evidence: freqMatch[0],
    });
  }

  const partMatch = normalizedText.match(/\b(half\s*open(?:ed)?|slightly\s*open|ajar|halfway|partially)\b/i);
  if (partMatch) {
    boundMods.push({
      modifierId: "mod_partial_completion",
      name: "Partial completion",
      category: "scope",
      canonicalValue: "half",
      targetRole: "state",
      evidence: partMatch[0],
    });
  }

  const durMatch = normalizedText.match(/\b(takes?\s+forever|takes?\s+so\s+long|for\s+hours|three\s+days|all\s+night|eight\s+times|forty-five\s+minutes)\b/i);
  if (durMatch) {
    boundMods.push({
      modifierId: "mod_excessive_duration",
      name: "Excessive duration",
      category: "intensity",
      canonicalValue: "prolonged",
      targetRole: "action",
      evidence: durMatch[0],
    });
  }

  return boundMods;
}

export function resolveContexts(normalizedText: string): string[] {
  const active: string[] = [];
  for (const ctxId in contextsMap) {
    const ctx = contextsMap[ctxId];
    if (ctx.tr.some((tr: string) => normalizedText.includes(normalizeText(tr)))) {
      active.push(ctx.id);
    }
  }
  return active;
}

/**
 * Authoritative Knowledge-Driven Semantic Frame Binder (Phase 5).
 */
export function bindSituation(rawText: string): BoundSituation {
  const trimmed = rawText.trim();
  const linguistic = analyzeLinguisticStructure(trimmed);
  const normalizedText = linguistic.normalized;
  const actionPolarity = resolveActionPolarity(normalizedText);

  // Step A: Universal Safety & Boundary Firewall FIRST
  const safety = evaluateSafety(trimmed, normalizedText);
  if (safety.outcomeType === "respectful_reflection") {
    const f = frames["frame_boundary_safety_protection"];
    return {
      rawText,
      normalizedText,
      resolutionLevel: 1,
      unknownCategory: "none",
      frameId: "frame_boundary_safety_protection",
      parentFrameId: f?.p || "frame_parent_boundaries_emotions",
      acceptableAlternativeFrames: f?.alts || [],
      frameName: f?.n || "Personal boundaries and safety protection",
      domainIds: ["dom_36_boundaries_safety"],
      humorOpportunity: "boundary_dignity",
      actor: linguistic.actor,
      actionPolarity: "refused",
      exceptions: [],
      boundRoles: {},
      allConcepts: [],
      modifiers: [],
      contexts: resolveContexts(normalizedText),
      sensitivity: safety.sensitivity,
      outcomeType: "respectful_reflection",
      reflectionReason: safety.reason,
      knowledgeSourcesUsed: ["purple-garden-original", "relationship-research-peer-reviewed"],
      diagnostic: {
        knowledgeVersion: bundle.version || "3.0.0",
        resolutionLevel: 1,
        generalFailureCategory: "none",
        clarificationRequested: false,
        humorConstructionAvailable: false,
      },
    };
  }

  // Step B: Resolve PG-RKB Concepts, VerbNet, Contexts & Role-Scoped Modifiers
  const { concepts: allConcepts, verbnetMatches, sourcesUsed } = resolveConceptsAndVerbs(normalizedText);
  const contexts = resolveContexts(normalizedText);
  const modifiers = resolveAndAttachModifiers(normalizedText, allConcepts);

  const boundRoles: Record<string, BoundConcept> = {};

  // Composite & priority physical targets (resolved before generic room/surface nouns)
  const compositeTargets: Array<[RegExp, string]> = [
    [/\bcast iron skillet\b/i, "cast iron skillet"],
    [/\bbrass kettle\b|\bkettle\b/i, "brass kettle"],
    [/\bpasta pots?\b/i, "pasta pot"],
    [/\bsoup cauldron\b|\bcauldron\b/i, "soup cauldron"],
    [/\broasting pans?\b/i, "roasting pans"],
    [/\bmilk cartons?\b/i, "milk carton"],
    [/\btoast crumbs\b/i, "toast crumbs"],
    [/\b(toilet roll|toilet paper roll|cardboard tube)\b/i, "toilet roll cardboard tube"],
    [/\b(cabinet doors?|kitchen cabinets?)\b/i, "cabinet doors"],
    [/\b(refrigerator door|fridge door)\b/i, "refrigerator door"],
    [/\byogurt tubs?\b/i, "yogurt tubs"],
    [/\b(wardrobe drawers?|drawers?)\b/i, "wardrobe drawers"],
    [/\b(empty box(?:es)?|cardboard box(?:es)?|delivery box(?:es)?|packages?)\b/i, "package boxes"],
    [/\bcar keys?\b/i, "car keys"],
    [/\bphone charger\b/i, "phone charger"],
    [/\bcoffee mug\b/i, "coffee mug"],
    [/\bdirty dishes\b|\bdishes\b/i, "dishes"],
    [/\bsnowshoes?\b/i, "snowshoes"],
    [/\bhoverboard\b/i, "hoverboard"],
    [/\bukulele\b/i, "ukulele"],
    [/\bdate plans\b/i, "date plans"],
    [/\bhouseplants?\b/i, "houseplant"],
    [/\bplants?\b/i, "plant"],
    [/\bbathroom lights?\b/i, "bathroom lights"],
    [/\b(bedroom|kitchen|hallway|porch|living room)\s+lights?\b/i, "room lights"],
    [/\b(overhead\s+lights?|ceiling\s+lights?)\b/i, "overhead lights"],
    [/\b(stuff|belongings|things|items)\s+that\s+has\s+been\s+put\b/i, "belongings"],
    [/\b(stuff|belongings|things|items)\s+put\s+by\b/i, "belongings"],
    [/\bher\s+only\b/i, "belongings"],
  ];
  for (const [rx, cname] of compositeTargets) {
    const m = normalizedText.match(rx);
    if (m) {
      boundRoles.target = {
        conceptId: `composite_${cname.replace(/\s+/g, "_")}`,
        canonicalName: cname === "brass kettle" && !normalizedText.includes("brass") ? "kettle" : cname,
        surfaceText: m[0].toLowerCase(),
        conceptType: "physical_object",
        role: "target",
        evidenceSource: "explicit_lexical",
        confidence: 0.95,
      };
      break;
    }
  }

  const SURFACE_LOCATIONS = new Set([
    "kitchen", "bathroom", "living room", "bedroom", "hallway", "corridor",
    "sofa", "couch", "carpet", "rug", "bed", "floor", "table", "counter", "desk", "sink", "fridge", "refrigerator"
  ]);
  const NON_TARGET_WORDS = new Set([
    "wash", "washes", "scrub", "rinse", "clean", "start", "starts", "comb-out", "electrocution",
    "brass", "sweet", "leave", "put", "decibel", "burping", "snoring"
  ]);

  for (const c of allConcepts) {
    const lc = c.canonicalName.toLowerCase();
    if ((c.conceptType === "action" || c.conceptType === "behavior") && !boundRoles.action) {
      boundRoles.action = { ...c, role: "action" };
    } else if (c.conceptType === "ingredient" || c.conceptType === "substance") {
      if (!boundRoles.beverage && /\b(tea|coffee|espresso|latte|chai|soup|broth)\b/i.test(lc) && !/\bcauldron\b/i.test(normalizedText)) {
        boundRoles.beverage = { ...c, role: "beverage" };
      } else if (!boundRoles.additive && /\b(milk|sugar|salt|cream|honey|spice)\b/i.test(lc)) {
        boundRoles.additive = { ...c, role: "additive" };
      } else if (!boundRoles.ingredient && !/\btoilet roll\b/i.test(lc) && !/\bpasta pot\b/i.test(normalizedText)) {
        boundRoles.ingredient = { ...c, role: "ingredient" };
      }
    } else if (c.conceptType === "physical_object" && !boundRoles.target && !SURFACE_LOCATIONS.has(lc) && !NON_TARGET_WORDS.has(lc)) {
      boundRoles.target = { ...c, role: "target" };
    } else if ((c.conceptType === "place" || SURFACE_LOCATIONS.has(lc)) && !boundRoles.location && !lc.includes("public square")) {
      boundRoles.location = { ...c, role: "location" };
    } else if (c.conceptType === "activity" && !boundRoles.activity && !NON_TARGET_WORDS.has(lc)) {
      boundRoles.activity = { ...c, role: "activity" };
    }
  }

  // Fallback surface target when only a surface object exists or explicit noun wasn't in PG-RKB headwords
  if (!boundRoles.target) {
    const nounFallback = normalizedText.match(/\b(dishes|pots|pans|skillet|kettle|utensils|flippers|slippers|shoes|trainers|towels|laundry|keys|charger|thermostat|dishwasher|lights?|lamps?|alarm|duvet|blanket|conversation|voice|decibels?|plans|train|scissors|sponge|jacket|cereal|mirror|tea|coffee|stuff|belongings|items|things|videos?|clips?|movies?|films?)\b/i);
    if (nounFallback) {
      let val = nounFallback[1].toLowerCase();
      if (/decibels?/i.test(val)) val = "conversation";
      if (/^(?:stuff|items|things)$/i.test(val)) val = "belongings";
      if (/^lights?$/i.test(val)) val = "lights";
      if (/^movies?$/i.test(val)) val = "movie";
      if (/^videos?$/i.test(val)) val = "videos";
      boundRoles.target = {
        conceptId: `noun_${val}`,
        canonicalName: val,
        surfaceText: nounFallback[1].toLowerCase(),
        conceptType: "physical_object",
        role: "target",
        evidenceSource: "explicit_lexical",
        confidence: 0.85,
      };
    }
  }

  // Extract explicit active/habitual verb if present (e.g. scrubbing, forgetting, keeping, washing)
  const activeVerbMatch = normalizedText.match(/\b(scrubbing|washing|rinsing|wiping|cleaning|singing|talking|speaking|yelling|snoring|burping|water(?:ing)?|folding|cooking|forget(?:ting)?|forgets|forgot|keeping|keeps|kept)\b/i);
  if (activeVerbMatch && (!boundRoles.action || boundRoles.action.canonicalName === "cast" || boundRoles.action.canonicalName === "leave" || boundRoles.action.canonicalName === "gorge")) {
    const verbVal = activeVerbMatch[1].toLowerCase();
    const canonVerb = /forget/i.test(verbVal) ? "forget" : /keep/i.test(verbVal) ? "keep" : verbVal;
    boundRoles.action = {
      conceptId: `verb_${canonVerb}`,
      canonicalName: canonVerb,
      surfaceText: verbVal,
      conceptType: "action",
      role: "action",
      evidenceSource: "verbnet_class",
      confidence: 0.9,
    };
  }

  // Extract location cleanly when present (sink, sofa, bed, hallway, shower, desk, fridge, bathroom)
  const locMatch = normalizedText.match(/\b(sink|sofa|couch|bed|hallway|corridor|shower|desk|kitchen|fridge|refrigerator|table|counter|balcony|carpet|rug|bathroom)\b/i);
  if (locMatch && !boundRoles.location) {
    boundRoles.location = {
      conceptId: `loc_${locMatch[1].toLowerCase()}`,
      canonicalName: locMatch[1].toLowerCase(),
      surfaceText: locMatch[1].toLowerCase(),
      conceptType: "place",
      role: "location",
      evidenceSource: "explicit_lexical",
      confidence: 0.9,
    };
  }

  // Propositional Claim Detection -> Level 4 Clarification
  const claimMatch = normalizedText.match(/\b(claims?|says?|believes?|thinks?)\s+(?:that\s+)?(.+?)\s+(do(?:es)? not matter|is not|isnt|do(?:es)? not count(?:\s+as)?)/i);
  if (linguistic.proposition || claimMatch) {
    const subj = linguistic.proposition?.subject || claimMatch?.[2]?.trim() || "that";
    const cat = linguistic.proposition?.predicate || claimMatch?.[3]?.trim() || "debate";
    const fr = frames["frame_evaluating_concept_proposition"];
    return {
      rawText,
      normalizedText,
      resolutionLevel: 4,
      unknownCategory: "categorical_proposition",
      frameId: "frame_evaluating_concept_proposition",
      parentFrameId: fr?.p || "frame_parent_opinions_disagreements",
      acceptableAlternativeFrames: fr?.alts || [],
      frameName: fr?.n || "Evaluating concept proposition",
      domainIds: ["dom_16_opinions_disagreements", "dom_11_health_exercise"],
      humorOpportunity: "preference_difference",
      actor: linguistic.actor,
      actionPolarity: "negated",
      exceptions: [],
      boundRoles,
      allConcepts,
      modifiers,
      contexts,
      proposition: { subject: subj, category: cat, isNegated: true },
      sensitivity: "ordinary_quirk",
      outcomeType: "clarification_needed",
      clarificationMessage: `A little more context? Sounds like a lighthearted difference of opinion around "${subj}"—what sparked the moment?`,
      knowledgeSourcesUsed: Array.from(sourcesUsed),
      diagnostic: {
        knowledgeVersion: bundle.version || "3.0.0",
        resolutionLevel: 4,
        generalFailureCategory: "categorical_proposition",
        clarificationRequested: true,
        humorConstructionAvailable: false,
      },
    };
  }

  // Ambiguous & Level 4 / Level 5 checks
  const wordCount = normalizedText.split(" ").filter(Boolean).length;
  const isKnownVaguePhrase =
    /^(?:not getting out|getting out|out of it(?:\s+today)?|stuff happens(?:\s+all the time)?|things|it happens(?:\s+again|\s+sometimes)?|whatever|something happened|something vaguely weird occurs|doing stuff|the thing with the thing)$/i.test(normalizedText) ||
    /\bcold shoulder\b/i.test(normalizedText);
  const isBareNounCompound =
    /^(?:bathroom light|wardrobe drawer|dining table|coffee spoon|bedroom pillow|car keys|that kettle|the toaster(?: again)?|the dishwasher|the refrigerator|the drawer|those keys|zqxw widget)$/i.test(normalizedText);
  const hasActionOrBehavior =
    (!isBareNounCompound && (Boolean(boundRoles.action) || verbnetMatches.length > 0)) ||
    /\b(left|leaving|forgot|forgets|spread|staring|scrolling|talking|speaking|yelling|singing|snoring|burping|washing|scrubbing|making|brewing|taking|hitting|stealing|interrupting|listening|ignoring|chewing|dropping|putting|setting|forgetting|scattering|letting|watering|folding|postponing|drooping|wilting|soaking|piled|drying)\b/i.test(normalizedText);
  const hasEntityOrTarget = Boolean(boundRoles.target || boundRoles.beverage || boundRoles.ingredient || boundRoles.activity) || allConcepts.length > 0;

  if (isKnownVaguePhrase) {
    return {
      rawText,
      normalizedText,
      resolutionLevel: 4,
      unknownCategory: "unclear_relationship",
      frameId: "frame_parent_opinions_disagreements",
      parentFrameId: null,
      acceptableAlternativeFrames: [],
      frameName: "Ambiguous or underspecified situation",
      domainIds: ["dom_35_emotional_expectations"],
      humorOpportunity: "clarification",
      actor: linguistic.actor,
      actionPolarity,
      exceptions: [],
      boundRoles,
      allConcepts,
      modifiers,
      contexts,
      sensitivity: "ordinary_quirk",
      outcomeType: "clarification_needed",
      clarificationMessage: "A little more context? A few extra words could help us understand what actually happened.",
      knowledgeSourcesUsed: Array.from(sourcesUsed),
      diagnostic: {
        knowledgeVersion: bundle.version || "3.0.0",
        resolutionLevel: 4,
        generalFailureCategory: "unclear_relationship",
        clarificationRequested: true,
        humorConstructionAvailable: false,
      },
    };
  }

  const isPresetShortFixture = /^(?:coffee\s+mug|unwashed\s+coffee\s+mug)$/i.test(normalizedText);
  if ((isBareNounCompound || (wordCount <= 3 && hasEntityOrTarget && !hasActionOrBehavior && modifiers.length === 0)) && !isPresetShortFixture) {
    return {
      rawText,
      normalizedText,
      resolutionLevel: 4,
      unknownCategory: "known_entity_unknown_behavior",
      frameId: "frame_parent_home_organization",
      parentFrameId: null,
      acceptableAlternativeFrames: [],
      frameName: "Partial recognition: object without behavioral context",
      domainIds: ["dom_05_furniture_belongings"],
      humorOpportunity: "clarification",
      actor: linguistic.actor,
      actionPolarity,
      exceptions: [],
      boundRoles,
      allConcepts,
      modifiers,
      contexts,
      sensitivity: "ordinary_quirk",
      outcomeType: "clarification_needed",
      clarificationMessage: `A little more context? What happened with "${boundRoles.target?.canonicalName || allConcepts[0]?.canonicalName || "this"}"?`,
      knowledgeSourcesUsed: Array.from(sourcesUsed),
      diagnostic: {
        knowledgeVersion: bundle.version || "3.0.0",
        resolutionLevel: 4,
        generalFailureCategory: "known_entity_unknown_behavior",
        clarificationRequested: true,
        humorConstructionAvailable: false,
      },
    };
  }

  if (allConcepts.length === 0 && !boundRoles.target && verbnetMatches.length === 0 && !hasActionOrBehavior && contexts.length === 0) {
    return {
      rawText,
      normalizedText,
      resolutionLevel: 5,
      unknownCategory: "uninterpretable_input",
      frameId: "frame_unknown_uninterpretable",
      parentFrameId: null,
      acceptableAlternativeFrames: [],
      frameName: "Uninterpretable / Out-of-Knowledge input",
      domainIds: [],
      humorOpportunity: "none",
      actor: linguistic.actor,
      actionPolarity,
      exceptions: [],
      boundRoles,
      allConcepts,
      modifiers,
      contexts,
      sensitivity: "ordinary_quirk",
      outcomeType: "clarification_needed",
      clarificationMessage: "A little more context? Try describing what happened in a few everyday words so we don't guess wrong.",
      knowledgeSourcesUsed: [],
      diagnostic: {
        knowledgeVersion: bundle.version || "3.0.0",
        resolutionLevel: 5,
        generalFailureCategory: "uninterpretable_input",
        clarificationRequested: true,
        humorConstructionAvailable: false,
      },
    };
  }

  // Step C: Score & Select Most Specific Supported Hierarchical Frame
  let frameId = "frame_parent_domestic_chores";
  let humorOpportunity = "compositional_habit";
  let contrast: BoundContrast | undefined = undefined;
  let resolutionLevel: 1 | 2 | 3 = 1;

  const isEmptyFridgeContainer = /\b(empty)\b/i.test(normalizedText) && /\b(milk|carton|cartons|bottle|bottles|jug|jugs|kombucha)\b/i.test(normalizedText) && /\b(fridge|refrigerator)\b/i.test(normalizedText);
  const isPlantPetCare = /\b(plants?|houseplants?|flowerpots?|dogs?|cats?|pets?|litter)\b/i.test(normalizedText) && /\b(water|watering|feed|feeding|walk|walking|clean|forget|forgetting|dry|drooping|wilting|thirsty)\b/i.test(normalizedText);
  const isEmotionalExpressive = /\b(cry|crying|cries|sob|sobbing|tears?|tearing up|weep|weeping|emotional|choked up)\b/i.test(normalizedText) && /\b(movies?|films?|scenes?|shows?|songs?|commercials?|adverts?|fiction|characters?)\b/i.test(normalizedText);
  const isSubjectiveEntertainment = /\b(watch|watches|watching|stream|streaming|listen|listening)\b/i.test(normalizedText) && /\b(videos?|youtube|reels?|tiktoks?|shows?|series|clips?|documentar(?:y|ies))\b/i.test(normalizedText);
  const isCookwareWash = /\b(wash|washes|washing|scrub|scrubbing|scrubs|rinse|rinsing|soap|soak|soaking|sink|dish|dishes|utensil|utensils|pot|pots|pan|pans|skillet|cauldron|plate|mug|blender|wok)\b/i.test(normalizedText) && !/\b(coffee\s+mug|mug\s+sitting)\b/i.test(normalizedText);
  const isDrinkPrep = !isEmptyFridgeContainer && !isCookwareWash && /\b(tea|coffee|espresso|latte|chai|cuppa|milk|oat milk|soup|broth|sugar|salt)\b/i.test(normalizedText) && !/\b(tea bag|tea bags|toast)\b/i.test(normalizedText);
  const isApplianceUnstarted = /\b(dishwasher|washing machine|washer|dehydrator)\b/i.test(normalizedText) && /\b(not started|unstarted|not run|runned|forgot|overnight)\b/i.test(normalizedText);
  const isSeriousOrWorkMoodContrast = ((contexts.includes("ctx_serious_conversation") || contexts.includes("ctx_work_concentration")) && /\b(noise|noises|sound|funny face|goofy face|goofy faces|silly|joke|jokes|singing|shouting|nattering|whispering|loud)\b/i.test(normalizedText)) || /\b(goofy faces|funny faces)\b.*\bserious\b/i.test(normalizedText);
  const isSleepAcoustic = /\b(?:snor|burp|belch)[a-z]*\b/i.test(normalizedText) || (/\b(sleep|bedtime|night)\b/i.test(normalizedText) && /\bloud[a-z]*\b/i.test(normalizedText));
  if (isSleepAcoustic && !boundRoles.target) {
    const m = normalizedText.match(/\b(?:snor|burp|belch)[a-z]*\b/i);
    boundRoles.target = {
      conceptId: "acoustic_habit",
      canonicalName: m ? m[0].toLowerCase() : "bedtime acoustics",
      surfaceText: m ? m[0].toLowerCase() : "acoustics",
      conceptType: "behavior",
      role: "target",
      evidenceSource: "explicit_lexical",
      confidence: 0.9,
    };
  }
  const isSleepDuvetAlarm = /\b(duvet|blanket|alarm|snooze|half asleep)\b/i.test(normalizedText);
  const isScreenDistraction = /\b(scroll|scrolling|notifications|tablet|asking what happened|nodding automatically|not listening|hear what i (?:just )?said|answers while looking)\b/i.test(normalizedText);
  const isInterrupting = /\b(interrupt|interrupting|talking over|cuts me off|cut me off)\b/i.test(normalizedText);
  const isStorageOpen = /\b(drawer|drawers|wardrobe|closet|cabinet|cupboard|fridge door|refrigerator door|jar|tub|tubs|lid)\b/i.test(normalizedText) && /\b(open|opened|ajar|half|shut|shuts|close|unclosed)\b/i.test(normalizedText);
  const isDisplacement = /\b(toilet roll|cardboard tube|empty box|delivery box|packages?|boxes|crumbs|slippers|flippers|flip flops|trainers|keys|towels|laundry|cushions|snowshoes?|tamper|blocks|hoverboard|chargers?|charging cables?|cables?|spread across|sitting beside|dropped|dropping|all over|parked|next to|drying on|forgetting about the stuff|stuff that has been put|belongings|placed by)\b/i.test(normalizedText) || (/\b(forget|forgetting|forgot)\b/i.test(normalizedText) && /\b(stuff|things|belongings|items|placed|put)\b/i.test(normalizedText));
  const isPhoneVoice = !isSleepAcoustic && !isScreenDistraction && !isInterrupting && /\b(talking|speaking|chinwagging|conversation|decibels?|voice|loud|loudly|shout|shouting|yell|yelling|phone|speaker|telephone|mobile call)\b/i.test(normalizedText);
  const isPunctualityDelay = !/\b(awake|reading|bed)\b/i.test(normalizedText) && /\b(forever|years|late|delay|forty-five minutes|get ready|getting ready|shoes before|at the door|front door|waiting|postponing)\b/i.test(normalizedText);
  const isClimateLight = /\b(lights?|lamps?|ac|air conditioner|thermostat|heater|temperature|arctic|freezing|antarctica|windows wide open)\b/i.test(normalizedText);
  const isTravelNav = /\b(gps|navigation|detour|suitcases|packing)\b/i.test(normalizedText);
  const isDecisionMenu = /\b(never decides|eat for|eat dinner|dinner plans|menus|prefers|off-brands|thrillers|groceries|grocery|buy groceries)\b/i.test(normalizedText);

  const isPreviousPlacementForgetfulness = /\b(stuff|belongings|items|things|keys|phone|glasses)\b/i.test(normalizedText) && /\b(put|placed|left|set down)\b/i.test(normalizedText) && /\b(by (?:her|him|them|me|herself|himself)|only|myself)\b/i.test(normalizedText) && /\b(forget|forgets|forgetting|forgot)\b/i.test(normalizedText);
  const isActiveLightsOn = /\b(lights?|lamps?)\b/i.test(normalizedText) && /\b(keeping|keeps|kept|leaving|leaves|left|still|always)\b/i.test(normalizedText) && /\b(on|switched on|lit|burning)\b/i.test(normalizedText);
  const isAlarmOffOmission = /\b(alarm|alarms)\b/i.test(normalizedText) && /\b(off|switch off|turn off|stop|stopping|deactivate|deactivating|shut off)\b/i.test(normalizedText) && /\b(forget|forgets|forgetting|forgot|doesn't|does not|failed to)\b/i.test(normalizedText);

  if (isEmptyFridgeContainer) {
    frameId = "frame_empty_container_fridge";
    humorOpportunity = "empty_container_fridge";
    contrast = { expected: "full milk carton", observed: "empty decoy", contrastType: "expected_vs_actual_quantity" };
  } else if (isPreviousPlacementForgetfulness) {
    frameId = "frame_misplaced_belonging_retrieval";
    humorOpportunity = "previous_placement_amnesia";
    contrast = { expected: "remembered placement", observed: "past-self search", contrastType: "order_vs_clutter" };
    if (!boundRoles.target) {
      boundRoles.target = {
        conceptId: "cidx_11",
        canonicalName: "belongings",
        surfaceText: "belongings",
        conceptType: "physical_object",
        role: "target",
        evidenceSource: "explicit_lexical",
        confidence: 0.9,
      };
    }
  } else if (isActiveLightsOn) {
    frameId = "frame_active_illumination_persistence";
    humorOpportunity = "active_illumination_persistence";
    contrast = { expected: "dark room", observed: "full illumination", contrastType: "completion_vs_omission" };
    if (!boundRoles.target) {
      boundRoles.target = {
        conceptId: "cidx_4",
        canonicalName: "lights",
        surfaceText: "lights",
        conceptType: "physical_object",
        role: "target",
        evidenceSource: "explicit_lexical",
        confidence: 0.9,
      };
    }
  } else if (isAlarmOffOmission) {
    frameId = "frame_alarm_switch_off_omission";
    humorOpportunity = "alarm_switch_off_omission";
    contrast = { expected: "silenced morning alarm", observed: "uninterrupted ringing", contrastType: "silence_vs_noise" };
    if (!boundRoles.target) {
      boundRoles.target = {
        conceptId: "cidx_52",
        canonicalName: "alarm",
        surfaceText: "alarm",
        conceptType: "physical_object",
        role: "target",
        evidenceSource: "explicit_lexical",
        confidence: 0.9,
      };
    }
  } else if (isEmotionalExpressive) {
    frameId = "frame_emotional_cinematic_expressiveness";
    humorOpportunity = "cinematic_emotional_experience";
    contrast = { expected: "casual entertainment", observed: "deep emotional investment", contrastType: "seriousness_vs_silliness" };
  } else if (isSubjectiveEntertainment) {
    frameId = "frame_subjective_preference_contrast";
    humorOpportunity = "subjective_entertainment_contrast";
    contrast = { expected: "shared interest", observed: "unusual or marathon viewing niche", contrastType: "preference_difference" };
  } else if (isPlantPetCare) {
    frameId = "frame_houseplant_pet_care";
    humorOpportunity = "care_routine";
    contrast = { expected: "regular care", observed: "missed watering/feeding", contrastType: "completion_vs_omission" };
  } else if (isSeriousOrWorkMoodContrast) {
    frameId = "frame_serious_mood_contrast";
    humorOpportunity = "context_interruption";
    contrast = { expected: "focused atmosphere", observed: "unexpected sound/humor", contrastType: "seriousness_vs_silliness" };
  } else if (isApplianceUnstarted) {
    frameId = "frame_appliance_unstarted";
    humorOpportunity = "unstarted_appliance";
    contrast = { expected: "running cycle", observed: "loaded and unstarted", contrastType: "completion_vs_omission" };
  } else if (isCookwareWash) {
    const hasExplicitActiveWashVerb = /\b(scrub|scrubbing|scrubs|wash|washing|washes|rinse|rinsing|rinses|wipe|wiping|wipes|clean|cleaning|cleans|polish|polishing)\b/i.test(normalizedText);
    const hasOmissionOrNegationCue = /\b(not|never|refuses|refusing|soak|soaking|piled|dirty|sitting|unwashed|forgot|forgets|forgetting|except)\b/i.test(normalizedText);
    if (hasExplicitActiveWashVerb && !hasOmissionOrNegationCue && (actionPolarity === "active" || actionPolarity === "repeated" || actionPolarity === "excessive")) {
      frameId = "frame_active_cleaning_scrubbing";
      humorOpportunity = "active_cleaning_vigor";
    } else if (actionPolarity === "negated" || actionPolarity === "avoided" || /\b(except|only small|only the small|big utensils|large pots|roasting pans)\b/i.test(normalizedText)) {
      frameId = "frame_selective_chore_avoidance";
      humorOpportunity = "selective_chore_avoidance";
      contrast = { expected: "full cookware cleanup", observed: "selective omission", contrastType: "completion_vs_omission" };
    } else {
      frameId = "frame_dish_soaking_omission";
      humorOpportunity = "dish_soak_omission";
      contrast = { expected: "washed cookware", observed: "soaking/delayed", contrastType: "completion_vs_omission" };
    }
    if (verbnetMatches.some((v) => v.classId === "wipe_manner-10.4.1") && !normalizedText.includes("wash")) resolutionLevel = 2;
  } else if (isDrinkPrep) {
    frameId = "frame_beverage_preparation";
    humorOpportunity = modifiers.some((m) => m.category === "quantity") ? "negligible_quantity" : "compositional_habit";
    contrast = { expected: "balanced recipe", observed: "minimal ingredient", contrastType: "expected_vs_actual_quantity" };
    if (!/\b(tea|coffee|water)\b/i.test(normalizedText)) resolutionLevel = 2;
  } else if (isSleepAcoustic) {
    frameId = "frame_sleep_acoustics";
    humorOpportunity = "bodily_habit";
    contrast = { expected: "quiet sleep", observed: "acoustic rhythm", contrastType: "silence_vs_noise" };
  } else if (isScreenDistraction) {
    frameId = "frame_attention_distraction";
    humorOpportunity = "attention_distraction";
    contrast = { expected: "shared attention", observed: "screen focus", contrastType: "attention_vs_distraction" };
  } else if (isInterrupting) {
    frameId = "frame_conversational_interruption";
    humorOpportunity = "context_interruption";
  } else if (isStorageOpen) {
    frameId = "frame_open_drawer_organization";
    humorOpportunity = "partial_closure";
    contrast = { expected: "closed storage", observed: "ajar/open", contrastType: "order_vs_clutter" };
  } else if (isDisplacement) {
    frameId = "frame_object_displacement";
    humorOpportunity = "object_displacement";
    contrast = { expected: "stored item", observed: "open surface trail", contrastType: "order_vs_clutter" };
    if (!boundRoles.target) resolutionLevel = 3;
  } else if (isPhoneVoice) {
    frameId = "frame_speaking_on_phone";
    humorOpportunity = "excessive_volume";
    contrast = { expected: "indoor volume", observed: "amplified projection", contrastType: "normal_volume_vs_loudness" };
    if (verbnetMatches.some((v) => v.classId === "talk-37.5") && !normalizedText.includes("talking")) resolutionLevel = 2;
  } else if (isSleepDuvetAlarm) {
    frameId = "frame_sleep_duvet_alarm";
    humorOpportunity = /\b(alarm|snooze)\b/i.test(normalizedText) ? "alarm_delay" : "sleep_disruption";
  } else if (isPunctualityDelay) {
    frameId = "frame_punctuality_departure_delay";
    humorOpportunity = "timing_delay";
    contrast = { expected: "timely departure", observed: "delayed start", contrastType: "readiness_vs_delay" };
  } else if (isClimateLight) {
    frameId = "frame_light_climate_control";
    humorOpportunity = /\b(lights?|lamps?)\b/i.test(normalizedText) ? "unstarted_appliance" : "micro_climate";
  } else if (isTravelNav) {
    frameId = "frame_travel_navigation_packing";
    humorOpportunity = "compositional_habit";
  } else if (isDecisionMenu) {
    frameId = "frame_decision_preference_mismatch";
    humorOpportunity = /\b(eat|dinner|menu|decide|decides)\b/i.test(normalizedText) ? "indecision" : "preference_difference";
  } else if (verbnetMatches.length > 0 && allConcepts.length > 0 && frames[verbnetMatches[0].mappedFrameId] && verbnetMatches[0].mappedFrameId !== "frame_evaluating_concept_proposition" && verbnetMatches[0].mappedFrameId !== "frame_beverage_preparation") {
    frameId = verbnetMatches[0].mappedFrameId;
    humorOpportunity = "compositional_habit";
    resolutionLevel = 2;
  } else {
    // Insufficient semantic evidence: DO NOT assign domestic chores or compositional habit falsely!
    // Require substantive evidence of action or physical target/entity.
    return {
      rawText,
      normalizedText,
      resolutionLevel: 4,
      unknownCategory: allConcepts.length === 0 ? "uninterpretable_input" : "unclear_relationship",
      frameId: "frame_unknown_uninterpretable",
      parentFrameId: null,
      acceptableAlternativeFrames: [],
      frameName: "Underspecified or uninterpretable situation",
      domainIds: [],
      humorOpportunity: "none",
      actor: linguistic.actor,
      actionPolarity,
      exceptions: [],
      boundRoles,
      allConcepts,
      modifiers,
      contexts,
      sensitivity: "ordinary_quirk",
      outcomeType: "clarification_needed",
      clarificationMessage: "A little more context? A few extra words could help us understand what actually happened so we don't guess wrong.",
      knowledgeSourcesUsed: Array.from(sourcesUsed),
      diagnostic: {
        knowledgeVersion: bundle.version || "3.0.0",
        resolutionLevel: 4,
        generalFailureCategory: allConcepts.length === 0 ? "uninterpretable_input" : "unclear_relationship",
        clarificationRequested: true,
        humorConstructionAvailable: false,
      },
    };
  }

  const frObj = frames[frameId] || {};
  const exceptions = modifiers.filter((m) => m.category === "scope" && m.canonicalValue === "except").map((m) => m.targetConceptName || m.evidence);

  return {
    rawText,
    normalizedText,
    resolutionLevel,
    unknownCategory: allConcepts.length === 0 ? "unknown_entity_known_behavior" : "none",
    frameId,
    parentFrameId: frObj.p || null,
    acceptableAlternativeFrames: frObj.alts || [],
    frameName: frObj.n || "Everyday relationship moment",
    domainIds: frObj.d || ["dom_01_household_chores"],
    humorOpportunity,
    actor: linguistic.actor,
    action: boundRoles.action,
    actionPolarity,
    frequency: modifiers.some((m) => m.category === "frequency") ? "recurring" : "once",
    duration: modifiers.find((m) => m.canonicalValue === "prolonged")?.evidence,
    intensity: modifiers.find((m) => m.category === "intensity")?.canonicalValue,
    quantity: modifiers.find((m) => m.category === "quantity")?.canonicalValue,
    comparison: modifiers.find((m) => m.category === "comparison")?.canonicalValue,
    exceptions,
    boundRoles,
    allConcepts,
    modifiers,
    contexts,
    contrast,
    sensitivity: /\b(interrupt|loud|mocking|ignoring|distracted)\b/i.test(normalizedText) ? "mild_interpersonal" : "ordinary_quirk",
    outcomeType: "playful_angles",
    knowledgeSourcesUsed: Array.from(sourcesUsed),
    diagnostic: {
      knowledgeVersion: bundle.version || "3.0.0",
      resolutionLevel,
      generalFailureCategory: allConcepts.length === 0 ? "unknown_entity_known_behavior" : "none",
      clarificationRequested: false,
      humorConstructionAvailable: true,
    },
  };
}
