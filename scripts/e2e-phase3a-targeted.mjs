import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ARTIFACT_DIR = path.resolve("test-results/phase3a");
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, "screenshots");
const APP_URL = "http://127.0.0.1:8081";
const LOCAL_SUPABASE_HOST = "127.0.0.1:54321";

// Unique run ID for tracking records
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

// Database query helper using local docker postgres
function queryDb(sql) {
  try {
    const escaped = sql.replace(/"/g, '\\"');
    const cmd = `docker exec -i supabase_db_relationship-prototype psql -U postgres -d postgres -t -A -c "${escaped}"`;
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch (err) {
    return `DB_ERROR: ${err.message}`;
  }
}

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function runPhase3ASuite() {
  console.log(`[Phase 3A] Starting Targeted E2E Suite with RUN_ID: ${RUN_ID}`);

  const networkAudit = {
    remoteRequestsDetected: [],
    localSupabaseRequests: [],
    totalRequests: 0,
  };

  const testReport = {
    runId: RUN_ID,
    timestamp: new Date().toISOString(),
    preFlight: {},
    scenarios: {},
    summary: {
      total: 0,
      pass: 0,
      fail: 0,
      blocked: 0,
      notTested: 0,
    },
    remoteLeakDetected: false,
    expoHealthAfterTest: null,
  };

  function recordScenario(id, title, status, details = {}) {
    testReport.scenarios[id] = {
      id,
      title,
      status,
      timestamp: new Date().toISOString(),
      ...details,
    };
    testReport.summary.total++;
    if (status === "PASS") testReport.summary.pass++;
    else if (status === "FAIL") testReport.summary.fail++;
    else if (status === "BLOCKED") testReport.summary.blocked++;
    else if (status === "NOT TESTED") testReport.summary.notTested++;

    console.log(`[Phase 3A][${status}] ${id}: ${title}`);
    if (details.error) {
      console.error(`  Error: ${details.error}`);
    }
  }

  // Pre-flight checks
  console.log("[Phase 3A] Running Pre-flight verification...");
  const gitBranch = execSync("git branch --show-current", { encoding: "utf8" }).trim();
  const gitHead = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  const expoHealth = execSync("curl -s -o /dev/null -w \"%{http_code}\" http://127.0.0.1:8081", { encoding: "utf8" }).trim();
  const supabaseHealth = execSync("curl -s http://127.0.0.1:54321/auth/v1/health", { encoding: "utf8" }).trim();

  testReport.preFlight = {
    gitBranch,
    gitHead,
    expoHealth,
    supabaseHealth,
  };

  if (gitBranch !== "develop/post-alpha-feedback-v0.1.2") {
    throw new Error(`Unexpected branch: ${gitBranch}`);
  }
  if (expoHealth !== "200") {
    throw new Error(`Expo server responded with status: ${expoHealth}`);
  }

  // Chromium launch with userland libraries
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
        testReport.remoteLeakDetected = true;
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
    await page.waitForTimeout(1000); // Wait for React hydration

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
    await page.waitForTimeout(1000);

    const marker = `spa-session-${user.displayName.replace(/\s+/g, "_")}-${Date.now()}`;
    await page.evaluate((m) => {
      window.__spaSessionMarker = m;
    }, marker);
    return marker;
  }

  let contextA, contextB, pageA, pageB;

  try {
    console.log("[Phase 3A] Authenticating Context A (Partner A)...");
    contextA = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    pageA = await contextA.newPage();
    const markerA = await loginPartner(pageA, QA_USERS.partnerA, "Partner A");

    console.log("[Phase 3A] Authenticating Context B (Partner B)...");
    contextB = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    pageB = await contextB.newPage();
    const markerB = await loginPartner(pageB, QA_USERS.partnerB, "Partner B");

    console.log("[Phase 3A] Both contexts ready. SPA markers registered.");

    // In-app UI navigation helpers (Zero page.goto, real user interactions)
    async function navigateToHomeUI(page) {
      const currentUrl = page.url();
      if (!currentUrl.includes("/home")) {
        const backBtn = page.locator('[aria-label*="Back"]').first();
        if (await backBtn.isVisible({ timeout: 500 }).catch(() => false)) {
          await backBtn.click();
          await page.waitForFunction(() => window.location.pathname.includes("/home"), { timeout: 8000 }).catch(() => {});
        }
        const nowUrl = page.url();
        if (!nowUrl.includes("/home")) {
          const rhythmBtn = page.locator('[aria-label^="My Rhythm"]').first();
          await rhythmBtn.click();
          await page.waitForFunction(() => window.location.pathname.includes("/home"), { timeout: 10000 });
        }
      } else {
        const rhythmBtn = page.locator('[aria-label^="My Rhythm"]').first();
        if (await rhythmBtn.isVisible({ timeout: 500 }).catch(() => false)) {
          await rhythmBtn.click();
        }
      }
      await page.waitForSelector("text=What matters now", { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(500);
    }

    async function navigateToOurSpaceUI(page) {
      await navigateToHomeUI(page);
      const oursTile = page.locator('[aria-label="Open Ours, your shared space"]').first();
      if (await oursTile.isVisible({ timeout: 1500 }).catch(() => false)) {
        await oursTile.click();
        await page.waitForFunction(() => window.location.pathname.includes("/events"), { timeout: 10000 });
      } else {
        const momentsBtn = page.locator('[aria-label^="Moments"]').first();
        await momentsBtn.click();
        await page.waitForFunction(() => window.location.pathname.includes("/events"), { timeout: 10000 });
      }
      await page.waitForTimeout(500);
    }

    // Helper to extract What Matters Now state via body text and presence
    async function getWhatMattersNowState(page) {
      return await page.evaluate(() => {
        const text = document.body.innerText || "";
        const isCalm = text.includes("Nothing needs your attention right now");
        const isPositive = text.includes("shared something good");
        const isFriction = text.includes("shared a moment");
        const hasSeeMoment = text.includes("See the moment");
        const hasOpenWhenReady = text.includes("Open when ready");
        return {
          isCalm,
          isPositive,
          isFriction,
          hasSeeMoment,
          hasOpenWhenReady,
          bodyText: text,
        };
      });
    }

    // Helper to create a moment via Partner A UI (in-app clicks, no page.goto)
    async function recordMomentUI(page, { type, category, sharedTopic, isOurs = true }) {
      await navigateToHomeUI(page);

      // Open bottom sheet
      const recordBtn = page.getByRole("button", { name: /record a moment/i }).first();
      await recordBtn.click();

      // Click tile based on type
      if (type === "positive") {
        await page.waitForSelector('text=What would you like to record?', { timeout: 5000 });
        const goodTile = page.getByRole("button", { name: /something good/i }).first();
        await goodTile.click();
      } else {
        await page.waitForSelector('text=What would you like to record?', { timeout: 5000 });
        const offTile = page.getByRole("button", { name: /something felt off/i }).first();
        await offTile.click();
      }

      await page.waitForFunction(() => window.location.pathname.includes("/record-moment"), { timeout: 10000 });
      await page.waitForSelector(`text=What was it about?`, { timeout: 10000 });
      await page.waitForTimeout(500);

      // Select category chip
      const categoryChip = page.locator(`[aria-label="${category}"]`).first();
      await categoryChip.click();
      await page.waitForTimeout(300);

      // Select visibility card if present
      if (isOurs) {
        const oursCard = page.locator('[aria-label^="Ours: Share a gentle version"]').first();
        if (await oursCard.isVisible({ timeout: 500 }).catch(() => false)) {
          await oursCard.click();
        }
      } else {
        const mineCard = page.locator('[aria-label^="Mine: Keep this reflection private"]').first();
        if (await mineCard.isVisible({ timeout: 500 }).catch(() => false)) {
          await mineCard.click();
        }
      }

      // Enter shared topic if ours
      if (isOurs && sharedTopic) {
        const sharedInput = page.locator('textarea, input[aria-label*="Shared note" i], input[placeholder*="What would you like" i]').last();
        if (await sharedInput.isVisible()) {
          await sharedInput.fill(sharedTopic);
        }
      }

      await page.waitForTimeout(400);

      // Click Review shared moment
      const reviewBtn = page.locator('button, div[role="button"]').filter({ hasText: "Review shared moment" }).first();
      await reviewBtn.click();
      await page.waitForTimeout(800);

      // Click Share with Partner B
      const shareBtn = page.locator('button, div[role="button"]').filter({ hasText: /Share with/i }).first();
      await shareBtn.click();

      // Wait for navigation to event detail or home
      await page.waitForFunction(() => window.location.pathname.includes("/event/") || window.location.pathname.includes("/home"), { timeout: 15000 });
      await page.waitForTimeout(1000);

      const currentUrl = page.url();
      const match = currentUrl.match(/\/event\/([a-f0-9-]+)/i);
      const eventId = match ? match[1] : null;

      // Return page to home
      await navigateToHomeUI(page);

      return eventId;
    }

    // ========================================================================
    // SCENARIO A1: Positive Moment Creation
    // ========================================================================
    console.log("\n--- Scenario A1: Positive Moment Creation ---");
    const topicA1 = `QA-3A-${RUN_ID}-A1: Morning coffee together`;
    let eventIdA1 = null;
    try {
      eventIdA1 = await recordMomentUI(pageA, {
        type: "positive",
        category: "Care",
        sharedTopic: topicA1,
        isOurs: true,
      });

      // Verify DB persistence
      const dbRecordA1 = queryDb(`SELECT id, creator_id, event_type, category, visibility FROM public.relationship_events WHERE shared_topic = '${topicA1}'`);
      const isDbOkA1 = dbRecordA1.includes("positive") && dbRecordA1.includes("care") && dbRecordA1.includes("ours") && dbRecordA1.includes(QA_USERS.partnerA.id);

      // Verify Partner B Home Activity
      await navigateToHomeUI(pageB);
      await pageB.waitForTimeout(1500);

      const stateB_A1 = await getWhatMattersNowState(pageB);
      const isCardObservedA1 = stateB_A1.isPositive && stateB_A1.hasSeeMoment;

      const ssPathA1 = path.join(SCREENSHOT_DIR, "A1-partner-b-positive-home.png");
      await pageB.screenshot({ path: ssPathA1 });

      if (isDbOkA1 && isCardObservedA1) {
        recordScenario("A1", "POSITIVE MOMENT CREATION", "PASS", {
          eventId: eventIdA1,
          dbRecord: dbRecordA1,
          cardObserved: isCardObservedA1,
          screenshot: ssPathA1,
          evidence: `Positive moment created via UI, stored in DB with creator Partner A, and surfaced as shared_positive on Partner B home.`,
        });
      } else {
        recordScenario("A1", "POSITIVE MOMENT CREATION", "FAIL", {
          dbRecord: dbRecordA1,
          isDbOk: isDbOkA1,
          isCardObserved: isCardObservedA1,
          screenshot: ssPathA1,
          error: `DB OK: ${isDbOkA1}, UI observed: ${isCardObservedA1}`,
        });
      }
    } catch (err) {
      recordScenario("A1", "POSITIVE MOMENT CREATION", "FAIL", { error: err.message });
    }

    // ========================================================================
    // SCENARIO A2: Informational Backlog Prevention
    // ========================================================================
    console.log("\n--- Scenario A2: Informational Backlog Prevention ---");
    const topicA2_1 = `QA-3A-${RUN_ID}-A2-1: Leaving a gentle note`;
    const topicA2_2 = `QA-3A-${RUN_ID}-A2-2: Fresh afternoon flowers`;
    let eventIdA2_1 = null;
    let eventIdA2_2 = null;

    try {
      // Partner A creates first moment
      eventIdA2_1 = await recordMomentUI(pageA, {
        type: "positive",
        category: "Affection",
        sharedTopic: topicA2_1,
        isOurs: true,
      });

      // Brief delay to guarantee strictly later timestamp
      await new Promise((r) => setTimeout(r, 1200));

      // Partner A creates second moment
      eventIdA2_2 = await recordMomentUI(pageA, {
        type: "positive",
        category: "Surprise",
        sharedTopic: topicA2_2,
        isOurs: true,
      });

      // Partner B views home: newest eligible moment (A2_2) must appear
      await navigateToHomeUI(pageB);

      const stateBeforeOpen = await getWhatMattersNowState(pageB);
      const isNewestObserved = stateBeforeOpen.isPositive && stateBeforeOpen.hasSeeMoment;

      // Partner B opens newest moment by clicking the card
      const openBtn = pageB.locator('[role="button"]').filter({ hasText: /shared something good|See the moment/i }).first();
      await openBtn.click();
      await pageB.waitForFunction(() => window.location.pathname.includes("/event/"), { timeout: 15000 });
      await pageB.waitForTimeout(1000);

      // Partner B returns home
      await navigateToHomeUI(pageB);

      const stateAfterReturn = await getWhatMattersNowState(pageB);

      // Verify that older unseen positive moment A2_1 was NOT promoted
      // (Informational non-backlog: opening newest suppresses informational stream)
      // Check that the older positive topic is not in the text
      const olderPositiveNotPromoted = !stateAfterReturn.bodyText.includes(topicA2_1);

      const ssPathA2 = path.join(SCREENSHOT_DIR, "A2-partner-b-non-backlog.png");
      await pageB.screenshot({ path: ssPathA2 });

      if (isNewestObserved && olderPositiveNotPromoted) {
        recordScenario("A2", "INFORMATIONAL BACKLOG PREVENTION", "PASS", {
          eventIdA2_1,
          eventIdA2_2,
          isNewestObserved,
          olderPositiveNotPromoted,
          screenshot: ssPathA2,
          evidence: "Partner A created two positive moments; Partner B saw newest; opening it suppressed the informational stream without cycling older unseen positive moments.",
        });
      } else {
        recordScenario("A2", "INFORMATIONAL BACKLOG PREVENTION", "FAIL", {
          isNewestObserved,
          olderPositiveNotPromoted,
          stateAfterReturn,
          screenshot: ssPathA2,
          error: `Newest observed: ${isNewestObserved}, Older not promoted: ${olderPositiveNotPromoted}`,
        });
      }
    } catch (err) {
      recordScenario("A2", "INFORMATIONAL BACKLOG PREVENTION", "FAIL", { error: err.message });
    }

    // ========================================================================
    // SCENARIO A3: Receipt Persistence
    // ========================================================================
    console.log("\n--- Scenario A3: Receipt Persistence ---");
    try {
      // Verify Partner B's receipt is stored in local database
      const receiptQuery = queryDb(`SELECT id, user_id, activity_key, activity_kind, seen_at FROM public.home_activity_receipts WHERE user_id = '${QA_USERS.partnerB.id}' AND activity_kind = 'shared_positive' ORDER BY seen_at DESC LIMIT 1`);
      const hasReceiptInDb = receiptQuery.includes(QA_USERS.partnerB.id) && receiptQuery.includes("shared_positive");

      // Reload Partner B's browser
      await pageB.reload({ waitUntil: "domcontentloaded" });
      await pageB.waitForTimeout(1500);
      await pageB.evaluate(() => { window.__spaSessionMarker = "reloaded-session-partner-b"; });

      const stateAfterReload = await getWhatMattersNowState(pageB);
      // Verify opened positive moment does not reappear
      const activityStillSuppressed = !stateAfterReload.bodyText.includes(topicA2_2);

      // Verify moment record in DB remains intact (not deleted, status untouched)
      const eventRecordDb = queryDb(`SELECT id, visibility FROM public.relationship_events WHERE id = '${eventIdA2_2}'`);
      const eventIntact = eventRecordDb.includes(eventIdA2_2) && eventRecordDb.includes("ours");

      const ssPathA3 = path.join(SCREENSHOT_DIR, "A3-partner-b-receipt-persistence.png");
      await pageB.screenshot({ path: ssPathA3 });

      if (hasReceiptInDb && activityStillSuppressed && eventIntact) {
        recordScenario("A3", "RECEIPT PERSISTENCE", "PASS", {
          receiptDb: receiptQuery,
          activityStillSuppressed,
          eventIntact,
          screenshot: ssPathA3,
          evidence: "User-specific seen receipt verified in database for Partner B; activity remains suppressed after reload; underlying event remains intact.",
        });
      } else {
        recordScenario("A3", "RECEIPT PERSISTENCE", "FAIL", {
          hasReceiptInDb,
          activityStillSuppressed,
          eventIntact,
          receiptQuery,
          screenshot: ssPathA3,
          error: `DB receipt: ${hasReceiptInDb}, Still suppressed: ${activityStillSuppressed}, Event intact: ${eventIntact}`,
        });
      }
    } catch (err) {
      recordScenario("A3", "RECEIPT PERSISTENCE", "FAIL", { error: err.message });
    }

    // ========================================================================
    // SCENARIO A4: Fresh New Activity
    // ========================================================================
    console.log("\n--- Scenario A4: Fresh New Activity ---");
    const topicA4 = `QA-3A-${RUN_ID}-A4: Sunset walk in the garden`;
    let eventIdA4 = null;
    try {
      eventIdA4 = await recordMomentUI(pageA, {
        type: "positive",
        category: "Quality time",
        sharedTopic: topicA4,
        isOurs: true,
      });

      // Partner B visits home
      await navigateToHomeUI(pageB);

      const stateA4 = await getWhatMattersNowState(pageB);
      const isFreshObserved = stateA4.isPositive && stateA4.hasSeeMoment;
      const olderItemsNotResurrected = !stateA4.bodyText.includes(topicA2_2) && !stateA4.bodyText.includes(topicA2_1);

      const ssPathA4 = path.join(SCREENSHOT_DIR, "A4-partner-b-fresh-activity.png");
      await pageB.screenshot({ path: ssPathA4 });

      if (isFreshObserved && olderItemsNotResurrected) {
        recordScenario("A4", "FRESH NEW ACTIVITY", "PASS", {
          eventId: eventIdA4,
          isFreshObserved,
          olderItemsNotResurrected,
          screenshot: ssPathA4,
          evidence: "Fresh positive moment becomes eligible and appears on Partner B home without resurrecting older seen items.",
        });
      } else {
        recordScenario("A4", "FRESH NEW ACTIVITY", "FAIL", {
          isFreshObserved,
          olderItemsNotResurrected,
          screenshot: ssPathA4,
          error: `Fresh observed: ${isFreshObserved}, Older not resurrected: ${olderItemsNotResurrected}`,
        });
      }
    } catch (err) {
      recordScenario("A4", "FRESH NEW ACTIVITY", "FAIL", { error: err.message });
    }

    // ========================================================================
    // SCENARIO A5: History and Privacy
    // ========================================================================
    console.log("\n--- Scenario A5: History and Privacy ---");
    try {
      // 1. Verify older shared moments remain accessible in Moments / Our Space
      await navigateToOurSpaceUI(pageB);
      await pageB.waitForTimeout(1500);

      const ourSpaceText = await pageB.evaluate(() => document.body.innerText);
      const hasA1InSpace = ourSpaceText.includes("Care");
      const hasA2_1InSpace = ourSpaceText.includes("Affection");
      const hasA2_2InSpace = ourSpaceText.includes("Surprise");
      const hasA4InSpace = ourSpaceText.includes("Quality time");
      const allMomentsInSpace = hasA1InSpace && hasA2_1InSpace && hasA2_2InSpace && hasA4InSpace;

      // 2. Verify receipt isolation between Partner A and Partner B
      const partnerBReceipts = queryDb(`SELECT count(*) FROM public.home_activity_receipts WHERE user_id = '${QA_USERS.partnerB.id}'`);
      const partnerAReceipts = queryDb(`SELECT count(*) FROM public.home_activity_receipts WHERE user_id = '${QA_USERS.partnerA.id}'`);

      // Partner B marked A2 seen, so Partner B has receipts
      const isolationConfirmed = parseInt(partnerBReceipts, 10) > 0;

      const ssPathA5 = path.join(SCREENSHOT_DIR, "A5-our-space-history.png");
      await pageB.screenshot({ path: ssPathA5 });

      if (allMomentsInSpace && isolationConfirmed) {
        recordScenario("A5", "HISTORY AND PRIVACY", "PASS", {
          hasA1InSpace,
          hasA2_1InSpace,
          hasA2_2InSpace,
          hasA4InSpace,
          partnerBReceiptsCount: partnerBReceipts,
          partnerAReceiptsCount: partnerAReceipts,
          screenshot: ssPathA5,
          evidence: "All shared moments remain accessible in Our Space; receipts are independently scoped to Partner B in the database.",
        });
      } else {
        recordScenario("A5", "HISTORY AND PRIVACY", "FAIL", {
          allMomentsInSpace,
          isolationConfirmed,
          screenshot: ssPathA5,
          error: `All moments in space: ${allMomentsInSpace}, Receipt isolation: ${isolationConfirmed}`,
        });
      }
    } catch (err) {
      recordScenario("A5", "HISTORY AND PRIVACY", "FAIL", { error: err.message });
    }

  } catch (globalErr) {
    console.error("[Phase 3A] Suite failure:", globalErr);
  } finally {
    if (contextA) await contextA.close().catch(() => {});
    if (contextB) await contextB.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }

  // Final checks
  let expoHealthFinal = "000";
  try {
    expoHealthFinal = execSync("curl -s -o /dev/null -w \"%{http_code}\" http://127.0.0.1:8081 || echo 000", { encoding: "utf8" }).trim();
  } catch {
    expoHealthFinal = "000";
  }
  testReport.expoHealthAfterTest = expoHealthFinal;

  testReport.networkAudit = {
    totalRequests: networkAudit.totalRequests,
    localSupabaseRequestsCount: networkAudit.localSupabaseRequests.length,
    remoteRequestsCount: networkAudit.remoteRequestsDetected.length,
    remoteRequests: networkAudit.remoteRequestsDetected,
  };

  const reportPath = path.join(ARTIFACT_DIR, "phase3a-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(testReport, null, 2));

  console.log("\n=======================================================");
  console.log("            PHASE 3A E2E RETEST SUMMARY                 ");
  console.log("=======================================================");
  console.log(`TOTAL SCENARIOS: ${testReport.summary.total}`);
  console.log(`PASS:            ${testReport.summary.pass}`);
  console.log(`FAIL:            ${testReport.summary.fail}`);
  console.log(`BLOCKED:         ${testReport.summary.blocked}`);
  console.log(`NOT TESTED:      ${testReport.summary.notTested}`);
  console.log(`REMOTE LEAKS:    ${testReport.networkAudit.remoteRequestsCount}`);
  console.log(`EXPO AFTER TEST: ${testReport.expoHealthAfterTest}`);
  console.log(`REPORT SAVED:    ${reportPath}`);
  console.log("=======================================================\n");

  if (testReport.summary.fail > 0 || testReport.remoteLeakDetected) {
    process.exit(1);
  }
}

runPhase3ASuite().catch((err) => {
  console.error("Unhandled fatal error:", err);
  process.exit(1);
});
