/**
 * Shared UI components for the demo spine. UI calls the governance (application)
 * layer + contracts — never engine-core domain internals or live adapters
 * (enforced by .dependency-cruiser.cjs `ui-calls-application`).
 *
 * The concrete UI stack (Solid to match liminal-desktop, React, etc.) is chosen
 * when apps/desktop-demo is built — see CLAUDE.md "static clickable demo first".
 * View-model helpers that don't depend on a framework can live here now.
 */
import type { AgentOutput, GovernanceCase } from "@liminal-engine/contracts";

/** Framework-agnostic view model for the false-green banner. */
export function falseGreenBanner(output: AgentOutput): { label: string; tone: "green" | "warn" } {
  const dropped = output.droppedRequirements.length;
  return dropped > 0 && output.reportedStatus === "on-track"
    ? { label: `Reported on-track — ${dropped} requirement(s) silently dropped`, tone: "warn" }
    : { label: `Status: ${output.reportedStatus}`, tone: "green" };
}

export function caseHeadline(c: GovernanceCase): string {
  return `Dropped requirement: ${c.missedRequirement} (${c.severity})`;
}
