import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ARTIFACT_DIR = path.resolve("test-results/phase3b");
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, "screenshots");
const REPORT_FILE = path.join(ARTIFACT_DIR, "scenario-b2-report.json");
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

async function runScenarioB2() {
  console.log("=== PURPLE GARDEN: PHASE 3B / SCENARIO B2: PARTNER VISIBILITY & PRIVACY ===");
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

  const results = {
    runId: RUN_ID,
    timestamp: new Date().toISOString(),
    targetEvent: TARGET_EVENT,
    b2_1_partnerBHomeNotification: { status: "PENDING", details: {} },
    b2_2_partnerBSharedEventDetail: { status: "PENDING", details: {} },
    b2_3_partnerAAuthorView: { status: "PENDING", details: {} },
    b2_4_authenticatedRls: { status: "PENDING", details: {} },
    b2_5_nonMutationAndIsolation: { status: "PENDING", details: {} },
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
    // B2.1 — PARTNER B HOME NOTIFICATION
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B2.1: PARTNER B HOME NOTIFICATION ---");
    console.log("========================================================");

    console.log("  Navigating Partner B away from Home to Our Space...");
    await navigateToOurSpaceUI(pageB);
    await pageB.waitForTimeout(800);

    console.log("  Genuinely re-entering My Rhythm to trigger focus refresh...");
    await navigateToHomeUI(pageB);
    await pageB.waitForTimeout(1000);

    const ssPathB2_1 = path.join(SCREENSHOT_DIR, "B2-1-partner-b-home-notification.png");
    await pageB.screenshot({ path: ssPathB2_1 });

    const homeB_State = await pageB.evaluate(() => {
      const text = document.body.innerText || "";
      const hasWhatMatters = text.includes("What matters now");
      const hasSharedMoment = text.includes("shared a moment");
      const hasNoRush = text.includes("There is no rush");
      const hasOpenWhenReady = text.includes("Open when ready");
      return {
        hasWhatMatters,
        hasSharedMoment,
        hasNoRush,
        hasOpenWhenReady,
        snippet: text.slice(0, 1000),
      };
    });

    console.log(`  Partner B Home State:`);
    console.log(`    - What matters now present: ${homeB_State.hasWhatMatters}`);
    console.log(`    - 'Partner A shared a moment' title: ${homeB_State.hasSharedMoment}`);
    console.log(`    - 'There is no rush' body: ${homeB_State.hasNoRush}`);
    console.log(`    - 'Open when ready' action button: ${homeB_State.hasOpenWhenReady}`);

    let b2_1_openedExactId = false;
    let openedUrlB1 = "";
    let existingReceipt = null;

    if (homeB_State.hasOpenWhenReady) {
      console.log("  Tapping 'Open when ready' button...");
      const openBtn = pageB.locator('text="Open when ready"').first();
      await openBtn.click();

      await pageB.waitForFunction(() => window.location.pathname.includes("/event/"), { timeout: 15000 });
      await pageB.waitForTimeout(1000);

      openedUrlB1 = pageB.url();
      b2_1_openedExactId = openedUrlB1.includes(TARGET_EVENT.id);
      console.log(`  Opened URL: ${openedUrlB1}`);
      console.log(`  Exact match with target event ID (${TARGET_EVENT.id}): ${b2_1_openedExactId}`);

      // Return back to Home
      const backToRhythmBtn = pageB.getByRole("button", { name: /Back/i }).first();
      await backToRhythmBtn.click();
      await pageB.waitForFunction(() => window.location.pathname.includes("/home"), { timeout: 15000 });
      await pageB.waitForTimeout(600);
      console.log(`  Returned back to Home: ${pageB.url()}`);
    } else {
      // Check if Partner B already has a legitimate read receipt created through previous UI opening
      console.log("  Checking if Partner B already possesses a legitimate seen receipt for this friction event...");
      const receiptDb = queryDb(`
        SELECT id, activity_key, seen_at
        FROM public.home_activity_receipts
        WHERE user_id = '${QA_USERS.partnerB.id}' AND source_id = '${TARGET_EVENT.id}' AND activity_kind = 'shared_friction';
      `);
      if (receiptDb && receiptDb.includes(TARGET_EVENT.id)) {
        const parts = receiptDb.split("|");
        existingReceipt = { id: parts[0], key: parts[1], seenAt: parts[2] };
        console.log(`  Found existing legitimate UI receipt for Partner B: ID ${existingReceipt.id} (Seen at: ${existingReceipt.seenAt})`);
        console.log(`  What matters now correctly honors non-backlog suppression (shows calm state).`);
      }
    }

    const b2_1_pass = (homeB_State.hasSharedMoment && homeB_State.hasOpenWhenReady && b2_1_openedExactId) ||
                      (existingReceipt !== null && homeB_State.hasWhatMatters);

    results.b2_1_partnerBHomeNotification = {
      status: b2_1_pass ? "PASS" : "FAIL",
      details: {
        homeState: homeB_State,
        openedUrl: openedUrlB1,
        targetEventId: TARGET_EVENT.id,
        exactIdMatch: b2_1_openedExactId,
        existingReceipt,
        screenshot: ssPathB2_1,
      },
    };
    console.log(`>>> B2.1 RESULT: [${results.b2_1_partnerBHomeNotification.status}] <<<`);

    // =========================================================================
    // B2.2 — PARTNER B SHARED EVENT DETAIL
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B2.2: PARTNER B SHARED EVENT DETAIL & PRIVACY ---");
    console.log("========================================================");

    // Navigate through actual Our Space UI to the friction event
    console.log("  Partner B navigating to Our Space (/events?scope=ours)...");
    await navigateToOurSpaceUI(pageB);
    await pageB.waitForSelector('[aria-label^="Open shared"]', { state: "attached", timeout: 15000 });
    await pageB.waitForTimeout(800);

    const targetCard = pageB.locator(`[aria-label*="Open shared ${TARGET_EVENT.categoryLabel} moment"]`).first();
    await targetCard.scrollIntoViewIfNeeded();
    await targetCard.click();

    await pageB.waitForFunction(() => window.location.pathname.includes("/event/"), { timeout: 15000 });
    await pageB.waitForTimeout(1000);

    const ssPathB2_2_Detail = path.join(SCREENSHOT_DIR, "B2-2-partner-b-shared-detail.png");
    await pageB.screenshot({ path: ssPathB2_2_Detail });

    const detailB_Text = await pageB.evaluate(() => document.body.innerText || "");

    const showsSharedOverlineB = detailB_Text.includes("SHARED MOMENT");
    const showsCategoryB = detailB_Text.includes(TARGET_EVENT.categoryLabel);
    const showsSharedTopicB = detailB_Text.includes(TARGET_EVENT.sharedTopicText);
    const showsUnresolvedStatusB = detailB_Text.includes("Still lingering") || detailB_Text.includes("Open");

    // CRITICAL PRIVACY CHECK: Partner A's private reflection must NEVER appear in Partner B's UI
    const exposesPartnerAPrivateNoteB = detailB_Text.includes(TARGET_EVENT.privateReflectionText);
    const privacyPreservedInUIB = !exposesPartnerAPrivateNoteB;

    console.log(`  Partner B Detail Screen:`);
    console.log(`    - Overline 'SHARED MOMENT': ${showsSharedOverlineB}`);
    console.log(`    - Category 'Household': ${showsCategoryB}`);
    console.log(`    - Shared note text present: ${showsSharedTopicB}`);
    console.log(`    - Status is unresolved ('Open' / 'Still lingering'): ${showsUnresolvedStatusB}`);
    console.log(`    - Partner A private note exposed: ${exposesPartnerAPrivateNoteB} (must be FALSE)`);
    console.log(`    - UI privacy preserved: ${privacyPreservedInUIB}`);

    // Return to Our Space and verify roundtrip
    console.log("\n  Partner B navigating back to Our Space via '‹ Back to Our Space'...");
    const backBtnB = pageB.getByRole("button", { name: /Back/i }).first();
    await backBtnB.click();

    await pageB.waitForFunction(() => window.location.pathname.includes("/events"), { timeout: 15000 });
    await pageB.waitForTimeout(800);

    const ssPathB2_2_Return = path.join(SCREENSHOT_DIR, "B2-2-partner-b-our-space-return.png");
    await pageB.screenshot({ path: ssPathB2_2_Return });

    const spaMarkerPostReturnB = await pageB.evaluate(() => window.__spaSessionMarker);
    const spaPreservedB = spaMarkerPostReturnB === markerB;
    console.log(`  Partner B returned to URL: ${pageB.url()}`);
    console.log(`  SPA Marker preserved on return (zero reloads): ${spaPreservedB}`);

    const b2_2_pass = showsSharedOverlineB && showsCategoryB && showsSharedTopicB &&
                      showsUnresolvedStatusB && privacyPreservedInUIB && spaPreservedB;

    results.b2_2_partnerBSharedEventDetail = {
      status: b2_2_pass ? "PASS" : "FAIL",
      details: {
        showsSharedOverline: showsSharedOverlineB,
        showsCategory: showsCategoryB,
        showsSharedTopic: showsSharedTopicB,
        showsUnresolvedStatus: showsUnresolvedStatusB,
        exposesPartnerAPrivateNote: exposesPartnerAPrivateNoteB,
        privacyPreserved: privacyPreservedInUIB,
        spaPreserved: spaPreservedB,
        screenshots: {
          detail: ssPathB2_2_Detail,
          returnOurSpace: ssPathB2_2_Return,
        },
      },
    };
    console.log(`>>> B2.2 RESULT: [${results.b2_2_partnerBSharedEventDetail.status}] <<<`);

    // =========================================================================
    // B2.3 — PARTNER A AUTHOR VIEW
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B2.3: PARTNER A AUTHOR VIEW ---");
    console.log("========================================================");

    console.log("  Partner A navigating to event detail...");
    await navigateToOurSpaceUI(pageA);
    const targetCardA = pageA.locator(`[aria-label*="Open shared ${TARGET_EVENT.categoryLabel} moment"]`).first();
    await targetCardA.scrollIntoViewIfNeeded();
    await targetCardA.click();

    await pageA.waitForFunction(() => window.location.pathname.includes("/event/"), { timeout: 15000 });
    await pageA.waitForTimeout(1000);

    const ssPathB2_3 = path.join(SCREENSHOT_DIR, "B2-3-partner-a-author-detail.png");
    await pageA.screenshot({ path: ssPathB2_3 });

    const detailA_Url = pageA.url();
    const detailA_MatchesId = detailA_Url.includes(TARGET_EVENT.id);
    const detailA_Text = await pageA.evaluate(() => document.body.innerText || "");

    const showsSharedTopicA = detailA_Text.includes(TARGET_EVENT.sharedTopicText);
    const showsPrivateReflectionA = detailA_Text.includes(TARGET_EVENT.privateReflectionText);
    const showsStatusA = detailA_Text.includes("Still lingering") || detailA_Text.includes("Open");

    console.log(`  Partner A Detail Screen:`);
    console.log(`    - URL matches target event ID: ${detailA_MatchesId}`);
    console.log(`    - Shared note text present: ${showsSharedTopicA}`);
    console.log(`    - Private reflection note present: ${showsPrivateReflectionA}`);
    console.log(`    - Status is 'Still lingering' / 'Open': ${showsStatusA}`);

    const b2_3_pass = detailA_MatchesId && showsSharedTopicA && showsPrivateReflectionA && showsStatusA;
    results.b2_3_partnerAAuthorView = {
      status: b2_3_pass ? "PASS" : "FAIL",
      details: {
        detailUrl: detailA_Url,
        matchesEventId: detailA_MatchesId,
        showsSharedTopic: showsSharedTopicA,
        showsPrivateReflection: showsPrivateReflectionA,
        showsStatus: showsStatusA,
        screenshot: ssPathB2_3,
      },
    };
    console.log(`>>> B2.3 RESULT: [${results.b2_3_partnerAAuthorView.status}] <<<`);

    // =========================================================================
    // B2.4 — AUTHENTICATED RLS VERIFICATION
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B2.4: AUTHENTICATED RLS VERIFICATION ---");
    console.log("========================================================");

    // Isolated client for Partner B
    console.log("  Authenticating isolated SDK client for Partner B...");
    const clientB = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY);
    const { data: authB, error: authErrB } = await clientB.auth.signInWithPassword({
      email: QA_USERS.partnerB.email,
      password: QA_USERS.partnerB.password,
    });
    if (authErrB) throw new Error(`Partner B SDK auth error: ${authErrB.message}`);
    console.log(`  Partner B SDK authenticated: User ID ${authB.user.id}`);

    // Query 1: Partner B relationship_events (Shared event -> must be 1 row)
    const { data: bEvents, error: bEventsErr, status: bEventsStatus } = await clientB
      .from("relationship_events")
      .select("id, visibility, creator_id, category, status, shared_topic")
      .eq("id", TARGET_EVENT.id);

    console.log(`  Partner B query relationship_events -> Status: ${bEventsStatus}, Rows: ${bEvents?.length ?? 0}`);

    // Query 2: Partner B event_private_reflections (Partner A's reflection -> must be 0 rows)
    const { data: bReflections, error: bReflErr, status: bReflStatus } = await clientB
      .from("event_private_reflections")
      .select("event_id, author_id, note")
      .eq("event_id", TARGET_EVENT.id);

    console.log(`  Partner B query event_private_reflections -> Status: ${bReflStatus}, Rows: ${bReflections?.length ?? 0}`);

    // Isolated client for Partner A
    console.log("\n  Authenticating isolated SDK client for Partner A...");
    const clientA = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY);
    const { data: authA, error: authErrA } = await clientA.auth.signInWithPassword({
      email: QA_USERS.partnerA.email,
      password: QA_USERS.partnerA.password,
    });
    if (authErrA) throw new Error(`Partner A SDK auth error: ${authErrA.message}`);
    console.log(`  Partner A SDK authenticated: User ID ${authA.user.id}`);

    // Query 3: Partner A relationship_events (Author -> must be 1 row)
    const { data: aEvents, error: aEventsErr, status: aEventsStatus } = await clientA
      .from("relationship_events")
      .select("id, visibility, creator_id, category, status, shared_topic")
      .eq("id", TARGET_EVENT.id);

    console.log(`  Partner A query relationship_events -> Status: ${aEventsStatus}, Rows: ${aEvents?.length ?? 0}`);

    // Query 4: Partner A event_private_reflections (Author -> must be 1 row)
    const { data: aReflections, error: aReflErr, status: aReflStatus } = await clientA
      .from("event_private_reflections")
      .select("event_id, author_id, note")
      .eq("event_id", TARGET_EVENT.id);

    console.log(`  Partner A query event_private_reflections -> Status: ${aReflStatus}, Rows: ${aReflections?.length ?? 0}`);

    const rls_b_eventAllowed = bEvents?.length === 1;
    const rls_b_privateBlocked = bReflections?.length === 0;
    const rls_a_eventAllowed = aEvents?.length === 1;
    const rls_a_privateAllowed = aReflections?.length === 1;

    console.log(`  RLS Assertions:`);
    console.log(`    - Partner B can access shared event row: ${rls_b_eventAllowed}`);
    console.log(`    - Partner B strictly blocked from Partner A private reflection (0 rows): ${rls_b_privateBlocked}`);
    console.log(`    - Author Partner A can access shared event row: ${rls_a_eventAllowed}`);
    console.log(`    - Author Partner A can access private reflection row (1 row): ${rls_a_privateAllowed}`);

    const b2_4_pass = rls_b_eventAllowed && rls_b_privateBlocked && rls_a_eventAllowed && rls_a_privateAllowed;
    results.b2_4_authenticatedRls = {
      status: b2_4_pass ? "PASS" : "FAIL",
      details: {
        partnerB: {
          relationshipEventsStatus: bEventsStatus,
          relationshipEventsCount: bEvents?.length ?? 0,
          eventPrivateReflectionsStatus: bReflStatus,
          eventPrivateReflectionsCount: bReflections?.length ?? 0,
          privateBlocked: rls_b_privateBlocked,
        },
        partnerA: {
          relationshipEventsStatus: aEventsStatus,
          relationshipEventsCount: aEvents?.length ?? 0,
          eventPrivateReflectionsStatus: aReflStatus,
          eventPrivateReflectionsCount: aReflections?.length ?? 0,
          privateAllowed: rls_a_privateAllowed,
        },
      },
    };
    console.log(`>>> B2.4 RESULT: [${results.b2_4_authenticatedRls.status}] <<<`);

    // =========================================================================
    // B2.5 — NON-MUTATION AND ISOLATION
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B2.5: NON-MUTATION AND ISOLATION AUDIT ---");
    console.log("========================================================");

    // Verify event status is still 'open' (no repair transitions)
    const postStatusRow = queryDb(`
      SELECT status, reconnected_at, repair_method
      FROM public.relationship_events
      WHERE id = '${TARGET_EVENT.id}';
    `);
    console.log(`  Event status row in PostgreSQL: ${postStatusRow}`);
    const statusParts = postStatusRow.split("|");
    const statusStillOpen = statusParts[0] === "open";
    const noReconnectedAt = !statusParts[1] || statusParts[1].trim() === "";
    const noRepairMethod = !statusParts[2] || statusParts[2].trim() === "";

    // Verify no repair responses or outcomes exist for this event
    const repairResponsesCount = parseInt(queryDb(`SELECT count(*) FROM public.relationship_event_repair_responses WHERE event_id = '${TARGET_EVENT.id}';`), 10);
    const repairOutcomesCount = parseInt(queryDb(`SELECT count(*) FROM public.relationship_event_repair_outcomes WHERE event_id = '${TARGET_EVENT.id}';`), 10);

    console.log(`  Non-mutation assertions:`);
    console.log(`    - Status is still 'open': ${statusStillOpen}`);
    console.log(`    - reconnected_at is null: ${noReconnectedAt}`);
    console.log(`    - repair_method is null: ${noRepairMethod}`);
    console.log(`    - Zero repair responses created: ${repairResponsesCount === 0}`);
    console.log(`    - Zero repair outcomes created: ${repairOutcomesCount === 0}`);

    // Remote Supabase leak audit
    const remoteLeaksCount = networkAudit.remoteRequestsDetected.length;
    console.log(`  Total network requests intercepted: ${networkAudit.totalRequests}`);
    console.log(`  Local Supabase requests: ${networkAudit.localSupabaseRequests.length}`);
    console.log(`  Remote Supabase requests (must be 0): ${remoteLeaksCount}`);

    const b2_5_pass = statusStillOpen && noReconnectedAt && noRepairMethod &&
                      repairResponsesCount === 0 && repairOutcomesCount === 0 &&
                      remoteLeaksCount === 0;

    results.b2_5_nonMutationAndIsolation = {
      status: b2_5_pass ? "PASS" : "FAIL",
      details: {
        statusStillOpen,
        noReconnectedAt,
        noRepairMethod,
        repairResponsesCount,
        repairOutcomesCount,
        remoteRequestsDetected: networkAudit.remoteRequestsDetected,
        localSupabaseRequestsCount: networkAudit.localSupabaseRequests.length,
        totalRequestsIntercepted: networkAudit.totalRequests,
      },
    };
    console.log(`>>> B2.5 RESULT: [${results.b2_5_nonMutationAndIsolation.status}] <<<`);

  } catch (err) {
    console.error(`[CRITICAL ERROR] Suite execution error: ${err.message}`);
    if (results.b2_1_partnerBHomeNotification.status === "PENDING") results.b2_1_partnerBHomeNotification.status = "FAIL";
    if (results.b2_2_partnerBSharedEventDetail.status === "PENDING") results.b2_2_partnerBSharedEventDetail.status = "FAIL";
    if (results.b2_3_partnerAAuthorView.status === "PENDING") results.b2_3_partnerAAuthorView.status = "FAIL";
    if (results.b2_4_authenticatedRls.status === "PENDING") results.b2_4_authenticatedRls.status = "FAIL";
    if (results.b2_5_nonMutationAndIsolation.status === "PENDING") results.b2_5_nonMutationAndIsolation.status = "FAIL";
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

runScenarioB2().catch((err) => {
  console.error("Fatal suite error:", err);
  process.exit(1);
});
