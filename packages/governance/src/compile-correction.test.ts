import { test } from "node:test";
import assert from "node:assert/strict";
import type { CorrectionEvent, InterceptedAction } from "@liminal-engine/contracts";
import { compileCorrection } from "./compile-correction.ts";
import type { Clock, IdGen } from "./detect-miss.ts";

const correction: CorrectionEvent = {
  id: "ce_pr20_reject",
  caseId: "gc_pr20_merge",
  dealId: "deal_policy_loop",
  correction: "never merge without both reviewers approving",
  decidingActor: "Operator",
  correctedAt: "2026-06-27T20:00:00.000Z",
};

const pr20: InterceptedAction = {
  id: "ia_pr20_merge",
  tool: "gh",
  action: "pr-merge",
  target: "PR#20",
  args: { reviews: { approved: 1, rejected: 1 } },
  requestedAt: "2026-06-27T19:59:00.000Z",
};

test("compileCorrection maps PR merge rejection into a proposed ActionPolicyRule plus activation action and EvalCase", () => {
  const result = compileCorrection(correction, deps());

  assert.equal(result.policyRules.length, 1);
  assert.equal(result.enforcementActions.length, 1);
  assert.equal(result.evalCases.length, 1);
  assert.equal(result.preview.length, 1);

  const rule = result.policyRules[0]!;
  assert.equal(rule.status, "proposed");
  assert.equal(rule.fromCorrectionId, correction.id);
  assert.equal(rule.evalCaseId, result.evalCases[0]!.id);
  assert.deepEqual(rule.scope, {
    tool: "gh",
    action: "pr-merge",
    targetPattern: "PR#*",
    condition: { field: "reviews.approved", op: "<", value: 2 },
  });
  assert.equal(rule.effect.verdict, "deny");
  assert.equal(rule.effect.actionType, "block_agent_action");

  const action = result.enforcementActions[0]!;
  assert.equal(action.actionType, "activate_policy");
  assert.equal(action.targetSystem, "policy");
  assert.deepEqual(action.payload, {
    ruleId: rule.id,
    ruleStatus: "proposed",
    effectActionType: "block_agent_action",
    evalCaseId: result.evalCases[0]!.id,
  });
});

test("compileCorrection rejects vague operator text with an actionable error", () => {
  assert.throws(
    () =>
      compileCorrection({ ...correction, correction: "do better" }, deps()),
    /vague correction 'do better' rejected/,
  );
});

test("compileCorrection splits compound corrections into atomic rules", () => {
  const result = compileCorrection(
    {
      ...correction,
      correction: "never fork repositories; ask before deploy",
    },
    deps(),
  );

  assert.equal(result.policyRules.length, 2);
  assert.deepEqual(
    result.policyRules.map((rule) => [rule.scope.tool, rule.scope.action, rule.effect.verdict]),
    [
      ["gh", "repo-fork", "deny"],
      ["deploy", "deploy", "ask"],
    ],
  );
});

test("compileCorrection scopes generic text to the originating intercepted action", () => {
  const result = compileCorrection(
    {
      ...correction,
      correction: "ask before this action",
    },
    { ...deps(), originatingAction: pr20 },
  );
  assert.deepEqual(result.policyRules[0]!.scope, {
    tool: "gh",
    action: "pr-merge",
    targetPattern: "PR#*",
  });
});

function deps(): { clock: Clock; idGen: IdGen; originatingAction: InterceptedAction } {
  return {
    idGen: sequenceId("cc"),
    clock: sequenceClock("2026-06-27T20:00:00.000Z"),
    originatingAction: pr20,
  };
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
