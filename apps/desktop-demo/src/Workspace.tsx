/**
 * Workspace — the real operating surface (BUILD_PLAN Gap 3 / DIRECTIVE.md).
 *
 * NOT the 14-beat demo flow. A cold-start surface where an operator names a goal,
 * sees the streams they've pinned as substrate, and sees whether the AI work is
 * advancing the goal — the AI-spend drift case if it isn't. Renders the pure
 * `buildWorkspaceAssessment` result over whatever data is loaded; no narrator, no
 * fixed sequence.
 *
 * Styling uses the canonical Liminal design tokens (design-tokens.css) — never
 * redefined here (brand lock). Composes the shared `Card` widget.
 */
import { useMemo, useState } from "react";
import { InMemorySubstrate } from "@liminal-engine/substrate";
import { Card } from "./components";
import { buildWorkspaceAssessment } from "./lib/workspace.ts";
import "./styles/workspace.css";

/**
 * Seed substrate the operator can edit/extend — a starting example, not a locked
 * scenario. The point is the surface works on whatever is ingested.
 */
function seedSubstrate(): InMemorySubstrate {
  const s = new InMemorySubstrate();
  s.ingest({
    sourceType: "call-transcript",
    title: "Discovery call",
    content: "We will only pilot with EU data residency and SOC2 evidence.",
    provenance: "pinned",
  });
  s.ingest({
    sourceType: "proposal",
    title: "Proposal draft",
    content: "Includes SOC2 evidence and pricing — the agent team marked it on track.",
    provenance: "pinned",
  });
  s.ingest({
    sourceType: "launch-plan",
    title: "Launch plan",
    content: "Onboarding milestones and a SOC2 review step.",
    provenance: "pinned",
  });
  return s;
}

export function Workspace() {
  const [goalTitle, setGoalTitle] = useState(
    "Increase enterprise pilot conversion by 20% this quarter",
  );
  const [budgetUsd, setBudgetUsd] = useState(50_000);
  const [spendUsd, setSpendUsd] = useState(18_400);

  // The substrate + tracked requirements are fixed for this slice; the next
  // iteration adds an ingest tray. The assessment recomputes from the inputs.
  const substrate = useMemo(seedSubstrate, []);
  const assessment = useMemo(
    () =>
      buildWorkspaceAssessment({
        goal: { title: goalTitle, budgetUsd, metric: "enterprise pilots converted" },
        substrate,
        requirements: ["EU data residency", "SOC2 evidence"],
        statedIn: "call-transcript",
        spendUsd,
      }),
    [goalTitle, budgetUsd, spendUsd, substrate],
  );

  const utilizationPct = Math.round(assessment.alignment.budgetUtilization * 100);

  return (
    <main className="workspace" aria-label="Liminal operating workspace">
      <header className="workspace__head">
        <p className="workspace__eyebrow">Operating workspace</p>
        <label className="workspace__goal">
          <span className="workspace__goal-label">Goal this agent work must move</span>
          <input
            className="workspace__goal-input"
            value={goalTitle}
            onChange={(e) => setGoalTitle(e.target.value)}
            aria-label="Business goal"
          />
        </label>
        <div className="workspace__spend">
          <span>
            AI spend <strong>${spendUsd.toLocaleString()}</strong> of $
            {budgetUsd.toLocaleString()} budget ({utilizationPct}%)
          </span>
        </div>
      </header>

      <section className="workspace__grid">
        <Card title={`Substrate — ${assessment.streamCount} pinned streams`}>
          <ul className="workspace__streams">
            {substrate.streams().map((s) => (
              <li key={s.id} className="workspace__stream">
                <span className="workspace__stream-type">{s.sourceType}</span>
                <span className="workspace__stream-title">{s.title}</span>
              </li>
            ))}
          </ul>
        </Card>

        {assessment.driftCase ? (
          <Card title="Goal-alignment risk" className="workspace__risk" role="alert">
            <p className="workspace__risk-summary">{assessment.driftCase.businessImpact}</p>
            <p className="workspace__risk-label">Lost between the streams:</p>
            <ul className="workspace__lost">
              {assessment.lostRequirements.map((r) => (
                <li key={r} className="workspace__lost-item">
                  {r}
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card title="Goal alignment" className="workspace__aligned">
            <p className="workspace__aligned-summary">{assessment.alignment.summary}</p>
          </Card>
        )}
      </section>
    </main>
  );
}

export default Workspace;
