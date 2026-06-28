# Liminal Engine

**Governance for agentic work — catch the _false green_.**

> Submission for the Liminal Engine Governance Hack 2026.

## The problem

When a team hands real, high-stakes work to AI agents, the agents can report a
**false green**: output that *looks* finished and on-track while silently dropping
a load-bearing requirement. The status says "on track," the customer update goes
out, and nobody notices the gap until it ships.

## What Liminal Engine does

Liminal Engine is a governance layer that runs a closed loop over agent output:

```text
observe → detect → correct → enforce → audit → improve
```

- **observe** — take in an agent's reported output for a piece of work.
- **detect** — find the silent miss (a requirement the agent dropped) and open a
  `GovernanceCase` with the supporting evidence.
- **correct + enforce** — compile the correction into an `EnforcementAction`, flip
  a false *On Track* to *At Risk*, and **gate the downstream action** (e.g. block a
  customer-facing "on track" update) until the work is actually corrected.
- **audit** — append a tamper-evident, hash-chained `AuditEvent` recording the
  correction and the deciding actor.
- **improve** — generate an `EvalCase` from the correction and grade the next pass,
  proving the rerun moves **Fail → Pass**.

## What's real — and what isn't (honest disclosure)

The engine is **real computed logic**, not hardcoded screens. The pieces that do
the work are genuine and tested:

- **Generic, port-driven engine.** `runGovernanceLoop` (in `packages/governance`)
  takes its inputs through injected ports (`AgentOutputSource`, `GovernanceCaseStore`,
  `AuditSink`, `ActionGateStore`, `EvalStore`). The detection, enforcement, audit,
  and eval logic is algorithmic — it runs on whatever data source is wired in, not
  on a baked-in answer.
- **Hash-chained audit ledger.** `AuditEvent`s chain via `prevHash` into a
  tamper-evident ledger that reconstructs the case lifecycle; redaction stores a
  canonical hash reference without breaking the chain (`packages/governance/src/audit-ledger.ts`,
  with chain-verification + reconstruction tests).
- **Fail-closed action gate.** If gate evaluation throws, the downstream action is
  **denied**, never silently allowed (`proxy-gate.ts`; tested).
- **Deterministic.** Contracts hash canonically and are pinned by golden vectors;
  the same inputs produce byte-identical artifacts, so results are reproducible.
- **Boundary-enforced architecture.** A dependency-cruiser rule forbids the UI from
  importing a live integration directly — cross-package coupling goes through the
  `contracts` kernel only. Enforced by the build, not by review.

And, just as plainly, what is **not** real yet in this build:

- **One worked example.** The bundled reference dataset is a single scenario (the
  "Acme expansion" case). The engine is generic, but the composition roots
  (`apps/api`, `apps/desktop-demo`) currently bind it to that fixture rather than to
  arbitrary, caller-supplied work. Pointing it at your own data is the next step,
  not something this build does on demand.
- **External integrations sit behind ports.** Gemini and Linear are deterministic
  stubs; the LiveKit adapter is implemented but falls back to a scripted transcript.
  Real adapters swap in at the composition root without touching the engine — but
  they are not running live here.
- **No invented identity.** There is no fabricated persona or company; the operating
  entity is not yet incorporated.

We'd rather show a real engine with an honestly-scoped example than a polished
surface that quietly fakes the work underneath.

## Run it

**Prerequisites:** Node `>=22.6.0` and `pnpm@11.1.2` (pinned via `packageManager`).

```bash
pnpm install                              # install workspace deps

# The governance loop as an HTTP service (contract JSON in → contract JSON out):
pnpm --filter @liminal-engine/api dev     # starts the API; try GET /health,
                                          # POST /governance/{detect,enforce,eval,loop}

# A reference UI that renders the live engine output for the worked example:
pnpm --filter @liminal-engine/desktop-demo dev   # Vite dev server → open the printed URL

pnpm verify                               # the full proof gate (see below)
```

`pnpm verify` typechecks every package and the app, runs the contract + engine +
determinism tests, and enforces the architecture boundary rules. A green `verify`
means the loop is correct and reproducible. CI additionally regenerates the contract
goldens and checks they are committed and up to date.

To serve a production build of the reference UI instead of the dev server:

```bash
pnpm --filter @liminal-engine/desktop-demo build
pnpm --filter @liminal-engine/desktop-demo preview
```

## Repo layout

| Path | What it is |
|------|------------|
| `packages/contracts` | The shared kernel — zod contracts, canonical hashing, redaction. All cross-package coupling goes through here. |
| `packages/engine-core` | Pure governance computations (no I/O). |
| `packages/governance` | The loop use-cases and ports — detect, enforce, audit ledger, second-pass eval. |
| `packages/policy-router` | Rule engine: load active rules and compile matches into enforcement actions. |
| `packages/correction-pipeline` | Compile a `CorrectionEvent` into actions, policy rules, and approval gates. |
| `packages/eval-library` | Persisted archive of generated `EvalCase`s. |
| `packages/integrations/{gemini,linear,livekit}` | Adapters behind ports (stubs / fixture-fallback in this build). |
| `apps/api` | HTTP service exposing the governance loop as a stateless REST API. |
| `apps/desktop-demo` | Reference UI that renders the live engine output. |

> `policy-router`, `correction-pipeline`, and `eval-library` are standalone,
> independently-tested libraries; they are not yet wired into the main loop.

## Scope of this submission

- This repository is **the entire submission**, net-new for the hackathon. Its git
  history begins with this work.
- It has **no dependency on, and includes no code from, any prior or private Liminal
  repository.** Prior product surfaces informed vocabulary and design language only;
  none of them are part of this submission.
- Before sharing the link: confirm no secrets are committed and that this README and
  the running surfaces reflect the current build (see `SUBMISSION.md`).

## License

MIT — © 2026 Shruti Rajagopal and contributors. See [`LICENSE`](./LICENSE).
