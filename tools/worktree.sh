#!/usr/bin/env bash
# Git worktree manager for PARALLEL overnight agents. See WORKTREES.md.
#
# Why: implementers run N-at-a-time. A single working tree can hold only one
# branch/HEAD, so `git checkout -b` makes parallel agents clobber each other.
# Each worktree is an isolated checkout + branch + node_modules. One worktree per
# claimed Linear issue (this mirrors the `agent-claimed` mutex — see AGENTS.md).
#
# Layout: worktrees live in a SIBLING dir (../<repo>.worktrees/<LINEAR-ID>), never
# nested inside the repo, so `pnpm test` (globs packages/**) and `depcruise
# packages` don't double-scan them.
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
wt_root="$(dirname "$repo_root")/$(basename "$repo_root").worktrees"

usage() {
  cat <<'EOF'
Git worktrees for parallel agents (WORKTREES.md)

  pnpm wt:new <LINEAR-ID> <short-desc>   create worktree + branch agent/<ID>-<desc>,
                                         copy .env, install deps
  pnpm wt:rm  <LINEAR-ID>                remove the worktree (refuses if dirty; keeps the branch)
  pnpm wt:ls                             list worktrees

Examples:
  pnpm wt:new LIM-1234 detect-dropped-requirement
  pnpm wt:rm  LIM-1234
EOF
}

# A RELATIVE core.hooksPath (.git/hooks) does not resolve inside a linked worktree
# (its .git is a file, not a dir), which silently disables the commit-msg
# AI-attribution strip (AGENTS.md Hard Rule #1) and the pre-commit gates. Force the
# ABSOLUTE shared hooks dir. Shared git config, so this also fixes the main repo.
ensure_abs_hooks() {
  local hooks_dir
  hooks_dir="$(cd "$(git rev-parse --git-common-dir)" && pwd)/hooks"
  git config core.hooksPath "$hooks_dir"
}

cmd_new() {
  local id="${1:-}" desc="${2:-}"
  if [ -z "$id" ] || [ -z "$desc" ]; then
    echo "error: need <LINEAR-ID> <short-desc>" >&2; usage; exit 1
  fi
  local branch="agent/${id}-${desc}"
  local path="$wt_root/$id"

  if [ -e "$path" ]; then
    echo "error: worktree already exists: $path" >&2
    echo "       another agent may already hold $id — check the agent-claimed mutex first." >&2
    exit 1
  fi

  ensure_abs_hooks
  mkdir -p "$wt_root"

  # Base on the up-to-date main. Local `main` can be stale (agents rarely check it
  # out), so prefer origin/main after a fetch; fall back to local main with no remote.
  local base="main"
  if git -C "$repo_root" remote get-url origin >/dev/null 2>&1; then
    git -C "$repo_root" fetch --quiet origin main 2>/dev/null || true
    base="origin/main"
  fi
  echo "→ creating worktree $path on branch $branch (from $base)"
  git -C "$repo_root" worktree add -b "$branch" "$path" "$base"

  # .env / .env.local are gitignored, so a fresh worktree has none. Carry them over.
  local f
  for f in .env .env.local; do
    if [ -f "$repo_root/$f" ]; then
      cp "$repo_root/$f" "$path/$f"
      echo "  copied $f"
    fi
  done

  echo "→ installing dependencies (hardlinked from the pnpm store; fast)"
  ( cd "$path" && pnpm install )

  cat <<EOF

✓ Worktree ready. Work the issue here:
    cd $path
    pnpm verify              # typecheck + test + boundary lint, before the PR
    ./scripts/smoke.sh       # for demo-path work
  After a human merges the PR (morning), reclaim disk:
    pnpm wt:rm $id
EOF
}

cmd_rm() {
  local id="${1:-}"
  [ -n "$id" ] || { echo "error: need <LINEAR-ID>" >&2; usage; exit 1; }
  local path="$wt_root/$id"
  [ -d "$path" ] || { echo "error: no worktree at $path" >&2; exit 1; }
  local branch
  branch="$(git -C "$path" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  git worktree remove "$path"   # refuses on uncommitted changes — by design; commit or block first
  git worktree prune
  echo "✓ removed worktree $path"
  [ -n "$branch" ] && echo "  branch $branch kept (delete after merge with: git branch -D $branch)"
}

case "${1:-}" in
  new) shift; cmd_new "$@" ;;
  rm)  shift; cmd_rm "$@" ;;
  ls|"") git worktree list ;;
  -h|--help|help) usage ;;
  *) echo "unknown command: $1" >&2; usage; exit 1 ;;
esac
