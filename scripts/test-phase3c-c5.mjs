import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ARTIFACT_DIR = path.resolve("test-results/phase3c");
const REPORT_FILE = path.join(ARTIFACT_DIR, "c5-security-audit-report.json");
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

async function runScenarioC5() {
  console.log("=== PURPLE GARDEN: PHASE 3C / C5: FINAL SECURITY REGRESSION & EDGE-CASE AUDIT ===");
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
    c5_1_crossDomainAccess: {},
    c5_2_rpcDefinerSecurity: {},
    c5_3_relationshipMembershipEdgeCases: {},
    c5_4_storageAndRealtimeSecurity: {},
    c5_5_authAndDataExposure: {},
    c5_6_regressionAndIntegrity: {},
    networkAudit,
  };

  try {
    // ------------------------------------------------------------------------
    // Step 0: Baseline Verification
    // ------------------------------------------------------------------------
    console.log("\n--- Step 0: Historical Baseline Snapshot ---");
    const baselineEventRaw = queryDb(`SELECT id, status, reconnected_at, created_at FROM relationship_events WHERE id = '${PRIMARY_COUPLE.targetEventId}';`);
    const baselineResponsesRaw = queryDb(`SELECT count(*) FROM relationship_event_repair_responses WHERE event_id = '${PRIMARY_COUPLE.targetEventId}';`);
    const baselineOutcomesRaw = queryDb(`SELECT count(*) FROM relationship_event_repair_outcomes WHERE event_id = '${PRIMARY_COUPLE.targetEventId}';`);
    const baselineWeeklyRaw = queryDb(`SELECT id, user_id, updated_at FROM weekly_reflections WHERE id = '${PRIMARY_COUPLE.targetWeeklyId}';`);
    const baselineReceiptsCount = queryDb(`SELECT count(*) FROM home_activity_receipts;`);

    report.historicalBaseline = {
      event: baselineEventRaw,
      responsesCount: parseInt(baselineResponsesRaw, 10),
      outcomesCount: parseInt(baselineOutcomesRaw, 10),
      weekly: baselineWeeklyRaw,
      receiptsCount: parseInt(baselineReceiptsCount, 10),
    };

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

    await clientA.auth.signInWithPassword({
      email: PRIMARY_COUPLE.partnerA.email,
      password: PRIMARY_COUPLE.partnerA.password,
    });
    await clientB.auth.signInWithPassword({
      email: PRIMARY_COUPLE.partnerB.email,
      password: PRIMARY_COUPLE.partnerB.password,
    });
    await clientC.auth.signInWithPassword({
      email: SECOND_COUPLE.userX.email,
      password: SECOND_COUPLE.userX.password,
    });

    console.log("All clients initialized and authenticated.");

    // ------------------------------------------------------------------------
    // C5.1: Cross-Domain Access Review (Shared Space & Invites)
    // ------------------------------------------------------------------------
    console.log("\n--- Scenario C5.1: Cross-Domain Access Review ---");

    // 1. Anon reads
    const { data: anonTasks } = await anonClient.from("couple_tasks").select("*");
    const { data: anonDates } = await anonClient.from("couple_important_dates").select("*");
    const { data: anonCouples } = await anonClient.from("couples").select("*");
    const { data: anonInvites } = await anonClient.from("couple_invites").select("*");

    const anonSharedBlocked =
      (anonTasks?.length ?? 0) === 0 &&
      (anonDates?.length ?? 0) === 0 &&
      (anonCouples?.length ?? 0) === 0 &&
      (anonInvites?.length ?? 0) === 0;

    // 2. Direct client insert denial on tasks and dates (grants revoked for authenticated)
    const { error: partnerADirectTaskErr } = await clientA
      .from("couple_tasks")
      .insert({
        couple_id: PRIMARY_COUPLE.coupleId,
        created_by: PRIMARY_COUPLE.partnerA.id,
        title: "Direct task insert",
        category: "home",
        status: "open",
      });
    const directTaskInsertDenied = !!partnerADirectTaskErr && partnerADirectTaskErr.code === "42501";

    const { error: partnerADirectDateErr } = await clientA
      .from("couple_important_dates")
      .insert({
        couple_id: PRIMARY_COUPLE.coupleId,
        created_by: PRIMARY_COUPLE.partnerA.id,
        label: "Direct date insert",
        event_date: "2026-12-01",
      });
    const directDateInsertDenied = !!partnerADirectDateErr && partnerADirectDateErr.code === "42501";

    // 3. Cross-couple write by Partner C into Couple 1 invites (RLS check)
    const { error: partnerCInsertInviteErr } = await clientC
      .from("couple_invites")
      .insert({
        couple_id: PRIMARY_COUPLE.coupleId,
        created_by: SECOND_COUPLE.userX.id,
        code: `QA-MALICIOUS-${RUN_ID}`,
        status: "pending",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      });
    const partnerCInsertInviteDenied = !!partnerCInsertInviteErr && partnerCInsertInviteErr.code === "42501";

    // 4. Partner A cross-couple read on Couple 2
    const { data: partnerACouple2Dates } = await clientA
      .from("couple_important_dates")
      .select("*")
      .eq("couple_id", SECOND_COUPLE.coupleId);
    const partnerACannotReadCouple2 = (partnerACouple2Dates?.length ?? 0) === 0;

    // 5. Positive control in Couple 1: Partner A creates disposable invite, reads it, Partner B cannot read it, Partner A deletes it
    const dispCode = `QA-C5-${RUN_ID}`;
    const { data: dispInvite, error: dispInviteErr } = await clientA
      .from("couple_invites")
      .insert({
        couple_id: PRIMARY_COUPLE.coupleId,
        created_by: PRIMARY_COUPLE.partnerA.id,
        code: dispCode,
        status: "pending",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      })
      .select()
      .single();

    const dispInviteCreated = !dispInviteErr && !!dispInvite;

    // Partner A can read own invite
    const { data: partnerAReadInvite } = await clientA
      .from("couple_invites")
      .select("id, code")
      .eq("code", dispCode);
    const partnerAReadSuccess = (partnerAReadInvite?.length ?? 0) === 1;

    // Partner B cannot read Partner A's invite (policy: Creators can view their invites)
    const { data: partnerBReadInvite } = await clientB
      .from("couple_invites")
      .select("id, code")
      .eq("code", dispCode);
    const partnerBBlocked = (partnerBReadInvite?.length ?? 0) === 0;

    // Partner C cannot read Partner A's invite
    const { data: partnerCReadInvite } = await clientC
      .from("couple_invites")
      .select("id, code")
      .eq("code", dispCode);
    const partnerCBlocked = (partnerCReadInvite?.length ?? 0) === 0;

    // Clean up disposable invite
    if (dispInvite?.id) {
      queryDb(`DELETE FROM couple_invites WHERE id = '${dispInvite.id}';`);
    }

    const c5_1_pass =
      anonSharedBlocked &&
      directTaskInsertDenied &&
      directDateInsertDenied &&
      partnerCInsertInviteDenied &&
      partnerACannotReadCouple2 &&
      dispInviteCreated &&
      partnerAReadSuccess &&
      partnerBBlocked &&
      partnerCBlocked;

    console.log(`Anon shared space blocked: ${anonSharedBlocked}`);
    console.log(`Direct task insert denied (42501): ${directTaskInsertDenied}`);
    console.log(`Direct date insert denied (42501): ${directDateInsertDenied}`);
    console.log(`Partner C insert into Couple 1 invites denied: ${partnerCInsertInviteDenied}`);
    console.log(`Partner A cannot read Couple 2 shared space: ${partnerACannotReadCouple2}`);
    console.log(`Couple 1 invite positive control & isolation: ${dispInviteCreated && partnerAReadSuccess && partnerBBlocked && partnerCBlocked}`);

    report.c5_1_crossDomainAccess = {
      status: c5_1_pass ? "PASS" : "FAIL",
      details: {
        anonSharedBlocked,
        directTaskInsertDenied,
        directDateInsertDenied,
        partnerCInsertInviteDenied,
        partnerCInsertInviteError: partnerCInsertInviteErr?.message,
        partnerACannotReadCouple2,
        dispInviteCreated,
        partnerAReadSuccess,
        partnerBBlocked,
        partnerCBlocked,
      },
    };

    // ------------------------------------------------------------------------
    // C5.2: RPC / Definer Security
    // ------------------------------------------------------------------------
    console.log("\n--- Scenario C5.2: RPC / Definer Security ---");

    // 1. get_partner_display_name() evaluations
    const { data: anonPartnerName, error: anonPartnerNameErr } = await anonClient.rpc("get_partner_display_name");
    const anonPartnerNameSafe = anonPartnerName === null;

    const { data: singleMemberPartnerName } = await clientC.rpc("get_partner_display_name");
    const singleMemberPartnerNameNull = singleMemberPartnerName === null;

    const { data: partnerAPartnerName } = await clientA.rpc("get_partner_display_name");
    const partnerANameValid = partnerAPartnerName === PRIMARY_COUPLE.partnerB.displayName;

    // 2. set_moment_visibility evaluations
    const { error: nonCreatorSetVisErr } = await clientB.rpc("set_moment_visibility", {
      p_event_id: PRIMARY_COUPLE.targetEventId,
      p_visibility: "mine",
    });
    const nonCreatorSetVisDenied = !!nonCreatorSetVisErr && (
      nonCreatorSetVisErr.message.includes("Event unavailable") ||
      nonCreatorSetVisErr.message.includes("Only the event creator can change visibility")
    );

    const { error: foreignSetVisErr } = await clientC.rpc("set_moment_visibility", {
      p_event_id: PRIMARY_COUPLE.targetEventId,
      p_visibility: "mine",
    });
    const foreignSetVisDenied = !!foreignSetVisErr && foreignSetVisErr.message.includes("Event unavailable");

    // 3. mark_relationship_event_attention_opened evaluations
    const { error: foreignAttentionErr } = await clientC.rpc("mark_relationship_event_attention_opened", {
      p_event_id: PRIMARY_COUPLE.targetEventId,
    });
    const foreignAttentionDenied = !!foreignAttentionErr && foreignAttentionErr.message.includes("Relationship membership required");

    const { error: anonAttentionErr } = await anonClient.rpc("mark_relationship_event_attention_opened", {
      p_event_id: PRIMARY_COUPLE.targetEventId,
    });
    const anonAttentionDenied = !!anonAttentionErr && (
      anonAttentionErr.message.includes("permission denied for function") ||
      anonAttentionErr.message.includes("Authentication required")
    );

    const c5_2_pass =
      anonPartnerNameSafe &&
      singleMemberPartnerNameNull &&
      partnerANameValid &&
      nonCreatorSetVisDenied &&
      foreignSetVisDenied &&
      foreignAttentionDenied &&
      anonAttentionDenied;

    console.log(`Anon get_partner_display_name returned null: ${anonPartnerNameSafe}`);
    console.log(`Single-member get_partner_display_name returned null: ${singleMemberPartnerNameNull}`);
    console.log(`Partner A get_partner_display_name: ${partnerAPartnerName}`);
    console.log(`Non-creator set_moment_visibility denied: ${nonCreatorSetVisDenied}`);
    console.log(`Foreign set_moment_visibility denied: ${foreignSetVisDenied}`);
    console.log(`Foreign attention opened RPC denied: ${foreignAttentionDenied}`);
    console.log(`Anon attention opened RPC denied: ${anonAttentionDenied}`);

    report.c5_2_rpcDefinerSecurity = {
      status: c5_2_pass ? "PASS" : "FAIL",
      details: {
        anonPartnerNameSafe,
        singleMemberPartnerNameNull,
        partnerAPartnerName,
        nonCreatorSetVisDenied,
        nonCreatorSetVisError: nonCreatorSetVisErr?.message,
        foreignSetVisDenied,
        foreignSetVisError: foreignSetVisErr?.message,
        foreignAttentionDenied,
        foreignAttentionError: foreignAttentionErr?.message,
        anonAttentionDenied,
        anonAttentionError: anonAttentionErr?.message,
      },
    };

    // ------------------------------------------------------------------------
    // C5.3: Relationship Membership Edge Cases
    // ------------------------------------------------------------------------
    console.log("\n--- Scenario C5.3: Relationship Membership Edge Cases ---");

    // 1. Single-member couple (Couple 2 / Partner C) attempting repair lifecycle
    const { data: dispCEvent, error: dispCErr } = await clientC
      .from("relationship_events")
      .insert({
        couple_id: SECOND_COUPLE.coupleId,
        creator_id: SECOND_COUPLE.userX.id,
        event_type: "friction",
        category: "communication",
        intensity: 2,
        visibility: "ours",
        status: "open",
        repair_method: "talking",
        shared_topic: `QA C5 Disposable Partner C Friction [${RUN_ID}]`,
      })
      .select()
      .single();

    if (dispCErr || !dispCEvent) {
      throw new Error(`Failed to create Partner C disposable event: ${dispCErr?.message}`);
    }

    // Attempt arrival as creator in single-member couple -> MUST FAIL
    const { error: arrivalInSingleErr } = await clientC.rpc("submit_repair_response", {
      p_event_id: dispCEvent.id,
      p_phase: "arrival",
      p_response_code: "heard",
    });
    const arrivalInSingleDenied = !!arrivalInSingleErr && arrivalInSingleErr.message.includes("Only the recipient may submit an arrival response");

    // Attempt completion in single-member couple -> MUST FAIL
    const { error: compInSingleErr } = await clientC.rpc("complete_repair_reconnection", {
      p_event_id: dispCEvent.id,
      p_takeaway_tag: "talking_it_through",
    });
    const compInSingleDenied = !!compInSingleErr && (
      compInSingleErr.message.includes("Reconnection requires an active two-partner space") ||
      compInSingleErr.message.includes("Event must be in care (partially_repaired) before completion")
    );

    // Clean up Partner C event
    await clientC.from("relationship_events").delete().eq("id", dispCEvent.id);

    // 2. Foreign couple ID injection attempts
    const { error: foreignCoupleEventErr } = await clientA
      .from("relationship_events")
      .insert({
        couple_id: SECOND_COUPLE.coupleId, // Injected Couple 2 ID
        creator_id: PRIMARY_COUPLE.partnerA.id,
        event_type: "friction",
        category: "communication",
        intensity: 2,
        visibility: "ours",
        status: "open",
        repair_method: "talking",
        shared_topic: "Spoofed couple event",
      });
    const foreignCoupleEventDenied = !!foreignCoupleEventErr && foreignCoupleEventErr.code === "42501";

    const { error: foreignCoupleDateErr } = await clientA
      .from("couple_important_dates")
      .insert({
        couple_id: SECOND_COUPLE.coupleId, // Injected Couple 2 ID
        created_by: PRIMARY_COUPLE.partnerA.id,
        label: "Spoofed date",
        event_date: "2026-12-01",
      });
    const foreignCoupleDateDenied = !!foreignCoupleDateErr && foreignCoupleDateErr.code === "42501";

    const c5_3_pass =
      arrivalInSingleDenied &&
      compInSingleDenied &&
      foreignCoupleEventDenied &&
      foreignCoupleDateDenied;

    console.log(`Single-member arrival denied: ${arrivalInSingleDenied} (${arrivalInSingleErr?.message})`);
    console.log(`Single-member completion denied: ${compInSingleDenied} (${compInSingleErr?.message})`);
    console.log(`Foreign couple event injection denied: ${foreignCoupleEventDenied} (${foreignCoupleEventErr?.message})`);
    console.log(`Foreign couple date injection denied: ${foreignCoupleDateDenied} (${foreignCoupleDateErr?.message})`);

    report.c5_3_relationshipMembershipEdgeCases = {
      status: c5_3_pass ? "PASS" : "FAIL",
      details: {
        arrivalInSingleDenied,
        arrivalInSingleError: arrivalInSingleErr?.message,
        compInSingleDenied,
        compInSingleError: compInSingleErr?.message,
        foreignCoupleEventDenied,
        foreignCoupleEventError: foreignCoupleEventErr?.message,
        foreignCoupleDateDenied,
        foreignCoupleDateError: foreignCoupleDateErr?.message,
      },
    };

    // ------------------------------------------------------------------------
    // C5.4: Storage and Realtime Security
    // ------------------------------------------------------------------------
    console.log("\n--- Scenario C5.4: Storage and Realtime Security ---");

    // 1. Anon storage read
    const { data: anonStorageData, error: anonStorageErr } = await anonClient.storage
      .from("profile-media")
      .list();
    const anonStorageBlocked = !anonStorageData || anonStorageData.length === 0 || !!anonStorageErr;

    // 2. Partner A attempts to list Partner B's personal path
    const { data: partnerAListPartnerB, error: partnerAListPartnerBErr } = await clientA.storage
      .from("profile-media")
      .list(`personal/${PRIMARY_COUPLE.partnerB.id}`);
    const partnerAListPartnerBBlocked = !partnerAListPartnerB || partnerAListPartnerB.length === 0;

    // 3. Partner A attempts to upload to Partner B's personal path
    const dummyBlob = Buffer.from("fake-image-bytes");
    const { error: partnerAUploadPartnerBErr } = await clientA.storage
      .from("profile-media")
      .upload(`personal/${PRIMARY_COUPLE.partnerB.id}/malicious.png`, dummyBlob, {
        contentType: "image/png",
      });
    const partnerAUploadPartnerBDenied = !!partnerAUploadPartnerBErr;

    // 4. Partner C attempts to list Couple 1's couple image path
    const { data: partnerCListCouple1, error: partnerCListCouple1Err } = await clientC.storage
      .from("profile-media")
      .list(`couples/${PRIMARY_COUPLE.coupleId}`);
    const partnerCListCouple1Blocked = !partnerCListCouple1 || partnerCListCouple1.length === 0;

    // 5. Realtime publication audit
    const realtimeTablesRaw = queryDb("SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';");
    const realtimeTables = realtimeTablesRaw.split("\n").map((t) => t.trim());
    const privateReflectionsExcludedFromRealtime = !realtimeTables.includes("event_private_reflections");
    const weeklyReflectionsExcludedFromRealtime = !realtimeTables.includes("weekly_reflections");

    const c5_4_pass =
      anonStorageBlocked &&
      partnerAListPartnerBBlocked &&
      partnerAUploadPartnerBDenied &&
      partnerCListCouple1Blocked &&
      privateReflectionsExcludedFromRealtime &&
      weeklyReflectionsExcludedFromRealtime;

    console.log(`Anon storage listing blocked: ${anonStorageBlocked}`);
    console.log(`Partner A listing Partner B personal media blocked: ${partnerAListPartnerBBlocked}`);
    console.log(`Partner A upload to Partner B path denied: ${partnerAUploadPartnerBDenied} (${partnerAUploadPartnerBErr?.message})`);
    console.log(`Partner C listing Couple 1 media blocked: ${partnerCListCouple1Blocked}`);
    console.log(`Private reflections excluded from realtime: ${privateReflectionsExcludedFromRealtime}`);
    console.log(`Weekly reflections excluded from realtime: ${weeklyReflectionsExcludedFromRealtime}`);

    report.c5_4_storageAndRealtimeSecurity = {
      status: c5_4_pass ? "PASS" : "FAIL",
      details: {
        anonStorageBlocked,
        partnerAListPartnerBBlocked,
        partnerAUploadPartnerBDenied,
        partnerAUploadPartnerBError: partnerAUploadPartnerBErr?.message,
        partnerCListCouple1Blocked,
        realtimeTables,
        privateReflectionsExcludedFromRealtime,
        weeklyReflectionsExcludedFromRealtime,
      },
    };

    // ------------------------------------------------------------------------
    // C5.5: Auth, Network & Config Exposure
    // ------------------------------------------------------------------------
    console.log("\n--- Scenario C5.5: Auth, Network & Config Exposure ---");

    // Check for hardcoded service_role keys in source code
    let serviceRoleKeyFoundInSrc = false;
    try {
      const srcGrep = execSync('grep -rn "service_role" src/ 2>/dev/null || true', { encoding: "utf8" });
      serviceRoleKeyFoundInSrc = srcGrep.trim().length > 0;
    } catch {
      serviceRoleKeyFoundInSrc = false;
    }

    const zeroRemoteCalls = networkAudit.remoteRequestsDetected.length === 0;

    const c5_5_pass = !serviceRoleKeyFoundInSrc && zeroRemoteCalls;

    console.log(`Service role key in src: ${serviceRoleKeyFoundInSrc ? "LEAK DETECTED" : "NONE (CLEAN)"}`);
    console.log(`Zero remote requests detected: ${zeroRemoteCalls} (Total local requests: ${networkAudit.localRequests})`);

    report.c5_5_authAndDataExposure = {
      status: c5_5_pass ? "PASS" : "FAIL",
      details: {
        serviceRoleKeyInSource: serviceRoleKeyFoundInSrc,
        zeroRemoteCalls,
        totalLocalRequests: networkAudit.localRequests,
      },
    };

    // ------------------------------------------------------------------------
    // C5.6: Regression & Integrity
    // ------------------------------------------------------------------------
    console.log("\n--- Scenario C5.6: Regression & Historical Integrity ---");

    const currentEventRaw = queryDb(`SELECT id, status, reconnected_at, created_at FROM relationship_events WHERE id = '${PRIMARY_COUPLE.targetEventId}';`);
    const currentResponsesRaw = queryDb(`SELECT count(*) FROM relationship_event_repair_responses WHERE event_id = '${PRIMARY_COUPLE.targetEventId}';`);
    const currentOutcomesRaw = queryDb(`SELECT count(*) FROM relationship_event_repair_outcomes WHERE event_id = '${PRIMARY_COUPLE.targetEventId}';`);
    const currentWeeklyRaw = queryDb(`SELECT id, user_id, updated_at FROM weekly_reflections WHERE id = '${PRIMARY_COUPLE.targetWeeklyId}';`);
    const currentReceiptsCount = queryDb(`SELECT count(*) FROM home_activity_receipts;`);
    const leftoverDisposable = queryDb(`SELECT count(*) FROM relationship_events WHERE shared_topic LIKE 'QA C5 Disposable%';`);
    const leftoverInvites = queryDb(`SELECT count(*) FROM couple_invites WHERE code LIKE 'QA-C5-%';`);

    const eventUnchanged = currentEventRaw === report.historicalBaseline.event;
    const responsesUnchanged = parseInt(currentResponsesRaw, 10) === report.historicalBaseline.responsesCount;
    const outcomesUnchanged = parseInt(currentOutcomesRaw, 10) === report.historicalBaseline.outcomesCount;
    const weeklyUnchanged = currentWeeklyRaw === report.historicalBaseline.weekly;
    const receiptsCountUnchanged = parseInt(currentReceiptsCount, 10) === report.historicalBaseline.receiptsCount;
    const fixturesClean = parseInt(leftoverDisposable, 10) === 0 && parseInt(leftoverInvites, 10) === 0;

    const c5_6_pass =
      eventUnchanged &&
      responsesUnchanged &&
      outcomesUnchanged &&
      weeklyUnchanged &&
      receiptsCountUnchanged &&
      fixturesClean &&
      zeroRemoteCalls;

    console.log(`Historical event unchanged: ${eventUnchanged}`);
    console.log(`Historical responses unchanged: ${responsesUnchanged}`);
    console.log(`Historical outcomes unchanged: ${outcomesUnchanged}`);
    console.log(`Historical weekly reflection unchanged: ${weeklyUnchanged}`);
    console.log(`Receipts count unchanged: ${receiptsCountUnchanged} (${currentReceiptsCount})`);
    console.log(`Disposable fixtures clean: ${fixturesClean}`);

    report.c5_6_regressionAndIntegrity = {
      status: c5_6_pass ? "PASS" : "FAIL",
      details: {
        historicalEventUnchanged: eventUnchanged,
        historicalResponsesCountUnchanged: responsesUnchanged,
        historicalOutcomesCountUnchanged: outcomesUnchanged,
        historicalWeeklyUnchanged: weeklyUnchanged,
        receiptsCountUnchanged,
        disposableFixturesClean: fixturesClean,
        zeroRemoteCalls,
        totalLocalRequests: networkAudit.localRequests,
      },
    };

    console.log("\n=======================================================");
    console.log(`C5.1 Cross-Domain Access:          ${report.c5_1_crossDomainAccess.status}`);
    console.log(`C5.2 RPC / Definer Security:        ${report.c5_2_rpcDefinerSecurity.status}`);
    console.log(`C5.3 Membership Edge Cases:         ${report.c5_3_relationshipMembershipEdgeCases.status}`);
    console.log(`C5.4 Storage & Realtime Security:   ${report.c5_4_storageAndRealtimeSecurity.status}`);
    console.log(`C5.5 Auth & Data Exposure:          ${report.c5_5_authAndDataExposure.status}`);
    console.log(`C5.6 Regression & Integrity:        ${report.c5_6_regressionAndIntegrity.status}`);
    console.log("=======================================================\n");

  } catch (err) {
    console.error("FATAL ERROR during Scenario C5:", err);
    report.fatalError = {
      message: err.message,
      stack: err.stack,
    };
  } finally {
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), "utf8");
    console.log(`Report written to ${REPORT_FILE}`);
  }
}

runScenarioC5();
