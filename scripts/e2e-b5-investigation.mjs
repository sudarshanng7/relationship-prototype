import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SCREENSHOT_DIR = path.resolve("test-results/phase3b/screenshots");
const APP_URL = "http://127.0.0.1:8081";

const QA_USERS = {
  partnerA: {
    email: "partner-a@example.com",
    password: process.env.PG_QA_PASSWORD,
    displayName: "Partner A",
  },
  partnerB: {
    email: "partner-b@example.com",
    password: process.env.PG_QA_PASSWORD,
    displayName: "Partner B",
  },
};

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function loginPartner(page, user) {
  page.setDefaultTimeout(30000);
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

  await page.waitForFunction(() => window.location.pathname.includes("/home"), { timeout: 20000 });
  await page.waitForSelector("text=What matters now", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(800);
}

async function inspectHome() {
  const extraLibPath = "/tmp/playwright-libs/usr/lib/x86_64-linux-gnu";
  const env = fs.existsSync(extraLibPath)
    ? { ...process.env, LD_LIBRARY_PATH: `${extraLibPath}:${process.env.LD_LIBRARY_PATH || ""}` }
    : process.env;

  const browser = await chromium.launch({
    headless: true,
    env,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    console.log("=== INSPECTING PARTNER B HOME ===");
    const contextB = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pageB = await contextB.newPage();
    await loginPartner(pageB, QA_USERS.partnerB);

    const bHomeDetails = await pageB.evaluate(() => {
      // Find What matters now section
      const bodyText = document.body.innerText || "";
      const elements = Array.from(document.querySelectorAll("*"));
      const wmnIndex = bodyText.indexOf("What matters now");
      const wmnSection = wmnIndex !== -1 ? bodyText.slice(wmnIndex, wmnIndex + 800) : "NOT FOUND";

      // Look for buttons or links in What matters now
      const buttons = Array.from(document.querySelectorAll('[role="button"], button')).map((b) => ({
        text: b.innerText,
        ariaLabel: b.getAttribute("aria-label"),
      }));

      return {
        wmnSection,
        buttons: buttons.slice(0, 15),
      };
    });

    console.log("Partner B What Matters Now text:\n", bHomeDetails.wmnSection);
    console.log("Partner B Buttons:", JSON.stringify(bHomeDetails.buttons, null, 2));

    const ssPathB = path.join(SCREENSHOT_DIR, "B5-investigation-partner-b-home.png");
    await pageB.screenshot({ path: ssPathB });
    console.log(`Saved screenshot: ${ssPathB}`);

    // If there is an action button, let's see what happens if we hover or what navigation target it has
    // We can intercept router.push or window.location changes by clicking
    let interceptedNavB = null;
    pageB.on("framenavigated", (frame) => {
      if (frame === pageB.mainFrame()) {
        interceptedNavB = frame.url();
      }
    });

    const actionBtnB = pageB.locator('[aria-label="Open when ready"], [aria-label="See the moment"], text="Open when ready", text="See the moment"').first();
    if (await actionBtnB.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log("Clicking action button to verify destination...");
      await actionBtnB.click();
      await pageB.waitForTimeout(1000);
      interceptedNavB = pageB.url();
      console.log(`Partner B Action Button navigated to: ${interceptedNavB}`);
      const ssPathNavB = path.join(SCREENSHOT_DIR, "B5-investigation-partner-b-destination.png");
      await pageB.screenshot({ path: ssPathNavB });
    }

    console.log("\n=== INSPECTING PARTNER A HOME ===");
    const contextA = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pageA = await contextA.newPage();
    await loginPartner(pageA, QA_USERS.partnerA);

    const aHomeDetails = await pageA.evaluate(() => {
      const bodyText = document.body.innerText || "";
      const wmnIndex = bodyText.indexOf("What matters now");
      const wmnSection = wmnIndex !== -1 ? bodyText.slice(wmnIndex, wmnIndex + 800) : "NOT FOUND";
      return { wmnSection };
    });

    console.log("Partner A What Matters Now text:\n", aHomeDetails.wmnSection);

    const ssPathA = path.join(SCREENSHOT_DIR, "B5-investigation-partner-a-home.png");
    await pageA.screenshot({ path: ssPathA });
    console.log(`Saved screenshot: ${ssPathA}`);

    await contextA.close();
    await contextB.close();
  } finally {
    await browser.close();
  }
}

inspectHome().catch(console.error);
