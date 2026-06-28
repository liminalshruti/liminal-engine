/**
 * Acme fixtures must (a) validate through their contracts and (b) honor the
 * DEMO_CONTRACT must-not-cut invariants. This ties the deterministic demo data to
 * the locked scenario — if a fixture drifts from the contract, the demo breaks
 * here, not on stage.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { acmeScenario } from "../src/fixtures/acme.ts";
import { agentOutputContract } from "../src/agent-output.contract.ts";
import { governanceCaseContract } from "../src/governance-case.contract.ts";
import { enforcementActionContract } from "../src/enforcement-action.contract.ts";
import { auditEventContract } from "../src/audit-event.contract.ts";
import { actionGateContract } from "../src/action-gate.contract.ts";
import { actionGateDecision } from "../src/action-gate.contract.ts";
import { evalCaseContract } from "../src/eval-case.contract.ts";
import { evalResultContract } from "../src/eval-result.contract.ts";
import { linearWorkstreamPayloadContract } from "../src/linear-workstream-payload.contract.ts";

test("all Acme fixtures validate through their contracts", () => {
  assert.doesNotThrow(() => agentOutputContract.parse(acmeScenario.agentOutputPass1));
  assert.doesNotThrow(() => agentOutputContract.parse(acmeScenario.agentOutputPass2));
  assert.doesNotThrow(() => governanceCaseContract.parse(acmeScenario.governanceCase));
  assert.doesNotThrow(() => enforcementActionContract.parse(acmeScenario.enforcementAction));
  assert.doesNotThrow(() => auditEventContract.parse(acmeScenario.auditEvent));
  assert.doesNotThrow(() => actionGateContract.parse(acmeScenario.blockedAction));
  assert.doesNotThrow(() => evalCaseContract.parse(acmeScenario.evalCase));
  assert.doesNotThrow(() => evalResultContract.parse(acmeScenario.evalPass1));
  assert.doesNotThrow(() => evalResultContract.parse(acmeScenario.evalPass2));
  assert.doesNotThrow(() => linearWorkstreamPayloadContract.parse(acmeScenario.linearWorkstreamPayload));
});

test("must-not-cut #1: pass 1 is a false green (on-track but a requirement was dropped)", () => {
  const p1 = acmeScenario.agentOutputPass1;
  assert.equal(p1.reportedStatus, "on-track");
  assert.ok(p1.droppedRequirements.includes("EU data residency"));
});

test("must-not-cut #2: GovernanceCase surfaces the dropped EU data residency requirement", () => {
  assert.equal(acmeScenario.governanceCase.missedRequirement, "EU data residency");
  assert.equal(acmeScenario.governanceCase.severity, "blocking");
});

test("must-not-cut #3: EnforcementAction flips status on-track -> at-risk", () => {
  assert.equal(acmeScenario.enforcementAction.fromStatus, "on-track");
  assert.equal(acmeScenario.enforcementAction.toStatus, "at-risk");
  assert.equal(acmeScenario.enforcementAction.caseId, acmeScenario.governanceCase.id);
});

test("must-not-cut #4: simulated Linear workstream requires Product/Security/Engineering owners", () => {
  assert.deepEqual([...acmeScenario.requiredOwners], ["Product", "Security", "Engineering"]);
  // the workstream payload carries the same required owners + a workstream per owner
  const payload = acmeScenario.linearWorkstreamPayload;
  assert.deepEqual([...payload.requiredOwners], ["Product", "Security", "Engineering"]);
  assert.equal(payload.dealId, acmeScenario.governanceCase.dealId);
  assert.ok(payload.workstreams.some((w) => w.owner === "Engineering" && w.status === "at-risk"));
});

test("must-not-cut #5: a downstream customer action is blocked until corrected", () => {
  const decision = actionGateDecision(acmeScenario.blockedAction);
  assert.equal(decision.allowed, false);
  assert.equal("blocked" in acmeScenario.blockedAction, false);
  assert.equal("allowed" in acmeScenario.blockedAction, false);
  assert.equal(acmeScenario.blockedAction.caseId, acmeScenario.governanceCase.id);
  assert.ok(decision.reasons.some((reason) => reason.includes("EU data residency")));
  assert.ok(decision.requiredBeforeSend.some((item) => item.includes("EvalCase")));
});

test("must-not-cut #6: AuditEvent records the correction + deciding actor and the flip", () => {
  assert.equal(acmeScenario.auditEvent.previousStatus, "on-track");
  assert.equal(acmeScenario.auditEvent.newStatus, "at-risk");
  assert.ok(acmeScenario.auditEvent.decidingActor.length > 0);
});

test("must-not-cut #7: EvalCase generated + eval shows Fail -> Pass across passes", () => {
  assert.equal(acmeScenario.evalCase.governanceCaseId, acmeScenario.governanceCase.id);
  assert.equal(acmeScenario.evalPass1.evalCaseId, acmeScenario.evalCase.id);
  assert.equal(acmeScenario.evalPass2.evalCaseId, acmeScenario.evalCase.id);
  assert.equal(acmeScenario.evalPass1.result, "fail");
  assert.equal(acmeScenario.evalPass2.result, "pass");
  assert.equal(acmeScenario.evalPass1.criterion, acmeScenario.evalPass2.criterion);
});

test("persona rule: deciding actor is a role, not an invented name", () => {
  // crude guard: a role contains a slash or 'operator'/'VP'/'Head', not a "First Last" name.
  const actor = acmeScenario.auditEvent.decidingActor;
  assert.match(actor, /operator|VP|Head|\//i);
});
