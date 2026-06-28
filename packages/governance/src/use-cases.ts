/**
 * Governance use cases — the orchestrator that drives the full loop
 * (observe → detect → correct → enforce → audit → improve) over the ports in
 * ./ports.ts. The individual phases now live in their own modules (detect-miss,
 * enforce, proxy-gate, second-pass, compile-correction) so the Wave-2 gov tasks
 * fill one file each without racing on this barrel; this module composes them.
 *
 * Re-exports the phase modules so existing importers of `./use-cases.ts` keep
 * working after the «gov-scaffold» decomposition (no consumer churn).
 *
 * Determinism: IDs + timestamps are INJECTED (idGen / clock), never Date.now()
 * or Math.random(). Boundary: contracts + engine-core + ./ports only — never a
 * concrete adapter (enforced by .dependency-cruiser.cjs).
 */
import type { EvalCase, EvalResult } from "@liminal-engine/contracts";
import type {
  AgentOutputSource,
  GovernanceCaseStore,
  AuditSink,
  ActionGateStore,
  EvalStore,
} from "./ports.ts";
import { type Clock, type IdGen, detectMiss } from "./detect-miss.ts";
import { enforceCorrection } from "./enforce.ts";
import { gateDownstreamAction, GATED_CUSTOMER_ACTION } from "./proxy-gate.ts";
import { gradeSecondPass } from "./second-pass.ts";

// Backward-compat: the loop phases were decomposed into their own modules
// («gov-scaffold»). Re-export them from here so existing importers of
// `./use-cases.ts` (approve-enforce.ts, the tests) keep resolving. These re-
// export the SAME symbols the barrel exports from the same origin, so there is
// no duplicate-export ambiguity.
export * from "./detect-miss.ts";
export * from "./enforce.ts";
export * from "./proxy-gate.ts";
export * from "./second-pass.ts";

export interface GovernanceLoopDeps {
  source: AgentOutputSource;
  caseStore: GovernanceCaseStore;
  auditSink: AuditSink;
  actionGateStore: ActionGateStore;
  evalStore: EvalStore;
  clock: Clock;
  idGen: IdGen;
}

/**
 * The full loop: observe → detect → correct → enforce → audit → improve.
 * Detects the miss, enforces the flip + audit, gates the bad action, generates
 * the EvalCase, grades both passes, and records the results to the EvalStore
 * (read back by eval-harness.runEvals). Returns the EvalCase + the two results.
 * [must-not-cut #2/#3/#5/#6/#7]
 */
export async function runGovernanceLoop(
  deps: GovernanceLoopDeps,
  dealId: string,
): Promise<{ evalCase: EvalCase; evals: EvalResult[] }> {
  // detect
  const governanceCase = await detectMiss(
    deps.source,
    deps.caseStore,
    dealId,
    1,
    deps.clock,
    deps.idGen,
  );
  if (!governanceCase) {
    throw new Error(`no governance case detected for deal ${dealId}`);
  }

  // enforce + audit
  await enforceCorrection(governanceCase.id, dealId, "on-track", {
    auditSink: deps.auditSink,
    clock: deps.clock,
    idGen: deps.idGen,
  });

  // gate the downstream action
  await gateDownstreamAction(
    deps.actionGateStore,
    GATED_CUSTOMER_ACTION,
    governanceCase.id,
    deps.idGen,
  );

  // improve — generate the EvalCase + grade both passes
  return gradeSecondPass(
    {
      source: deps.source,
      evalStore: deps.evalStore,
      clock: deps.clock,
      idGen: deps.idGen,
    },
    dealId,
    governanceCase,
  );
}
