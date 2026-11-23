import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ARTIFACT_DIR = path.resolve("test-results/phase3c");
const REPORT_FILE = path.join(ARTIFACT_DIR, "c1-authorization-report.json");
const LOCAL_SUPABASE_HOST = "127.0.0.1:54321";
const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const RUN_ID = Date.now().toString(36);

const QA_USERS = {
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
  coupleId: "10000002-0002-0002-0002-000000000001",
};

const EXISTING_VALIDATED = {
  eventId: "c6ff8008-cba9-4bb1-ad74-335ae9d4a635",
  weeklyReflectionId: "24ff05a3-d11b-4767-b781-a65d3db3a4cc",
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

async function runScenarioC1() {
  console.log("=== PURPLE GARDEN: PHASE 3C / C1: PRIVATE REFLECTION READ/WRITE AUTHORIZATION TEST ===");
  console.log(`Timestamp: ${new Date().toISOString()} | RUN_ID: ${RUN_ID}`);

  const networkAudit = {
    remoteRequestsDetected: [],
    localRequests: 0,
  };

  // Custom fetch to monitor network boundaries
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

  const clientA = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { fetch: monitoredFetch },
  });

  const clientB = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { fetch: monitoredFetch },
  });

  console.log("\n[Setup] Authenticating Partner A and Partner B with local Supabase...");
  const { data: authA, error: errA } = await clientA.auth.signInWithPassword({
    email: QA_USERS.partnerA.email,
    password: QA_USERS.partnerA.password,
  });
  if (errA || !authA.user) {
    console.error(`[BLOCKED] Failed to authenticate Partner A: ${errA?.message}`);
    process.exit(2);
  }
  console.log(`  Partner A authenticated (UID: ${authA.user.id})`);

  const { data: authB, error: errB } = await clientB.auth.signInWithPassword({
    email: QA_USERS.partnerB.email,
    password: QA_USERS.partnerB.password,
  });
  if (errB || !authB.user) {
    console.error(`[BLOCKED] Failed to authenticate Partner B: ${errB?.message}`);
    process.exit(2);
  }
  console.log(`  Partner B authenticated (UID: ${authB.user.id})`);

  const results = {
    runId: RUN_ID,
    timestamp: new Date().toISOString(),
    c1_1_readIsolation: { status: "PENDING", details: {} },
    c1_2_unauthorizedUpdate: { status: "PENDING", details: {} },
    c1_3_unauthorizedDelete: { status: "PENDING", details: {} },
    c1_4_forgedInsert: { status: "PENDING", details: {} },
    c1_5_authorizedControl: { status: "PENDING", details: {} },
    c1_6_weeklyReflectionWriteAuth: { status: "PENDING", details: {} },
    c1_7_integrityAndNetworkAudit: { status: "PENDING", details: {} },
    disposableFixtures: [],
    networkAudit,
  };

  // Track disposable fixtures for cleanup
  const disposableEvents = [];
  const disposableWeeklyReflections = [];

  try {
    // =========================================================================
    // C1.1 — AUTHENTICATED READ ISOLATION
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- C1.1: AUTHENTICATED READ ISOLATION ---");
    console.log("========================================================");

    // 1. Private event reflection read
    const { data: aPrivateRead, error: aReadErr } = await clientA
      .from("event_private_reflections")
      .select("id, event_id, author_id, note")
      .eq("event_id", EXISTING_VALIDATED.eventId);

    const { data: bPrivateRead, error: bReadErr } = await clientB
      .from("event_private_reflections")
      .select("id, event_id, author_id, note")
      .eq("event_id", EXISTING_VALIDATED.eventId);

    console.log(`  Partner A private reflection query: ${aPrivateRead?.length || 0} rows (Error: ${aReadErr?.message || "none"})`);
    console.log(`  Partner B private reflection query: ${bPrivateRead?.length || 0} rows (Error: ${bReadErr?.message || "none"})`);

    const c1_1_event_a_pass = aPrivateRead?.length === 1 && aPrivateRead[0].author_id === QA_USERS.partnerA.id;
    const c1_1_event_b_pass = bPrivateRead?.length === 0;

    // 2. Weekly reflection read
    const { data: aWeeklyRead, error: aWeeklyErr } = await clientA
      .from("weekly_reflections")
      .select("id, user_id, stayed_with, carry_forward, private_note")
      .eq("id", EXISTING_VALIDATED.weeklyReflectionId);

    const { data: bWeeklyRead, error: bWeeklyErr } = await clientB
      .from("weekly_reflections")
      .select("id, user_id, stayed_with, carry_forward, private_note")
      .eq("id", EXISTING_VALIDATED.weeklyReflectionId);

    console.log(`  Partner A weekly reflection query: ${aWeeklyRead?.length || 0} rows (Error: ${aWeeklyErr?.message || "none"})`);
    console.log(`  Partner B weekly reflection query: ${bWeeklyRead?.length || 0} rows (Error: ${bWeeklyErr?.message || "none"})`);

    const c1_1_weekly_a_pass = aWeeklyRead?.length === 1 && aWeeklyRead[0].user_id === QA_USERS.partnerA.id;
    const c1_1_weekly_b_pass = bWeeklyRead?.length === 0;

    const c1_1_pass = c1_1_event_a_pass && c1_1_event_b_pass && c1_1_weekly_a_pass && c1_1_weekly_b_pass;
    results.c1_1_readIsolation = {
      status: c1_1_pass ? "PASS" : "FAIL",
      details: {
        eventReflectionA: { rows: aPrivateRead?.length || 0, authorId: aPrivateRead?.[0]?.author_id },
        eventReflectionB: { rows: bPrivateRead?.length || 0 },
        weeklyReflectionA: { rows: aWeeklyRead?.length || 0, userId: aWeeklyRead?.[0]?.user_id },
        weeklyReflectionB: { rows: bWeeklyRead?.length || 0 },
      },
    };
    console.log(`>>> C1.1 RESULT: [${results.c1_1_readIsolation.status}] <<<`);

    // =========================================================================
    // C1.2 — UNAUTHORIZED UPDATE
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- C1.2: UNAUTHORIZED UPDATE ---");
    console.log("========================================================");

    // Create disposable event + reflection owned by Partner A
    const dispEvent1Id = await clientA.rpc("create_relationship_moment", {
      p_couple_id: QA_USERS.coupleId,
      p_event_type: "friction",
      p_category: "household",
      p_intensity: 2,
      p_visibility: "ours",
      p_private_note: `DISPOSABLE_A_ORIGINAL_NOTE_${RUN_ID}`,
      p_shared_topic: `DISPOSABLE_A_SHARED_TOPIC_${RUN_ID}`,
    }).then(res => res.data);

    disposableEvents.push(dispEvent1Id);
    console.log(`  Created disposable event 1: ${dispEvent1Id}`);

    // Fetch reflection ID directly from DB
    const dispRef1Row = queryDb(`
      SELECT id, author_id, note FROM public.event_private_reflections WHERE event_id = '${dispEvent1Id}';
    `);
    const [dispRef1Id, dispRef1Author, dispRef1OrigNote] = dispRef1Row.split("|");
    console.log(`  Disposable reflection 1 in DB: ID ${dispRef1Id} | Author ${dispRef1Author} | Note: ${dispRef1OrigNote}`);

    // Partner B attempts to update Partner A's reflection by exact ID
    const { data: bUpdateData, error: bUpdateErr, count: bUpdateCount } = await clientB
      .from("event_private_reflections")
      .update({ note: "MALICIOUS_UPDATE_BY_PARTNER_B" }, { count: "exact" })
      .eq("id", dispRef1Id)
      .select();

    console.log(`  Partner B update attempt response: rows returned: ${bUpdateData?.length || 0}, count: ${bUpdateCount}, error: ${bUpdateErr?.message || "none"}`);

    // Check DB authoritative snapshot
    const dbAfterUpdateAttempt = queryDb(`
      SELECT note FROM public.event_private_reflections WHERE id = '${dispRef1Id}';
    `);
    console.log(`  Authoritative DB note after Partner B update attempt: "${dbAfterUpdateAttempt}"`);

    const c1_2_pass = (bUpdateData?.length === 0 || bUpdateCount === 0) &&
                      dbAfterUpdateAttempt === dispRef1OrigNote;

    results.c1_2_unauthorizedUpdate = {
      status: c1_2_pass ? "PASS" : "FAIL",
      details: {
        targetReflectionId: dispRef1Id,
        updateAttemptRows: bUpdateData?.length || 0,
        updateAttemptError: bUpdateErr?.message || null,
        dbOriginalNote: dispRef1OrigNote,
        dbAfterAttemptNote: dbAfterUpdateAttempt,
        tamperDetected: dbAfterUpdateAttempt !== dispRef1OrigNote,
      },
    };
    console.log(`>>> C1.2 RESULT: [${results.c1_2_unauthorizedUpdate.status}] <<<`);

    // =========================================================================
    // C1.3 — UNAUTHORIZED DELETE
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- C1.3: UNAUTHORIZED DELETE ---");
    console.log("========================================================");

    // Create disposable event + reflection owned by Partner A
    const dispEvent2Id = await clientA.rpc("create_relationship_moment", {
      p_couple_id: QA_USERS.coupleId,
      p_event_type: "friction",
      p_category: "communication",
      p_intensity: 2,
      p_visibility: "ours",
      p_private_note: `DISPOSABLE_A_DELETE_TEST_NOTE_${RUN_ID}`,
      p_shared_topic: `DISPOSABLE_A_DELETE_TEST_TOPIC_${RUN_ID}`,
    }).then(res => res.data);

    disposableEvents.push(dispEvent2Id);
    console.log(`  Created disposable event 2: ${dispEvent2Id}`);

    const dispRef2Row = queryDb(`
      SELECT id, author_id, note FROM public.event_private_reflections WHERE event_id = '${dispEvent2Id}';
    `);
    const [dispRef2Id, dispRef2Author, dispRef2OrigNote] = dispRef2Row.split("|");
    console.log(`  Disposable reflection 2 in DB: ID ${dispRef2Id} | Author ${dispRef2Author}`);

    // Partner B attempts to delete Partner A's reflection by exact ID
    const { data: bDeleteData, error: bDeleteErr, count: bDeleteCount } = await clientB
      .from("event_private_reflections")
      .delete({ count: "exact" })
      .eq("id", dispRef2Id)
      .select();

    console.log(`  Partner B delete attempt response: rows returned: ${bDeleteData?.length || 0}, count: ${bDeleteCount}, error: ${bDeleteErr?.message || "none"}`);

    // Authoritative DB check
    const dbAfterDeleteAttempt = queryDb(`
      SELECT count(*) FROM public.event_private_reflections WHERE id = '${dispRef2Id}';
    `);
    console.log(`  Authoritative DB record count after Partner B delete attempt: ${dbAfterDeleteAttempt}`);

    const c1_3_pass = (bDeleteData?.length === 0 || bDeleteCount === 0) &&
                      parseInt(dbAfterDeleteAttempt, 10) === 1;

    results.c1_3_unauthorizedDelete = {
      status: c1_3_pass ? "PASS" : "FAIL",
      details: {
        targetReflectionId: dispRef2Id,
        deleteAttemptRows: bDeleteData?.length || 0,
        deleteAttemptError: bDeleteErr?.message || null,
        dbRecordStillExists: parseInt(dbAfterDeleteAttempt, 10) === 1,
      },
    };
    console.log(`>>> C1.3 RESULT: [${results.c1_3_unauthorizedDelete.status}] <<<`);

    // =========================================================================
    // C1.4 — FORGED INSERT / OWNER IMPERSONATION
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- C1.4: FORGED INSERT / OWNER IMPERSONATION ---");
    console.log("========================================================");

    // Partner B attempts to insert a reflection with author_id set to Partner A
    const { data: bForgedData, error: bForgedErr } = await clientB
      .from("event_private_reflections")
      .insert({
        event_id: dispEvent1Id,
        author_id: QA_USERS.partnerA.id,
        note: `FORGED_NOTE_BY_PARTNER_B_${RUN_ID}`,
      })
      .select();

    console.log(`  Partner B forged insert response: ${JSON.stringify(bForgedData)}, Error: ${bForgedErr?.message || "none"} (Code: ${bForgedErr?.code || "none"})`);

    const dbForgedCheck = queryDb(`
      SELECT count(*) FROM public.event_private_reflections WHERE note = 'FORGED_NOTE_BY_PARTNER_B_${RUN_ID}';
    `);
    console.log(`  Authoritative DB forged note count: ${dbForgedCheck}`);

    const c1_4_pass = bForgedErr !== null &&
                      (bForgedErr.code === "42501" || bForgedErr.message.includes("row-level security")) &&
                      parseInt(dbForgedCheck, 10) === 0;

    results.c1_4_forgedInsert = {
      status: c1_4_pass ? "PASS" : "FAIL",
      details: {
        errorReceived: bForgedErr?.message || null,
        errorCode: bForgedErr?.code || null,
        dbForgedRecordsFound: parseInt(dbForgedCheck, 10),
      },
    };
    console.log(`>>> C1.4 RESULT: [${results.c1_4_forgedInsert.status}] <<<`);

    // =========================================================================
    // C1.5 — AUTHORIZED OPERATIONS CONTROL
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- C1.5: AUTHORIZED OPERATIONS CONTROL ---");
    console.log("========================================================");

    // 1. Author Partner A updates their own disposable reflection 1
    const { data: aLegitUpdate, error: aUpdateErr } = await clientA
      .from("event_private_reflections")
      .update({ note: `LEGITIMATE_UPDATE_BY_PARTNER_A_${RUN_ID}` })
      .eq("id", dispRef1Id)
      .select("id, note");

    const dbAfterLegitUpdate = queryDb(`
      SELECT note FROM public.event_private_reflections WHERE id = '${dispRef1Id}';
    `);
    console.log(`  Partner A legitimate update in DB: "${dbAfterLegitUpdate}"`);
    const aUpdateSucceeded = !aUpdateErr && dbAfterLegitUpdate === `LEGITIMATE_UPDATE_BY_PARTNER_A_${RUN_ID}`;

    // 2. Author Partner A deletes their own disposable reflection 2
    const { data: aLegitDelete, error: aDeleteErr } = await clientA
      .from("event_private_reflections")
      .delete()
      .eq("id", dispRef2Id)
      .select("id");

    const dbAfterLegitDelete = queryDb(`
      SELECT count(*) FROM public.event_private_reflections WHERE id = '${dispRef2Id}';
    `);
    console.log(`  Partner A legitimate delete in DB: count is ${dbAfterLegitDelete}`);
    const aDeleteSucceeded = !aDeleteErr && parseInt(dbAfterLegitDelete, 10) === 0;

    const c1_5_pass = aUpdateSucceeded && aDeleteSucceeded;
    results.c1_5_authorizedControl = {
      status: c1_5_pass ? "PASS" : "FAIL",
      details: {
        aUpdateSucceeded,
        aDeleteSucceeded,
        aUpdateError: aUpdateErr?.message || null,
        aDeleteError: aDeleteErr?.message || null,
      },
    };
    console.log(`>>> C1.5 RESULT: [${results.c1_5_authorizedControl.status}] <<<`);

    // =========================================================================
    // C1.6 — WEEKLY REFLECTION WRITE AUTHORIZATION
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- C1.6: WEEKLY REFLECTION WRITE AUTHORIZATION ---");
    console.log("========================================================");

    // Create disposable weekly reflection owned by Partner A for past week 2026-11-09
    const dispWeekStart = "2026-11-09T00:00:00.000Z";
    const dispWeekEnd = "2026-11-16T00:00:00.000Z";

    const { data: aWeeklyInsert, error: aWeeklyInsertErr } = await clientA
      .from("weekly_reflections")
      .insert({
        user_id: QA_USERS.partnerA.id,
        couple_id: QA_USERS.coupleId,
        week_start: dispWeekStart,
        week_end: dispWeekEnd,
        stayed_with: "Something we worked through",
        carry_forward: "More time together",
        private_note: `DISPOSABLE_A_WEEKLY_ORIGINAL_${RUN_ID}`,
      })
      .select("id")
      .single();

    if (aWeeklyInsertErr || !aWeeklyInsert) {
      console.error(`  Failed to create disposable weekly fixture: ${aWeeklyInsertErr?.message}`);
    }
    const dispWeeklyId = aWeeklyInsert?.id;
    disposableWeeklyReflections.push(dispWeeklyId);
    console.log(`  Partner A created disposable weekly reflection: ID ${dispWeeklyId}`);

    // Partner B attempts to UPDATE Partner A's weekly reflection
    const { data: bWeeklyUpdate, error: bWeeklyUpdateErr, count: bWeeklyUpdateCount } = await clientB
      .from("weekly_reflections")
      .update({ private_note: "MALICIOUS_WEEKLY_UPDATE_BY_B" }, { count: "exact" })
      .eq("id", dispWeeklyId)
      .select();

    const dbAfterWeeklyUpdateAttempt = queryDb(`
      SELECT private_note FROM public.weekly_reflections WHERE id = '${dispWeeklyId}';
    `);
    console.log(`  Partner B weekly update attempt: rows returned: ${bWeeklyUpdate?.length || 0}, DB note: "${dbAfterWeeklyUpdateAttempt}"`);
    const bWeeklyUpdateBlocked = (bWeeklyUpdate?.length === 0 || bWeeklyUpdateCount === 0) &&
                                 dbAfterWeeklyUpdateAttempt === `DISPOSABLE_A_WEEKLY_ORIGINAL_${RUN_ID}`;

    // Partner B attempts to DELETE Partner A's weekly reflection
    const { data: bWeeklyDelete, error: bWeeklyDeleteErr, count: bWeeklyDeleteCount } = await clientB
      .from("weekly_reflections")
      .delete({ count: "exact" })
      .eq("id", dispWeeklyId)
      .select();

    const dbAfterWeeklyDeleteAttempt = queryDb(`
      SELECT count(*) FROM public.weekly_reflections WHERE id = '${dispWeeklyId}';
    `);
    console.log(`  Partner B weekly delete attempt: rows returned: ${bWeeklyDelete?.length || 0}, DB count: ${dbAfterWeeklyDeleteAttempt}`);
    const bWeeklyDeleteBlocked = (bWeeklyDelete?.length === 0 || bWeeklyDeleteCount === 0) &&
                                 parseInt(dbAfterWeeklyDeleteAttempt, 10) === 1;

    // Partner B attempts FORGED INSERT / IMPERSONATION into weekly_reflections
    const { data: bWeeklyForged, error: bWeeklyForgedErr } = await clientB
      .from("weekly_reflections")
      .insert({
        user_id: QA_USERS.partnerA.id,
        couple_id: QA_USERS.coupleId,
        week_start: "2026-11-02T00:00:00.000Z",
        week_end: "2026-11-09T00:00:00.000Z",
        stayed_with: "Nothing in particular",
        carry_forward: "Keep things as they are",
        private_note: `FORGED_WEEKLY_NOTE_${RUN_ID}`,
      })
      .select();

    console.log(`  Partner B forged weekly insert error: ${bWeeklyForgedErr?.message || "none"} (Code: ${bWeeklyForgedErr?.code || "none"})`);
    const dbForgedWeeklyCheck = queryDb(`
      SELECT count(*) FROM public.weekly_reflections WHERE private_note = 'FORGED_WEEKLY_NOTE_${RUN_ID}';
    `);
    const bWeeklyForgedBlocked = bWeeklyForgedErr !== null && parseInt(dbForgedWeeklyCheck, 10) === 0;

    // Partner A authorized operations control on weekly reflection
    const { data: aWeeklyLegitUpdate, error: aWeeklyLegitUpdateErr } = await clientA
      .from("weekly_reflections")
      .update({ private_note: `LEGITIMATE_A_WEEKLY_UPDATE_${RUN_ID}` })
      .eq("id", dispWeeklyId)
      .select("id, private_note");

    const dbAfterWeeklyLegitUpdate = queryDb(`
      SELECT private_note FROM public.weekly_reflections WHERE id = '${dispWeeklyId}';
    `);
    const aWeeklyUpdateSucceeded = !aWeeklyLegitUpdateErr && dbAfterWeeklyLegitUpdate === `LEGITIMATE_A_WEEKLY_UPDATE_${RUN_ID}`;

    // Clean up Partner A's disposable weekly reflection
    await clientA.from("weekly_reflections").delete().eq("id", dispWeeklyId);
    const dbAfterWeeklyCleanup = queryDb(`
      SELECT count(*) FROM public.weekly_reflections WHERE id = '${dispWeeklyId}';
    `);
    const aWeeklyCleanupSucceeded = parseInt(dbAfterWeeklyCleanup, 10) === 0;

    const c1_6_pass = bWeeklyUpdateBlocked &&
                      bWeeklyDeleteBlocked &&
                      bWeeklyForgedBlocked &&
                      aWeeklyUpdateSucceeded &&
                      aWeeklyCleanupSucceeded;

    results.c1_6_weeklyReflectionWriteAuth = {
      status: c1_6_pass ? "PASS" : "FAIL",
      details: {
        bWeeklyUpdateBlocked,
        bWeeklyDeleteBlocked,
        bWeeklyForgedBlocked,
        bWeeklyForgedErrorCode: bWeeklyForgedErr?.code || null,
        aWeeklyUpdateSucceeded,
        aWeeklyCleanupSucceeded,
      },
    };
    console.log(`>>> C1.6 RESULT: [${results.c1_6_weeklyReflectionWriteAuth.status}] <<<`);

    // =========================================================================
    // C1.7 — FINAL INTEGRITY AND NETWORK AUDIT
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- C1.7: FINAL INTEGRITY AND NETWORK AUDIT ---");
    console.log("========================================================");

    // Clean up remaining disposable events
    for (const evtId of disposableEvents) {
      if (evtId) {
        queryDb(`DELETE FROM public.relationship_events WHERE id = '${evtId}';`);
      }
    }
    console.log(`  Cleaned up ${disposableEvents.length} disposable test event(s) and their cascading records.`);

    // Verify existing QA records remain completely intact
    const validatedEventCheck = queryDb(`
      SELECT id, status, reconnected_at FROM public.relationship_events WHERE id = '${EXISTING_VALIDATED.eventId}';
    `);
    console.log(`  Validated Phase 3B event integrity check: ${validatedEventCheck}`);
    const eventIntact = validatedEventCheck && validatedEventCheck.includes("reconnected");

    const validatedWeeklyCheck = queryDb(`
      SELECT id, user_id, week_start FROM public.weekly_reflections WHERE id = '${EXISTING_VALIDATED.weeklyReflectionId}';
    `);
    console.log(`  Validated weekly reflection integrity check: ${validatedWeeklyCheck}`);
    const weeklyIntact = validatedWeeklyCheck && validatedWeeklyCheck.includes(QA_USERS.partnerA.id);

    // Network leaks
    const remoteLeaksCount = networkAudit.remoteRequestsDetected.length;
    console.log(`  Remote Supabase requests detected: ${remoteLeaksCount}`);
    console.log(`  Total local requests handled: ${networkAudit.localRequests}`);

    const c1_7_pass = eventIntact && weeklyIntact && remoteLeaksCount === 0;
    results.c1_7_integrityAndNetworkAudit = {
      status: c1_7_pass ? "PASS" : "FAIL",
      details: {
        eventIntact,
        weeklyIntact,
        remoteLeaksCount,
        totalLocalRequests: networkAudit.localRequests,
      },
    };
    console.log(`>>> C1.7 RESULT: [${results.c1_7_integrityAndNetworkAudit.status}] <<<`);

  } catch (err) {
    console.error(`\n[FATAL ERROR in C1 Execution]: ${err.stack || err.message}`);
  } finally {
    fs.writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2), "utf8");
    console.log(`\nScenario C1 report written to ${REPORT_FILE}`);
  }
}

runScenarioC1().catch((e) => {
  console.error("Unhandled top-level error:", e);
  process.exit(1);
});
