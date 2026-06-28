# CHANGELOG — Liminal Engine — Agentic Work Governance MVP

> Hackathon: Liminal Engine Governance Hack 2026

All notable changes to scope, contract, and structure. Newest first.

## [Unreleased]

### Added — LIM-1339 govern-slate design foundation (2026-06-28)
- `packages/ui-components/src/styles/govern-slate.css` is now the shared
  govern-slate token source, exported as
  `@liminal-engine/ui-components/govern-slate.css` and
  `@liminal-engine/ui-components/design-tokens.css`.
- `apps/desktop-demo/src/styles/design-tokens.css` is reduced to a compatibility
  import of the shared package token source, so the app and ui-components consume
  one token file.
- Added governance-state token bindings for `on-track`, `at-risk`, `blocked`,
  `forwarded`, and `held`; slate surface aliases; type/font scale; spacing,
  radii, and elevation aliases; motion/easing/reduced-motion tokens; focus tokens;
  light/dark theme variants; and presenter density.
- App CSS touched by this migration now uses token references instead of local raw
  color literals/fallbacks.
- Added token source-of-truth, prototype/specimen parity-anchor, variant, and
  no-raw-app-color tests in `packages/ui-components`.
- `packages/eval-harness/test/demo-video.test.ts` now reports its informational
  missing-video note through `t.diagnostic()` instead of `console.log`, preserving
  the no-skip/manual-artifact check while keeping the default Node runner green.

### Added — LIM-1372 real-product contracts, signal harness, Gemini REST receipts (2026-06-28)
- Added shared-kernel contracts for `DriftSignal`, `LlmRequest`, `LlmOutcome`,
  `EndpointConfig`, `TransformRule`, `ResourceAllocation`, `RoutingRule`, and
  `NlIntent`, all exported from `@liminal-engine/contracts`, registered in the
  golden contract registry, and covered by invariant tests.
- Added `packages/signal-harness`, a real deterministic harness that detects
  requirement drift from arbitrary active requirements + agent output, applies
  transform rules, routes signals/intents through endpoint configs, and creates
  role resource allocations for severe open signals.
- Expanded `packages/eval-harness` with contract-validated read results plus pure
  eval-case generation and requirement-coverage grading from real inputs, while
  retaining the upstream rule-health table.
- Expanded `packages/ui-components` with framework-agnostic view-model helpers for
  signals, endpoint configs, NL intents, resource allocations, routing rules, and
  eval summaries.
- Added `GeminiRestAgentOutputSource`, a real Gemini REST adapter that constructs
  `generateContent` requests, parses contract-shaped `AgentOutput`, and records
  `LlmRequest`/`LlmOutcome` receipts. The upstream cache-backed
  `GeminiAgentOutputSource` and deterministic fixture source remain available.

### Added — LIM-1367 policy intercept control plane (2026-06-28)
- `packages/contracts/src/action-policy-rule.contract.ts` — a separate learned
  allow/deny/ask action-policy contract for intercepted tool actions. This avoids
  colliding with the existing remediation `PolicyRule` used by the correction
  pipeline while still pinning canonical/golden hashes for learned proxy rules.
- `packages/contracts/src/intercepted-action.contract.ts` now rejects undeclared
  fields at the boundary and carries provenance for action-level auditability.
- `packages/policy/` — pure action-policy decision engine with `shadow`,
  `intercept`, and `learned` modes, target scope, deterministic specificity
  ordering, fail-closed store errors, rule narrowing helpers, and escalation/safety
  metrics.
- `packages/governance/src/compile-correction.ts` now compiles concrete operator
  corrections into `ActionPolicyRule` proposals, activation actions, eval cases,
  and preview rows; vague corrections fail closed with actionable errors.
- `packages/governance/src/policy-audit.ts` records action-policy verdicts/rules
  into the existing hash-chained audit ledger and reconstructs rule lifecycle from
  audit events.
- `packages/integrations/intercept-gateway/` — HTTP gateway, `policy-gw` CLI,
  gh/git/deploy shims, MCP destructive-call classifier, target scope,
  match/replace, queue controls, forward/drop/bulk controls, repeater, immutable
  proxy history, and command outcome recording.
- `packages/integrations/policy-store/` — in-memory and file-backed action-policy
  stores plus intercept queues. `policy-gw serve --session-dir <path>` persists
  learned rules, pending intercepts, and proxy history across gateway restart.

