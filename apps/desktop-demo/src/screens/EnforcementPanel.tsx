/**
 * EnforcementPanel screen — beats #6–10 · MNC#3, #4, #5 (the densest beat).
 *
 * Beat #6: the compiled EnforcementAction preview (EnforcementPreview, LIM-1234) —
 * the operator approves the *rule*, not just the text.
 * Then the enforced result: status flip On Track → At Risk (StatusBadge, MNC#3) →
 * simulated Linear workstream (LinearPayloadView, MNC#4) → required owners → blocked
 * customer update (the 3-part BlockedActionBanner, MNC#5 / LIM-1235).
 */
import { useDemo } from "../lib/demo-context.tsx";
import {
  BlockedActionBanner,
  EnforcementPreview,
  LinearPayloadView,
  StatusBadge,
} from "../components";
import { SCREEN_COPY } from "../lib/copy.ts";

/**
 * EnforcementPanel screen content — renders enforcement preview, status flip, and
 * blocked action with null checks. Throws if required fields are missing
 * (caught by parent ErrorBoundary).
 */
function EnforcementPanelContent() {
  const demo = useDemo();
  const {
    agentOutputPass1,
    gate,
    demoBeats,
    enforcementAction,
    linearWorkstreamPayload,
  } = demo;

  // Null checks for required fields
  if (!enforcementAction || !gate || !linearWorkstreamPayload || !agentOutputPass1 || !demoBeats) {
    throw new Error(
      `EnforcementPanel requires enforcementAction, gate, linearWorkstreamPayload, agentOutputPass1, demoBeats; got ${[
        !enforcementAction ? "missing enforcementAction" : "",
        !gate ? "missing gate" : "",
        !linearWorkstreamPayload ? "missing linearWorkstreamPayload" : "",
        !agentOutputPass1 ? "missing agentOutputPass1" : "",
        !demoBeats ? "missing demoBeats" : "",
      ]
        .filter(Boolean)
        .join(", ")}`,
    );
  }

  if (!enforcementAction.id || !enforcementAction.caseId || !enforcementAction.actor) {
    throw new Error(
      `EnforcementPanel requires enforcementAction.id, caseId, actor; got ${[
        !enforcementAction.id ? "missing id" : "",
        !enforcementAction.caseId ? "missing caseId" : "",
        !enforcementAction.actor ? "missing actor" : "",
      ]
        .filter(Boolean)
        .join(", ")}`,
    );
  }

  if (!gate.action) {
    throw new Error("EnforcementPanel requires gate.action but it is missing");
  }

  const copy = SCREEN_COPY.enforcementPanel;

  return (
    <section className="screen screen--enforcement-panel" aria-label={copy.title}>
      <p className="screen__intro">{copy.intro}</p>

      {/* Beat #6 — preview the compiled actions before Approve + Enforce. */}
      <EnforcementPreview actions={[enforcementAction]} />

      <div className="enforcement-panel__approval">
        <div className="enforcement-panel__approval-copy">
          <p className="enforcement-panel__eyebrow">Approve + Enforce</p>
          <p className="screen__fact">
            {enforcementAction.actor} enforces {enforcementAction.id} for case{" "}
            <strong>{enforcementAction.caseId}</strong>.
          </p>
        </div>

        <div className="enforcement-panel__status-flip" aria-label="Status changes from On Track to At Risk">
          <div className="enforcement-panel__status-node">
            <span className="enforcement-panel__label">Before</span>
            <StatusBadge status={enforcementAction.fromStatus} />
          </div>
          <span className="enforcement-panel__arrow" aria-hidden="true">→</span>
          <div className="enforcement-panel__status-node">
            <span className="enforcement-panel__label">After</span>
            <StatusBadge status={enforcementAction.toStatus} className="is-new" />
          </div>
        </div>
      </div>

      <LinearPayloadView payload={linearWorkstreamPayload} />

      <div className="enforcement-panel__attempt" aria-label="Attempted customer-facing on-track update">
        <p className="enforcement-panel__eyebrow">Attempted customer update</p>
        <p className="enforcement-panel__attempt-action">{gate.action}</p>
        <p className="enforcement-panel__attempt-message">
          "{demoBeats.agentClaim}" would repeat the pass-{agentOutputPass1.passNumber} false green.
        </p>
      </div>

      {/* Beat #10 / MNC#5 — the 3-part block: not allowed · why · required before send. */}
      <BlockedActionBanner gate={gate} />
    </section>
  );
}

export function EnforcementPanel() {
  return <EnforcementPanelContent />;
}

export default EnforcementPanel;
