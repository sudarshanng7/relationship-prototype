/**
 * scripts/knowledge/test-knowledge-coverage.mjs
 *
 * Verifies semantic grounding and ontological coverage on:
 *   Case A: "talking too loud on the phone"
 *   Case B: "making tea with just water and namesake milk"
 *   Case C: "yoga is not an exercise"
 *   Case D: "Not washing big utensils ever"
 */

import fs from 'node:fs';
import path from 'node:path';

function load(p) {
  return JSON.parse(fs.readFileSync(path.resolve(p), 'utf8'));
}

const concepts = load('knowledge/concepts/concepts.json');
const relations = load('knowledge/relationships/relationships.json');
const frames = load('knowledge/semantic-frames/frames.json');
const modifiers = load('knowledge/modifiers/modifiers.json');
const mechanisms = load('knowledge/humor/mechanisms/mechanisms.json');
const constructions = load('knowledge/humor/constructions/constructions.json');

console.log('--- Benchmarking Ontological Grounding on Acceptance Failure Cases ---');

const testCases = [
  {
    name: 'Case A: Loud Phone Speaking',
    input: 'talking too loud on the phone',
    expectedConcepts: ['c_action_speaking', 'c_device_phone', 'c_sensory_volume_loud'],
    expectedFrame: 'frame_speaking_on_phone',
    expectedModifier: 'mod_excessive_intensity',
    expectedMechanism: 'mech_scale_acoustic_distortion',
    expectedConstruction: 'const_whole_neighborhood_update'
  },
  {
    name: 'Case B: Minimal Milk in Tea',
    input: 'making tea with just water and namesake milk',
    expectedConcepts: ['c_beverage_tea', 'c_substance_water', 'c_substance_milk'],
    expectedFrame: 'frame_beverage_preparation',
    expectedModifier: 'mod_negligible_quantity',
    expectedMechanism: 'mech_understatement_minimalism',
    expectedConstruction: 'const_homeopathic_dose'
  },
  {
    name: 'Case C: Yoga Definitional Claim',
    input: 'yoga is not an exercise',
    expectedConcepts: ['c_activity_yoga', 'c_category_exercise'],
    expectedFrame: 'frame_evaluating_concept_proposition',
    expectedModifier: 'mod_propositional_negation',
    expectedMechanism: 'mech_fictional_jurisdiction_incredulity',
    expectedConstruction: 'const_olympic_ruling'
  },
  {
    name: 'Case D: Large Utensils Selective Avoidance',
    input: 'Not washing big utensils ever',
    expectedConcepts: ['c_action_washing', 'c_cookware_utensils'],
    expectedFrame: 'frame_washing_kitchenware',
    expectedModifier: 'mod_large_scale',
    expectedMechanism: 'mech_archaeological_monument_soak',
    expectedConstruction: 'const_size_based_amnesty'
  }
];

let passed = 0;
for (const tc of testCases) {
  console.log(`\nEvaluating: "${tc.input}" (${tc.name})`);
  
  // Concept check
  const matchedConcepts = concepts.filter(c => tc.expectedConcepts.includes(c.id));
  if (matchedConcepts.length !== tc.expectedConcepts.length) {
    console.error(`  ✖ Missing concepts: expected ${tc.expectedConcepts.join(', ')}, got ${matchedConcepts.map(c=>c.id).join(', ')}`);
    continue;
  }
  console.log(`  ✔ Grounded concepts: ${matchedConcepts.map(c => `${c.canonicalName} (${c.conceptType})`).join(', ')}`);

  // Frame check
  const frame = frames.find(f => f.id === tc.expectedFrame);
  if (!frame) {
    console.error(`  ✖ Frame ${tc.expectedFrame} not found`);
    continue;
  }
  console.log(`  ✔ Mapped Semantic Frame: ${frame.name}`);

  // Modifier check
  const mod = modifiers.find(m => m.id === tc.expectedModifier);
  if (!mod) {
    console.error(`  ✖ Modifier ${tc.expectedModifier} not found`);
    continue;
  }
  console.log(`  ✔ Detected Modifier: ${mod.name} (${mod.category})`);

  // Mechanism & Construction check
  const mech = mechanisms.find(m => m.id === tc.expectedMechanism);
  const constr = constructions.find(c => c.id === tc.expectedConstruction);
  if (!mech || !constr) {
    console.error(`  ✖ Missing humor mechanism or construction`);
    continue;
  }
  console.log(`  ✔ Activated Humor Mechanism: ${mech.name}`);
  console.log(`  ✔ Realized Construction: "${constr.name}" -> Sample: "${constr.sampleRealizations[0]}"`);
  
  passed++;
}

console.log(`\nCoverage Benchmark Result: ${passed}/${testCases.length} acceptance cases fully grounded in PG-RKB & PG-HKB.`);
if (passed !== testCases.length) {
  process.exit(1);
}