### Added — LIM-1197 demo video infrastructure (2026-06-28)
- `demos/recordings/README.md` — guide for judges explaining the demo video,
  verification checklist, and fallback reference to `demos/fallback/WALKTHROUGH.md`.
  Judge-facing: where and how to watch the recording.
- `scripts/record-demo-help.md` — detailed step-by-step instructions for recording
  the demo (QuickTime / OBS / Windows Game Bar). Lists all 14 beats, timing guidance
  (target: under 3 minutes), and verification steps.
- `scripts/verify-demo-video.sh` — bash script to verify the video file exists,
  is readable, and is non-zero size. Run before final submission to confirm the
  recording is in place (`demos/recordings/acme-governance-demo.mp4`).
- `packages/eval-harness/test/demo-video.test.ts` — Node test that verifies:
  - The `demos/recordings/` directory exists
  - A video file (mp4/mov/webm/mkv/avi) exists (if present; skips gracefully if not)
  - The file is readable and non-zero size
  - The recording README exists
  
  The test runs as part of `pnpm verify`. It's informational (skips if video not
  yet recorded) but will confirm the video is ready before submission.

The video is the **manual recording step** for LIM-1197 — a single operator clicks
through the 14-step demo in the live app (apps/desktop-demo/), capturing the full
governance loop `observe → detect → correct → enforce → audit → improve` on the Acme
$1.2M false-green scenario. Target: under 3 minutes, deterministic (no flakiness),
no invented persona names. The video serves the **Live Demo criterion** (20% of rubric).

**Next:** Record the demo video and place it in `demos/recordings/acme-governance-demo.mp4`.

### Added — LIM-1248 data-residency / redaction proof surface (STRETCH) (2026-06-27)
- `packages/contracts/src/redact.ts` — a pure `redact(value) → RedactedRef` helper
  (marker + scheme + `canonical-hash` digest, no new hash invented), plus
  `isRedactedRef` / `verifyRedaction`. Lives in the kernel alongside `canonical-hash`
  so the audit path, the UI, and the demo fixtures share one helper without a
  boundary break. Golden/unit-tested in `packages/contracts/test/redact.test.ts`.
- `packages/governance/src/redact.ts` — the audit-path application: the
  `SENSITIVE_AUDIT_KEYS` policy + `redactAuditSnapshot` / `redactAuditEventSnapshots`.
  Applied at the audit-ledger WRITE boundary (`audit-ledger.ts` `append`), so the
  single append-only writer can never seal raw sensitive customer / EU-personal data
  into the hash chain. Idempotent + scoped, so events carrying only structural
  governance state are unchanged (hashes stable; chain, determinism, reconstruction,
  and goldens all still pass).
- `packages/contracts/src/fixtures/acme.ts` — additive `sensitiveCustomerClaim`,
  `dataResidencyRef`, and `dataResidencyAuditEvent` (an `AuditEvent` payload carrying
  the redacted reference). The pinned `acmeAuditEvent` is unchanged.
- `apps/desktop-demo/src/screens/AuditTrail.tsx` — a minimal, fixture-driven
  "Data residency" note (labeled Simulated) showing sensitive data is stored by
  reference/hash, never raw. Composes with live-wire audit event from `useDemo()` loop
  while displaying redacted reference from fixtures (LIM-1255).
- `packages/governance/src/audit-redaction.test.ts` — proves the audit path stores no
  raw sensitive value (only the hash/redacted ref) and that the chain + both
  reconstructors still verify. No contract shape/golden change (no `regen:goldens`).

### Fixed — SCOPE_SPEC.md: PolicyRule/ApprovalGate COVERED, not P0-build (LIM-1251, 2026-06-28)
- Last spec contradiction reconciled. `SCOPE_SPEC.md` still listed `PolicyRule` +
  `ApprovalGate` as "P0 entities to extend in contracts," but LIM-1251 / PR #26
  established they're **covered by existing contracts, no new build** (demo steps
  9/11 render from `EnforcementAction.actionType` `require_approval`/`activate_policy`
  + `AuditEvent` + `LinearWorkstreamPayload.requiredOwners`). `SCOPE_SPEC.md` is
  reconciled to the covered/post-hack conclusion; the matching `specs/SPEC.md` edit
  is the paired PR #26 (both land together to close the contradiction). Docs-only.
