import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ARTIFACT_DIR = path.resolve("test-results/phase3a");
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, "screenshots");
const REPORT_FILE = path.join(ARTIFACT_DIR, "scenarios-a3-a4-report.json");
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

async function runSuite() {
  console.log("=== PURPLE GARDEN: PHASE 3A SCENARIOS A3 & A4 ===");
  console.log(`Timestamp: ${new Date().toISOString()} | RUN_ID: ${RUN_ID}`);

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
    await page.waitForTimeout(1000);

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

  async function navigateToHomeUI(page) {
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

  const results = {
    runId: RUN_ID,
    timestamp: new Date().toISOString(),
    scenarioA3: {
      id: "A3",
      title: "Seen Activity Suppression Persistence Across Browser Reload",
      status: "PENDING",
      steps: {},
    },
    scenarioA4: {
      id: "A4",
      title: "Fresh New Activity Promotion and Non-Resurfacing Verification",
      status: "PENDING",
      steps: {},
    },
    networkAudit,
    memory: {},
  };

  let contextA, contextB, pageA, pageB;

  try {
    console.log("\n[Setup] Authenticating Partner B context...");
    contextB = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    pageB = await contextB.newPage();
    await loginPartner(pageB, QA_USERS.partnerB, "Partner B");

    // =========================================================================
    // SCENARIO A3: SEEN ACTIVITY SUPPRESSION AFTER BROWSER RELOAD
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- SCENARIO A3: SEEN ACTIVITY PERSISTENCE ACROSS RELOAD ---");
    console.log("========================================================");

    // Step A3.1: Verify initial Home state before reload
    console.log("\n[A3.1] Checking Partner B Home state before reload...");
    const statePreReload = await getWhatMattersNowState(pageB);
    console.log(`  Pre-reload State: isCalm=${statePreReload.isCalm}, isPositive=${statePreReload.isPositive}`);

    const ssPathPreReload = path.join(SCREENSHOT_DIR, "A3-partner-b-home-pre-reload.png");
    await pageB.screenshot({ path: ssPathPreReload });

    // Step A3.2: Genuine browser reload
    console.log("\n[A3.2] Executing genuine browser reload (page.reload)...");
    await pageB.reload({ waitUntil: "domcontentloaded" });
    await pageB.waitForFunction(() => window.location.pathname.includes("/home"), { timeout: 15000 });
    await pageB.waitForSelector("text=What matters now", { timeout: 10000 });
    await pageB.waitForTimeout(1000);

    const statePostReload = await getWhatMattersNowState(pageB);
    console.log(`  Post-reload State: isCalm=${statePostReload.isCalm}, isPositive=${statePostReload.isPositive}`);

    const ssPathPostReload = path.join(SCREENSHOT_DIR, "A3-partner-b-home-post-reload.png");
    await pageB.screenshot({ path: ssPathPostReload });

    // Seen positive moment must remain suppressed; older positive moments must NOT backlog
    const isSuppressedAfterReload = statePostReload.isCalm || (!statePostReload.isPositive);
    console.log(`  Seen activity remains suppressed after reload: ${isSuppressedAfterReload}`);

    // Step A3.3: Verify underlying moments remain accessible in history
    console.log("\n[A3.3] Verifying underlying moments in Our Space history...");
    await navigateToOurSpaceUI(pageB);
    await pageB.waitForTimeout(1200);

    const ssPathHistoryA3 = path.join(SCREENSHOT_DIR, "A3-partner-b-our-space-history.png");
    await pageB.screenshot({ path: ssPathHistoryA3 });

    const historyTextA3 = await pageB.evaluate(() => document.body.innerText || "");
    const historyHasEvents = historyTextA3.includes("Our Space") || historyTextA3.includes("Moments");

    // Database verification for A3
    const latestSeenMoment = queryDb(`
      SELECT e.id, e.category, e.shared_topic, e.visibility, r.seen_at
      FROM public.home_activity_receipts r
      JOIN public.relationship_events e ON e.id = r.source_id
      WHERE r.user_id = '${QA_USERS.partnerB.id}' AND r.activity_kind = 'shared_positive'
      ORDER BY r.seen_at DESC LIMIT 1;
    `);
    console.log(`  Database record of latest seen moment with receipt:\n${latestSeenMoment}`);
    const dbReceiptValid = latestSeenMoment.includes(QA_USERS.partnerB.id) || latestSeenMoment.includes("ours");

    results.scenarioA3 = {
      id: "A3",
      title: "Seen Activity Suppression Persistence Across Browser Reload",
      status: (isSuppressedAfterReload && historyHasEvents && dbReceiptValid) ? "PASS" : "FAIL",
      steps: {
        preReload: { isCalm: statePreReload.isCalm, isPositive: statePreReload.isPositive, screenshot: ssPathPreReload },
        postReload: { isCalm: statePostReload.isCalm, isPositive: statePostReload.isPositive, screenshot: ssPathPostReload },
        history: { accessible: historyHasEvents, screenshot: ssPathHistoryA3 },
        database: { record: latestSeenMoment },
      },
    };
    console.log(`\n>>> SCENARIO A3 RESULT: [${results.scenarioA3.status}] <<<`);

    // =========================================================================
    // SCENARIO A4: FRESH NEW ACTIVITY CREATION & NON-RESURFACING
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- SCENARIO A4: FRESH NEW ACTIVITY PROMOTION ---");
    console.log("========================================================");

    console.log("\n[A4.1] Authenticating Partner A context...");
    contextA = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    pageA = await contextA.newPage();
    await loginPartner(pageA, QA_USERS.partnerA, "Partner A");

    // Partner A creates uniquely identified new positive moment
    const topicA4 = `QA-3A-${RUN_ID}-A4: Stargazing on the porch`;
    console.log(`\n[A4.2] Partner A creating unique moment: "${topicA4}"`);

    await navigateToHomeUI(pageA);
    const recordBtn = pageA.getByRole("button", { name: /record a moment/i }).first();
    await recordBtn.waitFor({ state: "visible", timeout: 10000 });
    await recordBtn.click();

    await pageA.waitForSelector("text=What would you like to record?", { timeout: 5000 });
    const goodTile = pageA.getByRole("button", { name: /something good/i }).first();
    await goodTile.click();

    await pageA.waitForFunction(() => window.location.pathname.includes("/record-moment"), { timeout: 10000 });
    await pageA.waitForSelector("text=What was it about?", { timeout: 10000 });
    await pageA.waitForTimeout(400);

    // Category chip: Affection
    const categoryChip = pageA.getByRole("button", { name: /^affection$/i }).first();
    await categoryChip.click();
    await pageA.waitForTimeout(300);

    // Select Ours
    const oursCard = pageA.locator('[aria-label^="Ours: Share a gentle version"]').first();
    if (await oursCard.isVisible({ timeout: 800 }).catch(() => false)) {
      await oursCard.click();
      await pageA.waitForTimeout(300);
    }

    // Shared note
    const sharedInput = pageA.locator('textarea, input[aria-label*="Shared note" i], input[placeholder*="What would you like" i]').last();
    if (await sharedInput.isVisible()) {
      await sharedInput.fill(topicA4);
    }
    await pageA.waitForTimeout(300);

    // Review shared moment
    const reviewBtn = pageA.getByRole("button", { name: /review shared moment/i }).first();
    await reviewBtn.click();
    await pageA.waitForTimeout(800);

    // Share with Partner B
    const shareBtn = pageA.getByRole("button", { name: /share with/i }).first();
    await shareBtn.click();

    await pageA.waitForFunction(() => window.location.pathname.includes("/event/") || window.location.pathname.includes("/home"), { timeout: 15000 });
    await pageA.waitForTimeout(1000);

    const newEventUrl = pageA.url();
    const newEventMatch = newEventUrl.match(/\/event\/([a-f0-9-]+)/i);
    const eventIdA4 = newEventMatch ? newEventMatch[1] : null;
    console.log(`  Partner A created Event ID: ${eventIdA4}`);

    const ssPathCreatedA4 = path.join(SCREENSHOT_DIR, "A4-partner-a-moment-created.png");
    await pageA.screenshot({ path: ssPathCreatedA4 });

    // Step A4.3: Partner B performs genuine client-side Home re-entry
    console.log("\n[A4.3] Partner B performs genuine client-side Home re-entry...");
    await navigateToOurSpaceUI(pageB);
    await pageB.waitForTimeout(800);
    await navigateToHomeUI(pageB);
    await pageB.waitForTimeout(1000);

    const stateB_A4 = await getWhatMattersNowState(pageB);
    console.log(`  Partner B Home State: isPositive=${stateB_A4.isPositive}, hasSeeMoment=${stateB_A4.hasSeeMoment}`);

    const ssPathNewestA4 = path.join(SCREENSHOT_DIR, "A4-partner-b-newest-visible.png");
    await pageB.screenshot({ path: ssPathNewestA4 });

    // Step A4.4: Partner B opens the newest activity
    console.log("\n[A4.4] Partner B opening newest activity card...");
    const openCard = pageB.locator('[role="button"]').filter({ hasText: /shared something good|See the moment/i }).first();
    await openCard.click();

    await pageB.waitForFunction(() => window.location.pathname.includes("/event/"), { timeout: 15000 });
    await pageB.waitForTimeout(1000);

    const openedUrlA4 = pageB.url();
    const isExactMatchA4 = openedUrlA4.includes(eventIdA4);
    console.log(`  Partner B opened URL: ${openedUrlA4}`);
    console.log(`  Exact match with created eventIdA4 (${eventIdA4}): ${isExactMatchA4}`);

    const ssPathOpenedA4 = path.join(SCREENSHOT_DIR, "A4-partner-b-opened-exact-id.png");
    await pageB.screenshot({ path: ssPathOpenedA4 });

    // Step A4.5: Partner B returns Home — Non-resurfacing verification
    console.log("\n[A4.5] Partner B returns home — verifying non-resurfacing of older moments...");
    await navigateToHomeUI(pageB);
    await pageB.waitForTimeout(1000);

    const stateBAfterReturnA4 = await getWhatMattersNowState(pageB);
    console.log(`  Post-open Home State: isCalm=${stateBAfterReturnA4.isCalm}, isPositive=${stateBAfterReturnA4.isPositive}`);

    const ssPathCalmA4 = path.join(SCREENSHOT_DIR, "A4-partner-b-calm-non-backlog.png");
    await pageB.screenshot({ path: ssPathCalmA4 });

    const nonResurfacingVerified = stateBAfterReturnA4.isCalm || (!stateBAfterReturnA4.isPositive);

    // Step A4.6: Database receipt verification for A4
    console.log("\n[A4.6] Database receipt verification for Event ID " + eventIdA4 + "...");
    const receiptQueryB = queryDb(`SELECT id, user_id, activity_key, activity_kind, seen_at FROM public.home_activity_receipts WHERE user_id = '${QA_USERS.partnerB.id}' AND source_id = '${eventIdA4}'`);
    const receiptQueryA = queryDb(`SELECT id, user_id, activity_key, activity_kind, seen_at FROM public.home_activity_receipts WHERE user_id = '${QA_USERS.partnerA.id}' AND source_id = '${eventIdA4}'`);

    console.log(`  Partner B receipt:\n${receiptQueryB || "NONE"}`);
    console.log(`  Partner A receipt (must be NONE):\n${receiptQueryA || "NONE"}`);

    const hasPartnerBReceiptA4 = receiptQueryB.includes(QA_USERS.partnerB.id) && receiptQueryB.includes("shared_positive");
    const partnerAHasNoReceiptA4 = !receiptQueryA || receiptQueryA.trim().length === 0;

    results.scenarioA4 = {
      id: "A4",
      title: "Fresh New Activity Promotion and Non-Resurfacing Verification",
      status: (isExactMatchA4 && nonResurfacingVerified && hasPartnerBReceiptA4 && partnerAHasNoReceiptA4) ? "PASS" : "FAIL",
      steps: {
        creation: { eventId: eventIdA4, topic: topicA4, screenshot: ssPathCreatedA4 },
        homeReentry: { isPositive: stateB_A4.isPositive, hasSeeMoment: stateB_A4.hasSeeMoment, screenshot: ssPathNewestA4 },
        openExactId: { openedUrl: openedUrlA4, expectedId: eventIdA4, isExactMatch: isExactMatchA4, screenshot: ssPathOpenedA4 },
        nonResurfacing: { isCalm: stateBAfterReturnA4.isCalm, isPositive: stateBAfterReturnA4.isPositive, screenshot: ssPathCalmA4 },
        receipts: { partnerB: receiptQueryB, partnerA: receiptQueryA, isSpecific: hasPartnerBReceiptA4 && partnerAHasNoReceiptA4 },
      },
    };
    console.log(`\n>>> SCENARIO A4 RESULT: [${results.scenarioA4.status}] <<<`);

  } catch (err) {
    console.error(`[CRITICAL ERROR] Suite execution error: ${err.message}`);
    if (results.scenarioA3.status === "PENDING") results.scenarioA3.status = "FAIL";
    if (results.scenarioA4.status === "PENDING") results.scenarioA4.status = "FAIL";
    results.error = err.message;
  } finally {
    if (pageA) await pageA.close().catch(() => {});
    if (pageB) await pageB.close().catch(() => {});
    if (contextA) await contextA.close().catch(() => {});
    if (contextB) await contextB.close().catch(() => {});
    await browser.close().catch(() => {});

    const expoMemPost = getProcessMemory(expoPid);
    let postHttp = "000";
    try {
      postHttp = execSync("curl -s -m 5 -o /dev/null -w \"%{http_code}\" http://127.0.0.1:8081", { encoding: "utf8" }).trim();
    } catch {}

    results.memory = {
      preRssMb: expoMemPre.rssMb,
      postRssMb: expoMemPost.rssMb,
      deltaRssMb: expoMemPost.rssMb - expoMemPre.rssMb,
      postHttpStatus: postHttp,
    };
    console.log(`\nPost-test Memory: RSS ${expoMemPost.rssMb} MB (Δ ${results.memory.deltaRssMb} MB) | HTTP ${postHttp}`);

    fs.writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2));
    console.log(`Report saved to: ${REPORT_FILE}`);
  }
}

runSuite().catch((err) => {
  console.error("Fatal suite error:", err);
  process.exit(1);
});
