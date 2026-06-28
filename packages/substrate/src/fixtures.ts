/**
 * Substrate fixtures — pre-built snapshots for demo and test use.
 *
 * These fixtures represent the governance state at key points in the Acme false-green
 * scenario, serialized as substrate snapshots ready for agent reads.
 */

import type { Substrate } from "./substrate.contract.ts";

/**
 * ACME_SUBSTRATE_SEQUENCE — a chain of snapshots showing governance corrections
 * in temporal order (governance case detection → correction enforcement → audit recording).
 */
export const ACME_SUBSTRATE_SEQUENCE: Record<string, Substrate> = {
  /**
   * Step 1: The detection — governance case surfaced for dropped EU data residency.
   * (Timeline: 2026-06-27 10:00:30 UTC)
   */
  "gc-detection": {
    id: "substrate_gc_acme_eu_001",
    entity: "governance-case",
    version: "1.0.0",
    schema: "liminal_engine.governance_case.v1",
    commitHash: "0000000000000000000000000000000000000001",
    content: {
      id: "gc_acme_eu",
      dealId: "deal_acme",
      missedRequirement: "EU data residency",
      category: "data-governance",
      severity: "blocking",
      status: "open",
      detectedAt: "2026-06-27T10:00:00.000Z",
    },
    timestamp: "2026-06-27T10:00:30.000Z",
    sourceSystem: "liminal-engine",
    tags: ["acme", "first-pass", "detection"],
  },

  /**
   * Step 2: The correction enforcement — governance case status changed, action gate created.
   * (Timeline: 2026-06-27 10:05:30 UTC)
   */
  "enforcement-action": {
    id: "substrate_ae_acme_1_002",
    entity: "audit-event",
    version: "1.0.0",
    schema: "liminal_engine.audit_event.v1",
    commitHash: "0000000000000000000000000000000000000002",
    parentRef: "substrate_gc_acme_eu_001",
    content: {
      id: "ae_acme_1",
      caseId: "gc_acme_eu",
      dealId: "deal_acme",
      action: "correction-enforced",
      decidingActor: "VP Ops / Head of AI Transformation",
      previousStatus: "on-track",
      newStatus: "at-risk",
      recordedAt: "2026-06-27T10:05:00.000Z",
    },
    timestamp: "2026-06-27T10:05:30.000Z",
    sourceSystem: "liminal-engine",
    tags: ["acme", "enforcement"],
    integrity: {
      contentHash:
        "b3e5c6f2a8d1e9f4c7b8a2d9e1f4c7b8a2d9e1f4c7b8a2d9e1f4c7b8a2d9e1",
      valid: true,
    },
  },

  /**
   * Step 3: The improved agent pass — second-pass output after correction.
   * (Timeline: 2026-06-27 10:15:00 UTC)
   */
  "eval-case": {
    id: "substrate_eval_acme_001_003",
    entity: "eval-case",
    version: "1.0.0",
    schema: "liminal_engine.eval_case.v1",
    commitHash: "0000000000000000000000000000000000000003",
    parentRef: "substrate_ae_acme_1_002",
    content: {
      id: "eval_acme_001",
      caseId: "gc_acme_eu",
      dealId: "deal_acme",
      pass: 2,
      status: "pass",
      failureReason: null,
      evaluatedAt: "2026-06-27T10:15:00.000Z",
      improvement: {
        previousPass: 1,
        previousStatus: "fail",
        reason: "EU data residency requirement was not addressed in agent output",
      },
    },
    timestamp: "2026-06-27T10:15:30.000Z",
    sourceSystem: "liminal-engine",
    tags: ["acme", "eval", "improvement"],
    integrity: {
      contentHash:
        "c4e5d6f3a9b2c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3",
      valid: true,
    },
  },
};

/**
 * GOVERNANCE_LOOP_SUBSTRATE_CHAIN — metadata linking the substrate chain
 * for agent reads of the full governance loop progression.
 */
export const GOVERNANCE_LOOP_SUBSTRATE_CHAIN = {
  scenario: "acme-false-green",
  substrates: ["gc-detection", "enforcement-action", "eval-case"] as const,
  sequence: [
    {
      step: 1,
      key: "gc-detection",
      action: "observe-and-detect",
      description: "Governance case surface — EU data residency dropped",
    },
    {
      step: 2,
      key: "enforcement-action",
      action: "correct-and-enforce",
      description: "Correction enforced — status at-risk, workstream created",
    },
    {
      step: 3,
      key: "eval-case",
      action: "audit-and-improve",
      description: "Second pass improves — eval case marked pass",
    },
  ],
} as const;
