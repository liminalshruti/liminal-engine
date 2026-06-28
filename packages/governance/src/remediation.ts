/**
 * remediation — the enforce-phase use case that turns an APPROVED hard active
 * `Requirement` violation into Linear remediation issue(s) (LIM-1335).
 *
 * WHERE IT SITS IN THE LOOP: detect (`active-requirement-checker`) opens a
 * GovernanceCase on a hard, non-satisfied requirement; the operator approves +
 * enforces (`approve-enforce`); THEN this use case files the remediation work so
 * the correction has an owner and a paper trail. It runs over the
 * `RemediationIssueClient` PORT only — never a concrete adapter — so the demo
 * spine stays deterministic (dry-run/simulated) and a live Linear adapter is
 * swapped in ONLY at the composition root (the fixtures-before-integrations rule;
 * the spine must not import `@liminal-engine/integration-linear`).
 *
 * It PRESERVES the Product / Security / Engineering owner-requirement semantics of
 * the simulated remediation workstream: one remediation issue per required
 * workstream owner role, in order, plus the requirement's own accountable owner if
 * the workstream omitted it. `accountableOwner` marks the issue whose owner is the
 * violated requirement's own owning role.
 *
 * HARD CONSTRAINTS:
 *  - Pure / deterministic. The same inputs always yield byte-identical payloads
 *    (no Date.now(), no Math.random()) so the payload is a reproducible receipt a
 *    dry-run can print byte-for-byte.
 *  - FAIL CLOSED on a bad precondition: it refuses to file remediation for a
 *    non-active or non-hard requirement (only hard active requirements gate —
 *    mirrors the active-requirement-checker's case-opening rule).
 *  - Every payload carries the load-bearing trace (`requirementId`,
 *    `governanceCaseId`, `ownerRole`, `evidenceRefs`), never a vague summary.
 */
import {
  linearRemediationIssueContract,
  type Requirement,
  type LinearRemediationIssuePayload,
} from "@liminal-engine/contracts";
import type { RemediationIssueClient, RemediationIssueResult } from "./ports.ts";

/** The inputs that drive remediation for one approved hard active requirement violation. */
export interface RemediationInput {
  /** the violated requirement — MUST be `active` + `hard` (validated, fail-closed). */
  readonly requirement: Requirement;
  /** the `GovernanceCase.id` that detected the violation. */
  readonly governanceCaseId: string;
  /**
   * the owner roles the remediation workstream requires (Product / Security /
   * Engineering) — typically `LinearWorkstreamPanel.requiredOwners()`. One
   * remediation issue is produced per role, in order; the requirement's own
   * `ownerRole` is appended if the workstream omitted it.
   */
  readonly requiredOwners: readonly string[];
}

/** Why remediation could not be filed — a precondition the caller violated. */
export type RemediationErrorCode = "not_active" | "not_hard" | "no_owners";

/**
 * Thrown when remediation is requested for a requirement that does not qualify
 * (not active / not hard) or with no owners to assign. A representable, typed
 * failure so the caller cannot silently file remediation for something that should
 * never gate (fail-closed at the use-case boundary).
 */
export class RemediationPreconditionError extends Error {
  readonly code: RemediationErrorCode;
  constructor(code: RemediationErrorCode, message: string) {
    super(message);
    this.name = "RemediationPreconditionError";
    this.code = code;
  }
}

