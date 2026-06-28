# AGENT_HANDOFFS.md

Append a block after **every** session. Newest at top. The next session reads
this first.

---

## Session: LIM-1339 design-foundation-governslate PR-ready (2026-06-28)

**Did:**
- Claimed LIM-1339 in Linear, assigned it to Sean, moved it to In Progress, added
  `agent-claimed`, and worked only in
  `/Users/shayaunnejad/liminal/liminal-engine.worktrees/LIM-1339` on branch
  `agent/LIM-1339-design-foundation-governslate`.
- Promoted the govern-slate token source to
  `packages/ui-components/src/styles/govern-slate.css` with CSS package exports
  `@liminal-engine/ui-components/govern-slate.css` and
  `@liminal-engine/ui-components/design-tokens.css`.
- Replaced the app-local `apps/desktop-demo/src/styles/design-tokens.css` with a
  compatibility import of the shared package token source.
- Added govern-slate aliases for slate chrome, governance states
  (`on-track`, `at-risk`, `blocked`, `forwarded`, `held`), font/type scale,
  spacing/radii/elevation, focus, motion durations/easings, reduced-motion,
  light/dark theme, and presenter density.
- Removed app CSS raw color fallbacks/literals in touched styling so app styles
  consume tokens instead of local hardcoded colors.
- Added LIM-1339 token tests for source-of-truth wiring, prototype/specimen parity
  anchors, variants, and app CSS no-raw-color enforcement.
- Fixed the existing demo-video informational test to use `t.diagnostic()` instead
  of `console.log`, preserving the no-skip check while avoiding Node runner
  serialization failure.

**Verified:**
- `pnpm --filter @liminal-engine/desktop-demo build` green.
- `pnpm verify` green after rebase: typecheck, app typecheck, 515 tests, boundary
  lint.
- `./scripts/smoke.sh` green: automated test suite passed.
- `git diff --check` clean.
- No `packages/contracts` diff; Acme golden tests stayed byte-identical in
  `pnpm verify`; no `App.tsx`, `steps.tsx`, or demo-path e2e changes.

**Did NOT do (by design):**
- No live integrations or demo-spine behavior changes.
- No contract, fixture, or golden regeneration.
- Did not merge the PR or mark Linear Done.

**Next session should:**
- Review the token migration diff for visual parity and CI.
- Merge only after normal reviewer gates pass; then remove the worktree with
  `pnpm wt:rm LIM-1339`.

**Risks / watch:**
- The styling diff is broad because raw fallback removal touched existing CSS
  consumers. The added no-raw-color test should keep the app dependent on the
  shared package token source.

---

## Session: LIM-1372 unbuilt real-product contracts + harnesses (2026-06-28)

**Did:**
- Created isolated worktree
  `/Users/shayaunnejad/liminal/liminal-engine.worktrees/LIM-1372` on branch
  `agent/LIM-1372-unbuilt-real-product` because no Linear ID was supplied in the
  user request.
- Added and registered eight shared-kernel contracts with golden vectors:
  `DriftSignal`, `LlmRequest`, `LlmOutcome`, `EndpointConfig`, `TransformRule`,
  `ResourceAllocation`, `RoutingRule`, and `NlIntent`. Rebased over LIM-1367,
  LIM-1340, and LIM-1373, preserving upstream `PolicyRule`, `ActionPolicyRule`,
  `ApprovalGate`, `OperatorMessage`, `ParsedIntent`, and `AssistantReply`
  registry entries.
- Added `packages/signal-harness` with real deterministic logic for requirement
  drift detection over arbitrary active requirements, transform-rule application,
  signal/intent routing to enabled endpoint configs, and severe-signal resource
  allocation.
- Strengthened `packages/eval-harness` beyond store reads: it validates read
  results through contracts and can generate eval cases / grade requirement
  coverage from arbitrary `GovernanceCase` + `AgentOutput` inputs while keeping
  upstream `ruleHealthTable`.
