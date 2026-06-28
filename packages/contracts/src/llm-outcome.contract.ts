/**
 * LlmOutcome — the result of a real LLM request, including usage and errors.
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";
import { jsonObjectShape } from "./json-value.ts";
import { llmProvider } from "./llm-request.contract.ts";

export const LLM_OUTCOME_SCHEMA = "liminal_engine.llm_outcome.v1";

export const llmOutcomeStatus = z.enum(["success", "error", "blocked"]);
export type LlmOutcomeStatus = z.infer<typeof llmOutcomeStatus>;

export const llmTokenUsageShape = z
  .object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((usage, ctx) => {
    if (usage.inputTokens + usage.outputTokens !== usage.totalTokens) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "totalTokens must equal inputTokens + outputTokens",
        path: ["totalTokens"],
      });
    }
  });
export type LlmTokenUsage = z.infer<typeof llmTokenUsageShape>;

export const llmOutcomeShape = z
  .object({
    id: z.string().min(1),
    requestId: z.string().min(1),
    provider: llmProvider,
    model: z.string().min(1),
    status: llmOutcomeStatus,
    outputText: z.string().min(1).optional(),
    parsedJson: jsonObjectShape.optional(),
    usage: llmTokenUsageShape.optional(),
    latencyMs: z.number().nonnegative(),
    finishReason: z.string().min(1).optional(),
    error: z.string().min(1).optional(),
    completedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((outcome, ctx) => {
    if (outcome.status === "success" && outcome.outputText === undefined && outcome.parsedJson === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "successful outcomes require outputText or parsedJson",
        path: ["outputText"],
      });
    }
    if (outcome.status !== "success" && outcome.error === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "error and blocked outcomes require an error message",
        path: ["error"],
      });
    }
  });
export type LlmOutcome = z.infer<typeof llmOutcomeShape>;

export const llmOutcomeContract = defineContract({
  schema: LLM_OUTCOME_SCHEMA,
  shape: llmOutcomeShape,
  canonical: (o) => ({
    schema: LLM_OUTCOME_SCHEMA,
    id: o.id,
    request_id: o.requestId,
    provider: o.provider,
    model: o.model,
    status: o.status,
    ...(o.outputText !== undefined ? { output_text: o.outputText } : {}),
    ...(o.parsedJson !== undefined ? { parsed_json: o.parsedJson } : {}),
    ...(o.usage !== undefined
      ? {
          usage: {
            input_tokens: o.usage.inputTokens,
            output_tokens: o.usage.outputTokens,
            total_tokens: o.usage.totalTokens,
          },
        }
      : {}),
    latency_ms: o.latencyMs,
    ...(o.finishReason !== undefined ? { finish_reason: o.finishReason } : {}),
    ...(o.error !== undefined ? { error: o.error } : {}),
    completed_at: o.completedAt,
  }),
});

export const llmOutcomeGoldenVectors = [
  {
    name: "gemini-agent-output-json-success",
    purpose: "Gemini returned parseable AgentOutput JSON",
    input: {
      id: "llm_out_acme_p1",
      requestId: "llm_req_acme_p1",
      provider: "gemini",
      model: "gemini-2.0-flash",
      status: "success",
      outputText:
        "{\"id\":\"ao_acme_p1\",\"dealId\":\"deal_acme\",\"reportedStatus\":\"on-track\"}",
      parsedJson: { id: "ao_acme_p1", dealId: "deal_acme", reportedStatus: "on-track" },
      usage: { inputTokens: 42, outputTokens: 18, totalTokens: 60 },
      latencyMs: 913,
      finishReason: "STOP",
      completedAt: "2026-06-27T10:00:02.000Z",
    } satisfies LlmOutcome,
  },
  {
    name: "gemini-agent-output-error",
    purpose: "Gemini call failed and records the adapter-visible error",
    input: {
      id: "llm_out_acme_error",
      requestId: "llm_req_acme_p1",
      provider: "gemini",
      model: "gemini-2.0-flash",
      status: "error",
      latencyMs: 325,
      error: "HTTP 429: rate limited",
      completedAt: "2026-06-27T10:00:02.000Z",
    } satisfies LlmOutcome,
  },
];

/* ------------------------------------------------------------------------- *
 * LlmCallOutcome — the GOVERNANCE disposition of an intercepted LLM call.
 *
 * Distinct from `LlmOutcome` above: `LlmOutcome` records what the model
 * *returned* (success / error / blocked-by-provider). `LlmCallOutcome` records
 * what the loopback proxy *decided to do* with an outbound LLM call as it is
 * intercepted — the LLM-call analog of `ActionGate`'s verdict on a downstream
 * action (DIRECTIVE.md: "the loopback proxy intercepting real agent actions;
 * real policy enforcement"). Its `disposition` is one of:
 *   - `forwarded`    passed through unchanged — the default; no rule needed
 *   - `blocked`      denied (by a policy rule or operator) before reaching the model
 *   - `transformed`  rewritten by a rule (e.g. a `TransformRule`) then forwarded
 *   - `held`         parked for operator review before it may proceed
 *
 * Provenance invariant (`superRefine`): a non-`forwarded` disposition must be
 * attributable — it carries a `ruleId` (the policy/transform rule that drove it)
 * OR an operator `source`. A `forwarded` (default pass-through) requires neither
 * and must not carry a `ruleId`. `usage` (token accounting) + `latencyMs` make
 * each governed call a cost/perf-bearing receipt: `usage` is present when the
 * model was actually reached (`forwarded` / `transformed`) and omitted when the
 * call was stopped first (`blocked` / `held`). Additive — does not touch the
 * existing `LlmOutcome` contract or its goldens.
 * ------------------------------------------------------------------------- */

