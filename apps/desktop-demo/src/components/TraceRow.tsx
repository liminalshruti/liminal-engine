/**
 * TraceRow — renders a single AuditEvent row in an audit trail.
 * Shows the actor (role), decision, before/after status, timestamp, and case reference.
 * (DEMO_CONTRACT must-not-cut #6: AuditEvent recorded — correction + deciding actor.)
 */
import type { AuditEvent } from "@liminal-engine/contracts";

export interface TraceRowProps {
  /** The audit event to display. */
  event: AuditEvent;
  /** Optional class name for styling override. */
  className?: string;
}

export function TraceRow({ event, className }: TraceRowProps) {
  // Format the timestamp for display (ISO → human-readable)
  const timestamp = new Date(event.recordedAt);
  const timeString = timestamp.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`trace-row${className ? ` ${className}` : ""}`}>
      <div className="trace-row__timestamp">
        <time className="trace-row__time" dateTime={event.recordedAt}>
          {timeString}
        </time>
      </div>

      <div className="trace-row__content">
        <div className="trace-row__header">
          <span className="trace-row__actor">{event.decidingActor}</span>
          <span className="trace-row__action">{event.action}</span>
        </div>

        <div className="trace-row__transition">
          <span className={`trace-row__status trace-row__status--from`}>{event.previousStatus}</span>
          <span className="trace-row__arrow">→</span>
          <span className={`trace-row__status trace-row__status--to`}>{event.newStatus}</span>
        </div>

        <div className="trace-row__metadata">
          <span className="trace-row__case-ref">Case: {event.caseId}</span>
          <span className="trace-row__deal-ref">Deal: {event.dealId}</span>
        </div>
      </div>
    </div>
  );
}

export default TraceRow;
