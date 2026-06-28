import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  AgentOutput,
  EndpointConfig,
  JsonObject,
  Requirement,
  RoutingRule,
  TransformRule,
} from "@liminal-engine/contracts";
import {
  allocateResourcesForSignals,
  applyTransformRules,
  detectRequirementDrift,
  routeSignalsAndIntents,
} from "../src/index.ts";

const requirement: Requirement = {
  id: "req_payments_soc2",
  goalId: "goal_enterprise_payments",
  dealId: "deal_payments",
  text: "SOC 2 Type II evidence must be attached before enterprise payment launch.",
  ownerRole: "Security",
  severity: "hard",
  scope: ["launch-plan", "customer-facing-status-update"],
  status: "active",
  createdBy: "operator",
  approvedBy: "VP Ops / Head of AI Transformation",
  evidenceRefs: ["evidence_soc2_clause"],
  createdAt: "2026-06-27T10:00:00.000Z",
  activatedAt: "2026-06-27T10:01:00.000Z",
};

const falseGreenOutput: AgentOutput = {
  id: "ao_payments_p1",
  dealId: "deal_payments",
  dealName: "Enterprise payments launch",
  passNumber: 1,
  reportedStatus: "on-track",
  summary: "Enterprise payments launch is on track; pricing and implementation are green.",
  droppedRequirements: ["SOC 2 Type II evidence"],
};

test("detectRequirementDrift works on arbitrary active requirements, not just Acme fixtures", () => {
  const signals = detectRequirementDrift({
    agentOutput: falseGreenOutput,
    requirements: [requirement],
    observedAt: "2026-06-27T10:02:00.000Z",
  });

  assert.equal(signals.length, 1);
  assert.equal(signals[0]?.signalKind, "requirement_dropped");
  assert.equal(signals[0]?.severity, "critical");
  assert.equal(signals[0]?.linkedRequirementId, "req_payments_soc2");
  assert.ok((signals[0]?.score ?? 0) >= 0.8);
});

test("detectRequirementDrift ignores inactive and informational requirements", () => {
  const proposed = { ...requirement, id: "req_proposed", status: "proposed" as const };
  const info = { ...requirement, id: "req_info", severity: "info" as const };

  const signals = detectRequirementDrift({
    agentOutput: falseGreenOutput,
    requirements: [proposed, info],
    observedAt: "2026-06-27T10:02:00.000Z",
  });

  assert.deepEqual(signals, []);
});

test("routeSignalsAndIntents chooses enabled endpoints by priority and rule match", () => {
  const endpoint: EndpointConfig = {
    id: "endpoint_signal_processor",
    provider: "custom",
    purpose: "Signal processing webhook",
    endpointUrl: "https://example.test/signal",
    auth: { scheme: "none" },
    timeoutMs: 5000,
    retry: { maxAttempts: 1, backoffMs: 0 },
    enabled: true,
    createdAt: "2026-06-27T10:00:00.000Z",
  };
  const disabledEndpoint: EndpointConfig = { ...endpoint, id: "endpoint_disabled", enabled: false };
  const rule: RoutingRule = {
    id: "rr_signal_processor",
    name: "Route requirement drift",
    priority: 1,
    enabled: true,
    intentTypes: [],
    signalKinds: ["requirement_dropped"],
    endpointConfigIds: [endpoint.id],
    disposition: "send",
    rationale: "Requirement drift needs evidence processing",
    createdAt: "2026-06-27T10:00:00.000Z",
  };
  const disabledRule: RoutingRule = { ...rule, id: "rr_disabled", endpointConfigIds: [disabledEndpoint.id] };
  const [signal] = detectRequirementDrift({
    agentOutput: falseGreenOutput,
    requirements: [requirement],
    observedAt: "2026-06-27T10:02:00.000Z",
  });

  const decisions = routeSignalsAndIntents({
    signals: signal === undefined ? [] : [signal],
    rules: [rule, disabledRule],
    endpoints: [endpoint, disabledEndpoint],
  });

  assert.deepEqual(decisions, [
    {
      ruleId: "rr_signal_processor",
      endpointConfigId: "endpoint_signal_processor",
      disposition: "send",
      rationale: "Requirement drift needs evidence processing",
      signalId: signal?.id,
    },
  ]);
});

test("applyTransformRules applies ordered real transformations to JSON objects", () => {
  const input: JsonObject = {
    beforeState: {
      customerClaim: "Acme expansion appears on track. Internal note.",
    },
  };
  const rules: TransformRule[] = [
    {
      id: "tr_redact",
      name: "Redact customer name",
      operation: "redact",
      inputSchema: "liminal_engine.audit_event.v1",
      outputSchema: "liminal_engine.audit_event.v1",
      fieldPath: ["beforeState", "customerClaim"],
      pattern: "Acme expansion",
      replacement: "[redacted expansion]",
      priority: 1,
      enabled: true,
      createdAt: "2026-06-27T10:00:00.000Z",
    },
    {
      id: "tr_normalize",
      name: "Normalize claim",
      operation: "normalize",
      inputSchema: "liminal_engine.audit_event.v1",
      outputSchema: "liminal_engine.audit_event.v1",
      fieldPath: ["beforeState", "customerClaim"],
      targetField: ["normalizedClaim"],
      priority: 2,
      enabled: true,
      createdAt: "2026-06-27T10:00:00.000Z",
    },
  ];

  const results = applyTransformRules(input, rules);
  assert.equal(results.length, 2);
  assert.equal(results[0]?.changed, true);
  assert.deepEqual(results[1]?.output, {
    beforeState: {
      customerClaim: "[redacted expansion] appears on track. Internal note.",
    },
    normalizedClaim: "[redacted expansion] appears on track. internal note.",
  });
});

test("allocateResourcesForSignals creates role allocations for severe open signals", () => {
  const signals = detectRequirementDrift({
    agentOutput: falseGreenOutput,
    requirements: [requirement],
    observedAt: "2026-06-27T10:02:00.000Z",
  });

  const allocations = allocateResourcesForSignals({
    signals,
    ownerRoles: ["Security", "Engineering"],
    allocatedAt: "2026-06-27T10:03:00.000Z",
  });

  assert.equal(allocations.length, 2);
  assert.deepEqual(allocations.map((allocation) => allocation.ownerRole), ["Security", "Engineering"]);
  assert.ok(allocations.every((allocation) => allocation.status === "allocated"));
  assert.ok(allocations.every((allocation) => allocation.evidenceIds?.includes(signals[0]!.id)));
});
