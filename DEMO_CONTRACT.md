# DEMO CONTRACT — Liminal Engine Governance Hack 2026

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

```text
Initialize workspace
→ Agent output            (agents report Acme "on track" — the false green)
→ GovernanceCase          (Liminal flags the dropped EU data residency requirement)
→ Approve + Enforce       (operator approves; status flips on-track → At Risk)
→ AuditEvent              (correction + decision recorded as audit evidence)
→ Blocked future action   (a customer-facing update is blocked until corrected)
→ Second pass improves    (agents re-run with the requirement enforced)
→ Eval shows Fail → Pass  (eval table proves the improvement)
```

Every step must be visible on screen in this order.

---

## Must-NOT-cut list

These are the spine. If any of these is missing, the demo does not prove the thesis:

1. **The false green** — agent output that visibly says Acme is on track.
2. **Detection** — a GovernanceCase surfacing the dropped EU data-residency requirement.
3. **Enforce** — Approve + Enforce visibly changes status (on-track → At Risk).
4. **Audit evidence** — an AuditEvent recording the correction and who decided.
5. **A blocked future action** — a downstream customer update blocked until corrected.
6. **Fail → Pass** — an eval table showing the second pass improved.

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
- [ ] The eval table shows **Fail → Pass** between pass 1 and pass 2.
- [ ] No invented persona name appears anywhere on screen or in narration.
- [ ] The whole walkthrough completes in **under 3 minutes**.
- [ ] Deterministic: re-running produces the same result (no live-call flakiness
      on the spine).
