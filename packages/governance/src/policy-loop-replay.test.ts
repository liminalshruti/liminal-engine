import { test } from "node:test";
import assert from "node:assert/strict";
import type { CorrectionEvent, EvalResult, InterceptedAction, ActionPolicyRule } from "@liminal-engine/contracts";
import {
  countSafetyRegressions,
  decide,
  escalationSeries,
  finalEscalationRate,
  isMonotonicNonIncreasing,
} from "@liminal-engine/policy";
import { AuditLedger, verifyChain } from "./audit-ledger.ts";
import { compileCorrection } from "./compile-correction.ts";
import type { Clock, IdGen } from "./detect-miss.ts";
import {
  appendPolicyRuleAudit,
  appendPolicyVerdictAudit,
  reconstructPolicyRuleLifecycle,
} from "./policy-audit.ts";
import { ruleHealthTable } from "../../eval-harness/src/rule-health.ts";

const correction: CorrectionEvent = {
  id: "ce_pr20_reject",
  caseId: "gc_pr20_merge",
  dealId: "deal_policy_loop",
  correction: "never merge without both reviewers approving",
  decidingActor: "Operator",
  correctedAt: "2026-06-27T20:00:00.000Z",
};

test("PR-#20 replay: one disapprove learns a rule, auto-denies repeats, audits provenance, and flips rule eval", () => {
  const corpus = prMergeCorpus();
  const baseline = corpus.map((action) => decide(action, [], { mode: "intercept" }));
  assert.equal(finalEscalationRate(baseline), 1);
  assert.ok(baseline.every((decision) => decision.verdict === "ask"));

  const gen = { idGen: sequenceId("loop"), clock: sequenceClock("2026-06-27T20:00:00.000Z") };
  const firstDecision = baseline[0]!;
  const compiled = compileCorrection(correction, {
    ...gen,
    originatingAction: corpus[0],
  });
  const proposedRule = compiled.policyRules[0]!;
  const activeRule: ActionPolicyRule = { ...proposedRule, status: "active" };

  const learned = [
    firstDecision,
    ...corpus.slice(1).map((action) => decide(action, [activeRule], { mode: "learned" })),
  ];
  assert.equal(finalEscalationRate(learned), 0.2);
  assert.equal(isMonotonicNonIncreasing(escalationSeries(learned)), true);
  assert.equal(countSafetyRegressions(learned, ["deny", "deny", "deny", "deny", "deny"]), 0);
  assert.ok(learned.slice(1).every((decision) => decision.source === "policy"));
  assert.ok(learned.slice(1).every((decision) => decision.sourceRuleId === activeRule.id));

  const ledger = new AuditLedger();
  appendPolicyVerdictAudit(
    ledger,
    {
      caseId: correction.caseId,
      dealId: correction.dealId,
      decidingActor: correction.decidingActor,
      action: corpus[0]!,
      decision: firstDecision,
    },
    gen,
  );
  appendPolicyRuleAudit(
    ledger,
    {
      caseId: correction.caseId,
      dealId: correction.dealId,
      decidingActor: correction.decidingActor,
      rule: proposedRule,
    },
    gen,
  );
  appendPolicyRuleAudit(
    ledger,
    {
      caseId: correction.caseId,
      dealId: correction.dealId,
      decidingActor: correction.decidingActor,
      rule: activeRule,
    },
    gen,
  );
  appendPolicyVerdictAudit(
    ledger,
    {
      caseId: correction.caseId,
      dealId: correction.dealId,
      decidingActor: correction.decidingActor,
      action: corpus[1]!,
      decision: learned[1]!,
      fromCorrectionId: correction.id,
    },
    gen,
  );

  const events = ledger.events();
  assert.equal(verifyChain(events).valid, true);
  const lifecycle = reconstructPolicyRuleLifecycle(events, activeRule.id);
  assert.equal(lifecycle.currentStatus, "active");
  assert.deepEqual(lifecycle.versions.map((rule) => rule.status), ["proposed", "active"]);

  const evalCase = compiled.evalCases[0]!;
  const evals: EvalResult[] = [
    {
      id: "ev_pr20_before",
      dealId: correction.dealId,
      evalCaseId: evalCase.id,
      passNumber: 1,
      criterion: evalCase.criterion,
      result: "fail",
    },
    {
      id: "ev_pr20_after",
      dealId: correction.dealId,
      evalCaseId: evalCase.id,
      passNumber: 2,
      criterion: evalCase.criterion,
      result: "pass",
    },
  ];
  assert.deepEqual(ruleHealthTable([activeRule], evals), [
    {
      ruleId: activeRule.id,
      evalCaseId: evalCase.id,
      before: "fail",
      after: "pass",
      healthy: true,
    },
  ]);
});

function prMergeCorpus(): InterceptedAction[] {
  return [20, 35, 36, 37, 38].map((n, index) => ({
    id: `ia_pr${n}_merge`,
    tool: "gh",
    action: "pr-merge",
    target: `PR#${n}`,
    args: { reviews: { approved: 1, rejected: index === 0 ? 1 : 0 } },
    agentId: "codex-dispatcher",
    sessionId: "session_policy_loop",
    goalId: "goal_policy_loop",
    lane: "lane:shayaun-main",
    requestedAt: new Date(Date.parse("2026-06-27T20:00:00.000Z") + index * 1000).toISOString(),
  }));
}

function sequenceId(prefix: string): IdGen {
  let i = 0;
  return { next: () => `${prefix}_${++i}` };
}

function sequenceClock(start: string): Clock {
  let i = 0;
  const startMs = Date.parse(start);
  return {
    now: () => new Date(startMs + i++ * 1000).toISOString(),
  };
}
