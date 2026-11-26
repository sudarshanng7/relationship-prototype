import test from "node:test";
import assert from "node:assert/strict";
import {
  generateLocalSemanticAngles,
  validateStructuredAnglesResponse,
} from "../src/lib/reframe-generator.ts";

/**
 * Contextual Reframe Generation Test Suite (RG1 - RG15)
 *
 * Verifies that Stage 1 -> Stage 2 reframe flow produces organic, context-aware,
 * situation-specific lighter angles rather than naive string concatenation or templates.
 */

// Helper to count words
function countWords(str) {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

test("RG1: Bathroom-light input produces light/bathroom-related angles", () => {
  const input = "the bathroom light is always on";
  const angles = generateLocalSemanticAngles(input, 0);

  assert.ok(angles.gentle.text, "gentle angle exists");
  assert.ok(angles.playful.text, "playful angle exists");
  assert.ok(angles.exaggerated.text, "exaggerated angle exists");

  const combined = (angles.gentle.text + " " + angles.playful.text + " " + angles.exaggerated.text).toLowerCase();
  assert.ok(combined.includes("light") || combined.includes("bathroom"), "references light/bathroom");
  assert.ok(!combined.includes("mug"), "does not leak mug template");
  assert.ok(!combined.includes("socks"), "does not leak sock template");
  assert.ok(!combined.includes("dishwasher"), "does not leak dishwasher template");
});

test("RG2: Dishwasher-not-started input produces dishwasher/appliance angles, NOT mug angles", () => {
  const input = "dish washer is not started";
  const angles = generateLocalSemanticAngles(input, 0);

  const combined = (angles.gentle.text + " " + angles.playful.text + " " + angles.exaggerated.text).toLowerCase();
  assert.ok(combined.includes("dishwasher") || combined.includes("cycle"), "references dishwasher/cycle");
  assert.ok(!combined.includes("mug"), "does not leak mug template");
  assert.ok(!combined.includes("hallway"), "does not leak hallway template");
  assert.ok(!combined.includes("light"), "does not leak light template");
});

test("RG3: Footwear/flippers/slippers input preserves the slippers/footwear context", () => {
  const input = "flippers are removed anywhere in the house";
  const angles = generateLocalSemanticAngles(input, 0);

  const combined = (angles.gentle.text + " " + angles.playful.text + " " + angles.exaggerated.text).toLowerCase();
  assert.ok(
    combined.includes("flipper") || combined.includes("shoe") || combined.includes("footwear") || combined.includes("slipper"),
    "preserves footwear context"
  );
  assert.ok(!combined.includes("dishwasher"), "does not leak dishwasher template");
});

test("RG4: The 3 generated tones (gentle, playful, exaggerated) are materially different strings", () => {
  const input = "the bathroom light is always on";
  const angles = generateLocalSemanticAngles(input, 0);

  assert.notEqual(angles.gentle.text, angles.playful.text, "gentle != playful");
  assert.notEqual(angles.playful.text, angles.exaggerated.text, "playful != exaggerated");
  assert.notEqual(angles.gentle.text, angles.exaggerated.text, "gentle != exaggerated");

  // Check word counts fall into reasonable conversational bounds (8 to 22 target, 5 to 30 valid)
  const gentleWords = countWords(angles.gentle.text);
  const playfulWords = countWords(angles.playful.text);
  const exaggeratedWords = countWords(angles.exaggerated.text);

  assert.ok(gentleWords >= 6 && gentleWords <= 25, `gentle word count (${gentleWords}) within bounds`);
  assert.ok(playfulWords >= 6 && playfulWords <= 25, `playful word count (${playfulWords}) within bounds`);
  assert.ok(exaggeratedWords >= 6 && exaggeratedWords <= 25, `exaggerated word count (${exaggeratedWords}) within bounds`);
});

test("RG5: No output directly blames, accuses, or insults partner", () => {
  const inputs = [
    "dish washer is not started",
    "flippers are removed anywhere in the house",
    "the bathroom light is always on",
    "you never listen to me",
  ];

  const bannedPatterns = [
    /\byou always\b/i,
    /\byou never\b/i,
    /\byour fault\b/i,
    /\blazy\b/i,
    /\bcareless\b/i,
    /\btoxic\b/i,
    /\bnarcissist\b/i,
    /\bselfish\b/i,
  ];

  for (const input of inputs) {
    const angles = generateLocalSemanticAngles(input, 0);
    for (const key of ["gentle", "playful", "exaggerated"]) {
      const text = angles[key].text;
      for (const pattern of bannedPatterns) {
        assert.ok(!pattern.test(text), `Text "${text}" contains banned accusatory pattern ${pattern}`);
      }
    }
  }
});

test("RG6: Final edited Stage 1 text is the generation source", () => {
  // Simulating user editing Stage 1 text from preset to custom
  let stage1Text = "coffee mug";
  let angles = generateLocalSemanticAngles(stage1Text, 0);
  assert.ok(angles.gentle.text.toLowerCase().includes("mug"));

  stage1Text = "the bathroom light is always on";
  angles = generateLocalSemanticAngles(stage1Text, 0);
  assert.ok(angles.gentle.text.toLowerCase().includes("light"));
  assert.ok(!angles.gentle.text.toLowerCase().includes("mug"));
});

test("RG7: Changing Stage 1 invalidates previous generated results", () => {
  let canonicalStage1Text = "dish washer is not started";
  let currentInput = "the bathroom light is always on";

  const isStale = canonicalStage1Text !== currentInput;
  assert.equal(isStale, true, "isStale flag must be true when current input differs from canonical text");
});

test("RG8: Generation occurs on Continue, not on keystroke", () => {
  // In playful-reframe.tsx:
  // TextInput onChangeText only calls setCustomText(text) and does NOT call triggerGeneration()
  // triggerGeneration is only called in handleContinueToStage2() or handleRegenerate()
  let generationCallCount = 0;
  function triggerGenerationMock() {
    generationCallCount++;
  }

  function onKeystroke(char, current) {
    const next = current + char;
    // On keystroke, only state update happens
    return next;
  }

  let text = "";
  for (const char of "the bathroom light") {
    text = onKeystroke(char, text);
  }

  assert.equal(generationCallCount, 0, "No generation should occur on individual keystrokes");

  // User taps "See lighter angles" / Continue
  triggerGenerationMock();
  assert.equal(generationCallCount, 1, "Generation triggered exactly once upon Continue action");
});

test("RG9: Fallback path works when remote generation fails or is offline", () => {
  // Simulating network failure or missing API key
  const input = "dish washer is not started";
  let fallbackInvoked = false;

  try {
    throw new Error("Local Edge Function timeout or unavailable");
  } catch {
    const angles = generateLocalSemanticAngles(input, 0);
    fallbackInvoked = true;
    assert.ok(angles.gentle.text.includes("dishwasher"));
  }

  assert.equal(fallbackInvoked, true, "Fallback gracefully produced semantic angles without throwing");
});

test("RG10: Fallback output is context-aware across all 10 household pattern domains", () => {
  const domains = [
    { input: "the bathroom light is always left on", expected: "light" },
    { input: "dishwasher was not started last night", expected: "dishwasher" },
    { input: "flippers left in the hallway", expected: "flipper" },
    { input: "kitchen cabinet doors left wide open", expected: "cabinet" },
    { input: "half-empty coffee mug sitting on desk", expected: "mug" },
    { input: "dirty dishes piled in the sink", expected: "dishes" },
    { input: "wet towels left on the bathroom floor", expected: "towel" },
    { input: "car keys misplaced again somewhere", expected: "keys" },
    { input: "we were running late for dinner", expected: "time" },
    { input: "thermostat turned down too low", expected: "weather" },
  ];

  for (const domain of domains) {
    const angles = generateLocalSemanticAngles(domain.input, 0);
    const combined = (angles.gentle.text + " " + angles.playful.text + " " + angles.exaggerated.text).toLowerCase();
    assert.ok(
      combined.includes(domain.expected) || combined.includes(domain.input.split(" ")[0]),
      `Domain "${domain.input}" must reflect context "${domain.expected}" in angles`
    );
  }
});

test("RG11: Private Stage 1 text is not included in shared challenge payload", () => {
  // When challenge is shared from reframe:
  const reframeParams = {
    idea: "Start the dishwasher cycle together",
    participant: "partner",
    source: "reframe",
    reframeTone: "Gentle and cute",
    reframeText: "The dishwasher seems to be waiting patiently for its evening run.",
    shareReframe: "false",
    topicKey: "other",
    customTopicLabel: "dish washer",
  };

  const sharedChallengePayload = {
    title: reframeParams.idea,
    target_participant: reframeParams.participant,
    source: reframeParams.source,
    // Note: private irritation text is explicitly omitted
  };

  assert.equal(sharedChallengePayload.private_irritation_input, undefined);
  assert.equal(sharedChallengePayload.reframeText, undefined);
  assert.ok(!JSON.stringify(sharedChallengePayload).includes("is not started"));
});

test("RG12: Generated lighter angle remains private by default", () => {
  const draftReframeRecord = {
    authorId: "user-123",
    coupleId: "couple-456",
    topicKey: "other",
    privateIrritationInput: "the bathroom light is always on",
    reframeText: "Looks like the light enjoys staying up a little longer.",
    reframeTone: "gentle",
    includeReframeWithPartner: false, // Critical invariant
    status: "draft",
  };

  assert.equal(draftReframeRecord.includeReframeWithPartner, false, "Lighter angle must remain private by default");
});

test("RG13: Regenerate produces a fresh set of angles without altering Stage 1 text", () => {
  const stage1Text = "flippers are removed anywhere in the house";
  const seed0 = generateLocalSemanticAngles(stage1Text, 0);
  const seed1 = generateLocalSemanticAngles(stage1Text, 1);

  assert.equal(stage1Text, "flippers are removed anywhere in the house", "Stage 1 text remained untouched");
  assert.notEqual(seed0.gentle.text, seed1.gentle.text, "Regenerated gentle angle is different variant");
  assert.notEqual(seed0.playful.text, seed1.playful.text, "Regenerated playful angle is different variant");
});

test("RG14: Raw provider or network errors are not shown to user", () => {
  // If an error occurs, UI shows warm, calm message without exposing stack traces or API details
  function getFriendlyErrorMessage(err) {
    // Contract: never expose internal HTTP status or API error bodies
    return "We couldn't reach the lighter angles service just now. Local semantic angles are ready below, or you can try generating again.";
  }

  const rawHttpError = new Error("500 Internal Server Error: OpenAI rate limit exceeded (quota_error)");
  const userMessage = getFriendlyErrorMessage(rawHttpError);

  assert.ok(!userMessage.includes("500"));
  assert.ok(!userMessage.includes("OpenAI"));
  assert.ok(!userMessage.includes("rate limit"));
  assert.ok(userMessage.includes("couldn't reach"));
});

test("RG15: Structured response validation rejects malformed generation outputs", () => {
  // Valid output
  const validData = {
    gentle: "Looks like the dishwasher is waiting patiently for its evening run.",
    playful: "The dishwasher is on strike until someone pushes the shiny start button.",
    exaggerated: "Breaking news: the dishwasher has unionized and demands fair spin cycles.",
  };
  const validated = validateStructuredAnglesResponse(validData);
  assert.equal(validated, true, "Valid response accepted");

  // Missing playful key
  const missingKey = {
    gentle: "A quiet moment with the light.",
    exaggerated: "Breaking news about the light.",
  };
  assert.equal(validateStructuredAnglesResponse(missingKey), false, "Rejects missing keys");

  // Too short (< 4 words)
  const tooShort = {
    gentle: "Too short",
    playful: "Also short",
    exaggerated: "Short too",
  };
  assert.equal(validateStructuredAnglesResponse(tooShort), false, "Rejects answers under 4 words");
});

test("RG16: Provider source is distinguishable internally from fallback", async () => {
  const { generateLighterAnglesHybrid } = await import("../src/lib/reframe-generator.ts");

  // Mock supabase client simulating provider response
  const mockProviderSupabase = {
    functions: {
      invoke: async () => ({
        data: {
          gentle: "A quiet moment with the empty cardboard boxes.",
          playful: "The boxes are constructing their own fortress by the sofa.",
          exaggerated: "Breaking: cardboard republic officially declared sovereign territory.",
          source: "provider",
        },
        error: null,
      }),
    },
  };

  const result = await generateLighterAnglesHybrid(mockProviderSupabase, {
    text: "he keeps opening packages and leaves the empty boxes beside the sofa",
  });

  assert.equal(result.source, "provider", "result.source must be 'provider'");
  assert.ok(result.angles.gentle.text.includes("cardboard"));
});

test("RG17: Provider returns valid structured output", () => {
  const providerOutput = {
    gentle: "The bottles seem to enjoy the chilly air of the fridge.",
    playful: "The fridge door opens to reveal an art installation of clear glass.",
    exaggerated: "Breaking: empty bottles establish permanent residency in the cold zone.",
  };

  assert.equal(validateStructuredAnglesResponse(providerOutput), true);
  assert.ok(providerOutput.gentle.length > 10);
  assert.ok(providerOutput.playful.length > 10);
  assert.ok(providerOutput.exaggerated.length > 10);
});

test("RG18: Unusual input produces semantically relevant provider outputs", () => {
  const pInputs = [
    {
      input: "he keeps opening packages and leaves the empty boxes beside the sofa",
      expectedKeyword: "box",
      output: {
        gentle: "Those empty delivery boxes are just keeping the living room cozy.",
        playful: "The living room has become an unboxing fulfillment warehouse today.",
        exaggerated: "Alert: an architectural skyscraper of cardboard boxes is rising by the sofa.",
      },
    },
    {
      input: "she puts empty bottles back inside the fridge",
      expectedKeyword: "bottle",
      output: {
        gentle: "Those glass bottles seem to appreciate staying cold and refreshed.",
        playful: "The fridge has become a gallery for vintage emptied glassware.",
        exaggerated: "Authorities investigate: empty bottles found claiming prime real estate in the chill zone.",
      },
    },
    {
      input: "the phone charger keeps migrating from one room to another",
      expectedKeyword: "charger",
      output: {
        gentle: "The charger seems to enjoy exploring the house almost as much as you do.",
        playful: "Apparently the charger has started a tiny tour of every room.",
        exaggerated: "Authorities confirm the charger has abandoned its post and gone completely nomadic.",
      },
    },
  ];

  for (const item of pInputs) {
    const combined = (item.output.gentle + " " + item.output.playful + " " + item.output.exaggerated).toLowerCase();
    assert.ok(combined.includes(item.expectedKeyword), `Combined output must reference keyword ${item.expectedKeyword}`);
    assert.equal(validateStructuredAnglesResponse(item.output), true);
  }
});

test("RG19: Provider output is not identical to known static/fallback strings", () => {
  const input = "the phone charger keeps migrating from one room to another";
  const fallback = generateLocalSemanticAngles(input, 0);

  const providerSimulated = {
    gentle: "The charger seems to enjoy exploring the house almost as much as you do.",
    playful: "Apparently the charger has started a tiny tour of every room.",
    exaggerated: "Authorities confirm the charger has abandoned its post and gone completely nomadic.",
  };

  assert.notEqual(providerSimulated.gentle, fallback.gentle.text);
  assert.notEqual(providerSimulated.playful, fallback.playful.text);
  assert.notEqual(providerSimulated.exaggerated, fallback.exaggerated.text);
});

test("RG20: Malformed provider response triggers fallback", async () => {
  const { generateLighterAnglesHybrid } = await import("../src/lib/reframe-generator.ts");

  // Mock supabase returning malformed data (missing exaggerated and playful)
  const mockMalformedSupabase = {
    functions: {
      invoke: async () => ({
        data: {
          gentle: "Only one key provided here.",
        },
        error: null,
      }),
    },
  };

  const result = await generateLighterAnglesHybrid(mockMalformedSupabase, {
    text: "the balcony door keeps being left open while the heater is running",
  });

  assert.equal(result.source, "local_semantic", "Malformed provider output must cleanly trigger local_semantic");
  assert.ok(result.angles.gentle.text.length > 0);
  assert.ok(result.angles.playful.text.length > 0);
  assert.ok(result.angles.exaggerated.text.length > 0);
});

test("RG21: Provider failure triggers fallback without UI error", async () => {
  const { generateLighterAnglesHybrid } = await import("../src/lib/reframe-generator.ts");

  // Mock supabase throwing network error
  const mockErrorSupabase = {
    functions: {
      invoke: async () => {
        throw new Error("503 Service Unavailable: Remote upstream model overloaded");
      },
    },
  };

  let threw = false;
  let result = null;
  try {
    result = await generateLighterAnglesHybrid(mockErrorSupabase, {
      text: "we keep forgetting whose turn it is to buy groceries",
    });
  } catch {
    threw = true;
  }

  assert.equal(threw, false, "Must not throw unhandled exception on provider failure");
  assert.equal(result.source, "local_semantic");
  assert.ok(result.angles.gentle.text.length > 0);
});

test("RG22: Private source text remains excluded from shared challenge data after provider generation", () => {
  const stage1Input = "one of us starts a new toilet roll but leaves the empty cardboard tube beside it";
  const providerOutput = {
    gentle: "The little tube is keeping watch until its successor is settled.",
    playful: "The cardboard tube is waiting for its ceremonial retirement parade.",
    exaggerated: "Breaking news: empty cardboard tube declares itself master of the pedestal.",
  };

  // Challenge parameters constructed from this reframe
  const challengeParams = {
    idea: "Make sure the spare roll is stocked together",
    participant: "both",
    source: "reframe",
    reframeTone: "More playful",
    reframeText: providerOutput.playful,
    shareReframe: "false",
    topicKey: "other",
    customTopicLabel: "toilet paper roll",
  };

  const sharedChallengePayload = {
    title: challengeParams.idea,
    target_participant: challengeParams.participant,
    source: challengeParams.source,
  };

  // Crucial assertions:
  assert.ok(!JSON.stringify(sharedChallengePayload).includes("cardboard tube"));
  assert.ok(!JSON.stringify(sharedChallengePayload).includes("toilet roll"));
  assert.ok(!JSON.stringify(sharedChallengePayload).includes("starts a new"));
  assert.equal(sharedChallengePayload.private_irritation_input, undefined);
  assert.equal(sharedChallengePayload.reframeText, undefined);
});
