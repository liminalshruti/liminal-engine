/**
 * Substrate contract tests — schema validation, hash stability, fixture validity.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { substrateContract, type Substrate, substrateGoldenVectors } from "./substrate.contract.ts";
import {
  ACME_SUBSTRATE_SEQUENCE,
  GOVERNANCE_LOOP_SUBSTRATE_CHAIN,
} from "./fixtures.ts";

test("Substrate contract parses valid snapshots", () => {
  const vectorEntry = substrateGoldenVectors[0];
  assert(vectorEntry !== undefined, "golden vector should exist");
  const valid = vectorEntry.input;
  const parsed = substrateContract.parse(valid);

  assert.equal(parsed.id, "substrate_gc_acme_eu_001");
  assert.equal(parsed.entity, "governance-case");
  assert.equal(parsed.version, "1.0.0");
  assert.equal(parsed.schema, "liminal_engine.governance_case.v1");
  assert.equal(parsed.sourceSystem, "liminal-engine");
});

test("Substrate contract rejects invalid commit hash", () => {
  const vectorEntry = substrateGoldenVectors[0];
  assert(vectorEntry !== undefined, "golden vector should exist");
  const invalid = {
    ...vectorEntry.input,
    commitHash: "invalid-hash",
  };

  assert.throws(
    () => substrateContract.parse(invalid),
    /Invalid/,
    "should reject non-40-hex commit hash",
  );
});

test("Substrate contract rejects invalid semantic version", () => {
  const vectorEntry = substrateGoldenVectors[0];
  assert(vectorEntry !== undefined, "golden vector should exist");
  const invalid = {
    ...vectorEntry.input,
    version: "invalid.version",
  };

  assert.throws(
    () => substrateContract.parse(invalid),
    /Invalid/,
    "should reject non-semver version",
  );
});

test("Substrate contract enforces timestamp as ISO 8601 datetime", () => {
  const vectorEntry = substrateGoldenVectors[0];
  assert(vectorEntry !== undefined, "golden vector should exist");
  const invalid = {
    ...vectorEntry.input,
    timestamp: "not-a-timestamp",
  };

  assert.throws(
    () => substrateContract.parse(invalid),
    /Invalid datetime/,
    "should reject non-ISO timestamp",
  );
});

test("Substrate contract allows optional fields (parentRef, tags, etc.)", () => {
  const minimal = {
    id: "substrate_minimal_001",
    entity: "audit-event",
    version: "1.0.0",
    schema: "liminal_engine.audit_event.v1",
    commitHash: "0000000000000000000000000000000000000001",
    content: { some: "data" },
    timestamp: "2026-06-27T10:00:00.000Z",
  };

  const parsed = substrateContract.parse(minimal);
  assert.equal(typeof parsed.parentRef, "undefined");
  assert.equal(typeof parsed.tags, "undefined");
  assert.equal(typeof parsed.sourceSystem, "undefined");
  assert.equal(typeof parsed.integrity, "undefined");
});

test("Substrate contract safeParse returns SafeParseReturnType", () => {
  const vectorEntry = substrateGoldenVectors[0];
  assert(vectorEntry !== undefined, "golden vector should exist");
  const valid = vectorEntry.input;
  const result = substrateContract.safeParse(valid);

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.id, "substrate_gc_acme_eu_001");
  }
});

test("Substrate contract safeParse handles invalid input without throwing", () => {
  const invalid = { bad: "data" };
  const result = substrateContract.safeParse(invalid);

  assert.equal(result.success, false);
});

test("Substrate contract hash is stable (deterministic)", () => {
  const vectorEntry = substrateGoldenVectors[0];
  assert(vectorEntry !== undefined, "golden vector should exist");
  const input = vectorEntry.input;
  const hash1 = substrateContract.hash(input);
  const hash2 = substrateContract.hash(input);

  assert.equal(hash1, hash2, "hash should be identical across calls");
});

test("Substrate contract hash differs when content changes", () => {
  const vectorEntry = substrateGoldenVectors[0];
  assert(vectorEntry !== undefined, "golden vector should exist");
  const input1 = vectorEntry.input;
  const input2 = {
    ...input1,
    id: "different-id",
  };

  const hash1 = substrateContract.hash(input1);
  const hash2 = substrateContract.hash(input2);

  assert.notEqual(hash1, hash2, "hash should differ when id changes");
});

test("Substrate contract canonical projection normalizes field names", () => {
  const vectorEntry = substrateGoldenVectors[0];
  assert(vectorEntry !== undefined, "golden vector should exist");
  const input = vectorEntry.input;
  const canonical = substrateContract.canonical(input);

  // Field names should be snake_case in canonical form
  assert.equal(canonical.source_system, "liminal-engine");
  assert.equal(canonical.schema_id, "liminal_engine.governance_case.v1");
  assert.equal(canonical.commit_hash, input.commitHash);
});

test("ACME_SUBSTRATE_SEQUENCE contains all expected keys", () => {
  assert.equal(typeof ACME_SUBSTRATE_SEQUENCE["gc-detection"], "object");
  assert.equal(typeof ACME_SUBSTRATE_SEQUENCE["enforcement-action"], "object");
  assert.equal(typeof ACME_SUBSTRATE_SEQUENCE["eval-case"], "object");
});

test("ACME_SUBSTRATE_SEQUENCE fixtures are all valid", () => {
  Object.entries(ACME_SUBSTRATE_SEQUENCE).forEach(([key, substrate]) => {
    const result = substrateContract.safeParse(substrate);
    assert.equal(
      result.success,
      true,
      `Fixture '${key}' should pass schema validation`,
    );
  });
});

test("ACME_SUBSTRATE_SEQUENCE respects parent chain (gc-detection -> enforcement-action -> eval-case)", () => {
  const gcDetection = ACME_SUBSTRATE_SEQUENCE["gc-detection"];
  const enforcementAction = ACME_SUBSTRATE_SEQUENCE["enforcement-action"];
  const evalCase = ACME_SUBSTRATE_SEQUENCE["eval-case"];

  assert(gcDetection !== undefined, "gc-detection should exist");
  assert(enforcementAction !== undefined, "enforcement-action should exist");
  assert(evalCase !== undefined, "eval-case should exist");

  assert.equal(gcDetection.parentRef, undefined, "first substrate has no parent");
  assert.equal(
    enforcementAction.parentRef,
    gcDetection.id,
    "enforcement-action chains to gc-detection",
  );
  assert.equal(
    evalCase.parentRef,
    enforcementAction.id,
    "eval-case chains to enforcement-action",
  );
});

test("GOVERNANCE_LOOP_SUBSTRATE_CHAIN metadata is consistent with fixtures", () => {
  const chain = GOVERNANCE_LOOP_SUBSTRATE_CHAIN;
  assert.equal(chain.scenario, "acme-false-green");
  assert.deepEqual(chain.substrates, ["gc-detection", "enforcement-action", "eval-case"]);
  assert.equal(chain.sequence.length, 3);

  // Verify each step exists as a fixture
  chain.sequence.forEach((step) => {
    assert.equal(
      typeof ACME_SUBSTRATE_SEQUENCE[step.key],
      "object",
      `Step ${step.step} references fixture key '${step.key}'`,
    );
  });
});

test("GOVERNANCE_LOOP_SUBSTRATE_CHAIN sequence progresses through the governance loop", () => {
  const chain = GOVERNANCE_LOOP_SUBSTRATE_CHAIN;
  const expectedActions = ["observe-and-detect", "correct-and-enforce", "audit-and-improve"];

  chain.sequence.forEach((step, idx) => {
    assert.equal(
      step.action,
      expectedActions[idx],
      `Step ${step.step} should have action '${expectedActions[idx]}'`,
    );
  });
});
