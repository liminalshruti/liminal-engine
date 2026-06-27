# Linear — Issue drafts (thin wrappers)

Ready-to-file overnight issues. Each is a THIN wrapper pointing at
`DEMO_CONTRACT.md` + a packet (`AGENT_PACKETS.md`) — architecture detail lives in
the docs, not here. File these in Linear (or auto-create once the Linear MCP is
authed); label as noted. Branch/PR must carry the issue ID (e.g. `LE-12`).

Labels: `nightly` `agent-ready-green` (safe unattended) · `agent-ready-yellow`
(needs a human decision first). See `../../AGENTS.md` + the harness label taxonomy.

---

### LE-1 — Static clickable demo spine  ·  P0 #1/#2  ·  `nightly` `agent-ready-yellow`
- Packet: demo-app-spine. Owns `apps/desktop-demo/**`.
- Goal: full required demo path click-through rendering Acme fixtures, in order.
- Acceptance: DEMO_CONTRACT required path + must-not-cut #1/#5 visible; < 3 min.
- **Yellow:** needs the UI-stack decision (Solid to match liminal-desktop / React / Vite-vanilla) — human call before unattended build.

### LE-2 — Governance use cases (detect → enforce → audit → gate)  ·  P0 #3/#4  ·  `nightly` `agent-ready-green`
- Packet: governance-use-cases. Owns `packages/governance/src/**`.
- Goal: implement the loop over ports; `enforceCorrection` flips on-track→at-risk + emits AuditEvent; block a downstream action.
- Acceptance: must-not-cut #2/#3/#4/#5; tests per criterion; fixtures-backed.

### LE-3 — Eval harness Fail → Pass  ·  P0 #5  ·  `nightly` `agent-ready-green`
- Packet: eval-harness. Owns `packages/eval-harness/src/**`.
- Goal: `runEvals` renders Fail (pass 1) → Pass (pass 2) on the EU-residency criterion.
- Acceptance: must-not-cut #6; deterministic from fixtures.

### LE-4 — Simulated Linear workstream panel  ·  P0 #6/P1  ·  `nightly` `agent-ready-green`
- Packet: linear-panel-adapter. Owns `packages/integrations/linear/src/**`.
- Goal: flesh out the simulated panel behind `LinearWorkstreamPanel` (no live API).
- Acceptance: panel appears on the spine; deterministic.

### LE-5 — Extract persona from liminal-prototype  ·  P0 #7  ·  `nightly` `agent-ready-yellow`
- Packet: persona-extraction.
- Goal: extract persona/ICP language; replace generic copy.
- **Yellow:** product/naming judgment — confirm extracted name before it ships.

### LE-6 — Publish standalone public MIT repo + fallback recording  ·  P0 #8  ·  `human-only`
- Goal: create `github.com/liminalshruti/liminal-engine`, confirm no secrets, record fallback video.
- **human-only:** outward-facing publish — not an unattended agent action.
