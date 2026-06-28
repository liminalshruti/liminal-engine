/**
 * Correction Pipeline — POST-HACK extension to governance.
 *
 * This package compiles CorrectionEvent into EnforcementAction[] + PolicyRule[] +
 * ApprovalGate[]. The governance package's compile-correction produces only
 * EnforcementAction[]; this pipeline extends that to produce the full policy +
 * approval infrastructure as a separate, composable module.
 *
 * Does NOT modify existing gov-correct or enforce paths. Sits alongside them.
 *
 * Usage:
 *   const { actions, rules, gates } = compileCorrectionFull(
 *     correctionEvent,
 *     { clock, idGen, caseEvidence }
 *   );
 *
 * All pure functions. No I/O ports. Deterministic from fixtures.
 */

export * from "./compile-to-policy.ts";
