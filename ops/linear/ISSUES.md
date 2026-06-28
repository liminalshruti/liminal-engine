# Linear — Issue drafts (thin wrappers)

> **The canonical task list is [`specs/TASKS.md`](../../specs/TASKS.md).** File each
> row there as a `LIM-` issue under the umbrella **LIM-1199** ("[HITL] Demo Harness
> Lock Before Overnight Agents"). This file no longer keeps a parallel list (it used
> to hold coarse `LIM-«spine/gov/eval»` drafts — now refined into the Wave tasks in
> TASKS.md). Keeping one list is how all specs stay in agreement.

## Filing convention
- **Title:** `LIM-<id>: <slug from TASKS.md>` (real `LIM-` ids assigned on creation).
- **Body:** thin wrapper — link the task row in `specs/TASKS.md`, `specs/SPEC.md`,
  and the relevant `DEMO_CONTRACT.md` beats (`#N`) / must-not-cut (`MNC#N`).
- **Branch:** `chore/lim-<id>-<slug>` (the `linear-id` CI gate matches `LIM-<n>` in
  branch or title).
- **Labels:** `nightly` + `agent-ready-green`, unless TASKS.md marks the task
  **YELLOW** (`agent-ready-yellow` — needs a human decision) or **HUMAN**
  (`human-only`). The night-captain promotes a Wave's tasks to green only once the
  Wave it depends on has merged (see the DAG in TASKS.md).

## Dispatch
Per `docs/overnight-loop.md` + `WORKTREES.md`: one agent per task, one worktree per
task (`pnpm wt:new <id> <slug>`), PR-only. Peak parallelism is Wave 2 (~13 tasks).
