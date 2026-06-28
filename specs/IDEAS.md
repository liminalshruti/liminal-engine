# IDEAS.md — harvested from the 12 downloaded specs

Mined from all 12 downloaded implementation-spec PDFs (4 parallel readers, 3 specs
each, then deduped). Only **net-new / sharpening** ideas vs the repo's current
`SPEC.md` + `DEMO_CONTRACT.md` are listed; already-known ideas are omitted.

**Consensus** = roughly how many of the 12 specs converged on it — high consensus
is the strongest signal an idea is right. **Lands in** = the `specs/TASKS.md` task
(or contract) that should absorb it. Tiers: **ADOPT** (fold into the MVP build) ·
**STRETCH** (post-spine) · **FUTURE** (beyond the hackathon).

---

## ADOPT — fold into the MVP build

### Detection
- **Deterministic hard-checks first; LLM only as an optional secondary grader returning strict JSON.** Consensus: 12/12. → `gov-detect`. Removes the demo's #1 reliability risk.
- **Detector taxonomy menu** beyond lost-context: `missing_required_anchor`, `hard_constraint_violation`, `unsupported_claim` (confidence w/o evidence), `scope_expansion`, `output_schema_violation`, **`completion_gate`** (blocks "mark done" while a check is unresolved), **`conflict_with_prior_correction`**. Consensus: high. → `gov-detect`.
- **`conflict_with_prior_correction` = the regression detector** — a future run that violates an already-active rule emits a `GovernanceCase` directly (no separate `DriftSignal` entity needed for MVP). Consensus: 4 specs. → `gov-detect`/`gov-proxy`. This is what proves "future behavior is gated."
- **Explicit case-open threshold rule** (open if any hard-fail OR judge confidence ≥0.70 OR ≥2 medium signals OR manual flag). Consensus: high. → `gov-detect`. Turns "detect drift" into one testable decision.
- **Detectors emit structured evidence (line/field/span refs), never booleans.** → `gov-detect`. Makes the case reviewable + UI legible.
- **Good-output → no case** (false-positive control); cases are dismissable. → `gov-detect` + tests.

### Correction → enforcement compiler (the anti-vagueness keystone)
- **Constrained correction templates: reviewer picks one+ enforcement templates + fills structured args; free text is stored, enforcement compiles ONLY from the schema.** Consensus: 12/12 — called "the key anti-vagueness measure." → **new task `gov-correct`** + `CorrectionEvent` contract.
- **Pure-function compiler with a deterministic phrase→action mapping table** ("always include X"→require_fields; "never do X"→forbid_patterns/deny_tool; "ask before Y"→require_approval; "match this shape"→output_schema). → `gov-correct`. No LLM in the critical path; trivially golden-testable.
- **Reject vague/empty corrections with an actionable error; persist the human text for provenance.** → `gov-correct`.
- **Preview compiled rules before activate; "no correction is complete until ≥1 active EnforcementAction exists."** → `gov-correct` + `gov-enforce`.
- **Split compound corrections into atomic rules** (one scope · one stage · one action each). → `gov-correct`.
- **Correction templates compile ONTO the canonical `EnforcementAction.actionType` enum defined in `SPEC.md`** (`change_status`/`create_linear_workstream`/`assign_owner`/`block_agent_action`/`require_approval`/`generate_eval`/`activate_policy`/`record_audit_event`) — a fixed enum with per-action typed payloads, **explicitly NO policy DSL**. Consensus: 12/12. → `gov-correct` uses the enum the `contracts` task owns (do not introduce a competing vocabulary).

