# Liminal Engine

**The governance layer for agentic work — it gets smarter every time a human corrects it.**

Companies are starting to manage teams of AI agents like teams of people, and can't
answer the question that follows: *is all this AI work actually moving the goals we
resourced it for?* Liminal Engine answers it — it **catches when agents drift from the
goal, enforces the human correction as real operating state, and proves the next agent
pass improved.**

> Submission for the AI Engineer World's Fair Hackathon 2026 · Theme: **The
> Self-Improvement Stack** (a human correction becomes a durable eval/policy update —
> continual learning without touching model weights).

## The problem — *agentic work drift*

Hand real, high-stakes work to AI agents and they report a **false green**: output that
*looks* finished and on-track while silently dropping a load-bearing requirement. A
$1.2M deal's gating requirement — *EU data residency* — is captured in the customer
call but never propagates into the proposal, the scope, or the launch plan. The agents
look productive. The status says "on track." The deal is quietly at risk, and the AI
spend that produced the work isn't moving the goal.

This isn't model hallucination. It's **organizational hallucination** — work that loses
the thread to the business goal it was resourced for.

## What Liminal Engine does

A closed governance loop over agent work:

```text
observe → detect → correct → enforce → audit → improve
```

- **observe** — ingest the agent's work and the streams it drew from (call, proposal,
  launch plan) as *substrate*.
