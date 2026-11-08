const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { client } = require("./helpers/account-screen-client.cjs");
const { deferred, harness, loadSource } = require("./helpers/account-screen-harness.cjs");

// Real screen, account boundary and shared UI; synthetic hooks, native hosts and
// authenticated transport. This is not browser/native rendering or RLS evidence.
const file = "src/app/my-contributions.tsx";
const { tokens } = loadSource("src/components/couply-tokens.ts", {});
const updated = "2026-11-08T12:00:00Z";
const perspective = (author_id, extra = {}) => ({
  id: `perspective-${author_id}`, author_id, perspective_text: `${author_id} retained perspective`,
  sharing_status: "submitted", updated_at: updated, ...extra,
});
const repair = (user_id, extra = {}) => ({
  event_id: `hidden-parent-${user_id}`, user_id, repair_status: "open", what_helped: "space",
  sharing_status: "private", status_origin: "explicit", updated_at: updated, ...extra,
});
async function setup(t, configure) {
  const db = client();
  db.perspectives = [perspective("a"), perspective("b")];
  db.repairs = [repair("a"), repair("b")];
  configure?.(db);
  const ui = harness(db, file);
  t.after(ui.unmount); await ui.flush();
  return { db, ui };
}
const text = (node) => Array.isArray(node) ? node.map(text).join("") : node && typeof node === "object"
  ? text(node.props?.children) : typeof node === "string" ? node : "";
const style = (value) => Array.isArray(value) ? Object.assign({}, ...value.map(style)) : value || {};
const components = (ui, name) => ui.components().filter((node) => node.type.name === name);
const list = (ui) => ui.components().find((node) => Array.isArray(node.props.data) && node.props.renderItem);
const cards = (ui) => components(ui, "CouplySectionCard").filter((node) => /^My (perspective|repair update)/.test(text(node)));
const card = (ui, heading) => cards(ui).find((node) => text(node).startsWith(heading));
const labels = (ui) => components(ui, "CouplyStatusPill").map((node) => node.props.label);
const empty = /No contributions available/;

test("header keeps Relationship OS branding, ownership and the read-only explanation", async (t) => {
  const { ui } = await setup(t);
  assert.equal(components(ui, "CouplyHeader")[0].props.title, "My contributions");
  assert.ok(ui.nodes().some((node) => node.type === "Text" && node.props.accessibilityRole === "header" && text(node) === "My contributions"));
  assert.match(ui.text(), /RELATIONSHIP OS/);
  assert.match(ui.text(), /including retained contributions when a moment is no longer available to you/);
  assert.match(ui.text(), /do not imply agreement or mutual repair/);
  assert.match(ui.text(), /do not confirm current access to its moment/);
  assert.match(ui.text(), /read-only\. Nothing here is automatically shared or resubmitted/);
  assert.doesNotMatch(ui.text(), /Couply|My Rhythm/);
});

test("Back to Moments keeps the exact unscoped route and no parent identifier", async (t) => {
  const { db, ui } = await setup(t);
  const reads = db.reads.length;
  await ui.tap("Back to Moments");
  assert.deepEqual(ui.navigations, ["/events"]);
  assert.equal(db.reads.length, reads);
  assert.equal(db.writes.length, 0);
});

test("a retained old-account Back callback cannot navigate after replacement", async (t) => {
  const { ui } = await setup(t);
  const oldBack = ui.find("Back to Moments").props.onPress;
  await ui.switchAccount("b"); oldBack(); await ui.flush();
  assert.deepEqual(ui.navigations, []);
  assert.match(ui.text(), /b retained perspective/);
  assert.doesNotMatch(ui.text(), /a retained perspective/);
});

test("the shared page owns safe areas and a single virtualized list, without nested scrolling", async (t) => {
  const { ui } = await setup(t);
  const page = components(ui, "CouplyPage")[0];
  assert.deepEqual(page.props.edges, ["top", "left", "right", "bottom"]);
  assert.ok(ui.nodes().some((node) => node.type === "SafeAreaView" && node.props.testID === "my-contributions-page"));
  assert.equal(ui.components().filter((node) => Array.isArray(node.props.data) && node.props.renderItem).length, 1);
  assert.equal(ui.nodes().filter((node) => node.type === "ScrollView").length, 0);
  const column = ui.nodes().find((node) => node.type === "View" && style(node.props.style).maxWidth === tokens.layout.maxContentWidth);
  assert.equal(style(column.props.style).width, "100%");
  assert.equal(style(column.props.style).paddingHorizontal, tokens.spacing.page);
  assert.equal(style(list(ui).props.style).flex, 1);
});

