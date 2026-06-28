/**
 * The 14-step required demo path (DEMO_CONTRACT.md, LOCKED), bound to the
 * deterministic Acme fixtures. Each step carries its title, loop phase, the
 * must-not-cut id it satisfies (if any), a one-line summary for the stepper rail,
 * and the SCREEN component the stage mounts for that beat.
 *
 * The 14 beats map onto 7 screens (LIM-1226 «spine-shell-v2»): each beat points at
 * exactly one screen, so the shell renders `step.screen` in the stage. Screen agents
 * (LIM-1215–1221) FILL their screen's stub — nobody edits this file or App.tsx.
 *
 * Fixtures come ONLY from @liminal-engine/contracts/fixtures (no live calls on
 * the spine — DEMO_CONTRACT cut-if-risky / CLAUDE build order).
 */
import type { ComponentType } from "react";
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { Initialize } from "./screens/Initialize.tsx";
import { AgentActivity } from "./screens/AgentActivity.tsx";
import { ContextTray } from "./screens/ContextTray.tsx";
import { GovernanceCase } from "./screens/GovernanceCase.tsx";
import { EnforcementPanel } from "./screens/EnforcementPanel.tsx";
import { AuditTrail } from "./screens/AuditTrail.tsx";
import { SecondPassEval } from "./screens/SecondPassEval.tsx";

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
  /** One-line summary shown in the stepper rail. */
  summary: string;
  /** The screen component the stage mounts for this beat. */
  screen: ComponentType;
}

const s = acmeScenario;

function firstReason(reasons: readonly string[]): string {
  const [reason] = reasons;
  if (!reason) throw new Error("blocked action fixture must include a reason");
  return reason;
}

export const DEMO_STEPS: DemoStep[] = [
  { n: 1, phase: "observe", title: "Initialize workspace", screen: Initialize,
    summary: "Acme Expansion governance workspace." },
  { n: 2, phase: "observe", title: "Show Acme business goal", screen: Initialize,
    summary: s.businessGoal },
  { n: 3, phase: "observe", title: "Show agent output (the false green)", mustNotCut: 1, screen: AgentActivity,
    summary: s.agentOutputPass1.summary },
  { n: 4, phase: "detect", title: "Reveal lost EU data-residency requirement", screen: ContextTray,
    summary: "Load-bearing customer requirement silently dropped." },
  { n: 5, phase: "detect", title: "Surface GovernanceCase", mustNotCut: 2, screen: GovernanceCase,
    summary: `GovernanceCase ${s.governanceCase.id} — EU data residency.` },
  { n: 6, phase: "correct", title: "Operator clicks Approve + Enforce", screen: EnforcementPanel,
    summary: "Human decision becomes enforceable operating state." },
  { n: 7, phase: "enforce", title: "Status changes On Track → At Risk", mustNotCut: 3, screen: EnforcementPanel,
    summary: `EnforcementAction ${s.enforcementAction.id} flips deal status.` },
  { n: 8, phase: "enforce", title: "Simulated Linear workstream appears", mustNotCut: 4, screen: EnforcementPanel,
    summary: "Remediation workstream created (simulated)." },
  { n: 9, phase: "enforce", title: "Product / Security / Engineering owners required", screen: EnforcementPanel,
    summary: `Required owners: ${s.requiredOwners.join(", ")}.` },
  { n: 10, phase: "enforce", title: "False customer-facing update is blocked", mustNotCut: 5, screen: EnforcementPanel,
    summary: firstReason(s.blockedAction.reasons) },
  { n: 11, phase: "audit", title: "AuditEvent recorded", mustNotCut: 6, screen: AuditTrail,
    summary: `AuditEvent ${s.auditEvent.id} — correction + deciding actor.` },
  { n: 12, phase: "improve", title: "EvalCase generated", screen: SecondPassEval,
    summary: `EvalCase ${s.evalCase.id} — ${s.evalCase.criterion}.` },
  { n: 13, phase: "improve", title: "Second pass improves", screen: SecondPassEval,
    summary: s.agentOutputPass2.summary },
  { n: 14, phase: "improve", title: "Eval table shows Fail → Pass", mustNotCut: 7, screen: SecondPassEval,
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
