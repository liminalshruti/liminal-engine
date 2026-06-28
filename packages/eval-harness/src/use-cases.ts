/**
 * runEvals — read the eval results recorded by the governance loop and return a
 * deterministic EvalTable (the Fail → Pass proof). [DEMO_CONTRACT must-not-cut #7]
 *
 * Depends on contracts only: the store is taken structurally (an EvalReader), so
 * eval-harness needn't depend on the governance package — any EvalStore satisfies
 * it. Deterministic: sorts by passNumber (then criterion) — no clock, no I/O.
 */
import type { EvalResult } from "@liminal-engine/contracts";
import type { EvalTable } from "./index.ts";

/** The read side of an eval store — structurally satisfied by governance's EvalStore. */
export interface EvalReader {
  byDeal(dealId: string): Promise<EvalResult[]>;
}

export async function runEvals(store: EvalReader, dealId: string): Promise<EvalTable> {
  const results = await store.byDeal(dealId);
  return [...results].sort(
    (a, b) => a.passNumber - b.passNumber || a.criterion.localeCompare(b.criterion),
  );
}
