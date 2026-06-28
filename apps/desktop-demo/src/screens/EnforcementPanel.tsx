/**
 * EnforcementPanel screen — demo beats #6–10 of the locked required path (DEMO_CONTRACT.md).
 * The densest beat of the demo (covers 3 must-not-cut items):
 *   #6   Operator clicks Approve + Enforce — the compiled EnforcementAction preview
 *        (EnforcementPreview, from LIM-1234) is what gets approved.
 *   #7   Status changes On Track → At Risk (MNC#3) — the visible flip (StatusBadge).
 *   #8   Simulated Linear workstream appears (MNC#4) — LinearPayloadView, labeled "Simulated".
 *   #9   Product / Security / Engineering owners required — from the payload's requiredOwners.
 *   #10  False customer-facing "on track" update is blocked (MNC#5) — BlockedActionBanner,
 *        which renders the ActionGate reasons + what's required before send.
 *
 * Fills the LIM-1226 «spine-shell-v2» stub (task LIM-1219 «screen-enforcement-panel»),
 * extending the beat-#6 EnforcementPreview already added by LIM-1234.
 *
 * All demo facts come ONLY from the validated Acme fixtures
 * (`@liminal-engine/contracts/fixtures`) — no live calls, no invented workstream/owner
 * data (apps/desktop-demo/AGENTS.md Locked Rule #2; fixtures-only per Decision D1-a,
 * with LIM-1245 re-pointing to live loop output later). The Linear panel data is the
 * LIM-1249 `linearWorkstreamPayload` fixture. Widgets come from `../components`.
 */
import {
  BlockedActionBanner,
  Card,
  EnforcementPreview,
  LinearPayloadView,
  StatusBadge,
} from "../components";
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { SCREEN_COPY } from "../lib/copy.ts";

export function EnforcementPanel() {
  const { enforcementAction, linearWorkstreamPayload, blockedAction } = acmeScenario;
  const copy = SCREEN_COPY.enforcementPanel;

  return (
    <section className="screen screen--enforcement-panel" aria-label={copy.title}>
      <p className="screen__intro">{copy.intro}</p>

      {/* Beat #6 — the compiled EnforcementAction(s) the operator approves. */}
      <Card title="Approve + Enforce">
        <EnforcementPreview actions={[enforcementAction]} />
      </Card>

      {/* Beat #7 / MNC#3 — the visible status flip. */}
      <Card title="Deal status">
        <p className="screen__fact">
          <StatusBadge status={enforcementAction.fromStatus} /> →{" "}
          <StatusBadge status={enforcementAction.toStatus} />
        </p>
      </Card>

      {/* Beats #8–9 / MNC#4 — simulated Linear workstream + required Product/Security/Engineering owners. */}
      <Card title="Remediation workstream">
        <LinearPayloadView payload={linearWorkstreamPayload} />
      </Card>

      {/* Beat #10 / MNC#5 — the false customer-facing update is blocked until corrected. */}
      <BlockedActionBanner gate={blockedAction} />
    </section>
  );
}

export default EnforcementPanel;
