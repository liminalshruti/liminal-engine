/**
 * propose-requirements — the candidate-requirement inbox (LIM-1325). Turns an
 * `EvidenceBundle` (normalized, cited source material) into ZERO OR MORE *candidate*
 * requirements that stay strictly `proposed` until an operator approves them.
 *
 * WHY this exists: requirements are the operator's load-bearing obligations, and the
 * loop must be able to SUGGEST them from real source material (a call, a contract, a
 * proposal) without ever letting a machine-surfaced suggestion silently govern. A
 * candidate is a *proposal*, not a decision — so everything here produces records with
 * `createdBy: "proposal"` that the store persists as `status: "proposed"`. A proposed
 * candidate is INERT by construction:
 *   - it never appears in the active-requirement query (the store excludes non-active),
 *   - the active-requirement checker / proxy gate skip it (only `active` participates),
 *   - it opens no `GovernanceCase` and produces no `DriftSignal`, so it reaches no eval.
 * Only an operator `approve` flips it to `active`; `amend` is the "edit"; `reject` is
 * the decline. Extraction is NEVER authoritative.
 *
 * HARD CONSTRAINTS (from the ticket + the epic non-negotiables):
 *  - PURE / deterministic. No `Date.now()`, no `Math.random()`, no LLM in this path —
 *    the same bundle + resolver always yield byte-identical candidates. (Identity +
 *    time for the *persisted* record come from the store's injected Clock/IdGen.)
 *  - PROVENANCE-honest. The `EvidenceBundle` stores quoted spans BY REFERENCE (a
 *    sha256 `hash`), never inline (the redaction discipline, LIM-1248/1323). To carry a
 *    real `quote`, the caller injects a `QuoteResolver` (the authorized holder of the
 *    raw text); this module re-hashes the resolved quote with the kernel's `sha256Hex`
 *    and DROPS any candidate whose quote does not match its chunk `hash`. A candidate
 *    can never cite a quote that isn't the one the evidence committed to.
 *  - GROUNDED. A chunk only yields a candidate when its quoted span actually states an
 *    obligation (a modal: must / shall / required / should / …). Spans with no
 *    obligation language yield nothing — hence "zero or more".
 *
 * The classification (severity / scope / owner role) is a deterministic keyword
 * mapping, an INITIAL suggestion the operator refines via `amend` before approving —
 * roles only here, never an invented persona name (DEMO_CONTRACT persona rule).
 */
import {
  sha256Hex,
  type EvidenceBundle,
  type EvidenceChunk,
  type EvidenceSource,
  type EvidenceSourceType,
  type Requirement,
  type RequirementEvidence,
  type RequirementSeverity,
} from "@liminal-engine/contracts";
import type {
  RequirementDraft,
  RequirementStore,
  RequirementStoreError,
} from "./requirement-ports.ts";

/**
 * Resolves the raw quoted text for a cited chunk — supplied by the AUTHORIZED holder
 * of the source material (e.g. the apps composition root), never embedded in the
 * durable bundle. Returning `undefined` means "no quote available for this chunk" and
 * the chunk is skipped (an ungrounded candidate is never proposed).
 */
export type QuoteResolver = (chunk: EvidenceChunk, source: EvidenceSource) => string | undefined;

/**
 * A single extraction candidate BEFORE persistence: the `proposed` requirement draft
 * (`createdBy: "proposal"`) plus the source `evidence` (quote + span) grounding it.
 * `draft` carries no `id`/`status`/`createdAt` — the store assigns those on `create`
 * (always `proposed`), so a caller cannot forge an already-approved requirement.
 */
export interface RequirementProposal {
  readonly draft: RequirementDraft;
  readonly evidence: readonly RequirementEvidence[];
}

/**
 * A candidate AFTER it has been staged into the store: the persisted `proposed`
 * requirement (now with a store id) + its grounding evidence. This is the unit the
 * inbox shows for approve / edit / reject.
 */
export interface StagedCandidate {
  readonly requirement: Requirement;
  readonly evidence: readonly RequirementEvidence[];
}

