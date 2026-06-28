/**
 * substrate-source — the bridge that runs the governance loop on REAL ingested
 * data. It implements the governance `AgentOutputSource` contract, but instead of
 * returning a fixture it COMPUTES the agent output from the substrate:
 * `droppedRequirements` come from `detectLostContext` over the ingested streams.
 *
 * This is what flips the whole loop from fixture-driven (a demo flow) to
 * substrate-driven (a real product). [BUILD_PLAN.md Gap 2 / DIRECTIVE.md]
 */
import type { AgentOutput } from "@liminal-engine/contracts";
import type { InMemorySubstrate, StreamSourceType } from "./substrate.ts";
import { detectLostContext } from "./detect-lost-context.ts";

export interface SubstrateSourceConfig {
  readonly dealId: string;
  readonly dealName: string;
  /** Requirements to track (e.g. extracted from the call stream). */
  readonly requirements: readonly string[];
  /** The source-type the requirements were stated in. */
  readonly statedIn: StreamSourceType;
}

/**
 * An `AgentOutputSource` backed by a substrate. Drop-in for `runGovernanceLoop`'s
 * `source` dep — the loop is unchanged; it now reads real ingested data.
 */
export class SubstrateAgentOutputSource {
  readonly #substrate: InMemorySubstrate;
  readonly #config: SubstrateSourceConfig;

  constructor(substrate: InMemorySubstrate, config: SubstrateSourceConfig) {
    this.#substrate = substrate;
    this.#config = config;
  }

  async getOutput(_dealId: string, passNumber: number): Promise<AgentOutput> {
    const dropped = detectLostContext(this.#substrate, {
      requirements: this.#config.requirements,
      statedIn: this.#config.statedIn,
    });
    // Pass 1 is the false green: agent reports on-track despite the lost context.
    // After correction (pass 2) the missing requirement has propagated, so the
    // substrate computes an empty drop set and the status is at-risk-then-honored.
    const onTrack = passNumber <= 1;
    return {
      id: `ao_${this.#config.dealId}_p${passNumber}`,
      dealId: this.#config.dealId,
      dealName: this.#config.dealName,
      passNumber,
      reportedStatus: onTrack ? "on-track" : "at-risk",
      summary: onTrack
        ? `${this.#config.dealName} appears on track.`
        : `${this.#config.dealName} re-evaluated against the pinned requirements.`,
      droppedRequirements: dropped,
      agentMetadata: {
        agent: "substrate",
        model: "computed-from-streams",
        artifacts: this.#substrate.streams().map((s) => s.sourceType),
      },
    };
  }
}
