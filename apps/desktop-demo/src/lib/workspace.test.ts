import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemorySubstrate } from "@liminal-engine/substrate";
import { buildWorkspaceAssessment } from "./workspace.ts";

/**
 * The operating surface's cold-start core (Gap 3 / DIRECTIVE.md): given an operator
 * goal + ARBITRARY ingested streams (no fixture, no fixed sequence), assess whether
 * the AI work is advancing the goal — and surface the drift case if not. Works on
 * whatever data the operator loaded.
 */
test("assesses a goal over ingested streams and surfaces the AI-spend drift case", () => {
  const substrate = new InMemorySubstrate();
  substrate.ingest({
    sourceType: "call-transcript",
    title: "Acme discovery call",
    content: "We will only pilot with EU data residency and SOC2 evidence.",
    provenance: "pinned",
  });
  substrate.ingest({
    sourceType: "proposal",
    title: "Acme proposal",
    content: "Includes SOC2 evidence and pricing.",
    provenance: "pinned",
  });

  const ws = buildWorkspaceAssessment({
    goal: {
      title: "Increase enterprise pilot conversion by 20% this quarter",
      budgetUsd: 50_000,
      metric: "enterprise pilots converted",
    },
    substrate,
    requirements: ["EU data residency", "SOC2 evidence"],
    statedIn: "call-transcript",
    spendUsd: 18_400,
  });

  // EU data residency was lost (absent from the proposal) → drift, not aligned
  assert.equal(ws.alignment.aligned, false);
  assert.deepEqual(ws.lostRequirements, ["EU data residency"]);
  // a drift case is surfaced, stating the spend-vs-goal risk
  assert.ok(ws.driftCase, "a drift case is surfaced when work is misaligned");
  assert.match(ws.driftCase.businessImpact, /\$18,400/);
  assert.match(ws.driftCase.businessImpact, /not being advanced/);
  // the workspace reflects the operator's own goal + ingested data (no fixture)
  assert.equal(ws.goalTitle, "Increase enterprise pilot conversion by 20% this quarter");
  assert.equal(ws.streamCount, 2);
});

test("aligned workspace surfaces no drift case when nothing is lost", () => {
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

  const ws = buildWorkspaceAssessment({
    goal: { title: "Goal", budgetUsd: 10_000, metric: "x" },
    substrate,
    requirements: ["EU data residency"],
    statedIn: "call-transcript",
    spendUsd: 2_000,
  });

  assert.equal(ws.alignment.aligned, true);
  assert.equal(ws.driftCase, null);
});
