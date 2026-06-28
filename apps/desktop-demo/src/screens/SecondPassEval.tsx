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
 * Demo facts come from the LIVE governance loop via `useDemo()` (LIM-1255) — the
 * screen renders `runGovernanceLoop`/`runEvals` output, byte-identical to the locked
 * Acme fixtures by determinism (no live calls, no invented data; AGENTS.md Locked
 * Rules). Eval rows come from `demo.evalRows`; framing copy from `../lib/copy.ts`;
 * widgets from `../components`.
 */
import type { EvalRow } from "@liminal-engine/eval-harness";
import { Card, EvalTable, StatusBadge } from "../components";
import { useDemo } from "../lib/demo-context.tsx";
import { SCREEN_COPY } from "../lib/copy.ts";
import { toBeforeAfterCheckRows } from "./SecondPassEval.model.ts";

function EvalResultBadge({ result }: { result: EvalRow["result"] }) {
  return (
    <span className="eval-table__result-badge">
      <span className={`eval-table__result-dot eval-table__result-dot--${result}`} />
      <span className="eval-table__result-label">{result.toUpperCase()}</span>
    </span>
  );
}

export function SecondPassEval() {
  const {
    agentOutputPass1,
    agentOutputPass2,
    gate,
    enforcementAction,
    evalCase,
    evalResults,
    evalRows,
    governanceCase,
  } = useDemo();
  const copy = SCREEN_COPY.secondPassEval;
  // evalResults is [pass 1 (fail), pass 2 (pass)] from the live loop — same order as the fixtures.
  const [evalPass1, evalPass2] = evalResults;
  const rows = evalRows;
  // The Fail→Pass proof (MNC#7) requires exactly the two graded passes; surface a
  // wiring/loop error loudly rather than render a half-empty proof.
  if (!evalPass1 || !evalPass2) {
    throw new Error("SecondPassEval expects two eval results (Fail→Pass); the loop returned fewer.");
  }
  const beforeAfterRows = toBeforeAfterCheckRows(rows);
  const causalNarration = "failure observed -> rule activated -> second pass gated -> eval passed";

  return (
    <section className="screen screen--second-pass-eval" aria-label={copy.title}>
      <p className="screen__intro">{copy.intro}</p>

      {/* Beat #12 — the EvalCase the second pass is graded against. */}
      <Card title="Eval case">
        <p className="screen__fact">
          EvalCase <strong>{evalCase.id}</strong> grades case{" "}
          <strong>{evalCase.governanceCaseId}</strong> on {evalCase.criterion}.
        </p>
        <p className="screen__fact">
          The case opened because pass {agentOutputPass1.passNumber} dropped{" "}
          <strong>{governanceCase.missedRequirement}</strong>.
        </p>
      </Card>

      {/* Beat #13 — the improved second-pass output (now at-risk, requirement honored). */}
      <Card title="Second pass">
        <p className="screen__fact">
          Re-run status: <StatusBadge status={agentOutputPass2.reportedStatus} />
        </p>
        <p className="screen__fact">{agentOutputPass2.summary}</p>
        <p className="screen__fact">
          Dropped requirements after enforcement:{" "}
          <strong>{agentOutputPass2.droppedRequirements.length === 0 ? "none" : agentOutputPass2.droppedRequirements.join(", ")}</strong>.
        </p>
      </Card>

      <Card title="Causal narration">
        <p className="screen__fact">
          <strong>{causalNarration}</strong>
        </p>
        <ol>
          <li className="screen__fact">
            failure observed: pass {evalPass1.passNumber} evaluated {evalPass1.criterion} as{" "}
            <strong>{evalPass1.result.toUpperCase()}</strong>.
          </li>
          <li className="screen__fact">
            rule activated: {enforcementAction.id} changed status from {enforcementAction.fromStatus} to{" "}
            {enforcementAction.toStatus}.
          </li>
          <li className="screen__fact">
            second pass gated: {gate.id} requires the correction work before the customer-facing update can send.
          </li>
          <li className="screen__fact">
            eval passed: pass {evalPass2.passNumber} evaluated the same check as{" "}
            <strong>{evalPass2.result.toUpperCase()}</strong>.
          </li>
        </ol>
      </Card>

      {/* Beat #14 / MNC#7 — the eval table: Fail → Pass across the two passes. */}
      <Card title="Eval result — Fail → Pass">
        <EvalTable rows={rows} />
      </Card>

      <Card title="Per-check before/after">
        <div className="eval-table" aria-label="Before and after checks table">
          <table className="eval-table__table">
            <thead>
              <tr>
                <th className="eval-table__th eval-table__th--criterion">Check</th>
                <th className="eval-table__th eval-table__th--result">Before</th>
                <th className="eval-table__th eval-table__th--result">After</th>
                <th className="eval-table__th eval-table__th--result">Change</th>
              </tr>
            </thead>
            <tbody>
              {beforeAfterRows.map((row) => (
                <tr key={row.criterion} className="eval-table__row">
                  <td className="eval-table__td eval-table__td--criterion">{row.criterion}</td>
                  <td className={`eval-table__td eval-table__td--result eval-table__result--${row.before.result}`}>
                    <span className="eval-table__pass-number">Pass {row.before.pass}</span>{" "}
                    <EvalResultBadge result={row.before.result} />
                  </td>
                  <td className={`eval-table__td eval-table__td--result eval-table__result--${row.after.result}`}>
                    <span className="eval-table__pass-number">Pass {row.after.pass}</span>{" "}
                    <EvalResultBadge result={row.after.result} />
                  </td>
                  <td className="eval-table__td eval-table__td--result">
                    <strong>{row.before.result.toUpperCase()} -&gt; {row.after.result.toUpperCase()}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

export default SecondPassEval;
