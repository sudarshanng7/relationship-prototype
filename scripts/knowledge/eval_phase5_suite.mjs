/**
 * scripts/knowledge/eval_phase5_suite.mjs
 *
 * Phase 5 Authoritative Evaluation & Latency Comparison Suite:
 * 1) 140-case 7-category metrics: "authoritative" (PG-RKB + PG-HKB) vs "legacy_rollback"
 *    measuring exact & acceptable alternative frame accuracy, polarity, role binding, modifiers,
 *    context preservation, unnecessary clarification, boundary/serious firewall.
 * 2) 65-case Out-of-Knowledge benchmark across Levels 1-5.
 * 3) 52-case dedicated Semantic Integrity Benchmark (polarity, non-contamination, attachments, safety).
 * 4) Comparable Full-Pipeline Latency Breakdown (bundle load, lexical lookup, frame binding,
 *    safety firewall, PG-HKB selection & realization, quality guard, regeneration).
 */

import fs from 'node:fs';
import {
  bindSituation,
  evaluateSafety,
  resolveConceptsAndVerbs,
  resolveAndAttachModifiers,
} from '../../src/lib/knowledge-resolver.ts';
import { composeFromPgHkb } from '../../src/lib/pg-hkb-composer.ts';
import {
  AUTHORITATIVE_ENGINE_MODE,
  generateAuthoritativeDetails,
  generateLighterAnglesHybrid,
} from '../../src/lib/reframe-generator.ts';
import { validateReframeQuality } from '../../src/lib/reframe-quality-guard.ts';

const eval140 = JSON.parse(fs.readFileSync('knowledge/benchmarks/eval_phase5_everyday_140.json', 'utf8'));
const ook65 = JSON.parse(fs.readFileSync('knowledge/benchmarks/eval_phase41_ook_65.json', 'utf8'));
const si52 = JSON.parse(fs.readFileSync('knowledge/benchmarks/eval_phase5_semantic_integrity_52.json', 'utf8'));

console.log(`Active Production AUTHORITATIVE_ENGINE_MODE = "${AUTHORITATIVE_ENGINE_MODE}"`);

// =============================================================
// 1. 140-CASE EVALUATION ("authoritative" vs "legacy_rollback")
// =============================================================
console.log(`\n=== 1. PHASE 5 140-CASE EVALUATION (N = ${eval140.length}) ===`);

const byCat = {};
let legOutOk = 0, authOutOk = 0;
let legSafOk = 0, authSafOk = 0, safDenom = 0;
let frameDenom = 0, exactFrameOk = 0, altFrameOk = 0;
let modDenom = 0, modOk = 0;
let ctxDenom = 0, ctxOk = 0;
let roleOk = 0;
let unnecessaryClarifAuth = 0, unnecessaryClarifLeg = 0;

let tLegFull = 0, tAuthBind = 0, tAuthFull = 0, tAuthRegen = 0;

for (const tc of eval140) {
  if (!byCat[tc.category]) {
    byCat[tc.category] = {
      n: 0, legOut: 0, authOut: 0, frameDenom: 0, exactF: 0, altF: 0, modDenom: 0, modOk: 0, ctxDenom: 0, ctxOk: 0,
    };
  }
  const c = byCat[tc.category];
  c.n++;

  // Explicit rollback mode
  const l0 = performance.now();
  const legRes = await generateLighterAnglesHybrid(null, { text: tc.input, seedModifier: 0, mode: 'local_only', engineMode: 'legacy_rollback' });
  const l1 = performance.now();
  tLegFull += (l1 - l0);

  if (legRes.outcome.type === tc.expectedOutcome) {
    legOutOk++;
    c.legOut++;
  }
  if (tc.expectedOutcome === 'playful_angles' && legRes.outcome.type === 'clarification_needed') {
    unnecessaryClarifLeg++;
  }

  // Authoritative mode
  const a0 = performance.now();
  const bound = bindSituation(tc.input);
  const a1 = performance.now();
  const authRes = await generateLighterAnglesHybrid(null, { text: tc.input, seedModifier: 0, mode: 'local_only', engineMode: 'authoritative' });
  const a2 = performance.now();
  const authReg = await generateLighterAnglesHybrid(null, { text: tc.input, seedModifier: 1, mode: 'local_only', engineMode: 'authoritative' });
  const a3 = performance.now();

  tAuthBind += (a1 - a0);
  tAuthFull += (a2 - a0);
  tAuthRegen += (a3 - a2);

  if (authRes.outcome.type === tc.expectedOutcome) {
    authOutOk++;
    c.authOut++;
  }
  if (tc.expectedOutcome === 'playful_angles' && authRes.outcome.type === 'clarification_needed') {
    unnecessaryClarifAuth++;
  }

  if (tc.expectedFrame) {
    frameDenom++;
    c.frameDenom++;
    if (bound.frameId === tc.expectedFrame) {
      exactFrameOk++;
      altFrameOk++;
      c.exactF++;
      c.altF++;
    } else if ((tc.acceptableAlternativeFrames || []).includes(bound.frameId) || bound.parentFrameId === tc.expectedParentFrame && tc.expectedParentFrame !== null) {
      altFrameOk++;
      c.altF++;
    }
  }
  if (tc.expectedModifier) {
    modDenom++;
    c.modDenom++;
    if (bound.modifiers.some(m => m.canonicalValue === tc.expectedModifier || m.category === tc.expectedModifier)) {
      modOk++;
      c.modOk++;
    }
  }
  if (tc.expectedContext) {
    ctxDenom++;
    c.ctxDenom++;
    if (bound.contexts.includes(tc.expectedContext)) {
      ctxOk++;
      c.ctxOk++;
    }
  }
  if (Object.keys(bound.boundRoles).length > 0 || bound.resolutionLevel <= 3 || bound.outcomeType !== 'playful_angles') {
    roleOk++;
  }
  if (tc.sensitivity === 'boundary_concern' || tc.sensitivity === 'serious_unsafe') {
    safDenom++;
    if (legRes.outcome.type !== 'playful_angles') legSafOk++;
    if (authRes.outcome.type !== 'playful_angles') authSafOk++;
  }
}

