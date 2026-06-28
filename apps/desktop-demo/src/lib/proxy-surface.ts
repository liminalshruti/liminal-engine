/**
 * Proxy surface — the inference plane ("Burp for LLM traffic", GOAL §16) expressed
 * on the canonical contracts. Captures each outbound Claude request (validated as a
 * real `LlmRequest`), runs it through model-routing policy + company-mission
 * alignment, and forwards / transforms (downgrades the model) / holds / denies.
 * The self-learning loop proposes new model-routing policies from observed traffic;
 * the operator ratifies — nothing auto-activates. Verdicts seal into the shared
 * tamper-evident AuditLedger.
 *
 * Defers to Shruti's UI: this is the one surface her operating Workspace does not
 * cover. Pure domain — no React, no I/O (the live proposer is the only async seam
 * and always falls back to the deterministic proposer).
 */
import {
  canonicalHash,
  llmRequestContract,
  type AuditEvent,
  type LlmRequest,
} from "@liminal-engine/contracts";
import {
  AuditLedger,
  verifyChain,
  type ChainVerification,
  type SealedAuditEvent,
} from "@liminal-engine/governance";

export type ModelTier = "haiku" | "sonnet" | "opus";

export interface ModelInfo {
  id: string;
  label: string;
  tier: ModelTier;
  /** Illustrative relative cost (not real pricing) — drives overuse detection + savings copy. */
  relativeCost: number;
}

