const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { client } = require("./helpers/account-screen-client.cjs");
const { deferred, harness, loadSource } = require("./helpers/account-screen-harness.cjs");

const file = "src/app/record-moment.tsx";
async function setup(t, configure, options) {
  const db = client();
  configure?.(db);
  const ui = harness(db, file, {
    ...options,
    imports: { "@/lib/moment-creation": loadSource("src/lib/moment-creation.ts", {}) },
  });
  t.after(ui.unmount);
  await ui.flush();
  return { db, ui };
}
async function draft(ui, ours = false) {
  await ui.tap("Communication");
  ui.change(0, "  Synthetic private draft  ");
  if (ours) ui.change(1, "  Synthetic shared topic  ");
}
const save = (ui) => ui.nodes().find((node) => node.type === "Pressable" &&
  ["Save to Mine", "Save privately", "Share with your partner"].includes(node.props.accessibilityLabel));
async function submit(ui) { await save(ui).props.onPress(); await ui.flush(); }
function uncertain(ui) {
  assert.match(ui.text(), /may already have been saved or shared/);
  assert.doesNotMatch(ui.text(), /definitely failed|could not be created|no moment was created/);
  assert.equal(save(ui).props.disabled, true);
}

for (const visibility of ["mine", "ours"]) test(`A02: acknowledged ${visibility} creation uses pinned identity and valid ID`, async (t) => {
  const { db, ui } = await setup(t, undefined, { params: { visibility } });
  await draft(ui, visibility === "ours");
  await submit(ui);
  assert.equal(db.writes.length, 1);
  assert.equal(db.writes[0].name, "create_relationship_moment");
  assert.equal(db.writes[0].headers.Authorization, "Bearer a-token");
  assert.equal(db.writes[0].retry, false, "SDK retry explicitly disabled for creation");
  assert.deepEqual(db.writes[0].args, {
    p_couple_id: "couple-1", p_event_type: "friction", p_category: "communication", p_intensity: 3,
    p_visibility: visibility, p_private_note: "Synthetic private draft",
    p_shared_topic: visibility === "ours" ? "Synthetic shared topic" : null,
  });
  assert.equal(ui.navigations[0].pathname, "/event/[id]");
  assert.equal(ui.navigations[0].params.id, db.committed[0].id);
  await submit(ui); // retained/current handlers cannot create again after acknowledgment
  assert.equal(db.writes.length, 1);
});

test("A02: validation failure sends nothing and preserves the private draft", async (t) => {
  const { db, ui } = await setup(t);
  ui.change(0, "Private draft without a category");
  await submit(ui);
  assert.equal(db.writes.length, 0);
  assert.match(ui.text(), /choose a category/);
  assert.equal(ui.inputs()[0].props.value, "Private draft without a category");
});

test("A02: pre-dispatch membership transport failure never calls creation", async (t) => {
  const { db, ui } = await setup(t);
  await draft(ui);
  db.read = async () => { throw new Error("Synthetic offline"); };
  await submit(ui);
  assert.equal(db.writes.length, 0);
  assert.equal(ui.inputs()[0].props.value, "  Synthetic private draft  ");
  assert.doesNotMatch(ui.text(), /may already have been saved/);
});

test("A02: failed session verification before dispatch clears private state", async (t) => {
  const { db, ui } = await setup(t);
  await draft(ui);
  db.getUser = async () => ({ error: { message: "Offline" }, data: { user: null } });
  await submit(ui);
  assert.equal(db.writes.length, 0);
  assert.equal(ui.inputs().length, 0);
  assert.match(ui.text(), /Private data has been cleared/);
});

test("A02: synchronous request construction failure occurs before dispatch and allows deliberate retry", async (t) => {
  const { db, ui } = await setup(t);
  await draft(ui);
  const rpc = db.supabase.rpc;
  db.supabase.rpc = () => { throw new Error("Local builder failure"); };
  await submit(ui);
  assert.equal(db.writes.length, 0);
  assert.match(ui.text(), /Nothing was sent/);
  assert.doesNotMatch(ui.text(), /may already have been saved/);
  assert.equal(ui.inputs()[0].props.value, "  Synthetic private draft  ");
  assert.equal(save(ui).props.disabled, false);
  db.supabase.rpc = rpc; await submit(ui);
  assert.equal(db.writes.length, 1);
});

for (const message of [
  "Authentication required", "Invalid visibility", "Invalid event type", "Category is required",
  "Friction intensity must be between 1 and 5", "Private moments cannot contain shared topics",
  "Relationship membership required",
]) {
  test(`A02: explicit PostgreSQL rejection (${message}) permits deliberate retry`, async (t) => {
    const { db, ui } = await setup(t);
    await draft(ui);
    db.respond = async () => ({ error: { code: "P0001", message }, data: null });
    await submit(ui);
    assert.equal(db.writes.length, 1, "no automatic retry after a definitive rejection");
    assert.match(ui.text(), /server rejected.*no moment was created/);
    assert.equal(save(ui).props.disabled, false);
    assert.equal(ui.inputs()[0].props.value, "  Synthetic private draft  ");
    db.respond = async (call) => db.commit(call);
    await submit(ui);
    assert.equal(db.writes.length, 2);
    assert.equal(db.committed.length, 1);
  });
}

