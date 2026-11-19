const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { client } = require("./helpers/account-screen-client.cjs");
const { deferred, harness, loadSource } = require("./helpers/account-screen-harness.cjs");

const file = "src/app/my-contributions.tsx";
const time = "2026-11-08T12:00:00Z";
const perspective = (author_id, extra = {}) => ({
  id: `perspective-${author_id}`, author_id, perspective_text: `${author_id} own perspective`,
  sharing_status: "suspended", updated_at: time, ...extra,
});
const repair = (user_id, extra = {}) => ({
  event_id: "hidden-event", user_id, repair_status: "reconnected", what_helped: "talking",
  sharing_status: "private", status_origin: "explicit", updated_at: time, ...extra,
});
async function setup(t, configure, options) {
  const db = client();
  db.perspectives = [perspective("a"), perspective("b")];
  db.repairs = [repair("a"), repair("b")];
  configure?.(db);
  const ui = harness(db, file, options);
  t.after(ui.unmount); await ui.flush();
  return { db, ui };
}
function onlyB(ui) {
  assert.match(ui.text(), /b own perspective/);
  assert.doesNotMatch(ui.text(), /a own perspective|A private reflection|A private repair|Hidden topic|Hidden category|Creator A/);
}
function ownQueryContract(db, userId) {
  assert.ok(db.reads.length >= 4);
  for (const call of db.reads) {
    assert.equal(call.headers.Authorization, `Bearer ${userId}-token`);
    assert.deepEqual(call.filters, [[call.table === "event_perspectives" ? "author_id" : "user_id", userId]]);
    assert.doesNotMatch(call.columns, /\*|\(|creator_id|category|shared_topic|visibility|private_reflection|event_type/);
  }
  assert.equal(db.writes.length, 0);
}

test("A03: B reads only B retained rows after simulated Ours-to-Mine suspension, without parent reads", async (t) => {
  const { db, ui } = await setup(t, (db) => {
    db.emit("b");
    // Parent and creator-private canaries never enter the permitted child data.
    db.hiddenParent = { category: "Hidden category", shared_topic: "Hidden topic", creator: "Creator A" };
    db.privateReflection = "A private reflection";
    db.repairs[0].what_helped = "other";
  });
  onlyB(ui);
  assert.match(ui.text(), /Sharing suspended — not visible to your partner/);
  assert.match(ui.text(), /Private — not shared/);
  assert.match(ui.text(), /My report: I feel reconnected/);
  assert.match(ui.text(), /do not imply agreement or mutual repair/);
  assert.equal(ui.find("Moment"), undefined);
  ownQueryContract(db, "b");
});

test("A03: direct queries use minimal child-owned columns and no parent join", async (t) => {
  const { db } = await setup(t);
  ownQueryContract(db, "a");
  assert.equal(db.reads.find((call) => call.table === "event_perspectives").columns,
    "id, author_id, perspective_text, sharing_status, updated_at");
  assert.equal(db.reads.find((call) => call.table === "event_repair_states").columns,
    "event_id, user_id, repair_status, what_helped, sharing_status, status_origin, updated_at");
});

test("A03: adversarial cached partner rows are filtered before rendering", async (t) => {
  const { ui } = await setup(t, (db) => {
    db.emit("b"); const original = db.read;
    db.repairs[0].what_helped = "other";
    db.read = async (call) => call.table === "couple_members" ? original(call) : {
      data: call.table === "event_perspectives" ? db.perspectives : db.repairs, error: null,
    };
  });
  onlyB(ui);
  assert.doesNotMatch(ui.text(), /What helped me: Other/);
  assert.equal((ui.text().match(/My repair update/g) ?? []).length, 1);
});

test("A03: returning parent to Ours never resubmits or shares retained contributions", async (t) => {
  const { db, ui } = await setup(t, (db) => db.emit("b"));
  const before = structuredClone([db.perspectives, db.repairs]);
  db.hiddenParent = { visibility: "ours" };
  await ui.tap("Refresh my contributions");
  onlyB(ui);
  assert.match(ui.text(), /Sharing suspended/);
  assert.match(ui.text(), /Private — not shared/);
  assert.deepEqual([db.perspectives, db.repairs], before);
  assert.equal(db.writes.length, 0);
});

for (const sharing_status of ["submitted", "suspended"]) test(`A03: own perspective sharing ${sharing_status} uses contribution-level copy`, async (t) => {
  const { db, ui } = await setup(t, (db) => { db.perspectives = [perspective("a", { sharing_status })]; db.repairs = []; });
  assert.match(ui.text(), sharing_status === "suspended" ? /Sharing suspended/ : /Partner access depends on the moment remaining shared/);
  assert.doesNotMatch(ui.text(), /parent is visible|moment is Ours|mutually repaired/);
  assert.equal(db.writes.length, 0);
});

for (const sharing_status of ["private", "shared"]) test(`A03: own repair sharing ${sharing_status} does not infer current parent visibility`, async (t) => {
  const { ui } = await setup(t, (db) => { db.repairs = [repair("a", { sharing_status })]; });
  assert.match(ui.text(), sharing_status === "private" ? /Private — not shared/ : /Shared by you. Partner access depends/);
});

for (const repair_status of ["open", "partially_repaired", "reconnected"]) test(`A03: unconfirmed legacy ${repair_status} is never displayed as a confirmed report`, async (t) => {
  const { ui } = await setup(t, (db) => {
    db.repairs = [repair("a", { repair_status, status_origin: "legacy_default_unconfirmed" })];
  });
  assert.match(ui.text(), /Unconfirmed legacy default — not a personal repair report/);
  assert.doesNotMatch(ui.text(), /My report:|What helped me:/);
});

test("A03: confirmed legacy creator report preserves provenance", async (t) => {
  const { ui } = await setup(t, (db) => { db.repairs = [repair("a", { status_origin: "legacy_creator_report" })]; });
  assert.match(ui.text(), /My report: I feel reconnected/);
  assert.match(ui.text(), /Preserved legacy report/);
});

test("A03: positive contribution works without inventing a repair report", async (t) => {
  const { ui } = await setup(t, (db) => { db.repairs = []; });
  assert.match(ui.text(), /a own perspective/);
  assert.doesNotMatch(ui.text(), /My repair update|I still feel unresolved/);
});

test("A03: repair-only contribution works without inventing a perspective", async (t) => {
  const { ui } = await setup(t, (db) => { db.perspectives = []; });
  assert.match(ui.text(), /My repair update/);
  assert.doesNotMatch(ui.text(), /My perspective|a own perspective/);
});

test("A03: missing own contributions produce an understandable empty state", async (t) => {
  const { ui } = await setup(t, (db) => { db.perspectives = [perspective("b")]; db.repairs = [repair("b")]; });
  assert.match(ui.text(), /No contributions available/);
  assert.doesNotMatch(ui.text(), /b own perspective|My repair update/);
});

test("A03: unrelated current member sees no other authors in empty fixture space", async (t) => {
  const { db, ui } = await setup(t, (db) => { db.memberships.set("unrelated", "other-space"); db.emit("unrelated"); });
  assert.match(ui.text(), /No contributions available/);
  assert.doesNotMatch(ui.text(), /a own perspective|b own perspective/);
  ownQueryContract(db, "unrelated");
});

test("A03: revoked membership before load fails closed without child requests", async (t) => {
  const { db, ui } = await setup(t, (db) => db.memberships.delete("a"));
  assert.match(ui.text(), /Could not verify access/);
  assert.doesNotMatch(ui.text(), /a own perspective/);
  assert.ok(db.reads.every((call) => call.table === "couple_members"));
});

for (const replacement of [null, "replacement-space"]) test(`A03: membership changes during load (${replacement}) discard all child results`, async (t) => {
  const { ui } = await setup(t, (db) => {
    const original = db.read; let checks = 0;
    db.read = async (call) => {
      if (call.table === "couple_members" && ++checks === 2) {
        if (replacement) db.memberships.set("a", replacement); else db.memberships.delete("a");
      }
      return original(call);
    };
  });
  assert.match(ui.text(), /Could not verify access/);
  assert.doesNotMatch(ui.text(), /a own perspective|My report:/);
});

test("A03: membership invalidation signal hides content before delayed recheck", async (t) => {
  const { db, ui } = await setup(t);
  const pending = deferred(); db.read = () => pending.promise;
  db.signal("couple_members"); ui.render();
  assert.doesNotMatch(ui.text(), /a own perspective/);
  db.memberships.delete("a"); pending.resolve({ data: null, error: null }); await ui.flush();
  assert.match(ui.text(), /Could not verify access/);
});

test("A03: anonymous user cannot query children", async (t) => {
  const { db, ui } = await setup(t, (db) => db.emit(null));
  assert.equal(db.reads.length, 0);
  assert.doesNotMatch(ui.text(), /own perspective/);
  assert.ok(ui.navigations.includes("/"));
});

test("A03: delayed Account A data cannot populate Account B", async (t) => {
  const pending = deferred();
  const { db, ui } = await setup(t, (db) => {
    const original = db.read;
    db.read = (call) => call.table !== "couple_members" && call.headers.Authorization === "Bearer a-token" ? pending.promise : original(call);
  });
  await ui.switchAccount("b"); onlyB(ui);
  pending.resolve({ data: [perspective("a"), repair("a")], error: null }); await ui.flush();
  onlyB(ui);
  assert.equal(ui.navigations.length, 0);
});

test("A03: blur clears own rows and drops late data; focus re-verifies", async (t) => {
  const { db, ui } = await setup(t);
  const pending = deferred(), original = db.read; db.read = () => pending.promise;
  db.signal("event_perspectives"); await ui.flush();
  await ui.blur();
  pending.resolve({ data: [perspective("a")], error: null }); await ui.flush();
  assert.doesNotMatch(ui.text(), /a own perspective/);
  db.read = original; await ui.focus();
  assert.match(ui.text(), /a own perspective/);
});

test("A03: session re-verification failure clears private rows", async (t) => {
  const { ui } = await setup(t, (db) => {
    const original = db.getUser; let checks = 0;
    db.getUser = (token) => ++checks === 2 ? Promise.resolve({ data: { user: null }, error: { message: "Offline" } }) : original(token);
  });
  assert.doesNotMatch(ui.text(), /a own perspective/);
  assert.match(ui.text(), /Private data has been cleared/);
});

for (const table of ["event_perspectives", "event_repair_states"]) test(`A03: ${table} error publishes neither half-loaded set nor raw error data`, async (t) => {
  const { ui } = await setup(t, (db) => {
    const original = db.read;
    db.read = (call) => call.table === table ? Promise.resolve({ data: null, error: { message: "PRIVATE ERROR CANARY" } }) : original(call);
  });
  assert.match(ui.text(), /Could not verify access/);
  assert.doesNotMatch(ui.text(), /a own perspective|My report:|PRIVATE ERROR CANARY/);
});

test("A03: Realtime failure preserves freshly authorized contributions and refresh only reads", async (t) => {
  const { db, ui } = await setup(t);

  const channel = db.channels.at(-1);
  const readsBeforeFailure = db.reads.length;

  // A Realtime connection error must not invalidate valid REST access.
  channel.status("CHANNEL_ERROR");
  ui.render();
  await ui.flush();

  assert.match(ui.text(), /a own perspective/);
  assert.match(ui.text(), /Automatic updates are unavailable/);

  // Connection failure alone must not trigger additional REST requests.
  assert.equal(db.reads.length, readsBeforeFailure);

  // Manual refresh revalidates access without replacing the subscription.
  db.perspectives[0].perspective_text = "a own perspective refreshed during Realtime outage";
  await ui.tap("Refresh my contributions");

  assert.match(ui.text(), /a own perspective/);
  assert.match(ui.text(), /a own perspective refreshed during Realtime outage/);
  assert.match(ui.text(), /Automatic updates are unavailable/);
  assert.ok(db.reads.length > readsBeforeFailure);
  assert.equal(db.channels.length, 1);
  assert.equal(channel.removed, false);

  const readsAfterRefresh = db.reads.length;
  channel.status("SUBSCRIBED");
  await ui.flush();
  assert.doesNotMatch(ui.text(), /Automatic updates are unavailable/);
  assert.match(ui.text(), /a own perspective refreshed during Realtime outage/);
  assert.equal(db.reads.length, readsAfterRefresh);
  assert.equal(db.channels.length, 1);
  assert.equal(channel.removed, false);
  ownQueryContract(db, "a");

  // This screen must never perform a mutation.
  assert.equal(db.writes.length, 0);
});

for (const status of ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"]) test(`A03: ${status} cannot cancel an in-flight authorized REST refresh`, async (t) => {
  // The channel is created only after the initial authorized snapshot exists.
  const { db, ui } = await setup(t);
  const channel = db.channels.at(-1);
  const pending = deferred();
  const original = db.read, reads = db.reads.length, checks = db.checks.length;
  db.read = (call) => call.table === "couple_members" ? original(call) : pending.promise.then(() => original(call));
  await ui.tap("Refresh my contributions");
  assert.match(ui.text(), /Checking access/);
  assert.doesNotMatch(ui.text(), /a own perspective|b own perspective|My report:/);
  assert.equal(ui.find("Refresh my contributions").props.disabled, true);
  assert.equal(db.reads.length - reads, 3, "membership and both child reads are in flight");
  assert.equal(db.checks.length - checks, 1);

  channel.status(status); await ui.flush();
  assert.match(ui.text(), /Automatic updates are unavailable/);
  assert.match(ui.text(), /Checking access/);
  assert.doesNotMatch(ui.text(), /a own perspective|b own perspective|My report:/);
  assert.equal(db.reads.length - reads, 3, "channel failure neither retries nor replaces the REST refresh");
  assert.equal(db.checks.length - checks, 1);

  pending.resolve(); await ui.flush();
  assert.match(ui.text(), /a own perspective/);
  assert.match(ui.text(), /My report: I feel reconnected/);
  assert.match(ui.text(), /Automatic updates are unavailable/);
  assert.doesNotMatch(ui.text(), /b own perspective/);
  assert.equal(ui.find("Refresh my contributions").props.disabled, false);
  assert.equal(db.reads.length - reads, 4, "refresh rechecks membership after both child responses");
  assert.equal(db.reads.slice(reads).filter((call) => call.table === "couple_members").length, 2);
  assert.equal(db.checks.length - checks, 2, "refresh reauthorizes before publishing");
  assert.equal(db.channels.length, 1);
  assert.equal(channel.removed, false);
  ownQueryContract(db, "a");
});

