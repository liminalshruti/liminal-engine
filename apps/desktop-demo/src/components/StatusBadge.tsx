/**
 * StatusBadge — renders a deal status (on-track | at-risk) with visual distinction.
 * Used across multiple screens to show the visible deal-status state.
 * (DEMO_CONTRACT must-not-cut #3: status flip On Track → At Risk.)
 */
import type { AgentOutput } from "@liminal-engine/contracts";

export interface StatusBadgeProps {
  /** The agent output or deal status to display. */
  status: AgentOutput["reportedStatus"];
  /** Optional class name for styling override. */
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const isAtRisk = status === "at-risk";
  const label = status === "on-track" ? "On Track" : "At Risk";

  return (
    <span
      className={`status-badge status-badge--${status}${className ? ` ${className}` : ""}`}
      role="status"
      aria-label={`Deal status: ${label}`}
    >
      <span className="status-badge__dot" />
      <span className="status-badge__label">{label}</span>
    </span>
  );
}

export default StatusBadge;
