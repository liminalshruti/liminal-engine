# UI_FANOUT_PLAN.md — scope, spec & decomposition for the screen fan-out → launch-ready

> Planning doc for the M1 UI completion. Pins to `DEMO_CONTRACT.md` (beats `#N`,
> must-not-cut `MNC#N`), `specs/SPEC.md` (architecture), `specs/TASKS.md` (canonical
> tasks), and `apps/desktop-demo/AGENTS.md` (the screen seam). If this conflicts with
> `DEMO_CONTRACT.md`, the contract wins and this file is the bug.
>
> Status as of 2026-06-28: foundations merged (components LIM-1214, contracts LIM-1227,
> CI .tsx gate LIM-1212, ActionGate v2 LIM-1230). **Open PRs:** #15 mount (LIM-1226,
> APPROVE), #17 LinearPayload fixture (LIM-1249), #20 PolicyRule/ApprovalGate P0 promotion
> (docs; CI red on conformance-matrix gate — body needs the filled matrix), #18
> Approve+Enforce (LIM-1169), #19 audit-ledger (LIM-1229, conflicting). **Decision D1 = D1-a**
> (fixtures now, loop-wire later via LIM-1245). **New task LIM-1250** = build PolicyRule +
> ApprovalGate contracts (§4a).

---

## 1. Goal & definition of "launch-ready"

Launch-ready = the locked 14-step Acme demo path runs end-to-end on the spine, every
must-not-cut item is **visible on screen** (not a text summary), and the run is
**deterministic + e2e-proven**. This plan takes us from "mount mechanism + stubs" to
that bar.

Launch-ready acceptance (from `DEMO_CONTRACT.md` + `JUDGING_MAP.md`):
- [ ] All 7 screens render their beats with real widgets (StatusBadge flip, Linear
      panel, blocked banner, audit trail, Fail→Pass eval table).
- [ ] Each MNC#1–7 is visibly present on screen.
- [ ] Walkthrough completes < 3 min; re-running is deterministic.
- [ ] Automated e2e drives all 14 beats; determinism test asserts identical artifacts.
- [ ] No invented persona name anywhere on screen.

---

## 2. Scope

### In scope
- Fill the 7 screen stubs (LIM-1215–1221) against the LIM-1214 components seam.
- The single architecture decision blocking the fan-out: **fixtures vs. loop output**
  (see §5, Decision D1).
- Launch-ready proof: e2e click-through (LIM-1240), determinism test (LIM-1241),
  and — if D1 says so — wiring screens to `runGovernanceLoop`/`runEvals` (LIM-1245).

### Newly in scope (2026-06-28 — PolicyRule/ApprovalGate promoted to P0)
- `SPEC.md` line 78/100 reconciled (commit `22fa335`, branch
  `chore/promote-policyrule-approvalgate-p0`, unpushed): **PolicyRule + ApprovalGate are
  now P0**, matching `SCOPE_SPEC.md` + cut-lines. **The contracts do not exist yet** →
  a new foundation task is required (see §4a). This is independent of the screen fan-out
  but part of "P0 spine reality."

