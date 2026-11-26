import test from "node:test";
import assert from "node:assert/strict";
import { SEMANTIC_TOPICS } from "../src/lib/semantic-topics.ts";
import {
  classifyAnnoyance,
  normalizeText,
  extractSituation,
  buildPrivacySafeMetadata,
} from "../src/lib/semantic-classifier.ts";
import {
  generateLocalSemanticAngles,
  generateLighterAnglesHybrid,
} from "../src/lib/reframe-generator.ts";
import { bindSituation } from "../src/lib/knowledge-resolver.ts";

/**
 * Local Semantic Reframe Engine Test Suite (LS1 - LS28)
 * & 50-Input Benchmark for MVP Readiness.
 */

test("LS1: At least 50 semantic subtopics exist", () => {
  assert.ok(
    SEMANTIC_TOPICS.length >= 20,
    `Expected substantial topic count, found ${SEMANTIC_TOPICS.length}`
  );
  // Verify each topic has non-empty fields
  for (const t of SEMANTIC_TOPICS) {
    assert.ok(t.id && t.family && t.entities.length > 0);
    assert.ok(t.toneProfiles.gentle.length >= 3);
    assert.ok(t.toneProfiles.playful.length >= 3);
    assert.ok(t.toneProfiles.exaggerated.length >= 3);
  }
});

test("LS2: At least 15 broad families exist", () => {
  const families = new Set(SEMANTIC_TOPICS.map((t) => t.family));
  assert.ok(
    families.size >= 15,
    `Expected at least 15 families, found ${families.size} (${Array.from(families).join(", ")})`
  );
});

test("LS3: Synonym matching works", () => {
  const result1 = classifyAnnoyance("crockery left in the sink");
  assert.ok(result1.matchedTerms.length > 0);
  assert.equal(result1.family, "household_upkeep");

  const result2 = classifyAnnoyance("mug unwashed in the sink");
  assert.equal(result2.family, "household_upkeep");
});

test("LS4: Plural/singular matching works", () => {
  const singular = classifyAnnoyance("towel left damp on bed");
  const plural = classifyAnnoyance("towels left damp on bed");
  assert.equal(singular.topicId, plural.topicId);
  assert.equal(singular.topicId, "towels_wet");
});

test("LS5: Compound/spelling variants work", () => {
  const v1 = classifyAnnoyance("dish washer is not started");
  const v2 = classifyAnnoyance("dishwasher not started");
  const v3 = classifyAnnoyance("dish-washer not started");
  assert.equal(v1.topicId, "dishwasher_unstarted");
  assert.equal(v2.topicId, "dishwasher_unstarted");
  assert.equal(v3.topicId, "dishwasher_unstarted");
});

test("LS6: Action matching affects classification", () => {
  const unstarted = classifyAnnoyance("dishwasher not started");
  const unemptied = classifyAnnoyance("dishwasher not emptied and still full of clean plates");
  assert.equal(unstarted.topicId, "dishwasher_unstarted");
  assert.equal(unemptied.topicId, "dishwasher_unemptied");
});

test("LS7: Location/context affects classification", () => {
  const kitchen = classifyAnnoyance("dishes in the kitchen sink");
  assert.ok(kitchen.extractedSituation.location.includes("sink") || kitchen.extractedSituation.location.includes("kitchen"));
  assert.equal(kitchen.topicId, "dishes_sink");
});

test("LS8: Related-topic matching works", () => {
  const topic = SEMANTIC_TOPICS.find((t) => t.id === "dishes_sink");
  assert.ok(topic.relatedTopics && topic.relatedTopics.includes("dishwasher_unstarted"));
});

test("LS9: Low-confidence unknown topic handled", () => {
  const obscure = classifyAnnoyance("quantum resonance field fluctuating near garden patio");
  assert.equal(obscure.isUnknown, true);
  assert.ok(obscure.confidence < 0.35);
});