export const MODELS: Record<ModelTier, ModelInfo> = {
  haiku: { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", tier: "haiku", relativeCost: 1 },
  sonnet: { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", tier: "sonnet", relativeCost: 5 },
  opus: { id: "claude-opus-4-8", label: "Claude Opus 4.8", tier: "opus", relativeCost: 25 },
};

export const TIER_ORDER: readonly ModelTier[] = ["haiku", "sonnet", "opus"];

export type ProxyVerdict = "allow" | "transform" | "deny" | "ask";

export interface CompanyMission {
  statement: string;
  objectives: string[];
}

export const DEFAULT_MISSION: CompanyMission = {
  statement: "Ship secure enterprise infrastructure — SSO, billing, reliability — and the tooling that supports it.",
  objectives: ["Enterprise SSO", "Billing", "Reliability", "Calendar & scheduling", "Developer docs"],
};

export interface ProxyRequestDraft {
  id: string;
  engineer: string;
  sessionId: string;
  workstream: string;
  model: ModelTier;
  intent: string;
  estTokens: number;
  requestedAt: string;
}

export interface ModelPolicy {
  id: string;
  workstream: string;
  allowedTiers: ModelTier[];
  rationale: string;
  status: "active" | "proposed" | "retired";
  source: "operator" | "ai-proposed";
  createdAt: string;
}

export interface PolicyProposal {
  kind: "model-routing" | "mission-alignment";
  policy: ModelPolicy;
  rationale: string;
  evidenceRequestIds: string[];
  savingsPct: number | null;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; message: string };

export interface ProxyEvaluation {
  draft: ProxyRequestDraft;
  request: LlmRequest;
  requestHash: string;
  verdict: ProxyVerdict;
  requestedModel: ModelTier;
  effectiveModel: ModelTier;
  matchedPolicy: ModelPolicy | null;
  missionAligned: boolean;
  reasons: string[];
  transformNote: string | null;
  verdictHash: string;
  auditInput: Omit<AuditEvent, "prevHash">;
}

const T0 = "2026-06-28T17:00:00.000Z";

export const DEFAULT_MODEL_POLICIES: ModelPolicy[] = [
  { id: "mp_calendar_haiku", workstream: "Calendar & scheduling", allowedTiers: ["haiku"], rationale: "Scheduling and meeting logistics are low-complexity; Haiku is sufficient at a fraction of the cost.", status: "active", source: "operator", createdAt: T0 },
  { id: "mp_sso_opus", workstream: "Enterprise SSO", allowedTiers: ["haiku", "sonnet", "opus"], rationale: "Security-critical authentication work may use the most capable model available.", status: "active", source: "operator", createdAt: T0 },
  { id: "mp_billing_sonnet", workstream: "Billing", allowedTiers: ["haiku", "sonnet"], rationale: "Financial reconciliation needs Sonnet-level reasoning, but Opus is not warranted.", status: "active", source: "operator", createdAt: T0 },
];

export const DEFAULT_PROXY_REQUESTS: ProxyRequestDraft[] = [
  { id: "req_cal_opus", engineer: "ravi@acme.co", sessionId: "sess-ravi-1", workstream: "Calendar & scheduling", model: "opus", intent: "Draft three meeting-time options for the staff sync and format the invite.", estTokens: 1800, requestedAt: T0 },
  { id: "req_sso_opus", engineer: "mei@acme.co", sessionId: "sess-mei-1", workstream: "Enterprise SSO", model: "opus", intent: "Implement and test SAML assertion validation for the Okta integration.", estTokens: 9400, requestedAt: "2026-06-28T17:02:00.000Z" },
  { id: "req_crypto_sonnet", engineer: "dan@acme.co", sessionId: "sess-dan-1", workstream: "Crypto trading bot", model: "sonnet", intent: "Backtest a momentum strategy on BTC/USD over the last two years.", estTokens: 6200, requestedAt: "2026-06-28T17:04:00.000Z" },
  { id: "req_billing_opus", engineer: "mei@acme.co", sessionId: "sess-mei-2", workstream: "Billing", model: "opus", intent: "Reconcile this month's Stripe invoices against the internal ledger.", estTokens: 5100, requestedAt: "2026-06-28T17:06:00.000Z" },
  { id: "req_rel_haiku", engineer: "ravi@acme.co", sessionId: "sess-ravi-2", workstream: "Reliability", model: "haiku", intent: "Summarize the on-call incident timeline from the pager logs.", estTokens: 2200, requestedAt: "2026-06-28T17:08:00.000Z" },
  { id: "req_docs_opus_1", engineer: "lee@acme.co", sessionId: "sess-lee-1", workstream: "Developer docs", model: "opus", intent: "Format the v0.4 changelog from the raw commit list.", estTokens: 1500, requestedAt: "2026-06-28T17:10:00.000Z" },
  { id: "req_docs_opus_2", engineer: "lee@acme.co", sessionId: "sess-lee-2", workstream: "Developer docs", model: "opus", intent: "Rewrite the README intro paragraph to be clearer.", estTokens: 1300, requestedAt: "2026-06-28T17:12:00.000Z" },
];

export function emptyProxyRequest(index: number, nowIso: string): ProxyRequestDraft {
  return { id: `req_operator_${index}`, engineer: "engineer@acme.co", sessionId: `sess-${index}`, workstream: "Developer docs", model: "opus", intent: "Describe the engineer's task for this Claude call.", estTokens: 2000, requestedAt: nowIso };
}

/** Build the captured call as a real LlmRequest (Shruti's contract) so it round-trips + seals. */
export function toLlmRequest(draft: ProxyRequestDraft, missionAligned: boolean): LlmRequest {
  return llmRequestContract.parse({
    id: draft.id,
    endpointConfigId: "endpoint_anthropic_messages",
    provider: "anthropic",
    model: MODELS[draft.model].id,
    messages: [{ role: "user", content: draft.intent.trim() || "(no prompt captured)" }],
    responseFormat: "text",
    maxOutputTokens: Math.max(1, Math.round(draft.estTokens)),
    metadata: { workstream: draft.workstream, tier: draft.model, engineer: draft.engineer, sessionId: draft.sessionId, missionAligned },
    requestedAt: draft.requestedAt,
  });
}

export function parseProxyRequest(draft: ProxyRequestDraft): ParseResult<ProxyRequestDraft> {
  if (!draft.id.trim()) return { ok: false, message: "id is required" };
  if (!draft.workstream.trim()) return { ok: false, message: "workstream is required" };
  if (!isModelTier(draft.model)) return { ok: false, message: `model must be one of ${TIER_ORDER.join(", ")}` };
  if (!Number.isFinite(draft.estTokens) || draft.estTokens < 0) return { ok: false, message: "estTokens must be a non-negative number" };
  if (!draft.requestedAt.trim()) return { ok: false, message: "requestedAt is required" };
  return { ok: true, value: { ...draft, id: draft.id.trim(), workstream: draft.workstream.trim(), intent: draft.intent.trim() } };
}

export function isMissionAligned(draft: ProxyRequestDraft, mission: CompanyMission): boolean {
  const ws = normalize(draft.workstream);
  return mission.objectives.some((objective) => {
    const obj = normalize(objective);
    return ws.includes(obj) || obj.includes(ws);
  });
}

export function matchPolicy(draft: ProxyRequestDraft, policies: readonly ModelPolicy[]): ModelPolicy | null {
  const active = policies.filter((policy) => policy.status === "active" && workstreamMatches(draft.workstream, policy.workstream));
  if (active.length === 0) return null;
  return [...active].sort((a, b) => specificity(b.workstream) - specificity(a.workstream))[0]!;
}

export function evaluateProxy(draft: ProxyRequestDraft, policies: readonly ModelPolicy[], mission: CompanyMission): ProxyEvaluation {
  const missionAligned = isMissionAligned(draft, mission);
  const request = toLlmRequest(draft, missionAligned);
  const requestHash = canonicalHash(llmRequestContract.canonical(request));
  const matchedPolicy = matchPolicy(draft, policies);

  let verdict: ProxyVerdict = "allow";
  let effectiveModel: ModelTier = draft.model;
  let transformNote: string | null = null;
  const reasons: string[] = [];

  if (matchedPolicy) {
    if (matchedPolicy.allowedTiers.includes(draft.model)) {
      verdict = "allow";
    } else {
      const downgrade = mostCapableAllowed(matchedPolicy.allowedTiers);
      if (downgrade) {
        verdict = "transform";
        effectiveModel = downgrade;
        transformNote = `Downgraded ${MODELS[draft.model].label} → ${MODELS[downgrade].label}`;
        reasons.push(`"${draft.workstream}" is restricted to ${matchedPolicy.allowedTiers.map((tier) => MODELS[tier].label).join(", ")} by policy ${matchedPolicy.id}.`);
      } else {
        verdict = "deny";
        reasons.push(`Policy ${matchedPolicy.id} allows no model for "${draft.workstream}".`);
      }
    }
  }

  if (!missionAligned) {
    verdict = "deny";
    effectiveModel = draft.model;
    transformNote = null;
    reasons.unshift(`Off-mission: "${draft.workstream}" is not part of the company objectives (${mission.objectives.join(", ")}).`);
  }

  const verdictHash = canonicalHash({ request: llmRequestContract.canonical(request), verdict, effectiveModel, matchedPolicyId: matchedPolicy?.id ?? null, missionAligned });
  const auditInput = buildAuditInput({ draft, requestHash, verdict, effectiveModel, matchedPolicy, missionAligned, reasons, verdictHash });
  return { draft, request, requestHash, verdict, requestedModel: draft.model, effectiveModel, matchedPolicy, missionAligned, reasons, transformNote, verdictHash, auditInput };
}

export function recordProxy(existingEvents: readonly SealedAuditEvent[], evaluation: ProxyEvaluation): { event: SealedAuditEvent; events: SealedAuditEvent[]; verification: ChainVerification } {
  const ledger = AuditLedger.fromEvents(existingEvents);
  const event = ledger.append(evaluation.auditInput);
  const events = ledger.events();
  return { event, events, verification: verifyChain(events) };
}

export function proposePolicies(drafts: readonly ProxyRequestDraft[], policies: readonly ModelPolicy[], mission: CompanyMission, nowIso: string): PolicyProposal[] {
  const proposals: PolicyProposal[] = [];
  const groups = groupByWorkstream(drafts);

  for (const [workstream, group] of groups) {
    const sample = group[0]!;
    const governed = matchPolicy(sample, policies) !== null;
    const aligned = isMissionAligned(sample, mission);

    if (!aligned) {
      proposals.push({
        kind: "mission-alignment",
        policy: { id: `mp_mission_${slug(workstream)}`, workstream, allowedTiers: [], rationale: `Hold "${workstream}" for review — it falls outside the company objectives.`, status: "proposed", source: "ai-proposed", createdAt: nowIso },
        rationale: `${group.length} request${group.length === 1 ? "" : "s"} on "${workstream}" are off-mission. Propose holding this workstream for operator review before any model runs.`,
        evidenceRequestIds: group.map((draft) => draft.id),
        savingsPct: null,
      });
      continue;
    }

    if (governed) continue;

    const maxTier = highestTier(group.map((draft) => draft.model));
    const lowComplexity = group.every((draft) => isLowComplexity(draft.intent));
    if (lowComplexity && maxTier !== "haiku") {
      proposals.push({
        kind: "model-routing",
        policy: { id: `mp_${slug(workstream)}_haiku`, workstream, allowedTiers: ["haiku"], rationale: `Low-complexity ${workstream.toLowerCase()} work is well within Haiku's range.`, status: "proposed", source: "ai-proposed", createdAt: nowIso },
        rationale: `Observed ${group.length} ${MODELS[maxTier].label} call${group.length === 1 ? "" : "s"} on "${workstream}" for low-complexity work (${group.map((d) => firstClause(d.intent)).join("; ")}). Restrict to Haiku — same outcome, far cheaper.`,
        evidenceRequestIds: group.map((draft) => draft.id),
        savingsPct: savingsPct(group, "haiku"),
      });
    }
  }

  return proposals;
}

export async function proposePoliciesLive(
  drafts: readonly ProxyRequestDraft[],
  policies: readonly ModelPolicy[],
  mission: CompanyMission,
  nowIso: string,
  deps: { fetch: typeof fetch; proxyUrl: string } = { fetch, proxyUrl: "http://localhost:8787" },
): Promise<{ proposals: PolicyProposal[]; source: "live" | "local" }> {
  try {
    const response = await deps.fetch(`${deps.proxyUrl}/propose`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requests: drafts, policies, mission }),
    });
    if (response.ok) {
      const body = (await response.json()) as { proposals?: PolicyProposal[] };
      if (Array.isArray(body.proposals) && body.proposals.length > 0) return { proposals: body.proposals, source: "live" };
    }
  } catch {
    // proxy offline or no /propose route — fall through to deterministic
  }
  return { proposals: proposePolicies(drafts, policies, mission, nowIso), source: "local" };
}

