/**
 * LinearPayloadView — renders a simulated Linear workstream payload.
 * Shows the project name, workstream issues, and required owners (Product/Security/Engineering).
 * Labeled as "simulated" to indicate this is not a real Linear API call.
 * (DEMO_CONTRACT must-not-cut #4: Simulated Linear workstream appears +
 * required Product/Security/Engineering owners.)
 */

export interface LinearWorkstreamIssue {
  key: string;
  title: string;
  assignee?: string;
}

export interface LinearPayloadViewProps {
  /** The workstream project name. */
  projectName: string;
  /** The workstream issues (simulated). */
  issues: LinearWorkstreamIssue[];
  /** Required owners for this workstream (e.g., ["Product", "Security", "Engineering"]). */
  requiredOwners: readonly string[];
  /** Optional class name for styling override. */
  className?: string;
}

export function LinearPayloadView({
  projectName,
  issues,
  requiredOwners,
  className,
}: LinearPayloadViewProps) {
  return (
    <div className={`linear-payload${className ? ` ${className}` : ""}`}>
      <div className="linear-payload__header">
        <span className="linear-payload__simulated-badge">Simulated</span>
        <h3 className="linear-payload__title">{projectName}</h3>
      </div>

      <div className="linear-payload__section">
        <h4 className="linear-payload__section-title">Workstream Issues</h4>
        <ul className="linear-payload__issues">
          {issues.map((issue) => (
            <li key={issue.key} className="linear-payload__issue">
              <span className="linear-payload__issue-key">{issue.key}</span>
              <span className="linear-payload__issue-title">{issue.title}</span>
              {issue.assignee && (
                <span className="linear-payload__issue-assignee">{issue.assignee}</span>
              )}
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
