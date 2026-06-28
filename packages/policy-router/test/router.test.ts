/**
 * Router tests — deterministic golden tests against Acme fixtures.
 * No integration; all rules, contexts, and expected outcomes are baked in.
 * Real logic + real tests per AGENTS.md Rule 6.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { PolicyRouter, InMemoryPolicyRuleStore } from "../src/router.ts";
import {
  acmeRules,
  acmeDetectContext,
  acmeEnforceContext,
  acmeAuditContext,
  acmeImproveContext,
  acmeEuResidencyRule,
  acmeEnforceEuResidencyRule,
} from "../src/fixtures.ts";

describe("PolicyRouter — Acme golden tests", () => {
  let router: PolicyRouter;

  // Set up the router with Acme rules
  beforeEach(() => {
    const store = new InMemoryPolicyRuleStore(acmeRules);
    router = new PolicyRouter(store);
  });

  describe("Detect stage — EU residency missing", () => {
    it("should match the EU residency rule when requirement is dropped", async () => {
      const response = await router.route(acmeDetectContext);

      assert.equal(response.workstreamId, "acme_expansion");
      assert.equal(response.stage, "detect");

      // Should have 4 rules evaluated (one per stage)
      assert.equal(response.matchedRules.length, 4);

      // Only the detect-stage rule should match
      const detectMatches = response.matchedRules.filter(
        (mr) => mr.matched,
      );
      assert.equal(detectMatches.length, 1);

      const detectMatch = detectMatches[0];
      assert(detectMatch !== undefined);
      assert.equal(detectMatch.ruleId, "pr_acme_eu_residency");
      assert.equal(detectMatch.ruleName, "EU Data Residency Requirement Dropped");
      assert.equal(detectMatch.matched, true);
      assert.equal(detectMatch.reason, "All conditions satisfied");
    });

    it("should compile one action for the detect stage", async () => {
      const response = await router.route(acmeDetectContext);

      assert.equal(response.compiledActions.length, 1);

      const action = response.compiledActions[0];
      assert(action !== undefined);
      assert.equal(action.type, "create_linear_workstream");
      assert.equal(
        action.payload?.title,
        "EU Data Residency Requirement — Acme Expansion",
      );
      assert.deepEqual(action.payload?.requiredOwners, [
        "Product",
        "Security",
        "Engineering",
      ]);
    });

    it("should not match rules for other stages at detect time", async () => {
      const response = await router.route(acmeDetectContext);

      const enforceMatches = response.matchedRules.filter(
        (mr) => mr.ruleId === "pr_acme_enforce_eu",
      );
      assert(enforceMatches.length > 0);
      assert.equal(enforceMatches[0]!.matched, false);
      assert(enforceMatches[0]!.reason?.includes("Stage mismatch"));

      const auditMatches = response.matchedRules.filter(
        (mr) => mr.ruleId === "pr_acme_audit_eu",
      );
      assert(auditMatches.length > 0);
      assert.equal(auditMatches[0]!.matched, false);

      const improveMatches = response.matchedRules.filter(
        (mr) => mr.ruleId === "pr_acme_improve_eu",
      );
      assert(improveMatches.length > 0);
      assert.equal(improveMatches[0]!.matched, false);
    });
  });

  describe("Enforce stage — status flip and block customer action", () => {
    it("should match the enforce rule when shifting from on-track to at-risk", async () => {
      const response = await router.route(acmeEnforceContext);

      assert.equal(response.stage, "enforce");

      const enforceMatches = response.matchedRules.filter(
        (mr) => mr.matched,
      );
      assert.equal(enforceMatches.length, 1);

      const enforceMatch = enforceMatches[0];
      assert(enforceMatch !== undefined);
      assert.equal(enforceMatch.ruleId, "pr_acme_enforce_eu");
      assert.equal(enforceMatch.matched, true);
    });

    it("should compile block_agent_action for enforcing correction", async () => {
      const response = await router.route(acmeEnforceContext);

      assert.equal(response.compiledActions.length, 1);

      const action = response.compiledActions[0];
      assert(action !== undefined);
      assert.equal(action.type, "block_agent_action");
      assert.equal(action.payload?.blockedActionType, "customer_update");
      const requiredBefore = action.payload?.requiredBeforeSend;
      assert(Array.isArray(requiredBefore));
      assert(requiredBefore.includes(
        "Assign Product, Security, Engineering owners",
      ));
    });

    it("should not match enforce rule if status is already at-risk", async () => {
      const alreadyEnforcedContext = {
        ...acmeEnforceContext,
        currentStatus: "at-risk", // Already enforced, not on-track anymore
      };

      const response = await router.route(alreadyEnforcedContext);

      const enforceMatches = response.matchedRules.filter(
        (mr) => mr.ruleId === "pr_acme_enforce_eu",
      );
      assert(enforceMatches.length > 0);
      assert.equal(enforceMatches[0]!.matched, false);
    });
  });

  describe("Audit stage — record correction", () => {
    it("should match the audit rule when requirement is dropped", async () => {
      const response = await router.route(acmeAuditContext);

      assert.equal(response.stage, "audit");

      const auditMatches = response.matchedRules.filter(
        (mr) => mr.matched,
      );
      assert.equal(auditMatches.length, 1);

      const auditMatch = auditMatches[0];
      assert(auditMatch !== undefined);
      assert.equal(auditMatch.ruleId, "pr_acme_audit_eu");
    });

    it("should compile record_audit_event action", async () => {
      const response = await router.route(acmeAuditContext);

      assert.equal(response.compiledActions.length, 1);

      const action = response.compiledActions[0];
      assert(action !== undefined);
      assert.equal(action.type, "record_audit_event");
      const affectedSystems = action.payload?.affectedSystems;
      assert(Array.isArray(affectedSystems));
      assert(affectedSystems.includes("governance_ledger"));
    });
  });

  describe("Improve stage — evaluate correction", () => {
    it("should still match improve rule if missing requirement was in original list", async () => {
      // Even though acmeImproveContext has empty missingRequirements,
      // the rule is based on the original drop condition.
      // Real matchers might check history; for this test we verify
      // that if the condition is re-evaluated with the old context:
      const originalDropContext = {
        ...acmeImproveContext,
        missingRequirements: ["eu_data_residency"],
      };

      const response = await router.route(originalDropContext);

      const improveMatches = response.matchedRules.filter(
        (mr) => mr.matched && mr.ruleId === "pr_acme_improve_eu",
      );
      assert.equal(improveMatches.length, 1);
    });

    it("should compile generate_eval action", async () => {
      const contextWithMissing = {
        ...acmeImproveContext,
        missingRequirements: ["eu_data_residency"],
      };

      const response = await router.route(contextWithMissing);

      const evalActions = response.compiledActions.filter(
        (a) => a.type === "generate_eval",
      );
      assert.equal(evalActions.length, 1);

      const evalAction = evalActions[0];
      assert(evalAction !== undefined);
      assert.equal(
        evalAction.payload?.criterion,
        "eu_data_residency_present_and_enforced",
      );
    });
  });

  describe("Full lifecycle — all stages in sequence", () => {
    it("should handle detect → enforce → audit → improve sequence deterministically", async () => {
      // Stage 1: Detect
      const detectResponse = await router.route(acmeDetectContext);
      assert.equal(detectResponse.matchedRules.filter((mr) => mr.matched).length, 1);
      assert(detectResponse.compiledActions[0] !== undefined);
      assert.equal(detectResponse.compiledActions[0]!.type, "create_linear_workstream");

      // Stage 2: Enforce
      const enforceResponse = await router.route(acmeEnforceContext);
      assert.equal(enforceResponse.matchedRules.filter((mr) => mr.matched).length, 1);
      assert(enforceResponse.compiledActions[0] !== undefined);
      assert.equal(enforceResponse.compiledActions[0]!.type, "block_agent_action");

      // Stage 3: Audit
      const auditResponse = await router.route(acmeAuditContext);
      assert.equal(auditResponse.matchedRules.filter((mr) => mr.matched).length, 1);
      assert(auditResponse.compiledActions[0] !== undefined);
      assert.equal(auditResponse.compiledActions[0]!.type, "record_audit_event");

      // Stage 4: Improve
      const improveContextWithMissing = {
        ...acmeImproveContext,
        missingRequirements: ["eu_data_residency"],
      };
      const improveResponse = await router.route(improveContextWithMissing);
      assert(improveResponse.compiledActions.length > 0);
    });
  });

  describe("Rule expiration", () => {
    it("should not match expired rules", async () => {
      const expiredRule = {
        ...acmeEuResidencyRule,
        id: "pr_expired",
        expiresAt: "2026-06-26T23:59:59.000Z", // Already expired
      };

      const store = new InMemoryPolicyRuleStore([expiredRule]);
      const testRouter = new PolicyRouter(store);

      const response = await testRouter.route(acmeDetectContext);

      // All rules evaluated; none matched due to stage mismatch or expiration
      const matched = response.matchedRules.filter((mr) => mr.matched);
      assert.equal(matched.length, 0);
    });
  });

  describe("getActiveRules", () => {
    it("should return non-expired rules for a scope", async () => {
      const activeRules = await router.getActiveRules("acme_expansion");

      assert.equal(activeRules.length, 4); // All Acme rules are non-expired
      assert(activeRules.every((r) => r.scope === "acme_expansion"));
    });

    it("should exclude expired rules", async () => {
      const now = new Date();
      const expiredRule = {
        ...acmeEuResidencyRule,
        id: "pr_expired_test",
        expiresAt: new Date(now.getTime() - 1000).toISOString(), // 1 second ago
      };
      const futureRule = {
        ...acmeEuResidencyRule,
        id: "pr_future",
        expiresAt: new Date(now.getTime() + 1000000).toISOString(), // Way in future
      };

      const store = new InMemoryPolicyRuleStore([
        expiredRule,
        futureRule,
        acmeEuResidencyRule,
      ]);
      const testRouter = new PolicyRouter(store);

      const activeRules = await testRouter.getActiveRules("acme_expansion");

      assert.equal(activeRules.length, 2); // Exclude the expired rule
      assert.equal(
        activeRules.find((r) => r.id === "pr_expired_test"),
        undefined,
      );
    });
  });

  describe("Router response validation", () => {
    it("should return a valid PolicyRouterResponse", async () => {
      const response = await router.route(acmeDetectContext);

      assert.equal(response.workstreamId, "acme_expansion");
      assert.equal(response.stage, "detect");
      assert(Array.isArray(response.matchedRules));
      assert(Array.isArray(response.compiledActions));
      assert(response.timestamp !== undefined);

      // Timestamp should be a valid ISO date
      const timestamp = new Date(response.timestamp);
      assert(timestamp instanceof Date && !isNaN(timestamp.getTime()));
    });
  });

  describe("Empty rule set", () => {
    it("should handle no rules gracefully", async () => {
      const emptyStore = new InMemoryPolicyRuleStore([]);
      const emptyRouter = new PolicyRouter(emptyStore);

      const response = await emptyRouter.route(acmeDetectContext);

      assert.equal(response.matchedRules.length, 0);
      assert.equal(response.compiledActions.length, 0);
    });
  });

  describe("No matching rules for context", () => {
    it("should return empty actions when context doesn't match any rule", async () => {
      const wrongScopeContext = {
        ...acmeDetectContext,
        workstreamId: "stripe_expansion", // Different scope
      };

      const response = await router.route(wrongScopeContext);

      const matched = response.matchedRules.filter((mr) => mr.matched);
      assert.equal(matched.length, 0);
      assert.equal(response.compiledActions.length, 0);
    });
  });
});