for (const committed of [true, false]) for (const visibility of ["mine", "ours"]) {
  test(`A02: lost response, committed=${committed}, ${visibility}; repeat and retained handlers stay blocked`, async (t) => {
    const { db, ui } = await setup(t, undefined, { params: { visibility } });
    await draft(ui, visibility === "ours");
    const retained = save(ui).props.onPress;
    db.respond = async (call) => { if (committed) db.commit(call); throw new Error("Response lost"); };
    await submit(ui);
    uncertain(ui);
    assert.equal(ui.inputs()[0].props.value, "  Synthetic private draft  ");
    for (let i = 0; i < 3; i++) { await retained(); await submit(ui); }
    assert.equal(db.writes.length, 1);
    assert.equal(db.committed.length, Number(committed));
    assert.equal(ui.navigations.length, 0);
    await ui.tap("Check existing moments");
    assert.deepEqual(ui.navigations, ["/events"]);
    assert.equal(db.writes.length, 1, "inspection must not dispatch creation");
  });
}

for (const data of [null, "", "not-a-uuid", {}, ["00000000-0000-4000-8000-000000000001"], true]) {
  test(`A02: malformed acknowledgment ${JSON.stringify(data)} stays uncertain`, async (t) => {
    const { db, ui } = await setup(t);
    await draft(ui);
    db.respond = async (call) => { db.commit(call); return { data, error: null }; };
    await submit(ui);
    uncertain(ui);
    await submit(ui);
    assert.equal(db.writes.length, 1);
    assert.equal(ui.navigations.length, 0);
  });
}

for (const error of [
  { code: "P0001", message: "Unknown database error" },
  { code: "503", message: "Relationship membership required" },
  { message: "Category is required" },
  { code: "", message: "TypeError: Failed to fetch" },
]) test(`A02: unreviewed error cannot establish rejection ${JSON.stringify(error)}`, async (t) => {
  const { db, ui } = await setup(t);
  await draft(ui);
  db.respond = async () => ({ data: null, error });
  await submit(ui);
  uncertain(ui);
});

test("A02: contradictory success data plus rejection cannot establish a definitive failure", async (t) => {
  const { db, ui } = await setup(t);
  await draft(ui);
  db.respond = async () => ({ data: "00000000-0000-4000-8000-000000000001", error: { code: "P0001", message: "Category is required" } });
  await submit(ui); uncertain(ui);
  await submit(ui); assert.equal(db.writes.length, 1);
});

test("A02: synchronous guard stops double-taps while preflight and RPC are pending", async (t) => {
  const { db, ui } = await setup(t);
  await draft(ui);
  const pending = deferred();
  db.respond = () => pending.promise;
  const retained = save(ui).props.onPress;
  const first = retained();
  const second = retained();
  await ui.flush();
  assert.equal(db.writes.length, 1);
  await retained();
  pending.resolve(db.commit(db.writes[0]));
  await Promise.all([first, second]); await ui.flush();
  await retained();
  assert.equal(db.writes.length, 1);
});

test("A02: blur/return clears private draft but preserves uncertain submission gate", async (t) => {
  const { db, ui } = await setup(t);
  await draft(ui);
  db.respond = async () => { throw new Error("Lost"); };
  await submit(ui);
  const retained = save(ui).props.onPress;
  await ui.blur();
  assert.equal(ui.inputs().length, 0);
  await ui.focus();
  uncertain(ui);
  assert.equal(ui.inputs()[0].props.value, "");
  await retained(); await submit(ui);
  assert.equal(db.writes.length, 1);
});

test("A02: blur during dispatch cannot revive old scope or permit resend on focus", async (t) => {
  const { db, ui } = await setup(t);
  await draft(ui);
  const pending = deferred();
  db.respond = () => pending.promise;
  const work = save(ui).props.onPress(); await ui.flush();
  await ui.blur(); await ui.focus();
  uncertain(ui);
  pending.resolve(db.commit(db.writes[0]));
  await work; await ui.flush();
  uncertain(ui);
  assert.equal(ui.navigations.length, 0);
  await submit(ui);
  assert.equal(db.writes.length, 1);
});

test("A02: acknowledged save plus failed post-save verification stays locked after session Retry", async (t) => {
  const { db, ui } = await setup(t);
  await draft(ui);
  db.respond = async (call) => {
    const result = db.commit(call);
    db.getUser = async () => ({ data: { user: null }, error: { message: "Offline" } });
    return result;
  };
  await submit(ui);
  assert.match(ui.text(), /Your moment was saved/);
  db.getUser = async (token) => ({ data: { user: db.tokens.get(token) }, error: null });
  await ui.tap("Retry");
  assert.match(ui.text(), /Your moment was saved/);
  await draft(ui); await submit(ui);
  assert.equal(db.writes.length, 1);
});

