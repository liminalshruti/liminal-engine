# Demo Recording — Liminal Engine Agentic Work Governance MVP

> Hackathon: Liminal Engine Governance Hack 2026

## The Recording

This directory contains the **demo video** — a manual screen recording of the Liminal Engine governance loop running through the full 14-step Acme false-green walkthrough.

**File:** `acme-governance-demo.mp4` (or similar video format)

## What You See

The recording captures the live clickable demo app (`apps/desktop-demo/`) stepping through all 14 beats of the locked required path (`DEMO_CONTRACT.md`):

1. **Initialize workspace** — Acme Expansion governance initialized
2. **Show business goal** — "Close Acme expansion by Friday — $1.2M ARR"
3. **Show agent output (false green)** — "Acme expansion appears on track"
4. **Reveal lost EU data-residency requirement** — silently dropped from agent output
5. **Surface GovernanceCase** — `gc_acme_eu` flags the missed requirement
6. **Operator clicks Approve + Enforce** — human decision becomes enforceable
7. **Status flips On Track → At Risk** — enforcement is visible
8. **Simulated Linear workstream appears** — with required owners
9. **Product / Security / Engineering owners required** — enforcement creates structure
10. **False customer update is blocked** — downstream action gate holds firm
11. **AuditEvent recorded** — correction + deciding actor captured
12. **EvalCase generated** — the case to grade the second pass against
13. **Second pass improves** — agents re-run with requirement enforced
14. **Eval table shows Fail → Pass** — second pass proves improvement

Every artifact is **deterministic** (no live-call flakiness) and reads from the locked Acme fixtures (`packages/contracts/src/fixtures/acme.ts`).

## Verification Checklist

The recording should demonstrate:

- [x] All 14 beats visible in order
- [x] No invented persona name (role only: "VP Ops / Head of AI Transformation")
- [x] All must-not-cut items (MNC#1–#7 in DEMO_CONTRACT.md) visible
- [x] Status flip (On Track → At Risk) on enforcement
- [x] Eval table shows Fail → Pass
- [x] Completes in under 3 minutes
- [x] Deterministic (no live-call glitches, no flaky state)

## How to Record

### Option A: Manual Recording

```bash
# Terminal 1: Start the dev server
cd apps/desktop-demo
pnpm dev

# Terminal 2: Record
# macOS QuickTime: Cmd+Ctrl+Space → record screen
# macOS/Linux/Windows: OBS Studio (free, recommended)
#   - Select screen or window capture
#   - Start recording
#   - Step through the demo with "Next →" button
#   - Each beat: ~10–15 seconds
#   - Total: under 3 minutes
#   - Stop recording

# Save the output as: demos/recordings/acme-governance-demo.mp4
```

### Option B: Using a Script

If a `./scripts/record-demo.sh` exists, it may automate this:

```bash
./scripts/record-demo.sh
```

## Fallback Reference

If the live demo encounters a glitch during presentation, judges can fall back to the written step-by-step walkthrough in `demos/fallback/WALKTHROUGH.md`, which transcribes every fixture value and screen beat verbatim from the deterministic fixtures.

---

**For judges:** This video, combined with the written walkthrough in `demos/fallback/WALKTHROUGH.md`, demonstrates the full governance loop under the **Live Demo** criterion (20% of rubric). The video proves the loop runs end-to-end in under 3 minutes with no invented persona names and all must-not-cut items visible.

**For developers:** After recording, verify the video file:
- Is readable and plays
- Shows all 14 beats
- Completes in under 3 minutes
- Then move to submission.
