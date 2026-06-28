/**
 * Tests for the Managed Agent Framework Adapter.
 * Validates the adapter lifecycle, event emission, and contract compliance.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  StubManagedAgentAdapter,
  type ManagedAgentConfig,
  type AgentLifecycleEvent,
} from "../src/adapter.ts";
import type { AgentOutput } from "@liminal-engine/contracts";

test("ManagedAgentAdapter - should initialize successfully", async () => {
  const config: ManagedAgentConfig = {
    framework: "TestFramework",
    endpoint: "http://localhost:8000",
    credentials: { apiKey: "test-key-123" },
  };

  const adapter = new StubManagedAgentAdapter(config);
  assert.strictEqual(adapter.isReady(), false);
  await adapter.initialize();
  assert.strictEqual(adapter.isReady(), true);
});

test("ManagedAgentAdapter - should throw if getOutput is called before initialize", async () => {
  const config: ManagedAgentConfig = { framework: "TestFramework" };
  const adapter = new StubManagedAgentAdapter(config);

  try {
    await adapter.getOutput("acme-deal", 1);
    assert.fail("Expected error not thrown");
  } catch (error) {
    assert.match(String(error), /not initialized/);
  }
});

test("ManagedAgentAdapter - should return valid AgentOutput from getOutput", async () => {
  const config: ManagedAgentConfig = { framework: "TestFramework" };
  const adapter = new StubManagedAgentAdapter(config);
  await adapter.initialize();

  const output = await adapter.getOutput("acme-deal", 1);

  assert.strictEqual(output.dealId, "acme-deal");
  assert.strictEqual(output.passNumber, 1);
  assert.strictEqual(output.reportedStatus, "on-track");
  assert.ok(output.id);
  assert.ok(output.dealName);
  assert.ok(output.summary);
  assert.ok(Array.isArray(output.droppedRequirements));
});

test("ManagedAgentAdapter - should emit lifecycle events on successful execution", async () => {
  const config: ManagedAgentConfig = { framework: "TestFramework" };
  const adapter = new StubManagedAgentAdapter(config);
  const emittedEvents: AgentLifecycleEvent[] = [];

  adapter.onLifecycle(async (event) => {
    emittedEvents.push(event);
  });

  await adapter.initialize();
  await adapter.getOutput("acme-deal", 1);

  assert.ok(emittedEvents.length >= 2);
  assert.strictEqual(emittedEvents[0]?.type, "agent-start");
  assert.strictEqual(emittedEvents[emittedEvents.length - 1]?.type, "agent-complete");
});

test("ManagedAgentAdapter - should emit error event on failure", async () => {
  const config: ManagedAgentConfig = { framework: "TestFramework" };
  const emittedEvents: AgentLifecycleEvent[] = [];

  const failingAdapter = new (class extends StubManagedAgentAdapter {
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor(config: ManagedAgentConfig) {
      super(config);
    }

    async initialize() {
      this.isInitialized = true;
    }

    protected async executeAgent(): Promise<AgentOutput> {
      throw new Error("Simulated agent failure");
    }
  })(config);

  failingAdapter.onLifecycle(async (event) => {
    emittedEvents.push(event);
  });

  await failingAdapter.initialize();

  try {
    await failingAdapter.getOutput("acme-deal", 1);
    assert.fail("Expected error not thrown");
  } catch (error) {
    assert.match(String(error), /Simulated agent failure/);
  }

  const errorEvent = emittedEvents.find((e) => e.type === "agent-error");
  assert.ok(errorEvent);
});

test("ManagedAgentAdapter - should return different outputs for different passes", async () => {
  const config: ManagedAgentConfig = { framework: "TestFramework" };
  const adapter = new StubManagedAgentAdapter(config);
  await adapter.initialize();

  const pass1 = await adapter.getOutput("acme-deal", 1);
  const pass2 = await adapter.getOutput("acme-deal", 2);

  // Stub adapter: pass 1 has EU residency dropped, pass 2 has it included
  assert.ok(pass1.droppedRequirements.includes("EU data residency"));
  assert.ok(!pass2.droppedRequirements.includes("EU data residency"));
});

test("ManagedAgentAdapter - should track framework name", () => {
  const config: ManagedAgentConfig = { framework: "TestFramework" };
  const adapter = new StubManagedAgentAdapter(config);
  assert.strictEqual(adapter.getFramework(), "TestFramework");
});

test("ManagedAgentAdapter - should accept configuration with optional fields", () => {
  const minimalConfig: ManagedAgentConfig = { framework: "MinimalFramework" };
  const minimalAdapter = new StubManagedAgentAdapter(minimalConfig);
  assert.strictEqual(minimalAdapter.getFramework(), "MinimalFramework");
});

test("ManagedAgentAdapter - should support multiple lifecycle observers", async () => {
  const config: ManagedAgentConfig = { framework: "TestFramework" };
  const adapter = new StubManagedAgentAdapter(config);

  const observer1Events: AgentLifecycleEvent[] = [];
  const observer2Events: AgentLifecycleEvent[] = [];

  adapter.onLifecycle(async (event) => {
    observer1Events.push(event);
  });
  adapter.onLifecycle(async (event) => {
    observer2Events.push(event);
  });

  await adapter.initialize();
  await adapter.getOutput("acme-deal", 1);

  assert.ok(observer1Events.length > 0);
  assert.ok(observer2Events.length > 0);
  assert.strictEqual(observer1Events.length, observer2Events.length);
});

test("ManagedAgentAdapter - should shutdown cleanly", async () => {
  const config: ManagedAgentConfig = { framework: "TestFramework" };
  const adapter = new StubManagedAgentAdapter(config);

  await adapter.initialize();
  assert.strictEqual(adapter.isReady(), true);
  await adapter.shutdown();
  assert.strictEqual(adapter.isReady(), false);
});

test("createManagedAgentAdapter factory - should create a stub adapter for unknown frameworks", async () => {
  const { createManagedAgentAdapter } = await import("../src/index.ts");
  const adapter = createManagedAgentAdapter({ framework: "UnknownFramework" });

  assert.ok(adapter);
  assert.strictEqual(adapter.getFramework(), "UnknownFramework");
});

test("createManagedAgentAdapter factory - should create a stub adapter for explicit stub framework", async () => {
  const { createManagedAgentAdapter } = await import("../src/index.ts");
  const adapter = createManagedAgentAdapter({ framework: "stub" });

  assert.ok(adapter);
  await adapter.initialize();
  const output = await adapter.getOutput("test-deal", 1);
  assert.strictEqual(output.dealId, "test-deal");
});
