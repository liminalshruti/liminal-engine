/**
 * Small pure-unit tests for routing, manifest parsing, normalization, and id
 * derivation — the deterministic primitives the loader is built on.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { routeSourceType } from "../src/routing.ts";
import { UnclassifiedFileError } from "../src/errors.ts";
import { parseManifest } from "../src/manifest.ts";
import { ManifestError } from "../src/errors.ts";
import { normalizeText, toLines } from "../src/normalize.ts";
import { deriveChunkId, deriveSourceId, slugify } from "../src/ids.ts";

// ── routing ──────────────────────────────────────────────────────────────────
test("routing: directory synonyms map to source types", () => {
  const cases: Array<[string, string]> = [
    ["calls", "customer_call"],
    ["transcripts", "customer_call"],
    ["proposals", "proposal"],
    ["sow", "sow"],
    ["emails", "email"],
    ["slack", "slack"],
    ["linear", "linear"],
    ["agent", "agent_output"],
  ];
  for (const [dir, type] of cases) {
    assert.equal(routeSourceType({ relPath: `${dir}/f`, fileName: "f", parentDir: dir }), type);
  }
});

test("routing: extension heuristics classify files at the root", () => {
  assert.equal(routeSourceType({ relPath: "a.vtt", fileName: "a.vtt", parentDir: "" }), "customer_call");
  assert.equal(routeSourceType({ relPath: "a.eml", fileName: "a.eml", parentDir: "" }), "email");
  assert.equal(routeSourceType({ relPath: "a.slack.json", fileName: "a.slack.json", parentDir: "" }), "slack");
  assert.equal(routeSourceType({ relPath: "a.linear.json", fileName: "a.linear.json", parentDir: "" }), "linear");
  assert.equal(routeSourceType({ relPath: "a.agent.json", fileName: "a.agent.json", parentDir: "" }), "agent_output");
});

test("routing: manifest override wins; unknown file -> explicit UnclassifiedFileError", () => {
  assert.equal(
    routeSourceType({ relPath: "x.txt", fileName: "x.txt", parentDir: "misc", overrideType: "sow" }),
    "sow",
  );
  assert.throws(() => routeSourceType({ relPath: "x.txt", fileName: "x.txt", parentDir: "misc" }), UnclassifiedFileError);
  assert.throws(
    () => routeSourceType({ relPath: "x.txt", fileName: "x.txt", parentDir: "misc", overrideType: "bogus" }),
    UnclassifiedFileError,
  );
});

// ── manifest ─────────────────────────────────────────────────────────────────
test("manifest: parses a full valid manifest", () => {
  const m = parseManifest(
    JSON.stringify({
      id: "eb_x",
      goalId: "g",
      dealId: "d",
      capturedAt: "2026-06-27T09:30:00.000Z",
      sources: { "calls/c.vtt": { type: "customer_call", title: "Call" } },
    }),
    "manifest.json",
  );
  assert.equal(m.id, "eb_x");
  assert.equal(m.sources?.["calls/c.vtt"]?.title, "Call");
});

test("manifest: rejects bad JSON, bad capturedAt, and non-object sources", () => {
  assert.throws(() => parseManifest("{ nope", "m"), ManifestError);
  assert.throws(() => parseManifest(JSON.stringify({ capturedAt: "yesterday" }), "m"), ManifestError);
  assert.throws(() => parseManifest(JSON.stringify({ sources: [] }), "m"), ManifestError);
});

// ── normalize ────────────────────────────────────────────────────────────────
test("normalize: strips BOM, converts CRLF/CR to LF, is idempotent", () => {
  const bom = String.fromCharCode(0xfeff);
  const out = normalizeText(`${bom}a\r\nb\rc`);
  assert.equal(out, "a\nb\nc");
  assert.equal(normalizeText(out), out);
});

test("normalize: toLines drops a single trailing newline's phantom line", () => {
  assert.deepEqual(toLines("a\nb\n"), ["a", "b"]);
  assert.deepEqual(toLines("a\nb"), ["a", "b"]);
});

// ── ids ──────────────────────────────────────────────────────────────────────
test("ids: slugify is ascii, lowercase, non-empty", () => {
  assert.equal(slugify("Acme Kickoff!"), "acme_kickoff");
  assert.equal(slugify("***"), "x");
});

test("ids: source id is stable for a path and unique across different paths", () => {
  const a = deriveSourceId("customer_call", "calls/c.vtt", "c.vtt");
  assert.equal(a, deriveSourceId("customer_call", "calls/c.vtt", "c.vtt"));
  assert.notEqual(a, deriveSourceId("customer_call", "calls/other/c.vtt", "c.vtt"));
  assert.match(a, /^src_customer_call_c_[0-9a-f]{8}$/);
});

test("ids: chunk id is zero-padded + ordered under its source", () => {
  assert.equal(deriveChunkId("src_x", 1), "src_x__c001");
  assert.equal(deriveChunkId("src_x", 42), "src_x__c042");
});
