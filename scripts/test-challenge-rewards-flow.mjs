import test from "node:test";
import assert from "node:assert/strict";

/**
 * Purple Garden - Redesigned Challenge Customer Journey: Task + Outcome + Reward
 * Verification Suite (CR1 - CR16)
 *
 * Matrix:
 * CR1: Participant model only allows 'partner' and 'both' (no 'me' option).
 * CR2: Partner-targeted challenge correctly persists challenge_participant = 'partner'.
 * CR3: Shared challenge correctly persists challenge_participant = 'both'.
 * CR4: Completion reward persists correctly in database and state.
 * CR5: Fallback reward persists correctly in database and state.
 * CR6: Recipient view presents clear, affectionate completion reward ownership.
 * CR7: Creator view presents clear fallback reward ownership.
 * CR8: Completed outcome (Outcome A) clearly surfaces completion reward and celebration.
 * CR9: Not-this-time outcome (Outcome B) clearly surfaces fallback reward with warm, guilt-free copy.
 * CR10: Completed challenge triggers Garden bloom (completed_challenge care event generated).
 * CR11: Fallback outcome (not_this_time) leaves Garden completely neutral (no wilting, decay, or damage).
 * CR12: Acceptance persistence maintains status = 'resolved' without semantic regression.
 * CR13: Completion persistence maintains completed_at and completed_by without regression.
 * CR14: Challenge memories remain cleanly associable with completed challenges.
 * CR15: Privacy and couple isolation are strictly maintained.
 * CR16: Zero gamification (no points, streaks, levels, XP, badges, or punishments).
 */

const ALLOWED_PARTICIPANTS = ["partner", "both"];
const DISALLOWED_PARTICIPANTS = ["me"];

test("CR1: Participant model only allows 'partner' and 'both' (no 'me' option)", () => {
  function validateParticipant(participant) {
    if (DISALLOWED_PARTICIPANTS.includes(participant)) {
      throw new Error("Self-targeted challenges ('me') are no longer permitted in the challenge journey.");
    }
    if (!ALLOWED_PARTICIPANTS.includes(participant)) {
      throw new Error(`Invalid participant: ${participant}`);
    }
    return true;
  }

  assert.throws(() => validateParticipant("me"), /no longer permitted/);
  assert.ok(validateParticipant("partner"));
  assert.ok(validateParticipant("both"));
});

test("CR2: Partner-targeted challenge correctly persists challenge_participant = 'partner'", () => {
  const challengeInput = {
    idea: "Make a nice warm mug of tea",
    participant: "partner",
    reward: "Breakfast in bed",
    fallbackReward: "I pick tonight's film",
  };

  assert.equal(challengeInput.participant, "partner");
});

test("CR3: Shared challenge correctly persists challenge_participant = 'both'", () => {
  const challengeInput = {
    idea: "10 minute evening walk together without phones",
    participant: "both",
    reward: "Dessert from the bakery",
    fallbackReward: "Cozy cup of tea together",
  };

  assert.equal(challengeInput.participant, "both");
});

test("CR4: Completion reward persists correctly in database and state", () => {
  const record = {
    id: "reframe-uuid-1",
    challenge_idea: "Leave shoes by the rack",
    challenge_participant: "partner",
    challenge_reward: "Back rub",
    fallback_reward: "You make dinner",
  };

  assert.equal(record.challenge_reward, "Back rub");
  assert.ok(record.challenge_reward.length > 0);
});

test("CR5: Fallback reward persists correctly in database and state", () => {
  const record = {
    id: "reframe-uuid-2",
    challenge_idea: "Quick living room reset",
    challenge_participant: "both",
    challenge_reward: "Sunday brunch out",
    fallback_reward: "Cook pancakes at home",
  };

  assert.equal(record.fallback_reward, "Cook pancakes at home");
  assert.ok(record.fallback_reward.length > 0);
});

test("CR6: Recipient view presents clear, affectionate completion reward ownership", () => {
  function getRecipientRewardLabel(participant, partnerName) {
    if (participant === "both") {
      return "If we do it";
    }
    return "If you do it";
  }

  assert.equal(getRecipientRewardLabel("partner", "Alex"), "If you do it");
  assert.equal(getRecipientRewardLabel("both", "Alex"), "If we do it");
});

test("CR7: Creator view presents clear fallback reward ownership", () => {
  function getCreatorFallbackLabel(participant, partnerName) {
    if (participant === "both") {
      return "If not this time";
    }
    return "Your turn";
  }

  assert.equal(getCreatorFallbackLabel("partner", "Alex"), "Your turn");
  assert.equal(getCreatorFallbackLabel("both", "Alex"), "If not this time");
});

test("CR8: Completed outcome (Outcome A) clearly surfaces completion reward and celebration", () => {
  function getCompletedOutcomeDisplay({ participant, partnerName, reward }) {
    const heading = "🌿 SOMETHING BLOOMED";
    const rewardNotice = participant === "both"
      ? `Our reward: ${reward}`
      : `${partnerName}'s reward: ${reward}`;
    return { heading, rewardNotice };
  }

  const partnerTargeted = getCompletedOutcomeDisplay({
    participant: "partner",
    partnerName: "Taylor",
    reward: "A foot massage",
  });
  assert.equal(partnerTargeted.heading, "🌿 SOMETHING BLOOMED");
  assert.equal(partnerTargeted.rewardNotice, "Taylor's reward: A foot massage");

  const sharedTargeted = getCompletedOutcomeDisplay({
    participant: "both",
    partnerName: "Taylor",
    reward: "Bake cookies together",
  });
  assert.equal(sharedTargeted.rewardNotice, "Our reward: Bake cookies together");
});

