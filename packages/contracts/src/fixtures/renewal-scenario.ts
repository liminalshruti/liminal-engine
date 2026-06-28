/**
 * Renewal risk scenario — customer churn signal ignored.
 * Demonstrates that the Liminal governance loop generalizes beyond the Acme false-green.
 *
 * A customer renewal is flagged as "low-risk" while customer engagement metrics
 * show a declining trend. The loop detects the missed warning signal, enforces
 * escalation, and re-evaluation proves the improved assessment.
 *
 * SINGLE SOURCE: every field is validated through its contract (see fixtures.test.ts),
 * so the demo can't drift from the contracts.
 *
 * Persona rule: `decidingActor` is a ROLE, never an invented name.
 */
import { type AgentOutput } from "../agent-output.contract.ts";
import { agentOutputContract } from "../agent-output.contract.ts";
import { governanceCaseContract, type GovernanceCase } from "../governance-case.contract.ts";
import { enforcementActionContract, type EnforcementAction } from "../enforcement-action.contract.ts";
import { auditEventContract, type AuditEvent } from "../audit-event.contract.ts";
import { actionGateContract, type ActionGate } from "../action-gate.contract.ts";
import { evalCaseContract, type EvalCase } from "../eval-case.contract.ts";
import { evalResultContract, type EvalResult } from "../eval-result.contract.ts";
import { linearWorkstreamPayloadContract, type LinearWorkstreamPayload } from "../linear-workstream-payload.contract.ts";

/** The business goal for the renewal scenario. */
export const renewalBusinessGoal = "Secure TechCorp renewal for $800K ARR";

/** Workstream owners required for renewal remediation. */
export const renewalRequiredOwners = ["Product", "Customer Success", "Engineering"] as const;

/**
 * Demo-beat display copy for renewal scenario steps.
 * Kept separate from contract-hashed fixture fields so on-screen wording can match
 * the scenario context exactly without changing any golden hash.
 */
export const renewalDemoBeats = {
  /** The business goal shown at scenario start. */
  goal: renewalBusinessGoal,
  /** The false green: agent output as the operator first sees it. */
  agentClaim: "TechCorp renewal appears on track",
  /** The silently dropped, load-bearing customer signal. */
  droppedRequirement: "Customer engagement decline signal",
} as const;

// Pass 1: the false green — reads on-track while engagement is declining.
export const renewalAgentOutputPass1: AgentOutput = agentOutputContract.parse({
  id: "ao_renewal_p1",
  dealId: "deal_techcorp_renewal",
  dealName: "TechCorp renewal",
  passNumber: 1,
  reportedStatus: "on-track",
  summary: "TechCorp $800K renewal on track; customer engagement stable.",
  droppedRequirements: ["Customer engagement decline signal"],
});

// Pass 2: after enforcement — signal honored, escalation triggered.
export const renewalAgentOutputPass2: AgentOutput = agentOutputContract.parse({
  id: "ao_renewal_p2",
  dealId: "deal_techcorp_renewal",
  dealName: "TechCorp renewal",
  passNumber: 2,
  reportedStatus: "at-risk",
  summary: "TechCorp renewal re-run with engagement signal enforced; flagged for executive outreach.",
  droppedRequirements: [],
});

export const renewalGovernanceCase: GovernanceCase = governanceCaseContract.parse({
  id: "gc_renewal_engagement",
  dealId: "deal_techcorp_renewal",
  missedRequirement: "Customer engagement decline signal",
  category: "data-governance",
  severity: "blocking",
  status: "open",
  detectedAt: "2026-06-27T11:00:00.000Z",
  businessImpact: "$800K TechCorp renewal at risk due to declining engagement",
  missingFrom: ["renewal strategy", "account review", "executive touchpoint plan"],
  recommendedActions: [
    "Move TechCorp Low-Risk → At-Risk",
    "Create customer engagement escalation workstream",
    "Require Product/Customer Success/Engineering owners",
    "Schedule executive business review",
  ],
});

