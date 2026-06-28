/**
 * EvalLibrary — persisted archive of generated EvalCases from real corrections.
 *
 * Demonstrates "evals compound from real corrections":
 * - Stores EvalCases generated during the governance loop's correct/enforce/audit
 *   phases
 * - Registry pattern: load by caseId, version, query by rule
 * - Persisted to JSON files, in-memory index
 * - No backend database; designed for composability with eval-harness
 *
 * Exported from packages/eval-library/:
 * - EvalLibraryRegistry: in-memory store + JSON persistence
 * - EvalCaseEntry, EvalCaseQuery: types for the registry
 * - defaultRegistry: module singleton for convenience
 */

export { EvalLibraryRegistry, defaultRegistry } from "./registry.ts";
export type { EvalCaseEntry, EvalCaseQuery } from "./registry.ts";
