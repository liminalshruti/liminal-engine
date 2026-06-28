# CHANGELOG — Liminal Engine — Agentic Work Governance MVP

> Hackathon: Liminal Engine Governance Hack 2026

All notable changes to scope, contract, and structure. Newest first.

## [Unreleased]

### Fixed — SCOPE_SPEC.md: PolicyRule/ApprovalGate COVERED, not P0-build (LIM-1251, 2026-06-28)
- Last spec contradiction reconciled. `SCOPE_SPEC.md` still listed `PolicyRule` +
  `ApprovalGate` as "P0 entities to extend in contracts," but LIM-1251 / PR #26
  established they're **covered by existing contracts, no new build** (demo steps
  9/11 render from `EnforcementAction.actionType` `require_approval`/`activate_policy`
  + `AuditEvent` + `LinearWorkstreamPayload.requiredOwners`). SCOPE_SPEC now matches
  SPEC.md; first-class entities are post-hack. Docs-only.

### Added — LIM-1238 second-pass causal narration + checks table (2026-06-28)
- `apps/desktop-demo/src/screens/SecondPassEval.tsx` now renders beats #12-#14
  from Acme fixtures: EvalCase generated, improved second-pass output, causal
  narration, the shared EvalTable, and an explicit per-check before/after table
  showing `FAIL -> PASS`.
- `apps/desktop-demo/src/screens/SecondPassEval.model.ts` computes deterministic
  criterion-grouped before/after rows from eval-harness display rows. No contract,
  golden, or live-integration changes.

### Added — LIM-1235 3-part blocked-action card (2026-06-28)
- `apps/desktop-demo/src/components/BlockedActionBanner.tsx` now renders the
  blocked downstream customer update as an explicit 3-part card: `Not allowed`,
  `Why blocked`, and `Required before send` from `ActionGate.requiredBeforeSend`.
- `apps/desktop-demo/src/screens/EnforcementPanel.tsx` now renders the
  fixture-backed enforcement path for beats #6-#10: Approve + Enforce, On Track
  -> At Risk, simulated Linear workstream + required owners, attempted on-track
  customer update, and the blocked-action card. No live integrations or contract
  changes.
### Added — LIM-1234 compiled-enforcement preview (2026-06-28)
- `apps/desktop-demo/src/components/EnforcementPreview.tsx` — contract-typed preview
  of the compiled `EnforcementAction` objects queued for approval.
- `apps/desktop-demo/src/screens/EnforcementPanel.tsx` now renders the preview before
  the enforce transition text so demo beat #6 shows the rule set before
  Approve + Enforce. No contract or golden changes.

### Added — LIM-1242 audit reconstruction test (2026-06-27)
- `packages/governance/src/audit-reconstruction.ts` — verifies AuditEvent hash
  chains by recomputing `sha256(prevHash + canonical_json(event))` and rebuilds a
  GovernanceCase lifecycle from `beforeState`/`afterState` snapshots only.
- `packages/governance/src/audit-reconstruction.test.ts` — locks the Acme case
  reconstruction invariant (`open -> enforced -> closed`) and proves payload
  tampering invalidates the chain. No contract or golden changes.

### Decided — demo-spine UI stack (2026-06-27)
- **Demo-spine stack locked: React + Vite (SPA), styled against `liminal-prototype`
  CSS cuts.** Chosen over Solid/liminal-desktop continuity. Rationale: a throwaway
  3-minute demo spine is judged on the click-through and visual fidelity, not on
  sharing the product's framework. `liminal-desktop` is a Tauri app (heavyweight to
  run live); `liminal-prototype` ships its visual identity as **portable CSS**
  (`design-system/tokens/design-tokens.css` + cuts), liftable directly. Net-new
  per CLAUDE.md; adapted CSS marked `ADAPTED FROM`. Flips the demo-spine issue
  yellow→green.

### Added — demo-shell session (2026-06-27)
- **`apps/desktop-demo/`** stood up: React 18 + Vite + TS SPA shell. Vendored the
  canonical `design-tokens.css` from `liminal-prototype` (single source of truth,
  marked ADAPTED FROM). Renders an empty 14-step stepper frame against the Acme
  fixtures from `@liminal-engine/contracts` — the static click-through spine to be
  filled per `DEMO_CONTRACT.md`. No governance/eval logic yet (those are the next
  P0s).

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
