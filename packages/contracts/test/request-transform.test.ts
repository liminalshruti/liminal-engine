import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REQUEST_TRANSFORM_SCHEMA,
  requestTransformContract,
} from "../src/request-transform.contract.ts";

const redact = {
  id: "rt_redact",
  fromRuleId: "aprule_no_secret_leak",
  kind: "redact" as const,
  match: { field: "tool" as const, op: "==" as const, value: "openai" },
  payload: { pattern: "sk-[A-Za-z0-9]{20,}", replacement: "[REDACTED]" },
};
const inject = {
  id: "rt_inject",
  fromRuleId: "aprule_eu",
  kind: "inject_system_constraint" as const,
  payload: { text: "Honor EU data residency." },
};
const requireFields = {
  id: "rt_require",
  fromRuleId: "aprule_consent",
  kind: "require_fields" as const,
  payload: { fields: ["user_consent", "data_region"] },
};
const forbid = {
  id: "rt_forbid",
  fromRuleId: "aprule_keys",
  kind: "forbid_patterns" as const,
  payload: { patterns: ["BEGIN RSA PRIVATE KEY"] },
};

test("RequestTransform parses every kind with a valid payload and round-trips", () => {
  for (const t of [redact, inject, requireFields, forbid]) {
    assert.deepEqual(requestTransformContract.parse(t), t);
  }
});

test("match is optional — a transform with no condition applies unconditionally", () => {
  assert.equal(requestTransformContract.safeParse(inject).success, true); // no match field
  const { match: _omit, ...redactNoMatch } = redact;
  assert.equal(requestTransformContract.safeParse(redactNoMatch).success, true);
});

test("kind enum is closed", () => {
  assert.equal(requestTransformContract.safeParse({ ...inject, kind: "rewrite" }).success, false);
});

test("payload is validated PER kind — no free-form DSL", () => {
  // redact requires a non-empty pattern
  assert.equal(requestTransformContract.safeParse({ ...redact, payload: { replacement: "x" } }).success, false);
  // inject requires text
  assert.equal(requestTransformContract.safeParse({ ...inject, payload: { note: "x" } }).success, false);
  // require_fields requires a non-empty string[]
  assert.equal(requestTransformContract.safeParse({ ...requireFields, payload: { fields: [] } }).success, false);
  assert.equal(requestTransformContract.safeParse({ ...requireFields, payload: { fields: [1, 2] } }).success, false);
  // forbid_patterns requires a non-empty string[]
  assert.equal(requestTransformContract.safeParse({ ...forbid, payload: { patterns: "nope" } }).success, false);
  // well-formed payloads pass
  for (const t of [redact, inject, requireFields, forbid]) {
    assert.equal(requestTransformContract.safeParse(t).success, true);
  }
});

test("shape is strict and core fields are required/non-empty", () => {
  assert.equal(requestTransformContract.safeParse({ ...inject, bogus: 1 }).success, false);
  for (const field of ["id", "fromRuleId"] as const) {
    const { [field]: _omit, ...missing } = inject;
    assert.equal(requestTransformContract.safeParse(missing).success, false, `missing ${field} should reject`);
    assert.equal(requestTransformContract.safeParse({ ...inject, [field]: "" }).success, false, `empty ${field} should reject`);
  }
});

test("match reuses the structured-condition validation from action-policy-rule", () => {
  // numeric op with a non-numeric value is rejected by the reused condition's superRefine
  assert.equal(
    requestTransformContract.safeParse({ ...redact, match: { field: "reviews.approved", op: "<", value: "two" } }).success,
    false,
  );
  // an out-of-vocabulary condition field is rejected
  assert.equal(
    requestTransformContract.safeParse({ ...redact, match: { field: "model", op: "==", value: "gpt" } }).success,
    false,
  );
});

test("canonical snake_cases keys, projects match when present, omits it when absent", () => {
  const r = requestTransformContract.canonical(redact) as Record<string, unknown>;
  assert.equal(r.schema, REQUEST_TRANSFORM_SCHEMA);
  assert.equal(r.from_rule_id, "aprule_no_secret_leak");
  assert.deepEqual(r.match, { field: "tool", op: "==", value: "openai" });
  assert.ok(!("fromRuleId" in r));
  const i = requestTransformContract.canonical(inject) as Record<string, unknown>;
  assert.ok(!("match" in i), "absent match must be omitted from the canonical projection");
});

test("hash is deterministic, payload key-order independent, content-addressed", () => {
  const h = requestTransformContract.hash(redact);
  assert.match(h, /^[0-9a-f]{64}$/);
  // payload key order must not change the hash (canonical-hash sorts keys)
  const reordered = { ...redact, payload: { replacement: "[REDACTED]", pattern: "sk-[A-Za-z0-9]{20,}" } };
  assert.equal(requestTransformContract.hash(reordered), h);
  // a material payload change changes the hash
  assert.notEqual(requestTransformContract.hash({ ...redact, payload: { pattern: "different" } }), h);
});
