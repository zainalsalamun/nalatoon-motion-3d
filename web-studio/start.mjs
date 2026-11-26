#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

console.log("\n  Nalatoon 3D Motion Studio");
console.log("  ----------------------------------------");
console.log("  Open in browser: http://127.0.0.1:5173\n");

const viteBin = path.join(projectRoot, "node_modules", ".bin", "vite");
const viteProc = spawn(viteBin, ["--config", path.join(__dirname, "vite.config.ts")], {
  cwd: projectRoot,
  stdio: "inherit",
});

const shutdown = () => {
  viteProc.kill("SIGTERM");
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

viteProc.on("exit", (code) => {
  process.exit(code ?? 0);
});
