/**
 * propose-requirements tests (LIM-1325) — the candidate-requirement inbox. Proves the
 * one property the ticket is about: an extraction suggestion stays a strictly inert
 * `proposed` candidate until an operator approves it. Every acceptance criterion:
 *   - AC1: a proposed candidate cannot appear in the active requirement query.
 *   - AC2: the checker / gate ignores proposed candidates — no blocking, no
 *          GovernanceCase, no DriftSignal (hence no eval impact).
 *   - AC3: the inbox copy uses "candidate" wording, never "policy", and never claims
 *          the item is active until approved.
 *   - AC4: given an EvidenceBundle, create zero or more `proposed` candidates with
 *          source quotes/spans; `status: proposed`, `createdBy: proposal`; shown for
 *          approve / edit / reject.
 *
 * The proof technique throughout is a PROPOSED-vs-APPROVED contrast: the same candidate
 * is inert while proposed and only governs after an operator `approve` — so the safety
 * property is the proposed→active boundary, not an accident of the fixtures.
 *
 * Tests are exempt from the boundary lint, so they may import the real in-memory
 * RequirementStore adapter and the signal-harness drift detector directly (real logic,
 * no fakes — AGENTS.md Rule 6).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evidenceBundleContract,
  requirementContract,
  sha256Hex,
  type EvidenceBundle,
  type InterceptedAction,
  type Requirement,
} from "@liminal-engine/contracts";
import { acmeAgentOutputPass1 } from "@liminal-engine/contracts/fixtures";
import { InMemoryRequirementStore } from "@liminal-engine/integration-requirement-store";
import { detectRequirementDrift } from "@liminal-engine/signal-harness";
import type { Clock, IdGen } from "./detect-miss.ts";
import { checkAgentOutput, checkInterceptedAction } from "./active-requirement-checker.ts";
import {
  describeCandidate,
  proposeAndStage,
  proposeRequirementsFromEvidence,
  stageProposals,
  type QuoteResolver,
  type StagedCandidate,
  type StageOutcome,
} from "./propose-requirements.ts";

// ── deterministic, seedable Clock + IdGen (mirrors the requirement-store test) ──

function seqIdGen(prefix = "req_"): IdGen {
  let n = 0;
  return { next: () => `${prefix}${++n}` };
}
function steppingClock(startMs = Date.UTC(2026, 5, 27, 10, 0, 0), stepMs = 60_000): Clock {
  let t = startMs;
  return {
    now: () => {
      const iso = new Date(t).toISOString();
      t += stepMs;
      return iso;
    },
  };
}
function freshStore(): InMemoryRequirementStore {
  return new InMemoryRequirementStore(steppingClock(), seqIdGen());
}

// ── an Acme-flavored EvidenceBundle whose chunk hashes commit to known quotes ───
// Quotes are the test's source material; chunk.hash = sha256Hex(quote) so the resolver
// matches the committed receipt (the bundle itself never stores the quote inline).

const Q_EU = "All Acme EU customer data must remain resident in EU data centers.";
const Q_DPA = "The parties shall counter-sign the Data Processing Agreement before any EU launch.";
const Q_OWNER = "Each EU workstream should have a named accountable owner.";
const Q_COMARKETING = "Acme may want a joint co-marketing press release at launch.";
const Q_STATUS = "Acme expansion appears on track for Friday."; // NOT an obligation → no candidate

const QUOTES: Record<string, string> = {
  ch_eu_residency_call: Q_EU,
  ch_dpa_clause: Q_DPA,
  ch_owner: Q_OWNER,
  ch_comarketing: Q_COMARKETING,
  ch_status_quo: Q_STATUS,
};

function sourceHash(sourceId: string): string {
  return sha256Hex(`source-normalized-text:${sourceId}`);
}

function acmeBundle(): EvidenceBundle {
  return evidenceBundleContract.parse({
    id: "eb_acme_candidate_inbox",
    goalId: "goal_acme_expansion",
    dealId: "deal_acme",
    sources: [
      { sourceId: "src_call", sourceType: "customer_call", title: "Acme kickoff call", hash: sourceHash("src_call"), capturedAt: "2026-06-27T09:30:00.000Z" },
      { sourceId: "src_sow", sourceType: "sow", title: "Acme SOW", hash: sourceHash("src_sow"), capturedAt: "2026-06-27T09:40:00.000Z" },
      { sourceId: "src_proposal", sourceType: "proposal", title: "Acme proposal v3", hash: sourceHash("src_proposal"), capturedAt: "2026-06-27T09:35:00.000Z" },
      { sourceId: "src_email", sourceType: "email", title: "Acme procurement thread", hash: sourceHash("src_email"), capturedAt: "2026-06-27T09:42:00.000Z" },
      { sourceId: "src_agent", sourceType: "agent_output", title: "Deal-desk agent pass 1", hash: sourceHash("src_agent"), capturedAt: "2026-06-27T09:45:00.000Z" },
    ],
    chunks: [
      { chunkId: "ch_eu_residency_call", sourceId: "src_call", span: { unit: "timecode", start: "00:12:30", end: "00:12:58" }, hash: sha256Hex(Q_EU), label: "eu-data-residency-requirement" },
      { chunkId: "ch_dpa_clause", sourceId: "src_sow", span: { unit: "section", start: "7.2", end: "7.2" }, hash: sha256Hex(Q_DPA), label: "dpa-countersign" },
      { chunkId: "ch_owner", sourceId: "src_proposal", span: { unit: "page", start: "4", end: "4" }, hash: sha256Hex(Q_OWNER), label: "named-owner" },
      { chunkId: "ch_comarketing", sourceId: "src_email", span: { unit: "char", start: "10", end: "62" }, hash: sha256Hex(Q_COMARKETING), label: "co-marketing" },
      { chunkId: "ch_status_quo", sourceId: "src_agent", span: { unit: "line", start: "1", end: "1" }, hash: sha256Hex(Q_STATUS), label: "reported-status" },
    ],
    agentOutputs: [{ agentOutputId: "ao_acme_p1", sourceId: "src_agent" }],
  });
}

/** Authorized raw-text resolver — returns the known quote per chunk. */
const resolveQuote: QuoteResolver = (chunk) => QUOTES[chunk.chunkId];

