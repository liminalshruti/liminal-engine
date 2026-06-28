/**
 * Fixture fallback (LIM-1333 acceptance: "Fixture fallback remains available").
 *
 * When there is no real folder to ingest — a cold start, an offline check, a smoke
 * test — the loader can still emit a known-good `EvidenceBundle`. The fallback is
 * the EvidenceBundle contract's OWN pinned golden vector (`acme-eu-residency-
 * evidence`), re-validated through the contract, so:
 *   - it is the single source of truth (it cannot drift from the contract's golden),
 *   - it is deterministic (no clock / no I/O), and
 *   - it carries only content hashes + non-sensitive metadata — no raw text.
 *
 * This is an EXPLICIT mode (`requirements fixture`), never a silent catch for an
 * ingest error: a real-folder parse failure still fails loudly (AC: errors are
 * explicit). The fixture is the deterministic stand-in for the absence of real data,
 * mirroring the repo's "fixtures before integrations" posture.
 */
import {
  evidenceBundleContract,
  evidenceBundleGoldenVectors,
  type EvidenceBundle,
} from "./contracts.ts";

export const FIXTURE_NAME = "acme-eu-residency-evidence";

/** The deterministic fallback EvidenceBundle (the contract's pinned Acme golden). */
export function fixtureBundle(): EvidenceBundle {
  const vector = evidenceBundleGoldenVectors.find((v) => v.name === FIXTURE_NAME);
  if (vector === undefined) {
    throw new Error(
      `fixture vector "${FIXTURE_NAME}" not found in evidenceBundleGoldenVectors — the EvidenceBundle contract changed its golden set`,
    );
  }
  // Re-parse so the fallback is validated by the owning contract every time.
  return evidenceBundleContract.parse(vector.input);
}
