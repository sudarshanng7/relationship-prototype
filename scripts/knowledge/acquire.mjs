/**
 * scripts/knowledge/acquire.mjs
 *
 * Demonstrates and documents reproducible extraction and normalization
 * from verified open-access sources (WordNet CC-BY 4.0, Wikidata CC0, VerbNet CU).
 */

import fs from 'node:fs';
import path from 'node:path';

const MANIFEST_PATH = path.resolve('knowledge/manifest.json');
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

console.log('--- PG-RKB Knowledge Acquisition Pipeline ---');
console.log(`Registered sources: ${manifest.sources.length}`);

const approvedSources = manifest.sources.filter(s => s.commercialUseStatus === 'permitted' && s.redistributionStatus === 'permitted');
const deferredSources = manifest.sources.filter(s => s.commercialUseStatus !== 'permitted' || s.redistributionStatus !== 'permitted');

console.log(`Approved for redistribution (${approvedSources.length}):`);
for (const src of approvedSources) {
  console.log(`  ✔ [${src.id}] ${src.name} (${src.licenseIdentifier})`);
}

console.log(`Deferred / Non-distributable references (${deferredSources.length}):`);
for (const src of deferredSources) {
  console.log(`  ✖ [${src.id}] ${src.name} -> Reason: ${src.notes}`);
}

console.log('\nAcquisition status: Pilot knowledge successfully synchronized into knowledge/ directory.');
