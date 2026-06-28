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

export const ACTION_GATE_SCHEMA = "liminal_engine.action_gate.v2";

export const actionGateVerdictShape = z.enum(["allow", "deny"]);

export const actionGateShape = z.object({
  id: z.string().min(1),
  caseId: z.string().min(1),
  action: z.string().min(1),
  verdict: actionGateVerdictShape,
  reasons: z.array(z.string().min(1)),
  requiredBeforeSend: z.array(z.string().min(1)),
}).strict().superRefine((gate, ctx) => {
  if (gate.verdict === "deny" && gate.reasons.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "deny verdicts must include at least one reason",
      path: ["reasons"],
    });
  }
  if (gate.verdict === "allow" && gate.reasons.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "allow verdicts must not carry blocking reasons",
      path: ["reasons"],
    });
  }
  if (gate.verdict === "allow" && gate.requiredBeforeSend.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "allow verdicts must not require remediation before send",
      path: ["requiredBeforeSend"],
    });
  }
});
export type ActionGate = z.infer<typeof actionGateShape>;

export interface ActionGateDecision {
  allowed: boolean;
  reasons: string[];
  requiredBeforeSend: string[];
}

export function deriveActionGateAllowed(
  gate: Pick<ActionGate, "verdict" | "reasons" | "requiredBeforeSend">,
): boolean {
  return gate.verdict === "allow"
    && gate.reasons.length === 0
    && gate.requiredBeforeSend.length === 0;
}

export function actionGateDecision(gate: ActionGate): ActionGateDecision {
  return {
    allowed: deriveActionGateAllowed(gate),
    reasons: [...gate.reasons],
    requiredBeforeSend: [...gate.requiredBeforeSend],
  };
}

/** Derived allowance — never persisted. A gate is allowed iff verdict is "allow" and has no reasons. */
export function isAllowed(gate: ActionGate): boolean {
  return gate.verdict === "allow" && gate.reasons.length === 0;
}

export const actionGateContract = defineContract({
  schema: ACTION_GATE_SCHEMA,
  shape: actionGateShape,
  canonical: (g) => ({
    schema: ACTION_GATE_SCHEMA,
    id: g.id,
    case_id: g.caseId,
    action: g.action,
    verdict: g.verdict,
    reasons: g.reasons,
    required_before_send: g.requiredBeforeSend,
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
      verdict: "deny",
      reasons: [
        "Open governance case gc_acme_eu requires EU data residency correction before a customer-facing on-track update.",
      ],
      requiredBeforeSend: [
        "Propagate the EU data residency requirement into the Acme workstream.",
        "Assign Product, Security, and Engineering owners.",
        "Pass the EU data residency EvalCase.",
      ],
    } satisfies ActionGate,
  },
];
