# BUILD_PLAN.md — Agentic Work Drift (the real product)

> Governed by [`DIRECTIVE.md`](./DIRECTIVE.md): build a REAL PRODUCT on real,
> arbitrary data with live integrations — not a demo flow. This plan maps the
> product thesis to concrete repo work, grounded in `main` (state below). The build
> loops execute against THIS.

## The product in one sentence
A real operating surface where an operator points Liminal at **their own** goal,
agent traces, and work artifacts — on demand, no script — and Liminal detects when
**agentic work has drifted from the business goal it was resourced for**, turns a
human correction into a durable eval/policy/ontology update, and proves the next
agent pass improved.

## The buyer question (the wedge)
**"Is our AI spend and agent usage actually advancing the goals we resourced these
teams to achieve — or just generating more disconnected work?"**

## The differentiated pain — *agentic work drift*
Not toy hallucination. **Business-context loss**: a customer's gating requirement is
captured in a call, but never propagates into the proposal, product scope, or launch
plan — so the agent team looks productive while the deal quietly goes at-risk.
The 8 nouns (north star): goal · stream · substrate · agent run · lost context ·
correction · eval · second pass.

---

## What's ALREADY on `main` (212d601) — the machinery is substantial
| Capability | Package | Status |
|---|---|---|
| Governance loop (detect→correct→enforce→audit→improve) | `governance`, `engine-core` | ✅ done |
| Eval Fail→Pass + persisted archive | `eval-harness`, `eval-library` | ✅ done |
| Policy engine | `policy-router` | ✅ done |
| Correction pipeline (CorrectionEvent→PolicyRule/ApprovalGate) | `correction-pipeline` | ✅ done |
| Loopback proxy / intercepted-action | `proxy-gate.ts`, `intercepted-action.contract.ts` | ✅ primitive done |
| API server | `apps/api` | ✅ done |
| LiveKit (voice correction) | `integrations/livekit` | ✅ live-wired |

The "learn from correction → prove improvement" half is **built**. The gaps are all
on the **real-input side** and the **goal/spend framing side**.

---

## THE 4 GAPS (what stands between machinery and product)

### Gap 1 — Live inference & live reads (Gemini + Linear are FIXTURE STUBS)
`integrations/gemini` and `integrations/linear` return deterministic fixtures
("no live inference"). The product needs real DO/Gemini inference and real Linear
reads. (LiveKit is already live.)
**Build:** real Gemini client (live inference, env-keyed, fixture fallback) + real
Linear client (read tickets/streams). → issue **«live-gemini»**, **«live-linear»**

### Gap 2 — Substrate / streams ingest (THE foundational gap) ⭐
There is **no substrate package, no streams ingest, no arbitrary-data layer.** The
loop only runs on the hardcoded `acmeScenario` fixture — i.e. a demo flow. Without
ingest, the product can't run cold on a stranger's own data (fails DIRECTIVE.md's test).
**Build:** a `packages/substrate` — ingest arbitrary streams (transcript / doc /
ticket / agent-trace) behind a `StreamSource` port, pin as permissioned context, and
make `runGovernanceLoop` read substrate instead of `acmeScenario`.
→ issue **«substrate-ingest»** — **START HERE.**

### Gap 3 — Operating surface (app is 7 demo screens, not a workspace)
`apps/desktop-demo` is the fixed `Initialize→…→SecondPassEval` beat flow. No tray to
drag in live streams, no arbitrary-goal workspace, no cold-start. It IS the demo flow
the directive demotes.
**Build:** a real workspace surface — create a goal, drag/pin streams into a tray,
see surfaced drift cases over whatever data is loaded (no fixed sequence).
→ issue **«operating-surface»**

### Gap 4 — Goal / AI-spend / alignment model (the executive wedge)
The wedge ("is AI spend moving the goal?") isn't modeled. `GovernanceCase` exists,
but there's no `Goal`/OKR entity, no agent-team/spend tracking, no goal↔work
alignment score.
**Build:** `Goal` + `AgentTeam`/spend contracts + an alignment score the drift case
surfaces ("AI spend producing output, not advancing the goal").
→ issue **«goal-alignment-model»**

---

## Build sequence (dependency order)
1. **Gap 2 «substrate-ingest»** — foundational; converts demo→product. *(starting now)*
2. **Gap 1 «live-gemini» / «live-linear»** — live inference + reads over the substrate.
3. **Gap 4 «goal-alignment-model»** — the executive framing on top of real data.
4. **Gap 3 «operating-surface»** — workspace + tray over all the above; retire the beat flow.

## The directive test (apply to every gap before shipping)
> "Could a stranger point this at **their own** data and do **real work** — with **no
> narrator and no fixed sequence**?" No → it's still a demo flow → keep building.