export const renewalEnforcementAction: EnforcementAction = enforcementActionContract.parse({
  id: "ea_renewal_enforce",
  caseId: "gc_renewal_engagement",
  dealId: "deal_techcorp_renewal",
  fromStatus: "on-track",
  toStatus: "at-risk",
  actor: "VP Sales / Head of Customer Success",
  enforcedAt: "2026-06-27T11:05:00.000Z",
});

export const renewalAuditEvent: AuditEvent = auditEventContract.parse({
  id: "ae_renewal_1",
  caseId: "gc_renewal_engagement",
  dealId: "deal_techcorp_renewal",
  action: "correction-enforced",
  decidingActor: "VP Sales / Head of Customer Success",
  previousStatus: "on-track",
  newStatus: "at-risk",
  recordedAt: "2026-06-27T11:06:00.000Z",
});

export const renewalBlockedAction: ActionGate = actionGateContract.parse({
  id: "ag_renewal_update",
  caseId: "gc_renewal_engagement",
  action: "Send renewal completion forecast to board",
  verdict: "deny",
  reasons: [
    "Open governance case gc_renewal_engagement requires customer engagement escalation before a low-risk renewal forecast.",
  ],
  requiredBeforeSend: [
    "Conduct executive business review with TechCorp.",
    "Document engagement improvement plan.",
    "Assign Product, Customer Success, and Engineering owners.",
    "Pass the engagement signal EvalCase.",
  ],
});

export const renewalEvalCase: EvalCase = evalCaseContract.parse({
  id: "ec_renewal_engagement",
  dealId: "deal_techcorp_renewal",
  governanceCaseId: "gc_renewal_engagement",
  criterion: "Customer engagement signal addressed and escalation plan in place",
  createdAt: "2026-06-27T11:07:00.000Z",
});

export const renewalEvalPass1: EvalResult = evalResultContract.parse({
  id: "ev_renewal_p1",
  dealId: "deal_techcorp_renewal",
  evalCaseId: "ec_renewal_engagement",
  passNumber: 1,
  criterion: "Customer engagement signal addressed and escalation plan in place",
  result: "fail",
});

export const renewalEvalPass2: EvalResult = evalResultContract.parse({
  id: "ev_renewal_p2",
  dealId: "deal_techcorp_renewal",
  evalCaseId: "ec_renewal_engagement",
  passNumber: 2,
  criterion: "Customer engagement signal addressed and escalation plan in place",
  result: "pass",
});

// Simulated Linear renewal workstream (mirrors the pattern of acmeLinearWorkstreamPayload).
export const renewalLinearWorkstreamPayload: LinearWorkstreamPayload = linearWorkstreamPayloadContract.parse({
  title: "TechCorp renewal — customer engagement escalation",
  dealId: "deal_techcorp_renewal",
  requiredOwners: ["Product", "Customer Success", "Engineering"],
  workstreams: [
    { title: "Account health review", status: "at-risk", owner: "Customer Success" },
    { title: "Product roadmap alignment", status: "green", owner: "Product" },
    { title: "Technical support plan", status: "green", owner: "Engineering" },
  ],
});

/** The whole renewal scenario, in governance loop order. */
export const renewalScenario = {
  businessGoal: renewalBusinessGoal,
  demoBeats: renewalDemoBeats,
  requiredOwners: renewalRequiredOwners,
  agentOutputPass1: renewalAgentOutputPass1,
  governanceCase: renewalGovernanceCase,
  enforcementAction: renewalEnforcementAction,
  linearWorkstreamPayload: renewalLinearWorkstreamPayload,
  blockedAction: renewalBlockedAction,
  auditEvent: renewalAuditEvent,
  evalCase: renewalEvalCase,
  agentOutputPass2: renewalAgentOutputPass2,
  evalPass1: renewalEvalPass1,
  evalPass2: renewalEvalPass2,
} as const;
