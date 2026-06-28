/**
 * RedactionNote — renders a single redacted data reference with explanation.
 *
 * Shows:
 * - The field label (non-sensitive description, e.g. "customer-claim")
 * - The redaction scheme (e.g. "canonical-sha256")
 * - The canonical-hash digest (the non-reversible reference)
 *
 * Used in the AuditTrail screen (beat #11, LIM-1248) to prove sensitive
 * customer data is stored by reference/hash, never raw, so the audit trail
 * can be replicated across regions without moving EU-personal data.
 */
import type { RedactedRef } from "@liminal-engine/contracts";

export interface RedactionNoteProps {
  /** The redacted reference (hash + scheme + optional label). */
  redactedRef: RedactedRef;
  /** Optional additional context or explanation. */
  description?: string;
  /** Optional class name for styling override. */
  className?: string;
}

export function RedactionNote({ redactedRef, description, className }: RedactionNoteProps) {
  return (
    <div className={`redaction-note${className ? ` ${className}` : ""}`}>
      {description && <p className="redaction-note__description">{description}</p>}

      <dl className="redaction-note__ref">
        <div className="redaction-note__row">
          <dt className="redaction-note__label">Field</dt>
          <dd className="redaction-note__value">{redactedRef.label || "[unlabeled]"}</dd>
        </div>

        <div className="redaction-note__row">
          <dt className="redaction-note__label">Stored as</dt>
          <dd className="redaction-note__value">{redactedRef.scheme} reference</dd>
        </div>

        <div className="redaction-note__row">
          <dt className="redaction-note__label">Reference hash</dt>
          <dd className="redaction-note__value redaction-note__hash">{redactedRef.hash}</dd>
        </div>

        <div className="redaction-note__row">
          <dt className="redaction-note__label">Status</dt>
          <dd className="redaction-note__value redaction-note__status">
            <span className="redaction-note__badge">Redacted</span>
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default RedactionNote;
