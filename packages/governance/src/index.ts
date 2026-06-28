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
export * from "./requirement-ports.ts"; // RequirementStore port + fail-closed read (LIM-1322)

// loop phases (one file per phase)
export * from "./detect-miss.ts"; // detect       (incl. shared Clock / IdGen)
export * from "./active-requirement-checker.ts"; // detect: grade output/action vs active user requirements (LIM-1326)
export * from "./propose-requirements.ts"; // detect: candidate-requirement inbox — proposed until approved (LIM-1325)
export * from "./requirement-case.ts"; // detect: open GovernanceCase from active requirement violations (LIM-1327)
export * from "./compile-correction.ts"; // correct  (STUB — «gov-correct»)
export * from "./enforce.ts"; // enforce
export * from "./proxy-gate.ts"; // enforce: downstream gate (fail-closed)
export * from "./second-pass.ts"; // improve
export * from "./redact.ts"; // audit: data-residency redaction (LIM-1248)
export * from "./audit-ledger.ts"; // audit: hash-chained ledger
export * from "./audit-reconstruction.ts"; // audit: case reconstruction
export * from "./policy-audit.ts"; // audit: policy verdict + rule lifecycle

// orchestrator + the atomic Approve+Enforce handler
export * from "./use-cases.ts"; // runGovernanceLoop
export * from "./approve-enforce.ts";
export * from "./remediation.ts"; // enforce: file Linear remediation issues (LIM-1335)
