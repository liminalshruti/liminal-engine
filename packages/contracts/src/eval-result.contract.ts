/**
 * EvalResult — proof the next pass improved: Fail (pass 1) → Pass (pass 2) on the
 * criterion that the dropped requirement is now honored. (DEMO_CONTRACT step 8 /
 * must-not-cut #6.)
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

export const EVAL_RESULT_SCHEMA = "liminal_engine.eval_result.v1";

export const evalResultShape = z.object({
  id: z.string().min(1),
  dealId: z.string().min(1),
  evalCaseId: z.string().min(1), // the EvalCase this result grades against
  passNumber: z.number().int().positive(),
  criterion: z.string().min(1),
  result: z.enum(["fail", "pass"]),
});
export type EvalResult = z.infer<typeof evalResultShape>;

export const evalResultContract = defineContract({
  schema: EVAL_RESULT_SCHEMA,
  shape: evalResultShape,
  canonical: (r) => ({
    schema: EVAL_RESULT_SCHEMA,
    id: r.id,
    deal_id: r.dealId,
    eval_case_id: r.evalCaseId,
    pass_number: r.passNumber,
    criterion: r.criterion,
    result: r.result,
  }),
});

export const evalResultGoldenVectors = [
  {
    name: "pass1-fail",
    purpose: "first pass fails the EU residency criterion",
    input: {
      id: "ev_acme_p1",
      dealId: "deal_acme",
      evalCaseId: "ec_acme_eu",
      passNumber: 1,
      criterion: "EU data residency requirement honored",
      result: "fail",
    } satisfies EvalResult,
  },
  {
    name: "pass2-pass",
    purpose: "second pass passes after enforcement",
    input: {
      id: "ev_acme_p2",
      dealId: "deal_acme",
      evalCaseId: "ec_acme_eu",
      passNumber: 2,
      criterion: "EU data residency requirement honored",
      result: "pass",
    } satisfies EvalResult,
  },
];
