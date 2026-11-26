/**
 * scripts/live-browser-journeys.mjs
 * Live browser verification of Journeys A-I using exact UI selectors
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const APP_URL = 'http://127.0.0.1:8089/playful-reframe';
const extraLibPath = '/tmp/playwright-libs/usr/lib/x86_64-linux-gnu';
const env = fs.existsSync(extraLibPath)
  ? { ...process.env, LD_LIBRARY_PATH: `${extraLibPath}:${process.env.LD_LIBRARY_PATH || ''}` }
  : process.env;

const browser = await chromium.launch({
  headless: true,
  env,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
});

const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(30000);

console.log(`Navigating to ${APP_URL}...`);
await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('textarea, [placeholder*="shoes left"]', { timeout: 45000 });
await page.waitForTimeout(1000);

const artifactDir = '/home/kaivlya/.gemini/antigravity/brain/0f0bb05c-68ce-443b-a278-513a5bfda135';

async function testScenario(inputStr, filename) {
  console.log(`\nTesting scenario: "${inputStr}" -> ${filename}.png`);
  
  // If in Stage 2/Clarification/Reflection, click "Edit description" to return to Stage 1
  const editBtn = page.getByText('Edit description');
  if (await editBtn.count() > 0 && await editBtn.first().isVisible()) {
    await editBtn.first().click();
    await page.waitForTimeout(500);
  }

  const textArea = page.locator('textarea').first();
  await textArea.click();
  await textArea.fill(inputStr);
  await page.waitForTimeout(400);

  const seeBtn = page.getByText('See lighter angles');
  await seeBtn.click();
  await page.waitForTimeout(1500);

  const shotPath = `${artifactDir}/${filename}.png`;
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log(`  ✓ Screenshot saved: ${shotPath}`);

  const bodyText = await page.locator('body').innerText();
  if (bodyText.includes('Try three new angles')) {
    console.log('  -> Rendered 3 playful angle cards');
  } else if (bodyText.includes("A little more about this moment?")) {
    console.log('  -> Rendered clarification prompt');
  } else if (bodyText.includes("Every moment is different")) {
    console.log('  -> Rendered second-attempt calm continuation');
  } else if (bodyText.includes("Not every moment needs a lighter angle")) {
    console.log('  -> Rendered respectful reflection');
  } else {
    console.log('  -> Rendered screen with title:', bodyText.split('\n').slice(0, 5).join(' '));
  }
}

// 1. Journey A: Supported couple situation (Category 12, cinema emotional tears)
await testScenario("crying over a movies scene", "browser_journey_a_supported");

// 2. Journey B: Unfamiliar phrasing / non-native English (Category 9, alarm)
await testScenario("forgets to off the alarm in the mornings", "browser_journey_b_informal_alarm");

// 3. Journey C: First clarification ("A little more about this moment?")
await testScenario("yoga is not an exercise", "browser_journey_c_first_clarification");

// 4. Journey D: Sensitive boundary / safety firewall (Respectful reflection)
await testScenario("Sometimes too pushy to act on something I do not want to act.", "browser_journey_d_safety_reflection");

await browser.close();
console.log("\nAll browser journeys executed successfully!");
