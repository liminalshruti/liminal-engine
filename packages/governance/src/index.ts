/**
 * Governance application layer — use cases over ports.
 *
 * Ports are defined. The use cases (observe → detect → correct → enforce →
 * audit → improve) are implemented here by the overnight agents per the Linear
 * P0 issues — depending on `./ports.ts` and `@liminal-engine/engine-core`, never
 * on a concrete adapter. Keep this serving DEMO_CONTRACT.md; do not redesign the
 * loop.
 */
export * from "./ports.ts";

// Use cases land here. Suggested signatures (see ops/linear/P0_ISSUES.md):
//   detectMiss(source, caseStore, dealId): Promise<GovernanceCase | null>
//   enforceCorrection(caseId, deps, actor): Promise<{ action: EnforcementAction; audit: AuditEvent }>  // flips on-track -> at-risk
//   gateDownstreamAction(actionGateStore, action, caseId): Promise<ActionGate>
//   runGovernanceLoop(deps, dealId): Promise<{ evalCase: EvalCase; evals: EvalResult[] }>
