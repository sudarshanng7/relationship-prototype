/**
 * scripts/knowledge/audit_constructions_v2.mjs
 *
 * Audits all 135 PG-HKB humor constructions for structural uniqueness,
 * compatibility rules, grammatical realization across multiple BoundSituations,
 * mock-authority cliché ratio, and generates 30 three-tone runtime examples +
 * 10x3 regeneration sequences.
 */

import fs from 'node:fs';
import { bindSituation } from '../../src/lib/knowledge-resolver.ts';
import { realizeConstructionTemplate } from '../../src/lib/pg-hkb-composer.ts';
import { generateLighterAnglesHybrid } from '../../src/lib/reframe-generator.ts';

const constructions = JSON.parse(fs.readFileSync('knowledge/humor/constructions/constructions.json', 'utf8'));

console.log(`--- Auditing ${constructions.length} PG-HKB Humor Constructions ---`);

const patternIds = new Set();
const duplicatePatterns = [];
const failedRealizations = [];
let boilerplateNewsCourtCount = 0;

// Sample situations spanning different opportunities
const testSituations = [
  bindSituation("making tea with just water and namesake milk"),
  bindSituation("brewing espresso with barely any oat milk"),
  bindSituation("talking too loud on the phone"),
  bindSituation("Not washing big utensils ever"),
  bindSituation("Wardrobe drawers are always half opened"),
  bindSituation("snoring loudly in bed at night"),
  bindSituation("taking forty-five minutes to put on shoes before leaving"),
  bindSituation("scrolling on phone during dinner"),
  bindSituation("leaving the bathroom light on all night"),
  bindSituation("always forgetting to water the houseplant"),
  bindSituation("leaving laundry folded on the chair for a week"),
  bindSituation("Sometimes too pushy to act on something I do not want to act")
];

const newsCourtRegex = /\b(breaking news|breaking bulletin|supreme|tribunal|court|authorities confirm|scientists confirm|official gazette)\b/i;

let executedCount = 0;
let multiSituationCount = 0;

