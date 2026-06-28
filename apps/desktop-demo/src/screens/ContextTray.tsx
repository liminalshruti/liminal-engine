/**
 * ContextTray screen — demo beat #4 of the locked required path (DEMO_CONTRACT.md):
 *   #4  Reveal the lost EU data-residency requirement — the silently dropped,
 *       load-bearing customer requirement.
 *
 * Base screen filled by LIM-1216 «screen-context-tray» (the Acme engagement, the agent
 * trace, and the lost requirement). AUGMENTED by LIM-1237 «evidence badges + cited-in-
 * case/audit»: every context card now carries the IDEAS.md `screen-context-tray`
 * affordances — its **source type**, a **provenance** tag (pinned doc vs live transcript
 * vs agent run), an **evidence badge**, and a **"cited in case / audit?"** indicator —
 * so provenance and evidence-use are legible at a glance and the #4 reveal lands: the
 * requirement lived in the source material, the agents' false green dropped it, and
 * Liminal's GovernanceCase / AuditEvent now cite it.
 *
 * Fixtures-first (apps/desktop-demo/AGENTS.md Locked Rules #2/#4): every load-bearing
 * FACT is read from the validated Acme fixtures (`@liminal-engine/contracts/fixtures`,
 * the LIM-1165 single source) — the dropped requirement (`governanceCase.missedRequirement`
 * = `agentOutputPass1.droppedRequirements`), the case + audit refs, the reported status.
 * The "cited" verdicts are COMPUTED from those fixtures, never hardcoded. The locked
 * scenario does not enumerate the underlying source documents, so the four document
 * cards stand in for them and are labelled **"Simulated"** (criterion: label any
 * simulated element) — their requirement strings still come from the fixture. The agent
 * trace card is real fixture data (`agentOutputPass1`), so it carries no Simulated badge.
 * No live calls; the deciding actor / persona is never named (a ROLE only). Framing copy
 * comes from `../lib/copy.ts`; each card composes the shared `Card` widget and the
 * reported status uses the shared `StatusBadge` (`../components`); the false-green
 * insight is derived with the `falseGreenBanner` view-model helper
 * (`@liminal-engine/ui-components`). Screen-scoped styling lives in the co-located
 * `ContextTray.css` (the shared `app.css` is owned elsewhere; tokens are referenced,
 * never redefined).
 */
import type { ReactNode } from "react";
import { Card, StatusBadge } from "../components";
import { useDemo } from "../lib/demo-context.tsx";
import { falseGreenBanner } from "@liminal-engine/ui-components";
import { SCREEN_COPY } from "../lib/copy.ts";
import "./ContextTray.css";

/** The provenance kind of a context source — IDEAS.md "live-stream vs pinned" affordance. */
type SourceType = "sales-call" | "proposal" | "launch-plan" | "product-scope" | "agent-trace";
type Capture = "pinned" | "live-transcript" | "agent-run";

const CAPTURE_LABEL: Record<Capture, string> = {
  pinned: "Pinned doc",
  "live-transcript": "Live transcript",
  "agent-run": "Agent run (fixture)",
};

interface SourceDocument {
  id: string;
  sourceType: SourceType;
  title: string;
  capture: Capture;
  /** Simulated scaffolding (no fixture backs it) → renders a "Simulated" badge. */
  simulated: boolean;
  /**
   * The load-bearing requirement this source stated, or null. Set to the fixture's
   * `governanceCase.missedRequirement` for the sources that captured it, so the "cited"
   * computation compares against the fixture value — never a hardcoded literal.
   */
  requirementStated: string | null;
  /** One-line description of the evidence this source contributes. */
  evidence: string;
  /** Short provenance/body line. */
  detail: string;
}

