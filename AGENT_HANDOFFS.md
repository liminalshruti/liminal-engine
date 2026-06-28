# AGENT_HANDOFFS.md

Append a block after **every** session. Newest at top. The next session reads
this first.

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
