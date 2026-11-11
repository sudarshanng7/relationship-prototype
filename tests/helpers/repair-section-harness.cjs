const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

// Exercise the real helper and component without native modules, credentials,
// database access, or additional test dependencies. Host elements and hooks are
// a minimal deterministic harness, not a React renderer or a device simulation.
function loadSource(file, imports, source) {
  const filename = path.join(__dirname, "../..", file);
  const { outputText } = ts.transpileModule(source ?? readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const module = { exports: {} };
  const localRequire = (name) => {
    assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`);
    return imports[name];
  };
  vm.runInThisContext(
    `(function(require, module, exports) { ${outputText}\n})`,
    { filename },
  )(localRequire, module, module.exports);
  return module.exports;
}

const checkedSave = "save_my_repair_state_checked";
const share = "share_my_repair_state";
const withdraw = "withdraw_my_repair_state_checked";
const conflict = {
  code: "P0001",
  message: "Repair update changed; reload before saving",
  details: "PRIVATE_CONFLICT_DETAIL",
  hint: "PRIVATE_CONFLICT_HINT",
};

function row(overrides = {}) {
  return {
    event_id: "event-a", user_id: "user-a", repair_status: "open",
    what_helped: null, sharing_status: "private", status_origin: "explicit",
    report_version: 7, ...overrides,
  };
}

function client(initialRows = []) {
  const state = { rows: initialRows, calls: [], readCalls: [], reads: 0, trace: [] };
  state.read = async () => ({ data: structuredClone(state.rows), error: state.readError ?? null });
  state.respond = async (call) => {
    if (call.name === checkedSave) {
      state.rows = [row({
        repair_status: call.args.p_repair_status,
        what_helped: call.args.p_what_helped,
        report_version: 42,
      })];
      return { data: 42, error: null };
    }
    if (call.name === share) {
      state.rows = state.rows.map((report) => report.user_id === "user-a"
        ? { ...report, sharing_status: "shared", report_version: call.args.p_expected_report_version + 1 }
        : report);
    }
    return { data: true, error: null };
  };
  state.supabase = {
    rpc(name, args) {
      const call = { name, args, headers: {} };
      return {
        setHeader(key, value) { call.headers[key] = value; return this; },
        then(resolve, reject) {
          state.calls.push(call);
          state.trace.push(name);
          return Promise.resolve().then(() => state.respond(call)).then(resolve, reject);
        },
      };
    },
    from(table) {
      assert.equal(table, "event_repair_states");
      return { select: () => ({ eq: (column, value) => {
        assert.equal(column, "event_id");
        const call = { eventId: value, headers: {} };
        return {
          setHeader(key, value) { call.headers[key] = value; return this; },
          then(resolve, reject) {
            state.reads++;
            state.readCalls.push(call);
            state.trace.push("read");
            return Promise.resolve().then(() => state.read(call)).then(resolve, reject);
          },
        };
      } }) };
    },
  };
  state.lib = loadSource("src/lib/repair-states.ts", {
    "@/lib/supabase": { supabase: state.supabase },
  });
  return state;
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function harness(db, visibility = "ours", source) {
  const slots = [];
  const effects = [];
  const cleanups = [];
  let cursor = 0;
  let tree;
  let focusCleanup;
  let focusEffect;
  const state = { current: true, authorize: async () => "author-token" };
  const memo = (factory, deps) => {
    const index = cursor++;
    const previous = slots[index];
    if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
      slots[index] = { deps, value: factory() };
    }
    return slots[index].value;
  };
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (value) => { slots[index] = value; }];
    },
    useRef: (initial) => memo(() => ({ current: initial }), []),
    useCallback: (callback, deps) => memo(() => callback, deps),
    useMemo: memo,
    useLayoutEffect: (effect, deps) => {
      const index = cursor;
      memo(() => { effects.push(() => {
        cleanups[index]?.();
        cleanups[index] = effect();
      }); }, deps);
    },
  };
  const jsx = (type, props) => ({ type, props });
  const imports = {
    "@/lib/repair-states": db.lib,
    "@/lib/supabase": { supabase: db.supabase },
    react,
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": {
      ActivityIndicator: "ActivityIndicator", Pressable: "Pressable",
      Text: "Text", View: "View", StyleSheet: { create: (value) => value },
    },
    "expo-router": { useFocusEffect: (effect) => {
      focusEffect = effect;
      memo(() => {
        effects.push(() => { focusCleanup?.(); focusCleanup = effect(); });
      }, [effect]);
    } },
  };
  imports["@/components/couply-tokens"] = loadSource("src/components/couply-tokens.ts", {});
  imports["@/components/CouplyUI"] = loadSource("src/components/CouplyUI.tsx", imports);
  imports["@/components/RepairRadioGroup"] = loadSource("src/components/RepairRadioGroup.tsx", imports);
  const { EventRepairSection } = loadSource("src/components/EventRepairSection.tsx", imports, source);
  const props = {
    eventId: "event-a", userId: "user-a", visibility,
    authorize: () => state.authorize(), isCurrent: () => state.current,
  };
  const resolve = (node) => !node || typeof node !== "object" ? node
    : Array.isArray(node) ? node.map(resolve)
    : typeof node.type === "function" ? resolve(node.type(node.props))
    : { ...node, props: { ...node.props, children: resolve(node.props?.children) } };
  state.render = () => {
    cursor = 0;
    tree = resolve(EventRepairSection(props));
    while (effects.length) effects.shift()();
  };
  state.flush = async () => {
    // Drain nested authorization/RPC/load continuations and render state updates.
    for (let i = 0; i < 6; i++) {
      await new Promise((resolve) => setImmediate(resolve));
      state.render();
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
    if (Array.isArray(node)) return node.map(text).join("");
    return text(node.props?.children);
  };
  state.text = () => text(tree);
  state.nodes = () => nodes(tree);
  state.button = (label) => nodes(tree).find(
    (node) => node.type === "Pressable" && text(node) === label,
  );
  state.press = async (label) => {
    const button = state.button(label);
    assert.ok(button, `Missing button: ${label}\n${state.text()}`);
    assert.ok(!button.props.disabled, `Disabled button: ${label}`);
    button.props.onPress();
    await state.flush();
  };
  state.selected = (label) => state.button(label)?.props.accessibilityState?.checked;
  state.blur = () => { focusCleanup?.(); };
  state.refocus = () => { state.blur(); focusCleanup = focusEffect(); state.render(); };
  state.setProps = (next) => { Object.assign(props, next); state.render(); };
  state.unmount = () => { state.blur(); cleanups.forEach((cleanup) => cleanup?.()); };
  state.render();
  return state;
}

async function edit(ui) {
  await ui.press("I feel reconnected");
  await ui.press("Talking");
}

async function confirmShare(ui) {
  await ui.press("Save & share with partner");
  await ui.press("Confirm save & share");
}

module.exports = { row, client, harness, deferred, checkedSave, share, withdraw, conflict, edit, confirmShare };
