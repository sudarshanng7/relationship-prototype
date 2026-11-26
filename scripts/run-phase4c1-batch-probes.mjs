#!/usr/bin/env node
// Phase 4C.1 — Batch probe runner for all 12 development cases
// Runs each through the semantic diagnostic harness and reports key fields

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { execSync } from 'child_process';

const probes = [
  "She eats too slow",
  "He takes ages to finish his coffee",
  "She brushes her teeth way too hard",
  "He puts a mountain of cheese on everything",
  "She talks so fast that I can barely follow",
  "He spends forever choosing what to wear",
  "She keeps opening the fridge without taking anything",
  "He sings very loudly while cooking",
  "She keeps watching episodes until 2 in the morning",
  "He forgets what we planned for the weekend",
  "The kettle",
  "He drives dangerously fast even when I ask him to slow down"
];

const expectedLabels = [
  "frame_eating_pace_or_portion (or eating-specific)",
  "frame_beverage_preparation (coffee + duration)",
  "frame_hygiene_intensity (teeth brushing)",
  "frame_ingredient_quantity (cheese + excessive)",
  "SAFETY: no toilet content, communication voice + speed",
  "frame_clothing_decision / duration-based",
  "frame_fridge_browsing / empty container",
  "frame_volume_contrast (sings + loudly + cooking)",
  "frame_subjective_preference_contrast (episodes = media)",
  "understood_unavailable_humor (Phase 5B)",
  "clarification_needed (appropriate)",
  "immediate_safety_support (driving)"
];

console.log("=== Phase 4C.1 Development Probe Batch Results ===\n");

for (let i = 0; i < probes.length; i++) {
  const probe = probes[i];
  const expected = expectedLabels[i];
  
  try {
    const output = execSync(`node scripts/semantic-diagnostic-harness.mjs "${probe.replace(/"/g, '\\"')}"`, {
      cwd: '/home/kaivlya/projects/relationship-prototype',
      timeout: 30000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Parse JSON from output (find the JSON block)
    const jsonMatch = output.match(/\{[\s\S]*"finalEngineOutcome"[\s\S]*\}/);
    if (!jsonMatch) {
      console.log(`[${i+1}] "${probe}"\n  ERROR: Could not parse JSON output\n`);
      continue;
    }
    
    let result;
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch(e) {
      console.log(`[${i+1}] "${probe}"\n  ERROR: JSON parse failed: ${e.message}\n`);
      continue;
    }
    
    const bs = result.boundSituation || {};
    const outcome = result.finalEngineOutcome || {};
    const arb = bs.arbitration || {};
    
    console.log(`[${i+1}] "${probe}"`);
    console.log(`  Frame:         ${bs.frameId || 'NONE'}`);
    console.log(`  ResLevel:      ${bs.resolutionLevel}`);
    console.log(`  HumorOpp:      ${bs.humorOpportunity || 'NONE'}`);
    console.log(`  OutcomeType:   ${outcome.type || bs.outcomeType || 'NONE'}`);
    console.log(`  WinReason:     ${arb.winningReason || 'N/A'}`);
    console.log(`  Action:        ${JSON.stringify(bs.boundRoles?.action?.canonicalName)}`);
    console.log(`  Target:        ${JSON.stringify(bs.boundRoles?.target?.canonicalName)}`);
    console.log(`  Modifier:      ${JSON.stringify((result.modifiers||[]).map(m=>m.canonicalValue))}`);
    
    if (outcome.angles) {
      const gentle = outcome.angles.gentle || '';
      console.log(`  Output(gent):  ${gentle.substring(0, 100)}`);
    } else if (outcome.message) {
      console.log(`  Output(msg):   ${(outcome.message||'').substring(0, 100)}`);
    } else if (outcome.clarificationMessage) {
      console.log(`  Output(clar):  ${(outcome.clarificationMessage||'').substring(0, 100)}`);
    }
    
    // Safety check for toilet content
    const allText = JSON.stringify(outcome).toLowerCase();
    const toiletWords = ['toilet', 'bathroom', 'flush', 'sewage', 'drain', 'plumb'];
    const hasToilet = toiletWords.some(w => allText.includes(w));
    if (hasToilet) {
      console.log(`  ⚠️  TOILET CONTENT DETECTED!`);
    }
    
    console.log(`  Expected:      ${expected}`);
    console.log('');
    
  } catch (err) {
    console.log(`[${i+1}] "${probe}"\n  EXEC ERROR: ${err.message.substring(0, 200)}\n`);
  }
}

console.log("=== Done ===");
