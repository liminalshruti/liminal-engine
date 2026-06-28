import { test } from "node:test";
import assert from "node:assert/strict";
import type { CorrectionEvent, InterceptedAction, ActionPolicyRule } from "@liminal-engine/contracts";
import { decide } from "@liminal-engine/policy";
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

// LIM-1375 regression fixtures: a PR with an open rejection vs a clean approved PR.
const prWithRejection: InterceptedAction = {
  id: "ia_pr21_merge",
  tool: "gh",
  action: "pr-merge",
  target: "PR#21",
  args: { reviews: { approved: 1, rejected: 1 } },
  requestedAt: "2026-06-27T21:00:00.000Z",
};

const cleanPr: InterceptedAction = {
  id: "ia_pr22_merge",
  tool: "gh",
  action: "pr-merge",
  target: "PR#22",
  args: { reviews: { approved: 2, rejected: 0 } },
  requestedAt: "2026-06-27T21:01:00.000Z",
};

// Models the prior learned "clean two-approval merges are allowed" posture the
// gateway compiles on operator approval (compileApprovalRule). The learned deny
// rule must carve out ONLY the rejection case and leave this posture intact.
const baselineAllowCleanMerge: ActionPolicyRule = {
  id: "aprule_baseline_allow_clean_merge",
  version: 1,
  fromCorrectionId: "ce_baseline_allow",
  evalCaseId: "ec_baseline_allow",
  scope: {
    tool: "gh",
    action: "pr-merge",
    targetPattern: "PR#*",
    condition: { field: "reviews.approved", op: ">=", value: 2 },
  },
  effect: { verdict: "allow", actionType: "activate_policy", reasons: [], requiredBefore: [] },
  status: "active",
  createdAt: "2026-06-27T19:00:00.000Z",
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

test("compileCorrection maps a rejection merge correction to a reviews.rejected condition, not a blanket pr-merge block (LIM-1375)", () => {
  const result = compileCorrection(
    { ...correction, correction: "never merge with an open rejection" },
    deps(),
  );

  assert.equal(result.policyRules.length, 1);
  const rule = result.policyRules[0]!;
  assert.equal(rule.effect.verdict, "deny");
  // The compiled rule carries the structured condition the policy engine matches
  // on — it is NOT an unconditional gh pr-merge block.
  assert.deepEqual(rule.scope, {
    tool: "gh",
    action: "pr-merge",
    targetPattern: "PR#*",
    condition: { field: "reviews.rejected", op: ">=", value: 1 },
  });
  assert.notEqual(rule.scope.condition, undefined);
});

test("learned rejection rule denies a PR with an open rejection yet lets a clean approved PR through (LIM-1375 regression)", () => {
  const compiled = compileCorrection(
    { ...correction, correction: "never merge with an open rejection" },
    deps(),
  );
  // The gateway activates a dropped/disapproved rule before it decides.
  const learnedDeny: ActionPolicyRule = { ...compiled.policyRules[0]!, status: "active" };

  // 1) DENY: a PR with reviews.rejected >= 1 is still blocked by the learned rule.
  const denied = decide(prWithRejection, [learnedDeny], { mode: "intercept" });
  assert.equal(denied.verdict, "deny");
  assert.equal(denied.source, "policy");
  assert.equal(denied.sourceRuleId, learnedDeny.id);

  // 2) THE EXACT BUG: the learned rule must NOT match — and so must NOT deny — a
  //    clean, approved PR (reviews.rejected = 0). Before the fix the unconditional
  //    rule matched every gh pr-merge and denied this clean PR too.
  const cleanVsLearnedOnly = decide(cleanPr, [learnedDeny], { mode: "intercept" });
  assert.notEqual(cleanVsLearnedOnly.verdict, "deny");
  assert.notEqual(cleanVsLearnedOnly.source, "policy"); // the learned deny rule did not fire

  // 3) CLEAN-PASS: with the real "approved merges are allowed" posture in place,
  //    the clean PR is allowed while the rejection PR stays denied — smart, not broken.
  const cleanAllowed = decide(cleanPr, [baselineAllowCleanMerge, learnedDeny], { mode: "intercept" });
  assert.equal(cleanAllowed.verdict, "allow");
  assert.equal(cleanAllowed.allowed, true);

  const rejectionDenied = decide(prWithRejection, [baselineAllowCleanMerge, learnedDeny], { mode: "intercept" });
  assert.equal(rejectionDenied.verdict, "deny");
  assert.equal(rejectionDenied.sourceRuleId, learnedDeny.id);
});

test("compileCorrection maps the 'while a review is rejected' phrasing to the same reviews.rejected condition (LIM-1375)", () => {
  const result = compileCorrection(
    { ...correction, correction: "never merge while a review is rejected" },
    deps(),
  );
  assert.equal(result.policyRules[0]!.effect.verdict, "deny");
  assert.deepEqual(result.policyRules[0]!.scope.condition, {
    field: "reviews.rejected",
    op: ">=",
    value: 1,
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
