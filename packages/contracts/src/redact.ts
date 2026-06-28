/**
 * redact — the data-boundary / redaction primitive (LIM-1248).
 *
 * Maps a sensitive value to a non-reversible REFERENCE: a marker plus a
 * canonical-hash digest of the value. The digest is computed with the SAME
 * `canonicalHash` the rest of this kernel uses (NO new hash is invented), so a
 * redacted reference is reproducible and verifiable — an authorized holder of the
 * raw value can re-hash it and confirm the reference matches — while the raw value
 * itself is never carried. This is the EU-data-residency proof: sensitive customer /
 * personal data entering durable records (e.g. `AuditEvent` payloads) is stored by
 * reference/hash, never raw, so those records can be replicated/ported without
 * moving the underlying data.
 *
 * Pure + deterministic: same value → same reference; no clock, RNG, or I/O.
 *
 * WHY THIS LIVES IN `contracts` (the leaf kernel), not `governance`: it is a thin
 * projection over `canonicalHash`, which lives here, and it is needed by THREE
 * layers at once — the governance audit path, the apps UI, and the demo's
 * single-source Acme fixtures (which also live here and CANNOT import governance,
 * since `contracts` is the dependency leaf). Placing the primitive here lets all
 * three share ONE helper with no boundary break. The audit-path APPLICATION (which
 * snapshot fields count as sensitive, applied at the ledger write boundary) lives in
 * `packages/governance/src/redact.ts`. (The issue named governance as an example
 * location, "e.g."; this split honors that while respecting the layering.)
 */
import { canonicalHash } from "./canonical-hash.ts";

/** The hashing scheme a RedactedRef pins, so a verifier knows how to reproduce it. */
export const REDACTION_SCHEME = "canonical-sha256" as const;

/** Human-facing stand-in for a redacted value. Never the value itself. */
export const REDACTION_PLACEHOLDER = "[redacted]" as const;

/**
 * A redacted reference to a sensitive value. Carries NO raw data — only a
 * non-reversible canonical-hash digest, the scheme that produced it, and an
 * optional NON-sensitive label (a field category, e.g. "customer-claim") safe to
 * display.
 */
export interface RedactedRef {
  /** discriminant + marker; always true on a redacted reference. */
  readonly redacted: true;
  /** the scheme the digest was produced with (reuses `canonicalHash`). */
  readonly scheme: typeof REDACTION_SCHEME;
  /** canonical SHA-256 digest of the raw value — verifiable, not reversible. */
  readonly hash: string;
  /** a NON-sensitive category label for the field, safe to display (optional). */
  readonly label?: string;
}

/**
 * Type guard: is this value ALREADY a redacted reference? Used to keep `redact`
 * idempotent (so re-redacting, or sealing a pre-redacted snapshot, never
 * double-hashes a reference into a reference).
 */
export function isRedactedRef(value: unknown): value is RedactedRef {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.redacted === true && v.scheme === REDACTION_SCHEME && typeof v.hash === "string";
}

/**
 * Redact a sensitive value into a reference. Idempotent: a value that is ALREADY a
 * RedactedRef is returned unchanged. The digest is `canonicalHash(value)` — the
 * same canonical projection + SHA-256 the contracts use — so it ports identically
 * into the liminal-agents-v1 substrate.
 */
export function redact(value: unknown, label?: string): RedactedRef {
  if (isRedactedRef(value)) return value;
  return {
    redacted: true,
    scheme: REDACTION_SCHEME,
    hash: canonicalHash(value),
    ...(label !== undefined ? { label } : {}),
  };
}

/**
 * Verify a redacted reference against a candidate raw value: true iff re-hashing the
 * candidate reproduces the reference's digest. Lets an authorized holder of the raw
 * value PROVE a reference corresponds to it, without the reference ever exposing the
 * value.
 */
export function verifyRedaction(ref: RedactedRef, rawValue: unknown): boolean {
  return ref.hash === canonicalHash(rawValue);
}