export const LLM_CALL_OUTCOME_SCHEMA = "liminal_engine.llm_call_outcome.v1";

export const llmCallDisposition = z.enum(["forwarded", "blocked", "transformed", "held"]);
export type LlmCallDisposition = z.infer<typeof llmCallDisposition>;

/**
 * Who/what produced the disposition: a policy/transform rule (`policy`, paired
 * with a `ruleId`), a human `operator`, or the `default-forward` pass-through.
 */
export const llmCallDecisionSource = z.enum(["policy", "operator", "default-forward"]);
export type LlmCallDecisionSource = z.infer<typeof llmCallDecisionSource>;

export const llmCallOutcomeShape = z
  .object({
    id: z.string().min(1),
    requestId: z.string().min(1),
    provider: llmProvider,
    model: z.string().min(1),
    disposition: llmCallDisposition,
    // Provenance — what drove a non-forward disposition. `ruleId` references the
    // policy/transform rule; `source` attributes the decision. Both optional so a
    // default forward needs neither.
    ruleId: z.string().min(1).optional(),
    source: llmCallDecisionSource.optional(),
    reason: z.string().min(1).optional(),
    // Token accounting — present only when the model was actually reached.
    usage: llmTokenUsageShape.optional(),
    latencyMs: z.number().nonnegative(),
    decidedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((outcome, ctx) => {
    const attributed = outcome.ruleId !== undefined || outcome.source === "operator";
    // blocked / transformed / held must be attributable to a rule or an operator.
    if (outcome.disposition !== "forwarded" && !attributed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "blocked, transformed, and held dispositions require a ruleId or an operator source",
        path: ["ruleId"],
      });
    }
    // A forwarded (default pass-through) requires no attribution and must not
    // carry a ruleId.
    if (outcome.disposition === "forwarded" && outcome.ruleId !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "a forwarded (default pass-through) outcome must not carry a ruleId",
        path: ["ruleId"],
      });
    }
    if (
      outcome.disposition === "forwarded" &&
      outcome.source !== undefined &&
      outcome.source !== "default-forward"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "a forwarded outcome may only use the default-forward source",
        path: ["source"],
      });
    }
    // The default-forward source is reserved for the forwarded disposition.
    if (outcome.disposition !== "forwarded" && outcome.source === "default-forward") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "the default-forward source is only valid for a forwarded outcome",
        path: ["source"],
      });
    }
  });
