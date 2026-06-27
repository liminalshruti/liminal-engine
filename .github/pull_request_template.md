<!--
  PR rules (enforced by CI + the architect-reviewer agent):
  - Title MUST contain the Linear issue ID, e.g.  LE-12: detect dropped requirement
  - The "Architecture conformance" matrix MUST be filled (CI fails if empty).
  - Map acceptance criteria to DEMO_CONTRACT.md must-not-cut items where relevant.
  - Incomplete work → prefix title with  BLOCKED:  and use the Blocked format below.
-->

# Summary

Implements Linear issue: <!-- LE-### -->
Spec / contract: <!-- DEMO_CONTRACT.md#... · SCOPE_SPEC.md -->

## What changed

-

## Acceptance criteria verification

| Acceptance criterion (DEMO_CONTRACT) | Status | Evidence (test / command / on-screen) |
|---|---|---|
|  | Done |  |

## Architecture conformance

| Requirement | Source | Implemented in | Test / evidence | Notes |
|---|---|---|---|---|
|  |  |  |  |  |

## Boundary + product-lock check

- [ ] Stayed within the assigned package(s); cross-package only via `@liminal-engine/contracts`
- [ ] **No live integration on the demo spine** (fixtures only; boundary lint green)
- [ ] Domain (engine-core) stayed pure; UI calls governance, not domain internals
- [ ] Did NOT redesign the loop / invent a persona name / make a dashboard the hero
- [ ] Changed a contract? → `pnpm regen:goldens` + updated consumers/fixtures
- [ ] Adapted prior-repo code marked `// ADAPTED FROM:`

## Verification

```text
pnpm verify (typecheck + test + lint:boundaries):
./scripts/smoke.sh:
```

## Demo path

Where this sits on the required demo path, and how to see it on screen:

-

## Known gaps

None. <!-- gaps → convert to a BLOCKED PR; do not present partial work as ready -->

<!-- BLOCKED PR (title "BLOCKED: LE-###: ..."):
## Blocked PR — does NOT complete the issue
### Completed / Not completed / Exact blocker / Why it needs a human / Options / Recommendation
### Safe to merge? No. -->
