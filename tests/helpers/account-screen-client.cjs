const assert = require("node:assert/strict");

// Synthetic transport fixtures only. This model is not evidence of actual RLS.
function client() {
  const db = {
    listeners: new Set(), tokens: new Map(), reads: [], writes: [], checks: [],
    channels: [], memberships: new Map([["a", "couple-1"], ["b", "couple-1"]]),
    perspectives: [], repairs: [], committed: [],
  };
  db.emit = (id, event = id ? "SIGNED_IN" : "SIGNED_OUT", token = `${id}-token`) => {
    const user = { id };
    if (id) db.tokens.set(token, user);
    db.session = id ? { user, access_token: token } : null;
    for (const listener of db.listeners) listener(event, db.session);
  };
  db.emit("a");
  db.getSession = async () => ({ data: { session: db.session }, error: null });
  db.getUser = async (token) => ({ data: { user: db.tokens.get(token) }, error: null });
  db.read = async (call) => {
    const userId = db.tokens.get(call.headers.Authorization?.replace("Bearer ", ""))?.id;
    if (call.table === "couple_members") return {
      data: db.memberships.has(userId) ? { couple_id: db.memberships.get(userId) } : null, error: null,
    };
    let rows = call.table === "event_perspectives" ? db.perspectives : db.repairs;
    rows = rows.filter((row) => call.filters.every(([key, value]) => row[key] === value));
    // Simulated RLS: current authors only. Tests explicitly distinguish this
    // fixture from genuine database authorization and also inject bad caches.
    rows = db.memberships.has(userId) ? rows.filter((row) => (row.author_id ?? row.user_id) === userId) : [];
    return { data: structuredClone(rows), error: null };
  };
  db.commit = (call) => {
    const id = `00000000-0000-4000-8000-${String(db.committed.length + 1).padStart(12, "0")}`;
    db.committed.push({ id, ...call });
    return { data: id, error: null };
  };
  db.respond = async (call) => db.commit(call);
  db.supabase = {
    auth: {
      onAuthStateChange(listener) {
        db.listeners.add(listener);
        queueMicrotask(() => { if (db.listeners.has(listener)) listener("INITIAL_SESSION", db.session); });
        return { data: { subscription: { unsubscribe: () => db.listeners.delete(listener) } } };
      },
      getSession: () => db.getSession(),
      getUser: (token) => { db.checks.push(token); return db.getUser(token); },
    },
    from(table) {
      assert.ok(["couple_members", "event_perspectives", "event_repair_states"].includes(table), `Forbidden parent/private table: ${table}`);
      const call = { table, headers: {}, filters: [] };
      return {
        select(columns) { assert.ok(!/[(*]/.test(columns), "No joins or select-star"); call.columns = columns; return this; },
        eq(key, value) { call.filters.push([key, value]); return this; },
        order(key, options) { call.order = [key, options]; return this; },
        maybeSingle() { return this; },
        setHeader(key, value) { call.headers[key] = value; return this; },
        then(resolve, reject) { db.reads.push(call); return Promise.resolve().then(() => db.read(call)).then(resolve, reject); },
      };
    },
    rpc(name, args) {
      const call = { name, args, headers: {} };
      return {
        retry(enabled) { call.retry = enabled; return this; },
        setHeader(key, value) { call.headers[key] = value; return this; },
        then(resolve, reject) { db.writes.push(call); return Promise.resolve().then(() => db.respond(call)).then(resolve, reject); },
      };
    },
    channel() {
      const channel = {
        handlers: [], removed: false,
        on(_type, filter, handler) { this.handlers.push({ filter, handler }); return this; },
        subscribe(handler) { this.status = handler; return this; },
      };
      db.channels.push(channel);
      return channel;
    },
    removeChannel(channel) { channel.removed = true; },
  };
  db.signal = (table) => {
    for (const channel of db.channels.filter((item) => !item.removed)) {
      for (const { filter, handler } of channel.handlers) if (filter.table === table) handler();
    }
  };
  return db;
}

module.exports = { client };

// Moments fixtures: current account tokens are pinned on every simulated query.
function momentEvent(id, values = {}) {
  return { id, creator_id: "a", couple_id: "couple-1", event_type: "friction",
    category: "communication", intensity: 3, visibility: "ours",
    created_at: "2026-11-08T12:00:00Z", ...values };
}
function momentRepair(values = {}) {
  return { event_id: "a-ours", user_id: "a", repair_status: "open", what_helped: null,
    sharing_status: "private", status_origin: "explicit", report_version: 1, ...values };
}
function momentsClient() {
  const db = { userId: "a", authError: null, authChecks: 0, listeners: new Set(), reads: [], channels: [],
    memberships: new Map([["a", "couple-1"], ["b", "couple-1"], ["solo", "solo-space"]]),
    events: [momentEvent("a-mine", { visibility: "mine", category: "household" }), momentEvent("a-ours"),
      momentEvent("b-mine", { creator_id: "b", visibility: "mine", category: "money" }),
      momentEvent("b-ours", { creator_id: "b", category: "plans" }),
      momentEvent("good", { event_type: "positive", category: "care", intensity: null }),
      momentEvent("unrelated", { couple_id: "other-space", creator_id: "other" })],
    repairs: [],
  };
  db.getUser = async () => ({ data: { user: db.userId ? { id: db.userId } : null }, error: db.authError });
  db.emit = (id, name = id ? "SIGNED_IN" : "SIGNED_OUT") => {
    db.userId = id;
    for (const listener of db.listeners) listener(name, id ? { user: { id } } : null);
  };
  db.defaultRead = (call) => {
    const ownCouple = db.memberships.get(call.userId);
    if (call.table === "couple_members") {
      const requestedUser = call.filters.find(([key]) => key === "user_id")?.[1];
      return { data: requestedUser === call.userId && ownCouple ? { couple_id: ownCouple } : null, error: null };
    }
    let rows;
    if (call.table === "relationship_events") {
      rows = db.events.filter((row) => row.couple_id === ownCouple &&
        (row.visibility === "ours" || row.creator_id === call.userId));
    } else {
      rows = db.repairs.filter((row) => {
        const parent = db.events.find((item) => item.id === row.event_id);
        return parent?.couple_id === ownCouple && (row.user_id === call.userId || (
          parent.visibility === "ours" && row.sharing_status === "shared" && row.status_origin === "explicit"
        ));
      });
    }
    rows = rows.filter((row) => call.filters.every(([key, value]) => row[key] === value));
    if (call.ids) rows = rows.filter((row) => call.ids.includes(row.event_id));
    // Return only the actual selected fields, as the production query requests.
    return { data: rows.map((row) => Object.fromEntries(call.columns.split(",").map((key) => [key.trim(), row[key.trim()]]))), error: null };
  };
  db.read = async (call) => db.defaultRead(call);
  db.supabase = {
    auth: {
      getSession: async () => ({ data: { session: db.userId ? { user: { id: db.userId }, access_token: `${db.userId}-token` } : null }, error: null }),
      getUser: (token) => { db.authChecks++; return db.getUser(token); },
      onAuthStateChange(listener) {
        db.listeners.add(listener);
        queueMicrotask(() => { if (db.listeners.has(listener)) listener("INITIAL_SESSION", db.userId ? { user: { id: db.userId } } : null); });
        return { data: { subscription: { unsubscribe: () => db.listeners.delete(listener) } } };
      },
    },
    from(table) {
      assert.ok(["couple_members", "relationship_events", "event_repair_states"].includes(table), `Unexpected table ${table}`);
      const call = { table, filters: [], headers: {} };
      return {
        select(columns) { call.columns = columns; return this; },
        eq(key, value) { call.filters.push([key, value]); return this; },
        in(key, values) { assert.equal(key, "event_id"); call.ids = [...values]; return this; },
        order(key, value) { call.order = [key, value]; return this; },
        maybeSingle() { return this; },
        setHeader(key,value) { call.headers[key]=value; return this; },
        then(resolve, reject) {
          call.userId = call.headers.Authorization?.replace("Bearer ", "").replace(/-token$/, ""); db.reads.push(call);
          return Promise.resolve().then(() => db.read(call)).then(resolve, reject);
        },
      };
    },
    rpc: () => assert.fail("Moments must not mutate data"),
    channel(name) {
      const channel = { name, handlers: [], removed: false,
        on(type, filter, handler) { this.handlers.push({ type, filter, handler }); return this; },
        subscribe(callback) { this.status=callback; return this; },
      };
      db.channels.push(channel); return channel;
    },
    removeChannel(channel) { channel.removed = true; },
  };
  return db;
}

module.exports.momentsClient = momentsClient;
module.exports.momentEvent = momentEvent;
module.exports.momentRepair = momentRepair;
