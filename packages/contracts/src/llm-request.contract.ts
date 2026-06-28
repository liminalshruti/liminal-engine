/**
 * LlmRequest — a tamper-evident record of an outbound model request.
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";
import { jsonObjectShape } from "./json-value.ts";

export const LLM_REQUEST_SCHEMA = "liminal_engine.llm_request.v1";

export const llmProvider = z.enum(["gemini", "openai", "anthropic", "local", "custom"]);
export type LlmProvider = z.infer<typeof llmProvider>;

export const llmMessageRole = z.enum(["system", "user", "assistant", "tool"]);
export type LlmMessageRole = z.infer<typeof llmMessageRole>;

export const llmMessageShape = z
  .object({
    role: llmMessageRole,
    content: z.string().min(1),
  })
  .strict();
export type LlmMessage = z.infer<typeof llmMessageShape>;

export const llmResponseFormat = z.enum(["text", "json"]);
export type LlmResponseFormat = z.infer<typeof llmResponseFormat>;

export const llmRequestShape = z
  .object({
    id: z.string().min(1),
    endpointConfigId: z.string().min(1),
    provider: llmProvider,
    model: z.string().min(1),
    messages: z.array(llmMessageShape).min(1),
    responseFormat: llmResponseFormat,
    responseSchema: jsonObjectShape.optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxOutputTokens: z.number().int().positive().optional(),
    metadata: jsonObjectShape.optional(),
    requestedAt: z.string().datetime(),
  })
  .strict();
export type LlmRequest = z.infer<typeof llmRequestShape>;

export const llmRequestContract = defineContract({
  schema: LLM_REQUEST_SCHEMA,
  shape: llmRequestShape,
  canonical: (r) => ({
    schema: LLM_REQUEST_SCHEMA,
    id: r.id,
    endpoint_config_id: r.endpointConfigId,
    provider: r.provider,
    model: r.model,
    messages: r.messages.map((m) => ({ role: m.role, content: m.content })),
    response_format: r.responseFormat,
    ...(r.responseSchema !== undefined ? { response_schema: r.responseSchema } : {}),
    ...(r.temperature !== undefined ? { temperature: r.temperature } : {}),
    ...(r.maxOutputTokens !== undefined ? { max_output_tokens: r.maxOutputTokens } : {}),
    ...(r.metadata !== undefined ? { metadata: r.metadata } : {}),
    requested_at: r.requestedAt,
  }),
});

export const llmRequestGoldenVectors = [
  {
    name: "gemini-agent-output-json-request",
    purpose: "request Gemini to return contract-shaped agent output JSON",
    input: {
      id: "llm_req_acme_p1",
      endpointConfigId: "endpoint_gemini_agent_output",
      provider: "gemini",
      model: "gemini-2.0-flash",
      messages: [
        {
          role: "user",
          content:
            "Return AgentOutput JSON for deal_acme pass 1; include dropped requirements if any.",
        },
      ],
      responseFormat: "json",
      responseSchema: { contract: "liminal_engine.agent_output.v1" },
      temperature: 0,
      maxOutputTokens: 1024,
      metadata: { dealId: "deal_acme", passNumber: 1 },
      requestedAt: "2026-06-27T10:00:01.000Z",
    } satisfies LlmRequest,
  },
];
