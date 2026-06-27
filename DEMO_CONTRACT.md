# DEMO CONTRACT — Liminal Engine — Agentic Work Governance MVP

> Hackathon: Liminal Engine Governance Hack 2026

This contract **locks** the demo. Changes to anything below require an explicit
decision logged in `CHANGELOG.md`. The implementation serves this contract; the
contract does not bend to the implementation.

---

## Scenario (LOCKED): Acme false-green

A company resourced AI agents to close a **$1.2M Acme expansion**. The agents
produced a **false green** — the deal status read as on-track while a
**load-bearing customer requirement (EU data residency)** had been silently
dropped.

Liminal Engine:

1. **caught** the lost customer requirement,
2. **enforced correction** through workflow / action gates,
3. **recorded audit evidence**, and
4. **proved the next pass improved** (eval Fail → Pass).

The core loop demonstrated: `observe → detect → correct → enforce → audit → improve`.

---

## Required demo path (LOCKED)

The full 14-step path. Every step must be visible on screen in this order.

1. **Initialize workspace.**
2. **Show Acme business goal:** `Close Acme expansion by Friday — $1.2M ARR`.
3. **Show agent output:** `Acme expansion appears on track` (the false green).
4. **Reveal lost EU data residency requirement** (the silently dropped, load-bearing customer requirement).
5. **Surface `GovernanceCase`** (Liminal flags the dropped EU data-residency requirement).
6. **Operator clicks `Approve + Enforce`.**
7. **Status changes `On Track → At Risk`.**
8. **Simulated Linear workstream appears.**
9. **Product / Security / Engineering owners required** (the workstream demands the right owners).
10. **False customer-facing `on track` update is blocked** (the downstream action gate holds until corrected).
11. **`AuditEvent` recorded** (correction + deciding actor captured as audit evidence).
12. **`EvalCase` generated** (the case the second pass is graded against).
13. **Second pass improves** (agents re-run with the requirement enforced).
14. **Eval table shows `Fail → Pass`** (the `EvalCase` proves the improvement).

Core loop demonstrated across these steps: `observe → detect → correct → enforce → audit → improve`.

---

## Must-NOT-cut list

These are the spine. If any of these is missing, the demo does not prove the thesis:

1. **The false green** — agent output that visibly says Acme is on track.
2. **`GovernanceCase`** — detection surfacing the dropped EU data-residency requirement.
3. **`EnforcementAction`** — Approve + Enforce visibly changes status (On Track → At Risk).
4. **Simulated Linear workstream** — appears on enforce, requiring Product / Security / Engineering owners.
5. **Blocked future action** — a downstream customer-facing "on track" update blocked until corrected.
6. **`AuditEvent`** — recording the correction and the deciding actor.
7. **`EvalCase` + Fail → Pass** — an eval case generated and graded, with a table showing the second pass improved.

---

## Cut-if-risky list

Drop these before touching the must-not-cut spine if time/stability is at risk:

- Real **Gemini** calls → use deterministic fixtures.
- Real **LiveKit** voice → use a scripted / static transcript.
- Real **Linear API** → use a simulated Linear workstream panel.
- Animations, transitions, polish on non-spine screens.
- Multiple scenarios — **one** scenario (Acme) is enough.
- Live agent execution → pre-baked agent output fixtures are acceptable and preferred.

---

## Persona rule (LOCKED)

**Do not invent a persona name.** Until a name is extracted from `liminal-prototype`
(see TODO below), refer to the demo user only as:

- *the operator*
- *the VP Ops / Head of AI Transformation*
- *the executive owner*
- *the buyer persona*

### TODO: Extract persona from `liminal-prototype`

Do not hardcode the buyer persona name in the hack MVP handoff.

Before finalizing the demo narrative, inspect `liminal-prototype` and extract:

- existing persona names
- ICP language
- user role framing
- current product narrative
- workflow assumptions
- substrate examples
- buyer/operator vocabulary
- any existing demo scenarios or seeded users

Until this is done, refer to the demo user generically as *the operator*, *the
VP Ops / Head of AI Transformation*, *the executive owner*, or *the buyer
persona*. Avoid inventing a specific name.

---

## Acceptance criteria

The demo is accepted when **all** of the following hold:

- [ ] The full required demo path runs in order, end to end.
- [ ] Each must-not-cut item is visibly present on screen.
- [ ] The status visibly flips **on-track → At Risk** on Approve + Enforce.
- [ ] A blocked downstream action is shown and explained.
- [ ] An **`EvalCase`** is generated and the eval table shows **Fail → Pass**
      between pass 1 and pass 2.
- [ ] No invented persona name appears anywhere on screen or in narration.
- [ ] The whole walkthrough completes in **under 3 minutes**.
- [ ] Deterministic: re-running produces the same result (no live-call flakiness
      on the spine).
