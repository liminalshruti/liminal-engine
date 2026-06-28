# Liminal Engine — Agentic Work Governance MVP

**Hackathon:** Liminal Engine Governance Hack 2026

## What this is

Liminal Engine is a governance layer for agentic work. When a company resources
AI agents to do real, high-stakes work, the agents can produce a **false green** —
output that *looks* done and on-track but silently drops a load-bearing
requirement. Liminal Engine observes agent output, detects the miss, enforces a
correction through workflow/action gates, records audit evidence, and proves the
next pass actually improved.

The core loop:

```text
observe → detect → correct → enforce → audit → improve
```

## What was built during the hackathon

- **This repo (`liminal-engine`) is the net-new 2026 hackathon build** — the
  Liminal Engine Agentic Work Governance MVP. Everything demoed as functionality
  was built here, during the hackathon.
- **Prior Liminal repos are reference / context only.** The pre-existing Liminal
  product surfaces (`liminal-prototype`, `liminal-desktop`, `liminal-govern`,
  `liminal-agents`, etc. in the workspace) inform *vocabulary, persona, and
  design language* but are not part of the submission.
- **Any code copied from prior repos must be explicitly marked** as prior work or
  adapted reference (a comment header `// ADAPTED FROM: <repo>/<path> — prior
  work, not built during hackathon`). If it isn't marked, assume it was built
  here.
- **The demo only highlights functionality built during the hackathon.** If a
  capability is borrowed or stubbed, it is labeled as such in `DEMO_CONTRACT.md`.
- **The submission scope is this repo** — `liminal-engine` — whose entire git
  history begins with the hackathon. It is a clean standalone repo split out of a
  private staging monorepo; no unrelated history is included.

## Demo scope

The demo proves one end-to-end story (the **Acme false-green** scenario). See
`DEMO_CONTRACT.md` for the locked path, must-not-cut list, and acceptance
criteria. The narrative target is **under 3 minutes**.

Required demo path:

```text
Initialize workspace
→ Agent output
→ GovernanceCase
→ Approve + Enforce
→ AuditEvent
→ Blocked future action
→ Second pass improves
→ Eval shows Fail → Pass
```

## What's real vs. simulated (read this, judges)

The governance **engine is real, computed, and tested** — not hardcoded screens:

- **The loop runs, and the UI renders *its* output.** `runGovernanceLoop` + `runEvals`
  execute detection, enforcement, the action gate, and the eval; all 7 screens read that
  live result (`useDemo()` → `buildGovernanceDemo()`), not hand-authored fixtures.
  **UI == engine is verified end-to-end** — an un-skipped e2e asserts the screen's case is
  the engine's live loop-detected case (18/18 e2e).
- **The audit trail is hash-chained** and reconstructable — tamper-evident, not a log row.
- **The action gate fails closed** — if evaluation throws, it denies; never silently passes.
- **It's deterministic** — a test runs the whole loop twice and asserts byte-identical
  artifacts, so the live demo can't flake on stage.
- **Boundary-enforced:** `apps/desktop-demo` *cannot* import a live integration on the
  spine (dependency-cruiser rule) — "no live calls on the demo spine" is enforced by the
  build, not by review.

**Simulated by deterministic fixtures, by design (hackathon scope):** Gemini, LiveKit,
and the live Linear API — behind ports, with real adapters quarantined at the composition
root so they swap in without touching the spine. No invented persona name; entity is not
yet incorporated (no `Liminal, Inc.`).

## Run instructions

> _Placeholder — fill in once `apps/desktop-demo` has a runnable entry point._

```bash
# TODO: install
# TODO: run dev server
# TODO: ./scripts/smoke.sh   # build/test + manual demo checklist
```

## Judging / demo notes

- Build the **static clickable demo first**; use **deterministic fixtures**
  before any real integration. See `CLAUDE.md`.
- Persona is **not** hardcoded by name — see the persona TODO in
  `DEMO_CONTRACT.md`. Refer to the demo user as *the operator* / *the VP Ops /
  Head of AI Transformation* / *the executive owner* / *the buyer persona* until
  extracted from `liminal-prototype`.
- `scripts/smoke.sh` prints the manual demo checklist judges/operators should be
  able to walk in under 3 minutes.

## Repo visibility — resolved

This is the **public open-source repo** for the hackathon:
`github.com/liminalshruti/liminal-engine` (MIT). It was split as a clean
standalone repo out of a private staging monorepo (`hackathons/`), so:

- [x] Public, MIT-licensed, net-new history beginning with the hackathon.
- [x] No unrelated sibling projects or prior history exposed (clean split).
- [ ] Before judges receive the link: confirm no secrets are committed and the
      README/demo reflect the final build.

See `SUBMISSION.md` for the full pre-submission checklist.
