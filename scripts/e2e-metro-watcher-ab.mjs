import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const APP_URL = "http://127.0.0.1:8081";
const REPORT_DIR = path.resolve("test-results/stability");
const REPORT_FILE = path.join(REPORT_DIR, "watcher-ab-report.json");
const CONTROL_DIR = "/tmp/pg-ab-control";
const WATCHED_DIR = path.join(REPORT_DIR, "pg-ab-watched");

fs.mkdirSync(REPORT_DIR, { recursive: true });
fs.mkdirSync(CONTROL_DIR, { recursive: true });
fs.mkdirSync(WATCHED_DIR, { recursive: true });

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

function inspectInotifyWatches(pid) {
  const result = {
    testResultsWatched: false,
    srcWatched: false,
    totalWatches: 0,
    details: "",
  };

  try {
    const testResultsStat = fs.statSync(REPORT_DIR);
    const srcStat = fs.statSync(path.resolve("src"));
    const inoTestResultsDec = testResultsStat.ino.toString();
    const inoTestResultsHex = testResultsStat.ino.toString(16);
    const inoSrcDec = srcStat.ino.toString();
    const inoSrcHex = srcStat.ino.toString(16);

    const fdInfoOut = execSync(`grep -h "ino:" /proc/${pid}/fdinfo/* 2>/dev/null || true`, { encoding: "utf8" });
    const lines = fdInfoOut.split("\n").filter(Boolean);
    result.totalWatches = lines.length;

    for (const line of lines) {
      if (line.includes(`ino:${inoTestResultsDec}`) || line.includes(`ino:${inoTestResultsHex}`)) {
        result.testResultsWatched = true;
      }
      if (line.includes(`ino:${inoSrcDec}`) || line.includes(`ino:${inoSrcHex}`)) {
        result.srcWatched = true;
      }
    }
    result.details = `Total inotify watches: ${result.totalWatches} (test-results ino=${inoTestResultsDec}/${inoTestResultsHex}: ${result.testResultsWatched}, src ino=${inoSrcDec}/${inoSrcHex}: ${result.srcWatched})`;
  } catch (err) {
    result.details = `Could not inspect inotify: ${err.message}`;
  }

  return result;
}

