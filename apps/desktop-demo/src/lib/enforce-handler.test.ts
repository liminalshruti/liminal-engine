/**
 * enforce-handler tests (LIM-1169) — the desktop-demo composition root for the
 * operator's Approve + Enforce action. Proves the app handler, wired over its own
 * boundary-safe in-memory adapters, runs the real governance use case and
 * reproduces the locked Acme fixtures — deterministically (no live calls).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { isAllowed } from "@liminal-engine/contracts";
import {
  runApproveAndEnforce,
  PRE_ENFORCE_STATUS,
  GATED_CUSTOMER_ACTION,
} from "./enforce-handler.ts";

test("enforce-handler: the deal starts as the false green (on-track) before the operator acts", () => {
  assert.equal(PRE_ENFORCE_STATUS, "on-track");
});

test("LIM-1169 AC#1 (app): runApproveAndEnforce flips status on-track → at-risk and reproduces the Acme enforcement + audit", async () => {
  const result = await runApproveAndEnforce();

  assert.equal(result.status, "at-risk");
  assert.equal(result.enforcement.fromStatus, "on-track");
  assert.equal(result.enforcement.toStatus, "at-risk");
  assert.deepEqual(result.enforcement, acmeScenario.enforcementAction);
  assert.deepEqual(result.audit, acmeScenario.auditEvent);
});

test("LIM-1169 AC#2 (app): runApproveAndEnforce opens the action-gate state for the customer-facing update", async () => {
  const result = await runApproveAndEnforce();

  assert.equal(result.gate.action, GATED_CUSTOMER_ACTION);
  assert.equal(isAllowed(result.gate), false);
  assert.ok(result.gate.reasons.length > 0);
  assert.deepEqual(result.gate, acmeScenario.blockedAction);
});

test("enforce-handler is deterministic — re-running reproduces identical state (no live-call flakiness on the spine)", async () => {
  const a = await runApproveAndEnforce();
  const b = await runApproveAndEnforce();
  assert.deepEqual(a, b);
});
