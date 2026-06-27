# HACK_HANDOFF.md — Liminal Engine Governance Hack 2026

The single-page orientation for anyone (human or agent) picking this up cold.

## What we're building

**Liminal Engine — Agentic Work Governance MVP.** A governance layer that catches
**false greens** in agentic work and forces provable correction. Demo thesis:
agents reported a $1.2M Acme expansion as on-track while silently dropping the EU
data-residency requirement; Liminal caught it, enforced correction, recorded
audit evidence, and proved the next pass improved.

Loop: `observe → detect → correct → enforce → audit → improve`.

## The one demo that matters

The **Acme false-green** path in `DEMO_CONTRACT.md`. Under 3 minutes. Locked.

```text
Initialize → Agent output → GovernanceCase → Approve + Enforce
→ AuditEvent → Blocked future action → Second pass improves → Eval Fail → Pass
```

## Read these first, in order

1. `DEMO_CONTRACT.md` — the locked scenario, path, must-not-cut, acceptance.
2. `CLAUDE.md` — how to build (static first, fixtures first, don't redesign).
3. `SCOPE_SPEC.md` — in scope vs out of scope.
4. `AGENT_HANDOFFS.md` — what the last session actually did.
5. `SESSION_STATE.md` — current state right now.

## Status

**Phase: setup complete.** Scaffold + docs + Claude Code dev environment created.
No app implementation yet (by design — this session was setup only).

## Next session should

- Stand up the static clickable demo skeleton in `apps/desktop-demo/` covering
  the full required demo path with hardcoded screens.
- Author deterministic fixtures (agent output, GovernanceCase, AuditEvent, eval
  table) under `packages/` so screens read from data, not literals.
- Resolve the persona TODO by inspecting `liminal-prototype` (see
  `DEMO_CONTRACT.md`).

## Open risks

- Parent repo is **private** — must be made public or split before submission
  (see `README.md` / `SUBMISSION.md`).
- Persona name not yet extracted — do **not** invent one.
