/**
 * requirement-case — the "detect → open case" glue for the user-authored
 * requirements control plane. It is the seam between LIM-1326's
 * `active-requirement-checker` (which GRADES an agent output / intercepted action
 * against the operator's ACTIVE requirement set) and the `GovernanceCase` the rest
 * of the loop acts on: for every case-opening finding it OPENS one blocking
 * `GovernanceCase`, persisted through the `GovernanceCaseStore` port.
 *
 * WHY this exists: the locked Acme `detectMiss` reads a fixture's
 * `droppedRequirements[]` and opens one hard-coded case. That cannot generalize —
 * a stranger's deal has no pre-baked drop list. This use case opens cases from the
 * operator's OWN active requirements graded against arbitrary real output, so the
 * loop runs on real data with no narrator (DIRECTIVE.md). It does not replace the
 * Acme path; it is the generic entry point the real-data sources (substrate / API /
 * signal-harness) call.
 *
 * GUARANTEES (the ticket's acceptance + guardrails):
 *  - Only ACTIVE requirements open cases. `proposed` / `rejected` / `retired`
 *    candidates never gate anything — the checker skips them, so they never reach
 *    here (covered by tests).
 *  - Only HARD, non-satisfied requirements open a case (`finding.caseOpening`).
 *    A satisfied / soft / advisory finding never opens one.
 *  - NO DUPLICATES for the same active requirement on the same deal: before
 *    opening, the use case reads the deal's existing non-terminal cases and skips a
 *    requirement that already has one (and never opens two in a single run). The
 *    skipped findings are returned in `deduped` so the omission is auditable.
 *  - The opened case CITES the requirement (its exact statement) and its SOURCE
 *    EVIDENCE (the `RequirementEvidence` receipts it is grounded in) — never a
 *    generic "a requirement was dropped" summary. This is the GovernanceCase
 *    evidence-field mapping (`evidenceIds` ← `Requirement.evidenceRefs`,
 *    `missingFrom` ← the governed surfaces, requirement-anchored
 *    `recommendedActions`).
 *
 * Determinism + boundaries: ids + timestamps are INJECTED (`IdGen` / `Clock`),
 * never `Date.now()` / `Math.random()`. Depends on `./ports`, `./detect-miss`
 * (the shared Clock/IdGen), and `./active-requirement-checker` only — never a
 * concrete adapter (enforced by `.dependency-cruiser.cjs`).
 */
import type {
  Requirement,
  GovernanceCase,
  GovernanceCaseStatus,
  AgentOutput,
  InterceptedAction,
} from "@liminal-engine/contracts";
import type { GovernanceCaseStore } from "./ports.ts";
import type { Clock, IdGen } from "./detect-miss.ts";
import {
  checkAgentOutput,
  checkInterceptedAction,
  type RequirementCheckReport,
  type RequirementFinding,
  type RequirementFindingStatus,
} from "./active-requirement-checker.ts";

/**
 * Case statuses that count as a still-live case for dedup: a requirement that
 * already carries one of these must NOT get a second case. Terminal statuses
 * (`dismissed` / `closed`) are resolved, so a fresh violation may open a new case.
 */
const ACTIVE_CASE_STATUSES: ReadonlySet<GovernanceCaseStatus> = new Set<GovernanceCaseStatus>([
  "open",
  "corrected",
  "enforced",
  "reopened",
]);

/** Injected determinism + the case sink — the use case never touches a wall clock or a concrete store. */
export interface OpenRequirementCasesDeps {
  readonly caseStore: GovernanceCaseStore;
  readonly clock: Clock;
  readonly idGen: IdGen;
}

/**
 * Per-deal scenario knowledge that is NOT derivable from the requirement itself —
 * injected by the caller so the generic mapper never fabricates generic prose.
 * Omitted ⇒ the opened case stays minimal (no `businessImpact`), which keeps the
 * "cites the requirement, not generic prose" guarantee intact.
 */
export interface RequirementCaseEvidence {
  /** business-impact line for the deal (e.g. "$1.2M Acme expansion at risk"). */
  readonly businessImpact?: string;
}

export interface OpenRequirementCasesOptions {
  /** optional per-deal business-impact line attached to every case opened in this call. */
  readonly evidence?: RequirementCaseEvidence;
}

/** A case-opening finding skipped because the requirement already has a live case. */
export interface DedupedRequirementCase {
  readonly requirementId: string;
  /** the id of the existing case that made this a duplicate. */
  readonly existingCaseId: string;
}

