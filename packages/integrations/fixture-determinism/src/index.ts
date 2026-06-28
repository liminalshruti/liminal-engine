/**
 * Deterministic Clock + IdGen for the demo spine — FIXTURE STUB. Reproduces the
 * locked Acme fixture IDs and timestamps in the exact call order that
 * runGovernanceLoop consumes them, so the loop's output matches
 * @liminal-engine/contracts/fixtures byte-for-byte (no Date.now / randomness on
 * the spine). A live composition root would inject real generators instead.
 *
 * Call order in runGovernanceLoop (keep in sync):
 *   ids:   gc_acme_eu, ea_acme_enforce, ae_acme_1, ag_acme_update,
 *          ec_acme_eu, ev_acme_p1, ev_acme_p2
 *   times: 10:00 (detected), 10:04 (enforced), 10:05 (recorded), 10:06 (evalCase)
 */
import type { Clock, IdGen } from "@liminal-engine/governance";

/** Yields a fixed sequence; throws if drained (signals call-order drift). */
function sequence(label: string, values: readonly string[]): () => string {
  let i = 0;
  return () => {
    if (i >= values.length) {
      throw new Error(`fixture ${label} exhausted at ${i} — call order drifted`);
    }
    return values[i++]!;
  };
}

export const ACME_FIXTURE_IDS = [
  "gc_acme_eu",
  "ea_acme_enforce",
  "ae_acme_1",
  "ag_acme_update",
  "ec_acme_eu",
  "ev_acme_p1",
  "ev_acme_p2",
] as const;

export const ACME_FIXTURE_TIMES = [
  "2026-06-27T10:00:00.000Z", // detectedAt
  "2026-06-27T10:04:00.000Z", // enforcedAt
  "2026-06-27T10:05:00.000Z", // recordedAt
  "2026-06-27T10:06:00.000Z", // evalCase createdAt
] as const;

export function createAcmeIdGen(): IdGen {
  const next = sequence("ids", ACME_FIXTURE_IDS);
  return { next };
}

export function createAcmeClock(): Clock {
  const next = sequence("times", ACME_FIXTURE_TIMES);
  return { now: next };
}