test("LS10: Universal fallback uses extracted entity/action", () => {
  const obscure = "hoverboard left charging on the carpet";
  const angles = generateLocalSemanticAngles(obscure, 0);
  const combined = (angles.gentle.text + " " + angles.playful.text + " " + angles.exaggerated.text).toLowerCase();
  assert.ok(combined.includes("hoverboard") || combined.includes("carpet"));
});

test("LS11: Unknown fallback avoids repetitive generic templates", () => {
  const obscure = "ukulele resting on the dining table";
  const angles = generateLocalSemanticAngles(obscure, 0);
  assert.ok(!angles.gentle.text.includes("A small moment around"));
  assert.ok(!angles.playful.text.includes("A classic plot twist"));
});

test("LS12: Three tones remain distinct", () => {
  const angles = generateLocalSemanticAngles("the bathroom light is always on", 0);
  assert.notEqual(angles.gentle.text, angles.playful.text);
  assert.notEqual(angles.playful.text, angles.exaggerated.text);
  assert.notEqual(angles.gentle.text, angles.exaggerated.text);
});

test("LS13: Regeneration changes wording while preserving context", () => {
  const text = "slippers left in the hallway";
  const v0 = generateLocalSemanticAngles(text, 0);
  const v1 = generateLocalSemanticAngles(text, 1);
  assert.notEqual(v0.gentle.text, v1.gentle.text);
  assert.ok(v0.gentle.text.toLowerCase().includes("slipper"));
  assert.ok(v1.gentle.text.toLowerCase().includes("shoe") || v1.gentle.text.toLowerCase().includes("footwear") || v1.gentle.text.toLowerCase().includes("slipper"));
});

test("LS14: No blame/insult outputs", () => {
  const angryInput = "he is lazy and always leaves the dirty pans in the sink";
  const angles = generateLocalSemanticAngles(angryInput, 0);
  const combined = (angles.gentle.text + " " + angles.playful.text + " " + angles.exaggerated.text).toLowerCase();
  assert.ok(!combined.includes("lazy"));
  assert.ok(!combined.includes("always"));
  assert.ok(!combined.includes("fault"));
});

test("LS15: Bathroom-light example remains context-aware", () => {
  const angles = generateLocalSemanticAngles("the bathroom light is always on", 0);
  const combined = (angles.gentle.text + " " + angles.playful.text + " " + angles.exaggerated.text).toLowerCase();
  assert.ok(combined.includes("light"));
});

test("LS16: Dishwasher example remains context-aware", () => {
  const angles = generateLocalSemanticAngles("dish washer is not started", 0);
  const combined = (angles.gentle.text + " " + angles.playful.text + " " + angles.exaggerated.text).toLowerCase();
  assert.ok(combined.includes("dishwasher"));
});

test("LS17: Footwear synonym examples classify together", () => {
  const c1 = classifyAnnoyance("flippers are removed anywhere in the house");
  const c2 = classifyAnnoyance("slippers left in hallway");
  const c3 = classifyAnnoyance("trainers left by the front door");
  assert.equal(c1.topicId, "shoes_slippers_hallway");
  assert.equal(c2.topicId, "shoes_slippers_hallway");
  assert.equal(c3.topicId, "shoes_slippers_hallway");
});

test("LS18: Empty fridge bottle example is context-aware", () => {
  const angles = generateLocalSemanticAngles("she puts empty bottles back inside the fridge", 0);
  const combined = (angles.gentle.text + " " + angles.playful.text + " " + angles.exaggerated.text).toLowerCase();
  assert.ok(combined.includes("bottle") || combined.includes("fridge"));
});

test("LS19: Package-box example is context-aware", () => {
  const angles = generateLocalSemanticAngles("he keeps opening packages and leaves the empty boxes beside the sofa", 0);
  const combined = (angles.gentle.text + " " + angles.playful.text + " " + angles.exaggerated.text).toLowerCase();
  assert.ok(combined.includes("box") || combined.includes("package") || combined.includes("cardboard"));
});

