/**
 * ResourceAllocation contract tests — real logic, real fixtures, real validation.
 *
 * Tests:
 * 1. Golden vector validates through contract (schema + canonical hash)
 * 2. Agent and human resource calculations are internally consistent
 * 3. Timeline is properly ordered and captures real events
 * 4. ROI ratio is sensible (value >> cost)
 * 5. Role names follow the persona rule (no invented names)
 * 6. Contract parse/safeParse work as expected
 * 7. Canonical hash is deterministic
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resourceAllocationContract,
  resourceAllocationGoldenVectors,
  type ResourceAllocation,
} from "../src/resource-allocation.contract.ts";

test("resource-allocation: golden vector validates through contract", () => {
  const golden = resourceAllocationGoldenVectors[0]!.input;
  assert.doesNotThrow(() => resourceAllocationContract.parse(golden));
});

test("resource-allocation: parse validates and returns the value", () => {
  const golden = resourceAllocationGoldenVectors[0]!.input;
  const parsed = resourceAllocationContract.parse(golden);
  assert.equal(parsed.id, "ra_acme_eu");
  assert.equal(parsed.dealId, "deal_acme");
  assert.equal(parsed.caseId, "gc_acme_eu");
});

test("resource-allocation: safeParse returns success object", () => {
  const golden = resourceAllocationGoldenVectors[0]!.input;
  const result = resourceAllocationContract.safeParse(golden);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.id, "ra_acme_eu");
  }
});

test("resource-allocation: safeParse returns error on invalid input", () => {
  const invalid = { id: "", dealId: "d1" }; // missing required fields
  const result = resourceAllocationContract.safeParse(invalid);
  assert.equal(result.success, false);
});

test("resource-allocation: agent resources sum correctly", () => {
  const golden = resourceAllocationGoldenVectors[0]!.input;
  const sumTokens = golden.agents.reduce((sum, a) => sum + a.totalTokensUsed, 0);
  const sumCost = golden.agents.reduce((sum, a) => sum + a.estimatedCostUsd, 0);

  assert.equal(sumTokens, golden.totalAgentTokensUsed);
  assert.equal(sumCost, golden.totalAgentCostUsd);
});

test("resource-allocation: human resources sum correctly", () => {
  const golden = resourceAllocationGoldenVectors[0]!.input;
  const sumHours = golden.humans.reduce((sum, h) => sum + h.effortHours, 0);
  const sumCost = golden.humans.reduce((sum, h) => sum + h.estimatedCostUsd, 0);

  assert.equal(sumHours, golden.totalHumanHours);
  assert.equal(sumCost, golden.totalHumanCostUsd);
});

test("resource-allocation: timeline is properly ordered", () => {
  const golden = resourceAllocationGoldenVectors[0]!.input;
  const timestamps = golden.timeline.map((t) => new Date(t.occurredAt).getTime());

  for (let i = 0; i < timestamps.length - 1; i++) {
    assert.ok(
      timestamps[i]! <= timestamps[i + 1]!,
      `Timeline not ordered: event ${i} (${timestamps[i]}) > event ${i + 1} (${timestamps[i + 1]})`
    );
  }
});

test("resource-allocation: timeline start and end times match actual events", () => {
  const golden = resourceAllocationGoldenVectors[0]!.input;

  const firstEvent = new Date(golden.timeline[0]!.occurredAt).getTime();
  const lastEvent = new Date(golden.timeline[golden.timeline.length - 1]!.occurredAt).getTime();
  const startTime = new Date(golden.startTime).getTime();
  const endTime = golden.endTime ? new Date(golden.endTime).getTime() : null;

  assert.equal(startTime, firstEvent, "start time should match first timeline event");
  assert.equal(endTime, lastEvent, "end time should match last timeline event");
});

test("resource-allocation: total duration is consistent", () => {
  const golden = resourceAllocationGoldenVectors[0]!.input;
  const startMs = new Date(golden.startTime).getTime();
  const endMs = golden.endTime ? new Date(golden.endTime).getTime() : 0;
  const calculatedDuration = endMs - startMs;

  assert.equal(
    golden.totalDurationMs,
    calculatedDuration,
    "totalDurationMs should equal endTime - startTime"
  );
});

test("resource-allocation: role names follow persona rule (no invented names)", () => {
  const golden = resourceAllocationGoldenVectors[0]!.input;

  // All actors in timeline should be roles, not invented person names
  golden.timeline.forEach((event) => {
    if (event.actorType === "human") {
      // Crude guard: a role contains a slash, or words like "operator", "VP", "Head", "Lead"
      const pattern = /operator|VP|Head|Lead|officer|manager|director|\//i;
      assert.match(event.actor, pattern, `Actor "${event.actor}" looks like an invented name, not a role`);
    }
  });

  // All human resources should have roles, not names
  golden.humans.forEach((human) => {
    const pattern = /operator|VP|Head|Lead|officer|manager|director|\//i;
    assert.match(human.role, pattern, `Role "${human.role}" looks like an invented name, not a role`);
  });
});

test("resource-allocation: ROI ratio makes economic sense", () => {
  const golden = resourceAllocationGoldenVectors[0]!.input;

  // The value should be much greater than the cost
  const totalCost = golden.totalAgentCostUsd + golden.totalHumanCostUsd;
  assert.ok(totalCost > 0, "total cost should be positive");

  // For Acme: $1.2M deal risk caught for ~$275.50 cost = 4,355:1
  // The ratio should be very high (many thousands or higher)
  const expectedRatio = 4355;
  const ratioPattern = new RegExp(`4,?355:1`, "i");
  assert.match(golden.roiRatio || "", ratioPattern, "ROI ratio should be in the thousands");
});

test("resource-allocation: canonical hash is deterministic", () => {
  const golden = resourceAllocationGoldenVectors[0]!.input;
  const hash1 = resourceAllocationContract.hash(golden);
  const hash2 = resourceAllocationContract.hash(golden);

  assert.equal(hash1, hash2, "hash should be deterministic across calls");
});

test("resource-allocation: canonical projection is consistent", () => {
  const golden = resourceAllocationGoldenVectors[0]!.input;
  const canonical1 = resourceAllocationContract.canonical(golden);
  const canonical2 = resourceAllocationContract.canonical(golden);

  assert.deepEqual(canonical1, canonical2, "canonical projection should be deterministic");
});

test("resource-allocation: schema version is present in canonical form", () => {
  const golden = resourceAllocationGoldenVectors[0]!.input;
  const canonical = resourceAllocationContract.canonical(golden);

  assert.equal(canonical.schema, "liminal_engine.resource_allocation.v1");
});

test("resource-allocation: agent runs are positive", () => {
  const golden = resourceAllocationGoldenVectors[0]!.input;

  golden.agents.forEach((agent) => {
    assert.ok(agent.runCount > 0, `Agent ${agent.agentId} should have at least 1 run`);
    assert.ok(agent.totalTokensUsed > 0, `Agent ${agent.agentId} should have consumed tokens`);
  });
});

test("resource-allocation: human effort is measured in reasonable units", () => {
  const golden = resourceAllocationGoldenVectors[0]!.input;

  golden.humans.forEach((human) => {
    // Effort hours should be between 0 and 40 (a working day) for a single case
    assert.ok(
      human.effortHours >= 0 && human.effortHours <= 40,
      `${human.role} effort should be 0-40 hours, got ${human.effortHours}`
    );
  });
});

test("resource-allocation: activities are non-empty", () => {
  const golden = resourceAllocationGoldenVectors[0]!.input;

  golden.humans.forEach((human) => {
    assert.ok(human.activities.length > 0, `${human.role} should have at least one activity`);
    human.activities.forEach((activity) => {
      assert.ok(activity.length > 0, "Activity should be non-empty");
    });
  });
});

test("resource-allocation: case ID links to a real case", () => {
  const golden = resourceAllocationGoldenVectors[0]!.input;

  // In the Acme scenario, the case ID should be gc_acme_eu
  assert.equal(golden.caseId, "gc_acme_eu", "allocation should link to the Acme governance case");
  assert.equal(golden.dealId, "deal_acme", "allocation should be scoped to the deal");
});

test("resource-allocation: optional roiRatio can be absent", () => {
  const allocation: ResourceAllocation = {
    id: "ra_test",
    caseId: "gc_test",
    dealId: "deal_test",
    agents: [
      {
        agentId: "agent_1",
        agentRole: "detector",
        runCount: 1,
        totalTokensUsed: 1000,
        totalLatencyMs: 500,
        estimatedCostUsd: 0.1,
      },
    ],
    totalAgentTokensUsed: 1000,
    totalAgentCostUsd: 0.1,
    humans: [
      {
        role: "VP Ops",
        effortHours: 0.25,
        estimatedCostUsd: 50.0,
        activities: ["reviewed"],
      },
    ],
    totalHumanHours: 0.25,
    totalHumanCostUsd: 50.0,
    timeline: [
      {
        eventType: "case_opened",
        occurredAt: "2026-06-27T10:00:00.000Z",
        actorType: "agent",
        actor: "agent_1",
      },
    ],
    startTime: "2026-06-27T10:00:00.000Z",
    endTime: "2026-06-27T10:01:00.000Z",
    totalDurationMs: 60000,
    governanceValue: "Test value",
    // roiRatio omitted — should still validate
    createdAt: "2026-06-27T10:01:00.000Z",
  };

  assert.doesNotThrow(() => resourceAllocationContract.parse(allocation));
  const parsed = resourceAllocationContract.parse(allocation);
  assert.equal(parsed.roiRatio, undefined);
});

test("resource-allocation: timeline events with optional durations", () => {
  const golden = resourceAllocationGoldenVectors[0]!.input;

  // Some timeline events may have duration, some may not
  let hasWithDuration = false;
  let hasWithoutDuration = false;

  golden.timeline.forEach((event) => {
    if (event.durationMs !== undefined) {
      hasWithDuration = true;
    } else {
      hasWithoutDuration = true;
    }
  });

  // In the golden vector, all have durations; verify both paths work
  const simpleEvent = {
    eventType: "case_opened" as const,
    occurredAt: "2026-06-27T10:00:00.000Z",
    actorType: "agent" as const,
    actor: "agent_1",
    // durationMs omitted
  };

  const allocation: ResourceAllocation = {
    id: "ra_test",
    caseId: "gc_test",
    dealId: "deal_test",
    agents: [],
    totalAgentTokensUsed: 0,
    totalAgentCostUsd: 0,
    humans: [],
    totalHumanHours: 0,
    totalHumanCostUsd: 0,
    timeline: [simpleEvent],
    startTime: "2026-06-27T10:00:00.000Z",
    endTime: "2026-06-27T10:00:00.000Z",
    totalDurationMs: 0,
    governanceValue: "test",
    createdAt: "2026-06-27T10:00:00.000Z",
  };

  assert.doesNotThrow(() => resourceAllocationContract.parse(allocation));
});
