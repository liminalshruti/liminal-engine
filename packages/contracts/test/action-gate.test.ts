import { test } from "node:test";
import assert from "node:assert/strict";
import {
  actionGateContract,
  actionGateDecision,
  deriveActionGateAllowed,
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
