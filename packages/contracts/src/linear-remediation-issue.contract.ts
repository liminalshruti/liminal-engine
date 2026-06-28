/**
 * LinearRemediationIssuePayload — the governance-meaningful content of a Linear
 * remediation issue the engine files when an APPROVED hard active `Requirement`
 * violation is enforced (LIM-1335). It is the cross-context payload the governance
 * remediation use case PRODUCES and the live Linear adapter
 * (`packages/integrations/linear`) CONSUMES — so it lives in `contracts/` (the
 * shared kernel), the only sanctioned coupling between the two contexts.
 *
 * Distinct from `LinearWorkstreamPayload` (the simulated read-only workstream
 * PANEL): this is a WRITE — the exact, reproducible payload a remediation issue
 * carries so a dry-run can print it byte-for-byte and a live `issueCreate` can be
 * audited against it. It preserves the Product / Security / Engineering
 * owner-requirement semantics (one payload per required owner role); the
 * `accountableOwner` flag marks the issue whose owner is the violated
 * requirement's own owning role.
 *
 * Carries the load-bearing trace the epic demands — `requirementId`,
 * `governanceCaseId`, `ownerRole`, `evidenceRefs` — never a vague summary. Roles
 * only (`ownerRole`): never an invented persona name (DEMO_CONTRACT persona rule).
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

export const LINEAR_REMEDIATION_ISSUE_SCHEMA = "liminal_engine.linear_remediation_issue.v1";

export const linearRemediationIssueShape = z
  .object({
    /** the Linear issue title. */
    title: z.string().min(1),
    /** the violated active hard `Requirement.id` this issue remediates. */
    requirementId: z.string().min(1),
    /** the `GovernanceCase.id` that detected the violation. */
    governanceCaseId: z.string().min(1),
    /** the deal the requirement governs. */
    dealId: z.string().min(1),
    /** the owning role accountable for this remediation issue — a ROLE, never a persona. */
    ownerRole: z.string().min(1),
    /** true when this issue's owner IS the violated requirement's own accountable owner. */
    accountableOwner: z.boolean(),
    /** the requirement severity — only `hard` violations file remediation. */
    severity: z.enum(["hard", "soft", "info"]),
    /** `RequirementEvidence.sourceId` refs grounding the violated requirement. */
    evidenceRefs: z.array(z.string().min(1)),
    /** the deterministic issue body, anchored on the requirement + case ids. */
    description: z.string().min(1),
    /** deterministic, requirement-anchored labels for the Linear issue. */
    labels: z.array(z.string().min(1)),
  })
  .strict();
export type LinearRemediationIssuePayload = z.infer<typeof linearRemediationIssueShape>;

export const linearRemediationIssueContract = defineContract({
  schema: LINEAR_REMEDIATION_ISSUE_SCHEMA,
  shape: linearRemediationIssueShape,
  canonical: (p) => ({
    schema: LINEAR_REMEDIATION_ISSUE_SCHEMA,
    title: p.title,
    requirement_id: p.requirementId,
    governance_case_id: p.governanceCaseId,
    deal_id: p.dealId,
    owner_role: p.ownerRole,
    accountable_owner: p.accountableOwner,
    severity: p.severity,
    evidence_refs: p.evidenceRefs,
    description: p.description,
    labels: p.labels,
  }),
});

export const linearRemediationIssueGoldenVectors = [
  {
    name: "acme-eu-residency-security-accountable",
    purpose: "the accountable-owner remediation issue (Security owns EU data residency)",
    input: {
      title:
        "[Remediation] All Acme EU customer data must remain resident in EU data centers. — Security",
      requirementId: "req_acme_eu_residency",
      governanceCaseId: "gc_acme_eu",
      dealId: "deal_acme",
      ownerRole: "Security",
      accountableOwner: true,
      severity: "hard",
      evidenceRefs: ["call_acme_kickoff", "dpa_acme_v3"],
      description: [
        "Liminal Engine governance loop filed this remediation on enforcement of a violated hard active requirement.",
        "",
        "Requirement (req_acme_eu_residency): All Acme EU customer data must remain resident in EU data centers.",
        "Owner role: Security (accountable owner)",
        "Deal: deal_acme",
        "GovernanceCase: gc_acme_eu",
        "Severity: hard",
        "Scope: deal-proposal, launch-plan, owner-assignment, customer-facing-status-update",
        "Evidence: call_acme_kickoff, dpa_acme_v3",
      ].join("\n"),
      labels: ["remediation", "governance", "severity:hard", "owner:Security"],
    } satisfies LinearRemediationIssuePayload,
  },
  {
    name: "acme-eu-residency-product-workstream",
    purpose: "a required-workstream-owner remediation issue (Product), not the accountable owner",
    input: {
      title:
        "[Remediation] All Acme EU customer data must remain resident in EU data centers. — Product",
      requirementId: "req_acme_eu_residency",
      governanceCaseId: "gc_acme_eu",
      dealId: "deal_acme",
      ownerRole: "Product",
      accountableOwner: false,
      severity: "hard",
      evidenceRefs: ["call_acme_kickoff", "dpa_acme_v3"],
      description: [
        "Liminal Engine governance loop filed this remediation on enforcement of a violated hard active requirement.",
        "",
        "Requirement (req_acme_eu_residency): All Acme EU customer data must remain resident in EU data centers.",
        "Owner role: Product",
        "Deal: deal_acme",
        "GovernanceCase: gc_acme_eu",
        "Severity: hard",
        "Scope: deal-proposal, launch-plan, owner-assignment, customer-facing-status-update",
        "Evidence: call_acme_kickoff, dpa_acme_v3",
      ].join("\n"),
      labels: ["remediation", "governance", "severity:hard", "owner:Product"],
    } satisfies LinearRemediationIssuePayload,
  },
];
