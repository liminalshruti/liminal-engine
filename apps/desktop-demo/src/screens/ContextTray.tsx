/**
 * ContextTray screen — beat #4 (reveal the lost EU data-residency requirement).
 * STUB created by LIM-1226 «spine-shell-v2». Filled by LIM-1216 «screen-context-tray».
 *
 * Renders the context cards (the source material the agents worked from) where the
 * EU data-residency requirement lived — the requirement the false green dropped.
 */
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { SCREEN_COPY } from "../lib/copy.ts";

export function ContextTray() {
  const { demoBeats } = acmeScenario;
  const copy = SCREEN_COPY.contextTray;

  return (
    <section className="screen screen--context-tray" aria-label={copy.title}>
      <p className="screen__intro">{copy.intro}</p>
      <p className="screen__fact">
        Load-bearing requirement: <strong>{demoBeats.droppedRequirement}</strong> (silently dropped).
      </p>
      <p className="screen__stub-note">Stub — to be filled by LIM-1216.</p>
    </section>
  );
}

export default ContextTray;
