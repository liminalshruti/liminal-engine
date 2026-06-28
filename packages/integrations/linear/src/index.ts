/**
 * Linear adapter — FIXTURE STUB. Simulated workstream panel, no live API call
 * (DEMO_CONTRACT cut-if-risky: "Real Linear API → simulated Linear workstream panel").
 * Swap for a live adapter behind the same port only as a stretch goal.
 */
import type { LinearWorkstreamPanel } from "@liminal-engine/governance";

// must-not-cut #4: the workstream demands the right owners.
const REQUIRED_OWNERS = ["Product", "Security", "Engineering"] as const;

export class SimulatedLinearPanel implements LinearWorkstreamPanel {
  async workstreams(_dealId: string): Promise<{ title: string; status: string; owner: string }[]> {
    return [
      { title: "Commercial terms", status: "green", owner: "Product" },
      { title: "Security review", status: "green", owner: "Security" },
      { title: "Data residency (EU)", status: "at-risk", owner: "Engineering" }, // the corrected reality
    ];
  }

  /** Owners the workstream requires before a corrected update can proceed. */
  requiredOwners(): readonly string[] {
    return REQUIRED_OWNERS;
  }
}
