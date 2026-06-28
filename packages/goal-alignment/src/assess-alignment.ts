/**
 * assess-alignment — the executive wow (BUILD_PLAN Gap 4 / LIM-1371).
 *
 * Answers the buyer question: "is our AI SPEND actually moving the goal we
 * resourced it for?" Given a goal (resourced budget + metric), the spend accrued,
 * the outputs produced, and any lost-context the loop detected, it produces the
 * AI-ROI / goal-alignment verdict: spend can be high and output plentiful while the
 * goal is NOT advancing because a gating requirement was lost.
 */

export interface Goal {
  readonly title: string;
  /** The budget the operator resourced this agent work with. */
  readonly budgetUsd: number;
  /** The success metric the goal is measured by. */
  readonly metric: string;
}

export interface AlignmentInput {
  readonly goal: Goal;
  /** AI spend accrued against the goal (sum of agent-run / model-call cost). */
  readonly spendUsd: number;
  /** How many work artifacts the agent team produced. */
  readonly outputsProduced: number;
  /** Requirements the loop found lost (computed from the substrate). */
  readonly lostRequirements: readonly string[];
}

export interface AlignmentAssessment {
  readonly aligned: boolean;
  readonly spendUsd: number;
  readonly budgetUtilization: number;
  readonly outputsProduced: number;
  readonly lostRequirements: readonly string[];
  readonly summary: string;
}

/**
 * Misaligned when spend produced output but a requirement was lost — the "AI spend
 * is making work, not moving the goal" risk. Aligned when work was produced and
 * nothing gating was dropped.
 */
export function assessGoalAlignment(input: AlignmentInput): AlignmentAssessment {
  const lost = [...input.lostRequirements];
  const aligned = lost.length === 0;
  const budgetUtilization = input.goal.budgetUsd > 0 ? input.spendUsd / input.goal.budgetUsd : 0;

  const summary = aligned
    ? `$${input.spendUsd.toLocaleString()} of AI spend produced ${input.outputsProduced} outputs aligned to "${input.goal.title}".`
    : `$${input.spendUsd.toLocaleString()} of AI spend produced ${input.outputsProduced} outputs, but ${lost.length} gating requirement(s) were lost (${lost.join(", ")}) — the goal "${input.goal.title}" is not being advanced.`;

  return {
    aligned,
    spendUsd: input.spendUsd,
    budgetUtilization,
    outputsProduced: input.outputsProduced,
    lostRequirements: lost,
    summary,
  };
}