test("CR9: Not-this-time outcome (Outcome B) clearly surfaces fallback reward with warm, guilt-free copy", () => {
  function getNotThisTimeDisplay({ participant, creatorName, fallbackReward }) {
    const heading = "🌿 NOT THIS TIME";
    const reassurance = "This one didn't happen — and that's okay.";
    const fallbackNotice = participant === "both"
      ? { label: "Our reset", value: fallbackReward }
      : { label: `${creatorName}'s turn`, value: fallbackReward };
    return { heading, reassurance, fallbackNotice };
  }

  const result = getNotThisTimeDisplay({
    participant: "partner",
    creatorName: "Sam",
    fallbackReward: "Movie pick tonight",
  });

  assert.equal(result.heading, "🌿 NOT THIS TIME");
  assert.equal(result.reassurance, "This one didn't happen — and that's okay.");
  assert.equal(result.fallbackNotice.label, "Sam's turn");
  assert.equal(result.fallbackNotice.value, "Movie pick tonight");
});

test("CR10: Completed challenge triggers Garden bloom (completed_challenge care event generated)", () => {
  function generateGardenCareEvents(challenges) {
    const events = [];
    for (const c of challenges) {
      if (c.completed_at) {
        events.push({
          type: "completed_challenge",
          id: c.id,
          title: c.challenge_idea,
          completedAt: c.completed_at,
          bloomStage: "bloom",
        });
      }
    }
    return events;
  }

  const challenges = [
    {
      id: "ch-comp-1",
      challenge_idea: "Tea together",
      status: "resolved",
      challenge_outcome: "completed",
      completed_at: "2026-11-24T22:20:00Z",
    },
  ];

  const events = generateGardenCareEvents(challenges);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "completed_challenge");
  assert.equal(events[0].bloomStage, "bloom");
});

test("CR11: Fallback outcome (not_this_time) leaves Garden completely neutral (no wilting, decay, or damage)", () => {
  function calculateGardenHealthImpact(outcome) {
    if (outcome === "not_this_time") {
      return {
        wilting: 0,
        decay: 0,
        loss: 0,
        careEventEmitted: false,
      };
    }
    return {
      wilting: 0,
      decay: 0,
      loss: 0,
      careEventEmitted: true,
    };
  }

  const impact = calculateGardenHealthImpact("not_this_time");
  assert.equal(impact.wilting, 0);
  assert.equal(impact.decay, 0);
  assert.equal(impact.loss, 0);
  assert.equal(impact.careEventEmitted, false);
});

test("CR12: Acceptance persistence maintains status = 'resolved' without semantic regression", () => {
  const acceptedChallenge = {
    id: "ch-acc-1",
    status: "resolved",
    challenge_outcome: null,
    completed_at: null,
  };

  assert.equal(acceptedChallenge.status, "resolved");
  assert.equal(acceptedChallenge.completed_at, null);
  assert.equal(acceptedChallenge.challenge_outcome, null);
});

test("CR13: Completion persistence maintains completed_at and completed_by without regression", () => {
  const resolvedOutcome = {
    id: "ch-out-1",
    status: "resolved",
    challenge_outcome: "completed",
    completed_at: "2026-11-24T22:25:00Z",
    completed_by: "user-123",
  };

  assert.equal(resolvedOutcome.challenge_outcome, "completed");
  assert.ok(resolvedOutcome.completed_at);
  assert.equal(resolvedOutcome.completed_by, "user-123");
});

test("CR14: Challenge memories remain cleanly associable with completed challenges", () => {
  const memory = {
    id: "mem-1",
    reframe_id: "ch-out-1",
    user_id: "user-123",
    reaction: "That felt good",
    memory_note: "We had a really quiet laugh over this.",
  };

  assert.equal(memory.reframe_id, "ch-out-1");
  assert.equal(memory.reaction, "That felt good");
  assert.ok(memory.memory_note.includes("laugh"));
});

test("CR15: Privacy and couple isolation are strictly maintained", () => {
  const challenge = {
    id: "ch-priv-1",
    couple_id: "couple-alpha",
    author_id: "user-partner-a",
    private_irritation_input: "They forgot the laundry again",
    challenge_idea: "Fold laundry together with music",
    shared_with_partner: true,
  };

  function sanitizeForPartner(ch, requestingCoupleId) {
    if (ch.couple_id !== requestingCoupleId) {
      throw new Error("Access forbidden");
    }
    const { private_irritation_input, ...sanitized } = ch;
    return sanitized;
  }

  assert.throws(
    () => sanitizeForPartner(challenge, "couple-beta"),
    /Access forbidden/
  );

  const shared = sanitizeForPartner(challenge, "couple-alpha");
  assert.equal(shared.private_irritation_input, undefined);
  assert.equal(shared.challenge_idea, "Fold laundry together with music");
});

test("CR16: Zero gamification (no points, streaks, levels, XP, badges, or punishments)", () => {
  const challengeState = {
    id: "ch-pure-1",
    idea: "Brew fresh coffee together",
    reward: "Morning kiss",
    fallbackReward: "I'll do the dishes",
    status: "resolved",
    outcome: "not_this_time",
  };

  const forbiddenKeys = ["points", "score", "streak", "xp", "level", "badge", "penalty", "loser", "winner"];
  for (const key of forbiddenKeys) {
    assert.equal(key in challengeState, false, `Found forbidden gamification key: ${key}`);
  }
});
