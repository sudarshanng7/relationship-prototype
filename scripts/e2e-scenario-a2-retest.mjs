import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ARTIFACT_DIR = path.resolve("test-results/phase3a");
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, "screenshots");
const REPORT_FILE = path.join(ARTIFACT_DIR, "scenario-a2-retest-report.json");
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

async function runRetest() {
  console.log("=== PURPLE GARDEN: SCENARIO A2 NEWEST-ACTIVITY RE-TEST ===");
  console.log(`Timestamp: ${new Date().toISOString()} | RUN_ID: ${RUN_ID}`);

  const expoPid = getExpoProcess();
  console.log(`Expo PID: ${expoPid || "UNKNOWN"}`);
  if (!expoPid) {
    console.error("[BLOCKED] Expo server process not detected on port 8081.");
    process.exit(2);
  }

  const expoMemPre = getProcessMemory(expoPid);
  console.log(`Initial Expo RSS: ${expoMemPre.rssMb} MB | VSZ: ${expoMemPre.vszMb} MB`);
  if (expoMemPre.rssMb > 3100) {
    console.error(`[BLOCKED] Expo RSS is in memory exhaustion danger region (${expoMemPre.rssMb} MB).`);
    console.error("Please restart Expo with: NODE_OPTIONS=\"--max-old-space-size=3072\" pnpm exec expo start --web --port 8081");
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

  let contextA, contextB, pageA, pageB;
  const report = {
    test: "Scenario A2 — Newest-Activity Assertion Retest",
    runId: RUN_ID,
    timestamp: new Date().toISOString(),
    status: "PENDING",
    steps: {},
    networkAudit,
    memory: {},
  };

  try {
    console.log("[Setup] Authenticating Partner A...");
    contextA = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    pageA = await contextA.newPage();
    await loginPartner(pageA, QA_USERS.partnerA, "Partner A");

    console.log("[Setup] Authenticating Partner B...");
    contextB = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    pageB = await contextB.newPage();
    await loginPartner(pageB, QA_USERS.partnerB, "Partner B");

    // STEP 1: Partner A creates a fresh, uniquely identified positive moment
    console.log("\n--- STEP 1: Partner A creates unique positive moment ---");
    const testTopic = `QA-3A-${RUN_ID}-RETEST: Evening tea and laughter`;
    console.log(`  Creating moment with topic: "${testTopic}"`);

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

    const categoryChip = pageA.getByRole("button", { name: /^humour$/i }).first();
    await categoryChip.click();
    await pageA.waitForTimeout(300);

    const oursCard = pageA.locator('[aria-label^="Ours: Share a gentle version"]').first();
    if (await oursCard.isVisible({ timeout: 800 }).catch(() => false)) {
      await oursCard.click();
      await pageA.waitForTimeout(300);
    }

    const sharedInput = pageA.locator('textarea, input[aria-label*="Shared note" i], input[placeholder*="What would you like" i]').last();
    if (await sharedInput.isVisible()) {
      await sharedInput.fill(testTopic);
    }
    await pageA.waitForTimeout(300);

    const reviewBtn = pageA.getByRole("button", { name: /review shared moment/i }).first();
    await reviewBtn.click();
    await pageA.waitForTimeout(800);

    const shareBtn = pageA.getByRole("button", { name: /share with/i }).first();
    await shareBtn.click();

    await pageA.waitForFunction(() => window.location.pathname.includes("/event/") || window.location.pathname.includes("/home"), { timeout: 15000 });
    await pageA.waitForTimeout(1000);

    const newEventUrl = pageA.url();
    const newEventMatch = newEventUrl.match(/\/event\/([a-f0-9-]+)/i);
    const createdEventId = newEventMatch ? newEventMatch[1] : null;
    console.log(`  Created event ID: ${createdEventId}`);

    // Verify in DB
    const dbRecord = queryDb(`SELECT id, creator_id, event_type, category, visibility, shared_topic FROM public.relationship_events WHERE id = '${createdEventId}'`);
    console.log(`  Database record:\n${dbRecord}`);

    report.steps.step1_create_moment = {
      status: createdEventId && dbRecord.includes("humour") ? "PASS" : "FAIL",
      createdEventId,
      dbRecord,
    };

    // STEP 2: Partner B performs genuine client-side Home re-entry
    console.log("\n--- STEP 2: Partner B performs genuine client-side Home re-entry ---");
    console.log("  Navigating to Our Space (/events)...");
    await navigateToOurSpaceUI(pageB);
    await pageB.waitForTimeout(800);

    console.log("  Navigating back to My Rhythm (/home) to trigger useFocusEffect...");
    await navigateToHomeUI(pageB);
    await pageB.waitForTimeout(1000);

    const stateB = await getWhatMattersNowState(pageB);
    console.log(`  Partner B Home State: isPositive=${stateB.isPositive}, hasSeeMoment=${stateB.hasSeeMoment}`);

    const ssPathNewest = path.join(SCREENSHOT_DIR, "A2-retest-partner-b-newest-visible.png");
    await pageB.screenshot({ path: ssPathNewest });

    report.steps.step2_home_reentry = {
      status: stateB.isPositive && stateB.hasSeeMoment ? "PASS" : "FAIL",
      isPositive: stateB.isPositive,
      hasSeeMoment: stateB.hasSeeMoment,
      screenshot: ssPathNewest,
    };

    // STEP 3: Partner B opens newest activity
    console.log("\n--- STEP 3: Partner B opens newest activity ---");
    const openCard = pageB.locator('[role="button"]').filter({ hasText: /shared something good|See the moment/i }).first();
    await openCard.click();

    await pageB.waitForFunction(() => window.location.pathname.includes("/event/"), { timeout: 15000 });
    await pageB.waitForTimeout(1000);

    const openedUrl = pageB.url();
    const isExactMatch = openedUrl.includes(createdEventId);
    console.log(`  Partner B opened URL: ${openedUrl}`);
    console.log(`  Exact match with createdEventId (${createdEventId}): ${isExactMatch}`);

    const ssPathDetail = path.join(SCREENSHOT_DIR, "A2-retest-partner-b-event-detail.png");
    await pageB.screenshot({ path: ssPathDetail });

    report.steps.step3_open_newest = {
      status: isExactMatch ? "PASS" : "APPLICATION_FAIL",
      openedUrl,
      expectedEventId: createdEventId,
      isExactMatch,
      screenshot: ssPathDetail,
    };

    // STEP 4: Partner B returns home — Non-backlog verification
    console.log("\n--- STEP 4: Partner B returns home — Non-backlog verification ---");
    await navigateToHomeUI(pageB);
    await pageB.waitForTimeout(1000);

    const stateAfterReturn = await getWhatMattersNowState(pageB);
    console.log(`  Home State after return: isCalm=${stateAfterReturn.isCalm}, isPositive=${stateAfterReturn.isPositive}`);

    const ssPathCalm = path.join(SCREENSHOT_DIR, "A2-retest-partner-b-calm-non-backlog.png");
    await pageB.screenshot({ path: ssPathCalm });

    const olderNotPromoted = stateAfterReturn.isCalm || !stateAfterReturn.isPositive;
    report.steps.step4_non_backlog = {
      status: olderNotPromoted ? "PASS" : "FAIL",
      isCalm: stateAfterReturn.isCalm,
      isPositive: stateAfterReturn.isPositive,
      screenshot: ssPathCalm,
    };

    // STEP 5: Receipt and history verification
    console.log("\n--- STEP 5: Receipt & History Verification ---");
    const receiptB = queryDb(`SELECT id, user_id, activity_key, activity_kind, seen_at FROM public.home_activity_receipts WHERE user_id = '${QA_USERS.partnerB.id}' AND source_id = '${createdEventId}'`);
    const receiptA = queryDb(`SELECT id, user_id, activity_key, activity_kind, seen_at FROM public.home_activity_receipts WHERE user_id = '${QA_USERS.partnerA.id}' AND source_id = '${createdEventId}'`);

    console.log(`  Partner B receipt for createdEventId:\n${receiptB || "NONE"}`);
    console.log(`  Partner A receipt for createdEventId:\n${receiptA || "NONE"}`);

    const hasBReceipt = receiptB.includes(QA_USERS.partnerB.id) && receiptB.includes("shared_positive");
    const aHasNoReceipt = !receiptA || receiptA.trim().length === 0;

    report.steps.step5_receipt_specificity = {
      status: hasBReceipt && aHasNoReceipt ? "PASS" : "FAIL",
      hasPartnerBReceipt: hasBReceipt,
      partnerAHasNoReceipt: aHasNoReceipt,
      receiptPartnerB: receiptB,
    };

    const allPass = Object.values(report.steps).every((s) => s.status === "PASS");
    report.status = allPass ? "PASS" : "APPLICATION_FAIL";
    console.log(`\n=== RETEST OVERALL RESULT: [${report.status}] ===`);
  } catch (err) {
    console.error(`[CRITICAL ERROR] Retest error: ${err.message}`);
    report.status = "FAIL";
    report.error = err.message;
  } finally {
    if (pageA) await pageA.close().catch(() => {});
    if (pageB) await pageB.close().catch(() => {});
    if (contextA) await contextA.close().catch(() => {});
    if (contextB) await contextB.close().catch(() => {});
    await browser.close().catch(() => {});

    const expoMemPost = getProcessMemory(expoPid);
    report.memory = {
      preRssMb: expoMemPre.rssMb,
      postRssMb: expoMemPost.rssMb,
      deltaRssMb: expoMemPost.rssMb - expoMemPre.rssMb,
    };
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
    console.log(`Report saved to: ${REPORT_FILE}`);
  }
}

runRetest().catch((err) => {
  console.error("Retest fatal error:", err);
  process.exit(1);
});
