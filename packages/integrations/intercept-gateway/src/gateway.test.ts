import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { EvalResult, InterceptedAction, ActionPolicyRule } from "@liminal-engine/contracts";
import { AuditLedger, verifyChain } from "@liminal-engine/governance";
import { InMemoryInterceptQueue, InMemoryPolicyStore } from "@liminal-engine/integration-policy-store";
import {
  countSafetyRegressions,
  escalationSeries,
  finalEscalationRate,
  isMonotonicNonIncreasing,
  type InterceptQueue,
  type PolicyDecision,
  type QueuedIntercept,
} from "@liminal-engine/policy";
import { InterceptGateway } from "./gateway.ts";
import { InMemoryProxyHistory } from "./history.ts";
import { createGatewayRuntime } from "./runtime.ts";
import { createDecisionServer } from "./server.ts";
import { ruleHealthTable } from "../../../eval-harness/src/rule-health.ts";

const pr20: InterceptedAction = {
  id: "ia_pr20_merge",
  tool: "gh",
  action: "pr-merge",
  target: "PR#20",
  args: { reviews: { approved: 1, rejected: 1 } },
  requestedAt: "2026-06-27T20:00:00.000Z",
};

const pr35: InterceptedAction = {
  ...pr20,
  id: "ia_pr35_merge",
  target: "PR#35",
  args: { reviews: { approved: 1, rejected: 0 } },
  requestedAt: "2026-06-27T20:01:00.000Z",
};

const prReady: InterceptedAction = {
  ...pr20,
  id: "ia_pr36_merge",
  target: "PR#36",
  args: { reviews: { approved: 2, rejected: 0 } },
  requestedAt: "2026-06-27T20:02:00.000Z",
};

const destructiveMcp: InterceptedAction = {
  id: "ia_mcp_destroy",
  tool: "mcp",
  action: "github.delete_branch",
  target: "owner/repo:main",
  args: { branch: "main", destructive: true },
  requestedAt: "2026-06-27T20:03:00.000Z",
};

const incidentCorpus = [
  {
    action: pr20,
    reason: "never merge without both reviewers approving",
  },
  {
    action: {
      id: "ia_force_push",
      tool: "git",
      action: "push",
      target: "origin main",
      args: { force: true, argv: ["push", "origin", "main", "--force"] },
      requestedAt: "2026-06-27T20:04:00.000Z",
    } satisfies InterceptedAction,
    reason: "never push --force",
  },
  {
    action: {
      id: "ia_repo_fork",
      tool: "gh",
      action: "repo-fork",
      target: "liminal/natsec",
      args: { argv: ["repo", "fork", "liminal/natsec"] },
      requestedAt: "2026-06-27T20:05:00.000Z",
    } satisfies InterceptedAction,
    reason: "never fork repositories",
  },
  {
    action: {
      id: "ia_deploy_prod",
      tool: "deploy",
      action: "deploy",
      target: "prod",
      args: { deploy: { environment: "prod" }, argv: ["release", "--env", "prod"] },
      requestedAt: "2026-06-27T20:06:00.000Z",
    } satisfies InterceptedAction,
    reason: "never deploy production",
  },
  {
    action: destructiveMcp,
    reason: "never do this action",
  },
] as const;

test("InterceptGateway queues unknown consequential actions, compiles disapproval, activates a rule, and auto-denies repeats", async () => {
  const setup = gatewaySetup();

  const first = await setup.gateway.intercept(pr20);
  assert.equal(first.verdict, "ask");
  assert.equal((await setup.queue.pending()).length, 1);
  assert.equal((await setup.gateway.health()).queueDepth, 1);

  const queued = (await setup.queue.pending())[0]!;
  const verdict = await setup.gateway.operatorVerdict({
    queueId: queued.id,
    verdict: "disapprove",
    reason: "never merge without both reviewers approving",
    activate: true,
  });
  assert.equal(verdict.decision.verdict, "deny");
  assert.equal(verdict.compiledRules.length, 1);
  assert.equal(verdict.compiledRules[0]!.status, "active");
  assert.equal((await setup.queue.pending()).length, 0);

  setup.gateway.setMode("learned");
  const repeat = await setup.gateway.intercept(pr35);
  assert.equal(repeat.verdict, "deny");
  assert.equal(repeat.source, "policy");
  assert.equal(repeat.sourceRuleId, verdict.compiledRules[0]!.id);
  assert.equal((await setup.store.activeRules()).length, 1);
  assert.equal(verifyChain(setup.ledger.events()).valid, true);
});

