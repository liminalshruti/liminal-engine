# SPEC.md — Liminal Engine: consolidated implementation spec

**Single source of truth for HOW to build.** Reconciled from the two Acme-aware
downloaded specs (the "MVP Implementation Spec (6)" and the "Hackathon
Implementation Spec") into one internally-consistent spec that agrees with the
repo's locked docs. It does not restate the scenario or rubric — it points at them:

- **WHAT (locked scenario):** `DEMO_CONTRACT.md` — the 14-step required path +
  7 must-not-cut items (`MNC#1–7`). The contract is law; this spec serves it.
- **WHY (what scores):** `JUDGING_MAP.md` — rubric → thesis → demo beat (`#1–14`).
- **SCOPE:** `SCOPE_SPEC.md`. **RULES:** `CLAUDE.md` + `AGENTS.md`.
- **TASKS (parallel build units):** `specs/TASKS.md` (canonical task list).

> If anything below ever conflicts with `DEMO_CONTRACT.md`, the contract wins and
> this file is the bug.

---

## Contradictions in the source PDFs — RESOLVED here

The 12 downloaded specs were 12 versions of one spec; only 2 were Acme-aware. The
following conflicts are resolved once, so every task agrees:

1. **Repo target.** spec_06 assumed a greenfield `apps/` + `packages/` monorepo;
   spec_10 said "build inside `liminal-desktop`, don't start a new repo."
   **RESOLVED → greenfield `liminal-engine`** (this repo). It already exists, is the
   public submission repo, and has the harness + contracts. We do NOT build in
   `liminal-desktop`; that repo is read-only reference. (spec_10's Tauri/Rust/Slate
   file paths are reinterpreted onto this repo's TS package layout.)
2. **Domain model.** The 10 generic PDFs used a broad `BusinessGoal / AgentRun /
   DriftSignal / HumanCorrection …` model; spec_06 had 16 entities; spec_10 had a
   leaner governance set. **RESOLVED → the repo's existing 7 contracts are canonical**
   (see mapping below), extended minimally. We do not introduce the generic model.
3. **Demo scenario.** The generic PDFs used "renewal-risk follow-up email."
   **RESOLVED → Acme false-green / EU data residency only** (`DEMO_CONTRACT.md`).
4. **Persistence / stack.** **RESOLVED → TypeScript, fixtures-first, deterministic.**
   The demo spine renders the Acme fixtures from `@liminal-engine/contracts/fixtures`.
   Live Gemini/LiveKit/real-Linear are cut-if-risky (simulated only).

---

## Architecture (already enforced by `.dependency-cruiser.cjs`)

Greenfield TS monorepo, hexagonal:

```
packages/contracts        shared kernel — zod contracts + canonical-hash golden tests (the 7 below)
packages/engine-core      pure domain (status state machine, governance phases)
packages/governance       use cases over ports (detect / correct / enforce / proxy / second-pass / audit-ledger)
packages/eval-harness     EvalCase generation + Fail→Pass
packages/integrations/*   adapters (gemini/linear/livekit) — FIXTURE STUBS, no live calls on the spine
packages/ui-components    framework-agnostic view-model helpers
apps/desktop-demo         the 7-screen click-through (composition root; wires adapters)
```

Boundary rules (mechanical): domain is pure; cross-package coupling only via
`@liminal-engine/contracts`; the spine cannot import live integrations
(`spine-no-live-integrations`); changing a contract requires `pnpm regen:goldens`.

---

## Domain model — spec entities → repo contracts (the agreement)

The repo's 7 contracts are canonical. The merged spec's richer entities map onto
them; only the **Add** rows are net-new (landed by the foundation task LIM-«contracts»).

| Merged-spec concept | Repo contract | Action |
|---|---|---|
| Agent false-green output | `AgentOutput` | exists |
| Detected governance incident | `GovernanceCase` | **extend**: `businessImpact`, `missingFrom[]`, `evidenceIds[]`, `recommendedActions[]`, status lifecycle `open\|corrected\|enforced\|dismissed\|reopened\|closed` |
| Approve+Enforce action | `EnforcementAction` | **extend**: `actionType` enum (`change_status`/`create_linear_workstream`/`assign_owner`/`block_agent_action`/`require_approval`/`generate_eval`/`activate_policy`/`record_audit_event`) — **fixed enum, NOT a policy DSL** — plus `targetSystem`, `payload`. The `gov-correct` correction templates compile **onto** this enum. |
| Audit evidence | `AuditEvent` | **extend**: `beforeState`/`afterState`, `evidenceIds[]`, `actionIds[]`, `evalIds[]`, `affectedSystems[]`, `prevHash` (hash-chain, consumed by `audit-ledger`) |
| Blocked future action / proxy result | `ActionGate` | **extend**: `reasons[]`, `requiredBeforeSend[]`; derive `allowed` from the gate verdict (do NOT persist a contradictory `blocked` boolean) |
| Eval regression case | `EvalCase` | exists |
| Fail→Pass result | `EvalResult` | exists |
| Operator correction text | — | **Add** `CorrectionEvent` contract |
| Simulated Linear workstream | — | **Add** `LinearWorkstreamPayload` contract (project + 6 issues + owners) |
| Policy rule / approval gate | `EnforcementAction` | **COVERED (no new contract)** — demo steps 9 + 11 render from existing contracts: required owners via `LinearWorkstreamPayload.requiredOwners` + `actionType: assign_owner`; approval + policy behaviors via `actionType: require_approval` / `activate_policy`; the approval record is the `AuditEvent`. First-class `PolicyRule`/`ApprovalGate` entities are POST-HACK (verified 2026-06-28, LIM-1251). |

`Workspace`/`BusinessGoal`/`Stream`/`Signal`/`AgentRun`/`ResourceAllocation` from
the PDFs are **cut** for the MVP — their demo-visible content lives in the Acme
fixtures (`businessGoal`, `demoBeats`, context cards) rather than as contracts.

---

## Engine behavior (packages/governance + eval-harness) — serves beats #3–#14

- **Detect (beats #3–#5, MNC#1/#2):** first-pass output is the fixture false green
  ("Acme expansion appears on track"); detector finds the EU-data-residency
  requirement present in the call but missing from proposal/scope/launch/owners/
  deal-risk → emits a critical `GovernanceCase` with evidence + missing artifacts.
- **Correct (beat #5→#6):** the operator's correction is captured as a
  `CorrectionEvent` and compiled (pure function, `gov-correct`) onto the fixed
  `EnforcementAction.actionType` enum — never free-form. Reject vague corrections;
  preview the compiled actions before enforce.
- **Enforce (beats #6–#9/#11, MNC#3/#4/#6):** `Approve + Enforce` is **atomic** —
  status `on-track → at-risk`; require Product/Security/Engineering owners; create
  the simulated `LinearWorkstreamPayload`; register the proxy block; record one
  `AuditEvent` **via the hash-chained `audit-ledger`** (before/after/evidence/actions/
  prevHash); generate the `EvalCase`. The policy-activation + approval behaviors
  (DEMO_CONTRACT steps 9 + 11) are enacted via `EnforcementAction.actionType`
  (`activate_policy` / `require_approval`) — no separate PolicyRule/ApprovalGate
  contract for the MVP (verified covered 2026-06-28, LIM-1251).
- **Proxy gate (beat #10, MNC#5):** a check function — attempting "mark on track" /
  "send customer-facing on-track update" returns `{ allowed:false, reasons[],
  requiredBeforeSend[] }` until requirement propagated + owner assigned + eval passed.
- **Second pass + eval (beats #12–#14, MNC#7):** re-run under the active gate →
  improved output ("Acme is at risk until EU data residency has an owner and
  workstream"); `EvalResult` flips **Fail → Pass** on the same checks.

All deterministic from fixtures. Gemini/LiveKit, if ever added, sit behind the same
output contract with a fixture fallback and never gate the spine.

---

## Screens (apps/desktop-demo) — the locked 14-step path, in order

Seven screens, one demo path (no dashboard, no extra nav):
`Initialize → Context Tray → Agent Activity → Governance Case → Enforcement Panel
→ Audit Trail → Second Pass Eval`. Each renders fixture/engine state; the
`Approve + Enforce` CTA performs the enforcement transition visibly; a blocked-action
banner shows the proxy refusal; the eval table shows Fail→Pass. UI stack is the one
open decision (see TASKS.md LIM-«spine-shell» — Solid / React / Vite-vanilla).

## Simulated integrations
- **Linear:** deterministic `LinearWorkstreamPayload` — project "Acme EU Data
  Residency Readiness" + 6 blocking issues + Product/Security/Engineering owners,
  linked to goal + case + evidence. Behind the existing `LinearWorkstreamPanel` port.
- **Proxy:** local rule function (above). **Gemini/LiveKit:** stubs only for MVP.

## Cut lines (agreed, from both PDFs)
- **Never cut:** GovernanceCase · EnforcementAction · status flip · simulated Linear
  workstream · required owners · blocked future action · AuditEvent · EvalCase ·
  Fail→Pass second pass.
- **Cut first if slipping:** real Gemini, LiveKit, real Linear API, extra scenarios,
  extra blocked-action types, resource-allocation view. (First-class
  `PolicyRule`/`ApprovalGate` entities are POST-HACK — demo steps 9 + 11 are
  COVERED by existing contracts via `EnforcementAction.actionType`; verified
  2026-06-28, LIM-1251.)
- **Never add:** 12-agent swarm · graph DB · RBAC · a dashboard-hero surface ·
  cross-repo refactors · new repos.

## Acceptance
The merged acceptance bars from both PDFs are **already captured** by
`DEMO_CONTRACT.md` acceptance + the `MNC#1–7` list + `JUDGING_MAP.md` coverage
table. A task is done when its beats render from persisted/fixture state, its
contracts validate (goldens green), boundary lint passes, and the relevant
`MNC#` is visibly satisfied end-to-end. Do not re-fork acceptance here.