test("A03: immediate subscription error does not prevent initial REST loading", async (t) => {
  const { db, ui } = await setup(t, (db) => {
    const original = db.supabase.channel;
    db.supabase.channel = () => {
      const channel = original();
      channel.subscribe = (handler) => { channel.status = handler; handler("CHANNEL_ERROR"); return channel; };
      return channel;
    };
  });
  assert.match(ui.text(), /a own perspective/);
  assert.match(ui.text(), /Automatic updates are unavailable/);
  ownQueryContract(db, "a");
});

test("A03: synchronous subscribe failure is best effort and does not expose raw errors", async (t) => {
  const { db, ui } = await setup(t, (db) => {
    const original = db.supabase.channel;
    db.supabase.channel = () => {
      const channel = original();
      channel.subscribe = () => { throw new Error("PRIVATE CONNECTION ERROR CANARY"); };
      return channel;
    };
  });
  assert.match(ui.text(), /a own perspective/);
  assert.match(ui.text(), /Automatic updates are unavailable/);
  assert.doesNotMatch(ui.text(), /PRIVATE CONNECTION ERROR CANARY/);
  ownQueryContract(db, "a");
  await ui.blur(); assert.equal(db.channels[0].removed, true);
});

test("A03: manual refresh works with no channel status or change notifications", async (t) => {
  const { db, ui } = await setup(t);
  const reads = db.reads.length, checks = db.checks.length;
  db.repairs[0].repair_status = "partially_repaired";
  await ui.tap("Refresh my contributions");
  assert.match(ui.text(), /My report: I feel partly repaired/);
  assert.ok(db.reads.length > reads);
  assert.ok(db.checks.length > checks, "refresh repeats server authentication checks");
  assert.equal(db.channels.length, 1);
  assert.match(ui.text(), /Reopen or refresh to load your latest contributions/);
  ownQueryContract(db, "a");
});

