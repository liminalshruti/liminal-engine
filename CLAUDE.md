# CLAUDE.md — Liminal Engine Governance Hack 2026

Instructions for future Claude Code sessions working in this folder. Read this
**and** `DEMO_CONTRACT.md` before writing any code.

## Entity / legal status rule

The Liminal entity is not yet incorporated.

Do not write `Liminal, Inc.` anywhere in this repo unless the user explicitly updates this rule after incorporation.

Use `Shruti Rajagopal and contributors` for MIT copyright unless instructed otherwise.

## Hard rules — do not violate

- **Do not redesign the product.** The product is locked: a governance layer that
  runs `observe → detect → correct → enforce → audit → improve`. Build that loop;
  don't reimagine it.
- **Do not invent a persona name.** Use *the operator* / *the VP Ops / Head of AI
  Transformation* / *the executive owner* / *the buyer persona* until a name is
  extracted from `liminal-prototype` (see persona TODO in `DEMO_CONTRACT.md`).
- **Do not make a dashboard the hero.** The hero is the **governance loop on the
  Acme case**, not a metrics dashboard. A dashboard, if any, is supporting chrome.
- **Preserve the required demo path** in `DEMO_CONTRACT.md` exactly. The
  implementation serves the contract.

## Build order

1. **Build the static clickable demo first.** Get the full required demo path
   click-through working with hardcoded screens before any logic.
2. **Use deterministic fixtures before integrations.** All agent output,
   GovernanceCases, AuditEvents, and eval results come from fixtures first. No
   live calls on the demo spine.
3. Only after the clickable spine is solid, consider wiring real integrations —
   and only the ones on the *cut-if-risky* list if there's time. Real Gemini /
   LiveKit / Linear are explicitly **not** required for the demo to succeed.

## Scope boundary (hackathon rule)

- This folder is the **net-new hackathon build**. Prior Liminal repos are
  reference/context only.
- If you copy code from a prior repo, mark it:
  `// ADAPTED FROM: <repo>/<path> — prior work, not built during hackathon`.
- The demo only highlights functionality built here.

## Session hygiene

- **Update `AGENT_HANDOFFS.md` after each session** — what you did, what's next,
  what's risky. The next session reads it first.
- Keep `SESSION_STATE.md` current (where things stand right now).
- Log scenario/contract/scope changes in `CHANGELOG.md`.
- Version control is **this standalone repo** (`liminal-engine`,
  `github.com/liminalshruti/liminal-engine`). A private staging copy also lives in
  the `hackathons/` monorepo, but the public repo is the source of truth for the
  submission.

## Where things live

- Product contract & acceptance: `DEMO_CONTRACT.md`
- Scope / what's in vs out: `SCOPE_SPEC.md`
- Handoff for next session: `HACK_HANDOFF.md`, `AGENT_HANDOFFS.md`
- Demo app: `apps/desktop-demo/`
- Domain logic: `packages/engine-core`, `packages/governance`, `packages/eval-harness`
- Integrations (stubbed first): `packages/integrations/{linear,gemini,livekit}`
- Smoke test + checklist: `scripts/smoke.sh`
- IP provenance: `IP_RECEIPT.md`
- Linear ops: `ops/linear/`
