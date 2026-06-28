/**
 * ActionGate — the proxy/gate verdict on a downstream action (e.g. a
 * customer-facing status update) while an open governance case stands.
 * (DEMO_CONTRACT step 6 / must-not-cut #5.)
 *
 * Per specs/SPEC.md: the verdict carries `reasons[]` (why it's gated) and
 * `requiredBeforeSend[]` (what must be true to release it). `allowed` is
 * DERIVED from the verdict — a gate with any `reasons` is not allowed — so we do
 * NOT persist a contradictory `blocked` boolean. Use `isAllowed(gate)` to read it.
 *
 * Provenance (additive — LIM-1269 / specs/GOAL-self-learning-policy-loop.md §4): an
 * optional `source` ("operator" | "policy" | "default-deny") and optional
 * `sourceRuleId` attribute every verdict to WHAT decided it — an operator
 * ratification, an auto-verdict from a learned PolicyRule, or a fail-closed
 * default-deny. Both are OPTIONAL and enter the canonical projection ONLY when
 * present, so existing source-less gates keep a byte-identical canonical
 * projection/hash (back-compat). The derived-`allowed` semantics and the
 * deny-needs-reasons invariant below are unchanged.
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

export const ACTION_GATE_SCHEMA = "liminal_engine.action_gate.v2";

export const actionGateVerdictShape = z.enum(["allow", "deny"]);

/**
 * Verdict provenance — who/what produced this gate: an operator ratification, an
 * auto-verdict from a learned PolicyRule, or a fail-closed default-deny.
 */
export const actionGateSourceShape = z.enum(["operator", "policy", "default-deny"]);
export type ActionGateSource = z.infer<typeof actionGateSourceShape>;

export const actionGateShape = z.object({
  id: z.string().min(1),
  caseId: z.string().min(1),
  action: z.string().min(1),
  verdict: actionGateVerdictShape,
  reasons: z.array(z.string().min(1)),
  requiredBeforeSend: z.array(z.string().min(1)),
  // Provenance — optional but typed; lets every verdict be attributed to its
  // source. Omitted on existing source-less gates (back-compat).
  source: actionGateSourceShape.optional(),
  sourceRuleId: z.string().min(1).optional(),
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
    // Provenance — only projected into the hash when present, so existing
    // source-less gates keep a byte-identical canonical projection (back-compat).
    ...(g.source !== undefined ? { source: g.source } : {}),
    ...(g.sourceRuleId !== undefined ? { source_rule_id: g.sourceRuleId } : {}),
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
  {
    name: "policy-auto-deny-from-learned-rule",
    purpose:
      "auto-verdict from a learned policy rule — carries source:policy + sourceRuleId (the PR-#20 replay decay step)",
    input: {
      id: "ag_pr20_replay",
      caseId: "gc_pr20_dual_review",
      action: "Merge PR#35 without dual reviewer approval",
      verdict: "deny",
      reasons: [
        "Learned policy rule denies merging a pull request without both required reviewers approving.",
      ],
      requiredBeforeSend: [
        "Obtain approval from both required reviewers before merging.",
      ],
      source: "policy",
      sourceRuleId: "pr_rule_dual_review_v1",
    } satisfies ActionGate,
  },
  {
    name: "default-deny-fail-closed",
    purpose:
      "fail-closed verdict — policy store/gateway unreachable, so a consequential action defaults to deny with source:default-deny",
    input: {
      id: "ag_fail_closed",
      caseId: "gc_store_unreachable",
      action: "Force-push to a protected branch",
      verdict: "deny",
      reasons: [
        "Policy store unreachable — failing closed on a consequential action.",
      ],
      requiredBeforeSend: [
        "Restore policy store connectivity, then re-evaluate the action.",
      ],
      source: "default-deny",
    } satisfies ActionGate,
  },
  {
    name: "operator-ratified-allow",
    purpose:
      "operator-ratified allow — verdict allow with source:operator; proves source provenance does not alter derived allowance",
    input: {
      id: "ag_operator_allow",
      caseId: "gc_pr20_dual_review",
      action: "Merge PR#41 with both required reviewers approving",
      verdict: "allow",
      reasons: [],
      requiredBeforeSend: [],
      source: "operator",
    } satisfies ActionGate,
  },
];
