/**
 * SecondPassEval screen — demo beats #12–14 of the locked required path (DEMO_CONTRACT.md):
 *   #12  EvalCase generated (the case the second pass is graded against).
 *   #13  Second pass improves (agents re-run with the requirement enforced).
 *   #14  Eval table shows Fail → Pass (MNC#7 — the proof the next pass improved).
 *
 * Fills the LIM-1226 «spine-shell-v2» stub (task LIM-1221 «screen-second-pass-eval»).
 * THE CLOSER — the beat that proves the thesis: governance caught the miss, enforced
 * correction, and the graded re-run flips Fail → Pass.
 *
 * All demo facts come ONLY from the validated Acme fixtures
 * (`@liminal-engine/contracts/fixtures`) — no live calls, no invented data
 * (apps/desktop-demo/AGENTS.md Locked Rules; fixtures-only per Decision D1-a, with
 * LIM-1245 re-pointing to live runEvals output later). Eval rows are built with
 * `toRows()` from the eval-harness; framing copy from `../lib/copy.ts`; widgets from
 * `../components`.
 */
import { Card, EvalTable, StatusBadge } from "../components";
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { toRows } from "@liminal-engine/eval-harness";
import { SCREEN_COPY } from "../lib/copy.ts";

export function SecondPassEval() {
  const { evalCase, evalPass1, evalPass2, agentOutputPass2 } = acmeScenario;
  const copy = SCREEN_COPY.secondPassEval;
  // Fail (pass 1) → Pass (pass 2) on the same criterion — the MNC#7 proof.
  const rows = toRows([evalPass1, evalPass2]);

  return (
    <section className="screen screen--second-pass-eval" aria-label={copy.title}>
      <p className="screen__intro">{copy.intro}</p>

      {/* Beat #12 — the EvalCase the second pass is graded against. */}
      <Card title="Eval case">
        <p className="screen__fact">
          Grading criterion: <strong>{evalCase.criterion}</strong>
        </p>
      </Card>

      {/* Beat #13 — the improved second-pass output (now at-risk, requirement honored). */}
      <Card title="Second pass">
        <p className="screen__fact">
          Re-run status: <StatusBadge status={agentOutputPass2.reportedStatus} />
        </p>
        <p className="screen__fact">{agentOutputPass2.summary}</p>
      </Card>

      {/* Beat #14 / MNC#7 — the eval table: Fail → Pass across the two passes. */}
      <Card title="Eval result — Fail → Pass">
        <EvalTable rows={rows} />
      </Card>
    </section>
  );
}

export default SecondPassEval;
