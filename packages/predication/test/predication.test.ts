/**
 * predication.test.ts — contract tests + golden vector validation.
 * Tests the Predication contract shape, parsing, canonical hashing, and fixtures.
 */

import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  predicationContract,
  predicationGoldenVectors,
  type Predication,
} from "../src/predication.contract.ts";
import {
  acmeFalseGreenPredication,
  acmeRefutedPredication,
} from "../src/fixtures.ts";

test("Predication contract parses valid input", () => {
  const input = {
    id: "pred_test_1",
    assertion: "This claim is true",
    confidence: 0.85,
    evidence: ["fact 1", "fact 2"],
    refutationPaths: [
      { description: "evidence contradicts claim", weight: 0.8 },
    ],
    timestamp: 1719345600,
  };

  const parsed = predicationContract.parse(input);
  assert.deepEqual(parsed, input);
});

test("Predication contract rejects invalid confidence (out of range)", () => {
  const input = {
    id: "pred_test_2",
    assertion: "This claim is true",
    confidence: 1.5, // invalid: > 1
    evidence: ["fact 1"],
    refutationPaths: [],
    timestamp: 1719345600,
  };

  assert.throws(
    () => predicationContract.parse(input),
    /too_big/,
  );
});

test("Predication contract rejects missing required fields", () => {
  const input = {
    id: "pred_test_3",
    assertion: "This claim is true",
    // missing: confidence, evidence, refutationPaths, timestamp
  };

  assert.throws(
    () => predicationContract.parse(input),
    /confidence/,
  );
});

test("Predication contract produces stable canonical form", () => {
  // Two predicates with different evidence order should canonicalize identically
  const pred1: Predication = {
    id: "pred_stable",
    assertion: "Test claim",
    confidence: 0.9,
    evidence: ["a", "b", "c"],
    refutationPaths: [
      { description: "path-z", weight: 0.5 },
      { description: "path-a", weight: 0.7 },
    ],
    timestamp: 1719345600,
  };

  const pred2: Predication = {
    id: "pred_stable",
    assertion: "Test claim",
    confidence: 0.9,
    evidence: ["c", "a", "b"], // reordered
    refutationPaths: [
      { description: "path-a", weight: 0.7 }, // reordered
      { description: "path-z", weight: 0.5 },
    ],
    timestamp: 1719345600,
  };

  const canonical1 = predicationContract.canonical(pred1);
  const canonical2 = predicationContract.canonical(pred2);

  assert.deepEqual(canonical1, canonical2);
});

test("Predication contract hashes are stable across parse", () => {
  const input = {
    id: "pred_hash_stable",
    assertion: "Deterministic hash",
    confidence: 0.75,
    evidence: ["evidence-1", "evidence-2"],
    refutationPaths: [
      { description: "refutation-1", weight: 0.6 },
    ],
    timestamp: 1719345600,
  };

  const parsed = predicationContract.parse(input);
  const hash1 = predicationContract.hash(input);
  const hash2 = predicationContract.hash(parsed);

  assert.equal(hash1, hash2);
  assert.ok(typeof hash1 === "string" && hash1.length > 0);
});

test("Golden vector: false-green-acme-predication is valid and hashable", () => {
  const vector = predicationGoldenVectors.find(
    (v) => v.name === "false-green-acme-predication",
  );
  assert.ok(vector, "should have false-green-acme-predication vector");

  const parsed = predicationContract.parse(vector.input);
  const hash = predicationContract.hash(parsed);

  assert.equal(parsed.id, "pred_acme_on_track");
  assert.equal(parsed.assertion, "Acme expansion is on-track for close by Friday");
  assert.equal(parsed.confidence, 0.95);
  assert.equal(parsed.evidence.length, 3);
  assert.equal(parsed.refutationPaths.length, 3);
  assert.ok(typeof hash === "string" && hash.length > 0);
});

