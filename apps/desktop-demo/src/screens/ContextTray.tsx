/**
 * ContextTray screen — demo beat #4 of the locked required path (DEMO_CONTRACT.md):
 *   #4  Reveal the lost EU data-residency requirement — the silently dropped,
 *       load-bearing customer requirement.
 *
 * Fills the LIM-1226 «spine-shell-v2» stub (task LIM-1216 «screen-context-tray»).
 * This is the context tray: the source material the agents worked from, presented as
 * context cards so the operator can see the Acme engagement, what the agents reported
 * back (the trace), and — the beat-#4 reveal — that the false green silently dropped
 * the load-bearing EU data-residency requirement. The GovernanceCase screen (beat #5)
 * then formalizes that miss into a detected case.
 *
 * All demo facts come ONLY from the validated Acme fixtures
 * (`@liminal-engine/contracts/fixtures`) — no live calls, no hardcoded or invented
 * data (apps/desktop-demo/AGENTS.md Locked Rules #2/#4; the fixtures are the LIM-1165
 * single source). Framing copy comes from the central demo-copy module
 * (`../lib/copy.ts`); each context card is composed inside the shared `Card` widget,
 * the reported status is shown with the shared `StatusBadge` (`../components`), and the
 * false-green insight is derived from the contract with the `falseGreenBanner`
 * view-model helper (`@liminal-engine/ui-components`). This screen has no simulated or
 * stubbed panel, so nothing carries a "Simulated" badge — that label is reserved for
 * the simulated Linear workstream (MNC#4, EnforcementPanel).
 */
import { Card, StatusBadge } from "../components";
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { falseGreenBanner } from "@liminal-engine/ui-components";
import { SCREEN_COPY } from "../lib/copy.ts";

export function ContextTray() {
  // Source material the agents worked from — the engagement, the output they reported
  // back (the trace), and the requirement that output silently dropped. Fixtures only.
  const { businessGoal, agentOutputPass1 } = acmeScenario;
  const copy = SCREEN_COPY.contextTray;
  const trace = falseGreenBanner(agentOutputPass1);

  return (
    <section className="screen screen--context-tray" aria-label={copy.title}>
      <p className="screen__intro">{copy.intro}</p>

      <Card title="Acme engagement">
        <p className="screen__fact">
          Deal under governance: <strong>{agentOutputPass1.dealName}</strong>
        </p>
        <p className="screen__fact">
          Business goal: <strong>{businessGoal}</strong>
        </p>
      </Card>

      <Card title="Agent trace">
        <p className="screen__fact">
          Pass {agentOutputPass1.passNumber} report: {agentOutputPass1.summary}
        </p>
        <p className="screen__fact">
          Reported status: <StatusBadge status={agentOutputPass1.reportedStatus} />
        </p>
        <p className="screen__fact">{trace.label}</p>
      </Card>

      <Card title="Lost requirement">
        <p className="screen__fact">
          The agents reported all workstreams green, but a load-bearing customer
          requirement was silently dropped from their work:
        </p>
        <ul>
          {agentOutputPass1.droppedRequirements.map((requirement) => (
            <li key={requirement} className="screen__fact">
              <strong>{requirement}</strong>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

export default ContextTray;
