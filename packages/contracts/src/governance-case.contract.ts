/**
 * GovernanceCase — a detected miss. The dropped EU data-residency requirement
 * surfaced by Liminal against the false-green agent output. (DEMO_CONTRACT step 3.)
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

export const GOVERNANCE_CASE_SCHEMA = "liminal_engine.governance_case.v1";

export const governanceCaseStatus = z.enum([
  "open",
  "corrected",
  "enforced",
  "dismissed",
  "reopened",
  "closed",
]);
export type GovernanceCaseStatus = z.infer<typeof governanceCaseStatus>;

export const governanceCaseShape = z.object({
  id: z.string().min(1),
  dealId: z.string().min(1),
  missedRequirement: z.string().min(1),
  category: z.string().min(1),
  severity: z.enum(["blocking", "high", "medium", "low"]),
  status: governanceCaseStatus,
  detectedAt: z.string().datetime(),
  // SPEC.md extensions — optional so existing producers stay valid; only
  // projected into the canonical hash when present (absent ⇒ hash unchanged).
  businessImpact: z.string().min(1).optional(),
  missingFrom: z.array(z.string().min(1)).optional(),
  evidenceIds: z.array(z.string().min(1)).optional(),
  recommendedActions: z.array(z.string().min(1)).optional(),
});
export type GovernanceCase = z.infer<typeof governanceCaseShape>;

export const governanceCaseContract = defineContract({
  schema: GOVERNANCE_CASE_SCHEMA,
  shape: governanceCaseShape,
  canonical: (c) => ({
    schema: GOVERNANCE_CASE_SCHEMA,
    id: c.id,
    deal_id: c.dealId,
    missed_requirement: c.missedRequirement,
    category: c.category,
    severity: c.severity,
    status: c.status,
    detected_at: c.detectedAt,
    ...(c.businessImpact !== undefined ? { business_impact: c.businessImpact } : {}),
    ...(c.missingFrom !== undefined ? { missing_from: c.missingFrom } : {}),
    ...(c.evidenceIds !== undefined ? { evidence_ids: c.evidenceIds } : {}),
    ...(c.recommendedActions !== undefined ? { recommended_actions: c.recommendedActions } : {}),
  }),
});

export const governanceCaseGoldenVectors = [
  {
    name: "acme-eu-residency-open",
    purpose: "the detection — dropped EU data residency, blocking, open",
    input: {
      id: "gc_acme_eu",
      dealId: "deal_acme",
      missedRequirement: "EU data residency",
      category: "data-governance",
      severity: "blocking",
      status: "open",
      detectedAt: "2026-06-27T10:00:00.000Z",
    } satisfies GovernanceCase,
  },
];
