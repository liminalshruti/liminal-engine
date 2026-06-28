import { test } from "node:test";
import assert from "node:assert/strict";
import { governanceCaseContract } from "@liminal-engine/contracts";
import { caseEvidenceFromAlignment } from "./case-from-alignment.ts";

/**
 * The end-to-end wow: the alignment verdict ("$X AI spend, goal not advanced")
 * becomes the GovernanceCase the operator sees — businessImpact carries the
 * spend-vs-goal risk, not just "a requirement was missed".
 */
test("a misaligned assessment produces case evidence stating the AI-spend risk", () => {
  const evidence = caseEvidenceFromAlignment({
    aligned: false,
    spendUsd: 18_400,
    budgetUtilization: 0.368,
    outputsProduced: 4,
    lostRequirements: ["EU data residency"],
    summary:
      "$18,400 of AI spend produced 4 outputs, but 1 gating requirement(s) were lost (EU data residency) — the goal is not being advanced.",
  });

  assert.ok(evidence, "a misaligned assessment yields evidence");
  // businessImpact carries the spend-vs-goal framing
  assert.match(evidence.businessImpact, /\$18,400/);
  assert.match(evidence.businessImpact, /not being advanced/);
  // the lost requirement flows into missingFrom for the case
  assert.deepEqual(evidence.missingFrom, ["EU data residency"]);

  // and it validates as GovernanceCase evidence fields (no contract drift)
  const caseObj = governanceCaseContract.parse({
    id: "gc_x",
    dealId: "deal_x",
    missedRequirement: "EU data residency",
    category: "ai-roi-goal-alignment",
    severity: "blocking",
    status: "open",
    detectedAt: "2026-06-28T10:00:00.000Z",
    businessImpact: evidence.businessImpact,
    missingFrom: evidence.missingFrom,
  });
  assert.equal(caseObj.businessImpact, evidence.businessImpact);
});

test("an aligned assessment produces no risk evidence (nothing to surface)", () => {
  const evidence = caseEvidenceFromAlignment({
    aligned: true,
    spendUsd: 2_000,
    budgetUtilization: 0.2,
    outputsProduced: 3,
    lostRequirements: [],
    summary: "$2,000 of AI spend produced 3 outputs aligned to the goal.",
  });
  assert.equal(evidence, null);
});
