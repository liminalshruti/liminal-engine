import { test } from "node:test";
import assert from "node:assert/strict";
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import { toRows } from "@liminal-engine/eval-harness";
import { toBeforeAfterCheckRows } from "./SecondPassEval.model.ts";

test("second-pass before/after rows render each eval check as Fail -> Pass", () => {
  const rows = toBeforeAfterCheckRows(toRows([acmeScenario.evalPass2, acmeScenario.evalPass1]));

  assert.deepEqual(rows, [
    {
      criterion: "EU data residency requirement honored",
      before: { pass: 1, criterion: "EU data residency requirement honored", result: "fail" },
      after: { pass: 2, criterion: "EU data residency requirement honored", result: "pass" },
    },
  ]);
});

test("second-pass before/after rows stay deterministic across multiple checks", () => {
  const rows = toBeforeAfterCheckRows([
    { pass: 2, criterion: "Z check", result: "pass" },
    { pass: 1, criterion: "Z check", result: "fail" },
    { pass: 2, criterion: "A check", result: "pass" },
    { pass: 1, criterion: "A check", result: "fail" },
  ]);

  assert.deepEqual(rows.map((row) => row.criterion), ["A check", "Z check"]);
  assert.deepEqual(
    rows.map((row) => `${row.before.result}->${row.after.result}`),
    ["fail->pass", "fail->pass"],
  );
});