export function ContextTray() {
  // Load-bearing facts come ONLY from the locked Acme fixtures.
  const { businessGoal, agentOutputPass1, governanceCase, auditEvent } = useDemo();
  const copy = SCREEN_COPY.contextTray;
  const missedRequirement = governanceCase.missedRequirement;
  const trace = falseGreenBanner(agentOutputPass1);

  // The source material the agents worked from. The locked scenario carries the FACTS
  // (goal, agent claim, dropped requirement, case, audit) but not the underlying
  // documents, so these stand in for them — each labelled "Simulated". The requirement
  // string is read from the fixture (`missedRequirement`), so even the simulated cards
  // can't drift from the contract.
  const sourceDocuments: SourceDocument[] = [
    {
      id: "src_sales_call",
      sourceType: "sales-call",
      title: "Acme discovery call",
      capture: "live-transcript",
      simulated: true,
      requirementStated: missedRequirement,
      evidence: `Customer named ${missedRequirement} as a hard requirement.`,
      detail: "Buying-team call — a scripted transcript stands in for the live recording.",
    },
    {
      id: "src_product_scope",
      sourceType: "product-scope",
      title: "Acme product scope",
      capture: "pinned",
      simulated: true,
      requirementStated: missedRequirement,
      evidence: `${missedRequirement} listed as an in-scope deliverable.`,
      detail: "The agreed scope of deliverables for the expansion.",
    },
    {
      id: "src_proposal",
      sourceType: "proposal",
      title: "Acme expansion proposal",
      capture: "pinned",
      simulated: true,
      requirementStated: null,
      evidence: `Commercial terms only — no ${missedRequirement} clause.`,
      detail: "The signed-off commercial proposal for the expansion.",
    },
    {
      id: "src_launch_plan",
      sourceType: "launch-plan",
      title: "Acme launch plan",
      capture: "pinned",
      simulated: true,
      requirementStated: null,
      evidence: `Go-live timeline; ${missedRequirement} not gated.`,
      detail: "The delivery plan and milestones to the Friday go-live.",
    },
  ];

  // The GovernanceCase cites exactly its `missedRequirement`; a source that stated that
  // same requirement is the evidence the case rests on. The AuditEvent is the recorded
  // correction of that case (`auditEvent.caseId === governanceCase.id`), so the same
  // evidence carries into the audit trail. All derived from fixtures — no hardcoding.
  const citationsFor = (requirementStated: string | null) => {
    const citedInCase = requirementStated !== null && requirementStated === missedRequirement;
    const citedInAudit = citedInCase && auditEvent.caseId === governanceCase.id;
    return { citedInCase, citedInAudit };
  };

  // The agent trace is the false green: it DROPPED the requirement, so it is not a
  // citing source for the case — but its on-track status is the "before" the audit
  // records (`agentOutputPass1.reportedStatus === auditEvent.previousStatus`).
  const agentDroppedRequirement = agentOutputPass1.droppedRequirements.includes(missedRequirement);
  const agentCitedInAudit = agentOutputPass1.reportedStatus === auditEvent.previousStatus;

  return (
    <section className="screen screen--context-tray" aria-label={copy.title}>
      <p className="screen__intro">{copy.intro}</p>
      <p className="screen__fact">
        Engagement under governance: <strong>{agentOutputPass1.dealName}</strong> · {businessGoal}
      </p>
      <p className="context-tray__legend">
        Each source shows its <span className="context-tray__legend-tag">type</span>, an{" "}
        <span className="context-tray__legend-tag">evidence</span> badge, and whether that
        evidence is <span className="context-tray__legend-tag">cited</span> in the
        GovernanceCase / AuditEvent.
      </p>

      <div className="context-tray__grid">
        {sourceDocuments.map((doc) => {
          const { citedInCase, citedInAudit } = citationsFor(doc.requirementStated);
          return (
            <ContextCard
              key={doc.id}
              sourceType={doc.sourceType}
              title={doc.title}
              capture={doc.capture}
              simulated={doc.simulated}
              evidence={doc.evidence}
              requirementRelevant={doc.requirementStated !== null}
              citedInCase={citedInCase}
              citedInAudit={citedInAudit}
              caseId={governanceCase.id}
              auditId={auditEvent.id}
            >
              <p className="context-card__detail">{doc.detail}</p>
            </ContextCard>
          );
        })}

        <ContextCard
          sourceType="agent-trace"
          title={`Agent output — pass ${agentOutputPass1.passNumber}`}
          capture="agent-run"
          simulated={false}
          evidence={`Reported "${agentOutputPass1.reportedStatus}" — ${missedRequirement} silently dropped.`}
          requirementRelevant={agentDroppedRequirement}
          citedInCase={false}
          citedInAudit={agentCitedInAudit}
          caseId={governanceCase.id}
          auditId={auditEvent.id}
        >
          <p className="context-card__detail">{agentOutputPass1.summary}</p>
          <p className="context-card__status">
            Reported status: <StatusBadge status={agentOutputPass1.reportedStatus} />
          </p>
          <p className={`context-card__trace context-card__trace--${trace.tone}`}>{trace.label}</p>
        </ContextCard>
      </div>

      <div className="context-tray__reveal" role="note">
        <span className="context-tray__reveal-label">Beat #4 — the lost requirement</span>
        <p className="context-tray__reveal-text">
          <strong>{missedRequirement}</strong> was captured in the source material (the
          cited cards above) but silently dropped from the agents' output — the false
          green. Liminal's <strong>{governanceCase.id}</strong> now cites it as the missed
          requirement, and <strong>{auditEvent.id}</strong> records the correction.
        </p>
      </div>
    </section>
  );
}

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

/** A single context card: source type + provenance + evidence badge + cited indicators. */
function ContextCard({
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

export default ContextTray;
