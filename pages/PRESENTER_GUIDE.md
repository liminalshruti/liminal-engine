# Liminal Engine Pitch Deck — Presenter Guide

**Deck file:** `liminal-engine-pitch-deck.html`

**Total presentation time:** ~3 minutes (90s demo + 60s slides + Q&A)

---

## How to Use the Deck

1. **Open the deck:** Double-click `liminal-engine-pitch-deck.html` in your browser (or drag to browser). Works offline, no dependencies.
2. **Keyboard shortcuts:**
   - `→` (right arrow) or click "Next →" to advance slides
   - `←` (left arrow) or click "← Prev" to go back
   - `N` to toggle presenter notes (appears as a panel at bottom)
   - `B` to toggle backup demo video (see below)
   - `Esc` to dismiss backup video

3. **Presenter mode:** The notes panel (toggle with `N`) shows speaker notes, demo cues, and timing for each slide. Keeps you on track while judges see only the slide.

---

## The 6 Slides + Narration

### Slide 1: HOOK / PROBLEM (30 seconds)
**Content:** "The False Green" — $1.2M Acme expansion, agents report on-track while silently dropping EU data-residency requirement.

**Speaker Note:**
> AI agents now do real work, but they silently drop the requirements the work was resourced for. This is the false green — status says on-track while a load-bearing customer requirement is gone. We're about to see that happen on a $1.2M deal.

**No demo yet.** Let the problem land. When ready, press → to advance.

**Timing:** ~30 seconds

---

### Slide 2: WHAT LIMINAL IS (30 seconds)
**Content:** The governance loop. "Observe → Detect → Correct → Enforce → Audit → Improve."

**Speaker Note:**
> This is Liminal Engine — the governance layer. Closed-loop: observe the agent output, detect the drift, open a case, get human correction, enforce it, seal audit proof, and grade the next pass to prove it improved. That's not a dashboard — it's the machinery that runs every time an agent outputs something.

**Demo cue:** Next slide has the live demo. When ready, press → to hand off to live app.

**Timing:** ~30 seconds

---

### Slide 3: LIVE DEMO + BACKUP VIDEO (90 seconds)
**Content:** Loop progress spine (visual indicator). Demo stage placeholder + backup video slot.

**Speaker Note:**
> The demo is running live on the Acme expansion — $1.2M deal, EU data-residency requirement gets dropped, agents report green. You'll see Liminal catch it, open a case, flip the status to at-risk, block the false downstream update, seal the audit, and prove the second pass improves to Fail → Pass.

**Demo cue — RUN THE LIVE DEMO HERE:**
- Click to the live demo window (browser running desktop-demo app on localhost)
- Walk through the 14-step path in order:
  1. **Initialize workspace** — show "Close Acme expansion by Friday — $1.2M ARR"
  2. **Agent Activity** — "Acme expansion appears on track" (false green)
  3. **Context Tray** — reveal "EU data residency" requirement (lost)
  4. **Governance Case** — detection with evidence, severity blocking
  5. **Enforcement Panel** — operator clicks "Approve + Enforce"
  6. **Status flip** — "On Track → At Risk"
  7. **Simulated workstream** — Product / Security / Engineering owners required
  8. **Blocked action** — false "on track" customer update is blocked
  9. **Audit Trail** — correction + actor sealed in hash chain
  10. **Eval Case** — generated from correction
  11. **Second Pass** — agents re-run with requirement enforced
  12. **Eval table** — shows "Fail → Pass" between pass 1 and pass 2

- **Total demo time:** ~90 seconds deterministic (no live calls, all fixtures)
- **If live demo fails:** Press `B` to toggle the backup video (see "Backup Video Setup" below)
- When demo ends, click back to this deck and press → to slide 4.

**Timing:** ~90 seconds

---

### Slide 4: AND THERE'S MORE — INFERENCE PROXY (30s R1 / 15s R2)
**Content:** "We governed work quality. Now govern the spend." Three verdict cards: TRANSFORM (cost) · DENY (mission) · ALLOW (judgment). The Technicality "and there's more" beat.

**Speaker Note:**
> That was governing work quality. Same engine, second axis: the inference plane — Burp for LLM traffic. Every agent's model call routes through here. Calendar work asking for Opus? Auto-downgraded to Haiku — 25× cheaper. A crypto-bot request? Denied — off-mission. Enterprise SSO at Opus? Allowed — security work earns it. And the proxy proposes new routing policies from the traffic it sees; the operator ratifies. Corrections become policy. Spend governs itself.

