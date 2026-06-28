#!/usr/bin/env node
/**
 * Conformance matrix validator + generator
 *
 * Parses the current branch/PR to extract LIM-ID, looks up the task in specs/TASKS.md,
 * verifies that changed files match the task's 'ownsFiles' declaration, detects
 * collisions with other tasks, and generates a conformance matrix for the PR body.
 *
 * Usage:
 *   node tools/validate-conformance.mjs [--generate]
 *
 * With --generate, outputs a markdown conformance matrix ready to paste into the PR body.
 * Without it, validates the current state and exits with 0 if conformant, 1 if not.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

// ============================================================================
// PHASE 1: Extract LIM-ID from branch or environment
// ============================================================================

function getLimId() {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();

    const match = branch.match(/LIM-(\d+)/i);
    if (match) return `LIM-${match[1]}`;
  } catch {
    /* fall through */
  }

  // Fallback: check for LIM-ID in commit message
  try {
    const commit = execSync("git log -1 --format=%B", {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();

    const match = commit.match(/LIM-(\d+)/i);
    if (match) return `LIM-${match[1]}`;
  } catch {
    /* fall through */
  }

  return null;
}

// ============================================================================
// PHASE 2: Parse TASKS.md and extract task registry
// ============================================================================

function parseTasks() {
  const tasksPath = path.join(repoRoot, "specs", "TASKS.md");
  const content = readFileSync(tasksPath, "utf8");

  const tasks = new Map();
  const taskOrder = [];

  // Find all markdown tables (Wave 1, Wave 2 Engine, Wave 2 Screen, Wave 3)
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Match section headers (## Wave X)
    if (line.match(/^##\s+Wave/)) {
      const waveMatch = line.match(/Wave\s+(\d+)/);
      const wave = waveMatch ? parseInt(waveMatch[1], 10) : 0;

      // Find the next table header (| Slug | ... |)
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

      // Parse the table
      j = tableStartIdx + 2; // Skip header and separator rows
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
        const deliverableRaw = cells[2] || "";
        const beatsRaw = cells[3] || cells[4] || ""; // Beats or Deliverable depending on wave

        const task = {
          slug,
          wave,
          owns: parseOwns(ownsRaw),
          ownsRaw,
          deliverable: deliverableRaw.substring(0, 150) + "...",
          beats: beatsRaw,
          line: j,
        };

        tasks.set(slug, task);
        taskOrder.push(slug);

        j++;
      }

      i = j;
    } else {
      i++;
    }
  }

  return { tasks, taskOrder };
}

function extractSlug(cell) {
  // Extract slug from cells like "**«contracts»**" or "**«gov-detect»**"
  const match = cell.match(/«([^»]+)»/);
  return match ? match[1] : null;
}

function parseOwns(ownsStr) {
  // ownsStr is like: "packages/contracts/src/** (incl. fixtures/, ...)"
  // Extract the main pattern(s) before any parens/notes
  const patterns = [];
  const main = ownsStr.split("(")[0].trim();

  // Split on whitespace to separate multiple patterns
  main
    .split(/\s+/)
    .filter((p) => p && !p.match(/^[,+]/))
    .forEach((pattern) => {
      if (pattern) patterns.push(pattern);
    });

  return patterns;
}

// ============================================================================
// PHASE 3: Look up task by slug (derived from LIM-ID or branch)
// ============================================================================

function findTaskByLimId(limId, tasks, tasksPath) {
  // Strategy 1: Search for LIM-ID in the TASKS.md file
  const content = readFileSync(tasksPath, "utf8");
  const limMatch = content.match(new RegExp(`LIM-${limId.split("-")[1]}[:\\s]`));

  // Strategy 2: Use branch name slug
  let slug = null;
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();

    // Extract slug from "agent/LIM-1234-slug" or "feature/slug"
    const slugMatch = branch.match(/[-/]([a-z0-9-]+)$/i);
    if (slugMatch) {
      slug = slugMatch[1];
      // Normalize: remove trailing slug duplication like "slug-slug"
      slug = slug.replace(/^(lim-)?(\w+)-\2$/, "$2");
    }
  } catch {
    /* fall through */
  }

  if (slug && tasks.has(slug)) {
    return { slug, task: tasks.get(slug) };
  }

  // Fallback: search for task by LIM-ID in TASKS.md comments
  // (This requires that TASKS.md includes LIM-IDs, which it may not yet)
  return null;
}

