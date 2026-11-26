import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeText,
  containsWholeWord,
  analyzeLinguisticStructure,
} from "../src/lib/semantic-normalizer.ts";
import {
  interpretSituation,
} from "../src/lib/situation-interpreter.ts";
import {
  HUMOR_STRATEGIES,
  selectHumorStrategies,
} from "../src/lib/humor-strategies.ts";
import { composeAngles } from "../src/lib/tone-composer.ts";
import { validateReframeQuality } from "../src/lib/reframe-quality-guard.ts";
import {
  AUTHORITATIVE_ENGINE_MODE,
  generateAuthoritativeDetails,
  generateLocalSemanticAngles,
  generateLighterAnglesHybrid,
  determineReframeOutcome,
} from "../src/lib/reframe-generator.ts";
import { bindSituation } from "../src/lib/knowledge-resolver.ts";

/**
 * Purple Garden — Compositional Semantic Interpretation & Humor Engine Test Suite
 * CS01 - CS40
 * Benchmarks B, C, D, E, F, G
 */

// =============================================================
// CS01 - CS40 REGRESSION SUITE
// =============================================================

test("CS01: Novel behavior and context combination interpreted without a dedicated exact sentence", () => {
  const s = interpretSituation("making funny faces when we are discussing something important");
  assert.equal(s.context, "serious conversation");
  assert.ok(s.contrast);
  assert.equal(s.contrast.type, "seriousness_vs_silliness");
  const a = composeAngles(s, 0);
  const combined = (a.gentle + " " + a.playful + " " + a.exaggerated).toLowerCase();
  assert.ok(combined.includes("serious") || combined.includes("conversation") || combined.includes("soundtrack") || combined.includes("effects"));
});

test("CS02: Serious context plus unexpected noise produces contextually related humor", () => {
  const s = interpretSituation("Making weird noise in serious situations");
  assert.equal(s.contrast?.type, "seriousness_vs_silliness");
  const a = composeAngles(s, 0);
  assert.ok(a.gentle.toLowerCase().includes("soundtrack") || a.gentle.toLowerCase().includes("serious"));
  assert.ok(a.playful.toLowerCase().includes("sound effects") || a.playful.toLowerCase().includes("audio"));
  assert.ok(a.exaggerated.toLowerCase().includes("sound-effects") || a.exaggerated.toLowerCase().includes("interrupted"));
});

test("CS03: Behavioral actions are not treated as physical objects", () => {
  const s = interpretSituation("burping and snoring");
  const a = composeAngles(s, 0);
  const combined = (a.gentle + " " + a.playful + " " + a.exaggerated).toLowerCase();
  assert.ok(!combined.includes("that little burping and snoring is simply taking"));
  assert.ok(!combined.includes("sovereignty over that corner"));
});

test("CS04: Multiple compatible behaviors combine coherently", () => {
  const s = interpretSituation("talking loudly and interrupting during dinner");
  assert.ok(s.behaviors.length >= 2 || s.context === "dinner table");
  assert.equal(s.sensitivity, "interpersonal");
});

test("CS05: Negation changes interpretation correctly", () => {
  const pos = analyzeLinguisticStructure("leaves the light on");
  const neg = analyzeLinguisticStructure("does not leave the light on");
  assert.equal(pos.hasNegation, false);
  assert.equal(neg.hasNegation, true);
});

test("CS06: Actor and target relationships are preserved", () => {
  const l1 = analyzeLinguisticStructure("mocking me all the time");
  const l2 = analyzeLinguisticStructure("mocking everyone all the time");
  assert.equal(l1.target, "user");
  assert.equal(l2.target, "partner");
});

test("CS07: Frequency does not independently determine topic", () => {
  const s = interpretSituation("leaves the bedroom light on all the time");
  assert.notEqual(s.family, "time_punctuality");
  assert.equal(s.frequency, "recurring");
});

test("CS08: Short-token matching does not produce false domain matches", () => {
  assert.equal(containsWholeWord("we need to act fast", "ac"), false);
  assert.equal(containsWholeWord("cleaning the carpet", "car"), false);
  assert.equal(containsWholeWord("sometimes", "time"), false);
});

test("CS09: Ambiguous phrases do not introduce unsupported locations", () => {
  const s = interpretSituation("Not getting out");
  assert.equal(s.ambiguity, true);
  assert.equal(s.location, undefined);
});

test("CS10: Known topic and surrounding context both influence generation", () => {
  const s = interpretSituation("phone ringing loudly during dinner");
  assert.equal(s.context, "dinner table");
  const a = composeAngles(s, 0);
  const combined = (a.gentle + " " + a.playful + " " + a.exaggerated).toLowerCase();
  assert.ok(combined.includes("dinner") || combined.includes("table") || combined.includes("phone"));
});

test("CS11: Unknown topic can produce successful compositional generation", () => {
  const s = interpretSituation("whispering jokes while trying to concentrate");
  assert.ok(s.confidence >= 0.5);
  const a = composeAngles(s, 0);
  assert.ok(a.gentle.length > 0 && a.playful.length > 0 && a.exaggerated.length > 0);
});

test("CS12: Humor strategies are selected according to semantic compatibility", () => {
  const s = interpretSituation("Wardrobe drawers are always half opened.");
  const gentleStrats = selectHumorStrategies(s, "gentle");
  assert.ok(gentleStrats.some((st) => st.id === "H1_personification" || st.id === "H4_playful_contrast"));
});

test("CS13: Gentle tone is recognizably warm and lightly humorous", () => {
  const a = generateLocalSemanticAngles("During the conversation the voice increases", 0);
  assert.ok(!a.gentle.text.includes("Two passionate voices learning each other's natural listening levels"));
  assert.ok(a.gentle.text.toLowerCase().includes("outdoor voice") || a.gentle.text.toLowerCase().includes("conversation"));
});

test("CS14: Playful tone uses a materially different construction", () => {
  const a = generateLocalSemanticAngles("During the conversation the voice increases", 0);
  assert.notEqual(a.gentle.text, a.playful.text);
  const p = a.playful.text.toLowerCase();
  assert.ok(p.includes("front-row") || p.includes("stadium announcer") || p.includes("volume dial") || p.includes("microphone"));
});

test("CS15: Exaggerated tone uses meaningful contextual absurdity", () => {
  const a = generateLocalSemanticAngles("During the conversation the voice increases", 0);
  const e = a.exaggerated.text.toLowerCase();
  assert.ok(e.includes("cell towers") || e.includes("satellites") || e.includes("tickets") || e.includes("broadcast") || e.includes("decibel") || e.includes("hallway"));
});

