/**
 * ContextCard — individual context/evidence card for ContextTray screen.
 *
 * Renders a single source document or agent trace with:
 * - source type tag (sales-call / proposal / scope / launch / agent-trace)
 * - provenance badge (pinned doc / live transcript / agent run)
 * - evidence badge with requirement highlighting
 * - cited-in-case/audit indicators
 * - simulated badge (when no fixture backing)
 *
 * Part of IDEAS.md Demo/UX #2 — affordances make the governance case story legible:
 * what evidence was available, where it came from, and whether Liminal cited it.
 */

import type { ReactNode } from "react";
import { Card } from "./Card";

export type SourceType = "sales-call" | "proposal" | "launch-plan" | "product-scope" | "agent-trace";
export type Capture = "pinned" | "live-transcript" | "agent-run";

const CAPTURE_LABEL: Record<Capture, string> = {
  pinned: "Pinned doc",
  "live-transcript": "Live transcript",
  "agent-run": "Agent run (fixture)",
};

interface ContextCardProps {
  sourceType: SourceType;
  title: string;
  capture: Capture;
  simulated: boolean;
  evidence: string;
  /** Is the load-bearing dropped requirement present in / dropped from this source? */
  requirementRelevant: boolean;
  citedInCase: boolean;
  citedInAudit: boolean;
  caseId: string;
  auditId: string;
  children?: ReactNode;
}

/**
 * A single context card: source type + provenance + evidence badge + cited indicators.
 *
 * Composition order (top to bottom):
 * 1. Header: title + source-type/capture/simulated tags
 * 2. Evidence badge (with requirement highlighting)
 * 3. Body: optional children (detail, status, trace)
 * 4. Citations: cited-in-case/audit verdicts (pinned to bottom via flex)
 */
export function ContextCard({
  sourceType,
  title,
  capture,
  simulated,
  evidence,
  requirementRelevant,
  citedInCase,
  citedInAudit,
  caseId,
  auditId,
  children,
}: ContextCardProps) {
  return (
    <Card className="context-card">
      <header className="context-card__head">
        <h3 className="context-card__title">{title}</h3>
        <div className="context-card__tags">
          <span className="context-card__type" title="Source type">
            {sourceType}
          </span>
          <span className="context-card__capture">{CAPTURE_LABEL[capture]}</span>
          {simulated && <span className="context-card__simulated">Simulated</span>}
        </div>
      </header>

      <div
        className={`context-card__evidence${requirementRelevant ? " context-card__evidence--requirement" : ""}`}
      >
        <span className="context-card__evidence-label">Evidence</span>
        <span className="context-card__evidence-text">{evidence}</span>
      </div>

      {children ? <div className="context-card__body">{children}</div> : null}

      <div className="context-card__citations">
        <Citation label="Cited in GovernanceCase" refId={caseId} cited={citedInCase} />
        <Citation label="Cited in AuditEvent" refId={auditId} cited={citedInAudit} />
      </div>
    </Card>
  );
}

/** One "cited in X?" indicator — answers whether this card's evidence is cited in X. */
function Citation({ label, refId, cited }: { label: string; refId: string; cited: boolean }) {
  return (
    <div className={`context-card__cite context-card__cite--${cited ? "yes" : "no"}`}>
      <span className="context-card__cite-mark" role="img" aria-label={cited ? "cited" : "not cited"}>
        {cited ? "✓" : "✗"}
      </span>
      <span className="context-card__cite-label">{label}</span>
      <span className="context-card__cite-verdict">{cited ? "Yes" : "No"}</span>
      <span className="context-card__cite-ref">{refId}</span>
    </div>
  );
}

export default ContextCard;
