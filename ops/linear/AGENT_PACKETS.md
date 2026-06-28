# Linear — Agent Packets

File-boundary-scoped work packets for parallel agent dispatch. Each packet owns
**non-overlapping files** (the mutex against merge conflicts). Acceptance maps to
`DEMO_CONTRACT.md`. The demo spine runs on fixtures — no live calls.

## Packet template

```
### Packet: <name>
- Owns files: <explicit paths — no overlap>
- Reads (context only): <paths>
- Deliverable: <one screen / use case / fixture set / adapter>
- Acceptance: <DEMO_CONTRACT.md must-not-cut / acceptance item>
- Must NOT: redesign loop · invent persona · dashboard-as-hero · live call on spine · touch other packets' files
```

## Packets

### Packet: governance-use-cases
- Owns files: `packages/governance/src/**` (keep `ports.ts` stable)
- Reads: `packages/contracts/**`, `packages/engine-core/**`, `DEMO_CONTRACT.md`
- Deliverable: `detectMiss`, `enforceCorrection` (flips on-track→at-risk + emits AuditEvent),
  `gateDownstreamAction`, `runGovernanceLoop` — over ports, fixture-backed.
- Acceptance: must-not-cut #2 (detection), #3 (enforce flip), #4 (audit), #5 (blocked action).
- Must NOT: import a concrete adapter (use ports).

### Packet: eval-harness
- Owns files: `packages/eval-harness/src/**`
- Reads: `packages/contracts/**` (EvalResult + fixtures)
- Deliverable: `runEvals(dealId)` → table showing Fail (pass 1) → Pass (pass 2).
- Acceptance: must-not-cut #6 (Fail→Pass).

### Packet: linear-panel-adapter
- Owns files: `packages/integrations/linear/src/**`
- Reads: `packages/governance/src/ports.ts`
- Deliverable: simulated Linear workstream panel behind `LinearWorkstreamPanel` (stub exists; flesh out).
- Acceptance: DEMO_CONTRACT cut-if-risky (simulated, not live).

### Packet: demo-app-spine  ← P0 #1/#2 (do FIRST per CLAUDE.md)
- Owns files: `apps/desktop-demo/**`
- Reads: all `packages/**` (consume via package APIs + contracts), `DEMO_CONTRACT.md`
- Deliverable: static clickable walkthrough of the full required demo path, rendering
  `@liminal-engine/contracts/fixtures` (Acme). Wire adapters here (composition root).
- Acceptance: full required demo path in order, must-not-cut #1 + #5 visible, under 3 minutes.
- Must NOT: invent persona name · dashboard-as-hero · live calls on spine.

### Packet: persona-extraction
- Owns files: `DEMO_CONTRACT.md` (persona section), demo copy
- Reads: `../liminal-prototype/**` (reference only)
- Deliverable: extract persona/ICP language; replace generic operator copy.
- Acceptance: no invented persona name anywhere (DEMO_CONTRACT persona rule).
- Note: cross-repo read; mark any adapted copy `// ADAPTED FROM:`.
