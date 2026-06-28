/**
 * PolicyRule — a reusable enforcement rule that matches conditions and applies
 * actions in a governance workflow. Provides the foundation for a declarative
 * policy routing engine: rules can be loaded per goal/run, matched against
 * state, and executed deterministically.
 *
 * A rule consists of:
 * - id: unique identifier (e.g., "pr_acme_eu_residency")
 * - name: human-readable rule name
 * - scope: which workstream(s) this rule applies to (e.g., "acme_expansion")
 * - stage: governance phase when this rule activates (e.g., "detect", "enforce", "audit")
 * - condition: a JSON-serializable predicate that determines if the rule matches
 * - action: the enforcement action(s) to take if matched
 * - expiresAt: optional expiration timestamp; rules past this are inactive
 *
 * The router loads active rules, applies a matcher to find applicable rules,
 * and compiles results into enforcement actions or blocks.
 */
import { z } from "zod";

export const POLICY_RULE_SCHEMA = "liminal_engine.policy_rule.v1";

/**
 * Governance phases where rules can activate. Rules may apply to multiple phases.
 */
export const policyRuleStage = z.enum([
  "detect",      // Detection phase: identifying governance misses
  "enforce",     // Enforcement phase: applying corrections
  "audit",       // Audit phase: recording compliance
  "improve",     // Improvement phase: evaluating corrections
]);
export type PolicyRuleStage = z.infer<typeof policyRuleStage>;

/**
 * Fixed set of actions a policy rule can take (closed enum per specs/SPEC.md).
 * Mirrors EnforcementActionType but from the policy/rule side.
 */
export const policyActionType = z.enum([
  "change_status",
  "create_linear_workstream",
  "assign_owner",
  "block_agent_action",
  "require_approval",
  "generate_eval",
  "activate_policy",
  "record_audit_event",
]);
export type PolicyActionType = z.infer<typeof policyActionType>;

/**
 * A condition is a free-form JSON object that describes a matching predicate.
 * The matcher will apply domain-specific logic to evaluate it. Examples:
 *
 * { "requirementDropped": "eu_data_residency" }
 * { "missingOwners": ["Product", "Security"] }
 * { "statusFlip": { "from": "on-track", "to": "at-risk" } }
 */
export const policyCondition = z.record(z.unknown());
export type PolicyCondition = z.infer<typeof policyCondition>;

/**
 * An action payload — the command to execute if a rule matches.
 * Type and content are action-specific; the router compiles these into
 * EnforcementActions downstream.
 */
export const policyAction = z.object({
  type: policyActionType,
  payload: z.record(z.unknown()).optional(),
});
export type PolicyAction = z.infer<typeof policyAction>;

/**
 * PolicyRule — the complete rule definition.
 */
export const policyRuleShape = z.object({
  id: z.string().min(1),           // Unique rule ID
  name: z.string().min(1),         // Human-readable name
  scope: z.string().min(1),        // Which workstream(s) this applies to (e.g., "acme_expansion")
  stage: policyRuleStage,          // When this rule activates
  condition: policyCondition,      // Predicate determining if rule matches
  action: policyAction,            // Action to take if matched
  expiresAt: z.string().datetime().optional(), // Optional expiration
  createdAt: z.string().datetime(), // Creation timestamp for lineage
});
export type PolicyRule = z.infer<typeof policyRuleShape>;

/**
 * Match result: a rule matched, along with any extracted parameters.
 */
export const policyMatchResult = z.object({
  ruleId: z.string().min(1),
  ruleName: z.string().min(1),
  matched: z.boolean(),
  extractedParams: z.record(z.unknown()).optional(),
  reason: z.string().optional(),
});
export type PolicyMatchResult = z.infer<typeof policyMatchResult>;

/**
 * Router response: all matched rules and compiled actions for a given state.
 */
export const policyRouterResponse = z.object({
  workstreamId: z.string().min(1),
  stage: policyRuleStage,
  matchedRules: z.array(policyMatchResult),
  compiledActions: z.array(policyAction),
  timestamp: z.string().datetime(),
});
export type PolicyRouterResponse = z.infer<typeof policyRouterResponse>;

/**
 * Policy state context — the snapshot a matcher receives to evaluate rules.
 * Can include deal status, missing requirements, agent output, etc.
 */
export const policyMatchContext = z.object({
  workstreamId: z.string().min(1),
  dealId: z.string().min(1),
  stage: policyRuleStage,
  currentStatus: z.string().optional(),
  missingRequirements: z.array(z.string()).optional(),
  agentOutput: z.record(z.unknown()).optional(),
  previousDecisions: z.array(z.record(z.unknown())).optional(),
});
export type PolicyMatchContext = z.infer<typeof policyMatchContext>;
