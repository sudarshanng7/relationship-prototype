import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ARTIFACT_DIR = path.resolve("test-results/phase3b");
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, "screenshots");
const REPORT_FILE = path.join(ARTIFACT_DIR, "scenario-b5-report.json");
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
  status: "reconnected",
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

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function runScenarioB5() {
  console.log("=== PURPLE GARDEN: PHASE 3B / SCENARIO B5: HOME ACTIVITY & REPAIR REGRESSION ===");
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
    console.error(`[BLOCKED] Expo RSS is in memory exhaustion danger region (${expoMemPre.rssMb} MB > 2800 MB).`);
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
  if (!preCheckEvent || !preCheckEvent.includes("reconnected") || !preCheckEvent.includes("ours")) {
    console.error(`[BLOCKED] Target event ${TARGET_EVENT.id} is not in expected 'reconnected' state.`);
    process.exit(2);
  }

  const preOutcomes = queryDb(`
    SELECT count(*) FROM public.relationship_event_repair_outcomes WHERE event_id = '${TARGET_EVENT.id}';
  `);
  console.log(`Repair outcomes count: ${preOutcomes}`);
  if (parseInt(preOutcomes, 10) !== 1) {
    console.error(`[BLOCKED] Expected exactly 1 repair outcome from B4, found: ${preOutcomes}`);
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
    if (page.url().includes("/event/")) {
      const backBtn = page.locator('[aria-label*="Back" i]').or(page.getByText(/‹ Back/i)).first();
      if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await backBtn.click();
        await page.waitForTimeout(500);
      }
    }
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

  async function navigateToHomeUI(page) {
    if (page.url().includes("/event/")) {
      const backBtn = page.locator('[aria-label*="Back" i]').or(page.getByText(/‹ Back/i)).first();
      if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await backBtn.click();
        await page.waitForTimeout(500);
      }
    }
    const rhythmTab = page.getByRole("button", { name: /^My Rhythm/i }).first();
    if (await rhythmTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await rhythmTab.click();
    } else {
      const backBtn = page.locator('[aria-label*="Back" i]').or(page.getByText(/‹ Back/i)).first();
      if (await backBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await backBtn.click();
      }
      await page.waitForTimeout(500);
      const rhythmTabFallback = page.getByRole("button", { name: /^My Rhythm/i }).first();
      if (await rhythmTabFallback.isVisible({ timeout: 2000 }).catch(() => false)) {
        await rhythmTabFallback.click();
      }
    }
    await page.waitForFunction(() => window.location.pathname.includes("/home"), { timeout: 10000 });
    await page.waitForSelector("text=What matters now", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(600);
  }

  const results = {
    runId: RUN_ID,
    timestamp: new Date().toISOString(),
    targetEvent: TARGET_EVENT,
    b5_1_completedFrictionExclusion: { status: "PENDING", details: {} },
    b5_2_reconnectionCompletedActivity: { status: "PENDING", details: {} },
    b5_3_receiptPersistenceAndSuppression: { status: "PENDING", details: {} },
    b5_4_nonBacklogCalmState: { status: "PENDING", details: {} },
    b5_5_historyAndPrivacy: { status: "PENDING", details: {} },
    b5_6_reloadIsolationAndNetwork: { status: "PENDING", details: {} },
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
    // B5.1 — COMPLETED FRICTION EXCLUSION FROM UNRESOLVED CANDIDATES
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B5.1: COMPLETED FRICTION EXCLUSION ---");
    console.log("========================================================");

    // Verify neither partner's Home presents completed event c6ff8008... as unresolved friction
    const b5_1_homeB = await pageB.evaluate((targetId) => {
      const text = document.body.innerText || "";
      const links = Array.from(document.querySelectorAll("a, [role=\"button\"]")).map((el) => el.getAttribute("href") || el.getAttribute("aria-label") || "");
      const hasCompletedFrictionPresentedAsUnresolved = links.some((h) => h && h.includes(targetId) && h.includes("Open when ready"));
      const hasStillLingering = text.includes("Still lingering");
      const hasYouFoundWayBack = text.includes("You found your way back");
      return { hasCompletedFrictionPresentedAsUnresolved, hasStillLingering, hasYouFoundWayBack, snippet: text.slice(0, 1000) };
    }, TARGET_EVENT.id);

    const b5_1_homeA = await pageA.evaluate((targetId) => {
      const text = document.body.innerText || "";
      const links = Array.from(document.querySelectorAll("a, [role=\"button\"]")).map((el) => el.getAttribute("href") || el.getAttribute("aria-label") || "");
      const hasCompletedFrictionPresentedAsUnresolved = links.some((h) => h && h.includes(targetId) && h.includes("Open when ready"));
      const hasYouFoundWayBack = text.includes("You found your way back");
      return { hasCompletedFrictionPresentedAsUnresolved, hasYouFoundWayBack };
    }, TARGET_EVENT.id);

    console.log(`  Partner B Home:`);
    console.log(`    - Completed event ${TARGET_EVENT.id} linked as unresolved friction: ${b5_1_homeB.hasCompletedFrictionPresentedAsUnresolved} (must be false)`);
    console.log(`    - 'Still lingering' text absent: ${!b5_1_homeB.hasStillLingering}`);
    console.log(`    - Shows 'You found your way back' reconnection card: ${b5_1_homeB.hasYouFoundWayBack}`);

    console.log(`  Partner A Home:`);
    console.log(`    - Completed event ${TARGET_EVENT.id} linked as unresolved friction: ${b5_1_homeA.hasCompletedFrictionPresentedAsUnresolved} (must be false)`);
    console.log(`    - Shows 'You found your way back' reconnection card: ${b5_1_homeA.hasYouFoundWayBack}`);

    // Verify prior friction receipt in PostgreSQL remains intact
    const frictionReceiptB = queryDb(`
      SELECT id, activity_kind, source_id, user_id, seen_at
      FROM public.home_activity_receipts
      WHERE source_id = '${TARGET_EVENT.id}' AND activity_kind = 'shared_friction' AND user_id = '${QA_USERS.partnerB.id}';
    `);
    console.log(`  Partner B shared_friction receipt preserved: ${frictionReceiptB}`);
    const receiptPreserved = frictionReceiptB && !frictionReceiptB.startsWith("DB_ERROR") && frictionReceiptB.length > 0;

    const ssPathB5_1 = path.join(SCREENSHOT_DIR, "B5-1-home-completed-friction.png");
    await pageB.screenshot({ path: ssPathB5_1 });

    const b5_1_pass = !b5_1_homeB.hasCompletedFrictionPresentedAsUnresolved &&
                      !b5_1_homeB.hasStillLingering &&
                      !b5_1_homeA.hasCompletedFrictionPresentedAsUnresolved &&
                      receiptPreserved;

    results.b5_1_completedFrictionExclusion = {
      status: b5_1_pass ? "PASS" : "FAIL",
      details: {
        partnerB: b5_1_homeB,
        partnerA: b5_1_homeA,
        frictionReceiptB,
        screenshot: ssPathB5_1,
      },
    };
    console.log(`>>> B5.1 RESULT: [${results.b5_1_completedFrictionExclusion.status}] <<<`);

    // =========================================================================
    // B5.2 — RECONNECTION COMPLETION ACTIVITY (Partner B opens "You found your way back")
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B5.2: RECONNECTION COMPLETION ACTIVITY ---");
    console.log("========================================================");

    console.log("  Partner B clicking 'See the moment' on What Matters Now tile...");
    const seeMomentBtnB = pageB.locator('[aria-label="See the moment"]').or(pageB.getByText("See the moment")).first();
    await seeMomentBtnB.click();
    await pageB.waitForTimeout(1500);

    await pageB.waitForFunction(() => window.location.pathname.includes("/event/"), { timeout: 10000 });
    await pageB.waitForTimeout(800);

    const b5_2_url = pageB.url();
    const b5_2_matchesId = b5_2_url.includes(TARGET_EVENT.id);
    console.log(`  Partner B navigated URL: ${b5_2_url} (matches target event ID: ${b5_2_matchesId})`);

    const b5_2_detailUi = await pageB.evaluate(() => {
      const text = document.body.innerText || "";
      const hasReconnected = text.includes("Reconnected");
      const hasTakeawayTag = text.includes("Talking it through");
      const hasTakeawayNote = text.includes("Taking gentle time to hear each other helped us soften");
      return { hasReconnected, hasTakeawayTag, hasTakeawayNote };
    });

    console.log(`  Event detail screen opened by Partner B:`);
    console.log(`    - Shows 'Reconnected': ${b5_2_detailUi.hasReconnected}`);
    console.log(`    - Shows takeaway tag 'Talking it through': ${b5_2_detailUi.hasTakeawayTag}`);
    console.log(`    - Shows takeaway note: ${b5_2_detailUi.hasTakeawayNote}`);

    const ssPathB5_2 = path.join(SCREENSHOT_DIR, "B5-2-reconnection-activity-opened.png");
    await pageB.screenshot({ path: ssPathB5_2 });

    const b5_2_pass = b5_2_matchesId && b5_2_detailUi.hasReconnected && b5_2_detailUi.hasTakeawayTag;
    results.b5_2_reconnectionCompletedActivity = {
      status: b5_2_pass ? "PASS" : "FAIL",
      details: {
        url: b5_2_url,
        matchesId: b5_2_matchesId,
        detailUi: b5_2_detailUi,
        screenshot: ssPathB5_2,
      },
    };
    console.log(`>>> B5.2 RESULT: [${results.b5_2_reconnectionCompletedActivity.status}] <<<`);

    // =========================================================================
    // B5.3 — RECEIPT PERSISTENCE & USER ISOLATION
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B5.3: RECEIPT PERSISTENCE & USER ISOLATION ---");
    console.log("========================================================");

    // Verify receipt in PostgreSQL for Partner B
    const bReceiptRow = queryDb(`
      SELECT id, activity_kind, source_id, user_id, seen_at
      FROM public.home_activity_receipts
      WHERE source_id = '${TARGET_EVENT.id}' AND activity_kind = 'reconnection_completed' AND user_id = '${QA_USERS.partnerB.id}';
    `);
    console.log(`  Partner B reconnection_completed receipt in DB: ${bReceiptRow}`);
    const bHasReceipt = bReceiptRow && !bReceiptRow.startsWith("DB_ERROR") && bReceiptRow.length > 0;

    // Verify Partner A does NOT have a receipt for reconnection_completed yet (User Isolation!)
    const aReceiptPreRow = queryDb(`
      SELECT count(*)
      FROM public.home_activity_receipts
      WHERE source_id = '${TARGET_EVENT.id}' AND activity_kind = 'reconnection_completed' AND user_id = '${QA_USERS.partnerA.id}';
    `);
    console.log(`  Partner A reconnection_completed receipt count (expect 0): ${aReceiptPreRow}`);
    const aReceiptIsolated = parseInt(aReceiptPreRow, 10) === 0;

    // Partner B returns to Home via in-app routing
    console.log("  Partner B returning to Home via in-app navigation...");
    await navigateToHomeUI(pageB);
    await pageB.waitForTimeout(1000);

    const bHomePostSeen = await pageB.evaluate(() => {
      const text = document.body.innerText || "";
      const hasCalmEmpty = text.includes("Everything is resting gently") || text.includes("Nothing needs your attention right now");
      const stillHasReconnection = text.includes("You found your way back");
      return { hasCalmEmpty, stillHasReconnection };
    });

    console.log(`  Partner B Home Post-Seen:`);
    console.log(`    - Reconnection card suppressed: ${!bHomePostSeen.stillHasReconnection}`);
    console.log(`    - Calm empty state displayed: ${bHomePostSeen.hasCalmEmpty}`);

    // Verify intentional hard reload maintains suppression for Partner B
    console.log("  Intentional hard browser reload for Partner B...");
    await pageB.reload({ waitUntil: "domcontentloaded" });
    await pageB.waitForSelector("text=What matters now", { timeout: 15000 }).catch(() => {});
    await pageB.waitForTimeout(1000);

    const bHomePostReload = await pageB.evaluate(() => {
      const text = document.body.innerText || "";
      const hasCalmEmpty = text.includes("Everything is resting gently") || text.includes("Nothing needs your attention right now");
      const stillHasReconnection = text.includes("You found your way back");
      return { hasCalmEmpty, stillHasReconnection };
    });
    console.log(`  Partner B Home Post-Reload:`);
    console.log(`    - Reconnection card still suppressed: ${!bHomePostReload.stillHasReconnection}`);
    console.log(`    - Calm empty state preserved: ${bHomePostReload.hasCalmEmpty}`);

    // Verify Partner A still sees "You found your way back" (No cross-partner suppression)
    const aHomePreSeen = await pageA.evaluate(() => {
      const text = document.body.innerText || "";
      return text.includes("You found your way back");
    });
    console.log(`  Partner A still sees 'You found your way back' (Unsuppressed for Partner A): ${aHomePreSeen}`);

    // Partner A opens the activity to record Partner A's own receipt
    console.log("  Partner A opening 'See the moment' on What Matters Now tile...");
    const seeMomentBtnA = pageA.locator('[aria-label="See the moment"]').or(pageA.getByText("See the moment")).first();
    await seeMomentBtnA.click();
    await pageA.waitForTimeout(1500);

    const aReceiptPostRow = queryDb(`
      SELECT count(*)
      FROM public.home_activity_receipts
      WHERE source_id = '${TARGET_EVENT.id}' AND activity_kind = 'reconnection_completed' AND user_id = '${QA_USERS.partnerA.id}';
    `);
    console.log(`  Partner A reconnection_completed receipt count after opening: ${aReceiptPostRow}`);
    const aHasReceipt = parseInt(aReceiptPostRow, 10) === 1;

    // Partner A returns to Home
    console.log("  Partner A returning to Home...");
    await navigateToHomeUI(pageA);
    await pageA.waitForTimeout(1000);

    const ssPathB5_3 = path.join(SCREENSHOT_DIR, "B5-3-receipt-persistence.png");
    await pageB.screenshot({ path: ssPathB5_3 });

    const b5_3_pass = bHasReceipt && aReceiptIsolated && aHomePreSeen && !bHomePostSeen.stillHasReconnection && bHomePostSeen.hasCalmEmpty && bHomePostReload.hasCalmEmpty && aHasReceipt;
    results.b5_3_receiptPersistenceAndSuppression = {
      status: b5_3_pass ? "PASS" : "FAIL",
      details: {
        bHasReceipt,
        aReceiptIsolated,
        aHomePreSeen,
        bHomePostSeen,
        bHomePostReload,
        aHasReceipt,
        screenshot: ssPathB5_3,
      },
    };
    console.log(`>>> B5.3 RESULT: [${results.b5_3_receiptPersistenceAndSuppression.status}] <<<`);

    // =========================================================================
    // B5.4 — NON-BACKLOG: CALM EMPTY STATE PRESERVED
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B5.4: NON-BACKLOG CALM STATE PRESERVED ---");
    console.log("========================================================");

    // After opening reconnection_completed, older positive moments from Phase 3A
    // must NOT resurface into What Matters Now as an inbox backlog
    const bNonBacklogState = await pageB.evaluate(() => {
      const text = document.body.innerText || "";
      const hasCalmEmpty = text.includes("Everything is resting gently") || text.includes("Nothing needs your attention right now");
      const hasResurfacedPositive = text.includes("shared something good");
      const hasResurfacedFriction = text.includes("There is still room for this moment") || text.includes("shared a moment");
      return { hasCalmEmpty, hasResurfacedPositive, hasResurfacedFriction };
    });

    const aNonBacklogState = await pageA.evaluate(() => {
      const text = document.body.innerText || "";
      const hasCalmEmpty = text.includes("Everything is resting gently") || text.includes("Nothing needs your attention right now");
      const hasResurfacedPositive = text.includes("shared something good");
      return { hasCalmEmpty, hasResurfacedPositive };
    });

    console.log(`  Non-Backlog Assertions:`);
    console.log(`    - Partner B What Matters Now is in Calm Empty State: ${bNonBacklogState.hasCalmEmpty}`);
    console.log(`    - Older positive moments NOT backlogged into Home (Partner B): ${!bNonBacklogState.hasResurfacedPositive}`);
    console.log(`    - Resurfaced moments NOT forced into What Matters Now: ${!bNonBacklogState.hasResurfacedFriction}`);
    console.log(`    - Partner A What Matters Now is in Calm Empty State: ${aNonBacklogState.hasCalmEmpty}`);
    console.log(`    - Older positive moments NOT backlogged into Home (Partner A): ${!aNonBacklogState.hasResurfacedPositive}`);

    const ssPathB5_4 = path.join(SCREENSHOT_DIR, "B5-4-non-backlog-calm.png");
    await pageB.screenshot({ path: ssPathB5_4 });

    const b5_4_pass = bNonBacklogState.hasCalmEmpty &&
                      !bNonBacklogState.hasResurfacedPositive &&
                      !bNonBacklogState.hasResurfacedFriction &&
                      aNonBacklogState.hasCalmEmpty &&
                      !aNonBacklogState.hasResurfacedPositive;

    results.b5_4_nonBacklogCalmState = {
      status: b5_4_pass ? "PASS" : "FAIL",
      details: {
        bNonBacklogState,
        aNonBacklogState,
        screenshot: ssPathB5_4,
      },
    };
    console.log(`>>> B5.4 RESULT: [${results.b5_4_nonBacklogCalmState.status}] <<<`);

    // =========================================================================
    // B5.5 — HISTORY AND PRIVACY AUDIT
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B5.5: HISTORY AND PRIVACY AUDIT ---");
    console.log("========================================================");

    // Navigate Partner B to Our Space history
    console.log("  Navigating Partner B to Our Space history...");
    await navigateToOurSpaceUI(pageB);
    await pageB.waitForTimeout(800);

    const ssPathB5_5 = path.join(SCREENSHOT_DIR, "B5-5-history-and-privacy.png");
    await pageB.screenshot({ path: ssPathB5_5 });

    const ourSpaceTextB = await pageB.evaluate(() => document.body.innerText || "");
    const eventCardVisibleB = ourSpaceTextB.includes(TARGET_EVENT.categoryLabel);
    console.log(`  Partner B Our Space: Household card visible: ${eventCardVisibleB}`);

    // Open event detail from Our Space to verify outcome and takeaway
    const householdCardB = pageB.locator(`[aria-label*="${TARGET_EVENT.categoryLabel}" i]`).first();
    await householdCardB.click();
    await pageB.waitForFunction(() => window.location.pathname.includes("/event/"), { timeout: 10000 });
    await pageB.waitForTimeout(800);

    const eventDetailB = await pageB.evaluate((expectedPrivateNote) => {
      const text = document.body.innerText || "";
      const hasReconnected = text.includes("Reconnected");
      const hasTakeawayTag = text.includes("Talking it through");
      const hasTakeawayNote = text.includes("Taking gentle time to hear each other helped us soften");
      const privateReflectionLeaked = text.includes(expectedPrivateNote);
      return { hasReconnected, hasTakeawayTag, hasTakeawayNote, privateReflectionLeaked };
    }, TARGET_EVENT.privateReflectionText);

    console.log(`  Completed Event Detail (Partner B):`);
    console.log(`    - Status is 'Reconnected': ${eventDetailB.hasReconnected}`);
    console.log(`    - Shared takeaway tag visible: ${eventDetailB.hasTakeawayTag}`);
    console.log(`    - Shared takeaway note visible: ${eventDetailB.hasTakeawayNote}`);
    console.log(`    - Partner A private reflection leaked in UI: ${eventDetailB.privateReflectionLeaked} (must be false)`);

    // Authenticated SDK privacy verification
    console.log("  Running authenticated SDK query to verify RLS enforcement...");
    const clientB = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY);
    await clientB.auth.signInWithPassword({
      email: QA_USERS.partnerB.email,
      password: QA_USERS.partnerB.password,
    });
    const { data: bPrivateReflections } = await clientB
      .from("event_private_reflections")
      .select("id, note")
      .eq("event_id", TARGET_EVENT.id);

    const clientA = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY);
    await clientA.auth.signInWithPassword({
      email: QA_USERS.partnerA.email,
      password: QA_USERS.partnerA.password,
    });
    const { data: aPrivateReflections } = await clientA
      .from("event_private_reflections")
      .select("id, note")
      .eq("event_id", TARGET_EVENT.id);

    const outcomesCount = parseInt(queryDb(`SELECT count(*) FROM public.relationship_event_repair_outcomes WHERE event_id = '${TARGET_EVENT.id}';`), 10);

    const rls_b_privateBlocked = bPrivateReflections?.length === 0;
    const rls_a_privateAllowed = aPrivateReflections?.length === 1;

    console.log(`  SDK RLS Assertions:`);
    console.log(`    - Partner B strictly blocked from Partner A private reflection (0 rows): ${rls_b_privateBlocked}`);
    console.log(`    - Author Partner A can read private reflection (1 row): ${rls_a_privateAllowed}`);
    console.log(`    - Exactly 1 repair outcome in database: ${outcomesCount === 1}`);

    const b5_5_pass = eventCardVisibleB &&
                      eventDetailB.hasReconnected &&
                      eventDetailB.hasTakeawayTag &&
                      !eventDetailB.privateReflectionLeaked &&
                      rls_b_privateBlocked &&
                      rls_a_privateAllowed &&
                      outcomesCount === 1;

    results.b5_5_historyAndPrivacy = {
      status: b5_5_pass ? "PASS" : "FAIL",
      details: {
        eventCardVisibleB,
        eventDetailB,
        rls_b_privateBlocked,
        rls_a_privateAllowed,
        outcomesCount,
        screenshot: ssPathB5_5,
      },
    };
    console.log(`>>> B5.5 RESULT: [${results.b5_5_historyAndPrivacy.status}] <<<`);

    // =========================================================================
    // B5.6 — RELOAD, ISOLATION & NETWORK AUDIT
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B5.6: RELOAD, ISOLATION & NETWORK AUDIT ---");
    console.log("========================================================");

    const remoteLeaksCount = networkAudit.remoteRequestsDetected.length;
    console.log(`  Remote Supabase calls detected: ${remoteLeaksCount}`);
    console.log(`  Total local requests recorded: ${networkAudit.totalRequests}`);

    const b5_6_pass = remoteLeaksCount === 0;
    results.b5_6_reloadIsolationAndNetwork = {
      status: b5_6_pass ? "PASS" : "FAIL",
      details: {
        remoteLeaksCount,
        totalLocalRequests: networkAudit.totalRequests,
        remoteRequestsDetected: networkAudit.remoteRequestsDetected,
      },
    };
    console.log(`>>> B5.6 RESULT: [${results.b5_6_reloadIsolationAndNetwork.status}] <<<`);

  } catch (err) {
    console.error(`\n[FATAL ERROR in B5 Execution]: ${err.stack || err.message}`);
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
    console.log(`\nScenario B5 report written to ${REPORT_FILE}`);
  }
}

runScenarioB5().catch((e) => {
  console.error("Unhandled top-level error:", e);
  process.exit(1);
});