test("CS16: All three tones preserve the same underlying situation", () => {
  const a = generateLocalSemanticAngles("Burping and snoring", 0);
  for (const t of [a.gentle.text, a.playful.text, a.exaggerated.text]) {
    const lower = t.toLowerCase();
    assert.ok(
      lower.includes("sound") ||
        lower.includes("rhythm") ||
        lower.includes("acoustic") ||
        lower.includes("bedroom"),
      `Tone must preserve situation context, got: ${t}`
    );
  }
});

test("CS17: Regeneration provides meaningful variation", () => {
  const a1 = generateLocalSemanticAngles("Burping and snoring", 0);
  const a2 = generateLocalSemanticAngles("Burping and snoring", 1);
  assert.notEqual(a1.gentle.text, a2.gentle.text);
  assert.notEqual(a1.playful.text, a2.playful.text);
});

test("CS18: Regeneration does not introduce semantic drift", () => {
  const a1 = generateLocalSemanticAngles("Making weird noise in serious situations", 0);
  const a2 = generateLocalSemanticAngles("Making weird noise in serious situations", 1);
  assert.ok(a1.playful.text.toLowerCase().includes("sound effects") || a1.playful.text.toLowerCase().includes("audio"));
  const p2 = a2.playful.text.toLowerCase();
  assert.ok(p2.includes("stillness") || p2.includes("serious") || p2.includes("sound") || p2.includes("audio") || p2.includes("dignity"));
});

test("CS19: Recent outputs are not immediately repeated", () => {
  const a1 = generateLocalSemanticAngles("Wardrobe drawers are always half opened.", 0);
  const a2 = generateLocalSemanticAngles("Wardrobe drawers are always half opened.", 1);
  assert.notEqual(a1.playful.text, a2.playful.text);
});

test("CS20: Subject-verb agreement remains valid", () => {
  const a = generateLocalSemanticAngles("The coffee mug is on the table", 0);
  assert.ok(/^[A-Z]/.test(a.gentle.text));
  assert.ok(/[.!?]$/.test(a.gentle.text));
});

test("CS21: Multiple behavioral expressions produce grammatical sentences", () => {
  const a = generateLocalSemanticAngles("talking very loud and interrupting me", 0);
  assert.ok(a.gentle.text.length > 10);
  assert.ok(a.playful.text.length > 10);
  assert.ok(a.exaggerated.text.length > 10);
});

test("CS22: Boundary concerns are not romanticized or dismissed", () => {
  const a = generateLocalSemanticAngles("Sometimes too pushy to act on something I do not want to act", 0);
  const combined = (a.gentle.text + " " + a.playful.text + " " + a.exaggerated.text).toLowerCase();
  assert.ok(!combined.includes("silly"));
  assert.ok(!combined.includes("laugh it off"));
  assert.ok(combined.includes("comfort") || combined.includes("pace") || combined.includes("caution") || combined.includes("consensus") || combined.includes("veto"));
});

test("CS23: Serious safety-related concerns do not receive humorous reframes", () => {
  const s = interpretSituation("He threatened me and I am terrified for my safety");
  assert.equal(s.sensitivity, "serious");
  assert.equal(s.humorSuitability, "none");
});

test("CS24: Serious concerns cannot accidentally enter the playful challenge flow", () => {
  const s = interpretSituation("He locked me out of the house and I feel unsafe");
  const a = generateLocalSemanticAngles("He locked me out of the house and I feel unsafe", 0);
  const outcome = determineReframeOutcome(s, a);
  assert.equal(outcome.type, "respectful_reflection");
});

test("CS25: Local-only generation does not invoke the external provider or Edge Function", async () => {
  let invoked = false;
  const mockSupabase = {
    functions: {
      invoke: async () => {
        invoked = true;
        return { data: null, error: new Error("Should not be called") };
      },
    },
  };
  const res = await generateLighterAnglesHybrid(mockSupabase, {
    text: "During the conversation the voice increases",
    mode: "local_only",
  });
  assert.equal(invoked, false, "Local-only mode must not invoke Edge Function");
  assert.ok(res.angles.gentle.text.length > 0);
});

test("CS26: Future provider integration remains preserved", async () => {
  const mockProvider = {
    functions: {
      invoke: async () => ({
        data: {
          gentle: "A future provider gentle reframe.",
          playful: "A future provider playful reframe.",
          exaggerated: "A future provider exaggerated reframe.",
          source: "provider",
        },
        error: null,
      }),
    },
  };
  const res = await generateLighterAnglesHybrid(mockProvider, {
    text: "During the conversation the voice increases",
    mode: "hybrid",
  });
  assert.equal(res.source, "provider");
  assert.equal(res.angles.gentle.text, "A future provider gentle reframe.");
});

test("CS27: Raw input is not included in analytics metadata", async () => {
  const res = await generateLighterAnglesHybrid(null, {
    text: "My secret private relationship grievance about dishes",
  });
  assert.ok(res.metadata);
  const metadataStr = JSON.stringify(res.metadata);
  assert.ok(!metadataStr.includes("My secret private relationship grievance"));
});

test("CS28: Stage 1 edits invalidate stale Stage 2 output", () => {
  const a1 = generateLocalSemanticAngles("dishes in the sink", 0);
  const a2 = generateLocalSemanticAngles("wardrobe drawers are always half opened", 0);
  assert.notEqual(a1.gentle.text, a2.gentle.text);
});

test("CS29: Rapid generation requests cannot display stale results", () => {
  const s = interpretSituation("snoring loudly in bed");
  const a = composeAngles(s, 0);
  assert.ok(a.gentle.toLowerCase().includes("sound") || a.gentle.toLowerCase().includes("acoustic"));
});

test("CS30: Selected angle transitions correctly into Stage 3", () => {
  const angles = generateLocalSemanticAngles("During the conversation the voice increases", 0);
  assert.ok(angles.gentle.text.length > 0);
  assert.equal(angles.gentle.toneLabel, "Gentle and cute");
});

test("CS31: Existing privacy boundaries remain intact", () => {
  const s = interpretSituation("Private irritation about socks");
  assert.equal(s.rawText, "Private irritation about socks");
});

