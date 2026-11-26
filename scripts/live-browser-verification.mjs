/**
 * Playwright Live Browser Automation for Journeys A-I
 */
import { chromium } from "playwright";
import { writeFileSync } from "fs";

async function runLiveVerification() {
  console.log("Starting Playwright Chromium browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 420, height: 860 } });
  const page = await context.newPage();

  const baseUrl = "http://localhost:8089/playful-reframe";
  console.log(`Navigating to ${baseUrl}...`);
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Helper to enter text and generate
  async function testInput(text, screenshotName) {
    console.log(`Testing input: "${text}"`);
    // Find text input
    const input = page.locator('input[placeholder*="Describe a playful or tricky moment"], textarea, input[type="text"]').first();
    await input.click();
    await input.fill(text);
    await page.waitForTimeout(500);

    // Click "Continue to lighter angles" or submit button
    const btn = page.locator('text="Continue to lighter angles"').or(page.locator('button:has-text("Continue")')).first();
    await btn.click();
    await page.waitForTimeout(2000);

    const shotPath = `/home/kaivlya/.gemini/antigravity/brain/0f0bb05c-68ce-443b-a278-513a5bfda135/${screenshotName}.png`;
    await page.screenshot({ path: shotPath, fullPage: true });
    console.log(`Saved screenshot to ${shotPath}`);
  }

  // Journey A: Supported input
  await testInput("crying over a movies scene", "browser_journey_a_supported");

  // Reset or re-enter
  const editBtn = page.locator('text="Edit description"').or(page.locator('button:has-text("Edit")')).first();
  if (await editBtn.isVisible()) {
    await editBtn.click();
    await page.waitForTimeout(500);
  }

  // Journey B: Unfamiliar phrasing / informal
  await testInput("forgets to off the alarm in the mornings", "browser_journey_b_informal");

  if (await editBtn.isVisible()) {
    await editBtn.click();
    await page.waitForTimeout(500);
  }

  // Journey C & D: Clarification needed
  await testInput("yoga is not an exercise", "browser_journey_c_clarification");

  // Journey E: Respectful reflection / safety
  if (await editBtn.isVisible()) {
    await editBtn.click();
    await page.waitForTimeout(500);
  }
  await testInput("Sometimes too pushy to act on something I do not want to act.", "browser_journey_e_safety_reflection");

  await browser.close();
  console.log("Playwright browser verification completed successfully.");
}

runLiveVerification().catch(err => {
  console.error("Browser verification error:", err);
  process.exit(1);
});
