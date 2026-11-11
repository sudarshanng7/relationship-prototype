// Read-only policy check. Run with Node and an already-provisioned pnpm; no
// dependencies, installs, approvals, package-manager repair or config writes.
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const manifest = JSON.parse(read("package.json"));
const nodeVersion = read(".node-version").trim();
const pnpm = process.env.PNPM_CONFIG_CHECK_BIN || "pnpm";

function run(args) {
  return execFileSync(pnpm, args, {
    cwd: root,
    encoding: "utf8",
    timeout: 15000,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      // Corepack must use an existing cache entry, never download or auto-pin.
      COREPACK_ENABLE_NETWORK: "0",
      COREPACK_ENABLE_AUTO_PIN: "0",
      COREPACK_DEFAULT_TO_LATEST: "0",
    },
  }).trim();
}

function config(key) {
  // Delegate YAML parsing to the pinned pnpm, without invoking run/exec/install.
  // Project location excludes unrelated global configuration and secrets.
  const value = run([
    "--offline", "--pm-on-fail=ignore", "config", "get",
    "--location=project", "--json", key,
  ]);
  // pnpm 12.5.1 prints JSON null for an unset project key.
  return value === "undefined" ? undefined : (JSON.parse(value) ?? undefined);
}

try {
  assert.equal(manifest.packageManager, "pnpm@12.5.1", "Review changes to the pnpm pin");
  assert.equal(nodeVersion, "22.23.2", "Review changes to the validated Node baseline");
  assert.equal(process.versions.node, nodeVersion, "Use the Node version in .node-version");
  assert.equal(run(["--version"]), "12.5.1", "Provision pnpm 12.5.1 before running this check");
  assert.match(read("pnpm-lock.yaml"), /^lockfileVersion: '9\.0'\r?$/m);
  const workspace = read("pnpm-workspace.yaml");
  assert.doesNotMatch(workspace, /set this to true or false/i);
  // pnpm can silently omit settings unknown to this version. Keep this small
  // policy file's shape explicit, rejecting alternative/legacy policy keys and
  // YAML indirection rather than mistaking their omission for a verified denial.
  for (const line of workspace.split(/\r?\n/)) {
    assert.ok(/^\s*(#.*)?$/.test(line) ||
      /^(allowBuilds|strictDepBuilds|verifyDepsBeforeRun|pmOnFail):/.test(line) ||
      /^ {2}unrs-resolver:/.test(line), "Review unexpected workspace configuration");
  }
  const builds = config("allowBuilds");
  assert.ok(builds && typeof builds === "object" && !Array.isArray(builds), "allowBuilds must be a map");
  for (const [name, decision] of Object.entries(builds)) {
    assert.equal(typeof decision, "boolean", `${name} requires an actual YAML boolean`);
  }
  assert.deepEqual(builds, { "unrs-resolver": false }, "No additional dependency builds are approved");
  assert.equal(config("strictDepBuilds"), true, "Unreviewed builds must fail");
  assert.equal(config("verifyDepsBeforeRun"), "error", "Implicit dependency repair must stay disabled");
  assert.equal(config("pmOnFail"), "ignore", "Preserve the application lockfile; versions are checked above");
  for (const key of [
    "dangerouslyAllowAllBuilds", "permissions", "onlyBuiltDependencies",
    "onlyBuiltDependenciesFile", "neverBuiltDependencies", "ignoredBuiltDependencies",
  ]) {
    assert.equal(config(key), undefined, `Unexpected alternative build policy: ${key}`);
  }
  console.log("pnpm configuration passed: valid YAML, explicit build denial, pinned tools and lockfile format.");
} catch {
  // Do not echo subprocess stderr/configuration, which may contain local data.
  console.error("pnpm configuration check failed. Check tool versions, YAML and the reviewed build policy; no changes were made.");
  process.exitCode = 1;
}
