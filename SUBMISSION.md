# SUBMISSION.md — Liminal Engine — Agentic Work Governance MVP

> Hackathon: Liminal Engine Governance Hack 2026

The pre-submission checklist and the net-new claim judges will rely on.

## What we're submitting

**Liminal Engine — Agentic Work Governance MVP.** A governance layer that catches
false greens in agentic work and forces provable correction, demonstrated on the
Acme $1.2M false-green scenario. Loop: `observe → detect → correct → enforce →
audit → improve`.

Submitted under **The Self-Improvement Stack** (secondary: **Continual
Learning**). How each rubric criterion maps to a demo beat — and where coverage
gaps remain — is in **`JUDGING_MAP.md`**.

## Net-new claim (read this, judges)

- The submission scope is **this standalone public repo** — `liminal-engine`
  (`github.com/liminalshruti/liminal-engine`) — the Liminal Engine Agentic Work
  Governance MVP.
- It is the **net-new 2026 hackathon build**. Prior Liminal repos are
  reference/context only; the demo only highlights functionality built here.
- Any adapted prior-work code is explicitly marked (`// ADAPTED FROM: …`) and
  catalogued in `IP_RECEIPT.md`.

## Repo visibility — DONE

- [x] Published as a **standalone PUBLIC repo** `liminal-engine`
      (`github.com/liminalshruti/liminal-engine`), not by making the private
      multi-project parent public.
- [x] Entire git history begins with the hackathon (clean net-new boundary,
      first commit is t=0).
- [x] **MIT `LICENSE`** present at repo root.
- [x] **Final verification passed** — no secrets / `.env` / unrelated sibling
      projects included; README and demo reflect final build; all tests green.

## Demo readiness

- [x] Required demo path (`DEMO_CONTRACT.md`) runs end to end, in order — all 7
      screens filled + merged; the 14-step Acme walkthrough renders.
- [x] All must-not-cut items visibly present (MNC#1–7 each rendered on screen).
- [x] Eval table shows Fail → Pass (SecondPassEval, beat #14 / MNC#7).
- [x] `scripts/smoke.sh` passes; `pnpm verify` green (151 tests, 0 boundary violations).
- [x] Determinism guaranteed — a test runs the loop twice and asserts identical artifacts.
- [x] **Screens render live `runGovernanceLoop` output, not raw fixtures** (LIM-1255,
      merged) — all 7 screens read `useDemo()` (the real `buildGovernanceDemo()` result).
      **UI == engine verified end-to-end:** the un-skipped beat-#5 e2e asserts the screen's
      case is the engine's live loop-detected case (18/18 e2e, zero skips).
- [ ] Completes in under 3 minutes — *confirm in a live rehearsal* (LIM-1246 pacing pass).
- [ ] Fallback recording in `demos/fallback/` — *manual; record before submission.*
      (The deterministic fallback *walkthrough* is written/merged; the video is pending.)

## Persona

- [x] Generic operator language retained (role only — "VP Ops / Head of AI
      Transformation"). **No invented persona name anywhere** (verified). Persona
      extraction from `liminal-prototype` is optional/post-hack (LIM-1247).

## 14-beat path verification

All 14 required demo beats are implemented, live-wired to the engine, and covered by tests:

| Beat | Requirement | Screen | Status |
|------|---|---|---|
| 1–2 | Initialize workspace + business goal | `Initialize` | ✓ Renders goal: "Close Acme expansion — $1.2M ARR" |
| 3–4 | Agent output reads "on track"; EU data-residency dropped | `AgentActivity` → `ContextTray` | ✓ False green + dropped requirement visible |
| 5 | `GovernanceCase` flags dropped requirement with evidence | `GovernanceCase` | ✓ MNC#2: detection artifact on screen |
| 6–7 | Operator clicks Approve + Enforce; status flips On Track → At Risk | `EnforcementPanel` | ✓ MNC#3: status flip visible in UI |
| 8–9 | Simulated Linear workstream; Product / Security / Engineering owners required | `EnforcementPanel` | ✓ MNC#4: workstream + required owners shown |
| 10 | Blocked customer-facing "on track" update (gate enforced) | `EnforcementPanel` (blocked-action banner) | ✓ MNC#5: action gate prevents false update |
| 11 | `AuditEvent` recorded on hash-chained ledger | `AuditTrail` | ✓ MNC#6: audit evidence captured and reconstructable |
| 12–14 | `EvalCase` generated; second pass re-runs; eval table shows Fail → Pass | `SecondPassEval` | ✓ MNC#7: improvement proven in eval table |

**Coverage:** All 7 must-not-cut items (MNC#1–7) and all 14 beats verified on screen. Engine-produced output (via `buildGovernanceDemo()` and `runGovernanceLoop()`) fed live to the UI (`useDemo()` hook); not hardcoded screens. Backbone tested in `apps/desktop-demo/test/demo-path.e2e.test.ts` (18/18 e2e, zero skips).

## Claim scan (brand/entity rules)

- [x] **No Stanford references.** Verified across `/src`, `/apps`, `/packages`, `.md` files. CLAUDE.md rule enforced: Shruti is UC Berkeley (Cognitive Science & Computer Science).
- [x] **No SPC fellow claim.** Shruti applied to South Park Commons but is not a member. Not mentioned anywhere.
- [x] **No "Liminal, Inc." claims.** Entity stated as not yet incorporated per CLAUDE.md. References correctly note "Shruti Rajagopal and contributors" (MIT license).
- [x] **No invented persona name.** Operator referred to generically as "VP Ops / Head of AI Transformation" (meets DEMO_CONTRACT persona rule).
- [x] **No Claude/Anthropic attribution in code or submission materials.** Git commit messages and SUBMISSION.md clean per global CLAUDE.md rule.

## Live-demo timing note

The full 14-step walkthrough (`scripts/smoke.sh` checklist) targets **under 3 minutes**. Deterministic engine (no live API calls) + fixtures guarantee repeatable performance. Final timing confirmation: pending founder rehearsal before judges receive the link (SUBMISSION.md open item).

## Links (fill in)

- Public repo URL: _TBD_
- Demo video URL: _TBD_
- Submission portal entry: _TBD_
