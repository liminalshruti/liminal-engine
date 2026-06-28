/**
 * EnforcementPanel screen — beats #6–10 · MNC#3, #4, #5 (the densest beat).
 *
 * Renders Approve + Enforce → status flip On Track → At Risk (StatusBadge, MNC#3) →
 * simulated Linear workstream (LinearPayloadView, MNC#4) → required owners → blocked
 * customer update (BlockedActionBanner, MNC#5).
 */
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { BlockedActionBanner, LinearPayloadView, StatusBadge } from "../components";
import { SCREEN_COPY } from "../lib/copy.ts";

export function EnforcementPanel() {
  const {
    agentOutputPass1,
    blockedAction,
    demoBeats,
    enforcementAction,
    linearWorkstreamPayload,
  } = acmeScenario;
  const copy = SCREEN_COPY.enforcementPanel;

  return (
    <section className="screen screen--enforcement-panel" aria-label={copy.title}>
      <p className="screen__intro">{copy.intro}</p>

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
            <StatusBadge status={enforcementAction.toStatus} />
          </div>
        </div>
      </div>

      <LinearPayloadView payload={linearWorkstreamPayload} />

      <div className="enforcement-panel__attempt" aria-label="Attempted customer-facing on-track update">
        <p className="enforcement-panel__eyebrow">Attempted customer update</p>
        <p className="enforcement-panel__attempt-action">{blockedAction.action}</p>
        <p className="enforcement-panel__attempt-message">
          "{demoBeats.agentClaim}" would repeat the pass-{agentOutputPass1.passNumber} false green.
        </p>
      </div>

      <BlockedActionBanner gate={blockedAction} />
    </section>
  );
}

export default EnforcementPanel;
