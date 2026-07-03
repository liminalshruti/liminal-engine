# Overnight Session Goal (2026-06-28, ~7h autonomous)

## The bar: a SUBMISSION-GRADE DESKTOP DEMO

Morning success = the Liminal Engine demo **feels like a real, polished desktop
application — not a hackathon demo** — with the engine breadth (ontology +
policy/router) queued, so that after the morning merge pass it reads as a
**product**.

**Quality-weighted, not PR-count-weighted.** Judged on UI/UX cohesion + native
desktop feel, not "how many PRs got opened."

## What "submission-grade desktop demo" concretely means

1. **Native desktop feel** — the 14-beat walkthrough feels like an app, not a web
   page: real app-shell chrome, considered motion/transitions between beats,
   focus/keyboard polish, depth (elevation/shadow/layering per the design tokens),
   loading/empty states that feel intentional.
2. **Cohesion across all 7 screens** — one consistent visual language, rhythm, and
   information hierarchy; nothing reads as a stub or a different author. The
   design-system tokens (the 12-wheel canon, Nineties Headliner + Geist Mono) are
   used with depth, not just applied.
3. **The governance story lands visually** — false green → detection → enforcement
   → audit → Fail→Pass reads as a dramatic, legible arc; "reads as governance, not
   alerting" (DEMO_CONTRACT fail-mode) is visibly true.
4. **Engine breadth queued** — ontology graph view + policy/router surfaces exist as
   reviewed PRs, supporting (not stealing) the spine.

## Priority order for the 7h (serves THIS goal)

1. **UI/UX polish + cohesion (the hero)** — weight the most effort here.
2. **Ontology + policy/router surfaces** — supporting engine breadth.
3. **Doc/spec features** — only those that are *visible in the demo*; pure-backend
   breadth is lower priority for a demo-grade bar.

## Non-negotiables (unchanged)

- Build in isolated worktrees → open PRs → adversarial review + re-cert → **QUEUE
  ready-to-merge. NEVER auto-merge.** The certified spine (`3266c35`, 137/137) stays
  frozen; nothing merges unattended.
- Skip + log when blocked (no faking — Rule 6). Real Gemini/LiveKit need API keys →
  logged, not stubbed-as-real.
- The morning handoff must **judge the queued work against this bar** — not just list
  PRs, but answer: "after merging these, does it feel like a submission-grade desktop
  product? where are the cohesion gaps?"

## Status anchors
- Certified spine: `3266c35` (137 tests, 0 skips, 0 boundary violations).
- CI hardened: PR #60 (typecheck:app + app build + spine-guard) — queued.
- Overnight buildout workflow: `wf_8be1c06e-dfa`.
