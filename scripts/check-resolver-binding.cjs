// Smoke check for the proposed Linux x64/glibc CI runner. Load the locked
// prebuilt binary directly, never the postinstall/fallback download helpers.
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
assert.ok(process.platform === "linux" && process.arch === "x64" &&
  process.report.getReport().header.glibcVersionRuntime,
"This smoke check targets Linux x64/glibc; other platforms need separate validation.");
const expoRequire = createRequire(require.resolve("eslint-config-expo/package.json"));
const resolverRequire = createRequire(expoRequire.resolve("eslint-import-resolver-typescript"));
const unrsRequire = createRequire(resolverRequire.resolve("unrs-resolver/package.json"));
assert.equal(unrsRequire("./package.json").version, "1.12.2");
const bindingName = "@unrs/resolver-binding-linux-x64-gnu";
assert.equal(unrsRequire(`${bindingName}/package.json`).version, "1.12.2");
const { ResolverFactory } = unrsRequire(bindingName);
const resolver = new ResolverFactory({ extensions: [".ts", ".tsx", ".js", ".json"] });
assert.equal(resolver.sync(root, "./src/lib/repair-states").path,
  path.join(root, "src/lib/repair-states.ts"));
console.log("Locked prebuilt resolver 1.12.2 resolved project TypeScript without postinstall initialization.");
