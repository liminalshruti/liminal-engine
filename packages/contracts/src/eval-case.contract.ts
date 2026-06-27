/**
 * EvalCase — the case the second pass is graded against (generated from the
 * governance case). DEMO_CONTRACT step 12 / must-not-cut #7. EvalResult records
 * the graded outcome against this case.
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

export const EVAL_CASE_SCHEMA = "liminal_engine.eval_case.v1";

export const evalCaseShape = z.object({
  id: z.string().min(1),
  dealId: z.string().min(1),
  governanceCaseId: z.string().min(1),
  criterion: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type EvalCase = z.infer<typeof evalCaseShape>;

export const evalCaseContract = defineContract({
  schema: EVAL_CASE_SCHEMA,
  shape: evalCaseShape,
  canonical: (c) => ({
    schema: EVAL_CASE_SCHEMA,
    id: c.id,
    deal_id: c.dealId,
    governance_case_id: c.governanceCaseId,
    criterion: c.criterion,
    created_at: c.createdAt,
  }),
});

export const evalCaseGoldenVectors = [
  {
    name: "acme-eu-residency-case",
    purpose: "eval case generated from the EU-residency governance case",
    input: {
      id: "ec_acme_eu",
      dealId: "deal_acme",
      governanceCaseId: "gc_acme_eu",
      criterion: "EU data residency requirement honored",
      createdAt: "2026-06-27T10:06:00.000Z",
    } satisfies EvalCase,
  },
];
