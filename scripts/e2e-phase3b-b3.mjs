import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ARTIFACT_DIR = path.resolve("test-results/phase3b");
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, "screenshots");
const REPORT_FILE = path.join(ARTIFACT_DIR, "scenario-b3-report.json");
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
  status: "open",
  privateReflectionText: "QA-3B-mwtpz5lx-B1-PRIVATE: Noticed chores feeling unbalanced this week",
  sharedTopicText: "QA-3B-mwtpz5lx-B1-OURS: Can we look at our chores routine together tonight?",
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

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function runScenarioB3() {
  console.log("=== PURPLE GARDEN: PHASE 3B / SCENARIO B3: INDEPENDENT PARTNER RESPONSES ===");
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

  // Confirm target event exists and is in status 'open'
  const preCheckEvent = queryDb(`
    SELECT id, couple_id, creator_id, event_type, category, status, visibility
    FROM public.relationship_events
    WHERE id = '${TARGET_EVENT.id}';
  `);
  console.log(`Target event pre-check: ${preCheckEvent}`);
  if (!preCheckEvent || !preCheckEvent.includes("open") || !preCheckEvent.includes("ours")) {
    console.error(`[BLOCKED] Target event ${TARGET_EVENT.id} is not in expected 'open' / 'ours' state.`);
    process.exit(2);
  }

  // Pre-check repair responses
  const preRepairCount = parseInt(queryDb(`SELECT count(*) FROM public.relationship_event_repair_responses WHERE event_id = '${TARGET_EVENT.id}';`), 10);
  console.log(`Pre-check repair responses count: ${preRepairCount}`);

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

  const results = {
    runId: RUN_ID,
    timestamp: new Date().toISOString(),
    targetEvent: TARGET_EVENT,
    b3_1_recipientResponseEntry: { status: "PENDING", details: {} },
    b3_2_partnerBIndependentResponse: { status: "PENDING", details: {} },
    b3_3_partnerAAuthorWorkflow: { status: "PENDING", details: {} },
    b3_4_authenticatedPrivacyAndAuthorization: { status: "PENDING", details: {} },
    b3_5_stateTransitionSafety: { status: "PENDING", details: {} },
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
    // B3.1 — RECIPIENT RESPONSE ENTRY (Partner B)
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B3.1: RECIPIENT RESPONSE ENTRY (PARTNER B) ---");
    console.log("========================================================");

    console.log("  Navigating Partner B to Our Space...");
    await navigateToOurSpaceUI(pageB);

    console.log(`  Navigating Partner B to event ${TARGET_EVENT.id} via in-app card click...`);
    // Find event card in Our Space
    const eventCardB = pageB.locator(`[aria-label*="${TARGET_EVENT.categoryLabel}" i], text=${TARGET_EVENT.categoryLabel}`).first();
    if (await eventCardB.isVisible({ timeout: 4000 }).catch(() => false)) {
      await eventCardB.click();
    } else {
      console.log("  Direct in-app route transition for Partner B...");
      await pageB.evaluate((id) => {
        window.history.pushState({}, "", `/event/${id}?scope=ours&from=ours`);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, TARGET_EVENT.id);
    }

    await pageB.waitForFunction(() => window.location.pathname.includes("/event/"), { timeout: 10000 });
    await pageB.waitForSelector("text=REPAIR JOURNEY, text=FIRST RESPONSE, text=What feels right", { timeout: 10000 }).catch(() => {});
    await pageB.waitForTimeout(800);

    const b3_1_url = pageB.url();
    const b3_1_matchesId = b3_1_url.includes(TARGET_EVENT.id);
    const ssPathB3_1 = path.join(SCREENSHOT_DIR, "B3-1-partner-b-response-entry.png");
    await pageB.screenshot({ path: ssPathB3_1 });

    const b3_1_screen = await pageB.evaluate(() => {
      const text = document.body.innerText || "";
      const hasRepairJourney = text.includes("REPAIR JOURNEY") || text.includes("FIRST RESPONSE");
      const hasHeardOption = text.includes("I’ve heard this");
      const hasNeedTimeOption = text.includes("I need a little more time");
      const hasSuggestStepOption = text.includes("suggest a small next step");
      return {
        hasRepairJourney,
        hasHeardOption,
        hasNeedTimeOption,
        hasSuggestStepOption,
        textSnippet: text.slice(0, 1200),
      };
    });

    console.log(`  Partner B Response Entry State:`);
    console.log(`    - URL matches target event ID: ${b3_1_matchesId}`);
    console.log(`    - Section D / First Response heading: ${b3_1_screen.hasRepairJourney}`);
    console.log(`    - Choice 1: 'I’ve heard this': ${b3_1_screen.hasHeardOption}`);
    console.log(`    - Choice 2: 'I need a little more time': ${b3_1_screen.hasNeedTimeOption}`);
    console.log(`    - Choice 3: 'Suggest a small next step': ${b3_1_screen.hasSuggestStepOption}`);

    const b3_1_pass = b3_1_matchesId && b3_1_screen.hasRepairJourney && b3_1_screen.hasHeardOption && b3_1_screen.hasNeedTimeOption && b3_1_screen.hasSuggestStepOption;
    results.b3_1_recipientResponseEntry = {
      status: b3_1_pass ? "PASS" : "FAIL",
      details: {
        url: b3_1_url,
        matchesId: b3_1_matchesId,
        hasRepairJourney: b3_1_screen.hasRepairJourney,
        hasHeardOption: b3_1_screen.hasHeardOption,
        hasNeedTimeOption: b3_1_screen.hasNeedTimeOption,
        hasSuggestStepOption: b3_1_screen.hasSuggestStepOption,
        screenshot: ssPathB3_1,
      },
    };
    console.log(`>>> B3.1 RESULT: [${results.b3_1_recipientResponseEntry.status}] <<<`);

    // =========================================================================
    // B3.2 — PARTNER B INDEPENDENT RESPONSE SUBMISSION
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B3.2: PARTNER B INDEPENDENT RESPONSE SUBMISSION ---");
    console.log("========================================================");

    console.log("  Partner B selecting 'I’ve heard this' choice card...");
    const heardChoiceCard = pageB.locator('[aria-label*="I’ve heard this" i]').or(pageB.getByText("I’ve heard this")).first();
    await heardChoiceCard.click();
    await pageB.waitForTimeout(600);

    // Look for confirmation button "Share with Partner A"
    const shareWithA_Btn = pageB.locator('[aria-label*="Share with Partner A" i]').or(pageB.getByText("Share with Partner A")).first();
    const isShareBtnVisible = await shareWithA_Btn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  'Share with Partner A' confirmation button visible: ${isShareBtnVisible}`);

    if (isShareBtnVisible) {
      console.log("  Clicking 'Share with Partner A'...");
      await shareWithA_Btn.click();
      await pageB.waitForTimeout(1500);
    } else {
      console.error("  'Share with Partner A' button not visible!");
    }

    // Wait for response display banner
    await pageB.waitForSelector('text=You shared: \'I’ve heard this\', text=Revise initial response', { timeout: 10000 }).catch(() => {});
    await pageB.waitForTimeout(800);

    const ssPathB3_2 = path.join(SCREENSHOT_DIR, "B3-2-partner-b-response-submitted.png");
    await pageB.screenshot({ path: ssPathB3_2 });

    const b3_2_screen = await pageB.evaluate(() => {
      const text = document.body.innerText || "";
      const showsSubmittedBanner = text.includes("You shared: 'I’ve heard this'") || text.includes("I’ve heard this");
      const showsReviseButton = text.includes("Revise initial response");
      const showsClosingCheckin = text.includes("CLOSING CHECK-IN") || text.includes("Where do you stand?");
      return {
        showsSubmittedBanner,
        showsReviseButton,
        showsClosingCheckin,
        textSnippet: text.slice(0, 1500),
      };
    });

    console.log(`  Partner B Post-Submission UI:`);
    console.log(`    - Submitted banner visible: ${b3_2_screen.showsSubmittedBanner}`);
    console.log(`    - Revise button visible: ${b3_2_screen.showsReviseButton}`);
    console.log(`    - Closing check-in stage unlocked: ${b3_2_screen.showsClosingCheckin}`);

    // Verify in PostgreSQL database
    const dbArrivalRows = queryDb(`
      SELECT id, event_id, user_id, phase, response_code, suggested_step_code, shared_at
      FROM public.relationship_event_repair_responses
      WHERE event_id = '${TARGET_EVENT.id}' AND user_id = '${QA_USERS.partnerB.id}' AND phase = 'arrival';
    `);
    console.log(`  DB Arrival response row for Partner B: ${dbArrivalRows}`);
    const dbArrivalParts = dbArrivalRows.split("|");
    const dbHasArrivalRow = dbArrivalParts.length >= 5 && dbArrivalParts[3] === "arrival" && dbArrivalParts[4] === "heard";

    // Verify event status transitioned to 'partially_repaired' (in care) and not prematurely reconnected
    const dbEventStatusAfterB = queryDb(`
      SELECT status, reconnected_at, repair_method
      FROM public.relationship_events
      WHERE id = '${TARGET_EVENT.id}';
    `);
    console.log(`  DB Event status after Partner B submission: ${dbEventStatusAfterB}`);
    const eventPartsAfterB = dbEventStatusAfterB.split("|");
    const statusInCareB = eventPartsAfterB[0] === "partially_repaired";
    const statusNotReconnectedB = eventPartsAfterB[0] !== "reconnected";
    const reconnectedAtNullB = !eventPartsAfterB[1] || eventPartsAfterB[1].trim() === "";

    console.log(`    - Status transitioned to 'partially_repaired' (In care): ${statusInCareB}`);
    console.log(`    - Status is NOT 'reconnected': ${statusNotReconnectedB}`);
    console.log(`    - reconnected_at is null: ${reconnectedAtNullB}`);

    const b3_2_pass = b3_2_screen.showsSubmittedBanner && dbHasArrivalRow && statusInCareB && statusNotReconnectedB && reconnectedAtNullB;
    results.b3_2_partnerBIndependentResponse = {
      status: b3_2_pass ? "PASS" : "FAIL",
      details: {
        showsSubmittedBanner: b3_2_screen.showsSubmittedBanner,
        showsReviseButton: b3_2_screen.showsReviseButton,
        showsClosingCheckin: b3_2_screen.showsClosingCheckin,
        dbArrivalRow: dbArrivalRows,
        dbEventStatus: dbEventStatusAfterB,
        screenshot: ssPathB3_2,
      },
    };
    console.log(`>>> B3.2 RESULT: [${results.b3_2_partnerBIndependentResponse.status}] <<<`);

    // =========================================================================
    // B3.3 — PARTNER A RESPONSE / ACKNOWLEDGEMENT & CLOSING CHECK-IN
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B3.3: PARTNER A AUTHOR WORKFLOW & CHECK-IN ---");
    console.log("========================================================");

    console.log("  Navigating Partner A to Our Space...");
    await navigateToOurSpaceUI(pageA);

    console.log(`  Navigating Partner A to event ${TARGET_EVENT.id} via in-app card click...`);
    const eventCardA = pageA.locator(`[aria-label*="${TARGET_EVENT.categoryLabel}" i], text=${TARGET_EVENT.categoryLabel}`).first();
    if (await eventCardA.isVisible({ timeout: 4000 }).catch(() => false)) {
      await eventCardA.click();
    } else {
      console.log("  Direct in-app route transition for Partner A...");
      await pageA.evaluate((id) => {
        window.history.pushState({}, "", `/event/${id}?scope=ours&from=ours`);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, TARGET_EVENT.id);
    }

    await pageA.waitForFunction(() => window.location.pathname.includes("/event/"), { timeout: 10000 });
    await pageA.waitForSelector("text=Partner B has heard this, text=CLOSING CHECK-IN", { timeout: 10000 }).catch(() => {});
    await pageA.waitForTimeout(800);

    const b3_3_url = pageA.url();
    const b3_3_matchesId = b3_3_url.includes(TARGET_EVENT.id);

    const aScreenInitial = await pageA.evaluate((expectedPrivateNote) => {
      const text = document.body.innerText || "";
      const seesPartnerBArrival = text.includes("Partner B has heard this");
      const seesPrivateReflection = text.includes(expectedPrivateNote);
      const seesClosingCheckin = text.includes("CLOSING CHECK-IN") || text.includes("Where do you stand?");
      const hasReconnectingChoice = text.includes("The issue feels settled, but I’m still reconnecting");
      return {
        seesPartnerBArrival,
        seesPrivateReflection,
        seesClosingCheckin,
        hasReconnectingChoice,
        textSnippet: text.slice(0, 1500),
      };
    }, TARGET_EVENT.privateReflectionText);

    console.log(`  Partner A Screen (Author View):`);
    console.log(`    - URL matches target event ID: ${b3_3_matchesId}`);
    console.log(`    - Sees 'Partner B has heard this' arrival notice: ${aScreenInitial.seesPartnerBArrival}`);
    console.log(`    - Author private reflection intact: ${aScreenInitial.seesPrivateReflection}`);
    console.log(`    - Closing check-in unlocked: ${aScreenInitial.seesClosingCheckin}`);
    console.log(`    - Has 'still reconnecting' choice: ${aScreenInitial.hasReconnectingChoice}`);

    // Now Partner A submits an independent closing check-in response ("reconnecting")
    console.log("  Partner A submitting closing check-in: 'The issue feels settled, but I’m still reconnecting'...");
    const reconnectingChoice = pageA.locator('[aria-label*="The issue feels settled, but I’m still reconnecting" i]').or(pageA.getByText("The issue feels settled, but I’m still reconnecting")).first();
    await reconnectingChoice.click();
    await pageA.waitForTimeout(500);

    const shareWhereIAm_Btn = pageA.locator('[aria-label*="Share where I am" i]').or(pageA.getByText("Share where I am")).first();
    const isShareWhereIAmVisible = await shareWhereIAm_Btn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  'Share where I am' button visible: ${isShareWhereIAmVisible}`);

    if (isShareWhereIAmVisible) {
      await shareWhereIAm_Btn.click();
      await pageA.waitForTimeout(1500);
    }

    await pageA.waitForSelector('text=YOUR CHECK-IN, text=Revise where I am', { timeout: 10000 }).catch(() => {});
    await pageA.waitForTimeout(800);

    const ssPathB3_3 = path.join(SCREENSHOT_DIR, "B3-3-partner-a-acknowledgement.png");
    await pageA.screenshot({ path: ssPathB3_3 });

    const aScreenPost = await pageA.evaluate(() => {
      const text = document.body.innerText || "";
      const showsYourCheckIn = text.includes("YOUR CHECK-IN");
      const showsReconnectingStatus = text.includes("The issue feels settled, but I’m still reconnecting") || text.includes("Settled, still reconnecting");
      const showsReviseButton = text.includes("Revise where I am");
      const noPrematureComplete = !text.includes("Complete reconnection");
      return {
        showsYourCheckIn,
        showsReconnectingStatus,
        showsReviseButton,
        noPrematureComplete,
      };
    });

    console.log(`  Partner A Post-Check-in UI:`);
    console.log(`    - 'YOUR CHECK-IN' card visible: ${aScreenPost.showsYourCheckIn}`);
    console.log(`    - Reconnecting status visible: ${aScreenPost.showsReconnectingStatus}`);
    console.log(`    - Revise button visible: ${aScreenPost.showsReviseButton}`);
    console.log(`    - No premature 'Complete reconnection': ${aScreenPost.noPrematureComplete}`);

    // Verify in PostgreSQL database
    const dbSettlementRowA = queryDb(`
      SELECT id, event_id, user_id, phase, response_code, shared_at
      FROM public.relationship_event_repair_responses
      WHERE event_id = '${TARGET_EVENT.id}' AND user_id = '${QA_USERS.partnerA.id}' AND phase = 'settlement';
    `);
    console.log(`  DB Settlement response row for Partner A: ${dbSettlementRowA}`);
    const dbSettlementPartsA = dbSettlementRowA.split("|");
    const dbHasSettlementA = dbSettlementPartsA.length >= 5 && dbSettlementPartsA[3] === "settlement" && dbSettlementPartsA[4] === "reconnecting";

    const b3_3_pass = b3_3_matchesId && aScreenInitial.seesPartnerBArrival && aScreenInitial.seesPrivateReflection && dbHasSettlementA && aScreenPost.noPrematureComplete;
    results.b3_3_partnerAAuthorWorkflow = {
      status: b3_3_pass ? "PASS" : "FAIL",
      details: {
        matchesId: b3_3_matchesId,
        seesPartnerBArrival: aScreenInitial.seesPartnerBArrival,
        seesPrivateReflection: aScreenInitial.seesPrivateReflection,
        dbSettlementRowA,
        postCheckInUi: aScreenPost,
        screenshot: ssPathB3_3,
      },
    };
    console.log(`>>> B3.3 RESULT: [${results.b3_3_partnerAAuthorWorkflow.status}] <<<`);

    // =========================================================================
    // B3.4 — AUTHENTICATED PRIVACY & AUTHORIZATION VERIFICATION
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B3.4: AUTHENTICATED PRIVACY & AUTHORIZATION ---");
    console.log("========================================================");

    // Isolated client for Partner B
    console.log("  Authenticating isolated SDK client for Partner B...");
    const clientB = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY);
    const { data: authB, error: authErrB } = await clientB.auth.signInWithPassword({
      email: QA_USERS.partnerB.email,
      password: QA_USERS.partnerB.password,
    });
    if (authErrB) throw new Error(`Partner B SDK auth error: ${authErrB.message}`);

    // Query 1: Partner B event_private_reflections -> MUST BE 0 ROWS
    const { data: bReflections, status: bReflStatus } = await clientB
      .from("event_private_reflections")
      .select("event_id, author_id, note")
      .eq("event_id", TARGET_EVENT.id);
    console.log(`  Partner B query event_private_reflections -> Status: ${bReflStatus}, Rows: ${bReflections?.length ?? 0}`);

    // Query 2: Partner B relationship_event_repair_responses -> MUST BE 2 ROWS (Arrival by B, Settlement by A)
    const { data: bResponses, status: bRespStatus } = await clientB
      .from("relationship_event_repair_responses")
      .select("id, phase, response_code, user_id")
      .eq("event_id", TARGET_EVENT.id);
    console.log(`  Partner B query relationship_event_repair_responses -> Status: ${bRespStatus}, Rows: ${bResponses?.length ?? 0}`);

    // Isolated client for Partner A
    console.log("  Authenticating isolated SDK client for Partner A...");
    const clientA = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY);
    const { data: authA, error: authErrA } = await clientA.auth.signInWithPassword({
      email: QA_USERS.partnerA.email,
      password: QA_USERS.partnerA.password,
    });
    if (authErrA) throw new Error(`Partner A SDK auth error: ${authErrA.message}`);

    // Query 3: Partner A event_private_reflections -> MUST BE 1 ROW (Author's note)
    const { data: aReflections, status: aReflStatus } = await clientA
      .from("event_private_reflections")
      .select("event_id, author_id, note")
      .eq("event_id", TARGET_EVENT.id);
    console.log(`  Partner A query event_private_reflections -> Status: ${aReflStatus}, Rows: ${aReflections?.length ?? 0}`);

    // Query 4: Partner A relationship_event_repair_responses -> MUST BE 2 ROWS
    const { data: aResponses, status: aRespStatus } = await clientA
      .from("relationship_event_repair_responses")
      .select("id, phase, response_code, user_id")
      .eq("event_id", TARGET_EVENT.id);
    console.log(`  Partner A query relationship_event_repair_responses -> Status: ${aRespStatus}, Rows: ${aResponses?.length ?? 0}`);

    const rls_b_privateBlocked = bReflections?.length === 0;
    const rls_b_responsesShared = bResponses?.length === 2;
    const rls_a_privateAllowed = aReflections?.length === 1;
    const rls_a_responsesShared = aResponses?.length === 2;

    console.log(`  RLS & Privacy Assertions:`);
    console.log(`    - Partner B strictly blocked from Partner A private reflection (0 rows): ${rls_b_privateBlocked}`);
    console.log(`    - Partner B can access shared repair responses (2 rows): ${rls_b_responsesShared}`);
    console.log(`    - Author Partner A can access private reflection (1 row): ${rls_a_privateAllowed}`);
    console.log(`    - Partner A can access shared repair responses (2 rows): ${rls_a_responsesShared}`);

    const b3_4_pass = rls_b_privateBlocked && rls_b_responsesShared && rls_a_privateAllowed && rls_a_responsesShared;
    results.b3_4_authenticatedPrivacyAndAuthorization = {
      status: b3_4_pass ? "PASS" : "FAIL",
      details: {
        partnerB: {
          privateReflectionsCount: bReflections?.length ?? 0,
          repairResponsesCount: bResponses?.length ?? 0,
          privateBlocked: rls_b_privateBlocked,
          responsesShared: rls_b_responsesShared,
        },
        partnerA: {
          privateReflectionsCount: aReflections?.length ?? 0,
          repairResponsesCount: aResponses?.length ?? 0,
          privateAllowed: rls_a_privateAllowed,
          responsesShared: rls_a_responsesShared,
        },
      },
    };
    console.log(`>>> B3.4 RESULT: [${results.b3_4_authenticatedPrivacyAndAuthorization.status}] <<<`);

    // =========================================================================
    // B3.5 — STATE TRANSITION SAFETY & NON-PREMATURE COMPLETION
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B3.5: STATE TRANSITION SAFETY AUDIT ---");
    console.log("========================================================");

    const postEventRow = queryDb(`
      SELECT status, reconnected_at, repair_method
      FROM public.relationship_events
      WHERE id = '${TARGET_EVENT.id}';
    `);
    console.log(`  PostgreSQL event row: ${postEventRow}`);
    const postEventParts = postEventRow.split("|");
    const statusNotReconnected = postEventParts[0] !== "reconnected";
    const statusInCare = postEventParts[0] === "partially_repaired";
    const noReconnectedAt = !postEventParts[1] || postEventParts[1].trim() === "";
    const noRepairMethod = !postEventParts[2] || postEventParts[2].trim() === "";

    // Check repair outcomes count (must be 0)
    const outcomesCount = parseInt(queryDb(`SELECT count(*) FROM public.relationship_event_repair_outcomes WHERE event_id = '${TARGET_EVENT.id}';`), 10);
    console.log(`  Repair outcomes count: ${outcomesCount}`);

    // Check Partner B's seen receipt in home_activity_receipts is preserved
    const receiptRow = queryDb(`
      SELECT id, source_id, user_id, seen_at
      FROM public.home_activity_receipts
      WHERE source_id = '${TARGET_EVENT.id}' AND user_id = '${QA_USERS.partnerB.id}';
    `);
    console.log(`  Partner B seen receipt: ${receiptRow}`);
    const receiptPreserved = receiptRow && !receiptRow.startsWith("DB_ERROR") && receiptRow.length > 0;

    console.log(`  State Safety Assertions:`);
    console.log(`    - Status is NOT 'reconnected': ${statusNotReconnected}`);
    console.log(`    - Status is 'partially_repaired' (in care): ${statusInCare}`);
    console.log(`    - reconnected_at IS NULL: ${noReconnectedAt}`);
    console.log(`    - repair_method IS NULL: ${noRepairMethod}`);
    console.log(`    - Repair outcomes count is 0: ${outcomesCount === 0}`);
    console.log(`    - Partner B seen receipt preserved: ${receiptPreserved}`);

    const b3_5_pass = statusNotReconnected && statusInCare && noReconnectedAt && noRepairMethod && outcomesCount === 0 && receiptPreserved;
    results.b3_5_stateTransitionSafety = {
      status: b3_5_pass ? "PASS" : "FAIL",
      details: {
        eventStatus: postEventParts[0],
        statusInCare,
        statusNotReconnected,
        noReconnectedAt,
        noRepairMethod,
        outcomesCount,
        receiptPreserved,
      },
    };
    console.log(`>>> B3.5 RESULT: [${results.b3_5_stateTransitionSafety.status}] <<<`);

  } catch (err) {
    console.error(`\n[FATAL ERROR in B3 Execution]: ${err.stack || err.message}`);
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
    console.log(`\nScenario B3 report written to ${REPORT_FILE}`);
  }
}

runScenarioB3().catch((e) => {
  console.error("Unhandled top-level error:", e);
  process.exit(1);
});
