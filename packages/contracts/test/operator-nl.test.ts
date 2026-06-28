import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OPERATOR_MESSAGE_SCHEMA,
  operatorMessageContract,
  PARSED_INTENT_SCHEMA,
  parsedIntentContract,
  ASSISTANT_REPLY_SCHEMA,
  assistantReplyContract,
} from "../src/operator-nl.contract.ts";

// ── OperatorMessage ──────────────────────────────────────────────────────────
const messageFull = {
  id: "om_1",
  text: "Don't mark it done — EU data residency was dropped.",
  at: "2026-06-28T10:00:00.000Z",
  context: { currentBeat: "detect", selectedItemId: "LIM-1187" },
};
const messageMinimal = { id: "om_2", text: "What's still blocked?", at: "2026-06-28T10:01:00.000Z" };

test("OperatorMessage parses with and without context", () => {
  assert.deepEqual(operatorMessageContract.parse(messageFull), messageFull);
  assert.deepEqual(operatorMessageContract.parse(messageMinimal), messageMinimal);
});

test("OperatorMessage canonical snake_cases context and omits it when absent", () => {
  const full = operatorMessageContract.canonical(messageFull) as Record<string, unknown>;
  assert.equal(full.schema, OPERATOR_MESSAGE_SCHEMA);
  assert.deepEqual(full.context, { current_beat: "detect", selected_item_id: "LIM-1187" });
  const minimal = operatorMessageContract.canonical(messageMinimal) as Record<string, unknown>;
  assert.ok(!("context" in minimal), "absent context must be omitted from the canonical projection");
});

test("OperatorMessage requires non-empty id/text and an ISO datetime", () => {
  assert.equal(operatorMessageContract.safeParse({ ...messageMinimal, text: "" }).success, false);
  assert.equal(operatorMessageContract.safeParse({ ...messageMinimal, at: "yesterday" }).success, false);
});

// ── ParsedIntent ─────────────────────────────────────────────────────────────
const correction = {
  kind: "correction" as const,
  confidence: 0.92,
  args: { correction: "EU data residency is a hard requirement.", caseId: "gc_acme_eu" },
  proposedBy: "llm" as const,
  ratified: false,
};
const verdict = {
  kind: "verdict" as const,
  confidence: 0.8,
  args: { queueItemId: "ia_pr20_merge", decision: "disapprove" as const },
  proposedBy: "llm" as const,
  ratified: false,
};

test("ParsedIntent parses each kind with kind-correct args", () => {
  assert.deepEqual(parsedIntentContract.parse(correction), correction);
  assert.deepEqual(parsedIntentContract.parse(verdict), verdict);
  assert.equal(
    parsedIntentContract.safeParse({ kind: "navigate", confidence: 1, args: { target: "audit-ledger" }, proposedBy: "llm", ratified: true }).success,
    true,
  );
});

test("ParsedIntent.ratified defaults to false — NL is proposal-only until confirmed", () => {
  const { ratified: _omit, ...noRatified } = correction;
  const parsed = parsedIntentContract.parse(noRatified);
  assert.equal(parsed.ratified, false);
});

test("ParsedIntent kind enum is closed", () => {
  assert.equal(parsedIntentContract.safeParse({ ...correction, kind: "frobnicate" }).success, false);
});

test("ParsedIntent args are typed PER kind (cross-kind args rejected)", () => {
  // correction with verdict-shaped args must fail
  assert.equal(
    parsedIntentContract.safeParse({ kind: "correction", confidence: 0.9, args: { queueItemId: "x", decision: "approve" }, proposedBy: "llm" }).success,
    false,
  );
  // verdict with a bad decision enum must fail
  assert.equal(
    parsedIntentContract.safeParse({ ...verdict, args: { queueItemId: "x", decision: "maybe" } }).success,
    false,
  );
});

test("ParsedIntent rejects non-llm proposer and out-of-range confidence", () => {
  assert.equal(parsedIntentContract.safeParse({ ...correction, proposedBy: "human" }).success, false);
  assert.equal(parsedIntentContract.safeParse({ ...correction, confidence: 1.5 }).success, false);
});

test("ParsedIntent canonical snake_cases shared + per-kind args", () => {
  const c = parsedIntentContract.canonical(correction) as Record<string, unknown>;
  assert.equal(c.schema, PARSED_INTENT_SCHEMA);
  assert.equal(c.proposed_by, "llm");
  assert.deepEqual(c.args, { correction: "EU data residency is a hard requirement.", case_id: "gc_acme_eu" });
  const v = parsedIntentContract.canonical(verdict) as Record<string, unknown>;
  assert.deepEqual(v.args, { queue_item_id: "ia_pr20_merge", decision: "disapprove" });
});

// ── AssistantReply ───────────────────────────────────────────────────────────
const replyFull = {
  id: "ar_1",
  messageId: "om_1",
  summary: "Read as a correction on EU data residency.",
  intent: correction,
  citations: ["ae_acme_1", "gc_acme_eu"],
  at: "2026-06-28T10:00:02.000Z",
};
const replyMinimal = { id: "ar_2", messageId: "om_2", summary: "Two items are blocked.", at: "2026-06-28T10:01:02.000Z" };

test("AssistantReply parses with and without an embedded intent/citations", () => {
  assert.deepEqual(assistantReplyContract.parse(replyFull), replyFull);
  assert.deepEqual(assistantReplyContract.parse(replyMinimal), replyMinimal);
});

test("AssistantReply canonical embeds the intent projection and omits absent optionals", () => {
  const full = assistantReplyContract.canonical(replyFull) as Record<string, unknown>;
  assert.equal(full.schema, ASSISTANT_REPLY_SCHEMA);
  assert.equal(full.message_id, "om_1");
  assert.deepEqual((full.intent as Record<string, unknown>).args, {
    correction: "EU data residency is a hard requirement.",
    case_id: "gc_acme_eu",
  });
  assert.deepEqual(full.citations, ["ae_acme_1", "gc_acme_eu"]);
  const minimal = assistantReplyContract.canonical(replyMinimal) as Record<string, unknown>;
  assert.ok(!("intent" in minimal) && !("citations" in minimal), "absent intent/citations must be omitted");
});

test("AssistantReply hash is deterministic and content-addressed", () => {
  const h = assistantReplyContract.hash(replyFull);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(assistantReplyContract.hash({ ...replyFull }), h);
  assert.notEqual(assistantReplyContract.hash({ ...replyFull, summary: "different" }), h);
});
