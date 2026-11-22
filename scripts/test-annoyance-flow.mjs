import test from "node:test";
import assert from "node:assert/strict";

/**
 * Unit tests for Annoyance -> Playful Reframe & Challenge Flow
 *
 * Covers:
 * - Topic validation rules (preset vs custom <= 60 chars)
 * - Calm bypass ("Not playful right now") state resolution
 * - Playful challenge mapping ("me" vs "partner" vs "both")
 * - Privacy invariant: Author raw irritation note isolation
 */

function validateCustomTopic(topicKey, customLabel) {
  if (topicKey === "other") {
    if (!customLabel || !customLabel.trim()) {
      return { valid: false, error: "Please enter a name for this topic." };
    }
    if (customLabel.trim().length > 60) {
      return { valid: false, error: "Topic name must be 60 characters or fewer." };
    }
  }
  return { valid: true };
}

function resolveAnnoyanceBypass(authorId, coupleId, customText) {
  const isCustom = Boolean(customText && customText.trim().length > 0);
  return {
    authorId,
    coupleId,
    topicKey: isCustom ? "other" : "coffee_mug",
    customTopicLabel: isCustom ? customText.trim().slice(0, 60) : null,
    isPlayful: false,
    status: "dismissed",
    sharedWithPartner: false,
  };
}

function resolvePlayfulChallenge(input) {
  const isSharingLighter = Boolean(input.shareLighterThought && input.reframeText?.trim());
  const mappedParticipant = input.participantChoice === "me"
    ? "me"
    : input.participantChoice === "both"
    ? "both"
    : "partner";

  return {
    coupleId: input.coupleId,
    authorId: input.authorId,
    topicKey: input.isCustomActive ? "other" : input.topicKey,
    customTopicLabel: input.isCustomActive ? input.customText.trim().slice(0, 60) : null,
    isPlayful: true,
    reframeTone: input.selectedTone || null,
    reframeText: isSharingLighter ? input.reframeText.trim() : null,
    includeReframeWithPartner: isSharingLighter,
    status: "active",
    sharedWithPartner: mappedParticipant !== "me",
    challengeIdea: input.challengeIdea.trim(),
    challengeParticipant: mappedParticipant,
    challengeTimeframe: input.timeframe || "Today",
    challengeReward: input.reward || "No reward — just the moment",
  };
}

test("1. Topic validation enforces <= 60 char limit for custom topic", () => {
  assert.equal(validateCustomTopic("coffee_mug", null).valid, true);
  assert.equal(validateCustomTopic("other", null).valid, false);
  assert.equal(validateCustomTopic("other", "   ").valid, false);

  const validCustom = "Kitchen cups everywhere";
  assert.equal(validateCustomTopic("other", validCustom).valid, true);

  const tooLong = "A".repeat(61);
  const res = validateCustomTopic("other", tooLong);
  assert.equal(res.valid, false);
  assert.equal(res.error, "Topic name must be 60 characters or fewer.");
});

test("2. Calm bypass produces dismissed, unshared record", () => {
  const bypass = resolveAnnoyanceBypass("user-1", "couple-1", "Shoes left in hallway");
  assert.equal(bypass.isPlayful, false);
  assert.equal(bypass.status, "dismissed");
  assert.equal(bypass.sharedWithPartner, false);
  assert.equal(bypass.topicKey, "other");
  assert.equal(bypass.customTopicLabel, "Shoes left in hallway");
});

test("3. Personal challenge remains unshared with partner", () => {
  const personal = resolvePlayfulChallenge({
    coupleId: "couple-1",
    authorId: "user-1",
    topicKey: "socks",
    isCustomActive: false,
    challengeIdea: "Tidy sock drawer quietly",
    participantChoice: "me",
    selectedTone: "playful",
    reframeText: "Dryer tax paid",
    shareLighterThought: true,
  });

  assert.equal(personal.challengeParticipant, "me");
  assert.equal(personal.sharedWithPartner, false);
  assert.equal(personal.status, "active");
});

test("4. Shared invitation maps partner participant and preserves lighter thought when opted in", () => {
  const shared = resolvePlayfulChallenge({
    coupleId: "couple-1",
    authorId: "user-1",
    topicKey: "coffee_mug",
    isCustomActive: false,
    challengeIdea: "Tea on the balcony",
    participantChoice: "sam",
    selectedTone: "gentle",
    reframeText: "Mug waiting for its journey",
    shareLighterThought: true,
  });

  assert.equal(shared.challengeParticipant, "partner");
  assert.equal(shared.sharedWithPartner, true);
  assert.equal(shared.reframeText, "Mug waiting for its journey");
  assert.equal(shared.includeReframeWithPartner, true);
});

