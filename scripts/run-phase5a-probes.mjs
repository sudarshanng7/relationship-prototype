/**
 * scripts/run-phase5a-probes.mjs
 *
 * Phase 5A: 30 Development Probes Comparative Evaluation
 * Runs the authoritative pipeline in dual mode:
 * - Mode A: Graph DISABLED (options: { enableGraph: false })
 * - Mode B: Graph ENABLED (options: { enableGraph: true })
 *
 * Categories covered:
 * 1. Unfamiliar synonyms & related objects (dutch oven, coffeepot, brogan, blender, cupboard, slip-on, etc.)
 * 2. Taxonomic relationships (latte -> coffee, kettle -> pot, slipper -> shoe)
 * 3. Functional relationships (dishwasher used_for washing, refrigerator used_for food storage)
 * 4. Part-whole relationships (drawer part_of wardrobe, water part_of food)
 * 5. Contextual word-sense disambiguation (can, watch, light, sink, date, ring, down, stuff)
 * 6. Negative controls (unrelated concepts must not be falsely linked)
 * 7. Ambiguity controls (underspecified inputs route to clarification, not hallucinated frames)
 * 8. Safety controls (dangerous driving routes to reflection, ordinary driving remains quirk)
 */

import { bindSituation } from "../src/lib/knowledge-resolver.ts";
import { determineReframeOutcome } from "../src/lib/reframe-generator.ts";

