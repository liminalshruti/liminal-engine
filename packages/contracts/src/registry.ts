/**
 * Contract registry — the single list the golden test and regen tool both read,
 * so adding a contract automatically pins it.
 */
import { AGENT_OUTPUT_SCHEMA, agentOutputContract, agentOutputGoldenVectors } from "./agent-output.contract.ts";
import { GOVERNANCE_CASE_SCHEMA, governanceCaseContract, governanceCaseGoldenVectors } from "./governance-case.contract.ts";
import { ENFORCEMENT_ACTION_SCHEMA, enforcementActionContract, enforcementActionGoldenVectors } from "./enforcement-action.contract.ts";
import { AUDIT_EVENT_SCHEMA, auditEventContract, auditEventGoldenVectors } from "./audit-event.contract.ts";
import { ACTION_GATE_SCHEMA, actionGateContract, actionGateGoldenVectors } from "./action-gate.contract.ts";
import { EVAL_CASE_SCHEMA, evalCaseContract, evalCaseGoldenVectors } from "./eval-case.contract.ts";
import { EVAL_RESULT_SCHEMA, evalResultContract, evalResultGoldenVectors } from "./eval-result.contract.ts";
import { CORRECTION_EVENT_SCHEMA, correctionEventContract, correctionEventGoldenVectors } from "./correction-event.contract.ts";
import { LINEAR_WORKSTREAM_PAYLOAD_SCHEMA, linearWorkstreamPayloadContract, linearWorkstreamPayloadGoldenVectors } from "./linear-workstream-payload.contract.ts";
import { INTERCEPTED_ACTION_SCHEMA, interceptedActionContract, interceptedActionGoldenVectors } from "./intercepted-action.contract.ts";
import { EVIDENCE_BUNDLE_SCHEMA, evidenceBundleContract, evidenceBundleGoldenVectors } from "./evidence-bundle.contract.ts";

export interface ContractEntry {
  schema: string;
  contract: {
    canonical: (v: never) => unknown;
    hash: (v: never) => string;
    parse: (v: unknown) => unknown;
  };
  vectors: { name: string; purpose: string; input: never }[];
}

// `as unknown as ContractEntry` keeps the registry heterogeneous while each
// contract stays strongly typed at its own definition site.
export const CONTRACT_REGISTRY: ContractEntry[] = [
  { schema: AGENT_OUTPUT_SCHEMA, contract: agentOutputContract, vectors: agentOutputGoldenVectors },
  { schema: GOVERNANCE_CASE_SCHEMA, contract: governanceCaseContract, vectors: governanceCaseGoldenVectors },
  { schema: ENFORCEMENT_ACTION_SCHEMA, contract: enforcementActionContract, vectors: enforcementActionGoldenVectors },
  { schema: AUDIT_EVENT_SCHEMA, contract: auditEventContract, vectors: auditEventGoldenVectors },
  { schema: ACTION_GATE_SCHEMA, contract: actionGateContract, vectors: actionGateGoldenVectors },
  { schema: EVAL_CASE_SCHEMA, contract: evalCaseContract, vectors: evalCaseGoldenVectors },
  { schema: EVAL_RESULT_SCHEMA, contract: evalResultContract, vectors: evalResultGoldenVectors },
  { schema: CORRECTION_EVENT_SCHEMA, contract: correctionEventContract, vectors: correctionEventGoldenVectors },
  { schema: LINEAR_WORKSTREAM_PAYLOAD_SCHEMA, contract: linearWorkstreamPayloadContract, vectors: linearWorkstreamPayloadGoldenVectors },
  { schema: INTERCEPTED_ACTION_SCHEMA, contract: interceptedActionContract, vectors: interceptedActionGoldenVectors },
  { schema: EVIDENCE_BUNDLE_SCHEMA, contract: evidenceBundleContract, vectors: evidenceBundleGoldenVectors },
] as unknown as ContractEntry[];
