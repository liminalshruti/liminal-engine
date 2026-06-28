import { test } from "node:test";
import assert from "node:assert/strict";
import type { InterceptedAction } from "@liminal-engine/contracts";
import { applyMatchReplaceRules } from "./match-replace.ts";

const deploy: InterceptedAction = {
  id: "ia_deploy",
  tool: "deploy",
  action: "deploy",
  target: "prod",
  args: { deploy: { environment: "prod" } },
  requestedAt: "2026-06-27T20:00:00.000Z",
};

test("applyMatchReplaceRules applies enabled rules in order", () => {
  const result = applyMatchReplaceRules(deploy, [
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

  assert.deepEqual(result.appliedRuleIds, ["target-prod-to-staging", "env-prod-to-staging"]);
  assert.equal(result.action.target, "staging");
  assert.deepEqual(result.action.args, { deploy: { environment: "staging" } });
});

test("applyMatchReplaceRules supports wildcard string matching and skips disabled rules", () => {
  const result = applyMatchReplaceRules(deploy, [
    {
      id: "disabled",
      enabled: false,
      field: "target",
      match: "prod",
      replace: "ignored",
    },
    {
      id: "wildcard",
      enabled: true,
      field: "target",
      match: "pr*",
      replace: "stage",
      mode: "wildcard",
    },
  ]);

  assert.deepEqual(result.appliedRuleIds, ["wildcard"]);
  assert.equal(result.action.target, "stage");
});
