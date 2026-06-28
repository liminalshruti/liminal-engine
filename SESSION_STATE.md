# SESSION_STATE.md

Current state of the build, right now. Keep this short and true. Reflects git/PR
merge-state (the truth), not Linear status (a lagging cache — multiple sessions
write the board concurrently, so it flaps).

## As of: LIM-1339 design-foundation-governslate branch ready (2026-06-28)

- **LIM-1339 branch:** `agent/LIM-1339-design-foundation-governslate` promotes
  govern-slate tokens into `packages/ui-components/src/styles/govern-slate.css`
  and leaves the app-local `design-tokens.css` as a compatibility import.
- **Token coverage:** shared source now carries slate surfaces, governance-state
  accents (`on-track`, `at-risk`, `blocked`, `forwarded`, `held`), type/font,
  spacing/radius/elevation, focus, motion/reduced-motion, light/dark, and
  presenter density variants.
- **App consumption:** touched app CSS consumes token references only; no raw color
  literals remain outside the shared token source. The 14-beat app wiring and
  contracts/goldens are unchanged.
- **Verification:** desktop-demo build, `pnpm verify` (515 tests + boundary lint),
  `./scripts/smoke.sh`, and `git diff --check` are green.

## As of: LIM-1372 unbuilt real-product contracts + harnesses (2026-06-28)

- **Worktree:** `/Users/shayaunnejad/liminal/liminal-engine.worktrees/LIM-1372`
  on branch `agent/LIM-1372-unbuilt-real-product`, rebased onto current
  `origin/main` with LIM-1367 policy intercept, LIM-1340 operator-NL, and
  LIM-1373 arbitrary-agent-output API work preserved.
- **Contracts:** added and registry-pinned `DriftSignal`, `LlmRequest`,
  `LlmOutcome`, `EndpointConfig`, `TransformRule`, `ResourceAllocation`,
  `RoutingRule`, and `NlIntent`; `contracts.golden.json` now carries 41 vectors
  across 27 registered contracts after the rebase, including upstream
  `OperatorMessage`, `ParsedIntent`, and `AssistantReply`.
- **Real product logic:** new `@liminal-engine/signal-harness` detects requirement
  drift on arbitrary active requirements, applies transform rules, routes
  signals/intents to enabled endpoints, and allocates resources for severe open
  signals. `eval-harness` now generates/grades evals from real inputs, and
  `ui-components` exposes view-model helpers for the new control-plane artifacts.
- **Gemini:** `@liminal-engine/integration-gemini` keeps upstream's cache-backed
  `GeminiAgentOutputSource` and adds `GeminiRestAgentOutputSource` for direct
  REST calls with contract-recorded `LlmRequest`/`LlmOutcome` history. The fixture
  source remains explicit for deterministic composition roots.
- **Verification:** post-rebase `pnpm verify` is green: typecheck, app typecheck,
  508 tests, and boundary lint. `pnpm test` now serializes Node test-file
  execution with `--test-concurrency=1` to avoid Node 26 child-result
  deserialization flake; it still runs the same test glob. `./scripts/smoke.sh`
  is green after the final rebase.

## As of: LIM-1367 policy intercept control plane branch ready (2026-06-28)

- **LIM-1367 branch:** `agent/LIM-1367-policy-intercept-control-plane` adds the
  live/dogfood proxy control plane: `ActionPolicyRule`, strict `InterceptedAction`,
  pure policy decisions, correction compilation, verdict/rule audit, HTTP gateway,
  `policy-gw` CLI, gh/git/deploy shims, MCP classifier, scope, match/replace,
  repeater, queue controls, proxy history, and durable session storage.
- **Model split:** main's remediation `PolicyRule` remains intact for
  correction-pipeline/governance-case rules. Learned allow/deny/ask intercept rules
  live in the new `ActionPolicyRule` contract to avoid semantic collision.
