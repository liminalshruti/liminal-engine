# Git worktrees — parallel agents without collisions

Multiple implementers run **at the same time** overnight. They cannot share one
working tree: a checkout holds exactly one branch/HEAD, so `git checkout -b` makes
parallel agents stomp each other's files, switch each other's branch mid-build, and
race on a shared `node_modules`. **Each parallel agent gets its own git worktree** —
an isolated checkout + branch + dependencies, all backed by the same `.git`.

> **The rule:** one worktree per *claimed* Linear issue, keyed on the Linear ID.
> This mirrors the `agent-claimed` mutex — one issue → one worker → one worktree →
> one `agent/<ID>-…` branch. Never run two agents in the same worktree; never let an
> agent work in the repo root (`main` stays clean as the green baseline).

## Use the helper (don't hand-roll `git worktree`)

```bash
pnpm wt:new LIM-1234 detect-dropped-requirement   # worktree + branch agent/LIM-1234-detect-dropped-requirement
cd ../liminal-engine.worktrees/LIM-1234
# ... implement the full slice, commit as you go ...
pnpm verify                                       # typecheck + test + boundary lint, before the PR
./scripts/smoke.sh                                # for demo-path work
# open the PR (PR-only — never merge). After a human merges in the morning:
pnpm wt:rm LIM-1234                               # remove the worktree; reclaim disk
pnpm wt:ls                                        # list all worktrees
```

`pnpm wt:new <LINEAR-ID> <short-desc>` does four things you must not skip:

1. **Pins hooks correctly** (`core.hooksPath` → absolute — see the gotcha below).
2. Creates the worktree at a **sibling** path `../liminal-engine.worktrees/<ID>` on a
   fresh `agent/<ID>-<desc>` branch off `main`.
3. **Copies `.env` / `.env.local`** in. These are gitignored, so a fresh worktree has
   none — issues that need secrets/config would otherwise fail.
4. Runs `pnpm install` (hardlinked from the pnpm store, so it's fast and cheap).

It **refuses if the worktree already exists** — a built-in second line of defense on
the mutex (if `../…worktrees/LIM-1234` exists, someone already claimed it).

## The hook gotcha this repo hit (and why setup is mandatory)

A **relative** `core.hooksPath` of `.git/hooks` resolves to `<worktree>/.git/hooks`
inside a linked worktree — a directory that does not exist (a worktree's `.git` is a
*file*). Hooks then silently no-op there, which **disables the commit-msg
AI-attribution strip (Hard Rule #1) and the pre-commit gates for every agent in a
worktree**. Verified: a commit with `Co-Authored-By: Claude …` made inside a worktree
kept the line.

The fix — applied by `pnpm install` (via `tools/setup-hooks.sh`) and re-asserted by
`pnpm wt:new` — pins `core.hooksPath` to the **absolute** shared hooks dir, which
resolves from the main repo and every worktree. Re-verified: the same commit now gets
the Claude line stripped. **Do not set `core.hooksPath` back to a relative path.**

## Why a sibling directory, not nested in the repo

Worktrees live in `../liminal-engine.worktrees/<ID>`, outside the repo tree, on
purpose: `pnpm test` globs `packages/**` and `pnpm lint:boundaries` runs `depcruise
packages`. A worktree nested inside the repo would be double-scanned (and could trip
the boundary lint on another issue's in-progress code). Keep them siblings.

## Lifecycle & hygiene

| When | Do |
|---|---|
| Claim a green issue | `pnpm wt:new <ID> <desc>` (after assigning + `agent-claimed` in Linear) |
| Working | commit progress in the worktree; checkpoint via `/handoff` |
| PR ready | open the PR from the `agent/<ID>-…` branch — **never merge** |
| Human merged (morning) | `pnpm wt:rm <ID>`, then `git branch -D agent/<ID>-…` |
| Stale/orphaned entries | `git worktree prune` (also run by `wt:rm`) |

- `pnpm wt:rm` **refuses to remove a dirty worktree** — that's deliberate (Hard Rule
  #3: never destroy uncommitted work). Commit progress or formally block first.
- Each worktree has its **own** `node_modules` and `.env`. Editing a contract or doc
  in one worktree does not affect another until merged to `main`.
- The shared pnpm store means N worktrees cost little disk for dependencies; the
  checkout itself is small. Removing a merged worktree promptly keeps the sibling dir
  tidy.

## Quick reference

```bash
pnpm wt:new LIM-1234 short-desc   # claim → isolated worktree on agent/LIM-1234-short-desc
pnpm wt:ls                        # what's checked out where
pnpm wt:rm  LIM-1234             # after the PR merges
```

See also: `AGENTS.md` (Parallel agents — one git worktree per issue),
`.claude/agents/implementer.md` (per-issue protocol).
