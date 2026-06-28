# SUBMISSION — Liminal Engine

> AI Engineer World's Fair Hackathon 2026 · Theme: **The Self-Improvement Stack**
> (secondary: **Continual Learning**).
>
> **Repo:** https://github.com/liminalshruti/liminal-engine (public)
> **Team:** Shruti Rajagopal · Sean Nejad

This is the judge-facing companion to the [README](./README.md): what we built, what's
real vs. simulated, and where every claim is verifiable in the code.

## The one line

**Liminal is the governance layer for agentic work that gets smarter every time a human
corrects it — it catches drift from the goal, enforces the fix, and proves the next pass
improved.**

Companies are starting to run teams of AI agents like teams of people, and can't answer
the question that follows: *is all this AI work moving the goals we resourced it for?*
Liminal answers it.

## What we built (net-new, this hackathon)

The repo's entire git history begins with this build. Prior Liminal surfaces informed
vocabulary and design language only (marked `ADAPTED FROM` where reused; catalogued in
`IP_RECEIPT.md`). The demo highlights only functionality built here.

- **Governance loop engine** (`packages/governance`, `engine-core`) — port-driven
  `observe → detect → correct → enforce → audit → improve`, real computed logic.
- **Eval Fail→Pass + persisted archive** (`eval-harness`, `eval-library`).
- **Policy + correction pipeline** (`policy`, `policy-router`, `correction-pipeline`) —
  a `CorrectionEvent` compiles into policy rules + approval gates.
- **Substrate ingest** (`packages/substrate`) — runs the loop on arbitrary streams, not
  one baked-in answer.
- **Goal + AI-spend alignment** (`packages/goal-alignment`) — the executive wedge: "$X of
  AI spend produced N outputs, but the goal isn't moving."
- **Inference proxy** ("Burp for LLM traffic") — intercepts model calls, routes against
  cost + mission policy (transform / deny / allow), seals to the audit ledger.
- **Hash-chained audit ledger** — tamper-evident, reconstructable, redaction-safe.
- **Live integrations** — Gemini (live inference, cache-replayed, fails-loud), LiveKit
  (real room + mic publish), Linear (real `issueCreate`, dry-run default).
- **Two surfaces over the engine** — `apps/api` (governs arbitrary posted output) and
  `apps/desktop-demo` (operating Workspace · Inference proxy · guided 14-step Demo).

## Is it real? (the honesty judges should rely on)

**Real, computed, tested:** the governance loop, eval grading, policy/correction
pipeline, hash-chained audit, fail-closed gate, substrate ingest, goal/AI-spend model,
the inference-proxy policy engine, and the live Gemini / LiveKit / Linear adapters. The
`apps/api` service governs **arbitrary posted agent output** — `./scripts/live-demo.sh
your-payload.json` runs the full loop on data we've never seen.

**Simulated by deterministic fixtures, by design:** the worked example (Acme expansion)
and the proxy's intercepted traffic are seeded so the demo can't flake on stage — the
engine/verdicts/audit are real and run on the real contracts; the *traffic* is the
fixture. The simulated Linear workstream panel (read-only) and voice STT
(operator-entered transcript) are fixtures, labeled in the UI. Live STT is not wired.

**No invented identity:** operator is a role only ("VP Ops / Head of AI Transformation");
no fabricated persona or company; the entity is not yet incorporated.

## The 14-beat demo (the worked example)

The guided Demo (desktop app → "Demo" tab) walks the Acme false-green case end to end;
every screen renders live `runGovernanceLoop` output (`useDemo()`), not hardcoded screens.

| Beat | What's shown | Screen | MNC |
|------|---|---|---|
| 1–2 | Goal: "Close Acme expansion — $1.2M ARR" | Initialize | |
| 3 | Agent output reads "on track" (false green) | AgentActivity | #1 |
| 4 | EU data-residency requirement revealed as dropped | ContextTray | |
| 5 | `GovernanceCase` opened with evidence + business impact | GovernanceCase | #2 |
| 6–7 | Approve + Enforce → status flips On Track → At Risk | EnforcementPanel | #3 |
| 8–9 | Simulated Linear workstream; Product/Security/Eng owners required | EnforcementPanel | #4 |
| 10 | False customer-facing "on track" update blocked by the gate | EnforcementPanel | #5 |
| 11 | `AuditEvent` recorded on the hash-chained ledger | AuditTrail | #6 |
| 12–14 | `EvalCase` generated; second pass; eval table shows Fail → Pass | SecondPassEval | #7 |

All 7 must-not-cut items and all 14 beats are verified on screen and in
`apps/desktop-demo/test/demo-path.e2e.test.ts` (the e2e asserts the rendered case is the
engine's live loop-detected case — UI == engine).

## Verification

`pnpm verify` is the proof gate: typecheck (every package + the app), the contract /
engine / determinism test suite, and dependency-cruiser boundary rules. Current main:
**662 tests pass, 0 boundary violations**; a spine-guard asserts all 14 beats + 7
must-not-cut items are present and no spine test is skipped. Contracts hash canonically
and are pinned by golden vectors — same inputs, byte-identical artifacts.

## Partner technology

- **Google Gemini** — live inference producing `AgentOutput` from arbitrary transcripts
  (cache-replayed for determinism; never fabricates).
- **LiveKit** — genuinely-live room connection + real microphone publish for the
  voice-correction path.
- **DigitalOcean** — model access wired for inference.

## Claim scan (brand / entity rules) — clean

Full scan in `specs/CLAIM_SCAN_AUDIT.md`. Summary of what is intentionally absent:

- No "Liminal, Inc." — the entity is not yet incorporated (MIT © "Shruti Rajagopal and contributors").
- No invented persona name — the operator is a role only.
- Founder bio claims are limited to the accurate record: UC Berkeley (Cognitive Science & Computer Science); PM at Asana, Cloudflare, Robinhood, Ancestry.
- No AI/Anthropic attribution in commit messages or submission materials.
