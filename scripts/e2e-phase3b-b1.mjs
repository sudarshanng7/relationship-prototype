import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ARTIFACT_DIR = path.resolve("test-results/phase3b");
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, "screenshots");
const REPORT_FILE = path.join(ARTIFACT_DIR, "scenario-b1-report.json");
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

async function runScenarioB1() {
  console.log("=== PURPLE GARDEN: PHASE 3B / SCENARIO B1: FRICTION MOMENT CREATION ===");
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

  // Record pre-test baseline event counts
  const initialEventCount = parseInt(queryDb(`SELECT count(*) FROM public.relationship_events WHERE couple_id = '${QA_USERS.coupleId}';`), 10);
  console.log(`Pre-test baseline couple event count: ${initialEventCount}`);

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
    b1_1_frictionEntry: { status: "PENDING", details: {} },
    b1_2_frictionFormInput: { status: "PENDING", details: {} },
    b1_3_createAndPersist: { status: "PENDING", details: {} },
    b1_4_authorView: { status: "PENDING", details: {} },
    b1_5_isolationAndConsistency: { status: "PENDING", details: {} },
    networkAudit,
    memory: {},
  };

  let contextA, pageA;

  try {
    console.log("\n[Setup] Authenticating Partner A in mobile context (390x844)...");
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
    // B1.1 — FRICTION ENTRY
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B1.1: FRICTION MOMENT ENTRY ---");
    console.log("========================================================");

    const recordBtn = pageA.getByRole("button", { name: /record a moment/i }).first();
    await recordBtn.waitFor({ state: "visible", timeout: 10000 });
    await recordBtn.click();

    await pageA.waitForSelector("text=What would you like to record?", { timeout: 8000 });
    console.log("  Selection modal opened: 'What would you like to record?'");

    const frictionTile = pageA.getByRole("button", { name: /something felt off/i }).first();
    await frictionTile.waitFor({ state: "visible", timeout: 5000 });
    await frictionTile.click();

    await pageA.waitForFunction(() => window.location.pathname.includes("/record-moment"), { timeout: 10000 });
    await pageA.waitForSelector("text=What was it about?", { timeout: 10000 });
    await pageA.waitForTimeout(600);

    const entryUrl = pageA.url();
    const spaMarkerPostEntry = await pageA.evaluate(() => window.__spaSessionMarker);
    const spaPreservedEntry = spaMarkerPostEntry === markerA;
    console.log(`  SPA URL: ${entryUrl}`);
    console.log(`  SPA Marker preserved on entry: ${spaPreservedEntry}`);

    // Capture visible categories
    const visibleCategories = await pageA.evaluate(() => {
      const chips = Array.from(document.querySelectorAll('[role="button"]'))
        .map((el) => el.getAttribute("aria-label"))
        .filter((label) => label && [
          "Household", "Money", "Family", "Communication", "Work or stress",
          "Time together", "Phones or screens", "Affection", "Parenting", "Plans", "Other"
        ].includes(label));
      return chips;
    });
    console.log(`  Visible friction categories (${visibleCategories.length}):`, visibleCategories.join(", "));

    // Capture visible intensity controls
    const visibleIntensityOptions = await pageA.evaluate(() => {
      const radios = Array.from(document.querySelectorAll('[aria-label^="Weight level"]'))
        .map((el) => el.getAttribute("aria-label"));
      return radios;
    });
    console.log(`  Visible intensity controls (${visibleIntensityOptions.length}):`, visibleIntensityOptions.join(", "));

    const ssPathB1_1 = path.join(SCREENSHOT_DIR, "B1-1-friction-entry.png");
    await pageA.screenshot({ path: ssPathB1_1 });

    const b1_1_pass = spaPreservedEntry && visibleCategories.length >= 10 && visibleIntensityOptions.length === 5;
    results.b1_1_frictionEntry = {
      status: b1_1_pass ? "PASS" : "FAIL",
      details: {
        entryUrl,
        spaPreserved: spaPreservedEntry,
        visibleCategories,
        visibleIntensityOptions,
        screenshot: ssPathB1_1,
      },
    };
    console.log(`>>> B1.1 RESULT: [${results.b1_1_frictionEntry.status}] <<<`);

    // =========================================================================
    // B1.2 — FRICTION FORM INPUT & REVIEW FLOW
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B1.2: FRICTION FORM INPUT & REVIEW FLOW ---");
    console.log("========================================================");

    const testCategory = "household";
    const testCategoryLabel = "Household";
    const testIntensity = 3;
    const testPrivateNote = `QA-3B-${RUN_ID}-B1-PRIVATE: Noticed chores feeling unbalanced this week`;
    const testSharedTopic = `QA-3B-${RUN_ID}-B1-OURS: Can we look at our chores routine together tonight?`;

    console.log(`  Selecting category: ${testCategoryLabel}...`);
    const categoryChip = pageA.getByRole("button", { name: /^household$/i }).first();
    await categoryChip.click();
    await pageA.waitForTimeout(300);

    console.log(`  Selecting intensity: Weight level ${testIntensity}...`);
    const intensityRadio = pageA.locator(`[aria-label="Weight level ${testIntensity}"]`).first();
    await intensityRadio.click();
    await pageA.waitForTimeout(300);

    console.log(`  Entering private reflection note...`);
    const privateNoteInput = pageA.locator('textarea, input[placeholder*="What happened" i]').first();
    await privateNoteInput.fill(testPrivateNote);
    await pageA.waitForTimeout(300);

    console.log(`  Selecting visibility: Ours...`);
    const oursCard = pageA.locator('[aria-label^="Ours: Share a gentle version"]').first();
    await oursCard.click();
    await pageA.waitForTimeout(300);

    console.log(`  Entering shared note topic...`);
    const sharedTopicInput = pageA.locator('textarea, input[aria-label*="Shared note" i], input[placeholder*="What would you like" i]').last();
    await sharedTopicInput.fill(testSharedTopic);
    await pageA.waitForTimeout(300);

    // Initial action button is "Review shared moment"
    const reviewBtn = pageA.getByRole("button", { name: /review shared moment/i }).first();
    const reviewBtnVisible = await reviewBtn.isVisible();
    console.log(`  Primary button label is 'Review shared moment': ${reviewBtnVisible}`);

    console.log(`  Clicking 'Review shared moment'...`);
    await reviewBtn.click();
    await pageA.waitForTimeout(600);

    // In-screen review card verification
    const reviewHeadingVisible = await pageA.locator('text=/Ready to share with/i').first().isVisible();
    const shareBtn = pageA.getByRole("button", { name: /share with/i }).first();
    const shareBtnVisible = await shareBtn.isVisible();
    const keepEditingBtn = pageA.getByRole("button", { name: /keep editing/i }).first();
    const keepEditingVisible = await keepEditingBtn.isVisible();

    console.log(`  In-screen review card visible: ${reviewHeadingVisible}`);
    console.log(`  'Share with Partner B' button visible: ${shareBtnVisible}`);
    console.log(`  'Keep editing' button visible: ${keepEditingVisible}`);

    const ssPathB1_2 = path.join(SCREENSHOT_DIR, "B1-2-friction-form-review.png");
    await pageA.screenshot({ path: ssPathB1_2 });

    const b1_2_pass = reviewBtnVisible && reviewHeadingVisible && shareBtnVisible && keepEditingVisible;
    results.b1_2_frictionFormInput = {
      status: b1_2_pass ? "PASS" : "FAIL",
      details: {
        selectedCategory: testCategoryLabel,
        selectedIntensity: testIntensity,
        privateNoteEntered: testPrivateNote,
        sharedTopicEntered: testSharedTopic,
        reviewCardVisible: reviewHeadingVisible,
        shareBtnVisible,
        keepEditingVisible,
        screenshot: ssPathB1_2,
      },
    };
    console.log(`>>> B1.2 RESULT: [${results.b1_2_frictionFormInput.status}] <<<`);

    // =========================================================================
    // B1.3 — CREATE AND PERSIST
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B1.3: SUBMISSION AND DATABASE PERSISTENCE ---");
    console.log("========================================================");

    console.log(`  Submitting friction moment via 'Share with Partner B'...`);
    await shareBtn.click();

    // Handle optional RepairMemorySuggestion card if displayed
    try {
      const maybeLaterBtn = pageA.getByRole("button", { name: /maybe later/i }).first();
      if (await maybeLaterBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log("  Repair memory suggestion sheet appeared — clicking 'Maybe later'...");
        await maybeLaterBtn.click();
      }
    } catch {}

    await pageA.waitForFunction(() => window.location.pathname.includes("/event/"), { timeout: 15000 });
    await pageA.waitForTimeout(1000);

    const postSubmitUrl = pageA.url();
    const eventIdMatch = postSubmitUrl.match(/\/event\/([a-f0-9-]+)/i);
    const createdFrictionId = eventIdMatch ? eventIdMatch[1] : null;
    console.log(`  Captured Created Friction Event ID: ${createdFrictionId}`);
    if (!createdFrictionId) {
      throw new Error("Failed to extract created event ID from post-submit URL.");
    }

    const ssPathB1_3 = path.join(SCREENSHOT_DIR, "B1-3-moment-created-detail.png");
    await pageA.screenshot({ path: ssPathB1_3 });

    // Database verification: relationship_events
    console.log(`\n  Querying PostgreSQL for event row ${createdFrictionId}...`);
    const dbEventRow = queryDb(`
      SELECT id, couple_id, creator_id, event_type, category, intensity, visibility, status, shared_topic, created_at
      FROM public.relationship_events
      WHERE id = '${createdFrictionId}';
    `);
    console.log(`  relationship_events record:\n  ${dbEventRow}`);

    const dbParts = dbEventRow.split("|");
    const dbRecord = {
      id: dbParts[0],
      coupleId: dbParts[1],
      creatorId: dbParts[2],
      eventType: dbParts[3],
      category: dbParts[4],
      intensity: parseInt(dbParts[5], 10),
      visibility: dbParts[6],
      status: dbParts[7],
      sharedTopic: dbParts[8],
      createdAt: dbParts[9],
    };

    const matchCreator = dbRecord.creatorId === QA_USERS.partnerA.id;
    const matchCouple = dbRecord.coupleId === QA_USERS.coupleId;
    const matchType = dbRecord.eventType === "friction";
    const matchCategory = dbRecord.category === testCategory;
    const matchIntensity = dbRecord.intensity === testIntensity;
    const matchVisibility = dbRecord.visibility === "ours";
    const matchStatus = dbRecord.status === "open";
    const matchTopic = dbRecord.sharedTopic === testSharedTopic;

    console.log(`  Database Assertions:`);
    console.log(`    - Creator matches Partner A: ${matchCreator}`);
    console.log(`    - Couple matches QA couple: ${matchCouple}`);
    console.log(`    - Event type is 'friction': ${matchType}`);
    console.log(`    - Category is 'household': ${matchCategory}`);
    console.log(`    - Intensity is 3: ${matchIntensity}`);
    console.log(`    - Visibility is 'ours': ${matchVisibility}`);
    console.log(`    - Initial status is 'open': ${matchStatus}`);
    console.log(`    - Shared topic matches input: ${matchTopic}`);

    // Database verification: event_private_reflections
    console.log(`\n  Querying PostgreSQL for private reflection row...`);
    const dbReflRow = queryDb(`
      SELECT event_id, author_id, note
      FROM public.event_private_reflections
      WHERE event_id = '${createdFrictionId}';
    `);
    console.log(`  event_private_reflections record:\n  ${dbReflRow}`);

    const reflParts = dbReflRow.split("|");
    const matchReflAuthor = reflParts[1] === QA_USERS.partnerA.id;
    const matchReflNote = reflParts[2] === testPrivateNote;
    console.log(`    - Reflection author matches Partner A: ${matchReflAuthor}`);
    console.log(`    - Reflection note matches input: ${matchReflNote}`);

    const b1_3_pass = matchCreator && matchCouple && matchType && matchCategory &&
                      matchIntensity && matchVisibility && matchStatus && matchTopic &&
                      matchReflAuthor && matchReflNote;

    results.b1_3_createAndPersist = {
      status: b1_3_pass ? "PASS" : "FAIL",
      details: {
        createdEventId: createdFrictionId,
        databaseEventRecord: dbRecord,
        databaseReflectionRecord: {
          eventId: reflParts[0],
          authorId: reflParts[1],
          note: reflParts[2],
        },
        schemaValidation: {
          creator: matchCreator,
          couple: matchCouple,
          type: matchType,
          category: matchCategory,
          intensity: matchIntensity,
          visibility: matchVisibility,
          status: matchStatus,
          sharedTopic: matchTopic,
          reflectionAuthor: matchReflAuthor,
          reflectionNote: matchReflNote,
        },
        screenshot: ssPathB1_3,
      },
    };
    console.log(`>>> B1.3 RESULT: [${results.b1_3_createAndPersist.status}] <<<`);

    // =========================================================================
    // B1.4 — AUTHOR VIEW & ROUNDTRIP NAVIGATION
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B1.4: AUTHOR VIEW & IN-APP ROUNDTRIP ---");
    console.log("========================================================");

    // Detail view inspection
    const detailBodyText = await pageA.evaluate(() => document.body.innerText || "");
    const showsOverline = detailBodyText.includes("SHARED MOMENT");
    const showsStatus = detailBodyText.includes("Still lingering") || detailBodyText.includes("Open");
    const showsCategory = detailBodyText.includes("Household");
    const showsSharedTopic = detailBodyText.includes(testSharedTopic);
    const showsPrivateReflection = detailBodyText.includes(testPrivateNote);

    console.log(`  Detail screen displays:`);
    console.log(`    - Overline 'SHARED MOMENT': ${showsOverline}`);
    console.log(`    - Status 'Still lingering': ${showsStatus}`);
    console.log(`    - Category 'Household': ${showsCategory}`);
    console.log(`    - Shared note text: ${showsSharedTopic}`);
    console.log(`    - Private reflection text: ${showsPrivateReflection}`);

    // In-app roundtrip navigation: Back to Our Space
    console.log(`\n  Navigating back to Our Space via '‹ Back to Our Space'...`);
    const backBtn = pageA.getByRole("button", { name: /Back/i }).first();
    await backBtn.click();

    await pageA.waitForFunction(() => window.location.pathname.includes("/events"), { timeout: 15000 });
    await pageA.waitForTimeout(800);

    const spaMarkerPostReturn = await pageA.evaluate(() => window.__spaSessionMarker);
    const spaPreservedReturn = spaMarkerPostReturn === markerA;
    console.log(`  Returned to URL: ${pageA.url()}`);
    console.log(`  SPA Marker preserved on return (zero reloads): ${spaPreservedReturn}`);

    // Verify newly created friction moment card in Our Space
    console.log(`  Checking newly created moment card in Our Space feed...`);
    const topCardLabel = await pageA.locator('[aria-label^="Open shared"]').first().getAttribute("aria-label");
    const topCardText = await pageA.evaluate(() => {
      const topEl = document.querySelector('[aria-label^="Open shared"]');
      return topEl ? topEl.innerText.replace(/\n+/g, " | ") : "";
    });

    console.log(`  Top card aria-label: "${topCardLabel}"`);
    console.log(`  Top card inner text: [${topCardText}]`);

    const topCardIsHousehold = topCardLabel && topCardLabel.includes("Household");
    const topCardHasStillLingering = topCardText.includes("Still lingering") || topCardText.includes("Household");

    const ssPathB1_4 = path.join(SCREENSHOT_DIR, "B1-4-our-space-author-view.png");
    await pageA.screenshot({ path: ssPathB1_4 });

    // Open card again to verify re-entry
    console.log(`  Re-opening top card from Our Space feed...`);
    const topCardBtn = pageA.locator('[aria-label^="Open shared"]').first();
    await topCardBtn.scrollIntoViewIfNeeded();
    await topCardBtn.click();

    await pageA.waitForFunction(() => window.location.pathname.includes("/event/"), { timeout: 15000 });
    await pageA.waitForTimeout(600);

    const reOpenedUrl = pageA.url();
    const reOpenedMatchesId = reOpenedUrl.includes(createdFrictionId);
    console.log(`  Re-opened URL: ${reOpenedUrl}`);
    console.log(`  Re-opened matches created event ID: ${reOpenedMatchesId}`);

    const b1_4_pass = showsOverline && showsStatus && showsCategory && showsSharedTopic &&
                      showsPrivateReflection && spaPreservedReturn && topCardIsHousehold && reOpenedMatchesId;

    results.b1_4_authorView = {
      status: b1_4_pass ? "PASS" : "FAIL",
      details: {
        detailView: {
          showsOverline,
          showsStatus,
          showsCategory,
          showsSharedTopic,
          showsPrivateReflection,
        },
        roundtripNavigation: {
          spaPreserved: spaPreservedReturn,
          topCardLabel,
          topCardText,
          topCardIsHousehold,
          reOpenedMatchesId,
        },
        screenshot: ssPathB1_4,
      },
    };
    console.log(`>>> B1.4 RESULT: [${results.b1_4_authorView.status}] <<<`);

    // =========================================================================
    // B1.5 — ISOLATION & CONSISTENCY AUDIT
    // =========================================================================
    console.log("\n========================================================");
    console.log("--- B1.5: ISOLATION & CONSISTENCY AUDIT ---");
    console.log("========================================================");

    const finalEventCount = parseInt(queryDb(`SELECT count(*) FROM public.relationship_events WHERE couple_id = '${QA_USERS.coupleId}';`), 10);
    const expectedFinalCount = initialEventCount + 1;
    const countIncreasedByOne = finalEventCount === expectedFinalCount;
    console.log(`  Pre-test count: ${initialEventCount} -> Post-test count: ${finalEventCount} (Net Δ +${finalEventCount - initialEventCount})`);
    console.log(`  Exactly 1 new event created, zero existing moments deleted: ${countIncreasedByOne}`);

    const remoteLeaksCount = networkAudit.remoteRequestsDetected.length;
    console.log(`  Total requests intercepted: ${networkAudit.totalRequests}`);
    console.log(`  Local Supabase requests: ${networkAudit.localSupabaseRequests.length}`);
    console.log(`  Remote Supabase requests (must be 0): ${remoteLeaksCount}`);

    const b1_5_pass = countIncreasedByOne && remoteLeaksCount === 0;
    results.b1_5_isolationAndConsistency = {
      status: b1_5_pass ? "PASS" : "FAIL",
      details: {
        initialEventCount,
        finalEventCount,
        countIncreasedByOne,
        remoteRequestsDetected: networkAudit.remoteRequestsDetected,
        localSupabaseRequestsCount: networkAudit.localSupabaseRequests.length,
        totalRequestsIntercepted: networkAudit.totalRequests,
      },
    };
    console.log(`>>> B1.5 RESULT: [${results.b1_5_isolationAndConsistency.status}] <<<`);

  } catch (err) {
    console.error(`[CRITICAL ERROR] Suite execution error: ${err.message}`);
    if (results.b1_1_frictionEntry.status === "PENDING") results.b1_1_frictionEntry.status = "FAIL";
    if (results.b1_2_frictionFormInput.status === "PENDING") results.b1_2_frictionFormInput.status = "FAIL";
    if (results.b1_3_createAndPersist.status === "PENDING") results.b1_3_createAndPersist.status = "FAIL";
    if (results.b1_4_authorView.status === "PENDING") results.b1_4_authorView.status = "FAIL";
    if (results.b1_5_isolationAndConsistency.status === "PENDING") results.b1_5_isolationAndConsistency.status = "FAIL";
    results.error = err.message;
  } finally {
    if (pageA) await pageA.close().catch(() => {});
    if (contextA) await contextA.close().catch(() => {});
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

runScenarioB1().catch((err) => {
  console.error("Fatal suite error:", err);
  process.exit(1);
});
