# SESSION_STATE.md

Current state of the build, right now. Keep this short and true. Reflects git/PR
merge-state (the truth), not Linear status (a lagging cache — multiple sessions
write the board concurrently, so it flaps).

## As of: LIM-1239 agent-activity trace cards branch ready (2026-06-28)

- **LIM-1239 branch:** `agent/LIM-1239-agent-activity-trace-cards` upgrades
  `AgentActivity` with fixture-backed per-agent trace cards for Product,
  Security, and Engineering roles plus a visible missing-requirement evidence
  line.
- **Demo path impact:** beat #3 / MNC#1 still shows the false-green claim
  `Acme expansion appears on track`, now with artifact trace cards showing the
  Acme goal/workstream artifacts each agent used and the explicit evidence that
  `EU data residency` was present in the customer call but missing from the
  first-pass output.
- **Verification:** focused trace tests, app typecheck, desktop-demo production
  build, `pnpm verify` (100/100 tests + boundary lint), and `./scripts/smoke.sh`
  automated checks are green.
- **No contract drift:** no contract, fixture, or golden changes; no live calls
  on the demo spine; no invented persona name.

## As of: LIM-1238 second-pass causal table branch ready (2026-06-28)
## As of 2026-06-28 — demo spine 6 of 7 screens on main

### Backend / engine — complete on main
Governance loop (`detect → enforce → gate → audit → eval`), contracts kernel,
eval-harness Fail→Pass, hash-chained audit-ledger, fail-closed ActionGate,
fixture-determinism — all merged. `pnpm verify` green (typecheck + `typecheck:app`
+ tests + boundary lint). Acme fixtures are the single source of truth.

### Demo screens — 6 of 7 filled on main
| Screen | Beat / MNC | Status |
|---|---|---|
| Initialize | #1-2 | ✅ filled |
| ContextTray | context cards | ✅ filled |
| AgentActivity | #3 · MNC#1 (false green) | ✅ filled (#36) |
| EnforcementPanel | #6-10 · MNC#3/4/5 | ✅ filled |
| AuditTrail | #11 · MNC#6 | ✅ filled (#31) |
| SecondPassEval | #12-14 · MNC#7 | ✅ filled (#30) |
| **GovernanceCase** | **#4-5 · MNC#2 (detection)** | **🔲 last stub — in PR #29** |

Depth UX merged: compiled-enforcement preview, 3-part blocked-action card,
second-pass causal narration + before/after checks table.

### Open PRs (as of this write)
- **#29** (allsmog, LIM-1236) — also fills GovernanceCase. Per founder call, beat
  #3 stays a clean false-green (#36 won AgentActivity), so #29 reshapes to
  **GovernanceCase-only** → completes the 7th screen. (#29's GovernanceCase fill is
  stronger than the original LIM-1218 spec: present-in-call / missing-downstream
  evidence compare.)
- **#34** (LIM-1245) — wire demo to live `runGovernanceLoop`/`runEvals` output via
  `lib/governance-demo.ts` (UI == engine, not staged). CI-green; held for human
  review (narrows the boundary guard — conscious sign-off needed).
- **#39** (LIM-1253) — narrow demo-app boundary guard (allow in-memory stores,
  keep live gemini/linear/livekit blocked).
- **#40** (LIM-1192) — deterministic fallback demo path (14 beats, no live calls).
- **#26** — PolicyRule/ApprovalGate covered-by-existing-contracts docs.

### Remaining path to submission
1. Land GovernanceCase (last screen / MNC#2) → all 7 screens, every MNC visible.
2. Merge #34 (live-wire) after review → screens swap imports to `lib/governance-demo`.
3. `pnpm verify` + `./scripts/smoke.sh` full 14-beat walkthrough (<3 min, deterministic).
4. M4 submission gates: claim-scan, IP receipt, fallback recording (founder lane).

## Architecture conformance
| Requirement | Source | Implemented in | Test / evidence |
|---|---|---|---|
| Docs-only change, no code/contracts touched | CLAUDE.md (docs vs code) | `SESSION_STATE.md` only | `git diff --stat` = 1 file; `pnpm verify` unaffected |
| State reflects real merge-state, not Linear | linear-status-flaps working rule | screen table + open-PR list | verified via `gh pr list --state merged` / `gh pr view` against main |
| Keeps SESSION_STATE short and true (house rule) | `SESSION_STATE.md` header | refreshed body | replaced stale 5/7 snapshot with current 6/7; no invented status |
