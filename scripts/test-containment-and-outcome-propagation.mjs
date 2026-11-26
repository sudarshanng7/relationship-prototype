/**
 * scripts/test-containment-and-outcome-propagation.mjs
 *
 * Verification suite for Symbolic Engine Containment and Architecture Transition:
 * 1. Missing essential semantic components cannot count as successful compositional interpretation.
 * 2. Generic target substitution cannot count as successful grounding.
 * 3. Null composer result or failed composition cannot render selectable humor cards.
 * 4. Correct outcome routing is distinct from correct semantic understanding.
 * 5. Presence of three strings is not proof of meaningful humor.
 * 6. Respectful reflection strictly maintained for boundary/safety inputs.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { bindSituation } from "../src/lib/knowledge-resolver.ts";
import { composeFromPgHkb, realizeConstructionTemplate } from "../src/lib/pg-hkb-composer.ts";
import {
  generateAuthoritativeDetails,
  determineReframeOutcome,
  generateLighterAnglesHybrid,
} from "../src/lib/reframe-generator.ts";

test("T1: Missing essential semantic components route to clarification_needed and never Level 3 compositional success", () => {
  // Input with ungrounded verb or missing behavioral target
  const input = "randomly doing something strange without target";
  const bound = bindSituation(input);

  assert.equal(bound.outcomeType, "clarification_needed");
  assert.equal(bound.resolutionLevel, 4);
  assert.equal(bound.frameId, "frame_unknown_uninterpretable");
  assert.notEqual(bound.frameId, "frame_parent_domestic_chores");
  assert.notEqual(bound.humorOpportunity, "compositional_habit");

  const hkbResult = composeFromPgHkb(bound, 0);
  assert.equal(hkbResult, null, "Composer must return null when bound outcomeType is clarification_needed");
});

test("T2: Generic target substitution ('everyday moment') cannot count as successful grounding", () => {
  const dummyBound = {
    normalizedText: "some random behavior without target",
    actionPolarity: "active",
    modifiers: [],
    boundRoles: {},
    contexts: [],
  };

  const templateWithTarget = "A cozy everyday rhythm around {target} quietly adding its own personality to the house.";
  const realized = realizeConstructionTemplate(templateWithTarget, dummyBound);

  // Must fail cleanly by returning empty string instead of inserting "everyday moment"
  assert.equal(realized, "", "Template requiring {target} must realize to empty string when target is missing");
  assert.ok(!realized.includes("everyday moment"), "Must never inject 'everyday moment' generic placeholder");
});

test("T3: Null composer result or failed composition demotes outcome and NEVER renders selectable humor cards", () => {
  const input = "yoga is not an exercise";
  const details = generateAuthoritativeDetails(input, 0);

  // Categorical proposition without behavioral grounding demotes outcome:
  assert.equal(details.bound?.outcomeType, "clarification_needed");

  const outcome = determineReframeOutcome(details.bound, details.angles, details.bound, details.provenance);
  assert.equal(outcome.type, "clarification_needed");
  assert.ok(outcome.clarificationMessage && outcome.clarificationMessage.length > 0);

  // In the UI, outcome.type === "clarification_needed" renders the single clarification card,
  // preventing clarification strings from appearing inside selectable humor cards.
  assert.notEqual(outcome.type, "playful_angles");
});

test("T4: Correct outcome routing is distinct from correct semantic understanding", () => {
  const input = "making fun of he serious situation";
  const bound = bindSituation(input);

  // Ungrounded / grammatical mismatch should cleanly route to clarification
  assert.equal(bound.outcomeType, "clarification_needed");
  assert.equal(bound.resolutionLevel, 4);

  // Verify that an uninterpretable input is not marked with high confidence
  assert.ok(bound.resolutionLevel >= 4);
  assert.equal(bound.diagnostic.generalFailureCategory, "unclear_relationship");
});

test("T5: Presence of three strings is not proof of meaningful humor", () => {
  const input = "completely ungrounded abstract musing about existence";
  const details = generateAuthoritativeDetails(input, 0);

  // Even though fallback strings are returned to avoid hard UI crashes,
  // outcome.type must clearly flag clarification_needed or universal_fallback
  assert.equal(details.bound?.outcomeType, "clarification_needed");
  const outcome = determineReframeOutcome(details.bound, details.angles, details.bound);
  assert.equal(outcome.type, "clarification_needed");
});

test("T6: Safety and boundary inputs strictly produce respectful_reflection without humor", () => {
  const boundaryInputs = [
    "Sometimes too pushy to act on something I do not want to act.",
    "Mocking other person all the time",
    "keeps insisting after I say no",
    "He threatened me and I am terrified for my safety",
  ];

  for (const text of boundaryInputs) {
    const bound = bindSituation(text);
    assert.equal(bound.outcomeType, "respectful_reflection", `Failed for: ${text}`);

    const details = generateAuthoritativeDetails(text, 0);
    const outcome = determineReframeOutcome(details.bound, details.angles, details.bound);
    assert.equal(outcome.type, "respectful_reflection", `Outcome failed for: ${text}`);
    assert.ok(outcome.reflectionMessage && outcome.reflectionMessage.length > 0);

    const allText = (details.angles.gentle.text + " " + details.angles.playful.text + " " + details.angles.exaggerated.text).toLowerCase();
    assert.ok(!allText.includes("silly"), "Must not contain silly");
    assert.ok(!allText.includes("laugh it off"), "Must not contain laugh it off");
  }
});
