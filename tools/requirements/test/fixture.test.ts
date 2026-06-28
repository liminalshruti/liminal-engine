/**
 * Fixture-fallback tests (AC4: "Fixture fallback remains available").
 *
 * The fallback is the EvidenceBundle contract's OWN pinned golden vector, so it is
 * always valid, deterministic, and carries no raw text — and it cannot drift from
 * the contract because it IS the contract's golden.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evidenceBundleContract,
  evidenceBundleGoldenVectors,
} from "../src/contracts.ts";
import { FIXTURE_NAME, fixtureBundle } from "../src/fixture.ts";

test("fixtureBundle() returns a contract-valid EvidenceBundle", () => {
  const b = fixtureBundle();
  assert.deepEqual(evidenceBundleContract.parse(b), b);
  assert.ok(b.sources.length >= 1 && b.chunks.length >= 1);
});

test("fixtureBundle() IS the contract's pinned golden vector (single source of truth)", () => {
  const vector = evidenceBundleGoldenVectors.find((v) => v.name === FIXTURE_NAME)!;
  assert.deepEqual(fixtureBundle(), vector.input);
});

test("fixtureBundle() is deterministic (stable hash across calls)", () => {
  assert.equal(evidenceBundleContract.hash(fixtureBundle()), evidenceBundleContract.hash(fixtureBundle()));
});

test("the fixture carries only sha256 refs + metadata, never raw text", () => {
  const b = fixtureBundle();
  for (const s of b.sources) assert.match(s.hash, /^[0-9a-f]{64}$/);
  for (const c of b.chunks) assert.match(c.hash, /^[0-9a-f]{64}$/);
});
