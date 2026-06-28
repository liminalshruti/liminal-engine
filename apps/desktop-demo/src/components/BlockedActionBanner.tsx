/**
 * BlockedActionBanner — renders an ActionGate refusal.
 * Shows the blocked action, why it's gated (`reasons[]`), and what must hold
 * before it may be sent (`requiredBeforeSend[]`). Per the ActionGate contract,
 * allowance is DERIVED (`isAllowed`) — a gate with any reasons is not allowed —
 * so there is no persisted `blocked` boolean.
 * (DEMO_CONTRACT must-not-cut #5: False customer-facing "on track" update is blocked
 * until corrected.)
 */
import { isAllowed, type ActionGate } from "@liminal-engine/contracts";

export interface BlockedActionBannerProps {
  /** The action gate to display (action, reasons[], requiredBeforeSend[]). */
  gate: ActionGate;
  /** Optional class name for styling override. */
  className?: string;
}

export function BlockedActionBanner({ gate, className }: BlockedActionBannerProps) {
  // Derived per contract — a gate with no reasons is allowed; nothing to block.
  if (isAllowed(gate)) return null;

  return (
    <div className={`blocked-action-banner${className ? ` ${className}` : ""}`} role="alert">
      <div className="blocked-action-banner__icon">
        <span className="blocked-action-banner__icon-symbol">⊘</span>
      </div>
      <div className="blocked-action-banner__content">
        <h3 className="blocked-action-banner__action">{gate.action}</h3>

        <ul className="blocked-action-banner__reasons">
          {gate.reasons.map((reason, idx) => (
            <li key={idx} className="blocked-action-banner__reason">{reason}</li>
          ))}
        </ul>

        {gate.requiredBeforeSend.length > 0 && (
          <div className="blocked-action-banner__unblock-condition">
            <p className="blocked-action-banner__unblock-label">Required before send:</p>
            <ul className="blocked-action-banner__required">
              {gate.requiredBeforeSend.map((req, idx) => (
                <li key={idx} className="blocked-action-banner__required-item">{req}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default BlockedActionBanner;
