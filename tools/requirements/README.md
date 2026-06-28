# `requirements` — live-source loaders (LIM-1333)

Ingest REAL source material — call transcripts, proposals, SOWs, emails, Slack,
Linear, agent outputs — from a local folder into ONE cited, content-addressed
[`EvidenceBundle`](../../packages/contracts/src/evidence-bundle.contract.ts) JSON.
The bundle is the provenance substrate the rest of the system points at: every
chunk carries a stable `(sourceId, sourceType, span, hash)` citation, so any claim
downstream can be traced to where it was actually stated.

This tool is a **consumer** of the `EvidenceBundle` contract (owned by LIM-1323). It
only normalizes source material into a bundle and validates the result through the
contract — it never modifies the contract, and it never activates requirements
(loaders produce cited chunks, nothing more).

## Usage

The repo convention is to run tools with `node tools/<file>.ts` (cf.
`tools/regen-goldens.ts`):

```bash
# Ingest a real local folder -> EvidenceBundle JSON on stdout
node tools/requirements/cli.ts ingest ./examples/acme-real/

# Write to a file instead of stdout
node tools/requirements/cli.ts ingest ./examples/acme-real/ --out bundle.json

# Deterministic fixture fallback (the pinned Acme golden) — no folder needed
node tools/requirements/cli.ts fixture

# Help
node tools/requirements/cli.ts help
```

`stdout` carries ONLY the bundle JSON (pipeable); the human-readable summary and all
errors go to `stderr`. The file is executable, so `./tools/requirements/cli.ts
ingest …` also works.

## Folder layout

Drop files into type folders (the arbitrary-data-friendly convention), or rely on
known extensions, or declare types in `manifest.json`:

| Folder        | Extensions                | Source type     | Span unit  |
| ------------- | ------------------------- | --------------- | ---------- |
| `calls/`      | `.vtt`, `[HH:MM:SS]` text | `customer_call` | `timecode` |
| `proposals/`  | `.md`, `.txt`             | `proposal`      | `section`/`line` |
| `sow/`        | `.md`, `.txt`             | `sow`           | `section`/`line` |
| `emails/`     | `.eml`, `.mbox`           | `email`         | `message`  |
| `slack/`      | `.slack.json`             | `slack`         | `message`  |
| `linear/`     | `.linear.json`            | `linear`        | `section`  |
| `agent/`      | `.agent.json`             | `agent_output`  | `line`     |

### `manifest.json` (optional, makes a folder self-describing)

```json
{
  "id": "eb_acme_real",
  "goalId": "goal_acme_expansion",
  "dealId": "deal_acme",
  "capturedAt": "2026-06-27T09:30:00.000Z",
  "sources": { "calls/acme-kickoff.vtt": { "title": "Acme expansion kickoff call" } }
}
```

A bundle MUST be scoped (`goalId` and/or `dealId`), via the manifest or
`--goal`/`--deal`. `capturedAt` is taken from the manifest/flag so a folder ingests
**deterministically** (re-running produces a byte-identical bundle); without it, it
defaults to ingest time.

## Guarantees (the acceptance criteria)

1. **Local-folder loader works first** — `ingest ./examples/acme-real/` produces a
   contract-valid EvidenceBundle with all seven source types.
2. **Stable source refs** — every chunk has `sourceId` + `sourceType` (via its
   source) + `span` + `hash = sha256(span text)`; every source has
   `hash = sha256(normalized text)`. Ids are derived from path + position, so they
   are reproducible across runs.
3. **Explicit parser errors, never silent drops** — unclassifiable files, malformed
   inputs, empty sources, and missing scope are NAMED errors. The default posture is
   FAIL-CLOSED (any failure aborts with the full list); `--skip-errors` keeps the
   good sources but still reports every failure.
4. **Fixture fallback remains available** — `requirements fixture` (and
   `ingest --fallback-fixture` for a sourceless folder) emit the EvidenceBundle
   contract's own pinned golden bundle, deterministically.

## Data boundary

The bundle stores raw quoted text **by reference**: only sha256 content hashes +
non-sensitive metadata (title, structural `label`, span locator) are persisted. Raw
source text exists only in memory to compute hashes — it never lands in the durable
bundle. (Proven in `test/examples.test.ts`.)

## Tests

These live outside the package graph, so they run via an explicit command (the same
way `tools/validate-conformance.test.mjs` does):

```bash
node --test "tools/requirements/test/**/*.test.ts"
```

`pnpm typecheck` (repo root) type-checks this tool, since `tsconfig.json` includes
`tools/**/*.ts`.
