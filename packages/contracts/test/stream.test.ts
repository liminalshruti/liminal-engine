/**
 * Tests for Stream contract.
 * Validates the shape, golden vectors, canonical hash stability,
 * and the artifact lineage/dependency logic.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Stream } from "../src/stream.contract.ts";
import {
  streamContract,
  streamGoldenVectors,
  streamShape,
  STREAM_SCHEMA,
} from "../src/stream.contract.ts";
import { canonicalHash } from "../src/canonical-hash.ts";

const acmeGolden = streamGoldenVectors[0]!;

test("Stream Contract — Schema validation", async (t) => {
  await t.test("should validate a correct Stream", () => {
    const stream = acmeGolden.input;
    const parsed = streamShape.safeParse(stream);
    assert.ok(parsed.success);
    if (parsed.success) {
      assert.deepEqual(parsed.data, stream);
    }
  });

  await t.test("should reject Stream with missing required fields", () => {
    const invalid = {
      id: "stream_invalid",
      // goalId is missing
      name: "Invalid stream",
      agentRuns: [],
      artifacts: [],
      createdAt: "2026-06-27T08:00:00.000Z",
    };
    const parsed = streamShape.safeParse(invalid);
    assert.equal(parsed.success, false);
  });

  await t.test("should reject Stream with empty agentRuns array", () => {
    const invalid = {
      id: "stream_invalid",
      goalId: "goal_123",
      name: "Invalid stream",
      agentRuns: [], // must have at least one
      artifacts: [],
      createdAt: "2026-06-27T08:00:00.000Z",
    };
    const parsed = streamShape.safeParse(invalid);
    assert.equal(parsed.success, false);
  });

  await t.test("should allow optional notes", () => {
    const stream = {
      id: "stream_test",
      goalId: "goal_test",
      name: "Test stream",
      agentRuns: [
        {
          id: "run_1",
          agentRole: "TestAgent",
          passNumber: 1,
          outputId: "out_1",
          executedAt: "2026-06-27T08:00:00.000Z",
          dependsOn: [],
        },
      ],
      artifacts: [],
      createdAt: "2026-06-27T08:00:00.000Z",
      notes: "Optional notes about the stream",
    };
    const parsed = streamShape.safeParse(stream);
    assert.ok(parsed.success);
    if (parsed.success) {
      assert.equal(parsed.data.notes, "Optional notes about the stream");
    }
  });
});

test("Stream Contract — Golden vectors", async (t) => {
  await t.test("should have exactly one golden vector", () => {
    assert.equal(streamGoldenVectors.length, 1);
  });

  await t.test("should validate the Acme two-pass golden vector", () => {
    assert.equal(acmeGolden.name, "acme-two-pass-stream");
    assert.match(acmeGolden.purpose, /false-green/);
    assert.match(acmeGolden.purpose, /second-pass/);

    const parsed = streamShape.safeParse(acmeGolden.input);
    assert.ok(parsed.success);
  });

  await t.test("should have exactly 6 agent runs in the Acme stream (2 passes × 3 agents)", () => {
    const stream = acmeGolden.input;
    assert.equal(stream.agentRuns.length, 6);

    // First pass: 3 agents
    const pass1Runs = stream.agentRuns.filter((r) => r.passNumber === 1);
    assert.equal(pass1Runs.length, 3);
    const pass1Roles = pass1Runs.map((r) => r.agentRole).sort();
    assert.deepEqual(pass1Roles, ["Engineering", "Product", "Security"]);

    // Second pass: 3 agents
    const pass2Runs = stream.agentRuns.filter((r) => r.passNumber === 2);
    assert.equal(pass2Runs.length, 3);
    const pass2Roles = pass2Runs.map((r) => r.agentRole).sort();
    assert.deepEqual(pass2Roles, ["Engineering", "Product", "Security"]);
  });

  await t.test("should have second-pass runs depend on first-pass runs", () => {
    const stream = acmeGolden.input;
    const pass1Ids = stream.agentRuns
      .filter((r) => r.passNumber === 1)
      .map((r) => r.id)
      .sort();
    const pass2Runs = stream.agentRuns.filter((r) => r.passNumber === 2);

    pass2Runs.forEach((run) => {
      assert.ok(run.dependsOn);
      assert.ok(run.dependsOn.length > 0);
      // Every second-pass run should depend on the three first-pass runs
      pass1Ids.forEach((pass1Id) => {
        assert.ok(run.dependsOn.includes(pass1Id));
      });
    });
  });

  await t.test(
    "should have artifact lineage: transcript → requirements → analyses → governance case",
    () => {
      const stream = acmeGolden.input;

      // Customer call transcript (no dependencies)
      const transcript = stream.artifacts.find(
        (a) => a.id === "art_customer_call_transcript",
      );
      assert.ok(transcript);
      assert.deepEqual(transcript.derivedFrom, []);

      // Requirements list (derived from transcript)
      const requirements = stream.artifacts.find(
        (a) => a.id === "art_requirements_list",
      );
      assert.ok(requirements);
      assert.ok(requirements.derivedFrom.includes("art_customer_call_transcript"));

      // Commercial analysis (derived from requirements)
      const commercial = stream.artifacts.find(
        (a) => a.id === "art_commercial_analysis_p1",
      );
      assert.ok(commercial);
      assert.ok(commercial.derivedFrom.includes("art_requirements_list"));

      // Governance case (derived from requirements and security assessment)
      const govCase = stream.artifacts.find(
        (a) => a.id === "art_governance_case_id",
      );
      assert.ok(govCase);
      assert.ok(govCase.derivedFrom.includes("art_requirements_list"));
      assert.ok(govCase.derivedFrom.includes("art_security_assessment_p1"));
    },
  );

  await t.test("should have second-pass artifacts depend on enforcement action", () => {
    const stream = acmeGolden.input;

    const enforcement = stream.artifacts.find(
      (a) => a.id === "art_enforcement_action",
    );
    assert.ok(enforcement);

    // Second-pass analyses should depend on the enforcement action
    const commercial2 = stream.artifacts.find(
      (a) => a.id === "art_commercial_analysis_p2",
    );
    assert.ok(commercial2?.derivedFrom.includes("art_enforcement_action"));

    const security2 = stream.artifacts.find(
      (a) => a.id === "art_security_assessment_p2",
    );
    assert.ok(security2?.derivedFrom.includes("art_enforcement_action"));

    const tech2 = stream.artifacts.find(
      (a) => a.id === "art_technical_analysis_p2",
    );
    assert.ok(tech2?.derivedFrom.includes("art_enforcement_action"));
  });

  await t.test("should have eval case derive from multiple pass-2 artifacts", () => {
    const stream = acmeGolden.input;

    const evalCase = stream.artifacts.find(
      (a) => a.id === "art_eval_case",
    );
    assert.ok(evalCase);
    assert.equal(evalCase.type, "evidence");

    // Eval case should depend on governance case and all second-pass analyses
    assert.ok(evalCase.derivedFrom.includes("art_governance_case_id"));
    assert.ok(evalCase.derivedFrom.includes("art_commercial_analysis_p2"));
    assert.ok(evalCase.derivedFrom.includes("art_security_assessment_p2"));
    assert.ok(evalCase.derivedFrom.includes("art_technical_analysis_p2"));
  });
});

test("Stream Contract — Canonical hash (determinism)", async (t) => {
  await t.test("should produce stable hash for the same stream", () => {
    const stream = acmeGolden.input;
    const canonical1 = streamContract.canonical(stream);
    const canonical2 = streamContract.canonical(stream);
    const hash1 = canonicalHash(canonical1);
    const hash2 = canonicalHash(canonical2);
    assert.equal(hash1, hash2);
  });

  await t.test("should produce different hash for different stream IDs", () => {
    const stream1 = acmeGolden.input;
    const stream2: Stream = {
      ...stream1,
      id: "stream_different",
    };
    const hash1 = canonicalHash(streamContract.canonical(stream1));
    const hash2 = canonicalHash(streamContract.canonical(stream2));
    assert.notEqual(hash1, hash2);
  });

  await t.test("should normalize arrays (dependsOn, derivedFrom) in canonical form", () => {
    const stream1 = acmeGolden.input;
    // Create a variant with reversed dependsOn arrays
    const stream2: Stream = {
      ...stream1,
      agentRuns: stream1.agentRuns.map((run) => ({
        ...run,
        dependsOn:
          run.dependsOn && run.dependsOn.length > 1
            ? [...run.dependsOn].reverse() // Reverse the order
            : run.dependsOn,
      })),
    };
    const hash1 = canonicalHash(streamContract.canonical(stream1));
    const hash2 = canonicalHash(streamContract.canonical(stream2));
    // Should be the same because canonical form sorts these arrays
    assert.equal(hash1, hash2);
  });

  await t.test("should include schema version in hash", () => {
    const stream = acmeGolden.input;
    const canonical = streamContract.canonical(stream);
    assert.equal(canonical.schema, STREAM_SCHEMA);
  });
});

test("Stream Contract — Dependency graph logic", async (t) => {
  await t.test("should allow a stream with no dependencies (single-pass)", () => {
    const singlePass: Stream = {
      id: "stream_single",
      goalId: "goal_1",
      name: "Single-pass stream",
      agentRuns: [
        {
          id: "run_1",
          agentRole: "Agent1",
          passNumber: 1,
          outputId: "out_1",
          executedAt: "2026-06-27T08:00:00.000Z",
          dependsOn: [],
        },
      ],
      artifacts: [],
      createdAt: "2026-06-27T08:00:00.000Z",
    };
    const parsed = streamShape.safeParse(singlePass);
    assert.ok(parsed.success);
  });

  await t.test(
    "should allow partial artifact derivation (an artifact can have zero dependencies)",
    () => {
      const stream: Stream = {
        id: "stream_partial",
        goalId: "goal_1",
        name: "Partial derivation",
        agentRuns: [
          {
            id: "run_1",
            agentRole: "Agent1",
            passNumber: 1,
            outputId: "out_1",
            executedAt: "2026-06-27T08:00:00.000Z",
            dependsOn: [],
          },
        ],
        artifacts: [
          {
            id: "art_1",
            type: "evidence",
            label: "Original evidence",
            producedByRunId: "run_1",
            derivedFrom: [],
          },
          {
            id: "art_2",
            type: "analysis",
            label: "Analysis derived from evidence",
            producedByRunId: "run_1",
            derivedFrom: ["art_1"],
          },
        ],
        createdAt: "2026-06-27T08:00:00.000Z",
      };
      const parsed = streamShape.safeParse(stream);
      assert.ok(parsed.success);
      if (parsed.success) {
        assert.ok(parsed.data.artifacts[0]);
        assert.ok(parsed.data.artifacts[1]);
        assert.deepEqual(parsed.data.artifacts[0]!.derivedFrom, []);
        assert.deepEqual(parsed.data.artifacts[1]!.derivedFrom, ["art_1"]);
      }
    },
  );
});

test("Stream Contract — Acme scenario invariants", async (t) => {
  await t.test("should link all artifacts to a valid agentRun", () => {
    const stream = acmeGolden.input;
    const runIds = new Set(stream.agentRuns.map((r) => r.id));
    stream.artifacts.forEach((art) => {
      assert.ok(runIds.has(art.producedByRunId));
    });
  });

  await t.test("should have no duplicate artifact IDs", () => {
    const stream = acmeGolden.input;
    const artIds = stream.artifacts.map((a) => a.id);
    const uniqueIds = new Set(artIds);
    assert.equal(artIds.length, uniqueIds.size);
  });

  await t.test("should have no duplicate agentRun IDs", () => {
    const stream = acmeGolden.input;
    const runIds = stream.agentRuns.map((r) => r.id);
    const uniqueIds = new Set(runIds);
    assert.equal(runIds.length, uniqueIds.size);
  });

  await t.test("should have all first-pass output IDs match (single output)", () => {
    const stream = acmeGolden.input;
    const pass1Runs = stream.agentRuns.filter((r) => r.passNumber === 1);
    const outputIds = pass1Runs.map((r) => r.outputId);
    assert.equal(new Set(outputIds).size, 1); // All should be the same
    assert.equal(outputIds[0], "ao_acme_p1");
  });

  await t.test("should have all second-pass output IDs match (single output)", () => {
    const stream = acmeGolden.input;
    const pass2Runs = stream.agentRuns.filter((r) => r.passNumber === 2);
    const outputIds = pass2Runs.map((r) => r.outputId);
    assert.equal(new Set(outputIds).size, 1); // All should be the same
    assert.equal(outputIds[0], "ao_acme_p2");
  });

  await t.test("should have unique agent roles within each pass", () => {
    const stream = acmeGolden.input;
    [1, 2].forEach((passNumber) => {
      const runs = stream.agentRuns.filter((r) => r.passNumber === passNumber);
      const roles = runs.map((r) => r.agentRole);
      const uniqueRoles = new Set(roles);
      assert.equal(roles.length, uniqueRoles.size);
    });
  });
});

test("Stream Contract — Round-trip (parse + canonical + hash)", async (t) => {
  await t.test("should round-trip the Acme golden vector", () => {
    const original = acmeGolden.input;
    const parsed = streamShape.parse(original);
    assert.deepEqual(parsed, original);
    const canonical = streamContract.canonical(parsed);
    assert.ok(canonical);
    const hash = canonicalHash(canonical);
    assert.equal(typeof hash, "string");
    assert.ok(hash.length > 0);
  });
});