export interface OpenRequirementCasesResult {
  /** the cases this call opened — one per NEW case-opening active requirement. */
  readonly opened: readonly GovernanceCase[];
  /** case-opening findings skipped because a live case already exists (no duplicates). */
  readonly deduped: readonly DedupedRequirementCase[];
  /** the full grading report (auditable: checked vs skipped requirements, every finding). */
  readonly report: RequirementCheckReport;
}

// ── GovernanceCase evidence-field mapping ────────────────────────────────────

/**
 * Map a single case-opening finding + its requirement onto a `GovernanceCase`.
 * Pure + deterministic: `id` and `detectedAt` are INJECTED via `ctx`. This is the
 * evidence-field mapping the ticket owns — every field is grounded in the
 * requirement or the finding, never generic prose:
 *  - `missedRequirement` ← the requirement's exact statement (cites the requirement).
 *  - `evidenceIds`       ← the requirement's `evidenceRefs` (cites the source evidence
 *                          receipts it is grounded in).
 *  - `missingFrom`       ← the surfaces the requirement governs (where it is missing).
 *  - `category`          ← the specific violation kind from the finding status.
 *  - `recommendedActions`← requirement-id-anchored enforcement steps.
 *
 * Throws on misuse (a non-case-opening finding, or a finding/requirement mismatch)
 * rather than silently producing a wrong case — a detected violation must never be
 * quietly dropped or mis-attributed.
 */
export function governanceCaseForFinding(
  requirement: Requirement,
  finding: RequirementFinding,
  ctx: { readonly id: string; readonly detectedAt: string; readonly businessImpact?: string },
): GovernanceCase {
  if (finding.requirementId !== requirement.id) {
    throw new Error(
      `governanceCaseForFinding: finding targets ${finding.requirementId} but requirement is ${requirement.id}`,
    );
  }
  if (!finding.caseOpening) {
    throw new Error(
      `governanceCaseForFinding: ${requirement.id} finding is not case-opening ` +
        `(status=${finding.status}, severity=${finding.severity}) — only hard, non-satisfied findings open a case`,
    );
  }

  const evidenceIds = [...requirement.evidenceRefs];
  const missingFrom = [...requirement.scope];

  return {
    id: ctx.id,
    dealId: requirement.dealId,
    // Cite the requirement VERBATIM — its exact authored statement, never a summary.
    missedRequirement: requirement.text,
    category: categoryForStatus(finding.status),
    // A case-opening finding is, by construction, a hard requirement that is not
    // satisfied — the blocking signal.
    severity: "blocking",
    status: "open",
    detectedAt: ctx.detectedAt,
    // Inject business impact only when supplied — absent ⇒ the case stays minimal
    // (and its canonical hash is unchanged), honoring the contract's optional rule.
    ...(ctx.businessImpact !== undefined ? { businessImpact: ctx.businessImpact } : {}),
    // Where the requirement is missing: the surfaces it governs. Omit if a
    // requirement somehow has no scope (keeps the optional-absent rule).
    ...(missingFrom.length > 0 ? { missingFrom } : {}),
    // Cite the SOURCE EVIDENCE the requirement is grounded in (RequirementEvidence
    // receipt ids). Omit when the requirement carries no evidence refs.
    ...(evidenceIds.length > 0 ? { evidenceIds } : {}),
    recommendedActions: recommendedActionsFor(requirement, finding),
  };
}

/** The specific violation kind → a `GovernanceCase.category` (never a generic bucket). */
function categoryForStatus(status: RequirementFindingStatus): string {
  switch (status) {
    case "missing":
      return "requirement-missing";
    case "contradicted":
      return "requirement-contradicted";
    case "unsupported_on_track_claim":
      return "unsupported-on-track-claim";
    case "missing_owner_or_workstream":
      return "missing-owner-or-workstream";
    case "satisfied":
      // Unreachable for a case-opening finding (guarded above); kept for exhaustiveness.
      return "requirement-violation";
  }
}

/**
 * Requirement-anchored enforcement steps — each cites the requirement id + its
 * exact text, so the recommended actions are specific to THIS requirement, not a
 * generic remediation checklist. They map onto the fixed `EnforcementAction`
 * actionType vocabulary (assign_owner / change_status / block_agent_action /
 * record_audit_event) the correction phase compiles.
 */
