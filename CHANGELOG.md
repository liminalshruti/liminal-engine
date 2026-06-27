# CHANGELOG — Liminal Engine — Agentic Work Governance MVP

> Hackathon: Liminal Engine Governance Hack 2026

All notable changes to scope, contract, and structure. Newest first.

## [Unreleased]

### Added — control-harness session (2026-06-27)
- **Development control harness** layered onto the scaffold (additive; product
  locks untouched). Materialized the pnpm/TypeScript workspace.
- `packages/contracts` — the locked domain primitives as zod contracts with a
  canonical hash + golden tests (mirrors `liminal-agents-v1` substrate). Reconciled
  to the updated 14-step / **7 must-not-cut** demo contract: now **AgentOutput,
  GovernanceCase, EnforcementAction, AuditEvent, ActionGate, EvalCase, EvalResult**
  (added EnforcementAction + EvalCase; EvalResult links to EvalCase). Acme fixtures
  validate through the contracts and assert every must-not-cut invariant (incl.
  the Linear workstream's required Product/Security/Engineering owners + the
  `$1.2M ARR` business goal).
- `packages/{engine-core,governance,eval-harness,ui-components,integrations/*}` —
  hexagonal members; engine-core has the locked status state machine; integrations
  are fixture stubs (no live calls on the spine).
- Enforceable gates: `.dependency-cruiser.cjs` boundary lint (incl.
  `spine-no-live-integrations`), CI `conformance.yml`, lefthook hooks, PR template,
  conformance-matrix + linear-id checks. Verified the gates reject violations.
- `AGENTS.md` (complements CLAUDE.md) + nested package AGENTS.md + 5 agent roles;
  filled `ops/linear/AGENT_PACKETS.md` + `ops/linear/ISSUES.md`.

### Decided — control-harness session
- **Commits attributed to allsmog only, never Claude/AI** (lefthook + global hook).
- **Overnight agents are PR-only** (open PRs; never auto-merge / mark Done).

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
