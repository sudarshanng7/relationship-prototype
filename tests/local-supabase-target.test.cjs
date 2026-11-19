const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");
const { getLocalSupabaseConfig } = require("../src/lib/local-supabase-target.js");
const { localExpoEnvironment } = require("../scripts/start-local.cjs");

const KEY = "sb_publishable_synthetic_local_test_only";
const STAGING = "https://yzfsyrfjddfomdhwuqyb.supabase.co";
const LOCAL = "http://127.0.0.1:55321";

for (const url of [LOCAL, "http://localhost:54321/", "http://[::1]:55321"]) {
  test(`accepts explicit loopback target ${url}`, () => {
    const result = getLocalSupabaseConfig("local", url, KEY);
    assert.equal(result.supabaseUrl, new URL(url).origin);
    assert.equal(result.supabasePublishableKey, KEY);
  });
}

for (const url of [
  STAGING, "http://yzfsyrfjddfomdhwuqyb.supabase.co:55321",
  "https://another-project.supabase.co", "http://192.168.1.10:55321",
  "http://127.0.0.1.example.com:55321", "http://127.0.0.1@remote.example:55321",
  "http://user:password@127.0.0.1:55321", "http://127.0.0.1:55321/rest/v1",
  "http://127.0.0.1:55321/?target=hosted", "http://127.0.0.1:55321/#hosted",
  "https://127.0.0.1:55321", "http://127.0.0.1", "http://127.0.0.1:80",
  "not-a-url", "", undefined,
]) {
  test(`rejects non-profile URL ${String(url)}`, () => {
    assert.throws(() => getLocalSupabaseConfig("local", url, KEY));
  });
}

for (const profile of [undefined, "", "staging", "production"]) {
  test(`rejects profile ${String(profile)} even with a loopback URL`, () => {
    assert.throws(() => getLocalSupabaseConfig(profile, LOCAL, KEY));
  });
}
for (const key of [undefined, "", "sb_secret_synthetic", "service_role", "eyJ.synthetic.jwt"]) {
  test(`rejects missing or unsupported key ${String(key)}`, () => {
    assert.throws(() => getLocalSupabaseConfig("local", LOCAL, key));
  });
}

test("launcher has no fallback to inherited staging configuration", () => {
  assert.throws(() => localExpoEnvironment({
    EXPO_PUBLIC_SUPABASE_URL: STAGING,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: KEY,
  }));
  assert.throws(() => localExpoEnvironment({
    ROS_LOCAL_SUPABASE_URL: LOCAL,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: KEY,
  }));
  assert.throws(() => localExpoEnvironment({
    ROS_LOCAL_SUPABASE_URL: STAGING,
    ROS_LOCAL_SUPABASE_PUBLISHABLE_KEY: KEY,
  }));
});

test("launcher replaces public staging variables and disables dotenv loading", () => {
  const env = localExpoEnvironment({
    PATH: "/synthetic/path",
    ROS_LOCAL_SUPABASE_URL: LOCAL,
    ROS_LOCAL_SUPABASE_PUBLISHABLE_KEY: KEY,
    EXPO_PUBLIC_SUPABASE_URL: STAGING,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_staging",
    EXPO_PUBLIC_APP_ENV: "staging",
    EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "synthetic-secret",
    SUPABASE_ACCESS_TOKEN: "synthetic-secret",
    PGPASSWORD: "synthetic-secret",
  });
  assert.equal(env.EXPO_PUBLIC_SUPABASE_URL, LOCAL);
  assert.equal(env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, KEY);
  assert.equal(env.EXPO_PUBLIC_APP_ENV, "local");
  assert.equal(env.EXPO_NO_DOTENV, "1");
  assert.equal(env.EXPO_OFFLINE, "1");
  assert.equal(env.COREPACK_ENABLE_NETWORK, "0");
  for (const name of ["ROS_LOCAL_SUPABASE_URL", "SUPABASE_ACCESS_TOKEN", "PGPASSWORD", "EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"]) {
    assert.equal(env[name], undefined);
  }
  assert.equal(env.PATH, "/synthetic/path");
});

