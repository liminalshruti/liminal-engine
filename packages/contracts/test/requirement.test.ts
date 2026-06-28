import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REQUIREMENT_SCHEMA,
  requirementContract,
  requirementGoldenVectors,
  type Requirement,
} from "../src/requirement.contract.ts";

// A valid active requirement (the load-bearing EU residency one), reused across cases.
const activeReq: Requirement = {
  id: "req_acme_eu_residency",
  goalId: "goal_acme_expansion",
  dealId: "deal_acme",
  text: "All Acme EU customer data must remain resident in EU data centers.",
  ownerRole: "Security",
  severity: "hard",
  scope: ["deal-proposal", "launch-plan", "owner-assignment", "customer-facing-status-update"],
  status: "active",
  createdBy: "operator",
  approvedBy: "VP Ops / Head of AI Transformation",
  evidenceRefs: ["call_acme_kickoff", "dpa_acme_v3"],
  createdAt: "2026-06-27T09:55:00.000Z",
  activatedAt: "2026-06-27T10:05:00.000Z",
};

test("every Requirement golden vector parses through its contract", () => {
  for (const v of requirementGoldenVectors) {
    assert.doesNotThrow(
      () => requirementContract.parse(v.input),
      `golden vector ${v.name} must be a valid Requirement`,
    );
  }
  // the three required lifecycle states are present as goldens
  const names = requirementGoldenVectors.map((v) => v.name);
  assert.deepEqual(names, [
    "acme-eu-residency-active",
    "acme-dpa-proposed",
    "acme-comarketing-rejected",
  ]);
});

test("ACCEPTANCE: an active requirement WITHOUT operator-approval metadata is rejected", () => {
  const { approvedBy: _omit, ...activeNoApproval } = activeReq;
  assert.throws(
    () => requirementContract.parse(activeNoApproval),
    /active requirements require operator-approval metadata \(approvedBy\)/,
  );
  // safeParse pins the failing path to approvedBy
  const result = requirementContract.safeParse(activeNoApproval);
  assert.equal(result.success, false);
  assert.ok(
    !result.success && result.error.issues.some((i) => i.path.join(".") === "approvedBy"),
    "the refine issue must point at approvedBy",
  );
});

test("an active requirement WITH approvedBy parses", () => {
  assert.doesNotThrow(() => requirementContract.parse(activeReq));
});

test("proposed / rejected / retired candidates do not require approvedBy", () => {
  const proposed = { ...activeReq, status: "proposed" as const, activatedAt: undefined };
  delete (proposed as Record<string, unknown>).approvedBy;
  delete (proposed as Record<string, unknown>).activatedAt;
  assert.doesNotThrow(() => requirementContract.parse(proposed));

  const rejected = { ...proposed, status: "rejected" as const };
  assert.doesNotThrow(() => requirementContract.parse(rejected));

  const retired = { ...proposed, status: "retired" as const };
  assert.doesNotThrow(() => requirementContract.parse(retired));
});

test("Requirement rejects out-of-vocabulary enums and bad timestamps", () => {
  assert.throws(() => requirementContract.parse({ ...activeReq, severity: "critical" }));
  assert.throws(() => requirementContract.parse({ ...activeReq, status: "draft" }));
  assert.throws(() => requirementContract.parse({ ...activeReq, createdBy: "system" }));
  assert.throws(() => requirementContract.parse({ ...activeReq, createdAt: "yesterday" }));
  assert.throws(() => requirementContract.parse({ ...activeReq, scope: [""] }));
  assert.throws(() => requirementContract.parse({ ...activeReq, evidenceRefs: [""] }));
});

test("Requirement is strict — unknown keys are rejected", () => {
  assert.throws(
    () => requirementContract.parse({ ...activeReq, priority: "P0" }),
    /Unrecognized key/,
  );
});

test("Requirement canonical projection is schema-tagged snake_case; optionals appear only when set", () => {
  const active = requirementContract.canonical(activeReq) as Record<string, unknown>;
  assert.equal(active.schema, REQUIREMENT_SCHEMA);
  assert.equal(active.goal_id, "goal_acme_expansion");
  assert.equal(active.deal_id, "deal_acme");
  assert.equal(active.owner_role, "Security");
  assert.equal(active.created_by, "operator");
  assert.equal(active.approved_by, "VP Ops / Head of AI Transformation");
  assert.equal(active.activated_at, "2026-06-27T10:05:00.000Z");

  const proposed = requirementContract.canonical(
    requirementGoldenVectors[1]!.input as Requirement,
  ) as Record<string, unknown>;
  assert.equal("approved_by" in proposed, false);
  assert.equal("activated_at" in proposed, false);
  assert.deepEqual(proposed.evidence_refs, ["dpa_acme_v3"]);
});

test("Requirement canonical hash is deterministic and order-independent", () => {
  assert.equal(requirementContract.hash(activeReq), requirementContract.hash(activeReq));
  // re-ordering the object keys must not change the hash (keys sorted in canonical)
  const reordered = {
    activatedAt: activeReq.activatedAt,
    evidenceRefs: activeReq.evidenceRefs,
    approvedBy: activeReq.approvedBy,
    createdAt: activeReq.createdAt,
    createdBy: activeReq.createdBy,
    status: activeReq.status,
    scope: activeReq.scope,
    severity: activeReq.severity,
    ownerRole: activeReq.ownerRole,
    text: activeReq.text,
    dealId: activeReq.dealId,
    goalId: activeReq.goalId,
    id: activeReq.id,
  };
  assert.equal(requirementContract.hash(reordered), requirementContract.hash(activeReq));
  assert.match(requirementContract.hash(activeReq), /^[0-9a-f]{64}$/);
});
