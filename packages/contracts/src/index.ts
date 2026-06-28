// @liminal-engine/contracts — the shared kernel. Cross-package coupling goes
// through these contracts only (enforced by .dependency-cruiser.cjs).

export { stableStringify, sha256Hex, canonicalHash } from "./canonical-hash.ts";
export {
  redact,
  isRedactedRef,
  verifyRedaction,
  REDACTION_SCHEME,
  REDACTION_PLACEHOLDER,
  type RedactedRef,
} from "./redact.ts";
export { defineContract, type Contract } from "./define-contract.ts";

export * from "./agent-output.contract.ts";
export * from "./governance-case.contract.ts";
export * from "./enforcement-action.contract.ts";
export * from "./audit-event.contract.ts";
export * from "./action-gate.contract.ts";
export * from "./eval-case.contract.ts";
export * from "./eval-result.contract.ts";
export * from "./correction-event.contract.ts";
export * from "./linear-workstream-payload.contract.ts";
export * from "./policy-rule.contract.ts";
export * from "./approval-gate.contract.ts";
export { CONTRACT_REGISTRY, type ContractEntry } from "./registry.ts";