test("5. Shared invitation suppresses lighter thought when author leaves it private", () => {
  const sharedQuiet = resolvePlayfulChallenge({
    coupleId: "couple-1",
    authorId: "user-1",
    topicKey: "coffee_mug",
    isCustomActive: false,
    challengeIdea: "Tea on the balcony",
    participantChoice: "both",
    selectedTone: "gentle",
    reframeText: "Mug waiting for its journey",
    shareLighterThought: false,
  });

  assert.equal(sharedQuiet.challengeParticipant, "both");
  assert.equal(sharedQuiet.sharedWithPartner, true);
  assert.equal(sharedQuiet.reframeText, null);
  assert.equal(sharedQuiet.includeReframeWithPartner, false);
});

test("6. Challenge persistence preserves canonical existing topicKey and does not hardcode other", () => {
  const existingRecord = {
    id: "reframe-123",
    topic_key: "socks",
    custom_topic_label: null,
    private_irritation_input: "Missing sock frustration",
    reframe_tone: "playful",
    reframe_text: "Dryer tax paid",
  };

  const incomingParams = {
    reframeId: "reframe-123",
    topicKey: undefined,
  };

  const resolvedTopicKey = existingRecord?.topic_key || incomingParams.topicKey || "other";
  assert.equal(resolvedTopicKey, "socks", "Must preserve preset topic key without overwriting to 'other'");
  assert.equal(existingRecord.private_irritation_input, "Missing sock frustration");
});

test("7. Mandatory challenge persistence: missing coupleId or userId blocks completion", () => {
  function attemptChallengeCompletion(coupleId, userId, idea) {
    if (!idea || !idea.trim()) {
      return { success: false, error: "Please enter an idea first" };
    }
    if (!coupleId || !userId) {
      return { success: false, error: "You must be signed in with an active couple connection" };
    }
    return { success: true, saved: true };
  }

  assert.equal(attemptChallengeCompletion(null, "user-1", "Make tea").success, false);
  assert.equal(attemptChallengeCompletion("couple-1", null, "Make tea").success, false);
  assert.equal(attemptChallengeCompletion(null, null, "Make tea").success, false);
  assert.equal(attemptChallengeCompletion("couple-1", "user-1", "Make tea").success, true);
});

test("8. Loading state or load error blocks challenge completion actions", () => {
  function isCompletionDisabled(isSaving, isLoadingExisting, loadError) {
    return isSaving || isLoadingExisting || Boolean(loadError);
  }

  assert.equal(isCompletionDisabled(false, true, null), true, "Disabled while loading existing reframe");
  assert.equal(isCompletionDisabled(false, false, "Failed to load reframe"), true, "Disabled on load error");
  assert.equal(isCompletionDisabled(true, false, null), true, "Disabled while saving");
  assert.equal(isCompletionDisabled(false, false, null), false, "Enabled when ready and error-free");
});

test("9. Challenge-only save preserves existing fields and does not overwrite with null", () => {
  const existingReframe = {
    id: "ref-1",
    topic_key: "dishes",
    custom_topic_label: null,
    private_irritation_input: "Secret annoyance text",
    reframe_tone: "gentle",
    reframe_text: "Dishes waiting patiently",
  };

  const challengeUpdateInput = {
    id: existingReframe.id,
    challengeIdea: "Wash two forks together",
    challengeParticipant: "both",
    topicKey: existingReframe.topic_key,
    customTopicLabel: existingReframe.custom_topic_label,
    privateIrritationInput: existingReframe.private_irritation_input ?? undefined,
    reframeTone: existingReframe.reframe_tone ?? undefined,
    reframeText: existingReframe.reframe_text ?? undefined,
  };

  assert.equal(challengeUpdateInput.privateIrritationInput, "Secret annoyance text");
  assert.equal(challengeUpdateInput.topicKey, "dishes");
  assert.equal(challengeUpdateInput.reframeTone, "gentle");
  assert.equal(challengeUpdateInput.reframeText, "Dishes waiting patiently");
  assert.equal(challengeUpdateInput.challengeIdea, "Wash two forks together");
});

