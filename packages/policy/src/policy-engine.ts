import {
  interceptedActionContract,
  actionPolicyRuleContract,
  type ActionGateDecision,
  type InterceptedAction,
  type ActionPolicyRule,
  type ActionPolicyVerdict,
  type ActionPolicyStructuredCondition,
} from "@liminal-engine/contracts";
import type { PolicyStore } from "./ports.ts";
import { evaluateScope, type ProxyScope } from "./scope.ts";

export type PolicyMode = "shadow" | "intercept" | "learned";

export interface DecideDeps {
  mode: PolicyMode;
  scope?: ProxyScope;
}

export interface PolicyDecision extends ActionGateDecision {
  verdict: ActionPolicyVerdict;
  allowed: boolean;
  source: "operator" | "policy" | "scope" | "default-deny";
  sourceRuleId?: string;
  outOfScope?: boolean;
  scopeReason?: string;
  shadowVerdict?: ActionPolicyVerdict;
  shadowRuleId?: string;
  shadowReasons?: string[];
}

interface Candidate {
  rule: ActionPolicyRule;
  specificity: number;
  verdictRank: number;
}

const VERDICT_RANK: Record<ActionPolicyVerdict, number> = {
  deny: 3,
  ask: 2,
  allow: 1,
};

export function decide(
  rawAction: InterceptedAction,
  rawRules: readonly ActionPolicyRule[],
  deps: DecideDeps,
): PolicyDecision {
  const action = interceptedActionContract.parse(rawAction);
  const scope = evaluateScope(action, deps.scope);
  if (!scope.inScope) {
    return {
      verdict: "allow",
      allowed: true,
      reasons: [],
      requiredBeforeSend: [],
      source: "scope",
      outOfScope: true,
      scopeReason: scope.reason,
    };
  }

  const rules = rawRules.map((rule) => actionPolicyRuleContract.parse(rule));
  const candidate = bestMatchingRule(action, rules);

  if (candidate) {
    return decisionFromRule(candidate.rule, deps.mode);
  }

  if (deps.mode === "shadow") {
    return {
      verdict: "allow",
      allowed: true,
      reasons: [],
      requiredBeforeSend: [],
      source: "default-deny",
    };
  }

  return {
    verdict: "ask",
    allowed: false,
    reasons: [
      `No active policy rule matched ${action.tool} ${action.action}; operator approval is required.`,
    ],
    requiredBeforeSend: ["Record an operator approve/disapprove verdict for this action class."],
    source: "default-deny",
  };
}

export async function decideFromStore(
  action: InterceptedAction,
  store: Pick<PolicyStore, "activeRules">,
  deps: DecideDeps,
): Promise<PolicyDecision> {
  try {
    return decide(action, await store.activeRules(), deps);
  } catch (error) {
    const detail = error instanceof Error && error.message.length > 0 ? `: ${error.message}` : "";
    return {
      verdict: "deny",
      allowed: false,
      reasons: [`Policy evaluation failed closed${detail}.`],
      requiredBeforeSend: ["Restore policy evaluation before running consequential actions."],
      source: "default-deny",
    };
  }
}

function decisionFromRule(rule: ActionPolicyRule, mode: PolicyMode): PolicyDecision {
  if (mode === "shadow") {
    return {
      verdict: "allow",
      allowed: true,
      reasons: [],
      requiredBeforeSend: [],
      source: "policy",
      sourceRuleId: rule.id,
      shadowVerdict: rule.effect.verdict,
      shadowRuleId: rule.id,
      shadowReasons: [...rule.effect.reasons],
    };
  }

  return {
    verdict: rule.effect.verdict,
    allowed: rule.effect.verdict === "allow",
    reasons: [...rule.effect.reasons],
    requiredBeforeSend: [...rule.effect.requiredBefore],
    source: "policy",
    sourceRuleId: rule.id,
  };
}

function bestMatchingRule(action: InterceptedAction, rules: readonly ActionPolicyRule[]): Candidate | null {
  const candidates = rules
    .filter((rule) => rule.status === "active")
    .map((rule) => {
      const specificity = matchSpecificity(action, rule);
      return specificity === null
        ? null
        : {
            rule,
            specificity,
            verdictRank: VERDICT_RANK[rule.effect.verdict],
          };
    })
    .filter((candidate): candidate is Candidate => candidate !== null);

  candidates.sort(
    (a, b) =>
      b.specificity - a.specificity
      || b.verdictRank - a.verdictRank
      || b.rule.version - a.rule.version
      || b.rule.createdAt.localeCompare(a.rule.createdAt)
      || a.rule.id.localeCompare(b.rule.id),
  );
  return candidates[0] ?? null;
}

function matchSpecificity(action: InterceptedAction, rule: ActionPolicyRule): number | null {
  let specificity = 0;

  if (rule.scope.tool !== "*") {
    if (rule.scope.tool !== action.tool) return null;
    specificity += 1;
  }

  if (rule.scope.action !== "*") {
    if (rule.scope.action !== action.action) return null;
    specificity += 2;
  }

  if (rule.scope.targetPattern !== undefined) {
    if (action.target === undefined || !wildcardMatch(rule.scope.targetPattern, action.target)) {
      return null;
    }
    specificity += 4;
  }

  if (rule.scope.condition !== undefined) {
    if (!conditionMatches(action, rule.scope.condition)) return null;
    specificity += 8;
  }

  return specificity;
}

function conditionMatches(action: InterceptedAction, condition: ActionPolicyStructuredCondition): boolean {
  const actual = readConditionField(action, condition.field);
  switch (condition.op) {
    case "<":
      return typeof actual === "number" && typeof condition.value === "number" && actual < condition.value;
    case "<=":
      return typeof actual === "number" && typeof condition.value === "number" && actual <= condition.value;
    case ">":
      return typeof actual === "number" && typeof condition.value === "number" && actual > condition.value;
    case ">=":
      return typeof actual === "number" && typeof condition.value === "number" && actual >= condition.value;
    case "==":
      return actual === condition.value;
    case "!=":
      return actual !== condition.value;
    case "contains":
      if (typeof actual === "string" && typeof condition.value === "string") {
        return actual.includes(condition.value);
      }
      if (Array.isArray(actual)) {
        return actual.some((item) => item === condition.value);
      }
      return false;
    case "matches":
      return typeof actual === "string"
        && typeof condition.value === "string"
        && wildcardMatch(condition.value, actual);
  }
}

function readConditionField(action: InterceptedAction, field: ActionPolicyStructuredCondition["field"]): unknown {
  switch (field) {
    case "tool":
      return action.tool;
    case "action":
      return action.action;
    case "target":
      return action.target;
    case "args.force":
      return readPath(action.args, ["force"]);
    case "reviews.approved":
      return readPath(action.args, ["reviews", "approved"]);
    case "reviews.rejected":
      return readPath(action.args, ["reviews", "rejected"]);
    case "repo.visibility":
      return readPath(action.args, ["repo", "visibility"]);
    case "deploy.environment":
      return readPath(action.args, ["deploy", "environment"]);
  }
}

function readPath(value: unknown, path: readonly string[]): unknown {
  let cursor = value;
  for (const key of path) {
    if (cursor === null || typeof cursor !== "object" || Array.isArray(cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}

function wildcardMatch(pattern: string, value: string): boolean {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`).test(value);
}
