const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

// Exercise the real helper and component without native modules, credentials,
// database access, or additional test dependencies. Host elements and hooks are
// a minimal deterministic harness, not a React renderer or a device simulation.
function loadSource(file, imports) {
  const filename = path.join(__dirname, "..", file);
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
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

function harness(db, visibility = "ours") {
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
  const { EventRepairSection } = loadSource("src/components/EventRepairSection.tsx", {
    "@/lib/repair-states": db.lib,
    "@/lib/supabase": { supabase: db.supabase },
    react,
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
  });
  const props = {
    eventId: "event-a", userId: "user-a", visibility,
    authorize: () => state.authorize(), isCurrent: () => state.current,
  };
  state.render = () => {
    cursor = 0;
    tree = EventRepairSection(props);
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

test("typed save sends explicit null, pins authorization, and returns the actual version", async () => {
  const db = client();
  assert.equal(await db.lib.saveMyRepairState("event-a", "open", null, null, "pinned"), 42);
  assert.deepEqual(db.calls[0], {
    name: checkedSave,
    args: { p_event_id: "event-a", p_repair_status: "open", p_what_helped: null,
      p_expected_report_version: null },
    headers: { Authorization: "Bearer pinned" },
  });
});

test("typed save sends the loaded version, propagates conflicts, and validates versions", async () => {
  const db = client();
  db.respond = async () => ({ error: conflict });
  await assert.rejects(db.lib.saveMyRepairState("event-a", "open", null, 7),
    (error) => error === conflict && db.lib.isRepairSaveConflict(error));
  assert.equal(db.calls[0].args.p_expected_report_version, 7);
  for (const version of [undefined, 0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(db.lib.saveMyRepairState("event-a", "open", null, version));
  }
  assert.equal(db.calls.length, 1);
  assert.equal(db.lib.isRepairSaveConflict(new Error(conflict.message)), true);
  for (const error of [null, {}, { message: "Moment unavailable" }]) {
    assert.equal(db.lib.isRepairSaveConflict(error), false);
  }
});

test("typed save rejects absent or unsafe returned versions", async () => {
  const db = client();
  for (const data of [null, undefined, "42", 0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    db.respond = async () => ({ data, error: null });
    await assert.rejects(db.lib.saveMyRepairState("event-a", "open", null, null),
      /no usable report version/);
  }
});

for (const existing of [false, true]) {
  test(`UI private ${existing ? "update" : "first save"} uses the loaded version or null`, async () => {
    const db = client(existing ? [row()] : []);
    const ui = harness(db, "mine");
    await ui.flush();
    await edit(ui);
    assert.equal(ui.button("Save & share with partner"), undefined);
    await ui.press("Save privately");
    assert.equal(db.calls.length, 1);
    assert.equal(db.calls[0].name, checkedSave);
    assert.equal(db.calls[0].args.p_expected_report_version, existing ? 7 : null);
    assert.equal(db.calls[0].headers.Authorization, "Bearer author-token");
    assert.match(ui.text(), /Saved privately/);
  });

  test(`UI Save & Share ${existing ? "update" : "first save"} shares the returned version without reloading`, async () => {
    const db = client(existing ? [row()] : []);
    const ui = harness(db);
    await ui.flush();
    await edit(ui);
    assert.equal(db.calls.length, 0, "draft editing must not share");
    await confirmShare(ui);
    assert.deepEqual(db.trace, ["read", checkedSave, share, "read"]);
    assert.equal(db.calls[0].args.p_expected_report_version, existing ? 7 : null);
    assert.equal(db.calls[1].args.p_expected_report_version, 42);
    assert.equal(db.calls[1].headers.Authorization, "Bearer author-token");
  });

  for (const shareDraft of [false, true]) {
    test(`UI stale ${existing ? "update" : "first save"}, ${shareDraft ? "Save & Share" : "private"}, preserves choices until explicit reload`, async () => {
      const db = client(existing ? [row()] : []);
      db.respond = async () => ({ error: conflict });
      const ui = harness(db);
      await ui.flush();
      await edit(ui);
      if (shareDraft) await confirmShare(ui);
      else await ui.press("Save privately");
      assert.equal(ui.selected("I feel reconnected"), true);
      assert.equal(ui.selected("Talking"), true);
      assert.equal(db.reads, 1, "conflict must not reload the draft or version");
      assert.deepEqual(db.calls.map((call) => call.name), [checkedSave]);
      assert.match(ui.text(), /A newer repair report exists/);
      assert.doesNotMatch(ui.text(), /PRIVATE_CONFLICT/);
      assert.equal(ui.button("Save privately"), undefined);
      assert.equal(ui.button("Save & share with partner"), undefined);
      db.rows = [row({ report_version: 19, repair_status: "partially_repaired", what_helped: "space" })];
      await ui.press("Load newer update (replaces your choices)");
      assert.equal(ui.selected("A little better"), true);
      assert.equal(ui.selected("Space"), true);
      assert.doesNotMatch(ui.text(), /A newer repair report exists/);
      await edit(ui);
      await ui.press("Save privately");
      assert.equal(db.calls[1].args.p_expected_report_version, 19);
    });
  }
}

test("UI shares an unchanged explicit report using its loaded version without saving", async () => {
  const db = client([row()]);
  const ui = harness(db);
  await ui.flush();
  await ui.press("Share saved update");
  await ui.press("Confirm save & share");
  assert.deepEqual(db.calls.map((call) => call.name), [share]);
  assert.equal(db.calls[0].args.p_expected_report_version, 7);
});

test("UI saves a changed shared report privately and clears the method for open", async () => {
  const db = client([row({
    sharing_status: "shared", repair_status: "reconnected", what_helped: "talking",
  })]);
  const ui = harness(db);
  await ui.flush();
  await ui.press("Still unresolved");
  await ui.press("Save privately");
  assert.equal(db.calls.length, 1);
  assert.equal(db.calls[0].name, checkedSave);
  assert.equal(db.calls[0].args.p_expected_report_version, 7);
  assert.equal(db.calls[0].args.p_what_helped, null);
  assert.match(ui.text(), /Private — not shared/);
});

test("UI never uses a partner's shared version as its own expected version", async () => {
  const db = client([row({ user_id: "user-b", sharing_status: "shared", report_version: 90 })]);
  const ui = harness(db);
  await ui.flush();
  await edit(ui);
  await ui.press("Save privately");
  assert.equal(db.calls[0].args.p_expected_report_version, null);
});

test("UI confirms an unchanged legacy report with a checked save before sharing", async () => {
  const db = client([row({ status_origin: "legacy_default_unconfirmed" })]);
  const ui = harness(db);
  await ui.flush();
  await confirmShare(ui);
  assert.deepEqual(db.calls.map((call) => call.name), [checkedSave, share]);
  assert.equal(db.calls[0].args.p_expected_report_version, 7);
  assert.equal(db.calls[1].args.p_expected_report_version, 42);
});

test("UI reports partial success when sharing the saved version loses a race", async () => {
  const db = client([row()]);
  const respond = db.respond;
  db.respond = async (call) => call.name === share
    ? { error: { code: "P0001", message: "Repair update changed, was already shared, or needs confirmation; please reload" } }
    : respond(call);
  const ui = harness(db);
  await ui.flush();
  await edit(ui);
  await confirmShare(ui);
  assert.equal(db.calls[1].args.p_expected_report_version, 42);
  assert.match(ui.text(), /Your update was saved. This sharing request was rejected./);
  assert.match(ui.text(), /Your current saved update is private./);
  assert.match(ui.text(), /Your repair update changed or needs confirmation. Reload before sharing./);
  assert.doesNotMatch(ui.text(), /was saved and shared/);
  assert.equal(db.calls.length, 2, "no automatic retry of share");
});

test("UI does not share after an unusable save response", async () => {
  const db = client();
  db.respond = async () => ({ data: null, error: null });
  const ui = harness(db);
  await ui.flush();
  await edit(ui);
  await confirmShare(ui);
  assert.deepEqual(db.calls.map((call) => call.name), [checkedSave]);
  assert.equal(ui.selected("Talking"), true);
  assert.match(ui.text(), /Your saved update could not be confirmed. Reload before sharing./);
});

test("UI preserves draft choices and displays approved PostgREST authorization errors only", async () => {
  const db = client([row()]);
  db.respond = async () => ({ error: {
    message: "Moment unavailable", details: "PRIVATE_AUTH_DETAIL", hint: "PRIVATE_AUTH_HINT",
  } });
  const ui = harness(db);
  await ui.flush();
  await edit(ui);
  await ui.press("Save privately");
  assert.match(ui.text(), /Moment unavailable/);
  assert.doesNotMatch(ui.text(), /PRIVATE_AUTH/);
  assert.equal(ui.selected("Talking"), true);
  assert.equal(db.reads, 1);
});

for (const [message, expected] of [
  ["Moment unavailable for sharing", "Moment unavailable for sharing"],
  ["Authentication required", "Please sign in again."],
  ["Reload your repair update before saving.", "Reload your repair update before saving."],
  ["Reload your repair update before sharing.", "Reload your repair update before sharing."],
  ["Please reload your repair update before sharing", "Reload your repair update before sharing."],
]) {
  test(`UI maps the known error ${JSON.stringify(message)} to reviewed copy`, async () => {
    const db = client([row()]);
    db.respond = async () => ({ error: new Error(message) });
    const ui = harness(db);
    await ui.flush();
    await edit(ui);
    await ui.press("Save privately");
    assert.ok(ui.text().includes(expected));
    assert.doesNotMatch(ui.text(), /Something went wrong/);
  });
}

const unexpectedErrors = [
  { code: "23505", message: 'duplicate key value violates unique constraint "event_repair_states_pkey"',
    details: "PRIVATE_ROW_DETAIL", hint: "PRIVATE_SQL_HINT" },
  { code: "P0001", message: "private.save_my_repair_state_checked_internal failed on INTERNAL_TABLE" },
  { message: "Moment unavailable: INTERNAL_DATABASE_DETAIL" },
  new Error("Connection failed for INTERNAL_DATABASE_HOST"),
  { message: 123, details: "PRIVATE_ROW_DETAIL" },
];

for (const [index, error] of unexpectedErrors.entries()) {
  test(`UI hides unknown database/runtime error ${index + 1} and retains its draft`, async () => {
    const db = client([row()]);
    db.respond = async () => ({ error });
    const ui = harness(db);
    await ui.flush();
    await edit(ui);
    await ui.press("Save privately");
    assert.match(ui.text(), /Something went wrong. Please try again./);
    assert.doesNotMatch(ui.text(), /duplicate key|event_repair_states_pkey|private\.|INTERNAL_|PRIVATE_/);
    assert.equal(ui.selected("I feel reconnected"), true);
    assert.equal(ui.selected("Talking"), true);
    assert.equal(db.reads, 1);
    assert.equal(db.calls[0].args.p_expected_report_version, 7);
    assert.equal(db.calls[0].headers.Authorization, "Bearer author-token");
  });
}

for (const stage of ["load", "save-and-share", "share", "withdraw"]) {
  test(`UI hides internal database details during ${stage}`, async () => {
    const db = client([row({ sharing_status: stage === "withdraw" ? "shared" : "private" })]);
    const error = unexpectedErrors[0];
    const respond = db.respond;
    if (stage === "load") db.readError = error;
    else db.respond = async (call) => stage === "share" && call.name === checkedSave
      ? respond(call) : { error };
    const ui = harness(db);
    await ui.flush();
    if (stage === "withdraw") {
      await ui.press("Withdraw shared update");
      await ui.press("Confirm withdrawal");
    } else if (stage !== "load") {
      await edit(ui);
      await confirmShare(ui);
    }
    assert.match(ui.text(), stage === "share"
      ? /Your current saved update is private./ : /Something went wrong. Please try again./);
    assert.doesNotMatch(ui.text(), /duplicate key|event_repair_states_pkey|PRIVATE_/);
    if (stage === "share") {
      assert.doesNotMatch(ui.text(), /was NOT shared/);
      assert.equal(db.calls[1].args.p_expected_report_version, 42);
    } else if (stage === "save-and-share") {
      assert.equal(ui.selected("Talking"), true);
      assert.deepEqual(db.calls.map((call) => call.name), [checkedSave]);
    }
  });
}

test("UI withdrawal still uses the author-bound RPC and reloads its version", async () => {
  const db = client([row({ sharing_status: "shared" })]);
  db.respond = async () => {
    db.rows = [row({ report_version: 8 })];
    return { data: 8, error: null };
  };
  const ui = harness(db);
  await ui.flush();
  await ui.press("Withdraw shared update");
  await ui.press("Confirm withdrawal");
  assert.equal(db.calls[0].name, withdraw);
  assert.equal(db.calls[0].headers.Authorization, "Bearer author-token");
  await edit(ui);
  await ui.press("Save privately");
  assert.equal(db.calls[1].args.p_expected_report_version, 8);
});

for (const invalidate of ["identity", "blur", "unmount"]) {
  test(`UI stops sharing when ${invalidate} invalidates a pending save`, async () => {
    const db = client([row()]);
    const pending = deferred();
    db.respond = () => pending.promise;
    const ui = harness(db);
    await ui.flush();
    await edit(ui);
    await confirmShare(ui);
    assert.equal(db.calls.length, 1);
    if (invalidate === "identity") ui.current = false;
    else ui[invalidate]();
    pending.resolve({ data: 42, error: null });
    await ui.flush();
    assert.equal(db.calls.length, 1);
    assert.equal(db.reads, 1);
  });
}

test("UI rechecks authorization before dispatch and suppresses duplicate saves", async () => {
  const db = client([row()]);
  const ui = harness(db);
  await ui.flush();
  await edit(ui);
  const pending = deferred();
  ui.authorize = () => pending.promise;
  const save = ui.button("Save privately");
  save.props.onPress();
  save.props.onPress();
  await ui.flush();
  ui.current = false;
  pending.resolve("old-author-token");
  await ui.flush();
  assert.equal(db.calls.length, 0);
});

test("UI suppresses duplicate dispatch while a checked save is pending", async () => {
  const db = client([row()]);
  const pending = deferred();
  db.respond = () => pending.promise;
  const ui = harness(db);
  await ui.flush();
  await edit(ui);
  const save = ui.button("Save privately");
  save.props.onPress();
  save.props.onPress();
  await ui.flush();
  assert.equal(db.calls.length, 1);
  pending.resolve({ data: 42, error: null });
  await ui.flush();
});

test("UI handles unavailable withdrawal without exposing backend metadata or claiming success", async () => {
  const db = client([row({ sharing_status: "shared" })]);
  db.respond = async () => {
    db.rows = []; // Subsequent authorized reads no longer return the old report.
    return { error: {
      code: "P0001", message: "Moment unavailable",
      details: "PRIVATE_MOMENT_DETAIL", hint: "PRIVATE_MEMBERSHIP_HINT",
    } };
  };
  const ui = harness(db);
  await ui.flush();
  await ui.press("Withdraw shared update");
  await ui.press("Confirm withdrawal");
  assert.deepEqual(db.calls.map((call) => call.name), [withdraw]);
  assert.equal(db.calls[0].headers.Authorization, "Bearer author-token");
  assert.equal(db.reads, 2, "denial must refresh using the existing authorized read path");
  assert.match(ui.text(), /Moment unavailable/);
  assert.doesNotMatch(ui.text(), /PRIVATE_|Update withdrawn from sharing|Your current saved update is visible/);
});

const withdrawalConflict = {
  code: "P0001", message: "Repair update changed; reload before withdrawing",
  details: "PRIVATE_WITHDRAW_DETAIL", hint: "PRIVATE_WITHDRAW_HINT",
};

test("typed withdrawal consumes a reviewed private version and pins its author", async () => {
  const db = client([row()]);
  db.respond = async () => ({ data: 8, error: null });
  assert.equal(await db.lib.withdrawMyRepairState("event-a", 7, "pinned-author"), 8);
  assert.deepEqual(db.calls, [{
    name: withdraw, args: { p_event_id: "event-a", p_expected_report_version: 7 },
    headers: { Authorization: "Bearer pinned-author" },
  }]);
});

test("typed withdrawal rejects invalid input and missing author tokens before dispatch", async () => {
  const db = client();
  for (const version of [undefined, null, 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(db.lib.withdrawMyRepairState("event-a", version, "token"),
      /Reload your repair update before withdrawing/);
  }
  await assert.rejects(db.lib.withdrawMyRepairState("event-a", 7, ""), /Authentication required/);
  assert.equal(db.calls.length, 0);
});

test("typed withdrawal propagates exact conflicts without backend detail rendering", async () => {
  const db = client();
  db.respond = async () => ({ error: withdrawalConflict });
  await assert.rejects(db.lib.withdrawMyRepairState("event-a", 7, "token"),
    (error) => error === withdrawalConflict && db.lib.isRepairWithdrawalConflict(error));
  for (const error of [null, {}, { message: withdrawalConflict.message + ": INTERNAL" }]) {
    assert.equal(db.lib.isRepairWithdrawalConflict(error), false);
  }
});

for (const data of [false, true, null, undefined, "8", [], {}, 0, 7, 9, NaN, Number.MAX_SAFE_INTEGER + 1]) {
  test(`withdrawal rejects malformed/unexpected response ${String(data)} without claiming success`, async () => {
    const db = client([row({ sharing_status: "shared" })]);
    db.respond = async () => ({ data, error: null });
    const ui = harness(db);
    await ui.flush();
    await edit(ui);
    await ui.press("Withdraw shared update");
    await ui.press("Confirm withdrawal");
    assert.match(ui.text(), /Your withdrawal could not be confirmed. Reload before trying again./);
    assert.doesNotMatch(ui.text(), /Withdrawal recorded|Confirm withdrawal/);
    assert.equal(ui.selected("Talking"), true);
    assert.equal(db.reads, 1);
    assert.equal(db.calls.length, 1);
    assert.ok(ui.button("Load newer update (replaces your choices)"));
  });
}

for (const [scenario, latest] of [
  ["newer share", row({ report_version: 9, sharing_status: "shared", repair_status: "partially_repaired" })],
  ["save before pending share", row({ report_version: 8 })],
  ["lost-response retry after later sharing", row({ report_version: 9, sharing_status: "shared" })],
]) {
  test(`UI conflict after ${scenario} preserves choices until explicit reload and reconfirmation`, async () => {
    const db = client([row({ sharing_status: "shared" })]);
    db.respond = async () => { db.rows = [latest]; return { error: withdrawalConflict }; };
    const ui = harness(db);
    await ui.flush();
    await edit(ui);
    const retainedConfirm = async () => {
      await ui.press("Withdraw shared update");
      return ui.button("Confirm withdrawal");
    };
    const confirm = await retainedConfirm();
    confirm.props.onPress();
    await ui.flush();
    assert.match(ui.text(), /Sharing was not withdrawn by this request/);
    assert.doesNotMatch(ui.text(), /PRIVATE_|Withdrawal recorded|Confirm withdrawal/);
    assert.equal(ui.selected("I feel reconnected"), true);
    assert.equal(ui.selected("Talking"), true);
    assert.equal(db.reads, 1, "conflict must not automatically replace draft choices");
    assert.equal(db.calls[0].args.p_expected_report_version, 7);
    assert.equal(ui.button("Save privately"), undefined);
    await ui.press("Load newer update (replaces your choices)");
    assert.equal(db.calls.length, 1, "reload must never retry a withdrawal");
    if (latest.sharing_status === "shared") {
      db.respond = async () => {
        db.rows = [{ ...latest, report_version: latest.report_version + 1, sharing_status: "private" }];
        return { data: latest.report_version + 1, error: null };
      };
      await ui.press("Withdraw shared update");
      assert.equal(db.calls.length, 1, "new confirmation is required");
      await ui.press("Confirm withdrawal");
      assert.equal(db.calls[1].args.p_expected_report_version, latest.report_version);
      assert.match(ui.text(), /Withdrawal recorded/);
    } else {
      assert.equal(ui.button("Withdraw shared update"), undefined);
    }
  });
}

test("UI keeps an uncertain lost-response withdrawal blocked until explicit reconciliation", async () => {
  const db = client([row({ sharing_status: "shared" })]);
  db.respond = async () => {
    db.rows = [row({ report_version: 8 })]; // Represents a committed write with lost response.
    throw new Error("PRIVATE_CONNECTION_HOST");
  };
  const ui = harness(db);
  await ui.flush();
  await edit(ui);
  await ui.press("Withdraw shared update");
  await ui.press("Confirm withdrawal");
  assert.match(ui.text(), /Something went wrong/);
  assert.doesNotMatch(ui.text(), /PRIVATE_|Withdrawal recorded/);
  assert.equal(ui.selected("Talking"), true);
  assert.equal(db.calls.length, 1);
  await ui.press("Load newer update (replaces your choices)");
  assert.equal(db.calls.length, 1);
  assert.match(ui.text(), /Private — not shared/);
});

for (const invalidate of ["identity", "blur", "unmount"]) {
  test(`UI suppresses withdrawal completion after ${invalidate}`, async () => {
    const db = client([row({ sharing_status: "shared" })]);
    const pending = deferred();
    db.respond = () => pending.promise;
    const ui = harness(db);
    await ui.flush();
    await ui.press("Withdraw shared update");
    await ui.press("Confirm withdrawal");
    assert.equal(db.calls[0].headers.Authorization, "Bearer author-token");
    if (invalidate === "identity") ui.current = false;
    else ui[invalidate]();
    pending.resolve({ data: 8, error: null });
    await ui.flush();
    assert.equal(db.reads, 1);
    assert.doesNotMatch(ui.text(), /Withdrawal recorded/);
  });
}

test("UI withdrawal rechecks identity before dispatch and suppresses duplicate confirmations", async () => {
  const db = client([row({ sharing_status: "shared" })]);
  const ui = harness(db);
  await ui.flush();
  await ui.press("Withdraw shared update");
  const pending = deferred();
  ui.authorize = () => pending.promise;
  const confirm = ui.button("Confirm withdrawal");
  confirm.props.onPress();
  confirm.props.onPress();
  await ui.flush();
  ui.current = false;
  pending.resolve("old-author-token");
  await ui.flush();
  assert.equal(db.calls.length, 0);
});

test("UI withdrawal uses its own version and leaves the partner response untouched", async () => {
  const partner = row({ user_id: "user-b", sharing_status: "shared", report_version: 90 });
  const db = client([partner, row({ sharing_status: "shared" })]);
  const pending = deferred();
  db.respond = () => pending.promise;
  const ui = harness(db);
  await ui.flush();
  await ui.press("Withdraw shared update");
  const confirm = ui.button("Confirm withdrawal");
  confirm.props.onPress();
  confirm.props.onPress();
  await ui.flush();
  assert.equal(db.calls.length, 1);
  assert.equal(db.calls[0].args.p_expected_report_version, 7);
  assert.deepEqual(db.rows[0], partner);
  db.rows = [partner, row({ report_version: 8 })];
  pending.resolve({ data: 8, error: null });
  await ui.flush();
  assert.match(ui.text(), /Withdrawal recorded/);
});

// Finding 6: assert real component text, including the summary that previously
// contradicted the share failure notice. No server or native runtime is used.
const sharingUnknown = "We couldn't confirm whether your update was shared. Please refresh to check its current sharing status.";
const sharingSuccess = "Your update was saved and shared with your partner.";
const transportError = new Error("PRIVATE_TRANSPORT_HOST");

function assertNoFalsePrivacy(ui) {
  assert.doesNotMatch(ui.text(), /was NOT shared|saved privately but|Private — not shared|It was not shared/);
  assert.doesNotMatch(ui.text(), /PRIVATE_|INTERNAL_|jointly repaired|relationship health/i);
}

async function sharingScenario({ existing = false, respond, read } = {}) {
  const db = client(existing ? [row()] : []);
  const original = db.respond;
  if (respond) db.respond = (call) => respond(call, db, original);
  const ui = harness(db);
  await ui.flush();
  if (read) db.read = (call) => read(call, db);
  if (!existing) await edit(ui);
  await ui.press(existing ? "Share saved update" : "Save & share with partner");
  await ui.press("Confirm save & share");
  return { db, ui };
}

for (const existing of [false, true]) {
  test(`Finding 6: ${existing ? "unchanged report" : "private save"} then confirmed sharing shows success`, async () => {
    const { db, ui } = await sharingScenario({ existing });
    assert.ok(ui.text().includes(sharingSuccess));
    assert.match(ui.text(), /Shared with your partner/);
    assertNoFalsePrivacy(ui);
    assert.equal(db.calls.filter((call) => call.name === checkedSave).length, existing ? 0 : 1);
    assert.equal(db.calls.filter((call) => call.name === share).length, 1);
    assert.equal(db.reads, 2);
    assert.deepEqual(db.readCalls.map((call) => call.headers), [
      { Authorization: "Bearer author-token" }, { Authorization: "Bearer author-token" },
    ]);
  });

  for (const committed of [true, false]) {
    test(`Finding 6: ${existing ? "unchanged" : "saved"} share response lost, current state ${committed ? "shared" : "private"}`, async () => {
      const { db, ui } = await sharingScenario({ existing,
        respond: async (call, db, original) => {
          if (call.name !== share) return original(call);
          if (committed) await original(call);
          throw transportError;
        },
      });
      assert.equal(db.calls.filter((call) => call.name === share).length, 1);
      assert.equal(db.reads, 2, "exactly one read-only reconciliation");
      assert.match(ui.text(), committed
        ? /Your current saved update is shared with your partner\./
        : /Your current saved update is private\./);
      assert.doesNotMatch(ui.text(), /was NOT shared|saved privately but|PRIVATE_|This sharing request was rejected/);
      assert.ok(!ui.text().includes(sharingSuccess), "a current read is not a historical RPC acknowledgment");
      if (committed) assertNoFalsePrivacy(ui);
      else assert.match(ui.text(), /Private — not shared/);
      if (!existing) assert.equal(ui.selected("Talking"), true);
    });
  }

  for (const acknowledged of [false, true]) {
    test(`Finding 6: ${existing ? "unchanged" : "saved"} sharing ${acknowledged ? "confirmed" : "commits with lost response"}, reconciliation fails`, async () => {
      const { db, ui } = await sharingScenario({ existing,
        respond: async (call, db, original) => {
          const result = await original(call);
          if (call.name === share && !acknowledged) throw transportError;
          return result;
        },
        read: async () => { throw transportError; },
      });
      assert.ok(ui.text().includes(acknowledged ? sharingSuccess : sharingUnknown));
      if (acknowledged) {
        assert.match(ui.text(), /The current sharing status could not be verified. Please refresh to check it./);
        assert.ok(!ui.text().includes(sharingUnknown));
      } else assert.ok(!ui.text().includes(sharingSuccess));
      if (!existing) {
        assert.match(ui.text(), acknowledged ? /saved and shared/ : /Your update was saved./);
        assert.equal(ui.selected("I feel reconnected"), true);
        assert.equal(ui.selected("Talking"), true);
      }
      assertNoFalsePrivacy(ui);
      assert.equal(ui.button("Save privately"), undefined);
      assert.equal(ui.button("Share saved update"), undefined);
      assert.equal(ui.button("Save & share with partner"), undefined);
      assert.equal(db.calls.filter((call) => call.name === share).length, 1);
      // A failed manual read also preserves the draft and uncertainty.
      await ui.press("Refresh sharing status (replaces your choices)");
      assert.ok(ui.text().includes(acknowledged ? sharingSuccess : sharingUnknown));
      if (!existing) assert.equal(ui.selected("Talking"), true);
      db.read = async () => ({ data: structuredClone(db.rows), error: null });
      await ui.press("Refresh sharing status (replaces your choices)");
      assert.match(ui.text(), /Shared with your partner/);
      assert.doesNotMatch(ui.text(), /couldn't confirm|could not be verified|Sharing status needs verification/);
      assertNoFalsePrivacy(ui);
      assert.equal(db.calls.filter((call) => call.name === share).length, 1, "manual refresh never shares");
    });
  }
}

test("Finding 6: definitive server rejection remains distinct from save failure and uncertain sharing", async () => {
  const { db, ui } = await sharingScenario({
    respond: (call, db, original) => call.name === share ? {
      error: { code: "P0001", message: "Moment unavailable for sharing", details: "PRIVATE_DETAIL", hint: "PRIVATE_HINT" },
    } : original(call),
  });
  assert.match(ui.text(), /Your update was saved. This sharing request was rejected. Moment unavailable for sharing/);
  assert.match(ui.text(), /Your current saved update is private./);
  assert.equal(ui.selected("Talking"), true);
  assert.doesNotMatch(ui.text(), /was NOT shared|PRIVATE_|couldn't confirm|was saved and shared/);
  assert.equal(db.calls.length, 2);
});

test("Finding 6: definitive rejection plus failed read does not assert current privacy", async () => {
  const { ui } = await sharingScenario({
    respond: (call, db, original) => call.name === share ? {
      error: { code: "P0001", message: "Moment unavailable for sharing" },
    } : original(call),
    read: async () => ({ data: null, error: transportError }),
  });
  assert.match(ui.text(), /Your update was saved. This sharing request was rejected./);
  assert.match(ui.text(), /The current sharing status could not be verified./);
  assertNoFalsePrivacy(ui);
});

for (const response of [null, false, undefined, "true", 1]) {
  test(`Finding 6: unusable share acknowledgment ${String(response)} requires reconciliation`, async () => {
    const { ui } = await sharingScenario({
      respond: async (call, db, original) => {
        const result = await original(call);
        return call.name === share ? { data: response, error: null } : result;
      },
      read: async () => { throw transportError; },
    });
    assert.ok(ui.text().includes(sharingUnknown));
    assert.ok(!ui.text().includes(sharingSuccess));
    assertNoFalsePrivacy(ui);
  });
}

for (const invalidation of ["account", "blur", "unmount", "event", "visibility"]) {
  test(`Finding 6: ${invalidation} changes during in-flight sharing suppress old completion`, async () => {
    const pending = deferred();
    const { db, ui } = await sharingScenario({
      respond: (call, db, original) => call.name === share ? pending.promise : original(call),
    });
    const previousReads = db.reads;
    assert.equal(db.calls[1].headers.Authorization, "Bearer author-token");
    if (invalidation === "account") {
      ui.current = false;
      ui.unmount(); // Parent replaces the keyed account subtree.
    } else if (invalidation === "event") {
      db.rows = [];
      ui.setProps({ eventId: "event-b" });
    } else if (invalidation === "visibility") {
      db.rows = [row({ report_version: 44, repair_status: "partially_repaired", what_helped: "space" })];
      ui.setProps({ visibility: "mine" });
    } else ui[invalidation]();
    await ui.flush();
    const generationText = ui.text();
    pending.resolve({ data: true, error: null });
    await ui.flush();
    assert.equal(ui.text(), generationText);
    assert.doesNotMatch(ui.text(), /was saved and shared|current saved update is shared|was NOT shared/);
    assert.equal(db.reads, previousReads + (["event", "visibility"].includes(invalidation) ? 1 : 0));
    assert.equal(db.calls.filter((call) => call.name === share).length, 1);
    if (invalidation === "visibility") {
      assert.match(ui.text(), /Private — not shared/);
      assert.equal(ui.button("Save & share with partner"), undefined);
    }
    if (invalidation === "account") {
      db.rows = [row({ user_id: "user-b", repair_status: "partially_repaired", what_helped: "space" })];
      const next = harness(db);
      next.authorize = async () => "new-account-token";
      next.setProps({ userId: "user-b" });
      await next.flush();
      assert.equal(next.selected("A little better"), true);
      assert.doesNotMatch(next.text(), /was saved and shared|Saved for you: I feel reconnected|What helped: Talking/);
    }
  });
}

for (const invalidation of ["account", "refocus", "event", "visibility"]) {
  test(`Finding 6: stale reconciliation after ${invalidation} cannot publish old report or notice`, async () => {
    const pending = deferred();
    const { db, ui } = await sharingScenario({
      respond: async (call, db, original) => {
        const result = await original(call);
        if (call.name === share) throw transportError;
        return result;
      },
      read: () => pending.promise,
    });
    const oldRows = structuredClone(db.rows);
    db.rows = [row({ report_version: 45, repair_status: "partially_repaired", what_helped: "space" })];
    db.read = async () => ({ data: structuredClone(db.rows), error: null });
    if (invalidation === "account") { ui.current = false; ui.unmount(); }
    else if (invalidation === "refocus") ui.refocus();
    else if (invalidation === "event") { db.rows = []; ui.setProps({ eventId: "event-b" }); }
    else ui.setProps({ visibility: "mine" });
    await ui.flush();
    const generationText = ui.text();
    pending.resolve({ data: oldRows, error: null });
    await ui.flush();
    assert.equal(ui.text(), generationText);
    assert.doesNotMatch(ui.text(), /Your current saved update is shared|was saved and shared|was NOT shared/);
    assert.equal(db.calls.filter((call) => call.name === share).length, 1);
    if (["refocus", "visibility"].includes(invalidation)) {
      assert.equal(ui.selected("Space"), true);
      assert.match(ui.text(), /Private — not shared/);
    }
  });
}

for (const latest of [
  row({ report_version: 44, repair_status: "partially_repaired", what_helped: "space" }),
  row({ report_version: 45, sharing_status: "shared", repair_status: "partially_repaired", what_helped: "space" }),
  row({ report_version: 45, sharing_status: "shared", repair_status: "reconnected", what_helped: "talking" }),
  row({ report_version: 43, sharing_status: "shared", repair_status: "reconnected", what_helped: "space" }),
  row({ report_version: 43, sharing_status: "shared", repair_status: "partially_repaired", what_helped: "talking" }),
  row({ report_version: 43, sharing_status: "shared", repair_status: "reconnected", what_helped: "talking", status_origin: "legacy_creator_report" }),
]) {
  test(`Finding 6: changed report ${latest.report_version}/${latest.sharing_status}/${latest.repair_status}/${latest.what_helped}/${latest.status_origin} is current state, not proof of intended sharing`, async () => {
    const { db, ui } = await sharingScenario({
      respond: async (call, db, original) => {
        const result = await original(call);
        if (call.name === share) { db.rows = [latest]; throw transportError; }
        return result;
      },
    });
    assert.match(ui.text(), /Your repair report changed./);
    assert.ok(ui.text().includes(latest.sharing_status === "shared"
      ? "Your current saved update is shared with your partner. This does not confirm whether the earlier update was shared."
      : "Your current saved update is private."));
    assert.ok(!ui.text().includes(sharingSuccess));
    assert.equal(ui.selected("Talking"), true, "automatic reconciliation keeps the author's draft");
    assert.equal(ui.button("Save privately"), undefined);
    assert.doesNotMatch(ui.text(), /was NOT shared/);
    await ui.press("Load newer update (replaces your choices)");
    assert.doesNotMatch(ui.text(), /Your repair report changed|does not confirm/);
    assert.equal(db.calls.filter((call) => call.name === share).length, 1);
    assert.equal(ui.selected(latest.what_helped === "space" ? "Space" : "Talking"), true);
  });
}

for (const records of [
  [],
  [row({ user_id: "user-b", sharing_status: "shared", report_version: 43 })],
  [row({ event_id: "event-b", sharing_status: "shared", report_version: 43 })],
  [row({ sharing_status: "shared", report_version: 41 })],
  [row({ sharing_status: "shared", report_version: Number.MAX_SAFE_INTEGER + 1 })],
  [row({ sharing_status: "shared", report_version: 43 }), row({ sharing_status: "shared", report_version: 43 })],
]) {
  test(`Finding 6: absent or unrelated/invalid authoritative report ${JSON.stringify(records)} leaves outcome unknown`, async () => {
    const { db, ui } = await sharingScenario({
      respond: async (call, db, original) => {
        if (call.name !== share) return original(call);
        db.rows = records;
        throw transportError;
      },
    });
    assert.ok(ui.text().includes(sharingUnknown));
    assertNoFalsePrivacy(ui);
    assert.ok(!ui.text().includes(sharingSuccess));
    assert.equal(ui.selected("Talking"), true);
    assert.equal(ui.button("Save privately"), undefined);
    assert.equal(db.calls.filter((call) => call.name === share).length, 1);
    db.rows = [row({ report_version: 44, repair_status: "partially_repaired", what_helped: "space" })];
    await ui.press("Refresh sharing status (replaces your choices)");
    assert.match(ui.text(), /Your current saved update is private./);
    assert.doesNotMatch(ui.text(), /couldn't confirm|Sharing status needs verification/);
    assert.equal(ui.selected("Space"), true);
  });
}

test("Finding 6: duplicate share confirmations and retained refresh handlers cannot race the share", async () => {
  const db = client([row()]);
  const pending = deferred();
  const original = db.respond;
  db.respond = (call) => call.name === share ? pending.promise : original(call);
  const ui = harness(db);
  await ui.flush();
  const refresh = ui.button("Refresh updates");
  await ui.press("Share saved update");
  const confirm = ui.button("Confirm save & share");
  confirm.props.onPress();
  confirm.props.onPress();
  refresh.props.onPress();
  await ui.flush();
  assert.equal(db.calls.length, 1);
  assert.equal(db.reads, 1);
  assertNoFalsePrivacy(ui);
  db.rows = [row({ report_version: 8, sharing_status: "shared" })];
  pending.resolve({ data: true, error: null });
  await ui.flush();
  assert.ok(ui.text().includes(sharingSuccess));
  assert.equal(db.reads, 2);
  assert.equal(db.calls.length, 1);
});

test("Finding 6: reconciliation rechecks authorization after reading and cannot publish into a changed account", async () => {
  const pending = deferred();
  const { db, ui } = await sharingScenario({
    respond: async (call, db, original) => {
      const result = await original(call);
      if (call.name === share) throw transportError;
      return result;
    },
    read: () => pending.promise,
  });
  let checks = 0;
  ui.authorize = async () => { checks++; ui.current = false; return null; };
  pending.resolve({ data: structuredClone(db.rows), error: null });
  await ui.flush();
  assert.equal(checks, 1);
  assert.ok(!ui.text().includes(sharingSuccess));
  assert.doesNotMatch(ui.text(), /Your current saved update is shared|was NOT shared/);
});

test("Finding 6: only exact reviewed P0001 messages count as definitive share rejection", () => {
  const db = client();
  for (const error of [transportError, { message: "Moment unavailable for sharing" },
    { code: "P0001", message: "Moment unavailable for sharing: PRIVATE_DETAIL" },
    { code: "P0001", message: "PRIVATE_SQL_MESSAGE" }, null]) {
    assert.equal(db.lib.isRepairSharingRejection(error), false);
  }
  assert.equal(db.lib.isRepairSharingRejection({ code: "P0001", message: "Moment unavailable for sharing" }), true);
});

test("Finding 6: confirmed sharing followed by withdrawal describes historical success and current privacy", async () => {
  const { ui } = await sharingScenario({
    respond: async (call, db, original) => {
      const result = await original(call);
      if (call.name === share) db.rows = [row({ report_version: 44, repair_status: "reconnected", what_helped: "talking" })];
      return result;
    },
  });
  assert.match(ui.text(), /Sharing was confirmed. Your repair report changed. Your current saved update is private./);
  assert.doesNotMatch(ui.text(), /couldn't confirm|was NOT shared/);
  assert.equal(ui.selected("Talking"), true);
});

test("Finding 6: later manual refresh replaces an old success notice with current sharing state", async () => {
  const { db, ui } = await sharingScenario();
  assert.ok(ui.text().includes(sharingSuccess));
  db.rows = [row({ report_version: 44, repair_status: "partially_repaired", what_helped: "space" })];
  await ui.press("Refresh updates");
  assert.match(ui.text(), /Private — not shared/);
  assert.ok(!ui.text().includes(sharingSuccess));
  assert.equal(ui.selected("Space"), true);
  assert.equal(db.calls.filter((call) => call.name === share).length, 1);
});

// Finding 10: private-save acknowledgment and the latest observed report are
// separate facts. Exercise the real component, including its rendered summary.
const privateSaved = "Saved privately.";
const privateUnverified = "The current sharing status could not be verified. Please refresh to check it.";

async function privateSaveScenario({ initial = [row()], respond, read } = {}) {
  const db = client(initial);
  const original = db.respond;
  if (respond) db.respond = (call) => respond(call, db, original);
  const ui = harness(db);
  await ui.flush();
  await edit(ui);
  if (read) db.read = (call) => read(call, db);
  await ui.press("Save privately");
  return { db, ui };
}

function assertPrivateSaveOnly(db) {
  assert.equal(db.calls.length, 1, "reconciliation never resubmits or shares");
  assert.equal(db.calls[0].name, checkedSave);
  assert.equal(db.calls[0].args.p_expected_report_version, 7);
  assert.equal(db.calls[0].headers.Authorization, "Bearer author-token");
}

function assertPrivateSaveUnverified(ui) {
  assert.ok(ui.text().includes(privateSaved), "retain the acknowledged operation");
  assert.ok(ui.text().includes(privateUnverified));
  assert.match(ui.text(), /Sharing status needs verification/);
  assertNoFalsePrivacy(ui);
  assert.doesNotMatch(ui.text(), /The latest refresh found|Your repair report changed since this save/);
  assert.equal(ui.selected("I feel reconnected"), true);
  assert.equal(ui.selected("Talking"), true);
  assert.equal(ui.button("Save privately"), undefined);
  assert.equal(ui.button("Save & share with partner"), undefined);
}

test("Finding 10: verified private save reconciles summary and notice", async () => {
  const { db, ui } = await privateSaveScenario();
  assert.ok(ui.text().includes(privateSaved));
  assert.match(ui.text(), /The latest refresh found your update private\./);
  assert.match(ui.text(), /Saved for you: I feel reconnected/);
  assert.match(ui.text(), /Private — not shared/);
  assert.doesNotMatch(ui.text(), /It was not shared|changed since this save|could not be verified/);
  assertPrivateSaveOnly(db);
  assert.equal(db.reads, 2);
  assert.deepEqual(db.readCalls.map((call) => call.headers), [
    { Authorization: "Bearer author-token" }, { Authorization: "Bearer author-token" },
  ]);
});

test("Finding 10: concurrent sharing after private save reconciles summary and notice", async () => {
  const { db, ui } = await privateSaveScenario({
    respond: async (call, db, original) => {
      const result = await original(call);
      // Another signed-in session explicitly shared the acknowledged version.
      db.rows = db.rows.map((report) => ({ ...report, sharing_status: "shared", report_version: 43 }));
      return result;
    },
  });
  assert.match(ui.text(), /Shared with your partner/);
  assert.doesNotMatch(ui.text(), /It was not shared|Private — not shared/);
  assert.ok(ui.text().includes(privateSaved));
  assert.match(ui.text(), /Your repair report changed since this save\. The latest refresh found your update shared with your partner\./);
  assert.equal(ui.selected("Talking"), true);
  assert.equal(ui.button("Save privately"), undefined);
  assert.ok(ui.button("Load newer update (replaces your choices)"));
  assertPrivateSaveOnly(db);
});

for (const sharing of ["private", "shared"]) {
  for (const sameContent of [false, true]) {
    test(`Finding 10: newer ${sharing} report with ${sameContent ? "same" : "different"} content is not the saved version`, async () => {
      const latest = row({ report_version: 45, sharing_status: sharing,
        repair_status: sameContent ? "reconnected" : "partially_repaired",
        what_helped: sameContent ? "talking" : "space" });
      const { db, ui } = await privateSaveScenario({
        respond: async (call, db, original) => { const result = await original(call); db.rows = [latest]; return result; },
      });
      assert.ok(ui.text().includes(privateSaved));
      assert.match(ui.text(), /Your repair report changed since this save/);
      assert.ok(ui.text().includes(`The latest refresh found your update ${sharing === "shared" ? "shared with your partner" : "private"}.`));
      assert.match(ui.text(), sharing === "shared" ? /Shared with your partner/ : /Private — not shared/);
      assert.doesNotMatch(ui.text(), /It was not shared|could not be verified/);
      assert.equal(ui.selected("I feel reconnected"), true, "automatic read preserves choices");
      assert.equal(ui.selected("Talking"), true);
      assert.equal(ui.button("Save privately"), undefined);
      assert.equal(ui.button("Save & share with partner"), undefined);
      await ui.press("Load newer update (replaces your choices)");
      assert.equal(ui.selected(sameContent ? "Talking" : "Space"), true);
      assert.doesNotMatch(ui.text(), /Saved privately\.|changed since this save/);
      assertPrivateSaveOnly(db);
    });
  }
}

for (const [description, records] of [
  ["missing report", []],
  ["null read data", null],
  ["only partner's shared report", [row({ user_id: "user-b", sharing_status: "shared", report_version: 43 })]],
  ["foreign event", [row({ event_id: "event-b", report_version: 42 })]],
  ["malformed author", [row({ user_id: null, report_version: 42 })]],
  ["duplicate own reports", [row({ report_version: 42 }), row({ report_version: 42 })]],
  ["older version", [row({ report_version: 41 })]],
  ["zero version", [row({ report_version: 0 })]],
  ["fractional version", [row({ report_version: 42.5 })]],
  ["unsafe version", [row({ report_version: Number.MAX_SAFE_INTEGER + 1 })]],
  ["string version", [row({ report_version: "42" })]],
  ["missing version", [row({ report_version: undefined })]],
  ["invalid sharing state", [row({ report_version: 43, sharing_status: "unexpected" })]],
  ["invalid repair status", [row({ report_version: 43, repair_status: "PRIVATE_BAD_STATUS" })]],
  ["invalid repair method", [row({ report_version: 43, what_helped: "PRIVATE_BAD_METHOD" })]],
  ["unexpected provenance", [row({ report_version: 43, status_origin: "legacy_creator_report" })]],
  ["same version with different content", [row({ report_version: 42 })]],
  ["same version with impossible sharing state", [row({ report_version: 42, sharing_status: "shared", repair_status: "reconnected", what_helped: "talking" })]],
]) {
  test(`Finding 10: ${description} cannot establish current privacy after private save`, async () => {
    const { db, ui } = await privateSaveScenario({ read: async () => ({ data: records, error: null }) });
    assertPrivateSaveUnverified(ui);
    assertPrivateSaveOnly(db);
    assert.equal(db.reads, 2);
  });
}

for (const thrown of [false, true]) {
  test(`Finding 10: ${thrown ? "thrown" : "returned"} refresh failure preserves acknowledged saving and choices`, async () => {
    const { db, ui } = await privateSaveScenario({
      initial: [row({ sharing_status: "shared" })],
      read: async () => { if (thrown) throw transportError; return { data: null, error: transportError }; },
    });
    assertPrivateSaveUnverified(ui);
    await ui.press("Refresh sharing status (replaces your choices)");
    assertPrivateSaveUnverified(ui);
    db.rows = [row({ report_version: 45, repair_status: "partially_repaired", what_helped: "space", sharing_status: "shared" })];
    db.read = async () => ({ data: structuredClone(db.rows), error: null });
    await ui.press("Refresh sharing status (replaces your choices)");
    assert.match(ui.text(), /The latest refresh found your update shared with your partner\./);
    assert.match(ui.text(), /Shared with your partner/);
    assert.equal(ui.selected("Space"), true, "only deliberate reload replaces the choices");
    assert.doesNotMatch(ui.text(), /could not be verified|Sharing status needs verification|It was not shared/);
    assertPrivateSaveOnly(db);
  });
}

for (const invalidation of ["account", "blur", "unmount", "refocus", "event", "visibility"]) {
  test(`Finding 10: ${invalidation} during private-save refresh suppresses stale rows and notice`, async () => {
    const pending = deferred();
    const { db, ui } = await privateSaveScenario({ read: () => pending.promise });
    const oldRows = structuredClone(db.rows);
    assert.equal(db.reads, 2);
    db.rows = [row({ report_version: 46, repair_status: "partially_repaired", what_helped: "space" })];
    db.read = async () => ({ data: structuredClone(db.rows), error: null });
    if (invalidation === "account") { ui.current = false; ui.unmount(); }
    else if (["blur", "unmount", "refocus"].includes(invalidation)) ui[invalidation]();
    else if (invalidation === "event") { db.rows = []; ui.setProps({ eventId: "event-b" }); }
    else ui.setProps({ visibility: "mine" });
    await ui.flush();
    const text = ui.text();
    pending.resolve({ data: oldRows, error: null });
    await ui.flush();
    assert.equal(ui.text(), text, "discarded read cannot publish a completion afterward");
    assert.doesNotMatch(ui.text(), /Saved privately\.|The latest refresh found|It was not shared/);
    assertPrivateSaveOnly(db);
    if (["refocus", "visibility"].includes(invalidation)) {
      assert.match(ui.text(), /Private — not shared/);
      assert.equal(ui.selected("Space"), true);
    }
    if (invalidation === "account") {
      db.rows = [row({ user_id: "user-b", repair_status: "partially_repaired", what_helped: "space" })];
      const next = harness(db);
      next.authorize = async () => "account-b-token";
      next.setProps({ userId: "user-b" });
      await next.flush();
      assert.equal(next.selected("Space"), true);
      assert.doesNotMatch(next.text(), /Saved privately\.|The latest refresh found|What helped: Talking/);
    }
  });
}

test("Finding 10: account switch during private save cannot publish or refresh for the replacement account", async () => {
  const pending = deferred();
  const { db, ui } = await privateSaveScenario({ respond: () => pending.promise });
  assert.equal(db.calls[0].headers.Authorization, "Bearer author-token");
  ui.current = false;
  ui.unmount();
  const before = ui.text();
  pending.resolve({ data: 42, error: null });
  await ui.flush();
  assert.equal(ui.text(), before);
  assert.doesNotMatch(ui.text(), /Saved privately\.|The latest refresh found/);
  assert.equal(db.reads, 1);
  assertPrivateSaveOnly(db);
});

test("Finding 10: post-read authorization rejects silent account replacement before private-save feedback", async () => {
  const pending = deferred();
  const { db, ui } = await privateSaveScenario({ read: () => pending.promise });
  let checks = 0;
  ui.authorize = async () => { checks++; ui.current = false; return null; };
  pending.resolve({ data: structuredClone(db.rows), error: null });
  await ui.flush();
  assert.equal(checks, 1);
  assert.doesNotMatch(ui.text(), /Saved privately\.|The latest refresh found|Private — not shared/);
  assertPrivateSaveOnly(db);
});

test("Finding 10: same-account token refresh keeps the save pinned and verifies the latest read", async () => {
  const pending = deferred();
  const { db, ui } = await privateSaveScenario({ respond: () => pending.promise });
  ui.authorize = async () => "refreshed-author-token";
  db.rows = [row({ report_version: 42, repair_status: "reconnected", what_helped: "talking" })];
  pending.resolve({ data: 42, error: null });
  await ui.flush();
  assertPrivateSaveOnly(db);
  assert.equal(db.readCalls[1].headers.Authorization, "Bearer refreshed-author-token");
  assert.match(ui.text(), /The latest refresh found your update private\./);
  assert.match(ui.text(), /Private — not shared/);
});

test("Finding 10: duplicate saves and retained refresh cannot compete with post-save reconciliation", async () => {
  const db = client([row()]);
  const ui = harness(db);
  await ui.flush();
  await edit(ui);
  const save = ui.button("Save privately");
  const refresh = ui.button("Refresh updates");
  const pending = deferred();
  db.read = () => pending.promise;
  save.props.onPress();
  save.props.onPress();
  await ui.flush();
  save.props.onPress();
  refresh.props.onPress();
  await ui.flush();
  assertPrivateSaveOnly(db);
  assert.equal(db.reads, 2, "retained refresh is blocked during the write");
  pending.resolve({ data: structuredClone(db.rows), error: null });
  await ui.flush();
  assert.match(ui.text(), /The latest refresh found your update private\./);
  assert.match(ui.text(), /Private — not shared/);
  assertPrivateSaveOnly(db);
});

test("Finding 10: private-save conflict never acknowledges success or replaces choices", async () => {
  const { db, ui } = await privateSaveScenario({ respond: async () => ({ error: conflict }) });
  assert.match(ui.text(), /newer repair report exists/);
  assert.doesNotMatch(ui.text(), /Saved privately\.|The latest refresh found|It was not shared/);
  assert.equal(ui.selected("Talking"), true);
  assert.equal(ui.button("Save privately"), undefined);
  assertPrivateSaveOnly(db);
  assert.equal(db.reads, 1, "no automatic reload or retry after a reviewed-version conflict");
});

test("Finding 10: later refresh clears private-save feedback when observing a shared report", async () => {
  const { db, ui } = await privateSaveScenario();
  db.rows = [row({ report_version: 43, repair_status: "reconnected", what_helped: "talking", sharing_status: "shared" })];
  await ui.press("Refresh updates");
  assert.match(ui.text(), /Shared with your partner/);
  assert.doesNotMatch(ui.text(), /Saved privately\.|The latest refresh found your update private|It was not shared/);
  assertPrivateSaveOnly(db);
});
