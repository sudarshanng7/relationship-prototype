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

test("A03: live channel failure clears loaded content and refresh only reads", async (t) => {
  const { db, ui } = await setup(t);
  db.channels.at(-1).status("CHANNEL_ERROR"); ui.render();
  assert.doesNotMatch(ui.text(), /a own perspective/);
  assert.match(ui.text(), /Live access checks are unavailable/);
  await ui.tap("Refresh my contributions");
  assert.match(ui.text(), /a own perspective/);
  assert.equal(db.writes.length, 0);
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
    assert.equal(table, "relationship_events", "hidden parent must stop all child/reflection reads");
    const call = { table, headers: {} }; calls.push(call);
    return {
      select() { return this; }, eq() { return this; }, maybeSingle() { return this; },
      setHeader(key, value) { call.headers[key] = value; return this; },
      then(resolve, reject) { return Promise.resolve({ data: null, error: null }).then(resolve, reject); },
    };
  };
  const ui = harness(db, "src/app/event/[id].tsx", {
    params: { id }, imports: { "@/components/EventRepairSection": { EventRepairSection: "EventRepairSection" } },
  });
  t.after(ui.unmount); await ui.flush();
  assert.match(ui.text(), id ? /Event not found or you do not have permission/ : /Invalid event/);
  assert.doesNotMatch(ui.text(), /own perspective|My report:|Hidden topic/);
  assert.equal(calls.length, id ? 1 : 0);
  if (id) assert.equal(calls[0].headers.Authorization, "Bearer b-token");
  assert.equal(db.writes.length, 0);
});

test("A03: actual Moments screen entry navigates to contributions without a parent ID", async () => {
  const { useState } = { useState: (value) => [value, () => {}] };
  const navigations = [], jsx = (type, props) => ({ type, props });
  const Screen = loadSource("src/app/events.tsx", {
    "@/components/AppBottomNav": { AppBottomNav: "AppBottomNav" },
    "@/lib/supabase": { supabase: {} },
    "expo-router": { useRouter: () => ({ push: (route) => navigations.push(route) }), useLocalSearchParams: () => ({}), useFocusEffect: () => {} },
    react: { useState, useCallback: (fn) => fn, useMemo: (fn) => fn() },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": { View: "View", Text: "Text", Pressable: "Pressable", ScrollView: "ScrollView", StyleSheet: { create: (value) => value } },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
  }).default;
  const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === "object" ? [node, ...nodes(node.props?.children)] : [];
  const entry = nodes(Screen()).find((node) => node.props.accessibilityLabel === "My contributions");
  assert.ok(entry); entry.props.onPress();
  assert.deepEqual(navigations, ["/my-contributions"]);
});

test("A03 negative control: dropping author query filter is detected by the query contract", async (t) => {
  const source = readFileSync(path.join(__dirname, "..", file), "utf8")
    .replace('.eq("author_id", scope.userId)', '');
  const { db, ui } = await setup(t, undefined, { source });
  assert.match(ui.text(), /a own perspective/);
  assert.throws(() => ownQueryContract(db, "a"), assert.AssertionError);
});
