import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REQUIREMENT_EVIDENCE_SCHEMA,
  requirementEvidenceContract,
  requirementEvidenceGoldenVectors,
  type RequirementEvidence,
} from "../src/requirement-evidence.contract.ts";

const evidence: RequirementEvidence = {
  sourceId: "call_acme_kickoff",
  sourceType: "call-transcript",
  span: "00:12:30-00:12:58",
  quote: "All customer data for EU subsidiaries must remain in EU data centers; this is a contractual obligation.",
  hash: "550d305ae8408bec196d3cae7d5a9a0bc63b17bacc7b68160add3f6b024e45ee",
  capturedAt: "2026-06-27T09:45:00.000Z",
};

test("every RequirementEvidence golden vector parses through its contract", () => {
  for (const v of requirementEvidenceGoldenVectors) {
    assert.doesNotThrow(
      () => requirementEvidenceContract.parse(v.input),
      `golden vector ${v.name} must be valid RequirementEvidence`,
    );
  }
});

test("RequirementEvidence requires every locator field (sourceId/sourceType/span/quote/hash/capturedAt)", () => {
  for (const key of ["sourceId", "sourceType", "span", "quote", "hash", "capturedAt"] as const) {
    const broken = { ...evidence };
    delete (broken as Record<string, unknown>)[key];
    assert.throws(
      () => requirementEvidenceContract.parse(broken),
      `missing ${key} must be rejected`,
    );
    assert.throws(
      () => requirementEvidenceContract.parse({ ...evidence, [key]: "" }),
      `empty ${key} must be rejected`,
    );
  }
});

test("RequirementEvidence rejects a non-datetime capturedAt", () => {
  assert.throws(() => requirementEvidenceContract.parse({ ...evidence, capturedAt: "this morning" }));
});

test("RequirementEvidence is strict — unknown keys are rejected", () => {
  assert.throws(
    () => requirementEvidenceContract.parse({ ...evidence, author: "Security" }),
    /Unrecognized key/,
  );
});

test("RequirementEvidence canonical projection is schema-tagged snake_case and carries the hash reference", () => {
  const canon = requirementEvidenceContract.canonical(evidence) as Record<string, unknown>;
  assert.equal(canon.schema, REQUIREMENT_EVIDENCE_SCHEMA);
  assert.equal(canon.source_id, "call_acme_kickoff");
  assert.equal(canon.source_type, "call-transcript");
  assert.equal(canon.captured_at, "2026-06-27T09:45:00.000Z");
  assert.equal(canon.hash, evidence.hash);
  assert.equal(canon.quote, evidence.quote);
});

test("RequirementEvidence canonical hash is deterministic", () => {
  assert.equal(requirementEvidenceContract.hash(evidence), requirementEvidenceContract.hash(evidence));
  assert.match(requirementEvidenceContract.hash(evidence), /^[0-9a-f]{64}$/);
});