test("InterceptGateway compiles operator approvals into active allow rules for the same safe class", async () => {
  const setup = gatewaySetup();

  const first = await setup.gateway.intercept(prReady);
  assert.equal(first.verdict, "ask");

  const queued = (await setup.queue.pending())[0]!;
  const verdict = await setup.gateway.operatorVerdict({
    queueId: queued.id,
    verdict: "approve",
    reason: "safe because both reviewers approved",
  });

  assert.equal(verdict.decision.verdict, "allow");
  assert.equal(verdict.compiledRules.length, 1);
  assert.equal(verdict.compiledRules[0]!.status, "active");
  assert.equal(verdict.compiledRules[0]!.effect.verdict, "allow");
  assert.equal(verdict.evalCases.length, 1);

  setup.gateway.setMode("learned");
  const repeat = await setup.gateway.intercept({
    ...prReady,
    id: "ia_pr37_merge",
    target: "PR#37",
    requestedAt: "2026-06-27T20:04:00.000Z",
  });
  assert.equal(repeat.verdict, "allow");
  assert.equal(repeat.source, "policy");
  assert.equal(repeat.sourceRuleId, verdict.compiledRules[0]!.id);
  assert.equal(verifyChain(setup.ledger.events()).valid, true);
});

test("InterceptGateway applies target scope and still records out-of-scope actions in proxy history", async () => {
  const setup = gatewaySetup();
  setup.gateway.setScope({
    include: [{ id: "dangerous-gh", tool: "gh", action: "pr-merge", targetPattern: "PR#*" }],
    exclude: [{ id: "docs-pr", tool: "gh", action: "pr-merge", targetPattern: "PR#docs-*" }],
  });

  const outOfScope = await setup.gateway.intercept({
    ...pr20,
    id: "ia_docs_pr",
    target: "PR#docs-1",
    requestedAt: "2026-06-27T20:03:00.000Z",
  });

  assert.equal(outOfScope.verdict, "allow");
  assert.equal(outOfScope.source, "scope");
  assert.equal(outOfScope.outOfScope, true);
  assert.match(outOfScope.scopeReason ?? "", /excluded scope docs-pr/);
  assert.equal((await setup.queue.pending()).length, 0);

  const history = await setup.gateway.history();
  assert.equal(history.length, 1);
  assert.equal(history[0]!.decision.source, "scope");
  assert.equal(history[0]!.decision.outOfScope, true);
  assert.equal((await setup.gateway.history({ inScopeOnly: true })).length, 0);
});

test("InterceptGateway repeater replays captured or edited actions without mutating the intercept queue", async () => {
  const setup = gatewaySetup();

  const first = await setup.gateway.intercept(pr20);
  assert.equal(first.verdict, "ask");
  const history = await setup.gateway.history();
  const beforeLedgerCount = setup.ledger.events().length;
  const beforeQueueDepth = (await setup.queue.pending()).length;

  const repeated = await setup.gateway.repeater({ historyId: history[0]!.id, mode: "shadow" });
  assert.equal(repeated.action.id, pr20.id);
  assert.equal(repeated.decision.verdict, "allow");
  assert.equal(repeated.decision.allowed, true);
  assert.equal(setup.ledger.events().length, beforeLedgerCount + 1);
  assert.equal((await setup.queue.pending()).length, beforeQueueDepth);
  assert.equal((await setup.gateway.history()).length, history.length + 1);

  const edited = await setup.gateway.repeater({
    action: {
      ...pr20,
      id: "ia_repeater_edit",
      args: { reviews: { approved: 2, rejected: 0 } },
    },
    mode: "intercept",
  });
  assert.equal(edited.action.id, "ia_repeater_edit");
  assert.equal(edited.decision.verdict, "ask");
  assert.equal(setup.ledger.events().length, beforeLedgerCount + 2);
  assert.equal((await setup.gateway.history()).length, history.length + 2);
  assert.equal((await setup.queue.pending()).length, beforeQueueDepth);
  assert.ok((await setup.gateway.history()).some((entry) => entry.notes?.includes("repeater.send")));
});

test("InterceptGateway gates destructive MCP-shaped actions through the same learning loop", async () => {
  const setup = gatewaySetup();

  const first = await setup.gateway.intercept(destructiveMcp);
  assert.equal(first.verdict, "ask");

  const queued = (await setup.queue.pending())[0]!;
  const verdict = await setup.gateway.operatorVerdict({
    queueId: queued.id,
    verdict: "disapprove",
    reason: "never do this action",
    activate: true,
  });
  assert.equal(verdict.compiledRules[0]!.scope.tool, "mcp");
  assert.equal(verdict.compiledRules[0]!.scope.action, "github.delete_branch");

  setup.gateway.setMode("learned");
  const repeat = await setup.gateway.intercept({
    ...destructiveMcp,
    id: "ia_mcp_destroy_repeat",
    requestedAt: "2026-06-27T20:05:00.000Z",
  });
  assert.equal(repeat.verdict, "deny");
  assert.equal(repeat.sourceRuleId, verdict.compiledRules[0]!.id);
});