for (const table of ["event_perspectives", "event_repair_states"]) test(`A03: manual refresh clears previous private data when ${table} is denied and Realtime is down`, async (t) => {
  const { db, ui } = await setup(t);
  db.channels[0].status("CHANNEL_ERROR"); await ui.flush();
  const pending = deferred(), original = db.read;
  db.read = (call) => call.table === table ? pending.promise : original(call);
  ui.find("Refresh my contributions").props.onPress(); ui.render();
  assert.doesNotMatch(ui.text(), /a own perspective|My report:/);
  pending.resolve({ data: null, error: { code: "42501", message: "PRIVATE DENIAL CANARY" } });
  await ui.flush();
  assert.match(ui.text(), /Could not verify access/);
  assert.match(ui.text(), /Automatic updates are unavailable/);
  assert.doesNotMatch(ui.text(), /a own perspective|My report:|PRIVATE DENIAL CANARY/);
  const reads = db.reads.length;
  db.channels[0].status("SUBSCRIBED"); await ui.flush();
  assert.match(ui.text(), /Could not verify access/);
  assert.doesNotMatch(ui.text(), /a own perspective|My report:|Automatic updates are unavailable/);
  assert.equal(db.reads.length, reads, "channel recovery is not authorization or a retry");
  assert.equal(db.channels.length, 1);
  assert.equal(db.writes.length, 0);
});

