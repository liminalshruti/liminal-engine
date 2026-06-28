# AGENTS.md — @liminal-engine/contracts (shared kernel)

The cross-package coupling layer. Other packages depend on these contracts;
contracts depends on nothing local (enforced: `contracts-are-leaf`).

## Rules
- A contract = version-tagged `SCHEMA` id + zod `shape` + schema-tagged
  `canonical` projection (`defineContract`). Every contract is pinned by a golden
  test (`test/contracts.golden.test.ts`).
- Changing a shape/canonical → run `pnpm regen:goldens` (deliberate) → update
  consumers + fixtures. CI fails if goldens are stale. A breaking change is a NEW
  version (`...v2`), never an edit to `...v1`.
- Add a contract: create `<name>.contract.ts` (shape + contract + `*GoldenVectors`),
  register it in `src/registry.ts`, run `pnpm regen:goldens`.
- Keep contracts faithful to `DEMO_CONTRACT.md` primitives (GovernanceCase,
  AuditEvent, ActionGate, EvalResult, AgentOutput). Do not invent new product
  concepts here.
- Fixtures (`src/fixtures/acme.ts`) are the LOCKED deterministic demo data; they
  must validate through their contracts and honor the must-not-cut invariants
  (`test/fixtures.test.ts`). Persona = ROLE, never an invented name.
