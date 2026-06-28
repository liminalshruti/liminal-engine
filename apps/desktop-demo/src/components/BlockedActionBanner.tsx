/**
 * BlockedActionBanner — renders the 3-part ActionGate refusal card.
 * Shows the blocked action as not allowed, why it's gated (`reasons[]`), and
 * what must hold before it may be sent (`requiredBeforeSend[]`). Per the ActionGate contract,
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

  const headingId = `${gate.id}-blocked-action-heading`;

  return (
    <div
      className={`blocked-action-banner${className ? ` ${className}` : ""}`}
      role="alert"
      aria-labelledby={headingId}
    >
      <div className="blocked-action-banner__icon" aria-hidden="true">
        <span className="blocked-action-banner__icon-symbol" aria-hidden="true">!</span>
      </div>
      <div className="blocked-action-banner__content">
        <section className="blocked-action-banner__part blocked-action-banner__part--not-allowed">
          <p className="blocked-action-banner__part-label">Not allowed</p>
          <h3 id={headingId} className="blocked-action-banner__action">{gate.action}</h3>
        </section>

        <section className="blocked-action-banner__part">
          <h4 className="blocked-action-banner__section-title">Why blocked</h4>
          <ul className="blocked-action-banner__reasons">
            {gate.reasons.map((reason, idx) => (
              <li key={idx} className="blocked-action-banner__reason">{reason}</li>
            ))}
          </ul>
        </section>

        <section className="blocked-action-banner__part blocked-action-banner__part--required">
          <h4 className="blocked-action-banner__section-title">Required before send</h4>
          {gate.requiredBeforeSend.length > 0 ? (
            <ul className="blocked-action-banner__required">
              {gate.requiredBeforeSend.map((req, idx) => (
                <li key={idx} className="blocked-action-banner__required-item">{req}</li>
              ))}
            </ul>
          ) : (
            <p className="blocked-action-banner__empty">No release condition supplied by the gate.</p>
          )}
        </section>
      </div>
    </div>
  );
}

export default BlockedActionBanner;
