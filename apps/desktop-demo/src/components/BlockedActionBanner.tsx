/**
 * BlockedActionBanner — renders an ActionGate refusal.
 * Shows the blocked action, the reason, and what is required before send (to unblock).
 * (DEMO_CONTRACT must-not-cut #5: False customer-facing "on track" update is blocked
 * until corrected.)
 */
import type { ActionGate } from "@liminal-engine/contracts";

export interface BlockedActionBannerProps {
  /** The action gate to display (contains the action, reason, requiredBeforeSend). */
  gate: ActionGate;
  /** Optional class name for styling override. */
  className?: string;
}

export function BlockedActionBanner({ gate, className }: BlockedActionBannerProps) {
  return (
    <div className={`blocked-action-banner${className ? ` ${className}` : ""}`} role="alert">
      <div className="blocked-action-banner__icon">
        <span className="blocked-action-banner__icon-symbol">⊘</span>
      </div>
      <div className="blocked-action-banner__content">
        <h3 className="blocked-action-banner__action">{gate.action}</h3>
        <p className="blocked-action-banner__reason">{gate.reason}</p>

        {gate.unblockedByCaseCorrection && (
          <div className="blocked-action-banner__unblock-condition">
            <p className="blocked-action-banner__unblock-label">
              Unblocked when the governance case is corrected and verified.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default BlockedActionBanner;
