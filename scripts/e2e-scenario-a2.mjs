import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ARTIFACT_DIR = path.resolve("test-results/phase3a");
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, "screenshots");
const REPORT_FILE = path.join(ARTIFACT_DIR, "scenario-a2-report.json");
const APP_URL = "http://127.0.0.1:8081";
const LOCAL_SUPABASE_HOST = "127.0.0.1:54321";

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
};
const COUPLE_ID = "10000002-0002-0002-0002-000000000001";

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

async function runScenarioA2() {
  console.log("=== PURPLE GARDEN: SCENARIO A2 — INFORMATIONAL BACKLOG PREVENTION ===");
  console.log(`Timestamp: ${new Date().toISOString()} | RUN_ID: ${RUN_ID}`);

  // 1. PRE-FLIGHT VERIFICATION
  const expoPid = getExpoProcess();
  console.log(`Expo PID: ${expoPid || "UNKNOWN"}`);
  if (!expoPid) {
    console.error("[BLOCKED] Expo server process not detected on port 8081.");
    process.exit(2);
  }

  const expoMemPre = getProcessMemory(expoPid);
  console.log(`Initial Expo RSS: ${expoMemPre.rssMb} MB | VSZ: ${expoMemPre.vszMb} MB`);
  if (expoMemPre.rssMb > 2900) {
    console.error(`[BLOCKED] Expo RSS is near memory exhaustion limit (${expoMemPre.rssMb} MB).`);
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

  let supabaseHealth = "";
  try {
    supabaseHealth = execSync("curl -s http://127.0.0.1:54321/auth/v1/health", { encoding: "utf8" }).trim();
  } catch {}
  console.log(`Supabase Health Check: ${supabaseHealth}`);

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
    page.setDefaultTimeout(20000);
    attachNetworkAuditing(page, contextName);

    await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForSelector("input[type=\"email\"], input[placeholder*=\"Email\" i]", { timeout: 10000 });
    await page.waitForTimeout(1000); // React hydration

    const emailInput = page.locator("input[type=\"email\"], input[placeholder*=\"Email\" i]").first();
    const passwordInput = page.locator("input[type=\"password\"], input[placeholder*=\"Password\" i]").first();

    await emailInput.fill(user.email);
    await passwordInput.fill(user.password);
    await page.waitForTimeout(500);

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

  // Real client-side navigation helpers
  async function navigateToHomeUI(page) {
    if (page.url().includes("/home")) {
      await page.waitForSelector("text=What matters now", { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(400);
      return;
    }

    // Direct bottom-navigation to My Rhythm
    const rhythmTab = page.getByRole("button", { name: /^My Rhythm/i }).first();
    if (await rhythmTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await rhythmTab.click();
    } else {
      const backBtn = page.getByRole("button", { name: /Back/i }).first();
      if (await backBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await backBtn.click();
      }
      await page.waitForTimeout(600);
      const rhythmTabFallback = page.getByRole("button", { name: /^My Rhythm/i }).first();
      if (await rhythmTabFallback.isVisible({ timeout: 2000 }).catch(() => false)) {
        await rhythmTabFallback.click();
      }
    }

    await page.waitForFunction(() => window.location.pathname.includes("/home"), { timeout: 15000 });
    await page.waitForSelector("text=What matters now", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(600);
  }

  async function navigateToOurSpaceUI(page) {
    await navigateToHomeUI(page);
    const oursTile = page.locator('[aria-label="Open Ours, your shared space"]').first();
    if (await oursTile.isVisible({ timeout: 1500 }).catch(() => false)) {
      await oursTile.click();
      await page.waitForFunction(() => window.location.pathname.includes("/events"), { timeout: 10000 });
    } else {
      const momentsBtn = page.getByRole("button", { name: /^Our Space|^Moments/i }).first();
      await momentsBtn.click();
      await page.waitForFunction(() => window.location.pathname.includes("/events"), { timeout: 10000 });
    }
    await page.waitForTimeout(500);
  }

  async function getWhatMattersNowState(page) {
    return await page.evaluate(() => {
      const text = document.body.innerText || "";
      const isCalm = text.includes("Nothing needs your attention right now");
      const isPositive = text.includes("shared something good");
      const hasSeeMoment = text.includes("See the moment");
      return {
        isCalm,
        isPositive,
        hasSeeMoment,
        bodyText: text,
      };
    });
  }

  async function recordPositiveMomentUI(page, { category, sharedTopic }) {
    await navigateToHomeUI(page);

    // Open bottom sheet
    const recordBtn = page.getByRole("button", { name: /record a moment/i }).first();
    await recordBtn.waitFor({ state: "visible", timeout: 10000 });
    await recordBtn.click();

    // Select "Something good"
    await page.waitForSelector("text=What would you like to record?", { timeout: 5000 });
    const goodTile = page.getByRole("button", { name: /something good/i }).first();
    await goodTile.click();

    await page.waitForFunction(() => window.location.pathname.includes("/record-moment"), { timeout: 10000 });
    await page.waitForSelector("text=What was it about?", { timeout: 10000 });
    await page.waitForTimeout(400);

    // Category chip
    const categoryChip = page.getByRole("button", { name: new RegExp(`^${category}$`, "i") }).first();
    await categoryChip.click();
    await page.waitForTimeout(300);

    // Visibility: Ours
    const oursCard = page.locator('[aria-label^="Ours: Share a gentle version"]').first();
    if (await oursCard.isVisible({ timeout: 800 }).catch(() => false)) {
      await oursCard.click();
      await page.waitForTimeout(300);
    }

    // Shared note
    if (sharedTopic) {
      const sharedInput = page.locator('textarea, input[aria-label*="Shared note" i], input[placeholder*="What would you like" i]').last();
      if (await sharedInput.isVisible()) {
        await sharedInput.fill(sharedTopic);
      }
    }
    await page.waitForTimeout(300);

    // Click "Review shared moment"
    const reviewBtn = page.getByRole("button", { name: /review shared moment/i }).first();
    await reviewBtn.click();
    await page.waitForTimeout(800);

    // Click "Share with Partner B"
    const shareBtn = page.getByRole("button", { name: /share with/i }).first();
    await shareBtn.click();

    // Wait for navigation
    await page.waitForFunction(() => window.location.pathname.includes("/event/") || window.location.pathname.includes("/home"), { timeout: 15000 });
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    const match = currentUrl.match(/\/event\/([a-f0-9-]+)/i);
    const eventId = match ? match[1] : null;

    // Return to home
    await navigateToHomeUI(page);
    return eventId;
  }

  let contextA, contextB, pageA, pageB;
  const result = {
    test: "Scenario A2 — Informational Backlog Prevention",
    runId: RUN_ID,
    timestamp: new Date().toISOString(),
    status: "PENDING",
    steps: {},
    databaseEvidence: {},
    networkAudit,
    memory: {},
  };

  try {
    console.log("\n[Setup] Authenticating Partner A context...");
    contextA = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    pageA = await contextA.newPage();
    const markerA = await loginPartner(pageA, QA_USERS.partnerA, "Partner A");

    console.log("[Setup] Authenticating Partner B context...");
    contextB = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    pageB = await contextB.newPage();
    const markerB = await loginPartner(pageB, QA_USERS.partnerB, "Partner B");

    console.log("[Setup] Both partners authenticated with isolated SPA contexts.");

    // STEP 1: Partner A creates two distinct positive shared moments
    console.log("\n--- STEP 1: Partner A creates two distinct positive moments ---");
    const topic1 = `QA-3A-${RUN_ID}-A2-1: Leaving a gentle note`;
    const topic2 = `QA-3A-${RUN_ID}-A2-2: Fresh afternoon flowers`;

    console.log(`  Creating Moment 1: "${topic1}"`);
    const eventId1 = await recordPositiveMomentUI(pageA, {
      category: "Care",
      sharedTopic: topic1,
    });
    console.log(`  Moment 1 created: eventId=${eventId1}`);

    // Pause 1.5 seconds to guarantee strictly later timestamp
    console.log("  Waiting 1.5s to ensure strictly monotonic timestamp ordering...");
    await new Promise((r) => setTimeout(r, 1500));

    console.log(`  Creating Moment 2: "${topic2}"`);
    const eventId2 = await recordPositiveMomentUI(pageA, {
      category: "Support",
      sharedTopic: topic2,
    });
    console.log(`  Moment 2 created: eventId=${eventId2}`);

    result.steps.step1_creation = {
      status: eventId1 && eventId2 ? "PASS" : "FAIL",
      moment1: { id: eventId1, topic: topic1, category: "Care" },
      moment2: { id: eventId2, topic: topic2, category: "Support" },
    };

    // STEP 2: Partner B sees newest eligible activity in What Matters Now
    console.log("\n--- STEP 2: Partner B checks What Matters Now ---");
    await navigateToHomeUI(pageB);
    await pageB.waitForTimeout(1000);

    const stateBBeforeOpen = await getWhatMattersNowState(pageB);
    const ssPathNewest = path.join(SCREENSHOT_DIR, "A2-step2-partner-b-newest-visible.png");
    await pageB.screenshot({ path: ssPathNewest });

    console.log(`  Partner B Home State: isPositive=${stateBBeforeOpen.isPositive}, hasSeeMoment=${stateBBeforeOpen.hasSeeMoment}`);
    const isNewestEligibleShown = stateBBeforeOpen.isPositive && stateBBeforeOpen.hasSeeMoment;

    result.steps.step2_newest_seen_in_home = {
      status: isNewestEligibleShown ? "PASS" : "FAIL",
      isPositive: stateBBeforeOpen.isPositive,
      hasSeeMoment: stateBBeforeOpen.hasSeeMoment,
      screenshot: ssPathNewest,
    };

    // STEP 3: Partner B opens the newer activity
    console.log("\n--- STEP 3: Partner B opens the newer activity ---");
    const openCard = pageB.locator('[role="button"]').filter({ hasText: /shared something good|See the moment/i }).first();
    await openCard.click();
    await pageB.waitForFunction(() => window.location.pathname.includes("/event/"), { timeout: 15000 });
    await pageB.waitForTimeout(1000);

    const openedUrl = pageB.url();
    const isOpenedCorrectEvent = openedUrl.includes(eventId2);
    const ssPathDetail = path.join(SCREENSHOT_DIR, "A2-step3-partner-b-event-detail.png");
    await pageB.screenshot({ path: ssPathDetail });

    console.log(`  Partner B navigated to: ${openedUrl} (Matches Moment 2: ${isOpenedCorrectEvent})`);

    result.steps.step3_open_newer = {
      status: isOpenedCorrectEvent ? "PASS" : "FAIL",
      openedUrl,
      expectedEventId: eventId2,
      screenshot: ssPathDetail,
    };

    // STEP 4: Older unseen positive moment must NOT replace it as a backlog item
    console.log("\n--- STEP 4: Partner B returns home — Non-backlog verification ---");
    await navigateToHomeUI(pageB);
    await pageB.waitForTimeout(1000);

    const stateBAfterReturn = await getWhatMattersNowState(pageB);
    const ssPathNonBacklog = path.join(SCREENSHOT_DIR, "A2-step4-partner-b-calm-non-backlog.png");
    await pageB.screenshot({ path: ssPathNonBacklog });

    const olderNotPromoted = !stateBAfterReturn.bodyText.includes(topic1);
    const calmStateActive = stateBAfterReturn.isCalm || (!stateBAfterReturn.isPositive);

    console.log(`  Partner B Home State after return: isCalm=${stateBAfterReturn.isCalm}, olderNotPromoted=${olderNotPromoted}`);

    result.steps.step4_non_backlog = {
      status: olderNotPromoted && calmStateActive ? "PASS" : "FAIL",
      olderNotPromoted,
      calmStateActive,
      screenshot: ssPathNonBacklog,
    };

    // STEP 5: Both moments remain accessible in history
    console.log("\n--- STEP 5: Verify both moments in Our Space history ---");
    await navigateToOurSpaceUI(pageB);
    await pageB.waitForTimeout(1500);

    const ssPathHistory = path.join(SCREENSHOT_DIR, "A2-step5-partner-b-our-space-history.png");
    await pageB.screenshot({ path: ssPathHistory });

    const historyPageText = await pageB.evaluate(() => document.body.innerText || "");
    const historyContainsCare = historyPageText.includes("Care") || historyPageText.includes("care");
    const historyContainsSupport = historyPageText.includes("Support") || historyPageText.includes("support");

    // Also confirm database persistence of both events
    const dbEventsQuery = queryDb(`SELECT id, creator_id, event_type, category, visibility, shared_topic FROM public.relationship_events WHERE id IN ('${eventId1}', '${eventId2}')`);
    console.log(`  Database query for both events:\n${dbEventsQuery}`);
    const bothEventsInDb = dbEventsQuery.includes(eventId1) && dbEventsQuery.includes(eventId2) && dbEventsQuery.includes("ours");

    result.steps.step5_history_accessibility = {
      status: bothEventsInDb ? "PASS" : "FAIL",
      bothEventsInDb,
      historyContainsCare,
      historyContainsSupport,
      dbRecords: dbEventsQuery,
      screenshot: ssPathHistory,
    };

    // STEP 6: Seen receipt must remain specific to Partner B
    console.log("\n--- STEP 6: Verify seen receipt specificity ---");
    const receiptPartnerB = queryDb(`SELECT id, user_id, activity_key, activity_kind, seen_at FROM public.home_activity_receipts WHERE user_id = '${QA_USERS.partnerB.id}' AND source_id = '${eventId2}'`);
    const receiptPartnerA = queryDb(`SELECT id, user_id, activity_key, activity_kind, seen_at FROM public.home_activity_receipts WHERE user_id = '${QA_USERS.partnerA.id}' AND source_id = '${eventId2}'`);

    console.log(`  Partner B receipt:\n${receiptPartnerB || "NONE"}`);
    console.log(`  Partner A receipt (must be NONE):\n${receiptPartnerA || "NONE"}`);

    const hasPartnerBReceipt = receiptPartnerB.includes(QA_USERS.partnerB.id) && receiptPartnerB.includes("shared_positive");
    const partnerAHasNoReceipt = !receiptPartnerA || receiptPartnerA.trim().length === 0;

    result.steps.step6_receipt_specificity = {
      status: hasPartnerBReceipt && partnerAHasNoReceipt ? "PASS" : "FAIL",
      hasPartnerBReceipt,
      partnerAHasNoReceipt,
      receiptPartnerB,
      receiptPartnerA,
    };

    // Overall assessment
    const allStepsPass = Object.values(result.steps).every((s) => s.status === "PASS");
    result.status = allStepsPass ? "PASS" : "FAIL";

    console.log(`\n=== SCENARIO A2 OVERALL RESULT: [${result.status}] ===`);
  } catch (err) {
    console.error(`[CRITICAL ERROR] Scenario A2 failed with exception: ${err.message}`);
    result.status = "FAIL";
    result.error = err.message;
    result.stack = err.stack;
  } finally {
    if (pageA) await pageA.close().catch(() => {});
    if (pageB) await pageB.close().catch(() => {});
    if (contextA) await contextA.close().catch(() => {});
    if (contextB) await contextB.close().catch(() => {});
    await browser.close().catch(() => {});

    // Post-test memory check
    const expoMemPost = getProcessMemory(expoPid);
    let postHttp = "000";
    try {
      postHttp = execSync("curl -s -m 5 -o /dev/null -w \"%{http_code}\" http://127.0.0.1:8081", { encoding: "utf8" }).trim();
    } catch {}

    result.memory = {
      preRssMb: expoMemPre.rssMb,
      postRssMb: expoMemPost.rssMb,
      deltaRssMb: expoMemPost.rssMb - expoMemPre.rssMb,
      postHttpStatus: postHttp,
    };

    console.log(`Post-test Expo Memory: RSS ${expoMemPost.rssMb} MB (Δ ${result.memory.deltaRssMb} MB) | HTTP ${postHttp}`);

    fs.writeFileSync(REPORT_FILE, JSON.stringify(result, null, 2));
    console.log(`Report saved to: ${REPORT_FILE}`);
  }
}

runScenarioA2().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
