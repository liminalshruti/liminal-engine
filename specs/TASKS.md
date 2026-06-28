# TASKS.md — consolidated parallel build units (canonical task list)

Derived from `specs/SPEC.md`, pinned to `DEMO_CONTRACT.md` (beats `#N`, must-not-cut
`MNC#N`) and `JUDGING_MAP.md`. **This is the single canonical task list** — file it
as `LIM-` issues under **LIM-1199** and dispatch one agent per task (each in its own
worktree, `pnpm wt:new <ID> <slug>`; see `WORKTREES.md`).

**Maximally parallel by construction:** every task owns a **disjoint file set** (the
no-collision rule), so all tasks in a wave run concurrently. Three foundation tasks
(which pre-create all shared files) unblock everything; then ~15 tasks fan out. Real
`LIM-####` IDs are assigned on creation — the `«slug»` is stable.

Labels: `nightly` + `agent-ready-green` unless marked **YELLOW** (needs a human
decision first) or **HUMAN** (not an agent task).

---

## Wave 1 — Foundation (3 tasks; must land before their dependents)

These pre-create every **shared/coordination file** so Wave-2 tasks only ever *fill
a stub they exclusively own* — never append to a barrel, router, or ports file in
parallel. That is what makes the fan-out collision-free.

| Slug | Owns (disjoint) | Deliverable | Blocks | Label |
|---|---|---|---|---|
| **«contracts»** | `packages/contracts/src/**` (incl. `fixtures/`, `registry.ts`, `index.ts`, goldens, `test/*`) | Add `CorrectionEvent` + `LinearWorkstreamPayload`; extend `GovernanceCase` (businessImpact/missingFrom/evidenceIds/recommendedActions + status lifecycle), `EnforcementAction` (fixed `actionType` enum + targetSystem/payload + scope + versioning), `AuditEvent` (before/after + evidence/action/eval ids + affectedSystems + prevHash), `ActionGate` (reasons[]/requiredBeforeSend[], derive `allowed`). **Exactly matches the `SPEC.md` mapping table.** `pnpm regen:goldens` | all engine tasks | green |
| **«gov-scaffold»** | `packages/governance/src/{ports.ts, index.ts}` + **stub** impl files (`detect-miss/compile-correction/enforce/proxy-gate/second-pass/audit-ledger.ts`) | Create the ports interface + the barrel that re-exports all six modules + empty typed stubs for each. Wave-2 gov tasks then FILL their one stub (no one edits `ports.ts`/`index.ts`). Depends on «contracts». | all `gov-*` tasks | green |
| **«spine-shell»** | `apps/desktop-demo/{package.json,index.html,src/App.*,src/main.*,src/lib/!(copy).*}` + **stub** `src/screens/*.{tsx}` | App shell + routing with **all 7 screen routes pre-registered** + fixture loader + view-model layer reading `@liminal-engine/contracts/fixtures` + empty stub screen files. Wave-2 screen tasks FILL their one screen (no one edits `App.*`). | all screen tasks | **YELLOW** (UI stack: Solid / React / Vite-vanilla) |

## Wave 2 — Engine fan-out (8 tasks, parallel; depend on «contracts» + «gov-scaffold»)
Each task **fills the one stub file it owns** (created by «gov-scaffold») + its test.
No task edits `ports.ts` or `index.ts` — those are done in Wave 1. Fully disjoint.

| Slug | Owns | Deliverable | Beats / MNC |
|---|---|---|---|
| **«gov-detect»** | `packages/governance/src/detect-miss.ts` (+test) | deterministic-first detectors (taxonomy incl. `conflict_with_prior_correction`) → emit a `GovernanceCase` directly w/ evidence + `missingFrom[]`; explicit case-open threshold (DriftSignal entity is STRETCH) | #3,#4,#5 · MNC#1,#2 |
| **«gov-correct»** | `packages/governance/src/compile-correction.ts` (+test) | pure-function correction compiler: constrained templates + phrase→action table → `EnforcementAction[]`; reject vague corrections; preview-before-activate (see `specs/IDEAS.md`) | #5→#6 |
| **«gov-enforce»** | `packages/governance/src/enforce.ts` (+test) | atomic Approve+Enforce: status flip, owner reqs, Linear payload, proxy register, AuditEvent, EvalCase trigger | #6,#7,#8,#9,#11 · MNC#3,#4,#6 |
| **«gov-proxy»** | `packages/governance/src/proxy-gate.ts` (+test) | block "mark on track"/"send on-track update" → `ActionGate` w/ reasons + requiredBeforeSend | #10 · MNC#5 |
| **«gov-secondpass»** | `packages/governance/src/second-pass.ts` (+test) | re-run under active gate → improved at-risk output | #13 |
| **«eval»** | `packages/eval-harness/src/*` (+test) | generate `EvalCase` from correction; `runEvals` → `EvalResult` Fail→Pass on checks | #12,#14 · MNC#7 |
| **«linear»** | `packages/integrations/linear/src/*` (+test) | deterministic `LinearWorkstreamPayload` (project + 6 issues + owners) behind `LinearWorkstreamPanel` | #8,#9 · MNC#4 |
| **«audit-ledger»** | `packages/governance/src/audit-ledger.ts` (+test) | hash-chained append-only `AuditEvent` writer (`prevHash`+`eventHash`) emitted in-tx; reconstruct-case-from-events verifier (see `specs/IDEAS.md`) | #11 · MNC#6 |

