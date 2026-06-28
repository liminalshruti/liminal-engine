import { test } from "node:test";
import assert from "node:assert/strict";
import {
  driftSignalContract,
  endpointConfigContract,
  llmOutcomeContract,
  resourceAllocationContract,
  routingRuleContract,
  shouldOpenGovernanceCase,
  transformRuleContract,
} from "../src/index.ts";

test("EndpointConfig references secrets without accepting inline secret material", () => {
  assert.doesNotThrow(() =>
    endpointConfigContract.parse({
      id: "endpoint_custom",
      provider: "custom",
      purpose: "Webhook dispatch",
      endpointUrl: "https://example.test/hooks/governance",
      auth: { scheme: "api-key", secretRef: "env:WEBHOOK_API_KEY" },
      timeoutMs: 5000,
      retry: { maxAttempts: 3, backoffMs: 100 },
      enabled: true,
      createdAt: "2026-06-27T10:00:00.000Z",
    }),
  );

  assert.throws(
    () =>
      endpointConfigContract.parse({
        id: "endpoint_bad",
        provider: "custom",
        purpose: "Webhook dispatch",
        auth: { scheme: "api-key" },
        timeoutMs: 5000,
        retry: { maxAttempts: 3, backoffMs: 100 },
        enabled: true,
        createdAt: "2026-06-27T10:00:00.000Z",
      }),
    /secretRef/,
  );
});

test("LlmOutcome enforces success and error payload invariants", () => {
  assert.throws(
    () =>
      llmOutcomeContract.parse({
        id: "llm_out_empty",
        requestId: "llm_req_1",
        provider: "gemini",
        model: "gemini-2.0-flash",
        status: "success",
        latencyMs: 12,
        completedAt: "2026-06-27T10:00:00.000Z",
      }),
    /successful outcomes require outputText or parsedJson/,
  );

  assert.throws(
    () =>
      llmOutcomeContract.parse({
        id: "llm_out_bad_usage",
        requestId: "llm_req_1",
        provider: "gemini",
        model: "gemini-2.0-flash",
        status: "success",
        outputText: "ok",
        usage: { inputTokens: 3, outputTokens: 4, totalTokens: 9 },
        latencyMs: 12,
        completedAt: "2026-06-27T10:00:00.000Z",
      }),
    /totalTokens/,
  );
});

test("RoutingRule requires a routed subject and valid fanout cardinality", () => {
  assert.throws(
    () =>
      routingRuleContract.parse({
        id: "rr_empty",
        name: "empty",
        priority: 1,
        enabled: true,
        intentTypes: [],
        signalKinds: [],
        endpointConfigIds: ["endpoint_1"],
        disposition: "send",
        rationale: "No subject",
        createdAt: "2026-06-27T10:00:00.000Z",
      }),
    /at least one intent type or signal kind/,
  );

  assert.throws(
    () =>
      routingRuleContract.parse({
        id: "rr_bad_cardinality",
        name: "bad cardinality",
        priority: 1,
        enabled: true,
        intentTypes: ["approve_enforce"],
        signalKinds: [],
        endpointConfigIds: ["endpoint_1", "endpoint_2"],
        disposition: "send",
        rationale: "Non-fanout must be single endpoint",
        createdAt: "2026-06-27T10:00:00.000Z",
      }),
    /exactly one endpoint/,
  );
});

test("TransformRule validates operation-specific fields", () => {
  assert.throws(
    () =>
      transformRuleContract.parse({
        id: "tr_bad_redact",
        name: "bad redact",
        operation: "redact",
        inputSchema: "input",
        outputSchema: "output",
        fieldPath: ["text"],
        priority: 1,
        enabled: true,
        createdAt: "2026-06-27T10:00:00.000Z",
      }),
    /replacement/,
  );
});

test("ResourceAllocation lifecycle timestamps are enforced", () => {
  assert.throws(
    () =>
      resourceAllocationContract.parse({
        id: "ra_missing_time",
        workItemId: "work_1",
        resourceType: "role",
        ownerRole: "Security",
        status: "allocated",
        reason: "Owner needed",
        constraints: [],
      }),
    /allocatedAt/,
  );
});

test("DriftSignal helper opens cases only for high-confidence open severe signals", () => {
  const signal = driftSignalContract.parse({
    id: "ds_generic",
    sourceType: "agent_output",
    sourceId: "ao_generic",
    signalKind: "requirement_dropped",
    severity: "high",
    score: 0.9,
    summary: "Required implementation evidence is missing.",
    evidenceIds: [],
    observedAt: "2026-06-27T10:00:00.000Z",
    detectorVersion: "test.detector.v1",
    status: "open",
  });

  assert.equal(shouldOpenGovernanceCase(signal), true);
  assert.equal(shouldOpenGovernanceCase({ ...signal, status: "acknowledged" }), false);
  assert.equal(shouldOpenGovernanceCase({ ...signal, score: 0.4 }), false);
});
