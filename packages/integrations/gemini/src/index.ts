/**
 * Gemini integration — two agent-output sources behind the same `AgentOutputSource` port:
 *
 *   - `FixtureAgentOutputSource`  — deterministic Acme fixtures (the original demo path;
 *     kept so existing governance tests + the locked golden run offline with no inference).
 *   - `GeminiAgentOutputSource`   — LIVE-capable, cache-backed real inference on ARBITRARY
 *     input (the real-product path per DIRECTIVE.md). Replays a real captured response from
 *     a content-addressed cache; makes a live call on a miss when a key is set; NEVER fabricates.
 *
 * The fixture source stays the default for the deterministic spine; the live source is what
 * makes the product operate on a stranger's own data.
 */
import type { AgentOutput } from "@liminal-engine/contracts";
import { acmeAgentOutputPass1, acmeAgentOutputPass2 } from "@liminal-engine/contracts/fixtures";
import type { AgentOutputSource } from "@liminal-engine/governance";

export class FixtureAgentOutputSource implements AgentOutputSource {
  async getOutput(_dealId: string, passNumber: number): Promise<AgentOutput> {
    return passNumber <= 1 ? acmeAgentOutputPass1 : acmeAgentOutputPass2;
  }
}

export {
  GeminiAgentOutputSource,
  GeminiCacheMiss,
  captureLive,
  cacheKeyFor,
  type AgentInput,
} from "./live-cache-source.ts";
