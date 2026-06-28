import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { ActionPolicyRule, InterceptedAction } from "@liminal-engine/contracts";
import type { Clock, IdGen } from "@liminal-engine/governance";
import type { PolicyDecision, PolicyMode } from "@liminal-engine/policy";
import { createGatewayRuntime } from "./runtime.ts";
import { createDecisionServer } from "./server.ts";
import { computeGatewayMetrics, emptyGatewayMetrics, type GatewayMetrics } from "./metrics.ts";
import type { ProxyHistoryEntry } from "./history.ts";

const pr20: InterceptedAction = {
  id: "ia_pr20_merge",
  tool: "gh",
  action: "pr-merge",
  target: "PR#20",
  args: { reviews: { approved: 1, rejected: 1 } },
  requestedAt: "2026-06-27T20:00:00.000Z",
};

const DROP_REASON = "never merge without both reviewers approving";

test("GET /metrics: intercept -> operator drop+activate -> re-intercept drops the escalation rate", async () => {
  const runtime = createGatewayRuntime({ mode: "intercept", clock: seqClock(), idGen: seqId() });
  const server = createDecisionServer(runtime.gateway, {
    activeRules: () => runtime.policyStore.activeRules(),
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const at = (path: string): string => `http://127.0.0.1:${port}${path}`;

  try {
    // 1) An agent action is intercepted with no matching rule -> escalates ("ask").
    const first = await postJson<PolicyDecision>(at("/intercept"), pr20);
    assert.equal(first.verdict, "ask");

    // 2) Operator correction: drop the action and activate the learned rule.
    const queue = await getJson<Array<{ id: string }>>(at("/queue"));
    assert.equal(queue.length, 1);
    const verdict = await postJson<{ compiledRules: ActionPolicyRule[] }>(at("/drop"), {
      queueId: queue[0]!.id,
      reason: DROP_REASON,
      activate: true,
    });
    const rule = verdict.compiledRules[0]!;
    assert.equal(rule.status, "active");

    // 3) Re-intercept the same class -> now governed autonomously (no operator ask).
    const second = await postJson<PolicyDecision>(at("/intercept"), pr20);
    assert.equal(second.verdict, "deny");

    // 4) /metrics surfaces the "more useful the more it's used" proof.
    const metrics = await getJson<GatewayMetrics>(at("/metrics"));

    // Escalation rate DROPS across the governed-action series (operator drop excluded).
    assert.deepEqual(metrics.escalation.rates, [1, 0.5]);
    assert.equal(metrics.escalation.sampleCount, 2);
    assert.equal(metrics.escalation.current, 0.5);
    assert.ok(
      metrics.escalation.current < metrics.escalation.rates[0]!,
      `expected escalation to drop, got ${JSON.stringify(metrics.escalation.rates)}`,
    );

    // Active learned-rule count.
    assert.equal(metrics.activeRuleCount, 1);

    // Per-rule eval health: Fail (before the rule) -> Pass (after the rule).
    assert.equal(metrics.ruleHealth.length, 1);
    assert.deepEqual(metrics.ruleHealth[0], {
      ruleId: rule.id,
      evalCaseId: rule.evalCaseId,
      before: "fail",
      after: "pass",
      healthy: true,
    });
    assert.deepEqual(metrics.ruleHealthSummary, { total: 1, healthy: 1 });
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("computeGatewayMetrics excludes operator resolutions from the escalation denominator and grades rule health", () => {
  const rule = activeDenyRule();
  // intercept (ask) -> operator drop (deny, source operator) -> re-intercept (deny, source policy)
  const history: ProxyHistoryEntry[] = [
    historyEntry("h1", pr20, askDecision()),
    historyEntry("h2", pr20, operatorDenyDecision(), ["intercept.drop"]),
    historyEntry("h3", pr20, policyDenyDecision(rule.id)),
  ];

  const metrics = computeGatewayMetrics({ history, activeRules: [rule] });

  // Only the two policy-evaluated intercepts count; the operator drop is excluded,
  // so the rate is 1 then 0.5 (not 1, 0.5, 0.33 as it would be if drops counted).
  assert.deepEqual(metrics.escalation.rates, [1, 0.5]);
  assert.equal(metrics.escalation.current, 0.5);
  assert.equal(metrics.activeRuleCount, 1);
  assert.equal(metrics.ruleHealth.length, 1);
  assert.equal(metrics.ruleHealth[0]!.before, "fail");
  assert.equal(metrics.ruleHealth[0]!.after, "pass");
  assert.equal(metrics.ruleHealth[0]!.healthy, true);
});

test("computeGatewayMetrics over empty state equals the zeroed snapshot", () => {
  assert.deepEqual(computeGatewayMetrics({ history: [], activeRules: [] }), emptyGatewayMetrics());
});

test("GET /metrics fails closed: a store error returns a zeroed snapshot, never throws", async () => {
  const runtime = createGatewayRuntime({ mode: "intercept", clock: seqClock(), idGen: seqId() });
  await runtime.gateway.intercept(pr20); // real history exists, but the rule store is offline
  const server = createDecisionServer(runtime.gateway, {
    activeRules: () => Promise.reject(new Error("policy store offline")),
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${port}/metrics`);
    assert.equal(response.status, 200); // never 5xx, never throws
    const metrics = await response.json() as GatewayMetrics;
    assert.deepEqual(metrics, emptyGatewayMetrics());
  } finally {
    server.close();
    await once(server, "close");
  }
});

function seqClock(start = "2026-06-27T20:00:00.000Z"): Clock {
  let i = 0;
  const base = Date.parse(start);
  return { now: () => new Date(base + i++ * 1000).toISOString() };
}

function seqId(prefix = "m"): IdGen {
  let i = 0;
  return { next: () => `${prefix}_${++i}` };
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) assert.fail(await response.text());
  return await response.json() as T;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) assert.fail(await response.text());
  return await response.json() as T;
}

function askDecision(): PolicyDecision {
  return {
    verdict: "ask",
    allowed: false,
    reasons: ["No active policy rule matched gh pr-merge; operator approval is required."],
    requiredBeforeSend: ["Record an operator approve/disapprove verdict for this action class."],
    source: "default-deny",
  };
}

function operatorDenyDecision(): PolicyDecision {
  return {
    verdict: "deny",
    allowed: false,
    reasons: [DROP_REASON],
    requiredBeforeSend: ["Activate the compiled policy rule or correct the action before retrying."],
    source: "operator",
  };
}

function policyDenyDecision(ruleId: string): PolicyDecision {
  return {
    verdict: "deny",
    allowed: false,
    reasons: ["Never merge without both reviewers approving."],
    requiredBeforeSend: ["Collect at least two approving reviews before merging."],
    source: "policy",
    sourceRuleId: ruleId,
  };
}

function historyEntry(
  id: string,
  action: InterceptedAction,
  decision: PolicyDecision,
  notes?: string[],
): ProxyHistoryEntry {
  const mode: PolicyMode = "intercept";
  return {
    id,
    action,
    decision,
    mode,
    recordedAt: action.requestedAt,
    ...(notes !== undefined ? { notes } : {}),
  };
}

function activeDenyRule(): ActionPolicyRule {
  return {
    id: "aprule_dual_approval",
    version: 1,
    fromCorrectionId: "ce_pr20_reject",
    evalCaseId: "ec_pr20_dual_approval",
    scope: {
      tool: "gh",
      action: "pr-merge",
      targetPattern: "PR#*",
      condition: { field: "reviews.approved", op: "<", value: 2 },
    },
    effect: {
      verdict: "deny",
      actionType: "block_agent_action",
      reasons: ["Never merge without both reviewers approving."],
      requiredBefore: ["Collect at least two approving reviews before merging."],
    },
    status: "active",
    createdAt: "2026-06-27T20:00:00.000Z",
  };
}