function okCandidates(outcomes: readonly StageOutcome[]): StagedCandidate[] {
  return outcomes.flatMap((o) => (o.ok ? [o.candidate] : []));
}

async function stagedFor(): Promise<{ store: InMemoryRequirementStore; candidates: StagedCandidate[] }> {
  const store = freshStore();
  const outcomes = await proposeAndStage(store, acmeBundle(), resolveQuote);
  const candidates = okCandidates(outcomes);
  assert.equal(candidates.length, outcomes.length, "every proposal staged without error");
  return { store, candidates };
}

// ── AC4: extraction → proposed candidates with source quotes/spans ──────────────

test("AC4: an EvidenceBundle yields proposed candidates (createdBy=proposal) grounded in source quotes/spans", async () => {
  const proposals = proposeRequirementsFromEvidence(acmeBundle(), resolveQuote);

  // Four obligation-bearing chunks → four candidates; the status-quo chunk yields none.
  assert.equal(proposals.length, 4);
  for (const p of proposals) {
    assert.equal(p.draft.createdBy, "proposal");
    assert.equal(p.draft.goalId, "goal_acme_expansion");
    assert.equal(p.draft.dealId, "deal_acme");
    assert.equal(p.evidence.length, 1);
    const ev = p.evidence[0]!;
    assert.ok(ev.quote.length > 0, "candidate carries the source quote");
    assert.ok(ev.span.length > 0, "candidate carries the source span");
    // the cited quote actually hashes to the evidence receipt (provenance honest)
    assert.equal(sha256Hex(ev.quote), ev.hash);
    assert.deepEqual(p.draft.evidenceRefs, [ev.sourceId]);
  }

  // the status-quo (non-obligation) chunk is not among the candidates
  assert.equal(
    proposals.some((p) => p.evidence[0]!.quote.includes("appears on track")),
    false,
    "a non-obligation span is not proposed as a requirement",
  );

  // candidates sorted by chunkId: comarketing, dpa, owner, residency
  const eu = proposals.find((p) => p.draft.text === Q_EU);
  assert.ok(eu, "EU residency candidate present");
  assert.equal(eu!.draft.severity, "hard"); // "must"
  assert.equal(eu!.draft.ownerRole, "Security");
  assert.ok(eu!.draft.scope.includes("customer-facing-status-update"));
  assert.equal(eu!.evidence[0]!.span, "00:12:30-00:12:58");
  assert.equal(eu!.evidence[0]!.sourceType, "call-transcript");

  const owner = proposals.find((p) => p.draft.text === Q_OWNER);
  assert.equal(owner!.draft.severity, "soft"); // "should"
  assert.deepEqual(owner!.draft.scope, ["owner-assignment"]);
  assert.equal(owner!.evidence[0]!.span, "p.4");
});

