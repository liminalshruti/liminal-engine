# SCOPE_SPEC.md — Liminal Engine — Agentic Work Governance MVP

> Hackathon: Liminal Engine Governance Hack 2026

What is in scope for the hackathon build, what is **deferred to a later wave**
(simulated for the demo, real afterward), and what is **permanently out** by design.

> Three tiers, mirroring `specs/SPEC.md` cut-lines: **in scope** (never cut — the
> spine) · **deferred / next-wave** (cut-first-if-slipping; simulated now, real
> later — NOT abandoned) · **never add** (out by design). Do not collapse
> "deferred" into "out": the real integrations are sequenced after the spine, not
> cancelled.

## In scope

- A clickable **desktop demo** (`apps/desktop-demo/`) that walks the locked
  Acme false-green path end to end.
- Domain primitives, fixture-backed:
  - **GovernanceCase** — a detected miss (dropped EU data-residency requirement).
  - **AuditEvent** — recorded evidence of a correction + the deciding actor.
  - **Action gate** — a downstream action blocked until correction.
  - **Eval result** — Fail → Pass across two passes.
- The governance loop wired through the UI: `observe → detect → correct →
  enforce → audit → improve`.
- **`PolicyRule` + `ApprovalGate`: COVERED by existing contracts — NO new build**
  (reconciled 2026-06-28, LIM-1251 / PR #26; supersedes the brief P0-promotion).
  Demo steps 9 + 11 already render from contracts on `main`: `require_approval` /
  `activate_policy` on `EnforcementAction.actionType` + `AuditEvent` +
  `LinearWorkstreamPayload.requiredOwners`. First-class `PolicyRule`/`ApprovalGate`
  entities are **post-hack** — do not build duplicate models for the hack.
- **Deterministic fixtures** driving every screen on the demo spine.
- A `smoke.sh` that runs available build/test and prints the manual checklist.

## Deferred to a later wave (simulated for the demo, NOT cut)

Cut-first-if-slipping per `specs/SPEC.md`. Simulated/fixture-backed for the
hackathon demo; the real version is **next-wave work, not abandoned**. Drop the
*real* version only under time/stability pressure — the simulated stand-in stays.

- Real **Gemini** inference — fixtures stand in for the demo; real inference is a later wave.
- Real **LiveKit** voice — scripted/static transcript for the demo; real voice later.
- Real **Linear API** writes — simulated Linear workstream panel now; real API later.
- Extra blocked-action types beyond the one demo gate, resource-allocation view, extra scenarios.
- Multiple scenarios — only Acme for the demo; more scenarios later.

## Out by design (never add)

Permanent exclusions — these are not "later," they are not part of this product
shape at all (mirrors `specs/SPEC.md` "Never add" + `CLAUDE.md` product locks).

- A metrics **dashboard as the hero** (the loop is the hero; see `CLAUDE.md`).
- 12-agent swarm · graph DB · RBAC · cross-repo refactors · new repos.
- Multi-tenant / auth / persistence beyond what the demo needs.
- Production hardening, CI/CD, deployment.

## Prior-work boundary

- Prior Liminal repos (`liminal-prototype`, `liminal-desktop`, `liminal-govern`,
  `liminal-agents`, …) are **reference/context only**.
- Copied code must be marked `// ADAPTED FROM: <repo>/<path> — prior work`.
- Submission scope = this folder, not the historical monorepo.

## Stretch (only if spine is solid)

- Wire one real integration from the cut-if-risky list (Linear panel most likely).
- Persona-accurate copy once extracted from `liminal-prototype`.
- Recorded fallback video in `demos/fallback/` in case live demo fails.