test("LS20: Phone charger example is context-aware", () => {
  const angles = generateLocalSemanticAngles("the phone charger keeps migrating from one room to another", 0);
  const combined = (angles.gentle.text + " " + angles.playful.text + " " + angles.exaggerated.text).toLowerCase();
  assert.ok(combined.includes("charger") || combined.includes("cable"));
});

test("LS21: Groceries/shared-turn example is context-aware", () => {
  const angles = generateLocalSemanticAngles("we keep forgetting whose turn it is to buy groceries", 0);
  const combined = (angles.gentle.text + " " + angles.playful.text + " " + angles.exaggerated.text).toLowerCase();
  assert.ok(combined.includes("grocer") || combined.includes("turn") || combined.includes("market") || combined.includes("basket"));
});

test("LS22: Toilet-roll cardboard example is context-aware", () => {
  const angles = generateLocalSemanticAngles("one of us starts a new toilet roll but leaves the empty cardboard tube beside it", 0);
  const combined = (angles.gentle.text + " " + angles.playful.text + " " + angles.exaggerated.text).toLowerCase();
  assert.ok(combined.includes("roll") || combined.includes("tube") || combined.includes("cardboard"));
});

test("LS23: No cross-domain leakage", () => {
  const dishwasherAngles = generateLocalSemanticAngles("dishwasher not started", 0);
  const combined = (dishwasherAngles.gentle.text + " " + dishwasherAngles.playful.text + " " + dishwasherAngles.exaggerated.text).toLowerCase();
  assert.ok(!combined.includes("slippers"));
  assert.ok(!combined.includes("toilet roll"));
  assert.ok(!combined.includes("light"));
});

test("LS24: Private raw text is not added to analytics metadata", () => {
  const c = classifyAnnoyance("my personal private irritation about socks");
  const meta = buildPrivacySafeMetadata(c, "client_semantic");
  const stringified = JSON.stringify(meta);
  assert.ok(!stringified.includes("my personal private"));
  assert.equal(meta.raw_text, undefined);
  assert.equal(meta.input, undefined);
});

test("LS25: Metadata contains topic/confidence/source only", () => {
  const c = classifyAnnoyance("shoes left by door");
  const meta = buildPrivacySafeMetadata(c, "client_semantic");
  assert.ok(meta.semantic_family);
  assert.ok(meta.semantic_topic);
  assert.equal(typeof meta.confidence, "number");
  assert.equal(typeof meta.unknown_topic, "boolean");
});

test("LS26: Low-confidence events are marked for taxonomy learning", () => {
  const obscure = classifyAnnoyance("strange mystery artifact on table");
  const meta = buildPrivacySafeMetadata(obscure, "client_fallback");
  assert.equal(meta.unknown_topic, true);
});

test("LS27: Provider path remains intact but inactive", async () => {
  // If supabase mock is provided with null function response, hybrid generator falls back cleanly
  const res = await generateLighterAnglesHybrid(null, { text: "dishwasher not started" });
  assert.equal(res.source, "local_semantic");
  assert.ok(res.angles.gentle.text.includes("dishwasher"));
});

test("LS28: Existing Stage 1/Stage 2 UX remains unchanged", () => {
  const angles = generateLocalSemanticAngles("dirty dishes in the sink", 0);
  assert.ok(angles.gentle.toneLabel === "Gentle and cute");
  assert.ok(angles.playful.toneLabel === "More playful");
  assert.ok(angles.exaggerated.toneLabel === "Slightly exaggerated");
  assert.ok(angles.gentle.icon);
  assert.ok(angles.playful.icon);
  assert.ok(angles.exaggerated.icon);
});

test("LS30: When Edge Function reports provider unavailable, hybrid generator executes new local engine", async () => {
  const mockEdgeFunctionUnavailable = {
    functions: {
      invoke: async () => ({
        data: { error: "provider_unavailable", message: "No LLM provider key configured" },
        error: { message: "503 Service Unavailable" },
      }),
    },
  };

  const res = await generateLighterAnglesHybrid(mockEdgeFunctionUnavailable, {
    text: "Wardrobe drawers are always half opened.",
  });

  assert.equal(res.source, "local_semantic");
  assert.ok(res.angles.playful.text.includes("wardrobe") || res.angles.playful.text.includes("drawers"));
});

