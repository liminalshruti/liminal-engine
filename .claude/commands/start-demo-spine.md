Build the static clickable demo spine for the Liminal Engine governance hack.

Read `DEMO_CONTRACT.md` and `CLAUDE.md` first. Then:

1. Stand up `apps/desktop-demo/` with a runnable dev entry point.
2. Create one screen per step of the **required demo path** (in order):
   Initialize → Agent output → GovernanceCase → Approve + Enforce → AuditEvent →
   Blocked future action → Second pass improves → Eval Fail → Pass.
3. Wire click-through navigation across all screens (no real logic yet).
4. Back every screen with **deterministic fixtures** under `packages/` — no live
   Gemini / LiveKit / Linear calls on the spine.

Rules: do not redesign the product, do not invent a persona name (use generic
operator language), do not make a dashboard the hero. The status must visibly
flip **on-track → At Risk** on Approve + Enforce, and the eval table must show
**Fail → Pass**.

When done, update `SESSION_STATE.md` and append to `AGENT_HANDOFFS.md`.
