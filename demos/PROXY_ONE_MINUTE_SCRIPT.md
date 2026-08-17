# 1-minute demo script — Inference proxy (the loop on every Claude call)

> Hackathon: Liminal Engine Governance Hack 2026
> **Hero: the Inference proxy (`#proxy`).** It runs the same governance loop —
> `observe → detect → enforce → audit → improve` — on the fleet's outbound Claude
> calls instead of on the Acme deal. Every value below is read verbatim from the
> seed fixtures in `apps/desktop-demo/src/lib/proxy-surface.ts`, so it's
> deterministic — if the live app glitches, read the lines and the numbers still hold.

## Setup (before you present)

1. `pnpm --filter desktop-demo dev`
2. Open the app and click **Inference proxy** in the top nav (URL ends in `#proxy`).
3. Confirm the header reads **7 Claude calls intercepted · 3 gated · 0 sealed**.
   Leave the first row (Calendar & scheduling) selected. You're ready.

---

## The minute — 6 moves, ~150 words

Each move: **[what you click]** → *the line you say*. Loop phase in **bold**.

### 0:00 — Cold open (no click)
> "Our company runs a fleet of AI agents, and every one of them calls Claude.
> Liminal sits in front of that traffic — **Burp for LLM calls**."

### 0:08 — **Observe** — gesture at the header
> "Seven calls intercepted right now, each judged against one thing: the company
> mission — *secure enterprise infrastructure*. Three are already gated."

### 0:18 — **Detect + Enforce** — click the **Crypto trading bot** row
> "An engineer pointed the fleet at a personal crypto trading bot. Off-mission —
> **denied** before it ever reached Claude."
>
> *(Gate verdict card shows `deny` · "Off-mission — not in company objectives".)*

### 0:28 — **Enforce** — click the **Calendar & scheduling · Claude Opus 4.8** row
> "This one asked *Opus* to format a meeting invite. Policy says Haiku is enough —
> auto-downgraded, **Opus → Haiku**, same result, a fraction of the cost."
>
> *(Routing line shows `Claude Opus 4.8 → Claude Haiku 4.5`, verdict `transform`.)*

### 0:38 — **Audit** — click **Seal verdict to ledger**
> "Every verdict seals into a tamper-evident audit ledger — who, what, which model,
> hashed and chained."
>
> *(Header counter ticks: `…· 1 sealed to the audit ledger`.)*

### 0:46 — **Improve** — point at the **Developer docs** proposal, then click **Ratify & activate**
> "And it learns. It caught two Opus calls doing nothing but formatting docs and
> proposes routing Developer docs to Haiku — **96% cheaper**. I ratify it…"
> *(click)* "…and it's live policy. The loop closed itself."

### 0:56 — Close
> "Observe, detect, enforce, audit, improve — the whole governance loop, on every
> model call your agents make."

---

## Loop coverage (say the phase names — judges are listening for them)

| Phase    | On screen                                                        |
|----------|-----------------------------------------------------------------|
| Observe  | 7 Claude calls intercepted, scored against the company mission  |
| Detect   | Crypto-bot call flagged **off-mission**; Opus-on-calendar flagged overkill |
| Enforce  | Off-mission call **denied**; Opus **transformed → Haiku** by policy |
| Audit    | Verdict **sealed** to the tamper-evident AuditLedger            |
| Improve  | Self-learning loop proposes Developer docs → Haiku (**96% cheaper**); operator **ratifies** |

## Numbers/labels to get exactly right
- **7** intercepted · **3** gated (crypto `deny`, calendar `transform`, billing `transform`).
- Crypto trading bot → **deny / off-mission**.
- Calendar & scheduling → **transform**, `Claude Opus 4.8 → Claude Haiku 4.5`.
- Developer docs proposal → **~96% cheaper**, "Ratify & activate".
- Deciding actor in the ledger is the role **Inference policy engine** — never an
  invented persona name (persona rule, `DEMO_CONTRACT.md`).

## If you have 15 seconds of slack
Click the **Enterprise SSO · Opus** row first: verdict `allow`. One line —
*"Security-critical SSO work? Opus, allowed, no question — this isn't blunt
cost-cutting, it's policy-aware."* Then continue. Cut this first if you're long.

## Optional bridge to the Acme case (only if asked "does this scale past LLM calls?")
> "Same loop governs business outcomes too — it caught a $1.2M Acme deal showing
> false-green while EU data residency was silently dropped." Then jump to `#demo`
> for the locked 14-beat walkthrough (`demos/fallback/WALKTHROUGH.md`).
