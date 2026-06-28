#!/usr/bin/env node
/**
 * Unit tests for validate-conformance.mjs
 *
 * Tests the TASKS.md parser, pattern matching, and collision detection.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

// Copy the utility functions from validate-conformance.mjs for testing
function extractSlug(cell) {
  const match = cell.match(/«([^»]+)»/);
  return match ? match[1] : null;
}

function parseOwns(ownsStr) {
  const patterns = [];
  const main = ownsStr.split("(")[0].trim();
  main
    .split(/\s+/)
    .filter((p) => p && !p.match(/^[,+]/))
    .forEach((pattern) => {
      if (pattern) patterns.push(pattern);
    });
  return patterns;
}

function matchesGlobPattern(filePath, pattern) {
  let regexStr = pattern.replace(/\./g, "\\.");

  // Handle ** (matches any depth including /)
  // But we need to do this before * to avoid double-processing
  regexStr = regexStr.replace(/\*\*/g, "___DOUBLESTAR___");
  // Handle * (matches anything except /)
  regexStr = regexStr.replace(/\*/g, "[^/]*");
  // Replace the placeholder
  regexStr = regexStr.replace(/___DOUBLESTAR___/g, ".*");

  const regex = new RegExp("^" + regexStr + "$");
  return regex.test(filePath);
}

function matchesAnyPattern(filePath, patterns) {
  return patterns.some((pattern) => matchesGlobPattern(filePath, pattern));
}

function parseTasks() {
  const tasksPath = path.join(repoRoot, "specs", "TASKS.md");
  const content = readFileSync(tasksPath, "utf8");

  const tasks = new Map();

  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.match(/^##\s+Wave/)) {
      const waveMatch = line.match(/Wave\s+(\d+)/);
      const wave = waveMatch ? parseInt(waveMatch[1], 10) : 0;

      let j = i + 1;
      let tableStartIdx = -1;
      while (j < lines.length && j < i + 50) {
        if (lines[j].trim().startsWith("|") && lines[j].includes("Slug")) {
          tableStartIdx = j;
          break;
        }
        j++;
      }

      if (tableStartIdx === -1) {
        i++;
        continue;
      }

      j = tableStartIdx + 2;
      while (j < lines.length) {
        const row = lines[j].trim();
        if (!row.startsWith("|")) break;

        const cells = row
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());

        if (cells.length < 2) {
          j++;
          continue;
        }

        const slug = extractSlug(cells[0]);
        if (!slug) {
          j++;
          continue;
        }

        const ownsRaw = cells[1];
        const task = {
          slug,
          wave,
          owns: parseOwns(ownsRaw),
          ownsRaw,
        };

        tasks.set(slug, task);
        j++;
      }

      i = j;
    } else {
      i++;
    }
  }

  return tasks;
}

// ============================================================================
// TESTS
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
    testsFailed++;
  }
}

// Test 1: Slug extraction
test("Extract slug from cell", () => {
  assert.equal(extractSlug("**«contracts»**"), "contracts");
  assert.equal(extractSlug("**«gov-detect»**"), "gov-detect");
  assert.equal(extractSlug("**«screen-initialize»**"), "screen-initialize");
  assert.equal(extractSlug("invalid"), null);
});

// Test 2: Owns pattern parsing
test("Parse owns patterns", () => {
  const result1 = parseOwns("packages/contracts/src/** (incl. fixtures/)");
  assert.deepEqual(result1, ["packages/contracts/src/**"]);

  // Note: braces patterns like {a,b} are treated as single tokens by split(/\s+/)
  const result2 = parseOwns("packages/governance/src/{ports.ts, index.ts}");
  assert.ok(result2.length > 0);
  assert.ok(result2.some((p) => p.includes("governance")));

  const result3 = parseOwns("`packages/governance/src/detect-miss.ts` (+test)");
  assert.ok(result3.length > 0);
});

// Test 3: Glob pattern matching
test("Match glob patterns - exact file", () => {
  assert.ok(matchesGlobPattern("packages/contracts/src/index.ts", "packages/contracts/src/index.ts"));
  assert.ok(!matchesGlobPattern("packages/contracts/src/other.ts", "packages/contracts/src/index.ts"));
});

test("Match glob patterns - single wildcard", () => {
  assert.ok(matchesGlobPattern("packages/contracts/src/index.ts", "packages/contracts/src/*.ts"));
  assert.ok(matchesGlobPattern("packages/contracts/src/foo.ts", "packages/contracts/src/*.ts"));
  assert.ok(!matchesGlobPattern("packages/contracts/src/dir/index.ts", "packages/contracts/src/*.ts"));
});

test("Match glob patterns - double wildcard", () => {
  assert.ok(matchesGlobPattern("packages/contracts/src/index.ts", "packages/contracts/src/**"));
  assert.ok(matchesGlobPattern("packages/contracts/src/fixtures/foo.ts", "packages/contracts/src/**"));
  assert.ok(matchesGlobPattern("packages/contracts/src/fixtures/deep/foo.ts", "packages/contracts/src/**"));
  assert.ok(!matchesGlobPattern("packages/other/src/index.ts", "packages/contracts/src/**"));
});

// Test 4: Pattern matching against multiple patterns
test("Match any pattern", () => {
  const patterns = ["packages/governance/src/detect-miss.ts", "packages/governance/src/detect-miss.test.ts"];
  assert.ok(matchesAnyPattern("packages/governance/src/detect-miss.ts", patterns));
  assert.ok(matchesAnyPattern("packages/governance/src/detect-miss.test.ts", patterns));
  assert.ok(!matchesAnyPattern("packages/governance/src/other.ts", patterns));
});

// Test 5: Parse TASKS.md
test("Parse TASKS.md and find tasks", () => {
  const tasks = parseTasks();
  assert.ok(tasks.size > 0, "Should parse at least one task");

  // Verify some known tasks exist
  assert.ok(tasks.has("contracts"), "Should find 'contracts' task");
  assert.ok(tasks.has("gov-detect"), "Should find 'gov-detect' task");
  assert.ok(tasks.has("screen-initialize"), "Should find 'screen-initialize' task");

  // Verify contracts task has correct wave
  assert.equal(tasks.get("contracts").wave, 1);

  // Verify gov-detect is wave 2
  assert.equal(tasks.get("gov-detect").wave, 2);
});

test("Parsed tasks have valid ownership patterns", () => {
  const tasks = parseTasks();

  // Verify contracts task owns patterns
  const contractsTask = tasks.get("contracts");
  assert.ok(contractsTask.owns.length > 0);
  assert.ok(
    contractsTask.owns.some((p) => p.includes("packages/contracts")),
    "contracts should own patterns under packages/contracts"
  );

  // Verify gov-detect task owns patterns
  const govDetectTask = tasks.get("gov-detect");
  assert.ok(govDetectTask.owns.length > 0);
  assert.ok(
    govDetectTask.owns.some((p) => p.includes("detect-miss")),
    "gov-detect should own detect-miss file"
  );
});

test("Wave 2 screens own their respective files", () => {
  const tasks = parseTasks();

  const screenInitialize = tasks.get("screen-initialize");
  assert.ok(screenInitialize);
  assert.ok(screenInitialize.owns.some((p) => p.includes("Initialize")));

  const screenGovernanceCase = tasks.get("screen-governance-case");
  assert.ok(screenGovernanceCase);
  assert.ok(screenGovernanceCase.owns.some((p) => p.includes("GovernanceCase")));
});

// ============================================================================
// SUMMARY
// ============================================================================

console.log("");
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log("✓ All tests passed");
  process.exit(0);
}
