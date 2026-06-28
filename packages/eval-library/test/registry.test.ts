/**
 * Tests for EvalLibraryRegistry — in-memory store for persisted eval cases.
 *
 * Real tests, no mocks: the registry stores and retrieves actual EvalCase
 * objects with correct versioning and query semantics.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { EvalLibraryRegistry } from "../src/registry.ts";
import type { EvalCase } from "@liminal-engine/contracts";

const acmeEvalCase: EvalCase = {
  id: "ec_acme_eu",
  dealId: "deal_acme",
  governanceCaseId: "gc_acme_eu",
  criterion: "EU data residency requirement honored",
  createdAt: "2026-06-27T10:06:00.000Z",
};

const acmeEvalCaseV2: EvalCase = {
  id: "ec_acme_eu_v2",
  dealId: "deal_acme",
  governanceCaseId: "gc_acme_eu",
  criterion: "EU data residency requirement honored (with GDPR audit)",
  createdAt: "2026-06-28T10:06:00.000Z",
};

const otherDealCase: EvalCase = {
  id: "ec_other_compliance",
  dealId: "deal_other",
  governanceCaseId: "gc_other_compliance",
  criterion: "SOC 2 Type II compliance maintained",
  createdAt: "2026-06-27T11:00:00.000Z",
};

test("add and getByIdAndVersion — should add an eval case and retrieve it by caseId and version", () => {
  const registry = new EvalLibraryRegistry();
  const key = registry.add(
    "ec_acme_eu",
    "1.0.0",
    "EU data residency requirement honored",
    acmeEvalCase,
  );

  assert.equal(key, "ec_acme_eu@1.0.0");

  const entry = registry.getByIdAndVersion("ec_acme_eu", "1.0.0");
  assert.ok(entry !== undefined);
  assert.deepEqual(entry.case, acmeEvalCase);
  assert.equal(entry.rule, "EU data residency requirement honored");
  assert.equal(entry.version, "1.0.0");
});

test("add and getByIdAndVersion — should return undefined for non-existent case", () => {
  const registry = new EvalLibraryRegistry();
  const entry = registry.getByIdAndVersion("ec_nonexistent", "1.0.0");
  assert.equal(entry, undefined);
});

test("add and getByIdAndVersion — should set archivedAt to current time if not provided", () => {
  const registry = new EvalLibraryRegistry();
  const beforeAdd = new Date().toISOString();
  registry.add("ec_acme_eu", "1.0.0", "test criterion", acmeEvalCase);
  const afterAdd = new Date().toISOString();

  const entry = registry.getByIdAndVersion("ec_acme_eu", "1.0.0");
  assert.ok(entry !== undefined);
  assert.ok(entry.archivedAt !== undefined);
  assert.ok(entry.archivedAt >= beforeAdd);
  assert.ok(entry.archivedAt <= afterAdd);
});

test("add and getByIdAndVersion — should accept explicit archivedAt timestamp", () => {
  const registry = new EvalLibraryRegistry();
  const customTime = "2026-06-27T09:00:00.000Z";
  registry.add(
    "ec_acme_eu",
    "1.0.0",
    "test criterion",
    acmeEvalCase,
    customTime,
  );

  const entry = registry.getByIdAndVersion("ec_acme_eu", "1.0.0");
  assert.ok(entry !== undefined);
  assert.equal(entry.archivedAt, customTime);
});

test("getByCaseId — should return the latest version of a case by caseId alone", () => {
  const registry = new EvalLibraryRegistry();
  registry.add("ec_acme_eu", "1.0.0", "test", acmeEvalCase);
  registry.add("ec_acme_eu", "2.0.0", "test", acmeEvalCaseV2);
  registry.add("ec_acme_eu", "1.5.0", "test", acmeEvalCase);

  const entry = registry.getByCaseId("ec_acme_eu");
  assert.ok(entry !== undefined);
  assert.equal(entry.version, "2.0.0");
  assert.deepEqual(entry.case, acmeEvalCaseV2);
});

test("getByCaseId — should return the only version if only one exists", () => {
  const registry = new EvalLibraryRegistry();
  registry.add("ec_acme_eu", "1.0.0", "test", acmeEvalCase);

  const entry = registry.getByCaseId("ec_acme_eu");
  assert.ok(entry !== undefined);
  assert.equal(entry.version, "1.0.0");
});

test("getByCaseId — should return undefined if caseId does not exist", () => {
  const registry = new EvalLibraryRegistry();
  const entry = registry.getByCaseId("ec_nonexistent");
  assert.equal(entry, undefined);
});

test("getByCaseId — should correctly handle semver ordering", () => {
  const registry = new EvalLibraryRegistry();
  registry.add("ec_test", "0.1.0", "test", acmeEvalCase);
  registry.add("ec_test", "0.2.0", "test", acmeEvalCase);
  registry.add("ec_test", "1.0.0", "test", acmeEvalCase);
  registry.add("ec_test", "0.10.0", "test", acmeEvalCase);

  const entry = registry.getByCaseId("ec_test");
  assert.ok(entry !== undefined);
  // String comparison: "1.0.0" > others, then "0.2.0" > "0.10.0" > "0.1.0"
  assert.equal(entry.version, "1.0.0");
});

test("query — should query by rule (substring, case-insensitive)", () => {
  const registry = new EvalLibraryRegistry();
  registry.add(
    "ec_acme_eu",
    "1.0.0",
    "EU data residency requirement honored",
    acmeEvalCase,
  );
  registry.add(
    "ec_acme_eu",
    "2.0.0",
    "EU data residency requirement honored",
    acmeEvalCaseV2,
  );
  registry.add(
    "ec_other_compliance",
    "1.0.0",
    "SOC 2 Type II compliance maintained",
    otherDealCase,
  );

  const results = registry.query({ rule: "EU data" });
  assert.equal(results.length, 2);
  assert.ok(results.every((e) => e.caseId === "ec_acme_eu"));
});

test("query — should query by rule (case-insensitive match)", () => {
  const registry = new EvalLibraryRegistry();
  registry.add("ec_acme_eu", "1.0.0", "EU data residency", acmeEvalCase);
  registry.add("ec_acme_eu", "2.0.0", "EU data residency", acmeEvalCaseV2);

  const results = registry.query({ rule: "eu DATA" });
  assert.equal(results.length, 2);
});

test("query — should query by caseId (exact match)", () => {
  const registry = new EvalLibraryRegistry();
  registry.add("ec_acme_eu", "1.0.0", "rule1", acmeEvalCase);
  registry.add("ec_acme_eu", "2.0.0", "rule1", acmeEvalCaseV2);
  registry.add("ec_other", "1.0.0", "rule2", otherDealCase);

  const results = registry.query({ caseId: "ec_acme_eu" });
  assert.equal(results.length, 2);
  assert.ok(results.every((e) => e.caseId === "ec_acme_eu"));
});

test("query — should query by version (exact match)", () => {
  const registry = new EvalLibraryRegistry();
  registry.add("ec_acme_eu", "1.0.0", "rule1", acmeEvalCase);
  registry.add("ec_other", "1.0.0", "rule2", otherDealCase);
  registry.add("ec_acme_eu", "2.0.0", "rule1", acmeEvalCaseV2);

  const results = registry.query({ version: "1.0.0" });
  assert.equal(results.length, 2);
  assert.ok(results.every((e) => e.version === "1.0.0"));
});

test("query — should return empty array if no matches", () => {
  const registry = new EvalLibraryRegistry();
  registry.add("ec_acme_eu", "1.0.0", "rule1", acmeEvalCase);

  const results = registry.query({ rule: "nonexistent" });
  assert.deepEqual(results, []);
});

test("query — should prioritize caseId over rule if both provided", () => {
  const registry = new EvalLibraryRegistry();
  registry.add("ec_acme_eu", "1.0.0", "EU data", acmeEvalCase);
  registry.add("ec_acme_eu", "2.0.0", "EU data", acmeEvalCaseV2);
  registry.add("ec_other", "1.0.0", "compliance", otherDealCase);

  const results = registry.query({
    caseId: "ec_acme_eu",
    rule: "compliance",
  });
  // caseId filter is applied first, so only acme cases match
  assert.equal(results.length, 2);
  assert.ok(results.every((e) => e.caseId === "ec_acme_eu"));
});

test("query — should return all entries if query is empty", () => {
  const registry = new EvalLibraryRegistry();
  registry.add("ec_acme_eu", "1.0.0", "rule1", acmeEvalCase);
  registry.add("ec_other", "1.0.0", "rule2", otherDealCase);

  const results = registry.query({});
  assert.equal(results.length, 2);
});

test("JSON serialization — should export all entries as JSON", () => {
  const registry = new EvalLibraryRegistry();
  registry.add("ec_acme_eu", "1.0.0", "test", acmeEvalCase);
  registry.add("ec_other", "1.0.0", "test", otherDealCase);

  const json = registry.toJSON();
  assert.equal(json.entries.length, 2);
  assert.equal(json.entries[0]?.caseId, "ec_acme_eu");
  assert.equal(json.entries[1]?.caseId, "ec_other");
});

test("JSON serialization — should import entries from JSON", () => {
  const registry = new EvalLibraryRegistry();
  const json = {
    entries: [
      {
        caseId: "ec_acme_eu",
        version: "1.0.0",
        rule: "EU data residency",
        case: acmeEvalCase,
        archivedAt: "2026-06-27T10:00:00.000Z",
      },
      {
        caseId: "ec_other",
        version: "1.0.0",
        rule: "compliance",
        case: otherDealCase,
        archivedAt: "2026-06-27T11:00:00.000Z",
      },
    ],
  };

  registry.fromJSON(json);

  assert.equal(registry.size(), 2);
  assert.ok(registry.getByIdAndVersion("ec_acme_eu", "1.0.0") !== undefined);
  assert.ok(registry.getByIdAndVersion("ec_other", "1.0.0") !== undefined);
});

test("JSON serialization — should round-trip: add → toJSON → clear → fromJSON → verify", () => {
  const registry = new EvalLibraryRegistry();
  registry.add("ec_acme_eu", "1.0.0", "EU data residency", acmeEvalCase);
  registry.add(
    "ec_acme_eu",
    "2.0.0",
    "EU data residency (v2)",
    acmeEvalCaseV2,
  );

  const json = registry.toJSON();
  registry.clear();

  assert.equal(registry.size(), 0);

  registry.fromJSON(json);

  assert.equal(registry.size(), 2);
  const v1 = registry.getByIdAndVersion("ec_acme_eu", "1.0.0");
  const v2 = registry.getByIdAndVersion("ec_acme_eu", "2.0.0");
  assert.ok(v1 !== undefined);
  assert.ok(v2 !== undefined);
  assert.deepEqual(v1.case, acmeEvalCase);
  assert.deepEqual(v2.case, acmeEvalCaseV2);
});

test("JSON serialization — should handle empty JSON import gracefully", () => {
  const registry = new EvalLibraryRegistry();
  registry.add("ec_acme_eu", "1.0.0", "test", acmeEvalCase);
  registry.fromJSON({ entries: [] });

  assert.equal(registry.size(), 0);
  assert.equal(registry.getByIdAndVersion("ec_acme_eu", "1.0.0"), undefined);
});

test("all and size — should return all entries", () => {
  const registry = new EvalLibraryRegistry();
  registry.add("ec_acme_eu", "1.0.0", "test", acmeEvalCase);
  registry.add("ec_other", "1.0.0", "test", otherDealCase);

  const all = registry.all();
  assert.equal(all.length, 2);
});

test("all and size — should return correct size", () => {
  const registry = new EvalLibraryRegistry();
  assert.equal(registry.size(), 0);

  registry.add("ec_acme_eu", "1.0.0", "test", acmeEvalCase);
  assert.equal(registry.size(), 1);

  registry.add("ec_acme_eu", "2.0.0", "test", acmeEvalCaseV2);
  assert.equal(registry.size(), 2);

  registry.clear();
  assert.equal(registry.size(), 0);
});

test("clear — should clear all entries", () => {
  const registry = new EvalLibraryRegistry();
  registry.add("ec_acme_eu", "1.0.0", "test", acmeEvalCase);
  registry.add("ec_other", "1.0.0", "test", otherDealCase);

  assert.equal(registry.size(), 2);

  registry.clear();

  assert.equal(registry.size(), 0);
  assert.deepEqual(registry.all(), []);
  assert.equal(registry.getByIdAndVersion("ec_acme_eu", "1.0.0"), undefined);
});

test("multiple versions of same case — should store and retrieve multiple versions independently", () => {
  const registry = new EvalLibraryRegistry();
  registry.add("ec_acme_eu", "1.0.0", "rule v1", acmeEvalCase);
  registry.add("ec_acme_eu", "1.1.0", "rule v1 (refined)", acmeEvalCaseV2);
  registry.add("ec_acme_eu", "2.0.0", "rule v2", acmeEvalCaseV2);

  assert.equal(registry.size(), 3);
  assert.equal(registry.getByIdAndVersion("ec_acme_eu", "1.0.0")?.rule, "rule v1");
  assert.equal(
    registry.getByIdAndVersion("ec_acme_eu", "1.1.0")?.rule,
    "rule v1 (refined)",
  );
  assert.equal(registry.getByIdAndVersion("ec_acme_eu", "2.0.0")?.rule, "rule v2");
});

test("multiple versions of same case — getByCaseId should return the latest version", () => {
  const registry = new EvalLibraryRegistry();
  registry.add("ec_acme_eu", "1.0.0", "rule v1", acmeEvalCase);
  registry.add("ec_acme_eu", "2.0.0", "rule v2", acmeEvalCaseV2);

  const latest = registry.getByCaseId("ec_acme_eu");
  assert.ok(latest !== undefined);
  assert.equal(latest.version, "2.0.0");
  assert.equal(latest.rule, "rule v2");
});

test("overwriting a case version — should overwrite a case if added with the same caseId + version", () => {
  const registry = new EvalLibraryRegistry();
  registry.add("ec_acme_eu", "1.0.0", "original rule", acmeEvalCase);

  const updatedCase: EvalCase = {
    ...acmeEvalCase,
    criterion: "updated criterion",
  };
  registry.add("ec_acme_eu", "1.0.0", "updated rule", updatedCase);

  const entry = registry.getByIdAndVersion("ec_acme_eu", "1.0.0");
  assert.ok(entry !== undefined);
  assert.equal(entry.rule, "updated rule");
  assert.equal(entry.case.criterion, "updated criterion");
  assert.equal(registry.size(), 1); // not 2
});
