/**
 * Operator natural-language contracts — the typed shape of one operator NL turn in
 * the cockpit (LIM-1340, epic LIM-1266/LIM-1338). Three contracts:
 *
 *   OperatorMessage — what the operator typed (+ optional UI context).
 *   ParsedIntent    — the LLM's structured reading of that message. PROPOSAL-ONLY:
 *                     `proposedBy` is always "llm" and `ratified` defaults false —
 *                     the operator must confirm before anything acts. `args` is
 *                     genuinely typed per `kind` (a discriminated union), never
 *                     free-form code.
 *   AssistantReply  — the assistant's reply, optionally carrying a ParsedIntent and
 *                     citations (audit-event / rule ids) so answers are grounded.
 *
 * Additive; does not touch the locked Acme spine. Each contract ships a snake_case
 * canonical projection + golden vectors so its hash is byte-reproducible.
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

// ─────────────────────────────────────────────────────────────────────────────
// OperatorMessage
// ─────────────────────────────────────────────────────────────────────────────
export const OPERATOR_MESSAGE_SCHEMA = "liminal_engine.operator_message.v1";

export const operatorMessageShape = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  at: z.string().datetime(),
  /** optional UI context the message was sent from */
  context: z
    .object({
      currentBeat: z.string().min(1).optional(),
      selectedItemId: z.string().min(1).optional(),
    })
    .optional(),
});
export type OperatorMessage = z.infer<typeof operatorMessageShape>;

