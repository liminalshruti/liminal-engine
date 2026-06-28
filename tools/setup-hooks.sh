#!/usr/bin/env sh
# Install git hooks and pin core.hooksPath to the ABSOLUTE shared hooks dir.
#
# A relative hooksPath (".git/hooks") resolves to "<worktree>/.git/hooks" inside a
# linked worktree, which does NOT exist (a worktree's .git is a file). Hooks then
# silently no-op there, disabling the commit-msg AI-attribution strip (AGENTS.md
# Hard Rule #1) and the pre-commit gates for every parallel agent. The absolute
# path resolves correctly from the main repo AND from any worktree.
hooks_dir="$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd)/hooks"
if [ -d "$hooks_dir" ]; then
  git config core.hooksPath "$hooks_dir"
fi
lefthook install || true
