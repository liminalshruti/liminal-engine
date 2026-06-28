import { useState } from "react";
import { DEMO_STEPS, PHASE_LABEL } from "./steps.tsx";

/**
 * Demo spine SHELL — the static clickable frame for the 14-step required path
 * (DEMO_CONTRACT.md). Renders the stepper rail and, in the stage, the SCREEN
 * mapped to the active beat (`step.screen`). The 14 beats map onto 7 screens
 * (LIM-1226 «spine-shell-v2»); screen agents fill each screen's stub — App.tsx
 * is not edited per screen.
 */
export function App() {
  const [i, setI] = useState(0);
  const step = DEMO_STEPS[i]!;
  const last = DEMO_STEPS.length - 1;
  const Screen = step.screen;

  return (
    <div className="app">
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
            >
              <span className="rail__n">{d.n}</span>
              <span className="rail__title">{d.title}</span>
              <span className={`rail__phase rail__phase--${d.phase}`}>{PHASE_LABEL[d.phase]}</span>
            </button>
          ))}
        </nav>

        <main className="stage">
          <div className="stage__head">
            <span className="stage__beat">Beat {step.n} / 14</span>
            <span className={`stage__phase stage__phase--${step.phase}`}>{PHASE_LABEL[step.phase]}</span>
            {step.mustNotCut && (
              <span className="stage__mnc">must-not-cut #{step.mustNotCut}</span>
            )}
          </div>
          <h1 className="stage__title">{step.title}</h1>

          <div className="stage__screen">
            <Screen />
          </div>

          <div className="stage__nav">
            <button disabled={i === 0} onClick={() => setI((v) => Math.max(0, v - 1))}>
              ← Back
            </button>
            <button
              className="stage__nav-primary"
              disabled={i === last}
              onClick={() => setI((v) => Math.min(last, v + 1))}
            >
              {i === last ? "End of demo" : "Next →"}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
