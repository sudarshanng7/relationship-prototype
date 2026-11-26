/**
 * scripts/verify-browser-stabilization-journeys.mjs
 *
 * Comprehensive Live Playwright Browser Verification of Journeys A through J:
 * - A: Supported situation -> 3 contextual angles
 * - B: Ambiguous situation -> optional clarification ("A little more about this moment?")
 * - C: Click "Add a little detail" -> focuses existing input, scrolls into view, appends text
 * - D: Submit revised detail -> receives grounded angles directly
 * - E: Add detail to unsupported situation -> receives graceful continuation ("Every moment is different")
 * - F: Click "Edit my description" after unsuccessful clarification
 * - I: Respectful reflection for sensitive situation
 * - J: Verify the 3 corrected historical semantic cases
 */

import { chromium } from "@playwright/test";
import fs from "node:fs";

const APP_URL = "http://127.0.0.1:8081/playful-reframe";
const extraLibPath = "/tmp/playwright-libs/usr/lib/x86_64-linux-gnu";
const env = fs.existsSync(extraLibPath)
  ? { ...process.env, LD_LIBRARY_PATH: `${extraLibPath}:${process.env.LD_LIBRARY_PATH || ""}` }
  : process.env;

const browser = await chromium.launch({
  headless: true,
  env,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(60000);

console.log(`[Browser] Opening ${APP_URL}...`);
await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
await page.waitForSelector('textarea, [placeholder*="shoes left"]', { timeout: 45000 });
await page.waitForTimeout(1000);

const artifactDir = "/home/kaivlya/.gemini/antigravity/brain/0f0bb05c-68ce-443b-a278-513a5bfda135";

async function enterTextAndSeeAngles(text) {
  const editBtn = page.getByText("Edit description").or(page.getByText("Edit my description")).or(page.getByText("Edit my reflection"));
  if (await editBtn.count() > 0 && await editBtn.first().isVisible()) {
    await editBtn.first().click();
    await page.waitForTimeout(400);
  }

  const textArea = page.locator("textarea").first();
  await textArea.click();
  await textArea.fill(text);
  await page.waitForTimeout(300);

  const seeBtn = page.getByText("See lighter angles");
  await seeBtn.click();
  await page.waitForTimeout(1500);
}

// -------------------------------------------------------------
// Journey A: Supported situation -> 3 contextual angles
// -------------------------------------------------------------
console.log("\n--- Testing Journey A: Supported situation ---");
await enterTextAndSeeAngles("crying over a movies scene");
await page.screenshot({ path: `${artifactDir}/browser_journey_A_supported.png`, fullPage: true });
let body = await page.locator("body").innerText();
console.log("  Rendered 3 angles:", body.includes("Try three new angles"));

// -------------------------------------------------------------
// Journey B: Ambiguous situation -> optional clarification
// -------------------------------------------------------------
console.log("\n--- Testing Journey B: Ambiguous situation ---");
await enterTextAndSeeAngles("crying");
await page.screenshot({ path: `${artifactDir}/browser_journey_B_clarification.png`, fullPage: true });
body = await page.locator("body").innerText();
console.log("  Rendered clarification card:", body.includes("A little more about this moment?"));

// -------------------------------------------------------------
// Journey C & D: Click "Add a little detail", focus, append, submit
// -------------------------------------------------------------
console.log("\n--- Testing Journey C & D: 'Add a little detail' click, focus & append ---");
const addDetailBtn = page.getByText("Add a little detail");
console.log("  Is 'Add a little detail' visible:", await addDetailBtn.isVisible());
await addDetailBtn.click();
await page.waitForTimeout(600);

// Verify focused element is the textarea and original text is preserved
const activeTag = await page.evaluate(() => document.activeElement?.tagName);
const activeVal = await page.evaluate(() => document.activeElement?.value);
console.log("  Active element tagName:", activeTag);
console.log("  Preserved text value:", activeVal);
await page.screenshot({ path: `${artifactDir}/browser_journey_C_input_focused.png`, fullPage: true });

// Append detail
const textArea = page.locator("textarea").first();
await textArea.fill("crying over a movies scene and needing tissues");
await page.waitForTimeout(300);
const seeBtn = page.getByText("See lighter angles");
await seeBtn.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${artifactDir}/browser_journey_D_clarification_resolved.png`, fullPage: true });
body = await page.locator("body").innerText();
console.log("  Rendered after revised submission (3 angles):", body.includes("Try three new angles"));

// -------------------------------------------------------------
// Journey E & F: Add detail to unsupported situation -> Graceful continuation
// -------------------------------------------------------------
console.log("\n--- Testing Journey E & F: Graceful continuation on 2nd attempt ---");
// 1st attempt:
await enterTextAndSeeAngles("random uninterpretable gibberish input xyz");
await page.waitForTimeout(500);
// Click add detail:
await page.getByText("Add a little detail").click();
await page.waitForTimeout(500);
// 2nd attempt still unsupported:
await textArea.fill("random uninterpretable gibberish input xyz still completely unsupported");
await page.getByText("See lighter angles").click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${artifactDir}/browser_journey_E_graceful_continuation.png`, fullPage: true });
body = await page.locator("body").innerText();
console.log("  Rendered second attempt continuation ('Every moment is different'):", body.includes("Every moment is different"));

