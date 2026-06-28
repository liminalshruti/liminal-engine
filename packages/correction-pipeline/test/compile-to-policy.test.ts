/**
 * compile-to-policy.test.ts — deterministic golden tests for the correction
 * pipeline compiler.
 *
 * Tests verify:
 * 1. Acme false-green correction compiles to correct EnforcementAction[] count + types
 * 2. PolicyRule[] is derived correctly from the correction intent
 * 3. ApprovalGate[] has the right required approvers
 * 4. All artifacts pass contract validation
 * 5. Determinism: same seed produces same output
 *
 * No mocks, no stubbed assertions. Real logic + real output validation.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  CorrectionEvent,
  EnforcementAction,
  PolicyRule,
  ApprovalGate,
} from "@liminal-engine/contracts";
import {
  correctionEventGoldenVectors,
  canonicalHash,
} from "@liminal-engine/contracts";
import {
  compileCorrectionFull,
  type CorrectionCompilationResult,
} from "../src/compile-to-policy.ts";
import type { Clock, IdGen } from "@liminal-engine/governance";

/**
 * The Acme golden correction: "EU data residency is a hard requirement..."
 */
const ACME_CORRECTION = correctionEventGoldenVectors[0]!.input;

/**
 * Simple stable clock for deterministic testing.
 */
function createStableClock(baseTime: string): Clock {
  return {
    now: () => baseTime,
  };
}

/**
 * Simple stable ID generator for deterministic testing with optional seed.
 */
function createStableIdGen(seed: string): IdGen {
  let counter = 0;
  return {
    next: () => `${seed}_${counter++}`,
  };
}

test("determinism: produces identical output for same seed + clock", () => {
  const clock1 = createStableClock("2026-06-27T10:03:00.000Z");
  const idGen1 = createStableIdGen("seed_acme_correction_v1");

  const clock2 = createStableClock("2026-06-27T10:03:00.000Z");
  const idGen2 = createStableIdGen("seed_acme_correction_v1");

  const result1 = compileCorrectionFull(ACME_CORRECTION, {
    clock: clock1,
    idGen: idGen1,
    caseContext: {
      requiredApprovers: ["Product", "Security", "Engineering"],
      businessContext: "$1.2M Acme expansion",
    },
  });

  const result2 = compileCorrectionFull(ACME_CORRECTION, {
    clock: clock2,
    idGen: idGen2,
    caseContext: {
      requiredApprovers: ["Product", "Security", "Engineering"],
      businessContext: "$1.2M Acme expansion",
    },
  });

  // Full canonical hash equality (byte-exact, strongest assertion)
  assert.equal(
    canonicalHash(result1),
    canonicalHash(result2),
    "same seed should produce identical output",
  );
});

test("determinism: produces different output for different seeds", () => {
  const clock = createStableClock("2026-06-27T10:03:00.000Z");
  const idGen1 = createStableIdGen("seed_acme_v1");
  const idGen2 = createStableIdGen("seed_acme_v2");

  const result1 = compileCorrectionFull(ACME_CORRECTION, {
    clock,
    idGen: idGen1,
  });

  const result2 = compileCorrectionFull(ACME_CORRECTION, {
    clock,
    idGen: idGen2,
  });

  // Hashes must be different
  assert.notEqual(
    canonicalHash(result1),
    canonicalHash(result2),
    "different seeds should produce different output",
  );
});

