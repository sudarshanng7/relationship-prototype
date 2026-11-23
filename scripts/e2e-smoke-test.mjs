import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ARTIFACT_DIR = path.resolve("test-results/smoke");
const SCREENSHOT_PATH = path.join(ARTIFACT_DIR, "smoke-mobile-390x844.png");
const APP_URL = "http://127.0.0.1:8081";

async function runSmokeTest() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  const consoleLogs = [];
  const pageErrors = [];
  const failedRequests = [];

  let browser;
  let status = "FAIL";
  let httpStatus = null;
  let observedScreen = "unknown";
  let pageTitle = "";
  let renderedTextSample = "";

  try {
    console.log("[smoke] Launching Chromium headlessly...");
    const extraLibPath = "/tmp/playwright-libs/usr/lib/x86_64-linux-gnu";
    const env = fs.existsSync(extraLibPath)
      ? { ...process.env, LD_LIBRARY_PATH: `${extraLibPath}:${process.env.LD_LIBRARY_PATH || ""}` }
      : process.env;

    browser = await chromium.launch({
      headless: true,
      env,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    console.log("[smoke] Creating mobile context (390x844)...");
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });

    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(15000);

    page.on("console", (msg) => {
      const type = msg.type();
      const text = msg.text();
      // Redact sensitive patterns if any
      const sanitized = text.replace(/([?&](token|access_token|key|secret)=)[^&\s]+/gi, "$1[REDACTED]");
      if (type === "error" || type === "warning") {
        consoleLogs.push({ type, text: sanitized });
      }
    });

    page.on("pageerror", (err) => {
      pageErrors.push(err.message || String(err));
    });

    page.on("requestfailed", (req) => {
      const url = req.url().replace(/([?&](token|access_token|key|secret)=)[^&\s]+/gi, "$1[REDACTED]");
      failedRequests.push({
        url,
        method: req.method(),
        failure: req.failure()?.errorText || "unknown",
      });
    });

    console.log(`[smoke] Navigating to ${APP_URL}...`);
    const response = await page.goto(APP_URL, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    httpStatus = response?.status() ?? null;
    console.log(`[smoke] Response HTTP status: ${httpStatus}`);

    // Wait bounded time (up to 4s) for React Native Web DOM root to mount
    try {
      await page.waitForSelector("#root, [data-testid], body > div", { timeout: 4000 });
    } catch {
      // Proceed even if selector did not match immediately
    }

    // Give 1.5s for initial client render
    await page.waitForTimeout(1500);

    pageTitle = await page.title();
    const currentUrl = page.url();

    // Inspect visible text to identify rendered screen
    const bodyText = (await page.evaluate(() => document.body.innerText || "")) || "";
    const trimmedBody = bodyText.replace(/\s+/g, " ").trim();
    renderedTextSample = trimmedBody.slice(0, 300);

    if (
      trimmedBody.toLowerCase().includes("purple garden") ||
      trimmedBody.toLowerCase().includes("garden") ||
      trimmedBody.toLowerCase().includes("what matters now") ||
      trimmedBody.toLowerCase().includes("sign in") ||
      trimmedBody.toLowerCase().includes("log in") ||
      trimmedBody.toLowerCase().includes("welcome") ||
      currentUrl.includes("/home") ||
      currentUrl.includes("/onboarding") ||
      currentUrl.includes("/login")
    ) {
      if (trimmedBody.toLowerCase().includes("what matters now")) {
        observedScreen = "Home / What Matters Now (Authenticated or Default Session)";
      } else if (trimmedBody.toLowerCase().includes("sign in") || trimmedBody.toLowerCase().includes("log in")) {
        observedScreen = "Authentication / Sign In Screen";
      } else if (trimmedBody.toLowerCase().includes("onboarding") || trimmedBody.toLowerCase().includes("welcome")) {
        observedScreen = "Onboarding Screen";
      } else {
        observedScreen = "Purple Garden Root UI";
      }
    } else if (trimmedBody.length > 0) {
      observedScreen = `Rendered UI: ${trimmedBody.slice(0, 60)}...`;
    } else {
      observedScreen = "Blank or Loading DOM";
    }

    console.log(`[smoke] Observed screen: ${observedScreen}`);
    console.log(`[smoke] Capturing sanitized screenshot to ${SCREENSHOT_PATH}...`);
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });

    status = (httpStatus === 200 && fs.existsSync(SCREENSHOT_PATH)) ? "PASS" : "FAIL";
  } catch (err) {
    console.error("[smoke] Exception during smoke test:", err.message);
    status = "FAIL";
  } finally {
    if (browser) {
      console.log("[smoke] Closing browser...");
      await browser.close();
    }
  }

  const result = {
    status,
    browserStartup: browser ? "PASS" : "FAIL",
    httpStatus,
    observedScreen,
    pageTitle,
    renderedTextSample,
    screenshotPath: SCREENSHOT_PATH,
    screenshotExists: fs.existsSync(SCREENSHOT_PATH),
    consoleErrorsCount: consoleLogs.filter((l) => l.type === "error").length,
    consoleWarningsCount: consoleLogs.filter((l) => l.type === "warning").length,
    consoleLogs,
    pageErrors,
    failedRequests,
  };

  console.log("\n--- SMOKE TEST RESULT ---");
  console.log(JSON.stringify(result, null, 2));

  if (status !== "PASS") {
    process.exit(1);
  }
}

runSmokeTest();
