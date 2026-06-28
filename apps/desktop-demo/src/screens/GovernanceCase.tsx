/**
 * GovernanceCase screen — beat #5 · MNC#2 (surface the detected governance case).
 * STUB created by LIM-1226 «spine-shell-v2». Filled by LIM-1218 «screen-governance-case».
 *
 * Renders the GovernanceCase Liminal opened for the dropped EU data-residency
 * requirement. Per AGENTS.md "two barrels": compose `Card` (../components) with the
 * `caseHeadline()` view-model helper from `@liminal-engine/ui-components`.
 */
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { SCREEN_COPY } from "../lib/copy.ts";

export function GovernanceCase() {
  const { governanceCase } = acmeScenario;
  const copy = SCREEN_COPY.governanceCase;

  return (
    <section className="screen screen--governance-case" aria-label={copy.title}>
      <p className="screen__intro">{copy.intro}</p>
      <p className="screen__fact">
        Case {governanceCase.id}: dropped <strong>{governanceCase.missedRequirement}</strong>{" "}
        ({governanceCase.severity}).
      </p>
      <p className="screen__stub-note">Stub — to be filled by LIM-1218 (MNC#2).</p>
    </section>
  );
}

export default GovernanceCase;
