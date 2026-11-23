import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ARTIFACT_DIR = path.resolve("test-results/stability");
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, "screenshots");
const APP_URL = "http://127.0.0.1:8081";
const LOCAL_SUPABASE_HOST = "127.0.0.1:54321";

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

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function findExpoProcess() {
  let pid = null;
  try {
    const lsofOut = execSync("lsof -ti :8081 2>/dev/null", { encoding: "utf8" }).trim();
    if (lsofOut) {
      pid = parseInt(lsofOut.split("\n")[0], 10);
    }
  } catch {}

  if (!pid) {
    try {
      const psOut = execSync("pgrep -f 'expo.*start' || pgrep -f 'node.*expo' || true", { encoding: "utf8" }).trim();
      if (psOut) {
        pid = parseInt(psOut.split("\n")[0], 10);
      }
    } catch {}
  }

  return pid;
}

function getExpoMemoryAndHealth(pid) {
  let httpStatus = "000";
  try {
    httpStatus = execSync(`curl -s -o /dev/null -w "%{http_code}" ${APP_URL} || echo 000`, { encoding: "utf8" }).trim();
  } catch {
    httpStatus = "000";
  }

  let rssKb = 0;
  let vszKb = 0;
  let isRunning = false;
  if (pid) {
    try {
      const psOut = execSync(`ps -p ${pid} -o rss,vsz --no-headers`, { encoding: "utf8" }).trim();
      if (psOut) {
        const parts = psOut.split(/\s+/);
        rssKb = parseInt(parts[0], 10) || 0;
        vszKb = parseInt(parts[1], 10) || 0;
        isRunning = true;
      }
    } catch {
      isRunning = false;
    }
  }

  return {
    httpStatus,
    isRunning,
    rssMb: Math.round(rssKb / 1024),
    vszMb: Math.round(vszKb / 1024),
    rssKb,
  };
}

