const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { client } = require("./helpers/account-screen-client.cjs");
const { deferred, harness, loadSource } = require("./helpers/account-screen-harness.cjs");

// Actual route/account controller and shared UI. Transport, hooks and native
// hosts are synthetic, and the unchanged repair component is a mount sentinel.
// These checks do not establish browser rendering, database RLS or repair RPC behavior.
const file = "src/app/event/[id].tsx";
const { tokens } = loadSource("src/components/couply-tokens.ts", {});
const moment = (extra = {}) => ({
  id: "event-1", creator_id: "a", couple_id: "couple-1", event_type: "friction",
  category: "communication", intensity: 3, shared_topic: "Our chosen topic",
  visibility: "ours", created_at: "2026-11-08T12:00:00Z", ...extra,
});
const perspective = (author_id, extra = {}) => ({
  id: `perspective-${author_id}`, event_id: "event-1", author_id,
  perspective_text: `${author_id} perspective`, sharing_status: "submitted", ...extra,
});
function transport() {
  const db = client();
  db.event = moment();
  db.reflections = [{ event_id: "event-1", author_id: "a", note: "A PRIVATE NOTE" }];
  db.perspectives = [perspective("a"), perspective("b")];
  db.defaultRead = async (call) => {
    const user = db.tokens.get(call.headers.Authorization?.replace("Bearer ", ""))?.id;
    const parent = db.event;
    const visible = parent && db.memberships.get(user) === parent.couple_id &&
      (parent.visibility === "ours" || parent.creator_id === user);
    const matches = (row) => call.filters.every(([key, value]) => row[key] === value);
    const columns = call.columns.split(",").map((key) => key.trim());
    const project = (row) => Object.fromEntries(columns.map((key) => [key, row[key]]));
    let data;
    if (call.table === "relationship_events") data = visible && matches(parent) ? project(parent) : null;
    else if (call.table === "event_private_reflections") {
      const row = db.reflections.find((row) => row.author_id === user && matches(row));
      data = row ? project(row) : null;
    } else data = db.perspectives.filter((row) => visible && matches(row) &&
      (row.author_id === user || row.sharing_status === "submitted")).map(project);
    return { data, error: null };
  };
  db.read = (call) => db.defaultRead(call);
  db.supabase.from = (table) => {
    assert.ok(["relationship_events", "event_private_reflections", "event_perspectives"].includes(table), `Unexpected read: ${table}`);
    const call = { table, filters: [], headers: {} };
    return {
      select(columns) { assert.doesNotMatch(columns, /\*|\(/); call.columns = columns; return this; },
      eq(key, value) { call.filters.push([key, value]); return this; },
      maybeSingle() { return this; },
      setHeader(key, value) { call.headers[key] = value; return this; },
      then(resolve, reject) { db.reads.push(call); return Promise.resolve().then(() => db.read(call)).then(resolve, reject); },
    };
  };
  // Fixture effects only, for testing the screen's existing handlers and payloads.
  db.respond = async (call) => {
    const user = db.tokens.get(call.headers.Authorization?.replace("Bearer ", ""))?.id;
    assert.equal(call.args.p_event_id, db.event?.id);
    assert.equal(db.memberships.get(user), db.event.couple_id);
    if (call.name === "set_moment_visibility") {
      assert.equal(user, db.event.creator_id);
      db.event.visibility = call.args.p_visibility;
      db.event.shared_topic = call.args.p_shared_topic;
      if (db.event.visibility === "mine") db.perspectives.forEach((row) => { row.sharing_status = "suspended"; });
      return { data: db.event.id, error: null };
    }
    if (call.name === "submit_event_perspective") {
      assert.equal(db.event.visibility, "ours");
      db.perspectives = db.perspectives.filter((row) => row.author_id !== user);
      db.perspectives.push(perspective(user, { perspective_text: call.args.p_perspective_text }));
      return { data: `perspective-${user}`, error: null };
    }
    if (call.name === "withdraw_event_perspective") {
      const before = db.perspectives.length;
      db.perspectives = db.perspectives.filter((row) => row.author_id !== user);
      return { data: before !== db.perspectives.length, error: null };
    }
    assert.equal(call.name, "delete_relationship_event");
    assert.equal(user, db.event.creator_id);
    db.event = null;
    return { data: true, error: null };
  };
  return db;
}
async function setup(t, configure, params = { id: "event-1" }) {
  const db = transport(); configure?.(db);
  const ui = harness(db, file, { params, imports: {
    "@/components/EventRepairSection": { EventRepairSection: function EventRepairSection() { return null; } },
  } });
  t.after(ui.unmount); await ui.flush();
  return { db, ui };
}
const text = (node) => Array.isArray(node) ? node.map(text).join("") : node && typeof node === "object"
  ? text(node.props?.children) : typeof node === "string" ? node : "";
const style = (value) => Array.isArray(value) ? Object.assign({}, ...value.map(style)) : value || {};
const components = (ui, name) => ui.components().filter((node) => node.type.name === name);
const repairs = (ui) => components(ui, "EventRepairSection");
const heading = (ui, label) => ui.nodes().find((node) => node.type === "Text" && node.props.accessibilityRole === "header" && text(node) === label);
const change = async (ui, label, value) => { ui.find(label).props.onChangeText(value); await ui.flush(); };

test("context header uses the category and keeps navigation owned by the existing Stack", async (t) => {
  const { ui } = await setup(t);
  assert.ok(heading(ui, "Communication"));
  assert.equal(components(ui, "CouplyHeader")[0].props.onBack, undefined);
  assert.ok(ui.nodes().filter((node) => node.type === "Pressable").every((node) => !/Back/.test(node.props.accessibilityLabel || "")));
  assert.deepEqual(ui.navigations, []);
});

for (const event_type of ["positive", "friction"]) {
  for (const visibility of ["mine", "ours"]) {
    for (const creator_id of ["a", "b"]) {
      test(`${visibility} ${event_type}, creator=${creator_id} preserves visibility, attribution and repair eligibility`, async (t) => {
        const { db, ui } = await setup(t, (db) => {
          db.event = moment({ event_type, visibility, creator_id });
          db.reflections = [{ event_id: "event-1", author_id: creator_id, note: `${creator_id.toUpperCase()} PRIVATE NOTE` }];
        });
        if (visibility === "mine" && creator_id === "b") {
          assert.match(ui.text(), /Event not found or you do not have permission/);
          assert.equal(db.reads.length, 1); assert.equal(repairs(ui).length, 0);
          assert.doesNotMatch(ui.text(), /A PRIVATE NOTE|Our chosen topic|Communication/);
          return;
        }
        assert.ok(heading(ui, "Communication"));
        assert.match(ui.text(), event_type === "positive" ? /A GOOD MOMENT/ : /SOMETHING FELT OFF/);
        assert.deepEqual(components(ui, "CouplyStatusPill").map((node) => node.props.label), [visibility === "mine" ? "Mine · Private" : "Ours · Shared"]);
        assert.match(ui.text(), creator_id === "a" ? /by you/ : /by your partner/);
        assert.ok(ui.text().includes(new Date(db.event.created_at).toLocaleString()));
        assert.equal(repairs(ui).length, event_type === "friction" ? 1 : 0);
        if (event_type === "positive") assert.doesNotMatch(ui.text(), /reported intensity/);
        else assert.match(ui.text(), creator_id === "a" ? /Your reported intensity: 3 \/ 5/ : /Recorder's reported intensity: 3 \/ 5/);
        if (creator_id === "b") {
          assert.equal(ui.find("Change moment visibility"), undefined);
          assert.equal(ui.find("Delete moment"), undefined);
          assert.doesNotMatch(ui.text(), /A PRIVATE NOTE/);
        }
        assert.equal(db.writes.length, 0);
      });
    }
  }
}

test("positive accents are presentation only and do not add an outcome or repair phase", async (t) => {
  const { ui } = await setup(t, (db) => { db.event.event_type = "positive"; });
  const card = components(ui, "CouplySectionCard")[0];
  assert.equal(style(card.props.style).borderColor, tokens.colors.celebrationBorder);
  assert.doesNotMatch(ui.text(), /Reconnected|In care|Reconnecting|mutual repair|repair journey/i);
});

test("private reflection retains its author filter and lilac privacy treatment", async (t) => {
  const { db, ui } = await setup(t);
  const reflection = components(ui, "CouplySectionCard").find((node) => text(node).includes("My private reflection"));
  assert.equal(reflection.props.variant, "lilac");
  assert.match(ui.text(), /Private — only you can see this reflection/);
  const call = db.reads.find((call) => call.table === "event_private_reflections");
  assert.deepEqual(call.filters, [["event_id", "event-1"], ["author_id", "a"]]);
  assert.equal(call.headers.Authorization, "Bearer a-token");
});

for (const visibility of ["mine", "ours"]) {
  test(`shared topic on ${visibility} follows the existing visibility condition`, async (t) => {
    const { ui } = await setup(t, (db) => { db.event.visibility = visibility; });
    assert.equal(Boolean(heading(ui, "Shared topic")), visibility === "ours");
    assert.equal(ui.text().includes("Our chosen topic"), visibility === "ours");
    if (visibility === "ours") {
      const card = components(ui, "CouplySectionCard").find((node) => text(node).startsWith("Shared topic"));
      assert.equal(card.props.variant, "blush");
    }
  });
}

for (const own of ["submitted", "suspended"]) {
  for (const partner of ["submitted", "suspended"]) {
    test(`own=${own}, partner=${partner} keeps real authored perspectives separate`, async (t) => {
      const { ui } = await setup(t, (db) => {
        db.perspectives = [perspective("a", { sharing_status: own }), perspective("b", { sharing_status: partner })];
      });
      assert.ok(heading(ui, "Your perspective")); assert.ok(heading(ui, "Your partner's perspective"));
      assert.match(ui.text(), /a perspective/);
      assert.match(ui.text(), own === "submitted" ? /Shared with your partner/ : /Not shared — only you can see this/);
      assert.equal(ui.text().includes("b perspective"), partner === "submitted");
      assert.match(ui.text(), /Sharing a perspective does not mean agreement or repair/);
    });
  }
}

test("a suspended partner row is not rendered even from an adversarial transport response", async (t) => {
  const { ui } = await setup(t, (db) => {
    const original = db.read;
    db.read = (call) => call.table === "event_perspectives" ? Promise.resolve({
      data: [perspective("a"), perspective("b", { perspective_text: "SUSPENDED_PARTNER_CANARY", sharing_status: "suspended" })], error: null,
    }) : original(call);
  });
  assert.doesNotMatch(ui.text(), /SUSPENDED_PARTNER_CANARY/);
});

test("Mine hides perspective controls and content without inferring that retained contributions were deleted", async (t) => {
  const { ui } = await setup(t, (db) => { db.event.visibility = "mine"; });
  assert.equal(heading(ui, "Our perspectives"), undefined);
  assert.doesNotMatch(ui.text(), /a perspective|b perspective|contributions were deleted/);
  assert.equal(ui.find("Edit my perspective"), undefined);
});

for (const sharing_status of ["submitted", "suspended"]) {
  test(`editing ${sharing_status} keeps the existing draft prefill and cancel behavior`, async (t) => {
    const { db, ui } = await setup(t, (db) => { db.perspectives[0].sharing_status = sharing_status; });
    await ui.tap(sharing_status === "submitted" ? "Edit my perspective" : "Write and share my perspective");
    assert.equal(ui.find("Your perspective").props.value, sharing_status === "submitted" ? "a perspective" : "");
    assert.equal(ui.find("Your perspective").props.multiline, true);
    await change(ui, "Your perspective", "An unsent change");
    await ui.tap("Cancel perspective editing");
    assert.equal(ui.find("Your perspective"), undefined);
    assert.equal(db.writes.length, 0);
  });
}

test("explicit perspective submission sends only trimmed own text with the validated bearer", async (t) => {
  const { db, ui } = await setup(t, (db) => { db.perspectives = [perspective("b")]; });
  await ui.tap("Write and share my perspective");
  assert.equal(ui.find("Share my perspective").props.disabled, true);
  assert.deepEqual(ui.find("Share my perspective").props.accessibilityState, { disabled: true });
  await change(ui, "Your perspective", "  My deliberate shared text  ");
  await ui.tap("Share my perspective");
  assert.equal(db.writes.length, 1);
  assert.equal(db.writes[0].name, "submit_event_perspective");
  assert.deepEqual(db.writes[0].args, { p_event_id: "event-1", p_perspective_text: "My deliberate shared text" });
  assert.equal(db.writes[0].headers.Authorization, "Bearer a-token");
  assert.match(ui.text(), /Your perspective was shared/);
});

test("pending perspective submission disables editing and rejects duplicate retained dispatch", async (t) => {
  const { db, ui } = await setup(t);
  const pending = deferred(), original = db.respond;
  db.respond = (call) => pending.promise.then(() => original(call));
  await ui.tap("Edit my perspective"); await change(ui, "Your perspective", "Pending shared text");
  const save = ui.find("Share my perspective").props.onPress;
  void save(); await ui.flush(); void save(); await ui.flush();
  assert.equal(db.writes.length, 1);
  assert.equal(ui.find("Share my perspective").props.disabled, true);
  assert.equal(ui.find("Your perspective").props.editable, false);
  assert.equal(ui.find("Cancel perspective editing").props.accessibilityState.disabled, true);
  pending.resolve(); await ui.flush();
});

test("perspective withdrawal keeps confirmation, cancellation and author-only effects", async (t) => {
  const { db, ui } = await setup(t);
  await ui.tap("Withdraw my perspective");
  assert.match(ui.text(), /Withdrawing permanently deletes your perspective/);
  assert.equal(db.writes.length, 0);
  await ui.tap("Keep my perspective"); assert.equal(ui.find("Yes, withdraw"), undefined);
  await ui.tap("Withdraw my perspective"); await ui.tap("Yes, withdraw");
  assert.equal(db.writes[0].name, "withdraw_event_perspective");
  assert.deepEqual(db.writes[0].args, { p_event_id: "event-1" });
  assert.match(ui.text(), /Your perspective was withdrawn/);
  assert.deepEqual(db.perspectives.map((row) => row.author_id), ["b"]);
});

test("sharing a Mine moment starts with a blank topic and never copies the private reflection", async (t) => {
  const { db, ui } = await setup(t, (db) => { db.event.visibility = "mine"; db.event.shared_topic = null; });
  await ui.tap("Share this moment");
  assert.equal(ui.find("Topic to share").props.value, "");
  assert.equal(ui.find("Confirm sharing").props.disabled, true);
  assert.match(ui.text(), /Your private reflection and personal repair update are not automatically shared/);
  await change(ui, "Topic to share", "Only this chosen topic"); await ui.tap("Confirm sharing");
  assert.deepEqual(db.writes[0].args, { p_event_id: "event-1", p_visibility: "ours", p_shared_topic: "Only this chosen topic" });
  assert.equal(db.writes[0].headers.Authorization, "Bearer a-token");
  assert.equal(db.event.shared_topic.includes("A PRIVATE NOTE"), false);
});

test("visibility cancellation makes no write and the Ours-to-Mine-to-Ours cycle does not resubmit perspectives", async (t) => {
  const { db, ui } = await setup(t);
  await ui.tap("Change moment visibility");
  assert.match(ui.text(), /Information previously seen cannot be recalled/);
  await ui.tap("Cancel visibility change"); assert.equal(db.writes.length, 0);
  await ui.tap("Change moment visibility"); await ui.tap("Confirm move to Mine");
  assert.equal(db.event.shared_topic, null);
  await ui.tap("Share this moment"); await change(ui, "Topic to share", "Chosen again"); await ui.tap("Confirm sharing");
  assert.ok(db.perspectives.every((row) => row.sharing_status === "suspended"));
  assert.deepEqual(db.writes.map((call) => call.name), ["set_moment_visibility", "set_moment_visibility"]);
  assert.doesNotMatch(ui.text(), /b perspective/);
});

test("deletion stays an explicit inline confirmation with the full partner-contribution warning", async (t) => {
  const { db, ui } = await setup(t);
  await ui.tap("Delete moment");
  assert.ok(heading(ui, "Delete this moment?"));
  assert.match(ui.text(), /including contributions from your partner\. This cannot be undone/);
  assert.equal(ui.find("Yes, delete permanently").props.accessibilityState.disabled, false);
  await ui.tap("Cancel deletion");
  assert.equal(ui.find("Yes, delete permanently"), undefined);
  assert.equal(db.writes.length, 0); assert.deepEqual(ui.navigations, []);
});

for (const visibility of ["mine", "ours"]) {
  test(`the unchanged repair boundary on ${visibility} receives the exact identity, key and authority callbacks`, async (t) => {
    const { ui } = await setup(t, (db) => { db.event.visibility = visibility; });
    const repair = repairs(ui)[0];
    assert.equal(repair.key, "event-1:a");
    assert.deepEqual(Object.keys(repair.props).sort(), ["authorize", "eventId", "isCurrent", "userId", "visibility"]);
    assert.equal(repair.props.eventId, "event-1"); assert.equal(repair.props.userId, "a");
    assert.equal(repair.props.visibility, visibility);
    assert.equal(repair.props.isCurrent(), true); assert.equal(await repair.props.authorize(), "a-token");
    await ui.switchAccount("b"); assert.equal(repair.props.isCurrent(), false);
  });
}

test("pending parent loading never renders protected sections or new recovery actions", async (t) => {
  const pending = deferred();
  const { ui } = await setup(t, (db) => { db.read = () => pending.promise; });
  assert.match(ui.text(), /Loading/);
  assert.equal(repairs(ui).length, 0); assert.equal(ui.nodes().filter((node) => node.type === "Pressable").length, 0);
  pending.resolve({ data: null, error: null }); await ui.flush();
  assert.match(ui.text(), /Event not found or you do not have permission/);
});

test("missing event IDs and signed-out accounts cannot trigger data reads", async (t) => {
  const missing = await setup(t, undefined, {});
  assert.match(missing.ui.text(), /Invalid event/); assert.equal(missing.db.reads.length, 0);
  const signedOut = await setup(t, (db) => db.emit(null));
  assert.equal(signedOut.db.reads.length, 0); assert.ok(signedOut.ui.navigations.includes("/"));
});

for (const table of ["relationship_events", "event_private_reflections", "event_perspectives"]) {
  test(`${table} errors remain characterized, not silently fixed by styling`, async (t) => {
    const { ui } = await setup(t, (db) => {
      const original = db.read;
      db.read = (call) => call.table === table ? Promise.resolve({ data: null, error: { message: "Synthetic backend error" } }) : original(call);
    });
    assert.match(ui.text(), /Synthetic backend error/); // Known raw-error limitation, unchanged in this visual increment.
    if (table === "event_perspectives") {
      assert.ok(heading(ui, "Communication"));
      assert.match(ui.text(), /hasn't shared a perspective/); // Known absence-language limitation; separate hardening required.
    } else assert.equal(heading(ui, "Communication"), undefined);
  });
}

test("the initial read inventory and every request's bearer remain unchanged", async (t) => {
  const { db } = await setup(t);
  assert.deepEqual(db.reads.map((call) => call.table), ["relationship_events", "event_private_reflections", "event_perspectives"]);
  assert.deepEqual(db.reads[0].columns.split(",").map((part) => part.trim()), ["id", "creator_id", "event_type", "category", "intensity", "shared_topic", "visibility", "created_at"]);
  assert.equal(db.reads[1].columns, "note");
  assert.equal(db.reads[2].columns, "id, author_id, perspective_text, sharing_status");
  assert.ok(db.reads.every((call) => call.headers.Authorization === "Bearer a-token"));
  assert.equal(db.writes.length, 0); assert.equal(db.channels.length, 0);
});

test("late Account A content cannot repopulate the mounted Account B route", async (t) => {
  const pending = deferred();
  const { db, ui } = await setup(t, (db) => {
    const original = db.read;
    db.read = (call) => call.table === "event_private_reflections" && call.headers.Authorization === "Bearer a-token" ? pending.promise : original(call);
  });
  await ui.switchAccount("b");
  pending.resolve({ data: { note: "LATE A PRIVATE NOTE" }, error: null }); await ui.flush();
  assert.doesNotMatch(ui.text(), /LATE A PRIVATE NOTE|A PRIVATE NOTE/);
  assert.equal(repairs(ui)[0].props.userId, "b");
  assert.equal(db.writes.length, 0);
});

test("page styles support narrow widths, inherited text scaling and the existing Stack's safe-area ownership", async (t) => {
  const longText = "My own long perspective. ".repeat(80) + "\nLast line.";
  const { ui } = await setup(t, (db) => { db.perspectives[0].perspective_text = longText; });
  assert.deepEqual(components(ui, "CouplyPage")[0].props.edges, ["left", "right", "bottom"]);
  const column = ui.nodes().find((node) => style(node.props.style).maxWidth === tokens.layout.maxContentWidth);
  assert.equal(style(column.props.style).width, "100%");
  const top = components(ui, "CouplySectionCard")[0].props.children[0];
  assert.equal(style(top.props.style).flexWrap, "wrap");
  const scroll = ui.nodes().find((node) => node.type === "ScrollView");
  assert.equal(style(scroll.props.style).flex, 1); assert.equal(scroll.props.keyboardShouldPersistTaps, "handled");
  const ownText = ui.nodes().find((node) => node.type === "Text" && node.props.children === longText);
  assert.ok(ownText); assert.equal(ownText.props.numberOfLines, undefined); assert.notEqual(ownText.props.allowFontScaling, false);
  for (const button of ui.nodes().filter((node) => node.type === "Pressable")) {
    assert.ok(button.props.accessibilityLabel);
    assert.equal(button.props.accessibilityRole, "button");
    assert.ok(style(button.props.style).minHeight >= tokens.layout.minTouchTarget);
  }
});

test("section order keeps repair between private reflection and actual perspectives", async (t) => {
  const { ui } = await setup(t);
  const scroll = ui.nodes().find((node) => node.type === "ScrollView");
  const children = scroll.props.children.filter(Boolean);
  assert.ok(text(children[0]).includes("Communication"));
  assert.ok(text(children[1]).startsWith("Shared topic"));
  assert.ok(text(children[2]).startsWith("My private reflection"));
  // The sentinel resolves to null; component order still captures the exact mount position.
  const order = ui.components().filter((node) => ["EventRepairSection", "CouplySectionCard"].includes(node.type.name));
  const repairIndex = order.findIndex((node) => node.type.name === "EventRepairSection");
  assert.ok(text(order[repairIndex - 1]).startsWith("My private reflection"));
  assert.ok(text(order[repairIndex + 1]).includes("Our perspectives"));
});

test("source introduces no legacy schema, preview dependencies or new write entry points", () => {
  const source = readFileSync(path.join(__dirname, "..", file), "utf8");
  assert.doesNotMatch(source, /repair_method|reconnected_at|event\.status|RepairPreviewContext|UserIdentityContext|previewPerspective|alex|samShared|closingCheckIn|sharedTakeaway/i);
  assert.deepEqual([...source.matchAll(/\.rpc\("([^"]+)"/g)].map((match) => match[1]), ["set_moment_visibility", "submit_event_perspective", "withdraw_event_perspective", "delete_relationship_event"]);
});
