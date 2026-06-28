/**
 * GovernanceCase screen — demo beat #5 of the locked required path (DEMO_CONTRACT.md):
 *   #5  Surface GovernanceCase (MNC#2) — Liminal formalizes the detected miss: the
 *       silently dropped, load-bearing EU data-residency requirement, surfaced WITH
 *       evidence (severity, category, when it was detected, and — when present — the
 *       business impact / where it went missing / recommended actions).
 *
 * Fills the LIM-1226 «spine-shell-v2» stub (task LIM-1218 «screen-governance-case»).
 *
 * Per apps/desktop-demo/AGENTS.md "two barrels": compose the generic `Card` widget
 * from the app `../components` barrel with the framework-agnostic `caseHeadline()`
 * view-model helper from `@liminal-engine/ui-components` — the screen renders, the
 * view model decides how a case is phrased.
 *
 * All demo facts come ONLY from the validated Acme fixtures
 * (`@liminal-engine/contracts/fixtures`) — no live calls, no invented data
 * (fixtures-only per Decision D1-a; LIM-1245 re-points to live governance-loop
 * output later). The SPEC.md evidence extensions (businessImpact / missingFrom /
 * recommendedActions) are optional on the contract, so each renders only when the
 * fixture carries it — absent fields are skipped, never faked.
 */
import { Card } from "../components";
import { caseHeadline } from "@liminal-engine/ui-components";
import { useDemo } from "../lib/demo-context.tsx";
import { SCREEN_COPY } from "../lib/copy.ts";

export function GovernanceCase() {
  const { governanceCase: c } = useDemo();
  const copy = SCREEN_COPY.governanceCase;

  return (
    <section className="screen screen--governance-case" aria-label={copy.title}>
      <p className="screen__intro">{copy.intro}</p>

      <Card title="Governance case">
        <p className="case__headline">
          <strong>{caseHeadline(c)}</strong>
        </p>

        <dl className="case__facts">
          <div className="case__fact">
            <dt>Case</dt>
            <dd>{c.id}</dd>
          </div>
          <div className="case__fact">
            <dt>Category</dt>
            <dd>{c.category}</dd>
          </div>
          <div className="case__fact">
            <dt>Status</dt>
            <dd>{c.status}</dd>
          </div>
          <div className="case__fact">
            <dt>Detected</dt>
            <dd>{c.detectedAt}</dd>
          </div>
          {c.businessImpact && (
            <div className="case__fact">
              <dt>Business impact</dt>
              <dd>{c.businessImpact}</dd>
            </div>
          )}
        </dl>

        {c.missingFrom && c.missingFrom.length > 0 && (
          <div className="case__evidence">
            <h3 className="case__evidence-title">Missing from</h3>
            <ul>
              {c.missingFrom.map((where) => (
                <li key={where}>{where}</li>
              ))}
            </ul>
          </div>
        )}

        {c.recommendedActions && c.recommendedActions.length > 0 && (
          <div className="case__evidence">
            <h3 className="case__evidence-title">Recommended actions</h3>
            <ul>
              {c.recommendedActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </section>
  );
}

export default GovernanceCase;
