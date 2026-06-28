/**
 * EndpointConfig — non-secret adapter configuration for live external endpoints.
 *
 * Secrets are referenced by `auth.secretRef` only (for example,
 * `env:GEMINI_API_KEY`); the contract rejects inline secret material by design.
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";
import { jsonObjectShape } from "./json-value.ts";

export const ENDPOINT_CONFIG_SCHEMA = "liminal_engine.endpoint_config.v1";

export const endpointProvider = z.enum([
  "gemini",
  "linear",
  "livekit",
  "loopback-proxy",
  "openai",
  "anthropic",
  "custom",
]);
export type EndpointProvider = z.infer<typeof endpointProvider>;

export const endpointAuthScheme = z.enum(["none", "api-key", "oauth", "service-account"]);
export type EndpointAuthScheme = z.infer<typeof endpointAuthScheme>;

export const endpointAuthShape = z
  .object({
    scheme: endpointAuthScheme,
    secretRef: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((auth, ctx) => {
    if (auth.scheme === "none" && auth.secretRef !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "secretRef must be omitted when auth scheme is none",
        path: ["secretRef"],
      });
    }
    if (auth.scheme !== "none" && auth.secretRef === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "secret-backed auth requires a secretRef, never an inline secret",
        path: ["secretRef"],
      });
    }
  });
export type EndpointAuth = z.infer<typeof endpointAuthShape>;

export const endpointRetryPolicyShape = z
  .object({
    maxAttempts: z.number().int().min(1).max(10),
    backoffMs: z.number().int().nonnegative().max(600_000),
  })
  .strict();
export type EndpointRetryPolicy = z.infer<typeof endpointRetryPolicyShape>;

export const endpointConfigShape = z
  .object({
    id: z.string().min(1),
    provider: endpointProvider,
    purpose: z.string().min(1),
    endpointUrl: z.string().url().optional(),
    model: z.string().min(1).optional(),
    auth: endpointAuthShape,
    timeoutMs: z.number().int().positive().max(300_000),
    retry: endpointRetryPolicyShape,
    enabled: z.boolean(),
    createdAt: z.string().datetime(),
    metadata: jsonObjectShape.optional(),
  })
  .strict();
export type EndpointConfig = z.infer<typeof endpointConfigShape>;

export const endpointConfigContract = defineContract({
  schema: ENDPOINT_CONFIG_SCHEMA,
  shape: endpointConfigShape,
  canonical: (e) => ({
    schema: ENDPOINT_CONFIG_SCHEMA,
    id: e.id,
    provider: e.provider,
    purpose: e.purpose,
    ...(e.endpointUrl !== undefined ? { endpoint_url: e.endpointUrl } : {}),
    ...(e.model !== undefined ? { model: e.model } : {}),
    auth: {
      scheme: e.auth.scheme,
      ...(e.auth.secretRef !== undefined ? { secret_ref: e.auth.secretRef } : {}),
    },
    timeout_ms: e.timeoutMs,
    retry: {
      max_attempts: e.retry.maxAttempts,
      backoff_ms: e.retry.backoffMs,
    },
    enabled: e.enabled,
    created_at: e.createdAt,
    ...(e.metadata !== undefined ? { metadata: e.metadata } : {}),
  }),
});

export const endpointConfigGoldenVectors = [
  {
    name: "gemini-agent-output-endpoint",
    purpose: "real Gemini endpoint configuration using an environment secret reference",
    input: {
      id: "endpoint_gemini_agent_output",
      provider: "gemini",
      purpose: "Generate and parse governed agent output",
      endpointUrl: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-2.0-flash",
      auth: { scheme: "api-key", secretRef: "env:GEMINI_API_KEY" },
      timeoutMs: 30_000,
      retry: { maxAttempts: 2, backoffMs: 250 },
      enabled: true,
      createdAt: "2026-06-27T10:00:00.000Z",
      metadata: { responseFormat: "json" },
    } satisfies EndpointConfig,
  },
];
