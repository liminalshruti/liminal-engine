import {
  driftSignalContract,
  endpointConfigContract,
  resourceAllocationContract,
  routingRuleContract,
  transformRuleContract,
  type AgentOutput,
  type DriftSignal,
  type EndpointConfig,
  type JsonObject,
  type JsonValue,
  type NlIntent,
  type Requirement,
  type ResourceAllocation,
  type RoutingDisposition,
  type RoutingRule,
  type TransformRule,
} from "@liminal-engine/contracts";

const STOP_WORDS = new Set([
  "a",
  "all",
  "an",
  "and",
  "are",
  "as",
  "be",
  "before",
  "for",
  "in",
  "into",
  "is",
  "must",
  "of",
  "on",
  "or",
  "shall",
  "the",
  "to",
  "with",
]);

export interface RequirementDriftInput {
  agentOutput: AgentOutput;
  requirements: readonly Requirement[];
  observedAt: string;
  detectorVersion?: string;
}

export interface RouteDecision {
  ruleId: string;
  endpointConfigId: string;
  disposition: RoutingDisposition;
  rationale: string;
  signalId?: string;
  intentId?: string;
}

export interface RouteInput {
  signals?: readonly DriftSignal[];
  intents?: readonly NlIntent[];
  rules: readonly RoutingRule[];
  endpoints: readonly EndpointConfig[];
}

export interface TransformResult {
  ruleId: string;
  changed: boolean;
  output: JsonObject;
  errors: string[];
}

export interface ResourceAllocationInput {
  signals: readonly DriftSignal[];
  ownerRoles: readonly string[];
  allocatedAt: string;
}

export interface SignalHarnessResult {
  signals: DriftSignal[];
  routes: RouteDecision[];
  allocations: ResourceAllocation[];
}

export interface SignalHarnessProcessInput extends RequirementDriftInput {
  intents?: readonly NlIntent[];
  rules: readonly RoutingRule[];
  endpoints: readonly EndpointConfig[];
  ownerRoles: readonly string[];
  allocatedAt: string;
}

export class SignalHarness {
  process(input: SignalHarnessProcessInput): SignalHarnessResult {
    const signals = detectRequirementDrift(input);
    return {
      signals,
      routes: routeSignalsAndIntents({ ...input, signals }),
      allocations: allocateResourcesForSignals({ ...input, signals }),
    };
  }
}

export function detectRequirementDrift(input: RequirementDriftInput): DriftSignal[] {
  const detectorVersion = input.detectorVersion ?? "signal-harness.requirement-coverage.v1";
  const outputText = [
    input.agentOutput.summary,
    ...input.agentOutput.droppedRequirements,
  ].join(" ");
  const outputTokens = tokenize(outputText);
  const signals: DriftSignal[] = [];

  for (const requirement of input.requirements) {
    if (requirement.status !== "active" || requirement.severity === "info") continue;

    const requirementTokens = tokenize(requirement.text);
    const explicitDrop = input.agentOutput.droppedRequirements.some((dropped) =>
      tokenOverlap(tokenize(dropped), requirementTokens) >= 0.5,
    );
    const coverage = tokenOverlap(requirementTokens, outputTokens);
    const missing = explicitDrop || coverage < 0.35;
    if (!missing) continue;

    const score = explicitDrop ? 0.98 : roundScore(1 - coverage);
    const severity = requirement.severity === "hard"
      ? score >= 0.8 ? "critical" : "high"
      : score >= 0.8 ? "high" : "medium";

    signals.push(driftSignalContract.parse({
      id: `ds_${input.agentOutput.id}_${requirement.id}`,
      sourceType: "agent_output",
      sourceId: input.agentOutput.id,
      dealId: input.agentOutput.dealId,
      signalKind: "requirement_dropped",
      severity,
      score,
      summary: explicitDrop
        ? `Agent output explicitly dropped requirement: ${requirement.text}`
        : `Agent output does not substantively cover requirement: ${requirement.text}`,
      evidenceIds: requirement.evidenceRefs,
      observedAt: input.observedAt,
      detectorVersion,
      status: "open",
      linkedRequirementId: requirement.id,
    }));
  }

  return signals.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

export function routeSignalsAndIntents(input: RouteInput): RouteDecision[] {
  const endpoints = new Map(
    input.endpoints
      .map((endpoint) => endpointConfigContract.parse(endpoint))
      .filter((endpoint) => endpoint.enabled)
      .map((endpoint) => [endpoint.id, endpoint]),
  );
  const rules = [...input.rules]
    .map((rule) => routingRuleContract.parse(rule))
    .filter((rule) => rule.enabled)
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));

  const decisions: RouteDecision[] = [];

  for (const signal of input.signals ?? []) {
    for (const rule of rules) {
      if (!rule.signalKinds.includes(signal.signalKind)) continue;
      for (const endpointConfigId of targetEndpointIds(rule, endpoints)) {
        decisions.push({
          ruleId: rule.id,
          endpointConfigId,
          disposition: rule.disposition,
          rationale: rule.rationale,
          signalId: signal.id,
        });
      }
    }
  }

  for (const intent of input.intents ?? []) {
    for (const rule of rules) {
      if (!rule.intentTypes.includes(intent.intentType)) continue;
      for (const endpointConfigId of targetEndpointIds(rule, endpoints)) {
        decisions.push({
          ruleId: rule.id,
          endpointConfigId,
          disposition: rule.disposition,
          rationale: rule.rationale,
          intentId: intent.id,
        });
      }
    }
  }

  return decisions;
}