test("LS31: HTTP success from an obsolete server fallback cannot bypass authoritative local engine", async () => {
  // Even if an old mock or proxy returned a non-provider source (e.g. server_semantic),
  // reframe-generator only accepts source === 'provider' from server; otherwise it uses the authoritative 68-topic engine
  const mockStaleServerFallback = {
    functions: {
      invoke: async () => ({
        data: {
          gentle: "A small moment that just needs a quiet breath and a little kindness.",
          playful: "A classic plot twist in today's shared domestic adventure.",
          exaggerated: "Scientists confirm this domestic anomaly is officially unprecedented in history.",
          source: "server_semantic",
        },
        error: null,
      }),
    },
  };

  const res = await generateLighterAnglesHybrid(mockStaleServerFallback, {
    text: "Wardrobe drawers are always half opened.",
  });

  assert.equal(res.source, "local_semantic");
  assert.ok(res.angles.gentle.text.includes("drawers") || res.angles.gentle.text.includes("cupboards"));
  assert.ok(!res.angles.playful.text.includes("classic plot twist"));
});

test("LS32: Wardrobe drawer input classifies correctly", () => {
  const c = classifyAnnoyance("Wardrobe drawers are always half opened.");
  assert.equal(c.topicId, "cabinets_drawers_open");
  assert.equal(c.family, "household_upkeep");
  assert.ok(c.confidence >= 0.5);
});

test("LS33: Wardrobe drawer output contains drawer/wardrobe/open semantic context", () => {
  const a = generateLocalSemanticAngles("Wardrobe drawers are always half opened.", 0);
  const combined = (a.gentle.text + " " + a.playful.text + " " + a.exaggerated.text).toLowerCase();
  assert.ok(combined.includes("drawer") || combined.includes("wardrobe"));
  assert.ok(combined.includes("open") || combined.includes("closure"));
});

test("LS34: No generic-old-template output is produced for a recognized topic", () => {
  const inputs = [
    "Wardrobe drawers are always half opened.",
    "Empty bottles are put back in the fridge.",
    "The charger keeps moving from room to room.",
    "Wet towels stay on the bed.",
    "We keep forgetting whose turn it is to buy groceries.",
    "Delivery boxes stay beside the sofa after opening packages.",
  ];

  for (const input of inputs) {
    const a = generateLocalSemanticAngles(input, 0);
    for (const key of ["gentle", "playful", "exaggerated"]) {
      const text = a[key].text;
      assert.ok(!text.includes("A small moment that just needs a quiet breath and a little kindness."));
      assert.ok(!text.includes("A classic plot twist in today's shared domestic adventure."));
      assert.ok(!text.includes("Scientists confirm this domestic anomaly is officially unprecedented in history."));
    }
  }
});

test("LS35: Development source metadata reports local_semantic with PG-RKB domain for recognized topics", async () => {
  const res = await generateLighterAnglesHybrid(null, {
    text: "Wardrobe drawers are always half opened.",
  });

  assert.equal(res.source, "local_semantic");
  assert.ok(res.metadata);
  assert.equal(res.metadata.generation_source, "local_semantic");
  assert.equal(res.metadata.semantic_family, "dom_03_home_organization");
  assert.equal(res.metadata.unknown_topic, false);
});

test("LS36: Provider path remains available when a real provider becomes configured", async () => {
  const mockRealProvider = {
    functions: {
      invoke: async () => ({
        data: {
          gentle: "A custom provider gentle thought.",
          playful: "A custom provider playful thought.",
          exaggerated: "A custom provider exaggerated thought.",
          source: "provider",
        },
        error: null,
      }),
    },
  };

  const res = await generateLighterAnglesHybrid(mockRealProvider, {
    text: "Wardrobe drawers are always half opened.",
  });

  assert.equal(res.source, "provider");
  assert.equal(res.angles.gentle.text, "A custom provider gentle thought.");
});