/** The outcome of staging one proposal — representable, mirroring the store's `Result`. */
export type StageOutcome =
  | { readonly ok: true; readonly candidate: StagedCandidate }
  | { readonly ok: false; readonly error: RequirementStoreError; readonly draft: RequirementDraft };

/**
 * Optional scope overrides. A `Requirement` must carry BOTH a `goalId` and a `dealId`;
 * an `EvidenceBundle` only requires one. When the bundle omits one, the caller supplies
 * it here; otherwise the bundle's value is used.
 */
export interface ProposeOptions {
  readonly goalId?: string;
  readonly dealId?: string;
}

// ── obligation detection ──────────────────────────────────────────────────────
// A quoted span states a requirement only when it carries an obligation modal. HARD
// modals bind (must / shall / required / contractual …); SOFT modals advise (should /
// recommended / may …). No modal ⇒ not an obligation ⇒ no candidate.

const HARD_MODALS = [
  "must",
  "shall",
  "required",
  "requires",
  "mandatory",
  "obligation",
  "obligated",
  "contractual",
  "solely within",
  "only within",
  "may not",
  "shall not",
  "must not",
  "prohibited",
] as const;

const SOFT_MODALS = [
  "should",
  "recommended",
  "encouraged",
  "preferred",
  "nice to have",
  "may ",
] as const;

function classifySeverity(quoteLc: string): RequirementSeverity | null {
  if (HARD_MODALS.some((m) => quoteLc.includes(m))) return "hard";
  if (SOFT_MODALS.some((m) => quoteLc.includes(m))) return "soft";
  return null; // no obligation language → not a requirement
}

// ── scope + owner classification (deterministic keyword maps) ──────────────────
// An INITIAL suggestion; the operator refines it via `amend` before approving.

interface ScopeRule {
  readonly tokens: readonly string[];
  readonly surfaces: readonly string[];
}

const SCOPE_RULES: readonly ScopeRule[] = [
  {
    tokens: ["residency", "resident", "data center", "data centre", "eea", "gdpr", "privacy", "personal data"],
    surfaces: ["deal-proposal", "launch-plan", "customer-facing-status-update"],
  },
  { tokens: ["owner", "workstream", "accountable", "responsible"], surfaces: ["owner-assignment"] },
  { tokens: ["launch", "go-live", "go live", "deploy", "production"], surfaces: ["launch-plan"] },
  { tokens: ["sign", "countersign", "dpa", "agreement", "contract"], surfaces: ["launch-plan", "owner-assignment"] },
  { tokens: ["status", "customer-facing", "report", "update"], surfaces: ["customer-facing-status-update"] },
  { tokens: ["pricing", "commercial", "proposal", "sow"], surfaces: ["deal-proposal"] },
];

const DEFAULT_SCOPE = ["deal-proposal"] as const;

function classifyScope(quoteLc: string): string[] {
  const surfaces = new Set<string>();
  for (const rule of SCOPE_RULES) {
    if (rule.tokens.some((t) => quoteLc.includes(t))) {
      for (const s of rule.surfaces) surfaces.add(s);
    }
  }
  return surfaces.size > 0 ? [...surfaces] : [...DEFAULT_SCOPE];
}

interface OwnerRule {
  readonly tokens: readonly string[];
  readonly role: string;
}

// First match wins (ordered most-specific → least). Roles only — never a persona name.
const OWNER_RULES: readonly OwnerRule[] = [
  { tokens: ["residency", "data center", "data centre", "encryption", "security", "gdpr", "personal data", "privacy"], role: "Security" },
  { tokens: ["dpa", "countersign", "agreement", "contract", "legal", "liability", "indemn.", "indemnity"], role: "Legal" },
  { tokens: ["co-marketing", "comarketing", "press release", "marketing", "brand"], role: "Marketing" },
  { tokens: ["workstream", "deploy", "infrastructure", "engineering", "technical", "go-live"], role: "Engineering" },
  { tokens: ["pricing", "commercial", "revenue", "proposal"], role: "Product" },
];

