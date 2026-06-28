/**
 * AuditChain — visual proof that the audit hash chain is valid and tamper-evident.
 *
 * Renders:
 * - A visual chain representation (chained blocks)
 * - Chain validity check (✓ checkmark if valid)
 * - Explanation of what the chain proves (tamper-evidence, causality, ordering)
 *
 * Used in the AuditTrail screen (beat #11, LIM-1248) to demonstrate that
 * the audit ledger is append-only and tamper-evident — each event is hashed
 * with reference to the prior event, forming an unbroken chain back to genesis.
 */

export interface AuditChainProps {
  /** The title/label for the chain proof. */
  title?: string;
  /** Whether the chain is valid (all hashes verified). */
  isValid?: boolean;
  /** Number of events in the chain. */
  eventCount?: number;
  /** Optional class name for styling override. */
  className?: string;
}

export function AuditChain({
  title = "Audit chain integrity",
  isValid = true,
  eventCount = 1,
  className,
}: AuditChainProps) {
  return (
    <div className={`audit-chain${className ? ` ${className}` : ""}`}>
      <div className="audit-chain__header">
        <h3 className="audit-chain__title">{title}</h3>
        {isValid && <span className="audit-chain__valid-badge">Chain valid ✓</span>}
      </div>

      <p className="audit-chain__explanation">
        The audit trail is append-only and tamper-evident. Each event is hashed with reference
        to the prior event, forming an unbroken chain that proves causality, ordering, and
        tamper-evidence.
      </p>

      <div className="audit-chain__visual">
        <div className="audit-chain__chain-diagram">
          {/* Visual representation of the chain as connected blocks */}
          {[...Array(Math.min(eventCount, 3))].map((_, i) => (
            <div key={i} className="audit-chain__block-group">
              <div className="audit-chain__block">
                <span className="audit-chain__event-num">{i + 1}</span>
              </div>
              {i < Math.min(eventCount, 3) - 1 && (
                <div className="audit-chain__link">→</div>
              )}
            </div>
          ))}
          {eventCount > 3 && (
            <div className="audit-chain__block-group">
              <div className="audit-chain__block audit-chain__block--more">
                <span className="audit-chain__event-num">+{eventCount - 3}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <dl className="audit-chain__properties">
        <div className="audit-chain__property">
          <dt className="audit-chain__property-label">Total events</dt>
          <dd className="audit-chain__property-value">{eventCount}</dd>
        </div>
        <div className="audit-chain__property">
          <dt className="audit-chain__property-label">Integrity</dt>
          <dd className={`audit-chain__property-value ${isValid ? "audit-chain__property-value--valid" : "audit-chain__property-value--invalid"}`}>
            {isValid ? "Valid" : "Invalid"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default AuditChain;