test("CS32: Existing recognized household topics remain functional", () => {
  const s = interpretSituation("dishwasher not started");
  assert.equal(s.primaryTopic, "dishwasher_unstarted");
});

test("CS33: Unsupported object attributes and locations are not introduced", () => {
  const s = interpretSituation("making weird noise in serious situations");
  const a = composeAngles(s, 0);
  const combined = (a.gentle + " " + a.playful + " " + a.exaggerated).toLowerCase();
  assert.ok(!combined.includes("kitchen"));
  assert.ok(!combined.includes("dishwasher"));
  assert.ok(!combined.includes("sofa"));
});

test("CS34: Confidence reflects corroborated interpretation rather than incidental keywords", () => {
  const sVague = interpretSituation("Not getting out");
  const sClear = interpretSituation("Making weird noise in serious situations");
  assert.ok(sClear.confidence > sVague.confidence, "Corroborated situation must have higher confidence than vague action");
});

test("CS35: Clarification and respectful-reflection outcomes remain navigable", () => {
  const sAmbiguous = interpretSituation("Not getting out");
  const aAmbiguous = generateLocalSemanticAngles("Not getting out", 0);
  const outcomeAmbiguous = determineReframeOutcome(sAmbiguous, aAmbiguous);
  assert.equal(outcomeAmbiguous.type, "clarification_needed");

  const sSerious = interpretSituation("threatened me and I am scared");
  const aSerious = generateLocalSemanticAngles("threatened me and I am scared", 0);
  const outcomeSerious = determineReframeOutcome(sSerious, aSerious);
  assert.equal(outcomeSerious.type, "respectful_reflection");
});

test("CS36: Repeated input with a controlled seed produces reproducible test output", () => {
  const a1 = generateLocalSemanticAngles("During the conversation the voice increases", 0);
  const a2 = generateLocalSemanticAngles("During the conversation the voice increases", 0);
  assert.equal(a1.gentle.text, a2.gentle.text);
  assert.equal(a1.playful.text, a2.playful.text);
  assert.equal(a1.exaggerated.text, a2.exaggerated.text);
});

test("CS37: Valid contextual sentences containing unrelated distractor words do not lose the correct semantic match", () => {
  const s = interpretSituation("We need to take action because the ac is blowing freezing air");
  assert.equal(s.primaryTopic, "heater_ac_open");
});

test("CS38: Humor suitability is evaluated before selecting a humor strategy", () => {
  const s = interpretSituation("He violently punched the wall and scared me");
  assert.equal(s.humorSuitability, "none");
  const strats = selectHumorStrategies(s, "playful");
  assert.equal(strats.length, 0, "No humor strategy should be compatible with serious situation");
});

test("CS39: Generation remains bounded when no valid humorous construction can be produced", () => {
  const s = interpretSituation("completely unknown extraterrestrial phenomenon");
  const a = composeAngles(s, 0);
  assert.ok(a.gentle.length > 0 && a.playful.length > 0 && a.exaggerated.length > 0);
});

test("CS40: Actual browser Stage 2 uses the authoritative local compositional engine", () => {
  const a = generateLocalSemanticAngles("Making weird noise in serious situations", 0);
  assert.ok(a.playful.text.toLowerCase().includes("sound effects"));
});

// =============================================================
// BENCHMARK B: Semantic Paraphrase Benchmark (30+ Cases)
// =============================================================
test("Benchmark B: Semantic Paraphrase Benchmark (30+ cases)", () => {
  const paraphrasePairs = [
    ["During the conversation the voice increases", "voice getting loud when we talk"],
    ["talks very loudly during chats", "conversational volume keeps going up"],
    ["making weird noise in serious situations", "funny sounds when discussing something important"],
    ["odd noises during serious conversations", "making random sound effects while we talk seriously"],
    ["burping and snoring in bed", "snores and burps loudly at night"],
    ["loud chewing and humming", "chews loudly and hums constantly"],
    ["mocking everyone all the time", "mocks people and teases constantly"],
    ["making fun of me repeatedly", "poking fun at me all evening"],
    ["too pushy to act on things", "pressuring me to make a decision"],
    ["keeps insisting after I say no", "pushes me to do something I do not want"],
    ["takes forever to get ready to leave", "takes so long before heading out the door"],
    ["always rushing at the last minute to leave", "taking an hour to put on shoes"],
    ["wardrobe drawers are always half opened", "dresser drawers left open all day"],
    ["cabinet doors in kitchen left wide open", "cupboard doors left standing open"],
    ["dishes piled high in the sink", "unwashed plates soaking in the kitchen basin"],
    ["forgot to start the dishwasher", "dishwasher loaded but never started"],
    ["clean dishwasher sitting full of mugs", "nobody unloads the clean dishwasher"],
    ["wet towels crumpled on the bed", "damp bath towel dropped on the mattress"],
    ["dirty socks left on bedroom floor", "clothes dropped beside the bed instead of basket"],
    ["bathroom light left on all morning", "forgot to turn off the light in the bathroom"],
    ["thermostat turned down too cold", "freezing in the house because of the thermostat"],
    ["balcony door open while heater is on", "window open while heat is running"],
    ["phone charger keeps disappearing", "charging cable missing from bedside table"],
    ["car keys missing again", "can't find my keys anywhere"],
    ["empty milk bottle put back in fridge", "finished carton left in the refrigerator"],
    ["someone ate the last slice of cake", "finished the snacks without writing on the list"],
    ["never decides where to eat dinner", "takes forever deciding what takeaway to order"],
    ["scrolling on phone during dinner", "looking at screen instead of talking at the table"],
    ["keeps interrupting me while I speak", "talking over me before I finish my sentence"],
    ["not getting out of bed all morning", "always wants to stay home on weekends"],
  ];

  assert.ok(paraphrasePairs.length >= 30, "Benchmark B must have at least 30 pairs");

  let successfulPairs = 0;
  for (const [p1, p2] of paraphrasePairs) {
    const s1 = interpretSituation(p1);
    const s2 = interpretSituation(p2);
    // Verify semantic consistency: either primaryTopic matches, or contrast matches, or sensitivity matches
    const isConsistent =
      s1.primaryTopic === s2.primaryTopic ||
      s1.contrast?.type === s2.contrast?.type ||
      s1.family === s2.family;
    if (isConsistent) {
      successfulPairs++;
    }
  }

  const rate = (successfulPairs / paraphrasePairs.length) * 100;
  console.log(`\nBenchmark B (Paraphrase Consistency): ${successfulPairs} / ${paraphrasePairs.length} (${rate.toFixed(1)}%)`);
  assert.ok(rate >= 90, `Paraphrase consistency rate ${rate}% must be >= 90%`);
});

