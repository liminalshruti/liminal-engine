/**
 * GovernanceCase screen — demo beat #5 of the locked required path (DEMO_CONTRACT.md):
 *   #5  Surface GovernanceCase (MNC#2) — Liminal formalizes the detected miss: the
 *       silently dropped, load-bearing EU data-residency requirement, surfaced WITH
 *       evidence (severity, category, when it was detected, and — when present — the
 *       business impact / where it went missing / recommended actions).
 *
 * STRETCH (lim-correction-template-ui): optionally display the CorrectionTemplateForm
 * below the case details, gated by feature flag, for the operator to select structured
 * templates + fill arguments instead of free-form text.
 *
 * Fills the LIM-1226 «spine-shell-v2» stub (task LIM-1218 «screen-governance-case»).
 * Refined case-detail hub layout per LIM-1256 (inline-highlighted violations, evidence
 * badges, cited-in-audit indicators).
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
import { useState } from "react";
import { Card, ViolationHighlight, CorrectionTemplateForm, CORRECTION_TEMPLATES } from "../components";
import type { TemplateSelection } from "../components";
import { caseHeadline } from "@liminal-engine/ui-components";
import { useDemo } from "../lib/demo-context.tsx";
import { SCREEN_COPY } from "../lib/copy.ts";
import "../styles/governance-case.css";

/**
 * GovernanceCase screen content — renders the detected governance case with null checks.
 * Throws if required fields are missing (caught by parent ErrorBoundary).
 */
export function GovernanceCase() {
  const demo = useDemo();
  const { governanceCase: c, agentOutputPass1 } = demo;
  const copy = SCREEN_COPY.governanceCase;

  // Null checks for required fields
  if (!c) {
    throw new Error("GovernanceCase requires governanceCase data but it is missing");
  }

  if (!c.id || !c.category || !c.status || !c.detectedAt) {
    throw new Error(
      `GovernanceCase requires id, category, status, detectedAt; got ${[
        !c.id ? "missing id" : "",
        !c.category ? "missing category" : "",
        !c.status ? "missing status" : "",
        !c.detectedAt ? "missing detectedAt" : "",
      ]
        .filter(Boolean)
        .join(", ")}`,
    );
  }

  // Determine severity styling class (blocking is the default for Acme scenario)
  const severityClass = c.severity || "blocking";

  // The false-green agent output (first pass)
  const agentClaim = agentOutputPass1?.summary || "";
  const droppedRequirements = agentOutputPass1?.droppedRequirements || [];

  // STRETCH: feature flag for correction template UI (lim-correction-template-ui).
  // Disable by default; can be enabled for judges via SUBMISSION.md.
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);

  const handleCorrectionSubmit = (
    selections: TemplateSelection[],
    freeTextReason: string,
  ) => {
    // STUB: In a real implementation, this would compile the correction
    // into enforcement actions via the gov-correct compiler.
    console.log("Correction submitted:", {
      selections,
      reason: freeTextReason,
      caseId: c.id,
    });

    // For demo purposes, acknowledge submission and hide the form.
    alert(`Correction saved for case ${c.id}. Templates: ${selections.length}`);
    setShowCorrectionForm(false);
  };

  return (
    <section className="screen screen--governance-case" aria-label={copy.title}>
      <p className="screen__intro">{copy.intro}</p>

      <Card title="Governance case" className="card--case-detail">
        {/* Case header with title, severity, and status */}
        <div className="case__header">
          <div className="case__title-row">
            <p className="case__headline">
              <strong>{caseHeadline(c)}</strong>
            </p>
            <span className={`case__severity-badge case__severity-badge--${severityClass}`}>
              {severityClass}
            </span>
            <span className={`case__status is-${c.status}`}>
              <span className="case__status-dot"></span>
              {c.status}
            </span>
          </div>
        </div>

          {/* Metadata facts grid */}
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
              <dt>Detected</dt>
              <dd>{c.detectedAt}</dd>
            </div>
          </dl>
        </div>

        {/* Business impact callout (if present) */}
        {c.businessImpact && (
          <div className="case__business-impact">
            <div className="case__business-impact-label">Business Impact</div>
            <p className="case__business-impact-text">{c.businessImpact}</p>
          </div>
        )}

        {/* False-green output section with inline violation highlighting */}
        {agentClaim && (
          <div className="case__output-section">
            <h3 className="case__output-title">First Pass Output</h3>
            <div className="case__output-card">
              <p className="case__output-text">
                {droppedRequirements.length > 0 && droppedRequirements[0] ? (
                  // Highlight the first dropped requirement inline
                  <ViolationHighlight
                    violation={droppedRequirements[0]}
                    fullText={agentClaim}
                    severity={severityClass as "blocking" | "high" | "medium" | "low"}
                  />
                ) : (
                  agentClaim
                )}
              </p>
            </div>
          </div>
        )}

        {/* Missing from section (evidence badge) */}
        {c.missingFrom && c.missingFrom.length > 0 && (
          <div className="case__evidence">
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2, 8px)" }}>
              <h3 className="case__evidence-title" style={{ margin: 0 }}>Missing from</h3>
              <span className="case__evidence-badge case__evidence-badge--cited">
                Cited in audit
              </span>
            </div>
            <ul>
              {c.missingFrom.map((where) => (
                <li key={where}>{where}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommended actions section */}
        {c.recommendedActions && c.recommendedActions.length > 0 && (
          <div className="case__evidence">
            <h3 className="case__evidence-title">Recommended Actions</h3>
            <ul>
              {c.recommendedActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* STRETCH: CorrectionTemplateForm (lim-correction-template-ui, feature flag gated) */}
      {showCorrectionForm && (
        <CorrectionTemplateForm
          governanceCase={c}
          templates={CORRECTION_TEMPLATES}
          onSubmit={handleCorrectionSubmit}
        />
      )}

      {/* STRETCH: Toggle button for correction form (demo / judge-friendly). */}
      {!showCorrectionForm && (
        <div className="governance-case__correction-toggle">
          <button
            onClick={() => setShowCorrectionForm(true)}
            className="governance-case__toggle-btn"
            aria-label="Open structured correction template form"
          >
            Add Structured Correction (STRETCH)
          </button>
          <p className="governance-case__toggle-note">
            Feature: constrained templates + structured args instead of free text.
          </p>
        </div>
      )}
    </section>
  );
}

export function GovernanceCase() {
  return <GovernanceCaseContent />;
}

export default GovernanceCase;
