import { test } from "node:test";
import assert from "node:assert/strict";
import {
  actionGateContract,
  actionGateDecision,
  deriveActionGateAllowed,
  isAllowed,
} from "../src/action-gate.contract.ts";

const baseGate = {
  id: "ag_test",
  caseId: "gc_test",
  action: "Send customer-facing status update",
};

test("ActionGate derives permit state from verdict only", () => {
  const denied = actionGateContract.parse({
    ...baseGate,
    verdict: "deny",
    reasons: ["Open governance case must be corrected first."],
    requiredBeforeSend: ["Pass the related EvalCase."],
  });

  assert.equal(deriveActionGateAllowed(denied), false);
  assert.deepEqual(actionGateDecision(denied), {
    allowed: false,
    reasons: ["Open governance case must be corrected first."],
    requiredBeforeSend: ["Pass the related EvalCase."],
  });

  const allowed = actionGateContract.parse({
    ...baseGate,
    id: "ag_allowed",
    verdict: "allow",
    reasons: [],
    requiredBeforeSend: [],
  });

  assert.equal(deriveActionGateAllowed(allowed), true);
  assert.deepEqual(actionGateDecision(allowed), {
    allowed: true,
    reasons: [],
    requiredBeforeSend: [],
  });
});

test("ActionGate rejects contradictory persisted permit fields", () => {
  assert.throws(
    () =>
      actionGateContract.parse({
        ...baseGate,
        verdict: "deny",
        blocked: false,
        reasons: ["Open governance case must be corrected first."],
        requiredBeforeSend: ["Pass the related EvalCase."],
      }),
    /Unrecognized key/,
  );

  assert.throws(
    () =>
      actionGateContract.parse({
        ...baseGate,
        verdict: "deny",
        allowed: true,
        reasons: ["Open governance case must be corrected first."],
        requiredBeforeSend: ["Pass the related EvalCase."],
      }),
    /Unrecognized key/,
  );
});

test("ActionGate rejects internally contradictory verdict details", () => {
  assert.throws(
    () =>
      actionGateContract.parse({
        ...baseGate,
        verdict: "deny",
        reasons: [],
        requiredBeforeSend: ["Pass the related EvalCase."],
      }),
    /deny verdicts must include at least one reason/,
  );

  assert.throws(
    () =>
      actionGateContract.parse({
        ...baseGate,
        verdict: "allow",
        reasons: ["Open governance case must be corrected first."],
        requiredBeforeSend: [],
      }),
    /allow verdicts must not carry blocking reasons/,
  );

  assert.throws(
    () =>
      actionGateContract.parse({
        ...baseGate,
        verdict: "allow",
        reasons: [],
        requiredBeforeSend: ["Pass the related EvalCase."],
      }),
    /allow verdicts must not require remediation before send/,
  );
});

test("LIM-1269: ActionGate accepts optional verdict provenance (source + sourceRuleId)", () => {
  const policyDeny = actionGateContract.parse({
    ...baseGate,
    id: "ag_policy",
    verdict: "deny",
    reasons: ["Learned policy rule denies this action."],
    requiredBeforeSend: ["Obtain both reviewer approvals."],
    source: "policy",
    sourceRuleId: "pr_rule_dual_review_v1",
  });

  assert.equal(policyDeny.source, "policy");
  assert.equal(policyDeny.sourceRuleId, "pr_rule_dual_review_v1");
  // Provenance is orthogonal to the derived decision — a deny stays not-allowed.
  assert.equal(deriveActionGateAllowed(policyDeny), false);
  assert.equal(isAllowed(policyDeny), false);
});

test("LIM-1269: verdict provenance does not alter derived allowance", () => {
  const operatorAllow = actionGateContract.parse({
    ...baseGate,
    id: "ag_operator_allow",
    verdict: "allow",
    reasons: [],
    requiredBeforeSend: [],
    source: "operator",
  });
  assert.equal(operatorAllow.source, "operator");
  assert.equal(deriveActionGateAllowed(operatorAllow), true);
  assert.equal(isAllowed(operatorAllow), true);
  assert.deepEqual(actionGateDecision(operatorAllow), {
    allowed: true,
    reasons: [],
    requiredBeforeSend: [],
  });

  const failClosed = actionGateContract.parse({
    ...baseGate,
    id: "ag_fail_closed",
    verdict: "deny",
    reasons: ["Policy store unreachable — failing closed."],
    requiredBeforeSend: ["Restore connectivity, then re-evaluate."],
    source: "default-deny",
  });
  assert.equal(failClosed.source, "default-deny");
  assert.equal(deriveActionGateAllowed(failClosed), false);
});

test("LIM-1269 back-compat: a source-less gate omits provenance from its canonical projection", () => {
  const sourceLess = actionGateContract.parse({
    ...baseGate,
    verdict: "deny",
    reasons: ["Open governance case must be corrected first."],
    requiredBeforeSend: ["Pass the related EvalCase."],
  });

  const canonical = actionGateContract.canonical(sourceLess) as Record<string, unknown>;
  assert.equal("source" in canonical, false);
  assert.equal("source_rule_id" in canonical, false);

  // Adding provenance is hashed (it enters the projection when present), so the
  // two digests differ — proving `source` is not silently dropped.
  const withSource = actionGateContract.parse({ ...sourceLess, source: "policy" });
  assert.notEqual(actionGateContract.hash(sourceLess), actionGateContract.hash(withSource));
  // ...and the same gate hashes stably.
  assert.equal(actionGateContract.hash(sourceLess), actionGateContract.hash(sourceLess));
});

test("LIM-1269: ActionGate rejects an unknown source and an empty sourceRuleId", () => {
  assert.throws(
    () =>
      actionGateContract.parse({
        ...baseGate,
        verdict: "allow",
        reasons: [],
        requiredBeforeSend: [],
        source: "robot",
      }),
    /Invalid enum value|Invalid option/,
  );

  assert.throws(
    () =>
      actionGateContract.parse({
        ...baseGate,
        verdict: "deny",
        reasons: ["Learned policy rule denies this action."],
        requiredBeforeSend: [],
        source: "policy",
        sourceRuleId: "",
      }),
    /at least 1 character|too_small|String must contain/,
  );
});