test("InterceptGateway applies match-replace before queueing and preserves original traffic in history", async () => {
  const setup = gatewaySetup();
  setup.gateway.setMatchReplaceRules([
    {
      id: "target-prod-to-staging",
      enabled: true,
      field: "target",
      match: "prod",
      replace: "staging",
    },
    {
      id: "env-prod-to-staging",
      enabled: true,
      field: "args",
      argPath: "deploy.environment",
      match: "prod",
      replace: "staging",
    },
  ]);

  const action: InterceptedAction = {
    id: "ia_deploy_prod",
    tool: "deploy",
    action: "deploy",
    target: "prod",
    args: { deploy: { environment: "prod" } },
    requestedAt: "2026-06-27T20:07:00.000Z",
  };
  const decision = await setup.gateway.intercept(action);
  assert.equal(decision.verdict, "ask");

  const queued = (await setup.queue.pending())[0]!;
  assert.equal(queued.action.target, "staging");
  assert.deepEqual(queued.action.args, { deploy: { environment: "staging" } });

  const history = await setup.history.all();
  assert.equal(history[0]!.originalAction?.target, "prod");
  assert.equal(history[0]!.action.target, "staging");
  assert.deepEqual(history[0]!.appliedMatchReplaceRuleIds, [
    "target-prod-to-staging",
    "env-prod-to-staging",
  ]);
});

test("InterceptGateway forward supports edited actions and learns an allow rule for the edited class", async () => {
  const setup = gatewaySetup();

  await setup.gateway.intercept(pr20);
  const queued = (await setup.queue.pending())[0]!;
  const edited: InterceptedAction = {
    ...queued.action,
    args: { reviews: { approved: 2, rejected: 0 } },
  };
  const forwarded = await setup.gateway.forward({
    queueId: queued.id,
    reason: "forward edited PR after adding both approvals",
    editedAction: edited,
  });

  assert.equal(forwarded.decision.verdict, "allow");
  assert.equal(forwarded.compiledRules[0]!.effect.verdict, "allow");
  assert.deepEqual(forwarded.compiledRules[0]!.scope.condition, {
    field: "reviews.approved",
    op: ">=",
    value: 2,
  });

  const forwardHistory = (await setup.history.all()).find((entry) =>
    entry.notes?.includes("intercept.forward"));
  assert.equal(forwardHistory?.originalAction?.args["reviews"] !== undefined, true);
  assert.deepEqual(forwardHistory?.action.args, { reviews: { approved: 2, rejected: 0 } });

  setup.gateway.setMode("learned");
  const repeat = await setup.gateway.intercept({
    ...prReady,
    id: "ia_pr_forward_repeat",
    requestedAt: "2026-06-27T20:08:00.000Z",
  });
  assert.equal(repeat.verdict, "allow");
  assert.equal(repeat.sourceRuleId, forwarded.compiledRules[0]!.id);
});

test("InterceptGateway drop learns a deny rule and records the dropped action in history", async () => {
  const setup = gatewaySetup();
  const action = incidentCorpus[1]!.action;

  await setup.gateway.intercept(action);
  const queued = (await setup.queue.pending())[0]!;
  const dropped = await setup.gateway.drop({
    queueId: queued.id,
    reason: "never push --force",
    activate: true,
  });

  assert.equal(dropped.decision.verdict, "deny");
  assert.equal(dropped.compiledRules[0]!.status, "active");
  assert.equal(dropped.compiledRules[0]!.effect.verdict, "deny");
  const dropHistory = (await setup.history.all()).find((entry) =>
    entry.notes?.includes("intercept.drop"));
  assert.equal(dropHistory?.decision.verdict, "deny");

  setup.gateway.setMode("learned");
  const repeat = await setup.gateway.intercept(replayAction(action, 9));
  assert.equal(repeat.verdict, "deny");
  assert.equal(repeat.sourceRuleId, dropped.compiledRules[0]!.id);
});