### Enforcement
- **Fail-CLOSED on gate error** — if evaluation throws, deny/hold; never silently bypass. Consensus: high. → `gov-enforce`/`gov-proxy`.
- **Verdict is the single source of truth — never persist an `allowed` boolean; derive it. Add an invariant/property test proving no contradictory state.** Consensus: strong (one spec made it a merge-blocking rule). → `gov-proxy` + tests. Kills the fail-open desync bug class.
- **Three intervention points: pre-run · pre-tool · pre-completion**, each action stamped with its `stage`. MVP = pre-completion + the proxy on the future action; pre-tool is STRETCH. → `gov-enforce`/`gov-proxy`.
- **Bounded retry = exactly one**, with failure reasons injected as a **structured ENFORCEMENT CHECKLIST block** (don't rewrite the prompt stack); never silently accept on exhaustion. → `gov-secondpass`.
- **GateDecision carries `reason_codes` referencing the triggering rule IDs** (explainable blocks). → `gov-proxy`.
- **"Effective policy bundle":** load active rules scoped to the goal/run, compose into one bundle, attach to the run; fail closed if malformed. → `gov-enforce`.

### Eval
- **EvalCase assertions are a DIRECT translation of the active enforcement config** — the rule IS the test, no authoring UX. Consensus: 12/12. → `eval`.
- **A failing eval/replay REOPENS the GovernanceCase.** Consensus: high. → `eval` + state machine. Closes the regression loop.
- **Record two distinct success outcomes: "improved output" vs "safely blocked"** — both are wins but different claims; don't conflate. → `eval`.
- **Objective "materially improved" definition:** fewer hard-constraint violations + higher goal-match + non-decreasing evidence coverage + the relevant eval now passes + no blocked-action bypass. → `eval`.
- **Idempotent eval generation per case** (re-saving a correction doesn't spawn duplicate evals). → `eval`.

### Audit / data
- **Hash-chained audit: `event_hash = sha256(prev_hash + canonical_json(payload))`**, append-only, emitted by ONE service in the same transaction as the state change; a verifier usable in tests AND the demo UI ("chain valid ✓"). Consensus: 12/12. → **new task `audit-ledger`** + extend `AuditEvent` contract (reuses the repo's existing canonical hash).
- **Referential-integrity invariants** (no case w/o a signal; no EnforcementAction w/o an approved correction; no EvalCase w/o a case; every second pass links to its original run; every gate emits an AuditEvent). → tests across tasks.
- **Reconstructability invariant:** a case's full lifecycle is rebuildable from AuditEvents alone. → `audit-ledger` test.
- **Named event-type vocabulary** (goal.created … gate.evaluated … eval.generated … case.closed) as an enum to assert against. → `audit-ledger`.
- **Data-boundary/redaction:** store references/hashes/redacted snapshots, never raw secrets (directly serves the EU-data-residency angle). → ADOPT-lite note in `contracts`/fixtures; deeper path is STRETCH.

### Domain model (contracts to add/extend)
- **Add contracts:** `CorrectionEvent`, `LinearWorkstreamPayload` (both already in SPEC). (`DriftSignal` is **STRETCH**, not MVP — for the MVP the regression detector emits a `GovernanceCase` directly; see STRETCH below. `OperatingConstraint`/`PolicyRule` optional.) → `contracts`.
- **Extend `GovernanceCase`** (`businessImpact`, `missingFrom[]`, `evidenceIds[]`, `recommendedActions[]`, status lifecycle); **`EnforcementAction`** (the fixed `actionType` enum + `targetSystem`/`payload`, `scope`, `status`, versioning); **`AuditEvent`** (`beforeState`/`afterState`, `evidenceIds`/`actionIds`/`evalIds`, `affectedSystems`, `prevHash`); **`ActionGate`** (`reasons[]`, `requiredBeforeSend[]`, derive `allowed`). → `contracts`. (Matches the SPEC.md mapping table exactly.)
- **Structured goal in fixtures:** `successCriteria[]`, `hardConstraints[]`, `requiredAnchors[]`, `requiredEvidenceType`, `outputSchema` — what makes deterministic detection possible. → fixtures/`contracts`.
- **AgentRun lineage** (`parentRunId`, `runKind` = first_pass|second_pass|replay) + `resolvedContext` snapshot. → fixtures (AgentOutput already carries pass number).

### State machine
- **Case lifecycle with explicit reject/dismiss exits + reopened-on-regression.** → all tasks touching case status.
- **EnforcementAction versioning** draft→active→superseded→disabled; never mutate a past payload. → `contracts`.
- **Closed-case completeness invariant:** a case can close only with ≥1 enforcement-activation AuditEvent + ≥1 EvalCase + (a second-pass run OR an explicit blocked outcome). → tests.
- **Invalid transitions are blocked and unit-tested at the service layer.** → tests.

### Demo / UX (these score Live-Demo + Creativity points)
- **Clickable-first with stubbed state** — a judge can click the whole story before the backend exists. → `spine-shell`/screens.
- **Case-detail single hub layout:** title/severity/status · first-pass output with **inline-highlighted violations** · detector findings · correction form · compiled-enforcement preview · audit timeline · rerun + before/after compare · eval. → `screen-governance-case`.
- **Context-card affordances:** source type · live-stream vs pinned · **evidence badge** · "cited in case/audit?" indicator. → `screen-context-tray`.
- **Explicit blocked-action card (3 parts): not allowed / why blocked / what's required before it's allowed.** → `screen-enforcement-panel` + `components`.
- **Compiled-enforcement PREVIEW widget** — the reviewer approves the rule, not just the text. → `screen-enforcement-panel`.
- **Second-pass causal narration** ("failure → rule activated → second pass gated → eval passed") + before/after **checks table**. → `screen-second-pass-eval`.
- **Agent Activity trace cards** showing which artifacts each agent used + an explicit "missing requirement" evidence line. → `screen-agent-activity`.
- **Generic persona role copy only**; demo-reset route + idempotent seed. → `persona` + `spine-shell`.

### Testing
- **Golden/snapshot tests of the exact demo artifacts** (GovernanceCase / EnforcementActions / Linear payload / AuditEvent / EvalResult JSON). → each task.
- **Audit-reconstruction test** (rebuild a case from events only); **good-output negative test** (compliant output → no case); **determinism test** (run the demo twice → identical); **schema round-trip / no-drift test**; **demo-path test asserting concrete counts** (1 case, N actions, 1 deny on pass 2, 1 eval). → `e2e` + per-task.

### Process (scope / sequencing / risk)
- **Tiered, ordered cut-lines** (never-cut / cut-first / cut-second / never-add) + the **"control plane vs. a better answer"** litmus. → already in `SPEC.md`; adopt the ordered degradation list.
- **Per-task allowed/forbidden file fence — "if a needed file isn't listed, stop and ask."** → `TASKS.md` / issue template.
- **Phase stop-conditions**, fixture-freeze-first, UI-last. → `TASKS.md`.
- **Two anti-fragility defaults: fail-closed + deterministic-first.** → `SPEC.md`.

---

## STRETCH (post-spine, if the loop is solid)
**`DriftSignal` as a separate entity** (type/severity/score/evidence/`detector_version`,
many→one case, `dominantSignalType` on the case) · pre-tool interception · scope
inheritance across `goalClass` · rule `expiresAt` · `PolicyRule`/`ApprovalGate` as
entities · full data-boundary/redaction path · model-graded eval behind a
deterministic fallback · `GoalStatusSnapshot` · structured-goal fixture fields
(`successCriteria`/`hardConstraints`/`requiredAnchors`) · CLI review fallback ·
structured telemetry namespace.

## FUTURE (beyond the hackathon)
`ResourceAllocation` / governance-ROI numbers · OpenTelemetry KPI set · an eval
**library** compounding from real corrections · agent-identity/owner attribution ·
NIST AI RMF / goal-drift + correction-compilation research citations for the pitch.

---

## What this changes in `specs/TASKS.md`
- **New Wave-2 task `gov-correct`** — `CorrectionEvent` + the pure-function correction compiler (template vocab + phrase→action table). Owns `packages/governance/src/compile-correction.ts` (+test).
- **New Wave-2 task `audit-ledger`** — hash-chained append-only audit service + reconstruction test. Owns `packages/governance/src/audit-ledger.ts` (+test).
- **`contracts` task extended** — add `CorrectionEvent` (+ `LinearWorkstreamPayload`); extend `EnforcementAction` / `AuditEvent` / `GovernanceCase` / `ActionGate` per the SPEC.md table. (`DriftSignal` is STRETCH.)
- **Screen tasks** gain the specific UX affordances listed under Demo/UX.
- **Cross-cutting tests** (audit-reconstruction, determinism, good-output-negative, schema round-trip) attach to `e2e` + the owning task.

> Everything here still serves the LOCKED `DEMO_CONTRACT.md` scenario. These are
> mechanisms to build it *better*, not new scope. When in doubt, the cut-lines win.
