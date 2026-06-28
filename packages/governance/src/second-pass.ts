/**
 * second-pass — the "improve" phase. Generates the EvalCase the second pass is
 * graded against, then grades each pass: a pass FAILS iff it still drops the
 * requirement (pass 1 false-green fails; pass 2 corrected passes). Records the
 * results to the EvalStore (read back by eval-harness.runEvals). [must-not-cut #7]
 *
 * «gov-secondpass» (LIM) deepens this (re-run under active gate → improved
 * at-risk output, idempotent generation).
 */
import type { EvalCase, EvalResult, GovernanceCase } from "@liminal-engine/contracts";
import type { AgentOutputSource, EvalStore } from "./ports.ts";
import type { Clock, IdGen } from "./detect-miss.ts";

export interface SecondPassDeps {
  source: AgentOutputSource;
  evalStore: EvalStore;
  clock: Clock;
  idGen: IdGen;
}

/**
 * Generate the EvalCase from the governance case, grade both passes against its
 * criterion, record the results, and return them.
 */
export async function gradeSecondPass(
  deps: SecondPassDeps,
  dealId: string,
  governanceCase: GovernanceCase,
): Promise<{ evalCase: EvalCase; evals: EvalResult[] }> {
  const criterion = `${governanceCase.missedRequirement} requirement honored`;
  const evalCase: EvalCase = {
    id: deps.idGen.next(),
    dealId,
    governanceCaseId: governanceCase.id,
    criterion,
    createdAt: deps.clock.now(),
  };

  const evals: EvalResult[] = [];
  for (const passNumber of [1, 2]) {
    const output = await deps.source.getOutput(dealId, passNumber);
    const honored = !output.droppedRequirements.includes(governanceCase.missedRequirement);
    const result: EvalResult = {
      id: deps.idGen.next(),
      dealId,
      evalCaseId: evalCase.id,
      passNumber,
      criterion,
      result: honored ? "pass" : "fail",
    };
    await deps.evalStore.record(result);
    evals.push(result);
  }

  return { evalCase, evals };
}