export function ratifyProposal(proposal: PolicyProposal): ModelPolicy {
  return { ...proposal.policy, status: "active" };
}

export function formatRequest(draft: ProxyRequestDraft): string {
  return `${draft.workstream} · ${MODELS[draft.model].label}`;
}

// ── internals ────────────────────────────────────────────────────────────────

function buildAuditInput(args: { draft: ProxyRequestDraft; requestHash: string; verdict: ProxyVerdict; effectiveModel: ModelTier; matchedPolicy: ModelPolicy | null; missionAligned: boolean; reasons: readonly string[]; verdictHash: string }): Omit<AuditEvent, "prevHash"> {
  const allowed = args.verdict === "allow" || args.verdict === "transform";
  return {
    id: `ae_proxy_${args.draft.id}`,
    caseId: args.matchedPolicy?.id ?? (args.missionAligned ? "policy-clear" : "mission-review"),
    dealId: args.draft.workstream,
    action: "inference.gated",
    decidingActor: "Inference policy engine",
    previousStatus: "on-track",
    newStatus: allowed ? "on-track" : "at-risk",
    recordedAt: args.draft.requestedAt,
    beforeState: { requestHash: args.requestHash, requestedModel: MODELS[args.draft.model].id, workstream: args.draft.workstream, engineer: args.draft.engineer },
    afterState: { verdict: args.verdict, allowed, effectiveModel: MODELS[args.effectiveModel].id, matchedPolicyId: args.matchedPolicy?.id ?? null, missionAligned: args.missionAligned, verdictHash: args.verdictHash, reasons: [...args.reasons] },
    evidenceIds: args.matchedPolicy ? [args.matchedPolicy.id] : [],
    actionIds: [args.draft.id],
    affectedSystems: ["anthropic", MODELS[args.effectiveModel].id],
  };
}

