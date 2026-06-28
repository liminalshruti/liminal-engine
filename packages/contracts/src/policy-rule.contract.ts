/**
 * PolicyRule - a declarative rule that enforces a requirement or constraint
 * within a governance case. POST-HACK model for correction-pipeline stretch item.
 *
 * A PolicyRule specifies:
 * - what condition must hold (requirement)
 * - which systems/actors enforce it (enforcers)
 * - when it applies (scope/context)
 * - remediation steps (required actions)
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

export const POLICY_RULE_SCHEMA = "liminal_engine.policy_rule.v1";

export const policyRuleSeverity = z.enum(["critical", "high", "medium", "low"]);
export type PolicyRuleSeverity = z.infer<typeof policyRuleSeverity>;

export const policyScopeShape = z.object({
  category: z.string().min(1),
  context: z.string().min(1),
});
export type PolicyScope = z.infer<typeof policyScopeShape>;

export const remediationStepShape = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  owner: z.string().min(1),
  status: z.enum(["open", "in-progress", "completed", "blocked"]),
});
export type RemediationStep = z.infer<typeof remediationStepShape>;

export const policyRuleShape = z.object({
  id: z.string().min(1),
  caseId: z.string().min(1),
  dealId: z.string().min(1),
  requirement: z.string().min(1),
  severity: policyRuleSeverity,
  scope: policyScopeShape,
  remediationSteps: z.array(remediationStepShape).min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  enforcer: z.string().min(1),
});
export type PolicyRule = z.infer<typeof policyRuleShape>;

export const policyRuleContract = defineContract({
  schema: POLICY_RULE_SCHEMA,
  shape: policyRuleShape,
  canonical: (p) => ({
    schema: POLICY_RULE_SCHEMA,
    id: p.id,
    case_id: p.caseId,
    deal_id: p.dealId,
    requirement: p.requirement,
    severity: p.severity,
    scope: {
      category: p.scope.category,
      context: p.scope.context,
    },
    remediation_steps: p.remediationSteps.map((step) => ({
      id: step.id,
      description: step.description,
      owner: step.owner,
      status: step.status,
    })),
    created_at: p.createdAt,
    updated_at: p.updatedAt,
    enforcer: p.enforcer,
  }),
});

export const policyRuleGoldenVectors = [
  {
    name: "acme-eu-residency-policy",
    purpose: "Policy rule enforcing EU data residency requirement for Acme deal",
    input: {
      id: "pr_acme_eu",
      caseId: "gc_acme_eu",
      dealId: "deal_acme",
      requirement: "EU data residency is a hard requirement for the Acme expansion",
      severity: "critical",
      scope: {
        category: "data-residency",
        context: "deal_acme",
      },
      remediationSteps: [
        {
          id: "step_1",
          description: "Propagate EU data residency requirement into Acme workstream",
          owner: "Product",
          status: "open",
        },
        {
          id: "step_2",
          description: "Assign Security owner for compliance review",
          owner: "Security",
          status: "open",
        },
        {
          id: "step_3",
          description: "Assign Engineering owner for implementation",
          owner: "Engineering",
          status: "open",
        },
      ],
      createdAt: "2026-06-27T10:03:00.000Z",
      updatedAt: "2026-06-27T10:03:00.000Z",
      enforcer: "VP Ops / Head of AI Transformation",
    } satisfies PolicyRule,
  },
];