test("contribution cards use shared surfaces and wrapping, readable noninteractive content", async (t) => {
  const { ui } = await setup(t);
  assert.equal(cards(ui).length, 2);
  for (const entry of cards(ui)) {
    const header = entry.props.children[0];
    assert.equal(style(header.props.style).flexWrap, "wrap");
    assert.equal(header.props.children[0].props.accessibilityRole, "header");
    const rendered = ui.nodes().find((node) => node.type === "View" && text(node).startsWith(text(entry).slice(0, 14)) && style(node.props.style).borderWidth === 1.2);
    assert.equal(style(rendered.props.style).backgroundColor, tokens.colors.surface);
    assert.equal(style(rendered.props.style).borderRadius, tokens.radii.card);
    assert.equal(entry.props.onPress, undefined);
  }
  const controls = ui.nodes().filter((node) => node.type === "Pressable");
  assert.deepEqual(controls.map((node) => node.props.accessibilityLabel).sort(), ["Back to Moments", "Refresh my contributions"]);
  for (const control of controls) {
    const normalStyle = style(typeof control.props.style === "function" ? control.props.style({ pressed: false }) : control.props.style);
    assert.ok(normalStyle.minHeight >= tokens.layout.minTouchTarget);
    assert.equal(control.props.accessibilityRole, "button");
  }
});

for (const sharing_status of ["submitted", "suspended"]) {
  test(`perspective ${sharing_status} has its own label and qualified partner-access copy`, async (t) => {
    const { ui } = await setup(t, (db) => {
      db.perspectives = [perspective("a", { sharing_status })]; db.repairs = [];
    });
    assert.deepEqual(labels(ui), [sharing_status === "submitted" ? "Submitted" : "Sharing suspended"]);
    assert.match(text(card(ui, "My perspective")), /a retained perspective/);
    assert.match(ui.text(), sharing_status === "suspended" ? /Sharing suspended — not visible to your partner/
      : /Submitted for sharing\. Partner access depends on the moment remaining shared/);
    assert.equal(card(ui, "My repair update"), undefined);
    assert.doesNotMatch(ui.text(), /parent is visible|moment is Ours|You both|mutually repaired/);
  });
}

for (const sharing_status of ["private", "shared"]) {
  test(`repair ${sharing_status} has an individual sharing label without inferring parent visibility`, async (t) => {
    const { ui } = await setup(t, (db) => {
      db.perspectives = []; db.repairs = [repair("a", { sharing_status })];
    });
    assert.deepEqual(labels(ui), [sharing_status === "shared" ? "Shared" : "Private"]);
    assert.match(ui.text(), sharing_status === "shared" ? /Shared by you\. Partner access depends on the moment remaining shared/
      : /Private — not shared with your partner/);
    assert.match(ui.text(), /My report: I still feel unresolved/);
    assert.match(ui.text(), /What helped me: Space/);
    assert.equal(card(ui, "My perspective"), undefined);
  });
}

for (const [repair_status, wording] of [["open", "I still feel unresolved"], ["partially_repaired", "I feel partly repaired"], ["reconnected", "I feel reconnected"]]) {
  test(`${repair_status} remains the author's report, never a joint outcome`, async (t) => {
    const { ui } = await setup(t, (db) => { db.repairs = [repair("a", { repair_status })]; });
    assert.ok(ui.text().includes(`My report: ${wording}`));
    assert.doesNotMatch(ui.text(), /You both|Both partners|mutually repaired|relationship health/);
  });
}

for (const repair_status of ["open", "partially_repaired", "reconnected"]) {
  test(`unconfirmed historical ${repair_status} never becomes a personal report or method`, async (t) => {
    const { ui } = await setup(t, (db) => {
      db.repairs = [repair("a", { repair_status, status_origin: "legacy_default_unconfirmed" })];
    });
    const copy = text(card(ui, "My repair update"));
    assert.match(copy, /Unconfirmed legacy default — not a personal repair report/);
    assert.doesNotMatch(copy, /My report:|What helped me:/);
    assert.deepEqual(labels(ui), ["Submitted", "Private"]);
  });
}

test("preserved creator reports keep historical provenance and optional what-helped content", async (t) => {
  const { ui } = await setup(t, (db) => {
    db.repairs = [repair("a", { status_origin: "legacy_creator_report", repair_status: "reconnected", what_helped: "talking" })];
  });
  assert.match(ui.text(), /My report: I feel reconnected/);
  assert.match(ui.text(), /Preserved legacy report/);
  assert.match(ui.text(), /What helped me: Talking/);
});

test("an absent what-helped choice stays absent", async (t) => {
  const { ui } = await setup(t, (db) => { db.repairs = [repair("a", { what_helped: null })]; });
  assert.doesNotMatch(ui.text(), /What helped me:/);
});