test("AC4: staging persists each candidate as a `proposed` requirement (createdBy=proposal, store-assigned id)", async () => {
  const { candidates } = await stagedFor();

  assert.equal(candidates.length, 4);
  for (const { requirement } of candidates) {
    assert.equal(requirement.status, "proposed");
    assert.equal(requirement.createdBy, "proposal");
    assert.equal(requirement.approvedBy, undefined);
    assert.equal(requirement.activatedAt, undefined);
    assert.match(requirement.id, /^req_\d+$/); // store-assigned, not caller-forged
    assert.equal(requirementContract.safeParse(requirement).success, true);
  }
});

test("AC4: provenance integrity — a candidate whose resolved quote ≠ committed hash is dropped", () => {
  const bundle = acmeBundle();
  // resolver returns a TAMPERED quote for the EU residency chunk (others unchanged)
  const tampering: QuoteResolver = (chunk) =>
    chunk.chunkId === "ch_eu_residency_call" ? "Tampered: residency no longer required." : QUOTES[chunk.chunkId];

  const proposals = proposeRequirementsFromEvidence(bundle, tampering);
  assert.equal(proposals.length, 3, "the mismatched-quote chunk produced no candidate");
  assert.equal(proposals.some((p) => p.draft.text.startsWith("Tampered")), false);
});

test("AC4: zero candidates when nothing in the bundle states an obligation", () => {
  const bundle = acmeBundle();
  const onlyStatus: QuoteResolver = (chunk) =>
    chunk.chunkId === "ch_status_quo" ? Q_STATUS : undefined;
  assert.deepEqual(proposeRequirementsFromEvidence(bundle, onlyStatus), []);
});

test("AC4: extraction is pure/deterministic — identical inputs yield identical candidates", () => {
  assert.deepEqual(
    proposeRequirementsFromEvidence(acmeBundle(), resolveQuote),
    proposeRequirementsFromEvidence(acmeBundle(), resolveQuote),
  );
});

test("AC4: a bundle missing a goalId requires the caller to supply one", () => {
  const dealOnly = evidenceBundleContract.parse({
    id: "eb_deal_only",
    dealId: "deal_acme",
    sources: [{ sourceId: "src_call", sourceType: "customer_call", title: "call", hash: sourceHash("src_call"), capturedAt: "2026-06-27T09:30:00.000Z" }],
    chunks: [{ chunkId: "ch_eu_residency_call", sourceId: "src_call", span: { unit: "timecode", start: "00:12:30", end: "00:12:58" }, hash: sha256Hex(Q_EU) }],
  });
  assert.throws(() => proposeRequirementsFromEvidence(dealOnly, resolveQuote), /goalId/);
  // supplying it lets extraction proceed
  const proposals = proposeRequirementsFromEvidence(dealOnly, resolveQuote, { goalId: "goal_acme_expansion" });
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0]!.draft.goalId, "goal_acme_expansion");
});

