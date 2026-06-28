import type { EvalResult, ActionPolicyRule } from "@liminal-engine/contracts";

export interface RuleHealthRow {
  ruleId: string;
  evalCaseId: string;
  before: "fail" | "pass" | "missing";
  after: "fail" | "pass" | "missing";
  healthy: boolean;
}

export function ruleHealthTable(
  rules: readonly ActionPolicyRule[],
  results: readonly EvalResult[],
): RuleHealthRow[] {
  return [...rules]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((rule) => {
      const ruleResults = results
        .filter((result) => result.evalCaseId === rule.evalCaseId)
        .sort((a, b) => a.passNumber - b.passNumber);
      const before = ruleResults[0]?.result ?? "missing";
      const after = ruleResults[ruleResults.length - 1]?.result ?? "missing";
      return {
        ruleId: rule.id,
        evalCaseId: rule.evalCaseId,
        before,
        after,
        healthy: before === "fail" && after === "pass",
      };
    });
}