test("InterceptGateway supports bulk forward-all and drop-all queue controls", async () => {
  const forwardSetup = gatewaySetup();
  await forwardSetup.gateway.intercept(pr20);
  await forwardSetup.gateway.intercept(destructiveMcp);

  const forwarded = await forwardSetup.gateway.forwardAll({ reason: "bulk forward reviewed actions" });
  assert.equal(forwarded.length, 2);
  assert.ok(forwarded.every((result) => result.decision.verdict === "allow"));
  assert.equal((await forwardSetup.queue.pending()).length, 0);

  const dropSetup = gatewaySetup();
  await dropSetup.gateway.intercept(incidentCorpus[1]!.action);
  await dropSetup.gateway.intercept(incidentCorpus[2]!.action);

  const dropped = await dropSetup.gateway.dropAll({ reason: "never do this action", activate: true });
  assert.equal(dropped.length, 2);
  assert.ok(dropped.every((result) => result.decision.verdict === "deny"));
  assert.equal((await dropSetup.queue.pending()).length, 0);
});

test("GatewayRuntime sessionDir persists learned rules and proxy history across restarts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "liminal-gateway-session-"));
  try {
    const firstRuntime = createGatewayRuntime({
      sessionDir: dir,
      clock: sequenceClock("2026-06-27T20:00:00.000Z"),
      idGen: sequenceId("persist"),
    });
    await firstRuntime.gateway.intercept(pr20);
    const queued = (await firstRuntime.gateway.pending())[0]!;
    const dropped = await firstRuntime.gateway.drop({
      queueId: queued.id,
      reason: "never merge without both reviewers approving",
      activate: true,
    });
    assert.equal(dropped.compiledRules[0]!.status, "active");

    const restartedRuntime = createGatewayRuntime({
      sessionDir: dir,
      mode: "learned",
      clock: sequenceClock("2026-06-27T20:10:00.000Z"),
      idGen: sequenceId("restart"),
    });
    const repeat = await restartedRuntime.gateway.intercept({
      ...pr35,
      id: "ia_persisted_policy_repeat",
      requestedAt: "2026-06-27T20:10:00.000Z",
    });

    assert.equal(repeat.verdict, "deny");
    assert.equal(repeat.source, "policy");
    assert.equal(repeat.sourceRuleId, dropped.compiledRules[0]!.id);
    assert.ok((await restartedRuntime.gateway.history()).some((entry) => entry.notes?.includes("intercept.drop")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("past incident replay drops escalation from 100 percent to 20 percent with zero safety regressions", async () => {
  const setup = gatewaySetup();
  const decisions: PolicyDecision[] = [];
  let operatorDecisionCount = 0;
  const activeRules: ActionPolicyRule[] = [];
  const evalResults: EvalResult[] = [];

  for (const incident of incidentCorpus) {
    const first = await setup.gateway.intercept(incident.action);
    decisions.push(first);
    assert.equal(first.verdict, "ask");

    const queued = (await setup.queue.pending())[0]!;
    const verdict = await setup.gateway.operatorVerdict({
      queueId: queued.id,
      verdict: "disapprove",
      reason: incident.reason,
      activate: true,
    });
    operatorDecisionCount += 1;
    const rule = verdict.compiledRules[0]!;
    const evalCase = verdict.evalCases[0]!;
    activeRules.push(rule);
    evalResults.push(
      {
        id: `${evalCase.id}_before`,
        dealId: "deal_policy_loop",
        evalCaseId: evalCase.id,
        passNumber: 1,
        criterion: evalCase.criterion,
        result: "fail",
      },
      {
        id: `${evalCase.id}_after`,
        dealId: "deal_policy_loop",
        evalCaseId: evalCase.id,
        passNumber: 2,
        criterion: evalCase.criterion,
        result: "pass",
      },
    );
  }

  setup.gateway.setMode("learned");
  for (let round = 0; round < 4; round++) {
    for (const incident of incidentCorpus) {
      decisions.push(await setup.gateway.intercept(replayAction(incident.action, round)));
    }
  }

  assert.equal(finalEscalationRate(decisions), 0.2);
  assert.equal(isMonotonicNonIncreasing(escalationSeries(decisions)), true);
  assert.equal(countSafetyRegressions(decisions, decisions.map(() => "deny")), 0);
  const events = setup.ledger.events();
  assert.equal(verifyChain(events).valid, true);
  const verdictEvents = events.filter((event) => event.action === "policy.verdict");
  assert.equal(verdictEvents.length, decisions.length + operatorDecisionCount);
  assert.ok(verdictEvents.every((event) => event.afterState?.["policyVerdict"] !== undefined));
  assert.ok(activeRules.every((rule) => rule.status === "active"));
  assert.ok(activeRules.every((rule) => rule.evalCaseId.length > 0));
  assert.ok(ruleHealthTable(activeRules, evalResults).every((row) => row.healthy));
});

test("InterceptGateway fails closed when the intercept queue cannot hold an ask", async () => {
  const setup = gatewaySetup({ queue: new ThrowingQueue() });
  const decision = await setup.gateway.intercept(pr20);
  assert.equal(decision.verdict, "deny");
  assert.match(decision.reasons[0]!, /Intercept queue failed closed/);
  assert.equal(verifyChain(setup.ledger.events()).valid, true);
});

test("decision server exposes health, intercept, queue, and verdict routes", async () => {
  const setup = gatewaySetup();
  const server = createDecisionServer(setup.gateway);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const url = (path: string) => `http://127.0.0.1:${port}${path}`;

  try {
    const health = await fetchJson<{ mode: string; ruleCount: number }>(url("/health"));
    assert.deepEqual(health, { mode: "intercept", ruleCount: 0, queueDepth: 0, historyCount: 0 });

    const mode = await fetchJson<{ mode: string }>(url("/mode"), { mode: "shadow" });
    assert.equal(mode.mode, "shadow");
    await fetchJson<{ mode: string }>(url("/mode"), { mode: "intercept" });

    const decision = await fetchJson<{ verdict: string }>(url("/intercept"), pr20);
    assert.equal(decision.verdict, "ask");

    const outcome = await fetchJson<{ exitCode: number }>(url("/outcome"), {
      actionId: pr20.id,
      exitCode: 0,
      completedAt: "2026-06-27T20:00:30.000Z",
    });
    assert.equal(outcome.exitCode, 0);

    const history = await fetchJson<unknown[]>(url("/history"));
    assert.equal(history.length, 1);
    assert.deepEqual((history[0] as { outcome: unknown }).outcome, {
      actionId: pr20.id,
      exitCode: 0,
      completedAt: "2026-06-27T20:00:30.000Z",
    });

    const repeated = await fetchJson<{ decision: { verdict: string } }>(url("/repeater"), {
      historyId: (history[0] as { id: string }).id,
      mode: "shadow",
    });
    assert.equal(repeated.decision.verdict, "allow");

    const queue = await fetchJson<QueuedIntercept[]>(url("/queue"));
    assert.equal(queue.length, 1);

    const verdict = await fetchJson<{ compiledRules: ActionPolicyRule[] }>(url("/verdict"), {
      queueId: queue[0]!.id,
      verdict: "disapprove",
      reason: "never merge without both reviewers approving",
      activate: true,
    });
    assert.equal(verdict.compiledRules[0]!.status, "active");

    const rules = await fetchJson<unknown[]>(url("/match-replace"), [
      {
        id: "target-prod-to-staging",
        enabled: true,
        field: "target",
        match: "prod",
        replace: "staging",
      },
    ]);
    assert.equal(rules.length, 1);

    await fetchJson<unknown[]>(url("/forward-all"), { reason: "bulk forward remaining" });
  } finally {
    server.close();
    await once(server, "close");
  }
});

function gatewaySetup(overrides: { queue?: InterceptQueue } = {}) {
  const store = new InMemoryPolicyStore();
  const queue = overrides.queue ?? new InMemoryInterceptQueue();
  const ledger = new AuditLedger();
  const history = new InMemoryProxyHistory();
  const gateway = new InterceptGateway({
    policyStore: store,
    interceptQueue: queue,
    history,
    ledger,
    clock: sequenceClock("2026-06-27T20:00:00.000Z"),
    idGen: sequenceId("gw"),
    mode: "intercept",
    caseId: "gc_policy_loop",
    dealId: "deal_policy_loop",
    decidingActor: "Operator",
  });
  return { gateway, store, queue, ledger, history };
}

function replayAction(action: InterceptedAction, round: number): InterceptedAction {
  const idSuffix = `${round}_${action.id}`;
  return {
    ...action,
    id: `replay_${idSuffix}`,
    requestedAt: new Date(Date.parse(action.requestedAt) + (round + 1) * 60_000).toISOString(),
  };
}

async function fetchJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, body === undefined
    ? undefined
    : {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
  if (!response.ok) {
    assert.fail(await response.text());
  }
  return await response.json() as T;
}

class ThrowingQueue implements InterceptQueue {
  async enqueue(): Promise<void> {
    throw new Error("queue offline");
  }
  async pending(): Promise<QueuedIntercept[]> {
    return [];
  }
  async remove(): Promise<QueuedIntercept | null> {
    return null;
  }
}

function sequenceId(prefix: string) {
  let i = 0;
  return { next: () => `${prefix}_${++i}` };
}

function sequenceClock(start: string) {
  let i = 0;
  const startMs = Date.parse(start);
  return {
    now: () => new Date(startMs + i++ * 1000).toISOString(),
  };
}
