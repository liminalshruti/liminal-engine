/**
 * AgentRun contract tests.
 *
 * Validates:
 * - Contract shape and validation
 * - Golden vectors (test fixtures) pass validation
 * - Parent-run linking (parentRunId chains)
 * - Canonical hash stability
 * - Status/kind enums
 */
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { agentRunContract, agentRunGoldenVectors, type AgentRun } from "../src/agent-run.contract.ts";
import { acmeAgentRuns, acmeAgentRunPass1, acmeAgentRunPass2, acmeAgentRunReplay } from "../src/fixtures.ts";
import { canonicalHash } from "@liminal-engine/contracts";

describe("AgentRun contract", () => {
  describe("validation", () => {
    it("parses a valid first_pass run (no parent)", () => {
      const run = acmeAgentRunPass1;
      assert.ok(run.id);
      assert.strictEqual(run.runKind, "first_pass");
      assert.strictEqual(run.parentRunId, null);
      assert.strictEqual(run.resolvedContext.passNumber, 1);
    });

    it("parses a valid second_pass run (with parent)", () => {
      const run = acmeAgentRunPass2;
      assert.ok(run.id);
      assert.strictEqual(run.runKind, "second_pass");
      assert.strictEqual(run.parentRunId, "ar_acme_p1");
      assert.strictEqual(run.resolvedContext.passNumber, 2);
    });

    it("parses a valid replay run (linked from prior pass)", () => {
      const run = acmeAgentRunReplay;
      assert.ok(run.id);
      assert.strictEqual(run.runKind, "replay");
      assert.strictEqual(run.parentRunId, "ar_acme_p2");
    });

    it("rejects invalid runKind", () => {
      assert.throws(
        () =>
          agentRunContract.parse({
            id: "ar_test",
            goalId: "deal_test",
            parentRunId: null,
            runKind: "invalid" as any,
            resolvedContext: {
              dealId: "deal_test",
              passNumber: 1,
              capturedAt: "2026-06-27T10:00:00.000Z",
            },
            status: "complete",
            createdAt: "2026-06-27T10:00:00.000Z",
            completedAt: "2026-06-27T10:01:00.000Z",
          }),
        "should reject invalid runKind",
      );
    });

    it("rejects invalid status", () => {
      assert.throws(
        () =>
          agentRunContract.parse({
            id: "ar_test",
            goalId: "deal_test",
            parentRunId: null,
            runKind: "first_pass",
            resolvedContext: {
              dealId: "deal_test",
              passNumber: 1,
              capturedAt: "2026-06-27T10:00:00.000Z",
            },
            status: "invalid" as any,
            createdAt: "2026-06-27T10:00:00.000Z",
            completedAt: "2026-06-27T10:01:00.000Z",
          }),
        "should reject invalid status",
      );
    });

    it("allows null completedAt for pending runs", () => {
      const run = agentRunContract.parse({
        id: "ar_pending",
        goalId: "deal_test",
        parentRunId: null,
        runKind: "first_pass",
        resolvedContext: {
          dealId: "deal_test",
          passNumber: 1,
          capturedAt: "2026-06-27T10:00:00.000Z",
        },
        status: "pending",
        createdAt: "2026-06-27T10:00:00.000Z",
        completedAt: null,
      });
      assert.strictEqual(run.status, "pending");
      assert.strictEqual(run.completedAt, null);
    });
  });

  describe("parent-run linking", () => {
    it("first_pass has null parent", () => {
      assert.strictEqual(acmeAgentRunPass1.parentRunId, null);
    });

    it("second_pass links to first_pass via parentRunId", () => {
      assert.strictEqual(acmeAgentRunPass2.parentRunId, "ar_acme_p1");
    });

    it("replay links to second_pass via parentRunId", () => {
      assert.strictEqual(acmeAgentRunReplay.parentRunId, "ar_acme_p2");
    });

    it("resolves a full chain: pass1 -> pass2 -> replay", () => {
      const chain = [acmeAgentRunPass1, acmeAgentRunPass2, acmeAgentRunReplay];
      const byId: Record<string, AgentRun> = Object.fromEntries(chain.map((r) => [r.id, r]));

      // Walk the chain forward
      let current = acmeAgentRunPass1;
      assert.strictEqual(current.runKind, "first_pass");
      assert.strictEqual(current.parentRunId, null);

      const pass2 = chain.find((r) => r.parentRunId === current.id);
      assert.ok(pass2);
      current = pass2;
      assert.strictEqual(current.runKind, "second_pass");

      const replay = chain.find((r) => r.parentRunId === current.id);
      assert.ok(replay);
      assert.strictEqual(replay.runKind, "replay");
    });
  });

  describe("canonical hash", () => {
    it("produces stable hash for acme pass 1", () => {
      const hash1 = canonicalHash(agentRunContract.canonical(acmeAgentRunPass1));
      const hash2 = canonicalHash(agentRunContract.canonical(acmeAgentRunPass1));
      assert.strictEqual(hash1, hash2, "same input should produce same hash");
    });

    it("produces different hash for pass 1 vs pass 2", () => {
      const hash1 = canonicalHash(agentRunContract.canonical(acmeAgentRunPass1));
      const hash2 = canonicalHash(agentRunContract.canonical(acmeAgentRunPass2));
      assert.notStrictEqual(hash1, hash2, "different runs should have different hashes");
    });

    it("hashes change when passNumber changes", () => {
      const run1 = agentRunContract.parse({
        ...acmeAgentRunPass1,
        resolvedContext: { ...acmeAgentRunPass1.resolvedContext, passNumber: 1 },
      });
      const run2 = agentRunContract.parse({
        ...acmeAgentRunPass1,
        id: "ar_test_mutant",
        resolvedContext: { ...acmeAgentRunPass1.resolvedContext, passNumber: 2 },
      });
      const hash1 = canonicalHash(agentRunContract.canonical(run1));
      const hash2 = canonicalHash(agentRunContract.canonical(run2));
      assert.notStrictEqual(hash1, hash2);
    });
  });

  describe("golden vectors", () => {
    it("all golden vectors pass contract validation", () => {
      for (const vector of agentRunGoldenVectors) {
        assert.doesNotThrow(
          () => agentRunContract.parse(vector.input),
          `golden vector '${vector.name}' should pass validation`,
        );
      }
    });

    it("golden vector pass_1 is first_pass with null parent", () => {
      const pass1 = agentRunGoldenVectors.find((v) => v.name === "acme-pass-1-first")!;
      assert.ok(pass1);
      assert.strictEqual(pass1.input.runKind, "first_pass");
      assert.strictEqual(pass1.input.parentRunId, null);
    });

    it("golden vector pass_2 is second_pass with parent = pass_1", () => {
      const pass2 = agentRunGoldenVectors.find((v) => v.name === "acme-pass-2-second")!;
      assert.ok(pass2);
      assert.strictEqual(pass2.input.runKind, "second_pass");
      assert.strictEqual(pass2.input.parentRunId, "ar_acme_p1");
    });
  });

  describe("status transitions", () => {
    it("allows pending -> running -> complete", () => {
      const pending = agentRunContract.parse({
        id: "ar_lifecycle",
        goalId: "deal_test",
        parentRunId: null,
        runKind: "first_pass",
        resolvedContext: {
          dealId: "deal_test",
          passNumber: 1,
          capturedAt: "2026-06-27T10:00:00.000Z",
        },
        status: "pending",
        createdAt: "2026-06-27T10:00:00.000Z",
        completedAt: null,
      });
      assert.strictEqual(pending.status, "pending");

      const running = agentRunContract.parse({ ...pending, status: "running" });
      assert.strictEqual(running.status, "running");

      const complete = agentRunContract.parse({
        ...pending,
        status: "complete",
        completedAt: "2026-06-27T10:01:00.000Z",
      });
      assert.strictEqual(complete.status, "complete");
    });

    it("allows error status with null completedAt", () => {
      const errored = agentRunContract.parse({
        id: "ar_error",
        goalId: "deal_test",
        parentRunId: null,
        runKind: "first_pass",
        resolvedContext: {
          dealId: "deal_test",
          passNumber: 1,
          capturedAt: "2026-06-27T10:00:00.000Z",
        },
        status: "error",
        createdAt: "2026-06-27T10:00:00.000Z",
        completedAt: null,
      });
      assert.strictEqual(errored.status, "error");
    });
  });

  describe("resolved context snapshot", () => {
    it("captures dealId, passNumber, capturedAt", () => {
      const ctx = acmeAgentRunPass1.resolvedContext;
      assert.strictEqual(ctx.dealId, "deal_acme");
      assert.strictEqual(ctx.passNumber, 1);
      assert.ok(ctx.capturedAt);
    });

    it("pass 1 and pass 2 have different capturedAt timestamps", () => {
      const ctx1 = acmeAgentRunPass1.resolvedContext;
      const ctx2 = acmeAgentRunPass2.resolvedContext;
      assert.notStrictEqual(ctx1.capturedAt, ctx2.capturedAt);
    });

    it("pass 2 capturedAt is after enforcement action", () => {
      // DEMO_CONTRACT: enforcement at 10:04, audit event at 10:05
      // Pass 2 capturedAt should be after the enforcement window
      assert.ok(acmeAgentRunPass2.resolvedContext.capturedAt >= "2026-06-27T10:05:00.000Z");
    });
  });

  describe("deal id consistency", () => {
    it("all Acme runs target the same deal", () => {
      const runs = [acmeAgentRunPass1, acmeAgentRunPass2, acmeAgentRunReplay];
      const deals = new Set(runs.map((r) => r.goalId));
      assert.strictEqual(deals.size, 1);
      assert.ok(deals.has("deal_acme"));
    });
  });
});
