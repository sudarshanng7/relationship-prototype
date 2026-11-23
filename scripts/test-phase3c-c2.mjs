import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ARTIFACT_DIR = path.resolve("test-results/phase3c");
const REPORT_FILE = path.join(ARTIFACT_DIR, "c2-cross-couple-report.json");
const LOCAL_SUPABASE_HOST = "127.0.0.1:54321";
const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const RUN_ID = Date.now().toString(36);

const PRIMARY_COUPLE = {
  coupleId: "10000002-0002-0002-0002-000000000001",
  partnerA: {
    email: "partner-a@example.com",
    password: process.env.PG_QA_PASSWORD,
    id: "a0000001-0001-0001-0001-000000000001",
    displayName: "Partner A",
  },
  partnerB: {
    email: "partner-b@example.com",
    password: process.env.PG_QA_PASSWORD,
    id: "b0000001-0001-0001-0001-000000000002",
    displayName: "Partner B",
  },
  targetEventId: "c6ff8008-cba9-4bb1-ad74-335ae9d4a635",
  targetWeeklyId: "24ff05a3-d11b-4767-b781-a65d3db3a4cc",
};

const SECOND_COUPLE = {
  coupleId: "20000002-0002-0002-0002-000000000002",
  userX: {
    email: "partner-c@example.com",
    password: process.env.PG_QA_PASSWORD,
    id: "c0000001-0001-0001-0001-000000000003",
    displayName: "Partner C (User X)",
  },
  existingEventId: "e0000003-0003-0003-0003-000000000009",
};