- Expanded `packages/ui-components` from two helpers to framework-agnostic
  view-model helpers for drift signals, endpoint configs, NL intents, resource
  allocations, routing rules, and eval summaries.
- Added `GeminiRestAgentOutputSource`, a real Gemini REST adapter behind the
  existing governance `AgentOutputSource` port that records `LlmRequest` /
  `LlmOutcome` receipts. Upstream cache-backed `GeminiAgentOutputSource` remains
  intact, and `FixtureAgentOutputSource` remains explicit for fixture-chosen roots.
- Serialized the root `pnpm test` script with `--test-concurrency=1` after Node
  26 repeatedly failed deserializing a passed child test file in the concurrent
  full suite. The same 508 tests still run; no test was skipped or weakened.

**Verified before PR open:**
- `pnpm install` refreshed workspace metadata.
- `pnpm regen:goldens` wrote `contracts.golden.json` with 41 vectors across 27
  registered contracts after the rebase.
- `pnpm verify` is green after rebasing onto current `origin/main`: typecheck,
  app typecheck, 508 tests, and boundary lint.
- `./scripts/smoke.sh` is green after the final rebase.

**Did NOT do (by design):**
- Did not wire live Gemini into the deterministic desktop-demo spine.
- Did not make a real live Gemini network call because no `GEMINI_API_KEY` was
  required/provided; the REST adapter path is tested with injected fetch over real
  request construction/parsing code.
- Did not merge or mark any Linear issue Done.

**Risks / watch:**
- `detectRequirementDrift` is deliberately generic and may need product tuning once
  real operator data is available.
- This branch now layers on top of LIM-1367's policy intercept control plane, so
  reviewers should inspect the model split: remediation `PolicyRule`,
  intercept `ActionPolicyRule`, and general `RoutingRule` are distinct contracts.
- This branch also layers on LIM-1340's operator-NL contracts. `ParsedIntent`
  models an unratified operator chat turn; `NlIntent` is the normalized
  control-plane artifact used for routing/config/allocation workflows.

---

## Session: LIM-1367 policy intercept control plane PR-ready (2026-06-28)

**Did:**
- Created Linear issue LIM-1367 and worked only in
  `/Users/shayaunnejad/liminal/liminal-engine.worktrees/GOAL-policy-loop` on branch
  `agent/LIM-1367-policy-intercept-control-plane`.
- Added the live/dogfood proxy control plane: `ActionPolicyRule` contract,
  `InterceptedAction` strict boundary validation, pure policy decision engine,
  correction-to-action-policy compilation, policy verdict/rule audit helpers, and
  rule-health eval reporting.
- Added `packages/integrations/intercept-gateway`: HTTP server, `policy-gw` CLI,
  gh/git/deploy shims, MCP destructive-call classifier, target scope, match/replace,
  queue controls, forward/drop/bulk controls, repeater, proxy history, and execution
  outcome recording.
- Added `packages/integrations/policy-store`: in-memory and file-backed action
  policy stores plus intercept queues. `policy-gw serve --session-dir <path>` now
  persists learned rules, pending queue state, and proxy history across restart.
- Rebased onto current `origin/main` and reconciled the existing remediation
  `PolicyRule` model by splitting learned verdict rules into `ActionPolicyRule`
  rather than overwriting main's correction-pipeline contract.

**Verified:**
- `pnpm regen:goldens` wrote 25 vectors across 16 contracts.
- `pnpm install --frozen-lockfile` refreshed this worktree after rebasing onto
  current main.
- `pnpm typecheck` green after the model split.
- Focused contracts/policy/governance/gateway tests green: 66 tests.
- `pnpm verify` green on rebased branch: 394 tests, app typecheck, boundary lint.

**Did NOT do (by design):**
- Did not merge the PR or mark Linear Done.
- Did not wire live calls into the deterministic Acme demo spine.
- Did not remove current main's correction-pipeline `PolicyRule` or policy-router
  packages; this PR adds the action-intercept layer beside them.

