# Fallback demo walkthrough — Acme false-green (14 beats)

> Hackathon: Liminal Engine Governance Hack 2026
> **Deterministic. No live calls.** Read this aloud if the live app glitches.

This is the **fallback demo path**: a static, scripted rendering of the locked 14-step
required demo path from `DEMO_CONTRACT.md`, proving the full
`observe → detect → correct → enforce → audit → improve` loop on the Acme
false-green scenario **without any live Gemini / LiveKit / Linear call**.

Every value below is transcribed **verbatim** from the deterministic fixtures on
`main` — `packages/contracts/src/fixtures/acme.ts` (`acmeScenario`) — and the
beat mapping in `apps/desktop-demo/src/steps.tsx`. Those fixtures are
contract-validated (`fixtures.test.ts`) and beat-tied (`acme-beats.test.ts`), so
this walkthrough reads from the same source of truth the live spine renders.
Re-reading it produces the same result every time — that is the point of a
fallback.

**Scenario:** A company resourced AI agents to close a **$1.2M Acme expansion**.
The agents produced a **false green** — the deal read as on-track while a
load-bearing customer requirement (**EU data residency**) had been silently
dropped. Liminal Engine catches it, enforces correction, records audit evidence,
and proves the next pass improved (eval **Fail → Pass**).

---

## The 14 beats

Each beat below names: the loop **phase**, the **must-not-cut** id it satisfies
(if any), what is **on screen** in the live spine, and the **fixture value** it
renders. To run the fallback, walk these in order — narrate the "On screen" line,
then read the fixture value.

### Phase: Observe

**1. Initialize workspace**
- Screen: `Initialize`
- On screen: Acme Expansion governance workspace initialized.

**2. Show Acme business goal**
- Screen: `Initialize`
- Fixture (`acmeScenario.businessGoal`): **`Close Acme expansion by Friday — $1.2M ARR`**

**3. Show agent output — the false green** · *must-not-cut #1*
- Screen: `AgentActivity`
- Fixture (`acmeScenario.agentOutputPass1`):
  - reported status: **`on-track`**
  - summary: **`Acme $1.2M expansion on track; all workstreams green.`**
  - demo-beat claim copy (`demoBeats.agentClaim`): **`Acme expansion appears on track`**
- This is the false green: the deal reads green while a requirement was dropped.

### Phase: Detect

**4. Reveal lost EU data-residency requirement**
- Screen: `ContextTray`
- On screen: Load-bearing customer requirement silently dropped.
- Fixture (`acmeScenario.demoBeats.droppedRequirement`): **`EU data residency`**
- Fixture (`acmeScenario.agentOutputPass1.droppedRequirements`): **`["EU data residency"]`**

**5. Surface GovernanceCase** · *must-not-cut #2*
- Screen: `GovernanceCase`
- Fixture (`acmeScenario.governanceCase`):
  - id: **`gc_acme_eu`**
  - missed requirement: **`EU data residency`**
  - category: **`data-governance`** · severity: **`blocking`** · status: **`open`**
  - detected at: **`2026-06-27T10:00:00.000Z`**

### Phase: Correct

**6. Operator clicks Approve + Enforce**
- Screen: `EnforcementPanel`
- On screen: Human decision becomes enforceable operating state.
- Deciding actor is a **role**, never an invented name (persona rule):
  **`VP Ops / Head of AI Transformation`**.

### Phase: Enforce

**7. Status changes On Track → At Risk** · *must-not-cut #3*
- Screen: `EnforcementPanel`
- Fixture (`acmeScenario.enforcementAction`):
  - id: **`ea_acme_enforce`** · case: **`gc_acme_eu`**
  - **`on-track` → `at-risk`** (the status visibly flips)
  - actor: **`VP Ops / Head of AI Transformation`**
  - enforced at: **`2026-06-27T10:04:00.000Z`**

**8. Simulated Linear workstream appears** · *must-not-cut #4*
- Screen: `EnforcementPanel`
- Fixture (`acmeScenario.linearWorkstreamPayload`) — **simulated, no live Linear call**:
  - title: **`Acme expansion — EU data residency remediation`**
  - workstreams:
    - `Commercial terms` — **green** — owner Product
    - `Security review` — **green** — owner Security
    - `Data residency (EU)` — **at-risk** — owner Engineering

**9. Product / Security / Engineering owners required**
- Screen: `EnforcementPanel`
- Fixture (`acmeScenario.requiredOwners`): **`Product, Security, Engineering`**

**10. False customer-facing update is blocked** · *must-not-cut #5*
- Screen: `EnforcementPanel`
- Fixture (`acmeScenario.blockedAction`):
  - action: **`Send customer-facing status update to Acme`**
  - verdict: **`deny`**
  - reason: **`Open governance case gc_acme_eu requires EU data residency correction before a customer-facing on-track update.`**
  - required before send:
    1. Propagate the EU data residency requirement into the Acme workstream.
    2. Assign Product, Security, and Engineering owners.
    3. Pass the EU data residency EvalCase.

### Phase: Audit

**11. AuditEvent recorded** · *must-not-cut #6*
- Screen: `AuditTrail`
- Fixture (`acmeScenario.auditEvent`):
  - id: **`ae_acme_1`** · case: **`gc_acme_eu`**
  - action: **`correction-enforced`**
  - deciding actor: **`VP Ops / Head of AI Transformation`**
  - **`on-track` → `at-risk`**
  - recorded at: **`2026-06-27T10:05:00.000Z`**

### Phase: Improve

**12. EvalCase generated**
- Screen: `SecondPassEval`
- Fixture (`acmeScenario.evalCase`):
  - id: **`ec_acme_eu`** · governance case: **`gc_acme_eu`**
  - criterion: **`EU data residency requirement honored`**
  - created at: **`2026-06-27T10:06:00.000Z`**

**13. Second pass improves**
- Screen: `SecondPassEval`
- Fixture (`acmeScenario.agentOutputPass2`):
  - reported status: **`at-risk`**
  - summary: **`Acme expansion re-run with EU data residency enforced; flagged for remediation.`**
  - dropped requirements: **`[]`** (nothing dropped on the re-run)

**14. Eval table shows Fail → Pass** · *must-not-cut #7*
- Screen: `SecondPassEval`
- Fixture (`acmeScenario.evalPass1` / `acmeScenario.evalPass2`):

  | Pass | EvalCase   | Criterion                           | Result   |
  |------|------------|-------------------------------------|----------|
  | 1    | ec_acme_eu | EU data residency requirement honored | **FAIL** |
  | 2    | ec_acme_eu | EU data residency requirement honored | **PASS** |

  The `EvalCase` proves the second pass improved: **FAIL → PASS**.

---

## Loop closure

The 14 beats close the loop end to end:

`observe` (1–3) → `detect` (4–5) → `correct` (6) → `enforce` (7–10) →
`audit` (11) → `improve` (12–14).

## Must-not-cut coverage (all 7 present above)

1. False green — beat 3
2. `GovernanceCase` — beat 5
3. `EnforcementAction` (On Track → At Risk) — beat 7
4. Simulated Linear workstream — beat 8
5. Blocked future action — beat 10
6. `AuditEvent` — beat 11
7. `EvalCase` + Fail → Pass — beats 12–14

No invented persona name appears anywhere above — only the role
`VP Ops / Head of AI Transformation` (persona rule, `DEMO_CONTRACT.md`).
