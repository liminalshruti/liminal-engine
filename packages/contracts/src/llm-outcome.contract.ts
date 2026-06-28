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
