# Pitch & Demo — Liminal Engine

> Everything to record the 1-min video and present R1 (private, judges) + R2/public
> (crowd). **The deck is centered on the demo.** Pain-first user pitch, mapped to the
> judging rubric: **Technicality 40% · Creativity/Originality 25% · Live Demo 20% ·
> Future Potential / AI Impact 15%.**

---

## 0 · The one sentence (memorize this — say it first, every time)

> **"Companies are about to manage teams of agents the way they manage teams of
> people. Liminal is the engine that answers the question that follows: is all this
> AI work actually moving the business goals we resourced it for?"**

Backup one-liner (more concrete): *"Liminal is the governance layer for agentic work
that gets smarter every time a human corrects it — it catches drift from the goal,
enforces the fix, and proves the next pass improved."*

---

# PART 1 — The 1-minute demo video script (record now)

**Setup:** screen-record the desktop app (`pnpm --filter @liminal-engine/desktop-demo dev`)
or the live runner (`./scripts/live-demo.sh`). Voiceover, tight. ~10 cuts, ~5s each.
**Tone:** the product is *running on real data*. Never say "let me walk you through a demo."

| t | On screen | Voiceover (say this) |
|---|---|---|
| 0:00 | Goal card: "$1.2M Acme expansion" + AI budget/spend | "A company resourced an AI agent team to close a $1.2M enterprise pilot." |
| 0:06 | Agents report "on track", green | "The agents are busy. They report it's on track." |
| 0:13 | Liminal ruptures the green | "But Liminal reads across the work and sees what they missed: the customer's call said *EU data residency is a hard requirement* — and it never made it into the proposal, the scope, or the launch plan." |
| 0:22 | GovernanceCase opens, **AI-spend risk** | "It opens a governance case — and frames it the way a VP Ops cares about: **$18,400 of AI spend produced work, but the goal isn't moving** because a gating requirement was dropped." |
| 0:32 | Operator clicks Approve + Enforce | "The operator corrects it once." |
| 0:38 | Status flips on-track → at-risk; downstream blocked | "That correction becomes operating state: the deal flips **on-track → at-risk**, and the false 'on-track' customer update is **blocked** until it's fixed." |
| 0:46 | Audit receipt sealed | "Every action is sealed in a tamper-evident audit receipt — who decided, what changed." |
| 0:52 | Correction → EvalCase → second pass Fail→Pass | "And the correction becomes an **eval**. The agents re-run — and this time they catch it. **Fail → Pass.** They got better because Liminal governed them." |
| 0:58 | Logo / one-liner | "Liminal. Is your AI work actually moving the goal? Now you can answer that." |

**The close line (if you have 2 more seconds):** *"And it runs on any posted agent
output — not a scripted demo. `live-demo.sh your-data.json` proves it on data we've
never seen."*

---

# PART 2 — R1 presentation (private, you + Shayaun, judges in the room)

> ~5 minutes talking, demo is the spine. Goal: judge can re-explain the category in
> one sentence after you leave. Lead with PAIN, land the demo, close on future.

### Slide 1 — The pain (the hook, ~45s)
**Title:** *"We now manage teams of agents the way we manage teams of people."*
- A VP Ops gave GTM/Product/Eng **AI agent teams** to move one goal: convert enterprise pilots.
- Spend is up. Output is up. Velocity *feels* higher.
- The board asks: *"Is any of this actually moving conversion?"* — and she **can't answer**, because the context is scattered across Gong, Salesforce, Slack, Notion, Linear, GitHub, model logs.
- **Name the pain:** *agentic work drift* — humans and agents produce lots of work, but the work loses the thread to the business goal. It's not AI hallucination. It's **organizational hallucination.**

### Slide 2 — The category move (Creativity 25%)
**Title:** *"The question isn't 'can agents do work?' It's 'is the AI work moving the goal?'"*
- Old frame: agent observability / productivity automation.
- Liminal's move: **human correction becomes enforceable operating state** — status, blocked actions, workstreams, gates, evals, audit — not chat history.
- One sentence a judge can repeat: *"Liminal governs agentic work against the business goal it was resourced for."*

### Slide 3 — THE DEMO (Live Demo 20% + Technicality 40%) — *this is the centerpiece*
Run the 1-min flow live (Part 1), narrating the **loop**: `observe → detect → correct → enforce → audit → improve`. Hit these out loud as artifacts appear:
- **detect** — lost EU-residency requirement, across artifacts (not one doc).
- **the wow** — the case states the **AI-spend-vs-goal** risk ("$X spent, goal not moved").
- **enforce** — on-track→at-risk + the blocked downstream action (real operating state).
- **audit** — tamper-evident receipt.
- **improve** — correction → EvalCase → second pass **Fail→Pass**. *Continual learning, shown not told.*
- **The kicker:** "This isn't a scripted path — `live-demo.sh` runs the same engine on data we've never seen."

### Slide 4 — What's real (the honesty slide — judges reward this)
**Built during the hack, real:** governance loop, eval Fail→Pass, policy + correction pipeline, intercept/proxy gateway, API server, **substrate ingest (runs on arbitrary streams)**, **live Gemini inference (cache-backed)**, **genuinely-live LiveKit** room + mic, **goal-alignment / AI-spend model**.
**Simulated by design (deterministic fixtures):** the Linear workstream panel; voice STT (operator-entered transcript, labeled in the UI).
**Honest framing if asked "is this a demo flow?":** *"No — the same engine governs any posted agent output."*

### Slide 5 — Future / why this is a company (Future 15%)
**Title:** *"A control plane for agentic organizations."*
- As AI spend grows, every leader needs: alignment-to-goal, policy governance, audit, and improvement-from-correction.
- The loop generalizes; real integrations are a port away; **evals compound into a library** from real corrections — the system gets more valuable with use.
- Close on the one sentence (Slide 0).

---

# PART 3 — Public presentation (R2, crowd)

Same spine as R1, tuned for a room that can't ask questions:
- **Open louder** with the pain in a single beat: *"Your company is about to run on agents. Who's checking that their work moves the goal?"*
- **The demo is still the centerpiece** — but pre-recorded fallback (Part 1 video) ready in case the live run flakes (it won't — it's deterministic, but have it).
- **Cut Slide 4 (honesty) to one line** on a crowded stage; keep it for Q&A.
- **End on the category line**, not a feature list. The thing they remember is *"is the AI work moving the goal?"* — own that sentence.

---

## Rubric → where each piece scores (so nothing is left on the table)
| Criterion | % | Where it lands |
|---|---|---|
| **Technicality** | 40 | Slide 3 demo: the full `observe→detect→correct→enforce→audit→improve` loop with real artifacts (governance, evals, proxy, substrate, live Gemini) |
| **Creativity / Originality** | 25 | Slide 2: the category move — correction → enforceable state; "is AI work moving the goal" reframe |
| **Live Demo** | 20 | Slide 3: <3-min before/after arc; deterministic so it can't flake; video fallback |
| **Future / AI Impact** | 15 | Slide 5: control plane for agentic orgs; evals compound; spend-governance as AI budgets grow |

## Pain-first narrative spine (the through-line for all three)
> agents produce work → the company loses the thread to the goal → Liminal catches the
> drift, enforces the correction, proves the next pass improved → **so leaders can finally
> answer: is our AI work moving the business?**