## Wave 2 — Screen fan-out (depend on «spine-shell»; «components» is Wave-2a, lands first)
Each screen task FILLS the one stub screen file «spine-shell» pre-created (routes are
already registered there — screens never edit `App.*`). Shared widgets are
**«components»**, a brief Wave-2a task the 7 screens depend on.

| Slug | Owns | Beats / MNC |
|---|---|---|
| **«components»** | `apps/desktop-demo/src/components/*` (StatusBadge, EvalTable, LinearPayloadView, BlockedActionBanner, Card, TraceRow) | (shared) |
| **«screen-initialize»** | `…/src/screens/Initialize.*` | #1,#2 |
| **«screen-context-tray»** | `…/src/screens/ContextTray.*` | context cards |
| **«screen-agent-activity»** | `…/src/screens/AgentActivity.*` | #3 · MNC#1 |
| **«screen-governance-case»** | `…/src/screens/GovernanceCase.*` | #4,#5 · MNC#2 |
| **«screen-enforcement-panel»** | `…/src/screens/EnforcementPanel.*` | #6,#7,#8,#9,#10 · MNC#3,#4,#5 |
| **«screen-audit-trail»** | `…/src/screens/AuditTrail.*` | #11 · MNC#6 |
| **«screen-second-pass-eval»** | `…/src/screens/SecondPassEval.*` | #12,#13,#14 · MNC#7 |

## Wave 3 — Integration & proof (depend on Waves 1–2)

| Slug | Owns | Deliverable | Label |
|---|---|---|---|
| **«e2e»** | `apps/desktop-demo/test/*`, `tests/*` | click-through e2e of the 14-step path + align `scripts/smoke.sh` checklist | green (after spine) |
| **«persona»** | `apps/desktop-demo/src/lib/copy.ts` (the single demo-copy module — owned only here) | extract persona from `liminal-prototype`; replace generic operator copy in `copy.ts` only (screens import from it) | **YELLOW** |
| **«publish»** | `demos/fallback/*`, `SUBMISSION.md` | fallback recording + final submission check | **HUMAN** |

---

## Dependency DAG (what can run at once)

```
Wave 1:  «contracts» → «gov-scaffold»   «spine-shell»   (3 foundation tasks)
                     │                       │
Wave 2:  ┌───────────┴──────────┐   ┌────────┴───────────────┐
         gov-detect  gov-enforce │   components → screen-*×7  │   (up to ~16 agents parallel)
         gov-correct gov-proxy
         gov-secondpass  eval
         linear      audit-ledger
                     │                       │
Wave 3:              └─────── e2e ───────────┘   persona(YELLOW)   publish(HUMAN)
```

- **Peak parallelism:** ~15 agents (8 engine + 7 screens) once the 3 foundation tasks
  + the brief Wave-2a «components» merge.
- **Mutex:** one agent per task, one git worktree per task (`pnpm wt:new`), disjoint
  owned files. The night-captain only releases a task whose dependencies have merged.
- **No shared-write coordination:** the governance barrel (`index.ts`), `ports.ts`,
  the screen router (`App.*`), and every stub file are pre-created in Wave 1
  («gov-scaffold» / «spine-shell»). Wave-2 tasks only fill stubs they exclusively
  own → zero parallel writes to a shared file (the integration-review fix).

## How to run (per `WORKTREES.md` + `.claude/agents/night-captain.md`)
1. File these as `LIM-` issues (thin wrappers → this file + `DEMO_CONTRACT.md`).
2. Night-captain labels Wave-1 green; on their merge, labels Wave-2 green; etc.
3. Each implementer: `pnpm wt:new LIM-xxx <slug>` → build its disjoint files →
   `pnpm verify` → PR (conformance + acceptance matrices) → reviewers gate → you merge.
4. PR-only; never auto-merge.
