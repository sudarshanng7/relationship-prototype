import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ARTIFACT_DIR = path.resolve("test-results/phase3b");
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, "screenshots");
const REPORT_FILE = path.join(ARTIFACT_DIR, "scenario-b4-report.json");
const APP_URL = "http://127.0.0.1:8081";
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

const TARGET_EVENT = {
  id: "c6ff8008-cba9-4bb1-ad74-335ae9d4a635",
  category: "household",
  categoryLabel: "Household",
  intensity: 3,
  visibility: "ours",
  status: "partially_repaired",
  privateReflectionText: "QA-3B-mwtpz5lx-B1-PRIVATE: Noticed chores feeling unbalanced this week",
  sharedTopicText: "QA-3B-mwtpz5lx-B1-OURS: Can we look at our chores routine together tonight?",
  takeawayTag: "talking_it_through",
  takeawayNote: "QA-3B-B4: Taking gentle time to hear each other helped us soften.",
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

function getExpoProcess() {
  let pid = null;
  try {
    const lsofOut = execSync("lsof -ti :8081 2>/dev/null", { encoding: "utf8" }).trim();
    if (lsofOut) pid = parseInt(lsofOut.split("\n")[0], 10);
  } catch {}
  return pid;
}

function getProcessMemory(pid) {
  if (!pid) return { rssMb: 0, vszMb: 0 };
  try {
    const psOut = execSync(`ps -p ${pid} -o rss,vsz --no-headers`, { encoding: "utf8" }).trim();
    if (psOut) {
      const parts = psOut.split(/\s+/).filter(Boolean);
      return {
        rssMb: Math.round((parseInt(parts[0], 10) || 0) / 1024),
        vszMb: Math.round((parseInt(parts[1], 10) || 0) / 1024),
      };
    }
  } catch {}
  return { rssMb: 0, vszMb: 0 };
}

function checkExpoMemoryGuard() {
  const pid = getExpoProcess();
  const mem = getProcessMemory(pid);
  if (mem.rssMb > 2900) {
    console.error(`[MEMORY GUARD] Stopping execution: Expo RSS reached ${mem.rssMb} MB near max-old-space-size=3072.`);
    return false;
  }
  return true;
}

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function runScenarioB4() {
  console.log("=== PURPLE GARDEN: PHASE 3B / SCENARIO B4: MUTUAL READINESS & RECONNECTION ===");
  console.log(`Timestamp: ${new Date().toISOString()} | RUN_ID: ${RUN_ID}`);

  // Pre-flight checks
  const expoPid = getExpoProcess();
  console.log(`Expo PID: ${expoPid || "UNKNOWN"}`);
  if (!expoPid) {
    console.error("[BLOCKED] Expo server process not detected on port 8081.");
    process.exit(2);
  }

  const expoMemPre = getProcessMemory(expoPid);
  console.log(`Initial Expo RSS: ${expoMemPre.rssMb} MB | VSZ: ${expoMemPre.vszMb} MB`);
  if (expoMemPre.rssMb > 2800) {
    console.error(`[BLOCKED] Expo RSS is in memory exhaustion danger region (${expoMemPre.rssMb} MB).`);
    process.exit(2);
  }

  let expoHealth = "000";
  try {
    expoHealth = execSync("curl -s -m 15 -o /dev/null -w \"%{http_code}\" http://127.0.0.1:8081", { encoding: "utf8" }).trim();
  } catch {}
  console.log(`Expo Health Check: HTTP ${expoHealth}`);
  if (expoHealth !== "200") {
    console.error(`[BLOCKED] Expo responded with status ${expoHealth}, expected 200.`);
    process.exit(2);
  }

  // Pre-check target event state in PostgreSQL
  const preCheckEvent = queryDb(`
    SELECT id, couple_id, creator_id, event_type, category, status, visibility, reconnected_at
    FROM public.relationship_events
    WHERE id = '${TARGET_EVENT.id}';
  `);
  console.log(`Target event pre-check: ${preCheckEvent}`);
  if (!preCheckEvent || !preCheckEvent.includes("partially_repaired") || !preCheckEvent.includes("ours")) {
    console.error(`[BLOCKED] Target event ${TARGET_EVENT.id} is not in expected 'partially_repaired' state.`);
    process.exit(2);
  }

  // Pre-check repair responses: must have arrival from B and settlement from A
  const preResponses = queryDb(`
    SELECT count(*) FROM public.relationship_event_repair_responses WHERE event_id = '${TARGET_EVENT.id}';
  `);
  console.log(`Existing repair responses count: ${preResponses}`);
  if (parseInt(preResponses, 10) !== 2) {
    console.error(`[BLOCKED] Expected exactly 2 repair responses from B3, found: ${preResponses}`);
    process.exit(2);
  }

  const preOutcomes = queryDb(`
    SELECT count(*) FROM public.relationship_event_repair_outcomes WHERE event_id = '${TARGET_EVENT.id}';
  `);
  console.log(`Existing repair outcomes count: ${preOutcomes}`);
  if (parseInt(preOutcomes, 10) !== 0) {
    console.error(`[BLOCKED] Expected 0 repair outcomes, found: ${preOutcomes}`);
    process.exit(2);
  }

  const networkAudit = {
    remoteRequestsDetected: [],
    localSupabaseRequests: [],
    totalRequests: 0,
  };

  const extraLibPath = "/tmp/playwright-libs/usr/lib/x86_64-linux-gnu";
  const env = fs.existsSync(extraLibPath)
    ? { ...process.env, LD_LIBRARY_PATH: `${extraLibPath}:${process.env.LD_LIBRARY_PATH || ""}` }
    : process.env;

  const browser = await chromium.launch({
    headless: true,
    env,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  function attachNetworkAuditing(page, contextName) {
    page.on("request", (req) => {
      networkAudit.totalRequests++;
      const url = req.url();
      if (url.includes("supabase.co") || url.includes("taxxvpkgzyevrhbytlqi")) {
        console.error(`[CRITICAL LEAK] Remote Supabase call detected from ${contextName}: ${url}`);
        networkAudit.remoteRequestsDetected.push({ context: contextName, url, method: req.method() });
      } else if (url.includes(LOCAL_SUPABASE_HOST) || url.includes("54321")) {
        networkAudit.localSupabaseRequests.push({ context: contextName, url, method: req.method() });
      }
    });
  }

  async function loginPartner(page, user, contextName) {
    page.setDefaultTimeout(30000);
    attachNetworkAuditing(page, contextName);

    await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector('input[type="email"], input[placeholder*="Email" i]', { timeout: 15000 });
    await page.waitForTimeout(500);

    const emailInput = page.locator('input[type="email"], input[placeholder*="Email" i]').first();
    const passwordInput = page.locator('input[type="password"], input[placeholder*="Password" i]').first();

    await emailInput.fill(user.email);
    await passwordInput.fill(user.password);
    await page.waitForTimeout(300);

    const signInBtn = page.locator('[aria-label="Sign in"]');
    await signInBtn.click();

    try {
      await page.waitForFunction(() => window.location.pathname.includes("/home") || document.body.innerText.includes("Signing in"), { timeout: 3000 });
    } catch {
      await signInBtn.click();
    }

    await page.waitForFunction(() => window.location.pathname.includes("/home"), { timeout: 20000 });
    await page.waitForSelector("text=What matters now, text=My Rhythm", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(800);

    const marker = `spa-${user.displayName.replace(/\s+/g, "_")}-${Date.now()}`;
    await page.evaluate((m) => { window.__spaSessionMarker = m; }, marker);
    return marker;
  }

  async function navigateToOurSpaceUI(page) {
    const oursTab = page.getByRole("button", { name: /^Our Space|^Moments/i }).first();
    if (await oursTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await oursTab.click();
    } else {
      const oursTile = page.locator('[aria-label="Open Ours, your shared space"]').first();
      if (await oursTile.isVisible({ timeout: 1500 }).catch(() => false)) {
        await oursTile.click();
      }
    }
    await page.waitForFunction(() => window.location.pathname.includes("/events"), { timeout: 10000 });
    await page.waitForTimeout(600);
  }

  async function navigateToEvent(page, eventId) {
    await navigateToOurSpaceUI(page);
    const card = page.locator(`[aria-label*="${TARGET_EVENT.categoryLabel}" i]`).first();
    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
      await card.click();
    } else {
      await page.evaluate((id) => {
        window.history.pushState({}, "", `/event/${id}?scope=ours&from=ours`);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, eventId);
    }
    await page.waitForFunction(() => window.location.pathname.includes("/event/"), { timeout: 10000 });
    await page.waitForTimeout(800);
  }

  const results = {
    runId: RUN_ID,
    timestamp: new Date().toISOString(),
    targetEvent: TARGET_EVENT,
    b4_1_partnerBClosingCheckin: { status: "PENDING", details: {} },
    b4_2_mixedReadinessGuardrail: { status: "PENDING", details: {} },
    b4_3_revisionToMutualReadiness: { status: "PENDING", details: {} },
    b4_4_explicitReconnectionCompletion: { status: "PENDING", details: {} },
    b4_5_historyPrivacyAndReload: { status: "PENDING", details: {} },
    b4_6_integrityAndNetwork: { status: "PENDING", details: {} },
    networkAudit,
    memory: {},
  };

  let contextA, contextB, pageA, pageB;

  try {
    console.log("\n[Setup] Authenticating Partner B and Partner A in separate contexts...");
    contextB = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    pageB = await contextB.newPage();
    const markerB = await loginPartner(pageB, QA_USERS.partnerB, "Partner B");
    console.log(`  Partner B authenticated (SPA Marker: ${markerB})`);

    contextA = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    pageA = await contextA.newPage();
    const markerA = await loginPartner(pageA, QA_USERS.partnerA, "Partner A");
    console.log(`  Partner A authenticated (SPA Marker: ${markerA})`);

    // =========================================================================
    // B4.1 — PARTNER B INDEPENDENT CLOSING CHECK-IN ('ready')
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B4.1: PARTNER B INDEPENDENT CLOSING CHECK-IN ('ready') ---");
    console.log("========================================================");

    console.log("  Navigating Partner B to event detail screen...");
    await navigateToEvent(pageB, TARGET_EVENT.id);

    // Partner B selects 'ready'
    console.log("  Partner B selecting '🌿 I feel ready to leave this here'...");
    const readyChoiceB = pageB.locator('[aria-label*="I feel ready to leave this here" i]').or(pageB.getByText("I feel ready to leave this here")).first();
    await readyChoiceB.click();
    await pageB.waitForTimeout(500);

    const shareWhereIAmBtnB = pageB.locator('[aria-label*="Share where I am" i]').or(pageB.getByText("Share where I am")).first();
    await shareWhereIAmBtnB.click();
    await pageB.waitForTimeout(1500);

    await pageB.waitForSelector('text=YOUR CHECK-IN, text=Revise where I am', { timeout: 10000 }).catch(() => {});
    await pageB.waitForTimeout(800);

    const ssPathB4_1 = path.join(SCREENSHOT_DIR, "B4-1-partner-b-ready-submitted.png");
    await pageB.screenshot({ path: ssPathB4_1 });

    const b4_1_ui = await pageB.evaluate(() => {
      const text = document.body.innerText || "";
      const showsYourCheckIn = text.includes("YOUR CHECK-IN");
      const showsReadyStatus = text.includes("Ready to leave this here") || text.includes("I feel ready to leave this here");
      const showsReviseButton = text.includes("Revise where I am");
      return { showsYourCheckIn, showsReadyStatus, showsReviseButton };
    });

    // DB verification for Partner B settlement
    const dbSettlementRowB = queryDb(`
      SELECT id, event_id, user_id, phase, response_code, shared_at
      FROM public.relationship_event_repair_responses
      WHERE event_id = '${TARGET_EVENT.id}' AND user_id = '${QA_USERS.partnerB.id}' AND phase = 'settlement';
    `);
    console.log(`  DB Settlement response row for Partner B: ${dbSettlementRowB}`);
    const dbSettlementPartsB = dbSettlementRowB.split("|");
    const dbHasSettlementB = dbSettlementPartsB.length >= 5 && dbSettlementPartsB[3] === "settlement" && dbSettlementPartsB[4] === "ready";

    const b4_1_pass = b4_1_ui.showsYourCheckIn && b4_1_ui.showsReadyStatus && dbHasSettlementB;
    results.b4_1_partnerBClosingCheckin = {
      status: b4_1_pass ? "PASS" : "FAIL",
      details: {
        ui: b4_1_ui,
        dbSettlementRowB,
        screenshot: ssPathB4_1,
      },
    };
    console.log(`>>> B4.1 RESULT: [${results.b4_1_partnerBClosingCheckin.status}] <<<`);

    // =========================================================================
    // B4.2 — MIXED READINESS GUARDRAIL (Partner A: reconnecting, Partner B: ready)
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B4.2: MIXED READINESS GUARDRAIL ---");
    console.log("========================================================");

    // Check Partner B's screen: Partner B should see Partner A's 'reconnecting' notice
    const b4_2_screenB = await pageB.evaluate(() => {
      const text = document.body.innerText || "";
      const hasConnectionFindingWay = text.includes("The issue feels settled, but connection is still finding its way") || text.includes("Settled, still reconnecting");
      const hasCompleteReconnection = text.includes("Complete reconnection");
      const hasBothReady = text.includes("You both feel ready") || text.includes("Both of you feel ready");
      return { hasConnectionFindingWay, hasCompleteReconnection, hasBothReady };
    });

    console.log(`  Partner B screen in mixed readiness:`);
    console.log(`    - Shows partner's reconnecting status: ${b4_2_screenB.hasConnectionFindingWay}`);
    console.log(`    - NO 'Complete reconnection' action: ${!b4_2_screenB.hasCompleteReconnection}`);
    console.log(`    - NO 'both ready' headline: ${!b4_2_screenB.hasBothReady}`);

    // Check Partner A's screen
    console.log("  Navigating Partner A to event detail screen...");
    await navigateToEvent(pageA, TARGET_EVENT.id);

    const ssPathB4_2 = path.join(SCREENSHOT_DIR, "B4-2-mixed-readiness-guardrail.png");
    await pageA.screenshot({ path: ssPathB4_2 });

    const b4_2_screenA = await pageA.evaluate(() => {
      const text = document.body.innerText || "";
      const seesPartnerBReady = text.includes("Ready to leave this here") || text.includes("I feel ready to leave this here");
      const seesOwnReconnecting = text.includes("The issue feels settled, but I’m still reconnecting") || text.includes("Settled, still reconnecting");
      const hasCompleteReconnection = text.includes("Complete reconnection");
      const hasBothReady = text.includes("Both of you feel ready") || text.includes("You both feel ready");
      return { seesPartnerBReady, seesOwnReconnecting, hasCompleteReconnection, hasBothReady };
    });

    console.log(`  Partner A screen in mixed readiness:`);
    console.log(`    - Sees Partner B's ready status: ${b4_2_screenA.seesPartnerBReady}`);
    console.log(`    - Sees own reconnecting status: ${b4_2_screenA.seesOwnReconnecting}`);
    console.log(`    - NO premature 'Complete reconnection': ${!b4_2_screenA.hasCompleteReconnection}`);
    console.log(`    - NO premature 'both ready' notice: ${!b4_2_screenA.hasBothReady}`);

    // DB state check: event must remain partially_repaired, outcomes = 0
    const dbEventStatusMixed = queryDb(`
      SELECT status, reconnected_at, repair_method
      FROM public.relationship_events
      WHERE id = '${TARGET_EVENT.id}';
    `);
    const statusPartsMixed = dbEventStatusMixed.split("|");
    const isStillPartiallyRepaired = statusPartsMixed[0] === "partially_repaired";
    const reconnectedAtNull = !statusPartsMixed[1] || statusPartsMixed[1].trim() === "";
    const outcomesCountMixed = parseInt(queryDb(`SELECT count(*) FROM public.relationship_event_repair_outcomes WHERE event_id = '${TARGET_EVENT.id}';`), 10);

    console.log(`  DB mixed readiness check:`);
    console.log(`    - Status is 'partially_repaired': ${isStillPartiallyRepaired}`);
    console.log(`    - reconnected_at IS NULL: ${reconnectedAtNull}`);
    console.log(`    - Outcomes count is 0: ${outcomesCountMixed === 0}`);

    const b4_2_pass = !b4_2_screenB.hasCompleteReconnection &&
                      !b4_2_screenA.hasCompleteReconnection &&
                      !b4_2_screenA.hasBothReady &&
                      isStillPartiallyRepaired &&
                      reconnectedAtNull &&
                      outcomesCountMixed === 0;

    results.b4_2_mixedReadinessGuardrail = {
      status: b4_2_pass ? "PASS" : "FAIL",
      details: {
        screenB: b4_2_screenB,
        screenA: b4_2_screenA,
        dbStatus: dbEventStatusMixed,
        outcomesCount: outcomesCountMixed,
        screenshot: ssPathB4_2,
      },
    };
    console.log(`>>> B4.2 RESULT: [${results.b4_2_mixedReadinessGuardrail.status}] <<<`);

    // =========================================================================
    // B4.3 — REVISION TO MUTUAL READINESS (Partner A revises to 'ready')
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B4.3: REVISION TO MUTUAL READINESS ---");
    console.log("========================================================");

    console.log("  Partner A clicking 'Revise where I am'...");
    const reviseBtnA = pageA.locator('[aria-label*="Revise where I am" i]').or(pageA.getByText("Revise where I am")).first();
    await reviseBtnA.click();
    await pageA.waitForTimeout(600);

    console.log("  Partner A selecting '🌿 I feel ready to leave this here'...");
    const readyChoiceA = pageA.locator('[aria-label*="I feel ready to leave this here" i]').or(pageA.getByText("I feel ready to leave this here")).first();
    await readyChoiceA.click();
    await pageA.waitForTimeout(500);

    console.log("  Partner A clicking 'Update where I am'...");
    const updateBtnA = pageA.locator('[aria-label*="Update where I am" i]').or(pageA.getByText("Update where I am")).first();
    await updateBtnA.click();
    await pageA.waitForTimeout(1500);

    await pageA.waitForSelector('text=MUTUAL READINESS, text=Gently close this moment, text=Complete reconnection', { timeout: 10000 }).catch(() => {});
    await pageA.waitForTimeout(800);

    const ssPathB4_3 = path.join(SCREENSHOT_DIR, "B4-3-mutual-readiness-unlocked.png");
    await pageA.screenshot({ path: ssPathB4_3 });

    // Check Partner A UI (Creator): mutual readiness prompt appeared
    const b4_3_uiA = await pageA.evaluate(() => {
      const text = document.body.innerText || "";
      const hasMutualReadiness = text.includes("MUTUAL READINESS");
      const hasGentlyClose = text.includes("Gently close this moment");
      const hasCompleteReconnectionBtn = text.includes("Complete reconnection");
      return { hasMutualReadiness, hasGentlyClose, hasCompleteReconnectionBtn };
    });

    console.log(`  Partner A UI (Creator) after revising to ready:`);
    console.log(`    - 'MUTUAL READINESS' visible: ${b4_3_uiA.hasMutualReadiness}`);
    console.log(`    - 'Gently close this moment' visible: ${b4_3_uiA.hasGentlyClose}`);
    console.log(`    - 'Complete reconnection' button available: ${b4_3_uiA.hasCompleteReconnectionBtn}`);

    // DB settlement responses check: both must be 'ready'
    const dbSettlementRows = queryDb(`
      SELECT user_id, phase, response_code
      FROM public.relationship_event_repair_responses
      WHERE event_id = '${TARGET_EVENT.id}' AND phase = 'settlement';
    `);
    console.log(`  Settlement responses in DB:\n${dbSettlementRows}`);
    const bothSettlementsReady = dbSettlementRows.includes("ready") && !dbSettlementRows.includes("reconnecting");

    // Event status in DB must STILL be partially_repaired (not auto-completed)
    const dbStatusPreComplete = queryDb(`
      SELECT status, reconnected_at FROM public.relationship_events WHERE id = '${TARGET_EVENT.id}';
    `);
    console.log(`  Event status before explicit completion: ${dbStatusPreComplete}`);
    const notAutoCompleted = dbStatusPreComplete.includes("partially_repaired") && !dbStatusPreComplete.includes("reconnected");

    const b4_3_pass = b4_3_uiA.hasMutualReadiness && b4_3_uiA.hasCompleteReconnectionBtn && bothSettlementsReady && notAutoCompleted;
    results.b4_3_revisionToMutualReadiness = {
      status: b4_3_pass ? "PASS" : "FAIL",
      details: {
        uiA: b4_3_uiA,
        dbSettlementRows,
        dbStatusPreComplete,
        screenshot: ssPathB4_3,
      },
    };
    console.log(`>>> B4.3 RESULT: [${results.b4_3_revisionToMutualReadiness.status}] <<<`);

    // =========================================================================
    // B4.4 — EXPLICIT RECONNECTION COMPLETION
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B4.4: EXPLICIT RECONNECTION COMPLETION ---");
    console.log("========================================================");

    // Partner A selects optional takeaway tag: "Talking it through"
    console.log(`  Partner A selecting takeaway tag: '${TARGET_EVENT.takeawayTag}'...`);
    const takeawayTagChip = pageA.locator('[aria-label="Talking it through"]').or(pageA.getByText("Talking it through")).first();
    if (await takeawayTagChip.isVisible({ timeout: 3000 }).catch(() => false)) {
      await takeawayTagChip.click();
      await pageA.waitForTimeout(400);
    }

    // Partner A enters optional takeaway note
    console.log(`  Partner A entering takeaway note: '${TARGET_EVENT.takeawayNote}'...`);
    const takeawayNoteInput = pageA.locator('textarea, input[placeholder*="What helped soften this moment" i]').first();
    if (await takeawayNoteInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await takeawayNoteInput.fill(TARGET_EVENT.takeawayNote);
      await pageA.waitForTimeout(400);
    }

    // Partner A clicks "Complete reconnection"
    console.log("  Partner A clicking 'Complete reconnection'...");
    const completeReconnectionBtn = pageA.locator('[aria-label="Complete reconnection"]').or(pageA.getByText("Complete reconnection")).first();
    await completeReconnectionBtn.click();
    await pageA.waitForTimeout(2500);

    // Wait for screen to update to reconnected state
    await pageA.waitForSelector('text=Reconnected, text=Talking it through', { timeout: 10000 }).catch(() => {});
    await pageA.waitForTimeout(800);

    const ssPathB4_4 = path.join(SCREENSHOT_DIR, "B4-4-reconnection-completed.png");
    await pageA.screenshot({ path: ssPathB4_4 });

    const b4_4_uiA = await pageA.evaluate(() => {
      const text = document.body.innerText || "";
      const showsReconnectedPill = text.includes("Reconnected");
      const showsTakeawayTag = text.includes("Talking it through");
      const showsTakeawayNote = text.includes("Taking gentle time to hear each other helped us soften");
      return { showsReconnectedPill, showsTakeawayTag, showsTakeawayNote };
    });

    console.log(`  Partner A UI after completion:`);
    console.log(`    - Shows 'Reconnected' status pill: ${b4_4_uiA.showsReconnectedPill}`);
    console.log(`    - Shows takeaway tag: ${b4_4_uiA.showsTakeawayTag}`);
    console.log(`    - Shows takeaway note: ${b4_4_uiA.showsTakeawayNote}`);

    // DB assertions
    const postEventRow = queryDb(`
      SELECT id, status, reconnected_at, repair_method
      FROM public.relationship_events
      WHERE id = '${TARGET_EVENT.id}';
    `);
    console.log(`  DB Event row after completion: ${postEventRow}`);
    const postParts = postEventRow.split("|");
    const isStatusReconnected = postParts[1] === "reconnected";
    const hasReconnectedAt = Boolean(postParts[2] && postParts[2].trim().length > 0);

    const outcomeRows = queryDb(`
      SELECT event_id, completed_by, takeaway_tag, takeaway_note, completed_at
      FROM public.relationship_event_repair_outcomes
      WHERE event_id = '${TARGET_EVENT.id}';
    `);
    console.log(`  DB Repair outcome row: ${outcomeRows}`);
    const outcomeParts = outcomeRows.split("|");
    const outcomeMatches = outcomeParts[0] === TARGET_EVENT.id &&
                           outcomeParts[1] === QA_USERS.partnerA.id &&
                           outcomeParts[2] === TARGET_EVENT.takeawayTag;

    const outcomeCount = parseInt(queryDb(`SELECT count(*) FROM public.relationship_event_repair_outcomes WHERE event_id = '${TARGET_EVENT.id}';`), 10);
    console.log(`  Total outcome records count (must be exactly 1): ${outcomeCount}`);

    const b4_4_pass = b4_4_uiA.showsReconnectedPill && isStatusReconnected && hasReconnectedAt && outcomeMatches && outcomeCount === 1;
    results.b4_4_explicitReconnectionCompletion = {
      status: b4_4_pass ? "PASS" : "FAIL",
      details: {
        uiA: b4_4_uiA,
        postEventRow,
        outcomeRows,
        outcomeCount,
        screenshot: ssPathB4_4,
      },
    };
    console.log(`>>> B4.4 RESULT: [${results.b4_4_explicitReconnectionCompletion.status}] <<<`);

    // =========================================================================
    // B4.5 — HISTORY, PRIVACY AND RELOAD
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B4.5: HISTORY, PRIVACY AND RELOAD ---");
    console.log("========================================================");

    // Hard page reload for Partner B to verify persistence
    console.log("  Hard reloading Partner B page and checking completed event...");
    await pageB.reload({ waitUntil: "domcontentloaded" });
    await pageB.waitForSelector('text=Reconnected, text=Talking it through', { timeout: 15000 }).catch(() => {});
    await pageB.waitForTimeout(1000);

    const bScreenPostReload = await pageB.evaluate((expectedPrivateText) => {
      const text = document.body.innerText || "";
      const showsReconnected = text.includes("Reconnected");
      const showsTakeawayTag = text.includes("Talking it through");
      const showsTakeawayNote = text.includes("Taking gentle time to hear each other helped us soften");
      const privateLeak = text.includes(expectedPrivateText);
      return { showsReconnected, showsTakeawayTag, showsTakeawayNote, privateLeak };
    }, TARGET_EVENT.privateReflectionText);

    console.log(`  Partner B View Post-Reload:`);
    console.log(`    - Shows 'Reconnected': ${bScreenPostReload.showsReconnected}`);
    console.log(`    - Shows shared takeaway: ${bScreenPostReload.showsTakeawayTag}`);
    console.log(`    - Partner A private reflection leaked in UI: ${bScreenPostReload.privateLeak} (must be false)`);

    // Hard page reload for Partner A to verify private reflection retained
    console.log("  Hard reloading Partner A page and checking completed event...");
    await pageA.reload({ waitUntil: "domcontentloaded" });
    await pageA.waitForSelector('text=Reconnected, text=Talking it through', { timeout: 15000 }).catch(() => {});
    await pageA.waitForTimeout(1000);

    const aScreenPostReload = await pageA.evaluate((expectedPrivateText) => {
      const text = document.body.innerText || "";
      const showsReconnected = text.includes("Reconnected");
      const showsPrivateReflection = text.includes(expectedPrivateText);
      return { showsReconnected, showsPrivateReflection };
    }, TARGET_EVENT.privateReflectionText);

    console.log(`  Partner A View Post-Reload:`);
    console.log(`    - Shows 'Reconnected': ${aScreenPostReload.showsReconnected}`);
    console.log(`    - Author private reflection intact: ${aScreenPostReload.showsPrivateReflection}`);

    // Check Our Space history for Partner B
    console.log("  Navigating Partner B to Our Space history via back button...");
    const backBtn = pageB.locator('[aria-label*="Back to Our Space" i]').or(pageB.getByText("‹ Back to Our Space")).first();
    if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await backBtn.click();
    } else {
      await pageB.evaluate(() => {
        window.history.pushState({}, "", "/events");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
    }
    await pageB.waitForFunction(() => window.location.pathname.includes("/events"), { timeout: 10000 });
    await pageB.waitForTimeout(1000);

    const ssPathB4_5 = path.join(SCREENSHOT_DIR, "B4-5-history-and-privacy.png");
    await pageB.screenshot({ path: ssPathB4_5 });

    const historyB = await pageB.evaluate(() => {
      const text = document.body.innerText || "";
      const hasHousehold = text.includes("Household");
      const hasReconnectedBadge = text.includes("Reconnected");
      return { hasHousehold, hasReconnectedBadge };
    });
    console.log(`  Our Space history list: Household card present (${historyB.hasHousehold}), Reconnected status (${historyB.hasReconnectedBadge})`);

    // Authenticated SDK RLS check
    console.log("  Querying authenticated Supabase clients for post-completion RLS audit...");
    const clientB = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY);
    await clientB.auth.signInWithPassword({
      email: QA_USERS.partnerB.email,
      password: QA_USERS.partnerB.password,
    });
    const { data: bReflections } = await clientB
      .from("event_private_reflections")
      .select("id, note")
      .eq("event_id", TARGET_EVENT.id);

    const { data: bOutcomes } = await clientB
      .from("relationship_event_repair_outcomes")
      .select("event_id, takeaway_tag, takeaway_note")
      .eq("event_id", TARGET_EVENT.id);

    const rls_b_privateBlocked = bReflections?.length === 0;
    const rls_b_outcomesAllowed = bOutcomes?.length === 1;

    console.log(`    - Partner B strictly blocked from Partner A private reflection (0 rows): ${rls_b_privateBlocked}`);
    console.log(`    - Partner B can access shared outcome (1 row): ${rls_b_outcomesAllowed}`);

    const b4_5_pass = bScreenPostReload.showsReconnected &&
                      !bScreenPostReload.privateLeak &&
                      aScreenPostReload.showsPrivateReflection &&
                      historyB.hasHousehold &&
                      rls_b_privateBlocked &&
                      rls_b_outcomesAllowed;

    results.b4_5_historyPrivacyAndReload = {
      status: b4_5_pass ? "PASS" : "FAIL",
      details: {
        screenB: bScreenPostReload,
        screenA: aScreenPostReload,
        historyB,
        rls_b_privateBlocked,
        rls_b_outcomesAllowed,
        screenshot: ssPathB4_5,
      },
    };
    console.log(`>>> B4.5 RESULT: [${results.b4_5_historyPrivacyAndReload.status}] <<<`);

    // =========================================================================
    // B4.6 — INTEGRITY & NETWORK AUDIT
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B4.6: INTEGRITY & NETWORK AUDIT ---");
    console.log("========================================================");

    const remoteLeaksCount = networkAudit.remoteRequestsDetected.length;
    console.log(`  Remote Supabase calls detected: ${remoteLeaksCount}`);
    console.log(`  Total local requests recorded: ${networkAudit.totalRequests}`);

    const b4_6_pass = remoteLeaksCount === 0;
    results.b4_6_integrityAndNetwork = {
      status: b4_6_pass ? "PASS" : "FAIL",
      details: {
        remoteLeaksCount,
        totalLocalRequests: networkAudit.totalRequests,
        remoteRequestsDetected: networkAudit.remoteRequestsDetected,
      },
    };
    console.log(`>>> B4.6 RESULT: [${results.b4_6_integrityAndNetwork.status}] <<<`);

  } catch (err) {
    console.error(`\n[FATAL ERROR in B4 Execution]: ${err.stack || err.message}`);
  } finally {
    if (pageA) await pageA.close().catch(() => {});
    if (pageB) await pageB.close().catch(() => {});
    if (contextA) await contextA.close().catch(() => {});
    if (contextB) await contextB.close().catch(() => {});
    await browser.close().catch(() => {});

    // Final memory audit
    const expoPidPost = getExpoProcess();
    const expoMemPost = getProcessMemory(expoPidPost);
    results.memory = {
      expoPid: expoPidPost,
      postRssMb: expoMemPost.rssMb,
      postVszMb: expoMemPost.vszMb,
    };
    console.log(`\nFinal Expo RSS: ${expoMemPost.rssMb} MB | VSZ: ${expoMemPost.vszMb} MB`);

    fs.writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2), "utf8");
    console.log(`\nScenario B4 report written to ${REPORT_FILE}`);
  }
}

runScenarioB4().catch((e) => {
  console.error("Unhandled top-level error:", e);
  process.exit(1);
});
