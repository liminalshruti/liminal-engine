import { test } from "node:test";
import assert from "node:assert/strict";
import {
  requirementContract,
  type Requirement,
  type AgentOutput,
  type InterceptedAction,
} from "@liminal-engine/contracts";
import { acmeAgentOutputPass1, acmeAgentOutputPass2 } from "@liminal-engine/contracts/fixtures";
import {
  checkAgentOutput,
  checkInterceptedAction,
  checkRequirements,
  agentOutputToSubject,
  REQUIREMENT_FINDING_STATUSES,
} from "./active-requirement-checker.ts";

// ── test requirement builders ────────────────────────────────────────────────

let seq = 0;
function req(overrides: Partial<Requirement> & Pick<Requirement, "text">): Requirement {
  const base = {
    id: `req_${(seq += 1)}`,
    goalId: "goal_acme_expansion",
    dealId: "deal_acme",
    ownerRole: "Security",
    severity: "hard" as const,
    scope: ["customer-facing-status-update"],
    status: "active" as const,
    createdBy: "operator" as const,
    approvedBy: "VP Ops / Head of AI Transformation",
    evidenceRefs: [],
    createdAt: "2026-06-27T09:55:00.000Z",
    activatedAt: "2026-06-27T10:05:00.000Z",
    ...overrides,
  };
  // parse through the contract so every test requirement is a valid, active record
  return requirementContract.parse(base) as Requirement;
}

const euResidency = req({
  id: "req_acme_eu_residency",
  text: "All Acme EU customer data must remain resident in EU data centers.",
  scope: ["deal-proposal", "launch-plan", "owner-assignment", "customer-facing-status-update"],
  ownerRole: "Security",
});

// statement-only requirement (no owner-assignment scope) — used for the "compliant
// output passes" and action on-track cases where the owner dimension is out of play.
const euResidencyStatusOnly = req({
  id: "req_eu_status_only",
  text: "EU data residency must be enforced for the deal.",
  scope: ["customer-facing-status-update"],
});

const ownersReq = req({
  id: "req_named_owners",
  text: "Each workstream must have a named accountable owner.",
  scope: ["owner-assignment"],
  ownerRole: "Engineering",
});

const proposedReq = req({
  id: "req_proposed_dpa",
  text: "Acme must counter-sign the Data Processing Agreement before launch.",
  status: "proposed",
  createdBy: "proposal",
  approvedBy: undefined,
  activatedAt: undefined,
});

const softReq = req({
  id: "req_comarketing",
  text: "Acme launch should ship with a joint co-marketing press release.",
  severity: "soft",
  ownerRole: "Marketing",
});

const ISO = "2026-06-27T10:00:00.000Z";

// ── acceptance criteria ───────────────────────────────────────────────────────

test("ACCEPTANCE: a missing EU-residency requirement in an on-track update is a hard fail with the requirementId", () => {
  const report = checkAgentOutput([euResidency], acmeAgentOutputPass1);

  assert.equal(report.passed, false);
  assert.equal(report.findings.length, 1);

  const finding = report.findings[0]!;
  assert.equal(finding.requirementId, "req_acme_eu_residency");
  assert.equal(finding.status, "unsupported_on_track_claim");
  assert.equal(finding.severity, "hard");
  assert.equal(finding.hardFail, true);
  assert.equal(finding.caseOpening, true);
  assert.equal(finding.matchedPhrase, "EU data residency");
  assert.match(finding.detail, /req_acme_eu_residency/);

  assert.deepEqual(report.caseOpeningFindings, [finding]);
  assert.deepEqual(report.checkedRequirementIds, ["req_acme_eu_residency"]);
});

test("ACCEPTANCE: a compliant output returns no case-opening finding", () => {
  const report = checkAgentOutput([euResidencyStatusOnly], acmeAgentOutputPass2);

  assert.equal(report.passed, true);
  assert.equal(report.caseOpeningFindings.length, 0);
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0]!.status, "satisfied");
  assert.equal(report.findings[0]!.hardFail, false);
});

test("ACCEPTANCE: proposed candidate requirements do not participate", () => {
  const report = checkAgentOutput([proposedReq], acmeAgentOutputPass1);

  assert.equal(report.findings.length, 0);
  assert.equal(report.passed, true);
  assert.deepEqual(report.skippedRequirementIds, ["req_proposed_dpa"]);
  assert.deepEqual(report.checkedRequirementIds, []);
});

test("ACCEPTANCE: the checker is pure/deterministic — identical inputs yield identical reports", () => {
  const a = checkAgentOutput([euResidency, softReq, proposedReq], acmeAgentOutputPass1);
  const b = checkAgentOutput([euResidency, softReq, proposedReq], acmeAgentOutputPass1);
  assert.deepEqual(a, b);
});

// ── classification taxonomy ────────────────────────────────────────────────────

test("rejected and retired requirements are skipped (never gate)", () => {
  const rejected = req({ id: "req_rej", text: "EU data residency.", status: "rejected", approvedBy: undefined, activatedAt: undefined });
  const retired = req({ id: "req_ret", text: "EU data residency.", status: "retired" });
  const report = checkAgentOutput([rejected, retired], acmeAgentOutputPass1);
  assert.equal(report.findings.length, 0);
  assert.deepEqual(report.skippedRequirementIds, ["req_rej", "req_ret"]);
});

