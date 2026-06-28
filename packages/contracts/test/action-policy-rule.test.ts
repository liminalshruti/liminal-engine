import { test } from "node:test";
import assert from "node:assert/strict";
import {
  interceptedActionContract,
  actionPolicyRuleContract,
  type ActionPolicyRule,
} from "../src/index.ts";

const validRule: ActionPolicyRule = {
  id: "prule_test",
  version: 1,
  fromCorrectionId: "ce_test",
  evalCaseId: "ec_test",
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

test("ActionPolicyRule accepts closed structured conditions", () => {
  assert.deepEqual(actionPolicyRuleContract.parse(validRule), validRule);
});

test("ActionPolicyRule rejects deny effects without reasons", () => {
  assert.throws(
    () =>
      actionPolicyRuleContract.parse({
        ...validRule,
        effect: { ...validRule.effect, reasons: [] },
      }),
    /deny\/ask policy effects require at least one reason/,
  );
});

test("ActionPolicyRule rejects allow effects that carry blocking details", () => {
  assert.throws(
    () =>
      actionPolicyRuleContract.parse({
        ...validRule,
        effect: {
          ...validRule.effect,
          verdict: "allow",
          reasons: ["still blocked"],
        },
      }),
    /allow policy effects must not carry blocking reasons/,
  );
});

test("ActionPolicyRule rejects non-numeric values for numeric comparisons", () => {
  assert.throws(
    () =>
      actionPolicyRuleContract.parse({
        ...validRule,
        scope: {
          ...validRule.scope,
          condition: { field: "reviews.approved", op: "<", value: "two" },
        },
      }),
    /numeric comparison conditions require a numeric value/,
  );
});

test("ActionPolicyRule rejects narrowed rules without provenance", () => {
  assert.throws(
    () => actionPolicyRuleContract.parse({ ...validRule, status: "narrowed" }),
    /narrowed policy rules must point at the rule they supersede/,
  );
});

test("InterceptedAction rejects undeclared fields at the boundary", () => {
  assert.throws(
    () =>
      interceptedActionContract.parse({
        id: "ia_test",
        tool: "gh",
        action: "pr-merge",
        args: {},
        requestedAt: "2026-06-27T20:00:00.000Z",
        unexpected: true,
      }),
    /Unrecognized key/,
  );
});
