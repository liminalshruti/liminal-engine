#!/usr/bin/env bash
#
# smoke.sh — Liminal Engine Governance Hack 2026
#
# Runs whatever build/test commands are available, then prints the manual demo
# checklist a human walks before declaring the demo ready. Safe to run anytime;
# missing build tooling is reported, not fatal — the manual checklist always prints.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
skip() { printf '  \033[33m–\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; }

bold "Liminal Engine — smoke test"
echo

# ----------------------------------------------------------------------------
# 1. Automated build/test (best-effort — only runs what exists)
# ----------------------------------------------------------------------------
bold "1. Build / test (best-effort)"

if [ -f package.json ]; then
  if grep -q '"build"' package.json 2>/dev/null; then
    echo "  running: npm run build"
    npm run build && ok "build passed" || fail "build failed"
  else
    skip "no build script in package.json"
  fi
  if grep -q '"test"' package.json 2>/dev/null; then
    echo "  running: npm test"
    npm test && ok "tests passed" || fail "tests failed"
  else
    skip "no test script in package.json"
  fi
else
  skip "no root package.json yet (scaffold stage — expected)"
fi
echo

# ----------------------------------------------------------------------------
# 2. Manual demo checklist
# ----------------------------------------------------------------------------
bold "2. Manual demo checklist — walk each item in the running demo"
cat <<'CHECKLIST'

   [ ]  1. App starts locally.
   [ ]  2. Initialize screen loads.
   [ ]  3. Context cards appear.
   [ ]  4. Agent output says Acme appears on track.
   [ ]  5. GovernanceCase appears with EU data residency.
   [ ]  6. Approve + Enforce changes status to At Risk.
   [ ]  7. Simulated Linear workstream appears.
   [ ]  8. Blocked customer update appears.
   [ ]  9. Audit trail appears.
   [ ] 10. Eval table shows Fail → Pass.
   [ ] 11. Demo can be completed in under 3 minutes.

CHECKLIST

bold "Reminder"
echo "  - No invented persona name on screen or in narration."
echo "  - Every must-not-cut item in DEMO_CONTRACT.md must be visible."
echo "  - Spine must be deterministic (no live-call flakiness)."
echo