test("Golden vector: refuted-predication is valid and hashable", () => {
  const vector = predicationGoldenVectors.find(
    (v) => v.name === "refuted-predication",
  );
  assert.ok(vector, "should have refuted-predication vector");

  const parsed = predicationContract.parse(vector.input);
  const hash = predicationContract.hash(parsed);

  assert.equal(parsed.id, "pred_acme_on_track_post");
  assert.equal(parsed.confidence, 0.1);
  assert.ok(parsed.evidence.some((e) => e.includes("REFUTED")));
  assert.ok(typeof hash === "string" && hash.length > 0);
});

test("Fixture: acmeFalseGreenPredication is the false-green state", () => {
  const pred = acmeFalseGreenPredication;

  assert.equal(pred.id, "pred_acme_on_track");
  assert.equal(pred.confidence, 0.95);
  assert.equal(pred.assertion, "Acme expansion is on-track for close by Friday");
  assert.ok(
    pred.refutationPaths.some((r) => r.description.includes("EU data residency")),
  );
});

test("Fixture: acmeRefutedPredication shows state after refutation", () => {
  const pred = acmeRefutedPredication;

  assert.equal(pred.id, "pred_acme_on_track_post");
  assert.equal(pred.confidence, 0.1); // dramatically reduced
  assert.ok(
    pred.evidence.some((e) => e.includes("REFUTED")),
  );
});

test("Predication contract embedding schema in canonical form", () => {
  const input: Predication = {
    id: "pred_schema_check",
    assertion: "Schema is embedded",
    confidence: 0.5,
    evidence: ["check"],
    refutationPaths: [],
    timestamp: 1719345600,
  };

  const canonical = predicationContract.canonical(input);

  assert.ok("schema" in canonical);
  assert.equal(canonical.schema, "liminal_engine.predication.v1");
});

test("Predication contract safeParse returns success for valid input", () => {
  const input = {
    id: "pred_safe_valid",
    assertion: "Valid claim",
    confidence: 0.8,
    evidence: ["e1"],
    refutationPaths: [],
    timestamp: 1719345600,
  };

  const result = predicationContract.safeParse(input);

  assert.ok(result.success);
  assert.deepEqual(result.data, input);
});

test("Predication contract safeParse returns error for invalid input", () => {
  const input = {
    id: "pred_safe_invalid",
    assertion: "Invalid claim",
    confidence: "not a number", // invalid type
    evidence: ["e1"],
    refutationPaths: [],
    timestamp: 1719345600,
  };

  const result = predicationContract.safeParse(input);

  assert.ok(!result.success);
  assert.ok(result.error);
});

test("Predication with min/max confidence values", () => {
  const certainty: Predication = {
    id: "pred_certain",
    assertion: "Absolutely certain",
    confidence: 1.0, // max
    evidence: [],
    refutationPaths: [],
    timestamp: 1719345600,
  };

  const uncertainty: Predication = {
    id: "pred_uncertain",
    assertion: "Not certain at all",
    confidence: 0.0, // min
    evidence: [],
    refutationPaths: [],
    timestamp: 1719345600,
  };

  assert.doesNotThrow(() => predicationContract.parse(certainty));
  assert.doesNotThrow(() => predicationContract.parse(uncertainty));
});

test("Predication contract enforces non-empty assertion and id", () => {
  const emptyAssertion = {
    id: "pred_test",
    assertion: "", // invalid: empty string
    confidence: 0.5,
    evidence: [],
    refutationPaths: [],
    timestamp: 1719345600,
  };

  assert.throws(
    () => predicationContract.parse(emptyAssertion),
    /assertion/,
  );

  const emptyId = {
    id: "", // invalid: empty string
    assertion: "Some claim",
    confidence: 0.5,
    evidence: [],
    refutationPaths: [],
    timestamp: 1719345600,
  };

  assert.throws(
    () => predicationContract.parse(emptyId),
    /id/,
  );
});
