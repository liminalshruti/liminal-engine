import { test } from "node:test";
import assert from "node:assert/strict";
import type { EvalResult, ActionPolicyRule } from "@liminal-engine/contracts";
import { ruleHealthTable } from "./rule-health.ts";

const rule: ActionPolicyRule = {
  id: "prule_eval",
  version: 1,
  fromCorrectionId: "ce_eval",
  evalCaseId: "ec_eval",
  scope: { tool: "gh", action: "pr-merge" },
  effect: {
    verdict: "deny",
    actionType: "block_agent_action",
    reasons: ["Never merge without both reviewers approving."],
    requiredBefore: ["Collect at least two approving reviews before merging."],
  },
  status: "active",
  createdAt: "2026-06-27T20:00:00.000Z",
};

test("ruleHealthTable reports Fail -> Pass for a learned rule eval", () => {
  const results: EvalResult[] = [
    {
      id: "ev_after",
      dealId: "deal",
      evalCaseId: "ec_eval",
      passNumber: 2,
      criterion: "rule holds",
      result: "pass",
    },
    {
      id: "ev_before",
      dealId: "deal",
      evalCaseId: "ec_eval",
      passNumber: 1,
      criterion: "rule holds",
      result: "fail",
    },
  ];

  assert.deepEqual(ruleHealthTable([rule], results), [
    {
      ruleId: "prule_eval",
      evalCaseId: "ec_eval",
      before: "fail",
      after: "pass",
      healthy: true,
    },
  ]);
});
