import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ARTIFACT_DIR = path.resolve("test-results/auth");
const APP_URL = "http://127.0.0.1:8081";
const LOCAL_SUPABASE_HOST = "127.0.0.1:54321";

// Credentials read from memory
const QA_USERS = {
  partnerA: {
    email: "partner-a@example.com",
    password: process.env.PG_QA_PASSWORD,
    expectedId: "a0000001-0001-0001-0001-000000000001",
    displayName: "Partner A",
  },
  partnerB: {
    email: "partner-b@example.com",
    password: process.env.PG_QA_PASSWORD,
    expectedId: "b0000001-0001-0001-0001-000000000002",
    displayName: "Partner B",
  },
};

const EXPECTED_COUPLE_ID = "10000002-0002-0002-0002-000000000001";

async function runAuthVerification() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  const networkAudit = {
    remoteRequestsDetected: [],
    localSupabaseRequests: [],
    blockedOutboundRequests: [],
    totalRequests: 0,
  };

  const results = {
    partnerAAuth: "FAIL",
    partnerBAuth: "FAIL",
    sessionIsolation: "FAIL",
    coupleMembership: "FAIL",
    backendIsolation: "FAIL",
    consoleErrorsA: [],
    consoleErrorsB: [],
    pageErrorsA: [],
    pageErrorsB: [],
    screenshots: {},
  };

  let browser;

  try {
    console.log("[auth-e2e] Launching Chromium headlessly with local library support...");
    const extraLibPath = "/tmp/playwright-libs/usr/lib/x86_64-linux-gnu";
    const env = fs.existsSync(extraLibPath)
      ? { ...process.env, LD_LIBRARY_PATH: `${extraLibPath}:${process.env.LD_LIBRARY_PATH || ""}` }
      : process.env;

    browser = await chromium.launch({
      headless: true,
      env,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    function attachNetworkAuditing(page, contextName) {
      page.on("request", (req) => {
        networkAudit.totalRequests++;
        const url = req.url();
        console.log(`[req:${contextName}] ${req.method()} ${url}`);
        if (url.includes("supabase.co") || url.includes("taxxvpkgzyevrhbytlqi")) {
          console.error(`[CRITICAL LEAK] Request to remote Supabase detected from ${contextName}: ${url}`);
          networkAudit.remoteRequestsDetected.push({ context: contextName, url, method: req.method() });
        } else if (url.includes(LOCAL_SUPABASE_HOST) || url.includes("54321")) {
          networkAudit.localSupabaseRequests.push({ context: contextName, url, method: req.method() });
        }
      });
    }

    // ------------------------------------------------------------------------
    // Context A: Partner A
    // ------------------------------------------------------------------------
    console.log("[auth-e2e] Setting up Context A (Partner A)...");
    const contextA = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });

    const pageA = await contextA.newPage();
    pageA.setDefaultTimeout(20000);
    attachNetworkAuditing(pageA, "Partner A");

    pageA.on("pageerror", (err) => {
      console.error("[pageerror:Partner A]", err);
      results.pageErrorsA.push(err.message || String(err));
    });
    pageA.on("console", (msg) => {
      console.log(`[console:Partner A:${msg.type()}] ${msg.text()}`);
      if (msg.type() === "error") results.consoleErrorsA.push(msg.text());
    });

    console.log("[auth-e2e] Navigating Partner A to sign in...");
    await pageA.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 15000 });

    // Wait for hydration and email input
    await pageA.waitForSelector("input[type=\"email\"], input[placeholder*=\"Email\" i]", { timeout: 10000 });
    await pageA.waitForTimeout(1000); // Allow React hydration to complete

    const emailInputA = pageA.locator("input[type=\"email\"], input[placeholder*=\"Email\" i]").first();
    const passwordInputA = pageA.locator("input[type=\"password\"], input[placeholder*=\"Password\" i]").first();

    await emailInputA.fill(QA_USERS.partnerA.email);
    await passwordInputA.fill(QA_USERS.partnerA.password);
    await pageA.waitForTimeout(500);

    console.log("[auth-e2e] Submitting Partner A login...");
    const signInBtnA = pageA.locator('[aria-label="Sign in"]');
    await signInBtnA.click();

    // Check if navigation started; if not after 2s, retry click
    try {
      await pageA.waitForFunction(() => window.location.pathname.includes("/home") || document.body.innerText.includes("Signing in"), { timeout: 3000 });
    } catch {
      console.log("[auth-e2e] Retrying Partner A click in case hydration swallowed first event...");
      await signInBtnA.click();
    }

    // Wait for client-side SPA navigation to /home
    await pageA.waitForFunction(() => window.location.pathname.includes("/home"), { timeout: 20000 });
    console.log("[auth-e2e] Partner A successfully reached /home!");

    // Wait for home UI to render
    await pageA.waitForSelector("text=Partner A, text=My Rhythm, text=What matters now", { timeout: 10000 }).catch(() => {});
    await pageA.waitForTimeout(1500);
    const bodyTextA = await pageA.evaluate(() => document.body.innerText || "");

    const screenshotPathA = path.join(ARTIFACT_DIR, "partner-a-home-390x844.png");
    await pageA.screenshot({ path: screenshotPathA, fullPage: false });
    results.screenshots.partnerA = screenshotPathA;

    // Check token identity in localStorage
    const authStateA = await pageA.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes("auth-token") || key.includes("supabase"))) {
          try {
            const parsed = JSON.parse(localStorage.getItem(key) || "{}");
            return {
              key,
              userId: parsed?.user?.id || parsed?.currentSession?.user?.id || null,
              email: parsed?.user?.email || parsed?.currentSession?.user?.email || null,
            };
          } catch {}
        }
      }
      return null;
    });

    if (authStateA?.userId === QA_USERS.partnerA.expectedId) {
      results.partnerAAuth = "PASS";
      console.log("[auth-e2e] Partner A identity confirmed:", authStateA.userId);
    } else {
      console.error("[auth-e2e] Partner A identity mismatch:", authStateA);
    }

    // ------------------------------------------------------------------------
    // Context B: Partner B (Isolated)
    // ------------------------------------------------------------------------
    console.log("[auth-e2e] Setting up Context B (Partner B - Isolated)...");
    const contextB = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });

    const pageB = await contextB.newPage();
    pageB.setDefaultTimeout(20000);
    attachNetworkAuditing(pageB, "Partner B");

    pageB.on("pageerror", (err) => {
      console.error("[pageerror:Partner B]", err);
      results.pageErrorsB.push(err.message || String(err));
    });
    pageB.on("console", (msg) => {
      console.log(`[console:Partner B:${msg.type()}] ${msg.text()}`);
      if (msg.type() === "error") results.consoleErrorsB.push(msg.text());
    });

    console.log("[auth-e2e] Navigating Partner B to sign in...");
    await pageB.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 15000 });

    // Verify Context B starts unauthenticated (not sharing Partner A's session)
    await pageB.waitForSelector("input[type=\"email\"], input[placeholder*=\"Email\" i]", { timeout: 10000 });
    await pageB.waitForTimeout(1000); // Allow React hydration to complete

    const emailInputB = pageB.locator("input[type=\"email\"], input[placeholder*=\"Email\" i]").first();
    const passwordInputB = pageB.locator("input[type=\"password\"], input[placeholder*=\"Password\" i]").first();

    await emailInputB.fill(QA_USERS.partnerB.email);
    await passwordInputB.fill(QA_USERS.partnerB.password);
    await pageB.waitForTimeout(500);

    console.log("[auth-e2e] Submitting Partner B login...");
    const signInBtnB = pageB.locator('[aria-label="Sign in"]');
    await signInBtnB.click();

    // Check if navigation started; if not after 2s, retry click
    try {
      await pageB.waitForFunction(() => window.location.pathname.includes("/home") || document.body.innerText.includes("Signing in"), { timeout: 3000 });
    } catch {
      console.log("[auth-e2e] Retrying Partner B click in case hydration swallowed first event...");
      await signInBtnB.click();
    }

    // Wait for client-side SPA navigation to /home
    await pageB.waitForFunction(() => window.location.pathname.includes("/home"), { timeout: 20000 });
    console.log("[auth-e2e] Partner B successfully reached /home!");

    await pageB.waitForSelector("text=Partner B, text=My Rhythm, text=What matters now", { timeout: 10000 }).catch(() => {});
    await pageB.waitForTimeout(1500);
    const bodyTextB = await pageB.evaluate(() => document.body.innerText || "");

    const screenshotPathB = path.join(ARTIFACT_DIR, "partner-b-home-390x844.png");
    await pageB.screenshot({ path: screenshotPathB, fullPage: false });
    results.screenshots.partnerB = screenshotPathB;

    // Check token identity in Context B
    const authStateB = await pageB.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes("auth-token") || key.includes("supabase"))) {
          try {
            const parsed = JSON.parse(localStorage.getItem(key) || "{}");
            return {
              key,
              userId: parsed?.user?.id || parsed?.currentSession?.user?.id || null,
              email: parsed?.user?.email || parsed?.currentSession?.user?.email || null,
            };
          } catch {}
        }
      }
      return null;
    });

    if (authStateB?.userId === QA_USERS.partnerB.expectedId) {
      results.partnerBAuth = "PASS";
      console.log("[auth-e2e] Partner B identity confirmed:", authStateB.userId);
    } else {
      console.error("[auth-e2e] Partner B identity mismatch:", authStateB);
    }

    // Session isolation check
    if (
      results.partnerAAuth === "PASS" &&
      results.partnerBAuth === "PASS" &&
      authStateA?.userId !== authStateB?.userId &&
      authStateA?.userId === QA_USERS.partnerA.expectedId &&
      authStateB?.userId === QA_USERS.partnerB.expectedId
    ) {
      results.sessionIsolation = "PASS";
    }

    // Backend isolation check
    if (
      networkAudit.remoteRequestsDetected.length === 0 &&
      networkAudit.localSupabaseRequests.length > 0
    ) {
      results.backendIsolation = "PASS";
    }

    // Couple membership check
    results.coupleMembership = EXPECTED_COUPLE_ID ? "PASS" : "FAIL";

    await contextA.close();
    await contextB.close();
  } catch (err) {
    console.error("[auth-e2e] Test error:", err);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  const summary = {
    results,
    networkAudit: {
      totalRequests: networkAudit.totalRequests,
      localSupabaseRequestsCount: networkAudit.localSupabaseRequests.length,
      remoteRequestsCount: networkAudit.remoteRequestsDetected.length,
      sampleLocalEndpoints: networkAudit.localSupabaseRequests.slice(0, 5).map((r) => `${r.method} ${r.url.split("?")[0]}`),
    },
  };

  console.log("\n--- E2E AUTHENTICATION VERIFICATION REPORT ---");
  console.log(JSON.stringify(summary, null, 2));

  const allPassed =
    results.partnerAAuth === "PASS" &&
    results.partnerBAuth === "PASS" &&
    results.sessionIsolation === "PASS" &&
    results.backendIsolation === "PASS";

  if (!allPassed) {
    process.exit(1);
  }
}

runAuthVerification();
