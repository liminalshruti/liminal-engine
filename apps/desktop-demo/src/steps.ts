/**
 * The 14-step required demo path (DEMO_CONTRACT.md, LOCKED), bound to the
 * deterministic Acme fixtures. This is the SHELL: each step has its title,
 * the loop phase it belongs to, the must-not-cut id it satisfies (if any),
 * and a pointer to the fixture it will render. The per-step screens are filled
 * in subsequent P0s — here we render the stepper frame + the fixture summary so
 * the click-through exists end to end.
 *
 * Fixtures come ONLY from @liminal-engine/contracts/fixtures (no live calls on
 * the spine — DEMO_CONTRACT cut-if-risky / CLAUDE build order).
 */
import { acmeScenario } from "@liminal-engine/contracts/fixtures";

export type LoopPhase =
  | "observe"
  | "detect"
  | "correct"
  | "enforce"
  | "audit"
  | "improve";

export interface DemoStep {
  /** 1-based beat number from DEMO_CONTRACT required path. */
  n: number;
  title: string;
  phase: LoopPhase;
  /** Must-NOT-cut id this beat satisfies, if any. */
  mustNotCut?: number;
  /** One-line summary shown in the shell until the real screen lands. */
  summary: string;
}

const s = acmeScenario;

export const DEMO_STEPS: DemoStep[] = [
  { n: 1, phase: "observe", title: "Initialize workspace",
    summary: "Acme Expansion governance workspace." },
  { n: 2, phase: "observe", title: "Show Acme business goal",
    summary: s.businessGoal },
  { n: 3, phase: "observe", title: "Show agent output (the false green)", mustNotCut: 1,
    summary: s.agentOutputPass1.summary },
  { n: 4, phase: "detect", title: "Reveal lost EU data-residency requirement",
    summary: "Load-bearing customer requirement silently dropped." },
  { n: 5, phase: "detect", title: "Surface GovernanceCase", mustNotCut: 2,
    summary: `GovernanceCase ${s.governanceCase.id} — EU data residency.` },
  { n: 6, phase: "correct", title: "Operator clicks Approve + Enforce",
    summary: "Human decision becomes enforceable operating state." },
  { n: 7, phase: "enforce", title: "Status changes On Track → At Risk", mustNotCut: 3,
    summary: `EnforcementAction ${s.enforcementAction.id} flips deal status.` },
  { n: 8, phase: "enforce", title: "Simulated Linear workstream appears", mustNotCut: 4,
    summary: "Remediation workstream created (simulated)." },
  { n: 9, phase: "enforce", title: "Product / Security / Engineering owners required",
    summary: `Required owners: ${s.requiredOwners.join(", ")}.` },
  { n: 10, phase: "enforce", title: "False customer-facing update is blocked", mustNotCut: 5,
    summary: s.blockedAction.reasons[0] ?? "Blocked until the governance case is corrected." },
  { n: 11, phase: "audit", title: "AuditEvent recorded", mustNotCut: 6,
    summary: `AuditEvent ${s.auditEvent.id} — correction + deciding actor.` },
  { n: 12, phase: "improve", title: "EvalCase generated",
    summary: `EvalCase ${s.evalCase.id} — ${s.evalCase.criterion}.` },
  { n: 13, phase: "improve", title: "Second pass improves",
    summary: s.agentOutputPass2.summary },
  { n: 14, phase: "improve", title: "Eval table shows Fail → Pass", mustNotCut: 7,
    summary: `${s.evalPass1.result.toUpperCase()} (pass 1) → ${s.evalPass2.result.toUpperCase()} (pass 2).` },
];

export const PHASE_LABEL: Record<LoopPhase, string> = {
  observe: "Observe",
  detect: "Detect",
  correct: "Correct",
  enforce: "Enforce",
  audit: "Audit",
  improve: "Improve",
};
