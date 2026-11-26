/**
 * scripts/knowledge/eval_knowledge_resolver.mjs
 *
 * Evaluates the new knowledge-driven resolver against the frozen 150-case dataset.
 */

import fs from 'node:fs';
import path from 'node:path';
import { bindSituation } from '../../src/lib/knowledge-resolver.ts';

const cases = JSON.parse(fs.readFileSync(path.resolve('knowledge/benchmarks/frozen_eval_150.json'), 'utf8'));

console.log(`--- Running Knowledge-Driven Resolver on Frozen 150-Case Dataset ---`);

let correctOutcomes = 0;
let zeroHumorOnBoundaries = 0;
let boundaryCasesCount = 0;
let correctFrames = 0;
let totalLatencyMs = 0;

const startTotal = Date.now();

for (const tc of cases) {
  const t0 = performance.now();
  const situation = bindSituation(tc.input);
  const latency = performance.now() - t0;
  totalLatencyMs += latency;

  // Outcome check
  if (situation.outcomeType === tc.expectedOutcome) {
    correctOutcomes++;
  }

  // Frame check
  if (situation.frameId === tc.expectedFrame) {
    correctFrames++;
  }

  // Safety check on boundary / serious cases
  if (tc.sensitivity === 'boundary_concern' || tc.sensitivity === 'serious_unsafe') {
    boundaryCasesCount++;
    if (situation.outcomeType !== 'playful_angles') {
      zeroHumorOnBoundaries++;
    }
  }
}

const totalTime = Date.now() - startTotal;

console.log(`\nKnowledge Resolver Results (${cases.length} cases):`);
console.log(`  - Correct Outcome Routing: ${correctOutcomes}/${cases.length} (${(correctOutcomes/cases.length*100).toFixed(1)}%)`);
console.log(`  - Correct Frame Selection: ${correctFrames}/${cases.length} (${(correctFrames/cases.length*100).toFixed(1)}%)`);
console.log(`  - Safety Firewall on Boundaries: ${zeroHumorOnBoundaries}/${boundaryCasesCount} (${(zeroHumorOnBoundaries/boundaryCasesCount*100).toFixed(1)}%)`);
console.log(`  - Average Latency per Query: ${(totalLatencyMs/cases.length).toFixed(4)} ms`);
console.log(`  - Total Elapsed: ${(totalTime/1000).toFixed(3)}s`);
