const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadSource } = require("./helpers/account-screen-harness.cjs");
const { row, client, harness, deferred, checkedSave, share, withdraw, conflict } = require("./helpers/repair-section-harness.cjs");

// Real repair component, shared cards/pills and typed RPC client. Hooks, native
// hosts and transport are synthetic; this is not device, browser or RLS evidence.
const { tokens } = loadSource("src/components/couply-tokens.ts", {});
const statusLabels = ["Still unresolved", "A little better", "I feel reconnected"];
const methodChoices = [[null, "Not sure / none"], ["talking", "Talking"], ["space", "Space"],
  ["apology", "Apology"], ["affection", "Affection"], ["humour", "Humour"],
  ["practical_action", "Practical action"], ["time", "Time"], ["other", "Other"]];
const style = (value) => Array.isArray(value) ? Object.assign({}, ...value.map(style)) : value || {};
const text = (node) => Array.isArray(node) ? node.map(text).join("") : node && typeof node === "object"
  ? text(node.props?.children) : typeof node === "string" ? node : "";
const radios = (ui) => ui.nodes().filter((node) => node.props.accessibilityRole === "radio");
const byLabel = (ui, label) => ui.nodes().find((node) => node.props.accessibilityLabel === label);
const alert = (ui) => ui.nodes().find((node) => node.props.accessibilityRole === "alert");
async function setup(t, rows = [row()], visibility = "ours", configure) {
  const db = client(rows); configure?.(db);
  const ui = harness(db, visibility); t.after(ui.unmount); await ui.flush();
  return { db, ui };
}
async function choose(ui) { await ui.press("I feel reconnected"); await ui.press("Talking"); }
async function startSharing(ui) {
  await ui.press(ui.button("Share saved update") ? "Share saved update" : "Save & share with partner");
}

test("personal header and ownership explanation use the shared Event Detail card surface", async (t) => {
  const { db, ui } = await setup(t);
  const root = ui.nodes()[0];
  assert.equal(style(root.props.style).backgroundColor, tokens.colors.surface);
  assert.equal(style(root.props.style).borderRadius, tokens.radii.card);
  assert.ok(ui.nodes().some((node) => node.props.accessibilityRole === "header" && text(node) === "Your repair update"));
  assert.match(ui.text(), /Your experience belongs to you/);
  assert.match(ui.text(), /Choose to save privately or explicitly share your update/);
  assert.match(ui.text(), /Saved for you: Still unresolved/);
  assert.match(ui.text(), /Private — not shared/);
  assert.equal(db.calls.length, 0);
});

test("the three existing status controls retain radio roles and checked state", async (t) => {
  const { ui } = await setup(t);
  assert.deepEqual(radios(ui).map((node) => node.props.accessibilityLabel), statusLabels);
  assert.equal(byLabel(ui, "How does this feel now?").props.accessibilityRole, "radiogroup");
  assert.deepEqual(radios(ui).map((node) => node.props.accessibilityState.checked), [true, false, false]);
  await ui.press("A little better");
  assert.equal(ui.selected("A little better"), true);
  assert.equal(ui.selected("Still unresolved"), false);
  assert.equal(style(ui.button("A little better").props.style).backgroundColor, tokens.colors.plum);
});

for (const [value, label] of methodChoices) {
  test(`what-helped ${label} preserves its stored value and optional radio semantics`, async (t) => {
    const { db, ui } = await setup(t);
    assert.equal(byLabel(ui, "What helped? (optional)"), undefined);
    await ui.press("I feel reconnected");
    assert.equal(byLabel(ui, "What helped? (optional)").props.accessibilityRole, "radiogroup");
    assert.deepEqual(radios(ui).slice(3).map((node) => node.props.accessibilityLabel), methodChoices.map((item) => item[1]));
    await ui.press(label); assert.equal(ui.selected(label), true);
    await ui.press("Save privately");
    assert.equal(db.calls[0].name, checkedSave);
    assert.equal(db.calls[0].args.p_what_helped, value);
    assert.equal(db.calls[0].args.p_expected_report_version, 7);
  });
}

test("choosing Still unresolved hides methods and sends an explicit null method", async (t) => {
  const { db, ui } = await setup(t, [row({ repair_status: "reconnected", what_helped: "talking" })]);
  assert.equal(ui.selected("Talking"), true);
  await ui.press("Still unresolved");
  assert.equal(ui.button("Talking"), undefined);
  await ui.press("Save privately");
  assert.equal(db.calls[0].args.p_repair_status, "open");
  assert.equal(db.calls[0].args.p_what_helped, null);
});

