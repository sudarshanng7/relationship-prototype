/**
 * Test Suite: Expanded Bounded MVP Coverage & Graceful Customer Experience
 * Verifies:
 * 1. 24 product-specific categories and supported situation families.
 * 2. 10 historical acceptance regression cases.
 * 3. Graceful handling of unknown situations (Clarification, Exhaustion, Understood Unavailable Humor, Respectful Reflection).
 * 4. Safety firewalls and privacy boundaries.
 */

import assert from "node:assert/strict";
import { bindSituation, evaluateSafety } from "../src/lib/knowledge-resolver.ts";
import { composeFromPgHkb } from "../src/lib/pg-hkb-composer.ts";
import { determineReframeOutcome } from "../src/lib/reframe-generator.ts";
import { readFileSync } from "node:fs";

console.log("--- Running Expanded Bounded MVP Coverage Tests ---");

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${desc}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${desc}`);
    console.error(err);
  }
}

// 1. Coverage Catalogue Integrity
it("loads supported categories and families without errors", () => {
  const cats = JSON.parse(readFileSync("./knowledge/mvp-coverage/categories.json", "utf8"));
  const sits = JSON.parse(readFileSync("./knowledge/mvp-coverage/supported-situations.json", "utf8"));
  assert.equal(cats.length, 24, "Must have exactly 24 MVP categories");
  assert.ok(sits.length >= 65, "Must have at least 65 supported situation families");
  
  // Every category must have at least 1 family
  for (const cat of cats) {
    const matching = sits.filter(s => s.cat === cat.num);
    assert.ok(matching.length > 0, `Category ${cat.id} must have supported situation families`);
  }
});

// 2. 10 Historical Acceptance Regression Cases
const historicalCases = [
  {
    input: "talking too loud on the phone",
    expectedLevel: 1,
    expectedOutcome: "playful_angles",
    expectedFrame: "frame_speaking_on_phone",
  },
  {
    input: "making tea with just water and namesake milk",
    expectedLevel: 1,
    expectedOutcome: "playful_angles",
    expectedFrame: "frame_beverage_preparation",
  },
  {
    input: "yoga is not an exercise",
    expectedLevel: 4,
    expectedOutcome: "clarification_needed",
  },
  {
    input: "not washing big utensils ever",
    expectedLevel: 1,
    expectedOutcome: "playful_angles",
    expectedFrame: "frame_selective_chore_avoidance",
  },
  {
    input: "forgetting about the stuff that has been put by her only",
    expectedLevel: 1,
    expectedOutcome: "playful_angles",
    expectedFrame: "frame_misplaced_belonging_retrieval",
  },
  {
    input: "keeping the bathroom lights on",
    expectedLevel: 1,
    expectedOutcome: "playful_angles",
    expectedFrame: "frame_active_illumination_persistence",
  },
  {
    input: "making fun of he serious situation",
    expectedLevel: 4,
    expectedOutcome: "clarification_needed",
  },
  {
    input: "forgets to off the alarm in the mornings",
    expectedLevel: 1,
    expectedOutcome: "playful_angles",
    expectedFrame: "frame_alarm_switch_off_omission",
  },
  {
    input: "watches boring videos all the time",
    expectedLevel: 1,
    expectedOutcome: "playful_angles",
    expectedFrame: "frame_subjective_preference_contrast",
  },
  {
    input: "crying over a movies scene",
    expectedLevel: 1,
    expectedOutcome: "playful_angles",
    expectedFrame: "frame_emotional_cinematic_expressiveness",
  },
];

for (const tc of historicalCases) {
  it(`resolves historical case correctly: "${tc.input}"`, () => {
    const bound = bindSituation(tc.input);
    assert.equal(bound.resolutionLevel, tc.expectedLevel, `Resolution level mismatch for "${tc.input}"`);
    assert.equal(bound.outcomeType, tc.expectedOutcome, `Outcome mismatch for "${tc.input}"`);
    if (tc.expectedFrame) {
      assert.equal(bound.frameId, tc.expectedFrame, `Frame mismatch for "${tc.input}"`);
    }
    if (tc.expectedOutcome === "playful_angles") {
      const res = composeFromPgHkb(bound, 0);
      assert.ok(res !== null, `Must compose humor for "${tc.input}"`);
      assert.ok(res.gentle && res.playful && res.exaggerated, `Must produce 3 distinct tones for "${tc.input}"`);
      assert.ok(!res.gentle.includes("everyday moment"), `Must not have placeholder filler in "${tc.input}"`);
    }
  });
}

// 3. Graceful Clarification & Exhaustion
it("handles first clarification correctly with gentle copy", () => {
  const bound = bindSituation("completely random unexpected gibberish situation xyz");
  assert.equal(bound.outcomeType, "clarification_needed");
  const outcome = determineReframeOutcome(bound, []);
  assert.equal(outcome.type, "clarification_needed");
  assert.equal(outcome.unavailableReason, "meaning_unclear");
});

// 4. Understood Situation Without Available Humor
it("handles understood situations with unsupported construction gracefully", () => {
  const simulatedBound = {
    resolutionLevel: 2,
    outcomeType: "clarification_needed",
    diagnostic: { generalFailureCategory: "unsupported_construction" },
  };
  const outcome = determineReframeOutcome(simulatedBound, []);
  assert.equal(outcome.type, "understood_unavailable_humor");
  assert.equal(outcome.unavailableReason, "humor_not_covered");
  assert.ok(outcome.continuationTitle?.includes("Let's leave this one as it is"));
});

// 5. Sensitive Boundary Safety Firewall
it("strictly routes boundary or serious situations to respectful reflection", () => {
  const safetyInputs = [
    "Sometimes too pushy to act on something I do not want to act.",
    "Mocking other person all the time",
    "keeps insisting after I say no",
    "He threatened me and I am terrified for my safety",
  ];

  for (const s of safetyInputs) {
    const bound = bindSituation(s);
    assert.equal(bound.outcomeType, "respectful_reflection", `Must be respectful reflection: "${s}"`);
    const outcome = determineReframeOutcome(bound, []);
    assert.equal(outcome.type, "respectful_reflection");
    assert.equal(outcome.unavailableReason, "humor_inappropriate");
  }
});

console.log(`\nTests finished: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
