# JUDGING_MAP.md — Liminal Engine — Rubric → Thesis → Demo Beat

> Hackathon: Liminal Engine Governance Hack 2026
> Linear: **LIM-1157** — Map judging criteria to Liminal thesis (M0 · Brief / Scope)

Maps every judging criterion to the Liminal thesis and to a **specific demo beat
or artifact**, so the build emphasizes what scores. Beat numbers (`#N`) reference
the LOCKED required path in `DEMO_CONTRACT.md`; must-not-cut numbers (`MNC#N`)
reference its must-NOT-cut list. This doc does not change the contract — it reads
it.

**Rubric (as briefed):** Technicality 40% · Creativity/Originality 25% · Live
Demo 20% · Future Potential / AI Impact 15%.

---

## Theme positioning

- **Primary theme — The Self-Improvement Stack.** Liminal Engine builds
  infrastructure for observing, governing, correcting, evaluating, and improving
  agentic work. Human correction does not disappear into chat history; it becomes
  enforceable operating state, then becomes an `EvalCase` that gates future agent
  behavior until it improves.
- **Secondary theme — Continual Learning.** The second pass (`#13`) is graded
  against an `EvalCase` generated from the first correction (`#12`), and the eval
  table proves Fail → Pass (`#14` / `MNC#7`).

**Final thesis sentence (single source of truth):** *Liminal Engine demonstrates
The Self-Improvement Stack by turning human correction into enforceable system
improvement: agentic work is observed, misalignment is detected, governance is
applied, audit evidence is recorded, evals are generated, and future agent
behavior is gated until it improves.*

Core loop: `observe → detect → correct → enforce → audit → improve`.

---

## 1 · Technicality — 40%

**Thesis claim:** This is an agentic control-plane loop with observability,
correction, enforcement, evals, and real operating-state change — not a wrapper
chatbot, basic RAG, or a dashboard.

| Thesis sub-claim | Demo beat / artifact |
|---|---|
| Observe agent work against a business goal | `#2` goal · `#3` agent output |
| Detect a lost requirement across artifacts | `#4` reveal · `#5` `GovernanceCase` (`MNC#2`) |
| Correct + enforce changes operating state | `#6` Approve+Enforce · `#7` On Track→At Risk (`MNC#3`) |
| Enforcement creates workstream + owner requirement | `#8`/`#9` simulated Linear workstream (`MNC#4`) |
| Enforcement blocks a future bad action | `#10` blocked customer-facing update (`MNC#5`) |
| Audit evidence captured | `#11` `AuditEvent` (`MNC#6`) |
| Correction becomes an eval, second pass proves improvement | `#12` `EvalCase` · `#13` re-run · `#14` Fail→Pass (`MNC#7`) |

**Why it scores:** every sub-claim is a visible artifact backed by deterministic
fixtures in `packages/{governance,eval-harness}` and surfaced in
`apps/desktop-demo`.

---

## 2 · Creativity / Originality — 25%

**Thesis claim:** Reframes the AI-agent adoption question from *"can agents
generate work?"* to *"is the AI work we are paying for actually advancing the
goals we resourced it for?"* The original move: human correction becomes
enforceable operating constraints (status, workstreams, blocked actions, gates,
evals, audit), not chat history.

| Thesis sub-claim | Demo beat / artifact |
|---|---|
| Category is agentic work *governance*, not productivity automation | Whole arc `#1`–`#14`; framed in `README.md` / `SUBMISSION.md` |
| Correction → enforceable constraint (the creative core) | `#7` status flip + `#8` workstream + `#10` block (`MNC#3`/`#4`/`#5`) |
| Governs "teams of people managing teams of agents" | `#9` owner requirement (Product/Security/Engineering) |

**Why it scores:** the before/after is a *category* shift a judge can name in one
sentence, anchored to the false-green scenario rather than a generic demo.

---

## 3 · Live Demo — 20%

**Thesis claim:** A clear before/after arc judges grasp in under three minutes.

| Thesis sub-claim | Demo beat / artifact |
|---|---|
| Clear setup | `#1` init · `#2` goal · context cards |
| The "before" (false green) | `#3` "Acme expansion appears on track" (`MNC#1`) |
| The turn (detection) | `#4`/`#5` lost EU data-residency requirement (`MNC#2`) |
| The "after" (enforced correction) | `#6`–`#11` |
| The proof (continual learning) | `#12`–`#14` Fail→Pass (`MNC#7`) |
| Under 3 minutes, runs in order | `DEMO_CONTRACT.md` acceptance · `scripts/smoke.sh` |

