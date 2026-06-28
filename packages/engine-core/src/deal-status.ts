/**
 * Pure domain: the deal-status state machine + governance loop phases.
 * No I/O, no node core, no integrations (enforced by .dependency-cruiser.cjs).
 * The locked status flip: enforcing a correction takes on-track -> at-risk.
 */
import type { DealStatus } from "@liminal-engine/contracts";

export type GovernancePhase =
  | "observe"
  | "detect"
  | "correct"
  | "enforce"
  | "audit"
  | "improve";

export const GOVERNANCE_LOOP: readonly GovernancePhase[] = [
  "observe",
  "detect",
  "correct",
  "enforce",
  "audit",
  "improve",
];

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Enforcing a correction on a falsely-green deal flips it to at-risk. */
export function enforceCorrection(current: DealStatus): Result<DealStatus> {
  if (current !== "on-track") {
    return { ok: false, error: `nothing to enforce: deal is already ${current}` };
  }
  return { ok: true, value: "at-risk" };
}

export function nextPhase(phase: GovernancePhase): GovernancePhase | null {
  const i = GOVERNANCE_LOOP.indexOf(phase);
  return i >= 0 && i < GOVERNANCE_LOOP.length - 1 ? GOVERNANCE_LOOP[i + 1]! : null;
}
