# AGENT_HANDOFFS.md

Append a block after **every** session. Newest at top. The next session reads
this first.

---

## Session: development control harness (2026-06-27)

**Did:**
- Pulled `origin/main` (the public-repo-setup + demo-contract-alignment commits)
  and reconciled with a control harness built on the prior base (fast-forward; my
  new files preserved, hygiene notes re-applied).
- Layered a spec-to-task-to-PR **control harness** (additive; DEMO_CONTRACT/CLAUDE
  locks untouched). Materialized the pnpm/TS workspace.
- **Reconciled contracts to the updated 14-step / 7-must-not-cut demo contract:**
  `packages/contracts` now models AgentOutput, GovernanceCase, **EnforcementAction**,
  AuditEvent, ActionGate, **EvalCase**, EvalResult (zod + canonical-hash golden
  tests). Acme fixtures assert every must-not-cut item (incl. Linear required
  owners + business goal).
- Hexagonal package members; integrations are fixture stubs. Enforceable gates:
  boundary lint (`spine-no-live-integrations`), CI, lefthook hooks, PR template,
  matrix + linear-id checks. Added `AGENTS.md` + nested AGENTS.md + 5 agent roles;
  filled `ops/linear/AGENT_PACKETS.md` + `ISSUES.md`.
- **Verified green:** 43 tests, typecheck, boundary lint; gates proven to reject
  violations (spine→integration import; contract drift). Not pushed.

**Decided:** commits = allsmog only, never Claude/AI (hooks enforce); overnight = PR-only.

**Did NOT do (by design):** no app/UI (the demo spine — needs a UI-stack decision);
no live Gemini/LiveKit/Linear; did not push (awaiting your go).

**Next session should:**
1. Decide demo-app UI stack; build the static clickable spine on the Acme fixtures.
2. Implement governance use cases + eval harness per the packets.
3. Auth Linear MCP; file `ops/linear/ISSUES.md` as real `LIM-` issues under LIM-1199.

**Risks / watch:** persona name must NOT be invented (persona issue is yellow); keep the spine
deterministic; `pnpm install` pins local `core.hooksPath` so lefthook doesn't
clobber the global attribution hook — keep that in `prepare`.

---

## Session: standalone public repo setup

**Did:**
- Split the scaffold out of the private parent `hackathons/` monorepo into a
  clean standalone repo (`rsync --exclude .git`), fresh `git init` so history
  begins with the hackathon.
- Renamed all references to the canonical repo name **`liminal-engine`** (kept
  the "Liminal Engine — Agentic Work Governance MVP" hackathon framing and the
  "what was built during the hackathon" README section).
- Created the **public** repo `github.com/liminalshruti/liminal-engine` (MIT) and
  pushed `main`.
- Invited **`allsmog`** (Sean) as a collaborator with **push** access (pending
  acceptance).
- Verified: MIT copyright is `Shruti Rajagopal and contributors`; no
  `Liminal, Inc.` ownership claim remains; entity stated as not yet incorporated.

**Decided / confirmed:**
- Canonical public repo name is `liminal-engine` (NOT the long folder name).
- Private parent `hackathons/` repo is **staging only** — never pushed.

**Did NOT do (by design):**
- No app implementation. No real Gemini/LiveKit/Linear.

**Next session should:**
- Build the static clickable demo spine in `apps/desktop-demo/` (see
  `.claude/commands/start-demo-spine.md`), backed by deterministic fixtures.
- Extract persona from `liminal-prototype` (resolve the persona TODO).

**Risks / watch:**
- `allsmog` invite still pending Sean's acceptance.
- Persona name must NOT be invented.

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
