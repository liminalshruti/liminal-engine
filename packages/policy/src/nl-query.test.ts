import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assistantReplyContract,
  type ActionPolicyRule,
  type AuditEvent,
  type ResourceAllocation,
} from "@liminal-engine/contracts";
import {
  answerQuery,
  answerQueryFromStores,
  meterSpend,
  type NlQueryContext,
  type QueryIntent,
} from "./nl-query.ts";
import type { LedgerReader, PolicyStore } from "./ports.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures — real recorded shapes (matching governance/policy-audit output)
// ─────────────────────────────────────────────────────────────────────────────

const dualApprovalRule: ActionPolicyRule = {
  id: "aprule_dual_approval",
  version: 1,
  fromCorrectionId: "ce_pr20_reject",
  evalCaseId: "ec_pr20_dual_approval",
  scope: {
    tool: "gh",
    action: "pr-merge",
    targetPattern: "PR#*",
    condition: { field: "reviews.approved", op: "<", value: 2 },
  },
  effect: {
    verdict: "deny",
    actionType: "block_agent_action",
    reasons: ["Never merge without both reviewers approving."],
    requiredBefore: ["Collect at least two approving reviews before merging."],
  },
  status: "active",
  createdAt: "2026-06-27T20:00:00.000Z",
};

/** A "policy.verdict" audit event in the exact shape governance/policy-audit writes. */
function verdictEvent(args: {
  id: string;
  recordedAt: string;
  actionId: string;
  target: string;
  verdict: "deny" | "ask";
  reasons: string[];
  sourceRuleId?: string;
}): AuditEvent {
  return {
    id: args.id,
    caseId: "gc_pr20_merge",
    dealId: "deal_policy_loop",
    action: "policy.verdict",
    decidingActor: "VP Ops / Head of AI Transformation",
    previousStatus: "at-risk",
    newStatus: "at-risk",
    recordedAt: args.recordedAt,
    beforeState: {
      interceptedAction: {
        id: args.actionId,
        tool: "gh",
        action: "pr-merge",
        target: args.target,
        args: { reviews: { approved: 1, rejected: 1 } },
        requestedAt: args.recordedAt,
      },
    },
    afterState: {
      policyVerdict: {
        verdict: args.verdict,
        allowed: false,
        reasons: args.reasons,
        requiredBeforeSend: ["Collect at least two approving reviews before merging."],
        source: args.sourceRuleId !== undefined ? "policy" : "default-deny",
        ...(args.sourceRuleId !== undefined ? { sourceRuleId: args.sourceRuleId } : {}),
      },
    },
    evidenceIds: [args.actionId, ...(args.sourceRuleId !== undefined ? [args.sourceRuleId] : [])],
  };
}

function budgetAlloc(id: string, value: number, unit: string, allocatedAt: string): ResourceAllocation {
  return {
    id: `ra_${id}`,
    workItemId: "wi_fleet",
    resourceType: unit.toUpperCase() === "USD" ? "budget" : "compute",
    ownerRole: "VP Ops / Head of AI Transformation",
    amount: { value, unit },
    status: "allocated",
    reason: "Fleet run budget.",
    constraints: [],
    allocatedAt,
  };
}

/** A resource-allocation audit event carrying a spend snapshot in afterState. */
function spendEvent(id: string, recordedAt: string, alloc: ResourceAllocation): AuditEvent {
  return {
    id,
    caseId: "gc_fleet",
    dealId: "deal_fleet",
    action: "resource.allocated",
    decidingActor: "VP Ops / Head of AI Transformation",
    previousStatus: "on-track",
    newStatus: "on-track",
    recordedAt,
    afterState: { resourceAllocation: alloc },
    evidenceIds: [alloc.id],
  };
}

function queryIntent(question: string): QueryIntent {
  return { kind: "query", confidence: 0.9, proposedBy: "llm", ratified: false, args: { question } };
}