- **detect** — find the silent miss across the streams and open a `GovernanceCase` with
  evidence and **goal-alignment / AI-spend risk** ("$18,400 of spend produced 2 outputs,
  but a gating requirement was lost — the goal isn't advancing").
- **correct + enforce** — compile the human correction into an `EnforcementAction`, flip
  a false *On Track* → *At Risk*, and **gate the downstream action** (block the false
  "on track" customer update) until the work is actually corrected.
- **audit** — append a tamper-evident, hash-chained `AuditEvent` recording the
  correction and the deciding actor.
- **improve** — generate an `EvalCase` from the correction and grade the next pass,
  proving the rerun moves **Fail → Pass**.

The same engine runs on a **second axis** — the **inference proxy** ("Burp for LLM
traffic"): every agent model call is intercepted, routed against model-cost + mission
policy, and sealed to the same audit ledger — **transform** an over-spec request
(Calendar work asking for Opus → downgraded to Haiku), **deny** an off-mission one
(a crypto-trading-bot request), **allow** a justified one (security-critical SSO at
Opus). The proxy proposes new routing policy from observed traffic; the operator
ratifies. *Corrections become policy. Spend governs itself.*

## What's real — and what isn't (honest disclosure)

The engine is **real computed logic**, not hardcoded screens. What does the work is
genuine and tested:

- **Generic, port-driven engine.** `runGovernanceLoop` takes its inputs through injected
  ports (`AgentOutputSource`, `GovernanceCaseStore`, `AuditSink`, `ActionGateStore`,
  `EvalStore`). Detection, enforcement, audit, and eval are algorithmic — they run on
  whatever source is wired in. The `apps/api` HTTP service governs **arbitrary posted
  agent output**: a stranger can `POST /governance/loop` their own data and get the full
  loop back (`./scripts/live-demo.sh your-payload.json` proves it on data we've never seen).
- **Real arbitrary-data ingest.** `packages/substrate` ingests arbitrary streams
  (transcript / proposal / ticket / agent trace) and runs detection over them — the loop
  is substrate-driven, not bound to one baked-in answer.
- **Live Gemini inference.** `GeminiAgentOutputSource` produces an `AgentOutput` from an
  arbitrary transcript by calling Gemini, replaying a **real captured response** from a
  content-addressed cache for deterministic, offline-filmable runs. It never fabricates:
  a cache miss with no key **fails loud** rather than inventing output.
- **Genuinely-live LiveKit.** The voice-correction path mints a real LiveKit access token
  and publishes a **real microphone track** into a real room (`livekit-client`); it
  degrades to a scripted transcript only when creds/mic are absent. (Live speech-to-text
  is not wired — the transcript is operator-entered, labeled as such.)
- **Real Linear remediation.** `LinearRemediationAdapter` turns a remediation payload
  into a real Linear `issueCreate` — **dry-run by default** (prints the exact payload, no
  network), **live only on explicit opt-in**. Quarantined to a composition root; the demo
  spine never calls it.
- **Hash-chained audit ledger.** `AuditEvent`s chain via `prevHash` into a tamper-evident
  ledger that reconstructs the case lifecycle; redaction stores a canonical hash reference
  without breaking the chain (chain-verification + reconstruction tests).
- **Fail-closed action gate.** If gate evaluation throws, the downstream action is
  **denied**, never silently allowed.
- **Deterministic + boundary-enforced.** Contracts hash canonically and are pinned by
  golden vectors — same inputs, byte-identical artifacts. A dependency-cruiser rule
  forbids the demo spine from importing a live integration; enforced by the build, not by
  review.

And, just as plainly, what is **simulated by deterministic fixtures, by design**:

- **Seeded demo traffic.** The worked example (the "Acme expansion") and the inference
  proxy's intercepted calls are seeded so the demo is deterministic and can't flake on
  stage. The engine, verdicts, policy, and audit are real and run on the real contracts —
  the *traffic* is the fixture. Point a real proxy endpoint / live source at it and it
  governs live calls.
- **The simulated Linear workstream panel** (read-only, no network) and **voice STT**
  (operator-entered transcript) are fixtures; both are labeled in the UI.
- **No invented identity.** No fabricated persona or company; the operating entity is not
  yet incorporated.

We'd rather show a real engine with an honestly-scoped example than a polished surface
that quietly fakes the work underneath.

## Run it

**Prerequisites:** Node `>=22.6.0` and `pnpm@11.1.2` (pinned via `packageManager`).

```bash
pnpm install                                       # install workspace deps

# The desktop app — operating Workspace, Inference proxy, and the guided Demo:
pnpm --filter @liminal-engine/desktop-demo dev     # Vite dev server → open the printed URL
                                                   #   Workspace · Inference proxy · Demo (tabs)

# The governance loop as an HTTP service (contract JSON in → contract JSON out):
pnpm --filter @liminal-engine/api dev              # GET /health · POST /governance/{detect,enforce,eval,loop}

# Run the real loop on arbitrary data (no narrator, no fixed sequence):
./scripts/live-demo.sh                             # built-in example
./scripts/live-demo.sh your-payload.json           # your own agent output

pnpm verify                                        # the full proof gate (below)
```

`pnpm verify` typechecks every package and the app, runs the contract + engine +
determinism tests, and enforces the architecture boundary rules. A green `verify` means
the loop is correct and reproducible. CI additionally regenerates the contract goldens
and checks they are committed and current.

## Repo layout

| Path | What it is |
|------|------------|
| `packages/contracts` | The shared kernel — zod contracts, canonical hashing, redaction. All cross-package coupling goes through here. |
| `packages/engine-core` | Pure governance computations (no I/O). |
| `packages/governance` | The loop use-cases + ports — detect, enforce, audit ledger, second-pass eval. |
| `packages/substrate` | Ingest arbitrary streams + detect lost context — runs the loop on real data. |
| `packages/goal-alignment` | Goal + AI-spend model: assess whether the spend is moving the goal. |
| `packages/policy` · `packages/policy-router` | Policy / model-routing rule engines. |
| `packages/correction-pipeline` | Compile a `CorrectionEvent` into actions, policy rules, and approval gates. |
| `packages/eval-library` | Persisted archive of generated `EvalCase`s. |
| `packages/integrations/{gemini,linear,livekit}` | Adapters behind ports — live-capable (Gemini, LiveKit, Linear) with fixture fallback, quarantined from the demo spine. |
| `apps/api` | HTTP service exposing the governance loop on arbitrary posted output. |
| `apps/desktop-demo` | Desktop app: operating Workspace, Inference proxy, and the guided 14-step Demo. |

## Scope of this submission

- This repository is **the entire submission**, net-new for the hackathon. Its git
  history begins with this work.
- It has **no dependency on, and includes no code from, any prior or private Liminal
  repository.** Prior product surfaces informed vocabulary and design language only
  (marked `ADAPTED FROM` where reused); none are part of this submission.
- Partner tech: **Google Gemini** (live inference), **LiveKit** (live room + mic publish),
  **DigitalOcean** (model access).

## License

MIT — © 2026 Shruti Rajagopal and contributors. See [`LICENSE`](./LICENSE).
