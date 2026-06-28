/**
 * AgentActivity screen — beat #3 · MNC#1 (the false green).
 * STUB created by LIM-1226 «spine-shell-v2». Filled by LIM-1217 «screen-agent-activity».
 *
 * Renders the first-pass agent output: "appears on track" while the EU data-residency
 * requirement is silently absent. Read from `acmeScenario.agentOutputPass1`.
 */
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { SCREEN_COPY } from "../lib/copy.ts";

export function AgentActivity() {
  const { agentOutputPass1 } = acmeScenario;
  const copy = SCREEN_COPY.agentActivity;

  return (
    <section className="screen screen--agent-activity" aria-label={copy.title}>
      <p className="screen__intro">{copy.intro}</p>
      <p className="screen__fact">
        Reported status: <strong>{agentOutputPass1.reportedStatus}</strong> — {agentOutputPass1.summary}
      </p>
      <p className="screen__stub-note">Stub — to be filled by LIM-1217 (MNC#1: the false green).</p>
    </section>
  );
}

export default AgentActivity;