**Next session should:**
- Review/open the LIM-1367 PR and watch CI after push.
- If main moves again, rebase before review; current branch was observed as ahead 1
  and behind 4 after verification, so a final fetch/rebase is expected before push.

**Risks / watch:**
- This is a large product-surface PR. The biggest review point is terminology:
  remediation `PolicyRule` remains the governance-case rule, while `ActionPolicyRule`
  is the learned allow/deny/ask rule used by the intercept gateway.
- The control plane is real logic and real local shims/HTTP, but not yet a full
  browser-grade operator UI. CLI/HTTP persistence is the current fidelity level.

---

## Session: reconcile — spine complete, #51 gated, video is the last gap (2026-06-28)

> Reconciliation pass. The per-PR session blocks below stop at LIM-1239 but the
> build moved well past that. Current ground truth (verified via `gh`/`git`, not
> Linear — board status flaps with multiple writers):

**State of the build — STRUCTURALLY COMPLETE.**
- All **7 screens** filled + merged (Initialize, ContextTray, AgentActivity,
  GovernanceCase, EnforcementPanel, AuditTrail, SecondPassEval). Every must-not-cut
  (#1–#7) renders on screen.
- Backend governance loop, fail-closed ActionGate, hash-chained audit-ledger, eval
  Fail→Pass, determinism, fixtures — all on main.
- **Live-wire helper** `buildGovernanceDemo()` merged (LIM-1245 / PR #34) — runs the
  REAL loop over in-memory fixture-seeded adapters.
- **e2e** (`apps/desktop-demo/test/demo-path.e2e.test.ts`) merged (LIM-1240 / #45);
  beat-#5 UI assertion activated (#49) → **0 skips**.
- **Certified green cold** (clean checkout of main, fresh install): `pnpm verify`
  ~124 tests, 0 fail, 0 boundary violations; app typecheck + build clean; smoke ok.

**THE ONE OPEN TECHNICAL ITEM — PR #51 (LIM-1255), GATED before merge.**
- #51 re-points all 7 screens to read live `buildGovernanceDemo()` output via a
  `DemoProvider` context (branch `agent/LIM-1255-wire-screens-to-live-loop`, head
  `c9f9730`). APPROVED + MERGEABLE/CLEAN; e2e proves UI==engine.
- **DO NOT MERGE until this fix lands** in `apps/desktop-demo/src/lib/demo-context.tsx`:
  the `DemoProvider` does `void buildGovernanceDemo().then(setDemo)` with **no
  `.catch()`**. `buildGovernanceDemo()` can throw (`runGovernanceLoop` throws on
  `detectMiss === null`) → the demo would hang forever on "Running the governance
  loop…" on stage. Add a `.catch` + error state + `role="alert"` branch (exact
  patch is posted as a comment on PR #51). Founder call: catch first, then merge.
- After catch lands: `pnpm verify` green → `gh pr merge 51 --squash --delete-branch`
  → mark LIM-1255 Done (confirm merge commit in origin/main first).

**Other open PRs:** #52 (judge docs — APPROVE-WITH-NITS: refresh stale "114 tests"
count to current; likely supersedes #48 → close #48). #44/#26 (PolicyRule SCOPE_SPEC
docs — Shayaun's lanes, conflicting/changes-requested). #41 already merged.

**Submission gates:** claim-scan clean (no Stanford/SPC; `Liminal, Inc.` only in the
rules forbidding it). SUBMISSION.md + IP_RECEIPT present. ⚠️ **Demo video (LIM-1197)
is the ONE remaining real gap** — `demos/recordings/` is empty (only `.gitkeep`); the
written fallback walkthrough is merged, the video is not recorded.

**Next session should:** (1) land #51's `.catch()` → merge #51; (2) record the demo
video (LIM-1197); (3) refresh #52's test count + close #48; (4) final SUBMISSION.md
pass. After #51 + video, the submission is complete.

---

## Session: LIM-1239 agent-activity trace cards (2026-06-28)

**Did:**
- Claimed LIM-1239 in Linear, assigned it to Sean, moved it to In Progress, added
  `agent-claimed`, and worked only in
  `/Users/shayaunnejad/liminal/liminal-engine.worktrees/LIM-1239` on branch
  `agent/LIM-1239-agent-activity-trace-cards`.
- Replaced the `AgentActivity` stub with fixture-backed beat #3 rendering:
  the false-green `Acme expansion appears on track` claim, On Track status badge,
  first-pass summary, per-agent trace cards, and an explicit missing-requirement
  evidence line.
- Added `AgentActivityTrace.ts` and focused tests so the trace cards are derived
  from `acmeScenario` artifacts, prove the `EU data residency` requirement was
  present in the customer call but missing from the first-pass output, and fail
  closed on fixture drift.
- Added scoped CSS for the AgentActivity trace-card grid and evidence line. No
  contract, fixture, golden, live integration, or persona-name changes.

**Verified:**
- `node --test apps/desktop-demo/src/screens/AgentActivityTrace.test.ts` green
  (6 tests).
- `pnpm --filter @liminal-engine/desktop-demo typecheck` green.
- `pnpm --filter @liminal-engine/desktop-demo build` green.
- `pnpm verify` green: root typecheck, app typecheck, 100 tests, boundary lint.
- `./scripts/smoke.sh` automated checks green; manual checklist printed.

**Did NOT do (by design):**
- No contract/golden changes; no live Gemini/Linear/LiveKit calls; no invented
  persona names.
- Did not merge or move Linear to Done.

**Next session should:**
- Review the LIM-1239 PR alongside the overlapping LIM-1217/LIM-1236
  AgentActivity PRs and merge in an order that preserves the false-green base,
  inline dropped-requirement highlight, and these trace cards.

**Risks / watch:**
- The app-safe source artifact is derived from `agentOutputPass1.dealName`
  because the richer call transcript is not a spine-safe fixture yet. If a
  transcript fixture lands in `@liminal-engine/contracts/fixtures`, use that as
  the source artifact without importing `packages/integrations/*`.
## Session: LIM-1244 quality a11y pass (2026-06-28)

**Did:**
- Claimed LIM-1244 in Linear, assigned it to Sean, moved it to In Progress, added
  `agent-claimed`, and worked only in
  `/Users/shayaunnejad/liminal/liminal-engine.worktrees/LIM-1244` on branch
  `agent/LIM-1244-quality-a11y-pass`.
- Added keyboard and focus hardening to the demo shell: first-tab skip button,
  active-step `aria-current`, labeled Back/Next controls, and focus handoff to the
  current beat title only after the beat index changes.
- Hardened shared demo semantics: hidden captions for eval tables, decorative dots
  and alert icon hidden from assistive tech, and the simulated Linear payload marked
  as a named region.
- Updated desktop-demo CSS for visible focus rings, 44px interactive targets,
  higher-contrast pass/fail/focus colors, responsive wrapping, and no nonzero
  `letter-spacing` in the app stylesheet.
- Added `apps/desktop-demo/src/a11y-demo.test.ts` to guard the keyboard/focus,
  target-size, contrast, and table-caption requirements.

**Verified:**
- `node --test apps/desktop-demo/src/a11y-demo.test.ts` green.
- `pnpm typecheck:app` green.
- `pnpm verify` green: root typecheck, app typecheck, 98 tests, boundary lint.
- `pnpm --filter @liminal-engine/desktop-demo build` green.
- `./scripts/smoke.sh` green for automated tests; manual checklist printed.
- `git diff --check` clean.
- Local Vite served at `http://localhost:5174/`; the browser plugin was unavailable,
  so I used headless Chrome probes. Confirmed first Tab reaches the skip button and
  Space moves focus to the beat title. Longer CDP key-loop automation was unreliable,
  so the committed guard test is the durable regression check.

**Did NOT do (by design):**
- No contract/golden changes; no live integrations; no fixture rewrites; no persona
  names.
- Did not rewrite the existing GovernanceCase content stub because LIM-1244 owns the
  cross-cutting accessibility pass, not MNC#2 content completion.
- Did not merge or mark Linear Done.

**Next session should:**
- Review the LIM-1244 PR for keyboard/focus/contrast acceptance and merge only after
  normal reviewer gates pass.
- Coordinate with the GovernanceCase-fill PR so the existing MNC#2 content stub is
  removed by its owning work, not by this quality pass.

**Risks / watch:**
- The app remains a static click-through; the keyboard path is through the demo rail
  and Back/Next controls. If a later PR turns Approve + Enforce into an actual
  in-screen action, that new control should inherit the same focus and 44px target
  rules.

---

## Session: LIM-1238 second-pass causal table (2026-06-28)

**Did:**
- Claimed LIM-1238 in Linear, assigned it to Sean, moved it to In Progress, and
  worked only in `/Users/shayaunnejad/liminal/liminal-engine.worktrees/LIM-1238`
  on branch `agent/LIM-1238-second-pass-causal-table`.
- Replaced the `SecondPassEval` stub with fixture-backed rendering for beats
  #12-#14: EvalCase generated, improved second-pass output, the exact causal
  narration `failure observed -> rule activated -> second pass gated -> eval passed`,
  the shared `EvalTable`, and an explicit per-check before/after table showing
  `FAIL -> PASS`.
- Added `SecondPassEval.model.ts` plus targeted tests for deterministic
  criterion-grouped before/after rows.

**Verified:**
- `node --test apps/desktop-demo/src/screens/SecondPassEval.model.test.ts` green.
- `pnpm typecheck:app` green.
- `pnpm verify` green: root typecheck, app typecheck, 94 tests, boundary lint.
- `./scripts/smoke.sh` automated checks green; manual checklist printed.
- `pnpm --filter @liminal-engine/desktop-demo build` green.
- Vite served the app locally at `http://localhost:5174/`; in-app browser was
  unavailable in this session, so visual DOM inspection was not available.

**Did NOT do (by design):**
- No contract/golden changes; no live integrations; no persona names; no changes
  outside the second-pass screen files plus required handoff docs.
- Did not merge or mark Linear Done.

**Next session should:**
- Review the LIM-1238 PR, then merge after the normal reviewer gates pass.
- Watch for merge ordering with LIM-1221, which also owns `SecondPassEval.*`.

**Risks / watch:**
- The table is computed from `toRows([evalPass1, evalPass2])`, so richer future
  eval fixtures will be grouped by criterion automatically.

---

## Session: LIM-1235 3-part blocked-action card (2026-06-28)

**Did:**
- Claimed LIM-1235 in Linear, assigned it to Sean, moved it to In Progress, and
  worked only in `/Users/shayaunnejad/liminal/liminal-engine.worktrees/LIM-1235`
  on branch `agent/LIM-1235-blocked-action-card`.
- Upgraded `apps/desktop-demo/src/components/BlockedActionBanner.tsx` into the
  explicit 3-part blocked-action card: `Not allowed`, `Why blocked`, and
  `Required before send` from `ActionGate.requiredBeforeSend`.
- Replaced the `EnforcementPanel` placeholder with fixture-backed rendering for
  beats #6-#10: Approve + Enforce, On Track -> At Risk status flip, simulated
  Linear workstream + Product/Security/Engineering owners, attempted customer
  on-track update, and the blocked card.

**Verified:**
- `pnpm --filter @liminal-engine/desktop-demo typecheck` green.
- `pnpm --filter @liminal-engine/desktop-demo build` green.
- Headless Chrome DOM check on `http://localhost:5174/` clicked beat #10 and
  confirmed `Not allowed`, `Why blocked`, `Required before send`, all three
  `requiredBeforeSend` items, the simulated Linear badge, required owners, and
  the On Track -> At Risk status flip.
- `pnpm verify` green: root typecheck, app typecheck, 80 tests, boundary lint.
- `./scripts/smoke.sh` automated checks green; manual checklist printed.

**Did NOT do (by design):**
- No contract/golden changes; no live integrations; no persona names; no changes
  outside the desktop-demo UI plus required handoff docs.
- Did not merge or mark Linear Done.

**Next session should:**
- Review the LIM-1235 PR, then merge after the normal reviewer gates pass.
- Continue the remaining per-beat screen work; several other screens still carry
  their original stub notes.

**Risks / watch:**
- The card is fixture-backed from `acmeScenario.blockedAction`; if another branch
  rewires the app to `runGovernanceLoop()` output, preserve the same
  `ActionGate` shape and three visible sections.
## Session: LIM-1234 compiled-enforcement preview (2026-06-28)

**Did:**
- Claimed LIM-1234 in Linear, assigned it to Sean, moved it to In Progress, added
  `agent-claimed`, and worked only in
  `/Users/shayaunnejad/liminal/liminal-engine.worktrees/LIM-1234` on branch
  `agent/LIM-1234-compiled-enforcement-preview`.
- Added `apps/desktop-demo/src/components/EnforcementPreview.tsx`, a contract-typed
  widget that lists the compiled `EnforcementAction` objects queued for approval.
- Exported the widget from the desktop-demo component barrel and rendered it in
  `apps/desktop-demo/src/screens/EnforcementPanel.tsx` before the enforce transition
  text, so beat #6 shows the rule set before Approve + Enforce.
- Added responsive CSS for the preview in `apps/desktop-demo/src/styles/app.css`.

**Verified:**
- `pnpm typecheck:app` green.
- `pnpm --filter @liminal-engine/desktop-demo build` green.
- `git diff --check` clean.
- `pnpm verify` green: root typecheck, app typecheck, 68 tests, boundary lint.
- `./scripts/smoke.sh` automated section green: 68 tests. Manual checklist printed;
  in-app browser was unavailable, so Vite was started locally and the served modules
  were checked for routed `EnforcementPreview` rendering and the visible
  "Compiled EnforcementActions" copy.

**Did NOT do (by design):**
- No contract/golden changes; no live integrations; no persona names; no invented
  workstream data.
- Did not implement the full LIM-1219 enforcement panel expansion, Linear payload
  view, or blocked-action widgets.

**Next session should:**
- Let LIM-1219 complete the rest of beats #7-#10 around this preview: status flip,
  simulated Linear workstream, required owners, and blocked customer update.

**Risks / watch:**
- The current Acme fixture has one compiled `EnforcementAction`; the preview accepts
  an array and will render additional compiled actions when the correction compiler
  or richer fixture starts producing them.

---

## Session: LIM-1242 audit reconstruction test (2026-06-27 night)

**Did:**
- Claimed LIM-1242 in Linear, assigned it to Sean, moved it to In Progress, and
  worked only in `/Users/shayaunnejad/liminal/liminal-engine.worktrees/LIM-1242`
  on branch `agent/LIM-1242-audit-reconstruction-test`.
- Added governance-local audit reconstruction support:
  `packages/governance/src/audit-reconstruction.ts` validates AuditEvents through
  the contract, computes `sha256(prevHash + canonical_json(event))`, verifies
  `prevHash` ordering, and rebuilds a GovernanceCase lifecycle from event
  snapshots only.
- Added `packages/governance/src/audit-reconstruction.test.ts` proving the Acme
  case reconstructs as `open -> enforced -> closed` from AuditEvents alone and
  that tampering an earlier event payload invalidates the chain.

**Verified:**
- `node --test packages/governance/src/audit-reconstruction.test.ts` green.
- `pnpm verify` green: typecheck, app typecheck, 64 tests, boundary lint.
- `./scripts/smoke.sh` green for automated tests; manual UI checklist not exercised
  because this issue only changes governance support.

**Did NOT do (by design):**
- No contract/golden changes; no live integrations; no UI changes; no persona copy.
- Did not touch LIM-1229's worktree/branch. LIM-1229 is related context only.

**Next session should:**
- Review the LIM-1242 PR and, after merge, let LIM-1229 build on the verifier if it
  needs broader append-only writer/demo "chain valid" UI support.

**Risks / watch:**
- `eventHash` is not a stored field in the current `AuditEvent` contract, so the
  verifier recomputes head hashes from canonical payloads and detects payload
  tampering through the next event's `prevHash`.

---

## Session: review + merge harness, start LIM-1165 (2026-06-27 eve)

**Did:**
- Reviewed Shayaun's control-harness PR (#1) end to end. Ran its own gates on a
  fresh `pnpm install --frozen-lockfile`: `pnpm verify` green (43 tests, 0 boundary
  violations), goldens current, smoke runs, secrets/legal/identity scans clean.
  Posted a dev-environment review (verdict: merge-after-trivial-fix).
- Retitled PR #1 to lead with **LIM-1199** (real Linear prefix is `LIM-`, not the
  draft `LE-`) so the `linear-id` CI gate passes. Shayaun then pushed `06d4ed4`
  fixing smoke.sh (npm→pnpm) + reconciling draft IDs to `LIM-`. **Merged PR #1**
  (`3792b84`). `main` clean + green.
- **LIM-1165 (Create Acme fixture set):** ratify + harden. The fixture data already
  existed (PR #1's `acme.ts`), so rather than rebuild: added `acmeDemoBeats`
  (verbatim DEMO_CONTRACT display copy for steps 2–4, kept separate from the
  contract-hashed fields so no golden changes), exposed `demoBeats` + `requiredOwners`
  on the single `acmeScenario` source, and added `acme-beats.test.ts` locking beats
  2–4 to the validated fixtures. `pnpm verify` green (47 tests). Branch
  `feature/lim-1165-create-acme-fixture-set`, commit `b065b70` — **not pushed yet.**

**Decided:**
- Treat LIM-1165 as ratify-not-rebuild (user-confirmed) — the harness already
  satisfied AC#1; the honest gap was beat-string fidelity + a single-source test.
- Demo-beat wording lives as presentation copy (`acmeDemoBeats`), NOT in the hashed
  canonical fields — keeps golden hashes stable while matching DEMO_CONTRACT verbatim.

**Did NOT do (by design):**
- No demo UI, no governance use cases, no eval-harness impl, no Gemini/LiveKit/real
  Linear, no persona extraction. Did not push the LIM-1165 branch or open its PR.
- Killed the background adversarial review workflow (it was writing scratch files
  into the repo); its output is advisory, found no blocker before stop.

**Next session should:**
1. Open the LIM-1165 PR (title `LIM-1165: …`, fill the conformance matrix) and merge.
2. **LIM-1166** — build the seven-screen static clickable demo in `apps/desktop-demo/`
   (needs the UI-stack decision: Solid / React / Vite-vanilla — human call).
3. **LIM-1167** — implement typed local state for the click-through.
   Goal: the 14-step Acme loop runs end-to-end on fixtures.

**Risks / watch:**
- UI-stack decision for LIM-1166 is a human gate (LIM-1199 marks it yellow).
- Persona name must NOT be invented; keep generic operator language.
- Branch/PR must carry the `LIM-####` ID or CI's linear-id gate fails.

---

## Session: development control harness (2026-06-27)

**Did:**
- Pulled `origin/main` (the public-repo-setup + demo-contract-alignment commits)
  and reconciled with a control harness built on the prior base (fast-forward; my
  new files preserved, hygiene notes re-applied).
- Layered a spec-to-task-to-PR **control harness** (additive; DEMO_CONTRACT/CLAUDE
  locks untouched). Materialized the pnpm/TS workspace.
- **Reconciled contracts to the updated 14-step / 7-must-not-cut demo contract:**
  `packages/contracts` now models AgentOutput, GovernanceCase, **EnforcementAction**,
  AuditEvent, ActionGate, **EvalCase**, EvalResult (zod + canonical-hash golden
  tests). Acme fixtures assert every must-not-cut item (incl. Linear required
  owners + business goal).
- Hexagonal package members; integrations are fixture stubs. Enforceable gates:
  boundary lint (`spine-no-live-integrations`), CI, lefthook hooks, PR template,
  matrix + linear-id checks. Added `AGENTS.md` + nested AGENTS.md + 5 agent roles;
  filled `ops/linear/AGENT_PACKETS.md` + `ISSUES.md`.
- **Verified green:** 43 tests, typecheck, boundary lint; gates proven to reject
  violations (spine→integration import; contract drift). Not pushed.

**Decided:** commits = allsmog only, never Claude/AI (hooks enforce); overnight = PR-only.

**Did NOT do (by design):** no app/UI (the demo spine — needs a UI-stack decision);
no live Gemini/LiveKit/Linear; did not push (awaiting your go).

**Next session should:**
1. Decide demo-app UI stack; build the static clickable spine on the Acme fixtures.
2. Implement governance use cases + eval harness per the packets.
3. Auth Linear MCP; file `ops/linear/ISSUES.md` as real `LIM-` issues under LIM-1199.

**Risks / watch:** persona name must NOT be invented (persona issue is yellow); keep the spine
deterministic; `pnpm install` pins local `core.hooksPath` so lefthook doesn't
clobber the global attribution hook — keep that in `prepare`.

---

## Session: standalone public repo setup

**Did:**
- Split the scaffold out of the private parent `hackathons/` monorepo into a
  clean standalone repo (`rsync --exclude .git`), fresh `git init` so history
  begins with the hackathon.
- Renamed all references to the canonical repo name **`liminal-engine`** (kept
  the "Liminal Engine — Agentic Work Governance MVP" hackathon framing and the
  "what was built during the hackathon" README section).
- Created the **public** repo `github.com/liminalshruti/liminal-engine` (MIT) and
  pushed `main`.
- Invited **`allsmog`** (Sean) as a collaborator with **push** access (pending
  acceptance).
- Verified: MIT copyright is `Shruti Rajagopal and contributors`; no
  `Liminal, Inc.` ownership claim remains; entity stated as not yet incorporated.

**Decided / confirmed:**
- Canonical public repo name is `liminal-engine` (NOT the long folder name).
- Private parent `hackathons/` repo is **staging only** — never pushed.

**Did NOT do (by design):**
- No app implementation. No real Gemini/LiveKit/Linear.

**Next session should:**
- Build the static clickable demo spine in `apps/desktop-demo/` (see
  `.claude/commands/start-demo-spine.md`), backed by deterministic fixtures.
- Extract persona from `liminal-prototype` (resolve the persona TODO).

**Risks / watch:**
- `allsmog` invite still pending Sean's acceptance.
- Persona name must NOT be invented.

---

## Session: scaffold / setup (this session)

**Did:**
- Inspected parent `hackathons/` repo state; confirmed it's a git repo on `main`
  with remote `github.com/liminalshruti/hackathons` (private). Pulled fresh main
  (fast-forward).
- Created the full project scaffold + all tracking docs.
- Added `.claude/` dev environment (settings + 3 slash commands).
- Added `scripts/smoke.sh` (executable) with build/test + manual checklist.
- Added **MIT LICENSE** (Shruti Rajagopal and contributors — entity not yet
  incorporated; individuals hold copyright).
- Locked the demo contract (Acme false-green) and scope.

**Decided:**
- Publish as a **standalone PUBLIC MIT repo** (not by flipping the private
  multi-project parent public).

**Did NOT do (by design — setup only):**
- No app implementation, no real Gemini/LiveKit/Linear, no nested git repo,
  no old-code copying.

**Next session should:**
1. Build the static clickable demo spine in `apps/desktop-demo/`.
2. Author deterministic fixtures under `packages/`.
3. Extract persona from `liminal-prototype` (resolve the persona TODO).

**Risks / watch:**
- Persona name must NOT be invented.
- Standalone public repo + commit-timestamp net-new boundary must hold.
- `fable-build-day-2026-06-13/` is an unrelated untracked nested git repo in the
  parent — do not touch it.
