import type { InterceptedAction } from "@liminal-engine/contracts";

export interface ScopeRule {
  id: string;
  tool?: string;
  action?: string;
  targetPattern?: string;
}

export interface ProxyScope {
  include: readonly ScopeRule[];
  exclude?: readonly ScopeRule[];
}

export interface ScopeEvaluation {
  inScope: boolean;
  matchedIncludeId?: string;
  matchedExcludeId?: string;
  reason: string;
}

export function evaluateScope(action: InterceptedAction, scope?: ProxyScope): ScopeEvaluation {
  if (scope === undefined) {
    return {
      inScope: true,
      reason: "No proxy scope configured; action is in scope by default.",
    };
  }

  const excluded = (scope.exclude ?? []).find((rule) => scopeRuleMatches(action, rule));
  if (excluded !== undefined) {
    return {
      inScope: false,
      matchedExcludeId: excluded.id,
      reason: `Action matched excluded scope ${excluded.id}.`,
    };
  }

  if (scope.include.length === 0) {
    return {
      inScope: false,
      reason: "Proxy scope has no include rules.",
    };
  }

  const included = scope.include.find((rule) => scopeRuleMatches(action, rule));
  if (included === undefined) {
    return {
      inScope: false,
      reason: "Action did not match any included proxy scope.",
    };
  }

  return {
    inScope: true,
    matchedIncludeId: included.id,
    reason: `Action matched included scope ${included.id}.`,
  };
}

export function scopeRuleMatches(action: InterceptedAction, rule: ScopeRule): boolean {
  if (rule.tool !== undefined && rule.tool !== "*" && rule.tool !== action.tool) return false;
  if (rule.action !== undefined && rule.action !== "*" && rule.action !== action.action) return false;
  if (rule.targetPattern !== undefined) {
    if (action.target === undefined || !wildcardMatch(rule.targetPattern, action.target)) return false;
  }
  return true;
}

function wildcardMatch(pattern: string, value: string): boolean {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`).test(value);
}
