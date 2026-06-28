/**
 * RoutingRule — deterministic routing from intents/signals to endpoint configs.
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";
import { driftSignalKind } from "./drift-signal.contract.ts";
import { nlIntentType } from "./nl-intent.contract.ts";
import { jsonObjectShape } from "./json-value.ts";

export const ROUTING_RULE_SCHEMA = "liminal_engine.routing_rule.v1";

export const routingDisposition = z.enum(["send", "hold", "deny", "fanout"]);
export type RoutingDisposition = z.infer<typeof routingDisposition>;

export const routingRuleShape = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    priority: z.number().int().nonnegative(),
    enabled: z.boolean(),
    intentTypes: z.array(nlIntentType),
    signalKinds: z.array(driftSignalKind),
    endpointConfigIds: z.array(z.string().min(1)).min(1),
    disposition: routingDisposition,
    rationale: z.string().min(1),
    conditions: jsonObjectShape.optional(),
    createdAt: z.string().datetime(),
  })
  .strict()
  .superRefine((rule, ctx) => {
    if (rule.intentTypes.length === 0 && rule.signalKinds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "routing rules require at least one intent type or signal kind",
        path: ["intentTypes"],
      });
    }
    if (rule.disposition !== "fanout" && rule.endpointConfigIds.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "non-fanout routing rules must target exactly one endpoint",
        path: ["endpointConfigIds"],
      });
    }
  });
export type RoutingRule = z.infer<typeof routingRuleShape>;

export const routingRuleContract = defineContract({
  schema: ROUTING_RULE_SCHEMA,
  shape: routingRuleShape,
  canonical: (r) => ({
    schema: ROUTING_RULE_SCHEMA,
    id: r.id,
    name: r.name,
    priority: r.priority,
    enabled: r.enabled,
    intent_types: [...r.intentTypes].sort(),
    signal_kinds: [...r.signalKinds].sort(),
    endpoint_config_ids: [...r.endpointConfigIds].sort(),
    disposition: r.disposition,
    rationale: r.rationale,
    ...(r.conditions !== undefined ? { conditions: r.conditions } : {}),
    created_at: r.createdAt,
  }),
});

export const routingRuleGoldenVectors = [
  {
    name: "route-requirement-drift-to-gemini",
    purpose: "route a requirement-dropped signal to the Gemini evidence classifier endpoint",
    input: {
      id: "rr_requirement_drift_gemini",
      name: "Requirement drift evidence classification",
      priority: 10,
      enabled: true,
      intentTypes: [],
      signalKinds: ["requirement_dropped"],
      endpointConfigIds: ["endpoint_gemini_agent_output"],
      disposition: "send",
      rationale: "Classify the dropped requirement and produce contract-shaped evidence.",
      conditions: { minScore: 0.8 },
      createdAt: "2026-06-27T10:00:00.000Z",
    } satisfies RoutingRule,
  },
];