test("AC4: a staged candidate supports the full approve / edit / reject operator actions", async () => {
  const { store, candidates } = await stagedFor();
  assert.equal(candidates.length, 4);
  const [a, b, c] = candidates;

  // edit (amend) — refine the suggestion while it stays a proposed candidate
  const edited = await store.amend(a!.requirement.id, { ownerRole: "Legal", text: "Edited candidate text." });
  assert.equal(edited.ok, true);
  if (edited.ok) {
    assert.equal(edited.value.status, "proposed");
    assert.equal(edited.value.ownerRole, "Legal");
  }

  // reject — decline the candidate; it never governs
  const rejected = await store.reject(b!.requirement.id);
  assert.equal(rejected.ok && rejected.value.status, "rejected");

  // approve — the operator accepts; only now is it active
  const approved = await store.approve(c!.requirement.id, "VP Ops / Head of AI Transformation");
  assert.equal(approved.ok && approved.value.status, "active");

  // the active query reflects exactly the approved one — edited/rejected candidates excluded
  const active = await store.activeByDeal("deal_acme");
  assert.equal(active.ok, true);
  if (active.ok) assert.deepEqual(active.value.map((r) => r.id), [c!.requirement.id]);
});

// ── AC1: a proposed candidate never appears in the active requirement query ─────

test("AC1: proposed candidates are absent from every active requirement query", async () => {
  const { store, candidates } = await stagedFor();
  const ids = new Set(candidates.map((c) => c.requirement.id));

  const byDeal = await store.activeByDeal("deal_acme");
  assert.equal(byDeal.ok, true);
  if (byDeal.ok) assert.deepEqual(byDeal.value, [], "no proposed candidate governs the deal");

  const byGoal = await store.activeByGoal("goal_acme_expansion");
  assert.equal(byGoal.ok && byGoal.value.length, 0, "no proposed candidate governs the goal");

  // none of the candidates' own scope surfaces surface them as active either
  for (const surface of new Set(candidates.flatMap((c) => c.requirement.scope))) {
    const byScope = await store.activeByScope(surface);
    assert.equal(byScope.ok, true);
    if (byScope.ok) {
      assert.equal(
        byScope.value.some((r) => ids.has(r.id)),
        false,
        `proposed candidate must not surface as active on "${surface}"`,
      );
    }
  }
});

test("AC1: operator approval is the ONLY thing that moves a candidate into the active query", async () => {
  const { store, candidates } = await stagedFor();
  const eu = candidates.find((c) => c.requirement.text === Q_EU)!;

  // before approval: absent
  const before = await store.activeByDeal("deal_acme");
  assert.equal(before.ok && before.value.length, 0);

  const approved = await store.approve(eu.requirement.id, "VP Ops / Head of AI Transformation");
  assert.equal(approved.ok, true);

  // after approval: present (and only that one)
  const after = await store.activeByDeal("deal_acme");
  assert.equal(after.ok, true);
  if (after.ok) {
    assert.deepEqual(after.value.map((r) => r.id), [eu.requirement.id]);
    assert.equal(after.value[0]!.status, "active");
  }
});

// ── AC2: the checker / gate ignore proposed candidates (no block / case / eval) ─

const onTrackUpdate: InterceptedAction = {
  id: "ia_acme_update",
  tool: "mcp",
  target: "customer:acme",
  action: "send-update",
  args: { status: "on-track" },
  goalId: "deal_acme",
  requestedAt: "2026-06-27T10:30:00.000Z",
};

test("AC2: the active-requirement checker SKIPS proposed candidates — no case-opening finding", async () => {
  const { candidates } = await stagedFor();
  const proposed: Requirement[] = candidates.map((c) => c.requirement);

  // an on-track status report that drops EU residency would normally open a case —
  // but against PROPOSED candidates the checker grades nothing.
  const report = checkAgentOutput(proposed, acmeAgentOutputPass1);
  assert.equal(report.passed, true, "no case-opening finding ⇒ the subject is not blocked");
  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.caseOpeningFindings, []);
  assert.deepEqual(report.checkedRequirementIds, []);
  assert.deepEqual(
    [...report.skippedRequirementIds].sort(),
    [...proposed.map((r) => r.id)].sort(),
    "every proposed candidate is skipped (and auditable as skipped)",
  );

  // the same holds for an intercepted live action (the dogfood gate path)
  const actionReport = checkInterceptedAction(proposed, onTrackUpdate);
  assert.equal(actionReport.passed, true);
  assert.deepEqual(actionReport.findings, []);
});

