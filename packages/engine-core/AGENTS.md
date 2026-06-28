# AGENTS.md — @liminal-engine/engine-core (domain)

Pure domain: the governance-loop primitives + the deal-status state machine.

## Rules
- **Pure.** No node core, no npm SDKs, no I/O, no integrations (enforced:
  `engine-core-is-domain`, `engine-core-no-node-core`). May import
  `@liminal-engine/contracts` types only.
- Encode locked behavior only (the loop `observe→detect→correct→enforce→audit→
  improve`; the `on-track → at-risk` flip). Do NOT redesign the loop (CLAUDE.md).
- Pure functions return `Result<T>`; no throwing for expected failures.
- Every behavior gets a fast domain test.
