/**
 * src/lib/pg-hkb-composer.ts
 *
 * Authoritative PG-HKB Compositional Humor Realizer & Semantic Integrity Guard (Phase 5).
 * Enforces:
 * - Strict Action-Polarity Compatibility (active/repeated scrubbing never gets soaking/untouched copy!)
 * - Humor Family Rotation across regenerations (no consecutive mock-authority or duplicate structures)
 * - Grammatical slot substitution & singular/plural agreement
 * - Semantic Candidate Integrity Verification against BoundSituation provenance
 */

import { RUNTIME_KNOWLEDGE_BUNDLE } from "./compiled-knowledge-data.ts";
import type { ActionPolarity, BoundSituation } from "./knowledge-resolver.ts";

export interface CandidateProvenance {
  frameId: string;
  frameName: string;
  resolutionLevel: 1 | 2 | 3 | 4 | 5;
  actionPolarity: ActionPolarity;
  humorOpportunity: string;
  humorFamilies: string[];
  boundRoles: Record<string, string>;
  modifiers: string[];
  contexts: string[];
  mechanismIds: string[];
  constructionIds: string[];
  sensitivity: BoundSituation["sensitivity"];
  knowledgeSourcesUsed: string[];
}

export interface PgHkbCompositionResult {
  gentle: string;
  playful: string;
  exaggerated: string;
  provenance: CandidateProvenance;
  usedPgHkb: boolean;
}

const bundle = RUNTIME_KNOWLEDGE_BUNDLE as any;
const constructions: Record<string, any> = bundle.entities.constructions || {};
const constructionsByOpportunity: Record<string, string[]> = bundle.indexes.constructionsByOpportunity || {};
const contextsMap: Record<string, any> = bundle.entities.contexts || {};

function capitalizeSentence(s: string): string {
  const trimmed = s.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  const firstUpper = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?"]$/.test(firstUpper) ? firstUpper : firstUpper + ".";
}

function humanContextLabel(ctxIds: string[]): string {
  if (!ctxIds || ctxIds.length === 0) return "shared routines";
  const id = ctxIds[0];
  const map: Record<string, string> = {
    ctx_phone_call: "a phone call",
    ctx_kitchen_prep: "kitchen prep",
    ctx_sink_cleanup: "sink cleanup",
    ctx_fitness_workout: "exercise time",
    ctx_shared_living_space: "the living room",
    ctx_bedtime_rest: "bedtime",
    ctx_morning_routine: "morning quiet",
    ctx_evening_wind_down: "evening wind-down",
    ctx_work_concentration: "work focus",
    ctx_shared_mealtime: "dinner",
    ctx_serious_conversation: "a serious moment",
    ctx_departure_departure_rush: "heading out the door",
    ctx_guests_present: "company over",
  };
  return map[id] || contextsMap[id]?.n?.toLowerCase() || "shared routines";
}

function resolveGerundAction(bound: BoundSituation): string {
  const raw = bound.boundRoles.action?.surfaceText || bound.boundRoles.action?.canonicalName || "handling";
  if (raw.endsWith("ing")) return raw;
  const map: Record<string, string> = {
    scrub: "scrubbing",
    wash: "washing",
    rinse: "rinsing",
    wipe: "wiping",
    clean: "cleaning",
    talk: "talking",
    speak: "speaking",
    sing: "singing",
    water: "watering",
    fold: "folding",
  };
  return map[raw] || raw;
}

