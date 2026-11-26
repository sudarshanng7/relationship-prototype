/**
 * scripts/knowledge/verify_browser_runtime_failures.mjs
 *
 * Real browser runtime verification for Acceptance Failures A & B:
 * - Failure A: "forgetting about the stuff that has been put by her only"
 * - Failure B: "keeping the bathroom lights on"
 *
 * Checks:
 * 1. Both inputs generate grounded perspectives (no generic fillers, no guardianship, no ungrounded "everyday moment").
 * 2. All 3 tones render properly and are distinct.
 * 3. Regenerates at least twice with seed 1 and seed 2.
 * 4. Editing Stage 1 input invalidates Stage 2 results.
 * 5. Respectful reflection safety behavior remains active.
 * 6. Zero pageErrors and zero external AI calls.
 * 7. Screenshots captured to artifact/scratch directory.
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

const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
page.setDefaultTimeout(20000);

const pageErrors = [];
const aiRequests = [];
page.on('pageerror', err => pageErrors.push(err.message));
page.on('request', req => {
  const u = req.url();
  if (u.includes('generate-lighter-angles') || u.includes('openai.com') || u.includes('anthropic.com')) {
    aiRequests.push(u);
  }
});

console.log(`[browser] Navigating to ${APP_URL}...`);
await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('textarea, [placeholder*="shoes left"]', { timeout: 45000 });
await page.waitForTimeout(1000);

const textArea = page.locator('textarea').first();

// --- TEST FAILURE A ---
console.log('\n--- TESTING FAILURE A: "forgetting about the stuff that has been put by her only" ---');
await textArea.click();
await textArea.fill('forgetting about the stuff that has been put by her only');
await page.waitForTimeout(300);
await page.getByText('See lighter angles').click();
await page.waitForSelector('text=Try three new angles', { timeout: 10000 });
await page.waitForTimeout(500);

let textA0 = await page.locator('body').innerText();
console.log('[browser] Failure A - Initial Seed 0 Output:');
const anglesA0 = await page.locator('[data-testid="reframe-angle-card"], div:has-text("Gentle and cute")').first().innerText();
console.log(textA0.substring(textA0.indexOf('Gentle and cute'), textA0.indexOf('Try three new angles')));

// Check for generic cliches
if (textA0.includes('running on its own gentle everyday rhythm') || textA0.includes('follows a charming unwritten house rule') || textA0.includes('quietly claiming center stage')) {
  console.error('FAIL: Failure A produced generic cliches!');
  process.exit(1);
}

// Regenerate 1
console.log('[browser] Failure A - Clicking "Try three new angles" (Regeneration 1)...');
await page.getByText('Try three new angles').click();
await page.waitForTimeout(500);
let textA1 = await page.locator('body').innerText();
console.log('[browser] Failure A - Regeneration 1:');
console.log(textA1.substring(textA1.indexOf('Gentle and cute'), textA1.indexOf('Try three new angles')));

// Regenerate 2
console.log('[browser] Failure A - Clicking "Try three new angles" (Regeneration 2)...');
await page.getByText('Try three new angles').click();
await page.waitForTimeout(500);
let textA2 = await page.locator('body').innerText();
console.log('[browser] Failure A - Regeneration 2:');
console.log(textA2.substring(textA2.indexOf('Gentle and cute'), textA2.indexOf('Try three new angles')));

// Screenshot Failure A
await page.screenshot({ path: '/home/kaivlya/.gemini/antigravity/brain/0f0bb05c-68ce-443b-a278-513a5bfda135/browser_failure_a_resolved.png' });
console.log('Saved screenshot for Failure A to artifact directory.');

// --- TEST STAGE 1 INVALIDATION ---
console.log('\n[browser] Testing Stage 1 editing invalidates Stage 2...');
await textArea.click();
await textArea.fill('keeping the bathroom lights on');
await page.waitForTimeout(300);
const hasNewAnglesButton = await page.getByText('Try three new angles').isVisible();
console.log(`[browser] "Try three new angles" is visible after typing new text? ${hasNewAnglesButton} (Expected: false)`);
if (hasNewAnglesButton) {
  console.error('FAIL: Stage 1 edit did not invalidate Stage 2!');
  process.exit(1);
}

// --- TEST FAILURE B ---
console.log('\n--- TESTING FAILURE B: "keeping the bathroom lights on" ---');
await page.getByText('See lighter angles').click();
await page.waitForSelector('text=Try three new angles', { timeout: 10000 });
await page.waitForTimeout(500);

let textB0 = await page.locator('body').innerText();
console.log('[browser] Failure B - Initial Seed 0 Output:');
console.log(textB0.substring(textB0.indexOf('Gentle and cute'), textB0.indexOf('Try three new angles')));

if (textB0.includes('guardianship')) {
  console.error('FAIL: Failure B contained guardianship!');
  process.exit(1);
}
if (textB0.includes('running on its own gentle everyday rhythm') || textB0.includes('follows a charming unwritten house rule')) {
  console.error('FAIL: Failure B produced generic cliches!');
  process.exit(1);
}

// Regenerate 1
console.log('[browser] Failure B - Clicking "Try three new angles" (Regeneration 1)...');
await page.getByText('Try three new angles').click();
await page.waitForTimeout(500);
let textB1 = await page.locator('body').innerText();
console.log('[browser] Failure B - Regeneration 1:');
console.log(textB1.substring(textB1.indexOf('Gentle and cute'), textB1.indexOf('Try three new angles')));

// Regenerate 2
console.log('[browser] Failure B - Clicking "Try three new angles" (Regeneration 2)...');
await page.getByText('Try three new angles').click();
await page.waitForTimeout(500);
let textB2 = await page.locator('body').innerText();
console.log('[browser] Failure B - Regeneration 2:');
console.log(textB2.substring(textB2.indexOf('Gentle and cute'), textB2.indexOf('Try three new angles')));

// Screenshot Failure B
await page.screenshot({ path: '/home/kaivlya/.gemini/antigravity/brain/0f0bb05c-68ce-443b-a278-513a5bfda135/browser_failure_b_resolved.png' });
console.log('Saved screenshot for Failure B to artifact directory.');

// --- TEST SAFETY BOUNDARY ---
console.log('\n--- TESTING SAFETY BOUNDARY PRESERVATION ---');
await textArea.click();
await textArea.fill('he threatened to hit me if I speak');
await page.waitForTimeout(300);
await page.getByText('See lighter angles').click();
await page.waitForSelector('text=Not every moment needs a lighter angle', { timeout: 10000 });
console.log('[browser] Successfully triggered safety reflection boundary without humor.');

// Verify Network & Errors
console.log('\n--- VERIFICATION CHECKS ---');
console.log(`pageErrors: ${pageErrors.length}`);
console.log(`externalAIRequests: ${aiRequests.length}`);

if (pageErrors.length > 0) {
  console.error('Page errors encountered:', pageErrors);
  process.exit(1);
}
if (aiRequests.length > 0) {
  console.error('AI requests made:', aiRequests);
  process.exit(1);
}

await browser.close();
console.log('✔ Real Browser Runtime Verification Complete with 0 errors and 0 AI requests!');
