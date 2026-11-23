import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ARTIFACT_DIR = path.resolve("test-results/phase3a");
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, "screenshots");
const REPORT_FILE = path.join(ARTIFACT_DIR, "a5-history-diagnostic-report.json");
const APP_URL = "http://127.0.0.1:8081";

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

async function runDiagnostic() {
  console.log("=== A5 SHARED HISTORY & DOM DIAGNOSTIC ===");

  const extraLibPath = "/tmp/playwright-libs/usr/lib/x86_64-linux-gnu";
  const env = fs.existsSync(extraLibPath)
    ? { ...process.env, LD_LIBRARY_PATH: `${extraLibPath}:${process.env.LD_LIBRARY_PATH || ""}` }
    : process.env;

  const browser = await chromium.launch({
    headless: true,
    env,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  async function loginAndNavigate(user) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector('input[type="email"], input[placeholder*="Email" i]', { timeout: 15000 });

    const emailInput = page.locator('input[type="email"], input[placeholder*="Email" i]').first();
    const passwordInput = page.locator('input[type="password"], input[placeholder*="Password" i]').first();
    await emailInput.fill(user.email);
    await passwordInput.fill(user.password);

    const signInBtn = page.locator('[aria-label="Sign in"]');
    await signInBtn.click();

    await page.waitForFunction(() => window.location.pathname.includes("/home"), { timeout: 20000 });
    await page.waitForTimeout(800);

    // In-app navigation to Our Space
    const oursTab = page.getByRole("button", { name: /^Our Space|^Moments/i }).first();
    if (await oursTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await oursTab.click();
    } else {
      const oursTile = page.locator('[aria-label="Open Ours, your shared space"]').first();
      await oursTile.click();
    }

    await page.waitForFunction(() => window.location.pathname.includes("/events"), { timeout: 10000 });
    await page.waitForTimeout(1000);

    return { context, page };
  }

  const diagnosticData = {};

  for (const [key, user] of Object.entries(QA_USERS)) {
    console.log(`\nInspecting for ${user.displayName}...`);
    const { context, page } = await loginAndNavigate(user);

    const ssPath = path.join(SCREENSHOT_DIR, `diagnostic-${key}-our-space.png`);
    await page.screenshot({ path: ssPath, fullPage: true });

    const domInfo = await page.evaluate(() => {
      const currentUrl = window.location.href;
      const titleEl = document.querySelector("h1, h2, [role='heading']");
      const title = titleEl ? titleEl.innerText : "";

      // Find all buttons / cards
      const buttons = Array.from(document.querySelectorAll('[role="button"]')).map((el) => {
        return {
          ariaLabel: el.getAttribute("aria-label"),
          innerText: el.innerText ? el.innerText.trim().replace(/\n+/g, " | ") : "",
          role: el.getAttribute("role"),
          tagName: el.tagName,
        };
      });

      // Find all text blocks
      const bodyText = document.body.innerText || "";

      return {
        currentUrl,
        title,
        buttonCount: buttons.length,
        buttons,
        bodyTextSnippet: bodyText.slice(0, 1500),
      };
    });

    console.log(`  Current URL: ${domInfo.currentUrl}`);
    console.log(`  Title: ${domInfo.title}`);
    console.log(`  Found ${domInfo.buttonCount} button-like elements`);

    // Filter cards specifically in the list
    const momentCards = domInfo.buttons.filter((b) =>
      b.ariaLabel && (b.ariaLabel.includes("Open shared") || b.ariaLabel.includes("moment recorded"))
    );
    console.log(`  Moment Cards found: ${momentCards.length}`);
    momentCards.forEach((c, idx) => {
      console.log(`    Card [${idx + 1}]: "${c.ariaLabel}" -> [${c.innerText}]`);
    });

    diagnosticData[key] = {
      domInfo,
      momentCards,
      screenshot: ssPath,
    };

    // Test clicking the first moment card (Affection) to verify navigation to detail
    console.log(`  Attempting to click first card to test detail navigation...`);
    const firstCard = page.locator('[role="button"]').filter({ hasText: /Affection|Humour|Support|Care/i }).first();
    if (await firstCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstCard.click();
      await page.waitForFunction(() => window.location.pathname.includes("/event/"), { timeout: 10000 });
      await page.waitForTimeout(800);

      const detailUrl = page.url();
      const detailText = await page.evaluate(() => document.body.innerText || "");
      console.log(`  Detail URL: ${detailUrl}`);
      console.log(`  Detail contains "What you shared" / "shared": ${detailText.includes("shared")}`);
      console.log(`  Detail contains "Stargazing": ${detailText.includes("Stargazing")}`);

      const ssDetailPath = path.join(SCREENSHOT_DIR, `diagnostic-${key}-detail-navigation.png`);
      await page.screenshot({ path: ssDetailPath });
      diagnosticData[key].detailTest = {
        detailUrl,
        hasSharedTopic: detailText.includes("Stargazing") || detailText.includes("Evening tea") || detailText.includes("shared"),
        screenshot: ssDetailPath,
      };

      // Navigate back
      const backBtn = page.getByRole("button", { name: /Back/i }).first();
      await backBtn.click();
      await page.waitForFunction(() => window.location.pathname.includes("/events"), { timeout: 10000 });
      console.log(`  Returned back to Our Space: ${page.url()}`);
    }

    await page.close();
    await context.close();
  }

  await browser.close();

  fs.writeFileSync(REPORT_FILE, JSON.stringify(diagnosticData, null, 2));
  console.log(`\nDiagnostic report written to: ${REPORT_FILE}`);
}

runDiagnostic().catch((err) => {
  console.error("Diagnostic error:", err);
  process.exit(1);
});
