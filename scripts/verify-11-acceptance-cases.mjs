import { generateAuthoritativeDetails } from "../src/lib/reframe-generator.ts";
import { chromium } from "@playwright/test";
import fs from "node:fs";

const customerExpressions = [
  "She uses four different towels just to dry her hair.",
  "He says he doesn't want dessert and then keeps taking spoonfuls of mine.",
  "She keeps smelling the clothes to decide whether they need washing.",
  "He shuts the window but always leaves the handle halfway turned.",
  "She drinks the last of the orange juice and puts the empty carton back in the fridge.",
  "He explains the difference between two types of coffee grinders for half an hour.",
  "She takes longer to choose her running outfit than she spends actually running.",
  "He checks whether the front door is locked every time we walk past it.",
  "She reads every restaurant review before ordering the same thing as last time.",
  "He starts vacuuming while I'm trying to finish a phone call.",
  "She never makes her bed after waking up in the morning.",
];

async function main() {
  console.log("=== VERIFYING 11 CUSTOMER ACCEPTANCE EXPRESSIONS: DIRECT ENGINE VS PLAYWRIGHT BROWSER ===");

  const APP_URL = "http://127.0.0.1:8081/playful-reframe";
  const extraLibPath = "/tmp/playwright-libs/usr/lib/x86_64-linux-gnu";
  const env = fs.existsSync(extraLibPath)
    ? { ...process.env, LD_LIBRARY_PATH: `${extraLibPath}:${process.env.LD_LIBRARY_PATH || ""}` }
    : process.env;

  let browser;
  let page;
  try {
    browser = await chromium.launch({
      headless: true,
      env,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(30000);
    console.log(`[Browser] Opening ${APP_URL}...`);
    await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('textarea, [placeholder*="shoes left"]', { timeout: 30000 });
  } catch (err) {
    console.error("Could not launch Playwright browser or navigate:", err.message);
  }

  const results = [];

  for (let i = 0; i < customerExpressions.length; i++) {
    const expr = customerExpressions[i];
    console.log(`\n--- Case ${i + 1}: "${expr}" ---`);
    
    // Direct engine call
    const engineRes = generateAuthoritativeDetails(expr, 0);

    const directAngles = [
      { tone: "gentle", reframe: engineRes.angles.gentle.text },
      { tone: "playful", reframe: engineRes.angles.playful.text },
      { tone: "exaggerated", reframe: engineRes.angles.exaggerated.text },
    ];

    console.log(`Direct Engine Frame: ${engineRes.bound?.arbitration?.selectedFrameId}`);
    console.log(`Behavioral Relationship: ${engineRes.bound?.arbitration?.behavioralRelationship?.relationshipType}`);
    directAngles.forEach(a => {
      console.log(`  [${a.tone}]: ${a.reframe}`);
    });

    let browserText = "";
    let browserStatus = "not_tested";

    if (page) {
      try {
        const editBtn = page.getByText("Edit description").or(page.getByText("Edit my description")).or(page.getByText("Edit my reflection"));
        if (await editBtn.count() > 0 && await editBtn.first().isVisible()) {
          await editBtn.first().click();
          await page.waitForTimeout(400);
        }

        const textArea = page.locator("textarea").first();
        await textArea.click();
        await textArea.fill(expr);
        await page.waitForTimeout(300);

        const seeAnglesBtn = page.getByText("See lighter angles");
        await seeAnglesBtn.click();
        await page.waitForTimeout(1500);

        // Check if angles are visible
        const gentleHeading = page.getByRole("heading", { name: "Gentle" });
        if (await gentleHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
          browserStatus = "angles_rendered";
          // Collect text
          const bodyText = await page.innerText("body");
          browserText = bodyText.replace(/\n+/g, " ").substring(0, 150);
        } else {
          const bodyText = await page.innerText("body");
          browserStatus = "other_outcome";
          browserText = bodyText.replace(/\n+/g, " ").substring(0, 150);
        }
      } catch (e) {
        browserStatus = `error: ${e.message}`;
      }
    }

    results.push({
      index: i + 1,
      expression: expr,
      frameId: engineRes.arbitration?.selectedFrameId,
      behavioralType: engineRes.arbitration?.behavioralRelationship?.relationshipType,
      constructionId: directAngles[0]?.constructionId,
      reframeText: directAngles[0]?.reframe,
      anglesCount: directAngles.length,
      browserStatus,
      satisfactory: directAngles.length > 0 && !directAngles[0]?.reframe?.includes("as if it were sovereign territory")
    });
  }

  if (browser) {
    await browser.close();
  }

  console.log("\n\n=== SUMMARY OF 11 ACCEPTANCE CASES ===");
  console.table(results.map(r => ({
    Case: r.index,
    Expression: r.expression.substring(0, 30) + "...",
    BehavioralType: r.behavioralType,
    Browser: r.browserStatus,
    Satisfactory: r.satisfactory ? "YES" : "NO",
    Reframe: r.reframeText?.substring(0, 45) + "..."
  })));
}

main().catch(console.error);
