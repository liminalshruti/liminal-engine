/**
 * @liminal-engine/policy-router — reusable policy rule engine
 *
 * Exports:
 * - PolicyRule contract (id, name, scope, stage, condition, action, expiresAt)
 * - PolicyRouter (loads active rules, applies matcher, compiles actions)
 * - PolicyMatcher (evaluates rule match against context)
 * - Fixtures (deterministic Acme golden test data)
 */

export * from "./policy-rule.contract.ts";
export * from "./router.ts";
export { acmeRules, acmeDetectContext, acmeEnforceContext, acmeAuditContext, acmeImproveContext } from "./fixtures.ts";