export type LlmCallOutcome = z.infer<typeof llmCallOutcomeShape>;

export const llmCallOutcomeContract = defineContract({
  schema: LLM_CALL_OUTCOME_SCHEMA,
  shape: llmCallOutcomeShape,
  canonical: (o) => ({
    schema: LLM_CALL_OUTCOME_SCHEMA,
    id: o.id,
    request_id: o.requestId,
    provider: o.provider,
    model: o.model,
    disposition: o.disposition,
    ...(o.ruleId !== undefined ? { rule_id: o.ruleId } : {}),
    ...(o.source !== undefined ? { source: o.source } : {}),
    ...(o.reason !== undefined ? { reason: o.reason } : {}),
    ...(o.usage !== undefined
      ? {
          usage: {
            input_tokens: o.usage.inputTokens,
            output_tokens: o.usage.outputTokens,
            total_tokens: o.usage.totalTokens,
          },
        }
      : {}),
    latency_ms: o.latencyMs,
    decided_at: o.decidedAt,
  }),
});

export const llmCallOutcomeGoldenVectors = [
  {
    name: "acme-forwarded-default-passthrough",
    purpose:
      "default pass-through — the Acme pass-1 call is forwarded unchanged; no rule, default-forward source, token usage recorded",
    input: {
      id: "llm_call_acme_p1_forwarded",
      requestId: "llm_req_acme_p1",
      provider: "gemini",
      model: "gemini-2.0-flash",
      disposition: "forwarded",
      source: "default-forward",
      usage: { inputTokens: 42, outputTokens: 18, totalTokens: 60 },
      latencyMs: 913,
      decidedAt: "2026-06-27T10:00:02.000Z",
    } satisfies LlmCallOutcome,
  },
  {
    name: "acme-blocked-by-policy-rule",
    purpose:
      "blocked by a learned policy rule before reaching the model — carries ruleId + policy source + reason; no token usage",
    input: {
      id: "llm_call_acme_blocked",
      requestId: "llm_req_acme_ontrack_update",
      provider: "gemini",
      model: "gemini-2.0-flash",
      disposition: "blocked",
      ruleId: "prule_eu_residency_no_false_green_v1",
      source: "policy",
      reason:
        "Open governance case gc_acme_eu denies an LLM-generated on-track customer update until EU data residency is corrected.",
      latencyMs: 7,
      decidedAt: "2026-06-27T10:05:00.000Z",
    } satisfies LlmCallOutcome,
  },
  {
    name: "acme-transformed-redact-customer-claim",
    purpose:
      "rewritten by a transform rule (redact the customer-facing claim) then forwarded — carries ruleId + policy source + usage",
    input: {
      id: "llm_call_acme_transformed",
      requestId: "llm_req_acme_p2",
      provider: "gemini",
      model: "gemini-2.0-flash",
      disposition: "transformed",
      ruleId: "tr_redact_customer_claim",
      source: "policy",
      reason:
        "Transform rule tr_redact_customer_claim redacted the customer-facing claim before forwarding the call.",
      usage: { inputTokens: 51, outputTokens: 22, totalTokens: 73 },
      latencyMs: 864,
      decidedAt: "2026-06-27T10:06:30.000Z",
    } satisfies LlmCallOutcome,
  },
  {
    name: "acme-held-for-operator-review",
    purpose:
      "held for operator review with an operator source and NO ruleId — exercises the operator-source branch of the invariant",
    input: {
      id: "llm_call_acme_held",
      requestId: "llm_req_acme_ontrack_update",
      provider: "gemini",
      model: "gemini-2.0-flash",
      disposition: "held",
      source: "operator",
      reason:
        "Operator parked the customer-facing on-track summary pending EU data residency sign-off.",
      latencyMs: 4,
      decidedAt: "2026-06-27T10:05:30.000Z",
    } satisfies LlmCallOutcome,
  },
];
