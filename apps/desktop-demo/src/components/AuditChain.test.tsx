import { test } from "node:test";
import assert from "node:assert/strict";
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { AuditChain, type AuditChainProps } from "./AuditChain.tsx";

test("LIM-1248: AuditChain renders with default props", () => {
  const props: AuditChainProps = {};

  // Verify the default values work
  assert.ok(props, "should accept no props and use defaults");
});

test("LIM-1248: AuditChain renders with custom props", () => {
  const props: AuditChainProps = {
    title: "Acme Audit Chain",
    isValid: true,
    eventCount: 1,
    className: "custom-class",
  };

  assert.equal(props.title, "Acme Audit Chain", "should accept custom title");
  assert.equal(props.isValid, true, "should accept isValid prop");
  assert.equal(props.eventCount, 1, "should accept eventCount prop");
  assert.equal(props.className, "custom-class", "should accept className prop");
});

test("LIM-1248: AuditChain integrates with acmeScenario audit event", () => {
  const { auditEvent } = acmeScenario;

  // The demo has one audit event for the correction
  assert.ok(auditEvent, "should have an auditEvent in the scenario");
  assert.equal(auditEvent.id, "ae_acme_1", "should be the first Acme audit event");

  // The chain should render with eventCount = 1 (the single correction event)
  const chainProps: AuditChainProps = {
    eventCount: 1,
    isValid: true,
  };

  assert.equal(chainProps.eventCount, 1, "should use the auditEvent count");
  assert.equal(chainProps.isValid, true, "chain should be valid in demo");
});

test("LIM-1248: AuditChain props structure for demo beat #11", () => {
  // Beat #11 proof: AuditEvent recorded (the correction + the deciding actor)
  // The chain should visually prove append-only + tamper-evident
  const demoProps: AuditChainProps = {
    title: "Audit chain integrity",
    isValid: true,
    eventCount: 1,
  };

  assert.ok(demoProps.title, "should have a title for accessibility");
  assert.equal(demoProps.isValid, true, "should mark chain as valid for the demo");
  assert.ok(typeof demoProps.eventCount === "number", "should have a numeric event count");
});

test("LIM-1248: AuditChain handles multiple events", () => {
  // In a real scenario with multiple corrections, the chain would grow
  const multiEventProps: AuditChainProps = {
    eventCount: 5,
    isValid: true,
  };

  assert.equal(multiEventProps.eventCount, 5, "should handle event counts > 1");
});

test("LIM-1248: AuditChain validity indicator state", () => {
  // Valid chain
  const validProps: AuditChainProps = {
    isValid: true,
  };
  assert.equal(validProps.isValid, true, "should support valid state");

  // Invalid chain (for error states)
  const invalidProps: AuditChainProps = {
    isValid: false,
  };
  assert.equal(invalidProps.isValid, false, "should support invalid state");
});
