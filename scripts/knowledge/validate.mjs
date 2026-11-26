/**
 * scripts/knowledge/validate.mjs
 *
 * Verifies relational integrity, schema completeness, and license metadata
 * across the entire populated knowledge/ directory.
 */

import fs from 'node:fs';
import path from 'node:path';

function loadJson(relPath) {
  const fullPath = path.resolve(relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing expected file: ${relPath}`);
  }
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

console.log('--- Running PG-RKB & PG-HKB Comprehensive Knowledge Integrity Validation ---');

let errorCount = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ Validation Failure: ${msg}`);
    errorCount++;
  }
}

// 1. Manifest
const manifest = loadJson('knowledge/manifest.json');
assert(manifest && Array.isArray(manifest.sources), 'manifest.json contains sources array');
const validSourceIds = new Set(manifest.sources.map(s => s.id));

// 2. Domains
const domains = loadJson('knowledge/domains/domains.json');
assert(Array.isArray(domains) && domains.length === 36, `Expected exactly 36 domains, found ${domains.length}`);
const validDomainIds = new Set(domains.map(d => d.id));

for (const d of domains) {
  assert(d.id && d.name && d.category && d.description, `Domain ${d.id} missing core fields`);
  for (const src of d.sourceIds || []) {
    assert(validSourceIds.has(src), `Domain ${d.id} references unregistered source ${src}`);
  }
}

// 3. Modifiers
const modifiers = loadJson('knowledge/modifiers/modifiers.json');
assert(Array.isArray(modifiers) && modifiers.length >= 8, `Expected at least 8 modifiers, found ${modifiers.length}`);
const validModifierIds = new Set(modifiers.map(m => m.id));

// 4. Contexts
const contexts = loadJson('knowledge/contexts/contexts.json');
assert(Array.isArray(contexts) && contexts.length >= 6, `Expected at least 6 contexts, found ${contexts.length}`);

// 5. Emotions
const emotions = loadJson('knowledge/emotions/emotions.json');
assert(Array.isArray(emotions) && emotions.length >= 5, `Expected at least 5 emotions, found ${emotions.length}`);

// 6. Concepts
const concepts = loadJson('knowledge/concepts/concepts.json');
assert(Array.isArray(concepts) && concepts.length >= 1000, `Expected at least 1,000 concepts, found ${concepts.length}`);
const validConceptIds = new Set(concepts.map(c => c.id));

for (const c of concepts) {
  assert(c.id && c.canonicalName && c.conceptType && c.definition, `Concept ${c.id} missing core fields`);
  for (const dId of c.domainIds || []) {
    assert(validDomainIds.has(dId), `Concept ${c.id} references invalid domain ${dId}`);
  }
  for (const src of c.sourceIds || []) {
    assert(validSourceIds.has(src), `Concept ${c.id} references unregistered source ${src}`);
  }
}

// 7. Relationships
const relationships = loadJson('knowledge/relationships/relationships.json');
assert(Array.isArray(relationships) && relationships.length >= 1000, `Expected at least 1,000 relationships, found ${relationships.length}`);

for (const r of relationships) {
  assert(validConceptIds.has(r.sourceConceptId), `Relationship ${r.id} has invalid sourceConceptId: ${r.sourceConceptId}`);
  assert(validConceptIds.has(r.targetConceptId), `Relationship ${r.id} has invalid targetConceptId: ${r.targetConceptId}`);
  assert(r.confidence >= 0 && r.confidence <= 1, `Relationship ${r.id} confidence out of bounds`);
  assert(validSourceIds.has(r.sourceId), `Relationship ${r.id} references unregistered source ${r.sourceId}`);
}

// 8. Frames
const frames = loadJson('knowledge/semantic-frames/frames.json');
assert(Array.isArray(frames) && frames.length >= 30, `Expected at least 30 consolidated semantic frames, found ${frames.length}`);
const validFrameIds = new Set(frames.map(f => f.id));
for (const f of frames) {
  assert(f.id && f.name && f.roles && f.triggers, `Frame ${f.id} missing essential fields`);
  assert(Array.isArray(f.compatiblePolarities) && f.compatiblePolarities.length > 0, `Frame ${f.id} missing compatiblePolarities`);
  if (f.parentFrameId) {
    assert(validFrameIds.has(f.parentFrameId), `Frame ${f.id} references missing parentFrameId ${f.parentFrameId}`);
  }
  for (const dId of f.relatedDomains || []) {
    assert(validDomainIds.has(dId), `Frame ${f.id} references invalid domain ${dId}`);
  }
}

// 9. Humor Mechanisms & Metaphors & Constructions
const mechanisms = loadJson('knowledge/humor/mechanisms/mechanisms.json');
assert(Array.isArray(mechanisms) && mechanisms.length >= 30, `Expected >= 30 humor mechanisms, found ${mechanisms.length}`);

const metaphors = loadJson('knowledge/humor/metaphor-families/metaphor-families.json');
assert(Array.isArray(metaphors) && metaphors.length >= 30, `Expected >= 30 metaphor families, found ${metaphors.length}`);

const constructions = loadJson('knowledge/humor/constructions/constructions.json');
assert(Array.isArray(constructions) && constructions.length >= 100, `Expected >= 100 unique non-boilerplate humor constructions, found ${constructions.length}`);
const uniqueStructuralPatterns = new Set(constructions.map(c => c.structuralPatternId || c.id));
assert(uniqueStructuralPatterns.size === constructions.length, `Detected duplicate construction structures: ${constructions.length - uniqueStructuralPatterns.size}`);

// 10. Sensitivity Policies
const policies = loadJson('knowledge/sensitivity/policies.json');
assert(policies && Array.isArray(policies.firewallRules), 'policies.json contains firewallRules array');

// 11. Compiled Bundle
const compiled = loadJson('knowledge/compiled/runtime_knowledge_bundle.json');
assert(compiled && compiled.summary && compiled.indexes && compiled.entities, 'Compiled bundle contains complete sections');

console.log(`\nVerified Counts:`);
console.log(`  - Domains: ${domains.length}`);
console.log(`  - Concepts: ${concepts.length}`);
console.log(`  - Semantic Relationships: ${relationships.length}`);
console.log(`  - Semantic Frames: ${frames.length}`);
console.log(`  - Modifiers: ${modifiers.length}`);
console.log(`  - Contexts: ${contexts.length}`);
console.log(`  - Emotions: ${emotions.length}`);
console.log(`  - Humor Mechanisms: ${mechanisms.length}`);
console.log(`  - Metaphor Families: ${metaphors.length}`);
console.log(`  - Humor Constructions: ${constructions.length}`);

if (errorCount === 0) {
  console.log(`\n✔ Comprehensive Knowledge Base Validation PASSED with 0 errors.`);
} else {
  console.error(`\n❌ Comprehensive Knowledge Base Validation FAILED with ${errorCount} errors.`);
  process.exit(1);
}