test("A03: refresh while Realtime is down still clears data on membership revocation", async (t) => {
  const { db, ui } = await setup(t);
  db.channels[0].status("CLOSED"); await ui.flush();
  const before = db.reads.length;
  db.memberships.delete("a");
  await ui.tap("Refresh my contributions");
  assert.match(ui.text(), /Could not verify access/);
  assert.doesNotMatch(ui.text(), /a own perspective|My report:/);
  assert.ok(db.reads.slice(before).every((call) => call.table === "couple_members"));
  assert.equal(db.channels.length, 1);
  assert.equal(db.writes.length, 0);
});

test("A03: membership replacement during manual refresh rejects pending rows without Realtime", async (t) => {
  const { db, ui } = await setup(t);
  db.channels[0].status("CHANNEL_ERROR");
  const pending = deferred(), original = db.read;
  db.read = (call) => call.table === "couple_members" ? original(call) : pending.promise.then(() => original(call));
  ui.find("Refresh my contributions").props.onPress(); await ui.flush();
  assert.doesNotMatch(ui.text(), /a own perspective|My report:/);
  db.memberships.set("a", "replacement-space");
  pending.resolve(); await ui.flush();
  assert.match(ui.text(), /Could not verify access/);
  assert.doesNotMatch(ui.text(), /a own perspective|My report:/);
  assert.equal(db.writes.length, 0);
});