export function applyTransformRules(input: JsonObject, rules: readonly TransformRule[]): TransformResult[] {
  let current = cloneJsonObject(input);
  const results: TransformResult[] = [];

  for (const rawRule of [...rules].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))) {
    const rule = transformRuleContract.parse(rawRule);
    if (!rule.enabled) {
      results.push({ ruleId: rule.id, changed: false, output: cloneJsonObject(current), errors: [] });
      continue;
    }
    const result = applyTransformRule(current, rule);
    current = cloneJsonObject(result.output);
    results.push(result);
  }

  return results;
}

export function applyTransformRule(input: JsonObject, rule: TransformRule): TransformResult {
  const output = cloneJsonObject(input);
  const errors: string[] = [];
  const source = getPath(output, rule.fieldPath);
  let changed = false;

  try {
    if (rule.operation === "map") {
      if (rule.targetField === undefined) throw new Error("map rule missing targetField");
      setPath(output, rule.targetField, source ?? null);
      changed = true;
    } else if (rule.operation === "redact") {
      const replacement = rule.replacement ?? "";
      if (typeof source === "string") {
        const next = rule.pattern === undefined
          ? replacement
          : source.replace(new RegExp(rule.pattern, "g"), replacement);
        setPath(output, rule.fieldPath, next);
        changed = next !== source;
      }
    } else if (rule.operation === "normalize") {
      if (typeof source === "string") {
        const next = source.trim().replace(/\s+/g, " ").toLowerCase();
        setPath(output, rule.targetField ?? rule.fieldPath, next);
        changed = next !== source || rule.targetField !== undefined;
      }
    } else if (rule.operation === "extract") {
      if (rule.targetField === undefined) throw new Error("extract rule missing targetField");
      if (typeof source === "string" && rule.pattern !== undefined) {
        const match = new RegExp(rule.pattern).exec(source);
        setPath(output, rule.targetField, match?.[1] ?? match?.[0] ?? null);
        changed = true;
      }
    } else if (rule.operation === "classify") {
      if (rule.targetField === undefined) throw new Error("classify rule missing targetField");
      const text = typeof source === "string" ? source.toLowerCase() : "";
      const label = (rule.labels ?? []).find((candidate) => text.includes(candidate.toLowerCase())) ?? "unclassified";
      setPath(output, rule.targetField, label);
      changed = true;
    } else if (rule.operation === "score") {
      if (rule.targetField === undefined) throw new Error("score rule missing targetField");
      const text = typeof source === "string" ? source : "";
      const labels = rule.labels ?? [];
      const hits = labels.filter((candidate) => text.toLowerCase().includes(candidate.toLowerCase())).length;
      const score = labels.length === 0 ? 0 : hits / labels.length;
      setPath(output, rule.targetField, score);
      changed = true;
    } else if (rule.operation === "template") {
      if (rule.targetField === undefined) throw new Error("template rule missing targetField");
      const template = rule.replacement ?? "";
      setPath(output, rule.targetField, template.replace(/\{\{value\}\}/g, String(source ?? "")));
      changed = true;
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return { ruleId: rule.id, changed, output, errors };
}

export function allocateResourcesForSignals(input: ResourceAllocationInput): ResourceAllocation[] {
  const actionableSignals = input.signals.filter((signal) =>
    signal.status === "open" && ["critical", "high"].includes(signal.severity),
  );
  const allocations: ResourceAllocation[] = [];

  for (const signal of actionableSignals) {
    for (const ownerRole of input.ownerRoles) {
      allocations.push(resourceAllocationContract.parse({
        id: `ra_${signal.id}_${slug(ownerRole)}`,
        workItemId: signal.linkedCaseId ?? signal.id,
        resourceType: "role",
        ownerRole,
        status: "allocated",
        reason: `${ownerRole} ownership required for ${signal.signalKind}: ${signal.summary}`,
        constraints: [signal.signalKind],
        evidenceIds: [signal.id, ...signal.evidenceIds],
        allocatedAt: input.allocatedAt,
      }));
    }
  }

  return allocations;
}

function targetEndpointIds(
  rule: RoutingRule,
  endpoints: ReadonlyMap<string, EndpointConfig>,
): string[] {
  return rule.endpointConfigIds.filter((id) => endpoints.has(id));
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  );
}

function tokenOverlap(needle: ReadonlySet<string>, haystack: ReadonlySet<string>): number {
  if (needle.size === 0) return 1;
  let hits = 0;
  for (const token of needle) {
    if (haystack.has(token)) hits += 1;
  }
  return hits / needle.size;
}

function roundScore(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function cloneJsonObject(input: JsonObject): JsonObject {
  return JSON.parse(JSON.stringify(input)) as JsonObject;
}

function getPath(input: JsonObject, path: readonly string[]): JsonValue | undefined {
  let current: JsonValue | undefined = input;
  for (const segment of path) {
    if (!isJsonObject(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function setPath(input: JsonObject, path: readonly string[], value: JsonValue): void {
  let current: JsonObject = input;
  for (const segment of path.slice(0, -1)) {
    const next = current[segment];
    if (!isJsonObject(next)) {
      current[segment] = {};
      current = current[segment] as JsonObject;
    } else {
      current = next;
    }
  }
  const leaf = path[path.length - 1];
  if (leaf !== undefined) current[leaf] = value;
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
