/**
 * Fixtures — deterministic golden test data for the Acme case.
 * All fixture rules are tied to "acme_expansion" scope and use real condition
 * patterns observed in the demo scenario (dropped EU data residency, missing owners).
 */

import type {
  PolicyRule,
  PolicyMatchContext,
} from "./policy-rule.contract.ts";

/**
 * EU Data Residency Rule — fires when EU residency is missing from agent output.
 * Stage: detect. Action: flag the miss and generate a GovernanceCase.
 */
export const acmeEuResidencyRule: PolicyRule = {
  id: "pr_acme_eu_residency",
  name: "EU Data Residency Requirement Dropped",
  scope: "acme_expansion",
  stage: "detect",
  condition: {
    requirementDropped: "eu_data_residency",
  },
  action: {
    type: "create_linear_workstream",
    payload: {
      title: "EU Data Residency Requirement — Acme Expansion",
      description: "Agent output is missing EU data residency requirement; required before closing deal.",
      requiredOwners: ["Product", "Security", "Engineering"],
    },
  },
  createdAt: "2026-06-27T09:00:00.000Z",
};

/**
 * Enforce EU Residency — fires at enforce stage, changes status and blocks customer comms.
 */
export const acmeEnforceEuResidencyRule: PolicyRule = {
  id: "pr_acme_enforce_eu",
  name: "Enforce EU Data Residency Correction",
  scope: "acme_expansion",
  stage: "enforce",
  condition: {
    statusFlip: {
      from: "on-track",
      to: "at-risk",
    },
    requirementDropped: "eu_data_residency",
  },
  action: {
    type: "block_agent_action",
    payload: {
      blockedActionType: "customer_update",
      reason: "Open governance case requires EU data residency correction before customer comms",
      requiredBeforeSend: [
        "Propagate EU data residency into Acme workstream",
        "Assign Product, Security, Engineering owners",
        "Pass EU data residency EvalCase",
      ],
    },
  },
  createdAt: "2026-06-27T09:00:00.000Z",
};

/**
 * Audit EU Residency — fires at audit stage, records correction event.
 */
export const acmeAuditEuResidencyRule: PolicyRule = {
  id: "pr_acme_audit_eu",
  name: "Audit EU Data Residency Correction",
  scope: "acme_expansion",
  stage: "audit",
  condition: {
    requirementDropped: "eu_data_residency",
  },
  action: {
    type: "record_audit_event",
    payload: {
      action: "eu_data_residency_correction_recorded",
      affectedSystems: ["acme_workstream", "agent_output", "governance_ledger"],
    },
  },
  createdAt: "2026-06-27T09:00:00.000Z",
};

/**
 * Improve EU Residency — fires at improve stage, generates eval to verify second pass.
 */
export const acmeImproveEuResidencyRule: PolicyRule = {
  id: "pr_acme_improve_eu",
  name: "Evaluate EU Data Residency Improvement",
  scope: "acme_expansion",
  stage: "improve",
  condition: {
    requirementDropped: "eu_data_residency",
  },
  action: {
    type: "generate_eval",
    payload: {
      criterion: "eu_data_residency_present_and_enforced",
      description: "Second pass must include EU data residency and enforce it through the workstream",
    },
  },
  createdAt: "2026-06-27T09:00:00.000Z",
};

/**
 * Collection of all Acme fixture rules, keyed by stage.
 */
export const acmeRules: PolicyRule[] = [
  acmeEuResidencyRule,
  acmeEnforceEuResidencyRule,
  acmeAuditEuResidencyRule,
  acmeImproveEuResidencyRule,
];

/**
 * Acme match context — the first-pass scenario where EU residency is dropped.
 */
export const acmeDetectContext: PolicyMatchContext = {
  workstreamId: "acme_expansion",
  dealId: "deal_acme",
  stage: "detect",
  currentStatus: "on-track",
  missingRequirements: ["eu_data_residency"],
  agentOutput: {
    deal: "Acme Expansion",
    status: "on-track",
    estimatedClosure: "Friday",
    arr: "$1.2M",
    owners: ["Product"], // Missing Security, Engineering
  },
};

/**
 * Acme enforce context — status is still on-track when enforcement is triggered;
 * the rule fires to enforce correction and transition to at-risk.
 */
export const acmeEnforceContext: PolicyMatchContext = {
  workstreamId: "acme_expansion",
  dealId: "deal_acme",
  stage: "enforce",
  currentStatus: "on-track",
  missingRequirements: ["eu_data_residency"],
  agentOutput: {
    deal: "Acme Expansion",
    status: "on-track",
    owners: ["Product", "Security", "Engineering"],
  },
};

/**
 * Acme audit context — recording the correction.
 */
export const acmeAuditContext: PolicyMatchContext = {
  workstreamId: "acme_expansion",
  dealId: "deal_acme",
  stage: "audit",
  currentStatus: "at-risk",
  missingRequirements: ["eu_data_residency"],
  agentOutput: {
    decision: "correction_recorded",
    actor: "VP Ops / Head of AI Transformation",
  },
};

/**
 * Acme improve context — second pass has corrected the miss.
 */
export const acmeImproveContext: PolicyMatchContext = {
  workstreamId: "acme_expansion",
  dealId: "deal_acme",
  stage: "improve",
  currentStatus: "at-risk",
  missingRequirements: [], // Now present in second pass
  agentOutput: {
    deal: "Acme Expansion",
    status: "at-risk",
    euDataResidency: "EU-only, DPA in place",
    owners: ["Product", "Security", "Engineering"],
    evalResult: "PASS",
  },
};
