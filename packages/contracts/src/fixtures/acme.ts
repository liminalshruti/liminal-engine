/**
 * Acme false-green scenario — the LOCKED demo data (DEMO_CONTRACT.md).
 * Deterministic fixtures the demo spine renders. Every field is validated through
 * its contract (see fixtures.test.ts), so the demo can't drift from the contracts.
 *
 * Persona rule: `decidingActor` is a ROLE, never an invented name.
 */
import { agentOutputContract, type AgentOutput } from "../agent-output.contract.ts";
import { governanceCaseContract, type GovernanceCase } from "../governance-case.contract.ts";
import { enforcementActionContract, type EnforcementAction } from "../enforcement-action.contract.ts";
import { auditEventContract, type AuditEvent } from "../audit-event.contract.ts";
import { actionGateContract, type ActionGate } from "../action-gate.contract.ts";
import { evalCaseContract, type EvalCase } from "../eval-case.contract.ts";
import { evalResultContract, type EvalResult } from "../eval-result.contract.ts";

/** The Acme business goal shown at the top of the demo (DEMO_CONTRACT step 2). */
export const acmeBusinessGoal = "Close Acme expansion by Friday — $1.2M ARR";

/** Workstream owners the simulated Linear panel requires (must-not-cut #4). */
export const acmeRequiredOwners = ["Product", "Security", "Engineering"] as const;

// Pass 1: the false green — reads on-track while EU data residency was dropped.
export const acmeAgentOutputPass1: AgentOutput = agentOutputContract.parse({
  id: "ao_acme_p1",
  dealId: "deal_acme",
  dealName: "Acme expansion",
  passNumber: 1,
  reportedStatus: "on-track",
  summary: "Acme $1.2M expansion on track; all workstreams green.",
  droppedRequirements: ["EU data residency"],
});

// Pass 2: after enforcement — requirement honored, nothing dropped.
export const acmeAgentOutputPass2: AgentOutput = agentOutputContract.parse({
  id: "ao_acme_p2",
  dealId: "deal_acme",
  dealName: "Acme expansion",
  passNumber: 2,
  reportedStatus: "at-risk",
  summary: "Acme expansion re-run with EU data residency enforced; flagged for remediation.",
  droppedRequirements: [],
});

export const acmeGovernanceCase: GovernanceCase = governanceCaseContract.parse({
  id: "gc_acme_eu",
  dealId: "deal_acme",
  missedRequirement: "EU data residency",
  category: "data-governance",
  severity: "blocking",
  status: "open",
  detectedAt: "2026-06-27T10:00:00.000Z",
});

export const acmeEnforcementAction: EnforcementAction = enforcementActionContract.parse({
  id: "ea_acme_enforce",
  caseId: "gc_acme_eu",
  dealId: "deal_acme",
  fromStatus: "on-track",
  toStatus: "at-risk",
  actor: "VP Ops / Head of AI Transformation",
  enforcedAt: "2026-06-27T10:04:00.000Z",
});

export const acmeAuditEvent: AuditEvent = auditEventContract.parse({
  id: "ae_acme_1",
  caseId: "gc_acme_eu",
  dealId: "deal_acme",
  action: "correction-enforced",
  decidingActor: "VP Ops / Head of AI Transformation",
  previousStatus: "on-track",
  newStatus: "at-risk",
  recordedAt: "2026-06-27T10:05:00.000Z",
});

export const acmeBlockedAction: ActionGate = actionGateContract.parse({
  id: "ag_acme_update",
  caseId: "gc_acme_eu",
  action: "Send customer-facing status update to Acme",
  blocked: true,
  reason: "Blocked: open governance case (EU data residency) must be corrected first.",
  unblockedByCaseCorrection: true,
});

export const acmeEvalCase: EvalCase = evalCaseContract.parse({
  id: "ec_acme_eu",
  dealId: "deal_acme",
  governanceCaseId: "gc_acme_eu",
  criterion: "EU data residency requirement honored",
  createdAt: "2026-06-27T10:06:00.000Z",
});

export const acmeEvalPass1: EvalResult = evalResultContract.parse({
  id: "ev_acme_p1",
  dealId: "deal_acme",
  evalCaseId: "ec_acme_eu",
  passNumber: 1,
  criterion: "EU data residency requirement honored",
  result: "fail",
});

export const acmeEvalPass2: EvalResult = evalResultContract.parse({
  id: "ev_acme_p2",
  dealId: "deal_acme",
  evalCaseId: "ec_acme_eu",
  passNumber: 2,
  criterion: "EU data residency requirement honored",
  result: "pass",
});

/** The whole locked scenario, in 14-step demo-path order (DEMO_CONTRACT). */
export const acmeScenario = {
  businessGoal: acmeBusinessGoal,
  agentOutputPass1: acmeAgentOutputPass1,
  governanceCase: acmeGovernanceCase,
  enforcementAction: acmeEnforcementAction,
  requiredOwners: acmeRequiredOwners,
  blockedAction: acmeBlockedAction,
  auditEvent: acmeAuditEvent,
  evalCase: acmeEvalCase,
  agentOutputPass2: acmeAgentOutputPass2,
  evalPass1: acmeEvalPass1,
  evalPass2: acmeEvalPass2,
} as const;