**Why it scores:** single locked path, deterministic fixtures (no live-call
flakiness), written fallback walkthrough in `demos/fallback/WALKTHROUGH.md` (the
backup *video* is a pending manual step before submission).

---

## 4 · Future Potential / AI Impact — 15%

**Thesis claim:** The MVP is a thin slice of a control plane for agentic
organizations — leaders managing human teams, agent teams, and the people who
manage agent teams need alignment-to-goal, policy governance, audit, and
improvement-from-correction as AI spend grows.

| Thesis sub-claim | Demo beat / artifact (or expansion path) |
|---|---|
| The loop generalizes beyond one scenario | `#1`–`#14` shown as a reusable loop, not a one-off |
| Real integrations are a port away | `packages/integrations/{linear,gemini,livekit}` stubs; `#8` simulated panel is the seam |
| Evals compound into a library from real corrections | `#12` `EvalCase` generated from correction → eval library |
| Board/investor evidence, RBAC, proxy enforcement | Named as expansion in `README.md`; **not** in demo scope |

**Why it scores:** the demo earns the right to claim the larger control plane by
shipping the smallest loop that already closes.

---

## Coverage & gaps (acceptance criterion #2)

Each criterion against **current demo state**. `Gap` / `Partial` items are where
the demo does not yet fully serve a criterion — these are the things to watch as
the spine is built.

Status as of the demo-complete milestone (all 7 screens + the full governance
loop, eval Fail→Pass, audit-ledger, and fail-closed gate are merged to `main`).

| Criterion | Weight | Status | Note / residual |
|---|---|---|---|
| Technicality | 40% | **Covered** | The governance loop emits + the spine renders every artifact — `GovernanceCase`, `EnforcementAction`, the On Track→At Risk flip, the blocked action, hash-chained `AuditEvent`, `EvalCase`, Fail→Pass — across all 14 beats (all 7 screens filled). Determinism + fail-closed gate + audit reconstruction are tested on `main`. The live single-source-of-truth provider (`buildGovernanceDemo`, LIM-1245 / #34) is **merged** — `runGovernanceLoop` returns its full result and the demo renders the loop's real output. **Residual (mechanical):** individual screens swap their import from the fixtures to that provider (one line each). |
| Creativity / Originality | 25% | **Covered** | The before/after category shift is on screen: enforcement is *visible* (status flip + blocked customer update + Linear workstream with required owners), not alerting. |
| Live Demo | 20% | **Covered** | All 14 beats render in order across the 7 screens; a written fallback walkthrough is on `main` (`demos/fallback/WALKTHROUGH.md`). **Residual (manual, founder):** record the fallback *video* + walk `scripts/smoke.sh` to confirm < 3 min end to end (SUBMISSION.md open items). |
| Future Potential / AI Impact | 15% | **Covered (narrative)** | Carried by framing in `README`/`SUBMISSION`; needs no new demo beat. Do not over-build real integrations at the spine's expense. |

### Residuals to close (the spine is built; these are what's left)

1. **Point screens at the live provider (LIM-1245 / #34 — MERGED).** The
   `buildGovernanceDemo` single-source-of-truth provider is on `main` (the loop
   returns its full result; the demo renders real `runGovernanceLoop`/`runEvals`
   output). Remaining is mechanical: each screen swaps its import from
   `@contracts/fixtures` to `../lib/governance-demo` (one line each) so the UI
   provably *is* the engine — the strongest answer to "is this real or scripted?"
2. **Record the fallback video + walk `scripts/smoke.sh`** (manual, founder).
   The written `demos/fallback/WALKTHROUGH.md` is on `main`; the *recording* and a
   timed < 3-min smoke pass are the open SUBMISSION.md items. A flaky live run with
   no video is still the one way to lose the 20% Live Demo category.
3. **Persona stays role-only.** No invented name anywhere on screen/narration —
   `VP Ops / Head of AI Transformation` etc. (DEMO_CONTRACT persona rule). Confirm
   at the final claim-scan.
4. **No criterion rewards real Gemini/LiveKit/Linear.** They sit on the
   cut-if-risky list. Building them does not raise any score and endangers the
   Technicality + Live Demo artifacts that do. Keep simulated.

---

## Cross-references

- Demo beats & must-not-cut spine: `DEMO_CONTRACT.md`
- In/out of scope: `SCOPE_SPEC.md`
- Judge-facing claim & checklist: `SUBMISSION.md`
- Build issues: `ops/linear/ISSUES.md`, `ops/linear/P0_ISSUES.md`
