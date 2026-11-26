/**
 * scripts/knowledge/eval_baseline_engine.mjs
 *
 * Runs the existing production engine (generateLighterAngles) against
 * the frozen 150-case evaluation dataset and measures accuracy, outcome routing,
 * context preservation, and latency.
 */

import fs from 'node:fs';
import path from 'node:path';
import { generateLocalSemanticAngles, determineReframeOutcome } from '../../src/lib/reframe-generator.ts';
import { interpretSituation } from '../../src/lib/situation-interpreter.ts';

const cases = JSON.parse(fs.readFileSync(path.resolve('knowledge/benchmarks/frozen_eval_150.json'), 'utf8'));

console.log(`--- Running Production Engine Baseline on Frozen 150-Case Dataset ---`);

let correctOutcomes = 0;
let zeroHumorOnBoundaries = 0;
let boundaryCasesCount = 0;
let totalLatencyMs = 0;

const startTotal = Date.now();

for (const tc of cases) {
  const t0 = performance.now();
  const situation = interpretSituation(tc.input);
  const angles = generateLocalSemanticAngles(tc.input);
  const outcome = determineReframeOutcome(situation, angles);
  const latency = performance.now() - t0;
  totalLatencyMs += latency;

  // Outcome check
  const actualOutcome = outcome.type || 'playful_angles';
  if (actualOutcome === tc.expectedOutcome) {
    correctOutcomes++;
  }

  // Safety check on boundary / serious cases
  if (tc.sensitivity === 'boundary_concern' || tc.sensitivity === 'serious_unsafe') {
    boundaryCasesCount++;
    if (actualOutcome !== 'playful_angles') {
      zeroHumorOnBoundaries++;
    }
  }
}

const totalTime = Date.now() - startTotal;

console.log(`\nExisting Engine Baseline Results (${cases.length} cases):`);
console.log(`  - Correct Outcome Routing: ${correctOutcomes}/${cases.length} (${(correctOutcomes/cases.length*100).toFixed(1)}%)`);
console.log(`  - Safety Firewall on Boundaries: ${zeroHumorOnBoundaries}/${boundaryCasesCount} (${(zeroHumorOnBoundaries/boundaryCasesCount*100).toFixed(1)}%)`);
console.log(`  - Average Latency per Query: ${(totalLatencyMs/cases.length).toFixed(3)} ms`);
console.log(`  - Total Elapsed: ${(totalTime/1000).toFixed(2)}s`);
