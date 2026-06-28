/**
 * Governance use-case tests. Each maps to a DEMO_CONTRACT must-not-cut item and
 * asserts the loop reproduces the locked Acme fixtures exactly. Tests are exempt
 * from the boundary lint, so they may import the in-memory adapters.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { FixtureAgentOutputSource } from "@liminal-engine/integration-gemini";
import { InMemoryGovernanceCaseStore } from "@liminal-engine/integration-governance-case-store";
import { InMemoryAuditSink } from "@liminal-engine/integration-audit-sink";
import { InMemoryActionGateStore } from "@liminal-engine/integration-action-gate-store";
import { InMemoryEvalStore } from "@liminal-engine/integration-eval-store";
import {
  createAcmeClock,
  createAcmeIdGen,
} from "@liminal-engine/integration-fixture-determinism";
import {
  detectMiss,
  enforceCorrection,
  gateDownstreamAction,
  runGovernanceLoop,
  GATED_CUSTOMER_ACTION,
} from "./use-cases.ts";

const DEAL = "deal_acme";

test("must-not-cut #2: detectMiss surfaces the dropped EU requirement as a blocking GovernanceCase", async () => {
  const source = new FixtureAgentOutputSource();
  const caseStore = new InMemoryGovernanceCaseStore();
  const gc = await detectMiss(source, caseStore, DEAL, 1, createAcmeClock(), createAcmeIdGen());

  assert.ok(gc, "a case should be detected on the false-green pass");
  assert.equal(gc.missedRequirement, "EU data residency");
  assert.equal(gc.severity, "blocking");
  assert.equal(gc.status, "open");
  assert.deepEqual(gc, acmeScenario.governanceCase);
  // persisted to the store
  assert.deepEqual(await caseStore.byDeal(DEAL), [acmeScenario.governanceCase]);
});

test("detectMiss returns null when nothing was dropped (corrected pass 2)", async () => {
  const source = new FixtureAgentOutputSource();
  const caseStore = new InMemoryGovernanceCaseStore();
  const gc = await detectMiss(source, caseStore, DEAL, 2, createAcmeClock(), createAcmeIdGen());
  assert.equal(gc, null);
});

test("must-not-cut #3 + #6: enforceCorrection flips on-track->at-risk and records an AuditEvent", async () => {
  const auditSink = new InMemoryAuditSink();
  // idGen first yields the case id; advance it the way the loop would, then enforce.
  const idGen = createAcmeIdGen();
  idGen.next(); // consume gc_acme_eu (would come from detectMiss)
  const clock = createAcmeClock();
  clock.now(); // consume detectedAt

  const { action, audit } = await enforceCorrection(
    acmeScenario.governanceCase.id,
    DEAL,
    "on-track",
    { auditSink, clock, idGen },
  );

  assert.equal(action.fromStatus, "on-track");
  assert.equal(action.toStatus, "at-risk");
  assert.deepEqual(action, acmeScenario.enforcementAction);
  assert.deepEqual(audit, acmeScenario.auditEvent);
  // audit is the deciding role, never an invented persona name
  assert.match(audit.decidingActor, /VP|Head|operator|\//i);
  assert.deepEqual(await auditSink.all(), [acmeScenario.auditEvent]);
});

test("enforceCorrection is a no-op error when the deal is already at-risk", async () => {
  const auditSink = new InMemoryAuditSink();
  await assert.rejects(
    () =>
      enforceCorrection("c", DEAL, "at-risk", {
        auditSink,
        clock: createAcmeClock(),
        idGen: createAcmeIdGen(),
      }),
    /already at-risk/,
  );
});

test("must-not-cut #5: gateDownstreamAction blocks the customer update until corrected", async () => {
  const store = new InMemoryActionGateStore();
  const idGen = createAcmeIdGen();
  // advance to the gate id slot (gc, ea, ae already consumed in the real loop)
  idGen.next(); idGen.next(); idGen.next();

  const gate = await gateDownstreamAction(store, GATED_CUSTOMER_ACTION, acmeScenario.governanceCase.id, idGen);

  assert.equal(gate.blocked, true);
  assert.equal(gate.unblockedByCaseCorrection, true);
  assert.deepEqual(gate, acmeScenario.blockedAction);
  assert.equal(await store.isBlocked(GATED_CUSTOMER_ACTION), true);
  assert.equal(await store.isBlocked("some other action"), false);
});

test("must-not-cut #7: runGovernanceLoop drives detect->enforce->audit->gate->eval and proves Fail->Pass", async () => {
  const deps = {
    source: new FixtureAgentOutputSource(),
    caseStore: new InMemoryGovernanceCaseStore(),
    auditSink: new InMemoryAuditSink(),
    actionGateStore: new InMemoryActionGateStore(),
    evalStore: new InMemoryEvalStore(),
    clock: createAcmeClock(),
    idGen: createAcmeIdGen(),
  };

  const { evalCase, evals } = await runGovernanceLoop(deps, DEAL);

  // the EvalCase ties back to the governance case and matches the fixture
  assert.deepEqual(evalCase, acmeScenario.evalCase);

  // Fail (pass 1) -> Pass (pass 2)
  assert.equal(evals.length, 2);
  assert.deepEqual(evals[0], acmeScenario.evalPass1);
  assert.deepEqual(evals[1], acmeScenario.evalPass2);
  assert.equal(evals[0]!.result, "fail");
  assert.equal(evals[1]!.result, "pass");

  // side effects landed in their stores
  assert.deepEqual(await deps.caseStore.byDeal(DEAL), [acmeScenario.governanceCase]);
  assert.deepEqual(await deps.auditSink.all(), [acmeScenario.auditEvent]);
  assert.equal(await deps.actionGateStore.isBlocked(GATED_CUSTOMER_ACTION), true);
  assert.deepEqual(await deps.evalStore.byDeal(DEAL), [acmeScenario.evalPass1, acmeScenario.evalPass2]);
});
