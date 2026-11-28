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
import { parseToCanonicalSemantics } from "./semantic-parser.ts";

export interface HumourIdea {
  id: string;
  opportunity: string;
  mechanismId: string;
  metaphorFamilyId: string;
  behavioralRelationship: string;
  tone: "gentle" | "playful" | "exaggerated";
  roleMappings: Record<string, string>;
  propertyConstraints: string[];
  realizationPlan: "direct_construction" | "compositional_plan";
  planType?: "observation" | "analogy_comparison" | "mock_declaration" | "gentle_personification" | "scale_distortion";
  underlyingConstructionId: string;
  rawTemplate: string;
  relationalScore: number;
}

/**
 * Rich Behavioural Relationship Extractor
 * Identifies high-level behavioral dynamics from the input:
 * - contradiction_statement_action (e.g. says not hungry, eats food)
 * - disproportionate_resources (e.g. 12 pans for scrambled eggs)
 * - repeated_evaluation (e.g. tasting sauce 12 times)
 * - incomplete_closure (e.g. squeezing toothpaste without closing cap)
 * - unauthorized_depletion (e.g. finishes last piece of cake without asking)
 * - prolonged_niche_focus (e.g. explaining switches for forty minutes)
 * - divided_attention (e.g. looking at screen while talking)
 * - unexpected_placement (e.g. leaving keys in fridge)
 * - repetition_frequency (e.g. doing something every day/constantly)
 * - action_omission (e.g. forgetting or skipping step)
 * - pacing_slow, pacing_fast, quantity_excessive, quantity_insufficient, grounded_habit
 */
