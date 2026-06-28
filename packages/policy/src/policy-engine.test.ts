import { test } from "node:test";
import assert from "node:assert/strict";
import type { InterceptedAction, ActionPolicyRule } from "@liminal-engine/contracts";
import { decide, decideFromStore } from "./policy-engine.ts";

const prMerge: InterceptedAction = {
  id: "ia_pr35_merge",
  tool: "gh",
  action: "pr-merge",
  target: "PR#35",
  args: { reviews: { approved: 1, rejected: 0 } },
  requestedAt: "2026-06-27T20:01:00.000Z",
};

const dualApprovalRule: ActionPolicyRule = {
  id: "prule_dual_approval",
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

test("decide auto-denies a matching learned rule with provenance", () => {
  const decision = decide(prMerge, [dualApprovalRule], { mode: "learned" });
  assert.equal(decision.verdict, "deny");
  assert.equal(decision.allowed, false);
  assert.equal(decision.source, "policy");
  assert.equal(decision.sourceRuleId, dualApprovalRule.id);
});

test("decide uses specificity before verdict tie-breaking", () => {
  const broadAsk: ActionPolicyRule = {
    ...dualApprovalRule,
    id: "prule_broad_ask",
    scope: { tool: "gh", action: "pr-merge" },
    effect: {
      verdict: "ask",
      actionType: "require_approval",
      reasons: ["Ask before PR merge."],
      requiredBefore: ["Receive approval."],
    },
  };
  const targetDeny: ActionPolicyRule = {
    ...dualApprovalRule,
    id: "prule_target_deny",
    scope: { tool: "gh", action: "pr-merge", targetPattern: "PR#*" },
  };

  const decision = decide(prMerge, [broadAsk, targetDeny], { mode: "learned" });
  assert.equal(decision.verdict, "deny");
  assert.equal(decision.sourceRuleId, "prule_target_deny");
});

test("decide tie-breaks equal specificity as deny over ask over allow", () => {
  const askRule: ActionPolicyRule = {
    ...dualApprovalRule,
    id: "prule_equal_ask",
    effect: {
      verdict: "ask",
      actionType: "require_approval",
      reasons: ["Ask first."],
      requiredBefore: ["Receive approval."],
    },
  };
  const denyRule: ActionPolicyRule = { ...dualApprovalRule, id: "prule_equal_deny" };

  const decision = decide(prMerge, [askRule, denyRule], { mode: "learned" });
  assert.equal(decision.verdict, "deny");
  assert.equal(decision.sourceRuleId, "prule_equal_deny");
});

test("decide allows unknown actions in shadow but asks in intercept and learned modes", () => {
  assert.equal(decide(prMerge, [], { mode: "shadow" }).verdict, "allow");
  assert.equal(decide(prMerge, [], { mode: "intercept" }).verdict, "ask");
  assert.equal(decide(prMerge, [], { mode: "learned" }).verdict, "ask");
});

test("decideFromStore fails closed on policy store errors", async () => {
  const decision = await decideFromStore(
    prMerge,
    {
      async activeRules(): Promise<ActionPolicyRule[]> {
        throw new Error("store offline");
      },
    },
    { mode: "learned" },
  );
  assert.equal(decision.verdict, "deny");
  assert.equal(decision.allowed, false);
  assert.equal(decision.source, "default-deny");
  assert.match(decision.reasons[0]!, /store offline/);
});
