import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemorySubstrate } from "./substrate.ts";
import { detectLostContext } from "./detect-lost-context.ts";

/**
 * The real detection (not a fixture readout): a requirement stated in one stream
 * (the call) but ABSENT from the downstream work streams (proposal / plan) is lost
 * context. This computes the drop from arbitrary ingested data.
 */
test("detects a requirement present in the call but missing from downstream streams", () => {
  const substrate = new InMemorySubstrate();
  substrate.ingest({
    sourceType: "call-transcript",
    title: "Acme discovery call",
    content: "We will only pilot if you support EU data residency and SOC2 evidence.",
    provenance: "pinned",
  });
  substrate.ingest({
    sourceType: "proposal",
    title: "Acme proposal draft",
    content: "Pricing, timeline, and a SOC2 evidence package are included.",
    provenance: "pinned",
  });
  substrate.ingest({
    sourceType: "launch-plan",
    title: "Acme launch plan",
    content: "Onboarding milestones and a SOC2 review step.",
    provenance: "pinned",
  });

  const lost = detectLostContext(substrate, {
    requirements: ["EU data residency", "SOC2 evidence"],
    statedIn: "call-transcript",
  });

  // "SOC2 evidence" propagated to proposal+plan; "EU data residency" did not.
  assert.deepEqual(lost, ["EU data residency"]);
});

test("returns empty when every stated requirement propagated downstream", () => {
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
    content: "We provide EU data residency.",
    provenance: "pinned",
  });

  const lost = detectLostContext(substrate, {
    requirements: ["EU data residency"],
    statedIn: "call-transcript",
  });

  assert.deepEqual(lost, []);
});