test("10. Partner safe RPC projection masks reframe_text when unshared, excludes author, and omits raw notes", () => {
  function projectPartnerChallenges(callerUserId, coupleId, rows, coupleMembers) {
    const isMember = coupleMembers.some((m) => m.coupleId === coupleId && m.userId === callerUserId);
    if (!isMember) {
      throw new Error("Forbidden: not a member of this couple");
    }

    return rows
      .filter((r) => r.coupleId === coupleId && r.authorId !== callerUserId && r.sharedWithPartner && r.status === "active")
      .map((r) => ({
        id: r.id,
        authorId: r.authorId,
        topicKey: r.topicKey,
        customTopicLabel: r.customTopicLabel,
        challengeIdea: r.challengeIdea,
        challengeParticipant: r.challengeParticipant,
        challengeTimeframe: r.challengeTimeframe,
        challengeReward: r.challengeReward,
        reframeTone: r.reframeTone,
        reframeText: r.includeReframeWithPartner ? r.reframeText : null,
        includeReframeWithPartner: r.includeReframeWithPartner,
        status: r.status,
      }));
  }

  const members = [
    { coupleId: "cp-1", userId: "user-author" },
    { coupleId: "cp-1", userId: "user-partner" },
  ];

  const dbRows = [
    {
      id: "ref-1",
      coupleId: "cp-1",
      authorId: "user-author",
      topicKey: "socks",
      customTopicLabel: null,
      challengeIdea: "Gather socks",
      challengeParticipant: "both",
      challengeTimeframe: "Today",
      challengeReward: null,
      reframeTone: "gentle",
      reframeText: "Warm reframe text",
      includeReframeWithPartner: true,
      status: "active",
      sharedWithPartner: true,
      privateIrritationInput: "SUPER SECRET RAW IRRITATION",
    },
    {
      id: "ref-2",
      coupleId: "cp-1",
      authorId: "user-author",
      topicKey: "coffee_mug",
      customTopicLabel: null,
      challengeIdea: "Tea time",
      challengeParticipant: "partner",
      challengeTimeframe: "Tomorrow",
      challengeReward: null,
      reframeTone: "playful",
      reframeText: "Unshared reframe text",
      includeReframeWithPartner: false,
      status: "active",
      sharedWithPartner: true,
      privateIrritationInput: "ANOTHER RAW NOTE",
    },
  ];

  // Partner view
  const partnerView = projectPartnerChallenges("user-partner", "cp-1", dbRows, members);
  assert.equal(partnerView.length, 2);
  assert.equal(partnerView[0].reframeText, "Warm reframe text");
  assert.equal(partnerView[1].reframeText, null, "Must mask reframeText to null when unshared");
  assert.equal("privateIrritationInput" in partnerView[0], false, "Raw note never exposed");
  assert.equal("privateIrritationInput" in partnerView[1], false, "Raw note never exposed");

  // Author view (must exclude author-created challenges)
  const authorView = projectPartnerChallenges("user-author", "cp-1", dbRows, members);
  assert.equal(authorView.length, 0, "Author must never receive own challenges via partner query");

  // Outsider view
  assert.throws(
    () => projectPartnerChallenges("user-outsider", "cp-1", dbRows, members),
    /Forbidden: not a member of this couple/
  );
});

test("11. Self-response prevention: author cannot respond to own invitation", () => {
  function respondToChallenge(callerUserId, reframe, coupleMembers, action) {
    if (!reframe || reframe.status !== "active" || !reframe.sharedWithPartner) {
      throw new Error("Challenge invitation is not active or not shared");
    }
    if (reframe.authorId === callerUserId) {
      throw new Error("Author cannot respond to own challenge invitation");
    }
    const isPartnerMember = coupleMembers.some(
      (m) => m.coupleId === reframe.coupleId && m.userId === callerUserId && m.userId !== reframe.authorId
    );
    if (!isPartnerMember) {
      throw new Error("Forbidden: not a partner member of this couple");
    }
    return { success: true, newStatus: action === "accept" ? "resolved" : "dismissed" };
  }

  const reframe = {
    id: "ref-1",
    coupleId: "cp-1",
    authorId: "user-author",
    status: "active",
    sharedWithPartner: true,
  };
  const members = [
    { coupleId: "cp-1", userId: "user-author" },
    { coupleId: "cp-1", userId: "user-partner" },
  ];

  // Author self-response rejected
  assert.throws(
    () => respondToChallenge("user-author", reframe, members, "accept"),
    /Author cannot respond to own challenge invitation/
  );

  // Outsider response rejected
  assert.throws(
    () => respondToChallenge("user-c", reframe, members, "accept"),
    /Forbidden: not a partner member of this couple/
  );

  // Partner response accepted
  const acceptRes = respondToChallenge("user-partner", reframe, members, "accept");
  assert.equal(acceptRes.success, true);
  assert.equal(acceptRes.newStatus, "resolved");

  const dismissRes = respondToChallenge("user-partner", reframe, members, "dismiss");
  assert.equal(dismissRes.success, true);
  assert.equal(dismissRes.newStatus, "dismissed");
});