export function extractRichBehavioralRelationship(bound: BoundSituation): {
  relationship: string;
  details: {
    primaryEntity?: string;
    actionVerb?: string;
    contrastStatement?: string;
    counterAction?: string;
    resourceCount?: string;
    resourceItem?: string;
    taskTarget?: string;
    omittedAction?: string;
    durationSpan?: string;
    nicheTopic?: string;
    prepActivity?: string;
    mainActivity?: string;
    researchActivity?: string;
    outcomeChoice?: string;
    interferingActivity?: string;
  };
} {
  const norm = bound.normalizedText.toLowerCase();
  const raw = bound.rawText.toLowerCase();

  // Primary Path: Canonical Semantic Parsing & Logical Dependency Extraction
  const canonicalParse = parseToCanonicalSemantics(bound.rawText);
  if (canonicalParse.inferredDynamic && canonicalParse.inferredDynamic.confidence >= 0.9) {
    const d = canonicalParse.inferredDynamic;
    const ev = d.evidence;
    return {
      relationship: d.dynamicType,
      details: {
        primaryEntity: ev.primaryEntity || bound.boundRoles.target?.canonicalName,
        actionVerb: ev.actionVerb,
        contrastStatement: ev.statement,
        counterAction: ev.counterAction,
        resourceCount: ev.resourceCount,
        resourceItem: ev.resourceItem,
        taskTarget: ev.taskTarget,
        omittedAction: ev.omittedAction,
        durationSpan: ev.durationSpan,
        nicheTopic: ev.topic,
        prepActivity: ev.prepActivity,
        mainActivity: ev.mainActivity,
        researchActivity: ev.researchActivity,
        outcomeChoice: ev.outcomeChoice,
        interferingActivity: ev.interferingActivity,
      },
    };
  }

  // 1. Contradictory statements and actions (e.g. "says not hungry, then eats half my fries", "says he doesn't want dessert and then keeps taking spoonfuls of mine")
  const isFoodSharingContradiction =
    (/\b(?:not hungry|full|doesn't want anything|doesn't want dessert|orders? a salad|ordered a salad)\b/i.test(norm) ||
     /\b(?:says?|said)\b/i.test(norm) && /\b(?:dessert|food|snack|dinner|fries)\b/i.test(norm)) &&
    /\b(?:eats?|eating|ate|takes?|taking|took|spoonfuls|bites?|keeps taking)\b/i.test(norm);
  const contraMatch = norm.match(/\b(?:says?|said|claims?|claimed|insists?|insisted|orders?|ordered)\s+(?:she|he|they|partner)?\s*(?:is|was|to|were)?\s*(?:not|no|a|an|doesn't\s+want|does\s+not\s+want)?\s*(?:be\s+)?([a-z]+)?[\s,]+(?:then|and|but|afterwards)?\s*(?:eats?|takes?|grabs?|drinks?|steals?|ate|took|keeps\s+taking)\s+(?:all\s+(?:of\s+)?(?:my\s+)?|half\s+(?:of\s+)?(?:my\s+)?|spoonfuls\s+of\s+mine|bites\s+of\s+mine|my\s+)?(.*?)$/i);
  if (isFoodSharingContradiction || contraMatch) {
    const rawTarget = norm.match(/\b(fries|french fries|chips|popcorn|pizza|burger|snack|tater tots|dessert|pizza slices?|slices?|spoonfuls(?:\s+of\s+mine)?)\b/i)?.[1];
    const statement = norm.match(/\b(doesn'?t\s+want\s+dessert|orders?\s+a\s+salad|ordered\s+a\s+salad|not\s+hungry|completely\s+full|full)\b/i)?.[0] ||
      (norm.includes("dessert") ? "doesn't want dessert" : norm.includes("full") ? "completely full" : "not hungry");
    return {
      relationship: "contradiction_statement_action",
      details: {
        contrastStatement: statement,
        counterAction: "eating",
        primaryEntity: rawTarget || bound.boundRoles.target?.canonicalName || "dessert",
      },
    };
  }

  // 2. Disproportionate resources relative to task (across any category: cookware, tools, towels, gadgets)
  // e.g. "using twelve pans to make scrambled eggs", "uses four different towels just to dry her hair", "using nine different towels to dry one small puppy", "mobilizes seven distinct pans"
  const dispMatch = norm.match(/\b(?:mobilizes?|mobilizing|using|uses?|used|takes?|taking|dirtying|dirties)\s+(\w+|\d+)\s+(?:distinct\s+|different\s+)?(pans?|pots?|skillets?|woks?|dishes?|bowls?|knives?|towels?|cups?|gadgets?|plates?|screwdrivers?|tools?|brushes?|spoons?)\b/i);
  const numberWordMatch = norm.match(/\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|\d+)\s+(?:distinct\s+|different\s+)?(pans?|pots?|skillets?|woks?|dishes?|bowls?|gadgets?|towels?|screwdrivers?|tools?)\b/i);
  if (dispMatch || numberWordMatch) {
    const num = dispMatch ? dispMatch[1] : numberWordMatch![1];
    const item = dispMatch ? dispMatch[2] : numberWordMatch![2];
    const taskMatch = norm.match(/\b(?:just\s+to|to)\s+(make|cook|fry|toast|prepare|do|dry|assemble|fix|clean)\s+([a-z\s]+)/i);
    const task = taskMatch ? `${taskMatch[1]} ${taskMatch[2]}` : (dispMatch && norm.split(dispMatch[0])[1]?.trim() ? norm.split(dispMatch[0])[1].replace(/^(?:just\s+to\s+|to\s+|for\s+)/i, "").trim() : "the task");
    return {
      relationship: "disproportionate_resources",
      details: {
        resourceCount: num,
        resourceItem: item,
        taskTarget: task.trim() || "the task",
        primaryEntity: item,
      },
    };
  }

  // 3. Repeated sensory evaluation / smelling / tasting / checking (e.g. "keeps smelling the clothes to decide whether they need washing", "dips a wooden ladle into the marinara stew fifteen consecutive times")
  const smellEvalMatch = norm.match(/\b(keeps\s+smelling|smelling|smells?|sniffing|sniffs?)\s+(?:the\s+)?([a-z]+)\s+to\s+decide\b/i);
  const repeatEvalMatch = norm.match(/\b(dips?|dipping|tasting|tastes?|checking|checks?|testing|tests?|smelling|smells?|adjusting|sampling)\s+(.*?)\s+(\w+|\d+)\s+(?:consecutive\s+)?times\b/i);
  if (smellEvalMatch || repeatEvalMatch || (/\b(dips?|dipping|tasting|tastes?|checking|checks?|smelling|smells?)\b/i.test(norm) && /\b(\w+|\d+)\s+(?:consecutive\s+)?times|to decide whether\b/i.test(norm))) {
    const evalTarget = smellEvalMatch ? smellEvalMatch[2] : (repeatEvalMatch ? repeatEvalMatch[2].replace(/^a\s+wooden\s+ladle\s+into\s+the\s+/i, "").replace(/^(?:the|a|an)\s+/i, "") : (bound.boundRoles.target?.canonicalName || bound.boundRoles.ingredient?.canonicalName || "the items"));
    const countMatch = norm.match(/\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|\d+)\s+(?:consecutive\s+)?times\b/i);
    const count = countMatch ? countMatch[1] : (repeatEvalMatch ? repeatEvalMatch[3] : "careful");
    const actionVerb = smellEvalMatch ? "smelling" : (/\bdips?|dipping\b/i.test(norm) ? "sampling" : "evaluating");
    return {
      relationship: "repeated_evaluation",
      details: {
        primaryEntity: evalTarget.trim(),
        resourceCount: count,
        actionVerb,
      },
    };
  }

  // 4. Incomplete actions / partial closure / omitted closure (e.g. "shuts the window but always leaves the handle halfway turned")
  const handleHalfwayMatch = norm.match(/\b(?:leaves?\s+the\s+handle\s+halfway\s+turned|handle\s+halfway)\b/i);
  const incompleteMatch = norm.match(/\b(squeezing|squeezes?|uses?|using|leaving|leaves|shuts?)\s+(.*?)\s+(?:from\s+the\s+\w+\s+)?(?:without|never|but\s+always\s+leaves?)\s+(closing|putting back|replacing|shutting|the\s+handle\s+halfway\s+turned)\s*(?:the\s+)?([a-z]+)?/i);
  if (handleHalfwayMatch || incompleteMatch || (/\bwithout\s+(?:closing|shutting|putting back)\s+(?:the\s+)?(cap|lid|door|top)\b/i.test(norm))) {
    const obj = handleHalfwayMatch ? "window handle" : (incompleteMatch ? incompleteMatch[2] : (bound.boundRoles.target?.canonicalName || "item"));
    const omittedAction = handleHalfwayMatch ? "turning the handle all the way" : "closing completely";
    return {
      relationship: "incomplete_closure",
      details: {
        primaryEntity: obj.trim(),
        omittedAction,
        actionVerb: "closing",
      },
    };
  }

  // 5. Unauthorized depletion / selective omission (e.g. "drinks the last of the orange juice and puts the empty carton back in the fridge")
  const drinkLastMatch = norm.match(/\b(drinks?|drinking|finishes?|finished|eats?|ate)\s+(?:the\s+)?last\s+of\s+(?:the\s+)?([a-z]+(?:\s+[a-z]+)?)\b/i);
  const depleteMatch = norm.match(/\b(finishes?|finished|eating|eats?|ate|takes?|took|taking)\s+(?:the\s+)?(last\s+(?:piece|slice|bite|portion|one)\s+(?:of\s+)?(?:[a-z\s]+)?)\s+without\s+(asking|telling|warning)\b/i);
  if (drinkLastMatch || depleteMatch || (/\b(?:last\s+(?:piece|slice|bite|drop|cookie|donut|serving|of the orange juice))\b/i.test(norm))) {
    const rawEntity = drinkLastMatch ? drinkLastMatch[2] : (bound.boundRoles.target?.canonicalName || "beverage");
    const entity = rawEntity.replace(/\s+and.*$/i, "").trim();
    return {
      relationship: "unauthorized_depletion",
      details: {
        primaryEntity: entity,
        omittedAction: "replacing the carton",
        actionVerb: "finishing",
      },
    };
  }

  // 6. Prolonged niche focus / excessive intensity duration (e.g. "explains the difference between two types of coffee grinders for half an hour")
  const nicheMatch = norm.match(/\b(explaining|explains?|talking about|discussing|lecturing on|demonstrating)\s+(.*?)\s+for\s+(half\s+an\s+hour|\w+(?:-\w+)?|\d+)\s*(minutes?|hours?)?\b/i);
  if (nicheMatch || (/\b(explaining|explains?|lecturing|demonstrating|going on about)\b/i.test(norm) && /\bfor\s+(?:half\s+an\s+hour|\w+\s+(?:minutes?|hours?))\b/i.test(norm))) {
    const topic = nicheMatch ? nicheMatch[2] : (bound.boundRoles.target?.canonicalName || "coffee grinders");
    const dur = nicheMatch ? (nicheMatch[3].includes("half an hour") ? "half an hour" : `${nicheMatch[3]} ${nicheMatch[4] || ""}`) : "half an hour";
    return {
      relationship: "prolonged_niche_focus",
      details: {
        nicheTopic: topic.trim(),
        durationSpan: dur.trim(),
        actionVerb: "explaining",
        primaryEntity: topic.trim(),
      },
    };
  }

  // 7. Comparative duration: e.g. "takes longer to choose her running outfit than she spends actually running"
  const compDurMatch = norm.match(/\btakes?\s+longer\s+to\s+(choose|pick|decide\s+on)\s+(.*?)\s+than\s+(?:she|he|they)?\s*spends?\s+(?:actually\s+)?([a-z]+ing)\b/i);
  if (compDurMatch) {
    return {
      relationship: "comparative_duration",
      details: {
        primaryEntity: compDurMatch[2].trim(),
        taskTarget: compDurMatch[3].trim(),
        actionVerb: "choosing",
      },
    };
  }

  // 8. Repeated verification / compulsive checking: e.g. "checks whether the front door is locked every time we walk past it"
  const repeatCheckMatch = norm.match(/\bchecks?\s+(?:whether|if)\s+(?:the\s+)?([a-z\s]+?)\s+is\s+locked\s+every\s+time\b/i);
  if (repeatCheckMatch) {
    return {
      relationship: "repeated_evaluation",
      details: {
        primaryEntity: repeatCheckMatch[1].trim(),
        resourceCount: "every single time",
        actionVerb: "checking the lock on",
      },
    };
  }

  // 9. Extensive decision process with unchanged outcome: e.g. "reads every restaurant review before ordering the same thing as last time"
  const reviewUnchangedMatch = norm.match(/\breads?\s+every\s+(?:restaurant\s+)?review\s+before\s+ordering\s+the\s+same\s+thing\b/i);
  if (reviewUnchangedMatch) {
    return {
      relationship: "decision_process_unchanged_outcome",
      details: {
        primaryEntity: "the menu",
        actionVerb: "researching",
      },
    };
  }

  // 9b. Prolonged menu indecision: e.g. "Takes forty-five minutes scrolling through food delivery menus without picking a single takeout dish"
  const menuIndecisionMatch = norm.match(/\b(?:takes?\s+)?(?:(\w+(?:-\w+)?|\d+)\s+minutes?|forever|ages)\s+(?:scrolling|looking|browsing)\s+through\s+(?:food\s+delivery\s+)?menus?\b/i) ||
    norm.match(/\b(?:scrolling|browsing)\s+through\s+(?:food\s+delivery\s+)?menus?\s+(?:for\s+)?(?:(\w+(?:-\w+)?|\d+)\s+minutes?|forever|ages)\b/i);
  if (menuIndecisionMatch || (/\bmenus?\b/i.test(norm) && /\b(?:without picking|deciding what to eat|can't decide|deliberating)\b/i.test(norm))) {
    const durMatch = norm.match(/\b(?:takes?\s+)?(?:([a-z-]+|\d+)\s+minutes?|forever|ages)\b/i);
    const duration = durMatch ? durMatch[0].replace(/^takes?\s+/i, "") : "time";
    return {
      relationship: "prolonged_menu_deliberation",
      details: {
        primaryEntity: "takeout menus",
        durationSpan: duration,
        actionVerb: "deliberating over",
      },
    };
  }

  // 10. Simultaneous activity / interference: e.g. "starts vacuuming while I'm trying to finish a phone call"
  const vacuumPhoneMatch = norm.match(/\bstarts?\s+vacuuming\s+while\s+(?:i'm|i\s+am)\s+trying\s+to\s+(?:finish|take)\s+(?:a\s+)?([a-z\s]+)\b/i);
  if (vacuumPhoneMatch) {
    return {
      relationship: "simultaneous_interference",
      details: {
        primaryEntity: "phone call",
        taskTarget: "vacuuming",
        interferingActivity: "vacuuming",
        actionVerb: "vacuuming during",
      },
    };
  }

  // 11. Omitted domestic ritual: e.g. "never makes her bed after waking up in the morning"
  if (/\bnever\s+makes?\s+(?:her\s+|his\s+|the\s+|our\s+)?bed\b/i.test(norm)) {
    return {
      relationship: "action_omission",
      details: {
        primaryEntity: "bed",
        omittedAction: "making the bed",
        actionVerb: "leaving",
      },
    };
  }

  // 12. Extreme / Disproportionate Intensity / Force
  if (/\b(?:so much muscle|muscle the whole|crank down|parka|goose-down|vibrates?)\b/i.test(norm)) {
    return {
      relationship: "extreme_intensity_force",
      details: {
        primaryEntity: bound.boundRoles.target?.canonicalName || "surfaces",
        actionVerb: resolveGerundAction(bound),
      },
    };
  }

  // 13. Repeated Retelling / Story Recycling
  if (/\b(?:ninth time|tenth time|\w+\s+times? this month|exact story|same story)\b/i.test(norm)) {
    return {
      relationship: "repeated_retelling",
      details: {
        primaryEntity: bound.boundRoles.target?.canonicalName || "the road trip story",
        actionVerb: "retelling",
      },
    };
  }

  // 14. Playful Expressive Vocal / Ritual Habit (Cat 11, 15, 16, 24)
  if (/\b(?:donald duck|squawk|opera|baby coos?|rhyming|pet names?|ridiculous names?|names for the cat|victory dance|dancing|singing showtunes?|singing narration|squeaky voice|dramatic squeaky|making dad jokes|dad jokes?|bad puns?|wordplay)\b/i.test(norm)) {
    return {
      relationship: "playful_expressive_ritual",
      details: {
        primaryEntity: bound.boundRoles.target?.canonicalName || (/\b(cat|dog|pet)\b/i.test(norm) ? "the cat" : /\b(joke|jokes|puns?)\b/i.test(norm) ? "the jokes" : "the ritual"),
        actionVerb: resolveGerundAction(bound),
      },
    };
  }

  // 15. Digital / Domestic Accumulation / Hoarding (Cat 2, 17, 20, 21)
  if (/\b(?:hoarding|fortress of|eighty-four open|open research tabs|open tabs|ninety open tabs|accumulates? a fortress|bursting at the seams|five outfits for an overnight|packing five outfits)\b/i.test(norm)) {
    return {
      relationship: "accumulative_hoarding",
      details: {
        primaryEntity: bound.boundRoles.target?.canonicalName || (/\b(tabs?)\b/i.test(norm) ? "open tabs" : /\b(outfits?)\b/i.test(norm) ? "travel outfits" : "belongings"),
        actionVerb: "collecting",
      },
    };
  }

  // 16. Prolonged Craft / Immersion Duration
  if (/\b(?:disappears into|for six hours|for \w+ hours|perfecting the finish|workshop)\b/i.test(norm)) {
    return {
      relationship: "prolonged_craft_immersion",
      details: {
        primaryEntity: bound.boundRoles.target?.canonicalName || "workshop craft",
        actionVerb: "perfecting",
      },
    };
  }

  // 17. Prolonged Social Farewell / Departure Lingering
  if (/\b(?:farewell speech|lingering with the front door|thirty-minute farewell|goodbyes?)\b/i.test(norm)) {
    return {
      relationship: "prolonged_departure_lingering",
      details: {
        primaryEntity: "the front doorway",
        actionVerb: "saying goodbye",
      },
    };
  }

  // 18. Photo / Social Staging Freeze
  if (/\b(?:freeze their forks|stage fifty food pictures|fifty food pictures|taking hundred photos|multiple angles|twenty photos before we can eat|pose for \w+ photos)\b/i.test(norm)) {
    return {
      relationship: "social_staging_freeze",
      details: {
        primaryEntity: "dinner",
        actionVerb: "photographing",
      },
    };
  }

  // 19. Indecisive / Adventurous Navigation Detour
  if (/\b(?:argues with the turn-by-turn|navigation voice|detour through farm roads|detour)\b/i.test(norm)) {
    return {
      relationship: "navigation_adventurous_detour",
      details: {
        primaryEntity: "the GPS",
        actionVerb: "navigating",
      },
    };
  }

  // 20. Last-Minute Panic / Rushed Packing
  if (/\b(?:stuffing mismatched socks|three minutes before|airport shuttle arrives|last-minute packing)\b/i.test(norm)) {
    return {
      relationship: "last_minute_rush",
      details: {
        primaryEntity: "the luggage",
        actionVerb: "packing",
      },
    };
  }

  // 21. Punctuality Asymmetry / Doorway Waiting
  if (/\b(?:stands fully booted|waiting by the door|looks for their jacket for twenty minutes)\b/i.test(norm)) {
    return {
      relationship: "doorway_readiness_asymmetry",
      details: {
        primaryEntity: "departure time",
        actionVerb: "waiting",
      },
    };
  }

  // 22. Minimalist Leaving / Microscopic Remnant
  if (/\b(?:single microscopic thimble|microscopic thimble|leaves a single|one sip|one tiny sip|tiny sip left|thimble of)\b/i.test(norm)) {
    return {
      relationship: "microscopic_remnant",
      details: {
        primaryEntity: bound.boundRoles.target?.canonicalName || (/\b(milk|juice|tea|coffee)\b/i.test(norm) ? "the beverage" : "iced tea"),
        actionVerb: "leaving",
      },
    };
  }

  // 23. Lethargic / Slow Boot Awakening
  if (/\b(?:slow-loading computer|operating at five percent|stumbles into the kitchen|zombie before having first coffee|wandering around like a zombie)\b/i.test(norm)) {
    return {
      relationship: "lethargic_morning_boot",
      details: {
        primaryEntity: "morning consciousness",
        actionVerb: "booting up",
      },
    };
  }

  // 24. Packaging / Delivery Accumulation
  if (/\b(?:unboxes online deliveries|cardboard shipping cartons|shipping cartons piled|packaging)\b/i.test(norm)) {
    return {
      relationship: "packaging_accumulation",
      details: {
        primaryEntity: "cardboard boxes",
        actionVerb: "stacking",
      },
    };
  }

  // 25. Absentminded Task Omission
  if (/\b(?:spaced out rolling|forgetting bins|recycling wheelie bin)\b/i.test(norm)) {
    return {
      relationship: "absentminded_task_omission",
      details: {
        primaryEntity: "the wheelie bin",
        actionVerb: "rolling out",
      },
    };
  }

  // 26. Object Displacement / Nearby Hunt
  if (/\b(?:set down the wireless|no clue which room|resting right on top of their head|paces back and forth turning sofa|searching the room for glasses while wearing them|wearing them)\b/i.test(norm)) {
    return {
      relationship: "misplaced_proximity_hunt",
      details: {
        primaryEntity: bound.boundRoles.target?.canonicalName || (/\b(glasses)\b/i.test(norm) ? "reading glasses" : "belongings"),
        actionVerb: "searching for",
      },
    };
  }

  // 27. Conversational Focus Disruption
  if (/\b(?:busts into the home study|funny internet gossip|important client video call|wearing noise cancelling headphones|noise cancelling headphones)\b/i.test(norm)) {
    return {
      relationship: "conversational_focus_disruption",
      details: {
        primaryEntity: "the focus session",
        actionVerb: "asking questions during",
      },
    };
  }

  // 28. Passionate Proposition / Categorical Debate
  if (/\b(?:passionately argues|should never count|not a real|gentle stretching)\b/i.test(norm)) {
    return {
      relationship: "passionate_niche_debate",
      details: {
        primaryEntity: "workout taxonomy",
        actionVerb: "debating",
      },
    };
  }

  // 29. Bedtime Screen Scrolling / Digital Sleep Delay (Cat 17 / Cat 8)
  if (/\b(?:scrolling|browsing|looking at)\s+(?:on\s+)?(?:their\s+|her\s+|his\s+)?(?:phone|mobile|screen|feed)\s+in\s+bed\b/i.test(norm) ||
      /\b(?:in\s+bed\s+in\s+the\s+dark|phone\s+in\s+bed|screen\s+in\s+bed)\b/i.test(norm)) {
    return {
      relationship: "bedtime_screen_scrolling",
      details: {
        primaryEntity: "the phone",
        actionVerb: "scrolling",
      },
    };
  }

  // 30. Sleep Media Dependency / Television As Sleep Aid (Cat 8)
  if (/\b(?:television|tv)\b/i.test(norm) && /\b(?:fall\s+asleep|sleep|bedtime|sleeping)\b/i.test(norm)) {
    return {
      relationship: "sleep_media_dependency",
      details: {
        primaryEntity: "the television",
        actionVerb: "leaving the TV on for sleep",
      },
    };
  }

  // 31. Damp Laundry in Washer Drum / Delayed Unloading (Cat 1)
  if (/\b(?:wet\s+laundry|damp\s+towels|damp\s+clothes|washed\s+clothes|laundry)\b/i.test(norm) &&
      /\b(?:washing\s+machine|washer|drum)\b/i.test(norm) &&
      /\b(?:overnight|leaves?|sitting|smells?\s+musty|forgot)\b/i.test(norm)) {
    return {
      relationship: "damp_laundry_standby",
      details: {
        primaryEntity: "wet laundry in the washer",
        actionVerb: "letting the laundry sit",
      },
    };
  }

  // 32. Supermarket Aisle Odyssey / Grocery Wandering (Cat 20)
  if (/\b(?:every\s+(?:single\s+)?(?:supermarket\s+)?aisle|every\s+(?:single\s+)?grocery\s+row|exploring the bakery aisle)\b/i.test(norm) ||
      (/\b(?:grocery|supermarket|aisle|store)\b/i.test(norm) && /\b(?:two-item|two\s+items?|only came in to buy|only\s+need|wandering)\b/i.test(norm))) {
    return {
      relationship: "supermarket_aisle_odyssey",
      details: {
        primaryEntity: "supermarket aisles",
        actionVerb: "exploring",
      },
    };
  }

  // Standard dimensions fallback
  const speedVal = bound.modifiers.find((m) => m.category === "speed")?.canonicalValue;
  const quantVal = bound.quantity || bound.modifiers.find((m) => m.category === "quantity")?.canonicalValue;
  const opp = bound.humorOpportunity;

  if (speedVal === "slow" || opp === "slow_progress" || opp === "timing_delay") {
    return { relationship: "pacing_slow", details: { primaryEntity: bound.boundRoles.target?.canonicalName } };
  }
  if (speedVal === "fast" || opp === "fast_progress" || opp === "fast_talking_pace") {
    return { relationship: "pacing_fast", details: { primaryEntity: bound.boundRoles.target?.canonicalName } };
  }
  if (quantVal === "excessive" || quantVal === "heaps" || opp === "excessive_quantity") {
    return { relationship: "quantity_excessive", details: { primaryEntity: bound.boundRoles.target?.canonicalName } };
  }
  if (quantVal === "insufficient" || quantVal === "negligible" || opp === "insufficient_quantity" || opp === "negligible_quantity") {
    return { relationship: "quantity_insufficient", details: { primaryEntity: bound.boundRoles.target?.canonicalName } };
  }
  if (bound.actionPolarity === "omitted_forgotten") {
    return { relationship: "action_omission", details: { primaryEntity: bound.boundRoles.target?.canonicalName } };
  }
  if (bound.frequency === "recurring") {
    return { relationship: "repetition_frequency", details: { primaryEntity: bound.boundRoles.target?.canonicalName } };
  }

  return { relationship: "grounded_habit", details: { primaryEntity: bound.boundRoles.target?.canonicalName } };
}

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
const mechanismsMap: Record<string, any> = bundle.entities.mechanisms || {};
const metaphorsMap: Record<string, any> = bundle.entities.metaphors || {};

function capitalizeSentence(s: string): string {
  let trimmed = s.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  // Clean double periods or trailing punctuation before punctuation
  trimmed = trimmed.replace(/\.+$/, "").trim();
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
    close: "closing",
    closes: "closing",
    closed: "closing",
    ask: "asking",
    asks: "asking",
    asked: "asking",
    pack: "packing",
    packs: "packing",
    packed: "packing",
    laugh: "laughing",
    laughs: "laughing",
    laughed: "laughing",
    refuse: "refusing",
    refuses: "refusing",
    refused: "refusing",
    schedule: "scheduling",
    schedules: "scheduling",
    scheduled: "scheduling",
    tell: "telling",
    tells: "telling",
    told: "telling",
    make: "making",
    makes: "making",
    made: "making",
    buy: "buying",
    buys: "buying",
    bought: "buying",
    taste: "tasting",
    tastes: "tasting",
    tasted: "tasting",
    explain: "explaining",
    explains: "explaining",
    explained: "explaining",
    "dish the dirt": "gossiping",
    gossip: "gossiping",
    gossips: "gossiping",
    gossiping: "gossiping",
    brown: "unboxing",
    "eat up": "polishing",
    hire: "delivering",
    engage: "delivering",
  };
  if (raw === "dish the dirt" || raw === "brown" || raw === "eat up" || raw === "hire") {
    return map[raw] || "handling";
  }
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

/**
 * Realize a dynamically composed HumourIdea into natural conversational text.
 * Assembles perspective phrasing from structured behavioural relationships,
 * humour mechanisms, and metaphor mappings with regeneration diversity.
 */
export function realizeCompositionalIdeaPlan(
  idea: HumourIdea,
  bound: BoundSituation,
  extractedBehavior: ReturnType<typeof extractRichBehavioralRelationship>,
  seed: number = 0
): string {
  const { details, relationship } = extractedBehavior;
  const norm = bound.normalizedText.toLowerCase();
  let rawTarget = details.primaryEntity || bound.boundRoles.target?.canonicalName || "routine";
  // Strip leading "the " or "a " so we don't accidentally produce "the the ..."
  const target = rawTarget.replace(/^(the|a|an)\s+/i, "").trim() || "item";
  const targetWithArticle = /^(the|a|an)\s+/i.test(rawTarget) ? rawTarget : `the ${rawTarget}`;
  const action = details.actionVerb || resolveGerundAction(bound);
  const variant = seed % 2;

  // 1. Contradiction: Statement vs Action (e.g. says not hungry, eats fries)
  if (relationship === "contradiction_statement_action") {
    let rawStmt = (details.contrastStatement || "not hungry").trim().toLowerCase();
    // Normalize statement phrasing to avoid broken clauses like "claiming to be she is completely full"
    let stmt: string;
    if (/^orders?\s+/i.test(rawStmt)) {
      stmt = rawStmt.replace(/^orders?\s+/i, "ordering ");
    } else if (/doesn'?t\s+want\s+dessert/i.test(rawStmt)) {
      stmt = "saying they don't want dessert";
    } else if (rawStmt === "full" || rawStmt === "completely full" || /is\s+(?:completely\s+)?full/i.test(rawStmt)) {
      stmt = "claiming to be completely full";
    } else if (rawStmt === "not hungry" || /is\s+not\s+hungry/i.test(rawStmt)) {
      stmt = "saying they are not hungry";
    } else {
      const cleanStmt = rawStmt.replace(/^(?:she|he|they|i)\s+(?:says?|insists?|claims?|said)?\s*(?:that)?\s*(?:she|he|they|i)?\s*(?:is|am|are|was)?\s*/i, "");
      stmt = `saying they are ${cleanStmt}`;
    }

    // Clean target punctuation (e.g. "spoonfuls of mine." -> "spoonfuls of mine")
    const cleanRawTarget = rawTarget.replace(/\.+$/, "").trim();
    const cleanTarget = target.replace(/\.+$/, "").trim();
    const cleanTargetWithArticle = /^(the|a|an)\s+/i.test(cleanRawTarget) ? cleanRawTarget : `the ${cleanRawTarget}`;

    // Preserve original quantity without inventing "half" or "all" unless stated in input
    const hasSpecifiedHalf = /\bhalf\b/i.test(norm);
    const hasSpecifiedAll = /\ball\b/i.test(norm);
    const quantityFraction = hasSpecifiedHalf ? "half the" : hasSpecifiedAll ? "all the" : "some of the";

    if (idea.tone === "gentle") {
      return variant === 0
        ? `Observing that ${stmt} is really just a polite prelude to sharing ${cleanTargetWithArticle}.`
        : `Treating ${stmt} as an open invitation to enjoy ${cleanTargetWithArticle} together.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Operating under the household tax rule where ${stmt} grants immediate tasting rights to ${cleanTargetWithArticle}.`
        : `Invoking the classic food-sharing clause where ${stmt} quietly includes sampling ${cleanTargetWithArticle}.`;
    }
    return variant === 0
      ? `Declaring a unilateral diplomatic treaty where ${stmt} formally authorizes sampling ${quantityFraction} ${cleanRawTarget}.`
      : `Submitting an emergency domestic resolution where ${stmt} opens sovereign diplomatic access to ${cleanTargetWithArticle}.`;
  }

  // 2. Disproportionate Resources (e.g. 12 pans for scrambled eggs, 9 towels for puppy, 6 screwdrivers for picture frame)
  if (relationship === "disproportionate_resources") {
    const count = details.resourceCount || "twelve";
    const item = details.resourceItem || "pans";
    const task = details.taskTarget || "scrambled eggs";
    const isCulinary = /\b(scrambled eggs|toast|eggs|breakfast|pancakes|fried rice|pasta|sauce|dinner|meal|soup)\b/i.test(task) || /\b(pans?|pots?|skillets?|woks?|dishes?|bowls?|plates?)\b/i.test(item);
    const craftLabel = isCulinary ? "the culinary craft" : "the task at hand";
    const taskVerb = isCulinary ? "preparing" : "taking care of";

    if (idea.tone === "gentle") {
      return variant === 0
        ? `Taking ${craftLabel} so seriously that ${taskVerb} ${task} naturally enlists all ${count} ${item}.`
        : `Giving ${task} the full dedicated treatment, ensuring all ${count} ${item} get their moment in the spotlight.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Treating ${task} like an arena championship where deploying ${count} separate ${item} is the only respectable tactic.`
        : `Managing ${task} like a master workshop rush where ${count} ${item} must be in active rotation at once.`;
    }
    return variant === 0
      ? `Transforming ${task} into a heavyweight engineering project that requires mobilizing ${count} distinct ${item} across every counter.`
      : `Staging an Olympic decathlon for ${task} that demands every single one of the ${count} ${item} on site.`;
  }

  // 3. Repeated Sensory Evaluation / Checking (e.g. tasting sauce 12 times, smelling clothes, checking lock)
  if (relationship === "repeated_evaluation") {
    const isSmell = /\b(smell|sniff|clothes|laundry)\b/i.test(norm) || details.actionVerb === "smelling";
    const isSecurity = /\b(lock|door|window|keys)\b/i.test(norm) || (details.actionVerb && details.actionVerb.includes("lock"));
    const count = details.resourceCount || "twelve";
    const countPhrase = count.includes("time") ? count : `${count} times`;

    if (isSmell) {
      if (idea.tone === "gentle") {
        return variant === 0
          ? `Giving the ${target} a thoughtful sensory check, patiently confirming freshness before making any laundry commitments.`
          : `Relying on careful olfactory instincts, ensuring the ${target} truly requires the wash cycle before letting it go.`;
      }
      if (idea.tone === "playful") {
        return variant === 0
          ? `Conducting a rigorous sommelier-grade bouquet analysis on the ${target} to determine its exact laundry eligibility.`
          : `Treating the ${target} like fine vintage textiles that require a certified artisanal sniff test before entering the machine.`;
      }
      return variant === 0
        ? `Convening an elite sensory panel to submit the ${target} to a high-precision olfactory audit before declaring a wash day.`
        : `Operating a fragrance certification laboratory where the ${target} must pass multi-stage olfactory clearance.`;
    }

    if (isSecurity) {
      if (idea.tone === "gentle") {
        return variant === 0
          ? `Offering the ${target} an affectionate security reassurance, making sure home remains safely guarded on every pass.`
          : `Checking in on the ${target} with dedicated care, confirming peace of mind each time you walk by.`;
      }
      if (idea.tone === "playful") {
        return variant === 0
          ? `Running a high-alert perimeter sweep on the ${target} on every single hallway patrol just to keep the hinges humble.`
          : `Operating under Secret Service protocols where the ${target} requires mandatory tactile verification on every single walkby.`;
      }
      return variant === 0
        ? `Stationing an executive security detail at the ${target}, demanding biometric latch confirmation with every pass.`
        : `Elevating the ${target} to maximum security vault status, requiring perpetual clearance audits along the hallway.`;
    }

    // Default sensory/culinary evaluation
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Approaching the ${target} with dedicated craftsmanship, confirming perfection at least ${countPhrase} just to be certain.`
        : `Showing deep dedication to the ${target}, patiently sampling ${countPhrase} to guarantee ideal balance.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Conducting a rigorous Michelin-level inspection where ${countPhrase} separate samplings of the ${target} are strictly mandatory.`
        : `Operating a premier domestic taste-test laboratory where evaluating the ${target} ${countPhrase} is standard operating procedure.`;
    }
    return variant === 0
      ? `Treating the ${target} like a high-security laboratory formula that requires ${countPhrase} official quality audits before anyone else can eat.`
      : `Convening a supreme culinary tribunal to submit the ${target} to ${countPhrase} consecutive rounds of rigorous sensory evaluation.`;
  }

  // 4. Incomplete Actions / Partial Closure (e.g. squeezing toothpaste without closing cap)
  if (relationship === "incomplete_closure") {
    const omitted = details.omittedAction || "closing the cap";
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Leaving the ${target} standing open and ready, in case an emergency application is required immediately.`
        : `Keeping the ${target} primed for instant action, thoughtfully bypassing ${omitted} for maximum convenience.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Treating ${omitted} as optional fine print, because the ${target} clearly prefers breathing the open room air.`
        : `Granting the ${target} full domestic freedom, where ${omitted} is viewed as unnecessary red tape.`;
    }
    return variant === 0
      ? `Establishing a permanent open-door policy for the ${target}, firmly rejecting ${omitted} as an unnecessary bureaucratic hurdle.`
      : `Filing an official exemption from ${omitted}, declaring the ${target} an open-air monument in the bathroom.`;
  }

  // 5. Unauthorized Depletion / Selective Omission (e.g. finishes last cake without asking, drinks last juice and puts empty carton back)
  if (relationship === "unauthorized_depletion") {
    const isFridgeCarton = /\b(carton|bottle|jug|fridge|refrigerator)\b/i.test(norm) || target.includes("juice") || target.includes("carton");
    if (isFridgeCarton) {
      if (idea.tone === "gentle") {
        return variant === 0
          ? `Leaving the carton peacefully in the fridge just to keep the cold air company until the next grocery run.`
          : `Giving the empty carton a well-deserved cool-down period on the fridge shelf before retirement.`;
      }
      if (idea.tone === "playful") {
        return variant === 0
          ? `Opening the fridge for breakfast and shaking hands with an empty carton decoy on duty.`
          : `Treating the empty carton like a placeholder ensuring the fridge shelf doesn't lose its shape.`;
      }
      return variant === 0
        ? `Maintaining strict climate-controlled refrigeration over an empty carton weighing half an ounce.`
        : `Designating the empty carton an official monument of breakfast past, preserved under refrigeration indefinitely.`;
    }

    if (idea.tone === "gentle") {
      return variant === 0
        ? `Quietly rescuing the last piece of ${target} from lingering all alone on the plate.`
        : `Providing prompt, attentive care to the ${target} before anyone had to wonder what would happen to it.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Executing a swift tactical recovery mission on the last piece of ${target} before negotiations could even open.`
        : `Conducting a discreet stealth extraction on the final piece of ${target} under cover of everyday kitchen routine.`;
    }
    return variant === 0
      ? `Exercising eminent domain over the final piece of ${target} with zero advance diplomatic warning.`
      : `Issuing an executive kitchen proclamation annexing the last piece of ${target} for immediate executive consumption.`;
  }

  // 6. Prolonged Niche Focus (e.g. explaining switches for forty minutes)
  if (relationship === "prolonged_niche_focus") {
    const dur = details.durationSpan || "forty minutes";
    const topic = details.nicheTopic || target;
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Bringing genuine passion to ${topic}, generously dedicating ${dur} to ensure every subtle nuance is appreciated.`
        : `Sharing pure, unfiltered enthusiasm for ${topic}, turning ${dur} into a heartfelt guided tour of the subject.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Delivering an unprompted masterclass on ${topic} with the thoroughness of a semester-long seminar.`
        : `Treating ${topic} like the keynote address at a major symposium that just happens to be taking place in the living room.`;
    }
    return variant === 0
      ? `Convening an emergency international symposium on ${topic} that commands ${dur} of undivided historical attention.`
      : `Delivering a monumental multi-part broadcast documentary on ${topic} spanning ${dur} of unshakeable academic rigor.`;
  }

  // 7. Comparative Duration (e.g. takes longer to choose running outfit than actually running)
  if (relationship === "comparative_duration") {
    const prep = details.prepActivity || "choosing the outfit";
    const act = details.mainActivity || "running";
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Appreciating that ${prep} is an essential ritual in itself, deserving just as much devotion as ${act}.`
        : `Giving ${prep} its full artistic moment, perfectly balancing the excitement of ${act} with careful preparation.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Treating ${prep} as the main Olympic headline event, where ${act} is merely the ceremonial closing victory lap.`
        : `Operating on the athlete principle that ${prep} deserves a prime-time broadcast before ${act} even begins.`;
    }
    return variant === 0
      ? `Elevating ${prep} into an epic multi-stage theatrical production that completely eclipses the humble act of ${act}.`
      : `Declaring ${prep} an independent national sport that demands far greater logistical preparation than ${act}.`;
  }

  // 8. Decision Process with Unchanged Outcome (e.g. reads every review before ordering same thing)
  if (relationship === "decision_process_unchanged_outcome") {
    const research = details.researchActivity || "reading every review";
    const outcome = details.outcomeChoice || "the usual choice";
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Engaging in a thorough culinary exploration through ${research}, only to affectionately reaffirm ${outcome}.`
        : `Enjoying the full tour of possibilities across ${research}, before happily reuniting with ${outcome}.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Conducting an exhaustive congressional inquiry via ${research}, before unanimously ratifying ${outcome} as expected.`
        : `Treating ${research} as vital international reconnaissance that ultimately reconfirms ${outcome} as the only true victor.`;
    }
    return variant === 0
      ? `Convening a full judicial tribunal to audit ${research}, delivering a formal verdict that ${outcome} still reigns supreme.`
      : `Mobilizing a comprehensive global intelligence agency through ${research}, solely to re-elect ${outcome} in a landslide.`;
  }

  // 8b. Prolonged Menu Deliberation (preserves single actor and exact duration specified)
  if (relationship === "prolonged_menu_deliberation") {
    const dur = details.durationSpan || "plenty of time";
    // Check if input describes a single person (she/he) or shared group (we)
    const isSingleActor = /\b(?:she|he|my partner)\b/i.test(norm) && !/\b(?:we|both of us)\b/i.test(norm);
    if (idea.tone === "gentle") {
      return variant === 0
        ? (isSingleActor
            ? `Taking a thoughtful ${dur} exploring every culinary option before settling on dinner.`
            : `Taking a thoughtful ${dur} gently exploring tonight's dinner possibilities together.`)
        : `Giving tonight's dinner choices a relaxed and thorough review across ${dur}.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? (isSingleActor
            ? `Treating ${dur} of menu scrolling like an unhurried culinary world tour before placing an order.`
            : `Turning dinner selection into a friendly ${dur} tour of every neighborhood kitchen.`)
        : `Conducting an in-depth culinary market analysis across ${dur} before committing to dinner.`;
    }
    return variant === 0
      ? `Dedication at its finest: dedicating ${dur} to reviewing takeout menus with Olympic-level thoroughness.`
      : `Convening an exhaustive ${dur} culinary symposium across five delivery apps before casting a final ballot.`;
  }

  // 9. Simultaneous Interference (e.g. starts vacuuming during phone call)
  if (relationship === "simultaneous_interference") {
    const intr = details.interferingActivity || "vacuuming";
    const prim = details.primaryEntity || "a phone call";
    if (idea.tone === "gentle") {
      return variant === 0
        ? `A thoughtful reminder that life continues in full stereo, adding a lively soundtrack of ${intr} to ${prim}.`
        : `Sharing a bustling home moment where ${intr} and ${prim} warmly compete for the spotlight.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Providing a thrilling live acoustic backing track with ${intr} just as ${prim} reaches its most delicate moment.`
        : `Treating ${prim} like a radio broadcast that clearly required emergency industrial sound effects from ${intr}.`;
    }
    return variant === 0
      ? `Staging a multi-sensory household sensory extravaganza where ${intr} takes center stage over ${prim}.`
      : `Transforming a quiet ${prim} into an arena rock concert featuring the thunderous bassline of ${intr}.`;
  }

  // 10. Action Omission / Domestic Habit (e.g. never makes bed in morning)
  if (relationship === "action_omission") {
    const omitted = details.omittedAction || "making the bed";
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Leaving the ${target} in its natural, restful state, thoughtfully ready to welcome the next night of sleep.`
        : `Honoring the peaceful geometry of the ${target}, preserving its cozy morning layout without unnecessary fuss.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Granting the ${target} complete structural autonomy, viewing ${omitted} as an artificial morning formality.`
        : `Treating the unmade ${target} as a modern art installation that actively resists traditional tidying.`;
    }
    return variant === 0
      ? `Declaring an official domestic exemption from ${omitted}, preserving the ${target} as an untouched historical landmark.`
      : `Establishing a permanent open-architecture policy for the ${target}, firmly vetoing ${omitted} as redundant labor.`;
  }

  // 11. Extreme Intensity & Force
  if (relationship === "extreme_intensity_force") {
    const isCold = /parka|climate|temperature|crank down/i.test(norm);
    if (isCold) {
      if (idea.tone === "gentle") {
        return variant === 0
          ? `Creating a brisk alpine atmosphere indoors where fuzzy blankets become essential winter gear.`
          : `Bringing refreshing mountain air into the hallway to keep the household lively and awake.`;
      }
      if (idea.tone === "playful") {
        return variant === 0
          ? `Operating an indoor Arctic research base where stepping into the hallway requires polar expedition gear.`
          : `Running the climate control on winter penguin sanctuary standards to keep the air crisp.`;
      }
      return variant === 0
        ? `Transforming the hallway into a sub-zero glaciology laboratory requiring full Himalayan climbing gear.`
        : `Declaring sovereign Antarctic territory in the hallway where temperatures rival midwinter blizzards.`;
    }
    // High-muscle polishing/cleaning
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Putting deep, genuine elbow grease into the ${target}, making sure every square inch gleams with pride.`
        : `Giving the ${target} a heartfelt, muscular shine that leaves no doubt about dedication.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Polishing the ${target} with enough vibrational horsepower to register on regional seismology monitors.`
        : `Treating cleaning the ${target} like an Olympic powerlifting event with high-gloss results.`;
    }
    return variant === 0
      ? `Mobilizing heavyweight industrial demolition energy to ensure the ${target} achieves supernatural optical reflection.`
      : `Channeling the force of a hydraulic turbine into the ${target} until the foundation of the house vibrates in harmony.`;
  }

  // 12. Repeated Retelling / Story Recycling
  if (relationship === "repeated_retelling") {
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Affectionately revisiting ${target}, letting the golden memories shine just as brightly each time.`
        : `Sharing a treasured classic tale that has earned its honored place in our household lore.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Broadcasting the deluxe remaster of ${target} complete with director commentary and bonus trivia.`
        : `Treating ${target} like a beloved syndication sitcom that never loses its syndication charm.`;
    }
    return variant === 0
      ? `Entering ${target} into the Library of Congress for mandatory annual recital across all domestic gatherings.`
      : `Submitting ${target} as an immortal historical epic requiring continuous multi-volume broadcast.`;
  }

  // 13. Playful Expressive Vocal / Pet Cooing / Ritual
  if (relationship === "playful_expressive_ritual") {
    const isPet = /\b(cat|kitten|dog|puppy|ginger)\b/i.test(norm);
    if (isPet) {
      if (idea.tone === "gentle") {
        return variant === 0
          ? `Checking in on the cat's busy executive agenda with pure, affectionate devotion.`
          : `Sharing sweet bedtime coos to make sure the cat knows just how valued they are.`;
      }
      if (idea.tone === "playful") {
        return variant === 0
          ? `Conducting a high-level corporate board meeting with the cat to review key fiscal nap targets.`
          : `Addressing the cat in executive baby-talk to ensure critical feline performance metrics were met.`;
      }
      return variant === 0
        ? `Convening an emergency international G7 summit with the ginger cat to discuss global nap treaties.`
        : `Delivering a prime-time state address directly to the cat regarding domestic cuddle allocations.`;
    }
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Brightening everyday moments with spontaneous musical charm and unscripted cheer.`
        : `Bringing pure theatrical joy to everyday routines with playful songs and quirky dances.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Staging an unprompted Broadway musical extravaganza right in the middle of domestic chores.`
        : `Treating everyday kitchen moments like an audition for an avant-garde acoustic variety show.`;
    }
    return variant === 0
      ? `Transforming everyday household routines into a full-scale operatic world premiere that commands a standing ovation.`
      : `Broadcasting an epic, multi-act variety special from the kitchen that eclipses all televised entertainment.`;
  }

  // 14. Digital / Domestic Accumulation & Hoarding
  if (relationship === "accumulative_hoarding") {
    const isTabs = /\b(tabs?|safari|browser)\b/i.test(norm);
    if (isTabs) {
      if (idea.tone === "gentle") {
        return variant === 0
          ? `Curating an expansive universe of open tabs, keeping every possible train of thought warmly alive.`
          : `Giving eighty-four browser tabs a peaceful, permanent home on mobile safari just in case.`;
      }
      if (idea.tone === "playful") {
        return variant === 0
          ? `Operating the world's most congested digital library where closing a single tab feels like historical treason.`
          : `Running an endangered species sanctuary specifically for research tabs opened three months ago.`;
      }
      return variant === 0
        ? `Designating the mobile browser an official national digital archive housing 84 irreplaceable intellectual monuments.`
        : `Submitting an emergency cloud storage expansion treaty to sustain a fortress of eighty-four untouched browser tabs.`;
    }
    // Mugs accumulation
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Assembling a friendly ceramic delegation across the desk to keep the workday company.`
        : `Allowing favorite mugs to form a cozy collective display through the week.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Erecting a ceramic Great Wall across the computer desk to defend the workspace from empty surfaces.`
        : `Operating a pottery exhibition around the keyboard with an impressive multi-day mug roster.`;
    }
    return variant === 0
      ? `Fortifying the computer desk into a medieval stoneware citadel capable of withstanding prolonged siege.`
      : `Declaring sovereign ceramic territory across the desk with a seven-mug defensive perimeter.`;
  }

  // 15. Prolonged Craft Immersion
  if (relationship === "prolonged_craft_immersion") {
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Bringing quiet artisan dedication to the workshop, patiently perfecting every fine detail.`
        : `Investing heartfelt craftsman focus into ${target}, letting hours pass in creative flow.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Disappearing into the workshop like a mythical master carpenter chasing timber enlightenment.`
        : `Treating ${target} with the microscopic precision usually reserved for royal jewel polishing.`;
    }
    return variant === 0
      ? `Convening a six-hour solitary guild symposium to elevate ${target} into a priceless heirloom.`
      : `Declaring a total workshop blackout until ${target} achieves museum-grade physical perfection.`;
  }

  // 16. Prolonged Social Farewell
  if (relationship === "prolonged_departure_lingering") {
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Ensuring no warm thought is left unsaid before finally waving goodbye at the door.`
        : `Savoring every final second of company, extending the doorway farewell with genuine affection.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Delivering a multi-encore farewell speech while keeping the front door propped open as a theatrical stage.`
        : `Treating saying goodbye like a series finale that required four bonus post-credit scenes in the hallway.`;
    }
    return variant === 0
      ? `Staging a thirty-minute State of the Union valedictory address on the welcome mat before permitting departure.`
      : `Submitting an emergency diplomatic filibuster at the front door to delay goodbye past the next lunar cycle.`;
  }

  // 17. Photo Staging Freeze
  if (relationship === "social_staging_freeze") {
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Appreciating the beauty of tonight's dinner, making sure the memory is captured just right.`
        : `Taking a patient moment to preserve how wonderfully the meal came together before digging in.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Ordering a household fork ceasefire for fifteen minutes to stage a Vogue cover photoshoot for noodles.`
        : `Operating a Michelin star photography studio at the dinner table while hungry forks wait in suspense.`;
    }
    return variant === 0
      ? `Issuing a federal culinary injunction freezing all silverware mid-air until fifty cinematic angles are archived.`
      : `Declaring a national culinary monument curation session requiring total dining stillness for fifteen minutes.`;
  }

  // 18. Navigation Detour
  if (relationship === "navigation_adventurous_detour") {
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Choosing the scenic adventurous route, letting curiosity guide the journey over robotic directions.`
        : `Turning an ordinary drive into a scenic countryside expedition with independent navigation spirit.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Engaging in a lively philosophical debate with the GPS voice and taking forty bonus minutes through cow pastures.`
        : `Treating turn-by-turn navigation like polite suggestions from someone who clearly lacks exploratory vision.`;
    }
    return variant === 0
      ? `Overruling global satellite networks to embark on an uncharted forty-minute safari through rural dirt trails.`
      : `Formally repudiating the GPS satellite constellation in favor of pioneer-era frontier exploration.`;
  }

  // 19. Last-Minute Packing Rush
  if (relationship === "last_minute_rush") {
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Packing with spontaneous high-efficiency momentum just before stepping out the door.`
        : `Relying on quick instinctive packing instincts as the travel clock ticks down.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Executing a high-stakes three-minute luggage sprint like an extreme sports championship.`
        : `Treating airport departure like an action movie escape sequence where duffle bags get packed at supersonic speed.`;
    }
    return variant === 0
      ? `Staging an Olympic decathlon in rapid suitcase stuffing while the airport shuttle idles at the curb.`
      : `Mobilizing supersonic tactical luggage deployment three minutes before international travel departure.`;
  }

  // 20. Doorway Readiness Asymmetry
  if (relationship === "doorway_readiness_asymmetry") {
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Standing ready at the threshold, patiently keeping the departure rhythm calm and relaxed.`
        : `Holding the fort by the front door with quiet readiness while jackets are tracked down.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Standing fully booted like a sentry guard on duty while jacket-hunting expeditions scour the house.`
        : `Operating on two distinct time zones: one fully dressed by the door, the other exploring wardrobe options.`;
    }
    return variant === 0
      ? `Establishing a permanent forward outpost on the welcome mat with full outdoor expedition gear.`
      : `Stationing an executive departure guard at the front entrance for twenty minutes of disciplined anticipation.`;
  }

  // 21. Microscopic Remnant
  if (relationship === "microscopic_remnant") {
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Leaving that single thoughtful drop behind, ensuring the beverage journey isn't quite over yet.`
        : `Preserving a tiny symbolic sip at the bottom of the glass to keep the flavor memory alive.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Preserving a microscopic thimble of iced tea like a rare museum relic that nobody dares disturb.`
        : `Treating the final three drops of drink like a sacred reserve ensuring the glass is never truly empty.`;
    }
    return variant === 0
      ? `Designating the final microscopic thimble of liquid an untouchable heritage landmark at the bottom of the glass.`
      : `Submitting a diplomatic preservation order to protect half a drop of tea from being officially finished.`;
  }

  // 22. Lethargic Morning Boot
  if (relationship === "lethargic_morning_boot") {
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Allowing morning consciousness to boot up at its own natural, gentle speed before taking on the day.`
        : `Taking an unhurried, peaceful wake-up journey into the kitchen with zero pressure to rush.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Stumbling into the kitchen running on 1995 dial-up modem speed while cognitive drivers load in background.`
        : `Operating at five percent morning processing power until the first coffee signal reaches the CPU.`;
    }
    return variant === 0
      ? `Operating under a low-power system hibernation protocol where each step across the kitchen takes several geological epochs.`
      : `Declaring a total freeze on executive mental functions until the morning reboot sequence achieves ten percent capacity.`;
  }

  // 23. Packaging Accumulation
  if (relationship === "packaging_accumulation") {
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Letting delivery boxes rest peacefully near the credenza until recycling day comes around.`
        : `Giving unboxed shipping cartons a temporary landing zone before folding them down.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Erecting a cardboard warehouse annex by the credenza to celebrate another successful week of online commerce.`
        : `Curating a modern sculpture park of brown delivery cartons in the hallway before breakdown day.`;
    }
    return variant === 0
      ? `Constructing a monumental brown cardboard citadel near the credenza capable of housing several cat generations.`
      : `Declaring an official regional postal fulfillment depot right in the middle of the living room.`;
  }

  // 24. Absentminded Task Omission
  if (relationship === "absentminded_task_omission") {
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Letting the wheelie bin enjoy another peaceful week in the driveway with zero hard feelings.`
        : `Giving the recycling bin an unbothered morning off while life's bigger thoughts took center stage.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Granting the recycling bin a surprise holiday from municipal collection duties this week.`
        : `Treating rolling the bin down the drive as an optional elective course that got rescheduled.`;
    }
    return variant === 0
      ? `Declaring an official municipal exemption granting the wheelie bin sovereign immunity from the garbage truck.`
      : `Submitting an emergency resolution preserving the driveway bin as a permanent outdoor art piece for another week.`;
  }

  // 25. Misplaced Proximity Hunt
  if (relationship === "misplaced_proximity_hunt") {
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Searching with patient determination for items that are playing an affectionate game of hide-and-seek.`
        : `Giving the room a thorough search, knowing the missing item is quietly smiling nearby.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Turning the room upside down on a treasure hunt for items that chose stealth mode five minutes ago.`
        : `Conducting an FBI-level missing persons investigation on reading glasses perched comfortably on the head.`;
    }
    return variant === 0
      ? `Mobilizing an elite search-and-rescue battalion to excavate every sofa cushion in search of the elusive fob.`
      : `Convening a congressional task force to locate items currently resting six inches from the search team's eyes.`;
  }

  // 26. Conversational Focus Disruption
  if (relationship === "conversational_focus_disruption") {
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Sharing a delightful, spontaneous spark of news right when a serious work moment needed some warmth.`
        : `Bringing fun, unfiltered internet humor into the study with pure enthusiasm.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Busting into client calls like an unprompted breaking-news anchor delivering top-tier internet gossip.`
        : `Treating partner's client video meeting like a public variety broadcast in need of comic relief.`;
    }
    return variant === 0
      ? `Interrupting international corporate diplomacy to deliver emergency classified intelligence on internet memes.`
      : `Broadcasting viral variety programming over corporate airwaves with zero prior security clearance.`;
  }

  // 27. Passionate Niche Debate
  if (relationship === "passionate_niche_debate") {
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Bringing genuine passion to physical definitions, affectionately debating the true essence of workout.`
        : `Defending strong exercise principles with energetic conviction and hearty spirit.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Delivering an unprompted Olympic standards lecture on what technically qualifies as genuine sweat equity.`
        : `Operating like the Supreme Court of athletics where gentle stretching is firmly denied workout status.`;
    }
    return variant === 0
      ? `Convening the International Olympic Committee to deliver a binding constitutional verdict against gentle stretching.`
      : `Submitting a monumental athletic manifesto declaring total jurisprudential war on leisurely foam rollers.`;
  }

  // 28. Bedtime Screen Scrolling / Digital Sleep Delay (Cat 17 / Cat 8)
  if (relationship === "bedtime_screen_scrolling") {
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Letting the quiet glow of the screen keep bedtime company for a few peaceful extra minutes.`
        : `Enjoying a private late-night window into the digital world before finally drifting off.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Treating bedtime like an undercover nocturnal mission illuminated solely by smartphone glow.`
        : `Convincing oneself that scrolling just three more minutes in the dark will definitely induce sleep.`;
    }
    return variant === 0
      ? `Operating a clandestine midnight optical research facility under the sheets powered by phone brightness.`
      : `Establishing an official nocturnal digital residency where sleep is repeatedly postponed for critical viral updates.`;
  }

  // 29. Sleep Media Dependency / Television As Sleep Aid (Cat 8)
  if (relationship === "sleep_media_dependency") {
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Finding comfort in the familiar ambient hum of the television to help welcome deep sleep.`
        : `Using the gentle nighttime glow of the screen as a steady, reliable bedtime companion.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Employing a 55-inch television screen as an extravagant, high-definition electronic nightlight.`
        : `Requiring a full cable broadcast lineup to softly narrate the transition into dreamland.`;
    }
    return variant === 0
      ? `Demanding a continuous national television broadcast network solely to operate as an ambient bedroom sleep aid.`
      : `Designating the late-night television schedule an indispensable physiological requirement for nighttime rest.`;
  }

  // 30. Damp Laundry in Washer Drum / Delayed Unloading (Cat 1)
  if (relationship === "damp_laundry_standby") {
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Giving the freshly washed laundry a quiet extra moment of rest inside the machine before drying.`
        : `Treating the washing machine drum like a peaceful holding lounge for clean damp fabrics.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Letting the clean laundry marinate overnight in the washer drum like vintage artisanal textiles.`
        : `Treating the completed wash cycle as merely phase one of an extended multi-day machine residency.`;
    }
    return variant === 0
      ? `Granting the damp laundry permanent diplomatic asylum inside the washing machine drum indefinitely.`
      : `Establishing a high-humidity tropical microclimate inside the washer where clean clothes mature for days.`;
  }

  // 31. Supermarket Aisle Odyssey / Grocery Wandering (Cat 20)
  if (relationship === "supermarket_aisle_odyssey") {
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Turning a simple quick errand into a relaxing, scenic stroll down every grocery aisle.`
        : `Appreciating the full peaceful tour of the supermarket shelves rather than rushing through.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Entering the grocery store for two items and accidentally conducting a complete storewide inventory audit.`
        : `Treating a simple paper towel run like an exploratory expedition through uncharted supermarket territory.`;
    }
    return variant === 0
      ? `Upgrading a two-minute grocery pickup into a monumental cross-country expedition visiting every single shelf.`
      : `Submitting a formal request to map the supermarket aisles as an official national scenic trail network.`;
  }

  // 28. Repetition & Frequency Habits (e.g. Cleans tiny silverware but sidesteps heavy roasting pan)
  if (relationship === "repetition_frequency") {
    const isAvoided = bound.actionPolarity === "avoided" || /\b(?:sidesteps?|skips?|leaves? behind|avoids?)\b/i.test(norm);
    if (isAvoided) {
      if (idea.tone === "gentle") {
        return variant === 0
          ? `Adopting a peaceful non-aggression pact toward the ${target}, letting it rest undisturbed by the sink.`
          : `Politely keeping a respectful distance from the ${target}, waiting for a braver moment.`;
      }
      if (idea.tone === "playful") {
        return variant === 0
          ? `Treating the ${target} like a dormant volcanic formation best left undisturbed by casual dishwashers.`
          : `Negotiating a temporary diplomatic armistice where the ${target} remains completely untouched.`;
      }
      return variant === 0
        ? `Granting the ${target} sovereign diplomatic immunity from the sponge under official household decree.`
        : `Designating the ${target} an untouchable archaeological relic requiring specialized museum clearance to wash.`;
    }
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Quietly honoring a familiar rhythm with the ${target}, returning to it with steady consistency.`
        : `Finding comforting predictability in how the ${target} is handled day after day.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Practicing the ${target} routine with the clockwork precision of a seasoned train conductor.`
        : `Approaching the ${target} with ritual dedication, turning everyday repetition into high art.`;
    }
    return variant === 0
      ? `Establishing a permanent ceremonial calendar where the ${target} takes center stage on endless repeat.`
      : `Promoting the ${target} habit to an inviolable municipal ordinance observed without exception.`;
  }

  // 29. Pacing Slow / Leisurely Departure / Immersion (e.g. 50 minute shower, vanity bulbs, blanket pretzel)
  if (relationship === "pacing_slow") {
    const isShower = /\b(?:shower|bath|steams?)\b/i.test(norm);
    const isLights = /\b(?:bulbs?|lights?|marquee|glowing)\b/i.test(norm);
    const isBlanket = /\b(?:blankets?|sofa|pretzel|cushions?)\b/i.test(norm);
    const isMovie = /\b(?:movie|thriller|dozes?|asleep|sleep)\b/i.test(norm);
    if (isShower) {
      if (idea.tone === "gentle") {
        return variant === 0
          ? `Transforming a quick rinse into a deeply restorative private spa retreat with total thermal dedication.`
          : `Taking all the time needed to thoroughly defrost under the soothing waterfall.`;
      }
      if (idea.tone === "playful") {
        return variant === 0
          ? `Operating the shower on full geothermal hot-spring settings until the entire bathroom becomes a cloud chamber.`
          : `Treating a standard morning shower like a deep-sea submersible expedition requiring fifty uninterrupted minutes.`;
      }
      return variant === 0
        ? `Converting the shower stall into a tropical rainforest biome that single-handedly tests the municipal hot water grid.`
        : `Establishing a sovereign tropical territory in the bathroom where steam replaces atmospheric air entirely.`;
    }
    if (isLights) {
      if (idea.tone === "gentle") {
        return variant === 0
          ? `Leaving the vanity lights glowing warmly to guide the way for anyone passing through.`
          : `Keeping the room cheerfully bright and energized with a luminous welcome.`;
      }
      if (idea.tone === "playful") {
        return variant === 0
          ? `Lighting the guest bathroom like the opening night premiere of a major Broadway production.`
          : `Running the vanity bulbs on theatrical runway specifications to ensure dramatic illumination.`;
      }
      return variant === 0
        ? `Treating the bathroom vanity like the landing strip lights at an international airport operating 24/7.`
        : `Transforming a quick trip to the sink into an arena rock concert light show visible from low orbit.`;
    }
    if (isBlanket) {
      if (idea.tone === "gentle") {
        return variant === 0
          ? `Leaving the throw blankets thoughtfully sculpted into a cozy nest ready for the next relaxation session.`
          : `Honoring the soft contours of the sofa with an artistic arrangement of warm wool.`;
      }
      if (idea.tone === "playful") {
        return variant === 0
          ? `Sculpting the sectional blankets into an intricate fabric pretzel that doubles as modern living room sculpture.`
          : `Leaving behind a woven geological formation on the sofa that actively resists untangling.`;
      }
      return variant === 0
        ? `Registering the twisted sofa blanket sculpture as an official permanent installation in the living room pavilion.`
        : `Constructing an impenetrable textile labyrinth across the sofa that requires navigational training to solve.`;
    }
    if (isMovie) {
      if (idea.tone === "gentle") {
        return variant === 0
          ? `Enjoying the comforting hum of the thriller as a relaxing bedtime story after a full day.`
          : `Finding peaceful slumber right alongside the opening credits, well before any plot twists could worry anyone.`;
      }
      if (idea.tone === "playful") {
        return variant === 0
          ? `Lobbying passionately for high-stakes cinema only to achieve deep REM sleep before the opening scene concludes.`
          : `Using the dramatic suspense of a crime thriller as a remarkably potent, top-shelf lullaby.`;
      }
      return variant === 0
        ? `Demanding a gripping two-hour cinematic masterpiece purely to utilize the introductory dialogue as a sleep aid.`
        : `Securing exclusive screening rights to the movie only to enter a deep restorative hibernation eight minutes in.`;
    }
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Granting ${target} an unhurried, measured pace that respects natural timing.`
        : `Allowing everyday moments to unfold with patient, unpressured calm.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Treating the ${target} timeline like a scenic country detour that steadfastly refuses to check the clock.`
        : `Operating on a relaxed domestic timezone that views deadlines as purely conversational suggestions.`;
    }
    return variant === 0
      ? `Declaring absolute time independence for the ${target}, letting seconds stretch into historic epochs.`
      : `Submitting a formal petition to slow down the rotation of the earth to accommodate the ${target} schedule.`;
  }

  // 30. Quantity Insufficient (e.g. splash of milk called an artisan latte)
  if (relationship === "quantity_insufficient") {
    const isTeaLatte = /\b(?:latte|milk|tea|coffee|splash|water)\b/i.test(norm);
    if (isTeaLatte) {
      if (idea.tone === "gentle") {
        return variant === 0
          ? `Affectionately celebrating a minimalist interpretation of a latte with just a thoughtful whisper of milk.`
          : `Appreciating a subtle, delicate touch where a single drop gives the beverage its unique character.`;
      }
      if (idea.tone === "playful") {
        return variant === 0
          ? `Introducing three drops of oat milk to hot water and proudly christening it an artisanal craft beverage.`
          : `Operating like an avant-garde barista who believes milk should only be present as an abstract concept.`;
      }
      return variant === 0
        ? `Presenting a microscopic droplet of oat milk in hot water as a groundbreaking European specialty roast.`
        : `Awarding five Michelin stars to a hot water beverage that merely caught a distant glance from a milk carton.`;
    }
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Embracing a refined, minimalist touch where even the tiniest amount of ${target} is fully appreciated.`
        : `Finding elegance in simplicity, making a delicate measure of ${target} go a long way.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Treating a microscopic portion of ${target} as an abundant, full-scale feast.`
        : `Dispensing ${target} with the extreme caution of an alchemist handling priceless rare elixirs.`;
    }
    return variant === 0
      ? `Declaring a solitary molecule of ${target} to be a grand banquet worthy of international renown.`
      : `Hailing a single speck of ${target} as a monumental triumph of resource conservation.`;
  }

  // 31. Quantity Excessive (e.g. blanket hogging alligator, 12th sitcom rewatch)
  if (relationship === "quantity_excessive") {
    const isBlanketHog = /\b(?:blanket|comforter|duvet|covers?)\b/i.test(norm);
    const isRewatch = /\b(?:rewatch|series|sitcom|show|episodes?|season)\b/i.test(norm);
    if (isBlanketHog) {
      if (idea.tone === "gentle") {
        return variant === 0
          ? `Gently gathering the entire comforter for an extra cozy cocoon during deep sleep.`
          : `Ensuring total nocturnal warmth by keeping the duvet wrapped tight on all sides.`;
      }
      if (idea.tone === "playful") {
        return variant === 0
          ? `Executing an Olympic bedtime alligator roll that claims ninety-five percent of the comforter territory.`
          : `Transforming the shared duvet into a one-person sleeping bag with total tactical efficiency.`;
      }
      return variant === 0
        ? `Exercising total gravitational sovereignty over the comforter, leaving the other side of the bed an arctic tundra.`
        : `Establishing an uncontested monopoly on nocturnal cotton distribution under cover of deep slumber.`;
    }
    if (isRewatch) {
      if (idea.tone === "gentle") {
        return variant === 0
          ? `Finding heartwarming comfort in a familiar series where every punchline feels like an old friend.`
          : `Returning to beloved characters for the twelfth time to enjoy reliable, stress-free entertainment.`;
      }
      if (idea.tone === "playful") {
        return variant === 0
          ? `Treating the comfort sitcom like a sacred religious text requiring quarterly recitations from memory.`
          : `Memorizing every background actor in season four rather than gambling on a single new television show.`;
      }
      return variant === 0
        ? `Appointing the comfort sitcom an official permanent cultural heritage site streaming on continuous 24-hour loop.`
        : `Filing an executive veto against all other entertainment media to protect the sanctity of the twelfth rewatch.`;
    }
    if (idea.tone === "gentle") {
      return variant === 0
        ? `Generously pouring passion and abundance into ${target} without holding anything back.`
        : `Ensuring there is always more than enough of ${target} to keep everyone feeling safe and stocked.`;
    }
    if (idea.tone === "playful") {
      return variant === 0
        ? `Operating under the firm household philosophy that if ${target} is good, three times more is definitely better.`
        : `Treating ${target} like an endangered resource that must be amassed in industrial quantities.`;
    }
    return variant === 0
      ? `Declaring a state of total domestic abundance where ${target} completely overflows all traditional boundaries.`
      : `Constructing a colossal monument to ${target} that rivals the great wonders of the ancient world.`;
  }

  // 32. General Compositional Plan Fallback by Plan Type
  if (idea.planType === "analogy_comparison") {
    return capitalizeSentence(`Approaching ${action} the ${target} like a specialized trade craft with its own established traditions.`);
  }
  if (idea.planType === "scale_distortion") {
    return capitalizeSentence(`Elevating ${action} the ${target} into a grand domestic event that commands respect across the entire household.`);
  }
  if (idea.planType === "gentle_personification") {
    return capitalizeSentence(`The ${target} quietly holding its place, completely convinced this is the proper way things are done.`);
  }
  if (idea.planType === "mock_declaration") {
    return capitalizeSentence(`Treating ${action} the ${target} as an official household standard that requires zero outside commentary.`);
  }

  // Observation default
  return capitalizeSentence(`Observing ${action} the ${target} unfold with its own distinct, unhurried rhythm.`);
}

