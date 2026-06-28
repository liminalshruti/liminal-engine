/**
 * Gateway metrics — surfaces the "it gets more useful the more it's used" proof
 * over the gateway's recorded history + active-rule state. Pure, deterministic
 * read (no clock, no I/O, no randomness).
 *
 * REUSES (never reimplements) the existing math:
 *   - escalation-rate decay:  @liminal-engine/policy        (escalationSeries / finalEscalationRate)
 *   - per-rule Fail -> Pass:  @liminal-engine/eval-harness  (ruleHealthTable)
 *
 * The before/after eval results fed to ruleHealthTable are *computed*, never
 * hardcoded: each learned rule's originating action is replayed through the real
 * policy engine (decide) — WITHOUT the rule the action escalates to the operator
 * ("ask" = fail), WITH it the system governs the class autonomously (= pass).
 */
import type { ActionPolicyRule, EvalResult, InterceptedAction } from "@liminal-engine/contracts";
import {
  decide,
  escalationSeries,
  finalEscalationRate,
  type EscalationSample,
  type PolicyDecision,
} from "@liminal-engine/policy";
import { ruleHealthTable, type RuleHealthRow } from "@liminal-engine/eval-harness";
import type { ProxyHistoryEntry } from "./history.ts";

export interface EscalationMetric {
  /** Full samples: index, running totals, and the escalation rate at each governed action. */
  series: EscalationSample[];
  /** Sparkline-ready escalation-rate values (series.map((s) => s.escalationRate)). */
  rates: number[];
  /** Latest escalation rate (0 when no governed actions have been recorded yet). */
  current: number;
  /** Number of governed actions the series is computed over. */
  sampleCount: number;
}

export interface GatewayMetrics {
  /** asks-to-operator / governed-actions, as a sliding (sparkline-ready) series. */
  escalation: EscalationMetric;
  /** Count of active learned rules currently governing actions. */
  activeRuleCount: number;
  /** Per-rule eval health: Fail (before the rule) -> Pass (after the rule). */
  ruleHealth: RuleHealthRow[];
  ruleHealthSummary: { total: number; healthy: number };
}

export interface GatewayMetricsState {
  history: readonly ProxyHistoryEntry[];
  activeRules: readonly ActionPolicyRule[];
}

// Label only — ruleHealthTable keys results by evalCaseId, so dealId is not
// load-bearing here. The computed grade lives in `result`.
const RULE_HEALTH_DEAL = "gateway-rule-health";

export function emptyGatewayMetrics(): GatewayMetrics {
  return {
    escalation: { series: [], rates: [], current: 0, sampleCount: 0 },
    activeRuleCount: 0,
    ruleHealth: [],
    ruleHealthSummary: { total: 0, healthy: 0 },
  };
}

export function computeGatewayMetrics(state: GatewayMetricsState): GatewayMetrics {
  const escalation = computeEscalation(state.history);
  const ruleHealth = computeRuleHealth(state.history, state.activeRules);
  return {
    escalation,
    activeRuleCount: state.activeRules.length,
    ruleHealth,
    ruleHealthSummary: {
      total: ruleHealth.length,
      healthy: ruleHealth.reduce((n, row) => (row.healthy ? n + 1 : n), 0),
    },
  };
}

function computeEscalation(history: readonly ProxyHistoryEntry[]): EscalationMetric {
  // Governed actions = policy-evaluated agent actions (intercepts / repeater sends).
  // Operator forward/drop resolutions (decision.source === "operator") are the human's
  // RESPONSE to an escalation, not a governed action, so they are excluded from the
  // denominator — matching how escalationSeries is fed elsewhere in the codebase.
  const decisions: PolicyDecision[] = history
    .filter((entry) => entry.decision.source !== "operator")
    .map((entry) => entry.decision);
  const series = escalationSeries(decisions);
  return {
    series,
    rates: series.map((sample) => sample.escalationRate),
    current: finalEscalationRate(decisions),
    sampleCount: series.length,
  };
}

function computeRuleHealth(
  history: readonly ProxyHistoryEntry[],
  activeRules: readonly ActionPolicyRule[],
): RuleHealthRow[] {
  const observedActions = history.map((entry) => entry.action);
  const results: EvalResult[] = [];
  for (const rule of activeRules) {
    const origin = observedActions.find((action) => ruleGoverns(rule, action));
    if (origin === undefined) continue; // no observed action for this rule yet -> "missing" in the table
    const before = isAutonomous(decide(origin, withoutRule(activeRules, rule), { mode: "intercept" }));
    const after = isAutonomous(decide(origin, activeRules, { mode: "intercept" }));
    results.push(gradeResult(rule, 1, before), gradeResult(rule, 2, after));
  }
  return ruleHealthTable(activeRules, results);
}

function ruleGoverns(rule: ActionPolicyRule, action: InterceptedAction): boolean {
  // Reuse the policy engine's real scope matching instead of reimplementing it:
  // the rule governs the action iff decide selects this rule for it.
  return decide(action, [rule], { mode: "intercept" }).sourceRuleId === rule.id;
}

function isAutonomous(decision: PolicyDecision): boolean {
  // The class is governed autonomously when policy returns a definitive verdict
  // without escalating to the operator ("ask").
  return decision.verdict !== "ask";
}

function withoutRule(
  rules: readonly ActionPolicyRule[],
  target: ActionPolicyRule,
): ActionPolicyRule[] {
  return rules.filter((rule) => rule.id !== target.id);
}

function gradeResult(rule: ActionPolicyRule, passNumber: 1 | 2, autonomous: boolean): EvalResult {
  return {
    id: `${rule.id}::eval::p${passNumber}`,
    dealId: RULE_HEALTH_DEAL,
    evalCaseId: rule.evalCaseId,
    passNumber,
    criterion: `Policy ${rule.id} autonomously governs ${rule.scope.tool} ${rule.scope.action}`,
    result: autonomous ? "pass" : "fail",
  };
}