function queryDb(sql) {
  try {
    const escaped = sql.replace(/"/g, '\\"');
    const cmd = `docker exec -i supabase_db_relationship-prototype psql -U postgres -d postgres -t -A -c "${escaped}"`;
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch (err) {
    return `DB_ERROR: ${err.message}`;
  }
}

fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

async function runScenarioC2() {
  console.log("=== PURPLE GARDEN: PHASE 3C / C2: CROSS-COUPLE AUTHORIZATION TEST ===");
  console.log(`Timestamp: ${new Date().toISOString()} | RUN_ID: ${RUN_ID}`);

  const networkAudit = {
    remoteRequestsDetected: [],
    localRequests: 0,
  };

  const monitoredFetch = async (url, options = {}) => {
    const urlStr = String(url);
    if (urlStr.includes("supabase.co") || urlStr.includes("taxxvpkgzyevrhbytlqi")) {
      console.error(`[CRITICAL LEAK] Remote Supabase call detected: ${urlStr}`);
      networkAudit.remoteRequestsDetected.push({ url: urlStr, method: options.method || "GET" });
    } else if (urlStr.includes(LOCAL_SUPABASE_HOST) || urlStr.includes("54321")) {
      networkAudit.localRequests++;
    }
    return fetch(url, options);
  };

  const clientX = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { fetch: monitoredFetch },
  });

  const clientA = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { fetch: monitoredFetch },
  });

  console.log("\n[Setup] Authenticating User X (Partner C) and Primary Partner A...");
  const { data: authX, error: errX } = await clientX.auth.signInWithPassword({
    email: SECOND_COUPLE.userX.email,
    password: SECOND_COUPLE.userX.password,
  });
  if (errX || !authX.user) {
    console.error(`[BLOCKED] Failed to authenticate User X: ${errX?.message}`);
    process.exit(2);
  }
  console.log(`  User X authenticated: UID ${authX.user.id} (${SECOND_COUPLE.userX.email})`);

  const { data: authA, error: errA } = await clientA.auth.signInWithPassword({
    email: PRIMARY_COUPLE.partnerA.email,
    password: PRIMARY_COUPLE.partnerA.password,
  });
  if (errA || !authA.user) {
    console.error(`[BLOCKED] Failed to authenticate Partner A: ${errA?.message}`);
    process.exit(2);
  }
  console.log(`  Primary Partner A authenticated: UID ${authA.user.id}`);

  // Authoritative before snapshots
  const beforeEvent = queryDb(`SELECT id, couple_id, status, shared_topic FROM public.relationship_events WHERE id = '${PRIMARY_COUPLE.targetEventId}';`);
  const beforeWeekly = queryDb(`SELECT id, user_id, week_start, private_note FROM public.weekly_reflections WHERE id = '${PRIMARY_COUPLE.targetWeeklyId}';`);
  const beforeOutcomesCount = queryDb(`SELECT count(*) FROM public.relationship_event_repair_outcomes WHERE event_id = '${PRIMARY_COUPLE.targetEventId}';`);
  const beforeReceiptsCount = queryDb(`SELECT count(*) FROM public.home_activity_receipts WHERE couple_id = '${PRIMARY_COUPLE.coupleId}';`);

  console.log(`\nAuthoritative Before Snapshots:`);
  console.log(`  - Target Event: ${beforeEvent}`);
  console.log(`  - Target Weekly: ${beforeWeekly}`);
  console.log(`  - Primary Outcomes Count: ${beforeOutcomesCount}`);
  console.log(`  - Primary Receipts Count: ${beforeReceiptsCount}`);

  const results = {
    runId: RUN_ID,
    timestamp: new Date().toISOString(),
    secondCoupleAudit: {},
    c2_1_identityVerification: { status: "PENDING", details: {} },
    c2_2_foreignRelationshipEvents: { status: "PENDING", details: {} },
    c2_3_foreignPrivateAndWeekly: { status: "PENDING", details: {} },
    c2_4_foreignRepairData: { status: "PENDING", details: {} },
    c2_5_foreignHomeActivityReceipts: { status: "PENDING", details: {} },
    c2_6_authorizedControl: { status: "PENDING", details: {} },
    c2_7_finalIntegrityAndNetwork: { status: "PENDING", details: {} },
    networkAudit,
  };

  const disposableEvents = [];

  try {
    // =========================================================================
    // C2.1 — COUPLE IDENTITY VERIFICATION
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- C2.1: COUPLE IDENTITY VERIFICATION ---");
    console.log("========================================================");

    // Query couple membership for User X via clientX
    const { data: xCouples, error: xCouplesErr } = await clientX
      .from("couple_members")
      .select("couple_id, user_id, joined_at");

    console.log(`  User X couple memberships from RLS: ${JSON.stringify(xCouples)}`);

    const xMemberships = xCouples?.map((c) => c.couple_id) || [];
    const inSecondCouple = xMemberships.includes(SECOND_COUPLE.coupleId);
    const inPrimaryCouple = xMemberships.includes(PRIMARY_COUPLE.coupleId);

    // Query DB directly to check second couple user count
    const secondCoupleMembers = queryDb(`
      SELECT user_id, email FROM public.couple_members cm JOIN auth.users u ON cm.user_id = u.id WHERE cm.couple_id = '${SECOND_COUPLE.coupleId}';
    `);
    const secondCoupleMemberCount = secondCoupleMembers.split("\n").filter(Boolean).length;
    console.log(`  Authoritative Second Couple Members Count: ${secondCoupleMemberCount}`);
    console.log(`  Members in Second Couple: ${secondCoupleMembers.replace(/\n/g, ", ")}`);

    results.secondCoupleAudit = {
      secondCoupleId: SECOND_COUPLE.coupleId,
      primaryCoupleId: PRIMARY_COUPLE.coupleId,
      userXId: SECOND_COUPLE.userX.id,
      memberCount: secondCoupleMemberCount,
      hasSecondPartnerInCouple2: secondCoupleMemberCount >= 2,
    };

    const c2_1_pass = inSecondCouple && !inPrimaryCouple;
    results.c2_1_identityVerification = {
      status: c2_1_pass ? "PASS" : "FAIL",
      details: {
        userXId: authX.user.id,
        inSecondCouple,
        inPrimaryCouple,
        secondCoupleMemberCount,
      },
    };
    console.log(`>>> C2.1 RESULT: [${results.c2_1_identityVerification.status}] <<<`);

    // =========================================================================
    // C2.2 — FOREIGN RELATIONSHIP EVENTS
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- C2.2: FOREIGN RELATIONSHIP EVENTS ---");
    console.log("========================================================");

    // 1. User X attempts SELECT of Primary Couple's target event
    const { data: xSelectEventById, error: xSelectByIdErr } = await clientX
      .from("relationship_events")
      .select("id, couple_id, creator_id, shared_topic")
      .eq("id", PRIMARY_COUPLE.targetEventId);

    console.log(`  User X SELECT Primary event by ID: rows returned: ${xSelectEventById?.length || 0}`);

    // 2. User X attempts SELECT of all events filtered by Primary couple_id
    const { data: xSelectByCoupleId, error: xSelectByCoupleErr } = await clientX
      .from("relationship_events")
      .select("id, couple_id")
      .eq("couple_id", PRIMARY_COUPLE.coupleId);

    console.log(`  User X SELECT Primary events by couple_id: rows returned: ${xSelectByCoupleId?.length || 0}`);

    // 3. User X attempts unauthorized UPDATE on Primary Couple's target event
    const { data: xUpdateEvent, error: xUpdateErr, count: xUpdateCount } = await clientX
      .from("relationship_events")
      .update({ shared_topic: "MALICIOUS_TOPIC_BY_USER_X" }, { count: "exact" })
      .eq("id", PRIMARY_COUPLE.targetEventId)
      .select();

    console.log(`  User X UPDATE Primary event: rows returned: ${xUpdateEvent?.length || 0}, count: ${xUpdateCount}, error: ${xUpdateErr?.message || "none"}`);

    // 4. User X attempts unauthorized DELETE on Primary Couple's target event
    const { data: xDeleteEvent, error: xDeleteErr, count: xDeleteCount } = await clientX
      .from("relationship_events")
      .delete({ count: "exact" })
      .eq("id", PRIMARY_COUPLE.targetEventId)
      .select();

    console.log(`  User X DELETE Primary event: rows returned: ${xDeleteEvent?.length || 0}, count: ${xDeleteCount}, error: ${xDeleteErr?.message || "none"}`);

    // 5. User X attempts to INSERT an event directly into Primary Couple
    const { data: xInsertEvent, error: xInsertErr } = await clientX
      .from("relationship_events")
      .insert({
        couple_id: PRIMARY_COUPLE.coupleId,
        creator_id: SECOND_COUPLE.userX.id,
        event_type: "friction",
        category: "household",
        intensity: 2,
        visibility: "ours",
        shared_topic: `FORGED_EVENT_BY_USER_X_${RUN_ID}`,
      })
      .select();

    console.log(`  User X INSERT event into Primary couple: error: ${xInsertErr?.message || "none"} (Code: ${xInsertErr?.code || "none"})`);

    // Verify DB authoritative state for Primary target event
    const dbEventCheck = queryDb(`SELECT shared_topic FROM public.relationship_events WHERE id = '${PRIMARY_COUPLE.targetEventId}';`);
    const eventUnmutated = dbEventCheck && !dbEventCheck.includes("MALICIOUS_TOPIC_BY_USER_X");

    // Positive Control: User X can read their own event in Couple 2
    const { data: xOwnEvent, error: xOwnEventErr } = await clientX
      .from("relationship_events")
      .select("id, couple_id")
      .eq("id", SECOND_COUPLE.existingEventId);
    console.log(`  User X positive control: read own event ${SECOND_COUPLE.existingEventId}: ${xOwnEvent?.length || 0} rows`);

    const c2_2_pass = xSelectEventById?.length === 0 &&
                      xSelectByCoupleId?.length === 0 &&
                      (!xUpdateEvent || xUpdateEvent.length === 0 || xUpdateCount === 0 || xUpdateErr !== null) &&
                      (!xDeleteEvent || xDeleteEvent.length === 0 || xDeleteCount === 0 || xDeleteErr !== null) &&
                      xInsertErr !== null &&
                      eventUnmutated &&
                      xOwnEvent?.length === 1;

    results.c2_2_foreignRelationshipEvents = {
      status: c2_2_pass ? "PASS" : "FAIL",
      details: {
        readByIdRows: xSelectEventById?.length || 0,
        readByCoupleRows: xSelectByCoupleId?.length || 0,
        updateAttemptRows: xUpdateEvent?.length || 0,
        deleteAttemptRows: xDeleteEvent?.length || 0,
        insertDeniedError: xInsertErr?.message || null,
        insertDeniedCode: xInsertErr?.code || null,
        targetEventUnmutated: eventUnmutated,
        positiveControlOwnEvent: xOwnEvent?.length === 1,
      },
    };
    console.log(`>>> C2.2 RESULT: [${results.c2_2_foreignRelationshipEvents.status}] <<<`);

    // =========================================================================
    // C2.3 — FOREIGN PRIVATE AND WEEKLY RECORDS
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- C2.3: FOREIGN PRIVATE AND WEEKLY RECORDS ---");
    console.log("========================================================");

    // 1. User X attempts SELECT on Primary Couple's private reflections
    const { data: xSelectPrivate, error: xSelectPrivateErr } = await clientX
      .from("event_private_reflections")
      .select("id, author_id, note")
      .eq("event_id", PRIMARY_COUPLE.targetEventId);

    console.log(`  User X SELECT Primary private reflections: rows returned: ${xSelectPrivate?.length || 0}`);

    // 2. User X attempts SELECT on Partner A's weekly reflection
    const { data: xSelectWeekly, error: xSelectWeeklyErr } = await clientX
      .from("weekly_reflections")
      .select("id, user_id, private_note")
      .eq("id", PRIMARY_COUPLE.targetWeeklyId);

    console.log(`  User X SELECT Partner A weekly reflection: rows returned: ${xSelectWeekly?.length || 0}`);

    // 3. User X attempts UPDATE on Partner A's weekly reflection
    const { data: xUpdateWeekly, error: xUpdateWeeklyErr, count: xUpdateWeeklyCount } = await clientX
      .from("weekly_reflections")
      .update({ private_note: "MALICIOUS_WEEKLY_BY_USER_X" }, { count: "exact" })
      .eq("id", PRIMARY_COUPLE.targetWeeklyId)
      .select();

    console.log(`  User X UPDATE Partner A weekly reflection: rows: ${xUpdateWeekly?.length || 0}, count: ${xUpdateWeeklyCount}`);

    // 4. User X attempts DELETE on Partner A's weekly reflection
    const { data: xDeleteWeekly, error: xDeleteWeeklyErr, count: xDeleteWeeklyCount } = await clientX
      .from("weekly_reflections")
      .delete({ count: "exact" })
      .eq("id", PRIMARY_COUPLE.targetWeeklyId)
      .select();

    console.log(`  User X DELETE Partner A weekly reflection: rows: ${xDeleteWeekly?.length || 0}, count: ${xDeleteWeeklyCount}`);

    // 5. User X attempts forged INSERT of weekly reflection tied to Primary Couple
    const { data: xInsertWeekly, error: xInsertWeeklyErr } = await clientX
      .from("weekly_reflections")
      .insert({
        user_id: SECOND_COUPLE.userX.id,
        couple_id: PRIMARY_COUPLE.coupleId,
        week_start: "2026-11-09T00:00:00.000Z",
        week_end: "2026-11-16T00:00:00.000Z",
        stayed_with: "Nothing in particular",
        carry_forward: "Keep things as they are",
        private_note: "USER_X_FORGED_INTO_PRIMARY_COUPLE",
      })
      .select();

    console.log(`  User X INSERT weekly reflection with Primary couple_id: error: ${xInsertWeeklyErr?.message || "none"}`);

    const c2_3_pass = xSelectPrivate?.length === 0 &&
                      xSelectWeekly?.length === 0 &&
                      (xUpdateWeekly?.length === 0 || xUpdateWeeklyCount === 0) &&
                      (xDeleteWeekly?.length === 0 || xDeleteWeeklyCount === 0) &&
                      xInsertWeeklyErr !== null &&
                      (xInsertWeeklyErr.message.includes("User does not belong to the specified couple") || xInsertWeeklyErr.code === "P0001");

    results.c2_3_foreignPrivateAndWeekly = {
      status: c2_3_pass ? "PASS" : "FAIL",
      details: {
        foreignPrivateReadRows: xSelectPrivate?.length || 0,
        foreignWeeklyReadRows: xSelectWeekly?.length || 0,
        updateWeeklyRows: xUpdateWeekly?.length || 0,
        deleteWeeklyRows: xDeleteWeekly?.length || 0,
        foreignCoupleWeeklyInsertError: xInsertWeeklyErr?.message || null,
      },
    };
    console.log(`>>> C2.3 RESULT: [${results.c2_3_foreignPrivateAndWeekly.status}] <<<`);

    // =========================================================================
    // C2.4 — FOREIGN REPAIR DATA
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- C2.4: FOREIGN REPAIR DATA ---");
    console.log("========================================================");

    // 1. User X attempts SELECT on Primary Couple repair responses
    const { data: xSelectResponses, error: xSelectResponsesErr } = await clientX
      .from("relationship_event_repair_responses")
      .select("id, event_id, response_code")
      .eq("event_id", PRIMARY_COUPLE.targetEventId);

    console.log(`  User X SELECT Primary repair responses: rows returned: ${xSelectResponses?.length || 0}`);

    // 2. User X attempts SELECT on Primary Couple repair outcomes
    const { data: xSelectOutcomes, error: xSelectOutcomesErr } = await clientX
      .from("relationship_event_repair_outcomes")
      .select("event_id, couple_id, takeaway_tag, takeaway_note")
      .eq("event_id", PRIMARY_COUPLE.targetEventId);

    console.log(`  User X SELECT Primary repair outcomes: rows returned: ${xSelectOutcomes?.length || 0}`);

    // 3. User X attempts calling submit_repair_response on Primary target event
    const { data: xRpcResponse, error: xRpcResponseErr } = await clientX.rpc("submit_repair_response", {
      p_event_id: PRIMARY_COUPLE.targetEventId,
      p_phase: "arrival",
      p_response_code: "heard",
    });

    console.log(`  User X submit_repair_response on Primary event: error: ${xRpcResponseErr?.message || "none"}`);

    // 4. User X attempts calling complete_repair_reconnection on Primary target event
    const { data: xRpcComplete, error: xRpcCompleteErr } = await clientX.rpc("complete_repair_reconnection", {
      p_event_id: PRIMARY_COUPLE.targetEventId,
      p_takeaway_tag: "talking_it_through",
      p_takeaway_note: "MALICIOUS_TAKEAWAY_BY_USER_X",
    });

    console.log(`  User X complete_repair_reconnection on Primary event: error: ${xRpcCompleteErr?.message || "none"}`);

    const c2_4_pass = (xSelectResponses?.length === 0) &&
                      (xSelectOutcomes?.length === 0) &&
                      (xRpcResponseErr !== null) &&
                      Boolean(xRpcResponseErr?.message?.includes("Relationship membership required") || xRpcResponseErr?.message?.includes("User does not belong to this couple")) &&
                      (xRpcCompleteErr !== null) &&
                      Boolean(xRpcCompleteErr?.message?.includes("Relationship membership required") || xRpcCompleteErr?.message?.includes("User does not belong to this couple") || xRpcCompleteErr?.message?.includes("Only the event creator may complete reconnection") || xRpcCompleteErr?.message?.includes("already reconnected"));

    results.c2_4_foreignRepairData = {
      status: c2_4_pass ? "PASS" : "FAIL",
      details: {
        repairResponsesReadRows: xSelectResponses?.length || 0,
        repairOutcomesReadRows: xSelectOutcomes?.length || 0,
        submitRepairResponseError: xRpcResponseErr?.message || null,
        completeRepairReconnectionError: xRpcCompleteErr?.message || null,
      },
    };
    console.log(`>>> C2.4 RESULT: [${results.c2_4_foreignRepairData.status}] <<<`);

    // =========================================================================
    // C2.5 — FOREIGN HOME ACTIVITY RECEIPTS
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- C2.5: FOREIGN HOME ACTIVITY RECEIPTS ---");
    console.log("========================================================");

    // 1. User X attempts SELECT on Primary Couple's receipts
    const { data: xSelectReceipts, error: xSelectReceiptsErr } = await clientX
      .from("home_activity_receipts")
      .select("id, activity_key, user_id, couple_id")
      .eq("couple_id", PRIMARY_COUPLE.coupleId);

    console.log(`  User X SELECT Primary receipts by couple_id: rows returned: ${xSelectReceipts?.length || 0}`);

    // 2. User X attempts SELECT on Partner A's receipts
    const { data: xSelectReceiptsByPartnerA, error: xSelectReceiptsByPartnerAErr } = await clientX
      .from("home_activity_receipts")
      .select("id, activity_key, user_id")
      .eq("user_id", PRIMARY_COUPLE.partnerA.id);

    console.log(`  User X SELECT Partner A receipts: rows returned: ${xSelectReceiptsByPartnerA?.length || 0}`);

    // 3. User X attempts calling record_home_activity_receipt on Primary Couple's event
    const { data: xReceiptRpc, error: xReceiptRpcErr } = await clientX.rpc("record_home_activity_receipt", {
      p_activity_key: `shared_friction:${PRIMARY_COUPLE.targetEventId}:2026-11-23T20:30:00.000Z`,
      p_activity_kind: "shared_friction",
      p_source_id: PRIMARY_COUPLE.targetEventId,
      p_attention_mode: "actionable",
    });

    console.log(`  User X record_home_activity_receipt on Primary event: error: ${xReceiptRpcErr?.message || "none"}`);

    // 4. User X attempts direct INSERT into home_activity_receipts with Primary couple_id
    const { data: xInsertReceipt, error: xInsertReceiptErr } = await clientX
      .from("home_activity_receipts")
      .insert({
        couple_id: PRIMARY_COUPLE.coupleId,
        user_id: SECOND_COUPLE.userX.id,
        activity_key: `forged_receipt:${RUN_ID}`,
        activity_kind: "shared_friction",
        source_id: PRIMARY_COUPLE.targetEventId,
        attention_mode: "actionable",
        seen_at: new Date().toISOString(),
      })
      .select();

    console.log(`  User X direct INSERT into home_activity_receipts with Primary couple_id: error: ${xInsertReceiptErr?.message || "none"}`);

    const c2_5_pass = xSelectReceipts?.length === 0 &&
                      xSelectReceiptsByPartnerA?.length === 0 &&
                      xReceiptRpcErr !== null &&
                      xReceiptRpcErr.message.includes("Activity unavailable") &&
                      (xInsertReceiptErr !== null || xInsertReceipt?.length === 0);

    results.c2_5_foreignHomeActivityReceipts = {
      status: c2_5_pass ? "PASS" : "FAIL",
      details: {
        receiptsByCoupleReadRows: xSelectReceipts?.length || 0,
        receiptsByPartnerAReadRows: xSelectReceiptsByPartnerA?.length || 0,
        receiptRpcError: xReceiptRpcErr?.message || null,
        directInsertReceiptError: xInsertReceiptErr?.message || null,
      },
    };
    console.log(`>>> C2.5 RESULT: [${results.c2_5_foreignHomeActivityReceipts.status}] <<<`);

    // =========================================================================
    // C2.6 — AUTHORIZED CONTROL
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- C2.6: AUTHORIZED CONTROL ---");
    console.log("========================================================");

    // 1. User X can legitimately read their own Couple 2 event
    const { data: xLegitReadOwn, error: xLegitReadErr } = await clientX
      .from("relationship_events")
      .select("id, couple_id, shared_topic")
      .eq("id", SECOND_COUPLE.existingEventId);
    console.log(`  User X legitimate read of own event: ${xLegitReadOwn?.length || 0} rows`);

    // 2. User X can legitimately read their own couple membership
    const { data: xLegitMembers, error: xLegitMembersErr } = await clientX
      .from("couple_members")
      .select("couple_id, user_id")
      .eq("couple_id", SECOND_COUPLE.coupleId);
    console.log(`  User X legitimate read of own couple members: ${xLegitMembers?.length || 0} rows`);

    // 3. User X can legitimately create and delete a disposable event in their own Couple 2
    const { data: xLegitInsert, error: xLegitInsertErr } = await clientX
      .from("relationship_events")
      .insert({
        couple_id: SECOND_COUPLE.coupleId,
        creator_id: SECOND_COUPLE.userX.id,
        event_type: "positive",
        category: "appreciation",
        intensity: 1,
        visibility: "ours",
        shared_topic: `DISPOSABLE_USER_X_EVENT_${RUN_ID}`,
      })
      .select("id")
      .single();

    console.log(`  User X legitimate insert in own couple: ${xLegitInsert?.id || "FAILED"} (Error: ${xLegitInsertErr?.message || "none"})`);
    if (xLegitInsert?.id) {
      disposableEvents.push(xLegitInsert.id);
      // Clean it up immediately via clientX
      const { data: xLegitDelete, error: xLegitDeleteErr } = await clientX
        .from("relationship_events")
        .delete()
        .eq("id", xLegitInsert.id)
        .select("id");
      console.log(`  User X legitimate delete of own event: rows: ${xLegitDelete?.length || 0}`);
    }

    const c2_6_pass = xLegitReadOwn?.length === 1 &&
                      xLegitMembers?.length >= 1 &&
                      xLegitInsert?.id !== undefined;

    results.c2_6_authorizedControl = {
      status: c2_6_pass ? "PASS" : "FAIL",
      details: {
        ownEventReadSuccess: xLegitReadOwn?.length === 1,
        ownMembersReadSuccess: xLegitMembers?.length >= 1,
        ownEventInsertSuccess: xLegitInsert?.id !== undefined,
      },
    };
    console.log(`>>> C2.6 RESULT: [${results.c2_6_authorizedControl.status}] <<<`);

    // =========================================================================
    // C2.7 — FINAL INTEGRITY
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- C2.7: FINAL INTEGRITY ---");
    console.log("========================================================");

    // Verify Primary Couple data is 100% unchanged
    const afterEvent = queryDb(`SELECT id, couple_id, status, shared_topic FROM public.relationship_events WHERE id = '${PRIMARY_COUPLE.targetEventId}';`);
    const afterWeekly = queryDb(`SELECT id, user_id, week_start, private_note FROM public.weekly_reflections WHERE id = '${PRIMARY_COUPLE.targetWeeklyId}';`);
    const afterOutcomesCount = queryDb(`SELECT count(*) FROM public.relationship_event_repair_outcomes WHERE event_id = '${PRIMARY_COUPLE.targetEventId}';`);
    const afterReceiptsCount = queryDb(`SELECT count(*) FROM public.home_activity_receipts WHERE couple_id = '${PRIMARY_COUPLE.coupleId}';`);

    const eventUnchanged = afterEvent === beforeEvent;
    const weeklyUnchanged = afterWeekly === beforeWeekly;
    const outcomesUnchanged = afterOutcomesCount === beforeOutcomesCount;
    const receiptsUnchanged = afterReceiptsCount === beforeReceiptsCount;

    console.log(`  Primary Event Unchanged: ${eventUnchanged}`);
    console.log(`  Primary Weekly Unchanged: ${weeklyUnchanged}`);
    console.log(`  Primary Outcomes Count Unchanged: ${outcomesUnchanged}`);
    console.log(`  Primary Receipts Count Unchanged: ${receiptsUnchanged}`);

    const remoteLeaksCount = networkAudit.remoteRequestsDetected.length;
    console.log(`  Remote Supabase calls detected: ${remoteLeaksCount}`);
    console.log(`  Total local requests handled: ${networkAudit.localRequests}`);

    const c2_7_pass = eventUnchanged && weeklyUnchanged && outcomesUnchanged && receiptsUnchanged && remoteLeaksCount === 0;

    results.c2_7_finalIntegrityAndNetwork = {
      status: c2_7_pass ? "PASS" : "FAIL",
      details: {
        eventUnchanged,
        weeklyUnchanged,
        outcomesUnchanged,
        receiptsUnchanged,
        remoteLeaksCount,
        totalLocalRequests: networkAudit.localRequests,
      },
    };
    console.log(`>>> C2.7 RESULT: [${results.c2_7_finalIntegrityAndNetwork.status}] <<<`);

  } catch (err) {
    console.error(`\n[FATAL ERROR in C2 Execution]: ${err.stack || err.message}`);
  } finally {
    fs.writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2), "utf8");
    console.log(`\nScenario C2 report written to ${REPORT_FILE}`);
  }
}

runScenarioC2().catch((e) => {
  console.error("Unhandled top-level error:", e);
  process.exit(1);
});