const DEFAULT_OWNER_ROLE = "Unassigned";

function classifyOwnerRole(quoteLc: string): string {
  for (const rule of OWNER_RULES) {
    if (rule.tokens.some((t) => quoteLc.includes(t))) return rule.role;
  }
  return DEFAULT_OWNER_ROLE;
}

// ── evidence projection ────────────────────────────────────────────────────────

// EvidenceBundle source kinds → a readable, free-form RequirementEvidence.sourceType.
const SOURCE_TYPE_LABEL: Record<EvidenceSourceType, string> = {
  customer_call: "call-transcript",
  proposal: "proposal",
  sow: "sow",
  slack: "slack",
  email: "email",
  linear: "linear-item",
  agent_output: "agent-output",
};

const SPAN_PREFIX: Record<EvidenceChunk["span"]["unit"], string> = {
  char: "c.",
  line: "L",
  page: "p.",
  section: "Section ",
  timecode: "",
  message: "msg ",
};

/** Deterministic, human-legible span locator from a bundle chunk's structured span. */
function formatSpan(span: EvidenceChunk["span"]): string {
  const prefix = SPAN_PREFIX[span.unit];
  return span.start === span.end ? `${prefix}${span.start}` : `${prefix}${span.start}-${span.end}`;
}

// Locale-INDEPENDENT stable ordering (UTF-16 code-unit compare), so the candidate list
// is reproducible regardless of the bundle's chunk assembly order.
function byChunkId(a: EvidenceChunk, b: EvidenceChunk): number {
  return a.chunkId < b.chunkId ? -1 : a.chunkId > b.chunkId ? 1 : 0;
}

/**
 * Build a `RequirementEvidence` from a cited chunk + its source + the resolved quote.
 * Returns `null` when the resolved quote does not hash to the chunk's committed `hash`
 * (provenance integrity — the candidate is dropped rather than cite a mismatched quote).
 */
function evidenceFor(
  chunk: EvidenceChunk,
  source: EvidenceSource,
  quote: string,
): RequirementEvidence | null {
  if (sha256Hex(quote) !== chunk.hash) return null;
  return {
    sourceId: chunk.sourceId,
    sourceType: SOURCE_TYPE_LABEL[source.sourceType],
    span: formatSpan(chunk.span),
    quote,
    hash: chunk.hash,
    capturedAt: source.capturedAt,
  };
}

/**
 * proposeRequirementsFromEvidence — the candidate extractor. PURE: a deterministic
 * function of the bundle + the (injected) quote resolver. Produces zero or more
 * `proposed` candidate drafts (`createdBy: "proposal"`), each grounded in exactly the
 * source quote/span it was extracted from. Never persists, never activates, never
 * gates — those are downstream, operator-gated steps.
 */
