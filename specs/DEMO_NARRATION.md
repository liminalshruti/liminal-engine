# Demo narration — 60-second cut (submission video)

> Hybrid: the REAL loop runs (substrate/API + live integrations), Acme is the input.
> Frame it as the product running on real data — no "let me walk you through a demo."
> Runner: `./scripts/live-demo.sh` (or the polished desktop app via `pnpm --filter @liminal-engine/desktop-demo dev`).

## The one-line pitch (say first, ~8s)
"AI agents now do real work — but they silently drop the requirements the work was
resourced for. **Liminal is the governance layer that catches that drift, enforces the
correction, and proves the next agent pass actually improved.**"

## The 10 cuts → 60 seconds (≈5s each)

| # | On screen | Say (tight) |
|---|---|---|
| 1 | Goal enters | "A $1.2M Acme expansion. Agents are resourced to close it." |
| 2 | Agents report green | "The agent team reports it on track." |
| 3 | False green ruptures | "But Liminal sees what they missed — the EU data-residency requirement was in the customer context and **absent from the output**." |
| 4 | GovernanceCase opens | "It opens a formal governance case — severity blocking, $1.2M at risk." |
| 5 | Operator Approve + Enforce | "A human approves enforcement — one decision." |
| 6 | Status flips | "The operating state changes: **on-track → at-risk**." |
| 7 | Downstream blocked | "The false 'on-track' customer update is **blocked** until it's corrected." |
| 8 | Audit sealed | "Every step is sealed in a tamper-evident audit receipt — actor, action, hash chain." |
| 9 | Correction → EvalCase | "The correction becomes an **eval case** — the system learns what mattered." |
| 10 | Fail → Pass | "Second pass: **Fail → Pass.** The agents improved because Liminal governed them." |

## Close (~7s)
"That's the self-improvement stack for agentic work: **detect drift, enforce the
correction, prove the next pass is better.** And it runs on *any* posted agent output —
not a scripted demo." *(optionally run `./scripts/live-demo.sh` on the Globex payload to
show it works on arbitrary data.)*

## Honesty notes for Q&A (judging rule: clearly identify what was built)
- **Real, built during hack:** governance loop, eval Fail→Pass, policy/correction
  pipeline, intercept gateway, API server, substrate ingest (runs the loop on arbitrary
  streams), live Gemini (cache-backed real inference), genuinely-live LiveKit room
  connection + browser mic publish.
- **Simulated by deterministic fixtures (by design):** the Linear workstream panel; live
  STT for the voice path (transcript is operator-entered — labeled in the UI).
- **What's NOT done:** the full operating-surface workspace UI (the app still leads with
  the beat sequence; the real arbitrary-data path is shown via the API/runner).
- If asked "is this a demo flow?": "No — the same engine governs any posted agent output;
  `./scripts/live-demo.sh your-payload.json` proves it on data we've never seen."