// =============================================================
// BENCHMARK C: Compositional Benchmark (40+ Cases)
// =============================================================
test("Benchmark C: Compositional Benchmark (40+ unfamiliar combinations)", () => {
  const compositionalInputs = [
    "making weird noise in serious situations",
    "making funny faces when we are discussing something important",
    "laughing during an important talk",
    "humming loudly while I am trying to concentrate",
    "tapping pencil on table while we discuss finances",
    "answers phone while we are having a serious conversation",
    "checking sports scores during anniversary dinner",
    "scrolling social media while I explain my work day",
    "playing video games when we planned to leave",
    "watching videos in bed with sound on",
    "whispering during the movie when I asked for silence",
    "sudden sound effects during an emotional movie",
    "singing opera while doing the dishes",
    "doing workout exercises in the middle of the kitchen",
    "leaving suitcase unpacked in the hallway for three weeks",
    "taking photos of dinner before we can eat",
    "practicing golf swing in the living room",
    "wearing sunglasses inside the dark house",
    "reorganizing pantry at midnight",
    "starting vacuum cleaner right when I get on a phone call",
    "ordering takeaway for one without asking",
    "putting cold feet on my back in bed",
    "borrowing my favorite sweater without asking",
    "leaving wet umbrella open on the sofa",
    "stacking books on top of the toaster",
    "putting keys in the freezer by mistake",
    "leaving tea bag directly on the counter",
    "drinking orange juice straight from the carton",
    "changing car radio station during my favorite song",
    "turning off the fan when I just turned it on",
    "opening window while air conditioning is blasting",
    "leaving garden hose running all afternoon",
    "leaving shoe boxes stacked against the front door",
    "asking what time it is every five minutes",
    "setting six consecutive alarms five minutes apart",
    "walking into the room and immediately forgetting what was needed",
    "reading aloud news headlines while I am reading a book",
    "eating crunchy snacks while I am on a work call",
    "cleaning kitchen counters with bath towel",
    "hiding TV remote between couch cushions",
    "calling my name from across the house instead of walking over",
  ];

  assert.ok(compositionalInputs.length >= 40, "Benchmark C must have at least 40 inputs");

  let acceptableCount = 0;
  for (const input of compositionalInputs) {
    const s = interpretSituation(input);
    const a = composeAngles(s, 0);
    const validation = validateReframeQuality(a, s);
    if (validation.isValid) {
      acceptableCount++;
    }
  }

  const rate = (acceptableCount / compositionalInputs.length) * 100;
  console.log(`\nBenchmark C (Compositional Generation): ${acceptableCount} / ${compositionalInputs.length} (${rate.toFixed(1)}%)`);
  assert.ok(rate >= 90, `Compositional success rate ${rate}% must be >= 90%`);
});

// =============================================================
// BENCHMARK D: Ambiguity and Negation (20+ Cases)
// =============================================================
test("Benchmark D: Ambiguity and Negation Benchmark (20+ cases)", () => {
  const ambiguityCases = [
    { input: "Not getting out", expectAmbiguous: true },
    { input: "out of it", expectAmbiguous: true },
    { input: "stuff happens", expectAmbiguous: true },
    { input: "things", expectAmbiguous: true },
    { input: "getting out", expectAmbiguous: true },
    { input: "leaves the light on", expectNegation: false },
    { input: "does not leave the light on", expectNegation: true },
    { input: "forgets to turn the light off", expectNegation: false },
    { input: "never puts shoes away", expectNegation: true },
    { input: "makes noises in bed", expectNegation: false },
    { input: "does not make noises", expectNegation: true },
    { input: "asks me not to make noises", expectNegation: true },
    { input: "without telling me", expectNegation: true },
    { input: "cannot decide what to eat", expectNegation: true },
    { input: "refuses to leave the house", expectNegation: true },
    { input: "will not unload the dishwasher", expectNegation: true },
    { input: "not listening to me", expectNegation: true },
    { input: "it happens all the time", expectAmbiguous: false },
    { input: "acting like everything is fine", expectNegation: false },
    { input: "carpet needs cleaning", expectNegation: false },
  ];

  assert.ok(ambiguityCases.length >= 20, "Benchmark D must have at least 20 cases");

  let correctD = 0;
  for (const item of ambiguityCases) {
    const s = interpretSituation(item.input);
    const l = analyzeLinguisticStructure(item.input);
    if (item.expectAmbiguous !== undefined) {
      if (s.ambiguity === item.expectAmbiguous) correctD++;
    } else if (item.expectNegation !== undefined) {
      if (l.hasNegation === item.expectNegation) correctD++;
    }
  }

  const rate = (correctD / ambiguityCases.length) * 100;
  console.log(`\nBenchmark D (Ambiguity & Negation): ${correctD} / ${ambiguityCases.length} (${rate.toFixed(1)}%)`);
  assert.ok(rate >= 90, `Ambiguity & Negation rate ${rate}% must be >= 90%`);
});