function recommendedActionsFor(requirement: Requirement, finding: RequirementFinding): string[] {
  const ref = `requirement ${requirement.id} ("${requirement.text}")`;
  switch (finding.status) {
    case "contradicted":
      return [
        `Reverse or block the action that overrides ${ref}.`,
        `Assign a ${requirement.ownerRole} owner accountable for ${requirement.id}.`,
        `Record an audit event capturing the override of ${requirement.id}.`,
      ];
    case "missing_owner_or_workstream":
      return [
        `Assign a ${requirement.ownerRole} owner / workstream for ${ref}.`,
        `Open a remediation workstream tracking ${requirement.id} to completion.`,
      ];
    case "unsupported_on_track_claim":
      return [
        `Move the deal to At Risk until ${ref} is satisfied.`,
        `Block customer-facing on-track updates until ${requirement.id} is satisfied.`,
        `Assign a ${requirement.ownerRole} owner accountable for ${requirement.id}.`,
      ];
    case "missing":
    case "satisfied":
      return [
        `Open a remediation workstream for ${ref}.`,
        `Assign a ${requirement.ownerRole} owner accountable for ${requirement.id}.`,
        `Block downstream actions until ${requirement.id} is satisfied.`,
      ];
  }
}

// ── the use case: open cases from a grading report ───────────────────────────

/**
 * Open a blocking `GovernanceCase` for every case-opening finding in a grading
 * report, deduping against the deal's existing live cases. The core entry point;
 * the convenience wrappers below run the checker for you.
 *
 * Dedup: a requirement that already has a non-terminal case on its deal is skipped
 * (returned under `deduped`), and no requirement gets two cases in one call — so a
 * re-run over the same subject opens nothing new.
 */
export async function openCasesFromReport(
  deps: OpenRequirementCasesDeps,
  requirements: readonly Requirement[],
  report: RequirementCheckReport,
  options: OpenRequirementCasesOptions = {},
): Promise<OpenRequirementCasesResult> {
  const byId = new Map(requirements.map((r) => [r.id, r] as const));
  const businessImpact = options.evidence?.businessImpact;

  // Lazily read + cache each deal's existing live cases, keyed by the requirement
  // statement they cite, so dedup costs at most one store read per deal.
  const liveCasesByDeal = new Map<string, Map<string, string>>();
  const liveCasesFor = async (dealId: string): Promise<Map<string, string>> => {
    let index = liveCasesByDeal.get(dealId);
    if (index === undefined) {
      index = new Map<string, string>();
      for (const existing of await deps.caseStore.byDeal(dealId)) {
        if (ACTIVE_CASE_STATUSES.has(existing.status) && !index.has(existing.missedRequirement)) {
          index.set(existing.missedRequirement, existing.id);
        }
      }
      liveCasesByDeal.set(dealId, index);
    }
    return index;
  };

  const opened: GovernanceCase[] = [];
  const deduped: DedupedRequirementCase[] = [];

  for (const finding of report.caseOpeningFindings) {
    const requirement = byId.get(finding.requirementId);
    if (requirement === undefined) {
      // The report cited a requirement absent from the provided set — fail loud
      // rather than silently drop a detected violation.
      throw new Error(
        `openCasesFromReport: case-opening finding references unknown requirement ${finding.requirementId}`,
      );
    }

    // Dedup index for this requirement's deal, including cases opened earlier in
    // THIS call (added below) — so a duplicate within one run is caught too.
    const index = await liveCasesFor(requirement.dealId);
    const existingCaseId = index.get(requirement.text);
    if (existingCaseId !== undefined) {
      deduped.push({ requirementId: requirement.id, existingCaseId });
      continue;
    }

    const governanceCase = governanceCaseForFinding(requirement, finding, {
      id: deps.idGen.next(),
      detectedAt: deps.clock.now(),
      ...(businessImpact !== undefined ? { businessImpact } : {}),
    });
    await deps.caseStore.open(governanceCase);
    opened.push(governanceCase);
    // Record it so a later finding for the same requirement on the same deal
    // dedups against the case we just opened.
    index.set(requirement.text, governanceCase.id);
  }

  return { opened, deduped, report };
}

/**
 * Grade an `AgentOutput` (a deal-level status report) against the operator's
 * requirement set and open a case for every active hard requirement it violated.
 * The common entry point for the detect phase on real agent output.
 */
export async function openCasesForAgentOutput(
  deps: OpenRequirementCasesDeps,
  requirements: readonly Requirement[],
  output: AgentOutput,
  options: OpenRequirementCasesOptions = {},
): Promise<OpenRequirementCasesResult> {
  return openCasesFromReport(deps, requirements, checkAgentOutput(requirements, output), options);
}

/**
 * Grade an `InterceptedAction` (a surface-specific action about to run) against the
 * operator's requirement set and open a case for every active hard requirement it
 * violates. The detect entry point for the live intercept / dogfood track.
 */
export async function openCasesForInterceptedAction(
  deps: OpenRequirementCasesDeps,
  requirements: readonly Requirement[],
  action: InterceptedAction,
  options: OpenRequirementCasesOptions = {},
): Promise<OpenRequirementCasesResult> {
  return openCasesFromReport(deps, requirements, checkInterceptedAction(requirements, action), options);
}
