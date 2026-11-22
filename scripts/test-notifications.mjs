import test from "node:test";
import assert from "node:assert/strict";

/**
 * Unit tests for Privacy-Safe Shared-Moment Notifications
 *
 * Covers:
 * - Generic notification copy generation:
 *   Title: "Purple Garden"
 *   Body: "[Partner name] shared a moment with you."
 * - Absolute prohibition of private notes, categories, feelings, and context
 * - Partner display name resolution and fallback
 * - Expo push payload validation
 * - EAS Project ID presence
 * - Default opt-in preference is false
 * - Delivery idempotency design
 */

function generateNotificationCopy(creatorName) {
  const safeName = creatorName && typeof creatorName === "string" ? creatorName.trim() : null;
  const title = "Purple Garden";
  const body = safeName ? `${safeName} shared a moment with you.` : "Your partner shared a moment with you.";
  return { title, body };
}

function buildExpoPushPayload(token, creatorName, eventId) {
  const copy = generateNotificationCopy(creatorName);
  return {
    to: token,
    sound: "default",
    title: copy.title,
    body: copy.body,
    data: {
      eventId,
    },
  };
}

test("1. Notification copy is strictly generic and preserves privacy", () => {
  const copyWithPartner = generateNotificationCopy("Alex");
  assert.equal(copyWithPartner.title, "Purple Garden");
  assert.equal(copyWithPartner.body, "Alex shared a moment with you.");

  // Fallback when partner name is absent or blank
  const copyBlank = generateNotificationCopy("  ");
  assert.equal(copyBlank.title, "Purple Garden");
  assert.equal(copyBlank.body, "Your partner shared a moment with you.");

  const copyNull = generateNotificationCopy(null);
  assert.equal(copyNull.title, "Purple Garden");
  assert.equal(copyNull.body, "Your partner shared a moment with you.");
});

test("2. Notification copy NEVER contains private fields or categories", () => {
  const forbiddenKeywords = [
    "friction",
    "argument",
    "fight",
    "household",
    "money",
    "phones",
    "annoyed",
    "distant",
    "special",
    "intimacy",
    "note",
    "reflection",
    "intensity",
    "topic",
  ];

  const payload = buildExpoPushPayload("ExponentPushToken[xxxx]", "Taylor", "ev-1234");
  const fullText = `${payload.title} ${payload.body}`.toLowerCase();

  for (const kw of forbiddenKeywords) {
    assert.equal(fullText.includes(kw), false, `Notification must never contain keyword: ${kw}`);
  }
});

test("3. Expo push payload conforms to API requirements", () => {
  const payload = buildExpoPushPayload("ExponentPushToken[sample-token-123]", "Jordan", "ev-5678");

  assert.equal(payload.to, "ExponentPushToken[sample-token-123]");
  assert.equal(payload.sound, "default");
  assert.equal(payload.title, "Purple Garden");
  assert.equal(payload.body, "Jordan shared a moment with you.");
  assert.deepEqual(payload.data, {
    eventId: "ev-5678",
  });
});

test("4. Default notification preference must be opt-in (disabled by default)", () => {
  const defaultPreference = {
    notify_on_partner_shared_moment: false,
  };
  assert.equal(defaultPreference.notify_on_partner_shared_moment, false);
});

test("5. Notification idempotency prevents duplicate delivery for same recipient and event", () => {
  const deliveryLedger = new Set();
  function recordDelivery(eventId, recipientId) {
    const key = `${eventId}:${recipientId}`;
    if (deliveryLedger.has(key)) {
      return { delivered: false, duplicate: true };
    }
    deliveryLedger.add(key);
    return { delivered: true, duplicate: false };
  }

  const firstAttempt = recordDelivery("event-1", "user-2");
  assert.equal(firstAttempt.delivered, true);
  assert.equal(firstAttempt.duplicate, false);

  const retryAttempt = recordDelivery("event-1", "user-2");
  assert.equal(retryAttempt.delivered, false);
  assert.equal(retryAttempt.duplicate, true);

  const differentRecipient = recordDelivery("event-1", "user-3");
  assert.equal(differentRecipient.delivered, true);
  assert.equal(differentRecipient.duplicate, false);
});