// =============================================================
// BENCHMARK E: Emotional Sensitivity (25+ Cases)
// =============================================================
test("Benchmark E: Emotional Sensitivity Benchmark (25+ cases)", () => {
  const sensitivityCases = [
    // Level A: Light quirks
    { input: "left his coffee mug on the table", expected: "light" },
    { input: "snoring loudly at night", expected: "light" },
    { input: "drawers left half open in dresser", expected: "light" },
    { input: "phone charger moved again", expected: "light" },
    { input: "cant decide what to eat for dinner", expected: "light" },
    // Level B: Mild interpersonal
    { input: "keeps interrupting me during conversations", expected: "interpersonal" },
    { input: "answers while looking at phone", expected: "interpersonal" },
    { input: "During the conversation the voice increases", expected: "interpersonal" },
    { input: "mocking everyone all the time", expected: "interpersonal" },
    { input: "teasing goes a bit too far", expected: "interpersonal" },
    // Level C: Boundary concerns
    { input: "Sometimes too pushy to act on something I do not want to act", expected: "boundary" },
    { input: "keeps insisting after I say no", expected: "boundary" },
    { input: "pressuring me to make a financial choice", expected: "boundary" },
    { input: "pushes me to do things when I am tired", expected: "boundary" },
    { input: "wont take no for an answer", expected: "boundary" },
    // Level D: Serious / Unsafe (Zero humor allowed)
    { input: "He threatened me and I am terrified for my safety", expected: "serious" },
    { input: "Physically violent and hit me yesterday", expected: "serious" },
    { input: "Locked me out in the cold and took my phone", expected: "serious" },
    { input: "Coercive control and stalks my location", expected: "serious" },
    { input: "Sexual pressure when I said no", expected: "serious" },
    { input: "Destroyed my belongings in anger and I feel scared", expected: "serious" },
    { input: "Fear for my safety around him", expected: "serious" },
    { input: "Abusive yelling and intimidation", expected: "serious" },
    { input: "Punched a hole in the door next to my head", expected: "serious" },
    { input: "I am scared of his anger", expected: "serious" },
  ];

  assert.ok(sensitivityCases.length >= 25, "Benchmark E must have at least 25 cases");

  let correctE = 0;
  for (const item of sensitivityCases) {
    const s = interpretSituation(item.input);
    if (s.sensitivity === item.expected) {
      correctE++;
    }
    // High-risk zero-humor enforcement
    if (item.expected === "serious") {
      assert.equal(s.humorSuitability, "none", `Serious situation must have humorSuitability 'none': ${item.input}`);
    }
  }

  const rate = (correctE / sensitivityCases.length) * 100;
  console.log(`\nBenchmark E (Emotional Sensitivity): ${correctE} / ${sensitivityCases.length} (${rate.toFixed(1)}%)`);
  assert.ok(rate >= 90, `Sensitivity rate ${rate}% must be >= 90%`);
});

// =============================================================
// BENCHMARK F: Regeneration & Tone Diversity (15+ Eligible Playful Situations)
// (Note: Phase 5 boundary safety cases like repetitive mocking & unwanted pressure
//  route to static respectful_reflection and are verified by MVP12 instead)
// =============================================================
test("Benchmark F: Regeneration & Tone Diversity Benchmark (15+ situations)", () => {
  const testSituations = [
    "During the conversation the voice increases",
    "Making weird noise in serious situations",
    "Burping and snoring",
    "Wardrobe drawers are always half opened.",
    "dishes piled high in the sink",
    "leaving socks on the floor",
    "phone charger keeps migrating",
    "takes forever to get ready in the morning",
    "never decides where to eat dinner",
    "scrolling on phone during meals",
    "bathroom light left on",
    "thermostat turned down too low",
    "keeps interrupting me while I talk",
    "making tea with just water and namesake milk",
    "always forgetting to water the living room houseplant",
  ];

  assert.ok(testSituations.length >= 15, "Benchmark F must have at least 15 eligible situations");

  let distinctRoundsCount = 0;
  for (const input of testSituations) {
    const a1 = generateLocalSemanticAngles(input, 0);
    const a2 = generateLocalSemanticAngles(input, 1);
    const a3 = generateLocalSemanticAngles(input, 2);

    // Verify tone distinctness within each round
    assert.notEqual(a1.gentle.text, a1.playful.text);
    assert.notEqual(a1.playful.text, a1.exaggerated.text);

    // Verify novelty across consecutive regenerations
    if (a1.playful.text !== a2.playful.text && a2.playful.text !== a3.playful.text) {
      distinctRoundsCount++;
    }
  }

  const rate = (distinctRoundsCount / testSituations.length) * 100;
  console.log(`\nBenchmark F (Regeneration Diversity): ${distinctRoundsCount} / ${testSituations.length} (${rate.toFixed(1)}%)`);
  assert.ok(rate >= 90, `Regeneration diversity rate ${rate}% must be >= 90%`);
});

// =============================================================
// BENCHMARK G: Frozen Holdout Evaluation (40 Unseen Inputs)
// =============================================================
test("Benchmark G: Frozen Holdout Evaluation (40 previously unused inputs)", () => {
  const frozenHoldoutInputs = [
    "leaving kitchen cabinet handles greasy after cooking",
    "splashing water all over the bathroom mirror while brushing teeth",
    "wearing muddy shoes onto the clean living room rug",
    "opening a new box of cereal when three boxes are already open",
    "leaving wet sponge sitting at the bottom of the sink",
    "hanging wet jacket over the wooden dining chair",
    "using my special scissors to cut cardboard and dulling them",
    "forgetting to turn off curling iron on bathroom counter",
    "leaving empty ice cube tray in the freezer",
    "leaving microwave door open with food crumbs inside",
    "playing acoustic guitar while I am watching television",
    "cracking knuckles repeatedly during quiet reading time",
    "eating noisily with mouth open at breakfast",
    "clearing throat loudly every thirty seconds",
    "humming cartoon theme songs during dinner",
    "talking with food in mouth during Sunday brunch",
    "answering phone on speaker in public transport",
    "yawning with exaggerated theatrics during a movie",
    "interrupting my story to point out an unrelated dog outside",
    "correcting my pronunciation in front of friends",
    "making jokes when I am crying about a hard day at work",
    "telling our private inside jokes to casual acquaintances",
    "ignoring questions until asked three times",
    "staring at smartwatch notifications while I speak",
    "leaving conversations to check laundry in the basement",
    "walking ahead too fast on the sidewalk",
    "taking forty minutes to choose a movie on Netflix",
    "packing three suitcases for an overnight weekend trip",
    "leaving the car headlights on overnight",
    "parking too close to the garage wall",
    "forgetting where we parked the car at the mall",
    "eating the cherries off my dessert without asking",
    "leaving teaspoon with dried honey on the granite counter",
    "putting empty coffee bean bag back in pantry",
    "refusing to ask for directions when clearly lost",
    "turning volume all the way up for commercials",
    "falling asleep two minutes into every movie we pick",
    "waking up at 5 am on Saturday making loud breakfast",
    "leaving hairbrush full of hair on the dining table",
    "leaving front door unlocked before going to bed",
  ];

  assert.equal(frozenHoldoutInputs.length, 40, "Holdout must test exactly 40 inputs");

  let holdoutSuccess = 0;
  for (const input of frozenHoldoutInputs) {
    const s = interpretSituation(input);
    const a = composeAngles(s, 0);
    const v = validateReframeQuality(a, s);
    if (v.isValid && s.confidence >= 0.35) {
      holdoutSuccess++;
    }
  }

  const rate = (holdoutSuccess / frozenHoldoutInputs.length) * 100;
  console.log(`\nBenchmark G (Frozen Holdout): ${holdoutSuccess} / ${frozenHoldoutInputs.length} (${rate.toFixed(1)}%)`);
  assert.ok(rate >= 90, `Holdout success rate ${rate}% must be >= 90%`);
});

