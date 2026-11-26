/**
 * scripts/knowledge/eval_phase41_suite.mjs
 *
 * Runs:
 * 1) 7-category comparative evaluation (140 cases): Legacy Engine vs Knowledge-Enriched Engine
 *    measuring Outcome Routing, Frame Selection, Role Binding, Modifier Attachment,
 *    Context Preservation, Clarification Rates, Boundary Firewall, and Stage-by-Stage Latency.
 * 2) Out-of-Knowledge Benchmark (65 cases across Categories A-F and Levels 1-5).
 */

import fs from 'node:fs';
import { interpretSituation } from '../../src/lib/situation-interpreter.ts';
import { composeAngles } from '../../src/lib/tone-composer.ts';
import {
  generateLocalSemanticAngles,
  generateLighterAnglesHybrid,
  determineReframeOutcome,
} from '../../src/lib/reframe-generator.ts';
import { bindSituation } from '../../src/lib/knowledge-resolver.ts';
import { composeFromPgHkb } from '../../src/lib/pg-hkb-composer.ts';

const everyday = JSON.parse(fs.readFileSync('knowledge/benchmarks/eval_phase41_everyday_140.json', 'utf8'));
const ook = JSON.parse(fs.readFileSync('knowledge/benchmarks/eval_phase41_ook_65.json', 'utf8'));

console.log(`=== PHASE 4.1 COMPARATIVE EVALUATION (N = ${everyday.length}) ===`);

const byCat = {};
let baseOutcomeTotal = 0, krOutcomeTotal = 0;
let baseSafetyTotal = 0, krSafetyTotal = 0, safetyDenom = 0;
let frameExpectedDenom = 0, krFrameOk = 0;
let modExpectedDenom = 0, krModOk = 0;
let ctxExpectedDenom = 0, krCtxOk = 0;
let roleOkCount = 0;

// Timing accumulators
let tLegacyInterp = 0, tLegacyCompose = 0, tLegacyFull = 0;
let tKrBind = 0, tKrCompose = 0, tKrFull = 0;

for (const tc of everyday) {
  if (!byCat[tc.category]) {
    byCat[tc.category] = {
      n: 0,
      baseOutcomeOk: 0,
      krOutcomeOk: 0,
      frameDenom: 0,
      krFrameOk: 0,
      roleOk: 0,
      modDenom: 0,
      krModOk: 0,
      ctxDenom: 0,
      krCtxOk: 0,
      krClarifCount: 0,
      baseClarifCount: 0,
      wrongConfidentBase: 0,
      wrongConfidentKr: 0,
    };
  }
  const c = byCat[tc.category];
  c.n++;

  // Legacy path (without knowledge resolver)
  const l0 = performance.now();
  const lSit = interpretSituation(tc.input);
  const l1 = performance.now();
  const lAng = composeAngles(lSit, 0);
  const lOut = determineReframeOutcome(lSit, lAng);
  const l2 = performance.now();
  tLegacyInterp += (l1 - l0);
  tLegacyCompose += (l2 - l1);
  tLegacyFull += (l2 - l0);

  if (lOut.type === tc.expectedOutcome) {
    baseOutcomeTotal++;
    c.baseOutcomeOk++;
  } else if (lOut.type === 'playful_angles' && tc.expectedOutcome !== 'playful_angles') {
    c.wrongConfidentBase++;
  }
  if (lOut.type === 'clarification_needed') c.baseClarifCount++;

  // Knowledge-Enriched path
  const k0 = performance.now();
  const bound = bindSituation(tc.input);
  const k1 = performance.now();
  const res = await generateLighterAnglesHybrid(null, { text: tc.input, seedModifier: 0, mode: 'local_only' });
  const k2 = performance.now();
  tKrBind += (k1 - k0);
  tKrCompose += (k2 - k1);
  tKrFull += (k2 - k0);

  const krOutType = res.outcome?.type || bound.outcomeType;
  if (krOutType === tc.expectedOutcome) {
    krOutcomeTotal++;
    c.krOutcomeOk++;
  } else if (krOutType === 'playful_angles' && tc.expectedOutcome !== 'playful_angles') {
    c.wrongConfidentKr++;
  }
  if (krOutType === 'clarification_needed') c.krClarifCount++;

  // Frame, role, modifier, context checks
  if (tc.expectedFrame) {
    frameExpectedDenom++;
    c.frameDenom++;
    if (bound.frameId === tc.expectedFrame) {
      krFrameOk++;
      c.krFrameOk++;
    }
  }
  if (tc.expectedModifier) {
    modExpectedDenom++;
    c.modDenom++;
    if (bound.modifiers.some(m => m.canonicalValue === tc.expectedModifier || m.category === tc.expectedModifier)) {
      krModOk++;
      c.krModOk++;
    }
  }
  if (tc.expectedContext) {
    ctxExpectedDenom++;
    c.ctxDenom++;
    if (bound.contexts.includes(tc.expectedContext)) {
      krCtxOk++;
      c.krCtxOk++;
    }
  }
  if (Object.keys(bound.boundRoles).length > 0 || bound.resolutionLevel <= 3 || bound.outcomeType !== 'playful_angles') {
    roleOkCount++;
    c.roleOk++;
  }

  // Safety denominator
  if (tc.sensitivity === 'boundary_concern' || tc.sensitivity === 'serious_unsafe') {
    safetyDenom++;
    if (lOut.type !== 'playful_angles') baseSafetyTotal++;
    if (krOutType !== 'playful_angles') krSafetyTotal++;
  }
}

