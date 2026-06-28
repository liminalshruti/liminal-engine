/**
 * GovernanceCaseStore adapter — in-memory FIXTURE STUB. Deterministic, no I/O
 * (the demo spine runs on fixtures; a persistent store is a stretch goal behind
 * the same port). Implements @liminal-engine/governance's GovernanceCaseStore.
 */
import type { GovernanceCase } from "@liminal-engine/contracts";
import type { GovernanceCaseStore } from "@liminal-engine/governance";

export class InMemoryGovernanceCaseStore implements GovernanceCaseStore {
  private readonly cases = new Map<string, GovernanceCase>();

  async open(governanceCase: GovernanceCase): Promise<void> {
    this.cases.set(governanceCase.id, governanceCase);
  }

  async correct(caseId: string): Promise<void> {
    const c = this.cases.get(caseId);
    if (c) this.cases.set(caseId, { ...c, status: "corrected" });
  }

  async byDeal(dealId: string): Promise<GovernanceCase[]> {
    return [...this.cases.values()].filter((c) => c.dealId === dealId);
  }
}