### Added — LIM-1239 agent-activity trace cards (2026-06-28)
- `apps/desktop-demo/src/screens/AgentActivity.tsx` now renders the beat #3
  false-green output with fixture-backed per-agent trace cards showing which Acme
  artifacts Product, Security, and Engineering agents used.
- `apps/desktop-demo/src/screens/AgentActivityTrace.ts` plus tests derive the
  trace cards and missing-requirement evidence line from `acmeScenario`, proving
  `EU data residency` was present in the customer call but missing from the
  first-pass output. No contract, fixture, or golden changes.
### Added — LIM-1244 quality a11y pass (2026-06-28)
- `apps/desktop-demo/src/App.tsx` now has a keyboard-first skip button, active-step
  `aria-current`, labeled Back/Next controls, and focus handoff to the current beat
  title after navigation.
- Desktop demo components now include hidden eval-table captions, decorative
  status/eval dots and alert icons hidden from assistive tech, and a named simulated
  Linear workstream region.
- `apps/desktop-demo/src/styles/app.css` now guards visible focus, 44px control
  targets, higher-contrast pass/fail/focus colors, responsive wrapping, and
  zero letter spacing in the app stylesheet.
- `apps/desktop-demo/src/a11y-demo.test.ts` locks keyboard/focus, target-size,
  contrast, and caption guardrails for the demo UI.

### Added — LIM-1238 second-pass causal narration + checks table (2026-06-28)
- `apps/desktop-demo/src/screens/SecondPassEval.tsx` now renders beats #12-#14
  from Acme fixtures: EvalCase generated, improved second-pass output, causal
  narration, the shared EvalTable, and an explicit per-check before/after table
  showing `FAIL -> PASS`.
- `apps/desktop-demo/src/screens/SecondPassEval.model.ts` computes deterministic
  criterion-grouped before/after rows from eval-harness display rows. No contract,
  golden, or live-integration changes.

### Added — LIM-1235 3-part blocked-action card (2026-06-28)
- `apps/desktop-demo/src/components/BlockedActionBanner.tsx` now renders the
  blocked downstream customer update as an explicit 3-part card: `Not allowed`,
  `Why blocked`, and `Required before send` from `ActionGate.requiredBeforeSend`.
- `apps/desktop-demo/src/screens/EnforcementPanel.tsx` now renders the
  fixture-backed enforcement path for beats #6-#10: Approve + Enforce, On Track
  -> At Risk, simulated Linear workstream + required owners, attempted on-track
  customer update, and the blocked-action card. No live integrations or contract
  changes.
### Added — LIM-1234 compiled-enforcement preview (2026-06-28)
- `apps/desktop-demo/src/components/EnforcementPreview.tsx` — contract-typed preview
  of the compiled `EnforcementAction` objects queued for approval.
- `apps/desktop-demo/src/screens/EnforcementPanel.tsx` now renders the preview before
  the enforce transition text so demo beat #6 shows the rule set before
  Approve + Enforce. No contract or golden changes.

### Added — LIM-1242 audit reconstruction test (2026-06-27)
- `packages/governance/src/audit-reconstruction.ts` — verifies AuditEvent hash
  chains by recomputing `sha256(prevHash + canonical_json(event))` and rebuilds a
  GovernanceCase lifecycle from `beforeState`/`afterState` snapshots only.
- `packages/governance/src/audit-reconstruction.test.ts` — locks the Acme case
  reconstruction invariant (`open -> enforced -> closed`) and proves payload
  tampering invalidates the chain. No contract or golden changes.

### Decided — demo-spine UI stack (2026-06-27)
- **Demo-spine stack locked: React + Vite (SPA), styled against `liminal-prototype`
  CSS cuts.** Chosen over Solid/liminal-desktop continuity. Rationale: a throwaway
  3-minute demo spine is judged on the click-through and visual fidelity, not on
  sharing the product's framework. `liminal-desktop` is a Tauri app (heavyweight to
  run live); `liminal-prototype` ships its visual identity as **portable CSS**
  (`design-system/tokens/design-tokens.css` + cuts), liftable directly. Net-new
  per CLAUDE.md; adapted CSS marked `ADAPTED FROM`. Flips the demo-spine issue
  yellow→green.

