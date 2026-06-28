/**
 * active-requirement-checker — the "detect" phase's grader for the user-authored
 * requirements control plane (LIM-1320). Given the operator's ACTIVE requirement
 * set and a single agent subject (what an agent reported — `AgentOutput`; or what
 * an agent is about to do — `InterceptedAction`), it returns structured pass/fail
 * findings: for each active, in-scope requirement it classifies the subject as
 * `satisfied` | `missing` | `contradicted` | `unsupported_on_track_claim` |
 * `missing_owner_or_workstream`.
 *
 * WHY this exists: the locked Acme demo detects a drop by reading a fixture's
 * `droppedRequirements[]`. That cannot generalize — a stranger's deal has no
 * pre-baked drop list. This checker grades an arbitrary output/action against the
 * operator's OWN declared requirements, so the loop runs on real data with no
 * narrator (DIRECTIVE.md). It is the keystone the downstream tickets depend on
 * (open-case / action-gate / eval / e2e).
 *
 * HARD CONSTRAINTS (from the ticket + the epic non-negotiables):
 *  - Pure / deterministic. No `Date.now()`, no `Math.random()`, NO LLM in the
 *    verdict path. The same inputs always yield byte-identical findings.
 *  - Only `active` requirements participate. `proposed` / `rejected` / `retired`
 *    are ignored — Liminal never lets an unapproved candidate gate anything.
 *  - The checker only OPENS cases on `hard` requirements (`soft`/`info` produce
 *    advisory findings with `caseOpening: false`). It "fails closed" in spirit:
 *    an on-track claim that is silent on a hard requirement is flagged, not waved
 *    through.
 *  - Findings carry the `requirementId` + the matched evidence phrase, never a
 *    vague summary (the epic's "evidence and requirement IDs, not summaries" rule).
 *
 * The requirement↔subject match is deterministic token matching (normalize →
 * salient tokens → equality / prefix overlap), NOT natural-language inference, so
 * it generalizes past the Acme strings while staying reproducible and explainable.
 */
import type {
  Requirement,
  RequirementSeverity,
  AgentOutput,
  InterceptedAction,
} from "@liminal-engine/contracts";

/** The classification space for a single requirement against a single subject. */
export const REQUIREMENT_FINDING_STATUSES = [
  "satisfied",
  "missing",
  "contradicted",
  "unsupported_on_track_claim",
  "missing_owner_or_workstream",
] as const;
export type RequirementFindingStatus = (typeof REQUIREMENT_FINDING_STATUSES)[number];

export type CheckSubjectKind = "agent-output" | "intercepted-action";

/**
 * The normalized, structured view of a subject the checker grades against. Both
 * `AgentOutput` and `InterceptedAction` are projected onto this shape by the
 * adapters below, so the core grader never special-cases a concrete contract.
 */
export interface CheckSubject {
  readonly id: string;
  readonly kind: CheckSubjectKind;
  readonly dealId?: string;
  /**
   * Which requirement scopes this subject touches. `"*"` means "speaks for the
   * whole deal" — a status report implicitly claims every hard requirement for the
   * deal is met, so all active deal requirements are in scope. An explicit list
   * (an action on one surface) is intersected against each requirement's `scope`.
   */
  readonly surfaces: readonly string[] | "*";
  /** the subject asserts the deal/action is on-track / green. */
  readonly claimsOnTrack: boolean;
  /** requirement phrases the subject explicitly dropped (AgentOutput.droppedRequirements). */
  readonly droppedRequirements: readonly string[];
  /** requirement phrases the subject explicitly violates/overrides (e.g. an action's `args.overrides`). */
  readonly violatedRequirements: readonly string[];
  /** owner roles the subject evidences as assigned (e.g. an action's `args.owners`). */
  readonly assertedOwnerRoles: readonly string[];
  /** free text the subject exposes (summary / artifacts / action descriptor) for "addressed?" matching. */
  readonly text: string;
  /** the subject's own timestamp when it has one (pure — never a wall clock); else null. */
  readonly at: string | null;
}

/** A single requirement's verdict against the subject. */
export interface RequirementFinding {
  readonly requirementId: string;
  readonly status: RequirementFindingStatus;
  readonly severity: RequirementSeverity;
  /** a non-satisfied `hard` requirement — the blocking signal. */
  readonly hardFail: boolean;
  /** whether this finding should open a GovernanceCase (only hard, non-satisfied). */
  readonly caseOpening: boolean;
  readonly ownerRole: string;
  /** the requirement's governed surfaces (why it was in scope). */
  readonly scope: readonly string[];
  /** the dropped/violated phrase that referenced this requirement, when applicable. */
  readonly matchedPhrase?: string;
  /** deterministic, requirement-id-anchored explanation (no vague summaries). */
  readonly detail: string;
}

