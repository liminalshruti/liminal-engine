/**
 * Bundle-assembly tests — ids/hashes are derived deterministically; source.hash =
 * sha256(normalized text) and chunk.hash = sha256(span text); the result is
 * validated by the OWNING EvidenceBundle contract; and a malformed assembly is an
 * explicit BundleInvalidError (not a raw throw).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { evidenceBundleContract, sha256Hex } from "../src/contracts.ts";
import { assembleBundle } from "../src/bundle.ts";
import { BundleInvalidError } from "../src/errors.ts";
import type { LoadedSource } from "../src/types.ts";

const callSource: LoadedSource = {
  sourceType: "customer_call",
  title: "Call",
  relPath: "calls/c.vtt",
  normalizedText: "full call text",
  chunks: [{ span: { unit: "timecode", start: "00:00:01", end: "00:00:05" }, text: "EU residency", label: "transcript-cue" }],
};

const agentSource: LoadedSource = {
  sourceType: "agent_output",
  title: "Agent",
  relPath: "agent/a.agent.json",
  normalizedText: "on track",
  chunks: [{ span: { unit: "line", start: "1", end: "1" }, text: "on track", label: "agent-line" }],
  agentOutputId: "ao_1",
};

test("assembleBundle derives stable ids and content hashes", () => {
  const { bundle, chunkCount } = assembleBundle([callSource, agentSource], {
    id: "eb_t",
    dealId: "deal_t",
    capturedAt: "2026-06-27T09:30:00.000Z",
  });
  assert.equal(chunkCount, 2);
  const call = bundle.sources.find((s) => s.sourceType === "customer_call")!;
  assert.equal(call.hash, sha256Hex("full call text"));
  const chunk = bundle.chunks.find((c) => c.sourceId === call.sourceId)!;
  assert.equal(chunk.hash, sha256Hex("EU residency"));
  assert.match(chunk.chunkId, /__c001$/);
});

test("assembleBundle links agent_output sources via agentOutputs ref", () => {
  const { bundle } = assembleBundle([agentSource], { id: "eb_t", dealId: "deal_t", capturedAt: "2026-06-27T09:30:00.000Z" });
  assert.ok(bundle.agentOutputs && bundle.agentOutputs[0]!.agentOutputId === "ao_1");
});

test("assembled bundle round-trips through the owning contract", () => {
  const { bundle } = assembleBundle([callSource, agentSource], { id: "eb_t", dealId: "deal_t", capturedAt: "2026-06-27T09:30:00.000Z" });
  assert.deepEqual(evidenceBundleContract.parse(bundle), bundle);
});

test("source ids are deterministic + unique per relPath", () => {
  const a = assembleBundle([callSource], { id: "eb_t", dealId: "d", capturedAt: "2026-06-27T09:30:00.000Z" });
  const b = assembleBundle([callSource], { id: "eb_t", dealId: "d", capturedAt: "2026-06-27T09:30:00.000Z" });
  assert.equal(a.bundle.sources[0]!.sourceId, b.bundle.sources[0]!.sourceId);
});

test("an unscoped assembly is rejected as an explicit BundleInvalidError", () => {
  assert.throws(
    () => assembleBundle([callSource], { id: "eb_t", capturedAt: "2026-06-27T09:30:00.000Z" }),
    BundleInvalidError,
  );
});
