/**
 * EvalStore adapter — in-memory FIXTURE STUB. Records eval results from the
 * governance loop; read back by eval-harness.runEvals to render the Fail → Pass
 * table. Implements @liminal-engine/governance's EvalStore.
 */
import type { EvalResult } from "@liminal-engine/contracts";
import type { EvalStore } from "@liminal-engine/governance";

export class InMemoryEvalStore implements EvalStore {
  private readonly results = new Map<string, EvalResult>();

  async record(result: EvalResult): Promise<void> {
    this.results.set(result.id, result);
  }

  async byDeal(dealId: string): Promise<EvalResult[]> {
    return [...this.results.values()].filter((r) => r.dealId === dealId);
  }
}