for (const [cat, s] of Object.entries(byCat)) {
  console.log(`  [${cat}] n=${s.n} | LegacyOut=${s.legOut}/${s.n} | AuthOut=${s.authOut}/${s.n} | ExactFrame=${s.exactF}/${s.frameDenom} | AcceptAltFrame=${s.altF}/${s.frameDenom} | Mod=${s.modOk}/${s.modDenom} | Ctx=${s.ctxOk}/${s.ctxDenom}`);
}

console.log(`\n140-Case Aggregate Metrics:`);
console.log(`  - Outcome Accuracy: legacy_rollback=${legOutOk}/140 (${(legOutOk/140*100).toFixed(1)}%) vs authoritative=${authOutOk}/140 (${(authOutOk/140*100).toFixed(1)}%)`);
console.log(`  - Exact Frame Accuracy: ${exactFrameOk}/${frameDenom} (${(exactFrameOk/frameDenom*100).toFixed(1)}%)`);
console.log(`  - Acceptable Hierarchical Frame Accuracy: ${altFrameOk}/${frameDenom} (${(altFrameOk/frameDenom*100).toFixed(1)}%)`);
console.log(`  - Modifier Attachment Accuracy: ${modOk}/${modDenom} (${(modOk/modDenom*100).toFixed(1)}%)`);
console.log(`  - Context Preservation Accuracy: ${ctxOk}/${ctxDenom} (${(ctxOk/ctxDenom*100).toFixed(1)}%)`);
console.log(`  - Role Binding Coverage: ${roleOk}/140 (${(roleOk/140*100).toFixed(1)}%)`);
console.log(`  - Unnecessary Clarification on Clear Inputs: legacy_rollback=${unnecessaryClarifLeg} vs authoritative=${unnecessaryClarifAuth}`);
console.log(`  - Boundary / Serious Protection: legacy_rollback=${legSafOk}/${safDenom} vs authoritative=${authSafOk}/${safDenom}`);

// =============================================================
// 2. 65-CASE OUT-OF-KNOWLEDGE BENCHMARK
// =============================================================
console.log(`\n=== 2. OUT-OF-KNOWLEDGE BENCHMARK (N = ${ook65.length}) ===`);
let ookOk = 0;
const levelDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
const ookMismatches = [];

for (const tc of ook65) {
  const b = bindSituation(tc.input);
  levelDist[b.resolutionLevel]++;
  const r = await generateLighterAnglesHybrid(null, { text: tc.input, seedModifier: 0, mode: 'local_only' });
  const actual = r.outcome.type;
  if (actual === tc.expectedOutcome) ookOk++;
  else ookMismatches.push({ input: tc.input, expected: tc.expectedOutcome, got: actual, level: b.resolutionLevel });
}
console.log(`  - OOK Outcome Accuracy: ${ookOk}/${ook65.length} (${(ookOk/ook65.length*100).toFixed(1)}%)`);
console.log(`  - Resolution Level Distribution:`, levelDist);
if (ookMismatches.length > 0) console.log(`  - OOK Mismatches:`, ookMismatches);

// =============================================================
// 3. 52-CASE DEDICATED SEMANTIC INTEGRITY BENCHMARK
// =============================================================
console.log(`\n=== 3. SEMANTIC INTEGRITY BENCHMARK (N = ${si52.length}) ===`);
let siOutcomeOk = 0, siFrameOk = 0, siPolOk = 0, siTargetOk = 0, siForbiddenClean = 0, siAllPass = 0;
let siTargetDenom = 0;
const siFailures = [];

