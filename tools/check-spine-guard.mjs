#!/usr/bin/env node
/**
 * CI gate: SPINE GUARD — the demo's must-not-cut invariants cannot silently erode.
 *
 * The whole product is about catching a FALSE GREEN. The worst regression is a PR
 * that quietly deletes/skips the assertions proving the 14-beat path + 7 must-not-cut
 * items, so CI goes green while the demo's proof rots. This guard makes that loud.
 *
 * Checks (mechanical, judgment-free — the reviewer agents are the second layer):
 *   1. The locked e2e (apps/desktop-demo/test/demo-path.e2e.test.ts) still asserts
 *      all 14 beats (#1..#14) and all 7 must-not-cut ids (MNC#1..#7 / "must-not-cut #N").
 *   2. No test in the spine packages/app is skipped or marked todo
 *      (node:test { skip } / { todo } / test.skip / it.skip) — a skipped MNC test is a
 *      false green by definition.
 *
 * Exit non-zero with a precise message if either invariant is broken.
 * Usage: node tools/check-spine-guard.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const E2E = "apps/desktop-demo/test/demo-path.e2e.test.ts";
let failed = false;

// ── 1. e2e still covers all 14 beats + 7 MNC ─────────────────────
if (!existsSync(E2E)) {
  console.error(`✗ spine-guard: the locked e2e is missing (${E2E}). The 14-beat proof must exist.`);
  process.exit(1);
}
const e2e = readFileSync(E2E, "utf8");

const missingBeats = [];
for (let n = 1; n <= 14; n++) {
  // match "beat #N" anywhere (test titles use "beat #N — ...")
  if (!new RegExp(`beat #${n}\\b`).test(e2e)) missingBeats.push(n);
}
if (missingBeats.length) {
  console.error(`✗ spine-guard: e2e no longer references beat(s) ${missingBeats.map((n) => `#${n}`).join(", ")} — the 14-beat path must stay fully asserted.`);
  failed = true;
} else {
  console.log("✓ spine-guard: all 14 beats referenced in the e2e.");
}

const missingMnc = [];
for (let n = 1; n <= 7; n++) {
  // accept either "MNC#N" or "must-not-cut #N"
  if (!new RegExp(`(MNC#${n}\\b|must-not-cut #${n}\\b)`, "i").test(e2e)) missingMnc.push(n);
}
if (missingMnc.length) {
  console.error(`✗ spine-guard: e2e no longer asserts must-not-cut item(s) ${missingMnc.map((n) => `#${n}`).join(", ")} — every MNC must stay proven on screen.`);
  failed = true;
} else {
  console.log("✓ spine-guard: all 7 must-not-cut items asserted in the e2e.");
}

// ── 2. no skipped/todo tests in spine packages or the app ────────
// (a skipped must-not-cut test passes CI while proving nothing.)
let files = [];
try {
  files = execSync('git ls-files "packages/**/*.test.ts" "apps/**/*.test.ts"', { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
} catch {
  // fallback: glob-less environments — skip this sub-check rather than false-fail
  console.log("⚠ spine-guard: could not enumerate test files via git; skip/todo sub-check skipped.");
}

const SKIP_PATTERNS = [
  /\.skip\s*\(/, // test.skip( / it.skip(
  /\.todo\s*\(/,
  /\{\s*skip\s*:/, // node:test { skip: true/"reason" }
  /\{\s*todo\s*:/,
];
const skipped = [];
for (const f of files) {
  let src;
  try {
    src = readFileSync(f, "utf8");
  } catch {
    continue;
  }
  if (SKIP_PATTERNS.some((re) => re.test(src))) skipped.push(f);
}
if (skipped.length) {
  console.error(
    `✗ spine-guard: skipped/todo tests found — a skipped test is a false green:\n` +
      skipped.map((f) => `   ${f}`).join("\n") +
      `\n   Remove the skip/todo or fix the test. (If a screen-stub genuinely isn't built, that's a build gap, not a skip.)`,
  );
  failed = true;
} else if (files.length) {
  console.log(`✓ spine-guard: no skipped/todo tests across ${files.length} spine/app test files.`);
}

if (failed) process.exit(1);
console.log("✓ spine-guard: demo invariants intact (14 beats · 7 MNC · no skipped tests).");
process.exit(0);