export function proposeRequirementsFromEvidence(
  bundle: EvidenceBundle,
  resolveQuote: QuoteResolver,
  options: ProposeOptions = {},
): RequirementProposal[] {
  const goalId = options.goalId ?? bundle.goalId;
  const dealId = options.dealId ?? bundle.dealId;
  if (goalId === undefined || dealId === undefined) {
    throw new Error(
      "cannot propose requirements: a candidate needs both a goalId and a dealId — " +
        "the bundle supplied neither; pass options.goalId / options.dealId.",
    );
  }

  const sourceById = new Map(bundle.sources.map((s) => [s.sourceId, s] as const));
  const proposals: RequirementProposal[] = [];
  const seen = new Set<string>(); // dedupe identical candidates (text+severity+owner+scope)

  for (const chunk of [...bundle.chunks].sort(byChunkId)) {
    const source = sourceById.get(chunk.sourceId);
    if (source === undefined) continue; // contract guarantees this, but stay defensive

    const quote = resolveQuote(chunk, source);
    if (quote === undefined || quote.trim().length === 0) continue; // ungrounded → skip

    const severity = classifySeverity(quote.toLowerCase());
    if (severity === null) continue; // no obligation stated → not a requirement

    const evidence = evidenceFor(chunk, source, quote);
    if (evidence === null) continue; // quote ≠ committed hash → drop (provenance integrity)

    const text = quote.trim();
    const scope = classifyScope(quote.toLowerCase());
    const ownerRole = classifyOwnerRole(quote.toLowerCase());

    const dedupeKey = `${text} ${severity} ${ownerRole} ${[...scope].sort().join(",")}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    proposals.push({
      draft: {
        goalId,
        dealId,
        text,
        ownerRole,
        severity,
        scope,
        createdBy: "proposal",
        evidenceRefs: [chunk.sourceId],
      },
      evidence: [evidence],
    });
  }

  return proposals;
}

/**
 * stageProposals — persist each proposal into the requirement store as a `proposed`
 * candidate (the store assigns the id/createdAt and forces `status: "proposed"`). The
 * returned `StagedCandidate`s are what the inbox renders for approve / edit / reject.
 * Store failures are REPRESENTABLE per proposal (never thrown) so a caller can surface
 * a partial failure without losing the candidates that did persist.
 */
export async function stageProposals(
  store: RequirementStore,
  proposals: readonly RequirementProposal[],
): Promise<StageOutcome[]> {
  const outcomes: StageOutcome[] = [];
  for (const proposal of proposals) {
    const created = await store.create(proposal.draft);
    if (created.ok) {
      outcomes.push({ ok: true, candidate: { requirement: created.value, evidence: proposal.evidence } });
    } else {
      outcomes.push({ ok: false, error: created.error, draft: proposal.draft });
    }
  }
  return outcomes;
}

/**
 * proposeAndStage — convenience composition: extract candidates from a bundle and stage
 * them as `proposed` in one call. Returns the per-proposal staging outcomes.
 */
export async function proposeAndStage(
  store: RequirementStore,
  bundle: EvidenceBundle,
  resolveQuote: QuoteResolver,
  options: ProposeOptions = {},
): Promise<StageOutcome[]> {
  return stageProposals(store, proposeRequirementsFromEvidence(bundle, resolveQuote, options));
}

// ── inbox presenter (the candidate-framed UI/API copy) ─────────────────────────

export interface CandidateEvidenceView {
  readonly source: string;
  readonly span: string;
  readonly quote: string;
}

/**
 * The framework-agnostic view model for a candidate in the inbox. Every human-facing
 * string FRAMES the item as a *candidate* awaiting approval — it is never presented as
 * an active "policy" or an authoritative "requirement" until the operator approves it
 * (LIM-1325 AC3). The only offered actions are approve / edit / reject.
 */
export interface CandidateInboxView {
  readonly kind: "requirement-candidate";
  /** leads with "Candidate" — never an active-policy / active-requirement framing. */
  readonly title: string;
  readonly badge: { readonly label: "Candidate"; readonly tone: "neutral" };
  readonly statusLabel: string;
  /** spells out that a candidate is inert until approved. */
  readonly note: string;
  readonly ownerLabel: string;
  readonly severityLabel: string;
  readonly evidence: readonly CandidateEvidenceView[];
  readonly actions: readonly ["approve", "edit", "reject"];
}

function truncate(text: string, max = 96): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * describeCandidate — render a staged candidate as candidate-framed inbox copy. Uses
 * "candidate" wording, never "policy", and never claims the item is active/authoritative
 * (LIM-1325 AC3).
 */
export function describeCandidate(candidate: StagedCandidate): CandidateInboxView {
  const { requirement, evidence } = candidate;
  return {
    kind: "requirement-candidate",
    title: `Candidate: ${truncate(requirement.text)}`,
    badge: { label: "Candidate", tone: "neutral" },
    statusLabel: "Proposed candidate — awaiting operator approval",
    note: "Proposed candidates do not gate actions, open a case, or affect evals until you approve them.",
    ownerLabel: `Suggested owner: ${requirement.ownerRole}`,
    severityLabel: `Suggested severity: ${requirement.severity}`,
    evidence: evidence.map((e) => ({ source: e.sourceId, span: e.span, quote: e.quote })),
    actions: ["approve", "edit", "reject"],
  };
}
