/**
 * Governance application layer — use cases over ports.
 *
 * Ports are defined. The use cases (observe → detect → correct → enforce →
 * audit → improve) are implemented here by the overnight agents per the Linear
 * P0 issues — depending on `./ports.ts` and `@liminal-engine/engine-core`, never
 * on a concrete adapter. Keep this serving DEMO_CONTRACT.md; do not redesign the
 * loop.
 */
export * from "./ports.ts";
export * from "./use-cases.ts";
export * from "./audit-ledger.ts";
