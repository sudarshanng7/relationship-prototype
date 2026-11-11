const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { row, client, harness, deferred, checkedSave, share, conflict, confirmShare } = require("./helpers/repair-section-harness.cjs");

const imported = (extra) => row({ status_origin: "legacy_default_unconfirmed", ...extra });
const noChoice = (ui) => {
  for (const label of ["Still unresolved", "A little better", "I feel reconnected"]) assert.equal(ui.selected(label), false);
  assert.equal(ui.button("Save privately").props.disabled, true);
  assert.equal(ui.button("Save & share with partner"), undefined);
};

for (const visibility of ["mine", "ours"]) {
  test(`A04: imported Open ${visibility} is historical, unselected and cannot save/share on load`, async (t) => {
    const db = client([imported()]), ui = harness(db, visibility); t.after(ui.unmount);
    await ui.flush();
    assert.match(ui.text(), /Imported status: Open — not confirmed by you/);
    assert.match(ui.text(), /may have been set automatically/);
    assert.doesNotMatch(ui.text(), /Saved for you: Still unresolved|Last loaded for you: Still unresolved/);
    noChoice(ui);
    ui.button("Save privately").props.onPress(); await ui.flush();
    assert.equal(db.calls.length, 0);
    assert.equal(db.rows[0].status_origin, "legacy_default_unconfirmed");
  });

  for (const [label, status] of [["Still unresolved", "open"], ["I feel reconnected", "reconnected"]]) {
    test(`A04: intentional ${status} on imported Open ${visibility} saves privately with reviewed version`, async (t) => {
      const db = client([imported()]), ui = harness(db, visibility); t.after(ui.unmount); await ui.flush();
      await ui.press(label);
      assert.equal(db.calls.length, 0);
      assert.equal(db.rows[0].status_origin, "legacy_default_unconfirmed");
      assert.match(ui.text(), /Imported status: Open/);
      await ui.press("Save privately");
      assert.equal(db.calls.length, 1);
      assert.equal(db.calls[0].name, checkedSave);
      assert.deepEqual(db.calls[0].args, { p_event_id: "event-a", p_repair_status: status, p_what_helped: null, p_expected_report_version: 7 });
      assert.equal(db.calls[0].headers.Authorization, "Bearer author-token");
      assert.equal(db.rows[0].status_origin, "explicit");
      assert.match(ui.text(), /Saved for you:/);
      assert.doesNotMatch(ui.text(), /Imported status:/);
      assert.equal(db.rows[0].sharing_status, "private");
    });
  }
}

test("A04: selection alone and pending save cannot relabel historical provenance", async (t) => {
  const db = client([imported()]), ui = harness(db); t.after(ui.unmount); await ui.flush();
  await ui.press("Still unresolved");
  const pending = deferred(), respond = db.respond; db.respond = () => pending.promise;
  ui.button("Save privately").props.onPress(); await ui.flush();
  assert.match(ui.text(), /Imported status: Open/);
  assert.equal(db.rows[0].status_origin, "legacy_default_unconfirmed");
  pending.resolve(await respond(db.calls[0])); await ui.flush();
  assert.match(ui.text(), /Saved for you: Still unresolved/);
});

test("A04: sharing imported Open requires choice, confirmation, checked save and actual returned version", async (t) => {
  const db = client([imported()]), ui = harness(db); t.after(ui.unmount); await ui.flush();
  noChoice(ui); await ui.press("Still unresolved");
  await ui.press("Save & share with partner");
  assert.match(ui.text(), /reflects how you feel now/);
  assert.equal(db.calls.length, 0);
  await ui.press("Confirm save & share");
  assert.deepEqual(db.calls.map((call) => call.name), [checkedSave, share]);
  assert.equal(db.calls[0].args.p_expected_report_version, 7);
  assert.equal(db.calls[1].args.p_expected_report_version, 42);
  assert.equal(db.rows[0].sharing_status, "shared");
});

for (const status of ["partially_repaired", "reconnected"]) {
  test(`A04: confirmed historical ${status} keeps earlier-report provenance and requires current choice`, async (t) => {
    const db = client([row({ status_origin: "legacy_creator_report", repair_status: status, what_helped: "talking" })]);
    const ui = harness(db); t.after(ui.unmount); await ui.flush();
    assert.match(ui.text(), /Earlier report:/);
    assert.match(ui.text(), /preserved report from an earlier version/);
    assert.match(ui.text(), /What helped in that report: Talking/);
    assert.doesNotMatch(ui.text(), /may have been set automatically|Saved for you:/);
    noChoice(ui);
    assert.equal(db.calls.length, 0);
    await ui.press("I feel reconnected"); await ui.press("Save privately");
    assert.equal(db.calls[0].args.p_expected_report_version, 7);
    assert.equal(db.rows[0].status_origin, "explicit");
  });
}

test("A04: explicit reports retain existing preselection and checked editing behavior", async (t) => {
  const db = client([row()]), ui = harness(db); t.after(ui.unmount); await ui.flush();
  assert.match(ui.text(), /Saved for you: Still unresolved/);
  assert.equal(ui.selected("Still unresolved"), true);
  assert.equal(ui.button("Save privately"), undefined);
  await ui.press("A little better"); await ui.press("Save privately");
  assert.equal(db.calls[0].args.p_repair_status, "partially_repaired");
  assert.equal(db.calls[0].args.p_expected_report_version, 7);
});

