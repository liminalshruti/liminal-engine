import { useEffect, useRef, useState } from "react";
import { DEMO_STEPS, PHASE_LABEL } from "./steps.tsx";
import { DemoProvider } from "./lib/demo-context.tsx";
import { ErrorBoundary } from "./components";

/**
 * Demo spine SHELL — the static clickable frame for the 14-step required path
 * (DEMO_CONTRACT.md). Renders the stepper rail and, in the stage, the SCREEN
 * mapped to the active beat (`step.screen`). The 14 beats map onto 7 screens
 * (LIM-1226 «spine-shell-v2»); screen agents fill each screen's stub — App.tsx
 * is not edited per screen.
 *
 * Data: wrapped in <DemoProvider>, which runs the REAL governance loop once
 * (`buildGovernanceDemo`) and feeds its output to the screens via `useDemo()` —
 * the screens render live engine output, not raw fixtures (LIM-1255). The result is
 * byte-identical to the locked fixtures (determinism), so the walkthrough is unchanged.
 *
 * Error handling: each screen is wrapped in an ErrorBoundary that catches render
 * errors and displays them gracefully, plus each screen has null-check stubs to
 * validate required data before rendering (AGENTS.md Rule 6: real error handling for
 * real edge cases).
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

  return (
    <div className="app">
      <button type="button" className="skip-link" onClick={() => titleRef.current?.focus()}>
        Skip to current demo beat
      </button>

      <header className="app__bar">
        <span className="app__brand">Liminal Engine</span>
        <span className="app__scenario">Acme Expansion · $1.2M · governance demo</span>
        <span className="app__loop">observe → detect → correct → enforce → audit → improve</span>
      </header>

      <div className="app__body">
        <nav className="rail" aria-label="Demo steps">
          {DEMO_STEPS.map((d, idx) => (
            <button
              key={d.n}
              className={`rail__step${idx === i ? " is-active" : ""}${idx < i ? " is-done" : ""}`}
              onClick={() => setI(idx)}
              aria-current={idx === i ? "step" : undefined}
              aria-label={`Beat ${d.n}: ${d.title}. ${PHASE_LABEL[d.phase]} phase${
                d.mustNotCut ? `. Must-not-cut ${d.mustNotCut}` : ""
              }.`}
            >
              <span className="rail__n">{d.n}</span>
              <span className="rail__title">{d.title}</span>
              <span className={`rail__phase rail__phase--${d.phase}`}>{PHASE_LABEL[d.phase]}</span>
            </button>
          ))}
        </nav>

        <main id="demo-stage" className="stage" aria-labelledby="demo-stage-title" tabIndex={-1}>
          <div className="stage__head">
            <span className="stage__beat">Beat {step.n} / 14</span>
            <span className={`stage__phase stage__phase--${step.phase}`}>{PHASE_LABEL[step.phase]}</span>
            {step.mustNotCut && (
              <span className="stage__mnc">must-not-cut #{step.mustNotCut}</span>
            )}
          </div>
          <h1 id="demo-stage-title" ref={titleRef} className="stage__title" tabIndex={-1}>
            {step.title}
          </h1>

          <div className="stage__screen">
            <ErrorBoundary screenName={`Beat ${step.n}: ${step.title}`}>
              <Screen />
            </ErrorBoundary>
          </div>

          <div className="stage__nav">
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
              className="stage__nav-primary"
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
        </main>
      </div>
    </div>
  );
}
