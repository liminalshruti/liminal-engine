/**
 * AgentActivity screen — beat #3 · MNC#1 (the false green).
 * STUB created by LIM-1226 «spine-shell-v2». Filled by LIM-1217 «screen-agent-activity».
 *
 * Renders the first-pass agent output: "appears on track" while the EU data-residency
 * requirement is silently absent. Read from `acmeScenario.agentOutputPass1`.
 */
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { falseGreenBanner } from "@liminal-engine/ui-components";
import { Card, StatusBadge } from "../components";
import { SCREEN_COPY } from "../lib/copy.ts";
import {
  droppedRequirementForHighlight,
  sourceCallRequirementLine,
  splitInlineHighlight,
} from "./AgentActivityHighlight.ts";

export function AgentActivity() {
  const { agentOutputPass1, governanceCase, demoBeats } = acmeScenario;
  const copy = SCREEN_COPY.agentActivity;
  const droppedRequirement = droppedRequirementForHighlight(agentOutputPass1, governanceCase);
  const sourceLine = sourceCallRequirementLine(agentOutputPass1.dealName, droppedRequirement);
  const sourceSegments = splitInlineHighlight(sourceLine, droppedRequirement);
  const banner = falseGreenBanner(agentOutputPass1);

  return (
    <section className="screen screen--agent-activity" aria-label={copy.title}>
      <p className="screen__intro">{copy.intro}</p>
      <div className="dropped-requirement-compare" aria-label="Dropped requirement comparison">
        <Card title="Source call" className="dropped-requirement-compare__panel">
          <p className="dropped-requirement-compare__label">Requirement was present here</p>
          <p className="dropped-requirement-compare__line">
            {sourceSegments.map((segment, index) =>
              segment.highlight ? (
                <mark key={index} className="dropped-requirement-highlight">
                  {segment.text}
                </mark>
              ) : (
                <span key={index}>{segment.text}</span>
              ),
            )}
          </p>
        </Card>

        <Card title="First-pass agent output" className="dropped-requirement-compare__panel">
          <div className="agent-activity__status-row">
            <StatusBadge status={agentOutputPass1.reportedStatus} />
            <span className={`false-green-banner false-green-banner--${banner.tone}`}>
              {banner.label}
            </span>
          </div>
          <p className="agent-activity__claim">{demoBeats.agentClaim}</p>
          <p className="dropped-requirement-compare__line">
            <span>{agentOutputPass1.summary}</span>{" "}
            <mark
              className="dropped-requirement-highlight dropped-requirement-highlight--missing"
              aria-label={`${droppedRequirement} missing from downstream agent output`}
            >
              Missing: {droppedRequirement}
            </mark>
          </p>
        </Card>
      </div>

      <p className="dropped-requirement-compare__why">
        Why this is wrong: the output reports every workstream green while the customer call
        carried a blocking <strong>{droppedRequirement}</strong> requirement.
      </p>
    </section>
  );
}

export default AgentActivity;
