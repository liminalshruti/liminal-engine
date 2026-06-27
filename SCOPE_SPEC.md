# SCOPE_SPEC.md — Liminal Engine Governance Hack 2026

What is in scope for the hackathon build, and what is explicitly out.

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
- **Deterministic fixtures** driving every screen on the demo spine.
- A `smoke.sh` that runs available build/test and prints the manual checklist.

## Out of scope (this hackathon)

- Real **Gemini** inference (fixtures stand in).
- Real **LiveKit** voice (scripted/static transcript if shown at all).
- Real **Linear API** writes (simulated Linear workstream panel).
- Multi-tenant / auth / persistence beyond what the demo needs.
- Multiple scenarios — only Acme.
- A metrics dashboard as the hero (explicitly not the hero; see `CLAUDE.md`).
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
