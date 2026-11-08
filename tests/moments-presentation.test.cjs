const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { deferred, harness, loadSource } = require("./helpers/account-screen-harness.cjs");

// Actual Moments, shared UI and navigation; synthetic auth/transport/native hosts.
// Fixture filtering is not a database/RLS test or native rendering evidence.
function event(id, values = {}) {
  return { id, creator_id: "a", couple_id: "couple-1", event_type: "friction",
    category: "communication", intensity: 3, visibility: "ours",
    created_at: "2026-11-08T12:00:00Z", ...values };
}
function repair(values = {}) {
  return { event_id: "a-ours", user_id: "a", repair_status: "open", what_helped: null,
    sharing_status: "private", status_origin: "explicit", ...values };
}
function client() {
  const db = { userId: "a", authError: null, authChecks: 0, listeners: new Set(), reads: [], channels: [],
    memberships: new Map([["a", "couple-1"], ["b", "couple-1"], ["solo", "solo-space"]]),
    events: [event("a-mine", { visibility: "mine", category: "household" }), event("a-ours"),
      event("b-mine", { creator_id: "b", visibility: "mine", category: "money" }),
      event("b-ours", { creator_id: "b", category: "plans" }),
      event("good", { event_type: "positive", category: "care", intensity: null }),
      event("unrelated", { couple_id: "other-space", creator_id: "other" })],
    repairs: [],
  };
  db.getUser = async () => ({ data: { user: db.userId ? { id: db.userId } : null }, error: db.authError });
  db.emit = (id, name = id ? "SIGNED_IN" : "SIGNED_OUT") => {
    db.userId = id;
    for (const listener of db.listeners) listener(name, id ? { user: { id } } : null);
  };
  db.defaultRead = (call) => {
    const ownCouple = db.memberships.get(call.userId);
    if (call.table === "couple_members") {
      const requestedUser = call.filters.find(([key]) => key === "user_id")?.[1];
      return { data: requestedUser === call.userId && ownCouple ? { couple_id: ownCouple } : null, error: null };
    }
    let rows;
    if (call.table === "relationship_events") {
      rows = db.events.filter((row) => row.couple_id === ownCouple &&
        (row.visibility === "ours" || row.creator_id === call.userId));
    } else {
      rows = db.repairs.filter((row) => {
        const parent = db.events.find((item) => item.id === row.event_id);
        return parent?.couple_id === ownCouple && (row.user_id === call.userId || (
          parent.visibility === "ours" && row.sharing_status === "shared" && row.status_origin === "explicit"
        ));
      });
    }
    rows = rows.filter((row) => call.filters.every(([key, value]) => row[key] === value));
    if (call.ids) rows = rows.filter((row) => call.ids.includes(row.event_id));
    // Return only the actual selected fields, as the production query requests.
    return { data: rows.map((row) => Object.fromEntries(call.columns.split(",").map((key) => [key.trim(), row[key.trim()]]))), error: null };
  };
  db.read = async (call) => db.defaultRead(call);
  db.supabase = {
    auth: {
      getUser: () => { db.authChecks++; return db.getUser(); },
      onAuthStateChange(listener) {
        db.listeners.add(listener);
        return { data: { subscription: { unsubscribe: () => db.listeners.delete(listener) } } };
      },
    },
    from(table) {
      assert.ok(["couple_members", "relationship_events", "event_repair_states"].includes(table), `Unexpected table ${table}`);
      const call = { table, filters: [] };
      return {
        select(columns) { call.columns = columns; return this; },
        eq(key, value) { call.filters.push([key, value]); return this; },
        in(key, values) { assert.equal(key, "event_id"); call.ids = [...values]; return this; },
        order(key, value) { call.order = [key, value]; return this; },
        maybeSingle() { return this; },
        then(resolve, reject) {
          call.userId = db.userId; db.reads.push(call);
          return Promise.resolve().then(() => db.read(call)).then(resolve, reject);
        },
      };
    },
    rpc: () => assert.fail("Moments must not mutate data"),
    channel(name) {
      const channel = { name, handlers: [], removed: false,
        on(type, filter, handler) { this.handlers.push({ type, filter, handler }); return this; },
        subscribe() { return this; },
      };
      db.channels.push(channel); return channel;
    },
    removeChannel(channel) { channel.removed = true; },
  };
  return db;
}
async function setup(t, params = {}, configure) {
  const db = client(); configure?.(db);
  const bottomRoutes = [];
  const jsx = (type, props) => ({ type, props });
  const nav = loadSource("src/components/AppBottomNav.tsx", {
    "expo-router": { useRouter: () => ({ replace: (route) => bottomRoutes.push(route) }) },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": { View: "View", Text: "Text", Pressable: "Pressable", StyleSheet: { create: (value) => value } },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ bottom: 24 }) },
  });
  const ui = harness(db, "src/app/events.tsx", { params, imports: { "@/components/AppBottomNav": nav } });
  t.after(ui.unmount); await ui.flush();
  return { db, ui, bottomRoutes };
}
const cards = (ui) => ui.nodes().filter((node) => node.type === "Pressable" && node.props.testID?.startsWith("moment-"));
const ids = (ui) => cards(ui).map((node) => node.props.testID.slice(7)).sort();
const text = (node) => Array.isArray(node) ? node.map(text).join("") : node && typeof node === "object"
  ? text(node.props?.children) : typeof node === "string" ? node : "";
