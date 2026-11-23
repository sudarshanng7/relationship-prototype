import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ARTIFACT_DIR = path.resolve("test-results/phase3c");
const REPORT_FILE = path.join(ARTIFACT_DIR, "c4-session-and-receipts-report.json");
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
    displayName: "Partner C",
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

async function runScenarioC4() {
  console.log("=== PURPLE GARDEN: PHASE 3C / C4: AUTHENTICATION, SESSION & RECEIPT AUTHORIZATION ===");
  console.log(`Timestamp: ${new Date().toISOString()} | RUN_ID: ${RUN_ID}`);

  const networkAudit = {
    remoteRequestsDetected: [],
    localRequests: 0,
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    if (!urlStr.includes(LOCAL_SUPABASE_HOST) && !urlStr.includes("localhost") && !urlStr.includes("127.0.0.1")) {
      networkAudit.remoteRequestsDetected.push({
        url: urlStr,
        timestamp: new Date().toISOString(),
      });
      console.error(`[SECURITY ALERT] Remote network call intercepted: ${urlStr}`);
      throw new Error(`CRITICAL SECURITY VIOLATION: Remote call attempted to ${urlStr}`);
    }
    networkAudit.localRequests++;
    return originalFetch(url, options);
  };

  const report = {
    runId: RUN_ID,
    timestamp: new Date().toISOString(),
    historicalBaseline: {},
    c4_1_unauthenticatedReadAccess: {},
    c4_2_partnerSessionIsolation: {},
    c4_3_receiptReadAuthorization: {},
    c4_4_forgedReceiptCreation: {},
    c4_5_replayAndEligibility: {},
    c4_6_signOutAndExpiredSession: {},
    c4_7_finalSecurityRegression: {},
    networkAudit,
  };

  try {
    // ------------------------------------------------------------------------
    // Step 0: Record Baseline State
    // ------------------------------------------------------------------------
    console.log("\n--- Step 0: Pre-test Historical Baseline Verification ---");
    const baselineEventRaw = queryDb(`SELECT id, status, reconnected_at, created_at FROM relationship_events WHERE id = '${PRIMARY_COUPLE.targetEventId}';`);
    const baselineResponsesRaw = queryDb(`SELECT count(*) FROM relationship_event_repair_responses WHERE event_id = '${PRIMARY_COUPLE.targetEventId}';`);
    const baselineOutcomesRaw = queryDb(`SELECT count(*) FROM relationship_event_repair_outcomes WHERE event_id = '${PRIMARY_COUPLE.targetEventId}';`);
    const baselineWeeklyRaw = queryDb(`SELECT id, user_id, updated_at FROM weekly_reflections WHERE id = '${PRIMARY_COUPLE.targetWeeklyId}';`);
    const baselineReceiptsCount = queryDb(`SELECT count(*) FROM home_activity_receipts;`);
    const baselineReceiptsDump = queryDb(`SELECT id, user_id, activity_key FROM home_activity_receipts ORDER BY created_at;`);

    report.historicalBaseline = {
      event: baselineEventRaw,
      responsesCount: parseInt(baselineResponsesRaw, 10),
      outcomesCount: parseInt(baselineOutcomesRaw, 10),
      weekly: baselineWeeklyRaw,
      receiptsCount: parseInt(baselineReceiptsCount, 10),
      receiptsDump: baselineReceiptsDump,
    };
    console.log("Historical event baseline:", baselineEventRaw);
    console.log(`Historical receipts count: ${baselineReceiptsCount}`);
    console.log("Historical weekly baseline:", baselineWeeklyRaw);

    // Initialize clients
    const anonClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const clientA = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const clientB = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const clientC = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ------------------------------------------------------------------------
    // C4.1: Unauthenticated Read Access
    // ------------------------------------------------------------------------
    console.log("\n--- Scenario C4.1: Unauthenticated Read Access ---");

    const { data: anonPrivData, error: anonPrivErr } = await anonClient.from("event_private_reflections").select("*");
    const { data: anonWeeklyData, error: anonWeeklyErr } = await anonClient.from("weekly_reflections").select("*");
    const { data: anonRespData, error: anonRespErr } = await anonClient.from("relationship_event_repair_responses").select("*");
    const { data: anonOutData, error: anonOutErr } = await anonClient.from("relationship_event_repair_outcomes").select("*");
    const { data: anonReceiptsData, error: anonReceiptsErr } = await anonClient.from("home_activity_receipts").select("*");
    const { data: anonEventsData, error: anonEventsErr } = await anonClient.from("relationship_events").select("*");

    const { data: anonRpcData, error: anonRpcErr } = await anonClient.rpc("record_home_activity_receipt", {
      p_activity_key: "shared_positive:dummy:2026-01-01T00:00:00.000Z",
      p_activity_kind: "shared_positive",
      p_source_id: "00000000-0000-0000-0000-000000000000",
      p_attention_mode: "informational",
    });

    const anonRpcBlocked = !!anonRpcErr && (
      anonRpcErr.message.includes("permission denied for function") ||
      anonRpcErr.message.includes("Authentication required")
    );

    const anonReadsBlocked =
      (anonPrivData?.length === 0 || !!anonPrivErr) &&
      (anonWeeklyData?.length === 0 || !!anonWeeklyErr) &&
      (anonRespData?.length === 0 || !!anonRespErr) &&
      (anonOutData?.length === 0 || !!anonOutErr) &&
      (anonReceiptsData?.length === 0 || !!anonReceiptsErr) &&
      (anonEventsData?.length === 0 || !!anonEventsErr);

    const c4_1_pass = anonReadsBlocked && anonRpcBlocked;
    console.log(`Anon private reflections rows: ${anonPrivData?.length ?? 0}`);
    console.log(`Anon weekly reflections rows: ${anonWeeklyData?.length ?? 0}`);
    console.log(`Anon repair responses rows: ${anonRespData?.length ?? 0}`);
    console.log(`Anon repair outcomes rows: ${anonOutData?.length ?? 0}`);
    console.log(`Anon home activity receipts rows: ${anonReceiptsData?.length ?? 0} (Err: ${anonReceiptsErr?.message})`);
    console.log(`Anon relationship events rows: ${anonEventsData?.length ?? 0}`);
    console.log(`Anon RPC attempt blocked: ${anonRpcBlocked} (Err: ${anonRpcErr?.message})`);

    report.c4_1_unauthenticatedReadAccess = {
      status: c4_1_pass ? "PASS" : "FAIL",
      details: {
        anonPrivReflectionsRows: anonPrivData?.length ?? 0,
        anonWeeklyReflectionsRows: anonWeeklyData?.length ?? 0,
        anonRepairResponsesRows: anonRespData?.length ?? 0,
        anonRepairOutcomesRows: anonOutData?.length ?? 0,
        anonReceiptsRows: anonReceiptsData?.length ?? 0,
        anonReceiptsError: anonReceiptsErr?.message,
        anonEventsRows: anonEventsData?.length ?? 0,
        anonRpcBlocked,
        anonRpcError: anonRpcErr?.message,
      },
    };

    // ------------------------------------------------------------------------
    // C4.2: Partner Session Isolation
    // ------------------------------------------------------------------------
    console.log("\n--- Scenario C4.2: Partner Session Isolation ---");

    const { error: authErrA } = await clientA.auth.signInWithPassword({
      email: PRIMARY_COUPLE.partnerA.email,
      password: PRIMARY_COUPLE.partnerA.password,
    });
    if (authErrA) throw new Error(`Partner A auth failed: ${authErrA.message}`);

    const { error: authErrB } = await clientB.auth.signInWithPassword({
      email: PRIMARY_COUPLE.partnerB.email,
      password: PRIMARY_COUPLE.partnerB.password,
    });
    if (authErrB) throw new Error(`Partner B auth failed: ${authErrB.message}`);

    const { data: userAData } = await clientA.auth.getUser();
    const { data: userBData } = await clientB.auth.getUser();

    const partnerAIdMatches = userAData?.user?.id === PRIMARY_COUPLE.partnerA.id;
    const partnerBIdMatches = userBData?.user?.id === PRIMARY_COUPLE.partnerB.id;

    // Check visible receipts count under each session
    const { data: partnerAOwnReceipts } = await clientA.from("home_activity_receipts").select("id, user_id");
    const { data: partnerBOwnReceipts } = await clientB.from("home_activity_receipts").select("id, user_id");

    const partnerASeesOnlyOwn = (partnerAOwnReceipts || []).every((r) => r.user_id === PRIMARY_COUPLE.partnerA.id);
    const partnerBSeesOnlyOwn = (partnerBOwnReceipts || []).every((r) => r.user_id === PRIMARY_COUPLE.partnerB.id);

    // Attempt direct table mutation pretending to be the other partner
    const { error: directInsertOtherPartnerErr } = await clientA
      .from("home_activity_receipts")
      .insert({
        couple_id: PRIMARY_COUPLE.coupleId,
        user_id: PRIMARY_COUPLE.partnerB.id,
        activity_key: "spoofed_key",
        activity_kind: "shared_positive",
        source_id: PRIMARY_COUPLE.targetEventId,
        attention_mode: "informational",
      });

    const directInsertDenied = !!directInsertOtherPartnerErr && directInsertOtherPartnerErr.code === "42501";

    const c4_2_pass =
      partnerAIdMatches &&
      partnerBIdMatches &&
      partnerASeesOnlyOwn &&
      partnerBSeesOnlyOwn &&
      directInsertDenied &&
      partnerAOwnReceipts?.length === 1 &&
      partnerBOwnReceipts?.length === 7;

    console.log(`Partner A session auth.uid match: ${partnerAIdMatches} (Visible receipts: ${partnerAOwnReceipts?.length})`);
    console.log(`Partner B session auth.uid match: ${partnerBIdMatches} (Visible receipts: ${partnerBOwnReceipts?.length})`);
    console.log(`Direct spoof insert denied: ${directInsertDenied} (${directInsertOtherPartnerErr?.message})`);

    report.c4_2_partnerSessionIsolation = {
      status: c4_2_pass ? "PASS" : "FAIL",
      details: {
        partnerAIdMatches,
        partnerBIdMatches,
        partnerAReceiptsCount: partnerAOwnReceipts?.length,
        partnerASeesOnlyOwn,
        partnerBReceiptsCount: partnerBOwnReceipts?.length,
        partnerBSeesOnlyOwn,
        directInsertDenied,
        directInsertErrorCode: directInsertOtherPartnerErr?.code,
        directInsertErrorMessage: directInsertOtherPartnerErr?.message,
      },
    };

    // ------------------------------------------------------------------------
    // C4.3: Receipt Read Authorization
    // ------------------------------------------------------------------------
    console.log("\n--- Scenario C4.3: Receipt Read Authorization ---");

    // Partner A attempts to read Partner B's receipts
    const { data: partnerAReadingPartnerB } = await clientA
      .from("home_activity_receipts")
      .select("id, user_id, activity_key")
      .eq("user_id", PRIMARY_COUPLE.partnerB.id);

    // Partner B attempts to read Partner A's receipts
    const { data: partnerBReadingPartnerA } = await clientB
      .from("home_activity_receipts")
      .select("id, user_id, activity_key")
      .eq("user_id", PRIMARY_COUPLE.partnerA.id);

    // Partner C (Couple 2) attempts to read Couple 1 receipts
    const { error: authErrC } = await clientC.auth.signInWithPassword({
      email: SECOND_COUPLE.userX.email,
      password: SECOND_COUPLE.userX.password,
    });
    if (authErrC) throw new Error(`Partner C auth failed: ${authErrC.message}`);

    const { data: partnerCAllReceipts } = await clientC.from("home_activity_receipts").select("id, couple_id");
    const { data: partnerCPrimaryReceipts } = await clientC
      .from("home_activity_receipts")
      .select("id")
      .eq("couple_id", PRIMARY_COUPLE.coupleId);

    const partnerACannotReadB = (partnerAReadingPartnerB?.length ?? 0) === 0;
    const partnerBCannotReadA = (partnerBReadingPartnerA?.length ?? 0) === 0;
    const partnerCCannotReadPrimary =
      (partnerCAllReceipts?.length ?? 0) === 0 &&
      (partnerCPrimaryReceipts?.length ?? 0) === 0;

    const c4_3_pass = partnerACannotReadB && partnerBCannotReadA && partnerCCannotReadPrimary;
    console.log(`Partner A reading Partner B receipts rows: ${partnerAReadingPartnerB?.length ?? 0}`);
    console.log(`Partner B reading Partner A receipts rows: ${partnerBReadingPartnerA?.length ?? 0}`);
    console.log(`Partner C reading Couple 1 receipts rows: ${partnerCPrimaryReceipts?.length ?? 0}`);

    report.c4_3_receiptReadAuthorization = {
      status: c4_3_pass ? "PASS" : "FAIL",
      details: {
        partnerAReadingPartnerBCount: partnerAReadingPartnerB?.length ?? 0,
        partnerBReadingPartnerACount: partnerBReadingPartnerA?.length ?? 0,
        partnerCAllReceiptsCount: partnerCAllReceipts?.length ?? 0,
        partnerCPrimaryCoupleReceiptsCount: partnerCPrimaryReceipts?.length ?? 0,
      },
    };

    // ------------------------------------------------------------------------
    // C4.4: Forged Receipt Creation
    // ------------------------------------------------------------------------
    console.log("\n--- Scenario C4.4: Forged Receipt Creation ---");

    // 1. Foreign event forgery: Partner A calls RPC with Partner C's event ID
    console.log("Check 1: Partner A calls record_home_activity_receipt with foreign couple event ID...");
    const { error: foreignEventRpcErr } = await clientA.rpc("record_home_activity_receipt", {
      p_activity_key: `shared_positive:${SECOND_COUPLE.existingEventId}:2026-01-01T00:00:00.000Z`,
      p_activity_kind: "shared_positive",
      p_source_id: SECOND_COUPLE.existingEventId,
      p_attention_mode: "informational",
    });
    const foreignEventBlocked = !!foreignEventRpcErr && foreignEventRpcErr.message.includes("Activity unavailable");

    // 2. Timestamp forgery: Partner A calls RPC with arbitrary future timestamp
    console.log("Check 2: Partner A calls record_home_activity_receipt with forged timestamp...");
    const { error: forgedTimestampErr } = await clientA.rpc("record_home_activity_receipt", {
      p_activity_key: `reconnection_completed:${PRIMARY_COUPLE.targetEventId}:1999-01-01T00:00:00.000Z`,
      p_activity_kind: "reconnection_completed",
      p_source_id: PRIMARY_COUPLE.targetEventId,
      p_attention_mode: "informational",
    });
    const forgedTimestampBlocked = !!forgedTimestampErr && forgedTimestampErr.message.includes("Activity unavailable");

    // 3. Mismatched attention mode: Partner A calls with kind='reconnection_completed', attention_mode='actionable'
    console.log("Check 3: Partner A calls record_home_activity_receipt with mismatched attention mode...");
    const { error: mismatchedModeErr } = await clientA.rpc("record_home_activity_receipt", {
      p_activity_key: `reconnection_completed:${PRIMARY_COUPLE.targetEventId}:2026-11-23T21:04:45.427Z`,
      p_activity_kind: "reconnection_completed",
      p_source_id: PRIMARY_COUPLE.targetEventId,
      p_attention_mode: "actionable",
    });
    const mismatchedModeBlocked = !!mismatchedModeErr && mismatchedModeErr.message.includes("Activity unavailable");

    // 4. Invalid kind: Partner A calls with arbitrary invalid kind
    console.log("Check 4: Partner A calls record_home_activity_receipt with invalid kind...");
    const { error: invalidKindErr } = await clientA.rpc("record_home_activity_receipt", {
      p_activity_key: `invalid_kind:${PRIMARY_COUPLE.targetEventId}:2026-11-23T21:04:45.427Z`,
      p_activity_kind: "invalid_kind",
      p_source_id: PRIMARY_COUPLE.targetEventId,
      p_attention_mode: "informational",
    });
    const invalidKindBlocked = !!invalidKindErr && invalidKindErr.message.includes("Activity unavailable");

    // Verify DB count has not changed from 8
    const dbReceiptsAfterC44 = queryDb(`SELECT count(*) FROM home_activity_receipts;`);
    const countUnchanged = parseInt(dbReceiptsAfterC44, 10) === 8;

    const c4_4_pass =
      foreignEventBlocked &&
      forgedTimestampBlocked &&
      mismatchedModeBlocked &&
      invalidKindBlocked &&
      countUnchanged;

    console.log(`Foreign event RPC blocked: ${foreignEventBlocked} (${foreignEventRpcErr?.message})`);
    console.log(`Forged timestamp RPC blocked: ${forgedTimestampBlocked} (${forgedTimestampErr?.message})`);
    console.log(`Mismatched mode RPC blocked: ${mismatchedModeBlocked} (${mismatchedModeErr?.message})`);
    console.log(`Invalid kind RPC blocked: ${invalidKindBlocked} (${invalidKindErr?.message})`);
    console.log(`Receipts count unchanged: ${countUnchanged} (${dbReceiptsAfterC44})`);

    report.c4_4_forgedReceiptCreation = {
      status: c4_4_pass ? "PASS" : "FAIL",
      details: {
        foreignEventBlocked,
        foreignEventError: foreignEventRpcErr?.message,
        forgedTimestampBlocked,
        forgedTimestampError: forgedTimestampErr?.message,
        mismatchedModeBlocked,
        mismatchedModeError: mismatchedModeErr?.message,
        invalidKindBlocked,
        invalidKindError: invalidKindErr?.message,
        receiptsCountUnchanged: countUnchanged,
      },
    };

    // ------------------------------------------------------------------------
    // C4.5: Replay & Eligibility
    // ------------------------------------------------------------------------
    console.log("\n--- Scenario C4.5: Replay & Eligibility ---");

    // Create disposable friction event as Partner A
    const { data: dispFriction, error: createDispErr } = await clientA
      .from("relationship_events")
      .insert({
        couple_id: PRIMARY_COUPLE.coupleId,
        creator_id: PRIMARY_COUPLE.partnerA.id,
        event_type: "friction",
        category: "communication",
        intensity: 2,
        visibility: "ours",
        status: "open",
        repair_method: "talking",
        shared_topic: `QA C4 Disposable Friction [${RUN_ID}]`,
      })
      .select()
      .single();

    if (createDispErr || !dispFriction) {
      throw new Error(`Failed to create disposable friction event: ${createDispErr?.message}`);
    }
    console.log(`Created disposable friction event: ${dispFriction.id} (status: ${dispFriction.status})`);

    const dispCreatedIso = new Date(dispFriction.created_at).toISOString();
    const dispActivityKey = `shared_friction:${dispFriction.id}:${dispCreatedIso}`;

    // 1. Valid eligible receipt creation: Partner B records shared_friction receipt
    console.log("Check 1: Partner B records valid shared_friction receipt via RPC...");
    const { error: validReceiptErr } = await clientB.rpc("record_home_activity_receipt", {
      p_activity_key: dispActivityKey,
      p_activity_kind: "shared_friction",
      p_source_id: dispFriction.id,
      p_attention_mode: "actionable",
    });
    const validReceiptSuccess = !validReceiptErr;
    console.log(`Valid receipt recording: ${validReceiptSuccess ? "PASS" : "FAIL"} (Err: ${validReceiptErr?.message})`);

    const receiptsAfterValid = queryDb(`SELECT count(*) FROM home_activity_receipts;`);
    const partnerBReceiptCreated = parseInt(receiptsAfterValid, 10) === 9;

    // 2. Idempotent duplicate submission (replay test)
    console.log("Check 2: Partner B records same shared_friction receipt again (idempotency check)...");
    const { error: dupReceiptErr } = await clientB.rpc("record_home_activity_receipt", {
      p_activity_key: dispActivityKey,
      p_activity_kind: "shared_friction",
      p_source_id: dispFriction.id,
      p_attention_mode: "actionable",
    });
    const dupReceiptSuccess = !dupReceiptErr;
    const receiptsAfterDup = queryDb(`SELECT count(*) FROM home_activity_receipts;`);
    const receiptsCountRemains9 = parseInt(receiptsAfterDup, 10) === 9;
    console.log(`Idempotent re-record: ${dupReceiptSuccess && receiptsCountRemains9 ? "PASS" : "FAIL"}`);

    // 3. User-scoped uniqueness: Partner A has not seen/suppressed this event
    const { data: partnerASeeReceipt } = await clientA
      .from("home_activity_receipts")
      .select("id")
      .eq("source_id", dispFriction.id);
    const noCrossUserSuppression = (partnerASeeReceipt?.length ?? 0) === 0;
    console.log(`No cross-user suppression: Partner A receipt rows = ${partnerASeeReceipt?.length ?? 0}`);

    // 4. Source event lifecycle transition: complete repair reconnection
    console.log("Advancing disposable event to reconnected...");
    // Partner B arrival
    await clientB.rpc("submit_repair_response", {
      p_event_id: dispFriction.id,
      p_phase: "arrival",
      p_response_code: "heard",
    });
    // Partner A settlement
    await clientA.rpc("submit_repair_response", {
      p_event_id: dispFriction.id,
      p_phase: "settlement",
      p_response_code: "ready",
    });
    // Partner B settlement
    await clientB.rpc("submit_repair_response", {
      p_event_id: dispFriction.id,
      p_phase: "settlement",
      p_response_code: "ready",
    });
    // Partner A completes reconnection
    await clientA.rpc("complete_repair_reconnection", {
      p_event_id: dispFriction.id,
      p_takeaway_tag: "talking_it_through",
      p_takeaway_note: "QA C4 Reconnection",
    });

    const statusAfterReconnection = queryDb(`SELECT status FROM relationship_events WHERE id = '${dispFriction.id}';`);
    console.log(`Disposable event transitioned to: ${statusAfterReconnection}`);

    // 5. Ineligible receipt creation: Partner B attempts shared_friction receipt on reconnected event
    console.log("Check 5: Partner B attempts recording shared_friction receipt for already reconnected event...");
    // Even with a freshly constructed key matching event created_at, the source is reconnected
    const { error: ineligibleReceiptErr } = await clientB.rpc("record_home_activity_receipt", {
      p_activity_key: `shared_friction:${dispFriction.id}:${dispCreatedIso}`,
      p_activity_kind: "shared_friction",
      p_source_id: dispFriction.id,
      p_attention_mode: "actionable",
    });
    const ineligibleReceiptBlocked = !!ineligibleReceiptErr && ineligibleReceiptErr.message.includes("Activity unavailable");
    console.log(`Ineligible shared_friction receipt blocked: ${ineligibleReceiptBlocked} (${ineligibleReceiptErr?.message})`);

    // Clean up disposable event and receipt
    console.log("Cleaning up disposable event and receipt...");
    queryDb(`DELETE FROM home_activity_receipts WHERE source_id = '${dispFriction.id}';`);
    await clientA.from("relationship_events").delete().eq("id", dispFriction.id);

    const receiptsAfterCleanup = queryDb(`SELECT count(*) FROM home_activity_receipts;`);
    const cleanupClean = parseInt(receiptsAfterCleanup, 10) === 8;

    const c4_5_pass =
      validReceiptSuccess &&
      partnerBReceiptCreated &&
      dupReceiptSuccess &&
      receiptsCountRemains9 &&
      noCrossUserSuppression &&
      statusAfterReconnection === "reconnected" &&
      ineligibleReceiptBlocked &&
      cleanupClean;

    report.c4_5_replayAndEligibility = {
      status: c4_5_pass ? "PASS" : "FAIL",
      details: {
        validReceiptSuccess,
        partnerBReceiptCreated,
        dupReceiptSuccess,
        receiptsCountRemains9,
        noCrossUserSuppression,
        statusAfterReconnection,
        ineligibleReceiptBlocked,
        ineligibleReceiptError: ineligibleReceiptErr?.message,
        cleanupClean,
        receiptsCountAfterCleanup: parseInt(receiptsAfterCleanup, 10),
      },
    };

    // ------------------------------------------------------------------------
    // C4.6: Sign-Out & Expired Session
    // ------------------------------------------------------------------------
    console.log("\n--- Scenario C4.6: Sign-Out & Expired Session ---");

    // 1. Dedicated test client for sign-out verification
    const testSignOutClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await testSignOutClient.auth.signInWithPassword({
      email: PRIMARY_COUPLE.partnerA.email,
      password: PRIMARY_COUPLE.partnerA.password,
    });

    const { data: preSignOutData } = await testSignOutClient.from("couple_members").select("couple_id, user_id");
    const preSignOutSuccess = (preSignOutData?.length ?? 0) > 0;

    await testSignOutClient.auth.signOut();

    // After sign-out, protected query must be denied / return 0 rows
    const { data: postSignOutData, error: postSignOutErr } = await testSignOutClient.from("couple_members").select("couple_id, user_id");
    const postSignOutBlocked = (postSignOutData?.length ?? 0) === 0 || !!postSignOutErr;

    // After sign-out, RPC call must fail
    const { error: postSignOutRpcErr } = await testSignOutClient.rpc("record_home_activity_receipt", {
      p_activity_key: "dummy",
      p_activity_kind: "dummy",
      p_source_id: PRIMARY_COUPLE.targetEventId,
      p_attention_mode: "informational",
    });
    const postSignOutRpcBlocked = !!postSignOutRpcErr && (
      postSignOutRpcErr.message.includes("permission denied for function") ||
      postSignOutRpcErr.message.includes("Authentication required")
    );

    // 2. Invalid / Malformed token client
    const invalidTokenClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: {
          Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.INVALID_PAYLOAD.SIGNATURE",
        },
      },
    });

    const { data: invalidTokenData, error: invalidTokenErr } = await invalidTokenClient
      .from("couple_members")
      .select("id");

    const invalidTokenBlocked = !!invalidTokenErr && (
      invalidTokenErr.message.includes("jwt") ||
      invalidTokenErr.message.includes("token") ||
      invalidTokenErr.message.includes("401") ||
      invalidTokenErr.code === "PGRST301" ||
      invalidTokenErr.code === "401"
    );

    const c4_6_pass = preSignOutSuccess && postSignOutBlocked && postSignOutRpcBlocked && invalidTokenBlocked;

    console.log(`Pre sign-out access: ${preSignOutSuccess}`);
    console.log(`Post sign-out protected query blocked: ${postSignOutBlocked} (Rows: ${postSignOutData?.length ?? 0})`);
    console.log(`Post sign-out RPC blocked: ${postSignOutRpcBlocked} (${postSignOutRpcErr?.message})`);
    console.log(`Invalid token blocked: ${invalidTokenBlocked} (${invalidTokenErr?.message}, code: ${invalidTokenErr?.code})`);

    report.c4_6_signOutAndExpiredSession = {
      status: c4_6_pass ? "PASS" : "FAIL",
      details: {
        preSignOutSuccess,
        postSignOutBlocked,
        postSignOutRows: postSignOutData?.length ?? 0,
        postSignOutRpcBlocked,
        postSignOutRpcError: postSignOutRpcErr?.message,
        invalidTokenBlocked,
        invalidTokenError: invalidTokenErr?.message,
        invalidTokenCode: invalidTokenErr?.code,
      },
    };

    // ------------------------------------------------------------------------
    // C4.7: Final Security Regression & Integrity
    // ------------------------------------------------------------------------
    console.log("\n--- Scenario C4.7: Final Security Regression & Integrity ---");

    const currentEventRaw = queryDb(`SELECT id, status, reconnected_at, created_at FROM relationship_events WHERE id = '${PRIMARY_COUPLE.targetEventId}';`);
    const currentResponsesRaw = queryDb(`SELECT count(*) FROM relationship_event_repair_responses WHERE event_id = '${PRIMARY_COUPLE.targetEventId}';`);
    const currentOutcomesRaw = queryDb(`SELECT count(*) FROM relationship_event_repair_outcomes WHERE event_id = '${PRIMARY_COUPLE.targetEventId}';`);
    const currentWeeklyRaw = queryDb(`SELECT id, user_id, updated_at FROM weekly_reflections WHERE id = '${PRIMARY_COUPLE.targetWeeklyId}';`);
    const currentReceiptsCount = queryDb(`SELECT count(*) FROM home_activity_receipts;`);
    const currentReceiptsDump = queryDb(`SELECT id, user_id, activity_key FROM home_activity_receipts ORDER BY created_at;`);
    const leftoverDisposable = queryDb(`SELECT count(*) FROM relationship_events WHERE shared_topic LIKE 'QA C4 Disposable%';`);

    const eventUnchanged = currentEventRaw === report.historicalBaseline.event;
    const responsesUnchanged = parseInt(currentResponsesRaw, 10) === report.historicalBaseline.responsesCount;
    const outcomesUnchanged = parseInt(currentOutcomesRaw, 10) === report.historicalBaseline.outcomesCount;
    const weeklyUnchanged = currentWeeklyRaw === report.historicalBaseline.weekly;
    const receiptsCountUnchanged = parseInt(currentReceiptsCount, 10) === report.historicalBaseline.receiptsCount;
    const receiptsDumpUnchanged = currentReceiptsDump === report.historicalBaseline.receiptsDump;
    const fixturesClean = parseInt(leftoverDisposable, 10) === 0;
    const zeroRemoteCalls = networkAudit.remoteRequestsDetected.length === 0;

    const c4_7_pass =
      eventUnchanged &&
      responsesUnchanged &&
      outcomesUnchanged &&
      weeklyUnchanged &&
      receiptsCountUnchanged &&
      receiptsDumpUnchanged &&
      fixturesClean &&
      zeroRemoteCalls;

    report.c4_7_finalSecurityRegression = {
      status: c4_7_pass ? "PASS" : "FAIL",
      details: {
        historicalEventUnchanged: eventUnchanged,
        historicalResponsesCountUnchanged: responsesUnchanged,
        historicalOutcomesCountUnchanged: outcomesUnchanged,
        historicalWeeklyUnchanged: weeklyUnchanged,
        receiptsCountUnchanged,
        receiptsDumpUnchanged,
        disposableFixturesClean: fixturesClean,
        zeroRemoteCalls,
        totalLocalRequests: networkAudit.localRequests,
      },
    };

    console.log("\n=======================================================");
    console.log(`C4.1 Unauthenticated Read Access:   ${report.c4_1_unauthenticatedReadAccess.status}`);
    console.log(`C4.2 Partner Session Isolation:     ${report.c4_2_partnerSessionIsolation.status}`);
    console.log(`C4.3 Receipt Read Authorization:    ${report.c4_3_receiptReadAuthorization.status}`);
    console.log(`C4.4 Forged Receipt Creation:       ${report.c4_4_forgedReceiptCreation.status}`);
    console.log(`C4.5 Replay & Eligibility:          ${report.c4_5_replayAndEligibility.status}`);
    console.log(`C4.6 Sign-Out & Expired Session:    ${report.c4_6_signOutAndExpiredSession.status}`);
    console.log(`C4.7 Final Regression & Integrity:  ${report.c4_7_finalSecurityRegression.status}`);
    console.log("=======================================================\n");

  } catch (err) {
    console.error("FATAL ERROR during Scenario C4:", err);
    report.fatalError = {
      message: err.message,
      stack: err.stack,
    };
  } finally {
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), "utf8");
    console.log(`Report written to ${REPORT_FILE}`);
  }
}

runScenarioC4();