**Demo cue — OPTIONAL live handoff:**
- alt+tab to the desktop-demo app → click the **"Inference proxy"** tab → show the intercepted Claude calls with their TRANSFORM / DENY / ALLOW verdicts live.
- If short on time, the slide alone carries it — the three verdict cards are the whole story.

**Honesty (if asked "is it real?"):** the policy engine, verdicts, and audit seal are REAL and run on the real `LlmRequest` contract. The intercepted traffic is seeded for a deterministic demo — point it at a live proxy endpoint and it governs real calls. The functionality exists; the traffic is the fixture.

**Timing:** ~30s (R1, do the live tab-switch + mention the contract/audit-seal) / ~15s (R2, stay on slide; hit Opus→Haiku + crypto DENY + "spend governs itself")

---

### Slide 5: WHY IT'S HARD / WHAT'S REAL (20 seconds)
**Content:** 2×4 grid. Real (built during hack) vs. Simulated (fixture). Honesty first.

**Speaker Note:**
> This is the honesty slide. Built during the hackathon: the full governance loop, hash-chained audit, Fail → Pass eval grading, policy + correction pipeline, live Gemini inference on arbitrary data, genuinely-live LiveKit. Simulated by fixture: Linear workstream panel and voice STT transcript. This stack is generic — it runs on any posted agent output, not just Acme.

**No demo handoff.** This slide answers: *"Is it real?"* Be proud of the honesty. Judges respect it.

**Timing:** ~20 seconds

---

### Slide 6: WHY NOW / CLOSE (15 seconds + Q&A)
**Content:** "Corrections are the moat." Why agent systems need this layer. One-line close.

**Speaker Note:**
> Corrections are the moat. Every agent system drifts. The teams that can catch it, enforce it, prove it improved win. That's what Liminal does — one control plane for any agent, any data. The system gets more useful the more it's corrected. Close on the spine: Liminal is the governance layer that catches drift, enforces the fix, and proves the next pass improved.

**Close line (read verbatim):**
> Liminal is the governance layer for agentic work that gets smarter every time a human corrects it — it catches drift from the goal, enforces the fix, and proves the next pass improved.

**Pause. Let it land. Then open to questions.**

**Timing:** ~15 seconds + Q&A

---

## R1 vs. R2 Delta (Room Size & Pacing)

### Round 1 (Small room, few judges, ~3 min + Q&A)
- **Slide 1:** More time (~45s). Let problem sink. Judges will interrupt with follow-ups.
- **Slide 2:** Slower. Describe the loop step-by-step. They'll ask deep questions about architecture.
- **Demo (Slide 3):** Full 90s. They want to see it work. Ready to pause and zoom into any screen.
- **Slide 4 (Inference Proxy):** ~30s. Do the live tab-switch to the proxy console; this is pure Technicality (40%) — name the LlmRequest contract + audit seal. Strong second-product signal.
- **Slide 5:** More time (~25s). Honesty slide; complements the proxy technicality rubric lives (40%). Lean on the grid. Be ready for Q: "But how do you know the audit is tamper-evident?" Have the audit ledger code ready on your laptop.
- **Slide 6:** ~15s + long Q&A. Founder narrative wins here. Be yourself.

**Strategy:** Go deep. Judges want to understand the arch. You have time.

### Round 2 (Stage, everyone, ~3 min + Q&A)
- **Slide 1:** Faster (~20s). Problem is visceral; trust it. Move on.
- **Slide 2:** Fast (~25s). Hit the loop, move.
- **Demo (Slide 3):** Same 90s. But keep pacing tight. No pauses in the walkthrough.
- **Slide 4 (Inference Proxy):** ~15s. Stay on the slide. Hit the Opus->Haiku downgrade + the crypto DENY, land "spend governs itself."
- **Slide 5:** Faster (~12s). Just touch the honesty: what's real, what's fixture. Judges know you built this stuff.
- **Slide 5:** Fast close (~10s) + Q&A. Stage presence > detail. Say the close line, pause, done.

**Strategy:** Move. The stage favors pace. Trust the demo to carry. Energy > depth.