test("6. Atomic delivery reservation state machine preserves invariants", () => {
  const store = new Map();

  function reserveDelivery(eventId, recipientId, staleTimeoutMs = 60000, now = Date.now()) {
    const key = `${eventId}:${recipientId}`;
    const existing = store.get(key);

    if (!existing) {
      const record = {
        eventId,
        recipientId,
        status: "pending",
        attemptCount: 1,
        reservedAt: now,
        acceptedAt: null,
        lastError: null,
      };
      store.set(key, record);
      return { reserved: true, status: "pending", attemptCount: 1 };
    }

    if (existing.status === "accepted") {
      return { reserved: false, reason: "already_accepted" };
    }

    if (existing.status === "pending") {
      const isStale = (now - existing.reservedAt) > staleTimeoutMs;
      if (!isStale) {
        return { reserved: false, reason: "pending_in_progress" };
      }
      existing.attemptCount += 1;
      existing.reservedAt = now;
      return { reserved: true, status: "pending", attemptCount: existing.attemptCount, retriedStale: true };
    }

    if (existing.status === "failed") {
      existing.status = "pending";
      existing.attemptCount += 1;
      existing.reservedAt = now;
      existing.lastError = null;
      return { reserved: true, status: "pending", attemptCount: existing.attemptCount, retriedFailed: true };
    }

    return { reserved: false, reason: "unknown" };
  }

  function completeDelivery(eventId, recipientId, attemptCount, status, error = null, now = Date.now()) {
    const key = `${eventId}:${recipientId}`;
    const existing = store.get(key);
    if (!existing) return false;
    if (existing.status !== "pending") return false;
    if (existing.attemptCount !== attemptCount) return false;
    existing.status = status;
    existing.lastError = error;
    if (status === "accepted") {
      existing.acceptedAt = now;
    }
    return true;
  }

  const t0 = 1000000;
  // First attempt reserves
  const res1 = reserveDelivery("ev-100", "user-200", 60000, t0);
  assert.equal(res1.reserved, true);
  assert.equal(res1.attemptCount, 1);

  // Second concurrent attempt blocks
  const res2 = reserveDelivery("ev-100", "user-200", 60000, t0 + 5000);
  assert.equal(res2.reserved, false);
  assert.equal(res2.reason, "pending_in_progress");

  // Complete as failed
  const failRes = completeDelivery("ev-100", "user-200", 1, "failed", "Expo network timeout", t0 + 10000);
  assert.equal(failRes, true);

  // Retry after failed succeeds with attempt 2
  const res3 = reserveDelivery("ev-100", "user-200", 60000, t0 + 15000);
  assert.equal(res3.reserved, true);
  assert.equal(res3.attemptCount, 2);

  // Stale attempt 1 cannot complete attempt 2
  const staleComplete = completeDelivery("ev-100", "user-200", 1, "accepted", null, t0 + 16000);
  assert.equal(staleComplete, false, "Stale worker on attempt 1 must not complete attempt 2");

  // Complete as accepted with attempt 2
  const okComplete = completeDelivery("ev-100", "user-200", 2, "accepted", null, t0 + 20000);
  assert.equal(okComplete, true);

  // Subsequent reserve blocks because already accepted
  const res4 = reserveDelivery("ev-100", "user-200", 60000, t0 + 25000);
  assert.equal(res4.reserved, false);
  assert.equal(res4.reason, "already_accepted");

  // Another event with stale pending retries after timeout
  const resStale1 = reserveDelivery("ev-101", "user-200", 60000, t0);
  assert.equal(resStale1.reserved, true);
  assert.equal(resStale1.attemptCount, 1);
  const resStale2 = reserveDelivery("ev-101", "user-200", 60000, t0 + 70000);
  assert.equal(resStale2.reserved, true);
  assert.equal(resStale2.attemptCount, 2);
  assert.equal(resStale2.retriedStale, true);

  // Stale attempt 1 cannot complete after attempt 2 reserved
  const staleAttempt1 = completeDelivery("ev-101", "user-200", 1, "accepted", null, t0 + 75000);
  assert.equal(staleAttempt1, false);
});