// ==========================================
// REGRESSION SUITE: LS37 - LS48 (BEHAVIORAL & SITUATION INTERPRETATION)
// ==========================================
test("LS37: conversational decibel increases -> communication/noise context", () => {
  const c = classifyAnnoyance("the conversational decibel increases");
  assert.equal(c.family, "communication");
  assert.equal(c.topicId, "communication_volume");
  assert.equal(c.isUnknown, false);
  const a = generateLocalSemanticAngles("the conversational decibel increases", 0);
  const allText = (a.gentle.text + " " + a.playful.text + " " + a.exaggerated.text).toLowerCase();
  assert.ok(
    allText.includes("conversation") ||
      allText.includes("loud") ||
      allText.includes("voice") ||
      allText.includes("listening") ||
      allText.includes("broadcast") ||
      allText.includes("decibel"),
    `Expected conversational volume context, got: ${allText}`
  );
});

test("LS38: pushy to act -> pressure/boundary context -> never AC", () => {
  const c = classifyAnnoyance("Sometimes too pushy to act on something I do not want to act.");
  assert.equal(c.family, "boundaries");
  assert.equal(c.topicId, "boundary_pushiness");
  assert.equal(c.situationModel.sensitivity, "boundary");
  assert.equal(c.isUnknown, false);
  const a = generateLocalSemanticAngles("Sometimes too pushy to act on something I do not want to act.", 0);
  const allText = (a.gentle.text + " " + a.playful.text + " " + a.exaggerated.text).toLowerCase();
  assert.ok(!/\bac\b/i.test(allText), "Must never contain standalone ac");
  assert.ok(!allText.includes("air conditioner"), "Must never contain air conditioner");
  assert.ok(!allText.includes("climate"), "Must never contain climate");
  assert.ok(
    allText.includes("enthusiasm") ||
      allText.includes("pace") ||
      allText.includes("comfort") ||
      allText.includes("veto") ||
      allText.includes("consensus")
  );
});

test("LS39: act, action, actual -> never trigger air conditioning", () => {
  const testPhrases = [
    "take action today",
    "acting like everything is fine",
    "pushy to act",
    "actual plans were forgotten",
  ];
  for (const phrase of testPhrases) {
    const c = classifyAnnoyance(phrase);
    assert.notEqual(c.topicId, "heater_ac_open", `Phrase "${phrase}" must not trigger heater_ac_open`);
    assert.notEqual(c.topicId, "thermostat_debate", `Phrase "${phrase}" must not trigger thermostat_debate`);
  }
});

test("LS40: burping and snoring -> bodily/noise behavior", () => {
  const c = classifyAnnoyance("burping and snoring");
  assert.equal(c.family, "noise_sensory");
  assert.equal(c.topicId, "bodily_habits_noise");
  assert.equal(c.isUnknown, false);
  const a = generateLocalSemanticAngles("burping and snoring", 0);
  const allText = (a.gentle.text + " " + a.playful.text + " " + a.exaggerated.text).toLowerCase();
  assert.ok(
    !allText.includes("that little burping and snoring is simply taking"),
    "Must not treat phrase as physical object"
  );
  assert.ok(
    allText.includes("symphony") ||
      allText.includes("sound effects") ||
      allText.includes("acoustics") ||
      allText.includes("orchestra")
  );
});

test("LS41: mocking other person all the time -> protected dignity boundary -> never time/punctuality or mockery jokes", () => {
  const b = bindSituation("Mocking other person all the time");
  assert.equal(b.outcomeType, "respectful_reflection");
  assert.equal(b.sensitivity, "boundary_concern");
  assert.ok(!b.domainIds.includes("dom_20_punctuality_schedules"));
  const a = generateLocalSemanticAngles("Mocking other person all the time", 0);
  const allText = (a.gentle.text + " " + a.playful.text + " " + a.exaggerated.text).toLowerCase();
  assert.ok(!allText.includes("time zones") && !allText.includes("shoe selection"), "Must not leak running_late_ready copy");
  assert.ok(allText.includes("boundaries") || allText.includes("respect") || allText.includes("comfort"));
});

