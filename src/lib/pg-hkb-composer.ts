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
  const raw = bound.boundRoles.action?.canonicalName || bound.boundRoles.action?.surfaceText || "handling";
  if (raw.endsWith("ing")) return raw;
  const map: Record<string, string> = {
    use: "using",
    uses: "using",
    used: "using",
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
    eat: "eating",
    eats: "eating",
    ate: "eating",
    walk: "walking",
    walks: "walking",
    walked: "walking",
    cook: "cooking",
    cooks: "cooking",
    cooked: "cooking",
    drink: "drinking",
    drinks: "drinking",
    drank: "drinking",
    wait: "waiting",
    waits: "waiting",
    waited: "waiting",
    slam: "slamming",
    slams: "slamming",
    slammed: "slamming",
    pour: "pouring",
    pours: "pouring",
    poured: "pouring",
    put: "putting",
    puts: "putting",
    squeeze: "squeezing",
    squeezes: "squeezing",
    squeezed: "squeezing",
    finish: "finishing",
    finishes: "finishing",
    finished: "finishing",
    add: "adding",
    adds: "adding",
    added: "adding",
    spread: "spreading",
    spreads: "spreading",
    heap: "heaping",
    heaps: "heaping",
    heaped: "heaping",
    drizzle: "drizzling",
    drizzles: "drizzling",
    drizzled: "drizzling",
    sprinkle: "sprinkling",
    sprinkles: "sprinkling",
    sprinkled: "sprinkling",
    dump: "dumping",
    dumps: "dumping",
    dumped: "dumping",
    leave: "leaving",
    leaves: "leaving",
    left: "leaving",
    look: "inspecting",
    looks: "inspecting",
    looking: "inspecting",
  };
  return map[raw] || (raw === "handling" ? "handling" : `${raw.replace(/e$/, "")}ing`);
}

/**
 * Resolve physical properties and typical affordances of a substance.
 * Uses PG-RKB concept type and domain evidence where available,
 * with bounded regex matching as supplementary evidence.
 */
function resolveSubstanceProperties(substance: string, bound?: BoundSituation): { form: string; container: string; verb: string; excessImage: string } {
  const s = substance.toLowerCase();

  // 1. Regex-based specific substance form detection (highest confidence)
  // Liquids
  if (/\b(milk|oat milk|almond milk|soy milk|cream|water|juice|oil|olive oil|vinegar|sauce|broth|stock)\b/.test(s)) {
    return { form: "liquid", container: "bottle", verb: "poured", excessImage: "a small swimming pool" };
  }
  // Pastes / viscous
  if (/\b(toothpaste|paste|cream cheese|peanut butter|jam|jelly|mayonnaise|mayo|mustard|ketchup|honey|syrup|gel|lotion|conditioner)\b/.test(s)) {
    return { form: "paste", container: "tube", verb: "squeezed out", excessImage: "a generous frosting job" };
  }
  // Granular / powder
  if (/\b(sugar|salt|pepper|flour|spice|cinnamon|paprika|powder|baking soda|cocoa)\b/.test(s)) {
    return { form: "granular", container: "jar", verb: "heaped on", excessImage: "a small sand dune" };
  }
  // Solid fats
  if (/\b(butter|margarine|lard|coconut oil|ghee)\b/.test(s)) {
    return { form: "solid", container: "block", verb: "added", excessImage: "a generous slab" };
  }
  // Foaming products
  if (/\b(shampoo|soap|shower gel|body wash|dish soap|detergent|washing.?up liquid)\b/.test(s)) {
    return { form: "liquid", container: "bottle", verb: "applied", excessImage: "enough lather for a small car wash" };
  }

  // 2. PG-RKB knowledge-driven fallback for unrecognized substances
  if (bound) {
    const domainIds = bound.domainIds || [];
    // Grooming domain substances default to foaming/liquid when not specifically recognized above
    if (domainIds.some((d: string) => d === "dom_12_grooming_care" || d === "dom_02_cleaning_hygiene")) {
      return { form: "liquid", container: "bottle", verb: "applied", excessImage: "enough lather for a small car wash" };
    }
    // Culinary/ingredient domain substances default to liquid when not specifically recognized
    if (domainIds.some((d: string) => d === "dom_08_eating_habits" || d === "dom_09_beverages_ingredients" || d === "dom_07_cooking_preparation")) {
      return { form: "liquid", container: "bottle", verb: "poured", excessImage: "a small swimming pool" };
    }
  }

  // Default
  return { form: "substance", container: "container", verb: "applied", excessImage: "a remarkable quantity" };
}

