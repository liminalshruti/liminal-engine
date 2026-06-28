# Convergence North Star — the minimum winning REAL PRODUCT

> **Reconciled to [`DIRECTIVE.md`](../DIRECTIVE.md) (2026-06-28).** DIRECTIVE.md is the
> top authority: **no demo flows — build a real product on real, arbitrary data with
> live integrations.** This doc is the scope counterweight to the build loops: it
> guards against bloat and theme-blur, but it no longer treats the guided "demo
> flow / N-beat path" as the spine. The demo flow is **reference only** — it must
> never *gate* or *prevent* real end-to-end integration.

## The build spec in one sentence (the product)
A real Liminal Engine an operator points at **their own** goal, agent traces, and
work artifacts — on demand, with no script — where a lost-context risk is detected
live, a human correction becomes an eval/policy/ontology update, and the next agent
pass proves improvement. **It must work cold, on arbitrary inputs, with no narrator.**

## THE TEST (DIRECTIVE.md — apply before shipping anything)
> "Could a stranger point this at **their own** data and do **real work** — with **no
> narrator and no fixed sequence**?"
> **No** → it's a demo flow → STOP and rebuild. **Yes** → it's a product → ship.

## The 30-second explainability test (clarity guard — still applies)
The product must be explainable in 30 seconds using ONLY these 8 nouns:
**goal · stream · substrate · agent run · lost context · correction · eval · second pass.**
If explaining it needs "ontology graph", "12 agents", "proxy router", "model
governance", or "RBAC" in the first 30 seconds → it has drifted. Those are supporting,
never the headline.

## The capabilities the product must really do (NOT a fixed sequence)
These are real capabilities exercisable on arbitrary data, in any order — **not**
"beats" to click through:
- Initialize a workspace around a real business goal.
- Ingest/pin real streams as substrate.
- Run (or observe) a real agent run that reaches a wrong/incomplete conclusion.
- **Surface the lost-context business risk live** (real detection, not a scripted reveal).
- Accept a human correction → produce a real `CorrectionEvent`.
- Generate a real `EvalCase`; re-run; show the second pass improved (before/after).
- Enforce policy live via the loopback proxy intercepting **real** agent actions.

> ⚠️ Reconciliation note: the prior "9 locked demo beats / locked 14-beat path"
> framing is **demoted to reference**. Do NOT make a fixed beat sequence the product,
> and do NOT block a PR for "weakening the 14-beat e2e" — per DIRECTIVE.md the spine
> e2e is reference, not a gate. (The CI spine-guard is now non-blocking.)

## The 4 judge-visible artifacts (must stay legible — these are real outputs)
Trace · CorrectionEvent · EvalCase · Before/After Eval Result. Real, produced from
real work — not pre-arranged.

## Theme (do not blur it)
Primary: **Self-Improvement Stack.** Secondary: Continual Learning. NOT raw Recursive
Intelligence (we govern agent systems, we don't update model weights).

## HARD CUTS — drift if these appear as demo-critical (flag for removal/de-emphasis)
full 12-agent system · real enterprise RBAC · real Salesforce/Gong/Asana ·
full Notion/Granola replacement · full graph database · full browser drag-drop
computer-use · generalized model router · production deploy control plane ·
long-term learning daemon · all substrate types · all buyer personas.
These are roadmap, not MVP. They may exist as *quiet supporting* surfaces, but must
NOT become the headline or the 30-sec pitch.

## Convergence signals to watch (drift detectors — directive-aligned)
- **A "happy path" / guided single-route experience reappears** → it's a demo flow →
  flag for removal (DIRECTIVE.md). This replaces the old "screen count > 7" detector.
- **The product can't run on arbitrary/new data** (only one hardcoded subject works)
  → flag: it's choreography, not a product.
- **A live integration is blocked by a fixtures-only / demo-spine gate** → flag: the
  gate is preventing real end-to-end integration; loosen it.
- **A queued PR makes a HARD-CUT item demo-critical** → flag.
- **A queued PR adds a noun** the 30-sec pitch would need → flag (scope creep).
- **The 4 artifacts get less legible** (buried under new chrome) → flag.
- **Two PRs build the same thing** → flag for dedup.

## What the convergence loop DOES (safe posture — unchanged)
- Read-only scoring each pass. Flags drift as a written report + Linear notes.
- May open a *removal/de-emphasis* PR for clearly off-product additions — but NEVER
  merges, NEVER deletes another session's work directly.
- Output: a convergence report ranking what to KEEP (real product), what to DEMOTE
  (supporting), and what to CUT (hard-cut drift / re-appeared demo flow). Feeds the
  merge decision so the founder merges a crisp REAL PRODUCT, not a bloated demo.
