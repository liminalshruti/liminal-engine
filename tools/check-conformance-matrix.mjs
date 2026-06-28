#!/usr/bin/env node
/**
 * CI gate: a PR must contain a FILLED "Architecture conformance" matrix.
 *
 * This is what makes the matrix non-advisory: a PR body with a missing or
 * empty/placeholder table fails CI. Reads the PR body from $PR_BODY (set in the
 * GitHub Actions workflow from github.event.pull_request.body).
 *
 * Usage: PR_BODY="$(cat body.md)" node tools/check-conformance-matrix.mjs
 *        node tools/check-conformance-matrix.mjs path/to/body.md
 */

import { readFileSync } from "node:fs";

function loadBody() {
  if (process.env.PR_BODY) return process.env.PR_BODY;
  const path = process.argv[2];
  if (path) return readFileSync(path, "utf8");
  return "";
}

const body = loadBody();
if (!body.trim()) {
  fail("No PR body found (set $PR_BODY or pass a file path).");
}

// Find the "Architecture conformance" section heading.
const lines = body.split("\n");
const headingIdx = lines.findIndex((l) => /^#{1,6}\s+architecture conformance/i.test(l.trim()));
if (headingIdx === -1) {
  fail('PR body is missing a "## Architecture conformance" section.');
}

// Collect the markdown table rows after the heading (until the next heading).
const section = [];
for (let i = headingIdx + 1; i < lines.length; i++) {
  if (/^#{1,6}\s/.test(lines[i].trim())) break;
  section.push(lines[i]);
}

const tableRows = section.filter((l) => l.trim().startsWith("|"));
// A valid table = header row + separator (---) + >=1 data row.
const separatorIdx = tableRows.findIndex((l) => /^\|[\s:|-]+\|?\s*$/.test(l.trim()));
const dataRows = separatorIdx === -1 ? [] : tableRows.slice(separatorIdx + 1);

const filledDataRows = dataRows.filter((row) => {
  const cells = row.split("|").slice(1, -1).map((c) => c.trim());
  // Require the first 4 cells (Requirement, Source, Implemented in, Test/evidence)
  // to be present and non-placeholder.
  const meaningful = cells.slice(0, 4).filter((c) => c.length > 0 && !/^[-—_ ]*$/.test(c));
  return meaningful.length >= 4;
});

if (filledDataRows.length === 0) {
  fail(
    "Architecture conformance matrix is present but has no filled data rows " +
      "(need Requirement + Source + Implemented in + Test/evidence). " +
      "Empty matrices are not allowed — map each requirement to files and tests.",
  );
}

console.log(`✓ conformance matrix OK — ${filledDataRows.length} filled requirement row(s).`);
process.exit(0);

function fail(msg) {
  console.error(`✗ conformance check failed: ${msg}`);
  process.exit(1);
}