async function runAbTest() {
  console.log("=== PURPLE GARDEN: CONTROLLED METRO FILE-WATCHER A/B TEST ===");
  console.log(`Timestamp: ${new Date().toISOString()}`);

  const pid = findExpoProcess();
  console.log(`Checking Expo process on port 8081: PID = ${pid || "NONE"}`);

  if (!pid) {
    console.error("\n[BLOCKED] Expo server is not running on port 8081.");
    console.error("Per PREPARATION Rule: User controls Expo startup manually in a dedicated WSL terminal.");
    console.error("Required startup command:");
    console.error('  NODE_OPTIONS="--max-old-space-size=3072" pnpm exec expo start --web --port 8081\n');
    process.exit(2);
  }

  const initialMem = getProcessMemory(pid);
  const initialHttp = checkHttpStatus();
  console.log(`Initial Health: HTTP ${initialHttp} | RSS ${initialMem.rssMb} MB | VSZ ${initialMem.vszMb} MB`);

  if (!initialMem.isRunning || initialHttp !== "200") {
    console.error(`\n[BLOCKED] Expo server is not responding with HTTP 200 (Got: ${initialHttp}).`);
    process.exit(2);
  }

  let nodeOptions = "UNKNOWN";
  try {
    nodeOptions = execSync(`tr '\\0' '\\n' < /proc/${pid}/environ | grep '^NODE_OPTIONS=' || echo 'NODE_OPTIONS_NOT_FOUND'`, { encoding: "utf8" }).trim();
  } catch {}
  console.log(`Verified NODE_OPTIONS: ${nodeOptions}`);

  const wslRam = getAvailableWslRam();
  console.log(`WSL RAM: Total ${wslRam.totalMb} MB | Available ${wslRam.availableMb} MB`);

  // Kernel inotify check
  const inotifyInfo = inspectInotifyWatches(pid);
  console.log(`Inotify status: ${inotifyInfo.details}`);

  const report = {
    timestamp: new Date().toISOString(),
    pid,
    nodeOptions,
    wslRam,
    initialHealth: { ...initialMem, httpStatus: initialHttp },
    inotifyInfo,
    phase0_drift: {},
    phase1_control: {},
    phase2_watched: {},
    comparison: {},
  };

  // PHASE 0: PASSIVE BASELINE DRIFT MEASUREMENT (30 seconds, 0 requests, 0 writes)
  console.log("\n--- PHASE 0: Passive Baseline Drift (30 seconds, 0 HTTP requests, 0 file writes) ---");
  const driftSamples = [];
  const driftDurationS = 30;
  const driftIntervalMs = 5000;
  const numDriftSamples = driftDurationS / (driftIntervalMs / 1000);

  const tDriftStart = Date.now();
  for (let i = 0; i <= numDriftSamples; i++) {
    const elapsedS = Math.round((Date.now() - tDriftStart) / 1000);
    const mem = getProcessMemory(pid);
    driftSamples.push({ elapsedS, ...mem });
    console.log(`  Drift sample t=${elapsedS}s: RSS ${mem.rssMb} MB`);
    if (i < numDriftSamples) {
      await sleep(driftIntervalMs);
    }
  }

  const driftDeltaMb = driftSamples[driftSamples.length - 1].rssMb - driftSamples[0].rssMb;
  const driftRateMbPerSec = driftDeltaMb / driftDurationS;
  report.phase0_drift = {
    durationS: driftDurationS,
    samples: driftSamples,
    deltaRssMb: driftDeltaMb,
    driftRateMbPerSec: parseFloat(driftRateMbPerSec.toFixed(3)),
  };
  console.log(`  Baseline drift rate: ${report.phase0_drift.driftRateMbPerSec} MB/s (Total Δ ${driftDeltaMb} MB over ${driftDurationS}s)`);

  // Helper for file write / cleanup test
  async function runFileCycle(targetDir, filePrefix, label) {
    console.log(`\n--- ${label} ---`);
    console.log(`Target directory: ${targetDir}`);

    // Pre-test baseline (3 samples over 6s)
    const preSamples = [];
    for (let s = 1; s <= 3; s++) {
      const m = getProcessMemory(pid);
      preSamples.push(m);
      if (s < 3) await sleep(2000);
    }
    const baselineMem = preSamples[preSamples.length - 1];
    console.log(`  Pre-test baseline RSS: ${baselineMem.rssMb} MB`);

    const createdFiles = [];
    const writeSamples = [];
    const tCycleStart = Date.now();

    for (let i = 1; i <= 10; i++) {
      const tempFile = path.join(targetDir, `${filePrefix}-${i}-${Date.now()}.tmp`);
      const content = Buffer.alloc(50 * 1024, `AB_TEST_${filePrefix}_${i}_${Date.now()}\n`);
      fs.writeFileSync(tempFile, content);
      createdFiles.push(tempFile);
      await sleep(250);

      if (i === 5 || i === 10) {
        const sample = getProcessMemory(pid);
        writeSamples.push({ filesWritten: i, ...sample });
        console.log(`  Written ${i}/10 files: RSS ${sample.rssMb} MB`);
      }
    }

    // Wait 3s for watcher queue settling
    await sleep(3000);
    const postWriteMem = getProcessMemory(pid);
    console.log(`  After 10 files written + 3s wait: RSS ${postWriteMem.rssMb} MB`);

    // Clean up temporary files
    for (const f of createdFiles) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {}
    }
    console.log(`  Cleaned up ${createdFiles.length} temporary files.`);

    await sleep(3000);
    const postCleanupMem = getProcessMemory(pid);
    const tCycleEnd = Date.now();
    const cycleDurationS = Math.round((tCycleEnd - tCycleStart) / 1000);

    console.log(`  After cleanup + 3s wait: RSS ${postCleanupMem.rssMb} MB (Cycle duration: ${cycleDurationS}s)`);

    const grossDeltaMb = postCleanupMem.rssMb - baselineMem.rssMb;
    const expectedDriftMb = parseFloat((driftRateMbPerSec * cycleDurationS).toFixed(1));
    const adjustedDeltaMb = parseFloat((grossDeltaMb - expectedDriftMb).toFixed(1));

    console.log(`  Gross ΔRSS: ${grossDeltaMb} MB | Expected Baseline Drift: ${expectedDriftMb} MB | Net Adjusted ΔRSS: ${adjustedDeltaMb} MB`);

    return {
      targetDir,
      preSamples,
      baselineRssMb: baselineMem.rssMb,
      writeSamples,
      postWriteRssMb: postWriteMem.rssMb,
      postCleanupRssMb: postCleanupMem.rssMb,
      cycleDurationS,
      grossDeltaMb,
      expectedDriftMb,
      adjustedDeltaMb,
    };
  }

  // PHASE 1: CONTROL EXPERIMENT (OUTSIDE PROJECT, /tmp)
  report.phase1_control = await runFileCycle(CONTROL_DIR, "control", "PHASE 1: Control Experiment (Outside Project: /tmp)");

  // Settling period between phases
  console.log("\n  Inter-phase settling (10s passive wait)...");
  await sleep(10000);

  // PHASE 2: WATCHED EXPERIMENT (INSIDE test-results/stability/)
  report.phase2_watched = await runFileCycle(WATCHED_DIR, "watched", "PHASE 2: Watched Experiment (Inside Project: test-results/stability/)");

  // Post-test Expo responsiveness check
  console.log("\n--- POST-TEST HEALTH CHECK ---");
  const finalMem = getProcessMemory(pid);
  const finalHttp = checkHttpStatus();
  console.log(`Final Health: HTTP ${finalHttp} | RSS ${finalMem.rssMb} MB | VSZ ${finalMem.vszMb} MB`);

  // COMPARISON & ANALYSIS
  const diffGross = report.phase2_watched.grossDeltaMb - report.phase1_control.grossDeltaMb;
  const diffAdjusted = report.phase2_watched.adjustedDeltaMb - report.phase1_control.adjustedDeltaMb;

  report.comparison = {
    controlGrossDeltaMb: report.phase1_control.grossDeltaMb,
    controlAdjustedDeltaMb: report.phase1_control.adjustedDeltaMb,
    watchedGrossDeltaMb: report.phase2_watched.grossDeltaMb,
    watchedAdjustedDeltaMb: report.phase2_watched.adjustedDeltaMb,
    diffGrossMb: diffGross,
    diffAdjustedMb: diffAdjusted,
    isWatcherCausingGrowth: diffAdjusted > 30, // threshold of significance
    justifiesBlockList: diffAdjusted > 30 || inotifyInfo.testResultsWatched,
    finalHealth: { ...finalMem, httpStatus: finalHttp },
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  console.log(`\nDetailed report saved to: ${REPORT_FILE}`);
  console.log("=== SUMMARY ===");
  console.log(`Control (Outside /tmp): Gross Δ ${report.phase1_control.grossDeltaMb} MB | Adjusted Δ ${report.phase1_control.adjustedDeltaMb} MB`);
  console.log(`Watched (Inside test-results): Gross Δ ${report.phase2_watched.grossDeltaMb} MB | Adjusted Δ ${report.phase2_watched.adjustedDeltaMb} MB`);
  console.log(`Differential Impact (Watched - Control): Gross ${diffGross} MB | Adjusted ${diffAdjusted} MB`);
  console.log(`Inotify Direct Watch on test-results: ${inotifyInfo.testResultsWatched}`);
  console.log(`Justifies Metro blockList addition: ${report.comparison.justifiesBlockList}`);
  console.log("=== A/B TEST COMPLETE ===");
}

runAbTest().catch((err) => {
  console.error("A/B test execution error:", err);
  process.exit(1);
});
