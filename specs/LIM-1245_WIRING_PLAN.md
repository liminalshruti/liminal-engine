# LIM-1245 — Wire screens to live governance output (plan + sequencing)

> Status: **GATED — do not start until all 7 screens are filled & merged.** Decision (founder, this session): wire all 7 screens in ONE PR after the screen wave completes, to avoid colliding with the in-flight screen-fills.
> In scope (founder-confirmed): the "computed, not staged" wiring IS required for the demo — screens render real loop output, not raw fixtures.

## Why this task exists

Today all 7 screens read `acmeScenario.*` fixtures **directly**. The governance loop and the UI can therefore diverge: a change to loop logic wouldn't change what the screens show. LIM-1245 makes the governance artifacts **computed** (single source of truth) while keeping the *inputs* (agent outputs) as fixtures.

## Verified ground truth (origin/main, this session)

- `runGovernanceLoop(deps, dealId)` returns only `{ evalCase, evals }`; it writes case/audit/gate to the in-memory **stores** as side effects.
- `approveAndEnforce(...)` (merged via PR #18) **returns the full set** `{ status, enforcement, audit, gate }` directly — no store read-back needed for those.
- `GovernanceCaseStore.byDeal(dealId)` reads the case back; `EvalStore.byDeal` / the loop return give evals.
- `apps/desktop-demo/src/lib/enforce-handler.ts` already composes in-memory adapters + fixture-determinism (`createAcmeClock`/`createAcmeIdGen`) and exposes `runApproveAndEnforce()`. **This is the template.**
- CI half is ALREADY DONE: `package.json` `verify` runs `typecheck:app` (LIM-1212/PR #12 landed it). LIM-1245 needs NO CI work — only the wiring. Note this in the PR so it's not re-done.

## Design (founder-approved: lib/governance-view + read-back, no engine change)

New file `apps/desktop-demo/src/lib/governance-view.ts`:
- Compose in-memory adapters (`InMemoryGovernanceCaseStore`, `InMemoryAuditSink`, `InMemoryActionGateStore`, `InMemoryEvalStore`) + fixture-seeded `createAcmeClock`/`createAcmeIdGen` (same determinism the demo already uses).
- `loadAcmeGovernanceView(): Promise<AcmeGovernanceView>`:
  1. run `runGovernanceLoop` → `{ evalCase, evals }`
  2. read `governanceCase` via `caseStore.byDeal(ACME_DEAL_ID)`
  3. reuse `runApproveAndEnforce()` → `{ status, enforcement, audit, gate }`
  4. combine with fixture inputs (`agentOutputPass1`, `agentOutputPass2`) into one typed `AcmeGovernanceView`
- Export `type AcmeGovernanceView` + the loader.
- **Inputs stay fixtures** (agent outputs — the loop must read something); **artifacts are computed** (case, enforcement, audit, gate, evals). That's the "computed, not staged" line.

## Per-screen swap (the single PR, AFTER all 7 are filled)

Each screen replaces `import { acmeScenario }` + `acmeScenario.X` with the matching `AcmeGovernanceView` field. **Rendering is unchanged** — only the data source swaps.

| Screen | Today reads | Swap to (view field) |
|---|---|---|
| Initialize | `businessGoal, agentOutputPass1` | view inputs (goal stays fixture) |
| ContextTray | `agentOutputPass1` + context | view inputs |
| AgentActivity | `agentOutputPass1` (false green) | `view.agentOutputPass1` |
| GovernanceCase | `governanceCase` | `view.governanceCase` (computed) |
| EnforcementPanel | `enforcementAction, blockedAction` | `view.enforcement, view.gate, view.status` (computed) |
| AuditTrail | `auditEvent` | `view.audit` (computed) |
| SecondPassEval | `evalPass1, evalPass2, agentOutputPass2` | `view.evals` + `view.agentOutputPass2` |

## Gate / sequencing

- **Precondition:** LIM-1215, 1216, 1217, 1218, 1219, 1220, 1221 all merged (the 7 screens filled).
- **Then:** one PR adds `governance-view.ts` + swaps all 7 screens + e2e/smoke confirm.
- **Acceptance:** screens consume loop output; `pnpm verify` green (app .tsx typechecked — already wired); deterministic re-run is byte-identical.

## Status of the precondition (this session)
- ✅ Filled & merged: Initialize (LIM-1215), EnforcementPanel
- 🔄 In review: ContextTray (LIM-1216, PR #28)
- 📋 Still stub: AgentActivity (1217), GovernanceCase (1218), AuditTrail (1220), SecondPassEval (1221)
