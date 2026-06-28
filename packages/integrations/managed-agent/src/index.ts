/**
 * Managed Agent Framework Integration
 *
 * Schema + adapter pattern for composing real agent managers (LangGraph, CrewAI,
 * Anthropic native agents) with the governance loop. No live calls; this defines
 * the contract and reference implementations (stub).
 *
 * Usage (pseudo-code for future waves):
 *
 *   // LangGraph adapter (hypothetical; would be implemented in a later PR)
 *   const adapter = new LangGraphAdapter({
 *     framework: "LangGraph",
 *     endpoint: "http://localhost:8000",
 *     credentials: { apiKey: process.env.LANGGRAPH_API_KEY },
 *   });
 *   await adapter.initialize();
 *   const output = await adapter.getOutput("acme-deal", 1);
 *   // output is standard AgentOutput contract; governance loop unchanged
 *
 *   // CrewAI adapter (hypothetical; would be implemented in a later PR)
 *   const crewAdapter = new CrewAIAdapter({ framework: "CrewAI", ... });
 *   await crewAdapter.initialize();
 *   // same interface, different framework
 *
 * This adapter lives behind the AgentOutputSource port, so the governance loop
 * never knows which framework was used. Demo spine uses fixtures; real adapters
 * swap in at composition root only.
 */

export type {
  ManagedAgentConfig,
  AgentLifecycleEvent,
  LifecycleObserver,
} from "./adapter.ts";

export { ManagedAgentAdapter, StubManagedAgentAdapter } from "./adapter.ts";

/**
 * Example concrete adapters (scaffolds for future implementation).
 * These are NOT functional in the MVP but demonstrate the contract shape.
 */

/**
 * LangGraph Adapter — for LangGraph-managed agent orchestration.
 * TODO: implement in a future PR once LangGraph is available as a dependency.
 *
 * Shape (not yet implemented):
 *   class LangGraphAdapter extends ManagedAgentAdapter {
 *     protected async initialize() { ... call LangGraph API to verify endpoint ... }
 *     protected async executeAgent(dealId, passNumber) {
 *       const input = { dealId, passNumber };
 *       const result = await this.client.invoke(this.config.graphId, input);
 *       return result as AgentOutput;
 *     }
 *   }
 */
export interface LangGraphAdapterScaffold {
  // Placeholder for future LangGraph adapter
  framework: "LangGraph";
  graphId?: string; // ID of the compiled LangGraph graph
  apiEndpoint?: string;
}

/**
 * CrewAI Adapter — for CrewAI multi-agent orchestration.
 * TODO: implement in a future PR once CrewAI is available as a dependency.
 *
 * Shape (not yet implemented):
 *   class CrewAIAdapter extends ManagedAgentAdapter {
 *     protected async initialize() { ... instantiate Crew, verify agents ... }
 *     protected async executeAgent(dealId, passNumber) {
 *       const result = await this.crew.kickoff(inputs);
 *       return parseCrewOutput(result) as AgentOutput;
 *     }
 *   }
 */
export interface CrewAIAdapterScaffold {
  // Placeholder for future CrewAI adapter
  framework: "CrewAI";
  crewFile?: string; // Path to crew definition YAML
  taskFile?: string; // Path to task definitions
}

/**
 * Anthropic Native Agents Adapter — for native Claude agents (future beta).
 * TODO: implement once native agents API is stable.
 *
 * Shape (not yet implemented):
 *   class AnthropicNativeAgentAdapter extends ManagedAgentAdapter {
 *     protected async initialize() { ... set up Anthropic client, load agent ID ... }
 *     protected async executeAgent(dealId, passNumber) {
 *       const response = await this.client.agents.messages.create({
 *         agent_id: this.config.agentId,
 *         messages: [...],
 *       });
 *       return parseAnthropicAgentOutput(response) as AgentOutput;
 *     }
 *   }
 */
export interface AnthropicNativeAgentScaffold {
  // Placeholder for future Anthropic native agent adapter
  framework: "AnthropicNativeAgent";
  agentId?: string; // Agent ID from Anthropic console
  model?: string; // Model to use (claude-opus, etc.)
}

/**
 * Composition helper: factory for creating the appropriate adapter.
 * As new adapters are implemented, extend this union and switch.
 *
 * Usage (pseudo-code):
 *   const adapter = createManagedAgentAdapter({
 *     framework: "LangGraph",
 *     endpoint: "http://localhost:8000",
 *   });
 *   await adapter.initialize();
 *
 * For now, only StubManagedAgentAdapter is available. In future PRs, add:
 *   if (config.framework === "LangGraph") return new LangGraphAdapter(config);
 *   if (config.framework === "CrewAI") return new CrewAIAdapter(config);
 */
import type { ManagedAgentConfig } from "./adapter.ts";
import { ManagedAgentAdapter, StubManagedAgentAdapter } from "./adapter.ts";

export function createManagedAgentAdapter(
  config: ManagedAgentConfig,
): ManagedAgentAdapter {
  // As concrete adapters are built, add cases here:
  // if (config.framework === "LangGraph") return new LangGraphAdapter(config);
  // if (config.framework === "CrewAI") return new CrewAIAdapter(config);
  // if (config.framework === "AnthropicNativeAgent") return new AnthropicNativeAgentAdapter(config);

  if (config.framework === "stub" || config.framework === "Stub") {
    return new StubManagedAgentAdapter(config);
  }

  // Default to stub for unknown frameworks (safe fallback for now)
  return new StubManagedAgentAdapter(config);
}