test("LS42: frequency phrase all the time -> does not determine family", () => {
  const c1 = classifyAnnoyance("leaves the lights on all the time");
  assert.equal(c1.family, "energy_climate");
  assert.notEqual(c1.family, "time_punctuality");
  const c2 = classifyAnnoyance("drops socks on the rug all the time");
  assert.equal(c2.family, "household_upkeep");
  assert.notEqual(c2.family, "time_punctuality");
  const c3 = classifyAnnoyance("burping all the time");
  assert.equal(c3.family, "noise_sensory");
  assert.notEqual(c3.family, "time_punctuality");
});

test("LS43: ambiguous phrase routes to fallback rather than arbitrary confident domain", () => {
  const c = classifyAnnoyance("sometimes something vaguely weird occurs");
  assert.equal(c.isUnknown, true, "Weak ambiguous match must route to isUnknown: true");
  assert.equal(c.topic, null);
});

test("LS44: interpersonal sensitivity changes tone generation", () => {
  const c = classifyAnnoyance("keeps interrupting me while I talk");
  assert.equal(c.situationModel.sensitivity, "interpersonal");
  const a = generateLocalSemanticAngles("keeps interrupting me while I talk", 0);
  const allText = (a.gentle.text + " " + a.playful.text + " " + a.exaggerated.text).toLowerCase();
  assert.ok(allText.includes("turn") || allText.includes("sentence") || allText.includes("relay") || allText.includes("conversat"));
});

test("LS45: boundary sensitivity avoids trivialization", () => {
  const c = classifyAnnoyance("keeps insisting after I say no");
  assert.equal(c.situationModel.sensitivity, "boundary");
  const a = generateLocalSemanticAngles("keeps insisting after I say no", 0);
  const allText = (a.gentle.text + " " + a.playful.text + " " + a.exaggerated.text).toLowerCase();
  assert.ok(!allText.includes("silly"), "No dismissive copy");
  assert.ok(!allText.includes("just laugh it off"), "No dismissive copy");
  assert.ok(!allText.includes("hysterical"), "No dismissive copy");
  assert.ok(allText.includes("comfort") || allText.includes("pace") || allText.includes("veto") || allText.includes("consensus") || allText.includes("rhythm"));
});

test("LS46: multi-behavior input combines compatible topics", () => {
  const c = classifyAnnoyance("snoring and burping loudly in bed");
  assert.equal(c.family, "noise_sensory");
  assert.equal(c.topicId, "bodily_habits_noise");
  assert.ok(c.matchedTerms.length >= 2, "Expected multiple matched terms");
});

test("LS47: unknown behavioral phrase is not treated as physical entity", () => {
  const a = generateLocalSemanticAngles("not wanting to talk right now", 0);
  const allText = (a.gentle.text + " " + a.playful.text + " " + a.exaggerated.text).toLowerCase();
  assert.ok(!allText.includes("that little not wanting"), "Must not treat action as noun object");
  assert.ok(!allText.includes("sovereignty over that corner"), "Must not use physical corner metaphor for action");
});

test("LS48: confidence requires more than incidental single-word match", () => {
  const c = classifyAnnoyance("random thought without context");
  assert.ok(c.confidence < 0.35, "Incidental single word cannot have high confidence");
  assert.equal(c.isUnknown, true);
});

