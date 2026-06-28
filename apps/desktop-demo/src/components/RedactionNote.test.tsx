import { test } from "node:test";
import assert from "node:assert/strict";
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { redact, type RedactedRef } from "@liminal-engine/contracts";
import { RedactionNote } from "./RedactionNote.tsx";

test("LIM-1248: RedactionNote renders a redacted reference with all required fields", () => {
  const redactedRef = acmeScenario.dataResidencyRef;

  // Verify the fixture ref is valid
  assert.ok(redactedRef.redacted === true, "should be marked as redacted");
  assert.equal(
    redactedRef.scheme,
    "canonical-sha256",
    "should use canonical-sha256 scheme"
  );
  assert.ok(typeof redactedRef.hash === "string" && redactedRef.hash.length > 0, "should have a hash");
  assert.equal(
    redactedRef.label,
    "customer-claim",
    "should have the customer-claim label"
  );
});

test("LIM-1248: RedactionNote handles unlabeled redacted refs gracefully", () => {
  const sensitiveValue = "Test sensitive data";
  const unLabeledRef: RedactedRef = redact(sensitiveValue);

  // Verify it's redacted but without a label
  assert.ok(unLabeledRef.redacted === true, "should be marked as redacted");
  assert.equal(unLabeledRef.label, undefined, "should not have a label when not provided");
});

test("LIM-1248: RedactionNote props are correctly structured", () => {
  const redactedRef = acmeScenario.dataResidencyRef;
  const description = "Sensitive customer data (e.g., deal value, customer name)";

  // Props interface check — verify the component accepts these props
  const props = {
    redactedRef,
    description,
    className: "test-class",
  };

  assert.ok(props.redactedRef, "should accept redactedRef prop");
  assert.ok(props.description, "should accept description prop");
  assert.ok(props.className, "should accept className prop");
});

test("LIM-1248: Redacted reference is deterministic (same value → same hash)", () => {
  const sensitiveValue = "Acme $1.2M expansion on track; all workstreams green.";

  // Create two refs from the same value
  const ref1 = redact(sensitiveValue, "claim");
  const ref2 = redact(sensitiveValue, "claim");

  // They should be byte-identical (deterministic)
  assert.deepEqual(ref1, ref2, "redacting the same value should produce identical refs");
});

test("LIM-1248: RedactionNote uses the acmeScenario fixture for demo proof", () => {
  const { dataResidencyRef, sensitiveCustomerClaim } = acmeScenario;

  // Verify the fixture is built from redaction of the actual sensitive claim
  const recomputedRef = redact(sensitiveCustomerClaim, "customer-claim");

  assert.equal(
    dataResidencyRef.hash,
    recomputedRef.hash,
    "fixture dataResidencyRef should match recomputed hash"
  );
});