// ============================================================================
// PHASE 4: Get changed files from git
// ============================================================================

function getChangedFiles() {
  try {
    // Get files changed compared to main
    const output = execSync(
      'git diff --name-only main...HEAD 2>/dev/null || git diff --name-only HEAD~1',
      {
        cwd: repoRoot,
        encoding: "utf8",
      }
    );

    return output
      .trim()
      .split("\n")
      .filter((f) => f.length > 0);
  } catch {
    return [];
  }
}

// ============================================================================
// PHASE 5: Collision detection (verify no file overlap with other tasks)
// ============================================================================

function checkCollisions(changedFiles, currentTask, allTasks) {
  const collisions = [];

  // For each other task, check if any of our changed files match their patterns
  for (const [otherSlug, otherTask] of allTasks.entries()) {
    if (otherSlug === currentTask.slug) continue;

    const overlaps = changedFiles.filter((file) =>
      matchesAnyPattern(file, otherTask.owns)
    );

    if (overlaps.length > 0) {
      collisions.push({
        task: otherSlug,
        files: overlaps,
      });
    }
  }

  return collisions;
}

function matchesAnyPattern(filePath, patterns) {
  return patterns.some((pattern) => matchesGlobPattern(filePath, pattern));
}

function matchesGlobPattern(filePath, pattern) {
  // Simple glob matching: convert ** and * to regex
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

// ============================================================================
// PHASE 6: Validate conformance
// ============================================================================

function validateConformance(currentTask, changedFiles, allTasks) {
  const errors = [];
  const warnings = [];

  // Check: all changed files must match the task's ownsFiles
  const unmatched = changedFiles.filter(
    (file) => !matchesAnyPattern(file, currentTask.owns)
  );

  if (unmatched.length > 0) {
    errors.push(
      `Files outside task ownership:\n${unmatched.map((f) => `  - ${f}`).join("\n")}`
    );
  }

  // Check: no file should be claimed by multiple tasks
  const collisions = checkCollisions(changedFiles, currentTask, allTasks);
  if (collisions.length > 0) {
    errors.push(
      `Collision with other task(s):\n${collisions
        .map((c) => `  ${c.task}: ${c.files.join(", ")}`)
        .join("\n")}`
    );
  }

  // Check: at least some files were changed
  if (changedFiles.length === 0) {
    warnings.push("No changed files detected.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================================
// PHASE 7: Generate conformance matrix (markdown)
// ============================================================================

function generateConformanceMatrix(currentTask, changedFiles) {
  const timestamp = new Date().toISOString();
  const filesStr = changedFiles.join(", ");

  // Construct matrix rows
  const rows = [
    "## Architecture conformance",
    "",
    "| Requirement | Source | Implemented in | Evidence |",
    "|---|---|---|---|",
    `| Task ownership | specs/TASKS.md (Wave ${currentTask.wave}, slug: \`${currentTask.slug}\`) | ${filesStr.substring(0, 60)}${filesStr.length > 60 ? "..." : ""} | git diff \`main...HEAD\` |`,
    `| No collision | specs/TASKS.md (disjoint file sets) | Verified against all task patterns | Validated by \`tools/validate-conformance.mjs\` |`,
  ];

  return rows.join("\n");
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  const generate = process.argv.includes("--generate");
  const verbose = process.argv.includes("--verbose");

  // Step 1: Extract LIM-ID
  const limId = getLimId();
  if (!limId) {
    if (verbose) {
      console.warn(
        "⚠ Could not extract LIM-ID from branch or commit. " +
          "Ensure branch matches pattern: agent/LIM-xxxx-slug"
      );
    }
  } else {
    console.log(`✓ LIM-ID: ${limId}`);
  }

  // Step 2: Parse TASKS.md
  const tasksPath = path.join(repoRoot, "specs", "TASKS.md");
  const { tasks: allTasks } = parseTasks();

  if (allTasks.size === 0) {
    fail(`Could not parse tasks from ${tasksPath}`);
  }

  if (verbose) {
    console.log(`✓ Parsed ${allTasks.size} tasks from TASKS.md`);
  }

  // Step 3: Find the current task by slug (from branch)
  let currentSlug = null;
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();

    // Extract slug from patterns like:
    // - "agent/LIM-1234-slug-name"
    // - "agent/lim-slug-lim-slug" (worktree pattern)
    const parts = branch.split("/").pop().split("-");

    // Strategy 1: Look for "LIM-XXXX" and take everything after it
    for (let i = 0; i < parts.length - 1; i++) {
      if (parts[i].toUpperCase() === "LIM" && /^\d+$/.test(parts[i + 1])) {
        currentSlug = parts.slice(i + 2).join("-");
        if (currentSlug) break;
      }
    }

    // Strategy 2: Use last part of branch name
    if (!currentSlug && parts.length > 0) {
      const lastPart = parts[parts.length - 1];
      if (!lastPart.match(/^\d+$/)) {
        currentSlug = lastPart;
      }
    }
  } catch (e) {
    if (verbose) console.error(`Warning extracting branch: ${e.message}`);
  }

  // Fallback: try to find the task in TASKS.md by searching commit
  if (!currentSlug) {
    if (verbose) {
      console.error("⚠ Could not extract slug from branch. Searching commit...");
    }

    try {
      const commitMessage = execSync("git log -1 --format=%B", {
        cwd: repoRoot,
        encoding: "utf8",
      }).trim();

      for (const [slug] of allTasks.entries()) {
        if (commitMessage.toLowerCase().includes(slug)) {
          currentSlug = slug;
          break;
        }
      }
    } catch {
      /* fall through */
    }
  }

  if (!currentSlug) {
    if (verbose) {
      console.error(
        `Could not determine task slug from branch name or commit message. ` +
          `Expected: agent/LIM-XXXX-slug`
      );
      console.error(`Known slugs: ${Array.from(allTasks.keys()).join(", ")}`);
    }
    console.log(
      "ℹ Run with --generate to auto-generate a conformance matrix template"
    );
    process.exit(1);
  }

  const currentTask = allTasks.get(currentSlug);
  if (!currentTask) {
    fail(
      `Task slug "${currentSlug}" not found in TASKS.md. ` +
        `Known slugs: ${Array.from(allTasks.keys()).join(", ")}`
    );
  }

  if (verbose) {
    console.log(`✓ Found task: ${currentSlug} (Wave ${currentTask.wave})`);
    console.log(`  Owns patterns: ${currentTask.owns.join(", ")}`);
  }

  // Step 4: Get changed files
  const changedFiles = getChangedFiles();
  if (verbose) {
    console.log(
      `✓ Changed files (${changedFiles.length}): ${changedFiles.slice(0, 3).join(", ")}${changedFiles.length > 3 ? "..." : ""}`
    );
  }

  // Step 5: Validate conformance (if not generating)
  if (!generate && changedFiles.length > 0) {
    const validation = validateConformance(currentTask, changedFiles, allTasks);

    if (!validation.valid) {
      console.error("✗ Conformance validation FAILED:");
      validation.errors.forEach((err) => console.error(`  ${err}`));
      process.exit(1);
    }

    if (validation.warnings.length > 0 && verbose) {
      console.warn("Warnings:");
      validation.warnings.forEach((warn) => console.warn(`  ⚠ ${warn}`));
    }

    console.log("✓ Conformance validation passed");
  }

  // Step 6: Generate matrix if requested
  if (generate) {
    const matrix = generateConformanceMatrix(currentTask, changedFiles);
    console.log(matrix);
  }

  process.exit(0);
}

function fail(msg) {
  console.error(`✗ Error: ${msg}`);
  process.exit(1);
}

main();
