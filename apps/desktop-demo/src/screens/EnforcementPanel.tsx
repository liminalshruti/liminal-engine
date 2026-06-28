/**
 * EnforcementPanel screen — beats #6–10 · MNC#3, #4, #5 (the densest beat).
 * STUB created by LIM-1226 «spine-shell-v2». Filled by LIM-1219 «screen-enforcement-panel».
 *
 * Renders Approve + Enforce → status flip On Track → At Risk (StatusBadge, MNC#3) →
 * simulated Linear workstream (LinearPayloadView, MNC#4) → required owners → blocked
 * customer update (BlockedActionBanner, MNC#5).
 *
 * NOTE (LIM-1219): LinearPayloadView needs a `LinearWorkstreamPayload` fixture — tracked
 * as LIM-1249 (blocks this screen). Do NOT invent workstream data (Locked Rule #2).
 */
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { SCREEN_COPY } from "../lib/copy.ts";

export function EnforcementPanel() {
  const { enforcementAction, blockedAction } = acmeScenario;
  const copy = SCREEN_COPY.enforcementPanel;

  return (
    <section className="screen screen--enforcement-panel" aria-label={copy.title}>
      <p className="screen__intro">{copy.intro}</p>
      <p className="screen__fact">
        Enforce {enforcementAction.id}: {enforcementAction.fromStatus} → {enforcementAction.toStatus}.
        Gate: {blockedAction.action}.
      </p>
      <p className="screen__stub-note">Stub — to be filled by LIM-1219 (MNC#3,4,5). Needs LIM-1249 fixture.</p>
    </section>
  );
}

export default EnforcementPanel;