/** The full report for one subject against the active requirement set. */
export interface RequirementCheckReport {
  readonly subjectId: string;
  readonly subjectKind: CheckSubjectKind;
  readonly dealId?: string;
  readonly at: string | null;
  /** one finding per active, in-scope requirement, in input order (stable). */
  readonly findings: readonly RequirementFinding[];
  /** the subset of `findings` that open a case (hard + non-satisfied). */
  readonly caseOpeningFindings: readonly RequirementFinding[];
  /** true when nothing case-opening fired — the subject may proceed. */
  readonly passed: boolean;
  /** ids of the active, in-scope requirements that were graded. */
  readonly checkedRequirementIds: readonly string[];
  /** ids skipped (non-active or out of scope) — so the skip is auditable, not silent. */
  readonly skippedRequirementIds: readonly string[];
}

// ── deterministic token matching ────────────────────────────────────────────
// Grammar-only stopwords: drop connective words but keep every salient noun
// ("data", "residency", "owner", …). Deliberately small — over-stopwording would
// silently weaken detection.
const STOPWORDS = new Set<string>([
  "the", "a", "an", "of", "to", "in", "on", "and", "or", "for", "be", "is", "are",
  "at", "by", "with", "within", "shall", "this", "that", "its", "their", "any",
  "as", "from", "into", "only", "not", "no", "all", "must", "each", "per", "every",
  "will", "should", "may", "remain", "remains",
]);

