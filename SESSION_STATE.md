# SESSION_STATE.md

Current state of the build, right now. Keep this short and true.

## As of: LIM-1236 PR-ready, inline dropped-requirement highlight (2026-06-28 night)

- **LIM-1236 branch:** `agent/LIM-1236-dropped-requirement-highlight` in
  `/Users/shayaunnejad/liminal/liminal-engine.worktrees/LIM-1236`.
- **Implemented:** AgentActivity and GovernanceCase now render a fixture-backed
  inline highlight for the dropped `EU data residency` requirement. Beat #3 shows
  the false-green claim `Acme expansion appears on track`; beats #4-#5 show the
  requirement present in the call and marked `Missing: EU data residency` beside
  the downstream agent output.
- **Verification:** `pnpm verify` green (93 tests + boundary lint),
  `./scripts/smoke.sh` green for automated tests, desktop-demo production build
  green, and a Vite SSR render check confirms both affected screens contain the
  highlight markers.
- **No contract drift:** no contract, fixture, or golden changes; no live calls on
  the demo spine; no invented persona name.
- **Status:** ready for PR review; never merge or move Linear to Done from the
  agent.

## As of: LIM-1234 preview branch ready for PR (2026-06-28)

- **LIM-1234 branch:** `agent/LIM-1234-compiled-enforcement-preview` adds
  `EnforcementPreview` under `apps/desktop-demo/src/components/`, exports it from
  the component barrel, and renders it on the routed enforcement panel before the
  enforce transition text. Beat #6 now shows the compiled `EnforcementAction`
  preview before Approve + Enforce. Verification is green: `pnpm typecheck:app`,
  desktop-demo build, `git diff --check`, `pnpm verify` (68 tests), and
  `./scripts/smoke.sh` automated tests.
- **LIM-1242 branch:** `agent/LIM-1242-audit-reconstruction-test` adds
  governance-local audit reconstruction support + tests. It verifies
  hash-chained AuditEvents and rebuilds the Acme GovernanceCase lifecycle from
  event snapshots only. `pnpm verify` is green with 64/64 tests; smoke automated
  tests are green. Pending PR/review; not merged.
- **Phase:** Backend governance loop is **DONE and on `main`**. The demo-spine
  **shell** is on `main`. Remaining critical path = **M1 per-beat screens** (wire
  the real loop output into the 14-step UI). 56/56 tests green on trunk.
- **Merged to `main`** (origin, in order): PR #1 control harness · PR #2 LIM-1165
  Acme fixtures · #3 LIM-1210 worktree workflow · #4 LIM-1163 demo-spine shell ·
  #5 LIM-1199 spec consolidation · #6 LIM-1163 apps boundary-lint (review Finding 1) ·
  **#7 LIM-1168 governance loop (M2) + eval Fail→Pass (M3)**. No open PRs.
- **M2/M3 (PR #7):** `packages/governance/src/use-cases.ts` — `detectMiss`,
  `enforceCorrection` (flips on-track→at-risk via engine-core's pure fn, emits
  EnforcementAction + AuditEvent), `gateDownstreamAction`, `runGovernanceLoop`.
  `packages/eval-harness` — `runEvals` (Fail p1 → Pass p2). In-memory port adapters
  in `packages/integrations/*` (governance-case-store, audit-sink, action-gate-store,
  eval-store, fixture-determinism). Deterministic via injected Clock/IdGen — no
  Date.now/randomness. Tests assert the loop reproduces the Acme fixtures
  byte-for-byte (must-not-cut #2/#3/#5/#6/#7). No contract change → goldens stable.
- **Shell (PR #4):** React 18 + Vite + TS SPA in `apps/desktop-demo/`; 14-step
  stepper bound to `acmeScenario`. Stack locked: **React-on-prototype-CSS**.
- **Spine guard (PR #6):** boundary lint now cruises `apps/` too — `apps/desktop-demo`
  → `packages/integrations/*` is mechanically forbidden (closed review Finding 1).
- **Open follow-ups:** LIM-1211 (Finding 1 — DONE via PR #6), LIM-1212 (wire app
  `.tsx` into the verify/CI typecheck gate — still open).
- **Harness:** pnpm/TS workspace; `packages/contracts` (7 hashed primitives + golden
  tests + Acme fixtures); boundary lint (incl. apps/); CI + hooks + PR template;
  worktree helper (`pnpm wt:new`). Commits = allsmog only (hook-enforced).
- **Scaffold:** All folders + docs + `.claude` dev env + `scripts/smoke.sh` created.
- **Official repo name:** `liminal-engine`.
- **Public repo:** ✅ Created and live — `github.com/liminalshruti/liminal-engine`
  (public, MIT). Clean standalone history beginning with the hackathon.
- **License:** MIT, copyright **Shruti Rajagopal and contributors**. No
  `Liminal, Inc.` claim remains anywhere in the repo.
- **Entity status:** Liminal is **not yet incorporated**. Do not use
  `Liminal, Inc.` in repo docs, license, package metadata, or submission copy
  until incorporation is complete.
- **Collaborator:** `allsmog` (Sean) invited with **push** access (invitation
  pending acceptance).
- **Source of truth:** This standalone public `liminal-engine` repo. (It was
  split out of a private `hackathons/` monorepo at setup time; that copy is
  historical only and must not be pushed — it is not the active version control.)
- **Demo path:** Locked in `DEMO_CONTRACT.md`. Backend loop implemented; UI shell
  up; **per-beat screens are the remaining piece**.
- **Persona:** Not extracted. Using generic operator language. Do not invent a name.

## Blocking / waiting

- Persona extraction from `liminal-prototype` pending (LIM-«persona», yellow).
- LIM-1212 open: app `.tsx` not yet in the `verify`/CI typecheck gate.

## Next concrete step

**M1 — per-beat screens (LIM-1166 + 1167).** Extend the existing
`apps/desktop-demo/` shell (do NOT rebuild) to render the real governance/eval
artifacts for each of the 14 beats: wire the app composition root to
`runGovernanceLoop` + `runEvals` over the in-memory adapters, render the
GovernanceCase / status flip / blocked action / AuditEvent / Fail→Pass table.
Pull verbatim display copy from `acmeScenario.demoBeats` (don't re-hardcode).
Panel components → `packages/ui-components` (LIM-1171/1172). This flips
`JUDGING_MAP.md` Technicality + Live Demo from Partial → Covered. Then
`./scripts/smoke.sh` + a fallback recording (LIM-1192/1197) before submission.
