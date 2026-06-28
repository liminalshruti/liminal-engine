import { test } from "node:test";
import assert from "node:assert/strict";
import { acmeScenario } from "@liminal-engine/contracts/fixtures";
import type { AgentActivityTraceInput } from "./AgentActivityTrace.ts";
import {
  buildAgentActivityTrace,
  droppedRequirementForTrace,
} from "./AgentActivityTrace.ts";

const input: AgentActivityTraceInput = {
  businessGoal: acmeScenario.businessGoal,
  agentOutputPass1: acmeScenario.agentOutputPass1,
  governanceCase: acmeScenario.governanceCase,
  linearWorkstreamPayload: acmeScenario.linearWorkstreamPayload,
};

test("LIM-1239: trace cards are derived per required agent role", () => {
  const trace = buildAgentActivityTrace(input);

  assert.deepEqual(
    trace.cards.map((card) => card.agentRole),
    acmeScenario.linearWorkstreamPayload.requiredOwners.map((owner) => `${owner} agent`),
  );
});

test("LIM-1239: each trace card shows the artifacts used by that agent", () => {
  const trace = buildAgentActivityTrace(input);

  for (const card of trace.cards) {
    assert.ok(
      card.artifacts.some((artifact) => artifact.value === acmeScenario.businessGoal),
      `${card.agentRole} should include the Acme business-goal artifact`,
    );
  }

  const artifactValues = trace.cards.flatMap((card) =>
    card.artifacts.map((artifact) => artifact.value),
  );
  for (const workstream of acmeScenario.linearWorkstreamPayload.workstreams) {
    assert.ok(
      artifactValues.includes(workstream.title),
      `${workstream.title} should appear as a used artifact`,
    );
  }
});

test("LIM-1239: missing-requirement evidence line proves present-but-dropped", () => {
  const trace = buildAgentActivityTrace(input);
  const evidenceLine = trace.missingRequirementEvidenceLine.line;

  assert.equal(
    trace.missingRequirementEvidenceLine.requirement,
    acmeScenario.demoBeats.droppedRequirement,
  );
  assert.ok(
    evidenceLine.includes(
      `was present in ${acmeScenario.agentOutputPass1.dealName} customer call`,
    ),
  );
  assert.match(evidenceLine, /but missing from first-pass agent output/);
  assert.ok(evidenceLine.includes(acmeScenario.agentOutputPass1.summary));
});

test("LIM-1239: the requirement-bearing trace card carries the explicit evidence line", () => {
  const trace = buildAgentActivityTrace(input);
  const requirementCard = trace.cards.find((card) => card.tone === "missing");

  assert.ok(requirementCard, "one trace card should carry the missing-requirement line");
  assert.equal(
    requirementCard.missingRequirementLine,
    trace.missingRequirementEvidenceLine.line,
  );
  assert.ok(
    requirementCard.artifacts.some(
      (artifact) =>
        artifact.label === "Dropped requirement" &&
        artifact.value === acmeScenario.demoBeats.droppedRequirement &&
        artifact.state === "missing",
    ),
  );
});

test("LIM-1239: trace derivation fails closed when output and case drift apart", () => {
  assert.throws(
    () => droppedRequirementForTrace(acmeScenario.agentOutputPass2, acmeScenario.governanceCase),
    /must match a dropped requirement/,
  );
});

test("LIM-1239: required owners without artifacts fail closed", () => {
  assert.throws(
    () =>
      buildAgentActivityTrace({
        ...input,
        linearWorkstreamPayload: {
          ...acmeScenario.linearWorkstreamPayload,
          requiredOwners: [...acmeScenario.linearWorkstreamPayload.requiredOwners, "Legal"],
        },
      }),
    /required owner Legal has no workstream artifact/,
  );
});
