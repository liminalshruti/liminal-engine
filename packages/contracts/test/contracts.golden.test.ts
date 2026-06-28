/**
 * Golden contract test (node --test). contracts.golden.json is the CONTRACT;
 * this pins it against the live impl. Any contract shape/canonical change breaks
 * this until `pnpm regen:goldens` is run deliberately — no silent drift.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { stableStringify } from "../src/canonical-hash.ts";
import { CONTRACT_REGISTRY } from "../src/registry.ts";

interface GoldenEntry {
  schema: string;
  purpose: string;
  input: unknown;
  canonical_string: string;
  sha256: string;
}
const golden: { vectors: Record<string, GoldenEntry> } = JSON.parse(
  readFileSync(fileURLToPath(new URL("./contracts.golden.json", import.meta.url)), "utf8"),
);

for (const entry of CONTRACT_REGISTRY) {
  for (const v of entry.vectors) {
    const key = `${entry.schema}::${v.name}`;
    const g = golden.vectors[key];

    test(`${key}: pinned in golden file`, () => {
      assert.ok(g, `missing golden vector ${key} — run \`pnpm regen:goldens\``);
    });
    test(`${key}: canonical string matches — ${v.purpose}`, () => {
      assert.equal(stableStringify(entry.contract.canonical(v.input)), g!.canonical_string);
    });
    test(`${key}: sha256 matches`, () => {
      assert.equal(entry.contract.hash(v.input), g!.sha256);
      assert.match(g!.sha256, /^[0-9a-f]{64}$/);
    });
  }
}
