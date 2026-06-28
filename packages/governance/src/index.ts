/**
 * Governance application layer — the barrel.
 *
 * The loop (observe → detect → correct → enforce → audit → improve) is
 * decomposed into one module per phase, each barrel-registered here so Wave-2
 * gov tasks FILL one file without racing on this barrel (the «gov-scaffold»
 * file-zone contract). Depends on ./ports + @liminal-engine/engine-core only —
 * never a concrete adapter. Do not redesign the loop.
 */
export * from "./ports.ts";

// loop phases (one file per phase)
export * from "./detect-miss.ts"; // detect       (incl. shared Clock / IdGen)
export * from "./compile-correction.ts"; // correct  (STUB — «gov-correct»)
export * from "./enforce.ts"; // enforce
export * from "./proxy-gate.ts"; // enforce: downstream gate (fail-closed)
export * from "./second-pass.ts"; // improve
export * from "./audit-ledger.ts"; // audit: hash-chained ledger
export * from "./audit-reconstruction.ts"; // audit: case reconstruction

// orchestrator + the atomic Approve+Enforce handler
export * from "./use-cases.ts"; // runGovernanceLoop
export * from "./approve-enforce.ts";