test("A03: REST reauthentication failure clears cached data despite channel recovery", async (t) => {
  const { db, ui } = await setup(t);
  const channel = db.channels[0]; channel.status("CHANNEL_ERROR");
  db.getUser = async () => ({ data: { user: null }, error: { message: "PRIVATE AUTH ERROR" } });
  await ui.tap("Refresh my contributions");
  assert.match(ui.text(), /Private data has been cleared/);
  assert.doesNotMatch(ui.text(), /a own perspective|My report:|PRIVATE AUTH ERROR/);
  channel.status("SUBSCRIBED"); await ui.flush();
  assert.match(ui.text(), /Private data has been cleared/);
  assert.doesNotMatch(ui.text(), /a own perspective|My report:/);
  assert.equal(channel.removed, true);
});

test("A03: account switch and logout stay isolated when Realtime is unavailable", async (t) => {
  const { db, ui } = await setup(t);
  const oldChannel = db.channels[0]; oldChannel.status("CHANNEL_ERROR");
  await ui.switchAccount("b"); onlyB(ui);
  oldChannel.status("CHANNEL_ERROR"); await ui.flush();
  onlyB(ui); assert.doesNotMatch(ui.text(), /Automatic updates are unavailable/);
  assert.equal(oldChannel.removed, true);
  db.channels.at(-1).status("CLOSED"); await ui.flush();
  await ui.switchAccount(null);
  assert.doesNotMatch(ui.text(), /own perspective|My report:/);
  assert.ok(ui.navigations.includes("/"));
  assert.equal(db.writes.length, 0);
});

