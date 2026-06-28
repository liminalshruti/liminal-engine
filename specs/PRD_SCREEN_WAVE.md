# PRD — Demo Screen Wave (Build/Sequencing)

> Hackathon: Liminal Engine Governance Hack 2026
> Status: **Build PRD** — consolidates and sequences existing locked specs. Does **not** fork them.
> Source of truth (precedence): `DEMO_CONTRACT.md` (14 beats + 7 must-not-cut) → `specs/SPEC.md` (engine wiring) → `apps/desktop-demo/AGENTS.md` (UI layer) → `specs/TASKS.md` (DAG). Where this PRD and any of those disagree, **those win** and this PRD is wrong.
> Date: 2026-06-28. Author POV throughout.

---

## 0. One-paragraph thesis

The engine is built and the components are built; what's missing is the **last mile that makes the loop visible** — seven screens that render the locked 14-beat Acme false-green path end-to-end. This is the highest-leverage work remaining because the demo fails on *visibility of enforcement*, not on engine correctness (`DEMO_CONTRACT.md` §"Demo FAILS if": "Enforcement is not visible → the product reads as alerting, not governance"). The wave is **collision-free by construction** (each screen owns a disjoint file) but **strictly ordered by two hard blockers** I verified against `main`: there is no `src/screens/` directory yet (LIM-1226 must create it first), and there is no `LinearWorkstreamPayload` instance in `acmeScenario` yet (LIM-1249 must land before the enforcement panel can render real workstream data). Get those two in, fan the seven screens out in parallel, then wire live governance output. Do not reorder.

---

## 1. Scope

**In:** LIM-1226 (spine-shell-v2), LIM-1249 (Acme Linear fixture), LIM-1215–1221 (7 screens), LIM-1245 (wire screens to live governance output). Plus the three React key-safety carry-overs from PR #11, fixed *in the screen that consumes the component* (not as a separate cleanup PR).

**Out (explicitly):** Real Gemini / LiveKit / Linear-API calls (fixtures stand in — `SCOPE_SPEC.md`). A metrics dashboard as hero (`CLAUDE.md` hard rule). New contract surfaces (enforcement-detail objects are LIM-1227 v2, *not* invented per-screen — `DEMO_CONTRACT.md` per-beat note). Persona-name copy (stays generic until extracted from `liminal-prototype` — LIM-1227/«persona» YELLOW). Animations/polish on non-spine screens (`cut-if-risky`).

---

## 2. Verified dependency state (ground truth, `main` @ 2026-06-28)

