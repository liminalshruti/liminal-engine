/**
 * redact (governance audit-path application) — LIM-1248.
 *
 * The pure value→reference primitive lives in the contracts kernel
 * (`@liminal-engine/contracts` → `redact`); THIS module is the audit-path
 * application of it. It owns:
 *   - the POLICY: which top-level snapshot keys count as raw sensitive customer /
 *     EU-personal data (`SENSITIVE_AUDIT_KEYS`), and
 *   - the PROJECTION that redacts those keys inside an `AuditEvent`'s before/after
 *     state snapshots (`redactAuditSnapshot` / `redactAuditEventSnapshots`).
 *
 * It is applied at the audit-ledger WRITE boundary (`audit-ledger.ts` → `append`)
 * so the single append-only writer can never seal raw sensitive data into the hash
 * chain — the data-residency guarantee is STRUCTURAL, not by convention. Scoped to
 * `SENSITIVE_AUDIT_KEYS`, which is deliberately disjoint from the non-sensitive
 * structural keys the audit lifecycle already uses (governanceCase / evalCase /
 * evalResults / status / dealStatus / missedRequirement), so existing events are
 * untouched and their hashes stay stable.
 *
 * Re-exports the contracts primitive so callers alongside the audit-ledger have one
 * import (the issue named `packages/governance/src/redact.ts` as the helper's home).
 *
 * Boundary: imports `@liminal-engine/contracts` only (shared kernel).
 */
import { redact, isRedactedRef } from "@liminal-engine/contracts";

export {
  redact,
  isRedactedRef,
  verifyRedaction,
  REDACTION_SCHEME,
  REDACTION_PLACEHOLDER,
  type RedactedRef,
} from "@liminal-engine/contracts";

/**
 * Top-level snapshot keys treated as RAW sensitive customer / EU-personal data. A
 * value stored under one of these keys in an `AuditEvent` before/after snapshot is
 * sealed by redacted reference, never raw. Disjoint from the structural governance
 * metadata keys the lifecycle uses (governanceCase / evalCase / evalResults /
 * status / dealStatus / missedRequirement), so redaction never disturbs
 * reconstruction or the hashes of events that carry only structural state.
 */
export const SENSITIVE_AUDIT_KEYS = [
  "customerClaim",
  "customerData",
  "customerRecord",
  "personalData",
  "pii",
] as const;

/**
 * Redact the sensitive top-level keys of a before/after state snapshot. Non-sensitive
 * keys pass through untouched; values that are ALREADY redacted references are left
 * as-is (idempotent), so re-sealing a pre-redacted snapshot never double-hashes.
 * Returns a NEW record (the input is not mutated). The redacted reference's label is
 * the field key, which is a non-sensitive category, safe to surface.
 */
export function redactAuditSnapshot(
  snapshot: Record<string, unknown>,
  sensitiveKeys: readonly string[] = SENSITIVE_AUDIT_KEYS,
): Record<string, unknown> {
  const sensitive = new Set(sensitiveKeys);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(snapshot)) {
    out[key] = sensitive.has(key) && !isRedactedRef(value) ? redact(value, key) : value;
  }
  return out;
}

/**
 * Redact the `beforeState` / `afterState` snapshots of an AuditEvent-shaped payload
 * (the only fields that carry free-form, possibly-sensitive state). Other fields are
 * left untouched. Used by the audit-ledger writer so no raw sensitive value is ever
 * sealed into the chain.
 */
export function redactAuditEventSnapshots<
  T extends { beforeState?: Record<string, unknown>; afterState?: Record<string, unknown> },
>(event: T): T {
  const next: T = { ...event };
  if (event.beforeState !== undefined) next.beforeState = redactAuditSnapshot(event.beforeState);
  if (event.afterState !== undefined) next.afterState = redactAuditSnapshot(event.afterState);
  return next;
}