for (const visibility of ["mine", "ours"]) {
  for (const status_origin of ["legacy_default_unconfirmed", "legacy_creator_report"]) {
    test(`${visibility} ${status_origin} is historical, unselected and requires a current choice`, async (t) => {
      const historical = row({ status_origin, repair_status: status_origin === "legacy_creator_report" ? "reconnected" : "open", what_helped: "talking" });
      const { db, ui } = await setup(t, [historical], visibility);
      assert.ok(radios(ui).every((node) => node.props.accessibilityState.checked === false));
      assert.equal(ui.button("Save privately").props.disabled, true);
      assert.equal(ui.button("Save & share with partner"), undefined);
      assert.match(ui.text(), status_origin === "legacy_default_unconfirmed" ? /Imported status: Open — not confirmed by you/ : /Earlier report: I feel reconnected/);
      if (status_origin === "legacy_default_unconfirmed") assert.doesNotMatch(ui.text(), /What helped: Talking|Saved for you:/);
      else assert.match(ui.text(), /What helped in that report: Talking/);
      assert.equal(db.calls.length, 0);
    });
  }
}

for (const existing of [false, true]) {
  test(`private ${existing ? "update" : "first report"} retains its checked version and reconciliation`, async (t) => {
    const { db, ui } = await setup(t, existing ? [row()] : [], "mine");
    if (!existing) {
      assert.match(ui.text(), /haven't recorded a personal repair update/);
      assert.ok(radios(ui).every((node) => !node.props.accessibilityState.checked));
    }
    await choose(ui); await ui.press("Save privately");
    assert.deepEqual(db.calls[0], { name: checkedSave, args: {
      p_event_id: "event-a", p_repair_status: "reconnected", p_what_helped: "talking", p_expected_report_version: existing ? 7 : null,
    }, headers: { Authorization: "Bearer author-token" } });
    assert.equal(db.calls.length, 1);
    assert.match(ui.text(), /Saved privately/);
    assert.match(ui.text(), /latest refresh found your update private/);
    assert.equal(ui.button("Save & share with partner"), undefined);
  });
}

test("editing a shared report retains the warning and saves the edit privately", async (t) => {
  const { db, ui } = await setup(t, [row({ sharing_status: "shared" })]);
  await choose(ui);
  assert.match(ui.text(), /Saving privately withdraws your previous shared update/);
  assert.match(ui.text(), /partner may already have seen the earlier update/);
  await ui.press("Save privately");
  assert.equal(db.calls[0].name, checkedSave);
  assert.equal(db.rows[0].sharing_status, "private");
});

test("Save and share requires confirmation and shares the exact returned save version", async (t) => {
  const { db, ui } = await setup(t);
  await choose(ui); await startSharing(ui);
  assert.match(ui.text(), /does not imply they agree or feel reconnected/);
  assert.equal(db.calls.length, 0);
  await ui.press("Confirm save & share");
  assert.deepEqual(db.calls.map((call) => call.name), [checkedSave, share]);
  assert.equal(db.calls[0].args.p_expected_report_version, 7);
  assert.equal(db.calls[1].args.p_expected_report_version, 42);
  assert.ok(db.calls.every((call) => call.headers.Authorization === "Bearer author-token"));
  assert.match(ui.text(), /saved and shared with your partner/);
});

test("sharing cancellation leaves the report and draft unchanged without a write", async (t) => {
  const { db, ui } = await setup(t);
  await choose(ui); await startSharing(ui);
  assert.ok(byLabel(ui, "Cancel sharing")); await ui.press("Cancel");
  assert.equal(ui.button("Confirm save & share"), undefined);
  assert.equal(ui.selected("I feel reconnected"), true); assert.equal(ui.selected("Talking"), true);
  assert.equal(db.rows[0].sharing_status, "private"); assert.equal(db.calls.length, 0);
});

test("an unchanged explicit private report shares its reviewed version without another save", async (t) => {
  const { db, ui } = await setup(t);
  await startSharing(ui); await ui.press("Confirm save & share");
  assert.deepEqual(db.calls.map((call) => call.name), [share]);
  assert.equal(db.calls[0].args.p_expected_report_version, 7);
});

test("withdrawal keeps private-record wording, cancel and the checked increment acknowledgment", async (t) => {
  const { db, ui } = await setup(t, [row({ sharing_status: "shared" })]);
  await ui.press("Withdraw shared update");
  assert.match(ui.text(), /Your private record will remain/);
  assert.ok(byLabel(ui, "Cancel withdrawal")); await ui.press("Cancel");
  assert.equal(db.calls.length, 0);
  const original = db.respond;
  db.respond = async (call) => {
    if (call.name !== withdraw) return original(call);
    db.rows = [row({ sharing_status: "private", report_version: 8 })];
    return { data: 8, error: null };
  };
  await ui.press("Withdraw shared update"); await ui.press("Confirm withdrawal");
  assert.deepEqual(db.calls[0], { name: withdraw, args: { p_event_id: "event-a", p_expected_report_version: 7 }, headers: { Authorization: "Bearer author-token" } });
  assert.match(ui.text(), /Withdrawal recorded; your personal record remains/);
  assert.match(ui.text(), /Private — not shared/);
});

for (const visibility of ["mine", "ours"]) {
  test(`partner shared panel on ${visibility} respects scope and individual attribution`, async (t) => {
    const { ui } = await setup(t, [row(), row({ user_id: "partner", sharing_status: "shared", repair_status: "reconnected", what_helped: "space" })], visibility);
    const panel = ui.nodes().find((node) => node.type === "View" && style(node.props.style).backgroundColor === tokens.colors.surfaceBlush && text(node).includes("Your partner's shared update"));
    assert.equal(Boolean(panel), visibility === "ours");
    if (visibility === "ours") {
      assert.match(text(panel), /What helped them: Space/);
      assert.match(text(panel), /not a joint conclusion/);
    } else assert.doesNotMatch(ui.text(), /What helped them: Space/);
  });
}

test("private partner reports stay hidden and cannot preselect the caller's repair choices", async (t) => {
  const { ui } = await setup(t, [row({ user_id: "partner", sharing_status: "private", repair_status: "reconnected", what_helped: "humour" })]);
  assert.match(ui.text(), /No repair update has been shared with you/);
  assert.match(ui.text(), /haven't recorded a personal repair update/);
  assert.doesNotMatch(ui.text(), /What helped them: Humour|Saved for you:/);
  assert.ok(radios(ui).every((node) => !node.props.accessibilityState.checked));
});

test("two reconnected reports remain independent rather than a relationship-level conclusion", async (t) => {
  const { ui } = await setup(t, [row({ repair_status: "reconnected", sharing_status: "shared" }), row({ user_id: "partner", repair_status: "reconnected", sharing_status: "shared" })]);
  assert.match(ui.text(), /Saved for you: I feel reconnected/);
  assert.match(ui.text(), /Your partner's shared update/);
  assert.match(ui.text(), /not a joint conclusion/);
  assert.doesNotMatch(ui.text(), /You both|mutually repaired|relationship is repaired|relationship health/);
});

test("loading and read errors use cards, accessible retry and the existing generic error mapping", async (t) => {
  const pending = deferred();
  const { db, ui } = await setup(t, [], "ours", (db) => { db.read = () => pending.promise; });
  assert.match(ui.text(), /Loading personal updates/); assert.equal(radios(ui).length, 0);
  assert.equal(ui.button("Refresh updates").props.accessibilityState.disabled, true);
  assert.ok(ui.nodes().some((node) => node.type === "ActivityIndicator" && node.props.color === tokens.colors.plum));
  pending.resolve({ data: null, error: { message: "PRIVATE_ERROR_DETAIL" } }); await ui.flush();
  assert.ok(byLabel(ui, "Could not load updates. Tap to retry.")); assert.ok(alert(ui));
  assert.doesNotMatch(ui.text(), /PRIVATE_ERROR_DETAIL|No repair update has been shared/);
  db.read = async () => ({ data: [row()], error: null });
  await ui.press("Could not load updates. Tap to retry.");
  assert.match(ui.text(), /Saved for you: Still unresolved/); assert.equal(db.calls.length, 0);
});

test("pending private saving preserves radio semantics, disables controls and blocks duplicate dispatch", async (t) => {
  const { db, ui } = await setup(t);
  await choose(ui); const pending = deferred(), original = db.respond;
  db.respond = (call) => pending.promise.then(() => original(call));
  const save = ui.button("Save privately").props.onPress;
  save(); await ui.flush(); save(); await ui.flush();
  assert.equal(db.calls.length, 1);
  assert.ok(radios(ui).every((node) => node.props.disabled && node.props.accessibilityState.disabled));
  assert.equal(ui.selected("I feel reconnected"), true); assert.equal(ui.selected("Talking"), true);
  assert.equal(byLabel(ui, "Save privately").props.disabled, true);
  pending.resolve(); await ui.flush();
});

test("in-flight sharing has a verification badge rather than a premature success claim", async (t) => {
  const { db, ui } = await setup(t);
  await startSharing(ui); const pending = deferred(), original = db.respond;
  db.respond = (call) => pending.promise.then(() => original(call));
  ui.button("Confirm save & share").props.onPress(); await ui.flush();
  assert.match(ui.text(), /Sharing status needs verification/);
  assert.doesNotMatch(ui.text(), /Your update was saved and shared/);
  assert.ok(radios(ui).every((node) => node.props.disabled));
  pending.resolve(); await ui.flush(); assert.match(ui.text(), /Your update was saved and shared/);
});

for (const operation of ["private", "share", "withdraw"]) {
  test(`${operation} version conflicts retain choices and expose explicit reload recovery`, async (t) => {
    const { db, ui } = await setup(t, [row({ sharing_status: operation === "withdraw" ? "shared" : "private" })]);
    await choose(ui);
    db.respond = async () => ({ data: null, error: operation === "withdraw"
      ? { code: "P0001", message: "Repair update changed; reload before withdrawing" } : conflict });
    if (operation === "private") await ui.press("Save privately");
    if (operation === "share") { await startSharing(ui); await ui.press("Confirm save & share"); }
    if (operation === "withdraw") { await ui.press("Withdraw shared update"); await ui.press("Confirm withdrawal"); }
    assert.ok(alert(ui));
    assert.match(text(alert(ui)), operation === "withdraw" ? /Sharing was not withdrawn by this request/ : /choices are still here and were not saved or shared/);
    assert.equal(ui.selected("I feel reconnected"), true); assert.equal(ui.selected("Talking"), true);
    assert.ok(ui.button("Load newer update (replaces your choices)")); assert.equal(db.calls.length, 1);
    await ui.press("Load newer update (replaces your choices)");
    assert.equal(ui.selected("Still unresolved"), true); assert.equal(db.calls.length, 1);
  });
}

for (const operation of ["save", "share", "withdraw"]) {
  for (const committed of [false, true]) {
    test(`unknown ${operation} outcome, committed=${committed}, does not automatically retry`, async (t) => {
      const { db, ui } = await setup(t, [row({ sharing_status: operation === "withdraw" ? "shared" : "private" })]);
      const original = db.respond;
      db.respond = async (call) => {
        if (committed) {
          if (operation === "withdraw") db.rows = [row({ report_version: 8 })];
          else await original(call);
        }
        return operation === "share" ? { data: null, error: { message: "Synthetic lost response" } } : { data: null, error: null };
      };
      if (operation === "save") { await choose(ui); await ui.press("Save privately"); }
      if (operation === "share") { await startSharing(ui); await ui.press("Confirm save & share"); }
      if (operation === "withdraw") { await ui.press("Withdraw shared update"); await ui.press("Confirm withdrawal"); }
      assert.equal(db.calls.length, 1);
      assert.doesNotMatch(ui.text(), /Your update was saved and shared|Withdrawal recorded/);
      if (operation === "save") {
        assert.doesNotMatch(ui.text(), /Saved privately\./);
        assert.equal(ui.selected("I feel reconnected"), true);
      }
      if (operation === "withdraw") assert.match(ui.text(), /withdrawal could not be confirmed/);
      if (operation === "share") assert.match(ui.text(), committed ? /current saved update is shared with your partner/ : /current saved update is private/);
      const recovery = ui.button("Load newer update (replaces your choices)") ? "Load newer update (replaces your choices)" : "Refresh updates";
      await ui.press(recovery); assert.equal(db.calls.length, 1);
    });
  }
}

test("narrow-layout style contracts allow wrapping without changing labels or radio roles", async (t) => {
  const { ui } = await setup(t); await choose(ui);
  const groups = ui.nodes().filter((node) => node.props.accessibilityRole === "radiogroup");
  assert.equal(groups.length, 2);
  assert.ok(groups.every((node) => style(node.props.style).flexWrap === "wrap"));
  for (const node of ui.nodes().filter((node) => node.type === "Pressable")) {
    assert.ok(style(node.props.style).minHeight >= tokens.layout.minTouchTarget);
    assert.equal(node.props.accessibilityRole, node.props.accessibilityState?.checked === undefined ? "button" : "radio");
  }
  for (const node of radios(ui)) {
    assert.equal(style(node.props.style).maxWidth, "100%");
    assert.notEqual(node.props.children.props.allowFontScaling, false);
    assert.equal(node.props.children.props.numberOfLines, undefined);
  }
});

test("initial loading and refresh remain author-pinned reads with no automatic mutation", async (t) => {
  const { db, ui } = await setup(t);
  assert.equal(db.reads, 1); assert.equal(db.calls.length, 0);
  await ui.press("Refresh updates");
  assert.equal(db.reads, 2); assert.equal(db.calls.length, 0);
  assert.ok(db.readCalls.every((call) => call.eventId === "event-a" && call.headers.Authorization === "Bearer author-token"));
});
