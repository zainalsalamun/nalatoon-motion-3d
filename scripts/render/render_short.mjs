#!/usr/bin/env node
/**
 * Cross-platform Remotion 3D Short renderer (macOS, Windows, Linux)
 * Usage: node scripts/render/render_short.mjs <CompositionId> [output.mp4]
 * Env:
 *   REMOTION_CONCURRENCY=2   Parallel render tabs (use 1 on 8GB RAM machines)
 *   REMOTION_CRF=18          H.264 quality (18=master, 23=fast)
 *   REMOTION_GL=angle        WebGL backend (angle | swiftshader for headless Linux VPS)
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

const compId = process.argv[2];
if (!compId) {
  console.error("Usage: node scripts/render/render_short.mjs <CompositionId> [output.mp4]");
  process.exit(1);
}

const outFile = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(PROJECT_ROOT, "out", `${compId}.mp4`);

fs.mkdirSync(path.dirname(outFile), { recursive: true });

const remotionCli = path.join(PROJECT_ROOT, "node_modules", "@remotion", "cli", "remotion-cli.js");
if (!fs.existsSync(remotionCli)) {
  console.error("Remotion CLI not found. Run 'npm install' first.");
  process.exit(1);
}

const concurrency = process.env.REMOTION_CONCURRENCY || "2";
const crf = process.env.REMOTION_CRF || "18";
const gl = process.env.REMOTION_GL || "angle";

const args = [
  remotionCli,
  "render",
  compId,
  outFile,
  `--concurrency=${concurrency}`,
  `--crf=${crf}`,
  `--gl=${gl}`,
  "--timeout=120000",
];

console.log(`>>> Rendering ${compId} (${process.platform}/${process.arch}, gl=${gl}, crf=${crf}, concurrency=${concurrency})`);
console.log(`>>> Output: ${outFile}`);

const child = spawn(process.execPath, args, {
  cwd: PROJECT_ROOT,
  stdio: "inherit",
});

child.on("exit", (code) => {
  if (code === 0) {
    console.log(`>>> Done: ${outFile}`);
  }
  process.exit(code ?? 1);
});
