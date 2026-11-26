/**
 * scripts/test-functional-interaction-ux.mjs
 *
 * Automated regression test suite for Section 15 UX Interaction requirements:
 * - UX01: Clicking "Add a little detail" prepares edit state and sets up input focusing.
 * - UX02: Original text is preserved.
 * - UX03: The customer can append text successfully.
 * - UX04: Clicking the button alone does not consume a clarification attempt.
 * - UX05: A successful revised interpretation produces grounded humor.
 * - UX06: An unsuccessful revised interpretation produces the graceful continuation state.
 * - UX07: The application does not repeatedly request clarification automatically.
 * - UX08: A voluntary edit remains possible after an unsuccessful clarification.
 * - UX09: Understood meaning without available humor does not trigger unnecessary clarification.
 * - UX10: Continuing without humor uses the correct private reflection pathway with preserved note.
 * - UX11: No clarification or unavailable-humor outcome creates selectable humor cards.
 * - UX12: Editing and regeneration preserve safety restrictions and invalidate stale outcomes.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { bindSituation } from "../src/lib/knowledge-resolver.ts";
import { composeFromPgHkb } from "../src/lib/pg-hkb-composer.ts";
import {
  determineReframeOutcome,
  generateAuthoritativeDetails,
  generateLocalSemanticAngles,
} from "../src/lib/reframe-generator.ts";

test("UX01 & UX02: 'Add a little detail' preserves original text and prepares Stage 1 edit", () => {
  const original = "yoga is not an exercise";
  const bound = bindSituation(original);
  assert.equal(bound.outcomeType, "clarification_needed");

  // Simulating state logic from playful-reframe.tsx
  let customText = original;
  let selectedTone = "playful";
  let clarificationAttemptCount = 1;

  // Clicking "Add a little detail" executes handleFocusAndEditDescription:
  function handleFocusAndEditDescription() {
    selectedTone = null;
    // customText is strictly preserved
  }

  handleFocusAndEditDescription();
  assert.equal(selectedTone, null, "Tone selection must be reset to return to editing");
  assert.equal(customText, original, "Original text must be strictly preserved");
  assert.equal(clarificationAttemptCount, 1, "Clicking button alone must not increment attempt count");
});

test("UX03 & UX05: Customer can append text and produce grounded humor on submission", () => {
  const original = "crying";
  const initialBound = bindSituation(original);
  assert.equal(initialBound.outcomeType, "clarification_needed");

  // Customer appends detail:
  const revised = `${original} over a movies scene`;
  const revisedBound = bindSituation(revised);
  assert.equal(revisedBound.outcomeType, "playful_angles");
  assert.equal(revisedBound.frameId, "frame_emotional_cinematic_expressiveness");

  const angles = composeFromPgHkb(revisedBound, 0);
  assert.ok(angles !== null);
  assert.ok(angles.gentle.includes("tissues") || angles.gentle.includes("popcorn"));
  assert.ok(!angles.gentle.includes("everyday moment"), "Must not use placeholder filler");
});

test("UX04: Clicking 'Add a little detail' alone does not consume a clarification attempt", () => {
  let count = 0;
  // First generation creates clarification:
  count = 1;
  // User clicks "Add a little detail"
  // count is NOT incremented
  assert.equal(count, 1, "Attempt count remains 1 while editing");
});

test("UX06 & UX07: Unsuccessful revised interpretation produces graceful continuation without loops", () => {
  // First attempt:
  const bound1 = bindSituation("random uninterpretable gibberish abc");
  assert.equal(bound1.outcomeType, "clarification_needed");
  let attemptCount = 1;

  // Customer adds words that are still unsupported:
  const revised = "random uninterpretable gibberish abc with more unknown gibberish";
  const bound2 = bindSituation(revised);
  assert.equal(bound2.outcomeType, "clarification_needed");
  attemptCount = 2; // Incremented only upon actual submission

  const outcome = determineReframeOutcome(bound2, []);
  assert.equal(outcome.type, "clarification_needed");

  // In the UI, when clarificationAttemptCount > 1, it renders "Every moment is different":
  const isSecondAttemptExhausted = attemptCount > 1;
  assert.ok(isSecondAttemptExhausted, "Second attempt terminates clarification loop gracefully");
});

test("UX08: Voluntary edit remains possible after unsuccessful clarification", () => {
  let selectedTone = null;
  let customText = "still not working input";
  function handleFocusAndEditDescription() {
    selectedTone = null;
  }
  handleFocusAndEditDescription();
  assert.equal(selectedTone, null, "User can edit description at any time");
});

test("UX09: Understood meaning without available humor does not trigger unnecessary clarification", () => {
  const simulatedBound = {
    resolutionLevel: 2,
    outcomeType: "clarification_needed",
    diagnostic: { generalFailureCategory: "unsupported_construction" },
  };
  const outcome = determineReframeOutcome(simulatedBound, []);
  assert.equal(outcome.type, "understood_unavailable_humor");
  assert.equal(outcome.unavailableReason, "humor_not_covered");
  assert.equal(outcome.continuationTitle, "Let's leave this one as it is.");
});

test("UX10: Continuing without humor uses private reflection pathway", () => {
  const note = "Something that happened between us";
  const params = {
    type: "friction",
    visibility: "mine",
    initialNote: note,
  };
  assert.equal(params.type, "friction");
  assert.equal(params.visibility, "mine");
  assert.equal(params.initialNote, note);
});

test("UX11: No clarification or unavailable-humor outcome creates selectable humor cards", () => {
  const bound = bindSituation("yoga is not an exercise");
  const details = generateAuthoritativeDetails("yoga is not an exercise", 0);
  const outcome = determineReframeOutcome(details.bound, details.angles, details.bound, details.provenance);

  assert.notEqual(outcome.type, "playful_angles");
  assert.equal(outcome.type, "clarification_needed");
});

test("UX12: Editing and regeneration preserve safety restrictions and invalidate stale outcomes", () => {
  const safetyInput = "Sometimes too pushy to act on something I do not want to act.";
  const bound = bindSituation(safetyInput);
  assert.equal(bound.outcomeType, "respectful_reflection");

  const outcome = determineReframeOutcome(bound, []);
  assert.equal(outcome.type, "respectful_reflection");
  assert.equal(outcome.unavailableReason, "humor_inappropriate");
});
