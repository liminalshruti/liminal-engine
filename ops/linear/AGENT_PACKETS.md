# Linear — Agent Packets

> **Superseded by [`specs/TASKS.md`](../../specs/TASKS.md) — the single canonical
> task list.** The coarse 5-packet breakdown that used to live here was refined into
> finer, file-disjoint **Wave** tasks (e.g. `packages/governance/src/**` split into
> `gov-detect` / `gov-enforce` / `gov-proxy` / `gov-secondpass`; `apps/desktop-demo/**`
> split into a shell + 7 screens) so more agents can run in parallel without
> colliding. Don't maintain a second list here — edit `specs/TASKS.md`.

## The packet rule (unchanged, applies to every task in TASKS.md)
- One agent per task; **one git worktree per task** (`pnpm wt:new <ID> <slug>`; see
  `WORKTREES.md`).
- Each task owns a **disjoint file set** — the mutex against merge conflicts.
- Acceptance maps to `DEMO_CONTRACT.md` (`#N` beats / `MNC#N`) and `JUDGING_MAP.md`.
- Must NOT: redesign the loop · invent a persona · dashboard-as-hero · live call on
  the demo spine · touch another task's owned files.

See `specs/SPEC.md` for HOW (architecture + domain mapping) and `specs/TASKS.md`
for the dependency DAG + parallel waves.
