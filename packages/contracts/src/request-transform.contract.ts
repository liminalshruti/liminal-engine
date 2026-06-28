/**
 * RequestTransform — the Burp "match & replace" for LLM requests (LIM-1295, epic
 * LIM-1291). The transform a matching policy applies to an outbound LLM request
 * before forwarding it: redact a secret, inject a system constraint, require
 * fields, or forbid patterns.
 *
 * Closed vocabulary, NOT a free-form DSL: `kind` is a fixed enum and each kind's
 * `payload` carries a required, validated shape. `match` reuses the structured
 * condition from «action-policy-rule» (LIM-1267) rather than duplicating it, so a
 * transform fires only when its condition holds. Provenance (`fromRuleId`) ties
 * every transform back to the policy rule that compiled it.
 *
 * This contract is the data shape only; deterministic *application* of a transform
 * to a request is LIM-1297 («request-transform-engine»). Additive — the locked
 * Acme spine is untouched; ships a snake_case canonical projection + per-kind
 * golden vectors so its hash is byte-reproducible.
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";
import {
  actionPolicyStructuredConditionShape,
  type ActionPolicyStructuredCondition,
} from "./action-policy-rule.contract.ts";

export const REQUEST_TRANSFORM_SCHEMA = "liminal_engine.request_transform.v1";

export const requestTransformKind = z.enum([
  "redact",
  "inject_system_constraint",
  "require_fields",
  "forbid_patterns",
]);
export type RequestTransformKind = z.infer<typeof requestTransformKind>;

export const requestTransformShape = z
  .object({
    id: z.string().min(1),
    /** provenance → the PolicyRule / ActionPolicyRule that compiled this transform */
    fromRuleId: z.string().min(1),
    kind: requestTransformKind,
    /** fire only when this structured condition holds (reused from «action-policy-rule») */
    match: actionPolicyStructuredConditionShape.optional(),
    /** kind-specific instructions (validated per kind below) */
    payload: z.record(z.unknown()),
  })
  .strict()
  .superRefine((t, ctx) => {
    const p = t.payload;
    const requireString = (key: string) => {
      if (typeof p[key] !== "string" || (p[key] as string).length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${t.kind} transform requires a non-empty string payload.${key}`,
          path: ["payload", key],
        });
      }
    };
    const requireStringArray = (key: string) => {
      const v = p[key];
      if (!Array.isArray(v) || v.length === 0 || !v.every((x) => typeof x === "string" && x.length > 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${t.kind} transform requires a non-empty string[] payload.${key}`,
          path: ["payload", key],
        });
      }
    };
    switch (t.kind) {
      case "redact":
        requireString("pattern"); // what to redact (replacement is optional)
        break;
      case "inject_system_constraint":
        requireString("text"); // the system text to inject, e.g. "Honor EU data residency."
        break;
      case "require_fields":
        requireStringArray("fields");
        break;
      case "forbid_patterns":
        requireStringArray("patterns");
        break;
      default: {
        const _exhaustive: never = t.kind;
        return _exhaustive;
      }
    }
  });
export type RequestTransform = z.infer<typeof requestTransformShape>;

/** snake_case projection of the reused structured condition (mirrors «action-policy-rule»). */
function canonicalMatch(condition: ActionPolicyStructuredCondition | undefined) {
  if (condition === undefined) return undefined;
  return { field: condition.field, op: condition.op, value: condition.value };
}

export const requestTransformContract = defineContract({
  schema: REQUEST_TRANSFORM_SCHEMA,
  shape: requestTransformShape,
  canonical: (t) => ({
    schema: REQUEST_TRANSFORM_SCHEMA,
    id: t.id,
    from_rule_id: t.fromRuleId,
    kind: t.kind,
    // match only projected into the hash when present (canonical-hash sorts payload keys)
    ...(t.match !== undefined ? { match: canonicalMatch(t.match) } : {}),
    payload: t.payload,
  }),
});

export const requestTransformGoldenVectors = [
  {
    name: "redact-secret-pattern",
    purpose: "redact an API-key pattern from a request when the tool is the LLM provider",
    input: {
      id: "rt_redact_secret",
      fromRuleId: "aprule_no_secret_leak",
      kind: "redact",
      match: { field: "tool", op: "==", value: "openai" },
      payload: { pattern: "sk-[A-Za-z0-9]{20,}", replacement: "[REDACTED]" },
    } satisfies RequestTransform,
  },
  {
    name: "inject-eu-residency",
    purpose: "inject a system constraint before forwarding — no match (applies to all)",
    input: {
      id: "rt_inject_eu",
      fromRuleId: "aprule_eu_residency",
      kind: "inject_system_constraint",
      payload: { text: "Honor EU data residency: do not route this request outside the EU." },
    } satisfies RequestTransform,
  },
  {
    name: "require-consent-fields",
    purpose: "require explicit consent fields on the request",
    input: {
      id: "rt_require_consent",
      fromRuleId: "aprule_consent",
      kind: "require_fields",
      payload: { fields: ["user_consent", "data_region"] },
    } satisfies RequestTransform,
  },
  {
    name: "forbid-key-patterns",
    purpose: "forbid request bodies that carry private-key / access-key patterns",
    input: {
      id: "rt_forbid_keys",
      fromRuleId: "aprule_no_keys",
      kind: "forbid_patterns",
      payload: { patterns: ["BEGIN RSA PRIVATE KEY", "AKIA[0-9A-Z]{16}"] },
    } satisfies RequestTransform,
  },
];
