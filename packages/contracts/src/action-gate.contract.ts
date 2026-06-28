/**
 * ActionGate — a downstream action blocked until the case is corrected (e.g. a
 * customer-facing status update). (DEMO_CONTRACT step 6 / must-not-cut #5.)
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

export const ACTION_GATE_SCHEMA = "liminal_engine.action_gate.v1";

export const actionGateShape = z.object({
  id: z.string().min(1),
  caseId: z.string().min(1),
  action: z.string().min(1),
  blocked: z.boolean(),
  reason: z.string().min(1),
  unblockedByCaseCorrection: z.boolean(),
});
export type ActionGate = z.infer<typeof actionGateShape>;

export const actionGateContract = defineContract({
  schema: ACTION_GATE_SCHEMA,
  shape: actionGateShape,
  canonical: (g) => ({
    schema: ACTION_GATE_SCHEMA,
    id: g.id,
    case_id: g.caseId,
    action: g.action,
    blocked: g.blocked,
    reason: g.reason,
    unblocked_by_case_correction: g.unblockedByCaseCorrection,
  }),
});

export const actionGateGoldenVectors = [
  {
    name: "acme-customer-update-blocked",
    purpose: "customer-facing update blocked until EU residency corrected",
    input: {
      id: "ag_acme_update",
      caseId: "gc_acme_eu",
      action: "Send customer-facing status update to Acme",
      blocked: true,
      reason: "Blocked: open governance case (EU data residency) must be corrected first.",
      unblockedByCaseCorrection: true,
    } satisfies ActionGate,
  },
];