test("AC2: proposed candidates produce no DriftSignal — so they reach no resource allocation or eval", async () => {
  const { candidates } = await stagedFor();
  const proposed: Requirement[] = candidates.map((c) => c.requirement);

  const signals = detectRequirementDrift({
    agentOutput: acmeAgentOutputPass1,
    requirements: proposed,
    observedAt: "2026-06-27T10:31:00.000Z",
  });
  assert.deepEqual(signals, [], "no proposed candidate emits a drift signal");
});

test("AC2: the SAME candidate governs only after approval (proposed inert ⇒ active blocks) — the contrast proof", async () => {
  const { store, candidates } = await stagedFor();
  const eu = candidates.find((c) => c.requirement.text === Q_EU)!;

  // proposed: inert on every downstream surface
  const proposedReport = checkAgentOutput([eu.requirement], acmeAgentOutputPass1);
  assert.equal(proposedReport.passed, true);
  assert.deepEqual(proposedReport.caseOpeningFindings, []);
  assert.deepEqual(
    detectRequirementDrift({ agentOutput: acmeAgentOutputPass1, requirements: [eu.requirement], observedAt: "2026-06-27T10:31:00.000Z" }),
    [],
  );

  // operator approves → identical requirement, now active
  const approved = await store.approve(eu.requirement.id, "Security");
  assert.equal(approved.ok, true);
  const active = approved.ok ? approved.value : undefined;
  assert.ok(active && active.status === "active");

  // active: the checker now opens a case-opening finding AND drift fires — proving the
  // proposed version was inert purely because of its status, nothing else.
  const activeReport = checkAgentOutput([active!], acmeAgentOutputPass1);
  assert.equal(activeReport.passed, false);
  assert.equal(activeReport.caseOpeningFindings.length, 1);
  assert.equal(activeReport.caseOpeningFindings[0]!.requirementId, active!.id);

  const activeSignals = detectRequirementDrift({
    agentOutput: acmeAgentOutputPass1,
    requirements: [active!],
    observedAt: "2026-06-27T10:31:00.000Z",
  });
  assert.equal(activeSignals.length, 1);
});

// ── AC3: candidate-framed inbox copy (not policy, not active) ────────────────────

test("AC3: the inbox copy frames the item as a CANDIDATE — never policy, never active", async () => {
  const { candidates } = await stagedFor();
  const view = describeCandidate(candidates.find((c) => c.requirement.text === Q_EU)!);

  assert.equal(view.kind, "requirement-candidate");
  assert.equal(view.badge.label, "Candidate");
  assert.ok(view.title.startsWith("Candidate:"), `title leads with Candidate: ${view.title}`);
  assert.deepEqual(view.actions, ["approve", "edit", "reject"]);

  // the source quote/span are shown in the inbox row
  assert.equal(view.evidence.length, 1);
  assert.equal(view.evidence[0]!.span, "00:12:30-00:12:58");
  assert.ok(view.evidence[0]!.quote.includes("EU data centers"));

  const copy = [view.title, view.statusLabel, view.note, view.ownerLabel, view.severityLabel, view.badge.label].join(" • ");
  assert.match(copy, /candidate/i, "copy frames the item as a candidate");
  assert.doesNotMatch(copy, /\bpolicy\b/i, "copy never calls a candidate a policy");
  assert.doesNotMatch(copy, /\bactive\b/i, "copy never claims the candidate is active");
});

// ── staging error surface (representable, never thrown) ──────────────────────────

test("staging a duplicate id surfaces a representable error without losing other candidates", async () => {
  // an IdGen that collides on the 2nd create forces a `duplicate` on one proposal
  let n = 0;
  const collidingIdGen: IdGen = { next: () => `req_${++n === 2 ? 1 : n}` };
  const store = new InMemoryRequirementStore(steppingClock(), collidingIdGen);

  const proposals = proposeRequirementsFromEvidence(acmeBundle(), resolveQuote);
  const outcomes = await stageProposals(store, proposals);

  assert.equal(outcomes.length, 4);
  const failed = outcomes.filter((o) => !o.ok);
  assert.equal(failed.length, 1);
  assert.equal(failed[0]!.ok, false);
  if (!failed[0]!.ok) assert.equal(failed[0]!.error.code, "duplicate");
  // the other three still staged as proposed candidates
  assert.equal(okCandidates(outcomes).length, 3);
});