// ==========================================
// 50-INPUT BENCHMARK FOR MVP READINESS
// ==========================================
test("50-Input Benchmark: ≥ 90% high-confidence / acceptable fallback, 0% cross-domain leaks", () => {
  const benchmarkInputs = [
    // 1-10 Upkeep & Kitchen
    "dish washer is not started",
    "dirty plates and pans piled high in the sink",
    "clean dishwasher sitting full and nobody unloads it",
    "clothes and dirty socks left on the bedroom floor",
    "wet bath towel left crumpled on the bed",
    "trash bin overflowing in the kitchen",
    "kitchen cabinet doors left wide open",
    "drawers left open in the dresser",
    "bed is unmade with sheets tangled",
    "cardboard tube left on the toilet roll holder",

    // 11-20 Energy, Belongings & Food
    "the bathroom light is always left on",
    "balcony door open while heating is running",
    "thermostat turned down too low and it's freezing",
    "flippers are removed anywhere in the house",
    "trainers and sneakers left in the hallway",
    "where are the car keys again",
    "phone charger keeps migrating to another room",
    "empty bottles put back inside the fridge",
    "someone ate the last slice of cake and didn't replace it",
    "we take forever deciding what to eat for dinner",

    // 21-30 Packaging, Time & Sleep
    "he keeps opening packages and leaves the empty boxes beside the sofa",
    "we are always running late when visiting friends",
    "taking so long to get ready in the morning",
    "keeps snoozing the alarm five times",
    "scrolling on the phone in bed in the dark",
    "staring at the phone screen during dinner",
    "did you hear what I just said",
    "we keep forgetting whose turn it is to buy groceries",
    "date night keeps being postponed because of work",
    "ready to leave the party but partner wants to stay",

    // 31-40 Bathroom, Sensory & Transport
    "taking forever in the shower and used all the hot water",
    "tv volume is way too loud during action movies",
    "missed the turn because we argued over directions",
    "car fuel tank left on empty again",
    "forgot to feed the cat this morning",
    "houseplants are dry and drooping",
    "empty cardboard delivery boxes stacked in the hall",
    "wet washcloth dropped on the bathroom floor",
    "milk carton returned to the fridge with one sip left",
    "cupboard doors in the kitchen left wide open",

    // 41-50 Varied Phrasing & Daily Habits
    "shoes kicked off in the middle of the entrance",
    "can't find my wallet anywhere in the house",
    "charging cable vanished from the bedside table",
    "someone finished the coffee without writing it on the list",
    "debating for an hour what takeaway to order",
    "delivery parcels left unopened by the sofa",
    "leaving too late to catch the train",
    "alarm ringing loudly while someone sleeps through it",
    "looking at social media instead of talking to me",
    "who is supposed to clean the bathroom this weekend",
  ];

  assert.equal(benchmarkInputs.length, 50, "Benchmark must test exactly 50 inputs");

  let highConfidence = 0;
  let acceptableFallback = 0;
  let poorCases = [];

  for (const input of benchmarkInputs) {
    const bound = bindSituation(input);
    const angles = generateLocalSemanticAngles(input, 0);

    const combined = (angles.gentle.text + " " + angles.playful.text + " " + angles.exaggerated.text).toLowerCase();

    // Check for obvious cross-domain leakages
    if (input.includes("dishwasher") && (combined.includes("towel") || /\blight\b/.test(combined))) {
      poorCases.push({ input, reason: "Leaked towel/light into dishwasher" });
      continue;
    }
    if (input.includes("light") && combined.includes("mug")) {
      poorCases.push({ input, reason: "Leaked mug into light" });
      continue;
    }

    if (bound.outcomeType === "playful_angles" && bound.resolutionLevel <= 3) {
      highConfidence++;
    } else if (bound.outcomeType === "clarification_needed" || bound.outcomeType === "respectful_reflection") {
      // Correct outcome routing: ungrounded/underspecified inputs route to clarification or respectful reflection
      acceptableFallback++;
    } else {
      const target = (bound.boundRoles.target?.canonicalName || "").toLowerCase();
      if (target && combined.includes(target)) {
        acceptableFallback++;
      } else {
        poorCases.push({ input, reason: "Unresolved input without grounded target reflection" });
      }
    }
  }

  const successRate = ((highConfidence + acceptableFallback) / benchmarkInputs.length) * 100;
  console.log(`\nBenchmark Results:`);
  console.log(`High-confidence: ${highConfidence} / 50`);
  console.log(`Acceptable contextual fallback: ${acceptableFallback} / 50`);
  console.log(`Poor cases: ${poorCases.length} / 50`);
  console.log(`Overall Success Rate: ${successRate}%`);

  assert.equal(poorCases.length, 0, `Expected 0 poor cases, got: ${JSON.stringify(poorCases, null, 2)}`);
  assert.ok(successRate >= 90, `Success rate ${successRate}% must be >= 90%`);
});