test("A03: repeated connection errors do not resubscribe or retry REST automatically", async (t) => {
  const { db, ui } = await setup(t);
  const reads = db.reads.length, checks = db.checks.length, channel = db.channels[0];
  for (const status of ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED", "CHANNEL_ERROR"]) {
    channel.status(status); await ui.flush();
  }
  assert.equal(db.channels.length, 1);
  assert.equal(db.reads.length, reads);
  assert.equal(db.checks.length, checks);
  assert.match(ui.text(), /a own perspective/);
  assert.equal(db.writes.length, 0);
});

test("A03: best-effort notifications still trigger guarded reload after recovery", async (t) => {
  const { db, ui } = await setup(t);
  db.channels[0].status("CHANNEL_ERROR"); await ui.flush();
  db.channels[0].status("SUBSCRIBED"); await ui.flush();
  db.perspectives[0].perspective_text = "A notified update";
  const pending = deferred(), original = db.read;
  db.read = (call) => call.table === "couple_members" ? original(call) : pending.promise.then(() => original(call));
  db.signal("event_perspectives"); ui.render();
  assert.doesNotMatch(ui.text(), /a own perspective|A notified update|My report:/);
  pending.resolve(); await ui.flush();
  assert.match(ui.text(), /A notified update/);
  assert.doesNotMatch(ui.text(), /Automatic updates are unavailable/);
  assert.equal(db.channels.length, 1);
  ownQueryContract(db, "a");
});

test("A03: overlapping manual refreshes coalesce and cancelled responses cannot replace the newer authorized snapshot", async (t) => {
  const { db, ui } = await setup(t);
  const pending = deferred(), original = db.read;
  const reads = db.reads.length, checks = db.checks.length;
  db.read = (call) => call.table === "event_perspectives" ? pending.promise : original(call);
  const refresh = ui.find("Refresh my contributions").props.onPress;
  refresh(); await ui.flush();
  assert.match(ui.text(), /Checking access/);
  assert.doesNotMatch(ui.text(), /a own perspective|b own perspective|My report:/);
  assert.equal(ui.find("Refresh my contributions").props.disabled, true);
  assert.equal(db.reads.length - reads, 3);
  assert.equal(db.checks.length - checks, 1);

  db.read = original; db.perspectives[0].perspective_text = "A latest refresh";
  db.repairs[0].repair_status = "partially_repaired";
  // Deliberately invoke the saved callback past the disabled host: a duplicate
  // refresh joins the pending job rather than launching an overlapping read.
  refresh(); await ui.flush();
  assert.match(ui.text(), /Checking access/);
  assert.doesNotMatch(ui.text(), /a own perspective|A latest refresh|My report:/);
  assert.equal(db.reads.length - reads, 3, "duplicate manual refresh coalesces");
  assert.equal(db.checks.length - checks, 1);

  // Backgrounding abandons the old job; foregrounding must fully revalidate.
  await ui.appState("background");
  assert.doesNotMatch(ui.text(), /a own perspective|A latest refresh|My report:/);
  assert.equal(db.reads.length - reads, 3, "backgrounding dispatches no reads");
  await ui.appState("active");
  assert.match(ui.text(), /A latest refresh/);
  assert.match(ui.text(), /My report: I feel partly repaired/);
  assert.equal(ui.find("Refresh my contributions").props.disabled, false);
  assert.equal(db.reads.length - reads, 7, "new generation performs both membership checks and both child reads");
  assert.equal(db.reads.slice(reads + 3).filter((call) => call.table === "couple_members").length, 2);
  assert.equal(db.checks.length - checks, 3, "new generation reauthorizes before and after loading");

  pending.resolve({ data: [perspective("a", { perspective_text: "A stale refresh" })], error: null });
  await ui.flush();
  assert.match(ui.text(), /A latest refresh/);
  assert.match(ui.text(), /My report: I feel partly repaired/);
  assert.doesNotMatch(ui.text(), /A stale refresh|a own perspective|b own perspective|My report: I feel reconnected/);
  assert.equal(db.reads.length - reads, 7, "cancelled response cannot continue membership revalidation or retry");
  assert.equal(db.checks.length - checks, 3);
  assert.equal(db.channels.length, 1);
  assert.equal(db.channels[0].removed, false);
  ownQueryContract(db, "a");
});

