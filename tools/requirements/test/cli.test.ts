/**
 * CLI tests — `runRequirementsCli` over injected stdout/stderr/cwd (no real process
 * streams), asserting exit codes, that stdout carries ONLY bundle JSON, and that
 * errors are explicit on stderr.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRequirementsCli, type CliDeps } from "../cli.ts";
import { evidenceBundleContract } from "../src/contracts.ts";
import { ACME_REAL_DIR, ONE_CUE_VTT, scratchDir } from "./helpers.ts";

function harness(cwd = process.cwd()): { deps: CliDeps; out: () => string; err: () => string } {
  let outBuf = "";
  let errBuf = "";
  const deps: CliDeps = {
    stdout: { write: (c: string | Uint8Array) => ((outBuf += String(c)), true) },
    stderr: { write: (c: string | Uint8Array) => ((errBuf += String(c)), true) },
    cwd,
  };
  return { deps, out: () => outBuf, err: () => errBuf };
}

test("help (and no args) prints usage and returns 0", () => {
  const h = harness();
  assert.equal(runRequirementsCli(["help"], h.deps), 0);
  assert.match(h.out(), /requirements — ingest real source material/);
  const h2 = harness();
  assert.equal(runRequirementsCli([], h2.deps), 0);
  assert.match(h2.out(), /USAGE/);
});

test("ingest <examples/acme-real> writes ONLY valid bundle JSON to stdout, summary to stderr", () => {
  const h = harness();
  const code = runRequirementsCli(["ingest", ACME_REAL_DIR], h.deps);
  assert.equal(code, 0);
  const bundle = JSON.parse(h.out()); // stdout must be pure JSON
  assert.deepEqual(evidenceBundleContract.parse(bundle), bundle);
  assert.equal(bundle.id, "eb_acme_real");
  assert.match(h.err(), /ingested 7 source\(s\)/); // human summary on stderr only
});

test("fixture command emits the deterministic fallback bundle", () => {
  const h = harness();
  assert.equal(runRequirementsCli(["fixture"], h.deps), 0);
  const bundle = JSON.parse(h.out());
  assert.equal(bundle.id, "eb_acme_eu_residency");
  assert.deepEqual(evidenceBundleContract.parse(bundle), bundle);
});

test("ingest with failures returns 1, lists failures on stderr, emits NOTHING on stdout", () => {
  const s = scratchDir();
  try {
    s.file("manifest.json", JSON.stringify({ dealId: "d" }));
    s.file("slack/broken.slack.json", "{ broken");
    const h = harness();
    const code = runRequirementsCli(["ingest", s.dir], h.deps);
    assert.equal(code, 1);
    assert.equal(h.out(), "");
    assert.match(h.err(), /no file was silently dropped/);
  } finally {
    s.cleanup();
  }
});

test("ingest --skip-errors returns 0 and reports failures on stderr", () => {
  const s = scratchDir();
  try {
    s.file("manifest.json", JSON.stringify({ dealId: "d" }));
    s.file("calls/c.vtt", ONE_CUE_VTT);
    s.file("slack/broken.slack.json", "{ broken");
    const h = harness();
    assert.equal(runRequirementsCli(["ingest", s.dir, "--skip-errors"], h.deps), 0);
    assert.match(h.err(), /FAILURES \(reported, not dropped\)/);
    assert.ok(JSON.parse(h.out()).sources.length === 1);
  } finally {
    s.cleanup();
  }
});

test("ingest missing scope returns 1 with an explicit message", () => {
  const s = scratchDir();
  try {
    s.file("calls/c.vtt", ONE_CUE_VTT);
    const h = harness();
    assert.equal(runRequirementsCli(["ingest", s.dir], h.deps), 1);
    assert.match(h.err(), /must be scoped/);
  } finally {
    s.cleanup();
  }
});

test("ingest --out writes the bundle to a file (stdout stays empty)", () => {
  const s = scratchDir();
  const outFile = join(tmpdir(), `lim1333-out-${Date.now()}.json`);
  try {
    s.file("manifest.json", JSON.stringify({ dealId: "d" }));
    s.file("calls/c.vtt", ONE_CUE_VTT);
    const h = harness();
    assert.equal(runRequirementsCli(["ingest", s.dir, "--out", outFile], h.deps), 0);
    assert.equal(h.out(), "");
    const written = JSON.parse(readFileSync(outFile, "utf8"));
    assert.deepEqual(evidenceBundleContract.parse(written), written);
  } finally {
    s.cleanup();
    rmSync(outFile, { force: true });
  }
});

test("--fallback-fixture emits the fixture for an empty folder but NOT when a file fails", () => {
  const empty = scratchDir();
  const broken = scratchDir();
  try {
    // empty (only manifest) -> fixture fallback
    empty.file("manifest.json", JSON.stringify({ dealId: "d" }));
    const h1 = harness();
    assert.equal(runRequirementsCli(["ingest", empty.dir, "--fallback-fixture"], h1.deps), 0);
    assert.equal(JSON.parse(h1.out()).id, "eb_acme_eu_residency");
    assert.match(h1.err(), /emitting fixture fallback/);

    // a broken file present -> still fails, fixture must NOT mask it
    broken.file("manifest.json", JSON.stringify({ dealId: "d" }));
    broken.file("slack/b.slack.json", "nope");
    const h2 = harness();
    assert.equal(runRequirementsCli(["ingest", broken.dir, "--fallback-fixture"], h2.deps), 1);
    assert.equal(h2.out(), "");
  } finally {
    empty.cleanup();
    broken.cleanup();
  }
});

test("unknown command and unknown flag return usage exit code 2", () => {
  const h1 = harness();
  assert.equal(runRequirementsCli(["frobnicate"], h1.deps), 2);
  const h2 = harness();
  assert.equal(runRequirementsCli(["ingest", "x", "--bogus"], h2.deps), 2);
  const h3 = harness();
  assert.equal(runRequirementsCli(["ingest"], h3.deps), 2); // missing dir
});

test("--compact emits single-line JSON", () => {
  const h = harness();
  runRequirementsCli(["fixture", "--compact"], h.deps);
  assert.equal(h.out().trim().split("\n").length, 1);
});