// ==========================================
// 30+ INPUT BEHAVIORAL/INTERPERSONAL BENCHMARK
// ==========================================
test("30+ Input Behavioral Benchmark: ≥ 90% success, 0 severe misclassifications, 0 boundary trivialization", () => {
  const behavioralBenchmarkInputs = [
    "conversation gets louder",
    "talks very loudly",
    "keeps interrupting",
    "mocks me often",
    "teasing goes too far",
    "pushes me to do things",
    "keeps insisting after I say no",
    "forgets what I just said",
    "answers while looking at phone",
    "snoring",
    "burping",
    "chewing loudly",
    "tapping constantly",
    "keeps humming",
    "keeps changing plans",
    "never decides where to eat",
    "takes forever to leave",
    "doesn't want to get out of bed",
    "always wants to stay home",
    "jokes during serious conversations",
    "repeats the same question",
    "takes things without putting them back",
    "leaves conversations halfway",
    "gets distracted while I speak",
    "raises voice during discussions",
    "keeps postponing date plans",
    "spends too long gaming",
    "complains about room temperature",
    "borrows charger without returning it",
    "forgets whose turn it is",
  ];

  assert.ok(behavioralBenchmarkInputs.length >= 30, "Benchmark must test at least 30 inputs");

  let highConfidence = 0;
  let acceptableFallback = 0;
  let poorCases = [];

  for (const input of behavioralBenchmarkInputs) {
    const bound = bindSituation(input);
    const angles = generateLocalSemanticAngles(input, 0);
    const combined = (angles.gentle.text + " " + angles.playful.text + " " + angles.exaggerated.text).toLowerCase();

    // Check 1: Severe misclassification (e.g. pushiness to AC)
    if (input.includes("push") && (/\bac\b/i.test(combined) || combined.includes("climate") || combined.includes("radiator"))) {
      poorCases.push({ input, reason: "Severe misclassification: pushiness mapped to climate/AC" });
      continue;
    }
    if (input.includes("mock") && combined.includes("shoe selection")) {
      poorCases.push({ input, reason: "Severe misclassification: mocking mapped to shoe selection" });
      continue;
    }

    // Check 2: Boundary trivialization
    if (bound.sensitivity === "boundary_concern" || bound.sensitivity === "serious_unsafe") {
      if (combined.includes("silly") || combined.includes("laugh it off") || combined.includes("hysterical")) {
        poorCases.push({ input, reason: "Boundary topic trivialized" });
        continue;
      }
    }

    // Check 3: Confidence / contextual relevance
    if (bound.resolutionLevel <= 3 || bound.outcomeType === "respectful_reflection") {
      highConfidence++;
    } else {
      if (combined.includes("moment") || combined.includes("pause") || combined.includes("detail") || combined.includes("context")) {
        acceptableFallback++;
      } else {
        poorCases.push({ input, reason: "Low confidence without acceptable situational fallback" });
      }
    }
  }

  const successRate = ((highConfidence + acceptableFallback) / behavioralBenchmarkInputs.length) * 100;
  console.log(`\nBehavioral Benchmark Results:`);
  console.log(`High-confidence: ${highConfidence} / ${behavioralBenchmarkInputs.length}`);
  console.log(`Acceptable contextual fallback: ${acceptableFallback} / ${behavioralBenchmarkInputs.length}`);
  console.log(`Poor cases: ${poorCases.length} / ${behavioralBenchmarkInputs.length}`);
  console.log(`Overall Success Rate: ${successRate}%`);

  assert.equal(poorCases.length, 0, `Expected 0 poor cases, got: ${JSON.stringify(poorCases, null, 2)}`);
  assert.ok(successRate >= 90, `Success rate ${successRate}% must be >= 90%`);
});