### Out of scope (explicitly)
- Real Gemini / LiveKit / Linear API (cut-if-risky; fixtures stand in).
- Persona-accurate copy (LIM-1190 — separate, YELLOW, fills `src/lib/copy.ts` later).
- The parallel engine PRs in flight (#18 Approve+Enforce, #19 audit ledger) — tracked
  by their owners; this plan only consumes their merged contracts.
- Any redesign of the loop, the 14-step path, or the component props (frozen seam).

---

## 3. Dependency DAG (what unblocks what)

```
MERGED: components(1214) · contracts(1227) · CI-gate(1212) · ActionGate-v2(1230)
   │
OPEN, GATING:  #15 mount(1226) ──┬── unblocks ALL 7 screens
               #17 fixture(1249) ─┘   (1249 specifically unblocks 1219)
   │
   ▼  (once #15 + #17 merge)
Wave A — 7 screens, FILE-DISJOINT, parallel:
   1215 Initialize · 1216 ContextTray · 1217 AgentActivity · 1218 GovernanceCase
   1219 EnforcementPanel(needs 1249) · 1220 AuditTrail · 1221 SecondPassEval
   │
   ▼  (once screens merge)
Wave B — launch-ready proof:
   1245 wire-to-loop (IF D1=loop) · 1240 e2e click-through · 1241 determinism test
```

- **Peak parallelism:** 7 screen agents in Wave A (each owns one `src/screens/*.tsx`).
- **Mutex:** one agent / one worktree / one screen file per task. `App.tsx`, `steps.tsx`,
  `lib/copy.ts`, `components/*` are NOT edited by screen agents (the seam holds them stable).

---

## 4. Wave A — the 7 screens (decomposed)

Each screen FILLS its stub (created by LIM-1226). Owned file is disjoint. Every screen:
reads facts from `acmeScenario`, framing copy from `SCREEN_COPY` (`src/lib/copy.ts`),
renders with widgets from `../components`; no live calls; no persona name; PR-only with
conformance matrix; verify with `pnpm verify` (incl. `typecheck:app`) + smoke.

| Task | Screen file | Beats | MNC | Components used | Fixture(s) read |
|---|---|---|---|---|---|
| **LIM-1215** | `Initialize.tsx` | 1–2 | — | Card | `businessGoal` |
| **LIM-1216** | `ContextTray.tsx` | 4 | — | Card | `demoBeats` (dropped req), context |
| **LIM-1217** | `AgentActivity.tsx` | 3 | **#1** | Card, StatusBadge | `agentOutputPass1` (false green) |
| **LIM-1218** | `GovernanceCase.tsx` | 5 | **#2** | Card + `caseHeadline()` (ui-components) | `governanceCase` |
| **LIM-1219** | `EnforcementPanel.tsx` | 6–10 | **#3,#4,#5** | StatusBadge, LinearPayloadView, BlockedActionBanner | `enforcementAction`, `linearWorkstreamPayload` (1249), `blockedAction` |
| **LIM-1220** | `AuditTrail.tsx` | 11 | **#6** | TraceRow ×N, Card | `auditEvent` |
| **LIM-1221** | `SecondPassEval.tsx` | 12–14 | **#7** | Card, StatusBadge, EvalTable | `evalPass1/2`, `agentOutputPass2`, `evalCase` |

**Per-screen acceptance:** the beat(s) render with the listed widget(s); the MNC item is
visibly present; data comes only from `acmeScenario`/loop output; `pnpm verify` + smoke
green; no persona name; PR conformance + acceptance matrices filled.

**Sequencing note:** LIM-1219 is the heaviest (3 MNC, 3 widgets) and depends on the
LIM-1249 fixture — start it only after #17 merges. The other 6 are unblocked by #15 alone.

---

## 4a. PolicyRule + ApprovalGate — RESOLVED: no new contracts for the hack

History (one day, two reversals): briefly promoted to P0 as new contracts (my filed
task LIM-1250) → **reversed 2026-06-28**. SPEC.md on main (line 78) now states the
policy/approval behavior is **COVERED by existing contracts** — demo steps 9 + 11 render
via `actionType: require_approval` / `activate_policy` + `AuditEvent` +
`LinearWorkstreamPayload.requiredOwners`. First-class `PolicyRule`/`ApprovalGate` entities
are **POST-HACK** (tracked LIM-1251).

**Net for this plan: no contracts-build task in scope.** LIM-1250 canceled (superseded).
PR #24 finalizes the remaining stale SPEC.md lines. Nothing here gates Wave A.

## 5. Decisions to resolve BEFORE Wave A dispatch

### D1 (BLOCKING) — fixtures vs. loop output
`apps/desktop-demo/AGENTS.md` + the screen issues say screens **read `acmeScenario`
fixtures directly**. But **LIM-1245** says screens should render **`runGovernanceLoop`/
`runEvals` output**, not raw fixtures, so loop and UI can't diverge on stage.

These are two different wiring patterns. Building 7 screens against fixtures and then
re-wiring them to loop output is rework. Options:
- **D1-a (fixtures now, wire later):** screens read `acmeScenario`; LIM-1245 re-points the
  data source afterward via a thin `src/lib/` view-model adapter. Simplest screens; one
  adapter swap later. *Recommended* — keeps Wave A unblocked and the swap centralized.
- **D1-b (loop output now):** LIM-1245's data-wiring layer lands FIRST (Wave A0), screens
  consume it from day one. No rework, but adds a serial dependency before the fan-out and
  couples every screen to the loop API shape now.

**DECIDED 2026-06-28 → D1-a** (Shruti). Screens read `acmeScenario` fixtures now;
**LIM-1245** re-points the data source afterward via a thin `src/lib/` view-model adapter
(one centralized swap, no per-screen rework). Wave A proceeds with the fixtures pattern;
the AGENTS.md seam already documents this. LIM-1245 moves to Wave B as the loop-wiring step.

### D2 — screen-agent dispatch model
Who builds the 7 screens: (a) orchestrator dispatches 7 implementer subagents in
parallel worktrees, or (b) Sean's lane builds them, or (c) mixed. Affects coordination,
not architecture.

---

## 6. Wave B — launch-ready proof

| Task | Owns | Deliverable | Dep |
|---|---|---|---|
| **LIM-1245** | `apps/desktop-demo/src/lib/*` data layer | screens consume `runGovernanceLoop`/`runEvals` (per D1) | after screens (D1-a) or before (D1-b) |
| **LIM-1240** | `apps/desktop-demo/test/*` | e2e drives 14 beats; asserts counts (1 case, enforce actions, 1 deny, 1 EvalCase, Fail→Pass); pinpoints the broken beat | after screens merge |
| **LIM-1241** | determinism test under `tests/`/`packages/` | run loop twice from clean state → byte-identical GovernanceCase/EnforcementAction/AuditEvent/EvalResult | after loop stable (largely now) |

**Wave B acceptance = launch-ready acceptance (§1).** LIM-1241 can start almost
immediately (loop is stable); LIM-1240 needs the screens; LIM-1245 is gated on D1.

---

## 7. Risks & mitigations

- **Main moves under open PRs** (happened 3× this session: #13/#14 broke or conflicted
  open PRs). *Mitigation:* re-verify every open PR against main on each merge; never trust
  "mergeable" — run `pnpm verify` incl. `typecheck:app`.
- **Engine PRs in flight (#18, #19)** may touch contracts the screens consume. *Mitigation:*
  screens depend only on MERGED contracts; reconcile if they land mid-fan-out.
- **D1 unresolved → rework.** *Mitigation:* resolve D1 before dispatch (§5).
- **Conformance-matrix CI gate** fails on wrong column format. *Mitigation:* use
  `Requirement | Source | Implemented in | Test / evidence | Notes`; validate locally with
  `tools/check-conformance-matrix.mjs` before pushing.

---

## 8. Execution order (the critical path)

1. **Merge #15 (mount) + #17 (fixture).** ← gates everything.
2. **Resolve D1** (fixtures-vs-loop). ← gates Wave A wiring pattern.
3. **Dispatch Wave A** — 6 screens immediately (1215/1216/1217/1218/1220/1221), 1219 after #17.
4. **Review + merge screens** (PR-only; reconcile against main per §7).
5. **Wave B** — LIM-1245 (per D1) → LIM-1240 e2e → LIM-1241 determinism.
6. **Launch-ready check** against §1 acceptance; record fallback (LIM-1192) if desired.