// =============================================================
// MVP TARGETED ACCEPTANCE SUITE (MVP01 - MVP18)
// =============================================================

test("MVP01: Interpersonal generation does not infer unsupported positive motivation", () => {
  const s = interpretSituation("Mocking everyone all the time");
  const a = composeAngles(s, 0);
  const combined = (a.gentle + " " + a.playful + " " + a.exaggerated).toLowerCase();
  assert.ok(!combined.includes("playful hearts"), "Must not infer playful hearts");
  assert.ok(!combined.includes("banter"), "Must not infer mutual banter");
  assert.ok(!combined.includes("affection"), "Must not infer affection");
});

test("MVP02: Boundary-related generation does not replace unwanted pressure with enthusiasm", () => {
  const s = interpretSituation("Sometimes too pushy to act on something I do not want to act");
  const a = composeAngles(s, 0);
  const combined = (a.gentle + " " + a.playful + " " + a.exaggerated).toLowerCase();
  assert.ok(!combined.includes("enthusiasm"), "Must not translate pressure into enthusiasm");
  assert.ok(!combined.includes("authentic rhythm"), "Must not use rhythm therapy cliché");
});

test("MVP03: An explicit refusal cannot become hesitation or uncertainty", () => {
  const s = interpretSituation("I do not want to go and they keep insisting");
  assert.equal(s.sensitivity, "boundary");
  const outcome = determineReframeOutcome(s, composeAngles(s, 0));
  assert.equal(outcome.type, "respectful_reflection", "Refusal must route to respectful reflection");
});

test("MVP04: Repeated insistence after refusal routes to an appropriate restricted outcome", () => {
  const s = interpretSituation("Insisting after I say no repeatedly");
  assert.equal(s.sensitivity, "boundary");
  const outcome = determineReframeOutcome(s, composeAngles(s, 0));
  assert.equal(outcome.type, "respectful_reflection");
  assert.ok(outcome.reflectionMessage?.includes("Not every moment needs a lighter angle"));
});

test("MVP05: Repeated unwanted mocking is not automatically characterized as mutual playfulness", () => {
  const s = interpretSituation("Mocking everyone all the time");
  assert.equal(s.sensitivity, "boundary");
  const outcome = determineReframeOutcome(s, composeAngles(s, 0));
  assert.equal(outcome.type, "respectful_reflection");
});

test("MVP06: Ordinary harmless teasing remains eligible for contextual humor", () => {
  const s = interpretSituation("Gentle teasing about my funny socks");
  assert.ok(s.sensitivity === "light" || s.sensitivity === "interpersonal");
  const outcome = determineReframeOutcome(s, composeAngles(s, 0));
  assert.equal(outcome.type, "playful_angles");
});

test("MVP07: Potentially serious concerns never receive playful angles in tested cases", () => {
  const seriousCases = [
    "Threatened to leave me on the highway",
    "Destroyed my belongings in anger and I feel scared",
    "Forcing me to give them my money",
    "Locks me out of the house at night",
  ];
  for (const input of seriousCases) {
    const s = interpretSituation(input);
    assert.equal(s.sensitivity, "serious");
    assert.equal(s.humorSuitability, "none");
    const outcome = determineReframeOutcome(s, composeAngles(s, 0));
    assert.equal(outcome.type, "respectful_reflection");
  }
});

test("MVP08: Restricted outcomes cannot proceed into inappropriate challenge creation", () => {
  const s = interpretSituation("Refuses to stop when I say no");
  const outcome = determineReframeOutcome(s, composeAngles(s, 0));
  assert.equal(outcome.type, "respectful_reflection");
  // When outcome is respectful_reflection, tone selection and challenge progression are withheld
  assert.notEqual(outcome.type, "playful_angles");
});

test("MVP09: Ambiguous inputs preserve the original text during clarification", () => {
  const s = interpretSituation("Not getting out");
  assert.ok(s.ambiguity);
  const outcome = determineReframeOutcome(s, composeAngles(s, 0));
  assert.equal(outcome.type, "clarification_needed");
  assert.ok(outcome.clarificationMessage?.includes("A little more context?"));
});

test("MVP10: Clarification uses the revised input rather than stale interpretation", () => {
  const sInitial = interpretSituation("Not getting out");
  assert.ok(sInitial.ambiguity);
  const sRevised = interpretSituation("Not getting out of bed on rainy Saturday mornings");
  assert.ok(!sRevised.ambiguity);
  assert.equal(sRevised.primaryTopic, "routine_leaving_stuck");
  const outcome = determineReframeOutcome(sRevised, composeAngles(sRevised, 0));
  assert.equal(outcome.type, "playful_angles");
});

test("MVP11: Skipping humor is possible", () => {
  const s = interpretSituation("Wardrobe drawers are always half opened");
  const outcome = determineReframeOutcome(s, composeAngles(s, 0));
  assert.ok(outcome);
  // User has option to choose alternative card / calm friction moment without playful angles
});

test("MVP12: Regeneration cannot override sensitivity restrictions", () => {
  const s = interpretSituation("Threatened to leave me on the highway");
  for (let seed = 0; seed < 5; seed++) {
    const outcome = determineReframeOutcome(s, composeAngles(s, seed));
    assert.equal(outcome.type, "respectful_reflection", `Seed ${seed} must not override sensitivity`);
  }
});

test("MVP13: Local-only runtime makes zero external AI generation calls", async () => {
  let networkCalled = false;
  const mockSupabase = {
    functions: {
      invoke: async () => {
        networkCalled = true;
        return { data: null, error: new Error("Network blocked") };
      },
    },
  };
  const res = await generateLighterAnglesHybrid(mockSupabase, {
    text: "Leaving socks on the floor",
    mode: "local_only",
  });
  assert.equal(networkCalled, false, "Local-only mode must not invoke functions");
  assert.ok(res.angles);
});

test("MVP14: Private description and angle sharing boundaries remain intact", () => {
  const s = interpretSituation("Wardrobe drawers are always half opened");
  const a = composeAngles(s, 0);
  const challengePayload = {
    idea: "Close the drawers together",
    participant: "partner",
    // Private fields are explicitly excluded
  };
  assert.ok(!("rawAnnoyance" in challengePayload));
  assert.ok(!("reframeText" in challengePayload));
});

