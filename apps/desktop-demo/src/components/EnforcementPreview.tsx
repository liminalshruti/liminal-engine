/**
 * EnforcementPreview — renders the compiled EnforcementAction set before approval.
 *
 * Beat #6 requires the operator to approve the compiled enforcement rule, not only
 * the correction text. This component stays contract-typed and fixture-backed:
 * it displays the exact EnforcementAction objects passed from the demo scenario.
 */
import type { EnforcementAction } from "@liminal-engine/contracts";

export interface EnforcementPreviewProps {
  /** The compiled EnforcementAction objects queued for approval. */
  actions: readonly EnforcementAction[];
  /** Optional class name for styling override. */
  className?: string;
}

const ACTION_LABELS = {
  change_status: "Change status",
  create_linear_workstream: "Create Linear workstream",
  assign_owner: "Assign owner",
  block_agent_action: "Block agent action",
  require_approval: "Require approval",
  generate_eval: "Generate eval",
  activate_policy: "Activate policy",
  record_audit_event: "Record audit event",
} satisfies Record<NonNullable<EnforcementAction["actionType"]>, string>;

function formatStatus(status: EnforcementAction["fromStatus"]) {
  return status === "on-track" ? "On Track" : "At Risk";
}

function actionLabel(action: EnforcementAction) {
  if (action.actionType) return ACTION_LABELS[action.actionType];
  return "Change status";
}

function payloadEntries(action: EnforcementAction) {
  if (!action.payload) return [];
  return Object.entries(action.payload).map(([key, value]) => [key, formatPayloadValue(value)] as const);
}

function formatPayloadValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(formatPayloadValue).join(", ");
  if (value === null) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function EnforcementPreview({ actions, className }: EnforcementPreviewProps) {
  if (actions.length === 0) {
    return (
      <div className={`enforcement-preview enforcement-preview--empty${className ? ` ${className}` : ""}`}>
        <p className="enforcement-preview__empty">No compiled EnforcementActions.</p>
      </div>
    );
  }

  return (
    <section className={`enforcement-preview${className ? ` ${className}` : ""}`} aria-label="Compiled EnforcementActions">
      <div className="enforcement-preview__header">
        <span className="enforcement-preview__badge">Preview</span>
        <div>
          <h3 className="enforcement-preview__title">
            Compiled EnforcementActions
          </h3>
          <p className="enforcement-preview__subtitle">
            Rule set queued for approval before enforcement.
          </p>
        </div>
      </div>

      <ol className="enforcement-preview__list">
        {actions.map((action) => {
          const entries = payloadEntries(action);

          return (
            <li key={action.id} className="enforcement-preview__item">
              <div className="enforcement-preview__item-main">
                <span className="enforcement-preview__type">{actionLabel(action)}</span>
                <span className="enforcement-preview__id">{action.id}</span>
              </div>

              <p className="enforcement-preview__rule">
                {formatStatus(action.fromStatus)} → {formatStatus(action.toStatus)}
              </p>

              <dl className="enforcement-preview__meta">
                <div className="enforcement-preview__meta-row">
                  <dt>Case</dt>
                  <dd>{action.caseId}</dd>
                </div>
                <div className="enforcement-preview__meta-row">
                  <dt>Deal</dt>
                  <dd>{action.dealId}</dd>
                </div>
                <div className="enforcement-preview__meta-row">
                  <dt>Actor</dt>
                  <dd>{action.actor}</dd>
                </div>
                <div className="enforcement-preview__meta-row">
                  <dt>Enforced at</dt>
                  <dd>{action.enforcedAt}</dd>
                </div>
                {action.targetSystem && (
                  <div className="enforcement-preview__meta-row">
                    <dt>Target</dt>
                    <dd>{action.targetSystem}</dd>
                  </div>
                )}
              </dl>

              {entries.length > 0 && (
                <dl className="enforcement-preview__payload" aria-label={`${action.id} payload`}>
                  {entries.map(([key, value]) => (
                    <div key={key} className="enforcement-preview__payload-row">
                      <dt>{key}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default EnforcementPreview;