test("A04: a partner's report cannot become caller's imported history or active selection", async (t) => {
  const db = client([row({ user_id: "user-b", sharing_status: "shared", repair_status: "reconnected" })]);
  const ui = harness(db); t.after(ui.unmount); await ui.flush();
  assert.match(ui.text(), /haven't recorded a personal repair update/);
  assert.equal(ui.selected("I feel reconnected"), false);
  assert.doesNotMatch(ui.text(), /Saved for you:|Earlier report:|Imported status:/);
  assert.match(ui.text(), /partner's reported experience, not a joint/);
  assert.equal(db.calls.length, 0);
});

test("A04: missing report stays not recorded with no implicit Open", async (t) => {
  const db = client(), ui = harness(db); t.after(ui.unmount); await ui.flush();
  assert.match(ui.text(), /haven't recorded a personal repair update/);
  assert.equal(ui.selected("Still unresolved"), false);
  assert.equal(ui.button("Save privately"), undefined);
  assert.equal(db.calls.length, 0);
});

test("A04: reload clears unsaved legacy confirmation rather than treating the import as a current selection", async (t) => {
  const db = client([imported()]), ui = harness(db); t.after(ui.unmount); await ui.flush();
  await ui.press("Still unresolved");
  await ui.press("Refresh updates");
  noChoice(ui);
  assert.equal(db.calls.length, 0);
});

test("A04: focus loss invalidates delayed save; refocus reloads unconfirmed provenance without selection", async (t) => {
  const db = client([imported()]), ui = harness(db); t.after(ui.unmount); await ui.flush();
  await ui.press("I feel reconnected");
  const pending = deferred(); db.respond = () => pending.promise;
  ui.button("Save privately").props.onPress(); await ui.flush(); ui.blur();
  pending.resolve({ data: 42, error: null }); await ui.flush(); ui.refocus(); await ui.flush();
  assert.match(ui.text(), /Imported status: Open/); noChoice(ui);
  assert.equal(db.calls.length, 1);
});

test("A04: account replacement suppresses stale imported rows and resets confirmation choice", async (t) => {
  const db = client([imported()]), ui = harness(db); t.after(ui.unmount); await ui.flush();
  await ui.press("Still unresolved");
  const pending = deferred(), read = db.read; db.read = () => pending.promise;
  ui.button("Refresh updates").props.onPress(); await ui.flush();
  db.rows = [row({ user_id: "user-b", repair_status: "reconnected" })]; db.read = read;
  ui.setProps({ userId: "user-b" }); await ui.flush();
  pending.resolve({ data: [imported()], error: null }); await ui.flush();
  assert.doesNotMatch(ui.text(), /Imported status: Open/);
  assert.match(ui.text(), /Saved for you: I feel reconnected/);
  assert.equal(db.calls.length, 0);
});

for (const useShare of [false, true]) test(`A04: stale imported choice ${useShare ? 'share' : 'private'} conflicts preserve draft and never convert provenance locally`, async (t) => {
  const db = client([imported()]), ui = harness(db); t.after(ui.unmount); await ui.flush();
  await ui.press("Still unresolved"); db.respond = async () => ({ data: null, error: conflict });
  if (useShare) await confirmShare(ui); else await ui.press("Save privately");
  assert.equal(db.calls.length, 1);
  assert.equal(db.rows[0].status_origin, "legacy_default_unconfirmed");
  assert.match(ui.text(), /newer repair report exists/);
  assert.match(ui.text(), /Imported status: Open/);
  assert.equal(ui.selected("Still unresolved"), true);
  assert.equal(ui.button("Confirm save & share"), undefined);
});

for (const commits of [false, true]) test(`A04: lost save acknowledgment commits=${commits} never guesses imported provenance or shares`, async (t) => {
  const db = client([imported()]), ui = harness(db); t.after(ui.unmount); await ui.flush();
  await ui.press("Still unresolved"); const respond = db.respond;
  db.respond = async (call) => { if (commits) await respond(call); throw new Error("Synthetic lost acknowledgment"); };
  await ui.press("Save privately");
  assert.equal(db.calls.length, 1);
  assert.match(ui.text(), /Imported status: Open/);
  assert.doesNotMatch(ui.text(), /Saved privately\./);
  assert.equal(db.rows[0].status_origin, commits ? "explicit" : "legacy_default_unconfirmed");
  await ui.press("Refresh updates");
  assert.equal(db.calls.length, 1, "refresh never retries a save");
  if (commits) assert.match(ui.text(), /Saved for you: Still unresolved/); else noChoice(ui);
});

test("A04: acknowledged save with failed refresh preserves existing private-save reconciliation", async (t) => {
  const db = client([imported()]), ui = harness(db); t.after(ui.unmount); await ui.flush();
  await ui.press("Still unresolved"); const respond = db.respond;
  db.respond = async (call) => { const result = await respond(call); db.readError = { message: "Synthetic offline" }; return result; };
  await ui.press("Save privately");
  assert.match(ui.text(), /Saved privately\./);
  assert.match(ui.text(), /current sharing status could not be verified/);
  assert.doesNotMatch(ui.text(), /latest refresh found your update private/);
  assert.equal(db.calls.length, 1);
});

test("A04 negative control: old preselection and personal headline are detected on the real component", async (t) => {
  let source = readFileSync(path.join(__dirname, "../src/components/EventRepairSection.tsx"), "utf8");
  source = source.replace('setDraftStatus(mine?.status_origin === "explicit" ? mine.repair_status : null);', 'setDraftStatus(mine?.repair_status ?? null);')
    .replace('mine.status_origin === "legacy_default_unconfirmed"\n                  ?', 'false\n                  ?');
  const db = client([imported()]), ui = harness(db, "ours", source); t.after(ui.unmount); await ui.flush();
  assert.match(ui.text(), /Saved for you: Still unresolved/);
  assert.equal(ui.selected("Still unresolved"), true);
  assert.throws(() => noChoice(ui), assert.AssertionError);
});
