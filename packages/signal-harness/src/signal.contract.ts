/**
 * DriftSignal — a separate entity representing a detected signal that may contribute
 * to a GovernanceCase. Per IDEAS.md STRETCH, signals carry type/severity/score/evidence/
 * detector_version, many-to-one case with dominantSignalType on the case.
 *
 * For the MVP, the regression detector emits a GovernanceCase directly; this contract
 * is for post-spine usage when signal synthesis is valuable. Test-only; fixtures only.
 */
import { z } from "zod";

export const DRIFT_SIGNAL_SCHEMA = "liminal_engine.drift_signal.v1";

export const driftSignalType = z.enum([
  "lost_context",
  "missing_required_anchor",
  "hard_constraint_violation",
  "unsupported_claim",
  "scope_expansion",
  "output_schema_violation",
  "completion_gate",
  "conflict_with_prior_correction",
]);
export type DriftSignalType = z.infer<typeof driftSignalType>;

export const driftSignalSeverity = z.enum(["critical", "high", "medium", "low"]);
export type DriftSignalSeverity = z.infer<typeof driftSignalSeverity>;

export const driftSignalShape = z.object({
  id: z.string().min(1),
  type: driftSignalType,
  severity: driftSignalSeverity,
  score: z.number().min(0).max(1), // confidence/strength 0-1
  evidence: z.array(z.string().min(1)), // structured evidence refs
  detectorVersion: z.string().min(1), // version of the detector that emitted it
  caseId: z.string().min(1), // which case this signal contributes to
  detectedAt: z.string().datetime(),
  // Optional metadata for richer context
  context: z.record(z.unknown()).optional(),
});
export type DriftSignal = z.infer<typeof driftSignalShape>;

/**
 * Golden vectors for contract testing — deterministic signal examples from the
 * Acme false-green scenario.
 */
export const driftSignalGoldenVectors = [
  {
    name: "acme-lost-eu-data-residency",
    purpose: "hard_constraint_violation on the missing EU data residency requirement",
    input: {
      id: "signal_acme_eu_1",
      type: "hard_constraint_violation" as DriftSignalType,
      severity: "critical" as DriftSignalSeverity,
      score: 0.95,
      evidence: ["evidence_eu_req_dropped", "evidence_agent_output_gap"],
      detectorVersion: "v1.0.0-acme-demo",
      caseId: "gc_acme_eu",
      detectedAt: "2026-06-27T10:00:00.000Z",
    } satisfies DriftSignal,
  },
  {
    name: "acme-scope-expansion-signal",
    purpose: "scope_expansion signal — additional requirements appeared mid-run",
    input: {
      id: "signal_acme_scope_1",
      type: "scope_expansion" as DriftSignalType,
      severity: "high" as DriftSignalSeverity,
      score: 0.75,
      evidence: ["evidence_new_stakeholder_requirement"],
      detectorVersion: "v1.0.0-acme-demo",
      caseId: "gc_acme_eu",
      detectedAt: "2026-06-27T10:01:00.000Z",
      context: {
        expandedScope: "security review approval now required",
      },
    } satisfies DriftSignal,
  },
];
