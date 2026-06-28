# LIM-1232: Substrate Contract Package

**Status**: COMPLETE (PR ready)

## What this is

`packages/substrate/` — a versioned snapshot schema for agent consumption. Pre-built for post-hack agent-runs. Agents read substrate snapshots to verify governance state, chain corrections, and prove improvement over time.

No integrations here — pure schema + fixtures + tests.

## Files touched (only these, per spec)

- `packages/substrate/package.json` — package metadata
- `packages/substrate/src/index.ts` — exports
- `packages/substrate/src/substrate.contract.ts` — the Substrate contract (schema, canonical hash, golden vectors)
- `packages/substrate/src/fixtures.ts` — pre-built snapshot fixtures
- `packages/substrate/src/substrate.test.ts` — comprehensive tests

## What the Substrate contract encodes

A `Substrate` snapshot carries:
- `schema`: the shape of the payload (entity type, version tag)
- `commitHash`: git commit hash of the snapshot source
- `parentRef`: reference to a prior substrate (for replay/diff chains)
- `content`: the payload (AuditEvent, GovernanceCase, ActionGate, EvalCase, etc.)
- `timestamp`: when the snapshot was taken
- Optional fields: `tags`, `sourceSystem`, `integrity` (content hash + validation status)

## Fixtures

**ACME_SUBSTRATE_SEQUENCE** — a chain of 3 snapshots showing governance corrections:
1. `gc-detection`: governance case surfaced for dropped EU data residency
2. `enforcement-action`: correction enforced (status on-track → at-risk)
3. `eval-case`: second pass evaluates as pass (improvement proven)

**GOVERNANCE_LOOP_SUBSTRATE_CHAIN** — metadata linking the chain with step descriptions.

## Testing

All tests pass (`pnpm verify`):
- Schema validation (valid/invalid commit hash, version, timestamp)
- Optional fields allowed
- Safe parsing (no throwing on invalid input)
- Hash stability and change detection
- Canonical projection (snake_case normalization)
- Fixture validity and parent-chain integrity
- Governance loop metadata consistency

## Spine impact

**TOUCHES SPINE: false**. The substrate package is standalone — no demo spine changes, no persona names, no contract changes, no fixture drift. Ready for post-hack agent-runs to read substrate snapshots for governance loop replay/audit.

## Next steps (post-hack)

Agents will consume substrates to:
- Verify governance state without replaying the full loop
- Chain corrections via parent references
- Prove improvement over time (Fail → Pass eval cases)
- Audit the governance decisions with tamper-evidence (content hash integrity)
