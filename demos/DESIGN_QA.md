# DESIGN_QA.md — Liminal Engine — prize-winning quality bar

> Read [`DIRECTIVE.md`](../DIRECTIVE.md) first. This is the bar the design-cleanup
> loop measures against. It encodes the NO-DEMO-FLOWS product test + govern-slate
> fidelity + a11y + robustness. A surface ships only when every applicable box is checked.

## 0. The gate (DIRECTIVE.md) — non-negotiable
- [ ] A stranger can point this surface at THEIR own data and do real work — no narrator, no fixed sequence. (No → it's a demo flow → rebuild.)
- [ ] Operates on arbitrary inputs (any ticket / agent action / LLM call / stream), not one staged subject.
- [ ] Useful cold — open it with whatever real data is present and it works.
- [ ] No "happy path" the user is led down; no sequenced reveals / "Beat N of M".
- [ ] Real integrations live where applicable (DO inference, Linear, loopback proxy), with a deterministic fallback for offline.

## 1. Govern-slate fidelity
- [ ] Styling is tokens-only (`design-tokens.css`); zero hardcoded colors/sizes; no Tailwind.
- [ ] Type ramp, spacing, radii, elevation, motion all from tokens.
- [ ] Governance-state colors (on-track / at-risk / blocked / forwarded / held) consistent + semantic.
- [ ] Matches the liminal-prototype govern-slate register (specimen parity).

## 2. Frontend-design quality (distinctive, not generic-AI)
- [ ] Has a point of view — not a default component-library look.
- [ ] No generic-AI tells: uniform equal-box card grids, emoji-as-icons, purple-gradient hero, centered-everything, lorem rhythm.
- [ ] Deliberate hierarchy, density, and a clear focal point per surface.
- [ ] Real data shapes (long strings, empty sets, large lists) look intentional, not broken.

## 3. Accessibility (WCAG AA)
- [ ] Full keyboard operation; visible focus; logical tab order.
- [ ] Correct headings/landmarks; ARIA live regions for verdicts, status flips, assistant replies.
- [ ] Contrast AA on text and on every state color.
- [ ] `prefers-reduced-motion` fully degrades (no essential info conveyed by motion alone).
- [ ] A screen reader can follow the governance loop progression.

## 4. States & robustness
- [ ] Empty, loading (skeleton), and error states for every async surface — non-janky.
- [ ] Null-safe with missing/partial data; no crashes on unexpected real input.
- [ ] Responsive laptop → projector; presenter density legible from the back of a room.

## 5. Determinism (so visual goldens don't flake)
- [ ] Renders deterministically under fixed clock/idGen + reduced-motion + fixed fonts.
- [ ] No `Date.now()` / `Math.random()` in render paths.

## 6. Real operating surfaces (the product, per DIRECTIVE) — apply §0–5 to each
- [ ] Operator console / NL command bar — drive corrections & queries on real data.
- [ ] Intercept queue — approve/disapprove real held actions / LLM calls.
- [ ] Request stream — live forwarded / transformed / held / blocked traffic with provenance + spend.
- [ ] Policy library — learned rules, provenance, rule-health, escalation decay.
- [ ] Audit explorer — hash-chained ledger, verify-chain, lifecycle reconstruction.

> The governance loop (observe→detect→correct→enforce→audit→improve) must be VISIBLE
> as real behavior in these surfaces operating on real data — not narrated as a fixed walkthrough.
