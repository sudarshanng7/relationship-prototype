import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { AppState, Platform } from "react-native";

export type AccessPhase = "checking" | "ready" | "failed" | "unavailable";
export type AccessState = { phase: AccessPhase; revision: number; verifiedAt: number | null };
export type AccessResult<T> = { kind: "ready"; data: T } | { kind: "failed" | "unavailable" };
export type AccessPolicy = { budgetMs: number; refreshMs: number; timeoutMs: number };
export const DEFAULT_ACCESS_POLICY: AccessPolicy = { budgetMs: 30_000, refreshMs: 25_000, timeoutMs: 5_000 };
type Clock = { now: () => number; schedule: (callback: () => void, delay: number) => () => void };
type Options<T> = {
  verify: (valid: () => boolean) => Promise<AccessResult<T>>;
  publish: (data: T, revision: number) => void;
  policy?: AccessPolicy;
};
export type AccessController = {
  start: () => void;
  stop: () => void;
  foreground: (active: boolean) => void;
  refresh: (hide?: boolean) => Promise<boolean>;
  invalidate: () => void;
  canDispatch: () => boolean;
  hasFreshAccess: () => boolean;
  beginMutation: () => ((revalidate?: boolean) => Promise<boolean>) | null;
  state: () => AccessState;
};

/** Screen-local read coordinator. It never dispatches or retries a mutation. */
export function createAccessRevalidation<T>(
  options: Options<T> & { changed: (state: AccessState) => void; clock?: Clock },
): AccessController & { setCallbacks: (callbacks: Pick<typeof options, "verify" | "publish" | "changed">) => void } {
  let callbacks = options;
  const policy = options.policy ?? DEFAULT_ACCESS_POLICY;
  if (!(policy.refreshMs > 0 && policy.refreshMs < policy.budgetMs && policy.timeoutMs > 0)) {
    throw new Error("Invalid access freshness policy");
  }
  const clock: Clock = options.clock ?? {
    now: Date.now,
    schedule: (callback, delay) => { const timer = setTimeout(callback, Math.max(0, delay)); return () => clearTimeout(timer); },
  };
  let state: AccessState = { phase: "checking", revision: 0, verifiedAt: null };
  let focused = false, foreground = true, epoch = 0, writes = 0, until = 0;
  let cancelRefresh: (() => void) | undefined, cancelExpiry: (() => void) | undefined;
  type Job = { epoch: number; started: number; promise: Promise<boolean>; resolve: (ok: boolean) => void; cancel?: () => void };
  let job: Job | null = null;
  let queued: ((ok: boolean) => void)[] = [];
  const emit = (phase: AccessPhase, verifiedAt: number | null = state.verifiedAt) => {
    state = { ...state, phase, verifiedAt }; callbacks.changed(state);
  };
  const clearTimers = () => { cancelRefresh?.(); cancelExpiry?.(); cancelRefresh = cancelExpiry = undefined; };
  const invalidate = (phase: AccessPhase) => { epoch++; until = 0; clearTimers(); emit(phase, null); };
  const usable = () => focused && foreground;
  const abandon = () => {
    const previous = job; job = null; previous?.cancel?.(); previous?.resolve(false);
  };
  const retryLater = () => {
    cancelRefresh?.();
    if (usable()) cancelRefresh = clock.schedule(() => { void refresh(); }, policy.refreshMs);
  };
  const drain = () => {
    if (!queued.length || !usable() || writes) return;
    const waiting = queued; queued = [];
    void refresh().then((ok) => waiting.forEach((resolve) => resolve(ok)));
  };
  function refresh(hide = false): Promise<boolean> {
    if (!usable()) return Promise.resolve(false);
    if (hide && state.phase !== "checking") invalidate("checking");
    if (writes || (job && job.epoch !== epoch)) return new Promise((resolve) => { queued.push(resolve); });
    if (job) return job.promise;
    if (state.phase !== "ready") emit("checking");
    let resolve!: (ok: boolean) => void;
    const promise = new Promise<boolean>((done) => { resolve = done; });
    const current: Job = { epoch, started: clock.now(), promise, resolve };
    job = current;
    const valid = () => job === current && current.epoch === epoch && usable() && writes === 0;
    const finish = (ok: boolean) => {
      if (job !== current) return;
      current.cancel?.(); job = null; current.resolve(ok); drain();
    };
    current.cancel = clock.schedule(() => {
      if (job !== current) return;
      invalidate("failed"); finish(false); retryLater();
    }, policy.timeoutMs);
    void Promise.resolve().then((): AccessResult<T> | Promise<AccessResult<T>> => valid() ? callbacks.verify(valid) : { kind: "failed" }).then((result) => {
      if (!valid()) { finish(false); return; }
      if (result.kind !== "ready" || clock.now() - current.started >= policy.budgetMs) {
        invalidate(result.kind === "unavailable" ? "unavailable" : "failed");
        finish(false); retryLater(); return;
      }
      until = current.started + policy.budgetMs;
      state = { phase: "ready", revision: state.revision + 1, verifiedAt: current.started };
      callbacks.publish(result.data, state.revision);
      callbacks.changed(state);
      clearTimers();
      cancelExpiry = clock.schedule(() => { invalidate("failed"); retryLater(); }, until - clock.now());
      cancelRefresh = clock.schedule(() => { void refresh(); }, current.started + policy.refreshMs - clock.now());
      finish(true);
    }).catch(() => {
      if (!valid()) { finish(false); return; }
      invalidate("failed"); finish(false); retryLater();
    });
    return promise;
  }
  const hasFreshAccess = () => usable() && state.phase === "ready" && clock.now() < until;
  const canDispatch = () => hasFreshAccess() && writes === 0;
  return {
    setCallbacks: (next) => {
      const replaced = callbacks.verify !== next.verify || callbacks.publish !== next.publish;
      callbacks = { ...options, ...next };
      if (!replaced) return;
      // Callback registration never owns focus. Cancel the old read generation,
      // including waiters, and verify again only if the screen is still active.
      invalidate("checking"); abandon();
      const waiting = queued; queued = []; waiting.forEach((resolve) => resolve(false));
      if (usable()) void refresh();
    },
    state: () => state, refresh, canDispatch, hasFreshAccess,
    start: () => { if (focused) return; focused = true; void refresh(true); },
    stop: () => {
      focused = false; invalidate("checking"); abandon();
      const waiting = queued; queued = []; waiting.forEach((resolve) => resolve(false));
    },
    foreground: (active) => {
      if (active === foreground) return;
      foreground = active;
      if (!active) {
        invalidate("checking"); abandon();
        const waiting = queued; queued = []; waiting.forEach((resolve) => resolve(false));
      }
      else if (focused) { void refresh(true); }
    },
    invalidate: () => { invalidate("failed"); retryLater(); },
    beginMutation: () => {
      if (!canDispatch()) return null;
      // Keep the mutation controller alive, but discard pre-write read results.
      epoch++; abandon(); cancelRefresh?.(); cancelRefresh = undefined; writes++;
      let finished: Promise<boolean> | null = null;
      return (revalidate = true) => {
        if (finished) return finished;
        writes--;
        if (!usable()) { finished = Promise.resolve(false); return finished; }
        invalidate(revalidate ? "checking" : "failed");
        finished = revalidate ? refresh() : Promise.resolve(false);
        if (!revalidate) retryLater();
        drain(); return finished;
      };
    },
  };
}

