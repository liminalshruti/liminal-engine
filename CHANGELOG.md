# CHANGELOG — Liminal Engine — Agentic Work Governance MVP

> Hackathon: Liminal Engine Governance Hack 2026

All notable changes to scope, contract, and structure. Newest first.

## [Unreleased]

### Added — scaffold session
- Project scaffold: docs, `apps/`, `packages/`, `ops/`, `demos/`, `retros/`.
- `DEMO_CONTRACT.md` locking the Acme false-green scenario, required demo path,
  must-not-cut and cut-if-risky lists, persona rule, acceptance criteria.
- `CLAUDE.md` build rules (static first, fixtures first, don't redesign, don't
  invent persona, don't make a dashboard the hero).
- `.claude/` dev environment: `settings.json` permissions + slash commands
  (`start-demo-spine`, `smoke`, `handoff`).
- `scripts/smoke.sh` — build/test runner + manual demo checklist.
- **MIT `LICENSE`** (copyright Shruti Rajagopal and contributors — entity not
  yet incorporated).

### Decided — scaffold session
- **Repo strategy:** publish as a **standalone PUBLIC MIT repo** rather than
  making the multi-project private parent public. Parent `hackathons/` retains
  history; standalone repo gives the cleanest net-new boundary.
