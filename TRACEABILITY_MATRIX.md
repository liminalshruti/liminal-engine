# TRACEABILITY_MATRIX.md

Verifies that the implementation still matches the intended Liminal Engine hack
demo. **The rule: if it is not visible in the 14-step UI, it does not count for
the demo yet** — backend can be real, tests green, specs perfect, but judges see
the UI.

> Status as of `main` @ `99f7279` (2026-06-28, post-#51 live-wire). Re-derive `Status` from the PR
> merge-state on GitHub, **not** from Linear status — the board has multiple
> concurrent writers and Linear status flaps.

## Source of truth

- Product contract: `DEMO_CONTRACT.md` (the 14 steps + 7 must-not-cut)
- Current progress: `SESSION_STATE.md`
- Judging alignment: `JUDGING_MAP.md`
- Agent instructions: `CLAUDE.md`
- Build plan: `specs/TASKS.md`
- P0 lens: `ops/linear/P0_ISSUES.md`

## Core-loop traceability (observe → detect → correct → enforce → audit → improve)

| Loop beat | Required visible proof | Repo artifact | Task / issue | Status | Notes |
|---|---|---|---|---|---|
| Observe | Workspace init + business goal | `screens/Initialize.tsx` (filled) | LIM-1215 (#22 merged) | **UI on main** | Renders deal + goal + operator role from fixtures |
| Observe | Context cards + agent trace | `screens/ContextTray.tsx` (filled) | LIM-1216 (#28 merged) | **UI on main** | Engagement / agent-trace / lost-requirement cards |
| Observe | False-green agent output | `screens/AgentActivity.tsx` (filled) | LIM-1217 (#36 merged) | **UI on main (live `useDemo()`)** | Renders false-green claim + on-track status; reveal of EU residency deferred to beat #4/#5 |
| Detect | Lost EU data residency requirement | `packages/governance`; `ContextTray` "Lost requirement" card | gov-detect; LIM-1216 | **Backend done / UI on main** | Surfaced via `droppedRequirements` |
| Detect | `GovernanceCase` formalized | `screens/GovernanceCase.tsx` (filled) | LIM-1218 (#43 merged) | **UI on main (live `useDemo()`)** | Case headline, severity/category/detection + businessImpact/missing-from/recommended-actions (LIM-1254 #50); engine-produced |
| Correct | Operator clicks Approve + Enforce | `screens/EnforcementPanel.tsx` (filled) | LIM-1219; LIM-1169 (#18 merged) | **Backend + UI on main** | Approve+Enforce handler merged; panel renders it |
| Correct | Compiled-action preview (approve the rule) | `components/EnforcementPreview.tsx` | LIM-1234 (#21 merged) | **UI on main** | Beat #6 depth widget; lists compiled EnforcementActions |
| Enforce status | On Track → At Risk | `EnforcementPanel` `StatusBadge` flip | gov-enforce; LIM-1219 | **UI on main** | Before/After StatusBadge in panel |
| Enforce work | Simulated Linear workstream | `components/LinearPayloadView`; `fixtures.linearWorkstreamPayload` | LIM-1249 (#17 merged); LIM-1219 | **UI on main** | Fixture + view wired into panel |
| Enforce ownership | Product/Security/Engineering required | `fixtures` + Linear panel | LIM-1249; LIM-1219 | **UI on main** | `requiredOwners` rendered |
| Enforce action gate | Blocked customer update (3-part) | `components/BlockedActionBanner.tsx` | gov-proxy LIM-1230 (#14); LIM-1235 (#25 merged) | **Backend + UI on main** | 3-part card: not allowed · why · required-before-send |
| Audit | `AuditEvent` recorded (hash-chained) | `packages/governance/audit-ledger.ts`; `screens/AuditTrail.tsx` (filled) | LIM-1229 (#19); LIM-1221 (#31 merged) | **Backend + UI on main** | AuditTrail screen renders the recorded events |
| Improve | `EvalCase` generated | `packages/eval-harness`; `screens/SecondPassEval.tsx` (filled) | eval; LIM-1220 (#30 merged) | **Backend + UI on main** | SecondPassEval screen renders the generated eval |
| Prove | Eval table Fail → Pass | `components/EvalTable`; `screens/SecondPassEval.tsx` (filled) | eval; LIM-1220 (#30 merged) | **Backend + UI on main** | Fail→Pass table on the SecondPassEval screen |

## Determinism / submission-safety

| Item | Artifact | Status |
|---|---|---|
| Deterministic spine (two runs identical) | `packages/governance/determinism.test.ts` | **Done** (LIM-1241 / #23 merged) |
| App `.tsx` in verify/CI gate | `package.json` `verify` → `typecheck:app` | **Done** (LIM-1212 / #12 merged) |
| PolicyRule + ApprovalGate | covered by existing `ActionGate`/`EnforcementAction`/`AuditEvent` contracts | **Covered for hack; first-class modeling post-hack (LIM-1251, docs PRs #44/#26)** |
| Persona extraction (real name) | `liminal-prototype` → DEMO_CONTRACT persona TODO | **Pending** (role-only until extracted) |
| Fallback demo recording | — | **Pending** (needed before submission) |

## Live progress dashboard

```text
Contract locked:        yes
Backend loop:           yes (on main)
Eval Fail → Pass:       yes (backend on main)
UI shell:               yes (on main)
14-step UI:             COMPLETE — 7 of 7 screens filled, all live-wired to useDemo()
  Initialize (#1-2):    yes
  ContextTray (#4):     yes
  EnforcementPanel (#6-10): yes (status flip · Linear · blocked-action · preview)
  AuditTrail (#11):     yes (#31 merged)
  SecondPassEval (#12-14): yes (#30 merged)
  AgentActivity (#3):   yes (#36 merged)
  GovernanceCase (#5):  yes (#43 merged; evidence fields #50)
Live-wire (UI==engine): yes (#51 merged — all 7 screens render buildGovernanceDemo() output)
Eval visible in UI:     yes (SecondPassEval merged)
Audit visible in UI:    yes (AuditTrail merged)
E2E 14-beat guard:      yes (18/18 pass, 0 skipped — #45/#49 merged)
Persona extraction:     pending
Fallback recording:     pending (highest-ROI remaining manual artifact)
Submission safe:        spine complete + test-backed; pending fallback video + <3min rehearsal
```

## What's left for the 14-beat walkthrough

The 14-step UI spine is **complete and live-wired** — all 7 screens render the real
`buildGovernanceDemo()` loop output (#51), guarded by an 18/18 e2e click-through
(#45/#49). Remaining items are **submission hardening**, not product build:

1. Record the deterministic fallback demo (founder lane — highest-ROI artifact).
2. Time the full live walkthrough under 3 minutes.
3. Final claim-scan (no `Liminal, Inc.`, no invented persona, no live-integration overclaim).

Do **not** chase Gemini / LiveKit / real Linear / RBAC / dashboards / graph polish
on the core spine — those are P1/P2 and explicitly cut-if-risky (`DEMO_CONTRACT.md`,
`SPEC.md` cut-lines). Stretch work is scoped incrementally as separate, isolated
surfaces that must not destabilize the merged spine.
