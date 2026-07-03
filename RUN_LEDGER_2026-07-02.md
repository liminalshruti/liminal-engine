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

_(commit sha + witness appended after commit)_
