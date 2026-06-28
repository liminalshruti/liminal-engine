/**
 * GovernanceCase screen — beat #5 · MNC#2 (surface the detected governance case).
 * STUB created by LIM-1226 «spine-shell-v2». Filled by LIM-1218 «screen-governance-case».
 *
 * Renders the GovernanceCase Liminal opened for the dropped EU data-residency
 * requirement. Per AGENTS.md "two barrels": compose `Card` (../components) with the
 * `caseHeadline()` view-model helper from `@liminal-engine/ui-components`.
 */
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { caseHeadline } from "@liminal-engine/ui-components";
import { Card } from "../components";
import { SCREEN_COPY } from "../lib/copy.ts";
import {
  droppedRequirementForHighlight,
  sourceCallRequirementLine,
  splitInlineHighlight,
} from "./AgentActivityHighlight.ts";

export function GovernanceCase() {
  const { agentOutputPass1, governanceCase } = acmeScenario;
  const copy = SCREEN_COPY.governanceCase;
  const droppedRequirement = droppedRequirementForHighlight(agentOutputPass1, governanceCase);
  const sourceLine = sourceCallRequirementLine(agentOutputPass1.dealName, droppedRequirement);
  const sourceSegments = splitInlineHighlight(sourceLine, droppedRequirement);

  return (
    <section className="screen screen--governance-case" aria-label={copy.title}>
      <p className="screen__intro">{copy.intro}</p>
      <Card title={caseHeadline(governanceCase)} className="governance-case-card">
        <dl className="governance-case-card__meta" aria-label="Governance case metadata">
          <div>
            <dt>Case</dt>
            <dd>{governanceCase.id}</dd>
          </div>
          <div>
            <dt>Severity</dt>
            <dd>{governanceCase.severity}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{governanceCase.status}</dd>
          </div>
        </dl>

        <div className="governance-case-card__evidence" aria-label="Inline dropped requirement evidence">
          <div className="governance-case-card__evidence-row">
            <p className="dropped-requirement-compare__label">Present in the call</p>
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
          </div>

          <div className="governance-case-card__evidence-row governance-case-card__evidence-row--missing">
            <p className="dropped-requirement-compare__label">Missing downstream</p>
            <p className="dropped-requirement-compare__line">
              <span>{agentOutputPass1.summary}</span>{" "}
              <mark
                className="dropped-requirement-highlight dropped-requirement-highlight--missing"
                aria-label={`${droppedRequirement} missing from downstream agent output`}
              >
                Missing: {droppedRequirement}
              </mark>
            </p>
          </div>
        </div>

        <p className="governance-case-card__finding">
          Liminal opened this case because the agent marked the Acme expansion on track
          while omitting the blocking <strong>{droppedRequirement}</strong> requirement.
        </p>
      </Card>
    </section>
  );
}

export default GovernanceCase;
