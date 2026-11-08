const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

// Execute the actual EventDetailContent handler/authorization, not a rewritten
// deletion controller. Hooks, native hosts, parent account identity and transport
// are deterministic mocks; this is not React/Expo/device/HTTP validation.
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function client() {
  const db = { calls: [], reads: [], checks: [], tokens: new Map(), userId: "user-a" };
  db.event = {
    id: "event-a", creator_id: "user-a", event_type: "friction", category: "communication",
    intensity: 3, shared_topic: "Synthetic shared topic", visibility: "ours", created_at: "2026-11-06T00:00:00Z",
  };
  db.setSession = (userId, token = `${userId}-token`) => {
    db.userId = userId;
    db.session = userId ? { user: { id: userId }, access_token: token } : null;
    if (userId) db.tokens.set(token, { id: userId });
  };
  db.setSession("user-a");
  db.getSession = async () => ({ data: { session: db.session }, error: null });
  db.getUser = async (token) => ({ data: { user: db.tokens.get(token) ?? null }, error: null });
  db.commit = () => { db.event = null; return { data: true, error: null }; };
  db.respond = async () => db.commit();
  db.supabase = {
    auth: {
      getSession: () => db.getSession(),
      getUser: (token) => { db.checks.push(token); return db.getUser(token); },
    },
    from(table) {
      const call = { table, headers: {} };
      return {
        select() { return this; }, eq() { return this; }, maybeSingle() { return this; },
        delete() { assert.fail("Direct table DELETE bypass used"); },
        setHeader(key, value) { call.headers[key] = value; return this; },
        then(resolve, reject) {
          db.reads.push(call);
          const data = table === "relationship_events" ? structuredClone(db.event)
            : table === "event_perspectives" ? [] : null;
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
    },
    rpc(name, args) {
      assert.equal(name, "delete_relationship_event");
      const call = { name, args, headers: {} };
      return {
        setHeader(key, value) { call.headers[key] = value; return this; },
        then(resolve, reject) {
          db.calls.push(call);
          return Promise.resolve().then(() => db.respond(call)).then(resolve, reject);
        },
      };
    },
  };
  return db;
}

function harness(db, currentUserId = "user-a") {
  const slots = [], effects = [], cleanups = [];
  let cursor = 0, tree, focusEffect, focusCleanup, mounted = true;
  const ui = { current: true, navigations: [], invalidations: 0 };
  const memo = (factory, deps) => {
    const index = cursor++;
    const previous = slots[index];
    if (!previous || deps.length !== previous.deps.length || deps.some((v, i) => !Object.is(v, previous.deps[i]))) {
      slots[index] = { deps, value: factory() };
    }
    return slots[index].value;
  };
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (value) => {
        if (mounted) slots[index] = typeof value === "function" ? value(slots[index]) : value;
      }];
    },
    useRef: (value) => memo(() => ({ current: value }), []),
    useCallback: (fn, deps) => memo(() => fn, deps),
    useLayoutEffect: (effect, deps) => {
      const index = cursor;
      memo(() => effects.push(() => { cleanups[index]?.(); cleanups[index] = effect(); }), deps);
    },
  };
  const jsx = (type, props) => ({ type, props });
  const imports = {
    react, "react/jsx-runtime": { jsx, jsxs: jsx },
    "@/lib/supabase": { supabase: db.supabase },
    "@/components/EventRepairSection": { EventRepairSection: "EventRepairSection" },
    "react-native": Object.assign(Object.fromEntries(
      ["Pressable", "ScrollView", "Text", "TextInput", "View"].map((name) => [name, name]),
    ), { StyleSheet: { create: (value) => value } }),
    "expo-router": {
      useRouter: () => ({ back: () => ui.navigations.push("back") }),
      useFocusEffect(effect) {
        focusEffect = effect;
        memo(() => effects.push(() => { focusCleanup?.(); focusCleanup = effect(); }), [effect]);
      },
    },
  };
  // Router identity must be stable, as in the installed SDK; a fresh router
  // object each render would invent focus reload loops absent from the product.
  const router = { back: () => ui.navigations.push("back") };
  imports["expo-router"].useRouter = () => router;
  const filename = path.join(__dirname, "../src/app/event/[id].tsx");
  const source = readFileSync(filename, "utf8") + "\nexport { EventDetailContent };\n";
  const { outputText } = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${outputText}\n})`, { filename })(
    (name) => { assert.ok(Object.hasOwn(imports, name), name); return imports[name]; }, module, module.exports,
  );
  const props = {
    eventId: "event-a", currentUserId, isCurrentAccount: () => ui.current,
    invalidateAccount: () => { ui.current = false; ui.invalidations++; },
  };
  ui.render = () => {
    if (!mounted) return;
    cursor = 0;
    tree = module.exports.EventDetailContent(props);
    while (effects.length) effects.shift()();
  };
  ui.flush = async () => {
    for (let i = 0; i < 8; i++) {
      await new Promise((resolve) => setImmediate(resolve));
      ui.render();
    }
  };
  const text = (node) => {
    if (node == null || typeof node === "boolean") return "";
    if (typeof node !== "object") return String(node);
    return Array.isArray(node) ? node.map(text).join("") : text(node.props?.children);
  };
  const nodes = (node) => !node || typeof node !== "object" ? []
    : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  ui.text = () => text(tree);
  ui.button = (label) => nodes(tree).find((node) => node.type === "Pressable" && text(node) === label);
  ui.press = async (label) => {
    const button = ui.button(label);
    assert.ok(button, `Missing ${label}: ${ui.text()}`);
    assert.ok(!button.props.disabled, `Disabled ${label}`);
    button.props.onPress();
    await ui.flush();
  };
  ui.blur = () => { focusCleanup?.(); };
  ui.refocus = () => { ui.blur(); focusCleanup = focusEffect(); ui.render(); };
  ui.unmount = () => { ui.blur(); cleanups.forEach((cleanup) => cleanup?.()); mounted = false; };
  ui.render();
  return ui;
}

async function setup(t, configure) {
  const db = client();
  configure?.(db);
  const ui = harness(db);
  t.after(ui.unmount);
  await ui.flush();
  await ui.press("Delete moment");
  return { db, ui, confirm: ui.button("Yes, delete permanently") };
}

test("deletion uses the guarded RPC, pins the verified token, and navigates only after true", async (t) => {
  const { db, ui } = await setup(t);
  assert.match(ui.text(), /contributions from your partner/);
  await ui.press("Yes, delete permanently");
  assert.deepEqual(db.calls, [{ name: "delete_relationship_event", args: { p_event_id: "event-a" },
    headers: { Authorization: "Bearer user-a-token" } }]);
  assert.deepEqual(ui.navigations, ["back"]);
});

test("duplicate and retained confirmation handlers dispatch once, including after acknowledgment", async (t) => {
  const pending = deferred();
  const { db, ui, confirm } = await setup(t, (db) => { db.respond = () => pending.promise; });
  confirm.props.onPress(); confirm.props.onPress();
  await ui.flush();
  assert.equal(db.calls.length, 1);
  pending.resolve(db.commit()); await ui.flush();
  confirm.props.onPress(); await ui.flush();
  assert.equal(db.calls.length, 1);
  assert.deepEqual(ui.navigations, ["back"]);
});

for (const response of [null, undefined, false, "true", 1, {}, []]) {
  test(`unusable deletion acknowledgment ${JSON.stringify(response)} blocks retry without success`, async (t) => {
    const { db, ui, confirm } = await setup(t, (db) => {
      db.respond = async () => ({ data: response, error: null });
    });
    await ui.press("Yes, delete permanently");
    assert.match(ui.text(), /couldn't confirm whether this moment was deleted/);
    assert.equal(ui.button("Delete moment").props.disabled, true);
    confirm.props.onPress(); await ui.flush();
    assert.equal(db.calls.length, 1);
    assert.deepEqual(ui.navigations, []);
  });
}

for (const committed of [true, false]) {
  for (const thrown of [true, false]) {
    test(`lost response committed=${committed}, thrown=${thrown}: no retry or false failure`, async (t) => {
      const { db, ui, confirm } = await setup(t, (db) => {
        db.respond = async () => {
          if (committed) db.commit();
          if (thrown) throw new Error("PRIVATE_TRANSPORT_DETAILS");
          return { data: null, error: { message: "PRIVATE_TRANSPORT_DETAILS", code: "" } };
        };
      });
      const reads = db.reads.length;
      await ui.press("Yes, delete permanently");
      assert.match(ui.text(), /couldn't confirm whether this moment was deleted/);
      assert.doesNotMatch(ui.text(), /PRIVATE_|deletion failed|was not deleted|successfully deleted/i);
      confirm.props.onPress(); await ui.flush();
      assert.equal(db.calls.length, 1);
      assert.equal(db.reads.length, reads, "uncertain deletion is not retried or inferred from a read");
      assert.deepEqual(ui.navigations, []);
    });
  }
}

test("reviewed SQL rejection stays generic, hides backend details and never navigates", async (t) => {
  const { db, ui, confirm } = await setup(t, (db) => {
    db.respond = async () => ({ error: { code: "P0001", message: "Event unavailable", details: "PRIVATE", hint: "PRIVATE" } });
  });
  await ui.press("Yes, delete permanently");
  assert.match(ui.text(), /This deletion request was rejected/);
  assert.doesNotMatch(ui.text(), /PRIVATE|successfully deleted/);
  confirm.props.onPress(); await ui.flush();
  assert.equal(db.calls.length, 1);
  assert.deepEqual(ui.navigations, []);
});

for (const failure of ["missing", "foreign", "expired", "session_error", "thrown"]) {
  test(`pre-dispatch authentication ${failure} cannot delete`, async (t) => {
    const { db, ui } = await setup(t);
    if (failure === "missing") db.setSession(null);
    if (failure === "foreign") db.setSession("user-b");
    if (failure === "expired") db.getUser = async () => ({ data: { user: null }, error: { message: "expired" } });
    if (failure === "session_error") db.getSession = async () => ({ data: { session: null }, error: {} });
    if (failure === "thrown") db.getSession = async () => { throw new Error("PRIVATE"); };
    await ui.press("Yes, delete permanently");
    assert.equal(db.calls.length, 0);
    assert.deepEqual(ui.navigations, []);
    assert.equal(ui.invalidations, 1);
  });
}

for (const invalidate of ["account", "blur", "unmount"]) {
  test(`${invalidate} while deletion is pending suppresses stale completion`, async (t) => {
    const pending = deferred();
    const { db, ui, confirm } = await setup(t, (db) => { db.respond = () => pending.promise; });
    confirm.props.onPress(); await ui.flush();
    if (invalidate === "account") { db.setSession("user-b"); ui.current = false; }
    else ui[invalidate]();
    pending.resolve({ data: true, error: null }); await ui.flush();
    assert.equal(db.calls[0].headers.Authorization, "Bearer user-a-token");
    assert.deepEqual(ui.navigations, []);
  });
}

test("account change during preauthorization cannot dispatch an old confirmation", async (t) => {
  const { db, ui, confirm } = await setup(t);
  const pending = deferred();
  db.getUser = () => pending.promise;
  confirm.props.onPress(); await ui.flush();
  ui.current = false; db.setSession("user-b");
  pending.resolve({ data: { user: { id: "user-a" } }, error: null }); await ui.flush();
  assert.equal(db.calls.length, 0);
});

test("same-account token refresh preserves consent and pins the refreshed token", async (t) => {
  const { db, ui } = await setup(t);
  db.setSession("user-a", "refreshed-token");
  await ui.press("Yes, delete permanently");
  assert.equal(db.calls[0].headers.Authorization, "Bearer refreshed-token");
  assert.deepEqual(ui.navigations, ["back"]);
});

test("a silent account replacement after true acknowledgment cannot navigate", async (t) => {
  const { db, ui } = await setup(t, (db) => {
    db.respond = async () => { db.commit(); db.setSession("user-b"); return { data: true, error: null }; };
  });
  await ui.press("Yes, delete permanently");
  assert.deepEqual(ui.navigations, []);
  assert.equal(ui.invalidations, 1);
});

test("verification exception after acknowledged deletion clears the account without false failure", async (t) => {
  const { db, ui } = await setup(t, (db) => {
    db.respond = async () => {
      db.getSession = async () => { throw new Error("PRIVATE_POST_VERIFY"); };
      return db.commit();
    };
  });
  await ui.press("Yes, delete permanently");
  assert.equal(ui.invalidations, 1);
  assert.deepEqual(ui.navigations, []);
  assert.doesNotMatch(ui.text(), /PRIVATE_|deletion failed|was not deleted/i);
});

test("refocus requires new consent and never revives a retained confirmation", async (t) => {
  const { db, ui, confirm } = await setup(t);
  ui.refocus(); await ui.flush();
  confirm.props.onPress(); await ui.flush();
  assert.equal(db.calls.length, 0);
  await ui.press("Delete moment");
  await ui.press("Yes, delete permanently");
  assert.equal(db.calls.length, 1);
});

test("noncreator view has no deletion confirmation", async (t) => {
  const db = client();
  db.event.creator_id = "user-b";
  const ui = harness(db);
  t.after(ui.unmount);
  await ui.flush();
  assert.equal(ui.button("Delete moment"), undefined);
  assert.equal(db.calls.length, 0);
});

test("canceling deletion invalidates a retained confirmation handler", async (t) => {
  const { db, ui, confirm } = await setup(t);
  await ui.press("Cancel");
  confirm.props.onPress(); await ui.flush();
  assert.equal(db.calls.length, 0);
  await ui.press("Delete moment");
  await ui.press("Yes, delete permanently");
  assert.equal(db.calls.length, 1);
});

test("lost response after silent account replacement cannot publish old-account uncertainty", async (t) => {
  const { db, ui } = await setup(t, (db) => {
    db.respond = async () => { db.setSession("user-b"); throw new Error("PRIVATE"); };
  });
  await ui.press("Yes, delete permanently");
  assert.equal(ui.invalidations, 1);
  assert.deepEqual(ui.navigations, []);
  assert.doesNotMatch(ui.text(), /couldn't confirm|PRIVATE/);
});

test("token refresh during a pending deletion retains its original Authorization header", async (t) => {
  const pending = deferred();
  const { db, ui, confirm } = await setup(t, (db) => { db.respond = () => pending.promise; });
  confirm.props.onPress(); await ui.flush();
  db.setSession("user-a", "newer-token");
  pending.resolve(db.commit()); await ui.flush();
  assert.equal(db.calls[0].headers.Authorization, "Bearer user-a-token");
  assert.deepEqual(ui.navigations, ["back"]);
});
