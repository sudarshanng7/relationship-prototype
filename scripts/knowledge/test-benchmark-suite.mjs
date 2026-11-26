/**
 * scripts/knowledge/test-benchmark-suite.mjs
 *
 * Runs the 360-case benchmark evaluating:
 * 1. Required concept existence
 * 2. Semantic frame existence
 * 3. Humor mechanism existence
 * 4. Construction existence
 */

import fs from 'node:fs';
import path from 'node:path';

function load(p) {
  return JSON.parse(fs.readFileSync(path.resolve(p), 'utf8'));
}

const suite = load('knowledge/benchmarks/benchmark_suite_360.json');
const concepts = new Set(load('knowledge/concepts/concepts.json').map(c => c.id));
const frames = new Set(load('knowledge/semantic-frames/frames.json').map(f => f.id));
const mechanisms = new Set(load('knowledge/humor/mechanisms/mechanisms.json').map(m => m.id));
const constructions = new Set(load('knowledge/humor/constructions/constructions.json').map(c => c.id));

console.log(`--- Running 360-Case Knowledge Coverage Benchmark ---`);
console.log(`Total benchmark cases: ${suite.length}`);

let passedConcepts = 0;
let passedFrames = 0;
let passedMechanisms = 0;
let passedConstructions = 0;
let fullyGrounded = 0;

for (const tc of suite) {
  const conceptsOk = tc.requiredConceptIds.every(cid => concepts.has(cid));
  const frameOk = frames.has(tc.requiredFrameId);
  const mechOk = mechanisms.has(tc.requiredMechanismId);
  const constOk = constructions.has(tc.requiredConstructionId);

  if (conceptsOk) passedConcepts++;
  if (frameOk) passedFrames++;
  if (mechOk) passedMechanisms++;
  if (constOk) passedConstructions++;

  if (conceptsOk && frameOk && mechOk && constOk) {
    fullyGrounded++;
  }
}

console.log(`\nBenchmark Results:`);
console.log(`  - Concept Grounding: ${passedConcepts}/${suite.length} (${(passedConcepts/suite.length*100).toFixed(1)}%)`);
console.log(`  - Semantic Frame Grounding: ${passedFrames}/${suite.length} (${(passedFrames/suite.length*100).toFixed(1)}%)`);
console.log(`  - Humor Mechanism Grounding: ${passedMechanisms}/${suite.length} (${(passedMechanisms/suite.length*100).toFixed(1)}%)`);
console.log(`  - Humor Construction Grounding: ${passedConstructions}/${suite.length} (${(passedConstructions/suite.length*100).toFixed(1)}%)`);
console.log(`  - Fully Grounded Cases: ${fullyGrounded}/${suite.length} (${(fullyGrounded/suite.length*100).toFixed(1)}%)`);

if (fullyGrounded !== suite.length) {
  console.error('Benchmark failed: not all cases fully grounded');
  process.exit(1);
} else {
  console.log('✔ All 360 benchmark cases across 36 domains verified.');
}
