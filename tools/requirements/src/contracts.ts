/**
 * Single relative-import seam onto the shared contracts kernel.
 *
 * Tools live OUTSIDE the package graph, so (exactly like `tools/regen-goldens.ts`,
 * which imports `../packages/contracts/src/...`) this loader reaches the kernel by
 * relative path — NOT the `@liminal-engine/contracts` workspace alias, which is a
 * tsconfig `paths` mapping that the root `node_modules` does not link for `tools/`.
 *
 * We import the SPECIFIC source files we need (the EvidenceBundle contract + the
 * canonical hash) rather than the package barrel (`index.ts`). That deliberately
 * avoids pulling in `registry.ts` — a coordination file other agents edit
 * concurrently (per the task note) — so this loader never depends on, or rebases
 * against, churn in unrelated contracts.
 *
 * This loader is a CONSUMER of the EvidenceBundle contract (owned by LIM-1323). It
 * never modifies it: it normalizes real source material INTO a bundle and validates
 * the result through `evidenceBundleContract.parse`.
 */
export {
  EVIDENCE_BUNDLE_SCHEMA,
  evidenceBundleContract,
  evidenceBundleGoldenVectors,
  evidenceSourceType,
  evidenceSpanUnit,
  type EvidenceBundle,
  type EvidenceSource,
  type EvidenceChunk,
  type EvidenceSourceType,
  type EvidenceSpan,
  type EvidenceSpanUnit,
  type EvidenceAgentOutputRef,
} from "../../../packages/contracts/src/evidence-bundle.contract.ts";

export { sha256Hex } from "../../../packages/contracts/src/canonical-hash.ts";
