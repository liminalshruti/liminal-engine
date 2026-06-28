import {
  interceptedActionContract,
  type InterceptedAction,
} from "@liminal-engine/contracts";

export type MatchReplaceField = "tool" | "action" | "target" | "args";

export interface MatchReplaceRule {
  id: string;
  enabled: boolean;
  field: MatchReplaceField;
  /** Required when field is "args"; dot-separated path such as "reviews.approved". */
  argPath?: string;
  match: string | number | boolean;
  replace: string | number | boolean;
  mode?: "literal" | "wildcard";
}

export interface MatchReplaceResult {
  action: InterceptedAction;
  appliedRuleIds: string[];
}

export function applyMatchReplaceRules(
  input: InterceptedAction,
  rules: readonly MatchReplaceRule[],
): MatchReplaceResult {
  let action = interceptedActionContract.parse(input);
  const appliedRuleIds: string[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const next = applyRule(action, rule);
    if (next !== action) {
      action = next;
      appliedRuleIds.push(rule.id);
    }
  }

  return { action, appliedRuleIds };
}

function applyRule(action: InterceptedAction, rule: MatchReplaceRule): InterceptedAction {
  if (rule.field === "tool" || rule.field === "action" || rule.field === "target") {
    const current = action[rule.field];
    if (typeof current !== "string" || !matches(current, rule.match, rule.mode ?? "literal")) {
      return action;
    }
    if (typeof rule.replace !== "string") {
      throw new Error(`match-replace rule ${rule.id} must replace ${rule.field} with a string`);
    }
    return interceptedActionContract.parse({ ...action, [rule.field]: rule.replace });
  }

  if (rule.argPath === undefined || rule.argPath.trim().length === 0) {
    throw new Error(`match-replace rule ${rule.id} on args requires argPath`);
  }
  const path = rule.argPath.split(".").filter((part) => part.length > 0);
  const current = readPath(action.args, path);
  if (!matches(current, rule.match, rule.mode ?? "literal")) return action;
  return interceptedActionContract.parse({
    ...action,
    args: writePath(action.args, path, rule.replace),
  });
}

function matches(current: unknown, expected: MatchReplaceRule["match"], mode: "literal" | "wildcard"): boolean {
  if (mode === "literal") return current === expected;
  return typeof current === "string"
    && typeof expected === "string"
    && wildcardMatch(expected, current);
}

function readPath(value: unknown, path: readonly string[]): unknown {
  let cursor = value;
  for (const key of path) {
    if (cursor === null || typeof cursor !== "object" || Array.isArray(cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}

function writePath(input: Record<string, unknown>, path: readonly string[], replacement: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = structuredClone(input);
  let cursor: Record<string, unknown> = out;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]!;
    const next = cursor[key];
    if (next === null || typeof next !== "object" || Array.isArray(next)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[path[path.length - 1]!] = replacement;
  return out;
}

function wildcardMatch(pattern: string, value: string): boolean {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`).test(value);
}
