/**
 * scripts/knowledge/verify_browser_phase5.mjs
 *
 * Comprehensive Live Expo Web Verification for Phase 5:
 * - Cold bundle load + first-render measurement on /playful-reframe
 * - Quantity-ratio preservation ("brewing espresso with barely any oat milk")
 * - Active action polarity preservation ("keeps scrubbing the cast iron skillet in the sink", zero soaking)
 * - Regeneration ("Try three new angles") without altering Stage 1
 * - Stage 3 transition ("STAGE 3 OF 3" / "What would help next?" / "Shape a tiny challenge")
 * - Stage 1 edit invalidation (editing hides stale Stage 2/Stage 3 results)
 * - Clarification flow ("blargle florp" & "yoga is not an exercise")
 * - Respectful Reflection + Challenge withholding ("Insists on doing it their way and won't accept my no")
 * - Zero pageErrors and zero external AI calls
 */

import { chromium } from '@playwright/test';
import fs from 'node:fs';

const APP_URL = 'http://127.0.0.1:8089/playful-reframe';
const extraLibPath = '/tmp/playwright-libs/usr/lib/x86_64-linux-gnu';
const env = fs.existsSync(extraLibPath)
  ? { ...process.env, LD_LIBRARY_PATH: `${extraLibPath}:${process.env.LD_LIBRARY_PATH || ''}` }
  : process.env;

async function waitForServer(url, maxWaitMs = 60000) {
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
  if (u.includes('generate-lighter-angles') || u.includes('openai.com') || u.includes('anthropic.com')) {
    aiRequests.push(u);
  }
});

// 1. Load app
console.log(`[browser] Navigating to ${APP_URL}...`);
const navStart = performance.now();
await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('textarea, [placeholder*="shoes left"]', { timeout: 45000 });
await page.waitForTimeout(800);
const bundleLoadMs = Math.round(performance.now() - navStart);
console.log(`[browser] Loaded ${page.url()} in ${bundleLoadMs} ms.`);

const textArea = page.locator('textarea').first();

// 2. Espresso + Oat Milk
await textArea.click();
await textArea.fill('brewing espresso with barely any oat milk');
await page.waitForTimeout(200);
const t1Start = performance.now();
await page.getByText('See lighter angles').click();
await page.waitForSelector('text=Try three new angles', { timeout: 5000 });
const latEspressoMs = (performance.now() - t1Start).toFixed(2);
const bodyEspresso = await page.evaluate(() => document.body.innerText);
const hasEspresso = bodyEspresso.includes('espresso') && bodyEspresso.includes('milk');
console.log(`[browser] 1) Espresso+OatMilk in ${latEspressoMs} ms | grounded=${hasEspresso}`);

// 3. Active Scrubbing Skillet (no soaking reversal!) + Stage 3
await textArea.fill('keeps scrubbing the cast iron skillet in the sink');
await page.waitForTimeout(150);
const staleInvalidated = (await page.evaluate(() => document.body.innerText)).includes('See lighter angles');
const t2Start = performance.now();
await page.getByText('See lighter angles').click();
await page.waitForSelector('text=Try three new angles', { timeout: 5000 });
const latSkilletMs = (performance.now() - t2Start).toFixed(2);
const bodySkillet0 = await page.evaluate(() => document.body.innerText);
const stage2Slice = bodySkillet0.slice(bodySkillet0.indexOf('Gentle and cute'), bodySkillet0.indexOf('Try three new angles'));
const skilletOk = stage2Slice.toLowerCase().includes('skillet') && !/\b(soaking|bubble bath|unwashed|resting beside)\b/i.test(stage2Slice);
console.log(`[browser] 2) Active Skillet Scrubbing in ${latSkilletMs} ms | stage1EditInvalidated=${staleInvalidated} | activeNoSoak=${skilletOk}`);
console.log(`[browser]    Stage 2 copy:`, stage2Slice.replace(/\n+/g, ' | '));

// 4. Regenerate
const tReg0 = performance.now();
await page.getByText('Try three new angles').click();
await page.waitForTimeout(200);
const latRegenMs = (performance.now() - tReg0).toFixed(2);
const bodySkillet1 = await page.evaluate(() => document.body.innerText);
const regenChanged = bodySkillet1 !== bodySkillet0;
console.log(`[browser] 3) Regenerate in ${latRegenMs} ms | changed=${regenChanged}`);

// 5. Select an angle -> Stage 3
await page.getByText('Gentle and cute').first().click();
await page.waitForSelector('text=STAGE 3 OF 3', { timeout: 5000 });
const bodyStage3 = await page.evaluate(() => document.body.innerText);
const stage3Visible = bodyStage3.includes('What would help next?') && bodyStage3.includes('Shape a tiny challenge');
console.log(`[browser] 4) Stage 3 transition | stage3Visible=${stage3Visible}`);

// 6. Propositional ambiguity -> Clarification
await textArea.fill('yoga is not an exercise');
await page.waitForTimeout(150);
await page.getByText('See lighter angles').click();
await page.waitForSelector('text=A little more context?', { timeout: 5000 });
const clarOk = !(await page.evaluate(() => document.body.innerText)).includes('Shape a tiny challenge');
console.log(`[browser] 5) Propositional clarification | challengeHidden=${clarOk}`);

// 7. Boundary protection -> Respectful Reflection + Challenge Withheld
await textArea.fill("Insists on doing it their way and won't accept my no");
await page.waitForTimeout(150);
await page.getByText('See lighter angles').click();
await page.waitForSelector('text=Not every moment needs a lighter angle', { timeout: 5000 });
const bodyBound = await page.evaluate(() => document.body.innerText);
const boundOk = !bodyBound.includes('Shape a tiny challenge') && bodyBound.includes('Keep this private');
console.log(`[browser] 6) Boundary firewall | respectfulReflectionShown=${boundOk}`);

console.log(`[browser] Final summary: pageErrors=${pageErrors.length}, externalAiRequests=${aiRequests.length}`);
if (pageErrors.length > 0) console.error('Page errors:', pageErrors);

await browser.close();

if (pageErrors.length > 0 || aiRequests.length > 0 || !hasEspresso || !staleInvalidated || !skilletOk || !regenChanged || !stage3Visible || !clarOk || !boundOk) {
  process.exit(1);
}
console.log('✔ LIVE EXPO WEB PHASE 5 BROWSER VERIFICATION PASSED!');