function ctxOf(over: Partial<NlQueryContext>): NlQueryContext {
  return {
    auditEvents: [],
    policyRules: [],
    replyId: "ar_test",
    messageId: "om_test",
    now: "2026-06-28T12:00:00.000Z",
    ...over,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Case 1 — "why was X blocked?" cites the matching rule id + audit-event id
// ─────────────────────────────────────────────────────────────────────────────

test("why-was-X-blocked: cites the matching rule id AND the audit-event id", () => {
  const event = verdictEvent({
    id: "ae_pr20_verdict",
    recordedAt: "2026-06-28T10:00:00.000Z",
    actionId: "ia_pr20_merge",
    target: "PR#20",
    verdict: "deny",
    reasons: ["Held: merge had a rejecting review."],
    sourceRuleId: "aprule_dual_approval",
  });

  const reply = answerQuery(
    queryIntent("Why was PR#20 blocked?"),
    ctxOf({ auditEvents: [event], policyRules: [dualApprovalRule] }),
  );

  // grounded summary: subject, verdict, the rule, the rule's reason, the event id
  assert.match(reply.summary, /PR#20 was blocked/);
  assert.match(reply.summary, /aprule_dual_approval/);
  assert.match(reply.summary, /Never merge without both reviewers approving\./);
  assert.match(reply.summary, /ae_pr20_verdict/);
  // citations are the real ledger event id + the real rule id
  assert.deepEqual(reply.citations, ["ae_pr20_verdict", "aprule_dual_approval"]);
  assert.equal(reply.intent?.kind, "query");
  // every citation resolves to a real ledger/rule id (no fabrication)
  const realIds = new Set(["ae_pr20_verdict", "aprule_dual_approval"]);
  for (const cite of reply.citations ?? []) assert.ok(realIds.has(cite));
});

test("why-was-X-held: ask verdicts read as 'held', cite the event even without a rule", () => {
  const event = verdictEvent({
    id: "ae_pr35_verdict",
    recordedAt: "2026-06-28T10:01:00.000Z",
    actionId: "ia_pr35_merge",
    target: "PR#35",
    verdict: "ask",
    reasons: ["No active policy rule matched gh pr-merge; operator approval is required."],
  });

  const reply = answerQuery(queryIntent("Why is PR#35 held?"), ctxOf({ auditEvents: [event] }));

  assert.match(reply.summary, /PR#35 was held for operator review/);
  assert.match(reply.summary, /No active policy rule matched/);
  assert.match(reply.summary, /ae_pr35_verdict/);
  assert.deepEqual(reply.citations, ["ae_pr35_verdict"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Case 2 — "what did the fleet spend today?" returns the exact metered total
// ─────────────────────────────────────────────────────────────────────────────

test("what-did-the-fleet-spend-today: exact metered total from the ledger, citing entries", () => {
  const events = [
    spendEvent("ae_spend_0", "2026-06-27T09:00:00.000Z", budgetAlloc("0", 5000, "USD", "2026-06-27T09:00:00.000Z")),
    spendEvent("ae_spend_1", "2026-06-28T09:00:00.000Z", budgetAlloc("1", 1200, "USD", "2026-06-28T09:00:00.000Z")),
    spendEvent("ae_spend_2", "2026-06-28T11:00:00.000Z", budgetAlloc("2", 800, "USD", "2026-06-28T11:00:00.000Z")),
  ];

  const reply = answerQuery(
    queryIntent("What did the fleet spend today?"),
    ctxOf({ auditEvents: events }),
  );

  // exactly the two same-UTC-day entries: $2000 (NOT the $5000 from yesterday)
  assert.match(reply.summary, /\$2000/);
  assert.doesNotMatch(reply.summary, /5000/);
  assert.match(reply.summary, /2 ledger entries/);
  assert.deepEqual(reply.citations, ["ae_spend_1", "ae_spend_2"]);
});

test("what-did-the-fleet-spend (all time): sums every recorded entry", () => {
  const events = [
    spendEvent("ae_spend_0", "2026-06-27T09:00:00.000Z", budgetAlloc("0", 5000, "USD", "2026-06-27T09:00:00.000Z")),
    spendEvent("ae_spend_1", "2026-06-28T09:00:00.000Z", budgetAlloc("1", 1200, "USD", "2026-06-28T09:00:00.000Z")),
    spendEvent("ae_spend_2", "2026-06-28T11:00:00.000Z", budgetAlloc("2", 800, "USD", "2026-06-28T11:00:00.000Z")),
  ];

  const reply = answerQuery(queryIntent("How much has the fleet spent overall?"), ctxOf({ auditEvents: events }));

  assert.match(reply.summary, /\$7000/);
  assert.match(reply.summary, /3 ledger entries/);
  assert.deepEqual(reply.citations, ["ae_spend_0", "ae_spend_1", "ae_spend_2"]);
});

test("meterSpend groups by unit and ignores non-spend (role) allocations", () => {
  const roleAlloc: ResourceAllocation = {
    id: "ra_role",
    workItemId: "wi_fleet",
    resourceType: "role",
    ownerRole: "Security",
    status: "allocated",
    reason: "Security owner.",
    constraints: [],
    allocatedAt: "2026-06-28T08:00:00.000Z",
  };
  const events = [
    spendEvent("ae_usd", "2026-06-28T09:00:00.000Z", budgetAlloc("u", 1200, "USD", "2026-06-28T09:00:00.000Z")),
    spendEvent("ae_gpu", "2026-06-28T10:00:00.000Z", budgetAlloc("g", 40, "gpu-hours", "2026-06-28T10:00:00.000Z")),
    spendEvent("ae_role", "2026-06-28T11:00:00.000Z", roleAlloc),
  ];

  const reading = meterSpend(events);
  assert.equal(reading.entryCount, 2); // role allocation carries no metered spend
  assert.equal(reading.totals.find((t) => t.unit === "USD")?.value, 1200);
  assert.equal(reading.totals.find((t) => t.unit === "gpu-hours")?.value, 40);
  assert.deepEqual(reading.citations, ["ae_usd", "ae_gpu"]);
});

test("spend with nothing metered: honest zero, no fabricated number", () => {
  const reply = answerQuery(queryIntent("What did the fleet spend today?"), ctxOf({ auditEvents: [] }));
  assert.match(reply.summary, /don't see any metered fleet spend/);
  assert.equal(reply.citations, undefined);
  assert.doesNotMatch(reply.summary, /\$/);
});

// ─────────────────────────────────────────────────────────────────────────────
// Case 3 — an unknown question: honest "no data", NO fabricated facts
// ─────────────────────────────────────────────────────────────────────────────

test("unknown question: honest no-data, no citations, no fabricated facts", () => {
  const reply = answerQuery(
    queryIntent("What is the weather in Paris?"),
    ctxOf({ auditEvents: [verdictEvent({
      id: "ae_pr20_verdict",
      recordedAt: "2026-06-28T10:00:00.000Z",
      actionId: "ia_pr20_merge",
      target: "PR#20",
      verdict: "deny",
      reasons: ["Held."],
      sourceRuleId: "aprule_dual_approval",
    })], policyRules: [dualApprovalRule] }),
  );

  assert.match(reply.summary, /don't have an answer grounded in the audit ledger/);
  assert.equal(reply.citations, undefined);
  // no fabricated numbers / money / ids leaked into an honest no-data answer
  assert.doesNotMatch(reply.summary, /\d/);
  assert.doesNotMatch(reply.summary, /aprule_dual_approval|ae_pr20_verdict/);
});

test("blocked question with no matching held action: honest no-match, no citations", () => {
  // two held actions, but the question names neither -> refuse to guess
  const events = [
    verdictEvent({ id: "ae_a", recordedAt: "2026-06-28T10:00:00.000Z", actionId: "ia_a", target: "PR#10", verdict: "deny", reasons: ["x"], sourceRuleId: "aprule_dual_approval" }),
    verdictEvent({ id: "ae_b", recordedAt: "2026-06-28T10:01:00.000Z", actionId: "ia_b", target: "PR#11", verdict: "deny", reasons: ["y"], sourceRuleId: "aprule_dual_approval" }),
  ];
  const reply = answerQuery(queryIntent("Why was something blocked?"), ctxOf({ auditEvents: events }));
  assert.match(reply.summary, /couldn't match your question to a specific one/);
  assert.equal(reply.citations, undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// Determinism + contract validity + store-backed entry point
// ─────────────────────────────────────────────────────────────────────────────

test("answerQuery is pure + deterministic and returns a contract-valid reply", () => {
  const event = verdictEvent({
    id: "ae_pr20_verdict",
    recordedAt: "2026-06-28T10:00:00.000Z",
    actionId: "ia_pr20_merge",
    target: "PR#20",
    verdict: "deny",
    reasons: ["Held."],
    sourceRuleId: "aprule_dual_approval",
  });
  const intent = queryIntent("Why was PR#20 blocked?");
  const ctx = ctxOf({ auditEvents: [event], policyRules: [dualApprovalRule] });

  const a = answerQuery(intent, ctx);
  const b = answerQuery(intent, ctx);
  assert.deepEqual(a, b);
  // contract-valid (idempotent re-parse) — the reply hash is stable
  assert.equal(assistantReplyContract.hash(a), assistantReplyContract.hash(b));
  assert.doesNotThrow(() => assistantReplyContract.parse(a));
});

test("answerQueryFromStores pulls ledger + rules through ports and resolves identically", async () => {
  const event = verdictEvent({
    id: "ae_pr20_verdict",
    recordedAt: "2026-06-28T10:00:00.000Z",
    actionId: "ia_pr20_merge",
    target: "PR#20",
    verdict: "deny",
    reasons: ["Held."],
    sourceRuleId: "aprule_dual_approval",
  });
  const ledger: LedgerReader = { events: async () => [event] };
  const store: Pick<PolicyStore, "allRules"> = { allRules: async () => [dualApprovalRule] };

  const viaStore = await answerQueryFromStores(queryIntent("Why was PR#20 blocked?"), {
    ledger,
    store,
    replyId: "ar_test",
    messageId: "om_test",
    now: "2026-06-28T12:00:00.000Z",
  });
  const viaPure = answerQuery(
    queryIntent("Why was PR#20 blocked?"),
    ctxOf({ auditEvents: [event], policyRules: [dualApprovalRule] }),
  );
  assert.deepEqual(viaStore, viaPure);
});
