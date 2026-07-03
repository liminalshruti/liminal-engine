# Launch packet — LIM-1218 «screen-governance-case» (beat #5, MNC#2)

> Ready-to-hand-off spec. The screen is the **detection moment** — "Liminal caught
> it." It is the one demo-critical screen still unstarted while its siblings
> (1217/1220/1221) are in flight. Verified startable against `main` @ `83a6b0a`:
> all dependencies are merged.

## One-line goal
Fill the `GovernanceCase` stub so beat #5 visibly shows the `GovernanceCase`
Liminal opened for the silently-dropped EU data-residency requirement (MNC#2).

## Ownership (disjoint — no collision)
- **Owns, edits only:** `apps/desktop-demo/src/screens/GovernanceCase.tsx`
- Do **not** touch any other file. (CSS: reuse existing `screen__*` / `Card`
  classes already in `styles/app.css`; only add a class there if truly needed.)
- Branch: `pnpm wt:new LIM-1218 screen-governance-case`; `pnpm install` in the
  worktree first.

## Dependencies — all on `main`, confirmed
| Need | Source | Status |
|---|---|---|
| The stub to fill (names the approach) | `screens/GovernanceCase.tsx` | on main |
| `Card` widget | `../components` (LIM-1214 barrel) | on main |
| `caseHeadline()` view-model helper | `@liminal-engine/ui-components` | on main |
| `acmeGovernanceCase` fixture | `@liminal-engine/contracts/fixtures` (`acmeScenario.governanceCase`) | on main |
| `SCREEN_COPY.governanceCase` | `../lib/copy.ts` | on main |

## Fixture — what's actually populated (DO NOT invent the rest)
`acmeScenario.governanceCase` (`acmeGovernanceCase`):
```ts
{ id: "gc_acme_eu", dealId: "deal_acme", missedRequirement: "EU data residency",
  category: "data-governance", severity: "blocking", status: "open",
  detectedAt: "2026-06-27T10:00:00.000Z" }
```
The contract ALSO allows optional `businessImpact`, `missingFrom[]`, `evidenceIds[]`,
`recommendedActions[]` — **but the Acme fixture does NOT set them.** They are
`undefined`. **Do not render them, and do not invent values** (Locked Rule #2,
no hardcoded/invented data). Render only the 7 fields above.

## Helper + copy (verbatim, already on main)
```ts
caseHeadline(c) // → "Dropped requirement: EU data residency (blocking)"
SCREEN_COPY.governanceCase = {
  title: "Governance case",
  intro: "Liminal detects a load-bearing customer requirement was silently dropped.",
}
```

## What to render (compose with `Card`, mirror the ContextTray/Initialize pattern)
1. `screen__intro` = `copy.intro` (the "Liminal detects…" line — the narrative beat).
2. A `Card` titled with `caseHeadline(governanceCase)` (the headline IS the detection).
3. Inside the card, `screen__fact` lines for the populated fields:
   - Case id (`governanceCase.id`) + status (`governanceCase.status` → "open")
   - Severity (`governanceCase.severity` → "blocking")
   - Category (`governanceCase.category` → "data-governance")
   - Detected at (`governanceCase.detectedAt`)
   - The dropped requirement (`governanceCase.missedRequirement`) emphasized — this
     is the load-bearing thing the false green dropped.
4. **Remove** the `<p className="screen__stub-note">Stub …</p>` line.

Keep it factual and unmistakable: the demo-watcher should read this as *"Liminal
opened a blocking governance case the instant the requirement was dropped."*

## Hard rules (from CLAUDE.md / apps/desktop-demo/AGENTS.md)
- Fixtures only — no live calls, no hardcoded/invented data.
- No invented persona name (this screen has no actor; don't add one).
- Do NOT redesign the loop or make a dashboard the hero — it's one detection card.
- No "Simulated" badge here (that label is reserved for the Linear workstream, MNC#4).
- Two-barrels rule: widgets from `../components`; view-model helpers from
  `@liminal-engine/ui-components`.

## Acceptance criteria
- [ ] Beat #5 renders the `GovernanceCase` for the dropped EU data-residency
      requirement, severity **blocking**, status **open** (MNC#2 visible).
- [ ] Headline uses `caseHeadline(governanceCase)`; cards use `Card`.
- [ ] Reads only `acmeScenario.governanceCase`; no invented/optional fields.
- [ ] Stub note removed.
- [ ] `pnpm verify` green **and** `cd apps/desktop-demo && pnpm typecheck && pnpm build`
      clean (root verify is blind to `.tsx` — the app typecheck/build is the real gate).
- [ ] `./scripts/smoke.sh` green.
- [ ] PR-only, with the conformance + acceptance matrices the other screen PRs used.

## Reference implementations to copy the house style from
- `screens/ContextTray.tsx` (LIM-1216, merged #28) — Card + view-model helper + fixture.
- `screens/Initialize.tsx` (LIM-1215, merged #22) — minimal Card fill.

## Sequencing
File-disjoint from 1217/1220/1221 (other screen fills) → runs fully in parallel,
gates nothing. After all 7 screens land, the remaining structural item is LIM-1245
(wire screens to real `runGovernanceLoop` output instead of raw fixtures).