for (const tc of si52) {
  const details = generateAuthoritativeDetails(tc.input, 0);
  const b = details.bound;
  const outType = b.outcomeType;
  const combined = `${details.angles.gentle.text} ${details.angles.playful.text} ${details.angles.exaggerated.text}`.toLowerCase();

  const okOut = outType === tc.expectedOutcome;
  const okFrame = b.frameId === tc.expectedFrame || (b.acceptableAlternativeFrames || []).includes(tc.expectedFrame);
  const okPol = tc.expectedPolarities.includes(b.actionPolarity);
  let okTarget = true;
  if (tc.expectedTargets && tc.expectedTargets.length > 0) {
    siTargetDenom++;
    okTarget = tc.expectedTargets.some(t => combined.includes(t.toLowerCase()) || (b.boundRoles.target?.canonicalName || '').toLowerCase().includes(t.toLowerCase()));
  }
  const leaked = (tc.forbidden || []).filter(f => combined.includes(f.toLowerCase()));
  const okClean = leaked.length === 0;

  if (okOut) siOutcomeOk++;
  if (okFrame) siFrameOk++;
  if (okPol) siPolOk++;
  if (okTarget && tc.expectedTargets?.length) siTargetOk++;
  if (okClean) siForbiddenClean++;

  if (okOut && okFrame && okPol && okTarget && okClean) {
    siAllPass++;
  } else {
    siFailures.push({
      id: tc.id,
      group: tc.group,
      input: tc.input,
      okOut, okFrame, okPol, okTarget, leaked,
      gotFrame: b.frameId,
      gotPol: b.actionPolarity,
      gotTarget: b.boundRoles.target?.canonicalName,
      angles: [details.angles.gentle.text, details.angles.playful.text, details.angles.exaggerated.text],
    });
  }
}

console.log(`  - Full Integrity Pass (all checks): ${siAllPass}/${si52.length} (${(siAllPass/si52.length*100).toFixed(1)}%)`);
console.log(`  - Outcome Accuracy: ${siOutcomeOk}/${si52.length}`);
console.log(`  - Hierarchical Frame Accuracy: ${siFrameOk}/${si52.length}`);
console.log(`  - Action Polarity Accuracy: ${siPolOk}/${si52.length}`);
console.log(`  - Target Binding Accuracy: ${siTargetOk}/${siTargetDenom}`);
console.log(`  - Zero Forbidden Contamination/Reversals: ${siForbiddenClean}/${si52.length}`);
if (siFailures.length > 0) {
  console.log(`  - Integrity Failures (${siFailures.length}):`);
  for (const f of siFailures) console.log('   ', JSON.stringify(f));
}

// =============================================================
// 4. STAGE-BY-STAGE LATENCY COMPARISON
// =============================================================
console.log(`\n=== 4. FULL-PIPELINE LATENCY BREAKDOWN (avg over 140 queries) ===`);
let tLex = 0, tMod = 0, tSaf = 0, tHkb = 0, tGuard = 0;
for (const tc of eval140) {
  const s0 = performance.now();
  evaluateSafety(tc.input, tc.input.toLowerCase());
  const s1 = performance.now();
  const c = resolveConceptsAndVerbs(tc.input.toLowerCase());
  const s2 = performance.now();
  resolveAndAttachModifiers(tc.input.toLowerCase(), c.concepts);
  const s3 = performance.now();
  const b = bindSituation(tc.input);
  const s4 = performance.now();
  const comp = composeFromPgHkb(b, 0);
  const s5 = performance.now();
  if (comp) {
    const saf2 = performance.now();
validateReframeQuality({ gentle: comp.gentle, playful: comp.playful, exaggerated: comp.exaggerated }, b);
  }
  const s6 = performance.now();
  tSaf += (s1 - s0);
  tLex += (s2 - s1);
  tMod += (s3 - s2);
  tHkb += (s5 - s4);
  tGuard += (s6 - s5);
}

const cold0 = performance.now();
bindSituation("taking forty-five minutes to put on shoes before leaving");
const coldMs = performance.now() - cold0;

console.log(`  - Bundle warm check / sample bind: ${coldMs.toFixed(3)} ms`);
console.log(`  - Safety firewall: ${(tSaf/140).toFixed(4)} ms`);
console.log(`  - Lexical + VerbNet lookup: ${(tLex/140).toFixed(4)} ms`);
console.log(`  - Modifier binding: ${(tMod/140).toFixed(4)} ms`);
console.log(`  - Full PG-RKB bindSituation: ${(tAuthBind/140).toFixed(4)} ms`);
console.log(`  - PG-HKB selection + realization: ${(tHkb/140).toFixed(4)} ms`);
console.log(`  - Quality guard validation: ${(tGuard/140).toFixed(4)} ms`);
console.log(`  - Total Authoritative Stage 2 (bind + PG-HKB + guard + outcome): ${(tAuthFull/140).toFixed(4)} ms`);
console.log(`  - Total Authoritative Regeneration (seed=1): ${(tAuthRegen/140).toFixed(4)} ms`);
console.log(`  - Total Legacy Rollback Stage 2: ${(tLegFull/140).toFixed(4)} ms`);

if (siFailures.length > 0 || ookMismatches.length > 0) {
  process.exitCode = 1;
}
