/**
 * GovernanceCase — a detected miss. The dropped EU data-residency requirement
 * surfaced by Liminal against the false-green agent output. (DEMO_CONTRACT step 3.)
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

export const GOVERNANCE_CASE_SCHEMA = "liminal_engine.governance_case.v1";

export const governanceCaseShape = z.object({
  id: z.string().min(1),
  dealId: z.string().min(1),
  missedRequirement: z.string().min(1),
  category: z.string().min(1),
  severity: z.enum(["blocking", "high", "medium", "low"]),
  status: z.enum(["open", "corrected"]),
  detectedAt: z.string().datetime(),
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
