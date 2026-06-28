/**
 * TraceEvent — a detailed audit log entry (finer-grained than AuditEvent).
 * Records the stage, actor, event, and optional payload of a governance operation.
 * Used by audit-ledger as a source for reconstruction; timestamp and parentEventId
 * enable parent-child event correlation and trace replay.
 * (SCOPE_SPEC.md: stretch item, tests only; not wired to UI.)
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

export const TRACE_EVENT_SCHEMA = "liminal_engine.trace_event.v1";

export const traceEventShape = z.object({
  id: z.string().min(1),
  timestamp: z.string().datetime(),
  stage: z.enum([
    "observe",
    "detect",
    "correct",
    "enforce",
    "audit",
    "improve",
  ]),
  actor: z.string().min(1), // a ROLE, never an invented name
  event: z.string().min(1), // e.g. "case-detected", "correction-applied", "enforcement-queued"
  payload: z.record(z.unknown()).optional(), // arbitrary event-specific data
  parentEventId: z.string().min(1).optional(), // parent event in the trace (enables parent-child correlation)
});
export type TraceEvent = z.infer<typeof traceEventShape>;

export const traceEventContract = defineContract({
  schema: TRACE_EVENT_SCHEMA,
  shape: traceEventShape,
  canonical: (t) => ({
    schema: TRACE_EVENT_SCHEMA,
    id: t.id,
    timestamp: t.timestamp,
    stage: t.stage,
    actor: t.actor,
    event: t.event,
    ...(t.payload !== undefined ? { payload: t.payload } : {}),
    ...(t.parentEventId !== undefined ? { parent_event_id: t.parentEventId } : {}),
  }),
});

export const traceEventGoldenVectors = [
  {
    name: "acme-case-detected",
    purpose: "detect stage: governance case detected with dropped EU requirement",
    input: {
      id: "te_acme_detect_1",
      timestamp: "2026-06-27T10:00:00.000Z",
      stage: "detect",
      actor: "AI Detection Agent",
      event: "case-detected",
      payload: {
        caseId: "gc_acme_eu",
        missedRequirement: "EU data residency",
        severity: "high",
      },
    } satisfies TraceEvent,
  },
  {
    name: "acme-correction-applied",
    purpose: "correct stage: operator applies correction to the detected case",
    input: {
      id: "te_acme_correct_1",
      timestamp: "2026-06-27T10:03:00.000Z",
      stage: "correct",
      actor: "VP Ops / Head of AI Transformation",
      event: "correction-applied",
      payload: {
        caseId: "gc_acme_eu",
        correction: "EU data residency is a hard requirement; honor it before any on-track claim.",
      },
      parentEventId: "te_acme_detect_1",
    } satisfies TraceEvent,
  },
  {
    name: "acme-enforcement-queued",
    purpose: "enforce stage: enforcement action compiled and queued for approval",
    input: {
      id: "te_acme_enforce_1",
      timestamp: "2026-06-27T10:04:00.000Z",
      stage: "enforce",
      actor: "VP Ops / Head of AI Transformation",
      event: "enforcement-queued",
      payload: {
        caseId: "gc_acme_eu",
        actionCount: 1,
        actionType: "require_approval",
      },
      parentEventId: "te_acme_correct_1",
    } satisfies TraceEvent,
  },
  {
    name: "acme-audit-recorded",
    purpose: "audit stage: correction and status flip recorded in the chain",
    input: {
      id: "te_acme_audit_1",
      timestamp: "2026-06-27T10:05:00.000Z",
      stage: "audit",
      actor: "VP Ops / Head of AI Transformation",
      event: "audit-recorded",
      payload: {
        auditEventId: "ae_acme_1",
        previousStatus: "on-track",
        newStatus: "at-risk",
      },
      parentEventId: "te_acme_enforce_1",
    } satisfies TraceEvent,
  },
];
