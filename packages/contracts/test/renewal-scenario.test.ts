/**
 * Renewal scenario fixture tests. Validates that the renewal scenario follows
 * the same governance loop structure as Acme, proving the loop generalizes to
 * different deal types and risk signals.
 *
 * Test structure mirrors acme-beats.test.ts and fixtures.test.ts to ensure
 * consistency across scenarios.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  renewalScenario,
  renewalDemoBeats,
  renewalBusinessGoal,
  renewalAgentOutputPass1,
  renewalAgentOutputPass2,
  renewalGovernanceCase,
  renewalEnforcementAction,
  renewalAuditEvent,
  renewalBlockedAction,
  renewalEvalCase,
  renewalEvalPass1,
  renewalEvalPass2,
  renewalRequiredOwners,
  renewalLinearWorkstreamPayload,
} from "../src/fixtures/renewal-scenario.ts";
import { agentOutputContract } from "../src/agent-output.contract.ts";
import { governanceCaseContract } from "../src/governance-case.contract.ts";
import { enforcementActionContract } from "../src/enforcement-action.contract.ts";
import { auditEventContract } from "../src/audit-event.contract.ts";
import { actionGateContract, actionGateDecision } from "../src/action-gate.contract.ts";
import { evalCaseContract } from "../src/eval-case.contract.ts";
import { evalResultContract } from "../src/eval-result.contract.ts";
import { linearWorkstreamPayloadContract } from "../src/linear-workstream-payload.contract.ts";

// ===== Contract validation tests =====

test("all renewal fixtures validate through their contracts", () => {
  assert.doesNotThrow(() => agentOutputContract.parse(renewalAgentOutputPass1));
  assert.doesNotThrow(() => agentOutputContract.parse(renewalAgentOutputPass2));
  assert.doesNotThrow(() => governanceCaseContract.parse(renewalGovernanceCase));
  assert.doesNotThrow(() => enforcementActionContract.parse(renewalEnforcementAction));
  assert.doesNotThrow(() => auditEventContract.parse(renewalAuditEvent));
  assert.doesNotThrow(() => actionGateContract.parse(renewalBlockedAction));
  assert.doesNotThrow(() => evalCaseContract.parse(renewalEvalCase));
  assert.doesNotThrow(() => evalResultContract.parse(renewalEvalPass1));
  assert.doesNotThrow(() => evalResultContract.parse(renewalEvalPass2));
  assert.doesNotThrow(() => linearWorkstreamPayloadContract.parse(renewalLinearWorkstreamPayload));
});

// ===== Governance loop structure tests (mirrors Acme must-not-cut tests) =====

test("step 1: pass 1 is a false green (on-track but engagement signal was dropped)", () => {
  const p1 = renewalScenario.agentOutputPass1;
  assert.equal(p1.reportedStatus, "on-track");
  assert.ok(p1.droppedRequirements.includes("Customer engagement decline signal"));
});

test("step 2: GovernanceCase surfaces the dropped engagement signal", () => {
  assert.equal(renewalGovernanceCase.missedRequirement, "Customer engagement decline signal");
  assert.equal(renewalGovernanceCase.severity, "blocking");
});

test("step 3: EnforcementAction flips status on-track -> at-risk", () => {
  assert.equal(renewalEnforcementAction.fromStatus, "on-track");
  assert.equal(renewalEnforcementAction.toStatus, "at-risk");
  assert.equal(renewalEnforcementAction.caseId, renewalGovernanceCase.id);
});

test("step 4: simulated Linear workstream requires Product/Customer Success/Engineering owners", () => {
  assert.deepEqual([...renewalRequiredOwners], ["Product", "Customer Success", "Engineering"]);
  const payload = renewalLinearWorkstreamPayload;
  assert.deepEqual([...payload.requiredOwners], ["Product", "Customer Success", "Engineering"]);
  assert.equal(payload.dealId, renewalGovernanceCase.dealId);
  assert.ok(payload.workstreams.some((w) => w.owner === "Customer Success" && w.status === "at-risk"));
});

test("step 5: a downstream action (board forecast) is blocked until corrected", () => {
  const decision = actionGateDecision(renewalBlockedAction);
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.some((reason) => reason.includes("engagement")));
  assert.ok(decision.requiredBeforeSend.some((item) => item.includes("EvalCase")));
});

test("step 6: AuditEvent records the correction + deciding actor and the flip", () => {
  assert.equal(renewalAuditEvent.previousStatus, "on-track");
  assert.equal(renewalAuditEvent.newStatus, "at-risk");
  assert.ok(renewalAuditEvent.decidingActor.length > 0);
});

test("step 7: EvalCase generated + eval shows Fail -> Pass across passes", () => {
  assert.equal(renewalEvalCase.governanceCaseId, renewalGovernanceCase.id);
  assert.equal(renewalEvalPass1.evalCaseId, renewalEvalCase.id);
  assert.equal(renewalEvalPass2.evalCaseId, renewalEvalCase.id);
  assert.equal(renewalEvalPass1.result, "fail");
  assert.equal(renewalEvalPass2.result, "pass");
  assert.equal(renewalEvalPass1.criterion, renewalEvalPass2.criterion);
});

// ===== Demo beats tests (mirrors acme-beats.test.ts) =====

test("demo beat: business goal is a distinct renewal goal", () => {
  assert.equal(renewalDemoBeats.goal, "Secure TechCorp renewal for $800K ARR");
  assert.equal(renewalDemoBeats.goal, renewalBusinessGoal);
  // Different from Acme to prove scenarios are independent
  assert.notEqual(renewalBusinessGoal, "Close Acme expansion by Friday — $1.2M ARR");
});

test("demo beat: the false-green agent claim matches agent output", () => {
  assert.equal(renewalDemoBeats.agentClaim, "TechCorp renewal appears on track");
  assert.equal(renewalAgentOutputPass1.reportedStatus, "on-track");
  assert.ok(renewalAgentOutputPass1.droppedRequirements.length > 0);
});

test("demo beat: the dropped requirement is engagement signal", () => {
  assert.equal(renewalDemoBeats.droppedRequirement, "Customer engagement decline signal");
  assert.ok(renewalAgentOutputPass1.droppedRequirements.includes(renewalDemoBeats.droppedRequirement));
  assert.equal(renewalGovernanceCase.missedRequirement, renewalDemoBeats.droppedRequirement);
});

test("single source: renewalScenario carries beats + goal", () => {
  assert.equal(renewalScenario.businessGoal, renewalBusinessGoal);
  assert.equal(renewalScenario.demoBeats, renewalDemoBeats);
  assert.equal(renewalScenario.governanceCase.dealId, renewalAgentOutputPass1.dealId);
  // All parts reference the same deal
  assert.equal(renewalScenario.agentOutputPass1.dealId, renewalScenario.governanceCase.dealId);
  assert.equal(renewalScenario.agentOutputPass2.dealId, renewalScenario.governanceCase.dealId);
});

// ===== Loop generalization proof =====

test("renewal scenario proves the loop generalizes: same 7-step structure, different deal type", () => {
  // The renewal scenario runs the same governance loop as Acme:
  // 1. false green (on-track with dropped signal)
  // 2. governance case detection
  // 3. enforcement action (status flip)
  // 4. linear workstream + owners
  // 5. action blocked until corrected
  // 6. audit event (deciding actor + status change)
  // 7. eval case Fail -> Pass

  // Acme was: closed deal (expansion), Acme customer, EU data residency
  // Renewal is: existing customer (renewal), TechCorp customer, engagement signal
  // Same loop shape, different business context.

  assert.equal(renewalAgentOutputPass1.reportedStatus, "on-track");
  assert.equal(renewalAgentOutputPass2.reportedStatus, "at-risk");
  assert.equal(renewalGovernanceCase.severity, "blocking");
  assert.equal(renewalEvalPass1.result, "fail");
  assert.equal(renewalEvalPass2.result, "pass");
});

test("persona rule: renewal deciding actor is a role, not an invented name", () => {
  const actor = renewalAuditEvent.decidingActor;
  assert.match(actor, /operator|VP|Head|Head of Customer Success|Customer Success|\//i);
});
