import { FROZEN_INDEPENDENT_EVALUATION_DATASET } from "../knowledge/mvp-coverage/frozen_independent_evaluation_dataset.js";
import { parseToCanonicalSemantics } from "../src/lib/semantic-parser.ts";
import { bindSituation } from "../src/lib/knowledge-resolver.ts";
import { composeFromPgHkb } from "../src/lib/pg-hkb-composer.ts";
import fs from "fs";

console.log("=== FROZEN INDEPENDENT EVALUATION SUITE (65 MVP FAMILIES) ===");
console.log(`Evaluating ${FROZEN_INDEPENDENT_EVALUATION_DATASET.length} naturally written, independent expressions...`);

let passedSyntax = 0;
let passedBehavioral = 0;
let passedMeaning = 0;
let passedHumorQuality = 0;

const results = [];

for (const testCase of FROZEN_INDEPENDENT_EVALUATION_DATASET) {
  const { familyId, cat, input, expectedOutcome, expectedCategory } = testCase;

  // 1. Canonical Parsing
  const parse = parseToCanonicalSemantics(input);
  const hasActor = parse.tokens.some((t) => t.pos === "PRON" || t.pos === "NOUN");
  const hasPredicate = parse.events.length > 0 || parse.tokens.some((t) => t.pos === "VERB" || t.pos === "AUX");
  const syntaxOk = hasActor && hasPredicate;
  if (syntaxOk) passedSyntax++;

  // 2. Behavioral Inference & Frame Binding
  const bound = bindSituation(input);
  const isEligible = bound.outcomeType === expectedOutcome || (bound.outcomeType === "clarification_needed" && expectedOutcome === "clarification_needed");
  const behavioralOk = isEligible && bound.resolutionLevel <= 3;
  if (behavioralOk) passedBehavioral++;

  // 3. HKB Composition & Meaning Preservation
  const res = composeFromPgHkb(bound, 0);
  let meaningOk = false;
  let humorOk = false;

  const genericHabitPhrases = [
    /distinct, unhurried rhythm/i,
    /monument to patience and domestic preservation/i,
    /elevated this routine into a specialized personal art form/i
  ];

  if (res && res.gentle.length > 0 && res.playful.length > 0 && res.exaggerated.length > 0) {
    const combined = (res.gentle + " " + res.playful + " " + res.exaggerated).toLowerCase();
    const hasDeterminerCollision = /\b(the\s+the|this\s+this|that\s+that)\b/i.test(combined);
    const hasUnresolvedTokens = /\{[a-z_]+\}/.test(combined);
    
    // Meaning preservation check: correct polarity & no contradicted actions
    let polarityPreserved = true;
    if (bound.actionPolarity === "avoided" || bound.actionPolarity === "negated") {
      if (/\b(scrubbing so enthusiastically|elbow grease|upper-body arm workout)\b/i.test(combined)) {
        polarityPreserved = false;
      }
    }
    
    meaningOk = !hasDeterminerCollision && !hasUnresolvedTokens && polarityPreserved;

    // Quality check: Ensure angles are non-empty, distinct, and NOT generic ungrounded template skeletons
    const distinct = res.gentle !== res.playful && res.playful !== res.exaggerated && res.gentle !== res.exaggerated;
    const hasGenericHabitSkeleton = genericHabitPhrases.some(p => p.test(combined));
    
    humorOk = meaningOk && distinct && !hasGenericHabitSkeleton;
  } else if (bound.outcomeType === "clarification_needed") {
    meaningOk = true;
    humorOk = true;
  }

  if (meaningOk) passedMeaning++;
  if (humorOk) passedHumorQuality++;

  results.push({
    familyId,
    category: cat,
    input,
    frameId: bound.frameId,
    outcomeType: bound.outcomeType,
    syntaxOk,
    behavioralOk,
    meaningOk,
    humorOk,
    angles: res ? { gentle: res.gentle, playful: res.playful, exaggerated: res.exaggerated } : null
  });
}

const total = FROZEN_INDEPENDENT_EVALUATION_DATASET.length;
const syntaxRate = ((passedSyntax / total) * 100).toFixed(1);
const behavioralRate = ((passedBehavioral / total) * 100).toFixed(1);
const meaningRate = ((passedMeaning / total) * 100).toFixed(1);
const humorRate = ((passedHumorQuality / total) * 100).toFixed(1);

console.log("\n=== INDEPENDENT FROZEN EVALUATION RESULTS ===");
console.log(`Total Cases Evaluated:       ${total}`);
console.log(`Syntactic Understanding:     ${passedSyntax} / ${total} (${syntaxRate}%) [Target >= 90%]`);
console.log(`Behavioral Relationship:     ${passedBehavioral} / ${total} (${behavioralRate}%) [Target >= 90%]`);
console.log(`Meaning Preservation:        ${passedMeaning} / ${total} (${meaningRate}%) [Target >= 90%]`);
console.log(`Contextual Humour Relevance: ${passedHumorQuality} / ${total} (${humorRate}%) [Target >= 85%]`);

fs.writeFileSync("knowledge/mvp-coverage/frozen_independent_evaluation_results.json", JSON.stringify(results, null, 2));
console.log("Successfully exported knowledge/mvp-coverage/frozen_independent_evaluation_results.json");

if (Number(syntaxRate) >= 90 && Number(behavioralRate) >= 90 && Number(meaningRate) >= 90 && Number(humorRate) >= 85) {
  console.log("\n✔ INDEPENDENT FROZEN GENERALIZATION ACCEPTANCE TARGETS ACHIEVED");
  process.exit(0);
} else {
  console.error("\n✖ INDEPENDENT FROZEN GENERALIZATION TARGETS NOT MET");
  process.exit(1);
}