test("hidden-parent content renders without parent metadata, links or partner content", async (t) => {
  const { db, ui } = await setup(t, (db) => {
    db.emit("b");
    db.perspectives[1].sharing_status = "suspended";
    db.hiddenParent = { id: "hidden-parent-b", category: "HIDDEN_CATEGORY", shared_topic: "HIDDEN_TOPIC" };
    db.perspectives[0].perspective_text = "PARTNER_PRIVATE_PERSPECTIVE";
    db.repairs[0].what_helped = "humour";
    // Defensive filtering is still required if a transport/cache is incorrect.
    const original = db.read;
    db.read = (call) => call.table === "couple_members" ? original(call) : Promise.resolve({
      data: call.table === "event_perspectives" ? db.perspectives : db.repairs, error: null,
    });
  });
  assert.match(ui.text(), /b retained perspective/);
  assert.deepEqual(labels(ui), ["Sharing suspended", "Private"]);
  assert.doesNotMatch(ui.text(), /hidden-parent|HIDDEN_CATEGORY|HIDDEN_TOPIC|PARTNER_PRIVATE_PERSPECTIVE|What helped me: Humour/);
  assert.ok(db.reads.every((call) => ["couple_members", "event_perspectives", "event_repair_states"].includes(call.table)));
  assert.deepEqual(ui.navigations, []);
  assert.equal(db.writes.length, 0);
});

test("timestamps and ordering remain contribution-specific without parent dates", async (t) => {
  const { ui } = await setup(t, (db) => {
    db.perspectives = [perspective("a", { updated_at: "2026-11-07T12:00:00Z" })];
  });
  assert.deepEqual(list(ui).props.data.map((item) => item.kind), ["repair", "perspective"]);
  assert.equal((ui.text().match(/Contribution updated:/g) || []).length, 2);
  assert.doesNotMatch(ui.text(), /Moment recorded|Partner last active/);
});

test("newly loading content shows access checking, disables refresh and never claims emptiness", async (t) => {
  const pending = deferred();
  const { ui } = await setup(t, (db) => {
    const original = db.read;
    db.read = (call) => call.table === "couple_members" ? original(call) : pending.promise;
  });
  assert.match(ui.text(), /Checking access…/);
  const refresh = ui.find("Refresh my contributions");
  assert.equal(refresh.props.disabled, true);
  assert.deepEqual(refresh.props.accessibilityState, { disabled: true, busy: true });
  assert.ok(ui.nodes().some((node) => node.type === "ActivityIndicator"));
  assert.equal(cards(ui).length, 0);
  assert.equal(list(ui).props.ListEmptyComponent, null);
  assert.doesNotMatch(ui.text(), empty);
  pending.resolve({ data: [], error: null }); await ui.flush();
  assert.match(ui.text(), empty);
});

test("verified empty access uses the shared empty state without inventing a cause", async (t) => {
  const { ui } = await setup(t, (db) => { db.perspectives = []; db.repairs = []; });
  const notice = components(ui, "CouplyEmptyState")[0];
  assert.equal(notice.props.title, "No contributions available.");
  assert.match(notice.props.body, /will appear here when you have access/);
  assert.doesNotMatch(ui.text(), /partner has not|partner withdrew|moment was deleted|0 contributions/);
  assert.equal(ui.find("Refresh my contributions").props.disabled, false);
});

test("refresh clears old content during access checks and only reads", async (t) => {
  const { db, ui } = await setup(t);
  const pending = deferred(), original = db.read;
  db.read = async (call) => { await pending.promise; return original(call); };
  ui.find("Refresh my contributions").props.onPress(); await ui.flush();
  assert.equal(cards(ui).length, 0); assert.doesNotMatch(ui.text(), /a retained perspective/);
  assert.match(ui.text(), /Checking access…/);
  assert.equal(db.channels[0].removed, true);
  pending.resolve(); await ui.flush();
  assert.match(ui.text(), /a retained perspective/);
  assert.equal(db.writes.length, 0);
});