for (const c of constructions) {
  if (patternIds.has(c.structuralPatternId)) {
    duplicatePatterns.push(c.id);
  }
  patternIds.add(c.structuralPatternId);

  if (newsCourtRegex.test(c.grammarTemplate)) {
    boilerplateNewsCourtCount++;
  }

  let validRuns = 0;
  for (const sit of testSituations) {
    // Check compatibility
    const isBoundary = sit.sensitivity === 'boundary_concern' || sit.sensitivity === 'serious_unsafe';
    const allowsBoundary = c.sensitivityRestrictions.includes('boundary_concern');
    if (isBoundary !== allowsBoundary) continue;

    const realized = realizeConstructionTemplate(c.grammarTemplate, sit);
    const unresolved = /\{[a-z_]+\}/.test(realized);
    const badGrammar = !/^[A-Z]/.test(realized) || !/[.!?"]$/.test(realized);
    if (unresolved || badGrammar) {
      failedRealizations.push({ id: c.id, realized, unresolved, badGrammar });
    } else {
      validRuns++;
    }
  }
  if (validRuns >= 1) executedCount++;
  if (validRuns >= 2) multiSituationCount++;
}

console.log(`Unique structuralPatternIds: ${patternIds.size}/${constructions.length}`);
console.log(`Duplicate structural patterns: ${duplicatePatterns.length}`);
console.log(`Successfully executed (>=1 situation): ${executedCount}/${constructions.length}`);
console.log(`Exercised across multiple situations (>=2): ${multiSituationCount}/${constructions.length}`);
console.log(`Failed grammatical/slot realizations: ${failedRealizations.length}`);
console.log(`Mock-news / court / scientist clichés: ${boilerplateNewsCourtCount}/${constructions.length} (${((boilerplateNewsCourtCount/constructions.length)*100).toFixed(1)}%)`);

// Generate 30 actual runtime 3-tone sets across domains & 10x3 regenerations
const sampleInputs30 = [
  "talking too loud on the phone",
  "making tea with just water and namesake milk",
  "brewing espresso with barely any oat milk",
  "Not washing big utensils ever",
  "keeps scrubbing the cast iron skillet in the sink",
  "Wardrobe drawers are always half opened",
  "kitchen cabinets pulled open and never pushed shut",
  "snoring like a revving chainsaw all night long",
  "burping loudly right after finishing dinner",
  "stealing the entire duvet at 3 AM",
  "hitting the alarm snooze button eight times every morning",
  "leaving every bathroom light blazing all night",
  "setting the air conditioner to Arctic temperatures",
  "taking forty-five minutes to put on shoes before leaving",
  "waiting by the door while partner looks for sunglasses",
  "scrolling on phone during dinner",
  "leaving wet towels on the bed every day",
  "putting empty milk cartons back inside the fridge",
  "leaving cardboard delivery boxes beside the sofa",
  "keeps dropping slippers right in the hallway",
  "never decides where to eat on Friday night",
  "talking loudly while I am trying to work on a call",
  "making weird noises during a serious conversation",
  "always forgetting to water the living room houseplant",
  "leaving clean laundry piled on the bedroom chair",
  "ignoring GPS directions and taking a scenic detour",
  "leaving one last square on the toilet roll cardboard",
  "bringing home the wrong cereal brand from groceries",
  "dropping toast crumbs all over the sofa cushions",
  "staying awake late reading while lamp shines in bed"
];

let polarityViolationCount = 0;
let runtimeFamilyCounts = {};
let distinctRegenRounds = 0;

console.log(`\n--- Generating 30 Actual Three-Tone Outputs (with 10x3 Regenerations) ---`);
const outputsLog = [];
for (let i = 0; i < sampleInputs30.length; i++) {
  const txt = sampleInputs30[i];
  const res0 = await generateLighterAnglesHybrid(null, { text: txt, seedModifier: 0, mode: 'local_only' });
  const pol = res0.outcome?.boundSituation?.actionPolarity;
  const comb = `${res0.angles.gentle.text} ${res0.angles.playful.text} ${res0.angles.exaggerated.text}`.toLowerCase();
  if ((pol === 'active' || pol === 'repeated' || pol === 'excessive') && /\b(soaking|bubble bath|unwashed|resting beside the drain)\b/i.test(comb)) {
    polarityViolationCount++;
  }
  for (const fam of res0.provenance?.humorFamilies || []) {
    runtimeFamilyCounts[fam] = (runtimeFamilyCounts[fam] || 0) + 1;
  }

  const entry = {
    input: txt,
    enginePath: res0.enginePath,
    outcome: res0.outcome?.type,
    frameId: res0.outcome?.boundSituation?.frameId || 'compositional',
    actionPolarity: pol,
    opportunity: res0.outcome?.boundSituation?.humorOpportunity,
    provenance: res0.provenance || null,
    seed0: {
      gentle: res0.angles.gentle.text,
      playful: res0.angles.playful.text,
      exaggerated: res0.angles.exaggerated.text,
    }
  };
  if (i < 10) {
    const res1 = await generateLighterAnglesHybrid(null, { text: txt, seedModifier: 1, mode: 'local_only' });
    const res2 = await generateLighterAnglesHybrid(null, { text: txt, seedModifier: 2, mode: 'local_only' });
    if (
      res0.angles.playful.text !== res1.angles.playful.text &&
      res1.angles.playful.text !== res2.angles.playful.text
    ) {
      distinctRegenRounds++;
    }
    entry.regenerations = [
      { seed: 1, humorFamilies: res1.provenance?.humorFamilies, gentle: res1.angles.gentle.text, playful: res1.angles.playful.text, exaggerated: res1.angles.exaggerated.text },
      { seed: 2, humorFamilies: res2.provenance?.humorFamilies, gentle: res2.angles.gentle.text, playful: res2.angles.playful.text, exaggerated: res2.angles.exaggerated.text },
    ];
  }
  outputsLog.push(entry);
}

console.log(`Polarity violations across 30 samples: ${polarityViolationCount}`);
console.log(`10x3 distinct playful regenerations: ${distinctRegenRounds}/10`);
console.log(`Runtime humorFamily distribution across 30 samples:`, runtimeFamilyCounts);

fs.writeFileSync('knowledge/benchmarks/phase5_30_generated_examples.json', JSON.stringify(outputsLog, null, 2));
console.log(`Saved 30 actual 3-tone examples + 10x3 regenerations to knowledge/benchmarks/phase5_30_generated_examples.json`);
