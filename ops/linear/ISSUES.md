# Linear — Issue drafts (thin wrappers)

Ready-to-file overnight issues. Each is a THIN wrapper pointing at
`DEMO_CONTRACT.md` + a packet (`AGENT_PACKETS.md`) — architecture detail lives in
the docs, not here. File these in Linear (or auto-create once the Linear MCP is
authed); label as noted.

**Workspace prefix is `LIM-`.** The umbrella issue is **LIM-1199** ("[HITL] Demo
Harness Lock Before Overnight Agents"). The sub-issue numbers below are
**placeholders — assign the real `LIM-` IDs on creation**, then name branches
`chore/lim-<id>-<slug>` and lead PR titles with the ID (the `linear-id` CI gate
matches `LIM-<n>` in the branch or title).

Labels: `nightly` `agent-ready-green` (safe unattended) · `agent-ready-yellow`
(needs a human decision first). See `../../AGENTS.md` + the harness label taxonomy.

---

### LIM-«spine» — Static clickable demo spine  ·  P0  ·  `nightly` `agent-ready-yellow`
- Parent: LIM-1199. Packet: demo-app-spine. Owns `apps/desktop-demo/**`.
- Goal: full 14-step required demo path click-through rendering Acme fixtures, in order.
- Acceptance: DEMO_CONTRACT required path + must-not-cut #1/#5 visible; < 3 min.
- **Yellow:** needs the UI-stack decision (Solid to match liminal-desktop / React / Vite-vanilla) — human call before unattended build.

### LIM-«gov» — Governance use cases (detect → enforce → audit → gate)  ·  P0  ·  `nightly` `agent-ready-green`
- Parent: LIM-1199. Packet: governance-use-cases. Owns `packages/governance/src/**`.
- Goal: implement the loop over ports; `enforceCorrection` flips on-track→at-risk + emits EnforcementAction & AuditEvent; block a downstream action.
- Acceptance: must-not-cut #2/#3/#5/#6; tests per criterion; fixtures-backed.

### LIM-«eval» — Eval harness Fail → Pass  ·  P0  ·  `nightly` `agent-ready-green`
- Parent: LIM-1199. Packet: eval-harness. Owns `packages/eval-harness/src/**`.
- Goal: generate the EvalCase + `runEvals` rendering Fail (pass 1) → Pass (pass 2) on the EU-residency criterion.
- Acceptance: must-not-cut #7; deterministic from fixtures.

### LIM-«linear» — Simulated Linear workstream panel  ·  P1  ·  `nightly` `agent-ready-green`
- Parent: LIM-1199. Packet: linear-panel-adapter. Owns `packages/integrations/linear/src/**`.
- Goal: flesh out the simulated panel (requires Product/Security/Engineering owners) behind `LinearWorkstreamPanel` (no live API).
- Acceptance: must-not-cut #4; deterministic.

### LIM-«persona» — Extract persona from liminal-prototype  ·  P1  ·  `nightly` `agent-ready-yellow`
- Parent: LIM-1199. Packet: persona-extraction.
- Goal: extract persona/ICP language; replace generic copy.
- **Yellow:** product/naming judgment — confirm extracted name before it ships.

### LIM-«publish» — Publish + fallback recording  ·  P0  ·  `human-only`
- Goal: confirm no secrets, record fallback video, finalize submission.
- **human-only:** outward-facing publish — not an unattended agent action.
