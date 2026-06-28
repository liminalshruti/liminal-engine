/**
 * PolicyRule — a declarative rule that enforces a requirement or constraint
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

/**
 * Condition severity: how critical the rule is.
 */
export const policyRuleSeverity = z.enum(["critical", "high", "medium", "low"]);
export type PolicyRuleSeverity = z.infer<typeof policyRuleSeverity>;

/**
 * The scope where a rule applies (e.g., region, system, user group).
 */
export const policyScopeShape = z.object({
  /** e.g., "EU", "data-residency", "compliance-check" */
  category: z.string().min(1),
  /** e.g., "all Acme contracts", "deal_acme" */
  context: z.string().min(1),
});
export type PolicyScope = z.infer<typeof policyScopeShape>;

/**
 * A single remediation step required to satisfy the rule.
 */
export const remediationStepShape = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  /** e.g., "Product", "Security", "Engineering" */
  owner: z.string().min(1),
  /** "open" | "in-progress" | "completed" | "blocked" */
  status: z.enum(["open", "in-progress", "completed", "blocked"]),
});
export type RemediationStep = z.infer<typeof remediationStepShape>;

export const policyRuleShape = z.object({
  id: z.string().min(1),
  caseId: z.string().min(1),
  dealId: z.string().min(1),
  /** The requirement/constraint (e.g., "EU data residency is mandatory") */
  requirement: z.string().min(1),
  severity: policyRuleSeverity,
  scope: policyScopeShape,
  /** Steps required to satisfy this rule */
  remediationSteps: z.array(remediationStepShape).min(1),
  /** When this rule was created/activated */
  createdAt: z.string().datetime(),
  /** When this rule's requirements were last updated */
  updatedAt: z.string().datetime(),
  /** The role that enforces this rule (e.g., "VP Ops / Head of AI Transformation") */
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
