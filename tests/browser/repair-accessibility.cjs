// Opt-in real Chromium checks. No credentials, auth, backend reads, fixtures or
// mutations. Mount the production presentation components from the running Expo
// bundle in an isolated DOM root; this is not authenticated Event Detail or RLS evidence.
// Required: ROS_PLAYWRIGHT_PATH, ROS_CHROMIUM_PATH; optional ROS_BROWSER_URL.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "../..");
const url = new URL(process.env.ROS_BROWSER_URL || "http://localhost:8082");
assert.ok(["localhost", "127.0.0.1"].includes(url.hostname) && url.protocol === "http:");
assert.ok(process.env.ROS_PLAYWRIGHT_PATH && process.env.ROS_CHROMIUM_PATH,
  "Point to existing Playwright and Chromium installations; this script never installs them.");
const { chromium } = require(process.env.ROS_PLAYWRIGHT_PATH);
const evidence = fs.mkdtempSync(path.join(os.tmpdir(), "ros-stage6c2-a11y-"));
fs.chmodSync(evidence, 0o700);
const report = { method: "Production presentation components in real Chromium; all backend requests blocked", cases: [], blockedRequests: [], pageErrors: [], screenshots: [] };

// Use the real screen's option definitions without executing its functional code.
const source = ts.createSourceFile("EventRepairSection.tsx", fs.readFileSync(path.join(root, "src/components/EventRepairSection.tsx"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function options(name) {
  let result;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) {
      assert.ok(ts.isArrayLiteralExpression(node.initializer));
      result = node.initializer.elements.map((item) => Object.fromEntries(item.properties.map((p) => {
        assert.ok(ts.isPropertyAssignment(p));
        assert.ok(ts.isStringLiteral(p.initializer) || p.initializer.kind === ts.SyntaxKind.NullKeyword);
        return [p.name.getText(source), p.initializer.kind === ts.SyntaxKind.NullKeyword ? null : p.initializer.text];
      })));
    }
    ts.forEachChild(node, visit);
  }
  visit(source); assert.ok(result?.length); return result;
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.ROS_CHROMIUM_PATH, headless: true });
    report.browser = browser.version();
    const context = await browser.newContext({ viewport: { width: 1000, height: 1000 } });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    await context.route("**/*", (route) => {
      const request = route.request(), target = new URL(request.url());
      if (target.origin === url.origin && ["GET", "HEAD"].includes(request.method())) return route.continue();
      report.blockedRequests.push({ method: request.method(), kind: target.port === "54321" ? "backend" : "external" });
      return route.abort("blockedbyclient");
    });
    await page.goto(new URL("/event/00000000-0000-0000-0000-000000000000", url).href, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => typeof __r !== "undefined" && __r.getModules);
    await page.waitForFunction(() => [...__r.getModules()].some(([, m]) => /src\/components\/RepairRadioGroup\.web\.tsx$/.test(m.verboseName || "")), { timeout: 30000 });
    await page.evaluate(({ statuses, methods }) => {
      const find = (pattern) => {
        const entry = [...__r.getModules()].find(([, m]) => pattern.test(m.verboseName || ""));
        if (!entry) throw new Error("Production module missing: " + pattern);
        return __r(entry[0]);
      };
      const module = (pattern) => { const exp = find(pattern); return exp.default || exp; };
      const React = module(/node_modules\/react\/index\.js$/);
      const { createRoot } = find(/node_modules\/react-dom\/client\.js$/);
      const { RepairRadioGroup } = find(/src\/components\/RepairRadioGroup\.web\.tsx$/);
      const { CouplyChoiceCard } = find(/src\/components\/CouplyUI\.tsx$/);
      const { tokens } = find(/src\/components\/couply-tokens\.ts$/);
      const View = module(/react-native-web\/dist\/exports\/View\/index\.js$/);
      const el = React.createElement;
      window.radioProbe = { changes: [], choiceClicks: 0 };
      const common = {
        style: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.sm },
        optionStyle: { minHeight: tokens.layout.minTouchTarget, maxWidth: "100%", flexShrink: 1, borderRadius: tokens.radii.small, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surface, paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, alignItems: "center", justifyContent: "center" },
        selectedOptionStyle: { backgroundColor: tokens.colors.plum, borderColor: tokens.colors.plum },
        disabledOptionStyle: { opacity: 0.55 },
        textStyle: { color: tokens.colors.plum, fontSize: tokens.typeScale.bodyLarge, fontWeight: "600", textAlign: "center" },
        selectedTextStyle: { color: tokens.colors.surface },
      };
      function Probe() {
        const [status, setStatus] = React.useState(null), [method, setMethod] = React.useState(null), [disabled, setDisabled] = React.useState(false);
        return el(View, { style: { padding: 20, gap: 20, maxWidth: 520, width: "100%", backgroundColor: tokens.colors.pageBackground } },
          el("button", null, "Before repair choices"),
          el(RepairRadioGroup, { ...common, label: "How does this feel now?", options: statuses, value: status, disabled,
            onChange: (next) => { window.radioProbe.changes.push(["status", next]); setStatus(next); if (next === "open") setMethod(null); } }),
          status !== null && status !== "open" ? el(RepairRadioGroup, { ...common, label: "What helped? (optional)", options: methods, value: method, disabled,
            onChange: (next) => { window.radioProbe.changes.push(["method", next]); setMethod(next); } }) : null,
          el("button", null, "After repair choices"),
          el("button", { onClick: () => setDisabled(!disabled) }, disabled ? "Enable repair choices" : "Disable repair choices"),
          el("button", { onClick: () => { setStatus(null); setMethod(null); setDisabled(false); window.radioProbe.changes = []; } }, "Reset choices"),
          ...["radio", "checkbox"].flatMap((role) => [false, true].map((selected) => el(CouplyChoiceCard, {
            key: role + selected, title: `Choice ${role} ${selected}`, accessibilityRole: role, selected,
            onPress: () => { window.radioProbe.choiceClicks++; },
          }))),
          el(CouplyChoiceCard, { title: "Plain choice button", selected: true }));
      }
      // Hide the signed-out application; only this component probe is exercised.
      [...document.body.children].filter((e) => !["SCRIPT", "STYLE"].includes(e.tagName)).forEach((e) => { e.style.display = "none"; });
      const host = document.createElement("div"); host.id = "repair-accessibility-probe"; document.body.appendChild(host);
      createRoot(host).render(el(Probe));
    }, { statuses: options("STATUSES"), methods: options("METHODS") });
    const status = page.getByRole("radiogroup", { name: "How does this feel now?", exact: true });
    const method = page.getByRole("radiogroup", { name: "What helped? (optional)", exact: true });
    const before = page.getByRole("button", { name: "Before repair choices", exact: true });
    const after = page.getByRole("button", { name: "After repair choices", exact: true });
    await status.waitFor();
    const screenshot = async (name) => { await page.screenshot({ path: path.join(evidence, name), fullPage: true }); report.screenshots.push(name); };
    const check = async (group, name) => {
      const input = group.getByRole("radio", { name, exact: true });
      await page.waitForFunction((e) => e.checked && e.getAttribute("aria-checked") === "true", await input.elementHandle());
      assert.equal(await group.getByRole("radio").evaluateAll((nodes) => nodes.filter((e) => e.checked).length), 1);
      assert.ok(await group.getByRole("radio").evaluateAll((nodes) => nodes.every((e) => e.getAttribute("aria-checked") === String(e.checked))));
    };
    const focus = async (name) => assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), name);
    const reset = async () => { await page.getByRole("button", { name: "Reset choices", exact: true }).click(); };
    async function test(name, fn) {
      try { const details = await fn(); report.cases.push({ name, status: "PASS", ...details }); }
      catch (e) { report.cases.push({ name, status: "FAIL", message: e.message.slice(0, 1200) }); await screenshot("failure-" + report.cases.length + ".png"); }
    }
    await test("initially unselected group has explicit false and one Tab stop", async () => {
      await reset();
      assert.ok(await status.getByRole("radio").evaluateAll((nodes) => nodes.every((e) => !e.checked && e.getAttribute("aria-checked") === "false")));
      assert.equal(await status.getByRole("radio").evaluateAll((nodes) => nodes.filter((e) => e.tabIndex === 0).length), 1);
      await before.focus(); await page.keyboard.press("Tab"); await focus("Still unresolved");
      await page.keyboard.press("Shift+Tab"); assert.ok(await before.evaluate((e) => e === document.activeElement));
      await page.keyboard.press("Tab"); await focus("Still unresolved");
      await page.keyboard.press("Tab"); assert.ok(await after.evaluate((e) => e === document.activeElement));
      assert.deepEqual(await page.evaluate(() => window.radioProbe.changes), []);
    });
    await test("Space selects once; every status has matching checked state", async () => {
      await reset(); await before.focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Space"); await check(status, "Still unresolved");
      assert.equal(await page.evaluate(() => window.radioProbe.changes.length), 1);
      for (const item of options("STATUSES")) { await status.getByRole("radio", { name: item.label, exact: true }).click(); await check(status, item.label); }
    });
    await test("all four arrows select, move focus and wrap", async () => {
      await reset(); await status.getByRole("radio", { name: "Still unresolved", exact: true }).click();
      for (const [key, name] of [["ArrowRight", "A little better"], ["ArrowDown", "I feel reconnected"], ["ArrowRight", "Still unresolved"], ["ArrowLeft", "I feel reconnected"], ["ArrowUp", "A little better"]]) {
        await page.keyboard.press(key); await check(status, name); await focus(name);
      }
    });
    await test("all optional methods, null choice and method wrapping", async () => {
      await status.getByRole("radio", { name: "I feel reconnected", exact: true }).click();
      await check(method, "Not sure / none");
      const space = method.getByRole("radio", { name: "Space", exact: true });
      await space.focus(); await page.keyboard.press("Space"); await check(method, "Space");
      for (const item of options("METHODS")) { await method.getByRole("radio", { name: item.label, exact: true }).click(); await check(method, item.label); }
      await page.keyboard.press("ArrowRight"); await check(method, "Not sure / none"); await focus("Not sure / none");
      for (const item of options("METHODS").slice(1)) {
        await page.keyboard.press("ArrowRight"); await check(method, item.label); await focus(item.label);
      }
      await page.keyboard.press("ArrowRight"); await check(method, "Not sure / none");
      await page.keyboard.press("ArrowLeft"); await check(method, "Other"); await focus("Other");
      await page.keyboard.press("ArrowUp"); await check(method, "Time"); await focus("Time");
      await page.keyboard.press("ArrowDown"); await check(method, "Other"); await focus("Other");
      await status.getByRole("radio", { name: "Still unresolved", exact: true }).click(); assert.equal(await method.count(), 0);
      await status.getByRole("radio", { name: "I feel reconnected", exact: true }).click(); await check(method, "Not sure / none");
    });
    await test("Tab and Shift+Tab enter and leave both named groups", async () => {
      await method.getByRole("radio", { name: "Talking", exact: true }).click();
      assert.notEqual(await status.getByRole("radio").first().getAttribute("name"), await method.getByRole("radio").first().getAttribute("name"));
      assert.ok(await status.getByRole("radio").evaluateAll((nodes) => nodes.every((e) => !e.closest("button,[role=button],a"))));
      await before.focus(); await page.keyboard.press("Tab"); await focus("I feel reconnected");
      await page.keyboard.press("Tab"); await focus("Talking");
      await page.keyboard.press("Tab"); assert.ok(await after.evaluate((e) => e === document.activeElement));
      await page.keyboard.press("Shift+Tab"); await focus("Talking");
      await page.keyboard.press("Shift+Tab"); await focus("I feel reconnected");
      await page.keyboard.press("Shift+Tab"); assert.ok(await before.evaluate((e) => e === document.activeElement));
    });
    await test("disabled groups cannot activate and are skipped by Tab", async () => {
      const count = await page.evaluate(() => window.radioProbe.changes.length);
      await page.getByRole("button", { name: "Disable repair choices", exact: true }).click();
      assert.ok(await status.getByRole("radio").evaluateAll((nodes) => nodes.every((e) => e.disabled && e.tabIndex === -1)));
      assert.ok(await method.getByRole("radio").evaluateAll((nodes) => nodes.every((e) => e.disabled && e.tabIndex === -1)));
      await status.getByRole("radio", { name: "A little better", exact: true }).click({ force: true });
      await before.focus(); await page.keyboard.press("Tab"); assert.ok(await after.evaluate((e) => e === document.activeElement));
      assert.equal(await page.evaluate(() => window.radioProbe.changes.length), count);
      await page.getByRole("button", { name: "Enable repair choices", exact: true }).click();
    });
    await test("Chromium accessibility tree exposes the actual checked choices", async () => {
      const cdp = await context.newCDPSession(page), tree = await cdp.send("Accessibility.getFullAXTree");
      const radios = tree.nodes.filter((n) => n.role?.value === "radio").map((n) => ({ name: n.name?.value, checked: n.properties?.find((p) => p.name === "checked")?.value?.value }));
      for (const name of ["I feel reconnected", "Talking", "Choice radio true"]) assert.equal(radios.find((n) => n.name === name)?.checked, "true");
      assert.equal(radios.find((n) => n.name === "Still unresolved")?.checked, "false");
      assert.ok(tree.nodes.some((n) => n.role?.value === "radiogroup" && n.name?.value === "What helped? (optional)"));
      return { radios };
    });
    await test("CouplyChoiceCard preserves checked and unchecked radio/checkbox semantics", async () => {
      for (const role of ["radio", "checkbox"]) for (const checked of [false, true]) {
        assert.equal(await page.getByRole(role, { name: `Choice ${role} ${checked}`, exact: true }).getAttribute("aria-checked"), String(checked));
      }
      assert.equal(await page.getByRole("button", { name: "Plain choice button", exact: true }).getAttribute("aria-checked"), null);
    });
    await test("visible focus, 375px wrapping and equivalent 200% enlargement", async () => {
      await page.setViewportSize({ width: 375, height: 900 });
      await before.focus(); await page.keyboard.press("Tab");
      const outline = await status.getByRole("radio", { name: "I feel reconnected", exact: true }).evaluate((e) => { const s = getComputedStyle(e.parentElement); return { width: s.outlineWidth, style: s.outlineStyle }; });
      assert.ok(parseFloat(outline.width) > 0 && outline.style === "solid");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
      await screenshot("375px-keyboard-focus.png");
      await page.setViewportSize({ width: 750, height: 1200 }); await page.evaluate(() => { document.body.style.zoom = "2"; });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
      await screenshot("200-percent-enlargement.png");
      await page.evaluate(() => { document.body.style.zoom = ""; });
      return { outline, enlargement: "CSS zoom 2; no native font-scaling or screen-reader claim" };
    });
    assert.equal(report.blockedRequests.filter((r) => r.kind === "backend").length, 0, "Presentation interactions attempted backend access");
    assert.equal(report.pageErrors.length, 0);
    report.backendRequests = 0;
    report.databaseWrites = 0;
    report.screenReader = "NOT_EXECUTED";
  } catch (e) {
    report.error = { name: e.name, message: e.message.slice(0, 1200) };
  } finally {
    await browser?.close();
    report.status = !report.error && report.cases.length === 9 && report.cases.every((c) => c.status === "PASS") ? "PASS" : "FAIL";
    fs.writeFileSync(path.join(evidence, "report.json"), JSON.stringify(report, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ ...report, evidence }, null, 2));
    if (report.status !== "PASS") process.exitCode = 1;
  }
})();