export function useAccessRevalidation<T>(options: Options<T>) {
  const [state, setState] = useState<AccessState>({ phase: "checking", revision: 0, verifiedAt: null });
  const { budgetMs, refreshMs, timeoutMs } = options.policy ?? DEFAULT_ACCESS_POLICY;
  const controller = useMemo(() => createAccessRevalidation<T>({
    policy: { budgetMs, refreshMs, timeoutMs },
    verify: async () => ({ kind: "failed" }), publish: () => {}, changed: () => {},
  }), [budgetMs, refreshMs, timeoutMs]);
  const { verify, publish } = options;
  useLayoutEffect(() => {
    let active = true;
    controller.setCallbacks({ verify, publish: (data, revision) => { if (active) publish(data, revision); },
      changed: (next) => { if (active) setState(next); } });
    return () => { active = false; };
  }, [controller, verify, publish]);
  useLayoutEffect(() => () => controller.stop(), [controller]);
  useEffect(() => {
    controller.foreground(AppState.currentState === "active");
    const change = AppState.addEventListener("change", (value) => controller.foreground(value === "active"));
    const focus = () => { if (AppState.currentState === "active") void controller.refresh(true); };
    const offline = () => controller.invalidate();
    if (Platform.OS === "web") {
      window.addEventListener("focus", focus); window.addEventListener("online", focus); window.addEventListener("offline", offline);
    }
    return () => {
      change.remove(); controller.stop();
      if (Platform.OS === "web") {
        window.removeEventListener("focus", focus); window.removeEventListener("online", focus); window.removeEventListener("offline", offline);
      }
    };
  }, [controller]);
  return { controller, state };
}