/** case-insensitive equality on a trimmed role name. */
function sameRole(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** dedupe role names case-insensitively, keeping first-seen order + casing. */
function dedupeRoles(roles: readonly string[]): string[] {
  const seen: string[] = [];
  for (const role of roles) {
    const trimmed = role.trim();
    if (trimmed.length === 0) continue;
    if (!seen.some((kept) => sameRole(kept, trimmed))) seen.push(trimmed);
  }
  return seen;
}

function remediationTitle(requirement: Requirement, ownerRole: string): string {
  return `[Remediation] ${requirement.text} — ${ownerRole}`;
}

function remediationLabels(requirement: Requirement, ownerRole: string): string[] {
  return ["remediation", "governance", `severity:${requirement.severity}`, `owner:${ownerRole}`];
}

function remediationDescription(
  requirement: Requirement,
  governanceCaseId: string,
  ownerRole: string,
  accountableOwner: boolean,
): string {
  const evidence =
    requirement.evidenceRefs.length > 0 ? requirement.evidenceRefs.join(", ") : "none recorded";
  return [
    "Liminal Engine governance loop filed this remediation on enforcement of a violated hard active requirement.",
    "",
    `Requirement (${requirement.id}): ${requirement.text}`,
    `Owner role: ${ownerRole}${accountableOwner ? " (accountable owner)" : ""}`,
    `Deal: ${requirement.dealId}`,
    `GovernanceCase: ${governanceCaseId}`,
    `Severity: ${requirement.severity}`,
    `Scope: ${requirement.scope.join(", ")}`,
    `Evidence: ${evidence}`,
  ].join("\n");
}

/**
 * Build the deterministic remediation issue payload(s) for an APPROVED hard active
 * requirement violation. One payload per required owner role (Product / Security /
 * Engineering …), in order, plus the requirement's own accountable owner if the
 * workstream omitted it. Throws `RemediationPreconditionError` if the requirement
 * is not active or not hard (fail-closed), or if no owners can be assigned.
 *
 * Every returned payload is re-parsed through `linearRemediationIssueContract` so a
 * malformed payload can never escape the use case to the live adapter.
 */
export function buildRemediationIssues(input: RemediationInput): LinearRemediationIssuePayload[] {
  const { requirement, governanceCaseId } = input;

  if (requirement.status !== "active") {
    throw new RemediationPreconditionError(
      "not_active",
      `requirement ${requirement.id} is ${requirement.status}, not active — only active requirements file remediation`,
    );
  }
  if (requirement.severity !== "hard") {
    throw new RemediationPreconditionError(
      "not_hard",
      `requirement ${requirement.id} is ${requirement.severity}, not hard — only hard violations file remediation`,
    );
  }

  // Preserve the Product/Security/Engineering owner-requirement semantics: one
  // issue per required workstream owner, in order, plus the requirement's own
  // accountable owner if the workstream did not already include it.
  const owners = dedupeRoles([...input.requiredOwners, requirement.ownerRole]);
  if (owners.length === 0) {
    throw new RemediationPreconditionError(
      "no_owners",
      `requirement ${requirement.id} has no remediation owners (requiredOwners empty and ownerRole blank)`,
    );
  }

  return owners.map((ownerRole) => {
    const accountableOwner = sameRole(ownerRole, requirement.ownerRole);
    const payload: LinearRemediationIssuePayload = {
      title: remediationTitle(requirement, ownerRole),
      requirementId: requirement.id,
      governanceCaseId,
      dealId: requirement.dealId,
      ownerRole,
      accountableOwner,
      severity: requirement.severity,
      evidenceRefs: [...requirement.evidenceRefs],
      description: remediationDescription(requirement, governanceCaseId, ownerRole, accountableOwner),
      labels: remediationLabels(requirement, ownerRole),
    };
    // Parse through the contract so a malformed payload never reaches the adapter.
    return linearRemediationIssueContract.parse(payload);
  });
}

/**
 * File the remediation issue(s) for an approved hard active requirement violation
 * through the `RemediationIssueClient` port, in owner order. Returns one result per
 * issue (dry-run prints the exact payload without writing; live creates a real
 * issue). The application depends on the PORT only — the concrete adapter (dry-run
 * or live Linear) is injected at the composition root.
 */
export async function fileRemediationIssues(
  input: RemediationInput,
  client: RemediationIssueClient,
): Promise<RemediationIssueResult[]> {
  const payloads = buildRemediationIssues(input);
  const results: RemediationIssueResult[] = [];
  for (const payload of payloads) {
    results.push(await client.create(payload));
  }
  return results;
}
