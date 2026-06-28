/**
 * PolicyRouter — loads active rules per goal/run, applies a matcher, and
 * compiles results into enforcement actions.
 *
 * Core contract:
 * - Load rules by scope and stage (e.g., "acme_expansion" at "detect" stage)
 * - Apply a deterministic matcher to identify applicable rules
 * - Compile matched rules into concrete actions
 * - Return a structured response with matched rules + compiled actions
 *
 * The router does not execute actions — it routes and compiles; execution is
 * downstream (in enforce.ts, approve-enforce.ts, etc.).
 */

import type {
  PolicyRule,
  PolicyMatchContext,
  PolicyRouterResponse,
  PolicyMatchResult,
} from "./policy-rule.contract.ts";
import {
  policyRuleShape,
  policyRouterResponse,
  policyMatchResult,
} from "./policy-rule.contract.ts";

/**
 * PolicyMatcher — a function that evaluates whether a rule matches
 * a given context. Receives rule + context, returns match result.
 */
export type PolicyMatcher = (
  rule: PolicyRule,
  context: PolicyMatchContext,
) => PolicyMatchResult;

/**
 * PolicyRuleStore — abstraction for rule persistence/retrieval.
 * Allows rules to be loaded from memory, files, or external stores.
 */
export interface PolicyRuleStore {
  listRules(): Promise<PolicyRule[]>;
  getRuleById(id: string): Promise<PolicyRule | null>;
  getRulesByScope(scope: string): Promise<PolicyRule[]>;
}

/**
 * InMemoryPolicyRuleStore — a simple in-memory store backed by an array.
 * Useful for deterministic testing with fixtures.
 */
export class InMemoryPolicyRuleStore implements PolicyRuleStore {
  private rules: PolicyRule[];

  constructor(rules: PolicyRule[]) {
    this.rules = rules;
  }

  async listRules(): Promise<PolicyRule[]> {
    return this.rules;
  }

  async getRuleById(id: string): Promise<PolicyRule | null> {
    return this.rules.find((r) => r.id === id) ?? null;
  }

  async getRulesByScope(scope: string): Promise<PolicyRule[]> {
    return this.rules.filter((r) => r.scope === scope);
  }
}

/**
 * A default matcher that handles common conditions:
 * - Checks if a rule's expiresAt is in the past (inactive)
 * - Compares status flips
 * - Checks for missing requirements
 * - Can be extended with custom domain logic
 */
export const createDefaultMatcher = (): PolicyMatcher => {
  return (rule: PolicyRule, context: PolicyMatchContext): PolicyMatchResult => {
    // Check expiration
    if (rule.expiresAt) {
      const expiresAt = new Date(rule.expiresAt);
      if (expiresAt < new Date()) {
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          matched: false,
          reason: `Rule expired at ${rule.expiresAt}`,
        };
      }
    }

    // Check stage match
    if (rule.stage !== context.stage) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        matched: false,
        reason: `Stage mismatch: rule is for stage ${rule.stage}, context is ${context.stage}`,
      };
    }

    // Check scope match
    if (rule.scope !== context.workstreamId) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        matched: false,
        reason: `Scope mismatch: rule is for ${rule.scope}, context is ${context.workstreamId}`,
      };
    }

    // Simple condition matching: check if all condition keys are present in context
    // and have matching values. This is a basic strategy; custom matchers can
    // implement domain-specific logic.
    const conditionKeys = Object.keys(rule.condition);
    for (const key of conditionKeys) {
      const conditionValue = rule.condition[key];

      // Check requirementDropped
      if (
        key === "requirementDropped" &&
        typeof conditionValue === "string"
      ) {
        const isMissing = context.missingRequirements?.includes(
          conditionValue,
        ) ?? false;
        if (!isMissing) {
          return {
            ruleId: rule.id,
            ruleName: rule.name,
            matched: false,
            reason: `Required missing requirement "${conditionValue}" not found in context`,
          };
        }
      }

      // Check missingOwners
      if (key === "missingOwners" && Array.isArray(conditionValue)) {
        const missingOwners = conditionValue as string[];
        const hasMissingOwners = missingOwners.some(
          (owner) =>
            !context.agentOutput?.owners ||
            !(context.agentOutput.owners as string[]).includes(owner),
        );
        if (!hasMissingOwners) {
          return {
            ruleId: rule.id,
            ruleName: rule.name,
            matched: false,
            reason: `All required owners present; rule expects missing owners`,
          };
        }
      }

      // Check statusFlip
      if (key === "statusFlip" && typeof conditionValue === "object") {
        const statusFlip = conditionValue as { from?: string; to?: string };
        if (
          statusFlip.from &&
          context.currentStatus !== statusFlip.from
        ) {
          return {
            ruleId: rule.id,
            ruleName: rule.name,
            matched: false,
            reason: `Status mismatch: rule expects from="${statusFlip.from}", context is "${context.currentStatus}"`,
          };
        }
        // Note: we don't check 'to' field in the matcher; the rule fires if
        // the current status is the 'from' state. The 'to' describes what action to take.
      }
    }

    // All conditions matched
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      matched: true,
      extractedParams: {},
      reason: "All conditions satisfied",
    };
  };
};

/**
 * PolicyRouter — loads rules, applies matcher, returns compiled actions.
 */
export class PolicyRouter {
  private store: PolicyRuleStore;
  private matcher: PolicyMatcher;

  constructor(
    store: PolicyRuleStore,
    matcher?: PolicyMatcher,
  ) {
    this.store = store;
    this.matcher = matcher ?? createDefaultMatcher();
  }

  /**
   * Route — the main entry point.
   * Loads rules for a given scope, applies the matcher, returns matched
   * rules + compiled actions.
   */
  async route(context: PolicyMatchContext): Promise<PolicyRouterResponse> {
    const rules = await this.store.getRulesByScope(context.workstreamId);

    const matchedRules: PolicyMatchResult[] = [];
    for (const rule of rules) {
      const result = this.matcher(rule, context);
      matchedRules.push(result);
    }

    const compiledActions = matchedRules
      .filter((mr) => mr.matched)
      .map((mr) => {
        // Find the corresponding rule to get its action
        const rule = rules.find((r) => r.id === mr.ruleId);
        if (!rule) {
          throw new Error(
            `Rule ${mr.ruleId} matched but not found in store`,
          );
        }
        return rule.action;
      });

    const response: PolicyRouterResponse = {
      workstreamId: context.workstreamId,
      stage: context.stage,
      matchedRules,
      compiledActions,
      timestamp: new Date().toISOString(),
    };

    return policyRouterResponse.parse(response);
  }

  /**
   * getActiveRules — returns all rules for a scope that are not expired.
   */
  async getActiveRules(scope: string): Promise<PolicyRule[]> {
    const rules = await this.store.getRulesByScope(scope);
    const now = new Date();
    return rules.filter((rule) => {
      if (!rule.expiresAt) return true;
      return new Date(rule.expiresAt) >= now;
    });
  }

  /**
   * getAllRules — returns all rules from the store.
   */
  async getAllRules(): Promise<PolicyRule[]> {
    return this.store.listRules();
  }
}
