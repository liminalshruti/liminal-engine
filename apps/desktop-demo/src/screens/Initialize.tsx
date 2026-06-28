/**
 * Initialize screen — beats #1–2 (initialize workspace + show Acme business goal).
 * STUB created by LIM-1226 «spine-shell-v2». Filled by LIM-1215 «screen-initialize».
 *
 * Screen agent: replace the stub body. Read facts from `acmeScenario`, framing copy
 * from `SCREEN_COPY.initialize`, compose with widgets from `../components`. No live
 * calls; no invented persona name (Locked Rules in apps/desktop-demo/AGENTS.md).
 */
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { SCREEN_COPY } from "../lib/copy.ts";

export function Initialize() {
  const { businessGoal } = acmeScenario;
  const copy = SCREEN_COPY.initialize;

  return (
    <section className="screen screen--initialize" aria-label={copy.title}>
      <p className="screen__intro">{copy.intro}</p>
      <p className="screen__fact">
        Business goal: <strong>{businessGoal}</strong>
      </p>
      <p className="screen__stub-note">Stub — to be filled by LIM-1215.</p>
    </section>
  );
}

export default Initialize;
