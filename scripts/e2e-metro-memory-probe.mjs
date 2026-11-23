import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const APP_URL = "http://127.0.0.1:8081";
const REPORT_DIR = path.resolve("test-results/stability");
const REPORT_FILE = path.join(REPORT_DIR, "memory-probe-report.json");

fs.mkdirSync(REPORT_DIR, { recursive: true });

function findExpoProcess() {
  let pid = null;
  try {
    const lsofOut = execSync("lsof -ti :8081 2>/dev/null", { encoding: "utf8" }).trim();
    if (lsofOut) {
      pid = parseInt(lsofOut.split("\n")[0], 10);
    }
  } catch {}

  if (!pid) {
    try {
      const psOut = execSync("pgrep -f 'expo.*start' || pgrep -f 'node.*expo' || true", { encoding: "utf8" }).trim();
      if (psOut) {
        pid = parseInt(psOut.split("\n")[0], 10);
      }
    } catch {}
  }

  return pid;
}

function getProcessMemory(pid) {
  let rssKb = 0;
  let vszKb = 0;
  let isRunning = false;
  if (pid) {
    try {
      const psOut = execSync(`ps -p ${pid} -o rss,vsz --no-headers`, { encoding: "utf8" }).trim();
      if (psOut) {
        const parts = psOut.split(/\s+/).filter(Boolean);
        rssKb = parseInt(parts[0], 10) || 0;
        vszKb = parseInt(parts[1], 10) || 0;
        isRunning = true;
      }
    } catch {
      isRunning = false;
    }
  }

  return {
    isRunning,
    rssMb: Math.round(rssKb / 1024),
    vszMb: Math.round(vszKb / 1024),
    rssKb,
    vszKb,
  };
}

function checkHttpStatus(timeoutMs = 5000) {
  try {
    return execSync(`curl -s -m ${Math.round(timeoutMs / 1000)} -o /dev/null -w "%{http_code}" ${APP_URL} || echo 000`, { encoding: "utf8" }).trim();
  } catch {
    return "000";
  }
}

function getExpoMemoryAndHealth(pid) {
  const mem = getProcessMemory(pid);
  const httpStatus = checkHttpStatus();
  return {
    ...mem,
    httpStatus,
  };
}

