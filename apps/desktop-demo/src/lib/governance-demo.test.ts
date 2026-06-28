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
  // beat 7 — the full EnforcementAction the loop applied (On Track → At Risk)
  assert.deepEqual(demo.enforcementAction, acmeScenario.enforcementAction);
  assert.equal(demo.enforcementAction.fromStatus, "on-track");
  assert.equal(demo.enforcementAction.toStatus, "at-risk");
  // beat 8/9 — the Linear workstream payload + required owners (sourced from fixtures)
  assert.deepEqual(demo.linearWorkstreamPayload, acmeScenario.linearWorkstreamPayload);
  assert.deepEqual(
    [...demo.requiredOwners],
    [...acmeScenario.linearWorkstreamPayload.requiredOwners],
  );
  // beat 10 — the full gate the loop produced + its live fail-closed decision
  assert.deepEqual(demo.gate, acmeScenario.blockedAction);
  assert.equal(demo.gateDecision.allowed, false);
  assert.deepEqual([...demo.gateDecision.reasons], [...demo.gate.reasons]);
  assert.deepEqual(
    [...demo.gateDecision.requiredBeforeSend],
    [...demo.gate.requiredBeforeSend],
  );
  // beat 11 — audit evidence
  assert.deepEqual(demo.auditEvent, acmeScenario.auditEvent);
  // beat 11 — data-residency redacted ref is produced LIVE via the real redact()
  // helper, byte-identical to the locked fixture (no raw fixture read on screen)
  assert.deepEqual(demo.dataResidencyRef, acmeScenario.dataResidencyRef);
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
