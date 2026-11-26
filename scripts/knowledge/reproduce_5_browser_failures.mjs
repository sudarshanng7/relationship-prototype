/**
 * scripts/knowledge/reproduce_5_browser_failures.mjs
 *
 * Read-only script to reproduce and capture the exact live browser state
 * for all 5 human acceptance failures on http://127.0.0.1:8089/playful-reframe.
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
page.setDefaultTimeout(25000);

const testInputs = [
  { id: 'Failure 1', text: 'forgetting about the stuff that has been put by her only' },
  { id: 'Failure 2', text: 'keeping the bathroom lights on' },
  { id: 'Failure 3', text: 'making fun of he serious situation' },
  { id: 'Failure 4', text: 'forgets to off the alarm in the mornings' },
  { id: 'Failure 5', text: 'watches boring videos all the time' }
];

console.log(`[browser] Opening ${APP_URL}...`);
await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('textarea, [placeholder*="shoes left"]', { timeout: 45000 });
await page.waitForTimeout(1000);

const textArea = page.locator('textarea').first();

for (const item of testInputs) {
  console.log(`\n======================================================`);
  console.log(`[browser] Testing ${item.id}: "${item.text}"`);
  console.log(`======================================================`);

  await textArea.click();
  await textArea.fill(item.text);
  await page.waitForTimeout(300);

  const seeBtn = page.getByText('See lighter angles');
  await seeBtn.click();
  await page.waitForTimeout(1200);

  const bodyText = await page.locator('body').innerText();

  // Find cards or clarification container
  if (bodyText.includes('Try three new angles')) {
    const cardSnippet = bodyText.substring(
      bodyText.indexOf('STAGE 2 OF 3'),
      bodyText.indexOf('Try three new angles')
    );
    console.log('[browser] Rendered Angles Section:\n' + cardSnippet.trim());
  } else if (bodyText.includes('Not every moment needs a lighter angle')) {
    console.log('[browser] Rendered: Respectful Reflection Screen');
  } else {
    // Check if clarification or fallback
    console.log('[browser] Rendered Body:\n' + bodyText.substring(0, 500));
  }

  // Screenshot each failure state
  const shotPath = `/home/kaivlya/.gemini/antigravity/brain/0f0bb05c-68ce-443b-a278-513a5bfda135/browser_${item.id.replace(/\s+/g, '_').toLowerCase()}.png`;
  await page.screenshot({ path: shotPath });
  console.log(`[browser] Saved screenshot to ${shotPath}`);
}

await browser.close();
console.log('\n[browser] Reproduction run complete.');
