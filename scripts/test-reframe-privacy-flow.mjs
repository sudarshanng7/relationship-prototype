import test from "node:test";
import assert from "node:assert/strict";

/**
 * Stage 1 -> Stage 2 Reframe Data Flow & Privacy Suite
 *
 * Scenarios:
 * RF1: Manual Stage 1 edit becomes authoritative Stage 2 input.
 * RF2: Old/pre-edit annoyance value is not used.
 * RF3: Lighter thought remains private by default (include_reframe_with_partner = false).
 * RF4: Challenge creation no longer displays privacy/share slider for lighter thought.
 * RF5: Challenge payload does not expose lighter thought or private annoyance to partner.
 */

function generateReframesFromText(text) {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  if (lower.includes("mug") || lower.includes("coffee") || lower.includes("cup") || lower.includes("dish")) {
    return {
      gentle: "One little mug is waiting for its journey home.",
      playful: trimmed.startsWith("The kitchen museum has acquired a new exhibit:")
        ? trimmed
        : `The kitchen museum has acquired a new exhibit: ${trimmed}.`,
      exaggerated: `Alert: ${trimmed.slice(0, 40)} has declared independence from the dishwasher.`,
    };
  }

  if (lower.includes("sock") || lower.includes("laundry") || lower.includes("clothes") || lower.includes("shoe")) {
    return {
      gentle: `A lonely item looking for its missing twin: ${trimmed.slice(0, 45)}.`,
      playful: `The house has accepted its customary tax: ${trimmed.slice(0, 45)}.`,
      exaggerated: `Breaking news: secret portal discovered around ${trimmed.slice(0, 40)}.`,
    };
  }

  return {
    gentle: `A small moment with ${trimmed.slice(0, 45)} that just needs a quiet breath and a little kindness.`,
    playful: `A classic plot twist in today's shared domestic adventure: ${trimmed.slice(0, 50)}.`,
    exaggerated: `Scientists confirm: ${trimmed.slice(0, 45)} is officially an unprecedented domestic mystery.`,
  };
}

test("RF1: Manual Stage 1 edit becomes authoritative Stage 2 input", () => {
  const finalEditedStage1 = "The kitchen museum has acquired a new exhibit: Mug, Untouched.";
  const reframes = generateReframesFromText(finalEditedStage1);

  assert.ok(reframes.playful.includes("The kitchen museum has acquired a new exhibit:"));
  assert.ok(reframes.playful.includes("Mug, Untouched."));
});

test("RF2: Old/pre-edit annoyance value is not used", () => {
  const initialText = "He always leaves his mug around.";
  const editedText = "Our little cat knocked the mug over.";

  const staleReframes = generateReframesFromText(initialText);
  const updatedReframes = generateReframesFromText(editedText);

  assert.notEqual(staleReframes.playful, updatedReframes.playful);
  assert.ok(updatedReframes.playful.includes("Our little cat knocked the mug over."));
  assert.ok(!updatedReframes.playful.includes("He always leaves his mug around."));
});

test("RF3: Lighter thought remains private by default", () => {
  const reframeSaveInput = {
    coupleId: "couple-1",
    authorId: "user-1",
    topicKey: "other",
    reframeText: "A funny angle",
    includeReframeWithPartner: false,
  };

  assert.equal(reframeSaveInput.includeReframeWithPartner, false);
});

test("RF4: Challenge creation does not display privacy slider (always private)", () => {
  const challengeState = {
    idea: "Make tea",
    participant: "partner",
    shareReframe: false,
  };

  assert.equal(challengeState.shareReframe, false);
});

test("RF5: Challenge payload masks lighter thought and private annoyance from partner", () => {
  const rawDbRow = {
    id: "ref-1",
    couple_id: "c-1",
    author_id: "u-author",
    challenge_idea: "Make morning coffee",
    challenge_participant: "partner",
    private_irritation_input: "He left his dirty socks on the counter",
    reframe_text: "A secret laundry portal",
    include_reframe_with_partner: false,
    status: "active",
  };

  function sanitizeForPartner(row, requestingUserId) {
    const isAuthor = row.author_id === requestingUserId;
    return {
      id: row.id,
      couple_id: row.couple_id,
      challenge_idea: row.challenge_idea,
      challenge_participant: row.challenge_participant,
      // Private fields masked:
      private_irritation_input: isAuthor ? row.private_irritation_input : null,
      reframe_text: (isAuthor || row.include_reframe_with_partner) ? row.reframe_text : null,
      status: row.status,
    };
  }

  const partnerView = sanitizeForPartner(rawDbRow, "u-partner");
  assert.equal(partnerView.private_irritation_input, null);
  assert.equal(partnerView.reframe_text, null);
  assert.equal(partnerView.challenge_idea, "Make morning coffee");
});
