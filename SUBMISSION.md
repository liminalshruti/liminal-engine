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
- [ ] Final check before judges: confirm no secrets / `.env` / unrelated sibling
      projects are included, and the README/demo reflect the final build.

## Demo readiness

- [x] Required demo path (`DEMO_CONTRACT.md`) runs end to end, in order — all 7
      screens filled + merged; the 14-step Acme walkthrough renders.
- [x] All must-not-cut items visibly present (MNC#1–7 each rendered on screen).
- [x] Eval table shows Fail → Pass (SecondPassEval, beat #14 / MNC#7).
- [x] `scripts/smoke.sh` passes; `pnpm verify` green (124 tests, 0 boundary violations).
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

## Links (fill in)

- Public repo URL: _TBD_
- Demo video URL: _TBD_
- Submission portal entry: _TBD_
