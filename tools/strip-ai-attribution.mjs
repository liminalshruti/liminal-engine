#!/usr/bin/env node
/**
 * Strip AI/Claude attribution from a commit message file.
 *
 * Wired as a lefthook `commit-msg` hook so commits are authored as the user only
 * (allsmog) — see AGENTS.md Hard Rule #1. Self-contained so it works even in
 * clones where the global commit-msg hook isn't installed.
 *
 * Usage: node tools/strip-ai-attribution.mjs <path-to-commit-msg-file>
 */

import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("strip-ai-attribution: no commit message file path given");
  process.exit(0); // never block a commit on a wiring mistake
}

const PATTERNS = [
  /co-authored-by:.*claude/i,
  /co-authored-by:.*anthropic/i,
  /co-authored-by:.*noreply@anthropic/i,
  /generated with .*claude/i,
  /generated with \[claude code\]/i,
  /🤖 generated with/i,
];

try {
  const original = readFileSync(file, "utf8");
  const kept = original
    .split("\n")
    .filter((line) => !PATTERNS.some((re) => re.test(line)))
    .join("\n");
  if (kept !== original) writeFileSync(file, kept);
} catch (err) {
  console.error(`strip-ai-attribution: ${err.message}`);
}
process.exit(0);
