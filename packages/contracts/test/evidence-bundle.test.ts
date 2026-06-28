/**
 * EvidenceBundle contract tests (LIM-1323).
 *
 * Pins the cited-evidence normalization model: heterogeneous sources + chunk spans
 * + optional agent-output refs collapse into ONE content-addressed bundle whose hash
 * is byte-reproducible. The load-bearing acceptance proof lives in the last block:
 * every stored `hash` is the REAL sha256 of the source text / quoted span (the
 * kernel's own `sha256Hex`, no bespoke hash), and NO raw secret/customer text ever
 * lands in the durable golden values — only hashes + non-sensitive metadata.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sha256Hex, stableStringify } from "../src/canonical-hash.ts";
import {
  EVIDENCE_BUNDLE_SCHEMA,
  evidenceBundleContract,
  evidenceBundleGoldenVectors,
  type EvidenceBundle,
} from "../src/evidence-bundle.contract.ts";

const fullVector = evidenceBundleGoldenVectors.find((v) => v.name === "acme-eu-residency-evidence")!;
const minimalVector = evidenceBundleGoldenVectors.find((v) => v.name === "minimal-single-source")!;
const full = evidenceBundleContract.parse(fullVector.input);
const minimal = evidenceBundleContract.parse(minimalVector.input);

// The RAW originals the bundle commits to BY REFERENCE — held here as the
// "authorized holder" material, exactly as redact.test.ts holds its SECRET. These
// MUST NOT appear anywhere in the durable bundle / golden values.
const RAW_SOURCE_TEXTS: Record<string, string> = {
  src_acme_kickoff_call:
    "Acme expansion kickoff call. Procurement and security joined. The customer restated that all EU customer data must remain resident in EU data centers as a hard contractual requirement. Engineering noted the current default storage region is US.",
  src_acme_proposal_v3:
    "Acme expansion proposal v3. Commercial terms: $1.2M ARR, annual, net-30. Scope covers platform expansion across EU subsidiaries. Data residency to be confirmed in the statement of work.",
  src_acme_sow:
    "Acme statement of work. Deliverables: provisioning, onboarding, support. The data handling section omits any EU residency guarantee and defaults storage to the US region. No EU data residency clause is present.",
  src_acme_procurement_email:
    "Procurement thread re: Acme expansion. Legal sign-off is pending data residency confirmation. Please ensure the statement of work reflects EU-only storage before countersignature.",
  src_acme_agent_pass1:
    "Deal-desk agent, pass 1: Acme $1.2M expansion on track; all workstreams green.",
};
const RAW_CHUNK_QUOTES: Record<string, string> = {
  ch_eu_residency_call:
    "all EU customer data must remain resident in EU data centers as a hard contractual requirement",
  ch_commercial_terms: "Commercial terms: $1.2M ARR, annual, net-30.",
  ch_missing_residency_sow:
    "The data handling section omits any EU residency guarantee and defaults storage to the US region.",
  ch_email_residency_confirm:
    "Please ensure the statement of work reflects EU-only storage before countersignature.",
  ch_agent_false_green: "Acme $1.2M expansion on track; all workstreams green.",
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

test("EvidenceBundle parses a fully-populated bundle and round-trips", () => {
  assert.deepEqual(evidenceBundleContract.parse(clone(fullVector.input)), fullVector.input);
});

test("EvidenceBundle parses a minimal bundle — goalId, agentOutputs and chunk label are optional", () => {
  assert.deepEqual(evidenceBundleContract.parse(clone(minimalVector.input)), minimalVector.input);
});

test("canonical projection snake_cases keys, embeds the schema, and sorts arrays by stable id", () => {
  const c = evidenceBundleContract.canonical(full) as Record<string, unknown>;
  assert.equal(c.schema, EVIDENCE_BUNDLE_SCHEMA);
  assert.equal(c.goal_id, "goal_acme_expansion");
  assert.equal(c.deal_id, "deal_acme");

  const sources = c.sources as { source_id: string; source_type: string; captured_at: string }[];
  const chunks = c.chunks as { chunk_id: string; source_id: string; span: unknown; hash: string }[];
  const agentOutputs = c.agent_outputs as { agent_output_id: string; source_id: string }[];

  // arrays are ordered by their stable id (locale-independent), not assembly order
  assert.deepEqual(
    sources.map((s) => s.source_id),
    [...sources.map((s) => s.source_id)].sort(),
  );
  assert.deepEqual(
    chunks.map((c2) => c2.chunk_id),
    [...chunks.map((c2) => c2.chunk_id)].sort(),
  );
  // snake_case keys only — no camelCase leaks into the projection
  assert.ok(sources.every((s) => "source_type" in s && "captured_at" in s && !("sourceType" in s)));
  assert.ok(chunks.every((ch) => "chunk_id" in ch && "source_id" in ch && !("chunkId" in ch)));
  assert.deepEqual(agentOutputs, [{ agent_output_id: "ao_acme_p1", source_id: "src_acme_agent_pass1" }]);
});

test("canonical projection omits absent optionals as MISSING keys (stable hash)", () => {
  const c = evidenceBundleContract.canonical(minimal) as Record<string, unknown>;
  assert.equal("goal_id" in c, false);
  assert.equal("agent_outputs" in c, false);
  const chunk = (c.chunks as Record<string, unknown>[])[0]!;
  assert.equal("label" in chunk, false);
  // present scope key IS projected
  assert.equal(c.deal_id, "deal_acme");
});

test("sourceType enum covers the seven required kinds and rejects unknown kinds", () => {
  const kinds = ["customer_call", "proposal", "sow", "slack", "email", "linear", "agent_output"];
  for (const sourceType of kinds) {
    const candidate = {
      ...clone(minimalVector.input),
      sources: [{ ...clone(minimalVector.input).sources[0]!, sourceType }],
    };
    assert.equal(evidenceBundleContract.safeParse(candidate).success, true, `${sourceType} should parse`);
  }
  const bad = {
    ...clone(minimalVector.input),
    sources: [{ ...clone(minimalVector.input).sources[0]!, sourceType: "tiktok" }],
  };
  assert.equal(evidenceBundleContract.safeParse(bad).success, false);
});

test("source and chunk hashes must be lowercase sha256 hex (not arbitrary strings)", () => {
  const badSourceHash = clone(minimalVector.input);
  badSourceHash.sources[0]!.hash = "not-a-hash";
  assert.equal(evidenceBundleContract.safeParse(badSourceHash).success, false);

  const upper = clone(minimalVector.input);
  upper.sources[0]!.hash = "E5B72397C57E4314EAC2B3EBF436C188D40466C1BFA07073FD63BF4B325EFD19";
  assert.equal(evidenceBundleContract.safeParse(upper).success, false, "uppercase hex must reject");

  const badChunkHash = clone(minimalVector.input);
  badChunkHash.chunks[0]!.hash = "deadbeef";
  assert.equal(evidenceBundleContract.safeParse(badChunkHash).success, false);
});

test("a bundle must be scoped to a goalId and/or a dealId", () => {
  const { dealId: _omit, ...noScope } = clone(minimalVector.input);
  assert.equal(evidenceBundleContract.safeParse(noScope).success, false);
  // goal-only and deal-only are both valid
  assert.equal(evidenceBundleContract.safeParse({ ...noScope, goalId: "goal_x" }).success, true);
  assert.equal(evidenceBundleContract.safeParse({ ...noScope, dealId: "deal_x" }).success, true);
});

test("at least one source is required", () => {
  const empty = { ...clone(minimalVector.input), sources: [], chunks: [] };
  assert.equal(evidenceBundleContract.safeParse(empty).success, false);
});

test("referential integrity: every chunk must cite a known source", () => {
  const dangling = clone(minimalVector.input);
  dangling.chunks[0]!.sourceId = "src_does_not_exist";
  assert.equal(evidenceBundleContract.safeParse(dangling).success, false);
});

test("source ids and chunk ids must each be unique", () => {
  const dupSource = clone(fullVector.input);
  dupSource.sources[1] = clone(dupSource.sources[0]!);
  assert.equal(evidenceBundleContract.safeParse(dupSource).success, false);

  const dupChunk = clone(fullVector.input);
  dupChunk.chunks[1] = clone(dupChunk.chunks[0]!);
  assert.equal(evidenceBundleContract.safeParse(dupChunk).success, false);
});

test("agentOutputs must cite an existing agent_output source and be unique", () => {
  // cites a non-agent_output source → reject
  const wrongType = clone(fullVector.input);
  assert.ok(wrongType.agentOutputs);
  wrongType.agentOutputs[0]!.sourceId = "src_acme_kickoff_call";
  assert.equal(evidenceBundleContract.safeParse(wrongType).success, false);

  // cites an unknown source → reject
  const unknownSource = clone(fullVector.input);
  assert.ok(unknownSource.agentOutputs);
  unknownSource.agentOutputs[0]!.sourceId = "src_nope";
  assert.equal(evidenceBundleContract.safeParse(unknownSource).success, false);

  // duplicate agentOutputId → reject
  const dup = clone(fullVector.input);
  assert.ok(dup.agentOutputs);
  dup.agentOutputs = [clone(dup.agentOutputs[0]!), clone(dup.agentOutputs[0]!)];
  assert.equal(evidenceBundleContract.safeParse(dup).success, false);
});

test("hash is deterministic and content-addressed — independent of array assembly order", () => {
  const h = evidenceBundleContract.hash(full);
  assert.match(h, /^[0-9a-f]{64}$/);
  // key order independent
  assert.equal(evidenceBundleContract.hash(clone(full)), h);
  // ARRAY order independent — reversing sources/chunks/agentOutputs hashes identically
  const reordered: EvidenceBundle = {
    ...full,
    sources: [...full.sources].reverse(),
    chunks: [...full.chunks].reverse(),
    agentOutputs: [...(full.agentOutputs ?? [])].reverse(),
  };
  assert.equal(evidenceBundleContract.hash(reordered), h);
  // a material change to one chunk hash changes the bundle hash
  const mutated = clone(full);
  mutated.chunks[0]!.hash = sha256Hex("a different quote");
  assert.notEqual(evidenceBundleContract.hash(mutated), h);
});

// ── ACCEPTANCE: real sha256 of the quote, and NO raw secret/customer data durably ──

test("every chunk hash IS the real sha256 of its quoted span (kernel sha256Hex, no bespoke hash)", () => {
  for (const chunk of full.chunks) {
    const quote = RAW_CHUNK_QUOTES[chunk.chunkId];
    assert.ok(quote, `test is missing the raw quote for ${chunk.chunkId}`);
    assert.equal(chunk.hash, sha256Hex(quote!), `${chunk.chunkId} hash must be sha256(quote)`);
  }
});

test("every source hash IS the real sha256 of its full source text", () => {
  for (const source of full.sources) {
    const text = RAW_SOURCE_TEXTS[source.sourceId];
    assert.ok(text, `test is missing the raw text for ${source.sourceId}`);
    assert.equal(source.hash, sha256Hex(text!), `${source.sourceId} hash must be sha256(text)`);
  }
});

test("NO raw secret/customer text survives into the durable bundle values", () => {
  // the canonical string is exactly what gets hashed + persisted into the golden file
  const canonicalString = stableStringify(evidenceBundleContract.canonical(full));
  for (const text of [...Object.values(RAW_SOURCE_TEXTS), ...Object.values(RAW_CHUNK_QUOTES)]) {
    assert.ok(
      !canonicalString.includes(text),
      `canonical bundle must not carry raw source/quote text: ${text.slice(0, 40)}…`,
    );
  }
});

test("the committed golden file carries no raw source/quote text in the EvidenceBundle entries", () => {
  // Scope to THIS contract's pinned entries — other contracts (e.g. agent_output)
  // legitimately persist their own payloads; this proves the EvidenceBundle durable
  // values specifically carry only hashes + non-sensitive metadata, never raw text.
  const goldenPath = fileURLToPath(new URL("./contracts.golden.json", import.meta.url));
  const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as { vectors: Record<string, unknown> };
  const ours = Object.entries(golden.vectors)
    .filter(([key]) => key.startsWith(`${EVIDENCE_BUNDLE_SCHEMA}::`))
    .map(([, entry]) => entry);
  assert.ok(ours.length >= 1, "expected the EvidenceBundle vectors to be pinned in the golden file");
  const serialized = JSON.stringify(ours);
  for (const text of [...Object.values(RAW_SOURCE_TEXTS), ...Object.values(RAW_CHUNK_QUOTES)]) {
    assert.ok(
      !serialized.includes(text),
      `EvidenceBundle golden values must not carry raw text: ${text.slice(0, 40)}…`,
    );
  }
});
