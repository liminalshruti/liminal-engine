/**
 * approveAndEnforce — the operator's atomic "Approve + Enforce" action (the
 * enforce handler invoked from DEMO_CONTRACT beat #6).
 *
 * On the operator's decision it does two things as one application step:
 *   1. ENFORCE the correction — flips the deal status on-track → at-risk via the
 *      pure engine-core state machine, emits an EnforcementAction, and records an
 *      AuditEvent with the deciding role.            [must-not-cut #3, #6]
 *   2. OPEN the action-gate state — registers the downstream customer-facing
 *      action as gated (reasons + requiredBeforeSend) so it is held until the
 *      case is corrected.                            [must-not-cut #5]
 *
 * It composes the existing enforce + gate use cases (./use-cases.ts) into the one
 * handler the UI triggers; it performs no I/O of its own beyond those use cases.
 * Determinism is inherited from the injected Clock/IdGen — the composition root
 * seeds them with the locked Acme fixture values; tests inject their own — never
 * Date.now() / randomness on the spine.
 *
 * Boundary: imports contracts + ./use-cases + ./ports only — never a concrete
 * adapter (enforced by .dependency-cruiser.cjs).
 */
import type {
  EnforcementAction,
  AuditEvent,
  ActionGate,
  DealStatus,
} from "@liminal-engine/contracts";
import {
  enforceCorrection,
  gateDownstreamAction,
  type Clock,
  type IdGen,
} from "./use-cases.ts";
import type { AuditSink, ActionGateStore } from "./ports.ts";

/** The outbound ports the enforce handler persists its effects through. */
export interface ApproveAndEnforceDeps {
  auditSink: AuditSink;
  actionGateStore: ActionGateStore;
  clock: Clock;
  idGen: IdGen;
}

/** The operator's decision to approve + enforce a correction on a deal. */
export interface ApproveAndEnforceInput {
  /** The GovernanceCase being corrected. */
  caseId: string;
  dealId: string;
  /** The deal's current (pre-enforce) status — must be on-track to enforce. */
  currentStatus: DealStatus;
  /** The downstream action to gate until the case is corrected. */
  gatedAction: string;
}

/** Everything the handler produced — the new operating state for the UI to render. */
export interface ApproveAndEnforceResult {
  /** The deal status AFTER enforcement (at-risk). [must-not-cut #3] */
  status: DealStatus;
  /** The enforcement action that flipped the status. [must-not-cut #3] */
  enforcement: EnforcementAction;
  /** The recorded audit evidence of the correction. [must-not-cut #6] */
  audit: AuditEvent;
  /** The opened action gate holding the downstream action. [must-not-cut #5] */
  gate: ActionGate;
}

/**
 * The enforce handler. Atomic: enforce the correction (status flip + audit) then
 * open the action gate for the downstream blocked action. Returns the resulting
 * operating state. Rejects (via enforceCorrection) if the deal is not on-track —
 * there is nothing to enforce on an already at-risk deal.
 */
export async function approveAndEnforce(
  input: ApproveAndEnforceInput,
  deps: ApproveAndEnforceDeps,
): Promise<ApproveAndEnforceResult> {
  // 1. Enforce the correction — flip status on-track → at-risk + record audit.
  const { action, audit } = await enforceCorrection(
    input.caseId,
    input.dealId,
    input.currentStatus,
    { auditSink: deps.auditSink, clock: deps.clock, idGen: deps.idGen },
  );

  // 2. Open the action-gate state for the downstream blocked action.
  const gate = await gateDownstreamAction(
    deps.actionGateStore,
    input.gatedAction,
    input.caseId,
    deps.idGen,
  );

  return { status: action.toStatus, enforcement: action, audit, gate };
}