/** lowercase → salient alphanumeric tokens (len ≥ 2, minus grammar stopwords). */
function tokenize(input: string): string[] {
  const matched = input.toLowerCase().match(/[a-z0-9]+/g);
  if (!matched) return [];
  return matched.filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/**
 * Two tokens match if equal, share a 5-char prefix (residency≈resident), or one is
 * a ≥4-char prefix of the other (data≈database). Light stemming without a stemmer
 * dictionary — deterministic and explainable.
 */
function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const min = Math.min(a.length, b.length);
  if (min >= 5 && a.slice(0, 5) === b.slice(0, 5)) return true;
  if (min >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;
  return false;
}

/** the tokens that ground a requirement: its statement + scope + owning role. */
function requirementTokens(req: Requirement): string[] {
  return tokenize(`${req.text} ${req.scope.join(" ")} ${req.ownerRole}`);
}

/**
 * A short phrase (a dropped/violated requirement string) REFERENCES a requirement
 * when every salient token of the phrase matches some token grounding the
 * requirement. Asymmetric on purpose: a 3-word drop phrase must be fully covered
 * by the (longer) requirement, not vice-versa.
 */
function phraseReferencesRequirement(phrase: string, req: Requirement): boolean {
  const phraseTokens = tokenize(phrase);
  if (phraseTokens.length === 0) return false;
  const reqTokens = requirementTokens(req);
  return phraseTokens.every((p) => reqTokens.some((r) => tokensMatch(p, r)));
}

/**
 * Free text ADDRESSES a requirement when a majority (≥ 60%) of the requirement's
 * salient tokens appear in the text — positive evidence the subject actually spoke
 * to the requirement (vs. a green status that is silent on it).
 */
function textAddressesRequirement(text: string, req: Requirement): boolean {
  const textTokens = tokenize(text);
  if (textTokens.length === 0) return false;
  // Weigh the requirement's STATEMENT only — its scope/owner metadata are not what
  // the subject must restate to count as "addressed".
  const statementTokens = [...new Set(tokenize(req.text))];
  if (statementTokens.length === 0) return false;
  const present = statementTokens.filter((r) => textTokens.some((t) => tokensMatch(t, r))).length;
  return present / statementTokens.length >= 0.6;
}

// Scope tokens that imply an explicit owner / workstream obligation.
const OWNER_SURFACE_TOKENS = ["owner", "owners", "ownership", "workstream", "workstreams"];

function requirementRequiresOwner(req: Requirement): boolean {
  const scopeTokens = tokenize(req.scope.join(" "));
  return scopeTokens.some((s) => OWNER_SURFACE_TOKENS.some((o) => tokensMatch(s, o)));
}

function ownerEvidenced(req: Requirement, subject: CheckSubject): boolean {
  const role = req.ownerRole.trim().toLowerCase();
  if (subject.assertedOwnerRoles.some((r) => r.trim().toLowerCase() === role)) return true;
  // fall back to a textual mention of the owning role (e.g. "Security to own remediation")
  const textTokens = tokenize(subject.text);
  const roleTokens = tokenize(req.ownerRole);
  return roleTokens.length > 0 && roleTokens.every((rt) => textTokens.some((t) => tokensMatch(t, rt)));
}

/** does an active requirement's scope intersect the surfaces the subject touches? */
function requirementInScope(req: Requirement, subject: CheckSubject): boolean {
  if (subject.surfaces === "*") return true;
  const subjectSurfaceTokens = subject.surfaces.map((s) => tokenize(s));
  return req.scope.some((scope) => {
    const scopeTokens = tokenize(scope);
    return subjectSurfaceTokens.some((surfaceTokens) =>
      scopeTokens.some((sc) => surfaceTokens.some((su) => tokensMatch(sc, su))),
    );
  });
}

// ── core grader ─────────────────────────────────────────────────────────────

interface Classification {
  readonly status: RequirementFindingStatus;
  readonly matchedPhrase?: string;
}

/**
 * Classify one in-scope requirement against the subject. Precedence (most severe
 * first): explicit violation → explicit drop → unmet owner obligation → positive
 * "addressed" evidence → silence under an on-track claim.
 */
function classify(req: Requirement, subject: CheckSubject): Classification {
  const violation = subject.violatedRequirements.find((p) => phraseReferencesRequirement(p, req));
  if (violation) return { status: "contradicted", matchedPhrase: violation };

  const dropped = subject.droppedRequirements.find((p) => phraseReferencesRequirement(p, req));
  if (dropped) {
    return {
      status: subject.claimsOnTrack ? "unsupported_on_track_claim" : "missing",
      matchedPhrase: dropped,
    };
  }

  if (requirementRequiresOwner(req) && !ownerEvidenced(req, subject)) {
    return { status: "missing_owner_or_workstream" };
  }

  if (textAddressesRequirement(subject.text, req)) return { status: "satisfied" };

  // In scope, not dropped/violated, owner ok or not required, but the subject never
  // actually speaks to the requirement: a green claim that is silent on a hard
  // obligation is an unsupported on-track claim; an off-track subject just misses it.
  return { status: subject.claimsOnTrack ? "unsupported_on_track_claim" : "missing" };
}

/**
 * Grade a subject against the operator's requirement set. Non-active requirements
 * (proposed/rejected/retired) and out-of-scope requirements never participate;
 * they are reported under `skippedRequirementIds` so the omission is auditable.
 */
export function checkRequirements(
  requirements: readonly Requirement[],
  subject: CheckSubject,
): RequirementCheckReport {
  const findings: RequirementFinding[] = [];
  const checkedIds: string[] = [];
  const skippedIds: string[] = [];

  for (const req of requirements) {
    if (req.status !== "active" || !requirementInScope(req, subject)) {
      skippedIds.push(req.id);
      continue;
    }
    checkedIds.push(req.id);
    const c = classify(req, subject);
    const hardFail = req.severity === "hard" && c.status !== "satisfied";
    findings.push({
      requirementId: req.id,
      status: c.status,
      severity: req.severity,
      hardFail,
      caseOpening: hardFail,
      ownerRole: req.ownerRole,
      scope: req.scope,
      ...(c.matchedPhrase !== undefined ? { matchedPhrase: c.matchedPhrase } : {}),
      detail: detailForReq(req, c),
    });
  }

  const caseOpeningFindings = findings.filter((f) => f.caseOpening);
  return {
    subjectId: subject.id,
    subjectKind: subject.kind,
    ...(subject.dealId !== undefined ? { dealId: subject.dealId } : {}),
    at: subject.at,
    findings,
    caseOpeningFindings,
    passed: caseOpeningFindings.length === 0,
    checkedRequirementIds: checkedIds,
    skippedRequirementIds: skippedIds,
  };
}

/** anchor every detail string on the requirement id (no vague summaries). */
function detailForReq(req: Requirement, c: Classification): string {
  const id = `requirement ${req.id}`;
  switch (c.status) {
    case "satisfied":
      return `${id} is satisfied: the subject addresses "${req.text}".`;
    case "missing":
      return c.matchedPhrase !== undefined
        ? `${id} is missing: the subject dropped "${c.matchedPhrase}".`
        : `${id} is missing: the subject does not address "${req.text}".`;
    case "contradicted":
      return `${id} is contradicted: the subject overrides "${c.matchedPhrase ?? req.text}".`;
    case "unsupported_on_track_claim":
      return c.matchedPhrase !== undefined
        ? `${id}: on-track claim is unsupported — required "${c.matchedPhrase}" was dropped.`
        : `${id}: on-track claim is unsupported — the subject is silent on "${req.text}".`;
    case "missing_owner_or_workstream":
      return `${id}: the ${req.ownerRole} owner / workstream for "${req.text}" is not evidenced.`;
  }
}

// ── subject adapters ────────────────────────────────────────────────────────

/**
 * Project an `AgentOutput` (a deal-level status report) onto a `CheckSubject`. A
 * status report speaks for the whole deal, so `surfaces` is `"*"`: every active
 * hard requirement for the deal is in scope. The reported `summary` + the agent's
 * cited `artifacts` form the "addressed?" text; the explicit `droppedRequirements`
 * are the drop signal.
 */
export function agentOutputToSubject(output: AgentOutput): CheckSubject {
  const artifacts = output.agentMetadata?.artifacts ?? [];
  return {
    id: output.id,
    kind: "agent-output",
    dealId: output.dealId,
    surfaces: "*",
    claimsOnTrack: output.reportedStatus === "on-track",
    droppedRequirements: output.droppedRequirements,
    violatedRequirements: [],
    assertedOwnerRoles: [],
    text: [output.summary, ...artifacts].join(" "),
    at: null,
  };
}

// Common consequential actions → the requirement surface they touch.
const SURFACE_BY_ACTION: Record<string, string> = {
  "customer-update": "customer-facing-status-update",
  "status-update": "customer-facing-status-update",
  "send-update": "customer-facing-status-update",
  "send-status": "customer-facing-status-update",
  "on-track-update": "customer-facing-status-update",
  "deal-proposal": "deal-proposal",
  "launch-plan": "launch-plan",
};

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
}

