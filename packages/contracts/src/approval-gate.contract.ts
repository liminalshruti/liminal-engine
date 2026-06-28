/**
 * ApprovalGate — a formal gate that requires explicit approval before an action
 * can proceed. POST-HACK model for correction-pipeline stretch item.
 *
 * An ApprovalGate represents:
 * - what decision must be made (approval context)
 * - who can approve it (required approvers)
 * - what evidence is needed (evidence requirements)
 * - current approval state (approved/pending/rejected)
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

export const APPROVAL_GATE_SCHEMA = "liminal_engine.approval_gate.v1";

/**
 * The approval status of a gate.
 */
export const approvalStatus = z.enum(["pending", "approved", "rejected", "escalated"]);
export type ApprovalStatus = z.infer<typeof approvalStatus>;

/**
 * An approval record from a single approver.
 */
export const approvalRecordShape = z.object({
  id: z.string().min(1),
  /** Role/actor that provided the approval (e.g., "Product", "Security", "Engineering") */
  approver: z.string().min(1),
  status: approvalStatus,
  /** Reason for approval, rejection, or escalation */
  reasoning: z.string().optional(),
  /** When the approval was recorded */
  recordedAt: z.string().datetime(),
});
export type ApprovalRecord = z.infer<typeof approvalRecordShape>;

export const approvalGateShape = z.object({
  id: z.string().min(1),
  caseId: z.string().min(1),
  dealId: z.string().min(1),
  policyRuleId: z.string().min(1),
  /** What is being approved (e.g., "Release Acme on-track update") */
  approvalContext: z.string().min(1),
  /** Roles that must approve (e.g., ["Product", "Security", "Engineering"]) */
  requiredApprovers: z.array(z.string().min(1)).min(1),
  /** All approval records received so far */
  approvals: z.array(approvalRecordShape),
  /** When this gate was created */
  createdAt: z.string().datetime(),
  /** When this gate's status last changed */
  updatedAt: z.string().datetime(),
  /** The role managing this approval gate (e.g., "VP Ops / Head of AI Transformation") */
  gateKeeper: z.string().min(1),
}).superRefine((gate, ctx) => {
  // Ensure all approvals reference required approvers
  const approverRoles = new Set(gate.approvals.map((a) => a.approver));
  const requiredSet = new Set(gate.requiredApprovers);
  for (const role of approverRoles) {
    if (!requiredSet.has(role)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Approval from ${role} is not a required approver`,
        path: ["approvals"],
      });
    }
  }
});
export type ApprovalGate = z.infer<typeof approvalGateShape>;

/**
 * Compute the overall status of an approval gate based on approvals received.
 */
export function deriveApprovalGateStatus(gate: ApprovalGate): ApprovalStatus {
  if (gate.approvals.length === 0) {
    return "pending";
  }

  // Check for rejection or escalation first (takes precedence)
  for (const approval of gate.approvals) {
    if (approval.status === "rejected") {
      return "rejected";
    }
    if (approval.status === "escalated") {
      return "escalated";
    }
  }

  // Check if all required approvers have approved
  const approvedRoles = new Set(
    gate.approvals
      .filter((a) => a.status === "approved")
      .map((a) => a.approver),
  );
  const requiredSet = new Set(gate.requiredApprovers);

  if (approvedRoles.size === requiredSet.size) {
    // All required approvers have approved
    return "approved";
  }

  return "pending";
}

/**
 * Check if all required approvals have been obtained.
 */
export function isFullyApproved(gate: ApprovalGate): boolean {
  return deriveApprovalGateStatus(gate) === "approved";
}

export const approvalGateContract = defineContract({
  schema: APPROVAL_GATE_SCHEMA,
  shape: approvalGateShape,
  canonical: (a) => ({
    schema: APPROVAL_GATE_SCHEMA,
    id: a.id,
    case_id: a.caseId,
    deal_id: a.dealId,
    policy_rule_id: a.policyRuleId,
    approval_context: a.approvalContext,
    required_approvers: a.requiredApprovers,
    approvals: a.approvals.map((approval) => ({
      id: approval.id,
      approver: approval.approver,
      status: approval.status,
      ...(approval.reasoning !== undefined ? { reasoning: approval.reasoning } : {}),
      recorded_at: approval.recordedAt,
    })),
    created_at: a.createdAt,
    updated_at: a.updatedAt,
    gate_keeper: a.gateKeeper,
  }),
});

export const approvalGateGoldenVectors = [
  {
    name: "acme-eu-residency-approval",
    purpose: "Approval gate for EU data residency requirement enforcement",
    input: {
      id: "ag_acme_eu",
      caseId: "gc_acme_eu",
      dealId: "deal_acme",
      policyRuleId: "pr_acme_eu",
      approvalContext: "Enforce EU data residency requirement for Acme expansion",
      requiredApprovers: ["Product", "Security", "Engineering"],
      approvals: [],
      createdAt: "2026-06-27T10:03:00.000Z",
      updatedAt: "2026-06-27T10:03:00.000Z",
      gateKeeper: "VP Ops / Head of AI Transformation",
    } satisfies ApprovalGate,
  },
];