test("a dropped requirement under an OFF-track status is `missing`, not an unsupported on-track claim", () => {
  const offTrackDrop: AgentOutput = { ...acmeAgentOutputPass1, reportedStatus: "at-risk" };
  const report = checkAgentOutput([euResidency], offTrackDrop);
  assert.equal(report.findings[0]!.status, "missing");
  assert.equal(report.findings[0]!.caseOpening, true);
  assert.equal(report.findings[0]!.matchedPhrase, "EU data residency");
});

test("an unmet owner/workstream obligation is `missing_owner_or_workstream`", () => {
  // pass2 honors EU residency but never names the Engineering owner → owner finding.
  const report = checkAgentOutput([ownersReq], acmeAgentOutputPass2);
  assert.equal(report.findings[0]!.status, "missing_owner_or_workstream");
  assert.equal(report.findings[0]!.caseOpening, true);
});

test("an evidenced owner role flips the owner obligation to satisfied", () => {
  const ownedOutput: AgentOutput = {
    ...acmeAgentOutputPass2,
    summary: "Engineering owns each workstream; a named accountable owner is assigned.",
  };
  const report = checkAgentOutput([ownersReq], ownedOutput);
  assert.equal(report.findings[0]!.status, "satisfied");
  assert.equal(report.passed, true);
});

test("soft requirements produce advisory findings that do not open a case", () => {
  const report = checkAgentOutput([softReq], acmeAgentOutputPass1);
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0]!.severity, "soft");
  assert.equal(report.findings[0]!.hardFail, false);
  assert.equal(report.findings[0]!.caseOpening, false);
  assert.equal(report.passed, true); // advisory only — nothing case-opening
});

test("findings preserve input order and partition checked vs skipped", () => {
  const report = checkAgentOutput([euResidency, proposedReq, softReq], acmeAgentOutputPass1);
  assert.deepEqual(
    report.findings.map((f) => f.requirementId),
    ["req_acme_eu_residency", "req_comarketing"],
  );
  assert.deepEqual(report.checkedRequirementIds, ["req_acme_eu_residency", "req_comarketing"]);
  assert.deepEqual(report.skippedRequirementIds, ["req_proposed_dpa"]);
  assert.equal(report.passed, false); // the hard EU requirement still opens a case
});

// ── intercepted actions (the live/dogfood track) ──────────────────────────────

function action(overrides: Partial<InterceptedAction> & Pick<InterceptedAction, "action">): InterceptedAction {
  return {
    id: "ia_test",
    tool: "mcp",
    target: "customer:acme",
    args: {},
    goalId: "deal_acme",
    requestedAt: ISO,
    ...overrides,
  };
}

test("an on-track customer update while a hard requirement is unaddressed → unsupported_on_track_claim", () => {
  const sendUpdate = action({ action: "send-update", args: { status: "on-track" } });
  const report = checkInterceptedAction([euResidencyStatusOnly], sendUpdate);
  assert.equal(report.subjectKind, "intercepted-action");
  assert.equal(report.at, ISO);
  assert.equal(report.findings[0]!.status, "unsupported_on_track_claim");
  assert.equal(report.passed, false);
});

test("an action that explicitly overrides a requirement is `contradicted`", () => {
  const override = action({
    action: "send-update",
    args: { status: "on-track", overrides: ["EU data residency"] },
  });
  const report = checkInterceptedAction([euResidencyStatusOnly], override);
  assert.equal(report.findings[0]!.status, "contradicted");
  assert.equal(report.findings[0]!.matchedPhrase, "EU data residency");
  assert.equal(report.findings[0]!.caseOpening, true);
});

test("an action on an unrelated surface leaves out-of-scope requirements ungraded", () => {
  const prMerge = action({ tool: "gh", action: "pr-merge", target: "PR#20", args: { reviews: { approved: 1 } } });
  const report = checkInterceptedAction([euResidencyStatusOnly], prMerge);
  assert.equal(report.findings.length, 0);
  assert.equal(report.passed, true);
  assert.deepEqual(report.skippedRequirementIds, ["req_eu_status_only"]);
});

// ── invariants ────────────────────────────────────────────────────────────────

test("every finding status is a member of the published taxonomy", () => {
  const report = checkAgentOutput([euResidency, ownersReq, softReq], acmeAgentOutputPass1);
  for (const finding of report.findings) {
    assert.ok(
      (REQUIREMENT_FINDING_STATUSES as readonly string[]).includes(finding.status),
      `unexpected status ${finding.status}`,
    );
  }
});

test("agentOutputToSubject speaks for the whole deal (surfaces = '*') and carries no wall-clock time", () => {
  const subject = agentOutputToSubject(acmeAgentOutputPass1);
  assert.equal(subject.surfaces, "*");
  assert.equal(subject.claimsOnTrack, true);
  assert.equal(subject.at, null);
  assert.deepEqual([...subject.droppedRequirements], ["EU data residency"]);
});

test("an empty active-requirement set passes vacuously", () => {
  const report = checkRequirements([], agentOutputToSubject(acmeAgentOutputPass1));
  assert.equal(report.passed, true);
  assert.equal(report.findings.length, 0);
});
