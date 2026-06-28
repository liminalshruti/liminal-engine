/**
 * Requirement — a user-authored customer requirement that governs a business
 * goal / deal (e.g. "EU data residency"). It is the load-bearing obligation the
 * Acme false-green silently dropped: the operator (or an automated proposal)
 * authors it, it is graded against the agent's output, and once approved it
 * becomes active operating state that gates downstream actions.
 *
 * Distinct from `GovernanceCase` (the *detection* that a requirement was missed)
 * and `CorrectionEvent` (the operator's correction text): this is the requirement
 * itself — its severity, the surfaces it `scope`s, its proposed → active → …
 * lifecycle, and the operator-approval metadata that authorizes activation.
 *
 * Invariant (zod refine, covered by a test): a requirement may only be `active`
 * if it carries operator-approval metadata (`approvedBy`). Activation without an
 * approver is a contradiction — the contract rejects it so it cannot be persisted
 * or hashed into a receipt that claims an unapproved requirement is enforced.
 *
 * `evidenceRefs[]` cite `RequirementEvidence` (`requirement-evidence.contract.ts`)
 * — the source receipts grounding the requirement. Roles only here (`ownerRole`,
 * `approvedBy`): never an invented persona name (DEMO_CONTRACT persona rule).
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

export const REQUIREMENT_SCHEMA = "liminal_engine.requirement.v1";

/** How hard the requirement binds: a `hard` requirement blocks; `soft`/`info` advise. */
export const requirementSeverity = z.enum(["hard", "soft", "info"]);
export type RequirementSeverity = z.infer<typeof requirementSeverity>;

/** Lifecycle: a candidate is `proposed`, then `active` (approved), `rejected`, or `retired`. */
export const requirementStatus = z.enum(["proposed", "active", "rejected", "retired"]);
export type RequirementStatus = z.infer<typeof requirementStatus>;

/** Origin of the requirement: hand-authored, bulk-imported, or surfaced by a proposal. */
export const requirementCreatedBy = z.enum(["operator", "import", "proposal"]);
export type RequirementCreatedBy = z.infer<typeof requirementCreatedBy>;

export const requirementShape = z
  .object({
    id: z.string().min(1),
    /** the business goal the requirement governs. */
    goalId: z.string().min(1),
    /** the deal the requirement governs. */
    dealId: z.string().min(1),
    /** the requirement statement, in the user's words. */
    text: z.string().min(1),
    /** the owning role accountable for the requirement — a ROLE, never a persona name. */
    ownerRole: z.string().min(1),
    severity: requirementSeverity,
    /** the action / output surfaces the requirement governs (e.g. proposal, launch, owners). */
    scope: z.array(z.string().min(1)),
    status: requirementStatus,
    createdBy: requirementCreatedBy,
    /** the approving role — required once `status` is `active` (see refine). */
    approvedBy: z.string().min(1).optional(),
    /** references to `RequirementEvidence.sourceId` grounding the requirement. */
    evidenceRefs: z.array(z.string().min(1)),
    createdAt: z.string().datetime(),
    /** when the requirement became active — optional; only set once activated. */
    activatedAt: z.string().datetime().optional(),
  })
  .strict()
  .superRefine((req, ctx) => {
    if (req.status === "active" && req.approvedBy === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "active requirements require operator-approval metadata (approvedBy)",
        path: ["approvedBy"],
      });
    }
  });
export type Requirement = z.infer<typeof requirementShape>;

export const requirementContract = defineContract({
  schema: REQUIREMENT_SCHEMA,
  shape: requirementShape,
  canonical: (r) => ({
    schema: REQUIREMENT_SCHEMA,
    id: r.id,
    goal_id: r.goalId,
    deal_id: r.dealId,
    text: r.text,
    owner_role: r.ownerRole,
    severity: r.severity,
    scope: r.scope,
    status: r.status,
    created_by: r.createdBy,
    evidence_refs: r.evidenceRefs,
    created_at: r.createdAt,
    ...(r.approvedBy !== undefined ? { approved_by: r.approvedBy } : {}),
    ...(r.activatedAt !== undefined ? { activated_at: r.activatedAt } : {}),
  }),
});

export const requirementGoldenVectors = [
  {
    name: "acme-eu-residency-active",
    purpose: "an active hard requirement — approved + activated, governs the Acme surfaces",
    input: {
      id: "req_acme_eu_residency",
      goalId: "goal_acme_expansion",
      dealId: "deal_acme",
      text: "All Acme EU customer data must remain resident in EU data centers.",
      ownerRole: "Security",
      severity: "hard",
      scope: ["deal-proposal", "launch-plan", "owner-assignment", "customer-facing-status-update"],
      status: "active",
      createdBy: "operator",
      approvedBy: "VP Ops / Head of AI Transformation",
      evidenceRefs: ["call_acme_kickoff", "dpa_acme_v3"],
      createdAt: "2026-06-27T09:55:00.000Z",
      activatedAt: "2026-06-27T10:05:00.000Z",
    } satisfies Requirement,
  },
  {
    name: "acme-dpa-proposed",
    purpose: "a proposed candidate — surfaced by a proposal, awaiting operator approval",
    input: {
      id: "req_acme_dpa_countersign",
      goalId: "goal_acme_expansion",
      dealId: "deal_acme",
      text: "Acme must counter-sign the Data Processing Agreement before EU launch.",
      ownerRole: "Legal",
      severity: "hard",
      scope: ["launch-plan", "owner-assignment"],
      status: "proposed",
      createdBy: "proposal",
      evidenceRefs: ["dpa_acme_v3"],
      createdAt: "2026-06-27T10:06:00.000Z",
    } satisfies Requirement,
  },
  {
    name: "acme-comarketing-rejected",
    purpose: "a rejected candidate — a soft proposal the operator declined as out of scope",
    input: {
      id: "req_acme_comarketing",
      goalId: "goal_acme_expansion",
      dealId: "deal_acme",
      text: "Acme expansion must ship with a joint co-marketing press release.",
      ownerRole: "Marketing",
      severity: "soft",
      scope: ["launch-plan"],
      status: "rejected",
      createdBy: "proposal",
      evidenceRefs: [],
      createdAt: "2026-06-27T10:07:00.000Z",
    } satisfies Requirement,
  },
];
