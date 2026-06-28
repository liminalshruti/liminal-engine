/**
 * EnforcementPanel screen — beats #6–10 · MNC#3, #4, #5 (the densest beat).
 *
 * LIM-1234 adds the compiled EnforcementAction preview for beat #6. LIM-1219 owns
 * the full enforcement-panel expansion for the status flip, Linear workstream, and
 * blocked customer update widgets.
 *
 * The full panel will render Approve + Enforce → status flip On Track → At Risk
 * (StatusBadge, MNC#3) → simulated Linear workstream (LinearPayloadView, MNC#4) →
 * required owners → blocked customer update (BlockedActionBanner, MNC#5).
 *
 * NOTE (LIM-1219): LinearPayloadView needs a `LinearWorkstreamPayload` fixture — tracked
 * as LIM-1249 (blocks this screen). Do NOT invent workstream data (Locked Rule #2).
 */
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { EnforcementPreview } from "../components";
import { SCREEN_COPY } from "../lib/copy.ts";

export function EnforcementPanel() {
  const { enforcementAction, blockedAction } = acmeScenario;
  const copy = SCREEN_COPY.enforcementPanel;

  return (
    <section className="screen screen--enforcement-panel" aria-label={copy.title}>
      <p className="screen__intro">{copy.intro}</p>
      <EnforcementPreview actions={[enforcementAction]} />
      <p className="screen__fact">
        Enforce {enforcementAction.id}: {enforcementAction.fromStatus} → {enforcementAction.toStatus}.
        Gate: {blockedAction.action}.
      </p>
    </section>
  );
}

export default EnforcementPanel;
