/**
 * Managed Agent Framework Adapter
 *
 * Composable adapter pattern for plugging real agent managers (LangGraph, CrewAI,
 * Anthropic native agents) into the governance loop. This is the contract/schema
 * definition; concrete implementations (LangGraph, CrewAI, etc.) inherit from
 * ManagedAgentAdapter and implement the abstract lifecycle methods.
 *
 * The governance loop never references a specific framework — it uses this port,
 * allowing hot-swap between managers without touching the demo spine.
 */
import type { AgentOutput } from "@liminal-engine/contracts";
import type { AgentOutputSource } from "@liminal-engine/governance";

/**
 * Configuration for a managed agent framework integration.
 * Subclasses (LangGraphAdapter, CrewAIAdapter, etc.) extend and specialize this.
 */
export interface ManagedAgentConfig {
  /** Human-readable name of the framework (e.g., "LangGraph", "CrewAI"). */
  framework: string;

  /** Framework-specific endpoint, API key, or local service URL. */
  endpoint?: string;

  /** Framework-specific authentication credentials (kept secure in production). */
  credentials?: {
    apiKey?: string;
    token?: string;
    [key: string]: unknown;
  };

  /** Optional: framework-specific options (timeout, retry policy, etc.). */
  options?: Record<string, unknown>;
}

/**
 * Lifecycle events emitted during agent execution.
 * Useful for observability, audit trails, and debugging.
 */
export type AgentLifecycleEvent =
  | { type: "agent-start"; agentId: string; dealId: string; passNumber: number }
  | { type: "agent-progress"; agentId: string; message: string }
  | { type: "agent-complete"; agentId: string; result: AgentOutput }
  | { type: "agent-error"; agentId: string; error: string };

/**
 * Callback for lifecycle events. Enables decoupled observability without
 * tightly coupling the framework to logging/monitoring infrastructure.
 */
export type LifecycleObserver = (event: AgentLifecycleEvent) => Promise<void>;

/**
 * Abstract base class for managed-agent framework adapters.
 *
 * Concrete subclasses (LangGraphAdapter, CrewAIAdapter, AnthropicNativeAdapter)
 * implement:
 * - `initialize()` — connect to the framework, verify credentials
 * - `executeAgent()` — run the agent and collect output
 * - `shutdown()` — cleanup (file handles, sockets, etc.)
 *
 * The framework-agnostic governance loop calls only public methods:
 * `getOutput()` (via AgentOutputSource port), `onLifecycle()`, and `isReady()`.
 */
export abstract class ManagedAgentAdapter implements AgentOutputSource {
  protected config: ManagedAgentConfig;
  protected isInitialized = false;
  protected lifecycleObservers: LifecycleObserver[] = [];

  constructor(config: ManagedAgentConfig) {
    this.config = config;
  }

  /**
   * Initialize the adapter — connect to the framework, verify credentials, etc.
   * Called once before any agent execution. Subclasses must override.
   */
  abstract initialize(): Promise<void>;

  /**
   * Execute a single agent pass on the given deal and return structured output.
   * Subclasses must override. Called by getOutput(); lifecycle events are
   * automatically emitted before and after.
   */
  protected abstract executeAgent(
    dealId: string,
    passNumber: number,
  ): Promise<AgentOutput>;

  /**
   * Cleanup: close connections, release resources, etc.
   * Subclasses should override if they hold state. Called at shutdown.
   */
  async shutdown(): Promise<void> {
    this.isInitialized = false;
  }

  /**
   * Public entry point: run the agent and return output (satisfies AgentOutputSource).
   * Wraps executeAgent() with lifecycle event emission and error handling.
   */
  async getOutput(dealId: string, passNumber: number): Promise<AgentOutput> {
    if (!this.isInitialized) {
      throw new Error(
        `ManagedAgentAdapter (${this.config.framework}) not initialized. Call initialize() first.`,
      );
    }

    const agentId = `${this.config.framework}-${dealId}-pass-${passNumber}`;

    try {
      await this.emitLifecycleEvent({
        type: "agent-start",
        agentId,
        dealId,
        passNumber,
      });

      const result = await this.executeAgent(dealId, passNumber);

      await this.emitLifecycleEvent({
        type: "agent-complete",
        agentId,
        result,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.emitLifecycleEvent({
        type: "agent-error",
        agentId,
        error: errorMessage,
      });
      throw error;
    }
  }

  /**
   * Register a lifecycle observer. Called for each agent execution event
   * (start, progress, complete, error). Useful for logging, metrics, etc.
   */
  onLifecycle(observer: LifecycleObserver): void {
    this.lifecycleObservers.push(observer);
  }

  /**
   * Check if the adapter is ready to execute agents.
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get the framework name.
   */
  getFramework(): string {
    return this.config.framework;
  }

  /**
   * Protected helper: emit a lifecycle event to all registered observers.
   */
  protected async emitLifecycleEvent(event: AgentLifecycleEvent): Promise<void> {
    await Promise.all(this.lifecycleObservers.map((obs) => obs(event)));
  }
}

/**
 * A no-op implementation for testing/scaffolding.
 * Returns a canned AgentOutput and does not require external dependencies.
 */
export class StubManagedAgentAdapter extends ManagedAgentAdapter {
  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  protected async executeAgent(
    dealId: string,
    passNumber: number,
  ): Promise<AgentOutput> {
    // Return a stub output matching the AgentOutput contract.
    // On pass 1: EU data residency is dropped (false green).
    // On pass 2: EU data residency is included (corrected).
    return {
      id: `ao_${dealId}_p${passNumber}`,
      dealId,
      dealName: `Deal: ${dealId}`,
      passNumber,
      reportedStatus: "on-track",
      summary: `Agent analysis for ${dealId} (pass ${passNumber}): deal appears on track.`,
      droppedRequirements: passNumber === 1 ? ["EU data residency"] : [],
    };
  }
}
