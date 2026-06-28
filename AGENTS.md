<!-- ════════════════════════════════════════════════════════════════════════ -->
<!-- ⛔⛔⛔  NO DEMO FLOWS. BUILD A REAL PRODUCT.  ⛔⛔⛔                          -->
<!-- READ `DIRECTIVE.md` FIRST. No scripted / guided / single-scenario          -->
<!-- click-through "demo flows" — they will NOT win. Build a real product that   -->
<!-- operates on arbitrary real data, continuously, with no narrator. This       -->
<!-- overrides any demo-path / 14-step / DEMO_CONTRACT.md framing.               -->
<!-- ════════════════════════════════════════════════════════════════════════ -->

> # ⛔ NO DEMO FLOWS — BUILD A REAL PRODUCT — see [`DIRECTIVE.md`](./DIRECTIVE.md) ⛔

# AGENTS.md — Liminal Engine development control system

This adds the **development-loop enforcement** on top of the product locks. It
does not override them. Precedence: **`DEMO_CONTRACT.md` (acceptance) → `CLAUDE.md`
(product rules) → `SCOPE_SPEC.md` (scope) → this file (how agents build)**. Read
those first; this governs the build process.

Prose is advisory; the enforceable layer is what counts — contracts (golden hash
tests), boundary lint, CI gates, hooks, and adversarial reviewer agents. Build to
**full fidelity** with `DEMO_CONTRACT.md`, never a plausible shortcut. Overnight
work is **PR-only — never merge.**

## Hard Rules (non-negotiable)
1. **Git attribution is the user's only.** Commits authored AND committed as
   `allsmog <snejad123@gmail.com>`. Never `Co-Authored-By: Claude …`, `🤖 Generated
   with Claude Code`, or any AI/Anthropic mention. (Hook strips it; don't write it.)
   The MIT `LICENSE` copyright stays "Shruti Rajagopal and contributors"; no
   "Liminal, Inc." until incorporation (CLAUDE.md).
2. **Never weaken verification to pass.** No deleting/skipping tests, loosening
   assertions, `any`, swallowed errors, hardcoded expected values.
3. **Never destroy work/data unattended** (already denied in `.claude/settings.json`).
4. **Overnight agents are PR-only.** Open PRs; never auto-merge, never mark Linear Done.
5. **Honor the product locks:** don't redesign the `observe→detect→correct→enforce→
   audit→improve` loop; **fixtures before integrations — no live calls on the demo
   spine**; **never invent a persona name** (use a role); don't make a dashboard the
   hero; preserve the required demo path. Mark adapted prior-repo code
   `// ADAPTED FROM: <repo>/<path> — prior work`.
6. **Real logic, never a mock of it.** Build the actual functionality. Never ship a
   mocked/stubbed/faked implementation of required behavior, a hardcoded or canned
   value standing in for real computation, or output rigged to the expected result
   to fake a pass — `engine-core`/`governance`/`eval-harness` must genuinely compute
   their results. **Real tools, real AI too:** when the system uses an LLM or an
   external service, it makes a *real* call through a real adapter
   (`packages/integrations/*`) — never a fake/simulated-in-code stand-in that returns
   canned data while pretending to hit the model/API. This does **not** touch the
   demo **fixtures**: the declared Acme scenario data + golden vectors are required
   demo *input* (Rule 5), and the spine may still *select* fixtures over a real
   adapter at the `apps/` composition root for live-demo determinism — what's banned
   is faking the *code* itself (the logic OR the adapter). Can't build it for real?
   Mark the issue **Formally Blocked** with evidence — a mock is never "done".

## Required reading before coding
`DEMO_CONTRACT.md` → `CLAUDE.md` → `SCOPE_SPEC.md` → the linked Linear issue +
`ops/linear/*` → the nearest package `AGENTS.md` → existing patterns/tests.

## Architecture (mechanically enforced — `.dependency-cruiser.cjs`)
Monorepo, hexagonal: `contracts` (shared kernel) ← `engine-core` (pure domain) ←
`governance` (application/use cases over ports) ← `ui-components`/`apps` ; live
adapters in `packages/integrations/*` are wired ONLY at the apps/ composition root.
- Domain is pure (no node core, no npm SDKs). Cross-package coupling only through
  `@liminal-engine/contracts`. Changing a contract → `pnpm regen:goldens` + update
  consumers (golden test gates it — no silent drift). UI calls governance, not
  engine-core internals. **Spine cannot import live integrations** (the fixtures rule).

## No-skip / full-scope (anti-laziness)
Claim ONE issue → lock on it until **Complete** or **Formally Blocked** (with
evidence). Partial ≠ done. No silent scope reduction, no stub/fake/TODO for
required behavior (Rule 6 — real logic + real tools/AI, never a mock), no
fake/simulated adapters, no truncated edits. Build every layer the feature needs. Full
detail: `.claude/agents/implementer.md`; overnight model + roles below.

## Parallel agents — one git worktree per issue
Agents run concurrently, so they CANNOT share one working tree. The moment you
claim an issue, create your own isolated worktree:
`pnpm wt:new <LINEAR-ID> short-desc` → branch `agent/<LINEAR-ID>-short-desc` in a
dedicated checkout (own `node_modules` + `.env`). Work only there; never in the repo
root, on `main`, or in another agent's worktree. One worktree per claimed issue
mirrors the `agent-claimed` mutex. `pnpm wt:rm <LINEAR-ID>` after the PR merges.
Full mechanics (and the hooks fix that keeps the attribution strip firing inside
worktrees): `WORKTREES.md`.

## Definition of Done (ALL must hold)
- [ ] Every linked acceptance criterion (and the relevant `DEMO_CONTRACT.md`
      must-not-cut items) implemented AND verified with evidence.
- [ ] Required behavior is **real** — real logic + real tool/AI calls through real
      adapters; no mock/stub/fake adapter, hardcoded value, or output rigged to the
      expected result (Rule 6). Fixtures stay the demo *input*, not a fake of the code.
- [ ] `pnpm verify` (typecheck + test + boundary lint) green; `./scripts/smoke.sh`
      run for demo-path work.
- [ ] Goldens regenerated if a contract changed; fixtures still valid.
- [ ] Demo spine stays deterministic (no live calls); no invented persona name.
- [ ] PR conformance + acceptance matrices filled (CI fails on empty matrix);
      branch/PR carry the Linear ID; commit attributed to allsmog.
- [ ] `/handoff` run (AGENT_HANDOFFS.md / SESSION_STATE.md / CHANGELOG.md updated).

## Commands
```bash
pnpm verify          # typecheck + test + lint:boundaries
pnpm test            # node --test, incl. contract golden + fixture tests
pnpm lint:boundaries # hexagonal / fixtures-on-spine enforcement
pnpm regen:goldens   # only after a deliberate contract change
./scripts/smoke.sh   # build/test + manual demo checklist
```

## Agents & roles (`.claude/agents/`)
`night-captain` (preflight/queue/anti-stall) · `implementer` (build one issue
fully, no-skip) · `architect-reviewer` + `integration-reviewer` (adversarial,
reject partial/drift, verify the demo path) · `test-specialist`. Overnight: the
captain releases only fully-specified issues; workers lock + checkpoint; reviewers
gate every PR; you merge in the morning.

## Ports into liminal
The `contracts/` canonical hash mirrors `liminal-agents-v1/lib/substrate/packet-hash.ts`,
so `AuditEvent` etc. are reproducible receipts that port into the substrate.
