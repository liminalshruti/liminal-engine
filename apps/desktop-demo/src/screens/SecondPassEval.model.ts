import type { EvalRow } from "@liminal-engine/eval-harness";

export interface BeforeAfterCheckRow {
  criterion: string;
  before: EvalRow;
  after: EvalRow;
}

export function toBeforeAfterCheckRows(rows: readonly EvalRow[]): BeforeAfterCheckRow[] {
  const rowsByCriterion = new Map<string, EvalRow[]>();

  for (const row of rows) {
    const criterionRows = rowsByCriterion.get(row.criterion) ?? [];
    criterionRows.push(row);
    rowsByCriterion.set(row.criterion, criterionRows);
  }

  return [...rowsByCriterion.entries()]
    .sort(([leftCriterion], [rightCriterion]) => leftCriterion.localeCompare(rightCriterion))
    .map(([criterion, criterionRows]) => {
      const sortedRows = [...criterionRows].sort((left, right) => left.pass - right.pass);
      const before = sortedRows[0];
      const after = sortedRows.at(-1);

      if (!before || !after) {
        throw new Error(`Cannot build before/after check row for criterion "${criterion}".`);
      }

      return { criterion, before, after };
    });
}
