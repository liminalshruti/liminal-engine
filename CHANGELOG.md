# CHANGELOG — Liminal Engine — Agentic Work Governance MVP

> Hackathon: Liminal Engine Governance Hack 2026

All notable changes to scope, contract, and structure. Newest first.

## [Unreleased]

### Added — judging-map session (2026-06-27)
- **`JUDGING_MAP.md`** (LIM-1157) — maps every rubric criterion (Technicality 40%
  / Creativity 25% / Live Demo 20% / Future Potential 15%) and the required theme
  (primary **Self-Improvement Stack**, secondary **Continual Learning**) to a
  specific demo beat or artifact from `DEMO_CONTRACT.md`, plus an explicit
  coverage table flagging where the demo does not yet serve a criterion. No
  contract change — reads the locked path. Cross-linked from `SUBMISSION.md`.

### Changed — LIM-1165 Acme fixture set (2026-06-27 eve)
- Control harness (PR #1) **merged to `main`**.
- `packages/contracts/src/fixtures/acme.ts` — added `acmeDemoBeats`: verbatim
  DEMO_CONTRACT display copy for demo steps 2–4 (goal, false-green claim, dropped
  EU requirement), held separate from the contract-hashed fixture fields so on-screen
  wording matches the contract without changing any golden hash. Exposed `demoBeats`
  + `requiredOwners` on the single-source `acmeScenario`.
- `packages/contracts/test/acme-beats.test.ts` — new test locking beats 2–4 and the
  single-source invariant to the validated fixtures. No contract/golden change.

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