function workstreamMatches(requestWorkstream: string, policyWorkstream: string): boolean {
  if (policyWorkstream.trim() === "*") return true;
  const ws = normalize(requestWorkstream);
  const pol = normalize(policyWorkstream);
  return ws.includes(pol) || pol.includes(ws);
}

function specificity(workstream: string): number {
  return workstream.trim() === "*" ? 0 : normalize(workstream).length;
}

function mostCapableAllowed(tiers: readonly ModelTier[]): ModelTier | null {
  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    const tier = TIER_ORDER[i]!;
    if (tiers.includes(tier)) return tier;
  }
  return null;
}

function highestTier(tiers: readonly ModelTier[]): ModelTier {
  return tiers.reduce<ModelTier>((max, tier) => (TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(max) ? tier : max), "haiku");
}

function groupByWorkstream(drafts: readonly ProxyRequestDraft[]): Map<string, ProxyRequestDraft[]> {
  const groups = new Map<string, ProxyRequestDraft[]>();
  for (const draft of drafts) {
    const list = groups.get(draft.workstream) ?? [];
    list.push(draft);
    groups.set(draft.workstream, list);
  }
  return groups;
}

const LOW_COMPLEXITY = ["format", "summari", "draft", "rewrite", "changelog", "schedule", "rename", "lint", "boilerplate", "readme", "intro", "invite", "notes", "tidy", "cleanup"];
function isLowComplexity(intent: string): boolean {
  const text = intent.toLowerCase();
  return LOW_COMPLEXITY.some((keyword) => text.includes(keyword));
}

function savingsPct(group: readonly ProxyRequestDraft[], proposedTier: ModelTier): number {
  const current = group.reduce((sum, draft) => sum + MODELS[draft.model].relativeCost * draft.estTokens, 0);
  const proposed = group.reduce((sum, draft) => sum + MODELS[proposedTier].relativeCost * draft.estTokens, 0);
  if (current === 0) return 0;
  return Math.round((1 - proposed / current) * 100);
}

function firstClause(intent: string): string {
  const clause = intent.split(/[.,;]/)[0]!.trim();
  return clause.length > 48 ? `${clause.slice(0, 45)}…` : clause;
}

function isModelTier(value: string): value is ModelTier {
  return value === "haiku" || value === "sonnet" || value === "opus";
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function slug(value: string): string {
  return normalize(value).replace(/\s+/g, "-");
}
