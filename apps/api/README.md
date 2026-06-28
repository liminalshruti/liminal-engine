# Liminal Engine API

A minimal HTTP service that wraps the governance loop as a composable REST API.

## Overview

This service demonstrates that the governance loop (observe → detect → correct → enforce → audit → improve) is composable as a stateless service. It accepts contract JSON fixtures and returns contract JSON results.

## Build & Test

```bash
pnpm --filter @liminal-engine/api typecheck
pnpm --filter @liminal-engine/api test
pnpm --filter @liminal-engine/api dev
```

## API Endpoints

### `GET /health`
Health check endpoint. Returns `{ "status": "ok" }`.

### `POST /governance/detect`
Detect phase: identifies dropped requirements.

**Request:**
```json
{
  "dealId": "deal_acme",
  "passNumber": 1,
  "caseEvidence": {
    "businessImpact": "string (optional)",
    "missingFrom": ["string[] (optional)"],
    "recommendedActions": ["string[] (optional)"]
  }
}
```

**Response:**
```json
{
  "governanceCase": { /* GovernanceCase contract */ }
}
```

### `POST /governance/enforce`
Enforce phase: flips deal status and creates an enforcement action.

**Request:**
```json
{
  "governanceCaseId": "gc_...",
  "dealId": "deal_acme",
  "newStatus": "on-track"  /* current status from the agent output */
}
```

**Response:**
```json
{
  "enforcementAction": { /* EnforcementAction contract */ },
  "auditEvent": { /* AuditEvent contract */ }
}
```

### `POST /governance/eval`
Eval phase: returns the Fail → Pass evaluation table.

**Request:**
```json
{
  "dealId": "deal_acme"
}
```

**Response:**
```json
{
  "evalTable": [/* EvalResult[] contract */]
}
```

### `POST /governance/loop`
Full loop: runs all phases (detect → enforce → audit → gate → eval).

**Request:**
```json
{
  "dealId": "deal_acme",
  "caseEvidence": { /* optional */ }
}
```

**Response:**
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

## Implementation

- **No database**: All state is in-memory (apiState maps)
- **Fixture-backed**: Agent output, governance cases, audit events all read from Acme demo fixtures
- **Deterministic**: Clock and IdGen are hardcoded to reproduce the locked fixture values
- **Real logic**: Uses real governance package (not stubbed); all tests exercise real code paths

## Testing

Tests validate:
- Health check works
- Detect correctly identifies dropped requirements
- Enforce flips status and creates audit events
- Eval returns sorted Fail → Pass table
- Full loop orchestrates all phases and returns all artifacts
- Error cases return 400/500 with error messages

## Notes

- Currently supports only the Acme fixture (`deal_acme`)
- In-memory state means state doesn't persist across server restarts
- The server listens on port 3000 by default (configurable via `PORT` env var)
- Deterministic timestamps and IDs are hardcoded to match the Acme fixture for demo reproducibility
