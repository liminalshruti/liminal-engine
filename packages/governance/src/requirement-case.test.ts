/**
 * requirement-case tests — LIM-1327: open a GovernanceCase from ACTIVE requirement
 * violations. Each acceptance criterion + guardrail is asserted directly:
 *
 *   AC1  active EU-residency missing            → exactly one blocking GovernanceCase
 *   AC2  proposed EU-residency candidate        → no GovernanceCase
 *   AC3  good (compliant) output                → no GovernanceCase
 *   AC4  case body cites the requirement + its source evidence, not generic prose
 *   G1   proposed / rejected / retired requirements never open a case
 *   G2   no duplicate cases for the same active requirement / run
 *
 * Tests are exempt from the boundary lint, so they may import the in-memory store
 * adapter. Determinism: ids + timestamps come from injected test generators.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  requirementContract,
  governanceCaseContract,
  type Requirement,
  type InterceptedAction,
} from "@liminal-engine/contracts";
import { acmeAgentOutputPass1, acmeAgentOutputPass2 } from "@liminal-engine/contracts/fixtures";
import { InMemoryGovernanceCaseStore } from "@liminal-engine/integration-governance-case-store";
import type { Clock, IdGen } from "./detect-miss.ts";
import { checkAgentOutput } from "./active-requirement-checker.ts";
import {
  openCasesForAgentOutput,
  openCasesForInterceptedAction,
  openCasesFromReport,
  governanceCaseForFinding,
  type OpenRequirementCasesDeps,
} from "./requirement-case.ts";

// ── deterministic test seams ─────────────────────────────────────────────────

function testClock(at = "2026-06-27T10:00:00.000Z"): Clock {
  return { now: () => at };
}
function testIdGen(prefix = "gc_test"): IdGen {
  let n = 0;
  return { next: () => `${prefix}_${(n += 1)}` };
}
function deps(caseStore = new InMemoryGovernanceCaseStore()): OpenRequirementCasesDeps & {
  caseStore: InMemoryGovernanceCaseStore;
} {
  return { caseStore, clock: testClock(), idGen: testIdGen() };
}

// ── requirement builders (parsed through the contract → valid + active) ───────

let seq = 0;
function req(overrides: Partial<Requirement> & Pick<Requirement, "text">): Requirement {
  return requirementContract.parse({
    id: `req_${(seq += 1)}`,
    goalId: "goal_acme_expansion",
    dealId: "deal_acme",
    ownerRole: "Security",
    severity: "hard",
    scope: ["customer-facing-status-update"],
    status: "active",
    createdBy: "operator",
    approvedBy: "VP Ops / Head of AI Transformation",
    evidenceRefs: [],
    createdAt: "2026-06-27T09:55:00.000Z",
    activatedAt: "2026-06-27T10:05:00.000Z",
    ...overrides,
  }) as Requirement;
}

// The active, load-bearing EU-residency requirement, grounded in two source receipts.
function euResidency(): Requirement {
  return req({
    id: "req_acme_eu_residency",
    text: "All Acme EU customer data must remain resident in EU data centers.",
    scope: ["deal-proposal", "launch-plan", "owner-assignment", "customer-facing-status-update"],
    ownerRole: "Security",
    evidenceRefs: ["call_acme_kickoff", "dpa_acme_v3"],
  });
}

// A status-only EU requirement (no owner-assignment scope) — used where the owner
// dimension is out of play (so a compliant pass-2 output fully satisfies it).
function euResidencyStatusOnly(): Requirement {
  return req({
    id: "req_eu_status_only",
    text: "EU data residency must be enforced for the deal.",
    scope: ["customer-facing-status-update"],
    evidenceRefs: ["call_acme_kickoff"],
  });
}

const DEAL = "deal_acme";

function action(overrides: Partial<InterceptedAction> & Pick<InterceptedAction, "action">): InterceptedAction {
  return {
    id: "ia_test",
    tool: "mcp",
    target: "customer:acme",
    args: {},
    goalId: DEAL,
    requestedAt: "2026-06-27T10:00:00.000Z",
    ...overrides,
  };
}

// ── AC1: active EU-residency missing → one blocking GovernanceCase ────────────

test("AC1: an active EU-residency requirement missing from a false-green output opens exactly one blocking case", async () => {
  const d = deps();
  const result = await openCasesForAgentOutput(d, [euResidency()], acmeAgentOutputPass1);

  assert.equal(result.opened.length, 1, "exactly one case");
  const gc = result.opened[0]!;
  assert.equal(gc.dealId, DEAL);
  assert.equal(gc.severity, "blocking");
  assert.equal(gc.status, "open");
  assert.equal(result.deduped.length, 0);

  // persisted through the port
  const stored = await d.caseStore.byDeal(DEAL);
  assert.deepEqual(stored, [gc], "the opened case is persisted to the store");
});

// ── AC2: proposed EU-residency candidate → no GovernanceCase ──────────────────

test("AC2: a PROPOSED EU-residency candidate opens no case (an unapproved candidate never gates)", async () => {
  const proposed = req({
    id: "req_proposed_eu",
    text: "All Acme EU customer data must remain resident in EU data centers.",
    status: "proposed",
    createdBy: "proposal",
    approvedBy: undefined,
    activatedAt: undefined,
    evidenceRefs: ["call_acme_kickoff"],
  });
  const d = deps();
  const result = await openCasesForAgentOutput(d, [proposed], acmeAgentOutputPass1);

  assert.equal(result.opened.length, 0, "no case for a proposed candidate");
  assert.deepEqual(result.report.skippedRequirementIds, ["req_proposed_eu"]);
  assert.deepEqual(await d.caseStore.byDeal(DEAL), [], "nothing persisted");
});

// ── AC3: good output → no GovernanceCase ──────────────────────────────────────

test("AC3: a compliant (good) output that satisfies the active requirement opens no case", async () => {
  const d = deps();
  const result = await openCasesForAgentOutput(d, [euResidencyStatusOnly()], acmeAgentOutputPass2);

  assert.equal(result.report.passed, true);
  assert.equal(result.opened.length, 0, "a satisfied requirement opens no case");
  assert.deepEqual(await d.caseStore.byDeal(DEAL), []);
});

test("AC3: a good output that also names the required owner satisfies an owner-scoped requirement → no case", async () => {
  const ownedOutput = {
    ...acmeAgentOutputPass2,
    summary:
      "Acme expansion re-run: EU data residency enforced; Security owns each workstream with a named accountable owner.",
  };
  const owners = req({
    id: "req_named_owners",
    text: "Each workstream must have a named accountable owner.",
    scope: ["owner-assignment"],
    ownerRole: "Security",
  });
  const d = deps();
  const result = await openCasesForAgentOutput(d, [owners], ownedOutput);
  assert.equal(result.opened.length, 0);
  assert.equal(result.report.passed, true);
});

// ── AC4: the case body cites the requirement + source evidence, not generic prose ─

test("AC4: the opened case cites the requirement verbatim and its source evidence — not generic prose", async () => {
  const requirement = euResidency();
  const d = deps();
  const result = await openCasesForAgentOutput(d, [requirement], acmeAgentOutputPass1, {
    evidence: { businessImpact: "$1.2M Acme expansion at risk" },
  });

  const gc = result.opened[0]!;

  // cites the requirement: its EXACT authored statement, not a short generic label
  assert.equal(gc.missedRequirement, requirement.text);
  assert.notEqual(gc.missedRequirement, "EU data residency", "not the generic short label");
  assert.ok(gc.missedRequirement.length > "EU data residency".length);

  // cites the SOURCE EVIDENCE: the requirement's grounding receipts
  assert.deepEqual(gc.evidenceIds, ["call_acme_kickoff", "dpa_acme_v3"]);

  // where it is missing: the surfaces the requirement governs (specific, not generic)
  assert.deepEqual(gc.missingFrom, [
    "deal-proposal",
    "launch-plan",
    "owner-assignment",
    "customer-facing-status-update",
  ]);

  // the violation kind is specific, not a generic bucket
  assert.equal(gc.category, "unsupported-on-track-claim");

  // injected business impact is carried through
  assert.equal(gc.businessImpact, "$1.2M Acme expansion at risk");

  // recommended actions are requirement-anchored (cite the requirement id), not boilerplate
  assert.ok(gc.recommendedActions && gc.recommendedActions.length > 0);
  for (const a of gc.recommendedActions!) {
    assert.match(a, /req_acme_eu_residency/, `recommended action should cite the requirement id: ${a}`);
  }

  // the case as a whole references both the requirement id and a source-evidence id
  const body = JSON.stringify(gc);
  assert.ok(body.includes("req_acme_eu_residency"), "case cites the requirement id");
  assert.ok(body.includes("call_acme_kickoff"), "case cites a source-evidence id");

  // and it round-trips through the GovernanceCase contract (a valid, hashable record)
  assert.doesNotThrow(() => governanceCaseContract.parse(gc));
});

test("AC4: with no injected evidence the case stays minimal (no fabricated businessImpact prose)", async () => {
  const requirement = euResidency();
  const d = deps();
  const gc = (await openCasesForAgentOutput(d, [requirement], acmeAgentOutputPass1)).opened[0]!;
  assert.equal(gc.businessImpact, undefined, "no generic business-impact prose is fabricated");
  // still cites the requirement + evidence
  assert.equal(gc.missedRequirement, requirement.text);
  assert.deepEqual(gc.evidenceIds, requirement.evidenceRefs);
});

// ── G1: proposed / rejected / retired requirements never open a case ──────────

test("G1: rejected and retired requirements never open a case", async () => {
  const rejected = req({
    id: "req_rejected",
    text: "All Acme EU customer data must remain resident in EU data centers.",
    status: "rejected",
    createdBy: "proposal",
    approvedBy: undefined,
    activatedAt: undefined,
  });
  const retired = req({
    id: "req_retired",
    text: "All Acme EU customer data must remain resident in EU data centers.",
    status: "retired",
  });
  const d = deps();
  const result = await openCasesForAgentOutput(d, [rejected, retired], acmeAgentOutputPass1);
  assert.equal(result.opened.length, 0);
  assert.deepEqual(result.report.skippedRequirementIds, ["req_rejected", "req_retired"]);
  assert.deepEqual(await d.caseStore.byDeal(DEAL), []);
});

test("G1: a soft active requirement produces an advisory finding but opens no case", async () => {
  const soft = req({
    id: "req_soft",
    text: "Acme launch should ship with a joint co-marketing press release.",
    severity: "soft",
    ownerRole: "Marketing",
  });
  const d = deps();
  const result = await openCasesForAgentOutput(d, [soft], acmeAgentOutputPass1);
  assert.equal(result.opened.length, 0, "soft requirements never open a case");
  assert.equal(result.report.findings.length, 1, "but it is still graded (advisory)");
});

// ── G2: no duplicate cases for the same active requirement / run ──────────────

test("G2: re-running detection over the same subject opens no duplicate case", async () => {
  const requirement = euResidency();
  const caseStore = new InMemoryGovernanceCaseStore();
  const d: OpenRequirementCasesDeps = { caseStore, clock: testClock(), idGen: testIdGen() };

  const first = await openCasesForAgentOutput(d, [requirement], acmeAgentOutputPass1);
  assert.equal(first.opened.length, 1);

  const second = await openCasesForAgentOutput(d, [requirement], acmeAgentOutputPass1);
  assert.equal(second.opened.length, 0, "the second run opens nothing new");
  assert.equal(second.deduped.length, 1);
  assert.equal(second.deduped[0]!.requirementId, "req_acme_eu_residency");
  assert.equal(second.deduped[0]!.existingCaseId, first.opened[0]!.id);

  assert.equal((await caseStore.byDeal(DEAL)).length, 1, "the store still holds exactly one case");
});

test("G2: the same requirement appearing twice in one run opens only one case", async () => {
  const requirement = euResidency();
  // same requirement object listed twice → the checker grades it twice → two
  // case-opening findings with the same requirement id; only one case may open.
  const report = checkAgentOutput([requirement, requirement], acmeAgentOutputPass1);
  assert.equal(report.caseOpeningFindings.length, 2, "two findings for the duplicated requirement");

  const d = deps();
  const result = await openCasesFromReport(d, [requirement], report);
  assert.equal(result.opened.length, 1, "only one case opens for the duplicated requirement");
  assert.equal(result.deduped.length, 1);
  assert.equal((await d.caseStore.byDeal(DEAL)).length, 1);
});

test("G2: a case already CORRECTED for a requirement is still a duplicate (no re-open)", async () => {
  const requirement = euResidency();
  const caseStore = new InMemoryGovernanceCaseStore();
  const d: OpenRequirementCasesDeps = { caseStore, clock: testClock(), idGen: testIdGen() };

  const first = await openCasesForAgentOutput(d, [requirement], acmeAgentOutputPass1);
  await caseStore.correct(first.opened[0]!.id); // case moved to `corrected`

  const second = await openCasesForAgentOutput(d, [requirement], acmeAgentOutputPass1);
  assert.equal(second.opened.length, 0, "a corrected case still blocks a duplicate");
  assert.equal(second.deduped.length, 1);
  assert.equal((await caseStore.byDeal(DEAL)).length, 1);
});

// ── distinct requirements + intercepted-action path + determinism ─────────────

test("distinct active requirements each open their own case, citing their own requirement", async () => {
  const a = euResidency();
  const b = req({
    id: "req_dpa_countersign",
    text: "Acme must counter-sign the Data Processing Agreement before customer updates.",
    scope: ["customer-facing-status-update"],
    ownerRole: "Legal",
    evidenceRefs: ["dpa_acme_v3"],
  });
  // an output that drops BOTH requirements on an on-track claim
  const dropsBoth = {
    ...acmeAgentOutputPass1,
    droppedRequirements: ["EU data residency", "Data Processing Agreement counter-sign"],
  };
  const d = deps();
  const result = await openCasesForAgentOutput(d, [a, b], dropsBoth);

  assert.equal(result.opened.length, 2);
  const byRequirement = new Map(result.opened.map((c) => [c.missedRequirement, c] as const));
  assert.ok(byRequirement.has(a.text));
  assert.ok(byRequirement.has(b.text));
  assert.deepEqual(byRequirement.get(a.text)!.evidenceIds, ["call_acme_kickoff", "dpa_acme_v3"]);
  assert.deepEqual(byRequirement.get(b.text)!.evidenceIds, ["dpa_acme_v3"]);
});

test("intercepted-action path: an on-track customer update violating an active requirement opens a case", async () => {
  const sendUpdate = action({ action: "send-update", args: { status: "on-track" } });
  const d = deps();
  const result = await openCasesForInterceptedAction(d, [euResidencyStatusOnly()], sendUpdate);

  assert.equal(result.opened.length, 1);
  assert.equal(result.opened[0]!.severity, "blocking");
  assert.equal(result.opened[0]!.category, "unsupported-on-track-claim");
  assert.equal(result.opened[0]!.dealId, DEAL);
});

test("intercepted-action path: an explicit override is recorded as a contradicted-requirement case", async () => {
  const override = action({
    action: "send-update",
    args: { status: "on-track", overrides: ["EU data residency"] },
  });
  const d = deps();
  const result = await openCasesForInterceptedAction(d, [euResidencyStatusOnly()], override);
  assert.equal(result.opened.length, 1);
  assert.equal(result.opened[0]!.category, "requirement-contradicted");
});

test("an action on an unrelated surface (out of scope) opens no case", async () => {
  const prMerge = action({ tool: "gh", action: "pr-merge", target: "PR#20", args: { reviews: { approved: 1 } } });
  const d = deps();
  const result = await openCasesForInterceptedAction(d, [euResidencyStatusOnly()], prMerge);
  assert.equal(result.opened.length, 0);
  assert.deepEqual(result.report.skippedRequirementIds, ["req_eu_status_only"]);
});

test("deterministic: identical inputs over fresh stores yield byte-identical opened cases", async () => {
  const reqs = [euResidency()];
  const a = await openCasesForAgentOutput(deps(), reqs, acmeAgentOutputPass1);
  const b = await openCasesForAgentOutput(deps(), reqs, acmeAgentOutputPass1);
  assert.deepEqual(a.opened, b.opened);
});

test("an empty active-requirement set opens nothing", async () => {
  const d = deps();
  const result = await openCasesForAgentOutput(d, [], acmeAgentOutputPass1);
  assert.equal(result.opened.length, 0);
  assert.equal(result.report.findings.length, 0);
});

// ── mapper misuse guards (never silently mis-attribute a violation) ───────────

test("governanceCaseForFinding throws on a non-case-opening finding", () => {
  const soft = req({ id: "req_soft2", text: "Soft advisory.", severity: "soft", ownerRole: "Marketing" });
  const report = checkAgentOutput([soft], acmeAgentOutputPass1);
  const finding = report.findings[0]!;
  assert.equal(finding.caseOpening, false);
  assert.throws(
    () => governanceCaseForFinding(soft, finding, { id: "x", detectedAt: "2026-06-27T10:00:00.000Z" }),
    /not case-opening/,
  );
});

test("governanceCaseForFinding throws on a finding/requirement mismatch", () => {
  const a = euResidency();
  const report = checkAgentOutput([a], acmeAgentOutputPass1);
  const finding = report.caseOpeningFindings[0]!;
  const other = euResidencyStatusOnly();
  assert.throws(
    () => governanceCaseForFinding(other, finding, { id: "x", detectedAt: "2026-06-27T10:00:00.000Z" }),
    /but requirement is/,
  );
});

test("openCasesFromReport throws if a case-opening finding references an unknown requirement", async () => {
  const a = euResidency();
  const report = checkAgentOutput([a], acmeAgentOutputPass1);
  // pass a requirement set MISSING the graded requirement
  await assert.rejects(
    () => openCasesFromReport(deps(), [], report),
    /unknown requirement/,
  );
});
