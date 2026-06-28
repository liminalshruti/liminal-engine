# Liminal Engine API

A minimal HTTP service that runs the governance loop over **arbitrary posted
agent output**. There is no hardcoded subject and no fixed sequence — point it at
**your own** agent output and it does real work.

## Overview

The governance loop (observe → detect → correct → enforce → audit → improve) is
exposed as a stateless REST API. The caller POSTs the `AgentOutput`(s) they want
governed; the service validates each body against the `AgentOutput` contract at
the edge, runs the real governance phases over a **fresh, per-request** in-memory
adapter set, and returns the contract JSON it produced. Determinism (ids +
timestamps) is injected — real wall-clock + sequential ids by default; tests
inject fixed instances.

> The test: *"Could a stranger point this at THEIR own data and do real work, with
> no narrator and no fixed sequence?"* — Yes.

## Build & Test

```bash
pnpm --filter @liminal-engine/api typecheck
pnpm --filter @liminal-engine/api test
pnpm --filter @liminal-engine/api dev   # runs from TypeScript (node src/index.ts)
```

`build` (`tsc`) is a type-check: the app imports sibling workspace sources with
`.ts` specifiers (`allowImportingTsExtensions`), so there is no JS emit — the
service runs directly from TypeScript.

## API Endpoints

### `GET /health`
Health check. Returns `{ "status": "ok" }`.

### `GET /governance/example`
Returns ready-to-POST example bodies (an arbitrary, non-demo subject) so you can
see the request shape and try the service on a payload of your own.

### `POST /governance/detect`
Detect phase: opens a `GovernanceCase` if the posted agent output silently dropped
a requirement.

**Request:**
```json
{
  "agentOutput": { /* AgentOutput contract — id, dealId, dealName, passNumber,
                      reportedStatus, summary, droppedRequirements, agentMetadata? */ },
  "caseEvidence": {
    "businessImpact": "string (optional)",
    "missingFrom": ["string[] (optional)"],
    "recommendedActions": ["string[] (optional)"]
  }
}
```

**Responses:** `200 { governanceCase }` · `404` (nothing dropped) ·
`400` (invalid `agentOutput`).

### `POST /governance/enforce`
Enforce phase: flips the deal status and records an `EnforcementAction` +
`AuditEvent`.

**Request:**
```json
{
  "governanceCaseId": "...",
  "dealId": "...",
  "currentStatus": "on-track"   /* the deal's current status; on-track flips to at-risk */
}
```

**Responses:** `200 { enforcementAction, auditEvent }` · `400` (bad input) ·
`422` (nothing to enforce — already at-risk).

### `POST /governance/eval`
Improve phase: grades both posted passes against the dropped-requirement criterion
and returns the persisted Fail → Pass table.

**Request:**
```json
{
  "agentOutputPass1": { /* AgentOutput — pass 1 (still dropped) */ },
  "agentOutputPass2": { /* AgentOutput — pass 2 (corrected) */ },
  "caseEvidence": { /* optional */ }
}
```

**Responses:** `200 { evalTable }` · `400` (invalid body) · `422` (clean pass 1).

### `POST /governance/loop`
Full loop: runs all phases over the two posted passes (detect → enforce → audit →
gate → improve) and returns every artifact.

**Request:**
```json
{
  "agentOutputPass1": { /* AgentOutput — pass 1, dropped a requirement */ },
  "agentOutputPass2": { /* AgentOutput — pass 2, corrected */ },
  "caseEvidence": { /* optional */ }
}
```

**Responses:**
```json
{
  "result": {
    "governanceCase": { /* GovernanceCase */ },
    "enforcementAction": { /* EnforcementAction */ },
    "auditEvent": { /* AuditEvent */ },
    "gate": { /* ActionGate */ },
    "evalCase": { /* EvalCase */ },
    "evals": [/* EvalResult[] */]
  }
}
```
`400` (invalid body) · `422` (pass 1 dropped nothing — there is nothing to govern).

## Implementation

- **Arbitrary data**: every request is governed from its own posted `AgentOutput`;
  there is no fixture lookup and no single hardcoded subject.
- **Contract-validated at the edge**: bodies are parsed via `agentOutputContract`
  (zod); invalid input returns `400` with the validation message.
- **Per-request isolation**: each request builds a fresh in-memory store set +
  id generator, so concurrent/repeated runs over different data never bleed.
- **Injected determinism**: `RealClock` + `SequentialIdGen` by default (real ISO
  timestamps + `lim-<n>` ids — never the demo constants); tests inject fixed
  instances for stable assertions.
- **Real logic**: uses the real `@liminal-engine/governance` +
  `@liminal-engine/eval-harness` packages (not stubbed).

## Testing

Tests drive the exported router over an ephemeral HTTP port and assert:
- detect on arbitrary output → 200 with a case keyed off the posted data;
- a clean output → 404; an invalid body → 400;
- the full loop on two arbitrary passes → 200 with all artifacts (Fail → Pass);
- a second, different subject also works (not hardcoded);
- a clean pass 1 → 422; enforce / eval / example endpoints;
- the real defaults emit generated ids + timestamps (never the Acme constants).

## Notes

- In-memory only: nothing persists across server restarts (each request is
  self-contained from its posted payload).
- The server listens on port 3000 by default (configurable via `PORT`).
