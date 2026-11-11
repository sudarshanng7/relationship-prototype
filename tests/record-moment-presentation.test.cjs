const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { client } = require("./helpers/account-screen-client.cjs");
const { deferred, harness, loadSource } = require("./helpers/account-screen-harness.cjs");

// Real form, account boundary and shared primitives with deterministic hosts and
// transport. These are source/component tests, not native rendering or live RLS.
const file = "src/app/record-moment.tsx";
const good = "Something good: A kind moment, appreciation, or small joy.";
const friction = "Something felt off: Tension, hesitation, or a disconnect.";
const mine = "Mine: Keep this reflection private.";
const ours = "Ours: Share a gentle version with your partner.";
async function setup(t, params = {}, configure) {
  const db = client(); configure?.(db);
  const ui = harness(db, file, { params, imports: {
    "@/lib/moment-creation": loadSource("src/lib/moment-creation.ts", {}),
  } });
  t.after(ui.unmount); await ui.flush();
  return { db, ui };
}
const saveHost = (ui) => ui.nodes().find((node) => node.type === "Pressable" && node.props.testID === "record-moment-save");
const guardedSave = (ui) => ui.components().find((node) => node.props.testID === "record-moment-save").props.onPress;
async function invokeGuard(ui) { await guardedSave(ui)(); await ui.flush(); }
async function draft(ui) {
  await ui.tap("Communication");
  ui.change(0, "  Private experience  ");
}

for (const type of ["positive", "friction"]) {
  test(`Home ${type} parameter preselects without locking the type or sharing`, async (t) => {
    const { db, ui } = await setup(t, { type });
    assert.equal(ui.find(type === "positive" ? good : friction).props.accessibilityState.checked, true);
    assert.equal(ui.find(type === "positive" ? friction : good).props.accessibilityState.checked, false);
    assert.equal(ui.find(mine).props.accessibilityState.checked, true);
    assert.ok(ui.find(type === "positive" ? "Support" : "Communication"));
    assert.equal(Boolean(ui.find("Weight level 3")), type === "friction");
    assert.equal(ui.find("Shared topic"), undefined);
    assert.equal(db.writes.length, 0);
  });
}

test("unlocked type switching resets category but preserves other field state and intensity", async (t) => {
  const { db, ui } = await setup(t, { type: "positive" });
  await ui.tap("Support"); ui.change(0, "Private draft");
  assert.equal(saveHost(ui).props.disabled, false);
  await ui.tap(friction);
  assert.equal(saveHost(ui).props.disabled, true);
  assert.equal(ui.find("Support"), undefined);
  assert.equal(ui.inputs()[0].props.value, "Private draft");
  assert.equal(ui.find("Weight level 3").props.accessibilityState.checked, true);
  await ui.tap("Communication"); await ui.tap("Weight level 5");
  await ui.tap(good); await ui.tap(friction);
  assert.equal(ui.find("Communication").props.accessibilityState.selected, false);
  assert.equal(ui.find("Weight level 5").props.accessibilityState.checked, true);
  assert.equal(saveHost(ui).props.disabled, true);
  assert.equal(db.writes.length, 0);
});

for (const type of ["positive", "friction"]) {
  test(`lockType=true keeps the ${type} mode and hides switching controls`, async (t) => {
    const { db, ui } = await setup(t, { type, lockType: "true" });
    assert.equal(ui.find(good), undefined);
    assert.equal(ui.find(friction), undefined);
    await ui.tap(type === "positive" ? "Support" : "Communication");
    await ui.tap("Save to Mine");
    assert.equal(db.writes[0].args.p_event_type, type);
    assert.equal(db.writes[0].args.p_visibility, "mine");
  });
}

for (const type of ["positive", "friction"]) for (const visibility of ["mine", "ours"]) {
  test(`forced ${visibility}, ${type} keeps the route contract and privacy explanation`, async (t) => {
    const { db, ui } = await setup(t, { type, visibility });
    assert.equal(ui.find(mine), undefined);
    assert.equal(ui.find(ours), undefined);
    assert.match(ui.text(), visibility === "mine" ? /Only you can see this/ : /private reflection remains only for you/);
    await ui.tap(type === "positive" ? "Support" : "Communication");
    ui.change(0, "Private route draft");
    if (visibility === "ours") {
      assert.equal(saveHost(ui).props.disabled, true);
      ui.change(1, "Separate route topic");
    } else assert.equal(ui.find("Shared topic"), undefined);
    await ui.tap(visibility === "mine" ? "Save privately" : "Share with your partner");
    assert.equal(db.writes[0].args.p_visibility, visibility);
    assert.equal(db.writes[0].args.p_private_note, "Private route draft");
    assert.equal(db.writes[0].args.p_shared_topic, visibility === "ours" ? "Separate route topic" : null);
  });
}