---

## Backup Video Setup (Critical)

The deck includes a backup video slot on Slide 3. **If the live demo fails, press `B` to toggle it.**

### How to prepare the backup video:
1. **Record the demo locally:**
   ```bash
   # Run the full 14-step walkthrough on your machine
   pnpm --filter @liminal-engine/desktop-demo dev
   # (or use ./scripts/live-demo.sh for deterministic runner)
   # Record your screen with QuickTime / OBS / etc. for ~90 seconds
   ```

2. **Export as MP4 or WebM:**
   - Recommended: **MP4** (H.264, 1440p, 30fps, 10–20 MB)
   - Fallback: **WebM** (VP9, 1440p, 10–20 MB)

3. **Place the video file next to the HTML:**
   ```
   /pitch/
   ├── liminal-engine-pitch-deck.html
   ├── demo-backup.mp4  ← drop here
   └── demo-backup.webm ← optional fallback
   ```

4. **Test before presenting:**
   - Open the HTML in your browser.
   - Press `B` to toggle the video.
   - Verify it plays, has audio, no lag.

5. **On-stage fallback line (if video is missing):**
   > "The backup video isn't loaded, but the structure is here. Let me click back to the live demo window."

---

## Anticipated Judge Q&A (+ Crisp Answers)

### Q1: "Is this a demo flow or a real product?"
**Answer:**
> The engine is real — deterministic, tested, runs the full governance loop on arbitrary posted agent output. What you see in the demo is the real `buildGovernanceDemo()` function (Acme scenario) being fed through the real `runGovernanceLoop()`. To prove it's not a scripted walkthrough, here's how to run it on your own data: `./scripts/live-demo.sh your-payload.json` — same loop, any substrate.

### Q2: "What's the moat? Why can't someone just build this?"
**Answer:**
> The moat is the correction-to-eval-to-policy pipeline. Raw agent outputs are infinite; corrections are finite. Every time a human corrects an agent, that becomes a durable eval case + policy rule + approval gate. We have 3 things at scale that are hard:
> 1. The hash-chained audit ledger (tamper-evident, reconstructible, covers forensics + compliance)
> 2. The eval harness (Fail → Pass grading, persisted, auto-discoverable from corrections)
> 3. The policy engine (CorrectionEvent → PolicyRule/ApprovalGate, single control plane for any agent)
> The moat isn't the loop — it's that corrections compound into institutional knowledge.

### Q3: "How much of this is real vs. mocked?"
**Answer:**
> Built: governance loop, eval, audit ledger, policy/correction pipeline, substrate ingest, live Gemini, genuinely-live LiveKit (room create + browser mic). Simulated: Linear workstream panel (no live Linear write) and voice STT (operator-typed transcript, labeled). The architecture is generic, so real integrations swap in at the composition root. For the demo, we picked fixtures that guarantee deterministic 90-second walkthroughs.

### Q4: "Isn't this just a dashboard?"
**Answer:**
> No. A dashboard shows; Liminal governs. It opens cases, enforces corrections, blocks actions, seals audits, grades the next run. If you don't approve a correction, the bad action is blocked. If you approve it, it's sealed forever in an audit ledger + compiled into a policy rule for the next agent. That's not chrome — that's the control plane.

### Q5: "Why now? Don't teams already have QA / monitoring?"
**Answer:**
> QA is human-in-the-loop and slow. Monitoring is reactive — it tells you something failed, not what to correct. Liminal is proactive + automated: AI agents already run fast; the slowest part is getting human judgment back into the system. We make that feedback a durable artifact — an eval case + policy rule. The next agent pass runs faster because the correction is already in force. Scale 10 agents to 100 → you need a platform that turns corrections into policies, not a team reviewing each case.

---

## On-Stage Logistics

### Before Presenting:
- [ ] Test the HTML opens in your browser (Chrome, Safari, Firefox all work)
- [ ] Verify backup video is in the same folder as the HTML
- [ ] Have the live desktop-demo app running on localhost (or `./scripts/live-demo.sh` ready)
- [ ] Test keyboard shortcuts: `→`, `←`, `N`, `B`
- [ ] Have a second monitor / confidence monitor if possible (shows notes + slide number)

