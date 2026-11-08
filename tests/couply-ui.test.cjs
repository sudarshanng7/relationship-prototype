const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");
const { loadSource } = require("./helpers/account-screen-harness.cjs");

// Real presentation functions with deterministic host substitutes. These tests
// verify interaction/prop contracts, not native rendering or screen readers.
const jsx = (type, props) => ({ type, props: props ?? {} });
const { tokens } = loadSource("src/components/couply-tokens.ts", {});
const ui = loadSource("src/components/CouplyUI.tsx", {
  "@/components/couply-tokens": { tokens },
  react: {},
  "react/jsx-runtime": { jsx, jsxs: jsx },
  "react-native": {
    ActivityIndicator: "ActivityIndicator", Pressable: "Pressable",
    Text: "Text", View: "View", StyleSheet: { create: (value) => value },
    // Intentionally no React Native SafeAreaView: use the installed dependency.
  },
  "react-native-safe-area-context": { SafeAreaView: "SafeAreaContextView" },
});

function resolve(node) {
  if (Array.isArray(node)) return node.map(resolve);
  if (!node || typeof node !== "object") return node;
  if (typeof node.type === "function") return resolve(node.type(node.props));
  return { ...node, props: { ...node.props, children: resolve(node.props.children) } };
}
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return node && typeof node === "object" ? [node, ...nodes(node.props.children)] : [];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join("");
  return node && typeof node === "object" ? text(node.props.children)
    : typeof node === "string" ? node : "";
}
function style(node) {
  const value = typeof node.props.style === "function"
    ? node.props.style({ pressed: false }) : node.props.style;
  return Object.assign({}, ...(Array.isArray(value) ? value.flat(Infinity) : [value]).filter(Boolean));
}

const buttons = [
  ["primary", ui.CouplyPrimaryButton, {}],
  ["quiet soft", ui.CouplyQuietButton, { variant: "soft" }],
  ["quiet text", ui.CouplyQuietButton, { variant: "text" }],
];
for (const [name, Button, extra] of buttons) {
  test(`${name}: caller action, accessible name/hint and test ID reach the host`, () => {
    let presses = 0;
    const tree = Button({ ...extra, label: "Continue", accessibilityLabel: "Continue reviewing",
      accessibilityHint: "Opens your review", testID: "continue", onPress: () => presses++ });
    assert.equal(tree.type, "Pressable");
    assert.equal(tree.props.accessibilityRole, "button");
    assert.equal(tree.props.accessibilityLabel, "Continue reviewing");
    assert.equal(tree.props.accessibilityHint, "Opens your review");
    assert.equal(tree.props.testID, "continue");
    assert.deepEqual(tree.props.accessibilityState, { disabled: false, busy: false });
    tree.props.onPress();
    assert.equal(presses, 1);
    assert.equal(text(tree), "Continue");
  });
  for (const state of [{ disabled: true }, { loading: true }, { disabled: true, loading: true }]) {
    test(`${name}: ${JSON.stringify(state)} blocks dispatch and exposes its state`, () => {
      let presses = 0;
      const tree = Button({ ...extra, label: "Continue", onPress: () => presses++, ...state });
      assert.equal(tree.props.disabled, true);
      assert.equal(tree.props.onPress, undefined);
      tree.props.onPress?.();
      assert.equal(presses, 0);
      assert.deepEqual(tree.props.accessibilityState, { disabled: true, busy: Boolean(state.loading) });
      assert.equal(tree.props.accessibilityLabel, "Continue");
      assert.equal(nodes(tree).some((node) => node.type === "ActivityIndicator"), Boolean(state.loading));
    });
  }
}

for (const role of ["radio", "checkbox", "tab", "button"]) {
  for (const selected of [false, true]) {
    test(`choice ${role}, selected=${selected}: role-appropriate semantics stay caller-controlled`, () => {
      let presses = 0;
      const props = { title: "My choice", description: "Optional detail", selected,
        accessibilityRole: role, onPress: () => presses++ };
      const tree = ui.CouplyChoiceCard(props);
      const expected = role === "radio" || role === "checkbox" ? { checked: selected } : { selected };
      assert.equal(tree.props.accessibilityRole, role);
      assert.equal(tree.props.accessibilityLabel, "My choice: Optional detail");
      assert.deepEqual(tree.props.accessibilityState, { ...expected, disabled: false, busy: false });
      tree.props.onPress();
      assert.equal(presses, 1);
      assert.deepEqual(ui.CouplyChoiceCard(props).props.accessibilityState, tree.props.accessibilityState);
    });
  }
  for (const state of [{ disabled: true }, { loading: true }]) {
    test(`choice ${role}, ${JSON.stringify(state)}: disabled/busy cannot dispatch`, () => {
      const tree = ui.CouplyChoiceCard({ title: "Choice", accessibilityRole: role,
        accessibilityLabel: "Choose an option", accessibilityHint: "Optional",
        testID: "choice", onPress: () => assert.fail("Blocked choice dispatched"), ...state });
      assert.equal(tree.props.disabled, true);
      assert.equal(tree.props.onPress, undefined);
      assert.equal(tree.props.accessibilityState.disabled, true);
      assert.equal(tree.props.accessibilityState.busy, Boolean(state.loading));
      assert.equal(tree.props.accessibilityLabel, "Choose an option");
      assert.equal(tree.props.accessibilityHint, "Optional");
      assert.equal(tree.props.testID, "choice");
    });
  }
}