test("array route parameters use their first values and preserve a forced locked mode", async (t) => {
  const { db, ui } = await setup(t, {
    type: ["positive", "friction"], visibility: ["mine", "ours"], lockType: ["true", "false"],
  });
  assert.equal(ui.find(good), undefined);
  assert.ok(ui.find("Support"));
  await ui.tap("Support"); await ui.tap("Save privately");
  assert.equal(db.writes[0].args.p_event_type, "positive");
  assert.equal(db.writes[0].args.p_visibility, "mine");
});

test("invalid route values retain the friction/Mine default and do not lock the type", async (t) => {
  const { db, ui } = await setup(t, { type: "invalid", visibility: "invalid", lockType: "true" });
  assert.equal(ui.find(friction).props.accessibilityState.checked, true);
  assert.ok(ui.find(good));
  assert.equal(ui.find(mine).props.accessibilityState.checked, true);
  await ui.tap("Communication"); await ui.tap("Save to Mine");
  assert.equal(db.writes[0].args.p_visibility, "mine");
  assert.equal(db.writes[0].args.p_shared_topic, null);
});

for (const intensity of [1, 5]) {
  test(`category and intensity ${intensity} selection reach the existing guarded payload`, async (t) => {
    const { db, ui } = await setup(t);
    await ui.tap("Communication"); await ui.tap(`Weight level ${intensity}`);
    assert.equal(ui.find("Communication").props.accessibilityState.selected, true);
    assert.equal(ui.find(`Weight level ${intensity}`).props.accessibilityState.checked, true);
    await ui.tap("Save to Mine");
    assert.equal(db.writes[0].args.p_category, "communication");
    assert.equal(db.writes[0].args.p_intensity, intensity);
    assert.equal(db.writes[0].headers.Authorization, "Bearer a-token");
    assert.equal(db.writes[0].retry, false);
  });
}

test("positive save does not send a retained friction intensity", async (t) => {
  const { db, ui } = await setup(t);
  await ui.tap("Weight level 5"); await ui.tap(good); await ui.tap("Support");
  await ui.tap("Save to Mine");
  assert.equal(db.writes[0].args.p_intensity, null);
});

test("Mine is the default and private text is never copied into the Ours topic", async (t) => {
  const { db, ui } = await setup(t);
  assert.equal(ui.find(mine).props.accessibilityState.checked, true);
  await draft(ui); await ui.tap(ours);
  assert.equal(ui.find("Shared topic").props.value, "");
  assert.equal(saveHost(ui).props.disabled, true);
  ui.change(1, "   "); await invokeGuard(ui);
  assert.equal(db.writes.length, 0);
  assert.match(ui.text(), /Please write what you would like to share with your partner/);
  ui.change(1, "  Only this topic  ");
  await ui.tap("Share with your partner");
  assert.equal(db.writes[0].args.p_private_note, "Private experience");
  assert.equal(db.writes[0].args.p_shared_topic, "Only this topic");
  assert.equal(db.writes[0].args.p_visibility, "ours");
});

test("switching back to Mine retains the draft but sends no shared topic", async (t) => {
  const { db, ui } = await setup(t);
  await draft(ui); await ui.tap(ours); ui.change(1, "Unshared topic draft");
  await ui.tap(mine);
  assert.equal(ui.find("Shared topic"), undefined);
  await ui.tap("Save to Mine");
  assert.equal(db.writes[0].args.p_shared_topic, null);
  assert.equal(db.writes[0].args.p_private_note, "Private experience");
});

test("membership loading keeps save disabled and exposes the existing loading notice", async (t) => {
  const reply = deferred();
  const { db, ui } = await setup(t, {}, (db) => { db.read = () => reply.promise; });
  assert.match(ui.text(), /Checking relationship space/);
  await ui.tap("Communication");
  assert.equal(saveHost(ui).props.disabled, true);
  assert.equal(saveHost(ui).props.onPress, undefined);
  await invokeGuard(ui); assert.equal(db.writes.length, 0);
  reply.resolve({ data: { couple_id: "couple-1" }, error: null }); await ui.flush();
  assert.equal(saveHost(ui).props.disabled, false);
});

for (const failure of ["missing", "error"]) {
  test(`membership ${failure} leaves the existing notice visible and prevents creation`, async (t) => {
    const { db, ui } = await setup(t, {}, (db) => {
      db.read = async () => failure === "missing" ? { data: null, error: null }
        : { data: null, error: { message: "PRIVATE_MEMBERSHIP_DETAIL" } };
    });
    assert.match(ui.text(), failure === "missing" ? /Create or join one in Settings/ : /Could not verify your relationship space/);
    assert.doesNotMatch(ui.text(), /PRIVATE_MEMBERSHIP_DETAIL/);
    assert.equal(saveHost(ui).props.disabled, true);
    await invokeGuard(ui); assert.equal(db.writes.length, 0);
  });
}

