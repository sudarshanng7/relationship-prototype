const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.join(__dirname, "../..");
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

// Deterministic keyed hooks/hosts, real screen and AccountSessionBoundary.
// No React renderer, network, SQL or native device is involved.
function harness(db, file, options = {}) {
  const instances = new Map();
  const contexts = new Map();
  let current, cursor, tree, mounted = true, focused = true;
  let layout = [], passive = [];
  let componentNodes = [];
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
  const router = {
    replace: (route) => ui.navigations.push(route), push: (route) => ui.navigations.push(route),
    canGoBack: () => true, back: () => ui.navigations.push("back"),
  };
  let params = options.params ?? {};
  const imports = {
    "@/lib/supabase": { supabase: db.supabase }, react,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": {
      SafeAreaView: "SafeAreaView", Pressable: "Pressable", ActivityIndicator: "ActivityIndicator", Button: "Button", ScrollView: "ScrollView",
      Text: "Text", TextInput: "TextInput", View: "View", StyleSheet: { create: (v) => v },
    },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "expo-router": {
      useLocalSearchParams: () => params,
      useRouter: () => router,
      useFocusEffect: (callback) => react.useEffect(() => focused ? callback() : undefined, [callback, focused]),
    },
  };
  imports["@/components/couply-tokens"] = loadSource("src/components/couply-tokens.ts", {});
  imports["@/components/CouplyUI"] = loadSource("src/components/CouplyUI.tsx", imports);
  imports["@/components/AccountSessionBoundary"] = loadSource("src/components/AccountSessionBoundary.tsx", imports);
  imports["react-native"].FlatList = (props) => jsx("View", { children: [
    props.ListHeaderComponent,
    props.data.length ? props.data.map((item, index) => jsx("View", { children: props.renderItem({ item, index }) }, props.keyExtractor(item))) : props.ListEmptyComponent,
  ] });
  Object.assign(imports, options.imports ?? {});
  const Screen = loadSource(file, imports, options.source).default;
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
      componentNodes.push(node);
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
    componentNodes = [];
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
  ui.nodes = () => nodes(tree);
  // Expose actual supplied callbacks for guard tests that deliberately bypass a
  // disabled host. Components still render normally; host props are untouched.
  ui.components = () => componentNodes;
  ui.changeParams = async (next) => { params = next; await ui.flush(); };
  ui.find = (label) => nodes(tree).find((node) => node.props?.accessibilityLabel === label || (node.type === "Button" && node.props.title === label));
  ui.tap = async (label) => {
    const node = ui.find(label);
    assert.ok(node, `Missing ${label}: ${ui.text()}`);
    assert.ok(!node.props.disabled, `Disabled ${label}`);
    await node.props.onPress(); await ui.flush();
  };
  ui.inputs = () => nodes(tree).filter((node) => node.type === "TextInput");
  ui.change = (index, value) => { ui.inputs()[index].props.onChangeText(value); ui.render(); };
  ui.switchAccount = async (id, event, token) => { db.emit(id, event, token); await ui.flush(); };
  ui.blur = async () => { focused = false; ui.render(); await ui.flush(); };
  ui.focus = async () => { focused = true; ui.render(); await ui.flush(); };
  ui.unmount = () => { mounted = false; instances.forEach(cleanup); instances.clear(); tree = null; };
  ui.render();
  return ui;
}

module.exports = { loadSource, deferred, harness };
