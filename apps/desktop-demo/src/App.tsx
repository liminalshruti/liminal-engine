import { useEffect, useRef, useState } from "react";
import { DEMO_STEPS, PHASE_LABEL } from "./steps.tsx";
import { DemoProvider } from "./lib/demo-context.tsx";
import { ErrorBoundary } from "./components";
import { useDemo } from "./lib/demo-context.tsx";

/**
 * Demo spine SHELL — Cut-01 workbench layout for Liminal Engine
 * Renders: frame → titlebar (with mission line + case pill) → phase row →
 * three-pane main (rail-left case timeline | slate-area | rail-right agency) →
 * frame receipt. The 14 beats map to 7 screens; all navigation preserved.
 *
 * Data: wrapped in <DemoProvider>, runs governance loop once, feeds live output
 * to screens via `useDemo()` (byte-identical to fixtures, LIM-1255).
 *
 * Hard rules: No changes to engine/logic/contracts/copy-meaning. All 14 beats +
 * 7 MNC visible. Right rail derives agency state from the current beat index to
 * narrate loop progression (this is honest: beat index IS real demo state).
 * Tray is lowest priority (deferred).
 */
export function App() {
  return (
    <ErrorBoundary screenName="App">
      <DemoProvider>
        <DemoShell />
      </DemoProvider>
    </ErrorBoundary>
  );
}

/**
 * Derive the display state of each agency row based on the current beat index.
 * Returns a tuple: [role, state, variant] for each agency section.
 * Variant controls CSS styling (alarm/watch, judgment, outreach, synthesis, etc.).
 * This narrates the loop's progression without fabricating live agent data.
 */
function deriveAgencyState(beatIndex: number): Array<{
  role: string;
  state: string;
  variant?: string;
}> {
  const beat = beatIndex + 1; // 1-based

  // Beats 1-2: Observe phase, everything calm/pending
  if (beat <= 2) {
    return [
      { role: "GTM", state: "◯ reading", variant: "pending" },
      { role: "Product", state: "◯ pending", variant: "pending" },
      { role: "Security", state: "◯ pending", variant: "pending" },
      { role: "Launch", state: "◯ pending", variant: "pending" },
      { role: "Gate", state: "—", variant: "idle" },
      { role: "Eval", state: "—", variant: "idle" },
    ];
  }

  // Beats 3-4: False green detected, GTM read, Product MISSED appears
  if (beat <= 4) {
    return [
      { role: "GTM", state: "◉ read", variant: "done" },
      { role: "Product", state: "⊘ MISSED", variant: "alarm" },
      { role: "Security", state: "◯ reading", variant: "pending" },
      { role: "Launch", state: "◯ pending", variant: "pending" },
      { role: "Gate", state: "—", variant: "idle" },
      { role: "Eval", state: "—", variant: "idle" },
    ];
  }

  // Beat 5: GovernanceCase surfaces, Security required appears
  if (beat <= 5) {
    return [
      { role: "GTM", state: "◉ read", variant: "done" },
      { role: "Product", state: "⊘ MISSED", variant: "alarm" },
      { role: "Security", state: "● required", variant: "judgment" },
      { role: "Launch", state: "◯ pending", variant: "pending" },
      { role: "Gate", state: "—", variant: "idle" },
      { role: "Eval", state: "—", variant: "idle" },
    ];
  }

  // Beats 6-7: Enforce begins, operator approves, status flip happens
  if (beat <= 7) {
    return [
      { role: "GTM", state: "◉ read", variant: "done" },
      { role: "Product", state: "⊘ MISSED", variant: "alarm" },
      { role: "Security", state: "● required", variant: "judgment" },
      { role: "Launch", state: "◯ pending", variant: "pending" },
      { role: "Gate", state: "◯ active", variant: "watching" },
      { role: "Eval", state: "—", variant: "idle" },
    ];
  }

  // Beats 8-10: Workstream, owners, blocked action — Gate becomes DENY here
  if (beat <= 10) {
    return [
      { role: "GTM", state: "◉ read", variant: "done" },
      { role: "Product", state: "⊘ MISSED", variant: "alarm" },
      { role: "Security", state: "● required", variant: "judgment" },
      { role: "Launch", state: "◯ assigned", variant: "watching" },
      { role: "Gate", state: "⊗ DENY", variant: "alarm" },
      { role: "Eval", state: "—", variant: "idle" },
    ];
  }

  // Beat 11: Audit phase begins, Gate DENY stays
  if (beat <= 11) {
    return [
      { role: "GTM", state: "◉ read", variant: "done" },
      { role: "Product", state: "⊘ MISSED", variant: "alarm" },
      { role: "Security", state: "● required", variant: "judgment" },
      { role: "Launch", state: "◯ assigned", variant: "watching" },
      { role: "Gate", state: "⊗ DENY", variant: "alarm" },
      { role: "Eval", state: "◯ auditing", variant: "watching" },
    ];
  }

  // Beats 12-13: Improve phase, second pass eval begins
  if (beat <= 13) {
    return [
      { role: "GTM", state: "◉ read", variant: "done" },
      { role: "Product", state: "⊘ MISSED", variant: "alarm" },
      { role: "Security", state: "● required", variant: "judgment" },
      { role: "Launch", state: "◯ assigned", variant: "watching" },
      { role: "Gate", state: "⊗ DENY", variant: "alarm" },
      { role: "Eval", state: "◯ improving", variant: "watching" },
    ];
  }

  // Beat 14: Final state — Eval shows PASS, loop complete
  return [
    { role: "GTM", state: "◉ read", variant: "done" },
    { role: "Product", state: "⊘ MISSED", variant: "alarm" },
    { role: "Security", state: "● required", variant: "judgment" },
    { role: "Launch", state: "◯ assigned", variant: "watching" },
    { role: "Gate", state: "⊗ DENY", variant: "alarm" },
    { role: "Eval", state: "✓ PASS", variant: "synthesis" },
  ];
}