### Added — demo-shell session (2026-06-27)
- **`apps/desktop-demo/`** stood up: React 18 + Vite + TS SPA shell. Vendored the
  canonical `design-tokens.css` from `liminal-prototype` (single source of truth,
  marked ADAPTED FROM). Renders an empty 14-step stepper frame against the Acme
  fixtures from `@liminal-engine/contracts` — the static click-through spine to be
  filled per `DEMO_CONTRACT.md`. No governance/eval logic yet (those are the next
  P0s).

### Added — judging-map session (2026-06-27)
- **`JUDGING_MAP.md`** (LIM-1157) — maps every rubric criterion (Technicality 40%
  / Creativity 25% / Live Demo 20% / Future Potential 15%) and the required theme
  (primary **Self-Improvement Stack**, secondary **Continual Learning**) to a
  specific demo beat or artifact from `DEMO_CONTRACT.md`, plus an explicit
  coverage table flagging where the demo does not yet serve a criterion. No
  contract change — reads the locked path. Cross-linked from `SUBMISSION.md`.

### Changed — LIM-1165 Acme fixture set (2026-06-27 eve)
- Control harness (PR #1) **merged to `main`**.
- `packages/contracts/src/fixtures/acme.ts` — added `acmeDemoBeats`: verbatim
  DEMO_CONTRACT display copy for demo steps 2–4 (goal, false-green claim, dropped
  EU requirement), held separate from the contract-hashed fixture fields so on-screen
  wording matches the contract without changing any golden hash. Exposed `demoBeats`
  + `requiredOwners` on the single-source `acmeScenario`.
- `packages/contracts/test/acme-beats.test.ts` — new test locking beats 2–4 and the
  single-source invariant to the validated fixtures. No contract/golden change.

### Added — control-harness session (2026-06-27)
- **Development control harness** layered onto the scaffold (additive; product
  locks untouched). Materialized the pnpm/TypeScript workspace.
- `packages/contracts` — the locked domain primitives as zod contracts with a
  canonical hash + golden tests (mirrors `liminal-agents-v1` substrate). Reconciled
  to the updated 14-step / **7 must-not-cut** demo contract: now **AgentOutput,
  GovernanceCase, EnforcementAction, AuditEvent, ActionGate, EvalCase, EvalResult**
  (added EnforcementAction + EvalCase; EvalResult links to EvalCase). Acme fixtures
  validate through the contracts and assert every must-not-cut invariant (incl.
  the Linear workstream's required Product/Security/Engineering owners + the
  `$1.2M ARR` business goal).
- `packages/{engine-core,governance,eval-harness,ui-components,integrations/*}` —
  hexagonal members; engine-core has the locked status state machine; integrations
  are fixture stubs (no live calls on the spine).
- Enforceable gates: `.dependency-cruiser.cjs` boundary lint (incl.
  `spine-no-live-integrations`), CI `conformance.yml`, lefthook hooks, PR template,
  conformance-matrix + linear-id checks. Verified the gates reject violations.
- `AGENTS.md` (complements CLAUDE.md) + nested package AGENTS.md + 5 agent roles;
  filled `ops/linear/AGENT_PACKETS.md` + `ops/linear/ISSUES.md`.

### Decided — control-harness session
- **Commits attributed to allsmog only, never Claude/AI** (lefthook + global hook).
- **Overnight agents are PR-only** (open PRs; never auto-merge / mark Done).

### Added — scaffold session
- Project scaffold: docs, `apps/`, `packages/`, `ops/`, `demos/`, `retros/`.
- `DEMO_CONTRACT.md` locking the Acme false-green scenario, required demo path,
  must-not-cut and cut-if-risky lists, persona rule, acceptance criteria.
- `CLAUDE.md` build rules (static first, fixtures first, don't redesign, don't
  invent persona, don't make a dashboard the hero).
- `.claude/` dev environment: `settings.json` permissions + slash commands
  (`start-demo-spine`, `smoke`, `handoff`).
- `scripts/smoke.sh` — build/test runner + manual demo checklist.
- **MIT `LICENSE`** (copyright Shruti Rajagopal and contributors — entity not
  yet incorporated).

### Decided — scaffold session
- **Repo strategy:** publish as a **standalone PUBLIC MIT repo** rather than
  making the multi-project private parent public. Parent `hackathons/` retains
  history; standalone repo gives the cleanest net-new boundary.
