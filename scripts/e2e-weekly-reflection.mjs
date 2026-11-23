import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ARTIFACT_DIR = path.resolve("test-results/weekly-reflection");
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, "screenshots");
const REPORT_FILE = path.join(ARTIFACT_DIR, "weekly-reflection-e2e-report.json");
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

const TEST_PAYLOAD = {
  stayedWith: "A moment of closeness",
  carryForward: "More space and patience",
  privateNote: `QA-WEEKLY-REFLECT-${RUN_ID}: Taking intentional pauses brought us closer this week.`,
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

async function runWeeklyReflectionE2E() {
  console.log("=== PURPLE GARDEN: WEEKLY REFLECTION & HOME INTEGRATION E2E ===");
  console.log(`Timestamp: ${new Date().toISOString()} | RUN_ID: ${RUN_ID}`);

  const expoPid = getExpoProcess();
  console.log(`Expo PID: ${expoPid || "OFFLINE"}`);
  if (!expoPid) {
    console.error("[BLOCKED] Expo dev server is not running on port 8081.");
    process.exit(2);
  }

  const expoMemPre = getProcessMemory(expoPid);
  console.log(`Initial Expo RSS: ${expoMemPre.rssMb} MB | VSZ: ${expoMemPre.vszMb} MB`);

  let expoHealth = "000";
  try {
    expoHealth = execSync("curl -s -m 10 -o /dev/null -w \"%{http_code}\" http://127.0.0.1:8081", { encoding: "utf8" }).trim();
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

  const results = {
    runId: RUN_ID,
    timestamp: new Date().toISOString(),
    w3_stateIndependence: { status: "PENDING", details: {} },
    w4_userInteraction: { status: "PENDING", details: {} },
    w5_visualAndMobileLayout: { status: "PENDING", details: {} },
    submissionAndRevisit: { status: "PENDING", details: {} },
    privacyAndIsolation: { status: "PENDING", details: {} },
    networkAudit,
    memory: {},
  };

  let contextA, pageA, contextB, pageB;

  try {
    console.log("\n[Setup] Authenticating Partner A in isolated 390x844 viewport...");
    contextA = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    pageA = await contextA.newPage();
    const markerA = await loginPartner(pageA, QA_USERS.partnerA, "Partner A");
    console.log(`  Partner A authenticated (SPA Marker: ${markerA})`);

    // 1. Verify Home layout, sections separation, ordering
    console.log("\n--- Checking Home Structure and Ordering ---");
    const homeSectionsCheck = await pageA.evaluate(() => {
      const text = document.body.innerText || "";
      const whatMattersNowMatches = (text.match(/What matters now/g) || []).length;
      const yourWeekGentlyMatches = (text.match(/Your week, gently/g) || []).length;

      const idxWhatMatters = text.indexOf("What matters now");
      const idxMineOurs = text.indexOf("Mine");
      const idxYourWeek = text.indexOf("Your week, gently");

      const correctlyOrdered = idxWhatMatters !== -1 && idxMineOurs !== -1 && idxYourWeek !== -1 &&
                               idxWhatMatters < idxMineOurs && idxMineOurs < idxYourWeek;

      // Check overflow
      const docWidth = document.documentElement.scrollWidth;
      const winWidth = window.innerWidth;
      const hasHorizontalOverflow = docWidth > winWidth + 2;

      return {
        whatMattersNowMatches,
        yourWeekGentlyMatches,
        correctlyOrdered,
        hasHorizontalOverflow,
        docWidth,
        winWidth,
      };
    });

    console.log(`  - 'What matters now' count: ${homeSectionsCheck.whatMattersNowMatches} (expected 1)`);
    console.log(`  - 'Your week, gently' count: ${homeSectionsCheck.yourWeekGentlyMatches} (expected 1)`);
    console.log(`  - Top-to-bottom section order valid: ${homeSectionsCheck.correctlyOrdered}`);
    console.log(`  - Horizontal overflow: ${homeSectionsCheck.hasHorizontalOverflow} (${homeSectionsCheck.docWidth}px vs ${homeSectionsCheck.winWidth}px)`);

    // Capture initial Home screenshot (empty weekly state)
    const ssEmptyPath = path.join(SCREENSHOT_DIR, "weekly-01-home-empty-tile.png");
    await pageA.screenshot({ path: ssEmptyPath, fullPage: false });

    // 2. Tap "Look back →" on Section 5
    console.log("\n--- Tapping 'Look back →' to open /weekly-reflection ---");
    const weeklyTileA = pageA.getByRole("button", { name: /Your week, gently/i });
    const tileCount = await weeklyTileA.count();
    console.log(`  - Accessible weekly card buttons found: ${tileCount} (must be exactly 1)`);
    if (tileCount !== 1) {
      throw new Error(`Expected exactly 1 weekly card button, found ${tileCount}`);
    }
    await weeklyTileA.click();
    await pageA.waitForTimeout(1000);

    await pageA.waitForFunction(() => window.location.pathname.includes("/weekly-reflection"), { timeout: 10000 });
    console.log(`  Navigated to URL: ${pageA.url()}`);

    // Capture weekly reflection form screenshot
    const ssFormPath = path.join(SCREENSHOT_DIR, "weekly-02-reflection-form.png");
    await pageA.screenshot({ path: ssFormPath, fullPage: false });

    // 3. Inspect Form inputs & options
    console.log("\n--- Inspecting Form Prompts & Options ---");
    const formInspect = await pageA.evaluate(() => {
      const text = document.body.innerText || "";
      const hasPrompt1 = text.includes("What stayed with you from this week?");
      const hasPrompt2 = text.includes("What would you like to carry into next week?");
      const hasNotePrompt = text.includes("Anything you want to remember?") || text.includes("words for yourself");
      return { hasPrompt1, hasPrompt2, hasNotePrompt };
    });
    console.log(`  - Prompt 1 present: ${formInspect.hasPrompt1}`);
    console.log(`  - Prompt 2 present: ${formInspect.hasPrompt2}`);
    console.log(`  - Private note input present: ${formInspect.hasNotePrompt}`);

    // 4. Fill form: select stayedWith option
    console.log(`\n--- Filling Form: stayedWith = '${TEST_PAYLOAD.stayedWith}' ---`);
    const optStayedWith = pageA.locator(`[aria-label="${TEST_PAYLOAD.stayedWith}"]`).first();
    await optStayedWith.click();
    await pageA.waitForTimeout(300);

    // Fill form: select carryForward option
    console.log(`--- Filling Form: carryForward = '${TEST_PAYLOAD.carryForward}' ---`);
    const optCarryForward = pageA.locator(`[aria-label="${TEST_PAYLOAD.carryForward}"]`).first();
    await optCarryForward.click();
    await pageA.waitForTimeout(300);

    // Fill private note
    console.log(`--- Filling Form: privateNote ---`);
    const noteInput = pageA.locator('input[aria-label*="Private reflection note" i], textarea[aria-label*="Private reflection note" i], [placeholder*="words for yourself" i]').first();
    await noteInput.fill(TEST_PAYLOAD.privateNote);
    await pageA.waitForTimeout(300);

    const ssFilledPath = path.join(SCREENSHOT_DIR, "weekly-03-reflection-filled.png");
    await pageA.screenshot({ path: ssFilledPath, fullPage: false });

    // 5. Submit form
    console.log("\n--- Submitting Reflection ---");
    const saveBtn = pageA.getByRole("button", { name: /Save my reflection/i });
    await saveBtn.click();
    await pageA.waitForTimeout(1500);

    // Verify confirmation message
    const confirmText = await pageA.evaluate(() => {
      const text = document.body.innerText || "";
      return text.includes("Your week is saved") || text.includes("Update my reflection");
    });
    console.log(`  - Save confirmation displayed: ${confirmText}`);

    // 6. Verify PostgreSQL database record
    console.log("\n--- Verifying PostgreSQL Persistence ---");
    const dbRecord = queryDb(`
      SELECT id, user_id, couple_id, week_start, stayed_with, carry_forward, private_note, created_at
      FROM public.weekly_reflections
      WHERE user_id = '${QA_USERS.partnerA.id}';
    `);
    console.log(`  DB Record: ${dbRecord}`);
    const recordParts = dbRecord.split("|");
    const recordId = recordParts[0] || null;
    const dbUserId = recordParts[1] || null;
    const dbStayedWith = recordParts[4] || null;
    const dbCarryForward = recordParts[5] || null;
    const dbPrivateNote = recordParts[6] || null;

    const dbPersistedCorrectly = recordId &&
                                 dbUserId === QA_USERS.partnerA.id &&
                                 dbStayedWith === TEST_PAYLOAD.stayedWith &&
                                 dbCarryForward === TEST_PAYLOAD.carryForward &&
                                 dbPrivateNote === TEST_PAYLOAD.privateNote;
    console.log(`  - Exact DB fields match test payload: ${dbPersistedCorrectly}`);

    // 7. Return to Home via UI navigation
    console.log("\n--- Returning to Home ---");
    const backBtn = pageA.getByRole("button", { name: /Return to My Rhythm/i });
    await backBtn.click();
    await pageA.waitForTimeout(1000);
    await pageA.waitForFunction(() => window.location.pathname.includes("/home"), { timeout: 10000 });
    await pageA.waitForTimeout(600);

    // 8. Verify Weekly tile now displays completed / revisit state
    console.log("\n--- Checking Home Weekly Tile Post-Submission ---");
    const postHomeCheck = await pageA.evaluate(() => {
      const text = document.body.innerText || "";
      const hasRevisitText = text.includes("Your reflection is here whenever you want to revisit it");
      const hasRevisitBtn = text.includes("Revisit reflection →");
      return { hasRevisitText, hasRevisitBtn };
    });
    console.log(`  - Tile shows revisit text: ${postHomeCheck.hasRevisitText}`);
    console.log(`  - Tile shows 'Revisit reflection →': ${postHomeCheck.hasRevisitBtn}`);

    const ssCompletedPath = path.join(SCREENSHOT_DIR, "weekly-04-home-completed-tile.png");
    await pageA.screenshot({ path: ssCompletedPath, fullPage: false });

    // 9. Revisit reflection via UI click
    console.log("\n--- Clicking 'Revisit reflection →' ---");
    const revisitBtnA = pageA.getByRole("button", { name: /Your week, gently/i });
    const revisitCount = await revisitBtnA.count();
    console.log(`  - Revisit weekly card buttons found: ${revisitCount} (must be exactly 1)`);
    if (revisitCount !== 1) {
      throw new Error(`Expected exactly 1 revisit weekly card button, found ${revisitCount}`);
    }
    await revisitBtnA.click();
    await pageA.waitForTimeout(1000);
    await pageA.waitForFunction(() => window.location.pathname.includes("/weekly-reflection"), { timeout: 10000 });

    const revisitFormState = await pageA.evaluate((expectedNote) => {
      const text = document.body.innerText || "";
      const inputs = Array.from(document.querySelectorAll("input, textarea")).map((el) => el.value || "");
      const hasNote = inputs.some((v) => v.includes(expectedNote)) || text.includes(expectedNote);
      return { hasNote, hasUpdateBtn: text.includes("Update my reflection") || text.includes("Save my reflection") };
    }, TEST_PAYLOAD.privateNote);
    console.log(`  - Revisit loaded previously saved note: ${revisitFormState.hasNote}`);

    // 10. Deliberate browser reload
    console.log("\n--- Deliberate Browser Reload ---");
    await pageA.reload({ waitUntil: "domcontentloaded" });
    await pageA.waitForSelector("text=What stayed with you", { timeout: 15000 }).catch(() => {});
    await pageA.waitForTimeout(1000);

    const postReloadState = await pageA.evaluate((expectedNote) => {
      const text = document.body.innerText || "";
      const inputs = Array.from(document.querySelectorAll("input, textarea")).map((el) => el.value || "");
      const hasNote = inputs.some((v) => v.includes(expectedNote)) || text.includes(expectedNote);
      return { hasNote };
    }, TEST_PAYLOAD.privateNote);
    console.log(`  - Data preserved after reload: ${postReloadState.hasNote}`);

    // Return to Home
    const backBtnReload = pageA.locator('[aria-label*="Back to My Rhythm" i]').first();
    await backBtnReload.click();
    await pageA.waitForFunction(() => window.location.pathname.includes("/home"), { timeout: 10000 });

    // 11. Authenticate Partner B separately & check privacy / isolation
    console.log("\n[Partner B Isolation] Authenticating Partner B...");
    contextB = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    pageB = await contextB.newPage();
    const markerB = await loginPartner(pageB, QA_USERS.partnerB, "Partner B");
    console.log(`  Partner B authenticated (SPA Marker: ${markerB})`);

    // Partner B Home must NOT show Partner A's completed weekly reflection
    const bHomeWeeklyState = await pageB.evaluate(() => {
      const text = document.body.innerText || "";
      const hasEmptyWeekly = text.includes("Your weekly reflection will appear here when there’s enough from your week");
      const hasRevisitWeekly = text.includes("Your reflection is here whenever you want to revisit it");
      return { hasEmptyWeekly, hasRevisitWeekly };
    });
    console.log(`  - Partner B Home displays uncompleted/empty weekly tile: ${bHomeWeeklyState.hasEmptyWeekly}`);
    console.log(`  - Partner B Home does NOT show Partner A's revisit state: ${!bHomeWeeklyState.hasRevisitWeekly}`);

    // Authenticated SDK query as Partner B to prove RLS blocks Partner B from reading Partner A's weekly reflection
    console.log("\n--- Authenticated SDK Privacy Query (Partner B) ---");
    const clientB = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY);
    await clientB.auth.signInWithPassword({
      email: QA_USERS.partnerB.email,
      password: QA_USERS.partnerB.password,
    });
    const { data: bQueryResult } = await clientB
      .from("weekly_reflections")
      .select("id, stayed_with, carry_forward, private_note")
      .eq("user_id", QA_USERS.partnerA.id);

    const bBlockedByRls = !bQueryResult || bQueryResult.length === 0;
    console.log(`  - Partner B querying Partner A's weekly reflection returned 0 rows (RLS enforced): ${bBlockedByRls}`);

    // Check duplicate weekly records for Partner A
    const aRecordCount = parseInt(queryDb(`SELECT count(*) FROM public.weekly_reflections WHERE user_id = '${QA_USERS.partnerA.id}';`), 10);
    console.log(`  - Total weekly reflection records for Partner A in DB: ${aRecordCount} (expected exactly 1)`);
    const noDuplicates = aRecordCount === 1;

    // Network leaks audit
    const remoteLeaks = networkAudit.remoteRequestsDetected.length;
    console.log(`  - Remote Supabase requests detected: ${remoteLeaks}`);

    // Consolidate Results
    const w3_pass = homeSectionsCheck.correctlyOrdered && postHomeCheck.hasRevisitText;
    const w4_pass = formInspect.hasPrompt1 && formInspect.hasPrompt2 && confirmText && revisitFormState.hasNote;
    const w5_pass = homeSectionsCheck.whatMattersNowMatches === 1 &&
                    homeSectionsCheck.yourWeekGentlyMatches === 1 &&
                    !homeSectionsCheck.hasHorizontalOverflow;
    const sub_pass = dbPersistedCorrectly && postHomeCheck.hasRevisitBtn && postReloadState.hasNote;
    const priv_pass = !bHomeWeeklyState.hasRevisitWeekly && bBlockedByRls && noDuplicates && remoteLeaks === 0;

    results.w3_stateIndependence = { status: w3_pass ? "PASS" : "FAIL", details: { homeSectionsCheck, postHomeCheck } };
    results.w4_userInteraction = { status: w4_pass ? "PASS" : "FAIL", details: { formInspect, confirmText, revisitFormState } };
    results.w5_visualAndMobileLayout = {
      status: w5_pass ? "PASS" : "FAIL",
      details: {
        homeSectionsCheck,
        screenshots: [ssEmptyPath, ssFormPath, ssFilledPath, ssCompletedPath],
      },
    };
    results.submissionAndRevisit = {
      status: sub_pass ? "PASS" : "FAIL",
      details: { recordId, dbPersistedCorrectly, postReloadState },
    };
    results.privacyAndIsolation = {
      status: priv_pass ? "PASS" : "FAIL",
      details: { bBlockedByRls, noDuplicates, remoteLeaks },
    };

    console.log("\n========================================================");
    console.log(`W3 Live Status:               [${results.w3_stateIndependence.status}]`);
    console.log(`W4 Live Status:               [${results.w4_userInteraction.status}]`);
    console.log(`W5 Fresh Visual Status:       [${results.w5_visualAndMobileLayout.status}]`);
    console.log(`Submission & Revisit Status:  [${results.submissionAndRevisit.status}]`);
    console.log(`Privacy & Isolation Status:   [${results.privacyAndIsolation.status}]`);
    console.log("========================================================");

  } catch (err) {
    console.error(`\n[FATAL ERROR in Weekly Reflection E2E]: ${err.stack || err.message}`);
  } finally {
    if (pageA) await pageA.close().catch(() => {});
    if (pageB) await pageB.close().catch(() => {});
    if (contextA) await contextA.close().catch(() => {});
    if (contextB) await contextB.close().catch(() => {});
    await browser.close().catch(() => {});

    const expoPidPost = getExpoProcess();
    const expoMemPost = getProcessMemory(expoPidPost);
    results.memory = {
      expoPid: expoPidPost,
      postRssMb: expoMemPost.rssMb,
      postVszMb: expoMemPost.vszMb,
    };
    console.log(`\nFinal Expo RSS: ${expoMemPost.rssMb} MB | VSZ: ${expoMemPost.vszMb} MB`);

    fs.writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2), "utf8");
    console.log(`\nWeekly reflection report written to ${REPORT_FILE}`);
  }
}

runWeeklyReflectionE2E().catch((e) => {
  console.error("Unhandled top-level error:", e);
  process.exit(1);
});
