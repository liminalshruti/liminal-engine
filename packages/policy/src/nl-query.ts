/**
 * nl-query — answer an operator's natural-language QUERY grounded in the audit
 * ledger, the policy store, and a spend meter DERIVED from the ledger (LIM-1345).
 *
 * The operator types a question; an upstream LLM has already turned it into a
 * `ParsedIntent` of kind "query" (operator-nl.contract). This module then resolves
 * the answer DETERMINISTICALLY from real recorded facts and returns an
 * `AssistantReply` whose `summary` is plain English and whose `citations` are the
 * exact audit-event / policy-rule ids the answer rests on.
 *
 * Why there is NO LLM in this path: numbers and facts come from the ledger / policy
 * store / spend meter, never from a model. The resolution is a pure function of its
 * inputs, so it is golden-testable and cannot hallucinate a number or a rule id —
 * every factual claim is backed by a citation, and an unanswerable question gets an
 * honest "no data" with no fabricated facts. (The LLM only proposes the intent
 * upstream; it never touches the answer's data.)
 *
 * Boundary: imports @liminal-engine/contracts only (shared kernel) + this package's
 * own ports. It does NOT import the governance `AuditLedger` — it reads the ledger
 * through `LedgerReader` (a port), keeping policy a pure bounded context
 * (.dependency-cruiser.cjs `policy-is-domain`). The audit-event shape it reads
 * (`afterState.policyVerdict`, `beforeState.interceptedAction`) is exactly what
 * `governance/policy-audit.ts` writes; spend is metered from `ResourceAllocation`
 * snapshots recorded in `afterState.resourceAllocation` (the same afterState-snapshot
 * pattern `governance/audit-reconstruction.ts` consumes).
 */
import {
  assistantReplyContract,
  resourceAllocationContract,
  type AssistantReply,
  type AuditEvent,
  type ActionPolicyRule,
  type ParsedIntent,
} from "@liminal-engine/contracts";
import type { LedgerReader, PolicyStore } from "./ports.ts";

/** The "query" member of the ParsedIntent discriminated union. */
export type QueryIntent = Extract<ParsedIntent, { kind: "query" }>;

/**
 * The grounding facts a query is resolved against, plus the reply identity. The
 * facts (`auditEvents`, `policyRules`) are contract types pulled from the ledger /
 * policy store; the identity (`replyId`, `messageId`, `now`) is injected by the
 * caller (idgen/clock) so this stays a pure, deterministic, golden-testable
 * function — no clock or RNG read here.
 */
