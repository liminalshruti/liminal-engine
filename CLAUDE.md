<!-- ════════════════════════════════════════════════════════════════════════ -->
<!-- ⛔⛔⛔  NO DEMO FLOWS. BUILD A REAL PRODUCT.  ⛔⛔⛔                          -->
<!--                                                                          -->
<!-- READ `DIRECTIVE.md` FIRST. Scripted / guided / click-through "demo flows" -->
<!-- are FORBIDDEN and will NOT win. The output must be a REAL PRODUCT that    -->
<!-- does real work on real data — not a narrated, pre-arranged experience.    -->
<!-- This OVERRIDES any demo-path / "14-step" / DEMO_CONTRACT.md framing below. -->
<!-- The test: could a stranger use this on THEIR data with no narrator and no  -->
<!-- fixed sequence? If no → it's a demo flow → STOP and rebuild.               -->
<!-- ════════════════════════════════════════════════════════════════════════ -->

> # ⛔ NO DEMO FLOWS — BUILD A REAL PRODUCT — see [`DIRECTIVE.md`](./DIRECTIVE.md) ⛔

# CLAUDE.md — Liminal Engine — Agentic Work Governance MVP

> Hackathon: Liminal Engine Governance Hack 2026

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

## Subagent model tiers (set 2026-08-01)

The five agents in `.claude/agents/` each declare an explicit `model:`. **Do not remove it.**

| Agent | Model | Why |
|---|---|---|
| `architect-reviewer` | `opus` | Adversarial fidelity review against DEMO_CONTRACT / SCOPE_SPEC. Judgment work — the whole job is catching drift a cheaper model rationalizes past. |
| `night-captain` | `opus` | Orchestration: decides which issues are green, coordinates reviewers, owns the overnight queue. One bad call burns the night. |
| `implementer` | `opus` | Multi-file builds to full architecture-doc fidelity across the `packages/*` monorepo. |
| `integration-reviewer` | `sonnet` | Seam/contract validation — pattern-matching against a known contract, not open-ended judgment. |
| `test-specialist` | `sonnet` | Test generation against stated acceptance criteria. Structured, mechanical. |

**Why this is here at all.** `~/.claude/settings.json` sets
`CLAUDE_CODE_SUBAGENT_MODEL: "haiku"` globally. That default is *correct* for the common case —
most subagent work is search and fan-out, where cheap and parallel wins. But with no per-agent
override, it also silently applied to adversarial review and overnight orchestration, i.e. the two
places where weak judgment is most expensive. The global default stays; these five opt out.

This is Anthropic's own delegation guidance applied literally: route by the
accuracy/speed/cost tradeoff, cheap model for volume, capable model for judgment. Adding a
new agent here? Pick its tier deliberately and write the reason in this table.

**Verify, don't assume:** frontmatter silently no-ops if the key is misspelled. After changing a
tier, invoke the agent and confirm from the run metadata which model actually ran.
