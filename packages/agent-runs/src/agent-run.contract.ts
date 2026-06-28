/**
 * AgentRun — a single agent execution against a governance case.
 *
 * Tracks agent work lifecycle: from goal-targeting to pass completion.
 * Supports multi-scenario sequences: first_pass → detection → enforcement →
 * second_pass (linked via parentRunId). Captures the resolved context snapshot
 * at execution time for reproducibility and audit.
 *
 * Core types:
 * - id: unique agent run identifier
 * - goalId: the deal/business goal this run is against
 * - parentRunId: optional; points to the prior run in a sequence (null for first_pass)
 * - runKind: execution mode (first_pass | second_pass | replay)
 * - resolvedContext: snapshot of the context state when run executed
 * - status: execution outcome (pending | running | complete | error)
 */
import { z } from "zod";
import { defineContract } from "@liminal-engine/contracts";

export const AGENT_RUN_SCHEMA = "liminal_engine.agent_run.v1";

export const agentRunStatus = z.enum(["pending", "running", "complete", "error"]);
export type AgentRunStatus = z.infer<typeof agentRunStatus>;

export const agentRunKind = z.enum(["first_pass", "second_pass", "replay"]);
export type AgentRunKind = z.infer<typeof agentRunKind>;

/**
 * ResolvedContext snapshot — the state captured when the run began.
 * Enables determinism + audit trail. Extensible for future context layers
 * (e.g., policy state, prior eval results, operator constraints).
 */
export const resolvedContextShape = z.object({
  dealId: z.string().min(1),
  passNumber: z.number().int().positive(),
  capturedAt: z.string().datetime(),
  // Extensible: add fields like policyVersion, priorEvalId, etc.
});
export type ResolvedContext = z.infer<typeof resolvedContextShape>;

export const agentRunShape = z.object({
  id: z.string().min(1),
  goalId: z.string().min(1),
  parentRunId: z.string().min(1).nullable(),
  runKind: agentRunKind,
  resolvedContext: resolvedContextShape,
  status: agentRunStatus,
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});
export type AgentRun = z.infer<typeof agentRunShape>;

export const agentRunContract = defineContract({
  schema: AGENT_RUN_SCHEMA,
  shape: agentRunShape,
  canonical: (ar) => ({
    schema: AGENT_RUN_SCHEMA,
    id: ar.id,
    goal_id: ar.goalId,
    parent_run_id: ar.parentRunId,
    run_kind: ar.runKind,
    resolved_context: {
      deal_id: ar.resolvedContext.dealId,
      pass_number: ar.resolvedContext.passNumber,
      captured_at: ar.resolvedContext.capturedAt,
    },
    status: ar.status,
    created_at: ar.createdAt,
    completed_at: ar.completedAt,
  }),
});

export const agentRunGoldenVectors = [
  {
    name: "acme-pass-1-first",
    purpose: "first pass — false green on Acme, parent null",
    input: {
      id: "ar_acme_p1",
      goalId: "deal_acme",
      parentRunId: null,
      runKind: "first_pass" as const,
      resolvedContext: {
        dealId: "deal_acme",
        passNumber: 1,
        capturedAt: "2026-06-27T09:55:00.000Z",
      },
      status: "complete" as const,
      createdAt: "2026-06-27T09:55:00.000Z",
      completedAt: "2026-06-27T10:00:00.000Z",
    } satisfies AgentRun,
  },
  {
    name: "acme-pass-2-second",
    purpose: "second pass — with EU residency enforced, parent = pass 1",
    input: {
      id: "ar_acme_p2",
      goalId: "deal_acme",
      parentRunId: "ar_acme_p1",
      runKind: "second_pass" as const,
      resolvedContext: {
        dealId: "deal_acme",
        passNumber: 2,
        capturedAt: "2026-06-27T10:05:00.000Z",
      },
      status: "complete" as const,
      createdAt: "2026-06-27T10:05:00.000Z",
      completedAt: "2026-06-27T10:06:00.000Z",
    } satisfies AgentRun,
  },
];
