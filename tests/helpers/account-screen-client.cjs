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