console.log('\nCategory Breakdown (140 cases):');
for (const [cat, s] of Object.entries(byCat)) {
  console.log(`  [${cat}] n=${s.n} | BaseOutcome=${s.baseOutcomeOk}/${s.n} | KrOutcome=${s.krOutcomeOk}/${s.n} | Frame=${s.krFrameOk}/${s.frameDenom} | Mod=${s.krModOk}/${s.modDenom} | Ctx=${s.krCtxOk}/${s.ctxDenom} | BaseWrongConf=${s.wrongConfidentBase} | KrWrongConf=${s.wrongConfidentKr}`);
}

console.log(`\nOverall Summary (140 cases):`);
console.log(`  - Baseline Outcome Accuracy: ${baseOutcomeTotal}/${everyday.length} (${(baseOutcomeTotal/everyday.length*100).toFixed(1)}%)`);
console.log(`  - Knowledge-Enriched Outcome Accuracy: ${krOutcomeTotal}/${everyday.length} (${(krOutcomeTotal/everyday.length*100).toFixed(1)}%)`);
console.log(`  - Baseline Boundary/Serious Protection: ${baseSafetyTotal}/${safetyDenom} (${(baseSafetyTotal/safetyDenom*100).toFixed(1)}%)`);
console.log(`  - Knowledge-Enriched Boundary/Serious Protection: ${krSafetyTotal}/${safetyDenom} (${(krSafetyTotal/safetyDenom*100).toFixed(1)}%)`);
console.log(`  - Frame Selection Accuracy (where specified): ${krFrameOk}/${frameExpectedDenom} (${(krFrameOk/frameExpectedDenom*100).toFixed(1)}%)`);
console.log(`  - Modifier Attachment Accuracy (where specified): ${krModOk}/${modExpectedDenom} (${(krModOk/modExpectedDenom*100).toFixed(1)}%)`);
console.log(`  - Context Preservation Accuracy (where specified): ${krCtxOk}/${ctxExpectedDenom} (${(krCtxOk/ctxExpectedDenom*100).toFixed(1)}%)`);
console.log(`\nComparable Latency per Query (140-case avg):`);
console.log(`  - Legacy Engine: interp=${(tLegacyInterp/everyday.length).toFixed(3)}ms, compose=${(tLegacyCompose/everyday.length).toFixed(3)}ms, full=${(tLegacyFull/everyday.length).toFixed(3)}ms`);
console.log(`  - Knowledge-Enriched: bind=${(tKrBind/everyday.length).toFixed(3)}ms, fullStage2=${(tKrFull/everyday.length).toFixed(3)}ms`);

console.log(`\n=== OUT-OF-KNOWLEDGE BENCHMARK (N = ${ook.length}) ===`);
const ookByCat = {};
let ookOk = 0;
const levelDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

for (const tc of ook) {
  if (!ookByCat[tc.category]) ookByCat[tc.category] = { n: 0, ok: 0, samples: [] };
  const s = ookByCat[tc.category];
  s.n++;

  const bound = bindSituation(tc.input);
  levelDist[bound.resolutionLevel]++;
  const res = await generateLighterAnglesHybrid(null, { text: tc.input, seedModifier: 0, mode: 'local_only' });
  const actual = res.outcome?.type || bound.outcomeType;

  if (actual === tc.expectedOutcome) {
    ookOk++;
    s.ok++;
  } else {
    s.samples.push({ input: tc.input, expected: tc.expectedOutcome, got: actual, level: bound.resolutionLevel });
  }
}

for (const [cat, s] of Object.entries(ookByCat)) {
  console.log(`  [${cat}] ${s.ok}/${s.n} passed`);
  if (s.samples.length > 0) console.log(`    Mismatches:`, s.samples);
}
console.log(`Overall Out-of-Knowledge Accuracy: ${ookOk}/${ook.length} (${(ookOk/ook.length*100).toFixed(1)}%)`);
console.log(`Resolution Level Distribution:`, levelDist);
