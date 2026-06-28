/**
 * LIM-1165 — Acme fixture set. Locks demo beats 2–4 (Acme goal, false green,
 * dropped EU requirement) and the single-source invariant (AC#2): the display
 * copy the screens render must stay tied to the contract-validated fixture facts,
 * and `acmeScenario` must be the one object that carries them.
 *
 * Strings here are quoted VERBATIM from DEMO_CONTRACT.md so a wording drift on the
 * locked beats fails here, not on stage.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acmeScenario,
  acmeDemoBeats,
  acmeBusinessGoal,
  acmeAgentOutputPass1,
  acmeGovernanceCase,
} from "../src/fixtures/acme.ts";

test("beat 2: business goal is the locked DEMO_CONTRACT string", () => {
  assert.equal(acmeDemoBeats.goal, "Close Acme expansion by Friday — $1.2M ARR");
  assert.equal(acmeDemoBeats.goal, acmeBusinessGoal);
});

test("beat 3: the false-green agent claim reads 'Acme expansion appears on track'", () => {
  assert.equal(acmeDemoBeats.agentClaim, "Acme expansion appears on track");
  // The display claim must be backed by a fixture that is genuinely a false green:
  // reported on-track while a requirement was in fact dropped.
  assert.equal(acmeAgentOutputPass1.reportedStatus, "on-track");
  assert.ok(acmeAgentOutputPass1.droppedRequirements.length > 0);
});

test("beat 4: the dropped requirement is EU data residency, and it is load-bearing", () => {
  assert.equal(acmeDemoBeats.droppedRequirement, "EU data residency");
  // Display copy must match the actual dropped requirement in the agent output...
  assert.ok(
    acmeAgentOutputPass1.droppedRequirements.includes(acmeDemoBeats.droppedRequirement),
  );
  // ...and the governance case that later surfaces it.
  assert.equal(acmeGovernanceCase.missedRequirement, acmeDemoBeats.droppedRequirement);
});

test("AC#2 single source: acmeScenario carries the beats + the goal", () => {
  assert.equal(acmeScenario.businessGoal, acmeBusinessGoal);
  assert.equal(acmeScenario.demoBeats, acmeDemoBeats);
  // Same deal across the beats — screens render one consistent Acme deal.
  assert.equal(acmeScenario.governanceCase.dealId, acmeAgentOutputPass1.dealId);
});
