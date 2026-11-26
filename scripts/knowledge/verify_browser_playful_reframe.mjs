/**
 * scripts/knowledge/verify_browser_playful_reframe.mjs
 *
 * Headless Chromium browser verification against the live running Expo Web app.
 * Tests Stage 1 -> Stage 2 -> Regeneration -> Stage 1 invalidation -> Clarification -> Boundary protection
 * and measures real browser render latency + verifies zero external AI calls.
 */

import { chromium } from '@playwright/test';
import fs from 'node:fs';

const APP_URL = 'http://127.0.0.1:8089/playful-reframe';
const extraLibPath = '/tmp/playwright-libs/usr/lib/x86_64-linux-gnu';
const env = fs.existsSync(extraLibPath)
  ? { ...process.env, LD_LIBRARY_PATH: `${extraLibPath}:${process.env.LD_LIBRARY_PATH || ''}` }
  : process.env;

async function waitForServer(url, maxWaitMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const resp = await fetch(url);
      if (resp.status === 200) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

const ok = await waitForServer(APP_URL);
if (!ok) {
  console.error('Expo Web server did not respond on 8089 in time.');
  process.exit(1);
}

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
  if (u.includes('generate-lighter-angles') || u.includes('openai.com')) {
    aiRequests.push(u);
  }
});

console.log(`[browser] Navigating to ${APP_URL}...`);
const navStart = performance.now();
await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('textarea, [placeholder*="shoes left"]', { timeout: 30000 });
await page.waitForTimeout(1000);
const bundleLoadMs = Math.round(performance.now() - navStart);
console.log(`[browser] Loaded URL: ${page.url()} in ${bundleLoadMs} ms.`);

const textArea = page.locator('textarea').first();
await textArea.click();
await textArea.fill('brewing espresso with barely any oat milk');
await page.waitForTimeout(300);
const preClickText = await page.evaluate(() => document.body.innerText);
if (!preClickText.includes('See lighter angles')) {
  console.log('[browser debug] Text after fill:', preClickText.slice(0, 500));
}
const t0 = performance.now();
await page.getByText('See lighter angles').click();
await page.waitForSelector('text=espresso', { timeout: 5000 });
const genLatency1 = (performance.now() - t0).toFixed(2);
const body1 = await page.evaluate(() => document.body.innerText);
console.log(`[browser] Test 1 (espresso + oat milk) generated in ${genLatency1} ms | contains espresso: ${body1.includes('espresso')} | contains oat milk: ${body1.includes('oat milk')}`);

// 2. Test regeneration
const tReg0 = performance.now();
await page.getByText('Try three new angles').click();
await page.waitForTimeout(150);
const genLatencyRegen = (performance.now() - tReg0).toFixed(2);
const bodyRegen = await page.evaluate(() => document.body.innerText);
console.log(`[browser] Test 2 (Regeneration) completed in ${genLatencyRegen} ms | changed from seed 0: ${bodyRegen !== body1}`);

// 3. Test OOK gibberish -> Clarification
await textArea.fill('blargle florp');
await page.waitForTimeout(100);
const bodyStaleCheck = await page.evaluate(() => document.body.innerText);
const stage1ContinueVisible = bodyStaleCheck.includes('See lighter angles');
const tClar0 = performance.now();
await page.getByText('See lighter angles').click();
await page.waitForSelector('text=A little more context?', { timeout: 5000 });
const clarLatency = (performance.now() - tClar0).toFixed(2);
console.log(`[browser] Test 3 (Gibberish OOK) stale invalidation: ${stage1ContinueVisible} | routed to clarification in ${clarLatency} ms`);

// 4. Test Boundary input -> Respectful Reflection
await textArea.fill("Insists on doing it their way and won't accept my no");
await page.waitForTimeout(100);
const tBound0 = performance.now();
await page.getByText('See lighter angles').click();
await page.waitForSelector('text=Not every moment needs a lighter angle', { timeout: 5000 });
const boundLatency = (performance.now() - tBound0).toFixed(2);
const bodyBound = await page.evaluate(() => document.body.innerText);
const challengeWithheld = !bodyBound.includes('Shape a tiny challenge');
console.log(`[browser] Test 4 (Indirect boundary) routed to respectful reflection in ${boundLatency} ms | challenge withheld: ${challengeWithheld}`);

console.log(`[browser] Summary: pageErrors=${pageErrors.length}, externalAiRequests=${aiRequests.length}`);
if (pageErrors.length > 0) console.error('Page errors:', pageErrors);

await browser.close();

if (pageErrors.length > 0 || aiRequests.length > 0 || !body1.includes('espresso') || !stage1ContinueVisible || !challengeWithheld) {
  process.exit(1);
}
console.log('✔ LIVE EXPO WEB BROWSER VERIFICATION PASSED!');
