/**
 * TransformRule — declarative, auditable data transformations used before
 * routing or evaluation.
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

export const TRANSFORM_RULE_SCHEMA = "liminal_engine.transform_rule.v1";

export const transformOperation = z.enum([
  "extract",
  "map",
  "redact",
  "normalize",
  "classify",
  "score",
  "template",
]);
export type TransformOperation = z.infer<typeof transformOperation>;

export const transformRuleShape = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    operation: transformOperation,
    inputSchema: z.string().min(1),
    outputSchema: z.string().min(1),
    fieldPath: z.array(z.string().min(1)).min(1),
    targetField: z.array(z.string().min(1)).optional(),
    pattern: z.string().min(1).optional(),
    replacement: z.string().optional(),
    labels: z.array(z.string().min(1)).optional(),
    confidenceThreshold: z.number().min(0).max(1).optional(),
    priority: z.number().int().nonnegative(),
    enabled: z.boolean(),
    createdAt: z.string().datetime(),
  })
  .strict()
  .superRefine((rule, ctx) => {
    if ((rule.operation === "map" || rule.operation === "extract") && rule.targetField === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${rule.operation} rules require targetField`,
        path: ["targetField"],
      });
    }
    if (rule.operation === "redact" && rule.replacement === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "redact rules require replacement",
        path: ["replacement"],
      });
    }
    if (rule.operation === "classify" && (rule.labels === undefined || rule.labels.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "classify rules require labels",
        path: ["labels"],
      });
    }
  });
export type TransformRule = z.infer<typeof transformRuleShape>;

export const transformRuleContract = defineContract({
  schema: TRANSFORM_RULE_SCHEMA,
  shape: transformRuleShape,
  canonical: (r) => ({
    schema: TRANSFORM_RULE_SCHEMA,
    id: r.id,
    name: r.name,
    operation: r.operation,
    input_schema: r.inputSchema,
    output_schema: r.outputSchema,
    field_path: r.fieldPath,
    ...(r.targetField !== undefined ? { target_field: r.targetField } : {}),
    ...(r.pattern !== undefined ? { pattern: r.pattern } : {}),
    ...(r.replacement !== undefined ? { replacement: r.replacement } : {}),
    ...(r.labels !== undefined ? { labels: [...r.labels].sort() } : {}),
    ...(r.confidenceThreshold !== undefined ? { confidence_threshold: r.confidenceThreshold } : {}),
    priority: r.priority,
    enabled: r.enabled,
    created_at: r.createdAt,
  }),
});

export const transformRuleGoldenVectors = [
  {
    name: "redact-customer-claim",
    purpose: "redact sensitive customer-facing claim before audit persistence",
    input: {
      id: "tr_redact_customer_claim",
      name: "Redact customer claim in audit snapshots",
      operation: "redact",
      inputSchema: "liminal_engine.audit_event.v1",
      outputSchema: "liminal_engine.audit_event.v1",
      fieldPath: ["beforeState", "customerClaim"],
      pattern: "Acme[^.]*",
      replacement: "[redacted customer claim]",
      priority: 10,
      enabled: true,
      createdAt: "2026-06-27T10:05:00.000Z",
    } satisfies TransformRule,
  },
];
