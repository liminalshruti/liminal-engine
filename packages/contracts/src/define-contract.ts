/**
 * defineContract — the unit of cross-context coupling.
 *
 * A Contract is the ONLY sanctioned way one bounded context may depend on data
 * owned by another (the .dependency-cruiser.cjs `no-cross-context` rule forbids
 * importing another context's internals — contracts/ is the shared kernel).
 *
 * Each contract bundles:
 *   - `schema`     a version-tagged id (e.g. "harness.example_task.v1")
 *   - `parse`      runtime validation at the boundary (zod) — adapters MUST parse
 *                  untrusted input through this
 *   - `canonical`  a deterministic projection (embeds the schema tag) — what gets hashed
 *   - `hash`       canonical SHA-256, pinned by a golden test so a contract change
 *                  cannot land silently (CI fails until the golden is regenerated)
 *
 * Changing a contract's shape => its hash changes => its golden test fails =>
 * the PR cannot pass CI without a deliberate `pnpm regen:goldens` + review. That
 * is the mechanical "no silent contract drift" gate.
 */

import type { z } from "zod";
import { canonicalHash } from "./canonical-hash.ts";

export interface ContractDef<TShape extends z.ZodTypeAny, TCanonical> {
  /** version-tagged schema id, e.g. "harness.example_task.v1" */
  schema: string;
  /** zod schema validating the runtime payload at boundaries */
  shape: TShape;
  /** deterministic projection of a valid value -> the object that gets hashed (must embed `schema`) */
  canonical: (value: z.infer<TShape>) => TCanonical;
}

export interface Contract<TShape extends z.ZodTypeAny, TCanonical> {
  readonly schema: string;
  /** validate untrusted input; throws on mismatch */
  parse: (input: unknown) => z.infer<TShape>;
  /** validate untrusted input; never throws */
  safeParse: (input: unknown) => z.SafeParseReturnType<unknown, z.infer<TShape>>;
  /** deterministic canonical projection (schema-tagged) */
  canonical: (value: z.infer<TShape>) => TCanonical;
  /** canonical SHA-256 of the value — stable across key order, gated by a golden test */
  hash: (value: z.infer<TShape>) => string;
}

export function defineContract<TShape extends z.ZodTypeAny, TCanonical>(
  def: ContractDef<TShape, TCanonical>,
): Contract<TShape, TCanonical> {
  return {
    schema: def.schema,
    parse: (input) => def.shape.parse(input),
    safeParse: (input) => def.shape.safeParse(input),
    canonical: def.canonical,
    hash: (value) => canonicalHash(def.canonical(value)),
  };
}
