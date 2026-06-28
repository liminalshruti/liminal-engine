/**
 * Headline acceptance test (LIM-1333) — ingest the committed `examples/acme-real/`
 * folder and prove every acceptance criterion against a REAL local folder:
 *
 *   AC1  `requirements ingest ./examples/acme-real/` produces an EvidenceBundle JSON
 *        (here: `ingestFolder` returns a bundle the OWNING contract validates).
 *   AC2  every chunk has stable source refs (sourceId / sourceType / span / hash).
 *   AC3  parser errors are explicit (covered in ingest.test.ts / cli.test.ts).
 *   AC4  fixture fallback remains available (covered in fixture.test.ts).
 *
 * Plus the cross-cutting product rules: DETERMINISTIC (re-run is byte-identical) and
 * the data boundary (no raw source text survives into the durable bundle).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { evidenceBundleContract, evidenceSourceType } from "../src/contracts.ts";
import { ingestFolder } from "../src/ingest.ts";
import { ACME_REAL_DIR } from "./helpers.ts";

const { bundle, report } = ingestFolder(ACME_REAL_DIR);

test("AC1: ingesting examples/acme-real produces a contract-valid EvidenceBundle", () => {
  // round-trips through the OWNING contract (referential integrity, scope, hashes…)
  assert.deepEqual(evidenceBundleContract.parse(bundle), bundle);
  assert.equal(bundle.id, "eb_acme_real");
  assert.equal(bundle.goalId, "goal_acme_expansion");
  assert.equal(bundle.dealId, "deal_acme");
});

test("AC1: all seven real source types are ingested from the folder", () => {
  const types = new Set(bundle.sources.map((s) => s.sourceType));
  for (const t of evidenceSourceType.options) {
    assert.ok(types.has(t), `expected a ${t} source from the folder`);
  }
  assert.equal(bundle.sources.length, 7);
});

test("AC2: every chunk carries stable source refs — sourceId, span(unit/start/end), sha256 hash", () => {
  assert.ok(bundle.chunks.length >= 7, "expected multiple cited chunks");
  const sourceIds = new Set(bundle.sources.map((s) => s.sourceId));
  for (const chunk of bundle.chunks) {
    assert.ok(chunk.chunkId.length > 0, "chunkId");
    assert.ok(sourceIds.has(chunk.sourceId), `chunk ${chunk.chunkId} cites a known source`);
    assert.ok(["char", "line", "page", "section", "timecode", "message"].includes(chunk.span.unit));
    assert.ok(chunk.span.start.length > 0 && chunk.span.end.length > 0, "span start/end");
    assert.match(chunk.hash, /^[0-9a-f]{64}$/, "chunk hash is lowercase sha256 hex");
  }
});

test("AC2: every source carries a sourceId, type, title and a sha256 content hash", () => {
  for (const src of bundle.sources) {
    assert.match(src.sourceId, /^src_/);
    assert.ok(evidenceSourceType.options.includes(src.sourceType));
    assert.ok(src.title.length > 0);
    assert.match(src.hash, /^[0-9a-f]{64}$/);
    assert.match(src.capturedAt, /^\d{4}-\d{2}-\d{2}T/);
  }
});

test("the agent report is captured as an agent_output source with an agentOutputs ref", () => {
  assert.ok(bundle.agentOutputs && bundle.agentOutputs.length === 1);
  const ref = bundle.agentOutputs[0]!;
  assert.equal(ref.agentOutputId, "ao_acme_p1");
  const src = bundle.sources.find((s) => s.sourceId === ref.sourceId);
  assert.ok(src && src.sourceType === "agent_output");
});

test("capturedAt comes from the manifest (deterministic, not wall-clock)", () => {
  assert.equal(report.capturedAt, "2026-06-27T09:30:00.000Z");
  assert.ok(bundle.sources.every((s) => s.capturedAt === "2026-06-27T09:30:00.000Z"));
});

test("manifest.json + README are explicitly ignored, never ingested as sources", () => {
  assert.ok(report.ignored.includes("manifest.json"));
  assert.equal(report.failures.length, 0);
});

test("DETERMINISTIC: re-ingesting the same folder yields a byte-identical bundle + hash", () => {
  const again = ingestFolder(ACME_REAL_DIR);
  assert.deepEqual(again.bundle, bundle);
  assert.equal(evidenceBundleContract.hash(again.bundle), evidenceBundleContract.hash(bundle));
});

test("DATA BOUNDARY: no raw source text survives into the durable bundle", () => {
  // pull the actual raw text out of the example files and prove none of it is in the bundle
  const serialized = JSON.stringify(bundle);
  const rawSamples: string[] = [];
  const collect = (rel: string, slice: number): void => {
    const text = readFileSync(join(ACME_REAL_DIR, rel), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length >= slice && !trimmed.startsWith("{") && !trimmed.startsWith("\"")) {
        rawSamples.push(trimmed.slice(0, slice));
      }
    }
  };
  collect("calls/acme-kickoff.vtt", 24);
  collect("sow/acme-statement-of-work.md", 24);
  collect("emails/acme-procurement.eml", 24);
  assert.ok(rawSamples.length > 0, "test should have collected raw phrases to check");
  for (const phrase of rawSamples) {
    assert.ok(!serialized.includes(phrase), `bundle must not carry raw text: "${phrase}"`);
  }
});

test("the example folder really contains the seven type subfolders (fixture-of-record)", () => {
  const entries = readdirSync(ACME_REAL_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  assert.deepEqual(entries, ["agent", "calls", "emails", "linear", "proposals", "slack", "sow"]);
});