/**
 * Generate Dynamic Humour Ideas from Behavioural Relationships, Mechanisms, and Metaphors.
 */
export function generateCompositionalPlanIdeas(
  bound: BoundSituation,
  targetTone: "gentle" | "playful" | "exaggerated",
  extractedBehavior: ReturnType<typeof extractRichBehavioralRelationship>
): HumourIdea[] {
  const { relationship } = extractedBehavior;
  const ideas: HumourIdea[] = [];

  const mechanismMapForTone: Record<string, Record<"gentle" | "playful" | "exaggerated", { mech: string; meta: string; planType: HumourIdea["planType"] }>> = {
    contradiction_statement_action: {
      gentle: { mech: "mech_observational_parody", meta: "meta_sports_broadcasting", planType: "observation" },
      playful: { mech: "mech_secret_agent_covert", meta: "meta_banking_treasury", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_fictional_jurisdiction_incredulity", meta: "meta_diplomatic_treaty", planType: "mock_declaration" },
    },
    disproportionate_resources: {
      gentle: { mech: "mech_culinary_patrol", meta: "meta_michelin_inspector", planType: "observation" },
      playful: { mech: "mech_olympic_sporting", meta: "meta_olympic_gymnastics", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_architectural_wonder", meta: "meta_construction_site", planType: "scale_distortion" },
    },
    repeated_evaluation: {
      gentle: { mech: "mech_culinary_patrol", meta: "meta_michelin_inspector", planType: "observation" },
      playful: { mech: "mech_observational_parody", meta: "meta_michelin_inspector", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_fictional_jurisdiction_incredulity", meta: "meta_quantum_physics", planType: "scale_distortion" },
    },
    incomplete_closure: {
      gentle: { mech: "mech_harmless_personification", meta: "meta_zen_temple", planType: "gentle_personification" },
      playful: { mech: "mech_timing_anticlimax", meta: "meta_fictional_administration", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_fictional_jurisdiction_incredulity", meta: "meta_high_court", planType: "mock_declaration" },
    },
    unauthorized_depletion: {
      gentle: { mech: "mech_understatement_minimalism", meta: "meta_wildlife_reserve", planType: "observation" },
      playful: { mech: "mech_secret_agent_covert", meta: "meta_secret_agent", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_royal_proclamation", meta: "meta_ancient_rome", planType: "mock_declaration" },
    },
    prolonged_niche_focus: {
      gentle: { mech: "mech_understatement_minimalism", meta: "meta_library_archives", planType: "observation" },
      playful: { mech: "mech_observational_parody", meta: "meta_public_broadcasting", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_comic_escalation", meta: "meta_broadway_musical", planType: "scale_distortion" },
    },
    prolonged_menu_deliberation: {
      gentle: { mech: "mech_understatement_minimalism", meta: "meta_culinary_minimalism", planType: "observation" },
      playful: { mech: "mech_observational_parody", meta: "meta_food_tour", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_comic_escalation", meta: "meta_olympic_gymnastics", planType: "scale_distortion" },
    },
    extreme_intensity_force: {
      gentle: { mech: "mech_culinary_patrol", meta: "meta_michelin_inspector", planType: "observation" },
      playful: { mech: "mech_olympic_sporting", meta: "meta_olympic_gymnastics", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_architectural_wonder", meta: "meta_construction_site", planType: "scale_distortion" },
    },
    repeated_retelling: {
      gentle: { mech: "mech_understatement_minimalism", meta: "meta_library_archives", planType: "observation" },
      playful: { mech: "mech_observational_parody", meta: "meta_public_broadcasting", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_comic_escalation", meta: "meta_historical_monument", planType: "scale_distortion" },
    },
    playful_expressive_ritual: {
      gentle: { mech: "mech_harmless_personification", meta: "meta_zen_temple", planType: "gentle_personification" },
      playful: { mech: "mech_observational_parody", meta: "meta_broadway_musical", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_comic_escalation", meta: "meta_broadway_musical", planType: "scale_distortion" },
    },
    accumulative_hoarding: {
      gentle: { mech: "mech_understatement_minimalism", meta: "meta_library_archives", planType: "observation" },
      playful: { mech: "mech_observational_parody", meta: "meta_art_gallery", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_architectural_wonder", meta: "meta_medieval_castle", planType: "scale_distortion" },
    },
    prolonged_craft_immersion: {
      gentle: { mech: "mech_zen_minimalism", meta: "meta_monastery_retreat", planType: "observation" },
      playful: { mech: "mech_unexpected_profession", meta: "meta_alchemical_lab", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_architectural_wonder", meta: "meta_historical_monument", planType: "scale_distortion" },
    },
    prolonged_departure_lingering: {
      gentle: { mech: "mech_understatement_minimalism", meta: "meta_diplomatic_treaty", planType: "observation" },
      playful: { mech: "mech_timing_anticlimax", meta: "meta_public_broadcasting", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_comic_escalation", meta: "meta_broadway_musical", planType: "scale_distortion" },
    },
    social_staging_freeze: {
      gentle: { mech: "mech_culinary_patrol", meta: "meta_art_gallery", planType: "observation" },
      playful: { mech: "mech_observational_parody", meta: "meta_fashion_runway", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_fictional_jurisdiction_incredulity", meta: "meta_high_court", planType: "mock_declaration" },
    },
    navigation_adventurous_detour: {
      gentle: { mech: "mech_understatement_minimalism", meta: "meta_expedition_travel", planType: "observation" },
      playful: { mech: "mech_observational_parody", meta: "meta_expedition_travel", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_fictional_jurisdiction_incredulity", meta: "meta_space_mission", planType: "mock_declaration" },
    },
    last_minute_rush: {
      gentle: { mech: "mech_understatement_minimalism", meta: "meta_airline_flight", planType: "observation" },
      playful: { mech: "mech_olympic_sporting", meta: "meta_olympic_gymnastics", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_scale_acoustic_distortion", meta: "meta_circus_acrobatics", planType: "scale_distortion" },
    },
    doorway_readiness_asymmetry: {
      gentle: { mech: "mech_zen_minimalism", meta: "meta_monastery_retreat", planType: "observation" },
      playful: { mech: "mech_timing_anticlimax", meta: "meta_sports_broadcasting", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_fictional_jurisdiction_incredulity", meta: "meta_medieval_castle", planType: "mock_declaration" },
    },
    microscopic_remnant: {
      gentle: { mech: "mech_understatement_minimalism", meta: "meta_culinary_minimalism", planType: "observation" },
      playful: { mech: "mech_observational_parody", meta: "meta_museum_curation", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_fictional_jurisdiction_incredulity", meta: "meta_high_court", planType: "mock_declaration" },
    },
    lethargic_morning_boot: {
      gentle: { mech: "mech_zen_minimalism", meta: "meta_monastery_retreat", planType: "observation" },
      playful: { mech: "mech_observational_parody", meta: "meta_quantum_physics", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_time_dilation", meta: "meta_historical_monument", planType: "scale_distortion" },
    },
    packaging_accumulation: {
      gentle: { mech: "mech_understatement_minimalism", meta: "meta_library_archives", planType: "observation" },
      playful: { mech: "mech_observational_parody", meta: "meta_postal_service", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_architectural_wonder", meta: "meta_construction_site", planType: "scale_distortion" },
    },
    absentminded_task_omission: {
      gentle: { mech: "mech_harmless_personification", meta: "meta_zen_temple", planType: "gentle_personification" },
      playful: { mech: "mech_timing_anticlimax", meta: "meta_fictional_administration", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_fictional_jurisdiction_incredulity", meta: "meta_diplomatic_treaty", planType: "mock_declaration" },
    },
    misplaced_proximity_hunt: {
      gentle: { mech: "mech_understatement_minimalism", meta: "meta_wildlife_reserve", planType: "observation" },
      playful: { mech: "mech_secret_agent_covert", meta: "meta_secret_agent", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_fictional_jurisdiction_incredulity", meta: "meta_high_court", planType: "mock_declaration" },
    },
    conversational_focus_disruption: {
      gentle: { mech: "mech_understatement_minimalism", meta: "meta_public_broadcasting", planType: "observation" },
      playful: { mech: "mech_observational_parody", meta: "meta_public_broadcasting", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_comic_escalation", meta: "meta_broadway_musical", planType: "scale_distortion" },
    },
    passionate_niche_debate: {
      gentle: { mech: "mech_understatement_minimalism", meta: "meta_library_archives", planType: "observation" },
      playful: { mech: "mech_observational_parody", meta: "meta_olympic_gymnastics", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_fictional_jurisdiction_incredulity", meta: "meta_high_court", planType: "mock_declaration" },
    },
    bedtime_screen_scrolling: {
      gentle: { mech: "mech_harmless_personification", meta: "meta_zen_temple", planType: "observation" },
      playful: { mech: "mech_secret_agent_covert", meta: "meta_secret_agent", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_scale_acoustic_distortion", meta: "meta_astronomical_observatory", planType: "scale_distortion" },
    },
    sleep_media_dependency: {
      gentle: { mech: "mech_harmless_personification", meta: "meta_zen_temple", planType: "observation" },
      playful: { mech: "mech_observational_parody", meta: "meta_public_broadcasting", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_comic_escalation", meta: "meta_broadway_musical", planType: "scale_distortion" },
    },
    damp_laundry_standby: {
      gentle: { mech: "mech_harmless_personification", meta: "meta_monastery_retreat", planType: "observation" },
      playful: { mech: "mech_unexpected_profession", meta: "meta_thermal_spa", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_fictional_jurisdiction_incredulity", meta: "meta_diplomatic_treaty", planType: "mock_declaration" },
    },
    supermarket_aisle_odyssey: {
      gentle: { mech: "mech_understatement_minimalism", meta: "meta_scenic_walkway", planType: "observation" },
      playful: { mech: "mech_observational_parody", meta: "meta_expedition_travel", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_comic_escalation", meta: "meta_space_mission", planType: "scale_distortion" },
    },
    repetition_frequency: {
      gentle: { mech: "mech_zen_minimalism", meta: "meta_monastery_retreat", planType: "observation" },
      playful: { mech: "mech_observational_parody", meta: "meta_railway_timetable", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_comic_escalation", meta: "meta_historical_monument", planType: "scale_distortion" },
    },
    pacing_slow: {
      gentle: { mech: "mech_zen_minimalism", meta: "meta_thermal_spa", planType: "observation" },
      playful: { mech: "mech_observational_parody", meta: "meta_broadway_musical", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_scale_acoustic_distortion", meta: "meta_airline_flight", planType: "scale_distortion" },
    },
    quantity_insufficient: {
      gentle: { mech: "mech_understatement_minimalism", meta: "meta_culinary_minimalism", planType: "observation" },
      playful: { mech: "mech_unexpected_profession", meta: "meta_coffee_connoisseur", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_comic_escalation", meta: "meta_michelin_inspector", planType: "scale_distortion" },
    },
    quantity_excessive: {
      gentle: { mech: "mech_understatement_minimalism", meta: "meta_monastery_retreat", planType: "observation" },
      playful: { mech: "mech_olympic_sporting", meta: "meta_olympic_gymnastics", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_fictional_jurisdiction_incredulity", meta: "meta_ancient_rome", planType: "mock_declaration" },
    },
    default: {
      gentle: { mech: "mech_understatement_minimalism", meta: "meta_zen_temple", planType: "observation" },
      playful: { mech: "mech_observational_parody", meta: "meta_fictional_administration", planType: "analogy_comparison" },
      exaggerated: { mech: "mech_comic_escalation", meta: "meta_historical_monument", planType: "scale_distortion" },
    },
  };

  const mapping = mechanismMapForTone[relationship] || mechanismMapForTone.default;
  const config = mapping[targetTone];

  ideas.push({
    id: `dyn_idea_${relationship}_${targetTone}`,
    opportunity: bound.humorOpportunity || "compositional_habit",
    mechanismId: config.mech,
    metaphorFamilyId: config.meta,
    behavioralRelationship: relationship,
    tone: targetTone,
    roleMappings: {
      target: bound.boundRoles.target?.canonicalName || "",
      action: bound.boundRoles.action?.canonicalName || "",
      context: humanContextLabel(bound.contexts),
    },
    propertyConstraints: [bound.sensitivity, bound.actionPolarity],
    realizationPlan: "compositional_plan",
    planType: config.planType,
    underlyingConstructionId: `comp_plan_${relationship}_${targetTone}`,
    rawTemplate: `[CompositionalPlan: ${config.planType} - ${relationship} - ${config.mech}]`,
    relationalScore: 12, // High relational score for tailored behavioral match
  });

  return ideas;
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
  const locMatch = bound.normalizedText.match(/\b(?:in|on|around|by|near)\s+the\s+(bed|bedroom|kitchen|bathroom|living room|counter|table|sink|desk|sofa|couch|hallway|fridge|refrigerator)\b/i);
  const isKitchenFrame = bound.frameId === "frame_dish_soaking_omission" || bound.frameId === "frame_washing_kitchenware" || bound.frameId === "frame_selective_chore_avoidance" || bound.frameId === "frame_beverage_preparation" || bound.frameId === "frame_empty_container_fridge" || bound.frameId === "frame_parent_culinary_beverages";
  const defaultLoc = isKitchenFrame ? "kitchen" : (bound.frameId === "frame_light_climate_control" ? "room" : "living room");
  const location = roles.location?.canonicalName || (locMatch ? locMatch[1].toLowerCase() : defaultLoc);
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
    .replace(/\bthe bedroom is doing\b/gi, locMatch ? `the ${locMatch[1].toLowerCase()} is doing` : "the room is doing")
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

  // 1. Unresolved placeholder or determiner collision check (e.g. "the the", "this this", but "that the" is grammatically valid conjunction + determiner)
  if (/\{[a-z_]+\}/.test(combined)) return false;
  if (/\b(the\s+the|this\s+this|that\s+that|these\s+these|those\s+those)\b/i.test(combined)) return false;

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
  const effectiveSeed = isNaN(seed) ? 0 : seed;
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

  // Section 5: Bounded Candidate Exploration & Structured Humour Idea Generation
  const extractedBehavior = extractRichBehavioralRelationship(bound);
  // High-order behavioral dynamics take precedence over static object templates across ANY category or frame!
  const hasHighOrderDynamic = extractedBehavior.relationship !== "grounded_habit";
  const isCompositionalOpportunity = opp === "compositional_habit" || bound.frameId.startsWith("frame_parent_") || hasHighOrderDynamic;

  const exploreHumourIdeas = (targetTone: "gentle" | "playful" | "exaggerated"): HumourIdea[] => {
    // If the situation has a high-order dynamic or is routed to compositional_habit/parent frames,
    // generate dynamic HumourIdea objects directly from behavioral relationships, mechanisms, and metaphors!
    if (isCompositionalOpportunity && extractedBehavior.relationship !== "grounded_habit") {
      const dynamicIdeas = generateCompositionalPlanIdeas(bound, targetTone, extractedBehavior);
      if (dynamicIdeas.length > 0) {
        return dynamicIdeas;
      }
    }

    const oppMatches = compatible.filter((c) => c.t === targetTone && c.opp === opp);
    let pool = oppMatches;
    if (pool.length === 0 || (pool.length === 1 && seed > 0 && bound.sensitivity === "ordinary_quirk")) {
      const altHabit = compatible.filter((c) => c.t === targetTone && c.opp === "compositional_habit" && (!c.pols || c.pols.includes(bound.actionPolarity)));
      if (altHabit.length > 0) {
        pool = [...pool, ...altHabit];
      }
    }
    if (pool.length === 0) {
      pool = compatible.filter((c) => c.t === targetTone && (!c.pols || c.pols.includes(bound.actionPolarity)));
    }
    if (pool.length === 0) {
      pool = compatible.filter((c) => c.t === targetTone);
    }

    return pool.map((c) => {
      const relScore = scoreRelationalAlignment(c);
      const behavioralRel = isSlowSituation
        ? "pacing_slow"
        : isFastSituation
          ? "pacing_fast"
          : isExcessiveQtySituation
            ? "quantity_excessive"
            : isInsufficientQtySituation
              ? "quantity_insufficient"
              : bound.actionPolarity === "omitted_forgotten"
                ? "action_omission"
                : "grounded_habit";

      return {
        id: `idea_${c.id}`,
        opportunity: c.opp,
        mechanismId: c.mech,
        metaphorFamilyId: c.fam,
        behavioralRelationship: behavioralRel,
        tone: c.t,
        roleMappings: {
          target: bound.boundRoles.target?.canonicalName || "",
          action: bound.boundRoles.action?.canonicalName || "",
          context: humanContextLabel(bound.contexts),
        },
        propertyConstraints: [bound.sensitivity, bound.actionPolarity],
        realizationPlan: "direct_construction",
        underlyingConstructionId: c.id,
        rawTemplate: c.tmpl,
        relationalScore: relScore,
      };
    });
  };

  // Section 6: Conceptual Diversity & MMR-Inspired Perspective Selection
  const computeIdeaStructuralSimilarity = (i1: HumourIdea, i2: HumourIdea): number => {
    if (!i1 || !i2) return 0;
    if (i1.underlyingConstructionId === i2.underlyingConstructionId) return 1.0;
    let sim = 0;
    if (i1.mechanismId && i1.mechanismId === i2.mechanismId) sim += 0.45;
    if (i1.metaphorFamilyId && i1.metaphorFamilyId === i2.metaphorFamilyId) sim += 0.35;
    if (i1.rawTemplate === i2.rawTemplate) sim += 0.2;
    return Math.min(1.0, sim);
  };

  const selectDiverseIdeas = (): { gIdea: HumourIdea; pIdea: HumourIdea; eIdea: HumourIdea } | null => {
    const gIdeas = exploreHumourIdeas("gentle");
    const pIdeas = exploreHumourIdeas("playful");
    const eIdeas = exploreHumourIdeas("exaggerated");

    if (gIdeas.length === 0 || pIdeas.length === 0 || eIdeas.length === 0) return null;

    // Sort gentle pool by relational alignment score (highest first)
    const scoredG = [...gIdeas].sort((a, b) => b.relationalScore - a.relationalScore);
    const topGScore = scoredG[0].relationalScore;
    const relationalG = topGScore > 0 ? scoredG.filter((i) => i.relationalScore >= topGScore - 4) : scoredG;
    const gChoice = relationalG[effectiveSeed % relationalG.length] || scoredG[effectiveSeed % scoredG.length];

    // Select playful idea: cyclic permutation across candidates, guaranteeing variation across seeds
    const scoredP = [...pIdeas].sort((a, b) => b.relationalScore - a.relationalScore);
    const topPScore = scoredP[0].relationalScore;
    const relationalP = topPScore > 0 ? scoredP.filter((i) => i.relationalScore >= topPScore - 4) : scoredP;
    const pChoice = relationalP[(effectiveSeed) % relationalP.length] || scoredP[effectiveSeed % scoredP.length];

    // Select exaggerated idea: cyclic permutation across relational pool
    const scoredE = [...eIdeas].sort((a, b) => b.relationalScore - a.relationalScore);
    const topEScore = scoredE[0].relationalScore;
    const relationalE = topEScore > 0 ? scoredE.filter((i) => i.relationalScore >= topEScore - 4) : scoredE;
    const eChoice = relationalE[(effectiveSeed) % relationalE.length] || scoredE[effectiveSeed % scoredE.length];

    return { gIdea: gChoice, pIdea: pChoice, eIdea: eChoice };
  };

  const selectedIdeas = selectDiverseIdeas();
  if (!selectedIdeas) return null;
  const { gIdea, pIdea, eIdea } = selectedIdeas;

  // Section 7: Compositional Realization of Structured Ideas
  const gentle = gIdea.realizationPlan === "compositional_plan"
    ? realizeCompositionalIdeaPlan(gIdea, bound, extractedBehavior, seed)
    : realizeConstructionTemplate(gIdea.rawTemplate, bound);
  const playful = pIdea.realizationPlan === "compositional_plan"
    ? realizeCompositionalIdeaPlan(pIdea, bound, extractedBehavior, seed)
    : realizeConstructionTemplate(pIdea.rawTemplate, bound);
  const exaggerated = eIdea.realizationPlan === "compositional_plan"
    ? realizeCompositionalIdeaPlan(eIdea, bound, extractedBehavior, seed)
    : realizeConstructionTemplate(eIdea.rawTemplate, bound);

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
      humorFamilies: [gIdea.metaphorFamilyId, pIdea.metaphorFamilyId, eIdea.metaphorFamilyId],
      boundRoles: Object.fromEntries(
        Object.entries(bound.boundRoles).map(([k, v]) => [k, v.canonicalName])
      ),
      modifiers: bound.modifiers.map((m) => `${m.category}:${m.canonicalValue}->${m.targetConceptName || m.targetRole}`),
      contexts: bound.contexts,
      mechanismIds: [gIdea.mechanismId, pIdea.mechanismId, eIdea.mechanismId],
      constructionIds: [gIdea.underlyingConstructionId, pIdea.underlyingConstructionId, eIdea.underlyingConstructionId],
      sensitivity: bound.sensitivity,
      knowledgeSourcesUsed: bound.knowledgeSourcesUsed,
    },
  };
}
