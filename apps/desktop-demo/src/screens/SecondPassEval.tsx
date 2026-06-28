/**
 * SecondPassEval screen — beats #12–14 · MNC#7 (the proof / closer).
 * STUB created by LIM-1226 «spine-shell-v2». Filled by LIM-1221 «screen-second-pass-eval».
 *
 * Renders the EvalCase, the improved second-pass output, and the eval table showing
 * Fail → Pass. Build rows with `toRows([evalPass1, evalPass2])` from the eval-harness,
 * render with EvalTable (../components).
 */
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { SCREEN_COPY } from "../lib/copy.ts";

export function SecondPassEval() {
  const { evalPass1, evalPass2, agentOutputPass2 } = acmeScenario;
  const copy = SCREEN_COPY.secondPassEval;

  return (
    <section className="screen screen--second-pass-eval" aria-label={copy.title}>
      <p className="screen__intro">{copy.intro}</p>
      <p className="screen__fact">
        Second pass: {agentOutputPass2.reportedStatus} — eval{" "}
        <strong>{evalPass1.result.toUpperCase()}</strong> → <strong>{evalPass2.result.toUpperCase()}</strong>.
      </p>
      <p className="screen__stub-note">Stub — to be filled by LIM-1221 (MNC#7: Fail → Pass).</p>
    </section>
  );
}

export default SecondPassEval;
