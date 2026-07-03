# Claim-Scan / Submission Truth Audit — LIM-1201

> Must-not-cut submission gate. Scanned against `origin/main` `6288f7c` on 2026-06-28.
> Verifies README, demo, and submission copy only claim what the hack actually built.

## Verdict: ✅ PASS — main is clean on all 7 acceptance criteria.

| # | Acceptance criterion | Result | Evidence |
|---|---|---|---|
| 1 | No `Liminal, Inc.` claim | ✅ PASS | All grep hits are *negative* references (rules forbidding it / checklist confirmations). No entity claim anywhere. |
| 2 | Entity stated as not-yet-incorporated where relevant | ✅ PASS | `IP_RECEIPT.md:31,44`; `README.md:77-78`. LICENSE copyright = "Shruti Rajagopal and contributors" (not an Inc.). |
| 3 | No invented persona name | ✅ PASS | `copy.ts` (the single demo-copy module) uses roles only; `ContextTray.tsx:24` documents "the deciding actor / persona is never named (a ROLE only)." No proper-name attributions in screens/copy. |
| 4 | Demo claims match actual behavior | ✅ PASS | README "What's real vs. simulated" (§58) is precise + verifiable. "18/18 e2e" = the 18 engine-vs-UI `assert`s in `governance-demo.test.ts` (UI == engine via real `buildGovernanceDemo()`). Number confirmed accurate, not stale. |
| 5 | Real vs mocked integrations clearly labeled | ✅ PASS | Integration packages self-label honestly: gemini/livekit/linear `src/index.ts` headers each say "FIXTURE STUB … no live …" and cite DEMO_CONTRACT cut-if-risky. README §75 lists them as "Simulated by deterministic fixtures, by design." Boundary lint forbids live calls on the spine. |
| 6 | No prior work presented as new | ✅ PASS | Adapted prior-work files carry `ADAPTED FROM` provenance markers (`copy.ts`, `design-tokens.css` — vendored from liminal-prototype). |
| 7 | Public/private/IP boundary respected | ✅ PASS | No `.env`/secret/api-key files tracked in git; `.env.local` confirmed gitignored. IP_RECEIPT.md present. |

## Note for the founder (not a main defect)

**PR #88 (LiveKit, UNMERGED) overclaims "real LiveKit."** Verified at `packages/integrations/livekit/src/index.ts:116-125` *on that branch*: even when credentials are present, the adapter logs setup then returns the scripted fixture ("Using demonstration fixture for now"). The PR title "real LiveKit voice-correction" and its conformance-matrix line "Real LiveKit code path ✅" are inaccurate. This is **not on main** (main's livekit adapter is honestly labeled "FIXTURE STUB"). Flagged in the #88 review; must be corrected before #88 is merged, or it would introduce a criterion-5 violation.

## What was scanned
- `Liminal, Inc.` / Stanford / SPC fellow (entity + bio hard-stops)
- Invented persona names in demo copy + all 7 screens
- `real`/`live` integration claims across packages, app, README, SUBMISSION
- Integration package self-labeling (gemini/livekit/linear honesty)
- `ADAPTED FROM` provenance markers
- Tracked secrets / `.env` files + gitignore status
- Entity-status + MIT copyright holder
- README hard-number claims (18/18 e2e, 14-step, 7 screens) for staleness
