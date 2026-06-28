/**
 * approveAndEnforce tests (LIM-1169) — the operator's Approve + Enforce handler.
 * Maps to the two acceptance criteria and the DEMO_CONTRACT must-not-cut items.
 * Uses the in-memory fixture adapters (tests are exempt from the boundary lint)
 * and the deterministic Acme Clock/IdGen, advanced past the detect phase exactly
 * the way the loop consumes them, so the handler reproduces the locked Acme
 * fixtures byte-for-byte.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { isAllowed } from "@liminal-engine/contracts";
import { InMemoryAuditSink } from "@liminal-engine/integration-audit-sink";
import { InMemoryActionGateStore } from "@liminal-engine/integration-action-gate-store";
import {
  createAcmeClock,
  createAcmeIdGen,
} from "@liminal-engine/integration-fixture-determinism";
import { approveAndEnforce } from "./approve-enforce.ts";
import { GATED_CUSTOMER_ACTION } from "./use-cases.ts";

const DEAL = "deal_acme";

/** Fresh deps with the determinism advanced past the detect phase (gc id + 10:00). */
function enforceDeps() {
  const idGen = createAcmeIdGen();
  idGen.next(); // consume gc_acme_eu (would have come from detectMiss)
  const clock = createAcmeClock();
  clock.now(); // consume detectedAt (10:00)
  return {
    auditSink: new InMemoryAuditSink(),
    actionGateStore: new InMemoryActionGateStore(),
    clock,
    idGen,
  };
}

test("LIM-1169 AC#1: approveAndEnforce triggers enforcement — flips on-track → at-risk + records audit (MNC#3,#6)", async () => {
  const deps = enforceDeps();

  const result = await approveAndEnforce(
    {
      caseId: acmeScenario.governanceCase.id,
      dealId: DEAL,
      currentStatus: "on-track",
      gatedAction: GATED_CUSTOMER_ACTION,
    },
    deps,
  );

  // the status visibly flips on the operator action (must-not-cut #3)
  assert.equal(result.status, "at-risk");
  assert.equal(result.enforcement.fromStatus, "on-track");
  assert.equal(result.enforcement.toStatus, "at-risk");
  assert.deepEqual(result.enforcement, acmeScenario.enforcementAction);

  // audit recorded with the deciding ROLE, never an invented persona name (MNC#6)
  assert.deepEqual(result.audit, acmeScenario.auditEvent);
  assert.match(result.audit.decidingActor, /VP|Head|operator|\//i);
  assert.deepEqual(await deps.auditSink.all(), [acmeScenario.auditEvent]);
});

test("LIM-1169 AC#2: approveAndEnforce opens the action-gate state for the downstream blocked action (MNC#5)", async () => {
  const deps = enforceDeps();

  const result = await approveAndEnforce(
    {
      caseId: acmeScenario.governanceCase.id,
      dealId: DEAL,
      currentStatus: "on-track",
      gatedAction: GATED_CUSTOMER_ACTION,
    },
    deps,
  );

  // the gate is OPENED (not allowed) for the customer-facing update (must-not-cut #5)
  assert.equal(result.gate.action, GATED_CUSTOMER_ACTION);
  assert.equal(isAllowed(result.gate), false);
  assert.ok(result.gate.reasons.length > 0, "an opened gate carries at least one reason");
  assert.ok(result.gate.requiredBeforeSend.length > 0, "an opened gate lists what to fix before send");
  assert.deepEqual(result.gate, acmeScenario.blockedAction);

  // the opened gate state is persisted + queryable from the store (deny verdict)
  const decision = await deps.actionGateStore.decisionFor(GATED_CUSTOMER_ACTION);
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.length > 0);
  assert.equal((await deps.actionGateStore.decisionFor("Some unrelated action")).allowed, true);
});

test("LIM-1169: enforce + gate happen together — one operator action yields both effects", async () => {
  const deps = enforceDeps();

  const result = await approveAndEnforce(
    {
      caseId: acmeScenario.governanceCase.id,
      dealId: DEAL,
      currentStatus: "on-track",
      gatedAction: GATED_CUSTOMER_ACTION,
    },
    deps,
  );

  // both the enforcement audit and the opened gate are present after the one call
  assert.deepEqual(await deps.auditSink.all(), [acmeScenario.auditEvent]);
  assert.equal((await deps.actionGateStore.decisionFor(GATED_CUSTOMER_ACTION)).allowed, false);
  assert.equal(result.enforcement.caseId, result.gate.caseId);
});

test("LIM-1169: approveAndEnforce refuses when the deal is not on-track (nothing to enforce)", async () => {
  await assert.rejects(
    () =>
      approveAndEnforce(
        {
          caseId: acmeScenario.governanceCase.id,
          dealId: DEAL,
          currentStatus: "at-risk",
          gatedAction: GATED_CUSTOMER_ACTION,
        },
        {
          auditSink: new InMemoryAuditSink(),
          actionGateStore: new InMemoryActionGateStore(),
          clock: createAcmeClock(),
          idGen: createAcmeIdGen(),
        },
      ),
    /at-risk/,
  );
});
