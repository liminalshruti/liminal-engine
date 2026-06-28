#!/usr/bin/env node
/**
 * CI gate: branch name or PR title must carry a Linear issue ID (e.g. HACK-123),
 * so Linear can auto-link the PR/commits back to the issue and the task is
 * traceable to its spec.
 *
 * Reads $BRANCH (e.g. github head_ref) and $PR_TITLE. Passes if EITHER contains
 * a Linear-style ID. Blocked PRs (title starts with "BLOCKED:") are allowed to
 * pass this gate but are flagged.
 *
 * Usage: BRANCH="agent/HACK-12-foo" PR_TITLE="HACK-12: foo" node tools/check-linear-id.mjs
 */

const branch = process.env.BRANCH ?? process.argv[2] ?? "";
const title = process.env.PR_TITLE ?? process.argv[3] ?? "";

const LINEAR_ID = /\b[A-Z][A-Z0-9]{1,9}-\d+\b/;

const found = LINEAR_ID.exec(branch) || LINEAR_ID.exec(title);

if (/^BLOCKED:/i.test(title.trim()) && found) {
  console.log(`⚠ blocked PR detected (${found[0]}) — allowed, but must not be merged as-is.`);
  process.exit(0);
}

if (!found) {
  console.error(
    "✗ linear-id check failed: no Linear issue ID (e.g. HACK-123) in the branch name or PR title.\n" +
      `   branch:  "${branch}"\n` +
      `   title:   "${title}"\n` +
      "   Name branches like agent/HACK-123-short-desc or title PRs 'HACK-123: ...'.",
  );
  process.exit(1);
}

console.log(`✓ linear-id OK — ${found[0]}`);
process.exit(0);
