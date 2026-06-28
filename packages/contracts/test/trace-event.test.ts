/**
 * TraceEvent contract tests — validation, canonical form, hash stability.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TRACE_EVENT_SCHEMA,
  traceEventShape,
  traceEventContract,
  traceEventGoldenVectors,
  type TraceEvent,
} from "../src/trace-event.contract.ts";
import { stableStringify, canonicalHash } from "../src/canonical-hash.ts";

test("TraceEvent contract schema constant is correct", () => {
  assert.equal(TRACE_EVENT_SCHEMA, "liminal_engine.trace_event.v1");
});

test("TraceEvent: parse() validates required fields", () => {
  const valid: TraceEvent = {
    id: "te_1",
    timestamp: "2026-06-27T10:00:00.000Z",
    stage: "detect",
    actor: "Agent",
    event: "case-detected",
  };
  const parsed = traceEventContract.parse(valid);
  assert.deepEqual(parsed, valid);
});

test("TraceEvent: parse() rejects empty id", () => {
  const invalid = {
    id: "",
    timestamp: "2026-06-27T10:00:00.000Z",
    stage: "detect",
    actor: "Agent",
    event: "case-detected",
  };
  assert.throws(() => traceEventContract.parse(invalid));
});

test("TraceEvent: parse() rejects invalid timestamp", () => {
  const invalid = {
    id: "te_1",
    timestamp: "not-a-datetime",
    stage: "detect",
    actor: "Agent",
    event: "case-detected",
  };
  assert.throws(() => traceEventContract.parse(invalid));
});

test("TraceEvent: parse() rejects invalid stage", () => {
  const invalid = {
    id: "te_1",
    timestamp: "2026-06-27T10:00:00.000Z",
    stage: "invalid-stage",
    actor: "Agent",
    event: "case-detected",
  };
  assert.throws(() => traceEventContract.parse(invalid));
});

test("TraceEvent: parse() rejects empty actor", () => {
  const invalid = {
    id: "te_1",
    timestamp: "2026-06-27T10:00:00.000Z",
    stage: "detect",
    actor: "",
    event: "case-detected",
  };
  assert.throws(() => traceEventContract.parse(invalid));
});

test("TraceEvent: parse() rejects empty event", () => {
  const invalid = {
    id: "te_1",
    timestamp: "2026-06-27T10:00:00.000Z",
    stage: "detect",
    actor: "Agent",
    event: "",
  };
  assert.throws(() => traceEventContract.parse(invalid));
});

test("TraceEvent: all six stages are valid", () => {
  const stages = ["observe", "detect", "correct", "enforce", "audit", "improve"];
  for (const stage of stages) {
    const valid: TraceEvent = {
      id: `te_${stage}`,
      timestamp: "2026-06-27T10:00:00.000Z",
      stage: stage as TraceEvent["stage"],
      actor: "Agent",
      event: "test-event",
    };
    assert.doesNotThrow(() => traceEventContract.parse(valid));
  }
});

test("TraceEvent: optional payload can be any object", () => {
  const withPayload: TraceEvent = {
    id: "te_1",
    timestamp: "2026-06-27T10:00:00.000Z",
    stage: "detect",
    actor: "Agent",
    event: "case-detected",
    payload: {
      caseId: "gc_1",
      level: "info",
      nested: { deep: { value: 42 } },
    },
  };
  const parsed = traceEventContract.parse(withPayload);
  assert.deepEqual(parsed.payload, withPayload.payload);
});

test("TraceEvent: optional parentEventId is preserved", () => {
  const withParent: TraceEvent = {
    id: "te_2",
    timestamp: "2026-06-27T10:00:00.000Z",
    stage: "correct",
    actor: "Agent",
    event: "correction-applied",
    parentEventId: "te_1",
  };
  const parsed = traceEventContract.parse(withParent);
  assert.equal(parsed.parentEventId, "te_1");
});

test("TraceEvent: canonical form includes schema and required fields", () => {
  const event: TraceEvent = {
    id: "te_1",
    timestamp: "2026-06-27T10:00:00.000Z",
    stage: "detect",
    actor: "Agent",
    event: "case-detected",
  };
  const canonical = traceEventContract.canonical(event);
  assert.equal(canonical.schema, TRACE_EVENT_SCHEMA);
  assert.equal(canonical.id, "te_1");
  assert.equal(canonical.timestamp, "2026-06-27T10:00:00.000Z");
  assert.equal(canonical.stage, "detect");
  assert.equal(canonical.actor, "Agent");
  assert.equal(canonical.event, "case-detected");
});

test("TraceEvent: canonical form omits optional fields when not present", () => {
  const event: TraceEvent = {
    id: "te_1",
    timestamp: "2026-06-27T10:00:00.000Z",
    stage: "detect",
    actor: "Agent",
    event: "case-detected",
  };
  const canonical = traceEventContract.canonical(event);
  assert.equal("payload" in canonical, false);
  assert.equal("parent_event_id" in canonical, false);
});

test("TraceEvent: canonical form includes optional fields when present", () => {
  const event: TraceEvent = {
    id: "te_1",
    timestamp: "2026-06-27T10:00:00.000Z",
    stage: "detect",
    actor: "Agent",
    event: "case-detected",
    payload: { key: "value" },
    parentEventId: "te_0",
  };
  const canonical = traceEventContract.canonical(event);
  assert.deepEqual(canonical.payload, { key: "value" });
  assert.equal(canonical.parent_event_id, "te_0");
});

test("TraceEvent: canonical form uses snake_case for field names", () => {
  const event: TraceEvent = {
    id: "te_1",
    timestamp: "2026-06-27T10:00:00.000Z",
    stage: "detect",
    actor: "Agent",
    event: "case-detected",
    parentEventId: "te_0",
  };
  const canonical = traceEventContract.canonical(event);
  assert.equal("parent_event_id" in canonical, true);
  assert.equal("parentEventId" in canonical, false);
});

test("TraceEvent: hash is stable for the same event", () => {
  const event: TraceEvent = {
    id: "te_1",
    timestamp: "2026-06-27T10:00:00.000Z",
    stage: "detect",
    actor: "Agent",
    event: "case-detected",
  };
  const hash1 = traceEventContract.hash(event);
  const hash2 = traceEventContract.hash(event);
  assert.equal(hash1, hash2);
  assert.match(hash1, /^[0-9a-f]{64}$/);
});

test("TraceEvent: hash changes when id changes", () => {
  const event1: TraceEvent = {
    id: "te_1",
    timestamp: "2026-06-27T10:00:00.000Z",
    stage: "detect",
    actor: "Agent",
    event: "case-detected",
  };
  const event2: TraceEvent = {
    ...event1,
    id: "te_2",
  };
  assert.notEqual(traceEventContract.hash(event1), traceEventContract.hash(event2));
});

test("TraceEvent: hash changes when stage changes", () => {
  const event1: TraceEvent = {
    id: "te_1",
    timestamp: "2026-06-27T10:00:00.000Z",
    stage: "detect",
    actor: "Agent",
    event: "case-detected",
  };
  const event2: TraceEvent = {
    ...event1,
    stage: "correct",
  };
  assert.notEqual(traceEventContract.hash(event1), traceEventContract.hash(event2));
});

test("TraceEvent: hash changes when payload changes", () => {
  const event1: TraceEvent = {
    id: "te_1",
    timestamp: "2026-06-27T10:00:00.000Z",
    stage: "detect",
    actor: "Agent",
    event: "case-detected",
    payload: { x: 1 },
  };
  const event2: TraceEvent = {
    ...event1,
    payload: { x: 2 },
  };
  assert.notEqual(traceEventContract.hash(event1), traceEventContract.hash(event2));
});

test("TraceEvent: parent-child chain is preserved in hash", () => {
  const parent: TraceEvent = {
    id: "te_1",
    timestamp: "2026-06-27T10:00:00.000Z",
    stage: "detect",
    actor: "Agent",
    event: "case-detected",
  };
  const child: TraceEvent = {
    id: "te_2",
    timestamp: "2026-06-27T10:01:00.000Z",
    stage: "correct",
    actor: "Agent",
    event: "correction-applied",
    parentEventId: parent.id,
  };
  // Different parent IDs should yield different hashes
  const childWithDifferentParent: TraceEvent = {
    ...child,
    parentEventId: "te_99",
  };
  assert.notEqual(
    traceEventContract.hash(child),
    traceEventContract.hash(childWithDifferentParent),
  );
});

test("TraceEvent: golden vectors have correct structure", () => {
  assert.ok(Array.isArray(traceEventGoldenVectors));
  assert.ok(traceEventGoldenVectors.length > 0);

  for (const vector of traceEventGoldenVectors) {
    assert.ok(vector.name);
    assert.ok(vector.purpose);
    assert.ok(vector.input);
    // Verify each golden input parses
    assert.doesNotThrow(() => traceEventContract.parse(vector.input));
  }
});

test("TraceEvent: acme-case-detected golden vector is valid", () => {
  const vector = traceEventGoldenVectors.find((v) => v.name === "acme-case-detected");
  assert.ok(vector);
  const event = traceEventContract.parse(vector!.input);
  assert.equal(event.id, "te_acme_detect_1");
  assert.equal(event.stage, "detect");
  assert.equal(event.event, "case-detected");
  assert.equal(event.actor, "AI Detection Agent");
  assert.ok(event.payload);
  assert.equal(event.payload.missedRequirement, "EU data residency");
});

test("TraceEvent: acme-correction-applied golden vector has parent", () => {
  const vector = traceEventGoldenVectors.find((v) => v.name === "acme-correction-applied");
  assert.ok(vector);
  const event = traceEventContract.parse(vector!.input);
  assert.equal(event.parentEventId, "te_acme_detect_1");
  assert.equal(event.stage, "correct");
});

test("TraceEvent: trace chain can be reconstructed from golden vectors", () => {
  const vectorsByName = new Map(traceEventGoldenVectors.map((v) => [v.name, v]));

  // Parse detect event
  const detectVector = vectorsByName.get("acme-case-detected");
  assert.ok(detectVector);
  const detectEvent = traceEventContract.parse(detectVector!.input);

  // Parse correct event (should have detect as parent)
  const correctVector = vectorsByName.get("acme-correction-applied");
  assert.ok(correctVector);
  const correctEvent = traceEventContract.parse(correctVector!.input);
  assert.equal(correctEvent.parentEventId, detectEvent.id);

  // Parse enforce event (should have correct as parent)
  const enforceVector = vectorsByName.get("acme-enforcement-queued");
  assert.ok(enforceVector);
  const enforceEvent = traceEventContract.parse(enforceVector!.input);
  assert.equal(enforceEvent.parentEventId, correctEvent.id);

  // Parse audit event (should have enforce as parent)
  const auditVector = vectorsByName.get("acme-audit-recorded");
  assert.ok(auditVector);
  const auditEvent = traceEventContract.parse(auditVector!.input);
  assert.equal(auditEvent.parentEventId, enforceEvent.id);
});

test("TraceEvent: canonical string is deterministic", () => {
  const event: TraceEvent = {
    id: "te_1",
    timestamp: "2026-06-27T10:00:00.000Z",
    stage: "detect",
    actor: "Agent",
    event: "case-detected",
    payload: { b: 2, a: 1 },
  };
  const canonical = traceEventContract.canonical(event);
  const str1 = stableStringify(canonical);
  const str2 = stableStringify(canonical);
  assert.equal(str1, str2);
  // Verify the string is valid JSON
  assert.doesNotThrow(() => JSON.parse(str1));
});