test("local startup uses only the localhost flag and the validated local environment", () => {
  const file = path.join(__dirname, "../scripts/start-local.cjs");
  const source = fs.readFileSync(file, "utf8");
  const calls = [];
  const main = {};
  const requireMock = (name) => {
    if (name === "node:child_process") return {
      spawn(command, args, options) {
        calls.push({ command, args, options });
        return { on() {} };
      },
    };
    if (name === "node:path") return path;
    if (name === "../src/lib/local-supabase-target.js") return { getLocalSupabaseConfig };
    throw new Error("Unexpected startup import");
  };
  requireMock.main = main;
  const run = (environment) => {
    const processMock = { argv: ["node", file], env: environment };
    vm.runInNewContext(source, {
      require: requireMock, module: main, __dirname: path.dirname(file),
      process: processMock, console: { log() {}, error() {} },
    });
    return processMock;
  };
  run({
    ROS_LOCAL_SUPABASE_URL: "http://127.0.0.1:55421",
    ROS_LOCAL_SUPABASE_PUBLISHABLE_KEY: KEY,
    EXPO_PUBLIC_SUPABASE_URL: STAGING,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_staging",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-secret",
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, "pnpm");
  assert.deepEqual(Array.from(calls[0].args), ["exec", "expo", "start", "--localhost"]);
  assert.equal(calls[0].options.env.EXPO_NO_DOTENV, "1");
  assert.equal(calls[0].options.env.EXPO_OFFLINE, "1");
  assert.equal(calls[0].options.env.EXPO_PUBLIC_SUPABASE_URL, "http://127.0.0.1:55421");
  assert.equal(calls[0].options.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, KEY);
  assert.equal(calls[0].options.env.SUPABASE_SERVICE_ROLE_KEY, undefined);
  for (const environment of [
    { ROS_LOCAL_SUPABASE_URL: STAGING, ROS_LOCAL_SUPABASE_PUBLISHABLE_KEY: KEY },
    { EXPO_PUBLIC_SUPABASE_URL: STAGING, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: KEY },
    { ROS_LOCAL_SUPABASE_URL: "http://127.0.0.1:55421", ROS_LOCAL_SUPABASE_PUBLISHABLE_KEY: "sb_secret_synthetic" },
  ]) {
    assert.equal(run(environment).exitCode, 1);
    assert.equal(calls.length, 1);
  }
});

// Evaluate the actual client module with mocked imports: no SDK or network runs.
function evaluateClient(environment) {
  const source = fs.readFileSync(path.join(__dirname, "../src/lib/supabase.ts"), "utf8");
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  let calls = 0;
  const context = {
    exports: {}, process: { env: environment },
    require(name) {
      if (name === "react-native-url-polyfill/auto") return {};
      if (name === "@react-native-async-storage/async-storage") return { default: {} };
      if (name === "react-native") return { Platform: { OS: "web" } };
      if (name === "./local-supabase-target") return { getLocalSupabaseConfig };
      if (name === "@supabase/supabase-js") return {
        createClient(url, key) { calls++; return { url, key }; },
      };
      throw new Error("Unexpected module import");
    },
    fetch() { throw new Error("Network is forbidden in local isolation tests"); },
  };
  let error;
  try { vm.runInNewContext(result.outputText, context); }
  catch (caught) { error = caught; }
  return { calls, error, client: context.exports.supabase };
}

test("actual client module rejects hosted staging before createClient", () => {
  const result = evaluateClient({
    EXPO_PUBLIC_APP_ENV: "local", EXPO_PUBLIC_SUPABASE_URL: STAGING,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: KEY,
  });
  assert(result.error);
  assert.equal(result.calls, 0);
});
test("ordinary staging environment cannot initialize a client without a profile", () => {
  const result = evaluateClient({
    EXPO_PUBLIC_SUPABASE_URL: STAGING, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: KEY,
  });
  assert(result.error);
  assert.equal(result.calls, 0);
});
test("actual client module passes only a validated local target to the mocked SDK", () => {
  const result = evaluateClient({
    EXPO_PUBLIC_APP_ENV: "local", EXPO_PUBLIC_SUPABASE_URL: LOCAL,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: KEY,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.calls, 1);
  assert.equal(result.client.url, LOCAL);
});
