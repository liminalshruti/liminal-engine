/**
 * case-from-alignment — bridges the AI-spend alignment verdict into the
 * GovernanceCase the operator sees, so the drift case states the AI-ROI risk
 * ("$X spent, goal not advanced") rather than just "a requirement was missed".
 * [BUILD_PLAN Gap 4 / LIM-1371]
 */
import type { AlignmentAssessment } from "./assess-alignment.ts";

/** The GovernanceCase evidence fields derived from an alignment verdict. */
export interface AlignmentCaseEvidence {
  /** The spend-vs-goal framing for GovernanceCase.businessImpact. */
  readonly businessImpact: string;
  /** The lost requirements, for GovernanceCase.missingFrom. */
  readonly missingFrom: string[];
}

/**
 * Produce the case evidence for a misaligned assessment, or `null` when aligned
 * (nothing to surface — the spend is advancing the goal).
 */
export function caseEvidenceFromAlignment(
  assessment: AlignmentAssessment,
): AlignmentCaseEvidence | null {
  if (assessment.aligned) return null;
  return {
    businessImpact: assessment.summary,
    missingFrom: [...assessment.lostRequirements],
  };
}
