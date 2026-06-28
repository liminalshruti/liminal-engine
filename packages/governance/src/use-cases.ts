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
import type {
  EvalCase,
  EvalResult,
  GovernanceCase,
  EnforcementAction,
  AuditEvent,
  ActionGate,
} from "@liminal-engine/contracts";
import type {
  AgentOutputSource,
  GovernanceCaseStore,
  AuditSink,
  ActionGateStore,
  EvalStore,
} from "./ports.ts";
import { type Clock, type IdGen, type CaseEvidence, detectMiss } from "./detect-miss.ts";
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
  /**
   * Optional case evidence (business impact / missing-from / recommended actions)
   * the detector attaches to the opened case (LIM-1254). Injected scenario
   * knowledge, not derivable from agent output — see CaseEvidence. Omitted ⇒
   * the loop produces a minimal case (existing behavior unchanged).
   */
  caseEvidence?: CaseEvidence;
}

/** Everything the loop produces — the full result a UI/audit can render. */
export interface GovernanceLoopResult {
  governanceCase: GovernanceCase;
  enforcementAction: EnforcementAction;
  auditEvent: AuditEvent;
  gate: ActionGate;
  evalCase: EvalCase;
  evals: EvalResult[];
}

/**
 * The full loop: observe → detect → correct → enforce → audit → improve.
 * Detects the miss, enforces the flip + audit, gates the bad action, generates
 * the EvalCase, and grades both passes. Returns EVERY artifact it produced (not
 * just the eval) so a single source of truth can render the whole 14-beat path
 * without re-reading raw fixtures. [must-not-cut #2/#3/#5/#6/#7]
 */
export async function runGovernanceLoop(
  deps: GovernanceLoopDeps,
  dealId: string,
): Promise<GovernanceLoopResult> {
  // detect
  const governanceCase = await detectMiss(
    deps.source,
    deps.caseStore,
    dealId,
    1,
    deps.clock,
    deps.idGen,
    deps.caseEvidence,
  );
  if (!governanceCase) {
    throw new Error(`no governance case detected for deal ${dealId}`);
  }

  // enforce + audit — capture the action + audit the loop produced
  const { action: enforcementAction, audit: auditEvent } = await enforceCorrection(
    governanceCase.id,
    dealId,
    "on-track",
    { auditSink: deps.auditSink, clock: deps.clock, idGen: deps.idGen },
  );

  // gate the downstream action — capture the gate the loop produced
  const gate = await gateDownstreamAction(
    deps.actionGateStore,
    GATED_CUSTOMER_ACTION,
    governanceCase.id,
    deps.idGen,
  );

  // improve — generate the EvalCase + grade both passes
  const { evalCase, evals } = await gradeSecondPass(
    {
      source: deps.source,
      evalStore: deps.evalStore,
      clock: deps.clock,
      idGen: deps.idGen,
    },
    dealId,
    governanceCase,
  );

  return { governanceCase, enforcementAction, auditEvent, gate, evalCase, evals };
}