export function realizeConstructionTemplate(template: string, bound: BoundSituation): string {
  const roles = bound.boundRoles;
  const qtyMod = bound.modifiers.find((m) => m.category === "quantity");
  const sizeMod = bound.modifiers.find((m) => m.category === "comparison" && m.canonicalValue === "large");
  const excMod = bound.modifiers.find((m) => m.category === "scope" && m.canonicalValue === "except");

  const bevMatch = bound.normalizedText.match(/\b(espresso|cappuccino|latte|chai|tea|coffee|soup|broth|cuppa)\b/i);
  const beverage = roles.beverage?.canonicalName || (bevMatch ? bevMatch[1].toLowerCase() : "tea");
  const additive = qtyMod?.targetConceptName || roles.additive?.canonicalName || roles.ingredient?.canonicalName || "milk";

  const excTarget = excMod?.targetConceptName
    ?.replace(/\bgiant\s+soup\b/i, "giant soup cauldron")
    ?.trim();
  const templateHasTarget = /\{target\}/.test(template);
  let target = excTarget || roles.target?.canonicalName || roles.beverage?.canonicalName || roles.ingredient?.canonicalName || (roles.activity?.canonicalName !== "guardianship" ? roles.activity?.canonicalName : undefined) || (bound.humorOpportunity === "excessive_volume" ? "voice" : bound.frameId === "frame_object_displacement" ? "belongings" : undefined);
  if (!target && templateHasTarget) {
    // DO NOT substitute generic filler like "everyday moment" — fail composition cleanly!
    return "";
  }
  target = target || "";
  const templateHasSizeAdj = /\b(big|giant|oversized|heavy|heavyweight|large|bulky|massive)\s+\{target\}/i.test(template);
  if (sizeMod && !target.includes(sizeMod.canonicalValue) && !templateHasSizeAdj && !/\b(giant|oversized|massive|heavy|large|big)\b/i.test(target) && bound.humorOpportunity === "selective_chore_avoidance" && !excMod) {
    target = `big ${target}`;
  }

  const isPluralTarget = target.endsWith("s") && !target.endsWith("ss") && !target.endsWith("us");
  const verbSeem = isPluralTarget ? "seem" : "seems";
  const verbAppear = isPluralTarget ? "appear" : "appears";
  const verbFind = isPluralTarget ? "find" : "finds";
  const verbWait = isPluralTarget ? "wait" : "waits";
  const verbNeed = isPluralTarget ? "need" : "needs";
  const verbHave = isPluralTarget ? "have" : "has";
  const verbThink = isPluralTarget ? "think" : "thinks";
  const verbIs = isPluralTarget ? "are" : "is";

  const action = resolveGerundAction(bound);
  const device = /\b(phone|cellphone|telephone|speaker|zoom)\b/i.test(bound.normalizedText)
    ? "phone"
    : /\bcall\b/i.test(bound.normalizedText)
      ? "phone"
      : target === "everyday moment" || target === "decibel" || target === "conversation" || target === "work"
        ? "voice"
        : target;
  const location = roles.location?.canonicalName || (bound.frameId === "frame_light_climate_control" ? "room" : "living room");
  const context = bound.frameId === "frame_conversational_interruption" ? "conversation" : humanContextLabel(bound.contexts);

  let text = template
    .replace(/\{beverage\}/g, beverage)
    .replace(/\{additive\}/g, additive)
    .replace(/\{target\}/g, target)
    .replace(/\{action\}/g, action)
    .replace(/\{device\}/g, device)
    .replace(/\{location\}/g, location)
    .replace(/\{context\}/g, context);

  // Clean determiner collisions, voice/device preposition phrasing, and singular/plural grammar
  text = text
    .replace(/\binto the (?:voice|work|conversation)\b/gi, "across the room")
    .replace(/\ba loud voice call\b|\bthis voice call\b/gi, "this conversation")
    .replace(/\blively voice call\b/gi, "lively conversation")
    .replace(/\bour quiet a\s+/gi, "our quiet ")
    .replace(/\bthe\s+this\b/gi, "this")
    .replace(/\b(the|this|that)\s+(?:the|this|that)\b/gi, "$1")
    .replace(/\b(big|giant|oversized|heavy|heavyweight|large|bulky|massive)\s+big\s+/gi, "$1 ")
    .replace(/\ba\s+an\b/gi, "an")
    .replace(/\ba\s+([aeiou])/gi, "an $1")
    .replace(/\bgigantic\s+giant\b/gi, "giant")
    .replace(/\bgiant\s+big\b/gi, "giant");
  if (isPluralTarget) {
    text = text
      .replace(/\bquietly waited its turn\b/gi, "quietly waited their turn")
      .replace(new RegExp(`\\b${target} is waiting\\b`, "gi"), `${target} are waiting`)
      .replace(new RegExp(`\\b${target} thinks\\b`, "gi"), `${target} think`)
      .replace(new RegExp(`\\b${target} was left\\b`, "gi"), `${target} were left`)
      .replace(new RegExp(`\\b${target} hangs out\\b`, "gi"), `${target} hang out`)
      .replace(new RegExp(`\\b${target} seems\\b`, "gi"), `${target} seem`)
      .replace(new RegExp(`\\b${target} is sitting\\b`, "gi"), `${target} are sitting`)
      .replace(new RegExp(`\\bThat patient ${target}\\b`, "gi"), `Those patient ${target}`)
      .replace(new RegExp(`\\bon that ${target}\\b`, "gi"), `on those ${target}`)
      .replace(new RegExp(`\\bThat ${target}\\b`, "gi"), `Those ${target}`)
      .replace(new RegExp(`\\bthat ${target}\\b`, "gi"), `those ${target}`)
      .replace(new RegExp(`\\bevery wandering ${target}\\b`, "gi"), `all wandering ${target}`);
  } else {
    text = text
      .replace(new RegExp(`\\b${target} appear convinced`, "gi"), `${target} ${verbAppear} convinced`)
      .replace(new RegExp(`\\b${target} seem `, "gi"), `${target} ${verbSeem} `)
      .replace(new RegExp(`\\b${target} need `, "gi"), `${target} ${verbNeed} `)
      .replace(new RegExp(`\\b${target} has settled`, "gi"), `${target} has settled`)
      .replace(new RegExp(`\\b${target} have settled`, "gi"), `${target} ${verbHave} settled`)
      .replace(new RegExp(`\\b${target} wait `, "gi"), `${target} ${verbWait} `)
      .replace(new RegExp(`\\b${target} always find `, "gi"), `${target} always ${verbFind} `)
      .replace(new RegExp(`\\b${target} clearly got attached`, "gi"), `${target} clearly got attached`)
      .replace(/\bThose ([a-z ]+) have settled/gi, "That $1 has settled")
      .replace(/\bThose ([a-z ]+) has settled/gi, "That $1 has settled")
      .replace(/\bwait for brave/gi, `${verbWait} for brave`);
  }

  return capitalizeSentence(text);
}

