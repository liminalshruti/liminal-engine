# RUN LEDGER — liminal-engine terminal-state loop — 2026-07-02

> SESSION B of the Opus parallel dispatch (`founder-brain/ops/OPUS_PARALLEL_DISPATCH_2026-07-02.md`).
> Walk-away loop engineer. Founder-authorized cleanup of the workspace's messiest repo.
> **PRESERVE-FIRST is absolute** — when in doubt, preserve to a `wip/` branch; never discard.
> Boundaries: never force-push · never delete a remote branch · no history rewrites ·
> submission content edits OUT of scope (integrity findings reported, not fixed).

## Grounding snapshot (start of loop)

- **Repo:** `liminal-engine` @ branch `docs/judge-ready-readme-submission`
- **Position vs `origin/main`:** 2 ahead / 7 behind (dispatch said 7-behind/2-ahead — matches)
- **Upstream:** GONE — `git fetch --prune` deleted `origin/docs/judge-ready-readme-submission`
  (and 4 other stale remote branches: `feat/github-pages-live`, `fix/deck-restyle-and-display-fonts`,
  `fix/load-brand-fonts`, `livekit-live-resubmit`). This branch is now local-only.
- **Dirty tree (6):** `packages/governance/package.json`, `pnpm-lock.yaml`, `specs/PITCH_AND_DEMO.md` (modified);
  `.shots/`, `specs/DEMO_NARRATION.md`, `specs/SUBMISSION_FORM_COPY.md` (untracked)
- **Stashes:** 5 (`stash@{0}`..`stash@{4}`)
- **Worktrees:** 47 entries (~46 agent-run worktrees + main checkout)

---

## STEP 1 — Dirty tree → terminal state

### Investigation (evidence before action)
- `packages/governance/package.json` + `pnpm-lock.yaml`: adds workspace deps
  `@liminal-engine/integration-requirement-store` + `@liminal-engine/signal-harness` to governance.
  **Both packages exist** (`packages/integrations/requirement-store`, `packages/signal-harness`).
  `origin/main` has **0** of these deps → this is net-new, valid build state. PRESERVE via commit.
- `specs/PITCH_AND_DEMO.md`: tracked, modified. My working copy diverges from `origin/main`'s copy by ~139 diff lines.
- `specs/DEMO_NARRATION.md` + `specs/SUBMISSION_FORM_COPY.md`: untracked on THIS branch but **tracked on `origin/main`**
  (merged via #139), and my working copies carry newer local edits. → Committing them here first is REQUIRED so the
  Step-4 merge is a clean 3-way instead of an "untracked would be overwritten" abort.
- `.shots/` (33 MB, 32 raw PNG screenshots): **unreferenced by any tracked doc**; repo tracks **zero** PNGs;
  `.gitignore:28` states the repo's own convention — *"Large demo media — keep curated assets, ignore raw captures."*
  → Disposition: these are raw captures. Add `.shots/` to `.gitignore` (extends the existing raw-capture block).
  Files stay on disk (nothing evaporates); tree goes clean; history stays un-bloated. Consistent with repo convention.

### Disposition
- All 5 doc/build files **belong to the current branch** (`docs/judge-ready-readme-submission`) by theme
  (judge-ready submission collateral + the governance build-state dep wiring). Committed to the current branch,
  NOT a fresh `wip/` branch (dispatch allows either; current branch is the honest home).
- `.shots/` → gitignored (raw captures), preserved on disk.

### Result ✅
- **Commit:** `c8c8939` "chore(submission): terminal-state dirty tree — collateral + governance dep wiring"
- **Witness:** `git status --short` = empty (clean tree). Pre-commit hooks: typecheck/boundaries skipped
  (no staged `.ts/.tsx`); `strip-ai-attribution` ran clean.
- `.shots/` (33 MB) preserved on disk, now gitignored — no longer surfaces as dirty.

---

## STEP 2 — Stashes (×5) → classified with evidence, preserve-first

Method: `git stash show -p --include-untracked` per stash → classify each file against `origin/main`
(present? absent? deliberately removed?) and the working tree. Two code-bearing stashes ({3},{4})
classified by parallel read-only Explore subagents + independent blob/commit verification.
**All 5 base commits confirmed still present** (955a3dc, 46af2f5, 0a61179, 2fb0054, a3bcd0c).

| stash | base | contents | verdict | evidence | disposition |
|---|---|---|---|---|---|
| `{0}` | 955a3dc | `demos/acme-call-transcript.txt`, 2× gemini `cache/*.json` (untracked-only) | **UNIQUE** (high) | all 3 files: not-on-main + absent-from-tree + not-gitignored. Exist nowhere else. | preserve → `wip/stash0-substrate-demo-fixtures` |
| `{1}` | 46af2f5 | `specs/CLAIM_SCAN_AUDIT.md`, `MERGE_INTEGRATION_REPORT.md`, `SESSION_GOAL_OVERNIGHT.md` (untracked-only) | **UNIQUE** (high) | all 3: not-on-main + absent-from-tree. Submission-audit + overnight-goal docs; archival value; recoverable nowhere else. | preserve → `wip/stash1-submission-audit-docs` |
| `{2}` | 0a61179 | `.claude/tmp/IMAC_LOOPS.md`, `specs/UI_FANOUT_PLAN.md`, `specs/launch-packets/LIM-1218-*.md` (untracked-only) | **UNIQUE** (high) | all 3: not-on-main + absent-from-tree. Planning/ops scratch; point-in-time but not captured. Preserve-first (never drop uncaptured). | preserve → `wip/stash2-ui-fanout-planning` |
| `{3}` | 2fb0054 | `packages/governance/src/{index,use-cases}.ts`, `CHANGELOG.md`, `SCOPE_SPEC.md` (tracked, +266/-56) | **UNIQUE-structure** (high) | Behavior (return all 6 loop artifacts via `GovernanceLoopResult`) IS on main. But main uses modular decomposition + barrel re-exports; stash INLINES the 6 phase fns into use-cases.ts — that structure is on main nowhere. Not byte-captured → preserve (archaeology, not for merge). | preserve → `wip/stash3-use-cases-consolidation` |
| `{4}` | a3bcd0c | `apps/desktop-demo/src/EnforceActionPanel.{tsx,css}`, `lib/enforce-handler.{ts,test.ts}`, `tsconfig.json`, `CHANGELOG.md`, `DEMO_CONTRACT.md` | **DEAD / superseded** (high) | `enforce-handler.ts`+`.test.ts` are ON MAIN at identical paths (only an ActionGate-v2 port evo: `isBlocked`→`decisionFor`). `EnforceActionPanel.tsx` was **deliberately deleted in commit `8b5ae0b`** ("LIM-1169: address review — drop LIM-1219-owned screen") as unwired, and superseded by `screens/EnforcementPanel.tsx` (#133 Cut-01). Nothing non-recoverable. | **documented DROP** — content retrievable via `git show a3bcd0c...` / stash reflog if ever needed; captured on main. |

Rule applied: captured/dead → document evidence THEN drop ({4}); everything else (uncaptured) → preserve, never drop.

_(branch pushes + drop witness appended after execution)_
