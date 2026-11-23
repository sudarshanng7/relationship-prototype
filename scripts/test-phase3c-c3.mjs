import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ARTIFACT_DIR = path.resolve("test-results/phase3c");
const REPORT_FILE = path.join(ARTIFACT_DIR, "c3-repair-workflow-report.json");
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

async function runScenarioC3() {
  console.log("=== PURPLE GARDEN: PHASE 3C / C3: REPAIR WORKFLOW AUTHORIZATION TEST ===");
  console.log(`Timestamp: ${new Date().toISOString()} | RUN_ID: ${RUN_ID}`);

  const networkAudit = {
    remoteRequestsDetected: [],
    localRequests: 0,
  };

  // Intercept global fetch to monitor network requests
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
    c3_1_arrivalResponseAuthorization: {},
    c3_2_settlementResponseOwnership: {},
    c3_3_mixedReadinessEnforcement: {},
    c3_4_creatorOnlyCompletion: {},
    c3_5_foreignAndUnauthenticatedRequests: {},
    c3_6_replayAndInvalidTransitions: {},
    c3_7_finalAuthorizedControlAndIntegrity: {},
    networkAudit,
  };

  try {
    // ------------------------------------------------------------------------
    // Step 0: Record Historical Baseline
    // ------------------------------------------------------------------------
    console.log("\n--- Step 0: Pre-test Historical Baseline Verification ---");
    const baselineEventRaw = queryDb(`SELECT id, status, reconnected_at, created_at FROM relationship_events WHERE id = '${PRIMARY_COUPLE.targetEventId}';`);
    const baselineResponsesRaw = queryDb(`SELECT count(*) FROM relationship_event_repair_responses WHERE event_id = '${PRIMARY_COUPLE.targetEventId}';`);
    const baselineOutcomesRaw = queryDb(`SELECT count(*) FROM relationship_event_repair_outcomes WHERE event_id = '${PRIMARY_COUPLE.targetEventId}';`);
    const baselineWeeklyRaw = queryDb(`SELECT id, user_id, updated_at FROM weekly_reflections WHERE id = '${PRIMARY_COUPLE.targetWeeklyId}';`);

    report.historicalBaseline = {
      event: baselineEventRaw,
      responsesCount: parseInt(baselineResponsesRaw, 10),
      outcomesCount: parseInt(baselineOutcomesRaw, 10),
      weekly: baselineWeeklyRaw,
    };
    console.log("Historical event baseline:", baselineEventRaw);
    console.log(`Historical responses count: ${baselineResponsesRaw}, outcomes count: ${baselineOutcomesRaw}`);
    console.log("Historical weekly baseline:", baselineWeeklyRaw);

    // Initialize authenticated Supabase clients
    console.log("\n--- Initializing User-Level Authenticated Clients ---");
    const clientA = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const clientB = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const clientC = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const anonClient = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

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

    const { error: authErrC } = await clientC.auth.signInWithPassword({
      email: SECOND_COUPLE.userX.email,
      password: SECOND_COUPLE.userX.password,
    });
    if (authErrC) throw new Error(`Partner C auth failed: ${authErrC.message}`);

    console.log("Partner A, Partner B, and Partner C successfully authenticated.");

    // Track disposable events for cleanup
    const disposableEventIds = [];

    // Helper to create disposable event as Partner A
    async function createDisposableEvent(topicSuffix) {
      const { data: newEvt, error: createErr } = await clientA
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
          shared_topic: `QA C3 Disposable Friction ${topicSuffix} [${RUN_ID}]`,
        })
        .select()
        .single();

      if (createErr || !newEvt) {
        throw new Error(`Failed to create disposable event: ${createErr?.message}`);
      }
      disposableEventIds.push(newEvt.id);
      return newEvt;
    }

    // ------------------------------------------------------------------------
    // C3.1: Arrival Response Authorization
    // ------------------------------------------------------------------------
    console.log("\n--- Scenario C3.1: Arrival Response Authorization ---");
    const dispEvent1 = await createDisposableEvent("Main Workflow");
    console.log(`Created disposable event 1: ${dispEvent1.id} (status: ${dispEvent1.status})`);

    // 1. Creator (Partner A) attempts arrival response -> MUST FAIL
    console.log("Check 1: Partner A (creator) attempts arrival response via RPC...");
    const { data: creatorArrivalData, error: creatorArrivalErr } = await clientA.rpc(
      "submit_repair_response",
      {
        p_event_id: dispEvent1.id,
        p_phase: "arrival",
        p_response_code: "heard",
      }
    );
    const creatorArrivalDenied = !!creatorArrivalErr && creatorArrivalErr.message.includes("Only the recipient may submit an arrival response");
    console.log(`Creator arrival attempt: ${creatorArrivalDenied ? "PASS (Denied)" : "FAIL"} - Message: ${creatorArrivalErr?.message}`);

    // Verify zero database side effects from denied attempt
    const responsesAfterCheck1 = queryDb(`SELECT count(*) FROM relationship_event_repair_responses WHERE event_id = '${dispEvent1.id}';`);
    const statusAfterCheck1 = queryDb(`SELECT status FROM relationship_events WHERE id = '${dispEvent1.id}';`);

    // 2. Foreign nonmember (Partner C) attempts arrival response -> MUST FAIL
    console.log("Check 2: Partner C (nonmember) attempts arrival response via RPC...");
    const { data: foreignArrivalData, error: foreignArrivalErr } = await clientC.rpc(
      "submit_repair_response",
      {
        p_event_id: dispEvent1.id,
        p_phase: "arrival",
        p_response_code: "heard",
      }
    );
    const foreignArrivalDenied = !!foreignArrivalErr && foreignArrivalErr.message.includes("Relationship membership required");
    console.log(`Foreign arrival attempt: ${foreignArrivalDenied ? "PASS (Denied)" : "FAIL"} - Message: ${foreignArrivalErr?.message}`);

    const responsesAfterCheck2 = queryDb(`SELECT count(*) FROM relationship_event_repair_responses WHERE event_id = '${dispEvent1.id}';`);

    // 3. Positive control: Recipient (Partner B) submits arrival response -> MUST SUCCEED
    console.log("Check 3 (Positive Control): Partner B (recipient) submits arrival response via RPC...");
    const { data: recipientArrivalData, error: recipientArrivalErr } = await clientB.rpc(
      "submit_repair_response",
      {
        p_event_id: dispEvent1.id,
        p_phase: "arrival",
        p_response_code: "heard",
      }
    );
    const recipientArrivalSuccess = !recipientArrivalErr && !!recipientArrivalData;
    console.log(`Recipient arrival attempt: ${recipientArrivalSuccess ? "PASS (Succeeded)" : "FAIL"} - Response ID: ${recipientArrivalData}`);

    const responsesAfterCheck3 = queryDb(`SELECT count(*) FROM relationship_event_repair_responses WHERE event_id = '${dispEvent1.id}';`);
    const statusAfterCheck3 = queryDb(`SELECT status FROM relationship_events WHERE id = '${dispEvent1.id}';`);

    const c3_1_pass =
      creatorArrivalDenied &&
      foreignArrivalDenied &&
      recipientArrivalSuccess &&
      parseInt(responsesAfterCheck1, 10) === 0 &&
      statusAfterCheck1 === "open" &&
      parseInt(responsesAfterCheck2, 10) === 0 &&
      parseInt(responsesAfterCheck3, 10) === 1 &&
      statusAfterCheck3 === "partially_repaired";

    report.c3_1_arrivalResponseAuthorization = {
      status: c3_1_pass ? "PASS" : "FAIL",
      details: {
        eventId: dispEvent1.id,
        creatorArrivalDenied,
        creatorArrivalError: creatorArrivalErr?.message,
        foreignArrivalDenied,
        foreignArrivalError: foreignArrivalErr?.message,
        recipientArrivalSuccess,
        recipientResponseId: recipientArrivalData,
        responsesCountAfterCreatorDenied: parseInt(responsesAfterCheck1, 10),
        statusAfterCreatorDenied: statusAfterCheck1,
        responsesCountAfterForeignDenied: parseInt(responsesAfterCheck2, 10),
        responsesCountAfterRecipientSuccess: parseInt(responsesAfterCheck3, 10),
        statusAfterRecipientSuccess: statusAfterCheck3,
      },
    };

    // ------------------------------------------------------------------------
    // C3.2: Settlement Response Ownership & Direct Table Mutation Denial
    // ------------------------------------------------------------------------
    console.log("\n--- Scenario C3.2: Settlement Response Ownership & Direct Mutation Denial ---");

    // Check direct table mutations (direct INSERT / UPDATE / DELETE must be denied)
    console.log("Check 1: Attempt direct table INSERT into relationship_event_repair_responses as Partner B with spoofed user_id = Partner A...");
    const { data: spoofInsertData, error: spoofInsertErr } = await clientB
      .from("relationship_event_repair_responses")
      .insert({
        event_id: dispEvent1.id,
        couple_id: PRIMARY_COUPLE.coupleId,
        user_id: PRIMARY_COUPLE.partnerA.id,
        phase: "settlement",
        response_code: "ready",
      });
    const directInsertDenied = !!spoofInsertErr;
    console.log(`Direct spoof insert: ${directInsertDenied ? "PASS (Denied)" : "FAIL"} - Code: ${spoofInsertErr?.code}, Message: ${spoofInsertErr?.message}`);

    console.log("Check 2: Attempt direct table UPDATE on relationship_event_repair_responses as Partner B...");
    const { data: directUpdateData, error: directUpdateErr } = await clientB
      .from("relationship_event_repair_responses")
      .update({ response_code: "need_time" })
      .eq("event_id", dispEvent1.id);
    const directUpdateDenied = !!directUpdateErr;
    console.log(`Direct update attempt: ${directUpdateDenied ? "PASS (Denied)" : "FAIL"} - Code: ${directUpdateErr?.code}, Message: ${directUpdateErr?.message}`);

    console.log("Check 3: Attempt direct table INSERT into relationship_event_repair_outcomes as Partner A...");
    const { data: directOutcomeData, error: directOutcomeErr } = await clientA
      .from("relationship_event_repair_outcomes")
      .insert({
        event_id: dispEvent1.id,
        couple_id: PRIMARY_COUPLE.coupleId,
        completed_by: PRIMARY_COUPLE.partnerA.id,
        takeaway_tag: "talking_it_through",
        takeaway_note: "Direct insert bypass attempt",
      });
    const directOutcomeDenied = !!directOutcomeErr;
    console.log(`Direct outcome insert: ${directOutcomeDenied ? "PASS (Denied)" : "FAIL"} - Code: ${directOutcomeErr?.code}, Message: ${directOutcomeErr?.message}`);

    // Legitimate settlement submissions via RPC
    console.log("Check 4: Partner A submits own settlement response ('reconnecting') via RPC...");
    const { data: partnerASettlementData, error: partnerASettlementErr } = await clientA.rpc(
      "submit_repair_response",
      {
        p_event_id: dispEvent1.id,
        p_phase: "settlement",
        p_response_code: "reconnecting",
      }
    );
    const partnerASettlementSuccess = !partnerASettlementErr && !!partnerASettlementData;
    console.log(`Partner A settlement: ${partnerASettlementSuccess ? "PASS (Succeeded)" : "FAIL"} - Response ID: ${partnerASettlementData}`);

    console.log("Check 5: Partner B submits own settlement response ('ready') via RPC...");
    const { data: partnerBSettlementData, error: partnerBSettlementErr } = await clientB.rpc(
      "submit_repair_response",
      {
        p_event_id: dispEvent1.id,
        p_phase: "settlement",
        p_response_code: "ready",
      }
    );
    const partnerBSettlementSuccess = !partnerBSettlementErr && !!partnerBSettlementData;
    console.log(`Partner B settlement: ${partnerBSettlementSuccess ? "PASS (Succeeded)" : "FAIL"} - Response ID: ${partnerBSettlementData}`);

    // Shared read access verification: both partners can view couple responses
    const { data: partnerAReadResponses, error: partnerAReadErr } = await clientA
      .from("relationship_event_repair_responses")
      .select("id, user_id, phase, response_code")
      .eq("event_id", dispEvent1.id);

    const { data: partnerBReadResponses, error: partnerBReadErr } = await clientB
      .from("relationship_event_repair_responses")
      .select("id, user_id, phase, response_code")
      .eq("event_id", dispEvent1.id);

    const readSucceeded =
      !partnerAReadErr &&
      !partnerBReadErr &&
      partnerAReadResponses?.length === 3 &&
      partnerBReadResponses?.length === 3;

    const c3_2_pass =
      directInsertDenied &&
      directUpdateDenied &&
      directOutcomeDenied &&
      partnerASettlementSuccess &&
      partnerBSettlementSuccess &&
      readSucceeded;

    report.c3_2_settlementResponseOwnership = {
      status: c3_2_pass ? "PASS" : "FAIL",
      details: {
        directInsertDenied,
        directInsertError: spoofInsertErr?.message,
        directInsertCode: spoofInsertErr?.code,
        directUpdateDenied,
        directUpdateError: directUpdateErr?.message,
        directOutcomeDenied,
        directOutcomeError: directOutcomeErr?.message,
        partnerASettlementSuccess,
        partnerBSettlementSuccess,
        partnerAReadCount: partnerAReadResponses?.length,
        partnerBReadCount: partnerBReadResponses?.length,
      },
    };

    // ------------------------------------------------------------------------
    // C3.3: Mixed Readiness Enforcement
    // ------------------------------------------------------------------------
    console.log("\n--- Scenario C3.3: Mixed Readiness Enforcement ---");
    // Partner A = reconnecting, Partner B = ready
    console.log("Check 1: Partner A (creator) attempts complete_repair_reconnection with mixed readiness (A=reconnecting, B=ready)...");
    const { data: mixedCompData, error: mixedCompErr } = await clientA.rpc(
      "complete_repair_reconnection",
      {
        p_event_id: dispEvent1.id,
        p_takeaway_tag: "talking_it_through",
        p_takeaway_note: "Premature completion attempt",
      }
    );
    const mixedCompDenied = !!mixedCompErr && mixedCompErr.message.includes("Both partners must be ready before completing reconnection");
    console.log(`Mixed readiness completion attempt: ${mixedCompDenied ? "PASS (Denied)" : "FAIL"} - Message: ${mixedCompErr?.message}`);

    // Verify DB state remains unchanged
    const statusAfterMixed = queryDb(`SELECT status FROM relationship_events WHERE id = '${dispEvent1.id}';`);
    const reconnectedAtAfterMixed = queryDb(`SELECT COALESCE(reconnected_at::text, 'NULL') FROM relationship_events WHERE id = '${dispEvent1.id}';`);
    const outcomesAfterMixed = queryDb(`SELECT count(*) FROM relationship_event_repair_outcomes WHERE event_id = '${dispEvent1.id}';`);

    const c3_3_pass =
      mixedCompDenied &&
      statusAfterMixed === "partially_repaired" &&
      reconnectedAtAfterMixed === "NULL" &&
      parseInt(outcomesAfterMixed, 10) === 0;

    report.c3_3_mixedReadinessEnforcement = {
      status: c3_3_pass ? "PASS" : "FAIL",
      details: {
        mixedCompDenied,
        mixedCompError: mixedCompErr?.message,
        statusAfterAttempt: statusAfterMixed,
        reconnectedAtAfterAttempt: reconnectedAtAfterMixed,
        outcomesCountAfterAttempt: parseInt(outcomesAfterMixed, 10),
      },
    };

    // ------------------------------------------------------------------------
    // C3.4: Creator-Only Completion
    // ------------------------------------------------------------------------
    console.log("\n--- Scenario C3.4: Creator-Only Completion ---");
    // First, Partner A updates settlement to 'ready' -> Now BOTH are ready!
    console.log("Step 1: Partner A updates settlement response to 'ready' via RPC...");
    const { data: partnerAReadyData, error: partnerAReadyErr } = await clientA.rpc(
      "submit_repair_response",
      {
        p_event_id: dispEvent1.id,
        p_phase: "settlement",
        p_response_code: "ready",
      }
    );
    if (partnerAReadyErr) throw new Error(`Partner A update to ready failed: ${partnerAReadyErr.message}`);

    // Check 1: Recipient Partner B attempts completion -> MUST BE REJECTED
    console.log("Check 1: Partner B (recipient) attempts complete_repair_reconnection on both-ready event...");
    const { data: recipientCompData, error: recipientCompErr } = await clientB.rpc(
      "complete_repair_reconnection",
      {
        p_event_id: dispEvent1.id,
        p_takeaway_tag: "giving_space",
        p_takeaway_note: "Recipient completion attempt",
      }
    );
    const recipientCompDenied = !!recipientCompErr && recipientCompErr.message.includes("Only the event creator may complete reconnection");
    console.log(`Recipient completion attempt: ${recipientCompDenied ? "PASS (Denied)" : "FAIL"} - Message: ${recipientCompErr?.message}`);

    const statusAfterRecipientComp = queryDb(`SELECT status FROM relationship_events WHERE id = '${dispEvent1.id}';`);
    const outcomesAfterRecipientComp = queryDb(`SELECT count(*) FROM relationship_event_repair_outcomes WHERE event_id = '${dispEvent1.id}';`);

    // Check 2: Takeaway validation: whitespace note
    console.log("Check 2: Partner A attempts complete_repair_reconnection with whitespace-only note...");
    const { data: wsNoteData, error: wsNoteErr } = await clientA.rpc(
      "complete_repair_reconnection",
      {
        p_event_id: dispEvent1.id,
        p_takeaway_tag: "talking_it_through",
        p_takeaway_note: "     ",
      }
    );
    const wsNoteDenied = !!wsNoteErr && wsNoteErr.message.includes("Takeaway note cannot be whitespace only");
    console.log(`Whitespace note validation: ${wsNoteDenied ? "PASS (Denied)" : "FAIL"} - Message: ${wsNoteErr?.message}`);

    // Check 3: Takeaway validation: note > 500 chars
    console.log("Check 3: Partner A attempts complete_repair_reconnection with > 500 chars note...");
    const { data: longNoteData, error: longNoteErr } = await clientA.rpc(
      "complete_repair_reconnection",
      {
        p_event_id: dispEvent1.id,
        p_takeaway_tag: "talking_it_through",
        p_takeaway_note: "A".repeat(501),
      }
    );
    const longNoteDenied = !!longNoteErr && longNoteErr.message.includes("Takeaway note exceeds maximum length");
    console.log(`Long note validation: ${longNoteDenied ? "PASS (Denied)" : "FAIL"} - Message: ${longNoteErr?.message}`);

    // Check 4: Takeaway validation: invalid tag
    console.log("Check 4: Partner A attempts complete_repair_reconnection with invalid tag...");
    const { data: invTagData, error: invTagErr } = await clientA.rpc(
      "complete_repair_reconnection",
      {
        p_event_id: dispEvent1.id,
        p_takeaway_tag: "invalid_tag_name",
        p_takeaway_note: "Note with invalid tag",
      }
    );
    const invTagDenied = !!invTagErr && invTagErr.message.includes("Invalid takeaway tag");
    console.log(`Invalid tag validation: ${invTagDenied ? "PASS (Denied)" : "FAIL"} - Message: ${invTagErr?.message}`);

    // Check 5: Creator Partner A completes reconnection with valid inputs -> MUST SUCCEED
    console.log("Check 5: Partner A (creator) calls complete_repair_reconnection with valid inputs...");
    const { data: creatorCompData, error: creatorCompErr } = await clientA.rpc(
      "complete_repair_reconnection",
      {
        p_event_id: dispEvent1.id,
        p_takeaway_tag: "talking_it_through",
        p_takeaway_note: "QA C3 Valid Creator Completion",
      }
    );
    const creatorCompSuccess = !creatorCompErr && creatorCompData === dispEvent1.id;
    console.log(`Creator completion attempt: ${creatorCompSuccess ? "PASS (Succeeded)" : "FAIL"} - Returned ID: ${creatorCompData}`);

    const statusAfterCreatorComp = queryDb(`SELECT status FROM relationship_events WHERE id = '${dispEvent1.id}';`);
    const reconnectedAtAfterCreatorComp = queryDb(`SELECT COALESCE(reconnected_at::text, 'NULL') FROM relationship_events WHERE id = '${dispEvent1.id}';`);
    const outcomesAfterCreatorComp = queryDb(`SELECT count(*) FROM relationship_event_repair_outcomes WHERE event_id = '${dispEvent1.id}';`);
    const outcomeRow = queryDb(`SELECT completed_by, takeaway_tag, takeaway_note FROM relationship_event_repair_outcomes WHERE event_id = '${dispEvent1.id}';`);

    const c3_4_pass =
      recipientCompDenied &&
      wsNoteDenied &&
      longNoteDenied &&
      invTagDenied &&
      statusAfterRecipientComp === "partially_repaired" &&
      parseInt(outcomesAfterRecipientComp, 10) === 0 &&
      creatorCompSuccess &&
      statusAfterCreatorComp === "reconnected" &&
      reconnectedAtAfterCreatorComp !== "NULL" &&
      parseInt(outcomesAfterCreatorComp, 10) === 1 &&
      outcomeRow.includes(PRIMARY_COUPLE.partnerA.id);

    report.c3_4_creatorOnlyCompletion = {
      status: c3_4_pass ? "PASS" : "FAIL",
      details: {
        recipientCompDenied,
        recipientCompError: recipientCompErr?.message,
        wsNoteDenied,
        wsNoteError: wsNoteErr?.message,
        longNoteDenied,
        longNoteError: longNoteErr?.message,
        invTagDenied,
        invTagError: invTagErr?.message,
        statusAfterRecipientCompDenied: statusAfterRecipientComp,
        outcomesCountAfterRecipientCompDenied: parseInt(outcomesAfterRecipientComp, 10),
        creatorCompSuccess,
        creatorCompReturnedId: creatorCompData,
        statusAfterCreatorComp: statusAfterCreatorComp,
        reconnectedAt: reconnectedAtAfterCreatorComp,
        outcomesCount: parseInt(outcomesAfterCreatorComp, 10),
        outcomeRecord: outcomeRow,
      },
    };

    // ------------------------------------------------------------------------
    // C3.5: Foreign and Unauthenticated Requests
    // ------------------------------------------------------------------------
    console.log("\n--- Scenario C3.5: Foreign and Unauthenticated Requests ---");
    const dispEvent2 = await createDisposableEvent("Foreign Test");
    console.log(`Created disposable event 2: ${dispEvent2.id} (status: ${dispEvent2.status})`);

    // Partner C (foreign couple) attempts on dispEvent2
    console.log("Check 1: Partner C calls submit_repair_response on dispEvent2...");
    const { data: foreignRespData, error: foreignRespErr } = await clientC.rpc(
      "submit_repair_response",
      {
        p_event_id: dispEvent2.id,
        p_phase: "arrival",
        p_response_code: "heard",
      }
    );
    const foreignRespDenied = !!foreignRespErr && foreignRespErr.message.includes("Relationship membership required");

    console.log("Check 2: Partner C calls complete_repair_reconnection on dispEvent2...");
    const { data: foreignCompData, error: foreignCompErr } = await clientC.rpc(
      "complete_repair_reconnection",
      {
        p_event_id: dispEvent2.id,
        p_takeaway_tag: "giving_space",
      }
    );
    const foreignCompDenied = !!foreignCompErr;

    console.log("Check 3: Partner C attempts direct SELECT on repair responses and outcomes for primary couple...");
    const { data: foreignReadResponses, error: foreignReadRespErr } = await clientC
      .from("relationship_event_repair_responses")
      .select("id")
      .eq("event_id", dispEvent1.id);
    const { data: foreignReadOutcomes, error: foreignReadOutErr } = await clientC
      .from("relationship_event_repair_outcomes")
      .select("event_id")
      .eq("event_id", dispEvent1.id);

    const foreignReadsBlocked =
      (foreignReadResponses?.length === 0 || !!foreignReadRespErr) &&
      (foreignReadOutcomes?.length === 0 || !!foreignReadOutErr);

    // Unauthenticated client attempts
    console.log("Check 4: Unauthenticated client calls submit_repair_response...");
    const { data: anonRespData, error: anonRespErr } = await anonClient.rpc(
      "submit_repair_response",
      {
        p_event_id: dispEvent2.id,
        p_phase: "arrival",
        p_response_code: "heard",
      }
    );
    const anonRespDenied =
      !!anonRespErr &&
      (anonRespErr.message.includes("Authentication required") ||
        anonRespErr.message.includes("permission denied for function"));

    console.log("Check 5: Unauthenticated client calls complete_repair_reconnection...");
    const { data: anonCompData, error: anonCompErr } = await anonClient.rpc(
      "complete_repair_reconnection",
      {
        p_event_id: dispEvent2.id,
      }
    );
    const anonCompDenied =
      !!anonCompErr &&
      (anonCompErr.message.includes("Authentication required") ||
        anonCompErr.message.includes("permission denied for function"));

    console.log("Check 6: Unauthenticated client attempts direct SELECT on repair responses...");
    const { data: anonReadResponses, error: anonReadRespErr } = await anonClient
      .from("relationship_event_repair_responses")
      .select("id");
    const anonReadsBlocked = anonReadResponses === null || anonReadResponses?.length === 0 || !!anonReadRespErr;

    // Verify dispEvent2 is completely untouched
    const disp2ResponsesCount = queryDb(`SELECT count(*) FROM relationship_event_repair_responses WHERE event_id = '${dispEvent2.id}';`);
    const disp2OutcomesCount = queryDb(`SELECT count(*) FROM relationship_event_repair_outcomes WHERE event_id = '${dispEvent2.id}';`);
    const disp2Status = queryDb(`SELECT status FROM relationship_events WHERE id = '${dispEvent2.id}';`);

    const c3_5_pass =
      foreignRespDenied &&
      foreignCompDenied &&
      foreignReadsBlocked &&
      anonRespDenied &&
      anonCompDenied &&
      anonReadsBlocked &&
      parseInt(disp2ResponsesCount, 10) === 0 &&
      parseInt(disp2OutcomesCount, 10) === 0 &&
      disp2Status === "open";

    report.c3_5_foreignAndUnauthenticatedRequests = {
      status: c3_5_pass ? "PASS" : "FAIL",
      details: {
        foreignRespDenied,
        foreignRespError: foreignRespErr?.message,
        foreignCompDenied,
        foreignCompError: foreignCompErr?.message,
        foreignReadsBlocked,
        foreignResponsesRead: foreignReadResponses?.length ?? 0,
        foreignOutcomesRead: foreignReadOutcomes?.length ?? 0,
        anonRespDenied,
        anonRespError: anonRespErr?.message,
        anonCompDenied,
        anonCompError: anonCompErr?.message,
        anonReadsBlocked,
        dispEvent2Status: disp2Status,
        dispEvent2ResponsesCount: parseInt(disp2ResponsesCount, 10),
      },
    };

    // ------------------------------------------------------------------------
    // C3.6: Replay and Invalid Transitions
    // ------------------------------------------------------------------------
    console.log("\n--- Scenario C3.6: Replay and Invalid Transitions ---");

    // 1. Post-reconnection submission denial
    console.log("Check 1: Partner B attempts submit_repair_response(arrival) on already reconnected dispEvent1...");
    const { data: postReconnArrData, error: postReconnArrErr } = await clientB.rpc(
      "submit_repair_response",
      {
        p_event_id: dispEvent1.id,
        p_phase: "arrival",
        p_response_code: "heard",
      }
    );
    const postReconnArrDenied = !!postReconnArrErr && postReconnArrErr.message.includes("Event is already reconnected");

    console.log("Check 2: Partner A attempts submit_repair_response(settlement) on already reconnected dispEvent1...");
    const { data: postReconnSetData, error: postReconnSetErr } = await clientA.rpc(
      "submit_repair_response",
      {
        p_event_id: dispEvent1.id,
        p_phase: "settlement",
        p_response_code: "ready",
      }
    );
    const postReconnSetDenied = !!postReconnSetErr && postReconnSetErr.message.includes("Event is already reconnected");

    // 2. Duplicate completion call by creator (idempotency check)
    console.log("Check 3: Partner A calls complete_repair_reconnection again on dispEvent1 (idempotency test)...");
    const { data: dupCompData, error: dupCompErr } = await clientA.rpc(
      "complete_repair_reconnection",
      {
        p_event_id: dispEvent1.id,
        p_takeaway_tag: "talking_it_through",
        p_takeaway_note: "Duplicate call",
      }
    );
    const dupCompSuccess = !dupCompErr && dupCompData === dispEvent1.id;
    const outcomesCountAfterDup = queryDb(`SELECT count(*) FROM relationship_event_repair_outcomes WHERE event_id = '${dispEvent1.id}';`);
    const dupNoAdditionalRow = parseInt(outcomesCountAfterDup, 10) === 1;

    // 3. Invalid inputs on dispEvent2
    console.log("Check 4: Partner B calls submit_repair_response with invalid phase 'invalid_phase'...");
    const { data: invPhaseData, error: invPhaseErr } = await clientB.rpc(
      "submit_repair_response",
      {
        p_event_id: dispEvent2.id,
        p_phase: "invalid_phase",
        p_response_code: "heard",
      }
    );
    const invPhaseDenied = !!invPhaseErr && invPhaseErr.message.includes("Invalid repair phase");

    console.log("Check 5: Partner B calls submit_repair_response with invalid arrival code 'invalid_code'...");
    const { data: invCodeData, error: invCodeErr } = await clientB.rpc(
      "submit_repair_response",
      {
        p_event_id: dispEvent2.id,
        p_phase: "arrival",
        p_response_code: "invalid_code",
      }
    );
    const invCodeDenied = !!invCodeErr && invCodeErr.message.includes("Invalid arrival response code");

    console.log("Check 6: Partner B calls submit_repair_response with nonexistent event UUID...");
    const { data: invEvtData, error: invEvtErr } = await clientB.rpc(
      "submit_repair_response",
      {
        p_event_id: "00000000-0000-0000-0000-000000000000",
        p_phase: "arrival",
        p_response_code: "heard",
      }
    );
    const invEvtDenied = !!invEvtErr && invEvtErr.message.includes("Event unavailable");

    console.log("Check 7: Partner A calls complete_repair_reconnection on open dispEvent2 (invalid status)...");
    const { data: invStatusData, error: invStatusErr } = await clientA.rpc(
      "complete_repair_reconnection",
      {
        p_event_id: dispEvent2.id,
        p_takeaway_tag: "talking_it_through",
        p_takeaway_note: "Attempting completion on open event",
      }
    );
    const invStatusDenied = !!invStatusErr && invStatusErr.message.includes("Event must be in care (partially_repaired) before completion");

    console.log("Check 8: Partner A calls complete_repair_reconnection with nonexistent event UUID...");
    const { data: invCompEvtData, error: invCompEvtErr } = await clientA.rpc(
      "complete_repair_reconnection",
      {
        p_event_id: "00000000-0000-0000-0000-000000000000",
        p_takeaway_tag: "talking_it_through",
      }
    );
    const invCompEvtDenied = !!invCompEvtErr && invCompEvtErr.message.includes("Event unavailable");

    const c3_6_pass =
      postReconnArrDenied &&
      postReconnSetDenied &&
      dupCompSuccess &&
      dupNoAdditionalRow &&
      invPhaseDenied &&
      invCodeDenied &&
      invEvtDenied &&
      invStatusDenied &&
      invCompEvtDenied;

    report.c3_6_replayAndInvalidTransitions = {
      status: c3_6_pass ? "PASS" : "FAIL",
      details: {
        postReconnArrDenied,
        postReconnArrError: postReconnArrErr?.message,
        postReconnSetDenied,
        postReconnSetError: postReconnSetErr?.message,
        dupCompSuccess,
        dupNoAdditionalRow,
        outcomesCountAfterDup: parseInt(outcomesCountAfterDup, 10),
        invPhaseDenied,
        invPhaseError: invPhaseErr?.message,
        invCodeDenied,
        invCodeError: invCodeErr?.message,
        invEvtDenied,
        invEvtError: invEvtErr?.message,
        invStatusDenied,
        invStatusError: invStatusErr?.message,
        invCompEvtDenied,
        invCompEvtError: invCompEvtErr?.message,
      },
    };

    // ------------------------------------------------------------------------
    // C3.7: Final Authorized Control and Integrity
    // ------------------------------------------------------------------------
    console.log("\n--- Scenario C3.7: Final Authorized Control and Integrity ---");

    // Clean up disposable events
    console.log("Cleaning up disposable test fixtures...");
    for (const evtId of disposableEventIds) {
      const { error: delErr } = await clientA
        .from("relationship_events")
        .delete()
        .eq("id", evtId);
      console.log(`Deleted disposable event ${evtId}: ${delErr ? `Error: ${delErr.message}` : "OK"}`);
    }

    // Verify cleanup
    const leftoverEvents = queryDb(`SELECT count(*) FROM relationship_events WHERE id IN ('${disposableEventIds.join("','")}');`);
    const leftoverResponses = queryDb(`SELECT count(*) FROM relationship_event_repair_responses WHERE event_id IN ('${disposableEventIds.join("','")}');`);
    const leftoverOutcomes = queryDb(`SELECT count(*) FROM relationship_event_repair_outcomes WHERE event_id IN ('${disposableEventIds.join("','")}');`);
    const fixturesCleaned =
      parseInt(leftoverEvents, 10) === 0 &&
      parseInt(leftoverResponses, 10) === 0 &&
      parseInt(leftoverOutcomes, 10) === 0;

    // Verify historical records remain untouched
    const currentEventRaw = queryDb(`SELECT id, status, reconnected_at, created_at FROM relationship_events WHERE id = '${PRIMARY_COUPLE.targetEventId}';`);
    const currentResponsesRaw = queryDb(`SELECT count(*) FROM relationship_event_repair_responses WHERE event_id = '${PRIMARY_COUPLE.targetEventId}';`);
    const currentOutcomesRaw = queryDb(`SELECT count(*) FROM relationship_event_repair_outcomes WHERE event_id = '${PRIMARY_COUPLE.targetEventId}';`);
    const currentWeeklyRaw = queryDb(`SELECT id, user_id, updated_at FROM weekly_reflections WHERE id = '${PRIMARY_COUPLE.targetWeeklyId}';`);

    const eventUnchanged = currentEventRaw === report.historicalBaseline.event;
    const responsesUnchanged = parseInt(currentResponsesRaw, 10) === report.historicalBaseline.responsesCount;
    const outcomesUnchanged = parseInt(currentOutcomesRaw, 10) === report.historicalBaseline.outcomesCount;
    const weeklyUnchanged = currentWeeklyRaw === report.historicalBaseline.weekly;

    const zeroRemoteCalls = networkAudit.remoteRequestsDetected.length === 0;

    const c3_7_pass =
      fixturesCleaned &&
      eventUnchanged &&
      responsesUnchanged &&
      outcomesUnchanged &&
      weeklyUnchanged &&
      zeroRemoteCalls;

    report.c3_7_finalAuthorizedControlAndIntegrity = {
      status: c3_7_pass ? "PASS" : "FAIL",
      details: {
        disposableEventsCleaned: fixturesCleaned,
        historicalEventUnchanged: eventUnchanged,
        historicalResponsesCountUnchanged: responsesUnchanged,
        historicalOutcomesCountUnchanged: outcomesUnchanged,
        historicalWeeklyUnchanged: weeklyUnchanged,
        zeroRemoteCalls,
        totalLocalRequests: networkAudit.localRequests,
      },
    };

    console.log("\n=======================================================");
    console.log(`C3.1 Arrival Authorization:        ${report.c3_1_arrivalResponseAuthorization.status}`);
    console.log(`C3.2 Settlement Ownership:         ${report.c3_2_settlementResponseOwnership.status}`);
    console.log(`C3.3 Mixed Readiness Enforcement:   ${report.c3_3_mixedReadinessEnforcement.status}`);
    console.log(`C3.4 Creator-Only Completion:       ${report.c3_4_creatorOnlyCompletion.status}`);
    console.log(`C3.5 Foreign/Anon Requests:         ${report.c3_5_foreignAndUnauthenticatedRequests.status}`);
    console.log(`C3.6 Replay/Invalid Transitions:    ${report.c3_6_replayAndInvalidTransitions.status}`);
    console.log(`C3.7 Final Integrity & Network:     ${report.c3_7_finalAuthorizedControlAndIntegrity.status}`);
    console.log("=======================================================\n");

  } catch (err) {
    console.error("FATAL ERROR during Scenario C3:", err);
    report.fatalError = {
      message: err.message,
      stack: err.stack,
    };
  } finally {
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), "utf8");
    console.log(`Report written to ${REPORT_FILE}`);
  }
}

runScenarioC3();