export const PHASE_5A_PROBES = [
  // 1-5: Unfamiliar Synonyms & Subtypes (Taxonomic is_a)
  {
    id: "P01_dutch_oven",
    category: "unfamiliar_synonyms",
    text: "He leaves the dirty dutch oven sitting in the sink",
    expectedFrame: "frame_dish_soaking_omission",
    notes: "dutch oven -> is_a -> pot",
  },
  {
    id: "P02_coffeepot",
    category: "unfamiliar_synonyms",
    text: "She forgets to wash the coffeepot after breakfast",
    expectedFrame: "frame_dish_soaking_omission",
    notes: "coffeepot -> is_a -> pot",
  },
  {
    id: "P03_brogan_hallway",
    category: "unfamiliar_synonyms",
    text: "Leaving muddy brogans right in the front hallway",
    expectedFrame: "frame_object_displacement",
    notes: "brogan -> is_a -> shoe -> footwear",
  },
  {
    id: "P04_saucepan_scrubbing",
    category: "unfamiliar_synonyms",
    text: "Scrubbing the saucepan with intense vigor late at night",
    expectedFrame: "frame_active_cleaning_scrubbing",
    notes: "saucepan -> is_a -> pan -> cooking utensil",
  },
  {
    id: "P05_slip_on_door",
    category: "unfamiliar_synonyms",
    text: "Leaving slip-on shoes piled beside the door",
    expectedFrame: "frame_object_displacement",
    notes: "slip-on -> belonging / footwear",
  },

  // 6-10: Taxonomic Beverage & Appliance Hierarchies
  {
    id: "P06_caffe_latte",
    category: "taxonomic_hierarchy",
    text: "Putting barely any sugar into the caffe latte",
    expectedFrame: "frame_beverage_preparation",
    notes: "caffe latte -> is_a -> coffee",
  },
  {
    id: "P07_brass_kettle",
    category: "taxonomic_hierarchy",
    text: "Leaves the brass kettle soaking on the stove",
    expectedFrame: "frame_dish_soaking_omission",
    notes: "kettle -> is_a -> pot",
  },
  {
    id: "P08_blender_cleaning",
    category: "taxonomic_hierarchy",
    text: "She washed all the plates except the large blender",
    expectedFrame: "frame_selective_chore_avoidance",
    notes: "blender -> is_a -> mixer -> kitchen utensil",
  },
  {
    id: "P09_espresso_brewing",
    category: "taxonomic_hierarchy",
    text: "Spends ages pouring steamed milk into the espresso",
    expectedFrame: "frame_beverage_preparation",
    notes: "espresso -> beverage",
  },
  {
    id: "P10_slippers_trail",
    category: "taxonomic_hierarchy",
    text: "Leaving slippers parked in the middle of the kitchen",
    expectedFrame: "frame_object_displacement",
    notes: "slipper -> footwear",
  },

  // 11-14: Functional & Structural Relationships (used_for, part_of, used_in)
  {
    id: "P11_dishwasher_unstarted",
    category: "functional_relationships",
    text: "Loaded the dishwasher completely but forgot to start it",
    expectedFrame: "frame_appliance_unstarted",
    notes: "dishwasher used_for washing",
  },
  {
    id: "P12_refrigerator_door",
    category: "functional_relationships",
    text: "Left the refrigerator door slightly ajar all night",
    expectedFrame: "frame_open_drawer_organization",
    notes: "refrigerator used_for food storage",
  },
  {
    id: "P13_drawer_wardrobe",
    category: "part_whole_relationships",
    text: "Leaving the bedroom wardrobe drawer half open again",
    expectedFrame: "frame_open_drawer_organization",
    notes: "drawer part_of wardrobe, has_state open",
  },
  {
    id: "P14_milk_coffee_constituent",
    category: "functional_relationships",
    text: "Pouring barely any milk into the morning coffee",
    expectedFrame: "frame_beverage_preparation",
    notes: "milk used_in coffee",
  },

  // 15-22: Contextual Word-Sense Disambiguation Contrasts (8 contrasts)
  {
    id: "P15_can_modal",
    category: "word_sense_disambiguation",
    text: "He can never decide what we should eat for dinner",
    expectedFrame: "frame_decision_preference_mismatch",
    notes: "'can' is modal verb, not toilet or tin can",
  },
  {
    id: "P16_watch_temporal",
    category: "word_sense_disambiguation",
    text: "He keeps watching detective shows until 3am",
    expectedFrame: "frame_subjective_preference_contrast",
    notes: "'watch' is viewing verb, not wristwatch",
  },
  {
    id: "P17_light_lighting",
    category: "word_sense_disambiguation",
    text: "Leaving the overhead lights switched on in the hallway",
    expectedFrame: "frame_active_illumination_persistence",
    notes: "'light' is illumination source, not light weight or ignite",
  },
  {
    id: "P18_sink_basin",
    category: "word_sense_disambiguation",
    text: "Leaving dirty mugs soaking in the kitchen sink",
    expectedFrame: "frame_dish_soaking_omission",
    notes: "'sink' is plumbing fixture basin, not downward descent verb",
  },
  {
    id: "P19_date_social",
    category: "word_sense_disambiguation",
    text: "He is always forty-five minutes late for our dinner date",
    expectedFrame: "frame_punctuality_departure_delay",
    notes: "'date' is social meeting appointment, not palm fruit or calendar day",
  },
  {
    id: "P20_ring_acoustic",
    category: "word_sense_disambiguation",
    text: "Forgetting to switch off the morning alarm while it keeps ringing",
    expectedFrame: "frame_alarm_switch_off_omission",
    notes: "'ring' is acoustic alarm sound, not finger jewellery",
  },
  {
    id: "P21_down_particle",
    category: "word_sense_disambiguation",
    text: "Putting down keys in random spots around the apartment",
    expectedFrame: "frame_object_displacement",
    notes: "'down' is phrasal particle, not bird plumage or sadness",
  },
  {
    id: "P22_stuff_belongings",
    category: "word_sense_disambiguation",
    text: "Forgetting about the stuff that was placed by the front door",
    expectedFrame: "frame_object_displacement",
    notes: "'stuff' is personal belongings, not verb to cram or culinary dressing",
  },

  // 23-26: Phase 4C.1 Operational Defect Regressions
  {
    id: "P23_fridge_browsing_no_depletion",
    category: "phase4c1_defect_regression",
    text: "She stands staring into the fridge without choosing anything",
    expectedOutcome: "clarification_needed",
    forbiddenFrame: "frame_empty_container_fridge",
    notes: "Fridge browsing must NOT route to empty container reframe",
  },
  {
    id: "P24_eating_pace_not_target",
    category: "phase4c1_defect_regression",
    text: "She eats too slow",
    expectedTarget: "food",
    expectedActionModifier: "slow",
    forbiddenTarget: "eating pace",
    notes: "Natural target is food; speed modifier attaches to action",
  },
  {
    id: "P25_singing_loudly_kitchen",
    category: "phase4c1_defect_regression",
    text: "Singing loudly in the kitchen while cooking dinner",
    expectedAction: "sing",
    expectedContext: "ctx_cooking",
    notes: "Singing must not trigger hardcoded redirect bypass",
  },
  {
    id: "P26_dangerous_driving_safety",
    category: "safety_boundary",
    text: "He drives dangerously fast on the highway",
    expectedOutcome: "respectful_reflection",
    forbiddenOutcome: "playful_angles",
    notes: "Explicit danger routes to reflection without requiring refusal phrase",
  },

  // 27-28: Negative Controls (Unrelated Concepts Must Not False-Match)
  {
    id: "P27_negative_unrelated_astronomy",
    category: "negative_control",
    text: "Observing Jupiter through a telescope from the balcony",
    expectedOutcome: "clarification_needed",
    forbiddenFrame: "frame_active_illumination_persistence",
    notes: "Astronomical observation must not trigger light or domestic frames",
  },
  {
    id: "P28_negative_financial_statement",
    category: "negative_control",
    text: "Reviewing quarterly bank statements on the kitchen table",
    expectedOutcome: "clarification_needed",
    forbiddenFrame: "frame_dish_soaking_omission",
    notes: "Paperwork must not trigger dish soaking or kitchen chore frames",
  },

  // 29-30: Ambiguity & Continuation Controls
  {
    id: "P29_ordinary_driving_quirk",
    category: "ambiguity_control",
    text: "He drives too fast on the highway",
    expectedOutcome: "clarification_needed",
    forbiddenOutcome: "respectful_reflection",
    notes: "'too fast' alone is speed modifier quirk, not explicit reckless driving",
  },
  {
    id: "P30_neutral_continuation",
    category: "neutral_continuation",
    text: "He forgets promises we made last weekend",
    expectedMessageSubstring: "Let's leave this one as it is. We don't have a lighter angle that quite fits this moment yet.",
    forbiddenMessageSubstring: "coming soon",
    notes: "No promising future roadmap updates in customer response",
  },
];