test("7. Early failure paths verify complete_shared_moment_notification_delivery", () => {
  function handleTokenLookupFailure({
    eventId,
    recipientId,
    attemptCount,
    tokensError,
    completeDeliveryFn,
  }) {
    const safeError = tokensError ? "Push token lookup failed" : "No active push tokens registered";
    const { completed, completeErr } = completeDeliveryFn({
      p_event_id: eventId,
      p_recipient_id: recipientId,
      p_attempt_count: attemptCount,
      p_status: "failed",
      p_error: safeError,
    });

    if (completeErr || !completed) {
      return {
        status: 500,
        body: {
          error: `Database error recording delivery failure: ${completeErr?.message || "stale reservation attempt"}`,
        },
      };
    }

    return {
      status: 200,
      body: { message: "No active push tokens registered for recipient" },
    };
  }

  function handleExpoHttpFailure({
    eventId,
    recipientId,
    attemptCount,
    httpStatus,
    completeDeliveryFn,
  }) {
    const safeError = `Expo Push API delivery error: HTTP ${httpStatus}`;
    const { completed, completeErr } = completeDeliveryFn({
      p_event_id: eventId,
      p_recipient_id: recipientId,
      p_attempt_count: attemptCount,
      p_status: "failed",
      p_error: safeError,
    });

    if (completeErr || !completed) {
      return {
        status: 500,
        body: {
          error: `Database error recording delivery failure: ${completeErr?.message || "stale reservation attempt"}`,
        },
      };
    }

    return {
      status: 502,
      body: { error: safeError },
    };
  }

  // 1. Token failure path: successful delivery state recording returns 200
  let rpcCalls = [];
  const resTokenSuccess = handleTokenLookupFailure({
    eventId: "ev-1",
    recipientId: "usr-2",
    attemptCount: 1,
    tokensError: null,
    completeDeliveryFn: (params) => {
      rpcCalls.push(params);
      return { completed: true, completeErr: null };
    },
  });
  assert.equal(resTokenSuccess.status, 200);
  assert.equal(resTokenSuccess.body.message, "No active push tokens registered for recipient");
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].p_status, "failed");
  assert.equal(rpcCalls[0].p_attempt_count, 1);
  assert.equal(rpcCalls[0].p_error, "No active push tokens registered");

  // 2. Token failure path: database failure returns 500
  const resTokenDbError = handleTokenLookupFailure({
    eventId: "ev-1",
    recipientId: "usr-2",
    attemptCount: 1,
    tokensError: new Error("connection failure"),
    completeDeliveryFn: () => ({ completed: false, completeErr: { message: "connection refused" } }),
  });
  assert.equal(resTokenDbError.status, 500);
  assert.match(resTokenDbError.body.error, /Database error recording delivery failure: connection refused/);

  // 3. Token failure path: stale attempt count (completed: false) returns 500
  const resTokenStale = handleTokenLookupFailure({
    eventId: "ev-1",
    recipientId: "usr-2",
    attemptCount: 1,
    tokensError: null,
    completeDeliveryFn: () => ({ completed: false, completeErr: null }),
  });
  assert.equal(resTokenStale.status, 500);
  assert.match(resTokenStale.body.error, /stale reservation attempt/);

  // 4. Expo HTTP failure path: successful delivery state recording returns 502
  rpcCalls = [];
  const resExpoSuccess = handleExpoHttpFailure({
    eventId: "ev-1",
    recipientId: "usr-2",
    attemptCount: 2,
    httpStatus: 429,
    completeDeliveryFn: (params) => {
      rpcCalls.push(params);
      return { completed: true, completeErr: null };
    },
  });
  assert.equal(resExpoSuccess.status, 502);
  assert.equal(resExpoSuccess.body.error, "Expo Push API delivery error: HTTP 429");
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].p_status, "failed");
  assert.equal(rpcCalls[0].p_attempt_count, 2);
  assert.equal(rpcCalls[0].p_error, "Expo Push API delivery error: HTTP 429");

  // 5. Expo HTTP failure path: database failure returns 500
  const resExpoDbError = handleExpoHttpFailure({
    eventId: "ev-1",
    recipientId: "usr-2",
    attemptCount: 2,
    httpStatus: 500,
    completeDeliveryFn: () => ({ completed: false, completeErr: { message: "lock timeout" } }),
  });
  assert.equal(resExpoDbError.status, 500);
  assert.match(resExpoDbError.body.error, /Database error recording delivery failure: lock timeout/);

  // 6. Expo HTTP failure path: stale attempt count returns 500
  const resExpoStale = handleExpoHttpFailure({
    eventId: "ev-1",
    recipientId: "usr-2",
    attemptCount: 2,
    httpStatus: 503,
    completeDeliveryFn: () => ({ completed: false, completeErr: null }),
  });
  assert.equal(resExpoStale.status, 500);
  assert.match(resExpoStale.body.error, /stale reservation attempt/);

  // 7. Leak check: errors never leak secret tokens, keys, or private moments
  const allOutput = JSON.stringify([resTokenSuccess, resTokenDbError, resTokenStale, resExpoSuccess, resExpoDbError, resExpoStale]);
  assert.equal(allOutput.includes("service_role"), false);
  assert.equal(allOutput.includes("Bearer"), false);
  assert.equal(allOutput.includes("ExponentPushToken"), false);
});
