/**
 * Regenerate contract golden files. Run deliberately (`pnpm regen:goldens`) after
 * a reviewed contract change — never just to turn a red test green.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { stableStringify } from "../packages/contracts/src/canonical-hash.ts";
import { CONTRACT_REGISTRY } from "../packages/contracts/src/registry.ts";

const vectors: Record<string, unknown> = {};
for (const entry of CONTRACT_REGISTRY) {
  for (const v of entry.vectors) {
    vectors[`${entry.schema}::${v.name}`] = {
      schema: entry.schema,
      purpose: v.purpose,
      input: v.input,
      canonical_string: stableStringify(entry.contract.canonical(v.input)),
      sha256: entry.contract.hash(v.input),
    };
  }
}

const golden = { _generator: "tools/regen-goldens.ts", vectors };
const out = fileURLToPath(
  new URL("../packages/contracts/test/contracts.golden.json", import.meta.url),
);
writeFileSync(out, JSON.stringify(golden, null, 2) + "\n");
console.log(`wrote contracts.golden.json (${Object.keys(vectors).length} vectors across ${CONTRACT_REGISTRY.length} contracts)`);