### During Presenting:
- **Slide 1:** Hold for 30s. Build tension.
- **Slide 2:** Describe the loop. Make it clear this is *governance*, not monitoring.
- **Slide 3:** Click to live demo. Walk through the 14-step path. Narrate as you go. If the app freezes, press `B` for backup video or restart the browser.
- **Slide 4:** Call out the honesty. "We built X, we simulated Y, here's why."
- **Slide 5:** Close on the spine line. Pause. Then questions.

### If Live Demo Fails:
1. Press `B` to toggle backup video.
2. If video is missing, say: *"The backup video isn't loaded. Let me click back to the live app and refresh."*
3. If app won't start, alt+tab to terminal, restart `pnpm --filter @liminal-engine/desktop-demo dev`, then come back to the deck and try again.
4. Worst case: Step through the screenshots on Slide 4 to describe what the demo would show.

---

## Design System Notes

The deck uses the **Liminal Engine canonical design tokens** (`govern-slate.css`):
- **Dark substrate:** `--bg: #0A0A0B`, `--frame-bg: #0E0E11`
- **Primary brand:** Clarity violet `#8E66FB` (clarity-500)
- **Secondary brand:** Wholeness pink `#E90095` (wholeness-500)
- **Accent:** Vitality orange `#FF9549` (vitality-500)
- **Alarm:** Stability red `#ED214F` (alarm-500)
- **Success:** Connection green `#31E682` (connection-500)
- **Signal/live:** Signal lime `#70F32F` (signal-500)

The deck is a **separate, self-contained file** (no external CDN). It works offline and matches the product's visual register perfectly.

---

## File Paths & Drop-In Instructions

### Main deck file:
```
/pitch/liminal-engine-pitch-deck.html
```
Open in any modern browser. Works fullscreen (press F11).

### Backup video:
```
/pitch/demo-backup.mp4  (or .webm)
```
- **Recommended format:** MP4, H.264, 1440×900, 30fps, 10–20 MB
- **Max length:** ~90 seconds (same as live demo)
- **Audio:** Yes, codec AAC
- **Drop-in:** Save the file next to the HTML. The deck auto-detects it. If missing, shows placeholder.

### Desktop demo app (live):
- **Dev server:** `pnpm --filter @liminal-engine/desktop-demo dev` → http://localhost:5173
- **Production build:** `pnpm --filter @liminal-engine/desktop-demo build && pnpm --filter @liminal-engine/desktop-demo preview`

### Live demo runner script (for backup):
- **Path:** `./scripts/live-demo.sh`
- **Usage:** `./scripts/live-demo.sh` (uses Acme fixture by default) or `./scripts/live-demo.sh your-payload.json` (arbitrary data)

---

## Slide Timing Summary

| Slide | Content | Duration | Notes |
|-------|---------|----------|-------|
| 1 | Hook / Problem | 20–45s | R1: slower. R2: faster. |
| 2 | What Liminal Is | 25–30s | Loop narration. |
| 3 | Live Demo | 90s | Full 14-step walk. Backup video fallback. |
| 4 | What's Real | 15–30s | Honesty grid. Real vs. fixture. |
| 5 | Why Now / Close | 10–15s + Q&A | Spine close line + questions. |
| **Total slides** | — | **~60s** | Not counting demo. |
| **Total with demo** | — | **~150s (2.5 min)** | + Q&A. |

---

## Success Metrics

- ✓ All 5 slides render on load
- ✓ Arrow keys and "Next/Prev" buttons navigate smoothly
- ✓ Notes panel toggles with `N`
- ✓ Backup video placeholder shows (or actual video if file exists)
- ✓ Demo runs live in ~90 seconds (14-step path end-to-end)
- ✓ Judges grasp the core thesis in <5s per slide
- ✓ Close line lands hard: *"...catches drift, enforces the fix, proves the next pass improved."*

---

## Questions?

If the HTML doesn't open, check:
1. File is not corrupted: `file liminal-engine-pitch-deck.html` should say "HTML document, ASCII text"
2. Browser has JavaScript enabled
3. You're opening it as a file (file://) not http://

If the backup video doesn't load:
1. File is next to the HTML
2. Format is MP4 or WebM
3. Browser can play it (test in a new tab)
4. If stuck, you can describe the demo verbally or use the grid on Slide 4 as reference.

Good luck. Nail the demo. Close on the spine line. Questions should be easy after that.
