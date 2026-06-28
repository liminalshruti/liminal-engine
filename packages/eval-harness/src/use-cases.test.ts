/**
 * Eval-harness tests — runEvals returns the deterministic Fail → Pass table.
 * [DEMO_CONTRACT must-not-cut #7]. Tests may import the in-memory adapter.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { InMemoryEvalStore } from "@liminal-engine/integration-eval-store";
import {
  generateEvalCaseFromGovernanceCase,
  gradeRequirementCoverage,
  runEvals,
  summarizeEvalTable,
  toRows,
} from "./index.ts";

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

test("generateEvalCaseFromGovernanceCase creates contract-valid eval cases from arbitrary cases", () => {
  const evalCase = generateEvalCaseFromGovernanceCase(
    {
      id: "gc_soc2",
      dealId: "deal_payments",
      missedRequirement: "SOC 2 Type II evidence",
      category: "security",
      severity: "blocking",
      status: "open",
      detectedAt: "2026-06-27T10:00:00.000Z",
    },
    {
      clock: { now: () => "2026-06-27T10:01:00.000Z" },
      idGen: { next: () => "ec_soc2" },
    },
  );

  assert.deepEqual(evalCase, {
    id: "ec_soc2",
    dealId: "deal_payments",
    governanceCaseId: "gc_soc2",
    criterion: "SOC 2 Type II evidence requirement honored",
    createdAt: "2026-06-27T10:01:00.000Z",
  });
});

test("gradeRequirementCoverage grades arbitrary outputs with real text coverage logic", () => {
  const evalCase = {
    id: "ec_soc2",
    dealId: "deal_payments",
    governanceCaseId: "gc_soc2",
    criterion: "SOC 2 Type II evidence requirement honored",
    createdAt: "2026-06-27T10:01:00.000Z",
  };
  const results = gradeRequirementCoverage(
    evalCase,
    [
      {
        id: "ao_payments_p1",
        dealId: "deal_payments",
        dealName: "Enterprise payments",
        passNumber: 1,
        reportedStatus: "on-track",
        summary: "Enterprise payments launch is on track.",
        droppedRequirements: ["SOC 2 Type II evidence"],
      },
      {
        id: "ao_payments_p2",
        dealId: "deal_payments",
        dealName: "Enterprise payments",
        passNumber: 2,
        reportedStatus: "at-risk",
        summary: "Enterprise payments is at-risk until SOC 2 Type II evidence is attached.",
        droppedRequirements: [],
      },
    ],
    "SOC 2 Type II evidence",
    (output) => `ev_soc2_p${output.passNumber}`,
  );

  assert.deepEqual(results.map((result) => result.result), ["fail", "pass"]);
  assert.deepEqual(summarizeEvalTable(results), {
    total: 2,
    pass: 1,
    fail: 1,
    improved: true,
  });
});