/**
 * Semantic Candidate Integrity Guard: verifies action polarity, target, quantity, and context.
 */
export function validateCandidateIntegrity(
  angles: { gentle: string; playful: string; exaggerated: string },
  bound: BoundSituation
): boolean {
  const combined = (angles.gentle + " " + angles.playful + " " + angles.exaggerated).toLowerCase();

  // 1. Unresolved placeholder or determiner collision check
  if (/\{[a-z_]+\}/.test(combined)) return false;
  if (/\b(the|this|that)\s+(the|this|that)\b/i.test(combined)) return false;

  // 2. Tone uniqueness check
  if (angles.gentle === angles.playful || angles.playful === angles.exaggerated || angles.gentle === angles.exaggerated) {
    return false;
  }

  // 3. Action Reversal Guard: Active/Repeated actions must NEVER emit soaking/untouched/neglect lines
  if (bound.actionPolarity === "active" || bound.actionPolarity === "repeated" || bound.actionPolarity === "excessive") {
    if (/\b(soaking|bubble bath|unwashed|ignored|waiting for brave|untouched|resting beside the drain)\b/i.test(combined)) {
      return false;
    }
  }

  // 4. Negated/Avoided Dishwashing Guard: Must NEVER emit vigorous scrubbing lines
  if (bound.actionPolarity === "negated" || bound.actionPolarity === "avoided") {
    if (/\b(scrubbing so enthusiastically|elbow grease|shaving mirror|upper-body arm workout)\b/i.test(combined)) {
      return false;
    }
  }

  // 5. Cross-Domain Contamination Guard
  if (bound.frameId === "frame_houseplant_pet_care" && /\bplant\b/i.test(bound.normalizedText) && /\b(cat|feline|dog|puppy)\b/i.test(combined)) {
    return false;
  }
  if (bound.frameId === "frame_empty_container_fridge" && /\b(delivery box|postal fulfillment)\b/i.test(combined)) {
    return false;
  }

  return true;
}