test("loading save disables the actual button and inputs while duplicate callbacks remain guarded", async (t) => {
  const { db, ui } = await setup(t, { visibility: "ours" });
  await draft(ui); ui.change(1, "Explicit topic");
  const pending = deferred(); db.respond = () => pending.promise;
  const retained = guardedSave(ui);
  const first = retained(), second = retained(); await ui.flush();
  const host = saveHost(ui);
  assert.equal(host.props.accessibilityLabel, "Saving...");
  assert.deepEqual(host.props.accessibilityState, { disabled: true, busy: true });
  assert.equal(host.props.onPress, undefined);
  assert.ok(ui.inputs().every((node) => node.props.editable === false));
  assert.match(ui.text(), /Saving\.\.\./);
  assert.equal(db.writes.length, 1);
  pending.resolve(db.commit(db.writes[0]));
  await Promise.all([first, second]); await ui.flush(); await retained();
  assert.equal(db.writes.length, 1);
});

for (const committed of [false, true]) {
  test(`uncertain outcome committed=${committed} retains notice and read-only recovery`, async (t) => {
    const { db, ui } = await setup(t);
    await draft(ui);
    const retained = guardedSave(ui);
    db.respond = async (call) => { if (committed) db.commit(call); throw new Error("Lost response"); };
    await retained(); await ui.flush();
    assert.match(ui.text(), /may already have been saved or shared/);
    assert.equal(saveHost(ui).props.disabled, true);
    assert.equal(saveHost(ui).props.onPress, undefined);
    assert.ok(ui.nodes().some((node) => node.type === "Text" && node.props.accessibilityRole === "alert"));
    await retained(); await invokeGuard(ui); assert.equal(db.writes.length, 1);
    await ui.tap("Check existing moments");
    assert.deepEqual(ui.navigations, ["/events"]);
    assert.equal(db.writes.length, 1);
  });
}

test("acknowledged save survives verification failure and read-only Retry without another creation", async (t) => {
  const { db, ui } = await setup(t);
  await draft(ui);
  db.respond = async (call) => {
    const result = db.commit(call);
    db.getUser = async () => ({ data: { user: null }, error: { message: "Offline" } });
    return result;
  };
  await ui.tap("Save to Mine");
  assert.match(ui.text(), /Your moment was saved/);
  assert.ok(ui.find("Retry"));
  assert.equal(ui.inputs().length, 0);
  db.getUser = async (token) => ({ data: { user: db.tokens.get(token) }, error: null });
  await ui.tap("Retry");
  assert.match(ui.text(), /Your moment was saved/);
  assert.equal(saveHost(ui).props.disabled, true);
  await ui.tap("Check existing moments");
  assert.equal(db.writes.length, 1);
});

test("account replacement during a pending save clears the draft and suppresses its completion", async (t) => {
  const { db, ui } = await setup(t);
  await draft(ui);
  const pending = deferred(); db.respond = () => pending.promise;
  const retained = guardedSave(ui), work = retained(); await ui.flush();
  await ui.switchAccount("b");
  assert.equal(ui.find("Private reflection").props.value, "");
  pending.resolve(db.commit(db.writes[0])); await work; await ui.flush();
  assert.deepEqual(ui.navigations, []);
  assert.equal(db.writes[0].headers.Authorization, "Bearer a-token");
  await retained(); assert.equal(db.writes.length, 1);
});

test("focus invalidation during a pending save preserves the uncertain gate outside the remounted form", async (t) => {
  const { db, ui } = await setup(t);
  await draft(ui);
  const pending = deferred(); db.respond = () => pending.promise;
  const work = guardedSave(ui)(); await ui.flush();
  await ui.blur(); assert.equal(ui.inputs().length, 0);
  await ui.focus();
  assert.match(ui.text(), /may already have been saved or shared/);
  assert.equal(saveHost(ui).props.disabled, true);
  pending.resolve(db.commit(db.writes[0])); await work; await ui.flush();
  assert.deepEqual(ui.navigations, []);
  await invokeGuard(ui); assert.equal(db.writes.length, 1);
});

test("field names, selection semantics and back navigation remain accessible at the host level", async (t) => {
  const { ui } = await setup(t);
  assert.match(ui.text(), /RELATIONSHIP OS/);
  assert.equal(ui.find(friction).props.accessibilityRole, "radio");
  assert.equal(ui.find(friction).props.accessibilityState.checked, true);
  assert.equal(ui.find("Communication").props.accessibilityRole, "button");
  assert.equal(ui.find("Weight level 3").props.accessibilityState.checked, true);
  assert.match(ui.find("Private reflection").props.accessibilityHint, /Only you/);
  await ui.tap(ours);
  assert.match(ui.find("Shared topic").props.accessibilityHint, /Only this separate topic/);
  await ui.tap("Back"); assert.deepEqual(ui.navigations, ["back"]);
});

test("source has no pre-share review, legacy fields or added unguarded creation path", () => {
  const source = readFileSync(path.join(__dirname, "..", file), "utf8");
  assert.doesNotMatch(source, /isReviewingOurs|Review shared moment|repair_method|reconnected_at|relationship_events|PreviewProvider/);
  assert.equal((source.match(/supabase\.rpc\(/g) ?? []).length, 1);
  assert.match(source, /onPress=\{saveMoment\}/);
  assert.match(source, /\.retry\(false\)/);
});