test("A03: missing/nonexistent supplied event IDs cannot trigger parent navigation or lookup", async (t) => {
  const { db, ui } = await setup(t, undefined, { params: { id: "nonexistent-event", scope: "ours" } });
  const before = db.reads.length;
  await ui.changeParams({ id: "hidden-event" });
  assert.equal(db.reads.length, before, "route accepts no event identifier");
  assert.ok(ui.nodes().filter((node) => node.type === "Pressable").every((node) =>
    ["Back to Moments", "Refresh my contributions"].includes(node.props.accessibilityLabel)));
  assert.equal(db.writes.length, 0, "no withdrawal, edit or sharing RPC, including uncertain mutations");
});

test("A03: accessible back action returns to Moments without passing hidden event IDs", async (t) => {
  const { db, ui } = await setup(t);
  await ui.tap("Back to Moments");
  assert.deepEqual(ui.navigations, ["/events"]);
  assert.equal(db.writes.length, 0);
});

for (const id of [undefined, "hidden-event", "nonexistent-event"]) test(`A03: normal Event Detail still denies missing/RLS-hidden parent (${id})`, async (t) => {
  const db = client(); db.emit("b");
  const calls = [];
  db.supabase.from = (table) => {
    assert.ok(["couple_members", "relationship_events"].includes(table), "hidden parent must stop all child/reflection reads");
    const call = { table, headers: {} }; calls.push(call);
    return {
      select() { return this; }, eq() { return this; }, maybeSingle() { return this; },
      setHeader(key, value) { call.headers[key] = value; return this; },
      then(resolve, reject) { return Promise.resolve({ data: table === "couple_members" ? { couple_id: "couple-1" } : null, error: null }).then(resolve, reject); },
    };
  };
  const ui = harness(db, "src/app/event/[id].tsx", {
    params: { id }, imports: { "@/components/EventRepairSection": { EventRepairSection: "EventRepairSection" } },
  });
  t.after(ui.unmount); await ui.flush();
  assert.match(ui.text(), id ? /This moment is unavailable/ : /Invalid event/);
  assert.doesNotMatch(ui.text(), /own perspective|My report:|Hidden topic/);
  assert.equal(calls.length, id ? 2 : 0);
  if (id) assert.equal(calls[0].headers.Authorization, "Bearer b-token");
  assert.equal(db.writes.length, 0);
});

test("A03: actual Moments screen entry navigates to contributions without a parent ID", async (t) => {
  const { momentsClient } = require("./helpers/account-screen-client.cjs");
  const db = momentsClient();
  const ui = harness(db, "src/app/events.tsx", { imports: { "@/components/AppBottomNav": { AppBottomNav: () => null } } });
  t.after(ui.unmount);await ui.flush();await ui.tap("My contributions");
  assert.deepEqual(ui.navigations,["/my-contributions"]);
});

test("A03 negative control: dropping author query filter is detected by the query contract", async (t) => {
  const source = readFileSync(path.join(__dirname, "..", file), "utf8")
    .replace('.eq("author_id", scope.userId)', '');
  const { db, ui } = await setup(t, undefined, { source });
  assert.match(ui.text(), /a own perspective/);
  assert.throws(() => ownQueryContract(db, "a"), assert.AssertionError);
});
