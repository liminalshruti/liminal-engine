/**
 * NlIntent — a normalized operator or agent intent extracted from arbitrary text.
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

export const NL_INTENT_SCHEMA = "liminal_engine.nl_intent.v1";

export const nlIntentType = z.enum([
  "approve_enforce",
  "ask_status",
  "create_requirement",
  "route_action",
  "allocate_resource",
  "configure_endpoint",
  "transform_data",
  "request_llm",
  "dismiss",
  "unknown",
]);
export type NlIntentType = z.infer<typeof nlIntentType>;

export const nlIntentSource = z.enum(["chat", "voice", "api", "slack", "linear", "other"]);
export type NlIntentSource = z.infer<typeof nlIntentSource>;

export const nlIntentEntityShape = z
  .object({
    name: z.string().min(1),
    value: z.string().min(1),
    confidence: z.number().min(0).max(1).optional(),
  })
  .strict();
export type NlIntentEntity = z.infer<typeof nlIntentEntityShape>;

export const nlIntentShape = z
  .object({
    id: z.string().min(1),
    utterance: z.string().min(1),
    normalizedUtterance: z.string().min(1),
    actorRole: z.string().min(1),
    intentType: nlIntentType,
    target: z.string().min(1).optional(),
    entities: z.array(nlIntentEntityShape),
    confidence: z.number().min(0).max(1),
    source: nlIntentSource,
    sourceMessageId: z.string().min(1).optional(),
    detectedAt: z.string().datetime(),
  })
  .strict();
export type NlIntent = z.infer<typeof nlIntentShape>;

export const nlIntentContract = defineContract({
  schema: NL_INTENT_SCHEMA,
  shape: nlIntentShape,
  canonical: (i) => ({
    schema: NL_INTENT_SCHEMA,
    id: i.id,
    utterance: i.utterance,
    normalized_utterance: i.normalizedUtterance,
    actor_role: i.actorRole,
    intent_type: i.intentType,
    ...(i.target !== undefined ? { target: i.target } : {}),
    entities: i.entities
      .map((entity) => ({
        name: entity.name,
        value: entity.value,
        ...(entity.confidence !== undefined ? { confidence: entity.confidence } : {}),
      }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.value.localeCompare(b.value)),
    confidence: i.confidence,
    source: i.source,
    ...(i.sourceMessageId !== undefined ? { source_message_id: i.sourceMessageId } : {}),
    detected_at: i.detectedAt,
  }),
});

export const nlIntentGoldenVectors = [
  {
    name: "operator-approve-enforce-acme",
    purpose: "operator intent to approve and enforce the correction",
    input: {
      id: "intent_acme_approve_enforce",
      utterance: "Approve and enforce the Acme EU data residency correction.",
      normalizedUtterance: "approve enforce acme eu data residency correction",
      actorRole: "VP Ops / Head of AI Transformation",
      intentType: "approve_enforce",
      target: "gc_acme_eu",
      entities: [
        { name: "deal", value: "Acme expansion", confidence: 0.99 },
        { name: "requirement", value: "EU data residency", confidence: 0.99 },
      ],
      confidence: 0.98,
      source: "chat",
      sourceMessageId: "msg_acme_operator_1",
      detectedAt: "2026-06-27T10:03:00.000Z",
    } satisfies NlIntent,
  },
];