const card = (ui, id) => cards(ui).find((node) => node.props.testID === `moment-${id}`);
const emptyCopy = /No moments here yet|Nothing shared here yet|Your private space is quiet for now/;

for (const scope of [undefined, "all"]) {
  test(`${scope ?? "default"} scope starts with All and only authorized event cards`, async (t) => {
    const { ui } = await setup(t, scope ? { scope } : {});
    assert.deepEqual(ids(ui), ["a-mine", "a-ours", "b-ours", "good"]);
    assert.equal(ui.find("Show All moments").props.accessibilityState.selected, true);
    assert.equal(ui.find("Show Mine moments").props.accessibilityRole, "tab");
  });
}
for (const [scope, expected] of [["mine", ["a-mine"]], ["ours", ["a-ours", "b-ours", "good"]]]) {
  for (const array of [false, true]) {
    test(`forced ${scope}, array=${array} preserves scoped cards and hides local tabs`, async (t) => {
      const { ui } = await setup(t, { scope: array ? [scope, "all"] : scope });
      assert.deepEqual(ids(ui), expected);
      assert.equal(ui.find("Show All moments"), undefined);
      assert.match(ui.text(), scope === "mine" ? /Your private moments, visible only to you/ : /moments intentionally shared/);
    });
  }
}
test("local All/Mine/Ours switches hide excluded records without additional reads", async (t) => {
  const { db, ui } = await setup(t);
  const reads = db.reads.length;
  await ui.tap("Show Mine moments"); assert.deepEqual(ids(ui), ["a-mine"]);
  await ui.tap("Show Ours moments"); assert.deepEqual(ids(ui), ["a-ours", "b-ours", "good"]);
  await ui.tap("Show All moments"); assert.deepEqual(ids(ui), ["a-mine", "a-ours", "b-ours", "good"]);
  assert.equal(db.reads.length, reads);
});
test("route scope changes preserve forced filtering and reset the local filter on return", async (t) => {
  const { ui } = await setup(t);
  await ui.tap("Show Mine moments");
  await ui.changeParams({ scope: "ours" }); assert.deepEqual(ids(ui), ["a-ours", "b-ours", "good"]);
  await ui.changeParams({ scope: "mine" }); assert.deepEqual(ids(ui), ["a-mine"]);
  await ui.changeParams({ scope: "all" }); assert.deepEqual(ids(ui), ["a-mine", "a-ours", "b-ours", "good"]);
  assert.equal(ui.find("Show All moments").props.accessibilityState.selected, true);
});
for (const scope of ["all", "mine", "ours"]) {
  test(`${scope} keeps contributions and generic recording destinations`, async (t) => {
    const { ui } = await setup(t, { scope });
    await ui.tap("My contributions"); await ui.tap("Record a moment");
    assert.deepEqual(ui.navigations, ["/my-contributions", "/record-moment"]);
  });
}
test("moment cards keep their exact Event Detail ID route", async (t) => {
  const { ui } = await setup(t);
  await card(ui, "b-ours").props.onPress();
  assert.deepEqual(ui.navigations, [{ pathname: "/event/[id]", params: { id: "b-ours" } }]);
});
for (const scope of ["all", "mine", "ours"]) {
  test(`${scope} keeps safe-area ownership and existing bottom navigation selection/routes`, async (t) => {
    const { ui, bottomRoutes } = await setup(t, { scope });
    const root = ui.nodes()[0];
    assert.equal(root.type, "SafeAreaView");
    assert.deepEqual(root.props.edges, ["top", "left", "right"]);
    assert.equal(root.props.children[0].type, "ScrollView");
    assert.equal(root.props.children[1].type, "View");
    assert.equal(ui.find(scope === "ours" ? "Our Space" : "Moments").props.accessibilityState.selected, true);
    await ui.tap("Home"); await ui.tap("Settings");
    assert.deepEqual(bottomRoutes, ["/home", "/profile"]);
    assert.deepEqual(ui.navigations, []);
  });
}
for (const scope of ["all", "mine", "ours"]) {
  test(`verified empty ${scope} uses the correct empty copy`, async (t) => {
    const { ui } = await setup(t, { scope }, (db) => { db.events = []; });
    assert.match(ui.text(), scope === "mine" ? /Your private space is quiet for now/
      : scope === "ours" ? /Nothing shared here yet/ : /No moments here yet/);
    assert.ok(ui.find("My contributions"));
  });
}
for (const table of ["couple_members", "relationship_events", "event_repair_states"]) {
  test(`${table} errors fail closed without empty-state or backend-detail disclosure`, async (t) => {
    const { ui } = await setup(t, {}, (db) => {
      db.read = async (call) => call.table === table
        ? { data: null, error: { message: "PRIVATE_QUERY_DETAIL" } } : db.defaultRead(call);
    });
    assert.equal(cards(ui).length, 0);
    assert.match(ui.text(), /Moments aren't available/);
    assert.doesNotMatch(ui.text(), emptyCopy);
    assert.doesNotMatch(ui.text(), /PRIVATE_QUERY_DETAIL/);
    if (table === "event_repair_states") assert.match(ui.text(), /Could not load repair updates/);
  });
}
test("missing membership offers Settings and never queries event or repair tables", async (t) => {
  const { db, ui } = await setup(t, {}, (db) => { db.memberships.delete("a"); });
  assert.match(ui.text(), /Create or join a relationship space/);
  assert.doesNotMatch(ui.text(), emptyCopy);
  assert.deepEqual(db.reads.map((call) => call.table), ["couple_members"]);
  await ui.tap("Go to Settings"); assert.deepEqual(ui.navigations, ["/profile"]);
});
test("a solo member retains private moments without inventing partner participation", async (t) => {
  const { ui } = await setup(t, {}, (db) => {
    db.userId = "solo";
    db.events = [event("solo-mine", { creator_id: "solo", couple_id: "solo-space", visibility: "mine" })];
  });
  assert.deepEqual(ids(ui), ["solo-mine"]);
  assert.match(ui.text(), /Your update: Not recorded yet/);
  assert.doesNotMatch(ui.text(), /Partner shared:/);
  await ui.tap("Show Ours moments"); assert.match(ui.text(), /Nothing shared here yet/);
});
test("pending data reads show loading, disable refresh, and never show an empty collection", async (t) => {
  const pending = deferred();
  const { db, ui } = await setup(t, {}, (db) => {
    db.read = async (call) => call.table === "relationship_events" ? pending.promise : db.defaultRead(call);
  });
  assert.match(ui.text(), /Loading your moments/);
  assert.doesNotMatch(ui.text(), emptyCopy);
  assert.equal(ui.find("Refresh moments and repair updates").props.disabled, true);
  pending.resolve(db.defaultRead(db.reads.find((call) => call.table === "relationship_events"))); await ui.flush();
  assert.equal(cards(ui).length, 4);
});
test("positive and friction cards retain category, date, visibility and separate attribution", async (t) => {
  const { ui } = await setup(t);
  assert.match(text(card(ui, "good")), /CareRecorded by you/);
  assert.match(text(card(ui, "good")), /Ours · SharedPositive/);
  assert.doesNotMatch(text(card(ui, "good")), /Your update:|Partner shared:/);
  assert.match(text(card(ui, "a-mine")), /Mine · PrivateFriction/);
  assert.match(text(card(ui, "b-ours")), /Shared by your partner/);
  assert.match(text(card(ui, "good")), /2026/);
});
test("queries remain minimal and use one repair batch for visible friction IDs", async (t) => {
  const { db } = await setup(t);
  assert.deepEqual(db.reads.map((call) => call.table), ["couple_members", "relationship_events", "event_repair_states"]);
  const events = db.reads[1], repairs = db.reads[2];
  assert.equal(events.columns, "id, creator_id, event_type, category, intensity, visibility, created_at");
  assert.equal(repairs.columns, "event_id, user_id, repair_status, what_helped, sharing_status, status_origin");
  assert.deepEqual(repairs.ids.sort(), ["a-mine", "a-ours", "b-ours"]);
  assert.deepEqual(events.filters, [["couple_id", "couple-1"]]);
});
test("a positive-only list does not query repair states", async (t) => {
  const { db, ui } = await setup(t, {}, (db) => { db.events = [event("good", { event_type: "positive" })]; });
  assert.deepEqual(db.reads.map((call) => call.table), ["couple_members", "relationship_events"]);
  assert.doesNotMatch(ui.text(), /Your update:|Partner shared:/);
});

for (const [name, rows, expected] of [
  ["missing", [], "Your update: Not recorded yet"],
  ["own private", [repair()], "Your update: Still unresolved · Private"],
  ["own shared", [repair({ sharing_status: "shared", repair_status: "reconnected" })], "Your update: I feel reconnected · Shared"],
  ["unconfirmed import", [repair({ status_origin: "legacy_default_unconfirmed" })], "Your update: Imported Open (not confirmed)"],
  ["historical report", [repair({ status_origin: "legacy_creator_report", repair_status: "partially_repaired" })], "Your earlier update: A little better (review before sharing)"],
  ["partner shared", [repair({ user_id: "b", sharing_status: "shared", what_helped: "talking" })], "Partner shared: Still unresolved · Talking helped"],
]) {
  test(`${name} repair keeps its existing personal/provenance wording`, async (t) => {
    const { ui } = await setup(t, {}, (db) => { db.repairs = rows; });
    assert.ok(text(card(ui, "a-ours")).includes(expected));
  });
}
for (const [name, row] of [
  ["private", repair({ user_id: "b" })],
  ["withdrawn", repair({ user_id: "b", sharing_status: "withdrawn" })],
  ["suspended", repair({ user_id: "b", sharing_status: "suspended" })],
  ["unconfirmed", repair({ user_id: "b", sharing_status: "shared", status_origin: "legacy_default_unconfirmed" })],
  ["historical", repair({ user_id: "b", sharing_status: "shared", status_origin: "legacy_creator_report" })],
]) {
  test(`partner ${name} row is never promoted to shared even from an adversarial response`, async (t) => {
    const { ui } = await setup(t, {}, (db) => {
      db.read = async (call) => call.table === "event_repair_states"
        ? { data: [{ ...row, what_helped: "PRIVATE_METHOD_CANARY" }], error: null } : db.defaultRead(call);
    });
    assert.doesNotMatch(ui.text(), /Partner shared:|PRIVATE|Canary|Your earlier update:/);
  });
}
test("Mine cards never show a partner report from an adversarial repair response", async (t) => {
  const { ui } = await setup(t, { scope: "mine" }, (db) => {
    db.read = async (call) => call.table === "event_repair_states"
      ? { data: [repair({ event_id: "a-mine", user_id: "b", sharing_status: "shared" })], error: null }
      : db.defaultRead(call);
  });
  assert.doesNotMatch(ui.text(), /Partner shared:/);
});
test("two reconnected reports stay individually attributed without a mutual outcome", async (t) => {
  const { ui } = await setup(t, {}, (db) => {
    db.repairs = [repair({ repair_status: "reconnected", sharing_status: "shared" }),
      repair({ user_id: "b", repair_status: "reconnected", sharing_status: "shared" })];
  });
  const value = text(card(ui, "a-ours"));
  assert.match(value, /Your update: I feel reconnected · Shared/);
  assert.match(value, /Partner shared: I feel reconnected/);
  assert.doesNotMatch(value, /mutual|both reconnected|agreement|repaired together|score/i);
});

test("manual refresh clears old cards while rechecking and replaces its subscription", async (t) => {
  const { db, ui } = await setup(t);
  const oldChannel = db.channels[0], pending = deferred();
  db.read = async (call) => call.table === "relationship_events" ? pending.promise : db.defaultRead(call);
  await ui.tap("Refresh moments and repair updates");
  assert.equal(cards(ui).length, 0); assert.match(ui.text(), /Loading your moments/);
  assert.equal(oldChannel.removed, true);
  db.events = db.events.filter((row) => row.id !== "a-mine");
  pending.resolve(db.defaultRead(db.reads.filter((call) => call.table === "relationship_events").at(-1)));
  await ui.flush();
  assert.deepEqual(ids(ui), ["a-ours", "b-ours", "good"]);
  assert.equal(db.channels.length, 2);
});
test("Realtime event notifications revalidate rather than rendering notification payloads", async (t) => {
  const { db, ui } = await setup(t);
  const handler = db.channels[0].handlers[0];
  assert.deepEqual(handler.filter, { event: "*", schema: "public", table: "relationship_events", filter: "couple_id=eq.couple-1" });
  db.events = [];
  handler.handler({ new: { category: "UNTRUSTED_NOTIFICATION" } }); await ui.flush();
  assert.equal(cards(ui).length, 0);
  assert.match(ui.text(), /No moments here yet/);
  assert.doesNotMatch(ui.text(), /UNTRUSTED_NOTIFICATION/);
  assert.equal(db.authChecks, 4);
});
test("blur removes subscriptions/listeners and focus reloads current visibility", async (t) => {
  const { db, ui } = await setup(t);
  const channel = db.channels[0]; await ui.blur();
  assert.equal(channel.removed, true); assert.equal(db.listeners.size, 0);
  db.events = [];
  await ui.focus(); assert.equal(cards(ui).length, 0);
  assert.match(ui.text(), /No moments here yet/);
  assert.equal(db.listeners.size, 1);
});
test("Account A's late event response cannot populate Account B", async (t) => {
  const pending = deferred(); let aSnapshot;
  const { db, ui } = await setup(t, {}, (db) => {
    db.read = async (call) => {
      const result = db.defaultRead(call);
      if (call.table === "relationship_events" && call.userId === "a") { aSnapshot = result; return pending.promise; }
      return result;
    };
  });
  await ui.switchAccount("b");
  assert.deepEqual(ids(ui), ["a-ours", "b-mine", "b-ours", "good"]);
  pending.resolve(aSnapshot); await ui.flush();
  assert.deepEqual(ids(ui), ["a-ours", "b-mine", "b-ours", "good"]);
  assert.equal(card(ui, "a-mine"), undefined);
  assert.ok(db.channels.every((channel) => channel.name.includes("b:couple-1") || channel.name.includes("b-couple-1")));
});
test("account change during repair loading is caught by the final auth recheck", async (t) => {
  const { ui } = await setup(t, {}, (db) => {
    db.read = async (call) => {
      const result = db.defaultRead(call);
      if (call.table === "event_repair_states" && call.userId === "a") db.userId = "b";
      return result;
    };
  });
  assert.deepEqual(ids(ui), ["a-ours", "b-mine", "b-ours", "good"]);
});
test("late replies after focus cleanup cannot publish or subscribe", async (t) => {
  const pending = deferred(); let snapshot;
  const { db, ui } = await setup(t, {}, (db) => {
    db.read = async (call) => {
      const result = db.defaultRead(call);
      if (call.table === "relationship_events") { snapshot = result; return pending.promise; }
      return result;
    };
  });
  await ui.blur(); pending.resolve(snapshot); await ui.flush();
  assert.equal(cards(ui).length, 0); assert.equal(db.channels.length, 0);
});
for (const fail of [false, true]) {
  test(`signed out/auth failure=${fail} redirects without presenting an empty collection`, async (t) => {
    const { db, ui } = await setup(t, {}, (db) => {
      db.userId = null; if (fail) db.authError = { message: "PRIVATE_AUTH_DETAIL" };
    });
    assert.deepEqual(ui.navigations, ["/"]);
    assert.equal(db.reads.length, 0); assert.equal(cards(ui).length, 0);
    assert.doesNotMatch(ui.text(), emptyCopy); assert.doesNotMatch(ui.text(), /PRIVATE_AUTH_DETAIL/);
  });
}
test("sign-out clears loaded cards, removes the channel and redirects", async (t) => {
  const { db, ui } = await setup(t);
  await ui.switchAccount(null);
  assert.equal(cards(ui).length, 0); assert.equal(db.channels[0].removed, true);
  assert.deepEqual(ui.navigations, ["/"]);
  assert.doesNotMatch(ui.text(), emptyCopy);
});
test("unexpected partner-private parent rows are removed by the existing defensive filter", async (t) => {
  const { ui } = await setup(t, {}, (db) => {
    db.read = async (call) => call.table === "relationship_events"
      ? { data: db.events.filter((row) => row.couple_id === "couple-1"), error: null } : db.defaultRead(call);
  });
  assert.equal(card(ui, "b-mine"), undefined);
});
test("invalid dates remain unavailable and extra private fields are never rendered", async (t) => {
  const { ui } = await setup(t, {}, (db) => {
    db.read = async (call) => call.table === "relationship_events" ? {
      data: [event("good", { event_type: "positive", created_at: "invalid", note: "PRIVATE_NOTE", shared_topic: "UNSELECTED_TOPIC" })], error: null,
    } : db.defaultRead(call);
  });
  assert.match(ui.text(), /Date unavailable/);
  assert.doesNotMatch(ui.text(), /PRIVATE_NOTE|UNSELECTED_TOPIC/);
});
test("source has no legacy parent repair fields, preview dependencies or write paths", () => {
  const source = readFileSync(path.join(__dirname, "../src/app/events.tsx"), "utf8");
  assert.doesNotMatch(source, /repair_method|reconnected_at|event\.status|PreviewContext|UserIdentity|\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
});
