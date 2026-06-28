# TRACEABILITY_MATRIX.md

Verifies that the implementation still matches the intended Liminal Engine hack
demo. **The rule: if it is not visible in the 14-step UI, it does not count for
the demo yet** — backend can be real, tests green, specs perfect, but judges see
the UI.

> Status as of `main` @ `83a6b0a` (2026-06-28). Re-derive `Status` from the PR
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
| Observe | False-green agent output | `screens/AgentActivity.tsx` (STUB) | LIM-1217 «screen-agent-activity» | **Backend done / UI STUB** | Screen not yet filled |
| Detect | Lost EU data residency requirement | `packages/governance`; `ContextTray` "Lost requirement" card | gov-detect; LIM-1216 | **Backend done / UI on main** | Surfaced via `droppedRequirements` |
| Detect | `GovernanceCase` formalized | `screens/GovernanceCase.tsx` (STUB) | LIM-1218 «screen-governance-case» | **Backend done / UI STUB** | Screen not yet filled |
| Correct | Operator clicks Approve + Enforce | `screens/EnforcementPanel.tsx` (filled) | LIM-1219; LIM-1169 (#18 merged) | **Backend + UI on main** | Approve+Enforce handler merged; panel renders it |
| Correct | Compiled-action preview (approve the rule) | `components/EnforcementPreview.tsx` | LIM-1234 (#21 merged) | **UI on main** | Beat #6 depth widget; lists compiled EnforcementActions |
| Enforce status | On Track → At Risk | `EnforcementPanel` `StatusBadge` flip | gov-enforce; LIM-1219 | **UI on main** | Before/After StatusBadge in panel |
| Enforce work | Simulated Linear workstream | `components/LinearPayloadView`; `fixtures.linearWorkstreamPayload` | LIM-1249 (#17 merged); LIM-1219 | **UI on main** | Fixture + view wired into panel |
| Enforce ownership | Product/Security/Engineering required | `fixtures` + Linear panel | LIM-1249; LIM-1219 | **UI on main** | `requiredOwners` rendered |
| Enforce action gate | Blocked customer update (3-part) | `components/BlockedActionBanner.tsx` | gov-proxy LIM-1230 (#14); LIM-1235 (#25 merged) | **Backend + UI on main** | 3-part card: not allowed · why · required-before-send |
| Audit | `AuditEvent` recorded (hash-chained) | `packages/governance/audit-ledger.ts` | LIM-1229 (#19 merged) | **Backend done / UI STUB** | `screens/AuditTrail.tsx` not yet filled |
| Improve | `EvalCase` generated | `packages/eval-harness` | eval; LIM-1220 «screen-second-pass-eval» | **Backend done / UI STUB** | `screens/SecondPassEval.tsx` not yet filled |
| Prove | Eval table Fail → Pass | `components/EvalTable`; `eval-harness` | eval; LIM-1220 | **Backend done / UI STUB** | Final proof; screen not yet filled |

## Determinism / submission-safety

| Item | Artifact | Status |
|---|---|---|
| Deterministic spine (two runs identical) | `packages/governance/determinism.test.ts` | **Done** (LIM-1241 / #23 merged) |
| App `.tsx` in verify/CI gate | `package.json` `verify` → `typecheck:app` | **Done** (LIM-1212 / #12 merged) |
| PolicyRule + ApprovalGate (newly P0) | spec promotion merged; contracts task | **Spec done (#20); contracts build pending (LIM-1251)** |
| Persona extraction (real name) | `liminal-prototype` → DEMO_CONTRACT persona TODO | **Pending** (role-only until extracted) |
| Fallback demo recording | — | **Pending** (needed before submission) |

## Live progress dashboard

```text
Contract locked:        yes
Backend loop:           yes (on main)
Eval Fail → Pass:       yes (backend on main)
UI shell:               yes (on main)
14-step UI:             in progress — 3 of 7 screens filled
  Initialize (#1-2):    yes
  ContextTray (#4):     yes
  EnforcementPanel (#6-10): yes (status flip · Linear · blocked-action · preview)
  AgentActivity (#3):   STUB
  GovernanceCase (#5):  STUB
  AuditTrail (#11):     STUB
  SecondPassEval (#12-14): STUB
Eval visible in UI:     pending (SecondPassEval stub)
Audit visible in UI:    pending (AuditTrail stub)
Persona extraction:     pending
Fallback recording:     pending
Submission safe:        not yet
```

## What's left for the 14-beat walkthrough

Fill the **4 remaining stub screens** — they wire already-built governance/eval
artifacts into the UI:

1. `AgentActivity` (beat #3 — false-green output) — LIM-1217
2. `GovernanceCase` (beat #5 — detected case) — LIM-1218
3. `AuditTrail` (beat #11 — AuditEvent) — LIM-1221
4. `SecondPassEval` (beats #12–14 — EvalCase + Fail→Pass table) — LIM-1220

Do **not** chase Gemini / LiveKit / real Linear / RBAC / dashboards / graph polish
yet — those are P1/P2 and explicitly cut-if-risky (`DEMO_CONTRACT.md`, `SPEC.md`
cut-lines). The next milestone is: **render the already-built governance loop in
the 14-step demo UI.**
