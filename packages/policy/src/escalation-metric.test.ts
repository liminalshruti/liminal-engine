import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countSafetyRegressions,
  escalationSeries,
  finalEscalationRate,
  isMonotonicNonIncreasing,
} from "./escalation-metric.ts";
import type { PolicyDecision } from "./policy-engine.ts";

const ask: PolicyDecision = {
  verdict: "ask",
  allowed: false,
  reasons: ["operator needed"],
  requiredBeforeSend: ["approve or deny"],
  source: "default-deny",
};
const deny: PolicyDecision = {
  verdict: "deny",
  allowed: false,
  reasons: ["blocked"],
  requiredBeforeSend: ["fix"],
  source: "policy",
  sourceRuleId: "prule",
};

test("escalationSeries tracks monotone decay after the first learned rule", () => {
  const series = escalationSeries([ask, deny, deny, deny, deny]);
  assert.deepEqual(series.map((sample) => sample.escalationRate), [1, 0.5, 1 / 3, 0.25, 0.2]);
  assert.equal(finalEscalationRate([ask, deny, deny, deny, deny]), 0.2);
  assert.equal(isMonotonicNonIncreasing(series), true);
});

test("countSafetyRegressions counts deny-expected actions that were allowed", () => {
  const allow: PolicyDecision = {
    verdict: "allow",
    allowed: true,
    reasons: [],
    requiredBeforeSend: [],
    source: "policy",
  };
  assert.equal(countSafetyRegressions([deny, allow], ["deny", "deny"]), 1);
});
