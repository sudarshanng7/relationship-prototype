const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");
const { deferred, harness, loadSource } = require("./helpers/account-screen-harness.cjs");

// Execute the real Home, Stage 1 primitives and bottom navigation with synthetic
// hooks/native hosts. No native rendering, screen reader or live auth is involved.
const jsx = (type, props) => ({ type, props: props ?? {} });
const native = {
  ActivityIndicator: "ActivityIndicator", Button: "Button", Pressable: "Pressable",
  ScrollView: "ScrollView", Text: "Text", TextInput: "TextInput", View: "View",
  StyleSheet: { create: (value) => value },
  Modal: ({ visible, children, ...props }) => visible ? jsx("Modal", { ...props, children }) : null,
};
const safeArea = {
  SafeAreaView: "SafeAreaContextView",
  useSafeAreaInsets: () => ({ top: 32, bottom: 24, left: 0, right: 0 }),
};
const { tokens } = loadSource("src/components/couply-tokens.ts", {});
const primitives = loadSource("src/components/CouplyUI.tsx", {
  "@/components/couply-tokens": { tokens }, react: {},
  "react/jsx-runtime": { jsx, jsxs: jsx },
  "react-native": native, "react-native-safe-area-context": safeArea,
});

async function setup(t, response) {
  const state = { checks: 0, respond: response ?? (async () => ({ data: { user: { id: "test-user" } }, error: null })) };
  const bottomNavigations = [];
  const bottomRouter = { replace: (route) => bottomNavigations.push(route) };
  const nav = loadSource("src/components/AppBottomNav.tsx", {
    "expo-router": { useRouter: () => bottomRouter },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": native, "react-native-safe-area-context": safeArea,
  });
  const db = { supabase: {
    auth: { getUser: () => { state.checks++; return state.respond(); } },
    from: () => assert.fail("Home must not query relationship data"),
    rpc: () => assert.fail("Home must not call RPCs"),
  } };
  const ui = harness(db, "src/app/home.tsx", { imports: {
    "@/components/CouplyUI": primitives, "@/components/couply-tokens": { tokens },
    "@/components/AppBottomNav": nav,
    "react-native": native, "react-native-safe-area-context": safeArea,
  } });
  t.after(ui.unmount);
  await ui.flush();
  return { ui, state, bottomNavigations };
}

for (const [label, scope] of [
  ["Open Mine, your private moments", "mine"],
  ["Open Ours, your shared moments", "ours"],
]) {
  test(`${scope} card opens the existing scoped Moments route`, async (t) => {
    const { ui, state } = await setup(t);
    await ui.tap(label);
    assert.deepEqual(ui.navigations, [{ pathname: "/events", params: { scope } }]);
    assert.equal(state.checks, 1);
  });
}

for (const [label, route] of [["View all moments", "/events"], ["Profile & partner connection", "/profile"]]) {
  test(`${label} preserves the existing destination`, async (t) => {
    const { ui } = await setup(t);
    await ui.tap(label);
    assert.deepEqual(ui.navigations, [route]);
  });
}

for (const [label, type] of [
  ["Record something good", "positive"],
  ["Record something that felt off", "friction"],
]) {
  test(`${type} selection closes the sheet and opens Record Moment without forcing sharing`, async (t) => {
    const { ui, state } = await setup(t);
    assert.equal(ui.find(label), undefined);
    await ui.tap("Record a moment");
    assert.equal(ui.navigations.length, 0);
    assert.ok(ui.nodes().some((node) => node.type === "Modal"));
    await ui.tap(label);
    assert.deepEqual(ui.navigations, [{ pathname: "/record-moment", params: { type } }]);
    assert.equal(ui.nodes().some((node) => node.type === "Modal"), false);
    assert.equal(state.checks, 1);
  });
}

for (const action of ["Not now", "backdrop", "system back", "accessibility escape"]) {
  test(`${action} closes the sheet without navigating and permits reopening`, async (t) => {
    const { ui } = await setup(t);
    await ui.tap("Record a moment");
    if (action === "Not now") await ui.tap("Not now");
    else if (action === "backdrop") await ui.tap("Close moment selection");
    else {
      const node = action === "system back"
        ? ui.nodes().find((node) => node.type === "Modal")
        : ui.nodes().find((node) => node.props.testID === "moment-selection-sheet");
      const handler = action === "system back" ? node.props.onRequestClose : node.props.onAccessibilityEscape;
      handler(); await ui.flush();
    }
    assert.equal(ui.nodes().some((node) => node.type === "Modal"), false);
    assert.equal(ui.navigations.length, 0);
    await ui.tap("Record a moment");
    assert.ok(ui.find("Record something good"));
  });
}

