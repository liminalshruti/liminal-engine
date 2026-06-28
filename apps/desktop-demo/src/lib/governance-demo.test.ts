/**
 * Proves the demo's single-source-of-truth: running the REAL governance loop
 * yields the locked Acme fixture values. If the engine and the fixtures ever
 * diverge, this fails — so the UI (which renders this output) cannot silently
 * drift from the loop. [LIM-1245]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { buildGovernanceDemo } from "./governance-demo.ts";

test("the live loop reproduces the locked Acme artifacts (UI == engine)", async () => {
  const demo = await buildGovernanceDemo();

  // beat 5 — detection
  assert.deepEqual(demo.governanceCase, acmeScenario.governanceCase);
  // beat 7 — the status flip the loop enforced
  assert.equal(demo.statusFlip.from, "on-track");
  assert.equal(demo.statusFlip.to, "at-risk");
  assert.match(demo.statusFlip.actor, /VP|Head|operator|\//i);
  // beat 9 — required owners
  assert.deepEqual([...demo.requiredOwners], ["Product", "Security", "Engineering"]);
  // beat 10 — the live gate verdict denies the customer update
  assert.equal(demo.gateDecision.allowed, false);
  assert.ok(demo.gateDecision.reasons.length > 0);
  assert.ok(demo.gateDecision.requiredBeforeSend.length > 0);
  // beat 11 — audit evidence
  assert.deepEqual(demo.auditEvent, acmeScenario.auditEvent);
  // beat 12/14 — eval case + Fail → Pass
  assert.deepEqual(demo.evalCase, acmeScenario.evalCase);
  assert.deepEqual([...demo.evalResults], [acmeScenario.evalPass1, acmeScenario.evalPass2]);
  assert.deepEqual(demo.evalRows, [
    { pass: 1, criterion: "EU data residency requirement honored", result: "fail" },
    { pass: 2, criterion: "EU data residency requirement honored", result: "pass" },
  ]);
});

test("the demo is deterministic — two runs are identical", async () => {
  const a = await buildGovernanceDemo();
  const b = await buildGovernanceDemo();
  assert.deepEqual(a, b);
});