test("page uses safe-area-context, forwards edge ownership, and can defer insets to its parent", () => {
  const child = jsx("Text", { children: "Content" });
  const edges = ["top", "left", "right"];
  const safe = ui.CouplyPage({ children: child, edges, testID: "page" });
  assert.equal(safe.type, "SafeAreaContextView");
  assert.equal(safe.props.edges, edges);
  assert.equal(safe.props.testID, "page");
  assert.equal(text(safe), "Content");
  const plain = ui.CouplyPage({ children: child, safe: false });
  assert.equal(plain.type, "View");
  assert.equal(plain.props.edges, undefined);
  assert.equal(text(plain), "Content");
});

test("header preserves back action, heading and exactly one caller-owned right slot", () => {
  for (const hasBack of [false, true]) {
    let backs = 0;
    const slot = jsx(ui.CouplyQuietButton, { label: "More options" });
    const tree = resolve(ui.CouplyHeader({ title: "A long descriptive screen title ".repeat(8),
      subtitle: "Supporting copy", rightSlot: slot, onBack: hasBack ? () => backs++ : undefined }));
    assert.equal(nodes(tree).filter((node) => node.props.accessibilityRole === "header").length, 1);
    assert.equal(nodes(tree).filter((node) => node.props.accessibilityLabel === "More options").length, 1);
    const back = nodes(tree).find((node) => node.props.accessibilityLabel === "‹ Back");
    assert.equal(Boolean(back), hasBack);
    back?.props.onPress();
    assert.equal(backs, hasBack ? 1 : 0);
    assert.ok(text(tree).includes("Supporting copy"));
    assert.equal(nodes(tree).some((node) => node.props.numberOfLines !== undefined), false);
  }
});

test("section card forwards content, test ID and layout callback without owning outer spacing", () => {
  const onLayout = () => {};
  const tree = ui.CouplySectionCard({ children: "Own content", onLayout, testID: "section" });
  assert.equal(text(tree), "Own content");
  assert.equal(tree.props.onLayout, onLayout);
  assert.equal(tree.props.testID, "section");
  assert.equal(style(tree).marginHorizontal, undefined);
  assert.equal(style(tree).marginBottom, undefined);
});

test("empty state keeps its caller-owned action executable", () => {
  let presses = 0;
  const tree = resolve(ui.CouplyEmptyState({ title: "Nothing here yet", body: "Optional next step",
    action: jsx(ui.CouplyPrimaryButton, { label: "Continue", onPress: () => presses++ }) }));
  assert.ok(text(tree).includes("Nothing here yet"));
  nodes(tree).find((node) => node.type === "Pressable").props.onPress();
  assert.equal(presses, 1);
});

test("status variants display only the supplied attributed wording and never add actions or outcomes", () => {
  for (const variant of ["neutral", "open", "softening", "reconnected", "positive", "preview"]) {
    const label = "Partner shared: I feel reconnected";
    const tree = ui.CouplyStatusPill({ label, variant });
    assert.equal(text(tree), label);
    assert.equal(nodes(tree).some((node) => node.type === "Pressable"), false);
    assert.equal(nodes(tree).some((node) => node.props.onPress), false);
  }
});

test("all actionable primitives provide mobile touch targets without fixed text-height constraints", () => {
  const trees = buttons.map(([, Button, extra]) => Button({ ...extra, label: "Long label ".repeat(30) }));
  trees.push(ui.CouplyChoiceCard({ title: "Long choice ".repeat(30), badge: "Long badge ".repeat(20) }));
  trees.push(...nodes(ui.CouplyHeader({ title: "Title", onBack: () => {} })).filter((node) => node.type === "Pressable"));
  for (const tree of trees) {
    assert.ok(style(tree).minHeight >= 48);
    assert.ok(style(tree).minWidth >= 48);
    assert.equal(style(tree).height, undefined);
    assert.equal(nodes(tree).some((node) => node.props.numberOfLines !== undefined), false);
  }
});

test("presentation modules have only approved UI imports and export all eight primitives", () => {
  const file = path.join(__dirname, "../src/components/CouplyUI.tsx");
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const allowed = new Set(["@/components/couply-tokens", "react", "react-native", "react-native-safe-area-context"]);
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) assert.ok(allowed.has(statement.moduleSpecifier.text));
  }
  assert.deepEqual(Object.keys(ui).sort(), ["CouplyPage", "CouplyHeader", "CouplySectionCard",
    "CouplyPrimaryButton", "CouplyQuietButton", "CouplyStatusPill", "CouplyEmptyState", "CouplyChoiceCard"].sort());
});