export async function runComparativeEvaluation() {
  console.log("================================================================================");
  console.log("PURPLE GARDEN — PHASE 5A: 30-PROBE COMPARATIVE EVALUATION");
  console.log("Graph DISABLED vs Graph ENABLED");
  console.log("================================================================================\n");

  const results = [];
  let disabledPassCount = 0;
  let enabledPassCount = 0;
  let totalGraphQueries = 0;
  let totalGraphPathsFound = 0;
  let totalLatencyMs = 0;

  for (let i = 0; i < PHASE_5A_PROBES.length; i++) {
    const probe = PHASE_5A_PROBES[i];
    const num = String(i + 1).padStart(2, "0");

    // Run Mode A: Graph Disabled
    const startA = performance.now();
    const boundA = bindSituation(probe.text, { enableGraph: false });
    const latencyA = performance.now() - startA;
    const outcomeA = determineReframeOutcome(boundA, { gentle: {}, playful: {}, reframing: {} });

    // Run Mode B: Graph Enabled
    const startB = performance.now();
    const boundB = bindSituation(probe.text, { enableGraph: true });
    const latencyB = performance.now() - startB;
    const outcomeB = determineReframeOutcome(boundB, { gentle: {}, playful: {}, reframing: {} });

    totalGraphQueries += boundB.graphProvenance?.queriesCount || 0;
    totalGraphPathsFound += boundB.graphProvenance?.pathsFoundCount || 0;
    totalLatencyMs += boundB.graphProvenance?.latencyMs || latencyB;

    // Evaluate Mode A pass/fail
    const passA = evaluateProbePass(probe, boundA, outcomeA);
    if (passA.passed) disabledPassCount++;

    // Evaluate Mode B pass/fail
    const passB = evaluateProbePass(probe, boundB, outcomeB);
    if (passB.passed) enabledPassCount++;

    results.push({
      id: probe.id,
      text: probe.text,
      category: probe.category,
      modeA: {
        frameId: boundA.frameId,
        outcomeType: boundA.outcomeType,
        target: boundA.boundRoles.target?.canonicalName,
        passed: passA.passed,
        reason: passA.reason,
      },
      modeB: {
        frameId: boundB.frameId,
        outcomeType: boundB.outcomeType,
        target: boundB.boundRoles.target?.canonicalName,
        passed: passB.passed,
        reason: passB.reason,
        provenance: boundB.graphProvenance,
      },
    });

    const statusDiff = passA.passed !== passB.passed ? (passB.passed ? " [BENEFIT: +1 ACCURACY]" : " [REGRESSION]") : " [NEUTRAL]";
    console.log(`Probe #${num} [${probe.id}]:`);
    console.log(`  Input: "${probe.text}"`);
    console.log(`  Mode A (Disabled): frame=${boundA.frameId} (${passA.passed ? "PASS" : "FAIL: " + passA.reason})`);
    console.log(`  Mode B (Enabled):  frame=${boundB.frameId} (${passB.passed ? "PASS" : "FAIL: " + passB.reason}) ${statusDiff}`);
    if (boundB.graphProvenance?.pathsUsed?.length > 0) {
      console.log(`  Graph Paths: ${boundB.graphProvenance.pathsUsed.join("; ")}`);
    }
    console.log();
  }

  console.log("================================================================================");
  console.log("EVALUATION SUMMARY");
  console.log(`Total Probes: ${PHASE_5A_PROBES.length}`);
  console.log(`Graph DISABLED Accuracy: ${disabledPassCount} / ${PHASE_5A_PROBES.length} (${((disabledPassCount / PHASE_5A_PROBES.length) * 100).toFixed(1)}%)`);
  console.log(`Graph ENABLED Accuracy:  ${enabledPassCount} / ${PHASE_5A_PROBES.length} (${((enabledPassCount / PHASE_5A_PROBES.length) * 100).toFixed(1)}%)`);
  console.log(`Net Knowledge Benefit:   +${enabledPassCount - disabledPassCount} probes correctly resolved`);
  console.log(`Total Graph Queries:     ${totalGraphQueries}`);
  console.log(`Total Paths Discovered:  ${totalGraphPathsFound}`);
  console.log(`Average Latency:         ${(totalLatencyMs / PHASE_5A_PROBES.length).toFixed(2)} ms / probe`);
  console.log("================================================================================\n");

  return {
    total: PHASE_5A_PROBES.length,
    disabledPassCount,
    enabledPassCount,
    totalGraphQueries,
    totalGraphPathsFound,
    averageLatencyMs: totalLatencyMs / PHASE_5A_PROBES.length,
    results,
  };
}