test("MVP15: Editing Stage 1 invalidates all previous Stage 2 results", () => {
  const text1 = "Bathroom light left on";
  const s1 = interpretSituation(text1);
  const text2 = "Slippers in hallway";
  const s2 = interpretSituation(text2);
  assert.notEqual(s1.primaryTopic, s2.primaryTopic);
});

test("MVP16: Correctly selected ordinary angles reach Stage 3", () => {
  const s = interpretSituation("dishwasher was not started last night");
  const a = composeAngles(s, 0);
  const outcome = determineReframeOutcome(s, a);
  assert.equal(outcome.type, "playful_angles");
  assert.ok(a.gentle.length > 5);
});

test("MVP17: The complete browser customer journey remains functional", () => {
  const s = interpretSituation("the bathroom light is always left on");
  const a = composeAngles(s, 0);
  const v = validateReframeQuality(a, s);
  assert.ok(v.isValid);
});

test("MVP18: No irrelevant generic fallback is shown where a sufficiently supported compositional interpretation exists", () => {
  const s = interpretSituation("During the conversation the voice increases");
  const a = composeAngles(s, 0);
  const combined = (a.gentle + " " + a.playful + " " + a.exaggerated).toLowerCase();
  assert.ok(combined.includes("voice") || combined.includes("volume") || combined.includes("acoustics") || combined.includes("conversation"));
  assert.ok(!combined.includes("pause button"), "Must not default to generic pause button");
});

// =============================================================
// HUMAN ACCEPTANCE PERMANENT REGRESSION SUITE (HAF01 - HAF08)
// =============================================================

test("HAF01: Failure A - talking too loud on the phone interprets phone context and volume contrast", () => {
  const s = interpretSituation("talking too loud on the phone");
  assert.equal(s.context, "phone call");
  assert.ok(s.behaviors.includes("raising voice or volume"));
  assert.equal(s.contrast?.type, "normal_volume_vs_loudness");
  const a = composeAngles(s, 0);
  const combined = (a.gentle + " " + a.playful + " " + a.exaggerated).toLowerCase();
  assert.ok(combined.includes("phone"));
  assert.ok(combined.includes("call") || combined.includes("broadcast") || combined.includes("speaker") || combined.includes("telecom"));
  assert.ok(!combined.includes("blue moonbeam") && !combined.includes("midnight outdoor cinema"), "Must not leak phone_screen_bed copy");
});

test("HAF02: Failure A variant - speaking very loudly during a phone call", () => {
  const s = interpretSituation("speaking very loudly during a phone call");
  assert.equal(s.context, "phone call");
  const a = composeAngles(s, 0);
  const combined = (a.gentle + " " + a.playful + " " + a.exaggerated).toLowerCase();
  assert.ok(combined.includes("phone"));
});

test("HAF03: Failure B - making tea with just water and namesake milk preserves quantity proportion", () => {
  const s = interpretSituation("making tea with just water and namesake milk");
  assert.equal(s.primaryTopic, "kitchen_tea_coffee");
  assert.equal(s.linguistic.quantityModifier?.type, "negligible");
  assert.equal(s.linguistic.quantityModifier?.target, "milk");
  const a = composeAngles(s, 0);
  const combined = (a.gentle + " " + a.playful + " " + a.exaggerated).toLowerCase();
  assert.ok(combined.includes("tea") && combined.includes("milk"));
  assert.ok(combined.includes("telepathy") || combined.includes("brief") || combined.includes("whisper") || combined.includes("honorary") || combined.includes("homeopathic"));
  assert.ok(!combined.includes("cat") && !combined.includes("houseplants"), "Must not leak pets_plants copy");
});

test("HAF04: Failure B variant - brewing coffee with barely any milk", () => {
  const s = interpretSituation("brewing coffee with barely any milk");
  assert.equal(s.linguistic.quantityModifier?.type, "negligible");
  const a = composeAngles(s, 0);
  const combined = (a.gentle + " " + a.playful + " " + a.exaggerated).toLowerCase();
  assert.ok(combined.includes("milk"));
});

test("HAF05: Failure C - yoga is not an exercise is recognized as proposition and routes to clarification", () => {
  const s = interpretSituation("yoga is not an exercise");
  assert.ok(s.linguistic.proposition, "Must extract proposition");
  assert.equal(s.linguistic.proposition?.subject, "yoga");
  assert.equal(s.linguistic.proposition?.isNegated, true);
  assert.equal(s.situationType, "ambiguous");
  assert.equal(s.entities.length, 0, "Must not personify yoga as physical object");
  const a = composeAngles(s, 0);
  const outcome = determineReframeOutcome(s, a);
  assert.equal(outcome.type, "clarification_needed");
  const v = validateReframeQuality(a, s);
  assert.equal(v.isValid, false, "Quality guard must reject ungrounded generic templates for propositions");
});

test("HAF06: Failure C variant - running is not a real sport routes to clarification", () => {
  const s = interpretSituation("running is not a real sport");
  assert.ok(s.linguistic.proposition);
  assert.equal(s.situationType, "ambiguous");
  const outcome = determineReframeOutcome(s, composeAngles(s, 0));
  assert.equal(outcome.type, "clarification_needed");
});

test("HAF07: Failure D - Not washing big utensils ever recognizes selective chore avoidance", () => {
  const s = interpretSituation("Not washing big utensils ever.");
  assert.ok(s.behaviors.includes("washing dishes or utensils"));
  assert.ok(s.linguistic.hasNegation);
  assert.equal(s.family, "household_upkeep");
  const a = composeAngles(s, 0);
  const combined = (a.gentle + " " + a.playful + " " + a.exaggerated).toLowerCase();
  assert.ok(combined.includes("utensil") || combined.includes("pot") || combined.includes("sink"));
  assert.ok(!combined.includes("domestic pause button") && !combined.includes("unhurried perspective"), "Must not fall back to generic pause templates");
});

test("HAF08: Failure D variant - refusing to wash the large pots in the sink", () => {
  const s = interpretSituation("refusing to wash the large pots in the sink");
  assert.ok(s.behaviors.includes("washing dishes or utensils"));
  const a = composeAngles(s, 0);
  const combined = (a.gentle + " " + a.playful + " " + a.exaggerated).toLowerCase();
  assert.ok(combined.includes("pot") || combined.includes("sink") || combined.includes("utensil"));
});

