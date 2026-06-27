import { test } from "node:test";
import assert from "node:assert/strict";
import { enforceCorrection, nextPhase, GOVERNANCE_LOOP } from "./deal-status.ts";

test("enforceCorrection flips on-track -> at-risk (the locked status flip)", () => {
  const r = enforceCorrection("on-track");
  assert.ok(r.ok);
  assert.equal(r.value, "at-risk");
});

test("enforceCorrection is a no-op error when already at-risk", () => {
  const r = enforceCorrection("at-risk");
  assert.equal(r.ok, false);
});

test("governance loop is the locked 6-phase sequence", () => {
  assert.deepEqual([...GOVERNANCE_LOOP], [
    "observe", "detect", "correct", "enforce", "audit", "improve",
  ]);
});

test("nextPhase walks the loop and ends after improve", () => {
  assert.equal(nextPhase("observe"), "detect");
  assert.equal(nextPhase("audit"), "improve");
  assert.equal(nextPhase("improve"), null);
});