for (const table of ["couple_members", "event_perspectives", "event_repair_states"]) {
  test(`${table} errors expose no half-loaded or backend-private content and permit refresh`, async (t) => {
    const { db, ui } = await setup(t, (db) => {
      const original = db.read;
      db.read = (call) => call.table === table ? Promise.resolve({ data: null, error: { message: "PRIVATE_BACKEND_DETAIL" } }) : original(call);
    });
    assert.match(ui.text(), /Contributions aren't available/);
    assert.equal(cards(ui).length, 0);
    assert.doesNotMatch(ui.text(), /a retained perspective|My report:|PRIVATE_BACKEND_DETAIL|No contributions available/);
    assert.ok(ui.nodes().some((node) => node.type === "Text" && node.props.accessibilityRole === "alert"));
    assert.equal(ui.find("Refresh my contributions").props.disabled, false);
    if (table === "couple_members") assert.ok(db.reads.every((call) => call.table === table));
    db.read = async (call) => {
      if (call.table === "couple_members") return { data: { couple_id: "couple-1" }, error: null };
      return { data: [], error: null };
    };
    await ui.tap("Refresh my contributions"); assert.match(ui.text(), empty);
    assert.equal(db.writes.length, 0);
  });
}

for (const status of ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"]) {
  test(`${status} clears cards and allows recovery through a new read-only subscription`, async (t) => {
    const { db, ui } = await setup(t);
    const channel = db.channels.at(-1);
    channel.status(status); ui.render();
    assert.equal(cards(ui).length, 0);
    assert.match(ui.text(), /Live access checks are unavailable/);
    assert.doesNotMatch(ui.text(), /a retained perspective|No contributions available/);
    await ui.tap("Refresh my contributions");
    assert.equal(channel.removed, true); assert.equal(db.channels.length, 2);
    assert.match(ui.text(), /a retained perspective/);
    assert.equal(db.writes.length, 0);
  });
}

test("account replacement rejects late child results and keeps validated token-scoped queries", async (t) => {
  const pending = deferred();
  const { db, ui } = await setup(t, (db) => {
    const original = db.read;
    db.read = (call) => call.table !== "couple_members" && call.headers.Authorization === "Bearer a-token" ? pending.promise : original(call);
  });
  await ui.switchAccount("b");
  pending.resolve({ data: [perspective("a"), repair("a")], error: null }); await ui.flush();
  assert.match(ui.text(), /b retained perspective/); assert.doesNotMatch(ui.text(), /a retained perspective/);
  for (const call of db.reads) {
    const author = call.filters[0][1];
    assert.equal(call.headers.Authorization, `Bearer ${author}-token`);
    assert.equal(call.filters[0][0], call.table === "event_perspectives" ? "author_id" : "user_id");
  }
  assert.equal(db.writes.length, 0);
});

test("failed token revalidation still delegates recovery to the unchanged account boundary", async (t) => {
  const { db, ui } = await setup(t, (db) => {
    const original = db.getUser; let checks = 0;
    db.getUser = (token) => ++checks === 2 ? Promise.resolve({ data: { user: null }, error: { message: "PRIVATE_AUTH_DETAIL" } }) : original(token);
  });
  assert.match(ui.text(), /Private data has been cleared/);
  assert.equal(cards(ui).length, 0); assert.doesNotMatch(ui.text(), /a retained perspective|PRIVATE_AUTH_DETAIL/);
  await ui.tap("Retry"); assert.match(ui.text(), /a retained perspective/);
  assert.equal(db.writes.length, 0);
});

test("the initial request inventory remains two own-member checks and two minimal child reads", async (t) => {
  const { db } = await setup(t);
  assert.equal(db.reads.length, 4);
  assert.deepEqual(db.reads.map((call) => call.table), ["couple_members", "event_perspectives", "event_repair_states", "couple_members"]);
  assert.equal(db.reads[1].columns, "id, author_id, perspective_text, sharing_status, updated_at");
  assert.equal(db.reads[2].columns, "event_id, user_id, repair_status, what_helped, sharing_status, status_origin, updated_at");
  assert.ok(db.reads.every((call) => call.headers.Authorization === "Bearer a-token"));
  assert.equal(db.writes.length, 0);
});

test("long own text is retained without truncation or interactive parent affordances", async (t) => {
  const longText = "My own reflection with a long line. ".repeat(60) + "\nFinal personal thought.";
  const { ui } = await setup(t, (db) => { db.perspectives = [perspective("a", { perspective_text: longText })]; });
  const ownText = ui.nodes().find((node) => node.type === "Text" && node.props.children === longText);
  assert.ok(ownText);
  assert.equal(ownText.props.numberOfLines, undefined);
  assert.notEqual(ownText.props.allowFontScaling, false);
  assert.equal(style(ownText.props.style).height, undefined);
  assert.equal(style(ownText.props.style).overflow, undefined);
});

test("source has no new parent requests, legacy event schema, preview providers or mutations", () => {
  const source = readFileSync(path.join(__dirname, "..", file), "utf8");
  assert.doesNotMatch(source, /relationship_events|private_reflections|repair_method|reconnected_at|PreviewContext|UserIdentity|\.rpc\(|\.insert\(|\.update\(|\.delete\(|\/event\//);
});