export const operatorMessageContract = defineContract({
  schema: OPERATOR_MESSAGE_SCHEMA,
  shape: operatorMessageShape,
  canonical: (m) => ({
    schema: OPERATOR_MESSAGE_SCHEMA,
    id: m.id,
    text: m.text,
    at: m.at,
    // context + its fields only projected into the hash when present
    ...(m.context !== undefined
      ? {
          context: {
            ...(m.context.currentBeat !== undefined ? { current_beat: m.context.currentBeat } : {}),
            ...(m.context.selectedItemId !== undefined ? { selected_item_id: m.context.selectedItemId } : {}),
          },
        }
      : {}),
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// ParsedIntent — kind-tagged, args typed per kind (closed). Proposal-only.
// ─────────────────────────────────────────────────────────────────────────────
export const PARSED_INTENT_SCHEMA = "liminal_engine.parsed_intent.v1";

export const parsedIntentKind = z.enum(["correction", "policy", "query", "verdict", "navigate"]);
export type ParsedIntentKind = z.infer<typeof parsedIntentKind>;

/** Fields shared by every intent kind. NL is a proposal until the operator ratifies. */
const intentBase = {
  confidence: z.number().min(0).max(1),
  proposedBy: z.literal("llm"),
  ratified: z.boolean().default(false),
};

export const parsedIntentShape = z.discriminatedUnion("kind", [
  // correction → a CorrectionEvent draft (id/actor/timestamp assigned on ratify)
  z.object({
    kind: z.literal("correction"),
    args: z.object({
      correction: z.string().min(1),
      caseId: z.string().min(1).optional(),
      dealId: z.string().min(1).optional(),
    }),
    ...intentBase,
  }),
  // policy → a natural-language proposal compiled to a PolicyRule after ratify
  z.object({
    kind: z.literal("policy"),
    args: z.object({ proposal: z.string().min(1) }),
    ...intentBase,
  }),
  // query → a question to answer over the ledger
  z.object({
    kind: z.literal("query"),
    args: z.object({ question: z.string().min(1) }),
    ...intentBase,
  }),
  // verdict → approve/disapprove an item in the intercept queue
  z.object({
    kind: z.literal("verdict"),
    args: z.object({
      queueItemId: z.string().min(1),
      decision: z.enum(["approve", "disapprove"]),
    }),
    ...intentBase,
  }),
  // navigate → move the cockpit to a target surface/item
  z.object({
    kind: z.literal("navigate"),
    args: z.object({ target: z.string().min(1) }),
    ...intentBase,
  }),
]);
export type ParsedIntent = z.infer<typeof parsedIntentShape>;

/** Deterministic snake_case projection of an intent's per-kind args. */
function canonicalIntentArgs(i: ParsedIntent): Record<string, unknown> {
  switch (i.kind) {
    case "correction":
      return {
        correction: i.args.correction,
        ...(i.args.caseId !== undefined ? { case_id: i.args.caseId } : {}),
        ...(i.args.dealId !== undefined ? { deal_id: i.args.dealId } : {}),
      };
    case "policy":
      return { proposal: i.args.proposal };
    case "query":
      return { question: i.args.question };
    case "verdict":
      return { queue_item_id: i.args.queueItemId, decision: i.args.decision };
    case "navigate":
      return { target: i.args.target };
    default: {
      const _exhaustive: never = i;
      return _exhaustive;
    }
  }
}

/** Reusable canonical for a ParsedIntent (also embedded in AssistantReply). */
export function canonicalParsedIntent(i: ParsedIntent) {
  return {
    kind: i.kind,
    confidence: i.confidence,
    proposed_by: i.proposedBy,
    ratified: i.ratified,
    args: canonicalIntentArgs(i),
  };
}

export const parsedIntentContract = defineContract({
  schema: PARSED_INTENT_SCHEMA,
  shape: parsedIntentShape,
  canonical: (i) => ({
    schema: PARSED_INTENT_SCHEMA,
    ...canonicalParsedIntent(i),
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// AssistantReply
// ─────────────────────────────────────────────────────────────────────────────
export const ASSISTANT_REPLY_SCHEMA = "liminal_engine.assistant_reply.v1";

export const assistantReplyShape = z.object({
  id: z.string().min(1),
  messageId: z.string().min(1),
  summary: z.string().min(1),
  /** the structured reading of the operator's message, if one was parsed */
  intent: parsedIntentShape.optional(),
  /** audit-event / rule ids the reply is grounded in */
  citations: z.array(z.string().min(1)).optional(),
  at: z.string().datetime(),
});
export type AssistantReply = z.infer<typeof assistantReplyShape>;

export const assistantReplyContract = defineContract({
  schema: ASSISTANT_REPLY_SCHEMA,
  shape: assistantReplyShape,
  canonical: (r) => ({
    schema: ASSISTANT_REPLY_SCHEMA,
    id: r.id,
    message_id: r.messageId,
    summary: r.summary,
    ...(r.intent !== undefined ? { intent: canonicalParsedIntent(r.intent) } : {}),
    ...(r.citations !== undefined ? { citations: r.citations } : {}),
    at: r.at,
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Golden vectors
// ─────────────────────────────────────────────────────────────────────────────
export const operatorMessageGoldenVectors = [
  {
    name: "correction-turn-with-context",
    purpose: "operator message sent from a selected item / current beat",
    input: {
      id: "om_1",
      text: "This dropped EU data residency — that's a hard requirement, don't mark it done.",
      at: "2026-06-28T10:00:00.000Z",
      context: { currentBeat: "detect", selectedItemId: "LIM-1187" },
    } satisfies OperatorMessage,
  },
  {
    name: "message-minimal",
    purpose: "minimal operator message — required fields only, no context",
    input: {
      id: "om_2",
      text: "What's still blocked?",
      at: "2026-06-28T10:01:00.000Z",
    } satisfies OperatorMessage,
  },
];

export const parsedIntentGoldenVectors = [
  {
    name: "intent-correction",
    purpose: "LLM reads a correction → CorrectionEvent draft, unratified",
    input: {
      kind: "correction",
      confidence: 0.92,
      args: { correction: "EU data residency is a hard requirement; honor it before any done.", caseId: "gc_acme_eu" },
      proposedBy: "llm",
      ratified: false,
    } satisfies ParsedIntent,
  },
  {
    name: "intent-verdict-disapprove",
    purpose: "LLM reads a verdict on an intercept-queue item, unratified",
    input: {
      kind: "verdict",
      confidence: 0.81,
      args: { queueItemId: "ia_pr20_merge", decision: "disapprove" },
      proposedBy: "llm",
      ratified: false,
    } satisfies ParsedIntent,
  },
  {
    name: "intent-navigate-ratified",
    purpose: "navigate intent the operator has ratified",
    input: {
      kind: "navigate",
      confidence: 0.99,
      args: { target: "audit-ledger" },
      proposedBy: "llm",
      ratified: true,
    } satisfies ParsedIntent,
  },
];

export const assistantReplyGoldenVectors = [
  {
    name: "reply-with-correction-intent",
    purpose: "reply carrying a proposed correction intent + audit citations",
    input: {
      id: "ar_1",
      messageId: "om_1",
      summary: "I read that as a correction on EU data residency. Ratify to compile it into a policy.",
      intent: {
        kind: "correction",
        confidence: 0.92,
        args: { correction: "EU data residency is a hard requirement; honor it before any done.", caseId: "gc_acme_eu" },
        proposedBy: "llm",
        ratified: false,
      },
      citations: ["ae_acme_1", "gc_acme_eu"],
      at: "2026-06-28T10:00:02.000Z",
    } satisfies AssistantReply,
  },
  {
    name: "reply-minimal",
    purpose: "minimal reply — no parsed intent, no citations",
    input: {
      id: "ar_2",
      messageId: "om_2",
      summary: "Two items are blocked on the policy-rule contract.",
      at: "2026-06-28T10:01:02.000Z",
    } satisfies AssistantReply,
  },
];
