import { test } from "node:test";
import assert from "node:assert/strict";
import { assessGoalAlignment } from "./assess-alignment.ts";

/**
 * The executive wow: given a goal with a resourced budget, AI spend accrued, and a
 * lost-context detection, decide whether the AI spend is actually moving the goal —
 * "$X spent, N outputs produced, but a gating requirement was lost and the goal
 * hasn't moved" = misaligned (AI-ROI risk).
 */
test("flags AI-ROI risk: spend accrued + work produced, but a requirement was lost", () => {
  const assessment = assessGoalAlignment({
    goal: {
      title: "Increase enterprise pilot conversion by 20% this quarter",
      budgetUsd: 50_000,
      metric: "enterprise pilots converted",
    },
    spendUsd: 18_400,
    outputsProduced: 4,
    lostRequirements: ["EU data residency"],
  });

  assert.equal(assessment.aligned, false);
  assert.equal(assessment.spendUsd, 18_400);
  assert.equal(assessment.budgetUtilization, 18_400 / 50_000);
  assert.match(assessment.summary, /spend/i);
  assert.match(assessment.summary, /EU data residency/);
});

test("aligned when spend produced work AND nothing was lost", () => {
  const assessment = assessGoalAlignment({
    goal: { title: "Goal", budgetUsd: 10_000, metric: "x" },
    spendUsd: 2_000,
    outputsProduced: 3,
    lostRequirements: [],
  });

  assert.equal(assessment.aligned, true);
  assert.equal(assessment.budgetUtilization, 0.2);
});