function getAvailableWslRam() {
  try {
    const out = execSync("free -m | grep Mem:", { encoding: "utf8" }).trim();
    const parts = out.split(/\s+/);
    return {
      totalMb: parseInt(parts[1], 10),
      availableMb: parseInt(parts[6], 10),
    };
  } catch {
    return { totalMb: 0, availableMb: 0 };
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runProbe() {
  console.log("=== PURPLE GARDEN: CONTROLLED METRO MEMORY RETENTION PROBE ===");
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // PREPARATION
  const pid = findExpoProcess();
  console.log(`Checking Expo process on port 8081: PID = ${pid || "NONE"}`);

  if (!pid) {
    console.error("\n[BLOCKED] Expo server is not running on port 8081.");
    console.error("Per PREPARATION Rule 5: User controls Expo startup manually in a dedicated WSL terminal.");
    console.error("Required startup command:");
    console.error('  NODE_OPTIONS="--max-old-space-size=3072" pnpm exec expo start --web --port 8081\n');
    process.exit(2);
  }

  const initialCheck = getExpoMemoryAndHealth(pid);
  if (!initialCheck.isRunning || initialCheck.httpStatus !== "200") {
    console.error(`\n[BLOCKED] Expo server is not responding with HTTP 200 (Got: ${initialCheck.httpStatus}).`);
    process.exit(2);
  }

  let nodeOptions = "UNKNOWN";
  try {
    const envOut = execSync(`tr '\\0' '\\n' < /proc/${pid}/environ | grep '^NODE_OPTIONS=' || echo 'NODE_OPTIONS_NOT_FOUND'`, { encoding: "utf8" }).trim();
    nodeOptions = envOut;
  } catch {}
  console.log(`Verified NODE_OPTIONS: ${nodeOptions}`);

  const wslRam = getAvailableWslRam();
  console.log(`WSL RAM: Total ${wslRam.totalMb} MB | Available ${wslRam.availableMb} MB`);

  const report = {
    timestamp: new Date().toISOString(),
    pid,
    nodeOptions,
    wslRam,
    initialBaseline: initialCheck,
    stage1_idle: {},
    stage2_watcher: {},
    stage3_clientBundle: {},
    stage4_ssrDocument: {},
    summary: {},
  };

  console.log(`Initial Safe Memory Baseline: RSS ${initialCheck.rssMb} MB | VSZ ${initialCheck.vszMb} MB | HTTP ${initialCheck.httpStatus}`);

  // STAGE 1 — IDLE BASELINE (60s)
  console.log("\n--- STAGE 1: Idle Baseline (60 seconds, 0 requests, 0 file writes) ---");
  const idleSamples = [];
  const sampleIntervals = [0, 30000, 30000]; // 0s, 30s, 60s total

  for (let i = 0; i < sampleIntervals.length; i++) {
    if (sampleIntervals[i] > 0) {
      console.log(`  Waiting ${sampleIntervals[i] / 1000}s for idle observation...`);
      await sleep(sampleIntervals[i]);
    }
    const sample = getProcessMemory(pid);
    const elapsedS = i === 0 ? 0 : i === 1 ? 30 : 60;
    console.log(`  Sample ${i + 1} (t=${elapsedS}s): RSS ${sample.rssMb} MB | VSZ ${sample.vszMb} MB (passive measurement, 0 requests)`);
    idleSamples.push({ elapsedS, ...sample });
  }

  report.stage1_idle = {
    samples: idleSamples,
    deltaRssMb: idleSamples[idleSamples.length - 1].rssMb - idleSamples[0].rssMb,
    stable: Math.abs(idleSamples[idleSamples.length - 1].rssMb - idleSamples[0].rssMb) <= 50,
  };
  console.log(`  Stage 1 ΔRSS: ${report.stage1_idle.deltaRssMb} MB (Stable: ${report.stage1_idle.stable})`);

  // STAGE 2 — GENERATED FILE WATCHER
  console.log("\n--- STAGE 2: Generated File Watcher (10 temporary files in test-results/stability/) ---");
  const preWatcher = getProcessMemory(pid);
  console.log(`  Before file generation: RSS ${preWatcher.rssMb} MB`);

  const createdFiles = [];
  const intermediateSamples = [];

  for (let i = 1; i <= 10; i++) {
    const tempFile = path.join(REPORT_DIR, `probe-watcher-file-${i}.tmp`);
    // Bounded ~50KB synthetic content
    const content = Buffer.alloc(50 * 1024, `PROBE_TEST_DATA_${i}_${Date.now()}\n`);
    fs.writeFileSync(tempFile, content);
    createdFiles.push(tempFile);
    await sleep(250); // Give watcher 250ms per write

    if (i % 5 === 0) {
      const sample = getProcessMemory(pid);
      intermediateSamples.push({ filesWritten: i, ...sample });
      console.log(`  Written ${i}/10 files: RSS ${sample.rssMb} MB`);
    }
  }

  // Wait 3 seconds for watcher queues to process
  await sleep(3000);
  const postWriteMem = getProcessMemory(pid);
  console.log(`  After 10 files written + 3s wait: RSS ${postWriteMem.rssMb} MB`);

  // Clean up only temporary files created by this probe
  for (const f of createdFiles) {
    try {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    } catch {}
  }
  console.log(`  Cleaned up ${createdFiles.length} temporary files.`);

  await sleep(2000);
  const postCleanupMem = getProcessMemory(pid);
  console.log(`  After cleanup + 2s wait: RSS ${postCleanupMem.rssMb} MB`);

  report.stage2_watcher = {
    preRssMb: preWatcher.rssMb,
    postWriteRssMb: postWriteMem.rssMb,
    postCleanupRssMb: postCleanupMem.rssMb,
    deltaRssMb: postCleanupMem.rssMb - preWatcher.rssMb,
    intermediateSamples,
  };
  console.log(`  Stage 2 ΔRSS: ${report.stage2_watcher.deltaRssMb} MB`);

  // STAGE 3 — CLIENT BUNDLE COMPILATION
  console.log("\n--- STAGE 3: Client Bundle Compilation (Bounded GET to actual bundle URL) ---");
  const preBundleMem = getProcessMemory(pid);
  console.log(`  Before bundle request: RSS ${preBundleMem.rssMb} MB`);

  // Inspect HTML of / to discover actual script bundle URL
  let html = "";
  try {
    html = execSync(`curl -s ${APP_URL}/`, { encoding: "utf8", timeout: 10000 });
  } catch {}

  const scriptMatches = [...html.matchAll(/src="([^"]+\.bundle[^"]*)"/g)].map((m) => m[1]);
  const bundleCandidates = scriptMatches.length > 0 ? scriptMatches : [
    "/.expo/.virtual-metro-entry.bundle?platform=web&dev=true&hot=false",
    "/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false",
  ];

  console.log(`  Discovered bundle URL candidates: ${JSON.stringify(bundleCandidates)}`);

  let verifiedBundleUrl = null;
  let bundleContentType = "";

  for (const cand of bundleCandidates) {
    const fullUrl = cand.startsWith("http") ? cand : `${APP_URL}${cand.startsWith("/") ? "" : "/"}${cand}`;
    try {
      const headerOut = execSync(`curl -s -I "${fullUrl}"`, { encoding: "utf8", timeout: 8000 });
      if (headerOut.includes("200 OK") || headerOut.includes("HTTP/1.1 200") || headerOut.includes("HTTP/2 200")) {
        verifiedBundleUrl = fullUrl;
        const ctMatch = headerOut.match(/content-type:\s*([^\r\n]+)/i);
        bundleContentType = ctMatch ? ctMatch[1] : "unknown";
        break;
      }
    } catch {}
  }

  if (verifiedBundleUrl) {
    console.log(`  Verified active bundle URL: ${verifiedBundleUrl} (${bundleContentType})`);
    // Request bundle
    const t0 = Date.now();
    try {
      execSync(`curl -s -o /dev/null "${verifiedBundleUrl}"`, { timeout: 30000 });
    } catch (err) {
      console.warn(`  Warning during bundle curl: ${err.message}`);
    }
    const compileDurationMs = Date.now() - t0;

    await sleep(2000);
    const postBundleMem = getProcessMemory(pid);
    console.log(`  After client bundle fetch (${compileDurationMs}ms): RSS ${postBundleMem.rssMb} MB (Δ ${postBundleMem.rssMb - preBundleMem.rssMb} MB)`);

    // Test repeat request (cache hit behavior)
    execSync(`curl -s -o /dev/null "${verifiedBundleUrl}"`, { timeout: 15000 });
    await sleep(1000);
    const postRepeatMem = getProcessMemory(pid);
    console.log(`  After repeat bundle fetch (cached): RSS ${postRepeatMem.rssMb} MB (Δ from post-bundle ${postRepeatMem.rssMb - postBundleMem.rssMb} MB)`);

    report.stage3_clientBundle = {
      status: "PASS",
      bundleUrl: verifiedBundleUrl,
      bundleContentType,
      compileDurationMs,
      preRssMb: preBundleMem.rssMb,
      postRssMb: postBundleMem.rssMb,
      postRepeatRssMb: postRepeatMem.rssMb,
      deltaRssMb: postBundleMem.rssMb - preBundleMem.rssMb,
      repeatDeltaRssMb: postRepeatMem.rssMb - postBundleMem.rssMb,
    };
  } else {
    console.log("  [BLOCKED] Could not verify valid client bundle endpoint.");
    report.stage3_clientBundle = {
      status: "BLOCKED",
      preRssMb: preBundleMem.rssMb,
      postRssMb: preBundleMem.rssMb,
      deltaRssMb: 0,
      candidates: bundleCandidates,
    };
  }

  // STAGE 4 — SSR DOCUMENT REQUEST
  console.log("\n--- STAGE 4: SSR Document Request (Bounded HTTP GET to /home with Accept: text/html) ---");
  const preSsrMem = getProcessMemory(pid);
  console.log(`  Before SSR request: RSS ${preSsrMem.rssMb} MB`);

  let ssrStatus = "000";
  let ssrDurationMs = 0;
  try {
    const t0 = Date.now();
    ssrStatus = execSync(`curl -s -o /dev/null -w "%{http_code}" -H "Accept: text/html" "${APP_URL}/home"`, { encoding: "utf8", timeout: 15000 }).trim();
    ssrDurationMs = Date.now() - t0;
  } catch (err) {
    ssrStatus = "ERR";
  }

  console.log(`  SSR GET /home returned: HTTP ${ssrStatus} in ${ssrDurationMs}ms`);
  await sleep(2000);

  const postSsrMem = getProcessMemory(pid);
  console.log(`  After SSR request: RSS ${postSsrMem.rssMb} MB (Δ ${postSsrMem.rssMb - preSsrMem.rssMb} MB)`);

  report.stage4_ssrDocument = {
    status: ssrStatus === "200" ? "PASS" : "FAIL",
    httpStatus: ssrStatus,
    durationMs: ssrDurationMs,
    preRssMb: preSsrMem.rssMb,
    postRssMb: postSsrMem.rssMb,
    deltaRssMb: postSsrMem.rssMb - preSsrMem.rssMb,
  };

  // SUMMARY & COMPARISON (Preserve exact displayed final stage memory)
  const finalHttpStatus = checkHttpStatus();
  report.summary = {
    initialRssMb: initialCheck.rssMb,
    finalRssMb: postSsrMem.rssMb,
    netRssGrowthMb: postSsrMem.rssMb - initialCheck.rssMb,
    stage1_idle_delta: report.stage1_idle.deltaRssMb || 0,
    stage2_watcher_delta: report.stage2_watcher.deltaRssMb || 0,
    stage3_bundle_delta: report.stage3_clientBundle.deltaRssMb || 0,
    stage4_ssr_delta: report.stage4_ssrDocument.deltaRssMb || 0,
    finalHealth: {
      ...postSsrMem,
      httpStatus: finalHttpStatus,
    },
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  console.log(`\nProbe report saved to: ${REPORT_FILE}`);
  console.log(`Net RSS Growth: ${report.summary.netRssGrowthMb} MB across all 4 stages.`);
  console.log("=== PROBE COMPLETE ===");
}

runProbe().catch((err) => {
  console.error("Probe execution error:", err);
  process.exit(1);
});