export interface NlQueryContext {
  /** the audit ledger's events — the grounding source. */
  readonly auditEvents: readonly AuditEvent[];
  /** the policy store's rules (active + historical) — for rule-reason lookups. */
  readonly policyRules: readonly ActionPolicyRule[];
  /** id for the produced reply (from upstream idgen). */
  readonly replyId: string;
  /** the operator message this reply answers. */
  readonly messageId: string;
  /** ISO datetime for the reply `at` + "today" windowing (from upstream clock). */
  readonly now: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Answer a query intent against the supplied facts. Pure + deterministic: the same
 * intent + context always yields a byte-identical reply. The returned reply is
 * validated through `assistantReplyContract` so callers always get a contract-valid
 * AssistantReply. Citations are real audit-event / rule ids; an unanswerable
 * question yields an honest "no data" reply with NO citations and no invented facts.
 */
export function answerQuery(intent: QueryIntent, ctx: NlQueryContext): AssistantReply {
  const resolution = resolve(intent.args.question, ctx);
  const reply: AssistantReply = {
    id: ctx.replyId,
    messageId: ctx.messageId,
    summary: resolution.summary,
    intent,
    ...(resolution.citations.length > 0 ? { citations: resolution.citations } : {}),
    at: ctx.now,
  };
  return assistantReplyContract.parse(reply);
}

/** Outbound ports the store-backed entry point reads its facts from. */
export interface AnswerQueryDeps {
  readonly ledger: LedgerReader;
  readonly store: Pick<PolicyStore, "allRules">;
  readonly replyId: string;
  readonly messageId: string;
  readonly now: string;
}

/**
 * Store-backed entry point: pull the ledger events + policy rules through their
 * ports, then resolve with the pure `answerQuery`. Mirrors policy-engine's
 * `decide` (pure) / `decideFromStore` (port-backed) split so the data path stays
 * testable while the real wiring lives behind ports.
 */
export async function answerQueryFromStores(
  intent: QueryIntent,
  deps: AnswerQueryDeps,
): Promise<AssistantReply> {
  const [auditEvents, policyRules] = await Promise.all([
    deps.ledger.events(),
    deps.store.allRules(),
  ]);
  return answerQuery(intent, {
    auditEvents,
    policyRules,
    replyId: deps.replyId,
    messageId: deps.messageId,
    now: deps.now,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Spend meter — derived from the audit ledger (no separate data source)
// ─────────────────────────────────────────────────────────────────────────────

/** A metered total for one unit, with the audit-event ids that contributed. */
export interface SpendTotal {
  readonly unit: string;
  readonly value: number;
  readonly citations: readonly string[];
}

/** The full spend reading: per-unit totals + the entries / citations behind them. */
export interface SpendReading {
  readonly totals: readonly SpendTotal[];
  /** number of ledger entries that carried a metered amount in the window. */
  readonly entryCount: number;
  /** every audit-event id that contributed, in ledger order. */
  readonly citations: readonly string[];
}

/** Resource kinds that count as fleet SPEND (consumable), vs. role/calendar/etc. */
const SPEND_RESOURCE_TYPES = new Set(["budget", "compute"]);

/**
 * Meter fleet spend from the audit ledger: sum the `amount` of every recorded
 * budget/compute `ResourceAllocation` snapshot, grouped by unit, optionally scoped
 * to a single UTC day. Pure + deterministic — totals come straight from real
 * ledger entries (never invented), and every total carries the event ids it was
 * summed from. An empty reading means no metered spend was recorded (honest zero).
 */
export function meterSpend(
  events: readonly AuditEvent[],
  window?: { readonly day?: string },
): SpendReading {
  const byUnit = new Map<string, { value: number; citations: string[] }>();
  const citations: string[] = [];
  let entryCount = 0;

  for (const event of events) {
    if (window?.day !== undefined && dayOf(event.recordedAt) !== window.day) continue;
    const amount = readSpendAmount(event);
    if (amount === null) continue;
    entryCount += 1;
    citations.push(event.id);
    const current = byUnit.get(amount.unit) ?? { value: 0, citations: [] };
    current.value += amount.value;
    current.citations.push(event.id);
    byUnit.set(amount.unit, current);
  }

  const totals = [...byUnit.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([unit, agg]) => ({ unit, value: agg.value, citations: agg.citations }));

  return { totals, entryCount, citations };
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolution
// ─────────────────────────────────────────────────────────────────────────────

interface Resolution {
  readonly summary: string;
  readonly citations: string[];
}

const SPEND_TERMS = ["spend", "spent", "spending", "cost", "budget", "burn", "how much"];
const BLOCKED_TERMS = ["block", "held", "hold", "deny", "denied", "reject", "stopped", "stop", "why"];

function resolve(question: string, ctx: NlQueryContext): Resolution {
  const norm = question.toLowerCase();
  if (SPEND_TERMS.some((term) => norm.includes(term))) return answerSpend(norm, ctx);
  if (BLOCKED_TERMS.some((term) => norm.includes(term))) return answerBlocked(norm, ctx);
  return noData();
}

function answerSpend(norm: string, ctx: NlQueryContext): Resolution {
  const today = norm.includes("today");
  const window = today ? { day: dayOf(ctx.now) } : undefined;
  const reading = meterSpend(ctx.auditEvents, window);
  const when = today ? " today" : "";

  if (reading.totals.length === 0) {
    return {
      summary: `I don't see any metered fleet spend recorded in the audit ledger${when}.`,
      citations: [],
    };
  }

  const amounts = reading.totals.map((total) => formatAmount(total.value, total.unit)).join(" and ");
  const entries = reading.entryCount === 1 ? "1 ledger entry" : `${reading.entryCount} ledger entries`;
  return {
    summary: `The fleet's metered spend${when} totals ${amounts}, across ${entries}.`,
    citations: [...reading.citations],
  };
}

function answerBlocked(norm: string, ctx: NlQueryContext): Resolution {
  const held = findHeldActions(ctx.auditEvents);
  if (held.length === 0) {
    return {
      summary: "I don't see any blocked or held action in the audit ledger.",
      citations: [],
    };
  }

  // Prefer the held action the question names; fall back to the sole candidate.
  const named = held.filter((action) => mentionsSubject(norm, action));
  const candidates = named.length > 0 ? named : held.length === 1 ? held : [];
  if (candidates.length === 0) {
    return {
      summary:
        `I see ${held.length} held or blocked actions in the audit ledger but couldn't match your `
        + "question to a specific one — name the action, deal, or case.",
      citations: [],
    };
  }

  const chosen = mostRecent(candidates);
  const verdictWord = chosen.verdict === "deny" ? "blocked" : "held for operator review";
  const rule = chosen.sourceRuleId !== undefined
    ? ctx.policyRules.find((r) => r.id === chosen.sourceRuleId)
    : undefined;
  const reason = rule?.effect.reasons[0] ?? chosen.reasons[0];
  const ruleClause = chosen.sourceRuleId !== undefined ? ` by policy rule ${chosen.sourceRuleId}` : "";
  const reasonClause = reason !== undefined ? `: ${reason}` : "";

  return {
    summary: `${chosen.subject} was ${verdictWord}${ruleClause}${reasonClause} (audit event ${chosen.eventId}).`,
    citations: [chosen.eventId, ...(chosen.sourceRuleId !== undefined ? [chosen.sourceRuleId] : [])],
  };
}

function noData(): Resolution {
  return {
    summary:
      "I don't have an answer grounded in the audit ledger for that question. Try asking why a "
      + "specific action was blocked or held, or what the fleet has spent.",
    citations: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Held-action extraction (reads the policy-audit event shape)
// ─────────────────────────────────────────────────────────────────────────────

interface HeldAction {
  readonly eventId: string;
  readonly recordedAt: string;
  /** the human-facing subject: the action target, else its id, else the case. */
  readonly subject: string;
  /** specific identifier tokens (lowercased) to match a question against. */
  readonly tokens: readonly string[];
  readonly verdict: "deny" | "ask";
  readonly sourceRuleId?: string;
  readonly reasons: readonly string[];
}

function findHeldActions(events: readonly AuditEvent[]): HeldAction[] {
  const held: HeldAction[] = [];
  for (const event of events) {
    const verdict = readPolicyVerdict(event);
    if (verdict === null || (verdict.verdict !== "deny" && verdict.verdict !== "ask")) continue;
    const action = readInterceptedAction(event);
    const subject = action?.target ?? action?.id ?? event.caseId;
    // Match only on SPECIFIC identifiers (ids/targets/case/deal) — never generic
    // tool/action words like "gh"/"push", which would substring-collide.
    const tokens = [action?.target, action?.id, event.caseId, event.dealId, event.id]
      .filter((token): token is string => typeof token === "string" && token.length > 0)
      .map((token) => token.toLowerCase());
    held.push({
      eventId: event.id,
      recordedAt: event.recordedAt,
      subject,
      tokens,
      verdict: verdict.verdict,
      sourceRuleId: verdict.sourceRuleId,
      reasons: verdict.reasons,
    });
  }
  return held;
}

function mentionsSubject(norm: string, action: HeldAction): boolean {
  return action.tokens.some((token) => norm.includes(token));
}

/** Most recent by recordedAt, deterministic tie-break by event id (descending). */
function mostRecent(actions: readonly HeldAction[]): HeldAction {
  return [...actions].sort(
    (a, b) => b.recordedAt.localeCompare(a.recordedAt) || b.eventId.localeCompare(a.eventId),
  )[0]!;
}

// ─────────────────────────────────────────────────────────────────────────────
// Defensive readers over free-form audit snapshots
// ─────────────────────────────────────────────────────────────────────────────

function readPolicyVerdict(
  event: AuditEvent,
): { verdict: "deny" | "ask" | "allow"; sourceRuleId?: string; reasons: string[] } | null {
  const record = asRecord(event.afterState?.["policyVerdict"]);
  if (record === null) return null;
  const verdict = record["verdict"];
  if (verdict !== "deny" && verdict !== "ask" && verdict !== "allow") return null;
  const reasons = Array.isArray(record["reasons"])
    ? record["reasons"].filter((reason): reason is string => typeof reason === "string")
    : [];
  const sourceRuleId = typeof record["sourceRuleId"] === "string" ? record["sourceRuleId"] : undefined;
  return { verdict, sourceRuleId, reasons };
}

function readInterceptedAction(
  event: AuditEvent,
): { id?: string; target?: string } | null {
  const record = asRecord(event.beforeState?.["interceptedAction"]);
  if (record === null) return null;
  const id = typeof record["id"] === "string" ? record["id"] : undefined;
  const target = typeof record["target"] === "string" ? record["target"] : undefined;
  return { id, target };
}

function readSpendAmount(event: AuditEvent): { value: number; unit: string } | null {
  const parsed = resourceAllocationContract.safeParse(event.afterState?.["resourceAllocation"]);
  if (!parsed.success) return null;
  const allocation = parsed.data;
  if (!SPEND_RESOURCE_TYPES.has(allocation.resourceType)) return null;
  if (allocation.amount === undefined) return null;
  return { value: allocation.amount.value, unit: allocation.amount.unit };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers (deterministic — no locale dependence)
// ─────────────────────────────────────────────────────────────────────────────

/** The UTC calendar day (YYYY-MM-DD) of an ISO datetime string. */
function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

function formatAmount(value: number, unit: string): string {
  return unit.toUpperCase() === "USD" ? `$${value}` : `${value} ${unit}`;
}
