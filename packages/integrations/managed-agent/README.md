# Managed Agent Framework Integration

**Composable adapter pattern for agent manager integrations.**

This package defines the schema and adapter contract for plugging real agent managers (LangGraph, CrewAI, Anthropic native agents) into the Liminal Engine governance loop.

## What this is

The managed-agent framework provides:

1. **`ManagedAgentAdapter`** — an abstract base class that concrete frameworks inherit from
2. **`ManagedAgentConfig`** — configuration schema (framework name, endpoint, credentials)
3. **`AgentLifecycleEvent`** — typed events emitted during agent execution (start, progress, complete, error)
4. **`StubManagedAgentAdapter`** — a deterministic reference implementation for testing/scaffolding
5. **`createManagedAgentAdapter()`** — a factory for composing the right adapter

## Why it exists

The governance loop never knows which agent framework is in use. All framework-specific logic lives in adapters that:

- Implement a single port: `AgentOutputSource` (from `@liminal-engine/governance`)
- Return a standard `AgentOutput` contract (from `@liminal-engine/contracts`)
- Emit lifecycle events for observability (logging, metrics, audit trails)

This allows hot-swapping between frameworks (LangGraph ↔ CrewAI ↔ native agents) without touching the demo spine or the governance engine.

## Usage

### Stub (MVP / testing)

```typescript
import { StubManagedAgentAdapter } from "@liminal-engine/integration-managed-agent";

const adapter = new StubManagedAgentAdapter({
  framework: "Stub",
});

await adapter.initialize();
const output = await adapter.getOutput("deal_acme", 1);
// returns deterministic AgentOutput with EU data residency dropped on pass 1
```

### Future: Real frameworks

```typescript
// Hypothetical LangGraph adapter (not yet implemented)
import { LangGraphAdapter } from "@liminal-engine/integration-managed-agent/langgraph";

const adapter = new LangGraphAdapter({
  framework: "LangGraph",
  endpoint: "http://localhost:8000",
  credentials: { apiKey: process.env.LANGGRAPH_API_KEY },
});

await adapter.initialize();
const output = await adapter.getOutput("deal_acme", 1);
```

## Lifecycle events

Adapters emit typed events during execution:

```typescript
adapter.onLifecycle(async (event) => {
  switch (event.type) {
    case "agent-start":
      console.log(`Agent ${event.agentId} started for deal ${event.dealId}`);
      break;
    case "agent-progress":
      console.log(`Progress: ${event.message}`);
      break;
    case "agent-complete":
      console.log(`Agent ${event.agentId} returned:`, event.result);
      break;
    case "agent-error":
      console.error(`Agent ${event.agentId} failed: ${event.error}`);
      break;
  }
});
```

## Implementing a new adapter

1. Create a new file: `packages/integrations/managed-agent/src/langgraph.ts`
2. Extend `ManagedAgentAdapter`:

```typescript
export class LangGraphAdapter extends ManagedAgentAdapter {
  private client?: LangGraphClient;

  async initialize(): Promise<void> {
    // Set up the client, verify credentials, etc.
    this.client = new LangGraphClient(this.config.endpoint, this.config.credentials);
    await this.client.ping(); // verify connectivity
    this.isInitialized = true;
  }

  protected async executeAgent(
    dealId: string,
    passNumber: number
  ): Promise<AgentOutput> {
    // Invoke the LangGraph agent and parse the result
    const input = { dealId, passNumber };
    const result = await this.client!.invoke(this.config.graphId, input);
    return result as AgentOutput;
  }

  async shutdown(): Promise<void> {
    if (this.client) {
      await this.client.close();
    }
    await super.shutdown();
  }
}
```

3. Export from `src/index.ts` and add to the factory:

```typescript
export { LangGraphAdapter } from "./langgraph.ts";

export function createManagedAgentAdapter(config: ManagedAgentConfig): ManagedAgentAdapter {
  if (config.framework === "LangGraph") return new LangGraphAdapter(config);
  // ...
}
```

4. Write tests in `test/langgraph.test.ts`
5. Run `pnpm verify` to ensure boundary rules are obeyed

## Scope boundary

This is a **stub integration package** — the real implementations (LangGraph, CrewAI, Anthropic) are deferred to later waves. The stub is deterministic and requires no external dependencies.

- ✓ **Real:** adapter interface, lifecycle event schema, factory pattern
- ✗ **Deferred:** LangGraph, CrewAI, Anthropic implementations (next waves)

## Tests

Run tests for the managed-agent adapter:

```bash
pnpm test packages/integrations/managed-agent/test/adapter.test.ts
```

All tests validate:

- Adapter initialization and readiness state
- AgentOutput contract compliance
- Lifecycle event emission
- Error handling and fail-closed behavior
- Multiple observer registration
- Factory creation

## What's real vs. stubbed

| What | Status | Notes |
|------|--------|-------|
| Adapter interface | ✓ Real | Abstract base class, fully implemented |
| Config schema | ✓ Real | TypeScript interfaces, validated |
| Lifecycle events | ✓ Real | Full type definitions, emitted correctly |
| StubManagedAgentAdapter | ✓ Real | Deterministic test implementation |
| createManagedAgentAdapter factory | ✓ Real | Hot-swap composition logic |
| LangGraph integration | ✗ Stub | Scaffold only (interface defined, no implementation) |
| CrewAI integration | ✗ Stub | Scaffold only (interface defined, no implementation) |
| Anthropic native agents | ✗ Stub | Scaffold only (interface defined, no implementation) |

## Architecture

```
governance loop (packages/governance)
    ↓
AgentOutputSource port (defined in governance)
    ↓
ManagedAgentAdapter (this package)
    ├─ StubManagedAgentAdapter (deterministic, no deps)
    ├─ LangGraphAdapter (future)
    ├─ CrewAIAdapter (future)
    └─ AnthropicNativeAdapter (future)
```

No dependency coupling: the governance loop never imports a concrete adapter. Adapters are composed at the application root only.

## Future waves

**Wave 1 (current):** Stub + schema  
**Wave 2:** LangGraph real adapter  
**Wave 3:** CrewAI real adapter  
**Wave 4:** Anthropic native agents real adapter  

Each adapter is optional; the stub is always available as a fallback.
