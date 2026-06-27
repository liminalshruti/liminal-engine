# AGENT_HANDOFFS.md

Append a block after **every** session. Newest at top. The next session reads
this first.

---

## Session: scaffold / setup (this session)

**Did:**
- Inspected parent `hackathons/` repo state; confirmed it's a git repo on `main`
  with remote `github.com/liminalshruti/hackathons` (private). Pulled fresh main
  (fast-forward).
- Created the full project scaffold + all tracking docs.
- Added `.claude/` dev environment (settings + 3 slash commands).
- Added `scripts/smoke.sh` (executable) with build/test + manual checklist.
- Added **MIT LICENSE** (Shruti Rajagopal and contributors — entity not yet
  incorporated; individuals hold copyright).
- Locked the demo contract (Acme false-green) and scope.

**Decided:**
- Publish as a **standalone PUBLIC MIT repo** (not by flipping the private
  multi-project parent public).

**Did NOT do (by design — setup only):**
- No app implementation, no real Gemini/LiveKit/Linear, no nested git repo,
  no old-code copying.

**Next session should:**
1. Build the static clickable demo spine in `apps/desktop-demo/`.
2. Author deterministic fixtures under `packages/`.
3. Extract persona from `liminal-prototype` (resolve the persona TODO).

**Risks / watch:**
- Persona name must NOT be invented.
- Standalone public repo + commit-timestamp net-new boundary must hold.
- `fable-build-day-2026-06-13/` is an unrelated untracked nested git repo in the
  parent — do not touch it.