for (const [name, result] of [
  ["signed out", { data: { user: null }, error: null }],
  ["authorization failure", { data: { user: null }, error: { message: "PRIVATE_AUTH_DETAIL" } }],
  ["user returned with authorization error", { data: { user: { id: "test-user" } }, error: { message: "PRIVATE_AUTH_DETAIL" } }],
]) {
  test(`${name} retains the existing redirect and hides Home content`, async (t) => {
    const { ui } = await setup(t, async () => result);
    assert.deepEqual(ui.navigations, ["/"]);
    assert.equal(ui.find("Record a moment"), undefined);
    assert.equal(ui.find("Open Mine, your private moments"), undefined);
    assert.equal(ui.nodes().some((node) => node.type === "Modal"), false);
    assert.doesNotMatch(ui.text(), /PRIVATE_AUTH_DETAIL|Two spaces, your choice/);
  });
}

test("pending authorization shows only loading until the existing check succeeds", async (t) => {
  const reply = deferred();
  const { ui } = await setup(t, () => reply.promise);
  assert.match(ui.text(), /Loading your space/);
  assert.equal(ui.find("Record a moment"), undefined);
  reply.resolve({ data: { user: { id: "test-user" } }, error: null });
  await ui.flush();
  assert.ok(ui.find("Record a moment"));
  assert.deepEqual(ui.navigations, []);
});

for (const result of [
  { data: { user: { id: "old-user" } }, error: null },
  { data: { user: null }, error: null },
]) {
  test(`focus cleanup ignores late authorization with user=${Boolean(result.data.user)}`, async (t) => {
    const reply = deferred();
    const { ui } = await setup(t, () => reply.promise);
    await ui.blur();
    reply.resolve(result); await ui.flush();
    assert.equal(ui.find("Record a moment"), undefined);
    assert.deepEqual(ui.navigations, []);
  });
}

test("refocus closes the old sheet and rechecks authorization without adding relationship reads", async (t) => {
  const { ui, state } = await setup(t);
  await ui.tap("Record a moment");
  await ui.blur();
  const reply = deferred(); state.respond = () => reply.promise;
  const focusing = ui.focus();
  await ui.flush();
  assert.equal(ui.nodes().some((node) => node.type === "Modal"), false);
  assert.equal(ui.find("Record a moment"), undefined);
  reply.resolve({ data: { user: { id: "test-user" } }, error: null });
  await focusing; await ui.flush();
  assert.equal(state.checks, 2);
  assert.ok(ui.find("Record a moment"));
  assert.equal(ui.nodes().some((node) => node.type === "Modal"), false);
});

test("Home retains branding and neutral connection copy without claiming any saved relationship activity", async (t) => {
  const { ui } = await setup(t);
  assert.match(ui.text(), /RELATIONSHIP OS/);
  assert.match(ui.text(), /Your space is here for your own reflections and the moments you choose to share\./);
  assert.doesNotMatch(ui.text(), /You can begin on your own|Connect with a partner whenever/);
  assert.match(ui.text(), /Private reflections stay private/);
  const unsupported = /My Rhythm|Couply|Alex|Sam|\d+ (private reflections|shared moments)|No moments yet|Connected|reconnected|repair journey|remind|challenge|invitation|your week|photo/i;
  assert.doesNotMatch(ui.text(), unsupported);
  await ui.tap("Record a moment");
  assert.doesNotMatch(ui.text(), unsupported);
});

test("safe-area and scrolling composition leaves the existing bottom navigation outside the content column", async (t) => {
  const { ui, bottomNavigations } = await setup(t);
  const root = ui.nodes()[0];
  assert.equal(root.type, "SafeAreaContextView");
  assert.deepEqual(root.props.edges, ["top", "left", "right"]);
  const children = root.props.children;
  assert.equal(children[0].type, "ScrollView");
  assert.equal(children[1].type, "View");
  assert.equal(ui.find("Home").props.accessibilityState.selected, true);
  await ui.tap("Our Space");
  await ui.tap("Moments");
  await ui.tap("Settings");
  assert.deepEqual(bottomNavigations, [
    { pathname: "/events", params: { scope: "ours" } },
    { pathname: "/events", params: { scope: "all" } },
    "/profile",
  ]);
  assert.deepEqual(ui.navigations, []);
});

test("Home source keeps a single auth read and no legacy, simulated, or relationship-data paths", () => {
  const file = path.join(__dirname, "../src/app/home.tsx");
  const source = readFileSync(file, "utf8");
  assert.doesNotMatch(source, /relationship_events|repair_method|reconnected_at|\.from\s*\(|\.rpc\s*\(/);
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const allowed = new Set(["@/components/AppBottomNav", "@/components/CouplyUI", "@/components/couply-tokens",
    "@/lib/supabase", "expo-router", "react", "react-native", "react-native-safe-area-context"]);
  let authReads = 0;
  function visit(node) {
    if (ts.isImportDeclaration(node)) assert.ok(allowed.has(node.moduleSpecifier.text));
    if (ts.isCallExpression(node) && node.expression.getText(ast).startsWith("supabase.")) {
      assert.equal(node.expression.getText(ast), "supabase.auth.getUser"); authReads++;
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(authReads, 1);
});
