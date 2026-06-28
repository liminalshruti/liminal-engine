/**
 * Shared UI components for the demo spine. UI calls the governance (application)
 * layer + contracts — never engine-core domain internals or live adapters
 * (enforced by .dependency-cruiser.cjs `ui-calls-application`).
 *
 * The concrete UI stack (Solid to match liminal-desktop, React, etc.) is chosen
 * when apps/desktop-demo is built — see CLAUDE.md "static clickable demo first".
 * View-model helpers that don't depend on a framework can live here now.
 */
import type {
  AgentOutput,
  DriftSignal,
  EndpointConfig,
  EvalResult,
  GovernanceCase,
  NlIntent,
  ResourceAllocation,
  RoutingRule,
} from "@liminal-engine/contracts";

/** Framework-agnostic view model for the false-green banner. */
export function falseGreenBanner(output: AgentOutput): { label: string; tone: "green" | "warn" } {
  const dropped = output.droppedRequirements.length;
  return dropped > 0 && output.reportedStatus === "on-track"
    ? { label: `Reported on-track — ${dropped} requirement(s) silently dropped`, tone: "warn" }
    : { label: `Status: ${output.reportedStatus}`, tone: "green" };
}

export function caseHeadline(c: GovernanceCase): string {
  return `Dropped requirement: ${c.missedRequirement} (${c.severity})`;
}

export type Tone = "green" | "warn" | "danger" | "neutral";

export interface BadgeViewModel {
  label: string;
  tone: Tone;
  title?: string;
}

export interface KeyValueViewModel {
  label: string;
  value: string;
}

export interface DriftSignalViewModel {
  id: string;
  headline: string;
  badge: BadgeViewModel;
  scoreLabel: string;
  evidenceCount: number;
  shouldEscalate: boolean;
}

export interface EndpointViewModel {
  id: string;
  label: string;
  badge: BadgeViewModel;
  detail: string;
}

export interface IntentViewModel {
  id: string;
  label: string;
  badge: BadgeViewModel;
  entities: KeyValueViewModel[];
}

export interface ResourceAllocationViewModel {
  id: string;
  label: string;
  badge: BadgeViewModel;
  detail: string;
}

export interface RoutingRuleViewModel {
  id: string;
  label: string;
  badge: BadgeViewModel;
  targets: string[];
}

export interface EvalSummaryViewModel {
  label: string;
  badge: BadgeViewModel;
  passCount: number;
  failCount: number;
}

export function driftSignalView(signal: DriftSignal): DriftSignalViewModel {
  return {
    id: signal.id,
    headline: `${humanize(signal.signalKind)}: ${signal.summary}`,
    badge: {
      label: signal.severity.toUpperCase(),
      tone: severityTone(signal.severity),
      title: `score ${(signal.score * 100).toFixed(0)}%`,
    },
    scoreLabel: `${(signal.score * 100).toFixed(0)}%`,
    evidenceCount: signal.evidenceIds.length,
    shouldEscalate: signal.status === "open" && signal.score >= 0.8 && (
      signal.severity === "critical" || signal.severity === "high"
    ),
  };
}

export function endpointConfigView(endpoint: EndpointConfig): EndpointViewModel {
  return {
    id: endpoint.id,
    label: `${humanize(endpoint.provider)} endpoint`,
    badge: {
      label: endpoint.enabled ? "Enabled" : "Disabled",
      tone: endpoint.enabled ? "green" : "neutral",
    },
    detail: [endpoint.model, endpoint.endpointUrl, endpoint.auth.scheme]
      .filter((part): part is string => part !== undefined)
      .join(" · "),
  };
}

export function intentView(intent: NlIntent): IntentViewModel {
  return {
    id: intent.id,
    label: `${humanize(intent.intentType)} from ${intent.actorRole}`,
    badge: {
      label: `${(intent.confidence * 100).toFixed(0)}%`,
      tone: intent.confidence >= 0.8 ? "green" : intent.confidence >= 0.5 ? "warn" : "danger",
    },
    entities: intent.entities.map((entity) => ({
      label: entity.name,
      value: entity.value,
    })),
  };
}

export function resourceAllocationView(allocation: ResourceAllocation): ResourceAllocationViewModel {
  return {
    id: allocation.id,
    label: `${allocation.ownerRole} ${humanize(allocation.resourceType)}`,
    badge: {
      label: humanize(allocation.status),
      tone: allocation.status === "blocked"
        ? "danger"
        : allocation.status === "released"
          ? "neutral"
          : allocation.status === "requested"
            ? "warn"
            : "green",
    },
    detail: allocation.reason,
  };
}

export function routingRuleView(rule: RoutingRule, endpoints: readonly EndpointConfig[]): RoutingRuleViewModel {
  const endpointNames = new Map(endpoints.map((endpoint) => [endpoint.id, endpoint.provider]));
  return {
    id: rule.id,
    label: rule.name,
    badge: {
      label: rule.enabled ? humanize(rule.disposition) : "Disabled",
      tone: rule.enabled ? (rule.disposition === "deny" ? "danger" : "green") : "neutral",
    },
    targets: rule.endpointConfigIds.map((id) => `${id} (${endpointNames.get(id) ?? "missing"})`),
  };
}

export function evalSummaryView(results: readonly EvalResult[]): EvalSummaryViewModel {
  const passCount = results.filter((result) => result.result === "pass").length;
  const failCount = results.filter((result) => result.result === "fail").length;
  const improved = hasFailToPass(results);

  return {
    label: improved
      ? "Fail -> Pass improvement"
      : failCount > 0
        ? "Failing evals remain"
        : "All evals passing",
    badge: {
      label: improved ? "Improved" : failCount > 0 ? "Failing" : "Passing",
      tone: improved || failCount === 0 ? "green" : "danger",
    },
    passCount,
    failCount,
  };
}

function severityTone(severity: DriftSignal["severity"]): Tone {
  if (severity === "critical" || severity === "high") return "danger";
  if (severity === "medium") return "warn";
  return "neutral";
}

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function hasFailToPass(results: readonly EvalResult[]): boolean {
  const byCriterion = new Map<string, EvalResult[]>();
  for (const result of results) {
    byCriterion.set(result.criterion, [...(byCriterion.get(result.criterion) ?? []), result]);
  }
  return [...byCriterion.values()].some((criterionResults) => {
    const sorted = [...criterionResults].sort((a, b) => a.passNumber - b.passNumber);
    return sorted[0]?.result === "fail" && sorted[sorted.length - 1]?.result === "pass";
  });
}