test("A02: account A to B during pending creation cannot publish A result or draft", async (t) => {
  const { db, ui } = await setup(t);
  await draft(ui);
  const pending = deferred(); db.respond = () => pending.promise;
  const retained = save(ui).props.onPress;
  const work = retained(); await ui.flush();
  await ui.switchAccount("b");
  assert.equal(ui.inputs()[0].props.value, "");
  pending.resolve(db.commit(db.writes[0])); await work; await ui.flush();
  assert.equal(ui.navigations.length, 0);
  await retained(); assert.equal(db.writes.length, 1);
  await draft(ui); db.respond = async (call) => db.commit(call);
  await submit(ui);
  assert.equal(db.writes[1].headers.Authorization, "Bearer b-token");
});

test("A02: replacement relationship space clears private draft before dispatch", async (t) => {
  const { db, ui } = await setup(t);
  await draft(ui);
  db.memberships.set("a", "replacement-couple");
  await submit(ui);
  assert.equal(db.writes.length, 0);
  assert.equal(ui.inputs()[0].props.value, "");
  assert.match(ui.text(), /Relationship space changed/);
  await submit(ui); assert.equal(db.writes.length, 0);
});

test("A02: relationship replacement after uncertain dispatch clears draft and keeps gate locked", async (t) => {
  const { db, ui } = await setup(t);
  await draft(ui);
  db.respond = async () => { db.memberships.set("a", "replacement-space"); throw new Error("Lost"); };
  await submit(ui);
  uncertain(ui);
  assert.equal(ui.inputs()[0].props.value, "");
  await submit(ui); assert.equal(db.writes.length, 1);
});

test("A02: uncertain creation followed by failed verification stays locked after session Retry", async (t) => {
  const { db, ui } = await setup(t);
  await draft(ui);
  db.respond = async () => {
    db.getUser = async () => ({ data: { user: null }, error: { message: "Offline" } });
    throw new Error("Lost response");
  };
  await submit(ui);
  assert.match(ui.text(), /may already have been saved or shared/);
  assert.equal(ui.inputs().length, 0);
  db.getUser = async (token) => ({ data: { user: db.tokens.get(token) }, error: null });
  await ui.tap("Retry");
  uncertain(ui);
  await draft(ui); await submit(ui);
  assert.equal(db.writes.length, 1);
});

test("A02: silently replaced account is checked after response loss before publishing", async (t) => {
  const { db, ui } = await setup(t);
  await draft(ui);
  db.respond = async () => {
    db.tokens.set("b-token", { id: "b" });
    db.session = { user: { id: "b" }, access_token: "b-token" }; // No auth callback.
    throw new Error("Lost response");
  };
  await submit(ui);
  assert.equal(ui.inputs().length, 0);
  assert.ok(ui.navigations.includes("/"));
  assert.equal(db.writes.length, 1);
});

test("A02: logout and route replacement invalidate retained draft handlers", async (t) => {
  const { db, ui } = await setup(t);
  await draft(ui);
  const retained = save(ui).props.onPress;
  await ui.changeParams({ visibility: "ours" });
  assert.equal(ui.inputs()[0].props.value, "");
  await retained(); assert.equal(db.writes.length, 0);
  await ui.switchAccount(null);
  assert.equal(ui.inputs().length, 0);
  assert.ok(ui.navigations.includes("/"));
});

test("A02: same-account token refresh preserves private draft", async (t) => {
  const { db, ui } = await setup(t);
  await draft(ui);
  await ui.switchAccount("a", "TOKEN_REFRESHED", "a-refreshed");
  assert.equal(ui.inputs()[0].props.value, "  Synthetic private draft  ");
  await submit(ui);
  assert.equal(db.writes[0].headers.Authorization, "Bearer a-refreshed");
  assert.equal(db.writes[0].args.p_visibility, "mine");
  assert.equal(db.writes[0].args.p_shared_topic, null);
});

test("A02 negative control: removing both gate checks reproduces duplicate commit after lost response", async (t) => {
  const source = readFileSync(path.join(__dirname, "..", file), "utf8")
    .replace('attemptRef.current?.phase !== "idle" ||', 'false ||')
    .replace('creationPhase === "idle";', 'true;');
  const { db, ui } = await setup(t, undefined, { source });
  await draft(ui);
  db.respond = async (call) => { db.commit(call); throw new Error("Lost"); };
  await submit(ui); await submit(ui);
  assert.equal(db.writes.length, 2);
  assert.equal(db.committed.length, 2, "diagnostic mutant reproduces A02");
});