| Fact | Verified how | Implication |
|---|---|---|
| `src/screens/` does **not** exist | `ls apps/desktop-demo/src/screens/` → No such file | **LIM-1226 is the hard blocker.** No screen task can start; `App.tsx` has a hardcoded placeholder and `DemoStep` has no component pointer. |
| `acmeScenario` exists & exported | `packages/contracts/src/fixtures/acme.ts:135` | Screens can `import { acmeScenario } from "@liminal-engine/contracts/fixtures"` today. |
| `runGovernanceLoop` exists & exported | `packages/governance/src/use-cases.ts:167` | LIM-1245 can wire real loop output, not just static fixtures. |
| `toRows` exists & exported | `packages/eval-harness/src/index.ts:17` | EvalTable (MNC#7) has its real data builder. |
| `LinearWorkstreamPayload` **not** in `acmeScenario` | grep of `packages/contracts/src/fixtures` → no match | **LIM-1249 blocks LIM-1219** (enforcement panel). The contract type landed in PR #13; the *instance* did not. |
| Components landed | PR #11 merged squash `a3bcd0c` | The 7 screens' `../components` barrel is ready and props are FROZEN. |

---

## 3. Personas & Jobs-to-be-Done

This is a build PRD, so the personas are (a) the demo's on-screen operator — the audience proxy — and (b) the implementing agents who consume this PRD.

**P1 — The demo judge (audience proxy, watching ≤3 min).**
- **Role:** Hackathon judge / prospective buyer (VP Ops / Head of AI Transformation archetype). *No invented name.*
- **JTBD:** "When I watch this in under 3 minutes, I need to understand that a human corrected an AI false-green and the system *enforced* the correction — so I can tell governance apart from alerting."
- **Firing:** Generic agent dashboards and RAG demos that surface a problem but don't *enforce* a fix.
- **Success criteria:** They can answer all 9 questions in `DEMO_CONTRACT.md` §"Demo succeeds if a judge understands" — especially #6 (what enforcement changed) and #9 (how the next pass improved).

**P2 — The on-screen operator (the actor inside the demo).**
- **Role:** "the operator / the VP Ops / Head of AI Transformation / the executive owner." Roles only — Locked Rule #1.
- **JTBD:** "When my AI agents report Acme on-track, I need to catch the silently dropped EU data-residency requirement and force the workstream to correct *before* a false customer-facing update goes out."
- **Firing:** Trusting agent self-reported status.
- **Success criteria:** Status flips On Track → At Risk; the false "on track" update is blocked; an AuditEvent records *who decided*.

**P3 — The implementing agent (consumer of this PRD).**
- **Role:** One Claude Code agent per LIM- issue, one worktree, disjoint owned files.
- **JTBD:** "When I claim a screen, I need an unambiguous build order, frozen props, and per-screen acceptance tied to beats/MNC — so I never block on a missing dependency or invent data."
- **Firing:** Guessing scope from the issue title alone.
- **Success criteria:** PR passes app-level typecheck+build (the root gate is `.tsx`-blind), `lint:boundaries`, and the conformance/acceptance matrices.

---

## 4. The build order (critical path — do not reorder)

```
LIM-1226 «spine-shell-v2»   ── creates src/screens/ + 7 typed stubs + App.tsx routing
        │  (HARD BLOCKER: nothing below can start until this merges)
        ▼
LIM-1249 «acme Linear fixture» ── adds LinearWorkstreamPayload instance to acmeScenario
        │  (blocks ONLY LIM-1219; the other 6 screens can start the moment 1226 merges)
        ▼
┌───────────────── 7 screens, parallel (each fills its own stub) ─────────────────┐
│ LIM-1215 Initialize   LIM-1216 ContextTray   LIM-1217 AgentActivity            │
│ LIM-1218 GovernanceCase   LIM-1219 EnforcementPanel(needs 1249)                 │
│ LIM-1220 AuditTrail   LIM-1221 SecondPassEval                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
LIM-1245 «wire to live governance output» ── screens read runGovernanceLoop()/runEvals()
        │  not just static fixtures (proves "real logic, never mocks" — Rule 7)
        ▼
End state: full 14-step path runs end-to-end (existing «e2e» LIM task validates)
```

**Why this order and not another.** The tempting alternative is "start all seven screens now in parallel for maximum fan-out." It's wrong: six of seven would compile against a non-existent `src/screens/` directory and a missing route registry, and the seventh (enforcement panel) would have no workstream data and would *invent* it — a direct Locked-Rule-#2 violation and the exact "looks like a dashboard" failure mode. The serialization cost of LIM-1226 (one shell PR) buys collision-free parallelism for the whole wave. That tradeoff is worth it.

---

## 5. Per-screen specs (consolidated from `apps/desktop-demo/AGENTS.md` + `DEMO_CONTRACT.md` beats)

Each screen FILLS the stub LIM-1226 created. **Component props are FROZEN** — screens adapt to props, never widen them (Rule 5).

| Issue | Screen | Beats | MNC | Components (frozen props) | Data source | Acceptance (must be visibly true) |
|---|---|---|---|---|---|---|
| **LIM-1215** | Initialize | 1–2 | — | `Card` | `acmeScenario.businessGoal` | Workspace + goal `Close Acme expansion by Friday — $1.2M ARR` on screen. |
| **LIM-1216** | ContextTray | 2–4 | #1 | `Card`, `StatusBadge` | `acmeScenario` context fixtures | Context cards render as fixtures; false-green status visible. |
| **LIM-1217** | AgentActivity | 3 | #1 | `Card` | `acmeScenario.agentOutputPass1` | First-pass output `Acme expansion appears on track` shown (the false green). |
| **LIM-1218** | GovernanceCase | 4–5 | #2 | `Card` + `caseHeadline()` VM helper | `acmeScenario.governanceCase` | Detected case: dropped EU data-residency requirement + why it matters. No dedicated MNC#2 widget — compose `Card` with `caseHeadline()`. |
| **LIM-1219** | EnforcementPanel | 6–10 | #3,#4,#5 | `StatusBadge`, `LinearPayloadView`, `BlockedActionBanner` | `runGovernanceLoop()` output + **LIM-1249 fixture** | Approve+Enforce flips On Track→At Risk; Simulated Linear workstream (Product/Security/Eng owners); false "on track" update **blocked** with reasons + required-before-send. |
| **LIM-1220** | AuditTrail | 11 | #6 | `TraceRow` ×N | `acmeScenario` audit events | AuditEvent(s): actor (role), before/after, reason, evidence, hash-chained. |
| **LIM-1221** | SecondPassEval | 12–14 | #7 | `Card`, `StatusBadge`, `EvalTable` (`toRows([evalPass1, evalPass2])`) | `acmeScenario.evalPass1/2` | Improved at-risk output + eval table ≥5 checks flipping Fail→Pass. |

---

## 6. Carried-over key-safety fixes (from PR #11 review — fold into the consuming screen's PR)

These are real findings, verified against source, non-blocking for fixtures but must be fixed before dynamic data. Fix them *in-context* when wiring the screen — not as a separate cleanup PR.

| Finding | File:line | Fix | Land in |
|---|---|---|---|
| Composite key has no delimiter safety (`pass`-`criterion` can collide) | `EvalTable.tsx:39` | Use a delimiter that can't appear in the parts, or add an `id` to `EvalRow` | **LIM-1221** |
| Index keys on `reasons` / `requiredBeforeSend` | `BlockedActionBanner.tsx:33,42` | Derive key from content | **LIM-1219** |
| Index key on workstreams (line 47 already does `key={owner}` — inconsistent) | `LinearPayloadView.tsx:32` | Derive key from `ws.title`; match line-47 pattern | **LIM-1219** |

> Note on Rule 5 (FROZEN props): adding an `id` to `EvalRow` is an **eval-harness view-type** change, not a component-prop change — allowed, and the cleaner fix. If that's out of scope for LIM-1221, the safe-delimiter approach is the fallback and requires no contract change.

---

## 7. Hard rules (inherited — non-negotiable, every PR)

1. **No invented persona name.** Roles only. Grep the diff for any name before PR.
2. **No live calls on the spine.** `acmeScenario` + `runGovernanceLoop()` / `runEvals()` only. No Gemini/Linear-API/LiveKit in spine code (`lint:boundaries` enforces).
3. **Real logic, never mocks** (AGENTS.md Rule 6/7). Wire the real function; don't fake its result.
4. **No `Liminal, Inc.`** anywhere (entity not incorporated — `CLAUDE.md`).
5. **Component props are FROZEN.** Screens adapt; never widen a component's props to fit a screen.
6. **App-level verify, not just root.** The root `pnpm verify`/typecheck is **blind to `.tsx`** — every screen PR must run `apps/desktop-demo` `pnpm typecheck` + `pnpm build` and paste the output. A green root gate is a false-green for screens.
7. **No AI/Claude/Anthropic attribution** in commits or PR bodies.

---

## 8. Acceptance — wave is done when ALL hold (from `DEMO_CONTRACT.md`)

- [ ] Full 14-step path runs in order, end to end (the «e2e» task validates).
- [ ] Each of the 7 must-not-cut items is visibly present on screen.
- [ ] Status visibly flips **On Track → At Risk** on Approve + Enforce (MNC#3).
- [ ] A blocked downstream action is shown and explained (MNC#5).
- [ ] An `EvalCase` is generated; eval table shows **Fail → Pass** ≥5 checks (MNC#7).
- [ ] No invented persona name appears anywhere on screen or in narration.
- [ ] Walkthrough completes **under 3 minutes**.
- [ ] **Deterministic:** re-running produces the same result (no live-call flakiness).
- [ ] LIM-1245: at least the enforce + eval beats read from **live** `runGovernanceLoop()` / `runEvals()` output, not static literals — proving Rule 7.

---

## 9. Risks & tradeoffs (what this plan costs)

| Risk | Likelihood | Cost if it hits | Mitigation / what we accept |
|---|---|---|---|
| LIM-1226 shell PR is slow / contentious (it's the one shared-write surface) | Med | Stalls the *entire* wave — single point of serialization | Accept it: review LIM-1226 first and fast. The alternative (parallel `App.tsx` edits) reintroduces the collision class the DAG was designed to remove. |
| LIM-1219 starts before LIM-1249 lands → agent invents workstreams | Med | Locked-Rule-#2 violation; "looks like a dashboard" failure | Night-captain does not release LIM-1219 until LIM-1249 merges; PR review greps for hardcoded workstream/owner literals. |
| LIM-1245 "wire to live output" tempts a live integration | Low | Destabilizes the spine; `DEMO_CONTRACT.md` fail mode "too many integrations" | LIM-1245 wires the *pure* `runGovernanceLoop()` — which is deterministic — NOT Gemini/Linear. Live external calls stay out of the spine. |
| Key-safety fixes get deferred to "later" and never land | Med | Anti-pattern carried into the screens that pass dynamic data | Folded into the consuming screen's PR (§6), not a standalone task that can be dropped. |
| `caseHeadline()` VM helper for MNC#2 doesn't exist / has wrong shape | Low | LIM-1218 blocked | Verify `@liminal-engine/ui-components` exports `caseHeadline` before releasing LIM-1218; if absent, it's a one-line VM addition, not a screen blocker. |

**Second-best plan considered and rejected:** "Skip LIM-1245, ship screens on static fixtures only." It's faster and lower-risk, but it forfeits the strongest proof point — that the eval Fail→Pass and the status flip come from *real* governance logic, not hand-authored literals. For a *governance* product, "the result is computed, not staged" is the differentiator. Keep LIM-1245, scoped to the pure loop only.

---

## 10. Sequenced execution plan

1. **Land LIM-1226** (shell + 7 stubs + routing). Review first, merge fast. Unblocks everything.
2. **Land LIM-1249** (Acme `LinearWorkstreamPayload` fixture). Unblocks LIM-1219.
3. **Fan out the 7 screens** (LIM-1215–1221) — six can start at step 1's merge; LIM-1219 waits for step 2. Each PR: app-level typecheck+build pasted, conformance + acceptance matrices, key-safety fixes folded in where applicable (§6).
4. **Land LIM-1245** (wire enforce + eval beats to live `runGovernanceLoop()`/`runEvals()`).
5. **Run «e2e»** click-through of all 14 beats + `scripts/smoke.sh` checklist. Confirm §8 acceptance.
6. **Re-arm the review loop** (cron) once my own PRs are open, if desired.
