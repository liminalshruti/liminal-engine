/**
 * LinearPayloadView — renders a simulated Linear workstream payload.
 * Typed against the `LinearWorkstreamPayload` contract (title + workstreams
 * [{title,status,owner}] + requiredOwners). Labeled "Simulated" — this is not a
 * real Linear API call (DEMO_CONTRACT cut-if-risky).
 * (DEMO_CONTRACT must-not-cut #4: Simulated Linear workstream appears +
 * required Product/Security/Engineering owners.)
 */
import type { LinearWorkstreamPayload } from "@liminal-engine/contracts";

export interface LinearPayloadViewProps {
  /** The simulated Linear workstream payload (LinearWorkstreamPayload contract). */
  payload: LinearWorkstreamPayload;
  /** Optional class name for styling override. */
  className?: string;
}

export function LinearPayloadView({ payload, className }: LinearPayloadViewProps) {
  const { title, workstreams, requiredOwners } = payload;

  return (
    <div className={`linear-payload${className ? ` ${className}` : ""}`}>
      <div className="linear-payload__header">
        <span className="linear-payload__simulated-badge">Simulated</span>
        <h3 className="linear-payload__title">{title}</h3>
      </div>

      <div className="linear-payload__section">
        <h4 className="linear-payload__section-title">Workstreams</h4>
        <ul className="linear-payload__issues">
          {workstreams.map((ws, idx) => (
            <li key={idx} className="linear-payload__issue">
              <span className={`linear-payload__issue-status linear-payload__issue-status--${ws.status}`}>
                {ws.status}
              </span>
              <span className="linear-payload__issue-title">{ws.title}</span>
              <span className="linear-payload__issue-assignee">{ws.owner}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="linear-payload__section">
        <h4 className="linear-payload__section-title">Required Owners</h4>
        <div className="linear-payload__owners">
          {requiredOwners.map((owner) => (
            <span key={owner} className="linear-payload__owner-badge">
              {owner}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default LinearPayloadView;
