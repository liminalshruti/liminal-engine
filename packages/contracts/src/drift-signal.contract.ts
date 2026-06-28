/**
 * DriftSignal — a detector's scored signal that observed work drifted from
 * active requirements, policy, routes, resources, or model expectations.
 */
import { z } from "zod";
import { defineContract } from "./define-contract.ts";

export const DRIFT_SIGNAL_SCHEMA = "liminal_engine.drift_signal.v1";

export const driftSignalKind = z.enum([
  "requirement_dropped",
  "status_mismatch",
  "policy_violation",
  "eval_regression",
  "routing_failure",
  "resource_gap",
  "llm_failure",
  "transform_error",
  "custom",
]);
export type DriftSignalKind = z.infer<typeof driftSignalKind>;

export const driftSignalSeverity = z.enum(["critical", "high", "medium", "low"]);
export type DriftSignalSeverity = z.infer<typeof driftSignalSeverity>;

export const driftSignalSourceType = z.enum([
  "agent_output",
  "llm_outcome",
  "endpoint",
  "policy_router",
  "signal_harness",
  "operator",
]);
export type DriftSignalSourceType = z.infer<typeof driftSignalSourceType>;

export const driftSignalStatus = z.enum(["open", "acknowledged", "converted", "dismissed"]);
export type DriftSignalStatus = z.infer<typeof driftSignalStatus>;

export const driftSignalShape = z
  .object({
    id: z.string().min(1),
    sourceType: driftSignalSourceType,
    sourceId: z.string().min(1),
    dealId: z.string().min(1).optional(),
    signalKind: driftSignalKind,
    severity: driftSignalSeverity,
    score: z.number().min(0).max(1),
    summary: z.string().min(1),
    evidenceIds: z.array(z.string().min(1)),
    observedAt: z.string().datetime(),
    detectorVersion: z.string().min(1),
    status: driftSignalStatus,
    linkedCaseId: z.string().min(1).optional(),
    linkedRuleId: z.string().min(1).optional(),
    linkedRequirementId: z.string().min(1).optional(),
  })
  .strict();
export type DriftSignal = z.infer<typeof driftSignalShape>;

export function shouldOpenGovernanceCase(signal: DriftSignal, threshold = 0.8): boolean {
  return signal.status === "open" && signal.score >= threshold && (
    signal.severity === "critical" || signal.severity === "high"
  );
}

export const driftSignalContract = defineContract({
  schema: DRIFT_SIGNAL_SCHEMA,
  shape: driftSignalShape,
  canonical: (s) => ({
    schema: DRIFT_SIGNAL_SCHEMA,
    id: s.id,
    source_type: s.sourceType,
    source_id: s.sourceId,
    ...(s.dealId !== undefined ? { deal_id: s.dealId } : {}),
    signal_kind: s.signalKind,
    severity: s.severity,
    score: s.score,
    summary: s.summary,
    evidence_ids: [...s.evidenceIds].sort(),
    observed_at: s.observedAt,
    detector_version: s.detectorVersion,
    status: s.status,
    ...(s.linkedCaseId !== undefined ? { linked_case_id: s.linkedCaseId } : {}),
    ...(s.linkedRuleId !== undefined ? { linked_rule_id: s.linkedRuleId } : {}),
    ...(s.linkedRequirementId !== undefined ? { linked_requirement_id: s.linkedRequirementId } : {}),
  }),
});

export const driftSignalGoldenVectors = [
  {
    name: "acme-eu-residency-drift",
    purpose: "the false green emitted a high-confidence requirement-dropped signal",
    input: {
      id: "ds_acme_eu_residency",
      sourceType: "agent_output",
      sourceId: "ao_acme_p1",
      dealId: "deal_acme",
      signalKind: "requirement_dropped",
      severity: "critical",
      score: 0.98,
      summary: "Agent output reported on-track while EU data residency was dropped.",
      evidenceIds: ["call_acme_kickoff", "dpa_acme_v3"],
      observedAt: "2026-06-27T10:00:00.000Z",
      detectorVersion: "signal-harness.requirement-coverage.v1",
      status: "open",
      linkedRequirementId: "req_acme_eu_residency",
    } satisfies DriftSignal,
  },
];
