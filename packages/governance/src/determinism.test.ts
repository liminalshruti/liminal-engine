/**
 * Determinism guarantee (LIM-1241) — the spine must produce byte-identical artifacts
 * on every run, so the live demo can't flake on stage (DEMO_CONTRACT acceptance:
 * "Deterministic: re-running produces the same result").
 *
 * Strategy: run the FULL governance loop twice from clean state, each with its own
 * fresh in-memory stores + fresh injected Clock/IdGen, then assert the produced
 * GovernanceCase / EnforcementAction(AuditEvent) / ActionGate / EvalCase / EvalResult
 * are identical across both runs — by canonical hash (the same hash the contract
 * golden tests use), which is the strongest equality: stable across key order and
 * byte-exact. If anything non-deterministic ever leaks in (Date.now, Math.random,
 * unstable iteration), the two hashes diverge and this fails.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalHash } from "@liminal-engine/contracts";
import { FixtureAgentOutputSource } from "@liminal-engine/integration-gemini";
import { InMemoryGovernanceCaseStore } from "@liminal-engine/integration-governance-case-store";
import { InMemoryAuditSink } from "@liminal-engine/integration-audit-sink";
import { InMemoryActionGateStore } from "@liminal-engine/integration-action-gate-store";
import { InMemoryEvalStore } from "@liminal-engine/integration-eval-store";
import { createAcmeClock, createAcmeIdGen } from "@liminal-engine/integration-fixture-determinism";
import { runGovernanceLoop, evaluateDownstreamAction, GATED_CUSTOMER_ACTION } from "./use-cases.ts";

const DEAL = "deal_acme";

/** One full loop run from clean state — returns every demo-visible artifact. */
async function runOnce() {
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
  const gateDecision = await evaluateDownstreamAction(deps.actionGateStore, GATED_CUSTOMER_ACTION);
  return {
    governanceCases: await deps.caseStore.byDeal(DEAL),
    auditEvents: await deps.auditSink.all(),
    gateDecision, // ActionGateDecision (v2): { allowed, reasons[], requiredBeforeSend[] }
    evalCase,
    evals,
  };
}

test("determinism: two full loop runs produce byte-identical artifacts (canonical hash)", async () => {
  const a = await runOnce();
  const b = await runOnce();

  // Whole-result canonical hash: the single strongest assertion. Any drift anywhere
  // (ids, timestamps, ordering) changes the hash.
  assert.equal(
    canonicalHash(a),
    canonicalHash(b),
    "the governance loop is non-deterministic — two clean runs produced different artifacts",
  );
});

test("determinism: each demo artifact is individually identical across runs", async () => {
  const a = await runOnce();
  const b = await runOnce();

  // Per-artifact hashes pinpoint WHICH artifact drifted if the whole-result test fails.
  assert.equal(canonicalHash(a.governanceCases), canonicalHash(b.governanceCases), "GovernanceCase drift");
  assert.equal(canonicalHash(a.auditEvents), canonicalHash(b.auditEvents), "AuditEvent drift");
  assert.equal(canonicalHash(a.gateDecision), canonicalHash(b.gateDecision), "ActionGate decision drift");
  assert.equal(canonicalHash(a.evalCase), canonicalHash(b.evalCase), "EvalCase drift");
  assert.equal(canonicalHash(a.evals), canonicalHash(b.evals), "EvalResult drift");
});

test("determinism: the run reproduces the locked Acme fixtures (no drift from the spec)", async () => {
  // Not just "stable run-to-run" but "stable to the LOCKED demo data" — ties determinism
  // to DEMO_CONTRACT, so a run that's self-consistent but wrong still fails.
  const run = await runOnce();
  // Fail (pass 1) -> Pass (pass 2) is the must-not-cut #7 proof; lock the result sequence.
  assert.deepEqual(run.evals.map((e) => e.result), ["fail", "pass"]);
  assert.equal(run.gateDecision.allowed, false); // the customer update stays gated (MNC#5)
});
