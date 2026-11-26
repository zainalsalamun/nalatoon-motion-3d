#!/usr/bin/env node
/**
 * Deterministic Anti-AI-Slop UI Linter (inspired by cesaroeduardo/antiwebslop & Vanszs/AntiSlopUI)
 * Scans web-studio/src and web-studio/index.html for common AI-generated UI clichés.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const TARGET_DIR = path.join(PROJECT_ROOT, "web-studio");

const RULES = [
  {
    id: "no-sparkles-icon",
    message: "Banned AI-slop icon (Sparkles / Wand2). Use concrete studio/hardware icons instead.",
    regex: /\b(Sparkles|Wand2|WandSparkles)\b/g,
  },
  {
    id: "no-default-indigo-purple",
    message: "Banned generic Tailwind indigo/violet/purple AI palette (#6366f1, #8b5cf6, #a855f7, #ec4899).",
    regex: /#(6366f1|4f46e5|8b5cf6|7c3aed|a855f7|9333ea|ec4899|06b6d4)\b/gi,
  },
  {
    id: "no-default-inter-font",
    message: "Banned generic default Inter font stack. Use intentional studio typography (Space Grotesk / Plus Jakarta Sans / JetBrains Mono).",
    regex: /["']Inter["']/g,
  },
  {
    id: "no-ambient-radial-glow",
    message: "Banned ambient radial-gradient glow blobs on dark backgrounds.",
    regex: /radial-gradient\(/gi,
  },
  {
    id: "no-glassmorphism-blur",
    message: "Banned gratuitous backdrop-filter glassmorphism blur.",
    regex: /backdrop-filter\s*:/gi,
  },
  {
    id: "no-neon-box-shadow",
    message: "Banned neon glowing colored box-shadow aura.",
    regex: /box-shadow\s*:[^;]*rgba\(\s*(16|99|139|6|168)\s*,/gi,
  },
  {
    id: "no-gradient-clipped-text",
    message: "Banned gradient-clipped headline text cliché.",
    regex: /-webkit-background-clip\s*:\s*text|background-clip\s*:\s*text/gi,
  },
];

function collectFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, out);
    } else if (/\.(tsx|ts|css|html)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const files = collectFiles(TARGET_DIR);
const violations = [];

for (const file of files) {
  const rel = path.relative(PROJECT_ROOT, file);
  const lines = fs.readFileSync(file, "utf-8").split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      rule.regex.lastIndex = 0;
      if (rule.regex.test(line)) {
        violations.push({ file: rel, line: i + 1, rule: rule.id, message: rule.message, snippet: line.trim() });
      }
    }
  });
}

if (violations.length > 0) {
  console.error(`\n[anti-slop] Found ${violations.length} AI-slop violation(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.rule}] ${v.message}`);
    console.error(`    > ${v.snippet}`);
  }
  console.error("");
  process.exit(1);
}

console.log(`[anti-slop] PASS — 0 AI-slop violations across ${files.length} studio UI file(s).`);