/**
 * Project an `InterceptedAction` (a surface-specific action about to run) onto a
 * `CheckSubject`. Unlike a status report, an action touches a SPECIFIC surface —
 * derived from `action` (with a small map + raw fallbacks) — so only requirements
 * whose `scope` intersects that surface are graded. The structured `args` carry the
 * deterministic governance signals: `status: "on-track"`, `overrides`/`violates`
 * (explicit contradiction), `drops`, and `owners` (evidenced ownership).
 */
export function interceptedActionToSubject(action: InterceptedAction): CheckSubject {
  const args = action.args;
  const mapped = SURFACE_BY_ACTION[action.action];
  const surfaces = [
    ...(mapped !== undefined ? [mapped] : []),
    action.action,
    ...(action.target !== undefined ? [action.target] : []),
  ];
  const status = typeof args.status === "string" ? args.status : "";
  const claimsOnTrack =
    status === "on-track" ||
    /on[-_ ]?track/.test(`${action.action} ${action.target ?? ""}`.toLowerCase());
  return {
    id: action.id,
    kind: "intercepted-action",
    ...(action.goalId !== undefined ? { dealId: action.goalId } : {}),
    surfaces,
    claimsOnTrack,
    droppedRequirements: [...asStringArray(args.drops), ...asStringArray(args.droppedRequirements)],
    violatedRequirements: [
      ...asStringArray(args.overrides),
      ...asStringArray(args.violates),
      ...asStringArray(args.overrideRequirements),
    ],
    assertedOwnerRoles: asStringArray(args.owners),
    text: [action.tool, action.action, action.target ?? "", asStringArray(args.summary).join(" ")]
      .join(" ")
      .trim(),
    at: action.requestedAt,
  };
}

/** Grade an `AgentOutput` against the active requirement set. */
export function checkAgentOutput(
  requirements: readonly Requirement[],
  output: AgentOutput,
): RequirementCheckReport {
  return checkRequirements(requirements, agentOutputToSubject(output));
}

/** Grade an `InterceptedAction` against the active requirement set. */
export function checkInterceptedAction(
  requirements: readonly Requirement[],
  action: InterceptedAction,
): RequirementCheckReport {
  return checkRequirements(requirements, interceptedActionToSubject(action));
}
