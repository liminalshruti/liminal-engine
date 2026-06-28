/**
 * Substrate — a versioned snapshot of governance state ready for agent consumption.
 *
 * A Substrate encodes:
 * - schema: the shape of the payload (entity type, version tag)
 * - commit: the git commit hash of the snapshot source
 * - parent: reference to a prior substrate (for replay/diff chains)
 * - content: the payload (AuditEvent, GovernanceCase, ActionGate, EvalCase, etc.)
 * - timestamp: when the snapshot was taken
 *
 * Agents read substrate snapshots to verify state, chain corrections, and prove
 * improvement over time. Ports into liminal-agents-v1's substrate pattern.
 */

import { z } from "zod";
import { defineContract, canonicalHash } from "@liminal-engine/contracts";

export const SUBSTRATE_SCHEMA = "liminal_engine.substrate.v1";

export const substrateShape = z.object({
  id: z.string().min(1).describe("unique substrate snapshot id"),
  entity: z.string().min(1).describe("entity type, e.g. 'governance-case', 'audit-event'"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/).describe("semantic version tag"),
  schema: z.string().min(1).describe("schema id from the contract, e.g. 'liminal_engine.audit_event.v1'"),
  commitHash: z.string().regex(/^[a-f0-9]{40}$/).describe("git commit hash of the snapshot source"),
  parentRef: z.string().min(1).optional().describe("id of the prior substrate in a chain"),
  content: z.record(z.unknown()).describe("the payload snapshot"),
  timestamp: z.string().datetime().describe("when the snapshot was taken"),
  // SPEC.md extensions — optional; only projected into the hash when present.
  tags: z.array(z.string().min(1)).optional().describe("labels for filtering/querying substrates"),
  sourceSystem: z.string().min(1).optional().describe("which system/agent produced this snapshot"),
  integrity: z.object({
    contentHash: z.string().min(1).describe("SHA-256 of the content"),
    valid: z.boolean().describe("whether the content passed schema validation"),
  }).optional().describe("integrity metadata for tamper-detection"),
});

export type Substrate = z.infer<typeof substrateShape>;

export const substrateContract = defineContract({
  schema: SUBSTRATE_SCHEMA,
  shape: substrateShape,
  canonical: (s) => ({
    schema: SUBSTRATE_SCHEMA,
    id: s.id,
    entity: s.entity,
    version: s.version,
    schema_id: s.schema,
    commit_hash: s.commitHash,
    parent_ref: s.parentRef ?? null,
    content: s.content,
    timestamp: s.timestamp,
    ...(s.tags !== undefined ? { tags: s.tags } : {}),
    ...(s.sourceSystem !== undefined ? { source_system: s.sourceSystem } : {}),
    ...(s.integrity !== undefined ? { integrity: s.integrity } : {}),
  }),
});

export const substrateGoldenVectors = [
  {
    name: "acme-governance-case-substrate",
    purpose: "substrate snapshot of the governance case detection — acme-eu residency",
    input: {
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
      tags: ["acme", "first-pass"],
    } satisfies Substrate,
  },
  {
    name: "acme-audit-event-substrate",
    purpose: "substrate snapshot of the correction audit event — enforced via governance",
    input: {
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
        contentHash: canonicalHash({
          schema: "liminal_engine.audit_event.v1",
          id: "ae_acme_1",
          case_id: "gc_acme_eu",
          deal_id: "deal_acme",
          action: "correction-enforced",
          deciding_actor: "VP Ops / Head of AI Transformation",
          previous_status: "on-track",
          new_status: "at-risk",
          recorded_at: "2026-06-27T10:05:00.000Z",
        }),
        valid: true,
      },
    } satisfies Substrate,
  },
];
