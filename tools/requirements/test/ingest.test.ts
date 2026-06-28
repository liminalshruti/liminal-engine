/**
 * Ingest orchestrator tests — the AC3 backbone: explicit errors, fail-closed by
 * default, never silently dropping a file. Also covers scope resolution, manifest
 * vs flags precedence, directory-convention routing, and determinism.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  IngestFailedError,
  MissingScopeError,
  NoSourcesError,
  NotADirectoryError,
  ParseError,
  UnclassifiedFileError,
} from "../src/errors.ts";
import { ingestFolder } from "../src/ingest.ts";
import { evidenceBundleContract } from "../src/contracts.ts";
import { ONE_CUE_VTT, scratchDir } from "./helpers.ts";

test("not-a-directory target -> NotADirectoryError", () => {
  assert.throws(() => ingestFolder("/no/such/dir/here", { dealId: "d" }), NotADirectoryError);
});

test("missing scope (no manifest, no flags) -> MissingScopeError", () => {
  const s = scratchDir();
  try {
    s.file("calls/c.vtt", ONE_CUE_VTT);
    assert.throws(() => ingestFolder(s.dir), MissingScopeError);
  } finally {
    s.cleanup();
  }
});

test("scope from flags works; flags override manifest", () => {
  const s = scratchDir();
  try {
    s.file("manifest.json", JSON.stringify({ goalId: "goal_manifest", dealId: "deal_manifest" }));
    s.file("calls/c.vtt", ONE_CUE_VTT);
    const { bundle } = ingestFolder(s.dir, { goalId: "goal_flag" });
    assert.equal(bundle.goalId, "goal_flag"); // flag wins
    assert.equal(bundle.dealId, "deal_manifest"); // manifest fills the rest
  } finally {
    s.cleanup();
  }
});

test("directory-convention routing classifies all type folders without per-file hints", () => {
  const s = scratchDir();
  try {
    s.file("manifest.json", JSON.stringify({ dealId: "d" }));
    s.file("calls/c.vtt", ONE_CUE_VTT);
    s.file("proposals/p.md", "# A\n\nbody\n");
    s.file("sow/s.md", "# A\n\nbody\n");
    s.file("emails/e.eml", "From: a@b\nSubject: s\n\nbody\n");
    s.file("slack/x.slack.json", JSON.stringify([{ ts: "1", text: "hi" }]));
    s.file("linear/x.linear.json", JSON.stringify({ issues: [{ identifier: "Z-1", title: "t" }] }));
    s.file("agent/a.agent.json", JSON.stringify({ agentOutputId: "ao_1", report: "r" }));
    const { bundle, report } = ingestFolder(s.dir);
    assert.equal(report.failures.length, 0);
    assert.equal(bundle.sources.length, 7);
    assert.deepEqual(evidenceBundleContract.parse(bundle), bundle);
  } finally {
    s.cleanup();
  }
});

test("FAIL-CLOSED: any file failure aborts with EVERY failure listed, no bundle", () => {
  const s = scratchDir();
  try {
    s.file("manifest.json", JSON.stringify({ dealId: "d" }));
    s.file("calls/good.vtt", ONE_CUE_VTT);
    s.file("slack/broken.slack.json", "{ not json");
    s.file("mystery/notes.xyz", "unclassifiable");
    let err: unknown;
    try {
      ingestFolder(s.dir);
    } catch (e) {
      err = e;
    }
    assert.ok(err instanceof IngestFailedError, "expected IngestFailedError");
    assert.equal(err.failures.length, 2);
    assert.ok(err.failures.some((f) => f instanceof ParseError));
    assert.ok(err.failures.some((f) => f instanceof UnclassifiedFileError));
    assert.match(err.message, /no file was silently dropped/);
  } finally {
    s.cleanup();
  }
});

test("--skip-errors: emits good sources but STILL reports every failure (not dropped)", () => {
  const s = scratchDir();
  try {
    s.file("manifest.json", JSON.stringify({ dealId: "d" }));
    s.file("calls/good.vtt", ONE_CUE_VTT);
    s.file("slack/broken.slack.json", "{ not json");
    const { bundle, report } = ingestFolder(s.dir, { skipErrors: true });
    assert.equal(bundle.sources.length, 1);
    assert.equal(report.failures.length, 1);
    assert.ok(report.failures[0] instanceof ParseError);
  } finally {
    s.cleanup();
  }
});

test("a folder with zero ingestible sources -> NoSourcesError", () => {
  const s = scratchDir();
  try {
    s.file("manifest.json", JSON.stringify({ dealId: "d" }));
    s.file("README.md", "ignored");
    assert.throws(() => ingestFolder(s.dir), NoSourcesError);
  } finally {
    s.cleanup();
  }
});

test("DETERMINISTIC: re-ingest of a scratch folder is byte-identical", () => {
  const s = scratchDir();
  try {
    s.file("manifest.json", JSON.stringify({ dealId: "d", capturedAt: "2026-06-27T09:30:00.000Z" }));
    s.file("calls/c.vtt", ONE_CUE_VTT);
    s.file("agent/a.agent.json", JSON.stringify({ agentOutputId: "ao_1", report: "r1\nr2" }));
    const a = ingestFolder(s.dir);
    const b = ingestFolder(s.dir);
    assert.deepEqual(a.bundle, b.bundle);
    assert.equal(evidenceBundleContract.hash(a.bundle), evidenceBundleContract.hash(b.bundle));
  } finally {
    s.cleanup();
  }
});

test("manifest per-file type override routes an otherwise-unclassifiable file", () => {
  const s = scratchDir();
  try {
    s.file(
      "manifest.json",
      JSON.stringify({ dealId: "d", sources: { "notes.txt": { type: "proposal", title: "Notes" } } }),
    );
    s.file("notes.txt", "# Heading\n\nbody\n");
    const { bundle } = ingestFolder(s.dir);
    assert.equal(bundle.sources.length, 1);
    assert.equal(bundle.sources[0]!.sourceType, "proposal");
    assert.equal(bundle.sources[0]!.title, "Notes");
  } finally {
    s.cleanup();
  }
});

test("an invalid manifest type override is itself an explicit failure", () => {
  const s = scratchDir();
  try {
    s.file("manifest.json", JSON.stringify({ dealId: "d", sources: { "notes.txt": { type: "bogus" } } }));
    s.file("notes.txt", "x");
    assert.throws(() => ingestFolder(s.dir), IngestFailedError);
  } finally {
    s.cleanup();
  }
});