function evaluateProbePass(probe, bound, outcome) {
  if (probe.expectedFrame && bound.frameId !== probe.expectedFrame) {
    return { passed: false, reason: `Expected frame ${probe.expectedFrame}, got ${bound.frameId}` };
  }
  if (probe.forbiddenFrame && bound.frameId === probe.forbiddenFrame) {
    return { passed: false, reason: `Forbidden frame ${probe.forbiddenFrame} selected` };
  }
  if (probe.expectedOutcome && bound.outcomeType !== probe.expectedOutcome) {
    return { passed: false, reason: `Expected outcome ${probe.expectedOutcome}, got ${bound.outcomeType}` };
  }
  if (probe.forbiddenOutcome && bound.outcomeType === probe.forbiddenOutcome) {
    return { passed: false, reason: `Forbidden outcome ${probe.forbiddenOutcome} triggered` };
  }
  if (probe.expectedTarget && bound.boundRoles.target?.canonicalName !== probe.expectedTarget) {
    return { passed: false, reason: `Expected target ${probe.expectedTarget}, got ${bound.boundRoles.target?.canonicalName}` };
  }
  if (probe.forbiddenTarget && bound.boundRoles.target?.canonicalName === probe.forbiddenTarget) {
    return { passed: false, reason: `Forbidden target ${probe.forbiddenTarget} bound` };
  }
  const combinedMsg = `${bound.clarificationMessage || ""} ${outcome?.continuationTitle || ""} ${outcome?.continuationBody || ""}`;
  if (probe.expectedMessageSubstring && !combinedMsg.includes(probe.expectedMessageSubstring)) {
    return { passed: false, reason: `Message missing substring: "${probe.expectedMessageSubstring}"` };
  }
  if (probe.forbiddenMessageSubstring && combinedMsg.includes(probe.forbiddenMessageSubstring)) {
    return { passed: false, reason: `Message contains forbidden substring: "${probe.forbiddenMessageSubstring}"` };
  }
  return { passed: true };
}

// Execute if run directly
if (process.argv[1]?.endsWith("run-phase5a-probes.mjs")) {
  runComparativeEvaluation().catch((err) => {
    console.error("Evaluation failed:", err);
    process.exit(1);
  });
}
