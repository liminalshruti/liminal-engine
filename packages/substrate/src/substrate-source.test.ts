import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemorySubstrate } from "./substrate.ts";
import { SubstrateAgentOutputSource } from "./substrate-source.ts";

/**
 * The bridge that lets runGovernanceLoop run on real ingested data: an
 * AgentOutputSource whose droppedRequirements are COMPUTED from the substrate
 * (detectLostContext), not read off a fixture. This is the demo → product flip.
 */
test("pass 1 produces droppedRequirements computed from the substrate (lost context)", async () => {
  const substrate = new InMemorySubstrate();
  substrate.ingest({
    sourceType: "call-transcript",
    title: "call",
    content: "We will only pilot with EU data residency and SOC2 evidence.",
    provenance: "pinned",
  });
  substrate.ingest({
    sourceType: "proposal",
    title: "proposal",
    content: "Includes SOC2 evidence and pricing.",
    provenance: "pinned",
  });

  const source = new SubstrateAgentOutputSource(substrate, {
    dealId: "deal_x",
    dealName: "Acme",
    requirements: ["EU data residency", "SOC2 evidence"],
    statedIn: "call-transcript",
  });

  const out = await source.getOutput("deal_x", 1);

  // EU data residency was lost (absent from the proposal); SOC2 propagated.
  assert.deepEqual(out.droppedRequirements, ["EU data residency"]);
  assert.equal(out.reportedStatus, "on-track"); // pass 1 is the false green
  assert.equal(out.dealId, "deal_x");
  assert.equal(out.passNumber, 1);
});

test("pass 2 (after correction) drops nothing — second pass improves", async () => {
  const substrate = new InMemorySubstrate();
  substrate.ingest({
    sourceType: "call-transcript",
    title: "call",
    content: "Need EU data residency.",
    provenance: "pinned",
  });
  substrate.ingest({
    sourceType: "proposal",
    title: "proposal",
    content: "Now includes EU data residency after correction.",
    provenance: "pinned",
  });

  const source = new SubstrateAgentOutputSource(substrate, {
    dealId: "deal_x",
    dealName: "Acme",
    requirements: ["EU data residency"],
    statedIn: "call-transcript",
  });

  const out = await source.getOutput("deal_x", 2);
  assert.deepEqual(out.droppedRequirements, []);
});