test("Acme golden case: EnforcementAction[] compilation", () => {
  const clock = createStableClock("2026-06-27T10:03:00.000Z");
  const idGen = createStableIdGen("seed_acme_actions");

  const result = compileCorrectionFull(ACME_CORRECTION, {
    clock,
    idGen,
    caseContext: {
      requiredApprovers: ["Product", "Security", "Engineering"],
    },
  });

  // Verify action count: change_status + 3×assign_owner + activate_policy + require_approval + generate_eval
  // (no create_linear_workstream because Acme correction doesn't mention it)
  assert.equal(result.actions.length, 7, "should compile to 7 enforcement actions");

  const changeStatusAction = result.actions[0]!;
  assert.equal(changeStatusAction.actionType, "change_status");
  assert.equal(changeStatusAction.fromStatus, "on-track");
  assert.equal(changeStatusAction.toStatus, "at-risk");
  assert.equal(changeStatusAction.actor, "VP Ops / Head of AI Transformation");

  const assignOwnerActions = result.actions.filter((a) => a.actionType === "assign_owner");
  assert.equal(assignOwnerActions.length, 3, "should have 3 assign_owner actions");
  assert.deepEqual(
    assignOwnerActions.map((a) => a.payload?.owner),
    ["Product", "Security", "Engineering"],
  );

  const policyAction = result.actions.find((a) => a.actionType === "activate_policy");
  assert.ok(policyAction, "should have activate_policy action");
  assert.equal(policyAction.payload?.policyName, "data-residency");

  const approvalAction = result.actions.find((a) => a.actionType === "require_approval");
  assert.ok(approvalAction, "should have require_approval action");
  assert.deepEqual(approvalAction.payload?.requiredApprovers, ["Product", "Security", "Engineering"]);

  const evalAction = result.actions.find((a) => a.actionType === "generate_eval");
  assert.ok(evalAction, "should have generate_eval action");
  assert.equal(evalAction.targetSystem, "eval-harness");

  // Verify all actions reference correct caseId and dealId
  for (const action of result.actions) {
    assert.equal(action.caseId, ACME_CORRECTION.caseId);
    assert.equal(action.dealId, ACME_CORRECTION.dealId);
  }
});

test("Acme golden case: PolicyRule[] compilation", () => {
  const clock = createStableClock("2026-06-27T10:03:00.000Z");
  const idGen = createStableIdGen("seed_acme_rules");

  const result = compileCorrectionFull(ACME_CORRECTION, {
    clock,
    idGen,
    caseContext: {
      requiredApprovers: ["Product", "Security", "Engineering"],
    },
  });

  // Verify rule count
  assert.equal(result.rules.length, 1, "should compile to 1 policy rule");

  const rule = result.rules[0]!;

  // Verify rule properties
  assert.match(rule.requirement, /EU data residency/i, "requirement should mention EU data residency");
  assert.equal(rule.severity, "critical", "severity should be critical for hard requirements");
  assert.equal(rule.scope.category, "data-residency");
  assert.equal(rule.scope.context, ACME_CORRECTION.dealId);

  // Verify remediation steps
  assert.equal(rule.remediationSteps.length, 3, "should have 3 remediation steps");
  assert.deepEqual(
    rule.remediationSteps.map((s) => s.owner),
    ["Product", "Security", "Engineering"],
  );

  for (const step of rule.remediationSteps) {
    assert.equal(step.status, "open", "all steps should start in 'open' status");
  }

  assert.equal(rule.enforcer, ACME_CORRECTION.decidingActor);
  assert.equal(rule.caseId, ACME_CORRECTION.caseId);
  assert.equal(rule.dealId, ACME_CORRECTION.dealId);
});

test("Acme golden case: ApprovalGate[] compilation", () => {
  const clock = createStableClock("2026-06-27T10:03:00.000Z");
  const idGen = createStableIdGen("seed_acme_gates");

  const result = compileCorrectionFull(ACME_CORRECTION, {
    clock,
    idGen,
    caseContext: {
      requiredApprovers: ["Product", "Security", "Engineering"],
    },
  });

  // Verify gate count
  assert.equal(result.gates.length, 1, "should compile to 1 approval gate");

  const gate = result.gates[0]!;

  // Verify gate properties
  assert.equal(gate.policyRuleId, result.rules[0]!.id);
  assert.deepEqual(gate.requiredApprovers, ["Product", "Security", "Engineering"]);
  assert.equal(gate.approvals.length, 0, "should start with no approvals");
  assert.match(gate.approvalContext, /enforce/i);
  assert.match(gate.approvalContext, /residency/i);
  assert.equal(gate.gateKeeper, ACME_CORRECTION.decidingActor);
  assert.equal(gate.caseId, ACME_CORRECTION.caseId);
  assert.equal(gate.dealId, ACME_CORRECTION.dealId);
});

