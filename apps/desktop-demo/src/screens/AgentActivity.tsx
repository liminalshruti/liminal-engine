/**
 * AgentActivity screen — demo beat #3 of the locked required path (DEMO_CONTRACT.md):
 *   #3  Show the agent output — "Acme expansion appears on track" — the FALSE GREEN
 *       (must-not-cut #1).
 *
 * LIM-1239 layers trace cards onto the LIM-1217 false-green base: the screen still
 * shows the first-pass on-track claim, then proves which fixture-backed artifacts the
 * agent roles used and where the EU data-residency requirement was present but lost.
 * Fixtures only; no live integrations or persona names.
 */
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { falseGreenBanner } from "@liminal-engine/ui-components";
import { Card, StatusBadge } from "../components";
import { SCREEN_COPY } from "../lib/copy.ts";
import { buildAgentActivityTrace } from "./AgentActivityTrace.ts";

export function AgentActivity() {
  const {
    agentOutputPass1,
    businessGoal,
    demoBeats,
    governanceCase,
    linearWorkstreamPayload,
  } = acmeScenario;
  const copy = SCREEN_COPY.agentActivity;
  const banner = falseGreenBanner(agentOutputPass1);
  const trace = buildAgentActivityTrace({
    businessGoal,
    agentOutputPass1,
    governanceCase,
    linearWorkstreamPayload,
  });

  return (
    <section className="screen screen--agent-activity" aria-label={copy.title}>
      <p className="screen__intro">{copy.intro}</p>

      <Card title="False-green agent output" className="agent-activity__claim-card">
        <div className="agent-activity__status-row">
          <StatusBadge status={agentOutputPass1.reportedStatus} />
          <span className={`agent-activity__banner agent-activity__banner--${banner.tone}`}>
            {banner.label}
          </span>
        </div>
        <p className="agent-activity__claim">{demoBeats.agentClaim}</p>
        <p className="screen__fact">{agentOutputPass1.summary}</p>
        <p className="agent-activity__false-green-line">{trace.falseGreenLine}</p>
      </Card>

      <div className="agent-trace-grid" aria-label="Per-agent trace cards">
        {trace.cards.map((card) => (
          <Card
            key={card.id}
            title={card.agentRole}
            className={`agent-trace-card agent-trace-card--${card.tone}`}
          >
            <p className="agent-trace-card__summary">{card.traceSummary}</p>
            <ul className="agent-trace-card__artifacts" aria-label={`${card.agentRole} artifacts used`}>
              {card.artifacts.map((artifact) => (
                <li
                  key={`${card.id}-${artifact.label}-${artifact.value}`}
                  className={`agent-trace-card__artifact agent-trace-card__artifact--${artifact.state}`}
                >
                  <span className="agent-trace-card__artifact-label">{artifact.label}</span>
                  <span className="agent-trace-card__artifact-value">{artifact.value}</span>
                </li>
              ))}
            </ul>
            {card.missingRequirementLine && (
              <p className="agent-trace-card__missing-line">
                {card.missingRequirementLine}
              </p>
            )}
          </Card>
        ))}
      </div>

      <p className="agent-activity__evidence-line" aria-label="Missing requirement evidence line">
        <span className="agent-activity__evidence-label">Missing requirement evidence</span>
        <span>{trace.missingRequirementEvidenceLine.line}</span>
      </p>
    </section>
  );
}

export default AgentActivity;
