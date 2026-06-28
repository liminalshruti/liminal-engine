/**
 * Eval-harness tests — runEvals returns the deterministic Fail → Pass table.
 * [DEMO_CONTRACT must-not-cut #7]. Tests may import the in-memory adapter.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { InMemoryEvalStore } from "@liminal-engine/integration-eval-store";
import { runEvals, toRows } from "./index.ts";

const DEAL = "deal_acme";

test("must-not-cut #7: runEvals returns Fail (pass 1) -> Pass (pass 2) for the EU-residency criterion", async () => {
  const store = new InMemoryEvalStore();
  // record out of order to prove runEvals sorts deterministically
  await store.record(acmeScenario.evalPass2);
  await store.record(acmeScenario.evalPass1);

  const table = await runEvals(store, DEAL);

  assert.equal(table.length, 2);
  assert.deepEqual(table[0], acmeScenario.evalPass1);
  assert.deepEqual(table[1], acmeScenario.evalPass2);
  assert.equal(table[0]!.result, "fail");
  assert.equal(table[1]!.result, "pass");
  assert.equal(table[0]!.criterion, table[1]!.criterion); // same criterion graded twice
});

test("runEvals returns empty for an unknown deal", async () => {
  const store = new InMemoryEvalStore();
  await store.record(acmeScenario.evalPass1);
  assert.deepEqual(await runEvals(store, "deal_unknown"), []);
});

test("toRows renders the Fail -> Pass table for display", () => {
  const rows = toRows([acmeScenario.evalPass2, acmeScenario.evalPass1]);
  assert.deepEqual(rows, [
    { pass: 1, criterion: "EU data residency requirement honored", result: "fail" },
    { pass: 2, criterion: "EU data residency requirement honored", result: "pass" },
  ]);
});