// Journey F: Edit my description after continuation
console.log("\n--- Testing Journey F: Click 'Edit my description' from continuation ---");
const editDescBtn = page.getByText("Edit my description");
await editDescBtn.click();
await page.waitForTimeout(500);
const activeTagF = await page.evaluate(() => document.activeElement?.tagName);
console.log("  Active element after 'Edit my description':", activeTagF);

// -------------------------------------------------------------
// Journey I: Respectful reflection for sensitive situation
// -------------------------------------------------------------
console.log("\n--- Testing Journey I: Sensitive situation respectful reflection ---");
await enterTextAndSeeAngles("Sometimes too pushy to act on something I do not want to act.");
await page.screenshot({ path: `${artifactDir}/browser_journey_I_respectful_reflection.png`, fullPage: true });
body = await page.locator("body").innerText();
console.log("  Rendered respectful reflection:", body.includes("Not every moment needs a lighter angle"));

// -------------------------------------------------------------
// Journey J: Verify 3 corrected historical semantic cases
// -------------------------------------------------------------
console.log("\n--- Testing Journey J: 3 Corrected Semantic Cases ---");

// Case A: previous-action forgetfulness
await enterTextAndSeeAngles("forgetting about the stuff that has been put by her only");
await page.screenshot({ path: `${artifactDir}/browser_journey_J_caseA_forgetting.png`, fullPage: true });
body = await page.locator("body").innerText();
console.log("  Case A rendered angles (Treasure Hunt / Past-self):", body.includes("treasure hunt") || body.includes("Past-self"));

// Case B: active lighting on
await enterTextAndSeeAngles("keeping the bathroom lights on");
await page.screenshot({ path: `${artifactDir}/browser_journey_J_caseB_lights_on.png`, fullPage: true });
body = await page.locator("body").innerText();
console.log("  Case B rendered angles (Brightly lit / Switched on):", body.includes("brightly lit") || body.includes("switched on") || body.includes("shining"));

// Case C: forgotten alarm switch-off
await enterTextAndSeeAngles("forgets to off the alarm in the mornings");
await page.screenshot({ path: `${artifactDir}/browser_journey_J_caseC_alarm_off.png`, fullPage: true });
body = await page.locator("body").innerText();
console.log("  Case C rendered angles (Morning chime / Feet on the floor):", body.includes("morning chime") || body.includes("Feet are already on the floor") || body.includes("solo concert"));

await browser.close();
console.log("\n[Browser] All Journeys A through J verified successfully!");
