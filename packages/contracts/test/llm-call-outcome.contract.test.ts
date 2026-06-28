/**
 * LlmCallOutcome invariants (LIM-1293). The golden test pins the canonical
 * string + hash of the valid vectors; this file proves the REJECTION paths of
 * the disposition/provenance superRefine and the strict/token invariants — the
 * negative cases a golden (which only carries valid inputs) cannot cover.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LLM_CALL_OUTCOME_SCHEMA,
  llmCallOutcomeContract,
  llmCallOutcomeGoldenVectors,
  type LlmCallOutcome,
} from "../src/index.ts";

const baseForwarded: LlmCallOutcome = {
  id: "llm_call_test_forwarded",
  requestId: "llm_req_test",
  provider: "gemini",
  model: "gemini-2.0-flash",
  disposition: "forwarded",
  source: "default-forward",
  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
  latencyMs: 120,
  decidedAt: "2026-06-27T10:00:00.000Z",
};

const baseBlocked: LlmCallOutcome = {
  id: "llm_call_test_blocked",
  requestId: "llm_req_test",
  provider: "gemini",
  model: "gemini-2.0-flash",
  disposition: "blocked",
  ruleId: "prule_test",
  source: "policy",
  reason: "denied by policy",
  latencyMs: 3,
  decidedAt: "2026-06-27T10:00:00.000Z",
};

test("every golden disposition (forwarded/blocked/transformed/held) parses and round-trips", () => {
  const seen = new Set<string>();
  for (const vector of llmCallOutcomeGoldenVectors) {
    const parsed = llmCallOutcomeContract.parse(vector.input);
    assert.deepEqual(parsed, vector.input);
    seen.add((vector.input as LlmCallOutcome).disposition);
  }
  assert.deepEqual([...seen].sort(), ["blocked", "forwarded", "held", "transformed"]);
});

test("blocked without a ruleId or operator source is rejected", () => {
  assert.throws(
    () =>
      llmCallOutcomeContract.parse({
        ...baseBlocked,
        ruleId: undefined,
        source: undefined,
      }),
    /require a ruleId or an operator source/,
  );
});

test("blocked with a policy source but NO ruleId is rejected (policy must reference a rule)", () => {
  assert.throws(
    () => llmCallOutcomeContract.parse({ ...baseBlocked, ruleId: undefined, source: "policy" }),
    /require a ruleId or an operator source/,
  );
});

test("held with an operator source and NO ruleId is ACCEPTED (the 'or operator source' branch)", () => {
  const held = llmCallOutcomeContract.parse({
    ...baseBlocked,
    id: "llm_call_test_held",
    disposition: "held",
    ruleId: undefined,
    source: "operator",
    reason: "operator parked the call",
  });
  assert.equal(held.disposition, "held");
  assert.equal(held.ruleId, undefined);
  assert.equal(held.source, "operator");
});

test("transformed with a ruleId is accepted; transformed without attribution is rejected", () => {
  assert.doesNotThrow(() =>
    llmCallOutcomeContract.parse({
      ...baseBlocked,
      id: "llm_call_test_transformed",
      disposition: "transformed",
      ruleId: "tr_test",
      source: "policy",
      usage: { inputTokens: 9, outputTokens: 4, totalTokens: 13 },
    }),
  );
  assert.throws(
    () =>
      llmCallOutcomeContract.parse({
        ...baseBlocked,
        id: "llm_call_test_transformed_bad",
        disposition: "transformed",
        ruleId: undefined,
        source: undefined,
      }),
    /require a ruleId or an operator source/,
  );
});

test("forwarded (default pass-through) must not carry a ruleId", () => {
  assert.throws(
    () => llmCallOutcomeContract.parse({ ...baseForwarded, ruleId: "prule_test" }),
    /forwarded \(default pass-through\) outcome must not carry a ruleId/,
  );
});

test("forwarded with no provenance at all is accepted (default-forward requires none)", () => {
  const { source: _omitSource, ...forwardedNoSource } = baseForwarded;
  assert.doesNotThrow(() => llmCallOutcomeContract.parse(forwardedNoSource));
});

test("forwarded may only use the default-forward source", () => {
  assert.throws(
    () => llmCallOutcomeContract.parse({ ...baseForwarded, source: "operator" }),
    /forwarded outcome may only use the default-forward source/,
  );
});

test("the default-forward source is rejected on a non-forwarded disposition", () => {
  assert.throws(
    () => llmCallOutcomeContract.parse({ ...baseBlocked, source: "default-forward" }),
    /default-forward source is only valid for a forwarded outcome/,
  );
});

test("token usage must satisfy total = input + output (reused invariant)", () => {
  assert.throws(
    () =>
      llmCallOutcomeContract.parse({
        ...baseForwarded,
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 999 },
      }),
    /totalTokens/,
  );
});

test("strict — unknown keys are rejected at the boundary", () => {
  assert.throws(
    () => llmCallOutcomeContract.parse({ ...baseForwarded, unexpected: true }),
    /Unrecognized key/,
  );
});

test("canonical projection is schema-tagged snake_case; absent optionals are omitted; hash is deterministic", () => {
  const canonical = llmCallOutcomeContract.canonical(baseBlocked) as Record<string, unknown>;
  assert.equal(canonical.schema, LLM_CALL_OUTCOME_SCHEMA);
  assert.equal(canonical.request_id, baseBlocked.requestId);
  assert.equal(canonical.rule_id, baseBlocked.ruleId);
  assert.equal(canonical.latency_ms, baseBlocked.latencyMs);
  assert.equal(canonical.decided_at, baseBlocked.decidedAt);
  // blocked carries no token usage -> the optional key is omitted entirely.
  assert.ok(!("usage" in canonical));
  // hash is stable across calls (sorted-key canonical serialization).
  assert.equal(llmCallOutcomeContract.hash(baseBlocked), llmCallOutcomeContract.hash(baseBlocked));
  assert.match(llmCallOutcomeContract.hash(baseBlocked), /^[0-9a-f]{64}$/);
});
