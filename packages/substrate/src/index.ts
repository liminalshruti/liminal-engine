/**
 * @liminal-engine/substrate — ingest arbitrary streams + detect lost context over
 * real data, so the governance loop runs on whatever the operator points it at
 * (not a hardcoded scenario). [BUILD_PLAN.md Gap 2 / DIRECTIVE.md]
 */
export * from "./substrate.ts";
export * from "./detect-lost-context.ts";
export * from "./substrate-source.ts";
