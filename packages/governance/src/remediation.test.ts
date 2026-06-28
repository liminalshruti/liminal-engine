import { test } from "node:test";
import assert from "node:assert/strict";
import {
  linearRemediationIssueContract,
  type Requirement,
  type LinearRemediationIssuePayload,
} from "@liminal-engine/contracts";
import {
  buildRemediationIssues,
  fileRemediationIssues,
  RemediationPreconditionError,
} from "./remediation.ts";
import type { RemediationIssueClient, RemediationIssueResult } from "./ports.ts";

function makeRequirement(overrides: Partial<Requirement> = {}): Requirement {
  return {
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
    ...overrides,
  };
}

/** A fake client at the port boundary — records payloads, makes NO network call. */
class RecordingClient implements RemediationIssueClient {
  readonly received: LinearRemediationIssuePayload[] = [];
  async create(payload: LinearRemediationIssuePayload): Promise<RemediationIssueResult> {
    this.received.push(payload);
    return {
      mode: "dry-run",
      payload,
      providerRequest: { title: payload.title, ownerRole: payload.ownerRole },
    };
  }
}

test("buildRemediationIssues produces one issue per required owner, in order, preserving Product/Security/Engineering semantics", () => {
  const issues = buildRemediationIssues({
    requirement: makeRequirement(),
    governanceCaseId: "gc_acme_eu",
    requiredOwners: ["Product", "Security", "Engineering"],
  });

  assert.equal(issues.length, 3);
  assert.deepEqual(issues.map((i) => i.ownerRole), ["Product", "Security", "Engineering"]);
  // accountable owner is the requirement's own owner (Security) — and only that one.
  assert.deepEqual(issues.map((i) => i.accountableOwner), [false, true, false]);
});

test("every remediation payload carries the load-bearing trace (requirementId / caseId / owner / evidence) and is contract-valid", () => {
  const issues = buildRemediationIssues({
    requirement: makeRequirement(),
    governanceCaseId: "gc_acme_eu",
    requiredOwners: ["Product", "Security", "Engineering"],
  });

  for (const issue of issues) {
    assert.equal(issue.requirementId, "req_acme_eu_residency");
    assert.equal(issue.governanceCaseId, "gc_acme_eu");
    assert.equal(issue.dealId, "deal_acme");
    assert.equal(issue.severity, "hard");
    assert.deepEqual(issue.evidenceRefs, ["call_acme_kickoff", "dpa_acme_v3"]);
    assert.ok(issue.description.includes("req_acme_eu_residency"));
    assert.ok(issue.description.includes("gc_acme_eu"));
    assert.ok(issue.description.includes(issue.ownerRole));
    assert.ok(issue.description.includes("call_acme_kickoff"));
    // contract round-trips (the use case re-parses, but assert it here too).
    assert.doesNotThrow(() => linearRemediationIssueContract.parse(issue));
  }
  // the accountable owner's body says so; the others do not.
  const security = issues.find((i) => i.ownerRole === "Security")!;
  const product = issues.find((i) => i.ownerRole === "Product")!;
  assert.ok(security.description.includes("(accountable owner)"));
  assert.ok(!product.description.includes("(accountable owner)"));
});

test("buildRemediationIssues appends the requirement's own owner when the workstream omits it", () => {
  const issues = buildRemediationIssues({
    requirement: makeRequirement({ ownerRole: "Legal" }),
    governanceCaseId: "gc_acme_eu",
    requiredOwners: ["Product", "Security", "Engineering"],
  });

  assert.deepEqual(issues.map((i) => i.ownerRole), ["Product", "Security", "Engineering", "Legal"]);
  assert.deepEqual(issues.map((i) => i.accountableOwner), [false, false, false, true]);
});

test("buildRemediationIssues dedupes the requirement owner case-insensitively (no duplicate issue)", () => {
  const issues = buildRemediationIssues({
    requirement: makeRequirement({ ownerRole: "security" }),
    governanceCaseId: "gc_acme_eu",
    requiredOwners: ["Product", "Security", "Engineering"],
  });

  assert.deepEqual(issues.map((i) => i.ownerRole), ["Product", "Security", "Engineering"]);
  // the matching workstream owner (Security) is flagged accountable.
  assert.deepEqual(issues.map((i) => i.accountableOwner), [false, true, false]);
});

test("buildRemediationIssues falls back to the requirement's own owner when requiredOwners is empty", () => {
  const issues = buildRemediationIssues({
    requirement: makeRequirement(),
    governanceCaseId: "gc_acme_eu",
    requiredOwners: [],
  });

  assert.deepEqual(issues.map((i) => i.ownerRole), ["Security"]);
  assert.equal(issues[0]?.accountableOwner, true);
});

test("buildRemediationIssues fails CLOSED on a non-hard requirement (only hard violations file remediation)", () => {
  assert.throws(
    () =>
      buildRemediationIssues({
        requirement: makeRequirement({ severity: "soft" }),
        governanceCaseId: "gc_acme_eu",
        requiredOwners: ["Product", "Security", "Engineering"],
      }),
    (err: unknown) => err instanceof RemediationPreconditionError && err.code === "not_hard",
  );
});

test("buildRemediationIssues fails CLOSED on a non-active requirement", () => {
  assert.throws(
    () =>
      buildRemediationIssues({
        requirement: makeRequirement({ status: "proposed", approvedBy: undefined, activatedAt: undefined }),
        governanceCaseId: "gc_acme_eu",
        requiredOwners: ["Product", "Security", "Engineering"],
      }),
    (err: unknown) => err instanceof RemediationPreconditionError && err.code === "not_active",
  );
});

test("buildRemediationIssues is deterministic — identical inputs yield byte-identical payloads", () => {
  const input = {
    requirement: makeRequirement(),
    governanceCaseId: "gc_acme_eu",
    requiredOwners: ["Product", "Security", "Engineering"],
  };
  assert.deepEqual(buildRemediationIssues(input), buildRemediationIssues(input));
});

test("fileRemediationIssues files every payload through the injected client, in order (no network)", async () => {
  const client = new RecordingClient();
  const results = await fileRemediationIssues(
    {
      requirement: makeRequirement(),
      governanceCaseId: "gc_acme_eu",
      requiredOwners: ["Product", "Security", "Engineering"],
    },
    client,
  );

  assert.equal(results.length, 3);
  assert.deepEqual(client.received.map((p) => p.ownerRole), ["Product", "Security", "Engineering"]);
  assert.deepEqual(results.map((r) => r.payload.ownerRole), ["Product", "Security", "Engineering"]);
  assert.ok(results.every((r) => r.mode === "dry-run"));
});