async function runStabilityCheck() {
  console.log("[stability-test] Starting Expo Stability & Client-Side Navigation Verification...");

  const detectedPid = findExpoProcess();
  console.log(`[stability-test] Detected Expo PID on port 8081: ${detectedPid || "NONE"}`);

  const initialHealth = getExpoMemoryAndHealth(detectedPid);
  console.log(`[stability-test] Initial Expo status: HTTP ${initialHealth.httpStatus}, RSS: ${initialHealth.rssMb} MB`);

  if (!initialHealth.isRunning || initialHealth.httpStatus !== "200") {
    console.error(`[BLOCKED] Expo server is not running or not responding HTTP 200 (HTTP ${initialHealth.httpStatus}).`);
    console.error("Per STRICT RESTRICTIONS: Do not start, restart or stop Expo automatically. Stopping execution.");
    process.exit(2);
  }

  // Check /proc/<pid>/environ for NODE_OPTIONS
  let nodeOptions = "UNKNOWN";
  try {
    const envOut = execSync(`tr '\\0' '\\n' < /proc/${detectedPid}/environ | grep '^NODE_OPTIONS=' || echo 'NODE_OPTIONS_NOT_FOUND'`, { encoding: "utf8" }).trim();
    nodeOptions = envOut;
  } catch {}

  console.log(`[stability-test] Verified process environment: ${nodeOptions}`);

  const auditLog = {
    timestamp: new Date().toISOString(),
    pid: detectedPid,
    nodeOptions,
    initialState: initialHealth,
    steps: [],
    errors: [],
    networkAudit: {
      totalRequests: 0,
      localSupabaseRequests: 0,
      remoteRequestsCount: 0,
    },
    finalResult: "FAIL",
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
      auditLog.networkAudit.totalRequests++;
      const url = req.url();
      if (url.includes("supabase.co") || url.includes("taxxvpkgzyevrhbytlqi")) {
        console.error(`[CRITICAL LEAK] Remote Supabase detected from ${contextName}: ${url}`);
        auditLog.networkAudit.remoteRequestsCount++;
      } else if (url.includes(LOCAL_SUPABASE_HOST) || url.includes("54321")) {
        auditLog.networkAudit.localSupabaseRequests++;
      }
    });

    page.on("pageerror", (err) => {
      console.error(`[browser-pageerror:${contextName}]`, err.message);
      auditLog.errors.push({ context: contextName, type: "pageerror", message: err.message });
    });
  }

  async function loginPartner(page, user, contextName) {
    page.setDefaultTimeout(20000);
    attachNetworkAuditing(page, contextName);

    console.log(`[stability-test] Initial document load (page.goto) & authenticating ${contextName}...`);
    // Deliberate initial cold load for application entry
    await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForSelector("input[type=\"email\"], input[placeholder*=\"Email\" i]", { timeout: 10000 });
    await page.waitForTimeout(1000);

    const emailInput = page.locator("input[type=\"email\"], input[placeholder*=\"Email\" i]").first();
    const passwordInput = page.locator("input[type=\"password\"], input[placeholder*=\"Password\" i]").first();

    await emailInput.fill(user.email);
    await passwordInput.fill(user.password);
    await page.waitForTimeout(400);

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

    // Instrument page with unique in-memory SPA marker to verify zero document reloads
    const marker = `${contextName}-${Math.random().toString(36)}`;
    await page.evaluate((m) => {
      window.__spaSessionMarker = m;
    }, marker);

    return marker;
  }

  let contextA, contextB, pageA, pageB;

  try {
    contextA = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    pageA = await contextA.newPage();
    const markerA = await loginPartner(pageA, QA_USERS.partnerA, "Partner A");

    contextB = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    pageB = await contextB.newPage();
    const markerB = await loginPartner(pageB, QA_USERS.partnerB, "Partner B");

    console.log("[stability-test] Both partners authenticated. Initial SPA markers registered.");

    // Navigation action definitions using REAL UI controls only
    // NO page.goto, NO window.history.pushState
    const benchmarkSteps = [
      {
        step: 1,
        partner: "Partner A",
        page: pageA,
        expectedMarker: markerA,
        name: "Partner A -> Moments Tab",
        action: async (p) => {
          const momentsBtn = p.locator('[aria-label^="Moments"]').first();
          await momentsBtn.click();
          await p.waitForFunction(() => window.location.pathname.includes("/events"), { timeout: 10000 });
          await p.waitForSelector("text=Moments", { timeout: 5000 });
        },
      },
      {
        step: 2,
        partner: "Partner B",
        page: pageB,
        expectedMarker: markerB,
        name: "Partner B -> Moments Tab",
        action: async (p) => {
          const momentsBtn = p.locator('[aria-label^="Moments"]').first();
          await momentsBtn.click();
          await p.waitForFunction(() => window.location.pathname.includes("/events"), { timeout: 10000 });
          await p.waitForSelector("text=Moments", { timeout: 5000 });
        },
      },
      {
        step: 3,
        partner: "Partner A",
        page: pageA,
        expectedMarker: markerA,
        name: "Partner A -> My Rhythm Tab (Home)",
        action: async (p) => {
          const rhythmBtn = p.locator('[aria-label^="My Rhythm"]').first();
          await rhythmBtn.click();
          await p.waitForFunction(() => window.location.pathname.includes("/home"), { timeout: 10000 });
          await p.waitForSelector("text=What matters now", { timeout: 5000 });
        },
      },
      {
        step: 4,
        partner: "Partner B",
        page: pageB,
        expectedMarker: markerB,
        name: "Partner B -> My Rhythm Tab (Home)",
        action: async (p) => {
          const rhythmBtn = p.locator('[aria-label^="My Rhythm"]').first();
          await rhythmBtn.click();
          await p.waitForFunction(() => window.location.pathname.includes("/home"), { timeout: 10000 });
          await p.waitForSelector("text=What matters now", { timeout: 5000 });
        },
      },
      {
        step: 5,
        partner: "Partner A",
        page: pageA,
        expectedMarker: markerA,
        name: "Partner A -> Record Positive (Sheet -> Good)",
        action: async (p) => {
          // Tap floating button
          const recordBtn = p.getByRole("button", { name: /record a moment/i }).first();
          await recordBtn.click();
          await p.waitForSelector('text=What would you like to record?', { timeout: 5000 });
          // Tap Something good tile
          const goodTile = p.getByRole("button", { name: /something good/i }).first();
          await goodTile.click();
          await p.waitForFunction(() => window.location.pathname.includes("/record-moment"), { timeout: 10000 });
          await p.waitForSelector("text=What was it about?", { timeout: 5000 });
        },
      },
      {
        step: 6,
        partner: "Partner A",
        page: pageA,
        expectedMarker: markerA,
        name: "Partner A -> Header Back to Home",
        action: async (p) => {
          // Tap Header ‹ Back button
          const backBtn = p.getByRole("button", { name: /back/i }).first();
          await backBtn.click();
          await p.waitForFunction(() => window.location.pathname.includes("/home"), { timeout: 10000 });
          await p.waitForSelector("text=What matters now", { timeout: 5000 });
        },
      },
      {
        step: 7,
        partner: "Partner B",
        page: pageB,
        expectedMarker: markerB,
        name: "Partner B -> Record Friction (Sheet -> Off)",
        action: async (p) => {
          // Tap floating button
          const recordBtn = p.getByRole("button", { name: /record a moment/i }).first();
          await recordBtn.click();
          await p.waitForSelector('text=What would you like to record?', { timeout: 5000 });
          // Tap Something felt off tile
          const offTile = p.getByRole("button", { name: /something felt off/i }).first();
          await offTile.click();
          await p.waitForFunction(() => window.location.pathname.includes("/record-moment"), { timeout: 10000 });
          await p.waitForSelector("text=What was it about?", { timeout: 5000 });
        },
      },
      {
        step: 8,
        partner: "Partner B",
        page: pageB,
        expectedMarker: markerB,
        name: "Partner B -> Header Back to Home",
        action: async (p) => {
          const backBtn = p.getByRole("button", { name: /back/i }).first();
          await backBtn.click();
          await p.waitForFunction(() => window.location.pathname.includes("/home"), { timeout: 10000 });
          await p.waitForSelector("text=What matters now", { timeout: 5000 });
        },
      },
      {
        step: 9,
        partner: "Partner A",
        page: pageA,
        expectedMarker: markerA,
        name: "Partner A -> Moments Tab (Second visit)",
        action: async (p) => {
          const momentsBtn = p.locator('[aria-label^="Moments"]').first();
          await momentsBtn.click();
          await p.waitForFunction(() => window.location.pathname.includes("/events"), { timeout: 10000 });
          await p.waitForSelector("text=Moments", { timeout: 5000 });
        },
      },
      {
        step: 10,
        partner: "Partner A",
        page: pageA,
        expectedMarker: markerA,
        name: "Partner A -> My Rhythm Tab (Final return to Home)",
        action: async (p) => {
          const rhythmBtn = p.locator('[aria-label^="My Rhythm"]').first();
          await rhythmBtn.click();
          await p.waitForFunction(() => window.location.pathname.includes("/home"), { timeout: 10000 });
          await p.waitForSelector("text=What matters now", { timeout: 5000 });
        },
      },
    ];

    for (const item of benchmarkSteps) {
      console.log(`[stability-test] Executing Step ${item.step}/10: ${item.name}...`);
      const startTime = Date.now();

      await item.action(item.page);
      const durationMs = Date.now() - startTime;

      // Verify client-side SPA navigation: marker must be identical
      const activeMarker = await item.page.evaluate(() => window.__spaSessionMarker);
      const isClientSpa = activeMarker === item.expectedMarker;

      const memAfter = getExpoMemoryAndHealth(detectedPid);
      const filename = `step-${item.step}-${item.partner.replace(/\s+/g, "_")}.png`;
      const screenshotPath = path.join(SCREENSHOT_DIR, filename);
      await item.page.screenshot({ path: screenshotPath });

      console.log(`  -> Finished in ${durationMs}ms | SPA Preserved: ${isClientSpa} | HTTP ${memAfter.httpStatus} | Expo RSS: ${memAfter.rssMb} MB`);

      const stepRecord = {
        step: item.step,
        name: item.name,
        partner: item.partner,
        durationMs,
        isClientSpa,
        httpStatus: memAfter.httpStatus,
        rssMb: memAfter.rssMb,
        vszMb: memAfter.vszMb,
        screenshot: screenshotPath,
        status: isClientSpa && memAfter.httpStatus === "200" ? "PASS" : "FAIL",
      };

      auditLog.steps.push(stepRecord);

      if (memAfter.httpStatus !== "200" || !memAfter.isRunning) {
        console.error(`[CRITICAL] Expo server halted during step ${item.step}!`);
        break;
      }

      await new Promise((r) => setTimeout(r, 600)); // Gentle spacing between touch actions
    }

    const allStepsPassed = auditLog.steps.length === 10 && auditLog.steps.every((s) => s.status === "PASS");
    auditLog.finalResult = allStepsPassed && auditLog.networkAudit.remoteRequestsCount === 0 ? "PASS" : "FAIL";

  } catch (err) {
    console.error("[stability-test] Execution caught error:", err.message);
    auditLog.errors.push({ type: "execution", message: err.message });
  } finally {
    if (contextA) await contextA.close().catch(() => {});
    if (contextB) await contextB.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }

  auditLog.finalState = getExpoMemoryAndHealth(detectedPid);

  const reportPath = path.join(ARTIFACT_DIR, "stability-client-nav-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(auditLog, null, 2));

  console.log("\n=======================================================");
  console.log("       EXPO CLIENT-SIDE NAVIGATION BENCHMARK REPORT     ");
  console.log("=======================================================");
  console.log(`FINAL RESULT:      ${auditLog.finalResult}`);
  console.log(`STEPS COMPLETED:   ${auditLog.steps.filter((s) => s.status === "PASS").length} / 10`);
  console.log(`START EXPO RSS:    ${auditLog.initialState.rssMb} MB`);
  console.log(`FINAL EXPO RSS:    ${auditLog.finalState.rssMb} MB`);
  console.log(`FINAL HTTP STATUS: ${auditLog.finalState.httpStatus}`);
  console.log(`BROWSER ERRORS:    ${auditLog.errors.length}`);
  console.log(`REMOTE LEAKS:      ${auditLog.networkAudit.remoteRequestsCount}`);
  console.log(`REPORT SAVED:      ${reportPath}`);
  console.log("=======================================================\n");

  if (auditLog.finalResult !== "PASS") {
    process.exit(1);
  }
}

runStabilityCheck().catch((err) => {
  console.error("Unhandled fatal error:", err);
  process.exit(1);
});
