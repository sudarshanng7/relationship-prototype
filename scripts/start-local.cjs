const { spawn } = require("node:child_process");
const path = require("node:path");
const { getLocalSupabaseConfig } = require("../src/lib/local-supabase-target.js");

function localExpoEnvironment(environment) {
  // Dedicated inputs only: never fall back to staging's EXPO_PUBLIC variables.
  const config = getLocalSupabaseConfig(
    "local",
    environment.ROS_LOCAL_SUPABASE_URL,
    environment.ROS_LOCAL_SUPABASE_PUBLISHABLE_KEY,
  );
  const clean = Object.fromEntries(Object.entries(environment).filter(([name]) =>
    !name.startsWith("EXPO_PUBLIC_") &&
    !name.startsWith("SUPABASE_") &&
    !name.startsWith("ROS_LOCAL_SUPABASE_") &&
    !name.startsWith("PG"),
  ));
  return {
    ...clean,
    EXPO_NO_DOTENV: "1",
    EXPO_NO_TELEMETRY: "1",
    EXPO_OFFLINE: "1",
    COREPACK_ENABLE_NETWORK: "0",
    COREPACK_ENABLE_AUTO_PIN: "0",
    COREPACK_DEFAULT_TO_LATEST: "0",
    EXPO_PUBLIC_APP_ENV: "local",
    EXPO_PUBLIC_SUPABASE_URL: config.supabaseUrl,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.supabasePublishableKey,
  };
}

function startLocal() {
  if (process.argv.length !== 2) {
    throw new Error("The local profile takes no additional command-line arguments.");
  }
  const env = localExpoEnvironment(process.env);
  console.log(`Starting Expo for local Supabase at ${env.EXPO_PUBLIC_SUPABASE_URL}`);
  // pnpm still checks the installation; no implicit install or CLI download.
  const child = spawn("pnpm", ["exec", "expo", "start", "--localhost"], {
    cwd: path.resolve(__dirname, ".."),
    env,
    stdio: "inherit",
  });
  child.on("error", () => {
    console.error("Could not launch the installed Expo CLI through pnpm.");
    process.exitCode = 1;
  });
  child.on("exit", (code) => { process.exitCode = code ?? 1; });
}

module.exports = { localExpoEnvironment };

if (require.main === module) {
  try { startLocal(); }
  catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
