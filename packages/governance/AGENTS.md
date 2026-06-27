# AGENTS.md — @liminal-engine/governance (application)

The use-case layer that drives the loop over **ports**. This is where the P0
governance use cases are implemented.

## Rules
- Depend on `./ports.ts` + `@liminal-engine/engine-core` + `@liminal-engine/contracts`.
  NEVER import a concrete adapter or `packages/integrations/*` (enforced:
  `spine-no-live-integrations`). Adapters are injected at the apps/ composition root.
- Use cases take ports as arguments (dependency inversion). The demo spine runs on
  fixture-backed adapters; live adapters are a stretch only.
- Implement to `DEMO_CONTRACT.md` acceptance criteria. Map each P0 issue to one use
  case. No stubs/TODOs for required behavior at completion.
- Validate any untrusted input through the contract's `parse` — never cast.
