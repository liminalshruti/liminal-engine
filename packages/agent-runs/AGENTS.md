# AGENTS.md — @liminal-engine/agent-runs

This package was built during the LIM-1259 stretch item (Liminal Engine Governance Hack 2026).

## What it contains

- `src/agent-run.contract.ts` — AgentRun contract (shape, validation, canonical hash)
- `src/fixtures.ts` — Acme scenario agent runs (pass 1 → pass 2 → replay chain)
- `src/index.ts` — exports
- `test/agent-run.test.ts` — contract validation + parent-run linking tests

## What it does NOT do

- **No demo wiring**: AgentRun is prep for multi-scenario work, not yet integrated into the demo spine.
- **No live integrations**: fixtures only; no Gemini / Linear / agent execution.
- **No invented persona names**: all references use roles (`VP Ops / Head of AI Transformation`).

## Architecture

AgentRun tracks agent execution lifecycle via three keys:

1. **parentRunId**: links sequential runs (pass 1 → pass 2 → replay)
2. **runKind**: execution mode (`first_pass` | `second_pass` | `replay`)
3. **resolvedContext**: snapshot of state at execution time (passNumber, capturedAt, dealId)

The Acme fixture demonstrates:
- Pass 1 (false green): `parentRunId=null`, `runKind=first_pass`
- Pass 2 (enforced): `parentRunId=ar_acme_p1`, `runKind=second_pass`
- Replay (illustrative): `parentRunId=ar_acme_p2`, `runKind=replay`

All three target `goalId=deal_acme` (the Acme expansion goal).

## Testing

All fixtures validate through the contract. Tests verify:
- Shape and enum validation
- Parent-run linking and chain resolution
- Canonical hash stability
- Status transitions (pending → running → complete → error)
- Golden vectors

Run tests with:
```bash
node --test packages/agent-runs/test/agent-run.test.ts
```

## Integration notes for future sessions

- AgentRun is designed to be a peer to GovernanceCase, EnforcementAction, AuditEvent.
- When multi-scenario work lands, import `acmeAgentRuns` from `@liminal-engine/agent-runs/fixtures`.
- parentRunId chains can be walked backward (prev ← current) or forward (current → next).
- The resolvedContext.passNumber should match the linked AgentOutput.passNumber.