- **Verification:** `pnpm regen:goldens`, `pnpm install --frozen-lockfile`,
  focused contracts/policy/governance/gateway tests, and `pnpm verify` are green
  on the rebased branch (`394` tests + boundary lint).
- **Still not complete product parity:** CLI/HTTP proxy persistence is real, but a
  browser-grade operator UI/live dogfood deployment is still the next fidelity gap.

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

## As of 2026-06-28 (main @ `99f7279`) — demo spine COMPLETE + live-wired

### Backend / engine — complete on main
Governance loop (`detect → enforce → gate → audit → eval`), contracts kernel,
eval-harness Fail→Pass, hash-chained audit-ledger, fail-closed ActionGate,
fixture-determinism — all merged. `pnpm verify` green (124 tests + boundary lint).
Acme fixtures are the single source of truth.

### Demo screens — 7 of 7 filled, all live-wired to `useDemo()`
| Screen | Beat / MNC | Status |
|---|---|---|
| Initialize | #1-2 | ✅ filled |
| ContextTray | context cards | ✅ filled |
| AgentActivity | #3 · MNC#1 (false green) | ✅ filled (#36) |
| GovernanceCase | #4-5 · MNC#2 (detection) | ✅ filled (#43) + evidence fields (#50) |
| EnforcementPanel | #6-10 · MNC#3/4/5 | ✅ filled |
| AuditTrail | #11 · MNC#6 | ✅ filled (#31) |
| SecondPassEval | #12-14 · MNC#7 | ✅ filled (#30) |

**Live-wire (#51):** all 7 screens render real `buildGovernanceDemo()` loop output
(UI == engine, not staged), with `.catch` + `role="alert"` error handling so a loop
failure surfaces loudly instead of hanging. **E2E guard:** 18/18 beat assertions
pass, 0 skipped (#45/#49). Depth UX merged: compiled-enforcement preview, 3-part
blocked-action card, second-pass causal narration + before/after checks table. A11y
pass merged (#47).

### Open PRs (docs / stretch — derive truth from `gh pr list`, not this list)
- **#52** (LIM-1195) — README/SUBMISSION judge-facing docs + real-vs-simulated framing.
- **#48** (LIM-1194) — README run instructions + 14-beat walkthrough table (overlaps #52 on README).
- **#53** (LIM-1203) — reconcile AGENT_HANDOFFS to current state.
- **#44 / #26** (LIM-1251) — PolicyRule/ApprovalGate covered-by-existing-contracts (SCOPE_SPEC + SPEC docs).
- **#54** (LIM-1248) — [STRETCH] data-residency / redaction proof surface (CONFLICTING; stretch, must not destabilize spine).

### Remaining path to submission
1. Land docs PRs (#52/#48/#53) so judges don't see TODO placeholders or stub claims.
2. Record deterministic fallback demo (founder lane — highest-ROI artifact).
3. Time the full live 14-beat walkthrough < 3 min.
4. Final claim-scan (no `Liminal, Inc.`, no invented persona, no live-integration overclaim).
5. Stretch work (#54 etc.): scoped incrementally on isolated surfaces, each PR-only +
   `pnpm verify` green + boundary lint, never destabilizing the merged spine.

## Architecture conformance
| Requirement | Source | Implemented in | Test / evidence |
|---|---|---|---|
| Docs-only change, no code/contracts touched | CLAUDE.md (docs vs code) | `SESSION_STATE.md` + `TRACEABILITY_MATRIX.md` | `git diff --stat` = 2 docs; `pnpm verify` unaffected (124 green) |
| State reflects real merge-state, not Linear | linear-status-flaps working rule | screen table + open-PR list | verified via `gh pr list` / `git merge-base --is-ancestor` against main @ `99f7279` |
| Keeps SESSION_STATE short and true (house rule) | `SESSION_STATE.md` header | refreshed body | replaced stale 6/7 + GovernanceCase-stub snapshot with current 7/7 live-wired; no invented status |
