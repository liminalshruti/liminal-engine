/**
 * enforce — the "enforce" phase primitives. Uses the pure engine-core state
 * machine to flip the deal status and constructs the EnforcementAction +
 * AuditEvent for a correction. [must-not-cut #3, #6]
 *
 * This is the low-level enforce primitive the loop uses; `approve-enforce.ts`
 * (LIM-1169) is the higher-level atomic Approve+Enforce handler that composes it
 * with the gate + eval trigger. engine-core's pure enforceCorrection is imported
 * as pureEnforceCorrection to avoid shadowing the orchestrator of the same name.
 */
import type {
  EnforcementAction,
  AuditEvent,
  DealStatus,
} from "@liminal-engine/contracts";
import { enforceCorrection as pureEnforceCorrection } from "@liminal-engine/engine-core";
import type { AuditSink } from "./ports.ts";
import type { Clock, IdGen } from "./detect-miss.ts";

/** The locked deciding role — never an invented persona name (DEMO_CONTRACT). */
export const DECIDING_ROLE = "VP Ops / Head of AI Transformation";

export interface EnforceDeps {
  auditSink: AuditSink;
  clock: Clock;
  idGen: IdGen;
}

/** Deterministic sources of identity + time only (no I/O ports). */
export interface IdentityClock {
  clock: Clock;
  idGen: IdGen;
}

/**
 * buildEnforcement — construct the EnforcementAction + AuditEvent for a
 * correction WITHOUT persisting anything. Consumes the idGen twice (action,
 * audit) and the clock twice (enforcedAt, recordedAt) in that fixed order, and
 * throws (via the pure engine-core state machine) when there is nothing to
 * enforce. Separated from persistence so a caller can order side effects for
 * fail-safety while keeping the deterministic id/timestamp assignment stable.
 */
export function buildEnforcement(
  caseId: string,
  dealId: string,
  currentStatus: DealStatus,
  gen: IdentityClock,
): { action: EnforcementAction; audit: AuditEvent } {
  const flip = pureEnforceCorrection(currentStatus);
  if (!flip.ok) throw new Error(flip.error);
  const newStatus = flip.value;

  const action: EnforcementAction = {
    id: gen.idGen.next(),
    caseId,
    dealId,
    fromStatus: currentStatus,
    toStatus: newStatus,
    actor: DECIDING_ROLE,
    enforcedAt: gen.clock.now(),
  };

  const audit: AuditEvent = {
    id: gen.idGen.next(),
    caseId,
    dealId,
    action: "correction-enforced",
    decidingActor: DECIDING_ROLE,
    previousStatus: currentStatus,
    newStatus,
    recordedAt: gen.clock.now(),
  };

  return { action, audit };
}

/**
 * enforce — the operator's Approve + Enforce. Flips the deal status, emits an
 * EnforcementAction, and records an AuditEvent capturing the correction + actor.
 */
export async function enforceCorrection(
  caseId: string,
  dealId: string,
  currentStatus: DealStatus,
  deps: EnforceDeps,
): Promise<{ action: EnforcementAction; audit: AuditEvent }> {
  const { action, audit } = buildEnforcement(caseId, dealId, currentStatus, {
    clock: deps.clock,
    idGen: deps.idGen,
  });
  await deps.auditSink.record(audit);
  return { action, audit };
}