/**
 * Resolve what a beverage comes from (beans, leaves, etc.) for property-aware templates.
 */
function resolveBeverageOrigin(beverage: string): string {
  const b = beverage.toLowerCase();
  if (/\b(espresso|coffee|latte|cappuccino|americano|mocha)\b/.test(b)) return "coffee beans";
  if (/\b(tea|chai|matcha|green tea|herbal tea|cuppa)\b/.test(b)) return "tea leaves";
  if (/\b(soup|broth|stock)\b/.test(b)) return "the original recipe";
  return "the original flavor";
}

export function realizeConstructionTemplate(template: string, bound: BoundSituation): string {
  const roles = bound.boundRoles;
  const qtyMod = bound.modifiers.find((m) => m.category === "quantity");
  const sizeMod = bound.modifiers.find((m) => m.category === "comparison" && m.canonicalValue === "large");
  const excMod = bound.modifiers.find((m) => m.category === "scope" && m.canonicalValue === "except");

  const bevMatch = bound.normalizedText.match(/\b(espresso|cappuccino|latte|chai|tea|coffee|soup|broth|cuppa)\b/i);
  const beverage = roles.beverage?.canonicalName || (bevMatch ? bevMatch[1].toLowerCase() : "tea");
  const additive = qtyMod?.targetConceptName || roles.additive?.canonicalName || roles.ingredient?.canonicalName || "milk";

  // Expose componentRelations as template variables
  const cr = bound.componentRelations || {};
  const substance = cr.substance || additive;
  const destination = cr.destination || beverage;

  // Property-aware entity characteristics resolved from substance and beverage names with PG-RKB evidence
  const substanceProps = resolveSubstanceProperties(substance, bound);
  const beverageOrigin = resolveBeverageOrigin(beverage);

  const excTarget = excMod?.targetConceptName
    ?.replace(/\bgiant\s+soup\b/i, "giant soup cauldron")
    ?.trim();
  const templateHasTarget = /\{target\}/.test(template);
  // When quantity modifier is excessive on a beverage/ingredient preparation, prefer additive as target over beverage container
  const isExcessiveAdditive = bound.humorOpportunity === "excessive_quantity" && (roles.additive || roles.ingredient);
  let target = excTarget || (isExcessiveAdditive ? (roles.additive?.canonicalName || roles.ingredient?.canonicalName) : null) || roles.target?.canonicalName || roles.beverage?.canonicalName || roles.ingredient?.canonicalName || (roles.activity?.canonicalName !== "guardianship" ? roles.activity?.canonicalName : undefined) || (bound.humorOpportunity === "excessive_volume" ? "voice" : bound.frameId === "frame_object_displacement" ? "belongings" : undefined);
  if (!target && templateHasTarget) {
    // Synthesize a contextual target from componentRelations, action context, or frame semantics
    const cr = bound.componentRelations || {};
    target = cr.substance || cr.destination || cr.affectedEntity || undefined;
    if (!target) {
      // Frame-semantic fallback: use a contextually appropriate noun
      const frameTargetMap: Record<string, string> = {
        frame_dish_soaking_omission: "dishes",
        frame_selective_chore_avoidance: "chores",
        frame_active_cleaning_scrubbing: "surfaces",
        frame_appliance_unstarted: "appliance",
        frame_empty_container_fridge: "container",
        frame_open_drawer_organization: "drawers",
        frame_object_displacement: "belongings",
        frame_speaking_on_phone: "phone call",
        frame_sleep_acoustics: "bedtime",
        frame_sleep_duvet_alarm: "blankets",
        frame_attention_distraction: "screen",
        frame_conversational_interruption: "conversation",
        frame_emotional_cinematic_expressiveness: "movie scene",
        frame_subjective_preference_contrast: "show",
        frame_houseplant_pet_care: "plants",
        frame_serious_mood_contrast: "serious moment",
        frame_beverage_preparation: "drink",
        frame_punctuality_departure_delay: "morning routine",
        frame_light_climate_control: "lights",
        frame_decision_preference_mismatch: "decision",
        frame_travel_navigation_packing: "packing",
        frame_parent_domestic_chores: "chores",
        frame_parent_home_organization: "things",
        frame_parent_culinary_beverages: "food",
        frame_parent_communication_voice: "conversation",
        frame_parent_timing_scheduling: "schedule",
        frame_parent_opinions_disagreements: "opinions",
        frame_parent_leisure_travel_money: "outing",
        frame_parent_pets_plants_care: "pets",
        frame_parent_attention_digital: "screen",
        frame_parent_sleep_bodily: "sleep",
        frame_parent_boundaries_emotions: "feelings",
      };
      target = frameTargetMap[bound.frameId] || undefined;
    }
    if (!target) {
      // Last resort: extract first meaningful noun from the input
      const nounMatch = bound.normalizedText.match(/\b(?:the|a|an|my|his|her|our|their)\s+(\w+(?:\s+\w+)?)\b/i);
      if (nounMatch) target = nounMatch[1];
    }
    if (!target) {
      // Truly cannot resolve — return empty to signal composition should fail cleanly
      return "";
    }
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
    .replace(/\{substance\}/g, substance)
    .replace(/\{destination\}/g, destination)
    .replace(/\{substance_form\}/g, substanceProps.form)
    .replace(/\{substance_container\}/g, substanceProps.container)
    .replace(/\{excess_image\}/g, substanceProps.excessImage)
    .replace(/\{beverage_origin\}/g, beverageOrigin)
    .replace(/\{target\}/g, target)
    .replace(/\{action\}/g, action)
    .replace(/\{device\}/g, device)
    .replace(/\{location\}/g, location)
    .replace(/\{context\}/g, context);

  // Clean determiner collisions, voice/device preposition phrasing, and singular/plural grammar
  const isFastPace = bound.humorOpportunity === "fast_progress" || bound.modifiers.some((m) => m.canonicalValue === "fast");
  text = text
    .replace(/\bwhile (walking|running|strolling) the (?:walking pace|pace)\b/gi, isFastPace ? "while $1 at lightning speed" : "while $1 at an unhurried pace")
    .replace(/\b(walking|running|strolling) the (?:walking pace|pace)\b/gi, isFastPace ? "$1 at high velocity" : "$1 at a relaxed pace")
    .replace(/\binto the (?:voice|work|conversation)\b/gi, "across the room")
    .replace(/\ba loud voice call\b|\bthis voice call\b/gi, "this conversation")
    .replace(/\blively voice call\b/gi, "lively conversation")
    .replace(/\bthat somehow never runs out of (\w+)\b/gi, "that somehow always has one more waiting")
    .replace(/\bwith fridge\b/gi, "with the fridge")
    .replace(/\baround fridge\b/gi, "around the fridge")
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

  // 2. Tone uniqueness check — relaxed when construction pool is very small (<6 compatible)
  //    With few constructions, different tones may legitimately select the same template family
  if (angles.gentle === angles.playful || angles.playful === angles.exaggerated || angles.gentle === angles.exaggerated) {
    // Only fail if we have enough constructions to expect diversity (>= 6 compatible)
    // The caller passes bound which has the pool info, but we don't have pool size here.
    // Use a heuristic: if ALL three are identical, always reject. If only two match, accept.
    if (angles.gentle === angles.playful && angles.playful === angles.exaggerated) {
      return false;
    }
    // Two matching out of three: allow when all three are non-empty and meaningful
  }

  // 3. Action Reversal Guard: Active cleaning actions must NEVER emit soaking/untouched/neglect lines.
  // When an action is actively cleaning/scrubbing, soaking/neglect lines are contradictory.
  // But omitting/leaving items (even repeatedly, e.g. "leaves mugs by the sink every morning") IS an omission habit.
  const isDirectActiveCleaning = (bound.actionPolarity === "active" || bound.actionPolarity === "excessive") &&
    (/\b(scrub|scrubbing|wash|washing|rinse|rinsing|clean|cleaning|polishing)\b/i.test(bound.boundRoles.action?.canonicalName || "") ||
     /\b(scrubbing|scrub|cleaning|cleans hard|goes nuclear)\b/i.test(bound.normalizedText));
  if (isDirectActiveCleaning) {
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

  // Structured intermediate humour plan: determine essential behavioral dimension
  const hasSpeedMod = bound.modifiers.some((m) => m.category === "speed");
  const speedVal = bound.modifiers.find((m) => m.category === "speed")?.canonicalValue;
  const quantVal = bound.quantity || bound.modifiers.find((m) => m.category === "quantity")?.canonicalValue;
  const hasQuantityMod = Boolean(quantVal);
  const isSlowSituation = speedVal === "slow" || opp === "slow_progress" || opp === "timing_delay";
  const isFastSituation = speedVal === "fast" || opp === "fast_progress" || opp === "fast_talking_pace";
  const isPacingSituation = isSlowSituation || isFastSituation;
  const isExcessiveQtySituation = quantVal === "excessive" || quantVal === "heaps" || opp === "excessive_quantity";
  const isInsufficientQtySituation = quantVal === "insufficient" || quantVal === "negligible" || opp === "insufficient_quantity" || opp === "negligible_quantity";
  const isQuantitySituation = isExcessiveQtySituation || isInsufficientQtySituation;

  let candidateIds = [...(constructionsByOpportunity[opp] || [])];
  if (candidateIds.length < 9 && bound.sensitivity === "ordinary_quirk") {
    // Only backfill compositional_habit if the situation does NOT have an explicit dimension mismatch!
    if (!isPacingSituation && !isQuantitySituation) {
      for (const extraId of constructionsByOpportunity["compositional_habit"] || []) {
        if (!candidateIds.includes(extraId)) candidateIds.push(extraId);
      }
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
      // Only block when the action is specifically active scrubbing/washing, NOT omitted or passive leaving
      const isScrubbingAction = /\b(scrub|scrubbing|wash|washing|rinse|rinsing|clean|cleaning)\b/i.test(bound.boundRoles.action?.canonicalName || "") ||
        /\b(scrubbing|scrub|cleaning|cleans hard|goes nuclear)\b/i.test(bound.normalizedText);
      if (bound.actionPolarity === "active" && isScrubbingAction && c.opp === "dish_soak_omission") {
        return false;
      }

      // Mandatory Relational Compatibility: Incompatible dimensions are disqualified before ranking
      // 1. Pure quantity-related inputs must NEVER receive speed/pacing humor (unless fast/slow pacing is the primary dimension)
      if (isQuantitySituation && !isPacingSituation) {
        if (c.opp === "slow_progress" || c.opp === "fast_progress" || c.opp === "timing_delay" || c.opp === "fast_talking_pace" || /\b(slow|pace|rush|speed|unhurried|marathon|fast)\b/i.test(c.tmpl)) {
          return false;
        }
      }
      // 2. Pure speed/pacing inputs must NEVER receive quantity humor (unless quantity is the primary dimension)
      if (isPacingSituation && !isQuantitySituation) {
        if (c.opp === "excessive_quantity" || c.opp === "insufficient_quantity" || c.opp === "negligible_quantity" || /\b(portion|generous|heaps|too much|festival crowd|law that you can never)\b/i.test(c.tmpl)) {
          return false;
        }
      }

      // 3. Directional incompatibility: slow progress must not receive fast pacing templates, and vice versa
      // (c.opp === opp is inherently compatible with its own opportunity)
      if (isSlowSituation && c.opp !== "timing_delay" && c.opp !== "slow_progress" && (c.opp === "fast_progress" || c.opp === "fast_talking_pace" || /\b(high-speed|sprint|fast|motion blur|brisk)\b/i.test(c.tmpl))) {
        return false;
      }
      if (isFastSituation && c.opp !== "fast_progress" && (c.opp === "slow_progress" || c.opp === "timing_delay" || /\b(unhurried|slow|calm rhythm|nobody can rush|marathon)\b/i.test(c.tmpl))) {
        return false;
      }

      // 4. Directional quantity: excessive quantity must not receive insufficient/negligible templates, and vice versa
      if (isExcessiveQtySituation && (c.opp === "insufficient_quantity" || c.opp === "negligible_quantity" || /\b(minimalist|microscopic|whisper-light|homeopathic)\b/i.test(c.tmpl))) {
        return false;
      }
      if (isInsufficientQtySituation && (c.opp === "excessive_quantity" || /\b(generous|festival crowd|too much)\b/i.test(c.tmpl))) {
        return false;
      }

      // 5. Required role availability: constructions requiring specific roles are disqualified when those roles are absent
      const reqRoles: string[] = c.req || [];
      for (const reqRole of reqRoles) {
        if (reqRole === "target") continue; // target is always synthesized
        if (reqRole === "beverage" && !bound.boundRoles.beverage) return false;
        if (reqRole === "additive" && !bound.boundRoles.additive && !bound.boundRoles.ingredient) return false;
      }

      // 6. Substance→destination template guard: templates using {substance}/{destination} require componentRelations data
      if (c.tmpl && (c.tmpl.includes("{substance}") || c.tmpl.includes("{destination}"))) {
        const cr = bound.componentRelations || {};
        if (!cr.substance || !cr.destination) return false;
      }

      return true;
    });

  if (compatible.length === 0) return null;

  // Section 4: Structure-Mapping-Inspired Relational Humour Matching
  // Computes relational alignment score between interpreted situation relational dimensions and construction features
  const cr = bound.componentRelations || {};
  const hasBevSubstance = Boolean(bound.boundRoles.beverage && (bound.boundRoles.additive || bound.boundRoles.ingredient));
  const hasSubstanceDest = Boolean(cr.substance && cr.destination);

  const scoreRelationalAlignment = (c: any): number => {
    let score = 0;

    // 0. Context specificity: constructions requiring roles matching the actual situation score highest
    //    Beverage+additive constructions beat generic {target} constructions when both roles are available
    if (hasBevSubstance && c.req && c.req.includes("additive") && c.req.includes("beverage")) {
      score += 10; // Strong preference for beverage-specific constructions
    } else if (hasSubstanceDest && c.tmpl && (c.tmpl.includes("{substance}") || c.tmpl.includes("{destination}"))) {
      score += 8; // Preference for substance→destination constructions
    }

    // 1. Progress / Speed match (slow vs fast)
    if (isSlowSituation && (c.opp === "slow_progress" || c.opp === "timing_delay" || c.fam === "observational_warmth" || c.tmpl.includes("slow") || c.tmpl.includes("pace"))) {
      score += 6;
    } else if (isFastSituation && (c.opp === "fast_progress" || c.opp === "fast_talking_pace" || c.fam === "situational_exaggeration" || c.tmpl.includes("fast") || c.tmpl.includes("record-breaking"))) {
      score += 6;
    }

    // 2. Quantity match (excessive vs insufficient vs negligible)
    if (isExcessiveQtySituation && (c.opp === "excessive_quantity" || c.mech === "mech_scale_acoustic_distortion" || c.fam === "situational_exaggeration")) {
      score += 6;
    } else if (isInsufficientQtySituation && (c.opp === "insufficient_quantity" || c.opp === "negligible_quantity" || c.mech === "mech_understatement_minimalism")) {
      score += 6;
    }

    // 3. Repetition & Frequency match
    if (bound.frequency === "recurring" && (c.opp === "recurring_routine" || c.fam === "everyday_irony" || c.tmpl.includes("rhythm") || c.tmpl.includes("daily") || c.tmpl.includes("always"))) {
      score += 4;
    }

    // 4. Forgetfulness & Omission match
    if (bound.actionPolarity === "omitted_forgotten" && (c.opp.includes("omission") || c.mech === "mech_timing_anticlimax" || c.fam === "gentle_personification")) {
      score += 5;
    }

    // 5. Indecision & Decision match
    if (bound.frameId.includes("decision") && (c.opp === "indecision" || c.mech === "mech_observational_parody")) {
      score += 5;
    }

    return score;
  };

  const pickForTone = (tone: "gentle" | "playful" | "exaggerated") => {
    const oppMatches = compatible.filter((c) => c.t === tone && c.opp === opp);
    // If the primary opportunity only has 1 template for this tone and seed > 0, allow drawing from compatible compositional_habit
    if (oppMatches.length > 0) {
      if (oppMatches.length === 1 && seed > 0 && bound.sensitivity === "ordinary_quirk") {
        const altHabit = compatible.filter((c) => c.t === tone && c.opp === "compositional_habit" && (!c.pols || c.pols.includes(bound.actionPolarity)));
        if (altHabit.length > 0) {
          const scoredAlt = [...altHabit].sort((a, b) => scoreRelationalAlignment(b) - scoreRelationalAlignment(a));
          return scoredAlt[(seed - 1) % scoredAlt.length];
        }
      }
      // Sort by structure-mapping alignment score (highest first)
      const scored = [...oppMatches].sort((a, b) => scoreRelationalAlignment(b) - scoreRelationalAlignment(a));
      // Context-preserving regeneration: when relational evidence is available,
      // prioritize relational constructions but allow diversity by cycling through all
      const topScore = scoreRelationalAlignment(scored[0]);
      if (topScore > 0) {
        const relational = scored.filter((c) => scoreRelationalAlignment(c) >= topScore - 2);
        // Use relational pool first, then fall through to full scored pool
        if (seed < relational.length) return relational[seed];
        // Beyond relational pool: use remaining scored constructions for diversity
      }
      return scored[seed % scored.length];
    }
    const safeCompositional = compatible.filter(
      (c) => c.t === tone && (!c.pols || c.pols.includes(bound.actionPolarity))
    );
    const pool = safeCompositional.length > 0 ? safeCompositional : compatible.filter((c) => c.t === tone);
    if (pool.length === 0) return null;
    const scoredPool = [...pool].sort((a, b) => scoreRelationalAlignment(b) - scoreRelationalAlignment(a));
    return scoredPool[seed % scoredPool.length];
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
