#!/usr/bin/env bash
#
# smoke.sh — Liminal Engine — Agentic Work Governance MVP
# Hackathon: Liminal Engine Governance Hack 2026
#
# Automated product checks only. Per DIRECTIVE.md (NO DEMO FLOWS) there is NO
# manual demo checklist: the governance loop (observe→detect→correct→enforce→
# audit→improve) is real product behavior, exercised by the automated test suite
# against real engine output — not a hand-walked, narrated sequence.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
skip() { printf '  \033[33m–\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; }

bold "Liminal Engine — smoke test (automated)"
echo

# ----------------------------------------------------------------------------
# Automated build / test (best-effort — only runs what exists)
# ----------------------------------------------------------------------------
if [ -f package.json ]; then
  if grep -q '"build"' package.json 2>/dev/null; then
    echo "  running: pnpm build"
    pnpm build && ok "build passed" || fail "build failed"
  else
    skip "no build script in package.json"
  fi
  if grep -q '"test"' package.json 2>/dev/null; then
    echo "  running: pnpm test"
    pnpm test && ok "tests passed" || fail "tests failed"
  else
    skip "no test script in package.json"
  fi
else
  skip "no root package.json yet (scaffold stage — expected)"
fi
echo
