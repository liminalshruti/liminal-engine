# Fallback demo path

> Hackathon: Liminal Engine Governance Hack 2026
> **Insurance against a live-demo glitch.** If the live spine fails on stage, you
> switch here and still prove all 14 beats.

This directory holds the **deterministic fallback** for the locked required demo
path (`DEMO_CONTRACT.md`). It exists so a live-demo glitch — a crashed dev server,
a flaky integration, a wifi drop — **cannot sink the run**. The fallback proves
the same 14 steps with **no live Gemini / LiveKit / Linear call**, reading the
same `acmeScenario` fixtures the live spine renders.

## What's here

| File | What it is |
|------|------------|
| [`WALKTHROUGH.md`](./WALKTHROUGH.md) | The scripted 14-beat walkthrough. Read it aloud, in order, to prove the full loop from fixtures. The primary fallback. |
| `../recordings/` | Recorded-walkthrough video, filled by **LIM-1197** (see placeholder below). A second fallback if even the live machine is unavailable. |

## When to switch to the fallback

Switch the moment the live spine can't reliably complete the 14-step path:

- The dev server / desktop app won't start or crashes mid-walkthrough.
- A screen renders blank or errors (e.g. a regression on the live spine).
- The room has no working machine for the presenter — play the recording instead.
- You're over the 3-minute budget and need the fastest deterministic path.

**Rule of thumb:** the live spine is preferred; the fallback is the safety net.
Don't pre-emptively switch — but don't fight a broken live demo on stage either.

## How to switch over (in order of preference)

1. **Recorded walkthrough** (best when live is dead): play the video in
   `../recordings/` (LIM-1197). It is itself a capture of the deterministic spine,
   so it shows the real screens with zero live-call risk.
2. **Scripted walkthrough** (best when you still have a screen): open
   [`WALKTHROUGH.md`](./WALKTHROUGH.md) and narrate the 14 beats in order. Every
   fixture value to read is inline — no app, no build, no tooling required.

Both paths cover the **same 14 beats and all 7 must-not-cut items**, in the same
order, ending on the **Fail → Pass** eval table.

## Why this is deterministic (and stays in sync)

The walkthrough transcribes its values **verbatim** from the fixtures on `main`:

- Data source: `packages/contracts/src/fixtures/acme.ts` (`acmeScenario`) —
  contract-validated by `fixtures.test.ts`, beat-tied by `acme-beats.test.ts`.
- Beat order / screen mapping: `apps/desktop-demo/src/steps.tsx` (the 14
  `DEMO_STEPS`).

Because the fallback reads the same locked fixtures as the live spine, the two
**cannot tell different stories**. If those fixtures change, update
`WALKTHROUGH.md` to match (it is a static transcription, not a live import — by
design, so the fallback needs zero build tooling to render).

> **Maintenance note:** this directory is intentionally **self-contained** and
> owns only `demos/fallback/*`. It does not import or modify the live spine
> (`apps/desktop-demo/src/screens/*`, `steps.tsx`, the fixture file) — those are
> read-only inputs transcribed here, so the fallback can never break the build it
> backs up.

## LIM-1197 — recorded walkthrough (placeholder)

LIM-1197 fills `../recordings/` with a recorded walkthrough of the deterministic
spine. Until then:

- [ ] **LIM-1197:** capture a recording of the live spine walking all 14 beats,
      drop it in `demos/recordings/`, and link it here + in `SUBMISSION.md`.
- Recording link: _TBD (LIM-1197)_

Until LIM-1197 lands, the **scripted [`WALKTHROUGH.md`](./WALKTHROUGH.md) is the
operative fallback** and is sufficient on its own to prove all 14 beats.
