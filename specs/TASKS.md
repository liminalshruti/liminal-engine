# TASKS.md — consolidated parallel build units (canonical task list)

Derived from `specs/SPEC.md`, pinned to `DEMO_CONTRACT.md` (beats `#N`, must-not-cut
`MNC#N`) and `JUDGING_MAP.md`. **This is the single canonical task list** — file it
as `LIM-` issues under **LIM-1199** and dispatch one agent per task (each in its own
worktree, `pnpm wt:new <ID> <slug>`; see `WORKTREES.md`).

**Maximally parallel by construction:** every task owns a **disjoint file set** (the
no-collision rule), so all tasks in a wave run concurrently. Two foundation tasks
unblock everything; then ~15 tasks fan out. Real `LIM-####` IDs are assigned on
creation — the `«slug»` is stable.

Labels: `nightly` + `agent-ready-green` unless marked **YELLOW** (needs a human
decision first) or **HUMAN** (not an agent task).

---

## Wave 1 — Foundation (2 tasks; must land before their dependents)

| Slug | Owns (disjoint) | Deliverable | Beats / MNC | Blocks | Label |
|---|---|---|---|---|---|
| **«contracts»** | `packages/contracts/src/*` (+`registry.ts`,`index.ts`,goldens,`test/*`) | Add `DriftSignal`, `CorrectionEvent`, `LinearWorkstreamPayload` contracts; extend `GovernanceCase` (businessImpact/missingFrom/evidenceIds/dominantSignal/recommendedActions), `EnforcementAction` (actionType enum + matcher/effect + scope + versioning), `AuditEvent` (before/after + ids + prevHash). See `specs/IDEAS.md`. `pnpm regen:goldens` | underpins #5–#14, MNC#2–#7 | all engine tasks | green |
| **«spine-shell»** | `apps/desktop-demo/{package.json,index.html,src/App.*,src/main.*,src/lib/*}` | App shell + routing (7 screens, no extra nav) + fixture loader + view-model layer reading `@liminal-engine/contracts/fixtures` | #1 scaffold | all screen tasks | **YELLOW** (UI stack: Solid / React / Vite-vanilla) |

## Wave 2 — Engine fan-out (6 tasks, parallel; depend on «contracts»)
Each owns ONE file in its package (+ its test). Shared `packages/governance/src/ports.ts`
is read-only/stable; `index.ts` gets one `export *` line per task (trivial coordination).

| Slug | Owns | Deliverable | Beats / MNC |
|---|---|---|---|
| **«gov-detect»** | `packages/governance/src/detect-miss.ts` (+test) | deterministic-first detectors (taxonomy incl. `conflict_with_prior_correction`) → `DriftSignal[]` → `GovernanceCase` w/ evidence + `missingFrom[]`; explicit case-open threshold | #3,#4,#5 · MNC#1,#2 |
| **«gov-correct»** | `packages/governance/src/compile-correction.ts` (+test) | pure-function correction compiler: constrained templates + phrase→action table → `EnforcementAction[]`; reject vague corrections; preview-before-activate (see `specs/IDEAS.md`) | #5→#6 |
| **«gov-enforce»** | `packages/governance/src/enforce.ts` (+test) | atomic Approve+Enforce: status flip, owner reqs, Linear payload, proxy register, AuditEvent, EvalCase trigger | #6,#7,#8,#9,#11 · MNC#3,#4,#6 |
| **«gov-proxy»** | `packages/governance/src/proxy-gate.ts` (+test) | block "mark on track"/"send on-track update" → `ActionGate` w/ reasons + requiredBeforeSend | #10 · MNC#5 |
| **«gov-secondpass»** | `packages/governance/src/second-pass.ts` (+test) | re-run under active gate → improved at-risk output | #13 |
| **«eval»** | `packages/eval-harness/src/*` (+test) | generate `EvalCase` from correction; `runEvals` → `EvalResult` Fail→Pass on checks | #12,#14 · MNC#7 |
| **«linear»** | `packages/integrations/linear/src/*` (+test) | deterministic `LinearWorkstreamPayload` (project + 6 issues + owners) behind `LinearWorkstreamPanel` | #8,#9 · MNC#4 |
| **«audit-ledger»** | `packages/governance/src/audit-ledger.ts` (+test) | hash-chained append-only `AuditEvent` writer (`prevHash`+`eventHash`) emitted in-tx; reconstruct-case-from-events verifier (see `specs/IDEAS.md`) | #11 · MNC#6 |

## Wave 2 — Screen fan-out (7 + 1, parallel; depend on «spine-shell»)
One screen file each → fully disjoint. Shared widgets land in «components» (land it
first in this wave, or screens own their own widgets).

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
| **«persona»** | demo copy strings only | extract persona from `liminal-prototype`; replace generic operator copy | **YELLOW** |
| **«publish»** | `demos/fallback/*`, `SUBMISSION.md` | fallback recording + final submission check | **HUMAN** |

---

## Dependency DAG (what can run at once)

```
Wave 1:  «contracts» ┐        «spine-shell» ┐         (2 agents, parallel)
                     │                       │
Wave 2:  ┌───────────┴──────────┐   ┌────────┴───────────────┐
         gov-detect  gov-enforce │   components → screen-*×7  │   (up to ~16 agents parallel)
         gov-correct gov-proxy
         gov-secondpass  eval
         linear      audit-ledger
                     │                       │
Wave 3:              └─────── e2e ───────────┘   persona(YELLOW)   publish(HUMAN)
```

- **Peak parallelism:** ~16 agents in Wave 2 (8 engine + components + 7 screens, once
  the 2 foundation tasks merge).
- **Mutex:** one agent per task, one git worktree per task (`pnpm wt:new`), disjoint
  owned files. The night-captain only releases a task whose dependencies have merged.
- **Coordination points (small):** `packages/governance/src/index.ts` (+1 export line
  per engine task) and the screen router registration in the shell — keep these append-only.

## How to run (per `docs/overnight-loop.md` / `WORKTREES.md`)
1. File these as `LIM-` issues (thin wrappers → this file + `DEMO_CONTRACT.md`).
2. Night-captain labels Wave-1 green; on their merge, labels Wave-2 green; etc.
3. Each implementer: `pnpm wt:new LIM-xxx <slug>` → build its disjoint files →
   `pnpm verify` → PR (conformance + acceptance matrices) → reviewers gate → you merge.
4. PR-only; never auto-merge.
