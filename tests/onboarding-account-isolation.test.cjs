const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const onboarding = "src/app/onboarding.tsx";
function loadSource(file, imports, source = readFileSync(path.join(root, file), "utf8")) {
  const { outputText } = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const module = { exports: {} };
  vm.runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename: file })(
    (name) => {
      assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`);
      return imports[name];
    }, module, module.exports,
  );
  return module.exports;
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function client() {
  const db = {
    session: null, listeners: new Set(), tokens: new Map(), reads: [], writes: [], checks: [],
    profiles: new Map([
      ["a", { id: "a", display_name: "Alice", onboarding_completed: false }],
      ["b", { id: "b", display_name: "Bob", onboarding_completed: false }],
    ]),
  };
  db.sessionFor = (id, token = `${id}-token`) => {
    if (!id) return null;
    const user = { id, email: `${id}@example.invalid` };
    db.tokens.set(token, user);
    return { user, access_token: token };
  };
  db.session = db.sessionFor("a");
  db.emit = (id, event = id ? "SIGNED_IN" : "SIGNED_OUT", token) => {
    db.session = db.sessionFor(id, token);
    for (const listener of db.listeners) listener(event, db.session);
  };
  db.getSession = async () => ({ data: { session: db.session }, error: null });
  db.getUser = async (token) => ({
    data: { user: token ? db.tokens.get(token) : db.session?.user }, error: null,
  });
  db.read = async (call) => ({ data: structuredClone(db.profiles.get(call.id)), error: null });
  db.commit = (call) => {
    Object.assign(db.profiles.get(call.id), call.values);
    return { data: { id: call.id }, error: null };
  };
  db.write = async (call) => db.commit(call);
  db.supabase = {
    auth: {
      onAuthStateChange(listener) {
        db.listeners.add(listener);
        queueMicrotask(() => {
          if (db.listeners.has(listener)) listener("INITIAL_SESSION", db.session);
        });
        return { data: { subscription: { unsubscribe: () => db.listeners.delete(listener) } } };
      },
      getSession: () => db.getSession(),
      getUser: (token) => { db.checks.push(token); return db.getUser(token); },
    },
    from(table) {
      assert.equal(table, "profiles");
      const call = { table, operation: "read", headers: {} };
      return {
        select(columns) { call.columns = columns; return this; },
        update(values) { call.operation = "write"; call.values = values; return this; },
        eq(column, value) { assert.equal(column, "id"); call.id = value; return this; },
        maybeSingle() { return this; }, single() { return this; },
        setHeader(key, value) { call.headers[key] = value; return this; },
        then(resolve, reject) {
          (call.operation === "write" ? db.writes : db.reads).push(call);
          return Promise.resolve().then(() => db[call.operation](call)).then(resolve, reject);
        },
      };
    },
  };
  return db;
}

// Same no-dependency approach as repair-states.test.cjs, extended to reconcile
// keyed children, contexts, layout/passive cleanup and focus effects. Execute
// the real screen AND AccountSessionBoundary; no authorization helpers mocked.
// This deterministic hook/host harness is not a React renderer/device test.
function harness(db, source) {
  const instances = new Map();
  const contexts = new Map();
  let current, cursor, tree, mounted = true, focused = true;
  let layout = [], passive = [];
  const ui = { navigations: [], mounts: new Map() };
  const depsEqual = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const memo = (factory, deps) => {
    const index = cursor++;
    const previous = current.hooks[index];
    if (!previous || !depsEqual(previous.deps, deps)) {
      current.hooks[index] = { value: factory(), deps };
    }
    return current.hooks[index].value;
  };
  const effect = (queue, callback, deps) => {
    const instance = current;
    const index = cursor++;
    const previous = instance.hooks[index];
    if (previous && depsEqual(previous.deps, deps)) return;
    const hook = { deps, cleanup: previous?.cleanup };
    instance.hooks[index] = hook;
    queue.push(() => {
      hook.cleanup?.();
      hook.cleanup = instance.active ? callback() : undefined;
    });
  };
  const react = {
    useState(initial) {
      const index = cursor++;
      const instance = current;
      if (!instance.hooks[index]) instance.hooks[index] = {
        value: typeof initial === "function" ? initial() : initial,
      };
      return [instance.hooks[index].value, (value) => {
        if (instance.active) instance.hooks[index].value = typeof value === "function"
          ? value(instance.hooks[index].value) : value;
      }];
    },
    useRef: (value) => memo(() => ({ current: value }), []),
    useMemo: memo, useCallback: (callback, deps) => memo(() => callback, deps),
    useEffect: (callback, deps) => effect(passive, callback, deps),
    useLayoutEffect: (callback, deps) => effect(layout, callback, deps),
    createContext(value) {
      const context = { value };
      context.Provider = { context };
      return context;
    },
    useContext: (context) => contexts.has(context) ? contexts.get(context) : context.value,
  };
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const router = { replace: (route) => ui.navigations.push(route) };
  const imports = {
    "@/lib/supabase": { supabase: db.supabase }, react,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": {
      ActivityIndicator: "ActivityIndicator", Button: "Button", ScrollView: "ScrollView",
      Text: "Text", TextInput: "TextInput", View: "View", StyleSheet: { create: (v) => v },
    },
    "expo-router": {
      useRouter: () => router,
      useFocusEffect: (callback) => react.useEffect(() => focused ? callback() : undefined, [callback, focused]),
    },
  };
  imports["@/components/AccountSessionBoundary"] = loadSource("src/components/AccountSessionBoundary.tsx", imports);
  // Allows running the very same isolation assertion against the base source
  // as an expected-failure negative control, without changing repository code.
  const componentSource = source ?? (process.env.FINDING7_COMPONENT_SOURCE
    ? readFileSync(process.env.FINDING7_COMPONENT_SOURCE, "utf8") : undefined);
  const Screen = loadSource(onboarding, imports, componentSource).default;
  const cleanup = (instance) => {
    instance.active = false;
    instance.hooks.forEach((hook) => hook?.cleanup?.());
  };
  function resolve(node, location, visited) {
    if (!node || typeof node !== "object") return node;
    if (Array.isArray(node)) return node.map((item, index) => resolve(item, `${location}:${index}`, visited));
    const key = `${location}/${node.key ?? "default"}`;
    if (node.type?.context) {
      const context = node.type.context;
      const previous = contexts.get(context);
      contexts.set(context, node.props.value);
      const result = resolve(node.props.children, key, visited);
      contexts.set(context, previous);
      return result;
    }
    if (typeof node.type === "function") {
      let instance = instances.get(key);
      if (!instance || instance.type !== node.type) {
        if (instance) cleanup(instance);
        instance = { type: node.type, hooks: [], active: true };
        instances.set(key, instance);
        ui.mounts.set(node.type.name, (ui.mounts.get(node.type.name) ?? 0) + 1);
      }
      visited.add(key);
      const parent = current, parentCursor = cursor;
      current = instance; cursor = 0;
      const child = node.type(node.props);
      current = parent; cursor = parentCursor;
      return resolve(child, key, visited);
    }
    return { ...node, props: { ...node.props, children: resolve(node.props.children, key, visited) } };
  }
  ui.render = () => {
    if (!mounted) return;
    const visited = new Set();
    tree = resolve(jsx(Screen), "root", visited);
    for (const [key, instance] of instances) {
      if (!visited.has(key)) { cleanup(instance); instances.delete(key); }
    }
    while (layout.length) layout.shift()();
    while (passive.length) passive.shift()();
  };
  ui.flush = async () => {
    for (let i = 0; i < 12; i++) {
      await new Promise((resolve) => setImmediate(resolve));
      ui.render();
    }
  };
  const nodes = (node) => {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    return [node, ...nodes(node.props?.children)];
  };
  const text = (node) => {
    if (node == null || typeof node === "boolean") return "";
    if (typeof node !== "object") return String(node);
    return Array.isArray(node) ? node.map(text).join("") : text(node.props?.children);
  };
  ui.text = () => text(tree);
  ui.input = () => nodes(tree).find((node) => node.type === "TextInput");
  ui.button = (title) => nodes(tree).find((node) => node.type === "Button" && node.props.title === title);
  ui.changeName = (name) => {
    assert.equal(ui.input()?.props.editable, true);
    ui.input().props.onChangeText(name); ui.render();
  };
  ui.press = async (title) => {
    const button = ui.button(title);
    assert.ok(button, `Missing ${title}: ${ui.text()}`);
    assert.ok(!button.props.disabled, `Disabled ${title}`);
    button.props.onPress(); await ui.flush();
  };
  ui.switchAccount = async (id, event, token) => { db.emit(id, event, token); await ui.flush(); };
  ui.blur = async () => { focused = false; ui.render(); await ui.flush(); };
  ui.focus = async () => { focused = true; ui.render(); await ui.flush(); };
  ui.unmount = () => { mounted = false; instances.forEach(cleanup); instances.clear(); tree = null; };
  ui.render();
  return ui;
}

async function setup(t, configure, source) {
  const db = client();
  configure?.(db);
  const ui = harness(db, source);
  t.after(ui.unmount);
  await ui.flush();
  return { db, ui };
}

async function accountSwitchScenario(t, source) {
  const { db, ui } = await setup(t, undefined, source);
  assert.equal(ui.input().props.value, "Alice");
  ui.changeName("A private draft");
  await ui.switchAccount("b");
  return { db, ui };
}

test("Finding 7 negative control: base component writes A's retained draft under B", async (t) => {
  // Exact b6207fe source snapshot; no git history/subprocess needed in CI.
  const source = readFileSync(path.join(__dirname, "fixtures/onboarding-before-finding7.tsx.txt"), "utf8");
  const { db, ui } = await accountSwitchScenario(t, source);
  assert.equal(ui.input().props.value, "A private draft", "original privacy defect reproduced");
  await ui.press("Continue");
  assert.equal(db.writes[0].id, "b");
  assert.equal(db.writes[0].values.display_name, "A private draft");
  assert.deepEqual(db.writes[0].headers, {});
  assert.equal(ui.mounts.get("OnboardingScreen"), 1);
});

test("Finding 7: mounted A-to-B switch clears A's draft and submits only B's own profile", async (t) => {
  const { db, ui } = await accountSwitchScenario(t);
  assert.equal(ui.input().props.value, "Bob");
  assert.equal(ui.button("Continue").props.disabled, false);
  assert.equal(ui.text().includes("A private draft"), false);
  assert.deepEqual(db.reads.map((call) => [call.id, call.headers.Authorization]), [
    ["a", "Bearer a-token"], ["b", "Bearer b-token"],
  ]);
  ui.changeName("  B preferred name  ");
  await ui.press("Continue");
  assert.equal(db.writes.length, 1);
  assert.equal(db.writes[0].id, "b");
  assert.equal(db.writes[0].values.display_name, "B preferred name");
  assert.equal(db.writes[0].values.onboarding_completed, true);
  assert.equal(db.writes[0].headers.Authorization, "Bearer b-token");
  assert.deepEqual(ui.navigations, ["/profile"]);
  assert.equal(ui.mounts.get("OnboardingScreen"), 1, "route itself stayed mounted");
  assert.equal(ui.mounts.get("AccountSessionBoundary"), 1);
  assert.equal(ui.mounts.get("OnboardingContent"), 2, "only account content reset");
});

test("Finding 7: account change hides private state while B verification is pending", async (t) => {
  const { db, ui } = await setup(t);
  ui.changeName("A private draft");
  const pending = deferred();
  db.getUser = (token) => token === "b-token" ? pending.promise : Promise.resolve({ data: { user: db.tokens.get(token) } });
  await ui.switchAccount("b");
  assert.equal(ui.input(), undefined);
  assert.equal(ui.text().includes("A private draft"), false);
  assert.equal(db.reads.length, 1);
  pending.resolve({ data: { user: db.tokens.get("b-token") } });
  await ui.flush();
  assert.equal(ui.input().props.value, "Bob");
});

test("Finding 7: account change while pre-write authorization is pending cannot dispatch A's draft", async (t) => {
  const { db, ui } = await setup(t);
  ui.changeName("A private draft");
  const pending = deferred();
  const getUser = db.getUser;
  db.getUser = (token) => token === "a-token" ? pending.promise : getUser(token);
  await ui.press("Continue");
  assert.equal(db.writes.length, 0);
  await ui.switchAccount("b");
  pending.resolve({ data: { user: db.tokens.get("a-token") } });
  await ui.flush();
  assert.equal(ui.input().props.value, "Bob");
  assert.equal(ui.button("Continue").props.disabled, false);
  assert.equal(db.writes.length, 0);
  assert.deepEqual(ui.navigations, []);
});

for (const operation of ["read", "write"]) {
  test(`Finding 7: account change during post-${operation} verification cannot publish A state`, async (t) => {
    const db = client();
    const pending = deferred();
    const getUser = db.getUser;
    let verifying = false;
    db.getUser = (token) => token === "a-token" && verifying ? pending.promise : getUser(token);
    if (operation === "read") {
      const read = db.read;
      db.read = (call) => { if (call.id === "a") verifying = true; return read(call); };
    } else {
      db.write = async (call) => { verifying = true; return db.commit(call); };
    }
    const ui = harness(db);
    t.after(ui.unmount);
    await ui.flush();
    if (operation === "write") await ui.press("Continue");
    await ui.switchAccount("b");
    assert.equal(ui.input().props.value, "Bob");
    pending.resolve({ data: { user: db.tokens.get("a-token") } });
    await ui.flush();
    assert.equal(ui.input().props.value, "Bob");
    assert.deepEqual(ui.navigations, []);
    assert.equal(ui.text().includes("Your setup was saved"), false);
  });
}

for (const completed of [false, true]) {
  test(`Finding 7: stale A initial read (completed=${completed}) cannot publish or navigate for B`, async (t) => {
    const pending = deferred();
    const { db, ui } = await setup(t, (db) => {
      const read = db.read;
      db.read = (call) => call.id === "a" ? pending.promise : read(call);
    });
    assert.equal(ui.input(), undefined);
    await ui.switchAccount("b");
    assert.equal(ui.input().props.value, "Bob");
    pending.resolve({ data: { id: "a", display_name: "OLD PRIVATE NAME", onboarding_completed: completed } });
    await ui.flush();
    assert.equal(ui.input().props.value, "Bob");
    assert.deepEqual(ui.navigations, []);
    assert.equal(db.writes.length, 0);
  });
}

for (const outcome of ["success", "error", "throw"]) {
  test(`Finding 7: pending A update ${outcome} stays pinned and cannot affect B`, async (t) => {
    const { db, ui } = await setup(t);
    ui.changeName("A pending draft");
    const pending = deferred();
    db.write = () => pending.promise;
    await ui.press("Continue");
    assert.equal(db.writes.length, 1);
    assert.equal(db.writes[0].id, "a");
    assert.equal(db.writes[0].values.display_name, "A pending draft");
    assert.equal(db.writes[0].headers.Authorization, "Bearer a-token");
    await ui.switchAccount("b");
    assert.equal(ui.input().props.value, "Bob");
    assert.equal(ui.button("Continue").props.disabled, false);
    if (outcome === "throw") pending.reject(new Error("PRIVATE_A_ERROR"));
    else pending.resolve(outcome === "success" ? db.commit(db.writes[0]) : { error: { message: "PRIVATE_A_ERROR" } });
    await ui.flush();
    assert.equal(ui.input().props.value, "Bob");
    assert.equal(ui.text().includes("PRIVATE_A_ERROR"), false);
    assert.equal(ui.text().includes("couldn't confirm"), false);
    assert.deepEqual(ui.navigations, []);
    db.write = async (call) => db.commit(call);
    await ui.press("Continue");
    assert.equal(db.writes.length, 2);
    assert.equal(db.writes[1].id, "b");
    assert.equal(db.writes[1].values.display_name, "Bob");
    assert.equal(db.writes[1].headers.Authorization, "Bearer b-token");
    assert.deepEqual(ui.navigations, ["/profile"]);
  });
}

test("Finding 7: synchronous Continue guard prevents duplicates during auth and transport", async (t) => {
  const { db, ui } = await setup(t);
  const authPending = deferred(), writePending = deferred();
  db.getUser = () => authPending.promise;
  db.write = () => writePending.promise;
  const press = ui.button("Continue").props.onPress;
  press(); press(); press();
  await ui.flush();
  assert.equal(db.writes.length, 0);
  authPending.resolve({ data: { user: db.session.user } });
  await ui.flush();
  assert.equal(db.writes.length, 1);
  press(); press(); await ui.flush();
  assert.equal(db.writes.length, 1);
  writePending.resolve(db.commit(db.writes[0]));
  await ui.flush();
  press(); await ui.flush();
  assert.equal(db.writes.length, 1, "acknowledged writes also block retained handlers");
  assert.deepEqual(ui.navigations, ["/profile"]);
});

test("Finding 7: same-account refresh/repeated sign-in preserves draft and uses the fresh token", async (t) => {
  const { db, ui } = await setup(t);
  ui.changeName("Keep my draft");
  await ui.switchAccount("a", "TOKEN_REFRESHED", "refreshed-a-token");
  await ui.switchAccount("a", "SIGNED_IN", "refreshed-a-token");
  assert.equal(ui.input().props.value, "Keep my draft");
  assert.equal(db.reads.length, 1);
  assert.equal(ui.mounts.get("OnboardingContent"), 1);
  await ui.press("Continue");
  assert.equal(db.writes[0].headers.Authorization, "Bearer refreshed-a-token");
  assert.equal(db.writes[0].values.display_name, "Keep my draft");
});

test("Finding 7: sign-out invalidates draft and retained submission immediately", async (t) => {
  const { db, ui } = await setup(t);
  ui.changeName("Signed-out private draft");
  const press = ui.button("Continue").props.onPress;
  db.emit(null);
  press(); // Before React gets a render: scope ref already invalidated.
  await ui.flush();
  assert.equal(ui.input(), undefined);
  assert.equal(db.writes.length, 0);
  assert.deepEqual(ui.navigations, ["/"]);
  await ui.switchAccount("a");
  assert.equal(ui.input().props.value, "Alice");
});

test("Finding 7: sign-out during update suppresses completion and clears saving state", async (t) => {
  const { db, ui } = await setup(t);
  const pending = deferred();
  db.write = () => pending.promise;
  await ui.press("Continue");
  await ui.switchAccount(null);
  pending.resolve(db.commit(db.writes[0]));
  await ui.flush();
  assert.equal(ui.input(), undefined);
  assert.deepEqual(ui.navigations, ["/"]);
  await ui.switchAccount("b");
  assert.equal(ui.button("Continue").props.disabled, false);
});

test("Finding 7: returning to A after B cannot revive A's earlier pending write generation", async (t) => {
  const { db, ui } = await setup(t);
  const pending = deferred();
  db.write = () => pending.promise;
  ui.changeName("Earlier A visit");
  await ui.press("Continue");
  await ui.switchAccount("b");
  await ui.switchAccount("a", "SIGNED_IN", "new-a-token");
  ui.changeName("Current A visit");
  pending.resolve(db.commit(db.writes[0]));
  await ui.flush();
  assert.equal(ui.input().props.value, "Current A visit");
  assert.deepEqual(ui.navigations, []);
  assert.equal(db.writes.length, 1);
  assert.equal(db.writes[0].headers.Authorization, "Bearer a-token");
});

test("Finding 7: token refresh during an in-flight save keeps its pinned identity and current draft", async (t) => {
  const { db, ui } = await setup(t);
  const pending = deferred();
  db.write = () => pending.promise;
  ui.changeName("Draft during refresh");
  await ui.press("Continue");
  await ui.switchAccount("a", "TOKEN_REFRESHED", "refreshed-a-token");
  assert.equal(ui.input().props.value, "Draft during refresh");
  assert.equal(ui.button("Saving...").props.disabled, true);
  assert.equal(ui.mounts.get("OnboardingContent"), 1);
  pending.resolve(db.commit(db.writes[0]));
  await ui.flush();
  assert.deepEqual(ui.navigations, ["/profile"]);
  assert.equal(db.writes.length, 1);
  assert.equal(db.writes[0].headers.Authorization, "Bearer a-token");
  assert.equal(db.checks.at(-1), "refreshed-a-token");
});

for (const failure of ["missing", "session-error", "expired", "verification-throws", "mismatch", "silent-switch"]) {
  test(`Finding 7: ${failure} session at submission cannot dispatch a write`, async (t) => {
    const { db, ui } = await setup(t);
    if (failure === "missing") db.session = null;
    if (failure === "session-error") db.getSession = async () => ({ error: { message: "INTERNAL_SESSION" } });
    if (failure === "expired") db.getUser = async () => ({ data: { user: null }, error: { message: "EXPIRED_TOKEN" } });
    if (failure === "verification-throws") db.getUser = async () => { throw new Error("INTERNAL_AUTH"); };
    if (failure === "mismatch") db.getUser = async () => ({ data: { user: { id: "b" } } });
    if (failure === "silent-switch") db.session = db.sessionFor("b");
    await ui.press("Continue");
    assert.equal(db.writes.length, 0);
    assert.equal(ui.input(), undefined);
    assert.equal(ui.text().includes("INTERNAL"), false);
    assert.equal(ui.text().includes("EXPIRED_TOKEN"), false);
    if (["missing", "mismatch", "silent-switch"].includes(failure)) assert.deepEqual(ui.navigations, ["/"]);
    else assert.match(ui.text(), /Could not verify your session/);
  });
}

test("Finding 7: unavailable session during initial load cannot read or write", async (t) => {
  const { db, ui } = await setup(t, (db) => { db.session = null; });
  assert.equal(ui.input(), undefined);
  assert.equal(db.reads.length, 0);
  assert.equal(db.writes.length, 0);
  assert.deepEqual(ui.navigations, ["/"]);
});

test("Finding 7: failed initial verification cannot read profiles or expose an editable draft", async (t) => {
  const { db, ui } = await setup(t, (db) => {
    db.getUser = async () => ({ data: { user: null }, error: { message: "PRIVATE_AUTH_DETAIL" } });
  });
  assert.equal(db.reads.length, 0);
  assert.equal(db.writes.length, 0);
  assert.equal(ui.input(), undefined);
  assert.match(ui.text(), /Could not verify your session/);
  assert.equal(ui.text().includes("PRIVATE_AUTH_DETAIL"), false);
});

test("Finding 7: sign-out during initial read cannot restore private state", async (t) => {
  const pending = deferred();
  const { db, ui } = await setup(t, (db) => { db.read = () => pending.promise; });
  await ui.switchAccount(null);
  pending.resolve({ data: { id: "a", display_name: "PRIVATE_A_NAME", onboarding_completed: true } });
  await ui.flush();
  assert.equal(ui.input(), undefined);
  assert.deepEqual(ui.navigations, ["/"]);
  assert.equal(db.writes.length, 0);
});

test("Finding 7: verification failure hides data; Retry reloads without a write", async (t) => {
  const { db, ui } = await setup(t);
  ui.changeName("Private draft");
  const getUser = db.getUser;
  db.getUser = async () => ({ data: { user: null }, error: { message: "offline" } });
  await ui.press("Continue");
  assert.equal(ui.input(), undefined);
  assert.match(ui.text(), /Private data has been cleared/);
  db.getUser = getUser;
  await ui.press("Retry");
  assert.equal(ui.input().props.value, "Alice");
  assert.equal(db.writes.length, 0);
});

for (const committed of [false, true]) {
  test(`Finding 7: lost save response (committed=${committed}) requires read-only reload`, async (t) => {
    const { db, ui } = await setup(t);
    ui.changeName("Possibly saved");
    db.write = async (call) => {
      if (committed) db.commit(call);
      throw new Error("PRIVATE_TRANSPORT_DETAIL");
    };
    const press = ui.button("Continue").props.onPress;
    await ui.press("Continue");
    assert.equal(db.writes.length, 1);
    assert.match(ui.text(), /couldn't confirm whether your setup was saved/);
    assert.equal(ui.text().includes("PRIVATE_TRANSPORT_DETAIL"), false);
    assert.equal(ui.input().props.value, "Possibly saved");
    assert.equal(ui.button("Continue").props.disabled, true);
    press(); await ui.flush();
    assert.equal(db.writes.length, 1);
    assert.deepEqual(ui.navigations, []);
    await ui.press("Reload setup");
    assert.equal(db.reads.length, 2);
    assert.equal(db.writes.length, 1, "reload never repeats the mutation");
    if (committed) assert.deepEqual(ui.navigations, ["/profile"]);
    else {
      assert.equal(ui.input().props.value, "Alice");
      assert.equal(ui.button("Continue").props.disabled, false);
    }
  });
}

for (const response of [{ data: null }, { data: { id: "b" } }, { error: { message: "PRIVATE_DB_DETAIL" } }]) {
  test(`Finding 7: unacknowledged save ${JSON.stringify(response)} cannot claim success or retry`, async (t) => {
    const { db, ui } = await setup(t);
    db.write = async () => response;
    await ui.press("Continue");
    assert.match(ui.text(), /couldn't confirm/);
    assert.equal(ui.button("Continue").props.disabled, true);
    assert.equal(ui.text().includes("PRIVATE_DB_DETAIL"), false);
    assert.deepEqual(ui.navigations, []);
    assert.equal(db.writes.length, 1);
  });
}

test("Finding 7: acknowledged save followed by failed verification keeps acknowledgment on read-only Retry", async (t) => {
  const { db, ui } = await setup(t);
  const getUser = db.getUser;
  db.write = async (call) => {
    const result = db.commit(call);
    db.getUser = async () => ({ data: { user: null }, error: { message: "offline" } });
    return result;
  };
  await ui.press("Continue");
  assert.match(ui.text(), /Your setup was saved\./);
  assert.deepEqual(ui.navigations, []);
  db.getUser = getUser;
  await ui.press("Retry");
  assert.deepEqual(ui.navigations, ["/profile"]);
  assert.equal(db.writes.length, 1);
});

test("Finding 7: post-read verification precedes publishing names or completed-profile navigation", async (t) => {
  const { db, ui } = await setup(t, (db) => {
    db.read = async () => {
      db.session = db.sessionFor("b"); // identity changed without callback yet
      return { data: { id: "a", display_name: "PRIVATE_A_NAME", onboarding_completed: true } };
    };
  });
  assert.equal(ui.input(), undefined);
  assert.equal(ui.text().includes("PRIVATE_A_NAME"), false);
  assert.deepEqual(ui.navigations, ["/"]);
  assert.equal(db.writes.length, 0);
});

test("Finding 7: post-save verification prevents navigation after a silent account change", async (t) => {
  const { db, ui } = await setup(t);
  db.write = async (call) => {
    const result = db.commit(call);
    db.session = db.sessionFor("b");
    return result;
  };
  await ui.press("Continue");
  assert.deepEqual(ui.navigations, ["/"]);
  assert.equal(ui.input(), undefined);
  assert.equal(db.writes[0].id, "a");
  assert.equal(db.writes[0].headers.Authorization, "Bearer a-token");
});

test("Finding 7: thrown save response rechecks identity before publishing uncertainty", async (t) => {
  const { db, ui } = await setup(t);
  db.write = async () => {
    db.session = db.sessionFor("b");
    throw new Error("lost response");
  };
  await ui.press("Continue");
  assert.equal(ui.input(), undefined);
  assert.equal(ui.text().includes("couldn't confirm"), false);
  assert.deepEqual(ui.navigations, ["/"]);
});

test("Finding 7: an old acknowledgment notice cannot cross into another account after verification fails", async (t) => {
  const { db, ui } = await setup(t);
  const getUser = db.getUser;
  db.write = async (call) => {
    const result = db.commit(call);
    db.getUser = async () => ({ data: { user: null }, error: { message: "offline" } });
    return result;
  };
  await ui.press("Continue");
  assert.match(ui.text(), /Your setup was saved/);
  db.getUser = getUser;
  await ui.switchAccount("b");
  assert.equal(ui.input().props.value, "Bob");
  assert.equal(ui.text().includes("Your setup was saved"), false);
  assert.equal(ui.text().includes("Could not verify"), false);
  assert.deepEqual(ui.navigations, []);
});

test("Finding 7: failed uncertain-outcome reload cannot unlock another write", async (t) => {
  const { db, ui } = await setup(t);
  db.write = async () => { throw new Error("response lost"); };
  const press = ui.button("Continue").props.onPress;
  await ui.press("Continue");
  db.read = async () => { throw new Error("read offline"); };
  await ui.press("Reload setup");
  assert.equal(ui.button("Continue").props.disabled, true);
  press(); await ui.flush();
  assert.equal(db.writes.length, 1);
  assert.deepEqual(ui.navigations, []);
});

test("Finding 7: B cannot inherit A's uncertain-save error and lock", async (t) => {
  const { db, ui } = await setup(t);
  db.write = async () => { throw new Error("response lost"); };
  await ui.press("Continue");
  assert.match(ui.text(), /couldn't confirm/);
  await ui.switchAccount("b");
  assert.equal(ui.input().props.value, "Bob");
  assert.equal(ui.button("Continue").props.disabled, false);
  assert.equal(ui.button("Reload setup"), undefined);
  assert.equal(ui.text().includes("couldn't confirm"), false);
});

test("Finding 7: optional blank name saves null and preserves Mine/Ours explanation", async (t) => {
  const { db, ui } = await setup(t);
  ui.changeName("   ");
  assert.match(ui.text(), /A private moment stays visible only to you\. It won't be shared with your partner\./);
  assert.match(ui.text(), /A shared moment can be seen by your connected partner\./);
  assert.match(ui.text(), /You can continue without adding a name\./);
  await ui.press("Continue");
  assert.equal(db.writes[0].values.display_name, null);
  assert.deepEqual(ui.navigations, ["/profile"]);
});

test("Finding 7: completed profile is verified and navigates without a write", async (t) => {
  const { db, ui } = await setup(t, (db) => { db.profiles.get("a").onboarding_completed = true; });
  assert.deepEqual(ui.navigations, ["/profile"]);
  assert.equal(db.checks.length, 2);
  assert.equal(db.reads[0].id, "a");
  assert.equal(db.reads[0].headers.Authorization, "Bearer a-token");
  assert.equal(db.writes.length, 0);
});

for (const response of [
  { data: null }, { data: { id: "b", display_name: "PRIVATE_B_NAME" } },
  { error: { message: "PRIVATE_LOAD_DETAIL" } },
]) {
  test(`Finding 7: invalid profile read ${JSON.stringify(response)} blocks Continue until reload`, async (t) => {
    const { db, ui } = await setup(t, (db) => { db.read = async () => response; });
    assert.equal(ui.input().props.value, "");
    assert.equal(ui.input().props.editable, false);
    assert.equal(ui.button("Continue").props.disabled, true);
    assert.match(ui.text(), /Could not load your setup/);
    assert.equal(ui.text().includes("PRIVATE_"), false);
    db.read = async (call) => ({ data: db.profiles.get(call.id) });
    await ui.press("Reload setup");
    assert.equal(ui.input().props.value, "Alice");
    assert.equal(db.writes.length, 0);
  });
}

for (const operation of ["read", "write"]) {
  test(`Finding 7: blur/refocus invalidates pending ${operation} generation`, async (t) => {
    const pending = deferred();
    const { db, ui } = await setup(t, operation === "read" ? (db) => { db.read = () => pending.promise; } : undefined);
    if (operation === "write") {
      db.write = () => pending.promise;
      await ui.press("Continue");
    }
    await ui.blur();
    db.read = async (call) => ({ data: db.profiles.get(call.id) });
    await ui.focus();
    assert.equal(ui.input().props.value, "Alice");
    pending.resolve({ data: operation === "write" ? { id: "a" }
      : { id: "a", display_name: "STALE", onboarding_completed: true } });
    await ui.flush();
    assert.equal(ui.input().props.value, "Alice");
    assert.deepEqual(ui.navigations, []);
    assert.equal(ui.button("Continue").props.disabled, false);
  });
}
