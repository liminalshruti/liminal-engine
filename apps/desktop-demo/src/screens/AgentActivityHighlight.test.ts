import { test } from "node:test";
import assert from "node:assert/strict";
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import {
  droppedRequirementForHighlight,
  sourceCallRequirementLine,
  splitInlineHighlight,
} from "./AgentActivityHighlight.ts";

test("LIM-1236: highlight requirement is derived from the Acme output and GovernanceCase", () => {
  const requirement = droppedRequirementForHighlight(
    acmeScenario.agentOutputPass1,
    acmeScenario.governanceCase,
  );

  assert.equal(requirement, acmeScenario.demoBeats.droppedRequirement);
});

test("LIM-1236: source-call highlighting preserves the exact requirement span", () => {
  const requirement = droppedRequirementForHighlight(
    acmeScenario.agentOutputPass1,
    acmeScenario.governanceCase,
  );
  const sourceLine = sourceCallRequirementLine(
    acmeScenario.agentOutputPass1.dealName,
    requirement,
  );

  assert.deepEqual(splitInlineHighlight(sourceLine, requirement), [
    {
      text: "Acme expansion customer call: preserve ",
      highlight: false,
    },
    {
      text: "EU data residency",
      highlight: true,
    },
    {
      text: " before expansion approval.",
      highlight: false,
    },
  ]);
});

test("LIM-1236: source-call line is built from fixture deal + requirement data", () => {
  const requirement = droppedRequirementForHighlight(
    acmeScenario.agentOutputPass1,
    acmeScenario.governanceCase,
  );

  assert.equal(
    sourceCallRequirementLine(acmeScenario.agentOutputPass1.dealName, requirement),
    "Acme expansion customer call: preserve EU data residency before expansion approval.",
  );
});

test("LIM-1236: mismatched case/output data fails closed instead of hiding the dropped requirement", () => {
  assert.throws(
    () =>
      droppedRequirementForHighlight(acmeScenario.agentOutputPass2, acmeScenario.governanceCase),
    /must match a dropped requirement/,
  );
});
