/**
 * EvalTable — renders a Fail → Pass eval result table across passes.
 * Reads EvalResult[] from the eval harness (deterministic, fixture-backed).
 * Shows the improvement from pass 1 to pass 2 on a given criterion.
 * (DEMO_CONTRACT must-not-cut #7: Eval table shows Fail → Pass.)
 */
import type { EvalRow } from "@liminal-engine/eval-harness";

export interface EvalTableProps {
  /** The rows to display (result of toRows(evalTable)). */
  rows: EvalRow[];
  /** Optional class name for styling override. */
  className?: string;
}

export function EvalTable({ rows, className }: EvalTableProps) {
  if (!rows || rows.length === 0) {
    return (
      <div className={`eval-table eval-table--empty${className ? ` ${className}` : ""}`}>
        <p className="eval-table__empty-message">No eval results yet.</p>
      </div>
    );
  }

  return (
    <div className={`eval-table${className ? ` ${className}` : ""}`}>
      <table className="eval-table__table">
        <thead>
          <tr>
            <th className="eval-table__th eval-table__th--pass">Pass</th>
            <th className="eval-table__th eval-table__th--criterion">Criterion</th>
            <th className="eval-table__th eval-table__th--result">Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const isPass = row.result === "pass";
            return (
              <tr key={`${row.pass}-${row.criterion}`} className="eval-table__row">
                <td className="eval-table__td eval-table__td--pass">
                  <span className="eval-table__pass-number">Pass {row.pass}</span>
                </td>
                <td className="eval-table__td eval-table__td--criterion">{row.criterion}</td>
                <td className={`eval-table__td eval-table__td--result eval-table__result--${row.result}`}>
                  <span className="eval-table__result-badge">
                    <span className={`eval-table__result-dot eval-table__result-dot--${row.result}`} />
                    <span className="eval-table__result-label">{row.result.toUpperCase()}</span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default EvalTable;
