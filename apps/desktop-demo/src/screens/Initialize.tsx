/**
 * Initialize screen — demo beats #1–2 of the locked required path (DEMO_CONTRACT.md):
 *   #1  Initialize workspace.
 *   #2  Show the Acme business goal — "Close Acme expansion by Friday — $1.2M ARR".
 *
 * Fills the LIM-1226 «spine-shell-v2» stub (task LIM-1215 «screen-initialize»). Beat
 * #1 establishes the governance workspace the rest of the demo runs in: the deal
 * under governance and the operator observing it (a ROLE, never an invented persona
 * name). Beat #2 surfaces the business goal verbatim.
 *
 * All demo facts come ONLY from the validated Acme fixtures
 * (`@liminal-engine/contracts/fixtures`) — no live calls, no hardcoded or invented
 * data (apps/desktop-demo/AGENTS.md Locked Rules). Framing copy comes from the
 * central demo-copy module (`../lib/copy.ts`); the workspace facts are composed
 * inside the shared `Card` widget (`../components`). This screen has no simulated or
 * stubbed panel, so nothing carries a "Simulated" badge — that label is reserved for
 * the simulated Linear workstream (MNC#4, EnforcementPanel).
 */
import { Card } from "../components";
import { useDemo } from "../lib/demo-context.tsx";
import { OPERATOR_ROLE, SCREEN_COPY } from "../lib/copy.ts";

/**
 * Initialize screen content — renders with null checks for required fields.
 * Throws if demo data is missing (caught by parent ErrorBoundary).
 */
function InitializeContent() {
  const demo = useDemo();
  const { businessGoal, agentOutputPass1 } = demo;

  // Null checks for required fields
  if (!agentOutputPass1 || !businessGoal) {
    throw new Error(
      `Initialize requires businessGoal and agentOutputPass1; got ${!businessGoal ? "missing businessGoal" : ""} ${!agentOutputPass1 ? "missing agentOutputPass1" : ""}`.trim(),
    );
  }

  if (!agentOutputPass1.dealName) {
    throw new Error("agentOutputPass1.dealName is required but missing");
  }

  const copy = SCREEN_COPY.initialize;

  return (
    <section className="screen screen--initialize" aria-label={copy.title}>
      <p className="screen__intro">{copy.intro}</p>

      <Card title={copy.title}>
        <p className="screen__fact">
          Deal under governance: {agentOutputPass1.dealName}
        </p>
        <p className="screen__fact">
          Business goal: <strong>{businessGoal}</strong>
        </p>
        <p className="screen__fact">
          Operator: {OPERATOR_ROLE}
        </p>
      </Card>
    </section>
  );
}

export function Initialize() {
  return <InitializeContent />;
}

export default Initialize;
