/**
 * ActionPolicyRule - deterministic learned allow/deny/ask rules compiled from
 * operator corrections for intercepted tool actions.
 *
 * This is separate from PolicyRule, which models remediation requirements for
 * governance cases. ActionPolicyRule is the proxy-control-plane rule type used
 * to decide whether a consequential action is allowed, denied, or held.
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";
import { enforcementActionType } from "./enforcement-action.contract.ts";

export const ACTION_POLICY_RULE_SCHEMA = "liminal_engine.action_policy_rule.v1";

export const actionPolicyVerdictShape = z.enum(["allow", "deny", "ask"]);
export type ActionPolicyVerdict = z.infer<typeof actionPolicyVerdictShape>;

export const actionPolicyConditionFieldShape = z.enum([
  "tool",
  "action",
  "target",
  "args.force",
  "reviews.approved",
  "reviews.rejected",
  "repo.visibility",
  "deploy.environment",
]);
export type ActionPolicyConditionField = z.infer<typeof actionPolicyConditionFieldShape>;

export const actionPolicyConditionOpShape = z.enum([
  "<",
  "<=",
  ">",
  ">=",
  "==",
  "!=",
  "contains",
  "matches",
]);
export type ActionPolicyConditionOp = z.infer<typeof actionPolicyConditionOpShape>;

const actionPolicyConditionValueShape = z.union([z.string(), z.number(), z.boolean()]);

export const actionPolicyStructuredConditionShape = z.object({
  field: actionPolicyConditionFieldShape,
  op: actionPolicyConditionOpShape,
  value: actionPolicyConditionValueShape,
}).strict().superRefine((condition, ctx) => {
  if (["<", "<=", ">", ">="].includes(condition.op) && typeof condition.value !== "number") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "numeric comparison conditions require a numeric value",
      path: ["value"],
    });
  }
  if (["contains", "matches"].includes(condition.op) && typeof condition.value !== "string") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "string match conditions require a string value",
      path: ["value"],
    });
  }
});
export type ActionPolicyStructuredCondition = z.infer<typeof actionPolicyStructuredConditionShape>;

export const actionPolicyRuleScopeShape = z.object({
  tool: z.string().min(1),
  action: z.string().min(1),
  targetPattern: z.string().min(1).optional(),
  condition: actionPolicyStructuredConditionShape.optional(),
}).strict();
export type ActionPolicyRuleScope = z.infer<typeof actionPolicyRuleScopeShape>;

export const actionPolicyRuleEffectShape = z.object({
  verdict: actionPolicyVerdictShape,
  actionType: enforcementActionType,
  reasons: z.array(z.string().min(1)),
  requiredBefore: z.array(z.string().min(1)),
}).strict().superRefine((effect, ctx) => {
  if ((effect.verdict === "deny" || effect.verdict === "ask") && effect.reasons.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "deny/ask policy effects require at least one reason",
      path: ["reasons"],
    });
  }
  if (effect.verdict === "allow" && effect.reasons.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "allow policy effects must not carry blocking reasons",
      path: ["reasons"],
    });
  }
  if (effect.verdict === "allow" && effect.requiredBefore.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "allow policy effects must not require remediation",
      path: ["requiredBefore"],
    });
  }
});
export type ActionPolicyRuleEffect = z.infer<typeof actionPolicyRuleEffectShape>;

export const actionPolicyRuleStatusShape = z.enum(["proposed", "active", "narrowed", "retired"]);
export type ActionPolicyRuleStatus = z.infer<typeof actionPolicyRuleStatusShape>;

export const actionPolicyRuleShape = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  fromCorrectionId: z.string().min(1),
  evalCaseId: z.string().min(1),
  scope: actionPolicyRuleScopeShape,
  effect: actionPolicyRuleEffectShape,
  status: actionPolicyRuleStatusShape,
  supersedesId: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
}).strict().superRefine((rule, ctx) => {
  if (rule.status === "narrowed" && rule.supersedesId === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "narrowed policy rules must point at the rule they supersede",
      path: ["supersedesId"],
    });
  }
});
export type ActionPolicyRule = z.infer<typeof actionPolicyRuleShape>;

function canonicalCondition(condition: ActionPolicyStructuredCondition | undefined) {
  if (condition === undefined) return undefined;
  return {
    field: condition.field,
    op: condition.op,
    value: condition.value,
  };
}

export const actionPolicyRuleContract = defineContract({
  schema: ACTION_POLICY_RULE_SCHEMA,
  shape: actionPolicyRuleShape,
  canonical: (rule) => ({
    schema: ACTION_POLICY_RULE_SCHEMA,
    id: rule.id,
    version: rule.version,
    from_correction_id: rule.fromCorrectionId,
    eval_case_id: rule.evalCaseId,
    scope: {
      tool: rule.scope.tool,
      action: rule.scope.action,
      ...(rule.scope.targetPattern !== undefined ? { target_pattern: rule.scope.targetPattern } : {}),
      ...(rule.scope.condition !== undefined ? { condition: canonicalCondition(rule.scope.condition) } : {}),
    },
    effect: {
      verdict: rule.effect.verdict,
      action_type: rule.effect.actionType,
      reasons: rule.effect.reasons,
      required_before: rule.effect.requiredBefore,
    },
    status: rule.status,
    ...(rule.supersedesId !== undefined ? { supersedes_id: rule.supersedesId } : {}),
    created_at: rule.createdAt,
  }),
});

export const actionPolicyRuleGoldenVectors = [
  {
    name: "pr-merge-dual-approval-deny",
    purpose: "learned action policy denies PR merges before two reviewer approvals",
    input: {
      id: "aprule_dual_approval",
      version: 1,
      fromCorrectionId: "ce_pr20_reject",
      evalCaseId: "ec_pr20_dual_approval",
      scope: {
        tool: "gh",
        action: "pr-merge",
        targetPattern: "PR#*",
        condition: { field: "reviews.approved", op: "<", value: 2 },
      },
      effect: {
        verdict: "deny",
        actionType: "block_agent_action",
        reasons: ["Never merge without both reviewers approving."],
        requiredBefore: ["Collect at least two approving reviews before merging."],
      },
      status: "proposed",
      createdAt: "2026-06-27T20:00:00.000Z",
    } satisfies ActionPolicyRule,
  },
];
