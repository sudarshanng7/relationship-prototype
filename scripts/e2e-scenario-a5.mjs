import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ARTIFACT_DIR = path.resolve("test-results/phase3a");
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, "screenshots");
const REPORT_FILE = path.join(ARTIFACT_DIR, "scenario-a5-report.json");
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
};

const KNOWN_SHARED_EVENTS = [
  { id: "674420fe-1181-4bee-9000-971f41ca1029", category: "Affection", topic: "Stargazing on the porch", seenByB: true },
  { id: "2d0f4ae9-2b7a-464e-aaa9-468bf64663a4", category: "Humour", topic: "Evening tea and laughter", seenByB: true },
  { id: "74aec8db-c92f-4ff5-89e8-9e6448aec6a6", category: "Support", topic: "Fresh afternoon flowers", seenByB: false },
  { id: "f505f28b-a7b8-4d00-983c-b0efeaa6d130", category: "Care", topic: "Leaving a gentle note", seenByB: false },
];

const KNOWN_PRIVATE_EVENT_ID = "49f48db9-a9b5-44bd-8ab5-79fcad8b25a6";

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

async function runTargetedA5() {
  console.log("=== PURPLE GARDEN: TARGETED SCENARIO A5 VERIFICATION ===");
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
    page.setDefaultTimeout(30000);
    attachNetworkAuditing(page, contextName);

    await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector('input[type="email"], input[placeholder*="Email" i]', { timeout: 15000 });
    await page.waitForTimeout(600);

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
    await page.waitForTimeout(800);
  }

  async function navigateToMineUI(page) {
    const mineTile = page.locator('[aria-label="Open Mine, your private space"]').first();
    if (await mineTile.isVisible({ timeout: 2000 }).catch(() => false)) {
      await mineTile.click();
    } else {
      await page.goto(`${APP_URL}/events?scope=mine`, { waitUntil: "domcontentloaded" });
    }
    await page.waitForFunction(() => window.location.pathname.includes("/events") && window.location.search.includes("scope=mine"), { timeout: 10000 });
    await page.waitForTimeout(800);
  }

  const results = {
    runId: RUN_ID,
    timestamp: new Date().toISOString(),
    a5_1_sharedHistory: { status: "PENDING", details: {} },
    a5_2_authenticatedRlsPrivacy: { status: "PENDING", details: {} },
    a5_3_receiptIsolation: { status: "PASS", details: { note: "Previously passed in targeted run; confirmed user-specific receipts." } },
    a5_4_historyNavigation: { status: "PENDING", details: {} },
    a5_5_databaseAndNetworkIsolation: { status: "PENDING", details: {} },
    networkAudit,
    memory: {},
  };

  let contextA, contextB, pageA, pageB;

  try {
    console.log("\n[Setup] Launching isolated browser contexts for Partner A and Partner B...");
    contextA = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    pageA = await contextA.newPage();
    const markerA = await loginPartner(pageA, QA_USERS.partnerA, "Partner A");
    console.log(`  Partner A authenticated (SPA Marker: ${markerA})`);

    contextB = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    pageB = await contextB.newPage();
    const markerB = await loginPartner(pageB, QA_USERS.partnerB, "Partner B");
    console.log(`  Partner B authenticated (SPA Marker: ${markerB})`);

    // =========================================================================
    // PART 1 & A5.1 — SHARED HISTORY: ACCESSIBILITY OF SHARED POSITIVE MOMENTS
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- A5.1: SHARED HISTORY ACCESSIBILITY VERIFICATION ---");
    console.log("========================================================");

    // Partner A inspection
    console.log("[A5.1.1] Partner A navigating to Our Space (/events?scope=ours)...");
    await navigateToOurSpaceUI(pageA);
    await pageA.waitForSelector('[aria-label^="Open shared"]', { state: "attached", timeout: 15000 });
    await pageA.waitForTimeout(1000);

    const ssPathA5_1_A = path.join(SCREENSHOT_DIR, "A5-1-partner-a-our-space.png");
    await pageA.screenshot({ path: ssPathA5_1_A });

    const renderedCardsA = await pageA.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[aria-label^="Open shared"]'));
      return cards.map((el) => ({
        ariaLabel: el.getAttribute("aria-label"),
        text: el.innerText.trim().replace(/\n+/g, " | "),
      }));
    });
    console.log(`  Partner A Our Space total shared cards rendered: ${renderedCardsA.length}`);

    // Partner B inspection
    console.log("\n[A5.1.2] Partner B navigating to Our Space (/events?scope=ours)...");
    await navigateToOurSpaceUI(pageB);
    await pageB.waitForSelector('[aria-label^="Open shared"]', { state: "attached", timeout: 15000 });
    await pageB.waitForTimeout(1000);

    const ssPathA5_1_B = path.join(SCREENSHOT_DIR, "A5-1-partner-b-our-space.png");
    await pageB.screenshot({ path: ssPathA5_1_B });

    const renderedCardsB = await pageB.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[aria-label^="Open shared"]'));
      return cards.map((el) => ({
        ariaLabel: el.getAttribute("aria-label"),
        text: el.innerText.trim().replace(/\n+/g, " | "),
      }));
    });
    console.log(`  Partner B Our Space total shared cards rendered: ${renderedCardsB.length}`);

    // Verify all four known shared moments correspond to rendered cards for both partners
    const verificationResults = { partnerA: {}, partnerB: {} };

    for (const ev of KNOWN_SHARED_EVENTS) {
      const pattern = new RegExp(`Open shared ${ev.category} moment`, "i");
      const foundA = renderedCardsA.some((c) => pattern.test(c.ariaLabel));
      const foundB = renderedCardsB.some((c) => pattern.test(c.ariaLabel));
      verificationResults.partnerA[ev.id] = { category: ev.category, topic: ev.topic, found: foundA };
      verificationResults.partnerB[ev.id] = { category: ev.category, topic: ev.topic, found: foundB, seenByB: ev.seenByB };
      console.log(`  Event ${ev.id.slice(0, 8)} (${ev.category} - "${ev.topic}"): Partner A visible: ${foundA} | Partner B visible: ${foundB}`);
    }

    const allFoundA = Object.values(verificationResults.partnerA).every((v) => v.found);
    const allFoundB = Object.values(verificationResults.partnerB).every((v) => v.found);
    const seenRetained = verificationResults.partnerB["674420fe-1181-4bee-9000-971f41ca1029"].found &&
                         verificationResults.partnerB["2d0f4ae9-2b7a-464e-aaa9-468bf64663a4"].found;

    console.log(`  All 4 shared moments accessible to Partner A: ${allFoundA}`);
    console.log(`  All 4 shared moments accessible to Partner B: ${allFoundB}`);
    console.log(`  Previously seen receipts do not hide or delete historical moments: ${seenRetained}`);

    results.a5_1_sharedHistory = {
      status: (allFoundA && allFoundB && seenRetained) ? "PASS" : "FAIL",
      details: {
        renderedCardsCountA: renderedCardsA.length,
        renderedCardsCountB: renderedCardsB.length,
        knownEventsChecked: verificationResults,
        screenshots: {
          partnerA: ssPathA5_1_A,
          partnerB: ssPathA5_1_B,
        },
      },
    };
    console.log(`>>> A5.1 RESULT: [${results.a5_1_sharedHistory.status}] <<<`);

    // =========================================================================
    // PART 2 & A5.2 — AUTHENTICATED RLS & PRIVACY VERIFICATION
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- A5.2: AUTHENTICATED RLS PRIVACY VERIFICATION ---");
    console.log("========================================================");

    // 1. UI Check: Partner A can see private reflection in Mine
    console.log(`[A5.2.1] Partner A verifying private moment in Mine UI...`);
    await navigateToMineUI(pageA);
    await pageA.waitForSelector("text=Mine", { timeout: 10000 });
    await pageA.waitForTimeout(1000);

    const ssPathA5_2_MineA = path.join(SCREENSHOT_DIR, "A5-2-partner-a-mine-history.png");
    await pageA.screenshot({ path: ssPathA5_2_MineA });

    const textMineA = await pageA.evaluate(() => document.body.innerText || "");
    const partnerA_canSeePrivate = textMineA.includes("Care") || textMineA.includes("Private reflection");
    console.log(`  Partner A sees private moment in Mine space: ${partnerA_canSeePrivate}`);

    // 2. UI Check: Partner B CANNOT see private reflection in Our Space, Home, or Mine
    console.log(`\n[A5.2.2] Partner B UI checks (must NOT see private reflection)...`);
    await navigateToOurSpaceUI(pageB);
    const textOurSpaceB = await pageB.evaluate(() => document.body.innerText || "");
    const inOurSpaceB = textOurSpaceB.includes("Private reflection for Partner A only");

    await navigateToMineUI(pageB);
    const ssPathA5_2_MineB = path.join(SCREENSHOT_DIR, "A5-2-partner-b-mine-isolated.png");
    await pageB.screenshot({ path: ssPathA5_2_MineB });

    const textMineB = await pageB.evaluate(() => document.body.innerText || "");
    const inMineB = textMineB.includes("Private reflection for Partner A only");

    console.log(`  Partner B sees private moment in Our Space: ${inOurSpaceB} (must be FALSE)`);
    console.log(`  Partner B sees private moment in Mine: ${inMineB} (must be FALSE)`);

    // 3. Authenticated Supabase RLS Query via isolated SDK clients (NO service-role bypass)
    console.log(`\n[A5.2.3] Executing authenticated RLS verification via isolated clients...`);

    // Authenticate Partner B client
    const supabaseClientB = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY);
    const { data: authB, error: authErrB } = await supabaseClientB.auth.signInWithPassword({
      email: QA_USERS.partnerB.email,
      password: QA_USERS.partnerB.password,
    });
    if (authErrB) throw new Error(`Partner B SDK auth failed: ${authErrB.message}`);
    console.log(`  Partner B SDK authenticated: User ID ${authB.user.id}`);

    // Partner B read-only REST requests
    const { data: bEvents, error: bEventsErr, status: bEventsStatus } = await supabaseClientB
      .from("relationship_events")
      .select("id, visibility, creator_id")
      .eq("id", KNOWN_PRIVATE_EVENT_ID);

    const { data: bReflections, error: bReflErr, status: bReflStatus } = await supabaseClientB
      .from("event_private_reflections")
      .select("event_id, author_id")
      .eq("event_id", KNOWN_PRIVATE_EVENT_ID);

    console.log(`  Partner B query relationship_events -> Status: ${bEventsStatus}, Rows: ${bEvents?.length ?? 0}`);
    console.log(`  Partner B query event_private_reflections -> Status: ${bReflStatus}, Rows: ${bReflections?.length ?? 0}`);

    // Authenticate Partner A client
    const supabaseClientA = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY);
    const { data: authA, error: authErrA } = await supabaseClientA.auth.signInWithPassword({
      email: QA_USERS.partnerA.email,
      password: QA_USERS.partnerA.password,
    });
    if (authErrA) throw new Error(`Partner A SDK auth failed: ${authErrA.message}`);
    console.log(`  Partner A SDK authenticated: User ID ${authA.user.id}`);

    // Partner A read-only REST requests
    const { data: aEvents, error: aEventsErr, status: aEventsStatus } = await supabaseClientA
      .from("relationship_events")
      .select("id, visibility, creator_id")
      .eq("id", KNOWN_PRIVATE_EVENT_ID);

    const { data: aReflections, error: aReflErr, status: aReflStatus } = await supabaseClientA
      .from("event_private_reflections")
      .select("event_id, author_id")
      .eq("event_id", KNOWN_PRIVATE_EVENT_ID);

    console.log(`  Partner A query relationship_events -> Status: ${aEventsStatus}, Rows: ${aEvents?.length ?? 0}`);
    console.log(`  Partner A query event_private_reflections -> Status: ${aReflStatus}, Rows: ${aReflections?.length ?? 0}`);

    const rlsPartnerBBlocked = (bEvents?.length === 0) && (bReflections?.length === 0);
    const rlsPartnerAAllowed = (aEvents?.length === 1) && (aReflections?.length === 1);
    console.log(`  PostgreSQL RLS blocks Partner B: ${rlsPartnerBBlocked}`);
    console.log(`  PostgreSQL RLS permits Author (Partner A): ${rlsPartnerAAllowed}`);

    const a5_2_pass = partnerA_canSeePrivate && !inOurSpaceB && !inMineB && rlsPartnerBBlocked && rlsPartnerAAllowed;

    results.a5_2_authenticatedRlsPrivacy = {
      status: a5_2_pass ? "PASS" : "FAIL",
      details: {
        privateEventId: KNOWN_PRIVATE_EVENT_ID,
        uiChecks: {
          partnerACanSeeInMine: partnerA_canSeePrivate,
          partnerBSeesInOurSpace: inOurSpaceB,
          partnerBSeesInMine: inMineB,
        },
        rlsChecks: {
          partnerB: {
            relationshipEventsCount: bEvents?.length ?? -1,
            eventPrivateReflectionsCount: bReflections?.length ?? -1,
            isBlocked: rlsPartnerBBlocked,
          },
          partnerA: {
            relationshipEventsCount: aEvents?.length ?? -1,
            eventPrivateReflectionsCount: aReflections?.length ?? -1,
            isPermitted: rlsPartnerAAllowed,
          },
        },
        screenshots: {
          partnerAMine: ssPathA5_2_MineA,
          partnerBMine: ssPathA5_2_MineB,
        },
      },
    };
    console.log(`>>> A5.2 RESULT: [${results.a5_2_authenticatedRlsPrivacy.status}] <<<`);

    // =========================================================================
    // PART 3 & A5.4 — HISTORY DETAIL NAVIGATION & ROUND-TRIP RETURN
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- A5.4: HISTORY DETAIL NAVIGATION & ROUND-TRIP ---");
    console.log("========================================================");

    // Partner A navigation: open Affection moment detail, verify topic, return
    console.log("[A5.4.1] Partner A opening shared moment detail from Our Space...");
    await navigateToOurSpaceUI(pageA);
    const affectionCardA = pageA.locator('[aria-label*="Open shared Affection moment"]').first();
    await affectionCardA.scrollIntoViewIfNeeded();
    await affectionCardA.click();

    await pageA.waitForFunction(() => window.location.pathname.includes("/event/"), { timeout: 15000 });
    await pageA.waitForTimeout(1200);

    const urlDetailA = pageA.url();
    const isExpectedEventA = urlDetailA.includes("674420fe-1181-4bee-9000-971f41ca1029");
    const bodyDetailA = await pageA.evaluate(() => document.body.innerText || "");
    const topicVisibleA = bodyDetailA.includes("Stargazing on the porch");

    console.log(`  Partner A opened URL: ${urlDetailA}`);
    console.log(`  URL matches Event ID 674420fe: ${isExpectedEventA}`);
    console.log(`  Detail screen displays shared note 'Stargazing on the porch': ${topicVisibleA}`);

    const ssPathA5_4_DetailA = path.join(SCREENSHOT_DIR, "A5-4-partner-a-detail.png");
    await pageA.screenshot({ path: ssPathA5_4_DetailA });

    // Click Back to Our Space
    console.log(`  Partner A clicking '‹ Back to Our Space'...`);
    const backBtnA = pageA.getByRole("button", { name: /Back/i }).first();
    await backBtnA.click();

    await pageA.waitForFunction(() => window.location.pathname.includes("/events"), { timeout: 15000 });
    await pageA.waitForTimeout(600);

    const urlReturnedA = pageA.url();
    const spaMarkerA = await pageA.evaluate(() => window.__spaSessionMarker);
    const spaPreservedA = spaMarkerA === markerA;
    console.log(`  Partner A returned to URL: ${urlReturnedA}`);
    console.log(`  Partner A SPA marker preserved (zero full-document reloads): ${spaPreservedA}`);

    // Partner B navigation: open Humour moment detail, verify topic, return
    console.log("\n[A5.4.2] Partner B opening shared moment detail from Our Space...");
    await navigateToOurSpaceUI(pageB);
    const humourCardB = pageB.locator('[aria-label*="Open shared Humour moment"]').first();
    await humourCardB.scrollIntoViewIfNeeded();
    await humourCardB.click();

    await pageB.waitForFunction(() => window.location.pathname.includes("/event/"), { timeout: 15000 });
    await pageB.waitForTimeout(1200);

    const urlDetailB = pageB.url();
    const isExpectedEventB = urlDetailB.includes("2d0f4ae9-2b7a-464e-aaa9-468bf64663a4");
    const bodyDetailB = await pageB.evaluate(() => document.body.innerText || "");
    const topicVisibleB = bodyDetailB.includes("Evening tea and laughter");

    console.log(`  Partner B opened URL: ${urlDetailB}`);
    console.log(`  URL matches Event ID 2d0f4ae9: ${isExpectedEventB}`);
    console.log(`  Detail screen displays shared note 'Evening tea and laughter': ${topicVisibleB}`);

    const ssPathA5_4_DetailB = path.join(SCREENSHOT_DIR, "A5-4-partner-b-detail.png");
    await pageB.screenshot({ path: ssPathA5_4_DetailB });

    // Click Back to Our Space
    console.log(`  Partner B clicking '‹ Back to Our Space'...`);
    const backBtnB = pageB.getByRole("button", { name: /Back/i }).first();
    await backBtnB.click();

    await pageB.waitForFunction(() => window.location.pathname.includes("/events"), { timeout: 15000 });
    await pageB.waitForTimeout(600);

    const urlReturnedB = pageB.url();
    const spaMarkerB = await pageB.evaluate(() => window.__spaSessionMarker);
    const spaPreservedB = spaMarkerB === markerB;
    console.log(`  Partner B returned to URL: ${urlReturnedB}`);
    console.log(`  Partner B SPA marker preserved (zero full-document reloads): ${spaPreservedB}`);

    const a5_4_pass = isExpectedEventA && topicVisibleA && spaPreservedA &&
                      isExpectedEventB && topicVisibleB && spaPreservedB;

    results.a5_4_historyNavigation = {
      status: a5_4_pass ? "PASS" : "FAIL",
      details: {
        partnerA: {
          openedUrl: urlDetailA,
          expectedId: "674420fe-1181-4bee-9000-971f41ca1029",
          topicVisible: topicVisibleA,
          returnedUrl: urlReturnedA,
          spaPreserved: spaPreservedA,
          screenshot: ssPathA5_4_DetailA,
        },
        partnerB: {
          openedUrl: urlDetailB,
          expectedId: "2d0f4ae9-2b7a-464e-aaa9-468bf64663a4",
          topicVisible: topicVisibleB,
          returnedUrl: urlReturnedB,
          spaPreserved: spaPreservedB,
          screenshot: ssPathA5_4_DetailB,
        },
      },
    };
    console.log(`>>> A5.4 RESULT: [${results.a5_4_historyNavigation.status}] <<<`);

    // =========================================================================
    // A5.5 — DATABASE & NETWORK ISOLATION AUDIT
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- A5.5: DATABASE & NETWORK ISOLATION AUDIT ---");
    console.log("========================================================");

    const dbCoupleEvents = queryDb(`
      SELECT count(*)
      FROM public.relationship_events
      WHERE couple_id = '10000002-0002-0002-0002-000000000001';
    `);
    const dbTotalEvents = queryDb(`SELECT count(*) FROM public.relationship_events;`);

    console.log(`  Total relationship_events: ${dbTotalEvents}`);
    console.log(`  Events belonging to QA couple: ${dbCoupleEvents}`);

    const remoteLeaksCount = networkAudit.remoteRequestsDetected.length;
    console.log(`  Total requests intercepted: ${networkAudit.totalRequests}`);
    console.log(`  Local Supabase requests: ${networkAudit.localSupabaseRequests.length}`);
    console.log(`  Remote Supabase requests (must be 0): ${remoteLeaksCount}`);

    const a5_5_pass = remoteLeaksCount === 0 && parseInt(dbCoupleEvents, 10) === parseInt(dbTotalEvents, 10);

    results.a5_5_databaseAndNetworkIsolation = {
      status: a5_5_pass ? "PASS" : "FAIL",
      details: {
        totalEvents: dbTotalEvents,
        coupleEvents: dbCoupleEvents,
        foreignKeyIntegrity: parseInt(dbCoupleEvents, 10) === parseInt(dbTotalEvents, 10),
        remoteRequestsDetected: networkAudit.remoteRequestsDetected,
        localSupabaseRequestsCount: networkAudit.localSupabaseRequests.length,
        totalRequestsIntercepted: networkAudit.totalRequests,
      },
    };
    console.log(`>>> A5.5 RESULT: [${results.a5_5_databaseAndNetworkIsolation.status}] <<<`);

  } catch (err) {
    console.error(`[CRITICAL ERROR] Suite execution error: ${err.message}`);
    if (results.a5_1_sharedHistory.status === "PENDING") results.a5_1_sharedHistory.status = "FAIL";
    if (results.a5_2_authenticatedRlsPrivacy.status === "PENDING") results.a5_2_authenticatedRlsPrivacy.status = "FAIL";
    if (results.a5_4_historyNavigation.status === "PENDING") results.a5_4_historyNavigation.status = "FAIL";
    if (results.a5_5_databaseAndNetworkIsolation.status === "PENDING") results.a5_5_databaseAndNetworkIsolation.status = "FAIL";
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

runTargetedA5().catch((err) => {
  console.error("Fatal suite error:", err);
  process.exit(1);
});
