/**
 * ActionGate — the proxy/gate verdict on a downstream action (e.g. a
 * customer-facing status update) while an open governance case stands.
 * (DEMO_CONTRACT step 6 / must-not-cut #5.)
 *
 * Per specs/SPEC.md: the verdict carries `reasons[]` (why it's gated) and
 * `requiredBeforeSend[]` (what must be true to release it). `allowed` is
 * DERIVED from the verdict — a gate with any `reasons` is not allowed — so we do
 * NOT persist a contradictory `blocked` boolean. Use `isAllowed(gate)` to read it.
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

export const ACTION_GATE_SCHEMA = "liminal_engine.action_gate.v1";

export const actionGateShape = z.object({
  id: z.string().min(1),
  caseId: z.string().min(1),
  action: z.string().min(1),
  /** Why the action is gated. Empty ⇒ allowed. */
  reasons: z.array(z.string().min(1)),
  /** What must hold before the action may be sent (e.g. requirement propagated, owner assigned, eval passed). */
  requiredBeforeSend: z.array(z.string().min(1)),
});
export type ActionGate = z.infer<typeof actionGateShape>;

/** Derived allowance — never persisted. A gate is allowed iff it has no reasons. */
export function isAllowed(gate: ActionGate): boolean {
  return gate.reasons.length === 0;
}

export const actionGateContract = defineContract({
  schema: ACTION_GATE_SCHEMA,
  shape: actionGateShape,
  canonical: (g) => ({
    schema: ACTION_GATE_SCHEMA,
    id: g.id,
    case_id: g.caseId,
    action: g.action,
    reasons: g.reasons,
    required_before_send: g.requiredBeforeSend,
  }),
});

export const actionGateGoldenVectors = [
  {
    name: "acme-customer-update-blocked",
    purpose: "customer-facing update gated until EU residency corrected",
    input: {
      id: "ag_acme_update",
      caseId: "gc_acme_eu",
      action: "Send customer-facing status update to Acme",
      reasons: ["Open governance case (EU data residency) must be corrected first."],
      requiredBeforeSend: [
        "EU data residency requirement propagated",
        "Product / Security / Engineering owners assigned",
        "Eval passes",
      ],
    } satisfies ActionGate,
  },
];
