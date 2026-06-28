import type { PolicyDecision } from "./policy-engine.ts";

export interface EscalationSample {
  index: number;
  totalConsequentialActions: number;
  operatorEscalations: number;
  escalationRate: number;
}

export function escalationSeries(decisions: readonly PolicyDecision[]): EscalationSample[] {
  let asks = 0;
  return decisions.map((decision, index) => {
    if (decision.verdict === "ask") asks += 1;
    const total = index + 1;
    return {
      index,
      totalConsequentialActions: total,
      operatorEscalations: asks,
      escalationRate: asks / total,
    };
  });
}

export function finalEscalationRate(decisions: readonly PolicyDecision[]): number {
  if (decisions.length === 0) return 0;
  const series = escalationSeries(decisions);
  return series[series.length - 1]!.escalationRate;
}

export function isMonotonicNonIncreasing(samples: readonly EscalationSample[]): boolean {
  for (let i = 1; i < samples.length; i++) {
    if (samples[i]!.escalationRate > samples[i - 1]!.escalationRate) return false;
  }
  return true;
}

export function countSafetyRegressions(
  decisions: readonly PolicyDecision[],
  expected: readonly Exclude<PolicyDecision["verdict"], "ask">[],
): number {
  let regressions = 0;
  const len = Math.min(decisions.length, expected.length);
  for (let i = 0; i < len; i++) {
    if (expected[i] === "deny" && decisions[i]!.verdict === "allow") regressions += 1;
  }
  return regressions;
}
