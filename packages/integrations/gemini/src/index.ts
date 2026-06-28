/**
 * Gemini adapter — FIXTURE STUB. Returns deterministic agent output, no live
 * inference (DEMO_CONTRACT cut-if-risky: "Real Gemini → deterministic fixtures").
 * The demo spine must stay deterministic; a live adapter is a stretch goal only.
 */
import type { AgentOutput } from "@liminal-engine/contracts";
import { acmeAgentOutputPass1, acmeAgentOutputPass2 } from "@liminal-engine/contracts/fixtures";
import type { AgentOutputSource } from "@liminal-engine/governance";

export class FixtureAgentOutputSource implements AgentOutputSource {
  async getOutput(_dealId: string, passNumber: number): Promise<AgentOutput> {
    return passNumber <= 1 ? acmeAgentOutputPass1 : acmeAgentOutputPass2;
  }
}
