import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  DriftSignal,
  EndpointConfig,
  EvalResult,
  NlIntent,
  ResourceAllocation,
  RoutingRule,
} from "@liminal-engine/contracts";
import {
  driftSignalView,
  endpointConfigView,
  evalSummaryView,
  intentView,
  resourceAllocationView,
  routingRuleView,
} from "./index.ts";

test("driftSignalView exposes escalation-ready signal state", () => {
  const signal: DriftSignal = {
    id: "ds_1",
    sourceType: "agent_output",
    sourceId: "ao_1",
    signalKind: "requirement_dropped",
    severity: "critical",
    score: 0.91,
    summary: "SOC2 evidence missing",
    evidenceIds: ["ev_1", "ev_2"],
    observedAt: "2026-06-27T10:00:00.000Z",
    detectorVersion: "detector.v1",
    status: "open",
  };

  assert.deepEqual(driftSignalView(signal), {
    id: "ds_1",
    headline: "Requirement Dropped: SOC2 evidence missing",
    badge: { label: "CRITICAL", tone: "danger", title: "score 91%" },
    scoreLabel: "91%",
    evidenceCount: 2,
    shouldEscalate: true,
  });
});

test("endpointConfigView never exposes secret refs in the primary label", () => {
  const endpoint: EndpointConfig = {
    id: "endpoint_gemini",
    provider: "gemini",
    purpose: "Agent output generation",
    endpointUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.0-flash",
    auth: { scheme: "api-key", secretRef: "env:GEMINI_API_KEY" },
    timeoutMs: 30000,
    retry: { maxAttempts: 2, backoffMs: 250 },
    enabled: true,
    createdAt: "2026-06-27T10:00:00.000Z",
  };

  const view = endpointConfigView(endpoint);
  assert.equal(view.label, "Gemini endpoint");
  assert.equal(view.badge.tone, "green");
  assert.equal(view.detail.includes("env:GEMINI_API_KEY"), false);
});

test("intentView renders confidence and extracted entities", () => {
  const intent: NlIntent = {
    id: "intent_1",
    utterance: "Approve and enforce it",
    normalizedUtterance: "approve enforce it",
    actorRole: "VP Ops / Head of AI Transformation",
    intentType: "approve_enforce",
    entities: [{ name: "case", value: "gc_1", confidence: 0.9 }],
    confidence: 0.86,
    source: "chat",
    detectedAt: "2026-06-27T10:00:00.000Z",
  };

  assert.deepEqual(intentView(intent), {
    id: "intent_1",
    label: "Approve Enforce from VP Ops / Head of AI Transformation",
    badge: { label: "86%", tone: "green" },
    entities: [{ label: "case", value: "gc_1" }],
  });
});

test("resourceAllocationView and routingRuleView produce compact control-plane rows", () => {
  const allocation: ResourceAllocation = {
    id: "ra_1",
    workItemId: "gc_1",
    resourceType: "role",
    ownerRole: "Security",
    status: "allocated",
    reason: "Security review required",
    constraints: ["SOC2"],
    allocatedAt: "2026-06-27T10:00:00.000Z",
  };
  const endpoint: EndpointConfig = {
    id: "endpoint_signal",
    provider: "custom",
    purpose: "Signal processor",
    auth: { scheme: "none" },
    timeoutMs: 1000,
    retry: { maxAttempts: 1, backoffMs: 0 },
    enabled: true,
    createdAt: "2026-06-27T10:00:00.000Z",
  };
  const rule: RoutingRule = {
    id: "rr_1",
    name: "Signal processor",
    priority: 1,
    enabled: true,
    intentTypes: [],
    signalKinds: ["requirement_dropped"],
    endpointConfigIds: ["endpoint_signal"],
    disposition: "send",
    rationale: "Process drift",
    createdAt: "2026-06-27T10:00:00.000Z",
  };

  assert.equal(resourceAllocationView(allocation).badge.tone, "green");
  assert.deepEqual(routingRuleView(rule, [endpoint]).targets, ["endpoint_signal (custom)"]);
});

test("evalSummaryView detects Fail -> Pass improvement", () => {
  const results: EvalResult[] = [
    {
      id: "ev_1",
      dealId: "deal_1",
      evalCaseId: "ec_1",
      passNumber: 1,
      criterion: "SOC2 evidence requirement honored",
      result: "fail",
    },
    {
      id: "ev_2",
      dealId: "deal_1",
      evalCaseId: "ec_1",
      passNumber: 2,
      criterion: "SOC2 evidence requirement honored",
      result: "pass",
    },
  ];

  assert.deepEqual(evalSummaryView(results), {
    label: "Fail -> Pass improvement",
    badge: { label: "Improved", tone: "green" },
    passCount: 1,
    failCount: 1,
  });
});