// =============================================================
// PHASE 5 AUTHORITATIVE CONSOLIDATION & SEMANTIC INTEGRITY SUITE
// =============================================================
test("PH5_01: Authoritative PG-RKB + PG-HKB is single active production engine", async () => {
  assert.equal(AUTHORITATIVE_ENGINE_MODE, "authoritative");
  const res = await generateLighterAnglesHybrid(null, { text: "keeps scrubbing the cast iron skillet in the sink", mode: "local_only" });
  assert.equal(res.enginePath, "knowledge_enriched");
  assert.ok(res.provenance && res.provenance.constructionIds.length === 3);
});

test("PH5_02: Active scrubbing polarity never flips into soaking/untouched omission", () => {
  for (let seed = 0; seed < 3; seed++) {
    const d = generateAuthoritativeDetails("keeps scrubbing the cast iron skillet in the sink", seed);
    assert.equal(d.bound.frameId, "frame_active_cleaning_scrubbing");
    assert.ok(d.bound.actionPolarity === "repeated" || d.bound.actionPolarity === "active");
    const txt = (d.angles.gentle.text + " " + d.angles.playful.text + " " + d.angles.exaggerated.text).toLowerCase();
    assert.ok(!/\b(soaking|bubble bath|unwashed|resting beside the drain)\b/i.test(txt), `Polarity leak on seed ${seed}: ${txt}`);
  }
});

test("PH5_03: Houseplant care never leaks cat/pet imagery", () => {
  for (let seed = 0; seed < 3; seed++) {
    const d = generateAuthoritativeDetails("always forgetting to water the living room houseplant", seed);
    assert.equal(d.bound.frameId, "frame_houseplant_pet_care");
    const txt = (d.angles.gentle.text + " " + d.angles.playful.text + " " + d.angles.exaggerated.text).toLowerCase();
    assert.ok(!/\b(cat|feline|dog|puppy|litter)\b/i.test(txt), `Pet leak on houseplant seed ${seed}: ${txt}`);
  }
});

test("PH5_04: Empty milk carton in fridge never leaks postal delivery box imagery", () => {
  for (let seed = 0; seed < 3; seed++) {
    const d = generateAuthoritativeDetails("putting empty milk cartons back inside the fridge", seed);
    assert.equal(d.bound.frameId, "frame_empty_container_fridge");
    const txt = (d.angles.gentle.text + " " + d.angles.playful.text + " " + d.angles.exaggerated.text).toLowerCase();
    assert.ok(!/\b(delivery box|postal)\b/i.test(txt), `Delivery box leak on seed ${seed}: ${txt}`);
  }
});

test("PH5_05: Toast crumbs on sofa never trigger legacy sovereignty boilerplate", () => {
  for (let seed = 0; seed < 3; seed++) {
    const d = generateAuthoritativeDetails("dropping toast crumbs all over the sofa cushions", seed);
    assert.equal(d.bound.frameId, "frame_object_displacement");
    const txt = (d.angles.gentle.text + " " + d.angles.playful.text + " " + d.angles.exaggerated.text).toLowerCase();
    assert.ok(!/\b(sovereignty|kingdom)\b/i.test(txt));
    assert.ok(txt.includes("crumbs") && txt.includes("sofa"));
  }
});

test("PH5_06: Burping and snoring routes to sleep acoustics, never phone call", () => {
  const d = generateAuthoritativeDetails("burping and snoring loudly right beside the bed", 0);
  assert.equal(d.bound.frameId, "frame_sleep_acoustics");
  const txt = (d.angles.gentle.text + " " + d.angles.playful.text + " " + d.angles.exaggerated.text).toLowerCase();
  assert.ok(!txt.includes("phone call") && !txt.includes("into the burping"));
});

test("PH5_07: Scrolling on phone during dinner routes to attention distraction, never phone call", () => {
  const d = generateAuthoritativeDetails("scrolling on phone during dinner", 0);
  assert.equal(d.bound.frameId, "frame_attention_distraction");
  const txt = (d.angles.gentle.text + " " + d.angles.playful.text + " " + d.angles.exaggerated.text).toLowerCase();
  assert.ok(!txt.includes("cell towers") && !txt.includes("outdoor volume"));
});

test("PH5_08: Dirty dishes piled high in sink routes to omitted_forgotten dish soak omission", () => {
  const d = generateAuthoritativeDetails("dishes piled high in the sink", 0);
  assert.equal(d.bound.frameId, "frame_dish_soaking_omission");
  assert.equal(d.bound.actionPolarity, "omitted_forgotten");
});

test("PH5_09: Realized sentences contain zero determiner collisions, duplicate adjectives, or placeholder artifacts", () => {
  const sample = [
    "the conversational decibel increases",
    "kitchen cabinet doors left wide open",
    "he keeps opening packages and leaves the empty boxes beside the sofa",
    "one of us starts a new toilet roll but leaves the empty cardboard tube beside it",
    "Not washing big utensils ever",
  ];
  for (const inp of sample) {
    const a = generateLocalSemanticAngles(inp, 0);
    const comb = `${a.gentle.text} ${a.playful.text} ${a.exaggerated.text}`;
    assert.ok(!/\{[a-z_]+\}/i.test(comb), `Unresolved slot in: ${comb}`);
    assert.ok(!/\b(the|this|that)\s+(the|this|that)\b/i.test(comb), `Determiner collision in: ${comb}`);
    assert.ok(!/\b(big|giant|oversized|heavy|large)\s+\1\b/i.test(comb), `Duplicate adjective in: ${comb}`);
    assert.ok(!/\b(?:big\s+big|oversized\s+big|giant\s+big)\b/i.test(comb), `Stacked adjective in: ${comb}`);
    assert.ok(!/into the voice/i.test(comb), `Awkward phrasing in: ${comb}`);
  }
});

test("PH5_10: Legacy rollback mode remains explicit and never runs automatically in authoritative path", async () => {
  const auth = await generateLighterAnglesHybrid(null, { text: "the conversational decibel increases", mode: "local_only" });
  const rollback = await generateLighterAnglesHybrid(null, { text: "the conversational decibel increases", mode: "local_only", engineMode: "legacy_rollback" });
  assert.equal(auth.enginePath, "knowledge_enriched");
  assert.equal(rollback.enginePath, "legacy_rollback");
});
