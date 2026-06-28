/**
 * workspace — the operating surface's cold-start core (BUILD_PLAN Gap 3 /
 * DIRECTIVE.md). Given an operator goal + ARBITRARY ingested streams (no fixture,
 * no fixed sequence), it runs the real detection over the substrate and assesses
 * whether the AI spend is advancing the goal — surfacing the drift case if not.
 *
 * This is what makes Liminal a product: it works on whatever data the operator
 * loaded, opened cold, with no narrator. The React surface renders this result.
 */
import {
  InMemorySubstrate,
  detectLostContext,
  type StreamSourceType,
} from "@liminal-engine/substrate";
import {
  assessGoalAlignment,
  caseEvidenceFromAlignment,
  type Goal,
  type AlignmentAssessment,
  type AlignmentCaseEvidence,
} from "@liminal-engine/goal-alignment";

export interface WorkspaceInput {
  readonly goal: Goal;
  readonly substrate: InMemorySubstrate;
  /** Requirements to track (e.g. extracted from the call stream). */
  readonly requirements: readonly string[];
  /** The source-type the requirements were stated in. */
  readonly statedIn: StreamSourceType;
  /** AI spend accrued against the goal so far. */
  readonly spendUsd: number;
}

export interface WorkspaceAssessment {
  readonly goalTitle: string;
  readonly streamCount: number;
  readonly lostRequirements: string[];
  readonly alignment: AlignmentAssessment;
  /** The drift case to surface, or null when the work is aligned. */
  readonly driftCase: AlignmentCaseEvidence | null;
}

/**
 * Assess a goal over the operator's ingested substrate. Pure: same inputs →
 * same assessment, so the surface is deterministic and screenshot-stable.
 */
export function buildWorkspaceAssessment(input: WorkspaceInput): WorkspaceAssessment {
  const lostRequirements = detectLostContext(input.substrate, {
    requirements: input.requirements,
    statedIn: input.statedIn,
  });

  const alignment = assessGoalAlignment({
    goal: input.goal,
    spendUsd: input.spendUsd,
    outputsProduced: input.substrate.streams().filter((s) => s.sourceType !== input.statedIn)
      .length,
    lostRequirements,
  });

  return {
    goalTitle: input.goal.title,
    streamCount: input.substrate.streams().length,
    lostRequirements,
    alignment,
    driftCase: caseEvidenceFromAlignment(alignment),
  };
}