/**
 * Generates three polarity-safe, non-cliché tones directly from PG-HKB constructions.
 */
export function composeFromPgHkb(
  bound: BoundSituation,
  seedModifier: number = 0
): PgHkbCompositionResult | null {
  if (bound.outcomeType === "clarification_needed") {
    return null;
  }

  const seed = Math.abs(seedModifier);
  const opp = bound.humorOpportunity || "compositional_habit";

  let candidateIds = [...(constructionsByOpportunity[opp] || [])];
  if (candidateIds.length < 9 && bound.sensitivity === "ordinary_quirk") {
    for (const extraId of constructionsByOpportunity["compositional_habit"] || []) {
      if (!candidateIds.includes(extraId)) candidateIds.push(extraId);
    }
  }

  const compatible = candidateIds
    .map((id) => constructions[id])
    .filter((c) => {
      if (!c) return false;
      const allowedSens: string[] = c.sens || ["ordinary_quirk"];
      const isSensOk =
        bound.sensitivity === "boundary_concern" || bound.sensitivity === "serious_unsafe"
          ? allowedSens.includes(bound.sensitivity)
          : allowedSens.includes("ordinary_quirk");
      if (!isSensOk) return false;

      // Enforce strict Action-Polarity Compatibility
      const pols: string[] = c.pols || ["active", "repeated"];
      if (!pols.includes(bound.actionPolarity) && opp === c.opp) {
        return false;
      }
      // Also block compositional fallbacks if active scrubbing clashes with soaking words
      if ((bound.actionPolarity === "active" || bound.actionPolarity === "repeated") && c.opp === "dish_soak_omission") {
        return false;
      }
      return true;
    });

  if (compatible.length === 0) return null;

  const pickForTone = (tone: "gentle" | "playful" | "exaggerated") => {
    const oppMatches = compatible.filter((c) => c.t === tone && c.opp === opp);
    if (oppMatches.length > 0) return oppMatches[seed % oppMatches.length];
    const safeCompositional = compatible.filter(
      (c) => c.t === tone && c.opp === "compositional_habit" && (!c.pols || c.pols.includes(bound.actionPolarity))
    );
    const pool = safeCompositional.length > 0 ? safeCompositional : compatible.filter((c) => c.t === tone);
    if (pool.length === 0) return null;
    return pool[seed % pool.length];
  };

  const gC = pickForTone("gentle");
  const pC = pickForTone("playful");
  const eC = pickForTone("exaggerated");

  if (!gC || !pC || !eC) return null;

  const gentle = realizeConstructionTemplate(gC.tmpl, bound);
  const playful = realizeConstructionTemplate(pC.tmpl, bound);
  const exaggerated = realizeConstructionTemplate(eC.tmpl, bound);

  if (!validateCandidateIntegrity({ gentle, playful, exaggerated }, bound)) {
    return null;
  }

  return {
    gentle,
    playful,
    exaggerated,
    usedPgHkb: true,
    provenance: {
      frameId: bound.frameId,
      frameName: bound.frameName,
      resolutionLevel: bound.resolutionLevel,
      actionPolarity: bound.actionPolarity,
      humorOpportunity: opp,
      humorFamilies: [gC.fam, pC.fam, eC.fam],
      boundRoles: Object.fromEntries(
        Object.entries(bound.boundRoles).map(([k, v]) => [k, v.canonicalName])
      ),
      modifiers: bound.modifiers.map((m) => `${m.category}:${m.canonicalValue}->${m.targetConceptName || m.targetRole}`),
      contexts: bound.contexts,
      mechanismIds: [gC.mech, pC.mech, eC.mech],
      constructionIds: [gC.id, pC.id, eC.id],
      sensitivity: bound.sensitivity,
      knowledgeSourcesUsed: bound.knowledgeSourcesUsed,
    },
  };
}
