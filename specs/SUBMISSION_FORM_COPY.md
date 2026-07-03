# Submission-form copy — AI Engineer World's Fair Hackathon 2026

> Theme: **The Self-Improvement Stack** (primary) · Continual Learning (secondary).
> Repo must be PUBLIC. Demo video ≤1 min. Rule: clearly identify what was built during
> the hack or face DQ. Special prizes pursued: Gemini 3.5, LiveKit, DigitalOcean.

## Project name
**Liminal Engine — agentic-work governance**

## One-liner
The governance layer for agentic work: it catches when AI agents drift from the business
goal they were resourced for, enforces the human correction, and proves the next agent
pass improved (eval Fail → Pass).

## What it does (3 sentences)
AI agents do real work but silently drop load-bearing requirements — a customer's EU
data-residency requirement is captured in a call but never propagates into the proposal,
so the agents look productive while the deal quietly goes at-risk. Liminal runs a real
governance loop over arbitrary posted agent output — observe → detect → correct → enforce
→ audit → improve — opening a governance case, flipping deal status, blocking the bad
downstream action, sealing a tamper-evident audit receipt, and turning the correction into
an eval case. The second agent pass is then graded against that eval case and moves Fail →
Pass — the system gets more useful the more it's corrected.

## Theme fit — Self-Improvement Stack
It's the infrastructure that makes agent systems self-improve at scale: an evaluation
framework (EvalCase + Fail→Pass grading), observability (hash-chained audit ledger),
a policy/correction pipeline (CorrectionEvent → PolicyRule/ApprovalGate), and an intercept
control plane over real agent actions. A human correction becomes a durable eval/policy
update — continual learning without retraining weights.

## Built DURING the hackathon (our original contributions)
- Governance loop engine (`packages/governance`, `engine-core`) — detect→correct→enforce→audit→improve.
- Eval harness + persisted eval archive (`eval-harness`, `eval-library`) — Fail→Pass grading.
- Policy engine + correction pipeline (`policy-router`, `correction-pipeline`).
- Substrate ingest (`packages/substrate`) — runs the loop on arbitrary ingested streams, not a fixture.
- Intercept gateway + policy control plane (`integrations/intercept-gateway`, `policy`).
- Real governance HTTP service (`apps/api`) — governs any posted agent output.
- Live Gemini inference (cache-backed, env-keyed) over arbitrary input.
- Genuinely-live LiveKit: real room create/connect + browser mic publish (verified round-trip).
- Active-requirement checker — grades real outputs/actions vs user-authored requirements.
- Desktop demo app (React/Vite) — the 7-screen governance walkthrough, UI==engine (live loop drives the screens).
- Zod contracts + canonical/golden vectors for every artifact; CI conformance + spine-guard gates.

## Real vs. simulated (stated up front — judging honesty)
- **Real / live:** governance loop + eval + policy/correction + audit chain (all computed & tested);
  substrate ingest on arbitrary data; live Gemini inference; LiveKit room connection + mic publish; the API service.
- **Simulated by deterministic fixtures (by design):** the Linear workstream panel (no live Linear write);
  live speech-to-text for the voice path (transcript is operator-entered — labeled as such in the UI).
- **Reference / prior work (clearly marked, NOT counted as hack work):** design tokens vendored
  from the Liminal prototype design system (`ADAPTED FROM` markers); copy register-lift.

## Special-prize hooks
- **Gemini 3.5:** live cache-backed Gemini inference drives agent-output generation on arbitrary input.
- **LiveKit:** genuinely-live room connection + browser microphone publish for voice-driven correction (verified).
- **DigitalOcean:** DO model access key wired for inference (`DIGITAL_OCEAN_MODEL_ACCESS_KEY` / `DO_MODEL`).

## Tech
TypeScript monorepo (pnpm), React 18 + Vite desktop demo, Node HTTP API, Zod contracts,
deterministic golden-vector tests, dependency-cruiser boundary enforcement, CI conformance
+ spine-guard. Entity not yet incorporated; MIT © "Shruti Rajagopal and contributors".

## Repo
github.com/liminalshruti/liminal-engine (public)

## Checklist before submitting
- [ ] Repo is PUBLIC
- [ ] Demo video ≤1 min, shows only hack-built functionality, link accessible
- [ ] All team members added to the submission page
- [ ] README "what's real vs simulated" section present (it is)
- [ ] No `Liminal, Inc.` / no invented persona / no overclaim (claim-scan: PASS on main)
- [ ] Decide which queued PRs to merge (UI polish, LiveKit #119, runner #120) before tagging the submission commit