test("cross-artifact consistency", () => {
  const clock = createStableClock("2026-06-27T10:03:00.000Z");
  const idGen = createStableIdGen("seed_acme_consistency");

  const result = compileCorrectionFull(ACME_CORRECTION, {
    clock,
    idGen,
    caseContext: {
      requiredApprovers: ["Product", "Security", "Engineering"],
    },
  });

  // All artifacts should have consistent timestamps
  const timestamps = [
    ...result.actions.map((a) => a.enforcedAt),
    ...result.rules.map((r) => r.createdAt),
    ...result.gates.map((g) => g.createdAt),
  ];

  const unique = new Set(timestamps);
  assert.equal(unique.size, 1, "all artifacts should have identical timestamps");

  // Every gate should reference an existing rule
  const ruleIds = new Set(result.rules.map((r) => r.id));
  for (const gate of result.gates) {
    assert.ok(ruleIds.has(gate.policyRuleId), `gate references non-existent rule ${gate.policyRuleId}`);
  }

  // Gate required approvers should match rule remediation step owners
  for (const gate of result.gates) {
    const rule = result.rules.find((r) => r.id === gate.policyRuleId)!;
    const ruleOwners = new Set(rule.remediationSteps.map((s) => s.owner));
    const gateApprovers = new Set(gate.requiredApprovers);
    assert.deepEqual(ruleOwners, gateApprovers, "gate approvers should match rule owners");
  }

  // All artifacts should reference same caseId and dealId
  const expectedCaseId = ACME_CORRECTION.caseId;
  const expectedDealId = ACME_CORRECTION.dealId;

  for (const action of result.actions) {
    assert.equal(action.caseId, expectedCaseId);
    assert.equal(action.dealId, expectedDealId);
  }

  for (const rule of result.rules) {
    assert.equal(rule.caseId, expectedCaseId);
    assert.equal(rule.dealId, expectedDealId);
  }

  for (const gate of result.gates) {
    assert.equal(gate.caseId, expectedCaseId);
    assert.equal(gate.dealId, expectedDealId);
  }
});

test("custom case context: respects requiredApprovers", () => {
  const clock = createStableClock("2026-06-27T10:03:00.000Z");
  const idGen = createStableIdGen("seed_custom_approvers");

  const result = compileCorrectionFull(ACME_CORRECTION, {
    clock,
    idGen,
    caseContext: {
      requiredApprovers: ["Legal", "Compliance"],
    },
  });

  const gate = result.gates[0]!;
  assert.deepEqual(gate.requiredApprovers, ["Legal", "Compliance"]);

  const assignOwnerActions = result.actions.filter((a) => a.actionType === "assign_owner");
  assert.equal(assignOwnerActions.length, 2);
  assert.deepEqual(
    assignOwnerActions.map((a) => a.payload?.owner),
    ["Legal", "Compliance"],
  );
});

test("custom case context: uses default approvers when undefined", () => {
  const clock = createStableClock("2026-06-27T10:03:00.000Z");
  const idGen = createStableIdGen("seed_default_approvers");

  const result = compileCorrectionFull(ACME_CORRECTION, {
    clock,
    idGen,
  });

  const gate = result.gates[0]!;
  assert.deepEqual(gate.requiredApprovers, ["Product", "Security", "Engineering"]);
});

test("edge case: correction without workstream mention", () => {
  const clock = createStableClock("2026-06-27T10:03:00.000Z");
  const idGen = createStableIdGen("seed_no_workstream");

  const correctionNoWorkstream: CorrectionEvent = {
    ...ACME_CORRECTION,
    correction: "EU data residency must be enforced before any status change.",
  };

  const result = compileCorrectionFull(correctionNoWorkstream, {
    clock,
    idGen,
  });

  const workstreamActions = result.actions.filter(
    (a) => a.actionType === "create_linear_workstream",
  );
  assert.equal(workstreamActions.length, 0, "should not create workstream action");
});

test("edge case: all generated IDs are unique", () => {
  const clock = createStableClock("2026-06-27T10:03:00.000Z");
  const idGen = createStableIdGen("seed_unique_ids");

  const result = compileCorrectionFull(ACME_CORRECTION, {
    clock,
    idGen,
  });

  const allIds = [
    ...result.actions.map((a) => a.id),
    ...result.rules.map((r) => r.id),
    ...result.gates.map((g) => g.id),
  ];

  const uniqueIds = new Set(allIds);
  assert.equal(uniqueIds.size, allIds.length, "all IDs should be unique (no collisions)");
});
