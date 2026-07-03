# Pitch & Demo — Liminal Engine

> The R1 slot is **5 minutes**, you + Shayaun, judges in the room, **demo is the
> spine**. This doc gives you: (1) a 5-minute run-of-show that walks the real 14-beat
> demo, (2) the exact voiceover per beat, (3) the standalone video script, (4) the
> public-crowd variant, (5) the honesty + Q&A prep. Pain-first. Mapped to the rubric:
> **Technicality 40% · Creativity/Originality 25% · Live Demo 20% · Future / AI Impact 15%.**

> **The real demo:** open `http://localhost:5175/#demo`. It's a **left rail of 14
> numbered beats** across 6 phases (`observe → detect → correct → enforce → audit →
> improve`) and a stage that reads "Beat N / 14". You advance with **Next →**. The
> facts below are the LITERAL on-screen fixtures (`packages/contracts/src/fixtures/acme.ts`)
> — say them, don't paraphrase.

**Locked on-screen facts (use these exact words):**
- Goal: **"Close Acme expansion by Friday — $1.2M ARR"**
- Agents (Gemini) Pass 1: **"Acme $1.2M expansion on track; all workstreams green."**
- The dropped requirement: **EU data residency**
- GovernanceCase **gc_acme_eu**, severity **blocking**, impact **"$1.2M Acme expansion at risk"**, missing from **proposal · launch plan · owner assignment**
- Decider (a ROLE, never a name): **VP Ops / Head of AI Transformation**
- Status flip: **On Track → At Risk** · Required owners: **Product · Security · Engineering**
- Blocked action: **"Send customer-facing status update to Acme"** → **deny**
- Audit: **ae_acme_1**, action **correction-enforced** · Eval **ec_acme_eu**: **FAIL (pass 1) → PASS (pass 2)**

---

## 0 · The one sentence (memorize this — say it first, every time)

> **"Companies are about to manage teams of agents the way they manage teams of
> people. Liminal is the engine that answers the question that follows: is all this
> AI work actually moving the business goals we resourced it for?"**

Backup one-liner (more concrete): *"Liminal is the governance layer for agentic work
that gets smarter every time a human corrects it — it catches drift from the goal,
enforces the fix, and proves the next pass improved."*

---

# PART 1 — R1 run-of-show (5 minutes, demo is the spine)

**Shape:** 45s pain → 30s category → **3 min walk the 14 beats live** → 30s future →
15s close. Below: who says what, and the per-beat voiceover keyed to the rail.

### 0:00–0:45 — The pain (SHRUTI, no slides, just say it)
- "We now manage teams of agents the way we manage teams of people. A VP Ops gives GTM, Product, and Eng their own AI agents to move ONE goal — close the Acme expansion."
- "Spend is up. Output is up. Everything reads green."
- "Then the board asks: *is any of this actually moving the deal?* — and she can't answer. The context is scattered across the call, the proposal, the launch plan, the model logs."
- **Name it:** "That's *agentic work drift*. Not AI hallucination — **organizational hallucination**. The work loses the thread to the goal, and the green light lies."

### 0:45–1:15 — The category move (SHAYAUN)
- "So we built the governance layer for agentic work. One sentence: **Liminal governs agentic work against the business goal it was resourced for.**"
- "The move nobody else makes: a human correction doesn't become chat history — it becomes **enforceable operating state**. Status. Blocked actions. Owners. Evals. Audit."
- "Let me show you the loop on the Acme case." → switch to `#demo`.

### 1:15–4:15 — WALK THE 14 BEATS (live, this is the centerpiece, ~3 min)
Click **Next →** down the rail. Voiceover per beat — group the enforce beats so you keep pace:

| Beat | Phase | On screen | Say this |
|---|---|---|---|
| **1–2** | observe | Initialize · the Acme goal | "The goal we resourced the agents for: *close Acme by Friday — $1.2M ARR*." |
| **3** | observe | Agent output — the **false green** | "The agents — running on Gemini — report: *$1.2M expansion on track, all workstreams green*. This is the false green." |
| **4** | detect | Context tray — the dropped requirement | "But Liminal read across the call, the proposal, the launch plan — and the customer's *EU data residency* requirement was silently dropped. Load-bearing, gone." |
| **5** | detect | **GovernanceCase gc_acme_eu** | "It opens a governance case — severity *blocking* — and frames it the way a VP Ops cares: **$1.2M Acme expansion at risk**, missing from the proposal, the launch plan, and owner assignment." |
| **6** | correct | Enforcement panel — Approve + Enforce | "The operator — the VP Ops — corrects it once. One decision." |
| **7** | enforce | Status **On Track → At Risk** | "And the correction becomes operating state. The deal flips **On Track → At Risk** — automatically." |
| **8–9** | enforce | Remediation workstream + required owners | "A remediation workstream opens, and it *requires* Product, Security, and Engineering owners before it can move." |
| **10** | enforce | **Blocked** customer update | "And the false 'on-track' update to the customer? **Blocked** — denied until the requirement is honored. The green light can't lie anymore." |
| **11** | audit | **AuditEvent ae_acme_1** | "Every action is sealed in a tamper-evident audit record — the correction, and *who* decided it. Sensitive customer data is stored by reference, never raw." |
| **12–13** | improve | EvalCase + second pass | "Here's the part that makes it a system, not a checker: the correction becomes an **eval**. The agents re-run — and this time *they* catch the EU requirement themselves." |
| **14** | improve | Eval table **FAIL → PASS** | "**Fail on pass one. Pass on pass two.** The agents got better — because Liminal governed them. That's continual learning from a single human correction." |

**The kicker (switch to Workspace `/` for 10s):** "And this isn't a scripted path. Same
engine, cold-start, on a goal it's never seen — it runs the same governance on any
posted agent output."

### 4:15–4:45 — Future / why it's a company (SHRUTI)
- "As AI spend grows, every leader needs this: alignment-to-goal, policy, audit, and improvement-from-correction — a **control plane for agentic organizations**."
- "Real integrations are a port away. And the evals **compound** — every real correction makes the next pass smarter. The system gets more valuable the more it's used."

### 4:45–5:00 — Close
- Land the one sentence (§0). Stop. Don't add a feature list.

---

# PART 2 — Standalone demo video (record now, ~60–90s)

Same 14-beat walk as Part 1's middle, voiceover only, no presenter handoff. Use the
Part 1 beat table verbatim — just open cold on Beat 1 and narrate straight through to
Beat 14, then the kicker. End on: *"Liminal. Is your AI work actually moving the goal?
Now you can answer that."* This is your fallback if the live R1 run flakes.

---

# PART 2b — R1 talking-points reference (if you'd rather have slides than walk live)

> Only use this if the room wants slides. The live walk (Part 1) scores higher on Live
> Demo. Lead with PAIN, land the demo, close on future.

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

Same 5-minute spine and same 14-beat walk as R1, tuned for a room that can't ask questions:
- **Open louder** with the pain in a single beat: *"Your company is about to run on agents. Who's checking that their work moves the goal?"*
- **The demo is still the centerpiece** — but have the **Part 2 video** queued as fallback in case the live run flakes (it won't — it's deterministic, but have it).
- **Cut the honesty slide to one line** on a crowded stage; keep the detail for Q&A.
- **End on the category line** (§0), not a feature list. The thing they remember is *"is the AI work moving the goal?"* — own that sentence.

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