function DemoShell() {
  const [i, setI] = useState(0);
  const step = DEMO_STEPS[i]!;
  const last = DEMO_STEPS.length - 1;
  const Screen = step.screen;
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previousIndexRef = useRef(i);
  const previousStep = i > 0 ? DEMO_STEPS[i - 1] : undefined;
  const nextStep = i < last ? DEMO_STEPS[i + 1] : undefined;

  useEffect(() => {
    if (previousIndexRef.current === i) {
      return;
    }
    previousIndexRef.current = i;
    titleRef.current?.focus();
  }, [i]);

  const agencyState = deriveAgencyState(i);

  return (
    <div className="app">
      <button type="button" className="skip-link" onClick={() => titleRef.current?.focus()}>
        Skip to current demo beat
      </button>

      <div className="frame">
        {/* Titlebar: traffic lights + mission line + case pill */}
        <header className="titlebar">
          <div className="lights">
            <span className="light red"></span>
            <span className="light yellow"></span>
            <span className="light green"></span>
          </div>
          <div className="title-row">
            <span className="diamond">◇</span>
            <span className="tb-wedge">Liminal Engine · agentic work governance · corrections become control</span>
          </div>
          <div className="case-pill">
            <span className="diamond">◇</span>
            <span className="case-name">case gc_acme_eu</span>
            <span className="chain-badge">chain verified</span>
          </div>
        </header>

        {/* Phase row: observe · detect · enforce · audit · improve */}
        <nav className="phase-row" aria-label="Governance phases">
          {(['observe', 'detect', 'enforce', 'audit', 'improve'] as const).map((phase) => {
            const isActive = step.phase === phase;
            return (
              <div
                key={phase}
                className={`phase-item${isActive ? ' is-active' : ''}`}
                data-phase={phase}
              >
                <span className="phase-label">{phase}</span>
              </div>
            );
          })}
          <div className="phase-spacer"></div>
          <div className="scenario-meta">
            <span className="scenario-name">Acme Expansion</span>
            <span className="scenario-value">$1.2M</span>
          </div>
        </nav>

        {/* Main: three-pane layout */}
        <main className="main">
          {/* Left rail: case timeline (14 beats + a11y labels) */}
          <aside className="rail-left">
            <div className="rail-header">
              <span className="rail-label">Case Timeline</span>
            </div>
            <div className="rail-list">
              {DEMO_STEPS.map((d, idx) => (
                <button
                  key={d.n}
                  className={`rail-item${idx === i ? " is-active" : ""}${idx < i ? " is-done" : ""}`}
                  onClick={() => setI(idx)}
                  aria-current={idx === i ? "step" : undefined}
                  aria-label={`Beat ${d.n}: ${d.title}. ${PHASE_LABEL[d.phase]} phase${
                    d.mustNotCut ? `. Must-not-cut ${d.mustNotCut}` : ""
                  }.`}
                >
                  <span className="rail-n">{d.n}</span>
                  <span className="rail-title">{d.title}</span>
                </button>
              ))}
            </div>
          </aside>

          {/* Center: slate area with current screen */}
          <section className="slate-area">
            <div className="slate-metadata">
              <span className="beat-label">Beat {step.n} / 14</span>
              {step.mustNotCut && (
                <span className="mnc-label">must-not-cut #{step.mustNotCut}</span>
              )}
            </div>
            <h1 className="slate-title" ref={titleRef} tabIndex={-1}>
              {step.title}
            </h1>
            <div className="slate-content">
              <ErrorBoundary screenName={`Beat ${step.n}: ${step.title}`}>
                <Screen />
              </ErrorBoundary>
            </div>
          </section>

          {/* Right rail: agency/gate/eval architecture — derives state from beat index */}
          <aside className="rail-right">
            <div className="rail-header">
              <span className="rail-label">Loop Progression</span>
            </div>
            <div className="agency-diagram">
              {agencyState.map((item) => (
                <div
                  key={item.role}
                  className={`agency-section${
                    item.variant === "alarm" ? " agency-alarm" : ""
                  }${item.variant === "judgment" ? " agency-judgment" : ""}${
                    item.variant === "watching" ? " agency-watching" : ""
                  }${item.variant === "synthesis" ? " agency-synthesis" : ""}${
                    item.variant === "idle" ? " agency-idle" : ""
                  }${item.variant === "done" ? " agency-done" : ""}`}
                >
                  <div className="agency-role">{item.role}</div>
                  <div className="agency-state">{item.state}</div>
                </div>
              ))}
            </div>
          </aside>
        </main>

        {/* Frame receipt: persistent one-liner */}
        <footer className="frame-receipt">
          <span className="receipt-diamond">◇</span>
          <span className="receipt-text">chain verified · case gc_acme_eu · action ea_001 · audit ae_001 · eval ec_001 · gate denied</span>
        </footer>
      </div>

      {/* Navigation buttons */}
      <div className="demo-nav">
        <button
          disabled={i === 0}
          onClick={() => setI((v) => Math.max(0, v - 1))}
          aria-label={
            previousStep
              ? `Back to beat ${previousStep.n}: ${previousStep.title}`
              : "Back unavailable on first beat"
          }
        >
          ← Back
        </button>
        <button
          className="demo-nav-primary"
          disabled={i === last}
          onClick={() => setI((v) => Math.min(last, v + 1))}
          aria-label={
            nextStep
              ? `Next to beat ${nextStep.n}: ${nextStep.title}`
              : "End of demo"
          }
        >
          {i === last ? "End of demo" : "Next →"}
        </button>
      </div>
    </div>
  );
}
